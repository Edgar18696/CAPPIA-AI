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

function limparCodigo(valor) {
  return String(valor || "")
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9.-]/gi, "")
    .toUpperCase()
    .trim();
}

function separarLinhas(texto) {
  return String(texto || "")
    .split(/\r?\n/)
    .map(limparTexto)
    .filter(Boolean);
}

function extrairPagina(linha) {
  const resultado = String(
    linha || ""
  ).match(
    /^---\s*PÁGINA\s+(\d+)\s*---$/i
  );

  return resultado
    ? Number(resultado[1])
    : null;
}

const MONTADORAS = [
  "ALFA ROMEO",
  "ASIA MOTORS",
  "ASIA",
  "AUDI",
  "BMW",
  "CHERY",
  "CHEVROLET",
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
  "MERCEDES",
  "MERCEDES-BENZ",
  "MITSUBISHI",
  "NISSAN",
  "PEUGEOT",
  "PORSCHE",
  "RENAULT",
  "SUBARU",
  "SUZUKI",
  "TOYOTA",
  "VOLKSWAGEN",
  "VOLVO",
];

function identificarMontadora(linha) {
  const texto = normalizar(linha);

  return (
    MONTADORAS.find((montadora) => {
      const nome =
        normalizar(montadora);

      return (
        texto === nome ||
        texto.startsWith(`${nome} `)
      );
    }) || ""
  );
}

function extrairCodigosBosch(linha) {
  const encontrados =
    String(linha || "").match(
      /0\s*258\s*\d{3}\s*\d{3}/gi
    ) || [];

  return Array.from(
    new Set(
      encontrados
        .map(limparCodigo)
        .filter(
          (codigo) =>
            /^0258\d{6}$/.test(codigo)
        )
    )
  );
}

function extrairCodigosGerais(linha) {
  const encontrados =
    String(linha || "").match(
      /\b[A-Z0-9][A-Z0-9./-]{3,29}\b/gi
    ) || [];

  return Array.from(
    new Set(
      encontrados
        .map(limparCodigo)
        .filter((codigo) => {
          if (codigo.length < 5) {
            return false;
          }

          if (!/\d/.test(codigo)) {
            return false;
          }

          if (
            /^(19|20)\d{2}$/.test(
              codigo
            )
          ) {
            return false;
          }

          return true;
        })
    )
  );
}

function extrairAnos(texto) {
  const conteudo =
    String(texto || "");

  const faixa =
    conteudo.match(
      /\b((?:19|20)\d{2})\s*(?:A|ATÉ|ATE|-|\/)\s*((?:19|20)\d{2})\b/i
    );

  if (faixa) {
    return {
      ano_inicio:
        Number(faixa[1]),

      ano_fim:
        Number(faixa[2]),
    };
  }

  const anos =
    conteudo.match(
      /\b(?:19|20)\d{2}\b/g
    ) || [];

  const numeros = anos
    .map(Number)
    .filter(
      (ano) =>
        ano >= 1900 &&
        ano <= 2100
    );

  if (!numeros.length) {
    return {
      ano_inicio: null,
      ano_fim: null,
    };
  }

  return {
    ano_inicio:
      Math.min(...numeros),

    ano_fim:
      numeros.length > 1
        ? Math.max(...numeros)
        : Math.min(...numeros),
  };
}

function removerAnos(texto) {
  return limparTexto(
    String(texto || "")
      .replace(
        /\b(?:19|20)\d{2}\b/g,
        " "
      )
      .replace(
        /\b(?:A|ATÉ|ATE)\b/gi,
        " "
      )
  );
}

function removerCodigosBosch(
  texto,
  codigos
) {
  let resultado =
    String(texto || "");

  for (const codigo of codigos) {
    const grupo1 =
      codigo.slice(4, 7);

    const grupo2 =
      codigo.slice(7, 10);

    const formatos = [
      codigo,
      `0 258 ${grupo1} ${grupo2}`,
      `0 258${grupo1}${grupo2}`,
      `0258 ${grupo1} ${grupo2}`,
    ];

    for (const formato of formatos) {
      resultado =
        resultado.replaceAll(
          formato,
          " "
        );
    }
  }

  return limparTexto(resultado);
}

function extrairModeloEMotor(texto) {
  const conteudo =
    removerAnos(texto);

  const inicioMotor =
    conteudo.search(
      /\b\d(?:[.,]\d)\s*(?:V\d{1,2})?\b/i
    );

  if (inicioMotor < 0) {
    return {
      modelo: conteudo,
      motor: "",
    };
  }

  const modelo =
    limparTexto(
      conteudo.slice(
        0,
        inicioMotor
      )
    );

  const motor =
    limparTexto(
      conteudo.slice(
        inicioMotor
      )
    );

  return {
    modelo,
    motor,
  };
}

function textoPareceObservacao(
  linha
) {
  const texto =
    normalizar(linha);

  return (
    texto.startsWith("(") ||
    texto.includes("PARA VEICULOS") ||
    texto.includes("PARA VEÍCULOS") ||
    texto.includes("FILEIRA DE CILINDROS") ||
    texto.includes("ACELERADOR ELETRONICO") ||
    texto.includes("ACELERADOR ELETRÔNICO")
  );
}

function criarMapaEquivalencias(
  textoEquivalencias
) {
  const linhas =
    separarLinhas(
      textoEquivalencias
    );

  const mapa = new Map();

  let codigosBoschAtuais = [];

  for (const linha of linhas) {
    if (extrairPagina(linha)) {
      continue;
    }

    const codigosBosch =
      extrairCodigosBosch(linha);

    if (codigosBosch.length) {
      codigosBoschAtuais =
        codigosBosch;

      for (const codigo of codigosBosch) {
        if (!mapa.has(codigo)) {
          mapa.set(
            codigo,
            new Set()
          );
        }
      }
    }

    if (
      !codigosBoschAtuais.length
    ) {
      continue;
    }

    const codigosLinha =
      extrairCodigosGerais(linha);

    for (
      const codigoBosch
      of codigosBoschAtuais
    ) {
      const conjunto =
        mapa.get(codigoBosch);

      for (
        const codigo
        of codigosLinha
      ) {
        if (
          codigo === codigoBosch
        ) {
          continue;
        }

        if (
          /^0258\d{6}$/.test(
            codigo
          )
        ) {
          continue;
        }

        conjunto.add(codigo);
      }
    }
  }

  return mapa;
}

function juntarEquivalentes(
  mapaEquivalencias,
  codigo
) {
  return Array.from(
    mapaEquivalencias.get(codigo) ||
      []
  ).join(", ");
}

function adicionarRegistro(
  mapa,
  registro
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

  if (!mapa.has(chave)) {
    mapa.set(chave, registro);
    return;
  }

  const existente =
    mapa.get(chave);

  const equivalentes =
    new Set(
      [
        existente.codigo_equivalente,
        registro.codigo_equivalente,
      ]
        .join(",")
        .split(/[,;|/]+/)
        .map(limparCodigo)
        .filter(Boolean)
    );

  existente.codigo_equivalente =
    Array.from(
      equivalentes
    ).join(", ");

  if (
    !existente.motor &&
    registro.motor
  ) {
    existente.motor =
      registro.motor;
  }

  if (
    !existente.ano_inicio &&
    registro.ano_inicio
  ) {
    existente.ano_inicio =
      registro.ano_inicio;
  }

  if (
    !existente.ano_fim &&
    registro.ano_fim
  ) {
    existente.ano_fim =
      registro.ano_fim;
  }
}

export async function parserBoschSondas({
    textoAplicacoes = "",
  textoEquivalencias = "",
  nomeArquivo = "",
  onProgresso,
}) {
  const linhas =
    separarLinhas(
      textoAplicacoes
    );

  const mapaEquivalencias =
    criarMapaEquivalencias(
      textoEquivalencias
    );

  const registros =
    new Map();

  let paginaAtual = null;
  let montadoraAtual = "";
  let observacaoAtual = "";

  for (
    let indice = 0;
    indice < linhas.length;
    indice += 1
  ) {
    const linha =
      linhas[indice];

    const pagina =
      extrairPagina(linha);

    if (pagina) {
      paginaAtual = pagina;
      continue;
    }

    const montadora =
      identificarMontadora(linha);

    if (montadora) {
      montadoraAtual =
        montadora;

      observacaoAtual = "";
      continue;
    }

    if (
      textoPareceObservacao(linha)
    ) {
      observacaoAtual =
        linha;

      continue;
    }

    const codigosBosch =
      extrairCodigosBosch(linha);

    if (!codigosBosch.length) {
      continue;
    }

    const linhaAnterior =
      linhas[indice - 1] || "";

    const linhaSeguinte =
      linhas[indice + 1] || "";

    const contexto = [
      textoPareceObservacao(
        linhaAnterior
      )
        ? ""
        : linhaAnterior,

      linha,

      textoPareceObservacao(
        linhaSeguinte
      )
        ? ""
        : linhaSeguinte,
    ]
      .filter(Boolean)
      .join(" ");

    const textoSemCodigos =
      removerCodigosBosch(
        contexto,
        codigosBosch
      );

    const anos =
      extrairAnos(contexto);

    const {
      modelo,
      motor,
    } =
      extrairModeloEMotor(
        textoSemCodigos
      );

    for (
      const codigo
      of codigosBosch
    ) {
      const registro = {
        peca:
          "Sonda Lambda",

        codigo_oem:
          codigo,

        codigo_equivalente:
          juntarEquivalentes(
            mapaEquivalencias,
            codigo
          ),

        fabricante:
          "Bosch",

        origem_catalogo:
          nomeArquivo ||
          "Catálogo Bosch Sondas 2020",

        montadora:
          montadoraAtual,

        modelo:
          modelo ||
          textoSemCodigos,

        motor,

        ano_inicio:
          anos.ano_inicio,

        ano_fim:
          anos.ano_fim,

        observacao:
          [
            linha,
            observacaoAtual,
          ]
            .filter(Boolean)
            .join(" | "),

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
    }

    if (
      indice > 0 &&
      indice % 200 === 0
    ) {
      onProgresso?.(
        `🧠 Bosch V3: ${registros.size} registros estruturados...`
      );
    }
  }

  const resultado =
    Array.from(
      registros.values()
    );

  onProgresso?.(
    `✅ Bosch V3 encontrou ${resultado.length} registros.`
  );

  return resultado;
}