function limparTexto(valor = "") {
  return String(valor)
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarCodigo(valor = "") {
  return String(valor)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function extrairPagina(linha = "") {
  const resultado = linha.match(
    /^---\s*PÁGINA\s+(\d+)\s*---$/i
  );

  return resultado
    ? Number(resultado[1])
    : null;
}

function extrairCodigosVela(linha = "") {
  const codigosNumericos = [];
  const codigosComerciais = [];

  const padroesNumericos = [
    /\b0\s*242\s*\d{3}\s*\d{3}(?:\s*-\s*\d+)?\b/gi,
    /\b0\s*241\s*\d{3}\s*\d{3}(?:\s*-\s*\d+)?\b/gi,
    /\bF\s*000\s*KE[A-Z0-9]?\s*\d{3}\b/gi,
  ];

  const padroesComerciais = [
    /\b(?:FGR|FR|HR|WR|YR|ZR|VR|MR|W|F)\s*\d(?:\s*[A-Z0-9]){2,14}\b/gi,
  ];

  for (const padrao of padroesNumericos) {
    const resultados =
      linha.match(padrao) || [];

    for (const resultado of resultados) {
      const codigo =
        normalizarCodigo(resultado);

      if (
        codigo &&
        !codigosNumericos.includes(codigo)
      ) {
        codigosNumericos.push(codigo);
      }
    }
  }

  for (const padrao of padroesComerciais) {
    const resultados =
      linha.match(padrao) || [];

    for (const resultado of resultados) {
      const codigo =
        normalizarCodigo(resultado);

      if (
        codigo &&
        !codigosComerciais.includes(codigo)
      ) {
        codigosComerciais.push(codigo);
      }
    }
  }

  return {
    codigosNumericos,
    codigosComerciais,
  };
}

function linhaEhCabecalho(linha = "") {
  return (
    /Autopeças Bosch/i.test(linha) ||
    /Nº da Vela/i.test(linha) ||
    /Observação Vela/i.test(linha) ||
    /Código Simplificado/i.test(linha) ||
    /Data de aplicação/i.test(linha) ||
    /A lista completa de observações/i.test(
      linha
    )
  );
}

function linhaPareceMontadora(linha = "") {
  if (
    !linha ||
    linha.length > 55 ||
    /\d/.test(linha) ||
    linhaEhCabecalho(linha)
  ) {
    return false;
  }

  const letras =
    linha.replace(/[^A-Za-zÀ-ÿ]/g, "");

  if (!letras) {
    return false;
  }

  return linha === linha.toUpperCase();
}

function linhaPareceModelo(linha = "") {
  const {
    codigosNumericos,
    codigosComerciais,
  } = extrairCodigosVela(linha);

  if (
    !linha ||
    linha.length > 60 ||
    linhaEhCabecalho(linha) ||
    codigosNumericos.length > 0 ||
    codigosComerciais.length > 0 ||
    /\d{2}\.\d{2}/.test(linha) ||
    /Gasolina|Álcool|Flex|Diesel|Híbrido|GNV/i.test(
      linha
    )
  ) {
    return false;
  }

  return /^[A-ZÀ-Ú][A-Za-zÀ-ÿ0-9 .()/+-]+$/.test(
    linha
  );
}

function extrairMotor(linha = "") {
  const antesDaData =
    linha.split(
      /\b\d{2}\.\d{2}\s*(?:►||→|-)/i
    )[0] || "";

  const candidatos =
    antesDaData.match(
      /(?:[A-Z0-9.-]+(?:<[^>]+>)?|\([A-Z0-9 .-]+\))+/g
    ) || [];

  const validos = candidatos
    .map(limparTexto)
    .filter(
      (item) =>
        item.length >= 2 &&
        /[A-Z]/i.test(item) &&
        /\d|<|\./.test(item)
    );

  return validos.length
    ? validos[validos.length - 1]
    : "";
}

function extrairAnos(linha = "") {
  const datas = [
    ...linha.matchAll(
      /\b(\d{2})\.(\d{2})\b/g
    ),
  ];

  if (!datas.length) {
    return {
      anoInicio: null,
      anoFim: null,
    };
  }

  const converterAno = (ano) => {
    const numero = Number(ano);

    return numero <= 30
      ? 2000 + numero
      : 1900 + numero;
  };

  return {
    anoInicio: converterAno(
      datas[0][2]
    ),

    anoFim:
      datas.length >= 2
        ? converterAno(
            datas[datas.length - 1][2]
          )
        : null,
  };
}
function extrairCodigoComercial(linha = "") {
  const partes = linha.match(
    /\b[A-Z]{1,3}\b|\b\d+\b/g
  ) || [];

  for (let i = 0; i < partes.length - 4; i++) {
    const codigo = (
      partes[i] +
      partes[i + 1] +
      partes[i + 2] +
      partes[i + 3] +
      partes[i + 4]
    ).replace(/\s+/g, "");

    if (
      /^[A-Z]{2,3}\d[A-Z0-9]{4,}$/.test(codigo)
    ) {
      return codigo;
    }
  }

  return "";
}
export async function parserBoschVelas({
  textoAplicacoes = "",
  nomeArquivo = "",
  onProgresso,
}) {
  onProgresso?.(
    "🧠 Executando parser Bosch Velas..."
  );

  const linhas = String(textoAplicacoes)
    .replace(/\r/g, "")
    .split("\n")
    .map(limparTexto)
    .filter(Boolean);

  const registros = [];
  const chavesUnicas = new Set();

  let paginaAtual = null;
  let montadoraAtual = "";
  let modeloAtual = "";

  for (const linha of linhas) {
    const paginaEncontrada =
      extrairPagina(linha);

    if (paginaEncontrada) {
      paginaAtual = paginaEncontrada;
      continue;
    }

    if (linhaEhCabecalho(linha)) {
      continue;
    }

    if (linhaPareceMontadora(linha)) {
      montadoraAtual = linha;
      modeloAtual = "";
      continue;
    }

    if (linhaPareceModelo(linha)) {
      modeloAtual = linha;
      continue;
    }

    const {
      codigosNumericos,
      codigosComerciais,
    } = extrairCodigosVela(linha);

    if (
      codigosNumericos.length === 0 &&
      codigosComerciais.length === 0
    ) {
      continue;
    }

    const motor = extrairMotor(linha);

    const {
      anoInicio,
      anoFim,
    } = extrairAnos(linha);

    const codigosPrincipais =
      codigosNumericos.length > 0
        ? codigosNumericos
        : codigosComerciais;

    for (const codigo of codigosPrincipais) {
      const equivalentes =
        codigosComerciais.filter(
          (codigoComercial) =>
            codigoComercial !== codigo
        );

      const chave = [
        codigo,
        equivalentes.join(","),
        montadoraAtual,
        modeloAtual,
        motor,
        anoInicio || "",
        anoFim || "",
        linha,
      ].join("|");

      if (chavesUnicas.has(chave)) {
        continue;
      }

      chavesUnicas.add(chave);

      registros.push({
        codigo_oem: codigo,

      codigo_equivalente:
  extrairCodigoComercial(linha),

        peca: "Vela de Ignição",
        fabricante: "Bosch",

        origem_catalogo:
          nomeArquivo ||
          "Catálogo Bosch Velas, Cabos e Bobinas 2019-2020",

        montadora: montadoraAtual,
        modelo: modeloAtual,
        motor,

        ano_inicio: anoInicio,
        ano_fim: anoFim,

        aplicacao: linha,
        observacao: linha,
        pagina_catalogo: paginaAtual,
      });
    }
  }

  const codigosUnicos = new Set(
    registros.map(
      (registro) =>
        registro.codigo_oem
    )
  );

  onProgresso?.(
    `✅ ${registros.length} aplicações de velas encontradas — ${codigosUnicos.size} códigos únicos.`
  );

  console.log(
    "Parser Bosch Velas:",
    registros.length,
    "aplicações;",
    codigosUnicos.size,
    "códigos únicos."
  );

  return registros;
}