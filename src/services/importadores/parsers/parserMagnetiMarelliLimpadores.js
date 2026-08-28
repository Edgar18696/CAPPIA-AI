/*
 * ============================================================
 * APPIA AI
 * MAGNETI MARELLI — WIPING SYSTEMS 2024
 * ============================================================
 *
 * Catálogo:
 * Parts_Wiping_Systems_EN.pdf
 *
 * Famílias encontradas:
 *
 * - Sistemas de limpador
 * - Motores do limpador
 * - Mecanismos / linkage
 * - Limpador traseiro
 *
 * Dados aproveitados:
 *
 * - Código Magneti Marelli
 * - Código longo Magneti Marelli
 * - Montadora
 * - Modelo
 * - Ano inicial
 * - Ano final
 * - Lado de direção
 * - Tensão
 * - Informações técnicas
 * - Códigos OE
 *
 * ============================================================
 */

function limparTexto(valor = "") {
  return String(valor || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function normalizarTexto(valor = "") {
  return limparTexto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function normalizarCodigo(valor = "") {
  return String(valor || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

function separarLinhas(texto = "") {
  return String(texto || "")
    .split(/\r?\n/)
    .map(limparTexto)
    .filter(Boolean);
}

/*
 * ============================================================
 * MONTADORAS
 * ============================================================
 */

const MONTADORAS = [
  "ABARTH",
  "ALFA ROMEO",
  "AUDI",
  "BMW",
  "CHEVROLET",
  "CHRYSLER",
  "CITROEN",
  "CITROËN",
  "CUPRA",
  "DACIA",
  "DAEWOO",
  "DAF",
  "FIAT",
  "FORD",
  "HONDA",
  "HYUNDAI",
  "IVECO",
  "JEEP",
  "KIA",
  "LANCIA",
  "LAND ROVER",
  "MAN",
  "MASERATI",
  "MAZDA",
  "MERCEDES-BENZ",
  "MINI",
  "MITSUBISHI",
  "NEOPLAN",
  "NISSAN",
  "OPEL",
  "PEUGEOT",
  "PORSCHE",
  "RENAULT",
  "RENAULT TRUCKS",
  "SAAB",
  "SCANIA",
  "SEAT",
  "SETRA",
  "SKODA",
  "ŠKODA",
  "SMART",
  "SUBARU",
  "TOYOTA",
  "VAUXHALL",
  "VOLKSWAGEN",
  "VOLVO",
];

function identificarMontadora(
  linha = ""
) {
  const texto =
    normalizarTexto(linha);

  const encontrada =
    MONTADORAS.find(
      (item) =>
        normalizarTexto(item) ===
        texto
    );

  return encontrada || "";
}

/*
 * ============================================================
 * CABEÇALHOS
 * ============================================================
 */

function ehCabecalho(
  linha = ""
) {
  const texto =
    normalizarTexto(linha);

  if (!texto) {
    return true;
  }

  const termos = [
    "APPLICAZIONE PER MARCA E VEICOLO",
    "VEHICLE APPLICATION GUIDE",
    "APLICACAO POR MARCA E VEICULO",
    "APPLICAZIONE PER CODICE",
    "BUYERS GUIDE",
    "APLICACAO POR CODIGO",
    "TAVOLE DI COMPARAZIONE OE",
    "OE CROSS REFERENCE GUIDE",
    "TABELA DE EQUIVALENCIAS OE",
    "MAGNETI MARELLI PARTS & SERVICES",
    "SISTEMI TERGICRISTALLO",
    "WIPING SYSTEMS",
    "SISTEMAS LIMPADORES DE PARA-BRISA",
    "MOTORIDUTTORE",
    "WIPER LINKAGE",
    "REAR WINDOW WIPER",
    "TENSIONE",
    "VOLTAGE",
    "INFORMAZIONI TECNICHE",
    "TECHNICAL INFORMATION",
  ];

  return termos.some(
    (termo) =>
      texto === termo ||
      texto.startsWith(termo)
  );
}

/*
 * ============================================================
 * CÓDIGOS MAGNETI MARELLI
 * ============================================================
 *
 * Exemplos:
 *
 * TGE511O
 * TGE511P
 * TGEC734OM
 * TGECSM23A
 * TGT709IM
 * TGL621V
 * TGECS05C
 * TGT764ZM
 *
 * ============================================================
 */

function extrairCodigosMarelli(
  texto = ""
) {
  const valor =
    normalizarTexto(texto);

  const encontrados =
    valor.match(
      /\b(?:TGE[A-Z0-9]{3,12}|TGT[A-Z0-9]{3,12}|TGL[A-Z0-9]{3,12})\b/g
    ) || [];

  return [
    ...new Set(
      encontrados.map(
        normalizarCodigo
      )
    ),
  ];
}

function ehCodigoMarelli(
  valor = ""
) {
  const codigo =
    normalizarCodigo(valor);

  return /^(?:TGE|TGT|TGL)[A-Z0-9]{3,12}$/.test(
    codigo
  );
}

/*
 * ============================================================
 * CÓDIGO LONGO MAGNETI MARELLI
 * ============================================================
 */

function extrairCodigoLongo(
  texto = ""
) {
  const encontrados =
    String(texto || "")
      .match(
        /\b\d{10,13}\b/g
      ) || [];

  return encontrados[0] || "";
}

/*
 * ============================================================
 * IDENTIFICAÇÃO DA PEÇA
 * ============================================================
 */

function identificarFamilia(
  codigo = ""
) {
  const valor =
    normalizarCodigo(codigo);

  /*
   * TGL aparece predominantemente
   * na coluna de limpador traseiro.
   */

  if (
    valor.startsWith("TGL")
  ) {
    return {
      peca:
        "Limpador de Vidro Traseiro",

      categoria:
        "Limpeza",

      sistema:
        "Sistema Limpador",

      tipo:
        "Limpador Traseiro",
    };
  }

  /*
   * TGT:
   * tiranteria / linkage.
   */

  if (
    valor.startsWith("TGT")
  ) {
    return {
      peca:
        "Mecanismo do Limpador",

      categoria:
        "Limpeza",

      sistema:
        "Sistema Limpador",

      tipo:
        "Mecanismo / Linkage",
    };
  }

  /*
   * TGECSM:
   * família encontrada no guia
   * de motores.
   */

  if (
    valor.startsWith(
      "TGECSM"
    )
  ) {
    return {
      peca:
        "Motor do Limpador",

      categoria:
        "Limpeza",

      sistema:
        "Sistema Limpador",

      tipo:
        "Motor do Limpador",
    };
  }

  /*
   * TGE / TGEC / TGECS:
   * conjunto/sistema limpador.
   */

  return {
    peca:
      "Sistema do Limpador de Para-brisa",

    categoria:
      "Limpeza",

    sistema:
      "Sistema Limpador",

    tipo:
      "Sistema Limpador",
  };
}

/*
 * ============================================================
 * ANOS
 * ============================================================
 */

function converterAnoCurto(
  valor
) {
  const numero =
    Number(valor);

  if (
    !Number.isFinite(numero)
  ) {
    return null;
  }

  return numero <= 35
    ? 2000 + numero
    : 1900 + numero;
}

function extrairPeriodo(
  texto = ""
) {
  const valor =
    String(texto || "");

  const matches = [
    ...valor.matchAll(
      /\b(\d{1,2})\/(\d{2})\b/g
    ),
  ];

  const anos =
    matches
      .map((match) =>
        converterAnoCurto(
          match[2]
        )
      )
      .filter(
        (ano) =>
          ano >= 1950 &&
          ano <= 2035
      );

  if (
    anos.length === 0
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
      anos[0] || null,

    ano_fim:
      anos.length >= 2
        ? anos[1]
        : null,
  };
}

/*
 * ============================================================
 * DIREÇÃO
 * ============================================================
 *
 * LD = Left Hand Drive
 * RD = Right Hand Drive
 * ============================================================
 */

function extrairDirecao(
  texto = ""
) {
  const valor =
    normalizarTexto(texto);

  if (
    /\bLD\b/.test(valor)
  ) {
    return "Direção à esquerda (LD)";
  }

  if (
    /\bRD\b/.test(valor)
  ) {
    return "Direção à direita (RD)";
  }

  return "";
}

/*
 * ============================================================
 * TENSÃO
 * ============================================================
 */

function extrairTensao(
  texto = ""
) {
  const valor =
    normalizarTexto(texto);

  /*
   * Normalmente:
   *
   * LD 12
   * RD 12
   * - 24
   */

  const match =
    valor.match(
      /(?:\bLD\b|\bRD\b|^|\s)[–-]?\s*(12|24)\b/
    );

  return match
    ? match[1]
    : "";
}

/*
 * ============================================================
 * OE
 * ============================================================
 */

function extrairCodigosOE(
  texto = ""
) {
  const valor =
    normalizarTexto(texto);

  const resultado =
    new Set();

  /*
   * OE: 6K0955119
   * OE: 1S6955711B
   * OE: 9678423580
   */

  const regexOE =
    /\bOE\s*[:;]?\s*([A-Z0-9][A-Z0-9._/-]{4,24})/g;

  let match;

  while (
    (
      match =
        regexOE.exec(valor)
    ) !== null
  ) {
    const codigo =
      normalizarCodigo(
        match[1]
      );

    if (
      codigo &&
      codigo.length >= 5 &&
      !ehCodigoMarelli(
        codigo
      )
    ) {
      resultado.add(
        codigo
      );
    }
  }

  return Array.from(
    resultado
  );
}

/*
 * ============================================================
 * MODELO
 * ============================================================
 */

function limparModelo(
  linha = ""
) {
  let texto =
    limparTexto(linha);

  /*
   * Remove período.
   */

  texto =
    texto.replace(
      /\s+\d{1,2}\/\d{2}\s*[à→>-].*$/i,
      ""
    );

  /*
   * Remove LD / RD / tensão e informações
   * que eventualmente ficaram depois.
   */

  texto =
    texto.replace(
      /\s+(?:LD|RD)\s+(?:12|24).*$/i,
      ""
    );

  return limparTexto(texto);
}

function pareceModelo(
  linha = ""
) {
  const texto =
    limparTexto(linha);

  if (!texto) {
    return false;
  }

  if (
    identificarMontadora(texto)
  ) {
    return false;
  }

  if (
    ehCabecalho(texto)
  ) {
    return false;
  }

  if (
    extrairCodigosMarelli(
      texto
    ).length > 0
  ) {
    /*
     * Ainda pode ser aplicação completa
     * contendo modelo + código.
     */

    return /\d{1,2}\/\d{2}/.test(
      texto
    );
  }

  return /\d{1,2}\/\d{2}/.test(
    texto
  );
}

/*
 * ============================================================
 * LINHAS DE PRODUTO DO BUYERS GUIDE
 * ============================================================
 *
 * TGECS05C – 064300336010
 * TGECSM23A – 064300023010
 * TGT764ZM – 085570764010
 * ============================================================
 */

function extrairCabecalhoProduto(
  linha = ""
) {
  const codigos =
    extrairCodigosMarelli(
      linha
    );

  if (
    codigos.length === 0
  ) {
    return null;
  }

  const codigoLongo =
    extrairCodigoLongo(
      linha
    );

  if (!codigoLongo) {
    return null;
  }

  return {
    codigo:
      codigos[0],

    codigoLongo,
  };
}

/*
 * ============================================================
 * MAPA CÓDIGO LONGO
 * ============================================================
 */

function criarMapaCodigosLongos(
  texto = ""
) {
  const linhas =
    separarLinhas(texto);

  const mapa =
    new Map();

  for (
    const linha
    of linhas
  ) {
    const produto =
      extrairCabecalhoProduto(
        linha
      );

    if (!produto) {
      continue;
    }

    mapa.set(
      produto.codigo,
      produto.codigoLongo
    );
  }

  return mapa;
}

/*
 * ============================================================
 * MAPA OE
 * ============================================================
 */

function criarMapaOE(
  texto = ""
) {
  const linhas =
    separarLinhas(texto);

  const mapa =
    new Map();

  let codigoAtual =
    "";

  for (
    const linha
    of linhas
  ) {
    const produto =
      extrairCabecalhoProduto(
        linha
      );

    if (produto) {
      codigoAtual =
        produto.codigo;

      if (
        !mapa.has(codigoAtual)
      ) {
        mapa.set(
          codigoAtual,
          new Set()
        );
      }

      continue;
    }

    const codigosMarelli =
      extrairCodigosMarelli(
        linha
      );

    if (
      codigosMarelli.length > 0
    ) {
      codigoAtual =
        codigosMarelli[0];

      if (
        !mapa.has(codigoAtual)
      ) {
        mapa.set(
          codigoAtual,
          new Set()
        );
      }
    }

    if (!codigoAtual) {
      continue;
    }

    const oes =
      extrairCodigosOE(
        linha
      );

    for (
      const oe
      of oes
    ) {
      mapa
        .get(codigoAtual)
        .add(oe);
    }
  }

  return mapa;
}

/*
 * ============================================================
 * OBSERVAÇÃO TÉCNICA
 * ============================================================
 */

function criarObservacao({
  codigo,
  codigoLongo,
  direcao,
  tensao,
  contexto,
  oes = [],
}) {
  return [
    `Código Magneti Marelli: ${codigo}`,

    codigoLongo
      ? `Código longo Magneti Marelli: ${codigoLongo}`
      : "",

    direcao
      ? `Direção: ${direcao}`
      : "",

    tensao
      ? `Tensão: ${tensao} V`
      : "",

    oes.length > 0
      ? `OE: ${oes.join(", ")}`
      : "",

    contexto
      ? `Linha catálogo: ${contexto}`
      : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

/*
 * ============================================================
 * REGISTRO
 * ============================================================
 */

function criarRegistro({
  codigo,
  codigoLongo = "",
  montadora = "",
  modelo = "",
  contexto = "",
  oes = [],
  configuracao = {},
  nomeArquivo = "",
}) {
  const familia =
    identificarFamilia(
      codigo
    );

  const periodo =
    extrairPeriodo(
      contexto
    );

  const direcao =
    extrairDirecao(
      contexto
    );

  const tensao =
    extrairTensao(
      contexto
    );

  const equivalentes =
    [
      ...new Set(
        [
          codigoLongo,
          ...oes,
        ]
          .map(
            normalizarCodigo
          )
          .filter(Boolean)
      ),
    ];

  return {
    peca:
      familia.peca,

    descricao:
      familia.peca,

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

    montadora:
      montadora ||
      null,

    modelo:
      modelo ||
      null,

    motor:
      null,

    ano_inicio:
      periodo.ano_inicio,

    ano_fim:
      periodo.ano_fim,

    aplicacao:
      contexto ||
      null,

    observacao:
      criarObservacao({
        codigo,
        codigoLongo,
        direcao,
        tensao,
        contexto,
        oes,
      }),

    origem_catalogo:
      configuracao
        ?.origemCatalogo ||
      "Catálogo Magneti Marelli Wiping Systems 2024",

    arquivo_catalogo:
      nomeArquivo ||
      null,

    tipo_catalogo:
      "sistemas_limpadores",

    familia_catalogo:
      "Wiping Systems",

    categoria:
      familia.categoria,

    sistema:
      familia.sistema,

    tipo:
      familia.tipo,

    ativo:
      true,

    prioridade:
      1,

    confiabilidade:
      montadora &&
      modelo
        ? 96
        : 88,
  };
}

/*
 * ============================================================
 * PARSE — VEHICLE APPLICATION GUIDE
 * ============================================================
 */

function processarAplicacoes({
  texto = "",
  mapaCodigosLongos,
  mapaOE,
  configuracao,
  nomeArquivo,
}) {
  const linhas =
    separarLinhas(texto);

  const registros = [];

  let montadoraAtual =
    "";

  let modeloAtual =
    "";

  for (
    let indice = 0;
    indice < linhas.length;
    indice += 1
  ) {
    const linha =
      linhas[indice];

    const montadora =
      identificarMontadora(
        linha
      );

    if (montadora) {
      montadoraAtual =
        montadora;

      modeloAtual =
        "";

      continue;
    }

    if (
      ehCabecalho(linha)
    ) {
      continue;
    }

    const codigos =
      extrairCodigosMarelli(
        linha
      );

    /*
     * Linha com modelo/período,
     * mas sem código.
     */

    if (
      codigos.length === 0
    ) {
      if (
        pareceModelo(linha)
      ) {
        modeloAtual =
          limparModelo(
            linha
          );
      }

      continue;
    }

    /*
     * Se a mesma linha possuir modelo,
     * atualizamos antes de criar o registro.
     */

    if (
      /\d{1,2}\/\d{2}/.test(
        linha
      )
    ) {
      const candidato =
        limparModelo(
          linha
        );

      if (
        candidato &&
        !ehCodigoMarelli(
          candidato
        )
      ) {
        modeloAtual =
          candidato;
      }
    }

    /*
     * Algumas informações de aplicação
     * continuam na próxima linha.
     */

    const proximaLinha =
      linhas[
        indice + 1
      ] || "";

    const contexto =
      [
        linha,
        (
          extrairCodigosMarelli(
            proximaLinha
          ).length === 0 &&
          !identificarMontadora(
            proximaLinha
          )
        )
          ? proximaLinha
          : "",
      ]
        .filter(Boolean)
        .join(" ");

    for (
      const codigo
      of codigos
    ) {
      const codigoLongo =
        mapaCodigosLongos.get(
          codigo
        ) || "";

      const oesMapa =
        mapaOE.has(
          codigo
        )
          ? Array.from(
              mapaOE.get(
                codigo
              )
            )
          : [];

      const oesLinha =
        extrairCodigosOE(
          contexto
        );

      const oes = [
        ...new Set([
          ...oesMapa,
          ...oesLinha,
        ]),
      ];

      registros.push(
        criarRegistro({
          codigo,

          codigoLongo,

          montadora:
            montadoraAtual,

          modelo:
            modeloAtual,

          contexto,

          oes,

          configuracao,

          nomeArquivo,
        })
      );
    }
  }

  return registros;
}

/*
 * ============================================================
 * PARSE — BUYERS GUIDE
 * ============================================================
 *
 * Esse bloco é extremamente útil,
 * pois cada código aparece agrupado
 * com suas aplicações.
 * ============================================================
 */

function processarGuiaPorCodigo({
  texto = "",
  mapaOE,
  configuracao,
  nomeArquivo,
}) {
  const linhas =
    separarLinhas(texto);

  const registros = [];

  let codigoAtual =
    "";

  let codigoLongoAtual =
    "";

  let montadoraAtual =
    "";

  for (
    const linha
    of linhas
  ) {
    const produto =
      extrairCabecalhoProduto(
        linha
      );

    if (produto) {
      codigoAtual =
        produto.codigo;

      codigoLongoAtual =
        produto.codigoLongo;

      montadoraAtual =
        "";

      continue;
    }

    if (!codigoAtual) {
      continue;
    }

    const montadora =
      identificarMontadora(
        linha
      );

    if (montadora) {
      montadoraAtual =
        montadora;

      continue;
    }

    if (
      ehCabecalho(linha)
    ) {
      continue;
    }

    /*
     * Aplicação normalmente possui
     * período MM/AA.
     */

    if (
      !/\d{1,2}\/\d{2}/.test(
        linha
      )
    ) {
      continue;
    }

    const modelo =
      limparModelo(
        linha
      );

    if (!modelo) {
      continue;
    }

    const oesMapa =
      mapaOE.has(
        codigoAtual
      )
        ? Array.from(
            mapaOE.get(
              codigoAtual
            )
          )
        : [];

    const oesLinha =
      extrairCodigosOE(
        linha
      );

    const oes = [
      ...new Set([
        ...oesMapa,
        ...oesLinha,
      ]),
    ];

    registros.push(
      criarRegistro({
        codigo:
          codigoAtual,

        codigoLongo:
          codigoLongoAtual,

        montadora:
          montadoraAtual,

        modelo,

        contexto:
          linha,

        oes,

        configuracao,

        nomeArquivo,
      })
    );
  }

  return registros;
}

/*
 * ============================================================
 * DUPLICADOS
 * ============================================================
 */

function criarChaveRegistro(
  registro = {}
) {
  return [
    registro.codigo_oem,
    registro.montadora,
    registro.modelo,
    registro.ano_inicio,
    registro.ano_fim,
    registro.tipo,
  ]
    .map(
      normalizarTexto
    )
    .join("|");
}

function removerDuplicados(
  registros = []
) {
  const mapa =
    new Map();

  for (
    const registro
    of registros
  ) {
    const chave =
      criarChaveRegistro(
        registro
      );

    const existente =
      mapa.get(chave);

    if (!existente) {
      mapa.set(
        chave,
        registro
      );

      continue;
    }

    const equivalentes = [
      ...new Set([
        ...(
          existente
            .equivalentes ||
          []
        ),
        ...(
          registro
            .equivalentes ||
          []
        ),
      ]),
    ];

    mapa.set(
      chave,
      {
        ...existente,

        equivalentes,

        codigo_equivalente:
          equivalentes[0] ||
          existente
            .codigo_equivalente ||
          null,

        observacao:
          existente.observacao ||
          registro.observacao,
      }
    );
  }

  return Array.from(
    mapa.values()
  );
}

/*
 * ============================================================
 * PARSER PRINCIPAL
 * ============================================================
 */

export async function parserMagnetiMarelliLimpadores({
  textoReferencias = "",
  textoAplicacoes = "",
  textoEquivalencias = "",
  nomeArquivo = "",
  configuracao = {},
  onProgresso,
} = {}) {
  onProgresso?.(
    "🧽 Lendo Magneti Marelli Wiping Systems 2024..."
  );

  /*
   * O guia por código pode chegar em
   * referências ou aplicações,
   * dependendo da configuração usada
   * pelo motor.
   */

  const textoGuiaCodigo = [
    textoReferencias,
    textoAplicacoes,
  ]
    .filter(Boolean)
    .join("\n");

  /*
   * Códigos longos são extraídos
   * de cabeçalhos como:
   *
   * TGECSM23A – 064300023010
   */

  const mapaCodigosLongos =
    criarMapaCodigosLongos(
      textoGuiaCodigo
    );

  /*
   * OE pode vir da seção específica
   * e também dentro das próprias
   * aplicações.
   */

  const mapaOE =
    criarMapaOE(
      [
        textoEquivalencias,
        textoReferencias,
      ]
        .filter(Boolean)
        .join("\n")
    );

  /*
   * Aplicações por veículo.
   */

  const registrosAplicacoes =
    processarAplicacoes({
      texto:
        textoAplicacoes,

      mapaCodigosLongos,

      mapaOE,

      configuracao,

      nomeArquivo,
    });

  /*
   * Buyers guide.
   *
   * Além de complementar registros
   * ausentes, ajuda a associar
   * código longo e aplicação.
   */

  const registrosGuia =
    processarGuiaPorCodigo({
      texto:
        textoReferencias,

      mapaOE,

      configuracao,

      nomeArquivo,
    });

  const registrosUnicos =
    removerDuplicados([
      ...registrosAplicacoes,
      ...registrosGuia,
    ]);

  /*
   * ========================================================
   * DIAGNÓSTICOS
   * ========================================================
   */

  const tge511o =
    registrosUnicos.filter(
      (registro) =>
        normalizarCodigo(
          registro.codigo_oem
        ) ===
        "TGE511O"
    );

  const tgecsm23a =
    registrosUnicos.filter(
      (registro) =>
        normalizarCodigo(
          registro.codigo_oem
        ) ===
        "TGECSM23A"
    );

  const tgt764zm =
    registrosUnicos.filter(
      (registro) =>
        normalizarCodigo(
          registro.codigo_oem
        ) ===
        "TGT764ZM"
    );

  console.log(
    "=========================================="
  );

  console.log(
    "🧽 MAGNETI MARELLI — WIPING SYSTEMS 2024"
  );

  console.log(
    "ARQUIVO:",
    nomeArquivo
  );

  console.log(
    "MAPA CÓDIGOS LONGOS:",
    mapaCodigosLongos.size
  );

  console.log(
    "MAPA OE:",
    mapaOE.size
  );

  console.log(
    "APLICAÇÕES:",
    registrosAplicacoes.length
  );

  console.log(
    "GUIA POR CÓDIGO:",
    registrosGuia.length
  );

  console.log(
    "REGISTROS ÚNICOS:",
    registrosUnicos.length
  );

  console.log(
    "🎯 TGE511O:",
    tge511o.slice(0, 10)
  );

  console.log(
    "🎯 TGECSM23A:",
    tgecsm23a.slice(0, 10)
  );

  console.log(
    "🎯 TGT764ZM:",
    tgt764zm.slice(0, 10)
  );

  console.log(
    "=========================================="
  );

  onProgresso?.(
    `✅ Magneti Marelli Wiping Systems: ${registrosUnicos.length} registro(s) encontrado(s).`
  );

  return registrosUnicos;
}

export default parserMagnetiMarelliLimpadores;