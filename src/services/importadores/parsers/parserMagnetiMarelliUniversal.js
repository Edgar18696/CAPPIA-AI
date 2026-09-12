/*
 * ============================================================
 * APPIA AI
 * PARSER UNIVERSAL MAGNETI MARELLI — V6 + DIAGNOSTICO V7
 * ============================================================
 *
 * Objetivo:
 *
 * Interpretar catÃ¡logos Magneti Marelli que seguem estrutura
 * semelhante sem precisar criar um parser gigante para cada
 * nova categoria.
 *
 * Os parsers especÃ­ficos jÃ¡ aprovados continuam funcionando.
 * Este parser serÃ¡ usado como fallback para novos catÃ¡logos.
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
  let codigo =
    String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/\s+/g, "")
      .trim();

  /*
   * Bicos Marelli:
   * IWP049/1 -> IWP049
   * IWP 049  -> IWP049
   */
  if (/^IWP/i.test(codigo)) {
    codigo =
      codigo.replace(
        /\/\d+$/i,
        ""
      );
  }

  return codigo
    .replace(
      /[^A-Z0-9.\-]/g,
      ""
    )
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
 * MARCADORES DE PÃGINA
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
 * CÃ“DIGOS
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
 * DETECÃ‡ÃƒO DE LINHAS INÃšTEIS
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
 * TIPO DE PEÃ‡A
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
      "Bomba de Ãgua",

    termostatos:
      "Termostato",

    timing_chain_kit:
      "Kit Corrente de DistribuiÃ§Ã£o",

    kits_distribuicao:
      "Kit de DistribuiÃ§Ã£o",

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
      "Sistema de CombustÃ­vel",

    sistemas_eletronicos:
      "Sistema EletrÃ´nico",

    sensores:
      "Sensor",

    velas_aquecedoras:
      "Vela Aquecedora",

    velas_ignicao:
      "Vela de IgniÃ§Ã£o",

    cabos_ignicao:
      "Cabo de IgniÃ§Ã£o",

    iluminacao:
      "IluminaÃ§Ã£o",

    amortecedores:
      "Amortecedor",

    molas_pneumaticas:
      "Mola PneumÃ¡tica",

    compressores_pneumaticos:
      "Compressor PneumÃ¡tico",

    retrovisores:
      "Retrovisor",

    sistemas_termicos:
      "Sistema TÃ©rmico",

    corrente_distribuicao:
      "Kit Corrente de DistribuiÃ§Ã£o",

    bracos_suspensao:
      "BraÃ§o de SuspensÃ£o",

    maquinas_vidro:
      "MÃ¡quina de Vidro",

    sistema_limpador:
      "Sistema Limpador",

    palhetas:
      "Palheta",

    comandos_eletricos:
      "Comando ElÃ©trico",

    transmissao:
      "Componente de TransmissÃ£o",

    coxins:
      "Coxim",

    baterias:
      "Bateria",

    baterias_2024:
      "Bateria",

    carburadores:
      "Carburador",

    oleos:
      "Ã“leo",
  };

  return (
    mapa[tipo] ||
    "PeÃ§a Automotiva"
  );
}

/*
 * ============================================================
 * DETECÇÃO CONSERVADORA — MODELO / MOTOR / PERÍODO
 * ============================================================
 *
 * Estas funções são usadas pelo parser universal e pelo fluxo
 * sequencial de Electronic Systems. Elas precisam existir antes
 * das rotinas abaixo para evitar ReferenceError em tempo de execução.
 */

function pareceMotor(linha = "") {
  const texto = limparTexto(linha);
  const normalizado = normalizarTexto(texto);

  if (!texto) {
    return false;
  }

  if (
    ehMarcadorPagina(texto) ||
    identificarMontadora(texto) ||
    ehCabecalho(texto) ||
    extrairCodigoLongoMarelli(texto)
  ) {
    return false;
  }

  // Combustível / configuração típica de motor.
  if (
    /\b(?:PETROL|DIESEL|BENZINA|GASOLINE|GASOLINA|FLEX|CNG|LPG)\b/i.test(
      texto
    )
  ) {
    return true;
  }

  // Cilindrada: 1.0, 1.4, 1.6, 2.0, 1,6 etc.
  if (
    /\b\d(?:[.,]\d{1,2})\b/.test(texto)
  ) {
    return true;
  }

  // Características comuns: 8V, 16V, 20V, 1000 cc, 74 kW etc.
  if (
    /\b\d{1,2}\s*V\b/i.test(texto) ||
    /\b\d{3,4}\s*CC\b/i.test(texto) ||
    /\b\d{2,3}\s*KW\b/i.test(texto)
  ) {
    return true;
  }

  // Códigos de motor alfanuméricos curtos, sem tratar qualquer código
  // de peça como motor. Ex.: K4M, F4R, TU5JP4, 1NZFE.
  const compacto = normalizarCodigo(texto);
  if (
    texto.split(/\s+/).length <= 3 &&
    compacto.length >= 3 &&
    compacto.length <= 10 &&
    /[A-Z]/.test(compacto) &&
    /\d/.test(compacto) &&
    !pareceCodigo(texto) &&
    !/^(TB|48CPD|FEI|IPM|IWP|PAS|IAW|MJD|MMK|KWP|MCK)/i.test(
      compacto
    )
  ) {
    return true;
  }

  return (
    normalizado === "ENGINE" ||
    normalizado === "MOTOR"
  );
}

function pareceModelo(linha = "") {
  const texto = limparTexto(linha);

  if (!texto) {
    return false;
  }

  if (
    ehMarcadorPagina(texto) ||
    identificarMontadora(texto) ||
    ehCabecalho(texto) ||
    pareceMotor(texto) ||
    extrairCodigoLongoMarelli(texto) ||
    ehDescricaoTecnicaSistemasEletronicos(texto)
  ) {
    return false;
  }

  if (
    /^\d+$/.test(texto) ||
    /^\d{1,2}\/\d{2}(?:\s+\d{1,2}\/\d{2})?$/.test(texto)
  ) {
    return false;
  }

  const palavras = texto.split(/\s+/).filter(Boolean);

  return (
    palavras.length >= 1 &&
    palavras.length <= 8 &&
    /[A-Za-zÀ-ÿ]/.test(texto)
  );
}

function extrairPeriodoBicoMarelli(linha = "") {
  const texto = limparTexto(linha);

  const converterAno2Digitos = (anoTexto) => {
    const ano = Number(anoTexto);

    if (!Number.isFinite(ano)) {
      return null;
    }

    return ano <= 79
      ? 2000 + ano
      : 1900 + ano;
  };

  const periodos = [
    ...texto.matchAll(
      /\b(?:0?[1-9]|1[0-2])\/(\d{2})\b/g
    ),
  ]
    .map((match) => converterAno2Digitos(match[1]))
    .filter((ano) => Number.isFinite(ano));

  if (periodos.length > 0) {
    return {
      ano_inicio: periodos[0] ?? null,
      ano_fim:
        periodos.length > 1
          ? periodos[periodos.length - 1]
          : null,
    };
  }

  // Fallback para anos escritos com quatro dígitos.
  return extrairAnos(texto);
}

/*
 * ============================================================
 * SISTEMAS ELETRÃ”NICOS MARELLI
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
    return "Injetor de CombustÃ­vel";
  }

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
    return "MÃ³dulo de InjeÃ§Ã£o";
  }

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
    return "Atuador do Coletor de AdmissÃ£o";
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
    return "VÃ¡lvula Canister";
  }

  /*
   * ========================================================
   * COLETOR ADMISSÃƒO
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
    return "Coletor de AdmissÃ£o";
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
    return "Tubo de ConexÃ£o";
  }

  return "Sistema EletrÃ´nico";
}

/*
 * ============================================================
 * CÃ“DIGO LONGO MAGNETI MARELLI
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
 * CÃ“DIGO CURTO SISTEMAS ELETRÃ”NICOS
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

  const padroes = [
    /\bTB\d{4}-?\d\b/i,
    /\b48CPD[A-Z0-9.-]*\b/i,
    /\bFEI[A-Z0-9.\/-]+\b/i,
    /\bIPM[A-Z0-9.\/-]+\b/i,
    /\bIWP[A-Z0-9.\/-]+\b/i,
    /\bPAS[A-Z0-9.-]+\b/i,
    /\bIAW[A-Z0-9.-]+\b/i,
    /\bMJD[A-Z0-9.-]+\b/i,
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

  if (
    /^IWP/i.test(
      candidato
    )
  ) {
    return candidato
      .replace(/\s+/g, "")
      .replace(/\/1$/i, "");
  }

  return candidato;
}

/*
 * ============================================================
 * IDENTIFICA CÃ“DIGO CURTO DE SISTEMAS ELETRÃ”NICOS
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
 * CRIAÃ‡ÃƒO DO REGISTRO
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
    !codigoLimpo ||
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
  } =
    extrairAnos(
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
          normalizarCodigo(
            item
          ) !== codigoLimpo
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
      "CatÃ¡logo Magneti Marelli",

    arquivo_catalogo:
      nomeArquivo ||
      null,

    tipo_catalogo:
      configuracao
        ?.tipoCatalogo ||
      "catalogo_geral",

    ativo:
      true,
  };
}

/*
 * ============================================================
 * REMOÃ‡ÃƒO DE DUPLICADOS
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
 * LEITURA DE UMA SEÃ‡ÃƒO
 * ============================================================
 */

function transformarEmLinhas(
  texto = ""
) {
  const bruto =
    String(
      texto || ""
    );

  /*
   * O Electronic Systems traz um efeito da extraÃ§Ã£o:
   * em vÃ¡rias pÃ¡ginas o cabeÃ§alho visual da pÃ¡gina
   * (montadora e Ã s vezes o primeiro modelo)
   * aparece no FINAL do texto extraÃ­do.
   *
   * Como o motor injeta marcadores:
   * --- PÃGINA 102 ---
   *
   * tratamos pÃ¡gina por pÃ¡gina antes de achatar as linhas.
   */

  const partes =
    bruto.split(
      /---\s*P[ÃA]GINA\s+\d+\s*---/i
    );

  const resultado = [];

  for (
    const parte
    of partes
  ) {
    let linhas =
      String(
        parte || ""
      )
        .split(/\r?\n/)
        .map(
          limparTexto
        )
        .filter(Boolean);

    if (
      linhas.length === 0
    ) {
      continue;
    }

    /*
     * NÃºmero impresso da pÃ¡gina nÃ£o Ã© aplicaÃ§Ã£o.
     */
    linhas =
      linhas.filter(
        (linha) =>
          !/^\d{1,4}$/.test(
            linha
          )
      );

    /*
     * Procura montadora somente muito perto do fim.
     * Quando encontrada ali, move o cabeÃ§alho para o comeÃ§o.
     */

    let indiceCabecalho =
      -1;

    for (
      let indice =
        linhas.length - 1;
      indice >= 0;
      indice -= 1
    ) {
      if (
        identificarMontadora(
          linhas[indice]
        )
      ) {
        indiceCabecalho =
          indice;

        break;
      }

      if (
        linhas.length - indice >
        3
      ) {
        break;
      }
    }

    if (
      indiceCabecalho >= 0
    ) {
      const cabecalho =
        linhas.slice(
          indiceCabecalho
        );

      const corpo =
        linhas.slice(
          0,
          indiceCabecalho
        );

      linhas = [
        ...cabecalho,
        ...corpo,
      ];
    }

    for (
      const linha
      of linhas
    ) {
      if (
        linha &&
        !ehMarcadorPagina(
          linha
        )
      ) {
        resultado.push(
          linha
        );
      }
    }
  }

  return resultado;
}


/*
 * ============================================================
 * ELECTRONIC SYSTEMS — ORDEM NATURAL DAS PÁGINAS
 * ============================================================
 *
 * O catálogo Electronic Systems já traz, na própria linha da aplicação,
 * o código Marelli correspondente. Para este catálogo NÃO devemos mover
 * cabeçalhos encontrados no fim da página para o começo, porque isso pode
 * antecipar o próximo modelo e fazer uma referência da linha anterior
 * receber o modelo seguinte (ex.: IWP049 -> BX/BX Break).
 */
function transformarEmLinhasElectronicSystems(
  texto = ""
) {
  const bruto = String(texto || "");

  const partes = bruto.split(
    /---\s*P[ÃA]GINA\s+\d+\s*---/i
  );

  const resultado = [];

  for (const parte of partes) {
    const linhas = String(parte || "")
      .split(/\r?\n/)
      .map(limparTexto)
      .filter(Boolean)
      .filter(
        (linha) =>
          !ehMarcadorPagina(linha)
      );

    for (
      let indice = 0;
      indice < linhas.length;
      indice += 1
    ) {
      const linha =
        linhas[indice];

      if (!/^\d{1,4}$/.test(linha)) {
        resultado.push(linha);
        continue;
      }

      const proximaUtil =
        linhas
          .slice(indice + 1)
          .find(Boolean) || "";

      if (/^\d+\.\d+/.test(proximaUtil)) {
        resultado.push(linha);
      }
    }
  }

  return resultado;
}

/*
 * ============================================================
 * SISTEMAS ELETRÃ”NICOS â€” PARSER SEQUENCIAL
 * ============================================================
 */

function extrairCodigoCurtoSequencialMarelli(
  linha = ""
) {
  const texto =
    limparTexto(
      linha
    );

  if (!texto) {
    return "";
  }

  const conhecido =
    extrairCodigoCurtoSistemasEletronicos(
      texto
    );

  if (conhecido) {
    return conhecido;
  }

  const primeiroToken =
    texto
      .split(/\s+/)
      .map(
        (item) =>
          limparTexto(
            item
          )
      )
      .find(Boolean) || "";

  if (
    !primeiroToken ||
    /^\d{12}$/.test(
      normalizarCodigo(
        primeiroToken
      )
    )
  ) {
    return "";
  }

  const compacto =
    normalizarCodigo(
      primeiroToken
    );

  if (
    compacto.length < 3 ||
    compacto.length > 20 ||
    !/[A-Z]/.test(
      compacto
    ) ||
    !/\d/.test(
      compacto
    )
  ) {
    return "";
  }

  if (
    /^(PETROL|DIESEL|BENZINA|GASOLINE|GASOLINA|ENGINE)$/i.test(
      primeiroToken
    )
  ) {
    return "";
  }

  return normalizarCodigoEquivalente(
    primeiroToken
  );
}

function ehModeloSistemasEletronicosMarelli(
  linha = ""
) {
  const texto =
    limparTexto(
      linha
    );

  if (
    !texto ||
    !texto.includes("(") ||
    !texto.includes(")") ||
    (
      /^\s*\d/.test(
        texto
      ) &&
      !/^\s*\d{3,4}\s+.*\([^)]*\)/.test(
        texto
      )
    ) ||
    identificarMontadora(
      texto
    ) ||
    ehCabecalho(
      texto
    ) ||
    ehDescricaoTecnicaSistemasEletronicos(
      texto
    ) ||
    extrairCodigoLongoMarelli(
      texto
    ) ||
    /\b(?:PETROL|DIESEL|BENZINA|GASOLINE|GASOLINA|CNG|LPG)\b/i.test(
      texto
    ) ||
    /\b\d{2}\/\d{2}\b/.test(
      texto
    )
  ) {
    return false;
  }

  return true;
}

function ehLinhaAplicacaoSistemasEletronicosMarelli(
  linha = ""
) {
  const texto =
    limparTexto(
      linha
    );

  if (!texto) {
    return false;
  }

  if (
    /^Ã /i.test(
      texto
    ) ||
    /^\d(?:[.,]\d|\d{2,3})\b/.test(
      texto
    ) ||
    /\b(?:PETROL|DIESEL|BENZINA|GASOLINE|GASOLINA|CNG|LPG)\b/i.test(
      texto
    ) ||
    /\b\d{2}\/\d{2}\b/.test(
      texto
    )
  ) {
    return true;
  }

  return false;
}

function criarMapaSequencialSistemasEletronicosMarelli(
  linhas = []
) {
  const mapa =
    new Map();

  for (
    let indice = 0;
    indice < linhas.length;
    indice += 1
  ) {
    const linha =
      limparTexto(
        linhas[indice]
      );

    if (!linha) {
      continue;
    }

    const codigoLongo =
      extrairCodigoLongoMarelli(
        linha
      );

    if (!codigoLongo) {
      continue;
    }

    let codigoCurto =
      extrairCodigoCurtoSistemasEletronicos(
        linha,
        codigoLongo
      );

    /*
     * =====================================================
     * LINHA TÉCNICA SEGURA
     * =====================================================
     *
     * Não carregamos automaticamente uma linha inteira
     * para outro ponto do catálogo.
     */
    let linhaTecnica =
      "";

    /*
     * Se longo + curto já estão na mesma linha,
     * essa linha é segura.
     */
    if (
      codigoCurto
    ) {
      linhaTecnica =
        linha;
    }

    /*
     * Se o código curto não estiver na mesma linha,
     * podemos olhar no máximo as 2 próximas linhas.
     *
     * Mas abandonamos imediatamente se surgir:
     * - outro código longo;
     * - montadora;
     * - modelo;
     * - aplicação.
     */
    if (
      !codigoCurto
    ) {
      for (
        let deslocamento = 1;
        deslocamento <= 2;
        deslocamento += 1
      ) {
        const proximaLinha =
          limparTexto(
            linhas[
              indice +
              deslocamento
            ] || ""
          );

        if (!proximaLinha) {
          break;
        }

        const outroCodigoLongo =
          extrairCodigoLongoMarelli(
            proximaLinha
          );

        /*
         * Se apareceu qualquer código longo,
         * não atravessamos para o próximo produto.
         */
        if (
          outroCodigoLongo
        ) {
          break;
        }

        if (
          identificarMontadora(
            proximaLinha
          ) ||
          ehModeloSistemasEletronicosMarelli(
            proximaLinha
          ) ||
          ehLinhaAplicacaoSistemasEletronicosMarelli(
            proximaLinha
          )
        ) {
          break;
        }

        const candidato =
          extrairCodigoCurtoSequencialMarelli(
            proximaLinha
          );

        if (
          candidato
        ) {
          codigoCurto =
            candidato;

          /*
           * Guardamos a linha apenas se não houver
           * nenhum código longo concorrente nela.
           */
          linhaTecnica =
            proximaLinha;

          break;
        }
      }
    }

    /*
     * =====================================================
     * VALIDAÇÃO FINAL DA LINHA TÉCNICA
     * =====================================================
     */

    if (
      linhaTecnica
    ) {
      const longosEncontrados =
        [
          ...linhaTecnica.matchAll(
            /\b8\d{11}\b/g
          ),
        ].map(
          (resultado) =>
            resultado[0]
        );

      const longosDiferentes =
        longosEncontrados.filter(
          (codigo) =>
            codigo !==
            codigoLongo
        );

      /*
       * Exemplo proibido:
       *
       * registro atual:
       * 805000003010 / PAS003
       *
       * linha técnica:
       * PAS004 - 805000004010
       *
       * Nesse caso descartamos a linha técnica.
       */
      if (
        longosDiferentes.length >
        0
      ) {
        linhaTecnica =
          "";
      }
    }

    /*
     * =====================================================
     * MAPA
     * =====================================================
     *
     * Primeira associação válida vence.
     * Mas nunca armazenamos linha contaminada.
     */

    if (
      !mapa.has(
        codigoLongo
      )
    ) {
      mapa.set(
        codigoLongo,
        {
          codigoCurto:
            codigoCurto || "",

          linhaTecnica:
            linhaTecnica || "",
        }
      );
    }
  }

  return mapa;
}
function extrairBaseMotorSistemasEletronicos(
  linha = ""
) {
  const texto =
    limparTexto(
      linha
    );

  if (!texto) {
    return "";
  }

  const partes =
    texto.split(
      /\b(?:PETROL|DIESEL|BENZINA|GASOLINE|GASOLINA|CNG|LPG)\b/i
    );

  if (
    partes.length > 1
  ) {
    return limparTexto(
      partes[0]
    );
  }

  if (
    !/\b\d{2}\/\d{2}\b/.test(
      texto
    ) &&
    pareceMotor(
      texto
    )
  ) {
    return texto;
  }

  return "";
}


/*
 * ============================================================
 * ELECTRONIC SYSTEMS — V6
 * BUYERS GUIDE / APLICAÇÃO POR CÓDIGO
 * ============================================================
 *
 * Regra de segurança:
 * Para Electronic Systems, a fonte principal passa a ser a seção
 * "Applicazione per codice / Buyers guide" do catálogo Marelli.
 *
 * Nessa seção cada bloco começa com:
 *   IWP049/1 – 805000347304
 * e, logo abaixo, aparecem SOMENTE as aplicações daquele código.
 *
 * Isso elimina a associação por posição de colunas da seção
 * "Vehicle application guide", que pode sair deslocada na extração
 * de texto do PDF.
 */
function parserSistemasEletronicosMarelli({
  linhas = [],
  linhasReferencias = [],
  linhasEquivalencias = [],
  configuracao = {},
  nomeArquivo = "",
  onProgresso,
}) {
  const fonteBuyersGuideBase =
    linhasReferencias.length > 0
      ? linhasReferencias
      : linhas;

  function recomporCombustivelQuebradoBuyersGuide(
    linhasFonte = []
  ) {
    const resultado = [];

    for (
      let indice = 0;
      indice < linhasFonte.length;
      indice += 1
    ) {
      const atual =
        limparTexto(
          linhasFonte[indice]
        );

      const proxima =
        limparTexto(
          linhasFonte[indice + 1] ||
          ""
        );

      if (
        /^(?:PETROL|DIESEL)\/$/i.test(
          atual
        ) &&
        /^(?:CNG|LPG|ETHANOL)\b/i.test(
          proxima
        )
      ) {
        resultado.push(
          `${atual}${proxima}`
        );
        indice += 1;
        continue;
      }

      if (atual) {
        resultado.push(
          atual
        );
      }
    }

    return resultado;
  }

  function ehAplicacaoCompletaLinhaBuyersGuide(
    linha = ""
  ) {
    const texto =
      limparTexto(linha);

    if (!texto) {
      return false;
    }

    return (
      /\b(?:PETROL|DIESEL|BENZINA|GASOLINE|GASOLINA|FLEX|CNG|LPG|ETHANOL)\b/i.test(
        texto
      ) &&
      /\b(?:0?[1-9]|1[0-2])\/\d{2}\b/.test(
        texto
      )
    );
  }

  function ehMotorIncompletoBuyersGuide(
    linha = ""
  ) {
    const texto =
      limparTexto(linha);

    if (!texto || !/^\d/.test(texto)) {
      return false;
    }

    if (
      ehAplicacaoCompletaLinhaBuyersGuide(
        texto
      )
    ) {
      return false;
    }

    return true;
  }

  function ehContinuacaoMotorBuyersGuide(
    linha = ""
  ) {
    const texto =
      limparTexto(linha);

    if (!texto) {
      return false;
    }

    if (
      /^(?:POWER|BIPOWER|BLUPOWER|TWINAIR|MULTIAIR|T-JET|TJET)$/i.test(
        texto
      )
    ) {
      return true;
    }

    if (
      /^\([A-Z0-9][A-Z0-9._-]{3,}\)$/i.test(
        texto
      ) &&
      !texto.includes(",")
    ) {
      return true;
    }

    if (
      /^\d+x\d+/i.test(
        texto
      ) &&
      texto.includes("(") &&
      !ehAplicacaoCompletaLinhaBuyersGuide(
        texto
      )
    ) {
      return true;
    }

    if (
      /^[A-Z0-9]{4,}[A-Z0-9._]*[,)]?$/i.test(
        texto
      ) &&
      !ehAplicacaoCompletaLinhaBuyersGuide(
        texto
      )
    ) {
      return true;
    }

    return false;
  }

  function recomporMotorQuebradoBuyersGuide(
    linhasFonte = []
  ) {
    const resultado = [];

    for (
      let indice = 0;
      indice < linhasFonte.length;
      indice += 1
    ) {
      let atual =
        limparTexto(
          linhasFonte[indice]
        );

      if (!atual) {
        continue;
      }

      if (
        ehMotorIncompletoBuyersGuide(
          atual
        )
      ) {
        while (
          indice + 1 <
          linhasFonte.length
        ) {
          const proxima =
            limparTexto(
              linhasFonte[
                indice + 1
              ]
            );

          if (
            !ehContinuacaoMotorBuyersGuide(
              proxima
            )
          ) {
            break;
          }

          atual =
            `${atual} ${proxima}`;
          indice += 1;
        }
      }

      resultado.push(atual);
    }

    return resultado;
  }

  const fonteBuyersGuide =
    recomporMotorQuebradoBuyersGuide(
      recomporCombustivelQuebradoBuyersGuide(
        fonteBuyersGuideBase
          .map((linha) => limparTexto(linha))
          .filter(Boolean)
      )
    );

  console.log(
    "🧭 V6 FONTE BUYERS GUIDE:",
    linhasReferencias.length > 0
      ? "linhasReferencias"
      : "fallback linhas",
    "linhas:",
    fonteBuyersGuide.length
  );

  function ehCodigoAlfanumericoProdutoBuyersGuide(
    valor = ""
  ) {
    const compacto =
      normalizarCodigo(
        valor
      );

    if (
      compacto.length < 4 ||
      compacto.length > 20
    ) {
      return false;
    }

    if (
      !/[A-Z]/.test(
        compacto
      ) ||
      !/\d/.test(
        compacto
      )
    ) {
      return false;
    }

    if (
      /^(?:19|20)\d{2}$/.test(
        compacto
      )
    ) {
      return false;
    }

    return true;
  }

  function extrairCodigoCurtoFronteiraProdutoBuyersGuide(
    linha = "",
    codigoLongo = ""
  ) {
    const texto =
      limparTexto(linha);

    const match =
      texto.match(
        /^(.+?)\s*[–—−-]\s*(\d{12})\s*$/
      );

    if (!match) {
      return "";
    }

    if (
      normalizarCodigo(
        match[2]
      ) !==
      normalizarCodigo(
        codigoLongo
      )
    ) {
      return "";
    }

    const esquerda =
      limparTexto(
        match[1]
      ).replace(
        /^KIT\s+/i,
        ""
      );

    const candidato =
      esquerda
        .split(/\s+/)
        .map(
          (token) =>
            limparTexto(
              token
            )
        )
        .find(
          (token) =>
            ehCodigoAlfanumericoProdutoBuyersGuide(
              token
            )
        ) || "";

    if (!candidato) {
      return "";
    }

    return normalizarCodigoEquivalente(
      candidato
    );
  }

  function extrairCabecalhoReferencia(
    linha = ""
  ) {
    const texto =
      limparTexto(linha);

    if (!texto) {
      return null;
    }

    if (
      /\b(?:PETROL|DIESEL|BENZINA|GASOLINE|GASOLINA|FLEX|CNG|LPG)\b/i.test(
        texto
      )
    ) {
      return null;
    }

    const codigoLongo =
      extrairCodigoLongoMarelli(
        texto
      );

    if (!codigoLongo) {
      return null;
    }

    let codigoCurto =
      extrairCodigoCurtoSistemasEletronicos(
        texto,
        codigoLongo
      );

    if (
      !codigoCurto ||
      !ehCodigoCurtoSistemasEletronicos(
        codigoCurto
      )
    ) {
      codigoCurto =
        extrairCodigoCurtoFronteiraProdutoBuyersGuide(
          texto,
          codigoLongo
        );
    }

    if (!codigoCurto) {
      return null;
    }

    return {
      codigoLongo:
        normalizarCodigo(
          codigoLongo
        ),

      codigoCurto:
        normalizarCodigoEquivalente(
          codigoCurto
        ),
    };
  }

  function ehLinhaTecnicaBuyersGuide(
    linha = ""
  ) {
    const texto =
      normalizarTexto(linha);

    if (!texto) {
      return true;
    }

    return (
      ehMarcadorPagina(linha) ||
      ehCabecalho(linha) ||
      /^(?:GRUPPO|GROUP)\s+[A-D]\b/.test(
        texto
      ) ||
      texto === "TYPE" ||
      texto === "TYPE TYPE" ||
      texto === "KW" ||
      texto === "KW TYPE" ||
      texto.includes(
        "APPLICAZIONE PER CODICE"
      ) ||
      texto.includes(
        "BUYERS GUIDE"
      ) ||
      texto.includes(
        "FUEL INJECTOR"
      ) ||
      texto.includes(
        "INIETTORE"
      ) ||
      texto.includes(
        "THROTTLE BODY"
      ) ||
      texto.includes(
        "CORPO FARFALLATO"
      ) ||
      texto.includes(
        "STEPPER MOTOR"
      ) ||
      texto.includes(
        "IDLE SPEED CONTROL ACTUATOR"
      ) ||
      texto.includes(
        "ENGINE CONTROL UNIT"
      ) ||
      texto.includes(
        "INTAKE MANIFOLD"
      ) ||
      texto.includes(
        "ACCELERATOR PEDAL SENSOR"
      ) ||
      /^SENSORE\b/.test(
        texto
      ) ||
      /^VALVOLA\b/.test(
        texto
      ) ||
      /^MODULO COLLETTORE\b/.test(
        texto
      ) ||
      /^CABLAGGIO\b/.test(
        texto
      ) ||
      /^CABLE FOR\b/.test(
        texto
      ) ||
      texto.includes(
        "OTHER PARTS"
      )
    );
  }

  function ehAplicacaoCompletaBuyersGuide(
  linha = "",
  codigoLongoAtual = "",
  codigoCurtoAtual = ""
) {
  const texto =
    limparTexto(
      linha
    );

  if (!texto) {
    return false;
  }

  const temCombustivel =
    /\b(?:PETROL|DIESEL|BENZINA|GASOLINE|GASOLINA|FLEX|CNG|LPG)\b/i.test(
      texto
    );

  const temPeriodo =
    /\b(?:0?[1-9]|1[0-2])\/\d{2}\b/.test(
      texto
    );

  if (
    !temCombustivel ||
    !temPeriodo
  ) {
    return false;
  }

  const codigoLongoLinha =
    extrairCodigoLongoMarelli(
      texto
    );

  const codigoCurtoLinha =
    extrairCodigoCurtoSistemasEletronicos(
      texto,
      codigoLongoLinha
    );

  const longoAtual =
    normalizarCodigo(
      codigoLongoAtual || ""
    );

  const curtoAtual =
    normalizarCodigo(
      codigoCurtoAtual || ""
    );

  const longoLinha =
    normalizarCodigo(
      codigoLongoLinha || ""
    );

  const curtoLinha =
    normalizarCodigo(
      codigoCurtoLinha || ""
    );

  if (
    longoLinha &&
    longoAtual &&
    longoLinha !==
      longoAtual
  ) {
    return false;
  }

  if (
    curtoLinha &&
    curtoAtual &&
    curtoLinha !==
      curtoAtual
  ) {
    return false;
  }

  return true;
}

  function extrairTokenTipoAplicacaoBuyersGuide(
    linha = ""
  ) {
    const texto =
      limparTexto(linha);

    if (
      !/^\d+\.\d+/.test(
        texto
      )
    ) {
      return "";
    }

    const comCombustivel =
      texto.match(
        /^(\d+\.\d+\b.*?)(?=\s+(?:Petrol|Diesel|Benzina|Gasoline|Gasolina|Flex|CNG|LPG|Ethanol|Hybrid)\b)/i
      );

    if (comCombustivel) {
      return limparTexto(
        comCombustivel[1]
      );
    }

    if (
      !/\b(?:PETROL|DIESEL|BENZINA|GASOLINE|GASOLINA|FLEX|CNG|LPG)\b/i.test(
        texto
      )
    ) {
      return texto;
    }

    return "";
  }

  function ehAplicacaoCompletaComTipoKwPeriodoBuyersGuide(
    linha = ""
  ) {
    const texto =
      limparTexto(linha);

    if (
      !/^\d+\.\d+/.test(
        texto
      )
    ) {
      return false;
    }

    if (
      !ehAplicacaoCompletaBuyersGuide(
        texto
      )
    ) {
      return false;
    }

    if (
      !/\b(?:PETROL|DIESEL|BENZINA|GASOLINE|GASOLINA|FLEX|CNG|LPG)\s+\d{1,4}\b/i.test(
        texto
      )
    ) {
      return false;
    }

    return Boolean(
      extrairTokenTipoAplicacaoBuyersGuide(
        texto
      )
    );
  }

  function proximaLinhaUtilBuyersGuide(
    indiceAtual
  ) {
    if (
      typeof indiceAtual !==
      "number"
    ) {
      return "";
    }

    for (
      let indiceProximo =
        indiceAtual + 1;
      indiceProximo <
      fonteBuyersGuide.length;
      indiceProximo += 1
    ) {
      const proxima =
        limparTexto(
          fonteBuyersGuide[
            indiceProximo
          ]
        );

      if (proxima) {
        return proxima;
      }
    }

    return "";
  }

  function anteriorLinhaUtilBuyersGuide(
    indiceAtual
  ) {
    if (
      typeof indiceAtual !==
      "number"
    ) {
      return "";
    }

    for (
      let indiceAnterior =
        indiceAtual - 1;
      indiceAnterior >= 0;
      indiceAnterior -= 1
    ) {
      const anterior =
        limparTexto(
          fonteBuyersGuide[
            indiceAnterior
          ]
        );

      if (anterior) {
        return anterior;
      }
    }

    return "";
  }

  function ehNomeComercialAntesDeTipoBuyersGuide(
    linha = "",
    indiceAtual
  ) {
    const texto =
      limparTexto(linha);

    if (
      !texto ||
      /^\d+\.\d+/.test(
        texto
      ) ||
      !/[A-Za-zÀ-ÿ]/.test(
        texto
      )
    ) {
      return false;
    }

    const anterior =
      anteriorLinhaUtilBuyersGuide(
        indiceAtual
      );

    if (
      anterior.includes("(") &&
      !anterior.includes(")")
    ) {
      return false;
    }

    return /^\d{1,2}\.\d/.test(
      proximaLinhaUtilBuyersGuide(
        indiceAtual
      )
    );
  }

  function ehModeloNumericoBuyersGuide(
    linha = "",
    indiceAtual
  ) {
    const texto =
      limparTexto(linha);

    if (
      !/^\d{1,4}$/.test(
        texto
      )
    ) {
      return false;
    }

    return /^\d+\.\d+/.test(
      proximaLinhaUtilBuyersGuide(
        indiceAtual
      )
    );
  }

  function pareceInicioAplicacaoSemPeriodo(
    linha = "",
    indiceAtual
  ) {
    const texto =
      limparTexto(linha);

    if (
      !texto ||
      identificarMontadora(
        texto
      ) ||
      extrairCabecalhoReferencia(
        texto
      ) ||
      ehLinhaTecnicaBuyersGuide(
        texto
      ) ||
      ehModeloNumericoBuyersGuide(
        texto,
        indiceAtual
      ) ||
      ehNomeComercialAntesDeTipoBuyersGuide(
        texto,
        indiceAtual
      )
    ) {
      return false;
    }

    const cilindradaLitros =
      /^\d+\.\d+/.test(
        texto
      );

    return (
      /^\d/.test(texto) &&
      !(
        texto.includes("(") &&
        texto.includes(")") &&
        !cilindradaLitros &&
        !/\b(?:PETROL|DIESEL|BENZINA|GASOLINE|GASOLINA|FLEX|CNG|LPG)\b/i.test(
          texto
        )
      )
    );
  }

  function ehModeloBuyersGuide(
    linha = "",
    indiceAtual
  ) {
    const texto =
      limparTexto(linha);

    if (
      !texto ||
      identificarMontadora(
        texto
      ) ||
      extrairCabecalhoReferencia(
        texto
      ) ||
      ehLinhaTecnicaBuyersGuide(
        texto
      ) ||
      ehAplicacaoCompletaBuyersGuide(
        texto
      )
    ) {
      return false;
    }

    if (
      ehModeloNumericoBuyersGuide(
        texto,
        indiceAtual
      ) ||
      ehNomeComercialAntesDeTipoBuyersGuide(
        texto,
        indiceAtual
      )
    ) {
      return true;
    }

    const textoModelo =
      normalizarTexto(
        texto
      );

    if (
      textoModelo ===
        "OTHER" ||
      textoModelo ===
        "OTHERS"
    ) {
      return false;
    }

    if (
      /^[A-Z0-9._]+\)\s*$/.test(
        texto
      ) &&
      !texto.includes("(")
    ) {
      return false;
    }

    if (
      /^\d+\.\d+/.test(
        texto
      ) ||
      /^\d+x\d+/i.test(
        texto
      )
    ) {
      return false;
    }

    if (
      texto.includes("(") &&
      texto.includes(")")
    ) {
      return true;
    }

    return (
      /[A-Za-zÀ-ÿ]/.test(
        texto
      ) &&
      !/^\d(?:[.,]\d|\s)/.test(
        texto
      ) &&
      texto.split(/\s+/).length <=
        10
    );
  }

  function criarRegistroBuyersGuide({
    codigoLongo,
    codigoCurto,
    montadora,
    modelo,
    aplicacao,
  }) {
    if (
      !codigoLongo ||
      !codigoCurto ||
      !montadora ||
      !modelo ||
      !aplicacao
    ) {
      return null;
    }

    const motor =
      extrairMotorSistemasEletronicos(
        aplicacao
      ) ||
      limparTexto(
        aplicacao.split(
          /\b(?:PETROL|DIESEL|BENZINA|GASOLINE|GASOLINA|FLEX|CNG|LPG)\b/i
        )[0] || ""
      );

    const periodo =
      extrairPeriodoBicoMarelli(
        aplicacao
      );

    const peca =
      identificarPecaSistemasEletronicos(
        codigoCurto,
        codigoCurto
      );

    const observacao =
      limparTexto(
        [
          aplicacao,
          codigoLongo,
          codigoCurto,
          "Buyers Guide",
        ]
          .filter(Boolean)
          .join(" | ")
      );

    const registro =
      criarRegistro({
        codigo:
          codigoLongo,

        equivalentes: [
          codigoCurto,
        ],

        codigoEquivalenteForcado:
          codigoCurto,

        preservarFormatoEquivalentes:
          true,

        montadora,

        modelo,

        motor,

        linha:
          observacao,

        configuracao,

        nomeArquivo,

        pecaForcada:
          peca,
      });

    if (!registro) {
      return null;
    }

    registro.ano_inicio =
      periodo.ano_inicio;

    registro.ano_fim =
      periodo.ano_fim;

    registro.aplicacao =
      aplicacao;

    registro.observacao =
      observacao;

    return registro;
  }

  const registrosBuyersGuide = [];

  let cabecalhosReconhecidosV6 = 0;
  let cabecalhosIwp058V6 = 0;
  let cabecalhosIwp049V6 = 0;

  let codigoLongoAtual = "";
  let codigoCurtoAtual = "";
  let montadoraAtual = "";
  let modeloAtual = "";
  let prefixoAplicacaoAtual = "";
  let ultimoTokenTipoAplicacao = "";
  let primeiraUtilAposRuidoPagina = false;

  let encontrouBuyersGuide =
    false;

  function marcarRuidoDePaginaBuyersGuide() {
    if (modeloAtual) {
      primeiraUtilAposRuidoPagina =
        true;
    }
  }

  function aplicarTipoEncerradoAposRuidoBuyersGuide(
    linha = ""
  ) {
    if (
      !primeiraUtilAposRuidoPagina
    ) {
      return;
    }

    primeiraUtilAposRuidoPagina =
      false;

    if (
      !modeloAtual ||
      !ehAplicacaoCompletaComTipoKwPeriodoBuyersGuide(
        linha
      )
    ) {
      return;
    }

    const token =
      extrairTokenTipoAplicacaoBuyersGuide(
        linha
      );

    if (
      token &&
      token ===
        ultimoTokenTipoAplicacao
    ) {
      modeloAtual = "";
      prefixoAplicacaoAtual = "";
    }
  }

  function ehFragmentoTipoOuAplicacaoBuyersGuide(
    linha = "",
    indiceAtual
  ) {
    const texto =
      limparTexto(linha);

    if (!texto) {
      return false;
    }

    if (
      ehAplicacaoCompletaBuyersGuide(
        texto
      ) ||
      pareceInicioAplicacaoSemPeriodo(
        texto,
        indiceAtual
      )
    ) {
      return true;
    }

    return (
      /^(?:PETROL|DIESEL|LPG|CNG|ETHANOL)\b/i.test(
        texto
      ) ||
      /^\([^)]*\)$/.test(
        texto
      )
    );
  }

  function ehCabecalhoChromeDePagina(
    indiceAtual
  ) {
    if (
      !codigoLongoAtual ||
      !codigoCurtoAtual
    ) {
      return false;
    }

    let viuGrupoDePagina =
      false;

    for (
      let indiceProximo =
        indiceAtual + 1;
      indiceProximo <
      fonteBuyersGuide.length;
      indiceProximo += 1
    ) {
      const proxima =
        limparTexto(
          fonteBuyersGuide[
            indiceProximo
          ]
        );

      if (!proxima) {
        continue;
      }

      if (
        extrairCabecalhoReferencia(
          proxima
        )
      ) {
        continue;
      }

      if (
        /^(?:GRUPPO|GROUP)\s+[A-D]\b/i.test(
          proxima
        )
      ) {
        viuGrupoDePagina =
          true;
        continue;
      }

      if (
        ehLinhaTecnicaBuyersGuide(
          proxima
        ) ||
        identificarMontadora(
          proxima
        )
      ) {
        continue;
      }

      if (
        ehFragmentoTipoOuAplicacaoBuyersGuide(
          proxima,
          indiceProximo
        )
      ) {
        return true;
      }

      if (
        ehModeloBuyersGuide(
          proxima,
          indiceProximo
        )
      ) {
        return viuGrupoDePagina;
      }

      return false;
    }

    return false;
  }

  function ehMontadoraChromeDePagina(
    indiceAtual
  ) {
    if (
      !modeloAtual ||
      !codigoCurtoAtual
    ) {
      return false;
    }

    let viuEstruturaDePagina =
      false;

    for (
      let indiceProximo =
        indiceAtual + 1;
      indiceProximo <
      fonteBuyersGuide.length;
      indiceProximo += 1
    ) {
      const proxima =
        limparTexto(
          fonteBuyersGuide[
            indiceProximo
          ]
        );

      if (!proxima) {
        continue;
      }

      if (
        extrairCabecalhoReferencia(
          proxima
        ) ||
        ehLinhaTecnicaBuyersGuide(
          proxima
        )
      ) {
        viuEstruturaDePagina =
          true;
        continue;
      }

      if (
        identificarMontadora(
          proxima
        )
      ) {
        continue;
      }

      if (
        ehFragmentoTipoOuAplicacaoBuyersGuide(
          proxima,
          indiceProximo
        )
      ) {
        return viuEstruturaDePagina;
      }

      if (
        ehModeloBuyersGuide(
          proxima,
          indiceProximo
        )
      ) {
        if (
          ehModeloChromeDePagina(
            indiceProximo
          )
        ) {
          return true;
        }

        return viuEstruturaDePagina;
      }

      return false;
    }

    return viuEstruturaDePagina;
  }

  function ehModeloChromeDePagina(
    indiceAtual
  ) {
    let viuEstruturaDePagina =
      false;

    for (
      let indiceProximo =
        indiceAtual + 1;
      indiceProximo <
      fonteBuyersGuide.length;
      indiceProximo += 1
    ) {
      const proxima =
        limparTexto(
          fonteBuyersGuide[
            indiceProximo
          ]
        );

      if (!proxima) {
        continue;
      }

      if (
        extrairCabecalhoReferencia(
          proxima
        ) ||
        ehLinhaTecnicaBuyersGuide(
          proxima
        ) ||
        identificarMontadora(
          proxima
        )
      ) {
        viuEstruturaDePagina =
          true;
        continue;
      }

      if (
        ehFragmentoTipoOuAplicacaoBuyersGuide(
          proxima,
          indiceProximo
        ) ||
        ehModeloBuyersGuide(
          proxima,
          indiceProximo
        )
      ) {
        return viuEstruturaDePagina;
      }

      return false;
    }

    return viuEstruturaDePagina;
  }

  for (
    let indice = 0;
    indice < fonteBuyersGuide.length;
    indice += 1
  ) {
    const linha =
      limparTexto(
        fonteBuyersGuide[indice]
      );

    if (!linha) {
      continue;
    }

    const cabecalho =
      extrairCabecalhoReferencia(
        linha
      );

    if (cabecalho) {
      encontrouBuyersGuide =
        true;

      cabecalhosReconhecidosV6 +=
        1;

      if (
        normalizarCodigo(
          cabecalho.codigoCurto
        ) === "IWP058"
      ) {
        cabecalhosIwp058V6 +=
          1;
      }

      if (
        normalizarCodigo(
          cabecalho.codigoCurto
        ) === "IWP049"
      ) {
        cabecalhosIwp049V6 +=
          1;
      }

      const mesmoProduto =
        Boolean(
          codigoLongoAtual
        ) &&
        Boolean(
          codigoCurtoAtual
        ) &&
        normalizarCodigo(
          cabecalho.codigoLongo
        ) ===
          normalizarCodigo(
            codigoLongoAtual
          ) &&
        normalizarCodigo(
          cabecalho.codigoCurto
        ) ===
          normalizarCodigo(
            codigoCurtoAtual
          );

      if (mesmoProduto) {
        marcarRuidoDePaginaBuyersGuide();
        continue;
      }

      if (
        ehCabecalhoChromeDePagina(
          indice
        )
      ) {
        marcarRuidoDePaginaBuyersGuide();
        continue;
      }

      codigoLongoAtual =
        cabecalho.codigoLongo;

      codigoCurtoAtual =
        cabecalho.codigoCurto;

      montadoraAtual = "";
      modeloAtual = "";
      prefixoAplicacaoAtual = "";
      ultimoTokenTipoAplicacao = "";
      primeiraUtilAposRuidoPagina =
        false;

      continue;
    }

    if (
      !codigoLongoAtual ||
      !codigoCurtoAtual
    ) {
      continue;
    }

    const montadora =
      identificarMontadora(
        linha
      );

    if (montadora) {
      const mesmaMontadora =
        Boolean(
          montadoraAtual
        ) &&
        normalizarTexto(
          montadora
        ) ===
          normalizarTexto(
            montadoraAtual
          );

      if (mesmaMontadora) {
        marcarRuidoDePaginaBuyersGuide();
        continue;
      }

      if (
        ehMontadoraChromeDePagina(
          indice
        )
      ) {
        marcarRuidoDePaginaBuyersGuide();
        continue;
      }

      montadoraAtual =
        montadora;

      modeloAtual = "";
      prefixoAplicacaoAtual = "";
      ultimoTokenTipoAplicacao = "";
      primeiraUtilAposRuidoPagina =
        false;

      continue;
    }

    if (
      ehLinhaTecnicaBuyersGuide(
        linha
      )
    ) {
      marcarRuidoDePaginaBuyersGuide();
      continue;
    }

    if (
      /^\([^)]*\)$/.test(
        linha
      )
    ) {
      aplicarTipoEncerradoAposRuidoBuyersGuide(
        linha
      );

      if (prefixoAplicacaoAtual) {
        prefixoAplicacaoAtual =
          limparTexto(
            `${prefixoAplicacaoAtual} ${linha}`
          );
        continue;
      }

      if (modeloAtual) {
        modeloAtual =
          limparTexto(
            `${modeloAtual} ${linha}`
          );
        continue;
      }
    }

    if (
      ehAplicacaoCompletaBuyersGuide(
        linha
      )
    ) {
      aplicarTipoEncerradoAposRuidoBuyersGuide(
        linha
      );

      const prefixoLimpo =
  limparTexto(
    prefixoAplicacaoAtual || ""
  );

const codigoLongoPrefixo =
  extrairCodigoLongoMarelli(
    prefixoLimpo
  );

const codigoCurtoPrefixo =
  extrairCodigoCurtoSistemasEletronicos(
    prefixoLimpo,
    codigoLongoPrefixo
  );

const codigoLongoAtualNormalizado =
  normalizarCodigo(
    codigoLongoAtual || ""
  );

const codigoCurtoAtualNormalizado =
  normalizarCodigo(
    codigoCurtoAtual || ""
  );

const codigoLongoPrefixoNormalizado =
  normalizarCodigo(
    codigoLongoPrefixo || ""
  );

const codigoCurtoPrefixoNormalizado =
  normalizarCodigo(
    codigoCurtoPrefixo || ""
  );

const prefixoPertenceOutroProduto =
  (
    codigoLongoPrefixoNormalizado &&
    codigoLongoPrefixoNormalizado !==
      codigoLongoAtualNormalizado
  ) ||
  (
    codigoCurtoPrefixoNormalizado &&
    codigoCurtoPrefixoNormalizado !==
      codigoCurtoAtualNormalizado
  );

const prefixoSeguro =
  prefixoPertenceOutroProduto
    ? ""
    : prefixoLimpo;

const aplicacao =
  limparTexto(
    [
      prefixoSeguro,
      linha,
    ]
      .filter(Boolean)
      .join(" ")
  );
      const registro =
        criarRegistroBuyersGuide({
          codigoLongo:
            codigoLongoAtual,

          codigoCurto:
            codigoCurtoAtual,

          montadora:
            montadoraAtual,

          modelo:
            modeloAtual,

          aplicacao,
        });

      if (registro) {
        registrosBuyersGuide.push(
          registro
        );

        const tokenTipo =
          extrairTokenTipoAplicacaoBuyersGuide(
            aplicacao
          );

        if (tokenTipo) {
          ultimoTokenTipoAplicacao =
            tokenTipo;
        }
      }

      prefixoAplicacaoAtual = "";

      continue;
    }

    if (
  pareceInicioAplicacaoSemPeriodo(
    linha,
    indice
  )
) {
  const codigoLongoLinha =
    extrairCodigoLongoMarelli(
      linha
    );

  const codigoCurtoLinha =
    extrairCodigoCurtoSistemasEletronicos(
      linha,
      codigoLongoLinha
    );

  const codigoLongoAtualNormalizado =
    normalizarCodigo(
      codigoLongoAtual
    );

  const codigoCurtoAtualNormalizado =
    normalizarCodigo(
      codigoCurtoAtual
    );

  const codigoLongoLinhaNormalizado =
    normalizarCodigo(
      codigoLongoLinha
    );

  const codigoCurtoLinhaNormalizado =
    normalizarCodigo(
      codigoCurtoLinha
    );

  const pertenceOutroProduto =
    (
      codigoLongoLinhaNormalizado &&
      codigoLongoLinhaNormalizado !==
        codigoLongoAtualNormalizado
    ) ||
    (
      codigoCurtoLinhaNormalizado &&
      codigoCurtoLinhaNormalizado !==
        codigoCurtoAtualNormalizado
    );

  aplicarTipoEncerradoAposRuidoBuyersGuide(
    linha
  );

  if (
    !pertenceOutroProduto
  ) {
    prefixoAplicacaoAtual =
      linha;

    const tokenTipo =
      extrairTokenTipoAplicacaoBuyersGuide(
        linha
      );

    if (tokenTipo) {
      ultimoTokenTipoAplicacao =
        tokenTipo;
    }
  }

  continue;
}

    if (
      ehModeloBuyersGuide(
        linha,
        indice
      )
    ) {
      if (
        ehModeloChromeDePagina(
          indice
        )
      ) {
        marcarRuidoDePaginaBuyersGuide();
        continue;
      }

      aplicarTipoEncerradoAposRuidoBuyersGuide(
        linha
      );

      modeloAtual =
        linha;

      prefixoAplicacaoAtual = "";
      ultimoTokenTipoAplicacao = "";
      primeiraUtilAposRuidoPagina =
        false;

      continue;
    }
  }

  const registrosBuyersGuideUnicos =
    removerDuplicados(
      registrosBuyersGuide
    );

  if (
    encontrouBuyersGuide &&
    registrosBuyersGuideUnicos.length >
      50
  ) {
    const testeIwp049 =
      registrosBuyersGuideUnicos.filter(
        (registro) =>
          normalizarCodigo(
            registro
              ?.codigo_equivalente ||
            ""
          ) ===
          "IWP049"
      );

    const suspeitosIwp049 =
      testeIwp049.filter(
        (registro) => {
          const alvo =
            normalizarTexto(
              `${registro?.montadora || ""} ${registro?.modelo || ""}`
            );

          return (
            alvo.includes(
              "BX (XB"
            ) ||
            alvo.includes(
              "BX BREAK"
            ) ||
            alvo.includes(
              "PORSCHE"
            ) ||
            alvo.includes(
              "SEAT AROSA"
            ) ||
            alvo.includes(
              "CITROEN CADDY"
            )
          );
        }
      );

    console.log(
      "=========================================="
    );

    console.log(
      "🧠 MARELLI ELECTRONIC SYSTEMS — BUYERS GUIDE V6"
    );

    console.log(
      "🧩 CABEÇALHOS V6:",
      {
        total:
          cabecalhosReconhecidosV6,

        IWP049:
          cabecalhosIwp049V6,

        IWP058:
          cabecalhosIwp058V6,
      }
    );

    console.log(
      "TOTAL:",
      registrosBuyersGuideUnicos.length
    );

    console.log(
      "IWP049:",
      testeIwp049.length,
      testeIwp049
    );

    console.log(
      "IWP049 SUSPEITOS V6:",
      suspeitosIwp049.length,
      suspeitosIwp049
    );

    console.log(
      "=========================================="
    );

    onProgresso?.(
      `✅ Magneti Marelli Electronic Systems (Buyers Guide): ${registrosBuyersGuideUnicos.length} registro(s) encontrado(s).`
    );

    return registrosBuyersGuideUnicos;
  }

  console.warn(
    "⚠️ Electronic Systems: Buyers Guide não detectado/insuficiente. Usando parser legado."
  );

  return parserSistemasEletronicosMarelliLegado({
    linhas,
    linhasReferencias,
    linhasEquivalencias,
    configuracao,
    nomeArquivo,
    onProgresso,
  });
}

function parserSistemasEletronicosMarelliLegado({
  linhas = [],
  linhasReferencias = [],
  linhasEquivalencias = [],
  configuracao = {},
  nomeArquivo = "",
  onProgresso,
}) {
  const registros = [];

  const todasAsLinhas = [
    ...linhasReferencias,
    ...linhasEquivalencias,
    ...linhas,
  ];

  const mapaSequencial =
    criarMapaSequencialSistemasEletronicosMarelli(
      todasAsLinhas
    );

  let montadoraAtual = "";
  let modeloAtual = "";
  let motorBaseAtual = "";

  let linhasAplicacaoAtual = [];

  let aplicacaoTemCodigo = false;

  function limparAplicacaoAtual() {
    linhasAplicacaoAtual = [];
    aplicacaoTemCodigo = false;
  }

  function textoAplicacaoAtual() {
    return limparTexto(
      linhasAplicacaoAtual
        .filter(Boolean)
        .join(" ")
    );
  }

  for (
    let indice = 0;
    indice < linhas.length;
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
      ) ||
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

    if (montadora) {
      montadoraAtual =
        montadora;

      modeloAtual = "";
      motorBaseAtual = "";

      limparAplicacaoAtual();

      continue;
    }

    if (
      ehModeloSistemasEletronicosMarelli(
        linha
      )
    ) {
      modeloAtual =
        limparTexto(
          linha
        );

      motorBaseAtual = "";

      limparAplicacaoAtual();

      continue;
    }

    const motorBaseLinha =
      extrairBaseMotorSistemasEletronicos(
        linha
      );

    if (
      motorBaseLinha &&
      !extrairCodigoLongoMarelli(
        linha
      ) &&
      !/\b(?:PETROL|DIESEL|BENZINA|GASOLINE|GASOLINA|CNG|LPG)\b/i.test(
        linha
      )
    ) {
      motorBaseAtual =
        motorBaseLinha;

      limparAplicacaoAtual();

      continue;
    }

    const codigoLongo =
      extrairCodigoLongoMarelli(
        linha
      );

    if (!codigoLongo) {
      const codigoCurtoSolto =
        extrairCodigoCurtoSequencialMarelli(
          linha
        );

      if (
        codigoCurtoSolto ||
        ehDescricaoTecnicaSistemasEletronicos(
          linha
        )
      ) {
        continue;
      }

      if (
        ehLinhaAplicacaoSistemasEletronicosMarelli(
          linha
        )
      ) {
        if (
          /^Ã /i.test(
            linha
          )
        ) {
          linhasAplicacaoAtual.push(
            linha
          );

          continue;
        }

        if (
          /^(?:PETROL|DIESEL|BENZINA|GASOLINE|GASOLINA|CNG|LPG)\b/i.test(
            linha
          )
        ) {
          if (
            !aplicacaoTemCodigo &&
            linhasAplicacaoAtual.length >
              0
          ) {
            linhasAplicacaoAtual.push(
              linha
            );
          } else {
            linhasAplicacaoAtual = [
              motorBaseAtual,
              linha,
            ].filter(Boolean);

            aplicacaoTemCodigo =
              false;
          }

          continue;
        }

        const motorExplicito =
          extrairMotorSistemasEletronicos(
            linha
          );

        if (
          motorExplicito
        ) {
          motorBaseAtual =
            motorExplicito;
        }

        linhasAplicacaoAtual = [
          linha,
        ];

        aplicacaoTemCodigo =
          false;

        continue;
      }

      continue;
    }

    const indiceCodigo =
      linha.indexOf(
        codigoLongo
      );

    const prefixoCodigo =
      indiceCodigo >= 0
        ? limparTexto(
            linha.slice(
              0,
              indiceCodigo
            )
          )
        : "";

    if (
      prefixoCodigo &&
      ehLinhaAplicacaoSistemasEletronicosMarelli(
        prefixoCodigo
      )
    ) {
      if (
        /^Ã /i.test(
          prefixoCodigo
        )
      ) {
        linhasAplicacaoAtual.push(
          prefixoCodigo
        );
      } else if (
        /^(?:PETROL|DIESEL|BENZINA|GASOLINE|GASOLINA|CNG|LPG)\b/i.test(
          prefixoCodigo
        )
      ) {
        if (
          !aplicacaoTemCodigo &&
          linhasAplicacaoAtual.length >
            0
        ) {
          linhasAplicacaoAtual.push(
            prefixoCodigo
          );
        } else {
          linhasAplicacaoAtual = [
            motorBaseAtual,
            prefixoCodigo,
          ].filter(Boolean);
        }
      } else {
        const motorExplicito =
          extrairMotorSistemasEletronicos(
            prefixoCodigo
          );

        if (
          motorExplicito
        ) {
          motorBaseAtual =
            motorExplicito;
        }

        linhasAplicacaoAtual = [
          prefixoCodigo,
        ];
      }

      aplicacaoTemCodigo =
        false;
    }

    let aplicacao =
      textoAplicacaoAtual();

    if (
      aplicacao &&
      motorBaseAtual &&
      /^(?:PETROL|DIESEL|BENZINA|GASOLINE|GASOLINA|CNG|LPG)\b/i.test(
        aplicacao
      )
    ) {
      aplicacao =
        limparTexto(
          `${motorBaseAtual} ${aplicacao}`
        );
    }

    if (
      !montadoraAtual ||
      !modeloAtual ||
      !aplicacao
    ) {
      continue;
    }

    const infoMapa =
      mapaSequencial.get(
        codigoLongo
      ) || {
        codigoCurto: "",
        linhaTecnica: "",
      };

    const codigoCurtoLinha =
      extrairCodigoCurtoSistemasEletronicos(
        linha,
        codigoLongo
      );

    const codigoCurto =
      codigoCurtoLinha ||
      infoMapa.codigoCurto ||
      "";

    const linhaTecnica =
      limparTexto(
        infoMapa.linhaTecnica ||
        linha
      );

    const textoTipoPeca =
      limparTexto(
        `${linha} ${linhaTecnica}`
      );

    const peca =
      identificarPecaSistemasEletronicos(
        textoTipoPeca,
        codigoCurto
      );

    let motor =
      extrairMotorSistemasEletronicos(
        aplicacao
      );

    if (
      !motor
    ) {
      motor =
        motorBaseAtual;
    }

    const periodo =
      extrairPeriodoBicoMarelli(
        aplicacao
      );

    const equivalentes = [
      ...new Set(
        [
          codigoCurto,
          normalizarCodigo(
            codigoCurto
          ),
        ].filter(Boolean)
      ),
    ];

   const linhaTecnicaLimpa =
  limparTexto(
    linhaTecnica || ""
  );

const codigoCurtoNormalizado =
  normalizarCodigo(
    codigoCurto || ""
  );

const codigoLongoNormalizado =
  normalizarCodigo(
    codigoLongo || ""
  );

const codigosCurtosLinhaTecnica =
  [
    ...linhaTecnicaLimpa
      .toUpperCase()
      .matchAll(
        /\b(?:IWP|IPM|FEI|PAS|TB)[A-Z0-9./-]*\b/g
      ),
  ]
    .map(
      (match) =>
        normalizarCodigo(
          match[0]
        )
    )
    .filter(Boolean);

const oemsLinhaTecnica =
  [
    ...linhaTecnicaLimpa
      .toUpperCase()
      .matchAll(
        /\b8\d{11}\b/g
      ),
  ]
    .map(
      (match) =>
        normalizarCodigo(
          match[0]
        )
    )
    .filter(Boolean);

const temCodigoCurtoDiferente =
  codigosCurtosLinhaTecnica.some(
    (codigo) =>
      codigo !==
      codigoCurtoNormalizado
  );

const temOemDiferente =
  oemsLinhaTecnica.some(
    (codigo) =>
      codigo !==
      codigoLongoNormalizado
  );

const incluirLinhaTecnica =
  linhaTecnicaLimpa &&
  linhaTecnicaLimpa !==
    limparTexto(linha) &&
  !temCodigoCurtoDiferente &&
  !temOemDiferente;

const observacao =
  limparTexto(
    [
      aplicacao,
      codigoLongo,
      codigoCurto,
      incluirLinhaTecnica
        ? linhaTecnicaLimpa
        : "",
    ]
      .filter(Boolean)
      .join(" | ")
  );
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

        motor,

        linha:
          observacao,

        configuracao,

        nomeArquivo,

        pecaForcada:
          peca,
      });

    if (
      registro
    ) {
      registro.ano_inicio =
        periodo.ano_inicio;

      registro.ano_fim =
        periodo.ano_fim;

      registro.aplicacao =
        aplicacao;

      registro.observacao =
        observacao;

      registros.push(
        registro
      );

      aplicacaoTemCodigo =
        true;
    }
  }

  const registrosUnicos =
    removerDuplicados(
      registros
    );

  const testeIwp049 =
    registrosUnicos.filter(
      (registro) =>
        normalizarCodigo(
          registro
            ?.codigo_equivalente ||
          ""
        ) ===
          "IWP049" ||
        registro
          ?.equivalentes
          ?.some(
            (codigo) =>
              normalizarCodigo(
                codigo
              ) ===
              "IWP049"
          )
    );

  const suspeitosIwp049Bx =
    testeIwp049.filter(
      (registro) => {
        const modelo = normalizarTexto(
          registro?.modelo || ""
        );

        return (
          modelo === "BX (XB-_)" ||
          modelo === "BX BREAK (XB-_)" ||
          modelo.startsWith("BX BREAK")
        );
      }
    );

  console.log(
    "=========================================="
  );

  console.log(
    "ðŸ§  MARELLI ELECTRONIC SYSTEMS â€” SEQUENCIAL"
  );

  console.log(
    "TOTAL:",
    registrosUnicos.length
  );

  console.log(
    "IWP049:",
    testeIwp049.length,
    testeIwp049
  );

  console.log(
    "IWP049 SUSPEITOS BX/BX BREAK:",
    suspeitosIwp049Bx.length,
    suspeitosIwp049Bx
  );

  console.log(
    "=========================================="
  );

  onProgresso?.(
    `âœ… Magneti Marelli Electronic Systems: ${registrosUnicos.length} registro(s) encontrado(s).`
  );

  return registrosUnicos;
}
/*
 * ============================================================
 * PARSER UNIVERSAL MAGNETI MARELLI
 * ============================================================
 */

export async function parserMagnetiMarelliUniversal({
  texto = "",
  textoAplicacoes = "",
  textoReferencias = "",
  textoEquivalencias = "",
  configuracao = {},
  nomeArquivo = "",
  onProgresso,
}) {
  const tipoCatalogo =
    String(
      configuracao?.tipoCatalogo ||
      ""
    )
      .trim()
      .toLowerCase();

  /*
   * ========================================================
   * TEXTOS
   * ========================================================
   */

  const usarOrdemNaturalElectronicSystems =
    tipoCatalogo ===
      "sistemas_eletronicos" ||
    tipoCatalogo ===
      "electronic_systems" ||
    tipoCatalogo ===
      "sistemas_eletronicos_ignicao";

  const transformarLinhasCatalogo =
    usarOrdemNaturalElectronicSystems
      ? transformarEmLinhasElectronicSystems
      : transformarEmLinhas;

  const textoPrincipal =
    textoAplicacoes ||
    texto ||
    "";

  const linhas =
    transformarLinhasCatalogo(
      textoPrincipal
    );

  const linhasReferencias =
    transformarLinhasCatalogo(
      textoReferencias
    );

  const linhasEquivalencias =
    transformarLinhasCatalogo(
      textoEquivalencias
    );

  /*
   * ========================================================
   * IDENTIFICAÃ‡ÃƒO DO CATÃLOGO
   * ========================================================
   */

  const ehSistemasEletronicos =
    usarOrdemNaturalElectronicSystems;

  const ehBaterias2024 =
    tipoCatalogo ===
      "baterias_2024" ||
    tipoCatalogo ===
      "batteries_2024";

  /*
   * ========================================================
   * ELECTRONIC SYSTEMS
   * ========================================================
   */

  if (
    ehSistemasEletronicos
  ) {
    return parserSistemasEletronicosMarelli({
      linhas,
      linhasReferencias,
      linhasEquivalencias,
      configuracao,
      nomeArquivo,
      onProgresso,
    });
  }

  /*
   * ========================================================
   * BICOS INJETORES MARELLI
   * ========================================================
   */

  const textoNormalizado =
    normalizarTexto(
      [
        texto,
        textoReferencias,
        textoEquivalencias,
        nomeArquivo,
        configuracao
          ?.origemCatalogo,
      ]
        .filter(Boolean)
        .join(" ")
    );

  const ehCatalogoBicos2016 =
    (
      textoNormalizado.includes(
        "FUEL INJECTOR"
      ) ||
      textoNormalizado.includes(
        "INIETTORE"
      )
    ) &&
    (
      textoNormalizado.includes(
        "IWP"
      ) ||
      textoNormalizado.includes(
        "IPM"
      ) ||
      textoNormalizado.includes(
        "FEI"
      )
    ) &&
    (
      tipoCatalogo ===
        "bicos_injetores" ||
      tipoCatalogo ===
        "injetores" ||
      tipoCatalogo ===
        "fuel_injectors"
    );

  if (
    ehCatalogoBicos2016
  ) {
    return parserBicosInjetoresMarelli2016({
      linhas,
      configuracao,
      nomeArquivo,
    });
  }

  /*
   * ========================================================
   * MAPA DE EQUIVALÃŠNCIAS
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

    const codigoPrincipal =
      codigos[0];

    if (
      !mapaEquivalencias.has(
        codigoPrincipal
      )
    ) {
      mapaEquivalencias.set(
        codigoPrincipal,
        new Set()
      );
    }

    const conjunto =
      mapaEquivalencias.get(
        codigoPrincipal
      );

    for (
      const codigo
      of codigos.slice(1)
    ) {
      if (
        codigo &&
        codigo !==
          codigoPrincipal
      ) {
        conjunto.add(
          codigo
        );
      }
    }
  }

  /*
   * ========================================================
   * CÃ“DIGOS DO GUIA DE REFERÃŠNCIAS
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
   * APLICAÃ‡Ã•ES â€” PARSER UNIVERSAL
   * ========================================================
   */

  const registros = [];

  let montadoraAtual = "";
  let modeloAtual = "";
  let motorAtual = "";

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
            ? [
                codigoCurto,
              ]
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
                "CatÃ¡logo Magneti Marelli Batteries 2024",
            },

            nomeArquivo,

            pecaForcada:
              "Bateria",
          });

        if (
          registro
        ) {
          registro.modelo =
            null;

          registro.motor =
            null;

          registro.origem_catalogo =
            "CatÃ¡logo Magneti Marelli Batteries 2024";

          registros.push(
            registro
          );
        }

        continue;
      }
    }

    /*
     * ======================================================
     * CANDIDATOS
     * ======================================================
     */

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
     * LINHA SEM CÃ“DIGO
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

        motorAtual = "";

        continue;
      }

      continue;
    }

    /*
     * ======================================================
     * CÃ“DIGO PRINCIPAL
     * ======================================================
     */

    const codigoPrincipal =
      candidatos[0];

    if (
      !codigoPrincipal
    ) {
      continue;
    }

    /*
     * ======================================================
     * EQUIVALÃŠNCIAS
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

    /*
     * ======================================================
     * MOTOR
     * ======================================================
     */

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

    /*
     * ======================================================
     * REGISTRO
     * ======================================================
     */

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
                  "CatÃ¡logo Magneti Marelli Batteries 2024",
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
        registro.modelo =
          null;

        registro.motor =
          null;

        registro.origem_catalogo =
          "CatÃ¡logo Magneti Marelli Batteries 2024";
      }

      registros.push(
        registro
      );
    }
  }

  /*
   * ========================================================
   * FALLBACK REFERÃŠNCIAS
   * ========================================================
   */

  if (
    registros.length === 0 &&
    linhasReferencias.length >
      0
  ) {
    for (
      const linha
      of linhasReferencias
    ) {
      if (
        !linha ||
        ehMarcadorPagina(
          linha
        )
      ) {
        continue;
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
                    "CatÃ¡logo Magneti Marelli Batteries 2024",
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
          registro.modelo =
            null;

          registro.motor =
            null;

          registro.origem_catalogo =
            "CatÃ¡logo Magneti Marelli Batteries 2024";
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
    linhasEquivalencias.length >
      0
  ) {
    for (
      const linha
      of linhasEquivalencias
    ) {
      if (
        !linha ||
        ehMarcadorPagina(
          linha
        )
      ) {
        continue;
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
                    "CatÃ¡logo Magneti Marelli Batteries 2024",
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
          registro.modelo =
            null;

          registro.motor =
            null;

          registro.origem_catalogo =
            "CatÃ¡logo Magneti Marelli Batteries 2024";
        }

        registros.push(
          registro
        );
      }
    }
  }

  /*
   * ========================================================
   * RESULTADO FINAL
   * ========================================================
   */

  const registrosUnicos =
    removerDuplicados(
      registros
    );

  console.log(
    "=========================================="
  );

  console.log(
    "MARELLI UNIVERSAL ENCONTRADOS:",
    registros.length
  );

  console.log(
    "MARELLI UNIVERSAL ÃšNICOS:",
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
    `âœ… Magneti Marelli Universal: ${registrosUnicos.length} registro(s) encontrado(s).`
  );

  return registrosUnicos;
}

export default parserMagnetiMarelliUniversal;
