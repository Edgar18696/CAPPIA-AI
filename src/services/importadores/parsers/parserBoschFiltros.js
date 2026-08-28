import enriquecerRegistro from "../../inteligencia/enriquecerRegistro";
import parserBoschFiltrosEquivalencias from "./parserBoschFiltrosEquivalencias";

function limparTexto(valor = "") {
  return String(valor || "")
    .replace(/\u00a0/g, " ")
    .replace(/[➜]/g, " → ")
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

const MONTADORAS = [
  "ALFA ROMEO",
  "ASIA",
  "ASIA MOTORS",
  "AUDI",
  "BMW",
  "CHEVROLET",
  "CHERY",
  "CITROEN",
  "CITROËN",
  "FIAT",
  "FORD",
  "GM",
  "HONDA",
  "HYUNDAI",
  "IVECO",
  "JAC",
  "JEEP",
  "KIA",
  "LAND ROVER",
  "MERCEDES-BENZ",
  "MERCEDES BENZ",
  "MITSUBISHI",
  "NISSAN",
  "PEUGEOT",
  "RENAULT",
  "SEAT",
  "SUBARU",
  "SUZUKI",
  "TOYOTA",
  "VOLKSWAGEN",
  "VOLVO",
];

function identificarMontadora(
  linha = ""
) {
  const texto = normalizar(linha);

  return (
    MONTADORAS.find(
      (montadora) =>
        normalizar(montadora) === texto
    ) || ""
  );
}

function ehCabecalho(linha = "") {
  const texto = normalizar(linha);

  if (!texto) {
    return true;
  }

  const termos = [
    "VEICULO",
    "MOTOR",
    "DATA DE APLICACAO",
    "COMBUSTIVEL",
    "FILTRO DE AR PRIMARIO",
    "FILTRO DE AR SECUNDARIO",
    "FILTRO DE COMBUSTIVEL",
    "FILTRO DE OLEO",
    "FILTRO DE CABINE",
    "POSICAO DO FILTRO",
    "OUTROS",
    "AUTOPECAS BOSCH",
    "FILTROS BOSCH",
    "2019 | 2020",
    "1=KIT",
    "2=COPO",
    "3=BLINDADO",
    "4=CONJUNTO",
    "5=ELEMENTO",
    "B1 |",
    "B2 |",
  ];

  return termos.some(
    (termo) =>
      texto === termo ||
      texto.startsWith(`${termo} `)
  );
}

function extrairCodigosBosch(
  texto = ""
) {
  const conteudo =
    limparTexto(texto).toUpperCase();

  const encontrados = [
    ...(
      conteudo.match(
        /\b0\s*986\s*(?:B0[0-3]|BF0|450|452)\s*\d{3}\b/g
      ) || []
    ),

    ...(
      conteudo.match(
        /\bF\s*026\s*400\s*\d{3}\b/g
      ) || []
    ),

    ...(
      conteudo.match(
        /\b0\s*451\s*103\s*\d{3}\b/g
      ) || []
    ),

    ...(
      conteudo.match(
        /\b1\s*987\s*432\s*\d{3}\b/g
      ) || []
    ),
  ];

  return Array.from(
    new Set(
      encontrados
        .map(normalizarCodigo)
        .filter(Boolean)
    )
  );
}

function converterAno(valor) {
  const numero = Number(valor);

  if (!Number.isInteger(numero)) {
    return null;
  }

  return numero >= 80
    ? 1900 + numero
    : 2000 + numero;
}

function extrairPeriodo(
  linha = ""
) {
  const texto = limparTexto(linha);

  const resultado = texto.match(
    /\b(\d{2})\.(\d{2})\s*(?:→|->|–|-)\s*(\d{2})\.(\d{2})\b/
  );

  if (!resultado) {
    return {
      encontrado: false,
      anoInicio: null,
      anoFim: null,
      indice: -1,
      texto: "",
    };
  }

  return {
    encontrado: true,

    anoInicio:
      converterAno(resultado[2]),

    anoFim:
      converterAno(resultado[4]),

    indice:
      resultado.index,

    texto:
      resultado[0],
  };
}

function extrairCombustivel(
  linha = ""
) {
  return (
    limparTexto(linha).match(
      /\b(GASOLINA|DIESEL|FLEX|ETANOL|ALCOOL|ÁLCOOL|GNV)\b/i
    )?.[1] || ""
  );
}

function pareceCodigoMotor(
  texto = ""
) {
  const valor =
    limparTexto(texto);

  if (!valor) {
    return false;
  }

  return (
    /^[A-Z]{1,5}\d{0,3}$/i.test(
      valor
    ) ||
    /^\d[A-Z]$/i.test(valor) ||
    /^[A-Z]{1,3}\s+\d{2,4}$/i.test(
      valor
    )
  );
}

function limparModelo(
  modelo = ""
) {
  return limparTexto(modelo)
    .replace(
      /\s+(GASOLINE|GASOLINA)$/i,
      ""
    )
    .trim();
}

function separarModeloMotor(
  prefixo = "",
  modeloAtual = ""
) {
  const texto =
    limparTexto(prefixo);

  if (!texto) {
    return {
      modelo: modeloAtual,
      motor: "",
    };
  }

  const partes =
    texto.split(/\s+/);

  if (
    partes.length === 1 &&
    pareceCodigoMotor(texto)
  ) {
    return {
      modelo: modeloAtual,
      motor: texto,
    };
  }

  const ultimo =
    partes.at(-1) || "";

  const penultimo =
    partes.at(-2) || "";

  if (
    /^[A-Z]{1,3}$/i.test(
      penultimo
    ) &&
    /^\d{2,4}$/.test(ultimo)
  ) {
    const modeloBase =
      partes
        .slice(0, -2)
        .join(" ");

    const cilindrada =
      modeloBase.match(
        /\b\d\.\d{1,2}\b/
      )?.[0] || "";

    return {
      modelo:
        limparModelo(
          modeloBase
        ),

      motor:
        limparTexto(
          [
            cilindrada,
            penultimo,
            ultimo,
          ]
            .filter(Boolean)
            .join(" ")
        ),
    };
  }

  if (
    pareceCodigoMotor(ultimo)
  ) {
    return {
      modelo:
        limparModelo(
          partes
            .slice(0, -1)
            .join(" ")
        ),

      motor:
        limparTexto(ultimo),
    };
  }

  return {
    modelo:
      limparModelo(texto),

    motor: "",
  };
}

function identificarTipoFiltro(
  codigo = ""
) {
  const codigoNormalizado =
    normalizarCodigo(codigo);

  if (
    codigoNormalizado.includes("B00") ||
    codigoNormalizado.includes("B01") ||
    codigoNormalizado.startsWith(
      "0451103"
    )
  ) {
    return {
      peca: "Filtro de Óleo",
      tipoCatalogo:
        "filtro_oleo",
    };
  }

  if (
    codigoNormalizado.includes("B02") ||
    codigoNormalizado.includes("B03") ||
    codigoNormalizado.startsWith(
      "F026400"
    )
  ) {
    return {
      peca: "Filtro de Ar",
      tipoCatalogo:
        "filtro_ar",
    };
  }

  if (
    codigoNormalizado.startsWith(
      "1987432"
    )
  ) {
    return {
      peca: "Filtro de Cabine",
      tipoCatalogo:
        "filtro_cabine",
    };
  }

  if (
    codigoNormalizado.includes("BF0")
  ) {
    return {
      peca:
        "Filtro de Cabine",

      tipoCatalogo:
        "filtro_cabine",
    };
  }

  if (
    codigoNormalizado.includes("450") ||
    codigoNormalizado.includes("452")
  ) {
    return {
      peca:
        "Filtro de Combustível",

      tipoCatalogo:
        "filtro_combustivel",
    };
  }

  return {
    peca: "Filtro Automotivo",
    tipoCatalogo: "filtros",
  };
}

function criarRegistro({
  codigo,
  montadora,
  modelo,
  motor,
  combustivel,
  anoInicio,
  anoFim,
  aplicacao,
  nomeArquivo,
  configuracao,
}) {
  const tipo =
    identificarTipoFiltro(
      codigo
    );

  return {
    peca:
      tipo.peca,

    codigo_oem:
      normalizarCodigo(codigo),

    codigo_equivalente: "",

    fabricante: "Bosch",

    montadora:
      limparTexto(montadora),

    modelo:
      limparModelo(modelo),

    motor:
      limparTexto(motor),

    combustivel:
      limparTexto(combustivel),

    ano_inicio:
      anoInicio ?? null,

    ano_fim:
      anoFim ?? null,

    aplicacao:
      limparTexto(aplicacao),

    observacao:
      "Aplicação conforme Catálogo Bosch Filtros Linha Leve 2019-2020.",

    origem_catalogo:
      nomeArquivo ||
      configuracao?.origemCatalogo ||
      "Catálogo Bosch Filtros Linha Leve 2019-2020",

    tipo_catalogo:
      tipo.tipoCatalogo,

    ativo: true,

    prioridade: 1,

    confiabilidade:
      montadora &&
      modelo &&
      codigo
        ? 100
        : 85,
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

function pareceLinhaModelo(
  linha = ""
) {
  const texto =
    limparTexto(linha);

  if (!texto) {
    return false;
  }

  if (
    ehCabecalho(texto) ||
    identificarMontadora(texto) ||
    extrairCodigosBosch(texto).length ||
    extrairPeriodo(texto).encontrado ||
    extrairCombustivel(texto)
  ) {
    return false;
  }

  return (
    texto.length <= 100 &&
    (
      /\d/.test(texto) ||
      texto.split(/\s+/).length >= 2
    )
  );
}

export async function parserBoschFiltros({
  textoAplicacoes = "",
  textoEquivalencias = "",
  configuracao = {},
  nomeArquivo = "",
  onProgresso,
}) {
  onProgresso?.(
    "🧰 Interpretando catálogo Bosch Filtros..."
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
  let motorAtual = "";
  let combustivelAtual = "";
  let anoInicioAtual = null;
  let anoFimAtual = null;

  for (const linha of linhas) {
    if (ehCabecalho(linha)) {
      continue;
    }

    const montadora =
      identificarMontadora(linha);

    if (montadora) {
      montadoraAtual =
        montadora;

      modeloAtual = "";
      motorAtual = "";
      combustivelAtual = "";
      anoInicioAtual = null;
      anoFimAtual = null;

      continue;
    }

    const codigos =
      extrairCodigosBosch(linha);

    const periodo =
      extrairPeriodo(linha);

    const combustivel =
      extrairCombustivel(linha);

    if (periodo.encontrado) {
      const prefixo =
        limparTexto(
          linha.slice(
            0,
            periodo.indice
          )
        );

      if (prefixo) {
        const dados =
          separarModeloMotor(
            prefixo,
            modeloAtual
          );

        if (dados.modelo) {
          modeloAtual =
            dados.modelo;
        }

        if (dados.motor) {
          motorAtual =
            dados.motor;
        }
      }

      anoInicioAtual =
        periodo.anoInicio;

      anoFimAtual =
        periodo.anoFim;

      if (combustivel) {
        combustivelAtual =
          combustivel;
      }
    } else if (
      !codigos.length &&
      combustivel
    ) {
      combustivelAtual =
        combustivel;

      continue;
    } else if (
      !codigos.length &&
      pareceCodigoMotor(linha) &&
      modeloAtual
    ) {
      motorAtual = linha;
      continue;
    } else if (
      !codigos.length &&
      pareceLinhaModelo(linha)
    ) {
      modeloAtual =
        limparModelo(linha);

      motorAtual = "";

      continue;
    }

    if (
      codigos.length === 0
    ) {
      continue;
    }

    for (const codigo of codigos) {
      registros.push(
        criarRegistro({
          codigo,

          montadora:
            montadoraAtual,

          modelo:
            modeloAtual,

          motor:
            motorAtual,

          combustivel:
            combustivelAtual,

          anoInicio:
            anoInicioAtual,

          anoFim:
            anoFimAtual,

          aplicacao:
            linha,

          nomeArquivo,

          configuracao,
        })
      );
    }
  }

  const registrosUnicos =
    removerDuplicados(
      registros
    );

  console.log(
    "PRIMEIRO REGISTRO FILTROS:",
    registrosUnicos[0]
  );

  console.log(
    "BOSCH FILTROS ENCONTRADOS:",
    registros.length
  );

  console.log(
    "BOSCH FILTROS ÚNICOS:",
    registrosUnicos.length
  );

  onProgresso?.(
    `✅ Bosch Filtros: ${registrosUnicos.length} registro(s) encontrado(s).`
  );

const equivalencias =
  await parserBoschFiltrosEquivalencias({
    textoEquivalencias,
    nomeArquivo,
    configuracao,
    onProgresso,
  });
console.log(
  "TOTAL APLICAÇÕES:",
  registrosUnicos.length
);

console.log(
  "TOTAL EQUIVALÊNCIAS:",
  equivalencias.length
);

console.log(
  "EXEMPLO EQUIVALÊNCIA FINAL:",
  equivalencias.find(
    (item) =>
      item.codigo_equivalente ===
      "G5738"
  )
);
return [
  ...registrosUnicos.map(
    (registro) =>
      enriquecerRegistro(registro)
  ),
  ...equivalencias,
];
}

export default parserBoschFiltros;