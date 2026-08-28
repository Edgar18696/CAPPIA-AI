function limparTexto(valor) {
  return String(valor || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizar(valor) {
  return limparTexto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function extrairCodigoBosch(linha) {
  const textoCompacto = String(
    linha || ""
  ).replace(/[^0-9]/g, "");

  const encontrado =
    textoCompacto.match(
      /0?258\d{6}/
    );

  return encontrado
    ? encontrado[0]
    : "";
}

function possuiCodigoBosch(linha) {
  return Boolean(
    extrairCodigoBosch(linha)
  );
}

function extrairAnos(texto) {
  const anos = String(texto || "")
    .match(/\b(19|20)\d{2}\b/g)
    ?.map(Number)
    .filter(
      (ano) =>
        ano >= 1950 &&
        ano <= 2035
    ) || [];

  if (!anos.length) {
    return {
      ano_inicio: null,
      ano_fim: null,
    };
  }

  return {
    ano_inicio: Math.min(...anos),
    ano_fim: Math.max(...anos),
  };
}

function identificarCombustivel(
  linhas = []
) {
  const combustiveis = [
    "FLEX",
    "GASOLINA",
    "ALCOOL",
    "ETANOL",
    "DIESEL",
    "GNV",
  ];

  return (
    linhas.find((linha) => {
      const texto = normalizar(linha);

      return combustiveis.some(
        (combustivel) =>
          texto.includes(combustivel)
      );
    }) || null
  );
}

function identificarMotor(linhas = []) {
  const padroesMotor = [
    /\b\d[.,]\d{1,2}\b/i,
    /\b\d{3,4}\s?CC\b/i,
    /\bV6\b/i,
    /\bV8\b/i,
    /\bV10\b/i,
    /\bV12\b/i,
    /\b16V\b/i,
    /\b12V\b/i,
    /\b8V\b/i,
    /\bTURBO\b/i,
    /\bTSI\b/i,
    /\bTDI\b/i,
    /\bMPI\b/i,
    /\bFSI\b/i,
  ];

  return (
    linhas.find((linha) =>
      padroesMotor.some((padrao) =>
        padrao.test(linha)
      )
    ) || null
  );
}

function linhaIgnorada(linha) {
  const texto = normalizar(linha);

  if (!texto) {
    return true;
  }

  const ignorar = [
    "SONDA LAMBDA",
    "CODIGO BOSCH",
    "CODIGO",
    "BOSCH",
    "APLICACAO",
    "APLICACOES",
    "MODELO",
    "MOTOR",
    "COMBUSTIVEL",
    "ANO",
    "PAGINA",
    "CATALOGO",
  ];

  return ignorar.some(
    (item) => texto === item
  );
}

function montarBlocoAplicacao({
  linhas,
  indiceCodigo,
  montadoras,
}) {
  const bloco = [];

  /*
   * Procura informações até 12 linhas
   * antes do código Bosch.
   */
  for (
    let indice = indiceCodigo - 1;
    indice >= 0 &&
    indice >= indiceCodigo - 12;
    indice--
  ) {
    const linha = limparTexto(
      linhas[indice]
    );

    if (!linha) {
      continue;
    }

    const linhaNormalizada =
      normalizar(linha);

    if (
      montadoras.includes(
        linhaNormalizada
      )
    ) {
      break;
    }

    if (possuiCodigoBosch(linha)) {
      break;
    }

    if (linhaIgnorada(linha)) {
      continue;
    }

    bloco.unshift(linha);
  }

  /*
   * Também aproveita informações que
   * estejam na mesma linha do código.
   */
  const linhaCodigo =
    limparTexto(linhas[indiceCodigo]);

  const codigoEncontrado =
    extrairCodigoBosch(linhaCodigo);

  const restanteLinha =
    limparTexto(
      linhaCodigo
        .replace(codigoEncontrado, "")
        .replace(
          codigoEncontrado.replace(
            /^0/,
            ""
          ),
          ""
        )
    );

  if (
    restanteLinha &&
    !linhaIgnorada(restanteLinha)
  ) {
    bloco.push(restanteLinha);
  }

  return bloco;
}

export function parserBosch(texto) {
  const linhas = String(texto || "")
    .split(/\r?\n/)
    .map((linha) =>
      limparTexto(linha)
    )
    .filter(Boolean);

  const aplicacoes = [];
  const codigosProcessados =
    new Set();

  let montadoraAtual = "";

  const montadoras = [
    "ALFA ROMEO",
    "AUDI",
    "BMW",
    "CHERY",
    "CHEVROLET",
    "CHRYSLER",
    "CITROEN",
    "DAEWOO",
    "DODGE",
    "FIAT",
    "FORD",
    "GM",
    "HONDA",
    "HYUNDAI",
    "IVECO",
    "JEEP",
    "KIA",
    "LAND ROVER",
    "MERCEDES",
    "MERCEDES-BENZ",
    "MITSUBISHI",
    "NISSAN",
    "PEUGEOT",
    "PORSCHE",
    "RENAULT",
    "SEAT",
    "SKODA",
    "SUBARU",
    "SUZUKI",
    "TOYOTA",
    "VOLKSWAGEN",
    "VW",
    "VOLVO",
  ];

  for (
    let i = 0;
    i < linhas.length;
    i++
  ) {
    const linha = linhas[i];
    const linhaNormalizada =
      normalizar(linha);

    const montadoraEncontrada =
      montadoras.find(
        (montadora) =>
          linhaNormalizada ===
            montadora ||
          linhaNormalizada.startsWith(
            `${montadora} `
          )
      );

    if (montadoraEncontrada) {
      montadoraAtual =
        montadoraEncontrada;
    }

    const codigo =
      extrairCodigoBosch(linha);

    if (!codigo) {
      continue;
    }

    const bloco =
      montarBlocoAplicacao({
        linhas,
        indiceCodigo: i,
        montadoras,
      });

    const motor =
      identificarMotor(bloco);

    const combustivel =
      identificarCombustivel(bloco);

    const linhasModelo =
      bloco.filter((item) => {
        if (item === motor) {
          return false;
        }

        if (item === combustivel) {
          return false;
        }

        return true;
      });

    const modelo =
      linhasModelo[0] || null;

    const aplicacao =
      bloco.length > 0
        ? bloco.join(" | ")
        : null;

    const {
      ano_inicio,
      ano_fim,
    } = extrairAnos(
      bloco.join(" ")
    );

    const chaveRegistro = [
      codigo,
      montadoraAtual,
      modelo,
      motor,
      ano_inicio,
      ano_fim,
    ]
      .map(normalizar)
      .join("|");

    if (
      codigosProcessados.has(
        chaveRegistro
      )
    ) {
      continue;
    }

    codigosProcessados.add(
      chaveRegistro
    );

    aplicacoes.push({
      peca: "Sonda Lambda",

      fabricante: "Bosch",

      codigo_oem: codigo,

      codigo_equivalente: null,

      montadora:
        montadoraAtual || null,

      modelo,

      motor,

      ano_inicio,

      ano_fim,

      aplicacao,

      combustivel,

      observacao:
        aplicacao || null,

      origem_catalogo:
        "Catálogo Bosch Sondas 2020",

      ativo: true,

      prioridade: 1,

      confiabilidade: 100,
    });
  }

  return aplicacoes;
}

export default parserBosch;