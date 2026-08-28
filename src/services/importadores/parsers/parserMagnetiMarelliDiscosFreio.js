/*
 * ============================================================
 * APPIA AI
 * MAGNETI MARELLI — DISCOS DE FREIO
 * ============================================================
 *
 * CATÁLOGO ANTIGO:
 *
 * MBD0512
 * MBD....
 *
 * CATÁLOGO NOVO BREMBO / MARELLI:
 *
 * DF0004   = Standard
 * DFCxxxx  = Co-cast / Composite
 * DFFxxxx  = Floating
 * DFMxxxx  = Max
 * DFVxxxx  = UV Coated
 * DFXxxxx  = Xtra
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
 * CÓDIGOS MARELLI
 * ============================================================
 */

function extrairCodigosDisco(
  texto = ""
) {
  const conteudo =
    normalizarTexto(texto);

  const encontrados = [];

  /*
   * Catálogo antigo:
   *
   * MBD0512
   */

  const mbd =
    conteudo.match(
      /\bMBD[A-Z0-9]{3,12}\b/g
    ) || [];

  encontrados.push(
    ...mbd
  );

  /*
   * Catálogo Brembo:
   *
   * DF0004
   * DFC0001
   * DFF0001
   * DFM0004
   * DFV0004
   * DFX0004
   */

  const df =
    conteudo.match(
      /\bDF(?:C|F|M|V|X)?\d{4,6}\b/g
    ) || [];

  encontrados.push(
    ...df
  );

  return [
    ...new Set(
      encontrados.map(
        normalizarCodigo
      )
    ),
  ];
}

function ehCodigoDisco(
  valor = ""
) {
  const codigo =
    normalizarCodigo(
      valor
    );

  return (
    /^MBD[A-Z0-9]{3,12}$/.test(
      codigo
    ) ||
    /^DF(?:C|F|M|V|X)?\d{4,6}$/.test(
      codigo
    )
  );
}

/*
 * ============================================================
 * FAMÍLIA / TIPO
 * ============================================================
 */

function identificarTipoDisco(
  codigo = ""
) {
  const valor =
    normalizarCodigo(
      codigo
    );

  if (
    valor.startsWith(
      "DFC"
    )
  ) {
    return "Co-cast / Composite";
  }

  if (
    valor.startsWith(
      "DFF"
    )
  ) {
    return "Floating";
  }

  if (
    valor.startsWith(
      "DFM"
    )
  ) {
    return "Max";
  }

  if (
    valor.startsWith(
      "DFV"
    )
  ) {
    return "UV Coated";
  }

  if (
    valor.startsWith(
      "DFX"
    )
  ) {
    return "Xtra";
  }

  if (
    valor.startsWith(
      "DF"
    )
  ) {
    return "Standard";
  }

  if (
    valor.startsWith(
      "MBD"
    )
  ) {
    return "Disco de Freio";
  }

  return "Disco de Freio";
}

/*
 * ============================================================
 * MONTADORAS
 * ============================================================
 */

const MONTADORAS = [
  "ABARTH",
  "ALFA ROMEO",
  "ARO",
  "ASTON MARTIN",
  "AUDI",
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
  "DS",
  "FIAT",
  "FORD",
  "FORD USA",
  "FSO",
  "HONDA",
  "HYUNDAI",
  "INFINITI",
  "ISUZU",
  "IVECO",
  "JAGUAR",
  "JEEP",
  "KIA",
  "LANCIA",
  "LAND ROVER",
  "LEXUS",
  "MAZDA",
  "MERCEDES-BENZ",
  "MG",
  "MINI",
  "MITSUBISHI",
  "NISSAN",
  "OPEL",
  "PERODUA",
  "PEUGEOT",
  "PIAGGIO",
  "PLYMOUTH",
  "PORSCHE",
  "PROTON",
  "PUCH",
  "RENAULT",
  "RENAULT TRUCKS",
  "ROVER",
  "SAAB",
  "SEAT",
  "SKODA",
  "ŠKODA",
  "SMART",
  "SSANGYONG",
  "SUBARU",
  "SUZUKI",
  "TESLA",
  "TOYOTA",
  "VAUXHALL",
  "VOLKSWAGEN",
  "VOLVO",
  "ZASTAVA",
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
      (item) =>
        normalizarTexto(
          item
        ) === texto
    );

  return encontrada || "";
}

/*
 * ============================================================
 * CABEÇALHOS
 * ============================================================
 */

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
    "MAGNETI MARELLI",
    "BREMBO",
    "VEHICLE APPLICATION GUIDE",
    "APPLICAZIONE PER MARCA E VEICOLO",
    "APLICACAO POR MARCA E VEICULO",
    "APLICAÇÃO POR MARCA E VEÍCULO",
    "TECHNICAL DATA",
    "DATI TECNICI",
    "DIMENSIONS",
    "DIMENSIONI",
    "OES CROSS REFERENCE",
    "IAM CROSS REFERENCE",
    "STD UV COATED MAX XTRA",
    "KW S/V",
    "KW S/V Ø TH",
    "FOR APPLICATIONS OLDER THAN",
    "PER LE APPLICAZIONI PRECEDENTI",
  ];

  return termos.some(
    (termo) =>
      texto === termo ||
      texto.startsWith(
        termo
      )
  );
}

/*
 * ============================================================
 * MODELO
 * ============================================================
 */

function pareceModelo(
  linha = ""
) {
  const texto =
    limparTexto(
      linha
    );

  if (
    !texto ||
    texto.length > 120
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
    extrairCodigosDisco(
      texto
    ).length > 0
  ) {
    return false;
  }

  /*
   * Motor:
   *
   * 1.4
   * 1.6 16V T.S.
   * 2.0 TDI
   */

  if (
    /^\d\.\d\b/i.test(
      texto
    )
  ) {
    return false;
  }

  /*
   * Linha de aplicação:
   *
   * 99 08/08 à ...
   */

  if (
    /^\d{2,3}\s+\d{1,2}\/\d{2}/.test(
      texto
    )
  ) {
    return false;
  }

  /*
   * Modelo:
   *
   * 500 / 595 / 695 (312_)
   * 145 (930_)
   * GRANDE PUNTO (199_)
   */

  return /\([A-Z0-9_ -]+\)/i.test(
    texto
  );
}

function limparModelo(
  linha = ""
) {
  return limparTexto(
    String(
      linha || ""
    ).replace(
      /\s+\d{1,2}\/\d{2}\s*[à\-].*$/i,
      ""
    )
  );
}

/*
 * ============================================================
 * MOTOR
 * ============================================================
 */

function pareceMotor(
  linha = ""
) {
  const texto =
    limparTexto(
      linha
    );

  return (
    /^\d\.\d\b/i.test(
      texto
    ) &&
    !extrairCodigosDisco(
      texto
    ).length
  );
}

function extrairMotorDaLinha(
  linha = ""
) {
  const texto =
    limparTexto(
      linha
    );

  const match =
    texto.match(
      /\b\d\.\d(?:\s+[A-Z0-9.+_-]+)*(?:\s+\([A-Z0-9._ -]+\))?/i
    );

  return match
    ? limparTexto(
        match[0]
      )
    : "";
}

/*
 * ============================================================
 * ANOS
 * ============================================================
 */

function converterAnoCurto(
  ano
) {
  const numero =
    Number(ano);

  if (
    !Number.isFinite(
      numero
    )
  ) {
    return null;
  }

  return numero <= 30
    ? 2000 + numero
    : 1900 + numero;
}

function extrairAnos(
  texto = ""
) {
  const anos = [
    ...String(
      texto || ""
    ).matchAll(
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
    anos.length === 0
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
        ...anos
      ),

    ano_fim:
      anos.length > 1
        ? Math.max(
            ...anos
          )
        : null,
  };
}

/*
 * ============================================================
 * POSIÇÃO
 * ============================================================
 */

function extrairPosicao(
  texto = ""
) {
  const valor =
    normalizarTexto(
      texto
    );

  if (
    /\bFRONT\b/.test(
      valor
    ) ||
    /\bANTERIORE\b/.test(
      valor
    ) ||
    /\bDIANTEIRO\b/.test(
      valor
    )
  ) {
    return "Dianteiro";
  }

  if (
    /\bREAR\b/.test(
      valor
    ) ||
    /\bPOSTERIORE\b/.test(
      valor
    ) ||
    /\bTRASEIRO\b/.test(
      valor
    )
  ) {
    return "Traseiro";
  }

  return "";
}

/*
 * ============================================================
 * DADOS TÉCNICOS DA APLICAÇÃO
 * ============================================================
 */

function extrairDadosTecnicosAplicacao({
  linha = "",
  codigo = "",
}) {
  const texto =
    limparTexto(
      linha
    );

  /*
   * Localiza o código sem depender
   * de espaços ou pontuação.
   */

  const regexCodigo =
    new RegExp(
      `\\b${String(
        codigo
      ).replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      )}\\b`,
      "i"
    );

  const matchCodigo =
    regexCodigo.exec(
      texto
    );

  let depoisCodigo = "";

  if (
    matchCodigo
  ) {
    depoisCodigo =
      texto.slice(
        matchCodigo.index +
        matchCodigo[0].length
      );
  }

  /*
   * Exemplo:
   *
   * PVT 284 22
   * S 240 11
   */

  const tipoMatch =
    depoisCodigo.match(
      /\b(PVT|S|V)\b/i
    );

  /*
   * Limita a leitura técnica
   * antes do próximo código Marelli.
   *
   * Evita pegar valores da aplicação
   * seguinte.
   */

  const proximoCodigo =
    depoisCodigo.search(
      /\b(?:MBD[A-Z0-9]{3,12}|DF(?:C|F|M|V|X)?\d{4,6})\b/i
    );

  const trechoTecnico =
    proximoCodigo >= 0
      ? depoisCodigo.slice(
          0,
          proximoCodigo
        )
      : depoisCodigo;

  const numeros =
    trechoTecnico.match(
      /\b\d{2,3}(?:[.,]\d+)?\b/g
    ) || [];

  return {
    tipoDisco:
      tipoMatch
        ? tipoMatch[1]
            .toUpperCase()
        : "",

    diametro:
      numeros[0] ||
      "",

    espessura:
      numeros[1] ||
      "",
  };
}

/*
 * ============================================================
 * EQUIVALÊNCIAS
 * ============================================================
 *
 * IMPORTANTE:
 *
 * O CROSS REFERENCE POSSUI PARES:
 *
 * 46445892 DF0004
 * 46445892 DFM0004
 * 46445892 DFV0004
 * 46445892 DFX0004
 *
 * Portanto:
 *
 * DF0004  -> 46445892
 * DFM0004 -> 46445892
 * DFV0004 -> 46445892
 * DFX0004 -> 46445892
 *
 * NÃO juntamos todos os códigos da página.
 * ============================================================
 */

function ehCodigoEquivalenteValido(
  valor = ""
) {
  const codigo =
    normalizarCodigo(
      valor
    );

  if (
    !codigo ||
    codigo.length < 4 ||
    codigo.length > 35
  ) {
    return false;
  }

  if (
    ehCodigoDisco(
      codigo
    )
  ) {
    return false;
  }

  if (
    /^(OES|OE|IAM|MM|STD|PVT|S|V)$/.test(
      codigo
    )
  ) {
    return false;
  }

  /*
   * Página / título / valores técnicos
   * muito pequenos não entram.
   */

  if (
    /^\d{1,3}$/.test(
      codigo
    )
  ) {
    return false;
  }

  return true;
}

function adicionarEquivalencia({
  mapa,
  codigoDisco,
  codigoEquivalente,
}) {
  const disco =
    normalizarCodigo(
      codigoDisco
    );

  const equivalente =
    normalizarCodigo(
      codigoEquivalente
    );

  if (
    !ehCodigoDisco(
      disco
    ) ||
    !ehCodigoEquivalenteValido(
      equivalente
    )
  ) {
    return;
  }

  if (
    !mapa.has(
      disco
    )
  ) {
    mapa.set(
      disco,
      new Set()
    );
  }

  mapa.get(
    disco
  ).add(
    equivalente
  );
}

/*
 * Processa pares existentes
 * em uma única linha.
 *
 * Aceita:
 *
 * 46445892 DF0004
 *
 * e também, se o PDF juntar colunas:
 *
 * 46445892 DF0004 51920094 DF0004
 */

function processarParesEquivalencia({
  linha = "",
  mapa,
}) {
  const texto =
    normalizarTexto(
      linha
    );

  /*
   * Código externo:
   *
   * letras/números e sinais comuns
   * encontrados em OE/IAM.
   *
   * Depois obrigatoriamente vem
   * um código Marelli de disco.
   */

  const regex =
    /([A-Z0-9][A-Z0-9./_-]{3,34})\s+(MBD[A-Z0-9]{3,12}|DF(?:C|F|M|V|X)?\d{4,6})\b/g;

  let match;

  while (
    (
      match =
        regex.exec(
          texto
        )
    ) !== null
  ) {
    adicionarEquivalencia({
      mapa,

      codigoEquivalente:
        match[1],

      codigoDisco:
        match[2],
    });
  }
}

function criarMapaEquivalencias(
  textoEquivalencias = ""
) {
  const linhas =
    separarLinhas(
      textoEquivalencias
    );

  const mapa =
    new Map();

  for (
    const linha
    of linhas
  ) {
    /*
     * Só processamos linhas contendo
     * código Marelli.
     */

    if (
      extrairCodigosDisco(
        linha
      ).length === 0
    ) {
      continue;
    }

    processarParesEquivalencia({
      linha,
      mapa,
    });
  }

  return mapa;
}

/*
 * ============================================================
 * REGISTRO
 * ============================================================
 */

function criarRegistro({
  codigo,
  montadora,
  modelo,
  motor,
  contexto,
  equivalentes = [],
  configuracao = {},
  nomeArquivo = "",
}) {
  const anos =
    extrairAnos(
      contexto
    );

  const dadosTecnicos =
    extrairDadosTecnicosAplicacao({
      linha:
        contexto,

      codigo,
    });

  const tipoFamilia =
    identificarTipoDisco(
      codigo
    );

  const posicao =
    extrairPosicao(
      contexto
    );

  const equivalentesUnicos =
    [
      ...new Set(
        equivalentes
          .map(
            normalizarCodigo
          )
          .filter(
            ehCodigoEquivalenteValido
          )
      ),
    ];

  const observacao = [
    `Código Magneti Marelli: ${codigo}`,

    `Linha: ${tipoFamilia}`,

    posicao
      ? `Posição: ${posicao}`
      : "",

    dadosTecnicos.tipoDisco
      ? `Tipo técnico: ${dadosTecnicos.tipoDisco}`
      : "",

    dadosTecnicos.diametro
      ? `Diâmetro: ${dadosTecnicos.diametro} mm`
      : "",

    dadosTecnicos.espessura
      ? `Espessura: ${dadosTecnicos.espessura} mm`
      : "",

    `Linha catálogo: ${contexto}`,
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    peca:
      "Disco de Freio",

    descricao:
      "Disco de Freio",

    codigo_oem:
      codigo,

    /*
     * Se não houver equivalência,
     * deixa vazio.
     *
     * NÃO colocamos o próprio código
     * como equivalente.
     */

    codigo_equivalente:
      equivalentesUnicos[0] ||
      "",

    equivalentes:
      equivalentesUnicos,

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
      extrairMotorDaLinha(
        contexto
      ) ||
      null,

    ano_inicio:
      anos.ano_inicio,

    ano_fim:
      anos.ano_fim,

    aplicacao:
      contexto,

    observacao,

    origem_catalogo:
      configuracao
        ?.origemCatalogo ||
      (
        /^DF/i.test(
          codigo
        )
          ? "Catálogo Magneti Marelli Brembo Brake Discs"
          : "Catálogo Magneti Marelli Brake Discs"
      ),

    arquivo_catalogo:
      nomeArquivo ||
      null,

    tipo_catalogo:
      "discos_freio",

    categoria:
      "Freios",

    sistema:
      "Freio",

    tipo:
      tipoFamilia,

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
              ?.equivalentes ||
            []
          ),

          ...(
            registro
              ?.equivalentes ||
            []
          ),
        ]),
      ].filter(
        ehCodigoEquivalenteValido
      );

    mapa.set(
      chave,
      {
        ...existente,

        equivalentes,

        codigo_equivalente:
          equivalentes[0] ||
          "",
      }
    );
  }

  return Array.from(
    mapa.values()
  );
}

/*
 * ============================================================
 * CONTEXTO DA APLICAÇÃO
 * ============================================================
 */

function montarContextoAplicacao({
  linhas,
  indice,
  contextoAnterior,
}) {
  return [
    ...contextoAnterior,

    linhas[
      indice
    ] || "",

    linhas[
      indice + 1
    ] || "",
  ]
    .filter(Boolean)
    .join(" ");
}

/*
 * ============================================================
 * PARSER PRINCIPAL
 * ============================================================
 */

export async function parserMagnetiMarelliDiscosFreio({
  textoReferencias = "",
  textoAplicacoes = "",
  textoEquivalencias = "",
  nomeArquivo = "",
  configuracao = {},
  onProgresso,
} = {}) {
  const ehBremboNovo =
    /brembo/i.test(
      nomeArquivo
    ) ||
    /\bDF(?:C|F|M|V|X)?\d{4,6}\b/i.test(
      textoAplicacoes
    );

  onProgresso?.(
    ehBremboNovo
      ? "🛑 Lendo Magneti Marelli / Brembo Brake Discs..."
      : "🛑 Lendo Magneti Marelli Brake Discs..."
  );

  const linhas =
    separarLinhas(
      textoAplicacoes
    );

  /*
   * ========================================================
   * CORREÇÃO PRINCIPAL
   * ========================================================
   *
   * ANTES:
   *
   * textoReferencias +
   * textoEquivalencias
   *
   * Isso misturava Dados Técnicos
   * com OE / IAM.
   *
   * AGORA:
   *
   * SOMENTE textoEquivalencias.
   * ========================================================
   */

  const mapaEquivalencias =
    criarMapaEquivalencias(
      textoEquivalencias
    );

  const registros = [];

  let montadoraAtual =
    "";

  let modeloAtual =
    "";

  let motorAtual =
    "";

  const contextoAnterior =
    [];

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

      modeloAtual =
        "";

      motorAtual =
        "";

      contextoAnterior.length =
        0;

      continue;
    }

    /*
     * ======================================================
     * CABEÇALHO
     * ======================================================
     */

    if (
      ehCabecalho(
        linha
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
      pareceModelo(
        linha
      )
    ) {
      modeloAtual =
        limparModelo(
          linha
        );

      motorAtual =
        "";

      contextoAnterior.length =
        0;

      contextoAnterior.push(
        linha
      );

      continue;
    }

    /*
     * ======================================================
     * MOTOR
     * ======================================================
     */

    if (
      pareceMotor(
        linha
      )
    ) {
      motorAtual =
        limparTexto(
          linha
        );

      contextoAnterior.push(
        linha
      );

      if (
        contextoAnterior.length >
        3
      ) {
        contextoAnterior.shift();
      }

      continue;
    }

    /*
     * ======================================================
     * CÓDIGOS DE DISCO
     * ======================================================
     */

    const codigos =
      extrairCodigosDisco(
        linha
      );

    if (
      codigos.length === 0
    ) {
      contextoAnterior.push(
        linha
      );

      if (
        contextoAnterior.length >
        3
      ) {
        contextoAnterior.shift();
      }

      continue;
    }

    /*
     * Importante:
     *
     * Não usamos mais duas linhas
     * seguintes de forma indiscriminada.
     *
     * Isso evita misturar aplicação
     * seguinte no registro atual.
     */

    const contexto =
      montarContextoAplicacao({
        linhas,

        indice,

        contextoAnterior,
      });

    for (
      const codigo
      of codigos
    ) {
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

      registros.push(
        criarRegistro({
          codigo,

          montadora:
            montadoraAtual,

          modelo:
            modeloAtual,

          motor:
            motorAtual,

          contexto,

          equivalentes,

          configuracao,

          nomeArquivo,
        })
      );
    }

    /*
     * Depois da aplicação,
     * conserva apenas contexto curto.
     */

    contextoAnterior.length =
      0;

    if (
      modeloAtual
    ) {
      contextoAnterior.push(
        modeloAtual
      );
    }

    if (
      motorAtual
    ) {
      contextoAnterior.push(
        motorAtual
      );
    }
  }

  const registrosUnicos =
    removerDuplicados(
      registros
    );

  /*
   * ========================================================
   * DIAGNÓSTICO DF0004
   * ========================================================
   */

  const df0004 =
    registrosUnicos.filter(
      (registro) =>
        normalizarCodigo(
          registro.codigo_oem
        ) ===
        "DF0004"
    );

  /*
   * ========================================================
   * DIAGNÓSTICO MBD0512
   * ========================================================
   */

  const mbd0512 =
    registrosUnicos.filter(
      (registro) =>
        normalizarCodigo(
          registro.codigo_oem
        ) ===
        "MBD0512"
    );

  /*
   * ========================================================
   * DIAGNÓSTICO EQUIVALÊNCIAS DF0004
   * ========================================================
   */

  const equivalentesDF0004 =
    mapaEquivalencias.has(
      "DF0004"
    )
      ? Array.from(
          mapaEquivalencias.get(
            "DF0004"
          )
        )
      : [];

  console.log(
    "=========================================="
  );

  console.log(
    "🛑 MARELLI BRAKE DISCS"
  );

  console.log(
    "VERSÃO:",
    ehBremboNovo
      ? "BREMBO / MARELLI NOVO"
      : "MARELLI ANTIGO"
  );

  console.log(
    "LINHAS APLICAÇÕES:",
    linhas.length
  );

  console.log(
    "MAPA EQUIVALÊNCIAS:",
    mapaEquivalencias.size
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
    "🎯 DF0004 — REGISTROS:",
    df0004.length
  );

  console.log(
    "🎯 DF0004 — EQUIVALENTES:",
    equivalentesDF0004
  );

  console.log(
    "🎯 DF0004 — APLICAÇÕES:",
    df0004.slice(
      0,
      10
    )
  );

  console.log(
    "🎯 MBD0512 — REGISTROS:",
    mbd0512.length
  );

  console.log(
    "🎯 MBD0512 — APLICAÇÕES:",
    mbd0512.slice(
      0,
      10
    )
  );

  console.log(
    "=========================================="
  );

  onProgresso?.(
    `✅ Magneti Marelli Brake Discs: ${registrosUnicos.length} registro(s) encontrado(s).`
  );

  return registrosUnicos;
}

export default parserMagnetiMarelliDiscosFreio;