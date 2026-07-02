import type { Contexto } from "./contexto.ts";
import type { TipoConsulta } from "./classificador.ts";

export function montarContextoIA(
  contexto: Contexto,
  tipoConsulta: TipoConsulta,
  codigoBusca: string,
  resultadosCatalogo: any[],
  equivalencias: any[]
) {
  return {
    status:
      resultadosCatalogo.length > 0
        ? "ENCONTRADO"
        : "NAO_ENCONTRADO",

    tipoConsulta,

    pergunta: contexto.mensagemOriginal,

    codigoPesquisado: codigoBusca || null,

    marca: contexto.marca || null,

    modelo: contexto.modelo || null,

    ano: contexto.ano || null,

    motor: contexto.motor || null,

    chassiInformado: !!contexto.chassi,

    peca: contexto.peca || null,

    totalResultados: resultadosCatalogo.length,

    totalEquivalencias: equivalencias.length,

    orientacao:
      "Nunca invente aplicações, OEM ou equivalências. Utilize primeiro a Base de Conhecimento e depois seu conhecimento técnico."
  };
}