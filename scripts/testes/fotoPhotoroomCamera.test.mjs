// (13/11) Foto IA câmera + Photoroom Sandbox: chave só no intermediário local,
// reserva grátis quando o Photoroom falha. Sem rede: tudo com dependências falsas.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";

const D = await import("../dev/photoroomDev.mjs");
const P = await import("../../src/services/fotoIA/recortePhotoroom.js");

const CHAVE = "sandbox_" + "x".repeat(40);

function req(corpo, { metodo = "POST", url = D.ROTA_PHOTOROOM_LOCAL } = {}) {
  const r = new EventEmitter();
  Object.assign(r, { method: metodo, url, headers: { "content-type": "image/jpeg" }, destroy() {} });
  setImmediate(() => { if (corpo) r.emit("data", corpo); r.emit("end"); });
  return r;
}
function res() {
  const r = { statusCode: 0, cabecalhos: {}, corpo: null, setHeader(k, v) { this.cabecalhos[k] = v; }, end(c) { this.corpo = c; this.fim?.(); } };
  r.pronto = new Promise((ok) => { r.fim = ok; });
  return r;
}
function arquivoChave(conteudo) {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "paiia-pr-")), "chave.env");
  fs.writeFileSync(f, conteudo);
  return f;
}

test("chave: só a mesma linha, só sandbox_, nunca aparece em mensagens", () => {
  assert.equal(D.lerChaveSandbox(`PHOTOROOM_SANDBOX_KEY=${CHAVE}\nPHOTOROOM_API_KEY=`).chave, CHAVE);
  assert.equal(D.lerChaveSandbox("PHOTOROOM_SANDBOX_KEY=\nPHOTOROOM_API_KEY=sk_pr_abc").ok, false, "vazia não puxa a linha de baixo");
  assert.match(D.lerChaveSandbox("PHOTOROOM_SANDBOX_KEY=sk_pr_abc").erro, /não é Sandbox/);
  assert.equal(D.esconderChave(`erro com ${CHAVE} e sk_pr_123abc`), "erro com sandbox_*** e sk_pr_***");
});

test("intermediário: recorta com a chave do arquivo e devolve só o PNG; sem chave → 503 sem chamar", async () => {
  let usada = "";
  const mw = D.criarMiddlewarePhotoroom({
    arquivoChave: arquivoChave(`PHOTOROOM_SANDBOX_KEY=${CHAVE}\n`),
    chamar: async (k, img) => { usada = k; assert.equal(img.toString(), "FOTO"); return { status: 200, corpo: Buffer.from("PNG") }; },
    limpar: async (png) => png,
  });
  const r = res();
  await mw(req(Buffer.from("FOTO")), r, () => assert.fail("não deveria passar adiante"));
  await r.pronto;
  assert.equal(r.statusCode, 200);
  assert.equal(r.cabecalhos["Content-Type"], "image/png");
  assert.equal(r.corpo.toString(), "PNG");
  assert.equal(usada, CHAVE);
  assert.ok(!JSON.stringify(r.cabecalhos).includes(CHAVE), "chave não volta ao navegador");

  let chamou = false;
  const semChave = D.criarMiddlewarePhotoroom({ arquivoChave: arquivoChave("PHOTOROOM_SANDBOX_KEY=\n"), chamar: async () => { chamou = true; } });
  const r2 = res();
  await semChave(req(Buffer.from("F")), r2, () => {});
  await r2.pronto;
  assert.equal(r2.statusCode, 503);
  assert.equal(chamou, false);

  // erro do Photoroom com a chave no texto: devolvido escondido
  const erro = D.criarMiddlewarePhotoroom({ arquivoChave: arquivoChave(`PHOTOROOM_SANDBOX_KEY=${CHAVE}\n`), chamar: async () => ({ status: 401, corpo: Buffer.from(`invalid key ${CHAVE}`) }) });
  const r3 = res();
  await erro(req(Buffer.from("F")), r3, () => {});
  await r3.pronto;
  assert.equal(r3.statusCode, 502);
  assert.ok(!String(r3.corpo).includes(CHAVE));

  // outras rotas seguem normalmente
  let seguiu = false;
  await mw(req(null, { url: "/outra" }), res(), () => { seguiu = true; });
  assert.equal(seguiu, true);
});

test("navegador: chama só o intermediário (sem chave); fora do dev não tenta; falha → recorte grátis", async () => {
  const chamadas = [];
  const buscar = async (url, o) => { chamadas.push({ url, o }); return { ok: true, blob: async () => new Blob(["png"], { type: "image/png" }) }; };
  const foto = new Blob(["jpg"], { type: "image/jpeg" });
  const r = await P.recortarPhotoroom(foto, { buscar, disponivel: true });
  assert.equal(r.metodo, "photoroom");
  assert.equal(chamadas[0].url, "/__paiia/photoroom-recorte");
  assert.ok(!JSON.stringify(chamadas[0].o.headers).match(/x-api-key|sandbox_/i), "navegador não manda chave");
  await assert.rejects(P.recortarPhotoroom(foto, { buscar, disponivel: false }), /não disponível/);

  let falhas = 0;
  const recortar = P.recortarComReserva({
    photoroom: async () => { throw new Error("Photoroom 402"); },
    gratis: async () => ({ blob: new Blob(["local"]) }),
    aoFalharPhotoroom: () => { falhas += 1; },
  });
  const r2 = await recortar(foto);
  assert.equal(r2.metodo, "local");
  assert.equal(falhas, 1);
  const r3 = await P.recortarComReserva({ photoroom: async () => ({ blob: new Blob(["p"]), metodo: "photoroom" }), gratis: async () => assert.fail("não usa o grátis") })(foto);
  assert.equal(r3.metodo, "photoroom");
});

test("fonte: chave só em arquivo fora do projeto; nada de VITE_ nem chave no src", () => {
  const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  const fila = ler("src/services/fotoIA/filaCameraApp.js");
  assert.match(fila, /recortarComReserva\(\{ photoroom: \(f\) => recortarPhotoroom\(f\), gratis: \(f\) => recortarLocalmente\(f\) \}\)/);
  for (const p of ["src/services/fotoIA/recortePhotoroom.js", "src/services/fotoIA/filaCameraApp.js", "vite.config.js"]) {
    const t = ler(p);
    assert.doesNotMatch(t, /VITE_PHOTOROOM|sandbox_[A-Za-z0-9]{10,}|sk_pr_[A-Za-z0-9]{6,}/, p);
  }
  assert.match(ler("vite.config.js"), /name: "paiia-photoroom-local",\s*apply: "serve"/, "só no npm run dev");
});

test("13/11 celular: cópia do aparelho ilegível → tenta com a original da Galeria antes da cota; motivo de cada etapa aparece", async () => {
  const C = await import("../../src/services/fotoIA/fotoCameraGaleria.js");
  const enviados = [];
  const sb = {
    storage: { from: () => ({ upload: async (c) => { enviados.push(c); return { error: null }; }, getPublicUrl: (c) => ({ data: { publicUrl: `https://x/${c}` } }) }) },
    from: () => { const q = { update: () => q, eq: () => q, select: async () => ({ data: [{ id: "row-1" }], error: null }) }; return q; },
  };
  const daGaleria = new Blob(["galeria"], { type: "image/jpeg" });
  const doAparelho = new Blob(["aparelho"], { type: "image/jpeg" });
  let fotoIA = 0;
  const recortar = P.recortarComReserva({
    photoroom: async (f) => { if (f === doAparelho) throw new Error("Photoroom: Load failed"); return { blob: new Blob(["png"]), metodo: "photoroom" }; },
    gratis: async (f) => { if (f === doAparelho) throw new Error("não abriu a foto"); return { blob: new Blob(["l"]) }; },
  });
  let compostaCom = null;
  const base = { supabase: sb, usuarioId: "u", linhaId: "row-1", urlOriginal: "https://x/orig.jpg", caminho: "u/originais/camera-1.jpg", original: doAparelho,
    recortarFotoIA: async () => { fotoIA += 1; throw Object.assign(new Error("Você atingiu o limite de 50 Fotos IA deste mês"), { codigo: "LIMITE_MENSAL" }); },
    comporFotoFinal: async ({ original }) => { compostaCom = original; return { blob: new Blob(["final"]) }; },
    baixar: async (u) => (u === "https://x/orig.jpg" ? daGaleria : new Blob(["r"])) };
  const t = await C.tratarFotoDaGaleria({ ...base, recortarLocal: recortar });
  assert.equal(t.metodo, "photoroom", "Photoroom com a original da Galeria");
  assert.equal(fotoIA, 0, "cota da reserva nem foi tocada");
  assert.equal(compostaCom, daGaleria, "composição com a foto que funcionou");
  // tudo falha: a mensagem separa a cota da reserva dos motivos do Photoroom e do grátis
  const nada = P.recortarComReserva({ photoroom: async () => { throw new Error("Photoroom: HTTP 503"); }, gratis: async () => { throw new Error("modelo não carregou"); } });
  await assert.rejects(C.tratarFotoDaGaleria({ ...base, recortarLocal: nada }), (e) => {
    assert.equal(e.codigo, "LIMITE_MENSAL", "cota continua protegida");
    assert.match(e.message, /^Reserva Foto IA: Você atingiu o limite/);
    assert.match(e.message, /cópia do aparelho: Photoroom: HTTP 503 · Recorte grátis: modelo não carregou/);
    assert.match(e.message, /original da Galeria: Photoroom: HTTP 503/);
    return true;
  });
});
