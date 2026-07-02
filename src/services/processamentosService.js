export async function buscarProcessamentos(
  supabase,
  usuario,
  tipo = null
) {
  if (!usuario) return { data: [], error: null };

  let query = supabase
    .from("processamentos")
    .select("*")
    .eq("user_id", usuario.id)
    .not("imagem_processada", "is", null);

  if (tipo) {
    query = query.eq("tipo", tipo);
  }

  const { data, error } = await query.order("created_at", {
    ascending: false,
  });

  return { data, error };
}

export async function removerProcessamento(supabase, item) {
  const { error } = await supabase
    .from("processamentos")
    .delete()
    .eq("id", item.id);

  return { error };
}

export async function removerProcessamentosSelecionados(
  supabase,
  selecionadas
) {
  const { error } = await supabase
    .from("processamentos")
    .delete()
    .in("created_at", selecionadas);

  return { error };
}