/*
 * ============================================================
 * MAGNETI MARELLI
 * AMORTECEDORES / SHOCK ABSORBERS 2019
 * ============================================================
 *
 * Catálogo:
 * Parts_Shock absorbers_EN.pdf
 *
 * Aplicações:
 * montadora
 * modelo
 * versão / motor
 * anos
 * código dianteiro
 * código traseiro
 *
 * Equivalências:
 * IAM/OES -> Magneti Marelli
 *
 * ============================================================
 */

function texto(valor = "") {
  return String(
    valor ?? ""
  )
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function normalizar(valor = "") {
  return texto(valor)
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toUpperCase();
}

function separarLinhas(
  valor = ""
) {
  return String(
    valor || ""
  )
    .split(/\r?\n/)
    .map(texto)
    .filter(Boolean);
}

/*
 * ============================================================
 * CÓDIGOS MAGNETI MARELLI
 * ============================================================
 *
 * Exemplos reais:
 *
 * 5626G
 * 1792G
 * 5787G
 * 5795G
 * 5803G
 * 5804G
 * 1984GL
 * 1984GR
 * 1913HL
 * 1913HR
 * 0904G
 * 0904H
 *
 * ============================================================
 */

function ehCodigoMarelli(
  valor = ""
) {
  const codigo =
    normalizar(valor)
      .replace(
        /[^A-Z0-9]/g,
        ""
      );

  return (
    /^\d{4}[GH]$/.test(
      codigo
    ) ||
    /^\d{4}[GH][LR]$/.test(
      codigo
    )
  );
}

function extrairCodigosMarelli(
  linha = ""
) {
  const encontrados =
    normalizar(linha)
      .match(
        /\b\d{4}[GH](?:[LR])?\b/g
      ) || [];

  return [
    ...new Set(
      encontrados
        .map((item) =>
          normalizar(item)
        )
        .filter(
          ehCodigoMarelli
        )
    ),
  ];
}

/*
 * ============================================================
 * MONTADORAS
 * ============================================================
 */

const MONTADORAS = [
  "ALFA ROMEO",
  "AUDI",
  "BMW",
  "CHEVROLET",
  "CHEVROLET - DAEWOO",
  "CHEVROLET – DAEWOO",
  "CHRYSLER",
  "CITROEN",
  "CITROËN",
  "DACIA",
  "DAEWOO",
  "DAIHATSU",
  "FIAT",
  "FORD",
  "FSO",
  "HONDA",
  "HYUNDAI",
  "ISUZU",
  "IVECO",
  "JEEP",
  "KIA",
  "LADA",
  "LANCIA",
  "LAND ROVER",
  "MAZDA",
  "MERCEDES-BENZ",
  "MERCEDES BENZ",
  "MINI",
  "MITSUBISHI",
  "NISSAN",
  "OPEL",
  "PEUGEOT",
  "RENAULT",
  "ROVER",
  "SAAB",
  "SEAT",
  "SKODA",
  "SMART",
  "SUBARU",
  "SUZUKI",
  "TOYOTA",
  "VAUXHALL",
  "VOLKSWAGEN",
  "VOLVO",
];

function identificarMontadora(
  linha = ""
) {
  const valor =
    normalizar(linha);

  const encontrada =
    MONTADORAS.find(
      (montadora) =>
        valor ===
        normalizar(
          montadora
        )
    );

  return encontrada ||
    null;
}

/*
 * ============================================================
 * LINHAS QUE DEVEM SER IGNORADAS
 * ============================================================
 */

function ehCabecalho(
  linha = ""
) {
  const valor =
    normalizar(linha);

  if (
    !valor
  ) {
    return true;
  }

  return (
    valor ===
      "TWIN-TUBE OIL" ||
    valor ===
      "TWIN-TUBE GAS" ||
    valor ===
      "MONO-TUBE GAS" ||
    valor ===
      "OIL" ||
    valor ===
      "GAS" ||
    valor ===
      "IAM/OES" ||
    valor.includes(
      "VEHICLE APPLICATION GUIDE"
    ) ||
    valor.includes(
      "APPLICAZIONE PER MARCA"
    ) ||
    valor.includes(
      "CROSS REFERENCE GUIDE"
    ) ||
    valor.includes(
      "TAVOLE DI COMPARAZIONE"
    ) ||
    valor.startsWith(
      "--- PAGINA "
    ) ||
    valor.startsWith(
      "--- PÁGINA "
    )
  );
}

/*
 * ============================================================
 * ANOS
 * ============================================================
 */

function extrairPeriodo(
  linha = ""
) {
  const valor =
    texto(linha);

  /*
   * Exemplos:
   *
   * 94 à 97
   * 09/05 à 11/11
   * 03/06 à
   */

  const match =
    valor.match(
      /(\d{2}(?:\/\d{2})?)\s*[àa→\-]+\s*(\d{2}(?:\/\d{2})?)?/i
    );

  if (!match) {
    return {
      periodo: null,
      ano_inicio: null,
      ano_fim: null,
    };
  }

  function ano(valorAno) {
    if (!valorAno) {
      return null;
    }

    const partes =
      String(
        valorAno
      ).split("/");

    const numero =
      Number(
        partes[
          partes.length - 1
        ]
      );

    if (
      !Number.isFinite(
        numero
      )
    ) {
      return null;
    }

    return numero >= 70
      ? 1900 + numero
      : 2000 + numero;
  }

  return {
    periodo:
      match[0],

    ano_inicio:
      ano(
        match[1]
      ),

    ano_fim:
      ano(
        match[2]
      ),
  };
}

/*
 * ============================================================
 * MODELO
 * ============================================================
 */

function pareceModelo(
  linha = ""
) {
  const valor =
    texto(linha);

  const norm =
    normalizar(valor);

  if (
    !valor ||
    ehCabecalho(valor) ||
    identificarMontadora(
      valor
    ) ||
    extrairCodigosMarelli(
      valor
    ).length
  ) {
    return false;
  }

  /*
   * Evita linhas puramente técnicas.
   */

  if (
    /^(EXCL|INCL|ALL MODELS|SELF LEVELING|2WD|4WD)$/i.test(
      valor
    )
  ) {
    return false;
  }

  /*
   * Modelo geralmente é curto,
   * começa com letra ou número
   * e não contém período completo.
   */

  if (
    valor.length > 80
  ) {
    return false;
  }

  if (
    /\d{2}\/\d{2}\s*[à→-]/.test(
      valor
    )
  ) {
    return false;
  }

  if (
    norm.includes(
      "OE PN"
    )
  ) {
    return false;
  }

  return true;
}

/*
 * ============================================================
 * POSIÇÃO
 * ============================================================
 */

function identificarLado(
  codigo = ""
) {
  const valor =
    normalizar(codigo);

  if (
    valor.endsWith(
      "GR"
    ) ||
    valor.endsWith(
      "HR"
    )
  ) {
    return "Direito";
  }

  if (
    valor.endsWith(
      "GL"
    ) ||
    valor.endsWith(
      "HL"
    )
  ) {
    return "Esquerdo";
  }

  return null;
}

function identificarTecnologia(
  codigo = ""
) {
  const valor =
    normalizar(codigo);

  if (
    valor.includes(
      "H"
    )
  ) {
    return "Hidráulico";
  }

  if (
    valor.includes(
      "G"
    )
  ) {
    return "Gás";
  }

  return null;
}

/*
 * ============================================================
 * REGISTRO DE APLICAÇÃO
 * ============================================================
 */

function montarRegistroAplicacao({
  codigo,
  montadora,
  modelo,
  aplicacao,
  posicao,
  nomeArquivo,
  configuracao,
}) {
  const periodo =
    extrairPeriodo(
      aplicacao
    );

  const lado =
    identificarLado(
      codigo
    );

  const tecnologia =
    identificarTecnologia(
      codigo
    );

  const observacao = [
    `Código Magneti Marelli: ${codigo}`,

    posicao
      ? `Posição: ${posicao}`
      : null,

    lado
      ? `Lado: ${lado}`
      : null,

    tecnologia
      ? `Tecnologia: ${tecnologia}`
      : null,

    aplicacao
      ? `Aplicação catálogo: ${aplicacao}`
      : null,
  ]
    .filter(Boolean)
    .join(
      " | "
    );

  return {
    peca:
      "Amortecedor",

    descricao:
      [
        "Amortecedor",
        posicao,
        lado,
        tecnologia,
      ]
        .filter(Boolean)
        .join(" "),

    codigo_oem:
      codigo,

    codigo:
      codigo,

    codigo_equivalente:
      null,

    equivalentes:
      [],

    fabricante:
      "Magneti Marelli",

    marca:
      "Magneti Marelli",

    origem_catalogo:
      configuracao
        ?.origemCatalogo ||
      "Catálogo Magneti Marelli Shock Absorbers 2019",

    origemCatalogo:
      configuracao
        ?.origemCatalogo ||
      "Catálogo Magneti Marelli Shock Absorbers 2019",

    arquivo_catalogo:
      nomeArquivo ||
      null,

    tipo_catalogo:
      "amortecedores",

    tipoCatalogo:
      "amortecedores",

    familia_catalogo:
      "Suspensão",

    familia:
      "Suspensão",

    categoria:
      "Suspensão",

    subcategoria:
      "Amortecedores",

    sistema:
      "Suspensão",

    tipo:
      tecnologia
        ? `Amortecedor ${tecnologia}`
        : "Amortecedor",

    montadora:
      montadora ||
      null,

    modelo:
      modelo ||
      null,

    motor:
      aplicacao ||
      null,

    aplicacao:
      aplicacao ||
      null,

    ano_inicio:
      periodo.ano_inicio,

    ano_fim:
      periodo.ano_fim,

    posicao:
      posicao ||
      null,

    lado,

    tecnologia,

    observacao,

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
 * EXTRAÇÃO DAS APLICAÇÕES
 * ============================================================
 */

function extrairAplicacoes({
  textoAplicacoes = "",
  nomeArquivo = "",
  configuracao = {},
}) {
  const linhas =
    separarLinhas(
      textoAplicacoes
    );

  const registros = [];

  let montadoraAtual =
    null;

  let modeloAtual =
    null;

  let contexto = [];

  for (
    let i = 0;
    i < linhas.length;
    i += 1
  ) {
    const linha =
      linhas[i];

    if (
      ehCabecalho(
        linha
      )
    ) {
      continue;
    }

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
        null;

      contexto =
        [];

      continue;
    }

    const codigos =
      extrairCodigosMarelli(
        linha
      );

    /*
     * Linha sem código:
     * pode ser modelo ou complemento
     * da aplicação.
     */

    if (
      codigos.length === 0
    ) {
      if (
        pareceModelo(
          linha
        )
      ) {
        /*
         * Linhas curtas e sem dados
         * técnicos são tratadas como
         * possível modelo.
         */

        if (
          linha.length <= 45 &&
          !/\b\d{1,2}\.\d\b/.test(
            linha
          )
        ) {
          modeloAtual =
            linha;

          contexto =
            [];

          continue;
        }
      }

      contexto.push(
        linha
      );

      /*
       * Evita contexto infinito.
       */

      if (
        contexto.length > 5
      ) {
        contexto =
          contexto.slice(
            -5
          );
      }

      continue;
    }

    /*
     * Há códigos nesta linha.
     */

    const parteSemCodigos =
      codigos.reduce(
        (resultado, codigo) =>
          resultado.replace(
            new RegExp(
              `\\b${codigo}\\b`,
              "gi"
            ),
            " "
          ),
        linha
      )
        .replace(
          /\s+/g,
          " "
        )
        .trim();

    const aplicacao =
      [
        ...contexto,
        parteSemCodigos,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

    /*
     * Quando existem dois códigos
     * na mesma aplicação:
     *
     * normalmente:
     *
     * 1º = dianteiro
     * 2º = traseiro
     *
     * conforme a estrutura das
     * colunas do catálogo.
     */

    codigos.forEach(
      (
        codigo,
        indice
      ) => {
        let posicao =
          null;

        if (
          codigos.length >= 2
        ) {
          if (
            indice === 0
          ) {
            posicao =
              "Dianteiro";
          } else if (
            indice === 1
          ) {
            posicao =
              "Traseiro";
          }
        }

        registros.push(
          montarRegistroAplicacao({
            codigo,
            montadora:
              montadoraAtual,

            modelo:
              modeloAtual,

            aplicacao,

            posicao,

            nomeArquivo,

            configuracao,
          })
        );
      }
    );

    contexto =
      [];
  }

  return registros;
}

/*
 * ============================================================
 * EQUIVALÊNCIAS IAM / OES
 * ============================================================
 *
 * Estrutura típica:
 *
 * 46763385 5795G
 * 50515152 7286G
 *
 * Também existem OEMs com
 * mais de um código Marelli:
 *
 * 7644763
 * 1913HL
 * 1913HR
 *
 * ============================================================
 */

function ehCodigoOem(
  valor = ""
) {
  const v =
    normalizar(valor)
      .replace(
        /[^A-Z0-9]/g,
        ""
      );

  if (
    !v ||
    ehCodigoMarelli(
      v
    )
  ) {
    return false;
  }

  /*
   * OEMs do catálogo são
   * predominantemente numéricos.
   */

  return /^\d{5,18}$/.test(
    v
  );
}

function extrairEquivalencias(
  textoEquivalencias = ""
) {
  const linhas =
    separarLinhas(
      textoEquivalencias
    );

  const mapa =
    new Map();

  let oemAtual =
    null;

  for (
    const linha
    of linhas
  ) {
    if (
      ehCabecalho(
        linha
      ) ||
      identificarMontadora(
        linha
      )
    ) {
      continue;
    }

    const codigosMarelli =
      extrairCodigosMarelli(
        linha
      );

    const tokens =
      normalizar(linha)
        .split(
          /\s+/
        )
        .map(
          (item) =>
            item.replace(
              /[^A-Z0-9]/g,
              ""
            )
        )
        .filter(Boolean);

    const oemNaLinha =
      tokens.find(
        ehCodigoOem
      );

    if (
      oemNaLinha
    ) {
      oemAtual =
        oemNaLinha;
    }

    if (
      !oemAtual ||
      codigosMarelli.length === 0
    ) {
      continue;
    }

    for (
      const codigo
      of codigosMarelli
    ) {
      if (
        !mapa.has(
          codigo
        )
      ) {
        mapa.set(
          codigo,
          new Set()
        );
      }

      mapa
        .get(
          codigo
        )
        .add(
          oemAtual
        );
    }
  }

  return mapa;
}

/*
 * ============================================================
 * APLICAR EQUIVALÊNCIAS
 * ============================================================
 */

function aplicarEquivalencias(
  registros = [],
  mapaEquivalencias
) {
  return registros.map(
    (registro) => {
      const codigo =
        normalizar(
          registro.codigo_oem
        );

      const equivalentes =
        Array.from(
          mapaEquivalencias.get(
            codigo
          ) ||
          []
        );

      if (
        equivalentes.length ===
        0
      ) {
        return registro;
      }

      return {
        ...registro,

        codigo_equivalente:
          equivalentes[0],

        equivalentes,

        observacao: [
          registro.observacao,

          `Equivalências IAM/OES: ${equivalentes.join(
            ", "
          )}`,
        ]
          .filter(Boolean)
          .join(
            " | "
          ),
      };
    }
  );
}

/*
 * ============================================================
 * REGISTROS SOMENTE DE EQUIVALÊNCIA
 *
 * Importante para códigos Marelli
 * que existam no Cross Reference,
 * mas não tenham sido capturados
 * na área de aplicações.
 * ============================================================
 */

function criarRegistrosEquivalenciasSemAplicacao({
  registros = [],
  mapaEquivalencias,
  nomeArquivo,
  configuracao,
}) {
  const existentes =
    new Set(
      registros.map(
        (registro) =>
          normalizar(
            registro.codigo_oem
          )
      )
    );

  const extras = [];

  for (
    const [
      codigo,
      oems,
    ]
    of mapaEquivalencias.entries()
  ) {
    if (
      existentes.has(
        codigo
      )
    ) {
      continue;
    }

    const equivalentes =
      Array.from(
        oems
      );

    extras.push({
      peca:
        "Amortecedor",

      descricao:
        "Amortecedor Magneti Marelli",

      codigo_oem:
        codigo,

      codigo:
        codigo,

      codigo_equivalente:
        equivalentes[0] ||
        null,

      equivalentes,

      fabricante:
        "Magneti Marelli",

      marca:
        "Magneti Marelli",

      origem_catalogo:
        configuracao
          ?.origemCatalogo ||
        "Catálogo Magneti Marelli Shock Absorbers 2019",

      origemCatalogo:
        configuracao
          ?.origemCatalogo ||
        "Catálogo Magneti Marelli Shock Absorbers 2019",

      arquivo_catalogo:
        nomeArquivo ||
        null,

      tipo_catalogo:
        "amortecedores",

      tipoCatalogo:
        "amortecedores",

      familia_catalogo:
        "Suspensão",

      familia:
        "Suspensão",

      categoria:
        "Suspensão",

      subcategoria:
        "Amortecedores",

      sistema:
        "Suspensão",

      tipo:
        identificarTecnologia(
          codigo
        )
          ? `Amortecedor ${identificarTecnologia(
              codigo
            )}`
          : "Amortecedor",

      montadora:
        null,

      modelo:
        null,

      motor:
        null,

      aplicacao:
        null,

      ano_inicio:
        null,

      ano_fim:
        null,

      posicao:
        null,

      lado:
        identificarLado(
          codigo
        ),

      tecnologia:
        identificarTecnologia(
          codigo
        ),

      observacao:
        `Código Magneti Marelli: ${codigo} | Equivalências IAM/OES: ${equivalentes.join(
          ", "
        )}`,

      ativo:
        true,

      prioridade:
        1,

      confiabilidade:
        90,
    });
  }

  return extras;
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
      registro.codigo_equivalente,
      registro.montadora,
      registro.modelo,
      registro.motor,
      registro.posicao,
      registro.lado,
    ]
      .map(
        normalizar
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

export async function parserMagnetiMarelliAmortecedores({
  textoReferencias = "",
  textoAplicacoes = "",
  textoEquivalencias = "",
  nomeArquivo = "",
  configuracao = {},
  onProgresso,
} = {}) {
  onProgresso?.(
    "🛞 Lendo Amortecedores Magneti Marelli 2019..."
  );

  /*
   * Alguns motores podem colocar
   * Cross Reference em referências
   * ou equivalências.
   *
   * Juntamos ambos para não perder
   * códigos IAM/OES.
   */

  const textoCrossReference = [
    textoReferencias,
    textoEquivalencias,
  ]
    .filter(Boolean)
    .join(
      "\n"
    );

  /*
   * ========================================================
   * APLICAÇÕES
   * ========================================================
   */

  const registrosAplicacoes =
    extrairAplicacoes({
      textoAplicacoes,

      nomeArquivo,

      configuracao,
    });

  /*
   * ========================================================
   * EQUIVALÊNCIAS
   * ========================================================
   */

  const mapaEquivalencias =
    extrairEquivalencias(
      textoCrossReference
    );

  const registrosComEquivalencias =
    aplicarEquivalencias(
      registrosAplicacoes,
      mapaEquivalencias
    );

  /*
   * Também preservamos códigos
   * encontrados exclusivamente no
   * Cross Reference.
   */

  const registrosExtras =
    criarRegistrosEquivalenciasSemAplicacao({
      registros:
        registrosComEquivalencias,

      mapaEquivalencias,

      nomeArquivo,

      configuracao,
    });

  const resultado =
    removerDuplicados([
      ...registrosComEquivalencias,
      ...registrosExtras,
    ]);

  /*
   * ========================================================
   * DIAGNÓSTICOS
   * ========================================================
   */

  const teste5795G =
    resultado.filter(
      (registro) =>
        normalizar(
          registro.codigo_oem
        ) ===
        "5795G"
    );

  const teste5803G =
    resultado.filter(
      (registro) =>
        normalizar(
          registro.codigo_oem
        ) ===
        "5803G"
    );

  const teste1984GL =
    resultado.filter(
      (registro) =>
        normalizar(
          registro.codigo_oem
        ) ===
        "1984GL"
    );

  const testeOem46763385 =
    resultado.filter(
      (registro) =>
        Array.isArray(
          registro.equivalentes
        ) &&
        registro.equivalentes.includes(
          "46763385"
        )
    );

  console.log(
    "=========================================="
  );

  console.log(
    "🛞 MAGNETI MARELLI SHOCK ABSORBERS 2019"
  );

  console.log(
    "ARQUIVO:",
    nomeArquivo
  );

  console.log(
    "APLICAÇÕES:",
    registrosAplicacoes.length
  );

  console.log(
    "CÓDIGOS COM CROSS REFERENCE:",
    mapaEquivalencias.size
  );

  console.log(
    "REGISTROS EXTRAS:",
    registrosExtras.length
  );

  console.log(
    "REGISTROS ÚNICOS:",
    resultado.length
  );

  console.log(
    "🎯 5795G:",
    teste5795G.slice(
      0,
      5
    )
  );

  console.log(
    "🎯 5803G:",
    teste5803G.slice(
      0,
      5
    )
  );

  console.log(
    "🎯 1984GL:",
    teste1984GL.slice(
      0,
      5
    )
  );

  console.log(
    "🎯 OEM 46763385:",
    testeOem46763385.slice(
      0,
      5
    )
  );

  console.log(
    "=========================================="
  );

  onProgresso?.(
    `✅ Amortecedores Magneti Marelli: ${resultado.length} registro(s) encontrado(s).`
  );

  return resultado;
}

export default
  parserMagnetiMarelliAmortecedores;