import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { interpretarBlocoBruto } from "../src/services/importadores/pipeline/interpretarBlocoBruto.js";
import {
  TAMANHO_LOTE_VALIDACAO_FASE2,
  montarLoteValidacaoFase2,
  resumirLoteInterpretacao,
} from "../src/services/importadores/pipeline/selecionarLoteValidacaoFase2.js";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

const tb0032 = interpretarBlocoBruto({
  texto_original: "TB0032 OE 03L128063AD\nThrottle body",
});
assert.equal(tb0032.classificacao_candidata, "produto");
assert.equal(tb0032.codigo_peca, "TB0032");
assert.equal(tb0032.oem, "03L128063AD");
assert.equal(tb0032.descricao, "Throttle body");
assert.equal(tb0032.aplicacoes.length, 0);
assert.equal(tb0032.equivalencias.length, 0);
assert.equal(tb0032.fabricante_marca, null);
assert.equal(tb0032.status_interpretacao, "candidato");

const tb0032Pagina375 = interpretarBlocoBruto({
  texto_original: [
    "805016364901 -",
    "IHP072M",
    "802000000032 - Throttle body -",
    "TB0032 OE 03L128063AD",
  ].join("\n"),
});
assert.equal(tb0032Pagina375.classificacao_candidata, "produto");
assert.equal(tb0032Pagina375.codigo_peca, "TB0032");
assert.equal(tb0032Pagina375.codigo_interno, "802000000032");
assert.equal(tb0032Pagina375.oem, "03L128063AD");
assert.equal(tb0032Pagina375.descricao, "Throttle body");
assert.equal(tb0032Pagina375.revisao_manual, true);

const tb0032ComCabecalho = interpretarBlocoBruto({
  texto_original:
    "OTHER\nPARTS\nTYPE TYPE\n802000000032 - Throttle body -\nTB0032 OE 03L128063AD",
});
assert.equal(tb0032ComCabecalho.classificacao_candidata, "produto");
assert.equal(tb0032ComCabecalho.codigo_peca, "TB0032");
assert.equal(tb0032ComCabecalho.codigo_interno, "802000000032");
assert.equal(tb0032ComCabecalho.oem, "03L128063AD");
assert.equal(tb0032ComCabecalho.descricao, "Throttle body");
assert.equal(tb0032ComCabecalho.revisao_manual, true);
assert.equal(tb0032ComCabecalho.status_interpretacao, "revisao_manual");

const tabela = interpretarBlocoBruto({
  texto_original:
    "OTHER\nPARTS\n802000000032 - Throttle body -\nTB0032 OE 03L128063AD\n802000000034 - Throttle body -\nTB0034 OE 03L128063AC",
});
assert.equal(tabela.classificacao_candidata, "tabela_referencia");
assert.equal(tabela.codigo_peca, null);
assert.equal(tabela.oem, null);
assert.equal(tabela.descricao, null);
assert.equal(tabela.status_interpretacao, "revisao_manual");

const iwp049 = interpretarBlocoBruto({
  texto_original:
    "805000347304 -\nIWP049/1\n802001181005 -\nThrottle body\n52SXP31\n230016079057 -\nStepper motor\nB04",
});
assert.equal(iwp049.classificacao_candidata, "tabela_referencia");
assert.equal(iwp049.codigo_peca, null);

const fei0019 = interpretarBlocoBruto({
  texto_original:
    "805000000019 -\nFEI0019\n805000001010 -\nAccelerator pedal sensor",
});
assert.equal(fei0019.classificacao_candidata, "indefinido");
assert.equal(fei0019.codigo_peca, null);
assert.equal(fei0019.descricao, null);
assert.equal(fei0019.status_interpretacao, "indefinido");

const indefinido = interpretarBlocoBruto({
  texto_original: "FEI0019",
});
assert.equal(indefinido.classificacao_candidata, "indefinido");
assert.equal(indefinido.status_interpretacao, "indefinido");

const aplicacao = interpretarBlocoBruto({
  texto_original: "AUDI\nA3 (8P1)\n1.4 TFSI\n03/08 à 08/12",
});
assert.equal(aplicacao.classificacao_candidata, "aplicacao");
assert.equal(aplicacao.codigo_peca, null);
assert.equal(aplicacao.aplicacoes.length, 0);
assert.equal(aplicacao.status_interpretacao, "revisao_manual");

const cabecalho = interpretarBlocoBruto({
  texto_original: "OTHER\nPARTS\nTYPE",
});
assert.equal(cabecalho.classificacao_candidata, "cabecalho");

const indice = interpretarBlocoBruto({
  texto_original: "INDEX\nCONTENTS\nIWP049\nTB0032\nFEI0019",
});
assert.equal(indice.classificacao_candidata, "indice");
assert.equal(indice.codigo_peca, null);

assert.equal(TAMANHO_LOTE_VALIDACAO_FASE2, 50);

const blocosFake = [
  {
    id: "tb375",
    pagina: 375,
    ordem_bloco: 2,
    texto_original:
      "805016364901 -\nIHP072M\n802000000032 - Throttle body -\nTB0032 OE 03L128063AD",
  },
  {
    id: "iwp",
    pagina: 12,
    ordem_bloco: 1,
    texto_original:
      "805000347304 -\nIWP049/1\n802001181005 -\nThrottle body\n52SXP31\n230016079057 -\nStepper motor\nB04",
  },
  {
    id: "fei",
    pagina: 20,
    ordem_bloco: 1,
    texto_original:
      "805000000019 -\nFEI0019\n805000001010 -\nAccelerator pedal sensor",
  },
];

for (let pagina = 1; pagina <= 80; pagina += 1) {
  const resto = pagina % 7;
  let texto = `BLOCO ${pagina}`;
  if (resto === 0) {
    texto = `80200000${String(pagina).padStart(4, "0")} - Throttle body -\nTB${String(pagina).padStart(4, "0")} OE 03L1280${String(pagina).padStart(2, "0")}AD`;
  } else if (resto === 1) {
    texto = `80200000${String(pagina).padStart(4, "0")} - Throttle body -\nTB${String(pagina).padStart(4, "0")} OE AAA${pagina}\n80200001${String(pagina).padStart(4, "0")} - Stepper motor -\nSM${String(pagina).padStart(4, "0")} OE BBB${pagina}`;
  } else if (resto === 2) {
    texto = `AUDI\nA${pagina} (8P1)\n03/08 à 08/12`;
  } else if (resto === 3) {
    texto = "OTHER\nPARTS\nTYPE";
  } else if (resto === 4) {
    texto = `INDEX\nCONTENTS\nIWP${pagina}`;
  } else if (resto === 5) {
    texto = `AAA${pagina}\nBBB${pagina}\nCCC${pagina}`;
  } else {
    texto = `FEI${String(pagina).padStart(4, "0")}`;
  }
  blocosFake.push({
    id: `p${pagina}`,
    pagina,
    ordem_bloco: 1,
    texto_original: texto,
  });
}

const lote = montarLoteValidacaoFase2(blocosFake, { tamanho: 50 });
assert.equal(lote.length, 50);
assert.ok(lote.some((item) => item.bloco.id === "tb375"));
assert.ok(lote.some((item) => item.bloco.id === "iwp"));
assert.ok(lote.some((item) => item.bloco.id === "fei"));
assert.equal(new Set(lote.map((item) => item.bloco.id)).size, 50);
const paginas = new Set(lote.map((item) => item.bloco.pagina));
assert.ok(paginas.size >= 8);

const interpretados = lote.map((item) => ({
  ...item,
  interpretacao: interpretarBlocoBruto({
    texto_original: item.bloco.texto_original,
  }),
}));
const tipos = new Set(
  interpretados.map((item) => item.interpretacao.classificacao_candidata)
);
assert.ok(tipos.has("produto"));
assert.ok(tipos.has("tabela_referencia"));
assert.ok(tipos.has("aplicacao"));
assert.ok(tipos.has("indefinido"));
assert.ok(tipos.has("cabecalho") || tipos.has("indice"));

const resumo = resumirLoteInterpretacao(interpretados);
assert.equal(resumo.totalAnalisado, 50);
assert.equal(
  resumo.produtosCandidatos +
    resumo.tabelasReferencias +
    resumo.aplicacoes +
    resumo.indefinidos +
    resumo.cabecalhos +
    resumo.indices,
  50
);

const pipeline = readFileSync(
  join(raiz, "src/services/importadores/pipeline/executarInterpretacaoAmostra.js"),
  "utf8"
);
assert.equal(pipeline.includes("catalogo_pecas"), false);
assert.equal(pipeline.includes("salvarCatalogo"), false);
assert.ok(pipeline.includes("catalogo_bloco_interpretacao"));
assert.ok(pipeline.includes("enviadoCatalogoPecas: false"));
assert.ok(pipeline.includes("fase1Alterada: false"));
assert.ok(pipeline.includes("TAMANHO_LOTE_VALIDACAO_FASE2"));
assert.equal(pipeline.includes("1972"), false);

const fase1 = readFileSync(
  join(raiz, "src/services/importadores/pipeline/executarExtracaoBruta.js"),
  "utf8"
);
assert.equal(fase1.includes("catalogo_bloco_interpretacao"), false);

console.log("OK interpretação Fase 2: lote de validação 50 e isolamento de catalogo_pecas.");

