/*
 * ============================================================
 * APPIA AI
 * PARSER NGK - BOBINAS DE IGNIÇÃO
 * ============================================================
 *
 * Compatível com:
 *
 * - Tabela de Aplicação NGK
 * - Catálogo NGK Bobinas
 * - Bobinas 2018 / Lançamentos
 *
 * REGRA PRINCIPAL:
 *
 * O contexto de modelo é SEMPRE SEQUENCIAL.
 *
 * Exemplo:
 *
 * VW
 *
 * Voyage 1.0 ... U5330
 * 1.6 ... U5330
 *
 * Gol 1.0 ... U5330
 * 1.6 ... U5330
 *
 * A linha sem modelo herda SOMENTE o último
 * modelo explícito encontrado dentro do fluxo.
 *
 * Nunca procuramos modelos retroativamente.
 * ============================================================
 */

function limparTexto(valor = "") {
  return String(valor || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+\n/g, "\n")
    .trim();
}

function normalizar(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarCodigo(valor = "") {
  return String(valor || "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .trim();
}

function transformarEmLinhas(texto = "") {
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
];

function normalizarMontadora(valor = "") {
  const texto =
    limparTexto(valor).toUpperCase();

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
    texto === "MERCEDES BENZ" ||
    texto === "MERCEDES-BENZ"
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
  return limparTexto(linha)
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
 * CÓDIGO NGK
 * ============================================================
 */

function extrairCodigoNgk(
  linha = ""
) {
  const match =
    String(linha || "")
      .toUpperCase()
      .match(
        /\bU\d{4}\b/
      );

  return match?.[0] || "";
}

function ehLinhaSomenteCodigoNgk(
  linha = ""
) {
  return /^U\d{4}$/i.test(
    limparTexto(linha)
  );
}
/*
 * ============================================================
 * COMBUSTÍVEL
 * ============================================================
 */

const COMBUSTIVEIS_SIGLAS = {
  G: "Gasolina / GNV",
  E: "Etanol / GNV",
  B: "Bicombustível / GNV",
  T: "Tetrafuel",
};

function normalizarCombustivel(
  valor = ""
) {
  const texto =
    limparTexto(valor);

  if (!texto) {
    return "";
  }

  const sigla =
    texto.toUpperCase();

  if (
    COMBUSTIVEIS_SIGLAS[
      sigla
    ]
  ) {
    return COMBUSTIVEIS_SIGLAS[
      sigla
    ];
  }

  return texto;
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
    limparTexto(texto);

  const anos =
    linha.match(
      /\b(?:19|20)\d{2}\b/g
    ) || [];

  if (!anos.length) {
    return {
      ano_inicio: null,
      ano_fim: null,
    };
  }

  const primeiro =
    Number(
      anos[0]
    );

  let ultimo =
    anos.length > 1
      ? Number(
          anos[
            anos.length - 1
          ]
        )
      : null;

  if (
    /\bdesde\b/i.test(
      linha
    )
  ) {
    ultimo = null;
  }

  if (
    /\bate\b/i.test(
      normalizar(linha)
    )
  ) {
    return {
      ano_inicio: null,
      ano_fim:
        primeiro,
    };
  }

  return {
    ano_inicio:
      primeiro,

    ano_fim:
      ultimo,
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
    limparTexto(texto);

  const match =
    linha.match(
      /\b\d+\.\d+\b/
    );

  if (!match) {
    return -1;
  }

  return match.index ?? -1;
}

function limparModelo(
  valor = ""
) {
  return limparTexto(valor)
    .replace(
      /^[|;/,.-]+\s*/g,
      ""
    )
    .replace(
      /\s*[|;/,.-]+$/g,
      ""
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function separarModeloMotor(
  texto = "",
  modeloAnterior = "",
  motorAnterior = ""
) {
  const linha =
    limparTexto(texto);

  if (!linha) {
    return {
      modelo:
        modeloAnterior,

      motor:
        motorAnterior,

      modeloExplicito:
        false,

      motorExplicito:
        false,
    };
  }

  const inicioMotor =
    encontrarInicioMotor(
      linha
    );

  /*
   * Linha começa diretamente pelo motor.
   *
   * Exemplo:
   *
   * 1.6 16v / EA211 MSI
   *
   * Nesse caso continua utilizando
   * o modelo sequencial atual.
   */

  if (
    inicioMotor === 0
  ) {
    return {
      modelo:
        modeloAnterior,

      motor:
        linha,

      modeloExplicito:
        false,

      motorExplicito:
        true,
    };
  }

  if (
    inicioMotor < 0
  ) {
    return {
      modelo:
        modeloAnterior,

      motor:
        motorAnterior,

      modeloExplicito:
        false,

      motorExplicito:
        false,
    };
  }

  const modelo =
    limparModelo(
      linha.slice(
        0,
        inicioMotor
      )
    );

  const motor =
    limparTexto(
      linha.slice(
        inicioMotor
      )
    );

  return {
    modelo:
      modelo ||
      modeloAnterior,

    motor:
      motor ||
      motorAnterior,

    modeloExplicito:
      Boolean(
        modelo
      ),

    motorExplicito:
      Boolean(
        motor
      ),
  };
}

/*
 * ============================================================
 * OBSERVAÇÃO NGK
 * ============================================================
 */

function extrairObservacaoNgk(
  linha = ""
) {
  const observacoes =
    String(linha || "")
      .match(
        /\([^)]*\)/g
      ) || [];

  const relevantes =
    observacoes.filter(
      (item) => {
        const texto =
          normalizar(
            item
          );

        return (
          texto.includes(
            "suporte"
          ) ||
          texto.includes(
            "conector"
          ) ||
          texto.includes(
            "pino"
          )
        );
      }
    );

  return relevantes
    .map((item) =>
      item
        .replace(
          /^\(|\)$/g,
          ""
        )
        .trim()
    )
    .join(" | ");
}

/*
 * ============================================================
 * LINHAS INVÁLIDAS
 * ============================================================
 */

function ignorarLinha(
  linha = ""
) {
  const texto =
    normalizar(linha);

  if (!texto) {
    return true;
  }

  const termos = [
    "tabela de aplicacao",
    "bobinas de ignicao",
    "especialista em ignicao",
    "download do catalogo",
    "motor / versao",
    "motor/versao",
    "combustivel",
    "bobina de ignicao",
    "informacoes tecnicas",
    "aplicacoes podem sofrer",
    "saiba onde encontrar",
    "ngkntk.com",
    "www.ngk",
  ];

  if (
    termos.some(
      (termo) =>
        texto.includes(
          termo
        )
    )
  ) {
    return true;
  }

  if (
    texto ===
    "veiculo"
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

  return false;
}

/*
 * ============================================================
 * PERÍODO / COMBUSTÍVEL
 * ============================================================
 */

function separarCombustivelPeriodo(
  texto = ""
) {
  const linha =
    limparTexto(texto);

  const regex =
    /\s([GEBT])\s+(?=(?:desde\s+|at[eé]\s+)?(?:\d{2}\/)?(?:19|20)\d{2})/i;

  const match =
    linha.match(
      regex
    );

  if (!match) {
    return null;
  }

  const sigla =
    match[1]
      .toUpperCase();

  const inicio =
    match.index ?? -1;

  if (
    inicio < 0
  ) {
    return null;
  }

  const antes =
    limparTexto(
      linha.slice(
        0,
        inicio
      )
    );

  const depois =
    limparTexto(
      linha.slice(
        inicio +
        match[0].length
      )
    );

  return {
    antes,

    combustivel:
      normalizarCombustivel(
        sigla
      ),

    periodo:
      depois,
  };
}
/*
 * ============================================================
 * LAYOUT GRANDE
 * ============================================================
 */

function interpretarLinhaTabela({
  linha,
  montadora,
  modeloAnterior = "",
  motorAnterior = "",
}) {
  const codigoNgk =
    extrairCodigoNgk(
      linha
    );

  if (!codigoNgk) {
    return null;
  }

  let restante =
    linha.replace(
      new RegExp(
        `\\b${codigoNgk}\\b`,
        "i"
      ),
      " "
    );

  const observacao =
    extrairObservacaoNgk(
      restante
    );

  restante =
    restante.replace(
      /\((?:com|sem)\s+suporte\)/gi,
      " "
    );

  restante =
    limparTexto(
      restante
    );

  let separado =
  separarCombustivelPeriodo(
    restante
  );

/*
 * ============================================================
 * NGK — COMBUSTÍVEL EXTRAÍDO EM LINHA SEPARADA
 * ============================================================
 *
 * Alguns PDFs chegam assim:
 *
 * Cross Fox 1.6 ... Desde 2005 U2003
 * B
 *
 * Fox 1.0 ... Desde 2003 U2003
 * G
 *
 * Nesse caso não podemos descartar a aplicação.
 * Localizamos o início do período mesmo sem a sigla.
 * ============================================================
 */

if (!separado) {
  const matchPeriodo =
    restante.match(
      /\b(?:desde\s+|at[eé]\s+)?(?:\d{2}\/)?(?:19|20)\d{2}\b/i
    );

  if (matchPeriodo) {
    const indicePeriodo =
      matchPeriodo.index ?? -1;

    if (
      indicePeriodo > 0
    ) {
      separado = {
        antes:
          limparTexto(
            restante.slice(
              0,
              indicePeriodo
            )
          ),

        combustivel:
          "",

        periodo:
          limparTexto(
            restante.slice(
              indicePeriodo
            )
          ),
      };
    }
  }
}

if (!separado) {
  return null;
}

  const {
    modelo,
    motor,
    modeloExplicito,
    motorExplicito,
  } = separarModeloMotor(
    separado.antes,
    modeloAnterior,
    motorAnterior
  );

  const {
    ano_inicio,
    ano_fim,
  } = extrairAnos(
    separado.periodo
  );

  return {
    codigoNgk,

    montadora,

    modelo,

    motor,

    modeloExplicito,

    motorExplicito,

    combustivel:
      separado.combustivel,

    periodo:
      separado.periodo,

    ano_inicio,

    ano_fim,

    observacao,
  };
}

/*
 * ============================================================
 * LAYOUT LANÇAMENTOS
 * ============================================================
 */

function interpretarLinhaLancamento({
  linha,
  codigoAtual,
  montadora,
  modeloAnterior = "",
  motorAnterior = "",
}) {
  if (
    !codigoAtual ||
    !montadora
  ) {
    return null;
  }

  const combustiveis = [
    "Bicombustível / GNV",
    "Bicombustivel / GNV",
    "Gasolina / GNV",
    "Etanol / GNV",
    "Tetrafuel",
  ];

  let combustivel =
    "";

  let indice =
    -1;

  for (
    const candidato
    of combustiveis
  ) {
    const regex =
      new RegExp(
        candidato.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        ),
        "i"
      );

    const match =
      linha.match(
        regex
      );

    if (match) {
      indice =
        match.index ??
        -1;

      combustivel =
        match[0];

      break;
    }
  }

  if (
    indice < 0
  ) {
    return null;
  }

  const antes =
    limparTexto(
      linha.slice(
        0,
        indice
      )
    );

  const depois =
    limparTexto(
      linha.slice(
        indice +
        combustivel.length
      )
    );

  const {
    modelo,
    motor,
    modeloExplicito,
    motorExplicito,
  } = separarModeloMotor(
    antes,
    modeloAnterior,
    motorAnterior
  );

  if (!modelo) {
    return null;
  }

  const {
    ano_inicio,
    ano_fim,
  } = extrairAnos(
    depois
  );

  return {
    codigoNgk:
      codigoAtual,

    montadora,

    modelo,

    motor,

    modeloExplicito,

    motorExplicito,

    combustivel:
      normalizarCombustivel(
        combustivel
      ),

    periodo:
      depois,

    ano_inicio,

    ano_fim,

    observacao:
      "",
  };
}

/*
 * ============================================================
 * REGISTRO APPIA
 * ============================================================
 */

function criarRegistro({
  dados,
  nomeArquivo = "",
  configuracao = {},
}) {
  return {
    peca:
      "Bobina de ignição",

    descricao:
      "Bobina de ignição NGK",

    codigo_oem:
      normalizarCodigo(
        dados.codigoNgk
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

        dados.observacao
          ? dados.observacao
          : "",
      ]
        .filter(Boolean)
        .join(" | "),

    origem_catalogo:
      configuracao
        ?.origemCatalogo ||
      "Catálogo NGK Bobinas",

    arquivo_catalogo:
      nomeArquivo ||
      "Catalogo_NGK_Bobinas.pdf",

    tipo_catalogo:
      "bobinas",

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
    if (
      !registro.codigo_oem
    ) {
      continue;
    }

    const chave = [
      registro.codigo_oem,
      registro.montadora,
      registro.modelo,
      registro.motor,
      registro.ano_inicio,
      registro.ano_fim,
    ]
      .map((item) =>
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
 * PARSER PRINCIPAL
 * ============================================================
 */

export async function parserNgkBobinas({
  textoReferencias = "",
  textoAplicacoes = "",
  textoEquivalencias = "",
  nomeArquivo = "",
  configuracao = {},
  onProgresso,
} = {}) {
  onProgresso?.(
    "🧠 Lendo catálogo NGK de bobinas..."
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
      "⚠️ Parser NGK Bobinas recebeu texto vazio."
    );

    return [];
  }

  const linhas =
    transformarEmLinhas(
      textoCompleto
    );

  const registros = [];

  let montadoraAtual = "";
  let modeloAtual = "";
  let motorAtual = "";
  let codigoAtual = "";
  let modeloPendente = "";

  for (
    let indice = 0;
    indice < linhas.length;
    indice += 1
  ) {
    const linha =
      linhas[indice];

    if (
      ignorarLinha(
        linha
      )
    ) {
      continue;
    }

    /*
     * ========================================================
     * CÓDIGO ISOLADO
     * ========================================================
     */

    if (
      ehLinhaSomenteCodigoNgk(
        linha
      )
    ) {
      codigoAtual =
        normalizarCodigo(
          linha
        );

      /*
       * NÃO apagamos o contexto.
       */

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
      const mesmaMontadora =
        normalizar(
          montadoraLinha
        ) ===
        normalizar(
          montadoraAtual
        );

      const ehContinuacao =
        normalizar(
          linha
        ).includes(
          "continuacao"
        );

      /*
       * Mudou de montadora.
       *
       * Mata completamente o contexto
       * do bloco anterior.
       */

      if (
        !mesmaMontadora
      ) {
        modeloAtual = "";
        modeloPendente = "";
        motorAtual = "";
        codigoAtual = "";
      }

      /*
       * Mesmo fabricante,
       * cabeçalho normal.
       *
       * Começa novo bloco.
       */

      if (
        mesmaMontadora &&
        !ehContinuacao
      ) {
        modeloAtual = "";
        modeloPendente = "";
        motorAtual = "";
      }

      montadoraAtual =
        montadoraLinha;

      continue;
    }

    if (
      !montadoraAtual
    ) {
      continue;
    }

    /*
     * ========================================================
     * MODELO PENDENTE
     * ========================================================
     */

    const possuiCodigoNgk =
      Boolean(
        extrairCodigoNgk(
          linha
        )
      );

    const possuiAno =
      /\b(?:19|20)\d{2}\b/.test(
        linha
      );

    const comecaPorMotor =
      encontrarInicioMotor(
        linha
      ) === 0;

    const pareceModeloIsolado =
      !possuiCodigoNgk &&
      !possuiAno &&
      !comecaPorMotor &&
      /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 /.-]{1,45}$/.test(
        linha
      );

    if (
      pareceModeloIsolado
    ) {
      modeloPendente =
        limparModelo(
          linha
        );

      modeloAtual =
        modeloPendente;

      continue;
    }

    /*
     * ========================================================
     * LAYOUT GRANDE
     * ========================================================
     */

    const linhaTabela =
      interpretarLinhaTabela({
        linha,

        montadora:
          montadoraAtual,

        modeloAnterior:
          modeloAtual,

        motorAnterior:
          motorAtual,
      });

    if (
      linhaTabela
    ) {
      /*
       * Se por algum motivo o modelo
       * ainda vier vazio, usa o pendente.
       */
/*
 * ========================================================
 * DIAGNÓSTICO TEMPORÁRIO U5330 SEM MODELO
 * ========================================================
 */

if (
  linhaTabela.codigoNgk === "U5330" &&
  !linhaTabela.modelo
) {
  console.log(
    "🚨 U5330 SEM MODELO - DIAGNÓSTICO"
  );

  console.log(
    "ÍNDICE:",
    indice
  );

  console.log(
    "MONTADORA:",
    montadoraAtual
  );

  console.log(
    "MODELO ATUAL:",
    modeloAtual
  );

  console.log(
    "MODELO PENDENTE:",
    modeloPendente
  );

  console.log(
  "LINHA -10:",
  linhas[indice - 10] || ""
);

console.log(
  "LINHA -9:",
  linhas[indice - 9] || ""
);

console.log(
  "LINHA -8:",
  linhas[indice - 8] || ""
);

console.log(
  "LINHA -7:",
  linhas[indice - 7] || ""
);

console.log(
  "LINHA -6:",
  linhas[indice - 6] || ""
);

console.log(
  "LINHA -5:",
  linhas[indice - 5] || ""
);

console.log(
  "LINHA -4:",
  linhas[indice - 4] || ""
);

console.log(
  "LINHA -3:",
  linhas[indice - 3] || ""
);

console.log(
  "LINHA -2:",
  linhas[indice - 2] || ""
);

console.log(
  "LINHA -1:",
  linhas[indice - 1] || ""
);

console.log(
  "LINHA ATUAL:",
  linha
);

console.log(
  "LINHA +1:",
  linhas[indice + 1] || ""
);

console.log(
  "LINHA +2:",
  linhas[indice + 2] || ""
);

console.log(
  "LINHA +3:",
  linhas[indice + 3] || ""
);

  console.log(
    "----------------------------------------"
  );
}
      if (
        !linhaTabela.modelo &&
        modeloPendente
      ) {
        linhaTabela.modelo =
          modeloPendente;

        modeloAtual =
          modeloPendente;
      }

      /*
       * MODELO EXPLÍCITO
       */

      if (
        linhaTabela
          .modeloExplicito &&
        linhaTabela.modelo
      ) {
        modeloAtual =
          limparModelo(
            linhaTabela.modelo
          );

        modeloPendente =
          modeloAtual;

        linhaTabela.modelo =
          modeloAtual;
      }

      /*
       * LINHA DE CONTINUAÇÃO
       */

      if (
        !linhaTabela
          .modeloExplicito
      ) {
        linhaTabela.modelo =
          modeloAtual ||
          modeloPendente ||
          "";
      }

      /*
       * MOTOR
       */

      if (
        linhaTabela.motor
      ) {
        motorAtual =
          linhaTabela.motor;
      }

      registros.push(
        criarRegistro({
          dados:
            linhaTabela,

          nomeArquivo,

          configuracao,
        })
      );

      continue;
    }

    /*
     * ========================================================
     * CATÁLOGO LANÇAMENTOS
     * ========================================================
     */

    const linhaLancamento =
      interpretarLinhaLancamento({
        linha,

        codigoAtual,

        montadora:
          montadoraAtual,

        modeloAnterior:
          modeloAtual,

        motorAnterior:
          motorAtual,
      });

    if (
      linhaLancamento
    ) {
      if (
        linhaLancamento
          .modeloExplicito &&
        linhaLancamento.modelo
      ) {
        modeloAtual =
          limparModelo(
            linhaLancamento.modelo
          );

        modeloPendente =
          modeloAtual;

        linhaLancamento.modelo =
          modeloAtual;
      }

      if (
        !linhaLancamento
          .modeloExplicito
      ) {
        linhaLancamento.modelo =
          modeloAtual ||
          modeloPendente ||
          "";
      }

      if (
        linhaLancamento.motor
      ) {
        motorAtual =
          linhaLancamento.motor;
      }

      registros.push(
        criarRegistro({
          dados:
            linhaLancamento,

          nomeArquivo,

          configuracao,
        })
      );
    }

    if (
      indice > 0 &&
      indice % 100 === 0
    ) {
      onProgresso?.(
        `⚡ NGK Bobinas: ${indice}/${linhas.length} linhas analisadas...`
      );
    }
  }

  /*
   * ========================================================
   * DUPLICADOS
   * ========================================================
   */

  const unicos =
    removerDuplicados(
      registros
    );

  /*
   * ========================================================
   * DIAGNÓSTICO U5330
   * ========================================================
   */

  const u5330 =
    unicos.filter(
      (item) =>
        item.codigo_oem ===
        "U5330"
    );

  const modelosU5330 = [
    ...new Set(
      u5330
        .map(
          (item) =>
            item.modelo
        )
        .filter(Boolean)
    ),
  ];

  console.log(
    "========================================"
  );

  console.log(
    "⚡ PARSER NGK BOBINAS"
  );

  console.log(
    "Arquivo:",
    nomeArquivo
  );

  console.log(
    "Linhas:",
    linhas.length
  );

  console.log(
    "Registros:",
    unicos.length
  );

  console.log(
    "🔎 U5330 TOTAL:",
    u5330.length
  );

  console.log(
    "🔎 U5330 MODELOS:",
    modelosU5330
  );

  console.log(
    "🔎 U5330 SEM MODELO:",
    u5330.filter(
      (item) =>
        !item.modelo
    )
  );

  console.log(
    "🔎 U5330 GOL:",
    u5330.filter(
      (item) =>
        normalizar(
          item.modelo
        ) ===
        "gol"
    )
  );

  console.log(
    "🔎 U5330 POLO:",
    u5330.filter(
      (item) =>
        normalizar(
          item.modelo
        ) ===
        "polo"
    )
  );

  console.log(
    "🔎 U5330 SAVEIRO:",
    u5330.filter(
      (item) =>
        normalizar(
          item.modelo
        ) ===
        "saveiro"
    )
  );

  console.log(
    "🔎 U5330 VOYAGE:",
    u5330.filter(
      (item) =>
        normalizar(
          item.modelo
        ) ===
        "voyage"
    )
  );

  console.log(
    "🔎 U5330 NIVUS:",
    u5330.filter(
      (item) =>
        normalizar(
          item.modelo
        ) ===
        "nivus"
    )
  );

  console.log(
    "🔎 U5330 ETIOS ERRADO:",
    u5330.filter(
      (item) =>
        normalizar(
          item.montadora
        ) ===
          "volkswagen" &&
        normalizar(
          item.modelo
        ) ===
          "etios"
    )
  );

  console.log(
    "========================================"
  );

  onProgresso?.(
    `✅ NGK Bobinas: ${unicos.length} registro(s) encontrado(s).`
  );

  return unicos;
}

export default parserNgkBobinas;