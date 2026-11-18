// =============================================================
// PAIIA — ligações do "produto já existente" (16/11/2026).
// Leituras: fichas do código (base PAIIA), Bling (saldo_por_sku), registro
// interno de MLBs e ml_consulta GET de cada conta. Única gravação: no
// REGISTRO INTERNO (paiia_registro_mlb), só do que o Mercado Livre confirmou
// com o MESMO SKU na mesma conta (a mesma regra do reconhecimento de SKU).
// Nada no Mercado Livre, nada no Bling.
// =============================================================
import { supabase } from "../supabase";
import { listarAnunciosDoCodigo } from "./anuncioPublicacaoService";
import { reconhecerSKU } from "./reconhecimentoSKU";
import { lerRegistroDoSKU, aplicarGravacoesRegistro } from "./registroMLBService";
import { identidadesDasFichas } from "./produtoExistenteSKU";

export async function lerBling(sku) {
  const { data, error } = await supabase.functions.invoke("bling-integracao", { body: { acao: "saldo_por_sku", sku } });
  if (error) return { ok: false, erro: error.message || "falha ao falar com o Bling" };
  return data || { ok: false, erro: "resposta vazia do Bling" };
}

export async function consultarML(conta, caminho) {
  const { data, error } = await supabase.functions.invoke("mercadolivre-publicacao", {
    body: { acao: "ml_consulta", conta_ml: String(conta), metodo: "GET", caminho },
  });
  if (error) return { ok: false, erro: error.message || "falha ao falar com o Mercado Livre" };
  return data || { ok: false, erro: "resposta vazia do Mercado Livre" };
}

// (17/11) Bling conectado? Lido uma vez e guardado por 5 min (só leitura; sem Bling, nada é consultado).
let statusBling = null;
export async function blingEstaConectado() {
  if (statusBling && Date.now() - statusBling.em < 5 * 60 * 1000) return statusBling.valor;
  let valor = null; // desconhecido: a consulta tenta e, se falhar, diz "não foi possível verificar"
  try {
    const { data, error } = await supabase.functions.invoke("bling-integracao", { body: { acao: "status" } });
    if (!error && data?.ok) valor = Boolean(data.conectado);
  } catch { /* desconhecido */ }
  if (valor !== null) statusBling = { em: Date.now(), valor };
  return valor;
}

/** Só as fichas PAIIA do código (base interna; nada externo). */
export function lerFichasDoCodigo(codigo) {
  return listarAnunciosDoCodigo(codigo);
}

/** Bling + registro + as 3 contas do ML (+ fichas). Somente leitura fora do PAIIA. */
export async function reconhecerProdutoExistente({ codigo, contas }) {
  const r = await reconhecerSKU({ codigo, contas, lerBling, lerBase: listarAnunciosDoCodigo, consultarML, lerRegistro: lerRegistroDoSKU });
  if (!r) return r;
  // (16/11) MLBs gravados nas fichas e não confirmados pela busca: cada um lido na SUA conta (com variações).
  const lidas = await listarAnunciosDoCodigo(codigo).catch(() => null);
  r.identidades = await identidadesDasFichas({ codigo, fichas: lidas?.ok ? lidas.anuncios : [], reconhecimento: r, consultarML });
  const g = r.gravacoes || { inserir: [], atualizar: [] };
  let gravacao = { registrados: [], atualizados: 0, falhas: [] };
  if (g.inserir.length || g.atualizar.length) gravacao = await aplicarGravacoesRegistro(g).catch((e) => ({ registrados: [], atualizados: 0, falhas: [String(e?.message || e)] }));
  return { ...r, gravacao };
}
