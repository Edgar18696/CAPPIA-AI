// =============================================================
// PAIIA — TESTES: persistência segura da ficha (tipo de anúncio,
// abertura sem gravação, aprovação, versão/conflito, bloqueio).
//   node --test scripts/testes/persistenciaFicha.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import {
  tipoAnuncioDaFicha,
  compararVersoesFicha,
  decidirAberturaFicha,
  camposQueInvalidam,
  motivoBloqueioPublicacao,
  ESTADO_GRAVACAO,
  TEXTO_GRAVACAO,
  TEXTO_CAMPO_ALTERADO,
} from "../../src/services/persistenciaFicha.js";

const ID = "d446e14a-acd0-4cf8-a967-46de8478dc73";
const ficha = (extra = {}) => ({
  campos: { anuncioIdPAIIA: ID, titulo: "Haste Fechadura Master II", preco: "64.08", descricao: "Haste", marca: "Renault ", categoriaML: { id: "MLB194431" }, compatibilidades: "Master II", quantidadeEstoque: "1", tipoVeiculo: "Carro/Caminhonete", condicao: "novo", fotos: [], ...(extra.campos || {}) },
  anuncioConferido: { tipoAnuncio: "premium", fotos: ["a.jpg", "b.jpg"] },
  assinaturaAprovada: "[\"x\"]",
  ...extra.raiz,
});

test("tipo de anúncio: Premium da ficha vence a preferência Clássico", () => {
  assert.equal(tipoAnuncioDaFicha({ fichaSalva: ficha(), anuncio: { tipoAnuncio: "classico" }, preferencia: "classico" }), "premium");
});
test("tipo de anúncio: Clássico da ficha vence a preferência Premium", () => {
  const f = ficha({ campos: { tipoAnuncio: "classico" } });
  assert.equal(tipoAnuncioDaFicha({ fichaSalva: f, preferencia: "premium" }), "classico");
});
test("tipo de anúncio: preferência só sugere para ficha NOVA sem tipo", () => {
  assert.equal(tipoAnuncioDaFicha({ fichaSalva: null, anuncio: {}, preferencia: "premium" }), "premium");
  assert.equal(tipoAnuncioDaFicha({ fichaSalva: null, anuncio: { fichaIdPAIIA: ID }, preferencia: "premium" }), "classico");
  assert.equal(tipoAnuncioDaFicha({ fichaSalva: null, anuncio: { tipoAnuncio: "premium" }, preferencia: "classico" }), "premium");
  assert.equal(tipoAnuncioDaFicha({ fichaSalva: { campos: {}, aprovacaoAnterior: { anuncioConferido: { tipoAnuncio: "premium" } } }, preferencia: "classico" }), "premium");
});

test("comparação: mesma ficha não tem diferenças; título diferente aparece com rótulo", () => {
  assert.deepEqual(compararVersoesFicha(ficha(), ficha()), []);
  const d = compararVersoesFicha(ficha({ campos: { titulo: "Outro" } }), ficha());
  assert.equal(d.length, 1);
  assert.equal(d[0].campo, "titulo");
  assert.equal(d[0].rotulo, "Título");
  assert.equal(d[0].tela, "Outro");
});
test("comparação: preço com vírgula = ponto; tipo vazio de um lado não conta", () => {
  assert.deepEqual(compararVersoesFicha(ficha({ campos: { preco: "64,08" } }), ficha()), []);
  const semTipo = ficha({ raiz: { anuncioConferido: { fotos: ["a.jpg", "b.jpg"] } } });
  assert.deepEqual(compararVersoesFicha(semTipo, ficha()), []);
});

test("abertura: sem cópia local / outra ficha → usar base", () => {
  assert.equal(decidirAberturaFicha({ id: ID, local: null, baseDados: {} }).acao, "usar_base");
  assert.equal(decidirAberturaFicha({ id: ID, local: { campos: { anuncioIdPAIIA: "outro" } }, baseDados: {} }).acao, "usar_base");
});
test("abertura: cópia partiu da versão atual → mesma_versao", () => {
  const local = { ...ficha(), versaoBase: "2026-10-07T18:38:38.128Z", salvoEm: "2026-10-07T18:49:00Z" };
  assert.equal(decidirAberturaFicha({ id: ID, local, baseDados: { salvo_em: "2026-10-07T18:38:38.128Z", ficha: ficha() } }).acao, "mesma_versao");
});
test("abertura: versão diferente mas mesmo conteúdo → conteudo_igual (cura o falso conflito)", () => {
  const local = { ...ficha(), versaoBase: "velha", salvoEm: "2026-10-07T19:00:00Z" };
  assert.equal(decidirAberturaFicha({ id: ID, local, baseDados: { salvo_em: "2026-10-07T18:38:38Z", ficha: ficha() } }).acao, "conteudo_igual");
});
test("abertura: cópia local MAIS NOVA e diferente → conflito (nunca descartada)", () => {
  const local = { ...ficha({ campos: { titulo: "Local" } }), versaoBase: "velha", salvoEm: "2026-10-07T19:00:00Z" };
  const r = decidirAberturaFicha({ id: ID, local, baseDados: { salvo_em: "2026-10-07T18:38:38Z", ficha: ficha() } });
  assert.equal(r.acao, "conflito");
  assert.equal(r.diferencas[0].campo, "titulo");
});
test("abertura: cópia local mais ANTIGA e diferente → base (a cópia é guardada pela tela)", () => {
  const local = { ...ficha({ campos: { titulo: "Velha" } }), versaoBase: "velha", salvoEm: "2026-10-07T17:00:00Z" };
  const r = decidirAberturaFicha({ id: ID, local, baseDados: { salvo_em: "2026-10-07T18:38:38Z", ficha: ficha() } });
  assert.equal(r.acao, "usar_base");
  assert.equal(r.diferencas.length, 1);
});

test("aprovação: carregamento/normalização sem edição não invalida", () => {
  assert.deepEqual(camposQueInvalidam({ usuarioEditou: false, mudou: ["tipo de anúncio", "título"] }), []);
});
test("aprovação: edição real invalida só o que mudou depois do carregamento", () => {
  assert.deepEqual(camposQueInvalidam({ usuarioEditou: true, mudou: ["tipo de anúncio", "título"], divergentesNoCarregamento: ["tipo de anúncio"] }), ["título"]);
  // campo que veio diferente no carregamento, mas o usuário mexeu nele depois: invalida
  assert.deepEqual(camposQueInvalidam({ usuarioEditou: true, mudou: ["título"], divergentesNoCarregamento: ["título"], mudaramDesdeCarregamento: ["título"] }), ["título"]);
  assert.equal(TEXTO_CAMPO_ALTERADO, "Este campo foi alterado. A Conferência precisa ser aprovada novamente.");
});

test("indicador: textos exatos", () => {
  assert.equal(TEXTO_GRAVACAO[ESTADO_GRAVACAO.SALVANDO], "Salvando...");
  assert.equal(TEXTO_GRAVACAO[ESTADO_GRAVACAO.SALVO], "✓ Salvo na base");
  assert.equal(TEXTO_GRAVACAO[ESTADO_GRAVACAO.NAO_SALVO], "⚠ Não salvo");
  assert.equal(TEXTO_GRAVACAO[ESTADO_GRAVACAO.CONFLITO], "⚠ Conflito de versões");
});
test("bloqueio: conflito, gravação pendente, falha e Conferência invalidada bloqueiam", () => {
  assert.match(motivoBloqueioPublicacao({ conflito: true }), /duas versões/);
  assert.match(motivoBloqueioPublicacao({ pendente: true }), /não salvas/);
  assert.match(motivoBloqueioPublicacao({ gravacao: ESTADO_GRAVACAO.SALVANDO }), /não salvas/);
  assert.match(motivoBloqueioPublicacao({ gravacao: ESTADO_GRAVACAO.NAO_SALVO }), /falhou/);
  assert.match(motivoBloqueioPublicacao({ aprovada: false }), /invalidada/);
  assert.equal(motivoBloqueioPublicacao({ gravacao: ESTADO_GRAVACAO.SALVO, aprovada: true }), "");
});
