import { criarParserBase } from "./parserBase";
import { MODELOS_FIAT } from "../configuracoes/modelos";

export const importarFiat =
  criarParserBase({
    fabricante: "Fiat",

    origemCatalogo:
      "Catálogo Fiat",

    nomePeca:
      "Peça Original Fiat",

    montadoraFixa: "Fiat",

    prioridade: 1,

    confiabilidade: 95,

    motoresExtras:
      "FIRE|ETORQ|E.TORQ|MULTIAIR",

    modelos: MODELOS_FIAT,
  });