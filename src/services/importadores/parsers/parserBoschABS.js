import enriquecerRegistro from "../../inteligencia/enriquecerRegistro";

function limparTexto(valor = "") {
  return String(valor || "")
    .replace(/[➜]/g, " → ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarCodigoBosch(valor = "") {
  const numeros = String(valor || "")
    .replace(/\D/g, "");

  return numeros.length === 10
    ? numeros
    : "";
}

function extrairCodigoBosch(linha = "") {
  const texto = String(linha || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const encontrado = texto.match(
    /0[\s.-]*(?:265|986)[\s.-]*\d{3}[\s.-]*\d{3}/i
  )?.[0];

  if (!encontrado) {
    return "";
  }

  const codigo = encontrado.replace(/\D/g, "");

  return codigo.length === 10
    ? codigo
    : "";
}

const MONTADORAS = [
  "ALFA ROMEO",
  "AUDI",
  "BMW",
  "CHEVROLET",
  "CITROEN",
  "CITROËN",
  "FIAT",
  "FORD",
  "GM",
  "HONDA",
  "HYUNDAI",
  "IVECO",
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

function detectarMontadora(
  linha = ""
) {
  const texto =
    limparTexto(linha).toUpperCase();

  return (
    MONTADORAS.find(
      (montadora) =>
        texto === montadora
    ) || ""
  );
}

function linhaIgnorada(
  linha = ""
) {
  const texto =
    limparTexto(linha).toUpperCase();

  if (!texto) return true;

  const termos = [
    "AUTOPEÇAS BOSCH",
    "AUTOPECAS BOSCH",
    "VEÍCULO DATA DE APLICAÇÃO",
    "VEICULO DATA DE APLICACAO",
    "NÚMERO ORIGINAL",
    "NUMERO ORIGINAL",
    "INFORMAÇÕES ADICIONAIS",
    "INFORMACOES ADICIONAIS",
    "SENSOR ABS |",
    "SENSOR DE VELOCIDADE DO ABS",
    "2019 | 2020",
    "--- PÁGINA ---",
    "--- PAGINA ---",
    "PÁGINA",
    "PAGINA",
  ];

  return termos.some(
    (termo) =>
      texto.includes(termo)
  );
}

function converterAno(
  anoCurto
) {
  const numero =
    Number(anoCurto);

  if (!Number.isInteger(numero)) {
    return null;
  }

  return numero <= 40
    ? 2000 + numero
    : 1900 + numero;
}

function extrairPeriodo(
  linha = ""
) {
  const texto =
    limparTexto(linha);

  const completo =
    texto.match(
      /\b(\d{2})\.(\d{2})\s*(?:→|-|A|ATÉ)\s*(\d{2})\.(\d{2})\b/i
    );

  if (completo) {
    return {
      ano_inicio:
        converterAno(
          completo[2]
        ),

      ano_fim:
        converterAno(
          completo[4]
        ),

      texto:
        completo[0],
    };
  }

  const aberto =
    texto.match(
      /\b(\d{2})\.(\d{2})\s*(?:→|-|A|ATÉ)\b/i
    );

  if (aberto) {
    return {
      ano_inicio:
        converterAno(
          aberto[2]
        ),

      ano_fim: null,

      texto:
        aberto[0],
    };
  }

  const apenasInicio =
    texto.match(
      /\b(\d{2})\.(\d{2})\b/
    );

  if (apenasInicio) {
    return {
      ano_inicio:
        converterAno(
          apenasInicio[2]
        ),

      ano_fim: null,

      texto:
        apenasInicio[0],
    };
  }

  return {
    ano_inicio: null,
    ano_fim: null,
    texto: "",
  };
}

function escaparRegex(
  valor = ""
) {
  return String(valor).replace(
    /[-/\\^$*+?.()|[\]{}]/g,
    "\\$&"
  );
}

function extrairPrefixoVeiculo(
  linha = ""
) {
  const texto =
    limparTexto(linha);

  const periodo =
    texto.match(
      /\b\d{2}\.\d{2}\b/
    );

  if (!periodo) {
    return "";
  }

  const prefixo =
    texto.slice(
      0,
      periodo.index
    );

  return limparTexto(prefixo);
}

function extrairMotor(
  veiculo = ""
) {
  const texto =
    limparTexto(veiculo);

  const padroes = [
    /\b\d\.\d\s+(?:16V|8V|FLEX|DIESEL|TFSI|TSI|TDI|THP|HDI|CDI|JTD|TURBO|MPFI)(?:\s+[A-Z0-9-]+)*/i,

    /\b\d\.\d(?:\s*\/\s*\d\.\d)+(?:\s+[A-Z0-9-]+)*/i,

    /\b\d\.\d\b/i,

    /\b\d{2,3}\s+(?:CDI|TDI|JTD)\b/i,
  ];

  for (const padrao of padroes) {
    const encontrado =
      texto.match(padrao)?.[0];

    if (encontrado) {
      return limparTexto(
        encontrado
      );
    }
  }

  return "";
}

function extrairModelo(
  veiculo = "",
  motor = ""
) {
  let texto =
    limparTexto(veiculo);

  if (motor) {
    texto = texto.replace(
      new RegExp(
        escaparRegex(motor),
        "i"
      ),
      " "
    );
  }

  return limparTexto(texto);
}

function extrairPosicao(
  linha = ""
) {
  const texto =
    limparTexto(linha);

  const encontrado =
    texto.match(
      /\b(?:Dianteiro|Traseiro)(?:\/(?:traseiro|dianteiro))?\s+(?:esquerdo|direito)(?:\/(?:esquerdo|direito))?\b/i
    )?.[0];

  return encontrado
    ? limparTexto(encontrado)
    : "";
}

function removerCodigoBosch(
  linha,
  codigoBosch
) {
  const flexivel =
    codigoBosch
      .split("")
      .join("\\s*");

  return String(linha || "")
    .replace(
      new RegExp(
        flexivel,
        "i"
      ),
      " "
    );
}

function extrairOem({
  linha = "",
  codigoBosch = "",
  textoPeriodo = "",
  prefixoVeiculo = "",
  posicao = "",
} = {}) {
  let texto =
    limparTexto(linha);

  if (prefixoVeiculo) {
    texto = texto.replace(
      prefixoVeiculo,
      " "
    );
  }

  if (textoPeriodo) {
    texto = texto.replace(
      textoPeriodo,
      " "
    );
  }

  texto =
    removerCodigoBosch(
      texto,
      codigoBosch
    );

  if (posicao) {
    texto = texto.replace(
      posicao,
      " "
    );
  }

  texto = texto
    .replace(
      /\b(?:Com|Sem)\s+assistente.*$/i,
      " "
    )
    .replace(
      /\*Disponível.*$/i,
      " "
    )
    .replace(
      /\*Disponivel.*$/i,
      " "
    );

  return limparTexto(texto)
    .replace(/\s*\/\s*/g, " / ");
}

function ehContinuacaoVeiculo(
  linha = ""
) {
  const texto =
    limparTexto(linha);

  return /^(FLEX|DIESEL|TURBO|TFSI|TSI|TDI|THP|HDI|CDI|JTD|16V|8V|\d\.\d(?:\s+.*)?)$/i.test(
    texto
  );
}

function linhaPareceVeiculo(
  linha = ""
) {
  const texto =
    limparTexto(linha);

  if (!texto) return false;
  if (linhaIgnorada(texto)) return false;
  if (detectarMontadora(texto)) return false;
  if (extrairCodigoBosch(texto)) return false;

  if (
    /\b\d{2}\.\d{2}\b/.test(
      texto
    )
  ) {
    return false;
  }

  if (
    /^(B\d+|\d+)$/i.test(
      texto
    )
  ) {
    return false;
  }

  return texto.length <= 100;
}

function criarRegistro({
  linha,
  codigoBosch,
  montadora,
  veiculoCompleto,
  configuracao,
  nomeArquivo,
}) {
  const periodo =
    extrairPeriodo(linha);

  const prefixoVeiculo =
    extrairPrefixoVeiculo(
      linha
    );

  const veiculoFinal =
    prefixoVeiculo ||
    veiculoCompleto;

  const motor =
    extrairMotor(
      veiculoFinal
    );

  const modelo =
    extrairModelo(
      veiculoFinal,
      motor
    );

  const posicao =
    extrairPosicao(
      linha
    );

  const codigoEquivalente =
    extrairOem({
      linha,
      codigoBosch,
      textoPeriodo:
        periodo.texto,
      prefixoVeiculo,
      posicao,
    });

  return {
    fabricante: "Bosch",

    peca:
      "Sensor de Velocidade ABS",

    codigo_oem:
      codigoBosch,

    codigo_equivalente:
      codigoEquivalente,

    aplicacao: [
      montadora,
      modelo,
      motor,
    ]
      .filter(Boolean)
      .join(" "),

    montadora:
      montadora || "",

    modelo:
      modelo || "",

    motor:
      motor || "",

    combustivel: "",

    ano_inicio:
      periodo.ano_inicio,

    ano_fim:
      periodo.ano_fim,

    observacao: [
      posicao,
      limparTexto(linha),
    ]
      .filter(Boolean)
      .join(" | "),

    origem_catalogo:
      configuracao.origemCatalogo ||
      nomeArquivo ||
      "Catálogo Bosch Sensor ABS 2019-2020",

    ativo: true,

    prioridade: 1,

    confiabilidade:
      montadora &&
      modelo &&
      codigoBosch
        ? 100
        : 80,
  };
}

export async function parserBoschABS({
  textoAplicacoes = "",
  configuracao = {},
  nomeArquivo = "",
  onProgresso,
}) {
  onProgresso?.(
    "🚗 Lendo catálogo Bosch Sensor ABS..."
  );

const linhas = String(
  textoAplicacoes || ""
)
  .split(/\r?\n/)
  .map(limparTexto)
  .filter(Boolean);

console.log(
  "TEXTO ABS RECEBIDO:",
  textoAplicacoes.length
);

console.log(
  "PRIMEIRAS LINHAS ABS:",
  linhas.slice(0, 30)
);

console.log(
  "LINHAS COM CÓDIGO ABS:",
  linhas
    .filter((linha) =>
      extrairCodigoBosch(linha)
    )
    .slice(0, 20)
);
  const registros = [];

  let montadoraAtual = "";
  let veiculoAtual = "";

  for (
    let indice = 0;
    indice < linhas.length;
    indice++
  ) {
    const linha =
      linhas[indice];

    if (linhaIgnorada(linha)) {
      continue;
    }

    const montadora =
      detectarMontadora(linha);

    if (montadora) {
      montadoraAtual =
        montadora;

      veiculoAtual = "";
      continue;
    }

    const codigoBosch =
      extrairCodigoBosch(linha);

    if (codigoBosch) {
      const prefixo =
        extrairPrefixoVeiculo(
          linha
        );

      if (
        prefixo &&
        linhaPareceVeiculo(
          prefixo
        )
      ) {
        veiculoAtual =
          prefixo;
      }

      registros.push(
        criarRegistro({
          linha,
          codigoBosch,
          montadora:
            montadoraAtual,
          veiculoCompleto:
            veiculoAtual,
          configuracao,
          nomeArquivo,
        })
      );

      continue;
    }

    if (
      linhaPareceVeiculo(linha)
    ) {
      if (
        ehContinuacaoVeiculo(
          linha
        ) &&
        veiculoAtual
      ) {
        veiculoAtual =
          limparTexto(
            `${veiculoAtual} ${linha}`
          );
      } else {
        veiculoAtual =
          linha;
      }
    }
  }

 const registrosValidos =
  registros.filter(
    (registro) =>
      registro.codigo_oem
  );
  console.log(
  "TOTAL ABS EXTRAÍDOS:",
  registros.length
);

console.log(
  "TOTAL ABS VÁLIDOS:",
  registrosValidos.length
);
  onProgresso?.(
    `✅ ${registrosValidos.length} aplicações ABS encontradas.`
  );

  console.log(
    "REGISTROS ABS:",
    registrosValidos.slice(
      0,
      30
    )
  );
console.log("TOTAL LINHAS:", linhas.length);
console.log("TOTAL REGISTROS:", registros.length);

return registrosValidos.map((registro) =>
  enriquecerRegistro(registro)
);
}