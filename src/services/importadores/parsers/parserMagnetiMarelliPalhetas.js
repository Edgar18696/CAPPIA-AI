/*
 * ============================================================
 * APPIA AI
 * MAGNETI MARELLI — WIPER BLADES
 * ============================================================
 *
 * Catálogo:
 * Parts_Wiper-Blades_EN.pdf
 *
 * Linhas:
 *
 * - STANDARD
 * - TOUCH FLAT
 * - TWIN FLAT
 * - REAR FLAT
 * - REAR PLASTIC
 *
 * Códigos:
 *
 * SW...
 * MF...
 * TW...
 * FR...
 * PR...
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
  "LADA",
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
  "SUZUKI",
  "TOYOTA",
  "VAUXHALL",
  "VOLKSWAGEN",
  "VOLVO",
];

/*
 * Montadoras maiores primeiro.
 *
 * Evita:
 *
 * RENAULT
 * capturar antes de
 * RENAULT TRUCKS
 */

const MONTADORAS_ORDENADAS =
  [...MONTADORAS].sort(
    (a, b) =>
      b.length - a.length
  );

function identificarMontadora(
  linha = ""
) {
  const texto =
    normalizarTexto(linha);

  return (
    MONTADORAS_ORDENADAS.find(
      (item) =>
        normalizarTexto(item) ===
        texto
    ) || ""
  );
}

/*
 * ============================================================
 * MONTADORA + RESTANTE DA LINHA
 * ============================================================
 *
 * Aceita:
 *
 * FORD
 *
 * e também:
 *
 * FORD ECOSPORT 1.0 EcoBoost
 * ============================================================
 */

function extrairMontadoraDaLinha(
  linha = ""
) {
  const original =
    limparTexto(linha);

  const normalizado =
    normalizarTexto(original);

  for (
    const montadora
    of MONTADORAS_ORDENADAS
  ) {
    const marcaNormalizada =
      normalizarTexto(
        montadora
      );

    if (
      normalizado ===
      marcaNormalizada
    ) {
      return {
        montadora,
        restante: "",
      };
    }

    if (
      normalizado.startsWith(
        `${marcaNormalizada} `
      )
    ) {
      const restante =
        original
          .slice(
            montadora.length
          )
          .trim();

      return {
        montadora,
        restante,
      };
    }
  }

  return null;
}

/*
 * ============================================================
 * CÓDIGOS DE PALHETA
 * ============================================================
 *
 * Exemplos válidos:
 *
 * SW1280
 * SW1300
 * SW1330
 *
 * MF35B
 *
 * TW5540K
 *
 * FR25B
 *
 * PR25B
 *
 * IMPORTANTE:
 *
 * SWIFT NÃO pode virar código.
 * ============================================================
 */

function ehCodigoPalheta(
  valor = ""
) {
  const codigo =
    normalizarCodigo(
      valor
    );

  return (
    /^SW\d{4}$/.test(
      codigo
    ) ||
    /^MF\d{2,3}[A-Z]?$/.test(
      codigo
    ) ||
    /^TW\d{4}[A-Z]?$/.test(
      codigo
    ) ||
    /^FR\d{2,3}[A-Z]?$/.test(
      codigo
    ) ||
    /^PR\d{2,3}[A-Z]?$/.test(
      codigo
    )
  );
}

/*
 * ============================================================
 * CÓDIGO + RESTANTE DA LINHA
 * ============================================================
 *
 * Aceita:
 *
 * SW1300
 *
 * e também:
 *
 * SW1300 FORD ECOSPORT 1.0 EcoBoost
 *
 * ============================================================
 */

function extrairCodigoDaLinha(
  linha = ""
) {
  const texto =
    normalizarTexto(linha);

  const match =
    texto.match(
      /^(SW\d{4}|MF\d{2,3}[A-Z]?|TW\d{4}[A-Z]?|FR\d{2,3}[A-Z]?|PR\d{2,3}[A-Z]?)(?:\s+|$)(.*)$/
    );

  if (!match) {
    return null;
  }

  const codigo =
    normalizarCodigo(
      match[1]
    );

  if (
    !ehCodigoPalheta(
      codigo
    )
  ) {
    return null;
  }

  /*
   * O restante precisa ser obtido
   * da linha original para preservar
   * maiúsculas/minúsculas e acentos.
   */

  const original =
    limparTexto(linha);

  const posicao =
    original
      .toUpperCase()
      .indexOf(
        match[1]
      );

  const restante =
    posicao >= 0
      ? original
          .slice(
            posicao +
              match[1].length
          )
          .trim()
      : "";

  return {
    codigo,
    restante,
  };
}

/*
 * ============================================================
 * LINHA / TECNOLOGIA
 * ============================================================
 */

function identificarLinha(
  codigo = ""
) {
  const valor =
    normalizarCodigo(codigo);

  if (
    valor.startsWith("SW")
  ) {
    return {
      linha:
        "STANDARD",

      tipo:
        "Palheta Convencional",
    };
  }

  if (
    valor.startsWith("MF")
  ) {
    return {
      linha:
        "TOUCH FLAT",

      tipo:
        "Palheta Flat",
    };
  }

  if (
    valor.startsWith("TW")
  ) {
    return {
      linha:
        "TWIN FLAT",

      tipo:
        "Kit de Palhetas Flat",
    };
  }

  if (
    valor.startsWith("FR")
  ) {
    return {
      linha:
        "REAR FLAT",

      tipo:
        "Palheta Traseira Flat",
    };
  }

  if (
    valor.startsWith("PR")
  ) {
    return {
      linha:
        "REAR PLASTIC",

      tipo:
        "Palheta Traseira Plástica",
    };
  }

  return {
    linha:
      "WIPER BLADES",

    tipo:
      "Palheta do Limpador",
  };
}

/*
 * ============================================================
 * TAMANHO
 * ============================================================
 */

function extrairTamanho(
  codigo = ""
) {
  const valor =
    normalizarCodigo(codigo);

  /*
   * SW1300
   *
   * Últimos 3 dígitos:
   * 300 mm
   *
   * SW1280:
   * 280 mm
   *
   * SW1710:
   * 710 mm
   */

  if (
    /^SW\d{4}$/.test(
      valor
    )
  ) {
    const numero =
      Number(
        valor.slice(3)
      );

    if (
      Number.isFinite(
        numero
      ) &&
      numero >= 200 &&
      numero <= 900
    ) {
      return numero;
    }
  }

  /*
   * MF35B = 350 mm
   * FR25B = 250 mm
   * PR25B = 250 mm
   */

  const simples =
    valor.match(
      /^(?:MF|FR|PR)(\d{2,3})[A-Z]?$/
    );

  if (simples) {
    const numero =
      Number(
        simples[1]
      );

    if (
      Number.isFinite(
        numero
      )
    ) {
      return numero * 10;
    }
  }

  /*
   * TW5540K representa kit.
   *
   * Não forçamos um único tamanho
   * porque normalmente são duas
   * medidas diferentes.
   */

  return null;
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
    Number(valor);

  if (
    !Number.isFinite(
      numero
    )
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
  const anos = [
    ...String(
      texto || ""
    ).matchAll(
      /\b(\d{1,2})\/(\d{2})\b/g
    ),
  ]
    .map(
      (match) =>
        converterAnoCurto(
          match[2]
        )
    )
    .filter(Boolean);

  return {
    ano_inicio:
      anos[0] || null,

    ano_fim:
      anos.length > 1
        ? anos[1]
        : null,
  };
}

/*
 * ============================================================
 * MOTOR
 * ============================================================
 */

function extrairMotor(
  aplicacao = ""
) {
  const texto =
    limparTexto(
      aplicacao
    );

  const padroes = [
    /\b\d\.\d\s*(?:TDI|TDCI|HDI|TSI|TCE|DCI|VVT-I|VVTI|ECOBOOST|MULTIFUEL|16V|8V|4WD|JTD|MPI|I\.E\.|I)?\b.*$/i,

    /\bTCe\s+\d+\b.*$/i,

    /\bCOOPER\b.*$/i,

    /\bHYBRID\b.*$/i,
  ];

  for (
    const padrao
    of padroes
  ) {
    const match =
      texto.match(
        padrao
      );

    if (match) {
      return limparTexto(
        match[0]
      );
    }
  }

  return "";
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
   * Remove setas de limitação.
   *
   * Exemplo:
   *
   * IBIZA III 1.9 TDI à01/06
   */

  texto =
    texto.replace(
      /\s+[à→>-]\s*\d{1,2}\/\d{2}.*$/i,
      ""
    );

  return limparTexto(texto);
}

/*
 * ============================================================
 * CABEÇALHOS / LIXO DO PDF
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

  const termosExatos = [
    "STANDARD",
    "TOUCH FLAT",
    "TWIN FLAT",
    "REAR FLAT",
    "REAR PLASTIC",
    "FLAT TECHNOLOGY",
    "TRADITIONAL TECHNOLOGY",
    "THE RANGE",
    "WIPER BLADES",
  ];

  if (
    termosExatos.includes(
      texto
    )
  ) {
    return true;
  }

  const termosContidos = [
    "MAIN BLADE APPLICATIONS",
    "FITTING INSTRUCTIONS",
    "ACCESS THE FULL LIST",
    "OF APPLICATIONS",
    "FOR THE FITTING",
    "BLADE APPLICATIONS",
  ];

  return termosContidos.some(
    (termo) =>
      texto.includes(
        termo
      )
  );
}

/*
 * ============================================================
 * LINHAS QUE NÃO SÃO APLICAÇÕES
 * ============================================================
 */

function ehLinhaIgnoravel(
  linha = ""
) {
  const texto =
    normalizarTexto(linha);

  if (
    ehCabecalho(
      linha
    )
  ) {
    return true;
  }

  /*
   * Numeração isolada da página.
   */

  if (
    /^\d{1,3}$/.test(
      texto
    )
  ) {
    return true;
  }

  /*
   * Textos promocionais/instruções.
   */

  const termos = [
    "THE CODE IS",
    "DESCRIPTIVE",
    "MEASURE YOUR BLADE",
    "BLADE TYPE",
    "BLADE LENGTH",
    "SPARE PARTS",
    "EACH PACKAGE",
    "CONNECTOR",
    "ADAPTOR",
    "CLICK",
    "BEFORE USE",
    "PUSH BUTTON",
    "SIDE PIN",
    "BAYONET",
    "PINCH TAB",
    "HOOK",
  ];

  return termos.some(
    (termo) =>
      texto === termo
  );
}

/*
 * ============================================================
 * REGISTRO
 * ============================================================
 */

function criarRegistro({
  codigo,
  montadora,
  aplicacao,
  configuracao,
  nomeArquivo,
}) {
  const infoLinha =
    identificarLinha(
      codigo
    );

  const periodo =
    extrairPeriodo(
      aplicacao
    );

  const tamanho =
    extrairTamanho(
      codigo
    );

  const motor =
    extrairMotor(
      aplicacao
    );

  const modelo =
    limparModelo(
      aplicacao
    );

  const observacao = [
    `Código Magneti Marelli: ${codigo}`,

    `Linha: ${infoLinha.linha}`,

    tamanho
      ? `Comprimento: ${tamanho} mm`
      : "",

    aplicacao
      ? `Aplicação catálogo: ${aplicacao}`
      : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    peca:
      "Palheta do Limpador",

    descricao:
      infoLinha.tipo,

    codigo_oem:
      codigo,

    codigo:
      codigo,

    codigo_equivalente:
      null,

    equivalentes:
      [],

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

    ano_inicio:
      periodo.ano_inicio,

    ano_fim:
      periodo.ano_fim,

    aplicacao:
      aplicacao ||
      null,

    observacao,

    origem_catalogo:
      configuracao
        ?.origemCatalogo ||
      "Catálogo Magneti Marelli Wiper Blades",

    arquivo_catalogo:
      nomeArquivo ||
      null,

    tipo_catalogo:
      "palhetas",

    familia_catalogo:
      "Wiper Blades",

    categoria:
      "Limpeza",

    sistema:
      "Sistema Limpador",

    tipo:
      infoLinha.tipo,

    linha:
      infoLinha.linha,

    comprimento_mm:
      tamanho,

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
    registro.motor,
    registro.ano_inicio,
    registro.ano_fim,
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
 * CRIA APLICAÇÃO SE POSSÍVEL
 * ============================================================
 */

function adicionarAplicacao({
  registros,
  codigo,
  montadora,
  aplicacao,
  configuracao,
  nomeArquivo,
}) {
  const codigoFinal =
    normalizarCodigo(
      codigo
    );

  const montadoraFinal =
    limparTexto(
      montadora
    );

  const aplicacaoFinal =
    limparTexto(
      aplicacao
    );

  if (
    !ehCodigoPalheta(
      codigoFinal
    )
  ) {
    return;
  }

  if (
    !montadoraFinal ||
    !aplicacaoFinal
  ) {
    return;
  }

  if (
    ehLinhaIgnoravel(
      aplicacaoFinal
    )
  ) {
    return;
  }

  registros.push(
    criarRegistro({
      codigo:
        codigoFinal,

      montadora:
        montadoraFinal,

      aplicacao:
        aplicacaoFinal,

      configuracao,

      nomeArquivo,
    })
  );
}

/*
 * ============================================================
 * PARSER PRINCIPAL
 * ============================================================
 */

export async function parserMagnetiMarelliPalhetas({
  textoAplicacoes = "",
  textoReferencias = "",
  textoEquivalencias = "",
  nomeArquivo = "",
  configuracao = {},
  onProgresso,
} = {}) {
  onProgresso?.(
    "🌧️ Lendo Magneti Marelli Wiper Blades..."
  );

  const textoCompleto = [
    textoAplicacoes,
    textoReferencias,
    textoEquivalencias,
  ]
    .filter(Boolean)
    .join("\n");

  const linhas =
    separarLinhas(
      textoCompleto
    );

  const registros = [];

  let codigoAtual =
    "";

  let montadoraAtual =
    "";

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
     * ======================================================
     * 1. CÓDIGO
     * ======================================================
     *
     * Pode vir:
     *
     * SW1300
     *
     * ou:
     *
     * SW1300 FORD ECOSPORT ...
     * ======================================================
     */

    const codigoNaLinha =
      extrairCodigoDaLinha(
        linha
      );

    if (
      codigoNaLinha
    ) {
      codigoAtual =
        codigoNaLinha.codigo;

      /*
       * NOVO produto:
       * zera montadora anterior.
       */

      montadoraAtual =
        "";

      /*
       * Se sobrou texto depois
       * do código, tentamos usar.
       */

      if (
        codigoNaLinha.restante
      ) {
        const marcaNoRestante =
          extrairMontadoraDaLinha(
            codigoNaLinha.restante
          );

        if (
          marcaNoRestante
        ) {
          montadoraAtual =
            marcaNoRestante.montadora;

          if (
            marcaNoRestante.restante
          ) {
            adicionarAplicacao({
              registros,

              codigo:
                codigoAtual,

              montadora:
                montadoraAtual,

              aplicacao:
                marcaNoRestante.restante,

              configuracao,

              nomeArquivo,
            });
          }
        }
      }

      continue;
    }

    /*
     * Sem código ativo,
     * nada pode ser associado.
     */

    if (
      !codigoAtual
    ) {
      continue;
    }

    /*
     * ======================================================
     * 2. MONTADORA
     * ======================================================
     *
     * Pode vir:
     *
     * FORD
     *
     * ou:
     *
     * FORD ECOSPORT 1.0 EcoBoost
     * ======================================================
     */

    const marcaNaLinha =
      extrairMontadoraDaLinha(
        linha
      );

    if (
      marcaNaLinha
    ) {
      montadoraAtual =
        marcaNaLinha.montadora;

      if (
        marcaNaLinha.restante
      ) {
        adicionarAplicacao({
          registros,

          codigo:
            codigoAtual,

          montadora:
            montadoraAtual,

          aplicacao:
            marcaNaLinha.restante,

          configuracao,

          nomeArquivo,
        });
      }

      continue;
    }

    /*
     * ======================================================
     * 3. CABEÇALHOS
     * ======================================================
     */

    if (
      ehLinhaIgnoravel(
        linha
      )
    ) {
      continue;
    }

    /*
     * Sem montadora ativa,
     * ainda não podemos criar aplicação.
     */

    if (
      !montadoraAtual
    ) {
      continue;
    }

    /*
     * ======================================================
     * 4. APLICAÇÃO NORMAL
     * ======================================================
     *
     * Exemplo:
     *
     * ECOSPORT 1.0 EcoBoost
     * FIESTA V (...) 1.25 16V
     * FUSION (...) 1.4
     * ======================================================
     */

    adicionarAplicacao({
      registros,

      codigo:
        codigoAtual,

      montadora:
        montadoraAtual,

      aplicacao:
        linha,

      configuracao,

      nomeArquivo,
    });
  }

  const registrosUnicos =
    removerDuplicados(
      registros
    );
/*
 * ========================================================
 * DIAGNÓSTICO TEXTO REAL — SW1300
 * ========================================================
 */

const indiceSW1300 =
  linhas.findIndex(
    (linha) =>
      normalizarTexto(
        linha
      ).includes(
        "SW1300"
      )
  );

console.log(
  "=========================================="
);

console.log(
  "🔬 DIAGNÓSTICO TEXTO REAL SW1300"
);

console.log(
  "ÍNDICE SW1300:",
  indiceSW1300
);

if (
  indiceSW1300 >= 0
) {
  const inicio =
    Math.max(
      0,
      indiceSW1300 - 30
    );

  const fim =
    Math.min(
      linhas.length,
      indiceSW1300 + 120
    );

  for (
    let i = inicio;
    i < fim;
    i++
  ) {
    console.log(
      `LINHA ${i}:`,
      JSON.stringify(
        linhas[i]
      )
    );
  }
}

console.log(
  "=========================================="
);

  /*
   * ========================================================
   * DIAGNÓSTICO SW1300
   * ========================================================
   */

  const sw1300 =
    registrosUnicos.filter(
      (registro) =>
        normalizarCodigo(
          registro.codigo_oem
        ) ===
        "SW1300"
    );

  console.log(
    "=========================================="
  );

  console.log(
    "🌧️ MAGNETI MARELLI — WIPER BLADES"
  );

  console.log(
    "ARQUIVO:",
    nomeArquivo
  );

  console.log(
    "LINHAS LIDAS:",
    linhas.length
  );

  console.log(
    "REGISTROS BRUTOS:",
    registros.length
  );

  console.log(
    "REGISTROS ÚNICOS:",
    registrosUnicos.length
  );

  console.log(
    "🎯 SW1300 TOTAL:",
    sw1300.length
  );

  console.log(
    "🎯 SW1300 APLICAÇÕES:",
    sw1300
  );

  console.log(
    "=========================================="
  );

  onProgresso?.(
    `✅ Magneti Marelli Wiper Blades: ${registrosUnicos.length} registro(s) encontrado(s).`
  );

  return registrosUnicos;
}

export default parserMagnetiMarelliPalhetas;