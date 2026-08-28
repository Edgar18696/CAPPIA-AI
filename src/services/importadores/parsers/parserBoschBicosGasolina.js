function limparTexto(valor = "") {
  return String(valor || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarCodigoBosch(valor = "") {
  const codigo = String(valor || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .trim();

  return codigo.length === 10
    ? codigo
    : "";
}

function extrairCodigosBosch(linha = "") {
  const texto = String(linha || "");

  const padrao =
    /\b0\s*[0-9A-Z]{3}\s*[0-9A-Z]{3}\s*[0-9A-Z]{3}\b/gi;

  const encontrados = [];
  let match;

  while (
    (match = padrao.exec(texto)) !== null
  ) {
    const codigo =
      normalizarCodigoBosch(
        match[0]
      );

    if (!codigo) {
      continue;
    }

    encontrados.push({
      codigo,
      encontrado: match[0],
      inicio: match.index,
      fim:
        match.index +
        match[0].length,
    });
  }

  return encontrados;
}

function ehCabecalhoMontadora(linha = "") {
  const texto = limparTexto(linha);

  if (!texto) {
    return false;
  }

  const ignorar = new Set([
    "PASSENGER CARS",
    "TWO-WHEELERS",
    "COMMERCIAL VEHICLES",
    "STANDARD",
    "MODEL DESCRIPTION PART",
    "NUMBER",
    "PRODUCT",
    "DESCRIPTION",
    "ADDITIONAL",
    "INFORMATION MRP (₹)",
    "ON REQUEST",
  ]);

  if (
    ignorar.has(
      texto.toUpperCase()
    )
  ) {
    return false;
  }

  if (/\d/.test(texto)) {
    return false;
  }

  if (texto.length > 45) {
    return false;
  }

  return (
    texto === texto.toUpperCase() &&
    /[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(
      texto
    )
  );
}

function identificarProduto(
  texto = ""
) {
  const valor =
    limparTexto(texto)
      .toLowerCase();

  if (
    valor.includes(
      "high-pressure injector"
    ) ||
    valor.includes(
      "high pressure injector"
    ) ||
    valor.includes(
      "injector, gdi"
    ) ||
    valor.includes(
      "injector gdi"
    )
  ) {
    return {
      peca:
        "Bico Injetor Alta Pressão GDI",
      categoria:
        "Injeção de Combustível",
    };
  }

  if (
    valor.includes(
      "injection valve"
    ) ||
    valor.includes(
      "injector, gasoline"
    ) ||
    valor.includes(
      "gasoline injector"
    )
  ) {
    return {
      peca:
        "Bico Injetor Gasolina",
      categoria:
        "Injeção de Combustível",
    };
  }

  if (
    valor.includes(
      "high-pressure pump"
    ) ||
    valor.includes(
      "high pressure pump"
    )
  ) {
    return {
      peca:
        "Bomba de Alta Pressão",
      categoria:
        "Combustível",
    };
  }

  if (
    valor.includes(
      "fuel supply module"
    )
  ) {
    return {
      peca:
        "Módulo de Bomba de Combustível",
      categoria:
        "Combustível",
    };
  }

  if (
    valor.includes(
      "fuel pump"
    ) ||
    valor.includes(
      "electric fuel pump"
    )
  ) {
    return {
      peca:
        "Bomba de Combustível",
      categoria:
        "Combustível",
    };
  }

  if (
    valor.includes(
      "ignition coil"
    )
  ) {
    return {
      peca:
        "Bobina de Ignição",
      categoria:
        "Ignição",
    };
  }

  if (
    valor.includes(
      "lambda diagnostic sensor"
    )
  ) {
    return {
      peca:
        "Sonda Lambda Diagnóstica",
      categoria:
        "Emissões",
    };
  }

  if (
    valor.includes(
      "lambda control sensor"
    ) ||
    valor.includes(
      "lambda sensor"
    )
  ) {
    return {
      peca:
        "Sonda Lambda",
      categoria:
        "Emissões",
    };
  }

  if (
    valor.includes(
      "crankshaft sensor"
    )
  ) {
    return {
      peca:
        "Sensor de Rotação",
      categoria:
        "Sensores",
    };
  }

  if (
    valor.includes(
      "camshaft sensor"
    )
  ) {
    return {
      peca:
        "Sensor de Fase",
      categoria:
        "Sensores",
    };
  }

  if (
    valor.includes(
      "knock sensor"
    )
  ) {
    return {
      peca:
        "Sensor de Detonação",
      categoria:
        "Sensores",
    };
  }

  if (
    valor.includes(
      "hot-film air mass"
    ) ||
    valor.includes(
      "hot film air mass"
    ) ||
    valor.includes(
      "air mass meter"
    ) ||
    valor.includes("maf")
  ) {
    return {
      peca:
        "Sensor MAF",
      categoria:
        "Sensores",
    };
  }

  if (
    valor.includes(
      "intake manifold pressure"
    ) ||
    valor.includes(
      "boost pressure sensor"
    ) ||
    valor.includes(
      "manifold pressure sensor"
    )
  ) {
    return {
      peca:
        "Sensor MAP",
      categoria:
        "Sensores",
    };
  }

  if (
    valor.includes(
      "pressure sensor"
    )
  ) {
    return {
      peca:
        "Sensor de Pressão",
      categoria:
        "Sensores",
    };
  }

  if (
    valor.includes(
      "temperature sensor"
    )
  ) {
    return {
      peca:
        "Sensor de Temperatura",
      categoria:
        "Sensores",
    };
  }

  if (
    valor.includes(
      "speed sensor"
    )
  ) {
    return {
      peca:
        "Sensor de Velocidade",
      categoria:
        "Sensores",
    };
  }

  if (
    valor.includes(
      "accelerator pedal"
    )
  ) {
    return {
      peca:
        "Pedal do Acelerador",
      categoria:
        "Sensores",
    };
  }

  if (
    valor.includes(
      "throttle valve"
    ) ||
    valor.includes(
      "throttle body"
    )
  ) {
    return {
      peca:
        "Corpo de Borboleta",
      categoria:
        "Injeção de Combustível",
    };
  }

  return null;
}

function ehDescricaoBico(texto = "") {
  const produto =
    identificarProduto(texto);

  if (!produto) {
    return false;
  }

  return (
    produto.peca.includes(
      "Bico Injetor"
    )
  );
}

function extrairAnos(texto = "") {
  const valor =
    String(texto || "");

  const intervalo =
    valor.match(
      /\((\d{4})\.\d{2}\s*[-–]+\s*(\d{4}|0000)\.\d{2}\)/
    );

  if (intervalo) {
    const inicio =
      Number(intervalo[1]);

    const fimBruto =
      intervalo[2];

    return {
      ano_inicio:
        Number.isFinite(inicio)
          ? inicio
          : null,

      ano_fim:
        fimBruto === "0000"
          ? null
          : Number(fimBruto),
    };
  }

  const aberto =
    valor.match(
      /\((\d{4})\.\d{2}\s*--?>\)/
    );

  if (aberto) {
    const inicio =
      Number(aberto[1]);

    return {
      ano_inicio:
        Number.isFinite(inicio)
          ? inicio
          : null,

      ano_fim: null,
    };
  }

  return {
    ano_inicio: null,
    ano_fim: null,
  };
}

function limparModelo(texto = "") {
  return limparTexto(
    String(texto || "")
      .replace(
        /\(\d{4}\.\d{2}\s*[-–]+\s*(?:\d{4}|0000)\.\d{2}\)/g,
        ""
      )
      .replace(
        /\(\d{4}\.\d{2}\s*--?>\)/g,
        ""
      )
  );
}

function extrairMotor(modelo = "") {
  const texto =
    limparTexto(modelo);

  const encontrado =
    texto.match(
      /\b(\d\.\d)\s*([A-Z][A-Z0-9-]{0,10})?/i
    );

  if (!encontrado) {
    return "";
  }

  return limparTexto(
    [
      encontrado[1],
      encontrado[2] || "",
    ].join(" ")
  );
}

function possuiEstruturaBosch2025(
  linhas = []
) {
  const amostra =
    linhas
      .slice(0, 500)
      .join(" ")
      .toLowerCase();

  return (
    amostra.includes(
      "passenger cars"
    ) ||
    amostra.includes(
      "two-wheelers"
    ) ||
    amostra.includes(
      "commercial vehicles"
    )
  );
}

function montarContextoCodigo({
  linha,
  codigoAtual,
  proximoCodigo,
}) {
  const inicio =
    codigoAtual.inicio;

  const fim =
    proximoCodigo
      ? proximoCodigo.inicio
      : linha.length;

  return limparTexto(
    linha.slice(
      inicio,
      fim
    )
  );
}

function montarBlocoContexto(
  linhas,
  indice
) {
  return limparTexto(
    linhas
      .slice(
        indice,
        indice + 3
      )
      .join(" ")
  );
}

export async function parserBoschBicosGasolina({
  textoAplicacoes = "",
  configuracao = {},
  nomeArquivo = "",
  onProgresso,
}) {
  const linhas =
    String(
      textoAplicacoes || ""
    )
      .split(/\r?\n/)
      .map(limparTexto)
      .filter(Boolean);

  const registros = [];
  const chaves =
    new Set();

  const catalogoMultiplosProdutos =
    possuiEstruturaBosch2025(
      linhas
    ) ||
    configuracao?.tipoCatalogo ===
      "gasolina_2025";

  onProgresso?.(
    catalogoMultiplosProdutos
      ? "⛽ Lendo Bosch Gasoline System Product Portfolio 2025..."
      : "⛽ Lendo catálogo Bosch Bicos Gasolina/GDI..."
  );

  let montadoraAtual = "";

  for (
    let indice = 0;
    indice < linhas.length;
    indice += 1
  ) {
    const linha =
      linhas[indice];

    if (
      ehCabecalhoMontadora(
        linha
      )
    ) {
      montadoraAtual = linha;
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

    const primeiroCodigo =
      codigos[0];

    const parteModelo =
      limparTexto(
        linha.slice(
          0,
          primeiroCodigo.inicio
        )
      );

    const modelo =
      limparModelo(
        parteModelo
      );

    const {
      ano_inicio,
      ano_fim,
    } = extrairAnos(
      parteModelo
    );

    for (
      let indiceCodigo = 0;
      indiceCodigo <
      codigos.length;
      indiceCodigo += 1
    ) {
      const codigoAtual =
        codigos[indiceCodigo];

      const proximoCodigo =
        codigos[
          indiceCodigo + 1
        ];

      const contextoCodigo =
        montarContextoCodigo({
          linha,
          codigoAtual,
          proximoCodigo,
        });

      const blocoAmpliado =
        limparTexto(
          [
            contextoCodigo,
            montarBlocoContexto(
              linhas,
              indice
            ),
          ].join(" ")
        );

      let produto;

      if (
        catalogoMultiplosProdutos
      ) {
        produto =
          identificarProduto(
            contextoCodigo
          );

        if (!produto) {
          if (
            codigoAtual.codigo.startsWith(
              "026150"
            )
          ) {
            produto = {
              peca:
                "Bico Injetor Alta Pressão GDI",
              categoria:
                "Injeção de Combustível",
            };
          } else if (
            codigoAtual.codigo.startsWith(
              "026123"
            )
          ) {
            produto = {
              peca:
                "Sensor MAP",
              categoria:
                "Sensores",
            };
          } else if (
            codigoAtual.codigo.startsWith(
              "0258"
            )
          ) {
            produto = {
              peca:
                "Sonda Lambda",
              categoria:
                "Emissões",
            };
          }
        }

        if (!produto) {
          continue;
        }
      } else {
        if (
          !ehDescricaoBico(
            blocoAmpliado
          )
        ) {
          continue;
        }

        produto = {
          peca:
            blocoAmpliado
              .toLowerCase()
              .includes("gdi")
              ? "Bico Injetor Alta Pressão GDI"
              : "Bico Injetor Gasolina/Flex",

          categoria:
            "Injeção de Combustível",
        };
      }

      const codigoBosch =
        codigoAtual.codigo;

      const observacao =
        contextoCodigo ||
        blocoAmpliado;

      const chave = [
        codigoBosch,
        montadoraAtual,
        modelo,
        produto.peca,
        ano_inicio || "",
        ano_fim || "",
      ].join("|");

      if (
        chaves.has(chave)
      ) {
        continue;
      }

      chaves.add(chave);

      registros.push({
        fabricante:
          "Bosch",

        peca:
          produto.peca,

        categoria:
          produto.categoria,

        codigo_oem:
          codigoBosch,

        codigo_equivalente:
          "",

        aplicacao:
          limparTexto(
            [
              montadoraAtual,
              modelo,
            ]
              .filter(Boolean)
              .join(" ")
          ) || linha,

        montadora:
          montadoraAtual,

        modelo,

        motor:
          extrairMotor(
            modelo
          ),

        ano_inicio,

        ano_fim,

        observacao,

        origem_catalogo:
          configuracao.origemCatalogo ||
          nomeArquivo ||
          (
            catalogoMultiplosProdutos
              ? "Bosch Gasoline System Product Portfolio 2025"
              : "Catálogo Bosch Bicos Injetores Gasolina e Flex"
          ),

        pagina:
          configuracao.paginaAtual ||
          null,

        ativo: true,

        prioridade: 1,

        confiabilidade:
          100,
      });
    }
  }

  onProgresso?.(
    catalogoMultiplosProdutos
      ? `✅ ${registros.length} registro(s) Bosch 2025 encontrado(s).`
      : `✅ ${registros.length} bico(s) Bosch encontrado(s).`
  );

  return registros;
}