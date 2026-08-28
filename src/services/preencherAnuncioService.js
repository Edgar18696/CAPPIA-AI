import { supabase } from "../supabase";

import enriquecerRegistro from "./inteligencia/enriquecerRegistro";

import {
  expandirSinonimosAutomotivos,
} from "./inteligencia";


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
 *
 * Exemplos:
 *
 * 7701047893
 * 0258003300
 * IWP066
 * 35310-04TF0
 * 028015710G
 *
 * Quando for código:
 *
 * NÃO executamos pesquisa universal pesada.
 * ============================================================
 */

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

  /*
   * Pesquisa textual com espaços
   * normalmente representa peça,
   * veículo ou descrição.
   */

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

  /*
   * Código automotivo deve possuir
   * pelo menos um número.
   */

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
 * PESQUISA EM TABELA PAIIA
 * ============================================================
 *
 * REGRA V1.0:
 *
 * CÓDIGO:
 *   somente busca exata.
 *
 * TEXTO:
 *   pode usar busca inteligente.
 *
 * Isso evita statement timeout em código OEM.
 * ============================================================
 */

async function pesquisarNaTabela({
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

  const ehCodigo =
    pareceCodigoPesquisa(
      termoPesquisa
    );

  /*
   * ========================================================
   * 1. BUSCA EXATA
   * ========================================================
   */

  const {
    data: dadosExatos,
    error: erroExato,
  } =
    await supabase
      .from(
        tabela
      )
      .select("*")
      .or(
        [
          `codigo_oem.eq.${termoPesquisa}`,
          `codigo_equivalente.eq.${termoPesquisa}`,
        ].join(",")
      )
      .eq(
        "ativo",
        true
      )
      .order(
        "prioridade",
        {
          ascending:
            true,
        }
      )
      .limit(
        100
      );

  if (
    !erroExato &&
    Array.isArray(
      dadosExatos
    ) &&
    dadosExatos.length >
      0
  ) {
    return {
      data:
        dadosExatos,

      error:
        null,
    };
  }


  /*
   * ========================================================
   * CÓDIGO NÃO ENCONTRADO
   * ========================================================
   *
   * Não dispara ILIKE universal.
   *
   * O próximo motor será CatCar.
   * ========================================================
   */

  if (
    ehCodigo
  ) {
    return {
      data: [],

      error:
        erroExato ||
        null,
    };
  }


  /*
   * ========================================================
   * 2. PESQUISA TEXTUAL
   * ========================================================
   */

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


  /*
   * Limitamos a quantidade de palavras
   * para impedir um OR gigantesco.
   */

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


  const filtros =
    [];


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


  const {
    data:
      dadosUniversais,

    error:
      erroUniversal,
  } =
    await supabase
      .from(
        tabela
      )
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
          ascending:
            true,
        }
      )
      .limit(
        100
      );


  return {
    data:
      dadosUniversais ||
      [],

    error:
      erroUniversal ||
      null,
  };
}


/*
 * ============================================================
 * BASE PAIIA
 * ============================================================
 */

async function pesquisarBaseAppia(
  termo
) {
  const resultadoAplicacoes =
    await pesquisarNaTabela({
      tabela:
        "catalogo_pecas",

      termo,
    });


  if (
    !resultadoAplicacoes
      .error &&
    resultadoAplicacoes
      .data.length >
      0
  ) {
    console.log(
      "✅ PESQUISA UTILIZANDO: catalogo_pecas"
    );

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
    await pesquisarNaTabela({
      tabela:
        "catalogo_mestre",

      termo,
    });


  if (
    !resultadoMestre
      .error &&
    resultadoMestre
      .data.length >
      0
  ) {
    console.log(
      "✅ PESQUISA UTILIZANDO: catalogo_mestre"
    );

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


  /*
   * Se uma das tabelas respondeu
   * normalmente, ausência de código
   * NÃO é erro técnico.
   */

  const erroFinal =
    resultadoAplicacoes
      .error &&
    resultadoMestre
      .error
      ? resultadoAplicacoes
          .error ||
        resultadoMestre
          .error
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
    const {
      data,
      error,
    } =
      await supabase
        .functions
        .invoke(
          "consultar-catcar",
          {
           body: {
  codigo_oem:
    codigoFinal,
},
          }
        );


    if (error) {
      console.warn(
        "⚠️ consultar-catcar:",
        error
      );

      return {
        data: [],
        error,
      };
    }


    const registros =
      Array.isArray(
        data?.registros
      )
        ? data.registros
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
      `✅ CATCAR INDEXADO: ${convertidos.length} registro(s).`
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
      "⚠️ Falha ao consultar índice CatCar:",
      erro
    );

    /*
     * CatCar é fallback.
     * Uma falha nele não derruba
     * toda a Base PAIIA.
     */

    return {
      data: [],
      error: null,
    };
  }
}


/*
 * ============================================================
 * CONVERTER CATCAR PARA PADRÃO PAIIA
 * ============================================================
 */

function converterRegistroCatcar(
  registro = {}
) {
  const descricaoOriginal =
    limparTexto(
      registro
        ?.descricao_original ||
      registro
        ?.codigo_substituto ||
      ""
    );


  const nomePeca =
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
        ?.ano_inicio ??
      null,

    ano_fim:
      registro
        ?.ano_fim ??
      null,

    observacao:
      detalhesTecnicos,

    origem_catalogo:
      "Catálogo Original Renault",

    pagina_catalogo:
      registro
        ?.pagina_url ||
      null,

    pagina:
      registro
        ?.pagina_url ||
      null,

    diagrama_url:
      registro
        ?.diagrama_url ||
      null,

    tipo:
      registro?.tipo ||
      null,

    grupo:
      registro?.grupo ||
      null,

    subgrupo:
      registro?.subgrupo ||
      null,

    posicao:
      registro?.posicao ||
      null,

    confiabilidade:
      registro
        ?.confirmado ===
        true
        ? 100
        : 90,

    ativo:
      true,

    confirmado:
      registro
        ?.confirmado ===
        true,

    origem:
      "catalogo_original",

    fonte_tecnica:
      "catalogo_original",

    inteligencia: {
      fabricante:
        "Renault",

      origem:
        "catalogo_original",
    },

    auditoria: {
      aprovado:
        registro
          ?.confirmado ===
          true,

      status:
        registro
          ?.confirmado ===
          true
          ? "APROVADO"
          : "REVISAR",

      confiabilidade:
        registro
          ?.confirmado ===
          true
          ? 100
          : 90,

      problemas: [],
    },
  };
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
    "🤖 Recebi o código. Vou iniciar a análise da peça..."
  );


  /*
   * ========================================================
   * 1. BASE PAIIA
   * ========================================================
   */

  let {
    data,
    error,
    tabela,
  } =
    await pesquisarBaseAppia(
      termoFinal
    );


  /*
   * ========================================================
   * 2. SEGUNDA TENTATIVA
   * ========================================================
   *
   * Somente quando houve ERRO real.
   *
   * Zero resultados não precisa
   * repetir a mesma consulta.
   * ========================================================
   */

  if (error) {
    console.warn(
      "⚠️ Primeira consulta à Base PAIIA falhou.",
      error
    );


    onProgresso?.(
      15,
      "🔄 A Base PAIIA demorou a responder. Tentando novamente..."
    );


    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          500
        )
    );


    const segundaTentativa =
      await pesquisarBaseAppia(
        termoFinal
      );


    data =
      segundaTentativa
        .data;


    error =
      segundaTentativa
        .error;


    tabela =
      segundaTentativa
        .tabela;
  }


  /*
   * ========================================================
   * 3. CATCAR INDEXADO
   * ========================================================
   *
   * Se for código e a Base PAIIA não encontrou,
   * consulta o índice técnico CatCar.
   * ========================================================
   */

  if (
    ehCodigo &&
    (!data ||
      data.length === 0)
  ) {
    onProgresso?.(
      25,
      "📚 Consultando catálogo técnico original..."
    );


    const resultadoCatcar =
      await pesquisarCatcarIndexado(
        termoFinal
      );


    if (
      resultadoCatcar
        .data.length >
      0
    ) {
      data =
        resultadoCatcar
          .data;

      error =
        null;

      tabela =
        "catcar_indice";
    }
  }


  /*
   * ========================================================
   * ERRO REAL
   * ========================================================
   */

  if (
    error &&
    (!data ||
      data.length === 0)
  ) {
    console.error(
      "❌ ERRO NA PESQUISA TÉCNICA:",
      error
    );


    throw new Error(
      "Erro ao consultar a base técnica da PAIIA."
    );
  }


  /*
   * ========================================================
   * NÃO ENCONTRADO
   * ========================================================
   *
   * Importante:
   *
   * Não significa que o código não existe.
   *
   * Pode ainda não estar indexado.
   * ========================================================
   */

  if (
    !data?.length
  ) {
    if (
      ehCodigo
    ) {
      throw new Error(
        `O código "${termoFinal}" ainda não possui dados técnicos confirmados na base indexada.`
      );
    }


    throw new Error(
      `Nenhum resultado foi encontrado para "${termoFinal}".`
    );
  }


  onProgresso?.(
    35,
    "🏭 Fabricante identificado. Consultando a Base Mestre PAIIA..."
  );


  /*
   * ========================================================
   * INTELIGÊNCIA
   * ========================================================
   */

  const resultadosComInteligencia =
    data.map(
      (registro) =>
        enriquecerRegistro(
          registro
        )
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


  const registroComPecaReal =
    resultadosComInteligencia
      .find(
        (registro) => {
          const nome =
            limparTexto(
              registro.peca
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
   * APLICAÇÕES
   * ========================================================
   */

  const aplicacoesDescricao =
    resultadosComInteligencia
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


          return `• ${veiculo} — ${montarPeriodo(
            registro
          )}`;
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
    aplicacoesUnicas
      .length >
    0
      ? `${descricaoBase}

APLICAÇÕES COMPLETAS:

${aplicacoesUnicas.join(
  "\n"
)}`
      : descricaoBase;


  /*
   * ========================================================
   * CONSOLIDAÇÃO
   * ========================================================
   */

  const montadoras =
    listaUnica(
      resultadosComInteligencia
        .map(
          (registro) =>
            registro.montadora
        )
    );


  const modelos =
    listaUnica(
      resultadosComInteligencia
        .map(
          (registro) =>
            registro.modelo
        )
    );


  const motores =
    listaUnica(
      resultadosComInteligencia
        .map(
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
              .origem_catalogo
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


  const aplicacoes =
    resultadosComInteligencia
      .map(
        (registro) => ({
          montadora:
            registro
              .montadora ||
            "",

          modelo:
            registro
              .modelo ||
            "",

          motor:
            registro
              .motor ||
            "",

          anoInicio:
            registro
              .ano_inicio ??
            null,

          anoFim:
            registro
              .ano_fim ??
            null,

          observacao:
            registro
              .observacao ||
            "",

          origem:
            registro
              .origem_catalogo ||
            "Base PAIIA",
        })
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

    confianca: {
      percentual:
        confiabilidade,

      nivel:
        confiabilidade >=
        80
          ? "Alta"
          : confiabilidade >=
              60
            ? "Média"
            : "Baixa",

      motivos: [],
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
    "✅ Pronto! Seu anúncio foi criado com sucesso."
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

    descricao,

    preco:
      "",

    tipoAnuncio:
      "classico",

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

      totalAplicacoes:
        aplicacoes.length,

      baseMestre,
    },

    auditoria:
      itemPrincipal
        .auditoria ||
      {
        aprovado:
          confiabilidade >=
          80,

        status:
          confiabilidade >=
          80
            ? "APROVADO"
            : "REVISAR",

        confiabilidade,

        problemas: [],
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

      aplicacoes:
        resultadosComInteligencia,

      baseMestre,

      tabela_origem:
        tabela,
    },

    resultadosCatalogo:
      resultadosComInteligencia,

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