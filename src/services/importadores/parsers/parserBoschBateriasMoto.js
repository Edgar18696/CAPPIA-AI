function limparTexto(valor = "") {
  return String(valor || "")
    .replace(/[●•►▶]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extrairCodigoBateria(linha = "") {
  const padroes = [
    /\bBTX\d+(?:\.\d+)?[A-Z]?-BS(?:-1)?\b/i,
    /\bBTZ\d+(?:\.\d+)?[A-Z]?-BS(?:-1)?\b/i,
    /\bBT\d+(?:\.\d+)?[A-Z]?-BS(?:-1)?\b/i,
    /\bBB\d+(?:\.\d+)?[A-Z]?-?[A-Z]?\b/i,
    /\b12N\d+(?:\.\d+)?-\d+[A-Z]?\b/i,
    /\bYTX\d+(?:\.\d+)?[A-Z]?-BS\b/i,
    /\bYTZ\d+(?:\.\d+)?[A-Z]?-BS\b/i,
  ];

  for (const padrao of padroes) {
    const resultado =
      String(linha).match(padrao);

    if (resultado?.[0]) {
      return resultado[0]
        .toUpperCase()
        .trim();
    }
  }

  return "";
}

function extrairCodigoBosch(linha = "") {
  const resultado =
    String(linha).match(
      /\b0\s*092\s*M68\s*\d{3}\b/i
    );

  if (!resultado?.[0]) {
    return "";
  }

  return resultado[0]
    .replace(/\s+/g, "")
    .toUpperCase();
}

function extrairAnos(linha = "") {
  const anos =
    String(linha).match(
      /\b(?:19|20)\d{2}\b/g
    ) || [];

  const anosNumericos = anos
    .map(Number)
    .filter(
      (ano) =>
        ano >= 1950 &&
        ano <= 2035
    );

  return {
    ano_inicio:
      anosNumericos[0] || null,

    ano_fim:
      anosNumericos[1] ||
      anosNumericos[0] ||
      null,
  };
}

function extrairCilindrada(linha = "") {
  const resultado =
    String(linha).match(
      /\b(\d{2,4})\s*(?:cc|cilindradas?)\b/i
    );

  if (resultado?.[1]) {
    return resultado[1];
  }

  const numeros =
    String(linha).match(/\b\d{2,4}\b/g) ||
    [];

  for (const numero of numeros) {
    const valor = Number(numero);

    if (
      valor >= 50 &&
      valor <= 2300 &&
      valor < 1900
    ) {
      return numero;
    }
  }

  return "";
}

function detectarMontadora(linha = "") {
  const montadoras = [
    "APRILIA",
    "BMW",
    "DAFRA",
    "DUCATI",
    "HAOJUE",
    "HARLEY DAVIDSON",
    "HONDA",
    "KASINSKI",
    "KAWASAKI",
    "KTM",
    "MOTOGUZZI",
    "MV AGUSTA",
    "PIAGGIO",
    "SUNDOWN",
    "SUZUKI",
    "TRIUMPH",
    "YAMAHA",
  ];

  const texto =
    limparTexto(linha).toUpperCase();

  return (
    montadoras.find(
      (montadora) =>
        texto === montadora ||
        texto.startsWith(
          `${montadora} `
        )
    ) || ""
  );
}

function linhaIgnorada(linha = "") {
  const texto =
    limparTexto(linha).toLowerCase();

  return (
    !texto ||
    texto.includes(
      "autopeças bosch"
    ) ||
    texto.includes(
      "catalogo de aplicacao"
    ) ||
    texto.includes(
      "catálogo de aplicação"
    ) ||
    texto.includes(
      "baterias motocicletas"
    ) ||
    texto.includes(
      "data de aplicacao"
    ) ||
    texto.includes(
      "data de aplicação"
    ) ||
    texto.includes(
      "codigo bosch"
    ) ||
    texto.includes(
      "código bosch"
    ) ||
    texto.includes(
      "dimensoes"
    ) ||
    texto.includes(
      "dimensões"
    ) ||
    texto.includes(
      "tensao"
    ) ||
    texto.includes(
      "tensão"
    )
  );
}

function montarModelo({
  linha,
  codigoBateria,
  codigoBosch,
  montadora,
}) {
  let modelo = String(linha || "");

  modelo = modelo
    .replace(
      new RegExp(
        codigoBateria.replace(
          /[-/\\^$*+?.()|[\]{}]/g,
          "\\$&"
        ),
        "i"
      ),
      " "
    )
    .replace(
      codigoBosch || "__SEM_CODIGO__",
      " "
    )
    .replace(
      new RegExp(
        montadora || "__SEM_MONTADORA__",
        "i"
      ),
      " "
    )
    .replace(
      /\b(?:19|20)\d{2}\b/g,
      " "
    )
    .replace(
      /\b\d+(?:,\d+)?\s*(?:ah|a|v)\b/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

  return modelo;
}

export async function parserBoschBateriasMoto({
  textoAplicacoes = "",
  configuracao = {},
  nomeArquivo = "",
  onProgresso,
}) {
  onProgresso?.(
    "🏍️ Interpretando catálogo Bosch Baterias Moto..."
  );

  const linhas =
    String(textoAplicacoes || "")
      .split(/\r?\n/)
      .map(limparTexto)
      .filter(Boolean);

  const registros = [];

  let montadoraAtual = "";

  for (const linha of linhas) {
    if (linhaIgnorada(linha)) {
      continue;
    }

    const montadoraDetectada =
      detectarMontadora(linha);

    if (
      montadoraDetectada &&
      !extrairCodigoBateria(linha)
    ) {
      montadoraAtual =
        montadoraDetectada;

      continue;
    }

    const codigoBateria =
      extrairCodigoBateria(linha);

    if (!codigoBateria) {
      continue;
    }

    const codigoBosch =
      extrairCodigoBosch(linha);

    const { ano_inicio, ano_fim } =
      extrairAnos(linha);

    const cilindrada =
      extrairCilindrada(linha);

    const montadoraLinha =
      detectarMontadora(linha);

    const montadora =
      montadoraLinha ||
      montadoraAtual ||
      "";

    const modelo = montarModelo({
      linha,
      codigoBateria,
      codigoBosch,
      montadora,
    });

    registros.push({
      fabricante: "Bosch",

      peca:
        "Bateria para Motocicleta",

      codigo_oem:
        codigoBosch ||
        codigoBateria,

      codigo_equivalente:
        codigoBosch
          ? codigoBateria
          : "",

      montadora,

      modelo,

      motor: cilindrada
        ? `${cilindrada} cc`
        : "",

      ano_inicio,
      ano_fim,

      aplicacao: linha,

      observacao:
        codigoBosch
          ? `Modelo da bateria: ${codigoBateria}`
          : linha,

      origem_catalogo:
        configuracao.origemCatalogo ||
        nomeArquivo ||
        "Catálogo Bosch Baterias Motocicletas 2020-2021",

      ativo: true,
      prioridade: 1,
      confiabilidade: 100,
    });
  }

  onProgresso?.(
    `✅ ${registros.length} registros de baterias encontrados.`
  );

  console.log(
    "BATERIAS ENCONTRADAS:",
    registros.length
  );

  console.log(
    "AMOSTRA BATERIAS:",
    registros.slice(0, 20)
  );
console.log("TOTAL LINHAS:", linhas.length);

console.log(
  linhas.slice(0, 150)
);
  return registros;
}