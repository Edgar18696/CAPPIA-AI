function textoSeguro(valor) {
  return String(valor ?? "").trim();
}

function numeroSeguro(valor) {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

function listaSegura(valor) {
  return Array.isArray(valor)
    ? valor
    : [];
}

export function especialistaTecnico({
  codigo = "",
  oem = "",
  diagnostico = null,
  auditoria = null,
  catalogo = [],
  pecaEncontrada = null,
} = {}) {
  const codigoFinal =
    textoSeguro(
      diagnostico?.codigoPrincipal ||
      pecaEncontrada?.codigo_oem ||
      codigo ||
      oem
    );

  const peca =
    textoSeguro(
      diagnostico?.peca ||
      pecaEncontrada?.peca
    ) || "Peça automotiva";

  const fabricante =
    textoSeguro(
      diagnostico?.fabricante ||
      pecaEncontrada?.fabricante
    ) || "Não informado";

  const familia =
    textoSeguro(
      diagnostico?.familia ||
      pecaEncontrada?.familia
    );

  const categoria =
    textoSeguro(
      diagnostico?.categoria ||
      pecaEncontrada?.categoria
    );

  const aplicacoesCatalogo =
    listaSegura(catalogo);

  const aplicacoesPeca =
    listaSegura(
      pecaEncontrada?.aplicacoes
    );

  const totalAplicacoes =
    aplicacoesCatalogo.length ||
    aplicacoesPeca.length ||
    numeroSeguro(
      diagnostico?.totalAplicacoes
    );

  const equivalentes =
    [
      ...listaSegura(
        pecaEncontrada?.equivalentes
      ),

      ...listaSegura(
        diagnostico?.equivalentes
      ),
    ]
      .map((item) => {
        if (
          typeof item === "string"
        ) {
          return textoSeguro(item);
        }

        return textoSeguro(
          item?.codigo ||
          item?.codigo_oem ||
          item?.codigo_equivalente
        );
      })
      .filter(Boolean);

  const equivalentesUnicos =
    [...new Set(equivalentes)];

  const fonte =
    textoSeguro(
      diagnostico?.arquivoCatalogo ||
      pecaEncontrada?.origem_catalogo
    ) || "Base APPIA";

  const pagina =
    diagnostico?.paginaCatalogo ||
    pecaEncontrada?.pagina_catalogo ||
    "-";

  const confiabilidade =
    numeroSeguro(
      auditoria?.confiabilidade ||
      pecaEncontrada?.confiabilidade ||
      diagnostico?.confiabilidade
    );

  const auditoriaAprovada =
    auditoria?.aprovado === true;

  const problemas =
    listaSegura(
      auditoria?.problemas
    )
      .map(textoSeguro)
      .filter(Boolean);

  const alertas = [];

  if (!codigoFinal) {
    alertas.push(
      "Código principal não identificado."
    );
  }

  if (
    !diagnostico &&
    !pecaEncontrada
  ) {
    alertas.push(
      "Diagnóstico técnico ainda não disponível."
    );
  }

  if (
    totalAplicacoes === 0
  ) {
    alertas.push(
      "Nenhuma aplicação confirmada."
    );
  }

  if (
    auditoria &&
    !auditoriaAprovada
  ) {
    alertas.push(
      "Auditoria técnica recomenda revisão."
    );
  }

  problemas.forEach(
    (problema) => {
      if (
        !alertas.includes(
          problema
        )
      ) {
        alertas.push(
          problema
        );
      }
    }
  );

  let status =
    "AGUARDANDO";

  if (
    codigoFinal &&
    totalAplicacoes > 0 &&
    auditoriaAprovada
  ) {
    status =
      "APROVADO";
  } else if (
    diagnostico ||
    pecaEncontrada
  ) {
    status =
      "REVISAR";
  }

  let recomendacao =
    "Faça a consulta técnica da peça antes de publicar.";

  if (
    status === "APROVADO"
  ) {
    recomendacao =
      `Peça identificada como ${peca}. ` +
      `${totalAplicacoes} aplicação(ões) encontrada(s). ` +
      "A análise técnica está apta para seguir.";
  }

  if (
    status === "REVISAR"
  ) {
    recomendacao =
      "Revise código, aplicações e auditoria antes da publicação.";
  }

  return {
    especialista:
      "tecnico",

    status,

    codigo:
      codigoFinal,

    peca,

    fabricante,

    familia,

    categoria,

    equivalentes:
      equivalentesUnicos,

    totalEquivalentes:
      equivalentesUnicos.length,

    totalAplicacoes,

    aplicacoes:
      aplicacoesCatalogo.length
        ? aplicacoesCatalogo
        : aplicacoesPeca,

    fonte,

    pagina,

    confiabilidade,

    auditoriaAprovada,

    alertas,

    recomendacao,

    resumo: {
      possuiCodigo:
        Boolean(codigoFinal),

      possuiDiagnostico:
        Boolean(
          diagnostico ||
          pecaEncontrada
        ),

      possuiAplicacoes:
        totalAplicacoes > 0,

      possuiEquivalentes:
        equivalentesUnicos.length >
        0,

      auditoriaAprovada,
    },
  };
}

export default especialistaTecnico;