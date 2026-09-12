import motorInteligenciaPeca from "../../inteligencia/motorInteligenciaPeca";

/*
 * ============================================================
 * BOSCH
 * IGNITION AND GASOLINE INJECTION PARTS AND SENSORS
 * PRODUCT PORTFOLIO 2023
 * ============================================================
 */

function limparTexto(valor = "") {
  return String(valor || "")
    .replace(/\uFFFE/g, "")
    .replace(/\s+/g, " ")
    .trim();
}


/*
 * ============================================================
 * NORMALIZAR CÓDIGO BOSCH
 *
 * Exemplos:
 *
 * 0 986 280 610 -> 0986280610
 * 0 261 500 01D -> 026150001D
 * 0 986 AG1 304 -> 0986AG1304
 * F 000 DR9 006 -> F000DR9006
 * 1 987 580 054 -> 1987580054
 * ============================================================
 */

function normalizarCodigoBosch(valor = "") {
  return String(valor || "")
    .replace(/\s+/g, "")
    .toUpperCase()
    .trim();
}


/*
 * ============================================================
 * EXTRAIR CÓDIGOS BOSCH
 * ============================================================
 */

function extrairCodigosBosch(texto = "") {
  const regex =
    /\b(?:[01]\s*[0-9A-Z]{3}\s*[0-9A-Z]{3}\s*[0-9A-Z]{3}|F\s*[0-9A-Z]{3}\s*[0-9A-Z]{3}\s*[0-9A-Z]{3})\b/gi;

  const encontrados =
    String(texto || "").match(regex) || [];

  return encontrados.map(
    normalizarCodigoBosch
  );
}


/*
 * ============================================================
 * DETECTAR FIM DE REGISTRO
 *
 * As linhas do catálogo normalmente terminam com:
 *
 * On Request
 *
 * ou preço:
 *
 * 1,411.00
 * 903.00
 * ============================================================
 */

function registroTerminou(texto = "") {
  const valor =
    limparTexto(texto);

  return (
    /\bOn Request\s*$/i.test(valor) ||
    /\b\d{1,3}(?:,\d{3})*\.\d{2}\s*$/.test(
      valor
    )
  );
}


/*
 * ============================================================
 * CABEÇALHOS QUE DEVEM SER IGNORADOS
 * ============================================================
 */

function ehCabecalho(linha = "") {
  const texto =
    limparTexto(linha)
      .toLowerCase();

  if (!texto) {
    return true;
  }

  return (
    /^--- página \d+ ---$/i.test(
      limparTexto(linha)
    ) ||
    /^\d+$/.test(texto) ||
    texto === "passenger cars" ||
    texto === "model description product" ||
    texto === "model description" ||
    texto === "product description" ||
    texto === "description" ||
    texto === "additional information" ||
    texto === "part" ||
    texto === "number mrp (₹)" ||
    texto === "number mrp" ||
    texto === "mrp (₹)" ||
    texto === "mrp"
  );
}


/*
 * ============================================================
 * IDENTIFICAR MONTADORA
 *
 * Exemplos:
 *
 * AUDI
 * BMW
 * LAND ROVER
 * MERCEDES-BENZ
 * SUZUKI
 * TATA MOTORS
 * ============================================================
 */

function ehMontadora(linha = "") {
  const texto =
    limparTexto(linha);

  if (
    !texto ||
    ehCabecalho(texto)
  ) {
    return false;
  }

  /*
   * Não pode conter código Bosch,
   * preço ou período.
   */

  if (
    extrairCodigosBosch(texto).length >
      0 ||
    /\d{4}\.\d{2}/.test(texto) ||
    /\d+\.\d{2}$/.test(texto)
  ) {
    return false;
  }

  /*
   * Cabeçalhos de montadora vêm
   * predominantemente em caixa alta.
   */

  if (
    texto !==
    texto.toUpperCase()
  ) {
    return false;
  }

  return /^[A-ZÀ-Ü0-9][A-ZÀ-Ü0-9 &'./+-]{1,40}$/.test(
    texto
  );
}


/*
 * ============================================================
 * PERÍODO
 *
 * Exemplos:
 *
 * (2014.08 -2020.10)
 * (2001.01 -2006.06)
 * (2013.10-->)
 * ============================================================
 */

function extrairPeriodo(texto = "") {
  const valor =
    limparTexto(texto);

  const fechado =
    valor.match(
      /\((\d{4})(?:\.\d{2})?\s*-\s*(\d{4})(?:\.\d{2})?\)/
    );

  if (fechado) {
    return {
      ano_inicio:
        Number(fechado[1]),

      ano_fim:
        Number(fechado[2]),
    };
  }

  const aberto =
    valor.match(
      /\((\d{4})(?:\.\d{2})?\s*-+>\)/
    );

  if (aberto) {
    return {
      ano_inicio:
        Number(aberto[1]),

      ano_fim:
        null,
    };
  }

  return {
    ano_inicio: null,
    ano_fim: null,
  };
}


/*
 * ============================================================
 * PRODUTOS BOSCH
 *
 * Usamos esses nomes como marcadores para separar:
 *
 * MODELO / MOTOR / VERSÃO
 *
 * da
 *
 * DESCRIÇÃO DO PRODUTO
 * ============================================================
 */

const MARCADORES_PRODUTO = [
  "High-pressure Injector",
  "High Pressure Injector",

  "High-pressure Pump",
  "High Pressure Pump",

  "Injector, Gasoline",
  "Injection Pump, Gasoline",

  "Electric Fuel Pump",

  "Fuel Supply Module",
  "Fuel Level Sensor Module",

  "Air Mass Meter",

  "Boost Pressure Sensor",
  "Low-pressure Sensor",
  "Intake Manifold Pressure Sensor",

  "Pressure Sensor",
  "Pressure Regulator",

  "Camshaft Sensor",
  "Crankshaft Sensor",
  "Knock Sensor",

  "Temperature Sensor",

  "Lambda Control Sensor",
  "Lambda Diagnostic Sensor",

  "Universal Lambda Control Sensor",
  "Universal Lambda Diagnostic Sensor",

  "Nox Sensor",
  "NOx Sensor",

  "Particulate Sensor",

  "Ignition Coil",
  "Ignition Cable",

  "Canister Purge Valve",

  "Throttle Valve Assembly",

  "Self-diagnosis Module",

  "Accelerator Pedal Module",

  "Speed Sensor",

  "Injection Valve",

  "Fuel Pressure Sensor",
];


/*
 * ============================================================
 * LOCALIZAR COMEÇO DO PRODUTO
 * ============================================================
 */

function localizarProduto(
  texto = ""
) {
  const original =
    limparTexto(texto);

  const inferior =
    original.toLowerCase();

  let melhorIndice =
    -1;

  let marcadorEncontrado =
    "";

  for (
    const marcador
    of MARCADORES_PRODUTO
  ) {
    const indice =
      inferior.indexOf(
        marcador.toLowerCase()
      );

    if (
      indice >= 0 &&
      (
        melhorIndice === -1 ||
        indice < melhorIndice
      )
    ) {
      melhorIndice =
        indice;

      marcadorEncontrado =
        marcador;
    }
  }

  return {
    indice:
      melhorIndice,

    marcador:
      marcadorEncontrado,
  };
}


/*
 * ============================================================
 * REMOVER PREÇO / ON REQUEST
 * ============================================================
 */

function removerPreco(texto = "") {
  return limparTexto(texto)
    .replace(
      /\s+On Request\s*$/i,
      ""
    )
    .replace(
      /\s+\d{1,3}(?:,\d{3})*\.\d{2}\s*$/,
      ""
    )
    .trim();
}


/*
 * ============================================================
 * REMOVER CÓDIGO FINAL
 * ============================================================
 */

function removerUltimoCodigoBosch(
  texto = ""
) {
  let valor =
    limparTexto(texto);

  const regex =
    /\b(?:[01]\s*[0-9A-Z]{3}\s*[0-9A-Z]{3}\s*[0-9A-Z]{3}|F\s*[0-9A-Z]{3}\s*[0-9A-Z]{3}\s*[0-9A-Z]{3})\b/gi;

  const encontrados = [
    ...valor.matchAll(regex),
  ];

  if (
    encontrados.length === 0
  ) {
    return valor;
  }

  const ultimo =
    encontrados[
      encontrados.length - 1
    ];

  const inicio =
    ultimo.index;

  const fim =
    inicio +
    ultimo[0].length;

  return limparTexto(
    valor.slice(0, inicio) +
      " " +
      valor.slice(fim)
  );
}


/*
 * ============================================================
 * LIMPAR PERÍODO DO MODELO
 * ============================================================
 */

function removerPeriodo(texto = "") {
  return limparTexto(texto)
    .replace(
      /\(\d{4}(?:\.\d{2})?\s*-\s*\d{4}(?:\.\d{2})?\)/g,
      ""
    )
    .replace(
      /\(\d{4}(?:\.\d{2})?\s*-+>\)/g,
      ""
    )
    .trim();
}


/*
 * ============================================================
 * CONVERTER UM REGISTRO BRUTO
 * ============================================================
 */

function converterRegistro({
  texto = "",
  montadora = "",
  nomeArquivo = "",
}) {
  let registroTexto =
    limparTexto(texto);

  if (!registroTexto) {
    return null;
  }

  /*
   * Remove preço.
   */

  registroTexto =
    removerPreco(
      registroTexto
    );

  /*
   * O último código Bosch do registro
   * é a referência principal da peça.
   *
   * Isso é importante porque algumas
   * observações citam outros códigos
   * antes da referência final.
   */

  const codigos =
    extrairCodigosBosch(
      registroTexto
    );

  if (
    codigos.length === 0
  ) {
    return null;
  }

  const codigo =
    codigos[
      codigos.length - 1
    ];

  let textoSemCodigo =
    removerUltimoCodigoBosch(
      registroTexto
    );

  const periodo =
    extrairPeriodo(
      textoSemCodigo
    );

  const produto =
    localizarProduto(
      textoSemCodigo
    );

  /*
   * Se não conseguimos identificar
   * onde começa o produto, não
   * inventamos modelo/aplicação.
   */

  if (
    produto.indice < 0
  ) {
    return null;
  }

  const parteVeiculo =
    removerPeriodo(
      textoSemCodigo
        .slice(
          0,
          produto.indice
        )
    );

  const descricaoProduto =
    limparTexto(
      textoSemCodigo
        .slice(
          produto.indice
        )
    );

  if (
    !parteVeiculo ||
    !descricaoProduto
  ) {
    return null;
  }

  /*
   * Neste catálogo o campo anterior
   * ao produto é a descrição do modelo.
   *
   * Exemplo:
   *
   * AUDI
   * A3 1.8 TFSI Limousine
   *
   * Não tentamos separar "motor"
   * automaticamente para não inventar
   * informação.
   */

  const modelo =
    parteVeiculo;

  const inteligencia =
    motorInteligenciaPeca({
      codigo,
      descricao:
        descricaoProduto,
      texto:
        `${montadora} ${modelo} ${descricaoProduto}`,
    });

  return {
    peca:
      inteligencia.familia,

    descricao:
      descricaoProduto,

    codigo_oem:
      codigo,

    codigo_equivalente:
      null,

    fabricante:
      "Bosch",

    origem_catalogo:
      nomeArquivo,

    montadora:
      montadora || null,

    modelo:
      modelo || null,

    /*
     * Mantemos motor nulo nesta etapa.
     * A versão/motorização permanece
     * preservada dentro de "modelo".
     */
    motor:
      null,

    ano_inicio:
      periodo.ano_inicio,

    ano_fim:
      periodo.ano_fim,

    familia:
      inteligencia.familia,

    categoria:
      inteligencia.categoria,

    sistema:
      inteligencia.sistema,

    tipo:
      inteligencia.tipo,

    palavrasChave:
      inteligencia.palavrasChave,

    confianca:
      inteligencia.confianca,

    aplicacao:
      limparTexto(
        [
          montadora,
          modelo,
        ]
          .filter(Boolean)
          .join(" ")
      ),
  };
}


/*
 * ============================================================
 * PARSER PRINCIPAL
 * ============================================================
 */

export async function parserBoschGasolina2023({
  textoAplicacoes = "",
  nomeArquivo =
    "Bosch Ignition and Gasoline Injection Parts and Sensors Product Portfolio 2023",
}) {
  const linhas =
    String(
      textoAplicacoes || ""
    )
      .split(/\r?\n/)
      .map(
        limparTexto
      )
      .filter(Boolean);

  const registros = [];

  let montadoraAtual =
    "";

  let acumulador =
    "";

  for (
    const linhaOriginal
    of linhas
  ) {
    const linha =
      limparTexto(
        linhaOriginal
      );

    if (
      !linha ||
      ehCabecalho(linha)
    ) {
      continue;
    }

    /*
     * ========================================================
     * NOVA MONTADORA
     * ========================================================
     */

    if (
      ehMontadora(linha)
    ) {
      montadoraAtual =
        linha;

      acumulador =
        "";

      continue;
    }

    /*
     * ========================================================
     * ACUMULAR LINHAS DO REGISTRO
     * ========================================================
     */

    acumulador =
      limparTexto(
        `${acumulador} ${linha}`
      );

    /*
     * Só fechamos registro quando
     * chegamos ao final real da linha
     * comercial do catálogo.
     */

    if (
      !registroTerminou(
        acumulador
      )
    ) {
      continue;
    }

    const registro =
      converterRegistro({
        texto:
          acumulador,

        montadora:
          montadoraAtual,

        nomeArquivo,
      });

    if (registro) {
      registros.push(
        registro
      );
    }

    acumulador =
      "";
  }

  /*
   * =========================================================
   * REMOVER DUPLICADOS EXATOS
   * =========================================================
   */

  const mapa =
    new Map();

  for (
    const registro
    of registros
  ) {
    const chave =
      [
        registro.codigo_oem,
        registro.montadora,
        registro.modelo,
        registro.ano_inicio,
        registro.ano_fim,
        registro.descricao,
      ]
        .map(
          (valor) =>
            String(
              valor ?? ""
            )
              .trim()
              .toLowerCase()
        )
        .join("|");

    if (
      !mapa.has(chave)
    ) {
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

  console.log(
    `✅ Bosch Gasolina 2023: ${resultado.length} registro(s) estruturado(s).`
  );

  console.log(
    "🔎 BOSCH 2023 — AMOSTRA ESTRUTURADA:",
    resultado.slice(
      0,
      10
    )
  );
const total = resultado.length;

const confianca100 =
  resultado.filter(
    (registro) =>
      Number(
        registro?.confianca || 0
      ) === 100
  ).length;

const confianca75 =
  resultado.filter(
    (registro) =>
      Number(
        registro?.confianca || 0
      ) === 75
  ).length;

const abaixo75 =
  resultado.filter(
    (registro) =>
      Number(
        registro?.confianca || 0
      ) < 75
  ).length;

const semCodigo =
  resultado.filter(
    (registro) =>
      !String(
        registro?.codigo_oem || ""
      ).trim()
  ).length;

const semMontadora =
  resultado.filter(
    (registro) =>
      !String(
        registro?.montadora || ""
      ).trim()
  ).length;

const semModelo =
  resultado.filter(
    (registro) =>
      !String(
        registro?.modelo || ""
      ).trim()
  ).length;

const semAplicacao =
  resultado.filter(
    (registro) =>
      !String(
        registro?.aplicacao || ""
      ).trim()
  ).length;

const chavesDuplicadas =
  new Map();

for (const registro of resultado) {
  const chave =
    [
      registro?.codigo_oem,
      registro?.montadora,
      registro?.modelo,
      registro?.ano_inicio,
      registro?.ano_fim,
      registro?.descricao,
    ]
      .map(
        (valor) =>
          String(
            valor ?? ""
          )
            .trim()
            .toLowerCase()
      )
      .join("|");

  chavesDuplicadas.set(
    chave,
    (
      chavesDuplicadas.get(
        chave
      ) || 0
    ) + 1
  );
}

const duplicados =
  Array.from(
    chavesDuplicadas.values()
  ).filter(
    (quantidade) =>
      quantidade > 1
  ).length;

console.log(
  "=========================================="
);

console.log(
  "📊 BOSCH 2023 — DIAGNÓSTICO FINAL"
);

console.table({
  total,
  confianca100,
  confianca75,
  abaixo75,
  semCodigo,
  semMontadora,
  semModelo,
  semAplicacao,
  duplicados,
});

console.log(
  "=========================================="
);
  return resultado;
}

export default parserBoschGasolina2023;