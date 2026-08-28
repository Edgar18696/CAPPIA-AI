/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import OpenAI from "npm:openai@4.56.0";

const client = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const {
      texto,
      fabricante,
      origemCatalogo,
      nomeArquivo,
      paginaInicial,
      paginaFinal,
    } = await req.json();

    const resposta =
      await client.chat.completions.create({
        model: "gpt-4.1-mini",
        temperature: 0,

        response_format: {
          type: "json_object",
        },

        messages: [
          {
            role: "system",
            content: `
Você é um especialista em catálogos automotivos.

Sua missão é transformar qualquer catálogo PDF em registros estruturados.

Extraia TODOS os registros encontrados.

Retorne SOMENTE JSON.

Formato obrigatório:

{
  "registros":[
    {
      "peca":"",
      "codigo_oem":"",
      "codigo_equivalente":"",
      "fabricante":"",
      "montadora":"",
      "modelo":"",
      "motor":"",
      "ano_inicio":null,
      "ano_fim":null,
      "observacao":"",
      "pagina_catalogo":null,
      "prioridade":5,
      "confiabilidade":90
    }
  ]
}
`,
          },

          {
            role: "user",
            content: `
Fabricante:
${fabricante}

Origem:
${origemCatalogo}

Arquivo:
${nomeArquivo}

Páginas:
${paginaInicial} até ${paginaFinal}

Texto:

${texto}
`,
          },
        ],
      });

    const conteudo =
      resposta.choices[0].message.content;

    return new Response(conteudo, {
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json",
      },
    });
  } catch (erro) {
    console.error(erro);

    return new Response(
      JSON.stringify({
        error:
          erro instanceof Error
            ? erro.message
            : "Erro interno.",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      }
    );
  }
});