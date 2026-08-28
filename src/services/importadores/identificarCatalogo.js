function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const REGRAS_CATALOGOS = [
  {
    fabricante: "Bosch",
    chave: "bosch",
    termos: [
      "bosch",
      "robert bosch",
    ],
  },
  {
    fabricante: "Magneti Marelli",
    chave: "magneti",
    termos: [
      "magneti marelli",
      "marelli",
      "magneti",
    ],
  },
  {
    fabricante: "Delphi",
    chave: "delphi",
    termos: [
      "delphi",
      "aptiv",
    ],
  },
  {
    fabricante: "Denso",
    chave: "denso",
    termos: [
      "denso",
    ],
  },
  {
    fabricante: "NGK",
    chave: "ngk",
    termos: [
      "ngk",
      "ntk",
    ],
  },
  {
    fabricante: "Fiat",
    chave: "fiat",
    termos: [
      "fiat",
      "mopar",
    ],
  },
  {
    fabricante: "Renault",
    chave: "renault",
    termos: [
      "renault",
      "dacia",
    ],
  },
  {
    fabricante: "GM",
    chave: "gm",
    termos: [
      "general motors",
      "chevrolet",
      "gm",
    ],
  },
  {
    fabricante: "Volkswagen",
    chave: "volkswagen",
    termos: [
      "volkswagen",
      "vw",
    ],
  },
  {
    fabricante: "Ford",
    chave: "ford",
    termos: [
      "ford",
      "motorcraft",
    ],
  },
  {
    fabricante: "Peugeot",
    chave: "peugeot",
    termos: [
      "peugeot",
    ],
  },
  {
    fabricante: "Citroën",
    chave: "citroen",
    termos: [
      "citroen",
      "citroën",
    ],
  },
  {
    fabricante: "Toyota",
    chave: "toyota",
    termos: [
      "toyota",
      "lexus",
    ],
  },
];

export function identificarCatalogo({
  nomeArquivo = "",
  texto = "",
  fabricanteInformado = "",
} = {}) {
  const fabricanteNormalizado =
    normalizarTexto(fabricanteInformado);

  if (fabricanteNormalizado) {
    const regraInformada =
      REGRAS_CATALOGOS.find((regra) => {
        return regra.termos.some(
          (termo) =>
            fabricanteNormalizado.includes(
              normalizarTexto(termo)
            )
        );
      });

    if (regraInformada) {
      return {
        identificado: true,
        fabricante:
          regraInformada.fabricante,
        chave:
          regraInformada.chave,
        origem:
          "fabricante informado",
      };
    }
  }

  const conteudoNormalizado =
    normalizarTexto(
      `${nomeArquivo} ${texto}`
    );

  const regraEncontrada =
    REGRAS_CATALOGOS.find((regra) => {
      return regra.termos.some(
        (termo) =>
          conteudoNormalizado.includes(
            normalizarTexto(termo)
          )
      );
    });

  if (!regraEncontrada) {
    return {
      identificado: false,
      fabricante: "",
      chave: "",
      origem: "",
    };
  }

  return {
    identificado: true,
    fabricante:
      regraEncontrada.fabricante,
    chave:
      regraEncontrada.chave,
    origem: nomeArquivo
      ? "nome do arquivo ou conteúdo"
      : "conteúdo do catálogo",
  };
}

export function listarFabricantesIdentificaveis() {
  return REGRAS_CATALOGOS.map(
    (regra) => ({
      fabricante:
        regra.fabricante,
      chave: regra.chave,
      termos: [...regra.termos],
    })
  );
}