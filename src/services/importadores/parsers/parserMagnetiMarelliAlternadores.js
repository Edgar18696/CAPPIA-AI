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
  "CUPRA",
  "DACIA",
  "DAEWOO",
  "DAIHATSU",
  "DS",
  "FIAT",
  "FORD",
  "HONDA",
  "HYUNDAI",
  "IVECO",
  "JAGUAR",
  "JEEP",
  "KIA",
  "LADA",
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
  "PEUGEOT",
  "PIAGGIO",
  "PORSCHE",
  "RENAULT",
  "RENAULT TRUCKS",
  "ROVER",
  "SAAB",
  "SEAT",
  "SKODA",
  "SMART",
  "SSANGYONG",
  "SUZUKI",
  "TOYOTA",
  "VAUXHALL",
  "VOLKSWAGEN",
  "VOLVO",

  /* PESADOS / ESPECIAIS */

  "CASE IH",
  "CASE IH/IVECO",
  "DAF",
  "FENDT",
  "FIATALLIS/JOHN DEERE",
  "JOHN DEERE",
  "JOHN DEERE/CUMMINS",
  "MAN",
  "MULTICAR",
  "PERKINS",
  "RENAULT TRUCKS",
  "SAME",
  "SCANIA",
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
    "ZUORDNUNG NACH MARKE UND FAHRZEUG",
    "AFFECTATIONS PAR MARQUES ET VEHICULES",
    "APLICACION POR MARCA Y VEHICULO",
    "APLICACAO POR MARCA E VEICULO",

    "APPLICAZIONE PER CODICE",
    "BUYERS GUIDE",
    "ZUORDNUNG NACH BESTELLNUMMER",
    "APLICACION POR REFERENCIA",
    "APLICACAO POR CODIGO",

    "MAGNETI MARELLI",
    "PARTS & SERVICES",

    "ALTERNATORI",
    "ALTERNATORS",
    "LICHTMASCHINEN",
    "ALTERNATEURS",
    "ALTERNADORES",
    "ALTERNATORY",

    "COSTRUTTORE E MODELLO",
    "MAKE AND MODEL",

    "MOTORE",
    "MOTOR",

    "POTENZA MOTORE",
    "ENGINE POWER",

    "ANNO DI PRODUZIONE",
    "MANUFACTURING YEAR",

    "INFORMAZIONI TECNICHE",
    "TECHNICAL INFORMATION",

    "CODICI MAGNETI MARELLI",
    "MAGNETI MARELLI PARTS & SERVICES REFERENCES",

    "DATI ALTERNATORE",
    "ALTERNATOR DATA",

    "TAVOLE DI COMPARAZIONE",
    "CROSS REFERENCE GUIDE",
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
    texto === "V A" ||
    texto === "KW" ||
    texto === "V" ||
    texto === "A"
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
   CÓDIGO MARELLI
========================================================= */

function extrairCodigoMarelli(
  linha = ""
) {
  const texto =
    limparTexto(linha);

  /*
   * O código não precisa mais estar
   * obrigatoriamente no final da linha.
   *
   * Aceita:
   *
   * MQA1969
   * MQA 1969
   * MAN1807
   * MAN 1807
   */

  const resultado =
    texto.match(
      /\b((?:MQA|MAN)\s*\d{2,6})\b/i
    );

  return resultado
    ? normalizarCodigo(
        resultado[1]
      )
    : "";
}

/* =========================================================
   VOLTAGEM / AMPERAGEM
========================================================= */

function extrairDadosAlternador(
  linha = ""
) {
  const texto =
    limparTexto(linha);

  /*
   * Formato real encontrado
   * no texto extraído do PDF:
   *
   * 110 12 100 MAN1807
   *
   * Também pode ocorrer:
   *
   * 88 12 100 MQA1223
   * 132 14 120 MQA1969
   *
   * O primeiro número pode ser
   * potência do motor.
   *
   * Portanto usamos os DOIS
   * últimos números imediatamente
   * anteriores ao código como:
   *
   * tensão + amperagem.
   */

  const codigoMatch =
    texto.match(
      /\b((?:MQA|MAN)\s*\d{2,6})\b/i
    );

  if (!codigoMatch) {
    return null;
  }

  const codigo =
    normalizarCodigo(
      codigoMatch[1]
    );

  const indiceCodigo =
    codigoMatch.index ?? 0;

  const antesCodigo =
    limparTexto(
      texto.slice(
        0,
        indiceCodigo
      )
    );

  const numeros =
    antesCodigo.match(
      /\b\d{1,3}\b/g
    ) || [];

  if (
    numeros.length < 2
  ) {
    return null;
  }

  const voltagem =
    Number(
      numeros[
        numeros.length - 2
      ]
    );

  const amperagem =
    Number(
      numeros[
        numeros.length - 1
      ]
    );

  /*
   * Tensões válidas encontradas
   * nesse tipo de catálogo.
   */

  if (
    ![
      12,
      14,
      24,
      28,
    ].includes(
      voltagem
    )
  ) {
    return null;
  }

  /*
   * Proteção contra números
   * de motor/ano sendo confundidos
   * com amperagem.
   */

  if (
    !Number.isFinite(
      amperagem
    ) ||
    amperagem < 20 ||
    amperagem > 300
  ) {
    return null;
  }

  return {
    voltagem,
    amperagem,
    codigo,
    indice:
      indiceCodigo,
  };
}
/* =========================================================
   ANOS
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

  /*
   * Exemplos:
   *
   * 07/07à06/10
   * 03/98à01/01
   * 01/96à
   */

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
   OEM
========================================================= */

function extrairOes(
  linha = ""
) {
  const texto =
    limparTexto(linha);

  const encontrados = [];

  const regex =
    /\bOE\s*:\s*([A-Z0-9./-]+)/gi;

  let resultado;

  while (
    (
      resultado =
        regex.exec(texto)
    ) !== null
  ) {
    const bloco =
      String(
        resultado[1] || ""
      )
        .split("/")
        .map(
          normalizarCodigo
        )
        .filter(Boolean);

    encontrados.push(
      ...bloco
    );
  }

  return Array.from(
    new Set(
      encontrados
    )
  );
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

  const numeros =
    antes.match(
      /\b\d{2,3}\b/g
    );

  if (
    !numeros ||
    numeros.length === 0
  ) {
    return null;
  }

  const ultimo =
    Number(
      numeros[
        numeros.length - 1
      ]
    );

  if (
    !Number.isFinite(
      ultimo
    ) ||
    ultimo < 10 ||
    ultimo > 500
  ) {
    return null;
  }

  return ultimo;
}

/* =========================================================
   INFORMAÇÕES TÉCNICAS
========================================================= */

function extrairInformacaoTecnica(
  linha = "",
  periodo = null,
  dadosAlternador = null
) {
  if (
    !dadosAlternador
  ) {
    return "";
  }

  let inicio = 0;

  if (
    periodo?.indice >= 0
  ) {
    inicio =
      periodo.indice +
      periodo.texto.length;
  }

  const fim =
    dadosAlternador.indice;

  if (
    fim <= inicio
  ) {
    return "";
  }

  return limparTexto(
    linha.slice(
      inicio,
      fim
    )
  );
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
    ehCabecalho(texto) ||
    identificarMontadora(
      texto
    )
  ) {
    return false;
  }

  if (
    extrairCodigoMarelli(
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
    /^(?:OE|ENGINE|CHASSIS)\s*:/i.test(
      texto
    )
  ) {
    return false;
  }

  if (
    /\b(?:12|14|24|28)\s+\d{2,3}\s+(?:MQA|MAN)\s*\d{2,6}\b/i.test(
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
   APLICAÇÃO
========================================================= */

function linhaTemAplicacao(
  linha = ""
) {
  return Boolean(
    extrairDadosAlternador(
      linha
    )
  );
}

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
   MOTOR / VERSÃO
========================================================= */

function separarAplicacaoMotor({
  parteAplicacao = "",
  versaoAnterior = "",
}) {
  const texto =
    limparTexto(
      parteAplicacao
    );

  if (!texto) {
    return {
      versao:
        limparTexto(
          versaoAnterior
        ),

      motor: "",
    };
  }

  return {
    versao:
      texto,

    motor:
      texto,
  };
}
/* =========================================================
   REGISTRO
========================================================= */

function criarRegistro({
  linha,
  montadora,
  modelo,
  versaoAnterior,
  nomeArquivo,
  configuracao,
}) {
  const dadosAlternador =
    extrairDadosAlternador(
      linha
    );

  if (
    !dadosAlternador
  ) {
    return null;
  }

  const periodo =
    extrairPeriodo(
      linha
    );

  const parteAplicacao =
    extrairParteAplicacao({
      linha,
      periodo,
    });

  const {
    versao,
    motor,
  } =
    separarAplicacaoMotor({
      parteAplicacao,
      versaoAnterior,
    });

  const potenciaKW =
    extrairPotencia(
      linha,
      periodo
    );

  const informacaoTecnica =
    extrairInformacaoTecnica(
      linha,
      periodo,
      dadosAlternador
    );

  const oes =
    extrairOes(
      linha
    );

  const observacao = [
    `Código Magneti Marelli: ${dadosAlternador.codigo}`,

    `Tensão: ${dadosAlternador.voltagem} V`,

    `Amperagem: ${dadosAlternador.amperagem} A`,

    potenciaKW !== null
      ? `Potência motor: ${potenciaKW} kW`
      : "",

    informacaoTecnica
      ? `Informações técnicas: ${informacaoTecnica}`
      : "",

    oes.length
      ? `OEM: ${oes.join(
          ", "
        )}`
      : "",

    `Linha catálogo: ${linha}`,
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    peca:
      "Alternador",

    fabricante:
      "Magneti Marelli",

    codigo_oem:
      dadosAlternador.codigo,

    codigo_equivalente:
      oes.join(", "),

    equivalentes:
      oes,

    montadora:
      limparTexto(
        montadora
      ),

    modelo:
      limparTexto(
        modelo
      ),

    motor:
      limparTexto(
        motor
      ),

    ano_inicio:
      periodo.anoInicio,

    ano_fim:
      periodo.anoFim,

    aplicacao:
      limparTexto(
        [
          montadora,
          modelo,
          versao,

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
      "Catálogo Magneti Marelli Alternadores e Motores de Partida 2025",

    tipo_catalogo:
      "alternadores",

    ativo: true,

    prioridade: 1,

    confiabilidade: 100,

    voltagem:
      dadosAlternador.voltagem,

    amperagem:
      dadosAlternador.amperagem,

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
      registro.codigo_oem,
      registro.montadora,
      registro.modelo,
      registro.motor,
      registro.ano_inicio,
      registro.ano_fim,
      registro.voltagem,
      registro.amperagem,
    ]
      .map((valor) =>
        normalizar(
          valor
        )
      )
      .join("|");

    if (
      !mapa.has(chave)
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

    voltagem:
      registro.voltagem,

    amperagem:
      registro.amperagem,

    potencia_kw:
      registro.potencia_kw,
  };
}
/* =========================================================
   PARSER PRINCIPAL
========================================================= */
export async function parserMagnetiMarelliAlternadores({
  textoAplicacoes = "",
  textoReferencias = "",
  textoEquivalencias = "",
  configuracao = {},
  nomeArquivo = "",
  onProgresso,
}) {
  onProgresso?.(
    "⚡ Interpretando alternadores Magneti Marelli 2025..."
  );

  const linhas =
    String(
      textoAplicacoes || ""
    )
      .split(/\r?\n/)
      .map(
        limparTexto
      )
      .filter(Boolean);

  const registros = [];

  let montadoraAtual = "";
  let modeloAtual = "";
  let versaoAtual = "";

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

    const montadoraEncontrada =
      identificarMontadora(
        linha
      );

    if (
      montadoraEncontrada
    ) {
      montadoraAtual =
        montadoraEncontrada;

      modeloAtual = "";
      versaoAtual = "";

      continue;
    }

    /* =====================================================
       ALTERNADOR
    ===================================================== */

    const dadosAlternador =
      extrairDadosAlternador(
        linha
      );

    if (
      dadosAlternador
    ) {
      const registro =
        criarRegistro({
          linha,

          montadora:
            montadoraAtual ||
            "Não identificada",

          modelo:
            modeloAtual || "",

          versaoAnterior:
            versaoAtual,

          nomeArquivo,

          configuracao,
        });

      if (
        registro
      ) {
        registros.push(
          registro
        );

        if (
          registro.motor
        ) {
          versaoAtual =
            registro.motor;
        }
      }

      continue;
    }

    /* =====================================================
       IGNORAR CABEÇALHOS
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

      versaoAtual = "";

      continue;
    }
  }

  const registrosUnicos =
    removerDuplicados(
      registros
    );

  console.log(
    "MARELLI ALTERNADORES ENCONTRADOS:",
    registros.length
  );

  console.log(
    "MARELLI ALTERNADORES ÚNICOS:",
    registrosUnicos.length
  );

  console.log(
    "EXEMPLO ALTERNADOR:",
    registrosUnicos[0]
  );

  console.log(
    "TESTE MQA1969:",
    registrosUnicos
      .filter(
        (registro) =>
          registro.codigo_oem ===
          "MQA1969"
      )
      .slice(
        0,
        20
      )
  );

  console.log(
    "TESTE MQA1223:",
    registrosUnicos
      .filter(
        (registro) =>
          registro.codigo_oem ===
          "MQA1223"
      )
      .slice(
        0,
        20
      )
  );

  console.log(
    "TOTAL LINHAS RECEBIDAS:",
    linhas.length
  );

  onProgresso?.(
    `✅ Magneti Marelli Alternadores: ${registrosUnicos.length} registro(s) encontrado(s).`
  );

  return registrosUnicos.map(
    enriquecerSeguro
  );
}

export default parserMagnetiMarelliAlternadores;