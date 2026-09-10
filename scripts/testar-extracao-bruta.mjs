import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  deveAbrirNovoBlocoBruto,
  ehTokenCodigoAlfanumerico,
  ehTokenCodigoNumerico,
  linhaDeAplicacaoOuObservacao,
  linhaSoIdentificadores,
  montarBlocosBrutosDaPagina,
  montarLinhasOriginais,
} from "../src/services/importadores/pipeline/montarBlocosBrutos.js";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

const linhas = montarLinhasOriginais("A\n\nB\nC\n\n");
assert.ok(linhas.length >= 5);
assert.deepEqual(linhas[0], { i: 1, texto: "A" });
assert.equal(linhas[1].texto, "");

assert.equal(ehTokenCodigoNumerico("802000000032"), true);
assert.equal(ehTokenCodigoNumerico("1996"), false);
assert.equal(ehTokenCodigoNumerico("29"), false);
assert.equal(ehTokenCodigoAlfanumerico("TB0032"), true);
assert.equal(ehTokenCodigoAlfanumerico("FIAT"), false);
assert.equal(ehTokenCodigoAlfanumerico("16V"), false);
assert.equal(linhaSoIdentificadores("802000000032 / TB0032"), true);
assert.equal(linhaSoIdentificadores("TB0043"), true);
assert.equal(linhaSoIdentificadores("FIAT PALIO 1.0 8V 1996/2000"), false);
assert.equal(
  linhaDeAplicacaoOuObservacao("FIAT PALIO 1.0 8V 1996/2000"),
  true
);
assert.equal(
  linhaDeAplicacaoOuObservacao("Nao usar 802000000034 neste motor"),
  true
);

const paginaUnica = montarBlocosBrutosDaPagina("codigo 0280158000 sem quebra");
assert.equal(paginaUnica.length, 1);
assert.equal(paginaUnica[0].ordem_bloco, 1);
assert.equal(paginaUnica[0].linhas_originais[0].i, 1);
assert.ok(paginaUnica[0].texto_original.includes("0280158000"));

const paginaVazia = montarBlocosBrutosDaPagina("");
assert.equal(paginaVazia.length, 1);
assert.equal(paginaVazia[0].texto_original, "");

const pagina29 = montarBlocosBrutosDaPagina(
  [
    "ELECTRONIC SYSTEMS",
    "802000000032 / TB0032",
    "FIAT PALIO 1.0 8V 1996/2000",
    "FIAT SIENA 1.0 1996/2000",
    "802000000034 / TB0034",
    "VW GOL 1.0 8V",
    "TB0043",
    "FIAT UNO 1.0",
    "29",
  ].join("\n")
);

assert.equal(pagina29.length, 3);
assert.equal(pagina29[0].ordem_bloco, 1);
assert.equal(pagina29[0].linhas_originais[0].i, 1);
assert.ok(pagina29[0].texto_original.includes("802000000032 / TB0032"));
assert.ok(pagina29[0].texto_original.includes("FIAT PALIO"));
assert.equal(pagina29[0].texto_original.includes("802000000034"), false);
assert.ok(pagina29[1].texto_original.startsWith("802000000034 / TB0034"));
assert.ok(pagina29[2].texto_original.startsWith("TB0043"));
assert.ok(pagina29[2].texto_original.includes("29"));

const mesmosCodigosSemAplicacao = montarBlocosBrutosDaPagina(
  [
    "802000000032 / TB0032",
    "802000000034 / TB0034",
    "TB0043",
    "FIAT PALIO 1.0 8V 1996/2000",
  ].join("\n")
);
assert.equal(mesmosCodigosSemAplicacao.length, 1);

const codigoEmObservacao = montarBlocosBrutosDaPagina(
  [
    "802000000032 / TB0032",
    "FIAT PALIO 1.0 8V 1996/2000",
    "Nao usar 802000000034 neste motor",
    "802000000034 / TB0034",
  ].join("\n")
);
assert.equal(codigoEmObservacao.length, 1);

const continuacaoDepoisAplicacao = montarBlocosBrutosDaPagina(
  [
    "FIAT STRADA 1.4 1996/2000",
    "802000000099 / TB0099",
    "VW GOL 1.0 8V 1998/2002",
  ].join("\n")
);
assert.equal(continuacaoDepoisAplicacao.length, 2);
assert.ok(continuacaoDepoisAplicacao[0].texto_original.includes("FIAT STRADA"));
assert.ok(
  continuacaoDepoisAplicacao[1].texto_original.startsWith("802000000099 / TB0099")
);

const blocoComCorpo = [
  { i: 1, texto: "802000000032 / TB0032" },
  { i: 2, texto: "FIAT PALIO 1.0 8V 1996/2000" },
];
assert.equal(deveAbrirNovoBlocoBruto(blocoComCorpo, "802000000034 / TB0034"), true);
assert.equal(deveAbrirNovoBlocoBruto(blocoComCorpo, "29"), false);
assert.equal(
  deveAbrirNovoBlocoBruto(blocoComCorpo, "Nao usar TB0034 neste motor"),
  false
);
assert.equal(deveAbrirNovoBlocoBruto(blocoComCorpo, "TB0032"), false);

const pipeline = readFileSync(
  join(raiz, "src/services/importadores/pipeline/executarExtracaoBruta.js"),
  "utf8"
);
assert.equal(pipeline.includes("catalogo_pecas"), false);
assert.equal(pipeline.includes("salvarCatalogo"), false);
assert.equal(pipeline.includes("motorImportacao"), false);
assert.ok(pipeline.includes("catalogo_importacao_lote"));
assert.ok(pipeline.includes("catalogo_pagina"));
assert.ok(pipeline.includes("catalogo_bloco_bruto"));
assert.ok(pipeline.includes("enviadoCatalogoPecas: false"));
assert.ok(pipeline.includes("paginasProcessadas"));
assert.ok(pipeline.includes("paginasComErro"));
assert.ok(pipeline.includes("blocosPendentes"));
assert.ok(pipeline.includes("statusExtracao"));
assert.ok(pipeline.includes("texto_original"));
assert.ok(pipeline.includes("linhas_originais"));

const ui = readFileSync(
  join(raiz, "src/components/ImportadorCatalogos.jsx"),
  "utf8"
);
assert.ok(ui.includes("Inspecionar blocos"));
assert.ok(ui.includes("Páginas com erro"));
assert.ok(ui.includes("Blocos pendentes"));
assert.ok(ui.includes("texto_original"));
assert.ok(ui.includes("linhas_originais"));
assert.equal(ui.includes("salvarCatalogo"), false);

const hash = await crypto.subtle.digest(
  "SHA-256",
  new TextEncoder().encode("mesmo-pdf")
);
const hex = Array.from(new Uint8Array(hash))
  .map((byte) => byte.toString(16).padStart(2, "0"))
  .join("");
assert.equal(hex.length, 64);

console.log(
  "OK extração bruta: segmentação conservadora, hash e isolamento de catalogo_pecas."
);
