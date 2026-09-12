import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  createClient,
} from "https://esm.sh/@supabase/supabase-js@2";

const REPLICATE_MODEL_URL =
  "https://api.replicate.com/v1/models/kwaivgi/kling-v2.1/predictions";

function montarCors(req: Request) {
  const origin =
    req.headers.get("Origin") ||
    "*";

  const requested =
    req.headers.get(
      "Access-Control-Request-Headers"
    );

  const allowHeaders =
    requested ||
    "authorization, x-client-info, apikey, content-type, x-region, x-supabase-api-version";

  return {
    "Access-Control-Allow-Origin":
      origin,
    "Access-Control-Allow-Headers":
      allowHeaders,
    "Access-Control-Allow-Methods":
      "POST, OPTIONS",
    "Access-Control-Allow-Credentials":
      "true",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(
  req: Request,
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...montarCors(req),
        "Content-Type":
          "application/json; charset=utf-8",
      },
    }
  );
}

function mensagemPublica(
  texto: unknown,
  saldoInsuficiente = false
) {
  if (saldoInsuficiente) {
    return "Você não possui créditos PAIIA suficientes para gerar.";
  }

  const bruto = String(
    texto || ""
  ).toLowerCase();

  if (
    bruto.includes("429") ||
    bruto.includes("prepayment") ||
    bruto.includes("insufficient credit") ||
    bruto.includes("resource_exhausted") ||
    bruto.includes("depleted")
  ) {
    return "A geração está temporariamente indisponível. Nenhum crédito PAIIA foi usado.";
  }

  if (
    bruto.includes("timeout") ||
    bruto.includes("tempo esgotado") ||
    bruto.includes("timed out")
  ) {
    return "A geração demorou mais que o esperado. Nenhum crédito PAIIA foi usado.";
  }

  return "Não foi possível concluir a Criação IA. Nenhum crédito PAIIA foi usado.";
}

function sanitizarLog(valor: unknown) {
  let texto = "";

  try {
    texto = JSON.stringify(valor);
  } catch {
    texto = String(valor ?? "");
  }

  return texto
    .replace(
      /Bearer\s+[A-Za-z0-9._\-]+/gi,
      "Bearer [redacted]"
    )
    .replace(
      /"(authorization|api[_-]?key|apikey|token|secret|service_role|anon_key|gemini_api_key|replicate_api_token)"\s*:\s*"[^"]*"/gi,
      '"$1":"[redacted]"'
    )
    .slice(0, 4000);
}

function registrarErro(
  etapaAtual: string,
  erro: unknown,
  provedor?: {
    status?: number;
    corpo?: unknown;
  }
) {
  const objeto =
    erro && typeof erro === "object"
      ? (erro as {
          name?: string;
          message?: string;
          stack?: string;
        })
      : {};

  console.error(
    "[GERAR-CRIACAO-IA] CATCH",
    {
      etapaAtual,
      name: objeto.name || typeof erro,
      message:
        objeto.message ||
        String(erro ?? ""),
      stack: objeto.stack || null,
      provedorStatus:
        provedor?.status ?? null,
      provedorCorpo: provedor?.corpo
        ? sanitizarLog(provedor.corpo)
        : null,
    }
  );
}

function extrairVideo(
  output: unknown
): string {
  if (typeof output === "string") {
    return output;
  }

  if (Array.isArray(output)) {
    const primeiro = output[0];

    if (typeof primeiro === "string") {
      return primeiro;
    }

    if (
      primeiro &&
      typeof primeiro === "object"
    ) {
      const objeto =
        primeiro as Record<
          string,
          unknown
        >;

      return String(
        objeto.url ||
          objeto.video ||
          objeto.output ||
          ""
      );
    }
  }

  if (
    output &&
    typeof output === "object"
  ) {
    const objeto =
      output as Record<string, unknown>;

    return String(
      objeto.url ||
        objeto.video ||
        objeto.output ||
        ""
    );
  }

  return "";
}

function montarPromptCriacao({
  fala,
  empresa,
  instrucao,
}: {
  fala: string;
  empresa: string;
  instrucao: string;
}) {
  const nomeEmpresa =
    empresa ||
    "the user's company";

  return [
    "Animate the main mascot or character from the provided start image.",
    "IMPORTANT: Keep exactly the same character shown in the start image.",
    "Preserve the same character design, body, face, eyes, mouth, colors, clothing, cap, logos and visual identity.",
    "Do not redesign, replace or create a different version of the character.",
    "Do not create another main character.",
    `This is an advertisement for ${nomeEmpresa}.`,
    instrucao ||
      "The character looks directly at the camera, uses natural friendly gestures and remains clearly visible throughout the video.",
    "The character looks directly at the camera and appears to speak naturally in Brazilian Portuguese.",
    "Only the main character speaks.",
    "Use natural facial expressions, blinking and moderate gestures.",
    "Spoken dialogue in Brazilian Portuguese:",
    `"${fala}"`,
    "No subtitles.",
    "Do not create random text.",
    "Do not invent logos, phone numbers, websites or company names.",
    "Preserve all branding already visible in the reference image.",
    "Professional advertising style.",
    "Clean composition, smooth motion and premium commercial appearance.",
  ].join(" ");
}

async function salvarVideoNoStorage({
  videoUrl,
  supabaseUrl,
  serviceRoleKey,
  usuarioId,
  operacao,
}: {
  videoUrl: string;
  supabaseUrl: string;
  serviceRoleKey: string;
  usuarioId: string;
  operacao: string;
}) {
  const admin = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const caminho =
    `${usuarioId}/marketing/mascotes/criacao-${operacao}.mp4`;

  const {
    data: dadosExistentes,
  } = admin.storage
    .from("imagens")
    .getPublicUrl(caminho);

  const urlExistente = String(
    dadosExistentes?.publicUrl || ""
  ).trim();

  const {
    data: arquivo,
  } = await admin.storage
    .from("imagens")
    .list(
      `${usuarioId}/marketing/mascotes`,
      {
        search: `criacao-${operacao}.mp4`,
        limit: 1,
      }
    );

  if (
    Array.isArray(arquivo) &&
    arquivo.length > 0 &&
    /^https?:\/\//i.test(urlExistente)
  ) {
    return {
      urlPublica: urlExistente,
      caminho,
      tamanho: Number(
        arquivo[0]?.metadata?.size || 1
      ),
      jaExistia: true,
    };
  }

  const respostaVideo =
    await fetch(videoUrl);

  if (!respostaVideo.ok) {
    throw new Error(
      `Não foi possível baixar o vídeo gerado (${respostaVideo.status}).`
    );
  }

  const arrayBuffer =
    await respostaVideo.arrayBuffer();

  if (!arrayBuffer.byteLength) {
    throw new Error(
      "O vídeo gerado está vazio."
    );
  }

  const {
    error: erroUpload,
  } = await admin.storage
    .from("imagens")
    .upload(
      caminho,
      arrayBuffer,
      {
        contentType: "video/mp4",
        upsert: false,
      }
    );

  if (erroUpload) {
    const detalhe = String(
      erroUpload.message || ""
    ).toLowerCase();

    if (
      detalhe.includes("already") ||
      detalhe.includes("duplicate") ||
      detalhe.includes("exists")
    ) {
      return {
        urlPublica: urlExistente,
        caminho,
        tamanho: 1,
        jaExistia: true,
      };
    }

    throw new Error(
      "O vídeo foi gerado, mas não foi possível salvá-lo no Storage: " +
        erroUpload.message
    );
  }

  const {
    data: dadosPublicos,
  } = admin.storage
    .from("imagens")
    .getPublicUrl(caminho);

  const urlPublica = String(
    dadosPublicos?.publicUrl || ""
  ).trim();

  if (!/^https?:\/\//i.test(urlPublica)) {
    throw new Error(
      "O vídeo foi salvo, mas não foi possível gerar a URL pública."
    );
  }

  return {
    urlPublica,
    caminho,
    tamanho: arrayBuffer.byteLength,
    jaExistia: false,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: montarCors(req),
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      req,
      {
        sucesso: false,
        erro: "Método não permitido.",
      },
      405
    );
  }

  let etapaAtual =
    "ETAPA 1 - autenticação";
  let provedorUltimo: {
    status?: number;
    corpo?: unknown;
  } = {};

  const supabaseUrl =
    Deno.env.get("SUPABASE_URL") ||
    "";

  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY") ||
    Deno.env.get("ANON_KEY") ||
    "";

  const serviceRoleKey =
    Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    ) ||
    Deno.env.get("SERVICE_ROLE_KEY") ||
    "";

  const replicateToken =
    Deno.env.get(
      "REPLICATE_API_TOKEN"
    ) || "";

  const authorization =
    req.headers.get("Authorization") ||
    req.headers.get("authorization") ||
    "";

  if (!supabaseUrl || !anonKey) {
    console.error(
      "[GERAR-CRIACAO-IA] ETAPA 1 - autenticação FALHOU",
      {
        supabaseUrlPresente: Boolean(
          supabaseUrl
        ),
        anonKeyPresente: Boolean(
          anonKey
        ),
      }
    );
    return jsonResponse(
      req,
      {
        sucesso: false,
        erro: "Serviço PAIIA indisponível no momento.",
      },
      500
    );
  }

  if (!authorization) {
    console.error(
      "[GERAR-CRIACAO-IA] ETAPA 1 - autenticação FALHOU",
      { motivo: "Authorization ausente" }
    );
    return jsonResponse(
      req,
      {
        sucesso: false,
        erro: "Faça login para usar a Criação IA.",
      },
      401
    );
  }

  const usuarioClient = createClient(
    supabaseUrl,
    anonKey,
    {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  try {
    console.log(
      "[GERAR-CRIACAO-IA] ETAPA 1 - autenticação INICIO"
    );

    const {
      data: dadosAuth,
      error: erroAuth,
    } = await usuarioClient.auth.getUser();

    const usuarioId =
      dadosAuth?.user?.id;

    if (erroAuth || !usuarioId) {
      console.error(
        "[GERAR-CRIACAO-IA] ETAPA 1 - autenticação FALHOU",
        {
          temUsuario: Boolean(usuarioId),
          erroAuth: Boolean(erroAuth),
        }
      );
      return jsonResponse(
        req,
        {
          sucesso: false,
          erro: "Faça login para usar a Criação IA.",
        },
        401
      );
    }

    console.log(
      "[GERAR-CRIACAO-IA] ETAPA 1 - autenticação OK",
      { usuarioPresente: true }
    );

    etapaAtual =
      "ETAPA 2 - leitura do payload";
    console.log(
      "[GERAR-CRIACAO-IA] ETAPA 2 - leitura do payload INICIO"
    );

    const body =
      await req.json();

    const etapa = String(
      body?.etapa || "iniciar"
    )
      .trim()
      .toLowerCase();

    console.log(
      "[GERAR-CRIACAO-IA] ETAPA 2 - leitura do payload OK",
      {
        etapaFluxo: etapa,
        temImagemUrl: Boolean(
          body?.imagemUrl ||
            body?.imageUrl
        ),
        temFala: Boolean(body?.fala),
        temEmpresa: Boolean(
          body?.empresa
        ),
        temOperacao: Boolean(
          body?.operacao ||
            body?.operation_name
        ),
      }
    );

    if (etapa === "iniciar") {
      const {
        data: saldoAtual,
        error: erroSaldo,
      } = await usuarioClient.rpc(
        "consultar_creditos_appia"
      );

      if (erroSaldo) {
        return jsonResponse(
          req,
          {
            sucesso: false,
            erro: "Não foi possível consultar seus créditos PAIIA.",
          },
          400
        );
      }

      if (Number(saldoAtual || 0) < 1) {
        return jsonResponse(
          req,
          {
            sucesso: false,
            erro: mensagemPublica(
              "",
              true
            ),
          },
          400
        );
      }

      etapaAtual =
        "ETAPA 3 - validação da imagem";
      console.log(
        "[GERAR-CRIACAO-IA] ETAPA 3 - validação da imagem INICIO"
      );

      const imagemUrl = String(
        body?.imagemUrl ||
          body?.imageUrl ||
          ""
      ).trim();

      const fala = String(
        body?.fala || ""
      ).trim();

      const empresa = String(
        body?.empresa || ""
      ).trim();

      if (!imagemUrl || !fala || !empresa) {
        console.error(
          "[GERAR-CRIACAO-IA] ETAPA 3 - validação da imagem FALHOU",
          {
            temImagemUrl: Boolean(
              imagemUrl
            ),
            temFala: Boolean(fala),
            temEmpresa: Boolean(empresa),
          }
        );
        return jsonResponse(
          req,
          {
            sucesso: false,
            erro: "Informe a imagem, o nome da empresa e a fala para a Criação IA.",
          },
          400
        );
      }

      if (fala.length > 260) {
        return jsonResponse(
          req,
          {
            sucesso: false,
            erro: "A fala está muito longa para o vídeo. Reduza o texto antes de gerar.",
          },
          400
        );
      }

      console.log(
        "[GERAR-CRIACAO-IA] ETAPA 3 - validação da imagem OK",
        {
          imagemUrlHttp:
            imagemUrl.startsWith(
              "http"
            ),
        }
      );

      etapaAtual =
        "ETAPA 4 - escolha/configuração do provedor";
      console.log(
        "[GERAR-CRIACAO-IA] ETAPA 4 - escolha/configuração do provedor INICIO"
      );

      if (!replicateToken) {
        console.error(
          "[GERAR-CRIACAO-IA] ETAPA 4 FALHOU",
          { replicateTokenPresente: false }
        );
        return jsonResponse(
          req,
          {
            sucesso: false,
            erro: "Serviço PAIIA indisponível no momento.",
          },
          500
        );
      }

      console.log(
        "[GERAR-CRIACAO-IA] ETAPA 4 - escolha/configuração do provedor OK",
        {
          provedor: "replicate",
          modelo: "kwaivgi/kling-v2.1",
          replicateTokenPresente: true,
        }
      );

      etapaAtual =
        "ETAPA 5 - chamada ao provedor externo";
      console.log(
        "[GERAR-CRIACAO-IA] ETAPA 5 - chamada ao provedor externo INICIO",
        {
          provedor: "replicate",
          modelo: "kwaivgi/kling-v2.1",
        }
      );

      const prompt = montarPromptCriacao({
        fala,
        empresa,
        instrucao: String(
          body?.instrucao || ""
        ).trim(),
      });

      const criarResposta =
        await fetch(
          REPLICATE_MODEL_URL,
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${replicateToken}`,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              input: {
                start_image: imagemUrl,
                prompt,
                negative_prompt: [
                  "character replacement",
                  "slideshow",
                  "cutaway",
                  "scene change",
                  "distorted face",
                  "deformed hands",
                  "random text",
                  "watermark",
                  "subtitles",
                ].join(", "),
                duration: 10,
                mode: "standard",
              },
            }),
          }
        );

      let prediction: Record<
        string,
        unknown
      > = {};

      try {
        prediction =
          await criarResposta.json();
      } catch {
        prediction = {
          error: "timeout",
        };
      }

      provedorUltimo = {
        status: criarResposta.status,
        corpo: prediction,
      };

      etapaAtual =
        "ETAPA 6 - resposta do provedor";
      console.log(
        "[GERAR-CRIACAO-IA] ETAPA 6 - resposta do provedor",
        {
          ok: criarResposta.ok,
          status: criarResposta.status,
          predictionStatus:
            prediction?.status || null,
          temId: Boolean(prediction?.id),
          corpo: sanitizarLog({
            id: prediction?.id,
            status: prediction?.status,
            error: prediction?.error,
            detail: prediction?.detail,
          }),
        }
      );

      const operacao = String(
        prediction?.id || ""
      ).trim();

      if (
        !criarResposta.ok ||
        !operacao
      ) {
        console.error(
          "[GERAR-CRIACAO-IA] ETAPA 6 - resposta do provedor FALHOU",
          {
            status: criarResposta.status,
            corpo: sanitizarLog(
              prediction
            ),
          }
        );
        return jsonResponse(
          req,
          {
            sucesso: false,
            erro: mensagemPublica(
              prediction?.error ||
                prediction?.detail ||
                criarResposta.status
            ),
          },
          502
        );
      }

      console.log(
        "[GERAR-CRIACAO-IA] ETAPA 7-10 PULADAS",
        {
          motivo:
            "fluxo iniciar só cria a prediction",
          debitado: false,
        }
      );

      return jsonResponse(req, {
        sucesso: true,
        pendente: true,
        operacao,
        mensagem:
          "A Criação IA está sendo gerada.",
      });
    }

    if (etapa === "consultar") {
      const operacao = String(
        body?.operacao ||
          body?.operation_name ||
          ""
      ).trim();

      if (!operacao) {
        return jsonResponse(
          req,
          {
            sucesso: false,
            erro: "Não foi possível acompanhar a geração.",
          },
          400
        );
      }

      if (!replicateToken) {
        return jsonResponse(
          req,
          {
            sucesso: false,
            erro: "Serviço PAIIA indisponível no momento.",
          },
          500
        );
      }

      etapaAtual =
        "ETAPA 5 - chamada ao provedor externo";
      console.log(
        "[GERAR-CRIACAO-IA] ETAPA 5 - consulta ao provedor INICIO",
        {
          provedor: "replicate",
          temOperacao: true,
        }
      );

      const consultaResposta =
        await fetch(
          `https://api.replicate.com/v1/predictions/${operacao}`,
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${replicateToken}`,
              "Content-Type":
                "application/json",
            },
          }
        );

      let prediction: Record<
        string,
        unknown
      > = {};

      try {
        prediction =
          await consultaResposta.json();
      } catch {
        prediction = {
          error: "timeout",
        };
      }

      provedorUltimo = {
        status: consultaResposta.status,
        corpo: prediction,
      };

      etapaAtual =
        "ETAPA 6 - resposta do provedor";
      console.log(
        "[GERAR-CRIACAO-IA] ETAPA 6 - resposta do provedor",
        {
          ok: consultaResposta.ok,
          status: consultaResposta.status,
          predictionStatus:
            prediction?.status || null,
          corpo: sanitizarLog({
            id: prediction?.id,
            status: prediction?.status,
            error: prediction?.error,
          }),
        }
      );

      if (!consultaResposta.ok) {
        return jsonResponse(
          req,
          {
            sucesso: false,
            erro: mensagemPublica(
              prediction?.error ||
                prediction?.detail ||
                consultaResposta.status
            ),
          },
          502
        );
      }

      const statusPredicao = String(
        prediction?.status || ""
      );

      if (
        statusPredicao === "failed" ||
        statusPredicao === "canceled"
      ) {
        console.error(
          "[GERAR-CRIACAO-IA] ETAPA 6 - provedor falhou",
          { statusPredicao }
        );
        return jsonResponse(
          req,
          {
            sucesso: false,
            erro: mensagemPublica(
              prediction?.error ||
                statusPredicao
            ),
          },
          502
        );
      }

      if (statusPredicao !== "succeeded") {
        return jsonResponse(req, {
          sucesso: true,
          pendente: true,
          operacao,
          mensagem:
            "A Criação IA ainda está sendo gerada.",
        });
      }

      etapaAtual =
        "ETAPA 7 - download/obtenção do vídeo";
      console.log(
        "[GERAR-CRIACAO-IA] ETAPA 7 - download/obtenção do vídeo INICIO"
      );

      const videoReplicate =
        extrairVideo(
          prediction?.output
        );

      if (!videoReplicate) {
        console.error(
          "[GERAR-CRIACAO-IA] ETAPA 7 FALHOU",
          { temUrl: false }
        );
        return jsonResponse(
          req,
          {
            sucesso: false,
            erro: mensagemPublica(
              "falha ao salvar"
            ),
          },
          502
        );
      }

      console.log(
        "[GERAR-CRIACAO-IA] ETAPA 7 OK",
        { temUrl: true }
      );

      if (!serviceRoleKey) {
        return jsonResponse(
          req,
          {
            sucesso: false,
            erro: mensagemPublica(
              "falha ao salvar"
            ),
          },
          500
        );
      }

      etapaAtual =
        "ETAPA 8 - upload/storage";
      console.log(
        "[GERAR-CRIACAO-IA] ETAPA 8 - upload/storage INICIO"
      );

      let salvo: {
        urlPublica: string;
        caminho: string;
        tamanho: number;
        jaExistia: boolean;
      };

      try {
        salvo =
          await salvarVideoNoStorage({
            videoUrl: videoReplicate,
            supabaseUrl,
            serviceRoleKey,
            usuarioId,
            operacao,
          });
      } catch (erroUpload) {
        registrarErro(
          etapaAtual,
          erroUpload
        );
        return jsonResponse(
          req,
          {
            sucesso: false,
            erro: mensagemPublica(
              "falha ao salvar"
            ),
          },
          500
        );
      }

      console.log(
        "[GERAR-CRIACAO-IA] ETAPA 8 OK",
        { bytes: salvo.tamanho }
      );

      etapaAtual =
        "ETAPA 9 - registro em processamentos";
      console.log(
        "[GERAR-CRIACAO-IA] ETAPA 9 - registro em processamentos INICIO"
      );

      const urlClip = salvo.urlPublica;

      const {
        data: existentes,
        error: erroBusca,
      } = await usuarioClient
        .from("processamentos")
        .select(
          "id, imagem_processada, tipo"
        )
        .eq("user_id", usuarioId)
        .eq("imagem_processada", urlClip)
        .limit(1);

      if (erroBusca) {
        console.error(
          "[GERAR-CRIACAO-IA] ETAPA 9 FALHOU",
          { motivo: "busca" }
        );
        return jsonResponse(
          req,
          {
            sucesso: false,
            erro: mensagemPublica(
              "falha ao salvar"
            ),
          },
          500
        );
      }

      if (
        !Array.isArray(existentes) ||
        existentes.length === 0
      ) {
        const {
          error: erroInsert,
        } = await usuarioClient
          .from("processamentos")
          .insert([
            {
              user_id: usuarioId,
              imagem_original:
                String(
                  body?.imagemUrl ||
                    body?.imageUrl ||
                    ""
                ) || null,
              imagem_processada:
                urlClip,
              status: "finalizado",
              tipo: "video",
              modelo_banner:
                "criacao-ia",
            },
          ]);

        if (erroInsert) {
          console.error(
            "[GERAR-CRIACAO-IA] ETAPA 9 FALHOU",
            { motivo: "insert" }
          );
          return jsonResponse(
            req,
            {
              sucesso: false,
              erro: mensagemPublica(
                "falha ao salvar"
              ),
            },
            500
          );
        }
      } else {
        console.log(
          "[GERAR-CRIACAO-IA] ETAPA 9 OK",
          { jaExistia: true }
        );
        console.log(
          "[GERAR-CRIACAO-IA] ETAPA 10 PULADA",
          { debitado: false }
        );

        const {
          data: saldoAtual,
        } = await usuarioClient.rpc(
          "consultar_creditos_appia"
        );

        return jsonResponse(req, {
          sucesso: true,
          pendente: false,
          video: urlClip,
          video_url: urlClip,
          saldo: Math.max(
            0,
            Number(saldoAtual || 0)
          ),
          mensagem:
            "Criação IA gerada com sucesso.",
        });
      }

      console.log(
        "[GERAR-CRIACAO-IA] ETAPA 9 OK",
        { jaExistia: false }
      );

      etapaAtual =
        "ETAPA 10 - débito do crédito";
      console.log(
        "[GERAR-CRIACAO-IA] ETAPA 10 - débito do crédito INICIO"
      );

      const {
        data: novoSaldo,
        error: erroDebito,
      } = await usuarioClient.rpc(
        "debitar_credito_clip"
      );

      if (erroDebito) {
        const mensagem = String(
          erroDebito.message || ""
        ).toUpperCase();

        console.error(
          "[GERAR-CRIACAO-IA] ETAPA 10 FALHOU"
        );

        if (
          mensagem.includes(
            "CREDITOS_INSUFICIENTES"
          )
        ) {
          return jsonResponse(
            req,
            {
              sucesso: false,
              erro: mensagemPublica(
                "",
                true
              ),
            },
            400
          );
        }

        return jsonResponse(
          req,
          {
            sucesso: false,
            erro: "O vídeo foi gerado, mas não foi possível registrar o crédito PAIIA.",
          },
          500
        );
      }

      console.log(
        "[GERAR-CRIACAO-IA] ETAPA 10 OK"
      );

      return jsonResponse(req, {
        sucesso: true,
        pendente: false,
        video: urlClip,
        video_url: urlClip,
        saldo: Math.max(
          0,
          Number(novoSaldo || 0)
        ),
        mensagem:
          "Criação IA gerada com sucesso.",
      });
    }

    return jsonResponse(
      req,
      {
        sucesso: false,
        erro: "Etapa inválida.",
      },
      400
    );
  } catch (erro) {
    registrarErro(
      etapaAtual,
      erro,
      provedorUltimo
    );

    return jsonResponse(
      req,
      {
        sucesso: false,
        erro: mensagemPublica(erro),
      },
      500
    );
  }
});
