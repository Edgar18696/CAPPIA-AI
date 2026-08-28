export function analisarAnuncio({
  titulo = "",
  descricao = "",
  preco = "",
  fotos = [],
  diagnostico = null,
  auditoria = null,
}) {
  const recomendacoes = [];

  if (!titulo.trim()) {
    recomendacoes.push({
      tipo: "erro",
      icone: "📝",
      texto: "Adicione um título para o anúncio.",
    });
  }

  if (!descricao.trim()) {
    recomendacoes.push({
      tipo: "erro",
      icone: "📄",
      texto: "A descrição ainda não foi preenchida.",
    });
  }

  if (!preco) {
    recomendacoes.push({
      tipo: "alerta",
      icone: "💰",
      texto: "Defina um preço antes de publicar.",
    });
  }

  if (fotos.length === 0) {
    recomendacoes.push({
      tipo: "erro",
      icone: "📸",
      texto: "Inclua pelo menos uma foto profissional.",
    });
  }

  if (!diagnostico) {
    recomendacoes.push({
      tipo: "info",
      icone: "🔎",
      texto: "Faça uma consulta técnica para validar aplicações.",
    });
  }

  if (
    auditoria &&
    auditoria.aprovado === false
  ) {
    recomendacoes.push({
      tipo: "alerta",
      icone: "⚠️",
      texto: "A auditoria encontrou itens para revisão.",
    });
  }

  if (
    recomendacoes.length === 0
  ) {
    recomendacoes.push({
      tipo: "sucesso",
      icone: "✅",
      texto:
        "Excelente! O anúncio está pronto para publicação.",
    });
  }

  return recomendacoes;
}