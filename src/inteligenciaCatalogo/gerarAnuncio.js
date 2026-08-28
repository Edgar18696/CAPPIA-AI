export async function gerarAnuncioInteligente(
  codigoDigitado
) {
  const codigo =
    manterCodigoComoTexto(
      normalizarCodigo(
        codigoDigitado
      )
    );

  if (!codigo) {
    return {
      sucesso: false,
      mensagem:
        "Informe um código.",
    };
  }

  const resultado =
    await motorInteligencia(
      codigo
    );

  if (!resultado) {
    return {
      sucesso: false,
      mensagem:
        "Código não encontrado.",
    };
  }

  let {
    codigoPrincipal,
    registros = [],
    equivalentes = [],
    diagnostico = {},
    auditoria = {},
    inteligencia = {},
  } = resultado;

  if (
    registros.length === 0
  ) {
    return {
      sucesso: false,
      mensagem:
        "Nenhuma aplicação encontrada.",
    };
  }

  const registroPrincipal =
    registros.find((item) =>
      prioridadeFontes.some(
        (fonte) =>
          normalizarFonte(
            item.fabricante ||
              item.fonte ||
              item.origem_catalogo ||
              ""
          ).includes(fonte)
      )
    ) || registros[0];

  codigoPrincipal =
    manterCodigoComoTexto(
      codigoPrincipal ||
        registroPrincipal.codigo_oem ||
        registroPrincipal.codigo_equivalente ||
        codigo
    );

  const registrosOrdenados = [
    registroPrincipal,
    ...registros.filter(
      (item) =>
        item !==
        registroPrincipal
    ),
  ];

  const diagnosticoFinal = {
    ...diagnostico,

    codigoPrincipal,

    fabricantePrincipal:
      registroPrincipal.fabricante ||
      diagnostico.fabricante ||
      "",

    origemCatalogo:
      registroPrincipal.origem_catalogo ||
      diagnostico.origemCatalogo,

    arquivoCatalogo:
      registroPrincipal.origem_catalogo ||
      diagnostico.arquivoCatalogo,

    paginaCatalogo:
      registroPrincipal.pagina_catalogo ||
      diagnostico.paginaCatalogo,

    confiabilidade:
      registroPrincipal.confiabilidade ??
      diagnostico.confiabilidade,
  };

  return {
    sucesso: true,

    codigo: codigoPrincipal,

    oem: codigoPrincipal,

    registros:
      registrosOrdenados,

    equivalentes,

    diagnostico:
      diagnosticoFinal,

    auditoria,

    inteligencia,

    titulo:
      montarTitulo(
        registrosOrdenados,
        codigoPrincipal
      ),

    descricao:
      montarDescricao(
        registrosOrdenados,
        codigoPrincipal
      ),

    pecaEncontrada: {
      ...registroPrincipal,

      codigoPrincipal,

      registros:
        registrosOrdenados,

      equivalentes,

      diagnostico:
        diagnosticoFinal,

      auditoria,

      inteligencia,
    },
  };
}