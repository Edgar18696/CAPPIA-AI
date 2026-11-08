// =============================================================
// PAIIA Voz — (08/11/2026) FRETE DE VENDA (Mercado Livre), separado do frete de compra.
//   Testes: scripts/testes/paiiaVozOrdemEnvioPreco.test.mjs
//
// Etapa Envio (antes do Preço): com peso + 3 medidas, consulta SOMENTE LEITURA a cotação
// oficial do ML (shipping_options/free da conta) e guarda na ficha (ficha.freteVenda).
// Etapa Preço: a calculadora usa esse valor no preço sugerido. Sem cotação → "Frete pendente"
// (nada de zero presumido) ou uma ESTIMATIVA informada por você, identificada como estimativa.
// O frete depende da faixa de preço: se o preço cair em outra faixa, pede nova cotação.
// Funções puras; a consulta ao ML é injetada (consultar/modalidades).
// =============================================================
import { parametrosCotacao, prontoParaCotar, cotarNoPreco, faixaDoPreco, rotuloFaixa, reais, ORIGEM_FRETE } from "../../../services/fretePrecificacao.js";
import { calcularPrecoVenda } from "./calculadoraPreco.js";
import { medidaVoz } from "./fichaCompletaVoz.js";

export const ORIGEM_ESTIMATIVA_VOZ = "estimativa_informada";
/** Sem preço ainda (o Envio vem antes do Preço): cota na faixa de referência R$ 79–99,99, reconferida no Preço. */
export const PRECO_REFERENCIA_FRETE = 79;

const num = (v) => { const t = String(v ?? "").trim().replace(/\s/g, ""); if (!t) return NaN; const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t); return Number.isFinite(n) ? n : NaN; };
const copia = (f) => JSON.parse(JSON.stringify(f || {}));

export function chaveMedida(medida) {
  if (!medida) return "";
  return [medida.peso_g, medida.comprimento_cm, medida.largura_cm, medida.altura_cm].map((x) => Number(x) || 0).join("|");
}

/** Preço usado para cotar: o Preço de Venda da ficha, senão o sugerido sem frete de venda, senão a referência. */
export function precoParaCotar(ficha, plano = null) {
  const p = num(ficha?.campos?.preco?.valor);
  if (p > 0) return { preco: p, origem: "preco" };
  if (plano) {
    const s = calcularPrecoVenda({ ...plano, freteVenda: 0 });
    if (s.ok && s.preco > 0) return { preco: s.preco, origem: "sugerido" };
  }
  return { preco: PRECO_REFERENCIA_FRETE, origem: "referencia" };
}

/**
 * Consulta a cotação oficial (só leitura). deps: { consultar(caminho), modalidades(conta) }.
 * Devolve { ok, registro } ou { ok:false, erro } — nunca um valor inventado.
 */
export async function cotarFreteVendaVoz(ficha, { conta, preco, tipoAnuncio = "classico", deps, agora = () => new Date().toISOString() }) {
  const contaId = String(conta || "").replace(/\D/g, "");
  if (!contaId) return { ok: false, erro: "Escolha a conta do Mercado Livre para consultar o frete." };
  const medida = medidaVoz(ficha).medida;
  if (!medida) return { ok: false, erro: "Informe o peso e as 3 medidas da embalagem para consultar o frete." };
  if (!(Number(preco) > 0)) return { ok: false, erro: "Sem preço para consultar o frete." };
  let mods;
  try { mods = await deps.modalidades(contaId); } catch (e) { mods = { ok: false, erro: String(e?.message || e) }; }
  const modalidade = mods?.modalidades?.[0]?.tipo || "";
  if (!modalidade) return { ok: false, erro: mods?.erro || "A conta não tem modalidade Mercado Envios ativa." };
  const params = parametrosCotacao({ conta: contaId, medida, modalidade, tipoAnuncio });
  const falta = prontoParaCotar(params);
  if (falta.length) return { ok: false, erro: `Falta: ${falta.join(", ")}.` };
  const c = await cotarNoPreco({ params, preco, consultar: deps.consultar, agora });
  if (!c.ok) return { ok: false, erro: c.erro || "Cotação do Mercado Livre não obtida." };
  return {
    ok: true,
    registro: {
      valor: c.custo_vendedor,
      origem: c.origem === ORIGEM_FRETE.SIMULACAO ? ORIGEM_FRETE.SIMULACAO : ORIGEM_FRETE.ML,
      conta: contaId,
      modalidade,
      tipoAnuncio: params.tipoAnuncio,
      precoCotado: c.preco_cotado,
      faixa: c.faixa,
      faixaRotulo: c.faixa_rotulo,
      pesoCobradoG: c.peso_cobrado_g ?? null,
      medida: chaveMedida(medida),
      em: c.cotado_em,
    },
  };
}

export function registrarFreteVenda(ficha, registro) {
  const f = copia(ficha);
  f.freteVenda = { ...registro };
  return f;
}
/** Estimativa informada por você (vazio = remove; volta a "Frete pendente"). Nunca vira cotação do ML. */
export function definirFreteEstimado(ficha, valor) {
  const f = copia(ficha);
  const v = num(valor);
  if (!(v >= 0)) { if (f.freteVenda?.origem === ORIGEM_ESTIMATIVA_VOZ) delete f.freteVenda; return f; }
  f.freteVenda = { valor: Math.round(v * 100) / 100, origem: ORIGEM_ESTIMATIVA_VOZ, em: new Date().toISOString() };
  return f;
}

/**
 * Situação do frete de venda para o preço que vai ser usado.
 * estado: "pendente" (sem valor — não entra como zero) | "ok" (cotação do ML) | "estimativa" (informada)
 *       | "outra_faixa" (cotado em outra faixa de preço: valor do ML, mas pede nova cotação).
 */
export function situacaoFreteVenda(ficha, precoAlvo = 0) {
  const fv = ficha?.freteVenda;
  if (!fv || !(Number(fv.valor) >= 0)) return { estado: "pendente", valor: null, texto: "Frete pendente — consulte no Envio (peso e medidas) ou informe uma estimativa." };
  if (fv.origem === ORIGEM_ESTIMATIVA_VOZ) return { estado: "estimativa", valor: fv.valor, texto: `Estimativa informada por você: ${reais(fv.valor)} (não é cotação do Mercado Livre).` };
  const medidaAtual = chaveMedida(medidaVoz(ficha).medida);
  if (fv.medida && medidaAtual !== fv.medida) return { estado: "pendente", valor: null, texto: "Frete pendente — o peso ou as medidas mudaram depois da cotação: consulte de novo no Envio." };
  const simul = fv.origem === ORIGEM_FRETE.SIMULACAO ? " · SIMULAÇÃO (teste)" : "";
  const base = `Frete de venda do Mercado Livre: ${reais(fv.valor)} por envio (cotado em ${reais(fv.precoCotado)}, ${fv.faixaRotulo}${fv.pesoCobradoG ? `, peso cobrado ${fv.pesoCobradoG} g` : ""})${simul}.`;
  const p = Number(precoAlvo);
  if (p > 0 && faixaDoPreco(p) !== fv.faixa) return { estado: "outra_faixa", valor: fv.valor, texto: `${base} O preço ${reais(p)} está em outra faixa (${rotuloFaixa(p)}): consulte de novo.` };
  return { estado: "ok", valor: fv.valor, texto: base };
}
export const freteVendaUtilizavel = (s) => s && s.estado !== "pendente" && Number(s.valor) >= 0;
