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

function extrairVideo(
  output: unknown
): string {
  if (typeof output === "string") {
    return output;
  }

  if (Array.isArray(output)) {
    const primeiro =
      output[0];

    if (
      typeof primeiro === "string"
    ) {
      return primeiro;
    }

    if (
      primeiro &&
      typeof primeiro === "object"
    ) {
      const objeto =
        primeiro as Record<
          string,
          unknown
        >;

      return String(
        objeto.url ||
          objeto.video ||
          objeto.output ||
          ""
      );
    }
  }

  if (
    output &&
    typeof output === "object"
  ) {
    const objeto =
      output as Record<
        string,
        unknown
      >;

    return String(
      objeto.url ||
        objeto.video ||
        objeto.output ||
        ""
    );
  }

  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(
      "ok",
      {
        headers:
          corsHeaders,
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
    const {
      predictionId = "",
    } =
      await req.json();

    const id =
      String(
        predictionId || ""
      ).trim();

    if (!id) {
      return jsonResponse(
        {
          sucesso: false,
          erro:
            "O predictionId é obrigatório.",
        },
        400
      );
    }

    const replicateToken =
      Deno.env.get(
        "REPLICATE_API_TOKEN"
      );

    if (!replicateToken) {
      throw new Error(
        "REPLICATE_API_TOKEN não configurado nos Secrets."
      );
    }

    const resposta =
      await fetch(
        `https://api.replicate.com/v1/predictions/${encodeURIComponent(id)}`,
        {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${replicateToken}`,
            "Content-Type":
              "application/json",
          },
        }
      );

    let prediction:
      Record<string, any>;

    try {
      prediction =
        await resposta.json();
    } catch {
      throw new Error(
        "O Replicate não retornou uma resposta válida."
      );
    }

    if (!resposta.ok) {
      const detalhe =
        prediction?.detail ||
        prediction?.error ||
        prediction?.message ||
        "";

      throw new Error(
        String(detalhe) ||
          "Não foi possível consultar o Lip Sync."
      );
    }

    const status =
      String(
        prediction?.status || ""
      );

    console.log(
      "STATUS LIP SYNC:",
      status
    );

    if (
      status === "failed" ||
      status === "canceled"
    ) {
      return jsonResponse(
        {
          sucesso: false,
          concluido: false,
          status,
          erro:
            prediction?.error ||
            "A sincronização de voz falhou no Replicate.",
        },
        400
      );
    }

    if (
      status !== "succeeded"
    ) {
      return jsonResponse({
        sucesso:
          true,
        concluido:
          false,
        status:
          status || "processing",
        prediction_id:
          prediction?.id || id,
      });
    }

    const videoFinal =
      extrairVideo(
        prediction?.output
      );

    if (!videoFinal) {
      throw new Error(
        "O Lip Sync terminou, mas não retornou a URL do vídeo final."
      );
    }

    return jsonResponse({
      sucesso:
        true,
      concluido:
        true,
      status:
        "succeeded",
      prediction_id:
        prediction?.id || id,
      video_url:
        videoFinal,
      video:
        videoFinal,
    });
  } catch (error) {
    console.error(
      "ERRO CONSULTAR LIPSYNC PAIZINHO:",
      error
    );

    return jsonResponse(
      {
        sucesso:
          false,
        concluido:
          false,
        erro:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao consultar o Lip Sync.",
      },
      400
    );
  }
});