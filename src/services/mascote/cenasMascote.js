export const CENAS_MASCOTE = [
  {
    id: "paizinho",
    icone: "✨",
    nome: "Paizinho escolhe",
    descricao: "Analisa a foto e monta a cena sozinho.",
    padrao: true,
  },
  {
    id: "mascote",
    icone: "👤",
    nome: "Só o mascote",
    descricao: "Personagem em destaque, apresentando o produto.",
    promptCena:
      "Cena: somente o mascote em destaque, apresentando o produto com clareza, fundo limpo de estúdio, personagem inteiro no quadro.",
  },
  {
    id: "dirigindo",
    icone: "🚗",
    nome: "Dirigindo",
    descricao: "Mascote ao volante, em clima automotivo.",
    promptCena:
      "Cena: o mascote dirigindo um veículo, na posição do motorista, atitude confiante, ambiente automotivo, personagem e ação bem legíveis.",
  },
  {
    id: "roda",
    icone: "🛞",
    nome: "Trocando uma roda",
    descricao: "Ação de troca de pneu/roda.",
    promptCena:
      "Cena: o mascote trocando uma roda, pneu em evidência, ação de oficina, personagem inteiro e produto reconhecível.",
  },
  {
    id: "motor",
    icone: "🔧",
    nome: "Mexendo no motor",
    descricao: "Capô aberto, mascote no motor.",
    promptCena:
      "Cena: o mascote mexendo no motor, capô aberto, ferramenta na mão, peça de motor visível, personagem em ação de mecânico.",
  },
  {
    id: "oficina",
    icone: "🏭",
    nome: "Na oficina",
    descricao: "Ambiente de trabalho automotivo.",
    promptCena:
      "Cena: o mascote na oficina automotiva, ambiente de trabalho, produto em contexto, personagem apresentando a peça com clareza.",
  },
];

export function obterCenaMascote(id) {
  return (
    CENAS_MASCOTE.find((item) => item.id === id) ||
    CENAS_MASCOTE.find((item) => item.id === "oficina")
  );
}

export function resolverCenaMascote(cenaEscolhida, cenaRecomendada) {
  if (!cenaEscolhida || cenaEscolhida === "paizinho") {
    return obterCenaMascote(cenaRecomendada || "oficina");
  }
  return obterCenaMascote(cenaEscolhida);
}
