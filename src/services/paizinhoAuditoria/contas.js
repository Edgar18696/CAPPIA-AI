// Contas Mercado Livre liberadas para a Central do Paizinho.
// (Arquivo próprio para as funções do servidor não carregarem o motor inteiro.)
// (17/11) As 3 contas, escolhidas uma por vez na Central (LOJA ONLINE é a padrão).
// Cada análise lê SÓ a conta escolhida; anúncio de outro vendedor é descartado.
// Obs.: a paizinho-leitura-ml PUBLICADA (v3, 11/11) ainda só libera a LOJA ONLINE;
// nas outras contas visitas e vendas aparecem "não lido" com o motivo, até ela ser
// publicada de novo com esta lista (precisa de autorização).
export const CONTAS_AUDITORIA = Object.freeze([
  Object.freeze({ id: "1729335019", nome: "LOJA ONLINE" }),
  Object.freeze({ id: "824312524", nome: "CIEBR" }),
  Object.freeze({ id: "2412238242", nome: "REVELAÇÃO" }),
]);

/** Conta escolhida ao abrir a Central. */
export const CONTA_PADRAO = CONTAS_AUDITORIA[0];
