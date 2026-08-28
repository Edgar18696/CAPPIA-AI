import { criarParserBase } from "./parserBase";
import { MODELOS_CITROEN } from "../configuracoes/modelos";

export const importarCitroen =
  criarParserBase({
    fabricante: "Citroën",

    origemCatalogo:
      "Catálogo Citroën",

    nomePeca:
      "Peça Original Citroën",

    montadoraFixa:
      "Citroën",

    prioridade: 1,

    confiabilidade: 95,

    motoresExtras:
      "TU3|TU5|EC5|THP|PURETECH|HDI",

    modelos: MODELOS_CITROEN,
  });