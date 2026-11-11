// =============================================================
// PAIIA — Edge Function "paizinho-leitura-ml" (PILOTO — NÃO PUBLICADA).
// Central do Paizinho: leitura de VENDAS, VISITAS e CUSTO DOS ENVIOS da
// conta Mercado Livre do piloto (LOJA ONLINE), para o teste local da
// auditoria. A mercadolivre-publicacao recusa essas leituras.
//
// SOMENTE LEITURA:
//   - só GET na API do Mercado Livre, só nos endereços de
//     src/services/paizinhoAuditoria/leituraComercial.js;
//   - só para o usuário logado (JWT) e só na conta dele que estiver
//     liberada no piloto;
//   - visitas só de anúncios da própria conta (confere o vendedor antes,
//     com /items?ids=...&attributes=id,seller_id);
//   - NÃO renova nem grava token: se o token da conta estiver vencido,
//     responde pedindo para renová-lo pelo PAIIA (Contas Marketplace).
//   - não grava nada no banco.
//
// Corpo: { conta: "1729335019", caminho: "/orders/search?seller=..." }
// Resposta: { ok, status, dados } | { ok: false, erro }
// Segredos: só os automáticos (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).
// =============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";
import {
  conferirLeituraComercial,
  anunciosDaLeitura,
  caminhosDonoDosAnuncios,
  anunciosSaoDaConta,
} from "../../../src/services/paizinhoAuditoria/leituraComercial.js";

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
  const conf = conferirLeituraComercial(caminho, conta);
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

  // 4) Visitas: só de anúncios desta conta (confere o vendedor de cada um antes).
  //    Pedidos já são da própria conta (seller conferido + token da conta);
  //    custo de envio de outro vendedor o ML recusa.
  const get = getML(c.access_token);
  if (conf.tipo === "visitas") {
    const ids = anunciosDaLeitura(caminho);
    const donos = [];
    for (const p of caminhosDonoDosAnuncios(ids)) {
      const r = await get(p);
      if (!r.ok) return json({ ok: false, status: r.status, erro: `Não foi possível conferir o dono dos anúncios: ${r.erro}` });
      donos.push(r.dados);
    }
    if (!anunciosSaoDaConta(ids, donos, conta)) return json({ ok: false, status: 403, erro: "Visitas só de anúncios da conta informada." });
  }

  // 5) A leitura pedida
  return json(await get(caminho));
});

/** GET na API do Mercado Livre (somente leitura), nova tentativa em 429/5xx. */
function getML(token: string) {
  return async (caminho: string) => {
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const r = await fetch(`${ML}${caminho}`, { method: "GET", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
      if (r.status === 429 || r.status >= 500) { await new Promise((ok) => setTimeout(ok, 800 * (tentativa + 1))); continue; }
      const dados = await r.json().catch(() => null);
      return r.ok ? { ok: true, status: r.status, dados } : { ok: false, status: r.status, erro: dados?.message || dados?.error || `HTTP ${r.status}` };
    }
    return { ok: false, status: 429, erro: "Mercado Livre limitou as consultas." };
  };
}
