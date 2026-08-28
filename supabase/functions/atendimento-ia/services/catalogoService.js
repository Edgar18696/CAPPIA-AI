import { supabase } from "../supabase";

function limparCodigo(valor) {
  return String(valor || "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

export async function buscarPecaNoCatalogo(codigoFinal) {
  const codigoLimpo =
    limparCodigo(codigoFinal);

  if (!codigoLimpo) {
    return {
      data: [],
      error: null,
    };
  }

  const {
    data: dadosExatos,
    error: erroExato,
  } = await supabase
    .from("catalogo_mestre")
    .select("*")
    .or(
      `codigo_oem.eq.${codigoLimpo},codigo_equivalente.eq.${codigoLimpo}`
    )
    .eq("ativo", true)
    .order("prioridade", {
      ascending: true,
    })
    .limit(300);

  if (erroExato) {
    return {
      data: [],
      error: erroExato,
    };
  }

  if (
    Array.isArray(dadosExatos) &&
    dadosExatos.length > 0
  ) {
    return {
      data: dadosExatos,
      error: null,
    };
  }

  const {
    data: dadosParciais,
    error: erroParcial,
  } = await supabase
    .from("catalogo_mestre")
    .select("*")
    .or(
      `codigo_oem.ilike.%${codigoLimpo}%,codigo_equivalente.ilike.%${codigoLimpo}%,peca.ilike.%${codigoLimpo}%,modelo.ilike.%${codigoLimpo}%`
    )
    .eq("ativo", true)
    .order("prioridade", {
      ascending: true,
    })
    .limit(300);

  return {
    data:
      dadosParciais || [],
    error:
      erroParcial || null,
  };
}