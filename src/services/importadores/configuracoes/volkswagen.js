import { importarVolkswagen } from "../fabricantes/volkswagen";

export const configuracaoVolkswagen = {
  chaves: [
    "volkswagen",
    "vw",
  ],

  fabricante: "Volkswagen",

  origemCatalogo:
    "Catálogo Volkswagen",

  paginaInicialAplicacoes: 1,
  paginaFinalAplicacoes: 1,

  paginaInicialEquivalencias: 1,
  paginaFinalEquivalencias: 1,

  formatoParser: "texto",

  parser: importarVolkswagen,
};