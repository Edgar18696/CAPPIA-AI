// =============================================================
// PAIIA — TESTES (17/11/2026): Central de Promoções — SELEÇÃO de anúncios
// (Black Friday 2026 como 1ª campanha). Sem rede; armazenamento falso.
// Garante: seleção por usuário+campanha+conta+MLB, sem duplicidade, remoção
// e reinclusão, meta 50/100/200/outra, troca de conta sem misturar, sugestão
// só com dados lidos, preço mudou → continua selecionado com "Revisão
// necessária", conflito de campanhas com datas cruzadas, 10%/5% só nos
// selecionados, aprovação só de selecionados e nenhum botão que ative ofertas.
//   node --test scripts/testes/promocoesSelecao.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SEL = await import("../../src/services/promocoes/selecao.js");
const CAMP = await import("../../src/services/promocoes/campanhas.js");
const R = await import("../../src/services/blackFriday/regras.js");
const L = await import("../../src/services/blackFriday/leitura.js");
const PL = await import("../../src/services/blackFriday/planilha.js");

const LOJA = "1729335019", CIEBR = "824312524", REV = "2412238242";
const BF = CAMP.CAMPANHAS_PROMOCOES[0].id;
const ler = (f) => fs.readFileSync(path.join(RAIZ, f), "utf8");

function memoria() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}
let relogio = 0;
const agora = () => new Date(Date.UTC(2026, 10, 18, 12, 0, relogio++)).toISOString();
const nova = (storage = memoria(), usuarioId = "u1", campanhaId = BF, campanhas) => criar(storage, usuarioId, campanhaId, campanhas);
function criar(storage, usuarioId, campanhaId, campanhas) {
  return { storage, s: SEL.criarSelecao({ adaptador: SEL.adaptadorLocal(storage), usuarioId, campanhaId, agora, ...(campanhas ? { campanhas } : {}) }) };
}
const an = (id, conta = LOJA, preco = 100, x = {}) => ({ conta, id, sku: `SKU-${id}`, titulo: `Peça ${id}`, preco_original: preco, ...x });

/* ------------------------------ campanhas ------------------------------ */

test("campanhas: Black Friday 2026 é a 1ª e única; 3 contas; mesmo calendário (30/11 23:59)", () => {
  assert.equal(CAMP.CAMPANHAS_PROMOCOES.length, 1, "nenhuma campanha real adicional");
  const bf = CAMP.CAMPANHAS_PROMOCOES[0];
  assert.equal(bf.id, "black-friday-2026");
  assert.equal(bf.fim, "2026-11-30T23:59:00-03:00");
  assert.deepEqual([...bf.contas].sort(), [LOJA, CIEBR, REV].sort());
  assert.deepEqual([...CAMP.METAS_SELECAO], [50, 100, 200]);
  assert.equal(CAMP.periodosSeCruzam({ inicio: "2026-11-27T00:00:00-03:00", fim: "2026-11-30T23:59:00-03:00" }, { inicio: "2026-11-30T00:00:00-03:00", fim: "2026-12-05T00:00:00-03:00" }), true);
  assert.equal(CAMP.periodosSeCruzam({ inicio: "2026-11-27T00:00:00-03:00", fim: "2026-11-30T23:59:00-03:00" }, { inicio: "2026-12-01T00:00:00-03:00", fim: "2026-12-05T00:00:00-03:00" }), false);
});

/* ------------------------------- seleção ------------------------------- */

test("seleção: inclui, não duplica (mesma conta+MLB), remove e reinclui", () => {
  const { s } = nova();
  let r = s.incluir([an("MLB1"), an("MLB2"), an("mlb1")]);
  assert.deepEqual(r.incluidos, ["MLB1", "MLB2"]);
  assert.deepEqual(r.ja_estavam, ["MLB1"], "MLB repetido (mesmo em minúsculas) não duplica");
  r = s.incluir([an("MLB1")]);
  assert.deepEqual(r.incluidos, []); assert.deepEqual(r.ja_estavam, ["MLB1"]);
  assert.equal(s.listar(LOJA).length, 2);
  assert.equal(s.remover([SEL.chaveItemSelecao(LOJA, "MLB1")]), 1);
  assert.equal(s.listar(LOJA).length, 1);
  r = s.incluir([an("MLB1")]);
  assert.deepEqual(r.incluidos, ["MLB1"], "reincluir depois de remover funciona");
  assert.equal(s.listar(LOJA).length, 2);
});

test("seleção: separada por usuário, por campanha e por conta (troca de conta não mistura)", () => {
  const storage = memoria();
  const a = nova(storage, "u1").s, b = nova(storage, "u2").s;
  a.incluir([an("MLB1", LOJA), an("MLB9", CIEBR)]);
  b.incluir([an("MLB5", LOJA)]);
  assert.deepEqual(a.listar(LOJA).map((x) => x.mlb), ["MLB1"]);
  assert.deepEqual(a.listar(CIEBR).map((x) => x.mlb), ["MLB9"]);
  assert.equal(a.listar(REV).length, 0);
  assert.deepEqual(b.listar(LOJA).map((x) => x.mlb), ["MLB5"], "outro usuário não vê a seleção do primeiro");
  // mesmo MLB em contas diferentes = registros diferentes
  a.incluir([an("MLB1", CIEBR)]);
  assert.equal(a.listar(CIEBR).length, 2);
  assert.equal(a.listar(LOJA).length, 1);
  // limpar uma conta não toca a outra
  a.limpar(CIEBR);
  assert.equal(a.listar(CIEBR).length, 0);
  assert.equal(a.listar(LOJA).length, 1);
  // conta fora da campanha e MLB inválido são recusados
  const r = a.incluir([an("MLB7", "999"), an("XYZ")]);
  assert.equal(r.recusados.length, 2);
  // a chave do navegador inclui campanha e usuário
  assert.match(SEL.chaveSelecao("u1", BF), /black-friday-2026:u1$/);
  assert.throws(() => SEL.criarSelecao({ adaptador: SEL.adaptadorLocal(storage), usuarioId: "", campanhaId: BF }));
  assert.throws(() => SEL.criarSelecao({ adaptador: SEL.adaptadorLocal(storage), usuarioId: "u1", campanhaId: "natal-inexistente" }));
});

test("meta 50/100/200/outra: não passa da meta; meta inválida recusada; por conta", () => {
  const { s } = nova();
  assert.equal(s.meta(LOJA), null);
  assert.equal(s.definirMeta(LOJA, 2).ok, true);
  assert.equal(s.definirMeta(LOJA, 0).ok, false);
  assert.equal(s.definirMeta(LOJA, 999999).ok, false);
  assert.equal(s.meta(LOJA), 2);
  const r = s.incluir([an("MLB1"), an("MLB2"), an("MLB3")]);
  assert.deepEqual(r.incluidos, ["MLB1", "MLB2"]);
  assert.match(r.recusados[0].motivo, /Meta de 2/);
  assert.equal(s.meta(CIEBR), null, "a meta é por conta");
  for (const m of [50, 100, 200, 37]) assert.equal(s.definirMeta(CIEBR, m).meta, m);
  assert.equal(s.definirMeta(LOJA, null).meta, null, "sem meta");
});

test("sugestão: só aptos, com estoque, maior quantidade vendida LIDA e depois estoque; nunca inventa vendas", () => {
  const linhas = [
    { id: "MLB1", conta: LOJA, vendidos: 10, estoque: 1, ok: true },
    { id: "MLB2", conta: LOJA, vendidos: 50, estoque: 5, ok: true },
    { id: "MLB3", conta: LOJA, vendidos: null, estoque: 30, ok: true },
    { id: "MLB4", conta: LOJA, vendidos: 99, estoque: 0, ok: true },
    { id: "MLB5", conta: LOJA, vendidos: 80, estoque: 2, ok: false },
    { id: "MLB6", conta: LOJA, vendidos: 10, estoque: 9, ok: true },
  ];
  const s = SEL.sugerirAnuncios(linhas, { vagas: 3, apto: (l) => l.ok, selecionado: (l) => l.id === "MLB2" });
  assert.deepEqual(s.map((l) => l.id), ["MLB6", "MLB1", "MLB3"], "MLB2 já selecionado, MLB4 sem estoque, MLB5 não apto; sem venda lida fica por último");
  assert.equal(SEL.sugerirAnuncios(linhas, { vagas: 0 }).length, 0);
});

test("preço mudou depois da seleção: CONTINUA selecionado, vira 'Revisão necessária' e só sai com conferência", () => {
  const { s } = nova();
  s.incluir([an("MLB1", LOJA, 100), an("MLB2", LOJA, 50)]);
  let r = s.revisar([{ conta: LOJA, id: "MLB1", preco_original: 100 }, { conta: LOJA, id: "MLB2", preco_original: 50 }]);
  assert.deepEqual(r.novas, []);
  r = s.revisar([{ conta: LOJA, id: "MLB1", preco_original: 120 }]);
  assert.deepEqual(r.novas, ["MLB1"]);
  const reg = s.mapa(LOJA).get(SEL.chaveItemSelecao(LOJA, "MLB1"));
  assert.ok(reg, "não foi retirado da seleção");
  assert.equal(reg.revisao, true);
  assert.match(reg.revisao_motivo, /100,00 para R\$ 120,00/);
  assert.equal(s.listar(LOJA).length, 2);
  // revisar de novo não duplica o aviso
  assert.deepEqual(s.revisar([{ conta: LOJA, id: "MLB1", preco_original: 120 }]).novas, []);
  assert.equal(s.confirmarRevisao(SEL.chaveItemSelecao(LOJA, "MLB1")), true);
  const ok = s.mapa(LOJA).get(SEL.chaveItemSelecao(LOJA, "MLB1"));
  assert.equal(ok.revisao, false);
  assert.equal(ok.preco_referencia, 120, "o preço conferido vira a nova referência");
});

test("vindo do Ranqueamento sem preço: o 1º preço lido vira a referência (sem revisão falsa)", () => {
  const { s } = nova();
  const r = SEL.enviarParaPromocoes({ adaptador: SEL.adaptadorLocal(s && nova().storage), usuarioId: "u9", campanhaId: BF, anuncio: { conta: REV, id: "MLB77", preco_original: null } });
  assert.deepEqual(r.incluidos, ["MLB77"]);
  const { s: s2 } = nova();
  s2.incluir([{ conta: REV, id: "MLB78", preco_original: null }], { origem: "ranqueamento" });
  assert.deepEqual(s2.revisar([{ conta: REV, id: "MLB78", preco_original: 80 }]).novas, []);
  const reg = s2.mapa(REV).get(SEL.chaveItemSelecao(REV, "MLB78"));
  assert.equal(reg.preco_referencia, 80);
  assert.equal(reg.origem, "ranqueamento");
});

test("descontos conflitantes: o mesmo MLB não entra em duas campanhas com datas que se cruzam", () => {
  const campanhas = [
    ...CAMP.CAMPANHAS_PROMOCOES,
    { id: "teste-cruzada", nome: "Teste cruzada", inicio: "2026-11-29T00:00:00-03:00", fim: "2026-12-03T23:59:00-03:00", contas: [LOJA] },
    { id: "teste-depois", nome: "Teste depois", inicio: "2026-12-10T00:00:00-03:00", fim: "2026-12-12T23:59:00-03:00", contas: [LOJA] },
  ];
  const storage = memoria();
  const bf = nova(storage, "u1", BF, campanhas).s;
  bf.incluir([an("MLB1")]);
  const cruzada = nova(storage, "u1", "teste-cruzada", campanhas).s;
  const r = cruzada.incluir([an("MLB1"), an("MLB2")]);
  assert.deepEqual(r.incluidos, ["MLB2"]);
  assert.match(r.recusados[0].motivo, /Black Friday 2026/);
  const depois = nova(storage, "u1", "teste-depois", campanhas).s;
  assert.deepEqual(depois.incluir([an("MLB1")]).incluidos, ["MLB1"], "campanha sem datas cruzadas aceita");
});

/* ------------------------- descontos e planilha ------------------------- */

test("descontos: 10% Renault comprovada · 5% demais · título sozinho não comprova; planilha só dos selecionados", () => {
  const base = { id: "MLB1", seller_id: Number(LOJA), title: "Sensor Bosch", price: 200, status: "active", condition: "new", listing_type_id: "gold_special", available_quantity: 3, sold_quantity: 12, shipping: {}, attributes: [] };
  const renault = R.classificarRenault({ ...base, attributes: [{ id: "BRAND", value_name: "Renault" }] }, { lido: true, quantidade: 0, marcas: [], legivel: true });
  assert.equal(renault.classe, "renault");
  assert.equal(R.precoComDesconto(200, R.DESCONTOS.renault), 180);
  assert.equal(R.precoComDesconto(200, R.DESCONTOS.demais), 190);
  const soTitulo = R.classificarRenault({ ...base, title: "Sensor Renault Clio" }, { lido: true, quantidade: 0, marcas: [], legivel: true });
  assert.notEqual(soTitulo.classe, "renault", "a palavra Renault no título não comprova");
  // a leitura guarda a quantidade vendida (para a sugestão) e a linha da simulação a expõe
  assert.equal(L.resumirItem(base).sold_quantity, 12);
  const linha = R.simularAnuncio({ conta: LOJA, item: base, compat: { lido: true, quantidade: 0, marcas: [], legivel: true }, promocoes: { lido: true, ativas: [], candidatas: [] } }, { perfil: { impostoPct: 6, custoPedido: 0 } });
  assert.equal(linha.vendidos, 12);
  // planilha: a tela passa só as linhas selecionadas
  const linhas = [linha, { ...linha, id: "MLB2", chave: "x:2" }];
  const sel = new Set(["MLB1"]);
  assert.equal(PL.montarPlanilha(linhas.filter((l) => sel.has(l.id)), LOJA).length, 1);
});

test("sem imposto (18/11): simula e seleciona, margem 'não verificada' sem valor inventado; aprovação continua exigindo margem", () => {
  const base = { id: "MLB1", seller_id: Number(LOJA), title: "Sensor Bosch", price: 200, status: "active", condition: "new", listing_type_id: "gold_special", available_quantity: 3, seller_custom_field: "SKU1", shipping: {}, attributes: [] };
  const leitura = { conta: LOJA, item: base, compat: { lido: true, quantidade: 0, marcas: [], legivel: true }, promocoes: { lido: true, ativas: [], candidatas: [] }, tarifaFinal: { valor: 22 }, freteAtual: { ok: true, custo_vendedor: 20 }, freteFinal: { ok: true, custo_vendedor: 20 }, custo: { ok: true, encontrado: true, custo: { fornecedores: [{ padrao: true, precoCusto: 80 }] }, formato: "S" } };
  const semImposto = R.simularAnuncio(leitura, { perfil: { impostoPct: null, custoPedido: 0 } });
  assert.equal(semImposto.preco_final, 190, "5% calculado mesmo sem imposto");
  assert.equal(semImposto.imposto, null, "imposto nunca inventado");
  assert.equal(semImposto.lucro, null);
  assert.equal(semImposto.margem_pct, null);
  assert.match(semImposto.motivos.join(" "), /Imposto não informado: margem não verificada/);
  assert.equal(PL.selecionavel(semImposto), true, "pode ser selecionado sem imposto");
  assert.equal(PL.aprovavel(semImposto), false, "mas não pode ser aprovado sem margem verificada");
  const comImposto = R.simularAnuncio(leitura, { perfil: { impostoPct: 6, custoPedido: 0 } });
  assert.notEqual(comImposto.margem_pct, null, "com imposto (e custo) a margem é calculada");
  assert.equal(comImposto.imposto, 11.4);
  // BLOQUEADO e dúvida Renault não entram na seleção
  const usado = R.simularAnuncio({ ...leitura, item: { ...base, condition: "used" } }, { perfil: { impostoPct: null, custoPedido: 0 } });
  assert.equal(PL.classificarParaPlanilha(usado).lista, "BLOQUEADO");
  assert.equal(PL.selecionavel(usado), false);
  assert.equal(PL.selecionavel({ ...semImposto, classe: "revisao", decisao: null }), false);
  assert.equal(PL.selecionavel({ ...semImposto, classe: "revisao", decisao: "renault" }), true);
  const tela = ler("src/components/BlackFridayPaizinho.jsx");
  assert.match(tela, /apto: \(l\) => selecionavel\(l\)/);
  assert.match(tela, /Margem não verificada/);
  assert.doesNotMatch(tela, /nenhum anúncio fica PRONTO/);
});

/* ------------------------------- telas ------------------------------- */

test("aba: seleção separada da aprovação; aprovação só de selecionado sem revisão; ativação continua desligada", () => {
  const tela = ler("src/components/BlackFridayPaizinho.jsx");
  assert.match(tela, /aprovavelNaCampanha = \(l\) => \{ const r = regSel\(l\); return !!r && !r\.revisao && aprovavel\(l\); \}/);
  assert.match(tela, /const aptas = lista\.filter\(\(l\) => aprovavelNaCampanha\(l\)\)/);
  assert.match(tela, /Ativar ofertas aprovadas<\/button>/);
  assert.match(tela, /disabled title="Liberado só na Fase 3/, "o botão de ativação continua desligado");
  assert.doesNotMatch(tela, /method:\s*"(POST|PUT|DELETE)"/, "a aba não faz escrita");
  assert.match(tela, /só neste navegador/, "a limitação do armazenamento é informada");
  assert.match(tela, /montarPlanilha\(completa \? linhas : linhasSel, contaAtual\)/);
  assert.match(tela, /METAS_SELECAO\.map/);
  const servico = ler("src/services/promocoes/selecao.js");
  assert.doesNotMatch(servico, /supabase|fetch\(|functions\.invoke/, "a seleção não grava no banco nem chama o ML");
});

test("Ranqueamento: só ganhou o botão 'Enviar para Promoções' (sem escrita, sem trocar contas)", () => {
  const rank = ler("src/components/RelatorioManhaPaizinho.jsx");
  assert.match(rank, /import EnviarParaPromocoes from "\.\/EnviarParaPromocoes";/);
  assert.equal((rank.match(/<EnviarParaPromocoes /g) || []).length, 3);
  assert.match(rank, /CONTAS_AUDITORIA, CONTA_PADRAO/);
  const botao = ler("src/components/EnviarParaPromocoes.jsx");
  assert.match(botao, /Enviar para Promoções/);
  assert.match(botao, /CAMPANHAS_PROMOCOES\.filter\(\(c\) => c\.contas\.includes\(contaId\)\)/, "escolha da campanha de destino");
  assert.doesNotMatch(botao, /functions\.invoke|\.from\(|fetch\(/, "o botão só seleciona (nada no banco, nada no ML)");
  const sql = ler("supabase/pendentes/20261118_paiia_promocoes_selecao.sql");
  assert.match(sql, /NÃO APLICADA/);
  assert.match(sql, /unique \(usuario_id, campanha_id, conta_ml, mlb\)/);
  assert.ok(!fs.existsSync(path.join(RAIZ, "supabase/migrations/20261118_paiia_promocoes_selecao.sql")), "a proposta não está nas migrações");
});
