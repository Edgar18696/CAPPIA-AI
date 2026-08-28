import { supabase } from "../supabase";

function numeroSeguro(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return 0;
  }

  const texto = String(valor)
    .trim()
    .replace(/\s/g, "");

  const normalizado =
    texto.includes(",")
      ? texto
          .replace(/\./g, "")
          .replace(",", ".")
      : texto;

  const numero =
    Number(normalizado);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

function arredondar(valor) {
  return (
    Math.round(
      numeroSeguro(valor) * 100
    ) / 100
  );
}

export async function obterResumoComercial() {
  try {
    const {
      data,
      error,
    } = await supabase
      .from("anuncios")
      .select("*")
      .order("id", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Erro ao carregar resumo comercial:",
        error
      );

      throw error;
    }

    const anuncios =
      Array.isArray(data)
        ? data
        : [];

    const totalAnuncios =
      anuncios.length;

    /*
     * Atualmente a tabela "anuncios"
     * recebe somente anúncios que foram
     * finalizados no Criador de Anúncios.
     *
     * Portanto, nesta etapa da V1:
     *
     * anuncio na tabela anuncios
     * =
     * anúncio pronto para publicação.
     */
    const anunciosProntos =
      totalAnuncios;

    const precosValidos =
      anuncios
        .map((anuncio) =>
          numeroSeguro(
            anuncio?.preco
          )
        )
        .filter(
          (valor) =>
            valor > 0
        );

    const precoMedio =
      precosValidos.length > 0
        ? precosValidos.reduce(
            (
              soma,
              valor
            ) =>
              soma + valor,
            0
          ) /
          precosValidos.length
        : 0;

    const anunciosSemFoto =
      anuncios.filter(
        (anuncio) => {
          const foto =
            String(
              anuncio
                ?.foto_principal ||
                ""
            ).trim();

          return !foto;
        }
      ).length;

    return {
      sucesso: true,

      totalAnuncios,

      anunciosProntos,

      /*
       * Estes campos serão ligados
       * à Central de Precificação.
       */
      anunciosMargemBaixa: 0,

      anunciosReajuste: 0,

      oportunidadesMargem: 0,

      produtosPoucaConcorrencia: 0,

      anunciosSemFoto,

      lucroEstimado: 0,

      margemMedia: 0,

      precoMedio:
        arredondar(
          precoMedio
        ),

      /*
       * Estes quatro só serão
       * preenchidos quando a
       * Central de Publicação
       * registrar o canal utilizado.
       */
      totalMercadoLivre: 0,

      totalShopee: 0,

      totalAmazon: 0,

      totalSite: 0,
    };
  } catch (erro) {
    console.error(
      "Erro no resumo comercial:",
      erro
    );

    return {
      sucesso: false,

      totalAnuncios: 0,

      anunciosProntos: 0,

      anunciosMargemBaixa: 0,

      anunciosReajuste: 0,

      oportunidadesMargem: 0,

      produtosPoucaConcorrencia: 0,

      anunciosSemFoto: 0,

      lucroEstimado: 0,

      margemMedia: 0,

      precoMedio: 0,

      totalMercadoLivre: 0,

      totalShopee: 0,

      totalAmazon: 0,

      totalSite: 0,
    };
  }
}

export default obterResumoComercial;