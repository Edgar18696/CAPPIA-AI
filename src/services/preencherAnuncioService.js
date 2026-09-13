import { supabase } from "../supabase";

import enriquecerRegistro from "./inteligencia/enriquecerRegistro";

import {
  consultarCatCarOEM,
} from "./catcarService";

import {
  expandirSinonimosAutomotivos,
} from "./inteligencia";

import {
  FONTE_EXTERNA_PROVISORIA,
  ROTULO_FONTE_MERCADO_LIVRE,
} from "./buscaPecaInternetProvisoria";

/*
 * ============================================================
 * NORMALIZAÇÃO
 * ============================================================
 */

function limparCodigo(valor) {
  return String(
    valor ?? ""
  ).trim();
}

function normalizarCodigo(valor) {
  return String(
    valor ?? ""
  )
    .trim()
    .toUpperCase()
    .replace(
      /[^A-Z0-9]/g,
      ""
    );
}

function variantesCodigoPesquisa(valor) {
  const original = String(valor ?? "")
    .trim()
    .toUpperCase();
  const compacto = normalizarCodigo(valor);
  return [...new Set([original, compacto].filter(Boolean))];
}

function tokensEquivalentes(valor) {
  return String(valor ?? "")
    .split(/[,;|/\n]+/)
    .map((item) => normalizarCodigo(item))
    .filter(Boolean);
}

function registroTemCodigoNormalizado(registro, compacto) {
  if (!compacto) {
    return false;
  }

  if (normalizarCodigo(registro?.codigo_oem) === compacto) {
    return true;
  }

  return tokensEquivalentes(registro?.codigo_equivalente).includes(
    compacto
  );
}

function limparTexto(valor) {
  return String(
    valor ?? ""
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function limparTermoPesquisa(valor) {
  return limparTexto(
    valor
  )
    .replace(
      /[(),]/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

/*
 * ============================================================
 * IDENTIFICAR SE É CÓDIGO
 * ============================================================
 */

function temAplicacoesTecnicas(
  registros = []
) {
  if (
    !Array.isArray(
      registros
    ) ||
    registros.length === 0
  ) {
    return false;
  }

  return registros.some(
    (registro) =>
      Boolean(
        limparTexto(
          registro?.montadora
        ) ||
        limparTexto(
          registro?.modelo
        ) ||
        limparTexto(
          registro?.motor
        )
      )
  );
}

function pareceCodigoPesquisa(
  valor = ""
) {
  const original =
    String(
      valor || ""
    ).trim();

  if (
    !original ||
    original.length < 4 ||
    original.length > 40
  ) {
    return false;
  }

  if (
    /\s/.test(
      original
    )
  ) {
    return false;
  }

  const normalizado =
    normalizarCodigo(
      original
    );

  if (
    normalizado.length < 4
  ) {
    return false;
  }

  if (
    !/\d/.test(
      normalizado
    )
  ) {
    return false;
  }

  return true;
}

/*
 * ============================================================
 * LISTAS
 * ============================================================
 */

function adicionarSemRepetir(
  lista,
  valor
) {
  const texto =
    limparTexto(
      valor
    );

  if (!texto) {
    return;
  }

  const jaExiste =
    lista.some(
      (item) =>
        item.toLowerCase() ===
        texto.toLowerCase()
    );

  if (!jaExiste) {
    lista.push(
      texto
    );
  }
}

function listaUnica(
  valores = []
) {
  return [
    ...new Set(
      valores
        .map(
          (valor) =>
            limparTexto(
              valor
            )
        )
        .filter(Boolean)
    ),
  ];
}

function separarEquivalentes(
  valor
) {
  return String(
    valor || ""
  )
    .split(
      /[,;|/\n]+/
    )
    .map(
      (codigo) =>
        codigo.trim()
    )
    .filter(Boolean);
}

/*
 * ============================================================
 * TÍTULO
 * ============================================================
 */

function montarTitulo(
  item,
  codigo
) {
  const partes = [];

  adicionarSemRepetir(
    partes,
    item.peca ||
      item.familia ||
      "Peça Automotiva"
  );

  adicionarSemRepetir(
    partes,
    item.fabricante
  );

  adicionarSemRepetir(
    partes,
    item.modelo
  );

  adicionarSemRepetir(
    partes,
    item.motor
  );

  adicionarSemRepetir(
    partes,
    item.combustivel
  );

  adicionarSemRepetir(
    partes,
    codigo
  );

  return partes
    .join(" ")
    .replace(
      /\s+/g,
      " "
    )
    .trim()
    .slice(
      0,
      60
    );
}

/*
 * ============================================================
 * APLICAÇÃO
 * ============================================================
 */

function montarAplicacao(
  item
) {
  const partes = [];

  adicionarSemRepetir(
    partes,
    item.montadora
  );

  adicionarSemRepetir(
    partes,
    item.modelo
  );

  return partes
    .join(" ")
    .trim();
}

function montarPeriodo(
  item
) {
  if (
    !item.ano_inicio &&
    !item.ano_fim
  ) {
    return "Não informado";
  }

  return `${
    item.ano_inicio || "?"
  } até ${
    item.ano_fim || "Atual"
  }`;
}

/*
 * ============================================================
 * DESCRIÇÃO
 * ============================================================
 */

function montarDescricao(
  item
) {
  const nomePeca =
    String(
      item.peca ||
        item.familia ||
        "Peça Automotiva"
    ).toUpperCase();

  const fabricante =
    item.fabricante ||
    item.inteligencia
      ?.fabricante ||
    "Não informado";

  const aplicacao =
    montarAplicacao(
      item
    ) ||
    "Não informada";

  const motor =
    item.motor ||
    "Não informado";

  const periodo =
    montarPeriodo(
      item
    );

  const equivalente =
    item.codigo_equivalente ||
    "Não informado";

  const observacao =
    item.observacao ||
    "Compare o código gravado na peça original antes da compra.";

  return `
${nomePeca}

FABRICANTE:
${fabricante}

APLICAÇÃO:
${aplicacao}

MOTOR:
${motor}

ANO:
${periodo}

CÓDIGO EQUIVALENTE:
${equivalente}

OBSERVAÇÕES:
${observacao}

IMPORTANTE:
• Confirme a aplicação pelo código da peça original.
• Verifique o modelo, ano e motorização do veículo.
• Compare o conector e o formato da peça antes da compra.

CONTEÚDO DA EMBALAGEM:
• 01 peça
`.trim();
}

/*
 * ============================================================
 * PESQUISA PAIIA — ROTA RÁPIDA V1.0
 * ============================================================
 *
 * CÓDIGO:
 *   - somente igualdade exata
 *   - nunca usa ILIKE %codigo%
 *   - catalogo_pecas + catalogo_mestre em paralelo
 *
 * TEXTO:
 *   - mantém pesquisa inteligente
 * ============================================================
 */

async function executarComTimeout(
  promessa,
  tempoMs = 5000,
  nome = "consulta"
) {
  let timer;

  try {
    return await Promise.race([
      promessa,

      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              `TIMEOUT_${nome}`
            )
          );
        }, tempoMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/*
 * ============================================================
 * BUSCA EXATA DE CÓDIGO
 * ============================================================
 */

async function pesquisarCodigoExato({
  tabela,
  termo,
}) {
  const codigoOriginal =
    limparTexto(
      termo
    );

  const codigoNormalizado =
    normalizarCodigo(
      codigoOriginal
    );

  if (!codigoOriginal) {
    return {
      data: [],
      error: null,
    };
  }

  /*
   * ==========================================================
   * CONSULTA DIRETA
   * ==========================================================
   *
   * IMPORTANTE:
   *
   * Não usamos mais:
   *
   * .or(...)
   * .order("prioridade")
   *
   * Cada coluna é consultada diretamente.
   *
   * Isso permite ao PostgreSQL usar índice
   * simples de codigo_oem / codigo_equivalente.
   * ==========================================================
   */

  async function consultarCodigo(
    codigoBusca
  ) {
    if (!codigoBusca) {
      return {
        data: [],
        error: null,
      };
    }

    try {
      const [
        resultadoOem,
        resultadoEquivalente,
      ] =
        await Promise.all([
          executarComTimeout(
            supabase
              .from(
                tabela
              )
              .select("*")
              .eq(
                "codigo_oem",
                codigoBusca
              )
              .eq(
                "ativo",
                true
              )
              .limit(100),

            4500,

            `OEM_${tabela}`
          ),

          executarComTimeout(
            supabase
              .from(
                tabela
              )
              .select("*")
              .eq(
                "codigo_equivalente",
                codigoBusca
              )
              .eq(
                "ativo",
                true
              )
              .limit(100),

            4500,

            `EQUIVALENTE_${tabela}`
          ),
        ]);

      const dadosOem =
        Array.isArray(
          resultadoOem?.data
        )
          ? resultadoOem.data
          : [];

      const dadosEquivalentes =
        Array.isArray(
          resultadoEquivalente
            ?.data
        )
          ? resultadoEquivalente.data
          : [];

      /*
       * Junta resultados sem repetir registro.
       */

      const mapa =
        new Map();

      for (
        const registro
        of [
          ...dadosOem,
          ...dadosEquivalentes,
        ]
      ) {
        const chave =
          registro?.id ??
          [
            registro
              ?.codigo_oem ||
              "",
            registro
              ?.codigo_equivalente ||
              "",
            registro
              ?.montadora ||
              "",
            registro
              ?.modelo ||
              "",
            registro
              ?.motor ||
              "",
          ].join("|");

        if (
          !mapa.has(
            chave
          )
        ) {
          mapa.set(
            chave,
            registro
          );
        }
      }

      const dados = [
        ...mapa.values(),
      ];

      const erroOem =
        resultadoOem?.error ||
        null;

      const erroEquivalente =
        resultadoEquivalente
          ?.error ||
        null;

      /*
       * Se uma consulta funcionou,
       * não tratamos a outra como
       * erro geral.
       */

      const erroFinal =
        erroOem &&
        erroEquivalente
          ? erroOem
          : null;

      return {
        data:
          dados,

        error:
          erroFinal,
      };
    } catch (
      erro
    ) {
      console.warn(
        `⚠️ Consulta direta ${tabela}:`,
        erro
      );

      return {
        data: [],
        error: erro,
      };
    }
  }


  /*
   * ==========================================================
   * PRIMEIRA TENTATIVA
   * Código exatamente como digitado.
   * ==========================================================
   */

  const primeiraTentativa =
    await consultarCodigo(
      codigoOriginal
    );

  if (
    primeiraTentativa
      .data.length > 0
  ) {
    console.log(
      `✅ ${tabela}: código encontrado diretamente.`,
      codigoOriginal,
      primeiraTentativa
        .data.length
    );

    return primeiraTentativa;
  }


  /*
   * ==========================================================
   * SEGUNDA TENTATIVA
   * ==========================================================
   *
   * Só acontece quando o código
   * normalizado é realmente diferente.
   *
   * Exemplo:
   *
   * 35310-04TF0
   * 3531004TF0
   * ==========================================================
   */

  if (
    codigoNormalizado &&
    codigoNormalizado !==
      codigoOriginal
  ) {
    const segundaTentativa =
      await consultarCodigo(
        codigoNormalizado
      );

    if (
      segundaTentativa
        .data.length > 0
    ) {
      console.log(
        `✅ ${tabela}: código normalizado encontrado.`,
        codigoNormalizado,
        segundaTentativa
          .data.length
      );

      return segundaTentativa;
    }

    /*
     * Se nenhuma encontrou,
     * só devolvemos erro quando
     * as duas tentativas realmente
     * falharam tecnicamente.
     */

    return {
      data: [],

      error:
        primeiraTentativa
          .error &&
        segundaTentativa
          .error
          ? primeiraTentativa
              .error
          : null,
    };
  }


  return primeiraTentativa;
}

/*
 * ============================================================
 * PESQUISA TEXTUAL
 * ============================================================
 */

async function pesquisarTextoNaTabela({
  tabela,
  termo,
}) {
  const termoPesquisa =
    limparTermoPesquisa(
      termo
    );

  if (!termoPesquisa) {
    return {
      data: [],
      error: null,
    };
  }

  const camposPesquisa = [
    "peca",
    "fabricante",
    "montadora",
    "modelo",
    "motor",
    "observacao",
    "origem_catalogo",
  ];

  const sinonimos =
    expandirSinonimosAutomotivos(
      termoPesquisa
    );

  const palavrasPesquisa =
    Array.isArray(
      sinonimos
    )
      ? sinonimos
      : [
          termoPesquisa,
        ];

  const palavrasUnicas = [
    ...new Set(
      palavrasPesquisa
        .map(
          (palavra) =>
            limparTexto(
              palavra
            )
        )
        .filter(Boolean)
    ),
  ].slice(
    0,
    6
  );

  const filtros = [];

  for (
    const palavra
    of palavrasUnicas
  ) {
    for (
      const campo
      of camposPesquisa
    ) {
      filtros.push(
        `${campo}.ilike.%${palavra}%`
      );
    }
  }

  if (
    filtros.length === 0
  ) {
    return {
      data: [],
      error: null,
    };
  }

  try {
    const {
      data,
      error,
    } =
      await executarComTimeout(
        supabase
          .from(tabela)
          .select("*")
          .or(
            filtros.join(",")
          )
          .eq(
            "ativo",
            true
          )
          .order(
            "prioridade",
            {
              ascending: true,
            }
          )
          .limit(100),

        7000,

        `TEXTO_${tabela}`
      );

    return {
      data:
        Array.isArray(data)
          ? data
          : [],

      error:
        error || null,
    };
  } catch (erro) {
    return {
      data: [],
      error: erro,
    };
  }
}

/*
 * ============================================================
 * PESQUISA EM UMA TABELA
 * ============================================================
 */

async function pesquisarNaTabela({
  tabela,
  termo,
}) {
  if (
    pareceCodigoPesquisa(
      termo
    )
  ) {
    return pesquisarCodigoExato({
      tabela,
      termo,
    });
  }

  return pesquisarTextoNaTabela({
    tabela,
    termo,
  });
}
/*
 * ============================================================
 * BASE PAIIA
 * ============================================================
 */

async function consultarMestrePorCodigo(compacto, variantes) {
  const { data, error } = await supabase
    .from("catalogo_mestre")
    .select("*")
    .in("codigo_oem", variantes)
    .eq("ativo", true)
    .limit(50);

  if (error) {
    throw error;
  }

  let rows = Array.isArray(data) ? data : [];

  if (!rows.some((registro) => registroTemCodigoNormalizado(registro, compacto))) {
    const extra = await supabase
      .from("catalogo_mestre")
      .select("*")
      .eq("ativo", true)
      .ilike("codigo_equivalente", `%${compacto}%`)
      .limit(40);

    if (extra.error) {
      throw extra.error;
    }

    rows = [...rows, ...(extra.data || [])];
  }

  return rows.filter((registro) =>
    registroTemCodigoNormalizado(registro, compacto)
  );
}

async function consultarPecasPorCodigos(codigos) {
  const variantes = [
    ...new Set(
      (codigos || [])
        .flatMap((codigo) => variantesCodigoPesquisa(codigo))
        .filter(Boolean)
    ),
  ];

  const encontrados = [];
  const vistos = new Set();

  for (let i = 0; i < variantes.length; i += 40) {
    const lote = variantes.slice(i, i + 40);
    const { data, error } = await supabase
      .from("catalogo_pecas")
      .select("*")
      .in("codigo_oem", lote)
      .eq("ativo", true)
      .limit(300);

    if (error) {
      throw error;
    }

    for (const registro of data || []) {
      if (vistos.has(registro.id)) {
        continue;
      }
      vistos.add(registro.id);
      encontrados.push(registro);
    }
  }

  return encontrados;
}

async function pesquisarBaseAppia(
  termo
) {
  const ehCodigo =
    pareceCodigoPesquisa(
      termo
    );

  /*
   * ==========================================================
   * CÓDIGO — MESTRE → OEM/EQUIV → PECAS
   * Sem internet e sem Mercado Livre.
   * ==========================================================
   */

  if (ehCodigo) {
    const compacto = normalizarCodigo(termo);
    const variantes = variantesCodigoPesquisa(termo);

    let pecas = await consultarPecasPorCodigos(variantes);
    let mestres = [];

    try {
      mestres = await consultarMestrePorCodigo(compacto, variantes);
    } catch (erroMestre) {
      console.warn("⚠️ catalogo_mestre:", erroMestre);
    }

    const codigosRelacionados = [
      compacto,
      ...variantes,
      ...mestres.flatMap((registro) => [
        registro.codigo_oem,
        ...tokensEquivalentes(registro.codigo_equivalente),
      ]),
    ];

    if (mestres.length > 0) {
      const pecasExpandidas = await consultarPecasPorCodigos(codigosRelacionados);
      pecas = pecasExpandidas.length ? pecasExpandidas : pecas;
    }

    const compactosRelacionados = new Set(
      codigosRelacionados.map((codigo) => normalizarCodigo(codigo)).filter(Boolean)
    );

    const registros = pecas.filter((registro) => {
      const oem = normalizarCodigo(registro.codigo_oem);
      return (
        compactosRelacionados.has(oem) ||
        registroTemCodigoNormalizado(registro, compacto)
      );
    });

    if (registros.length > 0) {
      console.log(
        "✅ CÓDIGO ENCONTRADO: Base PAIIA",
        registros.length
      );

      return {
        data: registros,
        tabela: "catalogo_pecas",
        error: null,
      };
    }

    return {
      data: [],
      tabela: "catalogo_pecas",
      error: null,
    };
  }

  /*
   * ==========================================================
   * TEXTO
   * ==========================================================
   *
   * Para nome de peça, modelo,
   * veículo etc. mantemos a busca
   * textual inteligente.
   * ==========================================================
   */

  const resultadoAplicacoes =
    await pesquisarTextoNaTabela({
      tabela:
        "catalogo_pecas",

      termo,
    });

  if (
    !resultadoAplicacoes
      .error &&
    resultadoAplicacoes
      .data.length > 0
  ) {
    return {
      data:
        resultadoAplicacoes
          .data,

      tabela:
        "catalogo_pecas",

      error:
        null,
    };
  }


  const resultadoMestre =
    await pesquisarTextoNaTabela({
      tabela:
        "catalogo_mestre",

      termo,
    });

  if (
    !resultadoMestre
      .error &&
    resultadoMestre
      .data.length > 0
  ) {
    return {
      data:
        resultadoMestre
          .data,

      tabela:
        "catalogo_mestre",

      error:
        null,
    };
  }


  const erroFinal =
    resultadoAplicacoes
      .error &&
    resultadoMestre
      .error
      ? (
          resultadoAplicacoes
            .error ||
          resultadoMestre
            .error
        )
      : null;


  return {
    data: [],

    tabela:
      "catalogo_pecas",

    error:
      erroFinal,
  };
}


/*
 * ============================================================
 * CATCAR INDEXADO
 * ============================================================
 *
 * Consulta somente o índice rápido.
 *
 * NÃO dispara indexação pesada.
 * ============================================================
 */
async function pesquisarCatcarIndexado(
  codigo
) {
  const codigoFinal =
    normalizarCodigo(
      codigo
    );

  if (!codigoFinal) {
    return {
      data: [],
      error: null,
    };
  }

  try {
    const resposta =
      await consultarCatCarOEM(
        codigoFinal
      );

    if (
      resposta?.erro
    ) {
      console.warn(
        "⚠️ CatCar local:",
        resposta.erro
      );

      return {
        data: [],
        error: null,
      };
    }

    const registros =
      Array.isArray(
        resposta?.registros
      )
        ? resposta.registros
        : [];

    if (
      registros.length ===
      0
    ) {
      return {
        data: [],
        error: null,
      };
    }

    const convertidos =
      registros.map(
        converterRegistroCatcar
      );

    console.log(
      `✅ CATCAR LOCAL: ${convertidos.length} registro(s).`
    );

    return {
      data:
        convertidos,

      error:
        null,
    };
  } catch (
    erro
  ) {
    console.warn(
      "⚠️ Falha ao consultar CatCar local:",
      erro
    );

    /*
     * CatCar continua sendo fallback.
     * Se ele falhar, não derruba
     * toda a Base PAIIA.
     */

    return {
      data: [],
      error: null,
    };
  }
}
function converterRegistroCatcar(
  registro = {}
) {
  const codigoSubstituto =
    limparTexto(
      registro
        ?.codigo_substituto ||
      ""
    );

  const descricaoOriginal =
    limparTexto(
      registro
        ?.descricao_original ||
      ""
    );

  const nomePeca =
    codigoSubstituto ||
    descricaoOriginal ||
    "Peça Automotiva";

  const detalhesTecnicos = [
    registro?.tipo
      ? `Tipo: ${registro.tipo}`
      : "",

    registro?.grupo
      ? `Grupo: ${registro.grupo}`
      : "",

    registro?.subgrupo
      ? `Subgrupo: ${registro.subgrupo}`
      : "",

    registro?.posicao
      ? `Posição: ${registro.posicao}`
      : "",

    descricaoOriginal
      ? `Descrição: ${descricaoOriginal}`
      : "",

    registro?.observacao ||
      "",
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    codigo_oem:
      registro
        ?.codigo_oem ||
      "",

    codigo_equivalente:
      "",

    peca:
      nomePeca,

    familia:
      nomePeca,

    fabricante:
      "Renault",

    montadora:
      limparTexto(
        registro
          ?.montadora ||
        "Renault"
      ),

    modelo:
      limparTexto(
        registro
          ?.modelo ||
        ""
      ),

    motor:
      limparTexto(
        registro
          ?.motor ||
        ""
      ),

    cambio:
      limparTexto(
        registro
          ?.cambio ||
        ""
      ),

    ano_inicio:
      registro
        ?.ano_inicio ||
      null,

    ano_fim:
      registro
        ?.ano_fim ||
      null,

    combustivel:
      limparTexto(
        registro
          ?.combustivel ||
        ""
      ),

    observacao:
      detalhesTecnicos,

    origem_catalogo:
      "CatCar Renault",

    arquivo_catalogo:
      "",

    pagina_catalogo:
      registro
        ?.pagina_url ||
      registro
        ?.pagina_catalogo ||
      null,

    prioridade:
      1,

    ativo:
      true,

    fonte_tecnica:
      "catcar",

    confirmado:
      registro
        ?.confirmado !==
      false,

    catcar:
      {
        catalogo:
          registro
            ?.catalogo ||
          "",

        veiculo:
          registro
            ?.veiculo ||
          "",

        grupo:
          registro
            ?.grupo ||
          "",

        subgrupo:
          registro
            ?.subgrupo ||
          "",

        posicao:
          registro
            ?.posicao ||
          "",

        url_origem:
          registro
            ?.pagina_url ||
          registro
            ?.url_origem ||
          "",

        imagem_diagrama:
          registro
            ?.diagrama_url ||
          registro
            ?.imagem_diagrama ||
          "",
      },
  };
}


/*
 * ============================================================
 * CONSOLIDAR APLICAÇÕES
 * ============================================================
 */

function consolidarAplicacoes(
  registros = []
) {
  const mapa =
    new Map();


  for (
    const registro
    of registros
  ) {
    const montadora =
      limparTexto(
        registro?.montadora
      );

    const modelo =
      limparTexto(
        registro?.modelo
      );

    const motor =
      limparTexto(
        registro?.motor
      );

    const anoInicio =
      registro
        ?.ano_inicio ??
      registro
        ?.anoInicio ??
      null;

    const anoFim =
      registro
        ?.ano_fim ??
      registro
        ?.anoFim ??
      null;

    const observacao =
      limparTexto(
        registro
          ?.observacao
      );

    const origem =
      limparTexto(
        registro
          ?.origem_catalogo ||
        registro
          ?.origem
      );


    /*
     * Não criamos aplicação vazia.
     */

    if (
      !montadora &&
      !modelo &&
      !motor
    ) {
      continue;
    }


    const chave =
      [
        montadora,
        modelo,
        motor,
        anoInicio || "",
        anoFim || "",
      ]
        .map(
          (valor) =>
            String(
              valor ?? ""
            )
              .trim()
              .toLowerCase()
        )
        .join("|");


    if (
      mapa.has(
        chave
      )
    ) {
      continue;
    }


    mapa.set(
      chave,
      {
        montadora,
        modelo,
        motor,

        /*
         * Mantemos os dois formatos
         * para compatibilidade com
         * telas antigas e novas.
         */

        ano_inicio:
          anoInicio,

        ano_fim:
          anoFim,

        anoInicio,
        anoFim,

        observacao,

        origem,

        origem_catalogo:
          origem,

        nivelConcordancia:
          registro
            ?.nivelConcordancia ||
          "",
      }
    );
  }


  return [
    ...mapa.values(),
  ];
}
/*
 * ============================================================
 * PREENCHER ANÚNCIO AUTOMATICAMENTE
 * ============================================================
 */

export async function preencherAnuncioAutomaticamente({
  termo,
  codigo,
  oem,
  onProgresso,
  permitirBuscaInternet = false,
}) {
  const termoFinal =
    limparCodigo(
      termo ||
      codigo ||
      oem
    );


  if (!termoFinal) {
    throw new Error(
      "Digite um código, peça, veículo, modelo ou motor."
    );
  }


  const ehCodigo =
    pareceCodigoPesquisa(
      termoFinal
    );


  onProgresso?.(
    10,
    ehCodigo
      ? "🔎 Pesquisando código na Base PAIIA..."
      : "🔎 Pesquisando peça na Base PAIIA..."
  );


  /*
   * ========================================================
   * 1. BASE PAIIA — ROTA RÁPIDA
   * ========================================================
   */

  let data = [];

  let error = null;

  let tabela =
    "catalogo_pecas";


  try {
    const resultadoBase =
      await executarComTimeout(
        pesquisarBaseAppia(
          termoFinal
        ),

        ehCodigo
          ? 12000
          : 8000,

        "BASE_PAIIA"
      );


    data =
      Array.isArray(
        resultadoBase?.data
      )
        ? resultadoBase.data
        : [];


    error =
      resultadoBase?.error ||
      null;


    tabela =
      resultadoBase?.tabela ||
      "catalogo_pecas";

    console.info("[PAIIA_FALLBACK] 1 consulta base PAIIA", {
      codigo: termoFinal,
      encontrados: data.length,
      aplicacoesTecnicas: temAplicacoesTecnicas(data),
      tabela,
    });

    if (
      ehCodigo &&
      !temAplicacoesTecnicas(data)
    ) {
      data = [];
    }
  } catch (
    erroBase
  ) {
    console.warn(
      "⚠️ Base PAIIA:",
      erroBase
    );


    data = [];

    error =
      erroBase;
  }


  /*
   * ========================================================
   * 2. CATCAR — SOMENTE FALLBACK
   * ========================================================
   *
   * Só entra aqui se:
   *
   * - for código
   * - Base PAIIA não encontrou
   *
   * Código existente na base
   * NÃO espera CatCar.
   * ========================================================
   */

  if (
    ehCodigo &&
    data.length === 0
  ) {
    console.info("[PAIIA] identificação técnica só Base PAIIA", {
      codigo: termoFinal,
      encontrados: 0,
    });
  }


  /*
   * ========================================================
   * 3. MERCADO LIVRE — FORA DA IDENTIFICAÇÃO TÉCNICA
   * ========================================================
   *
   * A consulta por código responde só com Base PAIIA / CatCar.
   * Preço, concorrência e anúncios continuam nos fluxos comerciais.
   * ========================================================
   */

  console.info("[PAIIA_FALLBACK] 3 Mercado Livre fora da busca técnica", {
    codigo: termoFinal,
    chamarMercadoLivre: false,
    encontradosNaBase: data.length,
  });


  /*
   * ========================================================
   * 4. SEM RESULTADO
   * ========================================================
   */

  if (
    data.length === 0
  ) {
    if (ehCodigo) {
      throw new Error(
        "Produto ainda não encontrado na Base PAIIA."
      );
    }

    if (error) {
      console.error(
        "❌ ERRO NA PESQUISA TÉCNICA:",
        error
      );

      throw new Error(
        "A base técnica demorou a responder. Tente novamente."
      );
    }

    throw new Error(
      `Nenhum resultado foi encontrado para "${termoFinal}".`
    );
  }


  onProgresso?.(
    35,
    tabela === FONTE_EXTERNA_PROVISORIA
      ? "🌐 Anúncios do Mercado Livre localizados. Cruzando tipo e fabricante..."
      : "🏭 Código localizado. Preparando dados do anúncio..."
  );


  /*
   * ========================================================
   * INTELIGÊNCIA
   * ========================================================
   */

  const resultadosComInteligencia =
    tabela === FONTE_EXTERNA_PROVISORIA
      ? data
      : data.map((registro) =>
          enriquecerRegistro(registro)
        );


  onProgresso?.(
    65,
    "📚 Catálogo localizado. Validando aplicações e equivalências..."
  );


  /*
   * ========================================================
   * ITEM PRINCIPAL
   * ========================================================
   */

  const item =
    resultadosComInteligencia
      .find(
        (registro) =>
          registro.montadora ||
          registro.modelo ||
          registro.motor
      ) ||
    resultadosComInteligencia[
      0
    ];


  if (!item) {
    throw new Error(
      "A peça foi localizada, mas os dados técnicos não puderam ser processados."
    );
  }


  const registroComPecaReal =
    resultadosComInteligencia
      .find(
        (registro) => {
          const nome =
            limparTexto(
              registro?.peca
            ).toLowerCase();


          return (
            nome &&
            nome !==
              "peça automotiva" &&
            nome !==
              "peca automotiva"
          );
        }
      );


  const pecaReal =
    registroComPecaReal
      ?.peca ||
    item.peca ||
    item.familia ||
    "Peça Automotiva";


  const codigoPrincipal =
    item.codigo_oem ||
    item.codigo_equivalente ||
    termoFinal;


  const itemPrincipal = {
    ...item,

    peca:
      pecaReal,
  };


  /*
   * ========================================================
   * TÍTULO
   * ========================================================
   */

  const titulo =
    montarTitulo(
      itemPrincipal,
      codigoPrincipal
    );


  /*
   * ========================================================
   * COMPATIBILIDADES / APLICAÇÕES
   * ========================================================
   *
   * Esta é a lista oficial usada
   * por todo o anúncio.
   *
   * consolidarAplicacoes()
   * já devolve:
   *
   * ano_inicio / ano_fim
   * e
   * anoInicio / anoFim
   *
   * para manter compatibilidade
   * com as telas antigas e novas.
   * ========================================================
   */

  const aplicacoes =
    consolidarAplicacoes(
      resultadosComInteligencia
    );


  /*
   * ========================================================
   * TEXTO DAS APLICAÇÕES
   * ========================================================
   */

  const aplicacoesDescricao =
    aplicacoes
      .map(
        (registro) => {
          const veiculo = [
            registro.montadora,
            registro.modelo,
            registro.motor,
          ]
            .filter(Boolean)
            .join(" ");


          if (!veiculo) {
            return null;
          }


          const periodo =
            montarPeriodo({
              ano_inicio:
                registro.ano_inicio,

              ano_fim:
                registro.ano_fim,
            });

          if (tabela === FONTE_EXTERNA_PROVISORIA) {
            const linha = [
              registro.montadora || "A confirmar",
              registro.modelo || "A confirmar",
              registro.motor || "A confirmar",
              periodo && periodo !== "Não informado"
                ? periodo
                : "A confirmar",
            ].join(" | ");

            const prefixo =
              registro.nivelConcordancia === "confirmado"
                ? "CONFIRMADO"
                : "ENCONTRADO NO MERCADO LIVRE — A CONFIRMAR";

            return `${prefixo} · ${linha}`;
          }

          return `• ${veiculo} — ${periodo}`;
        }
      )
      .filter(Boolean);


  const aplicacoesUnicas =
    listaUnica(
      aplicacoesDescricao
    );


  /*
   * ========================================================
   * DESCRIÇÃO
   * ========================================================
   */

  const descricaoBase =
    montarDescricao(
      itemPrincipal
    );


  const descricao =
    aplicacoesUnicas.length > 0
      ? `${descricaoBase}

APLICAÇÕES COMPLETAS:

${aplicacoesUnicas.join(
  "\n"
)}`
      : descricaoBase;


  const fonteProvisoria =
    tabela === FONTE_EXTERNA_PROVISORIA;

  const descricaoFinal = fonteProvisoria
    ? `⚠️ Mercado Livre — dados provisórios
Fonte: Mercado Livre — dados provisórios
Auditoria: REVISAR
Não gravar no catálogo mestre nem em catalogo_pecas.

CONFIRMADO = coincidiu em mais de um anúncio.
ENCONTRADO NO MERCADO LIVRE — A CONFIRMAR = apareceu em um anúncio ou sem concordância suficiente.

${descricao}`
    : descricao;

  const problemasAuditoria = fonteProvisoria
    ? [
        "Resultado provisório. Confirme fabricante, descrição, OEM e aplicações antes de publicar.",
      ]
    : [];

  /*
   * ========================================================
   * CONSOLIDAÇÃO
   * ========================================================
   */

  const montadoras =
    listaUnica(
      aplicacoes.map(
        (registro) =>
          registro.montadora
      )
    );


  const modelos =
    listaUnica(
      aplicacoes.map(
        (registro) =>
          registro.modelo
      )
    );


  const motores =
    listaUnica(
      aplicacoes.map(
        (registro) =>
          registro.motor
      )
    );


  const fontes =
    listaUnica(
      resultadosComInteligencia
        .map(
          (registro) =>
            registro
              .origem_catalogo ||
            registro
              .origem
        )
    );


  const equivalentes =
    listaUnica(
      resultadosComInteligencia
        .flatMap(
          (registro) =>
            separarEquivalentes(
              registro
                .codigo_equivalente
            )
        )
    );


  const confiabilidade =
    Number(
      item.confiabilidade
    ) || 0;


  /*
   * ========================================================
   * BASE MESTRE
   * ========================================================
   */

  const baseMestre = {
    codigoOriginal:
      termoFinal,

    codigoPrincipal,

    codigoNormalizado:
      String(
        codigoPrincipal
      )
        .replace(
          /[^a-zA-Z0-9]/g,
          ""
        )
        .toUpperCase(),

    peca:
      pecaReal,

    fabricante:
      item.fabricante ||
      item.inteligencia
        ?.fabricante ||
      "Não informado",

    familia:
      item.familia ||
      pecaReal,

    equivalentes,

    montadoras,

    modelos,

    motores,

    aplicacoes,

    fontes,

    totalRegistros:
      resultadosComInteligencia
        .length,

    totalAplicacoes:
      aplicacoes.length,

    confianca: {
      percentual:
        fonteProvisoria
          ? Math.min(confiabilidade, 35)
          : confiabilidade,

      nivel:
        fonteProvisoria
          ? "Baixa"
          : confiabilidade >=
            80
            ? "Alta"
            : confiabilidade >=
                60
              ? "Média"
              : "Baixa",

      motivos: fonteProvisoria
        ? [
            "Fonte provisória. Aguardando confirmação no catálogo confiável PAIIA.",
          ]
        : [],
    },
  };


  /*
   * ========================================================
   * FINALIZAÇÃO
   * ========================================================
   */

  onProgresso?.(
    95,
    "📝 Estou montando seu anúncio automaticamente..."
  );


  onProgresso?.(
    100,
    fonteProvisoria
      ? "⚠️ Sugestão provisória montada. Confirme os dados antes de publicar."
      : "✅ Pronto! Seu anúncio foi criado com sucesso."
  );


  /*
   * ========================================================
   * RETORNO
   * ========================================================
   */

  return {
    codigo:
      itemPrincipal
        .codigo_oem ||
      codigoPrincipal,

    oem:
      itemPrincipal
        .codigo_equivalente ||
      "",

    titulo,

    descricao:
      descricaoFinal,

    preco:
      "",

    tipoAnuncio:
      "classico",

    fonte:
      fonteProvisoria
        ? FONTE_EXTERNA_PROVISORIA
        : tabela,

    catalogoInterno:
      !fonteProvisoria &&
      tabela !== "catcar_indice",

    fallbackExterno:
      fonteProvisoria,

    totalAnunciosMercadoLivre: 0,


    diagnostico: {
      ...(
        itemPrincipal
          .diagnostico ||
        {}
      ),

      codigoPrincipal,

      peca:
        pecaReal,

      fabricante:
        baseMestre
          .fabricante,

      montadoras,

      modelos,

      motores,

      equivalentes,

      aplicacoes,

      totalAplicacoes:
        aplicacoes.length,

      arquivoCatalogo:
        fonteProvisoria
          ? ROTULO_FONTE_MERCADO_LIVRE
          : itemPrincipal
              .origem_catalogo ||
            "Base PAIIA",

      paginaCatalogo:
        itemPrincipal
          .pagina_catalogo ||
          itemPrincipal
            .pagina ||
          null,

      fonteProvisoria,

      dadosAConfirmar:
        fonteProvisoria,

      baseMestre,
    },


    auditoria:
      itemPrincipal
        .auditoria ||
      {
        aprovado:
          fonteProvisoria
            ? false
            : confiabilidade >=
              80,

        status:
          fonteProvisoria ||
          confiabilidade < 80
            ? "REVISAR"
            : "APROVADO",

        confiabilidade:
          fonteProvisoria
            ? Math.min(confiabilidade, 35)
            : confiabilidade,

        problemas:
          problemasAuditoria,
      },


    inteligencia:
      itemPrincipal
        .inteligencia ||
      null,


    baseMestre,


    pecaEncontrada: {
      ...itemPrincipal,

      peca:
        pecaReal,

      fabricante:
        baseMestre
          .fabricante,

      /*
       * IMPORTANTE:
       *
       * Aqui entram as aplicações
       * normalizadas, e não mais
       * os registros brutos.
       */

      aplicacoes,

      baseMestre,

      tabela_origem:
        tabela,

      fonte_provisoria:
        fonteProvisoria,
    },


    /*
     * Mantemos os registros completos
     * para diagnóstico técnico.
     */

    resultadosCatalogo:
      resultadosComInteligencia,


    /*
     * E disponibilizamos também
     * diretamente as compatibilidades
     * normalizadas.
     */

    aplicacoes,


    resultadoPrincipal: {
      arquivo:
        itemPrincipal
          .origem_catalogo ||
        "Base PAIIA",

      pagina:
        itemPrincipal
          .pagina_catalogo ||
        itemPrincipal
          .pagina ||
        null,

      tabela,
    },
  };
}