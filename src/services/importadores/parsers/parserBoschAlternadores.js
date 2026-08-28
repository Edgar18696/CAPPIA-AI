function limparTexto(valor) {
  return String(valor || "")
    .replace(/\u00a0/g, " ")
    .replace(/[➜→]/g, " até ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarTexto(valor = "") {
  return limparTexto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizarCodigo(valor) {
  return limparTexto(valor)
    .replace(/\*/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

function formatarCodigoBosch(valor) {
  const codigo =
    normalizarCodigo(valor);

  if (!codigo) {
    return "";
  }

  return codigo;
}

function extrairAno(valor) {
  const texto =
    String(valor || "");

  const encontrado =
    texto.match(
      /(?:\d{2}\.)?(\d{4})/
    );

  return encontrado
    ? Number(encontrado[1])
    : null;
}

function identificarMontadora(linha) {
  const texto =
    limparTexto(linha)
      .toUpperCase();

  const montadoras = [
    "AGCO",
    "AGRALE",
    "ATLAS COPCO",
    "AUDI",
    "BMW",
    "CASE",
    "CATERPILLAR",
    "CHEVROLET",
    "CHRYSLER",
    "DAF",
    "DECAROLI",
    "FIAT",
    "FORD",
    "IVECO",
    "JOHN DEERE",
    "MAN",
    "MAFERSA",
    "MASSEY FERGUSON",
    "MERCEDES-BENZ",
    "NEW HOLLAND",
    "OM (BRESCIA)",
    "PUMA",
    "RENAULT",
    "SCANIA",
    "VALTRA",
    "VOLKSWAGEN",
    "VW (VOLKSWAGEN)",
    "VOLVO",
  ];

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

function detectarSecao(linha = "") {
  const texto =
    normalizarTexto(linha);

  /*
   * Cabeçalho das tabelas
   * de Motores de Partida.
   */
  if (
    texto.includes(
      "motor de partida"
    ) ||
    texto.includes(
      "motor de arranque"
    )
  ) {
    return "motor_partida";
  }

  /*
   * Cabeçalho das tabelas
   * de Alternadores.
   */
  if (
    texto.includes("alternador") &&
    (
      texto.includes("regulador") ||
      texto.includes(
        "conjunto retificador"
      ) ||
      texto.includes("estator")
    )
  ) {
    return "alternador";
  }

  return "";
}

function detectarLayoutMotorPartida(
  linha = ""
) {
  const texto =
    normalizarTexto(linha);

  if (
    texto.includes(
      "bobina de campo"
    ) ||
    texto.includes(
      "carcaca polar"
    )
  ) {
    return "com_bobina_campo";
  }

  return "";
}

function pareceCabecalho(linha) {
  const texto =
    normalizarTexto(linha);

  return (
    !texto ||
    texto.includes(
      "autopecas bosch"
    ) ||
    texto.includes(
      "tipo/tensao/potencia"
    ) ||
    texto.includes(
      "data de aplicacao"
    ) ||
    texto.includes(
      "conjunto retificador"
    ) ||
    texto.includes(
      "placa de diodos"
    ) ||
    texto.includes(
      "rolamento do mancal"
    ) ||
    texto.includes(
      "rolamento do rotor"
    ) ||
    texto.includes(
      "pinhao do impulsor"
    ) ||
    texto.includes(
      "chave magnetica"
    ) ||
    texto.includes(
      "rele de partida"
    ) ||
    texto.includes(
      "rele de arranque"
    ) ||
    texto.includes(
      "bobina de campo"
    ) ||
    texto.includes(
      "carcaca polar"
    ) ||
    texto.includes(
      "porta-escovas"
    ) ||
    texto.includes(
      "engrenagem planetaria"
    ) ||
    texto.includes(
      "item descontinuado"
    ) ||
    texto.includes(
      "veiculos sem ar condicionado"
    ) ||
    texto.includes(
      "veiculos com ar condicionado"
    ) ||
    /^b\d+\s*\|\s*b\d+$/i.test(
      limparTexto(linha)
    ) ||
    /^[1-9](?:\s+[1-9])+$/.test(
      limparTexto(linha)
    )
  );
}

function extrairCodigosBosch(linha) {
  const texto =
    limparTexto(linha);

  const padroes = [
    /*
     * Ex:
     * 0 001 107 534
     * 9 120 080 193
     * 2 339 305 306
     */
    /\b[0-9]\s+[0-9A-Z]{3}\s+[0-9A-Z]{3}\s+[0-9A-Z]{3}\b/gi,

    /*
     * Ex:
     * F 000 AL0 137
     * F 042 002 093
     * F 00M 145 307
     * F 006 LD0 800
     * F 00A SH0 138
     */
    /\bF\s+[0-9A-Z]{3}\s+[0-9A-Z]{3}\s+[0-9A-Z]{3}\b/gi,

    /*
     * Formatos já sem espaço.
     */
    /\b[0-9]{10}\b/g,

    /*
     * F000AL0137
     * F042002093 etc.
     */
    /\bF[0-9A-Z]{9}\b/gi,
  ];

  const codigos = [];

  for (
    const padrao
    of padroes
  ) {
    const encontrados =
      texto.match(
        padrao
      ) || [];

    for (
      const encontrado
      of encontrados
    ) {
      const codigo =
        formatarCodigoBosch(
          encontrado
        );

      if (
        codigo &&
        !codigos.includes(
          codigo
        )
      ) {
        codigos.push(
          codigo
        );
      }
    }
  }

  return codigos;
}

function extrairPeriodo(linha) {
  const texto =
    limparTexto(linha);

  /*
   * 09.1994 até 12.2004
   */
  const periodo =
    texto.match(
      /(\d{2}\.\d{4})\s+(?:até|a|-)\s+(\d{2}\.\d{4}|0)/i
    );

  if (periodo) {
    return {
      anoInicio:
        extrairAno(
          periodo[1]
        ),

      anoFim:
        periodo[2] === "0"
          ? null
          : extrairAno(
              periodo[2]
            ),
    };
  }

  /*
   * Aplicação aberta:
   * 05.2006 até
   */
  const inicioAberto =
    texto.match(
      /\b(\d{2}\.\d{4})\s+até\b/i
    );

  if (inicioAberto) {
    return {
      anoInicio:
        extrairAno(
          inicioAberto[1]
        ),

      anoFim: null,
    };
  }

  /*
   * Apenas uma data.
   */
  const unica =
    texto.match(
      /\b(\d{2}\.\d{4})\b/
    );

  if (unica) {
    return {
      anoInicio:
        extrairAno(
          unica[1]
        ),

      anoFim: null,
    };
  }

  return {
    anoInicio: null,
    anoFim: null,
  };
}

function removerPeriodo(linha) {
  return limparTexto(linha)
    .replace(
      /\d{2}\.\d{4}\s+(?:até|a|-)\s+(?:\d{2}\.\d{4}|0)/gi,
      " "
    )
    .replace(
      /\d{2}\.\d{4}\s+até/gi,
      " "
    )
    .replace(
      /\b\d{2}\.\d{4}\b/g,
      " "
    );
}

function criarRegexCodigo(
  codigo = ""
) {
  const caracteres =
    String(codigo || "")
      .replace(/\s+/g, "")
      .split("");

  if (
    caracteres.length === 0
  ) {
    return null;
  }

  return new RegExp(
    caracteres
      .map((caractere) =>
        caractere.replace(
          /[-/\\^$*+?.()|[\]{}]/g,
          "\\$&"
        )
      )
      .join("\\s*"),
    "gi"
  );
}

function removerCodigos(linha) {
  let texto =
    limparTexto(linha);

  const codigos =
    extrairCodigosBosch(
      texto
    );

  for (
    const codigo
    of codigos
  ) {
    const regex =
      criarRegexCodigo(
        codigo
      );

    if (regex) {
      texto =
        texto.replace(
          regex,
          " "
        );
    }
  }

  return limparTexto(
    texto
  );
}

function removerDadosEletricos(
  texto = ""
) {
  return limparTexto(texto)
    .replace(
      /\b(?:12V|14V|24V|28V)\b.*$/i,
      ""
    )
    .replace(
      /\b\d+(?:[,.]\d+)?\s*(?:KW|A)\b.*$/i,
      ""
    )
    .replace(
      /\b(?:K1|KCB1|NCB1|HD8L|HD9L|HD-1|N1|L8|L\s?8|KB|DW|JF|DM|IF|HX\d+(?:-[A-Z0-9]+)?|R\d+(?:-[A-Z0-9]+)?|S\d+(?:-[A-Z0-9]+)?|ARC-\d+)\b.*$/i,
      ""
    );
}

function extrairVeiculoMotor(
  linha
) {
  let texto =
    removerPeriodo(
      linha
    );

  texto =
    removerCodigos(
      texto
    );

  texto =
    removerDadosEletricos(
      texto
    );

  texto =
    limparTexto(
      texto
    );

  const partes =
    texto
      .split(" ")
      .filter(Boolean);

  if (
    partes.length === 0
  ) {
    return {
      modelo: "",
      motor: "",
    };
  }

  /*
   * Evita transformar códigos
   * remanescentes em motor.
   */
  const partesLimpas =
    partes.filter(
      (parte) =>
        !/^[0-9]{3,}$/.test(
          parte
        )
    );

  if (
    partesLimpas.length === 0
  ) {
    return {
      modelo: "",
      motor: "",
    };
  }

  if (
    partesLimpas.length === 1
  ) {
    return {
      modelo:
        partesLimpas[0],

      motor: "",
    };
  }

  /*
   * Procura motor no final.
   * Exemplos:
   * 2.0
   * 2.8
   * OM457
   * MWM
   * D229
   */
  const indiceMotor =
    partesLimpas.findIndex(
      (parte, indice) => {
        if (indice === 0) {
          return false;
        }

        return (
          /^\d\.\d$/i.test(
            parte
          ) ||
          /^(?:OM|MWM|D|M|TD|TDI|CDI)[A-Z0-9.-]+$/i.test(
            parte
          )
        );
      }
    );

  if (
    indiceMotor > 0
  ) {
    return {
      modelo:
        partesLimpas
          .slice(
            0,
            indiceMotor
          )
          .join(" "),

      motor:
        partesLimpas
          .slice(
            indiceMotor
          )
          .join(" "),
    };
  }

  return {
    modelo:
      partesLimpas
        .join(" "),

    motor: "",
  };
}

function identificarTipoAlternador(
  indiceCodigo
) {
  const tipos = [
    "Alternador Bosch",
    "Regulador Bosch",
    "Conjunto Retificador Bosch",
    "Estator Bosch",
    "Rotor Bosch",
    "Rolamento do Mancal Bosch",
    "Rolamento do Rotor Bosch",
    "Polia Bosch",
  ];

  return (
    tipos[
      indiceCodigo
    ] ||
    "Componente de Alternador Bosch"
  );
}

function identificarTipoMotorPartida(
  indiceCodigo,
  layoutMotorPartida
) {
  /*
   * Catálogo 2019/2020:
   *
   * Motor de partida
   * Impulsor
   * Chave magnética
   * Induzido
   * Bobina de campo
   * Porta-escovas
   * Engrenagem planetária
   */
  if (
    layoutMotorPartida ===
    "com_bobina_campo"
  ) {
    const tipos = [
      "Motor de Partida Bosch",
      "Impulsor do Motor de Partida Bosch",
      "Chave Magnética do Motor de Partida Bosch",
      "Induzido do Motor de Partida Bosch",
      "Bobina de Campo do Motor de Partida Bosch",
      "Porta-Escovas do Motor de Partida Bosch",
      "Engrenagem Planetária do Motor de Partida Bosch",
    ];

    return (
      tipos[
        indiceCodigo
      ] ||
      "Componente do Motor de Partida Bosch"
    );
  }

  /*
   * Catálogo Pesados 2020/2021:
   *
   * Motor de partida
   * Impulsor
   * Solenoide / Chave magnética
   * Induzido
   * Porta-escovas
   * Engrenagem planetária
   */
  const tipos = [
    "Motor de Partida Bosch",
    "Impulsor do Motor de Partida Bosch",
    "Solenoide / Chave Magnética Bosch",
    "Induzido do Motor de Partida Bosch",
    "Porta-Escovas do Motor de Partida Bosch",
    "Engrenagem Planetária do Motor de Partida Bosch",
  ];

  return (
    tipos[
      indiceCodigo
    ] ||
    "Componente do Motor de Partida Bosch"
  );
}

function identificarTipoPeca({
  linha,
  codigo,
  secaoAtual,
  layoutMotorPartida,
}) {
  const codigosLinha =
    extrairCodigosBosch(
      linha
    );

  const codigoNormalizado =
    normalizarCodigo(
      codigo
    );

  const indiceCodigo =
    codigosLinha.findIndex(
      (item) =>
        normalizarCodigo(
          item
        ) ===
        codigoNormalizado
    );

  if (
    indiceCodigo < 0
  ) {
    return "Componente Bosch";
  }

  if (
    secaoAtual ===
    "motor_partida"
  ) {
    return identificarTipoMotorPartida(
      indiceCodigo,
      layoutMotorPartida
    );
  }

  return identificarTipoAlternador(
    indiceCodigo
  );
}

function criarRegistro({
  codigo,
  montadora,
  modelo,
  motor,
  anoInicio,
  anoFim,
  nomeArquivo,
  linha,
  secaoAtual,
  layoutMotorPartida,
  configuracao,
}) {
  const tipoPeca =
    identificarTipoPeca({
      linha,
      codigo,
      secaoAtual,
      layoutMotorPartida,
    });

  return {
    peca:
      tipoPeca,

    codigo_oem:
      normalizarCodigo(
        codigo
      ),

    codigo_equivalente: "",

    fabricante:
      "Bosch",

    categoria:
      secaoAtual ===
      "motor_partida"
        ? "Sistema de Partida"
        : "Sistema Elétrico",

    origem_catalogo:
      configuracao
        ?.origemCatalogo ||
      nomeArquivo ||
      "Catálogo Bosch Alternadores e Motores de Partida",

    tipo_catalogo:
      configuracao
        ?.tipoCatalogo ||
      "alternadores",

    montadora:
      montadora || "",

    modelo:
      modelo || "",

    motor:
      motor || "",

    ano_inicio:
      anoInicio,

    ano_fim:
      anoFim,

    aplicacao:
      limparTexto(
        linha
      ),

    observacao:
      limparTexto(
        `Aplicação de ${tipoPeca}. Linha original: ${linha}`
      ),

    ativo: true,

    prioridade: 1,

    confiabilidade: 95,
  };
}

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
      registro.peca,
      registro.montadora,
      registro.modelo,
      registro.motor,
      registro.ano_inicio,
      registro.ano_fim,
    ]
      .map((valor) =>
        normalizarTexto(
          valor
        )
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

export async function parserBoschAlternadores({
  textoAplicacoes,
  configuracao = {},
  nomeArquivo,
  onProgresso,
}) {
  onProgresso?.(
    "⚡ Lendo Alternadores e Motores de Partida Bosch..."
  );

  const texto =
    Array.isArray(
      textoAplicacoes
    )
      ? textoAplicacoes.join(
          "\n"
        )
      : String(
          textoAplicacoes ||
            ""
        );

  const linhas =
    texto
      .split(/\r?\n/)
      .map(limparTexto)
      .filter(Boolean);

  const registros = [];

  let montadoraAtual = "";

  let ultimaAplicacao =
    null;

  /*
   * Os catálogos começam
   * pela seção de Alternadores.
   */
  let secaoAtual =
    "alternador";

  /*
   * Há duas estruturas conhecidas
   * para a seção de Motor de Partida.
   */
  let layoutMotorPartida =
    "sem_bobina_campo";

  for (
    let indice = 0;
    indice <
    linhas.length;
    indice += 1
  ) {
    const linha =
      linhas[indice];

    /*
     * IMPORTANTE:
     * detectamos a seção ANTES
     * de ignorar o cabeçalho.
     */
    const secaoDetectada =
      detectarSecao(
        linha
      );

    if (
      secaoDetectada
    ) {
      secaoAtual =
        secaoDetectada;

      ultimaAplicacao =
        null;
    }

    const layoutDetectado =
      detectarLayoutMotorPartida(
        linha
      );

    if (
      layoutDetectado
    ) {
      layoutMotorPartida =
        layoutDetectado;
    }

    if (
      pareceCabecalho(
        linha
      )
    ) {
      continue;
    }

    const montadora =
      identificarMontadora(
        linha
      );

    /*
     * Linha contendo somente
     * o nome da montadora.
     */
    if (
      montadora &&
      normalizarTexto(
        linha
      ) ===
        normalizarTexto(
          montadora
        )
    ) {
      montadoraAtual =
        montadora;

      ultimaAplicacao =
        null;

      continue;
    }

    const codigos =
      extrairCodigosBosch(
        linha
      );

    if (
      codigos.length === 0
    ) {
      continue;
    }

    const periodo =
      extrairPeriodo(
        linha
      );

    let aplicacao =
      extrairVeiculoMotor(
        linha
      );

    /*
     * Linhas seguintes de uma
     * mesma aplicação podem trazer
     * somente outro código Bosch.
     */
    if (
      !aplicacao.modelo &&
      ultimaAplicacao
    ) {
      aplicacao = {
        ...ultimaAplicacao,
      };
    }

    if (
      aplicacao.modelo
    ) {
      ultimaAplicacao = {
        ...aplicacao,
      };
    }

    for (
      const codigo
      of codigos
    ) {
      registros.push(
        criarRegistro({
          codigo,

          montadora:
            montadoraAtual,

          modelo:
            aplicacao.modelo,

          motor:
            aplicacao.motor,

          anoInicio:
            periodo.anoInicio,

          anoFim:
            periodo.anoFim,

          nomeArquivo,

          linha,

          secaoAtual,

          layoutMotorPartida,

          configuracao,
        })
      );
    }
  }

  const registrosUnicos =
    removerDuplicados(
      registros
    );

  const totalAlternadores =
    registrosUnicos.filter(
      (registro) =>
        registro.peca ===
        "Alternador Bosch"
    ).length;

  const totalMotoresPartida =
    registrosUnicos.filter(
      (registro) =>
        registro.peca ===
        "Motor de Partida Bosch"
    ).length;

  console.log(
    "BOSCH ELÉTRICO TOTAL:",
    registrosUnicos.length
  );

  console.log(
    "BOSCH ALTERNADORES:",
    totalAlternadores
  );

  console.log(
    "BOSCH MOTORES DE PARTIDA:",
    totalMotoresPartida
  );

  const testeMotorPartida =
    registrosUnicos.find(
      (registro) =>
        registro.codigo_oem ===
        "0001411025"
    );

  console.log(
    "TESTE MOTOR PARTIDA 0001411025:",
    testeMotorPartida ||
      "NÃO ENCONTRADO"
  );

  onProgresso?.(
    `✅ Bosch Elétrico: ${registrosUnicos.length} registro(s) — ${totalAlternadores} alternador(es) e ${totalMotoresPartida} motor(es) de partida.`
  );

  return registrosUnicos;
}