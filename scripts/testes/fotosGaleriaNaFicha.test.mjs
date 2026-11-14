// =============================================================
// PAIIA — TESTES (14/11): fotos escolhidas na tela COMPLETA da Galeria
// ("📦 Inserir no anúncio") numa ficha que JÁ EXISTE são gravadas na ficha.
// Antes, o Novo Anúncio reabria "sem edição" e não gravava: as fotos
// apareciam na tela e sumiam ao reabrir a ficha.
//   node --test scripts/testes/fotosGaleriaNaFicha.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("1) Galeria continua avisando a volta com fotos (voltarParaFotosAnuncio)", () => {
  const g = semComentarios(ler("src/components/Galeria.jsx"));
  const i = g.indexOf("function confirmarImagensNoAnuncio");
  assert.ok(i > 0);
  const corpo = g.slice(i, i + 6000);
  assert.ok(corpo.includes("setFotosAnuncio?.("), "entrega as fotos ao Novo Anúncio");
  assert.ok(/"voltarParaFotosAnuncio",\s*"true"/.test(corpo), "marca a volta com fotos");
});

test("2) hook: marcarEdicaoExterna libera a gravação e agenda a gravação", () => {
  const h = semComentarios(ler("src/hooks/useFichaNovoAnuncio.js"));
  const i = h.indexOf("const marcarEdicaoExterna");
  assert.ok(i > 0, "função existe");
  const corpo = h.slice(i, h.indexOf("}, [gravar]);", i));
  assert.ok(corpo.includes("st.editou = true"), "conta como edição do usuário");
  assert.ok(/st\.timer = window\.setTimeout\(\(\) => \{ gravar\(\); \}, ESPERA_MS\)/.test(corpo), "agenda a gravação");
  assert.ok(/return \{[^}]*marcarEdicaoExterna[^}]*\};\s*\}\s*$/.test(h), "exposta pelo hook");
  // A regra antiga continua: abrir/reabrir sem edição NÃO grava.
  assert.ok(h.includes("if (st.id && !st.editou) return undefined;"));
});

test("3) Novo Anúncio: lê a marca ANTES da abertura e chama marcarEdicaoExterna", () => {
  const n = semComentarios(ler("src/components/NovoAnuncio.jsx"));
  const leitura = n.indexOf('getItem("voltarParaFotosAnuncio") === "true"');
  const abertura = n.indexOf("const [abertura] = useState(() => decidirAberturaNovoAnuncio());");
  const apaga = n.indexOf('localStorage.removeItem(\n    "voltarParaFotosAnuncio"');
  assert.ok(leitura > 0 && abertura > 0 && apaga > 0);
  assert.ok(leitura < abertura, "lida antes da abertura");
  assert.ok(leitura < apaga, "lida antes de o efeito apagar a marca");
  assert.ok(/useState\(\(\) => \{\s*try \{ return globalThis\.localStorage\?\.getItem\("voltarParaFotosAnuncio"\) === "true"; \} catch \{ return false; \}\s*\}\)/.test(n));
  assert.ok(/if \(voltouDaGaleriaComFotos\) marcarEdicaoExterna\(\);/.test(n), "grava a ficha que já existia");
  assert.ok(n.indexOf("marcarEdicaoExterna();") > n.indexOf("const fichaNovo = useFichaNovoAnuncio("), "depois do hook");
});
