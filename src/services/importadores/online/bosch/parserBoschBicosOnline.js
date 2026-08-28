function limparTexto(valor = "") {
  return String(valor || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarCodigo(valor = "") {
  return String(valor || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .trim();
}

function extrairCodigos(texto = "") {
  const blocoCodigos =
    String(texto).match(
      /CODIGOS?\s+ORIGINAIS?\s*\/?\s*COMPATIVEIS?\s*:\s*([\s\S]*?)(?:FICOU COM DUVIDAS|$)/i
    )?.[1] || "";

  return blocoCodigos
    .split(/[\s,;|/–—-]+/)
    .map(normalizarCodigo)
    .filter(
      (codigo) =>
        codigo.length >= 5 &&
        codigo.length <= 20 &&
        /\d/.test(codigo)
    )
    .filter(
      (codigo, index, lista) =>
        lista.indexOf(codigo) === index
    );
}

function extrairCombustivel(texto = "") {
  const resultado =
    String(texto).match(
      /COMBUST[IÍ]VEL\s*:\s*([^\n\r]+)/i
    );

  return limparTexto(
    resultado?.[1] || ""
  ).toUpperCase();
}

function extrairMontadora(texto = "") {
  const montadoras = [
    "VOLKSWAGEN",
    "CHEVROLET",
    "FIAT",
    "RENAULT",
    "FORD",
    "HONDA",
    "TOYOTA",
    "NISSAN",
    "HYUNDAI",
    "KIA",
    "CHERY",
    "CITROEN",
    "PEUGEOT",
    "MERCEDES-BENZ",
    "MERCEDES BENZ",
    "BMW",
    "AUDI",
    "MITSUBISHI",
    "SUZUKI",
    "JEEP",
  ];

  const textoMaiusculo =
    String(texto).toUpperCase();

  return (
    montadoras.find((montadora) =>
      textoMaiusculo.includes(montadora)
    ) || ""
  );
}

function extrairAplicacoes(texto = "") {
  const blocoAplicacoes =
    String(texto).match(
      /VE[IÍ]CULOS?\s+COMPAT[IÍ]VEIS?\s*:\s*([\s\S]*?)(?:COMBUST[IÍ]VEL\s*:|CODIGOS?\s+ORIGINAIS?|FICOU COM DUVIDAS|$)/i
    )?.[1] || "";

  const linhas = blocoAplicacoes
    .split(/\r?\n/)
    .map(limparTexto)
    .filter(Boolean);

  const aplicacoes = [];
  let montadoraAtual = "";

  for (const linha of linhas) {
    const linhaMaiuscula =
      linha.toUpperCase();

    if (
      /^[A-ZÀ-Ú -]{2,30}$/.test(
        linhaMaiuscula
      ) &&
      !/\d/.test(linhaMaiuscula)
    ) {
      montadoraAtual =
        linhaMaiuscula;

      continue;
    }

    const resultado =
      linha.match(
        /^(.+?)\s*-\s*ANO\s*(\d{4})\s*(?:AT[EÉ]|A)\s*(\d{4})/i
      );

    if (!resultado) {
      continue;
    }

    const descricaoVeiculo =
      limparTexto(resultado[1]);

    const ano_inicio =
      Number(resultado[2]);

    const ano_fim =
      Number(resultado[3]);

    const motor =
      descricaoVeiculo.match(
        /\b\d+(?:[.,]\d+)?(?:\s*\d+V)?\b/i
      )?.[0] || "";

    aplicacoes.push({
      montadora:
        montadoraAtual ||
        extrairMontadora(linha),

      modelo: descricaoVeiculo,

      motor,

      ano_inicio,
      ano_fim,
    });
  }

  return aplicacoes;
}

function identificarCodigoBosch(
  codigos = []
) {
  return (
    codigos.find((codigo) =>
      /^0?26\d{7,10}$/i.test(codigo)
    ) ||
    codigos.find((codigo) =>
      /^0280\d+/i.test(codigo)
    ) ||
    codigos[0] ||
    ""
  );
}

export function parserBoschBicosOnline({
  titulo = "",
  descricao = "",
  url = "",
} = {}) {
  const textoCompleto = [
    titulo,
    descricao,
  ]
    .filter(Boolean)
    .join("\n");

  const codigos =
    extrairCodigos(textoCompleto);

  const codigoBosch =
    identificarCodigoBosch(codigos);

  const equivalentes =
    codigos.filter(
      (codigo) =>
        codigo !== codigoBosch
    );

  const combustivel =
    extrairCombustivel(
      textoCompleto
    );

  const aplicacoes =
    extrairAplicacoes(
      textoCompleto
    );

  const montadoraTitulo =
    extrairMontadora(
      textoCompleto
    );

  if (!codigoBosch) {
    return [];
  }

  if (!aplicacoes.length) {
    return [
      {
        fabricante: "Bosch",

        peca:
          "Bico Injetor de Combustível",

        codigo_oem:
          codigoBosch,

        codigo_equivalente:
          equivalentes.join(", "),

        montadora:
          montadoraTitulo,

        modelo: "",

        motor: "",

        ano_inicio: null,
        ano_fim: null,

        combustivel,

        aplicacao:
          limparTexto(titulo),

        observacao:
          equivalentes.length
            ? `Códigos compatíveis: ${equivalentes.join(
                ", "
              )}`
            : "",

        origem_catalogo:
          url ||
          "Catálogo Bosch Online",

        ativo: true,
        prioridade: 2,
        confiabilidade: 90,
      },
    ];
  }

  return aplicacoes.map(
    (aplicacao) => ({
      fabricante: "Bosch",

      peca:
        "Bico Injetor de Combustível",

      codigo_oem:
        codigoBosch,

      codigo_equivalente:
        equivalentes.join(", "),

      montadora:
        aplicacao.montadora ||
        montadoraTitulo,

      modelo:
        aplicacao.modelo,

      motor:
        aplicacao.motor,

      ano_inicio:
        aplicacao.ano_inicio,

      ano_fim:
        aplicacao.ano_fim,

      combustivel,

      aplicacao: [
        aplicacao.montadora,
        aplicacao.modelo,
        aplicacao.ano_inicio &&
        aplicacao.ano_fim
          ? `${aplicacao.ano_inicio} até ${aplicacao.ano_fim}`
          : "",
      ]
        .filter(Boolean)
        .join(" - "),

      observacao:
        equivalentes.length
          ? `Códigos compatíveis: ${equivalentes.join(
              ", "
            )}`
          : "",

      origem_catalogo:
        url ||
        "Catálogo Bosch Online",

      ativo: true,
      prioridade: 2,
      confiabilidade: 90,
    })
  );
}