function esperar(ms) {
  return new Promise(
    (resolve) => setTimeout(resolve, ms)
  );
}

function obterMensagemErro(
  dados,
  status
) {
  return (
    dados?.erro ||
    dados?.error ||
    dados?.detalhes ||
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
    texto.includes("temporarily") ||
    texto.includes("failed to fetch")
  );
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
  if (!urlImagem) {
    throw new Error(
      "Envie uma imagem antes de processar."
    );
  }

  const fundoTransparente =
    tipoFundoFoto === "transparente";

  const instrucoesFundo =
    fundoTransparente
      ? [
          "Remover completamente o fundo original.",
          "Entregar somente o produto recortado.",
          "O fundo deve possuir transparência real com canal alfa.",
          "Não aplicar fundo branco, cinza, quadriculado ou qualquer cor.",
          "Não desenhar uma simulação de transparência.",
          "Exportar obrigatoriamente em PNG transparente.",
          "Preservar os espaços transparentes ao redor da peça.",
        ]
      : [
          "Remover completamente o fundo original.",
          "Aplicar fundo branco puro #FFFFFF.",
          "Não aplicar fundo cinza, degradê ou textura.",
        ];

  const instrucoesQualidade =
    qualidadeFoto === "standard"
      ? "Aplicar processamento rápido, mantendo boa qualidade e fidelidade."
      : qualidadeFoto === "ultra"
        ? "Aplicar máxima qualidade de recorte, nitidez e acabamento, preservando todos os detalhes reais da peça."
        : "Aplicar alta qualidade de recorte, nitidez e acabamento profissional.";

  const corpoRequisicao = {
    imageUrl: urlImagem,
    tipo: "foto",
    categoria: categoriaFoto,
    fundo: tipoFundoFoto,

    formatoSaida:
      fundoTransparente
        ? "png"
        : "jpg",

    preservarTransparencia:
      fundoTransparente,

    qualidade:
      qualidadeFoto,

    tamanho:
      tamanhoFoto ||
      "1200x1200",

    instrucoes: [
  "Editar exclusivamente a fotografia enviada.",
  "O produto final deve ser exatamente a mesma peça da imagem original.",
  "Não substituir a peça por outro produto.",
  "Não reinterpretar, redesenhar ou gerar uma nova peça.",
  "Não alterar formato, estrutura, quantidade de componentes, furos, conectores, parafusos, suportes, gravações ou proporções.",
  "Preservar fielmente todos os detalhes visuais reais do produto.",

  "Identificar como produto principal apenas a peça automotiva em primeiro plano.",
  "Ignorar completamente embalagens, etiquetas, rótulos, papéis, textos impressos, caixas, sacos plásticos, bancadas, mesas e objetos de fundo.",
  "Não considerar o rótulo, a embalagem ou qualquer texto impresso como parte da peça.",
  "Mesmo quando a peça estiver apoiada sobre uma etiqueta, embalagem ou papel, recortar somente a peça.",
  "Remover todo rótulo, texto, marca, logotipo, embalagem e material que esteja atrás ou embaixo da peça.",
  "Preservar somente gravações, códigos e marcas que estejam fisicamente na própria peça.",

  "Realizar somente remoção de fundo, enquadramento, centralização, iluminação, contraste e nitidez.",
  "Remover completamente o fundo original.",

  fundoTransparente
    ? "Aplicar transparência real ao redor da mesma peça e exportar em PNG."
    : "Aplicar fundo branco puro #FFFFFF atrás da mesma peça.",

  "Centralizar a peça original sem cortar nenhuma extremidade.",
  "Redimensionar proporcionalmente para ocupar aproximadamente 80% da imagem.",
  "Não criar textos, logotipos, etiquetas, códigos ou objetos adicionais.",
  "Não apagar detalhes da peça.",
  "Não suavizar ou modificar a geometria do produto.",
  "Entregar imagem quadrada em 1200x1200.",
  "O resultado deve parecer uma fotografia profissional da mesma peça original, nunca uma nova imagem gerada.",

  instrucoesQualidade,
].join(" "),
 };
  const maximoTentativas = 4;
  let ultimoErro = null;

  for (
    let tentativa = 1;
    tentativa <= maximoTentativas;
    tentativa++
  ) {
    try {
      const respostaApi =
        await fetchFn(
          apiProcessarImagem,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              apikey:
                supabaseKey,

              Authorization:
                `Bearer ${supabaseKey}`,
            },

            body:
              JSON.stringify(
                corpoRequisicao
              ),
          }
        );

      let dados = {};

      try {
        dados =
          await respostaApi.json();
      } catch {
        dados = {};
      }

      const mensagemErro =
        obterMensagemErro(
          dados,
          respostaApi.status
        );

      if (
        respostaApi.ok &&
        dados?.imagem_processada
      ) {
        return {
          imagemProcessada:
            dados.imagem_processada,

          fundoTransparente,

          dados,
        };
      }

      if (
        erroTemporario(
          respostaApi.status,
          mensagemErro
        ) &&
        tentativa <
          maximoTentativas
      ) {
        const espera =
          tentativa * 15000;

        console.warn(
          `Tentativa ${tentativa} falhou. Nova tentativa em ${espera / 1000}s.`,
          {
            status:
              respostaApi.status,

            mensagem:
              mensagemErro,
          }
        );

        await esperar(
          espera
        );

        continue;
      }

      throw new Error(
        mensagemErro
      );
    } catch (erro) {
      ultimoErro = erro;

      const mensagem =
        String(
          erro?.message ||
          erro ||
          ""
        );

      const temporario =
        erroTemporario(
          0,
          mensagem
        );

      if (
        temporario &&
        tentativa <
          maximoTentativas
      ) {
        const espera =
          tentativa * 15000;

        console.warn(
          `Falha de rede na tentativa ${tentativa}. Nova tentativa em ${espera / 1000}s.`,
          erro
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
      "Não foi possível processar a imagem."
    )
  );
}