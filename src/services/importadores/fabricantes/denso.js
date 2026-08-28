import { criarParserBase } from "./parserBase";

export const importarDenso =
  criarParserBase({
    fabricante: "Denso",

    origemCatalogo:
      "Catálogo Denso",

    nomePeca: "Autopeça Denso",

    prioridade: 4,

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
      "SUZUKI",
      "SUBARU",
    ],
  });