// PAIIA Voz (12/11): fala natural organizada nos campos da aplicação; SKU fixo; aplicações na Categoria.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { lerAplicacaoFalada, valorDoCampoFalado, proximoCampoVeiculo } from "../../src/modules/paiiaVoz/servicos/aplicacaoFalada.js";
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("1) 'Fiat, Uno, motor 1.0, de 2010 a 2014.' vai para os 5 campos", () => {
  assert.deepEqual(lerAplicacaoFalada("Fiat, Uno, motor 1.0, de 2010 a 2014."), { montadora: "Fiat", modelo: "Uno", motor: "1.0", anoInicio: "2010", anoFim: "2014" });
  assert.deepEqual(lerAplicacaoFalada("Hyundai HB20 1.6 2015"), { montadora: "Hyundai", modelo: "HB20", motor: "1.6", anoInicio: "2015" }, "ano único não vira faixa");
});

test("2) 'Hyundai' sozinho entra em Montadora e o microfone passa para o próximo campo vazio", () => {
  assert.equal(valorDoCampoFalado("montadora", "Hyundai"), "Hyundai");
  assert.equal(proximoCampoVeiculo({ montadora: "Hyundai" }, "montadora"), "modelo");
  assert.equal(proximoCampoVeiculo({ montadora: "Fiat", modelo: "Uno", motor: "1.0", anoInicio: "2010", anoFim: "2014" }, "anoFim"), "");
  assert.equal(valorDoCampoFalado("anoInicio", "de 2010"), "2010");
});

test("3) tela: SKU fixo; Motor e Anos separados com 🎤; fala da compat vai aos campos e só confirma em 'Adicionar'", () => {
  const t = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.ok(t.includes("data-pv-sku-fixo") && t.includes('position: "sticky"'));
  for (const k of ["montadora", "modelo", "motor", "anoInicio", "anoFim"]) assert.ok(t.includes(`["${k}",`), k);
  assert.ok(t.includes("micCampo(`veic:${k}`") && t.includes("data-pv-veic-falar-tudo"));
  assert.ok(t.includes('if (rr.etapa === "compat" && campoVozRef.current !== "aplicacoes") {'), "a fala não vai mais para o campo escondido");
  const add = t.slice(t.indexOf("function adicionarVeiculoRapido()"), t.indexOf("// Resposta à pergunta do motor"));
  assert.ok(add.includes("confirmada: true") && add.includes("const anoFim = Number(mm[2] || fimTxt || mm[1]);"), "ano final só o informado");
  const c = ler("src/modules/paiiaVoz/CategoriaVoz.jsx");
  assert.ok(c.includes("data-pv-categoria-aplicacoes") && c.includes("o ano é da aplicação, não da categoria"));
});
