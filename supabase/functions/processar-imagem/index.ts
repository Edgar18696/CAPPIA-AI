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
      modeloPremium,
    } = await req.json();

    console.log("TIPO RECEBIDO:", tipo);
    console.log("FUNDO RECEBIDO:", fundo);

    const replicateToken = Deno.env.get("REPLICATE_API_TOKEN");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

    const supabaseUrl = "https://arqzpqkkpwikyecdbopf.supabase.co";

    if (!replicateToken) {
      throw new Error("REPLICATE_API_TOKEN não configurado.");
    }

    if (!serviceRoleKey) {
      throw new Error("SERVICE_ROLE_KEY não configurado.");
    }

    const promptBanner = `
Create a professional commercial advertising banner using the uploaded product image.

IMPORTANT:
The uploaded product image MUST be the main subject.
Do not replace the product.
Do not create a different product.
Do not change the product shape, color, details, label, connector, texture, material or design.

Build the full banner composition around the uploaded product.

Business category: ${categoria || "general commerce"}
Visual style: ${estilo || "premium"}
Premium model: ${modeloPremium || "premium"}
Banner format: ${modelo || "marketplace"}
Background preference: ${fundo || "automatic"}
Final size: ${tamanho || "1200x1200"} pixels.

Create a modern commercial banner for online stores, marketplaces, social media and WhatsApp Business.

Make the product stand out.
Professional advertising quality.
High contrast.
Sharp product.
Balanced composition.
No watermark.
No fake logos.
No unreadable text.
No random text unless requested.
`;

    const promptTransparente = `
Professional product cutout for e-commerce.

The uploaded product MUST remain exactly the same.

Do NOT redesign.
Do NOT recreate.
Do NOT modify geometry.
Do NOT change dimensions.
Do NOT change colors.
Do NOT change texture.
Do NOT change labels.
Do NOT change connectors.
Do NOT change pins.
Do NOT change holes.
Do NOT invent missing parts.

Remove ONLY the background.

Create a REAL transparent PNG with alpha channel.

Requirements:
- Transparent background
- No white pixels
- No gray pixels
- No background
- No floor
- No reflection
- No shadow
- No glow
- No environment
- No extra objects
- Extremely accurate cutout
- Ultra sharp edges
- Preserve every product detail
- High resolution
- Product centered
- Studio quality

No text.
No logo.
No watermark.

Output: Transparent PNG only.
`;

    const promptFoto = `
Professional e-commerce product photography.

The uploaded product is the ONLY subject of the image.

IMPORTANT:
This is NOT an image generation task.
This is NOT a redesign task.
This is NOT a creative interpretation.

This is a professional product photography task.

The goal is to photograph the exact same uploaded object inside a real commercial photography studio.

The product must remain 100% physically identical to the uploaded image.

Preserve exactly:
- geometry
- dimensions
- proportions
- viewing angle
- colors
- texture
- connectors
- pins
- holes
- labels
- engravings
- screws
- edges
- curves
- plastic surfaces
- metallic parts
- every visible physical detail

Only improve photographic quality.

Photography Standard:
- Commercial product catalog photography
- Professional e-commerce photography
- Full-frame DSLR camera look
- 100mm macro product lens
- ISO 100
- f/11 aperture
- Studio color calibration
- Neutral white balance 5500K
- High dynamic range
- Uniform exposure
- Soft diffused commercial lighting
- Pure white seamless background (#FFFFFF)
- Product occupying approximately 80% of the image
- Product perfectly centered
- Camera perfectly aligned with the product
- No perspective distortion
- Maximum sharpness across the entire product
- Uniform focus from edge to edge
- Preserve every micro-detail

Requirements:
- Pure white background (#FFFFFF)
- Premium commercial photography
- Ultra high sharpness
- Extremely crisp edges
- Natural realistic edges
- Accurate colors
- Balanced exposure
- Remove dust, scratches and camera noise only
- Keep original manufacturing marks
- Keep original engravings
- Keep original molding marks
- Keep the exact product position
- No cropping
- No extra objects
- No hands
- No supports
- No accessories
- No packaging
- No logos added
- No text
- No watermark
- No graphic elements

DO NOT:
- redesign the product
- recreate the product
- reinterpret the product
- invent details
- generate missing information
- create a cleaner version of the object
- simplify details
- change connectors
- change pin quantity
- change holes
- change dimensions
- change the viewing angle
- rotate the product
- mirror the product
- stretch the product
- compress the product
- smooth important edges
- replace materials
- modify connector position
- modify screw position
- modify hole position
- exaggerate reflections
- exaggerate metallic shine
- exaggerate plastic texture
- create fake scratches
- remove authentic manufacturing marks
- remove original engravings
- remove original molding marks

Quality Standard:
The final image must be suitable for Mercado Livre, Shopee, Amazon, Magazine Luiza, Americanas, WhatsApp Business, Instagram Shop and professional e-commerce websites.

The customer must believe this image was captured by a professional photographer inside a commercial product studio.

Output:
A realistic studio photograph.
Not an illustration.
Not CGI.
Not 3D.
Not AI artwork.
Not a render.

One square PNG with a pure white (#FFFFFF) background.

Final size: ${tamanho || "1200x1200"} pixels.
`;

let promptFotoInteligente = promptFoto;

if (categoria === "auto parts" || categoria === "autopeças" || categoria === "autopecas") {
  promptFotoInteligente = `
${promptFoto}

Specific direction for auto parts:
Preserve technical accuracy above everything.
Keep connectors, pins, holes, screws, engravings, plastic texture, metallic texture and manufacturing marks exactly as in the uploaded image.
Use premium automotive catalog photography style.
Avoid artistic interpretation.
Avoid exaggerated reflections.
Avoid changing the part geometry.
`;
}

if (categoria === "electronics" || categoria === "eletrônicos" || categoria === "eletronicos") {
  promptFotoInteligente = `
${promptFoto}

Specific direction for electronics:
Preserve ports, connectors, buttons, labels, serial details, screws and surface texture exactly as in the uploaded image.
Use clean high-tech studio photography.
Avoid changing screen, plug, connector or electronic layout.
`;
}

if (categoria === "fashion" || categoria === "moda") {
  promptFotoInteligente = `
${promptFoto}

Specific direction for fashion:
Preserve fabric texture, stitching, seams, shape, color and material exactly as in the uploaded image.
Use clean premium fashion catalog photography.
Avoid changing fit, fabric or design.
`;
}

if (categoria === "cosmetics" || categoria === "cosméticos" || categoria === "cosmeticos") {
  promptFotoInteligente = `
${promptFoto}

Specific direction for cosmetics:
Preserve bottle shape, cap, label, color, typography and material exactly as in the uploaded image.
Use premium beauty product photography.
Avoid changing label or packaging design.
`;
}

if (categoria === "food" || categoria === "doceria" || categoria === "alimentos") {
  promptFotoInteligente = `
${promptFoto}

Specific direction for food and sweets:
Preserve the exact product appearance, shape, color, texture and decoration.
Use appetizing commercial food photography.
Avoid inventing ingredients, toppings or decoration.
`;
}

const promptFinal =
  tipo === "banner"
    ? promptBanner
    : fundo === "transparente"
    ? promptTransparente
    : promptFotoInteligente;

    const criarResposta = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${replicateToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "black-forest-labs/flux-kontext-pro",
        input: {
          prompt: promptFinal,
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

        if (typeof imagemFinal === "object" && imagemFinal !== null) {
          imagemFinal =
            imagemFinal.url ||
            imagemFinal.image ||
            imagemFinal.output ||
            imagemFinal[0];
        }

        console.log("IMAGEM FINAL:", imagemFinal);

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