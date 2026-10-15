import { supabase } from "../supabase";
import { listarAnunciosDoCodigo } from "./anuncioPublicacaoService";
import { reconhecerSKU, criarCacheReconhecimento, chaveCodigo } from "./reconhecimentoSKU";

/*
 * Ligações do reconhecimento de SKU com o servidor — SOMENTE LEITURA:
 *  - Bling: bling-integracao "saldo_por_sku" (a mesma leitura da Publicação);
 *  - Mercado Livre: mercadolivre-publicacao "ml_consulta" GET, conta a conta
 *    (busca de anúncios da conta e leitura de cada anúncio);
 *  - Base PAIIA: SELECT das fichas deste código (listarAnunciosDoCodigo).
 * Nenhuma ação de criar, publicar, vincular ou alterar estoque é chamada.
 */

async function lerBling(sku) {
  const { data, error } = await supabase.functions.invoke("bling-integracao", { body: { acao: "saldo_por_sku", sku } });
  if (error) return { ok: false, erro: error.message || "falha ao falar com o Bling" };
  return data || { ok: false, erro: "resposta vazia do Bling" };
}

async function consultarML(conta, caminho) {
  const { data, error } = await supabase.functions.invoke("mercadolivre-publicacao", {
    body: { acao: "ml_consulta", conta_ml: String(conta), metodo: "GET", caminho },
  });
  if (error) return { ok: false, erro: error.message || "falha ao falar com o Mercado Livre" };
  return data || { ok: false, erro: "resposta vazia do Mercado Livre" };
}

const cache = criarCacheReconhecimento();

/** Reconhece o código (com cache de 10 min; forcar = consulta de novo). */
export function reconhecerCodigo({ codigo, contas, forcar = false }) {
  const chave = chaveCodigo(codigo);
  // A chave inclui as contas conectadas: conectar/desconectar consulta de novo.
  const chaveCache = `${chave}|${contas.map((c) => `${c.id}:${c.conectada ? 1 : 0}`).join(",")}`;
  return cache.obter(chaveCache, () => reconhecerSKU({ codigo, contas, lerBling, lerBase: listarAnunciosDoCodigo, consultarML }), { forcar });
}
