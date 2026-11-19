// =============================================================
// PAIIA — TESTES (19/11/2026): Ranqueamento — marca, código principal e prejuízo estimado.
// Caso real REVELAÇÃO: MLB4520920619, SKU H8201443067, marca do anúncio "Torken",
// campo de código com "H8201443067, 025803002U, 025803002T, 0258030172/173",
// preço R$ 121,00 − tarifa R$ 20,57 − frete R$ 16,95 − custo R$ 91,39 = −R$ 7,91, zero vendas.
// ML e Bling FALSOS (sem rede).
//   node --test scripts/testes/ranqueamentoMarcaCodigoPrejuizo.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";

const { executarAuditoria } = await import("../../src/services/paizinhoAuditoria/index.js");
const { codigosDoTexto, codigoPrincipal } = await import("../../src/services/paizinhoAuditoria/util.js");
const C = await import("../../src/services/paizinhoAuditoria/correcao.js");
const { mlFalso, AGORA } = await import("./apoio/paizinhoAuditoriaFalso.mjs");

const CONTA = "2412238242";
const MLB = "MLB4520920619";
const CODIGOS = "H8201443067, 025803002U, 025803002T, 0258030172/173";

function item(extra = {}) {
  return {
    id: MLB, seller_id: Number(CONTA), title: "Sensor De Rotação Renault Clio Logan Sandero 1.6", price: 121, available_quantity: 5,
    listing_type_id: "gold_special", category_id: "MLB1234", condition: "new", date_created: "2026-01-01T00:00:00.000Z", permalink: "",
    pictures: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }], shipping: { free_shipping: true, logistic_type: "xd_drop_off" },
    attributes: [
      { id: "BRAND", value_name: "Torken" }, { id: "PART_NUMBER", value_name: CODIGOS }, { id: "SELLER_SKU", value_name: "H8201443067" },
      { id: "SELLER_PACKAGE_LENGTH", value_name: "15 cm", value_struct: { number: 15, unit: "cm" } }, { id: "SELLER_PACKAGE_WIDTH", value_name: "10 cm", value_struct: { number: 10, unit: "cm" } },
      { id: "SELLER_PACKAGE_HEIGHT", value_name: "8 cm", value_struct: { number: 8, unit: "cm" } }, { id: "SELLER_PACKAGE_WEIGHT", value_name: "300 g", value_struct: { number: 300, unit: "g" } },
    ],
    ...extra,
  };
}

/** ML falso com UM anúncio: tarifa R$ 20,57, frete R$ 16,95 e as vendas pedidas. */
function ml({ pedidos = [] } = {}) {
  const base = mlFalso();
  const ok = (dados) => ({ ok: true, status: 200, dados });
  return async (caminho) => {
    const u = new URL(`https://api${caminho}`);
    const p = u.pathname;
    if (p === `/users/${CONTA}`) return ok({ id: Number(CONTA), site_id: "MLB" });
    if (p === `/users/${CONTA}/items/search`) return ok({ results: [MLB], paging: { total: 1 } });
    if (p === "/items") return ok([{ code: 200, body: item() }]);
    if (p === `/items/${MLB}`) return ok(item());
    if (p === "/sites/MLB/listing_prices") return ok([{ sale_fee_amount: 20.57, sale_fee_details: { percentage_fee: 17 } }]);
    if (p === `/users/${CONTA}/shipping_options/free`) return ok({ coverage: { all_country: { list_cost: 16.95, billable_weight: 300, currency_id: "BRL" } } });
    if (p === "/orders/search") return ok({ results: Number(u.searchParams.get("offset")) ? [] : pedidos, paging: { total: pedidos.length } });
    if (p === "/items/visits") return ok([{ item_id: MLB, total_visits: 40 }]);
    return base.consultar(caminho);
  };
}
const bling = async () => ({ ok: true, produto: { codigo: "H8201443067", pesoBruto: 0.3, largura: 10, altura: 8, profundidade: 15 } });
const custo = async () => ({ ok: true, encontrado: true, custo: { fornecedor_precoCusto: 91.39, fornecedores: [{ padrao: true, precoCusto: 91.39 }] } });
const rodar = (pedidos) => executarAuditoria({ conta: CONTA, consultar: ml({ pedidos }), consultarBling: bling, consultarCusto: custo, agora: AGORA });
const achados = (rel) => rel.secoes.flatMap((s) => s.achados).filter((a) => a.item_id === MLB);

test("códigos: separa o campo e escolhe o principal pelo SKU; os outros não viram equivalências", () => {
  assert.deepEqual(codigosDoTexto(CODIGOS), ["H8201443067", "025803002U", "025803002T", "0258030172/173"]);
  assert.deepEqual(codigoPrincipal(CODIGOS, "H8201443067"), { principal: "H8201443067", outros: ["025803002U", "025803002T", "0258030172/173"] });
  assert.equal(codigoPrincipal("7700274008", "SKU-X").principal, "7700274008", "um código só: nada muda");
  assert.equal(codigoPrincipal("A1, B2", "zz").principal, "A1", "sem SKU igual: o 1º informado");
  assert.deepEqual(codigoPrincipal("", "x"), { principal: "", outros: [] });
});

test("MLB4520920619: alerta só com o código principal; outros códigos à parte; sem alerta de marca", async () => {
  const rel = await rodar([]);
  const lista = achados(rel);
  const cod = lista.find((a) => /^O código/.test(a.problema));
  assert.equal(cod.problema, "O código H8201443067 não está no título.");
  assert.ok(!lista.some((a) => /marca .* não está no título/i.test(a.problema)), "nenhum alerta de marca fora do título");
  const an = rel.anuncios.find((a) => a.item_id === MLB);
  assert.equal(an.marca, "Torken", "marca do anúncio fica visível para conferência manual");
  assert.equal(an.codigo, "H8201443067");
  assert.deepEqual(an.outros_codigos, ["025803002U", "025803002T", "0258030172/173"]);
  // Título sugerido: só o código principal; nunca Torken nem os outros códigos.
  const t = C.sugestaoTitulo({ ...an, achados: lista });
  assert.equal(t.titulo, "Sensor De Rotação Renault Clio Logan Sandero 1.6 H8201443067");
  assert.doesNotMatch(t.titulo, /Torken|025803002/);
});

test("MLB4520920619 sem vendas: prejuízo ESTIMADO por venda (custo cadastrado no Bling, antes dos impostos), não realizado, Importante", async () => {
  const rel = await rodar([]);
  const m = achados(rel).find((a) => a.area === "margem");
  assert.equal(m.problema,
    "Prejuízo estimado de R$ 7,91 por venda (custo cadastrado no Bling, antes dos impostos): preço R$ 121,00 − tarifa R$ 20,57 − frete R$ 16,95 − custo R$ 91,39. Nenhuma venda nos últimos 30 dias: prejuízo estimado por venda, não realizado.");
  assert.equal(m.severidade, "media", "zero vendas: Importante, não Urgente");
  assert.equal(m.impacto_rs, null, "nada realizado em 30 dias");
  assert.equal(m.margem.lucro, -7.91, "conta inalterada");
  assert.equal(rel.resumo.prejuizo_estimado_30d, 0, "total de 30 dias: nenhum prejuízo realizado");
  const an = rel.anuncios.find((a) => a.item_id === MLB);
  assert.equal(an.custo, 91.39);
  assert.equal(an.custo_motivo, "fornecedor padrão do Bling");
  assert.equal(C.ROTULO_CATEGORIA[C.classificarAnuncio({ ...an, lucro: an.lucro, achados: achados(rel) }).categorias[0]], "💸 Prejuízo estimado (custo cadastrado no Bling)");
});

test("com vendas no período: mesma conta, continua Urgente e o impacto de 30 dias é calculado", async () => {
  const pedido = (n) => ({ id: n, status: "paid", date_created: "2026-11-05T12:00:00.000-03:00", order_items: [{ item: { id: MLB }, quantity: 1, unit_price: 121 }], shipping: { id: 0 } });
  const rel = await rodar([pedido(1), pedido(2)]);
  const m = achados(rel).find((a) => a.area === "margem");
  assert.match(m.problema, /^Prejuízo estimado de R\$ 7,91 por venda \(custo cadastrado no Bling, antes dos impostos\)/);
  assert.doesNotMatch(m.problema, /não realizado/);
  assert.equal(m.severidade, "alta");
  assert.equal(m.impacto_rs, -15.82);
});
