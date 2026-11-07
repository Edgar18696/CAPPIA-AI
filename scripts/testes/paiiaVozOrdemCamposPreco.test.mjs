// =============================================================
// PAIIA Voz — ETAPA DE PREÇO: ordem dos campos, sem custo duplicado,
// "Usar Preço Sugerido" (sem rede, sem banco, dados fictícios).
//   node --test scripts/testes/paiiaVozOrdemCamposPreco.test.mjs
// Ordem obrigatória: 1) Calculadora de Preço de Venda, 2) Preço de Venda (R$),
// 3) Marca, 4) Estoque. "Custo da Mercadoria (R$)" só dentro da calculadora,
// e o valor continua salvo na ficha.
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);

const C = await import("../../src/modules/paiiaVoz/servicos/completarVoz.js");
const F = await import("../../src/modules/paiiaVoz/servicos/fichaVoz.js");
const P = await import("../../src/modules/paiiaVoz/servicos/calculadoraPreco.js");
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const blocoPreco = () => {
  const t = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  const i = t.indexOf('data-pr-bloco="preco"');
  const fim = t.indexOf("</section>", i);
  assert.ok(i > 0 && fim > i, "etapa de preço encontrada");
  return t.slice(i, fim);
};

test("ordem exata: Calculadora → Preço de Venda (R$) → Marca → Estoque", () => {
  const campos = C.camposDaEtapa("preco");
  assert.deepEqual(campos.map((c) => c.id), ["preco", "marca", "quantidade"]);
  assert.deepEqual(campos.map((c) => c.rotulo), ["Preço de Venda (R$)", "Marca", "Estoque (quantidade a anunciar)"]);
  const b = blocoPreco();
  const calc = b.indexOf("<CalculadoraPrecoVoz");
  const campos2 = b.indexOf('camposDaEtapa("preco")');
  assert.ok(calc > 0 && campos2 > 0, "calculadora e campos na etapa");
  assert.ok(calc < campos2, "a calculadora vem antes do Preço de Venda, da Marca e do Estoque");
  assert.equal((b.match(/<CalculadoraPrecoVoz/g) || []).length, 1, "uma só calculadora");
});

test("sem o campo duplicado “Custo (R$) — opcional” fora da calculadora", () => {
  assert.ok(!C.camposDaEtapa("preco").some((c) => c.id === "custo"), "custo não é campo da etapa");
  assert.ok(!C.CAMPOS_DIRETOS.some((c) => c.rotulo === "Custo (R$)"), "rótulo antigo removido");
  for (const etapa of ["fotos", "codigo", "descricao", "preco", "envio", "compat", "categoria", "finalizar"]) {
    assert.ok(!C.camposDaEtapa(etapa).some((c) => c.id === "custo"), `custo não aparece na etapa ${etapa}`);
  }
  const calc = ler("src/modules/paiiaVoz/CalculadoraPrecoVoz.jsx");
  assert.ok(calc.includes('["custo", "Custo da Mercadoria", "R$"'), "Custo da Mercadoria (R$) continua na calculadora");
});

test("Custo da Mercadoria digitado na calculadora fica salvo na ficha (calculadora e dados da peça)", () => {
  let f = F.criarFichaVoz({ id: "custo", agora: 1 });
  f = C.definirValorCalculadora(f, "custo", "18,50");
  assert.equal(f.calculadoraPreco.custo.valor, "18,50");
  assert.equal(C.valoresCamposDiretos(f).custo, "18,50", "o mesmo custo segue para a ficha (nuvem/Bling)");
  f = C.definirValorCalculadora(f, "margem", "25");
  assert.equal(C.valoresCamposDiretos(f).custo, "18,50", "mudar outro campo não perde o custo");
  f = C.definirValorCalculadora(f, "custo", "");
  assert.equal(C.valoresCamposDiretos(f).custo, "", "apagar na calculadora apaga na ficha (sem valor fantasma)");
});

test("valores já preenchidos não se perdem: custo antigo (ou do Bling) aparece na calculadora", () => {
  let f = F.criarFichaVoz({ id: "antiga", agora: 1 });
  for (const [c, v] of [["marca", "Torken"], ["preco", "39,90"], ["quantidade", "10"], ["custo", "12,50"]]) f = C.definirCampoDireto(f, c, v).ficha;
  const v = C.valoresCamposDiretos(f);
  assert.deepEqual([v.preco, v.marca, v.quantidade, v.custo], ["39,90", "Torken", "10", "12,50"]);
  assert.equal(C.valoresCalculadoraDaFicha(f).custo.valor, "12,50", "custo da ficha antiga no Custo da Mercadoria");
  f = C.definirValorCalculadora(f, "frete", "5");
  assert.equal(f.calculadoraPreco.custo.valor, "12,50", "fica gravado na calculadora ao mexer em outro campo");
  assert.deepEqual(["preco", "marca", "quantidade"].map((k) => C.valoresCamposDiretos(f)[k]), ["39,90", "Torken", "10"]);
});

test("Usar Preço Sugerido preenche o Preço de Venda; o usuário pode digitar outro", () => {
  const plano = { custo: "30", frete: "1", despesas: "1", comissao: "17", impostos: "8", margem: "20" };
  const usar = P.precoParaUsar(plano);
  assert.deepEqual(usar, { preco: 58.19, sugerido: true, texto: "58,19" });
  let f = F.criarFichaVoz({ id: "sug", agora: 1 });
  f = C.definirCampoDireto(f, "preco", usar.texto, { origem: "digitado" }).ficha;
  assert.equal(C.valoresCamposDiretos(f).preco, "58,19", "Preço de Venda preenchido com o sugerido");
  f = C.definirCampoDireto(f, "preco", "62,00", { origem: "digitado" }).ficha;
  assert.equal(C.valoresCamposDiretos(f).preco, "62,00", "preço manual substitui o sugerido");
  assert.deepEqual(P.precoParaUsar({ ...plano, venda: "60" }), { preco: 60, sugerido: false, texto: "60,00" }, "preço para conferir informado: usa o informado");
  assert.equal(P.precoParaUsar({ custo: "" }), null, "sem custo não há sugestão");

  const calc = ler("src/modules/paiiaVoz/CalculadoraPrecoVoz.jsx");
  assert.ok(calc.includes("Usar Preço Sugerido"), "botão “Usar Preço Sugerido”");
  assert.ok(/aoUsarPreco\?\.\(usar\.texto\)/.test(calc), "o botão envia o preço ao campo Preço de Venda");
  assert.ok(/aoUsarPreco=\{\(v\) => \{ const r2 = definirCampoDireto\(fichaRef\.current, "preco", v/.test(blocoPreco()), "grava no Preço de Venda da ficha");
});
