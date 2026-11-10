// =============================================================
// PAIIA — Central do Paizinho Inteligente: AUDITORIA COMERCIAL.
// Piloto: conta Mercado Livre LOJA ONLINE (1729335019), 10/11/2026.
//
// executarAuditoria = coleta (somente leitura) → recotação do frete com as
// medidas do Bling (só onde há divergência) → análise → relatório.
// Mesmo código no teste local (navegador) e no servidor às 03h.
// =============================================================
import { coletarDadosConta, somenteLeitura } from "./coleta.js";
import { analisarAnuncios, precisamRecotar } from "./analise.js";
import { montarRelatorio } from "./relatorio.js";
import { lerRespostaCotacao } from "../fretePrecificacao.js";
import { dimensoesParaApi } from "../logistica/logisticaMercadoLivre.js";
import { comLimite, num, txt } from "./util.js";

/** Contas liberadas para a auditoria. Piloto: só LOJA ONLINE. */
export const CONTAS_AUDITORIA = Object.freeze([
  Object.freeze({ id: "1729335019", nome: "LOJA ONLINE" }),
]);

export function contaLiberada(conta) {
  const id = txt(conta).replace(/\D/g, "");
  return CONTAS_AUDITORIA.find((c) => c.id === id) || null;
}

/** Caminho da cotação oficial com outras medidas (mesmo formato da janela de frete). */
export function caminhoRecotacao(conta, item, medida) {
  const tipo = txt(item.listing_type_id) || "gold_special";
  const mod = txt(item?.shipping?.logistic_type);
  return `/users/${conta}/shipping_options/free?dimensions=${encodeURIComponent(dimensoesParaApi(medida))}&item_price=${num(item.price).toFixed(2)}&listing_type_id=${tipo}&mode=me2&condition=${txt(item.condition) || "new"}${mod ? `&logistic_type=${encodeURIComponent(mod)}` : ""}&category_id=${txt(item.category_id)}&verbose=true`;
}

/**
 * Roda a auditoria completa de UMA conta.
 * @param {object} p
 * @param {string} p.conta                 id ML da conta (obrigatório e liberado)
 * @param {Function} p.consultar           (caminho) → { ok, status, dados, erro } — GET
 * @param {Function} [p.consultarBling]    (sku) → { ok, encontrado, produto }
 * @param {Function} [p.buscarConcorrentes] (item) → { ok, faixaComparavel, palavrasChaveSugeridas }
 * @param {Function} [p.precoTabelaRenault] ({ codigo, sku, item }) → número | null
 * @param {object} [p.config]              { impostoPercentual, margemMinimaPct, ... }
 * @param {object} [p.opcoesColeta]
 */
export async function executarAuditoria({
  conta,
  consultar,
  consultarBling = null,
  buscarConcorrentes = null,
  precoTabelaRenault = null,
  config = {},
  opcoesColeta = {},
  origem = "teste_local",
  agora = new Date().toISOString(),
  aoProgredir = () => {},
}) {
  const liberada = contaLiberada(conta);
  if (!liberada) throw new Error(`Conta ${txt(conta) || "(vazia)"} não liberada para a auditoria. Piloto: somente LOJA ONLINE.`);
  const get = somenteLeitura(consultar);
  const dados = await coletarDadosConta({ conta: liberada.id, consultar: get, consultarBling, buscarConcorrentes, agora, opcoes: opcoesColeta, aoProgredir });

  // Frete com as medidas do Bling, só onde as medidas divergem (impacto em R$).
  const recotacoes = {};
  const alvo = precisamRecotar(dados).slice(0, 60);
  if (alvo.length) {
    try { aoProgredir("Cotando o frete com as medidas do Bling"); } catch { /* ignora */ }
    await comLimite(alvo, 4, async ({ item, medida }) => {
      const r = await get(caminhoRecotacao(liberada.id, item, medida));
      const c = lerRespostaCotacao(r);
      if (c.ok) recotacoes[item.id] = c;
    });
  }

  const analise = analisarAnuncios(dados, { ...config, recotacoes, precoTabelaRenault });
  try { aoProgredir("Montando o relatório"); } catch { /* ignora */ }
  return montarRelatorio({ dados, analise, nomeConta: liberada.nome, origem, geradoEm: agora });
}

export { coletarDadosConta, analisarAnuncios, montarRelatorio };
