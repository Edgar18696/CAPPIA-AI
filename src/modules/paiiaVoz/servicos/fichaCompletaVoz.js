// =============================================================
// PAIIA Voz — FICHA COMPLETA direto do Voz (Etapa 1, 02/11/2026).
//   Testes: scripts/testes/paiiaVozFichaCompleta.test.mjs
//
// Monta, a partir da ficha do Voz, os dados que a ficha da conta guarda
// além de código/título/descrição/preço/fotos: marca, estoque, tipo de
// veículo, peso/medidas e as aplicações CONFIRMADAS como dados estruturados.
// Funções puras, sem rede. Regras:
//  - nada é inventado: só o que foi dito/digitado ou confirmado da base;
//  - marca só quando dita (não presume Torken);
//  - estoque e preço só quando ditos;
//  - tipo de veículo só pelo que foi dito nas aplicações confirmadas
//    (ex.: "ônibus") ou pela regra oficial sugestaoPorAplicacoes;
//  - o que faltar vira PENDÊNCIA (o Voz pergunta; nada é preenchido sozinho).
// =============================================================

import { codigoPrincipal, formatarValor, ROTULOS } from "./fichaVoz.js";
import { interpretarFala } from "./interpretarFala.js";
import { estadoRapido, pesoMedidasParaEnvio } from "./rascunhoRapido.js";
import { sugestaoPorAplicacoes, TIPO_CARRO, TIPO_PESADA } from "../../../services/tipoVeiculoAnuncio.js";

const txt = (v) => String(v ?? "").trim();
const semAcento = (v) => txt(v).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const numero = (v) => {
  const t = txt(v);
  if (!t) return NaN;
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
};

// Tipo dito na aplicação (conversaVoz) → tipo do anúncio. Ambíguos (van, utilitário) não decidem.
const TIPO_FALADO = {
  onibus: TIPO_PESADA, "micro-onibus": TIPO_PESADA, caminhao: TIPO_PESADA, carreta: TIPO_PESADA, "cavalo mecanico": TIPO_PESADA,
  carro: TIPO_CARRO, picape: TIPO_CARRO, caminhonete: TIPO_CARRO,
};

/**
 * Aplicações CONFIRMADAS do Voz no formato das aplicações da Conferência
 * (uma linha por modelo). Origem: "manual" (dita pelo usuário) ou "base" (base/catálogo).
 */
export function aplicacoesEstruturadasVoz(ficha) {
  const saida = [];
  for (const a of ficha?.aplicacoes || []) {
    if (!a?.confirmada) continue;
    const modelos = (a.modelos || []).map(txt).filter(Boolean);
    if (!modelos.length) continue;
    for (const modelo of modelos) {
      saida.push({
        montadora: txt(a.montadora),
        modelo,
        motor: (a.motores || []).map(txt).filter(Boolean).join(" / "),
        versao: "",
        anoInicio: a.anoInicio ? String(a.anoInicio) : "",
        anoFim: a.anoFim ? String(a.anoFim) : "",
        tipoVeiculo: txt(a.tipoVeiculo),
        origem: a.origem === "usuario" ? "manual" : "base",
        fonte: a.origem === "usuario" ? "PAIIA Voz" : (a.fontes || []).map(txt).filter(Boolean).join(" · ") || "Base PAIIA",
      });
    }
  }
  return saida;
}

/** Tipo de veículo do anúncio: { valor, origem: "falado"|"aplicacoes"|"", texto }. */
export function tipoVeiculoVoz(ficha, aplicacoes = aplicacoesEstruturadasVoz(ficha)) {
  if (!aplicacoes.length) return { valor: "", origem: "", texto: "Sem aplicação confirmada: diga o tipo (carro ou linha pesada) ou confirme uma aplicação." };
  const falados = new Set();
  const semTipo = [];
  for (const a of aplicacoes) {
    const t = TIPO_FALADO[semAcento(a.tipoVeiculo)];
    if (t) falados.add(t);
    else semTipo.push(a);
  }
  if (falados.size > 1) return { valor: "", origem: "", texto: "As aplicações misturam carro e linha pesada: confirme o tipo de veículo." };
  const sugestao = semTipo.length ? sugestaoPorAplicacoes(semTipo) : "";
  if (falados.size === 1) {
    const valor = [...falados][0];
    if (semTipo.length && sugestao && sugestao !== valor) return { valor: "", origem: "", texto: "As aplicações apontam tipos diferentes: confirme o tipo de veículo." };
    return { valor, origem: "falado", texto: `${valor} (dito nas aplicações).` };
  }
  if (sugestao) return { valor: sugestao, origem: "aplicacoes", texto: `${sugestao} (pelas aplicações confirmadas).` };
  return { valor: "", origem: "", texto: "Não deu para saber o tipo pelas aplicações: diga carro ou linha pesada." };
}

/** Peso/medidas ditos → { medida (g/cm) completa ou null, parcial, texto, duvidas }. */
export function medidaVoz(ficha) {
  const pm = pesoMedidasParaEnvio(ficha);
  if (!pm) return { medida: null, parcial: false, texto: "", duvidas: [] };
  const c = pm.campos || {};
  const m = {
    peso_g: Math.round(numero(c.pesoFreteML) * 1000),
    comprimento_cm: numero(c.comprimentoFreteML),
    largura_cm: numero(c.larguraFreteML),
    altura_cm: numero(c.alturaFreteML),
  };
  const completa = ["peso_g", "comprimento_cm", "largura_cm", "altura_cm"].every((k) => Number(m[k]) > 0);
  return { medida: completa ? m : null, parcial: !completa, texto: pm.texto || "", duvidas: pm.duvidas || [] };
}

/**
 * Tudo o que a ficha da conta recebe do Voz + pendências.
 * @returns {{ marca, quantidade, preco, tipoVeiculo, tipoVeiculoOrigem, medida, aplicacoes, pendencias[], completa }}
 */
export function dadosCompletosVoz(ficha, { fotos = 0 } = {}) {
  const r = estadoRapido(ficha);
  const campos = ficha?.campos || {};
  const marca = txt(campos.marca?.valor);
  const q = Number(campos.quantidade?.valor);
  const quantidade = Number.isInteger(q) && q > 0 ? String(q) : "";
  const p = Number(campos.preco?.valor);
  const preco = Number.isFinite(p) && p > 0 ? p.toFixed(2).replace(".", ",") : "";
  const aplicacoes = aplicacoesEstruturadasVoz(ficha);
  const tipo = tipoVeiculoVoz(ficha, aplicacoes);
  const med = medidaVoz(ficha);
  const naoConferidas = (ficha?.aplicacoes || []).filter((a) => !a.confirmada).length;

  const pendencias = [];
  if (!codigoPrincipal(ficha)) pendencias.push("Código/SKU: diga ou fotografe o código da peça.");
  if (!fotos) pendencias.push("Fotos: tire ao menos uma foto da peça.");
  if (!r.titulo.valor) pendencias.push("Título: ainda não definido.");
  if (!marca) pendencias.push("Marca: diga a marca (ex.: \"marca Torken\") — o PAIIA não presume.");
  if (!preco) pendencias.push("Preço: diga o preço de venda.");
  if (!quantidade) pendencias.push("Estoque: diga a quantidade.");
  if (!tipo.valor) pendencias.push(`Tipo de veículo: ${tipo.texto}`);
  if (!med.medida) pendencias.push(med.parcial ? `Peso e medidas incompletos (${med.texto}): diga o que falta.` : "Peso e medidas da embalagem: diga peso e C × L × A.");
  if (!aplicacoes.length) pendencias.push("Aplicações: nenhuma confirmada (nada é inventado).");
  if (naoConferidas) pendencias.push(`${naoConferidas} aplicação(ões) ainda não conferida(s): ficam de fora.`);
  for (const d of med.duvidas) pendencias.push(`Peso/medidas: ${d}`);

  return {
    marca, quantidade, preco,
    tipoVeiculo: tipo.valor, tipoVeiculoOrigem: tipo.origem,
    medida: med.medida,
    aplicacoes,
    pendencias,
    completa: pendencias.filter((x) => !/^\d+ aplicação\(ões\) ainda não conferida/.test(x)).length === 0,
  };
}

const CAMPOS_DA_FICHA = ["marca", "preco", "custo", "quantidade"];
/**
 * (02/11/2026) Frase do anúncio rápido que é SÓ de campos ("marca Torken preço 97,92
 * quantidade 10") → { interpretacao, resumo } para gravar nos campos; senão null
 * (a frase segue para a descrição, como antes). Nada é deduzido: só o que foi dito.
 */
export function camposDitosNaFala(texto) {
  const r = interpretarFala(texto);
  const itens = r.itens.filter((i) => CAMPOS_DA_FICHA.includes(i.campo));
  if (!itens.length || itens.length !== r.itens.length || r.naoEntendido.length) return null;
  return {
    interpretacao: { itens, naoEntendido: [], avisos: r.avisos },
    resumo: itens.map((i) => `${ROTULOS[i.campo] || i.campo}: ${formatarValor(i.campo, i.valor)}`).join(" · "),
  };
}
