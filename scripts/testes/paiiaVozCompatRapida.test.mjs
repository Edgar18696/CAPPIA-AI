// Etapa 1 (simplificação): compatibilidade só com Montadora, Modelo e Ano; motor interno ou perguntado
// com as opções do catálogo do Mercado Livre — nada presumido.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { resolverCompatibilidades } from "../../src/services/compatibilidadeML.js";

const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const prod = (id, ano, motor, trim) => ({ id, attributes: [{ id: "BRAND", value_name: "Fiat" }, { id: "MODEL", value_name: "Uno" }, { id: "TRIM", value_name: trim }, { id: "ENGINE", value_name: motor }, { id: "VEHICLE_YEAR", value_name: String(ano) }] });
const catalogo = (produtos) => async (caminho) => {
  if (/BRAND\/top_values/.test(caminho)) return { ok: true, dados: [{ id: 9, name: "Fiat" }] };
  if (/MODEL\/top_values/.test(caminho)) return { ok: true, dados: [{ id: 62, name: "Uno" }] };
  if (/products_search\/chunks\?offset=0/.test(caminho)) return { ok: true, dados: { total: produtos.length, results: produtos } };
  return { ok: true, dados: { total: 0, results: [] } };
};
const P = [prod("MLB1001", 2011, "1.0", "1.0 Vivace"), prod("MLB1002", 2013, "1.4", "1.4 Attractive"), prod("MLB1003", 2016, "1.3", "1.3 Drive")];

test("1) sem motor: NENHUM veículo é aceito e vem UMA pergunta com os motores do catálogo no período", async () => {
  const r = await resolverCompatibilidades([{ montadora: "Fiat", modelo: "Uno", motor: "", anoInicio: 2010, anoFim: 2014 }], catalogo(P));
  assert.equal(r.veiculos.length, 0, "não presume que todas as versões servem");
  assert.deepEqual(r.perguntasMotor.map((x) => x.opcoes), [["1.0", "1.4"]], "só os motores do período 2010–2014 (o 1.3 de 2016 fica fora)");
});

test("2) com o motor (da descrição ou da resposta): só os veículos desse motor", async () => {
  const r = await resolverCompatibilidades([{ montadora: "Fiat", modelo: "Uno", motor: "1.0", anoInicio: 2010, anoFim: 2014 }], catalogo(P));
  assert.deepEqual(r.veiculos.map((v) => v.id), ["MLB1001"]);
  assert.equal(r.perguntasMotor.length, 0);
});

test("3) conferência: falta de motor vira pergunta (não 'catálogo errado') e chega à revisão com as opções", () => {
  const c = ler("src/modules/paiiaVoz/servicos/preparoConferenciaVoz.js");
  assert.ok(c.includes("qual é o motor do") && c.includes("perguntaMotor: pm"));
  assert.ok(ler("src/modules/paiiaVoz/servicos/revisaoCelularVoz.js").includes('k === "compatibilidade" && x.perguntaMotor'));
});

test("4) tela: Montadora, Modelo, Motor (opcional) e Anos (12/11); aplicação completa recolhida; motor perguntado com botões do catálogo", () => {
  const t = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  for (const c of ["data-pv-veic={k}", '["anoInicio", "Ano inicial (ou único)"', '["motor", "Motor (opcional', "data-pv-veic-adicionar"]) assert.ok(t.includes(c), c);
  assert.ok(t.includes("<details open={campoVoz === \"aplicacoes\" || undefined} data-pv-aplicacao-completa>"), "fala/texto completo continua disponível");
  const add = t.slice(t.indexOf("function adicionarVeiculoRapido()"), t.indexOf("// Resposta à pergunta do motor"));
  assert.ok(t.includes("achados.length === 1 ? achados[0]") && add.includes("v.motor.trim() || motorDaFicha(f)"), "motor informado; senão só quando há UM na descrição");
  assert.ok(add.includes("confirmada: true") && add.includes('origem: "usuario"'));
  const f = ler("src/modules/paiiaVoz/FinalizarAnuncioVoz.jsx");
  assert.ok(f.includes("x.perguntaMotor.opcoes.map") && f.includes("data-pv-motor-nenhum"), "opções do catálogo + 'nenhuma destas' (nunca 'todas')");
});

test("5) só os anos/versões CONFIRMADOS pelo catálogo são mostrados como validados (intervalo nunca vale inteiro)", async () => {
  const r = await resolverCompatibilidades([{ montadora: "Fiat", modelo: "Uno", motor: "1.0", anoInicio: 2010, anoFim: 2014 }], catalogo(P));
  assert.deepEqual(r.veiculos.map((v) => v.nome), ["Fiat Uno 1.0 Vivace 2011"], "de 2010–2014, o catálogo confirmou só 2011 (1.0)");
  const c = ler("src/modules/paiiaVoz/servicos/preparoConferenciaVoz.js");
  assert.ok(c.includes("validados: r.veiculos.map") && c.includes("veículo(s) confirmados pelo catálogo do Mercado Livre — ${resumo}"));
});

test("6) Finalizar: categoria selecionada + 'Alterar categoria'; Clássico padrão com troca opcional (sem pergunta)", () => {
  const f = ler("src/modules/paiiaVoz/FinalizarAnuncioVoz.jsx");
  assert.ok(f.includes("data-pv-categoria-selecionada") && f.includes("data-pv-alterar-categoria") && f.includes("data-pv-trocar-premium"));
  assert.ok(!ler("src/modules/paiiaVoz/servicos/revisaoCelularVoz.js").includes('id: "modalidade", tipo: "pergunta"'));
});
