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
  "ALPINA",
  "AUDI",
  "AUTOBIANCHI",
  "BENTLEY",
  "BMW",
  "CADILLAC",
  "CHEVROLET",
  "CHRYSLER",
  "CITROEN",
  "CITROËN",
  "DACIA",
  "DAEWOO",
  "DAIHATSU",
  "DODGE",
  "FERRARI",
  "FIAT",
  "FORD",
  "HONDA",
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
  "LEXUS",
  "MARUTI",
  "MASERATI",
  "MAZDA",
  "MERCEDES-BENZ",
  "MERCEDES BENZ",
  "MG",
  "MINI",
  "MITSUBISHI",
  "NISSAN",
  "OPEL",
  "PEUGEOT",
  "PORSCHE",
  "PROTON",
  "RENAULT",
  "ROLLS-ROYCE",
  "ROVER",
  "SAAB",
  "SEAT",
  "SKODA",
  "SMART",
  "SSANGYONG",
  "SUBARU",
  "SUZUKI",
  "TOYOTA",
  "VAUXHALL",
  "VOLKSWAGEN",
  "VOLVO",
];

function identificarMontadora(linha = "") {
  const texto = normalizarTexto(linha);

  for (const montadora of MONTADORAS) {
    const alvo =
      normalizarTexto(montadora);

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
 * CÓDIGOS SENSOR MAP
 * ============================================================
 *
 * Catálogo Marelli 2016:
 *
 * APSxxx
 * PRTxxx
 * KITLDF6T
 * KITTPRT05/2
 *
 * SPSxxx NÃO entra aqui.
 * SPS = sensor pressão escapamento.
 * ============================================================
 */

function extrairTodosCodigosMap(
  texto = ""
) {
  const original =
    String(texto || "");

  const encontrados = [
    ...original.matchAll(
      /\b(?:APS[A-Z0-9./-]*|PRT[A-Z0-9./-]*|KITLDF6T|KITTPRT05\/?2)\b/gi
    ),
  ];

  return encontrados.map(
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

function extrairCodigoMap(
  linha = ""
) {
  return (
    extrairTodosCodigosMap(
      linha
    )[0]?.codigo ||
    ""
  );
}

function ehInicioCodigoMap(
  linha = ""
) {
  const texto =
    limparTexto(
      linha
    ).toUpperCase();

  const codigos =
    extrairTodosCodigosMap(
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
    /\b(?:PETROL|DIESEL|BENZINA|GASOLINE|ENGINE|KW|HP|CV)\b/i.test(
      texto
    )
  ) {
    return false;
  }

  return texto.length <= 140;
}

/*
 * ============================================================
 * MODELO
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
      "GROUP D",
      "GRUPPO D",
      "PETROL",
      "DIESEL",
      "BENZINA",
      "GASOLINE",
      "KW",
      "B KW",
      "DESCRIPTION",
      "MAP SENSOR",
      "SENSORE PRESSIONE ASSOLUTA",
      "SENSOR PRESSIONE ASSOLUTA",
      "SENSOR PRESSAO ABSOLUTA",
    ].includes(
      normalizado
    )
  ) {
    return true;
  }

  if (
    /^[A-Z]{1,4}\d{1,4}_?$/i.test(
      texto
    )
  ) {
    return true;
  }

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
    extrairTodosCodigosMap(
      texto
    ).length > 0
  ) {
    return "";
  }

  const comPlataforma =
    texto.match(
      /^(.+?)\s*\(([^)]*)\)\s*(.*)$/
    );

  if (comPlataforma) {
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

  if (
    modeloEhInvalido(
      texto
    )
  ) {
    return "";
  }

  if (
    texto.length < 2 ||
    texto.length > 70
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

  if (
    /\b(?:SENSOR|SENSORE|PRESSURE|PRESSIONE|MAP|MAGNETI|MARELLI|REFERENCE|CODICE|CODE|TYPE|GROUP|OES?)\b/i.test(
      texto
    )
  ) {
    return "";
  }

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
      /\b(?:\d[.,]\d|[789]\d{2}|1\d{3}|2\d{3})(?:\s+(?:6V|8V|12V|16V|20V|24V))?(?:\s+(?:TURBO|JTD|JTDM|TDI|HDI|TSI|TFSI|MPI|CDI|DCI))?/i
    )?.[0] || "";

  return limparTexto(
    encontrado
  );
}

function extrairCodigosMotor(
  texto = ""
) {
  const encontrados = [
    ...String(
      texto || ""
    ).matchAll(
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

  if (!encontrados.length) {
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
      converterAnoCurto(
        ultimo[2]
      ),
  };
}

/*
 * ============================================================
 * OE
 * ============================================================
 */

function extrairCodigosOe(
  texto = ""
) {
  const encontrados =
    new Set();

  const regex =
    /\bOE\s+([A-Z0-9./-]{4,})\b/gi;

  for (
    const match
    of String(
      texto || ""
    ).matchAll(
      regex
    )
  ) {
    const codigo =
      limparTexto(
        match[1]
      ).toUpperCase();

    if (codigo) {
      encontrados.add(
        codigo
      );
    }
  }

  return Array.from(
    encontrados
  );
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
    "MAP SENSOR",
    "SENSORE PRESSIONE ASSOLUTA",
    "SENSOR PRESSIONE ASSOLUTA",
    "SENSOR PRESSAO ABSOLUTA",
    "MANIFOLD ABSOLUTE PRESSURE SENSOR",
    "DESCRIPTION",
    "TYPE",
    "TYPE TYPE",
    "GROUP D",
    "GRUPPO D",
    "MAGNETI MARELLI",
    "KW",
    "B KW",
  ].includes(
    texto
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

  const codigosOe =
    extrairCodigosOe(
      aplicacao
    );

  const codigoCompacto =
    normalizarCodigo(
      codigoPrincipal
    );

  const equivalentes = [
    codigoPrincipal,
    codigoCompacto,
    ...codigosOe,
  ].filter(Boolean);

  const equivalentesUnicos = [
    ...new Set(
      equivalentes
    ),
  ];

  return {
    peca:
      "Sensor MAP",

    descricao:
      "Sensor de Pressão Absoluta do Coletor MAP",

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
      `Código Magneti Marelli: ${codigoPrincipal}`,

      "Tipo: Sensor MAP / Pressão Absoluta",

      aplicacao,

      codigosOe.length
        ? `OE: ${codigosOe.join(", ")}`
        : "",

      codigosMotor.length
        ? `Códigos motor: ${codigosMotor.join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join(" | "),

    origem_catalogo:
      configuracao
        ?.origemCatalogo ||
      "Catálogo Magneti Marelli Electronic Systems and Ignition 2016",

    arquivo_catalogo:
      nomeArquivo ||
      null,

    tipo_catalogo:
      "sensores_map",

    ativo:
      true,
  };
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
 * PARSER SEQUENCIAL
 * ============================================================
 */

function parserSequencial({
  linhas = [],
  configuracao = {},
  nomeArquivo = "",
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

    const codigosLinha =
      extrairTodosCodigosMap(
        linha
      );

    if (
      codigosLinha.length &&
      ehInicioCodigoMap(
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
 * PARSER POR BLOCOS
 * ============================================================
 */

function parserPorBlocos({
  texto = "",
  configuracao = {},
  nomeArquivo = "",
}) {
  const registros = [];

  const linhas =
    String(
      texto || ""
    )
      .split(/\r?\n/)
      .map(
        (linha) =>
          limparTexto(
            linha
          )
      );

  const ocorrencias =
    [];

  for (
    let indice = 0;
    indice < linhas.length;
    indice += 1
  ) {
    const linha =
      linhas[indice];

    const codigos =
      extrairTodosCodigosMap(
        linha
      );

    if (!codigos.length) {
      continue;
    }

    if (
      !ehInicioCodigoMap(
        linha
      )
    ) {
      continue;
    }

    for (
      const item
      of codigos
    ) {
      ocorrencias.push({
        codigo:
          normalizarCodigoOriginal(
            item.codigo
          ),

        indice,
      });
    }
  }

  for (
    const ocorrencia
    of ocorrencias
  ) {
    const codigo =
      ocorrencia.codigo;

    const indiceInicial =
      ocorrencia.indice;

    const limite =
      Math.min(
        linhas.length,
        indiceInicial + 240
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
        });

      if (registro) {
        registros.push(
          registro
        );
      }

      linhasAplicacao = [];
    }

    for (
      let i =
        indiceInicial + 1;

      i < limite;

      i += 1
    ) {
      const linha =
        linhas[i];

      if (!linha) {
        continue;
      }

      const novosCodigos =
        extrairTodosCodigosMap(
          linha
        );

      if (
        novosCodigos.length &&
        ehInicioCodigoMap(
          linha
        )
      ) {
        const possuiMesmoCodigo =
          novosCodigos.some(
            (item) =>
              normalizarCodigoOriginal(
                item.codigo
              ) === codigo
          );

        if (
          possuiMesmoCodigo
        ) {
          continue;
        }

        finalizar();

        break;
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
          linha
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
          linha
        );
      }
    }

    finalizar();
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
        Boolean(
          registro.codigo_oem
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
    .filter(
      (registro) =>
        !modeloEhInvalido(
          registro.modelo
        )
    )
    .map(
      (registro) => ({
        ...registro,

        montadora:
          limparTexto(
            registro.montadora
          ),

        modelo:
          limparTexto(
            registro.modelo
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
 * PARSER PRINCIPAL
 * ============================================================
 */

export async function parserMagnetiMarelliMap2016({
  textoReferencias = "",
  textoAplicacoes = "",
  textoEquivalencias = "",
  nomeArquivo = "",
  configuracao = {},
  onProgresso,
} = {}) {
  onProgresso?.(
    "📡 Interpretando sensores MAP Magneti Marelli 2016..."
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
      "⚠️ MARELLI MAP 2016: nenhum texto recebido."
    );

    return [];
  }

  const linhas =
    textoCompleto
      .split(/\r?\n/)
      .map(
        (linha) =>
          limparTexto(
            linha
          )
      )
      .filter(Boolean);

  console.log(
    "======================================"
  );

  console.log(
    "📡 PARSER MAP MARELLI 2016"
  );

  console.log(
    "📄 LINHAS:",
    linhas.length
  );

  const registrosSequenciais =
    parserSequencial({
      linhas,

      configuracao,

      nomeArquivo,
    });

  console.log(
    "📡 SEQUENCIAL:",
    registrosSequenciais.length
  );

  const registrosBlocos =
    parserPorBlocos({
      texto:
        textoCompleto,

      configuracao,

      nomeArquivo,
    });

  console.log(
    "📡 BLOCOS:",
    registrosBlocos.length
  );

  const registros =
    removerDuplicados(
      limparRegistrosFinais([
        ...registrosSequenciais,
        ...registrosBlocos,
      ])
    );

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
    "📡 CÓDIGOS MAP ÚNICOS:",
    codigosUnicos.size
  );

  console.log(
    "📡 REGISTROS MAP:",
    registros.length
  );
console.log(
  "📡 AMOSTRA MAP:",
  registros.slice(0, 10)
);

console.log(
  "📡 APS23:",
  registros.filter(
    (registro) =>
      normalizarCodigo(
        registro?.codigo_oem
      ) === "APS23"
  ).slice(0, 10)
);

console.log(
  "📡 PRT03/04:",
  registros.filter(
    (registro) =>
      normalizarCodigo(
        registro?.codigo_oem
      ) === "PRT0304"
  ).slice(0, 10)
);
  console.log(
    "======================================"
  );

  onProgresso?.(
    `📡 Sensores MAP Marelli 2016: ${registros.length} aplicação(ões) interpretada(s).`
  );

  return registros;
}

export default parserMagnetiMarelliMap2016;