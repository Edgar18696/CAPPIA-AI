// =============================================================
// PAIZINHO — PESQUISA EM FONTES ORIGINAIS (lado servidor, Node)
// -------------------------------------------------------------
// Usado SOMENTE no ambiente local (npm run dev), pelo plugin
// vitePluginPesquisaLocal.mjs. A chave OPENAI_API_KEY fica no
// servidor local (.env.local) e nunca vai para o navegador.
//
// Regras aplicadas aqui (antes da validação do navegador):
//   • a busca é limitada aos domínios oficiais (allowed_domains);
//   • só aceita URL oficial que veio da busca real (citação/fonte
//     devolvida pela ferramenta) — URL "lembrada" pelo modelo é descartada;
//   • quando a página oficial pode ser lida e NÃO contém o código,
//     a fonte é descartada.
// =============================================================

import { classificarFonte, dominiosOficiais } from "../../src/services/paizinhoPesquisa/fontesOriginais.js";
import {
  normalizarCodigo,
  variantesEscrita,
  textoContemCodigo,
} from "../../src/services/paizinhoPesquisa/codigoPaizinho.js";

const MODELO_PADRAO = "gpt-4.1-mini";
const TEMPO_PAGINA_MS = 8000;

export const INSTRUCOES_PESQUISA = `Você é um pesquisador técnico de autopeças no Brasil.
Pesquise o código informado usando a ferramenta de busca, SOMENTE nos domínios permitidos
(catálogos e sites oficiais de montadoras e fabricantes de peças).
Regras obrigatórias:
- O código pode aparecer escrito com espaços, hífens ou pontos (as formas de escrita
  informadas são o MESMO código). Nunca aceite um código diferente, mais longo, com
  sufixo ou "parecido" — isso é outra peça.
- Só registre uma fonte se a própria página mostrar LITERALMENTE o código pesquisado.
- Use exatamente a URL da página consultada (a mesma que você cita).
- Copie em "evidencia" o trecho literal da página onde o código aparece.
- Não deduza, não complete e não invente: aplicação, montadora, modelo, versão, ano,
  motor, código OEM, equivalência ou especificação que não estejam escritos na página
  devem ficar vazios.
- "codigos_oem" = códigos da montadora; "codigos_equivalentes"/"codigos_substitutos" =
  outros fabricantes ou códigos que substituem.
- Se não encontrar nada confiável, devolva {"fontes": []}.
Responda APENAS com JSON válido, sem texto antes ou depois, no formato:
{"fontes":[{"url":"","titulo":"","evidencia":"","codigoMencionado":"",
"dados":{"fabricante":"","descricao":"","codigos_oem":[],"codigos_substitutos":[],
"codigos_equivalentes":[],"aplicacoes":[{"montadora":"","modelo":"","versao":"",
"motor":"","combustivel":"","ano_inicio":null,"ano_fim":null}],"especificacoes":[{"nome":"","valor":""}]}}]}`;

export function normalizarCodigoServidor(v) {
  return normalizarCodigo(v);
}

/** URL comparável: sem www, sem barra final, sem #, sem parâmetros de rastreio. */
export function chaveUrl(url) {
  try {
    const u = new URL(String(url || "").trim());
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    [...u.searchParams.keys()]
      .filter((k) => /^utm_|^gclid$|^fbclid$/i.test(k))
      .forEach((k) => u.searchParams.delete(k));
    const caminho = u.pathname.replace(/\/+$/, "") || "/";
    const q = u.searchParams.toString();
    return `${host}${caminho}${q ? "?" + q : ""}`.toLowerCase();
  } catch {
    return "";
  }
}

function limparJson(valor) {
  const t = String(valor || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const inicio = t.indexOf("{");
  const fim = t.lastIndexOf("}");
  return inicio >= 0 && fim > inicio ? t.slice(inicio, fim + 1) : "{}";
}

/** URLs que a ferramenta de busca REALMENTE devolveu/citou. */
export function urlsDaPesquisaReal(resposta) {
  const urls = new Set();
  for (const item of resposta?.output || []) {
    if (item?.type === "web_search_call") {
      const acao = item.action || {};
      for (const s of acao.sources || []) if (s?.url) urls.add(chaveUrl(s.url));
      if (acao.url) urls.add(chaveUrl(acao.url));
    }
    if (item?.type === "message") {
      for (const c of item.content || []) {
        for (const a of c?.annotations || []) {
          if (a?.type === "url_citation" && a.url) urls.add(chaveUrl(a.url));
        }
      }
    }
  }
  urls.delete("");
  return urls;
}

function textoDaResposta(resposta) {
  if (resposta?.output_text) return resposta.output_text;
  const partes = [];
  for (const item of resposta?.output || []) {
    if (item?.type === "message") {
      for (const c of item.content || []) if (c?.text) partes.push(c.text);
    }
  }
  return partes.join("\n");
}

function htmlParaTexto(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Abre a página oficial (1 requisição, sem navegar) e confere se o código
 * aparece nela. Retorna true / false / null (não deu para verificar).
 */
export async function verificarCodigoNaPagina(url, codigo, fetchImpl = fetch) {
  const alvo = normalizarCodigoServidor(codigo);
  if (!alvo) return { resultado: null, motivo: "código vazio" };
  const controle = new AbortController();
  const t = setTimeout(() => controle.abort(), TEMPO_PAGINA_MS);
  try {
    const r = await fetchImpl(url, {
      signal: controle.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (PAIIA verificador de fonte)", Accept: "text/html,*/*" },
    });
    if (!r.ok) return { resultado: null, motivo: `HTTP ${r.status}` };
    const tipo = r.headers.get("content-type") || "";
    if (!/text|html|json|xml/i.test(tipo)) return { resultado: null, motivo: `conteúdo ${tipo}` };
    const texto = htmlParaTexto(await r.text());
    if (textoContemCodigo(texto, alvo)) return { resultado: true, motivo: "código presente na página" };
    // Página com conteúdo real e sem o código → não confirma.
    if (texto.trim().length >= 1500) return { resultado: false, motivo: "página lida e o código não aparece" };
    return { resultado: null, motivo: "página carregada por script (não deu para ler)" };
  } catch (e) {
    return { resultado: null, motivo: e?.name === "AbortError" ? "tempo esgotado" : String(e?.message || e) };
  } finally {
    clearTimeout(t);
  }
}

async function consultarModelo(openai, modelo, codigo, dominios) {
  return openai.responses.create({
    model: modelo,
    tools: [{ type: "web_search", filters: { allowed_domains: dominios } }],
    include: ["web_search_call.action.sources"],
    instructions: INSTRUCOES_PESQUISA,
    input: `Código pesquisado: ${codigo}\nFormas de escrita do mesmo código: ${variantesEscrita(codigo).join(" | ")}`,
  });
}

/**
 * Pesquisa principal.
 * @returns {{ ok, codigo, fontes, fontesDescartadasServidor, consultas }}
 */
export async function pesquisarFontesOriginaisServidor({
  codigo,
  openai,
  modelo = MODELO_PADRAO,
  fetchImpl = fetch,
  verificarPagina = true,
}) {
  const cod = String(codigo ?? "").trim().slice(0, 60);
  if (!cod || !/[A-Za-z0-9]/.test(cod)) return { ok: false, erro: "Código inválido." };

  const todos = dominiosOficiais();
  // 1 consulta com todos os domínios oficiais; se a API recusar o tamanho
  // da lista, divide em grupos de 20.
  let grupos = [todos];
  const consultas = [];
  const brutas = [];
  const urlsReais = new Set();

  for (let i = 0; i < grupos.length; i++) {
    const dominios = grupos[i];
    const inicio = new Date().toISOString();
    try {
      const resposta = await consultarModelo(openai, modelo, cod, dominios);
      urlsDaPesquisaReal(resposta).forEach((u) => urlsReais.add(u));
      const json = JSON.parse(limparJson(textoDaResposta(resposta)));
      const fontes = Array.isArray(json?.fontes) ? json.fontes : [];
      brutas.push(...fontes);
      consultas.push({ inicio, dominios: dominios.length, retornadas: fontes.length, modelo });
    } catch (erro) {
      const msg = String(erro?.message || erro);
      if (grupos.length === 1 && /allowed_domains|domain/i.test(msg) && todos.length > 20) {
        grupos = [];
        for (let j = 0; j < todos.length; j += 20) grupos.push(todos.slice(j, j + 20));
        i = -1;
        consultas.push({ inicio, erro: msg, acao: "dividindo domínios em grupos de 20" });
        continue;
      }
      consultas.push({ inicio, dominios: dominios.length, erro: msg });
      if (grupos.length === 1) throw erro;
    }
  }

  const aceitas = [];
  const descartadas = [];
  const vistas = new Set();
  for (const f of brutas) {
    const url = String(f?.url || "").trim();
    const chave = chaveUrl(url);
    if (!chave || vistas.has(chave)) continue;
    vistas.add(chave);
    const cls = classificarFonte(url);
    const base = { url, titulo: f?.titulo || "", evidencia: String(f?.evidencia || "").slice(0, 400), dados: f?.dados || null };
    if (!cls.podeConfirmar) {
      descartadas.push({ ...base, motivo: "Fora da lista de fontes oficiais." });
      continue;
    }
    if (!urlsReais.has(chave)) {
      descartadas.push({ ...base, motivo: "URL não veio da busca real (não foi citada pela ferramenta) — descartada para evitar invenção." });
      continue;
    }
    let verificacao = { resultado: null, motivo: "não verificada" };
    if (verificarPagina) verificacao = await verificarCodigoNaPagina(url, cod, fetchImpl);
    if (verificacao.resultado === false) {
      descartadas.push({ ...base, motivo: `Página oficial lida e o código não aparece nela.` });
      continue;
    }
    aceitas.push({
      ...f,
      url,
      verificacaoPagina: verificacao.resultado,
      verificacaoMotivo: verificacao.motivo,
    });
  }

  return {
    ok: true,
    codigo: cod,
    fontes: aceitas,
    fontesDescartadasServidor: descartadas,
    consultas,
    urlsCitadas: urlsReais.size,
  };
}
