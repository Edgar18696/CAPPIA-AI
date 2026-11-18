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

// (18/11) Acesso de DEMONSTRAÇÃO: só no modo staging, só com o banco de TESTE e só com o
// usuário/senha de teste do .env.staging.local (nunca vai para o git nem para a produção).
const demoEmail = ambienteSupabase === "staging" ? env.VITE_STAGING_DEMO_EMAIL : "";
const demoSenha = ambienteSupabase === "staging" ? env.VITE_STAGING_DEMO_PASSWORD : "";
export const temAcessoDeTeste = !!(demoEmail && demoSenha && ambienteSupabase === "staging" && !String(supabaseUrl).includes(PRODUCAO_REF));

/** Botão "Entrar no Teste": entra com o usuário de TESTE do STAGING e recarrega a página. */
export async function entrarNoTeste() {
  if (!temAcessoDeTeste) throw new Error("Acesso de teste disponível só no ambiente de TESTE (STAGING).");
  const { error } = await supabase.auth.signInWithPassword({ email: demoEmail, password: demoSenha });
  if (error) throw new Error(`Não foi possível entrar no teste: ${error.message}`);
  if (typeof window !== "undefined") window.location.reload();
}

// Aviso fixo na tela quando o PAIIA está ligado ao banco de TESTE (com o botão "Entrar no Teste").
if (ambienteSupabase === "staging" && typeof document !== "undefined") {
  const faixa = document.createElement("div");
  faixa.setAttribute("data-paiia-staging", "");
  faixa.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#b45309;color:#fff;font:700 13px system-ui;text-align:center;padding:4px;display:flex;gap:10px;justify-content:center;align-items:center;flex-wrap:wrap";
  const texto = document.createElement("span");
  texto.textContent = "AMBIENTE DE TESTE (STAGING) — anúncios fictícios; nada aqui altera o PAIIA oficial";
  faixa.appendChild(texto);
  if (temAcessoDeTeste) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = "Entrar no Teste";
    botao.setAttribute("data-paiia-entrar-teste", "");
    botao.style.cssText = "border:1px solid #fff;border-radius:8px;background:#fff;color:#b45309;font:800 13px system-ui;padding:3px 12px;cursor:pointer";
    botao.onclick = () => { botao.disabled = true; botao.textContent = "Entrando…"; entrarNoTeste().catch((e) => { botao.disabled = false; botao.textContent = "Entrar no Teste"; window.alert(e.message); }); };
    faixa.appendChild(botao);
    const mostrar = (logado) => { botao.style.display = logado ? "none" : ""; texto.textContent = logado ? "AMBIENTE DE TESTE (STAGING) — conectado como usuário de teste; anúncios fictícios; nada aqui altera o PAIIA oficial" : "AMBIENTE DE TESTE (STAGING) — anúncios fictícios; nada aqui altera o PAIIA oficial"; };
    supabase.auth.getSession().then(({ data }) => mostrar(!!data?.session)).catch(() => {});
    supabase.auth.onAuthStateChange((_e, sessao) => mostrar(!!sessao));
  }
  document.addEventListener("DOMContentLoaded", () => document.body.appendChild(faixa));
  if (document.body) document.body.appendChild(faixa);
}
