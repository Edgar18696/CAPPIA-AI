// Rodada 1: PAIIA Voz com 8 etapas — etapa 7 "Categoria".
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ETAPAS, ROTULOS_ETAPAS } from "../../src/modules/paiiaVoz/servicos/rascunhoRapido.js";
import { estadoEtapasVoz } from "../../src/modules/paiiaVoz/servicos/completarVoz.js";
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("1) 8 etapas, Categoria antes de Finalizar", () => {
  assert.deepEqual(ETAPAS.slice(-3), ["compat", "categoria", "finalizar"]);
  assert.equal(ROTULOS_ETAPAS.categoria, "Categoria");
});

test("2) a etapa Categoria só fica feita com a categoria confirmada pelo servidor", () => {
  assert.equal(estadoEtapasVoz({ categoriaVoz: { ok: true, id: "MLB1" } }, { ordem: ETAPAS }).categoria, "ok");
  assert.notEqual(estadoEtapasVoz({ categoriaVoz: { ok: false } }, { ordem: ETAPAS }).categoria, "ok");
  assert.notEqual(estadoEtapasVoz({}, { ordem: ETAPAS }).categoria, "ok");
});

test("3) tela: caminho completo selecionado, 'Alterar categoria', sugestão com confirmação e busca quando há dúvida", () => {
  const c = ler("src/modules/paiiaVoz/CategoriaVoz.jsx");
  for (const x of ["data-pv-categoria-caminho", "data-pv-alterar-categoria", "data-pv-categoria-confirmar", "<PainelCategoriaML", "Selecionada automaticamente"]) assert.ok(c.includes(x), x);
  assert.ok(!/publicar|bling_criar|executarFinalizacao/.test(c), "a etapa 7 não publica nem mexe no Bling");
  const s = ler("src/modules/paiiaVoz/servicos/preparoVozService.js");
  assert.ok(s.includes("categoria: item }, categoria: { decisao } }"), "grava só a categoria, no mesmo registro reaproveitado na etapa 8");
});
