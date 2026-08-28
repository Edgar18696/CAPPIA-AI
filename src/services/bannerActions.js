export async function processarBannerAction({
  fetchFn = fetch,
  apiProcessarImagem,
  supabaseKey,
  imagem,
  bannerModelo,
  categoriaBanner,
  estiloBanner,
  tamanhoBanner,
  fundoBanner,
  modeloPremiumBanner,
}) {
  if (!imagem) {
    throw new Error(
      "Escolha uma imagem antes de gerar o banner."
    );
  }

  const resposta = await fetchFn(
    apiProcessarImagem,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        apikey: supabaseKey,

        Authorization:
          `Bearer ${supabaseKey}`,
      },

      body: JSON.stringify({
        imageUrl: imagem,

        tipo: "banner",

        modelo:
          bannerModelo ||
          "mercadolivre",

        categoria:
          categoriaBanner ||
          "autopecas",

        estilo:
          estiloBanner ||
          "premium",

        tamanho:
          tamanhoBanner ||
          "1200x1200",

        fundo:
          fundoBanner ||
          "automatico",

        modeloPremium:
          modeloPremiumBanner ||
          "premium",
      }),
    }
  );

  const dados =
    await resposta.json();

  if (
    !resposta.ok ||
    !dados?.imagem_processada
  ) {
    throw new Error(
      dados?.erro ||
        dados?.error ||
        dados?.detalhes ||
        "Erro ao gerar o banner."
    );
  }

  return {
    imagemProcessada:
      dados.imagem_processada,

    dados,
  };
}