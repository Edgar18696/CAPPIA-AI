import { importarBosch } from "../fabricantes/bosch";

export const configuracaoBosch = {
  chaves: ["bosch"],

  fabricante: "Bosch",

  origemCatalogo:
    "Catálogo Bosch Sondas 2020",

  paginaInicialAplicacoes: 15,
  paginaFinalAplicacoes: 86,

  paginaInicialEquivalencias: 87,
  paginaFinalEquivalencias: 96,

  catalogos: {
    sondas: {
      tipoCatalogo: "sondas",

      origemCatalogo:
        "Catálogo Bosch Sondas 2020",

      paginaInicialAplicacoes: 15,
      paginaFinalAplicacoes: 86,

      paginaInicialEquivalencias: 87,
      paginaFinalEquivalencias: 96,
    },

    bombas: {
      tipoCatalogo: "bombas",

      origemCatalogo:
        "Catálogo Bosch Bombas de Combustível 2019-2020",

      paginaInicialAplicacoes: 12,
      paginaFinalAplicacoes: 164,

      paginaInicialEquivalencias: null,
      paginaFinalEquivalencias: null,
    },

    ignicao: {
      tipoCatalogo: "ignicao_completo",

      origemCatalogo:
        "Catálogo Bosch Velas, Cabos e Bobinas 2019-2020",

      paginaInicialAplicacoes: 20,
      paginaFinalAplicacoes: 217,

      paginaInicialEquivalencias: null,
      paginaFinalEquivalencias: null,
    },

    bobinas: {
      tipoCatalogo: "ignicao_completo",

      origemCatalogo:
        "Catálogo Bosch Velas, Cabos e Bobinas 2019-2020",

      paginaInicialAplicacoes: 20,
      paginaFinalAplicacoes: 217,

      paginaInicialEquivalencias: null,
      paginaFinalEquivalencias: null,
    },

    velas: {
      tipoCatalogo: "ignicao_completo",

      origemCatalogo:
        "Catálogo Bosch Velas, Cabos e Bobinas 2019-2020",

      paginaInicialAplicacoes: 20,
      paginaFinalAplicacoes: 217,

      paginaInicialEquivalencias: null,
      paginaFinalEquivalencias: null,
    },

    diesel_remanufaturado: {
      tipoCatalogo:
        "diesel_remanufaturado",

      origemCatalogo:
        "Catálogo Bosch Diesel Remanufaturado 2020",

      paginaInicialAplicacoes: 1,
      paginaFinalAplicacoes: null,

      paginaInicialEquivalencias: null,
      paginaFinalEquivalencias: null,
    },

    diesel: {
      tipoCatalogo: "diesel",

      origemCatalogo:
        "Catálogo Bosch Diesel 2018",

      paginaInicialAplicacoes: 1,
      paginaFinalAplicacoes: null,

      paginaInicialEquivalencias: null,
      paginaFinalEquivalencias: null,
    },

    alternadores: {
      tipoCatalogo: "alternadores",

      origemCatalogo:
        "Catálogo Bosch Alternadores e Motores de Partida 2019-2020",

      paginaInicialAplicacoes: 5,
      paginaFinalAplicacoes: 125,

      paginaInicialEquivalencias: null,
      paginaFinalEquivalencias: null,
    },

    alternadores_pesados: {
      tipoCatalogo:
        "alternadores_pesados",

      origemCatalogo:
        "Catálogo Bosch Alternadores e Motores de Partida Veículos Pesados 2020-2021",

      paginaInicialAplicacoes: 2,
      paginaFinalAplicacoes: 44,

      paginaInicialEquivalencias: 46,
      paginaFinalEquivalencias: 59,

      palavrasChave: [
        "veículos pesados",
        "veiculos pesados",
        "alternadores",
        "motor de partida",
        "motores de partida",
        "caminhões",
        "caminhoes",
        "agrale",
        "daf",
        "ford",
        "iveco",
        "mercedes-benz",
        "scania",
        "volkswagen",
        "volvo",
      ],
    },

    abs: {
      tipoCatalogo: "abs",

      origemCatalogo:
        "Catálogo Bosch Sensor ABS 2019-2020",

      paginaInicialAplicacoes: 5,
      paginaFinalAplicacoes: 15,

            paginaInicialEquivalencias: null,
      paginaFinalEquivalencias: null,
    },

    gasolina_2023: {
      tipoCatalogo: "gasolina_2023",

      origemCatalogo:
        "Bosch Ignition and Gasoline Injection Parts and Sensors Product Portfolio 2023",

      paginaInicialAplicacoes: 20,
      paginaFinalAplicacoes: 180,

      paginaInicialEquivalencias: null,
      paginaFinalEquivalencias: null,

      palavrasChave: [
        "ignition",
        "gasoline",
        "injection",
        "injector",
        "gasoline injector",
        "high-pressure injector",
        "fuel pump",
        "fuel supply module",
        "ignition cable",
        "ignition coil",
        "lambda",
        "oxygen sensor",
        "crankshaft sensor",
        "camshaft sensor",
        "knock sensor",
        "air mass meter",
        "pressure sensor",
        "temperature sensor",
        "speed sensor",
        "throttle valve",
        "product portfolio",
        "2023",
      ],
    },

    gasolina_2025: {
      tipoCatalogo: "gasolina_2025",

      origemCatalogo:
        "Bosch Gasoline System Product Portfolio 2025",

      paginaInicialAplicacoes: 24,
      paginaFinalAplicacoes: 206,

      paginaInicialEquivalencias: null,
      paginaFinalEquivalencias: null,

      palavrasChave: [
        "gasoline",
        "gasolina",
        "injection",
        "injector",
        "injection valve",
        "gdi",
        "fuel pump",
        "fuel supply module",
        "ignition coil",
        "lambda",
        "sensor",
        "crankshaft",
        "camshaft",
        "knock",
        "air mass",
        "maf",
        "map",
        "pressure",
        "temperature",
        "accelerator pedal",
        "throttle",
      ],
    },

    palhetas: {
      tipoCatalogo: "palhetas",

      origemCatalogo:
        "Catálogo Bosch Palhetas 2024",

      paginaInicialAplicacoes: 10,
      paginaFinalAplicacoes: 49,

      paginaInicialEquivalencias: null,
      paginaFinalEquivalencias: null,

      palavrasChave: [
        "palhetas",
        "palheta",
        "aerofit",
        "aerotwin",
        "eco",
        "twin",
        "rear",
        "motorista",
        "passageiro",
        "traseira",
      ],
    },

    filtros: {
      tipoCatalogo: "filtros",

      origemCatalogo:
        "Catálogo Bosch Filtros Linha Leve 2019-2020",

      paginaInicialAplicacoes: 21,
      paginaFinalAplicacoes: 86,

      paginaInicialEquivalencias: 87,
      paginaFinalEquivalencias: 124,

      palavrasChave: [
        "filtro",
        "filtros",
        "linha leve",
      ],
    },

    sensores: {
      tipoCatalogo: "sensores",

      origemCatalogo:
        "Catálogo Bosch Sensores",

      paginaInicialAplicacoes: 1,
      paginaFinalAplicacoes: null,

      paginaInicialEquivalencias: null,
      paginaFinalEquivalencias: null,

      palavrasChave: [
        "sensor",
        "sensores",
        "map",
        "maf",
        "tps",
        "rotação",
        "fase",
        "temperatura",
        "pressão",
        "pedal",
      ],
    },

    baterias_moto: {
      tipoCatalogo: "baterias_moto",

      origemCatalogo:
        "Catálogo Bosch Baterias Motocicletas 2020-2021",

      paginaInicialAplicacoes: 6,
      paginaFinalAplicacoes: 17,

      paginaInicialEquivalencias: null,
      paginaFinalEquivalencias: null,
    },
  },

  formatoParser: "texto",

  parser: importarBosch,
};