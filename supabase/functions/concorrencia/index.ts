type Marketplace =
  | "mercado_livre"
  | "shopee";

type CategoriaPeca =
  | "original"
  | "equivalente"
  | "paralela";

type ItemConcorrencia = {
  marketplace: Marketplace;
  titulo: string;
  preco: number;
  link: string;
  fonte: string;
  categoria: CategoriaPeca;
  codigo_exato?: boolean;
};

type PalavraChaveSugerida = {
  termo: string;
  ocorrencias: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

/*
 * =====================================================
 * RESPOSTA
 * =====================================================
 */

function respostaJson(
  body: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json; charset=utf-8",
      },
    }
  );
}

/*
 * =====================================================
 * NORMALIZAÇÃO
 * =====================================================
 */

function limparTexto(
  valor: unknown
) {
  return String(valor ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarTexto(
  valor: unknown
) {
  return limparTexto(valor)
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase();
}

function normalizarCodigo(
  valor: unknown
) {
  return String(valor ?? "")
    .toUpperCase()
    .replace(
      /[^A-Z0-9]/g,
      ""
    );
}

function numeroPreco(
  valor: unknown
) {
  if (
    typeof valor === "number"
  ) {
    return Number.isFinite(valor)
      ? valor
      : 0;
  }

  const texto =
    String(valor ?? "")
      .replace(
        /[^\d,.-]/g,
        ""
      )
      .trim();

  if (!texto) {
    return 0;
  }

  if (
    texto.includes(",") &&
    texto.includes(".")
  ) {
    const ultimaVirgula =
      texto.lastIndexOf(",");

    const ultimoPonto =
      texto.lastIndexOf(".");

    if (
      ultimaVirgula >
      ultimoPonto
    ) {
      return Number(
        texto
          .replace(
            /\./g,
            ""
          )
          .replace(
            ",",
            "."
          )
      );
    }

    return Number(
      texto.replace(
        /,/g,
        ""
      )
    );
  }

  if (
    texto.includes(",")
  ) {
    return Number(
      texto
        .replace(
          /\./g,
          ""
        )
        .replace(
          ",",
          "."
        )
    );
  }

  return Number(texto);
}

/*
 * =====================================================
 * MARKETPLACE
 * =====================================================
 */

function detectarMarketplace(
  item: any
):
  | Marketplace
  | null {
  const texto =
    normalizarTexto(
      [
        item?.source,
        item?.seller,
        item?.merchant,
        item?.link,
        item?.product_link,
        item?.displayed_link,
        item?.title,
      ].join(" ")
    );

  if (
    texto.includes(
      "mercado livre"
    ) ||
    texto.includes(
      "mercadolivre"
    ) ||
    texto.includes(
      "mercadolibre"
    )
  ) {
    return "mercado_livre";
  }

  if (
    texto.includes(
      "shopee"
    )
  ) {
    return "shopee";
  }

  return null;
}

/*
 * =====================================================
 * CATEGORIA
 * =====================================================
 */

function detectarCategoria(
  texto: string,
  fabricanteAnuncio = ""
): CategoriaPeca {
  const valor =
    normalizarTexto(texto);

  const fabricante =
    normalizarTexto(
      fabricanteAnuncio
    );

  if (
    valor.includes(
      "original"
    ) ||
    valor.includes(
      "genuino"
    ) ||
    valor.includes(
      "genuine"
    ) ||
    valor.includes(
      "peca genuina"
    ) ||
    valor.includes(
      "peca original"
    ) ||
    valor.includes(
      "oem"
    )
  ) {
    return "original";
  }

  if (
    valor.includes(
      "paralelo"
    ) ||
    valor.includes(
      "paralela"
    ) ||
    valor.includes(
      "aftermarket"
    ) ||
    valor.includes(
      "similar"
    )
  ) {
    return "paralela";
  }

  if (
    fabricante &&
    valor.includes(
      fabricante
    )
  ) {
    return "equivalente";
  }

  return "equivalente";
}

function categoriaCompativel({
  categoriaAnuncio,
  categoriaItem,
}: {
  categoriaAnuncio:
    CategoriaPeca;
  categoriaItem:
    CategoriaPeca;
}) {
  if (
    categoriaAnuncio ===
    "original"
  ) {
    return (
      categoriaItem ===
      "original"
    );
  }

  if (
    categoriaAnuncio ===
    "paralela"
  ) {
    return (
      categoriaItem ===
        "paralela" ||
      categoriaItem ===
        "equivalente"
    );
  }

  return (
    categoriaItem ===
      "equivalente" ||
    categoriaItem ===
      "paralela"
  );
}

/*
 * =====================================================
 * CÓDIGO
 * =====================================================
 */

function tituloContemCodigo({
  titulo,
  codigo,
}: {
  titulo: string;
  codigo: string;
}) {
  const codigoLimpo =
    normalizarCodigo(
      codigo
    );

  if (!codigoLimpo) {
    return false;
  }

  const tituloLimpo =
    normalizarCodigo(
      titulo
    );

  return tituloLimpo.includes(
    codigoLimpo
  );
}

/*
 * =====================================================
 * BLOQUEIO DE PRODUTOS ERRADOS
 * =====================================================
 */

function tituloEhAcessorioOuProdutoDiferente(
  titulo: string
) {
  const texto =
    normalizarTexto(
      titulo
    );

  const termosBloqueados = [
    "enganador",
    "enganar sonda",
    "emulador",
    "simulador",
    "simulacao",
    "adaptador",
    "extensor",
    "espacador",
    "prolongador",
    "chicote",
    "conector",
    "plug",
    "soquete",
    "kit reparo",
    "kit de reparo",
    "reparo",
    "capa",
    "protetor",
    "eliminador de erro",
    "eliminador erro",
    "mini catalisador",
    "mini catalizador",
    "porca sonda",
    "rosca sonda",
    "bucha sonda",
  ];

  return termosBloqueados.some(
    (termo) =>
      texto.includes(
        termo
      )
  );
}

/*
 * =====================================================
 * RELEVÂNCIA
 * =====================================================
 */

function itemEhRelevante({
  item,
  codigo,
  peca,
  tituloAnuncio,
}: {
  item: ItemConcorrencia;
  codigo: string;
  peca: string;
  tituloAnuncio: string;
}) {
  if (
    tituloEhAcessorioOuProdutoDiferente(
      item.titulo
    )
  ) {
    return false;
  }

  /*
   * Se bateu código exato,
   * já é extremamente relevante.
   */
  if (
    tituloContemCodigo({
      titulo:
        item.titulo,
      codigo,
    })
  ) {
    return true;
  }

  const tituloItem =
    normalizarTexto(
      item.titulo
    );

  const palavras =
    normalizarTexto(
      [
        peca,
        tituloAnuncio,
      ].join(" ")
    )
      .split(/\s+/)
      .filter(
        (termo) =>
          termo.length >= 5
      );

  if (!palavras.length) {
    return true;
  }

  const palavrasUnicas =
    [
      ...new Set(
        palavras
      ),
    ];

  const correspondencias =
    palavrasUnicas.filter(
      (termo) =>
        tituloItem.includes(
          termo
        )
    ).length;

  return (
    correspondencias >= 1
  );
}

/*
 * =====================================================
 * GOOGLE SHOPPING — SERPAPI
 * =====================================================
 *
 * Esta passa a ser a fonte PRINCIPAL.
 *
 * O Google Shopping fornece:
 *
 * extracted_price
 * price
 * source
 * title
 * product_link
 *
 * Portanto não dependemos mais do preço
 * encontrado dentro de snippets orgânicos.
 */

async function pesquisarGoogleShopping({
  termo,
  apiKey,
  marketplace,
}: {
  termo: string;
  apiKey: string;
  marketplace: Marketplace;
}) {
  const nomeMarketplace =
    marketplace ===
    "mercado_livre"
      ? "Mercado Livre"
      : "Shopee";

  const termoPesquisa =
    `${termo} ${nomeMarketplace}`;

  const parametros =
    new URLSearchParams({
      engine:
        "google_shopping",

      q:
        termoPesquisa,

      gl:
        "br",

      hl:
        "pt-br",

      google_domain:
        "google.com.br",

      device:
        "desktop",

      api_key:
        apiKey,
    });

  const url =
    `https://serpapi.com/search.json?${parametros.toString()}`;

  const resposta =
    await fetch(
      url,
      {
        method: "GET",
      }
    );

  if (!resposta.ok) {
    const texto =
      await resposta.text();

    console.error(
      "SERPAPI SHOPPING ERRO:",
      resposta.status,
      texto
    );

    throw new Error(
      `Falha na pesquisa Shopping (${resposta.status}).`
    );
  }

  const dados =
    await resposta.json();

  const resultados =
    Array.isArray(
      dados?.shopping_results
    )
      ? dados.shopping_results
      : [];

  console.log(
    "🛒 GOOGLE SHOPPING:",
    {
      marketplace,
      termo:
        termoPesquisa,
      total:
        resultados.length,
    }
  );

  return resultados;
}

/*
 * =====================================================
 * FALLBACK GOOGLE ORGÂNICO
 * =====================================================
 *
 * Usado apenas quando o Shopping não
 * encontra uma amostra suficiente.
 */

async function pesquisarGoogleOrganico({
  termo,
  apiKey,
  marketplace,
}: {
  termo: string;
  apiKey: string;
  marketplace: Marketplace;
}) {
  const site =
    marketplace ===
    "mercado_livre"
      ? "mercadolivre.com.br"
      : "shopee.com.br";

  const termoPesquisa =
    `${termo} site:${site}`;

  const parametros =
    new URLSearchParams({
      engine:
        "google",

      q:
        termoPesquisa,

      gl:
        "br",

      hl:
        "pt-br",

      google_domain:
        "google.com.br",

      device:
        "desktop",

      num:
        "20",

      api_key:
        apiKey,
    });

  const url =
    `https://serpapi.com/search.json?${parametros.toString()}`;

  const resposta =
    await fetch(
      url,
      {
        method:
          "GET",
      }
    );

  if (!resposta.ok) {
    console.warn(
      "Fallback orgânico falhou:",
      resposta.status
    );

    return [];
  }

  const dados =
    await resposta.json();

  return Array.isArray(
    dados?.organic_results
  )
    ? dados.organic_results
    : [];
}

/*
 * =====================================================
 * PREÇO SHOPPING
 * =====================================================
 */

function extrairPrecoShopping(
  item: any
) {
  const candidatos = [
    item?.extracted_price,
    item?.price,
    item?.alternative_price
      ?.extracted_price,
    item?.alternative_price
      ?.price,
  ];

  for (
    const candidato of
    candidatos
  ) {
    const preco =
      numeroPreco(
        candidato
      );

    if (
      Number.isFinite(
        preco
      ) &&
      preco > 0
    ) {
      return preco;
    }
  }

  return 0;
}

/*
 * =====================================================
 * PREÇO ORGÂNICO — SOMENTE FALLBACK
 * =====================================================
 */

function extrairPrecoOrganic(
  item: any
) {
  const candidatos = [
    item?.rich_snippet
      ?.top
      ?.detected_extensions
      ?.price,

    item?.rich_snippet
      ?.bottom
      ?.detected_extensions
      ?.price,

    item?.rich_snippet
      ?.detected_extensions
      ?.price,

    item?.detected_extensions
      ?.price,

    item?.price,
  ];

  for (
    const candidato of
    candidatos
  ) {
    const numero =
      numeroPreco(
        candidato
      );

    if (
      Number.isFinite(
        numero
      ) &&
      numero > 0
    ) {
      return numero;
    }
  }

  const texto = [
    item?.title,
    item?.snippet,
    item?.rich_snippet
      ?.top
      ?.extensions,
    item?.rich_snippet
      ?.bottom
      ?.extensions,
  ]
    .flat()
    .filter(Boolean)
    .join(" ");

  const padroes = [
    /R\$\s*([\d.]+,\d{2})/i,
    /R\$\s*([\d,]+\.\d{2})/i,
  ];

  for (
    const padrao of
    padroes
  ) {
    const match =
      texto.match(
        padrao
      );

    if (
      match?.[1]
    ) {
      const numero =
        numeroPreco(
          match[1]
        );

      if (
        Number.isFinite(
          numero
        ) &&
        numero > 0
      ) {
        return numero;
      }
    }
  }

  return 0;
}

/*
 * =====================================================
 * CONVERSÃO SHOPPING
 * =====================================================
 */

function converterShopping({
  item,
  marketplace,
  fabricante,
  codigo,
}: {
  item: any;
  marketplace: Marketplace;
  fabricante: string;
  codigo: string;
}):
  | ItemConcorrencia
  | null {
  const titulo =
    limparTexto(
      item?.title
    );

  const preco =
    extrairPrecoShopping(
      item
    );

  if (
    !titulo ||
    !Number.isFinite(
      preco
    ) ||
    preco <= 0
  ) {
    return null;
  }

  /*
   * Se o Google identificar explicitamente
   * outro vendedor, descartamos.
   */
  const marketplaceDetectado =
    detectarMarketplace(
      item
    );

  if (
    marketplaceDetectado &&
    marketplaceDetectado !==
      marketplace
  ) {
    return null;
  }

  const link =
    limparTexto(
      item?.link ||
      item?.product_link ||
      item?.serpapi_product_api ||
      ""
    );

  const fonte =
    limparTexto(
      item?.source ||
      (
        marketplace ===
        "mercado_livre"
          ? "Mercado Livre"
          : "Shopee"
      )
    );

  return {
    marketplace,

    titulo,

    preco,

    link,

    fonte,

    categoria:
      detectarCategoria(
        [
          titulo,
          item?.snippet,
          fonte,
        ].join(" "),
        fabricante
      ),

    codigo_exato:
      tituloContemCodigo({
        titulo,
        codigo,
      }),
  };
}

/*
 * =====================================================
 * CONVERSÃO ORGÂNICA
 * =====================================================
 */

function converterOrganic({
  item,
  marketplace,
  fabricante,
  codigo,
}: {
  item: any;
  marketplace: Marketplace;
  fabricante: string;
  codigo: string;
}):
  | ItemConcorrencia
  | null {
  const titulo =
    limparTexto(
      item?.title
    );

  const preco =
    extrairPrecoOrganic(
      item
    );

  if (
    !titulo ||
    !Number.isFinite(
      preco
    ) ||
    preco <= 0
  ) {
    return null;
  }

  const link =
    limparTexto(
      item?.link ||
      item?.redirect_link ||
      ""
    );

  const fonte =
    limparTexto(
      item?.source ||
      item?.displayed_link ||
      (
        marketplace ===
        "mercado_livre"
          ? "Mercado Livre"
          : "Shopee"
      )
    );

  return {
    marketplace,

    titulo,

    preco,

    link,

    fonte,

    categoria:
      detectarCategoria(
        [
          titulo,
          item?.snippet,
          fonte,
        ].join(" "),
        fabricante
      ),

    codigo_exato:
      tituloContemCodigo({
        titulo,
        codigo,
      }),
  };
}

/*
 * =====================================================
 * REMOVER DUPLICADOS
 * =====================================================
 */

function removerDuplicados(
  itens:
    ItemConcorrencia[]
) {
  const mapa =
    new Map<
      string,
      ItemConcorrencia
    >();

  for (
    const item of itens
  ) {
    const chave =
      [
        item.marketplace,

        normalizarTexto(
          item.titulo
        ),

        item.preco.toFixed(
          2
        ),
      ].join("|");

    if (
      !mapa.has(
        chave
      )
    ) {
      mapa.set(
        chave,
        item
      );
    }
  }

  return [
    ...mapa.values(),
  ];
}

/*
 * =====================================================
 * MEDIANA
 * =====================================================
 */

function medianaNumeros(
  valores: number[]
) {
  if (
    !valores.length
  ) {
    return 0;
  }

  const ordenados =
    [...valores].sort(
      (a, b) =>
        a - b
    );

  const meio =
    Math.floor(
      ordenados.length /
        2
    );

  if (
    ordenados.length % 2
  ) {
    return ordenados[
      meio
    ];
  }

  return (
    ordenados[
      meio - 1
    ] +
    ordenados[
      meio
    ]
  ) / 2;
}

/*
 * =====================================================
 * FILTRO DE OUTLIERS
 * =====================================================
 */

function filtrarPrecosForaDoPadrao(
  itens:
    ItemConcorrencia[]
) {
  const validos =
    itens
      .filter(
        (item) =>
          Number.isFinite(
            item.preco
          ) &&
          item.preco > 0
      )
      .sort(
        (a, b) =>
          a.preco -
          b.preco
      );

  /*
   * Com amostra pequena não temos
   * informação suficiente para eliminar
   * preços automaticamente.
   */
  if (
    validos.length < 3
  ) {
    return validos;
  }

  const precos =
    validos.map(
      (item) =>
        item.preco
    );

  const centro =
    medianaNumeros(
      precos
    );

  if (
    !Number.isFinite(
      centro
    ) ||
    centro <= 0
  ) {
    return validos;
  }

  const minimo =
    centro *
    0.40;

  const maximo =
    centro *
    2.50;

  const filtrados =
    validos.filter(
      (item) =>
        item.preco >=
          minimo &&
        item.preco <=
          maximo
    );

  /*
   * Nunca destruímos toda a amostra.
   */
  return filtrados.length
    ? filtrados
    : validos;
}

/*
 * =====================================================
 * SELEÇÃO DE CONCORRENTES
 * =====================================================
 */

function selecionarComparaveis({
  itens,
  codigo,
  categoria,
  peca,
  titulo,
}: {
  itens:
    ItemConcorrencia[];
  codigo: string;
  categoria:
    CategoriaPeca;
  peca: string;
  titulo: string;
}) {
  let base =
    removerDuplicados(
      itens
    );

  base =
    base.filter(
      (item) =>
        itemEhRelevante({
          item,
          codigo,
          peca,
          tituloAnuncio:
            titulo,
        })
    );

  /*
   * PRIORIDADE ABSOLUTA:
   * código exato.
   *
   * Mas só usamos a faixa exclusiva de
   * código quando temos pelo menos
   * DOIS anúncios, evitando o problema
   * mínimo = médio = máximo por causa
   * de apenas um resultado.
   */
  const codigoExato =
    base.filter(
      (item) =>
        item.codigo_exato
    );

  if (
    codigoExato.length >=
    2
  ) {
    const categoriaExata =
      codigoExato.filter(
        (item) =>
          categoriaCompativel({
            categoriaAnuncio:
              categoria,

            categoriaItem:
              item.categoria,
          })
      );

    if (
      categoriaExata.length >=
      2
    ) {
      return filtrarPrecosForaDoPadrao(
        categoriaExata
      );
    }

    return filtrarPrecosForaDoPadrao(
      codigoExato
    );
  }

  /*
   * Só encontramos um anúncio com o
   * código exato.
   *
   * Tentamos complementar com anúncios
   * tecnicamente relevantes.
   */
  const categoriaCompativelLista =
    base.filter(
      (item) =>
        categoriaCompativel({
          categoriaAnuncio:
            categoria,

          categoriaItem:
            item.categoria,
        })
    );

  if (
    categoriaCompativelLista
      .length >= 2
  ) {
    return filtrarPrecosForaDoPadrao(
      categoriaCompativelLista
    );
  }

  /*
   * Se realmente existir somente um
   * resultado válido, retornamos um.
   * Não inventamos uma faixa.
   */
  if (
    codigoExato.length ===
    1
  ) {
    return codigoExato;
  }

  return filtrarPrecosForaDoPadrao(
    base
  );
}

/*
 * =====================================================
 * FAIXA
 * =====================================================
 */

function calcularFaixa(
  itens:
    ItemConcorrencia[]
) {
  const validos =
    [...itens]
      .filter(
        (item) =>
          Number.isFinite(
            item.preco
          ) &&
          item.preco > 0
      )
      .sort(
        (a, b) =>
          a.preco -
          b.preco
      );

  if (
    !validos.length
  ) {
    return null;
  }

  const soma =
    validos.reduce(
      (
        total,
        item
      ) =>
        total +
        item.preco,
      0
    );

  return {
    minimo:
      Number(
        validos[
          0
        ].preco.toFixed(
          2
        )
      ),

    maximo:
      Number(
        validos[
          validos.length -
            1
        ].preco.toFixed(
          2
        )
      ),

    media:
      Number(
        (
          soma /
          validos.length
        ).toFixed(
          2
        )
      ),

    quantidade:
      validos.length,
  };
}

/*
 * =====================================================
 * PALAVRAS-CHAVE
 * =====================================================
 */

function extrairPalavrasChaveConcorrencia({
  itens,
  codigo,
  peca,
  fabricante,
}: {
  itens:
    ItemConcorrencia[];
  codigo: string;
  peca: string;
  fabricante: string;
}):
  PalavraChaveSugerida[] {
  const ignorar =
    new Set([
      "para",
      "com",
      "sem",
      "por",
      "das",
      "dos",
      "uma",
      "novo",
      "nova",
      "produto",
      "peca",
      "pecas",
      "original",
      "genuino",
      "genuina",
      "compativel",
      "promocao",
      "oferta",
      "frete",
      "gratis",
      "mercado",
      "livre",
      "shopee",
    ]);

  const codigoNormalizado =
    normalizarCodigo(
      codigo
    );

  const termosObrigatorios =
    new Set(
      normalizarTexto(
        [
          peca,
          fabricante,
        ].join(" ")
      )
        .split(/\s+/)
        .filter(
          (termo) =>
            termo.length >=
            3
        )
    );

  const contagem =
    new Map<
      string,
      number
    >();

  for (
    const item of itens
  ) {
    const palavras =
      new Set(
        normalizarTexto(
          item.titulo
        )
          .replace(
            /[^a-z0-9\s-]/g,
            " "
          )
          .split(/\s+/)
          .map(
            (termo) =>
              termo.trim()
          )
          .filter(Boolean)
          .filter(
            (termo) =>
              termo.length >=
              3
          )
          .filter(
            (termo) =>
              !ignorar.has(
                termo
              )
          )
          .filter(
            (termo) =>
              normalizarCodigo(
                termo
              ) !==
              codigoNormalizado
          )
      );

    for (
      const termo of
      palavras
    ) {
      contagem.set(
        termo,
        (
          contagem.get(
            termo
          ) || 0
        ) + 1
      );
    }
  }

  return [
    ...contagem.entries(),
  ]
    .filter(
      ([
        termo,
        ocorrencias,
      ]) =>
        ocorrencias >= 2 ||
        termosObrigatorios.has(
          termo
        )
    )
    .sort(
      (a, b) =>
        b[1] -
          a[1] ||
        b[0].length -
          a[0].length
    )
    .slice(
      0,
      15
    )
    .map(
      ([
        termo,
        ocorrencias,
      ]) => ({
        termo,
        ocorrencias,
      })
    );
}

/*
 * =====================================================
 * PESQUISA DE UM MARKETPLACE
 * =====================================================
 */

async function pesquisarMarketplace({
  termo,
  apiKey,
  marketplace,
  fabricante,
  codigo,
  categoria,
  peca,
  titulo,
}: {
  termo: string;
  apiKey: string;
  marketplace: Marketplace;
  fabricante: string;
  codigo: string;
  categoria:
    CategoriaPeca;
  peca: string;
  titulo: string;
}) {
  /*
   * PRIMEIRA TENTATIVA:
   * Google Shopping.
   */
  const shopping =
    await pesquisarGoogleShopping({
      termo,
      apiKey,
      marketplace,
    });

  let convertidos =
    shopping
      .map(
        (item) =>
          converterShopping({
            item,
            marketplace,
            fabricante,
            codigo,
          })
      )
      .filter(
        Boolean
      ) as
      ItemConcorrencia[];

  /*
   * Filtramos rapidamente produtos
   * completamente diferentes.
   */
  convertidos =
    convertidos.filter(
      (item) =>
        !tituloEhAcessorioOuProdutoDiferente(
          item.titulo
        )
    );

  const exatos =
    convertidos.filter(
      (item) =>
        item.codigo_exato
    );

  /*
   * Se Shopping trouxe pelo menos dois
   * anúncios do código, não gastamos
   * nova chamada na SerpAPI.
   */
  if (
    exatos.length >= 2
  ) {
    return selecionarComparaveis({
      itens:
        convertidos,

      codigo,

      categoria,

      peca,

      titulo,
    });
  }

  /*
   * FALLBACK:
   * Google orgânico restrito ao site.
   *
   * Só é executado se o Shopping ainda
   * não conseguiu formar uma amostra
   * de código exato.
   */
  const organicos =
    await pesquisarGoogleOrganico({
      termo,
      apiKey,
      marketplace,
    });

  const convertidosOrganicos =
    organicos
      .map(
        (item) =>
          converterOrganic({
            item,
            marketplace,
            fabricante,
            codigo,
          })
      )
      .filter(
        Boolean
      ) as
      ItemConcorrencia[];

  const unidos =
    removerDuplicados([
      ...convertidos,
      ...convertidosOrganicos,
    ]);

  return selecionarComparaveis({
    itens:
      unidos,

    codigo,

    categoria,

    peca,

    titulo,
  });
}

/*
 * =====================================================
 * EDGE FUNCTION
 * =====================================================
 */

Deno.serve(
  async (
    req: Request
  ) => {
    if (
      req.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            corsHeaders,
        }
      );
    }

    if (
      req.method !==
      "POST"
    ) {
      return respostaJson(
        {
          error:
            "Método não permitido.",
        },
        405
      );
    }

    try {
      const apiKey =
        Deno.env.get(
          "SERPAPI_KEY"
        );

      if (!apiKey) {
        return respostaJson(
          {
            error:
              "SERPAPI_KEY não configurada.",
          },
          500
        );
      }

      const body =
        await req.json();

      const codigo =
        limparTexto(
          body?.codigo
        );

      const oem =
        limparTexto(
          body?.oem
        );

      const titulo =
        limparTexto(
          body?.titulo
        );

      const peca =
        limparTexto(
          body?.peca ||
          body?.descricao
        );

      const fabricante =
        limparTexto(
          body?.fabricante
        );

      const categoriaRecebida =
        limparTexto(
          body?.categoria
        );

      let categoria:
        CategoriaPeca =
        "equivalente";

      if (
        categoriaRecebida ===
          "original" ||
        categoriaRecebida ===
          "paralela" ||
        categoriaRecebida ===
          "equivalente"
      ) {
        categoria =
          categoriaRecebida;
      } else {
        categoria =
          detectarCategoria(
            [
              titulo,
              peca,
              fabricante,
            ].join(" "),
            fabricante
          );
      }

      /*
       * =================================================
       * TERMO DE PESQUISA
       * =================================================
       *
       * Código é prioridade absoluta.
       */

      const codigoBusca =
        limparTexto(
          codigo ||
          oem
        );

      const nomePeca =
        limparTexto(
          peca
        );

      const tituloSemCodigo =
        limparTexto(
          titulo
        );

      const nomeCurto =
        (
          nomePeca ||
          tituloSemCodigo
        )
          .split(/\s+/)
          .filter(Boolean)
          .slice(
            0,
            3
          )
          .join(" ");

      /*
       * Aspas ajudam o Google a tratar
       * o código como elemento principal.
       */
      const codigoPesquisa =
        codigoBusca
          ? `"${codigoBusca}"`
          : "";

      const termoFinal =
        [
          codigoPesquisa,
          nomeCurto,
        ]
          .filter(Boolean)
          .join(" ")
          .replace(
            /\s+/g,
            " "
          )
          .trim();

      if (!termoFinal) {
        return respostaJson(
          {
            error:
              "Informe código ou dados da peça.",
          },
          400
        );
      }

      console.log(
        "🤖 PESQUISA CONCORRÊNCIA PAIIA:",
        {
          codigo:
            codigoBusca,

          termo:
            termoFinal,

          categoria,

          fabricante,
        }
      );

      /*
       * Mercado Livre e Shopee
       * continuam independentes.
       */

      const [
        mercadoLivreFinal,
        shopeeFinal,
      ] =
        await Promise.all([
          pesquisarMarketplace({
            termo:
              termoFinal,

            apiKey,

            marketplace:
              "mercado_livre",

            fabricante,

            codigo:
              codigoBusca,

            categoria,

            peca,

            titulo,
          }),

          pesquisarMarketplace({
            termo:
              termoFinal,

            apiKey,

            marketplace:
              "shopee",

            fabricante,

            codigo:
              codigoBusca,

            categoria,

            peca,

            titulo,
          }),
        ]);

      /*
       * Máximo mostrado por
       * marketplace na interface.
       */

      const mercadoLivre =
        mercadoLivreFinal
          .sort(
            (a, b) =>
              a.preco -
              b.preco
          )
          .slice(
            0,
            10
          );

      const shopee =
        shopeeFinal
          .sort(
            (a, b) =>
              a.preco -
              b.preco
          )
          .slice(
            0,
            10
          );

      const comparaveisFinais =
        removerDuplicados([
          ...mercadoLivre,
          ...shopee,
        ]);

      const faixaMercadoLivre =
        calcularFaixa(
          mercadoLivre
        );

      const faixaShopee =
        calcularFaixa(
          shopee
        );

      const faixaComparavel =
        calcularFaixa(
          comparaveisFinais
        );

      const palavrasChaveSugeridas =
        extrairPalavrasChaveConcorrencia({
          itens:
            comparaveisFinais,

          codigo:
            codigoBusca,

          peca:
            peca ||
            titulo,

          fabricante,
        });

      /*
       * URLs abertas pelo usuário.
       *
       * Aqui removemos as aspas para
       * deixar a busca visual normal.
       */

      const termoUrl =
        [
          codigoBusca,
          nomeCurto,
        ]
          .filter(Boolean)
          .join(" ");

      const urlMercadoLivre =
        `https://lista.mercadolivre.com.br/${encodeURIComponent(
          termoUrl
        )}`;

      const urlShopee =
        `https://shopee.com.br/search?keyword=${encodeURIComponent(
          termoUrl
        )}`;

      const quantidadeExata =
        comparaveisFinais.filter(
          (item) =>
            item.codigo_exato
        ).length;

      console.log(
        "📊 RESULTADO CONCORRÊNCIA PAIIA:",
        {
          mercadoLivre:
            mercadoLivre.length,

          shopee:
            shopee.length,

          codigoExato:
            quantidadeExata,

          faixaMercadoLivre,

          faixaShopee,

          faixaComparavel,

          precosMercadoLivre:
            mercadoLivre.map(
              (item) =>
                item.preco
            ),

          precosShopee:
            shopee.map(
              (item) =>
                item.preco
            ),
        }
      );

      return respostaJson(
        {
          sucesso:
            true,

          termo:
            termoUrl,

          categoria,

          totalShopping:
            mercadoLivre.length +
            shopee.length,

          mercadoLivre,

          shopee,

          faixaMercadoLivre,

          faixaShopee,

          faixaComparavel,

          palavrasChaveSugeridas,

          /*
           * Informações adicionais.
           * Não quebram a tela atual.
           */
          diagnostico: {
            codigo:
              codigoBusca,

            resultados_codigo_exato:
              quantidadeExata,

            quantidade_comparavel:
              comparaveisFinais.length,

            fonte_principal:
              "Google Shopping",

            metodo:
              quantidadeExata >=
              2
                ? "codigo_exato"
                : "codigo_e_relevancia",
          },

          descartados:
            0,

          fontes: [
            {
              nome:
                "Mercado Livre",

              url:
                urlMercadoLivre,
            },

            {
              nome:
                "Shopee",

              url:
                urlShopee,
            },
          ],
        }
      );
    } catch (erro) {
      console.error(
        "❌ ERRO CONCORRÊNCIA:",
        erro
      );

      return respostaJson(
        {
          error:
            erro instanceof
              Error
              ? erro.message
              : "Erro ao pesquisar concorrência.",
        },
        500
      );
    }
  }
);