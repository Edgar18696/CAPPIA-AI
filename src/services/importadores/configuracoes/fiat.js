import { importarFiat } from "../fabricantes/fiat";

export const configuracaoFiat = {
  chaves: [
    "fiat",
    "mopar",
  ],

  fabricante: "Fiat",

  origemCatalogo:
    "Catálogo Fiat",

  paginaInicialAplicacoes: 1,
  paginaFinalAplicacoes: 1,

  paginaInicialEquivalencias: 1,
  paginaFinalEquivalencias: 1,

  formatoParser: "texto",

  parser: importarFiat,
};