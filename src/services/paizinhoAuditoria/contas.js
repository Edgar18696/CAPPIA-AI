// Contas Mercado Livre liberadas para a Central do Paizinho.
// (Arquivo próprio para as funções do servidor não carregarem o motor inteiro.)
// (17/11) As 3 contas, escolhidas uma por vez na Central. (18/11) REVELAÇÃO é a padrão (prioridade).
// Cada análise lê SÓ a conta escolhida; anúncio de outro vendedor é descartado.
// (17/11) A paizinho-leitura-ml publicada (v5) libera as 3 contas, conferindo a identidade no ML.
export const CONTAS_AUDITORIA = Object.freeze([
  Object.freeze({ id: "1729335019", nome: "LOJA ONLINE" }),
  Object.freeze({ id: "824312524", nome: "CIEBR" }),
  Object.freeze({ id: "2412238242", nome: "REVELAÇÃO" }),
]);

/** Conta escolhida ao abrir a Central: REVELAÇÃO (prioridade desde 18/11). */
export const CONTA_PADRAO = CONTAS_AUDITORIA.find((c) => c.id === "2412238242");

/** Conta dos registros ANTIGOS gravados sem a conta no nome (piloto da LOJA ONLINE). */
export const CONTA_LEGADO = CONTAS_AUDITORIA[0];
