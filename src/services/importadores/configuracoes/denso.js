import { importarDenso } from "../fabricantes/denso";

export const configuracaoDenso = {
  chaves: ["denso"],

  fabricante: "Denso",

  origemCatalogo:
    "Catálogo Denso",

  paginaInicialAplicacoes: 1,
  paginaFinalAplicacoes: 1,

  paginaInicialEquivalencias: 1,
  paginaFinalEquivalencias: 1,

  formatoParser: "texto",

  parser: importarDenso,
};