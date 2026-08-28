import enriquecerRegistro from "../../inteligencia/enriquecerRegistro";
function limparTexto(valor) {
  return String(valor || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarCodigo(valor) {
  return limparTexto(valor)
    .toUpperCase()
    .replace(/[^\dA-Z]/g, "");
}

function extrairAno(texto) {
  const anos = String(texto || "").match(
    /\b(?:19|20)\d{2}\b/g
  );

  if (!anos || anos.length === 0) {
    return {
      ano_inicio: null,
      ano_fim: null,
    };
  }

  const numeros = anos
    .map(Number)
    .filter(Boolean)
    .sort((a, b) => a - b);

  return {
    ano_inicio: numeros[0] || null,
    ano_fim:
      numeros[numeros.length - 1] || null,
  };
}

function pareceMontadora(texto) {
  const montadoras = [
    "AGRALE-DEUTZ",
    "AGRALE",
    "AUDI",
    "BMW",
    "CASE",
    "CHEVROLET",
    "CITROEN",
    "CITROËN",
    "DODGE",
    "FIAT",
    "FORD",
    "HYUNDAI",
    "IVECO",
    "JOHN DEERE",
    "KIA",
    "MAN",
    "MERCEDES-BENZ",
    "MERCEDES",
    "MITSUBISHI",
    "NEW HOLLAND",
    "NISSAN",
    "PEUGEOT",
    "RENAULT",
    "SCANIA",
    "TOYOTA",
    "VOLKSWAGEN",
    "VOLVO",
  ];

  const textoMaiusculo =
    limparTexto(texto).toUpperCase();

  return montadoras.find((montadora) => {
    return (
      textoMaiusculo === montadora ||
      textoMaiusculo.startsWith(
        `${montadora} `
      )
    );
  });
}

function extrairCodigosBosch(texto) {
  const conteudo = String(texto || "")
    .toUpperCase()
    .replace(/\u00a0/g, " ")
    .replace(/[()*]/g, " ");

  const padroes = [
    // Códigos Bosch numéricos:
    // 0 445 110 231
    // 0 281 002 514
    // 1 457 432 286
    /\b[01]\s*\d{3}\s*\d{3}\s*\d{3}\b/g,

    // Códigos alfanuméricos:
    // 0 986 B03 001
    // 0 986 B01 016
    /\b[01]\s*\d{3}\s*[A-Z]\d{2}\s*\d{3}\b/g,

    // Componentes e jogos Bosch:
    // F 00 R J00 399
    // F00RJ00399
    /\bF\s*00\s*R\s*[A-Z0-9]{2,3}\s*\d{3}\b/g,
    /\bF00R[A-Z0-9]{5,7}\b/g,

    // Outros componentes Bosch:
    // F 00 N ...
    // F 00 V ...
    /\bF\s*00\s*[NV]\s*[A-Z0-9]{2,3}\s*\d{3}\b/g,
    /\bF00[NV][A-Z0-9]{5,7}\b/g,
  ];

  const encontrados = [];

  for (const padrao of padroes) {
    const resultados =
      conteudo.match(padrao) || [];

    for (const codigo of resultados) {
      const codigoNormalizado =
        normalizarCodigo(codigo);

      if (
        codigoNormalizado.length >= 9 &&
        codigoNormalizado.length <= 12
      ) {
        encontrados.push(
          codigoNormalizado
        );
      }
    }
  }

  return [...new Set(encontrados)];
}

function identificarTipoPorCodigo(
  codigo,
  texto = ""
) {
  const codigoNormalizado =
    normalizarCodigo(codigo);

  const conteudo =
    limparTexto(texto).toUpperCase();

  // Bombas Common Rail
  if (
    codigoNormalizado.startsWith("044501") ||
    codigoNormalizado.startsWith("044502") ||
    codigoNormalizado.startsWith("044503") ||
    codigoNormalizado.startsWith("044505")
  ) {
    return "Bomba de Alta Pressão Diesel";
  }

  // Galerias Common Rail
  if (
    codigoNormalizado.startsWith("044521") ||
    codigoNormalizado.startsWith("044522")
  ) {
    return "Galeria Common Rail Diesel";
  }

  // Injetores Common Rail
  if (
    codigoNormalizado.startsWith("044511") ||
    codigoNormalizado.startsWith("044512") ||
    codigoNormalizado.startsWith("044513")
  ) {
    return "Bico Injetor Common Rail Diesel";
  }

  // Bicos injetores mecânicos
  if (
    codigoNormalizado.startsWith("043317") ||
    codigoNormalizado.startsWith("043425")
  ) {
    return "Bico Injetor Diesel";
  }

  // Sensores Bosch
  if (
    codigoNormalizado.startsWith("0281")
  ) {
    if (
      conteudo.includes("ROTAÇÃO") ||
      conteudo.includes("ROTACAO")
    ) {
      return "Sensor de Rotação Diesel";
    }

    if (conteudo.includes("FASE")) {
      return "Sensor de Fase Diesel";
    }

    if (
      conteudo.includes("TEMPERATURA")
    ) {
      return "Sensor de Temperatura Diesel";
    }

    if (
      conteudo.includes("PRESSÃO") ||
      conteudo.includes("PRESSAO") ||
      conteudo.includes("RDS")
    ) {
      return "Sensor de Pressão Diesel";
    }

    return "Sensor do Sistema Diesel";
  }

  // Filtros Bosch
  if (
    codigoNormalizado.startsWith("0986B0") ||
    codigoNormalizado.startsWith("145743") ||
    codigoNormalizado.startsWith("145742") ||
    codigoNormalizado.startsWith("0450")
  ) {
    if (
      conteudo.includes("AR SECUNDÁRIO") ||
      conteudo.includes("AR SECUNDARIO")
    ) {
      return "Elemento do Filtro de Ar Secundário";
    }

    if (
      conteudo.includes("FILTRO DE AR")
    ) {
      return "Filtro de Ar Diesel";
    }

    if (
      conteudo.includes("ÓLEO") ||
      conteudo.includes("OLEO")
    ) {
      return "Filtro de Óleo Diesel";
    }

    if (
      conteudo.includes("SEPARADOR") ||
      conteudo.includes("ÁGUA") ||
      conteudo.includes("AGUA")
    ) {
      return "Filtro Separador de Água Diesel";
    }

    if (
      conteudo.includes("HIDRÁULICO") ||
      conteudo.includes("HIDRAULICO")
    ) {
      return "Filtro do Sistema Hidráulico";
    }

    if (
      conteudo.includes("REFRIGERAÇÃO") ||
      conteudo.includes("REFRIGERACAO")
    ) {
      return "Filtro de Refrigeração";
    }

    return "Filtro de Combustível Diesel";
  }

  // Jogos de reparo e componentes internos
  if (
    codigoNormalizado.startsWith("F00R") ||
    codigoNormalizado.startsWith("F00N") ||
    codigoNormalizado.startsWith("F00V")
  ) {
    return "Componente de Reparo Diesel";
  }

  return identificarTipoPorTexto(conteudo);
}

function identificarTipoPorTexto(texto) {
  const conteudo =
    String(texto || "").toUpperCase();

  if (
    conteudo.includes("PORTA INJETOR") ||
    conteudo.includes("PORTA-INJETOR")
  ) {
    return "Porta-injetor Diesel";
  }

  if (
    conteudo.includes("BOMBA DE ENGRENAGENS")
  ) {
    return "Bomba de Engrenagens Diesel";
  }

  if (
    conteudo.includes("BOMBA DE ALTA") ||
    conteudo.includes("HIGH PRESSURE")
  ) {
    return "Bomba de Alta Pressão Diesel";
  }

  if (
    conteudo.includes("BOMBA INJETORA")
  ) {
    return "Bomba Injetora Diesel";
  }

  if (
    conteudo.includes("GALERIA") ||
    conteudo.includes("RAIL")
  ) {
    return "Galeria Common Rail Diesel";
  }

  if (
    conteudo.includes("INJETOR") ||
    conteudo.includes("COMMON RAIL")
  ) {
    return "Bico Injetor Diesel";
  }

  if (
    conteudo.includes("VÁLVULA") ||
    conteudo.includes("VALVULA")
  ) {
    return "Válvula do Sistema Diesel";
  }

  if (conteudo.includes("SENSOR")) {
    return "Sensor do Sistema Diesel";
  }

  if (conteudo.includes("FILTRO")) {
    return "Filtro do Sistema Diesel";
  }

  if (
    conteudo.includes("JOGO DE REPARO") ||
    conteudo.includes("REPARO")
  ) {
    return "Jogo de Reparo Diesel";
  }

  return "Componente do Sistema Diesel";
}
function identificarMotor(
  texto = ""
) {
  const conteudo =
    limparTexto(texto);

  const padroes = [
    /\b\d\.\d\s*(?:TDI|CDI|HDi|JTD|dCi|CRDi|TDCi|D-4D|DI-D)\b/i,

    /\b\d\.\d\s*(?:V6|V8)\b/i,

    /\bMWM(?:\s+SPRINT)?(?:\s+\d\.\d)?\b/i,

    /\bCUMMINS(?:\s+ISF|\s+ISB|\s+ISC|\s+ISL|\s+ISX)?(?:\s+\d\.\d)?\b/i,

    /\bPOWER\s*STROKE(?:\s+\d\.\d)?\b/i,

    /\bDURATORQ(?:\s+\d\.\d)?\b/i,

    /\bMAXION(?:\s+\d\.\d)?\b/i,

    /\bFPT(?:\s+\d\.\d)?\b/i,

    /\bOM\s*\d{3,4}(?:\s*[A-Z]{1,3})?\b/i,

    /\b\d\.\d\s*(?:TURBO\s*)?DIESEL\b/i,

    /\b\d\.\d\b/,
  ];

  for (const padrao of padroes) {
    const encontrado =
      conteudo.match(padrao);

    if (encontrado) {
      return limparTexto(
        encontrado[0]
      );
    }
  }

  return null;
}
function identificarPotencia(
  texto = ""
) {
  const conteudo =
    limparTexto(texto);

  const encontrado =
    conteudo.match(
      /\b\d{2,4}\s*(?:CV|HP)\b/i
    );

  return encontrado
    ? limparTexto(
        encontrado[0]
      )
    : null;
}
function identificarSistemaDiesel(
  texto = ""
) {
  const conteudo =
    limparTexto(texto)
      .toUpperCase();

  const sistemas = [
    {
      nome: "Common Rail",
      termos: [
        "COMMON RAIL",
        "CRDI",
        "CRDI",
        "CDI",
        "DCI",
        "HDi",
        "JTD",
        "TDCI",
      ],
    },
    {
      nome: "VP44",
      termos: [
        "VP44",
      ],
    },
    {
      nome: "UIS",
      termos: [
        "UIS",
        "UNIT INJECTOR",
        "UNIDADE INJETORA",
      ],
    },
    {
      nome: "UPS",
      termos: [
        "UPS",
        "UNIT PUMP",
        "UNIDADE BOMBA",
      ],
    },
    {
      nome: "Bomba Rotativa",
      termos: [
        "VE",
        "BOMBA ROTATIVA",
      ],
    },
    {
      nome: "Bomba em Linha",
      termos: [
        "BOMBA EM LINHA",
        "PES",
      ],
    },
  ];

  const encontrado =
    sistemas.find(
      (sistema) =>
        sistema.termos.some(
          (termo) =>
            conteudo.includes(
              termo.toUpperCase()
            )
        )
    );

  return encontrado?.nome || null;
}
function extrairModeloDiesel(
  texto = "",
  montadora = ""
) {
  let conteudo =
    limparTexto(texto);

  const montadoraFinal =
    limparTexto(montadora);

  if (montadoraFinal) {
    conteudo =
      conteudo.replace(
        new RegExp(
          `^${montadoraFinal}\\s+`,
          "i"
        ),
        ""
      );
  }

  conteudo = conteudo
    .replace(
      /\b(?:19|20)\d{2}\b.*$/i,
      ""
    )
    .replace(
      /\b\d{2}\.\d{2}\s*(?:→|->|–|-)\s*\d{2}\.\d{2}\b.*$/i,
      ""
    )
    .replace(
      /\b[01]\s*\d{3}\s*[A-Z0-9]{3}\s*\d{3}\b.*$/i,
      ""
    )
    .replace(
      /\bF\s*00\s*[RNV]\s*[A-Z0-9]{2,3}\s*\d{3}\b.*$/i,
      ""
    )
    .trim();

  const partes =
    conteudo.split(/\s+/);

  const palavrasParada = [
    "DIESEL",
    "ELECTRONIC",
    "ELETRONIC",
    "ELETRÔNICO",
    "TCE",
    "TURBO",
    "COMMON",
    "RAIL",
    "CV",
    "HP",
  ];

  const modelo = [];

  for (const parte of partes) {
    const normalizada =
      parte
        .normalize("NFD")
        .replace(
          /[\u0300-\u036f]/g,
          ""
        )
        .toUpperCase();

    if (
      palavrasParada.includes(
        normalizada
      )
    ) {
      break;
    }

    modelo.push(parte);
  }

  const resultado =
    limparTexto(
      modelo.join(" ")
    );

  return resultado || null;
}
function extrairEquivalentesDiesel(
  texto = "",
  codigoPrincipal = ""
) {
  const encontrados =
    extrairCodigosBosch(texto);

  return encontrados
    .filter(
      (codigo) =>
        codigo !==
        normalizarCodigo(
          codigoPrincipal
        )
    )
    .join(", ");
}
function identificarFamiliaDiesel(
  tipo = ""
) {
  const texto =
    String(tipo).toUpperCase();

  if (texto.includes("BICO")) {
    return "Bicos Injetores";
  }

  if (texto.includes("BOMBA")) {
    return "Bombas";
  }

  if (texto.includes("SENSOR")) {
    return "Sensores";
  }

  if (texto.includes("VÁLVULA")) {
    return "Válvulas";
  }

  if (texto.includes("FILTRO")) {
    return "Filtros";
  }

  if (texto.includes("GALERIA")) {
    return "Common Rail";
  }

  if (texto.includes("REPARO")) {
    return "Reparo";
  }

  return "Sistema Diesel";
}
function criarRegistro({
  codigo,
  texto,
  pagina,
  origemCatalogo,
  montadora,
}) {
  const tipoPeca =
    identificarTipoPorCodigo(
      codigo,
      texto
    );

  const anos = extrairAno(texto);

 return {
  peca: tipoPeca,

  familia_catalogo:
    identificarFamiliaDiesel(
      tipoPeca
    ),

  codigo_oem: codigo,

  codigo_equivalente:
    extrairEquivalentesDiesel(
      texto,
      codigo
    ) || null,

  fabricante: "Bosch",

  origem_catalogo:
    origemCatalogo ||
    "Catálogo Bosch Diesel 2019/2020",

  montadora: montadora || null,

  modelo:
    extrairModeloDiesel(
      texto,
      montadora
    ),

  motor:
    identificarMotor(
      texto
    ),

  potencia:
    identificarPotencia(
      texto
    ),

  sistema_diesel:
    identificarSistemaDiesel(
      texto
    ),

  ano_inicio:
    anos.ano_inicio,

  ano_fim:
    anos.ano_fim,

  observacao: `Página ${pagina}. ${limparTexto(
    texto
  )}`,

  pagina_catalogo: pagina,

  ativo: true,
  prioridade: 1,
  confiabilidade: 90,
};
}
function removerDuplicados(registros) {
  const mapa = new Map();

  for (const registro of registros) {
    const chave = [
      normalizarCodigo(
        registro.codigo_oem
      ),
      limparTexto(
        registro.montadora
      ).toUpperCase(),
      limparTexto(
        registro.modelo
      ).toUpperCase(),
      registro.pagina_catalogo,
    ].join("|");

    if (!mapa.has(chave)) {
      mapa.set(chave, registro);
    }
  }

  return Array.from(mapa.values());
}

export function parserBoschDiesel({
  textoAplicacoes = "",
  paginasAplicacoes = [],
  configuracao = {},
  nomeArquivo = "",
  onProgresso,
} = {}) {
  const origemCatalogo =
    configuracao.origemCatalogo ||
    nomeArquivo ||
    "Catálogo Bosch Diesel 2019/2020";

  const paginas =
    Array.isArray(paginasAplicacoes) &&
    paginasAplicacoes.length > 0
      ? paginasAplicacoes
      : [
          {
            pagina: 1,
            numeroPagina: 1,
            texto: textoAplicacoes,
          },
        ];

  const registros = [];

  let montadoraAtual = null;

  onProgresso?.(
    "🚛 Interpretando catálogo Bosch Diesel completo..."
  );

  for (const pagina of paginas) {
    const numeroPagina =
      pagina?.pagina ||
      pagina?.numeroPagina ||
      pagina?.numero ||
      pagina?.pageNumber ||
      1;

    const textoPagina = String(
      pagina?.texto ||
        pagina?.conteudo ||
        ""
    );

    const linhas = textoPagina
      .split(/\r?\n/)
      .map(limparTexto)
      .filter(Boolean);

    for (
      let indice = 0;
      indice < linhas.length;
      indice += 1
    ) {
      const linha = linhas[indice];

      const montadoraEncontrada =
        pareceMontadora(linha);

      if (montadoraEncontrada) {
        montadoraAtual =
          montadoraEncontrada;
      }

      // Usa linhas próximas para melhorar
      // identificação do veículo e da peça.
      const linhaAnterior =
        linhas[indice - 1] || "";

      const proximaLinha =
        linhas[indice + 1] || "";

      const contexto = limparTexto(
        `${linhaAnterior} ${linha} ${proximaLinha}`
      );

      const codigos =
        extrairCodigosBosch(linha);

      if (codigos.length === 0) {
        continue;
      }

      for (const codigo of codigos) {
        registros.push(
          criarRegistro({
            codigo,
            texto: contexto,
            pagina: numeroPagina,
            origemCatalogo,
            montadora:
              montadoraAtual,
          })
        );
      }
    }
  }

  const registrosUnicos =
    removerDuplicados(registros);

  onProgresso?.(
    `✅ ${registrosUnicos.length} registros Bosch Diesel encontrados.`
  );

 return registrosUnicos.map(
  (registro) =>
    enriquecerRegistro(registro)
);
}

export default parserBoschDiesel;