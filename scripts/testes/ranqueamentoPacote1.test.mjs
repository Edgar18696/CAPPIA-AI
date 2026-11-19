// =============================================================
// PAIIA — TESTES (Pacote 1, 19/11/2026): três correções de cálculo do Ranqueamento,
// trazidas do ramo central/analisar-correcao (12–13/11) para a versão atual.
//   a) vendas e faturamento em dias inteiros de Brasília (como o painel do ML);
//   b) conversão = vendas (pedidos) ÷ visitas (como o painel do ML);
//   c) retomada segura quando o login do PAIIA cai no meio (por conta e tipo de rodada).
// Sem rede: pedidos e respostas montados no formato real da API.
//   node --test scripts/testes/ranqueamentoPacote1.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ler = (p) => fs.readFileSync(path.join(RAIZ, p), "utf8");

test("a) período em dias inteiros de Brasília, como o painel do ML (caso real MLB3782488757, 12/11 15:40)", async () => {
  const { contarVendidos, faturarVendidos } = await import("../../src/services/paizinhoAuditoria/coleta.js");
  const { inicioDoDiaBrasilia } = await import("../../src/services/paizinhoAuditoria/util.js");
  const agora = "2026-11-12T18:40:17.524Z"; // 12/11 15:40 em Brasília
  assert.equal(inicioDoDiaBrasilia(agora, 30), "2026-10-13T03:00:00.000Z", "13/10 00:00 de Brasília");
  assert.equal(inicioDoDiaBrasilia("2026-11-13T01:30:00.000Z", 0), "2026-11-12T03:00:00.000Z", "22:30 de 12/11 em Brasília ainda é 12/11");
  // Pedidos reais lidos da API (horário de Brasília), todos a R$ 24,50.
  const p = (data, qtd, status = "paid") => ({ status, date_created: `${data}-03:00`, order_items: [{ item: { id: "MLB3782488757" }, quantity: qtd, unit_price: 24.5 }] });
  const pedidos = [
    p("2026-10-30T06:03:27.000", 5), p("2026-10-28T22:23:32.000", 2), p("2026-10-27T07:25:21.000", 1), p("2026-10-24T20:40:25.000", 1),
    p("2026-10-22T13:38:50.000", 5), p("2026-10-20T13:32:00.000", 2), p("2026-10-17T23:33:51.000", 1), p("2026-10-16T22:42:42.000", 1),
    p("2026-10-16T14:15:23.000", 1), p("2026-10-15T15:59:48.000", 4),
    p("2026-10-13T13:57:34.000", 2), // 1º dia antes das 15:40: antes ficava de fora
    p("2026-10-07T13:36:30.000", 2), // fora dos 30 dias
    p("2026-10-03T09:55:26.000", 1, "cancelled"),
  ];
  assert.deepEqual(contarVendidos(pedidos, agora, 30), { MLB3782488757: 25 }, "igual ao painel: 25 un.");
  assert.deepEqual(faturarVendidos(pedidos, agora, 30), { MLB3782488757: 612.5 }, "igual ao painel: R$ 612,50");
});

test("a) a coleta usa datas de Brasília nas visitas e guarda o período exato; a tela mostra o período", () => {
  const coleta = ler("src/services/paizinhoAuditoria/coleta.js");
  assert.match(coleta, /const de = dataBrasilia\(diasAtras\(agora, o\.diasVisitas\)\);/);
  assert.match(coleta, /const ate = dataBrasilia\(agora\);/);
  assert.match(coleta, /const desdeVendas = inicioDoDiaBrasilia\(agora, o\.diasVendas\);/);
  assert.match(coleta, /vendas_30d_de: inicioDoDiaBrasilia\(agora, 30\), vendas_ate: new Date\(agora\)\.toISOString\(\)/);
  const tela = ler("src/components/RelatorioManhaPaizinho.jsx");
  assert.match(tela, /data-paiia-periodo/);
  assert.match(tela, /Vendas e faturamento: \$\{hora\(p\.vendas_30d_de\)\}/);
});

test("b) conversão = vendas (pedidos) ÷ visitas, como o painel do ML (caso real MLB3737977765, 13/11)", async () => {
  const { contarPedidos, contarVendidos, faturarVendidos } = await import("../../src/services/paizinhoAuditoria/coleta.js");
  const agora = "2026-11-12T20:02:01.893Z";
  const p = (data, qtd, extra = []) => ({ status: "paid", date_created: `${data}T12:00:00.000-03:00`, order_items: [{ item: { id: "MLB3737977765" }, quantity: qtd, unit_price: 14.22 }, ...extra] });
  // 6 vendas, 9 unidades (alguns clientes levaram mais de um).
  const pedidos = [
    p("2026-10-14", 2), p("2026-10-20", 1), p("2026-10-25", 3), p("2026-11-01", 1), p("2026-11-05", 1),
    p("2026-11-10", 1, [{ item: { id: "OUTRO" }, quantity: 1, unit_price: 5 }]),
    { status: "cancelled", date_created: "2026-11-11T12:00:00.000-03:00", order_items: [{ item: { id: "MLB3737977765" }, quantity: 4 }] },
  ];
  assert.equal(contarVendidos(pedidos, agora, 30).MLB3737977765, 9, "unidades continuam 9");
  assert.equal(faturarVendidos(pedidos, agora, 30).MLB3737977765, 127.98, "faturamento continua igual (9 × 14,22)");
  const vendas = contarPedidos(pedidos, agora, 30);
  assert.deepEqual(vendas, { MLB3737977765: 6, OUTRO: 1 }, "6 vendas; pedido com 2 anúncios conta 1 para cada; cancelado fora");
  assert.equal(Math.round((vendas.MLB3737977765 / 58) * 10000) / 100, 10.34, "6 ÷ 58 = 10,3%, igual ao painel");
  const fonte = ler("src/services/paizinhoAuditoria/analise.js");
  assert.match(fonte, /conversao30: visitas > 0 && pedidos30 !== null \? Math\.round\(\(pedidos30 \/ visitas\)/);
  assert.match(fonte, /vendasTot = ambos\.reduce\(\(s, f\) => s \+ f\.pedidos30, 0\)/);
});

test("b) na análise completa: ficha com 6 vendas / 9 unidades e 58 visitas → conversão 10,34%", async () => {
  const { analisarAnuncios } = await import("../../src/services/paizinhoAuditoria/analise.js");
  const agora = "2026-11-12T20:02:01.893Z";
  const item = { id: "MLB3737977765", seller_id: 2412238242, title: "Peça teste", price: 14.22, available_quantity: 10, listing_type_id: "gold_special", category_id: "MLB1", condition: "new", date_created: "2026-01-01T00:00:00.000Z", permalink: "", pictures: [], shipping: {}, attributes: [] };
  const p = (data, qtd) => ({ id: data, status: "paid", date_created: `${data}T12:00:00.000-03:00`, order_items: [{ item: { id: item.id }, quantity: qtd, unit_price: 14.22 }] });
  const dados = {
    conta: { id: "2412238242" }, coletado_em: agora, itens: [item], descricoes: {}, visitas: { [item.id]: 58 },
    pedidos: [p("2026-10-14", 2), p("2026-10-20", 1), p("2026-10-25", 3), p("2026-11-01", 1), p("2026-11-05", 1), p("2026-11-10", 1)],
    envios: {}, fretes: {}, tarifas: {}, compat: {}, bling: {}, concorrencia: {}, leituras: { vendas: true, visitas: true }, falhas: [], totais: {}, fontes: {},
  };
  const a = analisarAnuncios(dados, { agora });
  const f = a.fichas[0];
  assert.deepEqual([f.vendas30, f.pedidos30, f.visitas30, f.conversao30], [9, 6, 58, 10.34]);
  assert.equal(a.conversaoConta, 10.34, "média da conta também por vendas");
});

test("c) retomada segura: login cai → Continuar reaproveita o ML lido, relê só as falhas e mantém o período", async () => {
  const { novaRetomada, retomadaValida, consultaComRetomada, parouPorLogin, VALIDADE_RETOMADA_MS } = await import("../../src/services/paizinhoAuditoria/retomada.js");
  const chave = "2412238242|novos";
  const ret = novaRetomada({ agora: "2026-11-13T13:04:24.237Z", limiteItens: 20, chave, criadoEm: 1000 });
  let chamadas = 0;
  let loginOk = true;
  const ml = async (c) => { chamadas++; return loginOk ? { ok: true, dados: { c } } : { ok: false, status: 401, erro: "Usuário não autenticado. Entre novamente no PAIIA." }; };
  const get = consultaComRetomada(ml, ret);
  await get("/items/MLB1/visits?date_from=2026-10-14");
  await get("/orders/search?seller=1");
  loginOk = false;
  const falha = await get("/items/MLB2/visits?date_from=2026-10-14");
  assert.equal(falha.ok, false);
  assert.equal(ret.respostas.size, 2, "falha não é guardada");
  // Entrou de novo e clicou em Continuar.
  loginOk = true;
  chamadas = 0;
  const get2 = consultaComRetomada(ml, ret);
  await get2("/items/MLB1/visits?date_from=2026-10-14");
  await get2("/orders/search?seller=1");
  const lida = await get2("/items/MLB2/visits?date_from=2026-10-14");
  assert.equal(chamadas, 1, "só a que falhou é lida de novo");
  assert.equal(lida.ok, true);
  assert.equal(ret.agora, "2026-11-13T13:04:24.237Z", "mesmo período");
  // Validade: mesma conta/tipo, mesmo limite e até 3 h.
  assert.equal(retomadaValida(ret, { limiteItens: 20, chave, agoraMs: 1000 + VALIDADE_RETOMADA_MS - 1 }), true);
  assert.equal(retomadaValida(ret, { limiteItens: 20, chave, agoraMs: 1000 + VALIDADE_RETOMADA_MS }), false, "vencida");
  assert.equal(retomadaValida(ret, { limiteItens: 50, chave, agoraMs: 2000 }), false, "outro limite de anúncios");
  assert.equal(retomadaValida(ret, { limiteItens: 20, chave: "1729335019|novos", agoraMs: 2000 }), false, "outra conta nunca reaproveita");
  assert.equal(retomadaValida(ret, { limiteItens: 20, chave: "2412238242|reanalise", agoraMs: 2000 }), false, "outro tipo de rodada");
  assert.equal(retomadaValida(null, { limiteItens: 20, chave }), false);
  assert.equal(parouPorLogin({ leitura_incompleta: { sessao_expirada: true } }), true);
  assert.equal(parouPorLogin({ leitura_incompleta: null }), false);
});

test("c) o serviço confere o login antes, usa o mesmo período e a memória por conta; a tela oferece Continuar", () => {
  const fonte = ler("src/services/paizinhoAuditoria/relatorioService.js");
  assert.match(fonte, /await conferirLogin\(\);/);
  assert.match(fonte, /agora: ret\.agora/);
  assert.match(fonte, /const chaveRet = `\$\{escolhida\.id\}\|\$\{tipo\}`;/);
  // (19/11) guardar: false — a lista é gravada depois, com a cópia da anterior.
  assert.match(fonte, /rodarTesteLocal\(\{ conta: id, limiteItens: quantidade, concorrencia, aoProgredir, escolherIds, continuar, tipo: modo(, guardar: false)? \}\)/);
  assert.doesNotMatch(fonte, /signOut\(/, "não desconecta ninguém");
  const tela = ler("src/components/RelatorioManhaPaizinho.jsx");
  assert.match(tela, /data-paizinho-continuar-leitura/);
  assert.match(tela, /podeContinuar\(conta, ultimoModo, limite\)/);
});

test("Pacote 1 não traz a tela antiga nem os scripts do Photoroom do ramo antigo", () => {
  assert.equal(fs.existsSync(path.join(RAIZ, "src/components/AnaliseCorrecaoPaizinho.jsx")), false);
  assert.equal(fs.existsSync(path.join(RAIZ, "scripts/photoroomSandboxTeste.cjs")), false);
  assert.match(ler("src/services/paizinhoAuditoria/correcao.js"), /CORREÇÃO INTELIGENTE/, "correcao.js atual preservado");
});
