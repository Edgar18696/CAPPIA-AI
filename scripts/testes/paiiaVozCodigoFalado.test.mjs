// =============================================================
// PAIIA Voz (03/11/2026): regra definitiva do código FALADO.
//   node --test scripts/testes/paiiaVozCodigoFalado.test.mjs
// Origem do traço “fantasma”: o reconhecimento de voz do navegador formata
// números sozinho (ex.: “2421-01345 R”). O PAIIA nunca inventou traço; agora,
// em código falado, retira a pontuação que não foi pronunciada.
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { lerCodigoFalado, limparFormatacaoDoReconhecedor } from "../../src/modules/paiiaVoz/servicos/numerosFalados.js";
import { lerCodigoDaFala } from "../../src/modules/paiiaVoz/servicos/rascunhoRapido.js";
import { interpretarFala } from "../../src/modules/paiiaVoz/servicos/interpretarFala.js";
import { interpretarConversa } from "../../src/modules/paiiaVoz/servicos/conversaVoz.js";
import { criarFichaVoz } from "../../src/modules/paiiaVoz/servicos/fichaVoz.js";
import { normalizarCodigoComparacao, variantesDeBusca } from "../../src/services/duplicidadeML.js";

const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const voz = (t) => lerCodigoDaFala(t, { falado: true }).codigo;

test("exemplos aprovados: sem traço por padrão; traço só quando dito", () => {
  assert.equal(voz("dois quatro dois um zero um três quatro cinco erre"), "242101345R");
  assert.equal(voz("dois quatro dois um traço zero um três quatro cinco erre"), "2421-01345R");
  assert.equal(voz("dois quatro dois um hífen zero um três quatro cinco erre"), "2421-01345R");
});

test("formatação do reconhecedor do celular (traço/ponto/espaço não ditos) é retirada", () => {
  for (const ouvido of ["2421-01345 R", "2421-01345R", "2421 01345 R", "2421.01345R", "2421–01345R", "2421-0134-5R", "o código é 2421-01345R", "2421-01345R."]) {
    assert.equal(voz(ouvido), "242101345R", ouvido);
  }
  // o reconhecedor trocou a PALAVRA “traço” pelo sinal, solto entre espaços: foi dito → fica
  assert.equal(voz("2421 - 01345 R"), "2421-01345R");
  assert.equal(voz("2421 traço 01345 R"), "2421-01345R");
  assert.equal(limparFormatacaoDoReconhecedor("0280-158-276"), "0280158276");
});

test("digitado: hífen preservado; nada de pontuação acrescentada", () => {
  assert.equal(lerCodigoDaFala("2421-01345R").codigo, "2421-01345R");
  assert.equal(lerCodigoDaFala("242101345R").codigo, "242101345R");
  assert.equal(lerCodigoDaFala("o código é 16600-3AC0A").codigo, "16600-3AC0A");
  assert.equal(lerCodigoFalado("242101345R").codigo, "242101345R");
  assert.ok(!/[-.]/.test(voz("dois quatro dois um zero um três quatro cinco erre")));
});

test("“código …” dito na conversa/descrição segue a mesma regra; preço não é afetado", () => {
  assert.equal(interpretarFala("código 2421-01345R", { falado: true }).itens[0].valor, "242101345R");
  assert.equal(interpretarFala("código 2421-01345R").itens[0].valor, "2421-01345R", "digitado");
  assert.equal(interpretarFala("preço 39,90", { falado: true }).itens[0].valor, 39.9);
  const r = interpretarConversa("código 2421-01345 R", criarFichaVoz({ agora: 1, id: "c" }), { falado: true });
  assert.equal(r.itens.find((i) => i.campo === "codigo" || i.campo === "codigoPrincipal")?.valor, "242101345R");
});

test("busca reconhece com/sem traço e espaço, sem mudar o SKU", () => {
  assert.equal(normalizarCodigoComparacao("2421-01345R"), normalizarCodigoComparacao("242101345R"));
  assert.equal(normalizarCodigoComparacao("2421 01345 R"), "242101345R");
  const v = variantesDeBusca("242101345R");
  assert.ok(v.includes("242101345R"));
});

test("tela: microfone usa a regra do código falado; campo digitado não; mostra o que o celular ouviu", () => {
  const f = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.ok(f.includes('lerCodigoDaFala(t, { falado: origem === "voz" })'));
  assert.ok(f.includes('onSalvar={(v) => { const c = lerCodigoDaFala(v); if (c.codigo)'), "campo digitado preserva o hífen");
  assert.ok(f.includes("data-pr-ouvido"));
  assert.ok(ler("src/modules/paiiaVoz/servicos/conversaVoz.js").includes('interpretarConversa(texto, ficha, { falado: opcoes.origem === "voz" })'));
});
