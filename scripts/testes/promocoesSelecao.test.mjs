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
  assert.deepEqual([...CAMP.METAS_SELECAO], [1, 10, 50, 100, 200]);
  assert.equal(CAMP.CONTA_PRINCIPAL, REV, "REVELAÇÃO é a conta principal");
  assert.ok(bf.contas.includes(CAMP.CONTA_PRINCIPAL));
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

/* ------------------- campanhas futuras: desconto flexível ------------------- */

const AGORA = "2026-11-18T12:00:00Z";
const natal = (x = {}) => ({ nome: "Natal 2026", inicio: "2026-12-15T00:00:00-03:00", fim: "2026-12-24T23:59:00-03:00", contas: [LOJA, CIEBR], desconto_pct: 15, ...x });

test("nova campanha: valida nome, datas (fim > início, até 14 dias, não passada), contas e % (5 a 79); BF não é editável", () => {
  assert.equal(CAMP.validarCampanha(natal(), undefined, { agora: AGORA }).ok, true);
  assert.match(CAMP.validarCampanha(natal({ nome: "X" }), undefined, { agora: AGORA }).motivo, /nome/);
  assert.match(CAMP.validarCampanha(natal({ fim: "2026-12-14T00:00:00-03:00" }), undefined, { agora: AGORA }).motivo, /depois do início/);
  assert.match(CAMP.validarCampanha(natal({ fim: "2026-12-31T00:00:00-03:00" }), undefined, { agora: AGORA }).motivo, /14 dias/);
  assert.match(CAMP.validarCampanha(natal({ inicio: "2026-11-01T00:00:00-03:00", fim: "2026-11-05T00:00:00-03:00" }), undefined, { agora: AGORA }).motivo, /já passou/);
  assert.match(CAMP.validarCampanha(natal({ contas: ["999"] }), undefined, { agora: AGORA }).motivo, /conta/);
  for (const [v, ok] of [[5, true], [10, true], [15, true], [20, true], ["12,5", true], [4, false], [80, false], ["abc", false]]) assert.equal(CAMP.validarCampanha(natal({ desconto_pct: v }), undefined, { agora: AGORA }).ok, ok, `desconto ${v}`);
  assert.equal(CAMP.validarCampanha(natal({ desconto_pct: "12,5" }), undefined, { agora: AGORA }).campanha.desconto_pct, 12.5);
  assert.match(CAMP.validarCampanha(natal({ id: "black-friday-2026" }), undefined, { agora: AGORA }).motivo, /Black Friday/);
  const cruz = CAMP.validarCampanha(natal({ nome: "Semana", inicio: "2026-11-29T00:00:00-03:00", fim: "2026-12-02T00:00:00-03:00" }), undefined, { agora: AGORA });
  assert.equal(cruz.ok, true);
  assert.match(cruz.avisos[0], /Black Friday 2026/, "avisa quando as datas cruzam com outra campanha");
  assert.equal(CAMP.dataLocalParaIso("2026-12-15T08:30"), "2026-12-15T08:30:00-03:00");
  assert.equal(CAMP.isoParaDataLocal("2026-12-15T08:30:00-03:00"), "2026-12-15T08:30");
});

test("rascunhos: salvar sem ativar, listar junto da BF, mudar o % (recalcula), excluir; BF continua a 1ª e fixa", () => {
  const storage = memoria();
  const a = CAMP.armazemCampanhas(storage, "u1");
  const r = a.salvar(natal(), { agora: AGORA });
  assert.equal(r.ok, true);
  assert.equal(r.campanha.situacao, "rascunho");
  assert.equal(r.campanha.regra, "percentual");
  assert.deepEqual(a.todas().map((c) => c.id), ["black-friday-2026", r.campanha.id]);
  assert.equal(a.salvar(natal({ nome: "natal 2026" }), { agora: AGORA }).ok, false, "nome repetido");
  const r2 = a.salvar({ ...r.campanha, desconto_pct: 20 }, { agora: AGORA });
  assert.equal(r2.ok, true);
  assert.equal(a.todas().length, 2, "editar não duplica");
  assert.equal(a.todas()[1].desconto_pct, 20);
  assert.equal(CAMP.armazemCampanhas(storage, "u2").todas().length, 1, "rascunho é por usuário");
  assert.equal(a.excluir("black-friday-2026"), false, "a BF não é excluída");
  assert.equal(a.excluir(r.campanha.id), true);
  assert.equal(a.todas().length, 1);
  assert.equal(CAMP.CAMPANHA_BLACK_FRIDAY.regra, "renault_bf");
  assert.equal(CAMP.CAMPANHA_BLACK_FRIDAY.descontos_por_produto, false);
});

test("desconto flexível: % da campanha ou do produto; simulação recalcula; BF mantém 10%/5% e não aceita desconto por produto", () => {
  const storage = memoria();
  const a = CAMP.armazemCampanhas(storage, "u1");
  const c = a.salvar(natal(), { agora: AGORA }).campanha;
  const sel = SEL.criarSelecao({ adaptador: SEL.adaptadorLocal(storage), usuarioId: "u1", campanhaId: c.id, campanhas: a.todas(), agora });
  sel.incluir([an("MLB1"), an("MLB2")]);
  const k1 = SEL.chaveItemSelecao(LOJA, "MLB1");
  assert.equal(CAMP.descontoDoAnuncio(c, sel.mapa(LOJA).get(k1)), 15);
  assert.equal(sel.definirDesconto(k1, 25).ok, true);
  assert.equal(CAMP.descontoDoAnuncio(c, sel.mapa(LOJA).get(k1)), 25, "desconto individual do produto");
  assert.equal(sel.definirDesconto(k1, 90).ok, false);
  assert.equal(sel.definirDesconto(SEL.chaveItemSelecao(LOJA, "MLB9"), 10).ok, false, "só anúncio selecionado");
  assert.equal(sel.definirDesconto(k1, null).ok, true);
  assert.equal(CAMP.descontoDoAnuncio(c, sel.mapa(LOJA).get(k1)), 15, "volta ao % da campanha");
  // BF: sem desconto por produto e regra fixa
  const bf = nova(storage).s;
  bf.incluir([an("MLB7")]);
  assert.equal(bf.definirDesconto(SEL.chaveItemSelecao(LOJA, "MLB7"), 15).ok, false);
  assert.equal(CAMP.descontoDoAnuncio(CAMP.CAMPANHA_BLACK_FRIDAY, null), null, "BF usa a regra Renault/demais");
  // simulação: o mesmo anúncio com 15% (campanha) e com a regra da BF (5%)
  const base = { id: "MLB1", seller_id: Number(LOJA), title: "Sensor Bosch", price: 200, status: "active", condition: "new", listing_type_id: "gold_special", available_quantity: 3, seller_custom_field: "SKU1", shipping: {}, attributes: [] };
  const leitura = { conta: LOJA, item: base, compat: { lido: true, quantidade: 0, marcas: [], legivel: true }, promocoes: { lido: true, ativas: [], candidatas: [] } };
  const p15 = R.simularAnuncio(leitura, { perfil: { impostoPct: null, custoPedido: 0 }, descontoPct: 15 });
  assert.equal(p15.preco_final, 170); assert.equal(p15.desconto_pct, 15); assert.equal(p15.regra, "percentual");
  const pbf = R.simularAnuncio(leitura, { perfil: { impostoPct: null, custoPedido: 0 } });
  assert.equal(pbf.preco_final, 190); assert.equal(pbf.regra, "renault_bf");
  // leitura completa: montarSimulacao usa descontoDe
  const leituraConta = { contas: { [LOJA]: { conta: LOJA, itens: [{ item: base, compat: leitura.compat, promocoes: leitura.promocoes }], tarifas: {}, fretes: {} } }, custos: {} };
  assert.equal(L.montarSimulacao(leituraConta, { perfil: { impostoPct: null, custoPedido: 0 }, descontoDe: () => 20 })[0].preco_final, 160);
  assert.equal(L.montarSimulacao(leituraConta, { perfil: { impostoPct: null, custoPedido: 0 } })[0].preco_final, 190, "sem campanha percentual = regra da BF");
  // na campanha percentual, a dúvida Renault não trava a seleção (o % não depende da classe)
  assert.equal(PL.selecionavel({ ...p15, classe: "revisao", decisao: null }), true);
});

test("margem DEPOIS do desconto: recalculada sobre o preço promocional (não é subtrair percentuais)", () => {
  const base = { id: "MLB1", seller_id: Number(LOJA), title: "Bobina", price: 200, status: "active", condition: "new", listing_type_id: "gold_special", available_quantity: 3, seller_custom_field: "SKU1", shipping: { free_shipping: true }, attributes: [{ id: "BRAND", value_name: "Renault" }] };
  const l = R.simularAnuncio({
    conta: LOJA, item: base, compat: { lido: true, quantidade: 0, marcas: [], legivel: true }, promocoes: { lido: true, ativas: [], candidatas: [] },
    tarifaFinal: { valor: 25 }, freteAtual: { ok: true, custo_vendedor: 20 }, freteFinal: { ok: true, custo_vendedor: 20 },
    custo: { ok: true, encontrado: true, formato: "S", custo: { fornecedores: [{ padrao: true, precoCusto: 80 }] } },
  }, { perfil: { impostoPct: 6, custoPedido: 0 } });
  assert.equal(l.desconto_pct, 10, "Renault comprovada: 10%");
  assert.equal(l.preco_final, 180);
  assert.equal(l.imposto, 10.8, "imposto sobre o preço promocional");
  assert.equal(l.lucro, 44.2, "180 − 25 − 20 − 10,80 − 80");
  assert.equal(l.margem_pct, 24.6, "44,20 / 180");
});

test("tela simples (18/11): lista só com o essencial; sem custo/imposto mostra 'Margem não verificada' e deixa selecionar", () => {
  const tela = ler("src/components/BlackFridayPaizinho.jsx");
  assert.match(tela, /MLB · SKU \/ produto<\/span><span style=\{S\.c_preco\}>Preço atual<\/span><span style=\{S\.c_desc\}>Desconto<\/span><span style=\{S\.c_preco\}>Promocional<\/span><span style=\{S\.c_situacao\}>Situação<\/span>/);
  assert.doesNotMatch(tela, /Comissão · imposto · frete<\/small>/, "custos detalhados ficam em Preços, Custos e Lucro");
  assert.match(tela, /const soMargem = !aprovado && cl\.lista === LISTAS\.CONFERIR && !outrosMotivos\.length;/);
  const RE = new RegExp(tela.match(/const RE_MARGEM = \/(.+)\/i;/)[1], "i");
  for (const m of ["Imposto não informado: margem não verificada (impostos serão tratados em projeto separado).", "Custo não informado — margem não verificável (anúncio sem SKU). Custo e lucro não são inventados.", "Tarifa de venda do ML no preço final não lida.", "Margem não verificada."]) assert.ok(RE.test(m), m);
  for (const m of ["PREJUÍZO de R$ 3,00 por venda no preço final.", "Dúvida de aplicação Renault (10% ou 5%).", "Atenção: Margem de 4% abaixo do mínimo de 8%."]) assert.ok(!RE.test(m), `continua aparecendo: ${m}`);
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
  assert.match(botao, /todas\.filter\(\(c\) => c\.contas\.includes\(contaId\)\)/, "escolha da campanha de destino (BF + rascunhos)");
  assert.doesNotMatch(botao, /functions\.invoke|\.from\(|fetch\(/, "o botão só seleciona (nada no banco, nada no ML)");
  const sql = ler("supabase/pendentes/20261118_paiia_promocoes_selecao.sql");
  assert.match(sql, /NÃO APLICADA/);
  assert.match(sql, /unique \(usuario_id, campanha_id, conta_ml, mlb\)/);
  assert.ok(!fs.existsSync(path.join(RAIZ, "supabase/migrations/20261118_paiia_promocoes_selecao.sql")), "a proposta não está nas migrações");
});
