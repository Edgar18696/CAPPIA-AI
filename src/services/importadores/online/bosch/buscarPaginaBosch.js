import { supabase } from "../../../../supabase";

function normalizarCodigo(valor = "") {
  return String(valor || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .trim();
}

function verificarUrl(valor = "") {
  const texto = String(valor || "").trim();

  return (
    texto.startsWith("https://") ||
    texto.startsWith("http://")
  );
}

export async function salvarPaginaBosch({
  codigo,
  url,
  titulo = "",
  categoria = "",
} = {}) {
  const codigoFinal =
    normalizarCodigo(codigo);

  const urlFinal =
    String(url || "").trim();

  if (!codigoFinal || !urlFinal) {
    return {
      sucesso: false,
    };
  }

  const { error } = await supabase
    .from("paginas_fabricantes")
    .upsert(
      {
        fabricante: "Bosch",
        codigo: codigoFinal,
        url: urlFinal,
        titulo:
          String(titulo || "").trim(),
        categoria:
          String(categoria || "").trim(),
        ativo: true,
        confiabilidade: 100,
        updated_at:
          new Date().toISOString(),
      },
      {
        onConflict:
          "fabricante,codigo",
      }
    );

  if (error) {
    console.error(
      "Erro ao salvar página Bosch:",
      error
    );

    return {
      sucesso: false,
      mensagem: error.message,
    };
  }

  return {
    sucesso: true,
    codigo: codigoFinal,
    url: urlFinal,
  };
}

async function consultarTabela(
  tabela,
  termoConsulta
) {
  const { data, error } =
    await supabase
      .from(tabela)
      .select("*")
      .eq("ativo", true)
      .or(
        [
          `codigo_oem.ilike.${termoConsulta}`,
          `codigo_equivalente.ilike.${termoConsulta}`,
        ].join(",")
      )
      .limit(500);

  if (error) {
    console.warn(
      `Erro ao consultar ${tabela}:`,
      error.message
    );

    return [];
  }

  return Array.isArray(data)
    ? data
    : [];
}

async function executarConsultaCatalogo(
  termoConsulta
) {
  const registrosMestre =
    await consultarTabela(
      "catalogo_mestre",
      termoConsulta
    );

  if (registrosMestre.length > 0) {
    return {
      tabela: "catalogo_mestre",
      registros: registrosMestre,
    };
  }

  const registrosAntigos =
    await consultarTabela(
      "catalogo_pecas",
      termoConsulta
    );

  return {
    tabela: "catalogo_pecas",
    registros: registrosAntigos,
  };
}

async function buscarNoCatalogoBosch(
  codigo
) {
  const codigoFinal =
    normalizarCodigo(codigo);

  if (!codigoFinal) {
    return null;
  }

  let resultadoConsulta =
    await executarConsultaCatalogo(
      `%${codigoFinal}%`
    );

  if (
    resultadoConsulta.registros.length ===
    0
  ) {
    const codigoFlexivel =
      `%${codigoFinal
        .split("")
        .join("%")}%`;

    resultadoConsulta =
      await executarConsultaCatalogo(
        codigoFlexivel
      );
  }

  console.log(
  "REGISTRO BANCO:",
  resultadoConsulta.registros[0]
);

const registrosValidados =
  resultadoConsulta.registros.filter(
      (item) => {
        const codigoOem =
          normalizarCodigo(
            item.codigo_oem
          );

        const codigoEquivalente = String(
  item.codigo_equivalente || ""
)
  .split(/[\s,;|]+/)
  .map(normalizarCodigo)
  .filter(Boolean);

        const correspondeOem =
          codigoOem &&
          (
            codigoOem.includes(
              codigoFinal
            ) ||
            codigoFinal.includes(
              codigoOem
            )
          );

        const correspondeEquivalente =
  codigoEquivalente.some(
    (codigo) =>
      codigo.includes(codigoFinal) ||
      codigoFinal.includes(codigo)
  );

        return (
          correspondeOem ||
          correspondeEquivalente
        );
      }
    );

  console.log(
    "BUSCA CATÁLOGO:",
    codigoFinal,
    "TABELA:",
    resultadoConsulta.tabela,
    "REGISTROS:",
    resultadoConsulta.registros.length,
    "VALIDADOS:",
    registrosValidados.length
  );

  if (
    registrosValidados.length === 0
  ) {
    return null;
  }

  return {
    sucesso: true,
    codigo: codigoFinal,
    origem:
      "catalogo_tecnico_appia",
    tabela:
      resultadoConsulta.tabela,
    registros:
      registrosValidados,
    registroPrincipal:
      registrosValidados[0],
  };
}

export async function buscarPaginaBosch(
  entrada
) {
  const valorFinal =
    String(entrada || "").trim();

  if (!valorFinal) {
    throw new Error(
      "Informe um código, OEM ou uma URL."
    );
  }

  if (verificarUrl(valorFinal)) {
    if (
      !valorFinal.includes(
        "boschpecas.com.br"
      )
    ) {
      throw new Error(
        "A URL informada não pertence ao catálogo Bosch."
      );
    }

    return {
      sucesso: true,
      codigo: "",
      url: valorFinal,
      origem: "url_informada",
    };
  }

  const codigoFinal =
    normalizarCodigo(valorFinal);

  const catalogoPdf =
    await buscarNoCatalogoBosch(
      codigoFinal
    );

  if (catalogoPdf) {
    return catalogoPdf;
  }

  const { data, error } =
    await supabase
      .from("paginas_fabricantes")
      .select(
        "codigo, url, titulo, categoria"
      )
      .ilike(
        "fabricante",
        "Bosch"
      )
      .eq(
        "codigo",
        codigoFinal
      )
      .eq("ativo", true)
      .order(
        "confiabilidade",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

  if (error) {
    console.error(
      "Erro ao pesquisar página Bosch:",
      error
    );

    throw new Error(
      "Não foi possível pesquisar a base de páginas Bosch."
    );
  }

  if (data?.url) {
    return {
      sucesso: true,
      codigo: codigoFinal,
      url: data.url,
      titulo:
        data.titulo || "",
      categoria:
        data.categoria || "",
      origem: "base_appia",
    };
  }

  throw new Error(
    `O código ${codigoFinal} não foi encontrado no catálogo importado.`
  );
}