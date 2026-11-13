// =============================================================
// PAIIA — (13/11) Foto IA: recorte pelo Photoroom SEM chave no navegador.
//   - "npm run dev": intermediário local (scripts/dev/photoroomDev.mjs), chave
//     em C:\PAIIA\photoroom-teste.env (Sandbox; Básico só com permissão explícita).
//   - Site: função do Supabase "foto-photoroom" (Básico, v1/segment), chave nos
//     Secrets (PHOTOROOM_API_KEY) e cota PRÓPRIA do Photoroom — separada da cota
//     de 50 do "foto-ia". Enquanto a função não for publicada, falha e a câmera
//     usa o recorte grátis.
// =============================================================
export const ROTA_PHOTOROOM_LOCAL = "/__paiia/photoroom-recorte";
export const FUNCAO_PHOTOROOM = "foto-photoroom";

/** Recorta pelo Photoroom: devolve { blob, metodo } (PNG do mesmo tamanho, com transparência). */
export async function recortarPhotoroom(foto, { caminho = "", dev = Boolean(import.meta.env?.DEV), buscar = globalThis.fetch, invocar = null, baixar = null } = {}) {
  if (dev) {
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
  if (typeof invocar !== "function" || typeof baixar !== "function" || !caminho) throw new Error("Photoroom não disponível neste ambiente.");
  // A função lê a ORIGINAL já salva na Galeria (não depende da cópia do aparelho).
  const { data, error } = await invocar(FUNCAO_PHOTOROOM, { body: { caminho } });
  if (error || !data?.sucesso || !data?.recorteUrl) {
    let msg = data?.erro || error?.message || "não respondeu";
    let codigo = data?.codigo || "";
    try { const c = await error?.context?.json?.(); msg = c?.erro || msg; codigo = c?.codigo || codigo; } catch { /* mantém */ }
    throw Object.assign(new Error(`Photoroom: ${msg}`), { codigo });
  }
  const blob = await baixar(data.recorteUrl);
  if (!blob?.size) throw new Error("Photoroom devolveu recorte vazio.");
  return { blob, metodo: "photoroom" };
}

/**
 * (13/11) Ordem do recorte na câmera: Photoroom (principal) → recorte grátis no aparelho.
 * (Se os dois falharem, tratarFotoDaGaleria ainda usa o "foto-ia" como última reserva.)
 */
export function recortarComReserva({ photoroom, gratis, aoFalharPhotoroom = () => {} }) {
  return async (foto, contexto = {}) => {
    let falhaPhotoroom;
    try {
      return await photoroom(foto, contexto);
    } catch (e) {
      falhaPhotoroom = e;
      try { aoFalharPhotoroom(e); } catch { /* ignora */ }
    }
    try {
      const r = await gratis(foto, contexto);
      return { ...r, metodo: "local", avisoPhotoroom: String(falhaPhotoroom?.message || falhaPhotoroom) };
    } catch (e) {
      // (13/11) Os dois motivos juntos (antes só o da cota da reserva aparecia).
      throw new Error(`${String(falhaPhotoroom?.message || falhaPhotoroom)} · Recorte grátis: ${String(e?.message || e)}`, { cause: e });
    }
  };
}
