function limparTexto(valor) {
  return String(valor || "")
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizar(valor) {
  return limparTexto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function separarLinhas(texto) {
  return String(texto || "")
    .split(/\r?\n/)
    .map(limparTexto)
    .filter(Boolean);
}

function limparCodigo(valor) {
  return String(valor || "")
    .replace(/\s+/g, "")
    .replace(/\(\d+\)/g, "")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase()
    .trim();
}

function formatarCodigoBosch(valor) {
  const codigo = limparCodigo(valor);

  if (/^F000TE[A-Z0-9]{4}$/.test(codigo)) {
    return [
      codigo.slice(0, 1),
      codigo.slice(1, 4),
      codigo.slice(4, 7),
      codigo.slice(7),
    ].join(" ");
  }

  if (/^0580\d{6}$/.test(codigo)) {
    return [
      codigo.slice(0, 1),
      codigo.slice(1, 4),
      codigo.slice(4, 7),
      codigo.slice(7),
    ].join(" ");
  }

  return valor;
}

function extrairPagina(linha) {
  const resultado = String(linha || "").match(
    /^---\s*PÁGINA\s+(\d+)\s*---$/i
  );

  return resultado ? Number(resultado[1]) : null;
}

const MONTADORAS = [
  "ALFA ROMEO",
  "ASIA MOTORS",
  "AUDI",
  "BMW",
  "CHEVROLET",
  "CHERY",
  "CHRYSLER",
  "CITROEN",
  "CITROËN",
  "DAEWOO",
  "DODGE",
  "FIAT",
  "FORD",
  "HONDA",
  "HYUNDAI",
  "IVECO",
  "JEEP",
  "KIA",
  "LAND ROVER",
  "MERCEDES-BENZ",
  "MERCEDES BENZ",
  "MITSUBISHI",
  "NISSAN",
  "PEUGEOT",
  "PORSCHE",
  "RENAULT",
  "SEAT",
  "SUBARU",
  "SUZUKI",
  "TOYOTA",
  "VOLKSWAGEN",
  "VW",
  "VW (VOLKSWAGEN)",
  "VOLVO",
];

function identificarMontadora(linha) {
  const texto = normalizar(linha);

  const montadora = MONTADORAS.find((item) => {
    const nome = normalizar(item);

    return texto === nome;
  });

  if (!montadora) {
    return "";
  }

  if (
    normalizar(montadora) === "VW" ||
    normalizar(montadora) === "VW (VOLKSWAGEN)"
  ) {
    return "Volkswagen";
  }

  if (
    normalizar(montadora) === "MERCEDES BENZ"
  ) {
    return "Mercedes-Benz";
  }

  return montadora;
}

function extrairCodigoProduto(linha) {
  const resultado = String(linha || "").match(
    /\bF\s*000\s*TE[A-Z0-9]\s*[A-Z0-9]{3}\b/i
  );

  return resultado
    ? formatarCodigoBosch(resultado[0])
    : "";
}

function extrairCodigosBombas(linha) {
  const encontrados =
    String(linha || "").match(
      /\b0\s*580\s*\d{3}\s*\d{3}(?:\(\d+\))?/gi
    ) || [];

  return Array.from(
    new Set(
      encontrados.map((codigo) =>
        formatarCodigoBosch(codigo)
      )
    )
  );
}

function extrairCodigosF000(linha) {
  const encontrados =
    String(linha || "").match(
      /\bF\s*000\s*TE[A-Z0-9]\s*[A-Z0-9]{3}(?:\(\d+\))?/gi
    ) || [];

  return Array.from(
    new Set(
      encontrados.map((codigo) =>
        formatarCodigoBosch(codigo)
      )
    )
  );
}

function extrairEspecificacoes(linha) {
  const pressao = String(linha || "").match(
    /\b\d+(?:[.,]\d+)?\s*bar\b/i
  );

  const vazao = String(linha || "").match(
    /\b\d+(?:[.,]\d+)?\s*l\/h\b/i
  );

  return {
    pressao: pressao
      ? limparTexto(pressao[0])
      : "",

    vazao: vazao
      ? limparTexto(vazao[0])
      : "",
  };
}

function extrairPeriodo(linha) {
  const texto = String(linha || "");

  const faixa = texto.match(
    /\b(\d{2})[./](\d{2})\s*[^\dA-Z]{0,5}\s*(\d{2})[./](\d{2})\b/i
  );

  if (faixa) {
    const mesInicio = Number(faixa[1]);
    const anoInicio = converterAno(faixa[2]);

    const mesFim = Number(faixa[3]);
    const anoFim = converterAno(faixa[4]);

    return {
      mes_inicio: mesInicio,
      ano_inicio: anoInicio,
      mes_fim: mesFim,
      ano_fim: anoFim,
    };
  }

  const aberto = texto.match(
    /\b(\d{2})[./](\d{2})\s*[^\dA-Z]{0,5}\s*$/i
  );

  if (aberto) {
    return {
      mes_inicio: Number(aberto[1]),
      ano_inicio: converterAno(aberto[2]),
      mes_fim: null,
      ano_fim: null,
    };
  }

  return {
    mes_inicio: null,
    ano_inicio: null,
    mes_fim: null,
    ano_fim: null,
  };
}

function converterAno(valor) {
  const ano = Number(valor);

  if (ano >= 70) {
    return 1900 + ano;
  }

  return 2000 + ano;
}

function removerPeriodo(texto) {
  return limparTexto(
    String(texto || "").replace(
      /\b\d{2}[./]\d{2}\s*[^\dA-Z]{0,5}\s*(?:\d{2}[./]\d{2})?/gi,
      " "
    )
  );
}

function removerCodigos(texto) {
  return limparTexto(
    String(texto || "")
      .replace(
        /\b0\s*580\s*\d{3}\s*\d{3}(?:\(\d+\))?/gi,
        " "
      )
      .replace(
        /\bF\s*000\s*TE[A-Z0-9]\s*[A-Z0-9]{3}(?:\(\d+\))?/gi,
        " "
      )
  );
}

function separarModeloMotor(texto) {
  const conteudo = removerCodigos(
    removerPeriodo(texto)
  );

  const inicioMotor = conteudo.search(
    /\b\d(?:[.,]\d)\s*[A-Z0-9.-]*/i
  );

  if (inicioMotor < 0) {
    return {
      modelo: conteudo,
      motor: "",
    };
  }

  return {
    modelo: limparTexto(
      conteudo.slice(0, inicioMotor)
    ),

    motor: limparTexto(
      conteudo.slice(inicioMotor)
    ),
  };
}

function pareceCabecalho(linha) {
  const texto = normalizar(linha);

  return (
    texto.includes("KIT DE REPOSICAO VEICULO") ||
    texto.includes("DATA DE APLICACAO") ||
    texto.includes("BOMBA ELETRICA") ||
    texto.includes("PRE-FILTRO") ||
    texto.includes("INFORMACOES ADICIONAIS") ||
    texto.includes("AUTOPECAS BOSCH") ||
    texto.includes("BOMBAS DE COMBUSTIVEL BOSCH") ||
    texto.includes("DE ACORDO COM A PORTARIA") ||
    texto.includes("VALORES DE REFERENCIA") ||
    texto.includes("CERTIFICACAO NAO OBRIGATORIA")
  );
}

function pareceObservacao(linha) {
  const texto = normalizar(linha);

  return (
    texto.includes("COMPATIVEL COM") ||
    texto.includes("CERTIFICACAO") ||
    texto.includes("APLICACAO ANTERIOR") ||
    texto.includes("NAO ACOMPANHA") ||
    texto.includes("INTERCAMBIAVEL")
  );
}

function definirTipoPeca(
  categoriaAtual,
  pressao = "",
  vazao = ""
) {
  let descricao = (
    categoriaAtual ||
    "Bomba de Combustível"
  ).trim();

  if (
    !normalizar(descricao).includes("BOSCH")
  ) {
    descricao += " Bosch";
  }

  const detalhes = [];

  if (pressao) {
    detalhes.push(pressao);
  }

  if (vazao) {
    detalhes.push(vazao);
  }

  if (detalhes.length > 0) {
    descricao += ` - ${detalhes.join(" / ")}`;
  }

  return descricao;
}
function identificarCategoriaCatalogo(linha) {
  const texto = normalizar(linha);

  if (texto.includes("KIT DE REPOSICAO")) {
    return "Kit de Reposição da Bomba de Combustível";
  }

  if (texto.includes("CONJUNTO BOMBA DE COMBUSTIVEL")) {
    return "Conjunto Bomba de Combustível";
  }

  if (texto.includes("BOMBA ELETRICA")) {
    return "Bomba Elétrica de Combustível";
  }

  if (
    texto.includes("CONJUNTO SENSOR DE NIVEL") ||
    texto === "SENSOR DE NIVEL"
  ) {
    return "Sensor de Nível de Combustível";
  }

  if (texto.includes("REGULADOR DE PRESSAO")) {
    return "Regulador de Pressão de Combustível";
  }

  if (
    texto.includes("PRE-FILTRO") ||
    texto.includes("PREFILTRO")
  ) {
    return "Pré-filtro da Bomba de Combustível";
  }

  return "";
}
function adicionarRegistro(mapa, registro) {
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

  if (!mapa.has(chave)) {
    mapa.set(chave, registro);
    return;
  }

  const existente = mapa.get(chave);

  const equivalentes = new Set(
    [
      existente.codigo_equivalente,
      registro.codigo_equivalente,
    ]
      .join(",")
      .split(/[,;|]+/)
      .map(limparTexto)
      .filter(Boolean)
  );

  existente.codigo_equivalente =
    Array.from(equivalentes).join(", ");

  const observacoes = new Set(
    [
      existente.observacao,
      registro.observacao,
    ]
      .join("|")
      .split("|")
      .map(limparTexto)
      .filter(Boolean)
  );

  existente.observacao =
    Array.from(observacoes).join(" | ");
}

export async function parserBoschBombas({
  textoAplicacoes = "",
  nomeArquivo = "",
  onProgresso,
}) {
  const linhas = separarLinhas(
    textoAplicacoes
  );

  const registros = new Map();

  let paginaAtual = null;
  let codigoProdutoAtual = "";
  let montadoraAtual = "";
  let pressaoAtual = "";
  let vazaoAtual = "";
  let observacaoAtual = "";
  let categoriaAtual =
  "Kit de Reposição da Bomba de Combustível";

  for (
    let indice = 0;
    indice < linhas.length;
    indice += 1
  ) {
    const linha = linhas[indice];
    const categoriaEncontrada =
  identificarCategoriaCatalogo(
    linha
  );

if (categoriaEncontrada) {
  categoriaAtual =
    categoriaEncontrada;
}

    const pagina = extrairPagina(linha);

    if (pagina) {
      paginaAtual = pagina;
      continue;
    }

    if (pareceCabecalho(linha)) {
      continue;
    }

    const codigoProduto =
      extrairCodigoProduto(linha);

    if (codigoProduto) {
      codigoProdutoAtual =
        codigoProduto;

      const especificacoes =
        extrairEspecificacoes(linha);

      pressaoAtual =
        especificacoes.pressao;

      vazaoAtual =
        especificacoes.vazao;

      montadoraAtual = "";
      observacaoAtual = "";

      continue;
    }

    if (!codigoProdutoAtual) {
      continue;
    }

    const montadora =
      identificarMontadora(linha);

    if (montadora) {
      montadoraAtual = montadora;
      observacaoAtual = "";
      continue;
    }

    if (!montadoraAtual) {
      continue;
    }

    if (pareceObservacao(linha)) {
      observacaoAtual = linha;
      continue;
    }

    const periodo =
      extrairPeriodo(linha);

    if (!periodo.ano_inicio) {
      continue;
    }

    const {
      modelo,
      motor,
    } = separarModeloMotor(linha);

    if (!modelo) {
      continue;
    }

    const bombasLinha =
      extrairCodigosBombas(linha);

    const codigosF000Linha =
      extrairCodigosF000(linha)
        .filter(
          (codigo) =>
            limparCodigo(codigo) !==
            limparCodigo(codigoProdutoAtual)
        );

    const equivalentes = Array.from(
      new Set([
        ...bombasLinha,
        ...codigosF000Linha,
      ])
    );

    const informacoesTecnicas = [
      pressaoAtual
        ? `Pressão: ${pressaoAtual}`
        : "",

      vazaoAtual
        ? `Vazão: ${vazaoAtual}`
        : "",

      observacaoAtual,
    ]
      .filter(Boolean)
      .join(" | ");

    const registro = {
peca:
  definirTipoPeca(
    categoriaAtual,
    pressaoAtual,
    vazaoAtual
  ),

      codigo_oem:
        limparCodigo(
          codigoProdutoAtual
        ),

      codigo_equivalente:
        equivalentes
          .map(limparCodigo)
          .filter(Boolean)
          .join(", "),

      fabricante:
        "Bosch",

      origem_catalogo:
        nomeArquivo ||
        "Catálogo Bosch Bombas de Combustível 2019-2020",

      montadora:
        montadoraAtual,

      modelo,

      motor,

      ano_inicio:
        periodo.ano_inicio,

      ano_fim:
        periodo.ano_fim,

      observacao:
        informacoesTecnicas,

      pagina_catalogo:
        paginaAtual,

      ativo: true,

      prioridade: 1,

      confiabilidade: 95,
    };

    adicionarRegistro(
      registros,
      registro
    );

    if (
      indice > 0 &&
      indice % 200 === 0
    ) {
      onProgresso?.(
        `⛽ Bosch Bombas: ${registros.size} registros estruturados...`
      );
    }
  }

  const resultado = Array.from(
    registros.values()
  );

  onProgresso?.(
    `✅ Bosch Bombas encontrou ${resultado.length} registros.`
  );

  return resultado;
}