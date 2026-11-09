// =============================================================
// PAIIA Voz — (09/11) foto tirada no Voz também vai para a GALERIA PAIIA.
//   Testes: scripts/testes/fotoCameraGaleria.test.mjs
//
// Antes: a foto do Voz ficava só no aparelho e na ficha (ia para a nuvem junto com a
// ficha, que espera o código) — nunca entrava na Galeria ("processamentos").
// Agora: assim que a foto entra no Voz, a original vai para a nuvem (o MESMO envio que a
// ficha usa, sem enviar duas vezes) e ganha uma linha na Galeria. Quando o fundo branco
// fica pronto, a tratada é ligada à MESMA linha. Foto que veio da própria Galeria não é
// registrada de novo. Nada é apagado.
// =============================================================
import { acharOuCriarLinhaGaleria, ligarTratadaNaLinha } from "../../../services/fotoIA/fotoCameraGaleria.js";

/** Foto que veio da Galeria (já tem linha lá). */
export function veioDaGaleria(reg) {
  return reg?.ia?.origem === "galeria" || reg?.tratada?.origem === "galeria";
}

/** Marca do que já foi registrado desta foto (evita consultas repetidas). */
export function marcaRegistro(reg) {
  const trat = reg?.versao === "tratada" || reg?.tratada?.blob ? `t${reg?.tratada?.em || 0}` : "o";
  return `${reg?.id}:${trat}`;
}

/**
 * Registra a foto do Voz na Galeria. deps: { supabase, usuarioId, garantirOriginal(reg), garantirTratada(reg) }.
 * Devolve { linhaId, tratadaLigada } ou null (sem login / veio da Galeria).
 */
export async function registrarFotoVozNaGaleria(reg, { supabase, usuarioId, garantirOriginal, garantirTratada }) {
  if (!usuarioId || !reg?.id || veioDaGaleria(reg)) return null;
  const original = await garantirOriginal(reg);
  if (!original?.url) return null;
  const linha = await acharOuCriarLinhaGaleria({ supabase, usuarioId, url: original.url });
  let tratadaLigada = false;
  if (reg?.tratada?.blob && garantirTratada) {
    const tratada = await garantirTratada(reg);
    if (tratada?.url && linha.imagem_processada === original.url) {
      tratadaLigada = await ligarTratadaNaLinha({ supabase, usuarioId, linhaId: linha.id, urlOriginal: original.url, urlTratada: tratada.url });
    }
  }
  return { linhaId: linha.id, tratadaLigada };
}
