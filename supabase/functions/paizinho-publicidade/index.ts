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

function texto(valor: unknown) {
  return String(valor ?? "").trim();
}

function limparJson(valor: string) {
  return valor
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return resposta(
      {
        sucesso: false,
        erro: "Método não permitido.",
      },
      405
    );
  }

  try {
    const apiKey =
      Deno.env.get("GEMINI_API_KEY");

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

    const body = await req.json();

    const pedido = texto(
      body?.pedido ||
      body?.descricao ||
      body?.instrucao
    );

    const empresa = texto(
      body?.empresa
    );

    if (!pedido) {
      return resposta(
        {
          sucesso: false,
          erro:
            "Descreva o que deseja para a publicidade.",
        },
        400
      );
    }

    console.log(
      "👨‍🔧 PAIZINHO PUBLICIDADE — PREPARANDO",
      {
        empresa: empresa || null,
        caracteresPedido: pedido.length,
      }
    );

    const prompt = `
Você é o Paizinho, agente criativo do PAIIA.

Sua tarefa é transformar o pedido do usuário em uma publicidade curta para um mascote falar em vídeo.

EMPRESA:
${empresa || "Não informada"}

PEDIDO DO USUÁRIO:
${pedido}

REGRAS IMPORTANTES:

1. Escreva a fala em português brasileiro natural.

2. A fala deve caber confortavelmente em um vídeo de aproximadamente 8 segundos.

3. Prefira uma fala curta, aproximadamente 15 a 22 palavras.

4. Não copie todo o pedido do usuário. Transforme o pedido em uma fala comercial natural.

5. Não invente preços, telefones, endereços, promoções, garantias, produtos ou informações que o usuário não forneceu.

6. Se o nome da empresa estiver disponível, pode utilizá-lo naturalmente.

7. A direção da cena deve explicar apenas:
- postura do mascote;
- olhar para a câmera;
- expressão;
- gestos;
- movimento natural;
- ação final.

8. Não altere a aparência física do mascote.

9. Não peça para criar textos, legendas ou elementos escritos dentro do vídeo.

10. A publicidade deve parecer profissional, amigável e adequada para redes sociais.

11. O mascote deve terminar a fala antes do final do vídeo.

12. Depois da fala, deixe um pequeno momento final com o mascote olhando para a câmera.

Retorne SOMENTE JSON válido neste formato:

{
  "fala": "fala que o mascote deverá dizer",
  "direcaoCena": "direção objetiva da atuação e movimentos do mascote",
  "vozGenero": "masculina",
  "estiloVoz": "comercial"
}
`;

    const ai =
      new GoogleGenAI({
        apiKey,
      });

    const resultado =
      await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",

        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      });

    const respostaTexto =
      texto(resultado?.text);

    if (!respostaTexto) {
      console.error(
        "Gemini não retornou texto:",
        resultado
      );

      return resposta(
        {
          sucesso: false,
          erro:
            "O Paizinho não conseguiu preparar a publicidade.",
        },
        502
      );
    }

    let dados: any;

    try {
      dados = JSON.parse(
        limparJson(respostaTexto)
      );
    } catch (erroJson) {
      console.error(
        "❌ RESPOSTA INVÁLIDA DO GEMINI:",
        respostaTexto,
        erroJson
      );

      return resposta(
        {
          sucesso: false,
          erro:
            "O Paizinho recebeu uma resposta inválida ao preparar a publicidade.",
        },
        502
      );
    }

    const fala =
      texto(dados?.fala);

    const direcaoCena =
      texto(dados?.direcaoCena);

    const vozGenero =
      texto(dados?.vozGenero) ||
      "masculina";

    const estiloVoz =
      texto(dados?.estiloVoz) ||
      "comercial";

    if (!fala || !direcaoCena) {
      return resposta(
        {
          sucesso: false,
          erro:
            "O Paizinho não conseguiu definir a fala e a direção da cena.",
        },
        502
      );
    }

    /*
     * Proteção adicional.
     * O iniciar-mascote-veo aceita
     * no máximo 260 caracteres.
     */
    if (fala.length > 260) {
      return resposta(
        {
          sucesso: false,
          erro:
            "O Paizinho criou uma fala longa demais. Tente novamente.",
        },
        502
      );
    }

    console.log(
      "✅ PAIZINHO PUBLICIDADE — PRONTA",
      {
        fala,
        direcaoCena,
        vozGenero,
        estiloVoz,
      }
    );

    return resposta({
      sucesso: true,

      fala,

      direcaoCena,

      vozGenero,

      estiloVoz,

      mensagem:
        "O Paizinho preparou a fala e a direção da cena.",
    });
  } catch (erro) {
    console.error(
      "❌ ERRO PAIZINHO PUBLICIDADE:",
      erro
    );

    return resposta(
      {
        sucesso: false,

        erro:
          erro instanceof Error
            ? erro.message
            : String(erro),
      },
      500
    );
  }
});