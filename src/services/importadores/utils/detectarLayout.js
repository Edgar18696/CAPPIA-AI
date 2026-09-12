import { detectarCatalogoMagneti } from "./fabricantes/magneti";

function normalizar(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function contem(texto, palavras = []) {
  return palavras.some((palavra) =>
    texto.includes(
      normalizar(palavra)
    )
  );
}

export default function detectarLayout({
  fabricante = "",
  nomeArquivo = "",
  configuracao = {},
} = {}) {
  const texto = normalizar(
    [
      fabricante,
      nomeArquivo,
      configuracao.fabricante,
      configuracao.tipoCatalogo,
      configuracao.origemCatalogo,
    ]
      .filter(Boolean)
      .join(" ")
  );

  const textoFabricante =
    normalizar(
      [
        fabricante,
        configuracao.fabricante,
      ]
        .filter(Boolean)
        .join(" ")
    );

  const textoArquivo =
    normalizar(
      nomeArquivo
    );

  const ehMagnetiMarelli =
    contem(
      textoFabricante,
      [
        "magneti marelli",
        "magneti",
        "marelli",
      ]
    );

  /*
   * =====================================================
   * MAGNETI MARELLI — BICOS INJETORES 2016
   * =====================================================
   *
   * PRIORIDADE ABSOLUTA.
   *
   * PDF:
   * Parts_Electronic systems and ignition_EN.pdf
   *
   * Seção:
   * FUEL INJECTOR / INIETTORE
   *
   * Páginas físicas:
   * 1363 até 1379
   *
   * Famílias:
   * FEI
   * IPM
   * IWP
   * =====================================================
   */

 const pareceCatalogoBicos2016 =
  !textoArquivo.includes(
    "map"
  ) &&
  contem(
    textoArquivo,
    [
      "parts electronic systems and ignition en",
      "parts electronic systems and ignition",

      // PDF separado do Buyers Guide
      "magneti marelli buyers guide section1 correto",
      "magneti marelli buyers guide section1",
      "buyers guide section1 correto",
      "buyers guide section1",
      "buyers guide section 1",
    ]
  );
  
  if (
    pareceCatalogoBicos2016 &&
    ehMagnetiMarelli
  ) {
    console.log(
      "🎯 DETECTAR LAYOUT: MAGNETI BICOS INJETORES 2016"
    );

    return {
      fabricante:
        "magneti_marelli",

      layout:
        "sistemas_eletronicos",

      configuracao: {
        ...configuracao,

        fabricante:
          "Magneti Marelli",

        tipoCatalogo:
          "sistemas_eletronicos",

        subTipoCatalogo:
          "bicos_injetores",

        origemCatalogo:
          "Catálogo Magneti Marelli Bicos Injetores 2016",

        paginaInicialAplicacoes:
          1363,

        paginaFinalAplicacoes:
          1379,

        paginaInicialReferencias:
          null,

        paginaFinalReferencias:
          null,

        paginaInicialEquivalencias:
          null,

        paginaFinalEquivalencias:
          null,

        formatoParser:
          "texto",

        familiasCodigo: [
          "FEI",
          "IPM",
          "IWP",
        ],
      },

      confianca:
        100,
    };
  }

  /*
   * =====================================================
   * MAGNETI MARELLI — DISCOS DE FREIO
   * =====================================================
   */

  const pareceCatalogoDiscosFreio =
    contem(
      textoArquivo,
      [
        "brake discs",
        "brake_discs",
        "brake disc",
        "brake_disc",
        "dischi freno",
        "dischi_freno",
        "disco freno",
        "disco_freno",
        "discos de freio",
        "discos_de_freio",
        "disco de freio",
        "disco_de_freio",
        "discos de freno",
        "discos_de_freno",
      ]
    ) ||
    contem(
      texto,
      [
        "discos_freio",
        "catalogo magneti marelli brake discs",
        "catalogo magneti marelli discos de freio",
      ]
    );

  if (
    pareceCatalogoDiscosFreio &&
    (
      ehMagnetiMarelli ||
      contem(
        textoArquivo,
        [
          "parts_brake",
          "parts brake",
          "_mm_",
          "marelli",
        ]
      )
    )
  ) {
    return {
      fabricante:
        "magneti_marelli",

      layout:
        "discos_freio",

      configuracao: {
        ...configuracao,

        fabricante:
          "Magneti Marelli",

        tipoCatalogo:
          "discos_freio",

        origemCatalogo:
          "Catálogo Magneti Marelli Brake Discs 2022",
      },

      confianca:
        100,
    };
  }

  /*
   * =====================================================
   * MAGNETI MARELLI — BOMBAS DE ÁGUA
   * =====================================================
   */

  const pareceCatalogoBombasAgua =
    contem(
      textoArquivo,
      [
        "water pump",
        "water pumps",
        "water_pump",
        "water_pumps",
        "pompe acqua",
        "pompe_acqua",
        "pompa acqua",
        "pompa_acqua",
        "bomba de agua",
        "bombas de agua",
        "bomba d agua",
        "bombas d agua",
      ]
    ) ||
    contem(
      texto,
      [
        "tipo catalogo bombas_agua",
        "bombas_agua",
        "catalogo magneti marelli bombas de agua",
      ]
    );

  if (
    ehMagnetiMarelli &&
    pareceCatalogoBombasAgua
  ) {
    return {
      fabricante:
        "magneti_marelli",

      layout:
        "bombas_agua",

      configuracao: {
        ...configuracao,

        fabricante:
          "Magneti Marelli",

        tipoCatalogo:
          "bombas_agua",

        origemCatalogo:
          configuracao
            .origemCatalogo ||
          "Catálogo Magneti Marelli Bombas de Água",
      },

      confianca:
        100,
    };
  }

  /*
   * =====================================================
   * MAGNETI MARELLI — DETECTOR NORMAL
   * =====================================================
   */

  const catalogoMagneti =
    detectarCatalogoMagneti(
      nomeArquivo
    );

  if (
    catalogoMagneti
  ) {
    return {
      fabricante:
        "magneti_marelli",

      layout:
        normalizar(
          catalogoMagneti
            .tipoCatalogo
        ),

      configuracao:
        catalogoMagneti,

      confianca:
        100,
    };
  }

  /*
   * =====================================================
   * MAGNETI MARELLI — CONFIGURAÇÃO CONHECIDA
   * =====================================================
   */

  if (
    ehMagnetiMarelli &&
    configuracao
      .tipoCatalogo
  ) {
    return {
      fabricante:
        "magneti_marelli",

      layout:
        normalizar(
          configuracao
            .tipoCatalogo
        ),

      configuracao: {
        ...configuracao,

        fabricante:
          "Magneti Marelli",
      },

      confianca:
        100,
    };
  }

  /*
   * =====================================================
   * BOSCH — STH
   * =====================================================
   */

  if (
    contem(
      texto,
      [
        "porta injetor",
        "porta-injetor",
        "sth",
      ]
    )
  ) {
    return {
      fabricante:
        "bosch",

      layout:
        "diesel_sth",

      confianca:
        100,
    };
  }

  /*
   * =====================================================
   * BOSCH — REMAN
   * =====================================================
   */

  if (
    contem(
      texto,
      [
        "reman",
        "remanufaturado",
        "crin hpc",
      ]
    )
  ) {
    return {
      fabricante:
        "bosch",

      layout:
        "diesel_remanufaturado",

      confianca:
        100,
    };
  }

  /*
   * =====================================================
   * BOSCH — ALTERNADORES / PARTIDA
   * =====================================================
   */

  if (
    contem(
      texto,
      [
        "alternador",
        "alternadores",
        "motor de partida",
        "motores de partida",
        "catalogo mh cy",
        "catalogo_mh_cy",
        "mh cy 2020",
        "mh_cy_2020",
      ]
    )
  ) {
    return {
      fabricante:
        "bosch",

      layout:
        "alternadores",

      confianca:
        100,
    };
  }

  /*
   * =====================================================
   * BOSCH — DIESEL
   * =====================================================
   */

  if (
    contem(
      texto,
      [
        "diesel",
        "common rail",
        "bico diesel",
        "injetor diesel",
      ]
    )
  ) {
    return {
      fabricante:
        "bosch",

      layout:
        "diesel",

      confianca:
        100,
    };
  }

  /*
   * =====================================================
   * BOSCH — BOMBAS
   * =====================================================
   */

  if (
    contem(
      texto,
      [
        "bomba de combustivel",
        "bombas de combustivel",
        "bomba combustivel",
      ]
    )
  ) {
    return {
      fabricante:
        "bosch",

      layout:
        "bombas",

      confianca:
        100,
    };
  }

  /*
   * =====================================================
   * BOSCH — IGNIÇÃO
   * =====================================================
   */

  if (
    contem(
      texto,
      [
        "vela cabo bobina",
        "velas cabos bobinas",
        "velas, cabos e bobinas",
        "ignicao completo",
      ]
    )
  ) {
    return {
      fabricante:
        "bosch",

      layout:
        "ignicao_completo",

      confianca:
        100,
    };
  }

  /*
   * =====================================================
   * BOSCH — PALHETAS
   * =====================================================
   */

  if (
    contem(
      texto,
      [
        "palheta",
        "palhetas",
        "limpador de para-brisa",
        "limpador para-brisa",
      ]
    )
  ) {
    return {
      fabricante:
        "bosch",

      layout:
        "palhetas",

      confianca:
        100,
    };
  }

  /*
   * =====================================================
   * BOSCH — FILTROS
   * =====================================================
   */

  if (
    contem(
      texto,
      [
        "filtro",
        "filtros",
        "filtro de oleo",
        "filtro de ar",
        "filtro de combustivel",
        "filtro de cabine",
      ]
    )
  ) {
    return {
      fabricante:
        "bosch",

      layout:
        "filtros",

      confianca:
        100,
    };
  }

  /*
   * =====================================================
   * BOSCH — SONDAS
   * =====================================================
   */

  if (
    contem(
      texto,
      [
        "sonda lambda",
        "sondas lambda",
        "sonda",
        "sensor de oxigenio",
      ]
    )
  ) {
    return {
      fabricante:
        "bosch",

      layout:
        "sondas",

      confianca:
        100,
    };
  }

  /*
   * =====================================================
   * CONFIGURAÇÃO INFORMADA
   * =====================================================
   */

  if (
    configuracao
      .tipoCatalogo
  ) {
    return {
      fabricante:
        normalizar(
          fabricante
        ) ||
        normalizar(
          configuracao
            .fabricante
        ) ||
        "bosch",

      layout:
        normalizar(
          configuracao
            .tipoCatalogo
        ),

      configuracao,

      confianca:
        90,
    };
  }

  /*
   * =====================================================
   * DESCONHECIDO
   * =====================================================
   */

  return {
    fabricante:
      normalizar(
        fabricante
      ) ||
      "desconhecido",

    layout:
      "desconhecido",

    confianca:
      0,
  };
}