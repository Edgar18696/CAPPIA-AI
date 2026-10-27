// =============================================================
// PAIIA — TESTES do Arquivo 3: src/services/exclusaoFichaService.js
// Supabase FALSO em memória (sem rede). A função do banco e o Mercado
// Livre são simulados; o teste prova a ORDEM e as CONDIÇÕES:
//   - lê ficha, TODAS as publicações e os registros de MLB;
//   - qualquer falha de leitura BLOQUEIA (nunca vira lista vazia);
//   - só chama a função do banco depois de tudo conferido;
//   - não grava nada por conta própria.
//   node --test scripts/testes/exclusaoFichaService.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);
const { banco, zerarBanco, supabase, USUARIO } = await import("./simulacao/supabaseFalso.mjs");
const S = await import("../../src/services/exclusaoFichaService.js");

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LOJA = "1729335019";
const OUTRO = "22222222-2222-4222-8222-222222222222";
const ANTIGO = "2026-10-20T10:00:00.123456+00:00";
const AGORA = Date.parse("2026-10-27T12:00:00Z");
const ID = (n) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, "0")}`;
const originais = { from: supabase.from, invoke: supabase.functions.invoke, getUser: supabase.auth.getUser };

// Paginação como no Supabase real: select(..., { count }), order("id"), range(a, b)
// e um LIMITE DO SERVIDOR (linhas máximas por resposta), que trunca respostas grandes.
let limiteServidor = 1000;
let paginasLidas = [];
function fromPaginado(t) {
  const q = originais.from(t);
  const selectOriginal = q.select.bind(q);
  q.select = (c, o) => { q._contar = o?.count === "exact"; return selectOriginal(c); };
  q.order = (col, o) => { q._ordem = { col, asc: o?.ascending !== false }; return q; };
  q.range = (a, b) => { q._faixa = [a, b]; return q; };
  const executarOriginal = q.executar.bind(q);
  q.executar = async () => {
    const r = await executarOriginal();
    if (r.error || !Array.isArray(r.data) || q.op !== "select") return r;
    let linhas = r.data;
    if (q._ordem) linhas = [...linhas].sort((x, y) => (String(x[q._ordem.col]) < String(y[q._ordem.col]) ? -1 : 1) * (q._ordem.asc ? 1 : -1));
    const total = linhas.length;
    const [a, b] = q._faixa || [0, total - 1];
    const pagina = linhas.slice(a, Math.min(b + 1, a + limiteServidor));
    if (q._faixa) paginasLidas.push({ tabela: t, de: a, ate: b, recebidas: pagina.length });
    return { data: pagina, error: null, count: q._contar ? total : null };
  };
  return q;
}

let rpcs = [];
let respostaRpc = { data: { ok: true, motivo: "apagada", mensagem: "Ficha excluída definitivamente." }, error: null };
function preparar() {
  zerarBanco();
  rpcs = [];
  respostaRpc = { data: { ok: true, motivo: "apagada", mensagem: "Ficha excluída definitivamente." }, error: null };
  limiteServidor = 1000;
  paginasLidas = [];
  supabase.from = fromPaginado;
  supabase.functions.invoke = originais.invoke;
  supabase.auth.getUser = originais.getUser;
  supabase.rpc = async (nome, args) => {
    rpcs.push({ nome, args });
    return respostaRpc;
  };
}
function ficha(n, extra = {}, dc = {}) {
  const l = {
    id: ID(n), usuario_id: USUARIO, codigo: `99${n}000`, codigo_normalizado: `99${n}000`, titulo: `Teste ${n}`,
    marketplace: "mercado_livre", status_fluxo: "rascunho", conta_destino_ml_user_id: null, conta_destino_nome: null,
    updated_at: ANTIGO, dados_conferencia: { salvo_em: "v1", ...dc }, ...extra,
  };
  banco.tabelas.paiia_anuncios.push(l);
  return l;
}
function pub(f, extra = {}) {
  const p = {
    id: `p-${f.id}`, anuncio_id: f.id, usuario_id: USUARIO, marketplace: "mercado_livre", ml_user_id: LOJA, sku: f.codigo,
    mlb_id: null, mlb_link: null, publicado_em: null, erro_publicacao: null, status_publicacao: "pendente",
    bling_produto_id: null, status_bling: "nao_verificado", updated_at: ANTIGO, ...extra,
  };
  banco.tabelas.paiia_anuncios_publicacoes.push(p);
  return p;
}
const exc = (id, op = {}) => S.excluirFichaDefinitivamente(id, { agora: AGORA, ...op });
const semGravacao = () => banco.chamadas.every((c) => c.op === "select");
const mlVazio = (c) => (c.includes("/items/search") ? { ok: true, dados: { results: [], paging: { total: 0 } } } : { ok: false, erro: "não encontrado" });
function mlFalso(mapa) {
  supabase.functions.invoke = async (nome, op) => {
    banco.funcoes.push({ nome, corpo: op?.body });
    assert.equal(nome, "mercadolivre-publicacao");
    assert.equal(op?.body?.acao, "ml_consulta", "só consulta ao ML");
    assert.equal(op?.body?.metodo, "GET", "só leitura no ML");
    return { data: mapa(op.body.caminho), error: null };
  };
}
/** Faz UMA tabela/consulta devolver algo estranho (sem erro, mas inválido). */
function respostaEstranha(tabela, resposta) {
  supabase.from = (t) => {
    const q = fromPaginado(t);
    if (t !== tabela) return q;
    q.executar = async () => {
      banco.chamadas.push({ tabela: t, op: "select" });
      return resposta;
    };
    return q;
  };
}

// ------------------------- caminho feliz -------------------------
test("1) ficha elegível sem conta: lê tudo, chama a função do banco com a versão lida e informa 'apagada'", async () => {
  preparar();
  const f = ficha(1);
  const r = await exc(f.id);
  assert.equal(r.apagada, true, r.erro);
  assert.equal(rpcs.length, 1);
  assert.deepEqual(rpcs[0], { nome: "paiia_excluir_ficha_definitivo", args: { p_ficha_id: f.id, p_versao: ANTIGO } });
  const lidas = banco.chamadas.map((c) => c.tabela);
  for (const t of ["paiia_anuncios", "paiia_anuncios_publicacoes", "paiia_registro_mlb"]) assert.ok(lidas.includes(t), `leu ${t}`);
  assert.ok(semGravacao(), "o serviço não grava nada");
  assert.equal(banco.funcoes.length, 0, "sem conta: ML nem é consultado");
});

// ------------------------- falhas de leitura BLOQUEIAM -------------------------
for (const [nome, tabela] of [["ficha", "paiia_anuncios"], ["publicações", "paiia_anuncios_publicacoes"], ["registro de MLBs", "paiia_registro_mlb"]]) {
  test(`2) falha ao ler ${nome}: bloqueia e NÃO chama o banco`, async () => {
    preparar();
    const f = ficha(2);
    banco.falhar[`${tabela}:select`] = true;
    const r = await exc(f.id);
    assert.equal(r.apagada, false);
    assert.equal(r.protegida, true);
    assert.match(r.erro, /Não foi possível conferir a ficha/);
    assert.equal(rpcs.length, 0);
  });
  test(`3) ${nome} com resposta inválida (sem erro, mas sem lista): bloqueia`, async () => {
    preparar();
    const f = ficha(3);
    respostaEstranha(tabela, { data: null, error: null });
    const r = await exc(f.id);
    assert.equal(r.apagada, false);
    assert.equal(r.protegida, true);
    assert.equal(rpcs.length, 0);
  });
}

test("4) leitura que lança exceção (rede caiu): bloqueia", async () => {
  preparar();
  const f = ficha(4);
  supabase.from = (t) => {
    const q = fromPaginado(t);
    if (t === "paiia_registro_mlb") q.executar = async () => { throw new Error("rede caiu"); };
    return q;
  };
  const r = await exc(f.id);
  assert.equal(r.protegida, true);
  assert.match(r.erro, /rede caiu/);
  assert.equal(rpcs.length, 0);
});

test("5) sessão ausente ou com erro: bloqueia antes de ler", async () => {
  for (const getUser of [async () => ({ data: { user: null } }), async () => ({ data: null, error: { message: "jwt expirado" } }), async () => { throw new Error("sem rede"); }]) {
    preparar();
    const f = ficha(5);
    supabase.auth.getUser = getUser;
    const r = await exc(f.id);
    assert.equal(r.protegida, true);
    assert.match(r.erro, /Sessão/);
    assert.equal(rpcs.length, 0);
    assert.equal(banco.chamadas.length, 0, "nem lê a ficha");
  }
});

test("6) ficha não encontrada: informa e não chama o banco", async () => {
  preparar();
  const r = await exc(ID(6));
  assert.equal(r.naoEncontrada, true);
  assert.equal(r.apagada, false);
  assert.equal(rpcs.length, 0);
});

// ------------------------- proteções com a leitura completa -------------------------
test("7) TODAS as publicações são conferidas, inclusive o dono de cada uma", async () => {
  preparar();
  const f = ficha(7, { status_fluxo: "conferencia_aprovada" });
  pub(f, { id: "p-a" });
  pub(f, { id: "p-b", marketplace: "outro", usuario_id: null });
  const r = await exc(f.id);
  assert.equal(r.protegida, true);
  assert.match(r.erro, /sem dono/);
  assert.equal(rpcs.length, 0);
});

test("8) registro de MLB ligado à ficha: bloqueia (o registro não é alterado)", async () => {
  preparar();
  const f = ficha(8);
  banco.tabelas.paiia_registro_mlb.push({ id: "r1", usuario_id: USUARIO, ml_user_id: LOJA, mlb_id: "MLB7654321", anuncio_id: f.id });
  const r = await exc(f.id);
  assert.equal(r.protegida, true);
  assert.match(r.erro, /registro interno/);
  assert.equal(rpcs.length, 0);
  assert.ok(semGravacao());
});

test("9) publicação com MLB, link, data ou erro de publicação: bloqueia", async () => {
  for (const extra of [{ mlb_id: "MLB1234567" }, { mlb_link: "https://x" }, { publicado_em: "2026-10-21T09:00:00Z" }, { erro_publicacao: "timeout" }, { status_bling: null }, { status_bling: "vinculado" }]) {
    preparar();
    const f = ficha(9);
    pub(f, extra);
    const r = await exc(f.id);
    assert.equal(r.protegida, true, JSON.stringify(extra));
    assert.equal(rpcs.length, 0);
  }
});

test("10) ficha de outro usuário: bloqueia", async () => {
  preparar();
  const f = ficha(10, { usuario_id: OUTRO });
  const r = await exc(f.id);
  assert.equal(r.protegida, true);
  assert.equal(rpcs.length, 0);
});

test("11) Base PAIIA gravada: bloqueia", async () => {
  preparar();
  const f = ficha(11, {}, { base_paiia: { gravacao: { ok: true, lote_id: "x" } } });
  assert.equal((await exc(f.id)).protegida, true);
  assert.equal(rpcs.length, 0);
});

// ------------------------- Mercado Livre (só leitura) -------------------------
test("12) conta escolhida: consulta o ML (só GET) e, sem anúncio, chama o banco", async () => {
  preparar();
  const f = ficha(12, { status_fluxo: "conferencia_aprovada", conta_destino_ml_user_id: LOJA });
  pub(f);
  mlFalso(mlVazio);
  const r = await exc(f.id);
  assert.equal(r.apagada, true, r.erro);
  assert.ok(banco.funcoes.length > 0 && banco.funcoes.every((x) => x.corpo.metodo === "GET" && x.corpo.conta_ml === LOJA));
  assert.equal(rpcs.length, 1);
});

test("13) ML indisponível: bloqueia", async () => {
  preparar();
  const f = ficha(13, { conta_destino_ml_user_id: LOJA });
  pub(f);
  mlFalso(() => ({ ok: false, erro: "timeout" }));
  const r = await exc(f.id);
  assert.equal(r.protegida, true);
  assert.equal(rpcs.length, 0);
});

const comAnuncio = (mlb, codigo) => (c) =>
  c.includes("seller_sku") ? { ok: true, dados: { results: [mlb] } }
    : c.includes("/items/search") ? { ok: true, dados: { results: [], paging: { total: 0 } } }
      : { ok: true, dados: { id: mlb, seller_id: LOJA, status: "active", seller_custom_field: codigo, attributes: [{ id: "SELLER_SKU", value_name: codigo }] } };

test("14) anúncio no ML sem ficha correspondente: bloqueia", async () => {
  preparar();
  const f = ficha(14, { conta_destino_ml_user_id: LOJA });
  pub(f);
  mlFalso(comAnuncio("MLB1400000", f.codigo));
  const r = await exc(f.id);
  assert.equal(r.protegida, true);
  assert.match(r.erro, /sem ficha correspondente/);
  assert.equal(rpcs.length, 0);
});

test("15) anúncio no ML que pertence a OUTRA ficha: libera (e a outra ficha não é tocada)", async () => {
  preparar();
  const outra = ficha(15, { status_fluxo: "publicado" });
  pub(outra, { mlb_id: "MLB1500000", status_publicacao: "publicado" });
  const f = ficha(16, { conta_destino_ml_user_id: LOJA, codigo: outra.codigo, codigo_normalizado: outra.codigo });
  pub(f, { sku: outra.codigo });
  mlFalso(comAnuncio("MLB1500000", outra.codigo));
  const r = await exc(f.id);
  assert.equal(r.apagada, true, r.erro);
  assert.deepEqual(rpcs[0].args, { p_ficha_id: f.id, p_versao: ANTIGO });
  assert.ok(semGravacao());
});

test("16) falha ao conferir de quem é o MLB achado no ML: bloqueia (não vira 'de ninguém')", async () => {
  preparar();
  const f = ficha(17, { conta_destino_ml_user_id: LOJA });
  pub(f);
  mlFalso(comAnuncio("MLB1700000", f.codigo));
  let leituras = 0;
  supabase.from = (t) => {
    const q = fromPaginado(t);
    if (t === "paiia_registro_mlb") {
      const exec = q.executar.bind(q);
      q.executar = async () => (++leituras === 1 ? exec() : { data: null, error: { message: "falha simulada" } });
    }
    return q;
  };
  const r = await exc(f.id);
  assert.equal(r.protegida, true);
  assert.match(r.erro, /Não foi possível conferir a base PAIIA/);
  assert.equal(rpcs.length, 0);
});

// ------------------------- resposta da função do banco -------------------------
test("17) banco recusa (erro de permissão ou rede): nada é dado como apagado", async () => {
  preparar();
  const f = ficha(18);
  respostaRpc = { data: null, error: { message: "permission denied for function" } };
  let r = await exc(f.id);
  assert.equal(r.apagada, false);
  assert.match(r.erro, /O banco recusou/);
  preparar();
  ficha(18);
  supabase.rpc = async () => { throw new Error("sem rede"); };
  r = await exc(ID(18));
  assert.equal(r.apagada, false);
  assert.match(r.erro, /Falha ao falar com o banco/);
});

test("18) banco responde 'versão alterada' ou uma proteção: repassa sem dizer que apagou", async () => {
  preparar();
  const f = ficha(19);
  respostaRpc = { data: { ok: false, motivo: "versao_alterada", mensagem: "A ficha mudou em outro computador ou aba: nada foi apagado. Atualize a lista." }, error: null };
  let r = await exc(f.id);
  assert.deepEqual([r.apagada, r.conflito, r.protegida], [false, true, false]);
  respostaRpc = { data: { ok: false, motivo: "lote_base_paiia" }, error: null };
  r = await exc(f.id);
  assert.deepEqual([r.apagada, r.protegida], [false, true]);
  assert.match(r.erro, /lote da Base PAIIA/);
  respostaRpc = { data: null, error: null };
  r = await exc(f.id);
  assert.equal(r.apagada, false);
});

// ------------------------- leitura completa (sem truncamento) -------------------------
function muitasPublicacoes(f, n, ultima = {}) {
  for (let i = 0; i < n; i++) {
    banco.tabelas.paiia_anuncios_publicacoes.push({
      id: `p-${String(i).padStart(5, "0")}`, anuncio_id: f.id, usuario_id: USUARIO, marketplace: `m${i}`, ml_user_id: null, sku: f.codigo,
      mlb_id: null, mlb_link: null, publicado_em: null, erro_publicacao: null, status_publicacao: "pendente",
      bling_produto_id: null, status_bling: "nao_verificado", updated_at: ANTIGO, ...(i === n - 1 ? ultima : {}),
    });
  }
}

test("20) 1.203 publicações (acima do limite de 1.000 do servidor): lê TODAS; um MLB na última página bloqueia", async () => {
  preparar();
  const f = ficha(20, { status_fluxo: "conferencia_aprovada" });
  muitasPublicacoes(f, 1203, { mlb_id: "MLB9999999" });
  const lida = await S.lerFichaParaExclusao(f.id);
  assert.equal(lida.ok, true, lida.erro);
  assert.equal(lida.ficha.publicacoes.length, 1203, "nenhuma linha perdida");
  assert.equal(new Set(lida.ficha.publicacoes.map((p) => p.id)).size, 1203, "nenhuma linha repetida");
  assert.ok(paginasLidas.filter((x) => x.tabela === "paiia_anuncios_publicacoes").length >= 3, "leu em várias páginas");
  const r = await exc(f.id);
  assert.equal(r.protegida, true);
  assert.match(r.erro, /Publicada no Mercado Livre/);
  assert.equal(rpcs.length, 0);
});

test("21) servidor devolve MENOS que a página pedida (limite 100): continua de onde parou e lê tudo", async () => {
  preparar();
  limiteServidor = 100;
  const f = ficha(21);
  muitasPublicacoes(f, 1203);
  const lida = await S.lerFichaParaExclusao(f.id);
  assert.equal(lida.ok, true, lida.erro);
  assert.equal(lida.ficha.publicacoes.length, 1203);
});

test("22) 1.203 registros de MLB ligados: lê todos (e bloqueia)", async () => {
  preparar();
  const f = ficha(22);
  for (let i = 0; i < 1203; i++) banco.tabelas.paiia_registro_mlb.push({ id: `r-${String(i).padStart(5, "0")}`, usuario_id: USUARIO, ml_user_id: LOJA, mlb_id: `MLB${1000000 + i}`, anuncio_id: f.id });
  const lida = await S.lerFichaParaExclusao(f.id);
  assert.equal(lida.ok, true, lida.erro);
  assert.equal(lida.registros.length, 1203);
  assert.equal((await exc(f.id)).protegida, true);
  assert.equal(rpcs.length, 0);
});

function alterarPaginas(tabela, mudar) {
  supabase.from = (t) => {
    const q = fromPaginado(t);
    if (t !== tabela) return q;
    const ex = q.executar.bind(q);
    q.executar = async () => mudar(await ex(), q);
    return q;
  };
}

test("23) contagem indisponível: bloqueia", async () => {
  preparar();
  const f = ficha(23);
  pub(f);
  alterarPaginas("paiia_anuncios_publicacoes", (r) => ({ ...r, count: null }));
  const r = await exc(f.id);
  assert.equal(r.protegida, true);
  assert.match(r.erro, /contagem de linhas indisponível/);
  assert.equal(rpcs.length, 0);
});

test("24) a contagem muda entre as páginas (alguém gravou no meio): bloqueia", async () => {
  preparar();
  const f = ficha(24);
  muitasPublicacoes(f, 1203);
  let n = 0;
  alterarPaginas("paiia_anuncios_publicacoes", (r) => ({ ...r, count: r.count + (n++ === 0 ? 0 : 1) }));
  const r = await exc(f.id);
  assert.equal(r.protegida, true);
  assert.match(r.erro, /mudaram durante a leitura/);
});

test("25) página vazia antes de completar a contagem (leitura incompleta): bloqueia", async () => {
  preparar();
  const f = ficha(25);
  muitasPublicacoes(f, 1203);
  let n = 0;
  alterarPaginas("paiia_anuncios_publicacoes", (r) => (n++ === 0 ? r : { ...r, data: [] }));
  const r = await exc(f.id);
  assert.equal(r.protegida, true);
  assert.match(r.erro, /leitura incompleta/);
});

test("26) linha repetida entre páginas: bloqueia", async () => {
  preparar();
  const f = ficha(26);
  muitasPublicacoes(f, 1203);
  let n = 0;
  alterarPaginas("paiia_anuncios_publicacoes", (r) => (n++ === 1 ? { ...r, data: [r.data[0], ...r.data.slice(0, -1)] } : r));
  const r = await exc(f.id);
  assert.equal(r.protegida, true);
  assert.match(r.erro, /repetida/);
});

test("27) falha só na segunda página do registro de MLBs: bloqueia", async () => {
  preparar();
  const f = ficha(27);
  for (let i = 0; i < 700; i++) banco.tabelas.paiia_registro_mlb.push({ id: `r-${String(i).padStart(5, "0")}`, usuario_id: USUARIO, ml_user_id: LOJA, mlb_id: `MLB${2000000 + i}`, anuncio_id: f.id });
  let n = 0;
  alterarPaginas("paiia_registro_mlb", (r) => (n++ === 1 ? { data: null, error: { message: "falha simulada" } } : r));
  const r = await exc(f.id);
  assert.equal(r.protegida, true);
  assert.match(r.erro, /registro de MLBs/);
  assert.equal(rpcs.length, 0);
});

test("28) MLBs de outras fichas: lê todas as linhas (1.100) e acha o dono na última página", async () => {
  preparar();
  const outra = ficha(28, { status_fluxo: "publicado" });
  const f = ficha(29, { conta_destino_ml_user_id: LOJA, codigo: outra.codigo, codigo_normalizado: outra.codigo });
  pub(f, { sku: outra.codigo });
  // 1.099 linhas antigas do mesmo MLB sem ficha e, por último, a que liga à OUTRA ficha.
  for (let i = 0; i < 1100; i++) banco.tabelas.paiia_registro_mlb.push({ id: `z-${String(i).padStart(5, "0")}`, usuario_id: USUARIO, ml_user_id: LOJA, mlb_id: "MLB2800000", anuncio_id: i === 1099 ? outra.id : null });
  mlFalso(comAnuncio("MLB2800000", outra.codigo));
  const r = await exc(f.id);
  assert.equal(r.apagada, true, r.erro);
  assert.ok(paginasLidas.filter((x) => x.tabela === "paiia_registro_mlb").length >= 3, "leu o registro em várias páginas");
});

test("29) MLBs de outras fichas: falha numa página seguinte bloqueia (não vira 'de ninguém')", async () => {
  preparar();
  const outra = ficha(30, { status_fluxo: "publicado" });
  const f = ficha(31, { conta_destino_ml_user_id: LOJA, codigo: outra.codigo, codigo_normalizado: outra.codigo });
  pub(f, { sku: outra.codigo });
  for (let i = 0; i < 1100; i++) banco.tabelas.paiia_registro_mlb.push({ id: `z-${String(i).padStart(5, "0")}`, usuario_id: USUARIO, ml_user_id: LOJA, mlb_id: "MLB3000000", anuncio_id: i === 1099 ? outra.id : null });
  mlFalso(comAnuncio("MLB3000000", outra.codigo));
  let n = 0;
  alterarPaginas("paiia_registro_mlb", (r) => (++n === 3 ? { data: null, error: { message: "falha simulada" } } : r));
  const r = await exc(f.id);
  assert.equal(r.protegida, true);
  assert.match(r.erro, /Não foi possível conferir a base PAIIA/);
  assert.equal(rpcs.length, 0);
});

test("30) muitos MLBs achados no ML: consulta em blocos de até 50", async () => {
  preparar();
  const f = ficha(32, { conta_destino_ml_user_id: LOJA });
  pub(f);
  const mlbs = Array.from({ length: 58 }, (_, i) => `MLB${3200000 + i}`); // abaixo do limite de 60 candidatos da conferência do ML
  for (const [i, m] of mlbs.entries()) banco.tabelas.paiia_anuncios_publicacoes.push({ id: `o-${i}`, anuncio_id: `outra-${i}`, usuario_id: USUARIO, marketplace: "mercado_livre", mlb_id: m });
  const blocos = [];
  supabase.from = (t) => {
    const q = fromPaginado(t);
    const inOriginal = q.in.bind(q);
    q.in = (k, vs) => { if (k === "mlb_id") blocos.push(vs.length); return inOriginal(k, vs); };
    return q;
  };
  mlFalso((c) => (c.includes("seller_sku") ? { ok: true, dados: { results: mlbs } } : c.includes("/items/search") ? { ok: true, dados: { results: [], paging: { total: 0 } } } : { ok: true, dados: { id: c.split("/").pop(), seller_id: LOJA, status: "active", seller_custom_field: f.codigo, attributes: [{ id: "SELLER_SKU", value_name: f.codigo }] } }));
  const r = await exc(f.id);
  assert.ok(blocos.length >= 2 && blocos.every((n) => n <= 50), `blocos: ${blocos.join(",")}`);
  assert.equal(r.apagada, true, r.erro);
});

// ------------------------- o serviço não grava -------------------------
test("19) o código do serviço não grava, não apaga e só chama a função do banco", () => {
  const fonte = fs.readFileSync(path.join(RAIZ, "src/services/exclusaoFichaService.js"), "utf8");
  assert.ok(!/\.(insert|update|upsert|delete)\(/.test(fonte), "sem INSERT/UPDATE/UPSERT/DELETE");
  assert.equal((fonte.match(/\.rpc\(/g) || []).length, 1, "uma única chamada ao banco");
  assert.ok(fonte.includes('"paiia_excluir_ficha_definitivo"'));
  assert.ok(fonte.includes('metodo: "GET"'), "ML só leitura");
  for (const c of ["usuario_id", "mlb_id", "mlb_link", "publicado_em", "erro_publicacao", "status_publicacao", "bling_produto_id", "status_bling"]) {
    assert.ok(new RegExp(`CAMPOS_PUBLICACAO =[\\s\\S]*${c}`).test(fonte), `lê ${c} das publicações`);
  }
});
