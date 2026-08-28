import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  GoogleGenAI,
  GenerateVideosOperation,
} from "npm:@google/genai";

import {
  createClient,
} from "https://esm.sh/@supabase/supabase-js@2";

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

function texto(
  valor: unknown
) {
  return String(
    valor ?? ""
  ).trim();
}

async function obterUsuarioId(
  req: Request
) {
  try {
    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL"
      );

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      ) ||
      Deno.env.get(
        "SERVICE_ROLE_KEY"
      );

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      return null;
    }

    const authorization =
      req.headers.get(
        "Authorization"
      ) ||
      req.headers.get(
        "authorization"
      ) ||
      "";

    const token =
      authorization
        .replace(
          /^Bearer\s+/i,
          ""
        )
        .trim();

    if (!token) {
      return null;
    }

    const admin =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );

    const {
      data,
      error,
    } =
      await admin.auth.getUser(
        token
      );

    if (
      error ||
      !data?.user?.id
    ) {
      console.warn(
        "⚠️ Não foi possível identificar usuário do Mascote IA:",
        error?.message ||
          "usuário não encontrado"
      );

      return null;
    }

    return data.user.id;
  } catch (erro) {
    console.warn(
      "⚠️ Erro ao identificar usuário:",
      erro
    );

    return null;
  }
}

async function baixarESalvarVideo({
  videoUri,
  apiKey,
  usuarioId,
}: {
  videoUri: string;
  apiKey: string;
  usuarioId: string | null;
}) {
  /*
   * ========================================================
   * 1. BAIXAR MP4 DIRETAMENTE DO GOOGLE
   * ========================================================
   *
   * A URL retornada pelo Veo exige a
   * GEMINI_API_KEY no header.
   */

  console.log(
    "⬇️ BAIXANDO VÍDEO DO VEO..."
  );

  const respostaVideo =
    await fetch(
      videoUri,
      {
        method: "GET",

        headers: {
          "x-goog-api-key":
            apiKey,
        },

        redirect:
          "follow",
      }
    );

  if (
    !respostaVideo.ok
  ) {
    const detalhe =
      await respostaVideo
        .text()
        .catch(
          () => ""
        );

    throw new Error(
      `Não foi possível baixar o vídeo do Veo (${respostaVideo.status}). ${detalhe}`
    );
  }

  const arrayBuffer =
    await respostaVideo
      .arrayBuffer();

  if (
    !arrayBuffer
      .byteLength
  ) {
    throw new Error(
      "O Veo retornou um arquivo de vídeo vazio."
    );
  }

  console.log(
    "✅ VÍDEO VEO BAIXADO:",
    {
      bytes:
        arrayBuffer.byteLength,
    }
  );

  /*
   * ========================================================
   * 2. SUPABASE STORAGE
   * ========================================================
   */

  const supabaseUrl =
    Deno.env.get(
      "SUPABASE_URL"
    );

  const serviceRoleKey =
    Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    ) ||
    Deno.env.get(
      "SERVICE_ROLE_KEY"
    );

  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    throw new Error(
      "Credenciais administrativas do Supabase não configuradas."
    );
  }

  const admin =
    createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession:
            false,

          autoRefreshToken:
            false,
        },
      }
    );

  const dono =
    usuarioId ||
    "mascotes";

  const caminho =
    `${dono}/marketing/mascotes/veo-${Date.now()}-${crypto.randomUUID()}.mp4`;

  console.log(
    "💾 SALVANDO MASCOTE NO STORAGE:",
    caminho
  );

  const {
    error:
      erroUpload,
  } =
    await admin.storage
      .from("imagens")
      .upload(
        caminho,
        arrayBuffer,
        {
          contentType:
            "video/mp4",

          upsert:
            false,
        }
      );

  if (erroUpload) {
    throw new Error(
      "O vídeo foi criado pelo Veo, mas não foi possível salvá-lo no Storage: " +
        erroUpload.message
    );
  }

  /*
   * ========================================================
   * 3. URL PÚBLICA PERMANENTE
   * ========================================================
   */

  const {
    data:
      dadosPublicos,
  } =
    admin.storage
      .from("imagens")
      .getPublicUrl(
        caminho
      );

  const urlPublica =
    texto(
      dadosPublicos
        ?.publicUrl
    );

  if (
    !/^https?:\/\//i
      .test(
        urlPublica
      )
  ) {
    throw new Error(
      "O vídeo foi salvo, mas não foi possível gerar a URL pública."
    );
  }

  console.log(
    "✅ MASCOTE SALVO NO PAIIA:",
    urlPublica
  );

  return {
    urlPublica,
    caminho,
    tamanho:
      arrayBuffer.byteLength,
  };
}

Deno.serve(
  async (
    req
  ) => {
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
      return resposta(
        {
          sucesso: false,

          erro:
            "Método não permitido.",
        },
        405
      );
    }

    try {
      /*
       * ====================================================
       * CONFIGURAÇÃO
       * ====================================================
       */

      const apiKey =
        Deno.env.get(
          "GEMINI_API_KEY"
        );

      if (!apiKey) {
        return resposta(
          {
            sucesso:
              false,

            erro:
              "GEMINI_API_KEY não configurada no Supabase.",
          },
          500
        );
      }

      const body =
        await req.json();

      const operationName =
        texto(
          body
            ?.operation_name ||
          body
            ?.operationName
        );

      if (
        !operationName
      ) {
        return resposta(
          {
            sucesso:
              false,

            erro:
              "operation_name não informado.",
          },
          400
        );
      }

      console.log(
        "🔎 CONSULTANDO MASCOTE VEO:",
        operationName
      );

      /*
       * ====================================================
       * CLIENTE GEMINI
       * ====================================================
       */

      const ai =
        new GoogleGenAI({
          apiKey,
        });

      /*
       * Reconstrói corretamente
       * a operação pelo ID.
       */

      const operationBase =
        new GenerateVideosOperation();

      operationBase.name =
        operationName;

      const operation =
        await ai.operations
          .getVideosOperation({
            operation:
              operationBase,
          });

      console.log(
        "📡 STATUS VEO:",
        {
          operationName,

          done:
            Boolean(
              operation
                ?.done
            ),

          possuiErro:
            Boolean(
              operation
                ?.error
            ),

          possuiResposta:
            Boolean(
              operation
                ?.response
            ),
        }
      );

      /*
       * ====================================================
       * AINDA PROCESSANDO
       * ====================================================
       */

      if (
        !operation?.done
      ) {
        return resposta({
          sucesso:
            true,

          concluido:
            false,

          processando:
            true,

          operation_name:
            operationName,

          mensagem:
            "O vídeo do mascote ainda está sendo gerado.",
        });
      }

      /*
       * ====================================================
       * ERRO DO VEO
       * ====================================================
       */

      if (
        operation?.error
      ) {
        const mensagem =
          texto(
            (
              operation
                .error as any
            )?.message
          ) ||
          "O Veo não conseguiu gerar o vídeo.";

        console.error(
          "❌ VEO FINALIZOU COM ERRO:",
          operation.error
        );

        return resposta(
          {
            sucesso:
              false,

            concluido:
              true,

            operation_name:
              operationName,

            erro:
              mensagem,
          },
          502
        );
      }

      /*
       * ====================================================
       * LOCALIZAR VÍDEO
       * ====================================================
       */

      const videos =
        operation
          ?.response
          ?.generatedVideos ||
        [];

      const primeiroVideo =
        videos[0];

      const video =
        primeiroVideo
          ?.video;

      if (!video) {
        console.error(
          "❌ OPERAÇÃO CONCLUÍDA SEM VÍDEO:",
          operation
            ?.response
        );

        return resposta(
          {
            sucesso:
              false,

            concluido:
              true,

            operation_name:
              operationName,

            erro:
              "A geração terminou, mas nenhum vídeo foi retornado.",
          },
          502
        );
      }

      const videoUri =
        texto(
          (
            video as any
          )?.uri
        );

      if (!videoUri) {
        return resposta(
          {
            sucesso:
              false,

            concluido:
              true,

            operation_name:
              operationName,

            erro:
              "O Veo concluiu a geração, mas não retornou a URI do vídeo.",
          },
          502
        );
      }

      /*
       * ====================================================
       * IDENTIFICAR USUÁRIO
       * ====================================================
       */

      const usuarioId =
        await obterUsuarioId(
          req
        );

      /*
       * ====================================================
       * GOOGLE → SUPABASE
       * ====================================================
       */

      const salvo =
        await baixarESalvarVideo({
          videoUri,
          apiKey,
          usuarioId,
        });

      /*
       * ====================================================
       * RESULTADO FINAL
       * ====================================================
       */

      console.log(
        "🎉 MASCOTE IA FINALIZADO:",
        {
          operationName,

          usuarioId,

          url:
            salvo
              .urlPublica,

          bytes:
            salvo
              .tamanho,
        }
      );

      return resposta({
        sucesso:
          true,

        concluido:
          true,

        processando:
          false,

        operation_name:
          operationName,

        /*
         * IMPORTANTE:
         * Agora esta é a URL
         * permanente do Supabase,
         * não a temporária do Google.
         */
        video_url:
          salvo.urlPublica,

        video_base64:
          null,

        mime_type:
          "video/mp4",

        storage_path:
          salvo.caminho,

        tamanho_bytes:
          salvo.tamanho,

        mensagem:
          "Vídeo do mascote concluído e salvo no PAIIA.",
      });
    } catch (
      erro
    ) {
      console.error(
        "❌ ERRO CONSULTAR MASCOTE VEO:",
        erro
      );

      return resposta(
        {
          sucesso:
            false,

          erro:
            erro instanceof
            Error
              ? erro.message
              : String(
                  erro
                ),
        },
        500
      );
    }
  }
);