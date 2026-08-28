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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(
      "ok",
      {
        headers: corsHeaders,
      }
    );
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        sucesso: false,
        erro:
          "Método não permitido. Use POST.",
      },
      405
    );
  }

  try {
    const siteUrl =
      String(
        Deno.env.get(
          "WOOCOMMERCE_URL"
        ) || ""
      )
        .trim()
        .replace(/\/+$/, "");

    const consumerKey =
      String(
        Deno.env.get(
          "WOOCOMMERCE_CONSUMER_KEY"
        ) || ""
      ).trim();

    const consumerSecret =
      String(
        Deno.env.get(
          "WOOCOMMERCE_CONSUMER_SECRET"
        ) || ""
      ).trim();

    if (
      !siteUrl ||
      !consumerKey ||
      !consumerSecret
    ) {
      return jsonResponse(
        {
          sucesso: false,
          erro:
            "Secrets do WooCommerce não configurados.",
        },
        500
      );
    }

    console.log(
      "🌐 Testando WooCommerce:",
      siteUrl
    );

    /*
     * TESTE SOMENTE DE LEITURA.
     *
     * Não cria, altera ou exclui
     * nenhum produto.
     *
     * Usamos query string porque
     * alguns servidores WordPress
     * removem o header Authorization.
     */

    const endpoint =
      new URL(
        `${siteUrl}/wp-json/wc/v3/products`
      );

    endpoint.searchParams.set(
      "per_page",
      "1"
    );

    endpoint.searchParams.set(
      "consumer_key",
      consumerKey
    );

    endpoint.searchParams.set(
      "consumer_secret",
      consumerSecret
    );

    const resposta =
      await fetch(
        endpoint.toString(),
        {
          method: "GET",
          headers: {
            Accept:
              "application/json",
          },
        }
      );

    const texto =
      await resposta.text();

    let dados: any = null;

    try {
      dados =
        texto
          ? JSON.parse(texto)
          : null;
    } catch {
      dados = {
        resposta: texto,
      };
    }

    console.log(
      "📨 WooCommerce HTTP:",
      resposta.status
    );

    if (!resposta.ok) {
      console.error(
        "❌ WooCommerce:",
        dados
      );

      return jsonResponse(
        {
          sucesso: false,

          status_woocommerce:
            resposta.status,

          erro:
            dados?.message ||
            "WooCommerce recusou a conexão.",

          codigo:
            dados?.code ||
            null,
        },
        resposta.status
      );
    }

    const produtos =
      Array.isArray(dados)
        ? dados
        : [];

    console.log(
      "✅ WooCommerce conectado."
    );

    return jsonResponse({
      sucesso: true,

      mensagem:
        "Conexão com WooCommerce aprovada.",

      site:
        siteUrl,

      api:
        "wc/v3",

      autenticacao:
        "query_string",

      produtos_recebidos:
        produtos.length,

      primeiro_produto:
        produtos[0]
          ? {
              id:
                produtos[0]?.id,

              nome:
                produtos[0]?.name,

              status:
                produtos[0]?.status,

              sku:
                produtos[0]?.sku,
            }
          : null,
    });
  } catch (error) {
    console.error(
      "❌ ERRO TESTE WOOCOMMERCE:",
      error
    );

    return jsonResponse(
      {
        sucesso: false,

        erro:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao conectar ao WooCommerce.",
      },
      500
    );
  }
});