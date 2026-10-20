// =============================================================
// PAIIA — TESTES (20/10/2026): auditoria do frete oficial na janela única.
//   node --test scripts/testes/freteAuditoria.test.mjs
// Caso real conferido no DevTools (20/10): LOJA ONLINE 1729335019, Clássico,
// Agências (xd_drop_off), embalagem 15×8×8 cm, 280 g, item_price 101,46 →
// HTTP 200, list_cost 14,95, billable_weight 280. Com 15×15×8 o ML cobrou 300 g.
// O ML aqui é FALSO (sem rede): devolve o formato real da API.
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const F = await import("../../src/services/fretePrecificacao.js");
const P = await import("../../src/services/precificacaoSimples.js");
const { parametrosCotacao, baseDePrecificacao, calcularFreteEPrecos, situacaoFrete, cotarNoPreco, pesosInformados } = F;

const CONTA = "1729335019";
const params = (medida = { peso_g: 280, comprimento_cm: 15, largura_cm: 8, altura_cm: 8 }) =>
  parametrosCotacao({ conta: CONTA, medida, modalidade: "xd_drop_off", categoria: "", tipoAnuncio: "classico" });
const BASE = baseDePrecificacao({ custo: "50", despesas: "3", comissao: "12", imposto: "8" });

// ML falso no formato real; billable = maior entre peso real e cúbico (÷6000), como o ML.
function mlFalso({ falharEm = null, relogio = () => "2026-10-20T10:50:27.000Z" } = {}) {
  const chamadas = [];
  const f = async (caminho) => {
    chamadas.push(caminho);
    const u = new URL("https://x" + caminho);
    const preco = Number(u.searchParams.get("item_price"));
    if (falharEm !== null && preco === falharEm) return { ok: false, status: 401, erro: "invalid access token" };
    const [dim, peso] = u.searchParams.get("dimensions").split(",");
    const [c, l, a] = dim.split("x").map(Number);
    const billable = Math.max(Number(peso), Math.round((c * l * a) / 6000 * 1000));
    const custo = preco < 79 ? 8.15 : preco < 100 ? 12.95 : 14.95;
    return { ok: true, status: 200, recebido_em: relogio(), dados: { coverage: { all_country: { list_cost: custo, currency_id: "BRL", billable_weight: billable, discount: { rate: 0.5, promoted_amount: custo * 2 } } } } };
  };
  f.chamadas = chamadas;
  return f;
}

test("caso real 20/10: margens 10/15/20% preservadas e cada opção mostra o frete e o peso cobrado da SUA cotação", async () => {
  const r = await calcularFreteEPrecos({ params: params(), base: BASE, precoFinal: 0, consultar: mlFalso(), estimar: false });
  assert.equal(r.ok, true);
  const m = r.registro.margens;
  assert.deepEqual([m.conservador.preco, m.recomendado.preco, m.ideal.preco], [94.21, 104.54, 113.25]);
  assert.deepEqual([m.conservador.margemPct, m.recomendado.margemPct, m.ideal.margemPct], [10, 15, 20]);
  assert.deepEqual([m.conservador.frete, m.recomendado.frete, m.ideal.frete], [12.95, 14.95, 14.95]);
  for (const k of ["conservador", "recomendado", "ideal"]) {
    assert.equal(m[k].peso_cobrado_g, 280, k);
    assert.equal(m[k].status, 200, k);
    assert.equal(m[k].consulta.conta, CONTA);
    assert.equal(m[k].consulta.dimensoes, "15x8x8,280");
    assert.equal(m[k].consulta.logistic_type, "xd_drop_off");
    assert.equal(m[k].consulta.listing_type_id, "gold_special");
    assert.equal(m[k].cotado_em, "2026-10-20T10:50:27.000Z");
  }
  assert.equal(m.recomendado.preco_cotado, 101.46, "a consulta real do DevTools");
  assert.equal(m.recomendado.exato, false, "104,54 usa a cotação de 101,46 (mesma faixa) — mostrado na tela");
  assert.ok(m.recomendado.consulta.caminho.includes("item_price=101.46"));
  // lista para conferir no PAIIA: uma linha por consulta, com os usos
  const q = r.registro.cotacoes.find((x) => x.consulta.item_price === 101.46);
  assert.deepEqual(q.usos, ["Recomendado", "Ideal"]);
  assert.equal(q.custo_vendedor, 14.95);
  assert.equal(q.frete_cheio, 29.9);
  assert.equal(q.desconto_pct, 50);
});

test("peso INFORMADO x peso COBRADO pelo ML: o cobrado vem só da resposta (nunca trocado pelo informado)", async () => {
  assert.deepEqual(pesosInformados({ peso_g: 280, comprimento_cm: 15, largura_cm: 8, altura_cm: 8 }), { informado_g: 280, cubico_g: 160 });
  const r = await calcularFreteEPrecos({ params: params({ peso_g: 280, comprimento_cm: 15, largura_cm: 15, altura_cm: 8 }), base: BASE, precoFinal: 0, consultar: mlFalso(), estimar: false });
  assert.deepEqual(r.registro.pesos, { informado_g: 280, cubico_g: 300 });
  assert.equal(r.registro.margens.recomendado.peso_cobrado_g, 300, "15×15×8: o ML cobrou 300 g");
  assert.equal(r.registro.margens.recomendado.consulta.dimensoes, "15x15x8,280");
  assert.equal(P.resumoFrete(r.registro).peso, 300);
});

test("horário ORIGINAL da resposta: reaproveitar a memória da tela não atualiza o horário", async () => {
  let hora = "2026-10-20T10:50:27.000Z";
  const ml = mlFalso({ relogio: () => hora });
  const consultar = P.criarConsultaComCache({ consultar: ml });
  const r1 = await calcularFreteEPrecos({ params: params(), base: BASE, precoFinal: 0, consultar, estimar: false, agora: () => "2026-10-20T10:50:20.000Z" });
  const n = ml.chamadas.length;
  hora = "2026-10-20T11:30:00.000Z";
  const r2 = await calcularFreteEPrecos({ params: params(), base: BASE, precoFinal: 0, consultar, estimar: false, agora: () => "2026-10-20T11:30:00.000Z" });
  assert.equal(ml.chamadas.length, n, "nenhuma consulta nova");
  assert.equal(r2.registro.margens.recomendado.cotado_em, "2026-10-20T10:50:27.000Z");
  assert.ok(r2.registro.cotacoes.every((q) => q.reaproveitada === true && q.cotado_em === "2026-10-20T10:50:27.000Z"));
  assert.equal(r2.registro.calculado_em, "2026-10-20T11:30:00.000Z", "horário do cálculo continua separado");
  assert.ok(r1.registro.cotacoes.every((q) => q.reaproveitada === false));
});

test("preço final: cotado no valor EXATO antes de confirmar; outro preço na mesma faixa não confirma", async () => {
  const ml = mlFalso();
  const r = await calcularFreteEPrecos({ params: params(), base: BASE, precoFinal: 104.54, consultar: ml, estimar: false });
  assert.ok(ml.chamadas.some((c) => c.includes("item_price=104.54")), "consulta no preço exato");
  assert.equal(r.registro.final.preco_cotado, 104.54);
  assert.equal(r.registro.final.exato, true);
  assert.equal(r.registro.final.margemPct, 15);
  assert.equal(r.registro.final.consulta.dimensoes, "15x8x8,280");
  assert.ok(r.registro.cotacoes.some((q) => q.usos.includes("Preço final") && q.consulta.item_price === 104.54));
  assert.equal(situacaoFrete({ registro: r.registro, atual: { ...params(), preco: 104.54, base: BASE } }).estado, "ok");
  const outro = situacaoFrete({ registro: r.registro, atual: { ...params(), preco: 105, base: BASE } });
  assert.equal(outro.estado, "desatualizado");
  assert.ok(outro.motivos.some((m) => /ainda não cotado no valor exato/.test(m)));
  assert.equal(P.precisaRecalcular({ pronto: true, situacao: outro, registro: r.registro, preco: 105, assinatura: "a", ultimaTentativa: "" }), true, "recota sozinho");
});

test("falha na cotação EXATA do preço final: erro verdadeiro, nada confirmado, sem cair na cotação da faixa", async () => {
  const r = await calcularFreteEPrecos({ params: params(), base: BASE, precoFinal: 104.54, consultar: mlFalso({ falharEm: 104.54 }), estimar: false });
  assert.equal(r.ok, false);
  assert.match(r.erro, /preço final exato \(R\$ 104,54\)/);
  assert.match(r.erro, /invalid access token \(HTTP 401\)/);
  assert.equal(r.registro, undefined);
});

test("API fora: erro verdadeiro, sem estimativa, sem preço", async () => {
  const r = await calcularFreteEPrecos({ params: params(), base: BASE, precoFinal: 0, consultar: async () => ({ ok: false, status: 503, erro: "service unavailable" }), estimar: false });
  assert.equal(r.ok, false);
  assert.match(r.erro, /service unavailable \(HTTP 503\)/);
  const c = await cotarNoPreco({ params: params(), preco: 101.46, consultar: async () => ({ ok: false, status: 401, erro: "invalid access token" }) });
  assert.equal(c.ok, false);
  assert.equal(c.custo_vendedor, undefined);
});

test("tela: peso informado e peso cobrado separados; frete por opção; conferir cotações; preço final exato; sem estimativa", () => {
  const na = fs.readFileSync(path.join(RAIZ, "src/components/NovoAnuncio.jsx"), "utf8");
  assert.match(na, /data-paiia-frete-peso-informado/);
  assert.match(na, /Peso cobrado pelo Mercado Livre: <b data-paiia-frete-peso-ml>/);
  assert.doesNotMatch(na, /peso considerado/);
  assert.match(na, /data-paiia-ml-margem-frete=\{chave\}/);
  assert.match(na, /data-paiia-frete-cotacoes/);
  assert.match(na, /data-paiia-frete-reaproveitada/);
  assert.match(na, /data-paiia-ml-final-exato/);
  assert.match(na, /estimar: false/);
  const leitura = fs.readFileSync(path.join(RAIZ, "src/services/consultaMLLeitura.js"), "utf8");
  assert.match(leitura, /recebido_em: new Date\(\)\.toISOString\(\)/);
  assert.match(leitura, /acao: "ml_consulta"/, "continua só leitura");
});
