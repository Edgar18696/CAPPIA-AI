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
import { parserBoschGasolina2023 } from "./parsers/parserBoschGasolina2023";

export const PARSERS_BOSCH = {
  sondas: parserBoschSondas,
  bombas: parserBoschBombas,
  bobinas: parserBoschBobinas,
  velas: parserBoschVelas,
  diesel: parserBoschDiesel,
  diesel_sth: parserBoschSTH,
  diesel_remanufaturado: parserBoschReman,
  palhetas: parserBoschPalhetas,
  filtros: parserBoschFiltros,
  alternadores: parserBoschAlternadores,
  alternador: parserBoschAlternadores,
  abs: parserBoschABS,
  bicos_gasolina: parserBoschBicosGasolina,
  gasolina_2023: parserBoschGasolina2023,
  baterias_moto: parserBoschBateriasMoto,
};