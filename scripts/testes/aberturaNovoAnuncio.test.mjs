// =============================================================
// PAIIA — TESTES: abertura do Novo Anúncio sem contaminação.
//   node --test scripts/testes/aberturaNovoAnuncio.test.mjs
// Regra: um anúncio NOVO nunca herda nada de outro anúncio (fotos, título,
// código, aplicações, preço/custo, clip...); abrir a ficha B mostra só B;
// voltar ao anúncio em andamento (F5, Foto IA, Conferência) mantém o mesmo.
// Sem rede (Supabase falso).
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);

class Armazenamento {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  key(i) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}
function navegador(href = "https://www.paiia.com.br/?tela=novoAnuncio") {
  globalThis.localStorage = new Armazenamento();
  const w = { location: { href }, history: { state: null, replaceState(_s, _t, url) { w.location.href = String(url); } } };
  globalThis.window = w;
  delete globalThis.__paiiaDonoFotosAnuncio;
  return w;
}
navegador();

const A = await import("../../src/services/aberturaNovoAnuncio.js");
const { prepararNovaCriacaoMidia, deveIniciarNovaCriacaoMidia } = await import("../../src/services/limparEstadoTemporarioMidia.js");
const { lerAnuncioEmAndamento, guardarAnuncioEmAndamento } = await import("../../src/services/fichasCentral.js");
const { rascunhoMaisRecente } = await import("../../src/hooks/useNovoAnuncio.js");
const { fichaDoNovoAnuncioAoAbrir, fichaDaAbertura } = await import("../../src/hooks/useFichaNovoAnuncio.js");

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n");

const ID_A = "0f6a1c2e-1111-4222-8333-aaaaaaaaaaaa";
const ID_B = "0f6a1c2e-1111-4222-8333-bbbbbbbbbbbb";
const RASC_A = { codigo: "FICHA-A", titulo: "Peca A", custo: "40,00", preco: "90", fotos: [{ imagem_processada: "https://x/A.jpg" }], clip: "https://x/clipA.mp4", fichaIdPAIIA: ID_A };
const RASC_B = { codigo: "FICHA-B", titulo: "Peca B", custo: "10,00", preco: "50", fotos: [{ imagem_processada: "https://x/B.jpg" }], clip: "", fichaIdPAIIA: ID_B };
const grava = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const le = (k) => JSON.parse(localStorage.getItem(k) || "null");

function sujarComAnuncioA() {
  grava("novoAnuncioTemporario", { ...RASC_A, salvoEm: 1000 });
  grava("rascunhoNovoAnuncioTemp", { ...RASC_A, salvoEm: 2000 });
  grava("anuncioProntoPublicacao", { ...RASC_A });
  grava("dadosPrecificacaoAppia", { custo: "40,00", fichaIdPAIIA: ID_A });
  localStorage.setItem("precoSugeridoAppia", "90");
  localStorage.setItem("clipPronto", RASC_A.clip);
  localStorage.setItem("clipSelecionado", RASC_A.clip);
  grava("projetoAppiaAtual", { id: "p1" });
  localStorage.setItem("fotoPronta", "https://x/fotoA.jpg");
  grava("pecaCatalogoSelecionada", { codigo: "FICHA-A" });
  localStorage.setItem("codigoNovoAnuncio", "FICHA-A");
  localStorage.setItem("voltarParaFotosAnuncio", "true");
}

// ---------------------------------------------------------------
test("1) iniciarAnuncioNovo: guarda o em andamento e não deixa NADA do anúncio A", () => {
  navegador();
  sujarComAnuncioA();
  A.iniciarAnuncioNovo();
  for (const k of ["novoAnuncioTemporario", "rascunhoNovoAnuncioTemp", "anuncioProntoPublicacao", ...A.CHAVES_DE_UM_ANUNCIO]) {
    assert.equal(localStorage.getItem(k), null, `ficou do anúncio A: ${k}`);
  }
  assert.equal(lerAnuncioEmAndamento(localStorage)?.resumo?.codigo, "FICHA-A", "o anúncio A foi guardado (Retomar na Central)");
  const ab = A.decidirAberturaNovoAnuncio();
  assert.equal(ab.modo, "novo");
  assert.equal(ab.rascunho, null);
  assert.equal(ab.fichaId, "");
  assert.equal(ab.ignorarEdicao, true, "a edição antiga do App não vale num anúncio novo pedido");
  assert.deepEqual(fichaDaAbertura(ab), { id: "", codigo: "" });
  assert.deepEqual(fichaDoNovoAnuncioAoAbrir(), { id: "", codigo: "" });
  A.consumirAberturaNovoAnuncio();
  assert.equal(localStorage.getItem(A.CHAVE_ABERTURA_NOVO_ANUNCIO), null);
  assert.equal(deveIniciarNovaCriacaoMidia(), false);
});

test("2) anúncio novo COM dados (catálogo / Usar este Preço): só esses dados, sem mídia embutida", () => {
  navegador();
  sujarComAnuncioA();
  A.iniciarAnuncioNovo({ dados: { codigo: "CAT-1", titulo: "Peca do catalogo", preco: "84.13", custo: "33,00", foto: "data:image/png;base64,AAAA", pecaEncontrada: { aplicacoes: [{ modelo: "Palio" }] } } });
  const ab = A.decidirAberturaNovoAnuncio();
  assert.equal(ab.modo, "novo");
  assert.equal(ab.dados.codigo, "CAT-1");
  assert.equal(ab.dados.preco, "84.13");
  assert.equal(ab.dados.custo, "33,00");
  assert.equal(ab.dados.foto, undefined, "base64 não vai no pedido");
  assert.equal(ab.dados.pecaEncontrada.aplicacoes[0].modelo, "Palio");
  assert.equal(localStorage.getItem("dadosPrecificacaoAppia"), null, "custo de A não fica para o novo");
});

test("3) Home (flag de criação nova) sem pedido explícito: novo, mas Meus Anúncios → Editar continua valendo", () => {
  navegador();
  sujarComAnuncioA();
  prepararNovaCriacaoMidia();
  const ab = A.decidirAberturaNovoAnuncio();
  assert.equal(ab.modo, "novo");
  assert.equal(ab.ignorarEdicao, false);
  for (const k of ["fotoPronta", "voltarParaFotosAnuncio", "codigoNovoAnuncio", "paiiaAberturaNovoAnuncio"]) {
    assert.equal(localStorage.getItem(k), null, `Home deixou ${k}`);
  }
});

test("4) ?ficha=B com o rascunho de A no navegador: nunca abre A (relê B pela base)", () => {
  navegador(`https://www.paiia.com.br/?tela=novoAnuncio&ficha=${ID_B}`);
  sujarComAnuncioA();
  const ab = A.decidirAberturaNovoAnuncio();
  assert.equal(ab.modo, "ficha");
  assert.equal(ab.fichaId, ID_B);
  assert.equal(ab.rascunho, null);
  assert.equal(ab.recarregarDaBase, true);
  assert.deepEqual(fichaDoNovoAnuncioAoAbrir(), { id: ID_B, codigo: "" });
  // A ficha pedida vence até a flag de criação nova que ficou da Home.
  localStorage.setItem("paiiaNovaCriacaoMidia", "true");
  assert.equal(A.decidirAberturaNovoAnuncio().modo, "ficha");
  // Rascunho de B na reserva (mais antigo que o de A): vale o de B.
  grava("rascunhoNovoAnuncioTemp", { ...RASC_B, salvoEm: 10 });
  grava("novoAnuncioTemporario", { ...RASC_A, salvoEm: 9999 });
  const ab2 = A.decidirAberturaNovoAnuncio();
  assert.equal(ab2.rascunho.codigo, "FICHA-B");
  assert.equal(ab2.recarregarDaBase, false);
  assert.deepEqual(fichaDoNovoAnuncioAoAbrir(), { id: ID_B, codigo: "FICHAB" });
});

test("5) escolherRascunho: o mais recente com texto; com ficha, só os dessa ficha", () => {
  navegador();
  grava("novoAnuncioTemporario", { ...RASC_A, salvoEm: 100 });
  grava("rascunhoNovoAnuncioTemp", { ...RASC_B, salvoEm: 200 });
  assert.equal(A.escolherRascunho(localStorage).codigo, "FICHA-B");
  assert.equal(rascunhoMaisRecente().codigo, "FICHA-B", "o hook usa a mesma regra");
  assert.equal(A.escolherRascunho(localStorage, { fichaId: ID_A }).codigo, "FICHA-A");
  assert.equal(A.escolherRascunho(localStorage, { fichaId: "" }), null, "anúncio sem ficha não pega rascunho de ficha");
  grava("rascunhoNovoAnuncioTemp", { codigo: "SEM-FICHA", salvoEm: 300 });
  assert.equal(A.escolherRascunho(localStorage, { fichaId: "" }).codigo, "SEM-FICHA");
  // Rascunho de catálogo SEM salvoEm não perde mais para outro anúncio: o
  // catálogo agora pede criação nova (o rascunho anterior é guardado e limpo).
  A.iniciarAnuncioNovo({ dados: { codigo: "CAT-2" } });
  assert.equal(A.decidirAberturaNovoAnuncio().dados.codigo, "CAT-2");
  assert.equal(A.decidirAberturaNovoAnuncio().rascunho, null);
});

test("6) abrirFichaNoNovoAnuncio(B): rascunho de B com as fotos dele; nada de A fica", () => {
  const w = navegador("https://www.paiia.com.br/?tela=mercadoLivreTeste&ficha=" + ID_B);
  sujarComAnuncioA();
  localStorage.setItem("paiiaNovaCriacaoMidia", "true");
  const id = A.abrirFichaNoNovoAnuncio({ ...RASC_B, fichaIdPAIIA: undefined, fichaId: ID_B });
  assert.equal(id, ID_B);
  for (const k of ["novoAnuncioTemporario", "rascunhoNovoAnuncioTemp"]) {
    const d = le(k);
    assert.equal(d.codigo, "FICHA-B");
    assert.equal(d.fichaIdPAIIA, ID_B);
    assert.equal(d.fotosDaFicha, true, "as fotos da ficha substituem as da memória");
  }
  for (const k of ["anuncioProntoPublicacao", "dadosPrecificacaoAppia", "precoSugeridoAppia", "clipPronto", "clipSelecionado", "projetoAppiaAtual", "fotoPronta", "pecaCatalogoSelecionada", "codigoNovoAnuncio"]) {
    assert.equal(localStorage.getItem(k), null, `ficou de A: ${k}`);
  }
  assert.equal(deveIniciarNovaCriacaoMidia(), false);
  assert.ok(w.location.href.includes(`ficha=${ID_B}`) && w.location.href.includes("tela=novoAnuncio"));
  const ab = A.decidirAberturaNovoAnuncio();
  assert.equal(ab.modo, "ficha");
  assert.equal(ab.rascunho.codigo, "FICHA-B");
  assert.equal(ab.rascunho.clip, "", "o clip é o da ficha B (nenhum), não o clipPronto de A");
  // O anúncio pronto da PRÓPRIA ficha continua.
  grava("anuncioProntoPublicacao", { ...RASC_B });
  A.abrirFichaNoNovoAnuncio({ ...RASC_B });
  assert.equal(le("anuncioProntoPublicacao").codigo, "FICHA-B");
});

test("7) Retomar o guardado: só as chaves dele, com as fotos dele", () => {
  navegador();
  grava("rascunhoNovoAnuncioTemp", { codigo: "X-GUARDADO", titulo: "Guardado", fotos: [{ imagem_processada: "https://x/X.jpg" }], salvoEm: 5 });
  guardarAnuncioEmAndamento(localStorage);
  localStorage.removeItem("rascunhoNovoAnuncioTemp");
  // Depois: anúncio A na tela (principal + reserva + precificação).
  sujarComAnuncioA();
  assert.equal(A.retomarAnuncioGuardado(localStorage), true);
  assert.equal(localStorage.getItem("novoAnuncioTemporario"), null, "a cópia de A que o guardado não tinha sai");
  const ab = A.decidirAberturaNovoAnuncio();
  assert.equal(ab.modo, "rascunho");
  assert.equal(ab.rascunho.codigo, "X-GUARDADO");
  assert.equal(ab.rascunho.fotosDaFicha, true);
  assert.equal(localStorage.getItem("dadosPrecificacaoAppia"), null);
  assert.equal(localStorage.getItem("clipPronto"), null);
});

test("8) fotos da memória do App: só valem para o MESMO anúncio", () => {
  navegador();
  assert.equal(A.fotosDaMemoriaValem({ fichaIdPAIIA: ID_A }), true, "memória nova (F5)");
  A.marcarDonoFotosAnuncio(ID_A);
  assert.equal(A.fotosDaMemoriaValem({ fichaIdPAIIA: ID_A }), true, "volta da Foto IA/Galeria: mesmo anúncio");
  assert.equal(A.fotosDaMemoriaValem({ fichaIdPAIIA: ID_B }), false, "outra ficha");
  assert.equal(A.fotosDaMemoriaValem({ fichaIdPAIIA: ID_A, fotosDaFicha: true }), false, "ficha reaberta: fotos dela");
  assert.equal(A.fotosDaMemoriaValem(null), false, "sem rascunho e memória de A: tela vazia");
  A.marcarDonoFotosAnuncio("");
  assert.equal(A.fotosDaMemoriaValem(null), true, "anúncio novo ainda sem ficha (foto pronta da Foto IA)");
  assert.equal(A.fotosDaMemoriaValem({ codigo: "X" }), true);
  A.marcarDonoFotosAnuncio("edicao");
  assert.equal(A.fotosDaMemoriaValem({ codigo: "X" }), false, "fotos de uma edição (Meus Anúncios) não passam");
});

test("9) Central 'Voltar ao Anúncio', Precificação e Clip só valem para o anúncio em andamento", () => {
  navegador();
  grava("rascunhoNovoAnuncioTemp", { ...RASC_B, salvoEm: 1 });
  assert.equal(A.anuncioProntoEhDoAnuncioEmAndamento({ ...RASC_A }), false, "anúncio pronto velho (A) com B em andamento");
  assert.equal(A.anuncioProntoEhDoAnuncioEmAndamento({ ...RASC_B }), true);
  assert.equal(A.anuncioProntoEhDoAnuncioEmAndamento({ codigo: "sem ficha" }), true);
  assert.equal(A.precificacaoDoAnuncioEmAndamento({ fichaIdPAIIA: ID_B }), true);
  assert.equal(A.precificacaoDoAnuncioEmAndamento({ fichaIdPAIIA: ID_A }), false);
  assert.equal(A.precificacaoDoAnuncioEmAndamento({ custo: "1" }), false, "precificação solta = anúncio novo");
  assert.equal(A.clipEhDoAnuncioEmAndamento(undefined), true);
  assert.equal(A.clipEhDoAnuncioEmAndamento(""), true, "anúncio sem ficha quando o clip começou");
  assert.equal(A.clipEhDoAnuncioEmAndamento(ID_B), true);
  assert.equal(A.clipEhDoAnuncioEmAndamento(ID_A), false, "clip de A terminando com B na tela");
});

test("10) status do clip em geração: fica só para a ficha dona", () => {
  navegador();
  localStorage.setItem("clipGeracaoStatus", "gerando");
  localStorage.setItem(A.CHAVE_CLIP_GERACAO_FICHA, ID_A);
  A.limparChavesDeOutroAnuncio(ID_A);
  assert.equal(localStorage.getItem("clipGeracaoStatus"), "gerando");
  A.limparChavesDeOutroAnuncio(ID_B);
  assert.equal(localStorage.getItem("clipGeracaoStatus"), null);
});

test("11) telas: todas as entradas usam o ponto único de abertura", () => {
  const novos = {
    "src/components/Home.jsx": "iniciarAnuncioNovo()",
    "src/components/CentralInteligencia.jsx": 'if (tela === "novoAnuncio") iniciarAnuncioNovo();',
    "src/components/CentralPesquisa.jsx": "iniciarAnuncioNovo({",
    "src/components/PesquisaCatalogoCompleta.jsx": "iniciarAnuncioNovo({",
    "src/components/BuscaCatalogo.jsx": "iniciarAnuncioNovo({",
    "src/components/CentralPrecificacao.jsx": "iniciarAnuncioNovo({",
  };
  for (const [arq, trecho] of Object.entries(novos)) assert.ok(ler(arq).includes(trecho), `${arq} não inicia anúncio novo`);
  for (const arq of ["src/components/CentralPesquisa.jsx", "src/components/PesquisaCatalogoCompleta.jsx"]) {
    assert.equal(ler(arq).includes('"novoAnuncioTemporario"'), false, `${arq} ainda grava rascunho solto`);
  }
  const mlt = ler("src/components/MercadoLivreTeste.jsx");
  assert.equal((mlt.match(/abrirFichaNoNovoAnuncio\(rasc\)/g) || []).length, 2, "Conferência e ?ficha= abrem a ficha pelo ponto único");
  assert.ok(ler("src/components/PainelFichasCentral.jsx").includes("retomarAnuncioGuardado(localStorage)"));
  const na = ler("src/components/NovoAnuncio.jsx");
  assert.ok(na.includes("decidirAberturaNovoAnuncio()"));
  assert.ok(na.includes('localStorage.removeItem("dadosPrecificacaoAppia");'), "precificação é consumida");
  assert.ok(na.includes("zerarDadosDoAnuncioAnterior();"), "outro código na mesma tela não leva fotos/preço");
  assert.ok(ler("src/components/CentralPublicacao.jsx").includes("anuncioProntoEhDoAnuncioEmAndamento(anuncio)"));
  assert.ok(ler("src/components/ClipIA.jsx").includes("fichaDonaClip"));
});
