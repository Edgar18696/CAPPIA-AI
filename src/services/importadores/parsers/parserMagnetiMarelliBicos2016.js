function limparTexto(valor = "") {
  return String(valor || "")
    .replace(/\u00a0/g, " ")
    .replace(/[\t\f\v]+/g, " ")
    .replace(/ {2,}/g, " ")
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

function normalizarCodigoOriginal(valor = "") {
  return limparTexto(valor)
    .toUpperCase()
    .replace(/\s+/g, "");
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
  "DACIA",
  "DODGE",
  "FIAT",
  "FORD",
  "HONDA",
  "HYUNDAI",
  "IVECO",
  "JEEP",
  "KIA",
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
  const texto =
    normalizarTexto(
      linha
    );

  for (
    const montadora
    of MONTADORAS
  ) {
    const alvo =
      normalizarTexto(
        montadora
      );

    if (
      texto === alvo ||
      texto.startsWith(
        `${alvo} `
      )
    ) {
      return montadora;
    }
  }

  return "";
}

/*
 * ============================================================
 * CÓDIGOS PRINCIPAIS DE BICOS
 * ============================================================
 */

function extrairTodosCodigosBico(
  texto = ""
) {
  return [
    ...String(
      texto || ""
    ).matchAll(
      /\b(?:IWP|IPM|FEI)[A-Z0-9./-]+\b/gi
    ),
  ].map(
    (match) => ({
      codigo:
        String(
          match[0] || ""
        ).toUpperCase(),

      indice:
        match.index ?? -1,
    })
  );
}

function extrairCodigoBico(
  linha = ""
) {
  return (
    extrairTodosCodigosBico(
      linha
    )[0]?.codigo ||
    ""
  );
}

/*
 * ============================================================
 * CÓDIGOS EQUIVALENTES MARELLI
 * ============================================================
 *
 * Exemplo importante:
 *
 * IWP099 <-> SMR00102Y
 *
 * Alguns blocos do catálogo podem utilizar o equivalente
 * no lugar do código IWP.
 * ============================================================
 */

function extrairCodigosEquivalentesMarelli(
  texto = ""
) {
  return [
    ...String(
      texto || ""
    ).matchAll(
      /\bSMR[A-Z0-9./-]{4,}\b/gi
    ),
  ].map(
    (match) =>
      String(
        match[0] || ""
      ).toUpperCase()
  );
}

function extrairTodosCodigosReconhecidos(
  texto = ""
) {
  const principais =
    extrairTodosCodigosBico(
      texto
    ).map(
      (item) =>
        item.codigo
    );

  const equivalentes =
    extrairCodigosEquivalentesMarelli(
      texto
    );

  return [
    ...new Set([
      ...principais,
      ...equivalentes,
    ]),
  ];
}

/*
 * ============================================================
 * MAPA CÓDIGO PRINCIPAL <-> EQUIVALENTE
 * ============================================================
 */

function construirMapaEquivalencias(
  linhas = []
) {
  const aliasParaPrincipal =
    new Map();

  const principalParaAliases =
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

    const principais =
      extrairTodosCodigosBico(
        linha
      ).map(
        (item) =>
          normalizarCodigoOriginal(
            item.codigo
          )
      );

    let equivalentes =
      extrairCodigosEquivalentesMarelli(
        linha
      ).map(
        normalizarCodigoOriginal
      );

    /*
     * Algumas equivalências podem aparecer
     * uma linha abaixo do IWP.
     */

    if (
      principais.length >
        0 &&
      equivalentes.length ===
        0
    ) {
      const proximaLinha =
        linhas[
          indice + 1
        ] || "";

      equivalentes =
        extrairCodigosEquivalentesMarelli(
          proximaLinha
        ).map(
          normalizarCodigoOriginal
        );
    }

    if (
      principais.length ===
        0 ||
      equivalentes.length ===
        0
    ) {
      continue;
    }

    for (
      const principal
      of principais
    ) {
      if (
        !principalParaAliases.has(
          principal
        )
      ) {
        principalParaAliases.set(
          principal,
          new Set()
        );
      }

      for (
        const equivalente
        of equivalentes
      ) {
        aliasParaPrincipal.set(
          equivalente,
          principal
        );

        principalParaAliases
          .get(
            principal
          )
          .add(
            equivalente
          );
      }
    }
  }

  return {
    aliasParaPrincipal,

    principalParaAliases,
  };
}

/*
 * ============================================================
 * RESOLVER CÓDIGO PRINCIPAL
 * ============================================================
 */

function resolverCodigoPrincipal({
  linha = "",
  mapaEquivalencias,
  codigoAtual = "",
}) {
  const principais =
    extrairTodosCodigosBico(
      linha
    );

  if (
    principais.length >
    0
  ) {
    return normalizarCodigoOriginal(
      principais[
        principais.length - 1
      ].codigo
    );
  }

  const equivalentes =
    extrairCodigosEquivalentesMarelli(
      linha
    );

  for (
    const equivalente
    of equivalentes
  ) {
    const normalizado =
      normalizarCodigoOriginal(
        equivalente
      );

    const principal =
      mapaEquivalencias
        ?.aliasParaPrincipal
        ?.get(
          normalizado
        );

    if (principal) {
      return principal;
    }
  }

  return codigoAtual;
}

function ehInicioCodigoBico(
  linha = ""
) {
  const texto =
    limparTexto(
      linha
    ).toUpperCase();

  const codigos =
    extrairTodosCodigosBico(
      texto
    );

  if (!codigos.length) {
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
    /\b(?:ENGINE|PETROL|DIESEL|BENZINA|GASOLINE|KW|CODIGOS? MOTOR)\b/i.test(
      texto
    )
  ) {
    return false;
  }

  return texto.length <= 140;
}

/*
 * ============================================================
 * MODELOS INVÁLIDOS
 * ============================================================
 */

function modeloEhInvalido(
  modelo = ""
) {
  const texto =
    limparTexto(
      modelo
    );

  if (!texto) {
    return true;
  }

  const normalizado =
    normalizarTexto(
      texto
    );

  if (
    [
      "OTHER",
      "OTHERS",
      "ENGINE",
      "ENGINE:",
      "TYPE",
      "TYPE TYPE",
      "GROUP C",
      "GRUPPO C",
      "PETROL",
      "DIESEL",
      "BENZINA",
      "GASOLINE",
      "KW",
      "B KW",
    ].includes(
      normalizado
    )
  ) {
    return true;
  }

  /*
   * B02
   * B03
   * J5_
   * BB0
   * KC0
   */

  if (
    /^[A-Z]{1,4}\d{1,4}_?$/i.test(
      texto
    )
  ) {
    return true;
  }

  /*
   * BB0/1/2_
   * KC0/1_
   * FC0/1_
   */

  if (
    /^[A-Z0-9_./-]+$/i.test(
      texto
    ) &&
    /\d|[/_]/.test(
      texto
    ) &&
    !/\s/.test(
      texto
    )
  ) {
    return true;
  }

  return false;
}

/*
 * ============================================================
 * IDENTIFICAR LINHA QUE PARECE APLICAÇÃO
 * ============================================================
 */

function pareceLinhaAplicacao(
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
    /^\d/.test(
      texto
    )
  ) {
    return true;
  }

  if (
    /\b(?:PETROL|DIESEL|BENZINA|GASOLINE|ENGINE|KW|HP|CV)\b/i.test(
      texto
    )
  ) {
    return true;
  }

  if (
    /\b\d{2}\/\d{2}\b/.test(
      texto
    )
  ) {
    return true;
  }

  return false;
}

/*
 * ============================================================
 * EXTRAIR MODELO COMERCIAL
 * ============================================================
 */

function extrairModelo(
  linha = ""
) {
  const texto =
    limparTexto(
      linha
    );

  if (!texto) {
    return "";
  }

  if (
    pareceLinhaAplicacao(
      texto
    )
  ) {
    return "";
  }

  if (
    identificarMontadora(
      texto
    )
  ) {
    return "";
  }

  if (
    extrairTodosCodigosReconhecidos(
      texto
    ).length >
    0
  ) {
    return "";
  }

  /*
   * ========================================================
   * FORMATO NORMAL
   *
   * CLIO II (BB0/1/2_)
   * ========================================================
   */

  const comPlataforma =
    texto.match(
      /^(.+?)\s*\(([^)]*)\)\s*(.*)$/
    );

  if (
    comPlataforma
  ) {
    const nome =
      limparTexto(
        comPlataforma[1]
      );

    if (
      !modeloEhInvalido(
        nome
      ) &&
      nome.length >= 2 &&
      nome.length <= 80 &&
      /[A-ZÀ-Ý]/i.test(
        nome
      )
    ) {
      return nome;
    }

    return "";
  }

  /*
   * ========================================================
   * FORMATO SEM PARÊNTESES
   *
   * Alguns modelos podem sair do PDF simplesmente como:
   *
   * CLIO II
   * KANGOO EXPRESS
   * TWINGO
   * FIESTA V
   *
   * ========================================================
   */

  if (
    modeloEhInvalido(
      texto
    )
  ) {
    return "";
  }

  if (
    texto.length < 2 ||
    texto.length > 60
  ) {
    return "";
  }

  if (
    !/[A-ZÀ-Ý]/i.test(
      texto
    )
  ) {
    return "";
  }

  /*
   * Evita linhas técnicas.
   */

  if (
    /\b(?:INJECTOR|INIETTORE|MAGNETI|MARELLI|REFERENCE|REFERENCIA|CODE|CODICE|TYPE|GROUP)\b/i.test(
      texto
    )
  ) {
    return "";
  }

  /*
   * Evita códigos grandes soltos.
   */

  if (
    /^[A-Z0-9._/-]+$/i.test(
      texto
    ) &&
    /\d/.test(
      texto
    ) &&
    !/\s/.test(
      texto
    )
  ) {
    return "";
  }

  return texto;
}

/*
 * ============================================================
 * MOTOR
 * ============================================================
 */

function extrairMotor(
  texto = ""
) {
  const original =
    limparTexto(
      texto
    );

  const encontrado =
    original.match(
      /\b(?:\d[.,]\d|[789]\d{2}|1\d{3}|2\d{3})(?:\s+(?:6V|8V|12V|16V|20V|24V))?(?:\s+(?:TURBO|JTD|JTDM|TDI|HDI|TSI|TFSI|MPI))?/i
    )?.[0] || "";

  return limparTexto(
    encontrado
  );
}

function extrairCodigosMotor(
  texto = ""
) {
  const original =
    String(
      texto || ""
    );

  const encontrados = [
    ...original.matchAll(
      /ENGINE\s*:\s*([^\n]+)/gi
    ),
  ];

  const codigos = [];

  for (
    const encontrado
    of encontrados
  ) {
    const parte =
      encontrado[1] || "";

    codigos.push(
      ...parte
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
    );
  }

  return [
    ...new Set(
      codigos
    ),
  ];
}

/*
 * ============================================================
 * PERÍODO
 * ============================================================
 */

function converterAnoCurto(
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

function extrairPeriodo(
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
    !encontrados.length
  ) {
    return {
      ano_inicio: null,
      ano_fim: null,
    };
  }

  const primeiro =
    encontrados[0];

  const anoInicio =
    converterAnoCurto(
      primeiro[2]
    );

  if (
    encontrados.length ===
    1
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
      converterAnoCurto(
        ultimo[2]
      ),
  };
}

/*
 * ============================================================
 * LINHAS ESTRUTURAIS
 * ============================================================
 */

function ehLinhaEstrutural(
  linha = ""
) {
  const texto =
    normalizarTexto(
      linha
    );

  if (!texto) {
    return true;
  }

  if (
    /^-*\s*(?:PAGINA|PAGE)\s+\d+\s*-*$/.test(
      texto
    )
  ) {
    return true;
  }

  return [
    "INIETTORE",
    "FUEL INJECTOR",
    "B",
    "KW",
    "B KW",
    "TYPE",
    "TYPE TYPE",
    "GROUP C",
    "GRUPPO C",
    "MAGNETI MARELLI",
  ].includes(
    texto
  );
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
      registro.codigo_oem || "",
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
 * CRIAR REGISTRO
 * ============================================================
 */

function criarRegistro({
  codigo,
  montadora,
  modelo,
  linhasAplicacao = [],
  configuracao = {},
  nomeArquivo = "",
  equivalentesExtras = [],
}) {
  const codigoPrincipal =
    normalizarCodigoOriginal(
      codigo
    );

  if (
    !codigoPrincipal ||
    !montadora ||
    !modelo ||
    modeloEhInvalido(
      modelo
    )
  ) {
    return null;
  }

  const aplicacao =
    limparTexto(
      linhasAplicacao.join(
        " "
      )
    );

  if (!aplicacao) {
    return null;
  }

  const periodo =
    extrairPeriodo(
      aplicacao
    );

  const motor =
    extrairMotor(
      aplicacao
    );

  const codigosMotor =
    extrairCodigosMotor(
      linhasAplicacao.join(
        "\n"
      )
    );

  const codigoCompacto =
    normalizarCodigo(
      codigoPrincipal
    );

  const equivalentes =
    [
      codigoPrincipal,
      codigoCompacto,

      ...equivalentesExtras.map(
        normalizarCodigoOriginal
      ),
    ]
      .filter(Boolean);

  const equivalentesUnicos =
    [
      ...new Set(
        equivalentes
      ),
    ];

  return {
    peca:
      "Injetor de Combustível",

    descricao:
      "Injetor de Combustível",

    codigo_oem:
      codigoCompacto,

    codigo_equivalente:
      equivalentesUnicos.join(
        ", "
      ),

    equivalentes:
      equivalentesUnicos,

    fabricante:
      "Magneti Marelli",

    montadora:
      limparTexto(
        montadora
      ),

    modelo:
      limparTexto(
        modelo
      ),

    motor:
      motor || null,

    ano_inicio:
      periodo.ano_inicio,

    ano_fim:
      periodo.ano_fim,

    aplicacao,

    observacao: [
      aplicacao,

      codigosMotor.length
        ? `Códigos motor: ${codigosMotor.join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join(" | "),

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
  };
}

/*
 * ============================================================
 * BUSCAR ALIASES DE UM CÓDIGO
 * ============================================================
 */

function obterAliasesCodigo(
  codigo,
  mapaEquivalencias
) {
  const principal =
    normalizarCodigoOriginal(
      codigo
    );

  const aliases =
    mapaEquivalencias
      ?.principalParaAliases
      ?.get(
        principal
      );

  return aliases
    ? Array.from(
        aliases
      )
    : [];
}

/*
 * ============================================================
 * LEITURA SEQUENCIAL V4
 * ============================================================
 */

function parserSequencial({
  linhas = [],
  configuracao = {},
  nomeArquivo = "",
  mapaEquivalencias,
}) {
  const registros = [];

  let codigoAtual = "";
  let montadoraAtual = "";
  let modeloAtual = "";
  let linhasAplicacao = [];

  function finalizarModelo() {
    const registro =
      criarRegistro({
        codigo:
          codigoAtual,

        montadora:
          montadoraAtual,

        modelo:
          modeloAtual,

        linhasAplicacao,

        configuracao,

        nomeArquivo,

        equivalentesExtras:
          obterAliasesCodigo(
            codigoAtual,
            mapaEquivalencias
          ),
      });

    if (registro) {
      registros.push(
        registro
      );
    }

    linhasAplicacao = [];
  }

  for (
    const linhaOriginal
    of linhas
  ) {
    const linha =
      limparTexto(
        linhaOriginal
      );

    if (!linha) {
      continue;
    }

    /*
     * Código principal IWP/IPM/FEI.
     */

    const codigosLinha =
      extrairTodosCodigosBico(
        linha
      );

    if (
      codigosLinha.length &&
      ehInicioCodigoBico(
        linha
      )
    ) {
      finalizarModelo();

      codigoAtual =
        normalizarCodigoOriginal(
          codigosLinha[
            codigosLinha.length - 1
          ].codigo
        );

      montadoraAtual = "";
      modeloAtual = "";
      linhasAplicacao = [];

      continue;
    }

    /*
     * Código equivalente SMR.
     *
     * Se ele estiver mapeado para um IWP,
     * passa a trabalhar com o IWP principal.
     */

    const equivalentesLinha =
      extrairCodigosEquivalentesMarelli(
        linha
      );

    if (
      equivalentesLinha.length >
      0
    ) {
      let principalEncontrado =
        "";

      for (
        const equivalente
        of equivalentesLinha
      ) {
        const principal =
          mapaEquivalencias
            ?.aliasParaPrincipal
            ?.get(
              normalizarCodigoOriginal(
                equivalente
              )
            );

        if (principal) {
          principalEncontrado =
            principal;

          break;
        }
      }

      if (
        principalEncontrado &&
        principalEncontrado !==
          codigoAtual
      ) {
        finalizarModelo();

        codigoAtual =
          principalEncontrado;

        montadoraAtual = "";
        modeloAtual = "";
        linhasAplicacao = [];

        continue;
      }
    }

    if (!codigoAtual) {
      continue;
    }

    if (
      ehLinhaEstrutural(
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
      finalizarModelo();

      montadoraAtual =
        montadora;

      modeloAtual = "";
      linhasAplicacao = [];

      continue;
    }

    if (!montadoraAtual) {
      continue;
    }

    const modelo =
      extrairModelo(
        linha
      );

    if (modelo) {
      finalizarModelo();

      modeloAtual =
        modelo;

      linhasAplicacao = [];

      continue;
    }

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

  return registros;
}

/*
 * ============================================================
 * CONTINUA NA PARTE 2
 * ============================================================
 */
/*
 * ============================================================
 * LEITURA POR BLOCOS V4
 * ============================================================
 */

function parserPorBlocos({
  texto = "",
  configuracao = {},
  nomeArquivo = "",
  mapaEquivalencias,
}) {
  const registros = [];

  const linhas = String(
    texto || ""
  )
    .split(/\r?\n/)
    .map((linha) =>
      limparTexto(linha)
    );

  const codigosEncontrados =
    new Map();

  /*
   * ==========================================================
   * LOCALIZAR CÓDIGOS PRINCIPAIS
   * ==========================================================
   */

  for (
    let indice = 0;
    indice < linhas.length;
    indice += 1
  ) {
    const linha =
      linhas[indice];

    const codigos =
      extrairTodosCodigosBico(
        linha
      );

    for (
      const item
      of codigos
    ) {
      const codigo =
        normalizarCodigoOriginal(
          item.codigo
        );

      if (!codigo) {
        continue;
      }

      if (
        !codigosEncontrados.has(
          codigo
        )
      ) {
        codigosEncontrados.set(
          codigo,
          []
        );
      }

      codigosEncontrados
        .get(
          codigo
        )
        .push(
          indice
        );
    }
  }

  /*
   * ==========================================================
   * LOCALIZAR ALIASES SMR
   * ==========================================================
   */

  for (
    let indice = 0;
    indice < linhas.length;
    indice += 1
  ) {
    const linha =
      linhas[indice];

    const equivalentes =
      extrairCodigosEquivalentesMarelli(
        linha
      );

    for (
      const equivalente
      of equivalentes
    ) {
      const alias =
        normalizarCodigoOriginal(
          equivalente
        );

      const principal =
        mapaEquivalencias
          ?.aliasParaPrincipal
          ?.get(
            alias
          );

      if (!principal) {
        continue;
      }

      if (
        !codigosEncontrados.has(
          principal
        )
      ) {
        codigosEncontrados.set(
          principal,
          []
        );
      }

      codigosEncontrados
        .get(
          principal
        )
        .push(
          indice
        );
    }
  }

  /*
   * ==========================================================
   * PROCESSAR CADA CÓDIGO
   * ==========================================================
   */

  for (
    const [
      codigo,
      ocorrenciasOriginais,
    ]
    of codigosEncontrados
  ) {
    const ocorrencias = [
      ...new Set(
        ocorrenciasOriginais
      ),
    ].sort(
      (a, b) =>
        a - b
    );

    for (
      const indiceCodigo
      of ocorrencias
    ) {
      const fim =
        Math.min(
          linhas.length,
          indiceCodigo + 180
        );

      let montadoraAtual = "";
      let modeloAtual = "";
      let linhasAplicacao = [];

      function finalizarAplicacao() {
        const registro =
          criarRegistro({
            codigo,

            montadora:
              montadoraAtual,

            modelo:
              modeloAtual,

            linhasAplicacao,

            configuracao,

            nomeArquivo,

            equivalentesExtras:
              obterAliasesCodigo(
                codigo,
                mapaEquivalencias
              ),
          });

        if (registro) {
          registros.push(
            registro
          );
        }

        linhasAplicacao = [];
      }

      for (
        let i = indiceCodigo + 1;
        i < fim;
        i += 1
      ) {
        const linha =
          linhas[i];

        if (!linha) {
          continue;
        }

        /*
         * ====================================================
         * NOVO CÓDIGO PRINCIPAL
         * ====================================================
         */

        const codigosLinha =
          extrairTodosCodigosBico(
            linha
          );

        if (
          codigosLinha.length &&
          ehInicioCodigoBico(
            linha
          )
        ) {
          const principaisLinha =
            codigosLinha.map(
              (item) =>
                normalizarCodigoOriginal(
                  item.codigo
                )
            );

          if (
            principaisLinha.includes(
              codigo
            )
          ) {
            continue;
          }

          finalizarAplicacao();

          break;
        }

        /*
         * ====================================================
         * NOVO ALIAS DE OUTRO CÓDIGO
         * ====================================================
         */

        const aliasesLinha =
          extrairCodigosEquivalentesMarelli(
            linha
          );

        let encontrouOutroPrincipal =
          false;

        for (
          const alias
          of aliasesLinha
        ) {
          const principalAlias =
            mapaEquivalencias
              ?.aliasParaPrincipal
              ?.get(
                normalizarCodigoOriginal(
                  alias
                )
              );

          if (
            principalAlias &&
            principalAlias !==
              codigo
          ) {
            encontrouOutroPrincipal =
              true;

            break;
          }
        }

        if (
          encontrouOutroPrincipal
        ) {
          finalizarAplicacao();

          break;
        }

        if (
          ehLinhaEstrutural(
            linha
          )
        ) {
          continue;
        }

        /*
         * ====================================================
         * MONTADORA
         * ====================================================
         */

        const montadora =
          identificarMontadora(
            linha
          );

        if (montadora) {
          finalizarAplicacao();

          montadoraAtual =
            montadora;

          modeloAtual = "";
          linhasAplicacao = [];

          continue;
        }

        if (!montadoraAtual) {
          continue;
        }

        /*
         * ====================================================
         * MODELO
         * ====================================================
         */

        const modelo =
          extrairModelo(
            linha
          );

        if (modelo) {
          finalizarAplicacao();

          modeloAtual =
            modelo;

          linhasAplicacao = [];

          continue;
        }

        /*
         * ====================================================
         * APLICAÇÃO
         * ====================================================
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

      finalizarAplicacao();
    }
  }

  return removerDuplicados(
    registros
  );
}

/*
 * ============================================================
 * RECUPERAÇÃO DE CÓDIGOS MISTURADOS
 * ============================================================
 */

function recuperarCodigosMisturados({
  texto = "",
  configuracao = {},
  nomeArquivo = "",
  mapaEquivalencias,
}) {
  const registros = [];

  const linhas = String(
    texto || ""
  )
    .split(/\r?\n/)
    .map((linha) =>
      limparTexto(linha)
    );

  for (
    let indice = 0;
    indice < linhas.length;
    indice += 1
  ) {
    const linha =
      linhas[indice];

    const codigos =
      extrairTodosCodigosBico(
        linha
      );

    if (
      codigos.length < 2
    ) {
      continue;
    }

    for (
      const item
      of codigos
    ) {
      const codigo =
        normalizarCodigoOriginal(
          item.codigo
        );

      let montadoraAtual = "";
      let modeloAtual = "";
      let linhasAplicacao = [];

      function finalizar() {
        const registro =
          criarRegistro({
            codigo,

            montadora:
              montadoraAtual,

            modelo:
              modeloAtual,

            linhasAplicacao,

            configuracao,

            nomeArquivo,

            equivalentesExtras:
              obterAliasesCodigo(
                codigo,
                mapaEquivalencias
              ),
          });

        if (registro) {
          registros.push(
            registro
          );
        }

        linhasAplicacao = [];
      }

      const limite =
        Math.min(
          linhas.length,
          indice + 220
        );

      for (
        let i = indice + 1;
        i < limite;
        i += 1
      ) {
        const atual =
          linhas[i];

        if (!atual) {
          continue;
        }

        const novosCodigos =
          extrairTodosCodigosBico(
            atual
          );

        if (
          novosCodigos.length &&
          ehInicioCodigoBico(
            atual
          )
        ) {
          finalizar();

          break;
        }

        if (
          ehLinhaEstrutural(
            atual
          )
        ) {
          continue;
        }

        const montadora =
          identificarMontadora(
            atual
          );

        if (montadora) {
          finalizar();

          montadoraAtual =
            montadora;

          modeloAtual = "";
          linhasAplicacao = [];

          continue;
        }

        if (!montadoraAtual) {
          continue;
        }

        const modelo =
          extrairModelo(
            atual
          );

        if (modelo) {
          finalizar();

          modeloAtual =
            modelo;

          linhasAplicacao = [];

          continue;
        }

        if (
          montadoraAtual &&
          modeloAtual
        ) {
          linhasAplicacao.push(
            atual
          );
        }
      }

      finalizar();
    }
  }

  return removerDuplicados(
    registros
  );
}

/*
 * ============================================================
 * RECUPERAÇÃO POR ALIAS SMR
 * ============================================================
 *
 * Este é o método novo.
 *
 * Exemplo:
 *
 * IWP099
 * SMR00102Y
 *
 * Se a aplicação estiver próxima do SMR00102Y,
 * recuperamos os veículos para o IWP099.
 * ============================================================
 */

function recuperarAplicacoesPorAlias({
  texto = "",
  configuracao = {},
  nomeArquivo = "",
  mapaEquivalencias,
}) {
  const registros = [];

  const linhas = String(
    texto || ""
  )
    .split(/\r?\n/)
    .map((linha) =>
      limparTexto(linha)
    );

  const aliases =
    mapaEquivalencias
      ?.aliasParaPrincipal;

  if (
    !aliases ||
    aliases.size === 0
  ) {
    return [];
  }

  for (
    let indice = 0;
    indice < linhas.length;
    indice += 1
  ) {
    const linha =
      linhas[indice];

    const equivalentes =
      extrairCodigosEquivalentesMarelli(
        linha
      );

    if (
      equivalentes.length ===
      0
    ) {
      continue;
    }

    for (
      const equivalente
      of equivalentes
    ) {
      const alias =
        normalizarCodigoOriginal(
          equivalente
        );

      const codigoPrincipal =
        aliases.get(
          alias
        );

      if (!codigoPrincipal) {
        continue;
      }

      let montadoraAtual = "";
      let modeloAtual = "";
      let linhasAplicacao = [];

      function finalizar() {
        const registro =
          criarRegistro({
            codigo:
              codigoPrincipal,

            montadora:
              montadoraAtual,

            modelo:
              modeloAtual,

            linhasAplicacao,

            configuracao,

            nomeArquivo,

            equivalentesExtras: [
              alias,
              ...obterAliasesCodigo(
                codigoPrincipal,
                mapaEquivalencias
              ),
            ],
          });

        if (registro) {
          registros.push(
            registro
          );
        }

        linhasAplicacao = [];
      }

      /*
       * Primeiro olhamos um pouco ANTES do alias.
       *
       * Em PDF com colunas misturadas, a montadora
       * ou o nome do veículo pode cair acima do código.
       */

      const inicioAnterior =
        Math.max(
          0,
          indice - 40
        );

      for (
        let i = inicioAnterior;
        i < indice;
        i += 1
      ) {
        const anterior =
          linhas[i];

        if (!anterior) {
          continue;
        }

        const montadora =
          identificarMontadora(
            anterior
          );

        if (montadora) {
          montadoraAtual =
            montadora;

          modeloAtual = "";

          continue;
        }

        if (
          montadoraAtual
        ) {
          const modelo =
            extrairModelo(
              anterior
            );

          if (modelo) {
            modeloAtual =
              modelo;
          }
        }
      }

      /*
       * Depois percorremos abaixo do alias.
       */

      const limite =
        Math.min(
          linhas.length,
          indice + 260
        );

      for (
        let i = indice + 1;
        i < limite;
        i += 1
      ) {
        const atual =
          linhas[i];

        if (!atual) {
          continue;
        }

        /*
         * Outro IWP/IPM/FEI forte encerra o bloco.
         */

        const codigos =
          extrairTodosCodigosBico(
            atual
          );

        if (
          codigos.length &&
          ehInicioCodigoBico(
            atual
          )
        ) {
          const possuiMesmoCodigo =
            codigos.some(
              (item) =>
                normalizarCodigoOriginal(
                  item.codigo
                ) ===
                codigoPrincipal
            );

          if (
            possuiMesmoCodigo
          ) {
            continue;
          }

          finalizar();

          break;
        }

        /*
         * Alias de outro principal também encerra.
         */

        const aliasesAtuais =
          extrairCodigosEquivalentesMarelli(
            atual
          );

        let outroPrincipal =
          false;

        for (
          const outroAlias
          of aliasesAtuais
        ) {
          const principal =
            aliases.get(
              normalizarCodigoOriginal(
                outroAlias
              )
            );

          if (
            principal &&
            principal !==
              codigoPrincipal
          ) {
            outroPrincipal =
              true;

            break;
          }
        }

        if (outroPrincipal) {
          finalizar();

          break;
        }

        if (
          ehLinhaEstrutural(
            atual
          )
        ) {
          continue;
        }

        const montadora =
          identificarMontadora(
            atual
          );

        if (montadora) {
          finalizar();

          montadoraAtual =
            montadora;

          modeloAtual = "";
          linhasAplicacao = [];

          continue;
        }

        if (!montadoraAtual) {
          continue;
        }

        const modelo =
          extrairModelo(
            atual
          );

        if (modelo) {
          finalizar();

          modeloAtual =
            modelo;

          linhasAplicacao = [];

          continue;
        }

        if (
          montadoraAtual &&
          modeloAtual
        ) {
          linhasAplicacao.push(
            atual
          );
        }
      }

      finalizar();
    }
  }

  return removerDuplicados(
    registros
  );
}

/*
 * ============================================================
 * LIMPEZA FINAL
 * ============================================================
 */

function limparRegistrosFinais(
  registros = []
) {
  return registros
    .filter(Boolean)
    .filter(
      (registro) =>
        !modeloEhInvalido(
          registro.modelo
        )
    )
    .filter(
      (registro) =>
        Boolean(
          registro.montadora
        )
    )
    .filter(
      (registro) =>
        Boolean(
          registro.modelo
        )
    )
    .map(
      (registro) => ({
        ...registro,

        modelo:
          limparTexto(
            registro.modelo
          ),

        montadora:
          limparTexto(
            registro.montadora
          ),

        motor:
          registro.motor
            ? limparTexto(
                registro.motor
              )
            : null,
      })
    );
}

/*
 * ============================================================
 * PARSER PRINCIPAL V4
 * ============================================================
 */

export async function parserMagnetiMarelliBicos2016({
  textoReferencias = "",
  textoAplicacoes = "",
  textoEquivalencias = "",
  nomeArquivo = "",
  configuracao = {},
  onProgresso,
} = {}) {
  onProgresso?.(
    "💉 Interpretando bicos Magneti Marelli 2016 V4..."
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
      "⚠️ MARELLI BICOS 2016: nenhum texto recebido."
    );

    return [];
  }

  const linhas =
    textoCompleto
      .split(/\r?\n/)
      .map((linha) =>
        limparTexto(
          linha
        )
      )
      .filter(Boolean);

  /*
   * ==========================================================
   * MAPA DE EQUIVALÊNCIAS
   * ==========================================================
   */

  const mapaEquivalencias =
    construirMapaEquivalencias(
      linhas
    );

  console.log(
    "======================================"
  );

  console.log(
    "💉 PARSER BICOS MARELLI 2016 V4"
  );

  console.log(
    "LINHAS:",
    linhas.length
  );

  console.log(
    "🔗 ALIASES MARELLI:",
    mapaEquivalencias
      .aliasParaPrincipal
      .size
  );

  /*
   * ==========================================================
   * DIAGNÓSTICO ESPECÍFICO IWP099
   * ==========================================================
   */

  const aliasesIWP099 =
    obterAliasesCodigo(
      "IWP099",
      mapaEquivalencias
    );

  console.log(
    "🎯 IWP099 ALIASES:",
    aliasesIWP099
  );

  console.log(
    "🎯 SMR00102Y ->",
    mapaEquivalencias
      .aliasParaPrincipal
      .get(
        "SMR00102Y"
      ) ||
      "NÃO MAPEADO"
  );

  /*
   * ==========================================================
   * MÉTODO 1 — SEQUENCIAL
   * ==========================================================
   */

  const registrosSequenciais =
    parserSequencial({
      linhas,

      configuracao,

      nomeArquivo,

      mapaEquivalencias,
    });

  console.log(
    "💉 SEQUENCIAL:",
    registrosSequenciais.length
  );

  /*
   * ==========================================================
   * MÉTODO 2 — BLOCOS
   * ==========================================================
   */

  const registrosBlocos =
    parserPorBlocos({
      texto:
        textoCompleto,

      configuracao,

      nomeArquivo,

      mapaEquivalencias,
    });

  console.log(
    "💉 BLOCOS:",
    registrosBlocos.length
  );

  /*
   * ==========================================================
   * MÉTODO 3 — CÓDIGOS MISTURADOS
   * ==========================================================
   */

  const registrosMisturados =
    recuperarCodigosMisturados({
      texto:
        textoCompleto,

      configuracao,

      nomeArquivo,

      mapaEquivalencias,
    });

  console.log(
    "💉 MISTURADOS:",
    registrosMisturados.length
  );

  /*
   * ==========================================================
   * MÉTODO 4 — ALIAS SMR
   * ==========================================================
   */

  const registrosAlias =
    recuperarAplicacoesPorAlias({
      texto:
        textoCompleto,

      configuracao,

      nomeArquivo,

      mapaEquivalencias,
    });

  console.log(
    "🔗 POR ALIAS SMR:",
    registrosAlias.length
  );

  /*
   * ==========================================================
   * CONSOLIDAÇÃO
   * ==========================================================
   */

  const registrosAntesLimpeza =
    removerDuplicados([
      ...registrosSequenciais,
      ...registrosBlocos,
      ...registrosMisturados,
      ...registrosAlias,
    ]);

  const registros =
    removerDuplicados(
      limparRegistrosFinais(
        registrosAntesLimpeza
      )
    );

  console.log(
    "💉 ANTES DA LIMPEZA:",
    registrosAntesLimpeza.length
  );

  console.log(
    "💉 TOTAL ÚNICO:",
    registros.length
  );

  /*
   * ==========================================================
   * IWP099 FINAL
   * ==========================================================
   */

  const diagnosticoIWP099 =
    registros.filter(
      (registro) =>
        normalizarCodigo(
          registro.codigo_oem
        ) ===
        "IWP099"
    );

  console.log(
    "======================================"
  );

  console.log(
    "🎯 IWP099 REGISTROS V4:",
    diagnosticoIWP099.length
  );

  console.log(
    "🎯 IWP099 APLICAÇÕES V4:",
    diagnosticoIWP099
  );

  console.log(
    "======================================"
  );

  /*
   * ==========================================================
   * DIAGNÓSTICO DOS MODELOS
   * ==========================================================
   */

  const modelosInvalidos =
    registrosAntesLimpeza.filter(
      (registro) =>
        modeloEhInvalido(
          registro?.modelo
        )
    );

  console.log(
    "🚫 MODELOS INVÁLIDOS REMOVIDOS:",
    modelosInvalidos.length
  );

  /*
   * ==========================================================
   * CÓDIGOS ÚNICOS
   * ==========================================================
   */

  const codigosUnicos =
    new Set(
      registros
        .map(
          (registro) =>
            normalizarCodigo(
              registro.codigo_oem
            )
        )
        .filter(Boolean)
    );

  console.log(
    "💉 CÓDIGOS ÚNICOS:",
    codigosUnicos.size
  );

  console.log(
    "💉 REGISTROS FINAIS:",
    registros.length
  );

  onProgresso?.(
    `💉 Bicos Marelli 2016: ${registros.length} aplicação(ões) interpretada(s).`
  );

  return registros;
}

export default parserMagnetiMarelliBicos2016;