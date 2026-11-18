// =============================================================
// PAIIA — TESTES (18/11/2026): custo da ÚLTIMA COMPRA no Bling (pedidos de compra atendidos)
// na auditoria do Paizinho. Sem rede (Bling falso).
//   node --test scripts/testes/ultimaCompraBling.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const U = await import("../../src/services/paizinhoAuditoria/ultimaCompra.js");
const T = await import("../../src/services/paizinhoAuditoria/textosAnuncio.js");
const ler = (f) => fs.readFileSync(path.join(RAIZ, f), "utf8");

const pedido = (id, data, situacao, itens) => ({ id, numero: String(id), data, situacao: { id: 0, valor: situacao }, itens });
const item = (prodId, valor, codigo, quantidade = 1) => ({ valor, quantidade, produto: { id: prodId, codigo } });

test("índice: só pedido ATENDIDO, item com valor, e a compra mais recente por produto", () => {
  const ix = U.indexarUltimasCompras([
    pedido(1, "2025-12-22", 1, [item(10, 55, "9091902258", 10)]),
    pedido(2, "2026-04-22", 1, [item(20, 51.5, "12663317", 40)]),
    pedido(3, "2026-05-01", 2, [item(20, 10, "12663317")]),          // cancelado: não conta
    pedido(4, "2026-06-01", 0, [item(20, 12, "12663317")]),          // em aberto: não conta
    pedido(5, "2026-03-01", 1, [item(20, 49, "12663317"), item(30, 0, "X")]), // mais antigo; item sem valor
  ]);
  assert.equal(ix.porId["10"].valor, 55);
  assert.equal(ix.porId["20"].valor, 51.5, "a mais recente atendida");
  assert.equal(ix.porId["20"].data, "2026-04-22");
  assert.equal(ix.porCodigo["12663317"].pedido, "2");
  assert.equal(ix.porId["30"], undefined, "item sem valor não vira custo");
  assert.equal(ix.resumo.ignorados.nao_atendido, 2);
  assert.equal(ix.resumo.ignorados.item_sem_valor, 1);
  assert.equal(ix.porId["20"].fonte, "Pedido de compra no Bling (atendido)");
});

test("busca: SÓ GET, do mais recente ao mais antigo, para quando acha todos, e continua em partes", async () => {
  const pedidos = [pedido(1, "2025-12-22", 1, [item(10, 55, "9091902258")]), pedido(2, "2026-04-22", 1, [item(20, 51.5, "12663317")]), pedido(9, "2024-01-01", 1, [item(10, 30, "9091902258")])];
  const chamadas = [];
  const blingGet = async (p) => {
    chamadas.push(p);
    if (p.startsWith("/pedidos/compras?")) return { data: pedidos.map(({ id, numero, data, situacao }) => ({ id, numero, data, situacao })) };
    const id = Number(p.split("/").pop());
    return { data: pedidos.find((x) => x.id === id) };
  };
  const r = await U.buscarUltimasCompras({ blingGet, skus: ["9091902258", "12663317"], desde: "2025-01-01", esperarMs: 0 });
  assert.equal(r.ultimas["9091902258"].valor, 55, "pedido de 2024 (fora do período) não entra");
  assert.equal(r.ultimas["12663317"].valor, 51.5);
  assert.ok(chamadas.every((c) => c.startsWith("/pedidos/compras")), "só lê pedidos de compra");
  // em partes: tempo zero → devolve 'proximo' para continuar
  const parte = await U.buscarUltimasCompras({ blingGet, skus: ["9091902258"], desde: "2025-01-01", esperarMs: 0, limiteMs: -1 });
  assert.equal(parte.parcial, true);
  assert.equal(parte.proximo, 0);
  const sem = await U.buscarUltimasCompras({ blingGet, skus: ["NAO-EXISTE"], desde: "2025-01-01", esperarMs: 0 });
  assert.equal(sem.ultimas["NAO-EXISTE"], null, "sem compra = continua sem custo");
  assert.equal(U.textoUltimaCompra({ valor: 51.5, data: "2026-04-22" }), "R$ 51,50 em 22/04/2026");
});

test("custo cadastrado continua o principal; última compra só dá margem ESTIMADA (nunca definitiva)", () => {
  const an = ler("src/services/paizinhoAuditoria/analise.js");
  assert.match(an, /f\.margem_estimada = !f\.custo && f\.ultima_compra\?\.valor > 0 \? margemPorVenda\(\{ \.\.\.f, custo: f\.ultima_compra\.valor \}, cfg\) : null;/);
  assert.match(an, /f\.margem = margemPorVenda\(f, cfg\);/, "margem definitiva continua só com o custo cadastrado");
  const col = ler("src/services/paizinhoAuditoria/coleta.js");
  assert.match(col, /const semCusto = Object\.keys\(custos\)\.filter\(\(s\) => !\(escolherCusto\(custos\[s\]\)\.custo > 0\)\);/, "só procura compra para quem NÃO tem custo cadastrado");
  assert.equal(T.textoCusto({ custo: 0, ultima_compra: { valor: 55 } }), "Custo não informado", "a última compra não vira custo cadastrado");
  assert.equal(T.textoMargemEstimada({ margem_estimada_pct: 24.6, margem_estimada_com_imposto: true }), "≈ 24,6% (estimativa)");
  assert.equal(T.textoMargemEstimada({ margem_estimada_pct: null }), "");
});

test("exportar: planilha com custo cadastrado, última compra (valor, data, fonte), margens separadas e correções", () => {
  const csv = T.planilhaAuditoriaCSV({ conta: { nome: "REVELAÇÃO" }, anuncios: [
    { item_id: "MLB1", sku: "12663317", titulo: "Sonda", preco: 109.29, custo: null, ultima_compra: { valor: 51.5, data: "2026-04-22", pedido: "340", fonte: "Pedido de compra no Bling (atendido)" }, margem_pct: null, margem_estimada_pct: 12.3, visitas30: 41, vendas30: 1, fotos: 7, compat: 71, frete_gratis: true, frete_vendedor: 16.15, achados: [{ problema: "Código fora do título", sugestao: "Incluir o código" }] },
    { item_id: "MLB2", sku: "X", titulo: "Y", preco: 10, custo: 5, margem_pct: 20, achados: [] },
  ] });
  const [cab, l1, l2] = csv.replace(/^﻿/, "").split("\r\n");
  assert.ok(cab.includes("Custo cadastrado no Bling (R$);Situação do custo;Última compra (R$);Data da última compra;Fonte da última compra;Margem definitiva (%);Margem estimada pela última compra (%)"));
  assert.ok(l1.includes(";;Custo não informado;51,50;22/04/2026;Pedido de compra no Bling (atendido) nº 340;;12.3;"));
  assert.ok(l1.includes("Código fora do título;Incluir o código"));
  assert.ok(l2.includes(";5,00;cadastrado;;;;20;;"), "com custo cadastrado, a estimativa não aparece");
});

test("função do servidor: só GET no Bling, login obrigatório, não renova nem devolve token", () => {
  const fn = ler("supabase/functions/paizinho-bling-compras/index.ts");
  assert.match(fn, /if \(!usuarioId\) return responder\(\{ ok: false, erro: "Entre no PAIIA\." \}, 401\);/);
  assert.doesNotMatch(fn, /method:\s*"(POST|PUT|PATCH|DELETE)"/, "nenhuma escrita no Bling");
  assert.doesNotMatch(fn, /refresh_token|\.update\(|\.insert\(|\.upsert\(/, "não renova acesso nem grava no banco");
  assert.match(fn, /eq\("usuario_id", usuarioId\)\.eq\("marketplace", "bling"\)/, "só o Bling do próprio usuário");
  const tela = ler("src/components/AuditoriaAnuncios.jsx");
  assert.match(tela, /📥 Exportar relatório/);
  assert.match(tela, /<strong>Custo cadastrado no Bling:<\/strong>/);
  assert.match(tela, /<strong>Última compra encontrada:<\/strong>/);
  assert.match(tela, /não é a margem definitiva/);
});
