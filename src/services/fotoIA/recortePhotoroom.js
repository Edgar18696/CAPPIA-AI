// =============================================================
// PAIIA — (13/11) Foto IA: recorte pelo Photoroom SEM chave no navegador.
// A foto vai para o intermediário (no teste: "npm run dev", scripts/dev/photoroomDev.mjs;
// em produção: função do Supabase com a chave nos Secrets — ainda não publicada).
// Se o Photoroom não estiver disponível ou falhar, quem chama usa o recorte grátis.
// =============================================================
export const ROTA_PHOTOROOM_LOCAL = "/__paiia/photoroom-recorte";

/** Recorta pelo Photoroom: devolve { blob, metodo } (PNG do mesmo tamanho, com transparência). */
export async function recortarPhotoroom(foto, { buscar = globalThis.fetch, disponivel = Boolean(import.meta.env?.DEV) } = {}) {
  if (!disponivel) throw new Error("Photoroom não disponível neste ambiente.");
  const r = await buscar(ROTA_PHOTOROOM_LOCAL, { method: "POST", headers: { "Content-Type": foto?.type || "image/jpeg" }, body: foto });
  if (!r.ok) {
    let erro = `HTTP ${r.status}`;
    try { erro = (await r.json())?.erro || erro; } catch { /* sem JSON */ }
    throw new Error(`Photoroom: ${erro}`);
  }
  const blob = await r.blob();
  if (!blob?.size) throw new Error("Photoroom devolveu recorte vazio.");
  return { blob, metodo: "photoroom" };
}

/**
 * (13/11) Ordem do recorte na câmera: Photoroom → recorte grátis no aparelho.
 * (Se os dois falharem, tratarFotoDaGaleria ainda usa o "foto-ia" como última reserva.)
 */
export function recortarComReserva({ photoroom, gratis, aoFalharPhotoroom = () => {} }) {
  return async (foto) => {
    try {
      return await photoroom(foto);
    } catch (e) {
      try { aoFalharPhotoroom(e); } catch { /* ignora */ }
      const r = await gratis(foto);
      return { ...r, metodo: "local" };
    }
  };
}
