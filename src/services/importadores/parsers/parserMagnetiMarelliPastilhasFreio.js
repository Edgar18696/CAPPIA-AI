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

/*
 * ============================================================
 * CÓDIGOS DE PASTILHAS
 * ============================================================
 *
 * CATÁLOGO ANTIGO:
 *
 * PF0214
 * PF0105
 *
 * CATÁLOGO NOVO BREMBO / MARELLI:
 *
 * P23137MM
 * P23139MM
 * P23146MM
 * P49044MM
 * PA6027MM
 *
 * ============================================================
 */

function extrairCodigosPastilha(
  linha = ""
) {
  const texto =
    String(linha || "");

  const encontrados = [
    /*
     * Antigo:
     * PF0214
     */
    ...texto.matchAll(
      /\bPF\d{4}\b/gi
    ),

    /*
     * Novo:
     *
     * P23137MM
     * P49044MM
     * PA6027MM
     */
    ...texto.matchAll(
      /\bP[A-Z]?\d{4,5}MM\b/gi
    ),
  ].map(
    (match) =>
      normalizarCodigo(
        match[0]
      )
  );

  return [
    ...new Set(
      encontrados
    ),
  ];
}

/*
 * Compatibilidade com o nome
 * usado pelo parser antigo.
 */

function extrairCodigosPF(
  linha = ""
) {
  return extrairCodigosPastilha(
    linha
  );
}

const MONTADORAS = [
  "ABARTH",
  "ACURA",
  "ALFA ROMEO",
  "ALPINA",
  "ARO",
  "ASTON MARTIN",
  "AUDI",
  "AUTOBIANCHI",
  "BEDFORD",
  "BENTLEY",
  "BMW",
  "BUICK",
  "BYD",
  "CADILLAC",
  "CHEVROLET",
  "CHEVROLET (DAEWOO)",
  "CHRYSLER",
  "CITROEN",
  "CITROËN",
  "DACIA",
  "DAEWOO",
  "DAEWOO (CHEVROLET)",
  "DAIHATSU",
  "DAIMLER",
  "DODGE",
  "DR",
  "DS",
  "FERRARI",
  "FIAT",
  "FORD",
  "FSO",
  "GEO",
  "HOLDEN",
  "HONDA",
  "HUMMER",
  "HYUNDAI",
  "INFINITI",
  "INNOCENTI",
  "ISUZU",
  "IVECO",
  "JAGUAR",
  "JEEP",
  "KIA",
  "LADA",
  "LANCIA",
  "LAND ROVER",
  "LDV",
  "LEYLAND",
  "LEXUS",
  "LOTUS",
  "LTI",
  "MASERATI",
  "MAZDA",
  "MERCEDES-BENZ",
  "MG",
  "MINI",
  "MINI (BMW)",
  "MITSUBISHI",
  "NISSAN",
  "OLDSMOBILE",
  "OPEL",
  "PERODUA",
  "PEUGEOT",
  "PIAGGIO",
  "PLYMOUTH",
  "PONTIAC",
  "PORSCHE",
  "PROTON",
  "PUCH",
  "RENAULT",
  "RENAULT TRUCKS",
  "ROLLS-ROYCE",
  "ROVER",
  "SAAB",
  "SANTANA",
  "SEAT",
  "SKODA",
  "SMART",
  "SMART (MCC)",
  "SSANGYONG",
  "SUBARU",
  "SUZUKI",
  "TATA",
  "TATA (TELCO)",
  "TESLA",
  "TOYOTA",
  "VAUXHALL",
  "VOLKSWAGEN",
  "VOLVO",
  "ZAZ",
];

function identificarMontadora(
  linha = ""
) {
  const texto =
    normalizarTexto(
      linha
    );

  const encontrada =
    MONTADORAS.find(
      (montadora) =>
        normalizarTexto(
          montadora
        ) === texto
    );

  return encontrada || "";
}

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
    .filter(Boolean);
}

function ehCabecalho(
  linha = ""
) {
  const texto =
    normalizarTexto(
      linha
    );

  if (!texto) {
    return true;
  }

  const termos = [
    "KW",
    "WI",
    "SYS",
    "LENGHT",
    "LENGTH",
    "FK",
    "TH",
    "[MM]",
    "MAGNETI MARELLI",
    "BREMBO",
    "VEHICLE APPLICATION GUIDE",
    "APPLICAZIONE PER MARCA E VEICOLO",
    "APLICACAO POR MARCA E VEICULO",
    "APLICAÇÃO POR MARCA E VEÍCULO",
    "FOR APPLICATIONS OLDER THAN 1998",
    "PER LE APPLICAZIONI PRECEDENTI",
    "BUYERS GUIDE",
    "CROSS REFERENCE GUIDE",
    "TAVOLE DI COMPARAZIONE",
  ];

  return termos.some(
    (termo) =>
      texto === termo ||
      texto.startsWith(
        `${termo} `
      )
  );
}

function ehLinhaTecnica(
  linha = ""
) {
  const texto =
    limparTexto(
      linha
    );

  if (!texto) {
    return true;
  }

  if (
    /^[●+\-\[\]]+$/.test(
      texto
    )
  ) {
    return true;
  }

  if (
    /^\d+(?:[.,]\d+)?$/.test(
      texto
    )
  ) {
    return true;
  }

  if (
    /^(ATE|AKE|BRE|BSH|TRW|SUM|NSN|BDX|GIR|GM|VAR|VW\/VAG)$/i.test(
      texto
    )
  ) {
    return true;
  }

  return false;
}

/*
 * ============================================================
 * MODELO
 * ============================================================
 */

function pareceLinhaModelo(
  linha = ""
) {
  const texto =
    limparTexto(
      linha
    );

  if (
    !texto ||
    texto.length > 100
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
    ehCabecalho(
      texto
    )
  ) {
    return false;
  }

  if (
    ehLinhaTecnica(
      texto
    )
  ) {
    return false;
  }

  if (
    extrairCodigosPastilha(
      texto
    ).length > 0
  ) {
    return false;
  }

  /*
   * Modelo do catálogo novo:
   *
   * 124 Spider (348_) 03/16 à
   * GRANDE PUNTO (199_) 12/07 à12/12
   * 4C (960_) 03/13 à
   */

  if (
    /\b\d{1,2}\/\d{2}\b/.test(
      texto
    ) &&
    /[A-Z]/i.test(
      texto
    )
  ) {
    return true;
  }

  /*
   * Modelo sem data na mesma linha.
   */

  if (
    /^[A-Z0-9][A-Z0-9 ._()\/+-]{1,70}$/i.test(
      texto
    ) &&
    !/^\d/.test(
      texto
    )
  ) {
    return true;
  }

  return false;
}

function limparModelo(
  linha = ""
) {
  return limparTexto(
    String(linha || "")
      .replace(
        /\s+\d{1,2}\/\d{2}.*$/i,
        ""
      )
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

  if (
    numero <= 30
  ) {
    return 2000 +
      numero;
  }

  return 1900 +
    numero;
}

function extrairAnos(
  linha = ""
) {
  const texto =
    limparTexto(
      linha
    );

  const datas = [
    ...texto.matchAll(
      /\b\d{1,2}\/(\d{2})\b/g
    ),
  ]
    .map(
      (match) =>
        converterAnoCurto(
          match[1]
        )
    )
    .filter(
      (ano) =>
        ano >= 1950 &&
        ano <= 2035
    );

  if (
    datas.length === 0
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
        ...datas
      ),

    ano_fim:
      datas.length > 1
        ? Math.max(
            ...datas
          )
        : null,
  };
}

/*
 * ============================================================
 * MOTOR
 * ============================================================
 */

function extrairMotor(
  linha = ""
) {
  const texto =
    limparTexto(
      linha
    );

  /*
   * Exemplos:
   *
   * 1.4 (312.AXD1A) 99 08/08...
   * 3.2 Vtec 165 10/00...
   * 1.8 (960.CXB1A) 177 03/13...
   */

  const match =
    texto.match(
      /\b\d\.\d(?:\s+[A-Z0-9._+-]+)*(?:\s+\([A-Z0-9., _+-]+\))?/i
    );

  if (match) {
    return limparTexto(
      match[0]
    );
  }

  return "";
}

/*
 * ============================================================
 * SISTEMA DE FREIO / ESPESSURA
 * ============================================================
 */

function extrairSistemaFreio(
  linha = ""
) {
  const sistemas = [
    "ADV",
    "AKE",
    "ALC",
    "ATE",
    "BDX",
    "BRE",
    "BSH",
    "CIT",
    "DE",
    "GIR",
    "GM",
    "HIT",
    "JWA",
    "KH",
    "LKD",
    "MN",
    "NBK",
    "NSN",
    "PBR",
    "PER",
    "SAN",
    "SNG",
    "SUM",
    "TOK",
    "TRW",
    "VAR",
    "WAB",
  ];

  const texto =
    normalizarTexto(
      linha
    );

  return (
    sistemas.find(
      (item) =>
        new RegExp(
          `\\b${item}\\b`
        ).test(
          texto
        )
    ) ||
    ""
  );
}

function extrairEspessura(
  linha = "",
  codigo = ""
) {
  const texto =
    limparTexto(
      linha
    );

  const indice =
    normalizarTexto(
      texto
    ).indexOf(
      normalizarTexto(
        codigo
      )
    );

  if (
    indice < 0
  ) {
    return "";
  }

  const depois =
    texto.slice(
      indice +
      codigo.length
    );

  /*
   * P23137MM [+] 19 BSH
   */

  const match =
    depois.match(
      /\b(\d{1,2}(?:[.,]\d+)?)\b/
    );

  return match
    ? match[1]
    : "";
}

/*
 * ============================================================
 * KITS
 * ============================================================
 */

function extrairKits(
  linha = ""
) {
  return [
    ...new Set(
      [
        ...String(
          linha || ""
        ).matchAll(
          /\bOK\d{3}\b/gi
        ),
      ].map(
        (match) =>
          normalizarCodigo(
            match[0]
          )
      )
    ),
  ];
}

/*
 * ============================================================
 * REGISTRO
 * ============================================================
 */

function criarRegistro({
  codigo,
  lado,
  montadora,
  modelo,
  contexto,
  equivalentes = [],
  configuracao = {},
  nomeArquivo = "",
}) {
  const {
    ano_inicio,
    ano_fim,
  } =
    extrairAnos(
      contexto
    );

  const motor =
    extrairMotor(
      contexto
    );

  const sistemaFreio =
    extrairSistemaFreio(
      contexto
    );

  const espessura =
    extrairEspessura(
      contexto,
      codigo
    );

  const kits =
    extrairKits(
      contexto
    );

  const peca =
    lado ===
      "traseira"
      ? "Pastilha de Freio Traseira"
      : lado ===
          "dianteira"
        ? "Pastilha de Freio Dianteira"
        : "Pastilha de Freio";

  const equivalentesLimpos =
    [
      ...new Set(
        equivalentes
          .map(
            normalizarCodigo
          )
          .filter(Boolean)
      ),
    ];

  const detalhes = [
    `Código Magneti Marelli: ${codigo}`,

    lado
      ? `Posição: ${lado}`
      : "",

    sistemaFreio
      ? `Sistema de freio: ${sistemaFreio}`
      : "",

    espessura
      ? `Espessura: ${espessura} mm`
      : "",

    kits.length
      ? `Kits: ${kits.join(", ")}`
      : "",

    `Linha catálogo: ${contexto}`,
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    peca,

    descricao:
      peca,

    codigo_oem:
      codigo,

    codigo_equivalente:
      equivalentesLimpos[0] ||
      codigo,

    equivalentes:
      equivalentesLimpos,

    fabricante:
      "Magneti Marelli",

    montadora:
      montadora ||
      null,

    modelo:
      modelo ||
      null,

    motor:
      motor ||
      null,

    ano_inicio,

    ano_fim,

    aplicacao:
      contexto,

    observacao:
      detalhes,

    origem_catalogo:
      configuracao
        ?.origemCatalogo ||
      (
        /\bP[A-Z]?\d{4,5}MM\b/i.test(
          codigo
        )
          ? "Catálogo Magneti Marelli Brembo Brake Pads"
          : "Catálogo Magneti Marelli Brake Pads 2015-2016"
      ),

    arquivo_catalogo:
      nomeArquivo ||
      null,

    tipo_catalogo:
      "pastilhas_freio",

    categoria:
      "Freios",

    sistema:
      "Freio",

    ativo:
      true,

    prioridade:
      1,

    confiabilidade:
      montadora &&
      modelo
        ? 95
        : 85,
  };
}

/*
 * ============================================================
 * EQUIVALÊNCIAS OE / IAM / WVA
 * ============================================================
 *
 * NOVO:
 *
 * 71773152 P23137MM
 * FDB1829 P23137MM
 * 2370901 P23137MM
 *
 * ANTIGO:
 *
 * 425408 PF0214
 * GDB458 PF0105
 *
 * ============================================================
 */

function criarMapaEquivalencias(
  linhas = []
) {
  const mapa =
    new Map();

  for (
    const linha
    of linhas
  ) {
    const codigos =
      extrairCodigosPastilha(
        linha
      );

    if (
      codigos.length === 0
    ) {
      continue;
    }

    for (
      const codigoPastilha
      of codigos
    ) {
      if (
        !mapa.has(
          codigoPastilha
        )
      ) {
        mapa.set(
          codigoPastilha,
          new Set()
        );
      }

      const conjunto =
        mapa.get(
          codigoPastilha
        );

      const partes =
        limparTexto(
          linha
        )
          .split(/\s+/)
          .map(
            normalizarCodigo
          )
          .filter(Boolean);

      for (
        const codigo
        of partes
      ) {
        if (
          codigo ===
          codigoPastilha
        ) {
          continue;
        }

        if (
          extrairCodigosPastilha(
            codigo
          ).length > 0
        ) {
          continue;
        }

        if (
          codigo.length <
          4
        ) {
          continue;
        }

        if (
          /^(OE|OES|IAM|WVA|MM)$/.test(
            codigo
          )
        ) {
          continue;
        }

        if (
          /^(ATE|AKE|BRE|BSH|TRW|SUM|NSN)$/.test(
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
      registro.peca,
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

      continue;
    }

    const existente =
      mapa.get(
        chave
      );

    const equivalentes =
      [
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
            .codigo_equivalente,
      }
    );
  }

  return Array.from(
    mapa.values()
  );
}

/*
 * ============================================================
 * PARSER
 * ============================================================
 */

export async function parserMagnetiMarelliPastilhasFreio({
  textoReferencias = "",
  textoAplicacoes = "",
  textoEquivalencias = "",
  nomeArquivo = "",
  configuracao = {},
  onProgresso,
}) {
  const ehCatalogoBremboNovo =
    /brembo/i.test(
      String(
        nomeArquivo || ""
      )
    ) ||
    /\bP[A-Z]?\d{4,5}MM\b/i.test(
      textoAplicacoes
    );

  onProgresso?.(
    ehCatalogoBremboNovo
      ? "🛑 Lendo catálogo Magneti Marelli / Brembo Brake Pads..."
      : "🛑 Lendo catálogo Magneti Marelli Brake Pads 2015-2016..."
  );

  const linhasAplicacoes =
    transformarEmLinhas(
      textoAplicacoes
    );

  const linhasReferencias =
    transformarEmLinhas(
      textoReferencias
    );

  const linhasEquivalencias =
    transformarEmLinhas(
      textoEquivalencias
    );

  const mapaEquivalencias =
    criarMapaEquivalencias([
      ...linhasReferencias,
      ...linhasEquivalencias,
    ]);

  const registros = [];

  let montadoraAtual =
    "";

  let modeloAtual =
    "";

  /*
   * Guarda as últimas linhas porque
   * no catálogo novo motor, período
   * e código podem quebrar em linhas.
   */

  const contextoAnterior = [];

  for (
    let indiceLinha = 0;
    indiceLinha <
      linhasAplicacoes.length;
    indiceLinha += 1
  ) {
    const linha =
      linhasAplicacoes[
        indiceLinha
      ];

    if (!linha) {
      continue;
    }

    const montadora =
      identificarMontadora(
        linha
      );

    if (montadora) {
      montadoraAtual =
        montadora;

      modeloAtual =
        "";

      contextoAnterior.length =
        0;

      continue;
    }

    if (
      ehCabecalho(
        linha
      )
    ) {
      continue;
    }

    const codigos =
      extrairCodigosPastilha(
        linha
      );

    /*
     * ========================================================
     * LINHA SEM CÓDIGO
     * ========================================================
     */

    if (
      codigos.length ===
      0
    ) {
      if (
        pareceLinhaModelo(
          linha
        )
      ) {
        const modelo =
          limparModelo(
            linha
          );

        /*
         * Evita transformar motor em modelo.
         */

        if (
          modelo &&
          !/^\d\.\d\b/.test(
            modelo
          )
        ) {
          modeloAtual =
            modelo;
        }
      }

      contextoAnterior.push(
        linha
      );

      if (
        contextoAnterior.length >
        6
      ) {
        contextoAnterior.shift();
      }

      continue;
    }

    /*
     * ========================================================
     * CONTEXTO COMPLETO
     * ========================================================
     */

    const proximasLinhas =
      linhasAplicacoes.slice(
        indiceLinha + 1,
        indiceLinha + 4
      );

    const contexto =
      [
        ...contextoAnterior,
        linha,
        ...proximasLinhas,
      ]
        .filter(Boolean)
        .join(" ");

    /*
     * ========================================================
     * CÓDIGOS DA LINHA
     * ========================================================
     */

    for (
      let indiceCodigo = 0;
      indiceCodigo <
        codigos.length;
      indiceCodigo += 1
    ) {
      const codigo =
        codigos[
          indiceCodigo
        ];

      let lado = "";

      /*
       * Catálogo antigo pode trazer
       * dianteira + traseira na mesma linha.
       */

      if (
        !ehCatalogoBremboNovo &&
        codigos.length >= 2
      ) {
        lado =
          indiceCodigo === 0
            ? "dianteira"
            : "traseira";
      }

      /*
       * Catálogo novo usa marcação visual.
       * Por segurança deixamos Pastilha de
       * Freio quando não for possível
       * determinar a posição pelo texto.
       */

      const equivalentes =
        mapaEquivalencias.has(
          codigo
        )
          ? Array.from(
              mapaEquivalencias.get(
                codigo
              )
            )
          : [];

      const registro =
        criarRegistro({
          codigo,

          lado,

          montadora:
            montadoraAtual,

          modelo:
            modeloAtual,

          contexto,

          equivalentes,

          configuracao,

          nomeArquivo,
        });

      registros.push(
        registro
      );
    }

    contextoAnterior.push(
      linha
    );

    if (
      contextoAnterior.length >
      6
    ) {
      contextoAnterior.shift();
    }
  }

  const registrosUnicos =
    removerDuplicados(
      registros
    );

  /*
   * ========================================================
   * DIAGNÓSTICO NOVO CATÁLOGO
   * ========================================================
   */

  const p23137 =
    registrosUnicos.filter(
      (registro) =>
        normalizarCodigo(
          registro.codigo_oem
        ) ===
        "P23137MM"
    );

  console.log(
    "=========================================="
  );

  console.log(
    "🛑 MARELLI BRAKE PADS"
  );

  console.log(
    "VERSÃO:",
    ehCatalogoBremboNovo
      ? "BREMBO / MARELLI NOVO"
      : "MARELLI ANTIGO"
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

  console.log(
    "REGISTROS:",
    registros.length
  );

  console.log(
    "ÚNICOS:",
    registrosUnicos.length
  );

  console.log(
    "🎯 P23137MM:",
    p23137.slice(
      0,
      10
    )
  );

  console.log(
    "=========================================="
  );

  onProgresso?.(
    `✅ Magneti Marelli Brake Pads: ${registrosUnicos.length} registro(s) encontrado(s).`
  );

  return registrosUnicos;
}

export default parserMagnetiMarelliPastilhasFreio;