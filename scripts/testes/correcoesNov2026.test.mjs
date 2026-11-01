// (01/11/2026) Pendência de compatibilidade não exigível (Linha Pesada) e aviso do vínculo do Bling por loja.
import test from "node:test";
import assert from "node:assert/strict";
import { conferirPublicacao, compatibilidadeNaoExigivel } from "../../src/services/compatibilidadeML.js";
import { avisoVinculoBling, vinculoAutomaticoDaLoja, passosBlingAutomatico, passosBling, AVISO_VINCULO_MANUAL, AVISO_VINCULO_AUTOMATICO_SKU } from "../../src/services/vinculoBlingPublicacao.js";

const item = { id: "MLB9", attributes: [], pictures: [{}] };
const pendCompat = (v) => v.pendencias.filter((p) => /^Compatibilidades/.test(p));

test("Linha Pesada sem veículos no catálogo: sem pendência de compatibilidade", () => {
  const v = conferirPublicacao({ itemId: "MLB9", esperado: { tipoVeiculo: "Linha Pesada", compatibilidades: [], compatibilidadesAprovadas: 3 }, item, compat: { products: [] } });
  assert.deepEqual(pendCompat(v), []);
  assert.ok(v.itens.some((i) => i.item === "Compatibilidades" && i.ok && !i.obrigatorio));
});
test("tipo da ficha Linha Pesada quando a categoria não envia o atributo", () => {
  const v = conferirPublicacao({ itemId: "MLB9", esperado: { tipoVeiculo: "", tipoVeiculoFicha: "Linha Pesada", compatibilidades: [], compatibilidadesAprovadas: 1 }, item, compat: null });
  assert.deepEqual(pendCompat(v), []);
});
test("Carro/Caminhonete com aplicações e nenhum veículo enviado: pendência CONTINUA", () => {
  const v = conferirPublicacao({ itemId: "MLB9", esperado: { tipoVeiculo: "Carro/Caminhonete", compatibilidades: [], compatibilidadesAprovadas: 3 }, item, compat: { products: [] } });
  assert.equal(pendCompat(v).length, 1);
});
test("sem tipo informado e aplicações aprovadas: pendência CONTINUA", () => {
  const v = conferirPublicacao({ itemId: "MLB9", esperado: { compatibilidades: [], compatibilidadesAprovadas: 2 }, item, compat: { products: [] } });
  assert.equal(pendCompat(v).length, 1);
});
test("Linha Pesada COM veículos enviados e não aceitos: pendência CONTINUA", () => {
  const v = conferirPublicacao({ itemId: "MLB9", esperado: { tipoVeiculo: "Linha Pesada", compatibilidades: ["MLB1"], compatibilidadesAprovadas: 1 }, item, compat: { products: [] } });
  assert.equal(pendCompat(v).length, 1);
});
test("Carro/Caminhonete com veículos aceitos: sem pendência (como antes)", () => {
  const v = conferirPublicacao({ itemId: "MLB9", esperado: { tipoVeiculo: "Carro/Caminhonete", compatibilidades: ["MLB1"], compatibilidadesAprovadas: 1 }, item, compat: { products: [{ catalog_product_id: "MLB1" }] } });
  assert.deepEqual(pendCompat(v), []);
});
test("compatibilidadeNaoExigivel só para Linha Pesada", () => {
  assert.equal(compatibilidadeNaoExigivel("LINHA  PESADA"), true);
  assert.equal(compatibilidadeNaoExigivel("Carro/Caminhonete"), false);
  assert.equal(compatibilidadeNaoExigivel(""), false);
});
test("aviso do Bling: automático só na LojaOnlineSP; demais lojas continuam manuais", () => {
  assert.equal(vinculoAutomaticoDaLoja("204883484"), true);
  assert.equal(avisoVinculoBling("204883484"), AVISO_VINCULO_AUTOMATICO_SKU);
  assert.equal(vinculoAutomaticoDaLoja("999"), false);
  assert.equal(avisoVinculoBling("999"), AVISO_VINCULO_MANUAL);
  assert.equal(avisoVinculoBling(""), AVISO_VINCULO_MANUAL);
  assert.ok(/LojaOnlineSP/.test(AVISO_VINCULO_AUTOMATICO_SKU) && /sem criar produto/.test(AVISO_VINCULO_AUTOMATICO_SKU));
  assert.ok(passosBlingAutomatico({ sku: "856371-305" })[0].includes("856371-305"));
  assert.ok(passosBling({ lojaNome: "X" }).some((p) => /manualmente/.test(p)));
});
