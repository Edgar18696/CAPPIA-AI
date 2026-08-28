export function motorDecisao({
  codigo,
  titulo,
  descricao,
  fotos,
  diagnostico,
  auditoria,
  peca,
}) {
  const sugestoes = [];

  if (!codigo) {
    sugestoes.push({
      prioridade: 10,
      tipo: "erro",
      titulo: "Código ausente",
      acao: "Informe o código da peça.",
    });
  }

  if (!titulo || titulo.length < 45) {
    sugestoes.push({
      prioridade: 8,
      tipo: "seo",
      titulo: "Melhorar título",
      acao: "Adicionar fabricante, código e aplicação.",
    });
  }

  if (!descricao || descricao.length < 300) {
    sugestoes.push({
      prioridade: 8,
      tipo: "descricao",
      titulo: "Descrição incompleta",
      acao: "Gerar descrição técnica completa.",
    });
  }

  if (!fotos || fotos.length === 0) {
    sugestoes.push({
      prioridade: 9,
      tipo: "foto",
      titulo: "Adicionar fotos",
      acao: "Escolher imagens na Galeria.",
    });
  }

  if (!diagnostico) {
    sugestoes.push({
      prioridade: 7,
      tipo: "diagnostico",
      titulo: "Executar diagnóstico",
      acao: "Analisar compatibilidade.",
    });
  }

  if (!auditoria) {
    sugestoes.push({
      prioridade: 7,
      tipo: "auditoria",
      titulo: "Executar auditoria",
      acao: "Validar qualidade dos dados.",
    });
  }

  if (!peca) {
    sugestoes.push({
      prioridade: 9,
      tipo: "catalogo",
      titulo: "Consultar catálogo",
      acao: "Buscar informações oficiais.",
    });
  }

  sugestoes.sort((a, b) => b.prioridade - a.prioridade);

  return sugestoes;
}