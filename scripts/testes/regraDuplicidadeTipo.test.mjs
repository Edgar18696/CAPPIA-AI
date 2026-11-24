// =============================================================
// PAIIA — TESTES: REGRA ÚNICA de duplicidade por tipo (24/11/2026).
// Mesma regra na tela principal, na revisão final e no servidor:
//   mesmo SKU + mesma conta + mesmo tipo     → bloqueia
//   mesmo SKU + mesma conta + tipo diferente → só com confirmação MANUAL (estes MLBs, este tipo)
//   tipo desconhecido                        → bloqueia
//   nunca libera sozinho.
// Tudo SIMULADO: nada é publicado nem gravado.
//   node --test scripts/testes/regraDuplicidadeTipo.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);
const R = await import("../../src/services/regraDuplicidadeTipo.js");
const P = await import("../../src/services/anuncioProvisorio.js");
const { reconhecerSKU, contasParaConsultar } = await import("../../src/services/reconhecimentoSKU.js");
const Q = await import("../../src/services/produtoExistenteSKU.js");
const F = await import("../../src/services/finalizacaoPublicacao.js");
const { SITUACAO_CONTA, montarPlanoContas } = await import("../../src/services/contasPublicacaoML.js");
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const SKU = "CM11116";
const LOJA = "1729335019";
const CIEBR = "824312524";
const REV = "2412238242";
const E = F.ESTADO_FINAL;
const CL = "gold_special";
const PR = "gold_pro";

// ---------------- 1) Regra pura ----------------
test("regra: mesmo tipo bloqueia; tipo diferente pede confirmação; desconhecido bloqueia; vazio libera", () => {
  const ex = (tipo) => [{ mlb: "MLB9000000001", tipo }];
  assert.equal(R.avaliarDuplicidadeTipo({ existentes: ex(PR), tipoNovo: "premium" }).estado, "bloqueia");
  assert.equal(R.avaliarDuplicidadeTipo({ existentes: ex(CL), tipoNovo: "classico" }).estado, "bloqueia");
  assert.equal(R.avaliarDuplicidadeTipo({ existentes: ex(PR), tipoNovo: "classico" }).estado, "confirmar");
  assert.equal(R.avaliarDuplicidadeTipo({ existentes: ex(CL), tipoNovo: "premium" }).estado, "confirmar");
  assert.equal(R.avaliarDuplicidadeTipo({ existentes: ex(""), tipoNovo: "classico" }).estado, "bloqueia", "existente sem tipo");
  assert.equal(R.avaliarDuplicidadeTipo({ existentes: ex("free"), tipoNovo: "classico" }).estado, "bloqueia", "tipo grátis não é Clássico/Premium");
  assert.equal(R.avaliarDuplicidadeTipo({ existentes: ex(PR), tipoNovo: "" }).estado, "bloqueia", "tipo do novo não definido");
  assert.equal(R.avaliarDuplicidadeTipo({ existentes: [{ mlb: "MLB1000001", tipo: CL }, { mlb: "MLB1000002", tipo: PR }], tipoNovo: "premium" }).estado, "bloqueia", "um igual já basta");
  assert.equal(R.avaliarDuplicidadeTipo({ existentes: [], incertos: [{ mlb: "MLB7000007" }], tipoNovo: "classico" }).estado, "bloqueia", "MLB registrado sem confirmação");
  assert.equal(R.avaliarDuplicidadeTipo({ existentes: [], tipoNovo: "classico" }).estado, "livre");
});

test("confirmação vale só para ESTES MLBs e ESTE tipo; nunca libera sem ela", () => {
  const av = R.avaliarDuplicidadeTipo({ existentes: [{ mlb: "MLB9000000001", tipo: PR }], tipoNovo: "classico" });
  assert.equal(R.liberaPublicacao(av, null), false, "sem confirmação não libera");
  assert.equal(R.liberaPublicacao(av, { ids: "MLB9000000001", tipo: "classico" }), true);
  assert.equal(R.liberaPublicacao(av, { ids: "MLB9000000001", tipo: CL }), true, "tipo pelo id do ML também vale");
  assert.equal(R.liberaPublicacao(av, { ids: "MLB9000000002", tipo: "classico" }), false, "outro MLB");
  assert.equal(R.liberaPublicacao(av, { ids: "MLB9000000001", tipo: "premium" }), false, "outro tipo");
  const bloq = R.avaliarDuplicidadeTipo({ existentes: [{ mlb: "MLB9000000001", tipo: CL }], tipoNovo: "classico" });
  assert.equal(R.liberaPublicacao(bloq, { ids: "MLB9000000001", tipo: "classico" }), false, "mesmo tipo nunca libera, nem confirmado");
  // Surgiu outro anúncio depois da confirmação: a confirmação antiga não vale.
  const depois = R.avaliarDuplicidadeTipo({ existentes: [{ mlb: "MLB9000000001", tipo: PR }, { mlb: "MLB9000000003", tipo: PR }], tipoNovo: "classico" });
  assert.equal(R.liberaPublicacao(depois, { ids: "MLB9000000001", tipo: "classico" }), false);
});

test("a regra do servidor é cópia idêntica da regra do PAIIA", () => {
  assert.equal(ler("supabase/functions/_shared/regraDuplicidadeTipo.js"), ler("src/services/regraDuplicidadeTipo.js"));
});

test("revisão final (avaliarOutroAnuncioNaConta) usa a mesma regra, inclusive tipo do novo desconhecido", () => {
  const ml = { verificado: true, duplicados: [{ id: "MLB9000000001", tipo: PR }] };
  assert.equal(P.avaliarOutroAnuncioNaConta({ ml, tipoAnuncio: "classico" }).estado, "confirmar");
  assert.equal(P.avaliarOutroAnuncioNaConta({ ml, tipoAnuncio: "premium" }).estado, "bloqueia");
  assert.equal(P.avaliarOutroAnuncioNaConta({ ml }).estado, "bloqueia", "sem tipo do novo = bloqueia");
});

// ---------------- 2) Servidor: conferência antes de criar ----------------
function mlServidor(itens = [], { falhar = false } = {}) {
  const chamadas = [];
  const lerML = async (c) => {
    chamadas.push(c);
    if (falhar) throw new Error("ML fora do ar (simulado)");
    const s = c.match(/\/users\/(\d+)\/items\/search\?seller_sku=([^&]+)(&status=paused)?/);
    if (s) {
      const pausado = Boolean(s[3]);
      return { results: itens.filter((i) => String(i.seller_id) === s[1] && (i.status === "paused") === pausado && [i.seller_custom_field].includes(decodeURIComponent(s[2]))).map((i) => i.id) };
    }
    const it = c.match(/^\/items\/(MLB\d+)$/);
    if (it) return itens.find((i) => i.id === it[1]) || null;
    throw new Error(`rota não simulada ${c}`);
  };
  return { lerML, chamadas };
}
const itemML = (id, tipo, extra = {}) => ({ id, seller_id: Number(LOJA), status: "active", listing_type_id: tipo, seller_custom_field: SKU, ...extra });

test("servidor: mesmo tipo bloqueia; tipo diferente só com a confirmação; pausado conta; encerrado e outra conta não", async () => {
  const conf = (itens, tipoNovo, confirmacao = null) => R.conferirDuplicidadeNaConta({ sku: SKU, conta: LOJA, tipoNovo, confirmacao, ler: mlServidor(itens).lerML });
  let r = await conf([itemML("MLB9000000001", PR)], PR);
  assert.equal(r.libera, false); assert.match(r.texto, /Nada foi enviado/);
  r = await conf([itemML("MLB9000000001", PR)], CL);
  assert.equal(r.libera, false, "tipo diferente sem confirmação");
  r = await conf([itemML("MLB9000000001", PR)], CL, { ids: "MLB9000000001", tipo: CL });
  assert.equal(r.libera, true);
  r = await conf([itemML("MLB9000000001", PR, { status: "paused" })], PR);
  assert.equal(r.libera, false, "pausado conta como existente");
  r = await conf([itemML("MLB9000000001", PR, { status: "closed" })], PR);
  assert.equal(r.libera, true, "encerrado não bloqueia");
  r = await conf([itemML("MLB9000000001", PR, { seller_id: Number(CIEBR) })], PR);
  assert.equal(r.libera, true, "outra conta não bloqueia");
  r = await conf([itemML("MLB9000000001", "")], CL, { ids: "MLB9000000001", tipo: CL });
  assert.equal(r.libera, false, "tipo existente desconhecido bloqueia mesmo com confirmação");
  r = await conf([], "");
  assert.equal(r.libera, true, "nenhum anúncio do SKU: livre");
});

test("servidor: falha de leitura ou sem SKU = bloqueia (nunca libera no escuro)", async () => {
  let r = await R.conferirDuplicidadeNaConta({ sku: SKU, conta: LOJA, tipoNovo: CL, ler: mlServidor([], { falhar: true }).lerML });
  assert.equal(r.libera, false); assert.match(r.texto, /não conferida/);
  r = await R.conferirDuplicidadeNaConta({ sku: "", conta: LOJA, tipoNovo: CL, ler: mlServidor([]).lerML });
  assert.equal(r.libera, false);
});

test("servidor: index.ts chama a conferência ANTES da trava e do POST /items", () => {
  const s = ler("supabase/functions/mercadolivre-publicacao/index.ts");
  const iDup = s.indexOf("conferirDuplicidadeNaConta({");
  const iTrava = s.indexOf('from("ml_publicacoes_autorizacoes")\n          .insert');
  const iPost = s.indexOf('ml("/items", { method: "POST"');
  assert.ok(iDup > 0 && iTrava > iDup && iPost > iDup, "ordem: duplicidade → trava → envio");
  assert.match(s, /confirmacao: corpo\?\.duplicidade_confirmada \|\| null/);
});

// ---------------- 3) Tela principal ----------------
function mlFalso(itens) {
  const consultarML = async (conta, caminho) => {
    const daConta = itens.filter((i) => String(i.seller_id) === String(conta));
    const s = caminho.match(/\/items\/search\?seller_sku=([^&]+)/);
    if (s) return { ok: true, dados: { results: daConta.filter((i) => i.seller_custom_field === decodeURIComponent(s[1])).map((i) => i.id) } };
    if (/\/items\/search\?q=/.test(caminho)) return { ok: true, dados: { results: [], paging: { total: 0 } } };
    const it = caminho.match(/^\/items\/(MLB\d+)$/);
    if (it) { const x = itens.find((i) => i.id === it[1]); return x ? { ok: true, dados: x } : { ok: false, status: 404, erro: "not_found" }; }
    return { ok: false, erro: `rota não simulada ${caminho}` };
  };
  return consultarML;
}
const liberada = (conta) => ({ conta, situacao: SITUACAO_CONTA.LIBERADA, impedimentos: [], itens: [] });
async function telaPrincipal({ itens, tipoAnuncio }) {
  const consultarML = mlFalso(itens);
  const contas = contasParaConsultar([{ ml_user_id: LOJA }, { ml_user_id: CIEBR }, { ml_user_id: REV }]);
  const fichas = [{ id: "f1", codigo: SKU, titulo: "Bobina", status_fluxo: "conferencia_aprovada", updated_at: "2026-11-24T10:00:00Z", publicacao: null }];
  const rec = await reconhecerSKU({ codigo: SKU, contas, lerBling: async () => ({ ok: true, encontrado: true, produto: { id: "1", codigo: SKU, nome: "Bobina" } }), lerBase: async () => ({ ok: true, anuncios: fichas }), consultarML, lerRegistro: async () => ({ ok: true, registros: [] }) });
  rec.identidades = await Q.identidadesDasFichas({ codigo: SKU, fichas, reconhecimento: rec, consultarML });
  const quadro = Q.quadroProdutoExistente({ fichas, reconhecimento: rec });
  const res = F.situacaoFinalDasContas({ ficha: { id: "f1" }, quadro, verificacoes: [LOJA, CIEBR, REV].map(liberada), fotos: 1, sku: SKU, tipoAnuncio });
  return (c) => res.linhas.find((l) => l.conta === c);
}

test("tela principal: Premium existente + novo Clássico = CONFERIR com confirmação manual (estes MLBs, este tipo)", async () => {
  const linha = await telaPrincipal({ itens: [itemML("MLB9000000001", PR)], tipoAnuncio: "classico" });
  assert.equal(linha(LOJA).estado, E.CONFERIR);
  assert.equal(linha(LOJA).acao.tipo, "publicar");
  assert.deepEqual(linha(LOJA).acao.outroTipo, { ids: "MLB9000000001", tipo: CL });
  assert.match(linha(LOJA).acao.texto, /Confirmo outro anúncio Clássico/);
  assert.match(linha(LOJA).motivos[0], /tipo diferente/);
  assert.equal(linha(CIEBR).estado, E.PENDENTE, "outras contas sem anúncio seguem normais");
});

test("tela principal: mesmo tipo ou tipo desconhecido = JÁ EXISTENTE, sem botão", async () => {
  let linha = await telaPrincipal({ itens: [itemML("MLB9000000001", PR)], tipoAnuncio: "premium" });
  assert.equal(linha(LOJA).estado, E.JA_EXISTENTE);
  assert.equal(linha(LOJA).acao.tipo, "nenhuma");
  linha = await telaPrincipal({ itens: [itemML("MLB9000000001", "")], tipoAnuncio: "classico" });
  assert.equal(linha(LOJA).estado, E.JA_EXISTENTE);
  assert.match(linha(LOJA).motivos.join(" "), /desconhecido/);
  linha = await telaPrincipal({ itens: [itemML("MLB9000000001", PR)], tipoAnuncio: "" });
  assert.equal(linha(LOJA).estado, E.JA_EXISTENTE, "tipo da ficha não informado");
});

test("plano da publicação guarda a confirmação só da conta confirmada", () => {
  const resultados = [{ conta: LOJA, nome: "LOJA ONLINE", situacao: SITUACAO_CONTA.CONFERIR, impedimentos: [] }];
  const plano = montarPlanoContas({ selecao: [LOJA], resultados, conferidas: { [LOJA]: true }, outroTipo: { [LOJA]: { ids: "MLB9000000001", tipo: CL }, [CIEBR]: { ids: "MLB1", tipo: CL } }, agora: "2026-11-24T12:00:00Z" });
  assert.deepEqual(plano.outro_tipo_confirmado, { [LOJA]: { ids: "MLB9000000001", tipo: CL, confirmado_em: "2026-11-24T12:00:00Z" } });
  const semConf = montarPlanoContas({ selecao: [LOJA], resultados, conferidas: {}, outroTipo: { [LOJA]: { ids: "MLB9000000001", tipo: CL } } });
  assert.equal(semConf.outro_tipo_confirmado, undefined, "conta não confirmada não leva confirmação");
});

// ---------------- 4) Revisão final automática ----------------
test("revisão final automática confere de novo na hora do envio e exige a confirmação gravada", () => {
  const s = ler("src/components/RevisaoPublicacaoML.jsx");
  assert.match(s, /const baseLida = await consultarDuplicidadeBase\(contaEscolhida\);/);
  assert.match(s, /const noML = base\.erro \? null : await consultarDuplicidadeML\(contaEscolhida/);
  assert.match(s, /outro_tipo_confirmado\?\.\[String\(contaEscolhida\)\]/);
  assert.match(s, /confirmacaoValida\(outroAgora, confAuto\)/);
  assert.match(s, /duplicidade_confirmada: duplicidadeConfirmada/);
  assert.doesNotMatch(s, /autoPublicacao \? \{ registros: \[\] \}/, "o automático não pula mais a conferência");
});
