export const BOSCH_MASTER = {
  fabricante: "Bosch",

  familias: {
    sondas: {
      id: "sondas",
      nome: "Sondas Lambda",
      pecaPadrao: "Sonda Lambda",
      parser: "parserBoschSondas",
      palavrasChave: [
        "sonda",
        "sondas",
        "lambda",
        "oxigenio",
        "sensor de oxigenio",
      ],
    },

    sensores: {
      id: "sensores",
      nome: "Sensores",
      pecaPadrao: "Sensor Automotivo",
      parser: "parserBoschSensores",
      palavrasChave: [
        "sensor",
        "sensores",
        "map",
        "maf",
        "pressao",
        "temperatura",
        "rotacao",
        "fase",
        "detonacao",
      ],
    },

    bombas: {
      id: "bombas",
      nome: "Bombas de Combustível",
      pecaPadrao: "Bomba de Combustível",
      parser: "parserBoschBombas",
      palavrasChave: [
        "bomba",
        "bombas",
        "combustivel",
        "fuel pump",
      ],
    },

    bicos: {
      id: "bicos",
      nome: "Válvulas de Injeção",
      pecaPadrao: "Bico Injetor",
      parser: "parserBoschBicos",
      palavrasChave: [
        "bico",
        "bicos",
        "injetor",
        "injetores",
        "valvula de injecao",
        "valvulas de injecao",
      ],
    },

    diesel: {
      id: "diesel",
      nome: "Linha Diesel",
      pecaPadrao: "Componente Diesel",
      parser: "parserBoschDiesel",
      palavrasChave: [
        "diesel",
        "common rail",
        "injetor diesel",
        "bomba diesel",
      ],
    },

    bobinas: {
      id: "bobinas",
      nome: "Bobinas de Ignição",
      pecaPadrao: "Bobina de Ignição",
      parser: "parserBoschBobinas",
      palavrasChave: [
        "bobina",
        "bobinas",
        "ignicao",
      ],
    },

    velas: {
      id: "velas",
      nome: "Velas de Ignição",
      pecaPadrao: "Vela de Ignição",
      parser: "parserBoschVelas",
      palavrasChave: [
        "vela",
        "velas",
        "spark plug",
      ],
    },

    cabos: {
      id: "cabos",
      nome: "Cabos de Ignição",
      pecaPadrao: "Cabo de Ignição",
      parser: "parserBoschCabos",
      palavrasChave: [
        "cabo",
        "cabos",
        "cabo de ignicao",
      ],
    },

    filtros: {
      id: "filtros",
      nome: "Filtros",
      pecaPadrao: "Filtro Automotivo",
      parser: "parserBoschFiltros",
      palavrasChave: [
        "filtro",
        "filtros",
        "oleo",
        "ar",
        "combustivel",
        "cabine",
      ],
    },

    palhetas: {
      id: "palhetas",
      nome: "Palhetas",
      pecaPadrao: "Palheta do Limpador",
      parser: "parserBoschPalhetas",
      palavrasChave: [
        "palheta",
        "palhetas",
        "limpador",
        "aerotwin",
      ],
    },

    performance: {
      id: "performance",
      nome: "Bosch Performance",
      pecaPadrao: "Peça Bosch Performance",
      parser: "parserBoschPerformance",
      palavrasChave: [
        "performance",
        "alta performance",
        "wideband",
        "lsu",
      ],
    },

    reman: {
      id: "reman",
      nome: "Bosch Reman",
      pecaPadrao: "Peça Bosch Remanufaturada",
      parser: "parserBoschReman",
      palavrasChave: [
        "reman",
        "remanufaturado",
        "remanufaturada",
      ],
    },

    sth: {
      id: "sth",
      nome: "Sistemas Térmicos",
      pecaPadrao: "Componente de Sistema Térmico",
      parser: "parserBoschSTH",
      palavrasChave: [
        "sistema termico",
        "sistemas termicos",
        "sth",
        "arrefecimento",
      ],
    },
  },
};

function normalizar(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function obterFamiliaBosch(tipoCatalogo = "") {
  const chave = normalizar(tipoCatalogo);

  if (!chave) {
    return null;
  }

  const familias = Object.values(
    BOSCH_MASTER.familias
  );

  return (
    familias.find((familia) => {
      if (normalizar(familia.id) === chave) {
        return true;
      }

      if (normalizar(familia.nome) === chave) {
        return true;
      }

      return familia.palavrasChave.some(
        (palavra) =>
          chave.includes(normalizar(palavra))
      );
    }) || null
  );
}

export function detectarFamiliaBosch({
  nomeArquivo = "",
  tipoCatalogo = "",
  origemCatalogo = "",
} = {}) {
  const texto = normalizar(
    [
      tipoCatalogo,
      nomeArquivo,
      origemCatalogo,
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (!texto) {
    return null;
  }

  const familias = Object.values(
    BOSCH_MASTER.familias
  );

  const familiaEncontrada = familias.find(
    (familia) =>
      familia.palavrasChave.some(
        (palavra) =>
          texto.includes(normalizar(palavra))
      )
  );

  return familiaEncontrada || null;
}

export function listarFamiliasBosch() {
  return Object.values(
    BOSCH_MASTER.familias
  );
}

export default BOSCH_MASTER;