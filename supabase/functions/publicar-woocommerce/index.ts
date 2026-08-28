/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json",
      },
    }
  );
}

function texto(
  valor: unknown
) {
  return String(
    valor ?? ""
  ).trim();
}

function precoWoo(
  valor: unknown
) {
  const textoValor =
    String(
      valor ?? ""
    )
      .replace(
        /R\$/gi,
        ""
      )
      .replace(
        /\s/g,
        ""
      )
      .trim();

  if (!textoValor) {
    return "";
  }

  const normalizado =
    textoValor.includes(",")
      ? textoValor
          .replace(
            /\./g,
            ""
          )
          .replace(
            ",",
            "."
          )
      : textoValor;

  const numero =
    Number(
      normalizado.replace(
        /[^\d.-]/g,
        ""
      )
    );

  if (
    !Number.isFinite(
      numero
    ) ||
    numero < 0
  ) {
    return "";
  }

  return numero.toFixed(2);
}

async function lerResposta(
  resposta: Response
) {
  const respostaTexto =
    await resposta.text();

  if (!respostaTexto) {
    return null;
  }

  try {
    return JSON.parse(
      respostaTexto
    );
  } catch {
    return {
      resposta:
        respostaTexto,
    };
  }
}


function normalizarNome(
  valor: unknown
) {
  return texto(valor)
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase();
}

function adicionarAutenticacao(
  endpoint: URL,
  consumerKey: string,
  consumerSecret: string
) {
  endpoint.searchParams.set(
    "consumer_key",
    consumerKey
  );

  endpoint.searchParams.set(
    "consumer_secret",
    consumerSecret
  );
}

async function buscarOuCriarTermo({
  siteUrl,
  consumerKey,
  consumerSecret,
  tipo,
  nome,
}: {
  siteUrl: string;
  consumerKey: string;
  consumerSecret: string;
  tipo: "categories" | "tags";
  nome: string;
}) {
  const nomeLimpo =
    texto(nome);

  if (!nomeLimpo) {
    return null;
  }

  const endpointBusca =
    new URL(
      `${siteUrl}/wp-json/wc/v3/products/${tipo}`
    );

  endpointBusca.searchParams.set(
    "search",
    nomeLimpo
  );

  endpointBusca.searchParams.set(
    "per_page",
    "100"
  );

  adicionarAutenticacao(
    endpointBusca,
    consumerKey,
    consumerSecret
  );

  const respostaBusca =
    await fetch(
      endpointBusca.toString(),
      {
        method: "GET",
        headers: {
          Accept:
            "application/json",
        },
      }
    );

  const resultadoBusca =
    await lerResposta(
      respostaBusca
    );

  if (!respostaBusca.ok) {
    console.error(
      `❌ Erro ao buscar ${tipo}:`,
      resultadoBusca
    );

    return null;
  }

  const lista =
    Array.isArray(
      resultadoBusca
    )
      ? resultadoBusca
      : [];

  const existente =
    lista.find(
      (item: any) =>
        normalizarNome(
          item?.name
        ) ===
        normalizarNome(
          nomeLimpo
        )
    );

  if (existente?.id) {
    return {
      id:
        existente.id,
      name:
        existente.name,
    };
  }

  const endpointCriar =
    new URL(
      `${siteUrl}/wp-json/wc/v3/products/${tipo}`
    );

  adicionarAutenticacao(
    endpointCriar,
    consumerKey,
    consumerSecret
  );

  const respostaCriar =
    await fetch(
      endpointCriar.toString(),
      {
        method: "POST",
        headers: {
          Accept:
            "application/json",
          "Content-Type":
            "application/json",
        },
        body:
          JSON.stringify({
            name:
              nomeLimpo,
          }),
      }
    );

  const resultadoCriar =
    await lerResposta(
      respostaCriar
    );

  if (!respostaCriar.ok) {
    console.error(
      `❌ Erro ao criar ${tipo}:`,
      resultadoCriar
    );

    return null;
  }

  return resultadoCriar?.id
    ? {
        id:
          resultadoCriar.id,
        name:
          resultadoCriar.name,
      }
    : null;
}

function listaTexto(
  valor: unknown
) {
  return Array.isArray(valor)
    ? [
        ...new Set(
          valor
            .map((item) =>
              texto(item)
            )
            .filter(Boolean)
        ),
      ]
    : [];
}

Deno.serve(
  async (req) => {
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
      return jsonResponse(
        {
          sucesso:
            false,

          erro:
            "Método não permitido. Use POST.",
        },
        405
      );
    }

    try {
      const siteUrl =
        texto(
          Deno.env.get(
            "WOOCOMMERCE_URL"
          )
        ).replace(
          /\/+$/,
          ""
        );

      const consumerKey =
        texto(
          Deno.env.get(
            "WOOCOMMERCE_CONSUMER_KEY"
          )
        );

      const consumerSecret =
        texto(
          Deno.env.get(
            "WOOCOMMERCE_CONSUMER_SECRET"
          )
        );

      if (
        !siteUrl ||
        !consumerKey ||
        !consumerSecret
      ) {
        return jsonResponse(
          {
            sucesso:
              false,

            erro:
              "Secrets do WooCommerce não configurados.",
          },
          500
        );
      }

      const body =
        await req.json();

      const nome =
        texto(
          body?.titulo ||
          body?.nome
        );

      const descricao =
        texto(
          body?.descricao
        );

      const sku =
        texto(
          body?.sku ||
          body?.codigo
        );

      const preco =
        precoWoo(
          body?.preco
        );

      const estoque =
        Math.max(
          0,
          Math.floor(
            Number(
              body?.estoque ??
              0
            ) || 0
          )
        );
const peso =
  texto(
    body?.peso
  );

const comprimento =
  texto(
    body?.dimensoes
      ?.comprimento
  );

const largura =
  texto(
    body?.dimensoes
      ?.largura
  );

const altura =
  texto(
    body?.dimensoes
      ?.altura
  );
      const imagensRecebidas =
        Array.isArray(
          body?.imagens
        )
          ? body.imagens
          : [];

      const breveDescricao =
        texto(
          body?.breve_descricao ||
          body?.short_description
        );

      const categoria =
        texto(
          body?.categoria
        );

      const tagsRecebidas =
        listaTexto(
          body?.tags
        ).slice(0, 20);

      const fabricante =
        texto(
          body?.fabricante
        );

      const montadoras =
        listaTexto(
          body?.montadoras
        ).slice(0, 20);

      const modelos =
        listaTexto(
          body?.modelos
        ).slice(0, 30);

      const motores =
        listaTexto(
          body?.motores
        ).slice(0, 20);

      if (!nome) {
        return jsonResponse(
          {
            sucesso:
              false,

            erro:
              "O título do produto é obrigatório.",
          },
          400
        );
      }

      /*
       * =========================================
       * IMAGENS
       * =========================================
       */

      const imagens =
        imagensRecebidas
          .map(
            (
              item:
                unknown
            ) => {
              if (
                typeof item ===
                "string"
              ) {
                return {
                  src:
                    item.trim(),
                };
              }

              if (
                item &&
                typeof item ===
                  "object"
              ) {
                const objeto =
                  item as Record<
                    string,
                    unknown
                  >;

                const src =
                  texto(
                    objeto.src ||
                    objeto.url ||
                    objeto
                      .imagem_processada ||
                    objeto
                      .imagem_original
                  );

                return {
                  src,
                };
              }

              return {
                src: "",
              };
            }
          )
          .filter(
            (
              item: {
                src: string;
              }
            ) =>
              item.src.startsWith(
                "https://"
              )
          )
          .slice(
            0,
            10
          );

      /*
       * =========================================
       * VERIFICA SKU ANTES DE CRIAR
       * =========================================
       */

      if (sku) {
        console.log(
          "🔎 Verificando SKU:",
          sku
        );

        const endpointBusca =
          new URL(
            `${siteUrl}/wp-json/wc/v3/products`
          );

        endpointBusca
          .searchParams
          .set(
            "sku",
            sku
          );

        endpointBusca
          .searchParams
          .set(
            "per_page",
            "1"
          );

        endpointBusca
          .searchParams
          .set(
            "consumer_key",
            consumerKey
          );

        endpointBusca
          .searchParams
          .set(
            "consumer_secret",
            consumerSecret
          );

        const respostaBusca =
          await fetch(
            endpointBusca
              .toString(),
            {
              method:
                "GET",

              headers: {
                Accept:
                  "application/json",
              },
            }
          );

        const resultadoBusca =
          await lerResposta(
            respostaBusca
          );

        if (
          !respostaBusca.ok
        ) {
          console.error(
            "❌ Erro ao verificar SKU:",
            resultadoBusca
          );

          return jsonResponse(
            {
              sucesso:
                false,

              erro:
                resultadoBusca
                  ?.message ||
                "Não foi possível verificar se o SKU já existe.",

              codigo:
                resultadoBusca
                  ?.code ||
                null,
            },
            respostaBusca.status
          );
        }

        const produtosEncontrados =
          Array.isArray(
            resultadoBusca
          )
            ? resultadoBusca
            : [];

        if (
          produtosEncontrados
            .length > 0
        ) {
          const existente =
            produtosEncontrados[
              0
            ];

          console.log(
            "ℹ️ Produto já existe:",
            existente?.id,
            existente?.sku
          );

          /*
           * Retorna HTTP 200 para que
           * o frontend consiga mostrar
           * nossa mensagem detalhada,
           * em vez do erro genérico
           * "non-2xx status code".
           */
          return jsonResponse(
            {
              sucesso:
                false,

              existente:
                true,

              erro:
                `Este produto já existe no seu site. SKU: ${sku}`,

              mensagem:
                "Produto não duplicado.",

              produto: {
                id:
                  existente?.id,

                nome:
                  existente?.name,

                sku:
                  existente?.sku,

                preco:
                  existente
                    ?.regular_price,

                estoque:
                  existente
                    ?.stock_quantity,

                status:
                  existente
                    ?.status,

                permalink:
                  existente
                    ?.permalink,
              },
            },
            200
          );
        }

        console.log(
          "✅ SKU disponível."
        );
      }

      /*
       * =========================================
       * CATEGORIA E TAGS
       * =========================================
       */

      let categoriaWoo:
        Record<string, unknown> |
        null = null;

      if (categoria) {
        categoriaWoo =
          await buscarOuCriarTermo({
            siteUrl,
            consumerKey,
            consumerSecret,
            tipo:
              "categories",
            nome:
              categoria,
          });
      }

      const tagsWoo:
        Array<
          Record<
            string,
            unknown
          >
        > = [];

      for (
        const nomeTag of tagsRecebidas
      ) {
        const tag =
          await buscarOuCriarTermo({
            siteUrl,
            consumerKey,
            consumerSecret,
            tipo:
              "tags",
            nome:
              nomeTag,
          });

        if (tag?.id) {
          tagsWoo.push({
            id:
              tag.id,
          });
        }
      }

      /*
       * =========================================
       * MONTA PRODUTO
       * =========================================
       */

      const produto:
        Record<
          string,
          unknown
        > = {
          name:
            nome,

          status:
            "draft",

          type:
            "simple",

          description:
            descricao,

          short_description:
            breveDescricao,

          manage_stock:
            true,

          stock_quantity:
            estoque,
        };

      if (sku) {
        produto.sku =
          sku;
      }

      if (preco) {
        produto
          .regular_price =
          preco;
      }

      if (
        imagens.length >
        0
      ) {
        produto.images =
          imagens;
      }

      if (
        categoriaWoo?.id
      ) {
        produto.categories = [
          {
            id:
              categoriaWoo.id,
          },
        ];
      }

      if (
        tagsWoo.length >
        0
      ) {
        produto.tags =
          tagsWoo;
      }

      const atributos:
        Array<
          Record<
            string,
            unknown
          >
        > = [];

      if (fabricante) {
        atributos.push({
          name:
            "Fabricante",
          visible:
            true,
          variation:
            false,
          options: [
            fabricante,
          ],
        });
      }

      if (
        montadoras.length >
        0
      ) {
        atributos.push({
          name:
            "Montadora",
          visible:
            true,
          variation:
            false,
          options:
            montadoras,
        });
      }

      if (
        modelos.length >
        0
      ) {
        atributos.push({
          name:
            "Modelo",
          visible:
            true,
          variation:
            false,
          options:
            modelos,
        });
      }

      if (
        motores.length >
        0
      ) {
        atributos.push({
          name:
            "Motor",
          visible:
            true,
          variation:
            false,
          options:
            motores,
        });
      }

      if (
        atributos.length >
        0
      ) {
        produto.attributes =
          atributos;
      }

      /*
       * =========================================
       * CRIA RASCUNHO
       * =========================================
       */

      const endpoint =
        new URL(
          `${siteUrl}/wp-json/wc/v3/products`
        );

      adicionarAutenticacao(
        endpoint,
        consumerKey,
        consumerSecret
      );

      console.log(
        "🌐 Criando rascunho WooCommerce..."
      );

      const resposta =
        await fetch(
          endpoint.toString(),
          {
            method:
              "POST",

            headers: {
              Accept:
                "application/json",

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                produto
              ),
          }
        );

      const resultado =
        await lerResposta(
          resposta
        );

      console.log(
        "📨 WooCommerce HTTP:",
        resposta.status
      );

      if (
        !resposta.ok
      ) {
        console.error(
          "❌ WooCommerce:",
          resultado
        );

        return jsonResponse(
          {
            sucesso:
              false,

            status_woocommerce:
              resposta.status,

            erro:
              resultado
                ?.message ||
              "Não foi possível criar o produto.",

            codigo:
              resultado
                ?.code ||
              null,
          },
          resposta.status
        );
      }

      console.log(
        "✅ Rascunho criado:",
        resultado?.id
      );

      return jsonResponse({
        sucesso:
          true,

        existente:
          false,

        mensagem:
          "Produto criado como rascunho no WooCommerce.",

        produto: {
          id:
            resultado?.id,

          nome:
            resultado?.name,

          sku:
            resultado?.sku,

          preco:
            resultado
              ?.regular_price,

          estoque:
            resultado
              ?.stock_quantity,

          status:
            resultado?.status,

          permalink:
            resultado
              ?.permalink,
        },
      });
    } catch (error) {
      console.error(
        "❌ ERRO PUBLICAR WOOCOMMERCE:",
        error
      );

      return jsonResponse(
        {
          sucesso:
            false,

          erro:
            error instanceof
              Error
              ? error.message
              : "Erro inesperado ao criar produto no WooCommerce.",
        },
        500
      );
    }
  }
);