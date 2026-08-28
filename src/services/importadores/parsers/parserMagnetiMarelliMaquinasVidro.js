/*
 * ============================================================
 * MAGNETI MARELLI
 * MÁQUINAS DE VIDRO
 * Electric Window Lifters 2021
 * ============================================================
 *
 * Estrutura do catálogo:
 *
 * - SHORT -> LONG
 * - Aplicações por marca e veículo
 * - Buyers Guide
 * - Equivalências OES
 *
 * ============================================================
 */

function texto(valor = "") {
  return String(
    valor ?? ""
  )
    .replace(/\s+/g, " ")
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

function limparLinha(valor = "") {
  return texto(valor)
    .replace(
      /^[•·▪■►▶]+/,
      ""
    )
    .trim();
}

/*
 * ============================================================
 * CÓDIGOS
 * ============================================================
 */

function extrairCodigoCurto(
  valor = ""
) {
  const linha =
    normalizar(valor);

  const match =
    linha.match(
      /\b([A-Z]{1,4}\d{3,5}(?:\/[A-Z0-9]+)?)\b/
    );

  return match
    ? match[1]
    : null;
}

function extrairCodigoLongo(
  valor = ""
) {
  const linha =
    normalizar(valor)
      .replace(
        /\s+/g,
        ""
      );

  const match =
    linha.match(
      /(350103\d{6,9})/
    );

  return match
    ? match[1]
    : null;
}

/*
 * ============================================================
 * MONTADORAS
 * ============================================================
 */

const MONTADORAS = [
  "ABARTH",
  "ALFA ROMEO",
  "ALPINA",
  "ASTRA",
  "AUDI",
  "BMW",
  "CHERY",
  "CHEVROLET",
  "CHRYSLER",
  "CITROEN",
  "DACIA",
  "DAEWOO",
  "DAF",
  "DODGE",
  "FIAT",
  "FORD",
  "HOLDEN",
  "HONDA",
  "HUMMER",
  "HYUNDAI",
  "ISUZU",
  "IVECO",
  "JAGUAR",
  "JEEP",
  "KIA",
  "LANCIA",
  "LAND ROVER",
  "MAN",
  "MAZDA",
  "MERCEDES",
  "MERCEDES-BENZ",
  "MINI",
  "MITSUBISHI",
  "NISSAN",
  "OPEL",
  "PEUGEOT",
  "PIAGGIO",
  "PORSCHE",
  "PUCH",
  "RENAULT",
  "RENAULT TRUCKS",
  "ROVER",
  "SAAB",
  "SCANIA",
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

function ehMontadora(
  valor = ""
) {
  return MONTADORAS.includes(
    normalizar(valor)
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
    !Number.isFinite(numero)
  ) {
    return null;
  }

  return numero >= 70
    ? 1900 + numero
    : 2000 + numero;
}

function extrairAnos(
  valor = ""
) {
  const linha =
    normalizar(valor);

  const anos = [];

  for (
    const match
    of linha.matchAll(
      /\b(19\d{2}|20\d{2})\b/g
    )
  ) {
    anos.push(
      Number(match[1])
    );
  }

  for (
    const match
    of linha.matchAll(
      /\b(?:0?[1-9]|1[0-2])\/(\d{2})\b/g
    )
  ) {
    const ano =
      converterAnoCurto(
        match[1]
      );

    if (ano) {
      anos.push(ano);
    }
  }

  const unicos = [
    ...new Set(anos),
  ];

  if (
    unicos.length === 0
  ) {
    return {
      ano_inicio: null,
      ano_fim: null,
    };
  }

  return {
    ano_inicio:
      Math.min(
        ...unicos
      ),

    ano_fim:
      Math.max(
        ...unicos
      ),
  };
}

function combinarAnos(
  atual,
  novo
) {
  const valores = [
    atual?.ano_inicio,
    atual?.ano_fim,
    novo?.ano_inicio,
    novo?.ano_fim,
  ].filter(
    Number.isFinite
  );

  if (
    valores.length === 0
  ) {
    return {
      ano_inicio: null,
      ano_fim: null,
    };
  }

  return {
    ano_inicio:
      Math.min(
        ...valores
      ),

    ano_fim:
      Math.max(
        ...valores
      ),
  };
}

function pareceLinhaAno(
  valor = ""
) {
  const linha =
    normalizar(valor);

  return (
    /\b(?:0?[1-9]|1[0-2])\/\d{2}\b/.test(
      linha
    ) ||
    /\b(?:19\d{2}|20\d{2})\b/.test(
      linha
    )
  );
}

/*
 * ============================================================
 * TIPO
 * ============================================================
 */

function identificarTipo(
  valor = ""
) {
  const linha =
    normalizar(valor);

  if (
    linha.includes(
      "WITHOUT MOTOR"
    ) ||
    linha.includes(
      "NO MOTOR"
    ) ||
    linha.includes(
      "W/O MOTOR"
    )
  ) {
    return "Máquina de Vidro sem Motor";
  }

  if (
    linha.includes(
      "WITH MOTOR"
    ) ||
    linha.includes(
      "W/ MOTOR"
    )
  ) {
    return "Máquina de Vidro com Motor";
  }

  if (
    linha.includes(
      "MANUAL"
    )
  ) {
    return "Máquina de Vidro Manual";
  }

  if (
    linha.includes(
      "ELECTRIC"
    )
  ) {
    return "Máquina de Vidro Elétrica";
  }

  return "Máquina de Vidro";
}

/*
 * ============================================================
 * POSIÇÃO
 * ============================================================
 */

function identificarPosicao(
  valor = ""
) {
  const linha =
    normalizar(valor);

  let posicao = null;
  let lado = null;

  if (
    linha.includes(
      "FRONT"
    ) ||
    linha.includes(
      "ANTERIOR"
    ) ||
    linha.includes(
      "DIANTEIRO"
    )
  ) {
    posicao =
      "Dianteira";
  }

  if (
    linha.includes(
      "REAR"
    ) ||
    linha.includes(
      "POSTERIOR"
    ) ||
    linha.includes(
      "TRASEIRO"
    )
  ) {
    posicao =
      "Traseira";
  }

  if (
    linha.includes(
      "LEFT"
    ) ||
    linha.includes(
      "ESQUERD"
    ) ||
    /\bLH\b/.test(
      linha
    ) ||
    /\bSX\b/.test(
      linha
    )
  ) {
    lado =
      "Esquerda";
  }

  if (
    linha.includes(
      "RIGHT"
    ) ||
    linha.includes(
      "DIREIT"
    ) ||
    /\bRH\b/.test(
      linha
    ) ||
    /\bDX\b/.test(
      linha
    )
  ) {
    lado =
      "Direita";
  }

  return {
    posicao,
    lado,
  };
}

/*
 * ============================================================
 * CABEÇALHOS / LIXO
 * ============================================================
 */

function ehCabecalho(
  valor = ""
) {
  const linha =
    normalizar(valor);

  const termos = [
    "MAGNETI MARELLI",
    "PARTS & SERVICES",
    "WINDOW LIFTER",
    "WINDOW LIFTERS",
    "VEHICLE APPLICATION GUIDE",
    "BUYERS GUIDE",
    "CROSS REFERENCE",
    "APPLICATION",
    "APPLICATIONS",
    "MAKE AND MODEL",
    "MANUFACTURERS INDEX",
    "CONTENTS",
    "LEGEND",
    "SHORT",
    "LONG",
    "OES",
  ];

  return termos.some(
    (termo) =>
      linha === termo ||
      linha.includes(
        termo
      )
  );
}

function ehResiduoGrafico(
  valor = ""
) {
  const linha =
    normalizar(valor);

  if (!linha) {
    return true;
  }

  if (
    /^[A-HJ]$/.test(
      linha
    )
  ) {
    return true;
  }

  if (
    /^(A|B|C|2C)$/.test(
      linha
    )
  ) {
    return true;
  }

  if (
    /^\d{1,3}$/.test(
      linha
    )
  ) {
    return true;
  }

  return false;
}

/*
 * ============================================================
 * SHORT -> LONG
 * ============================================================
 */

function montarMapaCodigos(
  blocos = []
) {
  const mapa =
    new Map();

  const linhas =
    blocos
      .filter(Boolean)
      .join("\n")
      .split(/\r?\n/)
      .map(
        limparLinha
      )
      .filter(Boolean);

  let ultimoCurto =
    null;

  for (
    let i = 0;
    i < linhas.length;
    i++
  ) {
    const linha =
      linhas[i];

    const curto =
      extrairCodigoCurto(
        linha
      );

    const longo =
      extrairCodigoLongo(
        linha
      );

    /*
     * AC383 350103383000
     */

    if (
      curto &&
      longo
    ) {
      mapa.set(
        curto,
        longo
      );

      ultimoCurto =
        null;

      continue;
    }

    /*
     * AC383
     */

    if (
      curto &&
      !longo
    ) {
      ultimoCurto =
        curto;

      for (
        let j = i + 1;
        j <=
          Math.min(
            i + 3,
            linhas.length - 1
          );
        j++
      ) {
        const longoDepois =
          extrairCodigoLongo(
            linhas[j]
          );

        if (
          longoDepois
        ) {
          mapa.set(
            curto,
            longoDepois
          );

          break;
        }
      }

      continue;
    }

    /*
     * 350103383000
     */

    if (
      longo &&
      ultimoCurto
    ) {
      if (
        !mapa.has(
          ultimoCurto
        )
      ) {
        mapa.set(
          ultimoCurto,
          longo
        );
      }

      ultimoCurto =
        null;
    }
  }

  return mapa;
}

/*
 * ============================================================
 * OES
 * ============================================================
 */

function adicionarOes(
  mapa,
  codigo,
  valor
) {
  if (
    !codigo ||
    !valor
  ) {
    return;
  }

  const oes =
    normalizar(valor)
      .replace(
        /[^A-Z0-9]/g,
        ""
      );

  if (
    oes.length < 5 ||
    oes === codigo ||
    oes.startsWith(
      "350103"
    )
  ) {
    return;
  }

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
      oes
    );
}

function montarMapaOes(
  blocos = []
) {
  const mapa =
    new Map();

  const linhas =
    blocos
      .filter(Boolean)
      .join("\n")
      .split(/\r?\n/)
      .map(
        limparLinha
      )
      .filter(Boolean);

  for (
    let i = 0;
    i < linhas.length;
    i++
  ) {
    const linha =
      linhas[i];

    const codigo =
      extrairCodigoCurto(
        linha
      );

    if (
      !codigo
    ) {
      continue;
    }

    /*
     * Mesma linha:
     *
     * 8340257B00 AC383 350103383000
     */

    const tokens =
      normalizar(
        linha
      )
        .replace(
          /[^A-Z0-9/]/g,
          " "
        )
        .split(/\s+/)
        .filter(Boolean);

    for (
      const token
      of tokens
    ) {
      if (
        token === codigo ||
        token.startsWith(
          "350103"
        )
      ) {
        continue;
      }

      if (
        token.length >= 5 &&
        /\d/.test(
          token
        )
      ) {
        adicionarOes(
          mapa,
          codigo,
          token
        );
      }
    }

    /*
     * Linha anterior pode ser OES
     */

    if (
      i > 0
    ) {
      const anterior =
        normalizar(
          linhas[
            i - 1
          ]
        ).replace(
          /[^A-Z0-9]/g,
          ""
        );

      if (
        anterior.length >= 5 &&
        /\d/.test(
          anterior
        ) &&
        !anterior.startsWith(
          "350103"
        ) &&
        !extrairCodigoCurto(
          anterior
        )
      ) {
        adicionarOes(
          mapa,
          codigo,
          anterior
        );
      }
    }

    /*
     * Próximas linhas
     */

    for (
      let j = i + 1;
      j <=
        Math.min(
          i + 8,
          linhas.length - 1
        );
      j++
    ) {
      const proxima =
        linhas[j];

      const outroCodigo =
        extrairCodigoCurto(
          proxima
        );

      if (
        outroCodigo &&
        outroCodigo !==
          codigo
      ) {
        break;
      }

      if (
        ehMontadora(
          proxima
        )
      ) {
        break;
      }

      const tokensProximos =
        normalizar(
          proxima
        )
          .replace(
            /[^A-Z0-9]/g,
            " "
          )
          .split(/\s+/)
          .filter(Boolean);

      for (
        const token
        of tokensProximos
      ) {
        if (
          token.length >= 5 &&
          /\d/.test(
            token
          ) &&
          !token.startsWith(
            "350103"
          )
        ) {
          adicionarOes(
            mapa,
            codigo,
            token
          );
        }
      }
    }
  }

  return mapa;
}

/*
 * ============================================================
 * MODELO VÁLIDO
 * ============================================================
 */

function ehModeloValido(
  valor = ""
) {
  const linha =
    normalizar(valor);

  if (
    !linha ||
    linha.length < 2
  ) {
    return false;
  }

  if (
    ehCabecalho(
      linha
    ) ||
    ehMontadora(
      linha
    ) ||
    ehResiduoGrafico(
      linha
    ) ||
    pareceLinhaAno(
      linha
    )
  ) {
    return false;
  }

  if (
    extrairCodigoCurto(
      linha
    ) ||
    extrairCodigoLongo(
      linha
    )
  ) {
    return false;
  }

  const letras =
    linha.match(
      /[A-Z]/g
    ) || [];

  return (
    letras.length >= 2
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
    const chave = [
      registro.codigo_oem,
      registro.codigo_equivalente,
      registro.montadora,
      registro.modelo,
      registro.ano_inicio,
      registro.ano_fim,
      registro.observacao,
    ]
      .map(
        (item) =>
          normalizar(
            item || ""
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

export async function parserMagnetiMarelliMaquinasVidro({
  textoReferencias = "",
  textoAplicacoes = "",
  textoEquivalencias = "",
  nomeArquivo = "",
  configuracao = {},
  onProgresso,
} = {}) {
  onProgresso?.(
    "🪟 Lendo Magneti Marelli Máquinas de Vidro..."
  );

  const mapaCodigos =
    montarMapaCodigos([
      textoReferencias,
      textoAplicacoes,
      textoEquivalencias,
    ]);

  const mapaOes =
    montarMapaOes([
      textoAplicacoes,
      textoEquivalencias,
    ]);

  /*
   * Aplicações:
   * usamos somente textoAplicacoes.
   */

  const linhas =
    textoAplicacoes
      .split(/\r?\n/)
      .map(
        limparLinha
      )
      .filter(Boolean);

  console.log(
    "🪟 SHORT → LONG:",
    mapaCodigos.size
  );

  console.log(
    "🪟 CÓDIGOS COM OES:",
    mapaOes.size
  );

  const registros = [];

  let montadoraAtual =
    null;

  let modeloAtual =
    null;

  let anosAtuais = {
    ano_inicio: null,
    ano_fim: null,
  };

  let tipoAtual =
    "Máquina de Vidro";

  let posicaoAtual =
    null;

  let ladoAtual =
    null;

  for (
    let i = 0;
    i < linhas.length;
    i++
  ) {
    const linhaOriginal =
      linhas[i];

    const linha =
      normalizar(
        linhaOriginal
      );

    /*
     * ======================================================
     * MONTADORA
     * ======================================================
     */

    if (
      ehMontadora(
        linha
      )
    ) {
      montadoraAtual =
        texto(
          linhaOriginal
        );

      modeloAtual =
        null;

      anosAtuais = {
        ano_inicio: null,
        ano_fim: null,
      };

      tipoAtual =
        "Máquina de Vidro";

      posicaoAtual =
        null;

      ladoAtual =
        null;

      continue;
    }

    if (
      !montadoraAtual
    ) {
      continue;
    }

    /*
     * ======================================================
     * TIPO
     * ======================================================
     */

    const tipoDetectado =
      identificarTipo(
        linhaOriginal
      );

    if (
      tipoDetectado !==
      "Máquina de Vidro"
    ) {
      tipoAtual =
        tipoDetectado;
    }

    /*
     * ======================================================
     * POSIÇÃO
     * ======================================================
     */

    const posicao =
      identificarPosicao(
        linhaOriginal
      );

    if (
      posicao.posicao
    ) {
      posicaoAtual =
        posicao.posicao;
    }

    if (
      posicao.lado
    ) {
      ladoAtual =
        posicao.lado;
    }

    /*
     * ======================================================
     * ANOS
     * ======================================================
     */

    if (
      pareceLinhaAno(
        linhaOriginal
      )
    ) {
      anosAtuais =
        combinarAnos(
          anosAtuais,
          extrairAnos(
            linhaOriginal
          )
        );
    }

    /*
     * ======================================================
     * CÓDIGO
     *
     * Aceita:
     *
     * AC383
     *
     * j AC383
     *
     * j à12/94 AC383
     * ======================================================
     */

    const codigoAtual =
      extrairCodigoCurto(
        linhaOriginal
      );

    if (
      codigoAtual &&
      modeloAtual
    ) {
      let codigoLongo =
        mapaCodigos.get(
          codigoAtual
        ) || null;

      /*
       * LONG na mesma linha
       */

      const longoNaLinha =
        extrairCodigoLongo(
          linhaOriginal
        );

      if (
        longoNaLinha
      ) {
        codigoLongo =
          longoNaLinha;
      }

      /*
       * LONG nas linhas seguintes
       */

      if (
        !codigoLongo
      ) {
        for (
          let j = i + 1;
          j <=
            Math.min(
              i + 4,
              linhas.length - 1
            );
          j++
        ) {
          const proxima =
            linhas[j];

          const outroCodigo =
            extrairCodigoCurto(
              proxima
            );

          if (
            outroCodigo &&
            outroCodigo !==
              codigoAtual
          ) {
            break;
          }

          const longo =
            extrairCodigoLongo(
              proxima
            );

          if (
            longo
          ) {
            codigoLongo =
              longo;

            mapaCodigos.set(
              codigoAtual,
              longo
            );

            break;
          }
        }
      }

      const anosRegistro =
        combinarAnos(
          anosAtuais,
          extrairAnos(
            linhaOriginal
          )
        );

      const equivalentes =
        mapaOes.has(
          codigoAtual
        )
          ? [
              ...mapaOes.get(
                codigoAtual
              ),
            ]
          : [];

      const observacoes = [
        `Código Magneti Marelli: ${codigoAtual}`,
      ];

      if (
        codigoLongo
      ) {
        observacoes.push(
          `Código longo Magneti Marelli: ${codigoLongo}`
        );
      }

      if (
        equivalentes.length > 0
      ) {
        observacoes.push(
          `OES: ${equivalentes.join(", ")}`
        );
      }

      if (
        posicaoAtual
      ) {
        observacoes.push(
          `Posição: ${posicaoAtual}`
        );
      }

      if (
        ladoAtual
      ) {
        observacoes.push(
          `Lado: ${ladoAtual}`
        );
      }

      observacoes.push(
        `Aplicação catálogo: ${montadoraAtual} ${modeloAtual}`
      );

      registros.push({
        peca:
          "Máquina de Vidro",

        codigo_oem:
          codigoAtual,

        codigo_equivalente:
          codigoLongo,

        equivalentes,

        fabricante:
          "Magneti Marelli",

        origem_catalogo:
          "Catálogo Magneti Marelli Electric Window Lifters 2021",

        familia_catalogo:
          "Máquinas de Vidro",

        categoria:
          "Carroceria",

        subcategoria:
          "Máquinas de Vidro",

        sistema:
          "Vidros",

        tipo:
          tipoAtual,

        montadora:
          montadoraAtual,

        modelo:
          modeloAtual,

        motor:
          null,

        ano_inicio:
          anosRegistro.ano_inicio,

        ano_fim:
          anosRegistro.ano_fim,

        observacao:
          observacoes.join(
            " | "
          ),

        arquivo_catalogo:
          nomeArquivo ||
          null,

        ativo:
          true,

        prioridade:
          1,

        confiabilidade:
          100,
      });

      continue;
    }

    /*
     * ======================================================
     * IGNORAR LIXO
     * ======================================================
     */

    if (
      ehCabecalho(
        linhaOriginal
      ) ||
      ehResiduoGrafico(
        linhaOriginal
      )
    ) {
      continue;
    }

    if (
      extrairCodigoLongo(
        linhaOriginal
      )
    ) {
      continue;
    }

    /*
     * ======================================================
     * MODELO
     * ======================================================
     */

    if (
      ehModeloValido(
        linhaOriginal
      )
    ) {
      modeloAtual =
        texto(
          linhaOriginal
        );

      anosAtuais = {
        ano_inicio: null,
        ano_fim: null,
      };

      tipoAtual =
        "Máquina de Vidro";

      posicaoAtual =
        null;

      ladoAtual =
        null;
    }
  }

  const resultado =
    removerDuplicados(
      registros
    );

  /*
   * ========================================================
   * DIAGNÓSTICOS
   * ========================================================
   */

  for (
    const codigo
    of [
      "AC001/A",
      "AC383",
      "AC1636",
    ]
  ) {
    console.log(
      `🎯 ${codigo}:`,
      {
        longo:
          mapaCodigos.get(
            codigo
          ) || null,

        oes:
          mapaOes.has(
            codigo
          )
            ? [
                ...mapaOes.get(
                  codigo
                ),
              ]
            : [],

        registros:
          resultado.filter(
            (item) =>
              normalizar(
                item.codigo_oem
              ) ===
              normalizar(
                codigo
              )
          ),
      }
    );
  }

  console.log(
    "🪟 MARELLI MÁQUINAS DE VIDRO:",
    resultado.length,
    "registro(s)"
  );

  onProgresso?.(
    `✅ Máquinas de Vidro Magneti Marelli: ${resultado.length} registro(s).`
  );

  return resultado;
}

export default
  parserMagnetiMarelliMaquinasVidro;