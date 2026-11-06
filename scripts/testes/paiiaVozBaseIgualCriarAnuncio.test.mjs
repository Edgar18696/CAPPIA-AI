// (13/11) PAIIA Voz usa a MESMA busca do Criar Anúncio; aplicações da base entram a conferir; SKU fixo.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { consultarBaseVoz } from "../../src/modules/paiiaVoz/servicos/consultaBaseVoz.js";
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const iwp211 = async (args) => {
  assert.deepEqual(args, { codigo: "IWP211", oem: "", permitirBuscaInternet: false }, "mesma chamada do Criar Anúncio, sem internet");
  return { pecaEncontrada: { descricao: "Bico Injetor Ka Flex 1.0", codigos_equivalentes: ["0280158169", "IWP211"] },
    baseMestre: { aplicacoes: [{ montadora: "Ford", modelo: "Ka", motor: "1.0 8V Flex", ano_inicio: "2008", ano_fim: "2013" }, { montadora: "Ford", modelo: "Ka", motor: "1.0 8V Flex", ano_inicio: "2008", ano_fim: "2013" }, { montadora: "Ford", modelo: "Fiesta", tipo_referencia: "nota_tecnica" }] } };
};

test("1) IWP211: não está na base validada nem no catálogo simples, mas a busca do Criar Anúncio encontra", async () => {
  const r = await consultarBaseVoz("IWP211", { buscarValidado: async () => [], pesquisarCatalogo: async () => [], preencherAutomatico: iwp211 });
  assert.equal(r.encontrado, true);
  assert.equal(r.descricao, "Bico Injetor Ka Flex 1.0");
  assert.deepEqual(r.codigos, ["0280158169"], "o próprio SKU não vira adicional");
  assert.equal(r.aplicacoes.length, 1, "sem duplicar; nota técnica fora");
  assert.deepEqual([r.aplicacoes[0].montadora, r.aplicacoes[0].modelos[0], r.aplicacoes[0].motores[0], r.aplicacoes[0].anoInicio, r.aplicacoes[0].anoFim], ["Ford", "Ka", "1.0 8V Flex", 2008, 2013], "anos exatamente os da base");
});

test("2) a base validada continua tendo prioridade (a busca do Criar Anúncio só roda se ela não achar)", async () => {
  let chamou = false;
  const r = await consultarBaseVoz("X1", { buscarValidado: async () => [{ modelo: "Uno", montadora: "Fiat" }], preencherAutomatico: async () => { chamou = true; return {}; } });
  assert.equal(r.origem, "base_validada");
  assert.equal(chamou, false);
});

test("3) tela: digitação com microfone ligado; fala posterior não troca o SKU principal; base aproveitada sozinha (a conferir)", () => {
  const t = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.ok(t.includes('ditando={ouvindo && campoVoz !== "codigoAdicional" && parcial ? parcial : ""}'));
  assert.ok(t.includes("principalAtual && principalAtual !== c.codigo && !/\\b(troc|corrig|mud|substitu)\\w*/i.test(t)"));
  assert.ok(t.includes("const inc = incorporarResultadoBase(f, res);") && t.includes("preencherAutomatico: preencherBase"));
});
