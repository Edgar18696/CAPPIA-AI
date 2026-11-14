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
  const r = await P.recortarPhotoroom(foto, { buscar, dev: true });
  assert.equal(r.metodo, "photoroom");
  assert.equal(chamadas[0].url, "/__paiia/photoroom-recorte");
  assert.ok(!JSON.stringify(chamadas[0].o.headers).match(/x-api-key|sandbox_/i), "navegador não manda chave");
  await assert.rejects(P.recortarPhotoroom(foto, { buscar, dev: false }), /não disponível/);

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
  assert.match(fila, /photoroom: \(f, ctx\) => recortarPhotoroom\(f, \{ caminho: ctx\?\.caminho/);
  assert.match(fila, /gratis: async \(f\) => \{ try \{ return await recortarLocalmente\(f\); \}/);
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
  // (14/11) Photoroom (pago) só uma vez: com a original da Galeria entra o recorte grátis.
  assert.equal(t.metodo, "local", "grátis com a original da Galeria (Photoroom não repetido)");
  assert.equal(fotoIA, 0, "cota da reserva nem foi tocada");
  assert.equal(compostaCom, daGaleria, "composição com a foto que funcionou");
  // tudo falha: a mensagem separa a cota da reserva dos motivos do Photoroom e do grátis
  const nada = P.recortarComReserva({ photoroom: async () => { throw new Error("Photoroom: HTTP 503"); }, gratis: async () => { throw new Error("modelo não carregou"); } });
  await assert.rejects(C.tratarFotoDaGaleria({ ...base, recortarLocal: nada }), (e) => {
    assert.equal(e.codigo, "LIMITE_MENSAL", "cota continua protegida");
    assert.match(e.message, /^Fundo branco não aplicado: o recorte automático não funcionou nesta foto e a reserva Foto IA está no limite do mês\. A foto original está salva na Galeria\./);
    assert.match(e.message, /cópia do aparelho: Photoroom: HTTP 503 · Recorte grátis: modelo não carregou/);
    assert.match(e.message, /original da Galeria: Photoroom não repetido automaticamente · Recorte grátis: modelo não carregou/);
    return true;
  });
});

test("13/11 Básico: chave de produção só com PHOTOROOM_USAR_PRODUCAO=sim; teto de fotos pagas por execução", async () => {
  const PROD = "sk_pr_" + "a".repeat(30);
  assert.equal(D.escolherChave(`PHOTOROOM_SANDBOX_KEY=${CHAVE}\nPHOTOROOM_API_KEY=${PROD}\n`).modo, "sandbox", "sem permissão explícita: Sandbox");
  const p = D.escolherChave(`PHOTOROOM_SANDBOX_KEY=${CHAVE}\nPHOTOROOM_API_KEY=${PROD}\nPHOTOROOM_USAR_PRODUCAO=sim\n`);
  assert.deepEqual([p.modo, p.chave, p.limite], ["producao", PROD, 3]);
  assert.equal(D.escolherChave(`PHOTOROOM_API_KEY=${PROD}\nPHOTOROOM_USAR_PRODUCAO=sim\nPHOTOROOM_LIMITE_LOCAL=1\n`).limite, 1);
  assert.equal(D.escolherChave("PHOTOROOM_API_KEY=\nPHOTOROOM_USAR_PRODUCAO=sim\n").ok, false);
  assert.equal(D.escolherChave(`PHOTOROOM_API_KEY=${CHAVE}\nPHOTOROOM_USAR_PRODUCAO=sim\n`).ok, false, "sandbox no lugar da produção");
  const corpo = D.corpoBasico(Buffer.from("F")).corpo.toString();
  assert.match(corpo, /name="image_file"/);
  assert.match(corpo, /name="crop"\r\n\r\nfalse/, "não corta: a peça fica na posição da foto");

  const modos = [];
  let limpou = 0;
  const mw = D.criarMiddlewarePhotoroom({
    arquivoChave: arquivoChave(`PHOTOROOM_API_KEY=${PROD}\nPHOTOROOM_USAR_PRODUCAO=sim\nPHOTOROOM_LIMITE_LOCAL=1\n`),
    chamar: async (k, img, tipo, modo) => { modos.push([k === PROD, modo]); return { status: 200, corpo: Buffer.from("PNG") }; },
    limpar: async (x) => { limpou += 1; return x; },
  });
  const r1 = res(); await mw(req(Buffer.from("F")), r1, () => {}); await r1.pronto;
  assert.equal(r1.statusCode, 200);
  assert.equal(r1.cabecalhos["X-Paiia-Recorte"], "photoroom-basico");
  assert.equal(limpou, 0, "produção não tem marca-d'água para limpar");
  const r2 = res(); await mw(req(Buffer.from("F")), r2, () => {}); await r2.pronto;
  assert.equal(r2.statusCode, 429, "segunda foto paga bloqueada pelo teto local");
  assert.deepEqual(modos, [[true, "producao"]], "só 1 chamada paga");
  // erro com a chave de produção no texto: escondido
  const erro = D.criarMiddlewarePhotoroom({ arquivoChave: arquivoChave(`PHOTOROOM_API_KEY=${PROD}\nPHOTOROOM_USAR_PRODUCAO=sim\n`), chamar: async () => ({ status: 401, corpo: Buffer.from(`bad ${PROD}`) }) });
  const r3 = res(); await erro(req(Buffer.from("F")), r3, () => {}); await r3.pronto;
  assert.ok(!String(r3.corpo).includes(PROD));
});

test("13/11 site: Photoroom pela função do servidor com o caminho da ORIGINAL na Galeria; cota própria", async () => {
  const pedidos = [];
  const invocar = async (nome, o) => { pedidos.push([nome, o.body]); return { data: { sucesso: true, recorteUrl: "https://x/recorte.png" }, error: null }; };
  const baixar = async () => new Blob(["png"], { type: "image/png" });
  const r = await P.recortarPhotoroom(new Blob(["x"]), { dev: false, caminho: "u/originais/camera-1.jpg", invocar, baixar });
  assert.equal(r.metodo, "photoroom");
  assert.deepEqual(pedidos, [["foto-photoroom", { caminho: "u/originais/camera-1.jpg" }]], "só o caminho; nada de chave");
  const naoPublicada = async () => ({ data: null, error: { message: "Function not found", context: { json: async () => ({ erro: "não encontrada" }) } } });
  await assert.rejects(P.recortarPhotoroom(new Blob(["x"]), { dev: false, caminho: "c", invocar: naoPublicada, baixar }), /Photoroom: não encontrada/);
  const cota = async () => ({ data: { sucesso: false, codigo: "LIMITE_MENSAL", erro: "Você atingiu o limite de 100 fotos profissionais deste mês." }, error: null });
  await assert.rejects(P.recortarPhotoroom(new Blob(["x"]), { dev: false, caminho: "c", invocar: cota, baixar }), (e) => e.codigo === "LIMITE_MENSAL" && /fotos profissionais/.test(e.message));
  // contexto (caminho) chega ao Photoroom pela cadeia de reserva
  let ctxVisto = null;
  await P.recortarComReserva({ photoroom: async (f, ctx) => { ctxVisto = ctx; return { blob: new Blob(["p"]), metodo: "photoroom" }; }, gratis: async () => assert.fail() })(new Blob(["x"]), { caminho: "u/originais/camera-9.jpg" });
  assert.equal(ctxVisto.caminho, "u/originais/camera-9.jpg");
  const fn = fs.readFileSync(new URL("../../supabase/functions/foto-photoroom/index.ts", import.meta.url), "utf8");
  assert.match(fn, /FOTO_PHOTOROOM_LIMITE_MENSAL/);
  assert.doesNotMatch(fn, /FOTO_IA_LIMITE_MENSAL|paiia_foto_ia_uso/, "não usa a cota do foto-ia");
  assert.match(fn, /Deno\.env\.get\("PHOTOROOM_API_KEY"\)/);
  assert.match(fn, /startsWith\(`\$\{usuarioId\}\/originais\/`\)/, "só fotos do próprio usuário");
});

test("13/11 diagnóstico: contador de pagas em arquivo (reiniciar não zera), registro sem chave, entrega confirmada", async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "paiia-pr-diag-"));
  const PROD = "sk_pr_" + "b".repeat(30);
  const chaveArq = arquivoChave(`PHOTOROOM_API_KEY=${PROD}\nPHOTOROOM_USAR_PRODUCAO=sim\nPHOTOROOM_LIMITE_LOCAL=1\n`);
  const contadorA = D.contadorArquivo(path.join(pasta, "uso.json"), () => "2026-11-13");
  let chamadas = 0;
  const png = Buffer.alloc(30); png.writeUInt32BE(0x89504e47, 0); png.writeUInt32BE(1920, 16); png.writeUInt32BE(2560, 20);
  const novo = () => D.criarMiddlewarePhotoroom({ arquivoChave: chaveArq, contador: D.contadorArquivo(path.join(pasta, "uso.json"), () => "2026-11-13"), registrar: D.registroArquivo(pasta), chamar: async () => { chamadas += 1; return { status: 200, corpo: png }; } });
  const r1 = res(); r1.on = (ev, fn) => { if (ev === "finish") r1.aoTerminar = fn; }; r1.writableFinished = true;
  await novo()(req(Buffer.from("F")), r1, () => {}); await r1.pronto; r1.aoTerminar?.();
  assert.equal(r1.statusCode, 200);
  assert.equal(contadorA.ler(), 1);
  // "reiniciou o servidor": novo middleware, mesmo arquivo → continua bloqueado
  const r2 = res(); r2.on = () => {};
  await novo()(req(Buffer.from("F")), r2, () => {}); await r2.pronto;
  assert.equal(r2.statusCode, 429);
  assert.equal(chamadas, 1, "nenhuma nova chamada paga");
  // outro dia: libera de novo
  assert.equal(D.contadorArquivo(path.join(pasta, "uso.json"), () => "2026-11-14").ler(), 0);
  const log = fs.readFileSync(path.join(pasta, "photoroom-local.log"), "utf8");
  assert.match(log, /"modo":"producao".*"photoroom_status":200.*"saida_dim":"1920x2560".*"entregue":true/);
  assert.match(log, /"resposta":429/);
  assert.ok(!log.includes(PROD), "log sem chave");
  assert.ok(fs.existsSync(path.join(pasta, "ultimo-recorte.png")));
  assert.equal(D.dimensoes(png), "1920x2560");
});

test("14/11 modo só gratuito (PAIIA_FOTO_GRATIS=1): Photoroom não é chamado", async () => {
  let chamou = false;
  const mw = D.criarMiddlewarePhotoroom({ arquivoChave: arquivoChave(`PHOTOROOM_SANDBOX_KEY=${CHAVE}\n`), chamar: async () => { chamou = true; return { status: 200, corpo: Buffer.from("x") }; }, desligado: true });
  const r = res(); await mw(req(Buffer.from("F")), r, () => {}); await r.pronto;
  assert.equal(r.statusCode, 503);
  assert.match(String(r.corpo), /só recorte grátis/);
  assert.equal(chamou, false);
  assert.match(fs.readFileSync(new URL("../../vite.config.js", import.meta.url), "utf8"), /desligado: globalThis\.process\?\.env\?\.PAIIA_FOTO_GRATIS === "1"/);
});

test("14/11 Photoroom pago no máximo UMA vez por foto: 2ª fonte e novas tentativas automáticas usam só o grátis", async () => {
  const C = await import("../../src/services/fotoIA/fotoCameraGaleria.js");
  const sb = {
    storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: (c) => ({ data: { publicUrl: `https://x/${c}` } }) }) },
    from: () => { const q = { update: () => q, eq: () => q, select: async () => ({ data: [{ id: "row-1" }], error: null }) }; return q; },
  };
  let pagas = 0;
  let gratis = 0;
  const recortar = (gratisFalha = false) => P.recortarComReserva({
    photoroom: async () => { pagas += 1; throw new Error("Photoroom: Failed to fetch"); },
    gratis: async () => { gratis += 1; if (gratisFalha) throw new Error("modelo não carregou"); return { blob: new Blob(["l"]) }; },
  });
  const base = { supabase: sb, usuarioId: "u", linhaId: "row-1", urlOriginal: "https://x/o.jpg", caminho: "u/originais/camera-1.jpg", original: new Blob(["a"]),
    recortarFotoIA: async () => { throw Object.assign(new Error("Você atingiu o limite de 50 Fotos IA deste mês."), { codigo: "LIMITE_MENSAL" }); },
    comporFotoFinal: async () => ({ blob: new Blob(["f"]) }), baixar: async () => new Blob(["g"]) };
  // 1ª tentativa: Photoroom falha (rede) → grátis na mesma tentativa; Photoroom 1 vez só
  const t1 = await C.tratarFotoDaGaleria({ ...base, recortarLocal: recortar() });
  assert.equal(t1.metodo, "local");
  assert.equal(pagas, 1);
  // tudo falha: duas fontes, mas o Photoroom continua 1 vez só
  pagas = 0;
  await assert.rejects(C.tratarFotoDaGaleria({ ...base, recortarLocal: recortar(true) }));
  assert.equal(pagas, 1, "2ª fonte não chama o Photoroom de novo");
  // nova tentativa automática (semPhotoroom): zero chamadas pagas
  pagas = 0;
  await C.tratarFotoDaGaleria({ ...base, recortarLocal: recortar(), semPhotoroom: true });
  assert.equal(pagas, 0);
  // a fila passa semPhotoroom nas tentativas automáticas e nas fotos antigas reabertas
  const fila = fs.readFileSync(new URL("../../src/services/fotoIA/filaCameraApp.js", import.meta.url), "utf8");
  assert.match(fila, /semPhotoroom: \(Number\(tentativas\) \|\| 0\) > 0 \|\| Boolean\(reaberta\)/);
  // servidor: mesma foto nunca é cobrada duas vezes; franquia própria de 1000
  const fn = fs.readFileSync(new URL("../../supabase/functions/foto-photoroom/index.ts", import.meta.url), "utf8");
  assert.match(fn, /reaproveitado: true/);
  assert.match(fn, /const caminhoRecorte = `\$\{pastaMes\}\/\$\{nomeRecorte\}`/);
  assert.match(fn, /FOTO_PHOTOROOM_LIMITE_MENSAL"\) \|\| "1000"/);
  assert.ok(fn.indexOf("reaproveitado: true") < fn.indexOf("await fetch(ENDERECO"), "reaproveita ANTES de chamar o Photoroom");
});
