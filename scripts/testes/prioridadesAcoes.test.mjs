// =============================================================
// PAIIA — TESTES (17/11/2026): Central do Paizinho — "Prioridades de hoje" com
// conta do MLB, link da Central de Anúncios do ML e ações Resolvido / Remover da lista.
//   node --test scripts/testes/prioridadesAcoes.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const P = await import("../../src/services/paizinhoAuditoria/prioridadesAcoes.js");
const { executarAuditoria } = await import("../../src/services/paizinhoAuditoria/index.js");
const { CONTA, AGORA, mlFalso, blingFalso } = await import("./apoio/paizinhoAuditoriaFalso.mjs");
const { CONTAS_PUBLICACAO_ML } = await import("../../src/services/contasPublicacaoML.js");

function memoria() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), dados: m };
}
const rel = (conta = "1729335019", gerado_em = "2026-11-17T06:00:00.000Z") => ({ conta: { id: conta, nome: "x" }, gerado_em });
const achado = (id, area = "margem", extra = {}) => ({ item_id: id, area, severidade: "alta", sku: "S1", titulo: `Peça ${id}`, problema: "p", sugestao: "s", ...extra });

test("as 3 contas do PAIIA têm os mesmos ids e nomes da Publicação", () => {
  const pub = Object.fromEntries(CONTAS_PUBLICACAO_ML.map((c) => [c.id, c.nome]));
  assert.equal(P.CONTAS_ML.length, 3);
  for (const c of P.CONTAS_ML) assert.equal(pub[c.id], c.nome);
});

test("conta pelo vendedor real do anúncio: LOJA ONLINE, CIEBR e REVELAÇÃO", () => {
  for (const [id, nome] of [["1729335019", "LOJA ONLINE"], ["824312524", "CIEBR"], ["2412238242", "REVELAÇÃO"]]) {
    const c = P.contaDoAnuncio(achado("MLB4123456789", "margem", { vendedor_id: id }), rel(id));
    assert.deepEqual([c.identificada, c.id, c.nome], [true, id, nome]);
    assert.match(c.origem, /vendedor do anúncio/);
  }
});

test("sem vínculo confirmado → 'Conta não identificada'", () => {
  // vendedor fora das 3 contas
  assert.equal(P.contaDoAnuncio(achado("MLB4123456789", "x", { vendedor_id: "999" }), rel()).nome, "Conta não identificada");
  // vendedor diferente da conta da análise (nunca escolhe uma das duas)
  const div = P.contaDoAnuncio(achado("MLB4123456789", "x", { vendedor_id: "824312524" }), rel("1729335019"));
  assert.equal(div.identificada, false);
  assert.equal(div.nome, "Conta não identificada");
  // sem vendedor e sem conta da análise
  assert.equal(P.contaDoAnuncio(achado("MLB4123456789"), {}).identificada, false);
  // conta da análise desconhecida
  assert.equal(P.contaDoAnuncio(achado("MLB4123456789"), rel("555")).identificada, false);
});

test("relatório antigo (sem vendedor por anúncio): usa a conta da análise, conferida pelo seller_id na coleta", () => {
  const c = P.contaDoAnuncio(achado("MLB4123456789"), rel("1729335019"));
  assert.deepEqual([c.identificada, c.nome], [true, "LOJA ONLINE"]);
  assert.match(c.origem, /conta da análise/);
});

test("link da Central de Anúncios (área do vendedor), nunca o link público do produto", () => {
  const conta = P.contaDoAnuncio(achado("MLB4123456789", "x", { vendedor_id: "824312524" }), rel("824312524"));
  const l = P.linkCentralAnuncios("MLB4123456789", conta);
  assert.equal(l.url, "https://www.mercadolivre.com.br/anuncios/lista?search=MLB4123456789");
  assert.doesNotMatch(l.url, /produto\.mercadolivre|articulo|\/MLB-\d/);
  assert.match(l.aviso, /CIEBR/);
  assert.match(l.aviso, /conta que estiver logada/);
  // MLB-123 (formato do link público) é normalizado
  assert.equal(P.linkCentralAnuncios("MLB-4123456789", conta).mlb, "MLB4123456789");
  // conta não identificada: diz claramente que não dá para garantir
  const sem = P.linkCentralAnuncios("MLB4123456789", P.contaDoAnuncio(achado("MLB4123456789"), {}));
  assert.match(sem.aviso, /não é possível garantir/);
  // MLB inválido: sem link
  assert.equal(P.linkCentralAnuncios("abc", conta).url, "");
});

test("Resolvido: sai das prioridades e fica no histórico; nova análise que ainda acha o problema traz de volta", () => {
  const arm = memoria();
  const r = rel();
  const lista = [achado("MLB4000000001"), achado("MLB4000000002"), achado("MLB4000000001", "frete")];
  const conta = P.contaDoAnuncio(lista[0], r);
  const res = P.registrarAcao(arm, { acao: P.ACAO.RESOLVIDO, achado: lista[0], conta, rel: r, agora: new Date("2026-11-17T12:00:00Z") });
  assert.equal(res.ok, true);
  const h = P.lerHistorico(arm, "1729335019");
  assert.equal(h.length, 1);
  assert.deepEqual([h[0].acao, h[0].item_id, h[0].conta_nome, h[0].conta_id], ["resolvido", "MLB4000000001", "LOJA ONLINE", "1729335019"]);
  const { visiveis, fora } = P.separarPrioridades(lista, h, r);
  assert.deepEqual(visiveis.map((v) => P.chaveAchado(v.achado)), ["MLB4000000002|margem", "MLB4000000001|frete"], "mesmo MLB em outro assunto continua");
  assert.equal(fora.length, 1);
  // análise feita depois ainda encontrou: volta com aviso
  const depois = P.separarPrioridades(lista, h, rel("1729335019", "2026-11-18T06:00:00.000Z"));
  assert.equal(depois.visiveis.length, 3);
  assert.equal(depois.visiveis[0].reapareceu, true);
});

test("Remover da lista: exige motivo, registra motivo e ação, continua fora nas análises seguintes; Voltar devolve", () => {
  const arm = memoria();
  const a = achado("MLB4000000003", "margem", { vendedor_id: "2412238242" });
  const r = rel("2412238242");
  const conta = P.contaDoAnuncio(a, r);
  const semMotivo = P.registrarAcao(arm, { acao: P.ACAO.REMOVIDO, achado: a, conta, rel: r });
  assert.equal(semMotivo.ok, false);
  assert.match(semMotivo.erro, /motivo/);
  assert.equal(P.lerHistorico(arm, "2412238242").length, 0, "nada gravado sem motivo");
  const ok = P.registrarAcao(arm, { acao: P.ACAO.REMOVIDO, achado: a, conta, motivo: "Não é problema (análise não se aplica)", rel: r, agora: new Date("2026-11-17T12:00:00Z") });
  assert.equal(ok.ok, true);
  const h = P.lerHistorico(arm, "2412238242");
  assert.deepEqual([h[0].acao, h[0].motivo, h[0].conta_nome], ["removido", "Não é problema (análise não se aplica)", "REVELAÇÃO"]);
  assert.equal(P.separarPrioridades([a], h, rel("2412238242", "2026-11-20T06:00:00.000Z")).visiveis.length, 0);
  P.registrarAcao(arm, { acao: P.ACAO.DEVOLVIDO, achado: a, conta, rel: r, agora: new Date("2026-11-17T13:00:00Z") });
  const h2 = P.lerHistorico(arm, "2412238242");
  assert.deepEqual(h2.map((x) => x.acao), ["removido", "devolvido"], "histórico guarda a remoção e a volta");
  assert.equal(P.separarPrioridades([a], h2, r).visiveis.length, 1);
});

test("histórico corrompido ou ausente não quebra a tela; ação desconhecida é recusada", () => {
  const arm = memoria();
  arm.setItem(P.CHAVE_HISTORICO, "{quebrado");
  assert.deepEqual(P.lerHistorico(arm, "1729335019"), []);
  assert.deepEqual(P.lerHistorico(null, "1729335019"), []);
  assert.equal(P.registrarAcao(arm, { acao: "excluir", achado: achado("MLB4000000004") }).ok, false);
});

test("análise grava o vendedor real (seller_id) em cada prioridade, linha de frete e anúncio", async () => {
  const ml = mlFalso();
  const relReal = await executarAuditoria({ conta: CONTA, consultar: ml.consultar, consultarBling: blingFalso, agora: AGORA });
  assert.ok(relReal.prioridades.length > 0);
  for (const a of relReal.prioridades) {
    assert.equal(a.vendedor_id, CONTA);
    const c = P.contaDoAnuncio(a, relReal);
    assert.deepEqual([c.identificada, c.nome], [true, "LOJA ONLINE"]);
  }
  for (const l of relReal.fretes_medidas) assert.equal(l.vendedor_id, CONTA);
  for (const x of relReal.anuncios) assert.equal(x.vendedor_id, CONTA);
});

test("nunca exclui, pausa ou modifica anúncio: tela e serviço não chamam ML, Bling nem Supabase", () => {
  for (const arq of ["src/services/paizinhoAuditoria/prioridadesAcoes.js", "src/components/PrioridadesPaizinho.jsx"]) {
    const s = fs.readFileSync(path.join(RAIZ, arq), "utf8");
    assert.doesNotMatch(s, /\bfetch\(|supabase|functions\.invoke|consultar\(|ml_consulta|bling-integracao|mercadolivre-publicacao|method\s*:/i, arq);
  }
  const tela = fs.readFileSync(path.join(RAIZ, "src/components/RelatorioManhaPaizinho.jsx"), "utf8");
  assert.match(tela, /<PrioridadesPaizinho rel=\{rel\}/);
  assert.match(tela, /Prioridades de hoje/);
});

/* ------------------------------------------------------------ */
/* (17/11) Seleção das 3 contas: nada misturado entre contas     */
/* ------------------------------------------------------------ */
const RC = await import("../../src/services/paizinhoAuditoria/relatoriosPorConta.js");
const CIEBR = "824312524";
const REVELACAO = "2412238242";

/** ML falso de OUTRA conta: mesmos cenários, vendedor trocado; MLB6 continua da LOJA ONLINE (intruso). */
function mlDaConta(conta, { desconectada = false } = {}) {
  const base = mlFalso();
  const consultar = async (caminho) => {
    if (desconectada) return { ok: false, status: 404, erro: "Conta Mercado Livre não conectada." };
    const r = await base.consultar(caminho.replaceAll(`/users/${conta}`, `/users/${CONTA}`).replace(`seller=${conta}`, `seller=${CONTA}`));
    if (/^\/users\/\d+$/.test(caminho) && r.ok) return { ...r, dados: { ...r.dados, id: Number(conta), nickname: "x" } };
    const troca = (b) => (b && b.id !== "MLB6" ? { ...b, seller_id: Number(conta) } : b);
    if (r.ok && /^\/items\?ids=/.test(caminho)) return { ...r, dados: r.dados.map((x) => ({ ...x, body: troca(x.body) })) };
    if (r.ok && /^\/items\/MLB\d+$/.test(caminho)) return { ...r, dados: troca(r.dados) };
    return r;
  };
  return { consultar };
}

test("contas: seletor com LOJA ONLINE, CIEBR e REVELAÇÃO (padrão desde 18/11), nessa ordem", async () => {
  const { CONTAS_AUDITORIA, CONTA_PADRAO, CONTA_LEGADO } = await import("../../src/services/paizinhoAuditoria/contas.js");
  assert.deepEqual(CONTAS_AUDITORIA.map((c) => c.nome), ["LOJA ONLINE", "CIEBR", "REVELAÇÃO"]);
  assert.equal(CONTA_PADRAO.nome, "REVELAÇÃO", "REVELAÇÃO é a conta prioritária");
  assert.equal(CONTA_LEGADO.nome, "LOJA ONLINE", "registros antigos (sem conta no nome) continuam da LOJA ONLINE");
  const tela = fs.readFileSync(path.join(RAIZ, "src/components/RelatorioManhaPaizinho.jsx"), "utf8");
  assert.match(tela, /useState\(CONTA_PADRAO\.id\)/);
  // (17/11) "Rodar análise agora" virou "Analisar novos" (fila sem repetição).
  assert.ok(tela.indexOf("data-paizinho-seletor-conta") < tela.indexOf("data-paizinho-analisar-novos"), "botões das contas acima da análise");
  assert.match(tela, /analisarFila\(\{ conta: alvo/);
});

test("análise da CIEBR usa só anúncios da CIEBR: anúncio de outra conta é descartado, conta e vendedor = CIEBR", async () => {
  const rel = await executarAuditoria({ conta: CIEBR, consultar: mlDaConta(CIEBR).consultar, consultarBling: blingFalso, agora: AGORA });
  assert.deepEqual([rel.conta.id, rel.conta.nome], [CIEBR, "CIEBR"]);
  assert.ok(rel.resumo.descartados_outra_conta >= 1, "MLB6 (LOJA ONLINE) descartado");
  assert.ok(!rel.anuncios.some((a) => a.item_id === "MLB6"));
  assert.ok(rel.prioridades.length > 0);
  for (const a of rel.prioridades) {
    assert.equal(a.vendedor_id, CIEBR);
    assert.equal(P.contaDoAnuncio(a, rel).nome, "CIEBR");
  }
  assert.equal(RC.conferirRelatorioDaConta(rel, CIEBR), true);
  assert.throws(() => RC.conferirRelatorioDaConta(rel, CONTA), /outra conta/);
});

test("conta desconectada: análise para com o motivo e nenhum relatório de outra conta é usado", async () => {
  await assert.rejects(() => executarAuditoria({ conta: REVELACAO, consultar: mlDaConta(REVELACAO, { desconectada: true }).consultar, agora: AGORA }), /não conectada/);
  // perfil recusado mas anúncios sem leitura: o relatório vazio é barrado com o motivo
  const vazio = { conta: { id: REVELACAO }, resumo: { anuncios_analisados: 0 }, falhas: [{ etapa: "anúncios", exemplo: "Token vencido" }] };
  assert.throws(() => RC.conferirRelatorioDaConta(vazio, REVELACAO), /REVELAÇÃO: não foi possível ler os anúncios.*Token vencido.*Nenhum dado de outra conta/);
});

test("relatório guardado por conta: cada conta lê só o seu; a chave antiga vale só para a LOJA ONLINE", () => {
  const arm = memoria();
  const relDe = (id) => ({ conta: { id }, gerado_em: `x-${id}` });
  assert.equal(RC.guardarRelatorioDaConta(relDe(CIEBR), arm), true);
  assert.equal(RC.lerRelatorioDaConta(CIEBR, arm).gerado_em, `x-${CIEBR}`);
  assert.equal(RC.lerRelatorioDaConta(REVELACAO, arm), null, "REVELAÇÃO sem análise: nada (nunca o da CIEBR)");
  assert.equal(RC.lerRelatorioDaConta(CONTA, arm), null);
  arm.setItem(RC.CHAVE_TESTE_LOCAL, JSON.stringify(relDe(CONTA)));
  assert.equal(RC.lerRelatorioDaConta(CONTA, arm).gerado_em, `x-${CONTA}`, "relatório antigo da LOJA ONLINE continua");
  assert.equal(RC.lerRelatorioDaConta(REVELACAO, arm), null);
  // chave de uma conta com relatório de outra (adulterada) → ignorado
  arm.setItem(RC.chaveDaConta(RC.CHAVE_TESTE_LOCAL, REVELACAO), JSON.stringify(relDe(CIEBR)));
  assert.equal(RC.lerRelatorioDaConta(REVELACAO, arm), null);
  assert.equal(RC.guardarRelatorioDaConta(relDe("999"), arm), false, "conta fora das 3 não é guardada");
});

test("histórico separado por conta: ação na CIEBR não aparece na LOJA ONLINE nem na REVELAÇÃO", () => {
  const arm = memoria();
  const relC = rel(CIEBR);
  const a = achado("MLB4000000010", "margem", { vendedor_id: CIEBR });
  P.registrarAcao(arm, { acao: P.ACAO.REMOVIDO, achado: a, conta: P.contaDoAnuncio(a, relC), motivo: "Outro", rel: relC });
  assert.equal(P.lerHistorico(arm, CIEBR).length, 1);
  assert.equal(P.lerHistorico(arm, CONTA).length, 0);
  assert.equal(P.lerHistorico(arm, REVELACAO).length, 0);
  assert.ok(arm.getItem(P.chaveHistorico(CIEBR)));
  // histórico antigo (sem conta) era da LOJA ONLINE e continua só nela
  arm.setItem(P.CHAVE_HISTORICO, JSON.stringify([{ chave: "MLB1|x", acao: "resolvido", em: "2026-11-17T10:00:00Z" }]));
  assert.equal(P.lerHistorico(arm, CONTA).length, 1);
  assert.equal(P.lerHistorico(arm, REVELACAO).length, 0);
  // relatório sem conta conhecida: não registra
  assert.equal(P.registrarAcao(arm, { acao: P.ACAO.RESOLVIDO, achado: a, rel: { conta: { id: "999" } } }).ok, false);
});
