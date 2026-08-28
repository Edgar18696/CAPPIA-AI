import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
  req: Request,
  supabaseUrl: string,
  serviceRoleKey: string
) {
  try {
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
            persistSession:
              false,

            autoRefreshToken:
              false,
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
      return null;
    }

    return data.user.id;
  } catch {
    return null;
  }
}

Deno.serve(
  async (req) => {
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
        return resposta(
          {
            sucesso: false,
            erro:
              "Credenciais administrativas do Supabase não configuradas.",
          },
          500
        );
      }

      const body =
        await req.json();

      const videoUrl =
        texto(
          body?.videoUrl ||
          body?.video_url ||
          body?.url
        );

      if (!videoUrl) {
        return resposta(
          {
            sucesso: false,
            erro:
              "URL do vídeo não informada.",
          },
          400
        );
      }

      if (
        !/^https?:\/\//i.test(
          videoUrl
        )
      ) {
        return resposta(
          {
            sucesso: false,
            erro:
              "URL do vídeo inválida.",
          },
          400
        );
      }

      console.log(
        "📱 PREPARANDO VÍDEO PARA WHATSAPP..."
      );

      /*
       * ==================================================
       * 1. BAIXAR O MP4 ORIGINAL
       * ==================================================
       */

      const respostaVideo =
        await fetch(
          videoUrl,
          {
            method:
              "GET",

            redirect:
              "follow",

            headers: {
              Accept:
                "video/mp4,video/*,*/*",
            },
          }
        );

      if (
        !respostaVideo.ok
      ) {
        throw new Error(
          `Não foi possível baixar o vídeo (${respostaVideo.status}).`
        );
      }

      const arrayBuffer =
        await respostaVideo
          .arrayBuffer();

      if (
        !arrayBuffer.byteLength
      ) {
        throw new Error(
          "O arquivo de vídeo está vazio."
        );
      }

      /*
       * ==================================================
       * 2. VALIDAÇÃO BÁSICA DE MP4
       * ==================================================
       */

      const bytes =
        new Uint8Array(
          arrayBuffer
        );

      if (
        bytes.length < 12
      ) {
        throw new Error(
          "Arquivo de vídeo inválido."
        );
      }

      /*
       * Arquivos MP4 normalmente
       * possuem a caixa FTYP
       * logo no início.
       */
      const assinatura =
        String.fromCharCode(
          bytes[4],
          bytes[5],
          bytes[6],
          bytes[7]
        );

      if (
        assinatura !==
        "ftyp"
      ) {
        console.warn(
          "⚠️ Arquivo não possui FTYP na posição esperada:",
          assinatura
        );
      }

      console.log(
        "✅ MP4 RECEBIDO:",
        {
          tamanho:
            arrayBuffer.byteLength,

          assinatura,
        }
      );

      /*
       * ==================================================
       * 3. IDENTIFICAR USUÁRIO
       * ==================================================
       */

      const usuarioId =
        await obterUsuarioId(
          req,
          supabaseUrl,
          serviceRoleKey
        );

      const dono =
        usuarioId ||
        "videos";

      /*
       * ==================================================
       * 4. CRIAR CÓPIA NORMALIZADA NO STORAGE
       * ==================================================
       */

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

      const nomeArquivo =
        `whatsapp-${Date.now()}-${crypto.randomUUID()}.mp4`;

      const caminho =
        `${dono}/marketing/whatsapp/${nomeArquivo}`;

      const blob =
        new Blob(
          [
            arrayBuffer,
          ],
          {
            type:
              "video/mp4",
          }
        );

      const {
        error:
          erroUpload,
      } =
        await admin.storage
          .from(
            "imagens"
          )
          .upload(
            caminho,
            blob,
            {
              contentType:
                "video/mp4",

              cacheControl:
                "3600",

              upsert:
                false,
            }
          );

      if (erroUpload) {
        throw new Error(
          "Não foi possível salvar o vídeo preparado: " +
            erroUpload.message
        );
      }

      /*
       * ==================================================
       * 5. URL PÚBLICA
       * ==================================================
       */

      const {
        data:
          dadosPublicos,
      } =
        admin.storage
          .from(
            "imagens"
          )
          .getPublicUrl(
            caminho
          );

      const urlPublica =
        texto(
          dadosPublicos
            ?.publicUrl
        );

      if (!urlPublica) {
        throw new Error(
          "Não foi possível gerar a URL pública do vídeo."
        );
      }

      console.log(
        "✅ VÍDEO WHATSAPP PREPARADO:",
        urlPublica
      );

      return resposta({
        sucesso:
          true,

        video_url:
          urlPublica,

        mime_type:
          "video/mp4",

        nome_arquivo:
          nomeArquivo,

        storage_path:
          caminho,

        tamanho_bytes:
          arrayBuffer.byteLength,

        mensagem:
          "Vídeo preparado para compartilhamento.",
      });
    } catch (
      erro
    ) {
      console.error(
        "❌ ERRO PREPARAR VÍDEO WHATSAPP:",
        erro
      );

      return resposta(
        {
          sucesso:
            false,

          erro:
            erro instanceof Error
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