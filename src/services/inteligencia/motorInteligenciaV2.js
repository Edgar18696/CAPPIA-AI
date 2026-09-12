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
import { buscarAplicacoes } from "../../inteligenciaCatalogo/buscarAplicacoes";

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

 const inteligenciaPeca =
  await motorInteligenciaPeca({
    codigo: codigoNormalizado,
    descricao,
  });

const registros =
  await buscarAplicacoes(
    codigoNormalizado
  );

const inteligencia = {
  ...inteligenciaPeca,

  registros,

  aplicacoes:
    registros,

  equivalentes:
    inteligenciaPeca?.equivalentes ||
    [],
};

const equivalentes =
  inteligencia.equivalentes;
if (
  registros.length === 0 &&
  baseExistente
) {
  console.log(
    "📚 Nenhum registro detalhado encontrado. Usando Base Mestre como fallback."
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