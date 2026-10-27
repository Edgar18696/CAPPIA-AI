// =============================================================
// PAIIA — TESTES DE INTEGRAÇÃO do Arquivo 5:
// src/services/anuncioPublicacaoService.js — ficha excluída definitivamente
// NUNCA é recriada pelos salvamentos (Conferência, "Próximo passo", conta).
// Fluxo real: os serviços de verdade gravam no Supabase FALSO; a exclusão
// passa pelo serviço do Arquivo 3 e por uma função de banco simulada que
// apaga a ficha (e as publicações, como o CASCADE). Sem rede.
//   node --test scripts/testes/fichaExcluidaNaoRenasce.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);
const { banco, zerarBanco, supabase } = await import("./simulacao/supabaseFalso.mjs");
const PUB = await import("../../src/services/anuncioPublicacaoService.js");
const EXC = await import("../../src/services/exclusaoFichaService.js");
const { TEXTO_FICHA_EXCLUIDA } = await import("../../src/services/exclusaoFicha.js");

const LOJA = "1729335019";
const AGORA_TESTE = Date.parse("2099-01-01T00:00:00Z"); // longe da criação: sem a espera de 15 min
const originalFrom = supabase.from;

// Paginação com contagem (o serviço de exclusão exige leitura completa).
function fromPaginado(t) {
  const q = originalFrom(t);
  const sel = q.select.bind(q);
  q.select = (c, o) => { q._contar = o?.count === "exact"; return sel(c); };
  q.order = () => q;
  q.range = (a, b) => { q._faixa = [a, b]; return q; };
  const ex = q.executar.bind(q);
  q.executar = async () => {
    const r = await ex();
    if (r.error || !Array.isArray(r.data) || q.op !== "select" || !q._faixa) return r;
    return { data: r.data.slice(q._faixa[0], q._faixa[1] + 1), error: null, count: q._contar ? r.data.length : null };
  };
  return q;
}
// Função do banco SIMULADA: apaga a ficha e, como o CASCADE, as publicações dela.
function bancoApaga() {
  supabase.rpc = async (nome, { p_ficha_id }) => {
    banco.funcoes.push({ nome });
    const antes = banco.tabelas.paiia_anuncios.length;
    banco.tabelas.paiia_anuncios = banco.tabelas.paiia_anuncios.filter((f) => f.id !== p_ficha_id);
    banco.tabelas.paiia_anuncios_publicacoes = banco.tabelas.paiia_anuncios_publicacoes.filter((p) => p.anuncio_id !== p_ficha_id);
    return { data: antes > banco.tabelas.paiia_anuncios.length ? { ok: true, motivo: "apagada" } : { ok: false, motivo: "nao_encontrada" }, error: null };
  };
}
function preparar() {
  zerarBanco();
  supabase.from = fromPaginado;
  supabase.functions.invoke = async () => ({ data: { ok: true, dados: { results: [], paging: { total: 0 } } }, error: null });
  bancoApaga();
}
const fichas = () => banco.tabelas.paiia_anuncios.length;
const insercoes = () => banco.chamadas.filter((c) => c.tabela === "paiia_anuncios" && c.op === "insert").length;

async function criarFichaEApagar({ comConta = false } = {}) {
  const r = await PUB.salvarRascunhoFicha({ anuncioId: "", codigo: "990777", titulo: "Ficha de teste", dadosConferencia: { salvo_em: "v1" } });
  assert.equal(r.ok, true, r.erro);
  const id = r.anuncioId;
  if (comConta) {
    assert.equal((await PUB.salvarContaDestino({ anuncioId: id, codigo: "990777", titulo: "Ficha de teste", contaId: LOJA, contaNome: "LOJA ONLINE" })).ok, true);
    // O banco falso não tem valores padrão: aqui o status do Bling recebe
    // "nao_verificado". (Se na produção o padrão for vazio, a ficha fica
    // protegida — é o comportamento seguro já documentado no Arquivo 1.)
    for (const p of banco.tabelas.paiia_anuncios_publicacoes) if (p.anuncio_id === id) p.status_bling = "nao_verificado";
  }
  const ex = await EXC.excluirFichaDefinitivamente(id, { agora: AGORA_TESTE });
  assert.equal(ex.apagada, true, ex.erro);
  assert.equal(banco.tabelas.paiia_anuncios.some((f) => f.id === id), false, "ficha apagada");
  return id;
}

test("1) Conferência (salvamento automático) numa ficha apagada: NÃO recria", async () => {
  preparar();
  const id = await criarFichaEApagar();
  const [n, ins] = [fichas(), insercoes()];
  const r = await PUB.salvarRascunhoFicha({ anuncioId: id, codigo: "990777", titulo: "editado depois", dadosConferencia: { salvo_em: "v2" }, versaoEsperada: "v1" });
  assert.deepEqual([r.ok, r.fechada, r.excluida], [false, true, true]);
  assert.equal(r.erro, TEXTO_FICHA_EXCLUIDA);
  assert.deepEqual([fichas(), insercoes()], [n, ins], "nenhuma ficha criada");
});

test("2) mesmo com criarSeFechada (abertura de anúncio novo pela Conferência): NÃO recria a apagada", async () => {
  preparar();
  const id = await criarFichaEApagar();
  const n = fichas();
  const r = await PUB.salvarRascunhoFicha({ anuncioId: id, codigo: "990777", titulo: "x", dadosConferencia: { salvo_em: "v2" }, criarSeFechada: true });
  assert.equal(r.excluida, true);
  assert.equal(fichas(), n);
});

test("3) 'Próximo passo' (aprovar) numa ficha apagada: NÃO recria", async () => {
  preparar();
  const id = await criarFichaEApagar();
  const n = fichas();
  const r = await PUB.salvarFichaAprovada({ anuncioId: id, codigo: "990777", titulo: "x", dadosConferencia: { salvo_em: "v1" }, versaoEsperada: "v1" });
  assert.deepEqual([r.ok, r.excluida], [false, true]);
  assert.equal(fichas(), n);
});

test("4) escolher conta numa ficha apagada (com publicação pendente apagada junto): NÃO recria ficha nem publicação", async () => {
  preparar();
  const id = await criarFichaEApagar({ comConta: true });
  assert.equal(banco.tabelas.paiia_anuncios_publicacoes.length, 0, "publicação pendente saiu junto (CASCADE)");
  const n = fichas();
  const r = await PUB.salvarContaDestino({ anuncioId: id, codigo: "990777", titulo: "x", contaId: LOJA, contaNome: "LOJA ONLINE" });
  assert.deepEqual([r.ok, r.excluida], [false, true]);
  assert.equal(fichas(), n);
  assert.equal(banco.tabelas.paiia_anuncios_publicacoes.length, 0, "nenhuma publicação recriada");
  assert.equal(banco.chamadas.filter((c) => c.tabela === "paiia_anuncios_publicacoes" && c.op === "upsert").length, 1, "só o upsert de antes da exclusão");
});

test("5) outra aba / outro computador salvando várias vezes depois da exclusão: nunca recria", async () => {
  preparar();
  const id = await criarFichaEApagar();
  const n = fichas();
  for (let i = 0; i < 5; i++) {
    await PUB.salvarRascunhoFicha({ anuncioId: id, codigo: "990777", titulo: `aba ${i}`, dadosConferencia: { salvo_em: `v${i + 2}` } });
    await PUB.salvarFichaAprovada({ anuncioId: id, codigo: "990777", titulo: `aba ${i}`, dadosConferencia: {} });
    await PUB.salvarContaDestino({ anuncioId: id, codigo: "990777", titulo: `aba ${i}`, contaId: LOJA, contaNome: "LOJA ONLINE" });
  }
  assert.equal(fichas(), n);
});

test("6) PRESERVADO: sem ID continua criando ficha nova; com ID existente continua atualizando a mesma", async () => {
  preparar();
  const a = await PUB.salvarRascunhoFicha({ anuncioId: "", codigo: "990888", titulo: "nova", dadosConferencia: { salvo_em: "v1" } });
  assert.deepEqual([a.ok, a.nova], [true, true]);
  const b = await PUB.salvarRascunhoFicha({ anuncioId: a.anuncioId, codigo: "990888", titulo: "editada", dadosConferencia: { salvo_em: "v2" }, versaoEsperada: "v1" });
  assert.deepEqual([b.ok, b.nova, b.anuncioId], [true, false, a.anuncioId]);
  const c = await PUB.salvarFichaAprovada({ anuncioId: a.anuncioId, codigo: "990888", titulo: "aprovada", dadosConferencia: {}, versaoEsperada: "v2" });
  assert.deepEqual([c.ok, c.nova], [true, false]);
  const d = await PUB.salvarContaDestino({ anuncioId: a.anuncioId, codigo: "990888", titulo: "aprovada", contaId: LOJA, contaNome: "LOJA ONLINE" });
  assert.equal(d.ok, true, d.erro);
  assert.equal(fichas(), 1, "a mesma ficha o tempo todo");
  const e = await PUB.salvarContaDestino({ anuncioId: "", codigo: "990889", titulo: "sem id", contaId: LOJA, contaNome: "LOJA ONLINE" });
  assert.equal(e.ok, true);
  assert.equal(fichas(), 2, "escolher conta sem ID continua criando a ficha");
});

test("7) PRESERVADO: ficha publicada + 'Próximo passo' continua criando uma ficha NOVA (outro anúncio do mesmo código)", async () => {
  preparar();
  const a = await PUB.salvarRascunhoFicha({ anuncioId: "", codigo: "990999", titulo: "publicada", dadosConferencia: { salvo_em: "v1" } });
  banco.tabelas.paiia_anuncios_publicacoes.push({ id: "p1", anuncio_id: a.anuncioId, marketplace: "mercado_livre", mlb_id: "MLB1234567", status_publicacao: "publicado" });
  const r = await PUB.salvarFichaAprovada({ anuncioId: a.anuncioId, codigo: "990999", titulo: "outro anúncio", dadosConferencia: {} });
  assert.deepEqual([r.ok, r.nova], [true, true]);
  assert.notEqual(r.anuncioId, a.anuncioId);
});

test("8) PRESERVADO: falha ao ler a ficha continua devolvendo a falha (sem criar e sem dizer 'excluída')", async () => {
  preparar();
  const a = await PUB.salvarRascunhoFicha({ anuncioId: "", codigo: "990555", titulo: "x", dadosConferencia: { salvo_em: "v1" } });
  banco.falhar["paiia_anuncios:select"] = true;
  const n = fichas();
  for (const r of [
    await PUB.salvarRascunhoFicha({ anuncioId: a.anuncioId, codigo: "990555", titulo: "x", dadosConferencia: {} }),
    await PUB.salvarFichaAprovada({ anuncioId: a.anuncioId, codigo: "990555", titulo: "x", dadosConferencia: {} }),
    await PUB.salvarContaDestino({ anuncioId: a.anuncioId, codigo: "990555", titulo: "x", contaId: LOJA, contaNome: "LOJA ONLINE" }),
  ]) {
    assert.equal(r.ok, false);
    assert.notEqual(r.excluida, true);
  }
  assert.equal(fichas(), n);
});
