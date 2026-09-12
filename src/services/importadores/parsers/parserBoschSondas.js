function limparTexto(valor) {
  return String(valor || "")
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizar(valor) {
  return limparTexto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function limparCodigo(valor) {
  return String(valor || "")
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9.-]/gi, "")
    .toUpperCase()
    .trim();
}

function separarLinhas(texto) {
  return String(texto || "")
    .split(/\r?\n/)
    .map(limparTexto)
    .filter(Boolean);
}

function extrairPagina(linha) {
  const resultado = String(
    linha || ""
  ).match(
    /^---\s*PÁGINA\s+(\d+)\s*---$/i
  );

  return resultado
    ? Number(resultado[1])
    : null;
}

const MONTADORAS = [
  "ALFA ROMEO",
  "ASIA MOTORS",
  "ASIA",
  "AUDI",
  "BMW",
  "CHERY",
  "CHEVROLET",
  "CHRYSLER",
  "CITROEN",
  "CITROËN",
  "DAEWOO",
  "DODGE",
  "FIAT",
  "FORD",
  "HONDA",
  "HYUNDAI",
  "IVECO",
  "JEEP",
  "KIA",
  "LAND ROVER",
  "MERCEDES",
  "MERCEDES-BENZ",
  "MITSUBISHI",
  "NISSAN",
  "PEUGEOT",
  "PORSCHE",
  "RENAULT",
  "SUBARU",
  "SUZUKI",
  "TOYOTA",
  "VOLKSWAGEN",
  "VOLVO",
];

function identificarMontadora(linha) {
  const texto =
    normalizar(linha);

  return (
    MONTADORAS.find(
      (montadora) => {
        const nome =
          normalizar(
            montadora
          );

        return (
          texto === nome ||
          texto.startsWith(
            `${nome} `
          )
        );
      }
    ) || ""
  );
}

function linhaEhSomenteMontadora(
  linha
) {
  const texto =
    normalizar(linha);

  return MONTADORAS.some(
    (montadora) =>
      texto ===
      normalizar(
        montadora
      )
  );
}

function extrairCodigosBosch(
  linha
) {
  const encontrados =
    String(
      linha || ""
    ).match(
      /0\s*258\s*\d{3}\s*\d{3}/gi
    ) || [];

  return Array.from(
    new Set(
      encontrados
        .map(
          limparCodigo
        )
        .filter(
          (codigo) =>
            /^0258\d{6}$/.test(
              codigo
            )
        )
    )
  );
}

function extrairCodigosGerais(
  linha
) {
  const encontrados =
    String(
      linha || ""
    ).match(
      /\b[A-Z0-9][A-Z0-9./-]{3,29}\b/gi
    ) || [];

  return Array.from(
    new Set(
      encontrados
        .map(
          limparCodigo
        )
        .filter(
          (codigo) => {
            if (
              codigo.length < 5
            ) {
              return false;
            }

            if (
              !/\d/.test(
                codigo
              )
            ) {
              return false;
            }

            if (
              /^(19|20)\d{2}$/.test(
                codigo
              )
            ) {
              return false;
            }

            return true;
          }
        )
    )
  );
}

function converterAnoCurto(
  valor
) {
  const numero =
    Number(valor);

  if (
    !Number.isFinite(
      numero
    )
  ) {
    return null;
  }

  if (
    numero >= 70
  ) {
    return (
      1900 +
      numero
    );
  }

  return (
    2000 +
    numero
  );
}

function extrairAnos(
  texto
) {
  const conteudo =
    String(
      texto || ""
    );

  const faixaCurta =
    conteudo.match(
     /\b(?:0?[1-9]|1[0-2])[./-](\d{2})\s*(?:|→|�|□|A|ATÉ|ATE|-)\s*(?:0?[1-9]|1[0-2])[./-](\d{2})\b/i
    );

  if (
    faixaCurta
  ) {
    return {
      ano_inicio:
        converterAnoCurto(
          faixaCurta[1]
        ),

      ano_fim:
        converterAnoCurto(
          faixaCurta[2]
        ),
    };
  }

  const dataAberta =
    conteudo.match(
      /\b(?:0?[1-9]|1[0-2])[./-](\d{2})\s*(?:|→|�|□)\s*(?=$|\s)/i
    );

  if (
    dataAberta
  ) {
    return {
      ano_inicio:
        converterAnoCurto(
          dataAberta[1]
        ),

      ano_fim:
        null,
    };
  }

  const faixaLonga =
    conteudo.match(
      /\b((?:19|20)\d{2})\s*(?:A|ATÉ|ATE|-|\/|→|)\s*((?:19|20)\d{2})\b/i
    );

  if (
    faixaLonga
  ) {
    return {
      ano_inicio:
        Number(
          faixaLonga[1]
        ),

      ano_fim:
        Number(
          faixaLonga[2]
        ),
    };
  }

  const anos =
    conteudo.match(
      /\b(?:19|20)\d{2}\b/g
    ) || [];

  const numeros =
    anos
      .map(Number)
      .filter(
        (ano) =>
          ano >= 1900 &&
          ano <= 2100
      );

  if (
    !numeros.length
  ) {
    return {
      ano_inicio:
        null,

      ano_fim:
        null,
    };
  }

  return {
    ano_inicio:
      Math.min(
        ...numeros
      ),

    ano_fim:
      numeros.length >
      1
        ? Math.max(
            ...numeros
          )
        : Math.min(
            ...numeros
          ),
  };
}

function removerDatas(
  texto
) {
  return limparTexto(
    String(
      texto || ""
    )
      .replace(
  /\b(?:0?[1-9]|1[0-2])[./-]\d{2}\s*(?:|→|�|□|A|ATÉ|ATE|-)\s*(?:0?[1-9]|1[0-2])[./-]\d{2}\b/gi,
  " "
)
      .replace(
        /\b(?:0?[1-9]|1[0-2])[./-]\d{2}\s*(?:|→)/gi,
        " "
      )
      .replace(
        /\b(?:19|20)\d{2}\b/g,
        " "
      )
      .replace(
        /\b(?:A|ATÉ|ATE)\b/gi,
        " "
      )
  );
}

function removerCodigosBosch(
  texto,
  codigos
) {
  let resultado =
    String(
      texto || ""
    );

  for (
    const codigo
    of codigos
  ) {
    const grupo1 =
      codigo.slice(
        4,
        7
      );

    const grupo2 =
      codigo.slice(
        7,
        10
      );

    const formatos = [
      codigo,
      `0 258 ${grupo1} ${grupo2}`,
      `0 258${grupo1}${grupo2}`,
      `0258 ${grupo1} ${grupo2}`,
    ];

    for (
      const formato
      of formatos
    ) {
      resultado =
        resultado.replaceAll(
          formato,
          " "
        );
    }
  }

  return limparTexto(
    resultado
  );
}

function limparLinhaAplicacao(
  texto,
  codigos
) {
  let resultado =
    removerCodigosBosch(
      texto,
      codigos
    );

  resultado =
    removerDatas(
      resultado
    );

  resultado =
    resultado.replace(
      /\b(?:Gasolina|Álcool|Alcool|Flex|Diesel|GNV|Álc\/Gas\/GNV|Alc\/Gas\/GNV)\b.*$/i,
      ""
    );

  resultado =
    resultado.replace(
      /\bF\s*00H\s*L00\s*\d{3}\b.*$/i,
      ""
    );

  return limparTexto(
    resultado
  );
}

function extrairModeloEMotor(
  texto
) {
  const conteudo =
    limparTexto(
      texto
    );

  const inicioMotor =
    conteudo.search(
      /\b\d(?:[.,]\d)\b/i
    );

  if (
    inicioMotor < 0
  ) {
    return {
      modelo:
        conteudo,

      motor:
        "",
    };
  }

  const modelo =
    limparTexto(
      conteudo.slice(
        0,
        inicioMotor
      )
    );

  const motor =
    limparTexto(
      conteudo.slice(
        inicioMotor
      )
    );

  return {
    modelo,
    motor,
  };
}

function textoPareceObservacao(
  linha
) {
  const texto =
    normalizar(
      linha
    );

  return (
    texto.startsWith(
      "("
    ) ||

    texto.includes(
      "PARA VEICULOS"
    ) ||

    texto.includes(
      "PARA VEÍCULOS"
    ) ||

    texto.includes(
      "FILEIRA DE CILINDROS"
    ) ||

    texto.includes(
      "ACELERADOR ELETRONICO"
    ) ||

    texto.includes(
      "ACELERADOR ELETRÔNICO"
    )
  );
}

function linhaEhCabecalho(
  linha
) {
  const texto =
    normalizar(
      linha
    );

  if (
    !texto
  ) {
    return true;
  }

  const proibidos = [
    "VEICULO MOTOR",
    "VEÍCULO MOTOR",
    "DATA DE APLICACAO",
    "DATA DE APLICAÇÃO",
    "COMBUSTIVEL",
    "COMBUSTÍVEL",
    "PRE CATALISADOR",
    "PRÉ CATALISADOR",
    "POS CATALISADOR",
    "PÓS CATALISADOR",
    "UNIVERSAL PRE",
    "UNIVERSAL PRÉ",
    "UNIVERSAL POS",
    "UNIVERSAL PÓS",
    "AUTOPECAS BOSCH",
    "AUTOPEÇAS BOSCH",
    "TABELA DE APLICACAO",
    "TABELA DE APLICAÇÃO",
    "SONDAS LAMBDA",
  ];

  return proibidos.some(
    (proibido) =>
      texto.includes(
        proibido
      )
  );
}

function podeUsarLinhaAnterior({
  linhaAnterior,
  linhaAtual,
}) {
  if (
    !linhaAnterior ||
    !linhaAtual
  ) {
    return false;
  }

  if (
    linhaEhCabecalho(
      linhaAnterior
    )
  ) {
    return false;
  }

  if (
    linhaEhSomenteMontadora(
      linhaAnterior
    )
  ) {
    return false;
  }

  if (
    textoPareceObservacao(
      linhaAnterior
    )
  ) {
    return false;
  }

  if (
    extrairPagina(
      linhaAnterior
    )
  ) {
    return false;
  }

  /*
   * SEGURANÇA:
   * se a linha anterior já possui código,
   * ela pertence a outro registro.
   */
  if (
    extrairCodigosBosch(
      linhaAnterior
    ).length
  ) {
    return false;
  }

  if (
    /^[A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 ./'-]*\s+\d[.,]\d\b/i.test(
      linhaAtual
    )
  ) {
    return false;
  }

  /*
   * O PDF Bosch também pode quebrar assim:
   *
   * Astra 2.0 MPFI C20NE ... 09.94 → 12.96 Gasolina
   * 0 258 003 300 0 258 986 502
   *
   * Nesse caso a linha atual começa somente
   * com o código Bosch.
   */
  const atualComecaComCodigoBosch =
    /^0\s*258\s*\d{3}\s*\d{3}/i.test(
      linhaAtual
    );

  const anteriorTemCilindrada =
    /\b\d[.,]\d\b/i.test(
      linhaAnterior
    );

  if (
    atualComecaComCodigoBosch &&
    anteriorTemCilindrada
  ) {
    return true;
  }

  const pareceContinuacao =
    (
      /^[A-Z]{1,4}\s*\d/i.test(
        linhaAtual
      ) ||

      /^\d[.,]\d\b/i.test(
        linhaAtual
      ) ||

      /\b(?:0?[1-9]|1[0-2])[./-]\d{2}\s*(?:|→)/.test(
        linhaAtual
      )
    );

  return pareceContinuacao;
}

function criarMapaEquivalencias(
  textoEquivalencias
) {
  const linhas =
    separarLinhas(
      textoEquivalencias
    );
/*
 * DIAGNÓSTICO TEMPORÁRIO — ASTRA / 0258003300
 */
linhas.forEach(
  (linha, indice) => {
    const trecho = [
      linhas[indice - 3] || "",
      linhas[indice - 2] || "",
      linhas[indice - 1] || "",
      linha || "",
      linhas[indice + 1] || "",
      linhas[indice + 2] || "",
      linhas[indice + 3] || "",
    ];

    const texto =
      trecho.join(" | ");

    if (
  String(linha || "")
    .toUpperCase()
    .includes("ASTRA")
)
    {
      console.log(
        [
          "🚗 ASTRA BOSCH 0258003300",
          `ÍNDICE: ${indice}`,
          ...trecho.map(
            (item, posicao) =>
              `${posicao - 3}: ${item}`
          ),
          "============================",
        ].join("\n")
      );
    }
  }
);
  const mapa =
    new Map();

  for (
    const linha
    of linhas
  ) {
    if (
      extrairPagina(
        linha
      )
    ) {
      continue;
    }

    const codigosBosch =
      extrairCodigosBosch(
        linha
      );

    if (
      !codigosBosch.length
    ) {
      continue;
    }

    const codigosLinha =
      extrairCodigosGerais(
        linha
      );

    for (
      const codigoBosch
      of codigosBosch
    ) {
      if (
        !mapa.has(
          codigoBosch
        )
      ) {
        mapa.set(
          codigoBosch,
          new Set()
        );
      }

      const conjunto =
        mapa.get(
          codigoBosch
        );

      for (
        const codigo
        of codigosLinha
      ) {
        if (
          codigo ===
          codigoBosch
        ) {
          continue;
        }

        if (
          /^0258\d{6}$/.test(
            codigo
          )
        ) {
          continue;
        }

        conjunto.add(
          codigo
        );
      }
    }
  }

  return mapa;
}

function juntarEquivalentes(
  mapaEquivalencias,
  codigo
) {
  return Array.from(
    mapaEquivalencias.get(
      codigo
    ) || []
  ).join(
    ", "
  );
}

function adicionarRegistro(
  mapa,
  registro
) {
  if (
    !registro.codigo_oem ||
    !registro.montadora ||
    !registro.modelo
  ) {
    return;
  }

  const chave = [
    registro.codigo_oem,
    registro.montadora,
    registro.modelo,
    registro.motor,
    registro.ano_inicio,
    registro.ano_fim,
  ]
    .map(
      normalizar
    )
    .join(
      "|"
    );

  if (
    !mapa.has(
      chave
    )
  ) {
    mapa.set(
      chave,
      registro
    );

    return;
  }

  const existente =
    mapa.get(
      chave
    );

  const equivalentes =
    new Set(
      [
        existente
          .codigo_equivalente,

        registro
          .codigo_equivalente,
      ]
        .join(",")
        .split(
          /[,;|/]+/
        )
        .map(
          limparCodigo
        )
        .filter(
          Boolean
        )
    );

  existente.codigo_equivalente =
    Array.from(
      equivalentes
    ).join(
      ", "
    );

  if (
    !existente.motor &&
    registro.motor
  ) {
    existente.motor =
      registro.motor;
  }

  if (
    !existente.ano_inicio &&
    registro.ano_inicio
  ) {
    existente.ano_inicio =
      registro.ano_inicio;
  }

  if (
    !existente.ano_fim &&
    registro.ano_fim
  ) {
    existente.ano_fim =
      registro.ano_fim;
  }
}

export async function parserBoschSondas({
  textoAplicacoes = "",
  textoEquivalencias = "",
  nomeArquivo = "",
  onProgresso,
}) {
  const linhas =
    separarLinhas(
      textoAplicacoes
    );

  const mapaEquivalencias =
    criarMapaEquivalencias(
      textoEquivalencias
    );

  const registros =
    new Map();

  let paginaAtual =
    null;

  let montadoraAtual =
    "";

  let observacaoAtual =
    "";

  /*
   * Guarda aplicação que foi separada
   * da linha onde aparece o código.
   */
  let aplicacaoPendente =
    "";
let ultimaAplicacaoVeiculo =
  "";
  for (
    let indice = 0;
    indice < linhas.length;
    indice += 1
  ) {
    const linha =
      linhas[
        indice
      ];

    const pagina =
      extrairPagina(
        linha
      );

    if (
      pagina
    ) {
      paginaAtual =
        pagina;

      continue;
    }

    const montadora =
      identificarMontadora(
        linha
      );

    if (
      montadora &&
      linhaEhSomenteMontadora(
        linha
      )
    ) {
      montadoraAtual =
        montadora;

      observacaoAtual =
        "";

      aplicacaoPendente =
        "";

      continue;
    }

    if (
      textoPareceObservacao(
        linha
      )
    ) {
      observacaoAtual =
        linha;

      continue;
    }

    if (
      linhaEhCabecalho(
        linha
      )
    ) {
      continue;
    }

    const codigosBosch =
      extrairCodigosBosch(
        linha
      );

    /*
     * ======================================================
     * LINHA SEM CÓDIGO
     * ======================================================
     *
     * O PDF pode colocar:
     *
     * Astra 2.0 MPFI C20NE ...
     * 09.94 → 12.96 ...
     * 0 258 003 300
     *
     * ou:
     *
     * Astra 2.0 ... 09.94 → 12.96
     * 0 258 003 300
     */
    if (
      !codigosBosch.length
    ) {
      const possuiCilindrada =
        /\b\d[.,]\d\b/i.test(
          linha
        );

      if (
        possuiCilindrada
      ) {
        aplicacaoPendente =
          linha;
      }

      continue;
    }

    const linhaAnterior =
      linhas[
        indice - 1
      ] || "";

    let contexto =
      linha;

    const linhaAtualComecaComData =
  /^(?:0?[1-9]|1[0-2])[./-]\d{2}\s*(?:|→|�|□)/i.test(
    linha
  );

    const linhaAtualComecaComCodigoBosch =
      /^0\s*258\s*\d{3}\s*\d{3}/i.test(
        linha
      );

    /*
     * ======================================================
     * CABEÇALHO PENDENTE
     * ======================================================
     *
     * Aceita:
     *
     * veículo
     * data + código
     *
     * e:
     *
     * veículo + data
     * código
     */
    if (
  aplicacaoPendente &&
  (
    linhaAtualComecaComData ||
    linhaAtualComecaComCodigoBosch
  )
) {
  contexto =
    `${aplicacaoPendente} ${linha}`;

  aplicacaoPendente =
    "";
} else if (
  linhaAtualComecaComData &&
  ultimaAplicacaoVeiculo
) {
  contexto =
    `${ultimaAplicacaoVeiculo} ${linha}`;
} else if (
  podeUsarLinhaAnterior({
    linhaAnterior,
    linhaAtual:
      linha,
  })
) {
  contexto =
    `${linhaAnterior} ${linha}`;
}

    if (
      !linhaAtualComecaComData &&
      !linhaAtualComecaComCodigoBosch
    ) {
      aplicacaoPendente =
        "";
    }

    const montadoraLinha =
      identificarMontadora(
        contexto
      );

    const montadoraRegistro =
      montadoraLinha ||
      montadoraAtual;

    if (
      !montadoraRegistro
    ) {
      console.warn(
        "⚠️ Bosch Sondas: registro ignorado sem montadora:",
        linha
      );

      continue;
    }

    const textoAplicacao =
      limparLinhaAplicacao(
        contexto,
        codigosBosch
      );

    const anos =
      extrairAnos(
        contexto
      );

    const {
      modelo,
      motor,
    } =
      extrairModeloEMotor(
        textoAplicacao
      );
if (
  modelo &&
  motor &&
  !linhaAtualComecaComData
) {
  ultimaAplicacaoVeiculo =
    `${modelo} ${motor}`;
}

    if (
      !modelo
    ) {
      console.warn(
        "⚠️ Bosch Sondas: registro ignorado sem modelo:",
        linha
      );

      continue;
    }

    for (
      const codigo
      of codigosBosch
    ) {
      const registro = {
        peca:
          "Sonda Lambda",

        codigo_oem:
          codigo,

        codigo_equivalente:
          juntarEquivalentes(
            mapaEquivalencias,
            codigo
          ),

        fabricante:
          "Bosch",

        origem_catalogo:
          nomeArquivo ||
          "Catálogo Bosch Sondas 2020",

        montadora:
          montadoraRegistro,

        modelo:
          modelo,

        motor:
          motor,

        ano_inicio:
          anos.ano_inicio,

        ano_fim:
          anos.ano_fim,

        observacao:
          [
            linha,
            observacaoAtual,
          ]
            .filter(
              Boolean
            )
            .join(
              " | "
            ),

        pagina_catalogo:
          paginaAtual,

        ativo:
          true,

        prioridade:
          1,

        confiabilidade:
          95,
      };

      adicionarRegistro(
        registros,
        registro
      );
    }

    observacaoAtual =
      "";

    if (
      indice > 0 &&
      indice % 200 === 0
    ) {
      onProgresso?.(
        `🧠 Bosch Sondas V6: ${registros.size} registros estruturados...`
      );
    }
  }

  const resultado =
    Array.from(
      registros.values()
    );

  onProgresso?.(
    `✅ Bosch Sondas V6 encontrou ${resultado.length} registros seguros.`
  );

  return resultado;
}