// Banner Express — cenário publicitário com IA da OpenAI (produção).
// Mesma lógica do servidor local do localhost: o código da chamada à OpenAI
// fica em ./openaiBannerComum.js (cópia idêntica de
// src/services/banner/openaiBannerComum.js — conferida por teste).
// A IA recebe só a foto real posicionada + máscara que protege a peça.
// Preço, código, site, WhatsApp e logo nunca são enviados à IA.
//
// Segredos (Supabase > Edge Functions > Secrets):
//   OPENAI_API_KEY          (obrigatório)
//   OPENAI_BANNER_MODELO    opcional (padrão: gpt-image-2)
//   OPENAI_BANNER_QUALIDADE opcional: low | medium | high (padrão: medium)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  dataUrlParaBytes,
  gerarCenarioOpenAI,
  montarPromptBanner,
} from "./openaiBannerComum.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function base64ParaBytes(b64: string) {
  const binario = atob(b64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ sucesso: false, erro: "Método não permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("ANON_KEY") || "";
  const authorization = req.headers.get("Authorization") || "";

  if (!supabaseUrl || !anonKey) {
    return json({ sucesso: false, erro: "Serviço de banner indisponível.", codigo: "CONFIG" }, 500);
  }

  // Lê o corpo ANTES de responder (inclusive o 401): responder sem consumir
  // um corpo grande (a foto) deixava o pedido pendurado no navegador.
  let corpo: Record<string, unknown> = {};
  try {
    corpo = await req.json();
  } catch {
    return json({ sucesso: false, erro: "Pedido inválido.", codigo: "PEDIDO_INVALIDO" }, 400);
  }

  const cliente = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: dadosAuth } = await cliente.auth.getUser();
  const usuario = dadosAuth?.user;
  if (!usuario?.id) {
    return json({ sucesso: false, erro: "Faça login para gerar o banner com IA.", codigo: "NAO_AUTORIZADO" }, 401);
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY") || "";
  if (!apiKey) {
    return json({ sucesso: false, erro: "IA de imagem não configurada.", codigo: "SEM_CHAVE" }, 503);
  }

  const referencia = dataUrlParaBytes(String(corpo.referencia || ""));
  if (!referencia || referencia.length < 1000) {
    return json({ sucesso: false, erro: "Foto do produto ausente.", codigo: "SEM_FOTO" }, 422);
  }
  if (referencia.length > 12 * 1024 * 1024) {
    return json({ sucesso: false, erro: "Foto muito grande.", codigo: "FOTO_GRANDE" }, 413);
  }
  const mascara = dataUrlParaBytes(String(corpo.mascara || ""));

  const prompt = montarPromptBanner({
    paleta: String(corpo.paleta || "azul"),
    estilo: String(corpo.estilo || "produto"),
    cenario: String(corpo.cenario || "estudio-neon"),
    zonasLivres: Array.isArray(corpo.zonasLivres) ? corpo.zonasLivres.map(String) : [],
    pedestal: Boolean(corpo.pedestal),
    modo: String(corpo.modo || ""),
    zonaProduto: String(corpo.zonaProduto || ""),
    direcao: String(corpo.direcao || ""),
    objetivoDiretor: String(corpo.objetivoDiretor || ""),
    luz: String(corpo.luz || ""),
    baseProduto: String(corpo.baseProduto || ""),
    semente: Number(corpo.variacao) || 0,
  });

  const qualidade = String(Deno.env.get("OPENAI_BANNER_QUALIDADE") || "medium");
  const resultado = await gerarCenarioOpenAI({
    apiKey,
    referencia,
    mascara,
    tamanho: String(corpo.tamanho || "1024x1024"),
    qualidade,
    modeloPreferido: String(Deno.env.get("OPENAI_BANNER_MODELO") || "gpt-image-2"),
    prompt,
  });

  if (!resultado.ok) {
    console.error("banner-openai falhou", resultado.codigo, JSON.stringify(resultado.tentativas));
    const status = resultado.status && resultado.status < 500 ? resultado.status : 502;
    return json({ sucesso: false, erro: resultado.mensagem, codigo: resultado.codigo, tentativas: resultado.tentativas }, status);
  }

  console.log("banner-openai OK", resultado.modelo, resultado.duracaoMs, resultado.idPedido);

  // Guarda o cenário no Storage do usuário (sem base64 no banco).
  let imagem = `data:image/png;base64,${resultado.b64}`;
  try {
    const caminho = `${usuario.id}/banners/ia/cenario-${Date.now()}.png`;
    const { error } = await cliente.storage
      .from("imagens")
      .upload(caminho, base64ParaBytes(resultado.b64), { contentType: "image/png", upsert: false });
    if (!error) {
      const { data } = cliente.storage.from("imagens").getPublicUrl(caminho);
      if (data?.publicUrl) imagem = data.publicUrl;
    }
  } catch {
    // devolve a imagem direto se o Storage falhar
  }

  return json({
    sucesso: true,
    origem: "openai-supabase",
    imagem,
    modelo: resultado.modelo,
    qualidade,
    idPedido: resultado.idPedido,
    duracaoMs: resultado.duracaoMs,
    usouMascara: resultado.usouMascara,
    uso: resultado.uso,
  });
});
