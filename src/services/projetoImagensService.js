export async function vincularImagensProjeto(
  supabase,
  usuario,
  projetoId,
  imagens
) {
  if (!usuario) {
    return { error: { message: "Usuário não logado" } };
  }

  if (!projetoId || !imagens || imagens.length === 0) {
    return { error: null };
  }

  const registros = imagens
    .filter((item) => item?.id)
    .map((item) => ({
      user_id: usuario.id,
      projeto_id: projetoId,
      processamento_id: item.id,
      imagem_url: item.imagem_processada || item.imagem_original,
      tipo: item.tipo || "foto",
    }));

  if (registros.length === 0) {
    return { error: null };
  }

  const { data, error } = await supabase
    .from("projeto_imagens")
    .insert(registros)
    .select();

  return { data, error };
}