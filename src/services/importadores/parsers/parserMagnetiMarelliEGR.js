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

const MONTADORAS_EGR = new Set([
  "ABARTH",
  "ALFA ROMEO",
  "AUDI",
  "BMW",
  "CHEVROLET",
  "CHRYSLER",
  "CITROEN",
  "CITROËN",
  "DACIA",
  "DAEWOO",
  "FIAT",
  "FORD",
  "HONDA",
  "HYUNDAI",
  "IVECO",
  "JAGUAR",
  "JEEP",
  "KIA",
  "LANCIA",
  "LAND ROVER",
  "MAZDA",
  "MERCEDES",
  "MERCEDES-BENZ",
  "MINI",
  "MITSUBISHI",
  "NISSAN",
  "OPEL",
  "PEUGEOT",
  "PORSCHE",
  "RENAULT",
  "LEXUS",
  "MG",
  "MULTICAR",
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
  "VW",
]);

function normalizarMontadora(valor = "") {
  const texto = limparTexto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (texto === "VW") {
    return "VW";
  }

  if (texto === "CITROEN" || texto === "CITROËN") {
    return "CITROEN";
  }

  if (texto === "MERCEDES") {
    return "MERCEDES-BENZ";
  }

  return texto;
}

function pareceMontadora(linha = "") {
  const texto = normalizarMontadora(linha);

  if (!texto || /\d/.test(texto) || /\bEV\d{3}/i.test(texto)) {
    return false;
  }

  return MONTADORAS_EGR.has(texto);
}

function ehLinhaTecnica(linha = "") {
  return /^(?:KW|PN|EL|WIRE|COOLER|METAL COVER|O\.E\.|OE)\b/i.test(
    limparTexto(linha)
  );
}

function pareceModelo(linha = "") {
  const texto = String(linha || "").trim();

  if (!texto || texto.length > 80) {
    return false;
  }

  if (ehCodigoMarelli(texto) || pareceMontadora(texto) || ehLinhaTecnica(texto)) {
    return false;
  }

  if (/\d{4}\.\d{2}\s*-/.test(texto)) {
    return false;
  }

  if (/\bEV\d{3}C?\b/i.test(texto)) {
    return false;
  }

  if (/^\d+[.,]\d+\s/.test(texto)) {
    return false;
  }

  if (/\(/.test(texto) && !/^\d+[.,]\d+/.test(texto)) {
    return true;
  }

  if (/^\d/.test(texto)) {
    return false;
  }

  if (/\d/.test(texto) && !/[ \-\/]/.test(texto) && !/\(/.test(texto)) {
    return false;
  }

  const compacto = texto.replace(/\s+/g, "");
  if (compacto.length <= 5 && /^[A-Z0-9]+$/i.test(compacto)) {
    return false;
  }

  return (
    texto.length >= 4 &&
    /[A-Z]/i.test(texto) &&
    /^[A-Z0-9][A-Z0-9 .\/\-]*$/i.test(texto)
  );
}

function extrairPeriodo(linha = "") {
  const match = String(linha).match(
    /(\d{4}\.\d{2})\s*-\s*(\d{4}\.\d{2})?/
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

    periodo: fim
      ? `${inicio} - ${fim}`
      : `${inicio} -`,
  };
}

function extrairKw(linha = "") {
  const texto = String(linha || "");

  const antesEv = texto.match(
    /(?:^|\s)(\d{2,3})(?=\s+EV\d{3}C?\b)/i
  );

  const antesPeriodo = texto.match(
    /(?:^|\s)(\d{2,3})(?=\s+\d{4}\.\d{2})/
  );

  const bruto = (antesEv || antesPeriodo || [])[1];
  const valor = Number(bruto);

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

  texto = texto.replace(/\([^)]*\)/g, " ");

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

      if (
        /^(?:TDI|HDI|JTD|JTDM|CDI|CDTI|DTI|SDI|TD|KW|GDI|MPI|TWINPORT)$/i.test(
          item
        )
      ) {
        return false;
      }

      if (/^[A-Z]{2,6}$/i.test(item)) {
        return true;
      }

      return (
        /[A-Z]/i.test(item) &&
        /\d/.test(item)
      );
    }
  );

  if (!ignorar.length) {
    return null;
  }

  return ignorar.join(", ");
}

function extrairMotorizacao(
  linha = ""
) {
  const texto = String(linha || "")
    .replace(/\bEV\d{3}C?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const comCilindrada = texto.match(
    /^(\d+[.,]\d+\s+[A-Z][A-Z0-9+\/\-]*(?:\s*\([^)]+\))?)/i
  );

  if (comCilindrada) {
    return limparTexto(comCilindrada[1]);
  }

  const bmw = texto.match(
    /^(\d{3,4}\s+[A-Za-z][A-Za-z0-9]*)/
  );

  if (bmw) {
    return limparTexto(bmw[1]);
  }

  return null;
}

function montarRegistroAplicacao({
  linha,
  montadora,
  modelo,
  contexto = {},
}) {
  const codigoMarelli =
    extrairCodigoMarelli(linha);

  if (!codigoMarelli || !montadora || !modelo) {
    return null;
  }

  const extraido = extrairPeriodo(linha);
  const anoInicio = extraido.anoInicio || contexto.anoInicio || null;
  const anoFim =
    extraido.anoInicio
      ? extraido.anoFim
      : contexto.anoFim || null;
  const periodo = extraido.periodo || contexto.periodo || null;

  const potenciaKw =
    extrairKw(linha) || contexto.potenciaKw || null;

  const motor =
    extrairMotor(linha, codigoMarelli) || contexto.motor || null;

  const motorizacao =
    extrairMotorizacao(linha) || contexto.motorizacao || null;

  if (!anoInicio) {
    return null;
  }

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

function recortarGuiaAplicacoes(texto = "") {
  const conteudo = String(texto || "");
  const inicio = conteudo.search(
    /Applicazione per marca e veicolo|Vehicle application guide/i
  );

  if (inicio >= 0) {
    return conteudo.slice(inicio);
  }

  return conteudo;
}

function atualizarContexto(linha, contexto, codigoMarelli) {
  const periodo = extrairPeriodo(linha);
  const proximo = { ...contexto };

  if (periodo.periodo) {
    proximo.anoInicio = periodo.anoInicio;
    proximo.anoFim = periodo.anoFim;
    proximo.periodo = periodo.periodo;
    proximo.motor = null;
    proximo.potenciaKw = null;
    proximo.motorizacao = null;
  }

  const potenciaKw = extrairKw(linha);
  if (potenciaKw) {
    proximo.potenciaKw = potenciaKw;
  }

  const motor = extrairMotor(linha, codigoMarelli);
  if (motor) {
    proximo.motor = motor;
  }

  const motorizacao = extrairMotorizacao(linha);
  if (motorizacao) {
    proximo.motorizacao = motorizacao;
  }

  return proximo;
}

function extrairAplicacoes(
  texto = ""
) {
  const linhas = extrairLinhas(
    recortarGuiaAplicacoes(texto)
  );

  const registros = [];

  let montadora = null;
  let modelo = null;
  let contexto = {};

  for (const linha of linhas) {
    if (
      /informazioni tecniche|technical information|oe cross reference|iam cross reference|tavole di comparazione/i.test(
        linha
      )
    ) {
      break;
    }

    if (ehLinhaTecnica(linha) && !extrairCodigoMarelli(linha)) {
      continue;
    }

    if (pareceMontadora(linha)) {
      montadora = normalizarMontadora(linha);
      modelo = null;
      contexto = {};
      continue;
    }

    if (
      pareceModelo(linha) &&
      !extrairCodigoMarelli(linha)
    ) {
      modelo = linha;
      contexto = {};
      continue;
    }

    const codigos = extrairTodosCodigosMarelli(linha);

    const soListaEv =
      linha.replace(/\bEV\d{3}C?\b/gi, "").replace(/\s+/g, "").length === 0 &&
      codigos.length > 1;

    if (soListaEv) {
      continue;
    }

    if (!codigos.length) {
      if (/\d{4}\.\d{2}\s*-/.test(linha) || extrairMotorizacao(linha)) {
        contexto = atualizarContexto(linha, contexto, "");
      }
      continue;
    }

    contexto = atualizarContexto(linha, contexto, codigos[0]);

    for (const codigo of codigos) {
      const registro = montarRegistroAplicacao({
        linha,
        montadora,
        modelo,
        contexto,
      });

      if (!registro) {
        continue;
      }

      registros.push({
        ...registro,
        codigo_oem: codigo,
        codigo_marelli: codigo,
      });
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

  const posGuia =
    conteudo.search(
      /Applicazione per marca e veicolo|Vehicle application guide/i
    );

  const posTecnica =
    conteudo.search(
      /Informazioni tecniche|Technical information/i
    );

  const posOE =
    conteudo.search(
      /Tavole di comparazione OE|OE cross reference guide|Tavole di comparazione/i
    );

  const posIAM =
    conteudo.search(
      /Tavole di comparazione IAM|IAM cross reference guide/i
    );

  let aplicacoes =
    posGuia >= 0
      ? conteudo.slice(posGuia)
      : conteudo;

  let oe = "";
  let iam = "";

  const inicioApps =
    posGuia >= 0 ? posGuia : 0;

  if (posTecnica > inicioApps) {
    aplicacoes =
      conteudo.slice(
        inicioApps,
        posTecnica
      );
  } else if (posOE > inicioApps) {
    aplicacoes =
      conteudo.slice(
        inicioApps,
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