/*
 * ============================================================
 * APPIA AI
 * MAGNETI MARELLI — IGNITION CABLES KIT 2016
 * ============================================================
 *
 * Catálogo:
 * Parts_Ignition_Cables_Kit.pdf
 *
 * Estrutura principal:
 *
 * MONTADORA
 * MODELO + MOTOR + CILINDROS + ANOS + MSK + MSQ
 *
 * Exemplo:
 *
 * ALFA ROMEO
 * Alfa 75 2.5i Mot 01646 156KM 6 85 ->87 MSK1377 MSQ0164
 *
 * Objetivo:
 *
 * MSK / MSQ
 *   ↓
 * montadora
 *   ↓
 * modelo
 *   ↓
 * motor
 *   ↓
 * anos
 * ============================================================
 */

function limparTexto(valor = "") {
  return String(valor || "")
    .replace(/\u00a0/g, " ")
    .replace(/\u2007/g, " ")
    .replace(/\u202f/g, " ")
    .replace(/￾/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function normalizarTexto(valor = "") {
  return limparTexto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function normalizarCodigo(valor = "") {
  return String(valor || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

/*
 * ============================================================
 * MONTADORAS
 * ============================================================
 */

const MONTADORAS = [
  "ALFA ROMEO",
  "AUDI",
  "AUSTIN",
  "BMW",
  "BUICK",
  "CHERY",
  "CHERRY",
  "CHEVROLET",
  "CHRYSLER",
  "CITROEN",
  "CITROËN",
  "DACIA",
  "DAEWOO",
  "DAF",
  "DAIHATSU",
  "DODGE",
  "EAGLE",
  "FIAT",
  "FORD",
  "FREIGHT ROVER",
  "FSO",
  "HONDA",
  "HYUNDAI",
  "INNOCENTI",
  "ISUZU",
  "JAGUAR",
  "JEEP",
  "KIA",
  "LADA",
  "ŁADA",
  "LANCIA",
  "LAND ROVER",
  "MAZDA",
  "MCC",
  "MERCEDES",
  "MERCEDES-BENZ",
  "MERCURY",
  "MG",
  "MINI",
  "MITSUBISHI",
  "MORRIS",
  "MOSKVICH",
  "NISSAN",
  "OLDSMOBILE",
  "OPEL",
  "PEUGEOT",
  "PLYMOUTH",
  "PONTIAC",
  "PORSCHE",
  "PROTON",
  "RELIANT",
  "RENAULT",
  "ROVER",
  "SAAB",
  "SEAT",
  "SKODA",
  "SMART",
  "STAR",
  "SUBARU",
  "SUZUKI",
  "TALBOT",
  "TAVRIA",
  "TOYOTA",
  "TRABANT",
  "TRIUMPH",
  "UAZ",
  "VAUXHALL",
  "VOLKSWAGEN",
  "VOLVO",
  "VOLGA",
  "WARTBURG",
  "YUGO-ZASTAWA",
  "ZUK-NYSA",
  "ŻUK-NYSA",
];

function corrigirMontadora(valor = "") {
  const texto =
    normalizarTexto(valor);

  if (
    texto === "CITROEN" ||
    texto === "CITROËN"
  ) {
    return "CITROEN";
  }

  if (
    texto === "LADA" ||
    texto === "ŁADA"
  ) {
    return "LADA";
  }

  if (
    texto.includes(
      "MERCEDES"
    )
  ) {
    return "MERCEDES-BENZ";
  }

  return limparTexto(
    valor
  ).toUpperCase();
}

function identificarMontadora(
  linha = ""
) {
  const texto =
    normalizarTexto(
      linha
    );

  for (
    const montadora
    of MONTADORAS
  ) {
    if (
      texto ===
      normalizarTexto(
        montadora
      )
    ) {
      return corrigirMontadora(
        montadora
      );
    }
  }

  return "";
}

/*
 * ============================================================
 * CÓDIGOS MSK / MSQ
 * ============================================================
 */

function extrairMSK(
  texto = ""
) {
  return [
    ...new Set(
      (
        String(
          texto || ""
        ).match(
          /\bMSK\d{3,5}\b/gi
        ) || []
      ).map(
        (item) =>
          normalizarCodigo(
            item
          )
      )
    ),
  ];
}

function extrairMSQ(
  texto = ""
) {
  return [
    ...new Set(
      (
        String(
          texto || ""
        ).match(
          /\bMSQ\d{3,5}\b/gi
        ) || []
      ).map(
        (item) =>
          normalizarCodigo(
            item
          )
      )
    ),
  ];
}

function possuiCodigoMarelli(
  linha = ""
) {
  return (
    extrairMSK(
      linha
    ).length >
      0 ||
    extrairMSQ(
      linha
    ).length >
      0
  );
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
    !Number.isFinite(
      numero
    )
  ) {
    return null;
  }

  /*
   * Catálogo 2016.
   *
   * 83 = 1983
   * 97 = 1997
   * 00 = 2000
   * 12 = 2012
   */

  return numero >= 50
    ? 1900 + numero
    : 2000 + numero;
}

function extrairPeriodo(
  linha = ""
) {
  const texto =
    limparTexto(
      linha
    );

  /*
   * 83 ->91
   * 92 -> 95
   * 97 ->
   */

  const match =
    texto.match(
      /\b(\d{2})\s*[-–]?>\s*(\d{2})?\b/
    );

  if (!match) {
    /*
     * Formato alternativo:
     *
     * 1996-1999
     */

    const longo =
      texto.match(
        /\b(19\d{2}|20\d{2})\s*[-–]\s*(19\d{2}|20\d{2})\b/
      );

    if (longo) {
      return {
        ano_inicio:
          Number(
            longo[1]
          ),

        ano_fim:
          Number(
            longo[2]
          ),
      };
    }

    return {
      ano_inicio: null,
      ano_fim: null,
    };
  }

  return {
    ano_inicio:
      converterAnoCurto(
        match[1]
      ),

    ano_fim:
      match[2]
        ? converterAnoCurto(
            match[2]
          )
        : null,
  };
}

/*
 * ============================================================
 * CILINDROS
 * ============================================================
 */

function extrairCilindros(
  linha = ""
) {
  /*
   * O número de cilindros fica imediatamente
   * antes do período:
   *
   * ... 4 90 ->94 MSK508
   * ... 6 85 ->87 MSK1377
   */

  const match =
    limparTexto(
      linha
    ).match(
      /\b(\d{1,2})\s+(\d{2})\s*[-–]?>/
    );

  if (!match) {
    return null;
  }

  const numero =
    Number(
      match[1]
    );

  if (
    numero < 1 ||
    numero > 16
  ) {
    return null;
  }

  return numero;
}

/*
 * ============================================================
 * REMOVER COLUNAS FINAIS
 * ============================================================
 */

function removerParteFinal(
  linha = ""
) {
  let texto =
    limparTexto(
      linha
    );

  /*
   * Remove MSK e MSQ.
   */

  texto =
    texto.replace(
      /\bMSK\d{3,5}\b/gi,
      " "
    );

  texto =
    texto.replace(
      /\bMSQ\d{3,5}\b/gi,
      " "
    );

  /*
   * Remove:
   *
   * cilindros + período
   *
   * 4 90 ->94
   * 6 92 ->
   */

  texto =
    texto.replace(
      /\b\d{1,2}\s+\d{2}\s*[-–]?>\s*\d{0,2}\b/g,
      " "
    );

  return limparTexto(
    texto
  );
}

/*
 * ============================================================
 * DETECTAR INÍCIO DE MOTOR
 * ============================================================
 */

function encontrarInicioMotor(
  texto = ""
) {
  const valor =
    limparTexto(
      texto
    );

  /*
   * Motores normalmente:
   *
   * 1.3
   * 1.3i
   * 1.6i
   * 2.0 TS
   * 2.5i V6
   */

  const match =
    valor.match(
      /\b\d+[.,]\d+[A-Z]?\b/i
    );

  if (!match) {
    return -1;
  }

  return match.index;
}

/*
 * ============================================================
 * MODELO NUMÉRICO
 * ============================================================
 *
 * Audi:
 *
 * 50
 * 60
 * 70
 * 80
 *
 * Renault também possui:
 *
 * 4
 * 5
 * etc.
 * ============================================================
 */

function extrairModeloNumerico(
  texto = ""
) {
  const valor =
    limparTexto(
      texto
    );

  const match =
    valor.match(
      /^(\d{1,3})(?:\s+|$)/
    );

  if (!match) {
    return null;
  }

  return {
    modelo:
      match[1],

    restante:
      limparTexto(
        valor.slice(
          match[0].length
        )
      ),
  };
}

/*
 * ============================================================
 * MODELO + MOTOR
 * ============================================================
 */

function interpretarPrefixo({
  linha = "",
  modeloAtual = "",
}) {
  const semFinal =
    removerParteFinal(
      linha
    );

  if (!semFinal) {
    return {
      modelo:
        modeloAtual,

      motor: null,

      observacao: null,
    };
  }

  /*
   * ========================================================
   * MODELO NUMÉRICO
   * ========================================================
   */

  const numerico =
    extrairModeloNumerico(
      semFinal
    );

  if (numerico) {
    const resto =
      numerico.restante;

    /*
     * Se após o número vier decimal:
     *
     * 50 1.1
     *
     * 50 é modelo.
     */

    if (
      /^\d+[.,]\d+/i.test(
        resto
      )
    ) {
      return {
        modelo:
          numerico.modelo,

        motor:
          resto ||
          null,

        observacao:
          null,
      };
    }

    /*
     * Ex:
     *
     * Audi 60
     * 60 4 64 ->72...
     *
     * depois da remoção das colunas sobra somente 60.
     */

    if (!resto) {
      return {
        modelo:
          numerico.modelo,

        motor: null,

        observacao:
          null,
      };
    }
  }

  /*
   * ========================================================
   * LINHA COMEÇA DIRETO PELO MOTOR
   * ========================================================
   *
   * 1.3 AR 307.32 Boxer...
   *
   * Usa modelo anterior.
   * ========================================================
   */

  if (
    /^\d+[.,]\d+/i.test(
      semFinal
    )
  ) {
    return {
      modelo:
        modeloAtual,

      motor:
        semFinal,

      observacao:
        null,
    };
  }

  /*
   * ========================================================
   * MODELO + MOTOR
   * ========================================================
   *
   * Alfa 75 1.6 Carburatore
   * Alfa 145 1.4i 16V TS
   * GTV 1.8i V6 TS
   * Spider 1.6
   * ========================================================
   */

  const inicioMotor =
    encontrarInicioMotor(
      semFinal
    );

  if (
    inicioMotor >= 0
  ) {
    const modelo =
      limparTexto(
        semFinal.slice(
          0,
          inicioMotor
        )
      );

    const motor =
      limparTexto(
        semFinal.slice(
          inicioMotor
        )
      );

    return {
      modelo:
        modelo ||
        modeloAtual,

      motor:
        motor ||
        null,

      observacao:
        null,
    };
  }

  /*
   * Sem motor identificável.
   *
   * Pode ser mudança de modelo.
   */

  return {
    modelo:
      semFinal ||
      modeloAtual,

    motor: null,

    observacao:
      null,
  };
}

/*
 * ============================================================
 * LIMPAR MOTOR
 * ============================================================
 */

function limparMotor(
  motor = ""
) {
  let texto =
    limparTexto(
      motor
    );

  if (!texto) {
    return null;
  }

  /*
   * Mantemos informações úteis:
   *
   * AR 307.32
   * Mot 01646
   * V6
   * 16V
   * TS
   *
   * Apenas retiramos notas puramente comerciais
   * quando possível.
   */

  return texto || null;
}

/*
 * ============================================================
 * CRIAR REGISTRO
 * ============================================================
 */

function criarRegistro({
  codigo,
  equivalentes = [],
  montadora,
  modelo,
  motor,
  cilindros,
  linha,
  configuracao = {},
  nomeArquivo = "",
}) {
  if (
    !codigo ||
    !montadora ||
    !modelo
  ) {
    return null;
  }

  const periodo =
    extrairPeriodo(
      linha
    );

  const equivalentesUnicos = [
    ...new Set(
      [
        codigo,
        ...equivalentes,
      ]
        .map(
          normalizarCodigo
        )
        .filter(Boolean)
    ),
  ];

  const observacoes = [
    cilindros
      ? `${cilindros} cilindros`
      : "",

    limparTexto(
      linha
    ),
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    peca:
      "Kit de Cabos de Ignição",

    descricao:
      "Kit de Cabos de Ignição",

    codigo_oem:
      normalizarCodigo(
        codigo
      ),

    codigo_equivalente:
      equivalentesUnicos.length >
      1
        ? equivalentesUnicos
            .filter(
              (item) =>
                item !==
                normalizarCodigo(
                  codigo
                )
            )
            .join(", ")
        : null,

    equivalentes:
      equivalentesUnicos,

    fabricante:
      "Magneti Marelli",

    montadora:
      corrigirMontadora(
        montadora
      ),

    modelo:
      limparTexto(
        modelo
      ),

    motor:
      limparMotor(
        motor
      ),

    ano_inicio:
      periodo.ano_inicio,

    ano_fim:
      periodo.ano_fim,

    aplicacao:
      limparTexto(
        linha
      ),

    observacao:
      observacoes,

    origem_catalogo:
      configuracao
        ?.origemCatalogo ||
      "Catálogo Magneti Marelli Ignition Cables Kit 2016",

    arquivo_catalogo:
      nomeArquivo ||
      null,

    tipo_catalogo:
      "cabos_ignicao",

    ativo: true,

    prioridade: 1,

    confiabilidade: 98,
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
    if (!registro) {
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
      .map(
        (valor) =>
          normalizarTexto(
            valor
          )
      )
      .join("|");

    const existente =
      mapa.get(
        chave
      );

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
          existente.equivalentes ||
          []
        ),

        ...(
          registro.equivalentes ||
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
          equivalentes
            .filter(
              (codigo) =>
                codigo !==
                existente.codigo_oem
            )
            .join(", ") ||
          null,
      }
    );
  }

  return Array.from(
    mapa.values()
  );
}

/*
 * ============================================================
 * PARSER DAS APLICAÇÕES POR VEÍCULO
 * ============================================================
 */

function interpretarAplicacoes({
  texto = "",
  configuracao = {},
  nomeArquivo = "",
}) {
  const linhas =
    String(
      texto || ""
    )
      .split(/\r?\n/)
      .map(
        limparTexto
      )
      .filter(Boolean);

  const registros = [];

  let montadoraAtual = "";
  let modeloAtual = "";

  for (
    const linha
    of linhas
  ) {
    /*
     * --------------------------------------------------------
     * MONTADORA
     * --------------------------------------------------------
     */

    const montadora =
      identificarMontadora(
        linha
      );

    if (montadora) {
      montadoraAtual =
        montadora;

      modeloAtual = "";

      continue;
    }

    if (!montadoraAtual) {
      continue;
    }

    /*
     * --------------------------------------------------------
     * SOMENTE LINHAS COM MSK
     * --------------------------------------------------------
     */

    const codigosMSK =
      extrairMSK(
        linha
      );

    if (
      codigosMSK.length ===
      0
    ) {
      continue;
    }

    const codigosMSQ =
      extrairMSQ(
        linha
      );

    const interpretado =
      interpretarPrefixo({
        linha,

        modeloAtual,
      });

    if (
      interpretado.modelo
    ) {
      modeloAtual =
        interpretado.modelo;
    }

    if (!modeloAtual) {
      continue;
    }

    const cilindros =
      extrairCilindros(
        linha
      );

    /*
     * Normalmente existe apenas um MSK por linha.
     * Mesmo assim aceitamos vários.
     */

    for (
      const codigoMSK
      of codigosMSK
    ) {
      const registro =
        criarRegistro({
          codigo:
            codigoMSK,

          equivalentes:
            codigosMSQ,

          montadora:
            montadoraAtual,

          modelo:
            modeloAtual,

          motor:
            interpretado.motor,

          cilindros,

          linha,

          configuracao,

          nomeArquivo,
        });

      if (registro) {
        registros.push(
          registro
        );
      }
    }

    /*
     * Criamos também entrada MSQ pesquisável.
     *
     * Assim:
     *
     * pesquisar MSQ0164
     *
     * também retorna o veículo.
     */

    for (
      const codigoMSQ
      of codigosMSQ
    ) {
      const registro =
        criarRegistro({
          codigo:
            codigoMSQ,

          equivalentes:
            codigosMSK,

          montadora:
            montadoraAtual,

          modelo:
            modeloAtual,

          motor:
            interpretado.motor,

          cilindros,

          linha,

          configuracao,

          nomeArquivo,
        });

      if (registro) {
        registros.push(
          registro
        );
      }
    }
  }

  return registros;
}

/*
 * ============================================================
 * MAPA MSK ↔ MSQ
 * ============================================================
 *
 * Usa o catálogo inteiro.
 *
 * Também captura relações das seções Buyers Guide.
 * ============================================================
 */

function criarMapaEquivalencias(
  texto = ""
) {
  const mapa =
    new Map();

  const linhas =
    String(
      texto || ""
    )
      .split(/\r?\n/)
      .map(
        limparTexto
      )
      .filter(Boolean);

  function adicionar(
    origem,
    destino
  ) {
    const a =
      normalizarCodigo(
        origem
      );

    const b =
      normalizarCodigo(
        destino
      );

    if (
      !a ||
      !b ||
      a === b
    ) {
      return;
    }

    if (
      !mapa.has(a)
    ) {
      mapa.set(
        a,
        new Set()
      );
    }

    mapa
      .get(a)
      .add(b);
  }

  for (
    const linha
    of linhas
  ) {
    const msks =
      extrairMSK(
        linha
      );

    const msqs =
      extrairMSQ(
        linha
      );

    if (
      !msks.length ||
      !msqs.length
    ) {
      continue;
    }

    for (
      const msk
      of msks
    ) {
      for (
        const msq
        of msqs
      ) {
        adicionar(
          msk,
          msq
        );

        adicionar(
          msq,
          msk
        );
      }
    }
  }

  return mapa;
}

/*
 * ============================================================
 * APLICAR EQUIVALÊNCIAS
 * ============================================================
 */

function aplicarEquivalencias({
  registros = [],
  mapa,
}) {
  return registros.map(
    (registro) => {
      const codigo =
        normalizarCodigo(
          registro.codigo_oem
        );

      const relacionados =
        mapa.get(
          codigo
        );

      if (!relacionados) {
        return registro;
      }

      const equivalentes = [
        ...new Set([
          ...(
            registro.equivalentes ||
            []
          ),

          ...Array.from(
            relacionados
          ),
        ]),
      ];

      return {
        ...registro,

        equivalentes,

        codigo_equivalente:
          equivalentes
            .filter(
              (item) =>
                item !==
                codigo
            )
            .join(", ") ||
          null,
      };
    }
  );
}

/*
 * ============================================================
 * PARSER PRINCIPAL
 * ============================================================
 */

export async function parserMagnetiMarelliCabosIgnicao({
  textoReferencias = "",
  textoAplicacoes = "",
  textoEquivalencias = "",
  nomeArquivo = "",
  configuracao = {},
  onProgresso,
} = {}) {
  onProgresso?.(
    "⚡ Interpretando Magneti Marelli Cabos de Ignição 2016..."
  );

  /*
   * ========================================================
   * TEXTO DAS APLICAÇÕES
   * ========================================================
   */

  const textoBase =
    textoAplicacoes?.trim()
      ? textoAplicacoes
      : textoReferencias;

  if (
    !String(
      textoBase || ""
    ).trim()
  ) {
    console.warn(
      "⚠️ MARELLI CABOS: nenhum texto de aplicações recebido."
    );

    return [];
  }

  /*
   * ========================================================
   * APLICAÇÕES
   * ========================================================
   */

  const registrosAplicacao =
    interpretarAplicacoes({
      texto:
        textoBase,

      configuracao,

      nomeArquivo,
    });

  /*
   * ========================================================
   * EQUIVALÊNCIAS MSK / MSQ
   * ========================================================
   */

  const textoCompleto = [
    textoReferencias,
    textoAplicacoes,
    textoEquivalencias,
  ]
    .filter(Boolean)
    .join("\n");

  const mapaEquivalencias =
    criarMapaEquivalencias(
      textoCompleto
    );

  const registrosComEquivalencias =
    aplicarEquivalencias({
      registros:
        registrosAplicacao,

      mapa:
        mapaEquivalencias,
    });

  const registros =
    removerDuplicados(
      registrosComEquivalencias
    );

  /*
   * ========================================================
   * DIAGNÓSTICO
   * ========================================================
   */

  console.log(
    "=========================================="
  );

  console.log(
    "⚡ MARELLI IGNITION CABLES KIT 2016"
  );

  console.log(
    "REGISTROS INTERPRETADOS:",
    registrosAplicacao.length
  );

  console.log(
    "MAPA MSK/MSQ:",
    mapaEquivalencias.size
  );

  console.log(
    "REGISTROS ÚNICOS:",
    registros.length
  );

  console.log(
    "EXEMPLOS:",
    registros.slice(
      0,
      10
    )
  );

  /*
   * Testes úteis do próprio catálogo.
   */

  const testeMSK1377 =
    registros.filter(
      (registro) =>
        normalizarCodigo(
          registro.codigo_oem
        ) ===
          "MSK1377" ||
        (
          registro.equivalentes ||
          []
        ).includes(
          "MSK1377"
        )
    );

  console.log(
    "🎯 MSK1377:",
    testeMSK1377
  );

  const testeMSQ0164 =
    registros.filter(
      (registro) =>
        normalizarCodigo(
          registro.codigo_oem
        ) ===
          "MSQ0164" ||
        (
          registro.equivalentes ||
          []
        ).includes(
          "MSQ0164"
        )
    );

  console.log(
    "🎯 MSQ0164:",
    testeMSQ0164
  );

  console.log(
    "=========================================="
  );

  onProgresso?.(
    `✅ Cabos Marelli 2016: ${registros.length} aplicação(ões) interpretada(s).`
  );

  return registros;
}

export default parserMagnetiMarelliCabosIgnicao;