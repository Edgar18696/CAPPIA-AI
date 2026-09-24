// =============================================================
// EDGE FUNCTION — paizinho-fontes-originais
// -------------------------------------------------------------
// ⚠️ NÃO PUBLICADA. Criada para validação. Publicar só com aprovação.
//    (usa OPENAI_API_KEY — cada pesquisa é uma chamada paga)
//
// Recebe { codigo } e procura o código SOMENTE em domínios oficiais
// (montadoras, fabricantes, documentação técnica, TecDoc), usando a
// ferramenta web_search da OpenAI com allowed_domains.
//
// Devolve { ok, fontes: [{ url, titulo, evidencia, codigoMencionado,
// dados: {...} }], consultas }. A decisão do que é "confirmado" é feita
// no cliente (validarResultadoPesquisa.js); aqui só coletamos e
// descartamos qualquer URL fora da lista oficial.
// =============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "npm:openai";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function resposta(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

// Mesma lista de src/services/paizinhoPesquisa/fontesOriginais.js
// (manter as duas iguais).
const DOMINIOS_MONTADORAS = [
  "pecachevrolet.com.br", "gmparts.com", "mecanico.renault.com.br",
  "reparador.fiat.com.br", "moparoficial.com.br", "mopar.com",
  "servicebox-parts.com", "pecas.vw.com.br", "reparadorvw.com.br",
  "ford.com.br", "reparadorford.com.br", "autoparts.toyota.com",
  "nissan.com.br", "hyundaimobis.com.br", "kia.com.br",
  "mitsubishimotors.com.br", "mercedes-benz.com.br", "volvopecas.com.br",
  "volvotrucks.com.br",
];

const DOMINIOS_FABRICANTES = [
  "boschaftermarket.com", "bosch.com.br", "mmcofap.com.br",
  "magnetimarelli-parts-and-services.com", "ngkntk.com.br",
  "densoautoparts.com", "denso.com", "delphiautoparts.com",
  "delphi.catalogofraga.com.br", "continental-aftermarket.com", "vdo.com",
  "catalogoexpresso.com.br", "mte-thomson.com.br", "tsadobrasil.com.br",
  "ds.ind.br", "3rho.com.br", "kostalbrasil.com.br", "ms-motorservice.com.br",
  "catalogo.mahle.com", "valeoservice.com.br", "hella.com",
  "catalogonakata.com.br", "autoexperts.parts", "web.tecalliance.net",
  "tecalliance.com.br",
];

const TODOS_OFICIAIS = [...DOMINIOS_FABRICANTES, ...DOMINIOS_MONTADORAS];

function hostOficial(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return TODOS_OFICIAIS.some((d) => host === d || host.endsWith("." + d));
  } catch {
    return false;
  }
}

function chaveUrl(url: string) {
  try {
    const u = new URL(String(url || "").trim());
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const caminho = u.pathname.replace(/\/+$/, "") || "/";
    [...u.searchParams.keys()].filter((k) => /^utm_|^gclid$|^fbclid$/i.test(k)).forEach((k) => u.searchParams.delete(k));
    const q = u.searchParams.toString();
    return `${host}${caminho}${q ? "?" + q : ""}`.toLowerCase();
  } catch {
    return "";
  }
}

// URLs que a ferramenta de busca REALMENTE devolveu/citou
// deno-lint-ignore no-explicit-any
function urlsDaPesquisaReal(resposta: any) {
  const urls = new Set<string>();
  for (const item of resposta?.output || []) {
    if (item?.type === "web_search_call") {
      for (const s of item.action?.sources || []) if (s?.url) urls.add(chaveUrl(s.url));
      if (item.action?.url) urls.add(chaveUrl(item.action.url));
    }
    if (item?.type === "message") {
      for (const c of item.content || []) {
        for (const a of c?.annotations || []) if (a?.type === "url_citation" && a.url) urls.add(chaveUrl(a.url));
      }
    }
  }
  urls.delete("");
  return urls;
}

function lotes<T>(lista: T[], tamanho: number) {
  const saida: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) saida.push(lista.slice(i, i + tamanho));
  return saida;
}

function limparJson(valor: string) {
  const t = String(valor || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const inicio = t.indexOf("{");
  const fim = t.lastIndexOf("}");
  return inicio >= 0 && fim > inicio ? t.slice(inicio, fim + 1) : "{}";
}

const INSTRUCOES = `Você é um pesquisador técnico de autopeças. Pesquise o código informado
SOMENTE nos domínios permitidos. Regras obrigatórias:
- Só registre uma fonte se a página mostrar LITERALMENTE o código pesquisado.
- Copie em "evidencia" o trecho literal da página onde o código aparece.
- Não deduza, não complete e não invente: aplicação, montadora, modelo,
  versão, ano, motor, código OEM, equivalência ou especificação que não
  estejam escritos na própria página devem ficar vazios.
- Separe códigos OEM (da montadora), substitutos e equivalentes (outros fabricantes).
- Se não encontrar nada confiável, devolva "fontes": [].
Responda APENAS com JSON no formato:
{"fontes":[{"url":"","titulo":"","evidencia":"","codigoMencionado":"",
"dados":{"fabricante":"","descricao":"","codigos_oem":[],"codigos_substitutos":[],
"codigos_equivalentes":[],"aplicacoes":[{"montadora":"","modelo":"","versao":"",
"motor":"","ano_inicio":null,"ano_fim":null}],"especificacoes":[{"nome":"","valor":""}]}}]}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return resposta({ ok: false, erro: "Método não permitido." }, 405);

  // Somente usuário autenticado
  const authHeader = req.headers.get("Authorization") || "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: usuario } = await supabase.auth.getUser();
  if (!usuario?.user) return resposta({ ok: false, erro: "Não autenticado." }, 401);

  let corpo: { codigo?: string } = {};
  try {
    corpo = await req.json();
  } catch {
    return resposta({ ok: false, erro: "JSON inválido." }, 400);
  }
  const codigo = String(corpo?.codigo ?? "").trim().slice(0, 60);
  if (!codigo || !/[A-Za-z0-9]/.test(codigo)) {
    return resposta({ ok: false, erro: "Código inválido." }, 400);
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return resposta({ ok: false, erro: "OPENAI_API_KEY não configurada." }, 500);

  const openai = new OpenAI({ apiKey });
  const modelo = Deno.env.get("PAIZINHO_PESQUISA_MODELO") || "gpt-4.1-mini";

  // Ordem: fabricantes (mais comuns em código de peça), depois montadoras.
  const passes = [
    ...lotes(DOMINIOS_FABRICANTES, 20).map((d) => ({ grupo: "fabricantes", dominios: d })),
    ...lotes(DOMINIOS_MONTADORAS, 20).map((d) => ({ grupo: "montadoras", dominios: d })),
  ];

  const fontes: unknown[] = [];
  const consultas: unknown[] = [];

  for (const passe of passes) {
    const inicio = new Date().toISOString();
    try {
      const r = await openai.responses.create({
        model: modelo,
        tools: [{ type: "web_search", filters: { allowed_domains: passe.dominios } }],
        include: ["web_search_call.action.sources"],
        instructions: INSTRUCOES,
        input: `Código pesquisado: ${codigo}`,
      } as never);

      const json = JSON.parse(limparJson((r as { output_text?: string }).output_text || ""));
      const encontradas = Array.isArray(json?.fontes) ? json.fontes : [];
      // Filtro do servidor: descarta qualquer URL fora da lista oficial.
      // e descarta URL que não veio da busca real (evita URL inventada).
      const reais = urlsDaPesquisaReal(r);
      const oficiais = encontradas.filter((f: { url?: string }) => {
        const url = String(f?.url || "");
        return hostOficial(url) && reais.has(chaveUrl(url));
      });
      fontes.push(...oficiais);
      consultas.push({
        grupo: passe.grupo,
        dominios: passe.dominios,
        inicio,
        retornadas: encontradas.length,
        aceitas: oficiais.length,
      });
      // Encontrou em fabricante com evidência: não precisa gastar mais passes.
      if (oficiais.length >= 2) break;
    } catch (erro) {
      consultas.push({ grupo: passe.grupo, dominios: passe.dominios, inicio, erro: String(erro) });
    }
  }

  return resposta({ ok: true, codigo, fontes, consultas });
});
