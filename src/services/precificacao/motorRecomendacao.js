function moeda(valor) {
  return Number(valor || 0).toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  );
}

export function motorRecomendacao({
  precoRecomendado = 0,
  precoMercado = 0,
  concorrentes = 0,
  margem = 0,
  competitividade = 0,
} = {}) {
  const mensagens = [];

  if (concorrentes > 0) {
    mensagens.push(
      `Encontrei ${concorrentes} concorrentes para esta peça.`
    );
  }

  if (precoMercado > 0) {
    mensagens.push(
      `O preço médio do mercado é ${moeda(precoMercado)}.`
    );
  }

  if (margem >= 30) {
    mensagens.push(
      "Sua margem está saudável."
    );
  } else if (margem > 0) {
    mensagens.push(
      "Sua margem pode ser melhorada."
    );
  }

  if (competitividade >= 5) {
    mensagens.push(
      "Seu preço está bastante competitivo."
    );
  } else if (competitividade >= 3) {
    mensagens.push(
      "Seu preço está competitivo."
    );
  } else if (competitividade > 0) {
    mensagens.push(
      "Vale revisar o preço para ganhar competitividade."
    );
  }

  if (precoRecomendado > 0) {
    mensagens.push(
      `Minha recomendação é anunciar por ${moeda(precoRecomendado)}.`
    );
  }

  return {
    titulo:
      "🧠 Recomendação PAIIA",

    mensagens,
  };
}

export default motorRecomendacao;