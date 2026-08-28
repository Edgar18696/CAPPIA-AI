function numeroSeguro(valor) {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

export function especialistaMarketplace({
  mercado = null,
  margem = 0,
} = {}) {
  const resumo =
    mercado?.resumo || {};

  const precoMedio =
    numeroSeguro(
      resumo.precoMedio
    );

  const concorrentes =
    numeroSeguro(
      resumo.concorrentes
    );

  let notaML = 5;
  let notaShopee = 4;
  let notaSite = 5;
  let notaWhats = 5;

  if (concorrentes > 100) {
    notaML = 3;
  }

  if (concorrentes > 300) {
    notaML = 2;
  }

  if (margem < 20) {
    notaML--;
    notaShopee--;
  }

  const estrelas = (n) =>
    "★★★★★".slice(0, n) +
    "☆☆☆☆☆".slice(0, 5 - n);

  let recomendacao =
    "Boa oportunidade para publicar.";

  if (notaML >= 5) {
    recomendacao =
      "Mercado Livre é o canal prioritário.";
  } else if (notaShopee >= 4) {
    recomendacao =
      "Shopee pode oferecer melhor competitividade.";
  }

  return {
    especialista:
      "marketplace",

    status:
      notaML >= 4
        ? "APROVADO"
        : "REVISAR",

    precoMedio,

    concorrentes,

    canais: [
      {
        nome:
          "Mercado Livre",
        nota: notaML,
        estrelas:
          estrelas(notaML),
      },
      {
        nome: "Shopee",
        nota: notaShopee,
        estrelas:
          estrelas(
            notaShopee
          ),
      },
      {
        nome: "Site",
        nota: notaSite,
        estrelas:
          estrelas(notaSite),
      },
      {
        nome:
          "WhatsApp",
        nota: notaWhats,
        estrelas:
          estrelas(
            notaWhats
          ),
      },
    ],

    recomendacao,

    resumo: {
      melhorCanal:
        notaML >=
        notaShopee
          ? "Mercado Livre"
          : "Shopee",
    },
  };
}

export default especialistaMarketplace;