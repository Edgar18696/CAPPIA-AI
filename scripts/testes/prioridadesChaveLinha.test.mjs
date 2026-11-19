// =============================================================
// PAIIA — TESTES (19/11/2026): identificação única de cada LINHA da lista de prioridades.
// Causa: o mesmo anúncio pode ter 2 problemas do mesmo assunto (MLB4: "Título curto" e
// "código fora do título", ambos em "conteudo"); a chave do React era só anúncio + assunto.
// Correção: anúncio + assunto + posição na lista original. Nada some, nada se mistura,
// a ordem é a mesma.
//   node --test scripts/testes/prioridadesChaveLinha.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { executarAuditoria } = await import("../../src/services/paizinhoAuditoria/index.js");
const { chaveAchado } = await import("../../src/services/paizinhoAuditoria/prioridadesAcoes.js");
const { CONTA, AGORA, mlFalso, blingFalso } = await import("./apoio/paizinhoAuditoriaFalso.mjs");

// Mesma regra da tela (PrioridadesPaizinho.jsx).
const chavesDasLinhas = (itens) => itens.map((a, i) => `${chaveAchado(a)}#${i}`);

test("caso real do console: MLB4 tem 2 problemas de 'conteudo' — antes a chave repetia, agora é única", async () => {
  const rel = await executarAuditoria({ conta: CONTA, consultar: mlFalso().consultar, consultarBling: blingFalso, agora: AGORA });
  const lista = rel.prioridades;
  const antigas = lista.map(chaveAchado);
  assert.ok(antigas.filter((k) => k === "MLB4|conteudo").length >= 2, "a causa existe: chave antiga repetida");
  const novas = chavesDasLinhas(lista);
  assert.equal(new Set(novas).size, lista.length, "uma chave por linha: nenhuma linha some ou é reaproveitada");
  assert.equal(novas.length, lista.length, "mesma quantidade de linhas");
  // ordem e conteúdo intactos: cada chave aponta para a mesma posição e o mesmo problema
  novas.forEach((k, i) => assert.ok(k.startsWith(`${chaveAchado(lista[i])}#`)));
  const doMlb4 = lista.filter((a) => a.item_id === "MLB4" && a.area === "conteudo").map((a) => a.problema);
  assert.equal(new Set(doMlb4).size, doMlb4.length, "os 2 problemas do MLB4 continuam diferentes e os dois aparecem");
});

test("a tela usa a chave da linha para o React e para a confirmação do Remover; ações continuam por anúncio + assunto", () => {
  const tela = fs.readFileSync(path.join(RAIZ, "src/components/PrioridadesPaizinho.jsx"), "utf8");
  assert.match(tela, /const chaveLinha = new Map\(itens\.map\(\(a, i\) => \[a, `\$\{chaveAchado\(a\)\}#\$\{i\}`\]\)\);/);
  assert.match(tela, /key=\{chaveLinha\.get\(a\)\}/);
  assert.match(tela, /confirmandoRemocao=\{removendo === chaveLinha\.get\(a\)\}/);
  assert.match(tela, /setRemovendo\(chaveLinha\.get\(a\)\)/);
  assert.doesNotMatch(tela, /key=\{chaveAchado\(a\)\}/, "chave antiga não é mais usada nas linhas");
  // filtro e ações inalterados
  assert.match(tela, /const visiveis = itens\.filter\(\(a\) => !FORA\.has\(statusPendencia\(estado, a\)\)\);/);
  assert.match(tela, /aoResolver=\{\(\) => agir\("resolvido", a\)\}/);
  assert.match(tela, /aoRemover=\{\(motivo\) => agir\("removido", a, motivo\)\}/);
});
