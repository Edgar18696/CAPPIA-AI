const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { mensagem } = await req.json();

    if (!mensagem) {
      return new Response(
        JSON.stringify({ error: "Mensagem não enviada." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY não configurada." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const respostaOpenAI = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
Você é o Atendimento IA do APPIA AI.

Sua função é ajudar lojistas, vendedores e empresas a criarem respostas profissionais para clientes.

Regras:
- Responda sempre em português do Brasil.
- Seja educado, claro e profissional.
- Use linguagem simples e comercial.
- Não invente compatibilidade de peças.
- Quando faltar informação, peça número da peça antiga, código OEM, chassi, ano, motor e versão do veículo.
- Para autopeças, sempre recomende confirmar compatibilidade antes da compra.
- Para Mercado Livre, Shopee e WhatsApp, escreva respostas prontas para enviar ao cliente.
- Evite respostas muito longas.
            `,
          },
          {
            role: "user",
            content: mensagem,
          },
        ],
        temperature: 0.4,
      }),
    });

    const data = await respostaOpenAI.json();

    if (!respostaOpenAI.ok) {
      return new Response(
        JSON.stringify({
          error: data?.error?.message || "Erro ao chamar a OpenAI.",
          detalhes: data,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const resposta =
      data?.choices?.[0]?.message?.content ||
      "Não consegui gerar uma resposta agora.";

    return new Response(
      JSON.stringify({ resposta }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Erro interno na Function atendimento-ia.",
        detalhes: String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});