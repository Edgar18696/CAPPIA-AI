export function montarResultadoCopiloto({
  resposta,
  recomendacoes,
  parecer,
  mercado,
  catalogo,
  especialistas,
}) {
  return {
    sucesso: true,

    resposta,

    recomendacoes,

    parecer,

    mercado,

    catalogo,

    especialistas,

    dataHora: new Date().toISOString(),
  };
}

export default montarResultadoCopiloto;