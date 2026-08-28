export function especialistaAuditoria({
  auditoria = null,
  pontuacao = 0,
  recomendacoes = [],
} = {}) {
  const problemas =
    Array.isArray(auditoria?.problemas)
      ? auditoria.problemas
      : [];

  const pendencias =
    recomendacoes.filter(
      (item) =>
        item.tipo === "erro" ||
        item.tipo === "alerta"
    );

  let status = "APROVADO";

  if (pontuacao < 80) {
    status = "REVISAR";
  }

  if (
    pontuacao < 60 ||
    problemas.length > 0
  ) {
    status = "ALERTA";
  }

  return {
    especialista: "auditoria",

    status,

    pontuacao,

    problemas,

    totalProblemas:
      problemas.length,

    totalPendencias:
      pendencias.length,

    recomendacao:
      status === "APROVADO"
        ? "Auditoria aprovada para publicação."
        : status === "REVISAR"
        ? "Revise os itens antes da publicação."
        : "Existem pendências importantes que impedem a publicação.",
  };
}

export default especialistaAuditoria;