// (10/11) SKU 39038558: "todas as oito etapas verdes" enquanto o vínculo no Bling ainda estava em
// conferência. A lista do piloto concluído não pode pintar de verde o que não foi confirmado.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { situacaoEtapaPiloto, ETAPAS_PILOTO } from "../../src/services/pilotoPublicacao.js";
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const todas = (o) => Object.fromEntries(ETAPAS_PILOTO.map((e) => [e, situacaoEtapaPiloto(e, o)]));

test("concluído com vínculo NÃO confirmado: Vínculo no Bling fica ⚠ 'a conferir', o resto ✅", () => {
  const s = todas({ fim: { ok: true, vinculo: false, ativo: true }, atual: "central" });
  assert.equal(s.vinculo.estado, "conferir");
  assert.equal(s.vinculo.icone, "⚠");
  assert.match(s.vinculo.sufixo, /a conferir \(segue sozinho em segundo plano\)/);
  for (const e of ETAPAS_PILOTO.filter((x) => x !== "vinculo")) assert.equal(s[e].estado, "ok", e);
});

test("concluído sem ativação confirmada: Anúncio ativo fica ⚠", () => {
  const s = todas({ fim: { ok: true, vinculo: true, ativo: false } });
  assert.equal(s.ativo.estado, "conferir");
  assert.equal(s.vinculo.estado, "ok");
});

test("tudo confirmado: as 8 etapas ✅", () => {
  const s = todas({ fim: { ok: true, vinculo: true, ativo: true } });
  assert.ok(ETAPAS_PILOTO.every((e) => s[e].estado === "ok" && s[e].icone === "✅"));
});

test("ficha que já tinha MLB: Publicação 'já existia (nada foi publicado de novo)'", () => {
  const s = todas({ fim: { ok: true, vinculo: false, ativo: true, jaExistia: true } });
  assert.match(s.publicar.sufixo, /já existia \(nada foi publicado de novo\)/);
  assert.equal(s.vinculo.estado, "conferir");
});

test("durante a execução e na pausa: igual a antes", () => {
  const exec = todas({ atual: "bling", texto: "Consultando…" });
  assert.equal(exec.canais.estado, "ok");
  assert.equal(exec.bling.estado, "atual");
  assert.equal(exec.bling.sufixo, " — Consultando…");
  assert.equal(exec.quantidade.estado, "pendente");
  const pausa = todas({ fim: { ok: false }, atual: "publicar" });
  assert.equal(pausa.publicar.estado, "pausa");
  assert.equal(pausa.validar.estado, "ok");
  assert.equal(pausa.ativo.estado, "pendente");
});

test("tela usa a situação por etapa e diz 'ANÚNCIO JÁ PUBLICADO' quando o MLB já existia", () => {
  const c = ler("src/components/PilotoAutomaticoPublicacao.jsx");
  assert.ok(c.includes("situacaoEtapaPiloto(e, { fim: st.fim, atual: st.etapa, texto: st.texto })"));
  assert.ok(c.includes("data-paiia-piloto-etapa-estado={s.estado}"));
  assert.ok(!c.includes('st.fim?.ok || k < i ? "✅"'), "não pinta tudo de verde");
  assert.ok(c.includes("ANÚNCIO JÁ PUBLICADO — nada foi publicado de novo"));
});
