// =============================================================
// PAIIA — TESTES DE INTEGRAÇÃO do Arquivo 6:
// src/services/fichaNovoAnuncioService.js — o Novo Anúncio NUNCA recria uma
// ficha excluída definitivamente (esta aba, outra aba ou outro computador).
// Serviços reais + Supabase FALSO; exclusão pelo serviço do Arquivo 3 com a
// função do banco simulada (apaga a ficha e, como o CASCADE, as publicações).
//   node --test scripts/testes/novoAnuncioFichaExcluida.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);
const { banco, zerarBanco, supabase } = await import("./simulacao/supabaseFalso.mjs");
const NA = await import("../../src/services/fichaNovoAnuncioService.js");
const PUB = await import("../../src/services/anuncioPublicacaoService.js");
const EXC = await import("../../src/services/exclusaoFichaService.js");
const { TEXTO_FICHA_EXCLUIDA } = await import("../../src/services/exclusaoFicha.js");

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const AGORA_TESTE = Date.parse("2099-01-01T00:00:00Z");
const originalFrom = supabase.from;
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
function preparar() {
  zerarBanco();
  supabase.from = fromPaginado;
  supabase.rpc = async (nome, { p_ficha_id }) => {
    const antes = banco.tabelas.paiia_anuncios.length;
    banco.tabelas.paiia_anuncios = banco.tabelas.paiia_anuncios.filter((f) => f.id !== p_ficha_id);
    banco.tabelas.paiia_anuncios_publicacoes = banco.tabelas.paiia_anuncios_publicacoes.filter((p) => p.anuncio_id !== p_ficha_id);
    return { data: antes > banco.tabelas.paiia_anuncios.length ? { ok: true, motivo: "apagada" } : { ok: false, motivo: "nao_encontrada" }, error: null };
  };
}
const montado = (titulo = "Teste") => ({ anuncio: { titulo }, novo_anuncio: { titulo, fotos: ["https://x.invalid/f1.jpg"] } });
const fichas = () => banco.tabelas.paiia_anuncios.length;
const insercoes = () => banco.chamadas.filter((c) => c.tabela === "paiia_anuncios" && c.op === "insert").length;

async function fichaDoNovoAnuncioApagada() {
  const a = await NA.salvarFichaNovoAnuncio({ fichaId: "", codigo: "990321", titulo: "Rascunho de teste", montado: montado() });
  assert.deepEqual([a.ok, a.nova], [true, true], a.erro);
  const ex = await EXC.excluirFichaDefinitivamente(a.fichaId, { agora: AGORA_TESTE });
  assert.equal(ex.apagada, true, ex.erro);
  return a.fichaId;
}

test("1) Novo Anúncio salvando numa ficha apagada: NÃO recria e avisa", async () => {
  preparar();
  const id = await fichaDoNovoAnuncioApagada();
  const [n, ins] = [fichas(), insercoes()];
  const r = await NA.salvarFichaNovoAnuncio({ fichaId: id, codigo: "990321", titulo: "editado depois", montado: montado("editado") });
  assert.deepEqual([r.ok, r.fechada, r.excluida, r.fichaId], [false, true, true, id]);
  assert.equal(r.erro, TEXTO_FICHA_EXCLUIDA);
  assert.deepEqual([fichas(), insercoes()], [n, ins], "nenhuma ficha criada");
});

test("2) outra aba / outro computador com o Novo Anúncio aberto, salvando várias vezes: nunca recria", async () => {
  preparar();
  const id = await fichaDoNovoAnuncioApagada();
  const n = fichas();
  for (let i = 0; i < 10; i++) {
    const r = await NA.salvarFichaNovoAnuncio({ fichaId: id, codigo: "990321", titulo: `aba ${i}`, montado: montado(`aba ${i}`) });
    assert.equal(r.excluida, true);
  }
  assert.equal(fichas(), n);
});

test("3) a mesma ficha apagada também não volta pela Conferência, pelo 'Próximo passo' nem pela escolha de conta", async () => {
  preparar();
  const id = await fichaDoNovoAnuncioApagada();
  const n = fichas();
  assert.equal((await PUB.salvarRascunhoFicha({ anuncioId: id, codigo: "990321", titulo: "x", dadosConferencia: { salvo_em: "v2" } })).excluida, true);
  assert.equal((await PUB.salvarFichaAprovada({ anuncioId: id, codigo: "990321", titulo: "x", dadosConferencia: {} })).excluida, true);
  assert.equal((await PUB.salvarContaDestino({ anuncioId: id, codigo: "990321", titulo: "x", contaId: "1729335019", contaNome: "LOJA ONLINE" })).excluida, true);
  assert.equal((await NA.salvarFichaNovoAnuncio({ fichaId: id, codigo: "990321", titulo: "x", montado: montado() })).excluida, true);
  assert.equal(fichas(), n);
});

test("4) PRESERVADO: sem ID cria ficha nova; com ID existente atualiza a mesma; código muda só no Novo Anúncio", async () => {
  preparar();
  const a = await NA.salvarFichaNovoAnuncio({ fichaId: "", codigo: "990400", titulo: "nova", montado: montado() });
  assert.deepEqual([a.ok, a.nova], [true, true]);
  const b = await NA.salvarFichaNovoAnuncio({ fichaId: a.fichaId, codigo: "990401", titulo: "editada", montado: montado("editada") });
  assert.deepEqual([b.ok, b.nova, b.fichaId], [true, false, a.fichaId]);
  assert.equal(fichas(), 1);
  assert.equal(banco.tabelas.paiia_anuncios[0].codigo, "990401");
});

test("5) ID preenchido mas inválido: bloqueia e NÃO cria outra ficha", async () => {
  preparar();
  for (const id of ["rascunho-antigo-sem-uuid", "123", "aaaaaaaa-0000-4000-8000", " lixo "]) {
    const r = await NA.salvarFichaNovoAnuncio({ fichaId: id, codigo: "990500", titulo: "x", montado: montado() });
    assert.deepEqual([r.ok, r.idInvalido], [false, true], id);
    assert.match(r.erro, /inválida/);
  }
  assert.deepEqual([fichas(), insercoes()], [0, 0], "nenhuma ficha criada");
  const semId = await NA.salvarFichaNovoAnuncio({ fichaId: "", codigo: "990501", titulo: "x", montado: montado() });
  assert.deepEqual([semId.ok, semId.nova], [true, true], "sem ID (vazio) continua criando");
  const espacos = await NA.salvarFichaNovoAnuncio({ fichaId: "   ", codigo: "990502", titulo: "x", montado: montado() });
  assert.deepEqual([espacos.ok, espacos.nova], [true, true], "só espaços conta como vazio");
});

test("6) PRESERVADO: ficha publicada continua fechada para o Novo Anúncio (sem 'excluída')", async () => {
  preparar();
  const a = await NA.salvarFichaNovoAnuncio({ fichaId: "", codigo: "990600", titulo: "x", montado: montado() });
  banco.tabelas.paiia_anuncios_publicacoes.push({ id: "p1", anuncio_id: a.fichaId, marketplace: "mercado_livre", mlb_id: "MLB1234567", status_publicacao: "publicado" });
  banco.tabelas.paiia_anuncios[0].status_fluxo = "publicado";
  const r = await NA.salvarFichaNovoAnuncio({ fichaId: a.fichaId, codigo: "990600", titulo: "y", montado: montado("y") });
  assert.deepEqual([r.ok, r.fechada], [false, true]);
  assert.notEqual(r.excluida, true);
  assert.equal(fichas(), 1);
});

test("7) PRESERVADO: falha ao ler a ficha devolve a falha (sem criar e sem dizer 'excluída')", async () => {
  preparar();
  const a = await NA.salvarFichaNovoAnuncio({ fichaId: "", codigo: "990700", titulo: "x", montado: montado() });
  banco.falhar["paiia_anuncios:select"] = true;
  const r = await NA.salvarFichaNovoAnuncio({ fichaId: a.fichaId, codigo: "990700", titulo: "x", montado: montado() });
  assert.equal(r.ok, false);
  assert.notEqual(r.excluida, true);
  assert.equal(fichas(), 1);
});

test("8) a tela do Novo Anúncio já para de gravar quando a resposta é 'fechada' (código atual, sem mudança)", () => {
  const hook = fs.readFileSync(path.join(RAIZ, "src/hooks/useFichaNovoAnuncio.js"), "utf8");
  assert.ok(hook.includes("} else if (r.fechada) {") && hook.includes("st.fechada = st.id;"), "guarda que a ficha está fechada");
  assert.ok(hook.includes("if (st.fechada && st.fechada === st.id) return { ok: false, fechada: true"), "não tenta gravar de novo");
});
