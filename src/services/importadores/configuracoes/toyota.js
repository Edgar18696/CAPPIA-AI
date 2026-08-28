import { importarToyota } from "../fabricantes/toyota";

export const configuracaoToyota = {
  chaves: [
    "toyota",
    "lexus",
  ],

  fabricante: "Toyota",

  origemCatalogo:
    "Catálogo Toyota",

  paginaInicialAplicacoes: 1,
  paginaFinalAplicacoes: 1,

  paginaInicialEquivalencias: 1,
  paginaFinalEquivalencias: 1,

  formatoParser: "texto",

  parser: importarToyota,
};