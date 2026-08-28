import enriquecerRegistro from "../../inteligencia/enriquecerRegistro";

/* =========================================================
   TEXTO
========================================================= */

function limparTexto(valor = "") {
  return String(valor || "")
    .replace(/\u00a0/g, " ")
    .replace(
      /[\u2000-\u200b\u202f\u205f\u3000]/g,
      " "
    )
    .replace(/[→➜]/g, " à ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizar(valor = "") {
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

/* =========================================================
   MONTADORAS
========================================================= */

const MONTADORAS = [
  "ABARTH",
  "ALFA ROMEO",
  "AUDI",
  "AUTOBIANCHI",
  "BMW",
  "CHEVROLET",
  "CHRYSLER",
  "CITROEN",
  "CITROËN",
  "DACIA",
  "DAEWOO",
  "DODGE",
  "DS",
  "FERRARI",
  "FIAT",
  "FORD",
  "HONDA",
  "HYUNDAI",
  "INNOCENTI",
  "IVECO",
  "JAGUAR",
  "KIA",
  "LANCIA",
  "LAND ROVER",
  "MAZDA",
  "MERCEDES-BENZ",
  "MINI",
  "MITSUBISHI",
  "NISSAN",
  "OPEL",
  "PEUGEOT",
  "PORSCHE",
  "PUCH",
  "RENAULT",
  "RENAULT TRUCKS",
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
    normalizar(linha);

  const encontrada =
    MONTADORAS.find(
      (item) =>
        normalizar(item) === texto
    );

  if (!encontrada) {
    return "";
  }

  if (
    normalizar(encontrada) ===
    "CITROEN"
  ) {
    return "CITROËN";
  }

  return encontrada;
}

/* =========================================================
   CABEÇALHOS
========================================================= */

function ehCabecalho(
  linha = ""
) {
  const texto =
    normalizar(linha);

  if (!texto) {
    return true;
  }

  const ignorar = [
    "APPLICAZIONE PER MARCA E VEICOLO",
    "VEHICLE APPLICATION GUIDE",
    "APLICACAO POR MARCA E VEICULO",

    "APPLICAZIONE PER CODICE",
    "BUYERS GUIDE",
    "APLICACAO POR CODIGO",

    "TAVOLE DI COMPARAZIONE OE",
    "OE CROSS REFERENCE GUIDE",
    "TABELA DE EQUIVALENCIAS OE",

    "MAGNETI MARELLI",
    "PARTS & SERVICES",

    "FUEL LEVEL SENSOR",
    "FUEL SUPPLY UNIT",
    "FUEL PUMP",

    "COSTRUTTORE E MODELLO",
    "MAKE AND MODEL",
    "MONTADORA E MODELO",

    "POTENZA KW",
    "OUTPUT KW",
    "POTENCIA KW",

    "TYPE OF FUEL",
    "TIPO DE COMBUSTIVEL",

    "MANUFACTURING YEAR",
    "ANO DE FABRICACAO",

    "MAGNETI MARELLI REFERENCES",
    "CODIGOS MAGNETI MARELLI",

    "TECHNICAL INFORMATION",
    "INFORMACOES TECNICAS",

    "KW TYPE",
    "KW",
    "TYPE",
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

  if (
    /^\d{1,4}$/.test(
      texto
    )
  ) {
    return true;
  }

  return false;
}

/* =========================================================
   TIPOS DE PRODUTO
========================================================= */

function identificarTipo(
  valor = ""
) {
  const texto =
    normalizar(valor);

  if (
    texto.includes(
      "PB/KIT"
    )
  ) {
    return {
      tipo: "PB/KIT",
      peca:
        "Bomba de Combustível com Kit",
    };
  }

  if (
    texto.includes(
      "GA (F/R)"
    ) ||
    texto.includes(
      "GA(F/R)"
    )
  ) {
    return {
      tipo: "GA (F/R)",
      peca:
        "Módulo de Combustível com Filtro e Regulador",
    };
  }

  if (
    texto.includes(
      "GA (F)"
    ) ||
    texto.includes(
      "GA(F)"
    )
  ) {
    return {
      tipo: "GA (F)",
      peca:
        "Módulo de Combustível com Filtro",
    };
  }

  if (
    texto.includes(
      "GA (R)"
    ) ||
    texto.includes(
      "GA(R)"
    )
  ) {
    return {
      tipo: "GA (R)",
      peca:
        "Módulo de Combustível com Regulador",
    };
  }

  if (
    /\bCILC\b/.test(
      texto
    )
  ) {
    return {
      tipo: "CILC",
      peca:
        "Sensor de Nível de Combustível",
    };
  }

  if (
    /\bGA\b/.test(
      texto
    )
  ) {
    return {
      tipo: "GA",
      peca:
        "Módulo de Combustível",
    };
  }

  if (
    /\bPB\b/.test(
      texto
    )
  ) {
    return {
      tipo: "PB",
      peca:
        "Bomba de Combustível",
    };
  }

  return null;
}

/* =========================================================
   CÓDIGOS MARELLI
========================================================= */

function extrairDadosProduto(
  linha = ""
) {
  const texto =
    limparTexto(linha);

  const tipoInfo =
    identificarTipo(
      texto
    );

  if (!tipoInfo) {
    return null;
  }

  /*
   * Exemplos reais:
   *
   * 519700000087 GA2131 GA (F)
   * 219721287530 PI024 PB
   * 219900000144 ESS0144A PB
   * 519031309922 SUA537 GA (F/R)
   */

  const resultado =
    texto.match(
      /\b(\d{9,13})\s+([A-Z]{2,6}\d+[A-Z0-9]*)\s+(CILC|GA\s*\(F\/R\)|GA\s*\(F\)|GA\s*\(R\)|GA|PB\/KIT|PB)\b/i
    );

  if (!resultado) {
    return null;
  }

  return {
    codigoLongo:
      normalizarCodigo(
        resultado[1]
      ),

    codigoCurto:
      normalizarCodigo(
        resultado[2]
      ),

    tipo:
      tipoInfo.tipo,

    peca:
      tipoInfo.peca,

    indice:
      resultado.index ?? 0,
  };
}

/* =========================================================
   PERÍODO
========================================================= */

function converterAno(
  valor = ""
) {
  const numero =
    Number(valor);

  if (
    !Number.isInteger(
      numero
    )
  ) {
    return null;
  }

  if (
    numero <= 30
  ) {
    return 2000 + numero;
  }

  return 1900 + numero;
}

function extrairPeriodo(
  linha = ""
) {
  const texto =
    limparTexto(linha);

  const resultado =
    texto.match(
      /\b(\d{2})\/(\d{2})\s*à\s*(?:(\d{2})\/(\d{2}))?/i
    );

  if (!resultado) {
    return {
      anoInicio: null,
      anoFim: null,
      texto: "",
      indice: -1,
    };
  }

  return {
    anoInicio:
      converterAno(
        resultado[2]
      ),

    anoFim:
      resultado[4]
        ? converterAno(
            resultado[4]
          )
        : null,

    texto:
      resultado[0],

    indice:
      resultado.index ?? -1,
  };
}

/* =========================================================
   COMBUSTÍVEL
========================================================= */

function extrairCombustivel(
  linha = ""
) {
  const texto =
    normalizar(linha);

  if (
    texto.includes(
      "GASOLINE"
    )
  ) {
    return "Gasolina";
  }

  if (
    texto.includes(
      "DIESEL"
    )
  ) {
    return "Diesel";
  }

  if (
    texto.includes(
      "ETHANOL"
    )
  ) {
    return "Etanol";
  }

  if (
    texto.includes(
      "LPG"
    )
  ) {
    return "GLP";
  }

  return "";
}

/* =========================================================
   POTÊNCIA
========================================================= */

function extrairPotencia(
  linha = "",
  periodo = null
) {
  if (
    !periodo ||
    periodo.indice < 0
  ) {
    return null;
  }

  const antes =
    limparTexto(
      linha.slice(
        0,
        periodo.indice
      )
    );

  const resultado =
    antes.match(
      /\b(\d{2,3})\s+(?:Gasoline|Diesel|Ethanol|LPG)\b/i
    );

  if (!resultado) {
    return null;
  }

  const numero =
    Number(
      resultado[1]
    );

  return Number.isFinite(
    numero
  )
    ? numero
    : null;
}

/* =========================================================
   MODELO
========================================================= */

function pareceModelo(
  linha = ""
) {
  const texto =
    limparTexto(linha);

  if (!texto) {
    return false;
  }

  if (
    ehCabecalho(
      texto
    ) ||
    identificarMontadora(
      texto
    )
  ) {
    return false;
  }

  if (
    extrairDadosProduto(
      texto
    )
  ) {
    return false;
  }

  if (
    texto.length > 100
  ) {
    return false;
  }

  if (
    /\d{2}\/\d{2}\s*à/i.test(
      texto
    )
  ) {
    return false;
  }

  if (
    !/[A-ZÀ-Ý]/i.test(
      texto
    )
  ) {
    return false;
  }

  return true;
}

/* =========================================================
   APLICAÇÃO / MOTOR
========================================================= */

function extrairParteAplicacao({
  linha = "",
  periodo = null,
}) {
  if (
    !periodo ||
    periodo.indice < 0
  ) {
    return "";
  }

  return limparTexto(
    linha.slice(
      0,
      periodo.indice
    )
  );
}

/* =========================================================
   REGISTRO
========================================================= */

function criarRegistro({
  linha,
  montadora,
  modelo,
  aplicacaoAnterior,
  nomeArquivo,
  configuracao,
}) {
  const dados =
    extrairDadosProduto(
      linha
    );

  if (!dados) {
    return null;
  }

  const periodo =
    extrairPeriodo(
      linha
    );

  const combustivel =
    extrairCombustivel(
      linha
    );

  const potenciaKW =
    extrairPotencia(
      linha,
      periodo
    );

  const parteAplicacao =
    extrairParteAplicacao({
      linha,
      periodo,
    });

  const motor =
    limparTexto(
      parteAplicacao ||
      aplicacaoAnterior ||
      ""
    );

  const observacao = [
    `Código Magneti Marelli: ${dados.codigoLongo}`,

    `Referência curta: ${dados.codigoCurto}`,

    `Tipo: ${dados.tipo}`,

    combustivel
      ? `Combustível: ${combustivel}`
      : "",

    potenciaKW !== null
      ? `Potência: ${potenciaKW} kW`
      : "",

    `Linha catálogo: ${linha}`,
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    peca:
      dados.peca,

    fabricante:
      "Magneti Marelli",

    codigo_oem:
      dados.codigoLongo,

    codigo_equivalente:
      dados.codigoCurto,

    equivalentes:
      dados.codigoCurto
        ? [
            dados.codigoCurto,
          ]
        : [],

    montadora:
      limparTexto(
        montadora
      ),

    modelo:
      limparTexto(
        modelo
      ),

    motor,

    ano_inicio:
      periodo.anoInicio,

    ano_fim:
      periodo.anoFim,

    combustivel,

    aplicacao:
      limparTexto(
        [
          montadora,
          modelo,
          motor,

          periodo.anoInicio
            ? periodo.anoFim
              ? `${periodo.anoInicio} até ${periodo.anoFim}`
              : `${periodo.anoInicio} até Atual`
            : "",
        ]
          .filter(Boolean)
          .join(" ")
      ),

    observacao,

    origem_catalogo:
      configuracao
        ?.origemCatalogo ||
      nomeArquivo ||
      "Catálogo Magneti Marelli Fuel Level Sensors and Fuel Supply Units 2018-2019",

    tipo_catalogo:
      "sistema_combustivel",

    ativo: true,

    prioridade: 1,

    confiabilidade: 100,

    potencia_kw:
      potenciaKW,
  };
}

/* =========================================================
   DUPLICADOS
========================================================= */

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
      registro.peca,
      registro.codigo_oem,
      registro.codigo_equivalente,
      registro.montadora,
      registro.modelo,
      registro.motor,
      registro.ano_inicio,
      registro.ano_fim,
    ]
      .map((valor) =>
        normalizar(
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

/* =========================================================
   ENRIQUECIMENTO
========================================================= */

function enriquecerSeguro(
  registro
) {
  const enriquecido =
    enriquecerRegistro(
      registro
    ) || {};

  return {
    ...enriquecido,

    peca:
      registro.peca,

    fabricante:
      registro.fabricante,

    codigo_oem:
      registro.codigo_oem,

    codigo_equivalente:
      registro.codigo_equivalente,

    equivalentes:
      registro.equivalentes,

    montadora:
      registro.montadora,

    modelo:
      registro.modelo,

    motor:
      registro.motor,

    ano_inicio:
      registro.ano_inicio,

    ano_fim:
      registro.ano_fim,

    combustivel:
      registro.combustivel,

    aplicacao:
      registro.aplicacao,

    observacao:
      registro.observacao,

    origem_catalogo:
      registro.origem_catalogo,

    tipo_catalogo:
      registro.tipo_catalogo,

    ativo:
      registro.ativo,

    prioridade:
      registro.prioridade,

    confiabilidade:
      registro.confiabilidade,

    potencia_kw:
      registro.potencia_kw,
  };
}

/* =========================================================
   PARSER PRINCIPAL
========================================================= */

export async function parserMagnetiMarelliSistemaCombustivel({
  textoReferencias = "",
  textoAplicacoes = "",
  textoEquivalencias = "",
  configuracao = {},
  nomeArquivo = "",
  onProgresso,
}) {
  onProgresso?.(
    "⛽ Interpretando sistema de combustível Magneti Marelli..."
  );

  /*
   * Primeiro validamos aplicações.
   * Referências/equivalências serão
   * ligadas depois que esse parser
   * estiver aprovado.
   */

  const linhas =
    String(
      textoAplicacoes || ""
    )
      .split(/\r?\n/)
      .map(
        limparTexto
      )
      .filter(Boolean);

  /* =========================================================
     DIAGNÓSTICO TEMPORÁRIO
     Executa somente UMA VEZ
  ========================================================= */

  const linhasReferencias =
    String(
      textoReferencias || ""
    )
      .split(/\r?\n/)
      .map(
        limparTexto
      )
      .filter(Boolean);

  const linhasEquivalencias =
    String(
      textoEquivalencias || ""
    )
      .split(/\r?\n/)
      .map(
        limparTexto
      )
      .filter(Boolean);

  function procurarCodigo(
    codigo
  ) {
    const codigoNormalizado =
      normalizarCodigo(
        codigo
      );

    return [
      ...linhas,
      ...linhasReferencias,
      ...linhasEquivalencias,
    ].filter(
      (linha) =>
        normalizarCodigo(
          linha
        ).includes(
          codigoNormalizado
        )
    );
  }

  console.log(
    "========================================"
  );

  console.log(
    "=== DIAGNÓSTICO SISTEMA COMBUSTÍVEL ==="
  );

  console.log(
    "TIPO RECEBIDO:",
    configuracao?.tipoCatalogo
  );

  console.log(
    "TEXTO APLICAÇÕES:",
    String(
      textoAplicacoes || ""
    ).length
  );

  console.log(
    "TEXTO REFERÊNCIAS:",
    String(
      textoReferencias || ""
    ).length
  );

  console.log(
    "TEXTO EQUIVALÊNCIAS:",
    String(
      textoEquivalencias || ""
    ).length
  );

  console.log(
    "TOTAL LINHAS APLICAÇÕES:",
    linhas.length
  );

  console.log(
    "TOTAL LINHAS REFERÊNCIAS:",
    linhasReferencias.length
  );

  console.log(
    "TOTAL LINHAS EQUIVALÊNCIAS:",
    linhasEquivalencias.length
  );

  console.log(
    "PRIMEIRAS 30 LINHAS APLICAÇÕES:",
    linhas.slice(
      0,
      30
    )
  );

  console.log(
    "PRIMEIRAS 30 LINHAS REFERÊNCIAS:",
    linhasReferencias.slice(
      0,
      30
    )
  );

  console.log(
    "LINHAS COM GA2131:",
    procurarCodigo(
      "GA2131"
    )
  );

  console.log(
    "LINHAS COM PI024:",
    procurarCodigo(
      "PI024"
    )
  );

  console.log(
    "LINHAS COM ESS0039A:",
    procurarCodigo(
      "ESS0039A"
    )
  );

  console.log(
    "========================================"
  );

  /* =========================================================
     PROCESSAMENTO
  ========================================================= */

  const registros = [];

  let montadoraAtual = "";
  let modeloAtual = "";
  let aplicacaoAtual = "";

  for (
    let indice = 0;
    indice < linhas.length;
    indice += 1
  ) {
    const linha =
      linhas[indice];

    /* =====================================================
       MONTADORA
    ===================================================== */

    const montadora =
      identificarMontadora(
        linha
      );

    if (montadora) {
      montadoraAtual =
        montadora;

      modeloAtual = "";
      aplicacaoAtual = "";

      continue;
    }

    /* =====================================================
       PRODUTO
    ===================================================== */

    const dados =
      extrairDadosProduto(
        linha
      );

    if (dados) {
      const registro =
        criarRegistro({
          linha,

          montadora:
            montadoraAtual ||
            "Não identificada",

          modelo:
            modeloAtual || "",

          aplicacaoAnterior:
            aplicacaoAtual,

          nomeArquivo,

          configuracao,
        });

      if (registro) {
        registros.push(
          registro
        );

        if (
          registro.motor
        ) {
          aplicacaoAtual =
            registro.motor;
        }
      }

      continue;
    }

    /* =====================================================
       CABEÇALHOS
    ===================================================== */

    if (
      ehCabecalho(
        linha
      )
    ) {
      continue;
    }

    /* =====================================================
       MODELO
    ===================================================== */

    if (
      pareceModelo(
        linha
      )
    ) {
      modeloAtual =
        limparTexto(
          linha
        );

      aplicacaoAtual = "";

      continue;
    }
  }

  const registrosUnicos =
    removerDuplicados(
      registros
    );

  console.log(
    "MARELLI SISTEMA COMBUSTÍVEL ENCONTRADOS:",
    registros.length
  );

  console.log(
    "MARELLI SISTEMA COMBUSTÍVEL ÚNICOS:",
    registrosUnicos.length
  );

  console.log(
    "EXEMPLO SISTEMA COMBUSTÍVEL:",
    registrosUnicos[0]
  );

  console.log(
    "TESTE GA2131:",
    registrosUnicos
      .filter(
        (registro) =>
          registro
            .codigo_equivalente ===
          "GA2131"
      )
      .slice(
        0,
        20
      )
  );

  console.log(
    "TESTE PI024:",
    registrosUnicos
      .filter(
        (registro) =>
          registro
            .codigo_equivalente ===
          "PI024"
      )
      .slice(
        0,
        20
      )
  );

  console.log(
    "TESTE ESS0039A:",
    registrosUnicos
      .filter(
        (registro) =>
          registro
            .codigo_equivalente ===
          "ESS0039A"
      )
      .slice(
        0,
        20
      )
  );

  onProgresso?.(
    `✅ Magneti Marelli Sistema de Combustível: ${registrosUnicos.length} registro(s) encontrado(s).`
  );

  return registrosUnicos.map(
    enriquecerSeguro
  );
}