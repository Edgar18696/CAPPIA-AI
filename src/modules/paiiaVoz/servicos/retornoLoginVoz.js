// =====================================================================
// (08/11/2026) Entrar na conta PAIIA e VOLTAR para onde estava.
// Ex.: Galeria na etapa Fotos sem login → "Entrar na conta PAIIA" → depois
// do login volta ao PAIIA Voz (o rascunho e a etapa ficam guardados neste
// aparelho) e reabre a Galeria uma vez. Guardado só nesta aba (sessionStorage)
// e por no máximo 30 minutos; não tem nada a ver com a conta do Mercado Livre.
// =====================================================================

const CHAVE = "paiiaRetornoAposLogin";
const VALIDADE_MS = 30 * 60 * 1000;

function armazenamentoPadrao() {
  try { return globalThis.sessionStorage || null; } catch { return null; }
}
function ler(armazenamento, agora) {
  try {
    const v = JSON.parse(armazenamento?.getItem(CHAVE) || "null");
    if (!v || typeof v !== "object" || !(agora - Number(v.em) <= VALIDADE_MS)) return null;
    return v;
  } catch { return null; }
}

/** Antes de abrir o login: para onde voltar depois. */
export function marcarRetornoAposLogin({ tela, abrirGaleria = false } = {}, { armazenamento = armazenamentoPadrao(), agora = Date.now() } = {}) {
  try { armazenamento?.setItem(CHAVE, JSON.stringify({ tela: String(tela || ""), abrirGaleria: Boolean(abrirGaleria), em: agora })); } catch { /* segue sem retorno */ }
}

/** Depois do login: a tela pedida (ou a Home). A tela só é usada uma vez. */
export function telaAposLogin({ armazenamento = armazenamentoPadrao(), agora = Date.now() } = {}) {
  const v = ler(armazenamento, agora);
  if (!v?.tela || v.usada) return "home";
  try { armazenamento.setItem(CHAVE, JSON.stringify({ ...v, usada: true })); } catch { /* ok */ }
  return v.tela;
}

/** Na tela de volta: reabrir a Galeria? (uma vez só; limpa o pedido) */
export function consumirAbrirGaleria({ armazenamento = armazenamentoPadrao(), agora = Date.now() } = {}) {
  const v = ler(armazenamento, agora);
  if (!v?.abrirGaleria) return false;
  try { armazenamento.setItem(CHAVE, JSON.stringify({ ...v, abrirGaleria: false })); } catch { /* ok */ }
  return true;
}

/** Só lê (sem limpar): há pedido para reabrir a Galeria? */
export function pedidoAbrirGaleria({ armazenamento = armazenamentoPadrao(), agora = Date.now() } = {}) {
  return Boolean(ler(armazenamento, agora)?.abrirGaleria);
}
