export function gerarParecerIA({
  recomendacoes = [],
  pontuacao = 0,
  diagnostico = null,
}) {
  if (!recomendacoes.length) {
    return {
      emoji: "🤖",
      titulo: "Analisando anúncio...",
      texto:
        "Ainda estou coletando informações para emitir um parecer.",
    };
  }

  const erros =
    recomendacoes.filter(
      (item) => item.tipo === "erro"
    ).length;

  const alertas =
    recomendacoes.filter(
      (item) => item.tipo === "alerta"
    ).length;

  if (erros > 0) {
    return {
      emoji: "🚨",
      titulo: "Publicação não recomendada",
      texto:
        "Existem informações obrigatórias faltando. Corrija os itens destacados antes de publicar.",
    };
  }

  if (alertas > 0) {
    return {
      emoji: "⚠️",
      titulo: "Revisão recomendada",
      texto:
        "O anúncio pode ser publicado, mas existem oportunidades para melhorar sua qualidade e competitividade.",
    };
  }

  if (pontuacao >= 90) {
    return {
      emoji: "🏆",
      titulo: "Excelente anúncio",
      texto:
        "A qualidade está alta. Minha recomendação é publicar este anúncio.",
    };
  }

  return {
    emoji: "🤖",
    titulo: "Anúncio em evolução",
    texto:
      "Continue preenchendo as informações para alcançar a nota máxima.",
    diagnostico,
  };
}