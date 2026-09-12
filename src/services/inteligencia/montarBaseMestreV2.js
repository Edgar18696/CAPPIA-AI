import {
  gerarInsights,
} from "./gerarInsights";
import {
  calcularQualidadeBase,
} from "./calcularQualidadeBase";

function texto(valor) {
  return String(valor || "").trim();
}

function listaUnica(valores = []) {
  return [
    ...new Set(
      valores
        .map((item) => texto(item))
        .filter(Boolean)
    ),
  ];
}

function obterCodigoEquivalente(item) {
  if (typeof item === "string") {
    return item;
  }

  return (
    item?.codigo ||
    item?.codigo_oem ||
    item?.codigo_equivalente ||
    item?.equivalente ||
    ""
  );
}

export function montarBaseMestreV2({
  codigoOriginal = "",
  codigoNormalizado = "",
  fabricante = "",
  familia = "",
  inteligencia = {},
  diagnostico = {},
  confianca = {},
} = {}) {
  const registros =
    Array.isArray(inteligencia?.registros)
      ? inteligencia.registros
      : [];

  const equivalentesOriginais =
    Array.isArray(inteligencia?.equivalentes)
      ? inteligencia.equivalentes
      : [];

  const principal =
    registros[0] || {};

  const equivalentes = listaUnica([
    ...(diagnostico?.equivalentes || []),

    ...equivalentesOriginais.map(
      obterCodigoEquivalente
    ),

    ...registros.map(
      (item) =>
        item.codigo_equivalente
    ),
  ]);

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

  const observacoes = listaUnica(
    registros.map(
      (item) =>
        item.observacao ||
        item.observacoes
    )
  );

  const fontes = listaUnica([
    ...(diagnostico?.fontes || []),

    ...registros.map(
      (item) =>
        item.origem_catalogo ||
        item.fonte ||
        item.arquivo_catalogo ||
        item.fabricante
    ),
  ]);

  const aplicacoes = registros
    .map((item) => ({
      montadora:
        texto(item.montadora),

      modelo:
        texto(item.modelo),

      motor:
        texto(item.motor),

      anoInicio:
        item.ano_inicio ?? null,

      anoFim:
        item.ano_fim ?? null,

      observacao:
        texto(
          item.observacao ||
          item.observacoes
        ),

      origem:
        texto(
          item.origem_catalogo ||
          item.fonte
        ),
    }))
    .filter(
      (item) =>
        item.montadora ||
        item.modelo ||
        item.motor
    );

  const base = {
    codigoOriginal:
      texto(codigoOriginal),

    codigoPrincipal:
      texto(
        diagnostico?.codigoPrincipal ||
        principal.codigo_oem ||
        principal.codigo ||
        principal.oem ||
        codigoNormalizado
      ),

    codigoNormalizado:
      texto(codigoNormalizado),

    peca:
      texto(
        diagnostico?.peca ||
        principal.peca ||
        principal.descricao ||
        familia ||
        "Peça automotiva"
      ),

    fabricante:
      texto(
        diagnostico?.fabricante ||
        principal.fabricante ||
        fabricante ||
        "Não identificado"
      ),

    familia:
      texto(
        diagnostico?.familia ||
        principal.familia ||
        familia ||
        "Não identificada"
      ),

    equivalentes,

    montadoras,

    modelos,

    motores,

    aplicacoes,

    observacoes,

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

    origem:
      "Motor de Inteligência PAIIA V2",

    atualizadoEm:
      new Date().toISOString(),
  };
const baseFinal = {
  ...base,

  insights:
    gerarInsights({
      ...base,

      fabricantes: [
        base.fabricante,
      ],
    }),
};

return {
  ...baseFinal,

  qualidade:
    calcularQualidadeBase(
      baseFinal
    ),
};
}