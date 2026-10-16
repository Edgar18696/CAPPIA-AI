// =============================================================
// PAIIA — TESTES: fotos de UMA ficha na Conferência.
//   node --test scripts/testes/fotosDaFicha.test.mjs
// Caso real (16/10/2026): a Conferência da ficha 510959620 (interruptor do
// teto solar) abriu com as 4 fotos da tampa flange de combustível, porque a
// memória de fotos da Conferência anterior (outra ficha, mesma janela) tinha
// prioridade. Regra: memória de fotos só vale para a MESMA ficha.
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  donoDasFotos,
  mesmoDono,
  fotosIniciaisConferencia,
  guardarFotosEmMemoria,
  esquecerFotosEmMemoria,
  esquecerFotosDeOutraFicha,
  simuladorEhDoAnuncio,
  fotosDiferentesDoNovoAnuncio,
  chaveFotosConferidas,
  MEMORIA_FOTOS,
  MEMORIA_FOTOS_DONO,
} from "../../src/services/fotosDaFicha.js";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ID_TAMPA = "11111111-1111-4111-8111-111111111111";
const ID_INTERRUPTOR = "22222222-2222-4222-8222-222222222222";
const FOTOS_TAMPA = [1, 2, 3, 4].map((i) => `https://x.supabase.co/storage/v1/object/public/fotos/tampa-${i}.png`);
const FOTO_INTERRUPTOR = "https://x.supabase.co/storage/v1/object/public/fotos/interruptor-1.png";
const tampa = { codigo: "TAMPA-FLANGE", fichaIdPAIIA: ID_TAMPA, fotos: FOTOS_TAMPA };
const interruptor = { codigo: "510959620", fichaIdPAIIA: ID_INTERRUPTOR, fotos: [FOTO_INTERRUPTOR] };

test("1) caso real: memória da tampa NÃO entra na Conferência do 510959620", () => {
  const janela = {};
  guardarFotosEmMemoria(janela, FOTOS_TAMPA, tampa);
  const r = fotosIniciaisConferencia({ memoria: janela[MEMORIA_FOTOS], donoMemoria: janela[MEMORIA_FOTOS_DONO], anuncio: interruptor });
  assert.deepEqual(r.fotos, [FOTO_INTERRUPTOR]);
  assert.equal(r.origem, "anuncio");
  assert.equal(r.descartouMemoria, true);
});

test("2) mesma ficha: memória (fotos reordenadas/banner) continua valendo", () => {
  const janela = {};
  const editadas = [FOTO_INTERRUPTOR, "https://x/banner.png"];
  guardarFotosEmMemoria(janela, editadas, interruptor);
  const r = fotosIniciaisConferencia({ memoria: janela[MEMORIA_FOTOS], donoMemoria: janela[MEMORIA_FOTOS_DONO], anuncio: { ...interruptor, fotos: [] } });
  assert.deepEqual(r.fotos, editadas);
  assert.equal(r.origem, "memoria");
});

test("3) memória antiga SEM dono (versão anterior do PAIIA) nunca é usada", () => {
  const r = fotosIniciaisConferencia({ memoria: FOTOS_TAMPA, donoMemoria: undefined, anuncio: interruptor });
  assert.deepEqual(r.fotos, [FOTO_INTERRUPTOR]);
});

test("4) dono: IDs diferentes nunca combinam, mesmo com o mesmo código", () => {
  const a = donoDasFotos({ codigo: "510959620", fichaIdPAIIA: ID_TAMPA });
  const b = donoDasFotos({ codigo: "510 959-620", fichaIdPAIIA: ID_INTERRUPTOR });
  assert.equal(mesmoDono(a, b), false);
  // ficha antiga sem ID: vale o código normalizado
  assert.equal(mesmoDono(donoDasFotos({ codigo: "510 959-620" }), donoDasFotos({ codigo: "510959620" })), true);
  assert.equal(mesmoDono(donoDasFotos({ codigo: "" }), donoDasFotos({ codigo: "" })), false);
});

test("5) esquecer a memória (Central → Conferência de outro anúncio)", () => {
  const janela = {};
  guardarFotosEmMemoria(janela, FOTOS_TAMPA, tampa);
  esquecerFotosEmMemoria(janela);
  const r = fotosIniciaisConferencia({ memoria: janela[MEMORIA_FOTOS], donoMemoria: janela[MEMORIA_FOTOS_DONO], anuncio: interruptor });
  assert.deepEqual(r.fotos, [FOTO_INTERRUPTOR]);
  assert.equal(r.descartouMemoria, false);
});

test("5b) Central: esquece a memória de OUTRA ficha; a da mesma ficha fica", () => {
  const janela = {};
  guardarFotosEmMemoria(janela, FOTOS_TAMPA, tampa);
  assert.equal(esquecerFotosDeOutraFicha(janela, interruptor), true);
  assert.equal(janela[MEMORIA_FOTOS], null);
  const comBanner = [FOTO_INTERRUPTOR, "https://x/banner.png"];
  guardarFotosEmMemoria(janela, comBanner, interruptor);
  assert.equal(esquecerFotosDeOutraFicha(janela, { ...interruptor, fotos: [FOTO_INTERRUPTOR] }), false);
  assert.deepEqual(janela[MEMORIA_FOTOS], comBanner);
});

test("6) simulador em memória de outra ficha não se mistura com o anúncio guardado", () => {
  assert.equal(simuladorEhDoAnuncio(tampa, interruptor), false);
  assert.equal(simuladorEhDoAnuncio(interruptor, { ...interruptor, fotos: [] }), true);
  assert.equal(simuladorEhDoAnuncio(null, interruptor), true);
});

test("7) ficha JÁ contaminada: aviso quando nenhuma foto bate com o Novo Anúncio", () => {
  const r = fotosDiferentesDoNovoAnuncio({ fotosConferencia: FOTOS_TAMPA, fotosNovoAnuncio: [FOTO_INTERRUPTOR] });
  assert.equal(r.suspeita, true);
  assert.deepEqual(r.fotosNovoAnuncio, [FOTO_INTERRUPTOR]);
  // pelo menos uma foto do Novo Anúncio (ex.: banner acrescentado depois): sem aviso
  assert.equal(fotosDiferentesDoNovoAnuncio({ fotosConferencia: [FOTO_INTERRUPTOR + "?v=2", "https://x/banner.png"], fotosNovoAnuncio: [FOTO_INTERRUPTOR] }).suspeita, false);
  // sem fotos do Novo Anúncio (ficha antiga): sem aviso
  assert.equal(fotosDiferentesDoNovoAnuncio({ fotosConferencia: FOTOS_TAMPA, fotosNovoAnuncio: [] }).suspeita, false);
  assert.equal(fotosDiferentesDoNovoAnuncio({ fotosConferencia: [], fotosNovoAnuncio: [FOTO_INTERRUPTOR] }).suspeita, false);
});

test("8) 'fotos atuais estão corretas' vale só para aquelas fotos daquela ficha", () => {
  const k1 = chaveFotosConferidas(ID_INTERRUPTOR, FOTOS_TAMPA);
  assert.equal(k1, chaveFotosConferidas(ID_INTERRUPTOR, FOTOS_TAMPA));
  assert.notEqual(k1, chaveFotosConferidas(ID_INTERRUPTOR, FOTOS_TAMPA.slice(0, 3)));
  assert.notEqual(k1, chaveFotosConferidas(ID_TAMPA, FOTOS_TAMPA));
});

test("9) código das telas: memória de fotos sempre com dono; Central esquece a anterior", () => {
  const conf = fs.readFileSync(path.join(RAIZ, "src/components/MercadoLivreTeste.jsx"), "utf8");
  const central = fs.readFileSync(path.join(RAIZ, "src/components/CentralPublicacao.jsx"), "utf8");
  // nenhuma gravação direta (sem dono) da memória de fotos
  assert.equal(/window\.__paiiaFotosPublicacao\s*=/.test(conf), false);
  assert.equal(/window\.__paiiaFotosPublicacao\s*=/.test(central), false);
  assert.match(conf, /fotosIniciaisConferencia\(\{/);
  assert.match(conf, /simuladorEhDoAnuncio\(dadosMemoria, dadosLocal\)/);
  const i = central.indexOf("esquecerFotosDeOutraFicha(window, anuncio)");
  const j = central.indexOf("window.__paiiaAnuncioSimulador = {");
  assert.ok(i > 0 && i < j, "a Central esquece as fotos antes de levar o anúncio à Conferência");
  // nada é apagado do armazenamento por causa disso
  assert.equal(/storage\.from\([^)]*\)\.remove/.test(conf.slice(conf.indexOf("function usarFotosDoNovoAnuncio"), conf.indexOf("function usarFotosDoNovoAnuncio") + 800)), false);
});
