import { importarNgk } from "../fabricantes/ngk";

export const configuracaoNgk = {
  chaves: [
    "ngk",
    "ntk",
    "ngk ntk",
  ],

  fabricante:
    "NGK",

  origemCatalogo:
    "Catálogo NGK",

  paginaInicialAplicacoes:
    1,

  paginaFinalAplicacoes:
    null,

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
    "ngk",

  parser:
    importarNgk,

  catalogos: {
    /*
     * =====================================================
     * BOBINAS DE IGNIÇÃO
     * =====================================================
     *
     * JÁ APROVADO.
     * =====================================================
     */

    bobinas: {
      tipoCatalogo:
        "bobinas",

      origemCatalogo:
        "Catálogo NGK Bobinas",

      paginaInicialAplicacoes:
        5,

      paginaFinalAplicacoes:
        26,

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
        "ngk bobinas",
        "bobinas ngk",
        "bobinas de ignição",
        "bobinas de ignicao",
      ],
    },

    /*
     * =====================================================
     * BOBINAS 2018
     * =====================================================
     */

    bobinas2018: {
      tipoCatalogo:
        "bobinas",

      origemCatalogo:
        "Catálogo NGK Bobinas 2018",

      paginaInicialAplicacoes:
        1,

      paginaFinalAplicacoes:
        2,

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
        "bobina 2018",
        "bobina-2018",
        "bobinas 2018",
      ],
    },

    /*
     * =====================================================
     * VELAS E CABOS DE IGNIÇÃO
     * =====================================================
     *
     * JÁ APROVADO.
     * =====================================================
     */

    velasCabos: {
      tipoCatalogo:
        "velas_cabos",

      origemCatalogo:
        "Catálogo NGK Velas e Cabos",

      paginaInicialAplicacoes:
        28,

      paginaFinalAplicacoes:
        114,

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
        "velas e cabos",
        "velas e cabos de ignição",
        "velas e cabos de ignicao",
        "velas cabos",
        "vela cabo",
        "cabos de ignição",
        "cabos de ignicao",
      ],
    },

    /*
     * =====================================================
     * NTK - INTERRUPTORES DE PRESSÃO DE ÓLEO
     * =====================================================
     *
     * JÁ APROVADO.
     * =====================================================
     */

    interruptoresOleo: {
      tipoCatalogo:
        "interruptores_pressao_oleo",

      origemCatalogo:
        "Catálogo NTK Interruptores de Pressão de Óleo",

      paginaInicialAplicacoes:
        1,

      paginaFinalAplicacoes:
        2,

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
        "ngk catalogos",
        "ntk interruptores",
        "interruptores de pressão de óleo",
        "interruptores de pressao de oleo",
        "interruptor de pressão de óleo",
        "interruptor de pressao de oleo",
        "pressão de óleo",
        "pressao de oleo",
        "opa1",
      ],
    },

    /*
     * =====================================================
     * NTK - SENSORES
     * =====================================================
     *
     * Catálogo:
     * CATALOGO_SENSORES-1 NGK / NTK
     *
     * PDF:
     * páginas 1 até 24.
     *
     * Famílias identificadas:
     *
     * FLN = nível de combustível
     * CTN = temperatura
     * CRN / CRC = rotação
     * AWN = ABS
     * VSN = velocidade
     * THN = TPS
     * APN / APT = MAP
     *
     * =====================================================
     */

    sensores: {
      tipoCatalogo:
        "sensores",

      origemCatalogo:
        "Catálogo NTK Sensores",

      paginaInicialAplicacoes:
        1,

      paginaFinalAplicacoes:
        24,

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
        "catalogo sensores",
        "catálogo sensores",
        "catalogo de sensores",
        "catálogo de sensores",
        "sensores ntk",
        "ntk sensores",
        "sensores ngk",
        "sensor de nível",
        "sensor de nivel",
        "sensor de temperatura",
        "sensor de rotação",
        "sensor de rotacao",
        "sensor abs",
        "sensor de velocidade",
        "sensor tps",
        "sensor map",
        "fln",
        "ctn",
        "crn",
        "crc",
        "awn",
        "vsn",
        "thn",
        "apn",
        "apt",
      ],
    },
  },
};

export default configuracaoNgk;