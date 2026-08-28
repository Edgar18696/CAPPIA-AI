function normalizar(texto = "") {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function contem(texto, termos = []) {
  return termos.some((termo) =>
    texto.includes(normalizar(termo))
  );
}

export default function detectarLayout({
  nomeArquivo = "",
  configuracao = {},
} = {}) {
  const arquivoNormalizado =
    normalizar(nomeArquivo);

  console.log(
    "ARQUIVO NORMALIZADO:",
    arquivoNormalizado
  );

  if (
    arquivoNormalizado.includes("catalogo mh cy") ||
    arquivoNormalizado.includes("mh cy 2020") ||
    arquivoNormalizado.includes("mh cy") ||
    arquivoNormalizado.includes("catalogo rm hcv") ||
    arquivoNormalizado.includes("rm hcv 2020") ||
    arquivoNormalizado.includes("rm hcv")
  ) {
    return {
      layout: "alternadores",
      confianca: 100,
    };
  }

  const texto = normalizar(
    [
      nomeArquivo,
      configuracao.tipoCatalogo,
      configuracao.origemCatalogo,
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (
    contem(texto, [
      "sensor abs",
      "sensor de velocidade do abs",
      "sensor velocidade abs",
      "abs 2019",
      "abs 2020",
    ])
  ) {
    return {
      layout: "abs",
      confianca: 100,
    };
  }

  if (
    contem(texto, [
      "porta injetor",
      "porta injetores",
      "sth",
    ])
  ) {
    return {
      layout: "diesel_sth",
      confianca: 100,
    };
  }

  if (
    contem(texto, [
      "reman",
      "remanufaturado",
      "crin hpc",
    ])
  ) {
    return {
      layout: "diesel_remanufaturado",
      confianca: 100,
    };
  }

  if (
    contem(texto, [
      "alternador",
      "alternadores",
      "motor de partida",
      "motores de partida",
    ])
  ) {
    return {
      layout: "alternadores",
      confianca: 100,
    };
  }

  if (
    contem(texto, [
      "bico injetor",
      "bicos injetores",
      "gasolina",
      "flex",
      "injecao multiponto",
    ])
  ) {
    return {
      layout: "bicos_gasolina",
      confianca: 100,
    };
  }

  if (
    contem(texto, [
      "diesel",
      "common rail",
      "bico diesel",
      "injetor diesel",
    ])
  ) {
    return {
      layout: "diesel",
      confianca: 100,
    };
  }

  if (
    contem(texto, [
      "bomba de combustivel",
      "bombas de combustivel",
    ])
  ) {
    return {
      layout: "bombas",
      confianca: 100,
    };
  }

  if (
    contem(texto, [
      "vela",
      "velas",
      "bobina",
      "bobinas",
      "cabos de ignicao",
      "ignicao completo",
    ])
  ) {
    return {
      layout: "ignicao_completo",
      confianca: 100,
    };
  }

  if (
    contem(texto, [
      "palheta",
      "palhetas",
      "limpador",
    ])
  ) {
    return {
      layout: "palhetas",
      confianca: 100,
    };
  }

  if (
    contem(texto, [
      "filtro",
      "filtros",
    ])
  ) {
    return {
      layout: "filtros",
      confianca: 100,
    };
  }

  if (
    contem(texto, [
      "sonda",
      "sondas",
      "lambda",
      "sensor de oxigenio",
    ])
  ) {
    return {
      layout: "sondas",
      confianca: 100,
    };
  }

  if (configuracao.tipoCatalogo) {
    return {
      layout: normalizar(
        configuracao.tipoCatalogo
      ).replace(/\s+/g, "_"),

      confianca: 90,
    };
  }

  return {
    layout: "desconhecido",
    confianca: 0,
  };
}
