// =============================================================
// PAIIA — TESTES (18/11/2026): relatório de IMPRESSÃO da Auditoria por Anúncio (A4)
// e paridade com a planilha exportada. Sem rede.
//   node --test scripts/testes/relatorioImpressao.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const R = await import("../../src/services/paizinhoAuditoria/relatorioImpressao.js");
const T = await import("../../src/services/paizinhoAuditoria/textosAnuncio.js");
const ler = (f) => fs.readFileSync(path.join(RAIZ, f), "utf8");

const TITULO_LONGO = "Bobina De Ignição Renault Clio Kangoo Logan Sandero 1.0 1.6 8v 16v Original Bosch Com Garantia E Nota Fiscal Envio Imediato";
const anuncio = (i, extra = {}) => ({ item_id: `MLB${1000 + i}`, vendedor_id: "2412238242", sku: `SKU${i}`, titulo: `Peça ${i}`, preco: 100 + i, custo: 50, margem_pct: 20, visitas30: 10, vendas30: 1, fotos: 6, compat: 12, frete_gratis: false, link: `https://x/${i}`, achados: [{ severidade: "media", problema: `Problema ${i}`, sugestao: `Corrigir ${i}` }], ...extra });
const REL = {
  conta: { id: "2412238242", nome: "REVELAÇÃO" }, gerado_em: "2026-11-18T13:05:00Z",
  anuncios: [
    anuncio(1, { sku: "9091902258", titulo: TITULO_LONGO, preco: 110, custo: null, margem_pct: null, ultima_compra: { valor: 55, data: "2025-12-22", pedido: "306", quantidade: 10, fonte: "Pedido de compra no Bling (atendido)" }, margem_estimada_pct: 18.3, margem_estimada_com_imposto: false, frete_gratis: true, frete_vendedor: 16.15,
      achados: [{ severidade: "baixa", problema: "Poucas palavras", sugestao: "Incluir aplicação" }, { severidade: "alta", problema: "Custo zerado no Bling", sugestao: "Cadastrar custo do fornecedor" }, { positivo: true, problema: "Boas fotos" }] }),
    ...Array.from({ length: 44 }, (_, k) => anuncio(k + 2)),
    anuncio(99, { achados: [] }),
    anuncio(98, { vendedor_id: "824312524" }),
  ],
};

test("imprime TODOS os anúncios do filtro (não só os 30 da tela), na mesma ordem da tela", () => {
  const html = R.htmlRelatorioImpressao(REL, { filtro: "problemas", agora: "2026-11-18T15:00:00Z" });
  const n = (html.match(/<section class="anuncio">/g) || []).length;
  assert.equal(n, 46, "46 com problema (45 + CIEBR); o sem problema fica fora");
  assert.equal(R.filtrarAnuncios(REL, "problemas").length, 46);
  assert.equal(R.filtrarAnuncios(REL, "todos").length, 47);
  assert.equal(R.filtrarAnuncios(REL, "urgentes").length, 1);
  assert.equal(R.filtrarAnuncios(REL, "sem_custo").length, 1);
  assert.equal(R.filtrarAnuncios(REL, "problemas")[0].item_id, "MLB1001", "urgente primeiro");
  assert.equal((R.htmlRelatorioImpressao(REL, { filtro: "todos" }).match(/<section class="anuncio">/g) || []).length, 47);
  assert.equal((R.htmlRelatorioImpressao(REL, { filtro: "todos", busca: "9091902258" }).match(/<section class="anuncio">/g) || []).length, 1);
});

test("A4, fundo branco, letras escuras, cabeçalho com empresa, conta e data", () => {
  const html = R.htmlRelatorioImpressao(REL, { filtro: "problemas", agora: "2026-11-18T15:00:00Z" });
  assert.match(html, /@page\{size:A4 portrait/);
  assert.match(html, /html,body\{background:#fff;color:#111/);
  assert.match(html, /break-inside:avoid/, "anúncio não é cortado entre páginas");
  assert.match(html, /<h1>Casa da Injeção Brasil<\/h1>/);
  assert.match(html, /<b>Conta Mercado Livre:<\/b> REVELAÇÃO, CIEBR/);
  assert.match(html, /<b>Data da auditoria:<\/b> 18\/11\/2026, 10:05/);
  assert.match(html, /<b>Filtro:<\/b> Com problema/);
});

test("cada anúncio: conta certa, MLB, SKU, título COMPLETO, custos separados, margem, frete, números", () => {
  const html = R.htmlRelatorioImpressao(REL, { filtro: "todos" });
  const bloco = html.split('<section class="anuncio">').find((b) => b.includes("MLB1001"));
  assert.ok(bloco.includes('<span class="conta">REVELAÇÃO</span>'));
  assert.ok(bloco.includes("SKU: 9091902258"));
  assert.ok(bloco.includes(`<div class="titulo">${TITULO_LONGO}</div>`), "título inteiro, sem corte");
  assert.ok(bloco.includes("Custo não informado"));
  assert.ok(bloco.includes("R$ 55,00 em 22/12/2025"));
  assert.ok(bloco.includes("Pedido de compra no Bling (atendido) nº 306 · 10 un."));
  assert.ok(bloco.includes("≈ 18,3% (estimativa, antes do imposto)"));
  assert.ok(bloco.includes("não é a margem definitiva"));
  assert.ok(bloco.includes("Grátis — vendedor paga R$ 16,15"));
  for (const c of ["Preço", "Custo cadastrado no Bling", "Custo da última compra", "Margem", "Frete", "Visitas (30 dias)", "Vendas (30 dias)", "Fotos", "Compatibilidades"]) assert.ok(bloco.includes(`<th>${c}</th>`), c);
  const ciebr = html.split('<section class="anuncio">').find((b) => b.includes("MLB1098"));
  assert.ok(ciebr.includes('<span class="conta">CIEBR</span>'), "conta do próprio anúncio");
  assert.equal(R.contaDoAnuncio({ vendedor_id: "1729335019" }, REL), "LOJA ONLINE");
});

test("TODOS os problemas com a correção (mesmo fechado na tela) e espaço de observações", () => {
  const html = R.htmlRelatorioImpressao(REL, { filtro: "urgentes" });
  assert.ok(html.indexOf("Custo zerado no Bling") < html.indexOf("Poucas palavras"), "urgente antes");
  assert.match(html, /Como corrigir: Cadastrar custo do fornecedor/);
  assert.match(html, /Como corrigir: Incluir aplicação/);
  assert.doesNotMatch(html, /Boas fotos/, "ponto positivo não entra como problema");
  assert.match(html, /Problemas encontrados e correção recomendada \(2\)/);
  assert.match(html, /Observações do funcionário/);
  assert.match(html, /Conferido por:/);
});

test("texto do anúncio não vira código na impressão", () => {
  const html = R.htmlRelatorioImpressao({ conta: { nome: "X" }, anuncios: [anuncio(1, { titulo: "<img src=x onerror=alert(1)>" })] }, { filtro: "todos" });
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test("planilha: mesmas informações essenciais do relatório, com a conta de cada anúncio e coluna de observações", () => {
  const csv = T.planilhaAuditoriaCSV(REL).replace(/^﻿/, "");
  const [cab, ...linhas] = csv.split("\r\n");
  for (const c of ["Conta", "MLB", "SKU", "Título", "Preço (R$)", "Custo cadastrado no Bling (R$)", "Última compra (R$)", "Data da última compra", "Fonte da última compra", "Margem definitiva (%)", "Margem estimada pela última compra (%)", "Visitas 30d", "Vendas 30d", "Fotos", "Compatibilidades", "Frete", "Problemas", "Como corrigir", "Observações do funcionário"]) assert.ok(cab.split(";").includes(c), c);
  assert.equal(linhas.length, 47, "planilha leva a auditoria completa");
  assert.ok(linhas.find((l) => l.includes("MLB1098")).startsWith("CIEBR;"));
  assert.ok(linhas.find((l) => l.includes("MLB1001")).startsWith("REVELAÇÃO;"));
  assert.ok(linhas.find((l) => l.includes("MLB1001")).includes(TITULO_LONGO));
  assert.equal(cab.split(";").length, linhas[0].split(";").length, "colunas alinhadas");
});

test("tela: Imprimir usa o relatório próprio com o filtro atual; nada mais muda", () => {
  const tela = ler("src/components/AuditoriaAnuncios.jsx");
  assert.match(tela, /onClick=\{\(\) => imprimir\(rel, filtro, busca\)\}/);
  assert.match(tela, /q\.srcdoc = htmlRelatorioImpressao\(rel, \{ filtro, busca \}\);/);
  assert.doesNotMatch(tela, /window\.print\(\)/, "não imprime mais a tela escura");
  assert.match(tela, /const lista = useMemo\(\(\) => filtrarAnuncios\(rel, filtro, busca\), \[rel, filtro, busca\]\);/, "tela e papel usam a mesma lista");
  const mod = ler("src/services/paizinhoAuditoria/relatorioImpressao.js");
  assert.doesNotMatch(mod, /fetch\(|supabase|blingGet|consultar/, "relatório não chama Bling, ML nem banco");
});
