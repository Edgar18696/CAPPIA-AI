/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import {
  AlphaAction,
  ImageMagick,
  initializeImageMagick,
  MagickColor,
} from "npm:@imagemagick/magick-wasm@0.0.40";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL =
  "https://arqzpqkkpwikyecdbopf.supabase.co";

const REPLICATE_ENDPOINT =
  "https://api.replicate.com/v1/models/recraft-ai/recraft-remove-background/predictions";

let imagemMagickInicializado = false;

async function garantirImageMagick() {
  if (imagemMagickInicializado) {
    return;
  }

  const wasmBytes = await Deno.readFile(
    new URL(
      "magick.wasm",
      import.meta.resolve(
        "npm:@imagemagick/magick-wasm@0.0.40"
      )
    )
  );

  await initializeImageMagick(wasmBytes);
  imagemMagickInicializado = true;
}

function respostaJson(
  dados: Record<string, unknown>,
  status = 200
) {
  return new Response(
    JSON.stringify(dados),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}

function obterMensagemErro(
  dados: unknown,
  status: number
) {
  if (
    dados &&
    typeof dados === "object"
  ) {
    const objeto = dados as Record<
      string,
      unknown
    >;

    const mensagem =
      objeto.detail ||
      objeto.error ||
      objeto.erro ||
      objeto.message;

    if (mensagem) {
      return typeof mensagem === "string"
        ? mensagem
        : JSON.stringify(mensagem);
    }
  }

  return `Erro HTTP ${status}`;
}

function obterUrlResultado(
  output: unknown
): string {
  if (typeof output === "string") {
    return output;
  }

  if (Array.isArray(output)) {
    return obterUrlResultado(output[0]);
  }

  if (
    output &&
    typeof output === "object"
  ) {
    const objeto = output as Record<
      string,
      unknown
    >;

    return (
      obterUrlResultado(objeto.url) ||
      obterUrlResultado(objeto.image) ||
      obterUrlResultado(objeto.output)
    );
  }

  return "";
}

async function aplicarFundoBranco(
  imagemBytes: Uint8Array
) {
  await garantirImageMagick();

  return ImageMagick.read(
    imagemBytes,
    (imagem): Uint8Array => {
      imagem.backgroundColor =
        new MagickColor("#ffffff");

      imagem.alpha(
        AlphaAction.Remove
      );

      return imagem.write(
        (dados) => dados
      );
    }
  );
}

async function salvarNoStorage({
  imagemBytes,
  serviceRoleKey,
}: {
  imagemBytes: Uint8Array;
  serviceRoleKey: string;
}) {
  const nomeArquivo =
    `processados/foto-${Date.now()}-${crypto.randomUUID()}.png`;

  const respostaUpload = await fetch(
    `${SUPABASE_URL}/storage/v1/object/imagens/${nomeArquivo}`,
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": "image/png",
        "x-upsert": "false",
      },
      body: imagemBytes,
    }
  );

  if (!respostaUpload.ok) {
    const detalhes =
      await respostaUpload.text();

    console.error(
      "ERRO STORAGE:",
      respostaUpload.status,
      detalhes
    );

    throw new Error(
      "Não foi possível salvar a foto processada no Storage."
    );
  }

  return (
    `${SUPABASE_URL}/storage/v1/object/public/imagens/${nomeArquivo}`
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(
      "ok",
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  }

  if (req.method !== "POST") {
    return respostaJson(
      {
        sucesso: false,
        erro: "Método não permitido.",
      },
      405
    );
  }

  try {
    const corpo = await req.json();

    const imageUrl = String(
      corpo?.imageUrl || ""
    ).trim();

    const fundo =
      corpo?.fundo === "transparente"
        ? "transparente"
        : "branco";

    if (!imageUrl) {
      return respostaJson(
        {
          sucesso: false,
          erro: "A URL da imagem é obrigatória.",
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
      );

    if (!replicateToken) {
      throw new Error(
        "REPLICATE_API_TOKEN não configurado."
      );
    }

    if (!serviceRoleKey) {
      throw new Error(
        "SERVICE_ROLE_KEY não configurado."
      );
    }

    console.log(
      "PROCESSAR FOTO:",
      {
        fundo,
        imageUrl,
      }
    );

    const respostaReplicate =
      await fetch(
        REPLICATE_ENDPOINT,
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${replicateToken}`,
            "Content-Type":
              "application/json",
            Prefer: "wait=60",
          },
          body: JSON.stringify({
            input: {
              image: imageUrl,
            },
          }),
        }
      );

    let prediction: Record<
      string,
      unknown
    > = {};

    try {
      prediction =
        await respostaReplicate.json();
    } catch {
      prediction = {};
    }

    console.log(
      "REPLICATE STATUS:",
      respostaReplicate.status
    );

    console.log(
      "REPLICATE RESPOSTA:",
      prediction
    );

    if (!respostaReplicate.ok) {
      throw new Error(
        obterMensagemErro(
          prediction,
          respostaReplicate.status
        )
      );
    }

    if (
      prediction.status !== "succeeded"
    ) {
      const erroPrediction =
        prediction.error;

      throw new Error(
        erroPrediction
          ? String(erroPrediction)
          : "O Replicate não concluiu o processamento dentro do tempo esperado."
      );
    }

    const urlSemFundo =
      obterUrlResultado(
        prediction.output
      );

    if (!urlSemFundo) {
      throw new Error(
        "O Replicate não retornou a imagem processada."
      );
    }

    const respostaImagem =
      await fetch(urlSemFundo);

    if (!respostaImagem.ok) {
      throw new Error(
        "Não foi possível baixar a imagem processada."
      );
    }

    const bytesTransparentes =
      new Uint8Array(
        await respostaImagem.arrayBuffer()
      );

    if (
      bytesTransparentes.length === 0
    ) {
      throw new Error(
        "A imagem processada retornou vazia."
      );
    }

    const imagemFinalBytes =
      fundo === "branco"
        ? await aplicarFundoBranco(
            bytesTransparentes
          )
        : bytesTransparentes;

    const imagemPublica =
      await salvarNoStorage({
        imagemBytes:
          imagemFinalBytes,
        serviceRoleKey,
      });

    return respostaJson({
      sucesso: true,
      status: "processado",
      fundo,
      imagem_processada:
        imagemPublica,
    });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : String(erro);

    console.error(
      "ERRO PROCESSAR FOTO:",
      erro
    );

    return respostaJson(
      {
        sucesso: false,
        erro: mensagem,
      },
      400
    );
  }
});