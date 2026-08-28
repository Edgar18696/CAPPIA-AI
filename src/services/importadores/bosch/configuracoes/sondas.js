import { criarConfiguracao } from "./criarConfiguracao";

export const configuracaoSondas =
  criarConfiguracao({
    tipoCatalogo: "sondas",

    origemCatalogo:
      "Catálogo Bosch Sondas 2020",

    paginaInicialAplicacoes: 15,
    paginaFinalAplicacoes: 86,

    paginaInicialEquivalencias: 87,
    paginaFinalEquivalencias: 96,
  });