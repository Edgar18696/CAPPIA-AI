import { criarParserBase } from "./parserBase";
import { MODELOS_PEUGEOT } from "../configuracoes/modelos";

export const importarPeugeot =
  criarParserBase({
    fabricante: "Peugeot",

    origemCatalogo:
      "Catálogo Peugeot",

    nomePeca:
      "Peça Original Peugeot",

    montadoraFixa:
      "Peugeot",

    prioridade: 1,

    confiabilidade: 95,

    motoresExtras:
      "TU3|TU5|EC5|THP|PURETECH|HDI",

    modelos: MODELOS_PEUGEOT,
  });