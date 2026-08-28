export function limparTexto(valor) {
  return String(valor || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function limparCodigo(valor) {
  return limparTexto(valor)
    .replace(/[^\w.-]/g, "")
    .toUpperCase();
}

export function separarLinhas(texto) {
  return String(texto || "")
    .split(/\r?\n/)
    .map(limparTexto)
    .filter(Boolean);
}

export function pareceCodigo(
  valor,
  {
    tamanhoMinimo = 4,
    tamanhoMaximo = 25,
  } = {}
) {
  const codigo = limparCodigo(valor);

  return (
    codigo.length >= tamanhoMinimo &&
    codigo.length <= tamanhoMaximo &&
    /^[A-Z0-9.-]+$/.test(codigo) &&
    /\d/.test(codigo)
  );
}

export function encontrarCodigo(
  linha,
  opcoes = {}
) {
  return (
    String(linha || "")
      .split(/[\s,;|/]+/)
      .map(limparCodigo)
      .find((codigo) =>
        pareceCodigo(codigo, opcoes)
      ) || ""
  );
}

export function extrairAnos(texto) {
  const encontrados =
    String(texto || "").match(
      /\b(?:19|20)\d{2}\b/g
    ) || [];

  if (encontrados.length === 0) {
    return {
      ano_inicio: null,
      ano_fim: null,
    };
  }

  const anos = encontrados.map(Number);

  return {
    ano_inicio: Math.min(...anos),
    ano_fim: Math.max(...anos),
  };
}

export function extrairMotor(
  texto,
  motoresExtras = ""
) {
  const extras = String(
    motoresExtras || ""
  ).trim();

  const complementos = [
    "8V",
    "16V",
    "20V",
    "24V",
    "FLEX",
    "GASOLINA",
    "DIESEL",
    "TURBO",
    "MPI",
    "TDI",
    "TSI",
    "DCI",
    "TCE",
    "FIRE",
    "ETORQ",
    "E.TORQ",
    extras,
  ]
    .filter(Boolean)
    .join("|")
    .replace(/\./g, "\\.");

  const regex = new RegExp(
    `\\b\\d\\.\\d(?:\\s?(?:${complementos}))?\\b`,
    "i"
  );

  const resultado =
    String(texto || "").match(regex);

  return resultado
    ? limparTexto(resultado[0])
    : "";
}

export function extrairModelo(
  linha,
  modelos = []
) {
  const listaModelos = Array.isArray(
    modelos
  )
    ? modelos
    : [];

  const modeloEncontrado =
    listaModelos.find((modelo) => {
      const regex = new RegExp(
        `\\b${escaparRegex(modelo)}\\b`,
        "i"
      );

      return regex.test(
        String(linha || "")
      );
    });

  return modeloEncontrado
    ? limparTexto(modeloEncontrado)
    : "";
}

export function possuiModelo(
  linha,
  modelos = []
) {
  return Boolean(
    extrairModelo(linha, modelos)
  );
}

export function possuiMontadora(
  linha,
  montadoras = []
) {
  return montadoras.some(
    (montadora) => {
      const regex = new RegExp(
        `\\b${escaparRegex(
          montadora
        )}\\b`,
        "i"
      );

      return regex.test(
        String(linha || "")
      );
    }
  );
}

export function extrairEquivalentes({
  codigoPrincipal,
  linhasEquivalencias = [],
  tamanhoMinimo = 4,
  tamanhoMaximo = 25,
}) {
  const codigoNormalizado =
    limparCodigo(codigoPrincipal);

  if (!codigoNormalizado) {
    return "";
  }

  const linhaEquivalente =
    linhasEquivalencias.find(
      (linha) =>
        String(linha || "")
          .toUpperCase()
          .includes(codigoNormalizado)
    );

  if (!linhaEquivalente) {
    return "";
  }

  const equivalentes =
    String(linhaEquivalente)
      .split(/[\s,;|/]+/)
      .map(limparCodigo)
      .filter((codigo) =>
        pareceCodigo(codigo, {
          tamanhoMinimo,
          tamanhoMaximo,
        })
      )
      .filter(
        (codigo) =>
          codigo !== codigoNormalizado
      );

  return Array.from(
    new Set(equivalentes)
  ).join(", ");
}

export function removerDuplicados(
  registros,
  campos = [
    "codigo_oem",
    "montadora",
    "modelo",
    "motor",
    "ano_inicio",
    "ano_fim",
  ]
) {
  const mapa = new Map();

  for (const registro of registros) {
    const chave = campos
      .map((campo) =>
        String(
          registro?.[campo] || ""
        )
          .trim()
          .toUpperCase()
      )
      .join("|");

    if (!mapa.has(chave)) {
      mapa.set(chave, registro);
    }
  }

  return Array.from(mapa.values());
}

export function criarParserBase({
  fabricante,
  origemCatalogo,
  nomePeca,
  montadoraFixa = "",
  modelos = [],
  montadoras = [],
  prioridade = 5,
  confiabilidade = 90,
  tamanhoMinimoCodigo = 4,
  tamanhoMaximoCodigo = 25,
  motoresExtras = "",
}) {
  return async function importarCatalogo({
    textoAplicacoes = "",
    textoEquivalencias = "",
    nomeArquivo = "",
    configuracao = {},
    onProgresso,
  }) {
    const origemFinal =
      configuracao.origemCatalogo ||
      origemCatalogo ||
      nomeArquivo ||
      `Catálogo ${fabricante}`;

    const linhas =
      separarLinhas(textoAplicacoes);

    const linhasEquivalencias =
      separarLinhas(
        textoEquivalencias
      );

    const registros = [];

    let codigoAtual = "";

    for (
      let indice = 0;
      indice < linhas.length;
      indice += 1
    ) {
      const linha = linhas[indice];

      const codigoEncontrado =
        encontrarCodigo(linha, {
          tamanhoMinimo:
            tamanhoMinimoCodigo,
          tamanhoMaximo:
            tamanhoMaximoCodigo,
        });

      if (codigoEncontrado) {
        codigoAtual =
          codigoEncontrado;
      }

      if (!codigoAtual) {
        continue;
      }

      const modelo =
        extrairModelo(
          linha,
          modelos
        );

      const temModelo =
        modelos.length === 0 ||
        Boolean(modelo);

      const temMontadora =
        montadoras.length === 0 ||
        possuiMontadora(
          linha,
          montadoras
        );

      if (
        !temModelo ||
        !temMontadora
      ) {
        continue;
      }

      const anos =
        extrairAnos(linha);

      const equivalentes =
        extrairEquivalentes({
          codigoPrincipal:
            codigoAtual,
          linhasEquivalencias,
          tamanhoMinimo:
            tamanhoMinimoCodigo,
          tamanhoMaximo:
            tamanhoMaximoCodigo,
        });

      const montadora =
        montadoraFixa ||
        montadoras.find(
          (item) =>
            possuiMontadora(
              linha,
              [item]
            )
        ) ||
        "";

      registros.push({
        peca:
          nomePeca ||
          `Autopeça ${fabricante}`,

        codigo_oem:
          codigoAtual,

        codigo_equivalente:
          equivalentes,

        fabricante,

        origem_catalogo:
          origemFinal,

        montadora,

        modelo,

        motor:
          extrairMotor(
            linha,
            motoresExtras
          ),

        ano_inicio:
          anos.ano_inicio,

        ano_fim:
          anos.ano_fim,

        observacao:
          linha,

        pagina_catalogo:
          null,

        ativo:
          true,

        prioridade,

        confiabilidade,
      });

      if (
        indice > 0 &&
        indice % 100 === 0
      ) {
        onProgresso?.(
          `🧠 ${fabricante}: ${registros.length} registros encontrados...`
        );
      }
    }

    return removerDuplicados(
      registros
    );
  };
}

function escaparRegex(valor) {
  return String(valor || "")
    .replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
}