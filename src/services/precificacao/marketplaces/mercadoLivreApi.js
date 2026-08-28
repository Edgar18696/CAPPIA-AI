function normalizarTexto(valor = "") {
  return String(valor || "")
    .trim()
    .replace(/\s+/g, " ");
}

function numeroSeguro(valor) {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

export async function buscarMercadoLivre({
  codigo = "",
  descricao = "",
} = {}) {
  const termo = normalizarTexto(
    codigo || descricao
  );

  if (!termo) {
    return {
      sucesso: false,
      mensagem:
        "Informe um código ou descrição para pesquisar.",
      resultados: [],
      resumo: null,
    };
  }

  try {
    const url =
      "https://api.mercadolibre.com/sites/MLB/search?q=" +
      encodeURIComponent(termo);

    const resposta =
      await fetch(url);

    if (!resposta.ok) {
      throw new Error(
        `Erro Mercado Livre: ${resposta.status}`
      );
    }

    const dados =
      await resposta.json();

    const resultados =
      Array.isArray(dados?.results)
        ? dados.results
        : [];

    const precos =
      resultados
        .map((item) =>
          numeroSeguro(item?.price)
        )
        .filter(
          (valor) => valor > 0
        );

    if (!precos.length) {
      return {
        sucesso: true,
        mensagem:
          "Nenhum preço válido encontrado.",
        resultados: [],
        resumo: {
          menorPreco: 0,
          precoMedio: 0,
          maiorPreco: 0,
          concorrentes: 0,
        },
      };
    }

    const menorPreco =
      Math.min(...precos);

    const maiorPreco =
      Math.max(...precos);

    const precoMedio =
      precos.reduce(
        (soma, valor) =>
          soma + valor,
        0
      ) / precos.length;

    const lista =
      resultados.map(
        (item) => ({
          id: item?.id || "",
          titulo:
            item?.title || "",
          preco:
            numeroSeguro(
              item?.price
            ),
          moeda:
            item?.currency_id ||
            "BRL",
          condicao:
            item?.condition ||
            "",
          vendedorId:
            item?.seller?.id ||
            null,
          link:
            item?.permalink ||
            "",
          freteGratis:
            Boolean(
              item?.shipping
                ?.free_shipping
            ),
        })
      );

    return {
      sucesso: true,

      mensagem:
        "Pesquisa concluída com sucesso.",

      termo,

      resultados:
        lista,

      resumo: {
        menorPreco,
        precoMedio,
        maiorPreco,
        concorrentes:
          resultados.length,
      },
    };
  } catch (erro) {
    console.error(
      "Erro ao pesquisar Mercado Livre:",
      erro
    );

    return {
      sucesso: false,

      mensagem:
        erro?.message ||
        "Não foi possível consultar o Mercado Livre.",

      resultados: [],

      resumo: null,
    };
  }
}

export default buscarMercadoLivre;