// Banner Express — chamada à OpenAI (compartilhada).
// Usada pelo servidor local do localhost (vite.config.js) e pela função
// Supabase "banner-openai" (cópia idêntica em supabase/functions/banner-openai/).
// Não usa nada específico de navegador, Node ou Deno: só fetch, FormData e Blob.
// A IA recebe SOMENTE a foto real posicionada + a máscara; nenhum dado
// comercial (preço, código, site, WhatsApp, logo) é enviado.

import { montarPromptDiretorArte } from "./promptDiretorArte.js";

export const MODELOS_OPENAI_BANNER = ["gpt-image-2", "gpt-image-1.5", "gpt-image-1"];
export const TAMANHOS_OPENAI = ["1024x1024", "1024x1536", "1536x1024"];
export const QUALIDADES_OPENAI = ["low", "medium", "high"];

const PALETAS = {
  azul: "deep navy and electric blue, cyan neon highlights",
  vermelho: "dark crimson and red, warm orange and yellow energy highlights",
  escuro: "graphite black, cyan and purple neon accents",
  clean: "bright clean white-to-light-blue studio, soft daylight, subtle blue accents",
};

const ESTILOS = {
  oferta: "energetic promotional retail campaign, strong contrast, dynamic light",
  produto: "heroic product showcase, clean and powerful",
  premium: "sophisticated luxury automotive campaign, minimal and elegant",
  estoque: "dynamic fast-delivery feel, motion and speed accents",
  institucional: "trustworthy institutional look, calm and professional",
  qualidade: "premium trust and quality mood, refined studio lighting",
};

const CENARIOS = {
  "estudio-neon": "dark automotive photo studio with neon light streaks and a glossy reflective floor",
  "anel-luz": "a large circular ring light glowing behind the product",
  velocidade: "abstract diagonal speed light beams and motion trails",
  "oficina-bokeh": "a modern automotive workshop far in the background, heavily out of focus with bokeh lights",
  tecnologia: "a subtle glowing technology grid floor in perspective",
  "fumaca-luz": "soft haze with volumetric light rays from above",
};

// Modo "cenario-vazio" (padrão do Banner Express): a IA cria SÓ o cenário,
// sem nenhuma peça. A foto real é colada depois pelo PAIIA, então a IA não
// tem como alongar, duplicar ou redesenhar a peça.
/**
 * @param {{ paleta?: string, estilo?: string, cenario?: string, zonasLivres?: string[], zonaProduto?: string }} dados
 */
export function montarPromptCenarioVazio({ paleta, estilo, cenario, zonasLivres = [], zonaProduto = "" }) {
  const zonas = (Array.isArray(zonasLivres) ? zonasLivres : []).map(String).filter(Boolean).slice(0, 5);
  return [
    "You are a senior automotive advertising art director.",
    "Create ONLY the EMPTY BACKGROUND SCENE for a product advertisement. A real product photo will be composited on top later by another system.",
    "CRITICAL: the image must contain NO product and NO object at all: no automotive part, injector, sensor, cylinder, connector, bottle, tool, car, packaging, pedestal, platform, podium, stand or display base. Do not draw anything that looks like a part or a product, not even partially, blurred or as a silhouette.",
    `SCENE: ${CENARIOS[cenario] || CENARIOS["estudio-neon"]}. Color palette: ${PALETAS[paleta] || PALETAS.azul}. Mood: ${ESTILOS[estilo] || ESTILOS.produto}.`,
    zonaProduto
      ? `HERO SPOT: the product will be placed at ${String(zonaProduto)}. Keep that area completely EMPTY, with a soft spotlight glow and clean background so the product stands out. The floor/surface below that area stays empty.`
      : "HERO SPOT: keep the center of the image completely empty, with a soft spotlight glow.",
    zonas.length
      ? `Keep these regions clean, darker and uncluttered (no bright spots) because text will be added there later: ${zonas.join("; ")}.`
      : "",
    "ABSOLUTELY NO TEXT: no letters, words, numbers, prices, logos, brand names, watermarks, icons, badges, buttons, QR codes, phone numbers or websites anywhere in the image.",
    "Output: high-end photorealistic commercial advertising background, cinematic lighting and depth, professional quality.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * @param {{ paleta?: string, estilo?: string, cenario?: string, zonasLivres?: string[], pedestal?: boolean, modo?: string, zonaProduto?: string,
 *   direcao?: string, objetivoDiretor?: string, luz?: string, baseProduto?: string, semente?: number }} dados
 */
export function montarPromptBanner({
  paleta, estilo, cenario, zonasLivres = [], pedestal = false, modo = "", zonaProduto = "",
  direcao = "", objetivoDiretor = "", luz = "", baseProduto = "", semente = 0,
}) {
  // Diretor de arte (padrão do Banner Express, exceto Mercado Livre)
  if (modo === "diretor-arte") {
    return montarPromptDiretorArte({
      paleta,
      direcaoId: direcao,
      objetivo: objetivoDiretor,
      zonaProduto,
      zonasTexto: zonasLivres,
      luz,
      semente,
      baseProduto,
    });
  }
  if (modo === "cenario-vazio") {
    return montarPromptCenarioVazio({ paleta, estilo, cenario, zonasLivres, zonaProduto });
  }
  const zonas = (Array.isArray(zonasLivres) ? zonasLivres : []).map(String).filter(Boolean).slice(0, 5);
  return [
    "You are a senior automotive advertising art director and photo retoucher.",
    "The input image contains the REAL photograph of an automotive part, already placed at its FINAL position and size. The mask protects the product: edit ONLY the transparent area of the mask (the background).",
    "Task: create a premium, photorealistic automotive advertising scene AROUND this exact product, like a campaign made by a professional designer.",
    "PRODUCT RULES (critical): keep the product exactly as in the input — same position, same size, same angle and perspective, same shape, connectors, number of pins, holes, O-rings, cables, terminals, colors, printed inscriptions and part numbers. Do not redraw, restyle, recolor, simplify, mirror, crop, move, resize or duplicate the product. Do not add any other product, part, tool, car or packaging.",
    `SCENE: ${CENARIOS[cenario] || CENARIOS["estudio-neon"]}. Color palette: ${PALETAS[paleta] || PALETAS.azul}. Mood: ${ESTILOS[estilo] || ESTILOS.produto}.`,
    "LIGHTING AND DEPTH: professional studio rim light matching the product, realistic soft contact shadow under it, subtle reflections, cinematic depth of field, gentle glow behind the product, rich atmosphere. The product must be the hero of the image.",
    pedestal
      ? "Add a sleek premium display pedestal/platform directly under the product so it looks like it is standing on it."
      : "No pedestal: the product sits just above a glossy reflective surface.",
    zonas.length
      ? `Keep these regions clean, darker and uncluttered (no objects, no bright spots) because text will be added there later: ${zonas.join("; ")}.`
      : "",
    "ABSOLUTELY NO TEXT: no letters, words, numbers, prices, logos, brand names, watermarks, icons, badges, buttons, QR codes, phone numbers or websites anywhere in the image.",
    "Output: high-end commercial advertising photograph, sharp, balanced composition, professional quality.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function dataUrlParaBytes(valor) {
  const encontrado = String(valor || "").match(/^data:([^;]+);base64,(.+)$/s);
  if (!encontrado) return null;
  const binario = atob(encontrado[2]);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

// Converte a resposta de erro da OpenAI em código claro para a tela.
export function classificarErroOpenAI(status, mensagem = "") {
  const texto = String(mensagem || "");
  if (status === 401) return "CHAVE_INVALIDA";
  if (status === 429 && /quota|billing|credit/i.test(texto)) return "SEM_CREDITO_OPENAI";
  if (status === 429) return "LIMITE_OPENAI";
  if (/safety|moderation|rejected/i.test(texto)) return "MODERACAO";
  if (status === 403 || status === 404 || (status === 400 && /model|verif/i.test(texto))) return "MODELO_SEM_ACESSO";
  if (status === 400 && /mask/i.test(texto)) return "MASCARA_RECUSADA";
  if (status >= 500) return "OPENAI_INDISPONIVEL";
  return "FALHA_OPENAI";
}

async function chamarEdicao({ fetchImpl, baseUrl, apiKey, modelo, prompt, imagem, mascara, tamanho, qualidade }) {
  const form = new FormData();
  form.append("model", modelo);
  form.append("prompt", prompt);
  form.append("size", tamanho);
  form.append("quality", qualidade);
  form.append("n", "1");
  form.append("image[]", new Blob([imagem], { type: "image/png" }), "produto-posicionado.png");
  if (mascara) {
    form.append("mask", new Blob([mascara], { type: "image/png" }), "mascara.png");
  }
  // gpt-image-1 / 1.5: fidelidade alta à foto. gpt-image-2 já é sempre alta.
  if (/^gpt-image-1/.test(modelo)) {
    form.append("input_fidelity", "high");
  }
  const resposta = await fetchImpl(`${baseUrl}/v1/images/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  let dados;
  try {
    dados = await resposta.json();
  } catch {
    dados = {};
  }
  return {
    ok: resposta.ok,
    status: resposta.status,
    dados,
    idPedido: resposta.headers?.get?.("x-request-id") || "",
  };
}

// Gera o cenário. Tenta outro modelo só se a conta não tiver acesso ao
// preferido; tenta sem máscara só se a máscara for recusada.
/**
 * @param {{ apiKey: string, referencia: Uint8Array, mascara?: Uint8Array | null, tamanho?: string,
 *   qualidade?: string, modeloPreferido?: string, prompt: string, fetchImpl?: typeof fetch, baseUrl?: string }} opcoes
 */
export async function gerarCenarioOpenAI({
  apiKey,
  referencia,
  mascara = null,
  tamanho = "1024x1024",
  qualidade = "medium",
  modeloPreferido = MODELOS_OPENAI_BANNER[0],
  prompt,
  fetchImpl = fetch,
  baseUrl = "https://api.openai.com",
}) {
  const inicio = Date.now();
  const modelos = [modeloPreferido, ...MODELOS_OPENAI_BANNER].filter(
    (modelo, indice, lista) => modelo && lista.indexOf(modelo) === indice
  );
  const tentativas = [];
  let usarMascara = Boolean(mascara);
  for (const modelo of modelos) {
    let r = await chamarEdicao({
      fetchImpl, baseUrl, apiKey, modelo, prompt,
      imagem: referencia,
      mascara: usarMascara ? mascara : null,
      tamanho: TAMANHOS_OPENAI.includes(tamanho) ? tamanho : "1024x1024",
      qualidade: QUALIDADES_OPENAI.includes(qualidade) ? qualidade : "medium",
    });
    let codigo = r.ok ? "" : classificarErroOpenAI(r.status, r.dados?.error?.message);
    if (codigo === "MASCARA_RECUSADA" && usarMascara) {
      usarMascara = false;
      r = await chamarEdicao({
        fetchImpl, baseUrl, apiKey, modelo, prompt, imagem: referencia, mascara: null,
        tamanho, qualidade,
      });
      codigo = r.ok ? "" : classificarErroOpenAI(r.status, r.dados?.error?.message);
    }
    tentativas.push({ modelo, status: r.status, codigo, idPedido: r.idPedido });
    if (r.ok) {
      const b64 = r.dados?.data?.[0]?.b64_json;
      if (!b64) {
        return { ok: false, codigo: "SEM_IMAGEM", mensagem: "A OpenAI não devolveu imagem.", modelo, tentativas };
      }
      return {
        ok: true,
        b64,
        modelo,
        idPedido: r.idPedido,
        usouMascara: usarMascara,
        uso: r.dados?.usage || null,
        duracaoMs: Date.now() - inicio,
        tentativas,
      };
    }
    if (codigo !== "MODELO_SEM_ACESSO") {
      return {
        ok: false,
        codigo,
        status: r.status,
        mensagem: r.dados?.error?.message || `OpenAI respondeu ${r.status}.`,
        modelo,
        tentativas,
      };
    }
  }
  return {
    ok: false,
    codigo: "MODELO_SEM_ACESSO",
    mensagem: "A conta OpenAI não tem acesso aos modelos de imagem (gpt-image-2, gpt-image-1.5, gpt-image-1).",
    tentativas,
  };
}
