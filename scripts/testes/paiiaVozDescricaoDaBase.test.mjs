// (15/11) Descrição montada pela base, sem inventar; confirmados separados de sugestões.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { montarDescricaoDaBase } from "../../src/modules/paiiaVoz/servicos/consultaBaseVoz.js";
const ap = (montadora, modelo, motor, i, f) => ({ montadora, modelos: [modelo], motores: [motor], anoInicio: i, anoFim: f });

test("1) Base validada (confirmada): texto da peça + aplicações + códigos de referência, exatamente como na base", () => {
  const d = montarDescricaoDaBase({ encontrado: true, origem: "base_validada", descricao: "bico injetor ka flex 1.0", aplicacoes: [ap("Ford", "Ka", "1.0 8V Flex", 2008, 2013)], codigos: ["0280158169"] });
  assert.equal(d, "Bico injetor ka flex 1.0\nAplicação: Ford Ka 1.0 8V Flex 2008 a 2013.\nCódigos de referência: 0280158169.");
});

test("2) Catálogo (não verificado): só o texto da peça; aplicações e códigos ficam 'a conferir', fora do texto", () => {
  const d = montarDescricaoDaBase({ encontrado: true, origem: "catalogo", descricao: "Bico Injetor Ka Flex 1.0", aplicacoes: [ap("Ford", "Ka", "1.0", 2008, 2013)], codigos: ["X1"] });
  assert.equal(d, "Bico Injetor Ka Flex 1.0");
  assert.equal(montarDescricaoDaBase({ encontrado: false }), "");
});

test("3) só preenche a descrição VAZIA (nunca sobrescreve o que você ditou ou corrigiu)", () => {
  const t = fs.readFileSync(new URL("../../src/modules/paiiaVoz/PaiiaVozRapido.jsx", import.meta.url), "utf8");
  assert.equal((t.match(/if \(descBase && !String\(estadoRapido\(f\)\.descricao\?\.texto \|\| ""\)\.trim\(\)\) f = definirTextoDescricao\(f, descBase\);/g) || []).length, 2);
});
