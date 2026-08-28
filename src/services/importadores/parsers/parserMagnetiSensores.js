function limparTexto(valor = "") {
  return String(valor || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarCodigo(valor = "") {
  return limparTexto(valor)
    .replace(/[^\w.-]/g, "")
    .toUpperCase();
}

function separarLinhas(texto = "") {
  return String(texto || "")
    .split(/\r?\n/)
    .map(limparTexto)
    .filter(Boolean);
}

function identificarCodigo(linha = "") {
  const candidatos =
    String(linha).match(
      /\b[A-Z0-9][A-Z0-9.-]{4,24}\b/g
    ) || [];

  return (
    candidatos
      .map(normalizarCodigo)
      .find(
        (codigo) =>
          codigo.length >= 5 &&
          /\d/.test(codigo)
      ) || ""
  );
}
function identificarEquivalencias(
  linha = "",
  codigoPrincipal = ""
) {
  const encontrados =
    String(linha).match(
      /\b[A-Z0-9][A-Z0-9.-]{4,24}\b/g
    ) || [];

  return encontrados
    .map(normalizarCodigo)
    .filter(
      (codigo) =>
        codigo &&
        codigo !== codigoPrincipal &&
        /\d/.test(codigo)
    )
    .join(", ");
}
function identificarDescricao(
  linha = "",
  codigo = "",
  montadora = "",
  modelo = ""
) {
  let descricao = limparTexto(linha);

  if (codigo) {
    descricao = descricao.replace(codigo, "");
  }

  if (montadora) {
    descricao = descricao.replace(
      new RegExp(`\\b${montadora}\\b`, "i"),
      ""
    );
  }

  if (modelo) {
    descricao = descricao.replace(
      new RegExp(modelo, "i"),
      ""
    );
  }

  descricao = descricao
    .replace(/\b(19|20)\d{2}\b/g, "")
    .replace(/\b\d\.\d.*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return descricao;
}
function identificarCombustivel(
  linha = ""
) {
  const texto = String(linha).toUpperCase();

  if (texto.includes("FLEX")) {
    return "Flex";
  }

  if (texto.includes("GASOLINA")) {
    return "Gasolina";
  }

  if (texto.includes("DIESEL")) {
    return "Diesel";
  }

  if (texto.includes("ETANOL")) {
    return "Etanol";
  }

  if (texto.includes("GNV")) {
    return "GNV";
  }

  return "";
}

function identificarMontadora(linha = "") {
  const montadoras = [
    "FIAT",
    "RENAULT",
    "CHEVROLET",
    "GM",
    "VOLKSWAGEN",
    "VW",
    "FORD",
    "PEUGEOT",
    "CITROEN",
    "HONDA",
    "TOYOTA",
    "NISSAN",
    "HYUNDAI",
    "KIA",
    "MITSUBISHI",
    "IVECO",
    "MERCEDES",
    "BMW",
    "AUDI",
    "VOLVO",
    "JEEP",
  ];

  return (
    montadoras.find((montadora) =>
      new RegExp(
        `\\b${montadora}\\b`,
        "i"
      ).test(linha)
    ) || ""
  );
}
function identificarModelo(
  linha = "",
  montadora = ""
) {
  if (!montadora) {
    return "";
  }

  let texto = limparTexto(linha);

  texto = texto.replace(
    new RegExp(`^${montadora}\\s*`, "i"),
    ""
  );

  texto = texto.replace(
    /\b\d\.\d.*$/i,
    ""
  );

  texto = texto.replace(
    /\b(19|20)\d{2}.*$/i,
    ""
  );

  texto = texto.replace(
    /\b(FLEX|GASOLINA|DIESEL|ETANOL|MPI|TSI|TDI|16V|8V|20V|24V)\b.*$/i,
    ""
  );

  return texto
    .replace(/[-|]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
function extrairAnos(linha = "") {
  const encontrados =
    String(linha).match(
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

function extrairMotor(linha = "") {
  const resultado =
    String(linha).match(
      /\b\d\.\d(?:\s?(?:8V|16V|20V|24V|TDI|TSI|MPI|FLEX|DIESEL|GASOLINA))?\b/i
    );

  return resultado
    ? limparTexto(resultado[0])
    : "";
}

function criarRegistro({
  codigo,
  linha,
  nomeArquivo,
  configuracao,
}) {
  const montadora =
    identificarMontadora(linha);

  const anos =
    extrairAnos(linha);

  const motor =
    extrairMotor(linha);

const modelo =
  identificarModelo(
    linha,
    montadora
  );

const descricao =
  identificarDescricao(
    linha,
    codigo,
    montadora,
    modelo
  );
const combustivel =
  identificarCombustivel(
    linha
  );

  return {
    peca:
      configuracao?.pecaPadrao ||
      "Sensor automotivo",

    codigo_oem: codigo,

    codigo_equivalente:
  identificarEquivalencias(
    linha,
    codigo
  ),

    fabricante:
      "Magneti Marelli",

    origem_catalogo:
      configuracao?.origemCatalogo ||
      nomeArquivo ||
      "Catálogo Magneti Marelli Sensores",

    montadora,

    modelo: modelo,

    motor,

    combustivel,

    ano_inicio:
      anos.ano_inicio,

    ano_fim:
      anos.ano_fim,

    aplicacao:
      descricao || linha,

    observacao: linha,

    prioridade: 1,

    confiabilidade: 80,

    ativo: true,
  };
}

function removerDuplicados(
  registros = []
) {
  const mapa = new Map();

  for (const registro of registros) {
    const chave = [
      registro.codigo_oem,
      registro.montadora,
      registro.modelo,
      registro.motor,
      registro.ano_inicio,
      registro.ano_fim,
      registro.aplicacao,
    ]
      .map((valor) =>
        String(valor || "")
          .trim()
          .toLowerCase()
      )
      .join("|");

    if (!mapa.has(chave)) {
      mapa.set(chave, registro);
    }
  }

  return Array.from(
    mapa.values()
  );
}

export async function parserMagnetiSensores({
  textoAplicacoes = "",
  nomeArquivo = "",
  configuracao = {},
  onProgresso,
}) {
  onProgresso?.(
    "📗 Interpretando catálogo Magneti Marelli de Sensores..."
  );

  const linhas =
    separarLinhas(
      textoAplicacoes
    );

  const registros = [];

  for (const linha of linhas) {
    const codigo =
      identificarCodigo(linha);

    if (!codigo) {
      continue;
    }

    registros.push(
      criarRegistro({
        codigo,
        linha,
        nomeArquivo,
        configuracao,
      })
    );
  }

  const registrosUnicos =
    removerDuplicados(
      registros
    );

  onProgresso?.(
    `✅ ${registrosUnicos.length} sensores Magneti Marelli identificados.`
  );

  return registrosUnicos;
}