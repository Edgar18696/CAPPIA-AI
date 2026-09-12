import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  createClient,
} from "https://esm.sh/@supabase/supabase-js@2";

function montarCors(req: Request) {
  const origin =
    req.headers.get("Origin") ||
    "*";

  const requested =
    req.headers.get(
      "Access-Control-Request-Headers"
    );

  const allowHeaders =
    requested ||
    "authorization, x-client-info, apikey, content-type, x-region, x-supabase-api-version";

  return {
    "Access-Control-Allow-Origin":
      origin,
    "Access-Control-Allow-Headers":
      allowHeaders,
    "Access-Control-Allow-Methods":
      "POST, OPTIONS",
    "Access-Control-Allow-Credentials":
      "true",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(
  req: Request,
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...montarCors(req),
        "Content-Type":
          "application/json; charset=utf-8",
      },
    }
  );
}

function mensagemPublica(
  texto: unknown,
  saldoInsuficiente = false
) {
  if (saldoInsuficiente) {
    return "Você não possui créditos PAIIA suficientes para gerar.";
  }

  const bruto = String(
    texto || ""
  ).toLowerCase();

  if (
    bruto.includes("429") ||
    bruto.includes("prepayment") ||
    bruto.includes("insufficient credit") ||
    bruto.includes("resource_exhausted") ||
    bruto.includes("depleted")
  ) {
    return "A geração está temporariamente indisponível. Nenhum crédito PAIIA foi usado.";
  }

  if (
    bruto.includes("timeout") ||
    bruto.includes("tempo esgotado") ||
    bruto.includes("timed out")
  ) {
    return "A geração demorou mais que o esperado. Nenhum crédito PAIIA foi usado.";
  }

  return "Não foi possível concluir o Clip de Produto. Nenhum crédito PAIIA foi usado.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: montarCors(req),
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(req,
      {
        sucesso: false,
        erro: "Método não permitido.",
      },
      405
    );
  }

  const supabaseUrl =
    Deno.env.get("SUPABASE_URL") ||
    "";

  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY") ||
    Deno.env.get("ANON_KEY") ||
    "";

  const serviceRoleKey =
    Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    ) ||
    Deno.env.get("SERVICE_ROLE_KEY") ||
    "";

  const authorization =
    req.headers.get("Authorization") ||
    req.headers.get("authorization") ||
    "";

  if (!supabaseUrl || !anonKey) {
    return jsonResponse(req,
      {
        sucesso: false,
        erro: "Serviço PAIIA indisponível no momento.",
      },
      500
    );
  }

  if (!authorization) {
    return jsonResponse(req,
      {
        sucesso: false,
        erro: "Faça login para gerar o Clip de Produto.",
      },
      401
    );
  }

  const usuarioClient = createClient(
    supabaseUrl,
    anonKey,
    {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  try {
    const {
      data: dadosAuth,
      error: erroAuth,
    } = await usuarioClient.auth.getUser();

    const usuarioId =
      dadosAuth?.user?.id;

    if (erroAuth || !usuarioId) {
      return jsonResponse(req,
        {
          sucesso: false,
          erro: "Faça login para gerar o Clip de Produto.",
        },
        401
      );
    }

    let body: Record<string, unknown> =
      {};

    try {
      body = await req.json();
    } catch {
      body = {};
    }

    if (body?.verificarConexao === true) {
      return jsonResponse(req, {
        sucesso: true,
        conexao: true,
        mensagem: "ok",
      });
    }

    const {
      data: saldoAtual,
      error: erroSaldo,
    } = await usuarioClient.rpc(
      "consultar_creditos_appia"
    );

    if (erroSaldo) {
      return jsonResponse(req,
        {
          sucesso: false,
          erro: "Não foi possível consultar seus créditos PAIIA.",
        },
        400
      );
    }

    if (Number(saldoAtual || 0) < 1) {
      return jsonResponse(req,
        {
          sucesso: false,
          erro: mensagemPublica(
            "",
            true
          ),
        },
        400
      );
    }

    const imageUrl = String(
      body?.imageUrl ||
        body?.imagemUrl ||
        ""
    ).trim();

    if (!imageUrl) {
      return jsonResponse(req,
        {
          sucesso: false,
          erro: "Selecione uma foto para gerar o Clip de Produto.",
        },
        400
      );
    }

    const chaveServico =
      serviceRoleKey || anonKey;

    const respostaGeracao =
      await fetch(
        `${supabaseUrl}/functions/v1/processar-clip`,
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${chaveServico}`,
            apikey: chaveServico,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            imageUrl,
            estilo:
              body?.estilo ||
              "marketplace",
            duracao:
              body?.duracao || 10,
            instrucoes:
              body?.instrucoes || "",
            descricao:
              body?.descricao || "",
            categoria:
              body?.categoria || "",
            familia:
              body?.familia || "",
            tipo: "clip_profissional",
            modoPaizinho: false,
            fala: "",
            movimentoProdutoVisual:
              body?.movimentoProdutoVisual ||
              "",
          }),
        }
      );

    let geracao: Record<
      string,
      unknown
    > = {};

    try {
      geracao =
        await respostaGeracao.json();
    } catch {
      return jsonResponse(req,
        {
          sucesso: false,
          erro: mensagemPublica(
            "timeout"
          ),
        },
        502
      );
    }

    const urlClip = String(
      geracao?.video_processado ||
        geracao?.video_url ||
        geracao?.video ||
        ""
    ).trim();

    if (
      !respostaGeracao.ok ||
      geracao?.sucesso === false ||
      !urlClip
    ) {
      return jsonResponse(req,
        {
          sucesso: false,
          erro: mensagemPublica(
            geracao?.erro ||
              geracao?.error ||
              respostaGeracao.status
          ),
        },
        502
      );
    }

    const {
      data: existentes,
      error: erroBusca,
    } = await usuarioClient
      .from("processamentos")
      .select("id, imagem_processada, tipo")
      .eq("user_id", usuarioId)
      .eq("imagem_processada", urlClip)
      .limit(1);

    if (erroBusca) {
      return jsonResponse(req,
        {
          sucesso: false,
          erro: mensagemPublica(
            "falha ao salvar"
          ),
        },
        500
      );
    }

    if (
      !Array.isArray(existentes) ||
      existentes.length === 0
    ) {
      const {
        error: erroInsert,
      } = await usuarioClient
        .from("processamentos")
        .insert([
          {
            user_id: usuarioId,
            imagem_original:
              imageUrl,
            imagem_processada:
              urlClip,
            status: "finalizado",
            tipo: "clip",
            modelo_banner:
              String(
                body?.estilo ||
                  "marketplace"
              ),
          },
        ]);

      if (erroInsert) {
        return jsonResponse(req,
          {
            sucesso: false,
            erro: mensagemPublica(
              "falha ao salvar"
            ),
          },
          500
        );
      }
    } else {
      return jsonResponse(req,{
        sucesso: true,
        video: urlClip,
        video_url: urlClip,
        saldo: Math.max(
          0,
          Number(saldoAtual || 0)
        ),
        mensagem:
          "Clip de Produto gerado com sucesso.",
      });
    }

    const {
      data: novoSaldo,
      error: erroDebito,
    } = await usuarioClient.rpc(
      "debitar_credito_clip"
    );

    if (erroDebito) {
      const mensagem = String(
        erroDebito.message || ""
      ).toUpperCase();

      if (
        mensagem.includes(
          "CREDITOS_INSUFICIENTES"
        )
      ) {
        return jsonResponse(req,
          {
            sucesso: false,
            erro: mensagemPublica(
              "",
              true
            ),
          },
          400
        );
      }

      return jsonResponse(req,
        {
          sucesso: false,
          erro: "O vídeo foi gerado, mas não foi possível registrar o crédito PAIIA.",
        },
        500
      );
    }

    return jsonResponse(req,{
      sucesso: true,
      video: urlClip,
      video_url: urlClip,
      saldo: Math.max(
        0,
        Number(novoSaldo || 0)
      ),
      mensagem:
        "Clip de Produto gerado com sucesso.",
    });
  } catch (erro) {
    console.error(
      "ERRO GERAR CLIP PRODUTO:",
      erro
    );

    return jsonResponse(req,
      {
        sucesso: false,
        erro: mensagemPublica(erro),
      },
      500
    );
  }
});
