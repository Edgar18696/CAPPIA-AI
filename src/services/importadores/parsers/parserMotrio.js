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
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

/*
 * ============================================================
 * CORREÇÕES DE TEXTO / OCR MOTRIO
 * ============================================================
 */

function juntarLetrasSeparadas(valor = "") {
  return String(valor || "").replace(
    /\b(?:[A-Za-zÀ-ÿ]\s+){2,}[A-Za-zÀ-ÿ]\b/g,
    (trecho) =>
      trecho.replace(/\s+/g, "")
  );
}

function corrigirCodigoMotrioOcr(
  valor = ""
) {
  const original = String(
    valor || ""
  )
    .toUpperCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^A-Z0-9]/g,
      ""
    );

  if (!original) {
    return "";
  }

  /*
   * Alguns códigos do PDF Motrio podem
   * ser extraídos com caracteres OCR
   * semelhantes a números.
   *
   * Mantemos correções conhecidas do
   * catálogo 2024.
   */

  const correcoesOcr = {
    BESO0OBCSALS:
      "8660009636",

    B6SO0ETSCS:
      "8660009503",

    BESOOBCSIA:
      "8660009516",

    BSSOOBASAT:
      "8660009637",

    BESOOBCSO7:
      "8660009507",

    BSSOUERSA:
      "8660009641",

    BOSNGESIS:
      "8660009516",

    BESCOOSIEA:
      "8660006924",

    BESOOO60ES:
      "8660006925",

    B6SN0NO60E:
      "8660006923",

    B6SNNO67E2:
      "8660006922",

    BOSOCOG6TA:
      "8660006921",
  };

  if (
    correcoesOcr[original]
  ) {
    return correcoesOcr[
      original
    ];
  }

  const mapa = {
    B: "8",
    O: "0",
    Q: "0",
    D: "0",
    U: "0",
    S: "5",
    G: "6",
    I: "1",
    L: "1",
    Z: "2",
    A: "4",
    T: "7",
  };

  const convertido =
    original
      .split("")
      .map(
        (caractere) =>
          mapa[
            caractere
          ] ??
          caractere
      )
      .join("");

  if (
    /^8\d{9}$/.test(
      convertido
    )
  ) {
    return convertido;
  }

  return "";
}

function limparAplicacao(
  valor = ""
) {
  let texto =
    limparTexto(valor);

  if (!texto) {
    return "";
  }

  /*
   * Corrige palavras quebradas pelo
   * extrator do PDF:
   *
   * C a p t u r
   * S a n d e r o
   * D u s t e r
   */

  texto =
    juntarLetrasSeparadas(
      texto
    );

  /*
   * Remove barras soltas no final:
   *
   * Sandero/
   * Logan /
   */

  texto =
    texto.replace(
      /\s*\/+\s*$/g,
      ""
    );

  /*
   * Remove separadores estranhos
   * deixados pelo PDF.
   */

  texto =
    texto.replace(
      /^[|;,:./\-]+\s*/g,
      ""
    );

  texto =
    texto.replace(
      /\s*[|;,:]+\s*$/g,
      ""
    );

  texto =
    texto.replace(
      /\s+/g,
      " "
    );

  return limparTexto(
    texto
  );
}

function ehSomenteMontadora(
  valor = ""
) {
  const texto =
    normalizar(valor);

  if (!texto) {
    return false;
  }

  const montadoras = [
    "renault",
    "chevrolet",
    "gm",
    "volkswagen",
    "vw",
    "fiat",
    "ford",
    "peugeot",
    "citroen",
    "nissan",
    "toyota",
    "honda",
    "hyundai",
    "kia",
    "jeep",
    "mercedes benz",
    "mercedes-benz",
    "bmw",
    "audi",
    "mitsubishi",
    "suzuki",
    "subaru",
    "land rover",
    "volvo",
    "porsche",
    "daf",
    "iveco",
    "scania",
    "man",
  ];

  return montadoras.includes(
    texto
  );
}

function transformarEmLinhas(
  texto = ""
) {
  return String(
    texto || ""
  )
    .split(/\r?\n/)
    .map(limparTexto)
    .filter(Boolean);
}

/*
 * ============================================================
 * CÓDIGOS
 * ============================================================
 */

function extrairCodigos(
  linha = ""
) {
  const texto =
    String(
      linha || ""
    ).toUpperCase();

  const encontrados =
    texto.match(
      /\b[A-Z0-9][A-Z0-9./-]{5,15}\b/g
    ) || [];

  const resultado = [];

  for (
    const item
    of encontrados
  ) {
    const codigo =
      item
        .replace(
          /[.,;:]+$/g,
          ""
        )
        .trim();

    if (!codigo) {
      continue;
    }

    resultado.push(
      codigo
    );

    /*
     * Se o PDF transformou um código
     * Motrio em caracteres OCR,
     * adicionamos também a versão
     * corrigida.
     */

    const corrigido =
      corrigirCodigoMotrioOcr(
        codigo
      );

    if (
      corrigido &&
      corrigido !==
        normalizarCodigo(
          codigo
        )
    ) {
      resultado.push(
        corrigido
      );
    }
  }

  return [
    ...new Set(
      resultado
    ),
  ];
}

function pareceCodigoMotrio(
  valor = ""
) {
  let codigo =
    normalizarCodigo(
      valor
    );

  if (
    !/^8\d{9}$/.test(
      codigo
    )
  ) {
    const corrigido =
      corrigirCodigoMotrioOcr(
        valor
      );

    if (corrigido) {
      codigo =
        corrigido;
    }
  }

  /*
   * Catálogo Motrio 2024:
   *
   * 8660089582
   * 8660089774
   * 8660089816
   * 8550506762
   * 8660009637
   */

  return (
    /^8\d{9}$/.test(
      codigo
    )
  );
}

function pareceCodigoOriginal(
  valor = "",
  codigoMotrio = ""
) {
  const codigo =
    normalizarCodigo(
      valor
    );

  if (!codigo) {
    return false;
  }

  if (
    codigo ===
    normalizarCodigo(
      codigoMotrio
    )
  ) {
    return false;
  }

  if (
    pareceCodigoMotrio(
      codigo
    )
  ) {
    return false;
  }

  /*
   * Exemplos Renault:
   *
   * 410608481R
   * 410600222R
   * 7701207339
   * 7701208142
   */

  if (
    /^[A-Z0-9]{8,12}$/.test(
      codigo
    )
  ) {
    return true;
  }

  return false;
}

/*
 * ============================================================
 * FAMÍLIAS
 * ============================================================
 */

const FAMILIAS = [
  {
    chave:
      "palhetas",

    peca:
      "Palheta do limpador",

    termos: [
      "palhetas",
      "palheta",
    ],
  },

  {
    chave:
      "filtro_ar",

    peca:
      "Filtro de ar",

    termos: [
      "filtros de ar",
      "filtro de ar",
    ],
  },

  {
    chave:
      "filtro_cabine",

    peca:
      "Filtro de cabine",

    termos: [
      "filtros de cabine",
      "filtro de cabine",
    ],
  },

  {
    chave:
      "filtro_combustivel",

    peca:
      "Filtro de combustível",

    termos: [
      "filtros de combustivel",
      "filtro de combustivel",
    ],
  },

  {
    chave:
      "filtro_oleo",

    peca:
      "Filtro de óleo",

    termos: [
      "filtros de oleo",
      "filtro de oleo",
      "filtros de óleo",
      "filtro de óleo",
    ],
  },

  {
    chave:
      "pastilha_freio",

    peca:
      "Pastilha de freio",

    termos: [
      "pastilhas de freio",
      "pastilha de freio",
    ],
  },

  {
    chave:
      "disco_freio",

    peca:
      "Disco de freio",

    termos: [
      "discos de freio",
      "disco de freio",
    ],
  },

  {
    chave:
      "bomba_agua",

    peca:
      "Bomba d'água",

    termos: [
      "bomba d'agua",
      "bomba dagua",
      "bomba de agua",
      "bomba d’água",
    ],
  },

  {
    chave:
      "kit_correias",

    peca:
      "Kit de correias",

    termos: [
      "kit de correias",
      "kit correia",
      "kit de correia",
    ],
  },

  {
    chave:
      "lubrificantes",

    peca:
      "Lubrificante",

    termos: [
      "lubrificantes",
      "lubrificante",
    ],
  },
];

function identificarFamilia(
  linha = "",
  familiaAtual = null
) {
  const texto =
    normalizar(
      linha
    );

  for (
    const familia
    of FAMILIAS
  ) {
    if (
      familia.termos.some(
        (termo) =>
          texto.includes(
            normalizar(
              termo
            )
          )
      )
    ) {
      return familia;
    }
  }

  return familiaAtual;
}

/*
 * ============================================================
 * MONTADORAS
 * ============================================================
 */

const MONTADORAS = [
  "RENAULT",
  "CHEVROLET",
  "GM",
  "VOLKSWAGEN",
  "VW",
  "FIAT",
  "FORD",
  "PEUGEOT",
  "CITROEN",
  "CITROËN",
  "NISSAN",
  "TOYOTA",
  "HONDA",
  "HYUNDAI",
  "KIA",
  "JEEP",
  "MERCEDES BENZ",
  "MERCEDES-BENZ",
  "BMW",
  "AUDI",
  "MITSUBISHI",
  "SUZUKI",
  "SUBARU",
  "LAND ROVER",
  "VOLVO",
  "PORSCHE",
  "DAF",
  "IVECO",
  "SCANIA",
  "MAN",
];

function normalizarMontadora(
  montadora = ""
) {
  const texto =
    limparTexto(
      montadora
    ).toUpperCase();

  if (
    texto === "VW"
  ) {
    return "Volkswagen";
  }

  if (
    texto === "GM"
  ) {
    return "Chevrolet";
  }

  if (
    texto ===
      "CITROEN" ||
    texto ===
      "CITROËN"
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

  return texto
    .toLowerCase()
    .replace(
      /(^|\s)\S/g,
      (letra) =>
        letra.toUpperCase()
    );
}

function encontrarMontadora(
  linha = ""
) {
  const texto =
    normalizar(
      linha
    );

  const ordenadas = [
    ...MONTADORAS,
  ].sort(
    (a, b) =>
      b.length -
      a.length
  );

  for (
    const montadora
    of ordenadas
  ) {
    const alvo =
      normalizar(
        montadora
      );

    if (
      texto === alvo ||
      texto.startsWith(
        `${alvo} `
      )
    ) {
      return normalizarMontadora(
        montadora
      );
    }
  }

  return "";
}

function removerMontadora(
  linha = "",
  montadora = ""
) {
  if (!montadora) {
    return limparTexto(
      linha
    );
  }

  const candidatos = [
    montadora,
    montadora.toUpperCase(),
  ];

  if (
    montadora ===
    "Volkswagen"
  ) {
    candidatos.push(
      "VW",
      "VOLKSWAGEN"
    );
  }

  if (
    montadora ===
    "Chevrolet"
  ) {
    candidatos.push(
      "GM",
      "CHEVROLET"
    );
  }

  if (
    montadora ===
    "Citroën"
  ) {
    candidatos.push(
      "CITROEN",
      "CITROËN"
    );
  }

  if (
    montadora ===
    "Mercedes-Benz"
  ) {
    candidatos.push(
      "MERCEDES BENZ",
      "MERCEDES-BENZ"
    );
  }

  let resultado =
    limparTexto(
      linha
    );

  for (
    const candidato
    of candidatos
  ) {
    resultado =
      resultado.replace(
        new RegExp(
          `^${candidato.replace(
            /[-/\\^$*+?.()|[\]{}]/g,
            "\\$&"
          )}\\s*`,
          "i"
        ),
        ""
      );
  }

  return limparTexto(
    resultado
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
    String(
      texto || ""
    );

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

  const ano_inicio =
    Number(
      anos[0]
    );

  let ano_fim =
    anos.length > 1
      ? Number(
          anos[
            anos.length - 1
          ]
        )
      : null;

  /*
   * 2011 >
   * Desde 2017
   */

  if (
    />/.test(
      linha
    ) ||
    /\bdesde\b/i.test(
      linha
    )
  ) {
    ano_fim = null;
  }

  return {
    ano_inicio,
    ano_fim,
  };
}

/*
 * ============================================================
 * MOTOR
 * ============================================================
 */

function extrairMotor(
  texto = ""
) {
  const linha =
    limparTexto(
      texto
    );

  const padroes = [
    /*
     * Motores Renault:
     * K4M / F4R / K7M / G9U / D4D
     */

    /\b[A-Z]\d[A-Z]\b/i,

    /*
     * 1.0 / 1.6 / 2.0
     */

    /\b\d\.\d(?:\s*\/\s*\d\.\d)*\b/i,

    /*
     * 1.6 16V
     */

    /\b\d\.\d\s*(?:8|12|16|20|24|32)V\b/i,

    /*
     * 2.5 dCi
     */

    /\b\d\.\d\s*dci\b/i,

    /*
     * diesel / flex / turbo
     */

    /\b\d\.\d\s*(?:diesel|flex|turbo)\b/i,
  ];

  const encontrados = [];

  for (
    const padrao
    of padroes
  ) {
    const match =
      linha.match(
        padrao
      );

    if (
      match?.[0]
    ) {
      encontrados.push(
        limparTexto(
          match[0]
        )
      );
    }
  }

  /*
   * Prefere versões mais completas:
   *
   * 1.6 16V
   * em vez de
   * 1.6
   */

  const unicos = [
    ...new Set(
      encontrados
    ),
  ];

  unicos.sort(
    (a, b) =>
      b.length -
      a.length
  );

  const finais = [];

  for (
    const motor
    of unicos
  ) {
    const jaCoberto =
      finais.some(
        (existente) =>
          normalizar(
            existente
          ).includes(
            normalizar(
              motor
            )
          )
      );

    if (
      !jaCoberto
    ) {
      finais.push(
        motor
      );
    }
  }

  return finais.join(
    " "
  );
}

/*
 * ============================================================
 * MODELO
 * ============================================================
 */

function extrairModelo(
  texto = "",
  motor = ""
) {
  let resultado =
    limparAplicacao(
      texto
    );

  if (!resultado) {
    return "";
  }

  /*
   * Nunca permite que uma montadora
   * sozinha vire modelo.
   */

  if (
    ehSomenteMontadora(
      resultado
    )
  ) {
    return "";
  }

  /*
   * Remove ano.
   */

  resultado =
    resultado.replace(
      /\b(?:19|20)\d{2}\b/g,
      " "
    );

  /*
   * Remove Desde.
   */

  resultado =
    resultado.replace(
      /\bdesde\b/gi,
      " "
    );

  /*
   * Remove >.
   */

  resultado =
    resultado.replace(
      />/g,
      " "
    );

  /*
   * Remove motor conhecido.
   */

  if (motor) {
    const motores =
      String(motor)
        .split(/\s+(?=[A-Z]\d[A-Z]\b|\d\.\d)/i)
        .filter(Boolean);

    for (
      const motorItem
      of motores
    ) {
      resultado =
        resultado.replace(
          motorItem,
          " "
        );
    }
  }

  /*
   * Remove motores restantes.
   */

  resultado =
    resultado.replace(
      /\b\d\.\d(?:\s*\/\s*\d\.\d)*\s*(?:8|12|16|20|24|32)?V?\b/gi,
      " "
    );

  resultado =
    resultado.replace(
      /\b[A-Z]\d[A-Z]\b/gi,
      " "
    );

  resultado =
    resultado.replace(
      /\b(?:flex|diesel|dci|gasolina|etanol|gnv|turbo)\b/gi,
      " "
    );

  /*
   * Limpa barras e separadores
   * que sobraram.
   */

  resultado =
    resultado.replace(
      /\s*\/+\s*$/g,
      ""
    );

  resultado =
    resultado.replace(
      /^[|;,:./\-]+\s*/g,
      ""
    );

  resultado =
    resultado.replace(
      /\s*[|;,:./\-]+\s*$/g,
      ""
    );

  resultado =
    resultado.replace(
      /\s+/g,
      " "
    );

  resultado =
    limparTexto(
      resultado
    );

  /*
   * Segunda proteção contra:
   *
   * RENAULT
   * FIAT
   * VOLKSWAGEN
   */

  if (
    ehSomenteMontadora(
      resultado
    )
  ) {
    return "";
  }

  return resultado;
}
/*
 * ============================================================
 * LINHAS QUE NÃO SÃO APLICAÇÕES
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

  const ignorar = [
    "ref. motrio",
    "ref motrio",
    "ref. original",
    "ref original",
    "fabricante",
    "modelo ano",
    "fornecimento",
    "ecopads",
    "frasle",
    "cobreq",
    "preco",
    "preço",
    "beneficios",
    "benefícios",
    "tecnologia",
    "qualidade",
    "descricao:",
    "descrição:",
    "aplicacao:",
    "aplicação:",
    "onde comprar",
    "menu",
  ];

  if (
    ignorar.some(
      (item) =>
        texto.includes(
          normalizar(item)
        )
    )
  ) {
    return true;
  }

  return false;
}

/*
 * ============================================================
 * BLOCOS MOTRIO
 * ============================================================
 */

function construirBlocos(
  linhas = []
) {
  const blocos = [];

  let familiaAtual = null;
  let blocoAtual = null;

  for (
    let indice = 0;
    indice < linhas.length;
    indice += 1
  ) {
    const linha =
      linhas[indice];

    familiaAtual =
      identificarFamilia(
        linha,
        familiaAtual
      );

    const codigos =
      extrairCodigos(linha);

    const codigoMotrio =
      codigos.find(
        pareceCodigoMotrio
      );

    if (codigoMotrio) {
      if (blocoAtual) {
        blocos.push(
          blocoAtual
        );
      }

      blocoAtual = {
        codigoMotrio:
          normalizarCodigo(
            codigoMotrio
          ),

        familia:
          familiaAtual,

        linhas: [
          linha,
        ],
      };

      continue;
    }

    if (blocoAtual) {
      blocoAtual.linhas.push(
        linha
      );
    }
  }

  if (blocoAtual) {
    blocos.push(
      blocoAtual
    );
  }

  return blocos;
}

/*
 * ============================================================
 * OEM / ORIGINAL
 * ============================================================
 */

function encontrarCodigoOriginal(
  bloco
) {
  for (
    const linha
    of bloco.linhas
  ) {
    const codigos =
      extrairCodigos(linha);

    for (
      const codigo
      of codigos
    ) {
      if (
        pareceCodigoOriginal(
          codigo,
          bloco.codigoMotrio
        )
      ) {
        const normalizado =
          normalizarCodigo(
            codigo
          );

        /*
         * Evita confundir ano.
         */

        if (
          /^(?:19|20)\d{2}$/.test(
            normalizado
          )
        ) {
          continue;
        }

        return normalizado;
      }
    }
  }

  return "";
}

/*
 * ============================================================
 * REGISTRO PADRÃO APPIA
 * ============================================================
 */

function criarRegistro({
  codigoMotrio,
  codigoOriginal = "",
  familia,
  montadora = "",
  linhaAplicacao = "",
  nomeArquivo = "",
  configuracao = {},
}) {
  const aplicacao =
    limparTexto(
      linhaAplicacao
    );

  const {
    ano_inicio,
    ano_fim,
  } = extrairAnos(
    aplicacao
  );

  const motor =
    extrairMotor(
      aplicacao
    );

  const semMontadora =
    removerMontadora(
      aplicacao,
      montadora
    );

  const modelo =
    extrairModelo(
      semMontadora,
      motor
    );

  const peca =
    familia?.peca ||
    "Peça Motrio";

  return {
    peca,

    descricao:
      peca,

    /*
     * Código pesquisável principal:
     * Motrio.
     */

    codigo_oem:
      normalizarCodigo(
        codigoMotrio
      ),

    /*
     * Referência Renault/OEM.
     */

    codigo_equivalente:
      normalizarCodigo(
        codigoOriginal
      ),

    equivalentes:
      codigoOriginal
        ? [
            normalizarCodigo(
              codigoOriginal
            ),
          ]
        : [],

    /*
     * Mantemos Renault como fabricante
     * para continuar compatível com o
     * filtro Renault já existente no APPIA.
     */

    fabricante:
      "Renault",

    montadora:
      montadora || null,

    modelo:
      modelo || null,

    motor:
      motor || null,

    ano_inicio,
    ano_fim,

    aplicacao:
      aplicacao || null,

    observacao:
      [
        "Marca da peça: Motrio",

        codigoOriginal
          ? `Referência original: ${normalizarCodigo(
              codigoOriginal
            )}`
          : "",

        aplicacao
          ? `Aplicação catálogo: ${aplicacao}`
          : "",
      ]
        .filter(Boolean)
        .join(" | "),

    origem_catalogo:
      configuracao
        ?.origemCatalogo ||
      "Catálogo Motrio 2024",

    arquivo_catalogo:
      nomeArquivo ||
      "CatalogoMotrio_2024.pdf",

    tipo_catalogo:
      familia?.chave ||
      configuracao
        ?.tipoCatalogo ||
      "motrio_2024",

    ativo: true,

    prioridade: 1,

    confiabilidade: 100,
  };
}

/*
 * ============================================================
 * PROCESSAR BLOCO
 * ============================================================
 */

function processarBloco({
  bloco,
  nomeArquivo,
  configuracao,
}) {
  const registros = [];

  const codigoOriginal =
    encontrarCodigoOriginal(
      bloco
    );

  let montadoraAtual = "";

  /*
   * Primeira linha normalmente contém:
   *
   * 8660089582 410608481R RENAULT
   */

  for (
    const linhaOriginal
    of bloco.linhas
  ) {
    let linha =
      limparTexto(
        linhaOriginal
      );

    if (
      !linha ||
      ignorarLinha(linha)
    ) {
      continue;
    }

    /*
     * Remove códigos do início da aplicação.
     */

    linha =
      linha.replace(
        bloco.codigoMotrio,
        " "
      );

    if (codigoOriginal) {
      linha =
        linha.replace(
          codigoOriginal,
          " "
        );
    }

    linha =
      limparTexto(
        linha
      );

    if (!linha) {
      continue;
    }

    const montadoraLinha =
      encontrarMontadora(
        linha
      );

    if (montadoraLinha) {
      montadoraAtual =
        montadoraLinha;

      linha =
        removerMontadora(
          linha,
          montadoraLinha
        );

      /*
       * Se a linha era somente:
       *
       * RENAULT
       *
       * não cadastramos isso como modelo.
       */

      if (!linha) {
        continue;
      }
    }

    /*
     * Proteção extra:
     * nunca permite uma montadora
     * isolada virar aplicação/modelo.
     */

    if (
      ehSomenteMontadora(
        linha
      )
    ) {
      continue;
    }

    /*
     * Limpeza das aplicações antes
     * de gerar o registro.
     *
     * C a p t u r -> Captur
     * Sandero/ -> Sandero
     */

    linha =
      limparAplicacao(
        linha
      );

    if (!linha) {
      continue;
    }

    /*
     * Evita cadastrar código novamente
     * como aplicação.
     */

    const somenteCodigo =
      normalizarCodigo(
        linha
      );

    if (
      pareceCodigoMotrio(
        somenteCodigo
      ) ||
      somenteCodigo ===
        codigoOriginal
    ) {
      continue;
    }

    /*
     * Aplicações normalmente possuem:
     *
     * modelo
     * motor
     * ano
     *
     * Exemplo:
     * Duster 1.6 2011 >
     */

    const temAno =
      /\b(?:19|20)\d{2}\b/.test(
        linha
      );

    const temMotor =
      Boolean(
        extrairMotor(
          linha
        )
      );

    /*
     * Kits de correia podem ter somente
     * K4M / F4R / K7M etc.
     */

    const ehMotorRenault =
      /\b[A-Z]\d[A-Z]\b/i.test(
        linha
      );

    if (
      !temAno &&
      !temMotor &&
      !ehMotorRenault &&
      linha.length < 3
    ) {
      continue;
    }

    const registro =
      criarRegistro({
        codigoMotrio:
          bloco.codigoMotrio,

        codigoOriginal,

        familia:
          bloco.familia,

        montadora:
          montadoraAtual,

        linhaAplicacao:
          linha,

        nomeArquivo,

        configuracao,
      });

    /*
     * Não grava registros em que,
     * após toda a limpeza, o modelo
     * ainda seja apenas uma montadora.
     */

    if (
      registro.modelo &&
      ehSomenteMontadora(
        registro.modelo
      )
    ) {
      registro.modelo =
        null;
    }

    registros.push(
      registro
    );
  }

  /*
   * Caso o produto tenha código,
   * mas nenhuma aplicação detalhada.
   */

  if (!registros.length) {
    registros.push(
      criarRegistro({
        codigoMotrio:
          bloco.codigoMotrio,

        codigoOriginal,

        familia:
          bloco.familia,

        montadora:
          montadoraAtual,

        linhaAplicacao:
          "",

        nomeArquivo,

        configuracao,
      })
    );
  }

  return registros;
}

/*
 * ============================================================
 * CORREÇÕES OFICIAIS MOTRIO 2024
 * ============================================================
 *
 * Algumas páginas possuem colunas que o PDF/OCR mistura.
 *
 * Estes códigos também servem como
 * proteção contra linhas cruzadas.
 * ============================================================
 */

const CORRECOES_APLICACOES_MOTRIO = {
  "8660089582": {
    peca:
      "Pastilha de freio",

    codigoOriginal:
      "410608481R",

    aplicacoes: [
      {
        montadora:
          "Renault",

        modelo:
          "Duster",

        motor:
          "1.6",

        ano_inicio:
          2011,

        ano_fim:
          null,
      },

      {
        montadora:
          "Renault",

        modelo:
          "Captur",

        motor:
          "1.6",

        ano_inicio:
          2017,

        ano_fim:
          null,
      },
    ],
  },

  "8660089588": {
    peca:
      "Pastilha de freio",

    codigoOriginal:
      "410608481R",

    aplicacoes: [
      {
        montadora:
          "Renault",

        modelo:
          "Duster",

        motor:
          "2.0",

        ano_inicio:
          2011,

        ano_fim:
          null,
      },

      {
        montadora:
          "Renault",

        modelo:
          "Captur",

        motor:
          "2.0",

        ano_inicio:
          2017,

        ano_fim:
          null,
      },

      {
        montadora:
          "Renault",

        modelo:
          "Oroch",

        motor:
          "2.0",

        ano_inicio:
          2015,

        ano_fim:
          null,
      },

      {
        montadora:
          "Renault",

        modelo:
          "Fluence",

        motor:
          "2.0",

        ano_inicio:
          2011,

        ano_fim:
          null,
      },
    ],
  },

  "8660009637": {
    peca:
      "Filtro de ar",

    codigoOriginal:
      "",

    aplicacoes: [
      {
        montadora:
          "Volkswagen",

        modelo:
          "Fox",

        motor:
          "1.0 8V",

        ano_inicio:
          2008,

        ano_fim:
          null,
      },

      {
        montadora:
          "Volkswagen",

        modelo:
          "Voyage",

        motor:
          "1.0 8V",

        ano_inicio:
          2008,

        ano_fim:
          null,
      },
    ],
  },
};
/*
 * ============================================================
 * APLICAR CORREÇÕES OFICIAIS
 * ============================================================
 */

function aplicarCorrecoesMotrio(
  registros = [],
  {
    nomeArquivo = "",
    configuracao = {},
  } = {}
) {
  const mapa =
    new Map();

  for (
    const registro
    of registros
  ) {
    const codigo =
      normalizarCodigo(
        registro?.codigo_oem
      );

    if (!codigo) {
      continue;
    }

    if (
      !mapa.has(
        codigo
      )
    ) {
      mapa.set(
        codigo,
        []
      );
    }

    mapa.get(
      codigo
    ).push(
      registro
    );
  }

  for (
    const [
      codigo,
      correcao,
    ]
    of Object.entries(
      CORRECOES_APLICACOES_MOTRIO
    )
  ) {
    const existentes =
      mapa.get(
        codigo
      ) || [];

    /*
     * Remove registros ruins do
     * código corrigido.
     */

    const restantes =
      registros.filter(
        (registro) =>
          normalizarCodigo(
            registro?.codigo_oem
          ) !== codigo
      );

    const novos = [];

    for (
      const aplicacao
      of correcao.aplicacoes
    ) {
      novos.push({
        peca:
          correcao.peca,

        descricao:
          correcao.peca,

        codigo_oem:
          codigo,

        codigo_equivalente:
          correcao.codigoOriginal ||
          "",

        equivalentes:
          correcao.codigoOriginal
            ? [
                correcao.codigoOriginal,
              ]
            : [],

        fabricante:
          "Renault",

        montadora:
          aplicacao.montadora ||
          null,

        modelo:
          aplicacao.modelo ||
          null,

        motor:
          aplicacao.motor ||
          null,

        ano_inicio:
          aplicacao.ano_inicio ??
          null,

        ano_fim:
          aplicacao.ano_fim ??
          null,

        aplicacao:
          [
            aplicacao.modelo,
            aplicacao.motor,
            aplicacao.ano_inicio,
            aplicacao.ano_fim
              ? `até ${aplicacao.ano_fim}`
              : aplicacao.ano_inicio
                ? ">"
                : "",
          ]
            .filter(Boolean)
            .join(" "),

        observacao:
          [
            "Marca da peça: Motrio",

            correcao.codigoOriginal
              ? `Referência original: ${correcao.codigoOriginal}`
              : "",

            aplicacao.modelo
              ? `Aplicação catálogo: ${[
                  aplicacao.montadora,
                  aplicacao.modelo,
                  aplicacao.motor,
                  aplicacao.ano_inicio,
                  aplicacao.ano_fim
                    ? `até ${aplicacao.ano_fim}`
                    : aplicacao.ano_inicio
                      ? ">"
                      : "",
                ]
                  .filter(Boolean)
                  .join(" ")}`
              : "",
          ]
            .filter(Boolean)
            .join(" | "),

        origem_catalogo:
          configuracao
            ?.origemCatalogo ||
          "Catálogo Motrio 2024",

        arquivo_catalogo:
          nomeArquivo ||
          "CatalogoMotrio_2024.pdf",

        tipo_catalogo:
          codigo ===
          "8660009637"
            ? "filtro_ar"
            : "pastilha_freio",

        ativo: true,

        prioridade: 1,

        confiabilidade: 100,
      });
    }

    registros.length = 0;

    registros.push(
      ...restantes,
      ...novos
    );

    /*
     * Apenas diagnóstico.
     */

    console.log(
      "🔧 CORREÇÃO MOTRIO:",
      {
        codigo,
        antes:
          existentes.length,
        depois:
          novos.length,
      }
    );
  }

  return registros;
}

/*
 * ============================================================
 * GARANTIR CÓDIGOS OCR CONHECIDOS
 * ============================================================
 */

function garantirCodigosMotrioConhecidos({
  texto = "",
  registros = [],
  nomeArquivo = "",
  configuracao = {},
}) {
  const textoNormalizado =
    String(
      texto || ""
    )
      .toUpperCase()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      );

  const codigosJaPresentes =
    new Set(
      registros
        .map(
          (registro) =>
            normalizarCodigo(
              registro?.codigo_oem
            )
        )
        .filter(Boolean)
    );

  /*
   * 8660009637 aparece em página
   * de filtro com OCR ruim.
   */

  const assinaturas9637 = [
    "8660009637",
    "BSSOOBASAT",
  ];

  const encontrou9637 =
    assinaturas9637.some(
      (assinatura) =>
        textoNormalizado.includes(
          assinatura
        )
    );

  if (
    encontrou9637 &&
    !codigosJaPresentes.has(
      "8660009637"
    )
  ) {
    registros.push({
      peca:
        "Filtro de ar",

      descricao:
        "Filtro de ar",

      codigo_oem:
        "8660009637",

      codigo_equivalente:
        "",

      equivalentes: [],

      fabricante:
        "Renault",

      montadora:
        null,

      modelo:
        null,

      motor:
        null,

      ano_inicio:
        null,

      ano_fim:
        null,

      aplicacao:
        null,

      observacao:
        "Marca da peça: Motrio | Código recuperado pelo tratamento OCR Motrio 2024.",

      origem_catalogo:
        configuracao
          ?.origemCatalogo ||
        "Catálogo Motrio 2024",

      arquivo_catalogo:
        nomeArquivo ||
        "CatalogoMotrio_2024.pdf",

      tipo_catalogo:
        "filtro_ar",

      ativo: true,

      prioridade: 1,

      confiabilidade: 100,
    });
  }

  return registros;
}

/*
 * ============================================================
 * LIMPEZA FINAL DOS REGISTROS
 * ============================================================
 */

function limparRegistrosMotrio(
  registros = []
) {
  const resultado = [];

  for (
    const registroOriginal
    of registros
  ) {
    const registro = {
      ...registroOriginal,
    };

    if (
      registro.modelo
    ) {
      registro.modelo =
        extrairModelo(
          registro.modelo,
          ""
        );

      if (
        !registro.modelo ||
        ehSomenteMontadora(
          registro.modelo
        )
      ) {
        registro.modelo =
          null;
      }
    }

    if (
      registro.montadora
    ) {
      registro.montadora =
        normalizarMontadora(
          registro.montadora
        );
    }

    /*
     * Corrige modelo terminado em /
     */

    if (
      registro.modelo
    ) {
      registro.modelo =
        registro.modelo
          .replace(
            /\s*\/+\s*$/g,
            ""
          )
          .replace(
            /\s+/g,
            " "
          )
          .trim();
    }

    /*
     * Evita modelos obviamente ruins.
     */

    const modeloNormalizado =
      normalizar(
        registro.modelo ||
        ""
      );

    const modelosInvalidos = [
      "fabricante",
      "modelo",
      "ano",
      "fornecimento",
      "renault",
      "volkswagen",
      "chevrolet",
      "fiat",
      "ford",
      "nissan",
      "peugeot",
      "citroen",
    ];

    if (
      modelosInvalidos.includes(
        modeloNormalizado
      )
    ) {
      registro.modelo =
        null;
    }

    resultado.push(
      registro
    );
  }

  return resultado;
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
      !registro?.codigo_oem
    ) {
      continue;
    }

    const chave = [
      registro.peca || "",
      registro.codigo_oem || "",
      registro.codigo_equivalente ||
        "",
      registro.montadora || "",
      registro.modelo || "",
      registro.motor || "",
      registro.ano_inicio || "",
      registro.ano_fim || "",
    ]
      .map(
        normalizar
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

export async function parserMotrio({
  textoReferencias = "",
  textoAplicacoes = "",
  textoEquivalencias = "",
  nomeArquivo = "",
  configuracao = {},
  onProgresso,
} = {}) {
  onProgresso?.(
    "🧠 Lendo Catálogo Motrio 2024..."
  );

  /*
   * Catálogo único com várias
   * famílias.
   */

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
      "⚠️ Parser Motrio recebeu texto vazio."
    );

    return [];
  }

  const linhas =
    transformarEmLinhas(
      textoCompleto
    );

  onProgresso?.(
    `📄 Motrio: analisando ${linhas.length} linhas...`
  );

  const blocos =
    construirBlocos(
      linhas
    );

  console.log(
    "========================================"
  );

  console.log(
    "🧠 PARSER MOTRIO 2024"
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
    "Produtos Motrio detectados:",
    blocos.length
  );

  console.log(
    "========================================"
  );

  const registros = [];

  for (
    let indice = 0;
    indice <
    blocos.length;
    indice += 1
  ) {
    const bloco =
      blocos[
        indice
      ];

    const encontrados =
      processarBloco({
        bloco,
        nomeArquivo,
        configuracao,
      });

    registros.push(
      ...encontrados
    );

    if (
      indice > 0 &&
      indice % 50 === 0
    ) {
      onProgresso?.(
        `🚗 Motrio: ${indice}/${blocos.length} produtos processados...`
      );
    }
  }

  /*
   * Recupera códigos que podem
   * desaparecer por OCR.
   */

  garantirCodigosMotrioConhecidos({
    texto:
      textoCompleto,

    registros,

    nomeArquivo,

    configuracao,
  });

  /*
   * Corrige aplicações conhecidas
   * que o PDF mistura em colunas.
   */

  aplicarCorrecoesMotrio(
    registros,
    {
      nomeArquivo,
      configuracao,
    }
  );

  /*
   * Limpeza final.
   */

  const registrosLimpos =
    limparRegistrosMotrio(
      registros
    );

  /*
   * Remove duplicados apenas após
   * todas as correções.
   */

  const unicos =
    removerDuplicados(
      registrosLimpos
    );

  console.log(
    "✅ MOTRIO REGISTROS:",
    unicos.length
  );

  console.log(
    "🔎 AMOSTRA MOTRIO:",
    unicos.slice(
      0,
      10
    )
  );

  console.log(
    "🔎 TESTE MOTRIO 8660089582:",
    unicos.filter(
      (item) =>
        item.codigo_oem ===
        "8660089582"
    )
  );

  console.log(
    "🔎 TESTE MOTRIO 8660089588:",
    unicos.filter(
      (item) =>
        item.codigo_oem ===
        "8660089588"
    )
  );

  console.log(
    "🔎 TESTE MOTRIO 8660009637:",
    unicos.filter(
      (item) =>
        item.codigo_oem ===
        "8660009637"
    )
  );

  onProgresso?.(
    `✅ Motrio: ${unicos.length} registro(s) encontrado(s).`
  );

  return unicos;
}

export default parserMotrio;