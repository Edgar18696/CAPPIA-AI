// Publicação REAL no Mercado Livre a partir da Central de Publicação do PAIIA.
//
// Usa a MESMA conexão da tela Contas Marketplace: a linha de
// public.contas_marketplace (marketplace = 'mercado_livre') do usuário logado,
// gravada pela função mercadolivre-oauth. Esta função NÃO mexe no OAuth.
//
// Segurança:
// - usuário PAIIA vem sempre do login (token de sessão enviado pelo app);
// - access_token / refresh_token / client_secret nunca saem desta função
//   e nunca são registrados em log;
// - o token é conferido com GET /users/me: o id devolvido precisa ser o
//   ml_user_id gravado para ESTE usuário PAIIA;
// - renovação (refresh) com trava e gravação atômica: um único UPDATE grava
//   o access_token e o refresh_token NOVO (o Mercado Livre troca o refresh a
//   cada renovação), só se o refresh usado ainda for o do banco.
//
// Publicação:
// - "preparar" e "validar_item" NÃO criam anúncio (validar usa o endpoint
//   oficial POST /items/validate, que só confere o conteúdo);
// - "publicar" só roda com confirmado === true E confirmacao === "PUBLICAR",
//   enviados pela tela de revisão depois do clique do usuário.
// - padrões fixos de todo anúncio novo (_shared/padroesPublicacaoML.js):
//   garantia do vendedor 3 meses (sale_terms), "Ofereço retirada"
//   (shipping.local_pick_up) e informação regulatória "Não se aplica"
//   (INMETRO_CERTIFICATION_REGISTRATION_NUMBER = -1, só se a categoria oferecer).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";
import { aplicarPadroesML, conferirPadroesPublicados, VERSAO_PADROES_ML } from "../_shared/padroesPublicacaoML.js";
import { exigenciasAtributos, idsExigidosML, aplicarAtributosDecididos } from "../_shared/categoriaPublicacaoML.js";
import { conferirDuplicidadeNaConta } from "../_shared/regraDuplicidadeTipo.js";

const API = "https://api.mercadolibre.com";
const VERSAO = "2026-11-09-trava-autorizacao-1";
const MARGEM_RENOVACAO_MS = 5 * 60_000;
const TRAVA_RENOVACAO_MS = 30_000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function responder(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });
}

const texto = (v: unknown) => String(v ?? "").trim();

// ---------- LOGÍSTICA: peso, medidas e limites (anúncios NOVOS) ----------
// Limites: Central de Ajuda do ML, artigo 3163 "Como o custo de envio é
// calculado por medidas e peso" (consultado em 30/09/2026). A API não informa
// mínimos e o simulador não bloqueia valores acima do máximo.
// Peso cúbico: C × L × A (cm) ÷ 6.000 (observado no billable_weight da API).
const DIVISOR_CUBICO = 6000;
const LIMITES_LOGISTICA: Record<string, { nome: string; peso_max_g: number; soma_max_cm: number; lado_max_cm: number }> = {
  correios: { nome: "Envios tradicionais (Correios)", peso_max_g: 30000, soma_max_cm: 200, lado_max_cm: 100 },
  agencia_coleta: { nome: "Agências Mercado Livre ou Coleta", peso_max_g: 50000, soma_max_cm: 300, lado_max_cm: 200 },
  full: { nome: "Centro de distribuição (Full)", peso_max_g: 25000, soma_max_cm: 260, lado_max_cm: 120 },
};
const MODALIDADE_LIMITE: Record<string, string | null> = {
  drop_off: "correios",
  xd_drop_off: "agencia_coleta",
  cross_docking: "agencia_coleta",
  fulfillment: "full",
  self_service: null,
};
// Níveis oficiais. "O usuário confirmou" NÃO é "o PAIIA comprovou":
// MEDIDO_E_VALIDADO exige processo de validação do PAIIA (ainda não existe).
const NIVEIS = ["MEDIDO_E_VALIDADO", "CONFIRMADO_PELO_USUARIO", "REFERENCIA_MARKETPLACE", "PADRAO_PAIIA", "NAO_VALIDADO"];
const NIVEIS_ENVIAVEIS = ["MEDIDO_E_VALIDADO", "CONFIRMADO_PELO_USUARIO"];
const CONFIGS_EMBALAGEM = ["caixa_padrao", "caixa_reforcada", "caixa_fabricante", "envelope", "tubo", "kit_multiplo", "outra"];
function normalizarNivel(v: unknown) {
  const t = String(v ?? "").toUpperCase();
  if (NIVEIS.includes(t)) return t;
  if (t === "VALIDADO" || t === "INFORMADO_PELO_USUARIO" || t === "MANUAL") return "CONFIRMADO_PELO_USUARIO";
  if (t === "REFERENCIA_ML") return "REFERENCIA_MARKETPLACE";
  if (t === "BLING_NAO_VALIDADO" || t === "ESTIMADO") return "NAO_VALIDADO";
  return "";
}
function nivelEnviavel(e: any) {
  return NIVEIS_ENVIAVEIS.includes(normalizarNivel(e?.nivel || e?.origem));
}
function configEmbalagem(v: unknown) {
  const t = String(v ?? "").trim();
  return CONFIGS_EMBALAGEM.includes(t) ? t : "caixa_padrao";
}

function numPos(v: unknown) {
  const t = String(v ?? "").trim().replace(/\s/g, "");
  if (!t) return 0;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function lerMedida(m: any) {
  const r = { peso_g: numPos(m?.peso_g), comprimento_cm: numPos(m?.comprimento_cm), largura_cm: numPos(m?.largura_cm), altura_cm: numPos(m?.altura_cm) };
  return r.peso_g && r.comprimento_cm && r.largura_cm && r.altura_cm ? r : null;
}

function pesoCubico(m: { comprimento_cm: number; largura_cm: number; altura_cm: number }) {
  return Math.round(((m.comprimento_cm * m.largura_cm * m.altura_cm) / DIVISOR_CUBICO) * 1000);
}

// Formato da API de frete "CxLxA,peso": inteiros arredondados PARA CIMA.
function dimensoesApi(m: { peso_g: number; comprimento_cm: number; largura_cm: number; altura_cm: number }) {
  const c = (v: number) => Math.ceil(v);
  return `${c(m.comprimento_cm)}x${c(m.largura_cm)}x${c(m.altura_cm)},${c(m.peso_g)}`;
}

function validarLimitesLogistica(m: { peso_g: number; comprimento_cm: number; largura_cm: number; altura_cm: number }, logistica: string) {
  const chave = MODALIDADE_LIMITE[logistica];
  if (!chave) return { dentro: null as boolean | null, excedidos: [] as Record<string, string>[], limites: null, resultado: "SEM_LIMITE_DOCUMENTADO" };
  const lim = LIMITES_LOGISTICA[chave];
  const excedidos: Record<string, string>[] = [];
  if (m.peso_g > lim.peso_max_g) excedidos.push({ campo: "Peso", valor: `${m.peso_g} g`, limite: `${lim.peso_max_g} g` });
  const lados = [m.comprimento_cm, m.largura_cm, m.altura_cm];
  const maior = Math.max(...lados);
  if (maior > lim.lado_max_cm) excedidos.push({ campo: "Maior lado", valor: `${maior} cm`, limite: `${lim.lado_max_cm} cm` });
  const soma = lados.reduce((a, b) => a + b, 0);
  if (soma > lim.soma_max_cm) excedidos.push({ campo: "Soma dos lados", valor: `${soma} cm`, limite: `${lim.soma_max_cm} cm` });
  return { dentro: excedidos.length === 0, excedidos, limites: { chave, ...lim }, resultado: excedidos.length ? "FORA_DO_LIMITE" : "DENTRO_DO_LIMITE" };
}

// ---------- BASE COMPARTILHADA: identificador anônimo (HMAC) ----------
// HMAC-SHA256(segredo do servidor, "v1|usuário|sku|configuração"). O segredo
// fica só nos segredos da função. O identificador NUNCA é devolvido ao app,
// nem registrado em log, e muda para cada SKU/configuração.
const VERSAO_TEXTO_CONSENTIMENTO = "v1-2026-09-30";
async function hmacContribuinte(segredo: string, usuario: string, sku: string, config: string) {
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const assinatura = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(`v1|${usuario}|${sku}|${config}`));
  return Array.from(new Uint8Array(assinatura)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const normalizarSku = (v: unknown) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
// SKU oficial: só tira espaços sobrando e usa maiúsculas (não inventa nem troca).
const skuOficial = (v: unknown) => String(v ?? "").trim().replace(/\s+/g, " ").toUpperCase();
const skuValido = (v: string) => /^[A-Z0-9][A-Z0-9 ._\/-]{0,59}$/.test(v) && normalizarSku(v).length >= 3;
// "Original", "Genuína", "OEM"... não são marca: código OEM não define a marca.
function marcaInvalida(v: unknown) {
  const t = String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  return Boolean(t) && (/\b(original|originais|genuin[oa]s?)\b/.test(t) || /^(oem|paralela|generica|sem marca|nao informada)$/.test(t));
}
const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

function lerSecret(nome: string) {
  return texto(Deno.env.get(nome)).replace(/^["']+|["']+$/g, "").trim();
}

class ErroML extends Error {
  status: number;
  codigo: string;
  causas: unknown;
  bruto: string;
  constructor(mensagem: string, status = 0, codigo = "", causas: unknown = null, bruto = "") {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.causas = causas;
    this.bruto = bruto;
  }
}

function precoNumero(v: unknown) {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  const t = texto(v).replace(/[^\d.,-]/g, "");
  if (!t) return NaN;
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

function resumirCausas(dados: any) {
  const c = dados?.cause ?? dados?.causes ?? [];
  const lista = Array.isArray(c) ? c : c && typeof c === "object" ? [c] : [];
  return lista.slice(0, 20).map((c: any) => ({
    tipo: texto(c?.type) || null,
    codigo: texto(c?.code) || null,
    mensagem: texto(c?.message).slice(0, 300) || null,
    campos: Array.isArray(c?.references) ? c.references.slice(0, 5) : undefined,
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const corpo = await req.json().catch(() => ({}));
    const acao = texto(corpo?.acao);

    if (acao === "versao") return responder({ ok: true, versao: VERSAO });

    const urlSupabase = Deno.env.get("SUPABASE_URL");
    const chaveServico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!urlSupabase || !chaveServico) {
      return responder({ ok: false, erro: "Credenciais internas do Supabase não configuradas." });
    }
    const admin = createClient(urlSupabase, chaveServico, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: dadosUsuario } = await admin.auth.getUser(jwt);
    const usuarioId = dadosUsuario?.user?.id || "";
    if (!usuarioId) return responder({ ok: false, erro: "Usuário não autenticado. Entre novamente no PAIIA." });

    const COLUNAS = "id, ml_user_id, conta_nome, access_token, refresh_token, expires_at, updated_at, dados, status, ativa";

    // N CONTAS: a conta ML vem SEMPRE explícita no pedido (conta_ml = ML user_id).
    // Sem conta explícita, só funciona se o usuário tiver exatamente 1 conta
    // conectada; com mais de uma, BLOQUEIA (nunca escolhe sozinho).
    const contaPedida = String(corpo?.conta_ml ?? "").replace(/\D/g, "");

    async function lerConta() {
      const { data, error } = await admin
        .from("contas_marketplace")
        .select(COLUNAS)
        .eq("usuario_id", usuarioId)
        .eq("marketplace", "mercado_livre");
      if (error) throw new ErroML(`Base de contas indisponível: ${error.message}`);
      const conectadas = (data || []).filter((c: any) => texto(c?.status || "conectada") !== "desconectada");
      if (contaPedida) {
        const c = conectadas.find((x: any) => String(x?.ml_user_id || "") === contaPedida);
        if (!c) throw new ErroML("A conta Mercado Livre selecionada não está conectada a este usuário PAIIA. Operação bloqueada.", 403, "conta_nao_encontrada");
        return c;
      }
      if (conectadas.length > 1) {
        throw new ErroML("Há mais de uma conta Mercado Livre conectada. Selecione a conta antes de continuar.", 400, "conta_nao_selecionada");
      }
      return conectadas[0] || null;
    }

    async function renovar(conta: any) {
      const clientId = lerSecret("ML_CLIENT_ID");
      const clientSecret = lerSecret("ML_CLIENT_SECRET");
      if (!clientId || !clientSecret) throw new ErroML("Credenciais do Mercado Livre não configuradas no servidor.");
      const refreshUsado = texto(conta?.refresh_token);
      if (!refreshUsado) throw new ErroML("A conexão não tem refresh token. Clique em Reconectar em Contas Marketplace.", 401, "sem_refresh");

      const agora = Date.now();
      const trava = conta?.dados?.renovando_ate ? new Date(conta.dados.renovando_ate).getTime() : 0;
      if (trava > agora) {
        for (let i = 0; i < 15; i += 1) {
          await esperar(1000);
          const c = await lerConta();
          if (c?.access_token && c.access_token !== conta.access_token) return c;
        }
        throw new ErroML("Renovação do token em andamento. Tente de novo em instantes.", 409);
      }
      // Adquire a trava (compare-and-set em updated_at).
      const { data: travou } = await admin
        .from("contas_marketplace")
        .update({ dados: { ...(conta.dados || {}), renovando_ate: new Date(agora + TRAVA_RENOVACAO_MS).toISOString() }, updated_at: new Date().toISOString() })
        .eq("id", conta.id)
        .eq("updated_at", conta.updated_at)
        .select("id");
      if (!travou?.length) {
        await esperar(800);
        const c = await lerConta();
        if (c?.access_token && c.access_token !== conta.access_token) return c;
        throw new ErroML("Conflito ao renovar o token. Tente de novo.", 409);
      }

      const r = await fetch(`${API}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshUsado,
        }),
      });
      const t = await r.json().catch(() => ({}));
      if (!r.ok || !t?.access_token) {
        await admin
          .from("contas_marketplace")
          .update({ dados: { ...(conta.dados || {}), renovando_ate: null, ultimo_erro_renovacao: texto(t?.error || r.status).slice(0, 80) }, updated_at: new Date().toISOString() })
          .eq("id", conta.id);
        throw new ErroML(
          r.status === 400 || r.status === 401
            ? "A autorização do Mercado Livre venceu ou foi revogada. Clique em Reconectar em Contas Marketplace."
            : `O Mercado Livre recusou a renovação do token (HTTP ${r.status}).`,
          r.status === 400 ? 401 : r.status,
          texto(t?.error)
        );
      }
      const novoRefresh = texto(t.refresh_token);
      const segundos = Number(t.expires_in);
      const { data: salvo, error } = await admin
        .from("contas_marketplace")
        .update({
          access_token: texto(t.access_token),
          refresh_token: novoRefresh || refreshUsado,
          expires_at: Number.isFinite(segundos) && segundos > 0 ? new Date(Date.now() + segundos * 1000).toISOString() : null,
          dados: {
            ...(conta.dados || {}),
            renovando_ate: null,
            renovado_em: new Date().toISOString(),
            refresh_rotacionado: Boolean(novoRefresh && novoRefresh !== refreshUsado),
            renovacoes: Number(conta?.dados?.renovacoes || 0) + 1,
            ultimo_erro_renovacao: null,
          },
          updated_at: new Date().toISOString(),
          ultima_renovacao_em: new Date().toISOString(),
        })
        .eq("id", conta.id)
        .eq("refresh_token", refreshUsado)
        .select(COLUNAS);
      if (error || !salvo?.length) throw new ErroML("Token renovado, mas não foi possível gravá-lo.");
      return salvo[0];
    }

    async function contaValida(forcar = false) {
      const conta = await lerConta();
      if (!conta?.access_token) throw new ErroML("Mercado Livre não conectado.", 401, "nao_conectado");
      const expira = conta.expires_at ? new Date(conta.expires_at).getTime() : 0;
      if (!forcar && expira && expira - Date.now() > MARGEM_RENOVACAO_MS) return { conta, renovado: false };
      if (!forcar && !expira) return { conta, renovado: false };
      return { conta: await renovar(conta), renovado: true };
    }

    // Chamada autenticada ao ML. 401 → renova uma vez e repete. 429 → espera.
    async function ml(caminho: string, opcoes: { method?: string; body?: unknown } = {}) {
      let { conta } = await contaValida();
      let renovou = false;
      for (let tentativa = 0; tentativa < 4; tentativa += 1) {
        const r = await fetch(`${API}${caminho}`, {
          method: opcoes.method || "GET",
          headers: {
            Authorization: `Bearer ${conta.access_token}`,
            Accept: "application/json",
            ...(opcoes.body !== undefined ? { "Content-Type": "application/json" } : {}),
          },
          body: opcoes.body !== undefined ? JSON.stringify(opcoes.body) : undefined,
        });
        const bruto = await r.text().catch(() => "");
        let dados: any = null;
        try { dados = bruto ? JSON.parse(bruto) : null; } catch (_) { dados = null; }
        if (r.ok) return { status: r.status, dados };
        if (r.status === 401 && !renovou) {
          renovou = true;
          conta = await renovar(await lerConta());
          continue;
        }
        if (r.status === 429 && tentativa < 3) {
          await esperar(1200 * (tentativa + 1));
          continue;
        }
        // Respostas de erro do ML não trazem tokens; guarda um trecho para diagnóstico.
        throw new ErroML(texto(dados?.message || dados?.error || `Mercado Livre respondeu HTTP ${r.status}.`).slice(0, 300), r.status, texto(dados?.error), resumirCausas(dados), bruto.replace(/\s+/g, " ").slice(0, 1500));
      }
      throw new ErroML("Mercado Livre não respondeu após novas tentativas.");
    }

    // ---------- SEGURANÇA DE CONTA (N contas) ----------
    // Escrita no Mercado Livre: conta explícita + o token precisa ser da conta
    // escolhida (/users/me) — senão BLOQUEIA. Anúncios existentes ainda têm o
    // seller_id conferido em cada ação.
    const ACOES_ESCRITA_ML = new Set(["publicar", "gravar_compatibilidades", "remover_compatibilidade", "gravar_atributos", "pausar_item", "corrigir_sku_item", "corrigir_marca_item", "corrigir_descricao_item"]);
    const ACOES_CONTA_OBRIGATORIA = new Set([...ACOES_ESCRITA_ML, "preparar", "validar_item"]);
    if (ACOES_CONTA_OBRIGATORIA.has(acao) && !contaPedida) {
      return responder({ ok: false, codigo: "conta_nao_selecionada", erro: "Selecione explicitamente a conta Mercado Livre antes desta operação. Nada foi feito." });
    }
    if (ACOES_ESCRITA_ML.has(acao)) {
      const contaEscrita = await lerConta();
      if (!contaEscrita?.access_token) return responder({ ok: false, codigo: "nao_conectado", erro: "A conta Mercado Livre selecionada não está conectada." });
      const eu = (await ml("/users/me")).dados || {};
      if (String(eu?.id || "") !== String(contaEscrita.ml_user_id || "")) {
        return responder({ ok: false, codigo: "conta_divergente", erro: "O acesso gravado não corresponde à conta Mercado Livre selecionada. Escrita BLOQUEADA." });
      }
    }

    // ---------- CONEXÃO: pertence ao usuário? refresh funciona? ----------
    if (acao === "validar_conexao") {
      const antes = await lerConta();
      if (!antes?.access_token) return responder({ ok: true, conectado: false });
      const { conta, renovado } = await contaValida(corpo?.forcar_renovacao === true);
      const eu = (await ml("/users/me")).dados || {};
      const atual = await lerConta();
      const pertence = String(eu?.id || "") !== "" && String(eu.id) === String(atual?.ml_user_id || conta?.ml_user_id || "");
      return responder({
        ok: true,
        versao: VERSAO,
        conectado: true,
        nickname: texto(eu?.nickname) || atual?.conta_nome || "",
        ml_user_id: String(atual?.ml_user_id || ""),
        pertence_ao_usuario: pertence,
        site_id: texto(eu?.site_id) || null,
        // Identificação da conta (dados do próprio vendedor, para o dono conferir qual conta é).
        email: texto(eu?.email) || null,
        nome: [texto(eu?.first_name), texto(eu?.last_name)].filter(Boolean).join(" ") || null,
        empresa: texto(eu?.company?.brand_name || eu?.company?.corporate_name) || null,
        tipo_conta: texto(eu?.user_type) || null,
        criada_em: texto(eu?.registration_date) || null,
        link_perfil: texto(eu?.permalink) || null,
        pode_vender: eu?.status?.sell?.allow ?? null,
        bloqueios_venda: Array.isArray(eu?.status?.sell?.codes) ? eu.status.sell.codes.slice(0, 10) : [],
        token_valido_ate: atual?.expires_at || null,
        renovado,
        refresh_rotacionado: renovado ? Boolean(atual?.dados?.refresh_rotacionado) : null,
        renovacoes: Number(atual?.dados?.renovacoes || 0),
      });
    }

    // ---------- MONTAGEM DO ANÚNCIO (sem publicar) ----------
    function quantidadeConfirmada(v: unknown): number | null {
      const t = texto(v);
      if (!/^\d+$/.test(t)) return null;
      const n = Number(t);
      return n >= 1 ? n : null;
    }
    const ERRO_QUANTIDADE = "Quantidade não confirmada: informe e confirme a quantidade na Publicação (o PAIIA não assume nenhum valor).";
    // Condição APROVADA na ficha → condition do Mercado Livre. Nunca assume
    // "novo": sem condição válida, validar e publicar são recusados.
    function condicaoML(v: unknown): "new" | "used" | null {
      const t = texto(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (["novo", "nova", "new"].includes(t)) return "new";
      if (["usado", "usada", "used"].includes(t)) return "used";
      return null;
    }
    const ERRO_CONDICAO = "Condição não confirmada na ficha (novo ou usado): o PAIIA não assume nenhum valor.";
    function montarItem(entrada: any, categoriaId: string) {
      const titulo = texto(entrada?.titulo).slice(0, 60);
      const preco = precoNumero(entrada?.preco);
      // Quantidade CONFIRMADA na ficha (nunca assume 1). Sem ela, validar e
      // publicar são recusados antes de chegar ao Mercado Livre.
      const quantidade = quantidadeConfirmada(entrada?.quantidade);
      const tipo = texto(entrada?.tipoAnuncio).toLowerCase() === "premium" ? "gold_pro" : "gold_special";
      const fotos: string[] = (Array.isArray(entrada?.fotos) ? entrada.fotos : [])
        .map((f: unknown) => texto(f))
        .filter((u: string) => /^https:\/\//i.test(u))
        .slice(0, 10);
      const atributos: { id: string; value_name: string }[] = [];
      const marca = texto(entrada?.marca);
      if (marca) atributos.push({ id: "BRAND", value_name: marca.slice(0, 60) });
      const codigo = texto(entrada?.codigo || entrada?.oem);
      if (codigo) atributos.push({ id: "PART_NUMBER", value_name: codigo.slice(0, 60) });
      // SKU do vendedor (vínculo com o cadastro do Bling).
      const sku = texto(entrada?.sku);
      if (sku) atributos.push({ id: "SELLER_SKU", value_name: sku.slice(0, 60) });
      const gtin = texto(entrada?.gtin).replace(/\D/g, "");
      if (gtin) atributos.push({ id: "GTIN", value_name: gtin });
      for (const extra of Array.isArray(entrada?.atributos_extras) ? entrada.atributos_extras : []) {
        const id = texto(extra?.id).toUpperCase();
        if (!/^[A-Z0-9_]{2,60}$/.test(id) || atributos.some((a) => a.id === id)) continue;
        const valueId = texto(extra?.value_id);
        const valueName = texto(extra?.value_name).slice(0, 120);
        if (valueId) atributos.push({ id, value_id: valueId } as any);
        else if (valueName) atributos.push({ id, value_name: valueName });
      }
      // Peso e embalagem: só medida VALIDADA ou INFORMADA pelo usuário.
      // Referência do ML e Bling nunca são enviados como medida do produto.
      const emb = lerMedida(entrada?.embalagem);
      if (emb && nivelEnviavel(entrada?.embalagem)) {
        const n = (v: number) => String(v);
        for (const [id, valor] of [
          ["SELLER_PACKAGE_LENGTH", `${n(emb.comprimento_cm)} cm`],
          ["SELLER_PACKAGE_WIDTH", `${n(emb.largura_cm)} cm`],
          ["SELLER_PACKAGE_HEIGHT", `${n(emb.altura_cm)} cm`],
          ["SELLER_PACKAGE_WEIGHT", `${n(emb.peso_g)} g`],
        ]) {
          if (!atributos.some((a) => a.id === id)) atributos.push({ id, value_name: valor });
        }
      }
      const item: Record<string, unknown> = {
        title: titulo,
        category_id: categoriaId,
        price: preco,
        currency_id: "BRL",
        ...(quantidade ? { available_quantity: quantidade } : {}),
        buying_mode: "buy_it_now",
        condition: condicaoML(entrada?.condicao) || undefined,
        listing_type_id: tipo,
        pictures: fotos.map((source) => ({ source })),
        attributes: atributos,
      };
      // Contas no modelo "Produtos do vendedor" (User Products) do ML não
      // aceitam "title" no POST: o nome vai em "family_name".
      if (entrada?.family_name === true) {
        item.family_name = titulo;
        delete item.title;
      }
      return item;
    }

    // Padrões fixos: lê (somente leitura) os atributos da categoria e os modos
    // de envio da conta para não inventar nem forçar campo incompatível.
    async function contextoPadroes(categoriaId: string) {
      let atributosCategoria: unknown[] | null = null;
      let modosFrete: string[] | null = null;
      try {
        const a = (await ml(`/categories/${encodeURIComponent(categoriaId)}/attributes`)).dados;
        if (Array.isArray(a)) atributosCategoria = a;
      } catch (_) { /* fica null: limitação mostrada */ }
      try {
        const c = await lerConta();
        const pref = (await ml(`/users/${encodeURIComponent(String(c?.ml_user_id || ""))}/shipping_preferences`)).dados || {};
        if (Array.isArray(pref?.modes)) modosFrete = pref.modes.map((m: unknown) => texto(m));
      } catch (_) { /* fica null: limitação mostrada */ }
      return { atributosCategoria, modosFrete };
    }
    function montarComPadroes(entrada: any, categoriaId: string, ctx: { atributosCategoria: unknown[] | null; modosFrete: string[] | null }) {
      return aplicarPadroesML(montarItem(entrada, categoriaId), ctx as any) as {
        item: Record<string, unknown>; padroes: Record<string, unknown>; limitacoes: string[]; bloqueios: string[];
      };
    }

    // (09/10/2026) CATEGORIA: só a CONFIRMADA pelo usuário na Conferência.
    // Sem categoria confirmada = NÃO prepara, NÃO valida, NÃO publica
    // (o servidor nunca escolhe pela sugestão do preditor).
    const ERRO_CATEGORIA = "Categoria do Mercado Livre não confirmada na Conferência: nada é validado nem publicado (o PAIIA não escolhe categoria pela sugestão do preditor).";
    function categoriaConfirmada(entrada: any): string {
      const id = texto(entrada?.categoria_id).toUpperCase();
      const conf = texto(entrada?.categoria_confirmada_id).toUpperCase();
      return /^MLB\d+$/.test(id) && id === conf ? id : "";
    }
    // Obrigatórios + CONDICIONAIS da categoria para ESTE item: regra do GTIN
    // (EMPTY_GTIN_REASON, valor oficial escolhido pelo usuário) e a consulta
    // oficial POST /categories/{id}/attributes/conditional (somente cálculo).
    async function exigenciasDoItem(categoriaId: string, item: Record<string, unknown>, entrada: any, atributosCategoria: unknown[] | null) {
      let exigidosML: string[] | null = null;
      let limitacao = "";
      try {
        const r = await ml(`/categories/${encodeURIComponent(categoriaId)}/attributes/conditional`, {
          method: "POST",
          body: { category_id: categoriaId, attributes: (item.attributes as unknown[]) || [] },
        });
        exigidosML = idsExigidosML(r.dados);
      } catch (e) {
        limitacao = `Consulta oficial de atributos condicionais indisponível (${(e as Error).message}); conferida só a regra do GTIN.`;
      }
      const ex = exigenciasAtributos({
        atributos: atributosCategoria,
        preenchidos: ((item.attributes as any[]) || []).map((a) => texto(a?.id)),
        gtin: texto(entrada?.gtin),
        motivoSemGtin: entrada?.motivo_sem_gtin || null,
        exigidosML,
      });
      return { ...ex, limitacao };
    }

    if (acao === "preparar") {
      const entrada = corpo?.anuncio || {};
      const titulo = texto(entrada?.titulo).slice(0, 60);
      if (!titulo) return responder({ ok: false, erro: "Informe o título do anúncio." });
      const conexao = await contaValida();
      void conexao;
      // (09/10/2026) REMOVIDO: "sem categoria → usar a 1ª sugestão do preditor".
      const categoriaId = categoriaConfirmada(entrada);
      if (!categoriaId) return responder({ ok: false, codigo: "categoria_nao_confirmada", erro: ERRO_CATEGORIA });
      let obrigatorios: { id: string; nome: string; preenchido: boolean }[] = [];
      let atributosLidos: unknown[] | null = null;
      if (categoriaId) {
        const atributos = (await ml(`/categories/${encodeURIComponent(categoriaId)}/attributes`)).dados || [];
        atributosLidos = Array.isArray(atributos) ? atributos : null;
        const item = montarItem(entrada, categoriaId);
        const preenchidos = new Set((item.attributes as any[]).map((a) => a.id));
        obrigatorios = (Array.isArray(atributos) ? atributos : [])
          .filter((a: any) => a?.tags?.required || a?.tags?.catalog_required)
          .map((a: any) => ({
            id: texto(a.id),
            nome: texto(a.name),
            preenchido: preenchidos.has(texto(a.id)),
            tipo: texto(a.value_type) || null,
            valores: Array.isArray(a.values) ? a.values.slice(0, 60).map((v: any) => ({ id: texto(v.id), nome: texto(v.name) })) : [],
          }));
      }
      const fotosRecebidas = Array.isArray(entrada?.fotos) ? entrada.fotos.length : 0;

      // Fotos: o ML baixa cada URL; confere se abre de fora e é imagem.
      const fotosCheck: Record<string, unknown>[] = [];
      for (const u of (Array.isArray(entrada?.fotos) ? entrada.fotos : []).slice(0, 12)) {
        const link = texto(u);
        if (!/^https:\/\//i.test(link)) {
          fotosCheck.push({ ok: false, motivo: link.startsWith("data:") ? "imagem embutida (sem endereço público)" : "não é https" });
          continue;
        }
        try {
          const r = await fetch(link, { method: "GET", headers: { Range: "bytes=0-1023" } });
          const tipo = r.headers.get("content-type") || "";
          await r.body?.cancel();
          fotosCheck.push({ ok: (r.status === 200 || r.status === 206) && tipo.startsWith("image/"), status: r.status, tipo });
        } catch (_) {
          fotosCheck.push({ ok: false, motivo: "não abriu" });
        }
      }

      // Frete: preferências de envio da conta (somente leitura).
      let frete: Record<string, unknown> | null = null;
      try {
        const contaAtual = await lerConta();
        const pref = (await ml(`/users/${encodeURIComponent(String(contaAtual?.ml_user_id || ""))}/shipping_preferences`)).dados || {};
        frete = {
          modos: Array.isArray(pref?.modes) ? pref.modes : [],
          logisticas: Array.isArray(pref?.logistics)
            ? pref.logistics.map((l: any) => ({ modo: l?.mode, tipos: (l?.types || []).map((t: any) => t?.type).filter(Boolean) }))
            : [],
        };
      } catch (e) {
        frete = { erro: (e as Error).message };
      }
      const montado = categoriaId
        ? montarComPadroes(entrada, categoriaId, { atributosCategoria: atributosLidos, modosFrete: Array.isArray((frete as any)?.modos) ? (frete as any).modos : null })
        : null;
      const exigencias = montado ? await exigenciasDoItem(categoriaId, montado.item, entrada, atributosLidos) : null;
      const item = montado ? aplicarAtributosDecididos(montado.item, exigencias?.enviar || []) : null;
      return responder({
        ok: true,
        padroes_ml: montado?.padroes || null,
        limitacoes_padroes: [...(montado?.limitacoes || []), ...(exigencias?.limitacao ? [exigencias.limitacao] : [])],
        bloqueios_padroes: montado?.bloqueios || [],
        versao_padroes: VERSAO_PADROES_ML,
        categoria_id: categoriaId,
        // Condicionais exigidos para ESTE anúncio (ex.: motivo sem GTIN).
        exigencias_condicionais: exigencias ? { ok: exigencias.ok, condicionais: exigencias.condicionais, pendentes: exigencias.pendentes.filter((p: any) => p.tipo !== "obrigatorio"), avisos: exigencias.avisos } : null,
        item,
        descricao_texto: texto(entrada?.descricao).slice(0, 50000),
        obrigatorios,
        fotos_check: fotosCheck,
        frete,
        avisos: [
          ...(fotosRecebidas && item && (item.pictures as any[]).length < fotosRecebidas
            ? [`${fotosRecebidas - (item.pictures as any[]).length} foto(s) sem endereço público https foram deixadas de fora.`]
            : []),
          ...(item && !(item.pictures as any[]).length ? ["Nenhuma foto com endereço público: o Mercado Livre exige pelo menos uma."] : []),
          ...(item && !(Number(item.price) > 0) ? ["Preço inválido."] : []),
          "Compatibilidade de veículos não é enviada nesta etapa. Peso e embalagem: só a medida confirmada no bloco PESO E EMBALAGEM.",
        ],
      });
    }

    // Validação oficial (POST /items/validate): confere, NÃO cria anúncio.
    async function validar(item: Record<string, unknown>) {
      try {
        await ml("/items/validate", { method: "POST", body: item });
        return { valido: true, causas: [] as unknown[] };
      } catch (e) {
        const err = e as ErroML;
        if (err.status && err.status < 500 && err.status !== 401 && err.status !== 409) {
          const causas = Array.isArray(err.causas) ? (err.causas as any[]) : [];
          // O ML responde 400 mesmo quando só há AVISOS (ex.: frete grátis
          // obrigatório). Só é inválido se houver alguma causa do tipo "error".
          const soAvisos = causas.length > 0 && causas.every((c) => c?.tipo === "warning");
          if (soAvisos) return { valido: true, mensagem: null, causas, detalhe: "" };
          return { valido: false, mensagem: err.message, causas, detalhe: err.bruto || "" };
        }
        throw e;
      }
    }

    async function validarComVariacoes(entrada: any) {
      const categoriaId = categoriaConfirmada(entrada);
      if (!categoriaId) throw new ErroML(ERRO_CATEGORIA);
      const ctx = await contextoPadroes(categoriaId);
      let montado = montarComPadroes(entrada, categoriaId, ctx);
      // Obrigatórios + condicionais (motivo sem GTIN etc.): pendência BLOQUEIA.
      const ex = await exigenciasDoItem(categoriaId, montado.item, entrada, ctx.atributosCategoria);
      const bloqueiosCategoria = ex.pendentes.map((p: any) => p.texto);
      let item = aplicarAtributosDecididos(montado.item, ex.enviar);
      let r = await validar(item);
      // Contas no modelo "Produtos do vendedor" (User Products) exigem family_name.
      if (!r.valido && /family_name|\[title\] (are|is) invalid/i.test(JSON.stringify(r))) {
        montado = montarComPadroes({ ...entrada, family_name: true }, categoriaId, ctx);
        item = aplicarAtributosDecididos(montado.item, ex.enviar);
        r = await validar(item);
      }
      return {
        item, ...r, padroes: montado.padroes,
        limitacoes: [...montado.limitacoes, ...(ex.limitacao ? [ex.limitacao] : []), ...ex.avisos.map((a: any) => a.texto)],
        bloqueios: [...montado.bloqueios, ...bloqueiosCategoria],
        exigencias: { ok: ex.ok, pendentes: ex.pendentes, avisos: ex.avisos },
      };
    }

    if (acao === "validar_item") {
      if (!categoriaConfirmada(corpo?.anuncio || {})) return responder({ ok: false, codigo: "categoria_nao_confirmada", erro: ERRO_CATEGORIA });
      if (!quantidadeConfirmada(corpo?.anuncio?.quantidade)) return responder({ ok: false, erro: ERRO_QUANTIDADE });
      if (!condicaoML(corpo?.anuncio?.condicao)) return responder({ ok: false, erro: ERRO_CONDICAO });
      if (marcaInvalida(corpo?.anuncio?.marca)) {
        return responder({ ok: false, erro: `Marca "${texto(corpo?.anuncio?.marca)}" não é marca (código OEM/original não define a marca). Use a marca real aprovada.` });
      }
      const r = await validarComVariacoes(corpo?.anuncio || {});
      return responder({
        ok: true,
        valido: r.valido && !r.bloqueios.length,
        valido_ml: r.valido,
        mensagem: (r as any).mensagem || (r.bloqueios.length ? r.bloqueios.join(" ") : null),
        causas: r.causas,
        detalhe: (r as any).detalhe || null,
        item: r.item,
        padroes_ml: r.padroes,
        limitacoes_padroes: r.limitacoes,
        bloqueios_padroes: r.bloqueios,
        exigencias_condicionais: (r as any).exigencias || null,
        versao_padroes: VERSAO_PADROES_ML,
      });
    }

    // ---------- PUBLICAÇÃO REAL (só com confirmação explícita) ----------
    if (acao === "publicar") {
      if (corpo?.confirmado !== true || texto(corpo?.confirmacao) !== "PUBLICAR") {
        return responder({ ok: false, erro: "Publicação não confirmada pelo usuário." });
      }
      const entrada = corpo?.anuncio || {};
      // Sem categoria CONFIRMADA na Conferência = NÃO PUBLICA.
      if (!categoriaConfirmada(entrada)) return responder({ ok: false, codigo: "categoria_nao_confirmada", erro: ERRO_CATEGORIA });
      if (!quantidadeConfirmada(entrada?.quantidade)) return responder({ ok: false, erro: ERRO_QUANTIDADE });
      if (!condicaoML(entrada?.condicao)) return responder({ ok: false, erro: ERRO_CONDICAO });
      if (marcaInvalida(entrada?.marca)) {
        return responder({ ok: false, erro: `Marca "${texto(entrada?.marca)}" não é marca (código OEM/original não define a marca). Use a marca real aprovada.` });
      }
      const embPub = lerMedida(entrada?.embalagem);
      if (!embPub || !nivelEnviavel(entrada?.embalagem)) {
        return responder({ ok: false, erro: "Informe e confirme peso e medidas da embalagem (MEDIDO E VALIDADO ou CONFIRMADO PELO USUÁRIO) antes de publicar." });
      }
      const limPub = validarLimitesLogistica(embPub, texto(entrada?.embalagem?.modalidade) || "xd_drop_off");
      if (limPub.dentro === false) {
        return responder({ ok: false, erro: "EMBALAGEM FORA DO LIMITE DE ENVIO.", excedidos: limPub.excedidos, limites: limPub.limites });
      }
      const v = await validarComVariacoes(entrada);
      if (v.bloqueios.length) return responder({ ok: false, erro: v.bloqueios.join(" "), bloqueios_padroes: v.bloqueios, padroes_ml: v.padroes });
      if (!v.valido) return responder({ ok: false, erro: "O Mercado Livre não aceitou os dados do anúncio.", causas: v.causas, padroes_ml: v.padroes });
      // (24/11/2026) DUPLICIDADE — mesma regra da tela principal e da revisão final (regraDuplicidadeTipo.js):
      // mesmo SKU nesta conta e mesmo tipo (ou tipo desconhecido) = bloqueia; tipo diferente = só com a
      // confirmação MANUAL destes MLBs e deste tipo (duplicidade_confirmada). Falha na leitura = bloqueia.
      {
        const contaDup = await lerConta();
        const dup = await conferirDuplicidadeNaConta({
          sku: texto(entrada?.sku || entrada?.codigo),
          conta: String(contaDup?.ml_user_id || ""),
          tipoNovo: texto((v.item as any)?.listing_type_id),
          confirmacao: corpo?.duplicidade_confirmada || null,
          ler: async (caminho: string) => (await ml(caminho)).dados,
        });
        if (!dup.libera) {
          return responder({ ok: false, publicado: false, codigo: "duplicidade", erro: dup.texto, duplicidade: dup.av ? { estado: dup.av.estado, ids: dup.av.ids, tipo_novo: dup.av.tipoNovo } : null });
        }
      }
      // (09/11/2026) TRAVA DA AUTORIZAÇÃO — só quando o PAIIA manda autorizacao_id (publicação automática).
      // Uma autorização = UMA tentativa: índice único (usuário, autorização) gravado ANTES do POST.
      // Sem autorizacao_id: comportamento anterior (tela do computador), sem mudança.
      const autorizacaoId = texto(corpo?.autorizacao_id).toLowerCase();
      let travaId = "";
      if (autorizacaoId) {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(autorizacaoId)) return responder({ ok: false, erro: "Identificador da autorização inválido. Nada foi enviado." });
        const { data: trava, error: erroTrava } = await admin.from("ml_publicacoes_autorizacoes")
          .insert({ usuario_id: usuarioId, autorizacao_id: autorizacaoId, conta_ml: contaPedida, sku: texto(entrada?.sku || entrada?.codigo) || null, status: "em_andamento" })
          .select("id").single();
        if (erroTrava || !trava?.id) {
          if (String((erroTrava as any)?.code || "") !== "23505") return responder({ ok: false, erro: `Registro de publicações indisponível (${erroTrava?.message || "sem ID"}). Nada foi enviado.` });
          const { data: ja } = await admin.from("ml_publicacoes_autorizacoes").select("status, item_id, link").eq("usuario_id", usuarioId).eq("autorizacao_id", autorizacaoId).maybeSingle();
          if (ja?.status === "publicado" && ja.item_id) return responder({ ok: true, publicado: true, ja_publicado: true, item_id: ja.item_id, link: ja.link || null, mensagem: "Esta autorização já publicou este anúncio. Nada foi reenviado." });
          return responder({ ok: false, publicado: false, bloqueado: true, incerto: ja?.status !== "recusado", estado_autorizacao: ja?.status || "desconhecido",
            erro: ja?.status === "recusado" ? "Esta autorização já foi usada e o Mercado Livre recusou o envio. Nada foi reenviado." : "Esta autorização já está em uso ou com resultado incerto. Nada foi reenviado: confira na conta." });
        }
        travaId = trava.id;
      }
      const marcar = async (campos: Record<string, unknown>) => {
        if (!travaId) return;
        await admin.from("ml_publicacoes_autorizacoes").update({ ...campos, updated_at: new Date().toISOString() }).eq("id", travaId);
      };
      let criado: any = {};
      try {
        criado = (await ml("/items", { method: "POST", body: v.item })).dados || {};
      } catch (e) {
        const err = e as ErroML;
        // Erro devolvido pelo ML (4xx) = não criou. Sem resposta / 5xx = INCERTO (nunca repetido).
        const recusado = Number(err?.status) >= 400 && Number(err?.status) < 500;
        await marcar({ status: recusado ? "recusado" : "incerto", detalhe: String(err?.message || e).slice(0, 500) });
        if (travaId && !recusado) return responder({ ok: false, publicado: false, incerto: true, erro: "Não foi possível confirmar se o Mercado Livre criou o anúncio. Nada foi reenviado: confira na conta." });
        throw e;
      }
      if (travaId) await marcar(criado?.id ? { status: "publicado", item_id: criado.id, link: criado?.permalink || null } : { status: "incerto", detalhe: "Mercado Livre respondeu sem o ID do anúncio." });
      let descricaoOk: boolean | null = null;
      const descricao = texto(entrada?.descricao);
      if (criado?.id && descricao) {
        try {
          await ml(`/items/${encodeURIComponent(criado.id)}/description`, { method: "POST", body: { plain_text: descricao.slice(0, 50000) } });
          descricaoOk = true;
        } catch (_) {
          descricaoOk = false;
        }
      }
      // Releitura oficial dos padrões (garantia, retirada, regulatória).
      let padroesPublicados: unknown = null;
      if (criado?.id) {
        try {
          const lido = (await ml(`/items/${encodeURIComponent(criado.id)}`)).dados || null;
          padroesPublicados = conferirPadroesPublicados(lido, v.padroes);
        } catch (e) {
          padroesPublicados = { itens: [], pendencias: [`Padrões ML: releitura falhou (${(e as Error).message}).`] };
        }
      }
      return responder({
        ok: true,
        padroes_ml: v.padroes,
        limitacoes_padroes: v.limitacoes,
        padroes_publicados: padroesPublicados,
        publicado: Boolean(criado?.id),
        item_id: criado?.id || null,
        link: criado?.permalink || null,
        status: criado?.status || null,
        descricao_enviada: descricaoOk,
        avisos_ml: Array.isArray(criado?.warnings) ? criado.warnings.slice(0, 10) : [],
      });
    }

    // ---------- LOGÍSTICA: simulação oficial (somente leitura) ----------
    // Lê preferências de envio da conta e da categoria, a medida validada do
    // SKU e o histórico; simula o custo do frete com a medida informada.
    // Não cria nem altera nada no Mercado Livre.
    if (acao === "simular_logistica") {
      const conta = await lerConta();
      const mlUser = encodeURIComponent(String(conta?.ml_user_id || ""));
      const categoria = texto(corpo?.categoria_id);
      const preco = precoNumero(corpo?.preco);
      const tipo = texto(corpo?.tipoAnuncio).toLowerCase() === "premium" ? "gold_pro" : "gold_special";
      const sku = texto(corpo?.sku);
      const skuN = normalizarSku(sku);
      const medida = lerMedida(corpo?.medida);

      // Modalidade logística da conta (me2) e da categoria.
      let modalidades: { tipo: string; padrao: boolean; ativo: boolean }[] = [];
      let prefErro: string | null = null;
      try {
        const pref = (await ml(`/users/${mlUser}/shipping_preferences`)).dados || {};
        const me2 = (Array.isArray(pref?.logistics) ? pref.logistics : []).find((l: any) => l?.mode === "me2");
        modalidades = (me2?.types || []).map((t: any) => ({ tipo: texto(t?.type), padrao: t?.default === true, ativo: texto(t?.status) === "active" }));
      } catch (e) { prefErro = (e as Error).message; }
      let categoriaRef: Record<string, unknown> | null = null;
      let categoriaLogisticas: string[] = [];
      let categoriaRestrita: boolean | null = null;
      if (/^MLB\d+$/.test(categoria)) {
        try {
          const cp = (await ml(`/categories/${categoria}/shipping_preferences`)).dados || {};
          const d = cp?.dimensions || null;
          categoriaRef = d ? { peso_g: Number(d.weight) || 0, comprimento_cm: Number(d.length) || 0, largura_cm: Number(d.width) || 0, altura_cm: Number(d.height) || 0 } : null;
          categoriaLogisticas = ((Array.isArray(cp?.logistics) ? cp.logistics : []).find((l: any) => l?.mode === "me2")?.types || []).map(String);
          categoriaRestrita = cp?.restricted ?? null;
        } catch (_) { /* referência opcional */ }
      }
      const pedida = texto(corpo?.modalidade);
      const padrao = modalidades.find((m) => m.padrao && m.ativo)?.tipo || modalidades.find((m) => m.ativo)?.tipo || "";
      const modalidade = pedida && modalidades.some((m) => m.tipo === pedida && m.ativo) ? pedida : padrao;

      async function simular(m: { peso_g: number; comprimento_cm: number; largura_cm: number; altura_cm: number }) {
        const dims = dimensoesApi(m);
        try {
          const qs = `dimensions=${encodeURIComponent(dims)}&item_price=${preco}&listing_type_id=${tipo}&mode=me2&condition=new&logistic_type=${encodeURIComponent(modalidade || "drop_off")}${categoria ? `&category_id=${encodeURIComponent(categoria)}` : ""}`;
          const f = (await ml(`/users/${mlUser}/shipping_options/free?${qs}`)).dados || {};
          const c = f?.coverage?.all_country || null;
          return {
            ok: Boolean(c),
            dimensoes: dims,
            custo_vendedor: c?.list_cost ?? null,
            moeda: c?.currency_id ?? null,
            peso_considerado_g: c?.billable_weight ?? null,
            peso_cubico_g: pesoCubico(m),
            erro: c ? null : "O Mercado Livre não retornou custo para esta simulação.",
          };
        } catch (e) {
          return { ok: false, dimensoes: dims, erro: (e as Error).message };
        }
      }

      let simulacao: Record<string, unknown> | null = null;
      let limites: Record<string, unknown> | null = null;
      if (medida) {
        if (!(preco > 0)) return responder({ ok: false, erro: "Informe o preço para simular o frete." });
        simulacao = await simular(medida);
        limites = validarLimitesLogistica(medida, modalidade);
      }
      // Comparações (até 3): referência ML, Bling, medida validada/atual.
      const comparacoes: Record<string, unknown>[] = [];
      for (const c of (Array.isArray(corpo?.comparar) ? corpo.comparar : []).slice(0, 3)) {
        const m = lerMedida(c?.medida);
        if (!m || !(preco > 0)) continue;
        comparacoes.push({ rotulo: texto(c?.rotulo).slice(0, 40), medida: m, ...(await simular(m)), limites: validarLimitesLogistica(m, modalidade) });
      }

      // Medidas PRÓPRIAS do SKU (todas as configurações de embalagem) e histórico.
      // Somente do usuário logado. Base compartilhada: aguardando aprovação.
      const config = configEmbalagem(corpo?.config_embalagem);
      let medidasProprias: any[] = [];
      let historico: unknown[] = [];
      let tolerancias: unknown[] = [];
      if (skuN) {
        const { data: meds } = await admin
          .from("logistica_medidas")
          .select("sku, config_embalagem, peso_g, comprimento_cm, largura_cm, altura_cm, nivel_confianca, origem, valor_recomendado, confirmado_em")
          .eq("usuario_id", usuarioId)
          .eq("sku_normalizado", skuN)
          .order("confirmado_em", { ascending: false });
        medidasProprias = meds || [];
        const { data: hist } = await admin
          .from("ml_logistica_historico")
          .select("confirmado_em, usuario_email, ml_user_id, ml_conta_nome, peso_g, comprimento_cm, largura_cm, altura_cm, origem_dados, nivel_confianca, config_embalagem, valor_recomendado, modalidade_logistica, peso_considerado_ml_g, custo_estimado, resultado_validacao")
          .eq("usuario_id", usuarioId)
          .eq("sku_normalizado", skuN)
          .order("confirmado_em", { ascending: false })
          .limit(10);
        historico = hist || [];
      }
      {
        const { data: tol } = await admin.from("logistica_tolerancias").select("escopo, chave, lado_max_dif_cm, peso_max_dif_pct, hipotese").eq("ativo", true);
        tolerancias = tol || [];
      }
      const propria = medidasProprias.find((m) => m.config_embalagem === config) || null;
      const validado = propria;

      // Lote diário da base compartilhada (validade e contribuições novas).
      try {
        const { data: ult } = await admin.from("logistica_parametros").select("valor").eq("chave", "ultimo_recalculo").maybeSingle();
        const hoje = new Date().toISOString().slice(0, 10);
        if (String(ult?.valor || "") < hoje) await admin.rpc("logistica_recalcular_lote");
      } catch (_) { /* a leitura continua mesmo sem o lote */ }

      // Referência COMPARTILHADA (só linhas visíveis: 2+ contribuições consistentes).
      // Sem linha = "sem referência compartilhada" (não revela se existe 0 ou 1).
      let referenciaCompartilhada: unknown = null;
      if (skuN) {
        const { data: ref } = await admin
          .from("logistica_base_compartilhada")
          .select("estagio, peso_g, comprimento_cm, largura_cm, altura_cm, faixa, qtd_validacoes_independentes, qtd_consistentes, niveis_origem, possiveis_configuracoes_distintas, tolerancia_usada, ultima_validacao_mes, produto_generico")
          .eq("sku_normalizado", skuN)
          .eq("config_embalagem", config)
          .maybeSingle();
        referenciaCompartilhada = ref || null;
      }
      const { data: pref } = await admin.from("logistica_preferencias").select("contribuir_anonimamente, consentido_em, revogado_em").eq("usuario_id", usuarioId).maybeSingle();
      const { data: parValidade } = await admin.from("logistica_parametros").select("valor").eq("chave", "validade_meses").maybeSingle();

      return responder({
        ok: true,
        modo: "somente leitura",
        conta: conta?.conta_nome || null,
        modalidade,
        modalidades,
        modalidades_erro: prefErro,
        categoria_id: categoria || null,
        categoria_referencia: categoriaRef,
        categoria_logisticas_me2: categoriaLogisticas,
        categoria_restrita: categoriaRestrita,
        medida,
        simulacao,
        limites,
        comparacoes,
        config_embalagem: config,
        propria,
        validado,
        medidas_proprias: medidasProprias,
        referencia_compartilhada: referenciaCompartilhada,
        padrao_paiia: { disponivel: false, motivo: "PADRÃO PAIIA bloqueado até regra aprovada com dados reais." },
        consentimento: { contribuir_anonimamente: Boolean(pref?.contribuir_anonimamente), consentido_em: pref?.consentido_em || null, revogado_em: pref?.revogado_em || null, versao_texto: VERSAO_TEXTO_CONSENTIMENTO },
        validade_meses: Number(parValidade?.valor) || 18,
        tolerancias,
        historico,
        divisor_cubico: DIVISOR_CUBICO,
        fonte_limites: "Central de Ajuda do Mercado Livre — artigo 3163 (consultado em 30/09/2026)",
      });
    }

    // ---------- LOGÍSTICA: confirmação do usuário (grava SÓ no PAIIA) ----------
    // Registra a medida (VALIDADO ou INFORMADO_PELO_USUARIO) e uma linha de
    // histórico. Não envia nada ao Mercado Livre nem ao Bling.
    if (acao === "confirmar_logistica") {
      if (corpo?.confirmado !== true || texto(corpo?.confirmacao) !== "MEDIDA") {
        return responder({ ok: false, erro: "Confirmação de peso e medidas não recebida." });
      }
      const sku = texto(corpo?.sku);
      const skuN = normalizarSku(sku);
      if (skuN.length < 3) return responder({ ok: false, erro: "SKU inválido." });
      const pedido = normalizarNivel(corpo?.nivel || corpo?.origem);
      if (pedido === "MEDIDO_E_VALIDADO") {
        return responder({ ok: false, erro: "MEDIDO E VALIDADO exige o processo de validação do PAIIA, que ainda não existe. A sua confirmação é registrada como CONFIRMADO PELO USUÁRIO." });
      }
      if (pedido !== "CONFIRMADO_PELO_USUARIO") {
        return responder({ ok: false, erro: "Só a medida CONFIRMADA PELO USUÁRIO pode ser registrada aqui. Referência do marketplace, PADRÃO PAIIA e Bling servem apenas para comparação." });
      }
      const nivel = "CONFIRMADO_PELO_USUARIO";
      const config = configEmbalagem(corpo?.config_embalagem);
      const m = lerMedida(corpo?.medida);
      if (!m) return responder({ ok: false, erro: "Informe peso, comprimento, largura e altura (valores maiores que zero)." });
      const modalidade = texto(corpo?.modalidade);
      const lim = validarLimitesLogistica(m, modalidade);
      const sim = corpo?.simulacao || {};
      const email = texto(dadosUsuario?.user?.email) || null;

      // Medida própria do SKU + configuração (privada). Nunca sobrescreve uma
      // MEDIDO_E_VALIDADO; o valor anterior fica guardado como "recomendado".
      const { data: atual } = await admin
        .from("logistica_medidas")
        .select("id, peso_g, comprimento_cm, largura_cm, altura_cm, nivel_confianca")
        .eq("usuario_id", usuarioId)
        .eq("sku_normalizado", skuN)
        .eq("config_embalagem", config)
        .maybeSingle();
      const mudou = atual && ["peso_g", "comprimento_cm", "largura_cm", "altura_cm"].some((k) => Number((atual as any)[k]) !== (m as any)[k]);
      const recomendado = mudou ? { peso_g: Number(atual.peso_g), comprimento_cm: Number(atual.comprimento_cm), largura_cm: Number(atual.largura_cm), altura_cm: Number(atual.altura_cm), nivel: atual.nivel_confianca } : null;
      let medidaGravada = false;
      let motivo: string | null = null;
      if (atual?.nivel_confianca === "MEDIDO_E_VALIDADO" && mudou) {
        motivo = "Existe medida MEDIDO E VALIDADO para este SKU e embalagem; a sua medida ficou só no histórico.";
      } else {
        const agora = new Date().toISOString();
        const linha = {
          usuario_id: usuarioId,
          sku: sku.slice(0, 60),
          sku_normalizado: skuN,
          config_embalagem: config,
          peso_g: m.peso_g,
          comprimento_cm: m.comprimento_cm,
          largura_cm: m.largura_cm,
          altura_cm: m.altura_cm,
          nivel_confianca: atual?.nivel_confianca === "MEDIDO_E_VALIDADO" ? "MEDIDO_E_VALIDADO" : nivel,
          origem: "revisao_ml",
          ...(recomendado ? { valor_recomendado: recomendado } : {}),
          confirmado_em: agora,
          updated_at: agora,
        };
        const { error } = atual?.id
          ? await admin.from("logistica_medidas").update(linha).eq("id", atual.id)
          : await admin.from("logistica_medidas").insert(linha);
        if (error) return responder({ ok: false, erro: `Não foi possível gravar a medida: ${error.message}` });
        medidaGravada = true;
      }

      const contaHist: any = await lerConta().catch(() => null);
      const { data: hist, error: erroHist } = await admin
        .from("ml_logistica_historico")
        .insert({
          usuario_id: usuarioId,
          usuario_email: email,
          ml_user_id: contaHist?.ml_user_id ? String(contaHist.ml_user_id) : null,
          ml_conta_nome: contaHist?.conta_nome || null,
          sku: sku.slice(0, 60),
          sku_normalizado: skuN,
          peso_g: m.peso_g,
          comprimento_cm: m.comprimento_cm,
          largura_cm: m.largura_cm,
          altura_cm: m.altura_cm,
          origem_dados: "INFORMADO_PELO_USUARIO",
          nivel_confianca: nivel,
          config_embalagem: config,
          valor_recomendado: recomendado,
          origem_recomendado: recomendado ? "medida_propria_anterior" : null,
          categoria_id: texto(corpo?.categoria_id) || null,
          modalidade_logistica: modalidade || null,
          peso_cubico_g: pesoCubico(m),
          peso_considerado_ml_g: Number(sim?.peso_considerado_g) || null,
          custo_estimado: Number.isFinite(Number(sim?.custo_vendedor)) ? Number(sim.custo_vendedor) : null,
          preco_simulado: precoNumero(corpo?.preco) || null,
          tipo_anuncio: texto(corpo?.tipoAnuncio) || null,
          resultado_validacao: lim.resultado,
          excedidos: lim.excedidos,
          comparacao: corpo?.comparacao && typeof corpo.comparacao === "object" ? corpo.comparacao : {},
          observacao: motivo,
        })
        .select("id, confirmado_em")
        .single();
      if (erroHist) return responder({ ok: false, erro: `Medida ${medidaGravada ? "gravada" : "não gravada"}, mas o histórico falhou: ${erroHist.message}` });

      // Contribuição ANÔNIMA para a base compartilhada: só com consentimento,
      // medida gravada, simulação oficial OK e dentro dos limites da modalidade.
      let contribuicao = "nao_consentida";
      try {
        const { data: pref } = await admin.from("logistica_preferencias").select("contribuir_anonimamente").eq("usuario_id", usuarioId).maybeSingle();
        if (pref?.contribuir_anonimamente) {
          const segredo = lerSecret("LOGISTICA_HMAC_SEGREDO");
          // Confere de novo no servidor (não confia só no que veio da tela).
          let simOk = false;
          try {
            const contaSim = await lerConta();
            const precoSim = precoNumero(corpo?.preco);
            const tipoSim = texto(corpo?.tipoAnuncio).toLowerCase() === "premium" ? "gold_pro" : "gold_special";
            const catSim = texto(corpo?.categoria_id);
            if (precoSim > 0) {
              const qs = `dimensions=${encodeURIComponent(dimensoesApi(m))}&item_price=${precoSim}&listing_type_id=${tipoSim}&mode=me2&condition=new&logistic_type=${encodeURIComponent(modalidade || "drop_off")}${/^MLB\d+$/.test(catSim) ? `&category_id=${catSim}` : ""}`;
              const f = (await ml(`/users/${encodeURIComponent(String(contaSim?.ml_user_id || ""))}/shipping_options/free?${qs}`)).dados || {};
              simOk = Number(f?.coverage?.all_country?.billable_weight) > 0;
            }
          } catch (_) { simOk = false; }
          if (!medidaGravada || !simOk || lim.dentro === false) contribuicao = "nao_elegivel";
          else if (segredo.length < 32) contribuicao = "indisponivel";
          else {
            // produto genérico: só pelo domínio oficial da categoria → lista fechada do PAIIA
            let generico: string | null = null;
            const cat = texto(corpo?.categoria_id);
            if (/^MLB\d+$/.test(cat)) {
              try {
                const dom = texto(((await ml(`/categories/${cat}`)).dados || {})?.settings?.catalog_domain);
                if (dom) {
                  const { data: g } = await admin.from("logistica_produtos_genericos").select("codigo").eq("dominio_ou_categoria", dom).maybeSingle();
                  generico = g?.codigo || null;
                }
              } catch (_) { generico = null; }
            }
            const agora = new Date();
            const mes = `${agora.getUTCFullYear()}-${String(agora.getUTCMonth() + 1).padStart(2, "0")}-01`;
            const idAnonimo = await hmacContribuinte(segredo, usuarioId, skuN, config);
            const meia = (v: number) => Math.round(v * 2) / 2;
            const { error: erroC } = await admin.from("logistica_contribuicoes").upsert({
              sku_normalizado: skuN,
              config_embalagem: config,
              contribuinte_hash: idAnonimo,
              versao_hash: "v1",
              nivel_origem: nivel,
              peso_g: Math.round(m.peso_g),
              comprimento_cm: meia(m.comprimento_cm),
              largura_cm: meia(m.largura_cm),
              altura_cm: meia(m.altura_cm),
              mes_validacao: mes,
              mes_recebimento: mes,
              produto_generico: generico,
            }, { onConflict: "sku_normalizado,config_embalagem,contribuinte_hash" });
            if (!erroC) {
              await admin.from("logistica_recalculo_pendente").upsert({ sku_normalizado: skuN, config_embalagem: config }, { onConflict: "sku_normalizado,config_embalagem" });
              contribuicao = "registrada";
            } else contribuicao = "falhou";
          }
        }
      } catch (_) { contribuicao = "falhou"; }

      return responder({ ok: true, medida_gravada: medidaGravada, motivo, nivel, config_embalagem: config, recomendado, historico_id: hist?.id, confirmado_em: hist?.confirmado_em, confirmado_por: email, resultado_validacao: lim.resultado, excedidos: lim.excedidos, contribuicao });
    }

    // ---------- BASE COMPARTILHADA: consentimento (opcional, desligado por padrão) ----------
    if (acao === "logistica_consentimento") {
      if (corpo?.confirmado !== true || texto(corpo?.confirmacao) !== "CONSENTIMENTO" || typeof corpo?.ativar !== "boolean") {
        return responder({ ok: false, erro: "Escolha do consentimento não confirmada." });
      }
      const ativar = corpo.ativar === true;
      const agora = new Date().toISOString();
      const { error } = await admin.from("logistica_preferencias").upsert({
        usuario_id: usuarioId,
        contribuir_anonimamente: ativar,
        versao_texto_consentimento: VERSAO_TEXTO_CONSENTIMENTO,
        ...(ativar ? { consentido_em: agora, revogado_em: null } : { revogado_em: agora }),
        atualizado_em: agora,
      }, { onConflict: "usuario_id" });
      if (error) return responder({ ok: false, erro: `Não foi possível gravar a escolha: ${error.message}` });
      await admin.from("logistica_consentimento_log").insert({ usuario_id: usuarioId, acao: ativar ? "ATIVOU" : "DESATIVOU", versao_texto_consentimento: VERSAO_TEXTO_CONSENTIMENTO });
      return responder({ ok: true, contribuir_anonimamente: ativar, versao_texto: VERSAO_TEXTO_CONSENTIMENTO });
    }

    // ---------- BASE COMPARTILHADA: retirada das contribuições do usuário ----------
    // Recalcula o identificador anônimo de cada medida própria (SKU + configuração),
    // apaga as contribuições correspondentes e recalcula a base na hora.
    if (acao === "retirar_contribuicoes") {
      if (corpo?.confirmado !== true || texto(corpo?.confirmacao) !== "RETIRAR") {
        return responder({ ok: false, erro: "Retirada não confirmada." });
      }
      const segredo = lerSecret("LOGISTICA_HMAC_SEGREDO");
      if (segredo.length < 32) return responder({ ok: false, erro: "Base compartilhada indisponível no servidor." });
      const { data: meds } = await admin.from("logistica_medidas").select("sku_normalizado, config_embalagem").eq("usuario_id", usuarioId);
      let retiradas = 0;
      for (const md of meds || []) {
        const idAnonimo = await hmacContribuinte(segredo, usuarioId, md.sku_normalizado, md.config_embalagem);
        const { data: apagadas } = await admin
          .from("logistica_contribuicoes")
          .delete()
          .eq("sku_normalizado", md.sku_normalizado)
          .eq("config_embalagem", md.config_embalagem)
          .eq("contribuinte_hash", idAnonimo)
          .select("id");
        if (apagadas?.length) {
          retiradas += apagadas.length;
          await admin.rpc("logistica_recalcular", { p_sku: md.sku_normalizado, p_config: md.config_embalagem });
        }
      }
      await admin.from("logistica_consentimento_log").insert({ usuario_id: usuarioId, acao: "RETIROU_CONTRIBUICOES", versao_texto_consentimento: VERSAO_TEXTO_CONSENTIMENTO, qtd_contribuicoes_retiradas: retiradas });
      return responder({ ok: true, retiradas });
    }

    // ---------- EVIDÊNCIA DE CATEGORIA: anúncios reais do MESMO código ----------
    // Somente leitura (GET /sites/MLB/search?q=<código>). Conta quantos
    // anúncios/vendedores usam cada categoria. É EVIDÊNCIA, nunca prova: o
    // site nunca escolhe categoria por isto. Se o ML recusar a busca, devolve
    // estado "indisponivel" (sem inventar nada).
    if (acao === "evidencia_codigo") {
      const codigo = texto(corpo?.codigo);
      if (!/^[A-Za-z0-9][A-Za-z0-9.\-_/ ]{2,40}$/.test(codigo)) return responder({ ok: false, estado: "indisponivel", erro: "Código inválido para a busca." });
      try {
        const porCategoria: Record<string, { anuncios: number; vendedores: number; _v: Set<string> }> = {};
        let total = 0;
        for (let offset = 0; offset < 150; offset += 50) {
          const r = (await ml(`/sites/MLB/search?q=${encodeURIComponent(codigo)}&limit=50&offset=${offset}`)).dados || {};
          const lista = Array.isArray(r?.results) ? r.results : [];
          for (const it of lista) {
            const cat = texto(it?.category_id);
            if (!/^MLB\d+$/.test(cat)) continue;
            const c = (porCategoria[cat] = porCategoria[cat] || { anuncios: 0, vendedores: 0, _v: new Set() });
            c.anuncios += 1;
            c._v.add(texto(it?.seller?.id || it?.seller_id));
            total += 1;
          }
          if (lista.length < 50) break;
        }
        const saida: Record<string, { anuncios: number; vendedores: number }> = {};
        for (const [k, v] of Object.entries(porCategoria)) saida[k] = { anuncios: v.anuncios, vendedores: v._v.size };
        return responder({ ok: true, estado: total ? "ok" : "sem_resultado", total, porCategoria: saida, lido_em: new Date().toISOString() });
      } catch (e) {
        return responder({ ok: true, estado: "indisponivel", total: 0, porCategoria: {}, motivo: `O Mercado Livre não liberou a busca (${(e as Error).message}).` });
      }
    }

    // ---------- CONSULTAS DE CATÁLOGO (somente leitura, lista fechada) ----------
    // GET em categorias/catálogo/anúncio da própria conta e as buscas (POST)
    // de catálogo de veículos, que não gravam nada.
    if (acao === "ml_consulta") {
      const metodo = texto(corpo?.metodo || "GET").toUpperCase();
      const caminho = texto(corpo?.caminho);
      const getOk = /^\/(categories\/MLB\d+(\/attributes|\/technical_specs\/(input|output)|\/shipping_preferences|\/shipping)?|users\/\d+\/(shipping_preferences|shipping_modes|shipping_options\/free|items\/search)|sites\/MLB\/listing_prices|items\/MLB\d+\/(shipping_options|shipping_options\/free|performance|health|sale_price|prices)|seller-promotions\/items\/MLB\d+|item\/MLB\d+\/performance|sites\/MLB\/(shipping_methods|shipping_services|listing_types)|catalog_domains\/MLB-[A-Z_]+\/attributes(\/[A-Z_]+)?(\/values)?|items\/MLB\d+(\/compatibilities|\/description)?|user-products\/MLBU\d+(\/compatibilities)?|catalog_compatibilities\/[\w\/-]+|catalog_domains\/MLB-[A-Z_]+[\w\/-]*)(\?[\w=&%.,\-\[\]]*)?$/.test(caminho);
      const postOk = /^\/(categories\/MLB\d+\/attributes\/conditional|catalog_compatibilities\/products_search\/chunks|catalog_domains\/MLB-[A-Z_]+\/attributes\/[A-Z_]+\/top_values|catalog_compatibilities\/[\w\/-]*search[\w\/-]*)(\?[\w=&%.,\-]*)?$/.test(caminho);
      if (!((metodo === "GET" && getOk) || (metodo === "POST" && postOk))) {
        return responder({ ok: false, erro: "Consulta fora da lista permitida (somente leitura)." });
      }
      const idNoCaminho = (caminho.match(/^\/users\/(\d+)\//) || [])[1];
      if (idNoCaminho) {
        const contaConsulta = await lerConta();
        if (String(contaConsulta?.ml_user_id || "") !== idNoCaminho) {
          return responder({ ok: false, codigo: "conta_divergente", erro: "A consulta é de outra conta Mercado Livre, diferente da conta selecionada. Bloqueado." });
        }
      }
      try {
        const r = await ml(caminho, metodo === "POST" ? { method: "POST", body: corpo?.corpo ?? {} } : {});
        return responder({ ok: true, status: r.status, dados: r.dados });
      } catch (e) {
        const err = e as ErroML;
        return responder({ ok: false, status: err.status, erro: err.message, detalhe: err.bruto || null });
      }
    }

    // ---------- GRAVAR COMPATIBILIDADES (só com confirmação explícita) ----------
    if (acao === "gravar_compatibilidades") {
      const id = texto(corpo?.item_id).toUpperCase();
      if (!/^MLB\d{6,}$/.test(id)) return responder({ ok: false, erro: "item_id inválido." });
      if (corpo?.confirmado !== true || texto(corpo?.confirmacao) !== "COMPATIBILIDADES") {
        return responder({ ok: false, erro: "Gravação não confirmada pelo usuário." });
      }
      const it = (await ml(`/items/${id}`)).dados || {};
      if (String(it?.seller_id || "") !== String((await lerConta())?.ml_user_id || "")) {
        return responder({ ok: false, erro: "O anúncio não pertence à conta conectada." });
      }
      const produtos = (Array.isArray(corpo?.produtos) ? corpo.produtos : [])
        .map((p: any) => ({ id: texto(p?.id), ...(texto(p?.note) ? { note: texto(p.note).slice(0, 500) } : {}) }))
        .filter((p: any) => /^MLB\d+$/.test(p.id));
      if (!produtos.length) return responder({ ok: false, erro: "Nenhum veículo informado." });
      const resultados: unknown[] = [];
      // Anúncios do modelo "produtos do vendedor" guardam a compatibilidade no
      // user product (MLBU...), não no item.
      const up = texto(it?.user_product_id);
      const destino = /^MLBU\d+$/.test(up) ? `/user-products/${up}/compatibilities` : `/items/${id}/compatibilities`;
      for (let i = 0; i < produtos.length; i += 100) {
        try {
          // domain_id/category_id exigidos pelo recurso de user product.
          const extra: Record<string, unknown> = {};
          if (destino.startsWith("/user-products/")) {
            extra.domain_id = texto(corpo?.domain_id) || "MLB-CARS_AND_VANS";
            extra.category_id = texto(it?.category_id);
          }
          const r = await ml(destino, { method: "POST", body: { ...extra, products: produtos.slice(i, i + 100) } });
          resultados.push({ ok: true, status: r.status, dados: r.dados });
        } catch (e) {
          const err = e as ErroML;
          resultados.push({ ok: false, status: err.status, erro: err.message, detalhe: err.bruto || null });
        }
      }
      return responder({ ok: resultados.every((r: any) => r.ok), destino, enviados: produtos.length, resultados });
    }

    // ---------- REMOVER UMA COMPATIBILIDADE (só com confirmação explícita) ----------
    if (acao === "remover_compatibilidade") {
      const id = texto(corpo?.item_id).toUpperCase();
      const catalogo = texto(corpo?.catalog_product_id).toUpperCase();
      if (!/^MLB\d{6,}$/.test(id) || !/^MLB\d+$/.test(catalogo)) return responder({ ok: false, erro: "Parâmetros inválidos." });
      if (corpo?.confirmado !== true || texto(corpo?.confirmacao) !== "REMOVER_COMPATIBILIDADE") {
        return responder({ ok: false, erro: "Remoção não confirmada pelo usuário." });
      }
      const it = (await ml(`/items/${id}`)).dados || {};
      if (String(it?.seller_id || "") !== String((await lerConta())?.ml_user_id || "")) {
        return responder({ ok: false, erro: "O anúncio não pertence à conta conectada." });
      }
      const lista = ((await ml(`/items/${id}/compatibilities`)).dados?.products || []) as any[];
      const alvo = lista.find((p) => String(p?.catalog_product_id) === catalogo);
      if (!alvo) return responder({ ok: false, erro: "Compatibilidade não encontrada no anúncio." });
      const up = texto(it?.user_product_id);
      const tentativas = [
        ...(/^MLBU\d+$/.test(up) ? [`/user-products/${up}/compatibilities/${alvo.id}`] : []),
        `/items/${id}/compatibilities/${alvo.id}`,
      ];
      const erros: unknown[] = [];
      for (const caminho of tentativas) {
        try {
          const r = await ml(caminho, { method: "DELETE" });
          return responder({ ok: true, caminho, status: r.status, removido: { id: alvo.id, catalog_product_id: catalogo, nome: alvo.catalog_product_name } });
        } catch (e) {
          const err = e as ErroML;
          erros.push({ caminho, status: err.status, erro: err.message, detalhe: err.bruto || null });
        }
      }
      return responder({ ok: false, erro: "O Mercado Livre não aceitou a remoção.", erros });
    }

    // ---------- GRAVAR ATRIBUTOS DA FICHA (só com confirmação explícita) ----------
    // Aceita somente atributos que NÃO sejam título/marca/SKU/part number/GTIN.
    if (acao === "gravar_atributos") {
      const id = texto(corpo?.item_id).toUpperCase();
      if (!/^MLB\d{6,}$/.test(id)) return responder({ ok: false, erro: "item_id inválido." });
      if (corpo?.confirmado !== true || texto(corpo?.confirmacao) !== "FICHA") {
        return responder({ ok: false, erro: "Gravação não confirmada pelo usuário." });
      }
      const proibidos = new Set(["BRAND", "SELLER_SKU", "PART_NUMBER", "GTIN", "EMPTY_GTIN_REASON", "ITEM_CONDITION"]);
      const attrs = (Array.isArray(corpo?.atributos) ? corpo.atributos : [])
        .map((a: any) => ({ id: texto(a?.id).toUpperCase(), ...(texto(a?.value_id) ? { value_id: texto(a.value_id) } : { value_name: texto(a?.value_name).slice(0, 255) }) }))
        .filter((a: any) => /^[A-Z0-9_]{2,60}$/.test(a.id) && !proibidos.has(a.id));
      if (!attrs.length) return responder({ ok: false, erro: "Nenhum atributo permitido informado." });
      const it = (await ml(`/items/${id}`)).dados || {};
      if (String(it?.seller_id || "") !== String((await lerConta())?.ml_user_id || "")) {
        return responder({ ok: false, erro: "O anúncio não pertence à conta conectada." });
      }
      try {
        const r = await ml(`/items/${id}`, { method: "PUT", body: { attributes: attrs } });
        return responder({ ok: true, via: "items", status: r.status, enviados: attrs });
      } catch (e) {
        const err = e as ErroML;
        return responder({ ok: false, via: "items", status: err.status, erro: err.message, detalhe: err.bruto || null, enviados: attrs });
      }
    }

    // ---------- CORREÇÕES NO MESMO MLB (só com confirmação explícita) ----------
    // Reutilizáveis para qualquer anúncio da conta. Nunca criam anúncio:
    // 1) confere que o MLB pertence à conta informada; 2) lê o item antes;
    // 3) altera SÓ o campo pedido; 4) relê depois; 5) confirma; 6) devolve
    // antes/depois (com os campos principais, para provar que nada mais mudou).
    async function lerItemDaConta(id: string) {
      const conta = await lerConta();
      const contaPedida = String(corpo?.conta_ml ?? "").replace(/\D/g, "");
      if (!contaPedida || String(conta?.ml_user_id || "") !== contaPedida) {
        return { erro: "Conta Mercado Livre não informada ou diferente da conta selecionada." };
      }
      const it = (await ml(`/items/${id}`)).dados || {};
      if (String(it?.seller_id || "") !== contaPedida) return { erro: "O anúncio não pertence à conta informada." };
      return { it };
    }
    const resumoItem = (it: any) => ({
      id: it?.id, status: it?.status, preco: it?.price, quantidade: it?.available_quantity, tipo: it?.listing_type_id,
      titulo: it?.title, family_name: it?.family_name ?? null, fotos: (it?.pictures || []).length,
      sku: (it?.attributes || []).find((a: any) => a?.id === "SELLER_SKU")?.value_name ?? it?.seller_custom_field ?? null,
      marca: (it?.attributes || []).find((a: any) => a?.id === "BRAND")?.value_name ?? null,
      tipo_veiculo: (it?.attributes || []).find((a: any) => a?.id === "VEHICLE_TYPE")?.value_name ?? null,
      atualizado_em: it?.last_updated,
    });
    async function corrigirAtributoUnico(atributo: "SELLER_SKU" | "BRAND", valor: string, igual: (a: string, b: string) => boolean) {
      const id = texto(corpo?.item_id).toUpperCase();
      if (!/^MLB\d{6,}$/.test(id)) return responder({ ok: false, erro: "item_id inválido." });
      const lido = await lerItemDaConta(id);
      if (lido.erro) return responder({ ok: false, erro: lido.erro });
      const antes = resumoItem(lido.it);
      const atualAntes = String(atributo === "SELLER_SKU" ? antes.sku ?? "" : antes.marca ?? "");
      if (atualAntes && igual(atualAntes, valor)) {
        return responder({ ok: true, alterado: false, motivo: "O anúncio já está com esse valor.", antes, depois: antes });
      }
      try {
        await ml(`/items/${id}`, { method: "PUT", body: { attributes: [{ id: atributo, value_name: valor }] } });
      } catch (e) {
        const err = e as ErroML;
        return responder({ ok: false, erro: err.message, status: err.status, detalhe: err.bruto || null, antes });
      }
      let depoisIt: any = null;
      for (let t = 0; t < 3; t++) {
        if (t) await esperar(2000);
        depoisIt = (await ml(`/items/${id}`)).dados || null;
        const v = String((depoisIt?.attributes || []).find((a: any) => a?.id === atributo)?.value_name ?? (atributo === "SELLER_SKU" ? depoisIt?.seller_custom_field ?? "" : ""));
        if (v && igual(v, valor)) break;
      }
      const depois = resumoItem(depoisIt);
      const recebido = String(atributo === "SELLER_SKU" ? depois.sku ?? "" : depois.marca ?? "");
      return responder({ ok: Boolean(recebido) && igual(recebido, valor), alterado: true, campo: atributo, enviado: valor, recebido, antes, depois });
    }

    if (acao === "corrigir_sku_item") {
      if (corpo?.confirmado !== true || texto(corpo?.confirmacao) !== "CORRIGIR_SKU") {
        return responder({ ok: false, erro: "Correção de SKU não confirmada pelo usuário." });
      }
      const sku = skuOficial(corpo?.sku);
      if (!skuValido(sku)) return responder({ ok: false, erro: `SKU inválido: "${texto(corpo?.sku)}".` });
      return await corrigirAtributoUnico("SELLER_SKU", sku, (a, b) => normalizarSku(a) === normalizarSku(b));
    }

    if (acao === "corrigir_marca_item") {
      if (corpo?.confirmado !== true || texto(corpo?.confirmacao) !== "CORRIGIR_MARCA") {
        return responder({ ok: false, erro: "Correção de marca não confirmada pelo usuário." });
      }
      const marca = texto(corpo?.marca).replace(/\s+/g, " ").slice(0, 60);
      if (!marca || marcaInvalida(marca)) return responder({ ok: false, erro: `Marca inválida: "${marca}". Use a marca real aprovada.` });
      return await corrigirAtributoUnico("BRAND", marca, (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase());
    }

    if (acao === "corrigir_descricao_item") {
      if (corpo?.confirmado !== true || texto(corpo?.confirmacao) !== "CORRIGIR_DESCRICAO") {
        return responder({ ok: false, erro: "Correção de descrição não confirmada pelo usuário." });
      }
      const id = texto(corpo?.item_id).toUpperCase();
      if (!/^MLB\d{6,}$/.test(id)) return responder({ ok: false, erro: "item_id inválido." });
      const nova = String(corpo?.descricao ?? "").replace(/\r\n/g, "\n").trim().slice(0, 50000);
      if (nova.length < 30) return responder({ ok: false, erro: "Descrição nova vazia ou curta demais." });
      const lido = await lerItemDaConta(id);
      if (lido.erro) return responder({ ok: false, erro: lido.erro });
      let antes = "";
      try { antes = texto((await ml(`/items/${id}/description`)).dados?.plain_text); } catch (_) { antes = ""; }
      try {
        // PUT na descrição existente (POST só quando o anúncio ainda não tem).
        await ml(`/items/${id}/description${antes ? "?api_version=2" : ""}`, { method: antes ? "PUT" : "POST", body: { plain_text: nova } });
      } catch (e) {
        const err = e as ErroML;
        return responder({ ok: false, erro: err.message, status: err.status, detalhe: err.bruto || null, antes });
      }
      let depois = "";
      for (let t = 0; t < 3; t++) {
        if (t) await esperar(2000);
        try { depois = texto((await ml(`/items/${id}/description`)).dados?.plain_text); } catch (_) { depois = ""; }
        if (depois.replace(/\s+/g, " ") === nova.replace(/\s+/g, " ")) break;
      }
      return responder({ ok: depois.replace(/\s+/g, " ") === nova.replace(/\s+/g, " "), antes, depois, item: resumoItem(lido.it) });
    }

    // ---------- PAUSAR ANÚNCIO (só com confirmação explícita) ----------
    // Única alteração permitida aqui: status -> paused. Não mexe em mais nada.
    if (acao === "pausar_item") {
      const id = texto(corpo?.item_id).toUpperCase();
      if (!/^MLB\d{6,}$/.test(id)) return responder({ ok: false, erro: "item_id inválido." });
      if (corpo?.confirmado !== true || texto(corpo?.confirmacao) !== "PAUSAR") {
        return responder({ ok: false, erro: "Pausa não confirmada pelo usuário." });
      }
      const antes = (await ml(`/items/${id}`)).dados || {};
      if (String(antes?.seller_id || "") !== String((await lerConta())?.ml_user_id || "")) {
        return responder({ ok: false, erro: "O anúncio não pertence à conta conectada." });
      }
      if (antes?.status === "paused") return responder({ ok: true, ja_estava_pausado: true, status: "paused" });
      await ml(`/items/${id}`, { method: "PUT", body: { status: "paused" } });
      const depois = (await ml(`/items/${id}`)).dados || {};
      return responder({ ok: true, status_antes: antes?.status, status: depois?.status, sub_status: depois?.sub_status || [] });
    }

    // ---------- MARCAS USADAS NA CONTA (somente leitura) ----------
    if (acao === "marcas_da_conta") {
      const conta = await lerConta();
      const uid = encodeURIComponent(String(conta?.ml_user_id || ""));
      const ids: string[] = [];
      for (let offset = 0; offset < 400; offset += 50) {
        const r = (await ml(`/users/${uid}/items/search?limit=50&offset=${offset}`)).dados || {};
        const lote = Array.isArray(r?.results) ? r.results : [];
        ids.push(...lote);
        if (lote.length < 50) break;
      }
      const contagem: Record<string, number> = {};
      const exemplos: Record<string, string[]> = {};
      const itens: Record<string, unknown>[] = [];
      for (let i = 0; i < ids.length; i += 20) {
        const lote = ids.slice(i, i + 20).join(",");
        const r = (await ml(`/items?ids=${lote}&attributes=id,title,status,attributes,date_created`)).dados || [];
        for (const x of Array.isArray(r) ? r : []) {
          const b = x?.body || {};
          const marca = (b?.attributes || []).find((a: any) => a?.id === "BRAND")?.value_name || "(sem marca)";
          contagem[marca] = (contagem[marca] || 0) + 1;
          (exemplos[marca] = exemplos[marca] || []).length < 3 && exemplos[marca].push(`${b?.id} ${String(b?.title || "").slice(0, 50)} [${b?.status}]`);
          itens.push({ id: b?.id, marca, status: b?.status, criado: b?.date_created });
        }
      }
      // Regras do atributo Marca na categoria de sonda
      let regraMarca: unknown = null;
      try {
        const attrs = (await ml(`/categories/${encodeURIComponent(texto(corpo?.categoria_id) || "MLB192358")}/attributes`)).dados || [];
        const b = (Array.isArray(attrs) ? attrs : []).find((a: any) => a?.id === "BRAND");
        regraMarca = b ? { tags: b.tags, value_type: b.value_type, hierarchy: b.hierarchy, relevance: b.relevance } : null;
      } catch (_) { regraMarca = null; }
      return responder({ ok: true, modo: "somente leitura", total_anuncios: ids.length, contagem, exemplos, regra_marca: regraMarca });
    }

    // ---------- CONSULTA DE ANÚNCIO (somente leitura) ----------
    if (acao === "consultar_item") {
      const id = texto(corpo?.item_id).toUpperCase();
      if (!/^MLB\d{6,}$/.test(id)) return responder({ ok: false, erro: "item_id inválido." });
      const it = (await ml(`/items/${id}?include_attributes=all`)).dados || {};
      let desc = "";
      try { desc = texto((await ml(`/items/${id}/description`)).dados?.plain_text); } catch (_) { desc = ""; }
      const attr = (k: string) => (it?.attributes || []).find((a: any) => a?.id === k)?.value_name ?? null;
      return responder({
        ok: true,
        id: it?.id, titulo: it?.title, family_name: it?.family_name ?? null, status: it?.status, sub_status: it?.sub_status || [],
        preco: it?.price, moeda: it?.currency_id, estoque: it?.available_quantity, vendidos: it?.sold_quantity,
        tipo: it?.listing_type_id, categoria: it?.category_id, condicao: it?.condition,
        seller_id: it?.seller_id, sku_atributo: attr("SELLER_SKU"), seller_custom_field: it?.seller_custom_field ?? null,
        marca: attr("BRAND"), part_number: attr("PART_NUMBER"), tipo_veiculo: attr("VEHICLE_TYPE"),
        fotos: (it?.pictures || []).length, frete: { modo: it?.shipping?.mode, gratis: it?.shipping?.free_shipping, logistica: it?.shipping?.logistic_type },
        link: it?.permalink, criado_em: it?.date_created, atualizado_em: it?.last_updated,
        user_product_id: it?.user_product_id ?? null, avisos: it?.warnings || [], tags: it?.tags || [],
        descricao: desc,
      });
    }

    // ---------- SIMULAÇÃO DE TARIFAS (somente leitura, não cria nada) ----------
    if (acao === "simular_tarifas") {
      const categoria = texto(corpo?.categoria_id) || "MLB192358";
      const precos: number[] = (Array.isArray(corpo?.precos) ? corpo.precos : []).map(Number).filter((n: number) => n > 0).slice(0, 8);
      const dim = texto(corpo?.dimensoes); // ex.: "15x20x32,500" (cm, gramas)
      const conta = await lerConta();
      const resultado: Record<string, unknown>[] = [];
      for (const preco of precos) {
        const linha: Record<string, unknown> = { preco };
        try {
          const lp = (await ml(`/sites/MLB/listing_prices?price=${preco}&category_id=${encodeURIComponent(categoria)}`)).dados || [];
          linha.tarifas = (Array.isArray(lp) ? lp : [])
            .filter((x: any) => ["gold_special", "gold_pro"].includes(x?.listing_type_id))
            .map((x: any) => ({
              tipo: x.listing_type_id,
              nome: x.listing_type_name,
              tarifa_total: x.sale_fee_amount,
              percentual: x?.sale_fee_details?.percentage_fee ?? null,
              fixa: x?.sale_fee_details?.fixed_fee ?? null,
            }));
        } catch (e) { linha.tarifas_erro = (e as Error).message; }
        if (dim) {
          for (const tipo of ["gold_special", "gold_pro"]) {
            try {
              const f = (await ml(`/users/${encodeURIComponent(String(conta?.ml_user_id || ""))}/shipping_options/free?dimensions=${encodeURIComponent(dim)}&item_price=${preco}&listing_type_id=${tipo}&mode=me2&condition=new&logistic_type=drop_off&verbose=true`)).dados || {};
              linha[`frete_${tipo}`] = {
                custo_vendedor: f?.coverage?.all_country?.list_cost ?? null,
                moeda: f?.coverage?.all_country?.currency_id ?? null,
                gratis_obrigatorio: f?.coverage?.all_country ? true : null,
                bruto: JSON.stringify(f).slice(0, 300),
              };
            } catch (e) { linha[`frete_${tipo}`] = { erro: (e as Error).message }; }
          }
        }
        resultado.push(linha);
      }
      return responder({ ok: true, modo: "somente leitura", conta: conta?.conta_nome, categoria, resultado });
    }

    return responder({ ok: false, erro: "Ação desconhecida." });
  } catch (erro) {
    const e = erro as ErroML;
    return responder({ ok: false, erro: e?.message || String(erro), codigo: e?.codigo || undefined, causas: e?.causas || undefined });
  }
});
