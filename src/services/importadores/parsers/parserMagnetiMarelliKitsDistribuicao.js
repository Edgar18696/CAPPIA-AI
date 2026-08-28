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
    .toUpperCase()
    .trim();
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
  "DAIHATSU",
  "DODGE",
  "FIAT",
  "FORD",
  "HONDA",
  "HYUNDAI",
  "INNOCENTI",
  "IVECO",
  "JAGUAR",
  "JEEP",
  "KIA",
  "LADA",
  "LANCIA",
  "LAND ROVER",
  "MAZDA",
  "MERCEDES-BENZ",
  "MG",
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

function identificarMontadora(linha = "") {
  const texto = normalizar(linha);

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

function ehCabecalho(linha = "") {
  const texto = normalizar(linha);

  if (!texto) {
    return true;
  }

  const ignorar = [
    "APPLICAZIONE PER MARCA E VEICOLO",
    "VEHICLE APPLICATION GUIDE",
    "APLICACAO POR MARCA E VEICULO",
    "APLICAÇÃO POR MARCA E VEÍCULO",

    "KIT: FOTO E ELENCO COMPONENTI",
    "KIT: PHOTOS AND PARTS LIST",

    "TAVOLE DI COMPARAZIONE",
    "CROSS REFERENCE GUIDE",

    "INDICE",
    "CONTENTS",

    "INDICE COSTRUTTORI",
    "MANUFACTURERS INDEX",

    "LEGENDA",
    "LEGEND",

    "MAGNETI MARELLI",
    "AFTER MARKET PARTS",

    "LONG SHORT",
    "KW TYPE",

    "COSTRUTTORE E MODELLO",
    "MAKE AND MODEL",

    "ANNO DI PRODUZIONE",
    "MANUFACTURING YEAR",

    "CODICI MAGNETI MARELLI",
    "MAGNETI MARELLI REFERENCES",
  ];

  if (
    ignorar.some((item) =>
      texto.includes(
        normalizar(item)
      )
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

function separarSecaoAplicacoes(
  texto = ""
) {
  const completo =
    String(texto || "");

  const minusculo =
    completo.toLowerCase();

  const marcadoresFim = [
    "Kit: foto e elenco componenti",
    "Kit: photos and parts list",
    "Tavole di comparazione",
    "Cross reference guide",
  ];

  let indiceFim = -1;

  for (
    const marcador of marcadoresFim
  ) {
    const indice =
      minusculo.indexOf(
        marcador.toLowerCase()
      );

    if (
      indice >= 0 &&
      (
        indiceFim < 0 ||
        indice < indiceFim
      )
    ) {
      indiceFim = indice;
    }
  }

  if (indiceFim < 0) {
    return completo;
  }

  return completo.slice(
    0,
    indiceFim
  );
}

/* =========================================================
   ANOS
========================================================= */

function converterAno(valor = "") {
  const numero =
    Number(valor);

  if (
    !Number.isInteger(numero)
  ) {
    return null;
  }

  if (numero <= 30) {
    return 2000 + numero;
  }

  return 1900 + numero;
}
function extrairPeriodo(linha = "") {
  const texto =
    limparTexto(linha);

  /*
   * Formatos reais do catálogo:
   *
   * 09/09 à08/13
   * 12/98 à10/00
   * 06/03 à
   * 12/13 à
   *
   * O PDF pode extrair o "à"
   * colado ao mês final.
   */

  const resultado =
    texto.match(
      /\b(\d{2})\/(\d{2})\s*(?:à|a|-)\s*(?:(\d{2})\/(\d{2}))?/i
    );

  if (!resultado) {
    return null;
  }

  const mesInicio =
    Number(resultado[1]);

  const anoInicio =
    converterAno(
      resultado[2]
    );

  const mesFim =
    resultado[3]
      ? Number(resultado[3])
      : null;

  const anoFim =
    resultado[4]
      ? converterAno(
          resultado[4]
        )
      : null;

  return {
    mesInicio,

    anoInicio,

    mesFim,

    anoFim,

    texto:
      resultado[0],

    indice:
      resultado.index ?? 0,

    fimIndice:
      (resultado.index ?? 0) +
      resultado[0].length,
  };
}
/* =========================================================
   CÓDIGOS MARELLI
========================================================= */

function extrairCodigosMarelli(
  linha = ""
) {
  const texto =
    limparTexto(linha);

  /*
   * Exemplos reais:
   *
   * 341301860000 MMK0186
   * 341401860002 KWP0186K2
   * 341500000100 MCK0100
   */

  const resultado =
    texto.match(
      /\b(34\d{10})\s+([A-Z]{2,5}\d{3,6}(?:K\d+)?)\b/i
    );

  if (!resultado) {
    return null;
  }

  return {
    codigoCompleto:
      normalizarCodigo(
        resultado[1]
      ),

    codigoCurto:
      normalizarCodigo(
        resultado[2]
      ),

    indice:
      resultado.index || 0,
  };
}

/* =========================================================
   OE
========================================================= */

function extrairCodigoOE(
  linha = ""
) {
  const texto =
    limparTexto(linha);

  const resultado =
    texto.match(
      /(?:FOR\s+OE|OE)\s*:\s*([A-Z0-9.-]+)/i
    );

  if (!resultado) {
    return "";
  }

  return normalizarCodigo(
    resultado[1]
  );
}

/* =========================================================
   TIPO DO KIT
========================================================= */

function identificarTipoKit({
  codigoCompleto = "",
  codigoCurto = "",
}) {
  const curto =
    normalizarCodigo(
      codigoCurto
    );

  const longo =
    normalizarCodigo(
      codigoCompleto
    );

  if (
    curto.startsWith("MCK") ||
    longo.startsWith("3415")
  ) {
    return {
      peca:
        "Kit Corrente de Distribuição",

      tipo:
        "timing_chain_kit",
    };
  }

  if (
    curto.startsWith("KWP") ||
    longo.startsWith("3414")
  ) {
    return {
      peca:
        "Kit Distribuição com Bomba de Água",

      tipo:
        "kit_distribuicao_bomba_agua",
    };
  }

  return {
    peca:
      "Kit de Distribuição",

    tipo:
      "kit_distribuicao",
  };
}

/* =========================================================
   COMBUSTÍVEL
========================================================= */

function traduzirCombustivel(
  sigla = ""
) {
  const valor =
    normalizar(sigla);

  const mapa = {
    B: "Gasolina",
    D: "Diesel",
    "B/E": "Gasolina/Elétrico",
    "D/E": "Diesel/Elétrico",
    "B/ETH": "Gasolina/Etanol",
    "B/GNC":
      "Gasolina/GNV",
    "B/GPL":
      "Gasolina/GLP",
    GNC: "GNV",
  };

  return (
    mapa[valor] ||
    valor
  );
}

/* =========================================================
   LINHA DE APLICAÇÃO
========================================================= */

function ehLinhaAplicacao(
  linha = ""
) {
  return Boolean(
    extrairPeriodo(linha) &&
      extrairCodigosMarelli(linha)
  );
}

/* =========================================================
   PARTE ANTES DO PERÍODO
========================================================= */

function textoAntesPeriodo({
  linha,
  periodo,
}) {
  if (!periodo) {
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
   VERSÃO DO MOTOR
========================================================= */

function pareceVersaoMotor(
  linha = ""
) {
  const texto =
    limparTexto(linha);

  if (!texto) {
    return false;
  }

  if (
    ehCabecalho(texto) ||
    identificarMontadora(texto) ||
    ehLinhaAplicacao(texto)
  ) {
    return false;
  }

  return (
    /^\d(?:\.\d+)?(?:\s+.*)?$/i.test(
      texto
    ) ||
    /^\d(?:\.\d+)?\s*;\s*\d/i.test(
      texto
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

  const textoNormalizado =
    normalizar(texto);

  if (
    ehCabecalho(texto) ||
    identificarMontadora(texto) ||
    ehLinhaAplicacao(texto) ||
    pareceVersaoMotor(texto)
  ) {
    return false;
  }

  if (
    texto.length > 100
  ) {
    return false;
  }

  /*
   * Evita restos da coluna de período.
   */
  if (
    texto === "à" ||
    texto === "a" ||
    texto === "-" ||
    /^[àa-]+$/i.test(texto)
  ) {
    return false;
  }

  if (
    /^\d+$/.test(texto)
  ) {
    return false;
  }

  /*
   * Evita códigos Marelli isolados.
   */
  if (
    /^34\d{10}$/i.test(
      texto
    )
  ) {
    return false;
  }

  if (
    /^(MMK|MCK|KWP)\d+/i.test(
      texto
    )
  ) {
    return false;
  }

  /*
   * Evita qualquer linha técnica
   * contendo referências Marelli.
   */
  if (
    /34\d{10}/i.test(texto) ||
    /\b(MMK|MCK|KWP)\d+/i.test(texto)
  ) {
    return false;
  }

  /*
   * Evita observações técnicas do catálogo
   * que estavam sendo confundidas com modelo.
   */
  const termosTecnicos = [
    "FOR OE",
    "NOT FOR OE",
    "PCS KIT",
    "SCREWS SET",
    "OIL PUMP",
    "REPLACING KIT",
    "EURO 4",
    "EURO 5",
    "EURO 6",
    "TIMING CHAIN",
    "TIMING BELT",
    "WATER PUMP",
    "KIT WITH",
    "KIT WITHOUT",
    "FITTING POSITION",
    "ENGINE TYPE",
    "FROM ENGINE",
    "TO ENGINE",
    "FROM CHASSIS",
    "TO CHASSIS",
  ];

  if (
    termosTecnicos.some((termo) =>
      textoNormalizado.includes(termo)
    )
  ) {
    return false;
  }

  if (
    texto.includes(";") &&
    /\b(OE|KIT|EURO|PCS|PUMP|SCREW|ENGINE|CHASSIS)\b/i.test(
      texto
    )
  ) {
    return false;
  }

  /*
   * Um modelo precisa conter
   * pelo menos alguma letra.
   */
  if (
    !/[A-ZÀ-Ý]/i.test(texto)
  ) {
    return false;
  }

  return true;
}

/* =========================================================
   DADOS APÓS PERÍODO
========================================================= */

function extrairDadosTecnicos({
  linha,
  periodo,
  codigos,
}) {
  const texto =
    limparTexto(linha);

  const trecho =
    limparTexto(
      texto.slice(
        periodo.fimIndice,
        codigos.indice
      )
    );

  /*
   * Exemplos:
   *
   * B 125 55253268; for OE: 71736717
   *
   * B 50 AR30500
   */

  const partes =
    trecho
      .split(/\s+/)
      .filter(Boolean);

  let combustivel = "";
  let potenciaKW = null;

  if (
    partes.length > 0
  ) {
    const possivel =
      partes[0];

    if (
      /^(B|D|B\/E|D\/E|B\/ETH|B\/GNC|B\/GPL|GNC)$/i.test(
        possivel
      )
    ) {
      combustivel =
        traduzirCombustivel(
          possivel
        );

      partes.shift();
    }
  }

  if (
    partes.length > 0 &&
    /^\d{1,3}$/.test(
      partes[0]
    )
  ) {
    const numero =
      Number(partes[0]);

    if (
      numero >= 10 &&
      numero <= 500
    ) {
      potenciaKW =
        numero;

      partes.shift();
    }
  }

  let textoMotor =
    limparTexto(
      partes.join(" ")
    );

  textoMotor =
    textoMotor
      .replace(
        /;\s*for\s+oe\s*:\s*[A-Z0-9.-]+/gi,
        ""
      )
      .replace(
        /\bfor\s+oe\s*:\s*[A-Z0-9.-]+/gi,
        ""
      );

  return {
    combustivel,

    potenciaKW,

    codigoMotor:
      limparTexto(
        textoMotor
      ),
  };
}

/* =========================================================
   LINHA QUE JÁ TRAZ VERSÃO
========================================================= */

function extrairVersaoNaMesmaLinha({
  linha,
  periodo,
}) {
  const antes =
    textoAntesPeriodo({
      linha,
      periodo,
    });

  if (!antes) {
    return "";
  }

  /*
   * Exemplo:
   * 1.2 06/83 à12/89 ...
   */

  if (
    /^\d(?:\.\d+)?(?:\s+.*)?$/i.test(
      antes
    )
  ) {
    return antes;
  }

  return "";
}

/* =========================================================
   OBSERVAÇÃO
========================================================= */

function montarObservacao({
  codigoCompleto,
  codigoCurto,
  codigoOE,
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

  if (codigoOE) {
    partes.push(
      `Referência OE: ${codigoOE}`
    );
  }

  if (codigoMotor) {
    partes.push(
      `Código motor: ${codigoMotor}`
    );
  }

  if (
    potenciaKW !== null
  ) {
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
    `Linha catálogo: ${limparTexto(
      linha
    )}`
  );

  return partes.join(
    " | "
  );
}

/* =========================================================
   REGISTRO
========================================================= */

function criarRegistro({
  linha,
  montadora,
  modelo,
  versaoAtual,
  periodo,
  codigos,
  nomeArquivo,
  configuracao,
}) {
  const codigoOE =
    extrairCodigoOE(
      linha
    );

  const dadosTecnicos =
    extrairDadosTecnicos({
      linha,
      periodo,
      codigos,
    });

  const versaoLinha =
    extrairVersaoNaMesmaLinha({
      linha,
      periodo,
    });

  const versao =
    limparTexto(
      versaoLinha ||
        versaoAtual ||
        ""
    );

  const tipoKit =
    identificarTipoKit({
      codigoCompleto:
        codigos.codigoCompleto,

      codigoCurto:
        codigos.codigoCurto,
    });

  const motor =
    limparTexto(
      [
        versao,
        dadosTecnicos.codigoMotor,
      ]
        .filter(Boolean)
        .join(" ")
    );

  const equivalentes = [
    codigos.codigoCurto,
    codigoOE,
  ].filter(Boolean);

  return {
    peca:
      tipoKit.peca,

    fabricante:
      "Magneti Marelli",

    codigo_oem:
      codigos.codigoCompleto,

    codigo_equivalente:
      equivalentes.join(
        ", "
      ),

    equivalentes,

    montadora:
      limparTexto(
        montadora
      ),

        modelo:
      pareceModelo(modelo)
        ? limparTexto(modelo)
        : "",

    motor,

    ano_inicio:
      periodo?.anoInicio ||
      null,

    ano_fim:
      periodo?.anoFim ||
      null,

    aplicacao:
      limparTexto(
        [
          montadora,
          modelo,
          versao,
          dadosTecnicos.codigoMotor,

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

        codigoOE,

        codigoMotor:
          dadosTecnicos.codigoMotor,

        potenciaKW:
          dadosTecnicos.potenciaKW,

        combustivel:
          dadosTecnicos.combustivel,

        linha,
      }),

    origem_catalogo:
      configuracao
        ?.origemCatalogo ||
      nomeArquivo ||
      "Catálogo Magneti Marelli Engine Drive System Kit 2019",

    tipo_catalogo:
      tipoKit.tipo,

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
  const mapa =
    new Map();

  for (
    const registro of registros
  ) {
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
  };
}

/* =========================================================
   PARSER PRINCIPAL
========================================================= */

export async function parserMagnetiMarelliKitsDistribuicao({
  textoAplicacoes = "",
  textoEquivalencias = "",
  configuracao = {},
  nomeArquivo = "",
  onProgresso,
}) {
  onProgresso?.(
    "⛓️ Interpretando catálogo Magneti Marelli Engine Drive System Kit..."
  );

    const secaoAplicacoes =
    String(
      textoAplicacoes || ""
    );

  const linhas =
    String(
      secaoAplicacoes || ""
    )
      .split(/\r?\n/)
      .map(limparTexto)
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

    if (
      ehCabecalho(
        linha
      )
    ) {
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

    if (
      ehLinhaAplicacao(
        linha
      )
    ) {
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
        extrairCodigosMarelli(
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
          linha,

          montadora:
            montadoraAtual,

          modelo:
            modeloAtual,

          versaoAtual,

          periodo,

          codigos,

          nomeArquivo,

          configuracao,
        });

      registros.push(
        registro
      );

      /*
       * Se a versão veio na própria
       * linha, preservamos para linhas
       * seguintes do mesmo motor.
       */

      const versaoLinha =
        extrairVersaoNaMesmaLinha({
          linha,
          periodo,
        });

      if (versaoLinha) {
        versaoAtual =
          versaoLinha;
      }

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
    "MARELLI KITS DISTRIBUIÇÃO ENCONTRADOS:",
    registros.length
  );

  console.log(
    "MARELLI KITS DISTRIBUIÇÃO ÚNICOS:",
    registrosUnicos.length
  );

  /* =====================================================
     TESTE MMK0186
  ===================================================== */

  const testeMMK0186 =
    registrosUnicos.filter(
      (registro) =>
        normalizar(
          registro.codigo_equivalente
        ).includes(
          "MMK0186"
        )
    );

  console.log(
    "TESTE MARELLI MMK0186:",
    testeMMK0186.slice(
      0,
      20
    )
  );

  /* =====================================================
     TESTE KWP0186K2
  ===================================================== */

  const testeKWP =
    registrosUnicos.filter(
      (registro) =>
        normalizar(
          registro.codigo_equivalente
        ).includes(
          "KWP0186K2"
        )
    );

  console.log(
    "TESTE MARELLI KWP0186K2:",
    testeKWP.slice(
      0,
      20
    )
  );

  onProgresso?.(
    `✅ Magneti Marelli Kits de Distribuição: ${registrosUnicos.length} registro(s) encontrado(s).`
  );

  return registrosUnicos.map(
    enriquecerSeguro
  );
}

export default parserMagnetiMarelliKitsDistribuicao;