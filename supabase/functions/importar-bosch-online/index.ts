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

function limparHtml(valor = "") {
  return String(valor || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function urlAbsoluta(url = "") {
  const valor = String(url || "").trim();

  if (!valor) {
    return "";
  }

  if (valor.startsWith("https://")) {
    return valor;
  }

  if (valor.startsWith("http://")) {
    return valor.replace(
      "http://",
      "https://"
    );
  }

  if (valor.startsWith("//")) {
    return `https:${valor}`;
  }

  if (valor.startsWith("/")) {
    return `https://www.boschpecas.com.br${valor}`;
  }

  return `https://www.boschpecas.com.br/${valor}`;
}

function extrairLinksProdutos(
  html = "",
  codigo = ""
) {
  const codigoFinal =
    normalizarCodigo(codigo);

  const resultados: Array<{
    url: string;
    titulo: string;
    pontuacao: number;
  }> = [];

  const regexLink =
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let correspondencia;

  while (
    (correspondencia =
      regexLink.exec(html)) !== null
  ) {
    const href =
      correspondencia[1] || "";

    const titulo =
      limparHtml(
        correspondencia[2] || ""
      );

    const textoNormalizado =
      normalizarCodigo(titulo);

    const urlFinal =
      urlAbsoluta(href);

    if (
      !urlFinal.includes(
        "boschpecas.com.br"
      )
    ) {
      continue;
    }

    if (
      urlFinal.includes("/carrinho") ||
      urlFinal.includes("/login") ||
      urlFinal.includes("/busca.php") ||
      urlFinal.includes("#") ||
      urlFinal.includes("javascript:")
    ) {
      continue;
    }

    let pontuacao = 0;

    if (
      textoNormalizado.includes(
        codigoFinal
      )
    ) {
      pontuacao += 100;
    }

    if (
      normalizarCodigo(
        urlFinal
      ).includes(codigoFinal)
    ) {
      pontuacao += 80;
    }

    if (
      titulo
        .toLowerCase()
        .includes("bosch")
    ) {
      pontuacao += 20;
    }

    if (
      /bico|sensor|sonda|bobina|bomba|vela|filtro|pastilha|palheta/i.test(
        titulo
      )
    ) {
      pontuacao += 10;
    }

    if (pontuacao > 0) {
      resultados.push({
        url: urlFinal,
        titulo,
        pontuacao,
      });
    }
  }

  const unicos = new Map();

  resultados.forEach((item) => {
    const existente =
      unicos.get(item.url);

    if (
      !existente ||
      item.pontuacao >
        existente.pontuacao
    ) {
      unicos.set(item.url, item);
    }
  });

  return Array.from(
    unicos.values()
  ).sort(
    (a, b) =>
      b.pontuacao - a.pontuacao
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json();

    const codigo =
      normalizarCodigo(
        body?.codigo || ""
      );

    if (!codigo) {
      throw new Error(
        "Informe um código Bosch."
      );
    }

    const urlBusca =
      "https://www.boschpecas.com.br/loja/busca.php" +
      "?loja=1428319" +
      `&palavra_busca=${encodeURIComponent(
        codigo
      )}`;

    const resposta =
      await fetch(urlBusca, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml",
          "Accept-Language":
            "pt-BR,pt;q=0.9",
        },
      });

    if (!resposta.ok) {
      throw new Error(
        `Busca Bosch retornou HTTP ${resposta.status}.`
      );
    }

    const html =
      await resposta.text();

    const resultados =
      extrairLinksProdutos(
        html,
        codigo
      );

    if (resultados.length === 0) {
      return new Response(
        JSON.stringify({
          sucesso: false,
          codigo,
          url: "",
          mensagem:
            `Nenhuma página Bosch encontrada para ${codigo}.`,
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        }
      );
    }

    const melhorResultado =
      resultados[0];

    return new Response(
      JSON.stringify({
        sucesso: true,
        codigo,
        url: melhorResultado.url,
        titulo:
          melhorResultado.titulo,
        origem:
          "busca_catalogo_bosch",
        quantidadeEncontrada:
          resultados.length,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      }
    );
  } catch (erro) {
    console.error(
      "Erro buscar página Bosch:",
      erro
    );

    return new Response(
      JSON.stringify({
        sucesso: false,
        mensagem:
          erro instanceof Error
            ? erro.message
            : "Erro ao pesquisar no catálogo Bosch.",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      }
    );
  }
});