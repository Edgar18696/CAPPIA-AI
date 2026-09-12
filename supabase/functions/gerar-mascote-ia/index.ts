import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CUSTO_CREDITOS = 10;
const ENDPOINT_PREDICTION = "https://api.replicate.com/v1/predictions";
const ENDPOINT_FLUX =
  "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function imagemUtilizavel(url: string) {
  return /^https?:\/\//i.test(url) || /^data:image\//i.test(url);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mensagemFalha(texto: unknown) {
  const bruto = String(texto || "").toLowerCase();
  if (
    bruto.includes("insufficient credit") ||
    bruto.includes("prepayment") ||
    bruto.includes("429")
  ) {
    return "A geração está temporariamente indisponível. Nenhum crédito PAIIA foi usado.";
  }
  if (bruto.includes("timeout") || bruto.includes("timed out")) {
    return "A geração demorou mais que o esperado. Nenhum crédito PAIIA foi usado.";
  }
  return String(texto || "Não foi possível gerar o mascote. Nenhum crédito PAIIA foi usado.");
}

function extrairImagem(output: unknown): string {
  let imagemFinal = output;
  if (Array.isArray(imagemFinal)) {
    imagemFinal = imagemFinal[0];
  }
  if (typeof imagemFinal === "object" && imagemFinal !== null) {
    const obj = imagemFinal as Record<string, unknown>;
    imagemFinal = obj.url || obj.image || obj.output || "";
  }
  return String(imagemFinal || "").trim();
}

async function aguardarPrediction(
  getUrl: string,
  replicateToken: string
) {
  let prediction: Record<string, unknown> = {};

  for (let i = 0; i < 45; i += 1) {
    await sleep(2000);
    const buscar = await fetch(getUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${replicateToken}`,
        "Content-Type": "application/json",
      },
    });
    prediction = await buscar.json();
    const status = String(prediction?.status || "");
    if (status === "succeeded") {
      return prediction;
    }
    if (status === "failed" || status === "canceled") {
      throw new Error(
        String(prediction?.error || "A geração falhou no Replicate.")
      );
    }
  }

  throw new Error("A geração demorou mais que o esperado.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ sucesso: false, erro: "Método não permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("ANON_KEY") || "";
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SERVICE_ROLE_KEY") ||
    "";
  const replicateToken = Deno.env.get("REPLICATE_API_TOKEN") || "";
  const authorization =
    req.headers.get("Authorization") ||
    req.headers.get("authorization") ||
    "";

  if (!supabaseUrl || !anonKey) {
    return json(
      { sucesso: false, erro: "Serviço de criação de mascote indisponível." },
      500
    );
  }

  if (!authorization) {
    return json(
      { sucesso: false, erro: "Faça login para criar o mascote." },
      401
    );
  }

  const usuarioClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: { Authorization: authorization },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    const { data: dadosAuth, error: erroAuth } =
      await usuarioClient.auth.getUser();

    if (erroAuth || !dadosAuth?.user?.id) {
      return json(
        { sucesso: false, erro: "Faça login para criar o mascote." },
        401
      );
    }

    const usuarioId = dadosAuth.user.id;

    const { data: saldoAtual, error: erroSaldo } = await usuarioClient.rpc(
      "consultar_creditos_appia"
    );

    if (erroSaldo) {
      return json(
        {
          sucesso: false,
          erro: "Não foi possível consultar seus créditos PAIIA.",
        },
        400
      );
    }

    if (Number(saldoAtual || 0) < CUSTO_CREDITOS) {
      return json(
        {
          sucesso: false,
          erro: "Você não possui créditos PAIIA suficientes para gerar.",
          saldoInsuficiente: true,
        },
        400
      );
    }

    if (!replicateToken) {
      return json(
        {
          sucesso: false,
          erro: "A geração está temporariamente indisponível. Nenhum crédito PAIIA foi usado.",
        },
        500
      );
    }

    const body = await req.json();
    const promptFinal = String(
      body?.prompt || body?.descricao || ""
    ).trim();
    const logoUrl = String(body?.logoUrl || "").trim();
    const fotoReferenciaUrl = String(body?.fotoReferenciaUrl || "").trim();
    const cenaNome = String(body?.cenaNome || "").trim();

    if (!promptFinal) {
      return json(
        {
          sucesso: false,
          erro: "O Paizinho precisa de um prompt para gerar o mascote.",
        },
        400
      );
    }

    const imagemReferencia = imagemUtilizavel(fotoReferenciaUrl)
      ? fotoReferenciaUrl
      : imagemUtilizavel(logoUrl)
        ? logoUrl
        : "";

    const promptReplicate = [
      promptFinal,
      "Generate ONE square 1:1 advertising image of a single brand mascot.",
      cenaNome ? `Scene: ${cenaNome}.` : "",
      "No extra characters, no watermark, no unreadable text.",
    ]
      .filter(Boolean)
      .join(" ");

    const endpoint = imagemReferencia
      ? ENDPOINT_PREDICTION
      : ENDPOINT_FLUX;
    const corpo = imagemReferencia
      ? {
          version: "black-forest-labs/flux-kontext-pro",
          input: {
            prompt: promptReplicate,
            input_image: imagemReferencia,
            aspect_ratio: "1:1",
            output_format: "png",
          },
        }
      : {
          input: {
            prompt: promptReplicate,
            aspect_ratio: "1:1",
            output_format: "png",
          },
        };

    const criarResposta = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${replicateToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(corpo),
    });

    const predictionCriada = await criarResposta.json();

    if (!criarResposta.ok) {
      return json(
        {
          sucesso: false,
          erro: mensagemFalha(
            predictionCriada?.detail || predictionCriada?.error
          ),
        },
        502
      );
    }

    const getUrl = String(predictionCriada?.urls?.get || "");
    if (!getUrl) {
      return json(
        {
          sucesso: false,
          erro: "O Replicate não retornou a URL de acompanhamento. Nenhum crédito PAIIA foi usado.",
        },
        502
      );
    }

    const prediction = await aguardarPrediction(getUrl, replicateToken);
    const imagemReplicate = extrairImagem(prediction?.output);

    if (!imagemReplicate) {
      return json(
        {
          sucesso: false,
          erro: "O Replicate concluiu, mas não retornou a imagem. Nenhum crédito PAIIA foi usado.",
        },
        502
      );
    }

    let imagemFinal = imagemReplicate;

    if (serviceRoleKey) {
      const baixar = await fetch(imagemReplicate);
      if (baixar.ok) {
        const blob = await baixar.blob();
        const caminho = `${usuarioId}/marketing/mascotes/gerado-${Date.now()}.png`;
        const upload = await fetch(
          `${supabaseUrl}/storage/v1/object/imagens/${caminho}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceRoleKey}`,
              apikey: serviceRoleKey,
              "Content-Type": "image/png",
              "x-upsert": "true",
            },
            body: blob,
          }
        );
        if (upload.ok) {
          imagemFinal = `${supabaseUrl}/storage/v1/object/public/imagens/${caminho}`;
        }
      }
    }

    let novoSaldo = Number(saldoAtual || 0);
    for (let i = 0; i < CUSTO_CREDITOS; i += 1) {
      const { data: saldoDebitado, error: erroDebito } =
        await usuarioClient.rpc("debitar_credito_clip");
      if (erroDebito) {
        break;
      }
      novoSaldo = Math.max(0, Number(saldoDebitado ?? novoSaldo - 1));
    }

    return json({
      sucesso: true,
      imagem: imagemFinal,
      opcoes: [imagemFinal],
      prompt_base: promptFinal,
      saldo: novoSaldo,
    });
  } catch (erro) {
    return json(
      {
        sucesso: false,
        erro: mensagemFalha(
          erro instanceof Error ? erro.message : "Erro inesperado ao criar o mascote."
        ),
      },
      500
    );
  }
});
