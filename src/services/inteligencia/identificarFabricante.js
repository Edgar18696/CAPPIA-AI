import normalizarCodigo from "./normalizarCodigo";

const REGRAS_FABRICANTES = [
  {
    fabricante: "Bosch",
    prefixos: [
      "0",
      "F000",
      "F00M",
      "F00R",
      "F01R",
    ],
    palavras: [
      "bosch",
      "robert bosch",
    ],
  },

  {
    fabricante: "Magneti Marelli",
    prefixos: [
      "IWP",
      "BIP",
      "MAM",
    ],
    palavras: [
      "magneti marelli",
      "marelli",
    ],
  },

  {
    fabricante: "Delphi",
    prefixos: [
      "FJ",
      "EJBR",
      "282",
    ],
    palavras: [
      "delphi",
    ],
  },

  {
    fabricante: "Denso",
    prefixos: [
      "234",
      "195",
    ],
    palavras: [
      "denso",
    ],
  },

  {
    fabricante: "NGK",
    prefixos: [
      "OZA",
      "U",
    ],
    palavras: [
      "ngk",
      "ntk",
    ],
  },
];

function normalizarTexto(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function identificarFabricante({
  codigo = "",
  texto = "",
} = {}) {
  const codigoNormalizado =
    normalizarCodigo(codigo);

  const textoNormalizado =
    normalizarTexto(texto);

  const porPalavra =
    REGRAS_FABRICANTES.find(
      (regra) =>
        regra.palavras.some(
          (palavra) =>
            textoNormalizado.includes(
              normalizarTexto(palavra)
            )
        )
    );

  if (porPalavra) {
    return porPalavra.fabricante;
  }

  const porPrefixo =
    REGRAS_FABRICANTES.find(
      (regra) =>
        regra.prefixos.some(
          (prefixo) =>
            codigoNormalizado.startsWith(
              normalizarCodigo(prefixo)
            )
        )
    );

  return (
    porPrefixo?.fabricante ||
    "Fabricante não identificado"
  );
}

export default identificarFabricante;