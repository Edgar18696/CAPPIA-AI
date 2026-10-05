// =============================================================
// PAIIA — TESTES: Conferência (compatibilidades em 2 tipos, dados técnicos,
// Inteligência de Busca sem contaminação e Tipo de veículo pela categoria)
//   node --test scripts/testes/conferenciaCompatibilidadeBusca.test.mjs
// Sem rede. Fixtures reais lidas em 05/10/2026 (produto 7703101596 e
// atributos VEHICLE_TYPE das categorias do Mercado Livre).
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import {
  separarModelos, juntarModelos, separarAplicacoesLegadas, extrairDadosDescricao,
  termosConfirmados, gerarIntencoesBusca, separarSugestoesConcorrentes, termosDaFuncao, separarAplicacoesBase,
} from "../../src/services/inteligenciaBusca.js";
import { lerAplicacoesAprovadas, resolverCompatibilidades, tipoVeiculoDaCategoria, tipoVeiculoParaFicha, separarAplicacoesParaML, montarDescricaoPadrao } from "../../src/services/compatibilidadeML.js";

// Produto real em andamento (dados que estavam no navegador, produção).
const DESCRICAO = "Parafuso Aço Suporte Transmissão Motor Original (M12x1,75-35)\nRenault Duster,Logan,Sandero,Kangoo,Megane,Grand Scenic \nCodigo:- 7703101596";
const LEGADO = [
  { montadora: "Renault", modelo: "Logan,Sandero,Duster,Kangoo,Laguna,Grand Scenic,Megane", motor: "", anoInicio: "", anoFim: "", versao: "", origem: "manual" },
  { montadora: "Renault", modelo: "Logna", motor: "1.6 16v", anoInicio: "2001", anoFim: "2013", versao: "", origem: "manual" },
];
const CONCORRENTES = ["kit", "zincado", "francês", "gancho", "porca", "jomarca", "estribo", "bucha", "Titan"];

test("C/D) vários modelos sem ano/motor, de uma vez, estruturados por montadora", () => {
  const nomes = separarModelos("Logan, Sandero, Duster, Kangoo, Laguna, Grand Scenic, Megane");
  assert.deepEqual(nomes, ["Logan", "Sandero", "Duster", "Kangoo", "Laguna", "Grand Scenic", "Megane"]);
  const modelos = juntarModelos(nomes.map((modelo) => ({ montadora: "Renault", modelo })), [{ montadora: "renault", modelo: "LOGAN" }]);
  assert.equal(modelos.length, 7, "sem duplicar (acento/caixa)");
  assert.ok(modelos.every((m) => Object.keys(m).join() === "montadora,modelo"), "nenhum ano/motor/versão inventado");
});

test("linha antiga com vários modelos vira modelos sem detalhes; aplicação detalhada fica", () => {
  const r = separarAplicacoesLegadas(LEGADO);
  assert.equal(r.convertidas, 1);
  assert.equal(r.modelos.length, 7);
  assert.equal(r.detalhadas.length, 1);
  assert.equal(r.detalhadas[0].anoInicio, "2001", "dado digitado pelo usuário não é apagado");
});

test("descrição → DADOS: medida, código (não palavras soltas)", () => {
  const d = extrairDadosDescricao(DESCRICAO);
  assert.deepEqual(d.medidas, ["M12 × 1,75 × 35"]);
  assert.deepEqual(d.codigos, ["7703101596"]);
  assert.deepEqual(d.funcoes, [], "sem rótulo, a descrição não vira função");
  assert.deepEqual(extrairDadosDescricao("Função: Suporte do conjunto de transmissão e motor").funcoes, ["Suporte do conjunto de transmissão e motor"]);
});

const DADOS_7703 = {
  codigos: ["7703101596"],
  nomePeca: "Parafuso de Aço",
  termoComercial: "Parafuso suporte motor",
  funcao: "Suporte do conjunto de transmissão e motor",
  medida: "M12 × 1,75 × 35",
  aplicacoes: [{ montadora: "Renault", modelo: "Logan", motor: "1.6 16V", anoInicio: "2012", anoFim: "2012" }],
  modelos: separarAplicacoesLegadas(LEGADO).modelos,
};

test("N) 7703101596: buscas por código E por intenção sem código", () => {
  const b = gerarIntencoesBusca(DADOS_7703).map((x) => x.texto);
  for (const esperado of [
    "7703101596",
    "Parafuso suporte motor Logan",
    "Parafuso suporte motor Logan 2012",
    "Parafuso suporte motor Laguna",
    "Parafuso suporte motor Megane",
    "Parafuso suporte motor Renault M12 1,75",
  ]) assert.ok(b.includes(esperado), `falta: ${esperado}`);
  assert.ok(b.every((t) => t.length <= 80), "frases curtas, não uma frase gigante");
  assert.ok(!b.some((t) => /2026|2001/.test(t)), "nenhum ano inventado");
});

test("M) sem contaminação: termos de concorrentes NÃO entram nos confirmados nem nas buscas", () => {
  const conf = termosConfirmados(DADOS_7703).map((t) => t.termo.toLowerCase());
  const busca = gerarIntencoesBusca(DADOS_7703).map((x) => x.texto.toLowerCase()).join(" | ");
  for (const c of CONCORRENTES) {
    assert.ok(!conf.includes(c.toLowerCase()), `confirmado contaminado: ${c}`);
    assert.ok(!new RegExp(`\\b${c.toLowerCase()}\\b`).test(busca), `busca contaminada: ${c}`);
  }
  const sug = separarSugestoesConcorrentes([...CONCORRENTES, "parafuso", "Logan"], termosConfirmados(DADOS_7703));
  assert.ok(sug.every((s) => s.confirmado === false && s.origem === "concorrencia"));
  assert.ok(!sug.some((s) => ["parafuso", "logan"].includes(s.termo.toLowerCase())), "o que já é confirmado não reaparece como sugestão");
});

test("A) produto só com código", () => {
  const b = gerarIntencoesBusca({ codigos: ["7703101596"] });
  assert.deepEqual(b.map((x) => x.texto), ["7703101596"]);
});

test("B) sem código, com peça + veículo", () => {
  const b = gerarIntencoesBusca({ nomePeca: "Sensor de fase", aplicacoes: [{ montadora: "Fiat", modelo: "Palio", motor: "1.6 16V", anoInicio: "2012", anoFim: "2016" }] }).map((x) => x.texto);
  assert.ok(b.includes("Sensor de fase Palio"));
  assert.ok(b.includes("Sensor de fase Palio 2012 a 2016"));
  assert.ok(b.includes("Sensor de fase Palio 1.6 16V"));
  assert.ok(!b.some((t) => /^\d+$/.test(t)), "sem código não aparece busca por código");
});

test("E/F) aplicação detalhada + modelos amplos convivem no texto do bloco ⑨ sem ano inventado", () => {
  const texto = "RENAULT\n\n• Logan\n  Motor: 1.6 16V\n  Período: 2012\n\n• Laguna\n\n• Megane\n  Motor: 2.0\n  Período: a partir de 2006\n\n• Kangoo\n  Período: até 2014\n\n• Sandero\n  Motor: 1.6\n  Período: 2008 até Atual";
  const apps = lerAplicacoesAprovadas({ texto });
  const por = Object.fromEntries(apps.map((a) => [a.modelo, a]));
  assert.deepEqual([por.Logan.anoInicio, por.Logan.anoFim], [2012, 2012]);
  assert.deepEqual([por.Laguna.motor, por.Laguna.anoInicio, por.Laguna.anoFim], ["", null, null]);
  assert.deepEqual([por.Megane.anoInicio, por.Megane.anoFim], [2006, null]);
  assert.deepEqual([por.Kangoo.anoInicio, por.Kangoo.anoFim], [null, 2014]);
  assert.equal(por.Sandero.anoFim, null, "'Atual' não vira ano inventado");
});

test("modelo sem detalhes NÃO é vinculado a todas as versões do catálogo ML", async () => {
  let chamadas = 0;
  const r = await resolverCompatibilidades([{ montadora: "Renault", modelo: "Laguna", motor: "", anoInicio: null, anoFim: null }], async () => { chamadas++; return { ok: true, dados: [] }; });
  assert.equal(chamadas, 0);
  assert.equal(r.veiculos.length, 0);
  assert.match(r.semCatalogo[0].motivo, /modelo sem detalhes/);
});

// Atributos REAIS (GET /categories/{folha}/attributes, 05/10/2026)
const ATTR = {
  carro: [{ id: "VEHICLE_TYPE", tags: { catalog_required: true, fixed: true, required: true }, values: [{ id: "11377043", name: "Carro/Caminhonete" }] }],
  moto: [{ id: "VEHICLE_TYPE", tags: { fixed: true, required: true }, values: [{ id: "15279767", name: "Moto/Quadriciclo" }] }],
  pesada: [{ id: "VEHICLE_TYPE", tags: { fixed: true, required: true }, values: [{ id: "13222040", name: "Linha Pesada" }] }],
  nautica: [{ id: "BRAND" }],
};

test("O) Carro/Caminhonete: valor único da categoria é selecionado e gravado (não placeholder)", () => {
  const info = tipoVeiculoDaCategoria(ATTR.carro);
  assert.equal(info.existe, true);
  assert.equal(info.fixo, true);
  assert.equal(tipoVeiculoParaFicha(info, ""), "Carro/Caminhonete");
  assert.equal(tipoVeiculoParaFicha(info, "Carro / Caminhonete"), "Carro/Caminhonete", "grafia do ML");
});

test("P) Linha Pesada, Moto e Náutica pela estrutura do ML (sem inventar)", () => {
  assert.equal(tipoVeiculoParaFicha(tipoVeiculoDaCategoria(ATTR.moto), "Carro / Caminhonete"), "Moto/Quadriciclo");
  assert.equal(tipoVeiculoParaFicha(tipoVeiculoDaCategoria(ATTR.pesada), ""), "Linha Pesada");
  const nautica = tipoVeiculoDaCategoria(ATTR.nautica);
  assert.equal(nautica.existe, false, "náutica: categoria sem o campo — não se aplica");
  assert.equal(tipoVeiculoParaFicha(nautica, ""), "", "não inventa valor");
  const varios = { existe: true, fixo: false, valores: [{ id: "1", nome: "Carro/Caminhonete" }, { id: "2", nome: "Linha Pesada" }] };
  assert.equal(tipoVeiculoParaFicha(varios, ""), "", "com vários valores, o usuário escolhe");
  assert.equal(tipoVeiculoParaFicha(varios, "linha pesada"), "Linha Pesada");
});

// ---------------- Rodada 2 (05/10): regras fechadas pelo usuário ----------------
const MODELOS_7703 = ["Logan", "Sandero", "Duster", "Kangoo", "Laguna", "Grand Scenic", "Megane"].map((modelo) => ({ montadora: "Renault", modelo }));

test("função confirmada forma 'parafuso suporte motor' (sem acrescentar palavras)", () => {
  assert.deepEqual(termosDaFuncao("Parafuso de Aço", "Suporte do conjunto de transmissão e motor"), ["Parafuso suporte motor", "Parafuso suporte transmissão motor"]);
  assert.deepEqual(termosDaFuncao("Parafuso", ""), [], "sem função confirmada, nada é derivado");
});

test("7703101596 sem termo digitado: exatamente as buscas pedidas, a partir da função confirmada", () => {
  const b = gerarIntencoesBusca({ codigos: ["7703101596"], nomePeca: "Parafuso de Aço", funcao: "Suporte do conjunto de transmissão e motor", medida: "M12 × 1,75 × 35", modelos: MODELOS_7703 }).map((x) => x.texto);
  for (const e of ["7703101596", "Parafuso suporte motor Logan", "Parafuso suporte motor Sandero", "Parafuso suporte motor Laguna", "Parafuso suporte motor Megane", "Parafuso suporte motor Renault"]) {
    assert.ok(b.includes(e), `falta: ${e}`);
  }
  assert.ok(!b.some((t) => /\b(19|20)\d{2}\b/.test(t)), "modelo sem detalhes não ganha ano");
  assert.ok(!b.some((t) => /\b\d\.\d\b/.test(t)), "modelo sem detalhes não ganha motor");
});

test("ordem dos dados confirmados: código → peça → função → medida → montadora → modelos → motor/ano", () => {
  const t = termosConfirmados({ codigos: ["7703101596"], nomePeca: "Parafuso de Aço", funcao: "Suporte do conjunto de transmissão e motor", medida: "M12 × 1,75 × 35", modelos: MODELOS_7703, aplicacoes: [{ montadora: "Renault", modelo: "Logan", motor: "1.6 16V", anoInicio: "2012", anoFim: "2012" }] });
  const ordem = ["codigo", "peca", "funcao", "medida", "montadora", "modelo", "motor", "ano"];
  const pos = t.map((x) => ordem.indexOf(x.origem));
  assert.deepEqual([...pos].sort((a, b) => a - b), pos, t.map((x) => x.origem).join(","));
});

test("modelos sem detalhes entram na DESCRIÇÃO (sem montadora, sem ano/motor)", () => {
  const texto = "RENAULT\n\n" + MODELOS_7703.map((m) => `• ${m.modelo}`).join("\n\n");
  const d = montarDescricaoPadrao({ nomePeca: "Parafuso de Aço", aplicacoes: lerAplicacoesAprovadas({ texto }), codigos: ["7703101596"], mesesGarantia: "3" });
  for (const m of MODELOS_7703) assert.ok(d.includes(`\n${m.modelo}\n`) || d.includes(`\n${m.modelo}`), `descrição sem ${m.modelo}`);
  assert.ok(!/renault/i.test(d), "sem montadora no texto");
  assert.ok(!/\b(19|20)\d{2}\b/.test(d), "sem ano inventado");
});

test("tabela oficial do ML recebe SÓ aplicações com dados; modelos sem detalhes ficam de fora mas não somem", () => {
  const texto = "RENAULT\n\n• Laguna\n\n• Megane\n\n• Logan\n  Motor: 1.6 16V\n  Período: 2012";
  const todas = lerAplicacoesAprovadas({ texto });
  const { detalhadas, semDetalhes } = separarAplicacoesParaML(todas);
  assert.deepEqual(detalhadas.map((a) => a.modelo), ["Logan"]);
  assert.deepEqual(semDetalhes.map((a) => a.modelo), ["Laguna", "Megane"]);
  assert.ok(semDetalhes.every((a) => !a.motor && a.anoInicio == null && a.anoFim == null), "nenhum ano/motor por suposição");
});

test("base/catálogo com vários modelos sem motor/ano: vira modelos sem detalhes, não aplicação detalhada", () => {
  const r = separarAplicacoesBase([
    { montadora: "Renault", modelo: "Logan, Sandero, Duster, Kangoo, Laguna, Grand Scenic, Megane", motor: "", anoInicio: "", anoFim: "", versao: "", origem: "base" },
    { montadora: "Renault", modelo: "Clio", motor: "1.0 16V", anoInicio: "2012", anoFim: "2012", versao: "", origem: "base" },
    { montadora: "", modelo: "Sem montadora", motor: "", anoInicio: "", anoFim: "", versao: "", origem: "base" },
  ]);
  assert.deepEqual(r.modelos.map((m) => m.modelo), ["Logan", "Sandero", "Duster", "Kangoo", "Laguna", "Grand Scenic", "Megane"]);
  assert.equal(r.detalhadas.length, 2, "Clio detalhada fica; linha sem montadora não é perdida");
  assert.ok(r.modelos.every((m) => !("motor" in m) && !("anoInicio" in m)), "nada de ano/motor nos modelos");
  // nenhum modelo sem detalhes chega à tabela oficial do ML
  assert.equal(separarAplicacoesParaML(r.modelos).detalhadas.length, 0);
});
