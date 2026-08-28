import { configuracaoBosch } from "./bosch";

import {
  configuracaoMagnetiMarelli,
} from "./magnetiMarelli";

import {
  configuracaoRenault,
} from "./renault";

import {
  configuracaoNgk,
} from "./ngk";

const CONFIGURACOES = {
  bosch:
    configuracaoBosch,

  magneti_marelli:
    configuracaoMagnetiMarelli,

  magneti:
    configuracaoMagnetiMarelli,

  marelli:
    configuracaoMagnetiMarelli,

  "magneti marelli":
    configuracaoMagnetiMarelli,

  renault:
    configuracaoRenault,

  dacia:
    configuracaoRenault,

  motrio:
    configuracaoRenault,

  "renault motrio":
    configuracaoRenault,

  ngk:
    configuracaoNgk,

  ntk:
    configuracaoNgk,

  "ngk ntk":
    configuracaoNgk,
};

function normalizar(
  valor = ""
) {
  return String(
    valor || ""
  )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim();
}

export function obterConfiguracao(
  fabricante = ""
) {
  const chave =
    normalizar(
      fabricante
    );

  if (!chave) {
    return null;
  }

  if (
    CONFIGURACOES[
      chave
    ]
  ) {
    return CONFIGURACOES[
      chave
    ];
  }

  return (
    Object.values(
      CONFIGURACOES
    ).find(
      (
        configuracao
      ) => {
        const chaves =
          Array.isArray(
            configuracao
              ?.chaves
          )
            ? configuracao
                .chaves
            : [];

        return chaves.some(
          (item) =>
            normalizar(
              item
            ) === chave
        );
      }
    ) || null
  );
}

export {
  CONFIGURACOES,
};