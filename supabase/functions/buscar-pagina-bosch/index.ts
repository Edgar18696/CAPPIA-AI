/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normalizarCodigo(valor = "") {
  return String(valor || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .trim();
}

function extrairLinks(html = "") {
  const links: string[] = [];
  const regex = /href=["']([^"']+)["']/gi;

  let resultado;

  while ((resultado = regex.exec(html))) {
    const link = String(resultado[1] || "")
      .replace(/&amp;/gi, "&")
      .trim();

    if (link) {
      links.push(link);
    }
  }

  return links;
}

function extrairUrlGoogle(link = "") {
  if (!link) {
    return "";
  }

  if (link.startsWith("/url?q=")) {
    const parte = link
      .replace("/url?q=", "")
      .split("&")[0];

    return decodeURIComponent(parte);
  }

  return link;
}

function paginaBoschValida(url = "") {
  return (
    url.startsWith("https://www.boschpecas.com.br/") &&
    !url.includes("/search") &&
    !url.includes("/busca") &&
    (
      url.includes("bico-injetor") ||
      url.includes("sistema-de-ignicao")
    )
  );
}

async function pesquisarPaginaBosch(codigo: string) {
  const consulta =
    `site:boschpecas.com.br "${codigo}" Bosch`;

  const urlPesquisa =
    `https://www.google.com/search?q=${encodeURIComponent(
      consulta
    )}`;

  const resposta = await fetch(urlPesquisa, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      Accept: "text/html",
      "Accept-Language": "pt-BR,pt;q=0.9",
    },
  });

  if (!resposta.ok) {
    throw new Error(
      `A pesquisa retornou status ${resposta.status}.`
    );
  }

  const html = await resposta.text();

  const urls = extrairLinks(html)
    .map(extrairUrlGoogle)
    .filter(paginaBoschValida);

  return urls[0] || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const corpo = await req.json();

    const codigo = normalizarCodigo(
      corpo?.codigo || ""
    );

    if (!codigo) {
      throw new Error(
        "Informe um código Bosch ou OEM."
      );
    }

    const url =
      await pesquisarPaginaBosch(codigo);

    if (!url) {
      throw new Error(
        `Nenhuma página Bosch encontrada para ${codigo}.`
      );
    }

    return new Response(
      JSON.stringify({
        sucesso: true,
        codigo,
        url,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Erro ao pesquisar página Bosch.";

    return new Response(
      JSON.stringify({
        sucesso: false,
        erro: mensagem,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});