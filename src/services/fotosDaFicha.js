// =============================================================
// PAIIA — Fotos de UMA ficha (funções puras, sem rede).
// Testes: scripts/testes/fotosDaFicha.test.mjs
//
// Causa da contaminação (16/10/2026, caso 510959620 × tampa flange):
// a Conferência guardava as fotos em memória do navegador
// (window.__paiiaFotosPublicacao) e, ao abrir a Conferência de OUTRA ficha
// na mesma aba, essa memória tinha prioridade sobre as fotos do anúncio.
// Resultado: a ficha nova mostrava (e gravava) as fotos da ficha anterior.
//
// Regra: a memória de fotos tem DONO (ID da ficha e código). Ela só vale
// para a MESMA ficha; de outra ficha, nunca. Nada é apagado: as fotos
// continuam no armazenamento, na Galeria e na ficha de origem.
// =============================================================

const txt = (v) => String(v ?? "").trim();
const RE_ID = /^[0-9a-f-]{36}$/i;
const codigoNormal = (v) => txt(v).toUpperCase().replace(/[^A-Z0-9]/g, "");

export const MEMORIA_FOTOS = "__paiiaFotosPublicacao";
export const MEMORIA_FOTOS_DONO = "__paiiaFotosPublicacaoDono";

/** Dono de um anúncio/ficha: { ficha, codigo } (vazios quando não há). */
export function donoDasFotos(anuncio) {
  const id = txt(anuncio?.fichaIdPAIIA || anuncio?.fichaId || anuncio?.id);
  return {
    ficha: RE_ID.test(id) ? id.toLowerCase() : "",
    codigo: codigoNormal(anuncio?.codigo || anuncio?.oem),
  };
}

/**
 * A memória pertence a este anúncio?
 *  - os dois têm ID de ficha → IDs iguais;
 *  - senão → mesmo código (fichas antigas, sem ID).
 * Sem dono (memória antiga, sem marcação) → NÃO pertence.
 */
export function mesmoDono(a, b) {
  if (!a || !b) return false;
  if (a.ficha && b.ficha) return a.ficha === b.ficha;
  return Boolean(a.codigo) && a.codigo === b.codigo;
}

/**
 * Fotos com que a Conferência abre.
 * memoria: o que está em window.__paiiaFotosPublicacao; donoMemoria: a marcação.
 * Devolve { fotos, origem: "memoria" | "anuncio", descartouMemoria }.
 */
export function fotosIniciaisConferencia({ memoria, donoMemoria, anuncio }) {
  const mem = Array.isArray(memoria) ? memoria.filter(Boolean) : [];
  const doAnuncio = Array.isArray(anuncio?.fotos) ? anuncio.fotos.filter(Boolean) : [];
  if (mem.length && mesmoDono(donoMemoria, donoDasFotos(anuncio))) {
    return { fotos: [...mem], origem: "memoria", descartouMemoria: false };
  }
  return { fotos: [...doAnuncio], origem: "anuncio", descartouMemoria: mem.length > 0 };
}

/** Grava as fotos em memória JUNTO com o dono do anúncio (nunca sem dono). */
export function guardarFotosEmMemoria(alvo, fotos, anuncio) {
  if (!alvo) return;
  alvo[MEMORIA_FOTOS] = Array.isArray(fotos) ? fotos : [];
  alvo[MEMORIA_FOTOS_DONO] = donoDasFotos(anuncio);
}

/** Esquece as fotos em memória (ao levar OUTRO anúncio para a Conferência). */
export function esquecerFotosEmMemoria(alvo) {
  if (!alvo) return;
  alvo[MEMORIA_FOTOS] = null;
  alvo[MEMORIA_FOTOS_DONO] = null;
}

/**
 * Ao levar um anúncio para a Conferência: memória de OUTRA ficha é
 * esquecida; da MESMA ficha continua (banner/ordem feitos na Conferência).
 * Devolve true quando esqueceu.
 */
export function esquecerFotosDeOutraFicha(alvo, anuncio) {
  if (!alvo || !alvo[MEMORIA_FOTOS]) return false;
  if (mesmoDono(alvo[MEMORIA_FOTOS_DONO], donoDasFotos(anuncio))) return false;
  esquecerFotosEmMemoria(alvo);
  return true;
}

/**
 * Memória do simulador (window.__paiiaAnuncioSimulador) só se mistura com o
 * anúncio guardado (mlAnuncioTeste) quando os dois são da MESMA ficha.
 */
export function simuladorEhDoAnuncio(simulador, guardado) {
  if (!simulador || !guardado) return true;
  return mesmoDono(donoDasFotos(simulador), donoDasFotos(guardado));
}

const chaveUrl = (u) => txt(typeof u === "string" ? u : u?.imagem_processada || u?.imagem_original || u?.url || u?.src)
  .split("#")[0].split("?")[0].toLowerCase();

/**
 * Fichas JÁ contaminadas (gravadas antes da correção): as fotos da
 * Conferência não têm NENHUMA em comum com as fotos que o usuário colocou no
 * Novo Anúncio desta mesma ficha. O PAIIA só AVISA; o usuário decide.
 * Devolve { suspeita, fotosNovoAnuncio }.
 */
export function fotosDiferentesDoNovoAnuncio({ fotosConferencia, fotosNovoAnuncio }) {
  const conf = (Array.isArray(fotosConferencia) ? fotosConferencia : []).map(chaveUrl).filter(Boolean);
  const na = (Array.isArray(fotosNovoAnuncio) ? fotosNovoAnuncio : []).filter((f) => chaveUrl(f));
  if (!conf.length || !na.length) return { suspeita: false, fotosNovoAnuncio: na };
  const doNA = new Set(na.map(chaveUrl));
  const emComum = conf.some((u) => doNA.has(u));
  return { suspeita: !emComum, fotosNovoAnuncio: na };
}

/** Chave para lembrar que o usuário conferiu e manteve as fotos atuais. */
export function chaveFotosConferidas(fichaId, fotosConferencia) {
  const lista = (Array.isArray(fotosConferencia) ? fotosConferencia : []).map(chaveUrl).filter(Boolean).join("|");
  let h = 0;
  for (let i = 0; i < lista.length; i++) h = (h * 31 + lista.charCodeAt(i)) | 0;
  return `paiiaFotosConferidas:${txt(fichaId)}:${(h >>> 0).toString(36)}`;
}

// =============================================================
// FOTOS POR ID DA FICHA (17/10/2026 — caso 9598b904 / 510959620)
// A ficha guarda fotos em dois lugares: Novo Anúncio (novo_anuncio.fotos)
// e Conferência (ficha.campos.fotos). Fichas gravadas antes da correção
// têm na Conferência fotos de OUTRA ficha. Regra única, usada em todos os
// caminhos (Central, ?ficha=, F5, reabrir o navegador) e na Publicação:
//  - fotos da Conferência gravadas com a MARCA desta ficha → valem
//    (inclui troca manual intencional feita na Conferência);
//  - sem marca, mas com pelo menos 1 foto do Novo Anúncio desta ficha →
//    valem (banner, reordenação, foto acrescentada);
//  - marca de OUTRA ficha, ou nenhuma foto em comum com o Novo Anúncio →
//    NÃO valem: abrem as fotos do Novo Anúncio desta ficha e as outras
//    ficam guardadas no histórico (nada é apagado);
//  - sem Novo Anúncio para comparar (ficha muito antiga) → valem, mas
//    precisam de confirmação do usuário antes de aprovar/publicar.
// Abrir nunca grava: a decisão é a mesma em toda abertura.
// =============================================================

export const listaUrls = (lista) => (Array.isArray(lista) ? lista : []).map((f) => txt(typeof f === "string" ? f : f?.imagem_processada || f?.imagem_original || f?.url || f?.src)).filter((u) => /^https?:\/\//i.test(u));
const algumaEmComum = (a, b) => {
  const s = new Set(listaUrls(b).map(chaveUrl));
  return listaUrls(a).some((u) => s.has(chaveUrl(u)));
};
const mesmasFotos = (a, b) => listaUrls(a).map(chaveUrl).join("|") === listaUrls(b).map(chaveUrl).join("|");
const idNormal = (v) => (RE_ID.test(txt(v)) ? txt(v).toLowerCase() : "");
function resumoFotos(lista) {
  const t = listaUrls(lista).map(chaveUrl).join("|");
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
  return `${listaUrls(lista).length}-${(h >>> 0).toString(36)}`;
}
/**
 * MARCA das fotos: ID da ficha + resumo da LISTA de fotos marcada. Só vale
 * para aquela ficha E aquelas fotos (uma marca guardada sem as fotos — por
 * exemplo, na cópia local — nunca valida outra lista).
 */
export function marcaDasFotos(fichaId, fotos) {
  const id = idNormal(fichaId);
  return id && listaUrls(fotos).length ? `${id}:${resumoFotos(fotos)}` : "";
}
const idDaMarca = (marca) => idNormal(txt(marca).split(":")[0]);
const marcaValePara = (marca, fichaId, fotos) => Boolean(marca) && txt(marca) === marcaDasFotos(fichaId, fotos);

/**
 * Fotos com que a ficha abre (a partir da base).
 * Devolve { fotos, origem, confiavel, ignoradas, motivo }.
 *  origem: "conferencia" | "novo_anuncio" | "conferencia_sem_referencia" | "vazio"
 */
export function decidirFotosDaFicha({ fichaId, fotosConferencia, marcaConferencia, fotosNovoAnuncio }) {
  const id = idNormal(fichaId);
  const conf = listaUrls(fotosConferencia);
  const na = listaUrls(fotosNovoAnuncio);
  const marcaId = idDaMarca(marcaConferencia);
  if (!conf.length) return { fotos: na, origem: na.length ? "novo_anuncio" : "vazio", confiavel: true, ignoradas: [], motivo: "" };
  if (marcaId && id && marcaId !== id) {
    return { fotos: na, origem: "novo_anuncio", confiavel: true, ignoradas: conf, motivo: "As fotos gravadas na Conferência eram de outra ficha." };
  }
  if (marcaValePara(marcaConferencia, id, conf)) return { fotos: conf, origem: "conferencia", confiavel: true, ignoradas: [], motivo: "" };
  if (!na.length) return { fotos: conf, origem: "conferencia_sem_referencia", confiavel: false, ignoradas: [], motivo: "Ficha antiga sem fotos do Novo Anúncio para comparar: confirme que estas fotos são deste anúncio." };
  if (algumaEmComum(conf, na)) return { fotos: conf, origem: "conferencia", confiavel: true, ignoradas: [], motivo: "" };
  return { fotos: na, origem: "novo_anuncio", confiavel: true, ignoradas: conf, motivo: "As fotos gravadas na Conferência não tinham nenhuma foto do Novo Anúncio desta ficha (vieram de outro anúncio)." };
}

/**
 * As fotos que estão NA TELA da Conferência podem ser aprovadas?
 *  confirmadasNaTela: o usuário mexeu nas fotos ou confirmou nesta tela;
 *  marcaBase/fotosBase: marca e fotos da Conferência gravadas na base;
 *  fotosNovoAnuncio: fotos do Novo Anúncio desta ficha (null = ainda lendo).
 * Devolve { estado: "ok" | "verificando" | "confirmar" | "outra_origem", motivo }.
 */
export function situacaoFotosNaTela({ fichaId, fotosTela, fotosNovoAnuncio, marcaBase = "", fotosBase = [], confirmadasNaTela = false }) {
  const tela = listaUrls(fotosTela);
  if (!tela.length) return { estado: "ok", motivo: "" };
  if (confirmadasNaTela) return { estado: "ok", motivo: "" };
  const id = idNormal(fichaId);
  if (id && mesmasFotos(tela, fotosBase) && marcaValePara(marcaBase, id, fotosBase)) return { estado: "ok", motivo: "" };
  if (fotosNovoAnuncio === null || fotosNovoAnuncio === undefined) {
    return { estado: "verificando", motivo: "Conferindo se as fotos são desta ficha..." };
  }
  const na = listaUrls(fotosNovoAnuncio);
  if (!na.length) return { estado: "confirmar", motivo: "Confirme que estas fotos são deste anúncio (ficha sem fotos do Novo Anúncio para comparar)." };
  if (algumaEmComum(tela, na)) return { estado: "ok", motivo: "" };
  return { estado: "outra_origem", motivo: "As fotos desta Conferência não são do Novo Anúncio desta ficha (podem ser de outro anúncio)." };
}

/**
 * PUBLICAÇÃO: as fotos APROVADAS gravadas na ficha são desta ficha?
 * base = linha de paiia_anuncios lida AGORA pelo ID. Devolve { ok, motivo }.
 */
export function origemFotosAprovadas(base) {
  const d = base?.dados_conferencia || {};
  const conferido = d.ficha?.anuncioConferido || null;
  const fotos = listaUrls(conferido?.fotos);
  if (!fotos.length) return { ok: true, motivo: "" };
  const id = idNormal(base?.id);
  // Marca gravada junto da aprovação ou da última gravação da Conferência,
  // valendo para ESTA ficha e ESTA lista de fotos aprovadas.
  const marcas = [conferido?.fotosFichaId, d.ficha?.campos?.fotosFichaId].map((m) => txt(m)).filter(Boolean);
  if (marcas.some((m) => idDaMarca(m) && id && idDaMarca(m) !== id)) return { ok: false, motivo: "As fotos aprovadas foram marcadas para OUTRA ficha. Abra a Conferência, confira as fotos e aprove de novo." };
  if (marcas.some((m) => marcaValePara(m, id, fotos))) return { ok: true, motivo: "" };
  const na = listaUrls(d.novo_anuncio?.fotos);
  if (na.length && algumaEmComum(fotos, na)) return { ok: true, motivo: "" };
  // Sem origem comprovada (ficha antiga sem Novo Anúncio para comparar ou
  // sem nenhuma foto dele): exige confirmação explícita, mesmo se já aprovada.
  if (!na.length) return { ok: false, semReferencia: true, motivo: "A origem das fotos aprovadas não está comprovada (ficha antiga). Abra a Conferência, clique em \"Confirmo: estas fotos são deste anúncio\" e aguarde \"✓ Salvo na base\" antes de publicar." };
  return { ok: false, motivo: "As fotos aprovadas não são do Novo Anúncio desta ficha (podem ser de outro anúncio). Abra a Conferência, confira as fotos e aprove de novo." };
}

/** Histórico de fotos ignoradas: acrescenta sem repetir (nada é apagado). */
export function juntarHistoricoFotos(historico, entrada) {
  const lista = Array.isArray(historico) ? historico.filter(Boolean) : [];
  const fotos = listaUrls(entrada?.fotos);
  if (!fotos.length) return lista;
  const k = fotos.map(chaveUrl).join("|");
  if (lista.some((h) => listaUrls(h?.fotos).map(chaveUrl).join("|") === k)) return lista;
  return [...lista, { fotos, motivo: txt(entrada?.motivo), em: txt(entrada?.em) || new Date().toISOString() }];
}
