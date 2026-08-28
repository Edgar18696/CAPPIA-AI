/*
 * ============================================================
 * MAGNETI MARELLI / WEBER
 * BATERIAS WEBER 2025
 * ============================================================
 *
 * Catálogo:
 * Parts_Weber_batteries_EN.pdf
 *
 * Estrutura:
 *
 * Part number
 * Short
 * Ah
 * A (EN)
 * Type
 * Length x Width x Height
 * Hold down
 *
 * ============================================================
 */

function texto(valor = "") {
  return String(
    valor ?? ""
  )
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function normalizar(valor = "") {
  return String(
    valor ?? ""
  )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toUpperCase()
    .trim();
}

/*
 * ============================================================
 * LINHA / TECNOLOGIA
 * ============================================================
 */

function identificarLinhaBateria(
  codigoCurto = "",
  ah = null
) {
  const codigo =
    normalizar(
      codigoCurto
    );

  if (
    codigo.includes(
      "AGM"
    )
  ) {
    return "AGM";
  }

  if (
    codigo.includes(
      "EFB"
    )
  ) {
    return "EFB";
  }

  if (
    codigo.startsWith(
      "WP"
    )
  ) {
    return "POWER";
  }

  if (
    codigo.startsWith(
      "WS"
    )
  ) {
    return "SHD";
  }

  /*
   * WEBER ASIAN:
   *
   * W37JL
   * W37JR
   * W45JL
   * W45JR
   * W45EL
   * W45ER
   * W60JL
   * W60JR
   * W70JL
   * W70JR
   * W95JL
   * W95JR
   */

  if (
    /^W\d+(?:J|E)[LR]/.test(
      codigo
    ) ||
    /^W\d+JR1$/.test(
      codigo
    )
  ) {
    return "ASIAN";
  }

  /*
   * WEBER HD:
   *
   * códigos convencionais acima
   * de aproximadamente 110 Ah.
   *
   * WP = POWER
   * WS = SHD
   * portanto não entram aqui.
   */

  if (
    Number.isFinite(
      Number(ah)
    ) &&
    Number(ah) >= 110
  ) {
    return "HD";
  }

  return "WEBER";
}

/*
 * ============================================================
 * EXTRAÇÃO GLOBAL
 * ============================================================
 *
 * IMPORTANTE:
 *
 * Não dependemos mais de cada bateria estar em uma única linha.
 *
 * O texto pode chegar:
 *
 * 067060680003
 * W60AGM
 * 60
 * 680
 * L02
 * 242 × 175 × 190
 * B13
 *
 * OU:
 *
 * 067060680003 W60AGM 60 680 L02 242 × 175 × 190 B13
 *
 * ============================================================
 */

function extrairRegistros(
  textoCompleto = ""
) {
  const preparado =
    String(
      textoCompleto || ""
    )
      .replace(
        /\u00a0/g,
        " "
      )
      .replace(
        /\r?\n/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  const registros = [];

  /*
   * Estrutura oficial:
   *
   * 067060680003
   * W60AGM
   * 60
   * 680
   * L02
   * 242 × 175 × 190
   * B13
   *
   * Fixação também pode ser:
   *
   * B03+B06
   * B03 + B06
   */

  const regex =
    /\b(\d{12})\s+([A-Z][A-Z0-9]{2,12})\s+(\d{2,3})\s+(\d{3,4})\s+([A-Z0-9]{1,6})\s+(\d{3})\s*[×xX]\s*(\d{3})\s*[×xX]\s*(\d{3})\s+(B\d{2}(?:\s*\+\s*B\d{2})?)/gi;

  let match;

  while (
    (
      match =
        regex.exec(
          preparado
        )
    ) !== null
  ) {
    const codigoLongo =
      match[1];

    const codigoCurto =
      normalizar(
        match[2]
      );

    const ah =
      Number(
        match[3]
      );

    const corrente =
      Number(
        match[4]
      );

    const tipoCaixa =
      normalizar(
        match[5]
      );

    const comprimento =
      Number(
        match[6]
      );

    const largura =
      Number(
        match[7]
      );

    const altura =
      Number(
        match[8]
      );

    const fixacao =
      normalizar(
        match[9]
      )
        .replace(
          /\s+/g,
          ""
        );

    const linhaBateria =
      identificarLinhaBateria(
        codigoCurto,
        ah
      );

    registros.push({
      codigoLongo,
      codigoCurto,

      ah,
      corrente,

      tipoCaixa,

      comprimento,
      largura,
      altura,

      fixacao,

      linhaBateria,
    });
  }

  return registros;
}

/*
 * ============================================================
 * REGISTRO APPIA
 * ============================================================
 */

function montarRegistro({
  item,
  nomeArquivo,
  configuracao,
}) {
  const observacao = [
    `Código Weber: ${item.codigoCurto}`,

    `Código Magneti Marelli: ${item.codigoLongo}`,

    `Capacidade: ${item.ah} Ah`,

    `Corrente de partida: ${item.corrente} A EN`,

    `Linha: ${item.linhaBateria}`,

    `Tipo de caixa: ${item.tipoCaixa}`,

    `Dimensões: ${item.comprimento} x ${item.largura} x ${item.altura} mm`,

    `Fixação: ${item.fixacao}`,
  ]
    .filter(Boolean)
    .join(
      " | "
    );

  return {
    peca:
      "Bateria",

    descricao:
      `Bateria Weber ${item.linhaBateria}`,

    /*
     * PART NUMBER oficial
     */

    codigo_oem:
      item.codigoLongo,

    codigo:
      item.codigoLongo,

    /*
     * Código curto Weber.
     *
     * Também será pesquisável
     * pelo APPIA.
     */

    codigo_equivalente:
      item.codigoCurto,

    equivalentes: [
      item.codigoCurto,
    ],

    fabricante:
      "Magneti Marelli",

    marca:
      "Weber",

    origem_catalogo:
      configuracao
        ?.origemCatalogo ||
      "Catálogo Weber Batteries 2025",

    origemCatalogo:
      configuracao
        ?.origemCatalogo ||
      "Catálogo Weber Batteries 2025",

    arquivo_catalogo:
      nomeArquivo ||
      null,

    tipo_catalogo:
      "baterias_weber",

    tipoCatalogo:
      "baterias_weber",

    familia_catalogo:
      "Baterias",

    familia:
      "Baterias",

    categoria:
      "Elétrico",

    subcategoria:
      "Baterias",

    sistema:
      "Sistema Elétrico",

    tipo:
      `Bateria ${item.linhaBateria}`,

    linha:
      item.linhaBateria,

    /*
     * Este catálogo é técnico.
     * Não possui aplicação
     * direta por veículo.
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
     * Dados técnicos adicionais.
     */

    capacidade_ah:
      item.ah,

    corrente_partida_a:
      item.corrente,

    comprimento_mm:
      item.comprimento,

    largura_mm:
      item.largura,

    altura_mm:
      item.altura,

    tipo_caixa:
      item.tipoCaixa,

    fixacao:
      item.fixacao,

    observacao,

    ativo:
      true,

    prioridade:
      1,

    confiabilidade:
      100,
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
    const chave =
      normalizar(
        registro.codigo_oem
      );

    if (
      !chave
    ) {
      continue;
    }

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

  return [
    ...mapa.values(),
  ];
}

/*
 * ============================================================
 * PARSER PRINCIPAL
 * ============================================================
 */

export async function parserMagnetiMarelliBateriasWeber({
  textoReferencias = "",
  textoAplicacoes = "",
  textoEquivalencias = "",
  nomeArquivo = "",
  configuracao = {},
  onProgresso,
} = {}) {
  onProgresso?.(
    "🔋 Lendo Weber Batteries 2025..."
  );

  /*
   * O motor atualmente lê páginas
   * técnicas em mais de uma faixa.
   *
   * Juntamos tudo e removemos
   * duplicados pelo Part Number.
   */

  const textoCompleto = [
    textoReferencias,
    textoAplicacoes,
    textoEquivalencias,
  ]
    .filter(Boolean)
    .join(
      "\n"
    );
  /*
   * ========================================================
   * DIAGNÓSTICO TEMPORÁRIO — W60AGM
   * ========================================================
   */

  const textoDiagnostico =
    String(
      textoCompleto || ""
    );

  const posicaoW60Agm =
    textoDiagnostico
      .toUpperCase()
      .indexOf(
        "W60AGM"
      );

  console.log(
    "🎯 POSIÇÃO W60AGM:",
    posicaoW60Agm
  );

  if (
    posicaoW60Agm >= 0
  ) {
    const inicio =
      Math.max(
        0,
        posicaoW60Agm - 250
      );

    const fim =
      Math.min(
        textoDiagnostico.length,
        posicaoW60Agm + 350
      );

    console.log(
      "🎯 TEXTO BRUTO W60AGM:",
      textoDiagnostico.slice(
        inicio,
        fim
      )
    );
  } else {
    console.log(
      "❌ W60AGM NÃO EXISTE NO TEXTO RECEBIDO PELO PARSER"
    );
  }
  
  /*
   * ========================================================
   * EXTRAÇÃO
   * ========================================================
   */

  const itens =
    extrairRegistros(
      textoCompleto
    );

  const registros =
    itens.map(
      (item) =>
        montarRegistro({
          item,
          nomeArquivo,
          configuracao,
        })
    );

  const resultado =
    removerDuplicados(
      registros
    );

  /*
   * ========================================================
   * DIAGNÓSTICOS
   * ========================================================
   */

  const testeW60Agm =
    resultado.filter(
      (item) =>
        normalizar(
          item.codigo_equivalente
        ) ===
        "W60AGM"
    );

  const testePartNumber =
    resultado.filter(
      (item) =>
        normalizar(
          item.codigo_oem
        ) ===
        "067060680003"
    );

  const testeW55Efb =
    resultado.filter(
      (item) =>
        normalizar(
          item.codigo_equivalente
        ) ===
        "W55EFB"
    );

  const testeWp44r =
    resultado.filter(
      (item) =>
        normalizar(
          item.codigo_equivalente
        ) ===
        "WP44R"
    );

  console.log(
    "=========================================="
  );

  console.log(
    "🔋 WEBER BATTERIES 2025"
  );

  console.log(
    "ARQUIVO:",
    nomeArquivo
  );

  console.log(
    "TEXTO RECEBIDO:",
    textoCompleto.length,
    "caractere(s)"
  );

  console.log(
    "REGISTROS BRUTOS:",
    itens.length
  );

  console.log(
    "REGISTROS ÚNICOS:",
    resultado.length
  );

  console.log(
    "🎯 W60AGM:",
    testeW60Agm
  );

  console.log(
    "🎯 067060680003:",
    testePartNumber
  );

  console.log(
    "🎯 W55EFB:",
    testeW55Efb
  );

  console.log(
    "🎯 WP44R:",
    testeWp44r
  );

  console.log(
    "=========================================="
  );

  onProgresso?.(
    `✅ Weber Batteries 2025: ${resultado.length} bateria(s) encontrada(s).`
  );

  return resultado;
}

export default
  parserMagnetiMarelliBateriasWeber;