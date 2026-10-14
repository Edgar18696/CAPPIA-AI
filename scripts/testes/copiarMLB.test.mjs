// "📋 Copiar MLB para o Bling" (13/10/2026): só copia o MLB real, limpo.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const { normalizarMLB, copiarTexto, TEXTO_BOTAO_COPIAR_MLB, TEXTO_MLB_COPIADO } = await import("../../src/services/copiarMLB.js");

test("MLB limpo no formato do Bling (sem dois-pontos, espaços ou prefixo duplicado)", () => {
  for (const v of ["MLB5385650401", "mlb5385650401", "MLB 5385650401", "MLB: 5385650401", " MLB-5385650401 ", "MLBMLB5385650401", "MLB:MLB5385650401", "MLB.5385650401"]) {
    assert.equal(normalizarMLB(v), "MLB5385650401", v);
  }
});

test("não inventa MLB: vazio, número solto, MLBU (produto do vendedor) e texto qualquer = nada", () => {
  for (const v of [null, undefined, "", "MLB", "5385650401", "MLBU1438217384", "MLB12", "ABC123456", "MLB53856X0401", "—"]) {
    assert.equal(normalizarMLB(v), "", String(v));
  }
});

test("textos do botão e da confirmação", () => {
  assert.equal(TEXTO_BOTAO_COPIAR_MLB, "📋 Copiar MLB para o Bling");
  assert.equal(TEXTO_MLB_COPIADO, "✓ MLB copiado! Agora cole no Bling");
});

test("copia pela área de transferência do navegador", async () => {
  const copiados = [];
  const amb = { isSecureContext: true, navigator: { clipboard: { writeText: async (t) => { copiados.push(t); } } } };
  assert.equal(await copiarTexto("MLB5385650401", amb), true);
  assert.deepEqual(copiados, ["MLB5385650401"]);
});

test("sem área de transferência (celular/navegador antigo): usa o método clássico e limpa o campo temporário", async () => {
  const filhos = [];
  const doc = {
    body: { appendChild: (e) => filhos.push(e), removeChild: (e) => filhos.splice(filhos.indexOf(e), 1) },
    createElement: () => ({ style: {}, setAttribute() {}, focus() {}, select() {}, setSelectionRange() {}, value: "" }),
    execCommand: (cmd) => cmd === "copy" && filhos.length === 1 && filhos[0].value === "MLB5385650401",
  };
  const amb = { isSecureContext: true, navigator: { clipboard: { writeText: async () => { throw new Error("NotAllowedError"); } } }, document: doc };
  assert.equal(await copiarTexto("MLB5385650401", amb), true);
  assert.equal(filhos.length, 0, "campo temporário removido");
});

test("se nada funcionar, informa falha (não finge que copiou)", async () => {
  assert.equal(await copiarTexto("MLB5385650401", { navigator: {}, document: null }), false);
  assert.equal(await copiarTexto("", { navigator: { clipboard: { writeText: async () => {} } } }), false);
});

test("o botão é só de cópia: não grava, não chama integração nem o Bling", () => {
  const raiz = new URL("../../", import.meta.url);
  for (const f of ["src/components/BotaoCopiarMLB.jsx", "src/services/copiarMLB.js"]) {
    const t = fs.readFileSync(new URL(f, raiz), "utf8");
    assert.doesNotMatch(t, /supabase|functions\.invoke|fetch\(|bling-integracao|upsert|insert\(|update\(/, f);
  }
  // Presente nas 3 telas: fluxo concluído/vínculo manual, ficha publicada e Central.
  for (const f of ["src/components/PainelIntegracaoBling.jsx", "src/components/FichaPublicadaPAIIA.jsx", "src/components/PainelFichasCentral.jsx"]) {
    assert.match(fs.readFileSync(new URL(f, raiz), "utf8"), /<BotaoCopiarMLB mlb=\{/, f);
  }
});
