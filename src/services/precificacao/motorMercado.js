import {
  buscarMercadoLivre,
} from "./marketplaces/mercadoLivreApi";

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
function media(lista = []) {
  const validos = lista
    .map(numeroSeguro)
    .filter((valor) => valor > 0);

  if (!validos.length) {
    return 0;
  }

  const total = validos.reduce(
    (soma, valor) => soma + valor,
    0
  );

  return total / validos.length;
}

function menor(lista = []) {
  const validos = lista
    .map(numeroSeguro)
    .filter((valor) => valor > 0);

  return validos.length
    ? Math.min(...validos)
    : 0;
}

function maior(lista = []) {
  const validos = lista
    .map(numeroSeguro)
    .filter((valor) => valor > 0);

  return validos.length
    ? Math.max(...validos)
    : 0;
}

function analisarCanal({
  nome,
  precos = [],
  concorrentes = 0,
}) {
  return {
    nome,

    disponivel:
      Array.isArray(precos) &&
      precos.length > 0,

    menorPreco:
      menor(precos),

    precoMedio:
      media(precos),

    maiorPreco:
      maior(precos),

    concorrentes:
      numeroSeguro(
        concorrentes
      ),
  };
}

export async function motorMercado({
  codigo = "",
  descricao = "",
  shopee = {},
  amazon = {},
} = {}) {
  let resultadoBuscaML = null;

  try {
    resultadoBuscaML =
      await buscarMercadoLivre({
        codigo,
        descricao,
      });
  } catch (erro) {
    console.error(
      "Erro consulta Mercado Livre:",
      erro
    );
  }

  const precosMercadoLivre =
    Array.isArray(
      resultadoBuscaML?.resultados
    )
      ? resultadoBuscaML.resultados
          .map((item) =>
            numeroSeguro(
              item?.preco
            )
          )
          .filter(
            (valor) => valor > 0
          )
      : [];

  const resultadoML =
    analisarCanal({
      nome:
        "Mercado Livre",

      precos:
        precosMercadoLivre,

      concorrentes:
        resultadoBuscaML
          ?.resumo
          ?.concorrentes ||
        0,
    });

  const resultadoShopee =
    analisarCanal({
      nome:
        "Shopee",

      precos:
        shopee.precos ||
        [],

      concorrentes:
        shopee.concorrentes ||
        0,
    });

  const resultadoAmazon =
    analisarCanal({
      nome:
        "Amazon",

      precos:
        amazon.precos ||
        [],

      concorrentes:
        amazon.concorrentes ||
        0,
    });

  const precosMercado = [
    resultadoML.precoMedio,
    resultadoShopee.precoMedio,
    resultadoAmazon.precoMedio,
  ].filter(
    (valor) => valor > 0
  );

  const precoMedioGeral =
    media(
      precosMercado
    );

  const menorPrecoGeral =
    menor([
      resultadoML.menorPreco,
      resultadoShopee.menorPreco,
      resultadoAmazon.menorPreco,
    ]);

  const maiorPrecoGeral =
    maior([
      resultadoML.maiorPreco,
      resultadoShopee.maiorPreco,
      resultadoAmazon.maiorPreco,
    ]);

  const totalConcorrentes =
    resultadoML.concorrentes +
    resultadoShopee.concorrentes +
    resultadoAmazon.concorrentes;

  return {
    codigo,

    canais: {
      mercadoLivre:
        resultadoML,

      shopee:
        resultadoShopee,

      amazon:
        resultadoAmazon,
    },

    detalhes: {
      mercadoLivre:
        resultadoBuscaML,
    },

    resumo: {
      precoMedio:
        precoMedioGeral,

      menorPreco:
        menorPrecoGeral,

      maiorPreco:
        maiorPrecoGeral,

      concorrentes:
        totalConcorrentes,

      possuiDados:
        precosMercado.length >
        0,
    },

    fonte:
      precosMercado.length >
      0
        ? "Dados recebidos dos marketplaces"
        : "Nenhum dado de mercado disponível",
  };
}

export default motorMercado;