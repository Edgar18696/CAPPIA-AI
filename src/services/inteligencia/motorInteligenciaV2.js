import { normalizarCodigo } from "./normalizarCodigo";
import { identificarFabricante } from "./identificarFabricante";
import { identificarFamilia } from "./identificarFamilia";
import { motorInteligenciaPeca } from "./motorInteligenciaPeca";
import { calcularConfianca } from "./calcularConfianca";
import { montarDiagnosticoV2 } from "./montarDiagnosticoV2";
import { montarBaseMestreV2 } from "./montarBaseMestreV2";
import {
  buscarBaseMestre,
  salvarBaseMestre,
} from "./baseMestreService";

export async function motorInteligenciaV2({
  codigo,
  descricao = "",
}) {
  const codigoNormalizado =
    normalizarCodigo(codigo);
const baseExistente =
  await buscarBaseMestre(
    codigoNormalizado
  );

if (baseExistente) {
  console.log(
    "📚 Base Mestre encontrada:",
    codigoNormalizado
  );

  return {
    codigoOriginal: codigo,

    codigoNormalizado,

    fabricante:
      baseExistente.fabricante,

    familia:
      baseExistente.familia,

    inteligencia: {
      registros:
        baseExistente.aplicacoes || [],

      equivalentes:
        baseExistente.equivalentes || [],
    },

    confianca:
      baseExistente.confianca || {
        percentual: 100,
        nivel: "Muito alta",
      },

    diagnostico:
      baseExistente,

    baseMestre:
      baseExistente,
  };
}
  const fabricante =
    identificarFabricante({
      codigo: codigoNormalizado,
      descricao,
    });

  const familia =
    identificarFamilia({
      codigo: codigoNormalizado,
      descricao,
    });

  const inteligencia =
    await motorInteligenciaPeca({
      codigo: codigoNormalizado,
      descricao,
    });

  const registros =
    inteligencia?.registros || [];

  const equivalentes =
    inteligencia?.equivalentes || [];

  const registroPrincipal =
    registros[0] || {};

  const confianca =
    calcularConfianca({
      codigoPesquisado:
        codigoNormalizado,
      registroPrincipal,
      registros,
      equivalentes,
      fabricante,
      familia,
    });

  const diagnostico =
    montarDiagnosticoV2({
      codigoOriginal: codigo,
      codigoNormalizado,
      fabricante,
      familia,
      inteligencia,
      confianca,
    });

  const baseMestre =
    montarBaseMestreV2({
      codigoOriginal: codigo,
      codigoNormalizado,
      fabricante,
      familia,
      inteligencia,
      diagnostico,
      confianca,
    });
await salvarBaseMestre(
  baseMestre
);
  return {
    codigoOriginal: codigo,
    codigoNormalizado,

    fabricante,
    familia,

    inteligencia,

    confianca,

    diagnostico,

    baseMestre,
  };
}