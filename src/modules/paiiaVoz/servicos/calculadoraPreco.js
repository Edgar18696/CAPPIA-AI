// PAIIA Voz — (P-03) cálculo do preço de venda a partir do CUSTO (nada é presumido).
//   preço = (custo + frete + despesas) ÷ (1 − (comissão + impostos + margem) / 100)
import { MARGENS_PADRAO } from "../../../services/fretePrecificacao.js";
import { COMISSOES_REFERENCIA_PADRAO, CHAVE_COMISSOES_REFERENCIA, lerComissoesReferencia } from "../../../services/precificacaoSimples.js";

const num = (v) => { const t = String(v ?? "").trim().replace(/\s/g, ""); if (!t) return 0; const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t); return Number.isFinite(n) ? n : 0; };
export const reais = (v) => `R$ ${(Math.round(v * 100) / 100).toFixed(2).replace(".", ",")}`;

/**
 * (07/11) Preço que o botão da calculadora leva ao Preço de Venda: o "preço para conferir"
 * informado ou, sem ele, o PREÇO SUGERIDO. null quando não há sugestão (sem custo).
 */
export function precoParaUsar(plano = {}) {
  const sug = calcularPrecoVenda(plano);
  if (!sug.ok) return null;
  const venda = num(plano.venda);
  const preco = venda > 0 ? venda : sug.preco;
  return { preco, sugerido: !(venda > 0), texto: preco.toFixed(2).replace(".", ",") };
}

export function calcularPrecoVenda({ custo, frete = 0, despesas = 0, comissao = 0, impostos = 0, margem = 0 }) {
  const c = num(custo);
  if (!(c > 0)) return { ok: false, erro: "Informe o custo da peça." };
  const fixo = c + num(frete) + num(despesas);
  const perc = (num(comissao) + num(impostos) + num(margem)) / 100;
  if (perc >= 1) return { ok: false, erro: "Comissão + impostos + margem precisam somar menos de 100%." };
  const preco = Math.ceil((fixo / (1 - perc)) * 100) / 100;
  return { ok: true, preco, partes: { custo: c, frete: num(frete), despesas: num(despesas), comissao: preco * num(comissao) / 100, impostos: preco * num(impostos) / 100, lucro: preco * num(margem) / 100 } };
}

export function comissaoReferencia(tipoAnuncio) {
  let refs = COMISSOES_REFERENCIA_PADRAO;
  try { refs = lerComissoesReferencia(localStorage.getItem(CHAVE_COMISSOES_REFERENCIA)) || refs; } catch { /* padrão */ }
  return String(tipoAnuncio) === "premium" ? refs.premium : refs.classico;
}


// -------------------------------------------------------------
// (16/11) Conferência de um preço de venda: quanto SOBRA depois de pagar comissão, impostos, frete,
// despesas e RECOMPRAR a peça pelo mesmo custo. Cada parte arredondada em centavos (como aparece na tela).
// Não é lucro líquido contábil (não inclui IR/CSLL, custos fixos etc.).
// -------------------------------------------------------------
const cent = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
export function analisarVenda({ venda, custo, frete = 0, despesas = 0, comissao = 0, impostos = 0 }) {
  const v = num(venda); const c = num(custo);
  if (!(v > 0)) return { ok: false, erro: "Informe o preço de venda (ou use o sugerido)." };
  if (!(c > 0)) return { ok: false, erro: "Informe o custo da mercadoria." };
  const partes = { comissao: cent(v * num(comissao) / 100), impostos: cent(v * num(impostos) / 100), frete: cent(num(frete)), despesas: cent(num(despesas)), recompra: cent(c) };
  const sobra = cent(v - partes.comissao - partes.impostos - partes.frete - partes.despesas - partes.recompra);
  return { ok: true, venda: cent(v), partes, sobra, margemSobreVenda: cent((sobra / v) * 100), acrescimoSobreCusto: cent(((v - c) / c) * 100) };
}

/** Valor falado para um campo da calculadora: R$ (custo, frete, despesas, venda) ou % (comissão, impostos, margem). */
export function valorFaladoCalculadora(campo, fala, lerPreco) {
  const pct = ["comissao", "impostos", "margem"].includes(campo);
  let t = String(fala || "").toLowerCase();
  if (pct) t = t.replace(/por\s*cento|porcento|%/g, " ");
  if (/^\s*(um|uma)\s+(real|reais)?\s*$/.test(t) || /^\s*(um|uma)\s*$/.test(t)) t = "1";
  const n = typeof lerPreco === "function" ? lerPreco(t) : null;
  const v = Number.isFinite(n) ? n : num(t.replace(/[^\d.,]/g, ""));
  if (!(v >= 0) || (!v && !/\b(zero|0)\b/.test(t))) return null;
  if (pct && v >= 100) return null;
  return String(cent(v)).replace(".", ",");
}

/** Valores iniciais: o que veio da ficha; comissão e margem de referência marcadas como ESTIMATIVA. */
export function valoresIniciaisCalculadora(salvos = {}, tipoAnuncio = "classico") {
  const v = { ...salvos };
  if (!v.comissao) v.comissao = { valor: String(comissaoReferencia(tipoAnuncio)), origem: "estimativa" };
  if (!v.margem) v.margem = { valor: String(MARGENS_PADRAO[1].margem), origem: "estimativa" };
  return v;
}

