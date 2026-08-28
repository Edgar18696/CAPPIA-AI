import { importarGm } from "../fabricantes/gm";

export const configuracaoGm = {
  chaves: [
    "gm",
    "chevrolet",
    "general motors",
  ],

  fabricante: "GM",

  origemCatalogo:
    "Catálogo GM Chevrolet",

  paginaInicialAplicacoes: 1,
  paginaFinalAplicacoes: 1,

  paginaInicialEquivalencias: 1,
  paginaFinalEquivalencias: 1,

  formatoParser: "texto",

  parser: importarGm,
};