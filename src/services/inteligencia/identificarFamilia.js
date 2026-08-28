function normalizar(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
const REGRAS_FAMILIAS = [
  {
    familia: "Sonda Lambda",
    palavras: [
      "lambda",
      "oxigenio",
      "oxygen",
      "sonda",
    ],
  },

  {
    familia: "Sensores",
    palavras: [
      "sensor",
      "map",
      "maf",
      "tps",
      "rotacao",
      "rotação",
      "fase",
      "temperatura",
      "pressao",
      "pressão",
      "ckp",
      "cmp",
      "abs",
    ],
  },

  {
    familia: "Bicos Injetores",
    palavras: [
      "bico",
      "injetor",
      "injector",
      "common rail",
      "crin",
      "cri",
    ],
  },

  {
    familia: "Bombas",
    palavras: [
      "bomba",
      "fuel pump",
      "alta pressao",
      "alta pressão",
      "vp44",
      "cp1",
      "cp3",
      "cp4",
    ],
  },

  {
    familia: "Bobinas",
    palavras: [
      "bobina",
      "ignicao",
      "ignição",
      "ignition",
    ],
  },

  {
    familia: "Velas",
    palavras: [
      "vela",
      "spark plug",
    ],
  },

  {
    familia: "Filtros",
    palavras: [
      "filtro",
      "oleo",
      "óleo",
      "ar",
      "combustivel",
      "combustível",
      "cabine",
      "hidraulico",
      "hidráulico",
    ],
  },

  {
    familia: "Palhetas",
    palavras: [
      "palheta",
      "limpador",
      "aerotwin",
      "aerofit",
      "twin",
      "rear",
    ],
  },

  {
    familia: "Alternadores",
    palavras: [
      "alternador",
      "motor de partida",
      "arranque",
      "starter",
    ],
  },

  {
    familia: "Baterias",
    palavras: [
      "bateria",
      "agm",
      "efb",
    ],
  },

  {
    familia: "Sistema Diesel",
    palavras: [
      "diesel",
      "cummins",
      "mwm",
      "om906",
      "om904",
      "om457",
      "power stroke",
      "duratorq",
      "common rail",
      "uis",
      "ups",
    ],
  },
];

export function identificarFamilia(
  texto = ""
) {
  const descricao =
    normalizar(texto);

  const encontrada =
    REGRAS_FAMILIAS.find(
      (familia) =>
        familia.palavras.some(
          (palavra) =>
            descricao.includes(
              normalizar(palavra)
            )
        )
    );

  return (
    encontrada?.familia ||
    "Peça Automotiva"
  );
}

export default identificarFamilia;