// Cruzamento entre contas (Regras do ML — Anúncios): funções puras, sem rede.
import test from "node:test";
import assert from "node:assert/strict";
const { cruzarContas, sinaisEntre, fichaCruzamento, riscoDoPar } = await import("../../src/services/regrasML/cruzamento.js");

const attr = (id, value_name) => ({ id, value_name });
const item = (id, seller, o = {}) => ({
  id, seller_id: Number(seller), title: o.title || "Sensor Rotação Bosch 0261210170", price: o.price ?? 100, status: "active",
  listing_type_id: o.tipo || "gold_special", shipping: { logistic_type: o.envio || "xd_drop_off", free_shipping: o.gratis ?? false },
  sold_quantity: o.vendidos ?? 0, available_quantity: 5, date_created: o.criado || "2025-01-01T00:00:00Z",
  seller_custom_field: o.sku ?? null, attributes: o.attrs || [], pictures: (o.fotos || []).map((id) => ({ id })),
});
const LOJA = { id: "1729335019", nome: "LOJA ONLINE" }, REV = { id: "2412238242", nome: "REVELAÇÃO" }, CIE = { id: "824312524", nome: "CIEBR" };

test("mesmo SKU em contas diferentes, mesmo envio, tipo e preço → risco ALTO; recomenda manter o que mais vendeu", () => {
  const r = cruzarContas({ contas: [LOJA, REV, CIE], anuncios: {
    [LOJA.id]: [item("MLB1", LOJA.id, { sku: "0261-210-170", vendidos: 12 })],
    [CIE.id]: [item("MLB2", CIE.id, { sku: "0261210170", price: 102, vendidos: 3 })],
  } });
  assert.equal(r.grupos_entre_contas, 1);
  const g = r.grupos[0];
  assert.deepEqual(g.contas, ["LOJA ONLINE", "CIEBR"]);
  assert.equal(g.risco, "alto");
  assert.equal(g.manter_sugerido, "MLB1");
  assert.equal(g.recomendacao.situacao, "pendente de autorização");
  assert.ok(g.sinais.includes("SKU igual"));
});

test("envio ou tipo de anúncio diferente → BAIXO (manter); só preço diferente → MÉDIO (melhorar)", () => {
  const base = { sku: "ABC123" };
  const baixo = cruzarContas({ contas: [LOJA, CIE], anuncios: { [LOJA.id]: [item("MLB1", LOJA.id, { ...base, tipo: "gold_pro" })], [CIE.id]: [item("MLB2", CIE.id, base)] } });
  assert.equal(baixo.grupos[0].risco, "baixo");
  assert.equal(baixo.grupos[0].recomendacao.acao, "manter");
  const medio = cruzarContas({ contas: [LOJA, CIE], anuncios: { [LOJA.id]: [item("MLB1", LOJA.id, { ...base, price: 100 })], [CIE.id]: [item("MLB2", CIE.id, { ...base, price: 130 })] } });
  assert.equal(medio.grupos[0].risco, "medio");
  assert.equal(medio.grupos[0].recomendacao.acao, "melhorar");
});

test("fotos iguais = clonagem (R5) → alto mesmo com envio diferente; mesma conta → alto e sugere encerrar", () => {
  const clon = cruzarContas({ contas: [LOJA, REV], anuncios: { [LOJA.id]: [item("MLB1", LOJA.id, { sku: "Z77Z", fotos: ["P1"], envio: "fulfillment" })], [REV.id]: [item("MLB2", REV.id, { sku: "Z77Z", fotos: ["P1"] })] } });
  assert.equal(clon.grupos[0].risco, "alto");
  assert.ok(clon.grupos[0].regras_risco.includes("R5"));
  const mesma = cruzarContas({ contas: [LOJA], anuncios: { [LOJA.id]: [item("MLB1", LOJA.id, { sku: "X999", price: 100 }), item("MLB2", LOJA.id, { sku: "x-999", price: 150 })] } });
  assert.equal(mesma.grupos[0].risco, "alto");
  assert.equal(mesma.grupos[0].mesma_conta, true);
  assert.equal(mesma.grupos[0].recomendacao.acao, "unificar (decisão sua)");
  // R1: na mesma conta com OUTRO envio (Full x coleta) é permitido → baixo, manter
  const full = cruzarContas({ contas: [CIE], anuncios: { [CIE.id]: [item("MLB1", CIE.id, { sku: "X999", envio: "fulfillment" }), item("MLB2", CIE.id, { sku: "X999" })] } });
  assert.equal(full.grupos[0].risco, "baixo");
  assert.equal(full.grupos[0].duplicado_na_conta, false);
});

test("não confunde: kit x unidade, OEM sem a mesma marca, nada em comum", () => {
  const f = (o, conta = LOJA) => fichaCruzamento(item("MLBx", conta.id, o), conta);
  assert.deepEqual(sinaisEntre(f({ sku: "BIP176" }), f({ sku: "BIP176", title: "Kit 4 Bicos Injetores" })), [], "kit e unidade são produtos diferentes");
  assert.deepEqual(sinaisEntre(f({ attrs: [attr("OEM", "55193766"), attr("BRAND", "Mopar")] }), f({ attrs: [attr("OEM", "55193766"), attr("BRAND", "Torken")] })), [], "OEM igual de marcas diferentes não é o mesmo produto");
  assert.ok(sinaisEntre(f({ attrs: [attr("OEM", "55193766"), attr("BRAND", "Mopar")] }), f({ attrs: [attr("OEM", "55-193-766"), attr("BRAND", "MOPAR")] })).includes("código OEM e marca iguais"));
  assert.ok(sinaisEntre(f({ attrs: [attr("GTIN", "7891234567895")] }), f({ attrs: [attr("GTIN", "7891234567895")] })).includes("GTIN igual"));
  const r = cruzarContas({ contas: [LOJA, CIE], anuncios: { [LOJA.id]: [item("MLB1", LOJA.id, { sku: "A1A1" })], [CIE.id]: [item("MLB2", CIE.id, { sku: "B2B2" })] } });
  assert.equal(r.grupos_total, 0);
  assert.equal(riscoDoPar(f({ price: 100 }), f({ price: 104 }, CIE), ["SKU igual"]).nivel, "alto");
});

test("casos reais de 12/11: \"Renault\" no campo OEM não é código; só foto igual não junta; \"4x\"/\"10 Presilhas\" contam unidades", async () => {
  const { unidadesAnunciadas } = await import("../../src/services/regrasML/cruzamento.js");
  const f = (o, conta = LOJA) => fichaCruzamento(item("MLBx", conta.id, o), conta);
  const renault = (sku) => f({ sku, attrs: [attr("BRAND", "Renault"), attr("OEM", "Renault")] });
  assert.deepEqual(sinaisEntre(renault("8200594925"), renault("769840007R")), [], "peças diferentes com OEM = Renault");
  assert.deepEqual(sinaisEntre(f({ sku: "CM11109", fotos: ["F1"] }), f({ sku: "CM11108", fotos: ["F1"] })), [], "bobina dianteira x traseira com a mesma foto");
  assert.equal(unidadesAnunciadas("4x Bobinas De Ignição Traseira Fit 1.4"), 4);
  assert.equal(unidadesAnunciadas("10 Presilhas Plasticas De Fixação Banco"), 10);
  assert.equal(unidadesAnunciadas("4 Bicos Injetores 16450plc003"), 4);
  assert.equal(unidadesAnunciadas("Jogo Sonda Lambda Cruze Pré E Pós"), "jogo");
  assert.equal(unidadesAnunciadas("Bico Injetor Fit 1.4 New Civic 6 Furos"), 1);
  const jogo = f({ title: "Sonda Lambda Cruze", attrs: [attr("BRAND", "Bosch"), attr("PART_NUMBER", "0258010210 / 0258010065")] });
  const pos = f({ title: "Sonda Lambda Cruze", attrs: [attr("BRAND", "Bosch"), attr("PART_NUMBER", "0258010065")] });
  assert.deepEqual(sinaisEntre(jogo, pos), [], "conjunto de códigos não é igual a um código só");
});

test("SKUs diferentes = produtos diferentes, mesmo com código de peça ou catálogo em comum; '2u' conta unidades", async () => {
  const { unidadesAnunciadas } = await import("../../src/services/regrasML/cruzamento.js");
  const f = (o, conta = LOJA) => fichaCruzamento(item("MLBx", conta.id, o), conta);
  const sup = f({ sku: "46784963", attrs: [attr("BRAND", "Fiat"), attr("PART_NUMBER", "46784963")] });
  const inf = f({ sku: "46784964", attrs: [attr("BRAND", "Fiat"), attr("PART_NUMBER", "46784963")] }, CIE);
  assert.deepEqual(sinaisEntre(sup, inf), [], "bucha superior x inferior");
  const semSku = f({ attrs: [attr("BRAND", "Fiat"), attr("PART_NUMBER", "46784963")] }, CIE);
  assert.ok(sinaisEntre(sup, semSku).includes("código da peça e marca iguais"), "sem SKU num deles, o código da peça decide");
  assert.equal(unidadesAnunciadas("Borracha Porta Traseira Logan - 8200617217 2u"), 2);
  assert.equal(unidadesAnunciadas("Acendedor De Cigarro Universal Completo 12v"), 1);
});

test("conferência detalhada: separa entre contas x mesma conta; nunca 'encerrar' só por vendas", async () => {
  const { separarDuplicidades, compararAplicacoes } = await import("../../src/services/regrasML/cruzamento.js");
  const PN = (v) => [attr("BRAND", "Bosch"), attr("PART_NUMBER", v)];
  const r = separarDuplicidades({
    contas: [LOJA, CIE],
    anuncios: {
      [LOJA.id]: [item("MLB1", LOJA.id, { sku: "H106845", attrs: PN("H106845"), vendidos: 0 })],
      [CIE.id]: [
        item("MLB2", CIE.id, { sku: "H106845", attrs: PN("H106845"), vendidos: 362 }),
        item("MLB3", CIE.id, { sku: "H106845", attrs: PN("H106845"), vendidos: 20 }),
        item("MLB4", CIE.id, { sku: "H106845", attrs: PN("H106845"), envio: "fulfillment", vendidos: 5 }),
      ],
    },
    compat: { MLB1: ["V1"], MLB2: ["V1", "V2"], MLB3: ["V1", "V2"], MLB4: ["V1", "V2"] },
  });
  assert.equal(r.resumo.entre_contas.total, 3);
  assert.equal(r.resumo.mesma_conta.total, 3);
  const dup = r.mesma_conta.find((p) => [p.a.id, p.b.id].sort().join() === "MLB2,MLB3");
  assert.equal(dup.nivel, "alto");
  assert.equal(dup.atencao, true);
  assert.doesNotMatch(dup.recomendacao, /^Encerrar/);
  const full = r.mesma_conta.find((p) => [p.a.id, p.b.id].includes("MLB4"));
  assert.equal(full.nivel, "permitido", "envio diferente na mesma conta é permitido (R1)");
  for (const p of r.entre_contas) assert.doesNotMatch(p.recomendacao, /encerrar o|^Encerrar/i);
  assert.equal(compararAplicacoes(["V1"], ["V1", "V2"]).situacao, "contidas");
  assert.equal(compararAplicacoes(["V1"], ["V9"]).situacao, "diferentes");
  assert.equal(compararAplicacoes(null, ["V9"]).situacao, "nao_lidas");
});

test("mesmo código mas aplicações diferentes → 'conferir', não duplicidade", async () => {
  const { conferirPar, classificarPar, fichaCruzamento: fc } = await import("../../src/services/regrasML/cruzamento.js");
  const a = fc(item("MLB1", LOJA.id, { sku: "X1X1" }), LOJA), b = fc(item("MLB2", LOJA.id, { sku: "X1X1" }), LOJA);
  const c = conferirPar(a, b, { MLB1: ["V1"], MLB2: ["V7"] });
  assert.equal(c.identidade_confirmada, false);
  assert.equal(classificarPar(c, true).nivel, "conferir");
});

test("relatório entre contas: uma linha por produto; mesmo produto em contas diferentes NÃO é proibido por si só", async () => {
  const { relatorioEntreContas } = await import("../../src/services/regrasML/cruzamento.js");
  const r = relatorioEntreContas({
    contas: [LOJA, REV, CIE],
    anuncios: {
      [LOJA.id]: [item("MLB1", LOJA.id, { sku: "P1P1", price: 100 }), item("MLB4", LOJA.id, { sku: "Q2Q2", tipo: "gold_pro" }), item("MLB6", LOJA.id, { sku: "R3R3", fotos: ["F9"], envio: "fulfillment" })],
      [REV.id]: [item("MLB2", REV.id, { sku: "P1P1", price: 101 })],
      [CIE.id]: [item("MLB3", CIE.id, { sku: "P1P1", price: 102 }), item("MLB5", CIE.id, { sku: "Q2Q2" }), item("MLB7", CIE.id, { sku: "R3R3", fotos: ["F9"] })],
    },
  });
  assert.equal(r.resumo.produtos, 3, "a mesma peça em 3 contas conta uma vez");
  const p1 = r.linhas.find((l) => l.sku === "P1P1");
  assert.equal(p1.situacao, "atencao");
  assert.equal(p1.pares, 3);
  assert.match(p1.recomendacao, /Nenhuma regra oficial proíbe/);
  assert.match(p1.recomendacao, /Não encerrar sem resposta oficial/);
  assert.equal(r.linhas.find((l) => l.sku === "Q2Q2").situacao, "permitido", "tipo diferente entre contas = permitido (R1)");
  const r3 = r.linhas.find((l) => l.sku === "R3R3");
  assert.equal(r3.situacao, "atencao", "fotos copiadas entre contas (R5) mesmo com envio diferente");
  assert.equal(r3.regras, "R5");
});
