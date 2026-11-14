// =============================================================
// PAIIA — (14/11) Foto IA: detectar a foto PERDIDA quando o celular fecha a página
// enquanto o app da câmera está aberto (falta de memória). Nesse caso a página
// recarrega, a foto nunca chega ao PAIIA e, antes, nada avisava: "a foto sumia".
// Puro (armazenamento entra por parâmetro): testável no Node.
// =============================================================
export const CHAVE_CAMERA_ABERTA = "paiiaCameraAbertaEm";
export const VALIDADE_AVISO_MS = 10 * 60_000;
export const MSG_FOTO_PERDIDA = "O celular fechou a página do PAIIA enquanto a câmera estava aberta, e a última foto não chegou. Tire a foto de novo. Dica: feche outros aplicativos antes de fotografar.";

const ler = (a, k) => { try { return a?.getItem?.(k) ?? null; } catch { return null; } };
const gravar = (a, k, v) => { try { a?.setItem?.(k, v); } catch { /* sem armazenamento */ } };
const apagar = (a, k) => { try { a?.removeItem?.(k); } catch { /* sem armazenamento */ } };

/** Ao tocar em "Tirar Foto". */
export function marcarCameraAberta(armazenamento, agora = Date.now()) {
  gravar(armazenamento, CHAVE_CAMERA_ABERTA, String(agora));
}

/** A foto chegou (ou o usuário desistiu sem recarga): nada a avisar. */
export function limparCameraAberta(armazenamento) {
  apagar(armazenamento, CHAVE_CAMERA_ABERTA);
}

/**
 * Ao abrir a tela: a câmera foi aberta ANTES desta página carregar (= a página
 * recarregou com a câmera aberta) e há pouco tempo? Então a foto se perdeu.
 * Sempre limpa a marca (o aviso aparece uma vez só).
 */
export function fotoPerdidaNaRecarga(armazenamento, { inicioDaPagina, agora = Date.now() } = {}) {
  const v = Number(ler(armazenamento, CHAVE_CAMERA_ABERTA));
  apagar(armazenamento, CHAVE_CAMERA_ABERTA);
  if (!Number.isFinite(v) || v <= 0 || !Number.isFinite(inicioDaPagina)) return false;
  return v < inicioDaPagina && agora - v < VALIDADE_AVISO_MS;
}
