// Etapa 1 — botões Excluir antigos (Meus Anúncios / Meus Rascunhos).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const central = ler("src/components/CentralInteligencia.jsx");
const meusAnuncios = ler("src/components/MeusAnuncios.jsx");
const meusRascunhos = ler("src/components/MeusRascunhos.jsx");
const app = ler("src/App.jsx");

test("1) botão 'Meus Anúncios' do Dashboard leva à Central de Publicação", () => {
  assert.match(central, /\["📋", "Meus Anúncios", "centralPublicacao"\]/);
  assert.doesNotMatch(central, /"meusAnuncios"/);
});

test("2) telas antigas sem Excluir e sem apagar registros", () => {
  for (const [nome, s] of [["MeusAnuncios", meusAnuncios], ["MeusRascunhos", meusRascunhos]]) {
    assert.doesNotMatch(s, /\.delete\(/, `${nome}: nada é apagado`);
    assert.doesNotMatch(s, /🗑/, `${nome}: sem botão Excluir`);
  }
});

test("3) o resto das telas antigas continua (listagem, editar/continuar, duplicar)", () => {
  assert.ok(meusAnuncios.includes('.from("anuncios")') && meusAnuncios.includes("📄 Duplicar"));
  assert.ok(meusRascunhos.includes("✏️ Continuar") && meusRascunhos.includes("📄 Duplicar") && meusRascunhos.includes('.from("rascunhos_anuncios")'));
  assert.ok(app.includes('screen === "meusAnuncios"') && app.includes('screen === "meusRascunhos"'), "as telas continuam existindo");
});

test("4) o Excluir protegido da Central de Publicação continua intacto", () => {
  const svc = ler("src/services/exclusaoFicha.js");
  assert.ok(svc.includes("paiia_excluir_ficha_definitivo"));
});
