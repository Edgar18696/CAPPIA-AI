// =============================================================
// PAIIA Voz — INTERPRETAR O QUE FOI FALADO (ou digitado).
//   Testes: scripts/testes/paiiaVoz.test.mjs
//
// Sem IA paga e sem rede: regras simples por palavra-chave.
//   "código 0280158276 descrição bico injetor marca Torken preço 65,91
//    quantidade 2 aplicação Gol 1.6 2010 a 2015"
// vira itens { campo, valor, ... }. Nada é gravado aqui; quem decide é a
// ficha (fichaVoz.js) e, no fim, o usuário.
// Regra da loja: aplicação dita pelo usuário entra como "informada" e só
// vai para a descrição depois de confirmada. Nada é inventado.
// =============================================================

import { semAcento, lerPreco, lerInteiro, lerCodigoFalado } from "./numerosFalados.js";

// Ordem importa: a expressão mais longa vem antes da mais curta.
const PALAVRAS = [
  ["codigoPrincipal", ["codigo principal", "sku principal"]],
  ["codigoAdicional", ["outro codigo", "codigo equivalente", "codigo oem", "codigo original", "equivalente", "oem"]],
  ["custo", ["preco de custo", "custo"]],
  ["preco", ["preco de venda", "preco", "valor de venda", "valor"]],
  ["codigo", ["codigo da peca", "numero da peca", "codigo", "referencia", "sku", "cod"]],
  // "peça"/"produto" soltos NÃO são palavra-chave: "tenho uma peça de ônibus"
  // é conversa (conversaVoz.js entende); use "descrição" ou "nome da peça".
  ["descricao", ["nome da peca", "descricao"]],
  ["marca", ["marca", "fabricante"]],
  ["quantidade", ["quantidade", "estoque", "qtd"]],
  ["aplicacao", ["aplicacoes", "aplicacao", "serve no", "serve na", "serve nos", "serve nas", "serve para", "serve em", "compativel com", "veiculos", "veiculo", "carro"]],
];

const ALTERNATIVAS = PALAVRAS.flatMap(([campo, lista]) => lista.map((p) => ({ campo, p })))
  .sort((a, b) => b.p.length - a.p.length);
const RE_CHAVE = new RegExp(
  `(?<![a-z0-9])(${ALTERNATIVAS.map((a) => a.p.replace(/ /g, "\\s+")).join("|")})(?![a-z0-9])`,
  "g",
);
const campoDaChave = (texto) => {
  const t = texto.replace(/\s+/g, " ");
  return (ALTERNATIVAS.find((a) => a.p === t) || {}).campo || null;
};

/** Versão minúscula e sem acento com o MESMO comprimento do original. */
function normalizarMesmoTamanho(original) {
  const chars = Array.from(original);
  const norm = chars.map((c) => {
    const n = semAcento(c).toLowerCase();
    return n.length === c.length ? n : c.toLowerCase();
  });
  return { norm: norm.join(""), ok: norm.join("").length === original.length };
}

// (22/10/2026) Sem \b: no JavaScript "é" não é letra para \b, e "o código é 0280…"
// virava "E0280…". Agora a ligação só sai quando é palavra inteira.
const LIGACOES_INICIO = /^\s*(?:[:=\-–]|(?:e|é|eh|de|do|da|dos|das|dela|dele|igual a|vale|fica|será|sera|seria|para|pra)(?=\s|$))\s*/i;
const LIGACOES_FIM = /[\s,.;:]+$|\s+(?:e|é)\s*$/i;
function limparValor(v) {
  let s = String(v ?? "");
  for (let i = 0; i < 3; i++) s = s.replace(LIGACOES_INICIO, "");
  for (let i = 0; i < 3; i++) s = s.replace(LIGACOES_FIM, "");
  return s.trim();
}

// Ano (1950–2049) sozinho ou em par/faixa: "2014", "2013/2014", "2013 e 2014".
const ANO = "(?:19[5-9]\\d|20[0-4]\\d)";
const RE_SO_ANOS = new RegExp(`^(?:(?:ano|anos|modelo|de|do|da)\\s+)*${ANO}(?:\\s*(?:\\/|-|e|a|ate|até|ou|barra)\\s*${ANO})*$`, "i");
// Palavras que nunca fazem parte de um código falado.
const NAO_CODIGO = /^(e|a|o|de|do|da|ate|até|ou|volts?|v|anos?|lado|led|cristal|esquerd[oa]|direit[oa])$/i;

/** Parece só ano(s) de veículo? ("2013/2014", "2013 e 2014", "ano 2014") */
export function pareceAno(texto) {
  return RE_SO_ANOS.test(String(texto ?? "").trim().replace(/\s+/g, " "));
}

/** Parece código de peça? (tem dígito, sem espaços longos de texto; ano NÃO é código) */
export function pareceCodigo(texto) {
  const t = String(texto ?? "").trim();
  if (!t || t.length > 30) return false;
  if (!/\d/.test(t)) return false;
  if (pareceAno(t)) return false;
  const palavras = t.split(/\s+/);
  if (palavras.some((p) => NAO_CODIGO.test(p))) return false;
  // Cada pedaço tem número ou é letra solta/curta ("F 000 99", "16600 3AC0A");
  // palavras como "Nissan March 1.6" não são código.
  return palavras.length <= 4 && palavras.every((p) => /^[A-Za-z0-9.\-/]+$/.test(p) && (/\d/.test(p) || p.length <= 2));
}

// ---------------------------------------------------------------
// Aplicações
// ---------------------------------------------------------------
export const MONTADORAS = [
  "fiat", "chevrolet", "gm", "volkswagen", "vw", "ford", "renault", "hyundai", "kia", "toyota",
  "honda", "nissan", "peugeot", "citroen", "jeep", "mitsubishi", "bmw", "mercedes", "mercedes-benz",
  "audi", "chery", "jac", "caoa", "suzuki", "subaru", "volvo", "land rover", "dodge", "iveco",
  "mwm", "scania", "troller", "lifan", "effa", "byd", "gwm",
  // Ônibus e caminhões (encarroçadoras e pesados): também não entram no título.
  "neobus", "marcopolo", "comil", "caio", "irizar", "busscar", "mascarello", "induscar", "agrale", "daf", "foton", "sinotruk", "shacman", "international",
];
const PALAVRAS_VAZIAS = new Set(["de", "do", "da", "dos", "das", "a", "o", "e", "ate", "motor", "ano", "anos", "modelo", "modelos", "versao", "no", "na", "nos", "nas", "para", "em", "com", "todos", "todas", "partir"]);

function capitalizar(p) {
  if (/^\d/.test(p) || p.length <= 3 && /[a-z]/i.test(p) && p === p.toUpperCase()) return p;
  return p.charAt(0).toUpperCase() + p.slice(1);
}

/** Uma aplicação falada → { texto, montadora, modelos[], motores[], anoInicio, anoFim } */
export function interpretarAplicacao(texto) {
  const bruto = limparValor(texto);
  if (!bruto) return null;
  let resto = ` ${semAcento(bruto).toLowerCase()} `;
  const original = bruto;

  let anoInicio = null;
  let anoFim = null;
  const faixa = resto.match(/\b((?:19|20)\d{2})\s*(?:a|ate|-|\/|e)\s*((?:19|20)\d{2})\b/);
  if (faixa) {
    anoInicio = Number(faixa[1]);
    anoFim = Number(faixa[2]);
    resto = resto.replace(faixa[0], " ");
  } else {
    const desde = resto.match(/\b(?:a partir de|desde|apos)\s*((?:19|20)\d{2})\b/);
    if (desde) {
      anoInicio = Number(desde[1]);
      resto = resto.replace(desde[0], " ");
    } else {
      const unico = resto.match(/\b((?:19|20)\d{2})\b/);
      if (unico) {
        anoInicio = Number(unico[1]);
        anoFim = Number(unico[1]);
        resto = resto.replace(unico[0], " ");
      }
    }
  }
  if (anoInicio && anoFim && anoFim < anoInicio) [anoInicio, anoFim] = [anoFim, anoInicio];

  const motores = [];
  resto = resto.replace(/\b(\d[.,]\d)(?:\s*(8v|16v|12v|20v|24v|v6|v8|turbo|tsi|tfsi|flex|diesel|mpi|gdi))?\b/g, (m, cil, extra) => {
    const mot = `${cil.replace(",", ".")}${extra ? ` ${extra.toUpperCase()}` : ""}`;
    if (!motores.includes(mot)) motores.push(mot);
    return " ";
  });
  resto = resto.replace(/\b(8v|16v|12v|20v|24v|v6|v8)\b/g, (m) => {
    const mot = m.toUpperCase();
    if (!motores.some((x) => x.includes(mot))) motores.push(mot);
    return " ";
  });

  let montadora = "";
  for (const mt of MONTADORAS) {
    const re = new RegExp(`(?<![a-z0-9])${mt.replace(/[-\s]/g, "[-\\s]?")}(?![a-z0-9])`);
    if (re.test(resto)) {
      montadora = mt === "vw" ? "Volkswagen" : mt === "gm" ? "Chevrolet" : capitalizar(mt);
      resto = resto.replace(re, " ");
      break;
    }
  }

  // Modelos: o que sobra, separado por vírgula / "e" / barra.
  const palavrasOriginais = Array.from(original.matchAll(/[\p{L}\p{N}-]+/gu)).map((m) => m[0]);
  const mapaOriginal = new Map(palavrasOriginais.map((w) => [semAcento(w).toLowerCase(), w]));
  const modelos = [];
  resto.split(/,|\/|\s+e\s+|;/).forEach((pedaco) => {
    const palavras = pedaco.split(/\s+/).filter((p) => p && !PALAVRAS_VAZIAS.has(p) && /[a-z0-9]/.test(p));
    if (!palavras.length) return;
    const nome = palavras.map((p) => capitalizar(mapaOriginal.get(p) || p)).join(" ");
    if (nome && !modelos.includes(nome)) modelos.push(nome);
  });

  return { texto: original, montadora, modelos, motores, anoInicio, anoFim };
}

/** "Gol 1.6 2010 a 2015; Parati 1.8 2008" → várias aplicações */
export function separarAplicacoes(texto) {
  return String(texto ?? "")
    .split(/;|\b(?:tambem|também)\b|\boutra aplicacao\b|\boutra aplicação\b/i)
    .map((t) => interpretarAplicacao(t))
    .filter((a) => a && (a.modelos.length || a.motores.length || a.anoInicio));
}

// ---------------------------------------------------------------
// Interpretação principal
// ---------------------------------------------------------------
/**
 * @returns {{ itens: Array<{campo, valor, bruto, soletrado?, duvidas?}>, naoEntendido: string[], avisos: string[] }}
 */
export function interpretarFala(texto) {
  const original = String(texto ?? "").replace(/\s+/g, " ").trim();
  const resultado = { itens: [], naoEntendido: [], avisos: [] };
  if (!original) return resultado;
  const { norm, ok } = normalizarMesmoTamanho(original);
  const base = ok ? original : semAcento(original);
  const alvo = ok ? norm : semAcento(original).toLowerCase();

  const achados = [];
  RE_CHAVE.lastIndex = 0;
  let m;
  while ((m = RE_CHAVE.exec(alvo))) {
    achados.push({ campo: campoDaChave(m[1]), inicio: m.index, fim: m.index + m[0].length });
  }

  let antes = limparValor(base.slice(0, achados.length ? achados[0].inicio : base.length));
  // (22/10/2026) "corrige o código para X" / "na verdade o código é X": troca o PRINCIPAL.
  const RE_CORRECAO = /^(?:na verdade|corrig\w*|corrij\w*|troc\w*|mud\w*|alter\w*|o certo e|o correto e)(?:\s+(?:o|a|e|eh))*$/;
  const correcao = Boolean(antes) && achados.length > 0 && RE_CORRECAO.test(semAcento(antes).toLowerCase());
  if (correcao) antes = "";
  if (antes) {
    if (pareceCodigo(antes)) {
      const c = lerCodigoFalado(antes);
      resultado.itens.push({ campo: "codigo", valor: c.codigo, bruto: antes, soletrado: c.soletrado, duvidas: c.duvidas, semPalavraChave: true });
    } else {
      resultado.naoEntendido.push(antes);
    }
  }

  achados.forEach((a, i) => {
    const fim = i + 1 < achados.length ? achados[i + 1].inicio : base.length;
    const bruto = limparValor(base.slice(a.fim, fim));
    if (!bruto) {
      resultado.avisos.push(`Faltou dizer o valor depois de "${base.slice(a.inicio, a.fim).trim()}".`);
      return;
    }
    switch (a.campo) {
      case "codigo":
      case "codigoPrincipal":
      case "codigoAdicional": {
        const c = lerCodigoFalado(bruto);
        if (!c.codigo) {
          resultado.naoEntendido.push(bruto);
          break;
        }
        resultado.itens.push({ campo: correcao && a.campo === "codigo" ? "codigoPrincipal" : a.campo, valor: c.codigo, bruto, soletrado: c.soletrado, duvidas: c.duvidas, ...(correcao ? { correcao: true } : {}) });
        break;
      }
      case "preco":
      case "custo": {
        const v = lerPreco(bruto);
        if (v === null) {
          resultado.avisos.push(`Não entendi o valor "${bruto}". Diga, por exemplo, "65,91" ou "65 reais e 91 centavos".`);
          resultado.naoEntendido.push(bruto);
        } else resultado.itens.push({ campo: a.campo, valor: v, bruto });
        break;
      }
      case "quantidade": {
        const v = lerInteiro(bruto);
        if (v === null || v < 0) {
          resultado.avisos.push(`Não entendi a quantidade "${bruto}".`);
          resultado.naoEntendido.push(bruto);
        } else resultado.itens.push({ campo: "quantidade", valor: v, bruto });
        break;
      }
      case "aplicacao": {
        const lista = separarAplicacoes(bruto);
        if (!lista.length) resultado.naoEntendido.push(bruto);
        lista.forEach((ap) => resultado.itens.push({ campo: "aplicacao", valor: ap, bruto: ap.texto }));
        break;
      }
      case "descricao":
      case "marca":
        resultado.itens.push({ campo: a.campo, valor: bruto.charAt(0).toUpperCase() + bruto.slice(1), bruto });
        break;
      default:
        resultado.naoEntendido.push(bruto);
    }
  });
  return resultado;
}
