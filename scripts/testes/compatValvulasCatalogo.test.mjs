// (10/11) Compatibilidades na Publicação: aplicação informada (ex.: Chevrolet Cruze 1.4 16V 2017–2023)
// x validada pelo catálogo do Mercado Livre. O catálogo costuma chamar a versão de "LT 1.4 Turbo"
// (sem "16V"): antes TODAS eram descartadas e a conferência dizia "0 validadas / publicar sem compatibilidade?".
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";
register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);
const { banco, zerarBanco } = await import("./simulacao/supabaseFalso.mjs");
const { avaliarVeiculo, resolverCompatibilidades, aplicarVeiculosConfirmados, chaveAplicacaoML, resumoCompatAprovadas } = await import("../../src/services/compatibilidadeML.js");
const { compatSemCatalogo } = await import("../../src/modules/paiiaVoz/servicos/finalizarAnuncioVoz.js");
const { CHAVES_PRESERVADAS_FICHA, salvarFichaAprovada, registrarVeiculosConfirmadosML, lerVeiculosConfirmadosML } = await import("../../src/services/anuncioPublicacaoService.js");
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const CRUZE = { montadora: "Chevrolet", modelo: "Cruze", motor: "1.4 16V", anoInicio: 2017, anoFim: 2023 };
const veic = (id, ano, attrs) => ({ id, attributes: [["BRAND", "Chevrolet"], ["MODEL", "Cruze"], ["VEHICLE_YEAR", String(ano)], ...Object.entries(attrs)].map(([i, v]) => ({ id: i, value_name: v })) });
const CATALOGO = [
  veic("MLB101", 2018, { TRIM: "LT 1.4 Turbo", ENGINE: "1.4" }), // não informa válvulas → para confirmar
  veic("MLB102", 2019, { TRIM: "LTZ 1.4 16V Turbo", ENGINE: "1.4" }), // confirma tudo → automático
  veic("MLB103", 2020, { TRIM: "Premier", ENGINE: "1.4 Turbo", VALVES_PER_CYLINDER: "4", NUMBER_OF_CYLINDERS: "4" }), // 4x4 = 16 → automático
  veic("MLB104", 2016, { TRIM: "LT 1.8 16V", ENGINE: "1.8" }), // motor e ano errados
  veic("MLB105", 2018, { TRIM: "LT 1.4 8V", ENGINE: "1.4" }), // outras válvulas
  veic("MLB106", 2024, { TRIM: "LT 1.4 16V Turbo", ENGINE: "1.4" }), // fora do período
  veic("MLB107", 2021, { TRIM: "Sport6 LT", ENGINE: "1.4 Turbo", VALVES_PER_CYLINDER: "2", NUMBER_OF_CYLINDERS: "4" }), // 2x4 = 8 → não é 16v
];
function consultar(catalogo) {
  const chamadas = [];
  const fn = async (caminho, metodo, corpo) => {
    chamadas.push([metodo, caminho]);
    if (/BRAND\/top_values/.test(caminho)) return { ok: true, dados: [{ id: 1, name: "Chevrolet" }] };
    if (/MODEL\/top_values/.test(caminho)) return { ok: true, dados: [{ id: 2, name: "Cruze" }, { id: 3, name: "Onix" }] };
    if (/products_search/.test(caminho)) return { ok: true, dados: { results: corpo && /offset=0/.test(caminho) ? catalogo : [], total: catalogo.length } };
    return { ok: false, erro: "inesperado" };
  };
  return { fn, chamadas };
}

test("motor do catálogo escrito '1.4 Turbo' confere a cilindrada 1.4 (e não 1.45 / 11.4)", () => {
  assert.equal(avaliarVeiculo(veic("MLB1", 2019, { TRIM: "LTZ 16V", ENGINE: "1.4 Turbo" }), CRUZE).ok, true);
  assert.equal(avaliarVeiculo(veic("MLB2", 2019, { TRIM: "LTZ 16V", ENGINE: "1.45" }), CRUZE).ok, false);
  assert.equal(avaliarVeiculo(veic("MLB3", 2019, { TRIM: "LTZ 16V", ENGINE: "11.4" }), CRUZE).ok, false);
});

test("válvulas: confirmadas pela versão ou por válvulas/cilindro × cilindros; outras válvulas = descartada", () => {
  assert.equal(avaliarVeiculo(CATALOGO[2], CRUZE).ok, true);
  const oito = avaliarVeiculo(CATALOGO[4], CRUZE);
  assert.equal(oito.ok, false); assert.ok(!oito.aConfirmar);
  const doisPorCil = avaliarVeiculo(CATALOGO[6], CRUZE);
  assert.equal(doisPorCil.ok, false); assert.ok(!doisPorCil.aConfirmar, "8 válvulas no total não vira opção");
});

test("catálogo SEM a informação das válvulas: não é vinculado sozinho, vira opção para confirmar", () => {
  const r = avaliarVeiculo(CATALOGO[0], CRUZE);
  assert.equal(r.ok, false);
  assert.equal(r.aConfirmar, true);
  assert.match(r.motivo, /não informa as válvulas \(16v\)/);
});

test("Cruze 1.4 16V 2017–2023: exatas vinculadas sozinhas; as sem válvulas ficam para você confirmar; erradas descartadas", async () => {
  const { fn, chamadas } = consultar(CATALOGO);
  const r = await resolverCompatibilidades([CRUZE], fn);
  assert.deepEqual(r.veiculos.map((v) => v.id).sort(), ["MLB102", "MLB103"]);
  assert.equal(r.paraConfirmar.length, 1);
  assert.deepEqual(r.paraConfirmar[0].opcoes.map((o) => o.id), ["MLB101"]);
  assert.equal(r.paraConfirmar[0].chaveAplicacao, chaveAplicacaoML(CRUZE));
  assert.deepEqual(r.descartados.map((d) => d.id).sort(), ["MLB104", "MLB105", "MLB106", "MLB107"]);
  assert.equal(r.semCatalogo.length, 0);
  assert.ok(chamadas.every(([, c]) => /^\/catalog_/.test(c)), "só leitura do catálogo");
});

test("só versões sem válvulas no catálogo: NÃO diz 'sem compatibilidade' — pergunta quais servem", async () => {
  const { fn } = consultar([CATALOGO[0], CATALOGO[3]]);
  const r = await resolverCompatibilidades([CRUZE], fn);
  assert.equal(r.veiculos.length, 0);
  assert.equal(r.semCatalogo[0].versoesAConfirmar, true);
  assert.match(r.semCatalogo[0].motivo, /confirme quais servem/);
  const linha = resumoCompatAprovadas([CRUZE], r)[0];
  assert.equal(linha.estado, "confirmar");
  assert.match(linha.aviso, /aplicação informada; ainda não validada pelo Mercado Livre/);
});

test("versões que VOCÊ confirmou são vinculadas; a confirmação nunca aceita versão com ano/motor/válvulas errados", async () => {
  const mapa = { [chaveAplicacaoML(CRUZE)]: { ids: ["MLB101", "MLB104", "MLB105"] } };
  const aps = aplicarVeiculosConfirmados([CRUZE], mapa);
  assert.deepEqual(aps[0].veiculosConfirmados, ["MLB101", "MLB104", "MLB105"]);
  assert.equal(aps[0].motor, "1.4 16V", "a aplicação cadastrada não muda");
  const { fn } = consultar(CATALOGO);
  const r = await resolverCompatibilidades(aps, fn);
  assert.deepEqual(r.veiculos.map((v) => v.id).sort(), ["MLB101", "MLB102", "MLB103"]);
  assert.equal(r.veiculos.find((v) => v.id === "MLB101").confirmadoPor, "usuario");
  assert.equal(r.paraConfirmar.length, 0);
  assert.ok(r.descartados.some((d) => d.id === "MLB104") && r.descartados.some((d) => d.id === "MLB105"));
});

test("confirmação de OUTRA aplicação não vale para esta (chave por montadora/modelo/motor/período)", () => {
  const mapa = { [chaveAplicacaoML({ ...CRUZE, anoFim: 2020 })]: { ids: ["MLB101"] } };
  assert.equal(aplicarVeiculosConfirmados([CRUZE], mapa)[0].veiculosConfirmados, undefined);
});

test("ficha (banco simulado): grava, relê, desfaz; aplicações e demais dados intactos", async () => {
  zerarBanco();
  const dc = { versao: 2, anuncio: { codigo: "39038550" }, paiia_voz: { aplicacoes: [CRUZE] }, correspondencias_modelo_ml: { x: { modelo_id: "2" } } };
  const ap = await salvarFichaAprovada({ anuncioId: "", codigo: "39038550", titulo: "Peça teste", dadosConferencia: dc });
  assert.equal(ap.ok, true);
  const chave = chaveAplicacaoML(CRUZE);
  const r = await registrarVeiculosConfirmadosML({ anuncioId: ap.anuncioId, chaveAplicacao: chave, aplicacao: "Cruze 1.4 16V 2017–2023", veiculos: [{ id: "MLB101", nome: "Chevrolet Cruze LT 1.4 Turbo 2018" }, { id: "inválido" }] });
  assert.equal(r.ok, true, r.erro);
  assert.deepEqual(r.confirmados[chave].ids, ["MLB101"], "só ids MLB do catálogo");
  const lido = await lerVeiculosConfirmadosML(ap.anuncioId);
  assert.deepEqual(lido.confirmados[chave].ids, ["MLB101"]);
  const linha = banco.tabelas.paiia_anuncios.find((l) => l.id === ap.anuncioId);
  assert.deepEqual(linha.dados_conferencia.paiia_voz.aplicacoes, [CRUZE], "aplicação cadastrada intacta");
  assert.deepEqual(linha.dados_conferencia.correspondencias_modelo_ml, { x: { modelo_id: "2" } });
  const d = await registrarVeiculosConfirmadosML({ anuncioId: ap.anuncioId, chaveAplicacao: chave, veiculos: [] });
  assert.equal(d.ok, true);
  assert.equal(d.confirmados[chave], undefined);
});

test("ficha: confirmação gravada numa chave própria e preservada; nada das aplicações é apagado", () => {
  assert.ok(CHAVES_PRESERVADAS_FICHA.includes("compat_veiculos_confirmados_ml"));
  const s = ler("src/services/anuncioPublicacaoService.js");
  assert.ok(s.includes("update({ dados_conferencia: { ...dados, compat_veiculos_confirmados_ml: mapa } })"));
  assert.ok(s.includes('if (publicacaoExiste(atual.anuncio.publicacao)) return { ok: false, erro: "Esta ficha já foi publicada: não é alterada." };'));
});

test("PAIIA Voz: pergunta com as versões do catálogo; 'sem compatibilidade' só como escolha explícita", () => {
  const p = ler("src/modules/paiiaVoz/servicos/preparoConferenciaVoz.js");
  assert.ok(p.includes("resolverCompatibilidades(aplicarVeiculosConfirmados(e.aplicacoes, e.veiculosConfirmados), consultar)"));
  assert.ok(p.includes("ainda não validada pelo Mercado Livre"));
  assert.ok(p.includes("informada(s) por você continuam na ficha, mas nenhum veículo do catálogo confirmou as aplicações"));
  const row = (v) => ({ dados_conferencia: { paiia_voz: { preparo: { verificacoes: { compatibilidade: v } } } } });
  assert.equal(compatSemCatalogo(row({ estado: "pergunta", texto: "x", perguntaVeiculos: { opcoes: [{ id: "MLB1" }] } })), true);
  assert.equal(compatSemCatalogo(row({ estado: "ok", texto: "x" })), false);
  const f = ler("src/modules/paiiaVoz/FinalizarAnuncioVoz.jsx");
  assert.ok(f.includes("data-pv-pergunta-versoes") && f.includes("disabled={Boolean(rodando) || !marcadas.length}"), "confirma só o que você marcou");
  const r = ler("src/modules/paiiaVoz/servicos/revisaoCelularVoz.js");
  assert.ok(r.includes("perguntaVeiculos: x.perguntaVeiculos"));
});

test("Publicação: 'informada' x 'validada'; sem validada só publica com a autorização explícita", () => {
  const r = ler("src/components/RevisaoPublicacaoML.jsx");
  assert.ok(r.includes("Aplicação informada: ${aplicacoes.length} (gravada na ficha). Validada pelo Mercado Livre: 0"));
  assert.ok(r.includes('else itens.push({ item: "Compatibilidades", nivel: "erro", semCompatOpcao: true, texto: nConfirmar'));
  assert.ok(r.includes("if (semCompatConfirmada || semCompatAutorizadaPublicacao) itens.push({ item: \"Compatibilidades\", nivel: \"aviso\""));
  assert.ok(r.includes("data-paiia-compat-confirmar") && r.includes("disabled={gravando || !marcadas.length}"));
  assert.ok(r.includes("lerVeiculosConfirmadosML(ficha.anuncioId)"));
});
