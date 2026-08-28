/*
 * ============================================================
 * APPIA AI
 * PARSER NGK / NTK - SENSORES
 * ============================================================
 *
 * Catálogo:
 * CATALOGO_SENSORES-1 NGK / NTK
 *
 * Famílias:
 *
 * FLN  = Sensor de nível de combustível
 * CTN  = Sensor de temperatura
 * CRN  = Sensor de rotação
 * CRC  = Sensor de rotação
 * AWN  = Sensor ABS
 * VSN  = Sensor de velocidade
 * THN  = Sensor TPS / posição da borboleta
 * APN  = Sensor MAP
 * APT  = Sensor MAP
 *
 * Estrutura:
 *
 * VEÍCULO
 * MOTOR/VERSÃO
 * COMBUSTÍVEL
 * ANO
 * POSIÇÃO (quando ABS)
 * NTK
 *
 * ============================================================
 */

function limparTexto(
  valor = ""
) {
  return String(
    valor || ""
  )
    .replace(
      /\u00a0/g,
      " "
    )
    .replace(
      /\t+/g,
      " "
    )
    .replace(
      /[ ]{2,}/g,
      " "
    )
    .trim();
}

function normalizar(
  valor = ""
) {
  return String(
    valor || ""
  )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function normalizarCodigo(
  valor = ""
) {
  return String(
    valor || ""
  )
    .toUpperCase()
    .replace(
      /\s+/g,
      ""
    )
    .trim();
}

function transformarEmLinhas(
  texto = ""
) {
  return String(
    texto || ""
  )
    .split(
      /\r?\n/
    )
    .map(
      limparTexto
    )
    .filter(Boolean);
}

/*
 * ============================================================
 * CÓDIGOS NTK
 * ============================================================
 */

const REGEX_CODIGO_NTK =
  /\b(?:FLN\d?|CTN\d?|CRN\d?|CRC\d?|AWN\d?|VSN\d?|THN\d?|APN\d?|APT\d?)-[A-Z]\d{3}\b/gi;

function extrairCodigos(
  texto = ""
) {
  const encontrados =
    String(
      texto || ""
    )
      .toUpperCase()
      .match(
        REGEX_CODIGO_NTK
      ) ||
    [];

  return [
    ...new Set(
      encontrados.map(
        normalizarCodigo
      )
    ),
  ];
}

/*
 * ============================================================
 * FAMÍLIA DA PEÇA
 * ============================================================
 */

function identificarFamilia(
  codigo = ""
) {
  const valor =
    normalizarCodigo(
      codigo
    );

  if (
    valor.startsWith(
      "FLN"
    )
  ) {
    return {
      peca:
        "Sensor de nível de combustível",

      tipo:
        "sensor_nivel_combustivel",
    };
  }

  if (
    valor.startsWith(
      "CTN"
    )
  ) {
    return {
      peca:
        "Sensor de temperatura do líquido de arrefecimento",

      tipo:
        "sensor_temperatura",
    };
  }

  if (
    valor.startsWith(
      "CRN"
    ) ||
    valor.startsWith(
      "CRC"
    )
  ) {
    return {
      peca:
        "Sensor de rotação",

      tipo:
        "sensor_rotacao",
    };
  }

  if (
    valor.startsWith(
      "AWN"
    )
  ) {
    return {
      peca:
        "Sensor ABS",

      tipo:
        "sensor_abs",
    };
  }

  if (
    valor.startsWith(
      "VSN"
    )
  ) {
    return {
      peca:
        "Sensor de velocidade",

      tipo:
        "sensor_velocidade",
    };
  }

  if (
    valor.startsWith(
      "THN"
    )
  ) {
    return {
      peca:
        "Sensor de posição da borboleta TPS",

      tipo:
        "sensor_tps",
    };
  }

  if (
    valor.startsWith(
      "APN"
    ) ||
    valor.startsWith(
      "APT"
    )
  ) {
    return {
      peca:
        "Sensor MAP",

      tipo:
        "sensor_map",
    };
  }

  return {
    peca:
      "Sensor automotivo",

    tipo:
      "sensor",
  };
}

/*
 * ============================================================
 * MONTADORAS
 * ============================================================
 */

const MAPA_MONTADORAS = {
  "ALFA ROMEO":
    "Alfa Romeo",

  "ASIA MOTORS":
    "Asia Motors",

  AUDI:
    "Audi",

  BMW:
    "BMW",

  CHEVROLET:
    "Chevrolet",

  "CHEVROLET (GM)":
    "Chevrolet",

  GM:
    "Chevrolet",

  CITROEN:
    "Citroën",

  "CITROËN":
    "Citroën",

  FIAT:
    "Fiat",

  FERRARI:
    "Ferrari",

  FORD:
    "Ford",

  HONDA:
    "Honda",

  HYUNDAI:
    "Hyundai",

  KIA:
    "Kia",

  "KIA MOTORS":
    "Kia",

  MERCEDES:
    "Mercedes-Benz",

  "MERCEDES-BENZ":
    "Mercedes-Benz",

  MITSUBISHI:
    "Mitsubishi",

  NISSAN:
    "Nissan",

  PEUGEOT:
    "Peugeot",

  RENAULT:
    "Renault",

  SAAB:
    "Saab",

  TOYOTA:
    "Toyota",

  TROLLER:
    "Troller",

  VOLKSWAGEN:
    "Volkswagen",

  VW:
    "Volkswagen",

  VOLVO:
    "Volvo",
};

function identificarMontadora(
  linha = ""
) {
  const chave =
    limparTexto(
      linha
    )
      .toUpperCase();

  return (
    MAPA_MONTADORAS[
      chave
    ] ||
    ""
  );
}

/*
 * ============================================================
 * COMBUSTÍVEL
 * ============================================================
 */

function extrairCombustivel(
  texto = ""
) {
  const valor =
    limparTexto(
      texto
    );

  if (
    /bicombust[ií]vel\s*\/\s*gnv/i.test(
      valor
    )
  ) {
    return "Bicombustível / GNV";
  }

  if (
    /gasolina\s*\/\s*gnv/i.test(
      valor
    )
  ) {
    return "Gasolina / GNV";
  }

  if (
    /etanol\s*\/\s*gnv/i.test(
      valor
    )
  ) {
    return "Etanol / GNV";
  }

  if (
    /tetrafuel/i.test(
      valor
    )
  ) {
    return "Tetrafuel";
  }

  if (
    /\bdiesel\b/i.test(
      valor
    )
  ) {
    return "Diesel";
  }

  return "";
}

/*
 * ============================================================
 * PERÍODO
 * ============================================================
 */

function extrairPeriodo(
  texto = ""
) {
  const valor =
    limparTexto(
      texto
    );

  const desde =
    valor.match(
      /\bDesde\s+(?:19|20)\d{2}\b/i
    );

  if (desde) {
    return desde[0];
  }

  const intervalo =
    valor.match(
      /\b(?:19|20)\d{2}\s+a\s+(?:19|20)\d{2}\b/i
    );

  if (
    intervalo
  ) {
    return intervalo[0];
  }

  const ano =
    valor.match(
      /\b(?:19|20)\d{2}\b/
    );

  if (ano) {
    return ano[0];
  }

  if (
    /\bTodos\b/i.test(
      valor
    )
  ) {
    return "Todos";
  }

  return "";
}

function extrairAnos(
  periodo = ""
) {
  const valor =
    limparTexto(
      periodo
    );

  const anos =
    valor.match(
      /\b(?:19|20)\d{2}\b/g
    ) || [];

  if (
    !anos.length
  ) {
    return {
      ano_inicio:
        null,

      ano_fim:
        null,
    };
  }

  if (
    /^desde\b/i.test(
      valor
    )
  ) {
    return {
      ano_inicio:
        Number(
          anos[0]
        ),

      ano_fim:
        null,
    };
  }

  if (
    anos.length >= 2
  ) {
    return {
      ano_inicio:
        Number(
          anos[0]
        ),

      ano_fim:
        Number(
          anos[
            anos.length - 1
          ]
        ),
    };
  }

  return {
    ano_inicio:
      Number(
        anos[0]
      ),

    ano_fim:
      Number(
        anos[0]
      ),
  };
}

/*
 * ============================================================
 * POSIÇÃO ABS
 * ============================================================
 */

function extrairPosicao(
  texto = ""
) {
  const valor =
    limparTexto(
      texto
    );

  const posicoes = [
    "Dianteiro Direito",
    "Dianteiro Esquerdo",
    "Traseiro Direito",
    "Traseiro Esquerdo",
  ];

  return (
    posicoes.find(
      (item) =>
        normalizar(
          valor
        ).includes(
          normalizar(
            item
          )
        )
    ) ||
    ""
  );
}

/*
 * ============================================================
 * MOTOR
 * ============================================================
 */

function pareceMotor(
  texto = ""
) {
  const valor =
    limparTexto(
      texto
    );

  if (
    !valor
  ) {
    return false;
  }

  /*
   * Cilindrada.
   */

  if (
    /\b\d+[.,]\d+\b/.test(
      valor
    )
  ) {
    return true;
  }

  /*
   * Alguns catálogos usam 1.0 etc,
   * mas também códigos de motor.
   */

  if (
    /\b(?:MPFI|MPI|SPI|TSI|TFSI|TDI|VHC|DOHC|OHC|Fire|Firefly|E\.?torQ|Zetec|Rocam|Duratec|EA111|EA211|Twin Spark|Boxer|Turbo)\b/i.test(
      valor
    )
  ) {
    return true;
  }

  return false;
}

/*
 * ============================================================
 * RUÍDOS
 * ============================================================
 */

function ignorarLinha(
  linha = ""
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

  const termos = [
    "catalogo de aplicacoes",
    "sensores ntk",
    "tipos de sensores",
    "veiculo motor/versao combustivel",
    "veiculo motor versao combustivel",
    "sensores de nivel",
    "sensores de temperatura",
    "sensores de rotacao",
    "sensores abs",
    "sensores de velocidade",
    "sensores de posicao de borboleta",
    "sensores map",
    "technical sensors",
    "ntk especialista",
    "maior durabilidade",
    "maior resistencia",
    "resistente a altas",
    "baixo nivel de ruido",
    "precisao na leitura",
    "garantia de qualidade",
  ];

  return termos.some(
    (item) =>
      texto.includes(
        item
      )
  );
}

/*
 * ============================================================
 * LIMPAR LINHA DE APLICAÇÃO
 * ============================================================
 */

function removerCodigoDaLinha(
  linha = ""
) {
  return limparTexto(
    String(
      linha || ""
    ).replace(
      REGEX_CODIGO_NTK,
      " "
    )
  );
}

function removerCombustivel(
  linha = ""
) {
  return limparTexto(
    String(
      linha || ""
    )
      .replace(
        /bicombust[ií]vel\s*\/\s*gnv/gi,
        " "
      )
      .replace(
        /gasolina\s*\/\s*gnv/gi,
        " "
      )
      .replace(
        /etanol\s*\/\s*gnv/gi,
        " "
      )
      .replace(
        /\btetrafuel\b/gi,
        " "
      )
      .replace(
        /\bdiesel\b/gi,
        " "
      )
  );
}

function removerPeriodo(
  linha = ""
) {
  return limparTexto(
    String(
      linha || ""
    )
      .replace(
        /\bDesde\s+(?:19|20)\d{2}\b/gi,
        " "
      )
      .replace(
        /\b(?:19|20)\d{2}\s+a\s+(?:19|20)\d{2}\b/gi,
        " "
      )
      .replace(
        /\b(?:19|20)\d{2}\b/g,
        " "
      )
      .replace(
        /\bTodos\b/gi,
        " "
      )
  );
}

function removerPosicao(
  linha = ""
) {
  return limparTexto(
    String(
      linha || ""
    )
      .replace(
        /Dianteiro Direito/gi,
        " "
      )
      .replace(
        /Dianteiro Esquerdo/gi,
        " "
      )
      .replace(
        /Traseiro Direito/gi,
        " "
      )
      .replace(
        /Traseiro Esquerdo/gi,
        " "
      )
  );
}

/*
 * ============================================================
 * MODELO + MOTOR NA MESMA LINHA
 * ============================================================
 */

function separarModeloMotor(
  texto = ""
) {
  const valor =
    limparTexto(
      texto
    );

  if (
    !valor
  ) {
    return {
      modelo:
        "",

      motor:
        "",
    };
  }

  /*
   * Encontra primeira cilindrada.
   *
   * Exemplo:
   *
   * Argo 1.8 16v E.torQ EVO
   */

  const match =
    valor.match(
      /\b\d+[.,]\d+\b/
    );

  if (
    match &&
    typeof match.index ===
      "number"
  ) {
    const inicio =
      match.index;

    if (
      inicio > 0
    ) {
      return {
        modelo:
          limparTexto(
            valor.slice(
              0,
              inicio
            )
          ),

        motor:
          limparTexto(
            valor.slice(
              inicio
            )
          ),
      };
    }

    return {
      modelo:
        "",

      motor:
        valor,
    };
  }

  return {
    modelo:
      valor,

    motor:
      "",
  };
}

/*
 * ============================================================
 * REGISTRO
 * ============================================================
 */

function criarRegistro({
  codigo,
  montadora,
  modelo,
  motor,
  combustivel,
  periodo,
  posicao,
  nomeArquivo,
  configuracao,
  linhaOriginal,
}) {
  const familia =
    identificarFamilia(
      codigo
    );

  const anos =
    extrairAnos(
      periodo
    );

  return {
    peca:
      familia.peca,

    descricao:
      `${familia.peca} NTK`,

    codigo_oem:
      normalizarCodigo(
        codigo
      ),

    codigo_equivalente:
      "",

    fabricante:
      "NTK",

    montadora:
      montadora ||
      null,

    modelo:
      modelo ||
      null,

    motor:
      motor ||
      null,

    ano_inicio:
      anos.ano_inicio,

    ano_fim:
      anos.ano_fim,

    aplicacao:
      [
        montadora,
        modelo,
        motor,
      ]
        .filter(Boolean)
        .join(" | "),

    observacao:
      [
        combustivel
          ? `Combustível: ${combustivel}`
          : "",

        periodo
          ? `Período catálogo: ${periodo}`
          : "",

        posicao
          ? `Posição: ${posicao}`
          : "",

        linhaOriginal
          ? `Aplicação catálogo: ${linhaOriginal}`
          : "",
      ]
        .filter(Boolean)
        .join(" | "),

    origem_catalogo:
      configuracao
        ?.origemCatalogo ||
      "Catálogo NTK Sensores",

    arquivo_catalogo:
      nomeArquivo ||
      "Catálogo NTK Sensores",

    tipo_catalogo:
      familia.tipo,

    ativo:
      true,

    prioridade:
      1,

    confiabilidade:
      95,
  };
}

/*
 * ============================================================
 * DUPLICADOS
 * ============================================================
 */

function removerDuplicados(
  registros = []
) {
  const mapa =
    new Map();

  for (
    const registro
    of registros
  ) {
    const chave = [
      registro.codigo_oem,
      registro.montadora,
      registro.modelo,
      registro.motor,
      registro.ano_inicio,
      registro.ano_fim,
      registro.observacao,
    ]
      .map(
        (valor) =>
          normalizar(
            valor ?? ""
          )
      )
      .join("|");

    if (
      !mapa.has(
        chave
      )
    ) {
      mapa.set(
        chave,
        registro
      );
    }
  }

  return [
    ...mapa.values(),
  ];
}

/*
 * ============================================================
 * PARSER PRINCIPAL
 * ============================================================
 */

export async function parserNgkSensores({
  textoReferencias = "",
  textoAplicacoes = "",
  textoEquivalencias = "",
  paginasAplicacoes = [],
  nomeArquivo = "",
  configuracao = {},
  onProgresso,
} = {}) {
  onProgresso?.(
    "📡 NTK: lendo catálogo de Sensores..."
  );

  const textoPaginas =
    Array.isArray(
      paginasAplicacoes
    )
      ? paginasAplicacoes
          .map(
            (pagina) =>
              pagina?.texto ||
              pagina?.conteudo ||
              ""
          )
          .filter(Boolean)
          .join("\n")
      : "";

  const textoCompleto = [
    textoReferencias,
    textoAplicacoes,
    textoEquivalencias,
    textoPaginas,
  ]
    .filter(Boolean)
    .join("\n");

  if (
    !textoCompleto.trim()
  ) {
    console.warn(
      "⚠️ NTK Sensores recebeu texto vazio."
    );

    return [];
  }

  const linhas =
    transformarEmLinhas(
      textoCompleto
    );

  const registros =
    [];

  let montadoraAtual =
    "";

  let modeloAtual =
    "";

  let motorAtual =
    "";

  /*
   * ========================================================
   * LEITURA
   * ========================================================
   */

  for (
    let indice = 0;
    indice < linhas.length;
    indice += 1
  ) {
    const linha =
      linhas[
        indice
      ];

    if (
      ignorarLinha(
        linha
      )
    ) {
      continue;
    }

    /*
     * Montadora.
     */

    const montadora =
      identificarMontadora(
        linha
      );

    if (
      montadora
    ) {
      montadoraAtual =
        montadora;

      modeloAtual =
        "";

      motorAtual =
        "";

      continue;
    }

    /*
     * Código NTK.
     */

    const codigos =
      extrairCodigos(
        linha
      );

    /*
     * Se ainda não há código,
     * pode ser modelo ou motor
     * isolado por quebra do PDF.
     */

    if (
      !codigos.length
    ) {
      const combustivel =
        extrairCombustivel(
          linha
        );

      const periodo =
        extrairPeriodo(
          linha
        );

      const posicao =
        extrairPosicao(
          linha
        );

      /*
       * Linha puramente técnica:
       * não atualizar contexto.
       */

      if (
        combustivel ||
        periodo ||
        posicao
      ) {
        continue;
      }

      if (
        pareceMotor(
          linha
        )
      ) {
        motorAtual =
          linha;

        continue;
      }

      /*
       * Possível modelo.
       */

      if (
        linha.length <=
          40 &&
        !/^\d+$/.test(
          linha
        )
      ) {
        modeloAtual =
          linha;

        motorAtual =
          "";
      }

      continue;
    }

    /*
     * ======================================================
     * LINHA COM CÓDIGO
     * ======================================================
     */

    const combustivel =
      extrairCombustivel(
        linha
      );

    const periodo =
      extrairPeriodo(
        linha
      );

    const posicao =
      extrairPosicao(
        linha
      );

    let aplicacao =
      removerCodigoDaLinha(
        linha
      );

    aplicacao =
      removerCombustivel(
        aplicacao
      );

    aplicacao =
      removerPeriodo(
        aplicacao
      );

    aplicacao =
      removerPosicao(
        aplicacao
      );

    /*
     * Remove montadora se ela tiver
     * vindo grudada na mesma linha.
     */

    for (
      const chave
      of Object.keys(
        MAPA_MONTADORAS
      )
    ) {
      aplicacao =
        limparTexto(
          aplicacao.replace(
            new RegExp(
              `^${chave}\\s+`,
              "i"
            ),
            ""
          )
        );
    }

    const separado =
      separarModeloMotor(
        aplicacao
      );

    /*
     * Se veio modelo explícito,
     * atualiza contexto.
     */

    if (
      separado.modelo
    ) {
      modeloAtual =
        separado.modelo;
    }

    /*
     * Se veio motor explícito,
     * usa ele.
     */

    if (
      separado.motor
    ) {
      motorAtual =
        separado.motor;
    }

    for (
      const codigo
      of codigos
    ) {
      registros.push(
        criarRegistro({
          codigo,

          montadora:
            montadoraAtual,

          modelo:
            modeloAtual,

          motor:
            motorAtual,

          combustivel,

          periodo,

          posicao,

          nomeArquivo,

          configuracao,

          linhaOriginal:
            linha,
        })
      );
    }
  }

  const unicos =
    removerDuplicados(
      registros
    );

  /*
   * ========================================================
   * DIAGNÓSTICO
   * ========================================================
   */

  const porFamilia = {};

  for (
    const registro
    of unicos
  ) {
    const tipo =
      registro
        .tipo_catalogo ||
      "sensor";

    porFamilia[
      tipo
    ] =
      (
        porFamilia[
          tipo
        ] ||
        0
      ) + 1;
  }

  console.log(
    "========================================"
  );

  console.log(
    "📡 PARSER NTK SENSORES"
  );

  console.log(
    "Arquivo:",
    nomeArquivo
  );

  console.log(
    "Linhas analisadas:",
    linhas.length
  );

  console.log(
    "Registros:",
    unicos.length
  );

  console.log(
    "Famílias:",
    porFamilia
  );

  console.log(
    "Códigos únicos:",
    [
      ...new Set(
        unicos.map(
          (item) =>
            item.codigo_oem
        )
      ),
    ].length
  );

  console.log(
    "========================================"
  );

  onProgresso?.(
    `✅ NTK Sensores: ${unicos.length} registro(s) encontrado(s).`
  );

  return unicos;
}

export default parserNgkSensores;