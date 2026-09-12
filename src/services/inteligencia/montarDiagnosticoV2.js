function listaUnica(valores = []) {
  return [
    ...new Set(
      valores
        .map((valor) =>
          String(valor || "").trim()
        )
        .filter(Boolean)
    ),
  ];
}

export function montarDiagnosticoV2({
  codigoOriginal = "",
  codigoNormalizado = "",
  fabricante = "",
  familia = "",
  inteligencia = {},
  confianca = {},
} = {}) {
  const registros =
    Array.isArray(inteligencia?.registros)
      ? inteligencia.registros
      : [];

  const equivalentes =
    Array.isArray(
      inteligencia?.equivalentes
    )
      ? inteligencia.equivalentes
      : [];

  const registroPrincipal =
    registros[0] || {};

  const montadoras = listaUnica(
    registros.map(
      (item) => item.montadora
    )
  );

  const modelos = listaUnica(
    registros.map(
      (item) => item.modelo
    )
  );

  const motores = listaUnica(
    registros.map(
      (item) => item.motor
    )
  );

  const fontes = listaUnica(
    registros.map(
      (item) =>
        item.origem_catalogo ||
        item.fonte ||
        item.arquivo_catalogo ||
        item.fabricante
    )
  );

  const codigosEquivalentes =
    listaUnica(
      equivalentes.map((item) =>
        typeof item === "string"
          ? item
          : item?.codigo ||
            item?.codigo_equivalente ||
            item?.codigo_oem
      )
    );

  return {
    titulo:
      "Diagnóstico Técnico PAIIA AI",

    codigoOriginal,

    codigoNormalizado,

    codigoPrincipal:
      registroPrincipal.codigo_oem ||
      registroPrincipal.codigo ||
      registroPrincipal.oem ||
      codigoNormalizado,

    peca:
      registroPrincipal.peca ||
      registroPrincipal.descricao ||
      familia ||
      "Peça automotiva",

    fabricante:
      registroPrincipal.fabricante ||
      fabricante ||
      "Não identificado",

    familia:
      familia ||
      registroPrincipal.familia ||
      "Não identificada",

    montadoras,

    modelos,

    motores,

    equivalentes:
      codigosEquivalentes,

    fontes,

    totalRegistros:
      registros.length,

    confianca: {
      percentual:
        Number(
          confianca?.percentual
        ) || 0,

      nivel:
        confianca?.nivel ||
        "Baixa",

      motivos:
        Array.isArray(
          confianca?.motivos
        )
          ? confianca.motivos
          : [],
    },

    resumo: [
      registroPrincipal.peca ||
        registroPrincipal.descricao ||
        familia ||
        "Peça automotiva",

      registroPrincipal.fabricante ||
        fabricante,

      codigoNormalizado,
    ]
      .filter(Boolean)
      .join(" • "),
  };
}