// =============================================================
// PAIIA Voz — CÓDIGO PRINCIPAL COM UMA SÓ CONFIRMAÇÃO (sem rede, sem banco).
//   node --test scripts/testes/paiiaVozCodigoUmaConfirmacao.test.mjs
// O código principal (SKU) ditado não pede mais a confirmação extra
// "Conferi o código letra por letra" nem o aviso repetido no envio.
// Os códigos ADICIONAIS continuam exigindo "conferido" para entrar na descrição.
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);

const R = await import("../../src/modules/paiiaVoz/servicos/rascunhoRapido.js");
const F = await import("../../src/modules/paiiaVoz/servicos/fichaVoz.js");
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const aplicar = (f, campo, valor) =>
  F.aplicarInterpretacao(f, { itens: [{ campo, valor, soletrado: true }], naoEntendido: [], avisos: [] }, { origem: "voz" }).ficha;

const fichaDitada = () => {
  let f = F.criarFichaVoz({ id: "uma-conf", agora: 1 });
  f = aplicar(f, "codigoPrincipal", "IWP065");
  f = aplicar(f, "codigoAdicional", "7703101596");
  return f;
};

test("tela 7 etapas: sem a confirmação duplicada “Conferi o código letra por letra”", () => {
  const tela = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.ok(!tela.includes("Conferi o código letra por letra"), "confirmação duplicada do código principal removida");
  assert.ok(!/cp\s*&&\s*cp\.conferido\s*===\s*false/.test(tela), "nenhum checkbox extra para o código principal");
});

test("tela 7 etapas: códigos adicionais mantêm o “conferido”", () => {
  const tela = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.ok(tela.includes("data-pv-conferir-codigo /> conferido"), "checkbox de conferência dos adicionais mantido");
  assert.ok(tela.includes("Só os conferidos entram na descrição."));
});

test("envio: código principal ditado não gera o aviso repetido de conferência", () => {
  const f = fichaDitada();
  assert.equal(F.codigoPrincipal(f).codigo, "IWP065");
  const v = R.validarRapido(f, { fotos: 1 });
  assert.ok(!v.avisos.some((a) => a.includes("IWP065")), `sem aviso para o principal: ${v.avisos.join(" | ")}`);
});

test("envio: código adicional ditado e não conferido continua avisado e fora da descrição", () => {
  let f = fichaDitada();
  const adicional = F.codigosAdicionais(f)[0];
  assert.equal(adicional.conferido, false);
  assert.ok(R.validarRapido(f, { fotos: 1 }).avisos.includes("Confira o código 7703101596 letra por letra (foi ditado)."));
  assert.deepEqual(F.codigosParaDescricao(f), ["IWP065"], "adicional não conferido fica fora");

  f = F.conferirCodigo(f, adicional.normalizado, true);
  assert.ok(!R.validarRapido(f, { fotos: 1 }).avisos.some((a) => a.includes("7703101596")));
  assert.deepEqual(F.codigosParaDescricao(f), ["IWP065", "7703101596"], "adicional conferido entra");
});
