function texto(valor) {
  return String(valor || "").trim();
}

function normalizar(valor) {
  return texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function listaUnica(valores = []) {
  return [
    ...new Set(
      valores
        .map((valor) => texto(valor))
        .filter(Boolean)
    ),
  ];
}

function separarCodigos(valor) {
  return texto(valor)
    .split(/[,;|/\n]+/)
    .map((codigo) => codigo.trim())
    .filter(Boolean);
}

function registroBosch(registro = {}) {
  const conteudo = normalizar(
    [
      registro.fabricante,
      registro.origem_catalogo,
      registro.marca,
      registro.observacao,
    ]
      .filter(Boolean)
      .join(" ")
  );

  return conteudo.includes("bosch");
}

function identificarCategoria(registros = []) {
  const conteudo = normalizar(
    registros
      .map((item) =>
        [
          item.peca,
          item.descricao,
          item.categoria,
          item.origem_catalogo,
          item.observacao,
        ]
          .filter(Boolean)
          .join(" ")
      )
      .join(" ")
  );

  const categorias = [
    {
      nome: "Sonda Lambda",
      palavras: [
        "sonda lambda",
        "sensor de oxigenio",
        "sensor oxigenio",
      ],
    },
    {
      nome: "Bomba de Combustível",
      palavras: [
        "bomba de combustivel",
        "bomba combustivel",
        "modulo de combustivel",
      ],
    },
    {
      nome: "Bobina de Ignição",
      palavras: [
        "bobina de ignicao",
        "bobina ignicao",
      ],
    },
    {
      nome: "Vela de Ignição",
      palavras: [
        "vela de ignicao",
        "vela ignicao",
      ],
    },
    {
      nome: "Bico Injetor",
      palavras: [
        "bico injetor",
        "valvula injetora",
        "injetor de combustivel",
      ],
    },
    {
      nome: "Sensor MAP",
      palavras: [
        "sensor map",
        "sensor de pressao",
        "pressao do coletor",
      ],
    },
    {
      nome: "Sensor MAF",
      palavras: [
        "sensor maf",
        "medidor de fluxo",
        "massa de ar",
      ],
    },
    {
      nome: "Sensor de Rotação",
      palavras: [
        "sensor de rotacao",
        "sensor rotacao",
        "sensor virabrequim",
      ],
    },
    {
      nome: "Sensor de Fase",
      palavras: [
        "sensor de fase",
        "sensor fase",
        "sensor comando",
      ],
    },
    {
      nome: "Filtro",
      palavras: [
        "filtro de ar",
        "filtro de oleo",
        "filtro de combustivel",
        "filtro cabine",
      ],
    },
  ];

  const encontrada = categorias.find(
    (categoria) =>
      categoria.palavras.some((palavra) =>
        conteudo.includes(palavra)
      )
  );

  return encontrada?.nome || "";
}

function identificarFamilia(
  categoria,
  codigoPrincipal
) {
  const codigo = normalizar(codigoPrincipal);

  if (!codigo) {
    return "";
  }

  if (
    categoria === "Sonda Lambda" &&
    codigo.startsWith("0258")
  ) {
    return "Linha Bosch 0 258";
  }

  if (
    categoria === "Sensor MAP" &&
    codigo.startsWith("026123")
  ) {
    return "Linha Bosch 0 261 23";
  }

  if (
    categoria === "Sensor MAF" &&
    codigo.startsWith("0280")
  ) {
    return "Linha Bosch 0 280";
  }

  if (
    categoria === "Bico Injetor" &&
    codigo.startsWith("028015")
  ) {
    return "Linha Bosch 0 280 15";
  }

  if (
    categoria === "Bomba de Combustível" &&
    (
      codigo.startsWith("0580") ||
      codigo.startsWith("f000te")
    )
  ) {
    return "Linha Bosch de combustível";
  }

  if (
    categoria === "Bobina de Ignição" &&
    codigo.startsWith("0221")
  ) {
    return "Linha Bosch 0 221";
  }

  return "";
}

function extrairQuantidadeFios(registros = []) {
  const conteudo = normalizar(
    registros
      .map((item) =>
        [
          item.observacao,
          item.descricao,
          item.especificacao,
          item.detalhes,
        ]
          .filter(Boolean)
          .join(" ")
      )
      .join(" ")
  );

  const correspondencia = conteudo.match(
    /\b([1-8])\s*(?:fios?|vias?)\b/
  );

  return correspondencia
    ? Number(correspondencia[1])
    : null;
}

function extrairCodigosSubstituidos(
  registros = []
) {
  return listaUnica(
    registros.flatMap((item) => [
      ...separarCodigos(
        item.codigo_substituido
      ),
      ...separarCodigos(
        item.codigo_anterior
      ),
      ...separarCodigos(
        item.substituido_por
      ),
    ])
  );
}

function gerarObservacoes({
  encontrado,
  categoria,
  familia,
  quantidadeFios,
  modelos,
  motores,
  catalogos,
  codigosSubstituidos,
}) {
  const observacoes = [];

  if (!encontrado) {
    return observacoes;
  }

  if (categoria) {
    observacoes.push(
      `Categoria identificada: ${categoria}.`
    );
  }

  if (familia) {
    observacoes.push(
      `Família de código identificada: ${familia}.`
    );
  }

  if (quantidadeFios) {
    observacoes.push(
      `O cadastro informa ${quantidadeFios} fio(s) ou via(s).`
    );
  }

  if (codigosSubstituidos.length > 0) {
    observacoes.push(
      "O cadastro possui informação de substituição de código."
    );
  }

  if (motores.length > 1) {
    observacoes.push(
      "Existem aplicações para motorizações diferentes; confirme o motor do veículo."
    );
  }

  if (modelos.length > 10) {
    observacoes.push(
      "A peça possui ampla aplicação; confirme código, veículo, ano e motor."
    );
  }

  if (catalogos.length > 1) {
    observacoes.push(
      "A informação Bosch foi localizada em mais de uma fonte técnica."
    );
  }

  return observacoes;
}

function calcularIndiceBosch({
  encontrado,
  registrosBosch,
  codigoPrincipal,
  categoria,
  catalogos,
  modelos,
}) {
  if (!encontrado) {
    return 0;
  }

  let indice = 55;

  if (codigoPrincipal) {
    indice += 15;
  }

  if (categoria) {
    indice += 10;
  }

  if (registrosBosch.length >= 2) {
    indice += 5;
  }

  if (registrosBosch.length >= 5) {
    indice += 5;
  }

  if (catalogos.length >= 1) {
    indice += 5;
  }

  if (modelos.length >= 1) {
    indice += 5;
  }

  return Math.min(99, indice);
}

export function analisarBosch(
  analise = {}
) {
  const resultados = Array.isArray(
    analise.resultadosOrdenados
  )
    ? analise.resultadosOrdenados
    : [];

  const registrosBosch =
    resultados.filter(registroBosch);

  const fabricantePrincipal =
    normalizar(
      analise.principal?.fabricante
    );

  const catalogoPrincipal =
    normalizar(
      analise.principal?.origem_catalogo
    );

  const encontrado =
    registrosBosch.length > 0 ||
    fabricantePrincipal.includes("bosch") ||
    catalogoPrincipal.includes("bosch");

  if (!encontrado) {
    return {
      ativo: true,
      fabricante: "Bosch",
      encontrado: false,
      indiceBosch: 0,
      observacoes: [],
    };
  }

  const registrosAnalise =
    registrosBosch.length > 0
      ? registrosBosch
      : [analise.principal].filter(Boolean);

  const principalBosch =
    registrosAnalise[0] ||
    analise.principal ||
    {};

  const codigoPrincipal =
    texto(
      principalBosch.codigo_oem ||
        principalBosch.codigo_equivalente ||
        analise.principal?.codigo_oem ||
        analise.principal
          ?.codigo_equivalente
    );

  const categoria =
    identificarCategoria(
      registrosAnalise
    ) ||
    texto(principalBosch.peca);

  const familia =
    identificarFamilia(
      categoria,
      codigoPrincipal
    );

  const montadoras = listaUnica(
    registrosAnalise.map(
      (item) => item.montadora
    )
  );

  const modelos = listaUnica(
    registrosAnalise.map(
      (item) => item.modelo
    )
  );

  const motores = listaUnica(
    registrosAnalise.map(
      (item) => item.motor
    )
  );

  const catalogos = listaUnica(
    registrosAnalise.map(
      (item) => item.origem_catalogo
    )
  );

  const equivalentes = listaUnica(
    registrosAnalise.flatMap((item) =>
      separarCodigos(
        item.codigo_equivalente
      )
    )
  ).filter(
    (codigo) =>
      normalizar(codigo) !==
      normalizar(codigoPrincipal)
  );

  const codigosSubstituidos =
    extrairCodigosSubstituidos(
      registrosAnalise
    );

  const quantidadeFios =
    extrairQuantidadeFios(
      registrosAnalise
    );

  const indiceBosch =
    calcularIndiceBosch({
      encontrado,
      registrosBosch:
        registrosAnalise,
      codigoPrincipal,
      categoria,
      catalogos,
      modelos,
    });

  const observacoes =
    gerarObservacoes({
      encontrado,
      categoria,
      familia,
      quantidadeFios,
      modelos,
      motores,
      catalogos,
      codigosSubstituidos,
    });

  return {
    ativo: true,

    fabricante: "Bosch",

    encontrado: true,

    registroPrincipal:
      principalBosch,

    codigoPrincipal,

    peca:
      texto(principalBosch.peca) ||
      categoria,

    categoria,

    familia,

    quantidadeFios,

    montadoras,

    modelos,

    motores,

    catalogos,

    equivalentes,

    codigosSubstituidos,

    totalRegistros:
      registrosAnalise.length,

    indiceBosch,

    confianca: indiceBosch,

    observacoes,
  };
}

export default analisarBosch;