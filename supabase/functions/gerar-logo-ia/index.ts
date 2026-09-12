import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function montarPromptLogo(dados: {
  empresa: string;
  descricao: string;
  cores: string;
  estilo: string;
  temReferencia: boolean;
}) {
  return [
    "Create ONE original professional brand logo. Not a mascot, not a character, not a scene.",
    "Centered logo on a clean studio background, suitable for automotive aftermarket branding.",
    `Company: ${dados.empresa || "the brand"}.`,
    dados.estilo ? `Visual style: ${dados.estilo}.` : "",
    dados.cores ? `Brand colors: ${dados.cores}.` : "",
    dados.temReferencia
      ? "Use the provided reference image as visual identity guidance (shape, colors or symbol), without copying it exactly."
      : "",
    `User idea: ${dados.descricao}`,
    "Keep it simple, memorable, readable at small size. No photorealistic people, no extra characters, no watermark.",
  ]
    .filter(Boolean)
    .join(" ");
}

function imagemUtilizavel(url: string) {
  return (
    /^https?:\/\//i.test(url) ||
    /^data:image\//i.test(url)
  );
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
    Deno.env.get("SUPABASE_ANON_KEY") ||
    Deno.env.get("ANON_KEY") ||
    "";
  const authorization =
    req.headers.get("Authorization") ||
    req.headers.get("authorization") ||
    "";

  if (!supabaseUrl || !anonKey) {
    return json(
      { sucesso: false, erro: "Serviço de criação de logo indisponível." },
      500
    );
  }

  if (!authorization) {
    return json(
      { sucesso: false, erro: "Faça login para criar o logo." },
      401
    );
  }

  const usuarioClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
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
        { sucesso: false, erro: "Faça login para criar o logo." },
        401
      );
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY") || "";

    if (!apiKey) {
      return json(
        { sucesso: false, erro: "Serviço de criação de logo indisponível." },
        500
      );
    }

    const body = await req.json();
    const empresa =
      String(body?.empresa || "").trim() || "Minha marca";
    const descricao = String(body?.descricao || "").trim();
    const cores = String(body?.cores || "").trim();
    const estilo = String(body?.estilo || "").trim();
    const logoUrl = String(body?.logoUrl || "").trim();
    const fotoReferenciaUrl = String(
      body?.fotoReferenciaUrl || ""
    ).trim();

    if (!descricao) {
      return json(
        {
          sucesso: false,
          erro: "Descreva o logo que deseja.",
        },
        400
      );
    }

    const imagemEdicao = imagemUtilizavel(fotoReferenciaUrl)
      ? fotoReferenciaUrl
      : imagemUtilizavel(logoUrl)
      ? logoUrl
      : "";
    const promptImagem = montarPromptLogo({
      empresa,
      descricao,
      cores,
      estilo,
      temReferencia: Boolean(imagemEdicao),
    });

    let resposta: Response;

    if (imagemEdicao) {
      const imagemResposta = await fetch(imagemEdicao);
      const imagemBlob = await imagemResposta.blob();
      const form = new FormData();
      form.append("model", "gpt-image-1");
      form.append("prompt", promptImagem);
      form.append("size", "1024x1024");
      form.append("n", "3");
      form.append(
        "image[]",
        new File([imagemBlob], "referencia.png", {
          type: imagemBlob.type || "image/png",
        })
      );

      resposta = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: form,
      });
    } else {
      resposta = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt: promptImagem,
          n: 3,
          size: "1024x1024",
        }),
      });
    }

    const dados = await resposta.json();

    if (!resposta.ok) {
      return json(
        {
          sucesso: false,
          erro:
            dados?.error?.message ||
            "Não foi possível gerar as opções de logo.",
        },
        502
      );
    }

    const opcoes = Array.isArray(dados?.data)
      ? dados.data
          .map((item: { b64_json?: string; url?: string }) => {
            if (item?.b64_json) {
              return `data:image/png;base64,${item.b64_json}`;
            }
            return String(item?.url || "");
          })
          .filter(Boolean)
      : [];

    if (!opcoes.length) {
      return json(
        { sucesso: false, erro: "A geração não retornou imagens." },
        502
      );
    }

    return json({
      sucesso: true,
      prompt_base: promptImagem,
      opcoes,
    });
  } catch (erro) {
    return json(
      {
        sucesso: false,
        erro:
          erro instanceof Error
            ? erro.message
            : "Erro inesperado ao criar o logo.",
      },
      500
    );
  }
});
