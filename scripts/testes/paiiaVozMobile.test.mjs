// =============================================================
// PAIIA Voz no CELULAR — TESTES (sem rede, sem banco, dados fictícios).
//   node --test scripts/testes/paiiaVozMobile.test.mjs
// Cobre: fotos guardadas no aparelho (sobrevivem ao F5) e o microfone
// que religa sozinho no Chrome do Android, sem repetir frases.
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";

const G = await import("../../src/modules/paiiaVoz/servicos/fotosVozLocal.js");
const { criarReconhecedor } = await import("../../src/modules/paiiaVoz/servicos/reconhecimentoVoz.js");

const imagem = (nome, tipo = "image/jpeg", tam = 10) => new Blob([new Uint8Array(tam)], { type: tipo });
const comNome = (b, nome) => Object.assign(b, { name: nome });

// ---------------------------------------------------------------
test("fotos: guarda só imagens, na ordem, ligadas à ficha", async () => {
  let t = 1000;
  const arm = G.armazenamentoMemoria();
  const g = G.criarGuardaFotos({ armazenamento: arm, agora: () => t++ });
  const r = await g.adicionar("ficha-A", [comNome(imagem(), "a.jpg"), comNome(new Blob(["x"], { type: "text/plain" }), "nota.txt"), comNome(imagem("", "image/heic"), "b.heic")]);
  assert.equal(r.guardadas.length, 2);
  assert.deepEqual(r.recusadas.map((x) => x.motivo), ["não é imagem"]);
  assert.equal(r.guardadas[0].usarNoAnuncio, true, "jpeg vai ao anúncio por padrão");
  assert.equal(r.guardadas[1].usarNoAnuncio, false, "heic não vai ao anúncio por padrão");
  await g.adicionar("ficha-B", [comNome(imagem(), "c.jpg")]);
  const a = await g.listar("ficha-A");
  assert.deepEqual(a.map((x) => x.nome), ["a.jpg", "b.heic"]);
  assert.equal((await g.listar("ficha-B")).length, 1);
});

test("fotos: continuam depois de 'atualizar a página' (novo guarda, mesmo armazenamento)", async () => {
  const arm = G.armazenamentoMemoria();
  const g1 = G.criarGuardaFotos({ armazenamento: arm, agora: () => 5 });
  await g1.adicionar("ficha-X", [comNome(imagem("", "image/png", 99), "peca.png")]);
  const g2 = G.criarGuardaFotos({ armazenamento: arm, agora: () => 6 });
  const lista = await g2.listar("ficha-X");
  assert.equal(lista.length, 1);
  assert.equal(lista[0].tamanho, 99);
  assert.equal(lista[0].blob.size, 99, "a imagem em si foi guardada");
  const arq = g2.comoArquivo(lista[0]);
  assert.equal(arq.name, "peca.png");
  assert.equal(arq.type, "image/png");
});

test("fotos: marcar uso, remover, nova ficha e limite por ficha", async () => {
  const arm = G.armazenamentoMemoria();
  const g = G.criarGuardaFotos({ armazenamento: arm, agora: () => 1 });
  const { guardadas } = await g.adicionar("F", [comNome(imagem(), "1.jpg"), comNome(imagem(), "2.jpg")]);
  await g.marcarUso(guardadas[0].id, false);
  assert.equal((await g.listar("F"))[0].usarNoAnuncio, false);
  await g.remover(guardadas[1].id);
  assert.equal((await g.listar("F")).length, 1);
  await g.limparFicha("F");
  assert.equal((await g.listar("F")).length, 0);
  const muitas = Array.from({ length: G.MAX_FOTOS_POR_FICHA + 2 }, (_, i) => comNome(imagem(), `${i}.jpg`));
  const r = await g.adicionar("F", muitas);
  assert.equal(r.guardadas.length, G.MAX_FOTOS_POR_FICHA);
  assert.equal(r.recusadas.length, 2);
  assert.match(r.recusadas[0].motivo, /limite/);
  await assert.rejects(() => g.adicionar("", [imagem()]), /ficha sem id/);
});

test("fotos: faxina apaga vencidas (48 h) e de outras fichas, nunca as da ficha atual", async () => {
  let t = 0;
  const arm = G.armazenamentoMemoria();
  const g = G.criarGuardaFotos({ armazenamento: arm, agora: () => t });
  await g.adicionar("velha", [comNome(imagem(), "v.jpg")]);
  t = 10;
  await g.adicionar("atual", [comNome(imagem(), "a.jpg")]);
  t = 20;
  assert.equal(await g.faxina("atual"), 1);
  assert.equal((await arm.getAll()).length, 1);
  t = 10 + G.VALIDADE_FOTOS_MS + 1;
  assert.equal((await g.listar("atual")).length, 0, "vencida não aparece");
  assert.equal(await g.faxina("atual"), 1);
  assert.equal((await arm.getAll()).length, 0);
});

test("fotos: sem IndexedDB o navegador usa memória (aviso na tela)", () => {
  assert.equal(G.armazenamentoIndexedDB(null), null);
  assert.equal(G.criarGuardaFotos({}).tipo, "memoria");
});

// ---------------------------------------------------------------
function simulador() {
  const instancias = [];
  class FalsoSR {
    constructor() { instancias.push(this); }
    start() { this.iniciado = true; }
    stop() { this.parado = true; this.onend?.(); }
    falar(texto, final = true) { this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: texto }], { isFinal: final })] }); }
    terminar() { this.onend?.(); }
    erro(codigo) { this.onerror?.({ error: codigo }); }
  }
  const fila = [];
  const agendar = (fn) => fila.push(fn);
  const rodarAgendados = () => { while (fila.length) fila.shift()(); };
  return { FalsoSR, instancias, agendar, rodarAgendados };
}

test("microfone no celular: religa sozinho entre as frases até tocar em Parar", () => {
  const s = simulador();
  const ev = [];
  let t = 0;
  const rec = criarReconhecedor({
    janela: { webkitSpeechRecognition: s.FalsoSR },
    manterLigado: true,
    agendar: s.agendar,
    agora: () => t,
    onFinal: (x) => ev.push(["final", x]),
    onEstado: (v) => ev.push(["estado", v]),
    onErro: (m) => ev.push(["erro", m]),
  });
  rec.iniciar();
  s.instancias[0].falar("código 0280158276");
  s.instancias[0].terminar(); // Android encerra na pausa
  assert.equal(rec.ouvindo, true, "continua ouvindo");
  s.rodarAgendados();
  assert.equal(s.instancias.length, 2, "religou");
  t = 5000;
  s.instancias[1].falar("preço 65,91");
  rec.parar();
  s.rodarAgendados();
  assert.equal(s.instancias.length, 2, "não religa depois de Parar");
  assert.equal(rec.ouvindo, false);
  assert.deepEqual(ev.filter((e) => e[0] === "final").map((e) => e[1]), ["código 0280158276", "preço 65,91"]);
  assert.deepEqual(ev.filter((e) => e[0] === "estado").map((e) => e[1]), [true, false]);
  assert.equal(ev.some((e) => e[0] === "erro"), false);
});

test("microfone no celular: frase final repetida pelo Android é anotada uma vez só", () => {
  const s = simulador();
  const finais = [];
  let t = 100;
  const rec = criarReconhecedor({ janela: { SpeechRecognition: s.FalsoSR }, manterLigado: true, agendar: s.agendar, agora: () => t, onFinal: (x) => finais.push(x) });
  rec.iniciar();
  s.instancias[0].falar("quantidade 2");
  t = 900;
  s.instancias[0].falar("Quantidade 2");
  t = 10000;
  s.instancias[0].falar("quantidade 2");
  assert.deepEqual(finais, ["quantidade 2", "quantidade 2"], "repetição imediata ignorada; depois de um tempo vale de novo");
  rec.parar();
});

test("microfone no celular: silêncio religa sem mensagem; bloqueio do microfone para de vez", () => {
  const s = simulador();
  const erros = [];
  const rec = criarReconhecedor({ janela: { webkitSpeechRecognition: s.FalsoSR }, manterLigado: true, agendar: s.agendar, onErro: (m) => erros.push(m) });
  rec.iniciar();
  s.instancias[0].erro("no-speech");
  s.instancias[0].terminar();
  s.rodarAgendados();
  assert.equal(erros.length, 0);
  assert.equal(s.instancias.length, 2);
  s.instancias[1].erro("not-allowed");
  s.instancias[1].terminar();
  s.rodarAgendados();
  assert.equal(s.instancias.length, 2, "não insiste com microfone bloqueado");
  assert.equal(rec.ouvindo, false);
  assert.match(erros[0], /bloqueou o microfone/);
});

test("microfone no celular: desliga depois de muitas tentativas sem fala e avisa", () => {
  const s = simulador();
  const erros = [];
  const rec = criarReconhecedor({ janela: { webkitSpeechRecognition: s.FalsoSR }, manterLigado: true, maxReinicios: 3, agendar: s.agendar, onErro: (m) => erros.push(m) });
  rec.iniciar();
  for (let i = 0; i < 5; i++) {
    s.instancias.at(-1).terminar();
    s.rodarAgendados();
  }
  assert.equal(s.instancias.length, 3);
  assert.equal(rec.ouvindo, false);
  assert.match(erros.at(-1), /sem fala/);
});

test("microfone: sem 'manter ligado' (computador) encerra na pausa, como antes", () => {
  const s = simulador();
  const rec = criarReconhecedor({ janela: { webkitSpeechRecognition: s.FalsoSR }, agendar: s.agendar });
  assert.equal(rec.manterLigado, false);
  rec.iniciar();
  s.instancias[0].terminar();
  s.rodarAgendados();
  assert.equal(s.instancias.length, 1);
  assert.equal(rec.ouvindo, false);
  rec.manterLigado = true;
  assert.equal(rec.manterLigado, true, "a opção pode ser ligada na tela");
});
