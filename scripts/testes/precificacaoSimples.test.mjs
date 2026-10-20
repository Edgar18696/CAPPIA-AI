// =============================================================
// PAIIA — TESTES (19/10/2026): precificação simples do Mercado Livre e
// tipo de anúncio/preço vindos do Novo Anúncio para a Conferência.
//   node --test scripts/testes/precificacaoSimples.test.mjs
// Caso real: SKU AC485684658, ficha 56753cd1, LOJA ONLINE, Premium 17%,
// custo R$ 24,80, embalagem R$ 3,00, frete R$ 8,45, impostos 8%,
// preço R$ 65,91 → margem líquida 20%. A Conferência bloqueava com
// "tipo de anúncio mudou (premium → classico)".
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";

const P = await import("../../src/services/precificacaoSimples.js");
const F = await import("../../src/services/fretePrecificacao.js");
const D = await import("../../src/services/dadosTecnicosAnuncio.js");
const PF = await import("../../src/services/persistenciaFicha.js");
const { resultadoDoPreco, baseDePrecificacao, parametrosCotacao, situacaoFrete, calcularFreteEPrecos, caminhoCotacao } = F;

const CONTA = "1729335019";
const MEDIDA = { peso_g: 350, comprimento_cm: 20, largura_cm: 10, altura_cm: 10 };
// ML falso: R$ 8,45 até R$ 78,99; premium opcionalmente mais caro.
function mlFalso({ extraPremium = 0 } = {}) {
  const chamadas = [];
  const f = async (caminho) => {
    chamadas.push(caminho);
    const u = new URL("https://x" + caminho);
    const preco = Number(u.searchParams.get("item_price"));
    const premium = u.searchParams.get("listing_type_id") === "gold_pro";
    const base = preco < 79 ? 8.45 : 12.95;
    return { ok: true, dados: { coverage: { all_country: { list_cost: base + (premium ? extraPremium : 0), billable_weight: 350, discount: { rate: 0.3, promoted_amount: 12 } } } } };
  };
  f.chamadas = chamadas;
  return f;
}
const params = (tipo, extra = {}) => parametrosCotacao({ conta: CONTA, medida: MEDIDA, modalidade: "xd_drop_off", categoria: "MLB193666", tipoAnuncio: tipo, ...extra });
const base = (comissao) => baseDePrecificacao({ custo: "24,80", despesas: "3,00", comissao, imposto: "8" });

test("caso real: R$ 65,91 Premium 17% → margem líquida 20%", () => {
  const r = resultadoDoPreco({ preco: 65.91, frete: 8.45, base: base("17") });
  assert.equal(r.resultado, 13.19);
  assert.equal(r.margemPct, 20);
});

test("comissões de referência: padrão 12/17/20, ajustáveis, inválidas ignoradas", () => {
  assert.deepEqual(P.lerComissoesReferencia(null), { classico: 12, premium: 17, shopee: 20 });
  const r = P.lerComissoesReferencia(JSON.stringify({ premium: "16,5", classico: "abc", shopee: 140 }));
  assert.deepEqual(r, { classico: 12, premium: 16.5, shopee: 20 });
  assert.equal(P.comissaoDeReferencia({ canal: "mercado_livre", tipo: "premium", refs: r }), 16.5);
  assert.equal(P.comissaoDeReferencia({ canal: "mercado_livre", tipo: "classico", refs: r }), 12);
  assert.equal(P.comissaoDeReferencia({ canal: "shopee", tipo: "premium", refs: r }), 20);
  assert.equal(P.comissaoDeReferencia({ canal: "site_proprio", tipo: "premium", refs: r }), null);
  assert.equal(P.textoPorcentagem(16.5), "16,5");
});

test("Clássico → Premium → Clássico: recalcula sozinho e reaproveita as cotações (sem nova consulta na volta)", async () => {
  const ml = mlFalso();
  const consultar = P.criarConsultaComCache({ consultar: ml });
  const c1 = await calcularFreteEPrecos({ params: params("classico"), base: base("12"), precoFinal: 65.91, consultar });
  const n1 = ml.chamadas.length;
  const c2 = await calcularFreteEPrecos({ params: params("premium"), base: base("17"), precoFinal: 65.91, consultar });
  const n2 = ml.chamadas.length;
  const c3 = await calcularFreteEPrecos({ params: params("classico"), base: base("12"), precoFinal: 65.91, consultar });
  assert.ok(c1.ok && c2.ok && c3.ok);
  assert.ok(n2 > n1, "Premium: o ML é consultado com gold_pro (o tipo pode mudar o frete)");
  assert.equal(ml.chamadas.length, n2, "voltar a Clássico: nenhuma consulta nova (cache)");
  assert.equal(c2.registro.tipoAnuncio, "premium");
  assert.equal(c2.registro.final.margemPct, 20);
  assert.equal(c2.registro.final.custo_vendedor, 8.45);
  assert.deepEqual(c3.registro.margens, c1.registro.margens);
  assert.ok(ml.chamadas.slice(n1).every((c) => c.includes("listing_type_id=gold_pro")));
});

test("se o Premium REALMENTE muda o frete no ML, a nova cotação traz o valor novo", async () => {
  const consultar = P.criarConsultaComCache({ consultar: mlFalso({ extraPremium: 1.5 }) });
  const c = await calcularFreteEPrecos({ params: params("premium"), base: base("17"), precoFinal: 65.91, consultar });
  assert.equal(c.registro.final.custo_vendedor, 9.95);
});

test("cache: só respostas OK; vence pela validade", async () => {
  let t = 0;
  let n = 0;
  const f = P.criarConsultaComCache({ consultar: async () => { n++; return n === 1 ? { ok: false, erro: "x" } : { ok: true, n }; }, validadeMs: 100, agora: () => t });
  assert.equal((await f("/a")).ok, false);
  assert.equal((await f("/a")).n, 2);
  assert.equal((await f("/a")).n, 2);
  t = 200;
  assert.equal((await f("/a")).n, 3);
});

test("alterar só a comissão: cotação continua válida? não — recalcula preços (frete do cache)", async () => {
  const ml = mlFalso();
  const consultar = P.criarConsultaComCache({ consultar: ml });
  const c = await calcularFreteEPrecos({ params: params("premium"), base: base("17"), precoFinal: 65.91, consultar });
  const s = situacaoFrete({ registro: c.registro, atual: { ...params("premium"), preco: "65,91", base: base("16") } });
  assert.equal(s.estado, "desatualizado");
  assert.ok(s.motivos.some((m) => /comissão mudou/.test(m)));
  assert.equal(P.precisaRecalcular({ pronto: true, situacao: s, registro: c.registro, preco: 65.91, assinatura: "b", ultimaTentativa: "a" }), true);
  const n = ml.chamadas.length;
  const c2 = await calcularFreteEPrecos({ params: params("premium"), base: base("16"), precoFinal: 65.91, consultar });
  assert.ok(c2.ok);
  assert.ok(ml.chamadas.length - n <= 2, "no máximo as faixas novas de preço");
  assert.equal(situacaoFrete({ registro: c2.registro, atual: { ...params("premium"), preco: "65,91", base: base("16") } }).estado, "ok");
});

test("alterar peso, medidas, modalidade e conta: cotação inválida (nova consulta)", async () => {
  const c = await calcularFreteEPrecos({ params: params("premium"), base: base("17"), precoFinal: 65.91, consultar: mlFalso() });
  const casos = [
    [{ medida: { ...MEDIDA, peso_g: 500 } }, /peso mudou/],
    [{ medida: { ...MEDIDA, altura_cm: 15 } }, /altura mudou/],
    [{ modalidade: "self_service" }, /modalidade mudou/],
    [{ conta: "999" }, /conta mudou/],
  ];
  for (const [mud, re] of casos) {
    const s = situacaoFrete({ registro: c.registro, atual: { ...params("premium", mud), preco: "65,91", base: base("17") } });
    assert.equal(s.estado, "desatualizado");
    assert.ok(s.motivos.some((m) => re.test(m)), JSON.stringify(s.motivos));
    const novo = caminhoCotacao(params("premium", mud), 65.91);
    assert.notEqual(novo, caminhoCotacao(params("premium"), 65.91), "caminho diferente = sem reaproveitar o cache");
  }
});

test("alterar o preço final: mesma faixa recalcula o resultado; outra faixa invalida; o preço nunca muda sozinho", async () => {
  const c = await calcularFreteEPrecos({ params: params("premium"), base: base("17"), precoFinal: 65.91, consultar: mlFalso() });
  const mesma = situacaoFrete({ registro: c.registro, atual: { ...params("premium"), preco: "70,00", base: base("17") } });
  // (20/10) mesma faixa não confirma o preço final: precisa da cotação no valor exato (recalcula sozinho)
  assert.equal(mesma.estado, "desatualizado");
  assert.ok(mesma.motivos.some((m) => /ainda não cotado no valor exato/.test(m)));
  assert.equal(P.precisaRecalcular({ pronto: true, situacao: mesma, registro: c.registro, preco: 70, assinatura: "x", ultimaTentativa: "" }), true);
  const outra = situacaoFrete({ registro: c.registro, atual: { ...params("premium"), preco: "89,90", base: base("17") } });
  assert.equal(outra.estado, "desatualizado");
  const c2 = await calcularFreteEPrecos({ params: params("premium"), base: base("17"), precoFinal: 70, consultar: mlFalso() });
  assert.equal(c2.registro.final.preco, 70, "o preço do usuário é mantido");
});

test("recálculo automático não entra em laço e não roda sem dados", () => {
  const s = { estado: "desatualizado", motivos: ["x"] };
  assert.equal(P.precisaRecalcular({ pronto: false, situacao: s, registro: {}, preco: 1, assinatura: "a", ultimaTentativa: "" }), false);
  assert.equal(P.precisaRecalcular({ pronto: true, situacao: s, registro: {}, preco: 1, assinatura: "a", ultimaTentativa: "a" }), false);
  assert.equal(P.precisaRecalcular({ pronto: true, situacao: { estado: "ok" }, registro: { final: { preco: 65.91 } }, preco: 65.91, assinatura: "a", ultimaTentativa: "" }), false);
  assert.notEqual(P.assinaturaRecalculo({ params: params("classico"), base: base("12"), preco: 65.91 }), P.assinaturaRecalculo({ params: params("premium"), base: base("12"), preco: 65.91 }));
});

test("bloqueio continua quando o frete está realmente inválido (estimativa / sem cotação / desatualizado)", () => {
  assert.equal(situacaoFrete({ registro: null, atual: params("premium") }).estado, "sem_cotacao");
  const est = { ...params("premium"), origem: "estimativa_paiia", margens: {}, final: { preco: 65.91, preco_cotado: 65.91, faixa_rotulo: "", origem: "estimativa_paiia" } };
  assert.equal(situacaoFrete({ registro: est, atual: { ...params("premium"), preco: "65,91" } }).estado, "estimativa");
  const ok = { ...params("premium"), origem: "mercado_livre", margens: {}, final: { preco: 65.91, preco_cotado: 65.91, faixa_rotulo: "", origem: "mercado_livre" } };
  assert.equal(situacaoFrete({ registro: ok, atual: { ...params("classico"), preco: "65,91" } }).estado, "desatualizado", "tipo diferente do cotado continua bloqueando");
});

// ---------------- Conferência: tipo/preço vindos do Novo Anúncio ----------------
const freteNA = (tipo, em, preco = 65.91) => ({ tipoAnuncio: tipo, calculado_em: em, final: { preco } });

test("CAUSA: ficha com Conferência em Clássico e Novo Anúncio recalculado em Premium → Conferência passa a Premium (edição real)", () => {
  const fichaSalva = { campos: { tipoAnuncio: "classico", preco: "65,91", edicoesNovoAnuncio: {} }, anuncioConferido: { tipoAnuncio: "classico", preco: "65,91" } };
  const anuncio = { tipoAnuncio: "premium", preco: "65,91", freteML: freteNA("premium", "2026-10-19T12:00:00Z"), edicoes: {} };
  // Antes: a Conferência ficava com a cópia dela.
  assert.equal(PF.tipoAnuncioDaFicha({ fichaSalva, anuncio }), "classico");
  const ed = D.edicoesDoNovoAnuncio({ anuncio, fichaSalva });
  assert.equal(ed.tipoAnuncio, "premium");
  assert.ok(ed.campos.includes("tipo de anúncio"));
  assert.equal(ed.marcas.tipoAnuncio, "2026-10-19T12:00:00Z");
  assert.deepEqual(D.CAMPOS_ASSINATURA_TECNICOS["tipo de anúncio"], ["tipo de anúncio"]);
});

test("já aplicado (F5 / reabrir): não reaplica nem pede nova aprovação", () => {
  const fichaSalva = { campos: { tipoAnuncio: "premium", edicoesNovoAnuncio: { tipoAnuncio: "2026-10-19T12:00:00Z" } }, anuncioConferido: { tipoAnuncio: "premium" } };
  const anuncio = { tipoAnuncio: "premium", freteML: freteNA("premium", "2026-10-19T12:00:00Z") };
  const ed = D.edicoesDoNovoAnuncio({ anuncio, fichaSalva });
  assert.equal(ed.tipoAnuncio, undefined);
  assert.deepEqual(ed.campos, []);
  assert.equal(ed.marcas.tipoAnuncio, "2026-10-19T12:00:00Z");
});

test("Premium → Clássico depois, com marca explícita: Clássico vale", () => {
  const fichaSalva = { campos: { tipoAnuncio: "premium", edicoesNovoAnuncio: { tipoAnuncio: "2026-10-19T12:00:00Z" } }, anuncioConferido: { tipoAnuncio: "premium" } };
  const anuncio = { tipoAnuncio: "classico", freteML: freteNA("classico", "2026-10-19T13:00:01Z"), edicoes: { tipoAnuncio: "2026-10-19T13:00:00Z" } };
  const ed = D.edicoesDoNovoAnuncio({ anuncio, fichaSalva });
  assert.equal(ed.tipoAnuncio, "classico");
});

test("ficha antiga sem marca e sem cotação no tipo novo: nada muda (padrão não vence a ficha)", () => {
  const fichaSalva = { campos: { tipoAnuncio: "premium" }, anuncioConferido: { tipoAnuncio: "premium" } };
  // "classico" aqui é só o padrão (sem marca e a cotação é de outro tipo).
  const ed = D.edicoesDoNovoAnuncio({ anuncio: { tipoAnuncio: "classico", freteML: freteNA("premium", "2026-10-19T12:00:00Z") }, fichaSalva });
  assert.equal(ed.tipoAnuncio, undefined);
  const ed2 = D.edicoesDoNovoAnuncio({ anuncio: { tipoAnuncio: "classico" }, fichaSalva });
  assert.equal(ed2.tipoAnuncio, undefined);
});

test("preço escolhido no Novo Anúncio depois da Conferência: vale e pede nova aprovação do preço; sem marca não mexe", () => {
  const fichaSalva = { campos: { preco: "59,90", edicoesNovoAnuncio: {} }, anuncioConferido: { preco: "59,90" } };
  const ed = D.edicoesDoNovoAnuncio({ anuncio: { preco: "65,91", edicoes: { preco: "2026-10-19T12:00:00Z" } }, fichaSalva });
  assert.equal(ed.preco, "65,91");
  assert.ok(ed.campos.includes("preço"));
  const sem = D.edicoesDoNovoAnuncio({ anuncio: { preco: "65,91", freteML: freteNA("classico", "2026-10-19T12:00:00Z") }, fichaSalva });
  assert.equal(sem.preco, undefined, "preço editado na Conferência não é sobrescrito sem marca explícita");
});

test("ficha nova (sem Conferência): só guarda as marcas", () => {
  const ed = D.edicoesDoNovoAnuncio({ anuncio: { tipoAnuncio: "premium", preco: "65,91", edicoes: { preco: "2026-10-19T12:00:00Z" }, freteML: freteNA("premium", "2026-10-19T11:00:00Z") }, fichaSalva: null });
  assert.equal(ed.marcas.tipoAnuncio, "2026-10-19T11:00:00Z");
  assert.equal(ed.marcas.preco, "2026-10-19T12:00:00Z");
  assert.deepEqual(ed.campos, []);
});

test("só falta escolher o preço: não é 'desatualizado' para o usuário nem recalcula em laço", () => {
  const registro = { margens: { recomendado: { preco: 60 } }, final: null };
  const situacao = { estado: "desatualizado", motivos: ["preço final ainda não cotado (escolha o preço e recalcule)"] };
  assert.equal(P.soFaltaPreco({ situacao, registro, preco: "" }), true);
  assert.equal(P.precisaRecalcular({ pronto: true, situacao, registro, preco: "", assinatura: "a", ultimaTentativa: "" }), false);
  assert.equal(P.soFaltaPreco({ situacao, registro, preco: 65.91 }), false);
  assert.equal(P.soFaltaPreco({ situacao: { estado: "desatualizado", motivos: ["peso mudou (350 → 500)", "preço final ainda não cotado"] }, registro, preco: "" }), false);
});

test("(19/10) cotação do ML falhou: erro com o motivo REAL, sem estimativa e sem frete zero", async () => {
  const falha = async () => ({ ok: false, status: 401, erro: "invalid access token" });
  const r = await calcularFreteEPrecos({ params: params("premium"), base: base("17"), precoFinal: 65.91, consultar: falha, estimar: false });
  assert.equal(r.ok, false);
  assert.match(r.erro, /invalid access token \(HTTP 401\)/);
  assert.equal(r.registro, undefined, "nenhum registro (nenhum preço) com frete inventado");
});

test("(19/10) frete de COMPRA entra no custo; frete de VENDA é separado (sem cobrança duplicada)", () => {
  // custo 24,80 + frete de compra 2,00; embalagem 3,00; frete de venda (ML) 8,45.
  const b = baseDePrecificacao({ custo: 24.8 + 2, despesas: "3,00", comissao: "17", imposto: "8" });
  const r = resultadoDoPreco({ preco: 65.91, frete: 8.45, base: b });
  assert.equal(r.custosSemFrete, Math.round((26.8 + 3 + r.comissaoValor + r.impostoValor) * 100) / 100);
  assert.equal(r.resultado, 11.19, "65,91 − 8,45 (venda) − 26,80 (mercadoria + compra) − 3,00 − 11,20 − 5,27");
  assert.equal(F.precoComMargem({ base: b, frete: 8.45, margem: 20 }) > 65.91, true);
});
