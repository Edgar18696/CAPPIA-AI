// =============================================================
// PAIIA Voz — números e códigos FALADOS (funções puras, sem rede).
//   Testes: scripts/testes/paiiaVoz.test.mjs
//
// O reconhecimento de voz do navegador às vezes devolve "65,91" e às
// vezes "sessenta e cinco e noventa e um". Aqui só se converte o que é
// inequívoco; na dúvida devolve null (o campo fica para o usuário).
// =============================================================

export function semAcento(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const UNIDADES = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, meia: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12,
  treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16,
  dezessete: 17, dezoito: 18, dezenove: 19,
};
const DEZENAS = {
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60,
  setenta: 70, oitenta: 80, noventa: 90,
};
const CENTENAS = {
  cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300,
  trezentas: 300, quatrocentos: 400, quatrocentas: 400, quinhentos: 500,
  quinhentas: 500, seiscentos: 600, seiscentas: 600, setecentos: 700,
  setecentas: 700, oitocentos: 800, oitocentas: 800, novecentos: 900,
  novecentas: 900,
};

const ehPalavraNumero = (p) =>
  p in UNIDADES || p in DEZENAS || p in CENTENAS || p === "mil";

/**
 * "mil duzentos e trinta e quatro" → 1234. Palavras que não são número
 * fazem a função devolver null (não adivinha).
 */
export function inteiroPorExtenso(texto) {
  const palavras = semAcento(texto).toLowerCase().split(/\s+/).filter(Boolean)
    .filter((p) => p !== "e");
  if (!palavras.length) return null;
  let total = 0;
  let atual = 0;
  for (const p of palavras) {
    if (p in UNIDADES) atual += UNIDADES[p];
    else if (p in DEZENAS) atual += DEZENAS[p];
    else if (p in CENTENAS) atual += CENTENAS[p];
    else if (p === "mil") {
      total += (atual || 1) * 1000;
      atual = 0;
    } else return null;
  }
  return total + atual;
}

/** Texto com dígitos ou por extenso → inteiro (quantidade). */
export function lerInteiro(texto) {
  const t = semAcento(texto).toLowerCase().trim();
  const m = t.match(/^\d{1,6}$/) || t.match(/^(\d{1,6})\s*(unidades?|pecas?|un|pcs?)?$/);
  if (m) return Number(m[1] ?? m[0]);
  const limpo = t.replace(/\b(unidades?|pecas?|un)\b/g, "").trim();
  return inteiroPorExtenso(limpo);
}

/**
 * Preço falado → número com 2 casas, ou null.
 *  "65,91" / "65.91" / "R$ 65,91" / "1.234,50" → 65.91 / 1234.5
 *  "65 e 91" / "65 reais e 91 centavos" → 65.91
 *  "sessenta e cinco reais e noventa e um centavos" → 65.91
 *  "sessenta e cinco e noventa e um" (sem "reais") → ambíguo → null
 */
export function lerPreco(texto) {
  const t = semAcento(texto).toLowerCase().replace(/r\$\s*/g, "").trim();
  if (!t) return null;
  // formato numérico
  let m = t.match(/^(\d{1,3}(?:\.\d{3})+|\d+)(?:[,.](\d{1,2}))?$/);
  if (m) {
    const inteiro = Number(m[1].replace(/\./g, ""));
    const cent = m[2] ? Number(m[2].padEnd(2, "0")) : 0;
    return arred(inteiro + cent / 100);
  }
  // "65.91" com ponto decimal único já coberto; "65 e 91", "65 reais e 91 (centavos)"
  m = t.match(/^(\d+)\s*(?:reais|real)?\s*(?:e|com)\s*(\d{1,2})\s*(?:centavos?)?$/);
  if (m) return arred(Number(m[1]) + Number(m[2]) / 100);
  m = t.match(/^(\d+)\s*(?:reais|real)$/);
  if (m) return arred(Number(m[1]));
  // por extenso, exige "reais" para separar centavos
  const partes = t.split(/\breais?\b/);
  if (partes.length === 2) {
    const r = inteiroPorExtenso(partes[0]);
    const restoTxt = partes[1].replace(/\bcentavos?\b/, "").replace(/^\s*(e|com)\s+/, "").trim();
    const c = restoTxt ? inteiroPorExtenso(restoTxt) : 0;
    if (r === null || c === null || c > 99) return null;
    return arred(r + c / 100);
  }
  // por extenso sem "reais": só aceita se não houver centavos ("cem" → 100)
  const palavras = t.split(/\s+/).filter((p) => p !== "e");
  if (palavras.length && palavras.every(ehPalavraNumero)) {
    // "sessenta e cinco e noventa e um" é ambíguo (65,91 ou 156?) → null
    const eCount = (t.match(/\be\b/g) || []).length;
    if (eCount > 1) return null;
    const v = inteiroPorExtenso(t);
    return v === null ? null : arred(v);
  }
  return null;
}

const arred = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------
// Código soletrado: "zero dois oito zero bê traço doze" → "0280B-12"
// ---------------------------------------------------------------
const LETRAS_FALADAS = {
  a: "A", be: "B", bê: "B", ce: "C", cê: "C", de: "D", dê: "D", e: "E", efe: "F",
  ge: "G", gê: "G", aga: "H", i: "I", jota: "J", ca: "K", ka: "K", cá: "K",
  ele: "L", eme: "M", ene: "N", o: "O", pe: "P", pê: "P", que: "Q", quê: "Q",
  erre: "R", esse: "S", te: "T", tê: "T", u: "U", ve: "V", vê: "V",
  dabliu: "W", "dáblio": "W", dablio: "W", xis: "X", ipsilon: "Y", "ípsilon": "Y",
  ze: "Z", zê: "Z",
};
const DIGITOS_FALADOS = {
  zero: "0", um: "1", uma: "1", dois: "2", duas: "2", tres: "3", "três": "3",
  quatro: "4", cinco: "5", seis: "6", meia: "6", sete: "7", oito: "8", nove: "9",
};
const SEPARADORES = { traco: "-", "traço": "-", hifen: "-", "hífen": "-", barra: "/", ponto: "." };

/**
 * Converte um código dito em voz para texto. Mantém blocos já em dígitos
 * ou letras ("0280158276", "AR22U") e troca palavras de letra/dígito.
 * Devolve { codigo, soletrado, duvidas[] }: "soletrado" indica que houve
 * conversão de palavras (o usuário deve conferir letra a letra).
 */
export function lerCodigoFalado(texto) {
  const original = String(texto ?? "").trim();
  if (!original) return { codigo: "", soletrado: false, duvidas: [] };
  const tokens = original.split(/\s+/);
  let saida = "";
  let soletrado = false;
  const duvidas = [];
  for (const tk of tokens) {
    const baixo = tk.toLowerCase();
    const limpo = semAcento(baixo).replace(/[^a-z0-9]/g, "");
    if (/^[a-z0-9][a-z0-9.\-/]*$/i.test(tk) && /\d/.test(tk)) {
      saida += tk.toUpperCase();
      continue;
    }
    if (baixo in SEPARADORES || limpo in SEPARADORES) {
      saida += SEPARADORES[baixo] ?? SEPARADORES[limpo];
      soletrado = true;
      continue;
    }
    if (limpo in DIGITOS_FALADOS || baixo in DIGITOS_FALADOS) {
      saida += DIGITOS_FALADOS[baixo] ?? DIGITOS_FALADOS[limpo];
      soletrado = true;
      continue;
    }
    if (baixo in LETRAS_FALADAS || limpo in LETRAS_FALADAS) {
      saida += LETRAS_FALADAS[baixo] ?? LETRAS_FALADAS[limpo];
      soletrado = true;
      if (["e", "o", "a", "i"].includes(limpo)) duvidas.push(`"${tk}" foi lido como a letra ${limpo.toUpperCase()}`);
      continue;
    }
    // número por extenso maior ("doze") vira dígitos
    const n = inteiroPorExtenso(limpo);
    if (n !== null) {
      saida += String(n);
      soletrado = true;
      duvidas.push(`"${tk}" foi lido como ${n}`);
      continue;
    }
    if (/^[a-z]{1,4}$/i.test(tk)) {
      // bloco curto de letras ditas juntas (ex.: "AR")
      saida += tk.toUpperCase();
      continue;
    }
    duvidas.push(`"${tk}" não foi entendido`);
  }
  return { codigo: saida, soletrado, duvidas };
}
