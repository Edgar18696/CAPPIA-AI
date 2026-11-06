// =============================================================
// (06/11/2026) Publicação ML — botão “Validar dados no Mercado Livre”:
// bloqueado nunca fica mudo; “Validando...” desde o 1º instante; erro na tela.
//   node --test scripts/testes/publicacaoBotaoValidar.test.mjs
// Só leitura do código (o comportamento foi conferido no navegador simulado).
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const rev = fs.readFileSync(new URL("../../src/components/RevisaoPublicacaoML.jsx", import.meta.url), "utf8");

test("validar: ocupado antes de qualquer leitura e erro sempre mostrado", () => {
  const ini = rev.indexOf("async function validarNoML() {");
  const corpo = rev.slice(ini, rev.indexOf("async function validarNoMLEtapas", ini));
  assert.ok(corpo.indexOf('setOcupado("validar")') < corpo.indexOf("validarNoMLEtapas()"), "“Validando...” antes da conferência");
  assert.match(corpo, /catch \(e\) \{\s*setValidacao\(\{ ok: false, erro: `Validação interrompida/);
  const etapas = rev.slice(rev.indexOf("async function validarNoMLEtapas"), rev.indexOf("// INTEGRAÇÃO COM A GESTÃO"));
  const rec = etapas.slice(etapas.indexOf("if (!cat.ok) {"), etapas.indexOf("return;", etapas.indexOf("if (!cat.ok) {")));
  assert.ok(rec.includes('setOcupado("")'), "categoria recusada libera o botão");
  // a validação em si não mudou: ficha relida, duplicidade, validar_item
  assert.match(etapas, /reconferirFichaPersistida\(\)/); assert.match(etapas, /conferirDuplicidadeML\(contaEscolhida\)/); assert.match(etapas, /chamar\("validar_item"/);
});

test("botão bloqueado: cinza e com motivo (categoria, atributos obrigatórios, operação em andamento, quantidade/Bling)", () => {
  const b = rev.slice(rev.indexOf("const motivoBotao ="), rev.indexOf("data-paiia-motivo-sem-validar") + 200);
  for (const t of ["Falta a categoria do Mercado Livre", "Preencha os atributos obrigatórios da categoria", "faltandoSemValor.map((a) => a.nome || a.id)", "motivoSemValidar", "Aguarde:"]) assert.ok(b.includes(t), t);
  assert.match(b, /disabled=\{bloqueado\}/);
  assert.match(b, /opacity: 0\.5, cursor: "not-allowed"/);
  assert.match(b, /data-paiia-validando/);
});
