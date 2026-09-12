import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

function responder(
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
          "application/json; charset=utf-8",
      },
    }
  );
}

function numero(valor: unknown) {
  const convertido =
    Number(valor);

  return Number.isFinite(convertido)
    ? convertido
    : 0;
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

  try {
    const body =
      await req.json();

    const {
      usuarioId,

      precoVenda,
      custoProduto,

      categoriaId,

      listingTypeId =
        "gold_special",

      shippingMode =
        "me2",

      logisticType =
        "drop_off",

      altura,
      largura,
      comprimento,
      peso,

      freteGratis = true,
    } = body;

    /*
     * ============================================
     * 1. VALIDAÇÕES
     * ============================================
     */

    if (!usuarioId) {
      return responder({
        ok: false,
        erro:
          "Usuário PAIIA não informado.",
        etapa:
          "usuario",
      });
    }

    const precoVendaNumero =
      numero(precoVenda);

    if (
      !Number.isFinite(
        precoVendaNumero
      ) ||
      precoVendaNumero <= 0
    ) {
      return responder({
        ok: false,
        erro:
          "Preço de referência não informado.",
        etapa:
          "preco",
      });
    }

    const alturaNumero =
      numero(altura);

    const larguraNumero =
      numero(largura);

    const comprimentoNumero =
      numero(comprimento);

    const pesoNumero =
      numero(peso);

    if (
      alturaNumero <= 0 ||
      larguraNumero <= 0 ||
      comprimentoNumero <= 0 ||
      pesoNumero <= 0
    ) {
      return responder({
        ok: false,
        erro:
          "Peso e dimensões da embalagem são obrigatórios.",
        etapa:
          "dimensoes",
      });
    }

    /*
     * ============================================
     * 2. SUPABASE ADMIN
     * ============================================
     */

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL"
      );

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      );

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      return responder({
        ok: false,
        erro:
          "Credenciais internas do Supabase não configuradas.",
        etapa:
          "supabase",
      });
    }

    const supabaseAdmin =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );

    /*
     * ============================================
     * 3. BUSCAR CONTA MERCADO LIVRE
     * ============================================
     */

    const {
      data: contaML,
      error: contaErro,
    } =
      await supabaseAdmin
        .from(
          "contas_marketplace"
        )
        .select("*")
        .eq(
          "usuario_id",
          usuarioId
        )
        .eq(
          "marketplace",
          "mercado_livre"
        )
        .limit(1)
        .maybeSingle();

    if (contaErro) {
      console.error(
        "ERRO CONTAS MARKETPLACE:",
        contaErro
      );

      return responder({
        ok: false,
        erro:
          "Erro ao localizar a conta Mercado Livre.",
        etapa:
          "conta_marketplace",
        detalhe:
          contaErro.message,
      });
    }

    if (!contaML) {
      return responder({
        ok: false,
        erro:
          "Conta Mercado Livre não encontrada para este usuário.",
        etapa:
          "conta_marketplace",
      });
    }

    const accessToken =
      String(
        contaML.access_token ||
        ""
      ).trim();

    if (!accessToken) {
      return responder({
        ok: false,
        erro:
          "A conta Mercado Livre existe, mas não possui access_token.",
        etapa:
          "access_token",
      });
    }

    /*
     * ============================================
     * 4. IDENTIFICAR USUÁRIO ML
     * ============================================
     */

    let userId =
      contaML.ml_user_id ||
      contaML.seller_id ||
      contaML.user_id_ml ||
      null;

    /*
     * Caso o ID do vendedor ainda não
     * esteja salvo, buscamos direto no ML.
     */

    if (!userId) {
      const respostaUsuario =
        await fetch(
          "https://api.mercadolibre.com/users/me",
          {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          }
        );

      const dadosUsuario =
        await respostaUsuario.json();

      if (!respostaUsuario.ok) {
        console.error(
          "ERRO USERS/ME:",
          dadosUsuario
        );

        return responder({
          ok: false,
          erro:
            "Não foi possível identificar o usuário Mercado Livre.",
          etapa:
            "users_me",
          detalhe:
            dadosUsuario,
        });
      }

      userId =
        dadosUsuario?.id ||
        null;

      if (!userId) {
        return responder({
          ok: false,
          erro:
            "O Mercado Livre não retornou o ID do vendedor.",
          etapa:
            "users_me",
        });
      }

      /*
       * Tentamos salvar o ID para
       * evitar nova consulta futuramente.
       */

      try {
        await supabaseAdmin
          .from(
            "contas_marketplace"
          )
          .update({
            ml_user_id:
              String(userId),
          })
          .eq(
            "usuario_id",
            usuarioId
          )
          .eq(
            "marketplace",
            "mercado_livre"
          );
      } catch (erroSalvarId) {
        console.warn(
          "Não foi possível salvar ml_user_id:",
          erroSalvarId
        );
      }
    }

    /*
     * ============================================
     * 5. CUSTO DE VENDA / COMISSÃO
     * ============================================
     */

    const paramsPreco =
      new URLSearchParams();

    paramsPreco.set(
      "price",
      String(
        precoVendaNumero
      )
    );

    paramsPreco.set(
      "currency_id",
      "BRL"
    );

    paramsPreco.set(
      "listing_type_id",
      String(
        listingTypeId
      )
    );

    if (categoriaId) {
      paramsPreco.set(
        "category_id",
        String(categoriaId)
      );
    }

    if (shippingMode) {
      paramsPreco.set(
        "shipping_mode",
        String(shippingMode)
      );
    }

    if (logisticType) {
      paramsPreco.set(
        "logistic_type",
        String(logisticType)
      );
    }

    const urlPreco =
      `https://api.mercadolibre.com/sites/MLB/listing_prices?${paramsPreco.toString()}`;

    console.log(
      "CONSULTANDO LISTING PRICES:",
      urlPreco
    );

    const respostaPreco =
      await fetch(
        urlPreco,
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
        }
      );

    const dadosPreco =
      await respostaPreco.json();

    if (!respostaPreco.ok) {
      console.error(
        "ERRO LISTING PRICES:",
        dadosPreco
      );

      return responder({
        ok: false,
        erro:
          "O Mercado Livre recusou o cálculo das tarifas de venda.",
        etapa:
          "listing_prices",
        statusMercadoLivre:
          respostaPreco.status,
        detalhe:
          dadosPreco,
      });
    }

    const listaPrecos =
      Array.isArray(dadosPreco)
        ? dadosPreco
        : [dadosPreco];

    const tipoEscolhido =
      listaPrecos.find(
        (item: any) =>
          item?.listing_type_id ===
          listingTypeId
      ) ||
      listaPrecos[0] ||
      null;

    const custoVendaML =
      numero(
        tipoEscolhido
          ?.sale_fee_amount
      );

    const detalhesVenda =
      tipoEscolhido
        ?.sale_fee_details ||
      {};

    const taxaFixa =
      numero(
        detalhesVenda
          ?.fixed_fee
      );

    /*
     * ============================================
     * 6. FRETE MERCADO LIVRE
     * ============================================
     */

    /*
     * Peso informado no PAIIA = kg.
     * Mercado Livre espera gramas inteiras.
     */

    const pesoGramas =
      Math.max(
        1,
        Math.round(
          pesoNumero *
          1000
        )
      );

    const dimensions =
      `${Math.round(
        alturaNumero
      )}x${Math.round(
        larguraNumero
      )}x${Math.round(
        comprimentoNumero
      )},${pesoGramas}`;

    const paramsFrete =
      new URLSearchParams();

    paramsFrete.set(
      "dimensions",
      dimensions
    );

    paramsFrete.set(
      "verbose",
      "true"
    );

    paramsFrete.set(
      "item_price",
      String(
        precoVendaNumero
      )
    );

    paramsFrete.set(
      "listing_type_id",
      String(
        listingTypeId
      )
    );

    paramsFrete.set(
      "mode",
      String(
        shippingMode
      )
    );

    paramsFrete.set(
      "condition",
      "new"
    );

    paramsFrete.set(
      "logistic_type",
      String(
        logisticType
      )
    );

    paramsFrete.set(
      "free_shipping",
      freteGratis
        ? "true"
        : "false"
    );

    const urlFrete =
      `https://api.mercadolibre.com/users/${userId}/shipping_options/free?${paramsFrete.toString()}`;

    console.log(
      "CONSULTANDO FRETE ML:",
      {
        userId,
        dimensions,
        precoVendaNumero,
        listingTypeId,
        shippingMode,
        logisticType,
      }
    );

    const respostaFrete =
      await fetch(
        urlFrete,
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
        }
      );

    const dadosFrete =
      await respostaFrete.json();

    if (!respostaFrete.ok) {
      console.error(
        "ERRO FRETE ML:",
        dadosFrete
      );

      return responder({
        ok: false,
        erro:
          "O Mercado Livre não conseguiu calcular o frete.",
        etapa:
          "shipping_options",
        statusMercadoLivre:
          respostaFrete.status,
        detalhe:
          dadosFrete,
      });
    }

    /*
     * ============================================
     * 7. EXTRAIR CUSTO DO FRETE
     * ============================================
     */

    const freteVendedor =
      numero(
        dadosFrete
          ?.coverage
          ?.all_country
          ?.list_cost ??
        dadosFrete
          ?.coverage
          ?.all_country
          ?.billable_cost ??
        dadosFrete
          ?.list_cost ??
        dadosFrete
          ?.cost
      );

    if (
      freteVendedor <= 0
    ) {
      console.warn(
        "RESPOSTA FRETE SEM VALOR:",
        dadosFrete
      );

      return responder({
        ok: false,
        erro:
          "O Mercado Livre respondeu, mas não retornou um custo de frete válido.",
        etapa:
          "frete_sem_valor",
        detalhe:
          dadosFrete,
      });
    }

    /*
     * ============================================
     * 8. RESULTADO
     * ============================================
     */

    const custoMercadoria =
      numero(
        custoProduto
      );

    const custoTotal =
      custoMercadoria +
      custoVendaML +
      freteVendedor;

    const lucro =
      precoVendaNumero -
      custoTotal;

    const margem =
      precoVendaNumero > 0
        ? (
            lucro /
            precoVendaNumero
          ) * 100
        : 0;

    console.log(
      "✅ CUSTOS ML CALCULADOS:",
      {
        userId,
        custoMercadoria,
        custoVendaML,
        freteVendedor,
      }
    );

    return responder({
      ok: true,

      precoVenda:
        precoVendaNumero,

      custoProduto:
        custoMercadoria,

      custoVendaMercadoLivre:
        custoVendaML,

      taxaFixa,

      freteVendedor,

      custoTotal,

      lucro,

      margem,

      userIdMercadoLivre:
        String(userId),

      dimensions,

      listingTypeId:
        tipoEscolhido
          ?.listing_type_id ||
        listingTypeId,

      percentualVenda:
        detalhesVenda
          ?.meli_percentage_fee ??
        detalhesVenda
          ?.percentage_fee ??
        null,

      freteCalculado:
        true,

      detalhesMercadoLivre:
        tipoEscolhido,

      detalhesFrete:
        dadosFrete,
    });
  } catch (erro) {
    console.error(
      "ERRO GERAL CALCULAR CUSTOS ML:",
      erro
    );

    /*
     * Retornamos 200 também aqui para
     * o front conseguir mostrar a
     * mensagem real em data.erro.
     */
    return responder({
      ok: false,
      erro:
        erro instanceof Error
          ? erro.message
          : "Erro inesperado.",
      etapa:
        "erro_geral",
    });
  }
});