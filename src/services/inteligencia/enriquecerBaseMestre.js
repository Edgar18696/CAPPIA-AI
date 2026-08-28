import {
  consolidarBaseMestre,
} from "./consolidarBaseMestre";

import {
  aprenderRegistro,
} from "./aprenderRegistro";

export function enriquecerBaseMestre({
  baseExistente = null,
  novoRegistro = null,
}) {
  if (!novoRegistro) {
    return baseExistente;
  }

  if (!baseExistente) {
    return consolidarBaseMestre({
      registros: [novoRegistro],
    });
  }

  const baseAprendida =
    aprenderRegistro({
      baseAtual: baseExistente,
      novoRegistro,
    });

  return consolidarBaseMestre({
    registros: [
      baseAprendida,
      novoRegistro,
    ],
  });
}