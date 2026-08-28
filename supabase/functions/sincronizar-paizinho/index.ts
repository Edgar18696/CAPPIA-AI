/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

const REPLICATE_LIPSYNC_URL =
  "https://api.replicate.com/v1/models/kwaivgi/kling-lip-sync/predictions";

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
      videoUrl = "",
      audioUrl = "",
    } =
      await req.json();

    const video =
      String(
        videoUrl || ""
      ).trim();

    const audio =
      String(
        audioUrl || ""
      ).trim();

    if (!video) {
      return jsonResponse(
        {
          sucesso: false,
          erro:
            "A URL do vídeo é obrigatória.",
        },
        400
      );
    }

    if (!audio) {
      return jsonResponse(
        {
          sucesso: false,
          erro:
            "A URL do áudio é obrigatória.",
        },
        400
      );
    }

    try {
      new URL(video);
      new URL(audio);
    } catch {
      return jsonResponse(
        {
          sucesso: false,
          erro:
            "A URL do vídeo ou do áudio é inválida.",
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

    console.log(
      "🗣️ Iniciando Lip Sync do Paizinho..."
    );

    const resposta =
      await fetch(
        REPLICATE_LIPSYNC_URL,
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${replicateToken}`,
            "Content-Type":
              "application/json",
            "Prefer":
              "respond-async",
            "Cancel-After":
              "10m",
          },
          body:
            JSON.stringify({
              input: {
                video_url:
                  video,
                audio_file:
                  audio,
              },
            }),
        }
      );

    let prediction:
      Record<string, any>;

    try {
      prediction =
        await resposta.json();
    } catch {
      throw new Error(
        "O Replicate não retornou uma resposta válida para iniciar o Lip Sync."
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
          "Não foi possível iniciar o Lip Sync."
      );
    }

    const predictionId =
      String(
        prediction?.id || ""
      ).trim();

    if (!predictionId) {
      throw new Error(
        "O Replicate não retornou o predictionId do Lip Sync."
      );
    }

    console.log(
      "✅ Lip Sync iniciado:",
      predictionId
    );

    return jsonResponse({
      sucesso:
        true,
      concluido:
        false,
      status:
        prediction?.status ||
        "starting",
      prediction_id:
        predictionId,
    });
  } catch (error) {
    console.error(
      "ERRO INICIAR LIPSYNC PAIZINHO:",
      error
    );

    return jsonResponse(
      {
        sucesso:
          false,
        erro:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao iniciar o Lip Sync.",
      },
      400
    );
  }
})