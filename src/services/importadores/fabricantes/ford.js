import { criarParserBase } from "./parserBase";
import { MODELOS_FORD } from "../configuracoes/modelos";

export const importarFord =
  criarParserBase({
    fabricante: "Ford",

    origemCatalogo:
      "Catálogo Ford",

    nomePeca:
      "Peça Original Ford",

    montadoraFixa:
      "Ford",

    prioridade: 1,

    confiabilidade: 95,

    motoresExtras:
      "ZETEC|DURATEC|ROCAM|SIGMA|ECOBOOST|POWERSTROKE",

    modelos: MODELOS_FORD,
  });