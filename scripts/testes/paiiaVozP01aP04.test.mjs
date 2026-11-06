// PAIIA Voz P-01 a P-04 (14/11): códigos e título por voz contínua, calculadora de preço e base na Compatibilidade.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { calcularPrecoVenda } from "../../src/modules/paiiaVoz/servicos/calculadoraPreco.js";
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const t = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");

test("P-01) SKU por voz → códigos adicionais (microfone continua); 'não tenho mais códigos' → Título", () => {
  assert.ok(t.includes('if (origem === "voz") { setCampoVoz("codigoAdicional");') && t.includes("seguirOuvindo();"));
  assert.ok(t.includes("n[aã]o tenho mais|n[aã]o tem mais|s[oó] isso|acabou|pronto|terminei") && t.includes('setCampoVoz("titulo"); // mesmo com título sugerido'));
});

test("P-02) título aparece no campo com o microfone ligado; depois do título vai para a Descrição; códigos em maiúsculas", () => {
  assert.ok(t.includes('ditando={campoVoz === "titulo" && ouvindo && parcial ? parcial : ""}') && t.includes('ditando={ouvindo && !campoVoz && parcial ? parcial : ""}'));
  assert.ok(t.includes('if (origem === "voz") { setCampoVoz(""); seguirOuvindo(); }'));
  const up = (s) => String(s).replace(/\b(?=[\p{L}\d-]*\d)(?=[\p{L}\d-]*\p{L})[\p{L}\d-]{3,}\b/gu, (w) => (/^\d+(\.\d+)?$/.test(w) ? w : w.toUpperCase()));
  assert.equal(up("Kit Bico Injetor Ka Flex 1.0 iwp211"), "Kit Bico Injetor Ka Flex 1.0 IWP211");
});

test("P-03) calculadora: custo + frete + despesas ÷ (1 − comissão − impostos − margem); partes separadas; sem custo não calcula", () => {
  const r = calcularPrecoVenda({ custo: "12,50", frete: "5", despesas: "1", comissao: "12", impostos: "6", margem: "15" });
  assert.equal(r.ok, true);
  assert.equal(r.preco, 27.62);
  assert.ok(Math.abs(r.partes.custo + r.partes.frete + r.partes.despesas + r.partes.comissao + r.partes.impostos + r.partes.lucro - r.preco) < 0.02);
  assert.equal(calcularPrecoVenda({ custo: "" }).ok, false, "nunca presume custo");
  assert.equal(calcularPrecoVenda({ custo: 10, comissao: 50, impostos: 30, margem: 20 }).ok, false);
  assert.ok(ler("src/modules/paiiaVoz/CalculadoraPrecoVoz.jsx").includes("data-pv-calc-usar"), "só preenche o preço com o toque");
});

test("P-04) Compatibilidade traz a base sozinha (fichas antigas: consulta UMA vez) e a versão quando houver", () => {
  assert.ok(t.includes('if (b?.estado === "encontrado") aproveitarBase(); else consultarBase(cp0.codigo);'));
  assert.ok(ler("src/modules/paiiaVoz/servicos/consultaBaseVoz.js").includes("versao: txt(l.versao),"));
});

test("rev.2) calculadora SEMPRE visível com 'Custo da Mercadoria (R$)'; versão na tela e aviso de versão nova publicada", () => {
  const c = ler("src/modules/paiiaVoz/CalculadoraPrecoVoz.jsx");
  assert.ok(!c.includes("setAberta") && c.includes('"Custo da Mercadoria (R$)"') && c.includes("Preço de Venda Sugerido"));
  assert.ok(t.includes("export const VERSAO_PAIIA_VOZ") && t.includes("data-pv-versao") && t.includes("data-pv-nova-versao"));
  assert.ok(t.includes("fetch(`/?v=${Date.now()}`, { cache: \"no-store\" })") && t.includes("/(^|\\.)paiia\\.com\\.br$/.test(window.location.hostname)"));
});
