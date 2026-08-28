function numeroSeguro(valor) {
  const numero = Number(
    String(valor ?? "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim()
  );

  return Number.isFinite(numero)
    ? numero
    : 0;
}

export function motorAlertas({
  precoAtual = 0,
  precoMinimo = 0,
  precoMercado = 0,
  margemPercentual = 0,
  concorrentes = 0,
} = {}) {
  const precoAtualFinal =
    numeroSeguro(precoAtual);

  const precoMinimoFinal =
    numeroSeguro(precoMinimo);

  const precoMercadoFinal =
    numeroSeguro(precoMercado);

  const margemFinal =
    numeroSeguro(margemPercentual);

  const concorrentesFinal =
    numeroSeguro(concorrentes);

  const alertas = [];

  if (
    precoAtualFinal > 0 &&
    precoMinimoFinal > 0 &&
    precoAtualFinal <
      precoMinimoFinal
  ) {
    alertas.push({
      tipo: "perigo",

      titulo:
        "⚠ Preço abaixo do mínimo",

      mensagem:
        "Neste valor você pode vender com prejuízo.",

      prioridade: 1,
    });
  }

  if (
    margemFinal > 0 &&
    margemFinal < 10
  ) {
    alertas.push({
      tipo: "alerta",

      titulo:
        "⚠ Margem muito baixa",

      mensagem:
        "Sua margem está abaixo de 10%. Revise o preço ou os custos.",

      prioridade: 2,
    });
  }

  if (
    precoAtualFinal > 0 &&
    precoMercadoFinal > 0
  ) {
    const diferencaPercentual =
      (
        (
          precoAtualFinal -
          precoMercadoFinal
        ) /
        precoMercadoFinal
      ) *
      100;

    if (
      diferencaPercentual >
      20
    ) {
      alertas.push({
        tipo: "alerta",

        titulo:
          "📈 Preço acima do mercado",

        mensagem:
          `Seu preço está aproximadamente ${diferencaPercentual.toFixed(
            1
          )}% acima da média do mercado.`,

        prioridade: 3,
      });
    }

    if (
      diferencaPercentual <
      -15
    ) {
      alertas.push({
        tipo: "oportunidade",

        titulo:
          "💡 Possível oportunidade de margem",

        mensagem:
          `Seu preço está aproximadamente ${Math.abs(
            diferencaPercentual
          ).toFixed(
            1
          )}% abaixo da média do mercado.`,

        prioridade: 4,
      });
    }
  }

  if (
    concorrentesFinal > 0 &&
    concorrentesFinal <= 3
  ) {
    alertas.push({
      tipo: "oportunidade",

      titulo:
        "💎 Poucos concorrentes",

      mensagem:
        "Há pouca concorrência. Pode existir espaço para aumentar a margem.",

      prioridade: 5,
    });
  }

  if (
    concorrentesFinal >= 30
  ) {
    alertas.push({
      tipo: "informacao",

      titulo:
        "📊 Alta concorrência",

      mensagem:
        "Este produto possui muitos concorrentes. O preço e o atendimento serão ainda mais importantes.",

      prioridade: 6,
    });
  }

  if (
    alertas.length === 0
  ) {
    alertas.push({
      tipo: "sucesso",

      titulo:
        "✅ Precificação saudável",

      mensagem:
        "Nenhum alerta importante foi identificado nesta análise.",

      prioridade: 99,
    });
  }

  return alertas.sort(
    (a, b) =>
      a.prioridade -
      b.prioridade
  );
}

export default motorAlertas;