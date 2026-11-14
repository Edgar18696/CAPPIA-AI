// (10/11) Foto IA — Modo Econômico como padrão da tela Foto IA.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { recortarFotoIA, TENTATIVAS_AUTOMATICAS } from "../../src/services/fotoIA/pipelineFotoIA.js";
import {
  produzirFotoEconomica,
  textoEtapaEconomica,
  MODO_ECONOMICO,
  MODELO_ECONOMICO,
} from "../../src/services/fotoIA/fotoEconomicaTela.js";

const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

function supabaseRecorte(respostas) {
  const chamadas = [];
  return {
    chamadas,
    functions: {
      invoke: async (nome, opcoes) => {
        chamadas.push([nome, opcoes.body]);
        const r = respostas[Math.min(chamadas.length - 1, respostas.length - 1)];
        return r;
      },
    },
  };
}
const erroHttp = (status, corpo) => ({
  data: null,
  error: { context: { status, json: async () => corpo, clone() { return this; } } },
});

function depsLocais({ falhaRecorte = null, semUrl = false } = {}) {
  const log = [];
  return {
    log,
    deps: {
      enviarOriginal: async ({ usuarioId, arquivo }) => { log.push(["enviar", usuarioId, arquivo.name]); return { url: "https://x/originais/a.jpg", arquivoEnviado: { name: "normalizada.jpg" } }; },
      recortar: async (arq) => { log.push(["recortar", arq.name]); if (falhaRecorte) throw new Error(falhaRecorte); return { blob: { tipo: "png-com-alfa" } }; },
      comporESalvar: async (a) => { log.push(["compor", a.arquivoEnviado.name, a.recorteBlob.tipo, a.fundo, a.urlOriginal]); return semUrl ? {} : { url: "https://x/processadas/a.png", id: 7, transparente: a.fundo === "transparente", baixaResolucao: false }; },
    },
  };
}

test("Modo Econômico: guarda a original, recorta NO APARELHO e salva a tratada na Galeria", async () => {
  const { deps, log } = depsLocais();
  const etapas = [];
  const r = await produzirFotoEconomica({ supabase: {}, usuarioId: "u1", arquivo: { name: "peca.jpg" }, fundo: "branco", aoEtapa: (e) => etapas.push(e), deps });
  assert.deepEqual(log, [
    ["enviar", "u1", "peca.jpg"],
    ["recortar", "normalizada.jpg"],
    ["compor", "normalizada.jpg", "png-com-alfa", "branco", "https://x/originais/a.jpg"],
  ]);
  assert.deepEqual(etapas, ["enviando", "recortando", "compondo"]);
  assert.deepEqual(r, {
    modo: MODO_ECONOMICO,
    modelo: MODELO_ECONOMICO,
    imagemOriginal: "https://x/originais/a.jpg",
    imagemProcessada: "https://x/processadas/a.png",
    transparente: false,
    baixaResolucao: false,
    galeriaId: 7,
  });
  assert.match(MODELO_ECONOMICO, /^local:/);
});

test("fundo transparente é respeitado; qualquer outro valor vira branco", async () => {
  const a = depsLocais(); const b = depsLocais();
  await produzirFotoEconomica({ usuarioId: "u", arquivo: { name: "a" }, fundo: "transparente", deps: a.deps });
  await produzirFotoEconomica({ usuarioId: "u", arquivo: { name: "a" }, fundo: "qualquer", deps: b.deps });
  assert.equal(a.log[2][3], "transparente");
  assert.equal(b.log[2][3], "branco");
});

test("falha nunca vira foto concluída", async () => {
  await assert.rejects(produzirFotoEconomica({ usuarioId: "u", arquivo: { name: "a" }, deps: depsLocais({ semUrl: true }).deps }), /não foi salva na Galeria/);
  const f = depsLocais({ falhaRecorte: "Não foi possível identificar a peça" });
  await assert.rejects(produzirFotoEconomica({ usuarioId: "u", arquivo: { name: "a" }, deps: f.deps }), /identificar a peça/);
  assert.ok(!f.log.some((l) => l[0] === "compor"), "nada é salvo na Galeria quando o recorte falha");
  await assert.rejects(produzirFotoEconomica({ usuarioId: "u", arquivo: null, deps: depsLocais().deps }), /Arquivo/);
  await assert.rejects(produzirFotoEconomica({ usuarioId: "", arquivo: {}, deps: depsLocais().deps }), /login/);
});

test("Modo Econômico não chama a função foto-ia (sem cota de 50 nem créditos)", () => {
  const c = ler("src/services/fotoIA/fotoEconomicaTela.js").replace(/^\/\/.*$/gm, "");
  assert.ok(!/recortarFotoIA|processarUmaFotoIA|functions\.invoke|foto-ia|replicate|gemini/i.test(c));
  assert.match(c, /recortarLocalmente/);
});

test("recorte com tentativas = 1: erro temporário (503) NÃO é repetido", async () => {
  const sb = supabaseRecorte([erroHttp(503, { erro: "ocupado" })]);
  await assert.rejects(recortarFotoIA({ supabase: sb, caminho: "u/originais/a.jpg", chave: "chave-12345", tentativas: 1 }), /ocupado/);
  assert.equal(sb.chamadas.length, 1);
});

test("402 (limite / sem créditos) nunca é repetido", async () => {
  const sb = supabaseRecorte([erroHttp(402, { codigo: "LIMITE_MENSAL", erro: "Você atingiu o limite de 50 Fotos IA deste mês." })]);
  await assert.rejects(recortarFotoIA({ supabase: sb, caminho: "u/originais/a.jpg", chave: "chave-12345", tentativas: 1 }), /limite/);
  assert.equal(sb.chamadas.length, 1);
});

test("sucesso no recorte devolve a URL na primeira chamada", async () => {
  const sb = supabaseRecorte([{ data: { sucesso: true, recorteUrl: "https://r/x.png" }, error: null }]);
  const d = await recortarFotoIA({ supabase: sb, caminho: "u/originais/a.jpg", chave: "chave-12345", tentativas: 1 });
  assert.equal(d.recorteUrl, "https://r/x.png");
  assert.deepEqual(sb.chamadas[0], ["foto-ia", { caminho: "u/originais/a.jpg", chave: "chave-12345" }]);
});

test("PAIIA Voz continua igual: padrão de tentativas não mudou e o Voz não passa limite", () => {
  assert.equal(TENTATIVAS_AUTOMATICAS, 3);
  const pipeline = ler("src/services/fotoIA/pipelineFotoIA.js");
  assert.match(pipeline, /tentativas = TENTATIVAS_AUTOMATICAS/);
  assert.match(pipeline, /tentativasRecorte = TENTATIVAS_AUTOMATICAS/);
  assert.ok(!/tentativasRecorte|tentativas:/.test(ler("src/modules/paiiaVoz/servicos/fotoIAVoz.js")));
});

test("tela Foto IA usa o Modo Econômico e não chama mais o Gemini automaticamente", () => {
  const app = ler("src/App.jsx");
  const ini = app.indexOf("async function processarSelecionadas()");
  const fim = app.indexOf("async function baixarImagem(", ini);
  const corpo = app.slice(ini, fim);
  assert.ok(ini > 0 && fim > ini);
  assert.match(corpo, /produzirFotoEconomica\(/);
  assert.ok(!/processarFotoAction|API_PROCESSAR_FOTO|foto-profissional/.test(corpo), "sem Gemini no lote padrão");
  assert.ok(!/11000/.test(corpo), "sem a espera longa entre fotos");
  assert.match(corpo, /modo: economica\.modo/);
  const tela = ler("src/modules/fotoIA/FotoIA.jsx");
  assert.doesNotMatch(tela, /Modo Econômico · sem créditos/, "(14/11) aviso saiu da tela; o modo continua no lote");
  assert.match(tela, /Máximo de 8 fotos por vez/);
});

test("textos de etapa", () => {
  assert.match(textoEtapaEconomica("enviando", 0, 4, "a.jpg"), /Guardando a original da foto 1 de 4/);
  assert.match(textoEtapaEconomica("recortando", 1, 4, "b.jpg"), /Removendo o fundo da foto 2 de 4 no aparelho/);
  assert.match(textoEtapaEconomica("compondo", 3, 4, "d.jpg"), /1200 x 1200/);
});
