import { extrairContexto } from "./contexto.ts";
import { buscarCatalogo } from "./catalogo.ts";
import { buscarEquivalencias } from "./equivalencias.ts";
import { montarRespostaCatalogo } from "./resposta.ts";
import { gerarRespostaIA } from "./openai.ts";
import { classificarConsulta } from "./classificador.ts";
function montarContextoIA(
  contexto: any,
  tipoConsulta: any,
  codigoBusca: string,
  resultadosCatalogo: any[],
  equivalencias: any[]
) {
  return {
    consulta: {
      pergunta: contexto.mensagemOriginal,
      tipoConsulta,
      statusBase:
        resultadosCatalogo.length > 0
          ? "ENCONTRADO"
          : "NAO_ENCONTRADO",
    },

 identificacao: {
  codigo: codigoBusca || null,
  peca: contexto.peca || null,
  categoriaPeca: contexto.peca
    ? contexto.peca.toUpperCase().replaceAll(" ", "_")
    : null,
  marca: contexto.marca || null,
  modelo: contexto.modelo || null,
  motor: contexto.motor || null,
  ano: contexto.ano || null,
  chassiInformado: !!contexto.chassi,
},

    resultados: {
      catalogo: resultadosCatalogo.length,
      equivalencias: equivalencias.length,
    },

    regras: {
      usarBasePrimeiro: true,
      nuncaInventarAplicacao: true,
      nuncaInventarOEM: true,
      nuncaInventarEquivalencia: true,
      orientarTecnicamente: true,
    },
  };
}
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json();

const mensagem = body?.mensagem || "";
const especialista = body?.especialista || "";
const modoCopilot = especialista === "copilot";
console.log("ESPECIALISTA:", especialista);
console.log("MODO COPILOT:", modoCopilot);

    if (!mensagem.trim()) {
      return new Response(
        JSON.stringify({
          resposta: "Digite uma mensagem para eu responder.",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
if (modoCopilot) {
  const promptCopilot = `
Você é o APPIA Copilot, especialista em criação de anúncios para Mercado Livre, Shopee e e-commerce.

Crie um anúncio completo com base neste produto:

${mensagem}

Responda sempre neste formato:

🏷️ Título otimizado:

📝 Descrição do anúncio:

🚗 Aplicação:

🔑 Palavras-chave:

📸 Sugestão de foto:

🎨 Sugestão de banner:

⚠️ Observação:

Regras:
- Não diga "não encontrei na base".
- Não invente código OEM.
- Não garanta compatibilidade sem confirmação.
- Recomende conferir código da peça antiga ou chassi.
`;

  const resposta = await gerarRespostaIA(promptCopilot, "");

  return new Response(
    JSON.stringify({ resposta }),
    {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}if (modoCopilot) {
  const promptCopilot = `
Você é o APPIA Copilot, especialista em criação de anúncios para Mercado Livre, Shopee e e-commerce.

Tipo solicitado:
${tipo}

Produto informado:
${mensagem}

Responda de acordo com o tipo solicitado.

Se tipo = "titulo":
Retorne apenas um título otimizado.

Se tipo = "descricao":
Retorne apenas uma descrição profissional.

Se tipo = "aplicacao":
Retorne apenas a aplicação e observações de compatibilidade.

Se tipo = "foto":
Retorne apenas instruções para gerar uma foto marketplace.

Se tipo = "banner":
Retorne apenas uma ideia de banner.

Se tipo = "video":
Retorne apenas um roteiro curto para vídeo.

Se tipo = "oem":
Retorne apenas orientações sobre código OEM.

Se tipo = "equivalencia":
Retorne apenas orientações sobre equivalências.

Se tipo = "completo":
Retorne:
🏷️ Título
📝 Descrição
🚗 Aplicação
🔑 Palavras-chave
📸 Sugestão de Foto
🎨 Sugestão de Banner
⚠️ Observações

Nunca diga "não encontrei na base".
Nunca invente códigos OEM.
Nunca garanta compatibilidade sem confirmação.
Sempre recomende conferir a peça antiga ou o chassi quando necessário.
`;

  const resposta = await gerarRespostaIA(promptCopilot, "");

  return new Response(
    JSON.stringify({ resposta }),
    {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}
    const contexto = await extrairContexto(mensagem);
    const tipoConsulta = classificarConsulta(contexto);

    const codigoBusca = contexto.codigo || "";

    const equivalencias = codigoBusca
      ? await buscarEquivalencias(codigoBusca)
      : [];

    const codigosEquivalentes = equivalencias.flatMap((item: any) => [
      item.codigo_principal,
      item.codigo_equivalente,
    ]);

    const resultadosCatalogo = await buscarCatalogo(
      contexto,
      codigosEquivalentes
    );

    let resposta = montarRespostaCatalogo(resultadosCatalogo, contexto);

    if (resultadosCatalogo.length === 0 && equivalencias.length === 0) {
      const contextoIA = montarContextoIA(
        contexto,
        tipoConsulta,
        codigoBusca,
        resultadosCatalogo,
        equivalencias
      );

      resposta = await gerarRespostaIA(
        mensagem,
        JSON.stringify(contextoIA, null, 2)
      );
    }

    if (equivalencias.length > 0) {
      const textoEquivalencias = equivalencias
        .map(
          (item: any, index: number) => `

🔄 Equivalência ${index + 1}

Código principal:
${item.codigo_principal || "-"}

Código equivalente:
${item.codigo_equivalente || "-"}

Fabricante:
${item.fabricante || "-"}

Descrição:
${item.descricao || "-"}

Observação:
${item.observacao || "-"}`
        )
        .join("\n");

      resposta = `🔎 Encontrei equivalências para o código informado.

${textoEquivalencias}

----------------------------------------

${resposta}`;
    }

    return new Response(
      JSON.stringify({
        resposta,
        contexto,
        codigoBusca,
        equivalencias,
        total_equivalencias: equivalencias.length,
        resultados_catalogo: resultadosCatalogo,
        total_resultados: resultadosCatalogo.length,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (erro) {
    console.log("ERRO ATENDIMENTO IA:", erro);

    const mensagemErro =
      erro instanceof Error
        ? `${erro.name}: ${erro.message}`
        : String(erro);

    return new Response(
      JSON.stringify({
        resposta: `❌ Erro ao processar atendimento IA.\n\nDetalhe técnico:\n${mensagemErro}`,
        erro: mensagemErro,
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