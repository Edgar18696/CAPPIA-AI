import { criarParserBase } from "./parserBase";

export const importarDelphi =
  criarParserBase({
    fabricante: "Delphi",

    origemCatalogo:
      "Catálogo Delphi",

    nomePeca:
      "Autopeça Delphi",

    prioridade: 3,

    confiabilidade: 90,

    montadoras: [
      "FIAT",
      "RENAULT",
      "CHEVROLET",
      "GM",
      "VOLKSWAGEN",
      "VW",
      "FORD",
      "PEUGEOT",
      "CITROEN",
      "HONDA",
      "TOYOTA",
      "NISSAN",
      "HYUNDAI",
      "KIA",
      "MITSUBISHI",
      "MERCEDES",
      "BMW",
      "AUDI",
      "IVECO",
      "JEEP",
    ],
  });