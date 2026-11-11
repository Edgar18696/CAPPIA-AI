// =============================================================
// PAIIA — Central do Paizinho: leitura do RELATÓRIO DA MANHÃ e o
// TESTE LOCAL com dados reais (somente leitura).
//   - Produção: lê o último relatório gravado pela função das 03h
//     (tabela paiia_paizinho_relatorios; sem a tabela → "não ativado").
//   - Teste local (npm run dev): roda o mesmo motor no navegador usando as
//     funções que o PAIIA já usa (ml_consulta GET e bling buscar_produto).
//     O resultado fica SÓ neste navegador (localStorage).
// =============================================================
import { supabase } from "../../supabase";
import { consultorML } from "../consultaMLLeitura";
import { executarAuditoria, CONTAS_AUDITORIA } from "./index.js";
import { roteadorConsultas, consultorComercial as leitorComercial } from "./leituraComercial.js";

const consultorComercial = (conta) => leitorComercial(conta, (nome, opcoes) => supabase.functions.invoke(nome, opcoes));

export const CHAVE_TESTE_LOCAL = "paiiaPaizinhoRelatorioTeste";
export const CONTA_PILOTO = CONTAS_AUDITORIA[0];

/** Último relatório do servidor. { estado: "ok"|"vazio"|"nao_ativado"|"erro", registro } */
export async function lerUltimoRelatorio() {
  try {
    const { data, error } = await supabase
      .from("paiia_paizinho_relatorios")
      .select("id, conta_ml, conta_nome, status, data_referencia, iniciado_em, concluido_em, relatorio, erro")
      .eq("conta_ml", CONTA_PILOTO.id)
      .order("iniciado_em", { ascending: false })
      .limit(1);
    if (error) {
      const semTabela = ["PGRST205", "42P01"].includes(error.code) || /does not exist|Could not find the table/i.test(error.message || "");
      return { estado: semTabela ? "nao_ativado" : "erro", erro: error.message };
    }
    return data?.length ? { estado: "ok", registro: data[0] } : { estado: "vazio" };
  } catch (e) {
    return { estado: "erro", erro: String(e?.message || e) };
  }
}

export function lerRelatorioTesteLocal() {
  try { return JSON.parse(localStorage.getItem(CHAVE_TESTE_LOCAL) || "null"); } catch { return null; }
}
export function guardarRelatorioTesteLocal(rel) {
  try { localStorage.setItem(CHAVE_TESTE_LOCAL, JSON.stringify(rel)); return true; } catch { return false; }
}

function impostoDoPerfil() {
  try {
    const p = JSON.parse(localStorage.getItem("paiiaPerfilCustos") || "null");
    const n = Number(String(p?.impostoPercentual ?? "").replace(",", "."));
    return Number.isFinite(n) && n >= 0 && String(p?.impostoPercentual ?? "").trim() !== "" ? n : null;
  } catch { return null; }
}

// (12/11) Leituras do Bling guardadas neste navegador por 24 h: se a sessão
// expirar no meio, a próxima rodada continua de onde parou (~30 SKUs/min).
// Guarda só os campos que a auditoria usa. Nada é gravado no Bling.
export const CHAVE_CACHE_BLING = "paiiaPaizinhoBlingCache";
const VALIDADE_CACHE_BLING_MS = 24 * 60 * 60 * 1000;
const CAMPOS_BLING = ["codigo", "nome", "peso_bruto", "peso_liquido", "pesoBruto", "pesoLiquido", "largura", "altura", "profundidade", "precoCusto", "preco_custo", "custo"];

export function resumirProdutoBling(p) {
  if (!p || typeof p !== "object") return null;
  const out = {};
  for (const c of CAMPOS_BLING) if (p[c] !== undefined) out[c] = p[c];
  return out;
}

function lerCacheBling(agora = Date.now(), chave = CHAVE_CACHE_BLING) {
  try {
    const c = JSON.parse(localStorage.getItem(chave) || "null");
    if (!c || c.conta !== CONTA_PILOTO.id || typeof c.itens !== "object") return {};
    const validos = {};
    for (const [sku, v] of Object.entries(c.itens)) if (agora - Number(v?.lidoEm || 0) < VALIDADE_CACHE_BLING_MS) validos[sku] = v;
    return validos;
  } catch { return {}; }
}
function gravarCacheBling(itens, chave = CHAVE_CACHE_BLING) {
  try { localStorage.setItem(chave, JSON.stringify({ conta: CONTA_PILOTO.id, itens })); } catch { /* sem espaço: segue sem cache */ }
}

// (12/11) Preço de custo: ação SOMENTE LEITURA "custo_por_sku" da bling-integracao
// (só GET no Bling; não grava nem no Bling nem no PAIIA). Também guardado 24 h.
export const CHAVE_CACHE_CUSTO = "paiiaPaizinhoCustoCache";
/** Guarda só o necessário da resposta de custo_por_sku. */
export function resumirCusto(d) {
  return {
    ok: true,
    encontrado: d?.encontrado !== false,
    ambiguo: d?.ambiguo === true,
    custo: d?.custo ? {
      fornecedor_precoCusto: d.custo.fornecedor_precoCusto ?? null,
      fornecedores: (Array.isArray(d.custo.fornecedores) ? d.custo.fornecedores : []).map((f) => ({ padrao: f?.padrao === true, precoCusto: f?.precoCusto ?? null })),
    } : null,
  };
}

/** Teste local com dados reais da LOJA ONLINE (somente leitura). */
export async function rodarTesteLocal({ limiteItens = 100, concorrencia = 0, aoProgredir } = {}) {
  const cache = lerCacheBling();
  let novos = 0;
  const consultarBlingServidor = async (sku) => {
    const { data, error } = await supabase.functions.invoke("bling-integracao", { body: { acao: "buscar_produto", codigo: sku } });
    if (error) {
      // O corpo da resposta de erro traz o motivo real (ex.: "Usuário não autenticado").
      let erro = error.message;
      try { const corpo = await error.context?.json?.(); if (corpo?.erro || corpo?.error) erro = corpo.erro || corpo.error; } catch { /* mantém a mensagem */ }
      return { ok: false, erro, status: error.context?.status };
    }
    return data?.ok ? { ok: true, produto: data.produto || null, encontrado: data.encontrado } : { ok: false, encontrado: data?.encontrado, erro: data?.erro };
  };
  const consultarBling = async (sku) => {
    const guardado = cache[sku];
    if (guardado) return { ok: true, produto: guardado.produto, encontrado: guardado.encontrado, doCache: true };
    const r = await consultarBlingServidor(sku);
    if (r.ok || r.encontrado === false) {
      cache[sku] = { produto: resumirProdutoBling(r.produto), encontrado: r.encontrado !== false && !!r.produto, lidoEm: Date.now() };
      if (++novos % 25 === 0) gravarCacheBling(cache);
    }
    return r;
  };
  const cacheCusto = lerCacheBling(Date.now(), CHAVE_CACHE_CUSTO);
  let novosCusto = 0;
  const consultarCusto = async (sku) => {
    const guardado = cacheCusto[sku];
    if (guardado) return { ...guardado.resposta, doCache: true };
    const { data, error } = await supabase.functions.invoke("bling-integracao", { body: { acao: "custo_por_sku", sku } });
    if (error) {
      let erro = error.message;
      try { const corpo = await error.context?.json?.(); if (corpo?.erro || corpo?.error) erro = corpo.erro || corpo.error; } catch { /* mantém */ }
      return { ok: false, erro, status: error.context?.status };
    }
    if (!data?.ok) return { ok: false, erro: data?.erro || "resposta inesperada", status: data?.status };
    const resposta = resumirCusto(data);
    cacheCusto[sku] = { resposta, lidoEm: Date.now() };
    if (++novosCusto % 25 === 0) gravarCacheBling(cacheCusto, CHAVE_CACHE_CUSTO);
    return resposta;
  };
  const buscarConcorrentes = concorrencia > 0 ? async (item) => {
    const a = (id) => (item.attributes || []).find((x) => x.id === id)?.value_name || "";
    const marca = a("BRAND");
    const original = /^(renault|volkswagen|vw|chevrolet|gm|fiat|ford|toyota|honda|hyundai|nissan|peugeot|citroen)$/i.test(marca.trim());
    const { data, error } = await supabase.functions.invoke("concorrencia", { body: { codigo: a("PART_NUMBER") || a("OEM"), titulo: item.title, fabricante: marca, categoria: original ? "original" : "equivalente" } });
    if (error || !data?.sucesso) return { ok: false, erro: error?.message || data?.error || "sem resultado" };
    return { ok: true, faixaComparavel: data.faixaComparavel, palavrasChaveSugeridas: data.palavrasChaveSugeridas };
  } : null;
  let rel;
  try {
    rel = await executarAuditoria({
      conta: CONTA_PILOTO.id,
      // (12/11) Vendas, visitas e custo de envio pela função paizinho-leitura-ml;
      // o resto continua pela mercadolivre-publicacao. As duas só leem.
      consultar: roteadorConsultas({ principal: consultorML(CONTA_PILOTO.id), comercial: consultorComercial(CONTA_PILOTO.id) }),
      consultarBling,
      consultarCusto,
      buscarConcorrentes,
      config: { impostoPercentual: impostoDoPerfil() },
      opcoesColeta: { limiteItens, limiteConcorrencia: concorrencia },
      origem: "teste_local",
      aoProgredir,
    });
  } finally {
    if (novos) gravarCacheBling(cache);
    if (novosCusto) gravarCacheBling(cacheCusto, CHAVE_CACHE_CUSTO);
  }
  guardarRelatorioTesteLocal(rel);
  return rel;
}
