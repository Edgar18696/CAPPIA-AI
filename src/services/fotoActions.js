function esperar(ms) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

function obterMensagemErro(
  dados,
  status
) {
  return (
    dados?.erro ||
    dados?.error ||
    dados?.message ||
    `Erro HTTP ${status}`
  );
}

function erroTemporario(
  status,
  mensagem
) {
  const texto = String(
    mensagem || ""
  ).toLowerCase();

  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    status === 520 ||
    texto.includes("throttled") ||
    texto.includes("rate limit") ||
    texto.includes("timeout") ||
    texto.includes("network") ||
    texto.includes("failed to fetch")
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

  const maximo = 4;
  let ultimoErro = null;
    for (
    let tentativa = 1;
    tentativa <= maximo;
    tentativa++
  ) {
    try {

      console.log(
        "FOTO IA — REQUISIÇÃO:",
        body
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
      } catch {
        dados = {};
      }

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
        erroTemporario(
          resposta.status,
          mensagem
        ) &&
        tentativa < maximo
      ) {

        const espera =
          tentativa * 15000;

        console.warn(
          `Tentativa ${tentativa} falhou. Nova tentativa em ${espera / 1000}s`
        );

        await esperar(
          espera
        );

        continue;
      }

      throw new Error(
        mensagem
      );

    } catch (erro) {

      ultimoErro = erro;

      const mensagem =
        String(
          erro?.message ||
          erro
        );

      if (
        erroTemporario(
          0,
          mensagem
        ) &&
        tentativa < maximo
      ) {

        const espera =
          tentativa * 15000;

        console.warn(
          `Falha ${tentativa}. Tentando novamente...`
        );

        await esperar(
          espera
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
    throw new Error(
      error.message ||
      "A foto foi processada, mas não entrou na Galeria."
    );
  }

  return {
    sucesso: true,
  };
}