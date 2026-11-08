// =============================================================
// PAIIA — (08/11) Conferências pós-publicação: leitura/gravação na ficha + consultas reais.
// Lógica pura em posPublicacao.js. Consultas SÓ LEITURA:
//   • Mercado Livre: mercadolivre-publicacao / consultar_item (mesma do piloto);
//   • Bling: bling-integracao / leitura do vínculo (mesma da tela de Publicação).
// Grava SÓ dados_conferencia.pos_publicacao e integracao_bling da ficha, com trava de versão
// (updated_at): se outro aparelho gravou no meio, não sobrescreve (tenta na próxima rodada).
// =============================================================
import { supabase } from "../supabase";
import { CHAVE_POS, devidaAgora, iniciarRegistroPos, rodadaPosPublicacao } from "./posPublicacao";
import { conferirIntegracao, precisaConferir, registroDaFichaOuPublicacao, ESTADO as ESTADO_BLING, TEXTO_ESTADO as TEXTO_BLING, lojaBlingDaConta } from "./vinculoBlingPublicacao";

const T = "paiia_anuncios";
const txt = (v) => String(v ?? "").trim();

async function lerFicha(anuncioId) {
  const { data, error } = await supabase.from(T).select("id, updated_at, dados_conferencia, paiia_anuncios_publicacoes(mlb_id, ml_user_id, bling_produto_id, sku, conta_nome, publicado_em)").eq("id", anuncioId).maybeSingle();
  if (error) return { ok: false, erro: error.message || "Falha ao ler a ficha." };
  if (!data) return { ok: false, erro: "Ficha não encontrada." };
  return { ok: true, ficha: { ...data, publicacao: (data.paiia_anuncios_publicacoes || []).find(Boolean) || null } };
}

async function gravar(ficha, mudar) {
  const dados = mudar({ ...(ficha.dados_conferencia || {}) });
  const agora = new Date().toISOString();
  const { data, error } = await supabase.from(T).update({ dados_conferencia: dados, updated_at: agora }).eq("id", ficha.id).eq("updated_at", ficha.updated_at).select("id");
  if (error) return { ok: false, erro: error.message || "Falha ao gravar." };
  if (!Array.isArray(data) || !data.length) return { ok: false, conflito: true, erro: "A ficha mudou ao mesmo tempo." };
  return { ok: true };
}

/**
 * Registra as conferências pendentes na ficha, logo depois do MLB confirmado.
 * Idempotente: se já existe registro para o MESMO MLB, não mexe.
 */
export async function registrarPosPublicacao({ anuncioId, mlb, conta, sku, quantidade }) {
  if (!anuncioId) return { ok: false, erro: "Sem ficha." };
  const reg = iniciarRegistroPos({ mlb, conta, sku, quantidade });
  if (!reg) return { ok: false, erro: "MLB inválido." };
  for (let i = 0; i < 3; i += 1) {
    const l = await lerFicha(anuncioId);
    if (!l.ok) return l;
    const atual = l.ficha.dados_conferencia?.[CHAVE_POS];
    if (atual?.mlb === reg.mlb) return { ok: true, jaExistia: true };
    const g = await gravar(l.ficha, (d) => ({ ...d, [CHAVE_POS]: reg }));
    if (g.ok || !g.conflito) return g;
  }
  return { ok: false, erro: "A ficha estava sendo gravada por outro aparelho." };
}

async function consultarItemML(conta, mlb) {
  const { data, error } = await supabase.functions.invoke("mercadolivre-publicacao", { body: { acao: "consultar_item", conta_ml: String(conta), item_id: mlb } });
  if (error) throw new Error(error.message || "falha ao falar com o servidor");
  return data?.ok ? data : null;
}
async function consultarBling(corpo) {
  const { data, error } = await supabase.functions.invoke("bling-integracao", { body: corpo });
  if (error) return { ok: false, erro: error.message || "Falha ao falar com o servidor." };
  return data || { ok: false, erro: "Resposta vazia do servidor." };
}

/** Vínculo no Bling da ficha (só leitura). Conta sem loja Bling: não se aplica. */
export async function conferirVinculoDaFicha(ficha, { consultar = consultarBling, completa = false } = {}) {
  const reg = registroDaFichaOuPublicacao(ficha.dados_conferencia, ficha.publicacao);
  if (!reg) {
    const conta = ficha.publicacao?.ml_user_id || ficha.dados_conferencia?.[CHAVE_POS]?.conta;
    return { estado: "nao_aplica", texto: lojaBlingDaConta(conta) ? "Sem produto Bling registrado na publicação: confira o vínculo no Bling." : "Conta sem vínculo automático com o Bling." };
  }
  if (!precisaConferir(reg)) return { estado: reg.estado === ESTADO_BLING.INTEGRADO ? "ok" : "nao_aplica", texto: TEXTO_BLING[reg.estado] || "" };
  const { registro } = await conferirIntegracao({ registro: reg, consultar, completa });
  const estado = registro.estado === ESTADO_BLING.INTEGRADO ? "ok"
    : registro.estado === ESTADO_BLING.AGUARDANDO ? "pendente"
      : "erro";
  return { estado, texto: txt(registro.mensagem) || TEXTO_BLING[registro.estado] || "", registroBling: registro };
}

/** Fichas da conta com conferência pós-publicação ainda aberta (RLS: só as do usuário). */
export async function listarPosPendentes({ limite = 20 } = {}) {
  const { data, error } = await supabase
    .from(T)
    .select("id, pos:dados_conferencia->pos_publicacao")
    .eq("dados_conferencia->pos_publicacao->>concluido", "false")
    .order("updated_at", { ascending: false })
    .limit(limite);
  if (error) return { ok: false, erro: error.message || "Falha ao listar." };
  return { ok: true, fichas: data || [] };
}

/** Uma rodada em UMA ficha: confere e grava o resultado (pendência ou conclusão). */
export async function processarFichaPos(anuncioId, { agora = Date.now(), forcar = false } = {}) {
  const l = await lerFicha(anuncioId);
  if (!l.ok) return l;
  const reg = l.ficha.dados_conferencia?.[CHAVE_POS];
  if (!reg || (!forcar && !devidaAgora(reg, agora))) return { ok: true, pulou: true };
  const conta = reg.conta || l.ficha.publicacao?.ml_user_id;
  const r = await rodadaPosPublicacao(reg, {
    consultarItem: (mlb) => consultarItemML(conta, mlb),
    conferirVinculo: () => conferirVinculoDaFicha(l.ficha, { completa: (Number(reg.tentativas) || 0) % 3 === 2 }),
    agora,
  });
  const g = await gravar(l.ficha, (d) => ({
    ...d,
    [CHAVE_POS]: r.registro,
    ...(r.registroBling ? { integracao_bling: { ...(d.integracao_bling || {}), ...r.registroBling } } : {}),
  }));
  return g.ok ? { ok: true, registro: r.registro } : g;
}

/** Roda as fichas pendentes que estão na hora (uma de cada vez). */
export async function processarPosPendentes({ agora = Date.now() } = {}) {
  const l = await listarPosPendentes();
  if (!l.ok) return l;
  const feitas = [];
  for (const f of l.fichas) {
    if (!devidaAgora(f.pos, agora)) continue;
    feitas.push({ id: f.id, ...(await processarFichaPos(f.id, { agora }).catch((e) => ({ ok: false, erro: String(e?.message || e) }))) });
  }
  return { ok: true, feitas };
}
