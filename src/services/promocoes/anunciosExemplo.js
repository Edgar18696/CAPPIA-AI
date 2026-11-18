// =============================================================
// PAIIA — Central de Promoções: ANÚNCIOS DE EXEMPLO (18/11/2026).
// SÓ PARA O MODO DE TESTE (STAGING), que não lê o Mercado Livre.
// Gera uma "leitura" fictícia de uma conta, no mesmo formato da consulta real,
// para testar seleção, meta, sugestão, descontos e margens sem dado real.
// Todo anúncio de exemplo é marcado (MLB9…, título "[EXEMPLO]") e nunca
// existe no Mercado Livre. Determinístico: sempre os mesmos anúncios.
// =============================================================
import { precoComDesconto, DESCONTOS } from "../blackFriday/regras.js";

const centavos = (v) => Math.round(Number(v) * 100) / 100;
const PECAS = [
  ["Bobina de ignição", 189.9], ["Sensor de rotação", 149.5], ["Bomba de combustível", 329.0], ["Velas de ignição (jogo)", 119.9],
  ["Sonda lambda", 259.0], ["Válvula termostática", 89.9], ["Corpo de borboleta", 489.0], ["Bico injetor", 139.0],
  ["Sensor MAP", 179.0], ["Atuador de marcha lenta", 159.9], ["Cabo de vela (jogo)", 99.9], ["Filtro de combustível", 39.9],
  ["Regulador de pressão", 119.0], ["Sensor de temperatura", 59.9], ["Módulo de ignição", 399.0], ["Sensor de fase", 129.0],
];
const MODELOS = ["Clio", "Sandero", "Logan", "Duster", "Kwid", "Megane"];

/**
 * @param {{ conta: string, nome: string, quantidade?: number, agora?: string }} o
 * @returns leitura no formato de lerContasBF ({ lido_em, contas: { [conta]: {...} }, custos, falhas })
 */
export function montarLeituraExemplo({ conta, nome, quantidade = 40, agora = new Date().toISOString() }) {
  const itens = [];
  const tarifas = {};
  const fretes = {};
  const custos = {};
  for (let i = 0; i < quantidade; i++) {
    const [peca, base] = PECAS[i % PECAS.length];
    const tipo = i % 5; // 0 Renault original · 1 Renault paralela (compat) · 2 dúvida (título) · 3/4 demais
    const preco = centavos(base * (1 + (i % 4) * 0.07));
    const id = `MLB9${String(conta).slice(-3)}${String(1000 + i)}`;
    const sku = `EXEMPLO-${String(i + 1).padStart(3, "0")}`;
    const modelo = MODELOS[i % MODELOS.length];
    const item = {
      id, seller_id: Number(conta), title: `[EXEMPLO] ${peca}${tipo === 2 ? ` ${modelo}` : ""}`, price: preco, original_price: null,
      status: "active", condition: i % 17 === 16 ? "used" : "new", listing_type_id: i % 13 === 12 ? "free" : "gold_special", category_id: "MLB-EXEMPLO",
      available_quantity: i % 9 === 8 ? 0 : 1 + ((i * 7) % 25), sold_quantity: i % 6 === 5 ? null : (i * 37) % 180,
      permalink: "", seller_custom_field: sku, shipping: { free_shipping: preco >= 79, logistic_type: "xd_drop_off" },
      attributes: tipo === 0 ? [{ id: "BRAND", value_name: "Renault" }] : [{ id: "BRAND", value_name: "Marca Exemplo" }],
    };
    const compat = tipo === 1 ? { lido: true, quantidade: 2, marcas: ["renault", "nissan"], legivel: true } : { lido: true, quantidade: 0, marcas: [], legivel: true };
    const pct = tipo === 0 || tipo === 1 || tipo === 2 ? DESCONTOS.renault : DESCONTOS.demais;
    const pf = precoComDesconto(preco, pct);
    tarifas[`${centavos(pf).toFixed(2)}|${item.listing_type_id}|${item.category_id}`] = { valor: centavos(pf * 0.16 + (pf < 79 ? 6.25 : 0)) };
    fretes[`${id}|atual`] = { ok: true, custo_vendedor: preco >= 79 ? 22.9 : 0 };
    fretes[`${id}|${pf.toFixed(2)}`] = { ok: true, custo_vendedor: pf >= 79 ? 22.9 : 0 };
    // Custo da peça: alguns sem custo (margem não verificada), um com prejuízo.
    if (i % 7 !== 3) custos[sku] = { ok: true, encontrado: true, formato: "S", custo: { fornecedores: [{ padrao: true, precoCusto: centavos(i % 11 === 10 ? preco * 0.95 : preco * (0.35 + (i % 5) * 0.06)) }] } };
    itens.push({ item, compat, promocoes: { lido: true, ativas: [], candidatas: [] }, precoVenda: null });
  }
  return {
    exemplo: true, lido_em: agora, falhas: [], custos,
    contas: { [String(conta)]: { conta: String(conta), nome, itens, tarifas, fretes, lidos: itens.length, total_ativos: itens.length, completa: true, lido_em: agora, exemplo: true } },
  };
}
