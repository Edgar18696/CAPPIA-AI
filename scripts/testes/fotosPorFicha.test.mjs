// =============================================================
// PAIIA — TESTES: fotos POR ID DA FICHA (F5, troca de tela, reabrir).
//   node --test scripts/testes/fotosPorFicha.test.mjs
// Caso real (17/10/2026): ficha 9598b904 / 510959620 com as 4 fotos da
// tampa gravadas na Conferência (falha antiga) e as fotos do interruptor no
// Novo Anúncio. Central mostrava o interruptor; F5 trazia as tampas.
// Regra: as fotos da Conferência só valem se forem desta ficha (marca ou
// pelo menos 1 foto do Novo Anúncio dela); senão, as do Novo Anúncio, e as
// outras ficam no histórico (nada é apagado). Abrir nunca grava.
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decidirFotosDaFicha, situacaoFotosNaTela, origemFotosAprovadas, juntarHistoricoFotos, marcaDasFotos } from "../../src/services/fotosDaFicha.js";
import { montarRecuperacaoDaFicha } from "../../src/services/fichaConferencia.js";
import { conferirFichaPersistida } from "../../src/services/publicacaoSegura.js";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ID = "9598b904-b545-4e85-af69-036306788586";
const OUTRA = "11111111-1111-4111-8111-111111111111";
const TAMPAS = [1, 2, 3, 4].map((i) => `https://x.supabase.co/storage/v1/object/public/imagens/u/prontas/tampa-${i}.png`);
const INTER = [1, 2, 3, 4].map((i) => `https://x.supabase.co/storage/v1/object/public/imagens/u/prontas/interruptor-${i}.png`);
const BANNER = "https://x.supabase.co/storage/v1/object/public/imagens/u/banners/b1.png";

// Ficha como está na base depois da falha antiga.
const fichaContaminada = (extra = {}) => ({
  id: ID, codigo: "510959620", titulo: "Interruptor Botão Elétrico Teto Solar Tiguan TSI", updated_at: "2026-10-16T18:00:00Z",
  dados_conferencia: {
    salvo_em: "2026-10-16T17:00:00Z",
    anuncio: { codigo: "510959620", fotos: TAMPAS, fichaIdPAIIA: ID },
    novo_anuncio: { codigo: "510959620", fotos: INTER, salvo_em: "2026-10-16T16:00:00Z" },
    ficha: { campos: { titulo: "Interruptor", fotos: TAMPAS, ...extra }, etapa: "conferencia" },
  },
});

test("1) caso real 510959620: F5/reabrir abre com as fotos do interruptor; tampas ignoradas (guardadas)", () => {
  const rec = montarRecuperacaoDaFicha(fichaContaminada());
  assert.equal(rec.ok, true);
  assert.deepEqual(rec.fotos, INTER);
  assert.deepEqual(rec.anuncio.fotos, INTER);
  assert.equal(rec.decisaoFotos.origem, "novo_anuncio");
  assert.deepEqual(rec.decisaoFotos.ignoradas, TAMPAS);
  // repetir (F5 de novo / outro navegador) dá SEMPRE o mesmo
  assert.deepEqual(montarRecuperacaoDaFicha(fichaContaminada()).fotos, INTER);
  // nada da base é alterado pela leitura
  const f = fichaContaminada();
  const antes = JSON.stringify(f);
  montarRecuperacaoDaFicha(f);
  assert.equal(JSON.stringify(f), antes);
});

test("2) troca manual intencional na Conferência (marca desta ficha) é respeitada", () => {
  const rec = montarRecuperacaoDaFicha(fichaContaminada({ fotos: TAMPAS, fotosFichaId: marcaDasFotos(ID, TAMPAS) }));
  assert.deepEqual(rec.fotos, TAMPAS);
  assert.equal(rec.decisaoFotos.origem, "conferencia");
});

test("3) banner/reordenação/remoção na Conferência (com foto do Novo Anúncio) continua valendo", () => {
  const editadas = [INTER[2], INTER[0], BANNER];
  assert.deepEqual(decidirFotosDaFicha({ fichaId: ID, fotosConferencia: editadas, fotosNovoAnuncio: INTER }).fotos, editadas);
});

test("4) marca de OUTRA ficha nunca vale", () => {
  const d = decidirFotosDaFicha({ fichaId: ID, fotosConferencia: TAMPAS, marcaConferencia: marcaDasFotos(OUTRA, TAMPAS), fotosNovoAnuncio: INTER });
  assert.deepEqual(d.fotos, INTER);
  assert.deepEqual(d.ignoradas, TAMPAS);
});

test("4b) caso do F5: marca desta ficha guardada SEM as fotos (cópia local) não valida fotos de outra ficha", () => {
  // a cópia local leva a marca das fotos do interruptor; a base ainda tem as tampas
  const rec = montarRecuperacaoDaFicha(fichaContaminada(), { campos: { anuncioIdPAIIA: ID, fotosFichaId: marcaDasFotos(ID, INTER) }, salvoEm: "2026-10-17T10:00:00Z", versaoBase: "2026-10-16T17:00:00Z" });
  assert.deepEqual(rec.fotos, INTER);
  const d = decidirFotosDaFicha({ fichaId: ID, fotosConferencia: TAMPAS, marcaConferencia: `${ID}`, fotosNovoAnuncio: INTER });
  assert.deepEqual(d.fotos, INTER);
});

test("5) ficha antiga sem Novo Anúncio: mantém as fotos, mas pede confirmação para aprovar", () => {
  const d = decidirFotosDaFicha({ fichaId: ID, fotosConferencia: TAMPAS, fotosNovoAnuncio: [] });
  assert.deepEqual(d.fotos, TAMPAS);
  assert.equal(d.confiavel, false);
  assert.equal(situacaoFotosNaTela({ fichaId: ID, fotosTela: TAMPAS, fotosNovoAnuncio: [] }).estado, "confirmar");
  assert.equal(situacaoFotosNaTela({ fichaId: ID, fotosTela: TAMPAS, fotosNovoAnuncio: [], confirmadasNaTela: true }).estado, "ok");
});

test("6) tela da Conferência: bloqueia aprovação com fotos de outra ficha ou ainda conferindo", () => {
  assert.equal(situacaoFotosNaTela({ fichaId: ID, fotosTela: TAMPAS, fotosNovoAnuncio: INTER }).estado, "outra_origem");
  assert.equal(situacaoFotosNaTela({ fichaId: ID, fotosTela: TAMPAS, fotosNovoAnuncio: null }).estado, "verificando");
  assert.equal(situacaoFotosNaTela({ fichaId: ID, fotosTela: INTER, fotosNovoAnuncio: INTER }).estado, "ok");
  // gravadas com a marca desta ficha e iguais às da tela: ok mesmo sem relação com o Novo Anúncio
  assert.equal(situacaoFotosNaTela({ fichaId: ID, fotosTela: TAMPAS, fotosNovoAnuncio: INTER, marcaBase: marcaDasFotos(ID, TAMPAS), fotosBase: TAMPAS }).estado, "ok");
  // usuário escolheu (mexeu/confirmou) nesta tela: ok
  assert.equal(situacaoFotosNaTela({ fichaId: ID, fotosTela: TAMPAS, fotosNovoAnuncio: INTER, confirmadasNaTela: true }).estado, "ok");
});

const aprovada = (fotos, extra = {}, na = INTER) => ({
  id: ID,
  dados_conferencia: {
    novo_anuncio: { fotos: na },
    ficha: { assinaturaAprovada: "x", anuncioConferido: { titulo: "T", preco: "10", fotos, ...extra }, campos: {} },
  },
});

test("7) PUBLICAÇÃO: fotos aprovadas de outra ficha = bloqueada", () => {
  assert.equal(origemFotosAprovadas(aprovada(TAMPAS)).ok, false);
  assert.equal(origemFotosAprovadas(aprovada(TAMPAS, { fotosFichaId: OUTRA })).ok, false);
  assert.equal(origemFotosAprovadas(aprovada(INTER)).ok, true);
  assert.equal(origemFotosAprovadas(aprovada(TAMPAS, { fotosFichaId: marcaDasFotos(ID, TAMPAS) })).ok, true);
  // marca desta ficha, mas de OUTRA lista de fotos: não vale
  assert.equal(origemFotosAprovadas(aprovada(TAMPAS, { fotosFichaId: marcaDasFotos(ID, INTER) })).ok, false);
  const r = conferirFichaPersistida({ tela: { titulo: "T", preco: "10", fotos: TAMPAS }, envio: null, base: aprovada(TAMPAS) });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /Publicação bloqueada/);
  assert.equal(conferirFichaPersistida({ tela: { titulo: "T", preco: "10", fotos: INTER }, envio: null, base: aprovada(INTER) }).ok, true);
});

test("7b) ficha ANTIGA já aprovada sem origem comprovada: publicação bloqueada até a confirmação explícita", () => {
  const antiga = aprovada(TAMPAS, {}, []);
  const r = origemFotosAprovadas(antiga);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /Confirmo: estas fotos são deste anúncio/);
  // depois do "Confirmo..." a Conferência grava a marca desta ficha + destas fotos
  antiga.dados_conferencia.ficha.campos.fotosFichaId = marcaDasFotos(ID, TAMPAS);
  assert.equal(origemFotosAprovadas(antiga).ok, true);
  // marca guardada para outra lista não vale
  antiga.dados_conferencia.ficha.campos.fotosFichaId = marcaDasFotos(ID, INTER);
  assert.equal(origemFotosAprovadas(antiga).ok, false);
  // na tela: a confirmação é exigida antes de nova aprovação
  assert.equal(situacaoFotosNaTela({ fichaId: ID, fotosTela: TAMPAS, fotosNovoAnuncio: [] }).estado, "confirmar");
});

test("8) histórico das fotos ignoradas: acrescenta sem repetir e sem apagar", () => {
  let h = juntarHistoricoFotos([], { fotos: TAMPAS, motivo: "outra ficha" });
  h = juntarHistoricoFotos(h, { fotos: TAMPAS, motivo: "outra ficha" });
  assert.equal(h.length, 1);
  assert.deepEqual(h[0].fotos, TAMPAS);
  h = juntarHistoricoFotos(h, { fotos: [BANNER] });
  assert.equal(h.length, 2);
});

test("9) código: Conferência grava marca/histórico, bloqueia aprovação; nada apaga fotos", () => {
  const conf = fs.readFileSync(path.join(RAIZ, "src/components/MercadoLivreTeste.jsx"), "utf8");
  assert.match(conf, /const fotosFichaId = situacaoFotos\.estado === "ok" \? marcaDasFotos\(/);
  assert.match(conf, /fotosHistorico: fotosDaBase\.ignoradas\.length/);
  assert.match(conf, /faltando\.push\(`Fotos desta ficha — \$\{situacaoFotos\.motivo\}`\)/);
  assert.match(conf, /situacaoFotos\.estado !== "ok" \? `Fotos desta ficha/);
  assert.match(conf, /decidirFotosDaFicha\(\{ fichaId: r\.anuncio\.id, fotosConferencia: fotosLocaisBrutas/);
  const ini = conf.indexOf("// FOTOS POR ID DA FICHA");
  const bloco = conf.slice(ini, conf.indexOf("}, [anuncioIdPAIIA]);", ini));
  assert.ok(ini > 0);
  assert.equal(/\.remove\(|\.delete\(|storage\.|salvarRascunho|gravarRascunhoNaBase\(/.test(bloco), false, "ler a ficha não grava nem apaga");
  const ps = fs.readFileSync(path.join(RAIZ, "src/services/publicacaoSegura.js"), "utf8");
  assert.match(ps, /origemFotosAprovadas\(base\)/);
});
