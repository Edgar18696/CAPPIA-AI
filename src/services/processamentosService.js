export function obterIdProcessamento(item) {
  const id = item?.id;

  if (id == null || id === "") {
    return null;
  }

  return id;
}

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

export async function removerProcessamento(supabase, item, usuario) {
  const processamentoId = obterIdProcessamento(item);

  if (!processamentoId || !usuario?.id) {
    return {
      error: {
        message:
          "Não foi possível identificar a imagem para exclusão.",
      },
    };
  }

  const { error } = await supabase
    .from("processamentos")
    .delete()
    .eq("id", processamentoId)
    .eq("user_id", usuario.id);

  return { error };
}

export async function removerProcessamentosSelecionados(
  supabase,
  selecionadas,
  usuario
) {
  if (!usuario?.id) {
    return {
      error: {
        message: "Faça login primeiro.",
      },
    };
  }

  const ids = (selecionadas || []).filter(Boolean);

  if (ids.length === 0) {
    return {
      error: {
        message: "Nenhuma imagem selecionada.",
      },
    };
  }

  const { error } = await supabase
    .from("processamentos")
    .delete()
    .in("id", ids)
    .eq("user_id", usuario.id);

  return { error };
}