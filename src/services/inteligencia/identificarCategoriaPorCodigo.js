function normalizarCodigo(
  codigo = ""
) {
  return String(codigo || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

const REGRAS = [
  {
    sistema: "Injeção Diesel",
    prefixos: [
      "0445",
      "0433",
      "F00R",
      "F00N",
      "F00V",
    ],
  },

  {
    sistema: "Injeção Eletrônica",
    prefixos: [
      "028015",
      "0580",
    ],
  },

  {
    sistema: "Sensores",
    prefixos: [
      "0261",
      "0281",
    ],
  },

  {
    sistema: "Ignição",
    prefixos: [
      "0221",
      "0242",
    ],
  },

  {
    sistema: "Emissões",
    prefixos: [
      "0258",
    ],
  },

  {
    sistema: "Filtragem",
    prefixos: [
      "0986B0",
      "0986BF",
      "145742",
      "145743",
    ],
  },

  {
    sistema: "Limpeza",
    prefixos: [
      "AF",
      "AP",
      "AR",
      "A",
      "H",
      "SD",
    ],
  },

  {
    sistema: "Sistema Elétrico",
    prefixos: [
      "0124",
      "0123",
      "098604",
      "BTX",
      "YTX",
    ],
  },
];

export function identificarSistemaPorCodigo(
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

  return regra?.sistema || null;
}

export default identificarSistemaPorCodigo;