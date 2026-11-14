// =============================================================
// PAIIA — Edge Function "foto-photoroom" (12/11/2026). ESCRITA, NÃO PUBLICADA.
//
// Remove o fundo de UMA foto original do usuário com a Remove Background API
// do Photoroom (v1/segment, plano Basic). Devolve SÓ o recorte (PNG com
// transparência); a foto final 1200 x 1200 é montada no navegador com os
// pixels originais (composicaoFotoIA.js) e salva na Galeria.
//
// Segurança e uso:
// - exige login; a foto precisa estar na pasta do próprio usuário;
// - a chave fica no segredo PHOTOROOM_API_KEY (nunca no navegador);
// - mesma foto nunca é cobrada duas vezes (recorte com nome fixo, reaproveitado);
// - limite mensal por usuário (FOTO_PHOTOROOM_LIMITE_MENSAL, padrão 1000),
//   contado pelos recortes salvos em <usuario>/recortes-photoroom/AAAA-MM/
//   (sem tabela nova); falha no Photoroom não conta uso;
// - foto até 30 MB; espera do Photoroom limitada a ~100 s.
// =============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ENDERECO = "https://sdk.photoroom.com/v1/segment";
const BUCKET = "imagens";
const TAMANHO_MAXIMO_BYTES = 30 * 1024 * 1024;
const LIMITE_ESPERA_MS = 100000;

function cors(req: Request) {
  return {
    "Access-Control-Allow-Origin": req.headers.get("Origin") || "*",
    "Access-Control-Allow-Headers":
      req.headers.get("Access-Control-Request-Headers") || "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(req: Request, corpo: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
}

export function caminhoPertenceAoUsuario(caminho: string, usuarioId: string) {
  const texto = String(caminho || "");
  if (!texto || !usuarioId) return false;
  if (texto.includes("..") || texto.startsWith("/") || texto.includes("\\")) return false;
  return texto.startsWith(`${usuarioId}/originais/`);
}

/** (14/11) Nome fixo do recorte de UMA foto original (mesma foto = mesmo arquivo). */
export function nomeDoRecorte(caminho: string) {
  const base = String(caminho || "").split("/").pop() || "foto";
  return `${base.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120) || "foto"}.png`;
}

export function codigoDoStatus(status: number) {
  if (status === 401) return "CHAVE_INVALIDA";
  if (status === 402 || status === 403) return "SEM_CREDITO";
  if (status === 400 || status === 413 || status === 415) return "FOTO_INVALIDA";
  return "FALHA_PHOTOROOM";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { sucesso: false, erro: "Método não permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";
  const chavePhotoroom = Deno.env.get("PHOTOROOM_API_KEY") || "";
  // (14/11) Franquia PRÓPRIA do Photoroom Basic (1.000/mês contratadas), separada do
  // limite de 50 do "foto-ia". Pode ser ajustada no segredo FOTO_PHOTOROOM_LIMITE_MENSAL.
  const limiteMensal = Math.max(0, Number.parseInt(Deno.env.get("FOTO_PHOTOROOM_LIMITE_MENSAL") || "1000", 10) || 0);

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(req, { sucesso: false, erro: "Foto Profissional indisponível no momento." }, 503);
  }
  if (!chavePhotoroom) {
    return json(req, { sucesso: false, codigo: "SEM_CHAVE", erro: "A chave do Photoroom não está configurada." }, 503);
  }

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return json(req, { sucesso: false, codigo: "NAO_AUTORIZADO", erro: "Faça login para usar a Foto Profissional." }, 401);
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
  try { corpo = await req.json(); } catch { corpo = {}; }
  const caminho = String(corpo?.caminho || "").trim();
  if (!caminhoPertenceAoUsuario(caminho, usuario.id)) {
    return json(req, { sucesso: false, codigo: "FOTO_INVALIDA", erro: "Foto inválida para esta conta." }, 403);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1) Limite do mês, antes de gastar com o Photoroom.
  const mes = new Date().toISOString().slice(0, 7);
  const pastaMes = `${usuario.id}/recortes-photoroom/${mes}`;
  const { data: doMes, error: erroLista } = await admin.storage.from(BUCKET).list(pastaMes, { limit: Math.min(limiteMensal + 1, 1000) });
  if (erroLista) return json(req, { sucesso: false, erro: "Não foi possível verificar seu limite do mês." }, 503);
  const usadas = (doMes || []).filter((o) => o.name.endsWith(".png")).length;

  // (14/11) A MESMA foto nunca é cobrada duas vezes: se o recorte dela já existe
  // (nova tentativa depois de falha na montagem, na Galeria ou na rede), reaproveita.
  const nomeRecorte = nomeDoRecorte(caminho);
  if ((doMes || []).some((o) => o.name === nomeRecorte)) {
    const { data: jaFeito } = admin.storage.from(BUCKET).getPublicUrl(`${pastaMes}/${nomeRecorte}`);
    return json(req, { sucesso: true, recorteUrl: jaFeito.publicUrl, reaproveitado: true, uso: { usadas, limite: limiteMensal } });
  }
  if (usadas >= limiteMensal) {
    return json(req, { sucesso: false, codigo: "LIMITE_MENSAL", erro: `Você atingiu o limite de ${limiteMensal} fotos profissionais deste mês.`, uso: { usadas, limite: limiteMensal } }, 429);
  }

  // 2) Foto original (já com a orientação aplicada pelo navegador).
  const { data: arquivo, error: erroBaixar } = await admin.storage.from(BUCKET).download(caminho);
  if (erroBaixar || !arquivo) return json(req, { sucesso: false, codigo: "FOTO_INVALIDA", erro: "Não foi possível ler a foto enviada." }, 404);
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) return json(req, { sucesso: false, codigo: "FOTO_INVALIDA", erro: "Foto acima de 30 MB." }, 413);

  // 3) Photoroom: só remoção de fundo, tamanho cheio, sem recortar a área.
  const form = new FormData();
  form.append("image_file", new File([arquivo], caminho.split("/").pop() || "foto.jpg", { type: arquivo.type || "image/jpeg" }));
  form.append("format", "png");
  form.append("size", "full");
  form.append("crop", "false");
  form.append("channels", "rgba");

  let resposta: Response;
  try {
    resposta = await fetch(ENDERECO, { method: "POST", headers: { "x-api-key": chavePhotoroom }, body: form, signal: AbortSignal.timeout(LIMITE_ESPERA_MS) });
  } catch (e) {
    console.error("foto-photoroom: sem resposta:", String(e));
    return json(req, { sucesso: false, erro: "O Photoroom não respondeu. Tente novamente." }, 504);
  }
  if (!resposta.ok) {
    const texto = (await resposta.text().catch(() => "")).slice(0, 300);
    console.error("foto-photoroom: recusou:", resposta.status, texto);
    const status = resposta.status >= 500 || resposta.status === 429 ? resposta.status : 400;
    return json(req, { sucesso: false, codigo: codigoDoStatus(resposta.status), erro: "O Photoroom não conseguiu remover o fundo desta foto." }, status);
  }
  const recorte = new Uint8Array(await resposta.arrayBuffer());
  if (!recorte.length) return json(req, { sucesso: false, erro: "O Photoroom devolveu um recorte vazio." }, 502);

  // 4) Guarda o recorte (é também o contador do mês) e devolve o endereço.
  const caminhoRecorte = `${pastaMes}/${nomeRecorte}`; // (14/11) nome fixo por foto: reaproveitável
  const { error: erroSalvar } = await admin.storage.from(BUCKET).upload(caminhoRecorte, recorte, { contentType: "image/png", upsert: true });
  if (erroSalvar) return json(req, { sucesso: false, erro: "O recorte foi feito, mas não foi salvo. Tente novamente." }, 503);
  const { data: publico } = admin.storage.from(BUCKET).getPublicUrl(caminhoRecorte);

  return json(req, {
    sucesso: true,
    recorteUrl: publico.publicUrl,
    incerteza: resposta.headers.get("x-uncertainty-score") || "",
    uso: { usadas: usadas + 1, limite: limiteMensal },
  });
});
