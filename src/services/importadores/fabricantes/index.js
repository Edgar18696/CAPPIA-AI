import { importarBosch } from "./bosch";

import { importarMagnetiMarelli } from "./magnetiMarelli";

import importarRenault from "./renault";

import importarNgk from "./ngk";

const FABRICANTES = {
  bosch:
    importarBosch,

  magneti:
    importarMagnetiMarelli,

  marelli:
    importarMagnetiMarelli,

  "magneti marelli":
    importarMagnetiMarelli,

  magneti_marelli:
    importarMagnetiMarelli,

  renault:
    importarRenault,

  dacia:
    importarRenault,

  motrio:
    importarRenault,

  "renault motrio":
    importarRenault,

  ngk:
    importarNgk,

  ntk:
    importarNgk,

  "ngk ntk":
    importarNgk,
};

export function obterImportador(
  fabricante
) {
  const chave = String(
    fabricante || ""
  )
    .trim()
    .toLowerCase();

  return (
    FABRICANTES[chave] ||
    null
  );
}

export function registrarFabricante(
  chave,
  importador
) {
  FABRICANTES[
    String(chave)
      .trim()
      .toLowerCase()
  ] = importador;
}

export function listarFabricantes() {
  return Object.keys(
    FABRICANTES
  ).sort();
}

export default FABRICANTES;