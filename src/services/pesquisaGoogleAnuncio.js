// =============================================================
// PAIIA — PRÉ-MONTAGEM PELO GOOGLE (24/11/2026).
//
// Recebe os resultados de UMA busca no Google pelo código (títulos, trechos e
// links, inclusive anúncios do Mercado Livre de outros vendedores) e monta o
// título e a descrição PROVISÓRIOS. Sem IA, sem rede: só regras fixas.
//   - só usa o que está ESCRITO nos resultados (nada é inventado);
//   - dado citado por 2 ou mais fontes entra; 1 fonte só = [A CONFIRMAR];
//   - anos, versões e motores sempre [A CONFIRMAR] (as fontes divergem muito);
//   - Shopee fica de fora; resultados que não citam o código são ignorados.
// =============================================================
import { extrairProdutoPrincipal, normalizarTexto, NUCLEOS_DE_PECA } from "./nomePecaFicha.js";
import { MARCA_A_CONFIRMAR, LIMITE_TITULO_ML } from "./anuncioProvisorio.js";

const txt = (v) => String(v ?? "").trim();
const norm = (v) => normalizarTexto(v).replace(/[^a-z0-9]/g, "");
const MIN_FONTES = 2;

const MONTADORAS = Object.freeze({
  vw: "VW", volkswagen: "VW", fiat: "Fiat", chevrolet: "Chevrolet", gm: "GM", ford: "Ford",
  renault: "Renault", peugeot: "Peugeot", citroen: "Citroën", toyota: "Toyota", honda: "Honda",
  hyundai: "Hyundai", kia: "Kia", nissan: "Nissan", mitsubishi: "Mitsubishi", jeep: "Jeep",
  audi: "Audi", bmw: "BMW", mercedes: "Mercedes-Benz", volvo: "Volvo", suzuki: "Suzuki",
  chery: "Chery", jac: "JAC", iveco: "Iveco", scania: "Scania", dodge: "Dodge", dacia: "Dacia",
  opel: "Opel", vauxhall: "Vauxhall", daewoo: "Daewoo", seat: "Seat", skoda: "Skoda",
});
// Fabricantes de PEÇAS (marca da peça, não do veículo): nunca viram modelo.
const MARCAS_DE_PECA = new Set([
  "bosch", "delphi", "denso", "ngk", "ntk", "valeo", "mte", "thomson", "vdo", "magneti", "marelli", "continental",
  "siemens", "mahle", "cofap", "hella", "walbro", "kostal", "sachs", "bogap", "febi", "bilstein", "lemforder", "trw",
  "skf", "gates", "dayco", "nty", "aisin", "metzger", "bsg", "aslyx", "esen", "skv", "pierburg", "wahler", "vemo",
  "meyle", "ate", "brembo", "hitachi", "torken", "gauss", "lumen", "dpl", "tsa", "iga", "kitec", "paraflu", "nakata",
  "monroe", "fras", "frasle", "tecfil", "sabo", "nytron", "mobensani", "hipper", "vetor", "ima", "cobreq", "syl",
]);
// Palavras que nunca são modelo de veículo.
const NAO_MODELO = new Set([
  "original", "originais", "genuino", "genuina", "usado", "usada", "novo", "nova", "seminovo", "semi",
  "compre", "comprar", "online", "produto", "produtos", "caracteristicas", "principais", "descricao",
  "verifique", "compativel", "compatibilidade", "seu", "veiculo", "veiculos", "ficha", "tecnica",
  "numeracao", "linha", "ano", "anos", "sku", "interno", "part", "number", "referencia", "codigo",
  "eletrica", "eletrico", "reles", "rele", "modulo", "central", "interna", "interno", "porta", "abs",
  "aplicavel", "acompanha", "medidas", "brasil", "loja", "frete", "gratis", "preco", "unidade",
  "resta", "apenas", "aproveite", "indisponivel", "momento", "este", "esta", "para", "com", "sem",
  "dos", "das", "nos", "nas", "pelo", "pela", "mercado", "livre", "shopee", "desmonte", "pecas", "peca",
  "antigas", "auto", "autopecas", "kit", "jogo", "par", "lado", "direito", "esquerdo", "dianteiro",
  "traseiro", "superior", "inferior", "motor", "flex", "gasolina", "alcool", "diesel", "mi", "sp",
  "veiculo", "referencia", "garantia", "nota", "fiscal", "envio", "imediato", "promocao", "oferta",
  // (24/11) Palavras comuns em francês (resultados do Google França).
  "pour", "avec", "sans", "neuf", "neuve", "origine", "occasion", "piece", "pieces", "voiture", "achat",
  "prix", "livraison", "gratuite", "reference", "compatible", "vente", "acheter", "oem", "les", "des",
  "une", "votre", "notre", "marque", "modele", "type", "moteur", "boutique", "stock", "promo", "pas", "cher",
]);

// (24/11) Tradução FIXA de termos de peças (francês → português). Sem IA: o que não estiver
// aqui não é traduzido e o nome fica marcado [A CONFIRMAR].
const GLOSSARIO_FR = [
  ["boite a fusibles", "caixa de fusíveis"], ["boitier papillon", "corpo de borboleta"], ["arbre a cames", "comando de válvulas"],
  ["sonde lambda", "sonda lambda"], ["capteur de position", "sensor de posição"], ["capteur de vitesse", "sensor de velocidade"],
  ["capteur de pression", "sensor de pressão"], ["capteur de temperature", "sensor de temperatura"], ["bobine d allumage", "bobina de ignição"],
  ["moteur d essuie glace", "motor do limpador"], ["leve vitre", "máquina de vidro"], ["pompe a carburant", "bomba de combustível"],
  ["pompe a eau", "bomba d'água"], ["vanne egr", "válvula EGR"], ["debitmetre", "medidor de fluxo de ar"], ["injecteur", "bico injetor"],
  ["capteur", "sensor"], ["sonde", "sonda"], ["bobine", "bobina"], ["allumage", "ignição"], ["pompe", "bomba"], ["carburant", "combustível"],
  ["vanne", "válvula"], ["thermostat", "termostato"], ["calculateur", "módulo"], ["module", "módulo"], ["relais", "relé"],
  ["fusible", "fusível"], ["fusibles", "fusíveis"], ["contacteur", "interruptor"], ["interrupteur", "interruptor"], ["commodo", "chave de seta"],
  ["durite", "mangueira"], ["radiateur", "radiador"], ["ventilateur", "ventilador"], ["demarreur", "motor de partida"], ["alternateur", "alternador"],
  ["courroie", "correia"], ["galet", "polia"], ["tendeur", "tensor"], ["joint", "junta"], ["filtre", "filtro"], ["huile", "óleo"],
  ["frein", "freio"], ["plaquettes", "pastilhas"], ["disque", "disco"], ["amortisseur", "amortecedor"], ["rotule", "pivô"],
  ["biellette", "bieleta"], ["phare", "farol"], ["feu", "lanterna"], ["retroviseur", "retrovisor"], ["serrure", "fechadura"],
  ["reservoir", "reservatório"], ["bouchon", "tampa"], ["support", "suporte"], ["silent bloc", "coxim"], ["faisceau", "chicote"],
  ["regulateur", "regulador"], ["papillon", "borboleta"], ["oxygene", "oxigênio"], ["temperature", "temperatura"], ["pression", "pressão"],
  ["vitesse", "velocidade"], ["position", "posição"], ["vilebrequin", "virabrequim"], ["cliquetis", "detonação"], ["niveau", "nível"],
  ["eau", "água"], ["air", "ar"], ["essence", "gasolina"], ["gazole", "diesel"], ["moteur", "motor"], ["avant", "dianteiro"],
  ["arriere", "traseiro"], ["gauche", "esquerdo"], ["droit", "direito"], ["lambda", "lambda"], ["egr", "EGR"], ["abs", "ABS"],
  ["de", "de"], ["d", "de"], ["du", "do"], ["des", "de"], ["a", "de"], ["la", ""], ["le", ""], ["les", ""], ["l", ""], ["en", "em"], ["et", "e"],
];
const semAcento = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Traduz o NOME da peça do francês pelo glossário. → { texto, completo, original } */
export function traduzirNomePeca(nome) {
  const original = txt(nome);
  let resto = ` ${semAcento(original).replace(/[^a-z0-9]+/g, " ").trim()} `;
  const saida = [];
  let completo = true;
  const palavras = resto.trim().split(/\s+/).filter(Boolean);
  // Mesma palavra na grafia original (sigla sem tradução fica como foi escrita: "PMH").
  const originais = original.normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^A-Za-z0-9]+/).filter(Boolean);
  for (let i = 0; i < palavras.length;) {
    let achou = false;
    for (let n = Math.min(4, palavras.length - i); n >= 1; n--) {
      const trecho = palavras.slice(i, i + n).join(" ");
      const par = GLOSSARIO_FR.find(([fr]) => fr === trecho);
      if (par) { if (par[1]) saida.push(par[1]); i += n; achou = true; break; }
    }
    if (!achou) {
      if (!/\d/.test(palavras[i])) completo = false;
      const o = originais.length === palavras.length ? originais[i] : palavras[i];
      saida.push(o === o.toUpperCase() && o.length <= 5 ? `#${o}` : palavras[i]);
      i += 1;
    }
  }
  const texto = saida.join(" ").replace(/\s+/g, " ").trim().split(" ")
    .map((w) => (w.startsWith("#") ? w.slice(1) : /^(de|do|da|e|em)$/.test(w) ? w : capital(w))).join(" ");
  return { texto, completo, original };
}

/** Fonte de um resultado: anúncio do ML conta pelo link (cada vendedor), loja pelo site. */
function chaveFonte(link) {
  const l = txt(link);
  try {
    const u = new URL(l);
    const host = u.hostname.replace(/^www\./, "");
    return /mercadoli[bv]re\./.test(host) ? `ml:${u.pathname}` : host;
  } catch {
    return l;
  }
}
const ehShopee = (link) => /(^|\.)shopee\./i.test((() => { try { return new URL(link).hostname; } catch { return ""; } })());
const ehML = (link) => /mercadoli[bv]re\./i.test(txt(link));
// Link sem parâmetros de rastreamento (?srsltid=...).
const linkLimpo = (link) => { try { const u = new URL(link); return `${u.origin}${u.pathname}`; } catch { return txt(link); } };
const hostDe = (link) => { try { return new URL(link).hostname.replace(/^www\./, ""); } catch { return ""; } };

/** Os resultados que servem: https, não Shopee, citando o código (com ou sem pontos/traços). */
export function resultadosValidos(codigo, resultados = []) {
  const alvo = norm(codigo);
  if (!alvo) return [];
  return (Array.isArray(resultados) ? resultados : [])
    .map((r) => ({ titulo: txt(r?.titulo || r?.title), trecho: txt(r?.trecho || r?.snippet), link: txt(r?.link), idioma: txt(r?.idioma) || "pt" }))
    .filter((r) => /^https:\/\//i.test(r.link) && !ehShopee(r.link))
    .filter((r) => norm(`${r.titulo} ${r.trecho}`).includes(alvo));
}

const contar = (mapa, chave, fonte, exibir) => {
  const atual = mapa.get(chave) || { fontes: new Set(), formas: new Map() };
  atual.fontes.add(fonte);
  if (exibir) atual.formas.set(exibir, (atual.formas.get(exibir) || 0) + 1);
  mapa.set(chave, atual);
};
const formaMaisUsada = (m) => [...m.formas.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0]?.[0] || "";
// Siglas que ficam em maiúsculas e acentos de palavras comuns de peças (títulos sem acento: "Valvula").
const SIGLAS = new Set(["egr", "abs", "pmh", "tps", "map", "ecu", "arla", "led", "gnv", "dci", "tdi", "cdi", "hdi", "ac", "pcm", "bsi", "abs/esp", "esp"]);
const ACENTOS = { valvula: "válvula", modulo: "módulo", ignicao: "ignição", oleo: "óleo", combustivel: "combustível", agua: "água",
  eletrico: "elétrico", eletrica: "elétrica", pressao: "pressão", rele: "relé", reles: "relés", fusivel: "fusível", fusiveis: "fusíveis",
  posicao: "posição", direcao: "direção", suspensao: "suspensão", radiador: "radiador", borboleta: "borboleta", bomba: "bomba",
  catalisador: "catalisador", injecao: "injeção", ventilacao: "ventilação", lampada: "lâmpada", eletronico: "eletrônico", eletronica: "eletrônica" };
const capital = (p) => {
  const n = normalizarTexto(p);
  if (SIGLAS.has(n)) return n.toUpperCase();
  if (p.length <= 3 && /^[a-z]+$/i.test(p) && p === p.toUpperCase()) return p;
  const base = ACENTOS[n] || p.toLowerCase();
  return base.charAt(0).toUpperCase() + base.slice(1);
};

/** Nome da peça mais citado (ex.: "Caixa De Fusíveis"). */
function nomeDaPeca(validos) {
  const grupos = new Map();
  for (const r of validos) {
    const principal = extrairProdutoPrincipal(r.titulo).principal;
    const palavras = principal.split(/\s+/).filter(Boolean);
    const sig = palavras.filter((w) => !["de", "do", "da", "dos", "das", "para", "e"].includes(normalizarTexto(w)));
    if (!sig.length) continue;
    const raiz = (w) => normalizarTexto(w).replace(/(?:eis|el|is|es|s)$/, "");
    const chave = sig.slice(0, 2).map(raiz).join(" ");
    contar(grupos, chave, chaveFonte(r.link), palavras.slice(0, sig.length >= 2 ? palavras.findIndex((w, i) => i > 0 && sig.indexOf(w) === 1) + 1 : 1).join(" "));
  }
  const melhor = [...grupos.entries()].sort((a, b) => b[1].fontes.size - a[1].fontes.size)[0];
  if (!melhor) return { nome: "", fontes: 0 };
  // Forma mais completa da mesma peça: com conector ("De") e no plural, quando alguém escreveu assim.
  const formas = [...melhor[1].formas.keys()];
  const pontua = (f) => (/\s(de|do|da)\s/i.test(f) ? 2 : 0) + (/s$/i.test(f) ? 1 : 0);
  const forma = formas.sort((a, b) => pontua(b) - pontua(a) || (melhor[1].formas.get(b) - melhor[1].formas.get(a)))[0] || formaMaisUsada(melhor[1]);
  return { nome: forma.split(/\s+/).map((w) => (/^(de|do|da|dos|das|e)$/i.test(w) ? capital(w) : capital(w))).join(" "), fontes: melhor[1].fontes.size, chave: melhor[0] };
}

/**
 * Organiza os resultados. → { peca, montadora, modelos:[{nome,fontes}], modelosAConfirmar,
 *   motores, anos, codigos, caracteristicas, fontes:[{titulo,link,site,ml}], total }
 */
export function organizarResultadosGoogle({ codigo = "", resultados = [] } = {}) {
  const validos = resultadosValidos(codigo, resultados);
  const vazio = { peca: "", pecaFontes: 0, montadora: "", montadoraFontes: 0, modelos: [], modelosAConfirmar: [], motores: [], anos: [], codigos: [], caracteristicas: [], fontes: [], total: 0 };
  if (!validos.length) return vazio;
  const peca = nomeDaPeca(validos);
  const palavrasPeca = new Set(normalizarTexto(peca.nome).split(/\s+/).flatMap((w) => [w, w.replace(/(?:eis|el|is|es|s)$/, "")]));
  // (24/11) Resultados do Google França: o nome da peça é traduzido pelo glossário fixo.
  // Nomes de sites/lojas das fontes (autodoc, rrr, ebay...) nunca viram modelo.
  const palavrasSites = new Set(validos.flatMap((r) => hostDe(r.link).split(/[.-]/)).filter((p) => p.length >= 3));
  const frances = validos.filter((r) => r.idioma === "fr").length > validos.length / 2;
  const traducao = frances && peca.nome ? traduzirNomePeca(peca.nome) : null;
  const alvo = norm(codigo);

  const marcas = new Map();
  const modelos = new Map();
  const motores = new Map();
  const anos = new Map();
  const codigos = new Map();
  const caracteristicas = new Map();
  for (const r of validos) {
    const fonte = chaveFonte(r.link);
    const texto = `${r.titulo} ${r.trecho}`.replace(/\.\.\./g, " ").replace(/R\$\s?[\d.,]+/g, " ");
    // Montadora
    for (const w of normalizarTexto(texto).split(/[^a-z0-9-]+/)) if (MONTADORAS[w]) contar(marcas, MONTADORAS[w], fonte, MONTADORAS[w]);
    // Modelos: palavras com inicial maiúscula NO TÍTULO, que não são peça/marca/código/termo comum.
    for (const w of r.titulo.split(/[^A-Za-zÀ-ÿ0-9-]+/)) {
      const n = normalizarTexto(w);
      if (!/^[A-ZÀ-Ý]/.test(w) || n.length < 3 || /\d/.test(n) || /^[ivxl]+$/.test(n)) continue;
      if (NAO_MODELO.has(n) || MONTADORAS[n] || MARCAS_DE_PECA.has(n) || palavrasSites.has(n) || NUCLEOS_DE_PECA.has(n) || palavrasPeca.has(n) || palavrasPeca.has(n.replace(/(?:eis|el|is|es|s)$/, ""))) continue;
      contar(modelos, n, fonte, capital(w));
    }
    // Motores (versões): 1.0 a 6.9
    for (const m of texto.matchAll(/\b([1-6][.,]\d)\b/g)) contar(motores, m[1].replace(",", "."), fonte, m[1].replace(",", "."));
    // Anos e faixas de ano
    for (const m of texto.matchAll(/\b((?:19|20)?\d{2})\s*(?:à|a|até|-|\/)\s*((?:19|20)\d{2})\b/gi)) {
      const ini = m[1].length === 2 ? `${Number(m[1]) > 30 ? "19" : "20"}${m[1]}` : m[1];
      if (Number(ini) >= 1950 && Number(m[2]) >= Number(ini)) contar(anos, `${ini}–${m[2]}`, fonte, `${ini}–${m[2]}`);
    }
    // Códigos de referência: grafias do mesmo código
    for (const m of texto.matchAll(/[A-Za-z0-9][A-Za-z0-9.\- ]{4,30}[A-Za-z0-9]/g)) {
      const pedaço = m[0];
      for (const g0 of pedaço.split(/\s+(?=\S)/).concat([pedaço])) {
        const g = g0.replace(/[.-]+$/, "");
        if (norm(g) === alvo) contar(codigos, g.toUpperCase(), fonte, g.toUpperCase());
      }
    }
    // Características citadas (sempre [A CONFIRMAR])
    for (const m of texto.matchAll(/(medidas?:?\s*[\d,.]+\s*x\s*[\d,.]+(?:\s*x\s*[\d,.]+)?(?:\s*cm)?|n[ãa]o acompanha[^.;]{3,60}|\b\d+\s*(?:pinos|vias|terminais)\b)/gi)) {
      const c = m[1].replace(/\s+/g, " ").trim();
      contar(caracteristicas, normalizarTexto(c), fonte, c.charAt(0).toUpperCase() + c.slice(1));
    }
  }
  const ordenar = (mapa) => [...mapa.values()].map((v) => ({ nome: formaMaisUsada(v), fontes: v.fontes.size })).sort((a, b) => b.fontes - a.fontes || a.nome.localeCompare(b.nome));
  const listaModelos = ordenar(modelos);
  const marca = ordenar(marcas)[0] || { nome: "", fontes: 0 };
  const codigoBase = txt(codigo).toUpperCase();
  const listaCodigos = [codigoBase, ...ordenar(codigos).map((c) => c.nome)].filter((c, i, a) => c && a.indexOf(c) === i && norm(c) === alvo);
  const vistos = new Set();
  const fontes = validos.filter((r) => (vistos.has(r.link) ? false : vistos.add(r.link))).map((r) => ({ titulo: r.titulo, link: linkLimpo(r.link), site: hostDe(r.link), ml: ehML(r.link) }));
  return {
    peca: traducao ? traducao.texto : peca.nome,
    pecaOriginal: traducao ? peca.nome : "",
    traducaoCompleta: traducao ? traducao.completo : true,
    idioma: frances ? "fr" : "pt",
    pecaFontes: peca.fontes,
    montadora: marca.nome,
    montadoraFontes: marca.fontes,
    modelos: listaModelos.filter((m) => m.fontes >= MIN_FONTES),
    modelosAConfirmar: listaModelos.filter((m) => m.fontes < MIN_FONTES),
    motores: ordenar(motores),
    anos: ordenar(anos),
    codigos: listaCodigos,
    caracteristicas: ordenar(caracteristicas),
    fontes,
    total: validos.length,
  };
}

/** Título provisório: peça + montadora + modelos confirmados + código (até 60). */
export function tituloGoogle(org, codigo = "", limite = LIMITE_TITULO_ML) {
  if (!org?.peca) return "";
  const cod = txt(codigo).toUpperCase();
  const marca = org.montadoraFontes >= MIN_FONTES ? org.montadora : "";
  const modelos = (org.modelos || []).map((m) => m.nome);
  for (let n = modelos.length; n >= 0; n--) {
    const t = [org.peca, marca, ...modelos.slice(0, n), cod].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    if (t.length <= limite) return t;
  }
  return [org.peca, cod].join(" ").slice(0, limite).trim();
}

/** Descrição provisória com o que foi encontrado, marcações e fontes. */
export function descricaoGoogle(org, codigo = "", { quando = new Date() } = {}) {
  if (!org?.peca) return "";
  const A = MARCA_A_CONFIRMAR;
  const marca = org.montadora && org.montadoraFontes >= MIN_FONTES ? org.montadora : "";
  const linhas = [];
  linhas.push([org.peca, marca, (org.modelos || []).map((m) => m.nome).join(" / ")].filter(Boolean).join(" "), "");
  linhas.push("IDENTIFICAÇÃO DA PEÇA", `${org.peca}${marca ? ` – ${marca}` : ""}.`);
  if (org.pecaOriginal) {
    linhas.push(`${A} Nome traduzido do francês (original: "${org.pecaOriginal}")${org.traducaoCompleta ? "" : " — parte do nome não foi traduzida"}.`);
  }
  linhas.push("");
  linhas.push("APLICAÇÕES ENCONTRADAS");
  for (const m of org.modelos || []) linhas.push(`${marca ? `${marca} ` : ""}${m.nome}`);
  for (const m of org.modelosAConfirmar || []) linhas.push(`${A} ${marca ? `${marca} ` : ""}${m.nome} (citado em apenas 1 fonte)`);
  if (org.motores?.length) linhas.push(`${A} Motores citados: ${org.motores.map((m) => m.nome).join(", ")}`);
  if (org.anos?.length) linhas.push(`${A} Anos citados${org.anos.length > 1 ? " (as fontes divergem)" : ""}: ${org.anos.map((a) => a.nome).join(", ")}`);
  if (!(org.modelos || []).length && !(org.modelosAConfirmar || []).length) linhas.push(`${A} Aplicação (montadora, modelo, motor e ano): não encontrada.`);
  linhas.push("");
  linhas.push("CÓDIGOS DE REFERÊNCIA", (org.codigos?.length ? org.codigos : [txt(codigo).toUpperCase()]).join(" · "), "");
  if (org.caracteristicas?.length) {
    linhas.push("CARACTERÍSTICAS ENCONTRADAS");
    for (const c of org.caracteristicas) linhas.push(`${A} ${c.nome} (${c.fontes} fonte${c.fontes > 1 ? "s" : ""})`);
    linhas.push("");
  }
  linhas.push(`${A} Confira e apague esta parte antes de publicar.`, "");
  const data = (() => { try { return new Date(quando).toLocaleDateString("pt-BR"); } catch { return ""; } })();
  linhas.push(`FONTES CONSULTADAS (${org.idioma === "fr" ? "Google França" : "Google"}${data ? `, ${data}` : ""})`);
  for (const f of org.fontes || []) linhas.push(`- ${f.ml ? "Mercado Livre" : f.site}: ${f.titulo} — ${f.link}`);
  return linhas.join("\n");
}

/** Monta tudo: → { titulo, descricao, org } (titulo vazio quando os resultados não identificam a peça). */
export function montarPeloGoogle({ codigo = "", resultados = [], quando = new Date() } = {}) {
  const org = organizarResultadosGoogle({ codigo, resultados });
  return { titulo: tituloGoogle(org, codigo), descricao: descricaoGoogle(org, codigo, { quando }), org };
}
