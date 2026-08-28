/*
 * ============================================================
 * APPIA AI
 * PARSER UNIVERSAL MAGNETI MARELLI
 * ============================================================
 *
 * Objetivo:
 *
 * Interpretar catálogos Magneti Marelli que seguem estrutura
 * semelhante sem precisar criar um parser gigante para cada
 * nova categoria.
 *
 * Os parsers específicos já aprovados continuam funcionando.
 * Este parser será usado como fallback para novos catálogos.
 * ============================================================
 */

function limparTexto(valor = "") {
  return String(valor || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
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

function normalizarCodigoEquivalente(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9.\-]/g, "")
    .trim();
}

function numeroOuNull(valor) {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : null;
}

/*
 * ============================================================
 * MARCADORES DE PÁGINA
 * ============================================================
 */

function ehMarcadorPagina(linha = "") {
  const texto =
    normalizarTexto(linha);

  if (!texto) {
    return false;
  }

  return (
    /^-*\s*PAGINA\s+\d+\s*-*$/.test(
      texto
    ) ||
    /^-*\s*PAGE\s+\d+\s*-*$/.test(
      texto
    )
  );
}

/*
 * ============================================================
 * MONTADORAS
 * ============================================================
 */

const MONTADORAS = [
  "ABARTH",
  "AGCO",
  "AGRale",
  "ALFA ROMEO",
  "AUDI",
  "BMW",
  "CASE",
  "CATERPILLAR",
  "CHEVROLET",
  "CHRYSLER",
  "CITROEN",
  "DACIA",
  "DAF",
  "DODGE",
  "FIAT",
  "FORD",
  "HONDA",
  "HYUNDAI",
  "IVECO",
  "JAGUAR",
  "JEEP",
  "JOHN DEERE",
  "KIA",
  "LADA",
  "LANCIA",
  "LAND ROVER",
  "MAN",
  "MASERATI",
  "MASSEY FERGUSON",
  "MAZDA",
  "MERCEDES-BENZ",
  "MERCEDES BENZ",
  "MINI",
  "MITSUBISHI",
  "NISSAN",
  "OPEL",
  "PEUGEOT",
  "PORSCHE",
  "RENAULT",
  "ROVER",
  "SAAB",
  "SCANIA",
  "SEAT",
  "SKODA",
  "SMART",
  "SSANGYONG",
  "SUBARU",
  "SUZUKI",
  "TOYOTA",
  "VALTRA",
  "VAUXHALL",
  "VOLKSWAGEN",
  "VOLVO",
];

function identificarMontadora(linha = "") {
  const texto =
    normalizarTexto(linha);

  if (!texto) {
    return "";
  }

  for (const montadora of MONTADORAS) {
    const montadoraNormalizada =
      normalizarTexto(montadora);

    if (
      texto === montadoraNormalizada ||
      texto.startsWith(
        `${montadoraNormalizada} `
      )
    ) {
      return montadora.replace(
        "AGRale",
        "Agrale"
      );
    }
  }

  return "";
}

/*
 * ============================================================
 * ANOS
 * ============================================================
 */

function extrairAnos(linha = "") {
  const texto =
    limparTexto(linha);

  const anos = [
    ...texto.matchAll(
      /\b(19\d{2}|20\d{2})\b/g
    ),
  ].map(
    (match) =>
      Number(match[1])
  );

  if (!anos.length) {
    return {
      ano_inicio: null,
      ano_fim: null,
    };
  }

  return {
    ano_inicio:
      numeroOuNull(
        Math.min(...anos)
      ),

    ano_fim:
      numeroOuNull(
        Math.max(...anos)
      ),
  };
}

/*
 * ============================================================
 * CÓDIGOS
 * ============================================================
 */

function pareceCodigo(valor = "") {
  const codigo =
    normalizarCodigo(valor);

  if (
    codigo.length < 4 ||
    codigo.length > 20
  ) {
    return false;
  }

  if (
    !/[A-Z]/.test(codigo) &&
    !/\d/.test(codigo)
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

  if (!/\d/.test(codigo)) {
    return false;
  }

  return true;
}

function extrairCodigos(linha = "") {
  const texto =
    limparTexto(linha);

  if (!texto) {
    return [];
  }

  if (
    ehMarcadorPagina(texto)
  ) {
    return [];
  }

  const tokens =
    texto.split(
      /[\s|;,()[\]{}]+/
    );

  const encontrados = [];

  for (const token of tokens) {
    const codigo =
      normalizarCodigo(token);

    if (
      pareceCodigo(codigo)
    ) {
      encontrados.push(
        codigo
      );
    }
  }

  return [
    ...new Set(
      encontrados
    ),
  ];
}

/*
 * ============================================================
 * DETECÇÃO DE LINHAS INÚTEIS
 * ============================================================
 */

function ehCabecalho(linha = "") {
  const texto =
    normalizarTexto(linha);

  if (!texto) {
    return true;
  }

  if (
    ehMarcadorPagina(texto)
  ) {
    return true;
  }

  const palavras = [
    "APPLICATION",
    "APPLICATIONS",
    "APPLICAZIONE",
    "APPLICAZIONI",
    "VEHICLE",
    "VEHICLES",
    "MODEL",
    "MODELLO",
    "ENGINE",
    "MOTORE",
    "YEAR",
    "YEARS",
    "FROM",
    "TO",
    "CODE",
    "CODICE",
    "REFERENCE",
    "REFERENCES",
    "CROSS REFERENCE",
    "CROSS REFERENCES",
    "MAGNETI MARELLI",
    "MARELLI AFTERMARKET",
    "CONTENTS",
    "INDEX",
  ];

  return palavras.some(
    (palavra) =>
      texto === palavra
  );
}

/*
 * ============================================================
 * TIPO DE PEÇA
 * ============================================================
 */

function identificarPeca(
  configuracao = {}
) {
  const tipo =
    String(
      configuracao?.tipoCatalogo ||
      ""
    )
      .trim()
      .toLowerCase();

  const mapa = {
    bombas_agua:
      "Bomba de Água",

    termostatos:
      "Termostato",

    timing_chain_kit:
      "Kit Corrente de Distribuição",

    kits_distribuicao:
      "Kit de Distribuição",

    discos_freio:
      "Disco de Freio",

    filtros:
      "Filtro",

    alternadores:
      "Alternador",

    motores_partida:
      "Motor de Partida",

    alternadores_motores_partida:
      "Alternador / Motor de Partida",

    sistema_combustivel:
      "Sistema de Combustível",

    sistemas_eletronicos:
      "Sistema Eletrônico",

    sensores:
      "Sensor",

    velas_aquecedoras:
      "Vela Aquecedora",

    velas_ignicao:
      "Vela de Ignição",

    cabos_ignicao:
      "Cabo de Ignição",

    iluminacao:
      "Iluminação",

    amortecedores:
      "Amortecedor",

    molas_pneumaticas:
      "Mola Pneumática",

    compressores_pneumaticos:
      "Compressor Pneumático",

    retrovisores:
      "Retrovisor",

    sistemas_termicos:
      "Sistema Térmico",

    corrente_distribuicao:
      "Kit Corrente de Distribuição",

    bracos_suspensao:
      "Braço de Suspensão",

    maquinas_vidro:
      "Máquina de Vidro",

    sistema_limpador:
      "Sistema Limpador",

    palhetas:
      "Palheta",

    comandos_eletricos:
      "Comando Elétrico",

    transmissao:
      "Componente de Transmissão",

    coxins:
      "Coxim",

    baterias:
      "Bateria",

    baterias_2024:
      "Bateria",

    carburadores:
      "Carburador",

    oleos:
      "Óleo",
  };

  return (
    mapa[tipo] ||
    "Peça Automotiva"
  );
}

/*
 * ============================================================
 * SISTEMAS ELETRÔNICOS MARELLI
 * ============================================================
 */

function ehDescricaoTecnicaSistemasEletronicos(
  linha = ""
) {
  const texto =
    normalizarTexto(linha);

  if (!texto) {
    return false;
  }

  const termos = [
    "THROTTLE BODY",
    "CORPO FARFALLATO",
    "FUEL INJECTOR",
    "INIETTORE",
    "ENGINE CONTROL UNIT",
    "CENTRALINA CONTROLLO MOTORE",
    "CENTRALINA ELETTRONICA",
    "STEPPER MOTOR",
    "IDLE SPEED CONTROL ACTUATOR",
    "ATTUATORE CONTROLLO MINIMO",
    "ACCELERATOR PEDAL SENSOR",
    "SENSORE PEDALE ACCELERATORE",
    "SWIRL FLAP ACTUATOR",
    "REGOLATORE VALVOLE CONDOTTO ASPIRAZIONE",
    "CANISTER VALVE",
    "VALVOLA CANISTER",
    "INTAKE MANIFOLD",
    "MODULO COLLETTORE ASPIRAZIONE",
    "CABLE FOR THROTTLE BODY",
    "CABLAGGIO PER CORPO FARFALLATO",
    "CONNECTION TUBE",
    "TUBETTO RACCORDO",
    "OTHER PARTS",
    "SERVICE PART",
    "SERVICE PARTS",
    "TYPE TYPE",
    "KW TYPE",
    "GROUP A",
    "GROUP B",
    "GROUP C",
    "GROUP D",
    "GRUPPO A",
    "GRUPPO B",
    "GRUPPO C",
    "GRUPPO D",
  ];

  return termos.some(
    (termo) =>
      texto.includes(termo)
  );
}
function identificarPecaSistemasEletronicos(
  linha = "",
  codigoCurto = ""
) {
  const texto =
    normalizarTexto(
      `${linha} ${codigoCurto}`
    );

  const codigo =
    normalizarCodigo(
      codigoCurto
    );

  /*
   * ========================================================
   * CORPO DE BORBOLETA
   * ========================================================
   */

  if (
    texto.includes(
      "THROTTLE BODY"
    ) ||
    texto.includes(
      "CORPO FARFALLATO"
    ) ||
    /^TB\d/.test(
      codigo
    ) ||
    /^48CPD/.test(
      codigo
    )
  ) {
    return "Corpo de Borboleta";
  }

  /*
   * ========================================================
   * BICOS INJETORES
   * ========================================================
   *
   * Catálogo Magneti Marelli:
   *
   * FEIxxx
   * IPMxxx
   * IWPxxx
   *
   * Todos pertencem ao grupo:
   *
   * INIETTORE / FUEL INJECTOR
   * ========================================================
   */

  if (
    texto.includes(
      "FUEL INJECTOR"
    ) ||
    texto.includes(
      "INIETTORE"
    ) ||
    /^FEI[A-Z0-9]/.test(
      codigo
    ) ||
    /^IPM[A-Z0-9]/.test(
      codigo
    ) ||
    /^IWP[A-Z0-9]/.test(
      codigo
    )
  ) {
    return "Injetor de Combustível";
  }

  /*
   * ========================================================
   * MÓDULO DE INJEÇÃO
   * ========================================================
   */

  if (
    texto.includes(
      "ENGINE CONTROL UNIT"
    ) ||
    texto.includes(
      "CENTRALINA CONTROLLO MOTORE"
    ) ||
    texto.includes(
      "CENTRALINA ELETTRONICA"
    ) ||
    /^IAW/.test(
      codigo
    ) ||
    /^MJD/.test(
      codigo
    )
  ) {
    return "Módulo de Injeção";
  }

  /*
   * ========================================================
   * SENSOR PEDAL ACELERADOR
   * ========================================================
   */

  if (
    texto.includes(
      "ACCELERATOR PEDAL SENSOR"
    ) ||
    texto.includes(
      "SENSORE PEDALE ACCELERATORE"
    ) ||
    /^PAS\d/.test(
      codigo
    )
  ) {
    return "Sensor do Pedal do Acelerador";
  }

  /*
   * ========================================================
   * ATUADOR MARCHA LENTA
   * ========================================================
   */

  if (
    texto.includes(
      "STEPPER MOTOR"
    ) ||
    texto.includes(
      "IDLE SPEED CONTROL ACTUATOR"
    ) ||
    texto.includes(
      "ATTUATORE CONTROLLO MINIMO"
    ) ||
    /^B\d/.test(
      codigo
    )
  ) {
    return "Atuador de Marcha Lenta";
  }

  /*
   * ========================================================
   * ATUADOR COLETOR
   * ========================================================
   */

  if (
    texto.includes(
      "SWIRL FLAP ACTUATOR"
    ) ||
    texto.includes(
      "REGOLATORE VALVOLE CONDOTTO ASPIRAZIONE"
    )
  ) {
    return "Atuador do Coletor de Admissão";
  }

  /*
   * ========================================================
   * CANISTER
   * ========================================================
   */

  if (
    texto.includes(
      "CANISTER VALVE"
    ) ||
    texto.includes(
      "VALVOLA CANISTER"
    )
  ) {
    return "Válvula Canister";
  }

  /*
   * ========================================================
   * COLETOR ADMISSÃO
   * ========================================================
   */

  if (
    texto.includes(
      "INTAKE MANIFOLD"
    ) ||
    texto.includes(
      "MODULO COLLETTORE ASPIRAZIONE"
    )
  ) {
    return "Coletor de Admissão";
  }

  /*
   * ========================================================
   * CHICOTE CORPO BORBOLETA
   * ========================================================
   */

  if (
    texto.includes(
      "CABLE FOR THROTTLE BODY"
    ) ||
    texto.includes(
      "CABLAGGIO PER CORPO FARFALLATO"
    )
  ) {
    return "Chicote do Corpo de Borboleta";
  }

  /*
   * ========================================================
   * TUBO
   * ========================================================
   */

  if (
    texto.includes(
      "CONNECTION TUBE"
    ) ||
    texto.includes(
      "TUBETTO RACCORDO"
    )
  ) {
    return "Tubo de Conexão";
  }

  return "Sistema Eletrônico";
}

/*
 * ============================================================
 * CÓDIGO LONGO MAGNETI MARELLI
 * ============================================================
 */

function extrairCodigoLongoMarelli(
  linha = ""
) {
  const texto =
    limparTexto(
      linha
    );

  const encontrados = [
    ...texto.matchAll(
      /\b\d{12}\b/g
    ),
  ].map(
    (match) =>
      normalizarCodigo(
        match[0]
      )
  );

  return encontrados[0] || "";
}

/*
 * ============================================================
 * CÓDIGO CURTO SISTEMAS ELETRÔNICOS
 * ============================================================
 */

function extrairCodigoCurtoSistemasEletronicos(
  linha = "",
  codigoLongo = ""
) {
  const texto =
    limparTexto(
      linha
    );

  /*
   * Ordem importante:
   *
   * primeiro códigos específicos,
   * depois padrões genéricos.
   */

  const padroes = [
    /*
     * Corpo de borboleta
     */

    /\bTB\d{4}-?\d\b/i,

    /\b48CPD[A-Z0-9.-]*\b/i,

    /*
     * Bicos injetores
     */

    /\bFEI[A-Z0-9.-]+\b/i,

    /\bIPM[A-Z0-9.-]+\b/i,

    /\bIWP[A-Z0-9.-]+\b/i,

    /*
     * Pedal
     */

    /\bPAS[A-Z0-9.-]+\b/i,

    /*
     * ECU
     */

    /\bIAW[A-Z0-9.-]+\b/i,

    /\bMJD[A-Z0-9.-]+\b/i,

    /*
     * Atuador
     */

    /\bB\d{3,}[A-Z0-9.-]*\b/i,
  ];

  for (
    const padrao
    of padroes
  ) {
    const encontrado =
      texto.match(
        padrao
      )?.[0] || "";

    if (
      encontrado
    ) {
      return normalizarCodigoEquivalente(
        encontrado
      );
    }
  }

  /*
   * ========================================================
   * FALLBACK
   * ========================================================
   */

  const codigos =
    extrairCodigos(
      linha
    )
      .filter(
        (codigo) =>
          codigo !==
          codigoLongo
      );

  const candidato =
    codigos.find(
      (codigo) =>
        /^(TB|48CPD|FEI|IPM|IWP|PAS|IAW|MJD|B\d)/i.test(
          codigo
        )
    ) || "";

  /*
   * TB00131 -> TB0013-1
   */

  if (
    /^TB\d{5}$/i.test(
      candidato
    )
  ) {
    return `${candidato.slice(
      0,
      -1
    )}-${candidato.slice(
      -1
    )}`;
  }

  return candidato;
}

/*
 * ============================================================
 * IDENTIFICA CÓDIGO CURTO DE SISTEMAS ELETRÔNICOS
 * ============================================================
 */

function ehCodigoCurtoSistemasEletronicos(
  codigo = ""
) {
  const valor =
    normalizarCodigo(
      codigo
    );

  return (
    /^(TB|48CPD|FEI|IPM|IWP|PAS|IAW|MJD|B\d)/i.test(
      valor
    )
  );
}

function criarMapaCodigosSistemasEletronicos(
  linhas = []
) {
  const mapa = new Map();

  for (const linha of linhas) {
    const codigoLongo =
      extrairCodigoLongoMarelli(
        linha
      );

    if (!codigoLongo) {
      continue;
    }

    const codigoCurto =
      extrairCodigoCurtoSistemasEletronicos(
        linha,
        codigoLongo
      );

    if (
      codigoCurto &&
      !mapa.has(codigoLongo)
    ) {
      mapa.set(
        codigoLongo,
        codigoCurto
      );
    }
  }

  return mapa;
}

function extrairMotorSistemasEletronicos(
  linha = ""
) {
  const texto =
    limparTexto(linha);

  const partes =
    texto.split(
      /\b(?:PETROL|DIESEL|BENZINA|GASOLINE)\b/i
    );

  if (
    partes.length < 2
  ) {
    return "";
  }

  return limparTexto(
    partes[0]
  );
}
/*
 * ============================================================
 * BICOS INJETORES MARELLI 2016
 * ============================================================
 *
 * Layout real das páginas 1363-1379:
 *
 * IWP099
 * INIETTORE
 * FUEL INJECTOR
 * RENAULT
 * CLIO II (BB0/1/2_, CB0/1/2_)
 * 1.2 16V (...)
 * Petrol 55 06/01 à
 * ENGINE: D4F712...
 *
 * O objetivo é transformar esse bloco em:
 *
 * código
 * montadora
 * modelo
 * motor
 * período
 * aplicação
 * ============================================================
 */

function extrairCodigoBicoMarelli(
  linha = ""
) {
  const texto =
    limparTexto(
      linha
    )
      .toUpperCase();

  const encontrado =
    texto.match(
      /\b(?:IWP|IPM|FEI)[A-Z0-9./-]+\b/i
    )?.[0] || "";

  return encontrado
    ? encontrado.toUpperCase()
    : "";
}

function ehCodigoBicoMarelli(
  linha = ""
) {
  const texto =
    limparTexto(
      linha
    )
      .toUpperCase();

  const codigo =
    extrairCodigoBicoMarelli(
      texto
    );

  if (!codigo) {
    return false;
  }

  /*
   * Catálogo 2016:
   *
   * dependendo da extração do PDF, o código pode chegar como:
   *
   * IWP099
   * IWP099 INIETTORE
   * IWP099 FUEL INJECTOR
   * IWP099 INIETTORE FUEL INJECTOR
   *
   * ou acompanhado de pequenos resíduos de cabeçalho.
   *
   * Como este teste roda somente dentro do parser dedicado
   * aos bicos, podemos aceitar linhas curtas que contenham
   * um código FEI / IPM / IWP sem tratar aplicações como código.
   */

  if (
    texto === codigo ||
    texto === `${codigo} INIETTORE` ||
    texto === `${codigo} FUEL INJECTOR` ||
    texto ===
      `${codigo} INIETTORE FUEL INJECTOR`
  ) {
    return true;
  }

  /*
   * Não aceitar linhas de aplicação/equivalência.
   */

  if (
    texto.length > 80 ||
    identificarMontadora(
      texto
    ) ||
    /\b(?:ENGINE|PETROL|DIESEL|BENZINA|GASOLINE|KW)\b/i.test(
      texto
    )
  ) {
    return false;
  }

  const codigosBico = [
    ...texto.matchAll(
      /\b(?:IWP|IPM|FEI)[A-Z0-9./-]+\b/gi
    ),
  ].map(
    (match) =>
      String(
        match[0] || ""
      ).toUpperCase()
  );

  /*
   * Se existe somente um código de bico na linha curta,
   * tratamos como início de bloco.
   */

  return (
    codigosBico.length === 1 &&
    codigosBico[0] === codigo
  );
}
function normalizarCodigoBicoMarelli(
  valor = ""
) {
  return limparTexto(
    valor
  )
    .toUpperCase()
    .replace(
      /\s+/g,
      ""
    );
}

function ehMontadoraBicoMarelli(
  linha = ""
) {
  const texto =
    normalizarTexto(
      linha
    );

  return MONTADORAS.some(
    (montadora) =>
      texto ===
      normalizarTexto(
        montadora
      )
  );
}

function extrairModeloBicoMarelli(
  linha = ""
) {
  const texto =
    limparTexto(
      linha
    );

  if (!texto) {
    return "";
  }

  /*
   * Exemplos válidos:
   *
   * CLIO II (BB0/1/2_, CB0/1/2_)
   * KANGOO (KC0/1_)
   * KANGOO Express (FC0/1_)
   * THALIA I (LB0/1/2_)
   * TWINGO I (C06_)
   */

  if (
    !/[A-ZÀ-Ü]/i.test(
      texto
    ) ||
    !texto.includes("(") ||
    !texto.includes(")")
  ) {
    return "";
  }

  /*
   * Não confundir motor/versão:
   *
   * 1.2 16V (BB05...)
   * 2.0 Turbo (KG0S...)
   */

  if (
    /^\s*\d/.test(
      texto
    )
  ) {
    return "";
  }

  if (
    /^ENGINE\s*:/i.test(
      texto
    )
  ) {
    return "";
  }

  if (
    /^(PETROL|DIESEL|BENZINA|GASOLINE)\b/i.test(
      texto
    )
  ) {
    return "";
  }

  const modelo =
    texto
      .replace(
        /\s*\([^)]*\)\s*$/,
        ""
      )
      .trim();

  if (
    !modelo ||
    modelo.length < 2
  ) {
    return "";
  }

  return modelo;
}

function converterAnoCurtoMarelli(
  valor
) {
  const numero =
    Number(
      valor
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

function extrairPeriodoBicoMarelli(
  texto = ""
) {
  const encontrados = [
    ...String(
      texto || ""
    ).matchAll(
      /\b(\d{2})\/(\d{2})\b/g
    ),
  ];

  if (
    encontrados.length === 0
  ) {
    return {
      ano_inicio: null,
      ano_fim: null,
    };
  }

  const primeiro =
    encontrados[0];

  const anoInicio =
    converterAnoCurtoMarelli(
      primeiro[2]
    );

  if (
    encontrados.length === 1
  ) {
    return {
      ano_inicio:
        anoInicio,

      ano_fim:
        null,
    };
  }

  const ultimo =
    encontrados[
      encontrados.length - 1
    ];

  return {
    ano_inicio:
      anoInicio,

    ano_fim:
      converterAnoCurtoMarelli(
        ultimo[2]
      ),
  };
}

function extrairMotorBicoMarelli(
  texto = ""
) {
  const original =
    limparTexto(
      texto
    );

  /*
   * Pega somente a descrição base.
   *
   * Exemplos:
   *
   * 1.2 16V
   * 1.6 16V
   * 2.0 16V Turbo
   * 1100
   */

  const encontrado =
    original.match(
      /\b(?:\d[.,]\d|[789]\d{2}|1\d{3}|2\d{3})(?:\s+(?:6V|8V|12V|16V|20V|24V))?(?:\s+(?:TURBO|JTD|JTDM|TDI|HDI|TSI|TFSI|MPI))?/i
    )?.[0] || "";

  return limparTexto(
    encontrado
  );
}

function extrairCodigosMotorBicoMarelli(
  texto = ""
) {
  const original =
    limparTexto(
      texto
    );

  const parteEngine =
    original.match(
      /ENGINE\s*:\s*(.+)$/i
    )?.[1] || "";

  if (
    !parteEngine
  ) {
    return [];
  }

  return [
    ...new Set(
      parteEngine
        .split(
          /[\s,;/]+/
        )
        .map(
          (item) =>
            limparTexto(
              item
            )
              .replace(
                /[^A-Z0-9.-]/gi,
                ""
              )
              .toUpperCase()
        )
        .filter(
          (item) =>
            item &&
            /[A-Z]/.test(
              item
            ) &&
            /\d/.test(
              item
            )
        )
    ),
  ];
}

function ehLinhaEstruturalBicoMarelli(
  linha = ""
) {
  const texto =
    normalizarTexto(
      linha
    );

  if (!texto) {
    return true;
  }

  return (
    texto === "INIETTORE" ||
    texto === "FUEL INJECTOR" ||
    texto === "B" ||
    texto === "KW" ||
    texto === "B KW" ||
    texto === "TYPE" ||
    texto === "TYPE TYPE" ||
    texto === "GROUP C" ||
    texto === "GRUPPO C" ||
    texto === "MAGNETI MARELLI"
  );
}

function parserBicosInjetoresMarelli2016({
  linhas = [],
  configuracao = {},
  nomeArquivo = "",
}) {
  const registros =
    [];

  let codigoAtual =
    "";

  let montadoraAtual =
    "";

  let modeloAtual =
    "";

  let linhasAplicacao =
    [];

  /*
   * ========================================================
   * FINALIZA UM VEÍCULO
   * ========================================================
   */

  function finalizarModelo() {
    if (
      !codigoAtual ||
      !montadoraAtual ||
      !modeloAtual
    ) {
      linhasAplicacao = [];

      return;
    }

    const textoAplicacao =
      limparTexto(
        linhasAplicacao.join(
          " "
        )
      );

    /*
     * Modelo sem informação técnica
     * não será gravado.
     */

    if (
      !textoAplicacao
    ) {
      linhasAplicacao = [];

      return;
    }

    const {
      ano_inicio,
      ano_fim,
    } =
      extrairPeriodoBicoMarelli(
        textoAplicacao
      );

    const motor =
      extrairMotorBicoMarelli(
        textoAplicacao
      );

    const codigosMotor =
      extrairCodigosMotorBicoMarelli(
        textoAplicacao
      );

    const codigoOriginal =
      normalizarCodigoBicoMarelli(
        codigoAtual
      );

    const codigoCompacto =
      normalizarCodigo(
        codigoAtual
      );

    const observacoes = [
      textoAplicacao,

      codigosMotor.length
        ? `Códigos motor: ${codigosMotor.join(
            ", "
          )}`
        : "",
    ]
      .filter(Boolean)
      .join(" | ");

    registros.push({
      peca:
        "Injetor de Combustível",

      descricao:
        "Injetor de Combustível",

      /*
       * Pesquisa principal:
       *
       * IWP099
       * IWP1161
       */

      codigo_oem:
        codigoCompacto,

      /*
       * Mantemos a grafia original
       * para códigos como IWP116/1.
       */

      codigo_equivalente:
        codigoOriginal,

      equivalentes: [
        codigoOriginal,
        codigoCompacto,
      ].filter(Boolean),

      fabricante:
        "Magneti Marelli",

      montadora:
        montadoraAtual,

      modelo:
        modeloAtual,

      motor:
        motor ||
        null,

      ano_inicio,

      ano_fim,

      aplicacao:
        textoAplicacao,

      observacao:
        observacoes,

      origem_catalogo:
        configuracao
          ?.origemCatalogo ||
        "Catálogo Magneti Marelli Bicos Injetores 2016",

      arquivo_catalogo:
        nomeArquivo ||
        null,

      tipo_catalogo:
        "sistemas_eletronicos",

      ativo:
        true,
    });

    linhasAplicacao =
      [];
  }

  /*
   * ========================================================
   * LEITURA
   * ========================================================
   */

  for (
    let indice = 0;
    indice <
    linhas.length;
    indice += 1
  ) {
    const linha =
      limparTexto(
        linhas[indice]
      );

    if (
      !linha ||
      ehMarcadorPagina(
        linha
      )
    ) {
      continue;
    }

    /*
     * ======================================================
     * NOVO CÓDIGO DE BICO
     * ======================================================
     */

    if (
      ehCodigoBicoMarelli(
        linha
      )
    ) {
      finalizarModelo();

      codigoAtual =
        extrairCodigoBicoMarelli(
          linha
        );

      montadoraAtual =
        "";

      modeloAtual =
        "";

      linhasAplicacao =
        [];

      continue;
    }

    if (
      !codigoAtual
    ) {
      continue;
    }

    /*
     * ======================================================
     * IGNORA CABEÇALHOS
     * ======================================================
     */

    if (
      ehLinhaEstruturalBicoMarelli(
        linha
      )
    ) {
      continue;
    }

    /*
     * ======================================================
     * MONTADORA
     * ======================================================
     */

    if (
      ehMontadoraBicoMarelli(
        linha
      )
    ) {
      finalizarModelo();

      montadoraAtual =
        identificarMontadora(
          linha
        );

      modeloAtual =
        "";

      linhasAplicacao =
        [];

      continue;
    }

    /*
     * ======================================================
     * MODELO
     * ======================================================
     */

    const modelo =
      extrairModeloBicoMarelli(
        linha
      );

    if (
      modelo
    ) {
      finalizarModelo();

      modeloAtual =
        modelo;

      linhasAplicacao =
        [];

      continue;
    }

    /*
     * ======================================================
     * CONTEÚDO DA APLICAÇÃO
     * ======================================================
     *
     * Depois que temos:
     *
     * código
     * montadora
     * modelo
     *
     * tudo até o próximo modelo pertence
     * à aplicação atual.
     * ======================================================
     */

    if (
      montadoraAtual &&
      modeloAtual
    ) {
      linhasAplicacao.push(
        linha
      );
    }
  }

  finalizarModelo();

  const registrosUnicos =
    removerDuplicados(
      registros
    );

  /*
   * ========================================================
   * DIAGNÓSTICO
   * ========================================================
   */

  const testeIwp099 =
    registrosUnicos.filter(
      (registro) =>
        normalizarCodigo(
          registro.codigo_oem
        ) ===
        "IWP099"
    );

  console.log(
    "=========================================="
  );

  console.log(
    "💉 PARSER BICOS MARELLI 2016"
  );

  console.log(
    "TOTAL:",
    registrosUnicos.length
  );

  console.log(
    "IWP099:",
    testeIwp099
  );

  console.log(
    "=========================================="
  );

  return registrosUnicos;
}

 
/*
 * ============================================================
 * MODELO / MOTOR
 * ============================================================
 */

function pareceModelo(linha = "") {
  const texto =
    limparTexto(linha);

  if (
    !texto ||
    texto.length < 2 ||
    texto.length > 120
  ) {
    return false;
  }

  if (
    ehMarcadorPagina(texto)
  ) {
    return false;
  }

  if (
    /^\d+$/.test(texto)
  ) {
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

  const textoNormalizado =
    normalizarTexto(texto);

  /*
   * ========================================================
   * PALAVRA REPETIDA
   * ========================================================
   *
   * BOSCH BOSCH BOSCH
   * BREMBO BREMBO BREMBO
   * TRW TRW
   * ATE ATE ATE
   *
   * Não são modelos.
   * ========================================================
   */

  const palavras =
    textoNormalizado
      .split(/\s+/)
      .filter(Boolean);

  if (
    palavras.length >= 2
  ) {
    const primeira =
      palavras[0];

    const todasIguais =
      palavras.every(
        (palavra) =>
          palavra === primeira
      );

    if (todasIguais) {
      return false;
    }
  }

  /*
   * ========================================================
   * FABRICANTES / MARCAS
   * ========================================================
   */

  const fabricantes = [
    "BOSCH",
    "BREMBO",
    "TRW",
    "ATE",
    "DELPHI",
    "FERODO",
    "TEXTAR",
    "PAGID",
    "VALEO",
    "MAGNETI MARELLI",
    "MARELLI",
    "JURID",
    "REMSA",
    "ROADHOUSE",
    "ZIMMERMANN",
    "FEBI",
    "MEYLE",
    "SKF",
  ];

  if (
    fabricantes.includes(
      textoNormalizado
    )
  ) {
    return false;
  }

  /*
   * ========================================================
   * LINHA FORMADA POR CÓDIGOS
   * ========================================================
   */

  const tokens =
    texto
      .split(
        /[\s,;|/()[\]{}]+/
      )
      .map(
        (item) =>
          limparTexto(item)
      )
      .filter(Boolean);

  const tokensCodigo =
    tokens.filter(
      (token) => {
        const codigo =
          normalizarCodigo(
            token
          );

        if (
          codigo.length < 5 ||
          codigo.length > 25
        ) {
          return false;
        }

        /*
         * Código numérico longo
         *
         * 0986479173
         * 34111164539
         */

        if (
          /^\d{6,25}$/.test(
            codigo
          )
        ) {
          return true;
        }

        /*
         * Código alfanumérico
         *
         * 5N0615301
         * MBD0679
         * DF1455
         */

        if (
          /[A-Z]/.test(codigo) &&
          /\d/.test(codigo) &&
          codigo.length >= 5
        ) {
          return true;
        }

        return false;
      }
    );

  /*
   * Se toda ou quase toda a linha
   * é formada por códigos,
   * não é modelo.
   */

  if (
    tokensCodigo.length >= 2
  ) {
    return false;
  }

  if (
    tokens.length === 1 &&
    tokensCodigo.length === 1
  ) {
    return false;
  }

  /*
   * ========================================================
   * TERMOS ESTRUTURAIS
   * ========================================================
   */

  const termosEstruturais = [
    "LONG SHORT",
    "SHORT LONG",
    "LIFE-TIME-FILTER",
    "LIFETIME FILTER",
    "TECHNICAL DATA",
    "DIMENSIONS",
    "IMAGE",
    "IMAGES",
    "ILLUSTRATION",
    "ILLUSTRATIVE",
    "FILTERS ACTUAL SHAPE",

    /*
     * Brake Discs
     */

    "BRAKE DISC",
    "BRAKE DISCS",
    "BRAKE DISK",
    "BRAKE DISKS",
    "DISCO FRENO",
    "DISCHI FRENO",
    "CROSS REFERENCE",
    "CROSS REFERENCES",
    "OE NUMBER",
    "OE NUMBERS",
    "OES NUMBER",
    "OES NUMBERS",
    "PART NUMBER",
    "PART NUMBERS",
    "REFERENCE",
    "REFERENCES",

    /*
     * Electronic Systems
     */

    "PARTS",
    "OTHER PARTS",
    "SERVICE PART",
    "SERVICE PARTS",
    "THROTTLE BODY",
    "CORPO FARFALLATO",
    "FUEL INJECTOR",
    "INIETTORE",
    "ENGINE CONTROL UNIT",
    "CENTRALINA CONTROLLO MOTORE",
    "CENTRALINA ELETTRONICA",
    "STEPPER MOTOR",
    "IDLE SPEED CONTROL ACTUATOR",
    "ATTUATORE CONTROLLO MINIMO",
    "ACCELERATOR PEDAL SENSOR",
    "SENSORE PEDALE ACCELERATORE",
    "SWIRL FLAP ACTUATOR",
    "CANISTER VALVE",
    "INTAKE MANIFOLD",
    "TYPE TYPE",
    "KW TYPE",
    "TYPE",
    "GROUP A",
    "GROUP B",
    "GROUP C",
    "GROUP D",
  ];

  if (
    termosEstruturais.some(
      (termo) =>
        textoNormalizado === termo ||
        textoNormalizado.startsWith(
          `${termo} `
        )
    )
  ) {
    return false;
  }

  /*
   * ========================================================
   * BATTERIES
   * ========================================================
   */

  const cabecalhosBateria = [
    "HEIGHT [MM]",
    "HEIGHT MM",
    "LENGTH [MM]",
    "LENGTH MM",
    "WIDTH [MM]",
    "WIDTH MM",
    "PART NUMBER",
    "PART NUMBER SHORT",
    "SHORT",
    "AH",
    "A (EN)",
    "A EN",
    "BOX TYPE",
    "HOLD DOWN",
    "POLARITY",
    "TERMINAL",
    "TERMINALS",
  ];

  if (
    cabecalhosBateria.some(
      (cabecalho) =>
        textoNormalizado ===
          cabecalho ||
        textoNormalizado.startsWith(
          `${cabecalho} `
        )
    )
  ) {
    return false;
  }

  return true;
}
function pareceMotor(linha = "") {
  const texto =
    normalizarTexto(linha);

  if (!texto) {
    return false;
  }

  if (
    ehMarcadorPagina(texto)
  ) {
    return false;
  }

  return (
    /\b\d[.,]\d\b/.test(texto) ||
    /\b\d{3,4}\s?CC\b/.test(texto) ||
    /\bV6\b/.test(texto) ||
    /\bV8\b/.test(texto) ||
    /\bV10\b/.test(texto) ||
    /\bV12\b/.test(texto) ||
    /\bTDI\b/.test(texto) ||
    /\bHDI\b/.test(texto) ||
    /\bJTD\b/.test(texto) ||
    /\bJTDM\b/.test(texto) ||
    /\bTDCI\b/.test(texto) ||
    /\bCDI\b/.test(texto) ||
    /\bTSI\b/.test(texto) ||
    /\bTFSI\b/.test(texto) ||
    /\bMPI\b/.test(texto) ||
    /\b16V\b/.test(texto) ||
    /\b8V\b/.test(texto)
  );
}

/*
 * ============================================================
 * CRIAÇÃO DO REGISTRO PADRÃO APPIA
 * ============================================================
 */

function criarRegistro({
  codigo,
  equivalentes = [],
  montadora = "",
  modelo = "",
  motor = "",
  linha = "",
  configuracao = {},
  nomeArquivo = "",
  pecaForcada = "",
  codigoEquivalenteForcado = "",
  preservarFormatoEquivalentes = false,
}) {
  const codigoLimpo =
    normalizarCodigo(
      codigo
    );

  if (
    !pareceCodigo(
      codigoLimpo
    )
  ) {
    return null;
  }

  if (
    ehMarcadorPagina(
      linha
    )
  ) {
    return null;
  }

  const {
    ano_inicio,
    ano_fim,
  } = extrairAnos(
    linha
  );

  const peca =
    limparTexto(
      pecaForcada
    ) ||
    identificarPeca(
      configuracao
    );

  const equivalentesLimpos =
    equivalentes
      .map(
        (item) =>
          preservarFormatoEquivalentes
            ? normalizarCodigoEquivalente(
                item
              )
            : normalizarCodigo(
                item
              )
      )
      .filter(
        (item) =>
          item &&
          normalizarCodigo(item) !==
            codigoLimpo
      );

  const modeloLimpo =
    ehMarcadorPagina(
      modelo
    )
      ? ""
      : limparTexto(
          modelo
        );

  const motorLimpo =
    ehMarcadorPagina(
      motor
    )
      ? ""
      : limparTexto(
          motor
        );

  const codigoEquivalente =
    preservarFormatoEquivalentes
      ? (
          normalizarCodigoEquivalente(
            codigoEquivalenteForcado
          ) ||
          codigoLimpo
        )
      : (
          normalizarCodigo(
            codigoEquivalenteForcado
          ) ||
          codigoLimpo
        );

  return {
    peca,

    descricao:
      peca,

    codigo_oem:
      codigoLimpo,

    codigo_equivalente:
      codigoEquivalente,

    equivalentes: [
      ...new Set(
        equivalentesLimpos
      ),
    ],

    fabricante:
      "Magneti Marelli",

    montadora:
      limparTexto(
        montadora
      ) || null,

    modelo:
      modeloLimpo ||
      null,

    motor:
      motorLimpo ||
      null,

    ano_inicio,
    ano_fim,

    aplicacao:
      limparTexto(
        linha
      ) || null,

    observacao:
      limparTexto(
        linha
      ) || null,

    origem_catalogo:
      configuracao
        ?.origemCatalogo ||
      nomeArquivo ||
      "Catálogo Magneti Marelli",

    arquivo_catalogo:
      nomeArquivo ||
      null,

    tipo_catalogo:
      configuracao
        ?.tipoCatalogo ||
      "catalogo_geral",

    ativo: true,
  };
}

/*
 * ============================================================
 * REMOÇÃO DE DUPLICADOS
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
    if (!registro) {
      continue;
    }

    const chave = [
      registro.peca || "",
      registro.codigo_oem || "",
      registro.codigo_equivalente || "",
      registro.montadora || "",
      registro.modelo || "",
      registro.motor || "",
      registro.ano_inicio || "",
      registro.ano_fim || "",
      registro.aplicacao || "",
    ]
      .map(
        (valor) =>
          normalizarTexto(
            valor
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

  return Array.from(
    mapa.values()
  );
}

/*
 * ============================================================
 * LEITURA DE UMA SEÇÃO
 * ============================================================
 */

function transformarEmLinhas(
  texto = ""
) {
  return String(
    texto || ""
  )
    .split(/\r?\n/)
    .map(
      limparTexto
    )
    .filter(
      (linha) =>
        linha &&
        !ehMarcadorPagina(
          linha
        )
    );
}

/*
 * ============================================================
 * PARSER UNIVERSAL
 * ============================================================
 */

export async function parserMagnetiMarelliUniversal({
  textoReferencias = "",
  textoAplicacoes = "",
  textoEquivalencias = "",
  nomeArquivo = "",
  configuracao = {},
  onProgresso,
}) {
  const tipoCatalogo =
    configuracao
      ?.tipoCatalogo ||
    "catalogo_geral";

  const ehSistemasEletronicos =
    tipoCatalogo ===
    "sistemas_eletronicos";
const subTipoCatalogo =
  configuracao
    ?.subTipoCatalogo ||
  "";

const ehBicosInjetores =
  ehSistemasEletronicos &&
  subTipoCatalogo ===
    "bicos_injetores";

  const ehBaterias2024 =
    tipoCatalogo ===
    "baterias_2024";

  onProgresso?.(
    `🧠 Parser Universal Magneti Marelli: ${tipoCatalogo}...`
  );

  const linhasAplicacoes =
    transformarEmLinhas(
      textoAplicacoes
    );

  const linhasReferencias =
    transformarEmLinhas(
      textoReferencias
    );
/*
 * ============================================================
 * BICOS INJETORES 2016
 * ============================================================
 */

if (
  ehBicosInjetores
) {
  onProgresso?.(
    "💉 Magneti Marelli: lendo bicos injetores..."
  );

  const linhasBicos = [
    ...linhasReferencias,
    ...linhasAplicacoes,
  ];

  const registrosBicos =
    parserBicosInjetoresMarelli2016({
      linhas:
        linhasBicos,

      configuracao,

      nomeArquivo,
    });

  console.log(
    "💉 BICOS MARELLI 2016:",
    registrosBicos.length
  );

  console.log(
    "💉 EXEMPLO:",
    registrosBicos[0]
  );

  onProgresso?.(
    `✅ Magneti Marelli Bicos: ${registrosBicos.length} registro(s) encontrado(s).`
  );

  return registrosBicos;
}

  const linhasEquivalencias =
    transformarEmLinhas(
      textoEquivalencias
    );

  console.log(
    "=========================================="
  );

  console.log(
    "🧠 PARSER UNIVERSAL MAGNETI MARELLI"
  );

  console.log(
    "TIPO:",
    tipoCatalogo
  );
  console.log(
    "ARQUIVO:",
    nomeArquivo
  );

  console.log(
    "APLICAÇÕES:",
    linhasAplicacoes.length
  );

  console.log(
    "REFERÊNCIAS:",
    linhasReferencias.length
  );

  console.log(
    "EQUIVALÊNCIAS:",
    linhasEquivalencias.length
  );

  const mapaCodigosSistemasEletronicos =
    ehSistemasEletronicos
      ? criarMapaCodigosSistemasEletronicos([
          ...linhasReferencias,
          ...linhasEquivalencias,
        ])
      : new Map();

  /*
   * ========================================================
   * ÍNDICE DE EQUIVALÊNCIAS
   * ========================================================
   */

  const mapaEquivalencias =
    new Map();

  for (
    const linha
    of linhasEquivalencias
  ) {
    const codigos =
      extrairCodigos(
        linha
      );

    if (
      codigos.length < 2
    ) {
      continue;
    }

    for (
      const codigo
      of codigos
    ) {
      if (
        !mapaEquivalencias.has(
          codigo
        )
      ) {
        mapaEquivalencias.set(
          codigo,
          new Set()
        );
      }

      const conjunto =
        mapaEquivalencias.get(
          codigo
        );

      for (
        const equivalente
        of codigos
      ) {
        if (
          equivalente !==
          codigo
        ) {
          conjunto.add(
            equivalente
          );
        }
      }
    }
  }

  /*
   * ========================================================
   * CÓDIGOS DO GUIA DE REFERÊNCIAS
   * ========================================================
   */

  const codigosReferencia =
    new Set();

  for (
    const linha
    of linhasReferencias
  ) {
    const codigos =
      extrairCodigos(
        linha
      );

    for (
      const codigo
      of codigos
    ) {
      codigosReferencia.add(
        codigo
      );
    }
  }

  /*
   * ========================================================
   * APLICAÇÕES
   * ========================================================
   */

  const registros = [];

  let montadoraAtual = "";
  let modeloAtual = "";
  let motorAtual = "";

  for (
    let indice = 0;
    indice <
    linhasAplicacoes.length;
    indice += 1
  ) {
    const linha =
      linhasAplicacoes[
        indice
      ];

    if (
      !linha ||
      ehMarcadorPagina(
        linha
      ) ||
      ehCabecalho(
        linha
      )
    ) {
      continue;
    }

    /*
     * ======================================================
     * MONTADORA
     * ======================================================
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

      modeloAtual = "";
      motorAtual = "";

      continue;
    }

    const codigos =
      extrairCodigos(
        linha
      );

    /*
     * ======================================================
     * ELECTRONIC SYSTEMS
     * ======================================================
     */

    if (
      ehSistemasEletronicos
    ) {
      const codigoLongo =
        extrairCodigoLongoMarelli(
          linha
        );

      if (
        codigoLongo
      ) {
        const codigoCurtoLinha =
          extrairCodigoCurtoSistemasEletronicos(
            linha,
            codigoLongo
          );

        const codigoCurtoMapa =
          mapaCodigosSistemasEletronicos.get(
            codigoLongo
          ) || "";

        const codigoCurto =
          codigoCurtoLinha ||
          codigoCurtoMapa ||
          "";

        const codigoCurtoCompacto =
          normalizarCodigo(
            codigoCurto
          );

        const peca =
          identificarPecaSistemasEletronicos(
            linha,
            codigoCurto
          );

        const equivalentes = [
          ...new Set(
            [
              codigoCurto,
              codigoCurtoCompacto,
            ].filter(Boolean)
          ),
        ];

        const motorRegistro =
          extrairMotorSistemasEletronicos(
            linha
          ) ||
          motorAtual;

        const registro =
          criarRegistro({
            codigo:
              codigoLongo,

            equivalentes,

            codigoEquivalenteForcado:
              codigoCurto ||
              codigoLongo,

            preservarFormatoEquivalentes:
              true,

            montadora:
              montadoraAtual,

            modelo:
              modeloAtual,

            motor:
              motorRegistro,

            linha,
            configuracao,

            nomeArquivo,

            pecaForcada:
              peca,
          });

        if (
          registro
        ) {
          registros.push(
            registro
          );
        }

        continue;
      }

      /*
       * Código curto solto não vira
       * produto independente.
       */

      const codigosCurtosSoltos =
  codigos.filter(
    (codigo) =>
      ehCodigoCurtoSistemasEletronicos(
        codigo
      )
  );

      if (
        codigosCurtosSoltos.length >
        0
      ) {
        continue;
      }
    }

    /*
     * ======================================================
     * BATTERIES 2024
     * ======================================================
     */

    if (
      ehBaterias2024
    ) {
      const codigoLongo =
        extrairCodigoLongoMarelli(
          linha
        );

      const codigoCurto =
        codigos.find(
          (codigo) =>
            /^(RUN|AGM|AUX|SST|ETS|ES|CARGO)[A-Z0-9-]*$/i.test(
              codigo
            )
        ) || "";

      if (
        codigoLongo
      ) {
        const equivalentes =
          codigoCurto
            ? [codigoCurto]
            : [];

        const registro =
          criarRegistro({
            codigo:
              codigoLongo,

            equivalentes,

            codigoEquivalenteForcado:
              codigoCurto ||
              codigoLongo,

            preservarFormatoEquivalentes:
              true,

            montadora: "",

            modelo: "",

            motor: "",

            linha,

            configuracao: {
              ...configuracao,

              origemCatalogo:
                "Catálogo Magneti Marelli Batteries 2024",
            },

            nomeArquivo,

            pecaForcada:
              "Bateria",
          });

        if (
          registro
        ) {
          /*
           * Segurança extra:
           * Batteries 2024 nunca deve
           * herdar cabeçalho como modelo.
           */
          registro.modelo = null;
          registro.motor = null;

          registro.origem_catalogo =
            "Catálogo Magneti Marelli Batteries 2024";

          registros.push(
            registro
          );
        }

        continue;
      }
    }

    let candidatos =
      codigos.filter(
        (codigo) =>
          codigosReferencia.has(
            codigo
          )
      );

    if (
      candidatos.length === 0
    ) {
      candidatos =
        codigos;
    }

    /*
     * ======================================================
     * LINHA SEM CÓDIGO
     * ======================================================
     */

    if (
      candidatos.length === 0
    ) {
      if (
        pareceMotor(
          linha
        )
      ) {
        motorAtual =
          linha;

        continue;
      }

      if (
        pareceModelo(
          linha
        )
      ) {
        modeloAtual =
          linha;

        continue;
      }

      continue;
    }

    const codigoPrincipal =
      candidatos[0];

    if (
      !codigoPrincipal
    ) {
      continue;
    }

    /*
     * ======================================================
     * EQUIVALÊNCIAS
     * ======================================================
     */

    const ehKitDistribuicao =
      tipoCatalogo ===
      "kits_distribuicao";

    let equivalentesLinha =
      codigos.filter(
        (codigo) =>
          codigo !==
          codigoPrincipal
      );

    if (
      ehKitDistribuicao
    ) {
      equivalentesLinha =
        equivalentesLinha.filter(
          (codigo) =>
            /^(MMK|KWP|MCK)[A-Z0-9]*$/i.test(
              codigo
            )
        );
    }

    const equivalenciasMapeadas =
      !ehKitDistribuicao &&
      !ehSistemasEletronicos &&
      mapaEquivalencias.has(
        codigoPrincipal
      )
        ? Array.from(
            mapaEquivalencias.get(
              codigoPrincipal
            )
          )
        : [];

    const equivalentes = [
      ...new Set([
        ...equivalentesLinha,
        ...equivalenciasMapeadas,
      ]),
    ];

    let motorRegistro =
      motorAtual;

    if (
      pareceMotor(
        linha
      )
    ) {
      motorRegistro =
        linha;
    }

    const registro =
      criarRegistro({
        codigo:
          codigoPrincipal,

        equivalentes,

        montadora:
          montadoraAtual,

        modelo:
          ehBaterias2024
            ? ""
            : modeloAtual,

        motor:
          ehBaterias2024
            ? ""
            : motorRegistro,

        linha,

        configuracao:
          ehBaterias2024
            ? {
                ...configuracao,

                origemCatalogo:
                  "Catálogo Magneti Marelli Batteries 2024",
              }
            : configuracao,

        nomeArquivo,

        pecaForcada:
          ehBaterias2024
            ? "Bateria"
            : "",
      });

    if (
      registro
    ) {
      if (
        ehBaterias2024
      ) {
        registro.modelo = null;
        registro.motor = null;

        registro.origem_catalogo =
          "Catálogo Magneti Marelli Batteries 2024";
      }

      registros.push(
        registro
      );
    }
  }

  /*
   * ========================================================
   * FALLBACK REFERÊNCIAS
   * ========================================================
   */

  if (
    registros.length === 0 &&
    linhasReferencias.length > 0
  ) {
    for (
      const linha
      of linhasReferencias
    ) {
      if (
        ehMarcadorPagina(
          linha
        )
      ) {
        continue;
      }

      if (
        ehSistemasEletronicos
      ) {
        const codigoLongo =
          extrairCodigoLongoMarelli(
            linha
          );

        if (
          codigoLongo
        ) {
          const codigoCurto =
            extrairCodigoCurtoSistemasEletronicos(
              linha,
              codigoLongo
            ) ||
            mapaCodigosSistemasEletronicos.get(
              codigoLongo
            ) ||
            "";

          const codigoCurtoCompacto =
            normalizarCodigo(
              codigoCurto
            );

          const peca =
            identificarPecaSistemasEletronicos(
              linha,
              codigoCurto
            );

          const equivalentes = [
            ...new Set(
              [
                codigoCurto,
                codigoCurtoCompacto,
              ].filter(Boolean)
            ),
          ];

          const registro =
            criarRegistro({
              codigo:
                codigoLongo,

              equivalentes,

              codigoEquivalenteForcado:
                codigoCurto ||
                codigoLongo,

              preservarFormatoEquivalentes:
                true,

              linha,

              configuracao,

              nomeArquivo,

              pecaForcada:
                peca,
            });

          if (
            registro
          ) {
            registros.push(
              registro
            );
          }

          continue;
        }

        const codigosLinha =
          extrairCodigos(
            linha
          );

        const possuiCodigoCurto =
  codigosLinha.some(
    (codigo) =>
      ehCodigoCurtoSistemasEletronicos(
        codigo
      )
  );

        if (
          possuiCodigoCurto
        ) {
          continue;
        }
      }
            const codigos =
        extrairCodigos(
          linha
        );

      if (
        codigos.length === 0
      ) {
        continue;
      }

      const codigoPrincipal =
        codigos[0];

      const equivalentes =
        codigos.slice(1);

      const registro =
        criarRegistro({
          codigo:
            codigoPrincipal,

          equivalentes,

          linha,

          configuracao:
            ehBaterias2024
              ? {
                  ...configuracao,

                  origemCatalogo:
                    "Catálogo Magneti Marelli Batteries 2024",
                }
              : configuracao,

          nomeArquivo,

          pecaForcada:
            ehBaterias2024
              ? "Bateria"
              : "",
        });

      if (
        registro
      ) {
        if (
          ehBaterias2024
        ) {
          registro.modelo = null;
          registro.motor = null;

          registro.origem_catalogo =
            "Catálogo Magneti Marelli Batteries 2024";
        }

        registros.push(
          registro
        );
      }
    }
  }

  /*
   * ========================================================
   * FALLBACK FINAL
   * ========================================================
   */

  if (
    registros.length === 0 &&
    linhasEquivalencias.length > 0
  ) {
    for (
      const linha
      of linhasEquivalencias
    ) {
      if (
        ehMarcadorPagina(
          linha
        )
      ) {
        continue;
      }

      if (
        ehSistemasEletronicos
      ) {
        const codigoLongo =
          extrairCodigoLongoMarelli(
            linha
          );

        if (
          codigoLongo
        ) {
          const codigoCurto =
            extrairCodigoCurtoSistemasEletronicos(
              linha,
              codigoLongo
            ) ||
            mapaCodigosSistemasEletronicos.get(
              codigoLongo
            ) ||
            "";

          const codigoCurtoCompacto =
            normalizarCodigo(
              codigoCurto
            );

          const peca =
            identificarPecaSistemasEletronicos(
              linha,
              codigoCurto
            );

          const equivalentes = [
            ...new Set(
              [
                codigoCurto,
                codigoCurtoCompacto,
              ].filter(Boolean)
            ),
          ];

          const registro =
            criarRegistro({
              codigo:
                codigoLongo,

              equivalentes,

              codigoEquivalenteForcado:
                codigoCurto ||
                codigoLongo,

              preservarFormatoEquivalentes:
                true,

              linha,

              configuracao,

              nomeArquivo,

              pecaForcada:
                peca,
            });

          if (
            registro
          ) {
            registros.push(
              registro
            );
          }

          continue;
        }

        const codigosLinha =
          extrairCodigos(
            linha
          );

        const possuiCodigoCurto =
          codigosLinha.some(
            (codigo) =>
              /^(TB|FEI|PAS|IAW|MJD|B\d|48CPD)/i.test(
                codigo
              )
          );

        if (
          possuiCodigoCurto
        ) {
          continue;
        }
      }

      const codigos =
        extrairCodigos(
          linha
        );

      if (
        codigos.length === 0
      ) {
        continue;
      }

      const codigoPrincipal =
        codigos[0];

      const registro =
        criarRegistro({
          codigo:
            codigoPrincipal,

          equivalentes:
            codigos.slice(1),

          linha,

          configuracao:
            ehBaterias2024
              ? {
                  ...configuracao,

                  origemCatalogo:
                    "Catálogo Magneti Marelli Batteries 2024",
                }
              : configuracao,

          nomeArquivo,

          pecaForcada:
            ehBaterias2024
              ? "Bateria"
              : "",
        });

      if (
        registro
      ) {
        if (
          ehBaterias2024
        ) {
          registro.modelo = null;
          registro.motor = null;

          registro.origem_catalogo =
            "Catálogo Magneti Marelli Batteries 2024";
        }

        registros.push(
          registro
        );
      }
    }
  }

  const registrosUnicos =
    removerDuplicados(
      registros
    );

  console.log(
    "MARELLI UNIVERSAL ENCONTRADOS:",
    registros.length
  );

  console.log(
    "MARELLI UNIVERSAL ÚNICOS:",
    registrosUnicos.length
  );

  console.log(
    "EXEMPLO UNIVERSAL:",
    registrosUnicos[0]
  );

  console.log(
    "=========================================="
  );

  onProgresso?.(
    `✅ Magneti Marelli Universal: ${registrosUnicos.length} registro(s) encontrado(s).`
  );

  return registrosUnicos;
}

export default parserMagnetiMarelliUniversal;
