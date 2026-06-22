/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
const {
  imageUrl,
  tipo,
  modelo,
  categoria,
  estilo,
  tamanho,
  fundo,
} = await req.json();

const replicateToken = Deno.env.get("REPLICATE_API_TOKEN");

// URL fixa do seu projeto
const supabaseUrl = "https://arqzpqkkpwikyecdbopf.supabase.co";

// Secret que você vai criar em Edge Functions > Segredos
const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

if (!replicateToken) {
  throw new Error("REPLICATE_API_TOKEN não configurado.");
}

if (!serviceRoleKey) {
  throw new Error("SERVICE_ROLE_KEY não configurado.");
}
const promptBanner = `
Create a professional advertising banner using the uploaded image.

IMPORTANT:
The uploaded product image MUST be the main subject of the banner.
Do not replace the product.
Do not create a different product.
Do not change the product shape, color, details, label, connector, texture or design.
The exact uploaded product must remain clearly visible and become the focal point of the advertisement.

Build the full banner composition around the uploaded product.

Category: ${categoria || "general"}
Style: ${estilo || "premium"}
Banner model: ${modelo || "marketplace"}
Background: ${fundo || "automatic"}
Final size: ${tamanho || "1200x1200"} pixels.

Create a modern commercial banner for e-commerce, marketplace and social media.

If category is auto parts:
use premium automotive style, speed lines, blue gradient, technology elements, blurred cars in motion.

If category is fashion:
use elegant fashion design, clean studio look, premium lifestyle background.

If category is stationery:
use creative colorful design, paper, desk and organization elements.

If category is bakery or sweets:
use soft colors, delicious presentation, warm and attractive food style.

If category is cosmetics:
use luxury beauty style, soft light, premium background, elegant shine.

If category is pet shop:
use friendly, warm and playful pet-related design.

If category is electronics:
use futuristic technology style, neon light, clean modern background.

If category is tools:
use strong industrial style, workshop details, metallic tones.

Make the product stand out.
Professional advertising quality.
High contrast.
Sharp product.
No watermark.
No fake logos.
No unreadable text.
`;

    const criarResposta = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${replicateToken}`,
        "Content-Type": "application/json",
      },
    body: JSON.stringify({
  version: "black-forest-labs/flux-kontext-pro",
  input: {
    prompt:
      tipo === "banner"
        ? promptBanner
        : "Edit the uploaded product photo into a professional marketplace product image. Keep the exact same product, same shape, same colors and same details. Do not redesign, do not invent parts, do not change the object. Remove the background and replace it with a clean pure white background. Center the object in the frame. Improve lighting, sharpness and contrast naturally. Realistic studio product photography, premium e-commerce photo. No text, no logo, no watermark, no extra objects.",

    input_image: imageUrl,

    aspect_ratio:
      tamanho === "1200x1800"
        ? "2:3"
        : tamanho === "1080x1920"
        ? "9:16"
        : tamanho === "1920x1080"
        ? "16:9"
        : "1:1",

    output_format: "png",
  },
}),
    });

    let prediction = await criarResposta.json();

    if (!criarResposta.ok) {
      const detalhe = prediction?.detail || prediction?.error || "";

      if (detalhe.toLowerCase().includes("insufficient credit")) {
        throw new Error("Sem créditos no Replicate. Adicione saldo em Billing.");
      }

      throw new Error(detalhe || "Erro ao criar processamento no Replicate.");
    }

    const getUrl = prediction?.urls?.get;

    if (!getUrl) {
      throw new Error("Replicate não retornou URL de acompanhamento.");
    }

    for (let i = 0; i < 30; i++) {
      await sleep(2000);

      const buscarResposta = await fetch(getUrl, {
        method: "GET",
        headers: {
          Authorization: `Token ${replicateToken}`,
          "Content-Type": "application/json",
        },
      });

      prediction = await buscarResposta.json();

      if (prediction.status === "succeeded") {
        let imagemFinal = prediction.output;

        if (Array.isArray(imagemFinal)) {
          imagemFinal = imagemFinal[0];
        }

        if (!imagemFinal) {
          throw new Error("Replicate não retornou imagem final.");
        }

        const imagemResposta = await fetch(imagemFinal);

        if (!imagemResposta.ok) {
          throw new Error("Não foi possível baixar a imagem processada.");
        }

        const imagemBlob = await imagemResposta.blob();

        const nomeArquivo = `processados/${Date.now()}-imagem-processada.png`;

        const uploadResposta = await fetch(
          `${supabaseUrl}/storage/v1/object/imagens/${nomeArquivo}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceRoleKey}`,
              apikey: serviceRoleKey,
              "Content-Type": "image/png",
              "x-upsert": "true",
            },
            body: imagemBlob,
          }
        );

        if (!uploadResposta.ok) {
          const erroUpload = await uploadResposta.text();
          console.log("ERRO UPLOAD SUPABASE:", erroUpload);
          throw new Error("Erro ao salvar imagem processada no Storage.");
        }

        const imagemSupabase = `${supabaseUrl}/storage/v1/object/public/imagens/${nomeArquivo}`;

        return new Response(
          JSON.stringify({
            sucesso: true,
            status: "processado",
            imagem_processada: imagemSupabase,
          }),
          {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      if (prediction.status === "failed" || prediction.status === "canceled") {
        throw new Error(prediction?.error || "Processamento falhou no Replicate.");
      }
    }

    throw new Error("Tempo esgotado aguardando a IA processar a imagem.");
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        sucesso: false,
        erro: error.message,
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});