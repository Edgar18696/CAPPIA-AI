/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

const DURACAO_PADRAO_VIDEO = 10;

const MARGEM_FINAL_SEGUNDOS = 0.8;

const VELOCIDADE_BASE = 1.20;

const VELOCIDADE_MINIMA = 0.95;

const VELOCIDADE_MAXIMA = 1.55;

function jsonResponse(
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
          "application/json",
      },
    }
  );
}

function limitar(
  valor: number,
  minimo: number,
  maximo: number
) {
  return Math.min(
    maximo,
    Math.max(
      minimo,
      valor
    )
  );
}

function lerTextoAscii(
  bytes: Uint8Array,
  inicio: number,
  tamanho: number
) {
  return new TextDecoder(
    "ascii"
  ).decode(
    bytes.slice(
      inicio,
      inicio + tamanho
    )
  );
}

/*
 * =====================================================
 * DURAÇÃO REAL DO WAV
 * =====================================================
 *
 * A OpenAI pode devolver WAV em streaming com o tamanho
 * do bloco DATA marcado como 0xFFFFFFFF.
 *
 * Por isso NÃO podemos confiar cegamente no tamanho
 * informado no header.
 *
 * Quando isso acontecer usamos o tamanho real recebido.
 */

function obterDuracaoWav(
  buffer: ArrayBuffer
) {
  const bytes =
    new Uint8Array(
      buffer
    );

  if (bytes.length < 44) {
    throw new Error(
      "O áudio WAV retornado é inválido."
    );
  }

  const view =
    new DataView(
      buffer
    );

  const riff =
    lerTextoAscii(
      bytes,
      0,
      4
    );

  const wave =
    lerTextoAscii(
      bytes,
      8,
      4
    );

  if (
    riff !== "RIFF" ||
    wave !== "WAVE"
  ) {
    throw new Error(
      "O áudio retornado não está em formato WAV válido."
    );
  }

  let posicao = 12;

  let fmtInicio = -1;
  let fmtTamanho = 0;

  let dataInicio = -1;
  let dataTamanhoCabecalho = 0;

  while (
    posicao + 8 <=
    bytes.length
  ) {
    const id =
      lerTextoAscii(
        bytes,
        posicao,
        4
      );

    const tamanho =
      view.getUint32(
        posicao + 4,
        true
      );

    const inicioConteudo =
      posicao + 8;

    if (id === "fmt ") {
      fmtInicio =
        inicioConteudo;

      fmtTamanho =
        tamanho;
    }

    if (id === "data") {
      dataInicio =
        inicioConteudo;

      dataTamanhoCabecalho =
        tamanho;

      break;
    }

    const tamanhoSeguro =
      Math.min(
        tamanho,
        Math.max(
          0,
          bytes.length -
            inicioConteudo
        )
      );

    posicao =
      inicioConteudo +
      tamanhoSeguro +
      (tamanhoSeguro % 2);
  }

  if (
    fmtInicio < 0 ||
    fmtTamanho < 16
  ) {
    throw new Error(
      "Bloco fmt do WAV não encontrado."
    );
  }

  if (
    dataInicio < 0
  ) {
    throw new Error(
      "Bloco DATA do WAV não encontrado."
    );
  }

  const byteRate =
    view.getUint32(
      fmtInicio + 8,
      true
    );

  if (!byteRate) {
    throw new Error(
      "Não foi possível identificar a taxa do áudio WAV."
    );
  }

  const bytesDisponiveis =
    Math.max(
      0,
      bytes.length -
        dataInicio
    );

  /*
   * 0xFFFFFFFF é comum em WAV produzido por streaming.
   * Também ignoramos qualquer tamanho maior que o
   * conteúdo realmente recebido.
   */

  const tamanhoDataValido =
    dataTamanhoCabecalho ===
      0xffffffff ||
    dataTamanhoCabecalho >
      bytesDisponiveis
      ? bytesDisponiveis
      : dataTamanhoCabecalho;

  if (
    tamanhoDataValido <= 0
  ) {
    throw new Error(
      "O WAV não contém dados de áudio válidos."
    );
  }

  const duracao =
    tamanhoDataValido /
    byteRate;

  if (
    !Number.isFinite(
      duracao
    ) ||
    duracao <= 0 ||
    duracao > 600
  ) {
    throw new Error(
      "Não foi possível calcular uma duração válida para o áudio."
    );
  }

  return duracao;
}

async function gerarAudioOpenAI({
  texto,
  velocidade,
  openaiApiKey,
}: {
  texto: string;
  velocidade: number;
  openaiApiKey: string;
}) {
  console.log(
    "🎙️ Gerando voz:",
    {
      velocidade,
      caracteres:
        texto.length,
    }
  );

  const resposta =
    await fetch(
      "https://api.openai.com/v1/audio/speech",
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${openaiApiKey}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            model:
              "gpt-4o-mini-tts",

            voice:
              "cedar",

            input:
              texto,

            instructions:
              [
                "Fale em português do Brasil.",
                "Voz masculina, jovem, simpática, confiante, natural e comercial.",
                "Dicção clara e energia positiva.",
                "Evite pausas longas entre as frases.",
                "Faça uma apresentação dinâmica para redes sociais.",
                "Finalize a última frase de maneira natural e completa.",
              ].join(" "),

            response_format:
              "wav",

            speed:
              velocidade,
          }),
      }
    );

  if (!resposta.ok) {
    const detalhe =
      await resposta.text();

    console.error(
      "ERRO OPENAI TTS:",
      detalhe
    );

    throw new Error(
      "Não foi possível gerar a voz do Paizinho."
    );
  }

  const buffer =
    await resposta.arrayBuffer();

  const duracao =
    obterDuracaoWav(
      buffer
    );

  console.log(
    "⏱️ Duração real:",
    duracao.toFixed(2),
    "segundos"
  );

  return {
    buffer,
    duracao,
    velocidade,
  };
}

/*
 * =====================================================
 * ROTEIRO INTELIGENTE
 * =====================================================
 *
 * Só entra aqui quando o roteiro é grande demais para
 * caber naturalmente no tempo mesmo usando a velocidade
 * máxima permitida.
 */

async function reduzirRoteiroParaTempo({
  texto,
  segundosAlvo,
  openaiApiKey,
}: {
  texto: string;
  segundosAlvo: number;
  openaiApiKey: string;
}) {
  const palavrasAlvo =
    Math.max(
      8,
      Math.floor(
        segundosAlvo *
          2.55
      )
    );

  console.log(
    "✂️ Ajustando roteiro:",
    {
      palavrasAlvo,
      segundosAlvo,
    }
  );

  const resposta =
    await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${openaiApiKey}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            model:
              "gpt-4o-mini",

            temperature:
              0.3,

            messages: [
              {
                role:
                  "system",

                content:
                  [
                    "Você ajusta roteiros publicitários curtos em português do Brasil.",
                    "Preserve a mensagem principal, marca, produto, benefício e chamada final.",
                    "Não invente informações.",
                    "Não coloque aspas.",
                    "Não explique o que fez.",
                    "Entregue somente o roteiro final.",
                  ].join(" "),
              },
              {
                role:
                  "user",

                content:
                  [
                    `Reduza o roteiro abaixo para aproximadamente ${palavrasAlvo} palavras.`,
                    `Ele será falado em cerca de ${segundosAlvo.toFixed(
                      1
                    )} segundos.`,
                    "A última frase precisa terminar completa.",
                    "",
                    texto,
                  ].join("\n"),
              },
            ],
          }),
      }
    );

  if (!resposta.ok) {
    const detalhe =
      await resposta.text();

    console.error(
      "ERRO AJUSTAR ROTEIRO:",
      detalhe
    );

    /*
     * Não derrubamos a geração.
     * Se a redução falhar, continuamos com o original.
     */

    return texto;
  }

  const data =
    await resposta.json();

  const ajustado =
    String(
      data?.choices?.[0]
        ?.message?.content ||
        ""
    ).trim();

  return (
    ajustado ||
    texto
  );
}

async function salvarAudioNoStorage({
  audioBuffer,
  supabaseUrl,
  serviceRoleKey,
}: {
  audioBuffer: ArrayBuffer;
  supabaseUrl: string;
  serviceRoleKey: string;
}) {
  if (
    !audioBuffer ||
    audioBuffer.byteLength ===
      0
  ) {
    throw new Error(
      "A voz do Paizinho foi gerada vazia."
    );
  }

  const nomeArquivo =
    `audios/${Date.now()}-paizinho-${crypto.randomUUID()}.wav`;

  const audioBlob =
    new Blob(
      [
        audioBuffer,
      ],
      {
        type:
          "audio/wav",
      }
    );

  const uploadResposta =
    await fetch(
      `${supabaseUrl}/storage/v1/object/imagens/${nomeArquivo}`,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${serviceRoleKey}`,

          apikey:
            serviceRoleKey,

          "Content-Type":
            "audio/wav",

          "x-upsert":
            "true",
        },

        body:
          audioBlob,
      }
    );

  if (!uploadResposta.ok) {
    const detalhe =
      await uploadResposta.text();

    console.error(
      "ERRO UPLOAD ÁUDIO:",
      detalhe
    );

    throw new Error(
      "A voz foi criada, mas não foi possível salvá-la no Storage."
    );
  }

  return (
    `${supabaseUrl}/storage/v1/object/public/imagens/${nomeArquivo}`
  );
}

Deno.serve(async (req) => {
  if (
    req.method ===
    "OPTIONS"
  ) {
    return new Response(
      "ok",
      {
        headers:
          corsHeaders,
      }
    );
  }

  if (
    req.method !==
    "POST"
  ) {
    return jsonResponse(
      {
        sucesso:
          false,

        erro:
          "Método não permitido. Use POST.",
      },
      405
    );
  }

  try {
    const {
      fala = "",
      descricao = "",
      duracaoVideo = DURACAO_PADRAO_VIDEO,
    } =
      await req.json();

    const textoOriginal =
      String(
        fala ||
        descricao ||
        ""
      ).trim();

    if (!textoOriginal) {
      return jsonResponse(
        {
          sucesso:
            false,

          erro:
            "A fala ou descrição do Paizinho é obrigatória.",
        },
        400
      );
    }

    const duracaoVideoFinal =
      limitar(
        Number(
          duracaoVideo ||
            DURACAO_PADRAO_VIDEO
        ),
        4,
        60
      );

    const duracaoAlvo =
      Math.max(
        3,
        duracaoVideoFinal -
          MARGEM_FINAL_SEGUNDOS
      );

    const openaiApiKey =
      Deno.env.get(
        "OPENAI_API_KEY"
      );

    const serviceRoleKey =
      Deno.env.get(
        "SERVICE_ROLE_KEY"
      ) ||
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      );

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL"
      ) ||
      "https://arqzpqkkpwikyecdbopf.supabase.co";

    if (!openaiApiKey) {
      throw new Error(
        "OPENAI_API_KEY não configurada nos Secrets."
      );
    }

    if (!serviceRoleKey) {
      throw new Error(
        "SERVICE_ROLE_KEY não configurado nos Secrets."
      );
    }

    console.log(
      "🤖 Motor de fala inteligente PAIIA"
    );

    console.log(
      "🎯 Duração do vídeo:",
      duracaoVideoFinal
    );

    console.log(
      "🎯 Duração alvo da voz:",
      duracaoAlvo
    );

    let textoFinal =
      textoOriginal;

    /*
     * =================================================
     * PRIMEIRA GERAÇÃO
     * =================================================
     */

    let audio =
      await gerarAudioOpenAI({
        texto:
          textoFinal,

        velocidade:
          VELOCIDADE_BASE,

        openaiApiKey,
      });

    /*
     * =================================================
     * SE ESTOUROU O TEMPO
     * =================================================
     */

    if (
      audio.duracao >
      duracaoAlvo +
        0.15
    ) {
      const velocidadeNecessaria =
        VELOCIDADE_BASE *
        (
          audio.duracao /
          duracaoAlvo
        );

      /*
       * Se ainda cabe aumentando a velocidade sem
       * deixar a voz artificial, geramos novamente.
       */

      if (
        velocidadeNecessaria <=
        VELOCIDADE_MAXIMA
      ) {
        const velocidadeAjustada =
          limitar(
            velocidadeNecessaria,
            VELOCIDADE_BASE,
            VELOCIDADE_MAXIMA
          );

        console.log(
          "⚡ Ajustando velocidade:",
          velocidadeAjustada.toFixed(
            2
          )
        );

        audio =
          await gerarAudioOpenAI({
            texto:
              textoFinal,

            velocidade:
              velocidadeAjustada,

            openaiApiKey,
          });
      } else {
        /*
         * Texto grande demais.
         * Reduzimos o roteiro primeiro.
         */

        textoFinal =
          await reduzirRoteiroParaTempo({
            texto:
              textoFinal,

            segundosAlvo:
              duracaoAlvo,

            openaiApiKey,
          });

        audio =
          await gerarAudioOpenAI({
            texto:
              textoFinal,

            velocidade:
              VELOCIDADE_BASE,

            openaiApiKey,
          });

        /*
         * Um último ajuste leve de velocidade.
         */

        if (
          audio.duracao >
          duracaoAlvo +
            0.25
        ) {
          const novaVelocidade =
            limitar(
              VELOCIDADE_BASE *
                (
                  audio.duracao /
                  duracaoAlvo
                ),
              VELOCIDADE_BASE,
              VELOCIDADE_MAXIMA
            );

          audio =
            await gerarAudioOpenAI({
              texto:
                textoFinal,

              velocidade:
                novaVelocidade,

              openaiApiKey,
            });
        }
      }
    }

    /*
     * =================================================
     * SE FICOU CURTO DEMAIS
     * =================================================
     *
     * Não acrescentamos silêncio.
     * Apenas diminuímos levemente a velocidade.
     */

    if (
  audio.duracao <
  duracaoAlvo -
    0.4
) {
      const velocidadeNecessaria =
        audio.velocidade *
        (
          audio.duracao /
          duracaoAlvo
        );

      const velocidadeAjustada =
        limitar(
          velocidadeNecessaria,
          VELOCIDADE_MINIMA,
          audio.velocidade
        );

      if (
        Math.abs(
          velocidadeAjustada -
            audio.velocidade
        ) >= 0.04
      ) {
        console.log(
          "🐢 Ajustando voz curta:",
          velocidadeAjustada.toFixed(
            2
          )
        );

        audio =
          await gerarAudioOpenAI({
            texto:
              textoFinal,

            velocidade:
              velocidadeAjustada,

            openaiApiKey,
          });
      }
    }

    const audioUrl =
      await salvarAudioNoStorage({
        audioBuffer:
          audio.buffer,

        supabaseUrl,

        serviceRoleKey,
      });

    const dentroDoAlvo =
  audio.duracao <=
    duracaoAlvo +
      0.25 &&
  audio.duracao >=
    duracaoAlvo -
      0.4;

    console.log(
      "✅ Voz PAIIA pronta:",
      {
        duracao:
          audio.duracao.toFixed(
            2
          ),

        velocidade:
          audio.velocidade,

        dentroDoAlvo,
      }
    );

    return jsonResponse({
      sucesso:
        true,

      audio_url:
        audioUrl,

      audio:
        audioUrl,

      fala_original:
        textoOriginal,

      fala_final:
        textoFinal,

      roteiro_ajustado:
        textoFinal !==
        textoOriginal,

      duracao_video:
        duracaoVideoFinal,

      duracao_alvo:
        duracaoAlvo,

      duracao_audio:
        Number(
          audio.duracao.toFixed(
            2
          )
        ),

      velocidade:
        Number(
          audio.velocidade.toFixed(
            2
          )
        ),

      sincronizacao:
        dentroDoAlvo
          ? "APROVADA"
          : "REVISAR",
    });
  } catch (error) {
    console.error(
      "ERRO GERAR VOZ PAIZINHO:",
      error
    );

    return jsonResponse(
      {
        sucesso:
          false,

        erro:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao gerar a voz do Paizinho.",
      },
      400
    );
  }
});