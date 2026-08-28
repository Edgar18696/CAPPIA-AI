import { parserBoschSondas } from "./parsers/parserBoschSondas";
import { parserBoschBombas } from "./parsers/parserBoschBombas";
import { parserBoschBobinas } from "./parsers/parserBoschBobinas";
import { parserBoschVelas } from "./parsers/parserBoschVelas";
import { parserBoschDiesel } from "./parsers/parserBoschDiesel";
import { parserBoschSTH } from "./parsers/parserBoschSTH";
import { parserBoschReman } from "./parsers/parserBoschReman";
import { parserBoschPalhetas } from "./parsers/parserBoschPalhetas";
import { parserBoschFiltros } from "./parsers/parserBoschFiltros";
import { parserBoschAlternadores } from "./parsers/parserBoschAlternadores";
import { parserBoschABS } from "./parsers/parserBoschABS";
import { parserBoschBicosGasolina } from "./parsers/parserBoschBicosGasolina";
import { parserBoschBateriasMoto } from "./parsers/parserBoschBateriasMoto";
import { parserBoschSensores } from "./parsers/parserBoschSensores";
import { parserBoschFiltrosEquivalencias } from "./parsers/parserBoschFiltrosEquivalencias";

export const PARSERS_BOSCH = {
  sondas: parserBoschSondas,

  bombas: parserBoschBombas,

  sensores: parserBoschSensores,

  bobinas: parserBoschBobinas,

  velas: parserBoschVelas,

  diesel: parserBoschDiesel,

  diesel_sth: parserBoschSTH,

  diesel_remanufaturado:
    parserBoschReman,

  palhetas: parserBoschPalhetas,

  filtros: parserBoschFiltros,

  filtros_equivalencias:
    parserBoschFiltrosEquivalencias,

  alternadores:
    parserBoschAlternadores,

  alternador:
    parserBoschAlternadores,

  alternadores_pesados:
    parserBoschAlternadores,

  abs: parserBoschABS,

  bicos_gasolina:
    parserBoschBicosGasolina,

  gasolina_2025:
    parserBoschBicosGasolina,

  baterias_moto:
    parserBoschBateriasMoto,
};

export function obterParserBosch(
  tipoCatalogo = ""
) {
  return (
    PARSERS_BOSCH[tipoCatalogo] ||
    null
  );
}