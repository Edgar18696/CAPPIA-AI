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
  return limparTexto(valor)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

const REGEX_BOSCH =
  /\b(?:0\s*986\s*(?:B0[0-3]|BF0|450|452)\s*\d{3}|F\s*026\s*\d{3}\s*\d{3}|0\s*451\s*103\s*\d{3}|1\s*987\s*432\s*\d{3})\b/gi;

const MARCAS = [
  "TECFIL",
  "FRAM",
  "MANN",
  "MAHLE",
  "PUROLATOR",
  "WEGA",
  "FLEETGUARD",
  "DONALDSON",
];

function identificarMarca(
  linha = ""
) {
  const texto =
    normalizar(linha);

  return (
    MARCAS.find(
      (marca) =>
        texto === marca
    ) || ""
  );
}

function identificarTipoFiltro(
  linha = ""
) {
  const texto =
    normalizar(linha);

  if (
    texto.includes(
      "FILTRO DE COMBUSTIVEL"
    )
  ) {
    return "Filtro de Combustível";
  }

  if (
    texto.includes(
      "FILTRO DE OLEO"
    )
  ) {
    return "Filtro de Óleo";
  }

  if (
    texto.includes(
      "FILTRO DE CABINE"
    )
  ) {
    return "Filtro de Cabine";
  }

  if (
    texto.includes(
      "FILTRO DE AR"
    )
  ) {
    return "Filtro de Ar";
  }

  return "";
}

function linhaIgnorada(
  linha = ""
) {
  const texto =
    normalizar(linha);

  if (!texto) {
    return true;
  }

  const ignorar = [
    "BOSCH",
    "AUTOPECAS BOSCH",
    "2019 | 2020",
    "CONVERSAO",
    "CODIGO",
    "REFERENCIA",
  ];

  return ignorar.some(
    (termo) =>
      texto === termo ||
      texto.startsWith(
        `${termo} `
      )
  );
}

function pareceCodigoEquivalente(
  valor = ""
) {
  const codigo =
    normalizarCodigo(valor);

  if (
    !codigo ||
    codigo === "BOSCH"
  ) {
    return false;
  }

  if (
    codigo.length < 2 ||
    codigo.length > 20
  ) {
    return false;
  }

  return (
    /[A-Z]/.test(codigo) ||
    /\d/.test(codigo)
  );
}
function extrairUltimoCodigo(
  texto = ""
) {
  const valor =
    limparTexto(texto);

  const candidatos =
    valor.match(
      /\b[A-Z0-9][A-Z0-9/-]{1,19}\b/g
    ) || [];

  const validos =
    candidatos
      .map(normalizarCodigo)
      .filter(
        (codigo) =>
          codigo &&
          codigo !== "BOSCH" &&
          codigo !== "MAHLE" &&
          codigo !== "MANN" &&
          codigo !== "TECFIL" &&
          codigo !== "FRAM"
      );

  return validos.at(-1) || "";
}
function encontrarCodigosBosch(
  linha = ""
) {
  const texto =
    limparTexto(linha);

  const encontrados = [];

  REGEX_BOSCH.lastIndex = 0;

  let resultado;

  while (
    (
      resultado =
        REGEX_BOSCH.exec(texto)
    ) !== null
  ) {
    encontrados.push({
      codigo:
        normalizarCodigo(
          resultado[0]
        ),

      indice:
        resultado.index,

      fim:
        resultado.index +
        resultado[0].length,
    });
  }

  REGEX_BOSCH.lastIndex = 0;

  return encontrados;
}

function criarRegistro({
  codigoBosch,
  codigoEquivalente,
  marca,
  tipo,
  nomeArquivo,
  configuracao,
}) {
  return {
    peca:
      tipo ||
      "Filtro Automotivo",

    codigo_oem:
      normalizarCodigo(
        codigoBosch
      ),

    codigo_equivalente:
      normalizarCodigo(
        codigoEquivalente
      ),

    fabricante:
      "Bosch",

    origem_catalogo:
      nomeArquivo ||
      configuracao?.origemCatalogo ||
      "Catálogo Bosch Filtros Linha Leve 2019-2020",

    observacao:
      marca
        ? `Equivalência ${marca} conforme catálogo Bosch.`
        : "Equivalência conforme catálogo Bosch.",

    montadora: "",
    modelo: "",
    motor: "",
    combustivel: "",

    ano_inicio: null,
    ano_fim: null,

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
    const registro of registros
  ) {
    const chave = [
      registro.codigo_oem,
      registro.codigo_equivalente,
    ]
      .map(normalizarCodigo)
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

export async function parserBoschFiltrosEquivalencias({
  textoEquivalencias = "",
  nomeArquivo = "",
  configuracao = {},
  onProgresso,
}) {
  onProgresso?.(
    "🔄 Interpretando equivalências Bosch Filtros..."
  );

  const linhas =
    String(
      textoEquivalencias || ""
    )
      .split(/\r?\n/)
      .map(limparTexto)
      .filter(Boolean);

      const registros = [];

let marcaAtual = "";
let tipoAtual =
  "Filtro Automotivo";

let equivalentePendente = "";

for (
  const linha of linhas
) {
 
  const tipoEncontrado =
    identificarTipoFiltro(
      linha
    );

    if (tipoEncontrado) {
      tipoAtual =
        tipoEncontrado;

      equivalentePendente =
        "";

      continue;
    }
const codigosBosch =
  encontrarCodigosBosch(
    linha
  );
    const marcaEncontrada =
      identificarMarca(
        linha
      );

    if (marcaEncontrada) {
      marcaAtual =
        marcaEncontrada;

      equivalentePendente =
        "";

      continue;
    }

    if (linhaIgnorada(linha)) {
      continue;
    }

  const pares = [];

const regexLinha =
  /([A-Z0-9/-]{2,20}?)\s*(0\s*986\s*(?:B0[0-3]|BF0|450|452)\s*\d{3}|F\s*026\s*\d{3}\s*\d{3}|0\s*451\s*103\s*\d{3}|1\s*987\s*43[25]\s*\d{3})/gi;

let match;

while (
  (match = regexLinha.exec(linha)) !== null
) {
  pares.push({
    equivalente: normalizarCodigo(match[1]),
    bosch: normalizarCodigo(match[2]),
  });
}

if (pares.length > 0) {
  for (const par of pares) {
        registros.push(
      criarRegistro({
        codigoBosch: par.bosch,
        codigoEquivalente: par.equivalente,
        marca: marcaAtual,
        tipo: tipoAtual,
        nomeArquivo,
        configuracao,
      })
    );
  }

  continue;
}
    
    if (
      codigosBosch.length === 0
    ) {
      const candidato =
        extrairUltimoCodigo(
          linha
        );

      if (
        pareceCodigoEquivalente(
          candidato
        )
      ) {
        equivalentePendente =
          candidato;
      }

      continue;
    }

    let fimCodigoAnterior = 0;

    for (
      const codigoBosch of
      codigosBosch
    ) {
      const trechoAnterior =
        limparTexto(
          linha.slice(
            fimCodigoAnterior,
            codigoBosch.indice
          )
        );

      const equivalenteMesmaLinha =
        extrairUltimoCodigo(
          trechoAnterior
        );

const codigoEquivalente =
  equivalenteMesmaLinha ||
  equivalentePendente;

if (
  codigoEquivalente &&
  codigoEquivalente !==
    codigoBosch.codigo
) {
  registros.push(
          criarRegistro({
            codigoBosch:
              codigoBosch.codigo,

            codigoEquivalente,

            marca:
              marcaAtual,

            tipo:
              tipoAtual,

            nomeArquivo,

            configuracao,
          })
        );
      }

      equivalentePendente =
        "";

      fimCodigoAnterior =
        codigoBosch.fim;
    }

    const trechoFinal =
      limparTexto(
        linha.slice(
          fimCodigoAnterior
        )
      );

    const proximoEquivalente =
      extrairUltimoCodigo(
        trechoFinal
      );

    if (
      pareceCodigoEquivalente(
        proximoEquivalente
      )
    ) {
      equivalentePendente =
        proximoEquivalente;
    }
  }

  const registrosUnicos =
    removerDuplicados(
      registros
    );

    onProgresso?.(
    `✅ Bosch Filtros: ${registrosUnicos.length} equivalência(s) encontrada(s).`
  );

  return registrosUnicos;
}

export default parserBoschFiltrosEquivalencias;