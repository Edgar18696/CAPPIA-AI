function prioridade(status) {
  switch (
    String(status || "")
      .toUpperCase()
  ) {
    case "ALERTA":
      return 3;

    case "REVISAR":
      return 2;

    case "AGUARDANDO":
      return 1;

    case "APROVADO":
      return 0;

    default:
      return 1;
  }
}

export function diretorIA(
  especialistas = {}
) {
  const lista =
    Object.values(
      especialistas
    ).filter(Boolean);

  if (!lista.length) {
    return {
      status: "AGUARDANDO",
      emoji: "⏳",
      titulo:
        "Aguardando análise",
      texto:
        "Ainda não existem dados suficientes para concluir a análise do anúncio.",
    };
  }

  let maiorPrioridade = 0;

  lista.forEach(
    (especialista) => {
      maiorPrioridade =
        Math.max(
          maiorPrioridade,
          prioridade(
            especialista?.status
          )
        );
    }
  );

  const totalAprovados =
    lista.filter(
      (especialista) =>
        String(
          especialista?.status ||
            ""
        ).toUpperCase() ===
        "APROVADO"
    ).length;

  const totalRevisar =
    lista.filter(
      (especialista) =>
        String(
          especialista?.status ||
            ""
        ).toUpperCase() ===
        "REVISAR"
    ).length;

  const totalAlertas =
    lista.filter(
      (especialista) =>
        String(
          especialista?.status ||
            ""
        ).toUpperCase() ===
        "ALERTA"
    ).length;

  const totalAguardando =
    lista.filter(
      (especialista) =>
        String(
          especialista?.status ||
            ""
        ).toUpperCase() ===
        "AGUARDANDO"
    ).length;

  if (
    maiorPrioridade === 3
  ) {
    return {
      status: "ALERTA",

      emoji: "⛔",

      titulo:
        "Publicação não recomendada",

      texto:
        "Existem pendências críticas que devem ser corrigidas antes da publicação.",

      resumo: {
        totalEspecialistas:
          lista.length,

        aprovados:
          totalAprovados,

        revisar:
          totalRevisar,

        alertas:
          totalAlertas,

        aguardando:
          totalAguardando,
      },
    };
  }

  if (
    maiorPrioridade === 2
  ) {
    return {
      status: "REVISAR",

      emoji: "⚠️",

      titulo:
        "Revisar antes de publicar",

      texto:
        "O anúncio está próximo de ficar pronto, mas ainda existem pontos importantes para revisar.",

      resumo: {
        totalEspecialistas:
          lista.length,

        aprovados:
          totalAprovados,

        revisar:
          totalRevisar,

        alertas:
          totalAlertas,

        aguardando:
          totalAguardando,
      },
    };
  }

  if (
    maiorPrioridade === 1
  ) {
    return {
      status:
        "AGUARDANDO",

      emoji:
        "⏳",

      titulo:
        "Aguardando informações",

      texto:
        "Complete os dados pendentes para que todos os especialistas possam concluir a análise.",

      resumo: {
        totalEspecialistas:
          lista.length,

        aprovados:
          totalAprovados,

        revisar:
          totalRevisar,

        alertas:
          totalAlertas,

        aguardando:
          totalAguardando,
      },
    };
  }

  return {
    status:
      "APROVADO",

    emoji:
      "🚀",

    titulo:
      "Pronto para publicar",

    texto:
      "Todos os especialistas aprovaram este anúncio.",

    resumo: {
      totalEspecialistas:
        lista.length,

      aprovados:
        totalAprovados,

      revisar:
        totalRevisar,

      alertas:
        totalAlertas,

      aguardando:
        totalAguardando,
    },
  };
}

export default diretorIA;