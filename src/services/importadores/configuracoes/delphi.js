import { importarDelphi } from "../fabricantes/delphi";

export const configuracaoDelphi = {
  chaves: [
    "delphi",
    "aptiv",
  ],

  fabricante: "Delphi",

  origemCatalogo:
    "Catálogo Delphi",

  paginaInicialAplicacoes: 1,
  paginaFinalAplicacoes: 1,

  paginaInicialEquivalencias: 1,
  paginaFinalEquivalencias: 1,

  formatoParser: "texto",

  parser: importarDelphi,
};