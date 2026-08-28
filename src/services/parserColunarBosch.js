function limparTexto(valor) {
  return String(valor || "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizarCodigoBosch(valor) {
  const somenteNumeros = String(valor || "")
    .replace(/[^\d]/g, "");

  return somenteNumeros.length === 10
    ? somenteNumeros
    : null;
}

function converterAno(valor) {
  const partes = String(valor || "").match(
    /^(\d{2})\.(\d{2})$/
  );

  if (!partes) return null;

  const anoCurto = Number(partes[2]);

  return anoCurto >= 70
    ? 1900 + anoCurto
    : 2000 + anoCurto;
}

const MONTADORAS = [
  "ALFA ROMEO",
  "ASIA (ASIA MOTORS)",
  "ASIA MOTORS",
  "ASTON MARTIN",
  "AUDI",
  "BMW",
  "CHERY",
  "CHEVROLET",
  "CHRYSLER",
  "CITROËN",
  "CITROEN",
  "DAEWOO",
  "DAIHATSU",
  "DODGE",
  "FERRARI",
  "FIAT",
  "FORD",
  "GM",
  "HONDA",
  "HYUNDAI",
  "IVECO",
  "JAC",
  "JAGUAR",
  "JEEP",
  "KIA",
  "LADA",
  "LAND ROVER",
  "LEXUS",
  "MAZDA",
  "MERCEDES-BENZ",
  "MERCEDES BENZ",
  "MINI",
  "MITSUBISHI",
  "NISSAN",
  "PEUGEOT",
  "PORSCHE",
  "RENAULT",
  "SEAT",
  "SMART",
  "SSANGYONG",
  "SUBARU",
  "SUZUKI",
  "TOYOTA",
  "VOLKSWAGEN",
  "VW",
  "VOLVO",
];

function escaparRegex(valor) {
  return valor.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

const regexMontadora = new RegExp(
  `(?:^|\\s)(${[...MONTADORAS]
    .sort((a, b) => b.length - a.length)
    .map(escaparRegex)
    .join("|")})(?=\\s|$)`,
  "gi"
);

function removerCabecalhos(texto) {
  let resultado = limparTexto(texto);

  resultado = resultado
    .replace(
      /Veículo\s+Motor\s+Data de aplicação\s+Combustível\s+Pré Catalisador\s+Pós Catalisador\s+Universal Pré Catalisador\s+Universal Pós Catalisador/gi,
      " "
    )
    .replace(
      /Autopeças Bosch\s+2020\s*\|\s*2021/gi,
      " "
    )
    .replace(
      /2020\s*\|\s*2021\s+Autopeças Bosch/gi,
      " "
    )
    .replace(/\|\s*B\d+/gi, " ")
    .replace(/B\d+\s*\|/gi, " ");

  const ultimaLegenda =
    resultado.lastIndexOf(
      "(43) Suspensão esportiva"
    );

  if (ultimaLegenda !== -1) {
    resultado = resultado.slice(
      ultimaLegenda +
        "(43) Suspensão esportiva".length
    );
  }

  return limparTexto(resultado);
}

function separarModeloMotor(descricao) {
  let texto = limparTexto(descricao)
    .replace(/^[A-Z]\s+/, "")
    .replace(
      /^(ALFA ROMEO|ASIA \(ASIA MOTORS\)|ASIA MOTORS|AUDI|BMW|CHEVROLET|FIAT|FORD|HONDA|HYUNDAI|KIA|MERCEDES-BENZ|MITSUBISHI|NISSAN|PEUGEOT|RENAULT|TOYOTA|VOLKSWAGEN|VOLVO)\s+/i,
      ""
    )
    .trim();

  if (!texto) {
    return {
      modelo: null,
      motor: null,
    };
  }

  /*
   * Exemplos encontrados no catálogo:
   * AR 67199 (M8)
   * 937 A1.000 (M10)
   * CD 800
   * AAH
   * ABK
   */
  const motorMatch = texto.match(
    /\s((?:[A-Z]{1,4}\s*)?[A-Z0-9]{2,}(?:[ .-][A-Z0-9]+)*(?:\s*\(M\d+\))?)$/i
  );

  if (!motorMatch) {
    return {
      modelo: texto,
      motor: null,
    };
  }

  const modelo = texto
    .slice(0, motorMatch.index)
    .trim();

  const motor = motorMatch[1].trim();

  /*
   * Evita considerar o último pedaço do nome
   * do veículo como código de motor.
   */
  if (
    !modelo ||
    motor.length < 2 ||
    /^\d+(?:\.\d+)?$/.test(motor)
  ) {
    return {
      modelo: texto,
      motor: null,
    };
  }

  return {
    modelo,
    motor,
  };
}

function localizarMontadoras(texto) {
  const ocorrencias = [];

  regexMontadora.lastIndex = 0;

  let match;

  while (
    (match = regexMontadora.exec(texto)) !==
    null
  ) {
    const nome = match[1].toUpperCase();

    const inicioNome =
      match.index +
      match[0].lastIndexOf(match[1]);

    /*
     * Ignora listas como:
     * ALFA ROMEO, ASIA, AUDI
     */
    const depoisNome = texto
      .slice(
        inicioNome + match[1].length,
        inicioNome + match[1].length + 3
      )
      .trimStart();

    if (depoisNome.startsWith(",")) {
      continue;
    }

    ocorrencias.push({
      montadora: nome,
      inicio: inicioNome,
      fim: inicioNome + match[1].length,
    });
  }

  return ocorrencias;
}

function obterMontadoraNaPosicao(
  ocorrencias,
  posicao,
  montadoraAnterior
) {
  let montadora = montadoraAnterior;

  for (const ocorrencia of ocorrencias) {
    if (ocorrencia.inicio > posicao) {
      break;
    }

    montadora = ocorrencia.montadora;
  }

  return montadora;
}

function limparDescricaoAplicacao(
  descricao,
  montadora
) {
  let texto = limparTexto(descricao);

  texto = texto
    .replace(
      /PÁGINA\s+\d+/gi,
      " "
    )
    .replace(
      /ALFA ROMEO,\s*ASIA.*?AUDI/gi,
      " "
    )
    .replace(
      new RegExp(
        `^${escaparRegex(
          montadora || ""
        )}\\s+`,
        "i"
      ),
      ""
    );

  return limparTexto(texto);
}

function extrairRegistrosPagina(
  textoPagina,
  montadoraInicial = ""
) {
  const texto = removerCabecalhos(
    textoPagina
  );

  if (!texto) {
    return {
      registros: [],
      montadoraFinal: montadoraInicial,
    };
  }

  const montadoras =
    localizarMontadoras(texto);

  /*
   * Captura:
   * descrição + data inicial + data final +
   * combustível + sequência de códigos Bosch.
   */
  const regexAplicacao =
    /(\d{2}\.\d{2})\s*[^\dA-Za-z]{0,8}\s*(\d{2}\.\d{2})\s+(Gasolina|Gasoline|Diesel|Flex|Etanol|Álcool|Alcool|GNV)\s+((?:0\s*258\s*\d{3}\s*\d{3}(?:\(\d+\))?\s*){1,10})/gi;

  const registros = [];

  let cursor = 0;
  let match;

  let ultimaDescricaoValida = "";
  let ultimoModelo = null;
  let montadoraFinal =
    montadoraInicial;

  while (
    (match = regexAplicacao.exec(texto)) !==
    null
  ) {
    const montadora =
      obterMontadoraNaPosicao(
        montadoras,
        match.index,
        montadoraFinal
      );

    if (montadora) {
      montadoraFinal = montadora;
    }

    let descricao = texto.slice(
      cursor,
      match.index
    );

    descricao =
      limparDescricaoAplicacao(
        descricao,
        montadoraFinal
      );

    /*
     * Remove montadoras que ficaram no início
     * do bloco capturado.
     */
    for (const nome of MONTADORAS) {
      descricao = descricao.replace(
        new RegExp(
          `^${escaparRegex(nome)}\\s+`,
          "i"
        ),
        ""
      );
    }

    /*
     * Linhas de continuação podem trazer somente
     * um novo motor/período. Nesses casos, reutiliza
     * o último modelo encontrado.
     */
    if (
      descricao.length < 3 &&
      ultimaDescricaoValida
    ) {
      descricao = ultimaDescricaoValida;
    }

    const codigosBrutos =
      match[4].match(
        /0\s*258\s*\d{3}\s*\d{3}(?:\(\d+\))?/gi
      ) || [];

    const codigos = codigosBrutos
      .map((codigoBruto) => {
        const observacao =
          codigoBruto.match(
            /\((\d+)\)/
          )?.[1] || null;

        return {
          codigo:
            normalizarCodigoBosch(
              codigoBruto
            ),
          observacao,
        };
      })
      .filter((item) => item.codigo);

    if (!codigos.length) {
      cursor = regexAplicacao.lastIndex;
      continue;
    }

    let { modelo, motor } =
      separarModeloMotor(descricao);

    if (
      modelo &&
      modelo.length <= 12 &&
      /^[A-Z0-9 .()-]+$/i.test(modelo) &&
      ultimoModelo &&
      /^(AR|AAH|ABK|CD|AP|F\d|K\d|M\d|N\d|Z\d)/i.test(
        modelo
      )
    ) {
      motor = limparTexto(
        `${modelo} ${motor || ""}`
      );

      modelo = ultimoModelo;
    }

    if (modelo) {
      ultimoModelo = modelo;
      ultimaDescricaoValida = descricao;
    }

    registros.push({
      fabricante: "Bosch",
      montadora:
        montadoraFinal || null,

      modelo: modelo || ultimoModelo,

      motor: motor || null,

      descricao:
        descricao || null,

      periodo_inicio:
        match[1],

      periodo_fim:
        match[2],

      ano_inicio:
        converterAno(match[1]),

      ano_fim:
        converterAno(match[2]),

      combustivel:
        match[3],

      codigo_pre:
        codigos[0]?.codigo || null,

      codigo_pos:
        codigos[1]?.codigo || null,

      universal_pre:
        codigos[2]?.codigo || null,

      universal_pos:
        codigos[3]?.codigo || null,

      codigos_bosch: codigos,

      origem_catalogo:
        "Catálogo Bosch Sondas 2020",
    });

    cursor = regexAplicacao.lastIndex;
  }

  return {
    registros,
    montadoraFinal,
  };
}

export function parserColunarBosch(texto) {
  const textoCompleto =
    limparTexto(texto);

  if (!textoCompleto) {
    return [];
  }

  const paginas = textoCompleto
    .split(/(?=PÁGINA\s+\d+)/i)
    .map((pagina) => pagina.trim())
    .filter(Boolean);

  const registros = [];

  let montadoraAtual = "";

  for (const pagina of paginas) {
    const resultado =
      extrairRegistrosPagina(
        pagina,
        montadoraAtual
      );

    registros.push(
      ...resultado.registros
    );

    montadoraAtual =
      resultado.montadoraFinal ||
      montadoraAtual;
  }

  const unicos = new Map();

  for (const registro of registros) {
    if (
      !registro.codigo_pre &&
      !registro.codigo_pos &&
      !registro.universal_pre &&
      !registro.universal_pos
    ) {
      continue;
    }

    const chave = [
      registro.montadora,
      registro.modelo,
      registro.motor,
      registro.periodo_inicio,
      registro.periodo_fim,
      registro.codigo_pre,
      registro.codigo_pos,
      registro.universal_pre,
      registro.universal_pos,
    ].join("|");

    unicos.set(chave, registro);
  }

  return Array.from(unicos.values());
}