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
    const {
      code,
      user_id,
    } = await req.json();

    if (!code || !user_id) {
      return responder({
        ok: false,
        erro:
          "code e user_id são obrigatórios",
      });
    }

    const clientId =
      Deno.env.get(
        "ML_CLIENT_ID"
      );

    const clientSecret =
      Deno.env.get(
        "ML_CLIENT_SECRET"
      );

    const redirectUri =
      Deno.env.get(
        "ML_REDIRECT_URI"
      );

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL"
      );

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      );

    if (
      !clientId ||
      !clientSecret ||
      !redirectUri
    ) {
      return responder({
        ok: false,
        erro:
          "Credenciais do Mercado Livre não configuradas.",
      });
    }

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      return responder({
        ok: false,
        erro:
          "Credenciais internas do Supabase não configuradas.",
      });
    }

    /*
     * ============================================
     * 1. TROCAR CODE POR TOKEN
     * ============================================
     */

    const tokenResponse =
      await fetch(
        "https://api.mercadolibre.com/oauth/token",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
            Accept:
              "application/json",
          },
          body:
            new URLSearchParams({
              grant_type:
                "authorization_code",
              client_id:
                clientId,
              client_secret:
                clientSecret,
              code,
              redirect_uri:
                redirectUri,
            }),
        }
      );

    const tokenData =
      await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error(
        "ERRO TOKEN ML:",
        tokenData
      );

      return responder({
        ok: false,
        erro:
          "Mercado Livre não autorizou a conexão.",
        detalhe:
          tokenData,
      });
    }

    const accessToken =
      tokenData
        ?.access_token;

    const refreshToken =
      tokenData
        ?.refresh_token;

    const expiresIn =
      Number(
        tokenData
          ?.expires_in || 0
      );

    if (!accessToken) {
      return responder({
        ok: false,
        erro:
          "Mercado Livre não retornou access_token.",
      });
    }

    /*
     * ============================================
     * 2. BUSCAR USUÁRIO MERCADO LIVRE
     * ============================================
     */

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

    const usuarioML =
      await respostaUsuario.json();

    if (!respostaUsuario.ok) {
      console.error(
        "ERRO USERS/ME:",
        usuarioML
      );

      return responder({
        ok: false,
        erro:
          "Não foi possível identificar a conta Mercado Livre.",
        detalhe:
          usuarioML,
      });
    }

    const mlUserId =
      usuarioML?.id;

    if (!mlUserId) {
      return responder({
        ok: false,
        erro:
          "Mercado Livre não retornou o ID da conta.",
      });
    }

    /*
     * ============================================
     * 3. CALCULAR EXPIRAÇÃO
     * ============================================
     */

    const expiresAt =
      expiresIn > 0
        ? new Date(
            Date.now() +
            expiresIn * 1000
          ).toISOString()
        : null;

    /*
     * ============================================
     * 4. SALVAR CONTA NO SUPABASE
     * ============================================
     */

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
     * Primeiro verificamos se já existe.
     */

    const {
      data: contaExistente,
      error:
        erroBuscaConta,
    } =
      await supabaseAdmin
        .from(
          "contas_marketplace"
        )
        .select("id")
        .eq(
          "usuario_id",
          user_id
        )
        .eq(
          "marketplace",
          "mercado_livre"
        )
        .maybeSingle();

    if (erroBuscaConta) {
      console.error(
        "ERRO BUSCAR CONTA:",
        erroBuscaConta
      );

      return responder({
        ok: false,
        erro:
          "Erro ao verificar conexão existente.",
        detalhe:
          erroBuscaConta.message,
      });
    }

    const dadosConta = {
      usuario_id:
        user_id,

      marketplace:
        "mercado_livre",

      ml_user_id:
        String(mlUserId),

      access_token:
        accessToken,

      refresh_token:
        refreshToken || null,

      expires_at:
        expiresAt,
    };

    let erroSalvar = null;

    if (
      contaExistente?.id
    ) {
      const {
        error,
      } =
        await supabaseAdmin
          .from(
            "contas_marketplace"
          )
          .update(
            dadosConta
          )
          .eq(
            "id",
            contaExistente.id
          );

      erroSalvar =
        error;
    } else {
      const {
        error,
      } =
        await supabaseAdmin
          .from(
            "contas_marketplace"
          )
          .insert(
            dadosConta
          );

      erroSalvar =
        error;
    }

    if (erroSalvar) {
      console.error(
        "ERRO SALVAR CONTA ML:",
        erroSalvar
      );

      return responder({
        ok: false,
        erro:
          "A conta foi autorizada, mas não foi salva no PAIIA.",
        detalhe:
          erroSalvar.message,
      });
    }

    /*
     * ============================================
     * 5. RESULTADO
     * ============================================
     */

    return responder({
      ok: true,

      conectado:
        true,

      marketplace:
        "mercado_livre",

      ml_user_id:
        String(mlUserId),

      nickname:
        usuarioML
          ?.nickname ||
        "",

      expires_at:
        expiresAt,
    });
  } catch (error) {
    console.error(
      "ERRO OAUTH ML:",
      error
    );

    return responder({
      ok: false,
      erro:
        error instanceof Error
          ? error.message
          : "Erro inesperado.",
    });
  }
});