// =============================================================
// PAIIA — Dados técnicos do anúncio com UMA fonte só (08/10/2026).
//
//  - Peso e medidas: digitados UMA vez (Novo Anúncio: Dados técnicos ou
//    cálculo de frete — os dois campos são o MESMO valor) → ficha →
//    Conferência (⑥ Peso e Embalagem) → Mercado Livre / Bling.
//    Novo Anúncio trabalha em kg e cm; a Conferência guarda em g e cm.
//    Conversão explícita: 0,350 kg = 350 g (nunca confunde g com kg).
//  - Tipo de veículo: ficha nova sem valor = "Carro/Caminhonete" (padrão);
//    valor salvo na ficha sempre vence; nunca vem do anúncio anterior.
//  - Edição feita no Novo Anúncio DEPOIS da Conferência é edição real:
//    a Conferência recebe o novo valor e avisa que o campo precisa ser
//    reconferido. Só abrir/carregar não muda nada.
// Funções puras (sem React, sem rede).
// =============================================================
import { TIPO_CARRO, normalizarTipoVeiculo } from "./tipoVeiculoAnuncio.js";

const txt = (v) => String(v ?? "").trim();

/** "0,350" | "0.35" | 0.35 → número (ou NaN). Aceita milhar com ponto + vírgula decimal. */
export function numeroBR(v) {
  if (typeof v === "number") return v;
  const t = txt(v).replace(/\s/g, "");
  if (!t) return NaN;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  return /^-?\d*\.?\d+$/.test(normal) ? Number(normal) : NaN;
}

/** kg (texto do Novo Anúncio) → g inteiro; inválido → 0. */
export function kgParaG(kg) {
  const n = numeroBR(kg);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : 0;
}

/** g → texto em kg com vírgula ("0,35"), sem zeros inúteis. */
export function gParaKgTexto(g) {
  const n = Number(g);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.round(n) / 1000).replace(".", ",");
}

function cm(v) {
  const n = numeroBR(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : 0;
}
const cmTexto = (n) => (Number(n) > 0 ? String(Number(n)).replace(".", ",") : "");

/**
 * Campos do Novo Anúncio { pesoFreteML (kg), alturaFreteML, larguraFreteML,
 * comprimentoFreteML (cm) } → medida da ficha { peso_g, comprimento_cm,
 * largura_cm, altura_cm } (todos > 0) ou null.
 */
export function medidaDoNovoAnuncio(e) {
  const m = {
    peso_g: kgParaG(e?.pesoFreteML),
    comprimento_cm: cm(e?.comprimentoFreteML),
    largura_cm: cm(e?.larguraFreteML),
    altura_cm: cm(e?.alturaFreteML),
  };
  return m.peso_g > 0 && m.comprimento_cm > 0 && m.largura_cm > 0 && m.altura_cm > 0 ? m : null;
}

/** Medida da ficha (g/cm) → campos do Novo Anúncio (kg/cm, texto). */
export function camposNovoAnuncioDaMedida(m) {
  if (!medidaCompletaFicha(m)) return null;
  return {
    pesoFreteML: gParaKgTexto(m.peso_g),
    comprimentoFreteML: cmTexto(m.comprimento_cm),
    larguraFreteML: cmTexto(m.largura_cm),
    alturaFreteML: cmTexto(m.altura_cm),
  };
}

export function medidaCompletaFicha(m) {
  return Boolean(m && ["peso_g", "comprimento_cm", "largura_cm", "altura_cm"].every((k) => Number(m[k]) > 0));
}

export function mesmaMedidaFicha(a, b) {
  if (!medidaCompletaFicha(a) || !medidaCompletaFicha(b)) return medidaCompletaFicha(a) === medidaCompletaFicha(b);
  return ["peso_g", "comprimento_cm", "largura_cm", "altura_cm"].every((k) => Math.abs(Number(a[k]) - Number(b[k])) < 0.05);
}

/** Texto "350 g · 20 × 10 × 10 cm" (unidade sempre explícita). */
export function textoMedida(m) {
  if (!medidaCompletaFicha(m)) return "—";
  const n = (v) => String(Number(v)).replace(".", ",");
  return `${n(m.peso_g)} g (${gParaKgTexto(m.peso_g)} kg) · ${n(m.comprimento_cm)} × ${n(m.largura_cm)} × ${n(m.altura_cm)} cm (C × L × A)`;
}

/** Tipo de veículo de uma ficha: o salvo; sem valor = padrão Carro/Caminhonete. */
export function tipoVeiculoDaFicha(salvo) {
  return normalizarTipoVeiculo(salvo) || TIPO_CARRO;
}

/**
 * Ao abrir a Conferência: o Novo Anúncio mudou tipo de veículo e/ou peso e
 * medidas DEPOIS do que a Conferência já tem?
 * anuncio: { tipoVeiculo, embalagem, edicoes: { tipoVeiculo, embalagem } (ISO) }
 * fichaSalva: { campos: { tipoVeiculo, logistica:{medida}, edicoesNovoAnuncio:{...} } } | null
 * Devolve { tipoVeiculo?, medida?, campos: ["tipo de veículo", "peso e medidas"], marcas }
 *  - sem Conferência (ficha nova): só preenche (não é "edição após aprovação").
 *  - com Conferência: só aplica o que foi editado no Novo Anúncio depois da
 *    última aplicação (marcas) e é diferente do que a Conferência tem.
 */
export function edicoesDoNovoAnuncio({ anuncio, fichaSalva }) {
  const ed = anuncio?.edicoes || {};
  const aplicadas = fichaSalva?.campos?.edicoesNovoAnuncio || {};
  const out = { campos: [], marcas: { ...aplicadas } };
  const tipoNA = normalizarTipoVeiculo(anuncio?.tipoVeiculo);
  const medidaNA = medidaCompletaFicha(anuncio?.embalagem) ? anuncio.embalagem : null;
  if (!fichaSalva) {
    const marcasPrec = marcasPrecificacaoNA(anuncio);
    if (marcasPrec.tipoAnuncio) out.marcas.tipoAnuncio = marcasPrec.tipoAnuncio;
    if (marcasPrec.preco) out.marcas.preco = marcasPrec.preco;
    if (tipoNA) out.tipoVeiculo = tipoNA;
    if (medidaNA) out.medida = medidaNA;
    if (ed.tipoVeiculo) out.marcas.tipoVeiculo = ed.tipoVeiculo;
    if (ed.embalagem) out.marcas.embalagem = ed.embalagem;
    return out;
  }
  const c = fichaSalva.campos || {};
  aplicarPrecificacaoDoNovoAnuncio({ anuncio, fichaSalva, ed, aplicadas, out });
  if (tipoNA && txt(ed.tipoVeiculo) && txt(ed.tipoVeiculo) > txt(aplicadas.tipoVeiculo)) {
    out.marcas.tipoVeiculo = ed.tipoVeiculo;
    if (tipoNA !== normalizarTipoVeiculo(c.tipoVeiculo)) {
      out.tipoVeiculo = tipoNA;
      out.campos.push("tipo de veículo");
    }
  }
  if (medidaNA && txt(ed.embalagem) && txt(ed.embalagem) > txt(aplicadas.embalagem)) {
    out.marcas.embalagem = ed.embalagem;
    if (!mesmaMedidaFicha(medidaNA, c.logistica?.medida)) {
      out.medida = medidaNA;
      out.campos.push("peso e medidas");
    }
  }
  return out;
}

// ---------------------------------------------------------------
// PRECIFICAÇÃO (19/10/2026): tipo de anúncio (Clássico/Premium) e preço
// final são escolhidos no NOVO ANÚNCIO (a Conferência não tem seletor de
// tipo). Antes, a Conferência dava prioridade à cópia que ELA guardou e
// ignorava a troca feita depois no Novo Anúncio, enquanto o registro de
// frete (freteML) seguia o mais recente: Publicação com "tipo de anúncio
// mudou (premium → classico)". Agora a troca feita no Novo Anúncio depois
// da Conferência é EDIÇÃO REAL (como peso/medidas e tipo de veículo): a
// Conferência recebe o valor novo e pede nova aprovação só desse campo.
// ---------------------------------------------------------------
export function normalizarTipoAnuncioNA(v) {
  const t = txt(v).toLowerCase();
  if (t === "premium" || t === "gold_pro") return "premium";
  if (t === "classico" || t === "clássico" || t === "gold_special") return "classico";
  return "";
}
const precoNumero = (v) => {
  const n = numeroBR(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
};
/**
 * Quando o Novo Anúncio definiu tipo e preço (ISO). Marca explícita
 * (edicoes.tipoAnuncio / edicoes.preco, gravada quando o usuário muda o
 * campo) ou, em fichas anteriores a esta regra, a hora da cotação de frete
 * feita no Novo Anúncio COM ESSE MESMO tipo/preço (prova de que foi uma
 * escolha do usuário, não um padrão). O tipo só é escolhido no Novo
 * Anúncio; o preço também pode ser editado na Conferência, por isso o
 * preço só usa a marca explícita.
 */
export function marcasPrecificacaoNA(anuncio) {
  const ed = anuncio?.edicoes || {};
  const f = anuncio?.freteML && typeof anuncio.freteML === "object" ? anuncio.freteML : null;
  const tipo = normalizarTipoAnuncioNA(anuncio?.tipoAnuncio);
  const preco = precoNumero(anuncio?.preco);
  const quando = txt(f?.calculado_em);
  const maior = (a, b) => (txt(a) > txt(b) ? txt(a) : txt(b));
  return {
    tipoAnuncio: tipo ? maior(ed.tipoAnuncio, f && quando && normalizarTipoAnuncioNA(f.tipoAnuncio) === tipo ? quando : "") : "",
    // Preço também é editável na Conferência: só a marca explícita conta.
    preco: preco ? txt(ed.preco) : "",
  };
}
function aplicarPrecificacaoDoNovoAnuncio({ anuncio, fichaSalva, aplicadas, out }) {
  const c = fichaSalva?.campos || {};
  const conf = fichaSalva?.anuncioConferido || null;
  const m = marcasPrecificacaoNA(anuncio);
  const tipoNA = normalizarTipoAnuncioNA(anuncio?.tipoAnuncio);
  if (tipoNA && m.tipoAnuncio && m.tipoAnuncio > txt(aplicadas.tipoAnuncio)) {
    out.marcas.tipoAnuncio = m.tipoAnuncio;
    const tipoConf = normalizarTipoAnuncioNA(c.tipoAnuncio) || normalizarTipoAnuncioNA(conf?.tipoAnuncio);
    const tipoAprovado = normalizarTipoAnuncioNA(conf?.tipoAnuncio);
    if (tipoNA !== tipoConf || (tipoAprovado && tipoNA !== tipoAprovado)) {
      out.tipoAnuncio = tipoNA;
      out.campos.push("tipo de anúncio");
    }
  }
  const precoNA = precoNumero(anuncio?.preco);
  if (precoNA && m.preco && m.preco > txt(aplicadas.preco)) {
    out.marcas.preco = m.preco;
    const precoConf = precoNumero(c.preco) || precoNumero(conf?.preco);
    const precoAprovado = precoNumero(conf?.preco);
    if (precoNA !== precoConf || (precoAprovado && precoNA !== precoAprovado)) {
      out.preco = String(anuncio.preco);
      out.campos.push("preço");
    }
  }
}

/** Nomes da assinatura da aprovação ligados a cada dado técnico. */
export const CAMPOS_ASSINATURA_TECNICOS = Object.freeze({
  "tipo de veículo": ["tipo de veículo"],
  "tipo de anúncio": ["tipo de anúncio"],
  "preço": ["preço"],
  "peso e medidas": ["peso de envio", "comprimento de envio", "largura de envio", "altura de envio", "peso e medidas confirmados", "peso/medidas"],
});
