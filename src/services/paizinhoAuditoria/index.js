// =============================================================
// PAIIA — Central do Paizinho Inteligente: AUDITORIA COMERCIAL.
// Piloto: conta Mercado Livre LOJA ONLINE (1729335019), 10/11/2026.
//
// executarAuditoria = coleta (somente leitura) → recotação do frete com as
// medidas do Bling (só onde há divergência) → análise → relatório.
// Mesmo código no teste local (navegador) e no servidor às 03h.
// =============================================================
import { coletarDadosConta, somenteLeitura, erroDeSessao } from "./coleta.js";
import { analisarAnuncios, precisamRecotar } from "./analise.js";
import { montarRelatorio } from "./relatorio.js";
import { lerRespostaCotacao } from "../fretePrecificacao.js";
import { dimensoesParaApi } from "../logistica/logisticaMercadoLivre.js";
import { comLimite, num, txt } from "./util.js";
import { CONTAS_AUDITORIA } from "./contas.js";

/** Contas liberadas para a auditoria. Piloto: só LOJA ONLINE (lista em contas.js). */
export { CONTAS_AUDITORIA };

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
  // (11/11) Todas as divergências da conta (antes: só 60). Uma cotação por anúncio.
  const alvo = precisamRecotar(dados, config).slice(0, Number(opcoesColeta.limiteRecotacoes) || 2000);
  if (alvo.length) {
    try { aoProgredir("Cotando o frete com as medidas do Bling"); } catch { /* ignora */ }
    // (12/11) Falhas da recotação agora aparecem no relatório (antes sumiam em silêncio).
    let sessaoExpirada = false;
    let falhou = 0;
    let exemplo = "";
    await comLimite(alvo, 4, async ({ item, medida }) => {
      if (sessaoExpirada) return;
      const r = await get(caminhoRecotacao(liberada.id, item, medida));
      const c = lerRespostaCotacao(r);
      if (c.ok) { recotacoes[item.id] = c; return; }
      falhou++;
      exemplo ||= txt(r?.erro) || txt(c?.erro) || `HTTP ${r?.status || "?"}`;
      if (erroDeSessao(r)) sessaoExpirada = true;
    });
    const feitas = Object.keys(recotacoes).length;
    if (feitas < alvo.length) {
      dados.leituraRecotacao = { feitas, total: alvo.length, motivo: sessaoExpirada ? "sessao" : "falhas" };
      if (falhou) dados.falhas.push({ etapa: "recotação do frete", caminho: "/users/*/shipping_options/free", erro: exemplo, quantidade: falhou });
    }
  }

  const analise = analisarAnuncios(dados, { ...config, recotacoes, precoTabelaRenault });
  try { aoProgredir("Montando o relatório"); } catch { /* ignora */ }
  return montarRelatorio({ dados, analise, nomeConta: liberada.nome, origem, geradoEm: agora });
}

export { coletarDadosConta, analisarAnuncios, montarRelatorio };
