import { supabase } from "../supabase";

async function buscarNaTabela(
  tabela,
  busca
) {
  const { data, error } =
    await supabase
      .from(tabela)
      .select(
        `
        codigo_oem,
        codigo_equivalente,
        peca,
        fabricante,
        montadora,
        modelo,
        prioridade,
        confiabilidade
      `
      )
      .or(
        [
          `codigo_oem.ilike.%${busca}%`,
          `codigo_equivalente.ilike.%${busca}%`,
          `peca.ilike.%${busca}%`,
          `modelo.ilike.%${busca}%`,
        ].join(",")
      )
      .eq("ativo", true)
      .order("prioridade", {
        ascending: true,
      })
      .order("confiabilidade", {
        ascending: false,
      })
      .limit(10);

  if (error) {
    throw error;
  }

  return Array.isArray(data)
    ? data
    : [];
}

export async function sugerirCodigos(
  termo
) {
  const busca = String(
    termo || ""
  ).trim();

  if (busca.length < 3) {
    return [];
  }

  try {
    const mestre =
      await buscarNaTabela(
        "catalogo_mestre",
        busca
      );

    if (mestre.length > 0) {
      console.log(
        "SUGESTÕES UTILIZANDO: catalogo_mestre"
      );

      return mestre;
    }
  } catch (error) {
    console.warn(
      "Falha ao consultar catalogo_mestre:",
      error
    );
  }

  try {
    const compatibilidade =
      await buscarNaTabela(
        "catalogo_pecas",
        busca
      );

    console.log(
      "SUGESTÕES UTILIZANDO: catalogo_pecas"
    );

    return compatibilidade;
  } catch (error) {
    console.error(
      "Erro ao sugerir códigos:",
      error
    );

    return [];
  }
}