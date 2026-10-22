// =============================================================
// PAIIA Voz — ação pedida pela página inicial (microfone, foto, digitar,
// continuar). Lida UMA vez quando a tela do PAIIA Voz abre.
// =============================================================
export const CHAVE_ACAO_VOZ = "paiiaVozAcao";
const ACOES = ["microfone", "foto", "digitar", "continuar"];

export function pedirAcaoPaiiaVoz(acao, storage) {
  try {
    const s = storage || globalThis.localStorage;
    if (ACOES.includes(acao)) s.setItem(CHAVE_ACAO_VOZ, JSON.stringify({ acao, em: Date.now() }));
  } catch {
    // sem acesso ao navegador
  }
}

/** Lê e apaga a ação pedida (vale por 2 minutos). */
export function consumirAcaoPaiiaVoz(storage, agora = Date.now()) {
  try {
    const s = storage || globalThis.localStorage;
    const bruto = s.getItem(CHAVE_ACAO_VOZ);
    s.removeItem(CHAVE_ACAO_VOZ);
    if (!bruto) return "";
    const { acao, em } = JSON.parse(bruto);
    return ACOES.includes(acao) && agora - Number(em || 0) < 120000 ? acao : "";
  } catch {
    return "";
  }
}
