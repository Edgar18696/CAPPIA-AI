// =============================================================
// PAIIA — Edge Function "paizinho-bf-leitura" (PREPARADA — NÃO PUBLICADA).
// Black Friday 2026 (Central do Paizinho): leituras que a
// mercadolivre-publicacao recusa por lista permitida.
//
// SOMENTE LEITURA:
//   - só GET na API do Mercado Livre, só nos endereços de
//     src/services/blackFriday/leituraPermitida.js
//     (promoções do anúncio, promoções da conta e catálogo /products/{id});
//   - só para o usuário logado (JWT) e só nas 3 contas da campanha
//     conectadas por ESTE usuário (token da conta dele);
//   - promoções de anúncio: confere antes que o anúncio é da conta;
//   - NÃO renova nem grava token; NÃO grava nada no banco;
//   - recusa do ML (ex.: 403 "At least one policy returned UNAUTHORIZED")
//     volta com o detalhe público do erro (mensagem, código, causa) para o
//     diagnóstico — nunca o token.
//
// Corpo: { conta: "1729335019", caminho: "/seller-promotions/items/MLB1?app_version=v2" }
// Resposta: { ok, status, dados } | { ok: false, status, erro, recusa_ml? }
// Segredos: só os automáticos (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).
// Publicar (só com autorização): supabase functions deploy paizinho-bf-leitura
//   (verify_jwt pode ficar ligado: a função também confere o JWT por conta própria).
// =============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";
import { conferirLeituraBF, caminhoDono, anuncioEhDaConta, detalheRecusaML } from "../../../src/services/blackFriday/leituraPermitida.js";

const ML = "https://api.mercadolibre.com";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
const env = (k: string) => (Deno.env.get(k) || "").trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, erro: "Use POST." }, 405);

  // 1) Usuário logado
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const sb = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const { data: u } = jwt ? await sb.auth.getUser(jwt) : { data: null };
  const usuarioId = u?.user?.id;
  if (!usuarioId) return json({ ok: false, status: 401, erro: "Usuário não autenticado. Entre novamente no PAIIA." });

  // 2) Leitura permitida?
  const corpo = await req.json().catch(() => ({}));
  const conta = String(corpo?.conta || "").replace(/\D/g, "");
  const caminho = String(corpo?.caminho || "");
  const conf = conferirLeituraBF(caminho, conta);
  if (!conf.ok) return json({ ok: false, status: 403, erro: conf.erro });

  // 3) Token da conta DESTE usuário (sem renovar, sem devolver)
  const { data: c, error } = await sb.from("contas_marketplace")
    .select("access_token, expires_at")
    .eq("usuario_id", usuarioId).eq("marketplace", "mercado_livre").eq("ml_user_id", conta)
    .maybeSingle();
  if (error || !c?.access_token) return json({ ok: false, status: 404, erro: "Conta Mercado Livre não conectada para este usuário." });
  if (c.expires_at && new Date(c.expires_at).getTime() <= Date.now()) {
    return json({ ok: false, status: 401, erro: "Token da conta Mercado Livre vencido: abra Contas Marketplace no PAIIA para renovar e rode de novo." });
  }
  const get = getML(c.access_token);

  // 4) Promoções de um anúncio: só de anúncio desta conta.
  if (conf.tipo === "promocoes_anuncio") {
    const dono = await get(caminhoDono(conf.anuncio));
    if (!dono.ok) return json({ ok: false, status: dono.status, erro: `Não foi possível conferir o dono do anúncio: ${dono.erro}` });
    if (!anuncioEhDaConta(dono.dados, conta)) return json({ ok: false, status: 403, erro: "Promoções só de anúncios da conta informada." });
  }

  // 5) A leitura pedida
  return json(await get(caminho));
});

/** GET na API do Mercado Livre (somente leitura), nova tentativa em 429/5xx. */
function getML(token: string) {
  return async (caminho: string) => {
    for (let tentativa = 0; tentativa < 4; tentativa++) {
      const r = await fetch(`${ML}${caminho}`, { method: "GET", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
      if (r.status === 429 || r.status >= 500) { await new Promise((ok) => setTimeout(ok, 1000 * 2 ** tentativa)); continue; }
      const dados = await r.json().catch(() => null);
      if (r.ok) return { ok: true, status: r.status, dados };
      return { ok: false, status: r.status, erro: dados?.message || dados?.error || `HTTP ${r.status}`, recusa_ml: detalheRecusaML(r.status, dados) };
    }
    return { ok: false, status: 429, erro: "Mercado Livre limitou as consultas." };
  };
}
