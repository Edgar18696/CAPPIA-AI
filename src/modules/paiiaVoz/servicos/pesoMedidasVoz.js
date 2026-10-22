// =============================================================
// PAIIA Voz — PESO E MEDIDAS DITOS → Dados técnicos do Novo Anúncio
// (22/10/2026). Funções puras.
//   Testes: scripts/testes/paiiaVozRapido.test.mjs
//
// Entende frases como:
//   "peso 350 gramas" · "pesa 0,35 kg" · "meio quilo"
//   "medidas 20 por 10 por 10" · "20 x 10 x 10 cm" · "200 por 100 por 100 mm"
//   "comprimento 20, largura 10, altura 10"
// Três números "A por B por C" = comprimento × largura × altura.
// Diâmetro/espessura são da PEÇA, não da embalagem: não entram.
// Nada vai sozinho para o frete: o Novo Anúncio só preenche os campos
// VAZIOS e pede a sua conferência antes de cotar o frete.
// =============================================================
import { semAcento } from "./numerosFalados.js";

const n = (s) => semAcento(String(s ?? "")).toLowerCase();
const num = (s) => Number(String(s).replace(",", "."));
const NUM = "(\\d+(?:[.,]\\d+)?)";
const U_COMP = "(mm|cm|m|milimetros?|centimetros?|metros?)";
const RE_PESO = new RegExp(`${NUM}\\s*(kg|kgs|quilos?|quilogramas?|kilos?|g|gr|grs|gramas?)(?![a-z])`, "g");
const RE_TRIPLA = new RegExp(`${NUM}\\s*${U_COMP}?\\s*(?:x|por|×|vezes)\\s*${NUM}\\s*${U_COMP}?\\s*(?:x|por|×|vezes)\\s*${NUM}\\s*${U_COMP}?(?![a-z])`);
const RE_NOMEADA = new RegExp(`(comprimento|largura|altura)\\s*(?:de|e|:|=)?\\s*${NUM}\\s*${U_COMP}?(?![a-z])`, "g");

function paraCm(valor, unidade) {
  const u = String(unidade || "cm");
  if (/^(mm|milimetro)/.test(u)) return valor / 10;
  if (/^(m|metro)/.test(u) && !/^(mm|milimetro)/.test(u)) return valor * 100;
  return valor;
}
const arred = (v, casas = 1) => Math.round(v * 10 ** casas) / 10 ** casas;

/**
 * @param frases frases ditas (as que o PAIIA separou como medidas/peso)
 * @returns {{ peso_g, comprimento_cm, largura_cm, altura_cm, frases[], duvidas[] }}
 */
export function lerPesoEMedidas(frases) {
  const r = { peso_g: null, comprimento_cm: null, largura_cm: null, altura_cm: null, frases: [], duvidas: [] };
  for (const original of frases || []) {
    const f = n(original);
    if (!f.trim()) continue;
    let usou = false;
    // Peso
    const pesos = [...f.matchAll(RE_PESO)];
    if (/\bmeio\s+(?:quilo|kg|kilo)\b/.test(f)) pesos.push([null, "0.5", "kg"]);
    for (const m of pesos) {
      const v = num(m[1]);
      const g = /^(kg|kgs|quilo|quilos|quilograma|quilogramas|kilo|kilos)$/.test(m[2]) ? v * 1000 : v;
      if (!(g > 0) || g > 100000) { r.duvidas.push(`Peso “${m[0] || original}” fora do esperado: confira.`); continue; }
      if (r.peso_g !== null && r.peso_g !== Math.round(g)) r.duvidas.push(`Foram ditos dois pesos (${r.peso_g} g e ${Math.round(g)} g): ficou o último.`);
      r.peso_g = Math.round(g);
      usou = true;
    }
    // Medidas da peça (diâmetro/espessura) não são da embalagem.
    if (/\b(diametro|espessura|furo|rosca)\b/.test(f) && !/\b(embalagem|caixa|pacote)\b/.test(f)) {
      if (usou) r.frases.push(String(original).trim());
      continue;
    }
    const t = f.match(RE_TRIPLA);
    if (t) {
      const unidade = t[6] || t[4] || t[2] || "cm";
      const [c, l, a] = [num(t[1]), num(t[3]), num(t[5])].map((v) => arred(paraCm(v, unidade)));
      if ([c, l, a].every((v) => v > 0 && v <= 300)) {
        r.comprimento_cm = c; r.largura_cm = l; r.altura_cm = a;
        usou = true;
      } else r.duvidas.push(`Medidas “${t[0]}” fora do esperado: confira.`);
    }
    for (const m of f.matchAll(RE_NOMEADA)) {
      const v = arred(paraCm(num(m[2]), m[3]));
      if (!(v > 0 && v <= 300)) { r.duvidas.push(`${m[1]} “${m[0]}” fora do esperado: confira.`); continue; }
      r[`${m[1]}_cm`] = v;
      usou = true;
    }
    if (usou) r.frases.push(String(original).trim());
  }
  return r;
}

const virgula = (v, casas) => String(Number(v.toFixed(casas))).replace(".", ",");

/**
 * Campos do Novo Anúncio (Dados técnicos) a partir do que foi dito.
 * Peso em kg com vírgula ("0,35"); medidas em cm. Só os que foram ditos.
 */
export function camposDadosTecnicos(lido) {
  const c = {};
  if (lido?.peso_g > 0) c.pesoFreteML = virgula(lido.peso_g / 1000, 3);
  if (lido?.comprimento_cm > 0) c.comprimentoFreteML = virgula(lido.comprimento_cm, 1);
  if (lido?.largura_cm > 0) c.larguraFreteML = virgula(lido.largura_cm, 1);
  if (lido?.altura_cm > 0) c.alturaFreteML = virgula(lido.altura_cm, 1);
  return c;
}

/** Texto curto para a tela: "350 g · 20 × 10 × 10 cm". */
export function textoPesoMedidas(lido) {
  const partes = [];
  if (lido?.peso_g > 0) partes.push(`${lido.peso_g} g`);
  const d = [lido?.comprimento_cm, lido?.largura_cm, lido?.altura_cm];
  if (d.some((v) => v > 0)) partes.push(`${d.map((v) => (v > 0 ? String(v).replace(".", ",") : "?")).join(" × ")} cm (C × L × A)`);
  return partes.join(" · ");
}
