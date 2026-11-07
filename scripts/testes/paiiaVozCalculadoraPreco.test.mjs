// (16/11) Calculadora de preço: lógica financeira, arredondamento, voz e persistência na ficha.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { analisarVenda, calcularPrecoVenda, valorFaladoCalculadora, valoresIniciaisCalculadora } from "../../src/modules/paiiaVoz/servicos/calculadoraPreco.js";
import { lerPreco } from "../../src/modules/paiiaVoz/servicos/numerosFalados.js";
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("1) exemplo obrigatório: venda 58,19; custo/recompra 30; comissão 17%; impostos 8%; frete 1; despesas 1 → sobra 11,64", () => {
  const r = analisarVenda({ venda: "58,19", custo: "30", comissao: "17", impostos: "8", frete: "1", despesas: "1" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.partes, { comissao: 9.89, impostos: 4.66, frete: 1, despesas: 1, recompra: 30 });
  assert.equal(r.sobra, 11.64);
  assert.equal(r.margemSobreVenda, 20, "margem sobre a VENDA");
  assert.equal(r.acrescimoSobreCusto, 93.97, "acréscimo sobre o CUSTO (diferente da margem)");
});

test("2) preço sugerido para margem de 20% sobre a venda com os mesmos valores = R$ 58,19 (arredonda para cima no centavo)", () => {
  assert.equal(calcularPrecoVenda({ custo: 30, frete: 1, despesas: 1, comissao: 17, impostos: 8, margem: 20 }).preco, 58.19);
  assert.equal(calcularPrecoVenda({ custo: 10, comissao: 0, impostos: 0, margem: 0 }).preco, 10);
});

test("3) arredondamento em centavos: cada parte como aparece na tela; a sobra fecha a conta", () => {
  const r = analisarVenda({ venda: "10,05", custo: "5", comissao: "12,5", impostos: "0" });
  assert.equal(r.partes.comissao, 1.26, "1,25625 → 1,26");
  assert.equal(r.sobra, 3.79);
  const s = r.partes.comissao + r.partes.impostos + r.partes.frete + r.partes.despesas + r.partes.recompra + r.sobra;
  assert.equal(Math.round(s * 100) / 100, r.venda);
  assert.equal(analisarVenda({ venda: "50", custo: "" }).ok, false, "sem custo não calcula (nada presumido)");
});

test("4) voz: 'trinta reais', 'dezessete por cento', 'um real', 'cinquenta e oito reais e dezenove centavos'", () => {
  assert.equal(valorFaladoCalculadora("custo", "trinta reais", lerPreco), "30");
  assert.equal(valorFaladoCalculadora("comissao", "dezessete por cento", lerPreco), "17");
  assert.equal(valorFaladoCalculadora("frete", "um real", lerPreco), "1");
  assert.equal(valorFaladoCalculadora("venda", "cinquenta e oito reais e dezenove centavos", lerPreco), "58,19");
  assert.equal(valorFaladoCalculadora("impostos", "8%", lerPreco), "8");
  assert.equal(valorFaladoCalculadora("comissao", "cento e vinte por cento", lerPreco), null, "porcentagem impossível recusada");
});

test("5) estimativas sinalizadas: comissão e margem de referência marcadas; frete e impostos NUNCA presumidos", () => {
  const v = valoresIniciaisCalculadora({}, "classico");
  assert.equal(v.comissao.origem, "estimativa");
  assert.equal(v.margem.origem, "estimativa");
  assert.equal(v.frete, undefined);
  assert.equal(v.impostos, undefined);
  assert.equal(valoresIniciaisCalculadora({ comissao: { valor: "17", origem: "voz" } }).comissao.valor, "17", "valor informado é preservado");
});

test("6) tela: valores guardados NA FICHA (voltam ao avançar/voltar); 'Usar' é o único caminho para o Preço do anúncio; não é lucro contábil", () => {
  const t = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.ok(t.includes("f.calculadoraPreco = {") && t.includes("valores={valoresIniciaisCalculadora(ficha.calculadoraPreco || {}"));
  assert.ok(t.includes('if (String(campoVozRef.current || "").startsWith("calc:")) {'));
  const c = ler("src/modules/paiiaVoz/CalculadoraPrecoVoz.jsx");
  assert.ok(c.includes("não é lucro líquido contábil") && c.includes("data-pv-calc-usar") && c.includes("Acréscimo sobre o custo") && c.includes("minmax(min(100%, max(165px, 45%)), 1fr)"));
});
