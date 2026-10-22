// =============================================================
// PAIIA Voz × FOTO IA (fila em paralelo) — sem rede, sem Replicate, sem banco.
//   node --test scripts/testes/paiiaVozFotoIA.test.mjs
// Garante: modo real nunca é padrão; até 3 ao mesmo tempo; F5 continua com a
// MESMA chave (sem nova cobrança); falha não se repete sozinha; trocar a foto
// zera o tratamento; a original nunca é alterada.
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const IA = await import("../../src/modules/paiiaVoz/servicos/fotoIAVoz.js");
const G = await import("../../src/modules/paiiaVoz/servicos/fotosVozLocal.js");

const img = (nome, tam = 10) => Object.assign(new Blob([new Uint8Array(tam)], { type: "image/jpeg" }), { name: nome });
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function ate(cond, ms = 3000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) { if (await cond()) return true; await espera(10); }
  return false;
}

/** Foto IA de mentira com contador de cobrança por chave (como a função oficial). */
function fotoIAFalsa({ atraso = 30, falhas = {} } = {}) {
  const c = { envios: 0, recortes: 0, cobradas: new Set(), simultaneas: 0, maxSimultaneas: 0 };
  return {
    c,
    deps: {
      supabase: {},
      usuarioId: "u1",
      enviarOriginalFotoIA: async ({ arquivo }) => { c.envios++; return { caminho: `u1/originais/${arquivo.name}`, url: `https://x/${arquivo.name}`, arquivoEnviado: arquivo }; },
      recortarFotoIA: async ({ caminho, chave }) => {
        c.recortes++;
        c.simultaneas++; c.maxSimultaneas = Math.max(c.maxSimultaneas, c.simultaneas);
        try {
          await espera(atraso);
          if (Object.keys(falhas).some((k) => caminho.includes(k))) throw Object.assign(new Error("Não foi possível recortar esta foto."), { codigo: "FOTO_INVALIDA" });
          c.cobradas.add(chave); // a mesma chave conta uma vez só
          return { sucesso: true, recorteUrl: `https://x/recorte/${chave}.png`, uso: { usadas: c.cobradas.size } };
        } finally { c.simultaneas--; }
      },
      baixar: async () => new Blob([new Uint8Array(3)], { type: "image/png" }),
      comporFotoFinal: async ({ original }) => ({ blob: new Blob([new Uint8Array(7)], { type: "image/png" }), baseadoEm: original?.size }),
    },
  };
}

test("modos: real nunca é padrão e só existe com autorização no build", () => {
  assert.deepEqual(IA.modosDisponiveis({ modoTeste: true }), ["desligado", "simulacao"]);
  assert.deepEqual(IA.modosDisponiveis({ modoTeste: false }), ["desligado"]);
  assert.deepEqual(IA.modosDisponiveis({ modoTeste: false, realLiberado: true }), ["desligado", "real"]);
  assert.equal(IA.modoPadrao({ modoTeste: true }), "simulacao");
  assert.equal(IA.modoPadrao({ modoTeste: false, realLiberado: true }), "desligado");
  const arm = { m: new Map(), getItem(k) { return this.m.get(k) ?? null; }, setItem(k, v) { this.m.set(k, v); } };
  arm.setItem("paiiaVozFotoIAModo", "real");
  assert.equal(IA.lerModo({ modoTeste: false }, arm), "desligado", "‘real’ guardado não vale sem autorização");
  assert.equal(IA.lerModo({ modoTeste: true }, arm), "simulacao");
  const fonte = fs.readFileSync(new URL("../../src/modules/paiiaVoz/PaiiaVozRapido.jsx", import.meta.url), "utf8");
  assert.match(fonte, /realLiberado: import\.meta\.env\?\.VITE_PAIIA_VOZ_FOTO_IA_REAL === "1"/, "real depende de variável de build explícita");
  assert.ok(!/comporESalvarFotoIA|processarUmaFotoIA|from\("processamentos"\)/.test(fonte), "não grava na Galeria");
});

test("1, 3 e 5 fotos: todas tratadas, no máximo 3 ao mesmo tempo, cada uma cobrada 1 vez", async () => {
  for (const n of [1, 3, 5]) {
    const g = G.criarGuardaFotos({ armazenamento: G.armazenamentoMemoria() });
    await g.adicionar("F", Array.from({ length: n }, (_, i) => img(`f${i}.jpg`)));
    const falsa = fotoIAFalsa();
    const fila = IA.criarFilaFotoIA({ guarda: g, executar: IA.criarExecutorFotoIA(falsa.deps) });
    await fila.enfileirarNovas("F");
    assert.ok(await ate(async () => (await g.listar("F")).every((r) => r.ia?.estado === "pronta")), `${n} fotos prontas`);
    const regs = await g.listar("F");
    assert.equal(regs.length, n);
    assert.ok(regs.every((r) => r.usarNoAnuncio), "todas marcadas para o anúncio");
    assert.ok(regs.every((r) => r.tratada?.blob?.size === 7 && r.tratada.origem === "fotoIA"));
    assert.ok(regs.every((r) => r.blob.size === 10), "originais intactas");
    assert.ok(regs.every((r) => r.versao === "original"), "a escolha continua sendo do usuário");
    assert.equal(falsa.c.cobradas.size, n);
    assert.equal(falsa.c.envios, n);
    assert.ok(falsa.c.maxSimultaneas <= 3, `simultâneas: ${falsa.c.maxSimultaneas}`);
    if (n === 5) assert.equal(falsa.c.maxSimultaneas, 3);
    const r = IA.resumoFotos(regs);
    assert.deepEqual([r.total, r.prontas, r.tratando, r.falharam], [n, n, 0, 0]);
  }
});

test("F5 no meio: nada que possa cobrar de novo roda sozinho; recorte já baixado termina de graça", async () => {
  // Estado deixado por uma página que foi atualizada (F5) no meio do trabalho:
  const arm = G.armazenamentoMemoria();
  const g = G.criarGuardaFotos({ armazenamento: arm });
  await g.adicionar("F", [img("na-fila.jpg"), img("enviando.jpg"), img("recortando.jpg"), img("compondo.jpg")]);
  const [a, b, c, d] = await g.listar("F");
  await g.salvarIA(a.id, { estado: "na-fila", chave: "k-a" });
  await g.salvarIA(b.id, { estado: "enviando", chave: "k-b" });
  await g.salvarIA(c.id, { estado: "recortando", chave: "k-c", caminhoOriginal: "u1/originais/recortando.jpg" });
  await g.salvarIA(d.id, { estado: "compondo", chave: "k-d", caminhoOriginal: "u1/originais/compondo.jpg" }, { iaRecorte: new Blob([new Uint8Array(3)], { type: "image/png" }) });
  const falsa = fotoIAFalsa();
  const fila = IA.criarFilaFotoIA({ guarda: G.criarGuardaFotos({ armazenamento: arm }), executar: IA.criarExecutorFotoIA(falsa.deps) });
  await fila.processar("F");
  assert.ok(await ate(async () => { const r = await g.listar("F"); return r[0].ia.estado === "pronta" && r[1].ia.estado === "pronta" && r[3].ia.estado === "pronta"; }));
  let regs = await g.listar("F");
  assert.equal(regs[2].ia.estado, "interrompida", "recorte em andamento não recomeça sozinho");
  assert.deepEqual([...falsa.c.cobradas].sort(), ["k-a", "k-b"], "só as que nunca chegaram ao recorte foram recortadas");
  assert.equal(regs[3].tratada.origem, "fotoIA", "a que já tinha o recorte terminou sem nova chamada");
  assert.deepEqual(regs.map((r) => r.ia.chave), ["k-a", "k-b", "k-c", "k-d"], "chaves mantidas");
  // "Retomar" (pedido do usuário): mesma chave, sem reenviar a original
  const enviosAntes = falsa.c.envios;
  await fila.repetir("F", regs[2].id);
  assert.ok(await ate(async () => (await g.listar("F"))[2].ia.estado === "pronta"));
  regs = await g.listar("F");
  assert.equal(regs[2].ia.chave, "k-c");
  assert.equal(falsa.c.envios, enviosAntes, "não reenviou a original");
  assert.ok(falsa.c.cobradas.has("k-c"));
});

test("falha: fica 'falhou', não repete sozinha (nem depois do F5); 'Tentar de novo' usa a mesma chave", async () => {
  const arm = G.armazenamentoMemoria();
  const g = G.criarGuardaFotos({ armazenamento: arm });
  await g.adicionar("F", [img("ok.jpg"), img("falha-definitiva.jpg")]);
  const falsa = fotoIAFalsa({ falhas: { "falha-definitiva": true } });
  const fila = IA.criarFilaFotoIA({ guarda: g, executar: IA.criarExecutorFotoIA(falsa.deps) });
  await fila.enfileirarNovas("F");
  assert.ok(await ate(async () => (await g.listar("F")).every((r) => ["pronta", "falhou"].includes(r.ia?.estado))));
  const [ok, ruim] = await g.listar("F");
  assert.equal(ok.ia.estado, "pronta");
  assert.equal(ruim.ia.estado, "falhou");
  assert.match(ruim.ia.erro, /Não foi possível recortar/);
  assert.equal(ruim.tratada ?? null, null);
  assert.equal(IA.situacaoIA(ruim).estado, "falhou");
  const recortesAntes = falsa.c.recortes;
  const fila2 = IA.criarFilaFotoIA({ guarda: G.criarGuardaFotos({ armazenamento: arm }), executar: IA.criarExecutorFotoIA(falsa.deps) });
  await fila2.processar("F");
  await fila2.enfileirarNovas("F");
  await espera(80);
  assert.equal(falsa.c.recortes, recortesAntes, "após F5 a foto que falhou não é repetida sozinha");
  const chave = ruim.ia.chave;
  await fila2.repetir("F", ruim.id);
  assert.ok(await ate(async () => (await g.listar("F"))[1].ia.estado === "falhou"));
  assert.equal((await g.listar("F"))[1].ia.chave, chave, "mesma chave ao tentar de novo");
  assert.equal(falsa.c.envios, 2, "não reenviou a original ao tentar de novo");
});

test("trocar a foto zera o tratamento (nova chave); excluir no meio não quebra", async () => {
  const g = G.criarGuardaFotos({ armazenamento: G.armazenamentoMemoria() });
  await g.adicionar("F", [img("a.jpg"), img("b.jpg"), img("c.jpg")]);
  const falsa = fotoIAFalsa({ atraso: 40 });
  const fila = IA.criarFilaFotoIA({ guarda: g, executar: IA.criarExecutorFotoIA(falsa.deps) });
  await fila.enfileirarNovas("F");
  let regs = await g.listar("F");
  await g.remover(regs[2].id); // excluída enquanto trata
  assert.ok(await ate(async () => (await g.listar("F")).every((r) => r.ia?.estado === "pronta")));
  regs = await g.listar("F");
  assert.equal(regs.length, 2);
  const chaveAntiga = regs[0].ia.chave;
  await g.escolherVersao(regs[0].id, "tratada");
  await g.substituir(regs[0].id, img("a2.jpg", 20));
  const trocada = (await g.listar("F"))[0];
  assert.deepEqual([trocada.ia, trocada.tratada, trocada.versao, trocada.blob.size], [null, null, "original", 20]);
  await fila.enfileirarNovas("F");
  assert.ok(await ate(async () => (await g.listar("F"))[0].ia?.estado === "pronta"));
  assert.notEqual((await g.listar("F"))[0].ia.chave, chaveAntiga);
});

test("escolhas do usuário não se perdem enquanto o tratamento grava o progresso", async () => {
  const g = G.criarGuardaFotos({ armazenamento: G.armazenamentoMemoria() });
  await g.adicionar("F", [img("a.jpg")]);
  const falsa = fotoIAFalsa({ atraso: 60 });
  const fila = IA.criarFilaFotoIA({ guarda: g, executar: IA.criarExecutorFotoIA(falsa.deps) });
  await fila.enfileirarNovas("F");
  const [r] = await g.listar("F");
  await g.marcarUso(r.id, false);
  assert.ok(await ate(async () => (await g.listar("F"))[0].ia?.estado === "pronta"));
  const fim = (await g.listar("F"))[0];
  assert.equal(fim.usarNoAnuncio, false, "desmarcar durante o tratamento foi preservado");
  await g.escolherVersao(fim.id, "tratada");
  const arq = g.arquivoEscolhido((await g.listar("F"))[0]);
  assert.equal(arq.size, 7);
});
