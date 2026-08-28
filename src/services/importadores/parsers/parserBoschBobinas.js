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

function extrairCodigosBobina(linha = "") {
  const padroes = [
    /\b0\s*221\s*\d{3}\s*\d{3}\b/gi,
    /\b0\s*986\s*221\s*\d{3}\b/gi,
    /\bF\s*000\s*ZS[A-Z0-9]?\s*\d{3}\b/gi,
    /\b9\s*220\s*081\s*\d{3}\b/gi,
  ];

  const encontrados = [];

  for (const padrao of padroes) {
    const resultados =
      linha.match(padrao) || [];

    for (const resultado of resultados) {
      const codigo =
        normalizarCodigo(resultado);

      if (
        codigo &&
        !encontrados.includes(codigo)
      ) {
        encontrados.push(codigo);
      }
    }
  }

  return encontrados;
}

function linhaEhCabecalho(linha = "") {
  return (
    /Autopeças Bosch/i.test(linha) ||
    /Nº da Bobina/i.test(linha) ||
    /Observação Bobina/i.test(linha) ||
    /Código Simplificado/i.test(linha) ||
    /Data de aplicação/i.test(linha) ||
    /A lista completa de observações/i.test(
      linha
    ) ||
    /Ignição dupla/i.test(linha) ||
    /^DOV\b/i.test(linha) ||
    /^DOZ\b/i.test(linha) ||
    /^BO\b/i.test(linha) ||
    /^ELD\b/i.test(linha) ||
    /^ELG\b/i.test(linha) ||
    /^ELK\b/i.test(linha) ||
    /^XJB\b/i.test(linha) ||
    /^XJC\b/i.test(linha)
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
  if (
    !linha ||
    linha.length > 60 ||
    linhaEhCabecalho(linha) ||
    extrairCodigosBobina(linha).length > 0 ||
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

  const ignorar =
    /^(V|CV|MM|CIL|VALV|GASOLINA|ÁLCOOL|FLEX|DIESEL)$/i;

  const validos = candidatos
    .map(limparTexto)
    .filter(
      (item) =>
        item.length >= 2 &&
        !ignorar.test(item) &&
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

export async function parserBoschBobinas({
  textoAplicacoes = "",
  nomeArquivo = "",
  onProgresso,
}) {
  onProgresso?.(
    "🧠 Executando parser Bosch Bobinas..."
  );

  console.log(
    "Parser Bosch Bobinas iniciado:",
    nomeArquivo
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

    const codigosBobina =
      extrairCodigosBobina(linha);

    if (!codigosBobina.length) {
      continue;
    }

    const motor = extrairMotor(linha);

    const {
      anoInicio,
      anoFim,
    } = extrairAnos(linha);

    for (const codigo of codigosBobina) {
      const chave = [
        codigo,
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
        codigo_equivalente: "",
        peca: "Bobina de Ignição",
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

        pagina_catalogo:
          paginaAtual,
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
    `✅ ${registros.length} aplicações de bobinas encontradas — ${codigosUnicos.size} códigos únicos.`
  );

  console.log(
    "Parser Bosch Bobinas:",
    registros.length,
    "aplicações;",
    codigosUnicos.size,
    "códigos únicos."
  );

  return registros;
}