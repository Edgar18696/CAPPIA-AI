import { createClient } from "@supabase/supabase-js";

// (18/11) PRODUÇÃO por padrão. Só no modo "staging" (vite --mode staging) usa o
// Supabase de TESTE informado em .env.staging.local (VITE_SUPABASE_URL /
// VITE_SUPABASE_ANON_KEY). O modo staging NUNCA aceita o projeto de produção.
const PRODUCAO_REF = "arqzpqkkpwikyecdbopf";
const PRODUCAO_URL = "https://" + PRODUCAO_REF + ".supabase.co";
const PRODUCAO_KEY =
  "sb_publishable_mZKsf_QQVl3i309rw5MrlA_8JcT9chX";

const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
export const ambienteSupabase = env.MODE === "staging" ? "staging" : "producao";
if (ambienteSupabase === "staging" && (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY || String(env.VITE_SUPABASE_URL).includes(PRODUCAO_REF))) {
  throw new Error("BLOQUEADO: modo staging sem Supabase de teste configurado (a produção nunca é usada neste modo).");
}

export const supabaseUrl = ambienteSupabase === "staging" ? env.VITE_SUPABASE_URL : PRODUCAO_URL;

export const supabaseKey = ambienteSupabase === "staging" ? env.VITE_SUPABASE_ANON_KEY : PRODUCAO_KEY;

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);

// Aviso fixo na tela quando o PAIIA está ligado ao banco de TESTE.
if (ambienteSupabase === "staging" && typeof document !== "undefined") {
  const faixa = document.createElement("div");
  faixa.textContent = "AMBIENTE DE TESTE (STAGING) — nada aqui altera o PAIIA oficial";
  faixa.setAttribute("data-paiia-staging", "");
  faixa.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#b45309;color:#fff;font:700 13px system-ui;text-align:center;padding:4px;pointer-events:none";
  document.addEventListener("DOMContentLoaded", () => document.body.appendChild(faixa));
  if (document.body) document.body.appendChild(faixa);
}
