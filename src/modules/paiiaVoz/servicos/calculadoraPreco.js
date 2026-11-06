// PAIIA Voz — (P-03) cálculo do preço de venda a partir do CUSTO (nada é presumido).
//   preço = (custo + frete + despesas) ÷ (1 − (comissão + impostos + margem) / 100)
import { COMISSOES_REFERENCIA_PADRAO, CHAVE_COMISSOES_REFERENCIA, lerComissoesReferencia } from "../../../services/precificacaoSimples.js";

const num = (v) => { const t = String(v ?? "").trim().replace(/\s/g, ""); if (!t) return 0; const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t); return Number.isFinite(n) ? n : 0; };
export const reais = (v) => `R$ ${(Math.round(v * 100) / 100).toFixed(2).replace(".", ",")}`;

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

