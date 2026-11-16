// =============================================================
// PAIIA — PRODUTO JÁ EXISTENTE pelo SKU (16/11/2026). Somente leitura.
//
// Caso real: SKU 7527362 (Flange Tampa de Combustível) já trabalhado, já no
// Bling e anunciado no ML. Tocar em "Buscar" tratava como peça NOVA: apagava
// título/descrição e pesquisava de novo. Agora:
//   1) antes de pesquisar, as fichas PAIIA deste código são lidas (base
//      interna); havendo ficha, NADA é apagado nem pesquisado sem você pedir;
//   2) "Ver as 3 contas" junta (somente leitura) Bling + registro de MLBs +
//      busca ao vivo no ML de cada conta (SKU do anúncio e das VARIAÇÕES) +
//      fichas, e mostra LOJA ONLINE, CIEBR e REVELAÇÃO com os seus MLBs;
//   3) MLB só conta para o SKU se o PRÓPRIO anúncio no ML tem este SKU.
//      MLB registrado/gravado cujo anúncio tem OUTRO SKU (ex.: o parafuso
//      gravado na flange) aparece separado e NUNCA é usado;
//   4) conta sem anúncio → aproveitar os dados da ficha existente (cópia sem
//      MLB/Bling da outra conta). O Bling é reaproveitado pelo SKU na
//      Publicação: nada é cadastrado de novo.
// Nada aqui grava no ML, no Bling ou na base.
// =============================================================
import { ESTADO_RECONHECIMENTO } from "./reconhecimentoSKU.js";
import { nomeContaPublicacao } from "./contasPublicacaoML.js";
import { normalizarCodigoComparacao, skusDoAnuncio } from "./duplicidadeML.js";
import { situacaoDoItemML } from "./registroMLB.js";

/** Ordem de exibição pedida: LOJA ONLINE, CIEBR, REVELAÇÃO. */
export const ORDEM_CONTAS_QUADRO = Object.freeze(["1729335019", "824312524", "2412238242"]);

export const ESTADO_QUADRO = Object.freeze({
  ANUNCIADA: "anunciada",
  EM_ANDAMENTO: "em_andamento",
  DISPONIVEL: "disponivel",
  CONFERIR: "conferir",
  INCOMPLETA: "incompleta",
});

const txt = (v) => String(v ?? "").trim();
const idConta = (v) => txt(v).replace(/\D/g, "");
const MLB = (v) => {
  const t = txt(v).toUpperCase();
  return /^MLB\d{6,}$/.test(t) ? t : "";
};
const PUBLICADOS = ["publicado", "publicado_com_pendencia", "publicando"];

// -------------------------------------------------------------
// (16/11) FICHA SALVA × ANÚNCIO CONFIRMADO. Um MLB gravado numa ficha só vale como anúncio
// deste SKU depois de o PRÓPRIO anúncio ser lido no ML, na conta da ficha, com o SKU do
// anúncio OU de uma VARIAÇÃO igual ao código. Caso real: CIEBR, ficha com MLB7998291430.
// -------------------------------------------------------------
export const IDENTIDADE = Object.freeze({
  CONFIRMADO: "confirmado",
  OUTRO_SKU: "outro_sku",
  SEM_SKU: "sem_sku",
  OUTRA_CONTA: "outra_conta",
  NAO_LIDO: "nao_lido",
});

/** MLBs gravados nas fichas (publicação ou registro do Bling), com a conta de cada um. */
export function mlbsDasFichas(fichas = []) {
  const out = new Map();
  for (const f of fichasExistentes(fichas)) {
    const conta = idConta(f.publicacao?.ml_user_id || f.conta_destino_ml_user_id);
    for (const m of [f.publicacao?.mlb_id, f.integracao_bling?.mlb].map(MLB).filter(Boolean)) {
      if (!out.has(m)) out.set(m, { mlb: m, conta, ficha: txt(f.id) });
    }
  }
  return [...out.values()];
}

/** SKU de cada variação do anúncio (id da variação + SKUs). */
function skusDasVariacoes(item) {
  const valor = (lista, id) => (Array.isArray(lista) ? lista : []).find((a) => a?.id === id)?.value_name || "";
  return (Array.isArray(item?.variations) ? item.variations : []).map((v) => ({
    id: txt(v?.id),
    skus: [v?.seller_custom_field, valor(v?.attributes, "SELLER_SKU"), valor(v?.attribute_combinations, "SELLER_SKU")].map(txt).filter(Boolean),
  }));
}

/**
 * Identidade REAL de um MLB lido no ML (resp = ml_consulta GET /items/<MLB> na conta da ficha).
 * → { mlb, conta, tipo, onde, skus, variacoes, status, situacao, titulo, vendedor, motivo }
 */
export function identidadeMLB({ mlb, conta, sku, resp }) {
  const m = MLB(mlb);
  const base = { mlb: m, conta: idConta(conta), skus: [], variacoes: [], status: "", situacao: "", titulo: "", vendedor: "", onde: "" };
  if (!resp || resp.ok !== true || !resp.dados?.id) return { ...base, tipo: IDENTIDADE.NAO_LIDO, motivo: `não foi possível ler no Mercado Livre (${txt(resp?.erro) || "sem resposta"})` };
  const it = resp.dados;
  const r = { ...base, status: txt(it.status), situacao: situacaoDoItemML(it), titulo: txt(it.title).slice(0, 90), vendedor: idConta(it.seller_id), variacoes: skusDasVariacoes(it), skus: skusDoAnuncio(it) };
  if (MLB(it.id) !== m) return { ...r, tipo: IDENTIDADE.NAO_LIDO, motivo: "o Mercado Livre devolveu outro anúncio" };
  if (r.vendedor !== r.conta) return { ...r, tipo: IDENTIDADE.OUTRA_CONTA, motivo: `pertence ao vendedor ${r.vendedor} (${nomeContaPublicacao(r.vendedor)}), não a ${nomeContaPublicacao(r.conta)}` };
  const alvo = normalizarCodigoComparacao(sku);
  const doAnuncio = skusDoAnuncio({ ...it, variations: [] });
  if (doAnuncio.some((s) => normalizarCodigoComparacao(s) === alvo)) return { ...r, tipo: IDENTIDADE.CONFIRMADO, onde: "anúncio", motivo: "" };
  const v = r.variacoes.find((x) => x.skus.some((s) => normalizarCodigoComparacao(s) === alvo));
  if (v) return { ...r, tipo: IDENTIDADE.CONFIRMADO, onde: `variação ${v.id}`, motivo: "" };
  if (!r.skus.length) return { ...r, tipo: IDENTIDADE.SEM_SKU, motivo: `o anúncio não tem SKU gravado (nem nas ${r.variacoes.length} variações)` };
  return { ...r, tipo: IDENTIDADE.OUTRO_SKU, motivo: `o anúncio tem o SKU ${[...new Set(r.skus)].join(" / ")}, não ${txt(sku)}` };
}

/**
 * Lê no ML (somente leitura, na conta de cada ficha) os MLBs gravados nas fichas que a busca
 * por SKU não confirmou. consultarML(conta, caminho) → ml_consulta GET. Nunca lança.
 */
export async function identidadesDasFichas({ codigo, fichas = [], reconhecimento = null, consultarML }) {
  // Confirmado pela busca NA MESMA CONTA da ficha (MLB de outra conta gravado nesta ficha é lido e apontado).
  const jaConfirmados = new Set((reconhecimento?.contas || []).flatMap((c) => (c.anuncios || []).filter((a) => !a.divergente).map((a) => `${idConta(c.conta)}:${MLB(a.mlb)}`)));
  const out = [];
  for (const x of mlbsDasFichas(fichas)) {
    if (jaConfirmados.has(`${x.conta}:${x.mlb}`) || !x.conta) continue;
    let resp;
    try { resp = await consultarML(x.conta, `/items/${x.mlb}`); } catch (e) { resp = { ok: false, erro: txt(e?.message || e) }; }
    out.push({ ...identidadeMLB({ mlb: x.mlb, conta: x.conta, sku: codigo, resp }), ficha: x.ficha });
  }
  return out;
}

/** Fichas deste código que contam (não canceladas, nem a ficha aberta agora). */
export function fichasExistentes(anuncios = [], fichaAtualId = "") {
  return (Array.isArray(anuncios) ? anuncios : []).filter((a) => a && a.status_fluxo !== "cancelado" && txt(a.id) && txt(a.id) !== txt(fichaAtualId));
}

/** A ficha de onde os dados são aproveitados: a publicada com MLB confirmado; senão a mais recente. */
export function fichaFonte(fichas = [], mlbsConfirmados = new Set()) {
  const lista = Array.isArray(fichas) ? fichas : [];
  const publicada = lista.find((f) => mlbsConfirmados.has(MLB(f.publicacao?.mlb_id)));
  if (publicada) return { id: txt(publicada.id), publicada: true, mlb: MLB(publicada.publicacao.mlb_id), conta: idConta(publicada.publicacao.ml_user_id) };
  const recente = [...lista].sort((a, b) => txt(b.updated_at).localeCompare(txt(a.updated_at)))[0];
  return recente ? { id: txt(recente.id), publicada: false, mlb: "", conta: idConta(recente.publicacao?.ml_user_id || recente.conta_destino_ml_user_id) } : null;
}

/**
 * Quadro das 3 contas.
 * fichas: listarAnunciosDoCodigo().anuncios (com publicacao)
 * reconhecimento: reconhecerSKU() (pode ser null: só as fichas, sem ML/Bling)
 */
export function quadroProdutoExistente({ fichas = [], reconhecimento = null } = {}) {
  const lista = fichasExistentes(fichas);
  const contasRec = new Map((reconhecimento?.contas || []).map((c) => [idConta(c.conta), c]));
  const confirmados = new Set();
  const linhas = ORDEM_CONTAS_QUADRO.map((conta) => {
    const nome = nomeContaPublicacao(conta);
    const rc = contasRec.get(conta) || null;
    // Só MLB cujo anúncio no ML tem ESTE SKU (busca por SKU/variações ou registro sem divergência).
    const anuncios = (rc?.anuncios || []).filter((a) => MLB(a.mlb) && !a.divergente).map((a) => ({ mlb: MLB(a.mlb), status: txt(a.status || a.situacao), registrado: Boolean(a.registrado) }));
    for (const a of anuncios) confirmados.add(a.mlb);
    const outraPeca = (rc?.anuncios || []).filter((a) => a.divergente).map((a) => ({ mlb: MLB(a.mlb), motivo: "o anúncio no Mercado Livre tem OUTRO SKU (não é desta peça)" }));
    const possiveis = (rc?.possiveis || []).map((p) => ({ mlb: MLB(p.mlb), motivo: txt(p.motivo) || "mesmo código no título/número da peça, SKU diferente" }));
    const fichasConta = lista.filter((f) => idConta(f.publicacao?.ml_user_id || f.conta_destino_ml_user_id) === conta);
    // (16/11) MLB gravado numa FICHA desta conta: só conta como anúncio depois de LIDO no ML
    // (identidade real, inclusive SKU das variações). Ficha salva ≠ anúncio confirmado.
    const identidades = (reconhecimento?.identidades || []).filter((i) => idConta(i.conta) === conta);
    const naoConfirmados = [];
    const historico = [];
    for (const x of mlbsDasFichas(lista).filter((y) => y.conta === conta)) {
      if (anuncios.some((a) => a.mlb === x.mlb) || outraPeca.some((o) => o.mlb === x.mlb)) continue;
      const id = identidades.find((i) => i.mlb === x.mlb);
      if (!id) {
        naoConfirmados.push({ mlb: x.mlb, ficha: x.ficha, motivo: "gravado na ficha; o anúncio ainda não foi lido no Mercado Livre" });
      } else if (id.tipo === IDENTIDADE.CONFIRMADO && ["encerrado", "excluido"].includes(id.situacao)) {
        historico.push({ mlb: x.mlb, ficha: x.ficha, motivo: `anúncio deste SKU, mas ${id.situacao} no Mercado Livre (histórico)` });
      } else if (id.tipo === IDENTIDADE.CONFIRMADO) {
        anuncios.push({ mlb: x.mlb, status: id.status, registrado: false, daFicha: true, onde: id.onde });
        confirmados.add(x.mlb);
      } else if (id.tipo === IDENTIDADE.OUTRO_SKU || id.tipo === IDENTIDADE.OUTRA_CONTA) {
        outraPeca.push({ mlb: x.mlb, ficha: x.ficha, motivo: id.motivo, titulo: id.titulo });
      } else {
        naoConfirmados.push({ mlb: x.mlb, ficha: x.ficha, motivo: id.motivo, titulo: id.titulo });
      }
    }
    const andamento = fichasConta.find((f) => !MLB(f.publicacao?.mlb_id) && !PUBLICADOS.includes(f.status_fluxo));
    let estado;
    if (anuncios.length) estado = ESTADO_QUADRO.ANUNCIADA;
    // MLB da ficha sem confirmação (sem SKU, não lido): confira antes — nunca "disponível" (não duplica).
    else if (naoConfirmados.length) estado = ESTADO_QUADRO.CONFERIR;
    else if (rc?.estado === ESTADO_RECONHECIMENTO.INCOMPLETA || (reconhecimento && !rc)) estado = ESTADO_QUADRO.INCOMPLETA;
    else if (andamento) estado = ESTADO_QUADRO.EM_ANDAMENTO;
    else if (possiveis.length) estado = ESTADO_QUADRO.CONFERIR;
    else if (!reconhecimento) estado = ESTADO_QUADRO.INCOMPLETA; // sem a leitura do ML não se afirma "disponível"
    else estado = ESTADO_QUADRO.DISPONIVEL;
    return {
      conta, nome, estado, anuncios, outraPeca, possiveis, naoConfirmados, historico,
      fichaAndamento: andamento ? txt(andamento.id) : "",
      motivo: estado === ESTADO_QUADRO.INCOMPLETA ? (txt(rc?.motivo) || (reconhecimento ? "conta não conferida" : "anúncios do Mercado Livre ainda não lidos")) : "",
    };
  });
  const fonte = fichaFonte(lista, confirmados);
  const bling = reconhecimento?.bling || null;
  return {
    linhas,
    fonte,
    fichas: lista.map((f) => ({ id: txt(f.id), status: txt(f.status_fluxo), titulo: txt(f.titulo), conta: idConta(f.publicacao?.ml_user_id || f.conta_destino_ml_user_id), mlb: MLB(f.publicacao?.mlb_id), atualizada: txt(f.updated_at) })),
    bling: bling ? { estado: bling.estado, produto: bling.produto || null, motivo: txt(bling.motivo) } : null,
    existe: lista.length > 0 || confirmados.size > 0 || bling?.estado === ESTADO_RECONHECIMENTO.ENCONTRADO,
  };
}

/**
 * O que fazer numa conta do quadro (sem publicar nada):
 *  - anunciada / conferir / incompleta → nada (não duplica; confira antes);
 *  - em andamento → abrir a ficha dessa conta;
 *  - disponível + ficha fonte publicada → preparar a ficha desta conta (cópia, sem MLB/Bling da outra);
 *  - disponível + ficha fonte NÃO publicada → abrir a ficha preparada e escolher a conta na Publicação dela.
 */
export function acaoDaConta(linha, fonte) {
  if (!linha) return { tipo: "nenhuma" };
  if (linha.estado === ESTADO_QUADRO.EM_ANDAMENTO && linha.fichaAndamento) return { tipo: "abrir", ficha: linha.fichaAndamento, rotulo: `Abrir a ficha de ${linha.nome}` };
  if (linha.estado !== ESTADO_QUADRO.DISPONIVEL) return { tipo: "nenhuma" };
  if (!fonte?.id) return { tipo: "nenhuma", motivo: "Sem ficha PAIIA deste código para aproveitar os dados." };
  if (fonte.publicada && fonte.conta !== linha.conta) return { tipo: "preparar", ficha: fonte.id, conta: linha.conta, rotulo: `Aproveitar os dados para ${linha.nome}` };
  return { tipo: "abrir", ficha: fonte.id, conta: linha.conta, rotulo: `Abrir a ficha preparada e escolher ${linha.nome}` };
}
