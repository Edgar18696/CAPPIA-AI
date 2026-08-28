import { motorInteligenciaV2 } from "./motorInteligenciaV2";

export async function gerarAnuncioV2({
  codigo,
  descricao = "",
}) {
  const resultado =
    await motorInteligenciaV2({
      codigo,
      descricao,
    });

  const {
    diagnostico = {},
    confianca = {},
    baseMestre = null,
    inteligencia = null,
  } = resultado;

  const titulo = [
    diagnostico.peca,
    diagnostico.fabricante,
    diagnostico.codigoPrincipal,
  ]
    .filter(Boolean)
    .join(" ");

  const descricaoAnuncio = [
    `Peça: ${diagnostico.peca || "Peça automotiva"}`,
    `Código: ${
      diagnostico.codigoPrincipal ||
      resultado.codigoNormalizado ||
      codigo
    }`,
    `Fabricante: ${
      diagnostico.fabricante ||
      resultado.fabricante ||
      "Não informado"
    }`,

    diagnostico.familia
      ? `Família: ${diagnostico.familia}`
      : null,

    diagnostico.montadoras?.length
      ? `Montadoras: ${diagnostico.montadoras.join(", ")}`
      : null,

    diagnostico.modelos?.length
      ? `Modelos: ${diagnostico.modelos.join(", ")}`
      : null,

    diagnostico.motores?.length
      ? `Motores: ${diagnostico.motores.join(", ")}`
      : null,

    diagnostico.equivalentes?.length
      ? `Equivalências: ${diagnostico.equivalentes.join(", ")}`
      : null,

    "",
    `Confiança APPIA AI: ${
      Number(confianca.percentual) || 0
    }% (${confianca.nivel || "Baixa"})`,
  ]
    .filter(Boolean)
    .join("\n");

  const diagnosticoFinal = {
    ...diagnostico,
    baseMestre,
  };

  const auditoria = {
    aprovado:
      Number(confianca.percentual) >= 80,

    status:
      Number(confianca.percentual) >= 80
        ? "APROVADO"
        : "REVISAR",

    confiabilidade:
      Number(confianca.percentual) || 0,

    problemas: [],
  };

  return {
    ...resultado,

    codigo:
      diagnostico.codigoPrincipal ||
      resultado.codigoNormalizado ||
      codigo,

    titulo,

    descricao:
      descricaoAnuncio,

    diagnostico:
      diagnosticoFinal,

    auditoria,

    baseMestre,

    inteligencia,

    confianca,
  };
}