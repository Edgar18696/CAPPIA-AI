/*
 * ============================================================
 * APPIA AI
 * PARSER MAGNETI MARELLI — LÂMPADAS
 * Parts_Bulbs_MM_folder_EN.pdf
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
 * CATEGORIAS
 * ============================================================
 */

const CATEGORIAS = [
  "XENON",
  "STANDARD",
  "+150% LIGHT",
  "LONG LIFE",
  "WHITE 4200K",
  "HEAVY DUTY",
  "HEAVY DUTY LONG LIFE",
  "LED",
];

function detectarCategoria(
  linha = ""
) {
  const texto =
    normalizarTexto(
      linha
    );

  const encontrada =
    CATEGORIAS.find(
      (categoria) =>
        normalizarTexto(
          categoria
        ) === texto
    );

  return encontrada || "";
}

/*
 * ============================================================
 * CÓDIGO LONGO MARELLI
 * ============================================================
 */

function extrairCodigoLongo(
  linha = ""
) {
  const match =
    String(
      linha || ""
    ).match(
      /\b\d{12}\b/
    );

  return match
    ? match[0]
    : "";
}

/*
 * ============================================================
 * LINHAS VÁLIDAS DE PRODUTO
 * ============================================================
 */

function pareceLinhaProduto(
  linha = ""
) {
  const codigoLongo =
    extrairCodigoLongo(
      linha
    );

  if (!codigoLongo) {
    return false;
  }

  /*
   * Exige algum conteúdo antes
   * do código longo, que será
   * o short code.
   */

  const indice =
    linha.indexOf(
      codigoLongo
    );

  if (
    indice <= 0
  ) {
    return false;
  }

  return true;
}

/*
 * ============================================================
 * PARSE DA LINHA
 * ============================================================
 *
 * Exemplo:
 *
 * H7 12V 002557100000 H7 55 12 PX26d
 *
 * C5W 24V 009423100000 C5W 5 24 SV8.5-8
 *
 * LEDH7 003009070000 H7 19 12/24 PX26d
 *
 * ============================================================
 */

function parseLinhaProduto(
  linha = ""
) {
  const texto =
    limparTexto(
      linha
    );

  const codigoLongo =
    extrairCodigoLongo(
      texto
    );

  if (!codigoLongo) {
    return null;
  }

  const indiceCodigo =
    texto.indexOf(
      codigoLongo
    );

  const antes =
    limparTexto(
      texto.slice(
        0,
        indiceCodigo
      )
    );

  const depois =
    limparTexto(
      texto.slice(
        indiceCodigo +
        codigoLongo.length
      )
    );

  const partesDepois =
    depois
      .split(/\s+/)
      .filter(Boolean);

  /*
   * Estrutura após código longo:
   *
   * tipoLampada
   * potencia
   * voltagem
   * soquete
   */

  const tipoLampada =
    partesDepois[0] ||
    "";

  const potencia =
    partesDepois[1] ||
    "";

  const voltagem =
    partesDepois[2] ||
    "";

  const soquete =
    partesDepois
      .slice(3)
      .join(" ");

  /*
   * Short code é tudo que veio
   * antes do código longo.
   */

  const codigoCurto =
    antes;

  return {
    codigoCurto,
    codigoLongo,
    tipoLampada,
    potencia,
    voltagem,
    soquete,
  };
}

/*
 * ============================================================
 * FUNÇÃO / APLICAÇÃO GENÉRICA
 * ============================================================
 *
 * O catálogo não relaciona veículo,
 * montadora ou modelo.
 *
 * Então usamos apenas a função técnica.
 * ============================================================
 */

function identificarFuncao(
  tipoLampada = ""
) {
  const tipo =
    normalizarTexto(
      tipoLampada
    );

  if (
    /^D[1-5][RS]$/.test(
      tipo
    )
  ) {
    return "Farol Xenon";
  }

  if (
    /^H(?:1|3|4|7|8|9|10|11|15|16|18)$/.test(
      tipo
    ) ||
    /^HB[1-4]$/.test(
      tipo
    ) ||
    tipo === "HIR2"
  ) {
    return "Farol";
  }

  if (
    /P21W|PY21W|WY21W|H21W/.test(
      tipo
    )
  ) {
    return "Sinalização";
  }

  if (
    /W5W|W3W|T4W|R5W|C5W|C10W/.test(
      tipo
    )
  ) {
    return "Iluminação Auxiliar";
  }

  return "Iluminação Automotiva";
}

/*
 * ============================================================
 * REGISTRO
 * ============================================================
 */

function criarRegistro({
  produto,
  categoria,
  origemCatalogo,
  pagina,
}) {
  const funcao =
    identificarFuncao(
      produto.tipoLampada
    );

  const nomePeca =
    produto.tipoLampada
      ? `Lâmpada Automotiva ${produto.tipoLampada}`
      : "Lâmpada Automotiva";

  const observacao = [
    `Produto: Lâmpada Automotiva`,
    produto.tipoLampada
      ? `Tipo: ${produto.tipoLampada}`
      : "",
    produto.potencia
      ? `Potência: ${produto.potencia} W`
      : "",
    produto.voltagem
      ? `Voltagem: ${produto.voltagem} V`
      : "",
    produto.soquete
      ? `Soquete: ${produto.soquete}`
      : "",
    categoria
      ? `Linha: ${categoria}`
      : "",
    produto.codigoCurto
      ? `Código curto: ${produto.codigoCurto}`
      : "",
    produto.codigoLongo
      ? `Código Magneti Marelli: ${produto.codigoLongo}`
      : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    /*
     * PEÇA
     */

    peca:
      nomePeca,

    descricao:
      `${nomePeca} | ${funcao}`,

    /*
     * CÓDIGO PRINCIPAL
     */

    codigo:
      produto.codigoLongo,

    codigo_oem:
      produto.codigoLongo,

    codigo_magneti:
      produto.codigoLongo,

    /*
     * CÓDIGO CURTO MARELLI
     *
     * Não usar o soquete como equivalente.
     */

    codigo_equivalente:
      produto.codigoCurto || null,

    equivalentes:
      produto.codigoCurto
        ? [produto.codigoCurto]
        : [],

    /*
     * FABRICANTE
     */

    fabricante:
      "Magneti Marelli",

    /*
     * ESTE CATÁLOGO NÃO POSSUI
     * APLICAÇÃO POR VEÍCULO
     */

    montadora:
      null,

    modelo:
      null,

    motor:
      null,

    ano_inicio:
      null,

    ano_fim:
      null,

    /*
     * DADOS TÉCNICOS
     */

    tipo_lampada:
      produto.tipoLampada || null,

    potencia:
      produto.potencia || null,

    voltagem:
      produto.voltagem || null,

    soquete:
      produto.soquete || null,

    linha:
      categoria || null,

    aplicacao:
      null,

    /*
     * CLASSIFICAÇÃO APPIA
     */

    categoria:
      "Iluminação",

    subcategoria:
      "Lâmpadas Automotivas",

    sistema:
      "Iluminação Automotiva",

    tipo_catalogo:
      "lampadas",

    /*
     * ORIGEM
     */

    observacao,

    origem_catalogo:
      origemCatalogo,

    pagina_catalogo:
      pagina,

    /*
     * CONTROLE
     */

    ativo:
      true,

    prioridade:
      2,

    confiabilidade:
      98,
  };
}

/*
 * ============================================================
 * DUPLICADOS
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
      registro.codigo_equivalente,
      registro.tipo,
    ]
      .map(
        normalizarTexto
      )
      .join("|");

    if (
      !mapa.has(
        chave
      )
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

/*
 * ============================================================
 * PROCESSAR TEXTO
 * ============================================================
 */

function processarTexto({
  texto = "",
  pagina = null,
  origemCatalogo,
}) {
  const linhas =
    separarLinhas(
      texto
    );

  const registros = [];

  let categoriaAtual =
    "";

  for (
    const linha
    of linhas
  ) {
    const categoria =
      detectarCategoria(
        linha
      );

    if (
      categoria
    ) {
      categoriaAtual =
        categoria;

      continue;
    }

    if (
      !pareceLinhaProduto(
        linha
      )
    ) {
      continue;
    }

    const produto =
      parseLinhaProduto(
        linha
      );

    if (
      !produto
    ) {
      continue;
    }

    registros.push(
      criarRegistro({
        produto,

        categoria:
          categoriaAtual ||
          "STANDARD",

        origemCatalogo,

        pagina,
      })
    );
  }

  return registros;
}

/*
 * ============================================================
 * PARSER PRINCIPAL
 * ============================================================
 */

export async function parserMagnetiMarelliLampadas({
  textoReferencias = "",
  textoAplicacoes = "",
  textoEquivalencias = "",
  nomeArquivo = "",
  configuracao = {},
  onProgresso,
} = {}) {
  const origemCatalogo =
    configuracao
      ?.origemCatalogo ||
    "Catálogo Magneti Marelli Bulbs 2025";

  /*
   * Neste catálogo os produtos estão
   * concentrados nas páginas/tabelas
   * técnicas.
   *
   * Então juntamos todos os textos
   * disponíveis.
   */

  const textoCompleto = [
    textoReferencias,
    textoAplicacoes,
    textoEquivalencias,
  ]
    .filter(Boolean)
    .join("\n");

  onProgresso?.(
    "💡 Lendo catálogo Magneti Marelli Bulbs..."
  );

  const registros =
    processarTexto({
      texto:
        textoCompleto,

      pagina:
        null,

      origemCatalogo,
    });

  const registrosUnicos =
    removerDuplicados(
      registros
    );

  const h7 =
    registrosUnicos.filter(
      (registro) =>
        normalizarTexto(
          registro.codigo_equivalente
        ).includes(
          "H7"
        )
    );

  console.log(
    "=========================================="
  );

  console.log(
    "💡 MAGNETI MARELLI BULBS"
  );

  console.log(
    "ARQUIVO:",
    nomeArquivo
  );

  console.log(
    "REGISTROS:",
    registros.length
  );

  console.log(
    "ÚNICOS:",
    registrosUnicos.length
  );

  console.log(
    "🎯 H7:",
    h7.slice(
      0,
      10
    )
  );

  console.log(
    "=========================================="
  );

  onProgresso?.(
    `✅ Lâmpadas Magneti Marelli: ${registrosUnicos.length} registro(s) encontrado(s).`
  );

  return registrosUnicos;
}

export default parserMagnetiMarelliLampadas;