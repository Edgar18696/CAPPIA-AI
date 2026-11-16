// =============================================================
// PAIIA — TESTES (15/11/2026): Black Friday 2026 na Central do Paizinho (FASE 1).
// ML e Bling FALSOS (sem rede). Garante: classificação Renault/Demais/Revisão,
// descontos não cumulativos, margem sem custo inventado, situação, filtros,
// isolamento por conta, SOMENTE GET, aprovação idempotente e por usuário,
// calendário obrigatório e que o Ranqueamento não foi tocado.
//   node --test scripts/testes/blackFriday.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const R = await import("../../src/services/blackFriday/regras.js");
const L = await import("../../src/services/blackFriday/leitura.js");
const G = await import("../../src/services/blackFriday/registro.js");
const C = await import("../../src/services/blackFriday/calendario.js");

const LOJA = "1729335019";
const REV = "2412238242";
const CIEBR = "824312524";
const PERFIL = { impostoPct: 6, custoPedido: 0 };

const item = (x = {}) => ({
  id: "MLB1", seller_id: Number(LOJA), title: "Sensor Rotação Bosch 0261210170", price: 200, status: "active",
  listing_type_id: "gold_special", category_id: "MLB1", available_quantity: 3, seller_custom_field: "SKU1",
  shipping: { free_shipping: true, logistic_type: "xd_drop_off" },
  attributes: [{ id: "BRAND", value_name: "Bosch" }, { id: "PART_NUMBER", value_name: "0261210170" }],
  ...x,
});
const compat = (marcas, extra = {}) => ({ lido: true, quantidade: marcas.length, marcas, legivel: true, ...extra });
const promoOk = { lido: true, ativas: [], candidatas: [] };
const custoOk = (c) => ({ ok: true, encontrado: true, custo: { fornecedores: [{ padrao: true, precoCusto: c }] }, formato: "S" });
const leituraAnuncio = (x = {}) => ({
  conta: LOJA, item: item(), compat: compat([]), promocoes: promoOk,
  tarifaFinal: { valor: 22 }, freteAtual: { ok: true, custo_vendedor: 20 }, freteFinal: { ok: true, custo_vendedor: 20 }, custo: custoOk(80), ...x,
});

/* ------------------------------ calendário ------------------------------ */

test("calendário obrigatório: 27/11 00:00 a 30/11 23:59 (Brasília) e conferência em 01/12", () => {
  assert.equal(C.CAMPANHA_BF.inicio, "2026-11-27T00:00:00-03:00");
  assert.equal(C.CAMPANHA_BF.fim, "2026-11-30T23:59:00-03:00");
  assert.ok(C.CAMPANHA_BF.conferencias.every((d) => d.startsWith("2026-12-01")));
  assert.equal(C.dataHoraBrasilia(C.CAMPANHA_BF.fim), "30/11/2026 23:59");
  assert.equal(C.momentoDaCampanha("2026-11-15T12:00:00Z"), "preparacao");
  assert.equal(C.momentoDaCampanha("2026-11-27T03:00:00Z"), "em_andamento", "00:00 em Brasília = 03:00 UTC");
  assert.equal(C.momentoDaCampanha("2026-12-01T02:58:00Z"), "em_andamento", "30/11 23:58 Brasília");
  assert.equal(C.momentoDaCampanha("2026-12-01T03:00:00Z"), "encerrada");
  assert.equal(C.diasParaInicio("2026-11-15T12:00:00Z"), 12);
});

/* ---------------------------- classificação ---------------------------- */

test("Renault comprovada: marca Renault (original) → 10%", () => {
  const c = R.classificarRenault(item({ attributes: [{ id: "BRAND", value_name: "Renault" }] }), compat([]));
  assert.equal(c.classe, "renault");
  assert.match(c.evidencias[0], /Marca da peça: Renault/);
  assert.equal(R.descontoDaClasse(c.classe), 10);
});

test("Renault comprovada: paralela com compatibilidade Renault no ML → 10%", () => {
  const c = R.classificarRenault(item(), compat(["renault"]));
  assert.equal(c.classe, "renault");
  assert.match(c.evidencias[0], /Compatibilidade ML: Renault$/);
});

test("Renault junto com outras montadoras → 10% (Renault)", () => {
  const c = R.classificarRenault(item(), compat(["volkswagen", "renault", "fiat"]));
  assert.equal(c.classe, "renault");
  assert.match(c.evidencias[0], /Renault e outras montadoras \(2\)/);
});

test("Renault duvidosa vai para REVISÃO: só no título, código no padrão Renault, compat sem marca", () => {
  const titulo = R.classificarRenault(item({ title: "Sensor Rotação Sandero Logan 1.6" }), compat(["volkswagen"]));
  assert.equal(titulo.classe, "revisao");
  assert.match(titulo.duvida, /"sandero" aparece no título/);
  const codigo = R.classificarRenault(item({ attributes: [{ id: "BRAND", value_name: "MTE" }, { id: "OEM", value_name: "8200 561 276" }] }), compat([]));
  assert.equal(codigo.classe, "revisao");
  assert.match(codigo.duvida, /8200561276 no padrão de numeração Renault/);
  const ilegivel = R.classificarRenault(item(), compat(["?"], { legivel: false, quantidade: 4 }));
  assert.equal(ilegivel.classe, "revisao");
  assert.equal(R.descontoDaClasse("revisao"), 10, "revisão simula no pior caso para a margem");
});

test("Demais → 5%; 'master' (cilindro mestre) não vira Renault", () => {
  assert.equal(R.classificarRenault(item(), compat(["volkswagen", "fiat"])).classe, "demais");
  assert.equal(R.classificarRenault(item({ title: "Cilindro Mestre Freio Master Gol" }), compat([])).classe, "demais");
  assert.equal(R.descontoDaClasse("demais"), 5);
  const semCompat = R.classificarRenault(item(), { lido: false, marcas: [] });
  assert.equal(semCompat.classe, "demais");
  assert.match(semCompat.evidencias[0], /não lidas/);
});

test("decisão manual da revisão prevalece (Renault 10% ou Demais 5%)", () => {
  const i = item({ title: "Sensor Clio 1.0" });
  assert.equal(R.classificarRenault(i, compat([]), "renault").classe, "renault");
  assert.equal(R.classificarRenault(i, compat([]), "demais").classe, "demais");
  assert.equal(R.classificarRenault(i, compat([]), "demais").manual, true);
});

test("marcas da compatibilidade: lê BRAND dos produtos; 404 = sem compatibilidade; falha = não lido", () => {
  const r = R.marcasDaCompatibilidade({ ok: true, dados: { products: [{ attributes: [{ id: "BRAND", value_name: "Renault" }] }, { attributes: [{ id: "BRAND", value_name: "Nissan" }] }] } });
  assert.deepEqual(r.marcas.sort(), ["nissan", "renault"]);
  assert.equal(r.legivel, true);
  assert.deepEqual(R.marcasDaCompatibilidade({ ok: false, status: 404 }), { lido: true, quantidade: 0, marcas: [], legivel: true });
  assert.equal(R.marcasDaCompatibilidade({ ok: false, status: 500 }).lido, false);
  assert.equal(R.marcasDaCompatibilidade({ ok: true, dados: { products: [{ catalog_product_id: "X" }] } }).legivel, false);
});

/* ------------------------------ simulação ------------------------------ */

test("simulação: preço final, margem com tarifa, frete, imposto e custo do Bling", () => {
  const l = R.simularAnuncio(leituraAnuncio(), { perfil: PERFIL });
  assert.equal(l.classe, "demais");
  assert.equal(l.desconto_pct, 5);
  assert.equal(l.preco_original, 200);
  assert.equal(l.preco_final, 190);
  // 190 − 22 tarifa − 20 frete − 11,40 imposto − 80 custo = 56,60
  assert.equal(l.lucro, 56.6);
  assert.equal(l.margem_pct, 29.8);
  assert.equal(l.situacao, "apto");
  assert.equal(l.chave, `black-friday-2026:${LOJA}:MLB1`);
});

test("Renault comprovada: 10% e mesmo cálculo de margem", () => {
  const l = R.simularAnuncio(leituraAnuncio({ compat: compat(["renault"]) }), { perfil: PERFIL });
  assert.equal(l.preco_final, 180);
  assert.equal(l.desconto_pct, 10);
});

test("NÃO cumulativo: anúncio já em promoção (ativa ou programada) vai para revisão, sem somar descontos", () => {
  for (const status of ["started", "pending"]) {
    const l = R.simularAnuncio(leituraAnuncio({ promocoes: { lido: true, ativas: [{ tipo: "DEAL", status }], candidatas: [] } }), { perfil: PERFIL });
    assert.equal(l.situacao, "revisao");
    assert.equal(l.preco_final, 190, "o desconto é sempre sobre o preço original, nunca somado");
    assert.ok(l.motivos.some((m) => /não são cumulativos/.test(m)));
  }
  const ja = R.simularAnuncio(leituraAnuncio({ item: item({ original_price: 250 }) }), { perfil: PERFIL });
  assert.equal(ja.situacao, "revisao");
});

test("promoções não lidas → revisão (não presume que o anúncio aceita desconto)", () => {
  const l = R.simularAnuncio(leituraAnuncio({ promocoes: { lido: false, ativas: [], candidatas: [], erro: "fora da lista permitida" } }), { perfil: PERFIL });
  assert.equal(l.situacao, "revisao");
  assert.match(l.motivos.join(" "), /Promoção não verificada \(fora da lista permitida\)/);
  assert.equal(l.promocao, "nao_verificada");
});

/* --------------------- (15/11) pacote de correções --------------------- */

const RENAULT_LOTE = { item: item({ attributes: [{ id: "BRAND", value_name: "Renault" }] }), custo: { ok: true, encontrado: false } };

test("Renault de lote sem custo: mantém 10%, mostra 'Custo não informado' e vai para Atenção (nunca libera sozinha)", () => {
  const l = R.simularAnuncio(leituraAnuncio(RENAULT_LOTE), { perfil: PERFIL });
  assert.equal(l.classe, "renault");
  assert.equal(l.desconto_pct, 10);
  assert.equal(l.preco_final, 180);
  assert.equal(l.custo, null);
  assert.equal(l.lucro, null, "lucro não é inventado");
  assert.equal(l.margem_pct, null);
  // 180 − 22 tarifa − 20 frete − 10,80 imposto = 127,20 de sobra (70,7%)
  assert.equal(l.repasse, 127.2);
  assert.equal(l.repasse_pct, 70.7);
  assert.equal(l.situacao, "atencao");
  assert.match(l.alertas[0], /^Custo não informado — margem não verificável/);
  assert.equal(R.podeAprovar(l), true);
  // Aprovação de Atenção exige a confirmação extra.
  const reg = G.criarRegistroBF({ storage: memoria(), usuarioId: "u1" });
  assert.equal(reg.aprovar([l]).aprovados.length, 0);
  assert.equal(reg.aprovar([l], { confirmarAtencao: true }).aprovados.length, 1);
});

test("Renault de lote sem custo com RISCO (despesas > 40% do preço final) ou despesas desconhecidas → revisão", () => {
  const caro = R.simularAnuncio(leituraAnuncio({ ...RENAULT_LOTE, item: item({ price: 60, attributes: [{ id: "BRAND", value_name: "Renault" }] }), tarifaFinal: { valor: 12 }, freteAtual: { ok: true, custo_vendedor: 15 }, freteFinal: { ok: true, custo_vendedor: 15 } }), { perfil: PERFIL });
  assert.equal(caro.situacao, "revisao");
  assert.match(caro.motivos.join(" "), /RISCO: tarifa, frete e impostos já consomem/);
  const semImposto = R.simularAnuncio(leituraAnuncio(RENAULT_LOTE), { perfil: { impostoPct: null, custoPedido: 0 } });
  assert.equal(semImposto.situacao, "revisao");
  assert.match(semImposto.motivos.join(" "), /risco não avaliado/);
  const semTarifa = R.simularAnuncio(leituraAnuncio({ ...RENAULT_LOTE, tarifaFinal: null }), { perfil: PERFIL });
  assert.equal(semTarifa.situacao, "revisao");
});

test("produto que não é Renault sem custo continua em revisão", () => {
  const l = R.simularAnuncio(leituraAnuncio({ custo: { ok: true, encontrado: false } }), { perfil: PERFIL });
  assert.equal(l.classe, "demais");
  assert.equal(l.situacao, "revisao");
});

test("promoções: preço de venda (sale_price) acusa promoção ativa → conflito; sem desconto agora → ainda 'não verificada'", () => {
  const naoLida = { lido: false, ativas: [], candidatas: [], erro: "fora da lista permitida" };
  const ativa = R.lerPrecoVenda({ ok: true, dados: { amount: 170, regular_amount: 200, metadata: { promotion_id: "P9", promotion_type: "DEAL" } } });
  assert.deepEqual([ativa.lido, ativa.ativa, ativa.tipo], [true, true, "DEAL"]);
  const c = R.simularAnuncio(leituraAnuncio({ promocoes: naoLida, precoVenda: ativa }), { perfil: PERFIL });
  assert.equal(c.promocao, "conflito");
  assert.equal(c.promocoes_ativas[0].id, "P9");
  assert.match(c.motivos.join(" "), /descontos não são cumulativos/);
  const semDesc = R.lerPrecoVenda({ ok: true, dados: { amount: 200, regular_amount: null } });
  assert.equal(semDesc.ativa, false);
  const n = R.simularAnuncio(leituraAnuncio({ promocoes: naoLida, precoVenda: semDesc }), { perfil: PERFIL });
  assert.equal(n.promocao, "nao_verificada", "falha na leitura nunca vira 'sem promoção'");
  assert.match(n.motivos.join(" "), /programadas não puderam ser conferidas/);
  assert.equal(R.lerPrecoVenda({ ok: false, erro: "x" }).lido, false);
  assert.equal(R.simularAnuncio(leituraAnuncio(), { perfil: PERFIL }).promocao, "sem_promocao");
});

test("Renault pelo catálogo do ML: compatibilidade sem marca → marca lida em /products/{id} (com memória)", async () => {
  const itens = [item({ id: "MLB1", title: "Sensor Sandero" }), item({ id: "MLB2", title: "Bobina" })];
  const chamadas = [];
  const consultar = async (c) => {
    chamadas.push(c);
    if (c.startsWith(`/users/${LOJA}/items/search`)) return { ok: true, dados: { results: ["MLB1", "MLB2"] } };
    const det = c.match(/^\/items\/(MLB\d+)$/);
    if (det) return { ok: true, dados: itens.find((x) => x.id === det[1]) };
    if (c === "/items/MLB1/compatibilities") return { ok: true, dados: { products: [{ catalog_product_id: "V1" }, { catalog_product_id: "V2" }] } };
    if (c === "/items/MLB2/compatibilities") return { ok: true, dados: { products: [{ catalog_product_id: "V2" }, { catalog_product_id: "V3" }] } };
    if (c === "/products/V1") return { ok: true, dados: { name: "Renault Sandero 1.6 2012" } };
    if (c === "/products/V2") return { ok: true, dados: { attributes: [{ id: "BRAND", value_name: "Nissan" }] } };
    if (c === "/products/V3") return { ok: false, erro: "fora da lista permitida" };
    if (c.startsWith("/seller-promotions/")) return { ok: true, dados: [] };
    if (c.includes("shipping_options")) return { ok: true, dados: { coverage: { all_country: { list_cost: 20, billable_weight: 300 } } } };
    if (c.startsWith("/sites/MLB/listing_prices")) return { ok: true, dados: [{ sale_fee_amount: 22 }] };
    return { ok: false, erro: "?" };
  };
  const r = await L.lerContaBF({ conta: LOJA, consultar, limite: 10 });
  const porId = Object.fromEntries(r.itens.map((x) => [x.item.id, x]));
  assert.deepEqual(porId.MLB1.compat.marcas.sort(), ["nissan", "renault"]);
  assert.equal(R.classificarRenault(porId.MLB1.item, porId.MLB1.compat).classe, "renault", "Renault + outras montadoras = 10%");
  const c2 = R.classificarRenault(porId.MLB2.item, porId.MLB2.compat);
  assert.equal(c2.classe, "revisao", "veículo sem marca conferida: não deduz");
  assert.match(c2.duvida, /Conferidos 1 de 2 veículos/);
  assert.equal(chamadas.filter((c) => c === "/products/V2").length, 1, "memória por veículo");
});

test("adaptador: endereço recusado pela lista permitida não é repetido; motivo real do corpo do erro", async () => {
  let n = 0;
  const invocar = async (_nome, { body }) => { n++; return body.caminho.startsWith("/seller-promotions") ? { data: { ok: false, erro: "Caminho fora da lista permitida" } } : { data: null, error: { message: "Edge Function returned a non-2xx status code", context: { status: 401, json: async () => ({ erro: "Token da conta vencido" }) } } }; };
  const consultar = L.consultorBF(LOJA, invocar, { esperar: async () => {} });
  const a = await consultar("/seller-promotions/items/MLB1?app_version=v2");
  const b = await consultar("/seller-promotions/items/MLB2?app_version=v2");
  assert.equal(a.ok, false);
  assert.equal(b.recusado, true);
  assert.equal(n, 1, "a 2ª recusa não chama o servidor de novo");
  const e = await consultar("/items/MLB1");
  assert.equal(e.erro, "Token da conta vencido");
  assert.equal(e.status, 401);
});

test("diagnóstico de um anúncio: só GET, mostra resposta real ou erro de cada leitura", async () => {
  const caminhos = [];
  const consultar = async (c) => { caminhos.push(c); if (c.endsWith("/compatibilities")) return { ok: true, dados: { products: [{ catalog_product_id: "V1" }] } }; if (c === "/products/V1") return { ok: true, dados: { name: "Renault Logan" } }; if (c.startsWith("/seller-promotions")) return { ok: false, erro: "fora da lista permitida" }; return { ok: true, dados: { id: "MLB1", price: 10 } }; };
  const d = await L.diagnosticarAnuncio({ conta: LOJA, itemId: "mlb-1", consultar });
  assert.ok(d.some((x) => x.etapa.startsWith("Promoções") && !x.ok && /lista permitida/.test(x.erro)));
  assert.match(d.find((x) => x.etapa.startsWith("Marca")).resumo, /marca: renault/);
  assert.ok(caminhos.every((c) => c.startsWith("/")));
  await assert.rejects(() => L.diagnosticarAnuncio({ conta: LOJA, itemId: "abc", consultar }), /MLB/);
  await assert.rejects(() => L.diagnosticarAnuncio({ conta: "1", itemId: "MLB1", consultar }), /3 contas/);
});

test("falhas agrupadas por etapa e motivos mais comuns", () => {
  const g = L.agruparFalhas([{ conta: "CIEBR", etapa: "promoções", erro: "fora da lista" }, { conta: "CIEBR", etapa: "promoções", erro: "fora da lista" }, { conta: "CIEBR", etapa: "frete", erro: "x" }]);
  assert.deepEqual(g[0], { conta: "CIEBR", etapa: "promoções", quantidade: 2, erros: [{ erro: "fora da lista", n: 2 }] });
  const m = R.contarMotivos([R.simularAnuncio(leituraAnuncio({ promocoes: { lido: false, ativas: [] } }), { perfil: PERFIL }), R.simularAnuncio(leituraAnuncio({ promocoes: { lido: false, ativas: [] } }), { perfil: PERFIL })]);
  assert.equal(m[0].quantidade, 2);
  assert.match(m[0].motivo, /^Promoção não verificada/);
});

test("lerPromocoes: separa ativas/programadas de candidatas; formato estranho = não lido", () => {
  const p = R.lerPromocoes({ ok: true, dados: [{ id: "P1", type: "DEAL", status: "started", price: 90 }, { id: "C1", type: "SELLER_CAMPAIGN", status: "candidate" }, { type: "LIGHTNING", status: "finished" }] });
  assert.equal(p.lido, true);
  assert.deepEqual(p.ativas.map((x) => x.id), ["P1"]);
  assert.deepEqual(p.candidatas.map((x) => x.tipo), ["SELLER_CAMPAIGN"]);
  assert.equal(R.lerPromocoes({ ok: true, dados: { x: 1 } }).lido, false);
  assert.equal(R.lerPromocoes({ ok: false, erro: "x" }).lido, false);
  const l = R.simularAnuncio(leituraAnuncio({ promocoes: p }), { perfil: PERFIL });
  assert.deepEqual(l.promocoes_ativas.map((x) => x.id), ["P1"]);
});

test("prejuízo → revisão (não pode ser aprovado)", () => {
  const l = R.simularAnuncio(leituraAnuncio({ custo: custoOk(170) }), { perfil: PERFIL });
  assert.ok(l.lucro < 0);
  assert.equal(l.situacao, "revisao");
  assert.match(l.motivos.join(" "), /PREJUÍZO/);
  assert.equal(R.podeAprovar(l), false);
});

test("margem baixa (acima de zero) → atenção; aprovável com confirmação", () => {
  const l = R.simularAnuncio(leituraAnuncio({ custo: custoOk(130) }), { perfil: PERFIL });
  assert.ok(l.lucro >= 0 && l.margem_pct < 10);
  assert.equal(l.situacao, "atencao");
  assert.equal(R.podeAprovar(l), true);
});

test("custo nunca inventado: sem custo, custo a confirmar, Renault de lote → margem não verificável (revisão)", () => {
  const semCusto = R.simularAnuncio(leituraAnuncio({ custo: { ok: true, encontrado: true, custo: { fornecedores: [] } } }), { perfil: PERFIL });
  assert.equal(semCusto.custo, null);
  assert.equal(semCusto.margem_pct, null);
  assert.equal(semCusto.situacao, "revisao");
  const naoLido = R.simularAnuncio(leituraAnuncio({ custo: undefined }), { perfil: PERFIL });
  assert.match(naoLido.motivos.join(" "), /custo não lido no Bling/);
  assert.match(naoLido.motivos.join(" "), /^Custo não informado — margem não verificável/);
  const aConfirmar = R.simularAnuncio(leituraAnuncio({ custo: { ok: true, encontrado: true, custo: { fornecedores: [{ padrao: true, precoCusto: 50 }, { padrao: false, precoCusto: 90 }] } } }), { perfil: PERFIL });
  assert.equal(aConfirmar.custo, null);
  assert.match(aConfirmar.motivos.join(" "), /custo a confirmar/);
});

test("imposto não cadastrado, tarifa não lida ou frete não confirmado → margem não verificável", () => {
  assert.match(R.simularAnuncio(leituraAnuncio(), { perfil: { impostoPct: null, custoPedido: 0 } }).motivos.join(" "), /Imposto não cadastrado/);
  assert.match(R.simularAnuncio(leituraAnuncio({ tarifaFinal: null }), { perfil: PERFIL }).motivos.join(" "), /Tarifa de venda/);
  // 85 → 80,75 (mesma faixa 79–99,99): usa a cotação atual
  const mesma = R.simularAnuncio(leituraAnuncio({ item: item({ price: 85 }), custo: custoOk(30), freteFinal: null }), { perfil: PERFIL });
  assert.equal(mesma.frete, 20);
  // 82 → 77,90 (outra faixa) sem cotação no preço final: não confirmado
  const outra = R.simularAnuncio(leituraAnuncio({ item: item({ price: 82 }), custo: custoOk(30), freteFinal: null }), { perfil: PERFIL });
  assert.equal(outra.frete, null);
  assert.equal(outra.situacao, "revisao");
  assert.ok(outra.alertas.some((a) => /abaixo de R\$ 79/.test(a)));
  const cotado = R.simularAnuncio(leituraAnuncio({ item: item({ price: 82 }), custo: custoOk(30), freteFinal: { ok: true, custo_vendedor: 0 } }), { perfil: PERFIL });
  assert.equal(cotado.frete, 0);
  assert.equal(cotado.frete_origem, "cotação ML no preço final");
  const semGratis = R.simularAnuncio(leituraAnuncio({ item: item({ shipping: { free_shipping: false } }), freteAtual: null }), { perfil: PERFIL });
  assert.equal(semGratis.frete, 0);
});

test("bloqueado: anúncio pausado, de outra conta ou sem preço; excluído pelo usuário", () => {
  assert.equal(R.simularAnuncio(leituraAnuncio({ item: item({ status: "paused" }) }), { perfil: PERFIL }).situacao, "bloqueado");
  assert.equal(R.simularAnuncio(leituraAnuncio({ item: item({ seller_id: 999 }) }), { perfil: PERFIL }).situacao, "bloqueado");
  assert.equal(R.simularAnuncio(leituraAnuncio({ item: item({ price: 0 }) }), { perfil: PERFIL }).situacao, "bloqueado");
  assert.equal(R.simularAnuncio(leituraAnuncio(), { perfil: PERFIL, decisao: "excluir" }).situacao, "excluido");
});

test("filtros e resumo", () => {
  const linhas = [
    R.simularAnuncio(leituraAnuncio(), { perfil: PERFIL }),
    R.simularAnuncio(leituraAnuncio({ conta: REV, item: item({ id: "MLB2", seller_id: Number(REV), title: "Bobina Logan" }) }), { perfil: PERFIL }),
    R.simularAnuncio(leituraAnuncio({ conta: CIEBR, item: item({ id: "MLB3", seller_id: Number(CIEBR) }), compat: compat(["renault"]), custo: custoOk(130) }), { perfil: PERFIL }),
  ];
  assert.equal(R.filtrarLinhas(linhas, { classe: "revisao" }).length, 1);
  assert.equal(R.filtrarLinhas(linhas, { contas: [CIEBR] })[0].id, "MLB3");
  assert.equal(R.filtrarLinhas(linhas, { margemAbaixo: "10" }).length, 1);
  assert.equal(R.filtrarLinhas(linhas, { soAlertas: true }).length, 2);
  assert.equal(R.filtrarLinhas(linhas, { busca: "mlb2" }).length, 1);
  assert.equal(R.filtrarLinhas(linhas, { busca: "bobina" }).length, 1);
  const r = R.resumirSimulacao(linhas);
  assert.equal(r.total, 3);
  assert.equal(r.renault, 1);
  assert.equal(r.demais, 1);
  assert.equal(r.revisao, 1);
  assert.deepEqual(r.por_conta, { "LOJA ONLINE": 1, "REVELAÇÃO": 1, CIEBR: 1 });
});

/* ------------------------------- leitura ------------------------------- */

function mlFalso(conta, itens) {
  const chamadas = [];
  const consultar = async (c) => {
    chamadas.push(c);
    if (c.startsWith(`/users/${conta}/items/search`)) return { ok: true, dados: { paging: { total: itens.length }, results: itens.map((i) => i.id), scroll_id: c.includes("scroll_id") ? "" : "s1" } };
    const det = c.match(/^\/items\/(MLB\d+)$/);
    if (det) { const i = itens.find((x) => x.id === det[1]); return i ? { ok: true, dados: i } : { ok: false, status: 404 }; }
    if (/\/compatibilities$/.test(c)) {
      const id = c.split("/")[2];
      return id === "MLB2" ? { ok: true, dados: { products: [{ attributes: [{ id: "BRAND", value_name: "Renault" }] }] } } : { ok: false, status: 404 };
    }
    if (c.startsWith("/seller-promotions/items/")) return { ok: true, dados: [] };
    if (c.includes("shipping_options/free?item_id=")) return { ok: true, dados: { coverage: { all_country: { list_cost: 20, billable_weight: 300 } } } };
    if (c.startsWith("/sites/MLB/listing_prices")) return { ok: true, dados: [{ sale_fee_amount: 22 }] };
    return { ok: false, erro: "não previsto" };
  };
  return { consultar, chamadas };
}

test("leitura: só a conta pedida; anúncio de outro vendedor é descartado; tarifa lida no preço final", async () => {
  const itens = [item({ id: "MLB1" }), item({ id: "MLB2", title: "Bobina" }), item({ id: "MLB9", seller_id: 111 })];
  const ml = mlFalso(LOJA, itens);
  const r = await L.lerContaBF({ conta: LOJA, consultar: ml.consultar, limite: 10, agora: () => "2026-11-15T12:00:00Z" });
  assert.deepEqual(r.itens.map((x) => x.item.id), ["MLB1", "MLB2"]);
  assert.equal(r.descartados_outra_conta, 1);
  assert.ok(r.tarifas["190.00|gold_special|MLB1"], "tarifa no preço final de Demais (5%)");
  assert.ok(r.tarifas["180.00|gold_special|MLB1"], "tarifa no preço final de Renault (10%)");
  assert.ok(ml.chamadas.every((c) => c.startsWith("/")), "só caminhos de leitura");
  await assert.rejects(() => L.lerContaBF({ conta: "123", consultar: ml.consultar }), /não faz parte da Black Friday/);
});

test("leitura de várias contas: falha numa conta não para as outras; custo lido no Bling por SKU", async () => {
  const mlLoja = mlFalso(LOJA, [item({ id: "MLB1", price: 180 })]);
  const mlCiebr = mlFalso(CIEBR, [item({ id: "MLB5", price: 180, seller_id: Number(CIEBR), seller_custom_field: "SKU5" })]);
  const lidosBling = [];
  const r = await L.lerContasBF({
    contas: [LOJA, REV, CIEBR], limite: 10,
    consultorDaConta: (id) => (id === LOJA ? mlLoja.consultar : id === CIEBR ? mlCiebr.consultar : async () => { throw new Error("conta desconectada"); }),
    consultarCusto: async (sku) => { lidosBling.push(sku); return custoOk(80); },
    agora: () => "2026-11-15T12:00:00Z",
  });
  assert.deepEqual(Object.keys(r.contas).sort(), [CIEBR, LOJA].sort());
  assert.ok(r.falhas.some((f) => f.conta === "REVELAÇÃO"));
  assert.deepEqual(lidosBling.sort(), ["SKU1", "SKU5"]);
  const linhas = L.montarSimulacao(r, { perfil: PERFIL });
  assert.equal(linhas.length, 2);
  assert.ok(linhas.every((l) => l.situacao === "apto"), JSON.stringify(linhas.map((l) => l.motivos)));
  await assert.rejects(() => L.lerContasBF({ contas: [], consultorDaConta: () => null }), /pelo menos uma conta/);
});

test("adaptador: ml_consulta SEMPRE com metodo GET, na conta pedida; nova tentativa no limite do ML", async () => {
  const corpos = [];
  let n = 0;
  const invocar = async (nome, { body }) => { corpos.push({ nome, ...body }); return ++n === 1 ? { data: { ok: false, status: 429, erro: "too many requests" } } : { data: { ok: true, dados: { id: "MLB1" } } }; };
  const r = await L.consultorBF(LOJA, invocar, { esperar: async () => {} })("/items/MLB1");
  assert.equal(r.ok, true);
  assert.equal(corpos.length, 2);
  assert.ok(corpos.every((b) => b.nome === "mercadolivre-publicacao" && b.acao === "ml_consulta" && b.metodo === "GET" && b.conta_ml === LOJA));
  assert.equal((await L.consultorBF(LOJA, invocar)("items")).ok, false, "caminho inválido recusado");
  const bling = [];
  await L.consultorCustoBF(async (nome, { body }) => { bling.push({ nome, ...body }); return { data: { ok: true, custo: { fornecedores: [] } } }; })("SKU1");
  assert.deepEqual(bling, [{ nome: "bling-integracao", acao: "custo_por_sku", sku: "SKU1" }]);
});

test("código da Black Friday não escreve em lugar nenhum (sem POST/PUT/DELETE, sem estoque, sem tabelas)", () => {
  for (const f of ["src/services/blackFriday/regras.js", "src/services/blackFriday/leitura.js", "src/services/blackFriday/registro.js", "src/services/blackFriday/calendario.js", "src/components/BlackFridayPaizinho.jsx"]) {
    const src = fs.readFileSync(path.join(RAIZ, f), "utf8");
    assert.doesNotMatch(src, /metodo:\s*"(POST|PUT|DELETE|PATCH)"|method:\s*"(POST|PUT|DELETE|PATCH)"/i, `${f}: só leitura`);
    assert.doesNotMatch(src, /supabase\s*\.from\(|\.insert\(|\.upsert\(/, `${f}: não grava no banco`);
    assert.doesNotMatch(src, /atualizar_estoque|alterar_estoque|estoque_bling|\bacao:\s*"(?!ml_consulta|custo_por_sku)/, `${f}: só ml_consulta e custo_por_sku`);
  }
  const tela = fs.readFileSync(path.join(RAIZ, "src/components/BlackFridayPaizinho.jsx"), "utf8");
  assert.match(tela, /Ativar ofertas aprovadas<\/button>/);
  assert.match(tela, /disabled title="Liberado só na Fase 3/, "ativação bloqueada na Fase 1");
});

/* ------------------------- aprovação e histórico ------------------------- */

function memoria() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), mapa: m };
}

test("aprovação: só Pronto/Atenção; Atenção pede confirmação; idempotente; guarda preço original", () => {
  const st = memoria();
  const reg = G.criarRegistroBF({ storage: st, usuarioId: "u1", agora: () => "2026-11-15T12:00:00Z" });
  const apto = R.simularAnuncio(leituraAnuncio(), { perfil: PERFIL });
  const atencao = R.simularAnuncio(leituraAnuncio({ item: item({ id: "MLB2" }), custo: custoOk(130) }), { perfil: PERFIL });
  const revisao = R.simularAnuncio(leituraAnuncio({ item: item({ id: "MLB3" }), custo: custoOk(170) }), { perfil: PERFIL });
  const r1 = reg.aprovar([apto, atencao, revisao], { modo: "lote" });
  assert.deepEqual(r1.aprovados, [apto.chave]);
  assert.deepEqual(r1.recusados.map((x) => x.motivo), ["alerta não confirmado", "situação: revisao"]);
  const r2 = reg.aprovar([apto, atencao], { modo: "lote", confirmarAtencao: true });
  assert.deepEqual(r2.ja_aprovados, [apto.chave], "não duplica");
  assert.deepEqual(r2.aprovados, [atencao.chave]);
  const plano = reg.lerPlano();
  assert.equal(Object.keys(plano.aprovados).length, 2);
  assert.equal(plano.aprovados[apto.chave].preco_original, 200);
  assert.equal(plano.aprovados[apto.chave].preco_final, 190);
  assert.equal(plano.aprovados[apto.chave].fim, "2026-11-30T23:59:00-03:00");
  assert.equal(plano.aprovados[apto.chave].aprovado_por, "u1");
  assert.ok(reg.historico().filter((h) => h.tipo === "aprovacao").length === 2);
});

test("preço mudou depois da aprovação → aprovação desatualizada sai do plano (nunca usa preço antigo)", () => {
  const reg = G.criarRegistroBF({ storage: memoria(), usuarioId: "u1" });
  const apto = R.simularAnuncio(leituraAnuncio(), { perfil: PERFIL });
  reg.aprovar([apto]);
  const novo = R.simularAnuncio(leituraAnuncio({ item: item({ price: 210 }) }), { perfil: PERFIL });
  const { desatualizadas, plano } = reg.conferirAprovacoes([novo]);
  assert.equal(desatualizadas.length, 1);
  assert.equal(Object.keys(plano.aprovados).length, 0);
  assert.equal(reg.historico()[0].tipo, "aprovacao_desatualizada");
});

test("decisão da revisão é por usuário e desfaz aprovação anterior; sem login não funciona", () => {
  const st = memoria();
  const a = G.criarRegistroBF({ storage: st, usuarioId: "u1" });
  const b = G.criarRegistroBF({ storage: st, usuarioId: "u2" });
  const apto = R.simularAnuncio(leituraAnuncio(), { perfil: PERFIL });
  a.aprovar([apto]);
  a.decidir(LOJA, "MLB1", "excluir");
  assert.equal(a.lerPlano().decisoes[`${LOJA}:MLB1`], "excluir");
  assert.equal(Object.keys(a.lerPlano().aprovados).length, 0);
  assert.deepEqual(b.lerPlano().decisoes, {}, "outro usuário não vê o plano");
  assert.equal(b.historico().length, 0);
  a.decidir(LOJA, "MLB1", null);
  assert.deepEqual(a.lerPlano().decisoes, {});
  assert.throws(() => G.criarRegistroBF({ storage: st, usuarioId: "" }), /só funciona com login/);
});

test("montarSimulacao aplica a decisão manual (revisão → Demais 5%)", () => {
  const leitura = { contas: { [LOJA]: { conta: LOJA, itens: [{ item: item({ title: "Sensor Clio" }), compat: compat([]), promocoes: promoOk }], tarifas: { "190.00|gold_special|MLB1": { valor: 22 }, "180.00|gold_special|MLB1": { valor: 21 } }, fretes: { "MLB1|atual": { ok: true, custo_vendedor: 20 }, "MLB1|190.00": { ok: true, custo_vendedor: 19 } } } }, custos: { SKU1: custoOk(80) } };
  const [antes] = L.montarSimulacao(leitura, { perfil: PERFIL });
  assert.equal(antes.classe, "revisao");
  assert.equal(antes.preco_final, 180);
  const [depois] = L.montarSimulacao(leitura, { perfil: PERFIL, decisoes: { [`${LOJA}:MLB1`]: "demais" } });
  assert.equal(depois.classe, "demais");
  assert.equal(depois.preco_final, 190);
  assert.equal(depois.tarifa, 22);
  assert.equal(depois.situacao, "apto");
});

/* ------------------------------ isolamento ------------------------------ */

test("Central: aba Black Friday montada à parte; Ranqueamento e Regras intactos; contas de auditoria não mudam", async () => {
  const src = fs.readFileSync(path.join(RAIZ, "src/components/CentralPaizinho.jsx"), "utf8");
  assert.match(src, /import BlackFridayPaizinho from "\.\/BlackFridayPaizinho"/);
  assert.match(src, /blackFridayAberta && <div style=\{\{ display: painel === "blackfriday"/);
  assert.match(src, /<RelatorioManhaPaizinho \/>/);
  const { CONTAS_AUDITORIA } = await import("../../src/services/paizinhoAuditoria/contas.js");
  assert.deepEqual(CONTAS_AUDITORIA.map((c) => c.id), [LOJA], "o piloto do Ranqueamento continua só na LOJA ONLINE");
  const tela = fs.readFileSync(path.join(RAIZ, "src/components/BlackFridayPaizinho.jsx"), "utf8");
  assert.doesNotMatch(tela, /paiiaPaizinhoRelatorioTeste|paiiaRegrasMLLeitura|paiiaPaizinhoBlingCache/, "não usa as chaves do Ranqueamento/Regras");
  assert.deepEqual(R.CONTAS_BLACK_FRIDAY.map((c) => c.id), [LOJA, CIEBR, REV], "ordem de trabalho (16/11): LOJA ONLINE → CIEBR → REVELAÇÃO");
});

/* ------------- (15/11) recusa "At least one policy returned UNAUTHORIZED" ------------- */

test("UNAUTHORIZED do ML: explicado como recusa de permissão e não repetido na mesma leitura", async () => {
  assert.match(L.explicarErro("At least one policy returned UNAUTHORIZED."), /PERMISSÃO do Mercado Livre/);
  assert.match(L.explicarErro("Caminho fora da lista permitida"), /servidor do PAIIA/);
  assert.equal(L.explicarErro("qualquer outra coisa"), "");
  let n = 0;
  const invocar = async () => { n++; return { data: { ok: false, status: 403, erro: "At least one policy returned UNAUTHORIZED." } }; };
  const consultar = L.consultorBF(REV, invocar, { esperar: async () => {} });
  await consultar("/seller-promotions/items/MLB1?app_version=v2");
  const b = await consultar("/seller-promotions/items/MLB2?app_version=v2");
  assert.equal(n, 1);
  assert.equal(b.recusado, true);
  assert.equal(b.ok, false, "recusa continua sendo falha (nunca 'sem promoção')");
});

test("comparar as 3 contas: mesmo teste num anúncio de cada conta mostra quem recusa o quê", async () => {
  const leitura = { contas: { [LOJA]: { itens: [{ item: { id: "MLB1" } }] }, [REV]: { itens: [{ item: { id: "MLB2" } }] } } };
  const consultorDaConta = (conta) => async (c) => (conta === REV && c.startsWith("/seller-promotions") ? { ok: false, status: 403, erro: "At least one policy returned UNAUTHORIZED." } : { ok: true, dados: [] });
  const m = await L.diagnosticarContas({ leitura, consultorDaConta });
  const rev = m.contas.find((c) => c.nome === "REVELAÇÃO");
  const loja = m.contas.find((c) => c.nome === "LOJA ONLINE");
  assert.equal(rev.resultados.find((r) => r.etapa === "Promoções (seller-promotions)").ok, false);
  assert.equal(loja.resultados.find((r) => r.etapa === "Promoções (seller-promotions)").ok, true);
  assert.deepEqual(m.contas.find((c) => c.nome === "CIEBR"), { nome: "CIEBR", item: null, resultados: [] });
  assert.ok(m.etapas.includes("Preço de venda (sale_price)"));
});

/* -------- (15/11) função própria de leitura: paizinho-bf-leitura (preparada) -------- */

const P = await import("../../src/services/blackFriday/leituraPermitida.js");

test("leituras permitidas da Black Friday: só promoções (anúncio e própria conta) e catálogo, só nas 3 contas", () => {
  assert.deepEqual(P.conferirLeituraBF("/seller-promotions/items/MLB123?app_version=v2", REV), { ok: true, tipo: "promocoes_anuncio", anuncio: "MLB123" });
  assert.equal(P.conferirLeituraBF(`/seller-promotions/users/${REV}?app_version=v2`, REV).ok, true);
  assert.equal(P.conferirLeituraBF(`/seller-promotions/users/${LOJA}?app_version=v2`, REV).ok, false, "promoções de outra conta");
  assert.equal(P.conferirLeituraBF("/products/MLB18500844", CIEBR).ok, true);
  assert.equal(P.conferirLeituraBF("/products/MLB1", "123").ok, false, "conta fora da campanha");
  for (const c of ["/items/MLB1", "/orders/search?seller=1", "/seller-promotions/items/MLB1", "/seller-promotions/items/MLB1?app_version=v2&x=1", "/products/MLB1/../users/me", "/seller-promotions/promotions/P1/items?app_version=v2"]) {
    assert.equal(P.conferirLeituraBF(c, LOJA).ok, false, c);
  }
  assert.equal(P.anuncioEhDaConta({ seller_id: 2412238242 }, REV), true);
  assert.equal(P.anuncioEhDaConta({ seller_id: 1 }, REV), false);
  assert.deepEqual(P.detalheRecusaML(403, { message: "At least one policy returned UNAUTHORIZED.", error: "forbidden", status: 403, cause: [] }), { status: 403, mensagem: "At least one policy returned UNAUTHORIZED.", codigo: "forbidden", causa: [] });
});

test("roteador: promoções/catálogo pela função própria; sem ela publicada (404) volta para a ml_consulta", async () => {
  const usados = [];
  const principal = async (c) => { usados.push(["ml_consulta", c]); return { ok: false, erro: "fora da lista permitida" }; };
  const semFuncao = P.consultorLeituraBF(LOJA, async () => ({ error: { message: "x", context: { status: 404 } } }));
  const rota = P.roteadorBF({ principal, bf: semFuncao });
  await rota("/products/MLB9");
  await rota("/items/MLB1");
  assert.deepEqual(usados.map((u) => u[1]), ["/products/MLB9", "/items/MLB1"]);
  const corpos = [];
  const comFuncao = P.consultorLeituraBF(LOJA, async (nome, { body }) => { corpos.push({ nome, ...body }); return { data: { ok: true, dados: [] } }; });
  const r = await P.roteadorBF({ principal, bf: comFuncao })("/seller-promotions/items/MLB1?app_version=v2");
  assert.equal(r.via, "paizinho-bf-leitura");
  assert.deepEqual(corpos, [{ nome: "paizinho-bf-leitura", conta: LOJA, caminho: "/seller-promotions/items/MLB1?app_version=v2" }]);
});


// (16/11) Caminho B: a ÚNICA exceção (POST no /oauth/token do ML e uso do segredo
// do aplicativo) fica isolada no bloco "aplicativo_dono"; o resto da função segue só GET.
const fonteBF = () => fs.readFileSync(path.join(RAIZ, "supabase/functions/paizinho-bf-leitura/index.ts"), "utf8");
const blocoB = (src) => src.slice(src.indexOf('if (conf.tipo === "aplicativo_dono") {'), src.indexOf("// 5) (15/11)"));
const semBlocoB = (src) => src.replace(blocoB(src), "");

test("função paizinho-bf-leitura: só GET, confere usuário, conta do usuário e dono do anúncio; não grava nada", () => {
  const src = semBlocoB(fonteBF());
  assert.match(src, /conferirLeituraBF\(caminho, conta\)/);
  const b = blocoB(fonteBF());
  assert.equal((b.match(/method: "POST"/g) || []).length, 1, "caminho B: um único POST");
  assert.match(b, /fetch\(`\$\{ML\}\/oauth\/token`, \{\s*method: "POST"/, "e só no /oauth/token");
  assert.doesNotMatch(b, /\.from\(|\.insert\(|\.update\(|refresh_token|json\(\{[^}]*access_token/, "caminho B não grava nem devolve acesso");
  assert.match(src, /sb\.auth\.getUser\(jwt\)/);
  assert.match(src, /\.eq\("usuario_id", usuarioId\)\.eq\("marketplace", "mercado_livre"\)\.eq\("ml_user_id", conta\)/);
  assert.match(src, /anuncioEhDaConta\(dono\.dados, conta\)/);
  assert.doesNotMatch(src, /method: "(POST|PUT|DELETE|PATCH)"/);
  assert.doesNotMatch(src, /\.insert\(|\.update\(|\.upsert\(|\.delete\(|refresh_token/);
  assert.doesNotMatch(src, /access_token[^)]*json\(/, "nunca devolve o token");
});

test("diagnóstico de escopos: só a própria conta, só resumos seguros (sem chave, segredo ou id completo)", () => {
  assert.equal(P.conferirLeituraBF(`/users/${REV}/applications`, REV).ok, true);
  assert.equal(P.conferirLeituraBF(`/users/${LOJA}/applications`, REV).ok, false);
  assert.equal(P.conferirLeituraBF("/applications/paiia", CIEBR).ok, true);
  assert.equal(P.conferirLeituraBF("/applications/123456", CIEBR).ok, false, "id real nunca vem do navegador");
  const app = P.resumirAplicativo({ id: 1234567890, name: "PAIIA", secret_key: "S", redirect_uri: "https://x", scopes: ["read", "write", "offline_access"], owner_id: 9, functional_permissions: ["items"] });
  assert.deepEqual(app, { name: "PAIIA", scopes: ["read", "write", "offline_access"], functional_permissions: ["items"], id: "…7890" });
  const aut = P.resumirAutorizacoes([{ app_id: "111", scopes: ["read"] }, { app_id: "1234567890", scopes: ["read", "write"], date_created: "2026-05-01" }], "1234567890");
  assert.deepEqual(aut, { autorizacoes_na_conta: 2, paiia: { app_id: "…7890", scopes: ["read", "write"], data: "2026-05-01", campos: ["app_id", "scopes", "date_created"] } });
  assert.equal(P.resumirAutorizacoes([], "1").paiia, null);
  const src = semBlocoB(fonteBF());
  assert.match(src, /resumirAplicativo\(r\.dados\)/);
  assert.match(src, /resumirAutorizacoes\(r\.dados, appId\)/);
  assert.doesNotMatch(src, /ML_CLIENT_SECRET/);
});

test("conclusão de permissões por conta: escopos completos + 403 → falta permissão funcional de promoções no aplicativo", () => {
  const res = (etapa, ok, extra = {}) => ({ etapa, ok, ...extra });
  const aut = (scopes) => res("Autorização desta conta ao PAIIA (escopos)", true, { resumo: JSON.stringify({ autorizacoes_na_conta: 1, paiia: { app_id: "…7890", scopes } }) });
  const p403 = [res("Promoções (seller-promotions)", false, { status: 403, erro: "At least one policy returned UNAUTHORIZED." }), res("Promoções da conta", false, { status: 403, erro: "At least one policy returned UNAUTHORIZED." })];
  const m = { contas: [
    { nome: "LOJA ONLINE", item: "MLB1", resultados: [aut(["offline_access", "read", "write"]), ...p403, res("Cadastro do aplicativo PAIIA (permissões)", true, { resumo: "{}" })] },
    { nome: "REVELAÇÃO", item: "MLB2", resultados: [aut(["read", "offline_access"]), ...p403] },
    { nome: "CIEBR", item: null, resultados: [] },
  ] };
  const [loja, rev, ciebr] = L.concluirPermissoes(m);
  assert.deepEqual(loja.escopos, ["offline_access", "read", "write"]);
  assert.match(loja.falta, /^permissão funcional de promoções no aplicativo PAIIA$/);
  assert.match(loja.procedimento, /painel de desenvolvedores do ML.*reconectar/);
  assert.equal(loja.promocoes_anuncio, "HTTP 403");
  assert.match(rev.falta, /escopo write/);
  assert.match(ciebr.conclusao, /Sem anúncio lido/);
  const t = L.textoDiagnostico(m);
  assert.match(t, /== LOJA ONLINE \(MLB1\) ==/);
  assert.match(t, /ERRO Promoções da conta \[HTTP 403\]/);
});

test("recusa de permissão pela função própria: 1 consulta por tipo e conta, o resto sai da memória (e continua falha)", async () => {
  let chamadas = 0;
  const bf = async () => { chamadas++; return { ok: false, status: 403, erro: "At least one policy returned UNAUTHORIZED.", via: "paizinho-bf-leitura" }; };
  const principal = async () => ({ ok: true, dados: {} });
  const rota = P.roteadorBF({ principal, bf });
  for (let i = 1; i <= 50; i++) {
    const r = await rota(`/seller-promotions/items/MLB${i}?app_version=v2`);
    assert.equal(r.ok, false);
  }
  assert.equal(chamadas, 1, "50 anúncios = 1 chamada");
  await rota(`/seller-promotions/users/${LOJA}?app_version=v2`);
  assert.equal(chamadas, 2, "outro tipo de leitura é testado uma vez");
  const okCat = P.roteadorBF({ principal, bf: async () => { chamadas++; return { ok: true, dados: { name: "Renault Clio" } }; } });
  await okCat("/products/MLB1"); await okCat("/products/MLB2");
  assert.equal(chamadas, 4, "leitura que funciona não é bloqueada");
});

test("BF aplicativo ML: só App ID público da URL, conclusões sem adivinhar, nada gravado", async () => {
  const A = await import("../../src/services/blackFriday/aplicativoML.js");
  const r = A.aplicativoDaUrl("https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=1234567890127864&redirect_uri=https%3A%2F%2Fwww.paiia.com.br%2Fx&state=s");
  assert.deepEqual(r, { ok: true, app_id: "1234567890127864", retorno_host: "www.paiia.com.br", autorizacao_host: "auth.mercadolivre.com.br" });
  assert.equal(A.aplicativoDaUrl("https://x/?client_id=SEU_APP").ok, false);
  const chamadas = [];
  const invocar = async (nome, { body }) => {
    chamadas.push(`${nome}:${body.acao}`);
    if (body.acao === "url_autorizacao") return { data: { ok: true, url: "https://auth.mercadolivre.com.br/authorization?client_id=1234567890127864&redirect_uri=https%3A%2F%2Fwww.paiia.com.br%2F" } };
    return { data: { ok: true, contas: [{ ml_user_id: "1729335019", status: "conectada", scopes: "offline_access read write" }] } };
  };
  const consultorDaConta = (c) => async (caminho) => caminho.startsWith("/users/")
    ? { ok: true, dados: { autorizacoes_na_conta: 2, paiia: { app_id: "…7864", scopes: ["read", "write"] } } }
    : c === "824312524" ? { ok: true, dados: { name: "PAIIA", id: "…7864" } } : { ok: false, status: 403, erro: "forbidden" };
  const res = await A.identificarAplicativo({ invocar, consultorDaConta });
  assert.deepEqual(chamadas, ["mercadolivre-oauth:url_autorizacao", "mercadolivre-oauth:status"], "só ações de leitura");
  assert.equal(res.porConta.length, 3);
  const ind = res.conclusoes.find((c) => c.tipo === "indicio");
  assert.match(ind.texto, /Só CIEBR/); assert.match(ind.texto, /não prova/);
  const t = A.textoAplicativo(res);
  assert.doesNotMatch(t, /secret|token|refresh/i);
  const fonte = fs.readFileSync(path.join(process.cwd(), "src/services/blackFriday/aplicativoML.js"), "utf8");
  assert.doesNotMatch(fonte, /location\.href|window\.open|\.insert\(|\.upsert\(|desconectar|definir_ativa/);
});

test("BF caminho B: dono lido pelo próprio aplicativo, resumo seguro, aviso de não publicado", async () => {
  const P = await import("../../src/services/blackFriday/leituraPermitida.js");
  const A = await import("../../src/services/blackFriday/aplicativoML.js");
  assert.equal(P.conferirLeituraBF("/applications/paiia/dono", "824312524").ok, true);
  assert.equal(P.conferirLeituraBF("/applications/1283127548197864", "824312524").ok, false, "id nunca vem do navegador");
  const res = P.resumirDonoAplicativo({ id: 1283127548197864, name: "PAIIA", owner_id: 824312524, secret_key: "S", redirect_uri: "https://x", email: "a@b", scopes: ["read"] });
  assert.deepEqual(res.donos, [{ campo: "owner_id", id: "824312524", conta: "CIEBR" }]);
  assert.equal(res.id, "…7864");
  assert.doesNotMatch(JSON.stringify(res).replace(/"campos_recebidos":\[[^\]]*\]/, ""), /"S"|https:\/\/x|a@b/);
  assert.ok(!res.campos_recebidos.some((k) => /secret|redirect|email/.test(k)));
  const ok = await A.lerDonoPeloAplicativo({ consultar: async () => ({ ok: true, dados: res }) });
  assert.match(ok.conclusao, /COMPROVADO.*CIEBR/);
  const fora = await A.lerDonoPeloAplicativo({ consultar: async () => ({ ok: true, dados: P.resumirDonoAplicativo({ id: 1, owner_id: 555 }) }) });
  assert.match(fora.conclusao, /FORA das 3/);
  const np = await A.lerDonoPeloAplicativo({ consultar: async () => ({ ok: false, status: 403, erro: "Leitura não permitida na Black Friday (só promoções e catálogo)." }) });
  assert.equal(np.nao_publicado, true);
  const fn = fs.readFileSync(path.join(process.cwd(), "supabase/functions/paizinho-bf-leitura/index.ts"), "utf8");
  const bloco = fn.slice(fn.indexOf('conf.tipo === "aplicativo_dono") {'), fn.indexOf("// 5) (15/11)"));
  assert.match(bloco, /grant_type: "client_credentials"/);
  assert.doesNotMatch(bloco, /\.from\(|\.insert\(|\.update\(|access_token:|json\(\{[^}]*tk[,}]/, "acesso do aplicativo não é gravado nem devolvido");
});

test("uma conta por vez: ordem LOJA ONLINE → CIEBR → REVELAÇÃO e campanha aprovada separada por conta", () => {
  assert.deepEqual(R.CONTAS_BLACK_FRIDAY.map((c) => c.nome), ["LOJA ONLINE", "CIEBR", "REVELAÇÃO"]);
  const reg = G.criarRegistroBF({ storage: memoria(), usuarioId: "u1", agora: () => "2026-11-16T12:00:00Z" });
  const apto = R.simularAnuncio(leituraAnuncio(), { perfil: PERFIL });
  assert.equal(reg.aprovarCampanhaConta(apto.conta, { nome: "X" }).ok, false, "sem ofertas aprovadas não aprova campanha");
  reg.aprovar([apto], { modo: "anuncio" });
  const r = reg.aprovarCampanhaConta(apto.conta, { nome: "LOJA ONLINE" });
  assert.equal(r.ok, true); assert.equal(r.campanha.ofertas, 1); assert.equal(r.campanha.ativacao, "pendente_fase_3");
  assert.equal(r.campanha.fim, "2026-11-30T23:59:00-03:00");
  assert.equal(reg.campanhasPorConta()[apto.conta].valida, true);
  assert.equal(Object.keys(reg.campanhasPorConta()).length, 1, "outras contas não são aprovadas junto");
  reg.desaprovar([apto.chave]);
  assert.equal(reg.campanhasPorConta()[apto.conta].valida, false, "ofertas mudaram → campanha da conta desatualizada");
  assert.equal(reg.retirarCampanhaConta(apto.conta), true);
  assert.deepEqual(reg.campanhasPorConta(), {});
});

test("teste de promoções de uma conta: autorizada ou motivo técnico exato (sem cache, uma consulta)", async () => {
  const A = await import("../../src/services/blackFriday/aplicativoML.js");
  const caminhos = [];
  const ok = await A.testarPromocoesConta({ conta: "1729335019", consultar: async (c) => { caminhos.push(c); return { ok: true, status: 200, dados: { results: [{ type: "DEAL" }, { type: "PRICE_DISCOUNT" }] } }; } });
  assert.deepEqual(caminhos, ["/seller-promotions/users/1729335019?app_version=v2"]);
  assert.equal(ok.resultado, "autorizada"); assert.equal(ok.promocoes, 2); assert.match(ok.texto, /AUTORIZADA para LOJA ONLINE/);
  const neg = await A.testarPromocoesConta({ conta: "1729335019", consultar: async () => ({ ok: false, status: 403, erro: "At least one policy returned UNAUTHORIZED.", recusa_ml: { status: 403, mensagem: "At least one policy returned UNAUTHORIZED.", codigo: "", causa: [] } }) });
  assert.equal(neg.resultado, "bloqueada"); assert.match(neg.motivo, /Promoções, cupons e descontos/); assert.match(neg.motivo, /CIEBR/);
  const venc = await A.testarPromocoesConta({ conta: "1729335019", consultar: async () => ({ ok: false, status: 401, erro: "Token da conta Mercado Livre vencido: abra Contas Marketplace" }) });
  assert.match(venc.motivo, /credencial, não permissão/);
});

test("renovar acesso: usa a renovação oficial (validar_conexao) da conta, sem reconectar e sem devolver e-mail/token", async () => {
  const A = await import("../../src/services/blackFriday/aplicativoML.js");
  const chamadas = [];
  const invocar = async (nome, { body }) => { chamadas.push({ nome, ...body }); return { data: { ok: true, conectado: true, pertence_ao_usuario: true, renovado: true, token_valido_ate: "2026-11-16T22:00:00Z", email: "x@y", nome: "Fulano" } }; };
  const r = await A.renovarAcessoConta({ conta: "824312524", invocar });
  assert.deepEqual(chamadas, [{ nome: "mercadolivre-publicacao", acao: "validar_conexao", conta_ml: "824312524" }], "sem forcar_renovacao, sem outra ação");
  assert.deepEqual(r, { ok: true, conta: "CIEBR", renovado: true, valido_ate: "2026-11-16T22:00:00Z", pertence: true, identidade: { ml_user_id: "824312524", apelido: null, email: "x@y", empresa: null, nome: "Fulano" }, erro: null });
  assert.doesNotMatch(JSON.stringify(r), /token/i);
  const revog = await A.renovarAcessoConta({ conta: "824312524", invocar: async () => ({ data: { ok: false, erro: "A autorização do Mercado Livre venceu ou foi revogada. Clique em Reconectar em Contas Marketplace." } }) });
  assert.equal(revog.precisa_reconectar, true);
  const venc = await A.testarPromocoesConta({ conta: "824312524", consultar: async () => ({ ok: false, status: 401, erro: "Token da conta Mercado Livre vencido" }) });
  assert.match(venc.motivo, /Renovar acesso desta conta/);
});

test("preço promocional arredonda para BAIXO: desconto real nunca fica abaixo do percentual (mínimo 5% do ML)", async () => {
  const PL = await import("../../src/services/blackFriday/planilha.js");
  assert.equal(R.precoComDesconto(200, 5), 190);
  assert.equal(R.precoComDesconto(10.01, 5), 9.5, "9,5095 → 9,50 (antes 9,51 = 4,99%)");
  for (const p of [10.01, 19.99, 33.33, 79.9, 129.9, 1234.57, 0.99]) {
    for (const d of [5, 10]) assert.ok(PL.descontoReal(p, R.precoComDesconto(p, d)) >= d, `${p} a ${d}%`);
  }
});

test("planilha da conta: PRONTO só sem pendência; elegibilidade do desconto individual; CSV para Excel; nada é gravado", async () => {
  const PL = await import("../../src/services/blackFriday/planilha.js");
  const base = R.simularAnuncio(leituraAnuncio(), { perfil: PERFIL });
  const pronto = { ...base, situacao: "apto", motivos: [], alertas: [], bloqueios: [], custo_motivo: null, margem_pct: 20, condicao: "new", tipo_anuncio: "gold_special", promocao: "nao_verificada", promocao_texto: "Promoção não verificada (403). Fica em revisão." };
  pronto.motivos = [pronto.promocao_texto];
  assert.equal(PL.classificarParaPlanilha(pronto).lista, "PRONTO", "promoção não verificável vira observação no cadastro manual");
  assert.match(PL.classificarParaPlanilha(pronto).observacoes.join(), /confira na tela do ML/);
  assert.equal(PL.classificarParaPlanilha({ ...pronto, condicao: "used" }).lista, "CONFERIR");
  assert.equal(PL.classificarParaPlanilha({ ...pronto, custo_motivo: "custo não lido no Bling", margem_pct: null }).lista, "CONFERIR", "margem não verificada nunca é PRONTO");
  assert.equal(PL.classificarParaPlanilha({ ...pronto, tipo_anuncio: "free" }).lista, "CONFERIR");
  assert.equal(PL.classificarParaPlanilha({ ...pronto, classe: "revisao", decisao: null }).lista, "CONFERIR");
  assert.equal(PL.classificarParaPlanilha({ ...pronto, alertas: ["Margem baixa"] }).lista, "CONFERIR");
  assert.equal(PL.classificarParaPlanilha({ ...pronto, promocao: "conflito", motivos: ["Já participa de promoção"] }).lista, "CONFERIR");
  const pl = PL.montarPlanilha([pronto, { ...pronto, id: "MLB9", chave: "x", condicao: "used" }, { ...pronto, conta: "outra" }], pronto.conta);
  assert.equal(pl.length, 2, "só a conta pedida");
  assert.deepEqual(pl.map((r) => r.lista), ["PRONTO", "CONFERIR"]);
  assert.equal(pl[0].inicio, "27/11/2026"); assert.equal(pl[0].fim, "30/11/2026");
  const csv = PL.planilhaCSV(pl);
  assert.ok(csv.startsWith("﻿Lista;Conta;MLB;SKU;"));
  assert.match(csv, /;200,00;5;190,00;5;27\/11\/2026;30\/11\/2026;/);
  const res = PL.resumirPlanilha(pl);
  assert.equal(res.pronto, 1); assert.equal(res.conferir, 1); assert.equal(res.soma_promocional, 190);
  const fonte = fs.readFileSync(path.join(RAIZ, "src/services/blackFriday/planilha.js"), "utf8");
  assert.doesNotMatch(fonte, /invoke\(|fetch\(|method:|\.insert\(|\.update\(/);
});
