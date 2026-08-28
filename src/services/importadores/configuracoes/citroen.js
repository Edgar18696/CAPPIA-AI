import { importarCitroen } from "../fabricantes/citroen";

export const configuracaoCitroen = {
  chaves: [
    "citroen",
    "citroën",
    "psa citroen",
  ],

  fabricante: "Citroën",

  origemCatalogo:
    "Catálogo Citroën",

  paginaInicialAplicacoes: 1,
  paginaFinalAplicacoes: 1,

  paginaInicialEquivalencias: 1,
  paginaFinalEquivalencias: 1,

  formatoParser: "texto",

  parser: importarCitroen,
};