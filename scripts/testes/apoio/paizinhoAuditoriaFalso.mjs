// Apoio dos testes da auditoria do Paizinho: ML e Bling FALSOS (sem rede),
// no formato real da API. Usado também pela tela de conferência local.
export const CONTA = "1729335019";
export const AGORA = "2026-11-11T06:00:00.000Z"; // 03h de Brasília
const diasAntes = (n) => new Date(new Date(AGORA).getTime() - n * 86400000).toISOString();

const attr = (id, value_name, struct) => ({ id, value_name, ...(struct ? { value_struct: struct } : {}) });
const pacote = (c, l, a, g) => [
  attr("SELLER_PACKAGE_LENGTH", `${c} cm`, { number: c, unit: "cm" }),
  attr("SELLER_PACKAGE_WIDTH", `${l} cm`, { number: l, unit: "cm" }),
  attr("SELLER_PACKAGE_HEIGHT", `${a} cm`, { number: a, unit: "cm" }),
  attr("SELLER_PACKAGE_WEIGHT", `${g} g`, { number: g, unit: "g" }),
];
const fotos = (n) => Array.from({ length: n }, (_, i) => ({ id: `F${i}` }));

function item(id, extra) {
  return {
    id, seller_id: Number(CONTA), title: "Sensor de Rotação Bosch 0261210170 Gol Fox Polo 1.6", price: 100, available_quantity: 10,
    listing_type_id: "gold_special", category_id: "MLB1234", condition: "new", date_created: diasAntes(200), permalink: `https://produto.mercadolivre.com.br/${id}`,
    pictures: fotos(6), shipping: { free_shipping: true, logistic_type: "xd_drop_off" },
    attributes: [attr("BRAND", "Bosch"), attr("PART_NUMBER", "0261210170"), attr("SELLER_SKU", `SKU-${id}`), ...pacote(15, 10, 8, 300)],
    ...extra,
  };
}

// Cenários
export const ITENS = {
  MLB1: item("MLB1"),                                                     // prejuízo (custo 80, frete 20, tarifa 14)
  MLB2: item("MLB2", { title: "Sensor Renault Original 8200000001 Clio", price: 110, attributes: [attr("BRAND", "Renault"), attr("PART_NUMBER", "8200000001"), attr("SELLER_SKU", "SKU-MLB2"), ...pacote(15, 10, 8, 300)] }), // Renault sem custo
  MLB3: item("MLB3", { attributes: [attr("BRAND", "Bosch"), attr("PART_NUMBER", "0261210170"), attr("SELLER_SKU", "SKU-MLB3")] }), // sem medidas
  MLB4: item("MLB4", { title: "Sensor Bosch Gol", available_quantity: 1 }), // título curto + código fora + repor
  MLB5: item("MLB5"),                                                     // medidas divergentes do Bling
  MLB6: item("MLB6"),                                                     // frete cobrado acima do estimado
  MLB9: { ...item("MLB9"), seller_id: 999 },                               // OUTRA CONTA
};

export const BLING = {
  "SKU-MLB1": { precoCusto: 80, peso_bruto: 0.3, profundidade: 15, largura: 10, altura: 8 },
  "SKU-MLB2": { precoCusto: 0 },
  "SKU-MLB4": { precoCusto: 30, peso_bruto: 0.3, profundidade: 15, largura: 10, altura: 8 },
  "SKU-MLB5": { precoCusto: 30, peso_bruto: 0.3, profundidade: 30, largura: 30, altura: 30 },
  "SKU-MLB6": { precoCusto: 30 },
};

const pedido = (id, itemId, dias, envio) => ({ id, status: "paid", date_created: diasAntes(dias), seller: { id: Number(CONTA) }, order_items: [{ item: { id: itemId }, quantity: 1, unit_price: 100 }], shipping: { id: envio } });
export const PEDIDOS = [
  pedido(1, "MLB1", 3, 101), pedido(2, "MLB1", 5, 102),
  pedido(3, "MLB4", 2, 103), pedido(4, "MLB4", 4, 104), pedido(5, "MLB4", 6, 105),
  pedido(6, "MLB6", 1, 106), pedido(7, "MLB6", 2, 107),
];
export const ENVIOS = {
  101: { senders: [{ cost: 20 }], receiver: { cost: 0 } }, 102: { senders: [{ cost: 20 }], receiver: { cost: 0 } },
  103: { senders: [{ cost: 20 }], receiver: { cost: 0 } }, 104: { senders: [{ cost: 20 }], receiver: { cost: 0 } }, 105: { senders: [{ cost: 20 }], receiver: { cost: 0 } },
  106: { senders: [{ cost: 35 }], receiver: { cost: 0 } }, 107: { senders: [{ cost: 35 }], receiver: { cost: 0 } },
};
export const VISITAS = { MLB1: 80, MLB2: 40, MLB3: 200, MLB4: 30, MLB5: 5, MLB6: 60 };

export function mlFalso() {
  const caminhos = [];
  const ok = (dados) => ({ ok: true, status: 200, dados });
  const consultar = async (caminho, ...resto) => {
    caminhos.push({ caminho, resto });
    const u = new URL(`https://api${caminho}`);
    const p = u.pathname;
    if (p === `/users/${CONTA}`) return ok({ id: Number(CONTA), nickname: "LOJA ONLINE", site_id: "MLB" });
    if (p === `/users/${CONTA}/items/search`) return ok({ results: Object.keys(ITENS), paging: { total: Object.keys(ITENS).length } });
    if (p === "/items") return ok(u.searchParams.get("ids").split(",").map((id) => ({ code: 200, body: ITENS[id] })));
    if (/^\/items\/MLB\d+\/description$/.test(p)) return ok({ plain_text: "Sensor de rotação Bosch 0261210170. Aplicação: Gol, Fox e Polo 1.6. Peça nova na caixa, garantia de 90 dias. Conferir o código antes de comprar. ".repeat(3) });
    if (p === "/items/visits") return ok(u.searchParams.get("ids").split(",").map((id) => ({ item_id: id, total_visits: VISITAS[id] || 0 })));
    if (p === "/orders/search") return ok({ results: Number(u.searchParams.get("offset")) ? [] : PEDIDOS, paging: { total: PEDIDOS.length } });
    const env = p.match(/^\/shipments\/(\d+)\/costs$/);
    if (env) return ok(ENVIOS[env[1]]);
    if (p === `/users/${CONTA}/shipping_options/free`) {
      const dims = u.searchParams.get("dimensions");
      if (dims) return ok({ coverage: { all_country: { list_cost: dims.startsWith("30x30x30") ? 32 : 20, billable_weight: dims.startsWith("30x30x30") ? 4500 : 300, currency_id: "BRL" } } });
      return ok({ coverage: { all_country: { list_cost: u.searchParams.get("item_id") === "MLB5" ? 20 : 20, billable_weight: 300, currency_id: "BRL" } } });
    }
    if (p === "/sites/MLB/listing_prices") return ok([{ sale_fee_amount: 14, sale_fee_details: { percentage_fee: 14 } }]);
    if (/\/compatibilities$/.test(p)) return ok({ products: [{ id: "c1" }, { id: "c2" }] });
    return { ok: false, status: 404, erro: "não simulado" };
  };
  return { consultar, caminhos };
}
export const blingFalso = async (sku) => (sku in BLING ? { ok: true, produto: BLING[sku] } : { ok: true, encontrado: false });

