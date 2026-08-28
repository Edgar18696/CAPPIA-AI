export async function publicarMercadoLivre(anuncio) {
  console.log("Publicando no Mercado Livre:", anuncio);

  return {
    sucesso: true,
    marketplace: "Mercado Livre",
    mensagem: "Simulação: anúncio enviado para o Mercado Livre.",
  };
}

export async function publicarShopee(anuncio) {
  console.log("Publicando na Shopee:", anuncio);

  return {
    sucesso: true,
    marketplace: "Shopee",
    mensagem: "Simulação: anúncio enviado para a Shopee.",
  };
}

export async function publicarAmazon(anuncio) {
  console.log("Publicando na Amazon:", anuncio);

  return {
    sucesso: true,
    marketplace: "Amazon",
    mensagem: "Simulação: anúncio enviado para a Amazon.",
  };
}

export async function publicarSiteProprio(anuncio) {
  console.log("Publicando no site próprio:", anuncio);

  return {
    sucesso: true,
    marketplace: "Site Próprio",
    mensagem: "Simulação: anúncio enviado para o site próprio.",
  };
}