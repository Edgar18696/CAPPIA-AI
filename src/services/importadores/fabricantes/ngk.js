import { criarParserBase } from "./parserBase";

import { parserNgkBobinas } from "../parsers/parserNgkBobinas";

import { parserNgkVelasCabos } from "../parsers/parserNgkVelasCabos";

import { parserNgkInterruptoresOleo } from "../parsers/parserNgkInterruptoresOleo";

import { parserNgkSensores } from "../parsers/parserNGKSensores";

const importarNgkBase =
  criarParserBase({
    fabricante: "NGK",

    origemCatalogo:
      "Catálogo NGK",

    nomePeca:
      "Autopeça NGK",

    prioridade: 5,

    confiabilidade: 90,

    tamanhoMinimoCodigo: 4,

    montadoras: [
      "FIAT",
      "RENAULT",
      "CHEVROLET",
      "GM",
      "VOLKSWAGEN",
      "VW",
      "FORD",
      "PEUGEOT",
      "CITROEN",
      "HONDA",
      "TOYOTA",
      "NISSAN",
      "HYUNDAI",
      "KIA",
      "MITSUBISHI",
      "MERCEDES",
      "BMW",
      "AUDI",
      "IVECO",
      "JEEP",
      "SUZUKI",
      "SUBARU",
    ],

    motoresExtras:
      "VTEC|I-VTEC|VVT|VVT-I|CVVT|GDI",
  });

function normalizar(
  valor = ""
) {
  return String(
    valor || ""
  )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(
      /[_-]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

/*
 * ============================================================
 * SENSORES NTK
 * ============================================================
 */

function ehCatalogoSensores({
  nomeArquivo = "",
  configuracao = {},
} = {}) {
  const texto =
    normalizar(
      [
        nomeArquivo,

        configuracao
          ?.tipoCatalogo,

        configuracao
          ?.origemCatalogo,
      ]
        .filter(Boolean)
        .join(" ")
    );

  return (
    texto.includes(
      "catalogo sensores"
    ) ||
    texto.includes(
      "catalogo de sensores"
    ) ||
    texto.includes(
      "sensores ntk"
    ) ||
    texto.includes(
      "ntk sensores"
    ) ||
    texto.includes(
      "sensores nivel"
    ) ||
    texto.includes(
      "sensores temperatura"
    ) ||
    texto.includes(
      "sensores rotacao"
    ) ||
    texto.includes(
      "sensores abs"
    ) ||
    texto.includes(
      "sensores velocidade"
    ) ||
    texto.includes(
      "sensores map"
    ) ||
    texto.includes(
      "sensor tps"
    )
  );
}

/*
 * ============================================================
 * INTERRUPTORES DE PRESSÃO DE ÓLEO
 * ============================================================
 */

function ehCatalogoInterruptoresOleo({
  nomeArquivo = "",
  configuracao = {},
} = {}) {
  const texto =
    normalizar(
      [
        nomeArquivo,

        configuracao
          ?.tipoCatalogo,

        configuracao
          ?.origemCatalogo,
      ]
        .filter(Boolean)
        .join(" ")
    );

  return (
    texto.includes(
      "interruptores pressao oleo"
    ) ||
    texto.includes(
      "interruptor pressao oleo"
    ) ||
    texto.includes(
      "interruptores de pressao de oleo"
    ) ||
    texto.includes(
      "interruptor de pressao de oleo"
    ) ||
    texto.includes(
      "pressao de oleo"
    ) ||
    texto.includes(
      "pressao oleo"
    )
  );
}

/*
 * ============================================================
 * VELAS E CABOS
 * ============================================================
 */

function ehCatalogoVelasCabos({
  configuracao = {},
} = {}) {
  const texto =
    normalizar(
      [
        configuracao
          ?.tipoCatalogo,

        configuracao
          ?.origemCatalogo,
      ]
        .filter(Boolean)
        .join(" ")
    );

  return (
    texto.includes(
      "velas cabos"
    ) ||
    texto.includes(
      "vela cabo"
    ) ||
    texto.includes(
      "velas e cabos"
    ) ||
    texto.includes(
      "velas de ignicao"
    ) ||
    texto.includes(
      "cabos de ignicao"
    )
  );
}

/*
 * ============================================================
 * BOBINAS
 * ============================================================
 */

function ehCatalogoBobinas({
  nomeArquivo = "",
  configuracao = {},
} = {}) {
  const tipo =
    normalizar(
      configuracao
        ?.tipoCatalogo
    );

  /*
   * Nunca mandar outros
   * catálogos específicos
   * para Bobinas.
   */

  if (
    tipo.includes(
      "velas cabos"
    ) ||
    tipo.includes(
      "velas e cabos"
    ) ||
    tipo.includes(
      "vela cabo"
    ) ||
    tipo.includes(
      "interruptores pressao oleo"
    ) ||
    tipo.includes(
      "interruptor pressao oleo"
    ) ||
    tipo.includes(
      "sensores"
    )
  ) {
    return false;
  }

  if (
    tipo === "bobinas" ||
    tipo === "bobina"
  ) {
    return true;
  }

  const arquivo =
    normalizar(
      nomeArquivo
    );

  return (
    arquivo.includes(
      "bobina"
    ) ||
    arquivo.includes(
      "bobinas"
    )
  );
}

/*
 * ============================================================
 * IMPORTADOR NGK / NTK
 * ============================================================
 */

export async function importarNgk({
  textoReferencias = "",
  textoAplicacoes = "",
  textoEquivalencias = "",
  paginasAplicacoes = [],
  nomeArquivo = "",
  configuracao = {},
  onProgresso,
} = {}) {
  const textoPaginasAplicacoes =
    !textoAplicacoes &&
    Array.isArray(
      paginasAplicacoes
    )
      ? paginasAplicacoes
          .map(
            (pagina) =>
              pagina?.texto ||
              pagina?.conteudo ||
              ""
          )
          .filter(Boolean)
          .join("\n")
      : "";

  const textoAplicacoesFinal =
    textoAplicacoes ||
    textoPaginasAplicacoes;

  /*
   * ========================================================
   * 1. SENSORES NTK
   * ========================================================
   */

  if (
    ehCatalogoSensores({
      nomeArquivo,
      configuracao,
    })
  ) {
    onProgresso?.(
      "📡 NTK: catálogo de Sensores identificado..."
    );

    const registros =
      await parserNgkSensores({
        textoReferencias,

        textoAplicacoes:
          textoAplicacoesFinal,

        textoEquivalencias,

        paginasAplicacoes,

        nomeArquivo,

        configuracao: {
          ...configuracao,

          fabricante:
            "NTK",

          origemCatalogo:
            configuracao
              ?.origemCatalogo ||
            "Catálogo NTK Sensores",

          tipoCatalogo:
            "sensores",
        },

        onProgresso,
      });

    return {
      fabricante:
        "NTK",

      origemCatalogo:
        configuracao
          ?.origemCatalogo ||
        "Catálogo NTK Sensores",

      registros:
        Array.isArray(
          registros
        )
          ? registros
          : [],

      totalRegistros:
        Array.isArray(
          registros
        )
          ? registros.length
          : 0,
    };
  }

  /*
   * ========================================================
   * 2. INTERRUPTORES DE PRESSÃO DE ÓLEO
   * ========================================================
   */

  if (
    ehCatalogoInterruptoresOleo({
      nomeArquivo,
      configuracao,
    })
  ) {
    onProgresso?.(
      "🛢️ NTK: catálogo de Interruptores de Pressão de Óleo identificado..."
    );

    const registros =
      await parserNgkInterruptoresOleo({
        textoReferencias,

        textoAplicacoes:
          textoAplicacoesFinal,

        textoEquivalencias,

        nomeArquivo,

        configuracao: {
          ...configuracao,

          fabricante:
            "NTK",

          origemCatalogo:
            configuracao
              ?.origemCatalogo ||
            "Catálogo NTK Interruptores de Pressão de Óleo",

          tipoCatalogo:
            "interruptores_pressao_oleo",
        },

        onProgresso,
      });

    return {
      fabricante:
        "NTK",

      origemCatalogo:
        configuracao
          ?.origemCatalogo ||
        "Catálogo NTK Interruptores de Pressão de Óleo",

      registros:
        Array.isArray(
          registros
        )
          ? registros
          : [],

      totalRegistros:
        Array.isArray(
          registros
        )
          ? registros.length
          : 0,
    };
  }

  /*
   * ========================================================
   * 3. VELAS E CABOS
   * ========================================================
   */

  if (
    ehCatalogoVelasCabos({
      configuracao,
    })
  ) {
    onProgresso?.(
      "🔥 NGK: catálogo de Velas e Cabos identificado..."
    );

    const registros =
      await parserNgkVelasCabos({
        textoReferencias,

        textoAplicacoes:
          textoAplicacoesFinal,

        textoEquivalencias,

        nomeArquivo,

        configuracao: {
          ...configuracao,

          fabricante:
            "NGK",

          origemCatalogo:
            configuracao
              ?.origemCatalogo ||
            "Catálogo NGK Velas e Cabos",

          tipoCatalogo:
            "velas_cabos",
        },

        onProgresso,
      });

    return {
      fabricante:
        "NGK",

      origemCatalogo:
        configuracao
          ?.origemCatalogo ||
        "Catálogo NGK Velas e Cabos",

      registros:
        Array.isArray(
          registros
        )
          ? registros
          : [],

      totalRegistros:
        Array.isArray(
          registros
        )
          ? registros.length
          : 0,
    };
  }

  /*
   * ========================================================
   * 4. BOBINAS
   * ========================================================
   */

  if (
    ehCatalogoBobinas({
      nomeArquivo,
      configuracao,
    })
  ) {
    onProgresso?.(
      "⚡ NGK: catálogo de bobinas identificado..."
    );

    const registros =
      await parserNgkBobinas({
        textoReferencias,

        textoAplicacoes:
          textoAplicacoesFinal,

        textoEquivalencias,

        nomeArquivo,

        configuracao: {
          ...configuracao,

          fabricante:
            "NGK",

          origemCatalogo:
            configuracao
              ?.origemCatalogo ||
            "Catálogo NGK Bobinas",

          tipoCatalogo:
            "bobinas",
        },

        onProgresso,
      });

    return {
      fabricante:
        "NGK",

      origemCatalogo:
        configuracao
          ?.origemCatalogo ||
        "Catálogo NGK Bobinas",

      registros:
        Array.isArray(
          registros
        )
          ? registros
          : [],

      totalRegistros:
        Array.isArray(
          registros
        )
          ? registros.length
          : 0,
    };
  }

  /*
   * ========================================================
   * 5. FALLBACK NGK
   * ========================================================
   */

  return importarNgkBase({
    textoReferencias,

    textoAplicacoes:
      textoAplicacoesFinal,

    textoEquivalencias,

    paginasAplicacoes,

    nomeArquivo,

    configuracao,

    onProgresso,
  });
}

export default importarNgk;
