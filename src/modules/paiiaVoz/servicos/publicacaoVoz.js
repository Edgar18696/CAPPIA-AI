// =============================================================
// PAIIA Voz — ETAPA 4 (02/11/2026): ponte da revisão aprovada no celular
// para a PUBLICAÇÃO EXISTENTE (RevisaoPublicacaoML). Não publica nada:
// monta a mesma "ficha aprovada" que a Conferência grava (anuncioConferido +
// assinatura), para a rotina atual de publicação conferir e publicar.
//   Testes: scripts/testes/paiiaVozPublicar.test.mjs
// Funções puras, sem rede.
// =============================================================

import { entradaDaFicha } from "./preparoConferenciaVoz.js";
import { montarRevisao } from "./revisaoCelularVoz.js";
import { marcaDasFotos } from "../../../services/fotosDaFicha.js";
import { padroesEsperadosConferencia } from "../../../services/padroesPublicacaoML.js";
import { ORIGEM_FRETE } from "../../../services/fretePrecificacao.js";
import { dimensoesParaApi, validarLimites } from "../../../services/logistica/logisticaMercadoLivre.js";

const txt = (v) => String(v ?? "").trim();

/** Registro de frete no formato da precificação (freteML), a partir da cotação OFICIAL do preparo. */
export function registroFreteDoPreparo(preparo) {
  const f = preparo?.verificacoes?.frete;
  const c = f?.cotacao;
  const p = f?.params;
  if (f?.estado !== "ok" || !c?.ok || !p?.conta || !p?.medida || !p?.modalidade) return null;
  if (c.origem !== ORIGEM_FRETE.ML) return null; // simulação/estimativa nunca servem para publicar
  return {
    versao: 1,
    ...p,
    origem: ORIGEM_FRETE.ML,
    origem_registro: "paiia_voz_preparo",
    calculado_em: c.cotado_em,
    base: null,
    margens: null,
    final: {
      preco: c.preco_cotado, preco_cotado: c.preco_cotado, faixa: c.faixa, faixa_rotulo: c.faixa_rotulo,
      custo_vendedor: c.custo_vendedor, frete_cheio: c.frete_cheio, desconto_pct: c.desconto_pct, peso_cobrado_g: c.peso_cobrado_g,
      origem: ORIGEM_FRETE.ML, cotado_em: c.cotado_em, consulta: c.consulta || null, status: c.status ?? null, exato: true,
    },
    peso_cobrado_g: c.peso_cobrado_g,
  };
}

/**
 * Monta a aprovação no formato da Conferência a partir da revisão APROVADA no celular.
 * @returns {{ ok, erro?, anuncioConferido, dados, conta, quantidade }}
 */
export function montarAprovacaoDoVoz(row, { agora = new Date().toISOString() } = {}) {
  const rev = montarRevisao(row);
  if (!rev.aprovada) return { ok: false, erro: rev.revisaoAnteriorInvalida ? "A ficha mudou depois da aprovação: revise e aprove de novo no celular." : "A revisão ainda não foi aprovada no celular." };
  const d = row?.dados_conferencia || {};
  const voz = d.paiia_voz || {};
  const preparo = voz.preparo;
  const e = entradaDaFicha(row);
  const decisao = preparo?.categoria?.decisao || null;
  const cat = decisao?.confirmada || null;
  if (!cat?.id) return { ok: false, erro: "Categoria não confirmada." };
  if (!e.medida) return { ok: false, erro: "Peso e medidas incompletos." };
  const freteML = registroFreteDoPreparo(preparo);
  if (!freteML) return { ok: false, erro: "Frete sem cotação oficial do Mercado Livre: confira de novo." };
  // A cotação oficial tem de ser da MESMA medida da ficha (é ela que vale como simulação do frete).
  const dim = dimensoesParaApi(e.medida);
  if (!dim || dimensoesParaApi(freteML.medida) !== dim) return { ok: false, erro: "Peso/medidas mudaram depois da cotação do frete: confira de novo." };
  const simulacao = { ok: true, origem: ORIGEM_FRETE.ML, dimensoes: dim, peso_considerado_g: freteML.final.peso_cobrado_g, custo_vendedor: freteML.final.custo_vendedor, modalidade: freteML.modalidade, simulado_em: freteML.calculado_em };
  const q = Number(e.quantidade);
  if (!(Number.isInteger(q) && q > 0)) return { ok: false, erro: "Estoque não informado." };
  const fotos = e.fotos;
  const aplicacoesDetalhadas = e.aplicacoes
    .filter((a) => txt(a.montadora) && txt(a.modelo))
    .map((a) => ({ montadora: txt(a.montadora), modelo: txt(a.modelo), motor: txt(a.motor), versao: txt(a.versao), anoInicio: txt(a.anoInicio), anoFim: txt(a.anoFim), origem: a.origem === "base" ? "base" : "manual", fonte: txt(a.fonte) || "PAIIA Voz" }));
  const anuncioConferido = {
    codigo: e.codigo,
    oem: "",
    titulo: e.titulo.slice(0, 60),
    preco: e.preco.toFixed(2),
    descricao: String(d.novo_anuncio?.descricao ?? ""),
    tipoAnuncio: e.tipoAnuncio,
    marca: e.marca,
    gtin: "",
    fotos,
    fotosFichaId: marcaDasFotos(row.id, fotos),
    categoria: txt(cat.caminho),
    categoriaId: txt(cat.id),
    categoriaDecisao: decisao,
    compatibilidades: "",
    tipoVeiculo: e.tipoVeiculo,
    nomePeca: e.titulo,
    quantidade: q,
    quantidadeConfirmada: true,
    aplicacoesDetalhadas,
    modelosSemDetalhes: [],
    dadosTecnicos: { funcao: "", fonteFuncao: "", especificacao: "", termoComercial: "" },
    condicao: "novo",
    semCompatibilidadeConfirmada: false,
    logistica: { medida: e.medida, confirmado: true, nivel: "CONFIRMADO_PELO_USUARIO", origem: "CONFIRMADO_PELO_USUARIO", modalidade: freteML.modalidade, config_embalagem: "dita_no_paiia_voz", validacao: validarLimites(e.medida, freteML.modalidade), simulacao },
    freteML,
    padroesML: padroesEsperadosConferencia(),
    origemAprovacao: "paiia_voz_celular",
  };
  const assinatura = `paiia_voz:${voz.revisao?.assinatura ? voz.revisao.em : agora}`;
  const dados = {
    ...d,
    versao: d.versao || 3,
    anuncio: { ...(d.anuncio || {}), ...anuncioConferido, imagens: fotos },
    ficha: {
      campos: {
        anuncioIdPAIIA: txt(row.id), codigo: e.codigo, sku: e.codigo, numeroPeca: e.codigo, titulo: anuncioConferido.titulo, preco: anuncioConferido.preco,
        descricao: anuncioConferido.descricao, marca: e.marca, tipoAnuncio: e.tipoAnuncio, tipoVeiculo: e.tipoVeiculo, tipoVeiculoOrigem: "manual",
        quantidadeEstoque: String(q), categoriaML: { id: cat.id, origem: "confirmada", caminho: cat.caminho }, categoriaDecisao: decisao,
        aplicacoesManuais: aplicacoesDetalhadas.filter((a) => a.origem === "manual"), modelosSemDetalhes: [], condicao: "novo",
        fotos, fotosFichaId: anuncioConferido.fotosFichaId, logistica: anuncioConferido.logistica, contaDestinoML: rev.dados.conta,
      },
      anuncioConferido,
      assinaturaAprovada: assinatura,
      etapa: "publicacao",
      origem: { aprovadoPor: "paiia_voz_celular", revisaoEm: voz.revisao?.em || agora },
    },
  };
  delete dados.etapa_fluxo;
  return { ok: true, anuncioConferido, dados, conta: rev.dados.conta, quantidade: q };
}
