// (10/11) Foto IA — Modo Econômico como padrão da tela Foto IA.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { recortarFotoIA, TENTATIVAS_AUTOMATICAS } from "../../src/services/fotoIA/pipelineFotoIA.js";
import {
  produzirFotoEconomica,
  textoEtapaEconomica,
  TENTATIVAS_RECORTE_ECONOMICO,
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

test("Modo Econômico: uma foto → foto-ia uma vez, sem nova tentativa, resultado da Galeria", async () => {
  let recebido = null;
  const r = await produzirFotoEconomica({
    supabase: {},
    usuarioId: "u1",
    arquivo: { name: "peca.jpg" },
    fundo: "branco",
    processarUma: async (args) => {
      recebido = args;
      return { estado: { urlOriginal: "https://x/originais/a.jpg" }, url: "https://x/processadas/a.png", id: 7, transparente: false, baixaResolucao: false };
    },
  });
  assert.equal(recebido.tentativasRecorte, 1);
  assert.equal(TENTATIVAS_RECORTE_ECONOMICO, 1);
  assert.equal(recebido.fundo, "branco");
  assert.equal(recebido.usuarioId, "u1");
  assert.deepEqual(r, {
    modo: MODO_ECONOMICO,
    modelo: MODELO_ECONOMICO,
    imagemOriginal: "https://x/originais/a.jpg",
    imagemProcessada: "https://x/processadas/a.png",
    transparente: false,
    baixaResolucao: false,
    galeriaId: 7,
  });
  assert.notEqual(r.imagemOriginal, r.imagemProcessada, "original e tratada ficam separadas");
});

test("fundo transparente é respeitado; qualquer outro valor vira branco", async () => {
  const fundos = [];
  const processarUma = async (a) => { fundos.push(a.fundo); return { url: "https://x/p.png", estado: {} }; };
  await produzirFotoEconomica({ usuarioId: "u", arquivo: {}, fundo: "transparente", processarUma });
  await produzirFotoEconomica({ usuarioId: "u", arquivo: {}, fundo: "qualquer", processarUma });
  assert.deepEqual(fundos, ["transparente", "branco"]);
});

test("falha nunca vira foto concluída", async () => {
  await assert.rejects(
    produzirFotoEconomica({ usuarioId: "u", arquivo: {}, processarUma: async () => ({ estado: {} }) }),
    /não foi salva na Galeria/
  );
  await assert.rejects(
    produzirFotoEconomica({ usuarioId: "u", arquivo: {}, processarUma: async () => { throw new Error("Você atingiu o limite"); } }),
    /limite/
  );
  await assert.rejects(produzirFotoEconomica({ usuarioId: "u", arquivo: null, processarUma: async () => ({}) }), /Arquivo/);
  await assert.rejects(produzirFotoEconomica({ usuarioId: "", arquivo: {}, processarUma: async () => ({}) }), /login/);
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
  assert.match(tela, /data-paiia-foto-modo="economico"/);
  assert.match(tela, /Máximo de 8 fotos por vez/);
});

test("textos de etapa", () => {
  assert.match(textoEtapaEconomica("enviando", 0, 4, "a.jpg"), /Enviando foto 1 de 4/);
  assert.match(textoEtapaEconomica("recortando", 1, 4, "b.jpg"), /Removendo o fundo da foto 2 de 4/);
  assert.match(textoEtapaEconomica("compondo", 3, 4, "d.jpg"), /1200 x 1200/);
});
