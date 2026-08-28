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


/*
 * ============================================================
 * MONTADORAS
 * ============================================================
 */

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


/*
 * ============================================================
 * CÓDIGOS BOSCH
 * ============================================================
 */

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


/*
 * ============================================================
 * DATAS
 * ============================================================
 */

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

  /*
   * Catálogo contém veículos
   * principalmente de 1980 em diante.
   */

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

  /*
   * ========================================================
   * FORMATO DO CATÁLOGO BOSCH
   *
   * 09.94 → 12.96
   * 10.98 → 10.08
   * ========================================================
   */

  const faixaCurta =
    conteudo.match(
      /\b(?:0?[1-9]|1[0-2])[./-](\d{2})\s*(?:|→|A|ATÉ|ATE|-)\s*(?:0?[1-9]|1[0-2])[./-](\d{2})\b/i
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

  /*
   * Data inicial sem final:
   *
   * 10.17 →
   */

  const dataAberta =
    conteudo.match(
      /\b(?:0?[1-9]|1[0-2])[./-](\d{2})\s*(?:|→)\s*(?=$|\s)/i
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

  /*
   * Formato tradicional:
   *
   * 1994 até 1996
   */

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


/*
 * ============================================================
 * LIMPEZA DE DATAS
 * ============================================================
 */

function removerDatas(
  texto
) {
  return limparTexto(
    String(
      texto || ""
    )
      .replace(
        /\b(?:0?[1-9]|1[0-2])[./-]\d{2}\s*(?:|→|A|ATÉ|ATE|-)\s*(?:0?[1-9]|1[0-2])[./-]\d{2}\b/gi,
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


/*
 * ============================================================
 * REMOVER CÓDIGOS BOSCH
 * ============================================================
 */

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


/*
 * ============================================================
 * REMOVER INFORMAÇÕES POSTERIORES AO VEÍCULO
 * ============================================================
 */

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

  /*
   * Combustível aparece depois
   * da data no catálogo.
   */

  resultado =
    resultado.replace(
      /\b(?:Gasolina|Álcool|Alcool|Flex|Diesel|GNV|Álc\/Gas\/GNV|Alc\/Gas\/GNV)\b.*$/i,
      ""
    );

  /*
   * Remove códigos universais
   * Bosch que podem permanecer
   * depois da aplicação.
   */

  resultado =
    resultado.replace(
      /\bF\s*00H\s*L00\s*\d{3}\b.*$/i,
      ""
    );

  return limparTexto(
    resultado
  );
}


/*
 * ============================================================
 * MODELO E MOTOR
 * ============================================================
 */

function extrairModeloEMotor(
  texto
) {
  const conteudo =
    limparTexto(
      texto
    );

  /*
   * Procura cilindrada:
   *
   * 1.0
   * 1.4
   * 2.0
   * 4.1
   * 6.2
   */

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


/*
 * ============================================================
 * OBSERVAÇÃO
 * ============================================================
 */

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


/*
 * ============================================================
 * CABEÇALHOS / LIXO DO PDF
 * ============================================================
 */

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


/*
 * ============================================================
 * LINHA DE CONTINUAÇÃO
 * ============================================================
 *
 * Algumas aplicações Bosch ocupam duas linhas.
 *
 * Exemplo:
 *
 * 156 2.5 24V
 * AR32402 (...) 10.97 → 12.01 ... 0258...
 *
 * Nesse caso podemos usar a linha anterior.
 *
 * IMPORTANTE:
 *
 * Nunca usamos a linha seguinte.
 * ============================================================
 */

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
   * Linha anterior já possui código:
   * não pertence ao registro atual.
   */

  if (
    extrairCodigosBosch(
      linhaAnterior
    ).length
  ) {
    return false;
  }

  /*
   * Se a linha atual já começa claramente
   * com modelo + cilindrada, não precisamos
   * da anterior.
   */

  if (
    /^[A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 ./'-]*\s+\d[.,]\d\b/i.test(
      linhaAtual
    )
  ) {
    return false;
  }

  /*
   * Linha atual parece continuação:
   * motor/código do motor/data.
   */

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


/*
 * ============================================================
 * EQUIVALÊNCIAS
 * ============================================================
 *
 * REGRA DE SEGURANÇA:
 *
 * Só associa equivalência quando o código Bosch
 * e o código equivalente aparecem NA MESMA LINHA.
 *
 * Zero equivalência é melhor do que equivalência errada.
 * ============================================================
 */

function criarMapaEquivalencias(
  textoEquivalencias
) {
  const linhas =
    separarLinhas(
      textoEquivalencias
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

        /*
         * Outro código 0258 não entra
         * como equivalência automática.
         */

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


/*
 * ============================================================
 * ADICIONAR REGISTRO
 * ============================================================
 */

function adicionarRegistro(
  mapa,
  registro
) {
  /*
   * Segurança:
   * registro sem aplicação não entra.
   */

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


/*
 * ============================================================
 * PARSER BOSCH SONDAS
 * ============================================================
 */

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

    /*
     * ========================================================
     * MONTADORA
     * ========================================================
     */

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

      continue;
    }

    /*
     * ========================================================
     * OBSERVAÇÃO
     * ========================================================
     */

    if (
      textoPareceObservacao(
        linha
      )
    ) {
      observacaoAtual =
        linha;

      continue;
    }

    /*
     * ========================================================
     * CABEÇALHO
     * ========================================================
     */

    if (
      linhaEhCabecalho(
        linha
      )
    ) {
      continue;
    }

    /*
     * ========================================================
     * CÓDIGOS BOSCH NA LINHA ATUAL
     * ========================================================
     */

    const codigosBosch =
      extrairCodigosBosch(
        linha
      );

    if (
      !codigosBosch.length
    ) {
      continue;
    }

    /*
     * ========================================================
     * CONTEXTO SEGURO
     * ========================================================
     *
     * Nunca usa linha seguinte.
     *
     * Linha anterior somente quando
     * comprovadamente é continuação.
     * ========================================================
     */

    const linhaAnterior =
      linhas[
        indice - 1
      ] || "";

    let contexto =
      linha;

    if (
      podeUsarLinhaAnterior({
        linhaAnterior,
        linhaAtual:
          linha,
      })
    ) {
      contexto =
        `${linhaAnterior} ${linha}`;
    }

    /*
     * ========================================================
     * MONTADORA NA PRÓPRIA LINHA
     * ========================================================
     */

    const montadoraLinha =
      identificarMontadora(
        contexto
      );

    const montadoraRegistro =
      montadoraLinha ||
      montadoraAtual;

    /*
     * Sem montadora confirmada:
     * não grava.
     */

    if (
      !montadoraRegistro
    ) {
      console.warn(
        "⚠️ Bosch Sondas: registro ignorado sem montadora:",
        linha
      );

      continue;
    }

    /*
     * ========================================================
     * APLICAÇÃO
     * ========================================================
     */

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

    /*
     * Aplicação sem modelo é insegura.
     */

    if (
      !modelo
    ) {
      console.warn(
        "⚠️ Bosch Sondas: registro ignorado sem modelo:",
        linha
      );

      continue;
    }

    /*
     * ========================================================
     * CRIA REGISTROS
     * ========================================================
     */

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

    /*
     * Observação específica não deve
     * contaminar aplicações posteriores.
     */

    observacaoAtual =
      "";

    if (
      indice > 0 &&
      indice % 200 === 0
    ) {
      onProgresso?.(
        `🧠 Bosch Sondas V4: ${registros.size} registros estruturados...`
      );
    }
  }

  const resultado =
    Array.from(
      registros.values()
    );

  onProgresso?.(
    `✅ Bosch Sondas V4 encontrou ${resultado.length} registros seguros.`
  );

  return resultado;
}