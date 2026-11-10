// =============================================================
// PAIIA — Edge Function "paizinho-auditoria" (PILOTO — NÃO PUBLICADA).
// Central do Paizinho Inteligente: auditoria comercial diária às 03h
// (horário de Brasília) da conta Mercado Livre LOJA ONLINE.
//
// SOMENTE LEITURA no Mercado Livre: só GET na API. A única gravação é o
// relatório em public.paiia_paizinho_relatorios (e a renovação do token da
// conta, igual às outras funções do ML, quando ele vence).
//
// Chamada pelo agendamento (pg_cron + pg_net) com o cabeçalho
//   x-paizinho-chave: <segredo PAIZINHO_AUDITORIA_CHAVE>
// Corpo: { conta?: "1729335019", modo?: "executar" | "simular" }
//   simular = devolve o relatório sem gravar.
//
// Segredos (Supabase → Edge Functions → Secrets), nenhum fica no código:
//   PAIZINHO_AUDITORIA_CHAVE             segredo do agendamento
//   PAIZINHO_AUDITORIA_USUARIO_ID        usuário PAIIA dono da conta
//   PAIZINHO_AUDITORIA_IMPOSTO_PCT       (opcional) imposto sobre a venda
//   PAIZINHO_AUDITORIA_CONCORRENCIA      (opcional) nº de pesquisas/dia (padrão 0: usa créditos SerpAPI)
//   ML_CLIENT_ID / ML_CLIENT_SECRET      já existentes (renovação do token)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  automáticos
// =============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";
// Motor compartilhado com o PAIIA (mesmo código dos testes e do teste local).
import { executarAuditoria, contaLiberada } from "../../../src/services/paizinhoAuditoria/index.js";

const ML = "https://api.mercadolibre.com";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paizinho-chave",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
const env = (k: string) => (Deno.env.get(k) || "").trim();

// deno-lint-ignore no-explicit-any
type Sb = any;

/** Token da conta (renova se faltar menos de 10 min), sem nunca devolvê-lo ao chamador. */
async function tokenDaConta(sb: Sb, usuarioId: string, conta: string): Promise<string> {
  const { data: c, error } = await sb.from("contas_marketplace")
    .select("id, access_token, refresh_token, expires_at")
    .eq("usuario_id", usuarioId).eq("marketplace", "mercado_livre").eq("ml_user_id", conta)
    .maybeSingle();
  if (error || !c?.access_token) throw new Error("Conta Mercado Livre não conectada no PAIIA.");
  const vence = c.expires_at ? new Date(c.expires_at).getTime() : 0;
  if (vence - Date.now() > 10 * 60 * 1000) return c.access_token;
  if (!c.refresh_token) throw new Error("Token da conta vencido e sem renovação: reconectar a conta no PAIIA.");
  const r = await fetch(`${ML}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: env("ML_CLIENT_ID"), client_secret: env("ML_CLIENT_SECRET"), refresh_token: c.refresh_token }),
  });
  const t = await r.json().catch(() => ({}));
  if (!r.ok || !t?.access_token) throw new Error("Não foi possível renovar o token da conta Mercado Livre.");
  await sb.from("contas_marketplace").update({
    access_token: t.access_token,
    refresh_token: t.refresh_token || c.refresh_token,
    expires_at: new Date(Date.now() + Number(t.expires_in || 21600) * 1000).toISOString(),
  }).eq("id", c.id);
  return t.access_token;
}

/** GET na API do ML (somente leitura), com uma nova tentativa em 429/5xx. */
function consultorML(token: string) {
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

/** Concorrência pela função existente "concorrencia" (usa créditos SerpAPI). */
function buscadorConcorrencia(limite: number) {
  if (!(limite > 0)) return null;
  return async (item: Record<string, unknown>) => {
    const attrs = (item.attributes as Array<{ id: string; value_name?: string }>) || [];
    const a = (id: string) => attrs.find((x) => x.id === id)?.value_name || "";
    const marca = a("BRAND");
    const original = /^(renault|volkswagen|vw|chevrolet|gm|fiat|ford|toyota|honda|hyundai|nissan|peugeot|citroen)$/i.test(marca.trim());
    const r = await fetch(`${env("SUPABASE_URL")}/functions/v1/concorrencia`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: JSON.stringify({ codigo: a("PART_NUMBER") || a("OEM"), titulo: item.title, fabricante: marca, categoria: original ? "original" : "equivalente" }),
    });
    const d = await r.json().catch(() => null);
    return r.ok && d?.sucesso ? { ok: true, faixaComparavel: d.faixaComparavel, palavrasChaveSugeridas: d.palavrasChaveSugeridas } : { ok: false, erro: d?.error || `HTTP ${r.status}` };
  };
}

/** Tabela Renault (public.paiia_tabela_renault), se existir. */
async function tabelaRenault(sb: Sb) {
  const { data, error } = await sb.from("paiia_tabela_renault").select("codigo, preco").limit(50000);
  if (error || !Array.isArray(data) || !data.length) return null;
  const mapa = new Map(data.map((l: { codigo: string; preco: number }) => [String(l.codigo).toUpperCase().replace(/[^A-Z0-9]/g, ""), Number(l.preco)]));
  return ({ codigo }: { codigo: string }) => mapa.get(String(codigo || "").toUpperCase().replace(/[^A-Z0-9]/g, "")) ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, erro: "Use POST." }, 405);
  const chave = env("PAIZINHO_AUDITORIA_CHAVE");
  if (!chave || req.headers.get("x-paizinho-chave") !== chave) return json({ ok: false, erro: "Não autorizado." }, 401);

  const corpo = await req.json().catch(() => ({}));
  const conta = String(corpo?.conta || "1729335019").replace(/\D/g, "");
  const liberada = contaLiberada(conta);
  if (!liberada) return json({ ok: false, erro: "Conta não liberada para a auditoria (piloto: LOJA ONLINE)." }, 400);
  const simular = corpo?.modo === "simular";
  const usuarioId = env("PAIZINHO_AUDITORIA_USUARIO_ID");
  if (!usuarioId) return json({ ok: false, erro: "PAIZINHO_AUDITORIA_USUARIO_ID não configurado." }, 500);

  const sb = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const agora = new Date().toISOString();
  let registroId: string | null = null;
  if (!simular) {
    const { data, error } = await sb.from("paiia_paizinho_relatorios")
      .insert({ usuario_id: usuarioId, conta_ml: liberada.id, conta_nome: liberada.nome, status: "executando", iniciado_em: agora, origem: "agendamento_03h" })
      .select("id").single();
    if (error) return json({ ok: false, erro: `Não foi possível registrar a execução: ${error.message}` }, 500);
    registroId = data.id;
  }

  const trabalho = async () => {
    try {
      const token = await tokenDaConta(sb, usuarioId, liberada.id);
      const imposto = env("PAIZINHO_AUDITORIA_IMPOSTO_PCT");
      const limiteConc = Number(env("PAIZINHO_AUDITORIA_CONCORRENCIA") || 0);
      const relatorio = await executarAuditoria({
        conta: liberada.id,
        consultar: consultorML(token),
        consultarBling: null, // Bling no servidor: depende do código atual da função bling-integracao
        buscarConcorrentes: buscadorConcorrencia(limiteConc),
        precoTabelaRenault: await tabelaRenault(sb),
        config: { impostoPercentual: imposto ? Number(imposto.replace(",", ".")) : null },
        opcoesColeta: { limiteConcorrencia: limiteConc },
        origem: simular ? "simulacao_servidor" : "agendamento_03h",
        agora,
      });
      if (registroId) {
        await sb.from("paiia_paizinho_relatorios").update({ status: "concluido", concluido_em: new Date().toISOString(), data_referencia: relatorio.data_referencia, relatorio }).eq("id", registroId);
      }
      return relatorio;
    } catch (e) {
      const erro = e instanceof Error ? e.message : String(e);
      if (registroId) await sb.from("paiia_paizinho_relatorios").update({ status: "erro", concluido_em: new Date().toISOString(), erro }).eq("id", registroId);
      throw e;
    }
  };

  if (simular) {
    try { return json({ ok: true, relatorio: await trabalho() }); } catch (e) { return json({ ok: false, erro: e instanceof Error ? e.message : String(e) }, 500); }
  }
  // Agendamento: responde na hora e termina a auditoria em segundo plano.
  // @ts-ignore EdgeRuntime existe no runtime do Supabase
  EdgeRuntime.waitUntil(trabalho().catch(() => {}));
  return json({ ok: true, iniciado: true, id: registroId }, 202);
});
