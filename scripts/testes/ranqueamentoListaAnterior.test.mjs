// =============================================================
// PAIIA — TESTES (19/11/2026): cópia da LISTA ANTERIOR antes de "Analisar novos"/"Reanalisar"
// trocarem a lista da tela, e "Lista anterior" para voltar a ela (nada se perde).
//   node --test scripts/testes/ranqueamentoListaAnterior.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RC = await import("../../src/services/paizinhoAuditoria/relatoriosPorConta.js");

const REV = "2412238242";
function memoria({ limite = Infinity } = {}) {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { if (String(v).length > limite) throw new Error("QuotaExceededError"); m.set(k, String(v)); }, removeItem: (k) => m.delete(k), m };
}
const lista = (gerado, n, conta = REV) => ({ conta: { id: conta }, gerado_em: gerado, anuncios: Array.from({ length: n }, (_, i) => ({ item_id: `MLB${gerado.slice(11, 13)}${i}` })) });

test("Analisar novos: a lista atual (21) vira 'anterior' e a nova (18) entra; as duas ficam guardadas", () => {
  const arm = memoria();
  RC.guardarRelatorioDaConta(lista("2026-11-19T13:00:00Z", 21), arm);
  const r = RC.guardarSubstituindoComCopia(lista("2026-11-19T15:00:00Z", 18), arm);
  assert.deepEqual(r, { ok: true, copiou: true });
  assert.equal(RC.lerRelatorioDaConta(REV, arm).anuncios.length, 18);
  assert.equal(RC.lerListaAnterior(REV, arm).anuncios.length, 21);
  assert.equal(RC.lerListaAnterior(REV, arm).gerado_em, "2026-11-19T13:00:00Z");
});

test("'Lista anterior' troca as duas sem perder nenhuma; trocar de novo volta ao estado anterior", () => {
  const arm = memoria();
  RC.guardarRelatorioDaConta(lista("2026-11-19T13:00:00Z", 21), arm);
  RC.guardarSubstituindoComCopia(lista("2026-11-19T15:00:00Z", 18), arm);
  const t = RC.trocarComListaAnterior(REV, arm);
  assert.equal(t.ok, true);
  assert.equal(RC.lerRelatorioDaConta(REV, arm).anuncios.length, 21);
  assert.equal(RC.lerListaAnterior(REV, arm).anuncios.length, 18);
  RC.trocarComListaAnterior(REV, arm);
  assert.equal(RC.lerRelatorioDaConta(REV, arm).anuncios.length, 18);
  assert.equal(RC.lerListaAnterior(REV, arm).anuncios.length, 21);
});

test("sem espaço para a cópia: a lista atual NÃO é trocada; mesma lista (mesma geração): sem cópia", () => {
  const arm = memoria();
  const atual = lista("2026-11-19T13:00:00Z", 21);
  RC.guardarRelatorioDaConta(atual, arm);
  arm.setItem = (k, v) => { if (k.includes(":anterior:")) throw new Error("QuotaExceededError"); arm.m.set(k, String(v)); };
  const r = RC.guardarSubstituindoComCopia(lista("2026-11-19T15:00:00Z", 18), arm);
  assert.equal(r.ok, false);
  assert.match(r.erro, /lista atual foi mantida/);
  assert.equal(RC.lerRelatorioDaConta(REV, arm).anuncios.length, 21, "nada se perde");
  // mesma geração (ex.: lista juntada pela reanálise individual) não vira 'anterior' de si mesma
  const arm2 = memoria();
  RC.guardarRelatorioDaConta(atual, arm2);
  assert.deepEqual(RC.guardarSubstituindoComCopia({ ...atual, anuncios: [...atual.anuncios, { item_id: "MLBX" }] }, arm2), { ok: true, copiou: false });
  assert.equal(RC.lerListaAnterior(REV, arm2), null);
});

test("contas separadas; sem lista anterior → aviso; primeira análise da conta não cria cópia", () => {
  const arm = memoria();
  RC.guardarRelatorioDaConta(lista("2026-11-19T13:00:00Z", 5, "824312524"), arm);
  assert.deepEqual(RC.guardarSubstituindoComCopia(lista("2026-11-19T15:00:00Z", 3), arm), { ok: true, copiou: false });
  assert.equal(RC.lerListaAnterior(REV, arm), null, "lista da CIEBR nunca vira anterior da REVELAÇÃO");
  assert.equal(RC.trocarComListaAnterior(REV, arm).ok, false);
});

test("serviço e tela: 'Analisar novos'/'Reanalisar' guardam a cópia antes de trocar; reanálise individual usa a mesma chave", () => {
  const svc = fs.readFileSync(path.join(RAIZ, "src/services/paizinhoAuditoria/relatorioService.js"), "utf8");
  assert.match(svc, /escolherIds, continuar, tipo: modo, guardar: false \}\);\r?\n[\s\S]{0,300}const gravacao = guardarSubstituindoComCopia\(rel, armazenamento\(\)\);/);
  assert.match(svc, /chaveDaConta\(`\$\{CHAVE_TESTE_LOCAL\}:anterior`, id\)/);
  assert.equal(RC.CHAVE_LISTA_ANTERIOR, `${RC.CHAVE_TESTE_LOCAL}:anterior`);
  const tela = fs.readFileSync(path.join(RAIZ, "src/components/RelatorioManhaPaizinho.jsx"), "utf8");
  assert.match(tela, /data-paizinho-lista-anterior/);
  assert.match(tela, /voltarParaListaAnterior\(conta\)/);
});
