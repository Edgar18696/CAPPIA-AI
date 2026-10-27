// =============================================================
// PAIIA — TESTES do Arquivo 2: src/services/exclusaoFicha.js
// (exclusão DEFINITIVA). Regras puras: sem rede, sem banco.
//   node --test scripts/testes/exclusaoFichaDefinitiva.test.mjs
// Inclui a PARIDADE com os casos da função SQL (Arquivo 1): toda ficha que
// o banco recusa, a tela também protege; toda que o banco aceita, a tela libera.
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as X from "../../src/services/exclusaoFicha.js";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LOJA = "1729335019";
const U1 = "11111111-1111-4111-8111-111111111111";
const ANTIGO = "2026-10-20T10:00:00.123456+00:00";
const AGORA = Date.parse("2026-10-27T12:00:00Z");
const ID = "aaaaaaaa-0000-4000-8000-000000000001";

// Linha de publicação COMPLETA (como a base devolve), com valores seguros.
const pubSegura = (extra = {}) => ({
  usuario_id: U1, ml_user_id: LOJA, sku: "990001", updated_at: ANTIGO,
  mlb_id: null, mlb_link: null, publicado_em: null, erro_publicacao: null,
  status_publicacao: "pendente", bling_produto_id: null, status_bling: "nao_verificado", ...extra,
});
const ficha = (extra = {}, dc = {}) => ({
  id: ID, codigo: "990001", codigo_normalizado: "990001", titulo: "Ficha teste",
  status_fluxo: "rascunho", conta_destino_ml_user_id: null, updated_at: ANTIGO,
  dados_conferencia: { salvo_em: "v1", ...dc }, publicacoes: [], ...extra,
});
const completa = (r, op = {}) => X.avaliarExclusao(r, { completa: true, usuarioId: U1, agora: AGORA, ...op });

// ------------------------- paridade com a função SQL -------------------------
const CASOS = [
  // [nome, ficha, pode?]
  ["01 rascunho simples", ficha(), true],
  ["02 conferência aprovada + publicação pendente", ficha({ status_fluxo: "conferencia_aprovada", conta_destino_ml_user_id: LOJA, publicacoes: [pubSegura()] }), true],
  ["03 publicação validada sem MLB", ficha({ status_fluxo: "conferencia_aprovada", publicacoes: [pubSegura({ status_publicacao: "validado" })] }), true],
  ["04 Bling preparado para criar", ficha({ publicacoes: [pubSegura({ status_bling: "preparado_para_criar" })] }), true],
  ["05 Base PAIIA 'não salvar'", ficha({}, { base_paiia: { decisao: "nao_salvar" } }), true],
  ["06 listas vazias", ficha({}, { mlbs_anteriores: [], integracao_bling: {}, versoes_substituidas: [] }), true],
  ["07 validado, Bling não verificado, campos ''", ficha({ publicacoes: [pubSegura({ status_publicacao: "validado", erro_publicacao: "", mlb_link: "" })] }), true],
  ["08 Bling não encontrado", ficha({ publicacoes: [pubSegura({ status_bling: "nao_encontrado" })] }), true],
  ...["publicando", "publicado", "publicado_com_pendencia", "erro_publicacao", "cancelado"].map((st) => [`1x status ${st}`, ficha({ status_fluxo: st }), false]),
  ["20 publicação com MLB", ficha({ publicacoes: [pubSegura({ mlb_id: "MLB1234567" })] }), false],
  ["21 publicação com erro", ficha({ publicacoes: [pubSegura({ status_publicacao: "erro" })] }), false],
  ["22 publicação publicada", ficha({ publicacoes: [pubSegura({ status_publicacao: "publicado" })] }), false],
  ["23 publicação sem status", ficha({ publicacoes: [pubSegura({ status_publicacao: null })] }), false],
  ["24 produto no Bling", ficha({ publicacoes: [pubSegura({ bling_produto_id: 987654 })] }), false],
  ...["encontrado", "vinculado", "ambiguo", "erro", null].map((sb) => [`25 Bling ${sb}`, ficha({ publicacoes: [pubSegura({ status_bling: sb })] }), false]),
  ["26 publicação de outro usuário", ficha({ publicacoes: [pubSegura({ usuario_id: "22222222-2222-4222-8222-222222222222" })] }), false],
  ...["pendente", "validado"].flatMap((st) => [
    [`27 ${st} com publicado_em`, ficha({ publicacoes: [pubSegura({ status_publicacao: st, publicado_em: "2026-10-21T09:00:00Z" })] }), false],
    [`28 ${st} com mlb_link`, ficha({ publicacoes: [pubSegura({ status_publicacao: st, mlb_link: "https://produto.mercadolivre.com.br/MLB-1234567" })] }), false],
    [`29 ${st} com erro_publicacao`, ficha({ publicacoes: [pubSegura({ status_publicacao: st, erro_publicacao: "timeout" })] }), false],
  ]),
  ["40 MLBs anteriores", ficha({}, { mlbs_anteriores: [{ mlb: "MLB1" }] }), false],
  ["41 versões substituídas", ficha({}, { versoes_substituidas: [{ v: 1 }] }), false],
  ["42 integração Bling", ficha({}, { integracao_bling: { estado: "aguardando" } }), false],
  ["42b integração Bling [] (o banco protege)", ficha({}, { integracao_bling: [] }), false],
  ["43 Base PAIIA gravada", ficha({}, { base_paiia: { decisao: "autorizado", gravacao: { ok: true, lote_id: "x" } } }), false],
  ["44 Base PAIIA revertida", ficha({}, { base_paiia: { gravacao: { revertido: true } } }), false],
  ["45 Base PAIIA autorizada", ficha({}, { base_paiia: { decisao: "autorizado" } }), false],
  ["46 dados em formato inesperado", { ...ficha(), dados_conferencia: [1, 2] }, false],
  ["60 código 510959620", ficha({ codigo: "510959620", codigo_normalizado: "510959620" }), false],
  ["61 título com 510959620", ficha({ titulo: "Teste 510959620" }), false],
];

for (const [nome, r, pode] of CASOS) {
  test(`paridade SQL — ${nome}: ${pode ? "pode excluir" : "protegida"}`, () => {
    const a = completa(r);
    assert.equal(a.pode, pode, a.motivo);
    if (!pode) assert.ok(a.motivo.length > 5, "protegida sempre explica o motivo");
  });
}

test("leitura completa: dono da publicação obrigatório e igual ao usuário logado", () => {
  const comPub = (p) => ficha({ publicacoes: [p] });
  assert.equal(completa(comPub(pubSegura())).pode, true, "mesmo usuário: libera");
  assert.equal(completa(comPub(pubSegura({ usuario_id: U1.toUpperCase() }))).pode, true, "mesmo usuário em maiúsculas: libera");
  const semCampo = pubSegura(); delete semCampo.usuario_id;
  for (const [nome, p, motivo] of [["campo ausente", semCampo, /sem dono/], ["null", pubSegura({ usuario_id: null }), /sem dono/], ["vazio", pubSegura({ usuario_id: "  " }), /sem dono/], ["outro usuário", pubSegura({ usuario_id: "22222222-2222-4222-8222-222222222222" }), /outro usuário/]]) {
    const a = completa(comPub(p));
    assert.equal(a.pode, false, `usuario_id ${nome} deveria proteger`);
    assert.match(a.motivo, motivo);
  }
  for (const u of ["", null, undefined]) {
    const a = X.avaliarExclusao(comPub(pubSegura()), { completa: true, usuarioId: u, agora: AGORA });
    assert.equal(a.pode, false, "sem usuário logado informado: protege");
    assert.match(a.motivo, /Usuário logado não identificado/);
  }
  assert.equal(X.avaliarExclusao(ficha(), { completa: true, usuarioId: "", agora: AGORA }).pode, false, "leitura completa sem usuário logado: protege sempre");
  assert.equal(X.avaliarExclusao(ficha(), { agora: AGORA }).pode, true, "prévia da lista não depende do usuário (o banco confere o dono)");
});

test("registro de MLB ligado à ficha protege (caso 30)", () => {
  assert.equal(completa(ficha(), { registrosMLB: [{ id: "r1", mlb_id: "MLB7654321" }] }).pode, false);
  assert.equal(completa(ficha(), { registrosMLB: [] }).pode, true);
});

// ------------------------- leitura completa x prévia -------------------------
test("leitura completa: campo de publicação que não foi lido protege", () => {
  const p = pubSegura();
  delete p.status_bling;
  const a = completa(ficha({ publicacoes: [p] }));
  assert.equal(a.pode, false);
  assert.match(a.motivo, /incompletos/);
});

test("prévia da lista: campos não carregados não decidem; os carregados decidem", () => {
  const previa = (pubs) => X.avaliarExclusao(ficha({ publicacoes: pubs }), { agora: AGORA });
  assert.equal(previa([{ ml_user_id: LOJA, sku: "990001", updated_at: ANTIGO, status_publicacao: "pendente", mlb_id: null }]).pode, true);
  assert.equal(previa([{ ml_user_id: LOJA, updated_at: ANTIGO, mlb_id: "MLB1" }]).pode, false);
  assert.equal(previa([{ ml_user_id: LOJA, updated_at: ANTIGO, status_bling: null }]).pode, false, "status Bling lido e vazio protege");
});

// ------------------------- consulta ao Mercado Livre -------------------------
test("conta escolhida: exige consulta ao ML (só leitura) e espera 15 minutos", () => {
  const r = ficha({ status_fluxo: "conferencia_aprovada", conta_destino_ml_user_id: LOJA, publicacoes: [pubSegura()] });
  const a = completa(r);
  assert.deepEqual([a.pode, a.consultarML, a.contaML], [true, true, LOJA]);
  assert.deepEqual(a.codigos, ["990001"]);
  const recente = completa({ ...r, updated_at: new Date(AGORA - 5 * 60 * 1000).toISOString() });
  assert.equal(recente.pode, false);
  assert.match(recente.motivo, /15 minutos/);
  assert.equal(completa(ficha()).consultarML, false, "sem conta: não consulta o ML");
});

test("resultado do ML: erro ou anúncio sem ficha protege; MLB de outra ficha libera", () => {
  assert.equal(X.liberaPelaConsultaML({ erro: "timeout" }).libera, false);
  assert.equal(X.liberaPelaConsultaML(null).libera, false);
  assert.equal(X.liberaPelaConsultaML({ verificado: true, duplicados: [{ id: "MLB55" }], possiveis: [] }).libera, false);
  assert.equal(X.liberaPelaConsultaML({ verificado: true, duplicados: [], possiveis: [{ id: "MLB56" }] }).libera, false);
  assert.equal(X.liberaPelaConsultaML({ verificado: true, duplicados: [{ id: "MLB55" }], possiveis: [] }, ["MLB55"]).libera, true);
  assert.equal(X.liberaPelaConsultaML({ verificado: true, duplicados: [], possiveis: [] }).libera, true);
});

// ------------------------- resposta da função do banco -------------------------
test("resposta do banco: só 'apagada' com ok:true conta como apagada", () => {
  assert.equal(X.lerRespostaExclusao({ ok: true, motivo: "apagada" }).apagada, true);
  assert.equal(X.lerRespostaExclusao({ ok: true, motivo: "outra coisa" }).apagada, false);
  assert.equal(X.lerRespostaExclusao({ ok: false, motivo: "registro_mlb" }).protegida, true);
  const v = X.lerRespostaExclusao({ ok: false, motivo: "versao_alterada" });
  assert.deepEqual([v.apagada, v.conflito, v.protegida], [false, true, false]);
  assert.equal(X.lerRespostaExclusao(null).apagada, false);
  assert.match(X.lerRespostaExclusao({ ok: false, motivo: "base_paiia" }).mensagem, /Base PAIIA/);
});

// ------------------------- rascunho local -------------------------
test("descartar rascunho local: só o que é da MESMA ficha", () => {
  const mem = new Map([
    ["paiiaAnuncioEmAndamento", JSON.stringify({ resumo: { fichaId: ID } })],
    ["novoAnuncioTemporario", JSON.stringify({ fichaIdPAIIA: ID })],
    ["anuncioProntoPublicacao", JSON.stringify({ fichaIdPAIIA: "outra-ficha" })],
    ["rascunhoNovoAnuncioTemp", "isto não é JSON"],
  ]);
  const st = { getItem: (k) => mem.get(k) ?? null, removeItem: (k) => mem.delete(k) };
  const r = X.descartarRascunhoLocalDaFicha(st, ID, { chaveGuardada: "paiiaAnuncioEmAndamento", chavesLocais: ["novoAnuncioTemporario", "rascunhoNovoAnuncioTemp", "anuncioProntoPublicacao"] });
  assert.deepEqual(r.sort(), ["novoAnuncioTemporario", "paiiaAnuncioEmAndamento"]);
  assert.ok(mem.has("anuncioProntoPublicacao") && mem.has("rascunhoNovoAnuncioTemp"));
  assert.deepEqual(X.descartarRascunhoLocalDaFicha(st, "", {}), []);
});

// ------------------------- valores iguais aos do banco -------------------------
test("os valores aceitos são exatamente os da função SQL do Arquivo 1", () => {
  const sql = fs.readFileSync(path.join(RAIZ, "supabase/pendentes/20261027_paiia_excluir_ficha_definitivo.sql"), "utf8");
  assert.ok(sql.includes("v_ficha.status_fluxo not in ('rascunho', 'conferencia_aprovada')"));
  assert.ok(sql.includes("p.status_publicacao not in ('pendente', 'validado')"));
  assert.ok(sql.includes("p.status_bling not in ('nao_verificado', 'nao_encontrado', 'preparado_para_criar')"));
  assert.deepEqual([...X.STATUS_QUE_PODEM_SER_EXCLUIDOS], ["rascunho", "conferencia_aprovada"]);
  assert.deepEqual([...X.STATUS_PUBLICACAO_SEGUROS], ["pendente", "validado"]);
  assert.deepEqual([...X.STATUS_BLING_SEGUROS], ["nao_verificado", "nao_encontrado", "preparado_para_criar"]);
  assert.match(X.TEXTO_CONFIRMAR_EXCLUSAO, /DEFINITIVAMENTE/);
  assert.match(X.TEXTO_CONFIRMAR_EXCLUSAO, /NÃO poderá ser recuperada/);
});

test("o módulo só decide: não grava, não apaga, não acessa rede", () => {
  const fonte = fs.readFileSync(path.join(RAIZ, "src/services/exclusaoFicha.js"), "utf8");
  assert.ok(!/supabase|fetch\(|\.delete\(|\.update\(|\.insert\(|\.rpc\(/.test(fonte));
});
