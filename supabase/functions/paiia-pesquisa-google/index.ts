// =============================================================
// EDGE FUNCTION — paiia-pesquisa-google (24/11/2026)
// -------------------------------------------------------------
// Buscar e Montar Anúncio: UMA busca no Google Brasil (SerpApi) pelo código da peça
// (e, só se nenhum resultado citar o código, UMA no Google França — máximo 2 créditos),
// quando o código não está nos catálogos. Devolve só títulos, trechos e links
// (a montagem do texto é feita no PAIIA, por regras fixas, sem IA).
//
// Proteções:
//  - só usuário logado (token conferido no servidor de autenticação);
//  - a chave SERPAPI_KEY fica só no servidor; nunca volta na resposta;
//  - reaproveita o resultado do MESMO código por 30 dias (tabela
//    paiia_pesquisas_externas, provedor "serpapi_google") — não paga de novo;
//  - limite de buscas NOVAS por usuário por dia (LIMITE_DIARIO);
//  - Shopee é descartada; nada é publicado nem alterado em lugar nenhum.
// =============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const PROVEDOR = "serpapi_google";
const VALIDADE_DIAS = 30;
const LIMITE_DIARIO = Number(Deno.env.get("PAIIA_PESQUISA_GOOGLE_LIMITE_DIA") || "40");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const responder = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
const texto = (v: unknown) => String(v ?? "").trim();
const normalizar = (v: unknown) => texto(v).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const ehShopee = (link: string) => { try { return /(^|\.)shopee\./i.test(new URL(link).hostname); } catch { return false; } };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const corpo = await req.json().catch(() => ({}));
    const url = Deno.env.get("SUPABASE_URL");
    const chaveServico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !chaveServico) return responder({ ok: false, erro: "Credenciais internas não configuradas." });
    const admin = createClient(url, chaveServico, { auth: { persistSession: false, autoRefreshToken: false } });

    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: dadosUsuario } = await admin.auth.getUser(jwt);
    const usuarioId = dadosUsuario?.user?.id || "";
    if (!usuarioId) return responder({ ok: false, erro: "Usuário não autenticado. Entre novamente no PAIIA." });

    const codigo = texto(corpo?.codigo);
    const alvo = normalizar(codigo);
    if (!/^[A-Za-z0-9][A-Za-z0-9.\-_/ ]{2,40}$/.test(codigo) || alvo.length < 4) return responder({ ok: false, erro: "Código inválido para a pesquisa." });

    // 1) Reaproveita a pesquisa do MESMO código feita nos últimos 30 dias.
    //    (24/11) Brasil sem o código e França ainda não tentada: tenta SÓ a França (sem repetir o Brasil).
    const desde = new Date(Date.now() - VALIDADE_DIAS * 86400000).toISOString();
    const { data: guardada } = await admin.from("paiia_pesquisas_externas")
      .select("id, criado_em, status, fontes_consultadas, consultas_realizadas")
      .eq("provedor", PROVEDOR).eq("codigo_normalizado", alvo).in("status", ["encontrado", "nao_identificado"])
      .gte("criado_em", desde).order("criado_em", { ascending: false }).limit(1).maybeSingle();
    const consultasGuardadas: any[] = Array.isArray(guardada?.consultas_realizadas) ? guardada.consultas_realizadas : [];
    const tentouFranca = consultasGuardadas.some((c: any) => c?.gl === "fr");
    if (guardada && (guardada.status === "encontrado" || tentouFranca)) {
      return responder({ ok: true, reaproveitada: true, buscado_em: guardada.criado_em, resultados: Array.isArray(guardada.fontes_consultadas) ? guardada.fontes_consultadas : [] });
    }

    // 2) Limite de buscas NOVAS por usuário por dia (protege os créditos).
    const hoje = new Date(); hoje.setUTCHours(0, 0, 0, 0);
    const { count } = await admin.from("paiia_pesquisas_externas")
      .select("id", { count: "exact", head: true })
      .eq("provedor", PROVEDOR).eq("user_id", usuarioId).gte("criado_em", hoje.toISOString());
    if (!guardada && (count || 0) >= LIMITE_DIARIO) return responder({ ok: false, limite: true, erro: `Limite de ${LIMITE_DIARIO} pesquisas novas por dia atingido. Os códigos já pesquisados continuam disponíveis.` });

    // Chave própria do Buscar e Montar, se configurada; senão, a SERPAPI_KEY (a mesma da Concorrência).
    const chave = Deno.env.get("SERPAPI_KEY_BUSCAR_MONTAR") || Deno.env.get("SERPAPI_KEY");
    if (!chave) return responder({ ok: false, indisponivel: true, erro: "Pesquisa no Google indisponível neste ambiente." });

    // 3) Google Brasil (1 crédito); se nenhum resultado citar o código, Google França (+1 crédito). Máximo 2.
    const buscar = async (gl: string, hl: string, dominio: string) => {
      const p = new URLSearchParams({ engine: "google", q: codigo, gl, hl, google_domain: dominio, num: "10", api_key: chave });
      const r = await fetch(`https://serpapi.com/search.json?${p}`);
      const dados = await r.json().catch(() => ({}));
      if (!r.ok || dados?.error) throw new Error(`A pesquisa no Google não respondeu (${texto(dados?.error) || `HTTP ${r.status}`}).`);
      const lista = (Array.isArray(dados?.organic_results) ? dados.organic_results : [])
        .map((o: any) => ({ titulo: texto(o?.title).slice(0, 200), trecho: texto(o?.snippet).slice(0, 400), link: texto(o?.link), idioma: gl === "fr" ? "fr" : "pt" }))
        .filter((o: any) => /^https:\/\//i.test(o.link) && !ehShopee(o.link))
        .slice(0, 10);
      return { lista, consulta: { provedor: PROVEDOR, q: codigo, gl, quando: new Date().toISOString(), creditos: 1, id_busca: texto(dados?.search_metadata?.id) } };
    };
    const cita = (lista: any[]) => lista.some((o: any) => normalizar(`${o.titulo} ${o.trecho}`).includes(alvo));
    const consultas: any[] = [...consultasGuardadas];
    let resultados: any[] = guardada && Array.isArray(guardada.fontes_consultadas) ? guardada.fontes_consultadas : [];
    if (!guardada) {
      const br = await buscar("br", "pt-br", "google.com.br");
      consultas.push(br.consulta);
      resultados = br.lista;
    }
    if (!cita(resultados)) {
      const fr = await buscar("fr", "fr", "google.fr");
      consultas.push(fr.consulta);
      if (cita(fr.lista)) resultados = fr.lista;
    }
    const agora = new Date().toISOString();
    const linha = { status: cita(resultados) ? "encontrado" : "nao_identificado", fontes_consultadas: resultados, consultas_realizadas: consultas };
    if (guardada) await admin.from("paiia_pesquisas_externas").update(linha).eq("id", guardada.id);
    else await admin.from("paiia_pesquisas_externas").insert({ codigo_pesquisado: codigo, codigo_normalizado: alvo, user_id: usuarioId, iniciado_em: agora, provedor: PROVEDOR, ...linha });
    return responder({ ok: true, reaproveitada: false, buscado_em: agora, resultados });
  } catch (e) {
    return responder({ ok: false, erro: `Falha na pesquisa (${(e as Error)?.message || e}).` });
  }
});
