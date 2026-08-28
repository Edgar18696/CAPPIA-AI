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

  "CASE IH",
  "DAF",
  "FENDT",
  "JOHN DEERE",
  "MAN",
  "PERKINS",
  "SAME",
  "SCANIA",
  "STEYR",
  "TRACK MARSHALL",
  "VM MOTORI",
  "WEATHERHILL",
  "WHITE",
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

    "MAGNETI MARELLI",
    "PARTS & SERVICES",

    "STARTER MOTORS",
    "MOTORINI DI AVVIAMENTO",
    "MOTORES DE PARTIDA",
    "MOTORES DE ARRANQUE",

    "CROSS REFERENCE GUIDE",
    "TAVOLE DI COMPARAZIONE",

    "KW V",
    "KW",
    "V",
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
   CÓDIGO MARELLI
========================================================= */

function extrairCodigoMarelli(
  linha = ""
) {
  const texto =
    limparTexto(linha);

  const resultado =
    texto.match(
      /\b((?:MQS|MSN)\s*\d{2,6})\b/i
    );

  return resultado
    ? normalizarCodigo(
        resultado[1]
      )
    : "";
}

/* =========================================================
   DADOS DO MOTOR DE PARTIDA
========================================================= */

function extrairDadosMotorPartida(
  linha = ""
) {
  const texto =
    limparTexto(linha);

  const codigoMatch =
    texto.match(
      /\b((?:MQS|MSN)\s*\d{2,6})\b/i
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

  /*
   * Exemplos reais:
   *
   * 0,9 12 MSN8060
   * 1,1 12 MQS1042
   * 2,0 12 MQS1045
   * 4,0 24 MQS047
   */

  const resultado =
    antesCodigo.match(
      /(\d+(?:[.,]\d+)?)\s+(12|24)\s*$/
    );

  if (!resultado) {
    return null;
  }

  const potenciaKW =
    Number(
      String(resultado[1])
        .replace(",", ".")
    );

  const voltagem =
    Number(
      resultado[2]
    );

  if (
    !Number.isFinite(
      potenciaKW
    ) ||
    potenciaKW <= 0 ||
    potenciaKW > 20
  ) {
    return null;
  }

  return {
    codigo,
    potenciaKW,
    voltagem,
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
   POTÊNCIA DO MOTOR DO VEÍCULO
========================================================= */

function extrairPotenciaMotor(
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
  versaoAnterior,
  nomeArquivo,
  configuracao,
}) {
  const dados =
    extrairDadosMotorPartida(
      linha
    );

  if (!dados) {
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

  const motor =
    limparTexto(
      parteAplicacao ||
      versaoAnterior ||
      ""
    );

  const potenciaMotorKW =
    extrairPotenciaMotor(
      linha,
      periodo
    );

  const oes =
    extrairOes(
      linha
    );

  const observacao = [
    `Código Magneti Marelli: ${dados.codigo}`,

    `Potência motor de partida: ${dados.potenciaKW} kW`,

    `Tensão: ${dados.voltagem} V`,

    potenciaMotorKW !== null
      ? `Potência motor veículo: ${potenciaMotorKW} kW`
      : "",

    oes.length
      ? `OEM: ${oes.join(", ")}`
      : "",

    `Linha catálogo: ${linha}`,
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    peca:
      "Motor de Partida",

    fabricante:
      "Magneti Marelli",

    codigo_oem:
      dados.codigo,

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

    motor,

    ano_inicio:
      periodo.anoInicio,

    ano_fim:
      periodo.anoFim,

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
      "Catálogo Magneti Marelli Alternadores e Motores de Partida 2025",

    tipo_catalogo:
      "motores_partida",

    ativo: true,

    prioridade: 1,

    confiabilidade: 100,

    voltagem:
      dados.voltagem,

    potencia_kw:
      dados.potenciaKW,

    potencia_motor_kw:
      potenciaMotorKW,
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
      registro.potencia_kw,
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

    potencia_kw:
      registro.potencia_kw,

    potencia_motor_kw:
      registro.potencia_motor_kw,
  };
}

/* =========================================================
   PARSER PRINCIPAL
========================================================= */

export async function parserMagnetiMarelliMotoresPartida({
  textoAplicacoes = "",
  textoReferencias = "",
  textoEquivalencias = "",
  configuracao = {},
  nomeArquivo = "",
  onProgresso,
}) {
  onProgresso?.(
    "⚙️ Interpretando motores de partida Magneti Marelli 2025..."
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

    const dados =
      extrairDadosMotorPartida(
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

          versaoAnterior:
            versaoAtual,

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
          versaoAtual =
            registro.motor;
        }
      }

      continue;
    }

    if (
      ehCabecalho(
        linha
      )
    ) {
      continue;
    }

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
    "MARELLI MOTORES PARTIDA ENCONTRADOS:",
    registros.length
  );

  console.log(
    "MARELLI MOTORES PARTIDA ÚNICOS:",
    registrosUnicos.length
  );

  console.log(
    "EXEMPLO MOTOR PARTIDA:",
    registrosUnicos[0]
  );

  console.log(
    "TESTE MSN8060:",
    registrosUnicos
      .filter(
        (registro) =>
          registro.codigo_oem ===
          "MSN8060"
      )
      .slice(0, 20)
  );

  console.log(
    "TESTE MQS1042:",
    registrosUnicos
      .filter(
        (registro) =>
          registro.codigo_oem ===
          "MQS1042"
      )
      .slice(0, 20)
  );

  onProgresso?.(
    `✅ Magneti Marelli Motores de Partida: ${registrosUnicos.length} registro(s) encontrado(s).`
  );

  return registrosUnicos.map(
    enriquecerSeguro
  );
}

export default parserMagnetiMarelliMotoresPartida;