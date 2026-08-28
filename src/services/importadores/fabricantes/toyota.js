import { criarParserBase } from "./parserBase";
import { MODELOS_TOYOTA } from "../configuracoes/modelos";

export const importarToyota =
  criarParserBase({
    fabricante: "Toyota",

    origemCatalogo:
      "Catálogo Toyota",

    nomePeca:
      "Peça Original Toyota",

    montadoraFixa:
      "Toyota",

    prioridade: 1,

    confiabilidade: 95,

    motoresExtras:
      "VVT-I|DUAL VVT-I|VVTIE|D-4D|D4D|HYBRID",

    modelos: MODELOS_TOYOTA,
  });