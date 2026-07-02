import { supabase } from "../supabase";

export async function buscarPecaNoCatalogo(codigoFinal) {
  const codigoLimpo = codigoFinal.trim();

  if (!codigoLimpo) {
    return { data: [], error: null };
  }

  const { data, error } = await supabase
    .from("catalogo_pecas")
    .select("*")
    .or(
      `codigo_oem.ilike.%${codigoLimpo}%,codigo_equivalente.ilike.%${codigoLimpo}%,peca.ilike.%${codigoLimpo}%`
    )
    .eq("ativo", true)
    .limit(20);

  return { data: data || [], error };
}