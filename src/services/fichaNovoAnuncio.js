// =============================================================
// PAIIA — Ficha persistente DURANTE o Novo Anúncio (funções puras).
// Testes: scripts/testes/fichaNovoAnuncio.test.mjs
//
// - Assim que há dados para identificar o anúncio (código/OEM + algum
//   conteúdo), a ficha é criada na base (paiia_anuncios, status "rascunho")
//   e o PAIIA passa a trabalhar sempre nessa MESMA ficha (ficha_id).
// - O Novo Anúncio grava em dados_conferencia.novo_anuncio e na origem do
//   anúncio (dados_conferencia.anuncio). NUNCA toca na ficha da Conferência
//   (ficha), no registro do Bling (integracao_bling), na decisão da Base
//   PAIIA (base_paiia) nem na versão da Conferência (salvo_em).
// - Salvar a ficha operacional NÃO cria anúncio no ML, produto no Bling nem
//   registro na base de conhecimento.
// =============================================================

import { medidaDoNovoAnuncio, camposNovoAnuncioDaMedida, medidaCompletaFicha, tipoVeiculoDaFicha } from "./dadosTecnicosAnuncio.js";
import { normalizarTipoVeiculo } from "./tipoVeiculoAnuncio.js";

export const CHAVE_FICHA_NOVO_ANUNCIO = "paiiaFichaNovoAnuncio";
export const ETAPA_NOVO_ANUNCIO = "novo_anuncio";
const RE_ID = /^[0-9a-f-]{36}$/i;

const txt = (v) => String(v ?? "").trim();
export const idFichaValido = (id) => RE_ID.test(txt(id));
export const normalizarCodigoFicha = (v) => txt(v).toUpperCase().replace(/[^A-Z0-9]/g, "");

function urlFoto(f) {
  const u = typeof f === "string" ? f : f?.imagem_processada || f?.imagem_original || f?.url || f?.src || "";
  return /^https?:\/\//i.test(String(u || "")) ? String(u) : "";
}
const numero = (v) => {
  const t = txt(v);
  if (!t) return NaN;
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
};

/** Há informação suficiente para existir uma ficha? (código/OEM + algum conteúdo) */
export function podeCriarFicha(e) {
  const x = e || {};
  if (!txt(x.codigo) && !txt(x.oem)) return false;
  return Boolean(
    txt(x.titulo) || txt(x.descricao) || txt(x.preco) || x.pecaEncontrada ||
    (Array.isArray(x.fotos) && x.fotos.some((f) => urlFoto(f)))
  );
}

/** Ficha completa para seguir à Conferência (mesmas exigências do "Continuar"). */
export function fichaCompleta(e) {
  const x = e || {};
  const p = numero(x.preco);
  return Boolean(
    (txt(x.codigo) || txt(x.oem)) && txt(x.titulo) && txt(x.descricao) && Number.isFinite(p) && p > 0 &&
    Array.isArray(x.fotos) && x.fotos.some((f) => urlFoto(f))
  );
}

function pecaLeve(p) {
  if (!p || typeof p !== "object") return null;
  const aplicacoes = (Array.isArray(p.aplicacoes) ? p.aplicacoes : []).slice(0, 400).map((a) => ({
    montadora: a?.montadora ?? "", modelo: a?.modelo ?? a?.veiculo ?? "", motor: a?.motor ?? "",
    versao: a?.versao ?? "", ano_inicio: a?.ano_inicio ?? a?.anoInicial ?? "", ano_fim: a?.ano_fim ?? a?.anoFinal ?? "",
    combustivel: a?.combustivel ?? "", observacao: a?.observacao ?? "",
  }));
  return {
    peca: p.peca || "", familia: p.familia || "", fabricante: p.fabricante || p.marca || "", marca: p.marca || p.fabricante || "",
    codigo_oem: p.codigo_oem || "", codigo_equivalente: p.codigo_equivalente || "",
    categoria_id: p.categoria_id || "", categoria_nome: p.categoria_nome || p.categoria_caminho || p.categoria || "",
    fonte: p.fonte || p.origem || "",
    aplicacoes,
  };
}

/**
 * O que o Novo Anúncio grava na ficha (sem imagens embutidas, sem blob:).
 * estado: { codigo, oem, titulo, descricao, preco, tipoAnuncio, pecaEncontrada,
 *   fotos, clip, canalVenda, categoriaConcorrencia, precificacao:{...}, embalagem:{...} }
 */
export function montarNovoAnuncioParaFicha(estado, fichaId = "") {
  const e = estado || {};
  const fotos = (Array.isArray(e.fotos) ? e.fotos : []).map(urlFoto).filter(Boolean);
  const peca = pecaLeve(e.pecaEncontrada);
  // Dados técnicos (UMA fonte): tipo de veículo e peso/medidas em g/cm.
  const tipoVeiculo = normalizarTipoVeiculo(e.tipoVeiculo);
  const medida = medidaDoNovoAnuncio(e.embalagem);
  const edicoes = e.edicoes && typeof e.edicoes === "object" ? { ...e.edicoes } : {};
  const anuncio = {
    codigo: txt(e.codigo), oem: txt(e.oem), titulo: txt(e.titulo), descricao: String(e.descricao ?? ""),
    preco: txt(e.preco), tipoAnuncio: txt(e.tipoAnuncio) || "classico",
    pecaEncontrada: peca, fabricante: peca?.fabricante || "", marca: peca?.marca || "",
    aplicacoes: peca?.aplicacoes || [], fotos, imagens: fotos, clip: urlFoto(e.clip) || "",
    ...(tipoVeiculo ? { tipoVeiculo } : {}),
    ...(medida ? { embalagem: medida } : {}),
    ...(Object.keys(edicoes).length ? { edicoes } : {}),
    ...(idFichaValido(fichaId) ? { fichaIdPAIIA: txt(fichaId) } : {}),
  };
  return {
    anuncio,
    novo_anuncio: {
      codigo: anuncio.codigo, oem: anuncio.oem, titulo: anuncio.titulo, descricao: anuncio.descricao,
      preco: anuncio.preco, tipoAnuncio: anuncio.tipoAnuncio, pecaEncontrada: peca, fotos, clip: anuncio.clip,
      nomePeca: peca?.peca || "", marca: peca?.marca || "", categoria: peca?.categoria_nome || "",
      canalVenda: txt(e.canalVenda), categoriaConcorrencia: txt(e.categoriaConcorrencia),
      precificacao: e.precificacao && typeof e.precificacao === "object" ? { ...e.precificacao } : null,
      embalagem: e.embalagem && typeof e.embalagem === "object" ? { ...e.embalagem } : null,
      tipoVeiculo,
      medida,
      edicoes,
      completa: fichaCompleta({ ...anuncio, fotos }),
    },
  };
}

/**
 * Mescla o Novo Anúncio nos dados que JÁ estão na ficha.
 * Preserva tudo o que é de outras etapas (ficha da Conferência, Bling,
 * Base PAIIA, versão). Antes da Conferência marca etapa_fluxo "novo_anuncio".
 */
export function mesclarNovoAnuncio(dadosAtuais, montado, agora = new Date().toISOString()) {
  const atual = dadosAtuais && typeof dadosAtuais === "object" ? dadosAtuais : {};
  const temConferencia = Boolean(atual.ficha && (atual.ficha.campos || atual.ficha.anuncioConferido));
  const saida = {
    ...atual,
    versao: atual.versao || 3,
    anuncio: { ...(atual.anuncio || {}), ...(montado?.anuncio || {}) },
    novo_anuncio: { ...(montado?.novo_anuncio || {}), salvo_em: agora },
  };
  if (!temConferencia) saida.etapa_fluxo = ETAPA_NOVO_ANUNCIO;
  else delete saida.etapa_fluxo;
  return saida;
}

/** Ficha que já não aceita gravação do Novo Anúncio (publicada/cancelada/publicando). */
export function fichaFechada(row) {
  const pub = row?.publicacao || null;
  return Boolean(txt(pub?.mlb_id)) || ["publicado", "publicado_com_pendencia"].includes(pub?.status_publicacao) ||
    ["publicando", "publicado", "publicado_com_pendencia", "cancelado"].includes(row?.status_fluxo);
}

/**
 * Rascunho do navegador a partir da ficha da base (abrir ?ficha=<id> em
 * outro computador/navegador, ou a cópia local é mais antiga).
 */
export function rascunhoDaFicha(row) {
  const d = row?.dados_conferencia || {};
  const na = d.novo_anuncio || null;
  const a = d.anuncio || {};
  const fonte = na || a;
  if (!fonte || (!txt(fonte.codigo) && !txt(fonte.oem) && !txt(row?.codigo))) return null;
  const fotos = (Array.isArray(fonte.fotos) ? fonte.fotos : Array.isArray(a.fotos) ? a.fotos : []).map(urlFoto).filter(Boolean);
  return {
    fichaId: txt(row?.id),
    codigo: txt(fonte.codigo) || txt(row?.codigo), oem: txt(fonte.oem), titulo: txt(fonte.titulo) || txt(row?.titulo),
    descricao: String(fonte.descricao ?? ""), preco: txt(fonte.preco), tipoAnuncio: txt(fonte.tipoAnuncio) || "classico",
    pecaEncontrada: fonte.pecaEncontrada || a.pecaEncontrada || null,
    fotos: fotos.map((u, i) => ({ imagem_processada: u, imagem_original: "", ordem: i, capa: i === 0 })),
    clip: txt(fonte.clip),
    canalVenda: txt(na?.canalVenda), categoriaConcorrencia: txt(na?.categoriaConcorrencia),
    ...(na?.precificacao || {}), ...(na?.embalagem || {}),
    ...dadosTecnicosDaFicha(d),
    rascunhoLeve: 1,
    salvoNaBaseEm: txt(na?.salvo_em || row?.updated_at),
  };
}

/**
 * Tipo de veículo e peso/medidas que o Novo Anúncio mostra ao reabrir:
 * o valor MAIS RECENTE da MESMA ficha (Conferência gravada depois do Novo
 * Anúncio vence; senão o do Novo Anúncio). Ficha sem tipo = Carro/Caminhonete.
 */
export function dadosTecnicosDaFicha(d) {
  const na = d?.novo_anuncio || {};
  const campos = d?.ficha?.campos || {};
  const conferenciaDepois = Boolean(d?.ficha) && txt(d?.salvo_em) > txt(na.salvo_em);
  const tipoConf = normalizarTipoVeiculo(campos.tipoVeiculo);
  const tipoNA = normalizarTipoVeiculo(na.tipoVeiculo);
  const tipo = (conferenciaDepois ? tipoConf || tipoNA : tipoNA || tipoConf) || "";
  const medidaConf = medidaCompletaFicha(campos.logistica?.medida) ? campos.logistica.medida : null;
  const medidaNA = medidaCompletaFicha(na.medida) ? na.medida : medidaDoNovoAnuncio(na.embalagem);
  const medida = conferenciaDepois ? medidaConf || medidaNA : medidaNA || medidaConf;
  return {
    tipoVeiculo: tipoVeiculoDaFicha(tipo),
    ...(medida ? camposNovoAnuncioDaMedida(medida) : {}),
    edicoes: na.edicoes && typeof na.edicoes === "object" ? { ...na.edicoes } : {},
  };
}

/** A ficha está ainda só no Novo Anúncio (sem Conferência)? */
export function fichaSoNoNovoAnuncio(row) {
  const d = row?.dados_conferencia || {};
  return d.etapa_fluxo === ETAPA_NOVO_ANUNCIO && !(d.ficha && (d.ficha.campos || d.ficha.anuncioConferido));
}

/** Assinatura do que seria gravado (evita gravação repetida igual). */
export function assinaturaNovoAnuncio(montado) {
  return JSON.stringify([montado?.anuncio, { ...(montado?.novo_anuncio || {}), salvo_em: undefined }]);
}
