import { criarParserBase } from "./parserBase";
import { MODELOS_GM } from "../configuracoes/modelos";

export const importarGm =
  criarParserBase({
    fabricante: "GM",

    origemCatalogo:
      "Catálogo GM Chevrolet",

    nomePeca:
      "Peça Original GM Chevrolet",

    montadoraFixa:
      "Chevrolet",

    prioridade: 1,

    confiabilidade: 95,

    motoresExtras:
      "ECOTEC|FLEXPOWER|SPE4|SPE/4|VHC|VHC-E|MPFI",

    modelos: MODELOS_GM,
  });