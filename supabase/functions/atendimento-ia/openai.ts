import OpenAI from "npm:openai@4.56.0";
import { PROMPT_SISTEMA } from "./prompt.ts";
import { ESPECIALISTAS } from "./especialistas.ts";

const client = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

export async function gerarRespostaIA(
  pergunta: string,
  contextoCatalogo: string,
  categoriaTecnica = "GERAL"
) {
  try {
    const especialista =
      ESPECIALISTAS[categoriaTecnica as keyof typeof ESPECIALISTAS] ||
      ESPECIALISTAS.GERAL;

    const resposta = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.1,
      max_tokens: 800,
      messages: [
        {
          role: "system",
          content: PROMPT_SISTEMA + "\n\n" + especialista,
        },
        {
          role: "user",
          content: `
PERGUNTA DO CLIENTE:
${pergunta}

DADOS DA CONSULTA (JSON):
${contextoCatalogo}

Leia cuidadosamente o JSON antes de responder.

Use todas as informações disponíveis para construir a resposta.

Se a Base não possuir confirmação, utilize seu conhecimento técnico apenas para orientar o cliente.

Nunca invente aplicações, OEM, equivalências ou compatibilidades.
Se existir categoriaPeca no JSON, adapte a resposta para essa categoria.
`,
        },
      ],
    });

    return (
      resposta.choices[0]?.message?.content ||
      "Não foi possível gerar uma resposta."
    );
  } catch (erro) {
    console.error("ERRO OPENAI:", erro);
    return "Ocorreu um erro ao consultar a IA.";
  }
}