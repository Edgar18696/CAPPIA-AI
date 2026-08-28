import enriquecerRegistro from "../../inteligencia/enriquecerRegistro";

/* =========================================================
   TEXTO
========================================================= */

function limparTexto(valor = "") {
  return String(valor || "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u2000-\u200b\u202f\u205f\u3000]/g, " ")
    .replace(/[→➜]/g, " à ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizar(valor = "") {
  return limparTexto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function normalizarCodigo(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

/* =========================================================
   MONTADORAS
========================================================= */

const MONTADORAS = [
  "ABARTH",
  "ACURA",
  "ALFA ROMEO",
  "AUDI",
  "AUTOBIANCHI",
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
  "HONDA",
  "HYUNDAI",
  "INFINITI",
  "INNOCENTI",
  "ISUZU",
  "IVECO",
  "JAGUAR",
  "JEEP",
  "KIA",
  "LANCIA",
  "LAND ROVER",
  "LEXUS",
  "MAN",
  "MAZDA",
  "MERCEDES",
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
  "SUBARU",
  "SUZUKI",
  "TOYOTA",
  "VAUXHALL",
  "VOLKSWAGEN",
  "VOLVO",
  "ZASTAVA",
];

function identificarMontadora(linha = "") {
  const texto = normalizar(linha);

  const encontrada = MONTADORAS.find(
    (item) => normalizar(item) === texto
  );

  if (!encontrada) {
    return "";
  }

  if (normalizar(encontrada) === "CITROEN") {
    return "CITROËN";
  }

  if (normalizar(encontrada) === "MERCEDES") {
    return "MERCEDES-BENZ";
  }

  return encontrada;
}

/* =========================================================
   CABEÇALHOS
========================================================= */

function ehCabecalho(linha = "") {
  const texto = normalizar(linha);

  if (!texto) {
    return true;
  }

  const ignorar = [
    "APPLICAZIONE PER MARCA",
    "VEHICLE APPLICATION GUIDE",
    "APLICACAO POR MARCA",
    "APLICAÇÃO POR MARCA",
    "APPLICAZIONE PER CODICE",
    "BUYERS GUIDE",
    "APLICAÇÃO POR CÓDIGO",
    "APLICACAO POR CODIGO",
    "TAVOLE DI COMPARAZIONE",
    "CROSS REFERENCE GUIDE",
    "INDICE",
    "CONTENTS",
    "LEGENDA",
    "LEGEND",
    "MAGNETI MARELLI",
    "AFTER MARKET PARTS",
    "COPYRIGHT",
    "KW",
  ];

  if (
    ignorar.some((item) =>
      texto.includes(normalizar(item))
    )
  ) {
    return true;
  }

  if (/^\d{1,3}$/.test(texto)) {
    return true;
  }

  return false;
}

/* =========================================================
   SEÇÃO DE APLICAÇÕES
========================================================= */

function separarSecaoAplicacoes(texto = "") {
  const textoCompleto = String(texto || "");
  const textoMinusculo = textoCompleto.toLowerCase();

  const marcadoresFim = [
    "Applicazione per codice",
    "BUYERS GUIDE",
    "Aplicação por código",
    "Aplicacao por codigo",
  ];

  let indiceFim = -1;

  for (const marcador of marcadoresFim) {
    const indice = textoMinusculo.lastIndexOf(
      marcador.toLowerCase()
    );

    if (
      indice >= 0 &&
      (indiceFim < 0 || indice < indiceFim)
    ) {
      indiceFim = indice;
    }
  }

  if (indiceFim < 0) {
    return textoCompleto;
  }

  return textoCompleto.slice(0, indiceFim);
}

/* =========================================================
   ANO
========================================================= */

function converterAno(valor = "") {
  const numero = Number(valor);

  if (!Number.isInteger(numero)) {
    return null;
  }

  if (numero <= 30) {
    return 2000 + numero;
  }

  return 1900 + numero;
}

/* =========================================================
   PERÍODO
========================================================= */

function extrairPeriodo(linha = "") {
  const texto = limparTexto(linha);

  const resultado = texto.match(
    /\b(\d{2})\/(\d{2})\s*(?:à|a|-)\s*(?:(\d{2})\/(\d{2}))?/i
  );

  if (!resultado) {
    return null;
  }

  return {
    mesInicio: Number(resultado[1]),

    anoInicio: converterAno(
      resultado[2]
    ),

    mesFim: resultado[3]
      ? Number(resultado[3])
      : null,

    anoFim: resultado[4]
      ? converterAno(resultado[4])
      : null,

    texto: resultado[0],

    indice: resultado.index || 0,

    fimIndice:
      (resultado.index || 0) +
      resultado[0].length,
  };
}

/* =========================================================
   CÓDIGOS TERMOSTATO
========================================================= */

function extrairCodigosTermostato(linha = "") {
  const texto = limparTexto(linha);

  /*
   * Exemplo real:
   *
   * G4ED 03/02 à 08/09 77 352317100510 TE0051
   *
   * Código longo:
   * 352317100510
   *
   * Short code:
   * TE0051
   */

  const resultado = texto.match(
    /\b(352317\d{6})\s+(TE\d{4,6})\b/i
  );

  if (!resultado) {
    return null;
  }

  return {
    codigoCompleto:
      normalizarCodigo(resultado[1]),

    codigoCurto:
      normalizarCodigo(resultado[2]),
  };
}

/* =========================================================
   LINHA DE APLICAÇÃO
========================================================= */

function ehLinhaAplicacao(linha = "") {
  return Boolean(
    extrairPeriodo(linha) &&
      extrairCodigosTermostato(linha)
  );
}

/* =========================================================
   POTÊNCIA
========================================================= */

function extrairPotenciaKW({
  linha,
  codigos,
}) {
  if (!codigos?.codigoCompleto) {
    return null;
  }

  const texto = limparTexto(linha);

  const indiceCodigo = texto.indexOf(
    codigos.codigoCompleto
  );

  if (indiceCodigo < 0) {
    return null;
  }

  const antesCodigo = limparTexto(
    texto.slice(0, indiceCodigo)
  );

  const numeros =
    antesCodigo.match(/\b\d{2,3}\b/g) || [];

  if (numeros.length === 0) {
    return null;
  }

  const potencia = Number(
    numeros.at(-1)
  );

  if (
    potencia >= 15 &&
    potencia <= 600
  ) {
    return potencia;
  }

  return null;
}

/* =========================================================
   TEXTO ANTES DO PERÍODO
========================================================= */

function textoAntesPeriodo({
  linha,
  periodo,
}) {
  if (!periodo) {
    return "";
  }

  return limparTexto(
    linha.slice(0, periodo.indice)
  );
}

/* =========================================================
   CÓDIGO MOTOR
========================================================= */

function pareceCodigoMotor(valor = "") {
  const texto = limparTexto(valor);

  if (!texto) {
    return false;
  }

  const codigo = normalizarCodigo(texto);

  if (!codigo) {
    return false;
  }

  if (
    /^\d+(?:\.\d+)?$/.test(texto)
  ) {
    return false;
  }

  if (
    !/[A-Z]/i.test(codigo) ||
    !/\d/.test(codigo)
  ) {
    return false;
  }

  return /^[A-Z0-9.-]{2,15}$/i.test(
    texto
  );
}

function extrairCodigoMotor({
  linha,
  periodo,
}) {
  const antes = textoAntesPeriodo({
    linha,
    periodo,
  });

  if (!antes) {
    return "";
  }

  /*
   * Exemplos:
   *
   * G4ED
   * D4CB
   * G4GC-G
   * B 6304 S5
   * D 5244 T16
   */

  const partes = antes
    .split(/\s+/)
    .filter(Boolean);

  const candidatos = [];

  for (
    let indice = partes.length - 1;
    indice >= 0;
    indice -= 1
  ) {
    const atual = partes[indice];

    if (
      pareceCodigoMotor(atual)
    ) {
      candidatos.unshift(atual);

      if (candidatos.length >= 3) {
        break;
      }

      continue;
    }

    /*
     * Volvo utiliza códigos como:
     * B 6304 S5
     * D 5244 T16
     */

    if (
      candidatos.length > 0 &&
      /^[BD]$/i.test(atual)
    ) {
      candidatos.unshift(atual);
      break;
    }

    if (candidatos.length > 0) {
      break;
    }
  }

  return limparTexto(
    candidatos.join(" ")
  );
}

/* =========================================================
   VERSÃO / MOTOR COMERCIAL
========================================================= */

function extrairVersaoDaLinha({
  linha,
  periodo,
  codigoMotor,
}) {
  let texto = textoAntesPeriodo({
    linha,
    periodo,
  });

  if (!texto) {
    return "";
  }

  if (codigoMotor) {
    const partesMotor =
      codigoMotor.split(/\s+/);

    for (const parte of partesMotor) {
      texto = texto.replace(
        new RegExp(
          `\\b${parte.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          )}\\b`,
          "gi"
        ),
        " "
      );
    }
  }

  return limparTexto(texto);
}

/* =========================================================
   LINHA QUE PARECE VERSÃO
========================================================= */

function pareceVersaoMotor(linha = "") {
  const texto = limparTexto(linha);

  if (!texto) {
    return false;
  }

  if (
    identificarMontadora(texto) ||
    ehCabecalho(texto) ||
    ehLinhaAplicacao(texto)
  ) {
    return false;
  }

  /*
   * Exemplos:
   * 1.6
   * 2.0 CRDi
   * 2.5 TD
   * 3.0 V6
   */

  return (
    /^\d(?:\.\d+)?(?:\s+.*)?$/i.test(
      texto
    ) ||
    /^(?:D\d|T\d|CDI|CRDI|TDI|HDI).*$/i.test(
      texto
    )
  );
}

/* =========================================================
   MODELO
========================================================= */

function pareceModelo(linha = "") {
  const texto = limparTexto(linha);

  if (!texto) {
    return false;
  }

  if (
    ehCabecalho(texto) ||
    identificarMontadora(texto) ||
    ehLinhaAplicacao(texto) ||
    pareceVersaoMotor(texto)
  ) {
    return false;
  }

  if (texto.length > 100) {
    return false;
  }

  if (/^\d{1,4}$/.test(texto)) {
    return false;
  }

  /*
   * Evita códigos isolados.
   */

  if (
    /^TE\d{4,6}$/i.test(texto) ||
    /^352317\d{6}$/i.test(texto)
  ) {
    return false;
  }

  return true;
}

/* =========================================================
   COMBUSTÍVEL
========================================================= */

function detectarCombustivel(texto = "") {
  const valor = normalizar(texto);

  if (
    /\b(CRDI|TDI|TDCI|HDI|CDI|DIESEL|TD|TDI|DCI)\b/.test(
      valor
    )
  ) {
    return "Diesel";
  }

  if (
    /\bLPG\b/.test(valor)
  ) {
    return "GLP";
  }

  if (
    /\bFLEXIFUEL\b/.test(valor)
  ) {
    return "Flex";
  }

  return "";
}

/* =========================================================
   OBSERVAÇÃO
========================================================= */

function montarObservacao({
  codigoCompleto,
  codigoCurto,
  codigoMotor,
  potenciaKW,
  combustivel,
  linha,
}) {
  const partes = [];

  if (codigoCompleto) {
    partes.push(
      `Código Magneti Marelli: ${codigoCompleto}`
    );
  }

  if (codigoCurto) {
    partes.push(
      `Short code Magneti Marelli: ${codigoCurto}`
    );
  }

  if (codigoMotor) {
    partes.push(
      `Código motor: ${codigoMotor}`
    );
  }

  if (potenciaKW !== null) {
    partes.push(
      `Potência: ${potenciaKW} kW`
    );
  }

  if (combustivel) {
    partes.push(
      `Combustível: ${combustivel}`
    );
  }

  partes.push(
    `Linha catálogo: ${limparTexto(linha)}`
  );

  return partes.join(" | ");
}

/* =========================================================
   REGISTRO
========================================================= */

function criarRegistro({
  codigos,
  montadora,
  modelo,
  versaoAnterior,
  linha,
  periodo,
  nomeArquivo,
  configuracao,
}) {
  const codigoMotor =
    extrairCodigoMotor({
      linha,
      periodo,
    });

  const versaoLinha =
    extrairVersaoDaLinha({
      linha,
      periodo,
      codigoMotor,
    });

  const versao = limparTexto(
    versaoLinha ||
      versaoAnterior ||
      ""
  );

  const potenciaKW =
    extrairPotenciaKW({
      linha,
      codigos,
    });

  const combustivel =
    detectarCombustivel(
      `${versao} ${linha}`
    );

  const motor = limparTexto(
    [
      versao,
      codigoMotor,
    ]
      .filter(Boolean)
      .join(" ")
  );

  return {
    peca: "Termostato",

    fabricante:
      "Magneti Marelli",

    /*
     * O código longo é a referência
     * principal Magneti Marelli.
     */

    codigo_oem:
      codigos.codigoCompleto,

    /*
     * TE0051, TE0174 etc.
     * fica disponível também para busca.
     */

    codigo_equivalente:
      codigos.codigoCurto,

    equivalentes: [
      codigos.codigoCurto,
    ].filter(Boolean),

    montadora:
      limparTexto(montadora),

    modelo:
      limparTexto(modelo),

    motor,

    ano_inicio:
      periodo?.anoInicio || null,

    ano_fim:
      periodo?.anoFim || null,

    aplicacao:
      limparTexto(
        [
          montadora,
          modelo,
          versao,
          codigoMotor,
          periodo?.anoInicio
            ? periodo.anoFim
              ? `${periodo.anoInicio} até ${periodo.anoFim}`
              : `${periodo.anoInicio} até Atual`
            : "",
        ]
          .filter(Boolean)
          .join(" ")
      ),

    observacao:
      montarObservacao({
        codigoCompleto:
          codigos.codigoCompleto,

        codigoCurto:
          codigos.codigoCurto,

        codigoMotor,

        potenciaKW,

        combustivel,

        linha,
      }),

    origem_catalogo:
      configuracao?.origemCatalogo ||
      nomeArquivo ||
      "Catálogo Magneti Marelli Termostatos 2022",

    tipo_catalogo:
      "termostatos",

    ativo: true,

    prioridade: 1,

    confiabilidade: 100,
  };
}

/* =========================================================
   DUPLICADOS
========================================================= */

function removerDuplicados(
  registros = []
) {
  const mapa = new Map();

  for (const registro of registros) {
    const chave = [
      registro.codigo_oem,
      registro.codigo_equivalente,
      registro.montadora,
      registro.modelo,
      registro.motor,
      registro.ano_inicio,
      registro.ano_fim,
    ]
      .map(normalizar)
      .join("|");

    if (!mapa.has(chave)) {
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
   ENRIQUECIMENTO SEGURO
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
  };
}

/* =========================================================
   PARSER PRINCIPAL
========================================================= */

export async function parserMagnetiMarelliTermostatos({
  textoAplicacoes = "",
  textoEquivalencias = "",
  configuracao = {},
  nomeArquivo = "",
  onProgresso,
}) {
  onProgresso?.(
    "🌡️ Interpretando catálogo Magneti Marelli Termostatos..."
  );

  const secaoAplicacoes =
    separarSecaoAplicacoes(
      textoAplicacoes
    );

  /*
   * Alguns PDFs quebram uma linha visual
   * em duas linhas de texto.
   *
   * Exemplo:
   * G4GC 11/03
   * à07/08 104 352317101740 TE0174
   *
   * Por isso fazemos uma reconstrução
   * simples antes de interpretar.
   */

  const linhasOriginais =
    String(
      secaoAplicacoes || ""
    )
      .split(/\r?\n/)
      .map(limparTexto)
      .filter(Boolean);

  const linhas = [];

  for (
    let indice = 0;
    indice < linhasOriginais.length;
    indice += 1
  ) {
    const atual =
      linhasOriginais[indice];

    const proxima =
      linhasOriginais[
        indice + 1
      ] || "";

    const atualTemInicioPeriodo =
      /\b\d{2}\/\d{2}\s*$/i.test(
        atual
      );

    const proximaContinuaPeriodo =
      /^(?:à|a|-)\s*(?:\d{2}\/\d{2})?/i.test(
        proxima
      );

    if (
      atualTemInicioPeriodo &&
      proximaContinuaPeriodo
    ) {
      linhas.push(
        limparTexto(
          `${atual} ${proxima}`
        )
      );

      indice += 1;
      continue;
    }

    linesPush:
    linhas.push(atual);
  }

  const registros = [];

  let montadoraAtual = "";
  let modeloAtual = "";
  let versaoAtual = "";

  for (
    let indice = 0;
    indice < linhas.length;
    indice += 1
  ) {
    const linha = linhas[indice];

    if (ehCabecalho(linha)) {
      continue;
    }

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
      versaoAtual = "";

      continue;
    }

    /* =====================================================
       APLICAÇÃO
    ===================================================== */

    if (ehLinhaAplicacao(linha)) {
      if (
        !montadoraAtual ||
        !modeloAtual
      ) {
        continue;
      }

      const periodo =
        extrairPeriodo(
          linha
        );

      const codigos =
        extrairCodigosTermostato(
          linha
        );

      if (
        !periodo ||
        !codigos
      ) {
        continue;
      }

      const registro =
        criarRegistro({
          codigos,

          montadora:
            montadoraAtual,

          modelo:
            modeloAtual,

          versaoAnterior:
            versaoAtual,

          linha,
          periodo,

          nomeArquivo,
          configuracao,
        });

      registros.push(
        registro
      );

      continue;
    }

    /* =====================================================
       VERSÃO
    ===================================================== */

    if (
      pareceVersaoMotor(
        linha
      )
    ) {
      versaoAtual =
        limparTexto(
          linha
        );

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
    "MAGNETI MARELLI TERMOSTATOS ENCONTRADOS:",
    registros.length
  );

  console.log(
    "MAGNETI MARELLI TERMOSTATOS ÚNICOS:",
    registrosUnicos.length
  );

  /* =====================================================
     TESTE TE0051
  ===================================================== */

  const testeTE0051 =
    registrosUnicos.filter(
      (registro) =>
        normalizarCodigo(
          registro.codigo_equivalente
        ) === "TE0051"
    );

  console.log(
    "TESTE MARELLI TERMOSTATO TE0051:",
    testeTE0051.slice(
      0,
      20
    )
  );

  /* =====================================================
     TESTE HYUNDAI
  ===================================================== */

  const testeHyundai =
    registrosUnicos.filter(
      (registro) =>
        normalizar(
          registro.montadora
        ) === "HYUNDAI"
    );

  console.log(
    "TESTE MARELLI TERMOSTATO HYUNDAI:",
    testeHyundai.slice(
      0,
      20
    )
  );

  onProgresso?.(
    `✅ Magneti Marelli Termostatos: ${registrosUnicos.length} registro(s) encontrado(s).`
  );

  return registrosUnicos.map(
    enriquecerSeguro
  );
}

export default parserMagnetiMarelliTermostatos;