import { criarParserBase } from "./parserBase";
import { MODELOS_VW } from "../configuracoes/modelos";

export const importarVolkswagen =
  criarParserBase({
    fabricante: "Volkswagen",

    origemCatalogo:
      "Catálogo Volkswagen",

    nomePeca:
      "Peça Original Volkswagen",

    montadoraFixa:
      "Volkswagen",

    prioridade: 1,

    confiabilidade: 95,

    motoresExtras:
      "TSI|MPI|TDI|AP|EA111|EA211|EA888",

    modelos: MODELOS_VW,
  });