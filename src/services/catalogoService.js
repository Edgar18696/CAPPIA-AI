import { supabase } from "../supabase";

function normalizarCodigo(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function limparTexto(valor) {
  return String(valor ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarFabricanteBusca(valor) {
  const texto =
    limparTexto(valor).toLowerCase();

  if (
    !texto ||
    texto === "catálogo" ||
    texto === "catalogo" ||
    texto === "todos" ||
    texto === "pesquisa universal" ||
    texto.includes(
      "identificado automaticamente"
    )
  ) {
    return "";
  }

  if (texto.includes("bosch")) {
    return "Bosch";
  }

  if (
    texto.includes("magneti") ||
    texto.includes("marelli")
  ) {
    return "Magneti Marelli";
  }

  if (texto.includes("renault")) {
    return "Renault";
  }

  if (
    texto.includes("fiat") ||
    texto.includes("mopar")
  ) {
    return "Fiat";
  }

  if (
    texto.includes("volkswagen") ||
    texto.includes("vw")
  ) {
    return "Volkswagen";
  }

  if (
    texto.includes("chevrolet") ||
    texto.includes("gm")
  ) {
    return "GM";
  }

  const categorias = [
    "palheta",
    "palhetas",
    "filtro",
    "filtros",
    "diesel",
    "abs",
    "sonda",
    "sondas",
    "bomba",
    "bombas",
    "bobina",
    "bobinas",
    "vela",
    "velas",
    "alternador",
    "alternadores",
    "bico",
    "bicos",
    "bateria",
    "baterias",
    "bateria moto",
    "baterias moto",
    "motocicleta",
    "motocicletas",
  ];

  if (
    categorias.some((categoria) =>
      texto.includes(categoria)
    )
  ) {
    return "";
  }

  return limparTexto(valor);
}

function separarEquivalencias(valor) {
  return String(valor ?? "")
    .split(/[,;|/]+/)
    .map((codigo) =>
      limparTexto(codigo)
    )
    .filter(Boolean);
}

function registroPossuiCodigoExato(
  registro,
  codigoPesquisado
) {
  const codigoNormalizado =
    normalizarCodigo(codigoPesquisado);

  const camposDiretos = [
    registro.codigo_oem,
    registro.codigo,
    registro.codigo_bosch,
    registro.numero_bosch,
  ];

  for (const codigo of camposDiretos) {
    const codigoRegistro =
      normalizarCodigo(codigo);

    if (!codigoRegistro) {
      continue;
    }

    if (
      codigoRegistro ===
      codigoNormalizado
    ) {
      return true;
    }
  }

  const equivalencias =
    separarEquivalencias(
      registro.codigo_equivalente
    );

  return equivalencias.some(
    (codigo) =>
      normalizarCodigo(codigo) ===
      codigoNormalizado
  );
}

function ordenarResultados(resultados) {
  return [...resultados].sort(
    (a, b) => {
      const prioridadeA =
        Number(a.prioridade) || 999;

      const prioridadeB =
        Number(b.prioridade) || 999;

      if (
        prioridadeA !==
        prioridadeB
      ) {
        return (
          prioridadeA -
          prioridadeB
        );
      }

      const confiabilidadeA =
        Number(a.confiabilidade) || 0;

      const confiabilidadeB =
        Number(b.confiabilidade) || 0;

      return (
        confiabilidadeB -
        confiabilidadeA
      );
    }
  );
}

async function carregarTabelaCompleta({
  tabela,
  fabricante,
  onProgresso,
}) {
  const tamanhoPagina = 1000;
  const registros = [];

  let inicio = 0;
  let continuar = true;
  let paginaAtual = 1;

  const fabricanteBusca =
    normalizarFabricanteBusca(
      fabricante
    );

  while (continuar) {
    onProgresso?.({
      etapa: "consultando_base",
      pagina: paginaAtual,
      tabela,
      mensagem:
        `Consultando página ${paginaAtual} de ${tabela}...`,
    });

    let consulta = supabase
      .from(tabela)
      .select("*")
      .eq("ativo", true)
      .order("id", {
        ascending: true,
      })
      .range(
        inicio,
        inicio +
          tamanhoPagina -
          1
      );

    if (fabricanteBusca) {
      consulta = consulta.ilike(
        "fabricante",
        `%${fabricanteBusca}%`
      );
    }

    const { data, error } =
      await consulta;

    if (error) {
      console.error(
        `Erro ao consultar ${tabela}:`,
        error
      );

      throw new Error(
        error.message ||
          `Não foi possível consultar ${tabela}.`
      );
    }

    const pagina =
      Array.isArray(data)
        ? data
        : [];

    registros.push(...pagina);

    continuar =
      pagina.length ===
      tamanhoPagina;

    inicio += tamanhoPagina;
    paginaAtual += 1;
  }

  console.log(
    `TOTAL CARREGADO DE ${tabela}:`,
    registros.length
  );

  return registros;
}

async function carregarCatalogoCompleto({
  fabricante,
  onProgresso,
}) {
  console.log(
    "FABRICANTE RECEBIDO NA PESQUISA:",
    fabricante
  );

  console.log(
    "FABRICANTE NORMALIZADO:",
    normalizarFabricanteBusca(
      fabricante
    ) || "SEM FILTRO"
  );

  try {
    const registrosMestre =
      await carregarTabelaCompleta({
        tabela: "catalogo_mestre",
        fabricante,
        onProgresso,
      });

    if (
      registrosMestre.length > 0
    ) {
      console.log(
        "PESQUISA UTILIZANDO: catalogo_mestre"
      );

      return registrosMestre;
    }

    console.warn(
      "catalogo_mestre sem registros. Usando catalogo_pecas."
    );
  } catch (error) {
    console.warn(
      "Falha ao consultar catalogo_mestre. Usando catalogo_pecas:",
      error
    );
  }

  const registrosCompatibilidade =
    await carregarTabelaCompleta({
      tabela: "catalogo_pecas",
      fabricante,
      onProgresso,
    });

  console.log(
    "PESQUISA UTILIZANDO: catalogo_pecas"
  );

  return registrosCompatibilidade;
}
export async function pesquisarCatalogo({
  fabricante = "",
  termo,
  onProgresso,
}) {
  const termoBusca =
    limparTexto(termo);

  if (!termoBusca) {
    return [];
  }

  const codigoNormalizado =
    normalizarCodigo(termoBusca);

  if (!codigoNormalizado) {
    return [];
  }

  const fabricanteBusca =
    normalizarFabricanteBusca(
      fabricante
    );

  onProgresso?.({
    etapa: "consultando_base_mestre",
    mensagem:
      "Localizando a peça na Base Mestre APPIA...",
  });

  console.log(
    "CÓDIGO PESQUISADO:",
    codigoNormalizado
  );

  /*
   * PRIMEIRA ETAPA
   * Localiza o código principal
   * na catalogo_mestre.
   */
  let consultaMestre = supabase
    .from("catalogo_mestre")
    .select("*")
    .or(
      `codigo_oem.ilike.%${codigoNormalizado}%,codigo_equivalente.ilike.%${codigoNormalizado}%`
    )
    .eq("ativo", true)
    .limit(100);

  if (fabricanteBusca) {
    consultaMestre =
      consultaMestre.ilike(
        "fabricante",
        `%${fabricanteBusca}%`
      );
  }

  const {
    data: dadosMestre,
    error: erroMestre,
  } = await consultaMestre;

  if (erroMestre) {
    console.error(
      "ERRO AO CONSULTAR catalogo_mestre:",
      erroMestre
    );

    throw new Error(
      erroMestre.message ||
        "Não foi possível consultar a Base Mestre."
    );
  }

  const registrosMestre =
    Array.isArray(dadosMestre)
      ? dadosMestre
      : [];

  const encontradosMestre =
    registrosMestre.filter(
      (registro) =>
        registroPossuiCodigoExato(
          registro,
          codigoNormalizado
        )
    );

  const mestreOrdenados =
    ordenarResultados(
      encontradosMestre
    );

  const registroMestre =
    mestreOrdenados[0] || null;

  if (!registroMestre) {
    onProgresso?.({
      etapa: "nao_encontrado",
      encontrados: 0,
      mensagem:
        "Código não encontrado na Base Mestre APPIA.",
    });

    return [];
  }

  const codigoPrincipal =
    normalizarCodigo(
      registroMestre.codigo_oem ||
        codigoNormalizado
    );

  console.log(
    "REGISTRO MESTRE ENCONTRADO:",
    registroMestre
  );

  console.log(
    "CÓDIGO PRINCIPAL:",
    codigoPrincipal
  );

  onProgresso?.({
    etapa: "consultando_aplicacoes",
    mensagem:
      "Carregando aplicações e compatibilidades...",
  });

  /*
   * SEGUNDA ETAPA
   * Busca todas as aplicações
   * na catalogo_pecas.
   */
  let consultaAplicacoes = supabase
    .from("catalogo_pecas")
    .select("*")
    .or(
      `codigo_oem.ilike.%${codigoPrincipal}%,codigo_equivalente.ilike.%${codigoPrincipal}%`
    )
    .eq("ativo", true)
    .limit(1000);

  if (fabricanteBusca) {
    consultaAplicacoes =
      consultaAplicacoes.ilike(
        "fabricante",
        `%${fabricanteBusca}%`
      );
  }

  const {
    data: dadosAplicacoes,
    error: erroAplicacoes,
  } = await consultaAplicacoes;

  if (erroAplicacoes) {
    console.error(
      "ERRO AO CONSULTAR catalogo_pecas:",
      erroAplicacoes
    );

    throw new Error(
      erroAplicacoes.message ||
        "Não foi possível carregar as aplicações."
    );
  }

  const registrosAplicacoes =
    Array.isArray(dadosAplicacoes)
      ? dadosAplicacoes
      : [];

  const aplicacoesEncontradas =
    registrosAplicacoes.filter(
      (registro) =>
        registroPossuiCodigoExato(
          registro,
          codigoPrincipal
        )
    );

  /*
   * Caso a peça exista na Base Mestre,
   * mas ainda não tenha aplicações,
   * retorna o próprio registro mestre.
   */
  const resultados =
    aplicacoesEncontradas.length > 0
      ? aplicacoesEncontradas
      : [registroMestre];

  const ordenados =
    ordenarResultados(
      resultados
    );

  onProgresso?.({
    etapa: "concluido",
    encontrados:
      ordenados.length,
    mensagem:
      `${ordenados.length} aplicação(ões) encontrada(s).`,
  });

  console.log(
    "APLICAÇÕES ENCONTRADAS:",
    ordenados.length
  );

 
  return ordenados.map(
    (registro) => ({
      ...registro,

      codigo:
        registro.codigo_oem ||
        registro.codigo ||
        registro.codigo_bosch ||
        registroMestre.codigo_oem ||
        "",

      equivalencias:
        registro.codigo_equivalente ||
        registroMestre.codigo_equivalente ||
        "",

      descricao:
        registro.peca ||
        registroMestre.peca ||
        "Peça automotiva",

      fabricante:
        registro.fabricante ||
        registroMestre.fabricante ||
        "",

      aplicacao: [
        registro.montadora,
        registro.modelo,
        registro.motor,

        registro.ano_inicio &&
        registro.ano_fim
          ? `${registro.ano_inicio} até ${registro.ano_fim}`
          : registro.ano_inicio
            ? `A partir de ${registro.ano_inicio}`
            : registro.ano_fim
              ? `Até ${registro.ano_fim}`
              : "",
      ]
        .filter(Boolean)
        .join(" "),

      arquivo:
        registro.origem_catalogo ||
        registroMestre.origem_catalogo ||
        "Base APPIA",

      pagina:
        registro.pagina_catalogo ||
        registro.pagina ||
        registro.pagina_origem ||
        registroMestre.pagina_catalogo ||
        registroMestre.pagina ||
        registroMestre.pagina_origem ||
        null,
    })
  );
}
export function abrirPaginaCatalogo(
  resultado
) {
  const caminho =
    resultado?.caminho ||
    resultado?.arquivo_url ||
    resultado?.url_catalogo ||
    "";

  if (!caminho) {
    alert(
      "A página original deste registro ainda não possui um PDF vinculado."
    );

    return;
  }

  const pagina = Number(
    resultado?.pagina_catalogo ||
      resultado?.pagina ||
      resultado?.pagina_origem ||
      1
  );

  window.open(
    `${caminho}#page=${pagina}`,
    "_blank",
    "noopener,noreferrer"
  );
}