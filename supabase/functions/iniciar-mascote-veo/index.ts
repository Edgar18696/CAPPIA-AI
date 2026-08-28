import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { GoogleGenAI } from "npm:@google/genai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

function resposta(
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

function normalizarTexto(
  valor: unknown
) {
  return String(
    valor ?? ""
  ).trim();
}

async function imagemUrlParaBase64(
  imagemUrl: string
) {
  const respostaImagem =
    await fetch(imagemUrl);

  if (!respostaImagem.ok) {
    throw new Error(
      `Não foi possível carregar a imagem do mascote (${respostaImagem.status}).`
    );
  }

  const mimeType =
    respostaImagem.headers.get(
      "content-type"
    ) ||
    "image/png";

  const arrayBuffer =
    await respostaImagem.arrayBuffer();

  const bytes =
    new Uint8Array(
      arrayBuffer
    );

  let binario = "";

  const tamanhoBloco =
    0x8000;

  for (
    let i = 0;
    i < bytes.length;
    i += tamanhoBloco
  ) {
    binario +=
      String.fromCharCode(
        ...bytes.subarray(
          i,
          i + tamanhoBloco
        )
      );
  }

  return {
    imageBytes:
      btoa(binario),

    mimeType,
  };
}

function montarPrompt({
  fala,
  empresa,
  instrucao,
}: {
  fala: string;
  empresa: string;
  instrucao: string;
}) {
  const nomeEmpresa =
    empresa ||
    "the user's company";

  const direcaoExtra =
    instrucao ||
    "The mascot looks directly at the camera, uses natural friendly gestures and remains clearly visible throughout the video.";

  return [
    "Animate the main mascot from the provided reference image.",

    "IMPORTANT: Keep exactly the same mascot shown in the reference image.",

    "Preserve the same character design, body, face, eyes, mouth, colors, clothing, cap, logos and visual identity.",

    "Do not redesign, replace or create a different version of the mascot.",

    "Do not create another main character.",

    `This is an advertisement for ${nomeEmpresa}.`,

    direcaoExtra,

    "The mascot looks directly at the camera and speaks naturally in Brazilian Portuguese.",

    "Only the main mascot speaks.",

    "Perfectly synchronize the mascot's mouth with every spoken word.",

    "The mouth must stop moving immediately after the dialogue ends.",

    "Use natural facial expressions and moderate gestures.",

    "Use a friendly, energetic and professional Brazilian voice.",

    "Spoken dialogue in Brazilian Portuguese:",

    `"${fala}"`,

    "The complete dialogue must fit naturally inside the video and must not be cut off.",

    "No subtitles.",

    "Do not create random text.",

    "Do not invent logos, phone numbers, websites or company names.",

    "Preserve all branding already visible in the reference image.",

    "Professional automotive advertising style.",

    "Clean composition, smooth motion and premium commercial appearance.",
  ].join("\n");
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
      return resposta(
        {
          sucesso: false,
          erro:
            "Método não permitido.",
        },
        405
      );
    }

    try {
      const apiKey =
        Deno.env.get(
          "GEMINI_API_KEY"
        );

      if (!apiKey) {
        return resposta(
          {
            sucesso: false,
            erro:
              "GEMINI_API_KEY não configurada no Supabase.",
          },
          500
        );
      }

      const body =
        await req.json();

      const imagemUrl =
        normalizarTexto(
          body?.imagemUrl ||
          body?.imageUrl
        );

      const fala =
        normalizarTexto(
          body?.fala
        );

      const empresa =
        normalizarTexto(
          body?.empresa
        );

      const instrucao =
        normalizarTexto(
          body?.instrucao
        );

      const formatoRecebido =
        normalizarTexto(
          body?.formato
        ).toLowerCase();

      const formato =
        formatoRecebido ===
          "horizontal" ||
        formatoRecebido ===
          "16:9"
          ? "16:9"
          : "9:16";

      if (!imagemUrl) {
        return resposta(
          {
            sucesso: false,
            erro:
              "Imagem do mascote não informada.",
          },
          400
        );
      }

      if (!fala) {
        return resposta(
          {
            sucesso: false,
            erro:
              "Fala do mascote não informada.",
          },
          400
        );
      }

      /*
       * Para manter boa chance
       * de conclusão dentro dos
       * 8 segundos do Veo.
       */
      if (
        fala.length > 260
      ) {
        return resposta(
          {
            sucesso: false,
            erro:
              "A fala está muito longa para um vídeo de 8 segundos. Reduza o texto antes de gerar.",
          },
          400
        );
      }

      console.log(
        "🎭 PAIIA MASCOTE VEO — INICIANDO",
        {
          empresa:
            empresa || null,

          formato,

          caracteresFala:
            fala.length,
        }
      );

      const imagem =
        await imagemUrlParaBase64(
          imagemUrl
        );

      const prompt =
        montarPrompt({
          fala,
          empresa,
          instrucao,
        });

      const ai =
        new GoogleGenAI({
          apiKey,
        });

      /*
       * FAST:
       * equilíbrio entre
       * qualidade, velocidade
       * e custo.
       *
       * Depois podemos testar
       * Lite sem alterar a tela.
       */
    const operation =
  await ai.models.generateVideos({
    model:
      "veo-3.1-generate-preview",

    source: {
      prompt:
        [
          prompt,

          formato === "9:16"
            ? "FINAL VIDEO MUST BE TRUE VERTICAL PORTRAIT 9:16. Fill the full vertical frame. Do not place the vertical artwork inside a horizontal canvas. Do not add side borders, white bars or letterboxing."
            : "FINAL VIDEO MUST BE TRUE HORIZONTAL LANDSCAPE 16:9. Fill the full horizontal frame.",
        ].join("\n"),

      image: {
        imageBytes:
          imagem.imageBytes,

        mimeType:
          imagem.mimeType,
      },
    },

    config: {
      aspectRatio:
        formato,

      resolution:
        "720p",
    },
  });

      const operationName =
        normalizarTexto(
          operation?.name
        );

      if (!operationName) {
        console.error(
          "Resposta Veo sem operation.name:",
          operation
        );

        return resposta(
          {
            sucesso: false,
            erro:
              "O Veo recebeu a solicitação, mas não retornou o identificador da geração.",
          },
          502
        );
      }

      console.log(
        "✅ PAIIA MASCOTE VEO — GERAÇÃO INICIADA",
        {
          operationName,
        }
      );

      return resposta({
        sucesso: true,

        iniciado: true,

        concluido:
          Boolean(
            operation?.done
          ),

        operation_name:
          operationName,

        modelo:
          "veo-3.1-fast-generate-preview",

        formato,

        duracao:
          8,

        resolucao:
          "720p",

        mensagem:
          "Vídeo do mascote enviado para geração.",
      });
    } catch (erro) {
      console.error(
        "❌ ERRO INICIAR MASCOTE VEO:",
        erro
      );

      return resposta(
        {
          sucesso: false,

          erro:
            erro instanceof Error
              ? erro.message
              : String(
                  erro
                ),
        },
        500
      );
    }
  }
);