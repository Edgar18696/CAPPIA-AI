// =============================================================
// PAIIA Voz — CONVERSA NATURAL (assistente de autopeças, sem IA paga).
//   Testes: scripts/testes/paiiaVozConversa.test.mjs
//
// Entende frases como numa conversa com o balcão:
//   "Tenho uma lanterna dianteira de ônibus Neobus Mega Plus"
//   "2013 e 2014"          (resposta à pergunta do ano)
//   "Esquerdo, cristal, LED, 12 e 24 volts"
// e responde com a próxima pergunta. As palavras-chave antigas
// ("código …", "preço …", "aplicação …") continuam valendo.
//
// Regras (iguais às da ficha):
//  • Ano NÃO é código. Código só com "código …", na resposta à pergunta
//    do código, ou quando a fala é claramente um código (ex.: 0280158276).
//  • Veículo dito na conversa vira "aplicação informada por você", que
//    SÓ entra no título/descrição depois que você marcar como conferida.
//  • Nada é inventado: o que não foi entendido é perguntado de volta.
// Funções puras: sem React, sem rede, sem banco.
// =============================================================

import { semAcento, lerPreco, lerInteiro, lerCodigoFalado } from "./numerosFalados.js";
import { interpretarFala, interpretarAplicacao, pareceCodigo, pareceAno, MONTADORAS } from "./interpretarFala.js";
import {
  aplicarInterpretacao,
  incluirAplicacao,
  rechavearAplicacao,
  novaConversa,
  textoAtributo,
  resumoAplicacao,
  codigoPrincipal,
} from "./fichaVoz.js";

const txt = (v) => String(v ?? "").trim();
const norm = (s) => semAcento(String(s ?? "")).toLowerCase();
const copia = (o) => JSON.parse(JSON.stringify(o));

// ---------------------------------------------------------------
// Vocabulário
// ---------------------------------------------------------------
// [falado (sem acento), nome na ficha, gênero, grupo]
const PECAS = [
  ["bico injetor", "Bico injetor", "m", "motor"], ["bicos injetores", "Bico injetor", "m", "motor"],
  ["sonda lambda", "Sonda lambda", "f", "motor"], ["sensor de oxigenio", "Sensor de oxigênio", "m", "motor"],
  ["bobina de ignicao", "Bobina de ignição", "f", "motor"], ["bobina", "Bobina de ignição", "f", "motor"],
  ["sensor de rotacao", "Sensor de rotação", "m", "motor"], ["sensor de fase", "Sensor de fase", "m", "motor"],
  ["sensor de temperatura", "Sensor de temperatura", "m", "motor"], ["sensor de pressao", "Sensor de pressão", "m", "motor"],
  ["sensor map", "Sensor MAP", "m", "motor"], ["sensor de detonacao", "Sensor de detonação", "m", "motor"],
  ["sensor de velocidade", "Sensor de velocidade", "m", "motor"], ["sensor abs", "Sensor ABS", "m", "freio"],
  ["sensor do filtro", "Sensor do filtro", "m", "motor"], ["sensor", "Sensor", "m", "motor"],
  ["valvula solenoide", "Válvula solenoide", "f", "motor"], ["valvula termostatica", "Válvula termostática", "f", "motor"],
  ["corpo de borboleta", "Corpo de borboleta", "m", "motor"], ["atuador de marcha lenta", "Atuador de marcha lenta", "m", "motor"],
  ["bomba de combustivel", "Bomba de combustível", "f", "motor"], ["bomba d'agua", "Bomba d'água", "f", "motor"], ["bomba de agua", "Bomba d'água", "f", "motor"],
  ["regulador de pressao", "Regulador de pressão", "m", "motor"], ["motor de partida", "Motor de partida", "m", "eletrica"],
  ["alternador", "Alternador", "m", "eletrica"], ["modulo de injecao", "Módulo de injeção", "m", "eletrica"],
  ["lanterna", "Lanterna", "f", "luz"], ["lanternas", "Lanterna", "f", "luz"], ["farol de milha", "Farol de milha", "m", "luz"], ["farol", "Farol", "m", "luz"], ["farois", "Farol", "m", "luz"],
  ["pisca", "Pisca", "m", "luz"], ["seta", "Seta", "f", "luz"], ["lampada", "Lâmpada", "f", "luz"], ["luz de placa", "Luz de placa", "f", "luz"],
  ["retrovisor", "Retrovisor", "m", "lado"], ["macaneta", "Maçaneta", "f", "lado"], ["maquina de vidro", "Máquina de vidro", "f", "lado"],
  ["fechadura", "Fechadura", "f", "lado"], ["paralama", "Paralama", "m", "lado"], ["para-lama", "Paralama", "m", "lado"],
  ["terminal de direcao", "Terminal de direção", "m", "lado"], ["bandeja", "Bandeja", "f", "lado"], ["amortecedor", "Amortecedor", "m", "lado"],
  ["para-choque", "Para-choque", "m", "carroceria"], ["parachoque", "Para-choque", "m", "carroceria"], ["grade", "Grade", "f", "carroceria"], ["moldura", "Moldura", "f", "carroceria"],
  ["mecanismo do limpador", "Mecanismo do limpador", "m", "carroceria"], ["palheta", "Palheta", "f", "carroceria"],
  ["mangueira", "Mangueira", "f", "motor"], ["polia", "Polia", "f", "motor"], ["tensor", "Tensor", "m", "motor"], ["correia", "Correia", "f", "motor"],
  ["filtro", "Filtro", "m", "motor"], ["vela de ignicao", "Vela de ignição", "f", "motor"], ["cabo de vela", "Cabo de vela", "m", "motor"],
  ["chicote", "Chicote", "m", "eletrica"], ["interruptor", "Interruptor", "m", "eletrica"], ["rele", "Relé", "m", "eletrica"],
  ["porca", "Porca", "f", "outros"], ["anel trava", "Anel trava", "m", "outros"], ["junta", "Junta", "f", "motor"], ["retentor", "Retentor", "m", "motor"],
  ["rolamento", "Rolamento", "m", "outros"], ["pastilha de freio", "Pastilha de freio", "f", "freio"],
].sort((a, b) => b[0].length - a[0].length);

// Grupos em que o lado (esquerdo/direito) importa.
const GRUPOS_COM_LADO = new Set(["luz", "lado"]);

const TIPOS_VEICULO = [
  ["micro-onibus", "Micro-ônibus"], ["micro onibus", "Micro-ônibus"], ["microonibus", "Micro-ônibus"], ["onibus", "Ônibus"],
  ["caminhao", "Caminhão"], ["caminhoes", "Caminhão"], ["carreta", "Carreta"], ["cavalo mecanico", "Cavalo mecânico"],
  ["picape", "Picape"], ["pickup", "Picape"], ["caminhonete", "Caminhonete"], ["utilitario", "Utilitário"], ["van", "Van"],
  ["automovel", "Carro"], ["carro", "Carro"], ["moto", "Moto"], ["motocicleta", "Moto"], ["trator", "Trator"],
].sort((a, b) => b[0].length - a[0].length);

const NOMES_MONTADORA = { vw: "Volkswagen", gm: "Chevrolet", "mercedes-benz": "Mercedes-Benz", mercedes: "Mercedes-Benz", bmw: "BMW", byd: "BYD", gwm: "GWM", jac: "JAC", daf: "DAF", mwm: "MWM", caoa: "CAOA" };

// Palavras de ligação que podem sobrar sem significar nada.
const VAZIAS = new Set([
  "tenho", "tem", "eu", "aqui", "uma", "um", "uns", "umas", "de", "do", "da", "dos", "das", "pra", "para", "o", "a", "os", "as", "e", "eh", "é",
  "essa", "esse", "esta", "este", "isso", "isto", "ela", "ele", "e'", "ai", "entao", "bom", "olha", "veja", "certo", "ok", "sim", "peca", "pecas", "produto",
  "lado", "lente", "tecnologia", "tensao", "voltagem", "ano", "anos", "modelo", "veiculo", "no", "na", "nos", "nas", "com", "que", "mais", "ja", "serve",
  "tipo", "lampada", "luz", "cor", "aplicacao", "vai", "fica", "e,", "pro", "pros", "pras", "num", "numa", "dele", "dela",
]);

const LADOS = [
  [/\b(?:os dois lados|ambos os lados|lado esquerdo e direito|esquerdo e direito|esquerda e direita|par)\b/, "par"],
  [/\b(?:lado do motorista|esquerd[oa]s?|le)\b/, "esquerdo"],
  [/\b(?:lado do passageiro|direit[oa]s?|ld)\b/, "direito"],
];
const POSICOES = [
  [/\b(?:dianteir[oa]s?|frontal|frontais|da frente)\b/, "dianteira"],
  [/\b(?:traseir[oa]s?|de tras)\b/, "traseira"],
  [/\b(?:lateral|laterais)\b/, "lateral"],
];
const LENTES = [
  [/\bcristal\b/, "cristal"], [/\bfum[eê]\b/, "fumê"], [/\bvermelh[oa]\b/, "vermelha"], [/\bambar\b/, "âmbar"],
  [/\bbicolor\b/, "bicolor"], [/\blaranja\b/, "laranja"], [/\btransparente\b/, "transparente"],
];
const TECNOLOGIAS = [
  [/\bled\b/, "LED"], [/\bhalogen[ao]\b/, "halógena"], [/\bxenon\b/, "xenon"], [/\bneon\b/, "neon"], [/\bincandescente\b/, "incandescente"], [/\bconvencional\b/, "convencional"],
];
const PULAR = /^(?:nao sei|nao tem|nao lembro|sem codigo|nao tem codigo|pula|pular|depois|deixa pra depois|passa|proxima|nenhum|nenhuma|nao|sem detalhes?|nenhum detalhe|nao tem detalhes?|so isso|e so isso|e so|mais nada|nada|sem ano|nao sei o ano)$/;

// ---------------------------------------------------------------
// Peças de texto
// ---------------------------------------------------------------
function acharPeca(n) {
  for (const [falado, nome, genero, grupo] of PECAS) {
    const re = new RegExp(`(?<![a-z0-9])${falado.replace(/[-']/g, "[-' ]?").replace(/ /g, "\\s+")}(?![a-z0-9])`);
    const m = n.match(re);
    if (m) return { nome, genero, grupo, inicio: m.index, fim: m.index + m[0].length };
  }
  return null;
}

function acharLista(n, lista) {
  for (const [re, valor] of lista) {
    const m = n.match(re);
    if (m) return { valor, inicio: m.index, fim: m.index + m[0].length };
  }
  return null;
}

/** Tensão: "12 e 24 volts", "12V/24V", "24 volts", "bivolt". */
function acharTensao(n, { forcar = false } = {}) {
  let m = n.match(/\b(\d{1,2})\s*(?:v|volts?)?\s*(?:e|\/|ou|a)\s*(\d{1,2})\s*(?:v\b|volts?)/);
  if (m) return { valor: `${m[1]}V/${m[2]}V`, inicio: m.index, fim: m.index + m[0].length };
  m = n.match(/\b(\d{1,2})\s*volts?\b/);
  if (m) return { valor: `${m[1]}V`, inicio: m.index, fim: m.index + m[0].length };
  m = n.match(/\bbivolt\b/);
  if (m) return { valor: "12V/24V", inicio: m.index, fim: m.index + m[0].length };
  if (forcar) {
    m = n.match(/\b(12|24)\s*v?\s*(?:e|\/|ou)\s*(12|24)\s*v?\b/) || n.match(/\b(12|24)\s*v\b/);
    if (m) return { valor: m[2] ? `${m[1]}V/${m[2]}V` : `${m[1]}V`, inicio: m.index, fim: m.index + m[0].length };
  }
  return null;
}

/** Anos: "2013/2014", "2013 e 2014", "de 2013 a 2019", "2014"; com pergunta pendente aceita "13/14". */
export function lerAnos(texto, { aceitarDoisDigitos = false } = {}) {
  const n = norm(texto);
  const A4 = "(19[5-9]\\d|20[0-4]\\d)";
  let m = n.match(new RegExp(`\\b${A4}\\s*(?:\\/|-|e|a|ate|ou|barra)\\s*${A4}\\b`));
  if (m) {
    const [x, y] = [Number(m[1]), Number(m[2])].sort((p, q) => p - q);
    return { inicio: x, fim: y, inicioTexto: m.index, fimTexto: m.index + m[0].length };
  }
  m = n.match(new RegExp(`\\b(?:a partir de|desde|apos)\\s*${A4}\\b`));
  if (m) return { inicio: Number(m[1]), fim: null, inicioTexto: m.index, fimTexto: m.index + m[0].length };
  m = n.match(new RegExp(`\\b${A4}\\b`));
  if (m) return { inicio: Number(m[1]), fim: Number(m[1]), inicioTexto: m.index, fimTexto: m.index + m[0].length };
  if (aceitarDoisDigitos) {
    const dois = (v) => { const k = Number(v); return k >= 50 ? 1900 + k : 2000 + k; };
    m = n.match(/\b(\d{2})\s*(?:\/|-|e|a|ate|barra)\s*(\d{2})\b/);
    if (m) {
      const [x, y] = [dois(m[1]), dois(m[2])].sort((p, q) => p - q);
      return { inicio: x, fim: y, inicioTexto: m.index, fimTexto: m.index + m[0].length };
    }
  }
  return null;
}

export function textoAnos(anos) {
  if (!anos?.inicio) return "";
  if (!anos.fim) return `${anos.inicio} em diante`;
  if (anos.inicio === anos.fim) return `${anos.inicio}`;
  if (anos.fim - anos.inicio === 1) return `${anos.inicio} e ${anos.fim}`;
  return `${anos.inicio} a ${anos.fim}`;
}

function acharMontadora(n) {
  for (const mt of [...MONTADORAS].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`(?<![a-z0-9])${mt.replace(/[-\s]/g, "[-\\s]?")}(?![a-z0-9])`);
    const m = n.match(re);
    if (m) {
      const nome = NOMES_MONTADORA[mt] || mt.split(/([-\s])/).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
      return { nome, inicio: m.index, fim: m.index + m[0].length };
    }
  }
  return null;
}

/** Palavras originais (com acento/maiúscula) por posição no texto normalizado. */
function palavrasComPosicao(original) {
  const lista = [];
  const re = /[\p{L}\p{N}][\p{L}\p{N}.\-/']*/gu;
  let m;
  while ((m = re.exec(original))) lista.push({ original: m[0], n: norm(m[0]), inicio: m.index, fim: m.index + m[0].length });
  return lista;
}

const capital = (p) => (/^\d/.test(p) || (p.length <= 4 && p === p.toUpperCase()) ? p : p.charAt(0).toUpperCase() + p.slice(1));

// ---------------------------------------------------------------
// Entender um trecho em linguagem natural
// ---------------------------------------------------------------
/**
 * @param texto trecho sem palavras-chave de campo
 * @param ctx { pendente, temPeca, grupoPeca }
 * @returns { itens[], sobras: string }
 */
export function entenderTrecho(texto, ctx = {}) {
  const original = String(texto ?? "").replace(/\s+/g, " ").trim();
  const itens = [];
  if (!original) return { itens, sobras: "" };
  const n = norm(original);
  if (n.length !== original.length) {
    // Segurança: se a normalização mudou o tamanho, trabalha sobre o texto normalizado.
    return entenderTrecho(n, ctx);
  }
  const usados = []; // [inicio, fim)
  const usar = (a) => { if (a) usados.push(a.inicioTexto !== undefined ? [a.inicioTexto, a.fimTexto] : [a.inicio, a.fim]); return a; };
  const livre = (i, f) => !usados.some(([a, b]) => i < b && f > a);
  const pendente = ctx.pendente || null;

  // Resposta curta de "pular" à pergunta pendente.
  if (pendente && PULAR.test(n.replace(/[.,!?]/g, "").trim())) return { itens: [{ campo: "pular", valor: pendente }], sobras: "" };

  // Peça
  const peca = usar(acharPeca(n));
  if (peca) itens.push({ campo: "peca", valor: { nome: peca.nome, genero: peca.genero, grupo: peca.grupo } });

  // Detalhes
  const tensao = usar(acharTensao(n, { forcar: pendente === "detalhes" || ctx.grupoPeca === "luz" || peca?.grupo === "luz" }));
  if (tensao) itens.push({ campo: "atributo", chave: "tensao", valor: tensao.valor });
  const anos = (() => {
    const a = lerAnos(n, { aceitarDoisDigitos: pendente === "anos" });
    if (a && livre(a.inicioTexto, a.fimTexto)) return usar(a);
    return null;
  })();
  if (anos) itens.push({ campo: "anos", valor: { inicio: anos.inicio, fim: anos.fim } });
  for (const [lista, chave] of [[POSICOES, "posicao"], [LADOS, "lado"], [LENTES, "lente"], [TECNOLOGIAS, "tecnologia"]]) {
    const a = acharLista(n, lista);
    if (a && livre(a.inicio, a.fim)) {
      usar(a);
      itens.push({ campo: "atributo", chave, valor: a.valor });
    }
  }

  // Veículo: tipo + montadora + modelo
  const tipo = (() => {
    for (const [falado, nome] of TIPOS_VEICULO) {
      const m = n.match(new RegExp(`(?<![a-z0-9])${falado.replace(/[- ]/g, "[-\\s]?")}(?![a-z0-9])`));
      if (m && livre(m.index, m.index + m[0].length)) return usar({ nome, inicio: m.index, fim: m.index + m[0].length });
    }
    return null;
  })();
  const montadora = (() => {
    const mt = acharMontadora(n);
    return mt && livre(mt.inicio, mt.fim) ? usar(mt) : null;
  })();

  const palavras = palavrasComPosicao(original).filter((p) => livre(p.inicio, p.fim));
  const ancora = Math.max(tipo?.fim ?? -1, montadora?.fim ?? -1);
  let modeloPalavras = [];
  if (ancora >= 0) {
    // Palavras logo depois do tipo/montadora formam o modelo (até algo já entendido).
    for (const p of palavras) {
      if (p.inicio < ancora) continue;
      const entre = n.slice(ancora, p.inicio);
      if (modeloPalavras.length && (!livre(modeloPalavras.at(-1).fim, p.inicio) || /[,;]/.test(n.slice(modeloPalavras.at(-1).fim, p.inicio)))) break;
      if (!modeloPalavras.length && /[,;]/.test(entre)) break;
      if (VAZIAS.has(p.n) && !modeloPalavras.length) continue;
      if (VAZIAS.has(p.n)) break;
      modeloPalavras.push(p);
    }
  } else if (["veiculo", "modelo"].includes(pendente) && !peca) {
    modeloPalavras = palavras.filter((p) => !VAZIAS.has(p.n));
    if (modeloPalavras.every((p) => /^[\d.,/-]+$/.test(p.n))) modeloPalavras = []; // só números não é modelo
  }
  modeloPalavras.forEach((p) => usar(p));
  if (tipo || montadora || modeloPalavras.length) {
    const textoModelo = modeloPalavras.map((p) => p.original).join(" ");
    const ap = textoModelo ? interpretarAplicacao(textoModelo) : null;
    const modelo = ap ? ap.modelos.join(" ").trim() : "";
    itens.push({
      campo: "veiculo",
      valor: {
        tipo: tipo?.nome || "",
        montadora: montadora?.nome || ap?.montadora || "",
        modelos: modelo ? [modelo.split(" ").map(capital).join(" ")] : [],
        motores: ap?.motores || [],
      },
    });
  }

  // O que sobrou
  let sobras = palavrasComPosicao(original)
    .filter((p) => livre(p.inicio, p.fim) && !VAZIAS.has(p.n))
    .map((p) => p.original)
    .join(" ")
    .trim();
  if (sobras && pendente === "peca" && !peca) {
    itens.push({ campo: "peca", valor: { nome: capital(sobras.toLowerCase()), genero: "f", grupo: "outros", livre: true } });
    sobras = "";
  }
  return { itens, sobras };
}

// ---------------------------------------------------------------
// Interpretação completa (palavras-chave + conversa + contexto)
// ---------------------------------------------------------------
/**
 * @returns {{ itens[], naoEntendido[], avisos[] }} no formato de interpretarFala,
 *   com campos extras: peca, atributo, veiculo, anos, pular.
 */
export function interpretarConversa(texto, ficha) {
  const conversa = ficha?.conversa || novaConversa();
  const pendente = conversa.pendente;
  const original = String(texto ?? "").replace(/\s+/g, " ").trim();
  const vazio = { itens: [], naoEntendido: [], avisos: [] };
  if (!original) return vazio;
  const n = norm(original).replace(/[.!?]+$/, "");

  // Cumprimento ("bom dia", "oi, tudo bem?") não é dado da ficha.
  if (/^(?:(?:oi|ola|bom dia|boa tarde|boa noite|tudo bem|tudo bom|e ai|beleza|opa)[\s,!?]*)+$/.test(n.trim())) return { ...vazio, itens: [{ campo: "saudacao", valor: true }] };
  // Respostas diretas à pergunta pendente (sem palavra-chave).
  if (pendente && PULAR.test(n.trim())) return { ...vazio, itens: [{ campo: "pular", valor: pendente }] };
  const temChave = /\b(codigo|preco|valor|custo|quantidade|estoque|marca|descricao|nome da peca|aplicac|referencia|sku|oem|equivalente|serve (?:no|na|nos|nas|para|em)|compativel)\b/.test(n);
  if (!temChave) {
    const ehDetalhe = pendente === "codigo" && entenderTrecho(original, { pendente: null }).itens.length > 0;
    if (pendente === "codigo" && !ehDetalhe && pareceCodigo(original)) {
      const c = lerCodigoFalado(original);
      if (c.codigo) return { ...vazio, itens: [{ campo: "codigo", valor: c.codigo, bruto: original, soletrado: c.soletrado, duvidas: c.duvidas }] };
    }
    if (pendente === "codigo" && !ehDetalhe && !pareceAno(original)) {
      const c = lerCodigoFalado(original);
      if (c.codigo && /\d/.test(c.codigo) && c.soletrado) return { ...vazio, itens: [{ campo: "codigo", valor: c.codigo, bruto: original, soletrado: true, duvidas: c.duvidas }] };
    }
    if (pendente === "preco") {
      const v = lerPreco(original);
      if (v !== null) return { ...vazio, itens: [{ campo: "preco", valor: v, bruto: original }] };
    }
    if (pendente === "quantidade") {
      const v = lerInteiro(original.replace(/\b(unidades?|pecas?|peças?)\b/gi, ""));
      if (v !== null && v >= 0) return { ...vazio, itens: [{ campo: "quantidade", valor: v, bruto: original }] };
    }
  }

  // Sem palavra-chave: conversa natural primeiro; código só se nada mais encaixar.
  if (!temChave) {
    const anosPend = pendente === "anos" ? lerAnos(original, { aceitarDoisDigitos: true }) : null;
    const r = entenderTrecho(original, { pendente, temPeca: Boolean(ficha?.peca || ficha?.campos?.descricao), grupoPeca: ficha?.peca?.grupo });
    if (anosPend && !r.itens.some((i) => i.campo === "anos")) {
      r.itens.push({ campo: "anos", valor: { inicio: anosPend.inicio, fim: anosPend.fim } });
      r.sobras = r.sobras.replace(/\b\d{2}\s*(?:\/|-|e|a|ate|barra)?\s*\d{2}\b/, "").trim();
    }
    const podeSerCodigo = !["anos", "veiculo", "modelo", "preco", "quantidade"].includes(pendente);
    if (!r.itens.length && podeSerCodigo && pareceCodigo(original)) {
      const c = lerCodigoFalado(original);
      if (c.codigo) return { ...vazio, itens: [{ campo: "codigo", valor: c.codigo, bruto: original, soletrado: c.soletrado, duvidas: c.duvidas, semPalavraChave: true }] };
    }
    return { itens: r.itens, naoEntendido: r.sobras ? [r.sobras] : [], avisos: [] };
  }

  // Palavras-chave de sempre.
  const base = interpretarFala(original);
  const resultado = { itens: [], naoEntendido: [], avisos: [...base.avisos] };
  for (const it of base.itens) {
    // "Código" sem palavra-chave que na verdade é ano já foi barrado em pareceCodigo.
    if (it.campo === "descricao") {
      const r = entenderTrecho(it.bruto, { pendente: null });
      const p = r.itens.find((x) => x.campo === "peca");
      if (p) {
        // "descrição lanterna dianteira esquerda" → peça + detalhes
        resultado.itens.push(...r.itens.filter((x) => x.campo === "peca" || x.campo === "atributo"));
        if (r.sobras) resultado.itens.push({ ...it, valor: it.valor });
        continue;
      }
    }
    if (it.campo === "aplicacao") {
      // "aplicação ônibus Neobus Mega Plus 2013" → guarda também o tipo do veículo
      const tipo = TIPOS_VEICULO.find(([f]) => new RegExp(`(?<![a-z0-9])${f.replace(/[- ]/g, "[-\\s]?")}(?![a-z0-9])`).test(norm(it.bruto)));
      if (tipo) {
        it.valor = { ...it.valor, tipoVeiculo: tipo[1], modelos: it.valor.modelos.map((m) => m.replace(new RegExp(`^${tipo[1]}\\s*`, "i"), "").trim()).filter(Boolean) };
      }
    }
    resultado.itens.push(it);
  }
  // Trechos sem palavra-chave: conversa natural.
  const temPeca = Boolean(ficha?.peca || ficha?.campos?.descricao);
  for (const trecho of base.naoEntendido) {
    const r = entenderTrecho(trecho, { pendente, temPeca, grupoPeca: ficha?.peca?.grupo });
    resultado.itens.push(...r.itens);
    if (r.sobras) resultado.naoEntendido.push(r.sobras);
  }
  return resultado;
}

// ---------------------------------------------------------------
// Aplicar na ficha
// ---------------------------------------------------------------
function compoeDescricao(peca, posicao) {
  if (!peca?.nome) return "";
  const pos = posicao ? (peca.genero === "f" ? posicao : posicao.replace(/a$/, "o")) : "";
  return [peca.nome, pos].filter(Boolean).join(" ");
}

/**
 * Aplica a interpretação da conversa.
 * @returns {{ ficha, mudancas[], avisos[], anotado: { peca?, veiculo?, anos?, atributos[] , novaPeca } }}
 */
export function aplicarConversa(ficha, interp, { agora = Date.now(), origem = "voz", textoOriginal = "" } = {}) {
  const simples = { itens: [], naoEntendido: interp.naoEntendido, avisos: interp.avisos };
  const extras = [];
  for (const it of interp.itens) {
    if (["peca", "atributo", "veiculo", "anos", "pular", "saudacao"].includes(it.campo)) extras.push(it);
    else simples.itens.push(it);
  }
  const r = aplicarInterpretacao(ficha, simples, { agora, origem, textoOriginal });
  const f = r.ficha;
  f.conversa = { ...novaConversa(), ...(f.conversa || {}) };
  f.atributos = f.atributos || {};
  const c = f.conversa;
  const mudancas = [...r.mudancas];
  const avisos = [...r.avisos];
  const anotado = { atributos: [], novaPeca: false };

  // Aplicações ditas com palavra-chave viram a "aplicação atual" da conversa.
  const apChave = simples.itens.filter((i) => i.campo === "aplicacao");
  if (apChave.length) {
    const ultima = f.aplicacoes.filter((a) => a.origem === "usuario").at(-1);
    if (ultima) {
      c.aplicacaoAtual = ultima.id;
      const tipo = apChave.at(-1).valor?.tipoVeiculo;
      if (tipo && !ultima.tipoVeiculo) ultima.tipoVeiculo = tipo;
    }
  }

  for (const it of extras) {
    if (it.campo === "saudacao") {
      anotado.saudacao = true;
      continue;
    }
    if (it.campo === "pular") {
      if (!c.pulados.includes(it.valor)) c.pulados.push(it.valor);
      anotado.pulou = it.valor;
      continue;
    }
    if (it.campo === "peca") {
      const atual = f.campos.descricao;
      const nova = compoeDescricao(it.valor, f.atributos.posicao?.valor);
      if (atual?.confirmado && atual.valor !== nova) {
        avisos.push(`A descrição já foi confirmada (${atual.valor}). Para trocar, desmarque a confirmação.`);
        continue;
      }
      anotado.novaPeca = !f.peca;
      f.peca = { tipo: it.valor.nome, genero: it.valor.genero, grupo: it.valor.grupo };
      if (!atual || atual.valor !== nova) {
        f.campos.descricao = { valor: nova, origem, em: agora, confirmado: false, anterior: atual?.valor, daConversa: true };
        mudancas.push(`Peça: ${nova}`);
      }
      anotado.peca = nova;
      continue;
    }
    if (it.campo === "atributo") {
      if (it.chave === "posicao") {
        f.atributos.posicao = { valor: it.valor, origem, em: agora };
        if (f.peca && (!f.campos.descricao || f.campos.descricao.daConversa) && !f.campos.descricao?.confirmado) {
          const nova = compoeDescricao({ nome: f.peca.tipo, genero: f.peca.genero }, it.valor);
          if (f.campos.descricao?.valor !== nova) {
            f.campos.descricao = { valor: nova, origem, em: agora, confirmado: false, anterior: f.campos.descricao?.valor, daConversa: true };
            mudancas.push(`Peça: ${nova}`);
            anotado.peca = nova;
          }
        }
        continue;
      }
      if (f.atributos[it.chave]?.valor !== it.valor) {
        f.atributos[it.chave] = { valor: it.valor, origem, em: agora };
        mudancas.push(`${it.chave}: ${it.valor}`);
      }
      anotado.atributos.push(it);
      continue;
    }
    if (it.campo === "veiculo") {
      const v = it.valor;
      if (!v.modelos.length) {
        c.veiculoParcial = { tipo: v.tipo || c.veiculoParcial?.tipo || "", montadora: v.montadora || c.veiculoParcial?.montadora || "" };
        anotado.veiculo = [c.veiculoParcial.tipo, c.veiculoParcial.montadora].filter(Boolean).join(" ");
        continue;
      }
      const tipo = v.tipo || c.veiculoParcial?.tipo || "";
      const montadora = v.montadora || c.veiculoParcial?.montadora || "";
      const anos = c.anosPendentes || {};
      const ap = { texto: [tipo, montadora, ...v.modelos, ...v.motores].filter(Boolean).join(" "), montadora, modelos: v.modelos, motores: v.motores, anoInicio: anos.inicio || null, anoFim: anos.fim || null, tipoVeiculo: tipo };
      const res = incluirAplicacao(f, ap, { origem: "usuario", agora });
      if (res.aviso) avisos.push(res.aviso);
      if (res.id) {
        c.aplicacaoAtual = res.id;
        c.veiculoParcial = null;
        c.anosPendentes = null;
        const a = f.aplicacoes.find((x) => x.id === res.id);
        if (a && tipo && !a.tipoVeiculo) a.tipoVeiculo = tipo;
        mudancas.push(`Aplicação informada: ${resumoAplicacao(a || ap)}`);
        anotado.veiculo = [tipo, montadora, ...v.modelos, ...v.motores].filter(Boolean).join(" ");
      }
      continue;
    }
    if (it.campo === "anos") {
      const a = f.aplicacoes.find((x) => x.id === c.aplicacaoAtual);
      if (a && a.origem === "usuario" && !a.confirmada) {
        a.anoInicio = it.valor.inicio;
        a.anoFim = it.valor.fim;
        c.aplicacaoAtual = rechavearAplicacao(f, a.id);
      } else if (a && a.confirmada) {
        avisos.push("A aplicação atual já foi conferida; os anos novos não foram trocados. Desmarque a conferência para mudar.");
        continue;
      } else {
        c.anosPendentes = { ...it.valor };
      }
      anotado.anos = it.valor;
      mudancas.push(`Anos: ${textoAnos(it.valor)}`);
    }
  }
  f.conversa = c;
  return { ficha: f, mudancas, avisos, anotado };
}

// ---------------------------------------------------------------
// Próxima pergunta e resposta do PAIIA
// ---------------------------------------------------------------
const nomeCurto = (f) => txt(f?.campos?.descricao?.valor).toLowerCase() || "peça";
const genero = (f) => f?.peca?.genero || "f";
const essa = (f) => (genero(f) === "m" ? "esse" : "essa");
const dessa = (f) => (genero(f) === "m" ? "desse" : "dessa");

/** Próxima pergunta conforme o que falta. Devolve { campo, texto } ou null. */
export function proximaPergunta(ficha) {
  const c = { ...novaConversa(), ...(ficha?.conversa || {}) };
  const pulou = (x) => c.pulados.includes(x);
  const desc = txt(ficha?.campos?.descricao?.valor);
  if (!desc && !pulou("peca")) return { campo: "peca", texto: "Qual é a peça? Por exemplo: lanterna dianteira, bico injetor, sonda lambda." };
  const apUsuario = (ficha?.aplicacoes || []).filter((a) => a.origem === "usuario");
  const temAplicacao = (ficha?.aplicacoes || []).length > 0;
  if (c.veiculoParcial && !pulou("modelo")) {
    const v = [c.veiculoParcial.tipo.toLowerCase(), c.veiculoParcial.montadora].filter(Boolean).join(" ");
    return { campo: "modelo", texto: `Qual é o modelo do ${v || "veículo"}?` };
  }
  if (!temAplicacao && !pulou("veiculo")) return { campo: "veiculo", texto: `Para qual veículo é ${essa(ficha)} ${nomeCurto(ficha)}? Diga o tipo, a marca e o modelo (ex.: ônibus Neobus Mega Plus).` };
  const atual = (ficha?.aplicacoes || []).find((a) => a.id === c.aplicacaoAtual) || apUsuario.at(-1);
  if (atual && atual.origem === "usuario" && !atual.anoInicio && !pulou("anos")) {
    const tipo = (atual.tipoVeiculo || "veículo").toLowerCase();
    return { campo: "anos", texto: `Você sabe o ano do ${tipo}?` };
  }
  const grupo = ficha?.peca?.grupo;
  if (GRUPOS_COM_LADO.has(grupo) && !ficha?.atributos?.lado && !pulou("lado")) {
    return { campo: "lado", texto: `A ${nomeCurto(ficha)} é de qual lado?`.replace(/^A (\S+o)\b/, "O $1") };
  }
  if (grupo === "luz" && !pulou("detalhes") && !["lente", "tecnologia", "tensao"].some((k) => ficha?.atributos?.[k])) {
    return { campo: "detalhes", texto: "Tem mais detalhes? Por exemplo: lente cristal ou fumê, LED ou halógena, 12 ou 24 volts." };
  }
  if (!codigoPrincipal(ficha) && !pulou("codigo")) return { campo: "codigo", texto: "Tem algum código gravado na peça ou na caixa? Pode falar ou usar “Ler código na foto”. Se não tiver, diga “sem código”." };
  if (!ficha?.campos?.preco && !pulou("preco")) return { campo: "preco", texto: "Qual é o preço de venda?" };
  if (!ficha?.campos?.quantidade && !pulou("quantidade")) return { campo: "quantidade", texto: "Quantas unidades você tem em estoque?" };
  return null;
}

function juntar(lista) {
  if (lista.length <= 1) return lista.join("");
  return `${lista.slice(0, -1).join(", ")} e ${lista.at(-1)}`;
}

const NOMES_ATRIB = { lado: "lado", lente: "lente", tecnologia: "tecnologia", tensao: "tensão" };

/**
 * Monta a resposta do PAIIA e já marca a pergunta pendente na ficha.
 * @returns {{ ficha, texto, pergunta }}
 */
export function responderConversa(ficha, interp, aplicado) {
  const f = copia(ficha);
  f.conversa = { ...novaConversa(), ...(f.conversa || {}) };
  const partes = [];
  const a = aplicado?.anotado || { atributos: [] };
  if (a.saudacao) partes.push("Olá! Estou aqui para montar a ficha da peça com você.");
  if (a.novaPeca && a.peca) partes.push(`Entendi. Vamos montar a ficha ${dessa(f)} ${a.peca.toLowerCase()}.`);
  else if (a.peca) partes.push(`Anotei a peça: ${a.peca.toLowerCase()}.`);
  if (a.veiculo) {
    const tipo = TIPOS_VEICULO.some(([, nome]) => a.veiculo.startsWith(nome));
    partes.push(`Anotei o veículo: ${tipo ? a.veiculo.charAt(0).toLowerCase() + a.veiculo.slice(1) : a.veiculo} (informado por você — confira na ficha).`);
  }
  if (a.anos) partes.push(`Anotei os anos informados: ${textoAnos(a.anos)}.`);
  if (a.atributos.length) {
    const ordem = ["lado", "lente", "tecnologia", "tensao"];
    const lista = [...a.atributos].sort((x, y) => ordem.indexOf(x.chave) - ordem.indexOf(y.chave))
      .map((x) => (x.chave === "lado" ? (x.valor === "par" ? "par (lado esquerdo e direito)" : `lado ${textoAtributo("lado", x.valor, "m")}`) : `${NOMES_ATRIB[x.chave]} ${x.valor}`));
    partes.push(`Anotei: ${juntar(lista)}.`);
  }
  const outras = (aplicado?.mudancas || []).filter((m) => /^(Código|Preço|Custo|Quantidade|Marca|Descrição|Aplicação informada)/.test(m) && !(a.veiculo && /^Aplicação informada/.test(m)));
  if (outras.length) partes.push(`Anotei: ${outras.join(" · ")}.`);
  if (a.pulou) partes.push("Tudo bem, seguimos sem essa informação.");
  const sobras = interp?.naoEntendido || [];
  if (sobras.length) partes.push(`Não consegui encaixar “${sobras.join("”, “")}” na ficha. Isso é o nome da peça, o veículo ou outro detalhe?`);
  if (!partes.length) partes.push("Não encontrei nada novo para anotar.");
  const pergunta = sobras.length ? null : proximaPergunta(f);
  f.conversa.pendente = pergunta?.campo || null;
  if (pergunta) {
    if (pergunta.campo === "detalhes" && !f.conversa.pulados.includes("detalhes")) f.conversa.pulados.push("detalhes"); // pergunta só uma vez
    partes.push(pergunta.texto);
  } else if (!sobras.length && f.conversa.pendente === null) {
    partes.push("A ficha básica está completa. Toque em “Consultar base PAIIA” e marque só as aplicações certas antes de enviar.");
  }
  return { ficha: f, texto: partes.join(" "), pergunta };
}

/** Atalho: fala → ficha nova + resposta. */
export function conversar(ficha, texto, opcoes = {}) {
  const interp = interpretarConversa(texto, ficha);
  const aplicado = aplicarConversa(ficha, interp, { ...opcoes, textoOriginal: texto });
  const resposta = responderConversa(aplicado.ficha, interp, aplicado);
  return { ficha: resposta.ficha, texto: resposta.texto, avisos: aplicado.avisos, interp, mudancas: aplicado.mudancas, pergunta: resposta.pergunta };
}
