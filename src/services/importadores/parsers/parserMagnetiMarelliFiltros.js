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
  "ALPINA",
  "AUDI",
  "AUSTIN",
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
  "DS",
  "FIAT",
  "FORD",
  "GREAT WALL",
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
  "LIGIER",
  "MAZDA",
  "MERCEDES-BENZ",
  "MG",
  "MICROCAR",
  "MINI",
  "MITSUBISHI",
  "NISSAN",
  "OPEL",
  "PEUGEOT",
  "PIAGGIO",
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
  "TATA",
  "TOYOTA",
  "VAUXHALL",
  "VOLKSWAGEN",
  "VOLVO",
  "ZASTAVA",
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
  const texto =
    normalizar(linha);

  if (!texto) {
    return true;
  }

  const ignorar = [
    "APPLICAZIONE PER MARCA E VEICOLO",
    "VEHICLE APPLICATION GUIDE",
    "ZUORDNUNG NACH MARKE UND FAHRZEUG",
    "APLICACION POR MARCA Y VEHICULO",
    "APLICACAO POR MARCA E VEICULO",

    "MAGNETI MARELLI",
    "AFTER MARKET PARTS",

    "COSTRUTTORE E MODELLO",
    "MAKE AND MODEL",

    "ANNO DI PRODUZIONE",
    "MANUFACTURING YEAR",

    "TIPO DI CARBURANTE",
    "TYPE OF FUEL",

    "POTENZA MOTORE",
    "ENGINE POWER",

    "INFORMAZIONI TECNICHE",
    "TECHNICAL INFORMATION",

    "CODICI MAGNETI MARELLI",
    "MAGNETI MARELLI REFERENCES",

    "FILTRO PARTICELLARE",
    "PARTICLE FILTER",

    "FILTRO A CARBONI ATTIVI",
    "CARBON FILTER",

    "FILTRO ARIA",
    "AIR FILTER",

    "FILTRO CARBURANTE",
    "FUEL FILTER",

    "FILTRO OLIO",
    "OIL FILTER",

    "LONG SHORT",
    "TECHNICAL DATA",
    "DATI TECNICI",
    "CROSS REFERENCE",
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
    /^\d{1,4}$/.test(texto)
  ) {
    return true;
  }

  return false;
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
    !Number.isInteger(numero)
  ) {
    return null;
  }

  if (numero <= 30) {
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
      /\b(\d{2})\/(\d{2})\s*(?:à|a|-)\s*(?:(\d{2})\/(\d{2}))?/i
    );

  if (!resultado) {
    return null;
  }

  return {
    mesInicio:
      Number(resultado[1]),

    anoInicio:
      converterAno(
        resultado[2]
      ),

    mesFim:
      resultado[3]
        ? Number(
            resultado[3]
          )
        : null,

    anoFim:
      resultado[4]
        ? converterAno(
            resultado[4]
          )
        : null,

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
   COMBUSTÍVEL
========================================================= */

const COMBUSTIVEIS = [
  "PETROL/ELECTRIC",
  "DIESEL/ELECTRIC",
  "PETROL/ETHANOL",
  "PETROL/LPG",
  "PETROL/CNG",
  "DIESEL",
  "PETROL",
  "LPG",
  "CNG",
];

function traduzirCombustivel(
  valor = ""
) {
  const texto =
    normalizar(valor);

  const mapa = {
    PETROL: "Gasolina",
    DIESEL: "Diesel",

    "PETROL/ELECTRIC":
      "Gasolina/Elétrico",

    "DIESEL/ELECTRIC":
      "Diesel/Elétrico",

    "PETROL/ETHANOL":
      "Gasolina/Etanol",

    "PETROL/LPG":
      "Gasolina/GLP",

    "PETROL/CNG":
      "Gasolina/GNV",

    LPG: "GLP",
    CNG: "GNV",
  };

  return (
    mapa[texto] ||
    limparTexto(valor)
  );
}

function extrairCombustivel(
  linha = ""
) {
  const texto =
    normalizar(linha);

  return (
    COMBUSTIVEIS.find(
      (item) =>
        texto.includes(item)
    ) || ""
  );
}

/* =========================================================
   POTÊNCIA
========================================================= */

function extrairPotencia({
  linha = "",
  combustivel = "",
}) {
  if (!combustivel) {
    return null;
  }

  const texto =
    limparTexto(linha);

  const indice =
    normalizar(texto).indexOf(
      normalizar(combustivel)
    );

  if (indice < 0) {
    return null;
  }

  const depois =
    texto.slice(
      indice +
        combustivel.length
    );

  const resultado =
    depois.match(
      /^\s*(\d{1,3})\b/
    );

  if (!resultado) {
    return null;
  }

  const numero =
    Number(resultado[1]);

  if (
    !Number.isFinite(numero) ||
    numero < 10 ||
    numero > 500
  ) {
    return null;
  }

  return numero;
}

/* =========================================================
   CÓDIGOS MARELLI
========================================================= */

function extrairCodigosLongos(
  linha = ""
) {
  const texto =
    limparTexto(linha);

  const encontrados =
    texto.match(
      /\b(?:350203|152071|153071)\d{6}\b/g
    ) || [];

  return Array.from(
    new Set(
      encontrados.map(
        normalizarCodigo
      )
    )
  );
}

/* =========================================================
   CÓDIGOS DAS PÁGINAS DE REFERÊNCIAS
========================================================= */

function extrairCodigosReferencias(
  textoReferencias = ""
) {
  const linhas =
    String(
      textoReferencias || ""
    )
      .split(/\r?\n/)
      .map(limparTexto)
      .filter(Boolean);

  const codigos =
    new Set();

  for (const linha of linhas) {
    const diretos =
      extrairCodigosLongos(
        linha
      );

    for (
      const codigo
      of diretos
    ) {
      codigos.add(
        codigo
      );
    }

    /*
     * Algumas linhas do PDF podem
     * separar os dígitos visualmente.
     *
     * Compactamos somente a própria
     * linha para não juntar números
     * pertencentes a linhas diferentes.
     */

    const linhaCompactada =
      String(linha)
        .replace(
          /[^A-Za-z0-9]/g,
          ""
        );

    const compactados =
      extrairCodigosLongos(
        linhaCompactada
      );

    for (
      const codigo
      of compactados
    ) {
      codigos.add(
        codigo
      );
    }
  }

  return Array.from(
    codigos
  );
}

/* =========================================================
   REGISTROS QUE EXISTEM SOMENTE NA TABELA DE REFERÊNCIAS
========================================================= */

function criarRegistrosSomenteReferencias({
  textoReferencias = "",
  registrosAplicacoes = [],
  nomeArquivo = "",
  configuracao = {},
}) {
  const codigosReferencias =
    extrairCodigosReferencias(
      textoReferencias
    );

  if (
    codigosReferencias.length === 0
  ) {
    return [];
  }

  const codigosComAplicacao =
    new Set(
      registrosAplicacoes
        .map(
          (registro) =>
            normalizarCodigo(
              registro?.codigo_oem
            )
        )
        .filter(Boolean)
    );

  const registrosSomenteReferencia =
    [];

  for (
    const codigo
    of codigosReferencias
  ) {
    if (
      codigosComAplicacao.has(
        codigo
      )
    ) {
      continue;
    }

    const tipoFiltro =
      identificarTipoFiltro({
        codigo,
        posicao: 0,
        totalNaoCabine: 0,
      });

    registrosSomenteReferencia.push({
      peca:
        tipoFiltro.peca,

      fabricante:
        "Magneti Marelli",

      codigo_oem:
        codigo,

      codigo_equivalente:
        "",

      equivalentes: [],

      montadora: "",
      modelo: "",
      motor: "",

      ano_inicio: null,
      ano_fim: null,

      aplicacao: "",

      observacao:
        `Código Magneti Marelli encontrado na tabela de referências do catálogo: ${codigo}`,

      origem_catalogo:
        configuracao
          ?.origemCatalogo ||
        nomeArquivo ||
        "Catálogo Magneti Marelli Filters 2019-2020",

      tipo_catalogo:
        tipoFiltro.tipo,

      ativo: true,

      prioridade: 1,

      confiabilidade: 100,
    });
  }

  return registrosSomenteReferencia;
}

/* =========================================================
   TIPO DO FILTRO
========================================================= */

function identificarTipoFiltro({
  codigo = "",
  posicao = 0,
  totalNaoCabine = 0,
}) {
  const valor =
    normalizarCodigo(
      codigo
    );

  if (
    valor.startsWith(
      "350203"
    )
  ) {
    return {
      peca:
        "Filtro de Cabine",

      tipo:
        "filtro_cabine",
    };
  }

  if (totalNaoCabine === 3) {
    if (posicao === 0) {
      return {
        peca:
          "Filtro de Ar",

        tipo:
          "filtro_ar",
      };
    }

    if (posicao === 1) {
      return {
        peca:
          "Filtro de Combustível",

        tipo:
          "filtro_combustivel",
      };
    }

    if (posicao === 2) {
      return {
        peca:
          "Filtro de Óleo",

        tipo:
          "filtro_oleo",
      };
    }
  }

  if (
    totalNaoCabine === 1 &&
    valor.startsWith(
      "152071"
    )
  ) {
    return {
      peca:
        "Filtro de Óleo",

      tipo:
        "filtro_oleo",
    };
  }

  return {
    peca:
      "Filtro Automotivo",

    tipo:
      "filtros",
  };
}

/* =========================================================
   VERSÃO / MOTOR
========================================================= */

function extrairVersao(
  linha = "",
  periodo = null
) {
  if (!periodo) {
    return "";
  }

  const antes =
    limparTexto(
      linha.slice(
        0,
        periodo.indice
      )
    );

  return antes;
}

function extrairCodigoMotor(
  versao = ""
) {
  const texto =
    limparTexto(
      versao
    );

  const parenteses =
    texto.match(
      /\(([^)]+)\)/
    );

  if (!parenteses) {
    return "";
  }

  return limparTexto(
    parenteses[1]
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
    identificarMontadora(texto) ||
    extrairPeriodo(texto)
  ) {
    return false;
  }

  if (
    texto.length > 130
  ) {
    return false;
  }

  if (
    /^\d+$/.test(texto)
  ) {
    return false;
  }

  if (
    /\b(?:350203|152071|153071)\d{6}\b/.test(
      texto
    )
  ) {
    return false;
  }

  const normal =
    normalizar(texto);

  const termosTecnicos = [
    "LIFE-TIME-FILTER",
    "WITH A/C SYSTEM",
    "WITHOUT A/C SYSTEM",
    "FOR OE",
    "NEEDED PCS",
    "EURO 4",
    "EURO 5",
    "EURO 6",
    "PURFLUX",
    "FUEL INJECTION",
    "AUTOMATIC TRANSMISSION",
    "MANUAL GEARBOX",
    "4WD",
  ];

  if (
    termosTecnicos.some(
      (item) =>
        normal === item
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
   LINHA DE APLICAÇÃO
========================================================= */

function ehLinhaAplicacao(
  linha = ""
) {
  return Boolean(
    extrairPeriodo(linha)
  );
}

/* =========================================================
   OBSERVAÇÕES
========================================================= */

function extrairObservacoes(
  linha = ""
) {
  const texto =
    limparTexto(linha);

  const observacoes = [];

  const termos = [
    "with A/C System",
    "without A/C System",
    "LIFE-TIME-FILTER",
    "fuel injection",
    "needed pcs.",
    "for OE n.",
    "Euro 4",
    "Euro 5",
    "Euro 6",
    "Purflux",
  ];

  for (
    const termo of termos
  ) {
    if (
      normalizar(texto).includes(
        normalizar(termo)
      )
    ) {
      observacoes.push(
        termo
      );
    }
  }

  return observacoes;
}

/* =========================================================
   REGISTRO DE APLICAÇÃO
========================================================= */

function criarRegistrosLinha({
  linha,
  montadora,
  modelo,
  versaoAnterior,
  nomeArquivo,
  configuracao,
}) {
  const periodo =
    extrairPeriodo(
      linha
    );

  if (!periodo) {
    return [];
  }

  const combustivelOriginal =
    extrairCombustivel(
      linha
    );

  const combustivel =
    traduzirCombustivel(
      combustivelOriginal
    );

  const potenciaKW =
    extrairPotencia({
      linha,

      combustivel:
        combustivelOriginal,
    });

  const versaoLinha =
    extrairVersao(
      linha,
      periodo
    );

  const versao =
    limparTexto(
      versaoLinha ||
        versaoAnterior ||
        ""
    );

  const codigoMotor =
    extrairCodigoMotor(
      versao
    );

  const codigos =
    extrairCodigosLongos(
      linha
    );

  if (
    codigos.length === 0
  ) {
    return [];
  }

  const codigosNaoCabine =
    codigos.filter(
      (codigo) =>
        !codigo.startsWith(
          "350203"
        )
    );

  const observacoes =
    extrairObservacoes(
      linha
    );

  return codigos.map(
    (codigo) => {
      const posicaoNaoCabine =
        codigosNaoCabine.indexOf(
          codigo
        );

      const tipoFiltro =
        identificarTipoFiltro({
          codigo,

          posicao:
            posicaoNaoCabine,

          totalNaoCabine:
            codigosNaoCabine.length,
        });

      const observacao = [
        `Código Magneti Marelli: ${codigo}`,

        codigoMotor
          ? `Código motor: ${codigoMotor}`
          : "",

        potenciaKW !== null
          ? `Potência: ${potenciaKW} kW`
          : "",

        combustivel
          ? `Combustível: ${combustivel}`
          : "",

        observacoes.length
          ? `Informações técnicas: ${observacoes.join(
              ", "
            )}`
          : "",

        `Linha catálogo: ${linha}`,
      ]
        .filter(Boolean)
        .join(" | ");

      return {
        peca:
          tipoFiltro.peca,

        fabricante:
          "Magneti Marelli",

        codigo_oem:
          codigo,

        codigo_equivalente:
          "",

        equivalentes: [],

        montadora:
          limparTexto(
            montadora
          ),

        modelo:
          pareceModelo(modelo)
            ? limparTexto(
                modelo
              )
            : "",

        motor:
          versao,

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
          "Catálogo Magneti Marelli Filters 2019-2020",

        tipo_catalogo:
          tipoFiltro.tipo,

        ativo: true,

        prioridade: 1,

        confiabilidade: 100,
      };
    }
  );
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

export async function parserMagnetiMarelliFiltros({
  textoReferencias = "",
  textoAplicacoes = "",
  textoEquivalencias = "",
  configuracao = {},
  nomeArquivo = "",
  onProgresso,
}) {
  onProgresso?.(
    "🧰 Interpretando catálogo Magneti Marelli Filters 2019-2020..."
  );

  const linhas =
    String(
      textoAplicacoes || ""
    )
      .split(/\r?\n/)
      .map(limparTexto)
      .filter(Boolean);

  const registros = [];

  let montadoraAtual = "";
  let modeloAtual = "";
  let versaoAtual = "";
  let ultimaAplicacao = null;

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
      ultimaAplicacao = null;

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

      const registrosLinha =
        criarRegistrosLinha({
          linha,

          montadora:
            montadoraAtual,

          modelo:
            modeloAtual,

          versaoAnterior:
            versaoAtual,

          nomeArquivo,

          configuracao,
        });

      registros.push(
        ...registrosLinha
      );

      ultimaAplicacao = {
        linha,

        montadora:
          montadoraAtual,

        modelo:
          modeloAtual,

        versaoAnterior:
          versaoAtual,
      };

      const periodo =
        extrairPeriodo(
          linha
        );

      const versaoLinha =
        extrairVersao(
          linha,
          periodo
        );

      if (versaoLinha) {
        versaoAtual =
          versaoLinha;
      }

      continue;
    }

    /* =====================================================
       CONTINUAÇÃO DE CÓDIGOS DA ÚLTIMA APLICAÇÃO
    ===================================================== */

    const codigosContinuacao =
      extrairCodigosLongos(
        linha
      );

    if (
      ultimaAplicacao &&
      !ehLinhaAplicacao(
        linha
      ) &&
      codigosContinuacao.length > 0
    ) {
      const linhaCombinada =
        limparTexto(
          `${ultimaAplicacao.linha} ${linha}`
        );

      const registrosContinuacao =
        criarRegistrosLinha({
          linha:
            linhaCombinada,

          montadora:
            ultimaAplicacao.montadora,

          modelo:
            ultimaAplicacao.modelo,

          versaoAnterior:
            ultimaAplicacao.versaoAnterior,

          nomeArquivo,

          configuracao,
        });

      registros.push(
        ...registrosContinuacao
      );

      ultimaAplicacao = {
        ...ultimaAplicacao,

        linha:
          linhaCombinada,
      };

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
      ultimaAplicacao = null;

      continue;
    }
  }

  /* =====================================================
     COMPLETA COM AS REFERÊNCIAS DAS PÁGINAS 19–25
  ===================================================== */

  const registrosSomenteReferencias =
    criarRegistrosSomenteReferencias({
      textoReferencias,

      registrosAplicacoes:
        registros,

      nomeArquivo,

      configuracao,
    });

  const registrosComReferencias = [
    ...registros,
    ...registrosSomenteReferencias,
  ];

  const registrosUnicos =
    removerDuplicados(
      registrosComReferencias
    );

  console.log(
    "MARELLI FILTROS APLICAÇÕES:",
    registros.length
  );

  console.log(
    "MARELLI FILTROS SOMENTE REFERÊNCIAS:",
    registrosSomenteReferencias.length
  );

  console.log(
    "MARELLI FILTROS ENCONTRADOS:",
    registrosComReferencias.length
  );

  console.log(
    "MARELLI FILTROS ÚNICOS:",
    registrosUnicos.length
  );

  /* =====================================================
     TESTE FILTRO CABINE
  ===================================================== */

  const testeCabine =
    registrosUnicos.filter(
      (registro) =>
        registro.codigo_oem ===
        "350203061910"
    );

  console.log(
    "TESTE FILTRO CABINE 350203061910:",
    testeCabine.slice(
      0,
      20
    )
  );

  /* =====================================================
     TESTE 153071760431
  ===================================================== */

  const testeAr =
    registrosUnicos.filter(
      (registro) =>
        registro.codigo_oem ===
        "153071760431"
    );

  console.log(
    "TESTE FILTRO 153071760431:",
    testeAr.slice(
      0,
      20
    )
  );

  /* =====================================================
     TESTE 152071760871
  ===================================================== */

  const testeOleo =
    registrosUnicos.filter(
      (registro) =>
        registro.codigo_oem ===
        "152071760871"
    );

  console.log(
    "TESTE FILTRO 152071760871:",
    testeOleo.slice(
      0,
      20
    )
  );

  onProgresso?.(
    `✅ Magneti Marelli Filtros: ${registrosUnicos.length} registro(s) encontrado(s).`
  );

  return registrosUnicos.map(
    enriquecerSeguro
  );
}

export default parserMagnetiMarelliFiltros;