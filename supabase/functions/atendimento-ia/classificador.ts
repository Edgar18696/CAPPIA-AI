import type { Contexto } from "./contexto.ts";

export type TipoConsulta =
  | "GERAL"
  | "CODIGO"
  | "APLICACAO"
  | "EQUIVALENCIA"
  | "CHASSI"
  | "OEM";

export function classificarConsulta(contexto: Contexto): TipoConsulta {
  const tipo = contexto.tipoConsulta;

  if (!tipo) return "GERAL";

  if (tipo.consultaChassi) return "CHASSI";

  if (tipo.consultaEquivalencia) return "EQUIVALENCIA";

  if (tipo.consultaOEM) return "OEM";

  if (tipo.consultaAplicacao) return "APLICACAO";

  if (tipo.consultaCodigo) return "CODIGO";

  return "GERAL";
}