import enriquecerRegistro from "../../inteligencia/enriquecerRegistro";

function limparTexto(valor = "") {
  return String(valor || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizar(valor = "") {
  return limparTexto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function normalizarCodigo(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

/* =========================================================
   MONTADORAS
========================================================= */

const MONTADORAS = [
  "ALFA ROMEO",
  "ASIA MOTORS",
  "ASTON MARTIN",
  "AUDI",
  "BMW",
  "BYD",
  "CAOA CHERY",
  "CHERY",
  "CHEVROLET",
  "CHRYSLER",
  "CITROEN",
  "CITROËN",
  "DACIA",
  "DAEWOO",
  "DAF",
  "DAIHATSU",
  "DODGE",
  "EFFA",
  "FERRARI",
  "FIAT",
  "FORD",
  "HONDA",
  "HYUNDAI",
  "IVECO",
  "JAC",
  "JEEP",
  "KIA",
  "LAND ROVER",
  "LEXUS",
  "MAZDA",
  "MERCEDES-BENZ",
  "MERCEDES BENZ",
  "MINI",
  "MITSUBISHI",
  "NISSAN",
  "PEUGEOT",
  "PORSCHE",
  "PUMA",
  "RAM",
  "RENAULT",
  "SEAT",
  "SMART",
  "SUBARU",
  "SUZUKI",
  "TOYOTA",
  "TROLLER",
  "VOLKSWAGEN",
  "VOLVO",
];

function identificarMontadora(linha = "") {
  const texto = normalizar(linha);

  return (
    MONTADORAS.find(
      (montadora) =>
        normalizar(montadora) === texto
    ) || ""
  );
}

function montadoraEhValida(
  valor = ""
) {
  return Boolean(
    identificarMontadora(valor)
  );
}

/* =========================================================
   CABEÇALHOS
========================================================= */

function ehCabecalho(linha = "") {
  const texto = normalizar(linha);

  if (!texto) {
    return true;
  }

  const termos = [
    "AUTOPECAS BOSCH",
    "AUTOPEÇAS BOSCH",
    "VEICULO DATA DE",
    "VEÍCULO DATA DE",
    "APLICACAO ADAPTADOR",
    "APLICAÇÃO ADAPTADOR",
    "MULTICLIP PLUS",
    "MOTORISTA PASSAGEIRO",
    "PALHETA BOSCH",
    "CODIGO",
    "CÓDIGO",
    "NUMERO",
    "NÚMERO",
    "MEDIDA",
    "BRACO / ADAPTADOR",
    "BRAÇO / ADAPTADOR",
  ];

  if (
    termos.some((termo) =>
      texto.startsWith(
        normalizar(termo)
      )
    )
  ) {
    return true;
  }

  if (
    /^B\d+\s*\|/.test(texto)
  ) {
    return true;
  }

  return false;
}

/* =========================================================
   PERÍODO
========================================================= */

function extrairPeriodo(linha = "") {
  const resultado =
    String(linha).match(
      /\b((?:19|20)\d{2})\s*(?:→|->|–|-)\s*((?:19|20)\d{2})?/i
    );

  if (!resultado) {
    return null;
  }

  return {
    anoInicio:
      Number(resultado[1]),

    anoFim:
      resultado[2]
        ? Number(resultado[2])
        : null,

    indice:
      resultado.index || 0,

    fimIndice:
      (resultado.index || 0) +
      resultado[0].length,
  };
}

/* =========================================================
   ADAPTADOR
========================================================= */

function extrairAdaptador(
  texto = ""
) {
  const valor =
    limparTexto(texto);

  const resultado =
    valor.match(
      /^(?:G|ADD|1|2A|2B|3|4|5|6|7|8|9|10|13)\b/i
    );

  if (!resultado) {
    return {
      adaptador: "",
      restante: valor,
    };
  }

  return {
    adaptador:
      resultado[0]
        .toUpperCase(),

    restante:
      limparTexto(
        valor.slice(
          resultado[0].length
        )
      ),
  };
}

/* =========================================================
   CÓDIGOS
========================================================= */

function extrairCodigos(
  texto = ""
) {
  const padrao =
    /\b(?:AF\s?\d{2}\s?M|AP\s?\d{2}\s?M|AF\s?\d{3}|AF\s?\d{2}|SD\s?\d{1,2}|S\s?\d{2}|B\s?\d{3}|A\s?\d{3}\s?[SH]|H\s?\d{3}|AR\s?\d{2}\s?N|N\s?\d{2,3}|\d{2}\s?E)\b/gi;

  const encontrados =
    String(texto || "")
      .match(padrao) || [];

  return encontrados.map(
    normalizarCodigo
  );
}

/* =========================================================
   FAMÍLIAS
========================================================= */

function ehMulticlip(codigo) {
  return /^AF\d{2}M$/.test(
    codigo
  );
}

function ehAerofitUnitario(
  codigo
) {
  return /^AF\d{2}$/.test(
    codigo
  );
}

function ehAerofitJogo(
  codigo
) {
  return /^AF\d{3}$/.test(
    codigo
  );
}

function ehAerotwinPlus(
  codigo
) {
  return /^AP\d{2}M$/.test(
    codigo
  );
}

function ehAerotwinJogo(
  codigo
) {
  return /^A\d{3}S$/.test(
    codigo
  );
}

function ehEcoUnitario(
  codigo
) {
  return /^S\d{2}$/.test(
    codigo
  );
}

function ehEcoJogo(codigo) {
  return (
    /^B\d{3}$/.test(codigo) ||
    /^SD\d{1,2}$/.test(codigo)
  );
}

function ehTraseiraForte(
  codigo
) {
  return (
    /^\d{2}E$/.test(codigo) ||
    /^H\d{3}$/.test(codigo) ||
    /^A\d{3}H$/.test(codigo)
  );
}

/* =========================================================
   INTERPRETA COLUNAS
========================================================= */

function interpretarColunas(
  codigos = []
) {
  const resultado = {
    multiclip_motorista: "",
    multiclip_passageiro: "",

    aerofit_motorista: "",
    aerofit_passageiro: "",
    aerofit_jogo: "",

    aerotwin_motorista: "",
    aerotwin_passageiro: "",
    aerotwin_oe_jogo: "",

    eco_motorista: "",
    eco_passageiro: "",
    eco_jogo: "",

    traseira: "",
  };

  const multiclip =
    codigos.filter(
      ehMulticlip
    );

  resultado.multiclip_motorista =
    multiclip[0] || "";

  resultado.multiclip_passageiro =
    multiclip[1] || "";

  const aerofit =
    codigos.filter(
      ehAerofitUnitario
    );

  resultado.aerofit_motorista =
    aerofit[0] || "";

  resultado.aerofit_passageiro =
    aerofit[1] || "";

  resultado.aerofit_jogo =
    codigos.find(
      ehAerofitJogo
    ) || "";

  const aerotwin =
    codigos.filter(
      ehAerotwinPlus
    );

  resultado.aerotwin_motorista =
    aerotwin[0] || "";

  resultado.aerotwin_passageiro =
    aerotwin[1] || "";

  resultado.aerotwin_oe_jogo =
    codigos.find(
      ehAerotwinJogo
    ) || "";

  const eco =
    codigos.filter(
      ehEcoUnitario
    );

  if (eco.length >= 3) {
    resultado.eco_motorista =
      eco[0];

    resultado.eco_passageiro =
      eco[1];

    resultado.traseira =
      eco.at(-1);
  } else if (
    eco.length === 2
  ) {
    resultado.eco_motorista =
      eco[0];

    resultado.eco_passageiro =
      eco[1];
  } else if (
    eco.length === 1
  ) {
    resultado.eco_motorista =
      eco[0];
  }

  const jogosEco =
    codigos.filter(
      ehEcoJogo
    );

  if (jogosEco.length) {
    resultado.eco_jogo =
      jogosEco[0];
  }

  const traseiraForte =
    codigos.find(
      ehTraseiraForte
    );

  if (traseiraForte) {
    resultado.traseira =
      traseiraForte;
  }

  const apenasB =
    codigos.filter(
      (codigo) =>
        /^B\d{3}$/.test(
          codigo
        )
    );

  const possuiOutraFamilia =
    codigos.some(
      (codigo) =>
        ehMulticlip(codigo) ||
        ehAerofitUnitario(
          codigo
        ) ||
        ehAerofitJogo(
          codigo
        ) ||
        ehAerotwinPlus(
          codigo
        ) ||
        ehAerotwinJogo(
          codigo
        ) ||
        ehEcoUnitario(
          codigo
        )
    );

  if (
    !possuiOutraFamilia &&
    apenasB.length >= 2
  ) {
    resultado.eco_motorista =
      apenasB[0] || "";

    resultado.eco_passageiro =
      apenasB[1] || "";

    resultado.eco_jogo =
      apenasB[2] || "";
  }

  return resultado;
}

/* =========================================================
   OBSERVAÇÃO
========================================================= */

function montarObservacao({
  adaptador,
  colunas,
}) {
  const partes = [];

  if (adaptador) {
    partes.push(
      `Adaptador: ${adaptador}`
    );
  }

  if (
    colunas.multiclip_motorista
  ) {
    partes.push(
      `Aerofit Multiclip Motorista: ${colunas.multiclip_motorista}`
    );
  }

  if (
    colunas.multiclip_passageiro
  ) {
    partes.push(
      `Aerofit Multiclip Passageiro: ${colunas.multiclip_passageiro}`
    );
  }

  if (
    colunas.aerofit_motorista
  ) {
    partes.push(
      `Aerofit Motorista: ${colunas.aerofit_motorista}`
    );
  }

  if (
    colunas.aerofit_passageiro
  ) {
    partes.push(
      `Aerofit Passageiro: ${colunas.aerofit_passageiro}`
    );
  }

  if (
    colunas.aerofit_jogo
  ) {
    partes.push(
      `Aerofit Jogo: ${colunas.aerofit_jogo}`
    );
  }

  if (
    colunas.aerotwin_motorista
  ) {
    partes.push(
      `Aerotwin Plus Motorista: ${colunas.aerotwin_motorista}`
    );
  }

  if (
    colunas.aerotwin_passageiro
  ) {
    partes.push(
      `Aerotwin Plus Passageiro: ${colunas.aerotwin_passageiro}`
    );
  }

  if (
    colunas.aerotwin_oe_jogo
  ) {
    partes.push(
      `Aerotwin OE/Jogo: ${colunas.aerotwin_oe_jogo}`
    );
  }

  if (
    colunas.eco_motorista
  ) {
    partes.push(
      `Eco Motorista: ${colunas.eco_motorista}`
    );
  }

  if (
    colunas.eco_passageiro
  ) {
    partes.push(
      `Eco Passageiro: ${colunas.eco_passageiro}`
    );
  }

  if (
    colunas.eco_jogo
  ) {
    partes.push(
      `Eco Jogo: ${colunas.eco_jogo}`
    );
  }

  if (
    colunas.traseira
  ) {
    partes.push(
      `Traseira: ${colunas.traseira}`
    );
  }

  return partes.join(" | ");
}

/* =========================================================
   POSIÇÃO DO CÓDIGO
========================================================= */

function identificarPosicaoCodigo({
  codigo,
  colunas,
}) {
  const atual =
    normalizarCodigo(
      codigo
    );

  const mapa = [
    [
      "Aerofit Multiclip - Motorista",
      colunas.multiclip_motorista,
    ],

    [
      "Aerofit Multiclip - Passageiro",
      colunas.multiclip_passageiro,
    ],

    [
      "Aerofit - Motorista",
      colunas.aerofit_motorista,
    ],

    [
      "Aerofit - Passageiro",
      colunas.aerofit_passageiro,
    ],

    [
      "Aerofit - Jogo",
      colunas.aerofit_jogo,
    ],

    [
      "Aerotwin Plus - Motorista",
      colunas.aerotwin_motorista,
    ],

    [
      "Aerotwin Plus - Passageiro",
      colunas.aerotwin_passageiro,
    ],

    [
      "Aerotwin Plus - OE/Jogo",
      colunas.aerotwin_oe_jogo,
    ],

    [
      "Eco - Motorista",
      colunas.eco_motorista,
    ],

    [
      "Eco - Passageiro",
      colunas.eco_passageiro,
    ],

    [
      "Eco - Jogo",
      colunas.eco_jogo,
    ],

    [
      "Traseira",
      colunas.traseira,
    ],
  ];

  const encontrado =
    mapa.find(
      ([, valor]) =>
        valor &&
        normalizarCodigo(
          valor
        ) === atual
    );

  return encontrado
    ? encontrado[0]
    : "";
}

/* =========================================================
   REGISTRO
========================================================= */

function criarRegistro({
  codigo,
  montadora,
  modelo,
  anoInicio,
  anoFim,
  adaptador,
  colunas,
  linha,
  configuracao,
  nomeArquivo,
}) {
  const montadoraFinal =
    identificarMontadora(
      montadora
    );

  /*
   * SEGURANÇA:
   * nunca permite modelo virar montadora.
   */
  if (!montadoraFinal) {
    return null;
  }

  const modeloFinal =
    limparTexto(
      modelo
    );

  if (
    !modeloFinal ||
    montadoraEhValida(
      modeloFinal
    )
  ) {
    return null;
  }

  const posicao =
    identificarPosicaoCodigo({
      codigo,
      colunas,
    });

  return {
    peca:
      "Palheta do Limpador",

    fabricante:
      "Bosch",

    codigo_oem:
      normalizarCodigo(
        codigo
      ),

    codigo_equivalente: "",

    montadora:
      montadoraFinal,

    modelo:
      modeloFinal,

    motor: "",

    ano_inicio:
      anoInicio,

    ano_fim:
      anoFim,

    adaptador,

    posicao_palheta:
      posicao,

    multiclip_motorista:
      colunas.multiclip_motorista,

    multiclip_passageiro:
      colunas.multiclip_passageiro,

    aerofit_motorista:
      colunas.aerofit_motorista,

    aerofit_passageiro:
      colunas.aerofit_passageiro,

    aerofit_jogo:
      colunas.aerofit_jogo,

    aerotwin_motorista:
      colunas.aerotwin_motorista,

    aerotwin_passageiro:
      colunas.aerotwin_passageiro,

    aerotwin_oe_jogo:
      colunas.aerotwin_oe_jogo,

    eco_motorista:
      colunas.eco_motorista,

    eco_passageiro:
      colunas.eco_passageiro,

    eco_jogo:
      colunas.eco_jogo,

    traseira:
      colunas.traseira,

    aplicacao:
      limparTexto(
        [
          montadoraFinal,
          modeloFinal,
          anoInicio
            ? anoFim
              ? `${anoInicio} até ${anoFim}`
              : `${anoInicio} até Atual`
            : "",
        ]
          .filter(Boolean)
          .join(" ")
      ),

    observacao:
      montarObservacao({
        adaptador,
        colunas,
      }),

    linha_catalogo:
      limparTexto(
        linha
      ),

    origem_catalogo:
      configuracao
        ?.origemCatalogo ||
      nomeArquivo ||
      "Catálogo Bosch Palhetas 2024",

    tipo_catalogo:
      "palhetas",

    ativo: true,

    prioridade: 1,

    confiabilidade: 100,
  };
}

/* =========================================================
   DUPLICADOS
========================================================= */

function removerDuplicados(
  registros = []
) {
  const mapa =
    new Map();

  for (
    const registro
    of registros
  ) {
    if (!registro) {
      continue;
    }

    const chave = [
      registro.codigo_oem,
      registro.montadora,
      registro.modelo,
      registro.ano_inicio,
      registro.ano_fim,
      registro.posicao_palheta,
    ]
      .map(normalizar)
      .join("|");

    if (!mapa.has(chave)) {
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

/* =========================================================
   ENRIQUECIMENTO SEGURO
========================================================= */

function enriquecerSemAlterarAplicacao(
  registro
) {
  const enriquecido =
    enriquecerRegistro(
      registro
    ) || {};

  /*
   * O Motor de Inteligência pode complementar
   * categoria, família etc., mas NÃO pode
   * substituir dados vindos diretamente
   * da tabela Bosch.
   */

  return {
    ...enriquecido,

    peca:
      registro.peca,

    fabricante:
      registro.fabricante,

    codigo_oem:
      registro.codigo_oem,

    montadora:
      registro.montadora,

    modelo:
      registro.modelo,

    motor:
      registro.motor,

    ano_inicio:
      registro.ano_inicio,

    ano_fim:
      registro.ano_fim,

    adaptador:
      registro.adaptador,

    posicao_palheta:
      registro.posicao_palheta,

    multiclip_motorista:
      registro.multiclip_motorista,

    multiclip_passageiro:
      registro.multiclip_passageiro,

    aerofit_motorista:
      registro.aerofit_motorista,

    aerofit_passageiro:
      registro.aerofit_passageiro,

    aerofit_jogo:
      registro.aerofit_jogo,

    aerotwin_motorista:
      registro.aerotwin_motorista,

    aerotwin_passageiro:
      registro.aerotwin_passageiro,

    aerotwin_oe_jogo:
      registro.aerotwin_oe_jogo,

    eco_motorista:
      registro.eco_motorista,

    eco_passageiro:
      registro.eco_passageiro,

    eco_jogo:
      registro.eco_jogo,

    traseira:
      registro.traseira,

    aplicacao:
      registro.aplicacao,

    observacao:
      registro.observacao,

    linha_catalogo:
      registro.linha_catalogo,

    origem_catalogo:
      registro.origem_catalogo,

    tipo_catalogo:
      registro.tipo_catalogo,

    ativo:
      registro.ativo,

    prioridade:
      registro.prioridade,

    confiabilidade:
      registro.confiabilidade,
  };
}

/* =========================================================
   PARSER PRINCIPAL
========================================================= */

export async function parserBoschPalhetas({
  textoAplicacoes = "",
  configuracao = {},
  nomeArquivo = "",
  onProgresso,
}) {
  onProgresso?.(
    "🧹 Interpretando tabela Bosch Palhetas 2024..."
  );

  const linhas =
    String(
      textoAplicacoes || ""
    )
      .split(/\r?\n/)
      .map(limparTexto)
      .filter(Boolean);

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

    if (
      ehCabecalho(
        linha
      )
    ) {
      continue;
    }

    /* =====================================================
       MONTADORA
    ===================================================== */

    const montadoraDetectada =
      identificarMontadora(
        linha
      );

    if (
      montadoraDetectada
    ) {
      montadoraAtual =
        montadoraDetectada;

      modeloAtual = "";

      continue;
    }

    /* =====================================================
       PERÍODO
    ===================================================== */

    const periodo =
      extrairPeriodo(
        linha
      );

    /*
     * Linha sem período pode ser
     * nome do modelo para as linhas
     * seguintes.
     */

    if (!periodo) {
      const codigosLinha =
        extrairCodigos(
          linha
        );

      const podeSerModelo =
        codigosLinha.length === 0 &&
        linha.length <= 120 &&
        !identificarMontadora(
          linha
        ) &&
        !ehCabecalho(
          linha
        );

      if (podeSerModelo) {
        modeloAtual =
          limparTexto(
            linha
          );
      }

      continue;
    }

    /* =====================================================
       MODELO
    ===================================================== */

    const antesDoPeriodo =
      limparTexto(
        linha.slice(
          0,
          periodo.indice
        )
      );

    let modelo =
      antesDoPeriodo ||
      modeloAtual;

    if (
      antesDoPeriodo &&
      !montadoraEhValida(
        antesDoPeriodo
      )
    ) {
      modeloAtual =
        antesDoPeriodo;
    }

    /*
     * SEGURANÇA:
     * só cria registro se a montadora
     * estiver realmente na lista oficial.
     */

    if (
      !montadoraEhValida(
        montadoraAtual
      ) ||
      !modelo ||
      montadoraEhValida(
        modelo
      )
    ) {
      continue;
    }

    /* =====================================================
       DEPOIS DA DATA
    ===================================================== */

    const depoisPeriodo =
      limparTexto(
        linha.slice(
          periodo.fimIndice
        )
      );

    const {
      adaptador,
      restante,
    } =
      extrairAdaptador(
        depoisPeriodo
      );

    const codigos =
      extrairCodigos(
        restante
      );

    if (
      codigos.length === 0
    ) {
      continue;
    }

    const colunas =
      interpretarColunas(
        codigos
      );

    for (
      const codigo
      of codigos
    ) {
      const registro =
        criarRegistro({
          codigo,

          montadora:
            montadoraAtual,

          modelo,

          anoInicio:
            periodo.anoInicio,

          anoFim:
            periodo.anoFim,

          adaptador,

          colunas,

          linha,

          configuracao,

          nomeArquivo,
        });

      if (registro) {
        registros.push(
          registro
        );
      }
    }
  }

  const registrosUnicos =
    removerDuplicados(
      registros
    );

  console.log(
    "BOSCH PALHETAS ENCONTRADOS:",
    registros.length
  );

  console.log(
    "BOSCH PALHETAS ÚNICOS:",
    registrosUnicos.length
  );

  /* =====================================================
     TESTE PORSCHE
  ===================================================== */

  const testePorsche =
    registrosUnicos.filter(
      (registro) =>
        normalizar(
          registro.montadora
        ) === "PORSCHE"
    );

  console.log(
    "TESTE PORSCHE:",
    testePorsche.filter(
      (registro) =>
        [
          "CAYENNE",
          "CAYMAN",
          "MACAN",
        ].some(
          (modelo) =>
            normalizar(
              registro.modelo
            ).includes(
              modelo
            )
        )
    )
  );

  /* =====================================================
     TESTE FIAT MOBI
  ===================================================== */

  const testeMobi =
    registrosUnicos.filter(
      (registro) =>
        normalizar(
          registro.montadora
        ) === "FIAT" &&
        normalizar(
          registro.modelo
        ).includes(
          "MOBI"
        )
    );

  console.log(
    "TESTE FIAT MOBI:",
    testeMobi
  );

  onProgresso?.(
    `✅ Bosch Palhetas: ${registrosUnicos.length} registro(s) encontrado(s).`
  );

  return registrosUnicos.map(
    enriquecerSemAlterarAplicacao
  );
}

export default parserBoschPalhetas;