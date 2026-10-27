// =============================================================
// PAIIA — TESTES do Arquivo 4: src/components/PainelFichasCentral.jsx
// (botão Excluir definitivo na Central). Conferência do código-fonte:
// o comportamento na tela foi testado à parte no navegador (simulação).
//   node --test scripts/testes/painelExcluirFicha.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const painel = fs.readFileSync(path.join(RAIZ, "src/components/PainelFichasCentral.jsx"), "utf8").replace(/\r\n/g, "\n");
let original = "";
try {
  original = execFileSync("git", ["show", "305f37d:src/components/PainelFichasCentral.jsx"], { cwd: RAIZ, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).replace(/\r\n/g, "\n");
} catch {
  original = ""; // sem Git (pasta sem histórico): os testes de preservação usam só a versão atual
}

test("1) uma única confirmação, com o texto de exclusão DEFINITIVA", () => {
  assert.equal((painel.match(/window\.confirm\(/g) || []).length, 1);
  assert.ok(painel.includes("window.confirm(`${TEXTO_CONFIRMAR_EXCLUSAO}"));
  assert.ok(!/window\.prompt\(|<form|<input/.test(painel), "sem formulário nem perguntas extras");
});

test("2) a exclusão só é chamada DEPOIS da confirmação e uma de cada vez", () => {
  const f = painel.slice(painel.indexOf("async function excluir(f)"), painel.indexOf("return (\n    <section"));
  const iConf = f.indexOf("window.confirm(");
  const iSair = f.indexOf("if (!ok) return;");
  const iChamar = f.indexOf("excluirFichaDefinitivamente(f.id)");
  assert.ok(iConf > 0 && iSair > iConf && iChamar > iSair, "confirmar → sair se cancelar → excluir");
  const iTrava = f.indexOf("if (excluindo) return;");
  assert.ok(iTrava >= 0 && iTrava < iConf, "não dispara duas exclusões");
  assert.ok(painel.includes("disabled={Boolean(excluindo)}"), "botões desativados durante a exclusão");
  assert.equal((painel.match(/excluirFichaDefinitivamente\(/g) || []).length, 1);
});

test("3) o botão só existe para ficha elegível; as outras mostram 🔒 Protegida com o motivo", () => {
  const bloco = painel.slice(painel.indexOf("const pv = previaExclusao(f.id);"), painel.indexOf("})()}"));
  assert.ok(/return pv\.pode \? \(\s*<button[^>]*data-paiia-excluir-ficha/.test(bloco));
  assert.ok(bloco.includes("data-paiia-ficha-protegida") && bloco.includes("title={pv.motivo"));
  assert.ok(painel.includes("return f ? avaliarExclusao(f) : { pode: false"), "ficha não carregada: sem botão");
});

test("4) o painel não apaga, não grava e não fala com o banco diretamente", () => {
  assert.equal(/removeItem|cancelarFichaSemConta|\.delete\(|\.update\(|\.insert\(|\.rpc\(|from\s+["']\.\.\/supabase["']/.test(painel), false);
});

test("5) depois de apagar: descarta só o rascunho local DAQUELA ficha e recarrega a lista", () => {
  const f = painel.slice(painel.indexOf("async function excluir(f)"));
  assert.ok(f.indexOf("if (r.apagada)") < f.indexOf("descartarRascunhoLocalDaFicha(localStorage, f.id"));
  assert.ok(painel.includes("setVersao((v) => v + 1);") && painel.includes("}, [versao]);"));
});

test("6) os botões e informações que já existiam continuam iguais", () => {
  for (const trecho of [
    "data-paiia-abrir-ficha={f.id} onClick={() => abrirFicha(f.id)}",
    "data-paiia-retomar-local onClick={retomarLocal}",
    "<BotaoCopiarMLB mlb={f.mlb} compacto />",
    '"👁 Ver ficha publicada"', '"🔗 Concluir Bling desta ficha"', '"✏️ Continuar no Novo Anúncio"', '"📝 Continuar Conferência"', '"🧩 Ver canais escolhidos"', '"▶ Continuar"',
    "data-paiia-codigo-ja-publicado", "Mostrar todas (", "retomarAnuncioGuardado(localStorage)",
  ]) {
    assert.ok(painel.includes(trecho), `preservado: ${trecho}`);
    if (original) assert.ok(original.includes(trecho), `existia antes: ${trecho}`);
  }
  if (original) {
    const abrirAntes = original.slice(original.indexOf("function abrirFicha(id)"), original.indexOf("function retomarLocal()"));
    const abrirDepois = painel.slice(painel.indexOf("function abrirFicha(id)"), painel.indexOf("function retomarLocal()"));
    assert.equal(abrirDepois, abrirAntes, "Abrir ficha: sem mudança");
    const retAntes = original.slice(original.indexOf("function retomarLocal()"), original.indexOf("const mostrarLocal"));
    const retDepois = painel.slice(painel.indexOf("function retomarLocal()"), painel.indexOf("const mostrarLocal"));
    assert.equal(retDepois, retAntes, "Retomar: sem mudança");
  }
});
