import { supabase } from "../supabase";

function limparTexto(valor) {
  return String(valor ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

async function buscarNaTabela(
  tabela,
  codigoFinal
) {
  const { data, error } = await supabase
    .from(tabela)
    .select("*")
    .or(
      [
        `codigo_oem.ilike.%${codigoFinal}%`,
        `codigo_equivalente.ilike.%${codigoFinal}%`,
      ].join(",")
    )
    .eq("ativo", true)
    .order("prioridade", {
      ascending: true,
    })
    .order("confiabilidade", {
      ascending: false,
    })
    .limit(20);

  if (error) {
    throw error;
  }

  return Array.isArray(data)
    ? data
    : [];
}

async function buscarBaseCatalogo(
  codigoFinal
) {
  try {
    const registrosMestre =
      await buscarNaTabela(
        "catalogo_mestre",
        codigoFinal
      );

    if (registrosMestre.length > 0) {
      console.log(
        "USE CATÁLOGO UTILIZANDO: catalogo_mestre"
      );

      return registrosMestre;
    }
  } catch (error) {
    console.warn(
      "Falha ao consultar catalogo_mestre:",
      error
    );
  }

  const registrosCompatibilidade =
    await buscarNaTabela(
      "catalogo_pecas",
      codigoFinal
    );

  console.log(
    "USE CATÁLOGO UTILIZANDO: catalogo_pecas"
  );

  return registrosCompatibilidade;
}

export function useCatalogoAnuncio({
  setPecaEncontrada,
  setCodigo,
  setOem,
  setTitulo,
  setDescricao,
}) {
  async function buscarNoCatalogoDireto(
    codigoDigitado,
    oemDigitado
  ) {
    const codigoFinal = limparTexto(
      codigoDigitado ||
        oemDigitado ||
        ""
    );

    if (!codigoFinal) {
      alert(
        "Digite o código da peça ou OEM."
      );

      return false;
    }

    try {
      const registros =
        await buscarBaseCatalogo(
          codigoFinal
        );

      if (registros.length === 0) {
        alert(
          "Nenhum registro encontrado no catálogo."
        );

        return false;
      }

      const item = registros[0];

      const codigoPrincipal =
        limparTexto(
          item.codigo_oem
        ) || codigoFinal;

      const codigoEquivalente =
        limparTexto(
          item.codigo_equivalente
        );

      setPecaEncontrada(item);

      setCodigo(
        codigoPrincipal
      );

      setOem(
        codigoEquivalente ||
          codigoFinal
      );

      setTitulo(
        [
          item.peca ||
            "Peça Automotiva",

          item.fabricante || "",

          codigoPrincipal,
        ]
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 60)
      );

      setDescricao(
        `
${item.peca || "PEÇA AUTOMOTIVA"}

FABRICANTE:
${item.fabricante || "-"}

CÓDIGO CONSULTADO:
${codigoFinal}

OEM:
${codigoPrincipal || "-"}

EQUIVALENTE:
${codigoEquivalente || "-"}

MONTADORA:
${item.montadora || "-"}

MODELO:
${item.modelo || "-"}

MOTOR:
${item.motor || "-"}

ANOS:
${montarAno(item)}

CATÁLOGO:
${item.origem_catalogo || "Base APPIA"}

OBSERVAÇÃO:
${
  item.observacao ||
  "Compare sempre o código gravado na peça original."
}
        `.trim()
      );

      return true;
    } catch (error) {
      console.error(
        "Erro ao consultar catálogo:",
        error
      );

      alert(
        error.message ||
          "Erro ao consultar a Base Mestre APPIA."
      );

      return false;
    }
  }

  return {
    buscarNoCatalogoDireto,
  };
}

function montarAno(item) {
  const anoInicio =
    item.ano_inicio || "";

  const anoFim =
    item.ano_fim || "";

  if (anoInicio && anoFim) {
    return `${anoInicio} até ${anoFim}`;
  }

  if (anoInicio) {
    return `A partir de ${anoInicio}`;
  }

  if (anoFim) {
    return `Até ${anoFim}`;
  }

  return "-";
}