function arredondar(valor) {
  return Math.round(Number(valor || 0) * 100) / 100;
}

export function motorEstrategia({
  precoRecomendado = 0,
  precoMercado = 0,
} = {}) {
  const base =
    Number(precoMercado) > 0
      ? Number(precoMercado)
      : Number(precoRecomendado);

  if (base <= 0) {
    return {
      estrategia: null,
      opcoes: [],
    };
  }

  const ganharMercado =
    arredondar(base * 0.97);

  const equilibrado =
    arredondar(base);

  const maximoLucro =
    arredondar(base * 1.08);

  return {
    estrategia: "equilibrado",

    opcoes: [
      {
        id: "ganharMercado",

        titulo:
          "🚀 Ganhar Mercado",

        preco: ganharMercado,

        competitividade: 5,

        margem: 3,

        descricao:
          "Maior chance de venda."
      },

      {
        id: "equilibrado",

        titulo:
          "⚖ Equilibrado",

        preco: equilibrado,

        competitividade: 5,

        margem: 5,

        descricao:
          "Melhor equilíbrio entre lucro e vendas."
      },

      {
        id: "maximoLucro",

        titulo:
          "💎 Máximo Lucro",

        preco: maximoLucro,

        competitividade: 3,

        margem: 5,

        descricao:
          "Maior lucro por venda."
      },
    ],
  };
}

export default motorEstrategia;