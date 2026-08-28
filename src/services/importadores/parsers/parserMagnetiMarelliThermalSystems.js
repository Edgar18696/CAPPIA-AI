/*
 * ============================================================
 * APPIA AI
 * Parser Magneti Marelli — Thermal Systems 2022–2023
 * ============================================================
 *
 * V2 — Aplicações limpas
 *
 * Famílias:
 * - Condensadores
 * - Radiadores de motor
 * - Intercoolers
 * - Radiadores de aquecimento
 * - Eletroventiladores do radiador
 * - Ventiladores do habitáculo
 *
 * IMPORTANTE:
 * Nesta fase lemos SOMENTE textoAplicacoes.
 *
 * textoReferencias / textoEquivalencias ficam fora para evitar
 * mistura de códigos OE / IAM com as aplicações por veículo.
 * ============================================================
 */

function limpar(valor = "") {
  return String(valor || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*•\s*/g, " • ")
    .trim();
}

function normalizar(valor = "") {
  return limpar(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function removerAcentos(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/*
 * ============================================================
 * MONTADORAS
 * ============================================================
 */

const MONTADORAS = new Set([
  "ABARTH",
  "ALFA ROMEO",
  "AUDI",
  "AUTOBIANCHI",
  "BMW",
  "CADILLAC",
  "CHEVROLET",
  "CITROEN",
  "DACIA",
  "DAEWOO",
  "DS",
  "FIAT",
  "FORD",
  "HONDA",
  "HYUNDAI",
  "INFINITI",
  "INNOCENTI",
  "IVECO",
  "JEEP",
  "KIA",
  "LADA",
  "LANCIA",
  "LAND ROVER",
  "LEXUS",
  "MARUTI SUZUKI",
  "MAZDA",
  "MERCEDES-BENZ",
  "MERCEDES BENZ",
  "MINI",
  "MITSUBISHI",
  "NISSAN",
  "OPEL",
  "PEUGEOT",
  "PORSCHE",
  "PROTON",
  "RENAULT",
  "RENAULT TRUCKS",
  "ROLLS-ROYCE",
  "ROLLS ROYCE",
  "SAAB",
  "SEAT",
  "SKODA",
  "SMART",
  "SUBARU",
  "SUZUKI",
  "TOYOTA",
  "VAUXHALL",
  "VOLKSWAGEN",
  "VOLVO",
]);

function ehMontadora(linha = "") {
  return MONTADORAS.has(
    normalizar(linha)
  );
}

/*
 * ============================================================
 * FAMÍLIAS
 * ============================================================
 */

function detectarFamilia(texto = "") {
  const t = normalizar(texto);

  if (
    t === "CONDENSATORI" ||
    t === "CONDENSERS" ||
    t.includes("CONDENSATORI - CONDENSERS")
  ) {
    return "Condensador de Ar Condicionado";
  }

  if (
    t === "RADIATORI MOTORE" ||
    t === "ENGINE RADIATORS" ||
    t.includes("RADIATORI MOTORE - ENGINE RADIATORS")
  ) {
    return "Radiador de Motor";
  }

  if (
    t === "INTERCOOLER" ||
    t === "AIR COOLER" ||
    t.includes("INTERCOOLER - AIR COOLER")
  ) {
    return "Intercooler";
  }

  if (
    t === "RADIATORI RISCALDAMENTO" ||
    t === "HEATER RADIATORS" ||
    t.includes(
      "RADIATORI RISCALDAMENTO - HEATER RADIATORS"
    )
  ) {
    return "Radiador de Aquecimento";
  }

  if (
    t ===
      "ELETTROVENTOLE RAFFREDDAMENTO RADIATORE" ||
    t ===
      "RADIATOR COOLING FAN" ||
    t.includes(
      "ELETTROVENTOLE RAFFREDDAMENTO RADIATORE - RADIATOR COOLING FAN"
    )
  ) {
    return "Eletroventilador do Radiador";
  }

  if (
    t ===
      "ELETTROVENTOLE ABITACOLO" ||
    t ===
      "CABIN FAN" ||
    t.includes(
      "ELETTROVENTOLE ABITACOLO - CABIN FAN"
    )
  ) {
    return "Ventilador do Habitáculo";
  }

  return null;
}

/*
 * ============================================================
 * CÓDIGOS THERMAL SYSTEMS
 * ============================================================
 *
 * Exemplos encontrados:
 *
 * BC735
 * BM1577
 * BR458
 * MTE356AX
 * MTC727AX
 *
 * Código numérico Marelli:
 *
 * 350203735000
 * 350213157700
 * 350218458000
 * 069412356010
 * 069422727010
 * ============================================================
 */

function extrairCodigoLongo(texto = "") {
  const match = limpar(texto).match(
    /\b(?:0\d{11}|\d{12})\b/
  );

  return match
    ? match[0]
    : null;
}

function extrairCodigoProduto(
  texto = ""
) {
  const t = limpar(texto);

  /*
   * Famílias mais específicas primeiro.
   */

  const patterns = [
    /\bMTE\d{2,4}[A-Z]{0,3}\b/i,
    /\bMTC\d{2,4}[A-Z]{0,3}\b/i,
    /\bBC\d{2,5}[A-Z]{0,2}\b/i,
    /\bBM\d{2,5}[A-Z]{0,2}\b/i,
    /\bBR\d{2,5}[A-Z]{0,2}\b/i,
  ];

  for (const pattern of patterns) {
    const match = t.match(pattern);

    if (match) {
      return match[0].toUpperCase();
    }
  }

  /*
   * Fallback para outras famílias do mesmo catálogo.
   */

  const fallback = t.match(
    /\b[A-Z]{2,4}\d{3,5}(?:AX|A|B|M)?\b/i
  );

  return fallback
    ? fallback[0].toUpperCase()
    : null;
}

function possuiProduto(linha = "") {
  return Boolean(
    extrairCodigoLongo(linha) &&
    extrairCodigoProduto(linha)
  );
}

/*
 * ============================================================
 * PERÍODO
 * ============================================================
 */

function extrairPeriodo(texto = "") {
  const match = limpar(texto).match(
    /\b\d{2}\/\d{2}\s*(?:à|->|>|–|-)\s*(?:\d{2}\/\d{2})?\b/
  );

  if (match) {
    return limpar(match[0]);
  }

  /*
   * Alguns textos extraídos vêm colados:
   * 04/15à
   */

  const aberto = limpar(texto).match(
    /\b\d{2}\/\d{2}\s*à/
  );

  return aberto
    ? limpar(aberto[0])
    : null;
}

function anoCompleto(ano2) {
  const numero = Number(ano2);

  if (!Number.isFinite(numero)) {
    return null;
  }

  return numero <= 40
    ? 2000 + numero
    : 1900 + numero;
}

function extrairAnos(periodo = "") {
  const anos =
    String(periodo).match(
      /\d{2}\/(\d{2})/g
    ) || [];

  if (anos.length === 0) {
    return {
      ano_inicio: null,
      ano_fim: null,
    };
  }

  const inicioPartes =
    anos[0].split("/");

  const anoInicio =
    anoCompleto(
      inicioPartes[1]
    );

  let anoFim = null;

  if (anos.length > 1) {
    const fimPartes =
      anos[1].split("/");

    anoFim =
      anoCompleto(
        fimPartes[1]
      );
  }

  return {
    ano_inicio:
      anoInicio,

    ano_fim:
      anoFim,
  };
}

/*
 * ============================================================
 * LINHAS TÉCNICAS / CABEÇALHOS
 * ============================================================
 */

function ehCabecalho(linha = "") {
  const t = normalizar(linha);

  if (!t) {
    return true;
  }

  if (
    /^\d{1,3}$/.test(t)
  ) {
    return true;
  }

  return (
    t === "MATL" ||
    t === "OE" ||
    t === "IAM" ||
    t === "A/P" ||
    t === "APPLICATION GUIDE" ||
    t.includes(
      "APPLICAZIONE PER MARCA"
    ) ||
    t.includes(
      "VEHICLE APPLICATION GUIDE"
    ) ||
    t.includes(
      "APLICACAO POR MARCA"
    ) ||
    t.includes(
      "APLICACIÓN POR MARCA"
    ) ||
    t.includes(
      "MAGNETI MARELLI PARTS"
    ) ||
    t.includes(
      "MANUFACTURERS INDEX"
    ) ||
    t.includes(
      "INDICE COSTRUTTORI"
    ) ||
    t.includes(
      "APPLICAZIONE PER CODICE"
    ) ||
    t.includes(
      "BUYERS GUIDE"
    ) ||
    t.includes(
      "CROSS REFERENCE"
    )
  );
}

/*
 * ============================================================
 * MODELO
 * ============================================================
 */

function pareceModelo(
  linha = ""
) {
  const texto = limpar(linha);
  const t = normalizar(texto);

  if (!texto) {
    return false;
  }

  if (
    ehMontadora(texto) ||
    ehCabecalho(texto) ||
    detectarFamilia(texto) ||
    possuiProduto(texto)
  ) {
    return false;
  }

  /*
   * Linhas que claramente são aplicação/motor.
   */

  if (
    /^ALL MODELS\b/i.test(texto) ||
    /^\d[\d.]*\s/i.test(texto) ||
    /^[BD]\s?\d{3,4}/i.test(texto) ||
    /^D\d\b/i.test(texto) ||
    /^T\d\b/i.test(texto) ||
    /^FOR VEHICLES/i.test(texto) ||
    /^CHASSIS NR/i.test(texto) ||
    /^ENGINE NR/i.test(texto)
  ) {
    return false;
  }

  /*
   * Código de motores costuma trazer muitas vírgulas.
   */

  if (
    (texto.match(/,/g) || [])
      .length >= 2
  ) {
    return false;
  }

  /*
   * Modelos são linhas relativamente curtas e não
   * possuem período.
   */

  if (
    extrairPeriodo(texto)
  ) {
    return false;
  }

  if (
    texto.length > 110
  ) {
    return false;
  }

  /*
   * Precisa conter alguma letra.
   */

  return /[A-Z]/i.test(texto);
}

/*
 * ============================================================
 * LIMPEZA DA APLICAÇÃO
 * ============================================================
 */

function removerDadosProduto({
  texto,
  codigoLongo,
  codigoProduto,
  periodo,
}) {
  let resultado =
    limpar(texto);

  if (codigoLongo) {
    resultado =
      resultado.replace(
        codigoLongo,
        " "
      );
  }

  if (codigoProduto) {
    resultado =
      resultado.replace(
        new RegExp(
          `\\b${codigoProduto}\\b`,
          "i"
        ),
        " "
      );
  }

  if (periodo) {
    resultado =
      resultado.replace(
        periodo,
        " "
      );
  }

  /*
   * Remove colunas técnicas finais comuns.
   */

  resultado = resultado
    .replace(
      /\s+\bMATL\b.*$/i,
      ""
    )
    .replace(
      /\s+\bMT\b\s*[+\-/–]*\s*$/i,
      ""
    )
    .replace(
      /\s+\b(?:A\/P|A|B|M)\b(?:\s+[•])?\s*$/i,
      ""
    )
    .replace(/[•]+/g, " ");

  return limpar(resultado);
}

/*
 * ============================================================
 * QUEBRAR LINHAS COM VÁRIOS REGISTROS
 * ============================================================
 *
 * O PDF às vezes extrai:
 *
 * ... BC737 A • GOLF VI ...
 *
 * O marcador • separa registros.
 * ============================================================
 */

function prepararLinhas(texto = "") {
  return String(texto || "")
    .replace(/\r/g, "")
    .replace(
      /\s*[•]\s*/g,
      "\n"
    )
    .split("\n")
    .map(limpar)
    .filter(Boolean);
}

/*
 * ============================================================
 * PARSER PRINCIPAL
 * ============================================================
 */

export function parserMagnetiMarelliThermalSystems({
  textoAplicacoes = "",
} = {}) {
  /*
   * ========================================================
   * IMPORTANTE
   * ========================================================
   *
   * NÃO misturar textoReferencias ou textoEquivalencias aqui.
   *
   * Primeiro validamos aplicações limpas.
   * ========================================================
   */

  if (!textoAplicacoes) {
    console.log(
      "🌡️ THERMAL: textoAplicacoes vazio."
    );

    return [];
  }

  const linhas =
    prepararLinhas(
      textoAplicacoes
    );

  const registros = [];

  let familiaAtual =
    "Sistema Térmico";

  let montadoraAtual =
    null;

  let modeloAtual =
    null;

  /*
   * Buffer usado nas aplicações quebradas em várias linhas.
   *
   * Exemplo:
   *
   * 1.5 T2 - 2.0 D2...
   * B 4154 T5, D 4204...
   * 09/10à05/18 350203...
   */

  let bufferAplicacao = [];

  function limparBuffer() {
    bufferAplicacao = [];
  }

  function processarAplicacao(
    linhaFinal
  ) {
    if (
      !montadoraAtual ||
      !modeloAtual
    ) {
      limparBuffer();
      return;
    }

    const textoCompleto =
      limpar(
        [
          ...bufferAplicacao,
          linhaFinal,
        ]
          .filter(Boolean)
          .join(" ")
      );

    limparBuffer();

    const codigoLongo =
      extrairCodigoLongo(
        textoCompleto
      );

    const codigoProduto =
      extrairCodigoProduto(
        textoCompleto
      );

    if (
      !codigoLongo ||
      !codigoProduto
    ) {
      return;
    }

    const periodo =
      extrairPeriodo(
        textoCompleto
      );

    const {
      ano_inicio,
      ano_fim,
    } = extrairAnos(
      periodo
    );

    let aplicacao =
      removerDadosProduto({
        texto:
          textoCompleto,

        codigoLongo,

        codigoProduto,

        periodo,
      });

    /*
     * ALL MODELS não é motor.
     */

    let motor = aplicacao;

    if (
      /^ALL MODELS\b/i.test(
        motor
      )
    ) {
      motor =
        motor.replace(
          /^ALL MODELS\b/i,
          ""
        );

      motor =
        limpar(motor) ||
        null;
    }

    /*
     * Não deixa repetir modelo inteiro dentro do motor.
     */

    if (
      motor &&
      normalizar(motor) ===
        normalizar(modeloAtual)
    ) {
      motor = null;
    }

    const observacao = [
      `Código Magneti Marelli: ${codigoProduto}`,
      `Código longo: ${codigoLongo}`,
      familiaAtual,
      montadoraAtual,
      modeloAtual,
      motor,
      periodo,
    ]
      .filter(Boolean)
      .join(" | ");

    registros.push({
      /*
       * PEÇA
       */

      peca:
        familiaAtual,

      descricao:
        familiaAtual,

      /*
       * CÓDIGO PRINCIPAL
       *
       * Usamos BC/BM/BR/MTE/MTC como código principal,
       * pois é a referência comercial encontrada pelo usuário.
       */

      codigo:
        codigoProduto,

      codigo_oem:
        codigoProduto,

      codigo_magneti:
        codigoProduto,

      /*
       * Código numérico Marelli como equivalente.
       */

      codigo_equivalente:
        codigoLongo,

      equivalentes: [
        codigoLongo,
      ],

      /*
       * APLICAÇÃO
       */

      fabricante:
        "Magneti Marelli",

      montadora:
        montadoraAtual,

      modelo:
        modeloAtual,

      motor,

      aplicacao:
        [
          montadoraAtual,
          modeloAtual,
          motor,
          periodo,
        ]
          .filter(Boolean)
          .join(" "),

      anos:
        periodo,

      ano_inicio,

      ano_fim,

      observacao,

      /*
       * ORIGEM
       */

      origem_catalogo:
        "Catálogo Magneti Marelli Thermal Systems 2022-2023",

      origem:
        "Catálogo Magneti Marelli Thermal Systems 2022-2023",

      tipo_catalogo:
        "sistemas_termicos",

      ativo: true,

      prioridade: 1,

      confiabilidade: 95,
    });
  }

  for (
    let i = 0;
    i < linhas.length;
    i += 1
  ) {
    const linha =
      linhas[i];

    if (
      !linha ||
      ehCabecalho(linha)
    ) {
      continue;
    }

    /*
     * ======================================================
     * FAMÍLIA
     * ======================================================
     */

    const familiaDetectada =
      detectarFamilia(
        linha
      );

    if (familiaDetectada) {
      familiaAtual =
        familiaDetectada;

      modeloAtual = null;

      limparBuffer();

      continue;
    }

    /*
     * ======================================================
     * MONTADORA
     * ======================================================
     */

    if (ehMontadora(linha)) {
      montadoraAtual =
        removerAcentos(
          limpar(linha)
        )
          .replace(
            /^CITROEN$/i,
            "CITROEN"
          );

      modeloAtual = null;

      limparBuffer();

      continue;
    }

    /*
     * ======================================================
     * REGISTRO COMPLETO
     * ======================================================
     */

    if (possuiProduto(linha)) {
      processarAplicacao(
        linha
      );

      continue;
    }

    /*
     * ======================================================
     * MODELO
     * ======================================================
     */

    if (
      montadoraAtual &&
      pareceModelo(linha)
    ) {
      modeloAtual =
        limpar(linha);

      limparBuffer();

      continue;
    }

    /*
     * ======================================================
     * CONTINUAÇÃO DE APLICAÇÃO
     * ======================================================
     */

    if (
      montadoraAtual &&
      modeloAtual
    ) {
      bufferAplicacao.push(
        linha
      );

      /*
       * Evita buffer infinito em texto quebrado.
       */

      if (
        bufferAplicacao.length > 8
      ) {
        bufferAplicacao =
          bufferAplicacao.slice(
            -5
          );
      }
    }
  }

  /*
   * ========================================================
   * REMOVER DUPLICADOS
   * ========================================================
   */

  const mapa = new Map();

  for (const registro of registros) {
    const chave = [
      normalizar(
        registro.codigo_oem
      ),

      normalizar(
        registro.montadora
      ),

      normalizar(
        registro.modelo
      ),

      normalizar(
        registro.motor
      ),

      registro.ano_inicio ||
        "",

      registro.ano_fim ||
        "",
    ].join("|");

    if (!mapa.has(chave)) {
      mapa.set(
        chave,
        registro
      );
    }
  }

  const resultado =
    Array.from(
      mapa.values()
    );

  /*
   * ========================================================
   * DIAGNÓSTICO
   * ========================================================
   */

  console.log(
    "=========================================="
  );

  console.log(
    "🌡️ THERMAL SYSTEMS — REGISTROS:",
    resultado.length
  );

  console.log(
    "🌡️ THERMAL SYSTEMS — AMOSTRA:",
    resultado.slice(0, 10)
  );

  const mte356 =
    resultado.filter(
      (registro) =>
        normalizar(
          registro.codigo_oem
        ) ===
        "MTE356AX"
    );

  console.log(
    "🌡️ MTE356AX — REGISTROS:",
    mte356.length
  );

  console.log(
    "🌡️ MTE356AX — AMOSTRA:",
    mte356.slice(0, 10)
  );

  console.log(
    "=========================================="
  );

  return resultado;
}

export default parserMagnetiMarelliThermalSystems;