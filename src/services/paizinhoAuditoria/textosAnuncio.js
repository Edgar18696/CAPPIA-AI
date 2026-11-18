// PAIIA — Central do Paizinho: textos da auditoria por anúncio (18/11/2026).
// Custo ausente = "Custo não informado" (nunca zero, nunca inventado).
// Custo da última compra = REFERÊNCIA; margem com ele = ESTIMATIVA (nunca definitiva).
const reais = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v) => `${String(v).replace(".", ",")}%`;

/** Texto do custo CADASTRADO: real do Bling, a confirmar ou "Custo não informado". */
export function textoCusto(a) {
  if (a?.custo !== null && a?.custo !== undefined && Number(a.custo) > 0) return a.custo_a_confirmar ? `${reais(a.custo)} (a confirmar)` : reais(a.custo);
  return "Custo não informado";
}

/** Texto da margem DEFINITIVA: só com custo cadastrado e despesas lidas; sem imposto, avisa. */
export function textoMargem(a) {
  if (a?.margem_pct === null || a?.margem_pct === undefined) return "Margem não calculada";
  return `${pct(a.margem_pct)}${a.margem_com_imposto === false ? " (antes do imposto)" : ""}`;
}

/** Texto da margem ESTIMADA pela última compra (nunca definitiva). */
export function textoMargemEstimada(a) {
  if (a?.margem_estimada_pct === null || a?.margem_estimada_pct === undefined) return "";
  return `≈ ${pct(a.margem_estimada_pct)} (estimativa${a.margem_estimada_com_imposto === false ? ", antes do imposto" : ""})`;
}

const celula = (v) => { const t = String(v ?? "").replace(/\r?\n/g, " ").trim(); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
const numBR = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? "" : Number(v).toFixed(2).replace(".", ","));
const dataBR = (iso) => { const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; };

export const COLUNAS_AUDITORIA = Object.freeze(["Conta", "MLB", "SKU", "Título", "Preço (R$)", "Custo cadastrado no Bling (R$)", "Situação do custo", "Última compra (R$)", "Data da última compra", "Fonte da última compra", "Margem definitiva (%)", "Margem estimada pela última compra (%)", "Visitas 30d", "Vendas 30d", "Fotos", "Compatibilidades", "Frete", "Problemas", "Como corrigir", "Link"]);

/** Planilha (CSV ; com BOM) da auditoria completa: custos, margens, problemas e recomendações. */
export function planilhaAuditoriaCSV(rel) {
  const linhas = [COLUNAS_AUDITORIA.join(";")];
  for (const a of rel?.anuncios || []) {
    const probs = (a.achados || []).filter((x) => !x.positivo);
    const temCusto = Number(a.custo) > 0;
    linhas.push([
      rel?.conta?.nome || "", a.item_id, a.sku || "", a.titulo || "", numBR(a.preco),
      temCusto ? numBR(a.custo) : "", temCusto ? (a.custo_a_confirmar ? "a confirmar" : "cadastrado") : "Custo não informado",
      a.ultima_compra?.valor > 0 ? numBR(a.ultima_compra.valor) : "", dataBR(a.ultima_compra?.data), a.ultima_compra?.valor > 0 ? `${a.ultima_compra.fonte} nº ${a.ultima_compra.pedido}` : "",
      a.margem_pct ?? "", a.margem_pct === null || a.margem_pct === undefined ? (a.margem_estimada_pct ?? "") : "",
      a.visitas30 ?? "não lido", a.vendas30 ?? "não lido", a.fotos ?? "", a.compat ?? "",
      a.frete_gratis ? `grátis${a.frete_vendedor !== null && a.frete_vendedor !== undefined ? ` (vendedor paga ${numBR(a.frete_vendedor)})` : ""}` : "comprador paga",
      probs.map((x) => x.problema).join(" | "), probs.map((x) => x.sugestao).join(" | "), a.link || "",
    ].map(celula).join(";"));
  }
  return `${String.fromCharCode(0xfeff)}${linhas.join("\r\n")}`;
}
