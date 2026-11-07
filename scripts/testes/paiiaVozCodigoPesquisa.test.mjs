// =============================================================
// PAIIA Voz — ETAPA 2 (CÓDIGO): andamento da pesquisa do SKU na Base PAIIA
// (sem rede, sem banco, dados fictícios).
//   node --test scripts/testes/paiiaVozCodigoPesquisa.test.mjs
// - "Pesquisando [SKU] na Base PAIIA" logo ao informar o SKU;
// - andamento real (uma etapa por fonte consultada), terminando em 100%;
// - encontrado: aplicações e códigos de referência para conferir;
// - não encontrado: segue manualmente;
// - falha na consulta: erro + "Tentar novamente".
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);

const B = await import("../../src/modules/paiiaVoz/servicos/consultaBaseVoz.js");
const R = await import("../../src/modules/paiiaVoz/servicos/rascunhoRapido.js");
const F = await import("../../src/modules/paiiaVoz/servicos/fichaVoz.js");
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const LINHAS_IWP211 = [
  { peca: "bomba de combustível", montadora: "Fiat", modelo: "Palio", motor: "1.0", ano_inicio: 2004, ano_fim: 2010, codigos_oem: ["7088010"], codigos_equivalentes: ["F000TE145"] },
  { peca: "bomba de combustível", montadora: "Fiat", modelo: "Uno", motor: "1.0", ano_inicio: 2004, ano_fim: 2013, codigos_oem: ["7088010"], codigos_equivalentes: [] },
];
const vazio = async () => [];
const registrar = () => { const passos = []; return { passos, onProgresso: (progresso, etapa) => passos.push({ progresso, etapa }) }; };

test("IWP211 encontrado: começa com “Pesquisando IWP211 na Base PAIIA”, andamento crescente até 100%", async () => {
  const { passos, onProgresso } = registrar();
  const res = await B.consultarBaseVoz("IWP211", { buscarValidado: async () => LINHAS_IWP211, pesquisarCatalogo: vazio, onProgresso });
  assert.equal(res.encontrado, true);
  assert.equal(res.falhou, false);
  assert.equal(res.aplicacoes.length, 2);
  assert.deepEqual(res.codigos, ["7088010", "F000TE145"]);
  assert.equal(passos[0].etapa, "Pesquisando IWP211 na Base PAIIA");
  assert.ok(passos.some((p) => /Base validada PAIIA/.test(p.etapa)), "mostra a fonte consultada");
  assert.equal(passos.at(-1).progresso, 100);
  assert.match(passos.at(-1).etapa, /encontrad/i);
  for (let i = 1; i < passos.length; i++) assert.ok(passos[i].progresso >= passos[i - 1].progresso, "andamento nunca volta");
});

test("código inexistente: passa por todas as fontes (andamento real) e termina como NÃO encontrado, sem falha", async () => {
  const { passos, onProgresso } = registrar();
  const res = await B.consultarBaseVoz("ZZZ999X", {
    buscarValidado: vazio,
    pesquisarCatalogo: async ({ onProgresso: p }) => { p?.({ etapa: "consultando_base_mestre", mensagem: "Localizando a peça na Base Mestre PAIIA..." }); return []; },
    preencherAutomatico: async ({ onProgresso: p }) => { p?.(50, "Analisando catálogos…"); return {}; },
    onProgresso,
  });
  assert.equal(res.encontrado, false);
  assert.equal(res.falhou, false);
  const etapas = passos.map((p) => p.etapa).join(" | ");
  assert.match(etapas, /Base validada PAIIA/);
  assert.match(etapas, /Localizando a peça na Base Mestre PAIIA/, "mensagens reais do catálogo aparecem");
  assert.match(etapas, /Analisando catálogos/, "andamento da mesma busca do Criar Anúncio aparece");
  assert.equal(passos.at(-1).progresso, 100);
  assert.match(passos.at(-1).etapa, /não encontrad/i);
  const f = R.registrarConsultaBase(F.criarFichaVoz({ id: "x", agora: 1 }), res);
  assert.equal(R.estadoRapido(f).base.estado, "nada");

  // A busca do Criar Anúncio avisa "não encontrado" lançando erro: continua sendo NÃO encontrado (não falha).
  const r2 = await B.consultarBaseVoz("ZZZ999X", { preencherAutomatico: async () => { throw new Error("Nenhum resultado foi encontrado para ZZZ999X."); } });
  assert.equal(r2.falhou, false);
  assert.equal(r2.encontrado, false);
});

test("falha na consulta: erro informado, estado “falha” (não confunde com não encontrado)", async () => {
  const res = await B.consultarBaseVoz("IWP211", {
    buscarValidado: vazio,
    pesquisarCatalogo: async () => { throw new Error("Failed to fetch"); },
    preencherAutomatico: async () => { throw new Error("Failed to fetch"); },
  });
  assert.equal(res.encontrado, false);
  assert.equal(res.falhou, true);
  assert.match(res.erro, /Failed to fetch/);
  const f = R.registrarConsultaBase(F.criarFichaVoz({ id: "x", agora: 1 }), res);
  assert.equal(R.estadoRapido(f).base.estado, "falha");
  assert.match(R.estadoRapido(f).base.erro, /Failed to fetch/);
});

test("consulta que não responde: tempo esgotado vira falha (com opção de tentar de novo)", async () => {
  const res = await B.consultarBaseVoz("IWP211", { buscarValidado: () => new Promise(() => {}), tempoLimiteMs: 20 });
  assert.equal(res.falhou, true);
  assert.match(res.erro, /não respondeu/i);
});

test("Base validada: erro do banco (engolido pelo serviço) é detectado pelo cliente vigiado", async () => {
  const consulta = (resposta) => { const q = { select: () => q, eq: () => q, limit: () => q, then: (ok, nok) => Promise.resolve(resposta).then(ok, nok) }; return q; };
  const buscarComo = async (codigo, { cliente }) => { const { data, error } = await cliente.from("t").select("*").eq("a", codigo).limit(5); return error ? [] : data; };
  const comErro = { from: () => consulta({ data: null, error: { message: "JWT expired" } }) };
  await assert.rejects(() => B.buscarValidadoVigiado(buscarComo, comErro)("IWP211"), /JWT expired/);
  const ok = { from: () => consulta({ data: LINHAS_IWP211, error: null }) };
  assert.equal((await B.buscarValidadoVigiado(buscarComo, ok)("IWP211")).length, 2);
  // construtor de consulta que é FUNÇÃO (como alguns clientes/simuladores): o erro continua sendo detectado
  const consultaFn = (resposta) => { const q = Object.assign(function () {}, { select: () => q, eq: () => q, limit: () => q, then: (a, b) => Promise.resolve(resposta).then(a, b) }); return q; };
  await assert.rejects(() => B.buscarValidadoVigiado(buscarComo, { from: () => consultaFn({ data: null, error: { message: "timeout" } }) })("IWP211"), /timeout/);
});

test("tela (etapa Código): reaproveita a barra do Criar Anúncio; encontrado / não encontrado / falha + Tentar novamente", () => {
  const t = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.ok(t.includes('import PainelProcessamentoAnuncio from "../../components/PainelProcessamentoAnuncio"'), "mesma barra do Criar Anúncio");
  const i = t.indexOf('data-pr-bloco="codigo"');
  const bloco = t.slice(i, t.indexOf("</section>", i));
  assert.ok(bloco.includes("<PainelProcessamentoAnuncio"), "barra na etapa Código");
  assert.ok(/setPesquisa\(\{ codigo: sku, progresso: 5, etapa: `Pesquisando \$\{sku\} na Base PAIIA` \}\)/.test(t), "mensagem imediata ao informar o SKU");
  assert.ok(bloco.includes('data-pr-base="encontrado"') && bloco.includes("aplicação(ões)") && bloco.includes("código(s) de referência"));
  assert.ok(bloco.includes('data-pr-base="nada"') && bloco.includes("continue preenchendo manualmente"));
  assert.ok(bloco.includes('data-pr-base="falha"') && bloco.includes("data-pr-tentar-novamente") && bloco.includes("Tentar novamente"));
});
