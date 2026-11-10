// (10/11) Foto IA — recorte LOCAL (sem Replicate, Gemini, créditos ou cota mensal).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  rgbaParaTensor,
  saidaParaMascara,
  firmarMascara,
  fracaoPeca,
  MODELOS_RECORTE,
  MODELO_PADRAO,
} from "../../src/services/fotoIA/recorteLocalFotoIA.js";

const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("tensor NCHW normalizado (média/desvio do modelo, dividido pelo máximo)", () => {
  const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
  const t = rgbaParaTensor(rgba, 2, { media: [0.5, 0.5, 0.5], desvio: [1, 1, 1] });
  assert.equal(t.length, 12);
  assert.deepEqual(Array.from(t.slice(0, 4)), [0.5, -0.5, -0.5, 0.5]); // canal R
  assert.deepEqual(Array.from(t.slice(4, 8)), [-0.5, 0.5, -0.5, 0.5]); // canal G
  assert.deepEqual(Array.from(t.slice(8, 12)), [-0.5, -0.5, 0.5, 0.5]); // canal B
});

test("saída do modelo vira máscara 0..255", () => {
  assert.deepEqual(Array.from(saidaParaMascara(new Float32Array([0.2, 0.6, 1.0, 0.2]), 4)), [0, 128, 255, 0]);
  assert.deepEqual(Array.from(saidaParaMascara(new Float32Array([0.5, 0.5]), 2)), [0, 0], "saída constante não quebra");
});

test("máscara firme: fundo fraco some, peça forte fica opaca, borda suave", () => {
  const m = firmarMascara(new Uint8ClampedArray([0, 30, 38, 95, 153, 200, 255]));
  assert.equal(m[0], 0);
  assert.equal(m[1], 0);
  assert.ok(m[3] > 0 && m[3] < 255, "transição suave");
  assert.equal(m[4], 255);
  assert.equal(m[6], 255);
});

test("fração da peça detecta recorte vazio", () => {
  assert.equal(fracaoPeca(new Uint8ClampedArray([0, 0, 255, 255])), 0.5);
  assert.equal(fracaoPeca(new Uint8ClampedArray(10)), 0);
});

test("modelos abertos, servidos pelo próprio PAIIA; nenhum serviço pago no recorte local", () => {
  assert.ok(MODELOS_RECORTE[MODELO_PADRAO]);
  const c = ler("src/services/fotoIA/recorteLocalFotoIA.js");
  const w = ler("src/services/fotoIA/recorteLocalWorker.js");
  assert.match(c, /`\$\{PASTA_MODELOS\}\$\{modelo\.arquivo\}`/, "modelo vem do próprio site");
  for (const fonte of [c, w]) {
    assert.ok(!/replicate|gemini|functions\.invoke|foto-ia"|generativelanguage|https?:\/\//i.test(fonte.replace(/^\/\/.*$/gm, "")), "sem chamada externa");
    assert.match(fonte, /numThreads = 1/);
  }
  assert.match(c, /new Worker\(new URL\("\.\/recorteLocalWorker\.js", import\.meta\.url\)/);
});
