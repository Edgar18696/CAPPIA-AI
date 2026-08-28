import { supabase } from "../supabase";

function limparTexto(valor = "") {
  return String(valor || "")
    .replace(/\s+/g, " ")
    .trim();
}

function montarTermo({
  codigo = "",
  titulo = "",
  fabricante = "",
  peca = "",
}) {
  const partes = [
    codigo,
    fabricante,
    peca,
    titulo,
  ]
    .map(limparTexto)
    .filter(Boolean);

  return [...new Set(partes)]
    .join(" ")
    .trim();
}

function detectarCategoria(
  texto = ""
) {
  const valor = limparTexto(texto)
    .toLowerCase();

  if (
    valor.includes("original") ||
    valor.includes("genuino") ||
    valor.includes("genuíno") ||
    valor.includes("oem")
  ) {
    return "original";
  }

  if (
    valor.includes("paralelo") ||
    valor.includes("paralela") ||
    valor.includes("aftermarket")
  ) {
    return "paralela";
  }

  return "equivalente";
}

function calcularEstatisticas(
  itens = []
) {
  const precos = itens
    .map((item) =>
      Number(item?.preco)
    )
    .filter(
      (valor) =>
        Number.isFinite(valor) &&
        valor > 0
    )
    .sort((a, b) => a - b);

  if (!precos.length) {
    return {
      minimo: null,
      maximo: null,
      media: null,
      quantidade: 0,
    };
  }

  const soma =
    precos.reduce(
      (total, valor) =>
        total + valor,
      0
    );

  return {
    minimo:
      precos[0],

    maximo:
      precos[
        precos.length - 1
      ],

    media:
      soma / precos.length,

    quantidade:
      precos.length,
  };
}

function calcularMercadoGeral(
  mercadoLivre,
  shopee
) {
  const valores = [
    mercadoLivre?.minimo,
    mercadoLivre?.maximo,
    shopee?.minimo,
    shopee?.maximo,
  ].filter(
    (valor) =>
      Number.isFinite(valor)
  );

  if (!valores.length) {
    return {
      minimo: null,
      maximo: null,
      media: null,
      quantidade: 0,
    };
  }

  const soma =
    valores.reduce(
      (total, valor) =>
        total + valor,
      0
    );

  return {
    minimo:
      Math.min(...valores),

    maximo:
      Math.max(...valores),

    media:
      soma / valores.length,

    quantidade:
      (
        mercadoLivre?.quantidade ||
        0
      ) +
      (
        shopee?.quantidade ||
        0
      ),
  };
}

export async function pesquisarConcorrencia({
  codigo = "",
  titulo = "",
  fabricante = "",
  peca = "",
  categoria = "",
} = {}) {
  const termo =
    montarTermo({
      codigo,
      titulo,
      fabricante,
      peca,
    });

  if (!termo) {
    throw new Error(
      "Não há dados suficientes para pesquisar a concorrência."
    );
  }

  const categoriaPeca =
    categoria ||
    detectarCategoria(
      [
        titulo,
        fabricante,
        peca,
      ].join(" ")
    );

  console.log(
    "🤖 PAIZINHO PESQUISANDO MERCADO:",
    {
      termo,
      codigo,
      fabricante,
      categoria:
        categoriaPeca,
    }
  );

  const {
    data,
    error,
  } =
    await supabase.functions.invoke(
      "concorrencia",
      {
        body: {
          termo,

          codigo:
            limparTexto(codigo),

          titulo:
            limparTexto(titulo),

          fabricante:
            limparTexto(
              fabricante
            ),

          peca:
            limparTexto(peca),

          categoria:
            categoriaPeca,

          marketplaces: [
            "mercado_livre",
            "shopee",
          ],
        },
      }
    );

  if (error) {
    console.error(
      "❌ ERRO EDGE FUNCTION CONCORRÊNCIA:",
      error
    );

    throw new Error(
      error?.message ||
      "Não foi possível pesquisar a concorrência."
    );
  }

  if (data?.error) {
    throw new Error(
      data.error
    );
  }

  const itensMercadoLivre =
    Array.isArray(
      data?.mercadoLivre
    )
      ? data.mercadoLivre
      : [];

  const itensShopee =
    Array.isArray(
      data?.shopee
    )
      ? data.shopee
      : [];

  const mercadoLivre =
    calcularEstatisticas(
      itensMercadoLivre
    );

  const shopee =
    calcularEstatisticas(
      itensShopee
    );

  const mercadoGeral =
    calcularMercadoGeral(
      mercadoLivre,
      shopee
    );

  console.log(
    "✅ RESULTADO PAIZINHO:",
    {
      mercadoLivre,
      shopee,
      mercadoGeral,
    }
  );

  return {
    termo:

      data?.termo ||
      termo,

    categoria:
      data?.categoria ||
      categoriaPeca,

    mercadoLivre,

    shopee,

    mercadoGeral,

    anuncios: {
      mercadoLivre:
        itensMercadoLivre,

      shopee:
        itensShopee,
    },

    totalShopping:
      Number(
        data?.totalShopping ||
        0
      ),
  };
}

export default pesquisarConcorrencia;