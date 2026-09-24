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

import { resolverProdutosPorChave } from "./catalogos/resolverCatalogoChaves";
import {
  AVISO_CODIGO_SEM_APLICACAO,
  ehReferenciaTecnicaSemAplicacao,
  resumirApresentacaoCriarAnuncio,
} from "./importadores/referenciaTecnica";

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
    .toUpperCase()
    .replace(/\s+/g, " ");
  const compacto = normalizarCodigo(valor);
  const variantes = new Set([original, compacto].filter(Boolean));

  if (
    /^\d{10}$/.test(compacto) ||
    /^(0580|0280)\d{6}$/.test(compacto) ||
    /^F000[A-Z]{2}[A-Z0-9]{4,}$/.test(compacto)
  ) {
    variantes.add(
      [
        compacto.slice(0, 1),
        compacto.slice(1, 4),
        compacto.slice(4, 7),
        compacto.slice(7),
      ].join(" ")
    );
  }

  if (/^\d{7}$/.test(compacto)) {
    variantes.add(
      [compacto.slice(0, 1), compacto.slice(1, 4), compacto.slice(4, 7)].join(" ")
    );
  }

  /*
   * Códigos alfanuméricos gravados com espaço entre letras e números
   * (ex.: "H 300" x "H300", "AR 22U" x "AR22U"). Gera a forma com UM
   * espaço em cada fronteira letra/número (no máximo 3 fronteiras).
   */
  if (
    /^[A-Z0-9]{3,14}$/.test(compacto) &&
    /[A-Z]/.test(compacto) &&
    /\d/.test(compacto)
  ) {
    const fronteiras = [];
    for (let i = 1; i < compacto.length; i += 1) {
      const antes = /\d/.test(compacto[i - 1]);
      const depois = /\d/.test(compacto[i]);
      if (antes !== depois) fronteiras.push(i);
    }
    if (fronteiras.length <= 3) {
      for (const i of fronteiras) {
        variantes.add(`${compacto.slice(0, i)} ${compacto.slice(i)}`);
      }
    }
  }

  if (/^\d{8}$/.test(compacto)) {
    variantes.add(
      [
        compacto.slice(0, 1),
        compacto.slice(1, 4),
        compacto.slice(4, 7),
        compacto.slice(7),
      ].join(" ")
    );
  }

  return [...variantes];
}

function ehErroTecnicoPesquisa(erro) {
  if (!erro) {
    return false;
  }

  const bruto = String(erro?.message || erro || "");

  return /TIMEOUT_|statement timeout|57014|Erro técnico de pesquisa|Failed to fetch|network|fetch failed/i.test(
    bruto
  );
}

function mensagemErroTecnicoPesquisa(erro) {
  const bruto = String(erro?.message || erro || "erro desconhecido");

  if (/TIMEOUT_|statement timeout|57014/i.test(bruto)) {
    return "Erro técnico de pesquisa: a Base PAIIA excedeu o tempo de resposta. Isso não significa que o código não existe. Tente novamente.";
  }

  return `Erro técnico de pesquisa na Base PAIIA (${bruto}). Isso não significa que o código não existe. Tente novamente.`;
}

let catalogoMestreTemCodigoPrincipal = true;

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

  if (normalizarCodigo(registro?.codigo_principal) === compacto) {
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

  if (!original) {
    return false;
  }

  const normalizado =
    normalizarCodigo(
      original
    );

  if (
    normalizado.length < 4 ||
    normalizado.length > 40
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
  const formas = [...new Set((variantes || []).filter(Boolean))];
  const porOem = await supabase
    .from("catalogo_mestre")
    .select("*")
    .in("codigo_oem", formas)
    .eq("ativo", true)
    .limit(50);

  if (porOem.error) {
    throw porOem.error;
  }

  let rows = [...(porOem.data || [])];

  if (catalogoMestreTemCodigoPrincipal) {
    const porPrincipal = await supabase
      .from("catalogo_mestre")
      .select("*")
      .in("codigo_principal", formas)
      .eq("ativo", true)
      .limit(50);

    if (porPrincipal.error) {
      if (/codigo_principal/i.test(String(porPrincipal.error.message || ""))) {
        catalogoMestreTemCodigoPrincipal = false;
      } else {
        throw porPrincipal.error;
      }
    } else {
      rows = [...rows, ...(porPrincipal.data || [])];
    }
  }

  const jaNoMestre = rows.filter((registro) =>
    registroTemCodigoNormalizado(registro, compacto)
  );

  if (jaNoMestre.length > 0) {
    return jaNoMestre;
  }

  return rows.filter((registro) =>
    registroTemCodigoNormalizado(registro, compacto)
  );
}

async function consultarPecasPorCodigos(codigos) {
  const formas = [
    ...new Set(
      (codigos || [])
        .flatMap((codigo) => variantesCodigoPesquisa(codigo))
        .filter(Boolean)
    ),
  ];

  const compactosPedido = [
    ...new Set(
      (codigos || []).map((codigo) => normalizarCodigo(codigo)).filter(Boolean)
    ),
  ];

  if (!formas.length) {
    return [];
  }

  const encontrados = [];
  const vistos = new Set();

  function acumular(lista) {
    for (const registro of lista || []) {
      if (!registro?.id || vistos.has(registro.id)) {
        continue;
      }
      vistos.add(registro.id);
      encontrados.push(registro);
    }
  }

  const porOem = await supabase
    .from("catalogo_pecas")
    .select("*")
    .in("codigo_oem", formas)
    .eq("ativo", true)
    .limit(200);

  if (porOem.error) {
    throw porOem.error;
  }

  acumular(porOem.data);

  return encontrados.filter((registro) =>
    compactosPedido.some((compacto) =>
      registroTemCodigoNormalizado(registro, compacto)
    )
  );
}

/*
 * Termo com texto + código (ex.: "Bosch 0580314389", "bomba F 000 TE1 43D"):
 * remove palavras só de letras com 3+ caracteres e devolve o que sobra,
 * desde que pareça um código (tem número e 6+ caracteres normalizados).
 */
function extrairCodigoDeTextoMisto(termo) {
  const texto = limparTexto(termo);
  const partes = texto.split(" ");
  if (partes.length < 2) return "";
  const resto = partes
    .filter((parte) => !/^[A-Za-zÀ-ÿ]{3,}[.:,;]?$/.test(parte))
    .join(" ")
    .trim();
  if (!resto || resto === texto) return "";
  const compacto = normalizarCodigo(resto);
  if (compacto.length < 6 || !/\d/.test(compacto)) return "";
  return resto;
}

export async function pesquisarBaseAppia(termo) {
  const resultado = await pesquisarBaseAppiaTermo(termo);
  if (Array.isArray(resultado?.data) && resultado.data.length > 0) {
    return resultado;
  }
  const codigoExtraido = extrairCodigoDeTextoMisto(termo);
  if (!codigoExtraido) {
    return resultado;
  }
  const segundo = await pesquisarBaseAppiaTermo(codigoExtraido);
  if (Array.isArray(segundo?.data) && segundo.data.length > 0) {
    console.log("✅ Código extraído do texto pesquisado:", codigoExtraido);
    return { ...segundo, codigoExtraido };
  }
  return resultado;
}

async function pesquisarBaseAppiaTermo(
  termo
) {
  const ehCodigo =
    pareceCodigoPesquisa(
      termo
    );

  /*
   * ==========================================================
   * CÓDIGO — lookup pontual em OEM / principal / equivalente
   * Sem internet, sem ILIKE em listas gigantes e sem
   * expandir equivalentes relacionados.
   * ==========================================================
   */

  if (ehCodigo) {
    const compacto = normalizarCodigo(termo);
    const variantes = variantesCodigoPesquisa(termo);
    let erroParcial = null;
    let produtosChave = [];

    let pecas = await consultarPecasPorCodigos(variantes);

    if (pecas.length === 0) {
      try {
        produtosChave = await executarComTimeout(
          resolverProdutosPorChave(termo),
          2000,
          "CHAVES"
        );
      } catch (erro) {
        console.warn("⚠️ catalogo_chaves:", erro);
      }

      const pecasPorChave = (produtosChave || [])
        .flatMap((produto) => produto.pecas || [])
        .filter((registro) =>
          registroTemCodigoNormalizado(registro, compacto)
        );

      if (pecasPorChave.length > 0) {
        console.log(
          "✅ CÓDIGO ENCONTRADO: catalogo_chaves",
          pecasPorChave.length
        );

        return {
          data: pecasPorChave,
          tabela: "catalogo_pecas",
          error: null,
          produtosChave,
        };
      }
    }

    if (pecas.length === 0) {
      let mestres = [];

      try {
        mestres = await consultarMestrePorCodigo(compacto, variantes);
      } catch (erroMestre) {
        console.warn("⚠️ catalogo_mestre:", erroMestre);
        erroParcial = erroParcial || erroMestre;
      }

      const oemsMestre = [
        ...new Set(
          mestres.flatMap((registro) =>
            [registro.codigo_oem, registro.codigo_principal].filter(Boolean)
          )
        ),
      ];

      if (oemsMestre.length > 0) {
        pecas = await consultarPecasPorCodigos(oemsMestre);
      }
    }

    const registros = pecas.filter((registro) =>
      registroTemCodigoNormalizado(registro, compacto)
    );

    if (registros.length > 0) {
      console.log(
        "✅ CÓDIGO ENCONTRADO: Base PAIIA",
        registros.length
      );

      return {
        data: registros,
        tabela: "catalogo_pecas",
        error: null,
        produtosChave,
      };
    }

    if (erroParcial) {
      throw erroParcial;
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

  let produtosChave = [];


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

    produtosChave =
      Array.isArray(
        resultadoBase?.produtosChave
      )
        ? resultadoBase.produtosChave
        : [];

    console.info("[PAIIA_FALLBACK] 1 consulta base PAIIA", {
      codigo: termoFinal,
      encontrados: data.length,
      aplicacoesTecnicas: temAplicacoesTecnicas(data),
      tabela,
    });
  } catch (
    erroBase
  ) {
    console.warn(
      "⚠️ Base PAIIA:",
      erroBase
    );

    throw new Error(
      mensagemErroTecnicoPesquisa(
        erroBase
      )
    );
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
    if (
      error ||
      ehErroTecnicoPesquisa(
        error
      )
    ) {
      console.error(
        "❌ ERRO NA PESQUISA TÉCNICA:",
        error
      );

      throw new Error(
        mensagemErroTecnicoPesquisa(
          error
        )
      );
    }

    if (ehCodigo) {
      throw new Error(
        "Produto ainda não encontrado na Base PAIIA."
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

  const apresentacao =
    resumirApresentacaoCriarAnuncio({
      registros: resultadosComInteligencia,
      termo: termoFinal,
    });

  const registrosComAplicacao =
    resultadosComInteligencia.filter(
      (registro) =>
        !ehReferenciaTecnicaSemAplicacao(registro)
    );


  onProgresso?.(
    65,
    apresentacao.somenteNotaTecnica
      ? AVISO_CODIGO_SEM_APLICACAO
      : "📚 Catálogo localizado. Validando aplicações e equivalências..."
  );


  /*
   * ========================================================
   * ITEM PRINCIPAL
   * ========================================================
   */

  const item =
    registrosComAplicacao.find(
      (registro) =>
        registro.montadora ||
        registro.modelo ||
        registro.motor
    ) ||
    registrosComAplicacao[0] ||
    resultadosComInteligencia[0];


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


  const produtoChaveUnico =
    produtosChave.length === 1
      ? produtosChave[0]
      : null;

  const codigoPrincipal =
    produtoChaveUnico
      ?.codigo_tecnico_principal ||
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
    apresentacao.somenteNotaTecnica && apresentacao.titulo
      ? apresentacao.titulo
      : montarTitulo(
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

  const registrosParaAplicacao =
    registrosComAplicacao.length
      ? registrosComAplicacao
      : [];

  const aplicacoes =
    produtoChaveUnico
      ? consolidarAplicacoes(
          registrosParaAplicacao.filter(
            (registro) =>
              registro.origem_catalogo ===
              produtoChaveUnico.origem_catalogo
          )
        )
      : produtosChave.length > 1
        ? produtosChave.flatMap(
            (produto) =>
              consolidarAplicacoes(
                (produto.pecas || []).filter(
                  (registro) =>
                    !ehReferenciaTecnicaSemAplicacao(registro)
                )
              ).map((aplicacao) => ({
                ...aplicacao,
                origem_catalogo:
                  produto.origem_catalogo,
              }))
          )
        : consolidarAplicacoes(
            registrosParaAplicacao
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
    apresentacao.somenteNotaTecnica && apresentacao.descricao
      ? apresentacao.descricao
      : aplicacoesUnicas.length > 0
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
    produtoChaveUnico
      ? listaUnica(
          (produtoChaveUnico.equivalentes || []).map(
            (item) =>
              item.codigo_exibido ||
              item.codigo_normalizado
          )
        )
      : produtosChave.length > 1
        ? []
        : listaUnica(
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

    chaveCatalogo:
      produtoChaveUnico
        ? {
            codigo_pesquisado:
              produtoChaveUnico.codigo_pesquisado,
            tipo_chave:
              produtoChaveUnico.tipo_chave,
            marca_chave:
              produtoChaveUnico.marca_chave,
            origem_catalogo:
              produtoChaveUnico.origem_catalogo,
            codigo_tecnico_principal:
              produtoChaveUnico.codigo_tecnico_principal,
            equivalentes:
              produtoChaveUnico.equivalentes,
          }
        : null,

    produtosChave,

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
      produtoChaveUnico
        ?.codigo_tecnico_principal ||
      itemPrincipal
        .codigo_oem ||
      codigoPrincipal,

    oem:
      itemPrincipal
        .codigo_equivalente ||
      "",

    chaveCatalogo:
      baseMestre.chaveCatalogo,

    produtosChave,

    titulo,

    descricao:
      descricaoFinal,

    aplicacaoConfirmada:
      apresentacao.aplicacaoConfirmada,

    avisoAplicacao:
      apresentacao.avisoAplicacao,

    referenciasTecnicas:
      apresentacao.referenciasTecnicas,

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

      aplicacaoConfirmada:
        apresentacao.aplicacaoConfirmada,

      avisoAplicacao:
        apresentacao.avisoAplicacao,

      referenciasTecnicas:
        apresentacao.referenciasTecnicas,

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