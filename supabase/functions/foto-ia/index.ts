// Foto IA — recorte (remoção de fundo) da foto do usuário.
//
// Esta função NÃO gera nem redesenha imagem. Ela só pede ao provedor de
// remoção de fundo (Replicate · recraft-ai/recraft-remove-background) o PNG
// com transparência e devolve a URL. A composição 1200×1200 é feita no
// navegador usando os pixels ORIGINAIS da foto (só o alfa vem do recorte).
//
// Segurança e uso:
// - exige usuário logado (JWT validado);
// - só aceita imagens da pasta do próprio usuário no bucket "imagens";
// - limite mensal por usuário (FOTO_IA_LIMITE_MENSAL, padrão 50), contado no
//   servidor; a mesma foto (mesma chave) nunca é contada duas vezes;
// - falha no recorte não conta uso.
//
// Tempo: I/O apenas (sem processamento pesado de imagem), bem abaixo dos
// limites de CPU; espera do provedor limitada a ~110 s.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { emailEhContaInternaTeste } from "../_shared/contaInternaTeste.ts";

const REPLICATE_ENDPOINT =
  "https://api.replicate.com/v1/models/recraft-ai/recraft-remove-background/predictions";
const BUCKET = "imagens";
const LIMITE_ESPERA_MS = 110000;
const TAMANHO_MAXIMO_BYTES = 25 * 1024 * 1024;

function cors(req: Request) {
  return {
    "Access-Control-Allow-Origin": req.headers.get("Origin") || "*",
    "Access-Control-Allow-Headers":
      req.headers.get("Access-Control-Request-Headers") ||
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(req: Request, corpo: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json" },
  });
}

// Caminho seguro dentro da pasta do usuário (sem "..", sem barra inicial).
export function caminhoPertenceAoUsuario(caminho: string, usuarioId: string) {
  const texto = String(caminho || "");
  if (!texto || !usuarioId) return false;
  if (texto.includes("..") || texto.startsWith("/") || texto.includes("\\")) return false;
  return texto.startsWith(`${usuarioId}/`);
}

export function chaveValida(chave: unknown) {
  return typeof chave === "string" && /^[A-Za-z0-9-]{8,80}$/.test(chave);
}

function obterUrlSaida(saida: unknown): string {
  if (typeof saida === "string") return saida;
  if (Array.isArray(saida)) return obterUrlSaida(saida[0]);
  if (saida && typeof saida === "object") {
    const o = saida as Record<string, unknown>;
    return obterUrlSaida(o.url) || obterUrlSaida(o.image) || obterUrlSaida(o.output);
  }
  return "";
}

function mensagemProvedor(dados: unknown) {
  if (dados && typeof dados === "object") {
    const o = dados as Record<string, unknown>;
    const m = o.detail || o.error || o.title;
    if (m) return typeof m === "string" ? m : JSON.stringify(m);
  }
  return "";
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors(req) });
  }
  if (req.method !== "POST") {
    return json(req, { sucesso: false, erro: "Método não permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("ANON_KEY") || "";
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";
  const replicateToken = Deno.env.get("REPLICATE_API_TOKEN") || "";
  const limiteMensal = Math.max(
    0,
    Number.parseInt(Deno.env.get("FOTO_IA_LIMITE_MENSAL") || "50", 10) || 0
  );

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !replicateToken) {
    console.error("foto-ia: configuração incompleta (URL/chaves/REPLICATE_API_TOKEN).");
    return json(req, { sucesso: false, erro: "Serviço de Foto IA indisponível no momento." }, 503);
  }

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return json(req, { sucesso: false, codigo: "NAO_AUTORIZADO", erro: "Faça login para usar a Foto IA." }, 401);
  }

  const clienteUsuario = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: erroAuth } = await clienteUsuario.auth.getUser();
  const usuario = auth?.user;
  if (erroAuth || !usuario?.id) {
    return json(req, { sucesso: false, codigo: "NAO_AUTORIZADO", erro: "Sessão expirada. Entre novamente." }, 401);
  }

  let corpo: Record<string, unknown> = {};
  try {
    corpo = await req.json();
  } catch {
    corpo = {};
  }

  const caminho = String(corpo?.caminho || "").trim();
  const chave = corpo?.chave;

  if (!caminhoPertenceAoUsuario(caminho, usuario.id)) {
    return json(req, { sucesso: false, codigo: "FOTO_INVALIDA", erro: "Foto inválida para esta conta." }, 403);
  }
  if (!chaveValida(chave)) {
    return json(req, { sucesso: false, codigo: "FOTO_INVALIDA", erro: "Identificador da foto inválido." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const contaInterna = emailEhContaInternaTeste(usuario.email || "");

  // 1) Limite do mês (antes de gastar com o provedor).
  let uso: Record<string, unknown> | null = null;
  if (!contaInterna) {
    const { data, error } = await admin.rpc("paiia_foto_ia_uso", {
      p_user_id: usuario.id,
      p_chave: chave,
      p_limite: limiteMensal,
      p_registrar: false,
    });
    if (error) {
      console.error("foto-ia: falha ao consultar uso:", error.message);
      return json(req, { sucesso: false, erro: "Não foi possível verificar seu limite de Fotos IA." }, 503);
    }
    uso = data as Record<string, unknown>;
    if (uso && uso.permitido === false) {
      return json(req, {
        sucesso: false,
        codigo: "LIMITE_MENSAL",
        erro: `Você atingiu o limite de ${limiteMensal} Fotos IA deste mês.`,
        uso,
      }, 402);
    }
  }

  // 2) A foto existe e tem tamanho aceitável?
  const { data: publico } = admin.storage.from(BUCKET).getPublicUrl(caminho);
  const urlFoto = publico?.publicUrl || "";
  try {
    const cabecalho = await fetch(urlFoto, { method: "HEAD" });
    if (!cabecalho.ok) {
      return json(req, { sucesso: false, codigo: "FOTO_INVALIDA", erro: "A foto enviada não foi encontrada." }, 404);
    }
    const tamanho = Number(cabecalho.headers.get("content-length") || 0);
    const tipo = String(cabecalho.headers.get("content-type") || "");
    if (tamanho > TAMANHO_MAXIMO_BYTES || (tipo && !tipo.startsWith("image/"))) {
      return json(req, { sucesso: false, codigo: "FOTO_INVALIDA", erro: "Arquivo de imagem inválido ou grande demais." }, 400);
    }
  } catch {
    return json(req, { sucesso: false, erro: "Não foi possível acessar a foto enviada." }, 502);
  }

  // 3) Recorte no provedor.
  const inicio = Date.now();
  let predicao: Record<string, unknown> = {};
  try {
    const resposta = await fetch(REPLICATE_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${replicateToken}`,
        "Content-Type": "application/json",
        Prefer: "wait=50",
      },
      body: JSON.stringify({ input: { image: urlFoto } }),
    });
    predicao = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      console.error("foto-ia: provedor recusou:", resposta.status, mensagemProvedor(predicao));
      const status = resposta.status === 429 ? 429 : resposta.status >= 500 ? 502 : 422;
      return json(req, {
        sucesso: false,
        codigo: status === 422 ? "FOTO_INVALIDA" : "PROVEDOR",
        erro:
          status === 422
            ? "O serviço de recorte não aceitou esta foto. Tente outra foto."
            : "Serviço de recorte ocupado. Tente novamente em instantes.",
      }, status);
    }
  } catch (erro) {
    console.error("foto-ia: erro de rede com o provedor:", (erro as Error)?.message);
    return json(req, { sucesso: false, codigo: "PROVEDOR", erro: "Serviço de recorte indisponível. Tente novamente." }, 502);
  }

  const urlConsulta = String((predicao?.urls as Record<string, unknown>)?.get || "");
  while (
    predicao.status !== "succeeded" &&
    predicao.status !== "failed" &&
    predicao.status !== "canceled"
  ) {
    if (!urlConsulta || Date.now() - inicio > LIMITE_ESPERA_MS) {
      return json(req, { sucesso: false, codigo: "TEMPO", erro: "O recorte demorou mais que o esperado. Tente novamente." }, 504);
    }
    await esperar(1500);
    try {
      const r = await fetch(urlConsulta, { headers: { Authorization: `Bearer ${replicateToken}` } });
      if (r.ok) predicao = await r.json();
    } catch {
      // tenta de novo no próximo ciclo
    }
  }

  if (predicao.status !== "succeeded") {
    console.error("foto-ia: recorte falhou:", mensagemProvedor(predicao) || predicao.error);
    return json(req, { sucesso: false, codigo: "FOTO_INVALIDA", erro: "Não foi possível recortar esta foto. Tente outra foto." }, 422);
  }

  const recorteUrl = obterUrlSaida(predicao.output);
  if (!/^https:\/\//i.test(recorteUrl)) {
    return json(req, { sucesso: false, codigo: "PROVEDOR", erro: "O serviço de recorte não devolveu a imagem." }, 502);
  }

  // 4) Registra o uso (só em sucesso; a mesma chave não conta duas vezes).
  if (!contaInterna) {
    const { data, error } = await admin.rpc("paiia_foto_ia_uso", {
      p_user_id: usuario.id,
      p_chave: chave,
      p_limite: limiteMensal,
      p_registrar: true,
    });
    if (error) {
      console.error("foto-ia: falha ao registrar uso:", error.message);
    } else {
      uso = data as Record<string, unknown>;
    }
  }

  return json(req, {
    sucesso: true,
    recorteUrl,
    uso: contaInterna ? { interno: true } : uso,
    duracaoMs: Date.now() - inicio,
  });
});
