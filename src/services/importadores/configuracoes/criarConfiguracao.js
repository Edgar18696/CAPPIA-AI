export function criarConfiguracao({
  tipoCatalogo,

  origemCatalogo,

  paginaInicialAplicacoes = 1,
  paginaFinalAplicacoes = null,

  paginaInicialEquivalencias = null,
  paginaFinalEquivalencias = null,
}) {
  return {
    tipoCatalogo,

    origemCatalogo,

    paginaInicialAplicacoes,
    paginaFinalAplicacoes,

    paginaInicialEquivalencias,
    paginaFinalEquivalencias,
  };
}