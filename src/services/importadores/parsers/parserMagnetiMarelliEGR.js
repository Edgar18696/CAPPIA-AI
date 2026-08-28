function limparTexto(valor = "") {
  return String(valor || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function normalizarLinha(valor = "") {
  return limparTexto(valor)
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarCodigo(valor = "") {
  return String(valor || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

function extrairLinhas(texto = "") {
  return String(texto || "")
    .split(/\r?\n/)
    .map(normalizarLinha)
    .filter(Boolean);
}

function ehCodigoMarelli(valor = "") {
  return /^EV\d{3}C?$/i.test(
    normalizarCodigo(valor)
  );
}

function extrairCodigoMarelli(linha = "") {
  const match = String(linha).match(
    /\bEV\d{3}C?\b/i
  );

  return match
    ? normalizarCodigo(match[0])
    : null;
}

function extrairTodosCodigosMarelli(
  linha = ""
) {
  const matches =
    String(linha).match(
      /\bEV\d{3}C?\b/gi
    ) || [];

  return [
    ...new Set(
      matches.map(normalizarCodigo)
    ),
  ];
}

function pareceMontadora(linha = "") {
  const texto = String(linha || "").trim();

  if (!texto) {
    return false;
  }

  if (texto.length > 40) {
    return false;
  }

  if (
    /\d/.test(texto) ||
    /\bEV\d{3}/i.test(texto)
  ) {
    return false;
  }

  const ignorar = [
    "KW",
    "O.E.",
    "OE",
    "WIRE",
    "COOLER",
    "EL",
    "PN",
    "MAGNETI MARELLI",
    "VEHICLE APPLICATION GUIDE",
    "APPLICAZIONE PER MARCA E VEICOLO",
    "TECHNICAL INFORMATION",
    "INFORMAZIONI TECNICHE",
    "OE CROSS REFERENCE GUIDE",
    "IAM CROSS REFERENCE GUIDE",
  ];

  if (
    ignorar.includes(
      texto.toUpperCase()
    )
  ) {
    return false;
  }

  return (
    texto === texto.toUpperCase() &&
    /^[A-ZÀ-Ü .&'\-]+$/.test(texto)
  );
}

function pareceModelo(linha = "") {
  const texto = String(linha || "").trim();

  if (!texto) {
    return false;
  }

  if (ehCodigoMarelli(texto)) {
    return false;
  }

  if (
    /\b\d{4}\.\d{2}\s*-\s*\d{4}\.\d{2}\b/.test(
      texto
    )
  ) {
    return false;
  }

  if (
    /\bEV\d{3}C?\b/i.test(texto)
  ) {
    return false;
  }

  return (
    /\d/.test(texto) &&
    texto.length <= 80
  );
}

function extrairPeriodo(linha = "") {
  const match = String(linha).match(
    /(\d{4}\.\d{2})\s*-\s*(\d{4}\.\d{2}|(?:\s*)?)/
  );

  if (!match) {
    return {
      anoInicio: null,
      anoFim: null,
      periodo: null,
    };
  }

  const inicio = match[1] || "";
  const fim = match[2] || "";

  return {
    anoInicio:
      inicio.length >= 4
        ? Number(inicio.slice(0, 4))
        : null,

    anoFim:
      fim.length >= 4
        ? Number(fim.slice(0, 4))
        : null,

    periodo: `${inicio} - ${fim}`.trim(),
  };
}

function extrairKw(linha = "") {
  const periodo =
    String(linha).match(
      /\d{4}\.\d{2}\s*-\s*(?:\d{4}\.\d{2})?/
    );

  if (!periodo) {
    return null;
  }

  const antesPeriodo = String(linha)
    .slice(0, periodo.index)
    .trim();

  const numeros =
    antesPeriodo.match(
      /(?:^|\s)(\d{2,3})(?=\s|$)/g
    ) || [];

  if (!numeros.length) {
    return null;
  }

  const valor = Number(
    numeros[
      numeros.length - 1
    ].trim()
  );

  if (
    !Number.isFinite(valor) ||
    valor < 20 ||
    valor > 500
  ) {
    return null;
  }

  return valor;
}

function extrairMotor(
  linha = "",
  codigoMarelli = ""
) {
  let texto = String(linha || "");

  if (codigoMarelli) {
    texto = texto.replace(
      new RegExp(
        `\\b${codigoMarelli}\\b`,
        "i"
      ),
      ""
    );
  }

  texto = texto.replace(
    /\d{4}\.\d{2}\s*-\s*(?:\d{4}\.\d{2})?/,
    ""
  );

  const candidatos =
    texto.match(
      /\b[A-Z0-9]{2,}(?:[.\-][A-Z0-9]+)*(?:,\s*[A-Z0-9][A-Z0-9.\-]+)*\b/g
    ) || [];

  const ignorar = candidatos.filter(
    (item) => {
      if (/^\d+$/.test(item)) {
        return false;
      }

      if (
        /^\d\.\d$/.test(item)
      ) {
        return false;
      }

      if (
        /^EV\d{3}C?$/i.test(item)
      ) {
        return false;
      }

      return (
        /[A-Z]/.test(item) &&
        /\d/.test(item)
      );
    }
  );

  if (!ignorar.length) {
    return null;
  }

  return ignorar[
    ignorar.length - 1
  ];
}

function extrairMotorizacao(
  linha = ""
) {
  const match = String(linha).match(
    /^\s*((?:\d+[.,]\d+|[A-Z0-9]+)\s+[A-Z0-9 .+\-_/()]+?)(?=\s+\d{2,3}\s+\d{4}\.\d{2})/i
  );

  if (match) {
    return limparTexto(match[1]);
  }

  const periodo =
    String(linha).search(
      /\d{4}\.\d{2}\s*-/
    );

  if (periodo === -1) {
    return null;
  }

  let inicio = String(linha)
    .slice(0, periodo)
    .trim();

  inicio = inicio.replace(
    /\s+\d{2,3}\s*$/,
    ""
  );

  return limparTexto(inicio) || null;
}

function montarRegistroAplicacao({
  linha,
  montadora,
  modelo,
}) {
  const codigoMarelli =
    extrairCodigoMarelli(linha);

  if (!codigoMarelli) {
    return null;
  }

  const {
    anoInicio,
    anoFim,
    periodo,
  } = extrairPeriodo(linha);

  const potenciaKw =
    extrairKw(linha);

  const motor =
    extrairMotor(
      linha,
      codigoMarelli
    );

  const motorizacao =
    extrairMotorizacao(linha);

  return {
    peca: "Válvula EGR",

    fabricante:
      "Magneti Marelli",

    codigo_oem:
      codigoMarelli,

    codigo_marelli:
      codigoMarelli,

    codigo_equivalente:
      null,

    montadora:
      montadora || null,

    modelo:
      modelo || null,

    motor:
      motor || motorizacao || null,

    motorizacao:
      motorizacao || null,

    ano_inicio:
      anoInicio,

    ano_fim:
      anoFim,

    potencia_kw:
      potenciaKw,

    observacao:
      [
        periodo
          ? `Período: ${periodo}`
          : null,

        potenciaKw
          ? `Potência: ${potenciaKw} kW`
          : null,
      ]
        .filter(Boolean)
        .join(" | ") || null,

    origem_catalogo:
      "Magneti Marelli Válvulas EGR 2019",

    tipo_catalogo:
      "valvulas_egr",

    categoria:
      "Emissões",

    subcategoria:
      "Válvula EGR",

    prioridade: 1,

    confiabilidade: 95,
  };
}

function extrairAplicacoes(
  texto = ""
) {
  const linhas =
    extrairLinhas(texto);

  const registros = [];

  let montadora = null;
  let modelo = null;

  for (
    let i = 0;
    i < linhas.length;
    i++
  ) {
    const linha = linhas[i];

    if (
      pareceMontadora(linha)
    ) {
      montadora = linha;
      modelo = null;
      continue;
    }

    if (
      pareceModelo(linha) &&
      !extrairCodigoMarelli(linha)
    ) {
      modelo = linha;
      continue;
    }

    if (
      !extrairCodigoMarelli(linha)
    ) {
      continue;
    }

    const registro =
      montarRegistroAplicacao({
        linha,
        montadora,
        modelo,
      });

    if (registro) {
      registros.push(registro);
    }
  }

  return registros;
}

function extrairEquivalenciasOE(
  texto = ""
) {
  const linhas =
    extrairLinhas(texto);

  const resultado = [];

  for (const linha of linhas) {
    const codigosMarelli =
      extrairTodosCodigosMarelli(
        linha
      );

    if (!codigosMarelli.length) {
      continue;
    }

    const tokens =
      linha.split(/\s+/);

    for (
      let i = 0;
      i < tokens.length;
      i++
    ) {
      const token =
        normalizarCodigo(
          tokens[i]
        );

      if (
        !ehCodigoMarelli(token)
      ) {
        continue;
      }

      const codigoAnterior =
        tokens[i - 1]
          ? normalizarCodigo(
              tokens[i - 1]
            )
          : null;

      if (
        !codigoAnterior ||
        ehCodigoMarelli(
          codigoAnterior
        )
      ) {
        continue;
      }

      if (
        codigoAnterior.length < 4
      ) {
        continue;
      }

      resultado.push({
        codigoMarelli: token,
        codigoEquivalente:
          codigoAnterior,
        tipo: "OE",
      });
    }
  }

  return resultado;
}

function pareceMarcaIAM(
  valor = ""
) {
  const texto =
    limparTexto(valor);

  if (!texto) {
    return false;
  }

  if (/\d/.test(texto)) {
    return false;
  }

  if (texto.length > 30) {
    return false;
  }

  return /^[A-Z][A-Z0-9 .&+\-]+$/.test(
    texto
  );
}

function extrairEquivalenciasIAM(
  texto = ""
) {
  const linhas =
    extrairLinhas(texto);

  const resultado = [];

  let marcaAtual = null;

  for (const linha of linhas) {
    if (
      pareceMarcaIAM(linha) &&
      !/MAGNETI|MARELLI|IAM|CROSS|GUIDE/i.test(
        linha
      )
    ) {
      marcaAtual = linha;
    }

    const tokens =
      linha.split(/\s+/);

    for (
      let i = 0;
      i < tokens.length;
      i++
    ) {
      const token =
        normalizarCodigo(
          tokens[i]
        );

      if (
        !ehCodigoMarelli(token)
      ) {
        continue;
      }

      const equivalente =
        tokens[i - 1]
          ? normalizarCodigo(
              tokens[i - 1]
            )
          : null;

      if (
        !equivalente ||
        ehCodigoMarelli(
          equivalente
        ) ||
        equivalente.length < 3
      ) {
        continue;
      }

      resultado.push({
        codigoMarelli: token,

        codigoEquivalente:
          equivalente,

        fabricanteEquivalente:
          marcaAtual,

        tipo: "IAM",
      });
    }
  }

  return resultado;
}

function aplicarEquivalencias(
  registros = [],
  equivalenciasOE = [],
  equivalenciasIAM = []
) {
  const mapa = new Map();

  function adicionar(
    codigo,
    equivalente
  ) {
    if (
      !codigo ||
      !equivalente
    ) {
      return;
    }

    if (!mapa.has(codigo)) {
      mapa.set(codigo, []);
    }

    const lista =
      mapa.get(codigo);

    if (
      !lista.includes(
        equivalente
      )
    ) {
      lista.push(
        equivalente
      );
    }
  }

  for (
    const item of
    equivalenciasOE
  ) {
    adicionar(
      item.codigoMarelli,
      item.codigoEquivalente
    );
  }

  for (
    const item of
    equivalenciasIAM
  ) {
    adicionar(
      item.codigoMarelli,
      item.codigoEquivalente
    );
  }

  return registros.map(
    (registro) => {
      const equivalentes =
        mapa.get(
          registro.codigo_marelli
        ) || [];

      return {
        ...registro,

        equivalentes,

        codigo_equivalente:
          equivalentes[0] ||
          registro.codigo_equivalente ||
          null,
      };
    }
  );
}

function removerDuplicados(
  registros = []
) {
  const mapa = new Map();

  for (const registro of registros) {
    const chave = [
      registro.codigo_marelli || "",
      registro.montadora || "",
      registro.modelo || "",
      registro.motor || "",
      registro.ano_inicio || "",
      registro.ano_fim || "",
    ]
      .map((item) =>
        normalizarCodigo(item)
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

function separarSecoes(
  texto = ""
) {
  const conteudo =
    String(texto || "");

  const posTecnica =
    conteudo.search(
      /Informazioni tecniche|Technical information/i
    );

  const posOE =
    conteudo.search(
      /Tavole di comparazione OE|OE cross reference guide/i
    );

  const posIAM =
    conteudo.search(
      /Tavole di comparazione IAM|IAM cross reference guide/i
    );

  let aplicacoes =
    conteudo;

  let oe = "";
  let iam = "";

  if (posTecnica > 0) {
    aplicacoes =
      conteudo.slice(
        0,
        posTecnica
      );
  } else if (posOE > 0) {
    aplicacoes =
      conteudo.slice(
        0,
        posOE
      );
  }

  if (posOE >= 0) {
    oe =
      posIAM > posOE
        ? conteudo.slice(
            posOE,
            posIAM
          )
        : conteudo.slice(
            posOE
          );
  }

  if (posIAM >= 0) {
    iam =
      conteudo.slice(
        posIAM
      );
  }

  return {
    aplicacoes,
    oe,
    iam,
  };
}

export function parserMagnetiMarelliEGR(
  entrada = ""
) {
  const texto =
    typeof entrada === "string"
      ? entrada
      : entrada?.texto ||
        entrada?.conteudo ||
        entrada?.textoCompleto ||
        "";

  if (!texto) {
    return [];
  }

  const secoes =
    separarSecoes(texto);

  let registros =
    extrairAplicacoes(
      secoes.aplicacoes
    );

  const equivalenciasOE =
    extrairEquivalenciasOE(
      secoes.oe
    );

  const equivalenciasIAM =
    extrairEquivalenciasIAM(
      secoes.iam
    );

  registros =
    aplicarEquivalencias(
      registros,
      equivalenciasOE,
      equivalenciasIAM
    );

  return removerDuplicados(
    registros
  );
}

export default parserMagnetiMarelliEGR;