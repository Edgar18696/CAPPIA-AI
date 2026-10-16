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
