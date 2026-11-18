// =============================================================
// PAIIA — TESTES (18/11/2026): margem da Central de Promoções / Black Friday com
// comissão REAL do ML (Clássico/Premium), custo em cascata (cadastrado → última compra
// → "Custo não encontrado") e faixas de margem com autorização. Sem rede.
//   node --test scripts/testes/margemComissaoReal.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const R = await import("../../src/services/blackFriday/regras.js");
const L = await import("../../src/services/blackFriday/leitura.js");
const PL = await import("../../src/services/blackFriday/planilha.js");
const G = await import("../../src/services/blackFriday/registro.js");
const C = await import("../../src/services/blackFriday/calendario.js");
const ler = (f) => fs.readFileSync(path.join(RAIZ, f), "utf8");
const memoria = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

// Anúncio de teste: REVELAÇÃO · SKU 12663317 · MLB6246961318 (dados lidos no ML em 18/11, só leitura).
const SONDA = {
  id: "MLB6246961318", seller_id: 2412238242, title: "Sonda Lambda Pré E Pós Cruze Tracker Turbo Flex - 0258010460",
  price: 109.29, status: "active", condition: "new", listing_type_id: "gold_pro", category_id: "MLB192358",
  available_quantity: 3, shipping: { free_shipping: true, logistic_type: "xd_drop_off" },
  attributes: [{ id: "SELLER_SKU", value_name: "12663317" }, { id: "BRAND", value_name: "Torken" }],
};
const SEM_CUSTO = { ok: true, encontrado: true, custo: { fornecedor_precoCusto: 0, fornecedores: [{ padrao: true, precoCusto: 0 }] }, formato: "S" };
const ULTIMA = { valor: 51.5, data: "2026-04-22", pedido: "340", fonte: "Pedido de compra no Bling (atendido)" };
const leitura = (x = {}) => ({
  conta: "2412238242", item: SONDA, compat: { lido: true, quantidade: 71, marcas: ["chevrolet"], legivel: true },
  promocoes: { lido: true, ativas: [], candidatas: [] },
  tarifaFinal: { valor: 17.65, percentual: 17, fixa: 0, tipo: "Premium" },
  freteAtual: { ok: true, custo_vendedor: 16.15 }, freteFinal: null,
  custo: SEM_CUSTO, ultimaCompra: ULTIMA, ...x,
});
const SEM_IMPOSTO = { impostoPct: null, custoPedido: 0 };

test("sonda 12663317: 5% → R$ 103,82 (arredonda para BAIXO: R$ 103,83 daria 4,99% e o ML recusa)", () => {
  assert.equal(R.precoComDesconto(109.29, 5), 103.82);
  assert.equal(PL.descontoReal(109.29, 103.82), 5);
  assert.ok(PL.descontoReal(109.29, 103.83) < 5, "103,83 ficaria abaixo dos 5% mínimos do ML");
});

test("sonda: comissão REAL Premium 17% (não 12%), custo da última compra como ESTIMATIVA, lucro e margem separados", () => {
  const l = R.simularAnuncio(leitura(), { perfil: SEM_IMPOSTO, descontoPct: 5 });
  assert.equal(l.preco_final, 103.82);
  assert.equal(l.tipo_anuncio_nome, "Premium");
  assert.equal(l.comissao_origem, "real");
  assert.equal(l.comissao_pct, 17);
  assert.equal(l.comissao_usada, 17.65);
  assert.equal(l.frete, 16.15);
  assert.equal(l.custo, null, "o custo cadastrado continua vazio (nada é gravado no Bling)");
  assert.equal(l.custo_origem, "ultima_compra");
  assert.equal(l.custo_usado, 51.5);
  // 103,82 − 17,65 − 16,15 − 51,50 = 18,52 → 17,8% (antes do imposto)
  assert.equal(l.lucro_estimado, 18.52);
  assert.equal(l.margem_estimada_pct, 17.8);
  assert.deepEqual(l.base_estimativa, ["custo da última compra", "sem imposto"]);
  assert.equal(l.margem_definitiva, false);
  assert.equal(l.lucro, null, "estimativa nunca vira margem definitiva");
  assert.equal(l.margem_pct, null);
  assert.equal(l.faixa_margem, "meta");
  assert.equal(l.situacao, "revisao");
  assert.equal(PL.aprovavel(l), false, "estimativa não aprova");
  assert.match(l.motivos.join(" "), /usada a última compra \(R\$ 51,50 em 22\/04\/2026\) como ESTIMATIVA/);
});

test("com imposto (ex.: 6%) a mesma sonda cai para a faixa estratégica — ainda estimativa", () => {
  const l = R.simularAnuncio(leitura(), { perfil: { impostoPct: 6, custoPedido: 0 }, descontoPct: 5 });
  assert.equal(l.imposto, 6.23);
  assert.equal(l.lucro_estimado, 12.29);
  assert.equal(l.margem_estimada_pct, 11.8);
  assert.equal(l.faixa_margem, "estrategica");
  assert.deepEqual(l.base_estimativa, ["custo da última compra"]);
});

test("sem tarifa lida: 'Comissão não confirmada'; referência Premium 17% / Clássico 12% só na estimativa", () => {
  const p = R.simularAnuncio(leitura({ tarifaFinal: null }), { perfil: SEM_IMPOSTO, descontoPct: 5 });
  assert.match(p.motivos.join(" "), /^Comissão não confirmada/m);
  assert.equal(p.comissao_origem, "referencia");
  assert.equal(p.comissao_pct, 17);
  assert.ok(p.base_estimativa.includes("comissão de referência 17%"));
  const c = R.simularAnuncio(leitura({ tarifaFinal: null, item: { ...SONDA, listing_type_id: "gold_special" } }), { perfil: SEM_IMPOSTO, descontoPct: 5 });
  assert.equal(c.tipo_anuncio_nome, "Clássico");
  assert.equal(c.comissao_pct, 12);
  assert.equal(c.comissao_usada, 12.46);
  // com custo CADASTRADO e imposto, mas sem tarifa: continua sem margem definitiva
  const d = R.simularAnuncio(leitura({ tarifaFinal: null, custo: { ok: true, encontrado: true, custo: { fornecedores: [{ padrao: true, precoCusto: 40 }] }, formato: "S" } }), { perfil: { impostoPct: 6, custoPedido: 0 }, descontoPct: 5 });
  assert.equal(d.margem_pct, null);
  assert.equal(d.margem_definitiva, false);
  assert.equal(PL.aprovavel(d), false);
});

test("custo em cascata: cadastrado prevalece; sem nenhum = 'Custo não encontrado' e sem margem", () => {
  const cad = R.simularAnuncio(leitura({ custo: { ok: true, encontrado: true, custo: { fornecedores: [{ padrao: true, precoCusto: 45 }] }, formato: "S" } }), { perfil: { impostoPct: 6, custoPedido: 0 }, descontoPct: 5 });
  assert.equal(cad.custo_origem, "cadastrado");
  assert.equal(cad.custo_usado, 45);
  assert.equal(cad.ultima_compra, null, "a última compra não é usada quando há custo cadastrado");
  assert.equal(cad.margem_definitiva, true);
  // 103,82 − 17,65 − 16,15 − 6,23 − 45 = 18,79 → 18,1%
  assert.equal(cad.lucro, 18.79);
  assert.equal(cad.margem_pct, 18.1);
  assert.equal(cad.faixa_margem, "meta");
  const nada = R.simularAnuncio(leitura({ ultimaCompra: null }), { perfil: SEM_IMPOSTO, descontoPct: 5 });
  assert.equal(nada.custo_origem, null);
  assert.equal(nada.lucro_estimado, null);
  assert.equal(nada.margem_estimada_pct, null);
  assert.match(nada.motivos.join(" "), /Custo não encontrado no Bling/);
});

test("aprovação: meta sem pergunta; 10–14,99% só com o responsável; < 10% só com autorização EXCEPCIONAL; prejuízo nunca", () => {
  const custo = (c) => ({ ok: true, encontrado: true, custo: { fornecedores: [{ padrao: true, precoCusto: c }] }, formato: "S" });
  const P = { impostoPct: 6, custoPedido: 0 };
  const meta = R.simularAnuncio(leitura({ custo: custo(45) }), { perfil: P, descontoPct: 5 });
  const estr = R.simularAnuncio(leitura({ item: { ...SONDA, id: "MLB2" }, custo: custo(52) }), { perfil: P, descontoPct: 5 });
  const exc = R.simularAnuncio(leitura({ item: { ...SONDA, id: "MLB3" }, custo: custo(58) }), { perfil: P, descontoPct: 5 });
  const prej = R.simularAnuncio(leitura({ item: { ...SONDA, id: "MLB4" }, custo: custo(70) }), { perfil: P, descontoPct: 5 });
  assert.deepEqual([meta.faixa_margem, estr.faixa_margem, exc.faixa_margem], ["meta", "estrategica", "excepcional"]);
  assert.ok(prej.lucro < 0);
  for (const l of [meta, estr, exc]) assert.equal(PL.aprovavel(l), true, l.id);
  assert.equal(PL.aprovavel(prej), false, "prejuízo continua bloqueado");
  assert.ok(PL.classificarParaPlanilha(estr).observacoes.some((o) => /só com autorização do responsável/.test(o)));
  assert.ok(PL.classificarParaPlanilha(exc).observacoes.some((o) => /EXCEPCIONAL — risco/.test(o)));

  const reg = G.criarRegistroBF({ storage: memoria(), usuarioId: "u1", agora: () => "2026-11-18T12:00:00Z" });
  const r1 = reg.aprovar([meta, estr, exc, prej]);
  assert.deepEqual(r1.aprovados, [meta.chave], "sem autorização: só a meta");
  assert.equal(r1.recusados.length, 3);
  const r2 = reg.aprovar([estr, exc], { autorizacao: { responsavel: "Edgar", excepcional: false } });
  assert.deepEqual(r2.aprovados, [estr.chave]);
  assert.match(r2.recusados[0].motivo, /autorização excepcional/);
  const r3 = reg.aprovar([exc], { autorizacao: { responsavel: "Edgar", excepcional: true } });
  assert.deepEqual(r3.aprovados, [exc.chave]);
  const plano = reg.lerPlano();
  assert.equal(plano.aprovados[estr.chave].autorizado_por, "Edgar");
  assert.equal(plano.aprovados[exc.chave].autorizacao_excepcional, true);
  assert.equal(plano.aprovados[meta.chave].autorizado_por, null);
  const r4 = reg.aprovar([exc], { autorizacao: { responsavel: "  ", excepcional: true } });
  assert.equal(r4.recusados.length, 1, "responsável em branco não vale");
  assert.ok(reg.lerPlano().aprovados[exc.chave], "a aprovação anterior (autorizada) continua");
});

test("planilha: tipo de anúncio, comissão %, se é confirmada, origem do custo, lucro e margem estimados, faixa", () => {
  const l = R.simularAnuncio(leitura(), { perfil: SEM_IMPOSTO, descontoPct: 5 });
  const csv = PL.planilhaCSV(PL.montarPlanilha([l], "2412238242"));
  assert.match(csv, /Lucro \(R\$\);Margem \(%\);Lucro estimado \(R\$\);Margem estimada \(%\);Base da estimativa;Faixa de margem;Tipo de anúncio;Comissão \(%\);Comissão confirmada pelo ML;Origem do custo/);
  assert.match(csv, /;;;18,52;17,8;custo da última compra, sem imposto;Dentro da meta \(15% ou mais\);Premium;17;sim;última compra \(estimativa\) pedido 340;/);
  const [cab, linha] = csv.replace(/^﻿/, "").trim().split("\r\n");
  assert.equal(cab.split(";").length, linha.split(";").length);
});

test("leitura: guarda o % da tarifa real; última compra só para SKU sem custo cadastrado; simulação usa a estimativa", async () => {
  const fonte = ler("src/services/blackFriday/leitura.js");
  assert.match(fonte, /percentual: pct === null/);
  assert.match(fonte, /!\(escolherCusto\(resultado\.custos\[k\]\)\.custo > 0\)/);
  const chamadas = [];
  const invocar = async (nome, { body }) => { chamadas.push([nome, body.skus.join(","), body.inicioEm]); return body.inicioEm === 0 ? { data: { ok: true, ultimas: { "12663317": ULTIMA }, parcial: true, proximo: 40 } } : { data: { ok: true, ultimas: {}, parcial: false } }; };
  const u = await L.consultorUltimasComprasBF(invocar)(["12663317", "X1"], { "12663317": 99 });
  assert.equal(u.ok, true);
  assert.equal(u.ultimas["12663317"].valor, 51.5);
  assert.equal(u.ultimas.X1, null, "sem compra = continua sem custo");
  assert.deepEqual(chamadas, [["paizinho-bling-compras", "12663317,X1", 0], ["paizinho-bling-compras", "X1", 40]]);
  const sim = L.montarSimulacao({ contas: { "2412238242": { conta: "2412238242", itens: [{ item: SONDA, compat: null, promocoes: { lido: true, ativas: [], candidatas: [] } }], tarifas: { "103.82|gold_pro|MLB192358": { valor: 17.65, percentual: 17 } }, fretes: { "MLB6246961318|atual": { ok: true, custo_vendedor: 16.15 } } } }, custos: { "12663317": SEM_CUSTO }, ultimas_compras: { "12663317": ULTIMA } }, { perfil: SEM_IMPOSTO, descontoDe: () => 5 });
  assert.equal(sim[0].margem_estimada_pct, 17.8);
  assert.equal(sim[0].comissao_pct, 17);
});

test("segurança: só leitura, datas da Black Friday mantidas, nada aprova sozinho", () => {
  assert.equal(C.CAMPANHA_BF.fim, "2026-11-30T23:59:00-03:00");
  assert.ok(C.CAMPANHA_BF.conferencias.every((c) => c.startsWith("2026-12-01")));
  for (const f of ["src/services/blackFriday/regras.js", "src/services/blackFriday/planilha.js"]) assert.doesNotMatch(ler(f), /invoke\(|fetch\(|method:|\.insert\(|\.update\(|\.upsert\(/, f);
  const leit = ler("src/services/blackFriday/leitura.js");
  assert.doesNotMatch(leit, /method:\s*"(POST|PUT|PATCH|DELETE)"/);
  const tela = ler("src/components/BlackFridayPaizinho.jsx");
  assert.match(tela, /window\.prompt\(`MARGEM FORA DA META \(15%\)/);
  assert.match(tela, /=== "AUTORIZO"/);
  assert.match(tela, /registro\.aprovar\(aptas, \{ modo, autorizacao \}\)/);
});
