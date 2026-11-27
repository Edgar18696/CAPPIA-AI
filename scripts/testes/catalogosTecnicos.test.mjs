// =============================================================
// PAIIA — TESTES: Catálogos Técnicos em uma só tela (26/11/2026).
//   node --test scripts/testes/catalogosTecnicos.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);
const T = await import("../../src/services/catalogos/codigosTecnicos.js");
const C = await import("../../src/config/catalogosTecnicos.js");
const { CATALOGOS_ONLINE } = await import("../../src/config/catalogosOnline.js");
const G = await import("../../src/services/pesquisaGoogleAnuncio.js");
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("DENSO: com e sem hífen, com e sem RC; código oficial preservado", () => {
  assert.deepEqual(T.formasDenso("4390000830RC"), ["439000-0830RC", "439000-0830"]);
  assert.deepEqual(T.formasDenso("4390000830"), ["439000-0830RC", "439000-0830"]);
  assert.deepEqual(T.formasDenso("BC2614301270RC"), ["BC261430-1270RC", "BC261430-1270"]);
  assert.equal(T.compactoAlternativoDenso("4390000830"), "4390000830RC");
  assert.equal(T.compactoAlternativoDenso("4390000830RC"), "4390000830");
  // Fora do padrão DENSO: nada muda.
  assert.deepEqual(T.formasDenso("DOX2006"), []);
  assert.equal(T.compactoAlternativoDenso("0280142345X"), "");
});

test("a busca usa a forma exata primeiro e a forma com/sem RC só quando a exata não acha", () => {
  const s = ler("src/services/preencherAnuncioService.js");
  assert.match(s, /formasDenso\(compacto\)/);
  assert.match(s, /if \(exatos\.length > 0\) \{\s*pecas = exatos;/);
  assert.match(s, /for \(const tentativa of \[compacto, alternativoDenso\]/);
});

test("hierarquia: montadora (1) > componente original OE (2) > reposição (3); Brasil antes do exterior", () => {
  assert.equal(T.grupoDaFonte({ fabricante: "Motrio", origem_catalogo: "Catálogo Renault Motrio 2022" }), "montadora");
  assert.equal(T.grupoDaFonte({ fabricante: "Denso" }), "oe");
  assert.equal(T.grupoDaFonte({ fabricante: "TSA" }), "reposicao");
  assert.equal(T.grupoDaFonte({ fabricante: "Bosch", origem_catalogo: "Gauss — Catálogo de Produtos 01/2024" }), "oe");
  const br = { fabricante: "Denso", origem_catalogo: "Catálogo DENSO Peças para Reparação (PDF 17/11/2026)" };
  const eu = { fabricante: "Denso", origem_catalogo: "Catálogo DENSO Lambda Sensors – Product Catalogue 2024 (Europa)" };
  assert.ok(T.prioridadeDaFonte(br) < T.prioridadeDaFonte(eu));
  assert.ok(T.prioridadeDaFonte({ fabricante: "Volkswagen" }) < T.prioridadeDaFonte(br));
  assert.ok(T.prioridadeDaFonte(br) < T.prioridadeDaFonte({ fabricante: "TSA" }));
});

test("fontes divergentes são sinalizadas; mesma peça em catálogos diferentes não", () => {
  assert.equal(T.divergenciaEntreFontes([
    { peca: "Sonda Lambda", origem_catalogo: "A" }, { peca: "Sonda Lambda Pré-Catalisador", origem_catalogo: "B" },
  ]), null);
  const d = T.divergenciaEntreFontes([
    { peca: "Compressor do Ar Condicionado", origem_catalogo: "A" }, { peca: "Condensador do Ar Condicionado", origem_catalogo: "B" },
  ]);
  assert.ok(d && /Fontes divergentes/.test(d.mensagem));
  assert.equal(d.fontes.length, 2);
});

test("períodos consecutivos da mesma aplicação viram uma linha, sem perder as originais", () => {
  const base = { montadora: "FIAT", modelo: "PALIO", motor: "1.0", peca: "Radiador", codigo_oem: "X1", origem_catalogo: "O" };
  const r = T.agruparPeriodosConsecutivos([
    { ...base, id: 1, ano_inicio: 2011, ano_fim: 2013 },
    { ...base, id: 2, ano_inicio: 2014, ano_fim: 2016 },
    { ...base, id: 3, ano_inicio: 2019, ano_fim: 2020 }, // não encosta: fica separado
    { ...base, id: 4, motor: "1.4", ano_inicio: 2014, ano_fim: 2016 }, // outro motor: separado
  ]);
  assert.equal(r.length, 3);
  const junto = r.find((x) => x.agrupadas);
  assert.equal(junto.ano_inicio, 2011);
  assert.equal(junto.ano_fim, 2016);
  assert.deepEqual(junto.agrupadas.map((x) => x.id), [1, 2]);
  // Sem anos ou sem montadora: passa direto.
  const nota = { codigo_oem: "DOX-2006", tipo_referencia: "nota_tecnica" };
  assert.deepEqual(T.agruparPeriodosConsecutivos([nota]), [nota]);
});

test("Google: 'Pré', 'Dark' e modelo de outra marca não viram 'Toyota Pré/Dark/Fiesta'", () => {
  const res = [
    { titulo: "Sonda Lambda Pré Catalisador Toyota Corolla 89465-12345", trecho: "Toyota Corolla 2010", link: "https://a.com.br/1" },
    { titulo: "Sonda Lambda Toyota Corolla Dark 89465-12345", trecho: "", link: "https://b.com.br/2" },
    { titulo: "Sonda Lambda Toyota Fiesta Pré 89465-12345", trecho: "", link: "https://c.com.br/3" },
    { titulo: "Sonda Lambda Ford Fiesta Toyota 89465-12345", trecho: "", link: "https://d.com.br/4" },
  ];
  const r = G.montarPeloGoogle({ codigo: "89465-12345", resultados: res });
  assert.equal(r.titulo, "Sonda Lambda Toyota Corolla 89465-12345");
  const semFontes = r.descricao.split("FONTES CONSULTADAS")[0]; // os títulos das fontes ficam como foram escritos
  assert.ok(!/Toyota (Pré|Dark|Fiesta)/.test(semFontes), semFontes);
  assert.match(r.descricao, /Ford Fiesta \(outra montadora — confira\)/);
  const nomes = [...r.org.modelos, ...r.org.modelosAConfirmar].map((m) => m.nome);
  assert.ok(!nomes.includes("Pré") && !nomes.includes("Dark"));
});

test("configuração: 3 grupos, IDs válidos e todo catálogo mantido aparece num cartão", () => {
  const ids = new Set(CATALOGOS_ONLINE.map((c) => c.id));
  assert.equal(ids.size, CATALOGOS_ONLINE.length, "IDs repetidos");
  assert.deepEqual(C.GRUPOS_CATALOGOS_TECNICOS.map((g) => g.id), ["montadora", "oe", "reposicao"]);
  for (const id of Object.keys(C.CATALOGOS_RETIRADOS)) assert.ok(ids.has(id), `retirado inexistente: ${id}`);
  const usados = new Set();
  for (const f of C.FABRICANTES_CATALOGOS) {
    assert.ok(C.GRUPOS_CATALOGOS_TECNICOS.some((g) => g.id === f.grupo), f.id);
    for (const id of f.oficiais) {
      assert.ok(ids.has(id), `${f.id}: ${id} não existe`);
      assert.ok(!C.CATALOGOS_RETIRADOS[id], `${f.id}: ${id} foi retirado`);
      usados.add(id);
    }
  }
  const mantidos = C.catalogosOnlineMantidos().map((c) => c.id);
  assert.deepEqual(mantidos.filter((id) => !usados.has(id)), [], "catálogo mantido sem cartão");
  assert.equal(mantidos.length + Object.keys(C.CATALOGOS_RETIRADOS).length, CATALOGOS_ONLINE.length);
});

test("DENSO: um único cartão oficial Brasil no lugar de Find My Part e velas globais", () => {
  const denso = C.FABRICANTES_CATALOGOS.find((f) => f.id === "denso");
  const oficiais = C.oficiaisDoFabricante(denso);
  assert.deepEqual(oficiais.map((c) => c.nome), ["DENSO — Catálogo Oficial Brasil"]);
  assert.match(oficiais[0].url, /^https:\/\/aftermarket\.denso\.com\.br\//);
  assert.ok(C.CATALOGOS_RETIRADOS["denso-find-my-part"] && C.CATALOGOS_RETIRADOS["denso-velas"]);
  assert.equal(C.FABRICANTES_CATALOGOS.find((f) => f.id === "tsa").grupo, "reposicao");
});

test("filtro do cartão: pelo fabricante ou pela origem do catálogo (Gauss fora da Bosch)", () => {
  const bosch = C.FABRICANTES_CATALOGOS.find((f) => f.id === "bosch");
  const gauss = C.FABRICANTES_CATALOGOS.find((f) => f.id === "gauss");
  const regGauss = { fabricante: "Bosch", origem_catalogo: "Gauss — Catálogo de Produtos 01/2024" };
  assert.equal(C.registroDoFabricante(regGauss, bosch), false);
  assert.equal(C.registroDoFabricante(regGauss, gauss), true);
  assert.equal(C.registroDoFabricante({ fabricante: "Bosch", origem_catalogo: "catlogo_sondas_2020.pdf" }, bosch), true);
});

test("tela única: sem as abas antigas e com o importador de PDF", () => {
  const s = ler("src/components/Catalogos.jsx");
  assert.ok(!/Catálogos já existentes/.test(s) && !/CatalogosOnline/.test(s));
  assert.match(s, /Importar Catálogo Técnico em PDF/);
  assert.match(s, /<BuscaCatalogo\s+setScreen=\{setScreen\}\s+embutido\s+fabricante=\{fabricante\}/);
});

test("aviso do SKU não diz mais 'Não encontrado' (a peça pode ter sido achada no catálogo)", () => {
  const s = ler("src/services/consultaInicialSKU.js");
  assert.match(s, /texto: "SKU novo — sem anúncio"/);
});
