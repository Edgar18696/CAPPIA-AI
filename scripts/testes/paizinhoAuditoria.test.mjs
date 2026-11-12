// =============================================================
// PAIIA — TESTES (10/11/2026): Central do Paizinho — Auditoria Comercial
// (piloto LOJA ONLINE). ML e Bling FALSOS (sem rede), no formato real da API.
//   node --test scripts/testes/paizinhoAuditoria.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { executarAuditoria, contaLiberada, CONTAS_AUDITORIA } = await import("../../src/services/paizinhoAuditoria/index.js");
const { margemPorVenda, medidasDoAnuncio, ehRenault } = await import("../../src/services/paizinhoAuditoria/analise.js");

const { CONTA, AGORA, ITENS, mlFalso, blingFalso } = await import("./apoio/paizinhoAuditoriaFalso.mjs");

async function rodar(extra = {}) {
  const ml = mlFalso();
  const rel = await executarAuditoria({ conta: CONTA, consultar: ml.consultar, consultarBling: blingFalso, agora: AGORA, ...extra });
  return { rel, ml };
}
const achadosDe = (rel, id) => rel.secoes.flatMap((s) => s.achados).filter((a) => a.item_id === id);

test("piloto: só a conta LOJA ONLINE está liberada; outra conta é recusada", async () => {
  assert.deepEqual(CONTAS_AUDITORIA.map((c) => c.id), [CONTA]);
  assert.equal(contaLiberada("1729335019")?.nome, "LOJA ONLINE");
  await assert.rejects(() => executarAuditoria({ conta: "123", consultar: mlFalso().consultar }), /não liberada/);
  await assert.rejects(() => executarAuditoria({ conta: "", consultar: mlFalso().consultar }), /não liberada/);
});

test("somente leitura: só caminhos GET, nunca método ou corpo; anúncio de outra conta descartado", async () => {
  const { rel, ml } = await rodar();
  assert.ok(ml.caminhos.length > 10);
  for (const c of ml.caminhos) {
    assert.equal(typeof c.caminho, "string");
    assert.deepEqual(c.resto, [], "consultar recebe só o caminho (sem método/corpo)");
  }
  assert.equal(rel.resumo.descartados_outra_conta, 1);
  assert.ok(!rel.anuncios.some((a) => a.item_id === "MLB9"));
  assert.equal(rel.conta.id, CONTA);
  assert.equal(rel.conta.nome, "LOJA ONLINE");
  assert.equal(rel.data_referencia, "2026-11-11");
});

test("margem com custo do Bling: prejuízo calculado e impacto pelas vendas de 30 dias", async () => {
  const { rel } = await rodar();
  const a = achadosDe(rel, "MLB1").find((x) => x.area === "margem");
  assert.equal(a.severidade, "alta");
  assert.match(a.problema, /PREJUÍZO de R\$ 14,00 por venda \(antes dos impostos\)/);
  assert.equal(a.impacto_rs, -28); // 2 vendas
  // Com imposto informado o cálculo inclui o imposto
  const { rel: r2 } = await rodar({ config: { impostoPercentual: 6 } });
  const b = achadosDe(r2, "MLB1").find((x) => x.area === "margem");
  assert.match(b.problema, /PREJUÍZO de R\$ 20,00 por venda: .*imposto R\$ 6,00/);
});

test("custo pelo custo_por_sku (só leitura): vazio/0 = sem custo; fornecedor padrão; >20% de diferença = a confirmar", async () => {
  const { escolherCusto } = await import("../../src/services/paizinhoAuditoria/analise.js");
  const resp = (fornecedores, fp = 0) => ({ ok: true, encontrado: true, custo: { fornecedor_precoCusto: fp, fornecedores } });
  // Casos reais de 12/11 (SKU 036919081c: padrão 13,50; outros 9,00 e 11,83 → 50% de diferença)
  const cebolinha = escolherCusto(resp([{ padrao: true, precoCusto: 13.5 }, { padrao: false, precoCusto: 9 }, { padrao: false, precoCusto: 11.83 }], 13.5));
  assert.equal(cebolinha.custo, 13.5);
  assert.equal(cebolinha.a_confirmar, true);
  assert.deepEqual(cebolinha.faixa, [9, 13.5]);
  // SKU 51846314: 27,98 padrão e 29,49 (5%) → confiável
  const resistencia = escolherCusto(resp([{ padrao: true, precoCusto: 27.98 }, { padrao: false, precoCusto: 29.49 }], 27.98));
  assert.deepEqual([resistencia.custo, resistencia.a_confirmar], [27.98, false]);
  // SKU 7750350109: 0 e sem fornecedores → SEM custo (nunca zero)
  const vazio = escolherCusto(resp([], 0));
  assert.equal(vazio.custo, null);
  assert.match(vazio.motivo, /vazio/);
  // Custo só em fornecedor não padrão → sem custo, a confirmar
  const naoPadrao = escolherCusto(resp([{ padrao: false, precoCusto: 20 }], 0));
  assert.deepEqual([naoPadrao.custo, naoPadrao.a_confirmar], [null, true]);
  assert.equal(escolherCusto({ ok: true, encontrado: false }).custo, null);
  assert.equal(escolherCusto({ ok: true, encontrado: true, ambiguo: true }).custo, null);

  // Na auditoria: MLB1 com custo 80 confirmado → mesmo prejuízo de antes (R$ 28)
  const custoDe = (mapa) => async (sku) => (sku in mapa ? { ok: true, encontrado: true, custo: { fornecedor_precoCusto: 0, fornecedores: mapa[sku] } } : { ok: true, encontrado: true, custo: { fornecedor_precoCusto: 0, fornecedores: [] } });
  const semCustoNoProduto = async (sku) => { const r = await blingFalso(sku); return r.produto ? { ...r, produto: { ...r.produto, precoCusto: undefined } } : r; };
  const { rel: r1 } = await rodar({ consultarBling: semCustoNoProduto, consultarCusto: custoDe({ "SKU-MLB1": [{ padrao: true, precoCusto: 80 }] }) });
  assert.equal(r1.resumo.prejuizo_estimado_30d, 28);
  assert.equal(r1.resumo.anuncios_com_custo, 1);
  assert.ok(r1.limitacoes.some((l) => /Preço de custo no Bling em 1 de 6 anúncios/.test(l)));
  assert.ok(achadosDe(r1, "MLB4").some((a) => a.area === "margem" && /Sem custo para a margem: preço de custo vazio no Bling/.test(a.problema)), "vazio nunca vira zero");
  // Mesmo custo, mas fornecedores divergentes → "possível prejuízo", fora do prejuízo confirmado
  const { rel: r2 } = await rodar({ consultarBling: semCustoNoProduto, consultarCusto: custoDe({ "SKU-MLB1": [{ padrao: true, precoCusto: 80 }, { padrao: false, precoCusto: 50 }] }) });
  assert.equal(r2.resumo.prejuizo_estimado_30d, null, "custo a confirmar não entra no prejuízo confirmado");
  assert.equal(r2.resumo.prejuizo_a_confirmar_30d, 28);
  const a2 = achadosDe(r2, "MLB1").find((a) => a.area === "margem");
  assert.equal(a2.severidade, "media");
  assert.equal(a2.impacto_rs, null);
  assert.match(a2.problema, /^Possível prejuízo .*custo a confirmar \(fornecedores: R\$ 50,00 a R\$ 80,00\)/);
});

test("margem: sem tarifa oficial ou sem custo NÃO calcula (nunca estima)", () => {
  const f = { custo: 50, preco: 100, tarifa: null, frete: { vendedor: 10 } };
  assert.equal(margemPorVenda(f, {}), null);
  assert.equal(margemPorVenda({ ...f, custo: null, tarifa: { valor: 10 } }, {}), null);
});

test("Renault sem custo: compara com tabela e concorrência, recomenda MANTER e não calcula margem", async () => {
  assert.equal(ehRenault(ITENS.MLB2), true);
  const conc = async (it) => (it.id === "MLB2" ? { ok: true, faixaComparavel: { minimo: 100, media: 115, maximo: 140, quantidade: 4 } } : { ok: false, erro: "fora do alvo" });
  const { rel } = await rodar({ precoTabelaRenault: ({ codigo }) => (codigo === "8200000001" ? 120 : null), buscarConcorrentes: conc });
  const a = achadosDe(rel, "MLB2");
  assert.ok(!a.some((x) => x.area === "margem"), "nenhuma margem para Renault sem custo");
  const r = a.find((x) => x.area === "renault");
  assert.equal(r.recomendacao, "manter");
  assert.match(r.sugestao, /MANTER/);
  assert.match(r.problema, /margem NÃO calculada/);
  const linha = rel.renault.find((x) => x.item_id === "MLB2");
  assert.equal(linha.tabela_renault, 120);
  assert.equal(linha.recomendacao, "manter");
  // Acima da tabela → revisar
  const { rel: r2 } = await rodar({ precoTabelaRenault: () => 90 });
  assert.equal(achadosDe(r2, "MLB2").find((x) => x.area === "renault").recomendacao, "revisar");
  // Sem tabela e sem concorrência → dados insuficientes
  const { rel: r3 } = await rodar();
  assert.equal(achadosDe(r3, "MLB2").find((x) => x.area === "renault").recomendacao, "dados insuficientes");
});

test("frete e medidas: sem medidas → classificação 'Medidas ausentes' (sem inventar valores)", async () => {
  assert.equal(medidasDoAnuncio(ITENS.MLB3), null);
  const { rel } = await rodar();
  const a = achadosDe(rel, "MLB3").filter((x) => x.area === "frete");
  assert.equal(a.length, 1, "um único alerta de frete por anúncio");
  assert.match(a[0].problema, /^Medidas ausentes/);
  assert.equal(a[0].classificacao, "medidas_ausentes");
  const linha = rel.fretes_medidas.find((l) => l.item_id === "MLB3");
  assert.equal(linha.medidas_anuncio, "não cadastradas");
  assert.equal(linha.sku, "SKU-MLB3");
  assert.equal(linha.classificacao, "medidas_ausentes");
  assert.equal(linha.conferencia, "pendente");
  assert.equal(rel.resumo.medidas_pendentes, 1);
  assert.equal(rel.resumo.fretes_medidas.medidas_ausentes, 1);
});

test("frete e medidas: divergência relevante ML x Bling recota e mostra impacto POTENCIAL (nunca prejuízo)", async () => {
  const { rel, ml } = await rodar();
  assert.ok(ml.caminhos.some((c) => c.caminho.includes("dimensions=30x30x30%2C300")), "recotação com as medidas do Bling");
  const a = achadosDe(rel, "MLB5").find((x) => x.area === "frete");
  assert.equal(a.classificacao, "divergencia_relevante");
  assert.match(a.problema, /Divergência relevante entre Mercado Livre e Bling — pendente de conferência física/);
  assert.match(a.problema, /Frete estimado hoje R\$ 20,00; com as medidas do Bling R\$ 32,00/);
  assert.match(a.problema, /cobrar até R\$ 12,00 a mais por envio \(estimado\)/);
  assert.match(a.sugestao, /corrigir o cadastro que estiver errado .*após aprovação/);
  assert.equal(a.impacto_rs, null, "diferença estimada nunca é prejuízo confirmado");
  const linha = rel.fretes_medidas.find((l) => l.item_id === "MLB5");
  assert.equal(linha.frete_com_bling, 32);
  assert.equal(linha.diferenca_por_envio, 12);
  assert.equal(linha.conferencia, "pendente");
  const vendas = rel.anuncios.find((x) => x.item_id === "MLB5").vendas30;
  assert.equal(linha.impacto_potencial_por_envio, 12);
  assert.equal(linha.impacto_potencial_30d, 12 * vendas);
  // Dados originais preservados
  assert.deepEqual(linha.dados_originais.bling, { peso_bruto: 0.3, peso_liquido: null, largura: 30, altura: 30, profundidade: 30 });
});

test("frete e medidas: cobrança nas vendas acima do estimado → alta, valor 'a conferir' (não é prejuízo confirmado)", async () => {
  const { rel } = await rodar();
  const a = achadosDe(rel, "MLB6").find((x) => x.area === "frete" && /acima do estimado/.test(x.problema));
  assert.equal(a.severidade, "alta");
  assert.equal(a.impacto_rs, null);
  assert.match(a.problema, /R\$ 30,00 a conferir/); // (35 − 20) × 2 envios
  const linha = rel.fretes_medidas.find((l) => l.item_id === "MLB6");
  assert.equal(linha.frete_real_medio, 35);
  assert.equal(linha.frete_vendedor, 20);
  assert.equal(linha.impacto_potencial_por_envio, 15);
  assert.deepEqual(linha.cobrado_acima_estimado, { media_cobrada: 35, estimado: 20, envios: 2, diferenca_total: 30 });
  assert.equal(rel.secoes.find((s) => s.chave === "frete").titulo, "Fretes e Medidas — Problemas Encontrados");
  // (12/11) Com Bling padronizado no mesmo anúncio, o texto começa pelo ponto mais grave (cobrança acima).
  const { rel: r2 } = await rodar({ consultarBling: async () => ({ ok: true, produto: { peso_bruto: 0.3, largura: 30, altura: 30, profundidade: 30 } }) });
  const a2 = achadosDe(r2, "MLB6").find((x) => x.area === "frete");
  assert.equal(a2.severidade, "alta");
  assert.match(a2.problema, /^Frete cobrado nas vendas/);
  assert.match(a2.problema, /Medidas possivelmente padronizadas no Bling/);
});

test("frete e medidas: Bling padronizado (mesma caixa em 5+ SKUs ou peso improvável) não é referência, mas o anúncio continua", async () => {
  const { analisarAnuncios, motivoBlingSuspeito, perfilBling } = await import("../../src/services/paizinhoAuditoria/analise.js");
  const ml = { comprimento_cm: 24, largura_cm: 18, altura_cm: 7, peso_g: 647 };
  const padrao = { comprimento_cm: 20, largura_cm: 20, altura_cm: 15, peso_g: 500 };
  const bling = {};
  for (let i = 0; i < 5; i++) bling[`P${i}`] = { peso_bruto: 0.5, largura: 20, altura: 15, profundidade: 20 };
  const perfil = perfilBling({ bling });
  assert.match(motivoBlingSuspeito(padrao, ml, perfil), /se repetem em 5 SKUs/);
  assert.match(motivoBlingSuspeito({ ...ml, peso_g: 500000 }, ml, { contagem: {} }), /improvável/);
  assert.equal(motivoBlingSuspeito({ ...ml, peso_g: 700 }, ml, { contagem: {} }), null, "medida única e plausível é confiável");
  // (12/11) Caso real: Bling 150 × 80 × 50 cm · 1 kg para mangueira de 18 × 31 × 77 cm · 776 g.
  const mangueira = { comprimento_cm: 77, largura_cm: 31, altura_cm: 18, peso_g: 776 };
  assert.match(motivoBlingSuspeito({ comprimento_cm: 150, largura_cm: 80, altura_cm: 50, peso_g: 1000 }, mangueira, { contagem: {} }), /caixa do Bling 13× maior .*peso redondo \(1 kg\).*genérico/);
  assert.equal(motivoBlingSuspeito({ comprimento_cm: 150, largura_cm: 80, altura_cm: 50, peso_g: 1230 }, mangueira, { contagem: {} }), null, "caixa maior com peso exato não é descartada");
  assert.equal(motivoBlingSuspeito({ comprimento_cm: 80, largura_cm: 31, altura_cm: 20, peso_g: 1000 }, mangueira, { contagem: {} }), null, "peso redondo com caixa parecida continua valendo");
  // Na auditoria: o anúncio com Bling padronizado continua, sem recotação nem impacto.
  const { rel, ml: mlF } = await rodar({ consultarBling: async (sku) => (sku === "SKU-MLB5" ? { ok: true, produto: { peso_bruto: 0.3, largura: 30, altura: 30, profundidade: 30 } } : { ok: true, produto: { peso_bruto: 0.3, largura: 30, altura: 30, profundidade: 30 } }) });
  const l5 = rel.fretes_medidas.find((l) => l.item_id === "MLB5");
  assert.equal(l5.classificacao, "bling_padronizado");
  assert.equal(l5.bling_confiavel, false);
  assert.equal(l5.impacto_potencial_por_envio, null);
  assert.ok(!mlF.caminhos.some((c) => c.caminho.includes("dimensions=30x30x30")), "não recota com medida padronizada");
  assert.ok(rel.resumo.fretes_medidas.bling_padronizado >= 1);
  void analisarAnuncios;
});

test("frete e medidas: agrupado por SKU, maior impacto potencial primeiro", async () => {
  const { agruparFretesPorSku } = await import("../../src/services/paizinhoAuditoria/relatorio.js");
  const base = { titulo: "x", frete_gratis: true, frete_vendedor: 10, vendas30: null, impacto_potencial_30d: null };
  const grupos = agruparFretesPorSku([
    { ...base, item_id: "A1", sku: "S1", classificacao: "alerta_ml", impacto_potencial_por_envio: null },
    { ...base, item_id: "A2", sku: "S2", classificacao: "divergencia_relevante", impacto_potencial_por_envio: 30 },
    { ...base, item_id: "A3", sku: "S1", classificacao: "medidas_ausentes", impacto_potencial_por_envio: 5 },
  ]);
  assert.deepEqual(grupos.map((g) => g.sku), ["S2", "S1"]);
  assert.equal(grupos[1].anuncios.length, 2, "dois anúncios do mesmo SKU em um grupo só");
  assert.equal(grupos[1].classificacao, "medidas_ausentes");
  assert.deepEqual(grupos[1].classificacoes, ["medidas_ausentes", "alerta_ml"]);
  // Com vendas lidas, o volume de vendas pesa na ordem.
  const g2 = agruparFretesPorSku([
    { ...base, item_id: "B1", sku: "T1", vendas30: 1, impacto_potencial_por_envio: 20, impacto_potencial_30d: 20 },
    { ...base, item_id: "B2", sku: "T2", vendas30: 10, impacto_potencial_por_envio: 5, impacto_potencial_30d: 50 },
  ]);
  assert.deepEqual(g2.map((g) => g.sku), ["T2", "T1"]);
  // (12/11) Custo real de hoje (alta) vem antes de qualquer estimativa que depende do Bling.
  const g3 = agruparFretesPorSku([
    { ...base, item_id: "C1", sku: "U1", severidade: "media", impacto_potencial_por_envio: 128 },
    { ...base, item_id: "C2", sku: "U2", severidade: "alta", impacto_potencial_por_envio: null, frete_vendedor: 55.15 },
  ]);
  assert.deepEqual(g3.map((g) => g.sku), ["U2", "U1"]);
  assert.equal(g3[0].severidade, "alta");
  const { ordenarAchados } = await import("../../src/services/paizinhoAuditoria/relatorio.js");
  const ord = ordenarAchados([
    { titulo: "a", severidade: "media", impacto_potencial_por_envio: 128 },
    { titulo: "b", severidade: "alta", impacto_rs: null },
  ]);
  assert.equal(ord[0].titulo, "b");
  const { rel } = await rodar();
  assert.equal(rel.fretes_por_sku.length, new Set(rel.fretes_medidas.map((l) => l.sku)).size);
  // Sem título repetido ("Medidas ausentes: Medidas ausentes: ...").
  const textos = rel.secoes.flatMap((s) => s.achados).map((a) => a.problema);
  assert.ok(!textos.some((t) => /^(Medidas ausentes|Divergências? relevantes? entre Mercado Livre e Bling|Medidas possivelmente padronizadas no Bling)[^:]*: \1/.test(t)), "título não se repete");
  assert.ok(!textos.some((t) => /^Medidas ausentes: Medidas ausentes/.test(t)));
});

test("frete pago pelo vendedor alto em relação ao preço", async () => {
  // Padrão: 20% do preço é normal (não vira aviso); acima de 30% = atenção, 40% = urgente.
  const { rel } = await rodar();
  assert.ok(!achadosDe(rel, "MLB1").some((x) => /consome/.test(x.problema)));
  const { rel: r2 } = await rodar({ config: { freteAltoPct: 15, freteCriticoPct: 25 } });
  const a = achadosDe(r2, "MLB1").find((x) => /consome 20% do preço/.test(x.problema));
  assert.equal(a.severidade, "media");
});

test("conteúdo, vendas e estoque", async () => {
  const { rel } = await rodar();
  const m4 = achadosDe(rel, "MLB4");
  assert.ok(m4.some((x) => /Título curto/.test(x.problema)));
  assert.ok(m4.some((x) => /código 0261210170 não está no título/.test(x.problema)));
  assert.ok(m4.some((x) => x.area === "estoque" && x.severidade === "media" && /Estoque para ~10 dia\(s\): 1 un\. e 3 vendida/.test(x.problema)));
  const m3 = achadosDe(rel, "MLB3");
  assert.ok(m3.some((x) => x.area === "vendas" && /200 visitas em 30 dias e nenhuma venda/.test(x.problema) && x.severidade === "alta"));
  const m5 = achadosDe(rel, "MLB5");
  assert.ok(m5.some((x) => x.area === "vendas" && /Só 5 visita/.test(x.problema)));
});

test("relatório: resumo, prioridades ordenadas, limitações honestas e regras", async () => {
  const { rel } = await rodar();
  assert.equal(rel.resumo.anuncios_analisados, 6);
  assert.equal(rel.resumo.unidades_vendidas_30d, 7);
  assert.equal(rel.resumo.visitas_30d, 415);
  // Prejuízo = só o calculado com custo real (margem do MLB1: R$ 14 × 2). Frete estimado não entra.
  assert.equal(rel.resumo.prejuizo_estimado_30d, 28);
  // (12/11) Faturamento = valor real dos pedidos pagos (R$ 100 por venda no falso), não vendas × preço atual.
  assert.equal(rel.resumo.faturamento_30d, 700);
  for (const a of rel.anuncios) assert.equal(a.faturamento30, a.vendas30 * 100, `${a.item_id}: valor dos pedidos`);
  const { faturarVendidos } = await import("../../src/services/paizinhoAuditoria/coleta.js");
  const agoraF = "2026-11-11T20:00:00.000Z";
  const ped = (st, dias, qtd, preco, id = "MLB9") => ({ status: st, date_created: new Date(Date.parse(agoraF) - dias * 86400000).toISOString(), order_items: [{ item: { id }, quantity: qtd, unit_price: preco }] });
  assert.deepEqual(faturarVendidos([ped("paid", 3, 5, 24.5), ped("paid", 10, 2, 24.5), ped("cancelled", 2, 1, 24.5), ped("paid", 40, 1, 39.9)], agoraF, 30), { MLB9: 171.5 }, "só pagos, só 30 dias, preço da venda");
  // Prioridades: maior impacto financeiro (calculado ou potencial) primeiro.
  const imp = (a) => Math.max(Math.abs(a.impacto_rs || 0), a.impacto_potencial_30d ?? a.impacto_potencial_por_envio ?? 0);
  for (let i = 1; i < rel.prioridades.length; i++) assert.ok(imp(rel.prioridades[i - 1]) >= imp(rel.prioridades[i]));
  assert.ok(rel.limitacoes.some((l) => /Concorrência não pesquisada/.test(l)));
  assert.ok(rel.limitacoes.some((l) => /antes dos impostos/.test(l)));
  assert.ok(rel.regras.some((r) => /Somente leitura/.test(r)));
  assert.ok(JSON.stringify(rel).length < 2_000_000);
});

test("falha de leitura não derruba a auditoria: fica registrada", async () => {
  const ml = mlFalso();
  const consultar = async (c) => (c.startsWith("/sites/MLB/listing_prices") ? { ok: false, status: 500, erro: "instável" } : ml.consultar(c));
  const rel = await executarAuditoria({ conta: CONTA, consultar, agora: AGORA });
  assert.ok(rel.falhas.some((f) => f.etapa === "tarifa de venda"));
  assert.ok(!achadosDe(rel, "MLB1").some((x) => x.area === "margem" && /PREJUÍZO/.test(x.problema)), "sem tarifa oficial não calcula margem");
  assert.ok(rel.limitacoes.some((l) => /Bling não consultado/.test(l)));
});

test("sessão do PAIIA expira no meio (Bling e recotação): para, avisa leitura parcial e não chama de 'não consultado'", async () => {
  // Situação real de 12/11/2026: o login caiu após ~460 SKUs e todas as recotações falharam em silêncio.
  const SESSAO = { ok: false, status: 401, erro: "Usuário não autenticado. Entre novamente no PAIIA." };
  let blingChamadas = 0;
  const blingCaindo = async (sku) => (++blingChamadas <= 1 ? blingFalso(sku) : SESSAO);
  const ml = mlFalso();
  let recotacoes = 0;
  const consultar = async (c) => {
    if (c.includes("shipping_options/free") && c.includes("dimensions=30x30x30")) { recotacoes++; return SESSAO; }
    return ml.consultar(c);
  };
  const rel = await executarAuditoria({ conta: CONTA, consultar, consultarBling: blingCaindo, agora: AGORA, opcoesColeta: { paraleloBling: 1 } });
  const li = rel.leitura_incompleta;
  assert.ok(li, "relatório marca leitura incompleta");
  assert.equal(li.bling.motivo, "sessao");
  assert.equal(li.bling.lidos, 1);
  assert.ok(li.bling.total > 1);
  assert.equal(blingChamadas, 2, "parou na 1ª recusa de sessão (sem nova tentativa nem insistência)");
  assert.equal(li.sessao_expirada, true);
  assert.ok(rel.limitacoes.some((l) => /Bling lido só em 1 de \d+ SKUs \(a sessão do PAIIA expirou/.test(l)));
  assert.ok(!rel.limitacoes.some((l) => /Bling não consultado nesta execução/.test(l)), "leitura parcial não vira 'não consultado'");
  assert.ok(rel.falhas.some((f) => f.etapa === "Bling" && /não autenticado/.test(f.exemplo)));

  // Recotação: Bling inteiro, mas o login cai na hora de recotar.
  const r2 = await executarAuditoria({ conta: CONTA, consultar, consultarBling: blingFalso, agora: AGORA });
  assert.equal(r2.leitura_incompleta.recotacao.motivo, "sessao");
  assert.equal(r2.leitura_incompleta.recotacao.feitas, 0);
  assert.ok(r2.falhas.some((f) => f.etapa === "recotação do frete" && f.quantidade >= 1));
  assert.ok(r2.limitacoes.some((l) => /Frete recotado com as medidas do Bling em 0 de \d+ anúncios/.test(l)));
  // Leitura completa → sem aviso
  const { rel: completo } = await rodar();
  assert.equal(completo.leitura_incompleta, null);
});

test("leitura comercial (paizinho-leitura-ml): só visitas, vendas e custo de envio, só da conta do piloto", async () => {
  const { conferirLeituraComercial, ehLeituraComercial } = await import("../../src/services/paizinhoAuditoria/leituraComercial.js");
  const ok = (c, conta = CONTA) => conferirLeituraComercial(c, conta).ok;
  assert.ok(ok("/items/visits?ids=MLB1,MLB2&date_from=2026-10-12&date_to=2026-11-11"));
  assert.ok(ok("/items/MLB123/visits?date_from=2026-10-12&date_to=2026-11-11"));
  assert.ok(ok(`/orders/search?seller=${CONTA}&order.date_created.from=2026-09-12T00%3A00%3A00.000-00%3A00&sort=date_desc&limit=50&offset=0`));
  assert.ok(ok("/shipments/4455/costs"));
  // Nunca: outra conta, outro vendedor, escrita disfarçada, outros endereços
  assert.equal(ok("/shipments/4455/costs", "123"), false, "conta fora do piloto");
  assert.equal(ok("/orders/search?seller=999&limit=50"), false, "pedidos de outro vendedor");
  assert.equal(ok(`/orders/search?seller=${CONTA}&seller=999`), false, "dois vendedores");
  assert.equal(ok("/items/MLB1"), false);
  assert.equal(ok("/users/me"), false);
  assert.equal(ok("/answers"), false);
  assert.equal(ok("/items/visits?ids=MLB1&date_from=2026-10-12&date_to=2026-11-11&x=../users"), false);
  assert.equal(ehLeituraComercial("/items/MLB1/description"), false);
  // Visitas só de anúncios da própria conta: a função confere o vendedor antes.
  const { anunciosDaLeitura, caminhosDonoDosAnuncios, anunciosSaoDaConta } = await import("../../src/services/paizinhoAuditoria/leituraComercial.js");
  const ids = Array.from({ length: 45 }, (_, i) => `MLB${i + 1}`);
  assert.deepEqual(anunciosDaLeitura(`/items/visits?ids=${ids.join(",")}&date_from=2026-10-12&date_to=2026-11-11`), ids);
  assert.deepEqual(anunciosDaLeitura("/items/MLB9/visits?date_from=2026-10-12&date_to=2026-11-11"), ["MLB9"]);
  // (12/11) Um por anúncio: o ML descontinuou a leitura em grupo /items?ids=.
  assert.equal(caminhosDonoDosAnuncios(ids).length, 45);
  assert.equal(caminhosDonoDosAnuncios(ids)[0], "/items/MLB1?attributes=id,seller_id");
  assert.ok(!caminhosDonoDosAnuncios(ids).some((c) => c.startsWith("/items?ids=")));
  const resp = (lista) => lista.map(([id, seller]) => ({ id, seller_id: seller }));
  assert.equal(anunciosSaoDaConta(["MLB1", "MLB2"], resp([["MLB1", Number(CONTA)], ["MLB2", Number(CONTA)]]), CONTA), true);
  assert.equal(anunciosSaoDaConta(["MLB1", "MLB2"], resp([["MLB1", Number(CONTA)], ["MLB2", 999]]), CONTA), false, "um anúncio de outro vendedor bloqueia");
  assert.equal(anunciosSaoDaConta(["MLB1", "MLB3"], resp([["MLB1", Number(CONTA)]]), CONTA), false, "anúncio não confirmado bloqueia");
  assert.equal(anunciosSaoDaConta([], [], CONTA), false);
  // A função do servidor usa as mesmas regras e só faz GET
  const fonte = fs.readFileSync(path.join(RAIZ, "supabase/functions/paizinho-leitura-ml/index.ts"), "utf8");
  assert.match(fonte, /conferirLeituraComercial/);
  assert.match(fonte, /method: "GET"/);
  assert.ok(!/method: "(POST|PUT|DELETE|PATCH)"[^]*api\.mercadolibre|\.update\(|\.insert\(|\.delete\(|oauth\/token/.test(fonte), "não grava, não renova token, não escreve no ML");
});

test("teste local: vendas e visitas pela função nova; sem ela publicada, o motivo aparece e não insiste", async () => {
  const { roteadorConsultas } = await import("../../src/services/paizinhoAuditoria/leituraComercial.js");
  const ml = mlFalso();
  const RECUSA = { ok: false, erro: "Consulta fora da lista permitida (somente leitura)." };
  const principal = async (c) => (/\/visits|^\/orders\/search|^\/shipments\//.test(c) ? RECUSA : ml.consultar(c));
  let comercialChamadas = 0;
  const comercial = async (c) => { comercialChamadas++; return ml.consultar(c); };
  const rel = await executarAuditoria({ conta: CONTA, consultar: roteadorConsultas({ principal, comercial }), consultarBling: blingFalso, agora: AGORA });
  assert.ok(comercialChamadas > 0);
  assert.notEqual(rel.resumo.visitas_30d, null, "visitas lidas");
  assert.notEqual(rel.resumo.unidades_vendidas_30d, null, "vendas lidas");
  assert.notEqual(rel.resumo.conversao_30d, null);
  assert.ok(!rel.limitacoes.some((l) => /NÃO lidas/.test(l)));

  // (12/11) Visitas parciais (ML limitou): aviso claro, e a conversão só usa anúncios com visitas lidas.
  const LIMITE = { ok: false, status: 429, erro: "Mercado Livre limitou as consultas." };
  // O lote falha; um por um, só o MLB1 continua limitado (os demais respondem).
  const comercialParcial = async (c) => {
    if (c.startsWith("/items/visits?")) return LIMITE;
    const um = c.match(/^\/items\/(MLB\d+)\/visits\?/);
    if (um) return um[1] === "MLB1" ? LIMITE : { ok: true, dados: { item_id: um[1], total_visits: 10 } };
    return ml.consultar(c);
  };
  const rp = await executarAuditoria({ conta: CONTA, consultar: roteadorConsultas({ principal, comercial: comercialParcial }), consultarBling: blingFalso, agora: AGORA });
  const total = rp.resumo.anuncios_analisados;
  assert.ok(rp.limitacoes.some((l) => l === `Visitas lidas em ${total - 1} de ${total} anúncios (Mercado Livre limitou as consultas.): esses 1 ficam fora da conversão e das conclusões de visitas.`), rp.limitacoes.join("\n"));
  const fichasLidas = rp.anuncios.filter((a) => a.visitas30 !== null);
  const vis = fichasLidas.reduce((s, a) => s + a.visitas30, 0);
  const ven = fichasLidas.reduce((s, a) => s + a.vendas30, 0);
  assert.equal(rp.resumo.conversao_30d, Math.round((ven / vis) * 10000) / 100, "conversão sem o anúncio de visita não lida");

  // (12/11) Vendas lidas, mas nenhum custo no Bling → prejuízo "sem custo", nunca R$ 0,00.
  const semCusto = async () => ({ ok: true, produto: { peso_bruto: 0.3, largura: 30, altura: 30, profundidade: 30 } });
  const rc = await executarAuditoria({ conta: CONTA, consultar: roteadorConsultas({ principal, comercial }), consultarBling: semCusto, agora: AGORA });
  assert.equal(rc.resumo.anuncios_com_custo, 0);
  assert.equal(rc.resumo.prejuizo_estimado_30d, null);

  // Função ainda não publicada → "não lido" com o motivo certo, e poucas chamadas
  const { ERRO_FUNCAO_NAO_PUBLICADA, consultorComercial } = await import("../../src/services/paizinhoAuditoria/leituraComercial.js");
  let tentativas = 0;
  const naoPublicada = async () => { tentativas++; return { ok: false, status: 404, erro: ERRO_FUNCAO_NAO_PUBLICADA }; };
  const r2 = await executarAuditoria({ conta: CONTA, consultar: roteadorConsultas({ principal, comercial: naoPublicada }), consultarBling: blingFalso, agora: AGORA });
  assert.equal(r2.resumo.visitas_30d, null);
  assert.equal(r2.resumo.unidades_vendidas_30d, null);
  assert.ok(r2.limitacoes.some((l) => /Vendas NÃO lidas \(a função de leitura de vendas e visitas ainda não foi publicada\)/.test(l)));
  assert.ok(tentativas <= 12, `não insiste (${tentativas} chamadas)`);
  // Leitor do navegador: 404 = não publicada; falha de rede passageira NÃO vira "não publicada".
  const l404 = consultorComercial(CONTA, async () => ({ data: null, error: { message: "x", context: { status: 404 } } }));
  assert.equal((await l404("/shipments/1/costs")).erro, ERRO_FUNCAO_NAO_PUBLICADA);
  const lRede = consultorComercial(CONTA, async () => ({ data: null, error: { message: "Failed to send a request to the Edge Function" } }));
  assert.notEqual((await lRede("/shipments/1/costs")).erro, ERRO_FUNCAO_NAO_PUBLICADA);
  let corpoEnviado = null;
  const lOk = consultorComercial(CONTA, async (nome, op) => { corpoEnviado = { nome, ...op.body }; return { data: { ok: true, dados: { total_visits: 3 } }, error: null }; });
  assert.equal((await lOk("/items/MLB1/visits?date_from=2026-10-12&date_to=2026-11-11")).ok, true);
  assert.deepEqual(corpoEnviado, { nome: "paizinho-leitura-ml", conta: CONTA, caminho: "/items/MLB1/visits?date_from=2026-10-12&date_to=2026-11-11" });
});

test("servidor recusa perfil, lote, visitas e vendas: segue lendo um por um e NUNCA trata o não lido como zero", async () => {
  // Situação real de 11/11/2026 na LOJA ONLINE (lista permitida da mercadolivre-publicacao).
  const ml = mlFalso();
  const RECUSA = { ok: false, erro: "Consulta fora da lista permitida (somente leitura)." };
  const recusar = /^\/users\/\d+$|^\/items\?ids=|\/visits|^\/orders\/search/;
  let chamadasRecusadas = 0;
  const consultar = async (c) => {
    if (recusar.test(c.split("&")[0])) { chamadasRecusadas++; return RECUSA; }
    if (/^\/items\/MLB\d+$/.test(c)) {
      const it = Object.values(ITENS).find((x) => `/items/${x.id}` === c);
      return it ? { ok: true, dados: it } : { ok: false, status: 404, erro: "não encontrado" };
    }
    return ml.consultar(c);
  };
  const rel = await executarAuditoria({ conta: CONTA, consultar, consultarBling: blingFalso, agora: AGORA });
  assert.equal(rel.resumo.anuncios_analisados, 6, "detalhes lidos um por um");
  assert.equal(rel.resumo.descartados_outra_conta, 1, "seller_id continua separando as contas");
  assert.equal(rel.resumo.visitas_30d, null);
  assert.equal(rel.resumo.unidades_vendidas_30d, null);
  assert.equal(rel.resumo.conversao_30d, null);
  const todos = rel.secoes.flatMap((s) => s.achados);
  assert.ok(!todos.some((a) => /Produto parado|nenhuma venda|visita\(s\) em 30 dias/.test(a.problema)), "sem conclusões sobre o que não foi lido");
  assert.ok(rel.limitacoes.some((l) => /Vendas NÃO lidas/.test(l)));
  assert.ok(rel.limitacoes.some((l) => /Visitas NÃO lidas/.test(l)));
  // Só as consultas já em paralelo quando chega a 1ª recusa (limite = paralelismo, não nº de anúncios).
  assert.ok(chamadasRecusadas <= 12, `endereço recusado não é repetido (${chamadasRecusadas} chamadas)`);
  // Outra conta respondendo no perfil continua interrompendo
  const outra = async (c) => (/^\/users\/\d+$/.test(c) ? { ok: true, dados: { id: 999 } } : consultar(c));
  await assert.rejects(() => executarAuditoria({ conta: CONTA, consultar: outra, agora: AGORA }), /outra conta/);
});

test("Central: as 14 funções existentes continuam iguais", () => {
  const src = fs.readFileSync(path.join(RAIZ, "src/components/CentralPaizinho.jsx"), "utf8");
  const ids = [...src.matchAll(/^\s{4}id: "([a-z-]+)"/gm)].map((m) => m[1]);
  assert.deepEqual(ids, ["meus-custos", "prioridades", "nao-vende", "analisar-site", "concorrencia", "auditar", "compatibilidade", "melhorar-anuncio", "inativos", "estoque", "encalhados", "preco", "financeiro", "comecar"]);
});

test("visitas limitadas pelo ML: segunda passada, uma por vez; lida some das falhas, não lida continua 'não lido'", async () => {
  // Caso real de 12/11: 9 anúncios ficaram sem visitas na rodada e foram lidos depois, um por vez.
  const ml = mlFalso();
  const tentativas = {};
  const consultar = async (c) => {
    if (c.startsWith("/items/visits?")) return { ok: false, status: 429, erro: "too many requests" }; // grupo limitado
    const VIS = { MLB1: 80, MLB2: 40, MLB4: 30, MLB6: 60 };
    const um = c.match(/^\/items\/(MLB\d+)\/visits\?/);
    if (um) {
      const n = (tentativas[um[1]] = (tentativas[um[1]] || 0) + 1);
      if (um[1] in VIS) return { ok: true, status: 200, dados: { item_id: um[1], total_visits: VIS[um[1]] } };
      if (um[1] === "MLB3" && n >= 2) return { ok: true, status: 200, dados: { item_id: "MLB3", total_visits: 7 } };
      return { ok: false, status: 429, erro: "too many requests" };
    }
    return ml.consultar(c);
  };
  const rel = await executarAuditoria({ conta: CONTA, consultar, agora: AGORA, opcoesColeta: { pausaReleituraVisitasMs: 0 } });
  const an = (id) => rel.anuncios.find((a) => a.item_id === id);
  assert.equal(an("MLB3").visitas30, 7, "relida na segunda passada");
  assert.equal(an("MLB5").visitas30, null, "continua não lida (nunca vira zero)");
  assert.equal(an("MLB1").visitas30, 80);
  assert.equal(tentativas.MLB1, 1, "só relê quem faltou");
  assert.equal(tentativas.MLB3, 2);
  // Antes: 2 falhas (MLB3 e MLB5). Depois da segunda passada: só a do MLB5.
  assert.equal((rel.falhas || []).find((f) => f.etapa === "visitas")?.quantidade, 1, "falha do MLB3 sai da lista");
});

test("kit e par: produto simples no Bling → custo a confirmar; kit composto no Bling continua valendo", async () => {
  const { unidadesDoTitulo, conferirCustoDoKit } = await import("../../src/services/paizinhoAuditoria/analise.js");
  assert.equal(unidadesDoTitulo("Kit 4 Bicos Injetores I30 1.8 16v Flex 353102e100"), 4);
  assert.equal(unidadesDoTitulo("Par Válvula Solenoide Cabeçote Gm Tracker 1.8 - 55567050"), 2);
  assert.equal(unidadesDoTitulo("Kit Embreagem Gol 1.0"), 1, "kit sem número é um produto só");
  assert.equal(unidadesDoTitulo("Junta Válvula Termostatica Fiat Fire 1.0 - Para Uno"), 1, "'para' não é 'par'");
  const ok = { custo: 272, a_confirmar: false, faixa: null, motivo: "fornecedor padrão do Bling" };
  // Caso real 12/11: K4-35310-2e100 é composição ("E") no Bling: 4 × R$ 68 = R$ 272 → vale.
  assert.deepEqual(conferirCustoDoKit(ok, { formato: "E" }, "Kit 4 Bicos Injetores I30"), ok);
  const simples = conferirCustoDoKit({ ...ok, custo: 68 }, { formato: "S" }, "Kit 4 Bicos Injetores I30");
  assert.equal(simples.a_confirmar, true);
  assert.equal(simples.custo, 68);
  assert.match(simples.motivo, /kit com 4/);
  assert.match(conferirCustoDoKit({ ...ok, custo: 30 }, { formato: "S" }, "Par Buchas Embreagem Fiat").motivo, /^anúncio de par/);
  assert.deepEqual(conferirCustoDoKit(ok, { formato: null }, "Kit 4 Bicos"), ok, "formato desconhecido: não muda");
  assert.deepEqual(conferirCustoDoKit({ ...ok, custo: 27.9 }, { formato: "S" }, "Interruptor Cebolinha Óleo Fiat"), { ...ok, custo: 27.9 });
});
