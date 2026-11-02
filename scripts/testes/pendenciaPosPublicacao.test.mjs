// (02/11/2026) Verificação pós-publicação "havia aplicações aprovadas e nenhum veículo foi vinculado":
// Linha Pesada sem veículos no catálogo do ML não é pendência; Carro/Caminhonete e demais tipos continuam.
//   node --test scripts/testes/pendenciaPosPublicacao.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pendenciaSemVeiculosVinculados as p } from "../../src/services/compatibilidadeML.js";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("caso real (ficha 966635e8): Linha Pesada, 1 aplicação, 0 vinculados → sem pendência", () => {
  assert.equal(p({ aplicacoes: 1, vinculados: 0, tipoVeiculo: "Linha Pesada" }), false);
  assert.equal(p({ aplicacoes: 3, vinculados: 0, tipoVeiculo: "  linha   pesada " }), false);
});
test("Carro/Caminhonete com aplicações e 0 vinculados → pendência CONTINUA", () => {
  assert.equal(p({ aplicacoes: 1, vinculados: 0, tipoVeiculo: "Carro/Caminhonete" }), true);
});
test("tipo vazio, desconhecido ou ausente → pendência CONTINUA", () => {
  assert.equal(p({ aplicacoes: 2, vinculados: 0, tipoVeiculo: "" }), true);
  assert.equal(p({ aplicacoes: 2, vinculados: 0 }), true);
  assert.equal(p({ aplicacoes: 2, vinculados: 0, tipoVeiculo: "Moto" }), true);
});
test("sem aplicações ou com veículos vinculados → esta verificação não se aplica (igual a antes)", () => {
  assert.equal(p({ aplicacoes: 0, vinculados: 0, tipoVeiculo: "Carro/Caminhonete" }), false);
  assert.equal(p({ aplicacoes: 2, vinculados: 2, tipoVeiculo: "Carro/Caminhonete" }), false);
  assert.equal(p({ aplicacoes: 2, vinculados: 1, tipoVeiculo: "Linha Pesada" }), false);
});
test("RevisaoPublicacaoML usa a regra na verificação pós-publicação (texto da pendência preservado)", () => {
  const f = fs.readFileSync(path.join(RAIZ, "src/components/RevisaoPublicacaoML.jsx"), "utf8");
  assert.match(f, /if \(pendenciaSemVeiculosVinculados\(\{ aplicacoes: aplicacoes\.length, vinculados: idsCompat\.length, tipoVeiculo: tipoVeiculoPub\?\.tipoFicha \|\| tipoVeiculoPub\?\.nome \}\)/);
  assert.ok(f.includes('"Compatibilidades: havia aplicações aprovadas e nenhum veículo foi vinculado."'));
  // A verificação de veículos enviados e não aceitos continua igual.
  assert.ok(f.includes("if (idsCompat.length && !resultadoCompat.sucesso && !verificacao.pendencias.some((t) => t.startsWith(\"Compatibilidades\")))"));
});
