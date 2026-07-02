export async function buscarProjetos(supabase, usuario) {
  if (!usuario) return { data: [], count: 0, error: null };

  const { data, count, error } = await supabase
    .from("projetos")
    .select("*", { count: "exact" })
    .eq("user_id", usuario.id)
    .order("created_at", { ascending: false });

  return { data, count, error };
}
export async function inserirProjeto(supabase, usuario, projeto) {
  if (!usuario) {
    return { data: null, error: { message: "Usuário não logado" } };
  }

  const { data, error } = await supabase
    .from("projetos")
    .insert([
      {
        user_id: usuario.id,
        nome: projeto.nome,
        descricao: projeto.descricao,
        imagem: projeto.imagem || null,
        status: projeto.status || "Em andamento",
      },
    ])
    .select()
    .single();

  return { data, error };
}
export async function editarProjeto(supabase, id, projeto) {
  const { data, error } = await supabase
    .from("projetos")
    .update({
      nome: projeto.nome,
      descricao: projeto.descricao,
      status: projeto.status,
    })
    .eq("id", id)
    .select();

  return { data, error };
}

export async function removerProjeto(supabase, id) {
  const { error } = await supabase
    .from("projetos")
    .delete()
    .eq("id", id);

  return { error };
}