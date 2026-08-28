/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

const HEDRA_BASE =
  "https://api.hedra.com/web-app/public";

const HEDRA_AVATAR_MODEL =
  "26f0fc66-152b-40ab-abed-76c43df99bc8";

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(
    JSON.stringify(body, null, 2),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}

function textoErro(valor: unknown) {
  if (typeof valor === "string") {
    return valor;
  }

  try {
    return JSON.stringify(
      valor,
      null,
      2
    );
  } catch {
    return String(valor);
  }
}

function urlValida(valor = "") {
  try {
    const url = new URL(valor);

    return (
      url.protocol === "https:" ||
      url.protocol === "http:"
    );
  } catch {
    return false;
  }
}

async function lerResposta(
  resposta: Response
) {
  const texto =
    await resposta.text();

  if (!texto) {
    return {};
  }

  try {
    return JSON.parse(texto);
  } catch {
    return {
      raw: texto,
    };
  }
}

async function baixarArquivo(
  url: string,
  tipoPadrao: string
) {
  console.log(
    "⬇️ Baixando arquivo:",
    url
  );

  const resposta =
    await fetch(url);

  if (!resposta.ok) {
    throw new Error(
      `Não foi possível baixar o arquivo. HTTP ${resposta.status}.`
    );
  }

  const blob =
    await resposta.blob();

  if (!blob.size) {
    throw new Error(
      "O arquivo baixado está vazio."
    );
  }

  return new Blob(
    [await blob.arrayBuffer()],
    {
      type:
        blob.type ||
        tipoPadrao,
    }
  );
}

async function criarAssetHedra({
  apiKey,
  nome,
  tipo,
}: {
  apiKey: string;
  nome: string;
  tipo: "image" | "audio";
}) {
  console.log(
    `📦 Criando asset Hedra: ${tipo}`
  );

  const resposta =
    await fetch(
      `${HEDRA_BASE}/assets`,
      {
        method: "POST",

        headers: {
          "X-API-Key":
            apiKey,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            name: nome,
            type: tipo,
          }),
      }
    );

  const resultado =
    await lerResposta(
      resposta
    );

  if (!resposta.ok) {
    console.error(
      "❌ Erro criando asset:",
      resultado
    );

    throw new Error(
      `Erro criando asset ${tipo}: ${textoErro(resultado)}`
    );
  }

  const id =
    String(
      resultado?.id || ""
    ).trim();

  if (!id) {
    throw new Error(
      `A Hedra não retornou o ID do asset ${tipo}.`
    );
  }

  console.log(
    `✅ Asset ${tipo} criado:`,
    id
  );

  return id;
}

async function uploadAssetHedra({
  apiKey,
  assetId,
  arquivo,
  nomeArquivo,
}: {
  apiKey: string;
  assetId: string;
  arquivo: Blob;
  nomeArquivo: string;
}) {
  console.log(
    "⬆️ Enviando arquivo para asset:",
    assetId
  );

  const formData =
    new FormData();

  formData.append(
    "file",
    arquivo,
    nomeArquivo
  );

  const resposta =
    await fetch(
      `${HEDRA_BASE}/assets/${assetId}/upload`,
      {
        method: "POST",

        headers: {
          "X-API-Key":
            apiKey,
        },

        body:
          formData,
      }
    );

  const resultado =
    await lerResposta(
      resposta
    );

  if (!resposta.ok) {
    console.error(
      "❌ Erro upload Hedra:",
      resultado
    );

    throw new Error(
      `Erro fazendo upload para Hedra: ${textoErro(resultado)}`
    );
  }

  console.log(
    "✅ Upload concluído:",
    assetId
  );

  return resultado;
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
    const body =
      await req.json();

    const imageUrl =
      String(
        body?.imageUrl || ""
      ).trim();

    const audioUrl =
      String(
        body?.audioUrl || ""
      ).trim();

    const prompt =
      String(
        body?.prompt ||
          "Friendly commercial presenter speaking directly to camera. Natural facial expressions, subtle body movement, accurate lip synchronization."
      ).trim();

    const aspectRatio =
      String(
        body?.aspectRatio ||
          "9:16"
      );

    const resolution =
      String(
        body?.resolution ||
          "720p"
      );

    if (!imageUrl) {
      return jsonResponse(
        {
          sucesso: false,
          erro:
            "imageUrl é obrigatória.",
        },
        400
      );
    }

    if (!audioUrl) {
      return jsonResponse(
        {
          sucesso: false,
          erro:
            "audioUrl é obrigatória.",
        },
        400
      );
    }

    if (
      !urlValida(imageUrl) ||
      !urlValida(audioUrl)
    ) {
      return jsonResponse(
        {
          sucesso: false,
          erro:
            "imageUrl ou audioUrl inválida.",
        },
        400
      );
    }

    const hedraApiKey =
      Deno.env.get(
        "HEDRA_API_KEY"
      );

    if (!hedraApiKey) {
      throw new Error(
        "HEDRA_API_KEY não configurada."
      );
    }

    /*
     * ==========================================
     * 1. BAIXAR IMAGEM DO SUPABASE
     * ==========================================
     */

    const imagem =
      await baixarArquivo(
        imageUrl,
        "image/png"
      );

    /*
     * ==========================================
     * 2. CRIAR ASSET DA IMAGEM
     * ==========================================
     */

    const imageAssetId =
      await criarAssetHedra({
        apiKey:
          hedraApiKey,

        nome:
          `paizinho-${Date.now()}.png`,

        tipo:
          "image",
      });

    /*
     * ==========================================
     * 3. UPLOAD DA IMAGEM
     * ==========================================
     */

    await uploadAssetHedra({
      apiKey:
        hedraApiKey,

      assetId:
        imageAssetId,

      arquivo:
        imagem,

      nomeArquivo:
        "paizinho.png",
    });

    /*
     * ==========================================
     * 4. BAIXAR ÁUDIO DO SUPABASE
     * ==========================================
     */

    const audio =
      await baixarArquivo(
        audioUrl,
        "audio/wav"
      );

    /*
     * ==========================================
     * 5. CRIAR ASSET DO ÁUDIO
     * ==========================================
     */

    const audioAssetId =
      await criarAssetHedra({
        apiKey:
          hedraApiKey,

        nome:
          `voz-paizinho-${Date.now()}.wav`,

        tipo:
          "audio",
      });

    /*
     * ==========================================
     * 6. UPLOAD DO ÁUDIO
     * ==========================================
     */

    await uploadAssetHedra({
      apiKey:
        hedraApiKey,

      assetId:
        audioAssetId,

      arquivo:
        audio,

      nomeArquivo:
        "voz-paizinho.wav",
    });

    /*
     * ==========================================
     * 7. GERAR AVATAR
     * ==========================================
     */

    const payload = {
      type:
        "video",

      ai_model_id:
        HEDRA_AVATAR_MODEL,

      start_keyframe_id:
        imageAssetId,

      audio_id:
        audioAssetId,

      generated_video_inputs: {
        text_prompt:
          prompt,

        aspect_ratio:
          aspectRatio,

        resolution:
          resolution,
      },
    };

    console.log(
      "🎬 PAYLOAD GERAÇÃO:",
      JSON.stringify(
        payload,
        null,
        2
      )
    );

    const resposta =
      await fetch(
        `${HEDRA_BASE}/generations`,
        {
          method: "POST",

          headers: {
            "X-API-Key":
              hedraApiKey,

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(
              payload
            ),
        }
      );

    const resultado =
      await lerResposta(
        resposta
      );

    console.log(
      "📨 HTTP HEDRA:",
      resposta.status
    );

    console.log(
      "📨 RESPOSTA:",
      resultado
    );

    if (!resposta.ok) {
      return jsonResponse(
        {
          sucesso: false,

          etapa:
            "gerar_video",

          status_hedra:
            resposta.status,

          image_asset_id:
            imageAssetId,

          audio_asset_id:
            audioAssetId,

          erro:
            textoErro(
              resultado
            ),

          hedra:
            resultado,
        },
        resposta.status
      );
    }

    const generationId =
      String(
        resultado?.id ||
        resultado?.generation_id ||
        ""
      ).trim();

    console.log(
      "🎉 GERAÇÃO CRIADA:",
      generationId
    );

    return jsonResponse({
      sucesso:
        true,

      concluido:
        false,

      generation_id:
        generationId,

      job_id:
        generationId,

      image_asset_id:
        imageAssetId,

      audio_asset_id:
        audioAssetId,

      status:
        resultado?.status ||
        "pending",

      hedra:
        resultado,
    });
  } catch (error) {
    console.error(
      "❌ ERRO GERAR VIDEO HEDRA:",
      error
    );

    return jsonResponse(
      {
        sucesso:
          false,

        erro:
          error instanceof Error
            ? error.message
            : textoErro(
                error
              ),
      },
      400
    );
  }
});