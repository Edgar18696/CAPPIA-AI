// =============================================================
// PAIIA — aviso "a ficha NÃO foi salva ao sair" (22/10/2026).
// Ficha do PAIIA Voz no Novo Anúncio não tem mais o "Voltar à Central"
// (que esperava o salvamento e avisava a falha). Saindo pelo menu, a
// última gravação acontece depois que a tela fecha; se ela falhar, o
// aviso fica guardado NESTE navegador e aparece na tela seguinte.
// Não grava nada na base: só localStorage.
// =============================================================
export const CHAVE_AVISO_FICHA_NAO_SALVA = "paiiaAvisoFichaNaoSalva";
export const EVENTO_AVISO_FICHA = "paiia-aviso-ficha-nao-salva";

function avisar() {
  try {
    window.dispatchEvent(new Event(EVENTO_AVISO_FICHA));
  } catch {
    // sem janela (testes)
  }
}

export function registrarAvisoFichaNaoSalva({ codigo = "", titulo = "", fichaId = "", erro = "" }, storage = globalThis.localStorage) {
  try {
    storage.setItem(CHAVE_AVISO_FICHA_NAO_SALVA, JSON.stringify({ codigo: String(codigo || ""), titulo: String(titulo || ""), fichaId: String(fichaId || ""), erro: String(erro || "falha ao salvar"), em: new Date().toISOString() }));
  } catch {
    return;
  }
  avisar();
}

export function lerAvisoFichaNaoSalva(storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage.getItem(CHAVE_AVISO_FICHA_NAO_SALVA) || "null");
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

export function limparAvisoFichaNaoSalva(storage = globalThis.localStorage) {
  try {
    if (storage.getItem(CHAVE_AVISO_FICHA_NAO_SALVA) === null) return;
    storage.removeItem(CHAVE_AVISO_FICHA_NAO_SALVA);
  } catch {
    return;
  }
  avisar();
}

/** Falhou de verdade? (vazio = nada a gravar; fechada = ficha publicada, já avisada na tela). */
export function falhaQueMereceAviso(r) {
  return Boolean(r) && !r.ok && !r.vazio && !r.fechada;
}

const so = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
/** O anúncio guardado pela Home (fichasCentral.guardarAnuncioEmAndamento) é o desta ficha? */
export function anuncioGuardadoEhDoAviso(guardado, aviso) {
  const r = guardado?.resumo;
  if (!r || !aviso) return false;
  if (aviso.fichaId && r.fichaId) return String(aviso.fichaId) === String(r.fichaId);
  return Boolean(so(aviso.codigo)) && so(aviso.codigo) === so(r.codigo);
}
