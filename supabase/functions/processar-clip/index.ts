/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import motorDiretorIA from "./motorDiretorIA.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

const REPLICATE_MODEL_URL =
  "https://api.replicate.com/v1/models/kwaivgi/kling-v2.1/predictions";

const sleep = (ms: number) =>
  new Promise((resolve) =>
    setTimeout(resolve, ms)
  );

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

function normalizarDuracao(
  valor: unknown
) {
  const duracao = Number(valor);

  // Kling v2.1 aceita somente 5 ou 10 segundos.
  return duracao <= 5 ? 5 : 10;
}

const PROMPT_CLIP_PRODUTO_360 = [
  "Image-to-video of the exact automotive part shown in the start image.",
  "Camera 100% locked: identical distance, framing and scale from the first frame to the last frame.",
  "The product stays 100% centered and fully visible in every frame.",
  "The only allowed visual transformation is the product rotating around its own central axis, like a studio turntable.",
  "Do not change geometry, cable, connector, tip, proportions, color or original details.",
  "Do not add new parts or elements.",
].join(" ");

const NEGATIVE_CLIP_PRODUTO_360 = [
  "deformed product",
  "distorted geometry",
  "changed proportions",
  "changed colors",
  "changed materials",
  "extra components",
  "missing components",
  "invented components",
  "wrong connectors",
  "wrong pins",
  "wrong holes",
  "wrong screws",
  "changed engravings",
  "changed labels",
  "invented hidden side",
  "cropped product",
  "cut off product",
  "text",
  "logo",
  "watermark",
  "frame",
  "hands",
  "people",
  "tools",
  "vehicle",
  "packaging",
  "extra objects",
  "cartoon",
  "illustration",
  "CGI",
  "3D render",
  "flicker",
  "camera shake",
  "heavy motion blur",
  "low quality",
  "zoom",
  "dolly",
  "dolly in",
  "dolly out",
  "push-in",
  "push-out",
  "tracking",
  "camera movement",
  "pan",
  "tilt",
  "camera orbit",
  "camera rotation",
  "reframing",
].join(", ");

function montarDiretorClipProduto360(
  instrucoes: unknown,
  duracao: unknown
) {
  return {
    prompt: [
      PROMPT_CLIP_PRODUTO_360,
      String(instrucoes || "").trim(),
    ]
      .filter(Boolean)
      .join(" "),
    negativePrompt: NEGATIVE_CLIP_PRODUTO_360,
    duracao: normalizarDuracao(duracao),
    familia: "clip_produto_360",
    estilo: "360",
    movimentos: ["rotacao no eixo da peca"],
    focoDetalhes: ["camera fixa", "plataforma giratoria"],
  };
}

function extrairVideo(
  output: unknown
): string {
  if (typeof output === "string") {
    return output;
  }

  if (Array.isArray(output)) {
    const primeiro = output[0];

    if (typeof primeiro === "string") {
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
      output as Record<string, unknown>;

    return String(
      objeto.url ||
        objeto.video ||
        objeto.output ||
        ""
    );
  }

  return "";
}

async function salvarVideoNoStorage({
  videoUrl,
  supabaseUrl,
  serviceRoleKey,
  estilo,
}: {
  videoUrl: string;
  supabaseUrl: string;
  serviceRoleKey: string;
  estilo: string;
}) {
  const respostaVideo =
    await fetch(videoUrl);

  if (!respostaVideo.ok) {
    throw new Error(
      "Não foi possível baixar o vídeo gerado."
    );
  }

  const videoBlob =
    await respostaVideo.blob();

  if (videoBlob.size === 0) {
    throw new Error(
      "O vídeo gerado está vazio."
    );
  }

  const nomeArquivo =
    `clips/${Date.now()}-${estilo}-${crypto.randomUUID()}.mp4`;

  const uploadResposta =
    await fetch(
      `${supabaseUrl}/storage/v1/object/imagens/${nomeArquivo}`,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${serviceRoleKey}`,

          apikey: serviceRoleKey,

          "Content-Type":
            "video/mp4",

          "x-upsert": "true",
        },

        body: videoBlob,
      }
    );

  if (!uploadResposta.ok) {
    const detalhe =
      await uploadResposta.text();

    console.error(
      "ERRO UPLOAD VÍDEO:",
      detalhe
    );

    throw new Error(
      "O vídeo foi gerado, mas não foi salvo no Storage."
    );
  }

  return (
    `${supabaseUrl}/storage/v1/object/public/imagens/${nomeArquivo}`
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
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
      imageUrl,
      estilo = "premium",
      duracao = 10,
      instrucoes = "",
      descricao = "",
      categoria = "",
      familia = "",
      modoPaizinho = false,
      fala = "",
      tipo = "clip_profissional",
      movimentoProdutoVisual = "",
    } = await req.json();

    if (
      !imageUrl ||
      typeof imageUrl !== "string"
    ) {
      return jsonResponse(
        {
          sucesso: false,
          erro:
            "A URL da imagem é obrigatória.",
        },
        400
      );
    }

    let urlValidada: URL;

    try {
      urlValidada =
        new URL(imageUrl);
    } catch {
      return jsonResponse(
        {
          sucesso: false,
          erro:
            "A URL da imagem é inválida.",
        },
        400
      );
    }

    if (
      !["http:", "https:"].includes(
        urlValidada.protocol
      )
    ) {
      return jsonResponse(
        {
          sucesso: false,
          erro:
            "A imagem precisa possuir uma URL pública HTTP ou HTTPS.",
        },
        400
      );
    }

    const replicateToken =
      Deno.env.get(
        "REPLICATE_API_TOKEN"
      );

    const serviceRoleKey =
      Deno.env.get(
        "SERVICE_ROLE_KEY"
      ) ||
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      );

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL") ||
      "https://arqzpqkkpwikyecdbopf.supabase.co";

    if (!replicateToken) {
      throw new Error(
        "REPLICATE_API_TOKEN não configurado nos Secrets."
      );
    }

    if (!serviceRoleKey) {
      throw new Error(
        "SERVICE_ROLE_KEY não configurado nos Secrets."
      );
    }

    const ehPaizinho =
      modoPaizinho === true ||
      String(tipo || "") ===
        "clip_paizinho_appia";

    const modoClipProduto360 =
      String(movimentoProdutoVisual || "") ===
      "360";

    const diretor = ehPaizinho
      ? {
          prompt: [
            "Create a professional presenter video using the person/character in the supplied start image.",
            "IMPORTANT: keep the same Paizinho APPIA character visible for the ENTIRE video from first frame to last frame.",
            "Preserve exactly the same face, hairstyle, body, navy APPIA shirt, proportions, colors and identity from the reference image.",
            "He is a friendly technology presenter speaking directly to the camera about the benefits of APPIA.",
            "Natural human presenter performance: subtle mouth movement as if speaking, natural blinking, small head movements, slight shoulder movement and restrained hand/arm gestures.",
            "Keep the camera mostly fixed in a medium portrait shot.",
            "Professional confident expression, warm smile and direct eye contact with the viewer.",
            "Clean premium dark-blue technology environment with subtle cyan lighting.",
            "Do not transform him into a product demonstration.",
            "Do not rotate the character.",
            "Do not use a 360 degree spin.",
            "Do not replace him with another image, object, product, car part, logo animation or slideshow.",
            "Do not cut away from the presenter.",
            "The presenter must remain the main subject continuously.",
            String(fala || "").trim()
              ? `The intended Brazilian Portuguese speech is: "${String(fala).trim()}". Animate him naturally as if delivering this speech.`
              : "",
            "No random text on screen. No watermark. No subtitles unless naturally supported.",
            String(instrucoes || ""),
          ]
            .filter(Boolean)
            .join(" "),
          negativePrompt: [
            "product rotation",
            "360 spin",
            "spinning object",
            "turntable",
            "product showcase",
            "car part",
            "object replacement",
            "character replacement",
            "slideshow",
            "cutaway",
            "scene change",
            "camera orbit",
            "rapid camera movement",
            "distorted face",
            "deformed hands",
            "extra fingers",
            "duplicate person",
            "random text",
            "watermark",
          ].join(", "),
          duracao: 10,
          familia: "paizinho_appia",
          estilo: "paizinho",
          movimentos: [
            "fala para camera",
            "piscar natural",
            "movimentos leves de cabeca",
            "gestos discretos",
          ],
          focoDetalhes: [
            "rosto",
            "expressao",
            "identidade APPIA",
          ],
        }
      : modoClipProduto360
      ? montarDiretorClipProduto360(
          instrucoes,
          duracao
        )
      : motorDiretorIA({
          descricao: String(descricao || ""),
          categoria: String(categoria || ""),
          familia: String(familia || ""),
          estilo:
            estilo === "clean" ||
            estilo === "marketplace"
              ? estilo
              : "premium",
          duracao:
            normalizarDuracao(duracao),
          instrucoesExtras:
            String(instrucoes || ""),
        });

    const prompt =
      diretor.prompt;

    const negativePrompt =
      diretor.negativePrompt;

    const duracaoFinal =
      diretor.duracao;

    console.log(
      "DIRETOR IA:",
      {
        familia:
          diretor.familia,
        estilo:
          diretor.estilo,
        movimentos:
          diretor.movimentos,
        focoDetalhes:
          diretor.focoDetalhes,
        duracaoSolicitada:
          duracao,
        duracaoFinal,
        modoPaizinho:
          ehPaizinho,
      }
    );

    const criarResposta =
      await fetch(
        REPLICATE_MODEL_URL,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${replicateToken}`,

            "Content-Type":
              "application/json",

            "Prefer": "wait=60",

            "Cancel-After": "4m",
          },

          body: JSON.stringify({
            input: {
              start_image:
                imageUrl,

              prompt,

              negative_prompt:
                negativePrompt,

              duration:
                duracaoFinal,

              mode: "standard",
            },
          }),
        }
      );

    let prediction:
      Record<string, any>;

    try {
      prediction =
        await criarResposta.json();
    } catch {
      throw new Error(
        "O Replicate não retornou uma resposta válida."
      );
    }

    if (!criarResposta.ok) {
      const detalhe =
        prediction?.detail ||
        prediction?.error ||
        prediction?.message ||
        "";

      if (
        String(detalhe)
          .toLowerCase()
          .includes(
            "insufficient credit"
          )
      ) {
        throw new Error(
          "Sem créditos no Replicate. Adicione saldo em Billing."
        );
      }

      throw new Error(
        String(detalhe) ||
          "Erro ao iniciar o Clip IA no Replicate."
      );
    }

    const limiteTentativas = 65;

    for (
      let tentativa = 0;
      tentativa <
      limiteTentativas;
      tentativa++
    ) {
      if (
        prediction.status ===
        "succeeded"
      ) {
        break;
      }

      if (
        prediction.status ===
          "failed" ||
        prediction.status ===
          "canceled"
      ) {
        throw new Error(
          prediction.error ||
            "A geração do vídeo falhou no Replicate."
        );
      }

      const getUrl =
        prediction?.urls?.get;

      if (!getUrl) {
        throw new Error(
          "O Replicate não retornou a URL de acompanhamento."
        );
      }

      await sleep(2000);

      const buscarResposta =
        await fetch(getUrl, {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${replicateToken}`,

            "Content-Type":
              "application/json",
          },
        });

      if (!buscarResposta.ok) {
        const detalhe =
          await buscarResposta.text();

        throw new Error(
          detalhe ||
            "Erro ao acompanhar a geração do vídeo."
        );
      }

      prediction =
        await buscarResposta.json();

      console.log(
        "STATUS CLIP:",
        prediction.status
      );
    }

    if (
      prediction.status !==
      "succeeded"
    ) {
      throw new Error(
        "Tempo esgotado aguardando a geração do vídeo."
      );
    }

    const videoReplicate =
      extrairVideo(
        prediction.output
      );

    if (!videoReplicate) {
      throw new Error(
        "O Replicate concluiu o processamento, mas não retornou o vídeo."
      );
    }

    const videoPublico =
      await salvarVideoNoStorage({
        videoUrl:
          videoReplicate,

        supabaseUrl,

        serviceRoleKey,

        estilo:
          ehPaizinho
            ? "paizinho-appia"
            : String(estilo),
      });

    return jsonResponse({
      sucesso: true,

      status: "processado",

      estilo:
        diretor.estilo,

      modo_paizinho:
        ehPaizinho,

      tipo:
        ehPaizinho
          ? "clip_paizinho_appia"
          : "clip_profissional",

      familia:
        diretor.familia,

      movimentos:
        diretor.movimentos,

      foco_detalhes:
        diretor.focoDetalhes,

      duracao:
        duracaoFinal,

      video_processado:
        videoPublico,

      video_url:
        videoPublico,

      video:
        videoPublico,
    });
  } catch (error) {
    console.error(
      "ERRO PROCESSAR CLIP:",
      error
    );

    return jsonResponse(
      {
        sucesso: false,

        erro:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao gerar o Clip IA.",
      },
      400
    );
  }
});