function esperar(ms) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

function obterMensagemErro(
  dados,
  status
) {
  if (
    status === 408 ||
    status === 524 ||
    status === 546
  ) {
    return `A API Foto IA expirou (HTTP ${status}). A conexão caiu antes da resposta.`;
  }

  return (
    dados?.erro ||
    dados?.error ||
    dados?.message ||
    `Erro HTTP ${status}`
  );
}

function statusPermiteUmaNovaTentativa(status) {
  return (
    status === 408 ||
    status === 429 ||
    status === 503 ||
    status === 524 ||
    status === 546
  );
}

function mensagemPermiteUmaNovaTentativa(mensagem) {
  const texto = String(mensagem || "").toLowerCase();

  return (
    /http (408|429|503|524|546)/i.test(texto) ||
    texto.includes("failed to fetch") ||
    texto.includes("networkerror") ||
    texto.includes("network error") ||
    texto.includes("rate limit") ||
    texto.includes("temporarily unavailable") ||
    texto.includes("timeout")
  );
}

function montarInstrucoes({
  fundoTransparente,
  qualidadeFoto,
  tamanhoFoto,
}) {
  return [
    "Editar exclusivamente a imagem enviada.",
    "Não alterar a peça.",
    "Não gerar outra peça.",
    "Remover somente o fundo.",
    fundoTransparente
      ? "Aplicar fundo transparente."
      : "Aplicar fundo branco puro #FFFFFF.",
    `Qualidade ${qualidadeFoto}.`,
    `Tamanho ${tamanhoFoto}.`,
    "Centralizar a peça.",
    "Preservar detalhes reais.",
  ].join(" ");
}

export async function processarFotoAction({
  fetchFn = fetch,
  apiProcessarImagem,
  supabaseKey,
  urlImagem,
  categoriaFoto,
  tipoFundoFoto,
  qualidadeFoto,
  tamanhoFoto,
  logContext = {},
}) {

  if (!apiProcessarImagem) {
    throw new Error(
      "API Foto IA não configurada."
    );
  }

  if (!urlImagem) {
    throw new Error(
      "Imagem não enviada."
    );
  }

  const fundoTransparente =
    tipoFundoFoto ===
    "transparente";

  const body = {
    imageUrl: urlImagem,
    tipo: "foto",
    categoria:
      categoriaFoto ||
      "autopecas",
    fundo:
      fundoTransparente
        ? "transparente"
        : "branco",
    qualidade:
      qualidadeFoto,
    tamanho:
      tamanhoFoto,
    instrucoes:
      montarInstrucoes({
        fundoTransparente,
        qualidadeFoto,
        tamanhoFoto,
      }),
  };

  const maximo = 3;
  let ultimoErro = null;
    for (
    let tentativa = 1;
    tentativa <= maximo;
    tentativa++
  ) {
    try {

      console.log(
        "FOTO IA — INÍCIO PROCESSAMENTO IA:",
        {
          ...logContext,
          tentativa,
          urlImagem,
          body,
        }
      );

      const resposta =
        await fetchFn(
          apiProcessarImagem,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              ...(supabaseKey
                ? {
                    apikey:
                      supabaseKey,

                    Authorization:
                      `Bearer ${supabaseKey}`,
                  }
                : {}),
            },

            body:
              JSON.stringify(
                body
              ),
          }
        );

      let dados = {};

      try {
        dados =
          await resposta.json();
      } catch (erroJson) {
        dados = {
          erro_parse_json: String(
            erroJson?.message || erroJson
          ),
        };
      }

      console.log(
        "FOTO IA — RESPOSTA PROCESSAMENTO IA:",
        {
          ...logContext,
          tentativa,
          statusHttp: resposta.status,
          ok: resposta.ok,
          respostaCompleta: dados,
        }
      );

      const mensagem =
        obterMensagemErro(
          dados,
          resposta.status
        );

      if (
        resposta.ok &&
        dados?.imagem_processada
      ) {
        return {
          sucesso: true,

          imagemProcessada:
            dados.imagem_processada,

          fundoTransparente,

          dados,
        };
      }

      if (
        statusPermiteUmaNovaTentativa(
          resposta.status
        ) &&
        tentativa < maximo
      ) {
        const esperaRetryMs =
          tentativa * 10000;

        console.warn(
          "FOTO IA — TENTATIVA FALHOU (temporário):",
          {
            ...logContext,
            tentativa,
            statusHttp: resposta.status,
            mensagem,
            esperaMs: esperaRetryMs,
            respostaCompleta: dados,
          }
        );

        await esperar(
          esperaRetryMs
        );

        continue;
      }

      throw new Error(
        `[HTTP ${resposta.status}] ${mensagem}`
      );

    } catch (erro) {

      ultimoErro = erro;
      console.error(
        "FOTO IA — ERRO PROCESSAMENTO IA:",
        {
          ...logContext,
          tentativa,
          erroCompleto: erro,
          mensagem: String(erro?.message || erro),
        }
      );

      const mensagem =
        String(
          erro?.message ||
          erro
        );

      if (
        mensagemPermiteUmaNovaTentativa(
          mensagem
        ) &&
        tentativa < maximo
      ) {
        const esperaRetryMs =
          tentativa * 10000;

        console.warn(
          "FOTO IA — TENTATIVA FALHOU (temporário):",
          {
            ...logContext,
            tentativa,
            mensagem,
            esperaMs: esperaRetryMs,
          }
        );

        await esperar(
          esperaRetryMs
        );

        continue;
      }

      throw erro;
    }
  }

  throw (
    ultimoErro ||
    new Error(
      "Não foi possível processar a foto."
    )
  );
}
export async function enviarFotoOriginalAction({
  supabase,
  usuario,
  arquivo,
  bucket = "imagens",
  logContext = {},
}) {
  if (!supabase) {
    throw new Error(
      "Cliente Supabase não informado."
    );
  }

  if (!usuario?.id) {
    throw new Error(
      "Faça login primeiro."
    );
  }

  if (!arquivo) {
    throw new Error(
      "Escolha uma imagem primeiro."
    );
  }

  const nomeSeguro =
    String(
      arquivo.name ||
      "foto.jpg"
    )
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(
        /[^a-zA-Z0-9._-]/g,
        "-"
      );

  const caminho =
    `${usuario.id}/originais/${Date.now()}-${crypto.randomUUID()}-${nomeSeguro}`;

  console.log("FOTO IA — INÍCIO UPLOAD:", {
    ...logContext,
    nomeArquivo: arquivo.name,
    caminho,
    tamanho: arquivo.size,
    tipo: arquivo.type,
  });

  const {
    error: erroUpload,
  } = await supabase.storage
    .from(bucket)
    .upload(
      caminho,
      arquivo,
      {
        upsert: false,

        contentType:
          arquivo.type ||
          undefined,
      }
    );

  if (erroUpload) {
    console.error("FOTO IA — ERRO UPLOAD:", {
      ...logContext,
      nomeArquivo: arquivo.name,
      caminho,
      erroCompleto: erroUpload,
    });
    throw new Error(
      erroUpload.message ||
      "Erro ao enviar a imagem."
    );
  }

  const {
    data,
  } = supabase.storage
    .from(bucket)
    .getPublicUrl(
      caminho
    );

  console.log("FOTO IA — RESPOSTA UPLOAD:", {
    ...logContext,
    nomeArquivo: arquivo.name,
    caminho,
    urlPublica: data?.publicUrl || null,
  });

  if (!data?.publicUrl) {
    throw new Error(
      "Não foi possível gerar a URL pública da imagem."
    );
  }

  return {
    caminho,

    urlPublica:
      data.publicUrl,
  };
}

export async function salvarFotoNaGaleriaAction({
  supabase,
  usuario,
  imagemOriginal,
  imagemProcessada,
  logContext = {},
}) {
  if (!supabase) {
    throw new Error(
      "Cliente Supabase não informado."
    );
  }

  if (!usuario?.id) {
    throw new Error(
      "Faça login primeiro."
    );
  }

  if (!imagemProcessada) {
    throw new Error(
      "Imagem processada não informada."
    );
  }

  console.log("FOTO IA — INÍCIO SALVAMENTO:", {
    ...logContext,
    imagemOriginal,
    imagemProcessada,
  });

  const {
        error,
      } = await supabase
    .from("processamentos")
    .insert([
      {
        imagem_original:
          imagemOriginal ||
          null,

        imagem_processada:
          imagemProcessada,

        status:
          "processado",

        user_id:
          usuario.id,

        tipo:
          "foto",
      },
    ]);

  if (error) {
    console.error("FOTO IA — ERRO SALVAMENTO:", {
      ...logContext,
      erroCompleto: error,
    });
    throw new Error(
      error.message ||
      "A foto foi processada, mas não entrou na Galeria."
    );
  }

  console.log("FOTO IA — SALVAMENTO OK:", {
    ...logContext,
    imagemOriginal,
    imagemProcessada,
  });

  return {
    sucesso: true,
  };
}
