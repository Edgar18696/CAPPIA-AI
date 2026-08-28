function normalizarCodigo(
  codigo = ""
) {
  return String(codigo || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

const REGRAS = [
  {
    familia: "Sondas",
    prefixos: [
      "0258",
    ],
  },

  {
    familia: "Sensores",
    prefixos: [
      "0261",
      "0281",
    ],
  },

  {
    familia: "Bicos Injetores",
    prefixos: [
      "028015",
      "044511",
      "043317",
      "043425",
    ],
  },

  {
    familia: "Bombas",
    prefixos: [
      "0580",
      "044501",
      "044502",
      "044503",
      "044505",
    ],
  },

  {
    familia: "Bobinas",
    prefixos: [
      "0221",
    ],
  },

  {
    familia: "Velas",
    prefixos: [
      "0242",
    ],
  },

  {
    familia: "Filtros",
    prefixos: [
      "0986B0",
      "0986BF",
      "145742",
      "145743",
      "045110",
    ],
  },

  {
    familia: "Palhetas",
    prefixos: [
      "AF",
      "AP",
      "A",
      "AR",
      "H",
      "SD",
    ],
  },

  {
    familia: "Alternadores",
    prefixos: [
      "0124",
      "0123",
      "098604",
    ],
  },

  {
    familia: "Baterias",
    prefixos: [
      "BTX",
      "M6",
      "YTX",
    ],
  },
];

export function identificarFamiliaPorCodigo(
  codigo = ""
) {
  const codigoFinal =
    normalizarCodigo(codigo);

  const regra =
    REGRAS.find((item) =>
      item.prefixos.some(
        (prefixo) =>
          codigoFinal.startsWith(
            normalizarCodigo(prefixo)
          )
      )
    );

  if (!regra) {
  return null;
}

return {
  fabricante: "Bosch",

  familia: regra.familia,

  catalogo: `bosch_${regra.familia
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")}`,
};
}

export default identificarFamiliaPorCodigo;