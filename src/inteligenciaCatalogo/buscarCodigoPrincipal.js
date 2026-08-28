import { supabase } from "../supabase";
import { normalizarCodigo } from "./util";

async function buscarNaTabela(
  tabela,
  codigo
) {
  const { data, error } =
    await supabase
      .from(tabela)
      .select("*")
      .or(
        `codigo_oem.ilike.%${codigo}%,codigo_equivalente.ilike.%${codigo}%`
      )
      .eq("ativo", true)
      .order("prioridade", {
        ascending: true,
      })
      .limit(1);

  return {
    data: data || [],
    error,
  };
}

export async function buscarCodigoPrincipal(
  codigoDigitado
) {
  console.log(
    "ENTROU EM buscarCodigoPrincipal:",
    codigoDigitado
  );

  const codigo =
    normalizarCodigo(
      codigoDigitado
    );

  if (!codigo) {
    return null;
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
      "BUSCAR CÓDIGO UTILIZANDO: catalogo_mestre"
    );

    const item =
      resultadoMestre.data[0];

    return normalizarCodigo(
      item.codigo_oem ||
        item.codigo_equivalente ||
        codigo
    );
  }

  if (resultadoMestre.error) {
    console.warn(
      "Falha ao consultar catalogo_mestre. Usando catalogo_pecas:",
      resultadoMestre.error
    );
  }

  const resultadoCompatibilidade =
    await buscarNaTabela(
      "catalogo_pecas",
      codigo
    );

  if (
    resultadoCompatibilidade.error
  ) {
    throw resultadoCompatibilidade.error;
  }

  if (
    resultadoCompatibilidade.data
      .length === 0
  ) {
    return null;
  }

  console.log(
    "BUSCAR CÓDIGO UTILIZANDO: catalogo_pecas"
  );

  const item =
    resultadoCompatibilidade.data[0];

  return normalizarCodigo(
    item.codigo_oem ||
      item.codigo_equivalente ||
      codigo
  );
}