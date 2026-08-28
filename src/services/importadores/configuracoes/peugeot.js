import { importarPeugeot } from "../fabricantes/peugeot";

export const configuracaoPeugeot = {
  chaves: [
    "peugeot",
    "psa peugeot",
  ],

  fabricante: "Peugeot",

  origemCatalogo:
    "Catálogo Peugeot",

  paginaInicialAplicacoes: 1,
  paginaFinalAplicacoes: 1,

  paginaInicialEquivalencias: 1,
  paginaFinalEquivalencias: 1,

  formatoParser: "texto",

  parser: importarPeugeot,
};