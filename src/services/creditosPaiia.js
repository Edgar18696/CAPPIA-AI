import { supabase } from "../supabase";

export async function consultarCarteiraPaiia() {
  const { data, error } = await supabase.rpc(
    "paiia_consultar_carteira"
  );

  if (!error) return data;

  // Compatibilidade temporária enquanto frontend e migration são publicados.
  const legado = await supabase.rpc("consultar_creditos_appia");
  if (legado.error) throw error;

  return {
    saldo: Math.max(0, Number(legado.data || 0)),
    reservado: 0,
    origem: "legado",
  };
}
