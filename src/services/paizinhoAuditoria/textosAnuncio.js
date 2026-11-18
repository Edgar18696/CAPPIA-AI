// PAIIA — Central do Paizinho: textos da auditoria por anúncio (18/11/2026).
// Custo ausente = "Custo não informado" (nunca zero, nunca inventado).
const reais = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Texto do custo: real do Bling, a confirmar ou "Custo não informado". */
export function textoCusto(a) {
  if (a?.custo !== null && a?.custo !== undefined && Number(a.custo) > 0) return a.custo_a_confirmar ? `${reais(a.custo)} (a confirmar)` : reais(a.custo);
  return "Custo não informado";
}

/** Texto da margem: só com custo e despesas lidas; sem imposto cadastrado, avisa. */
export function textoMargem(a) {
  if (a?.margem_pct === null || a?.margem_pct === undefined) return "Margem não calculada";
  return `${String(a.margem_pct).replace(".", ",")}%${a.margem_com_imposto === false ? " (antes do imposto)" : ""}`;
}
