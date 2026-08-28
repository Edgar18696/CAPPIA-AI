/*
 * ============================================================
 * APPIA AI
 * PARSER MAGNETI MARELLI — PARA-CHOQUES
 * Parts_Bumpers_EN.pdf
 * ============================================================
 *
 * Objetivo:
 *
 * BMP077F
 *   ↓
 * Para-choque
 *   ↓
 * ALFA ROMEO
 *   ↓
 * 147 (937)
 *   ↓
 * OE / equivalências
 *
 * ============================================================
 */

function limparTexto(valor = "") {
  return String(valor || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function normalizarTexto(valor = "") {
  return limparTexto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function separarLinhas(texto = "") {
  return String(texto || "")
    .split(/\r?\n/)
    .map(limparTexto)
    .filter(Boolean);
}

/*
 * ============================================================
 * CÓDIGO MAGNETI
 * ============================================================
 *
 * Exemplos:
 *
 * BMP077F
 * BMP078F
 * BMP076R
 * BMP079R
 * BMP080R
 *
 * ============================================================
 */

function extrairCodigosBMP(texto = "") {
  const encontrados =
    normalizarTexto(texto).match(
      /\bBMP[A-Z0-9]{2,12}\b/g
    ) || [];

  return [
    ...new Set(encontrados),
  ];
}

/*
 * ============================================================
 * CÓDIGOS LONGOS MAGNETI
 * ============================================================
 *
 * Exemplo:
 *
 * 021316000770
 *
 * ============================================================
 */

function extrairCodigosLongos(texto = "") {
  const encontrados =
    String(texto || "").match(
      /\b\d{9,15}\b/g
    ) || [];

  return [
    ...new Set(
      encontrados.map(limparTexto)
    ),
  ];
}

/*
 * ============================================================
 * ANOS
 * ============================================================
 */

function extrairAnos(texto = "") {
  const encontrados =
    String(texto || "").match(
      /\b(?:19|20)\d{2}\b/g
    ) || [];

  const anos = encontrados
    .map(Number)
    .filter(
      (ano) =>
        ano >= 1950 &&
        ano <= 2100
    );

  if (!anos.length) {
    return {
      ano_inicio: null,
      ano_fim: null,
    };
  }

  return {
    ano_inicio:
      Math.min(...anos),

    ano_fim:
      Math.max(...anos),
  };
}

/*
 * ============================================================
 * MONTADORAS
 * ============================================================
 */

const MONTADORAS = [
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
  "DODGE",
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
  "SEAT",
  "SKODA",
  "ŠKODA",
  "SMART",
  "SUBARU",
  "SUZUKI",
  "TOYOTA",
  "VAUXHALL",
  "VOLKSWAGEN",
  "VOLVO",
];

function ehMontadora(linha = "") {
  const texto =
    normalizarTexto(linha);

  return MONTADORAS.some(
    (montadora) =>
      texto ===
      normalizarTexto(montadora)
  );
}

/*
 * ============================================================
 * LINHAS QUE NÃO SÃO MODELO
 * ============================================================
 */

function ignorarComoModelo(linha = "") {
  const texto =
    normalizarTexto(linha);

  if (!texto) {
    return true;
  }

  if (
    texto.includes(
      "MAGNETI MARELLI"
    ) ||
    texto.includes(
      "PARTS & SERVICES"
    ) ||
    texto.includes(
      "VEHICLE APPLICATION"
    ) ||
    texto.includes(
      "BUYERS GUIDE"
    ) ||
    texto.includes(
      "CROSS REFERENCE"
    ) ||
    texto.includes(
      "BUMPER"
    ) ||
    texto.includes(
      "PARAURTI"
    )
  ) {
    return true;
  }

  if (
    extrairCodigosBMP(
      texto
    ).length
  ) {
    return true;
  }

  if (
    /^\d+$/.test(texto)
  ) {
    return true;
  }

  return false;
}

/*
 * ============================================================
 * TIPO DA PEÇA
 * ============================================================
 */

function detectarPeca(texto = "") {
  const normalizado =
    normalizarTexto(texto);

  if (
    normalizado.includes(
      "GRILLE"
    )
  ) {
    return "Grade do Para-choque";
  }

  if (
    normalizado.includes(
      "SPOILER"
    )
  ) {
    return "Spoiler do Para-choque";
  }

  if (
    normalizado.includes(
      "MOULDING"
    ) ||
    normalizado.includes(
      "MOLDING"
    )
  ) {
    return "Moldura do Para-choque";
  }

  if (
    normalizado.includes(
      "BRACKET"
    ) ||
    normalizado.includes(
      "SUPPORT"
    )
  ) {
    return "Suporte do Para-choque";
  }

  if (
    normalizado.includes(
      "COVER"
    )
  ) {
    return "Capa do Para-choque";
  }

  if (
    normalizado.includes(
      "INNER FENDER"
    )
  ) {
    return "Parabarro";
  }

  if (
    normalizado.includes(
      "REINFORCEMENT"
    ) ||
    normalizado.includes(
      "CROSSMEMBER"
    )
  ) {
    return "Travessa do Para-choque";
  }

  return "Para-choque";
}

/*
 * ============================================================
 * CRIAR REGISTRO
 * ============================================================
 */

function criarRegistro({
  codigo,
  montadora,
  modelo,
  linha,
  pagina,
  origemCatalogo,
}) {
  const anos =
    extrairAnos(linha);

  const codigosBMP =
    extrairCodigosBMP(linha);

  const codigosLongos =
    extrairCodigosLongos(linha);

  const equivalentes = [
    ...codigosBMP.filter(
      (item) =>
        item !== codigo
    ),

    ...codigosLongos,
  ];

  return {
    peca:
      detectarPeca(linha),

    codigo_oem:
      codigo,

    codigo_equivalente:
      equivalentes.join(", "),

    equivalentes,

    fabricante:
      "Magneti Marelli",

    montadora:
      montadora || "",

    modelo:
      modelo || "",

    motor:
      "",

    ano_inicio:
      anos.ano_inicio,

    ano_fim:
      anos.ano_fim,

    observacao:
      limparTexto(linha),

    origem_catalogo:
      origemCatalogo,

    pagina_catalogo:
      pagina,

    ativo:
      true,

    prioridade:
      2,

    confiabilidade:
      95,
  };
}

/*
 * ============================================================
 * PROCESSAR PÁGINA
 * ============================================================
 */

function processarPagina({
  texto,
  pagina,
  origemCatalogo,
}) {
  const linhas =
    separarLinhas(texto);

  const registros = [];

  let montadoraAtual = "";
  let modeloAtual = "";

  for (
    let indice = 0;
    indice < linhas.length;
    indice += 1
  ) {
    const linha =
      linhas[indice];

    /*
     * --------------------------------------------------------
     * MONTADORA
     * --------------------------------------------------------
     */

    if (
      ehMontadora(linha)
    ) {
      montadoraAtual =
        limparTexto(linha);

      modeloAtual = "";

      continue;
    }

    /*
     * --------------------------------------------------------
     * MODELO
     * --------------------------------------------------------
     */

    if (
      montadoraAtual &&
      !ignorarComoModelo(linha)
    ) {
      const proximaLinha =
        linhas[indice + 1] ||
        "";

      const proximaTemBMP =
        extrairCodigosBMP(
          proximaLinha
        ).length > 0;

      if (
        proximaTemBMP
      ) {
        modeloAtual =
          limparTexto(linha);
      }
    }

    /*
     * --------------------------------------------------------
     * CÓDIGOS BMP
     * --------------------------------------------------------
     */

    const codigos =
      extrairCodigosBMP(linha);

    if (!codigos.length) {
      continue;
    }

    /*
     * O PDF pode quebrar a mesma linha
     * visual em várias linhas de texto.
     *
     * Juntamos uma pequena janela para
     * recuperar códigos OE e informações.
     */

    const contexto = [
      linhas[indice - 2] || "",
      linhas[indice - 1] || "",
      linha,
      linhas[indice + 1] || "",
      linhas[indice + 2] || "",
    ]
      .filter(Boolean)
      .join(" ");

    for (
      const codigo of codigos
    ) {
      registros.push(
        criarRegistro({
          codigo,

          montadora:
            montadoraAtual,

          modelo:
            modeloAtual,

          linha:
            contexto,

          pagina,

          origemCatalogo,
        })
      );
    }
  }

  return registros;
}

/*
 * ============================================================
 * REMOVER DUPLICADOS
 * ============================================================
 */

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
      registro.montadora,
      registro.modelo,
      registro.ano_inicio,
      registro.ano_fim,
    ]
      .map(
        (valor) =>
          normalizarTexto(
            valor
          )
      )
      .join("|");

    if (
      !mapa.has(chave)
    ) {
      mapa.set(
        chave,
        registro
      );

      continue;
    }

    /*
     * Junta equivalências caso o mesmo
     * código apareça mais de uma vez.
     */

    const existente =
      mapa.get(chave);

    const equivalentes = [
      ...(existente
        ?.equivalentes || []),

      ...(registro
        ?.equivalentes || []),
    ];

    existente.equivalentes = [
      ...new Set(
        equivalentes.filter(Boolean)
      ),
    ];

    existente.codigo_equivalente =
      existente.equivalentes.join(
        ", "
      );
  }

  return Array.from(
    mapa.values()
  );
}

/*
 * ============================================================
 * PARSER PRINCIPAL
 * ============================================================
 */

export function parserMagnetiMarelliParachoques({
  paginas = [],
  paginasAplicacoes = [],
  paginasEquivalencias = [],
  configuracao = {},
  onProgresso,
} = {}) {
  const origemCatalogo =
    configuracao.origemCatalogo ||
    "Catálogo Magneti Marelli Para-choques 2015-2016";

  /*
   * Aceita os dois formatos utilizados
   * pelo motor de importação.
   */

  const paginasFonte =
    paginasAplicacoes.length
      ? paginasAplicacoes
      : paginas;

  const registros = [];

  for (
    let indice = 0;
    indice < paginasFonte.length;
    indice += 1
  ) {
    const pagina =
      paginasFonte[indice] || {};

    const numeroPagina =
      pagina.numeroPagina ||
      pagina.pagina ||
      indice + 1;

    const texto =
      pagina.texto ||
      pagina.conteudo ||
      "";

    const encontrados =
      processarPagina({
        texto,
        pagina:
          numeroPagina,
        origemCatalogo,
      });

    registros.push(
      ...encontrados
    );

    onProgresso?.({
      etapa:
        "processando_parachoques",

      fabricante:
        "Magneti Marelli",

      pagina:
        numeroPagina,

      totalPaginas:
        paginasFonte.length,

      registrosEncontrados:
        registros.length,
    });
  }

  const registrosUnicos =
    removerDuplicados(
      registros
    );

  console.log(
    "🚘 MAGNETI PARA-CHOQUES:",
    {
      paginas:
        paginasFonte.length,

      encontrados:
        registros.length,

      unicos:
        registrosUnicos.length,
    }
  );

  return {
    fabricante:
      "Magneti Marelli",

    origemCatalogo,

    registros:
      registrosUnicos,

    equivalencias:
      paginasEquivalencias,

    totalRegistros:
      registrosUnicos.length,
  };
}

export default parserMagnetiMarelliParachoques;