import { supabase } from "../supabase";

function limparJson(valor) {
  const texto = String(valor || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const inicio = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");

  if (inicio !== -1 && fim !== -1 && fim > inicio) {
    return texto.slice(inicio, fim + 1);
  }

  return texto;
}

async function lerErroEdgeFunction(error) {
  let detalhe =
    error?.message || "Erro ao interpretar o catálogo.";

  try {
    if (error?.context) {
      const textoErro = await error.context.text();

      if (textoErro) {
        try {
          const jsonErro = JSON.parse(textoErro);

          detalhe =
            jsonErro?.mensagem ||
            jsonErro?.message ||
            jsonErro?.error ||
            textoErro;
        } catch {
          detalhe = textoErro;
        }
      }
    }
  } catch (erroLeitura) {
    console.error(
      "Erro ao ler resposta da Edge Function:",
      erroLeitura
    );
  }

  return detalhe;
}

export async function interpretarCatalogo(
  texto,
  nomeCatalogo
) {
  if (!String(texto || "").trim()) {
    return {
      pecas: [],
      aplicacoes: [],
    };
  }

  const { data, error } =
    await supabase.functions.invoke(
      "interpretar-texto",
      {
        body: {
          texto,
          nomeCatalogo:
            nomeCatalogo || "Catálogo técnico",
        },
      }
    );

  if (error) {
    console.error(
      "ERRO INTERPRETAR TEXTO:",
      error
    );

    const detalhe =
      await lerErroEdgeFunction(error);

    throw new Error(detalhe);
  }

  if (!data) {
    throw new Error(
      "A função interpretar-texto não retornou dados."
    );
  }

  if (data.sucesso === false) {
    throw new Error(
      data.mensagem ||
        "A IA não conseguiu interpretar o lote."
    );
  }

  const respostaLimpa = limparJson(
    data.resposta
  );
console.log(
  "RESPOSTA INTERPRETAR-TEXTO:",
  JSON.stringify(data, null, 2)
);

console.log(
  "RESPOSTA DA IA:",
  data.resposta
);
try {
  const resultado = JSON.parse(respostaLimpa);

  const registros = Array.isArray(resultado)
    ? resultado
    : Array.isArray(resultado?.registros)
    ? resultado.registros
    : Array.isArray(resultado?.itens)
    ? resultado.itens
    : [];

  const pecas = Array.isArray(resultado?.pecas)
    ? resultado.pecas
    : registros;

  const aplicacoes = Array.isArray(resultado?.aplicacoes)
    ? resultado.aplicacoes
    : [];

  console.log(
    "INTERPRETAÇÃO FINAL:",
    {
      pecas: pecas.length,
      aplicacoes: aplicacoes.length,
      registros: registros.length,
    }
  );

  return {
    pecas,
    aplicacoes,
    registros,
  };
} catch (erro) {
  console.error(
    "JSON INVÁLIDO DA IA:",
    respostaLimpa
  );

  throw new Error(
    "A IA retornou um JSON inválido."
  );
}
}