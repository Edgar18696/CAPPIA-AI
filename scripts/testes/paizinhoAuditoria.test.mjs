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

test("frete e medidas: sem medidas → Medidas Pendentes de Conferência (sem inventar valores)", async () => {
  assert.equal(medidasDoAnuncio(ITENS.MLB3), null);
  const { rel } = await rodar();
  const a = achadosDe(rel, "MLB3").find((x) => x.area === "frete");
  assert.match(a.problema, /^Medidas Pendentes de Conferência/);
  const linha = rel.fretes_medidas.find((l) => l.item_id === "MLB3");
  assert.equal(linha.medidas_anuncio, "não cadastradas");
  assert.equal(linha.sku, "SKU-MLB3");
  assert.equal(rel.resumo.medidas_pendentes, 1);
});

test("frete e medidas: divergência anúncio x Bling recota com as medidas do Bling e mostra a diferença", async () => {
  const { rel, ml } = await rodar();
  assert.ok(ml.caminhos.some((c) => c.caminho.includes("dimensions=30x30x30%2C300")), "recotação com as medidas do Bling");
  const a = achadosDe(rel, "MLB5").find((x) => x.area === "frete" && /Medidas divergentes/.test(x.problema));
  assert.match(a.problema, /pendente de conferência física/);
  assert.match(a.problema, /Frete hoje R\$ 20,00; com as medidas do Bling R\$ 32,00/);
  assert.match(a.problema, /risco de o ML remedir e cobrar R\$ 12,00 a mais por envio/);
  assert.match(a.sugestao, /corrigir o cadastro que estiver errado .*após aprovação/);
  const linha = rel.fretes_medidas.find((l) => l.item_id === "MLB5");
  assert.equal(linha.frete_com_bling, 32);
  assert.equal(linha.diferenca_por_envio, 12);
  assert.equal(linha.conferencia, "pendente");
  // Com vendas lidas, o possível impacto = diferença × vendas de 30 dias (nunca inventado sem vendas).
  const vendas = rel.anuncios.find((x) => x.item_id === "MLB5").vendas30;
  assert.equal(linha.impacto_rs, vendas > 0 ? -12 * vendas : null);
});

test("frete e medidas: cobrança nas vendas acima do estimado → alta com impacto", async () => {
  const { rel } = await rodar();
  const a = achadosDe(rel, "MLB6").find((x) => x.area === "frete" && /acima do estimado/.test(x.problema));
  assert.equal(a.severidade, "alta");
  assert.equal(a.impacto_rs, -30); // (35 − 20) × 2 envios
  const linha = rel.fretes_medidas.find((l) => l.item_id === "MLB6");
  assert.equal(linha.frete_real_medio, 35);
  assert.equal(linha.frete_vendedor, 20);
  assert.equal(linha.impacto_rs, -30);
  assert.equal(rel.secoes.find((s) => s.chave === "frete").titulo, "Fretes e Medidas — Problemas Encontrados");
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
  assert.ok(rel.resumo.prejuizo_estimado_30d >= 58);
  const pesos = { alta: 3, media: 2, baixa: 1 };
  for (let i = 1; i < rel.prioridades.length; i++) assert.ok(pesos[rel.prioridades[i - 1].severidade] >= pesos[rel.prioridades[i].severidade]);
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
