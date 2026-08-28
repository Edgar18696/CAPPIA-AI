/*
 * ============================================================
 * APPIA AI
 * PARSER NGK - VELAS E CABOS DE IGNIÇÃO
 * ============================================================
 *
 * Catálogo NGK
 *
 * Faixa:
 * páginas 28 até 114
 *
 * Saídas:
 * - Vela de ignição
 * - Cabo de ignição
 *
 * Estratégia:
 * leitura sequencial da tabela.
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
      /[ \t]+/g,
      " "
    )
    .replace(
      /\s+/g,
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
 * MONTADORAS
 * ============================================================
 */

const MONTADORAS = [
  "ALFA ROMEO",
  "ASIA MOTORS",
  "AUDI",
  "BMW",
  "BRM",
  "BUGRE",
  "CHANA",
  "CHERY",
  "CHRYSLER",
  "CITROEN",
  "CITROËN",
  "DAEWOO",
  "DAIHATSU",
  "DODGE",
  "EFFA",
  "ENGESA",
  "ENVEMO",
  "FERRARI",
  "FIAT",
  "FIBRAVAN",
  "FORD",
  "GM",
  "GMC",
  "CHEVROLET",
  "GURGEL",
  "HAFEI",
  "HONDA",
  "HYUNDAI",
  "ISUZU",
  "JAC",
  "JAGUAR",
  "JEEP",
  "JINBEI",
  "KIA",
  "KIA MOTORS",
  "LADA",
  "LAND ROVER",
  "LEXUS",
  "LIFAN",
  "LOBINI",
  "MASERATI",
  "MAZDA",
  "MERCEDES BENZ",
  "MERCEDES-BENZ",
  "MINI",
  "MITSUBISHI",
  "NISSAN",
  "PEUGEOT",
  "PORSCHE",
  "RENAULT",
  "SEAT",
  "SIMCA",
  "SMART",
  "SSANGYONG",
  "SUBARU",
  "SUZUKI",
  "TOYOTA",
  "TROLLER",
  "VOLVO",
  "VW",
  "VOLKSWAGEN",
  "WALK",
];

function normalizarMontadora(
  valor = ""
) {
  const texto =
    limparTexto(
      valor
    ).toUpperCase();

  if (
    texto === "VW" ||
    texto === "VOLKSWAGEN"
  ) {
    return "Volkswagen";
  }

  if (
    texto === "GM" ||
    texto === "CHEVROLET"
  ) {
    return "Chevrolet";
  }

  if (
    texto === "CITROEN" ||
    texto === "CITROËN"
  ) {
    return "Citroën";
  }

  if (
    texto ===
      "MERCEDES BENZ" ||
    texto ===
      "MERCEDES-BENZ"
  ) {
    return "Mercedes-Benz";
  }

  if (
    texto === "KIA" ||
    texto === "KIA MOTORS"
  ) {
    return "Kia";
  }

  return texto
    .toLowerCase()
    .replace(
      /(^|\s)\S/g,
      (letra) =>
        letra.toUpperCase()
    );
}

function limparLinhaMontadora(
  linha = ""
) {
  return limparTexto(
    linha
  )
    .replace(
      /\s*[-–—]\s*continua(?:cao|ção)?\.?$/i,
      ""
    )
    .replace(
      /\s+continua(?:cao|ção)?\.?$/i,
      ""
    )
    .trim();
}

function identificarMontadora(
  linha = ""
) {
  const texto =
    limparLinhaMontadora(
      linha
    ).toUpperCase();

  const encontrada =
    MONTADORAS.find(
      (montadora) =>
        texto ===
        montadora.toUpperCase()
    );

  return encontrada
    ? normalizarMontadora(
        encontrada
      )
    : "";
}

/*
 * ============================================================
 * COMBUSTÍVEL
 * ============================================================
 */

const COMBUSTIVEIS = {
  G:
    "Gasolina / GNV",

  E:
    "Etanol / GNV",

  B:
    "Bicombustível / GNV",

  T:
    "Tetrafuel",
};

function ehLinhaSomenteCombustivel(
  linha = ""
) {
  return /^[GEBT]$/i.test(
    limparTexto(
      linha
    )
  );
}

function normalizarCombustivel(
  valor = ""
) {
  const chave =
    limparTexto(
      valor
    ).toUpperCase();

  return (
    COMBUSTIVEIS[
      chave
    ] || ""
  );
}

/*
 * ============================================================
 * ANOS
 * ============================================================
 */

function extrairAnos(
  texto = ""
) {
  const linha =
    limparTexto(
      texto
    );

  const anos =
    linha.match(
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

  const primeiro =
    Number(
      anos[0]
    );

  if (
    /\bdesde\b/i.test(
      linha
    )
  ) {
    return {
      ano_inicio:
        primeiro,

      ano_fim:
        null,
    };
  }

  if (
    /\bate\b/i.test(
      normalizar(
        linha
      )
    )
  ) {
    return {
      ano_inicio:
        null,

      ano_fim:
        primeiro,
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
      primeiro,

    ano_fim:
      primeiro,
  };
}

/*
 * ============================================================
 * MODELO / MOTOR
 * ============================================================
 */

function encontrarInicioMotor(
  texto = ""
) {
  const linha =
    limparTexto(
      texto
    );

  const match =
    linha.match(
      /\b\d+[.,]\d+\b/
    );

  if (
    !match
  ) {
    return -1;
  }

  return (
    match.index ??
    -1
  );
}

function limparModelo(
  valor = ""
) {
  return limparTexto(
    valor
  )
    .replace(
      /^[|;/,.-]+\s*/g,
      ""
    )
    .replace(
      /\s*[|;/,.-]+$/g,
      ""
    )
    .trim();
}
/*
 * ============================================================
 * CABOS DE IGNIÇÃO
 * ============================================================
 */

function extrairCodigosCabos(
  texto = ""
) {
  const encontrados =
    String(
      texto || ""
    )
      .toUpperCase()
      .match(
        /\bST-[A-Z0-9]{2,8}\b/g
      ) || [];

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
 * CÓDIGOS DE VELA
 * ============================================================
 */

const TERMOS_NAO_VELA =
  new Set([
    "EA111",
    "EA211",
    "TSI",
    "TFSI",
    "FSI",
    "MPI",
    "VVT",
    "VVT-I",
    "VTEC",
    "I-VTEC",
    "DOHC",
    "SOHC",
    "FLEX",
    "TOTALFLEX",
    "TETRAFUEL",
    "GNV",
    "CVVT",
    "GDI",
    "RSH",
    "VHT",
    "TEC",
    "MSI",
    "CCNA",
    "CSEA",
    "CWLA",
    "CYTA",
    "CNXA",
    "CNXC",
    "DHSB",
    "CCRA",
    "CCR",
    "CCPA",
    "CFEA",
    "CAVG",
    "CTHG",
    "CXSA",
    "CJSA",
    "CJSB",
    "CDNC",
    "CAEB",
    "CDLC",
    "CHHB",
    "CAWB",
    "CXDA",
    "BHK",
    "BAR",
    "BMV",
    "TRANSF",
    "TRANSFORMADOR",
    "BOBINA",
    "PINOS",
    "PINO",
    "CABRIOLET",
    "AVANT",
    "TURBO",
    "SUPER",
    "SPORT",
    "GREEN",
    "IRIDIUM",
    "POWER",
  ]);

function pareceCodigoMotor(
  codigo = ""
) {
  const texto =
    normalizarCodigo(
      codigo
    );

  if (
    TERMOS_NAO_VELA.has(
      texto
    )
  ) {
    return true;
  }

  if (
    /^[A-Z]{3,6}$/.test(
      texto
    )
  ) {
    return true;
  }

  if (
    /^EA\d{3}$/i.test(
      texto
    )
  ) {
    return true;
  }

  return false;
}

function ehCodigoVelaNgk(
  codigo = ""
) {
  const texto =
    normalizarCodigo(
      codigo
    );

  if (!texto) {
    return false;
  }

  if (
    pareceCodigoMotor(
      texto
    )
  ) {
    return false;
  }

  if (
    /^ST-/.test(
      texto
    )
  ) {
    return false;
  }

  if (
    /^(G|E|B|T)$/.test(
      texto
    )
  ) {
    return false;
  }

  const prefixosNgk =
    /^(?:B|BP|BPR|BKR|BKUR|BUR|BCPR|ZFR|PFR|PZFR|PZKER|PLFER|KER|IKER|ILFR|ILZKR|IZKR|IFR|PMR|SIZFR)[A-Z0-9-]*\d[A-Z0-9-]*$/i;

  if (
    prefixosNgk.test(
      texto
    )
  ) {
    return true;
  }

  if (
    /^[A-Z]{1,6}\d[A-Z0-9-]{1,10}$/i.test(
      texto
    ) &&
    texto.length >= 4 &&
    texto.length <= 18
  ) {
    return !pareceCodigoMotor(
      texto
    );
  }

  return false;
}

function extrairCodigosVelas(
  texto = ""
) {
  const bruto =
    String(
      texto || ""
    )
      .toUpperCase()
      .replace(
        /\bST-[A-Z0-9]{2,8}\b/g,
        " "
      );

  const candidatos =
    bruto.match(
      /\b[A-Z][A-Z0-9-]{2,17}\b/g
    ) || [];

  return [
    ...new Set(
      candidatos
        .filter(
          ehCodigoVelaNgk
        )
        .map(
          normalizarCodigo
        )
    ),
  ];
}

/*
 * ============================================================
 * FOLGA DA VELA
 * ============================================================
 */

function ehMedidaFolga(
  valor = ""
) {
  return /^\d[,\.]\d(?:\s*\/\s*\d[,\.]\d)?$/i.test(
    limparTexto(
      valor
    )
  );
}

function removerMedidasFolga(
  texto = ""
) {
  let valor =
    limparTexto(
      texto
    );

  /*
   * ========================================================
   * IMPORTANTE
   * ========================================================
   *
   * NÃO remover:
   *
   * 1.0
   * 1.6
   * 2.0
   * 2.8
   *
   * porque são cilindradas.
   *
   * A folga NGK normalmente está no FINAL:
   *
   * KER7A-8DEG 0,8
   * BKR7EIX 0,9
   * BUR5ETB-10 1,0
   * ========================================================
   */

  valor =
    valor.replace(
      /\s+\d[,\.]\d(?:\s*\/\s*\d[,\.]\d)?\s*$/i,
      ""
    );

  return limparTexto(
    valor
  );
}
function encontrarInicioPeriodo(
  texto = ""
) {
  const linha =
    limparTexto(
      texto
    );

  const match =
    linha.match(
      /\b(?:desde\s+|at[eé]\s+)?(?:\d{2}\/)?(?:19|20)\d{2}\b/i
    );

  return match
    ? match.index ?? -1
    : -1;
}

function extrairPeriodoTexto(
  texto = ""
) {
  const linha =
    limparTexto(
      texto
    );

  const match =
    linha.match(
      /\b(?:desde\s+|at[eé]\s+)?(?:\d{2}\/)?(?:19|20)\d{2}(?:\s+a\s+(?:\d{2}\/)?(?:19|20)\d{2})?/i
    );

  return match?.[0] || "";
}

/*
 * ============================================================
 * RUÍDO DA TABELA
 * ============================================================
 */

function ehRuidoDeTabela(
  linha = ""
) {
  const texto =
    normalizar(
      linha
    );

  if (!texto) {
    return true;
  }

  if (
    ehLinhaSomenteCombustivel(
      linha
    )
  ) {
    return true;
  }

  if (
    ehMedidaFolga(
      linha
    )
  ) {
    return true;
  }

  if (
    /^\d{1,3}$/.test(
      texto
    )
  ) {
    return true;
  }

  if (
    /^---\s*(?:pagina|página|page)/i.test(
      texto
    )
  ) {
    return true;
  }

  const termos = [
    "velas e cabos de ignicao",
    "velas de ignicao",
    "cabos de ignicao",
    "aplicacao original",
    "ngk green",
    "g-power",
    "iridium",
    "motor / versao",
    "motor/versao",
    "combustivel",
    "veiculo",
    "ano",
    "as aplicacoes podem sofrer",
    "ngkntk.com",
  ];

  return termos.some(
    (termo) =>
      texto.includes(
        termo
      )
  );
}
/*
 * ============================================================
 * MOTOR
 * ============================================================
 */

function limparMotor(
  valor = ""
) {
  let texto =
    limparTexto(
      valor
    );

  texto =
    texto.replace(
      /\s+[GEBT]\s*$/i,
      ""
    );

  const inicioPeriodo =
    encontrarInicioPeriodo(
      texto
    );

  if (
    inicioPeriodo >= 0
  ) {
    texto =
      texto.slice(
        0,
        inicioPeriodo
      );
  }

  const cabos =
    extrairCodigosCabos(
      texto
    );

  for (
    const codigo
    of cabos
  ) {
    texto =
      texto.replace(
        new RegExp(
          codigo.replace(
            /[-/\\^$*+?.()|[\]{}]/g,
            "\\$&"
          ),
          "gi"
        ),
        " "
      );
  }

  const velas =
    extrairCodigosVelas(
      texto
    );

  for (
    const codigo
    of velas
  ) {
    texto =
      texto.replace(
        new RegExp(
          codigo.replace(
            /[-/\\^$*+?.()|[\]{}]/g,
            "\\$&"
          ),
          "gi"
        ),
        " "
      );
  }

  texto =
    removerMedidasFolga(
      texto
    );

  return limparTexto(
    texto
  );
}

/*
 * ============================================================
 * MODELO ISOLADO
 * ============================================================
 */

function pareceModeloIsolado(
  linha = ""
) {
  const texto =
    limparTexto(
      linha
    );

  if (
    ehRuidoDeTabela(
      texto
    )
  ) {
    return false;
  }

  if (
    identificarMontadora(
      texto
    )
  ) {
    return false;
  }

  if (
    extrairCodigosCabos(
      texto
    ).length
  ) {
    return false;
  }

  if (
    extrairCodigosVelas(
      texto
    ).length
  ) {
    return false;
  }

  if (
    encontrarInicioPeriodo(
      texto
    ) >= 0
  ) {
    return false;
  }

  if (
    encontrarInicioMotor(
      texto
    ) === 0
  ) {
    return false;
  }

  return (
    texto.length >= 1 &&
    texto.length <= 50 &&
    /^[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 /.-]*$/.test(
      texto
    )
  );
}

/*
 * ============================================================
 * SEPARAR MODELO / MOTOR
 * ============================================================
 */

function separarModeloMotor({
  linha = "",
  modeloAnterior = "",
  motorAnterior = "",
} = {}) {
  const texto =
    limparTexto(linha);

  if (!texto) {
    return {
      modelo: modeloAnterior,
      motor: motorAnterior,
      modeloExplicito: false,
    };
  }

  /*
   * ========================================================
   * LOCALIZA ONDE COMEÇA O MOTOR
   *
   * Exemplos:
   *
   * Cross Fox 1.6 8v / Totalflex ...
   *           ↑
   *
   * Polo 1.0 12v / EA211 ...
   *      ↑
   *
   * Fox 1.0 8v (RSH)
   *     ↑
   * ========================================================
   */

  const matchMotor =
    texto.match(
      /\b\d+(?:[.,]\d+)?\s*(?:8v|12v|16v|20v|24v|32v|v6|v8|v10|v12)\b/i
    );

  if (matchMotor) {
    const inicio =
      matchMotor.index ?? 0;

    /*
     * Existe texto antes do motor:
     * ele é o MODELO.
     */

    if (inicio > 0) {
      const parteModelo =
        limparTexto(
          texto.slice(
            0,
            inicio
          )
        );

      const parteMotor =
        limparMotor(
          texto.slice(
            inicio
          )
        );

      const modelo =
        limparModelo(
          parteModelo
        );

      return {
        modelo:
          modelo ||
          modeloAnterior,

        motor:
          parteMotor ||
          motorAnterior,

        modeloExplicito:
          Boolean(modelo),
      };
    }

    /*
     * Linha começa diretamente pelo motor.
     *
     * Exemplo:
     * 1.6 16v / EA211 MSI...
     *
     * Portanto herda o modelo anterior.
     */

    return {
      modelo:
        modeloAnterior,

      motor:
        limparMotor(
          texto
        ) ||
        motorAnterior,

      modeloExplicito:
        false,
    };
  }

  /*
   * ========================================================
   * SEGUNDA TENTATIVA
   *
   * Alguns motores aparecem somente como:
   *
   * 1.0
   * 1.6
   * 2.0
   * 2.8
   *
   * Só consideramos quando existe texto antes,
   * evitando transformar a folga 0,8 em motor.
   * ========================================================
   */

  const matchCilindrada =
    texto.match(
      /\b[1-9]\d?(?:[.,]\d+)\b/
    );

  if (
    matchCilindrada &&
    (matchCilindrada.index ?? 0) > 0
  ) {
    const inicio =
      matchCilindrada.index;

    const parteModelo =
      limparTexto(
        texto.slice(
          0,
          inicio
        )
      );

    const parteMotor =
      limparMotor(
        texto.slice(
          inicio
        )
      );

    const modelo =
      limparModelo(
        parteModelo
      );

    if (
      modelo &&
      parteMotor
    ) {
      return {
        modelo,
        motor: parteMotor,
        modeloExplicito: true,
      };
    }
  }

  /*
   * Nenhum motor identificado.
   * Mantém o contexto anterior.
   */

  return {
    modelo:
      modeloAnterior,

    motor:
      motorAnterior,

    modeloExplicito:
      false,
  };
}

function extrairSiglaCombustivel(
  texto = ""
) {
  const linha =
    limparTexto(
      texto
    );

  const match =
    linha.match(
      /(?:^|\s)(G|E|B|T)(?=\s|$)/i
    );

  return match
    ? match[1].toUpperCase()
    : "";
}

/*
 * ============================================================
 * LIMPAR COLUNAS TÉCNICAS DA APLICAÇÃO
 * ============================================================
 */

function limparLinhaAplicacao(
  linha = ""
) {
  let texto =
    limparTexto(
      linha
    );

  const cabos =
    extrairCodigosCabos(
      texto
    );

  for (
    const codigo
    of cabos
  ) {
    texto =
      texto.replace(
        new RegExp(
          codigo.replace(
            /[-/\\^$*+?.()|[\]{}]/g,
            "\\$&"
          ),
          "gi"
        ),
        " "
      );
  }

  const velas =
    extrairCodigosVelas(
      texto
    );

  for (
    const codigo
    of velas
  ) {
    texto =
      texto.replace(
        new RegExp(
          codigo.replace(
            /[-/\\^$*+?.()|[\]{}]/g,
            "\\$&"
          ),
          "gi"
        ),
        " "
      );
  }

  const periodo =
    extrairPeriodoTexto(
      texto
    );

  if (
    periodo
  ) {
    texto =
      texto.replace(
        periodo,
        " "
      );
  }

  texto =
    texto.replace(
      /(?:^|\s)(G|E|B|T)(?=\s|$)/gi,
      " "
    );

  texto =
    removerMedidasFolga(
      texto
    );

  return limparTexto(
    texto
  );
}

/*
 * ============================================================
 * INTERPRETAR LINHA DA TABELA
 * ============================================================
 */

function interpretarLinhaAplicacao({
  linha = "",
  montadora = "",
  modeloAnterior = "",
  motorAnterior = "",
  combustivelAnterior = "",
} = {}) {
  if (
    !linha ||
    !montadora
  ) {
    return null;
  }

  if (
    ehRuidoDeTabela(
      linha
    )
  ) {
    return null;
  }

  const codigosCabos =
    extrairCodigosCabos(
      linha
    );

  const codigosVelas =
    extrairCodigosVelas(
      linha
    );

  const siglaCombustivel =
    extrairSiglaCombustivel(
      linha
    );

  const combustivel =
    siglaCombustivel
      ? normalizarCombustivel(
          siglaCombustivel
        )
      : combustivelAnterior;

  const periodo =
    extrairPeriodoTexto(
      linha
    );

  const {
    ano_inicio,
    ano_fim,
  } = extrairAnos(
    periodo ||
    linha
  );

  const parteAplicacao =
    limparLinhaAplicacao(
      linha
    );

  const {
    modelo,
    motor,
    modeloExplicito,
  } = separarModeloMotor({
    linha:
      parteAplicacao,

    modeloAnterior,

    motorAnterior,
  });

  return {
    montadora,

    modelo,

    motor,

    modeloExplicito,

    combustivel,

    periodo,

    ano_inicio,

    ano_fim,

    codigosVelas,

    codigosCabos,

    linhaOriginal:
      linha,
  };
}
/*
 * ============================================================
 * CONTEXTO PENDENTE
 * ============================================================
 */

function criarContextoPendente() {
  return {
    combustivel:
      "",

    periodo:
      "",

    ano_inicio:
      null,

    ano_fim:
      null,

    velas:
      [],

    cabos:
      [],
  };
}

function limparContextoPendente(
  contexto
) {
  contexto.combustivel =
    "";

  contexto.periodo =
    "";

  contexto.ano_inicio =
    null;

  contexto.ano_fim =
    null;

  contexto.velas =
    [];

  contexto.cabos =
    [];
}

function atualizarContextoPendente({
  contexto,
  linha,
}) {
  if (
    !contexto ||
    !linha
  ) {
    return;
  }

  if (
    ehLinhaSomenteCombustivel(
      linha
    )
  ) {
    contexto.combustivel =
      normalizarCombustivel(
        linha
      );

    return;
  }

  const periodo =
    extrairPeriodoTexto(
      linha
    );

  if (
    periodo
  ) {
    contexto.periodo =
      periodo;

    const anos =
      extrairAnos(
        periodo
      );

    contexto.ano_inicio =
      anos.ano_inicio;

    contexto.ano_fim =
      anos.ano_fim;
  }

  const velas =
    extrairCodigosVelas(
      linha
    );

  if (
    velas.length
  ) {
    contexto.velas = [
      ...new Set([
        ...contexto.velas,
        ...velas,
      ]),
    ];
  }

  const cabos =
    extrairCodigosCabos(
      linha
    );

  if (
    cabos.length
  ) {
    contexto.cabos = [
      ...new Set([
        ...contexto.cabos,
        ...cabos,
      ]),
    ];
  }
}

function aplicarContextoPendente({
  dados,
  contexto,
}) {
  if (
    !dados ||
    !contexto
  ) {
    return dados;
  }

  if (
    !dados.combustivel &&
    contexto.combustivel
  ) {
    dados.combustivel =
      contexto.combustivel;
  }

  if (
    !dados.periodo &&
    contexto.periodo
  ) {
    dados.periodo =
      contexto.periodo;

    dados.ano_inicio =
      contexto.ano_inicio;

    dados.ano_fim =
      contexto.ano_fim;
  }

  dados.codigosVelas = [
    ...new Set([
      ...(contexto.velas || []),
      ...(dados.codigosVelas || []),
    ]),
  ];

  dados.codigosCabos = [
    ...new Set([
      ...(contexto.cabos || []),
      ...(dados.codigosCabos || []),
    ]),
  ];

  return dados;
}

/*
 * ============================================================
 * VALIDAÇÃO
 * ============================================================
 */

function modeloValido(
  modelo = ""
) {
  const texto =
    limparTexto(
      modelo
    );

  if (!texto) {
    return false;
  }

  if (
    /^(G|E|B|T)$/i.test(
      texto
    )
  ) {
    return false;
  }

  if (
    /^(G|E|B|T)(?:\s+\1)+$/i.test(
      texto
    )
  ) {
    return false;
  }

  if (
    ehMedidaFolga(
      texto
    )
  ) {
    return false;
  }

  if (
    extrairCodigosVelas(
      texto
    ).length
  ) {
    return false;
  }

  if (
    extrairCodigosCabos(
      texto
    ).length
  ) {
    return false;
  }

  return true;
}

function motorValido(
  motor = ""
) {
  const texto =
    limparTexto(
      motor
    );

  if (!texto) {
    return false;
  }

  if (
    ehMedidaFolga(
      texto
    )
  ) {
    return false;
  }

  if (
    /^(G|E|B|T)$/i.test(
      texto
    )
  ) {
    return false;
  }

  return true;
}

function sanearDados(
  dados = {}
) {
  const resultado = {
    ...dados,
  };

  if (
    !modeloValido(
      resultado.modelo
    )
  ) {
    resultado.modelo =
      "";
  }

  if (
    !motorValido(
      resultado.motor
    )
  ) {
    resultado.motor =
      "";
  }

  resultado.codigosVelas =
    (
      resultado.codigosVelas ||
      []
    ).filter(
      (codigo) =>
        ehCodigoVelaNgk(
          codigo
        ) &&
        !pareceCodigoMotor(
          codigo
        )
    );

  resultado.codigosCabos =
    [
      ...new Set(
        (
          resultado.codigosCabos ||
          []
        )
          .map(
            normalizarCodigo
          )
          .filter(Boolean)
      ),
    ];

  return resultado;
}

/*
 * ============================================================
 * REGISTRO DE VELA
 * ============================================================
 */

function criarRegistroVela({
  codigo,
  equivalentes = [],
  dados,
  nomeArquivo = "",
  configuracao = {},
}) {
  return {
    peca:
      "Vela de ignição",

    descricao:
      "Vela de ignição NGK",

    codigo_oem:
      normalizarCodigo(
        codigo
      ),

    codigo_equivalente:
      equivalentes[0] ||
      "",

    equivalentes:
      equivalentes.map(
        (item) => ({
          codigo:
            normalizarCodigo(
              item
            ),

          fabricante:
            "NGK",
        })
      ),

    fabricante:
      "NGK",

    montadora:
      dados.montadora ||
      null,

    modelo:
      limparModelo(
        dados.modelo
      ) ||
      null,

    motor:
      limparTexto(
        dados.motor
      ) ||
      null,

    ano_inicio:
      dados.ano_inicio ??
      null,

    ano_fim:
      dados.ano_fim ??
      null,

    aplicacao:
      [
        dados.montadora,
        dados.modelo,
        dados.motor,
        dados.periodo,
      ]
        .filter(Boolean)
        .join(" | "),

    observacao:
      [
        dados.combustivel
          ? `Combustível: ${dados.combustivel}`
          : "",

        dados.linhaOriginal
          ? `Aplicação catálogo: ${dados.linhaOriginal}`
          : "",
      ]
        .filter(Boolean)
        .join(" | "),

    origem_catalogo:
      configuracao
        ?.origemCatalogo ||
      "Catálogo NGK Velas e Cabos",

    arquivo_catalogo:
      nomeArquivo ||
      "Catalogo_NGK.pdf",

    tipo_catalogo:
      "velas_cabos",

    ativo:
      true,

    prioridade:
      1,

    confiabilidade:
      100,
  };
}

/*
 * ============================================================
 * REGISTRO DE CABO
 * ============================================================
 */

function criarRegistroCabo({
  codigo,
  dados,
  nomeArquivo = "",
  configuracao = {},
}) {
  return {
    peca:
      "Cabo de ignição",

    descricao:
      "Cabo de ignição NGK",

    codigo_oem:
      normalizarCodigo(
        codigo
      ),

    codigo_equivalente:
      "",

    equivalentes:
      [],

    fabricante:
      "NGK",

    montadora:
      dados.montadora ||
      null,

    modelo:
      limparModelo(
        dados.modelo
      ) ||
      null,

    motor:
      limparTexto(
        dados.motor
      ) ||
      null,

    ano_inicio:
      dados.ano_inicio ??
      null,

    ano_fim:
      dados.ano_fim ??
      null,

    aplicacao:
      [
        dados.montadora,
        dados.modelo,
        dados.motor,
        dados.periodo,
      ]
        .filter(Boolean)
        .join(" | "),

    observacao:
      [
        dados.combustivel
          ? `Combustível: ${dados.combustivel}`
          : "",

        dados.linhaOriginal
          ? `Aplicação catálogo: ${dados.linhaOriginal}`
          : "",
      ]
        .filter(Boolean)
        .join(" | "),

    origem_catalogo:
      configuracao
        ?.origemCatalogo ||
      "Catálogo NGK Velas e Cabos",

    arquivo_catalogo:
      nomeArquivo ||
      "Catalogo_NGK.pdf",

    tipo_catalogo:
      "velas_cabos",

    ativo:
      true,

    prioridade:
      1,

    confiabilidade:
      100,
  };
}

/*
 * ============================================================
 * GERAR REGISTROS
 * ============================================================
 */

function gerarRegistrosAplicacao({
  dados,
  nomeArquivo = "",
  configuracao = {},
}) {
  const registros =
    [];

  const dadosLimpos =
    sanearDados(
      dados
    );

  const velas =
    [
      ...new Set(
        (
          dadosLimpos
            .codigosVelas ||
          []
        )
          .map(
            normalizarCodigo
          )
          .filter(
            (codigo) =>
              ehCodigoVelaNgk(
                codigo
              )
          )
      ),
    ];

  const cabos =
    [
      ...new Set(
        (
          dadosLimpos
            .codigosCabos ||
          []
        )
          .map(
            normalizarCodigo
          )
          .filter(Boolean)
      ),
    ];

  for (
    const codigo
    of velas
  ) {
    const equivalentes =
      velas.filter(
        (item) =>
          item !== codigo
      );

    registros.push(
      criarRegistroVela({
        codigo,

        equivalentes,

        dados:
          dadosLimpos,

        nomeArquivo,

        configuracao,
      })
    );
  }

  for (
    const codigo
    of cabos
  ) {
    registros.push(
      criarRegistroCabo({
        codigo,

        dados:
          dadosLimpos,

        nomeArquivo,

        configuracao,
      })
    );
  }

  return registros;
}

/*
 * ============================================================
 * REMOVER DUPLICADOS
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
    if (
      !registro.codigo_oem
    ) {
      continue;
    }

    const chave = [
      registro.peca,
      registro.codigo_oem,
      registro.montadora,
      registro.modelo,
      registro.motor,
      registro.ano_inicio,
      registro.ano_fim,
    ]
      .map(
        (item) =>
          normalizar(
            item ?? ""
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
 * DIAGNÓSTICO
 * ============================================================
 */

function diagnosticar(
  registros = []
) {
  const velas =
    registros.filter(
      (item) =>
        item.peca ===
        "Vela de ignição"
    );

  const cabos =
    registros.filter(
      (item) =>
        item.peca ===
        "Cabo de ignição"
    );

  const modelosSuspeitos =
    registros.filter(
      (item) =>
        item.modelo &&
        !modeloValido(
          item.modelo
        )
    );

  const motoresSuspeitos =
    registros.filter(
      (item) =>
        item.motor &&
        !motorValido(
          item.motor
        )
    );

  const eaComoVela =
    velas.filter(
      (item) =>
        /^EA\d{3}$/i.test(
          item.codigo_oem
        )
    );

  console.log(
    "========================================"
  );

  console.log(
    "🔥 NGK VELAS/CABOS - DIAGNÓSTICO"
  );

  console.log(
    "VELAS:",
    velas.length
  );

  console.log(
    "CABOS:",
    cabos.length
  );

  console.log(
    "MODELOS SUSPEITOS:",
    modelosSuspeitos.length
  );

  console.log(
    "MOTORES SUSPEITOS:",
    motoresSuspeitos.length
  );

  console.log(
    "EA111/EA211 COMO VELA:",
    eaComoVela.length
  );

  console.log(
    "========================================"
  );
}

/*
 * ============================================================
 * PARSER PRINCIPAL
 * ============================================================
 */

export async function parserNgkVelasCabos({
  textoReferencias = "",
  textoAplicacoes = "",
  textoEquivalencias = "",
  nomeArquivo = "",
  configuracao = {},
  onProgresso,
} = {}) {
  onProgresso?.(
    "🔥 NGK: lendo Velas e Cabos de Ignição..."
  );

  const textoCompleto = [
    textoReferencias,
    textoAplicacoes,
    textoEquivalencias,
  ]
    .filter(Boolean)
    .join("\n");

  if (
    !textoCompleto.trim()
  ) {
    console.warn(
      "⚠️ NGK Velas/Cabos recebeu texto vazio."
    );

    return [];
  }

  const linhas =
    transformarEmLinhas(
      textoCompleto
    );

  const registros = [];

  let montadoraAtual =
    "";

  let modeloAtual =
    "";

  let motorAtual =
    "";

  let combustivelAtual =
    "";

  const contextoPendente =
    criarContextoPendente();

  for (
    let indice = 0;
    indice < linhas.length;
    indice += 1
  ) {
    const linha =
      linhas[indice];

    if (!linha) {
      continue;
    }

    /*
     * ========================================================
     * MONTADORA
     * ========================================================
     */

    const montadoraLinha =
      identificarMontadora(
        linha
      );

    if (
      montadoraLinha
    ) {
      const mudou =
        normalizar(
          montadoraLinha
        ) !==
        normalizar(
          montadoraAtual
        );

      montadoraAtual =
        montadoraLinha;

      if (mudou) {
        modeloAtual =
          "";

        motorAtual =
          "";

        combustivelAtual =
          "";

        limparContextoPendente(
          contextoPendente
        );
      }

      continue;
    }

    if (
      !montadoraAtual
    ) {
      continue;
    }

    /*
     * ========================================================
     * COMBUSTÍVEL ISOLADO
     * ========================================================
     */

    if (
      ehLinhaSomenteCombustivel(
        linha
      )
    ) {
      combustivelAtual =
        normalizarCombustivel(
          linha
        );

      contextoPendente.combustivel =
        combustivelAtual;

      continue;
    }

    /*
     * ========================================================
     * RUÍDO
     * ========================================================
     */

    if (
      ehRuidoDeTabela(
        linha
      )
    ) {
      continue;
    }

    /*
     * ========================================================
     * MODELO ISOLADO
     * ========================================================
     */

    if (
      pareceModeloIsolado(
        linha
      )
    ) {
      modeloAtual =
        limparModelo(
          linha
        );

      continue;
    }

    /*
     * ========================================================
     * LINHA TÉCNICA QUEBRADA
     * ========================================================
     */

    const inicioMotor =
      encontrarInicioMotor(
        linha
      );

    const possuiPeriodo =
      encontrarInicioPeriodo(
        linha
      ) >= 0;

    const velasLinha =
      extrairCodigosVelas(
        linha
      );

    const cabosLinha =
      extrairCodigosCabos(
        linha
      );

    const linhaTecnica =
      inicioMotor < 0 &&
      (
        possuiPeriodo ||
        velasLinha.length > 0 ||
        cabosLinha.length > 0
      );

    if (
      linhaTecnica
    ) {
      atualizarContextoPendente({
        contexto:
          contextoPendente,

        linha,
      });

      continue;
    }

    /*
     * ========================================================
     * INTERPRETAR APLICAÇÃO
     * ========================================================
     */

    let dados =
      interpretarLinhaAplicacao({
        linha,

        montadora:
          montadoraAtual,

        modeloAnterior:
          modeloAtual,

        motorAnterior:
          motorAtual,

        combustivelAnterior:
          combustivelAtual,
      });

    if (
      !dados
    ) {
      atualizarContextoPendente({
        contexto:
          contextoPendente,

        linha,
      });

      continue;
    }

    dados =
      aplicarContextoPendente({
        dados,

        contexto:
          contextoPendente,
      });

    /*
     * ========================================================
     * MODELO
     * ========================================================
     */

    if (
      dados.modeloExplicito &&
      modeloValido(
        dados.modelo
      )
    ) {
      modeloAtual =
        limparModelo(
          dados.modelo
        );
    }

    if (
      !dados.modelo &&
      modeloAtual
    ) {
      dados.modelo =
        modeloAtual;
    }

    /*
     * ========================================================
     * MOTOR
     * ========================================================
     */

    if (
      dados.motor &&
      motorValido(
        dados.motor
      )
    ) {
      motorAtual =
        limparTexto(
          dados.motor
        );
    }

    if (
      !dados.motor &&
      motorAtual
    ) {
      dados.motor =
        motorAtual;
    }

    /*
     * ========================================================
     * COMBUSTÍVEL
     * ========================================================
     */

    if (
      dados.combustivel
    ) {
      combustivelAtual =
        dados.combustivel;
    }

    if (
      !dados.combustivel &&
      combustivelAtual
    ) {
      dados.combustivel =
        combustivelAtual;
    }

    dados =
      sanearDados(
        dados
      );

    /*
     * ========================================================
     * GERAR REGISTROS
     * ========================================================
     */
/*
 * ========================================================
 * DIAGNÓSTICO TEMPORÁRIO NGK VELAS/CABOS
 * ========================================================
 */

if (
  dados.codigosVelas?.includes(
    "KER7A-8DEG"
  ) ||
  dados.codigosCabos?.includes(
    "ST-V25"
  )
) {
  console.log(
    "🚨 DIAGNÓSTICO NGK VELAS/CABOS"
  );

  console.log(
    "LINHA:",
    linha
  );

  console.log(
    "MONTADORA:",
    dados.montadora
  );

  console.log(
    "MODELO:",
    dados.modelo
  );

  console.log(
    "MOTOR:",
    dados.motor
  );

  console.log(
    "PERÍODO:",
    dados.periodo
  );

  console.log(
    "VELAS:",
    dados.codigosVelas
  );

  console.log(
    "CABOS:",
    dados.codigosCabos
  );

  console.log(
    "----------------------------------------"
  );
}
    const registrosLinha =
      gerarRegistrosAplicacao({
        dados,

        nomeArquivo,

        configuracao,
      });

    if (
      registrosLinha.length
    ) {
      registros.push(
        ...registrosLinha
      );

      limparContextoPendente(
        contextoPendente
      );
    } else {
      atualizarContextoPendente({
        contexto:
          contextoPendente,

        linha,
      });
    }

    if (
      indice > 0 &&
      indice % 300 === 0
    ) {
      onProgresso?.(
        `⚡ NGK Velas/Cabos: ${indice}/${linhas.length} linhas analisadas...`
      );
    }
  }

  const unicos =
    removerDuplicados(
      registros
    );

  diagnosticar(
    unicos
  );

  const totalVelas =
    unicos.filter(
      (item) =>
        item.peca ===
        "Vela de ignição"
    ).length;

  const totalCabos =
    unicos.filter(
      (item) =>
        item.peca ===
        "Cabo de ignição"
    ).length;

  console.log(
    "========================================"
  );

  console.log(
    "🔥 PARSER NGK VELAS E CABOS"
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
    "Velas:",
    totalVelas
  );

  console.log(
    "Cabos:",
    totalCabos
  );

  console.log(
    "Total:",
    unicos.length
  );

  console.log(
    "========================================"
  );

  onProgresso?.(
    `✅ NGK Velas/Cabos: ${unicos.length} registro(s) encontrado(s).`
  );

  return unicos;
}

export default parserNgkVelasCabos;