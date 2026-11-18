// =============================================================
// PAIIA — paizinho-bling-compras (18/11/2026): CUSTO DA ÚLTIMA COMPRA no Bling.
// SÓ LEITURA (somente GET na API v3 do Bling). Usada pela auditoria da Central do
// Paizinho quando o custo CADASTRADO no produto está zerado/vazio.
// - Login obrigatório; usa o acesso do Bling do PRÓPRIO usuário (contas_marketplace).
// - Não renova nem altera o acesso: se estiver vencido, avisa (a ação custo_por_sku
//   da bling-integracao, chamada antes na análise, é quem renova).
// - Fonte: pedidos de compra ATENDIDOS (ver src/services/paizinhoAuditoria/ultimaCompra.js).
// - Leitura em partes (para caber no tempo da função): devolve `proximo` para continuar.
// - Nunca devolve token. Não grava nada.
// Segredos: só os automáticos (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).
// =============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";
import { buscarUltimasCompras } from "../../../src/services/paizinhoAuditoria/ultimaCompra.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const API = "https://api.bling.com.br/Api/v3";
const env = (n: string) => Deno.env.get(n) || "";
const responder = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...CORS, "content-type": "application/json" } });
const dataValida = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder({ ok: false, erro: "Use POST." }, 405);
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const sb = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const { data: u } = jwt ? await sb.auth.getUser(jwt) : { data: null };
  const usuarioId = u?.user?.id;
  if (!usuarioId) return responder({ ok: false, erro: "Entre no PAIIA." }, 401);

  let corpo: any = {};
  try { corpo = await req.json(); } catch { /* vazio */ }
  const skus = (Array.isArray(corpo?.skus) ? corpo.skus : []).map((s: unknown) => String(s || "").trim()).filter(Boolean).slice(0, 500);
  if (!skus.length) return responder({ ok: false, erro: "Informe os SKUs." });
  const idsPorSku: Record<string, string> = {};
  for (const [k, v] of Object.entries(corpo?.idsPorSku || {})) if (/^\d+$/.test(String(v))) idsPorSku[k] = String(v);
  const hoje = new Date();
  const padrao = new Date(hoje.getTime() - 18 * 30 * 86400000).toISOString().slice(0, 10);
  const desde = dataValida(corpo?.desde) ? String(corpo.desde) : padrao;
  const inicioEm = Math.max(0, Math.floor(Number(corpo?.inicioEm) || 0));

  const { data: conta } = await sb.from("contas_marketplace").select("access_token, expires_at").eq("usuario_id", usuarioId).eq("marketplace", "bling").limit(1).maybeSingle();
  if (!conta?.access_token) return responder({ ok: false, erro: "Bling não conectado nesta conta do PAIIA." });
  if (conta.expires_at && new Date(conta.expires_at).getTime() < Date.now() + 60000) return responder({ ok: false, erro: "Acesso do Bling vencido: abra o custo de um produto (ou rode a análise de novo) para renovar e tente outra vez.", vencido: true });

  const blingGet = async (caminho: string, tentativa = 1): Promise<any> => {
    const r = await fetch(API + caminho, { headers: { Authorization: `Bearer ${conta.access_token}`, Accept: "application/json" } });
    if (r.status === 429 && tentativa < 4) { await new Promise((ok) => setTimeout(ok, 1500 * tentativa)); return blingGet(caminho, tentativa + 1); }
    if (!r.ok) throw new Error(`Bling HTTP ${r.status} em ${caminho.split("?")[0].replace(/\d+/g, "{id}")}`);
    return r.json();
  };
  try {
    const r = await buscarUltimasCompras({ blingGet, skus, desde, idsPorSku, inicioEm, limiteMs: 100000 });
    return responder(r);
  } catch (e) {
    return responder({ ok: false, erro: String((e as Error)?.message || e).slice(0, 200) });
  }
});
