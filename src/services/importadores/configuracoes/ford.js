import { importarFord } from "../fabricantes/ford";

export const configuracaoFord = {
  chaves: [
    "ford",
    "motorcraft",
  ],

  fabricante: "Ford",

  origemCatalogo:
    "Catálogo Ford",

  paginaInicialAplicacoes: 1,
  paginaFinalAplicacoes: 1,

  paginaInicialEquivalencias: 1,
  paginaFinalEquivalencias: 1,

  formatoParser: "texto",

  parser: importarFord,
};