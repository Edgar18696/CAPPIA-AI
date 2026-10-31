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

// (31/10/2026) Regras novas aprovadas: "🗑 Excluir" em TODAS as fichas. Sem vínculos =
// exclusão definitiva segura (a de sempre); com MLB/publicação/Bling/protegida = só
// ARQUIVA (tabela paiia_fichas_arquivadas). Rascunho "Em andamento" (só no navegador)
// também tem Excluir. Bling e Mercado Livre nunca são chamados pelo painel.

test("1) toda ação pede confirmação explícita; sem formulário nem perguntas extras", () => {
  assert.equal((painel.match(/window\.confirm\(/g) || []).length, 3, "excluir definitivo, arquivar e rascunho local");
  assert.ok(painel.includes("window.confirm(`${TEXTO_CONFIRMAR_EXCLUSAO}"));
  assert.ok(painel.includes("window.confirm(`Excluir esta ficha da Central?"));
  assert.ok(painel.includes("window.confirm(`Excluir este rascunho?"));
  assert.ok(!/window\.prompt\(|<form|<input/.test(painel), "sem formulário nem perguntas extras");
});

test("2) a exclusão definitiva só é chamada DEPOIS da confirmação e uma de cada vez", () => {
  const f = painel.slice(painel.indexOf("async function excluir(f)"), painel.indexOf("async function arquivar(f)"));
  const iTrava = f.indexOf("if (excluindo || arquivando) return;");
  const iConf = f.indexOf("window.confirm(`${TEXTO_CONFIRMAR_EXCLUSAO}");
  const iSair = f.indexOf("if (!ok) return;");
  const iChamar = f.indexOf("excluirFichaDefinitivamente(f.id)");
  assert.ok(iTrava >= 0 && iTrava < iConf, "não dispara duas ações");
  assert.ok(iConf > 0 && iSair > iConf && iChamar > iSair, "confirmar → sair se cancelar → excluir");
  assert.ok(painel.includes("disabled={Boolean(excluindo || arquivando)}"), "botões desativados durante a ação");
  assert.equal((painel.match(/excluirFichaDefinitivamente\(/g) || []).length, 1);
});

test("3) todas as fichas têm Excluir; ficha não elegível ou protegida pelo banco só é ARQUIVADA", () => {
  const bloco = painel.slice(painel.indexOf("{fichas.map((f) => ("), painel.indexOf("{estado.fichas.length > 12"));
  assert.ok(/<button[^>]*data-paiia-excluir-ficha=\{f\.id\}/.test(bloco), "botão em toda ficha");
  assert.ok(!bloco.includes("data-paiia-ficha-protegida"), "sem 🔒 Protegida");
  const f = painel.slice(painel.indexOf("async function excluir(f)"), painel.indexOf("async function arquivar(f)"));
  assert.ok(/if \(!previaExclusao\(f\.id\)\.pode\) \{[\s\S]*?if \(okArq\) await arquivar\(f\);[\s\S]*?return;/.test(f), "não elegível: confirma e só arquiva");
  assert.ok(/else if \(r\.protegida\) \{[\s\S]*?await arquivar\(f\);/.test(f), "protegida pelo banco: só arquiva");
  assert.ok(painel.includes("return f ? avaliarExclusao(f) : { pode: false"), "ficha não carregada: só arquiva");
});

test("4) o painel não apaga nem altera nada no banco; só grava o arquivamento da própria ficha", () => {
  assert.equal(/cancelarFichaSemConta|\.delete\(|\.update\(|\.upsert\(|\.rpc\(/.test(painel), false);
  assert.equal((painel.match(/\.insert\(/g) || []).length, 1);
  assert.ok(/\.from\("paiia_fichas_arquivadas"\)\s*\.insert\(\{ anuncio_id: f\.id, usuario_id: usuarioId,/.test(painel), "insert só no arquivo, com o usuário logado");
  assert.equal((painel.match(/\.from\(/g) || []).length, 1, "nenhuma outra tabela");
  assert.equal(/functions\.invoke|fetch\(/.test(painel), false, "não chama funções externas");
  const imports = painel.split("\n").filter((l) => /from ["']/.test(l)).join("\n");
  assert.equal(/bling|mercadolivre|publicacao/i.test(imports), false, "não importa serviços do Bling nem do Mercado Livre");
});

test("5) depois de apagar: descarta só o rascunho local DAQUELA ficha e recarrega a lista", () => {
  const f = painel.slice(painel.indexOf("async function excluir(f)"));
  assert.ok(f.indexOf("if (r.apagada)") < f.indexOf("descartarRascunhoLocalDaFicha(localStorage, f.id"));
  assert.ok(painel.includes("setVersao((v) => v + 1);") && painel.includes("}, [versao]);"));
});

test("5b) rascunho Em andamento: Excluir só apaga do navegador, depois da confirmação; Retomar continua", () => {
  const f = painel.slice(painel.indexOf("function excluirLocal()"), painel.indexOf("function abrirFicha(id)"));
  assert.ok(f.indexOf("if (!ok) return;") > f.indexOf("window.confirm(") && f.indexOf("removeItem") > f.indexOf("if (!ok) return;"));
  assert.equal((painel.match(/removeItem/g) || []).length, 1, "removeItem só no Excluir do rascunho");
  assert.ok(f.includes("localStorage.removeItem(CHAVE_ANUNCIO_EM_ANDAMENTO)"));
  assert.ok(painel.includes("data-paiia-excluir-local onClick={excluirLocal}"));
  assert.ok(painel.includes("data-paiia-retomar-local onClick={retomarLocal}"));
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
