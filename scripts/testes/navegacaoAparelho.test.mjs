// =============================================================
// PAIIA — TESTES: navegação computador x celular (24/11/2026). Só interface.
//   node --test scripts/testes/navegacaoAparelho.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const A = await import("../../src/config/aparelhoPaiia.js");
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const toque = (sim) => (q) => ({ matches: q === "(pointer: coarse)" ? sim : false });

test("aparelho: toque = celular; mouse = computador; sem matchMedia = computador", () => {
  assert.equal(A.ehCelular(toque(true)), true);
  assert.equal(A.ehCelular(toque(false)), false);
  assert.equal(A.ehCelular(undefined), false);
  assert.equal(A.ehCelular(() => { throw new Error("x"); }), false);
});

test("Home: PAIIA Voz só no celular; Criar Anúncio e os demais nos dois", () => {
  assert.equal(A.cartaoVisivelNoAparelho("paiiaVoz", false), false);
  assert.equal(A.cartaoVisivelNoAparelho("paiiaVoz", true), true);
  for (const t of ["novoAnuncio", "centralPaizinho", "catalogos", "foto"]) {
    assert.equal(A.cartaoVisivelNoAparelho(t, false), true);
    assert.equal(A.cartaoVisivelNoAparelho(t, true), true);
  }
  const h = ler("src/components/Home.jsx");
  assert.match(h, /cartaoVisivelNaHome\(card\.tela\) && cartaoVisivelNoAparelho\(card\.tela, ehCelular\(\)\)/);
  assert.match(h, /titulo: "PAIIA Voz"/, "o cartão continua no código (só oculto no computador)");
});

test("Criar Próximo Anúncio: celular → PAIIA Voz; computador → Criar Anúncio com ficha limpa", () => {
  assert.equal(A.telaDoProximoAnuncio(true), "paiiaVoz");
  assert.equal(A.telaDoProximoAnuncio(false), "novoAnuncio");
  const ml = ler("src/components/MercadoLivreTeste.jsx");
  assert.match(ml, /if \(telaDoProximoAnuncio\(ehCelular\(\)\) === "paiiaVoz"\) \{[\s\S]{0,200}setScreen\?\.\("paiiaVoz"\);\s*return;\s*\}\s*iniciarAnuncioNovo\(\);[\s\S]{0,160}setScreen\?\.\("novoAnuncio"\);/);
});

test("finalização: dois botões — Criar Próximo Anúncio e Voltar para o Início", () => {
  const p = ler("src/components/PilotoAutomaticoPublicacao.jsx");
  assert.ok(p.includes("＋ Criar Próximo Anúncio"));
  assert.ok(p.includes("data-paiia-voltar-inicio") && p.includes("🏠 Voltar para o Início"));
  assert.ok(!p.includes(">Fechar<"));
  assert.match(p, /if \(proximo\) onProximo\?\.\(\);\s*else onInicio\?\.\(\);/);
  const ml = ler("src/components/MercadoLivreTeste.jsx");
  assert.match(ml, /onInicio=\{\(\) => \{[\s\S]{0,400}setScreen\?\.\("home"\);/);
});

test("PAIIA Voz continua inteiro (tela, rota e botões próprios do celular)", () => {
  const app = ler("src/App.jsx");
  assert.ok(app.includes('screen === "paiiaVoz"') && app.includes("<PaiiaVoz"));
  assert.ok(ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx").includes("data-pv-salvar-proximo"));
});
