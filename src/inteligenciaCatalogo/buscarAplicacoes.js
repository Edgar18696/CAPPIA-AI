import { supabase } from "../supabase";

async function buscarNaTabela(
  tabela,
  codigo
) {
  const { data, error } =
    await supabase
      .from(tabela)
      .select("*")
      .or(
        [
          `codigo_oem.ilike.%${codigo}%`,
          `codigo_equivalente.ilike.%${codigo}%`,
        ].join(",")
      )
      .eq("ativo", true)
      .order("prioridade", {
        ascending: true,
      })
      .order("confiabilidade", {
        ascending: false,
      });

  return {
    data: data || [],
    error,
  };
}

export async function buscarAplicacoes(
  codigoPrincipal
) {
  const codigo = String(
    codigoPrincipal || ""
  ).trim();

  if (!codigo) {
    return [];
  }

  const resultadoMestre =
    await buscarNaTabela(
      "catalogo_mestre",
      codigo
    );

  if (
    !resultadoMestre.error &&
    resultadoMestre.data.length > 0
  ) {
    console.log(
      "BUSCAR APLICAÇÕES UTILIZANDO: catalogo_mestre"
    );

    return resultadoMestre.data;
  }

  if (resultadoMestre.error) {
    console.warn(
      "Falha ao consultar catalogo_mestre. Usando catalogo_aplicacoes:",
      resultadoMestre.error
    );
  } else {
    console.warn(
      "Aplicações não encontradas em catalogo_mestre. Usando catalogo_aplicacoes."
    );
  }

  const resultadoCompatibilidade =
    await buscarNaTabela(
      "catalogo_aplicacoes",
      codigo
    );

  if (resultadoCompatibilidade.error) {
    console.error(
      "Erro buscarAplicacoes:",
      resultadoCompatibilidade.error
    );

    return [];
  }

  if (
    resultadoCompatibilidade.data.length >
    0
  ) {
    console.log(
      "BUSCAR APLICAÇÕES UTILIZANDO: catalogo_aplicacoes"
    );
  }

  return resultadoCompatibilidade.data;
}