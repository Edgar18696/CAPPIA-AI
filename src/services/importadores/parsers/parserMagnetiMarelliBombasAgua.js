import enriquecerRegistro from "../../inteligencia/enriquecerRegistro";

/* =========================================================
   TEXTO
========================================================= */

function limparTexto(valor = "") {
  return String(valor || "")
    .replace(/\u00a0/g, " ")
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

  if (
    normalizar(encontrada) ===
    "MERCEDES"
  ) {
    return "MERCEDES-BENZ";
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
    "APPLICAZIONE PER MARCA",
    "VEHICLE APPLICATION GUIDE",
    "APLICACAO POR MARCA",
    "APLICAÇÃO POR MARCA",
    "APPLICAZIONE PER CODICE",
    "BUYERS GUIDE",
    "TAVOLE DI COMPARAZIONE",
    "CROSS REFERENCE GUIDE",
    "INDICE",
    "CONTENTS",
    "LEGENDA",
    "LEGEND",
    "KW CM3",
    "NO. OF VALVES",
    "MAGNETI MARELLI",
    "AFTER MARKET PARTS",
    "COPYRIGHT",
  ];

  return ignorar.some(
    (item) =>
      texto.includes(
        normalizar(item)
      )
  );
}

/* =========================================================
   SEÇÕES
========================================================= */

function separarSecaoAplicacoes(
  texto = ""
) {
  const textoCompleto =
    String(texto || "");

  const textoMinusculo =
    textoCompleto.toLowerCase();

  const marcadoresFim = [
    "Applicazione per codice",
    "BUYERS GUIDE",
    "Aplicação por código",
  ];

  let indiceFim = -1;

  for (
    const marcador
    of marcadoresFim
  ) {
    const indice =
      textoMinusculo.lastIndexOf(
        marcador.toLowerCase()
      );

    if (
      indice >= 0 &&
      indice > indiceFim
    ) {
      indiceFim = indice;
    }
  }

  if (indiceFim < 0) {
    return textoCompleto;
  }

  return textoCompleto.slice(
    0,
    indiceFim
  );
}

/* =========================================================
   MAPA CÓDIGO CURTO → CÓDIGO COMPLETO
========================================================= */

function montarMapaCodigos(
  texto = ""
) {
  const mapa = new Map();

  const linhas =
    String(texto || "")
      .split(/\r?\n/)
      .map(limparTexto)
      .filter(Boolean);

  for (const linha of linhas) {
    /*
     * Exemplos reais do catálogo:
     *
     * 84063 350984063000
     * 84064 350984064000
     * 84066 350984066000
     */

    const resultado =
      linha.match(
        /\b([A-Z0-9]{5,8})\s+(3509\d{8})\b/i
      );

    if (!resultado) {
      continue;
    }

    const curto =
      normalizarCodigo(
        resultado[1]
      );

    const completo =
      normalizarCodigo(
        resultado[2]
      );

    if (
      curto &&
      completo
    ) {
      mapa.set(
        curto,
        completo
      );
    }
  }

  return mapa;
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
    !Number.isInteger(numero)
  ) {
    return null;
  }

  /*
   * Catálogo usa:
   * 08/08
   * 12/07
   * 10/96
   */

  if (numero <= 30) {
    return 2000 + numero;
  }

  return 1900 + numero;
}

function extrairPeriodo(
  linha = ""
) {
  /*
   * 08/08 à
   * 12/07 à 06/10
   * 10/96 à 09/97
   */

  const resultado =
    String(linha).match(
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
      resultado.index || 0,

    fimIndice:
      (resultado.index || 0) +
      resultado[0].length,
  };
}

/* =========================================================
   CÓDIGO MAGNETI MARELLI
========================================================= */

function extrairCodigoMarelli(
  linha = ""
) {
  const partes =
    limparTexto(linha)
      .split(" ")
      .filter(Boolean);

  /*
   * O código da bomba aparece
   * normalmente na última coluna.
   *
   * Exemplos:
   * 81369
   * 82070
   * 81708
   * 11706T
   */

  for (
    let indice =
      partes.length - 1;
    indice >= 0;
    indice -= 1
  ) {
    const valor =
      normalizarCodigo(
        partes[indice]
      );

    if (
      /^[A-Z0-9]{5,8}$/.test(
        valor
      ) &&
      /\d/.test(valor) &&
      !/^\d{4}$/.test(valor)
    ) {
      return valor;
    }
  }

  return "";
}

/* =========================================================
   POTÊNCIA
========================================================= */

function extrairPotenciaKW({
  linha,
  periodo,
}) {
  if (!periodo) {
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
    ) || [];

  if (
    numeros.length === 0
  ) {
    return null;
  }

  const potencia =
    Number(
      numeros.at(-1)
    );

  if (
    potencia >= 20 &&
    potencia <= 500
  ) {
    return potencia;
  }

  return null;
}

/* =========================================================
   CILINDRADA
========================================================= */

function extrairCilindrada({
  linha,
  periodo,
}) {
  if (!periodo) {
    return null;
  }

  const depois =
    limparTexto(
      linha.slice(
        periodo.fimIndice
      )
    );

  const resultado =
    depois.match(
      /\b(\d{1,2}\.\d{3})\b/
    );

  if (!resultado) {
    return null;
  }

  const numero =
    Number(
      resultado[1]
        .replace(".", "")
    );

  if (
    numero >= 500 &&
    numero <= 10000
  ) {
    return numero;
  }

  return null;
}

/* =========================================================
   COMBUSTÍVEL
========================================================= */

function extrairCombustivel(
  linha = ""
) {
  const texto =
    ` ${normalizar(linha)} `;

  if (
    /\sD\s/.test(texto)
  ) {
    return "Diesel";
  }

  if (
    /\sB\s/.test(texto)
  ) {
    return "Gasolina";
  }

  return "";
}

/* =========================================================
   CÓDIGO DO MOTOR
========================================================= */

function extrairCodigoMotor({
  linha,
  codigoMarelli,
}) {
  let texto =
    limparTexto(linha);

  if (codigoMarelli) {
    texto = texto.replace(
      new RegExp(
        `${codigoMarelli}$`,
        "i"
      ),
      ""
    );
  }

  /*
   * Remove fornecedores presentes
   * em algumas linhas.
   */

  texto = texto
    .replace(
      /\b(?:PIERBURG|TESMA)\b/gi,
      " "
    )
    .trim();

  /*
   * O código de motor aparece
   * depois da coluna de válvulas.
   *
   * Exemplos:
   *
   * 312A1.000
   * 312A1.000, 312A3.000
   * F22B2
   * AR30753
   * D5244T4
   */

  const candidatos =
    texto.match(
      /\b[A-Z0-9]{2,10}(?:\.[A-Z0-9]{1,5})?\b/gi
    ) || [];

  const filtrados =
    candidatos
      .map((item) =>
        normalizarCodigo(
          item
        )
      )
      .filter(
        (item) => {
          if (!item) {
            return false;
          }

          if (
            /^[0-9]{1,4}$/.test(
              item
            )
          ) {
            return false;
          }

          if (
            [
              "PIERBURG",
              "TESMA",
              "COP",
            ].includes(item)
          ) {
            return false;
          }

          /*
           * Código motor costuma ter
           * letras + números.
           */

          return (
            /[A-Z]/.test(item) &&
            /\d/.test(item)
          );
        }
      );

  if (
    filtrados.length === 0
  ) {
    return "";
  }

  /*
   * Pegamos os últimos candidatos,
   * onde ficam os códigos dos motores.
   */

  return Array.from(
    new Set(
      filtrados.slice(-3)
    )
  ).join(", ");
}

/* =========================================================
   VERSÃO / MOTOR COMERCIAL
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
    identificarMontadora(
      texto
    )
  ) {
    return false;
  }

  if (
    extrairPeriodo(
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

  /*
   * Exemplos:
   * 1.4
   * 1.4 i.e.
   * 1.7 16V
   * D5 AWD
   * 2.0 GDI
   */

  return (
    /^\d(?:\.\d)?(?:\s.*)?$/i.test(
      texto
    ) ||
    /^(?:D\d|T\d|CDI|CRDI|TDI|HDI).*$/i.test(
      texto
    )
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
    extrairCodigoMarelli(
      linha
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
    ) ||
    ehLinhaAplicacao(
      texto
    ) ||
    pareceVersaoMotor(
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

  /*
   * Evita números de página.
   */

  if (
    /^\d{1,4}$/.test(
      texto
    )
  ) {
    return false;
  }

  return true;
}

/* =========================================================
   OBSERVAÇÃO
========================================================= */

function montarObservacao({
  potenciaKW,
  cilindrada,
  combustivel,
  codigoMotor,
  codigoCompleto,
  linha,
}) {
  const partes = [];

  if (
    potenciaKW !== null
  ) {
    partes.push(
      `Potência: ${potenciaKW} kW`
    );
  }

  if (cilindrada) {
    partes.push(
      `Cilindrada: ${cilindrada} cm³`
    );
  }

  if (combustivel) {
    partes.push(
      `Combustível: ${combustivel}`
    );
  }

  if (codigoMotor) {
    partes.push(
      `Código motor: ${codigoMotor}`
    );
  }

  if (codigoCompleto) {
    partes.push(
      `Código completo Magneti Marelli: ${codigoCompleto}`
    );
  }

  partes.push(
    `Linha catálogo: ${limparTexto(
      linha
    )}`
  );

  return partes.join(" | ");
}

/* =========================================================
   REGISTRO
========================================================= */

function criarRegistro({
  codigo,
  codigoCompleto,
  montadora,
  modelo,
  versao,
  linha,
  periodo,
  nomeArquivo,
  configuracao,
}) {
  const potenciaKW =
    extrairPotenciaKW({
      linha,
      periodo,
    });

  const cilindrada =
    extrairCilindrada({
      linha,
      periodo,
    });

  const combustivel =
    extrairCombustivel(
      linha
    );

  const codigoMotor =
    extrairCodigoMotor({
      linha,
      codigoMarelli:
        codigo,
    });

  const motor = limparTexto(
    [
      versao,
      codigoMotor,
    ]
      .filter(Boolean)
      .join(" ")
  );

  return {
    peca:
      "Bomba de Água",

    fabricante:
      "Magneti Marelli",

    /*
     * Mantemos o código curto,
     * que aparece na tabela de
     * aplicação e é muito usado
     * na consulta do catálogo.
     */

    codigo_oem:
      normalizarCodigo(
        codigo
      ),

    /*
     * Quando encontrado,
     * guardamos também o código
     * Magneti Marelli completo.
     */

    codigo_equivalente:
      codigoCompleto || "",

    equivalentes:
      codigoCompleto
        ? [codigoCompleto]
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
        potenciaKW,
        cilindrada,
        combustivel,
        codigoMotor,
        codigoCompleto,
        linha,
      }),

    origem_catalogo:
      configuracao
        ?.origemCatalogo ||
      nomeArquivo ||
      "Catálogo Magneti Marelli Bombas de Água 2017",

    tipo_catalogo:
      "bombas_agua",

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
    const registro
    of registros
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
   ENRIQUECIMENTO SEGURO
========================================================= */

function enriquecerSeguro(
  registro
) {
  const enriquecido =
    enriquecerRegistro(
      registro
    ) || {};

  /*
   * A inteligência pode complementar,
   * mas não pode trocar os dados
   * extraídos diretamente do catálogo.
   */

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

export async function parserMagnetiMarelliBombasAgua({
  textoAplicacoes = "",
  textoEquivalencias = "",
  configuracao = {},
  nomeArquivo = "",
  onProgresso,
}) {
  onProgresso?.(
    "💧 Interpretando catálogo Magneti Marelli Bombas de Água..."
  );

  /*
   * Como atualmente estamos lendo
   * o PDF inteiro, usamos todo o texto
   * para descobrir também a relação
   * código curto → código completo.
   */

  const textoCompleto = [
    textoAplicacoes,
    textoEquivalencias,
  ]
    .filter(Boolean)
    .join("\n");

  const mapaCodigos =
    montarMapaCodigos(
      textoCompleto
    );

  console.log(
    "MAGNETI MARELLI MAPA CÓDIGOS:",
    mapaCodigos.size
  );

  /*
   * Para aplicações de veículos,
   * paramos antes do Buyers Guide.
   */

  const secaoAplicacoes =
    separarSecaoAplicacoes(
      textoAplicacoes
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

      const codigo =
        extrairCodigoMarelli(
          linha
        );

      if (
        !periodo ||
        !codigo
      ) {
        continue;
      }

      const codigoCompleto =
        mapaCodigos.get(
          codigo
        ) || "";

      const registro =
        criarRegistro({
          codigo,
          codigoCompleto,

          montadora:
            montadoraAtual,

          modelo:
            modeloAtual,

          versao:
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
       VERSÃO / MOTOR
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
    "MAGNETI MARELLI BOMBAS ÁGUA ENCONTRADOS:",
    registros.length
  );

  console.log(
    "MAGNETI MARELLI BOMBAS ÁGUA ÚNICOS:",
    registrosUnicos.length
  );

  /* =====================================================
     TESTE ABARTH
  ===================================================== */

  const testeAbarth =
    registrosUnicos.filter(
      (registro) =>
        normalizar(
          registro.montadora
        ) === "ABARTH" &&
        normalizar(
          registro.modelo
        ).includes("500")
    );

  console.log(
    "TESTE MARELLI ABARTH 500:",
    testeAbarth.slice(
      0,
      20
    )
  );

  /* =====================================================
     TESTE 82070
  ===================================================== */

  const teste82070 =
    registrosUnicos.filter(
      (registro) =>
        normalizarCodigo(
          registro.codigo_oem
        ) === "82070"
    );

  console.log(
    "TESTE MARELLI 82070:",
    teste82070.slice(
      0,
      20
    )
  );

  onProgresso?.(
    `✅ Magneti Marelli Bombas de Água: ${registrosUnicos.length} registro(s) encontrado(s).`
  );

  return registrosUnicos.map(
    enriquecerSeguro
  );
}

export default parserMagnetiMarelliBombasAgua;