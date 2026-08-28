export const configuracaoRenault = {
  chaves: [
    "renault",
    "dacia",
    "motrio",
    "renault motrio",
  ],

  fabricante:
    "Renault",

  origemCatalogo:
    "Catálogo Renault Motrio 2024",

  /*
   * ==========================================================
   * CATÁLOGO MOTRIO 2024
   * ==========================================================
   *
   * O PDF é um catálogo único com várias famílias:
   *
   * 04–22  Lubrificantes
   * 24–25  Palhetas
   * 26–27  Filtros de Ar
   * 28–30  Filtros de Cabine
   * 31–33  Filtros de Combustível
   * 34–36  Filtros de Óleo
   * 37–38  Pastilhas de Freio
   * 39–40  Discos de Freio
   * 41–42  Bomba d'Água
   * 43     Kit de Correias
   *
   * Por isso a configuração principal lê 4 até 43.
   * O parser Renault/Motrio identifica a família
   * dentro do próprio conteúdo.
   * ==========================================================
   */

  paginaInicialAplicacoes:
    4,

  paginaFinalAplicacoes:
    43,

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

  tipoCatalogo:
    "motrio_2024",

  catalogos: {
    motrio2024: {
      tipoCatalogo:
        "motrio_2024",

      origemCatalogo:
        "Catálogo Renault Motrio 2024",

      paginaInicialAplicacoes:
        4,

      paginaFinalAplicacoes:
        43,

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

      palavrasChave: [
        "catalogo renault motrio 2024",
        "catalogo motrio 2024",
        "renault motrio",
        "motrio 2024",
        "catalogomotrio 2024",
      ],
    },

    lubrificantes: {
      tipoCatalogo:
        "lubrificantes",

      origemCatalogo:
        "Catálogo Renault Motrio 2024 - Lubrificantes",

      paginaInicialAplicacoes:
        4,

      paginaFinalAplicacoes:
        22,

      paginaInicialEquivalencias:
        null,

      paginaFinalEquivalencias:
        null,

      palavrasChave: [
        "lubrificantes",
        "motrio performa",
        "motrio ultra",
        "motrio super",
      ],
    },

    palhetas: {
      tipoCatalogo:
        "palhetas",

      origemCatalogo:
        "Catálogo Renault Motrio 2024 - Palhetas",

      paginaInicialAplicacoes:
        24,

      paginaFinalAplicacoes:
        25,

      paginaInicialEquivalencias:
        null,

      paginaFinalEquivalencias:
        null,

      palavrasChave: [
        "palhetas",
      ],
    },

    filtrosAr: {
      tipoCatalogo:
        "filtros_ar",

      origemCatalogo:
        "Catálogo Renault Motrio 2024 - Filtros de Ar",

      paginaInicialAplicacoes:
        26,

      paginaFinalAplicacoes:
        27,

      paginaInicialEquivalencias:
        null,

      paginaFinalEquivalencias:
        null,

      palavrasChave: [
        "filtros de ar",
        "filtro de ar",
      ],
    },

    filtrosCabine: {
      tipoCatalogo:
        "filtros_cabine",

      origemCatalogo:
        "Catálogo Renault Motrio 2024 - Filtros de Cabine",

      paginaInicialAplicacoes:
        28,

      paginaFinalAplicacoes:
        30,

      paginaInicialEquivalencias:
        null,

      paginaFinalEquivalencias:
        null,

      palavrasChave: [
        "filtros de cabine",
        "filtro de cabine",
      ],
    },

    filtrosCombustivel: {
      tipoCatalogo:
        "filtros_combustivel",

      origemCatalogo:
        "Catálogo Renault Motrio 2024 - Filtros de Combustível",

      paginaInicialAplicacoes:
        31,

      paginaFinalAplicacoes:
        33,

      paginaInicialEquivalencias:
        null,

      paginaFinalEquivalencias:
        null,

      palavrasChave: [
        "filtros de combustível",
        "filtros de combustivel",
        "filtro de combustível",
        "filtro de combustivel",
      ],
    },

    filtrosOleo: {
      tipoCatalogo:
        "filtros_oleo",

      origemCatalogo:
        "Catálogo Renault Motrio 2024 - Filtros de Óleo",

      paginaInicialAplicacoes:
        34,

      paginaFinalAplicacoes:
        36,

      paginaInicialEquivalencias:
        null,

      paginaFinalEquivalencias:
        null,

      palavrasChave: [
        "filtros de óleo",
        "filtros de oleo",
        "filtros de óleo lubrificante",
        "filtro de óleo",
        "filtro de oleo",
      ],
    },

    pastilhasFreio: {
      tipoCatalogo:
        "pastilhas_freio",

      origemCatalogo:
        "Catálogo Renault Motrio 2024 - Pastilhas de Freio",

      paginaInicialAplicacoes:
        37,

      paginaFinalAplicacoes:
        38,

      paginaInicialEquivalencias:
        null,

      paginaFinalEquivalencias:
        null,

      palavrasChave: [
        "pastilhas de freio",
        "pastilha de freio",
      ],
    },

    discosFreio: {
      tipoCatalogo:
        "discos_freio",

      origemCatalogo:
        "Catálogo Renault Motrio 2024 - Discos de Freio",

      paginaInicialAplicacoes:
        39,

      paginaFinalAplicacoes:
        40,

      paginaInicialEquivalencias:
        null,

      paginaFinalEquivalencias:
        null,

      palavrasChave: [
        "discos de freio",
        "disco de freio",
      ],
    },

    bombaAgua: {
      tipoCatalogo:
        "bombas_agua",

      origemCatalogo:
        "Catálogo Renault Motrio 2024 - Bomba d'Água",

      paginaInicialAplicacoes:
        41,

      paginaFinalAplicacoes:
        42,

      paginaInicialEquivalencias:
        null,

      paginaFinalEquivalencias:
        null,

      palavrasChave: [
        "bomba d'água",
        "bomba d agua",
        "bomba de água",
        "bomba de agua",
      ],
    },

    kitCorreias: {
      tipoCatalogo:
        "kits_correias",

      origemCatalogo:
        "Catálogo Renault Motrio 2024 - Kit de Correias",

      paginaInicialAplicacoes:
        43,

      paginaFinalAplicacoes:
        43,

      paginaInicialEquivalencias:
        null,

      paginaFinalEquivalencias:
        null,

      palavrasChave: [
        "kit de correias",
        "kit correia",
        "kit correias",
      ],
    },
  },
};

export default configuracaoRenault;