import { supabase } from "../supabase";

/*
 * ============================================================
 * PAIIA — BUSCA OFICIAL DE APLICAÇÕES
 * ============================================================
 *
 * REGRA:
 *
 * 1. catalogo_pecas
 * 2. catalogo_aplicacoes
 * 3. catalogo_mestre
 *
 * Código OEM:
 *   igualdade exata
 *
 * Código equivalente:
 *   igualdade exata primeiro
 *   busca contida somente como fallback
 *
 * Nunca devolve registro sem aplicação veicular.
 * ============================================================
 */

function limparCodigo(valor = "") {
  return String(valor || "")
    .trim()
    .toUpperCase();
}

function normalizarCodigo(valor = "") {
  return limparCodigo(valor)
    .replace(/[^A-Z0-9]/g, "");
}

function gerarVariantesCodigo(valor = "") {
  const original =
    limparCodigo(valor);

  const normalizado =
    normalizarCodigo(valor);

  const variantes =
    new Set();

  if (original) {
    variantes.add(original);
  }

  if (normalizado) {
    variantes.add(normalizado);
  }

  /*
   * Bosch:
   *
   * 0258003300
   * 0 258 003 300
   */
  if (
    /^\d{10}$/.test(
      normalizado
    ) &&
    normalizado.startsWith("0")
  ) {
    variantes.add(
      [
        normalizado.slice(0, 1),
        normalizado.slice(1, 4),
        normalizado.slice(4, 7),
        normalizado.slice(7, 10),
      ].join(" ")
    );
  }

  return Array.from(
    variantes
  ).filter(Boolean);
}

/*
 * ============================================================
 * APLICAÇÃO REAL
 * ============================================================
 */

function possuiAplicacaoVeicular(
  registro
) {
  return Boolean(
    String(
      registro?.montadora || ""
    ).trim() ||
    String(
      registro?.modelo || ""
    ).trim() ||
    String(
      registro?.motor || ""
    ).trim()
  );
}

/*
 * ============================================================
 * CONFIRMAR CÓDIGO
 * ============================================================
 */

function separarCodigos(valor) {
  if (
    valor === null ||
    valor === undefined
  ) {
    return [];
  }

  if (Array.isArray(valor)) {
    return valor
      .flatMap(separarCodigos)
      .filter(Boolean);
  }

  if (
    typeof valor === "object"
  ) {
    return Object
      .values(valor)
      .flatMap(separarCodigos)
      .filter(Boolean);
  }

  return String(valor)
    .split(
      /[,;|/\n\r\s]+/
    )
    .map(normalizarCodigo)
    .filter(Boolean);
}

function registroTemCodigo(
  registro,
  codigoPesquisado
) {
  const procurado =
    normalizarCodigo(
      codigoPesquisado
    );

  if (!procurado) {
    return false;
  }

  const campos = [
    registro?.codigo_oem,
    registro?.codigo_equivalente,
    registro?.codigo,
    registro?.codigo_bosch,
    registro?.codigo_fabricante,
    registro?.codigo_marelli,
    registro
      ?.codigo_magneti_marelli,
  ];

  for (
    const campo
    of campos
  ) {
    const codigos =
      separarCodigos(campo);

    if (
      codigos.some(
        (codigo) =>
          codigo === procurado
      )
    ) {
      return true;
    }
  }

  /*
   * Alguns catálogos antigos armazenaram
   * equivalentes concatenados sem separação
   * consistente.
   *
   * Permitimos contains somente depois
   * da normalização.
   */

  const equivalenteNormalizado =
    normalizarCodigo(
      registro?.codigo_equivalente ||
      ""
    );

  if (
    equivalenteNormalizado &&
    equivalenteNormalizado.includes(
      procurado
    )
  ) {
    return true;
  }

  return false;
}

/*
 * ============================================================
 * REMOVER DUPLICADOS
 * ============================================================
 */

function removerDuplicados(
  registros = [],
  codigo
) {
  const mapa =
    new Map();

  for (
    const registro
    of registros
  ) {
    if (!registro) {
      continue;
    }

    if (
      !possuiAplicacaoVeicular(
        registro
      )
    ) {
      continue;
    }

    if (
      !registroTemCodigo(
        registro,
        codigo
      )
    ) {
      continue;
    }

    const chave = [
      registro?.montadora || "",
      registro?.modelo || "",
      registro?.motor || "",
      registro?.ano_inicio ?? "",
      registro?.ano_fim ?? "",
      registro?.combustivel || "",
    ]
      .map(
        (valor) =>
          String(
            valor ?? ""
          )
            .trim()
            .toUpperCase()
      )
      .join("|");

    if (
      !mapa.has(chave)
    ) {
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

/*
 * ============================================================
 * OEM EXATO
 * ============================================================
 */

async function buscarOemExato(
  tabela,
  variantes
) {
  if (!variantes.length) {
    return [];
  }

  try {
    const {
      data,
      error,
    } =
      await supabase
        .from(tabela)
        .select("*")
        .in(
          "codigo_oem",
          variantes
        )
        .eq(
          "ativo",
          true
        )
        .limit(300);

    if (error) {
      console.warn(
        `⚠️ ${tabela} OEM:`,
        error
      );

      return [];
    }

    return Array.isArray(data)
      ? data
      : [];
  } catch (erro) {
    console.warn(
      `⚠️ Falha OEM ${tabela}:`,
      erro
    );

    return [];
  }
}

/*
 * ============================================================
 * EQUIVALENTE EXATO
 * ============================================================
 */

async function buscarEquivalenteExato(
  tabela,
  variantes
) {
  const encontrados = [];

  for (
    const variante
    of variantes
  ) {
    try {
      const {
        data,
        error,
      } =
        await supabase
          .from(tabela)
          .select("*")
          .eq(
            "codigo_equivalente",
            variante
          )
          .eq(
            "ativo",
            true
          )
          .limit(300);

      if (error) {
        console.warn(
          `⚠️ ${tabela} equivalente exato:`,
          error
        );

        continue;
      }

      if (
        Array.isArray(data)
      ) {
        encontrados.push(
          ...data
        );
      }
    } catch (erro) {
      console.warn(
        `⚠️ Falha equivalente ${tabela}:`,
        erro
      );
    }
  }

  return encontrados;
}

/*
 * ============================================================
 * EQUIVALENTE CONTIDO
 * ============================================================
 *
 * IMPORTANTE:
 *
 * Esta busca acontece SOMENTE quando as buscas
 * exatas não produziram aplicações.
 *
 * Ela é necessária porque catálogos antigos
 * possuem vários códigos dentro do mesmo campo.
 * ============================================================
 */

async function buscarEquivalenteContido(
  tabela,
  codigo
) {
  const codigoNormalizado =
    normalizarCodigo(codigo);

  if (!codigoNormalizado) {
    return [];
  }

  try {
    const {
      data,
      error,
    } =
      await supabase
        .from(tabela)
        .select("*")
        .ilike(
          "codigo_equivalente",
          `%${codigoNormalizado}%`
        )
        .eq(
          "ativo",
          true
        )
        .limit(300);

    if (error) {
      console.warn(
        `⚠️ ${tabela} equivalente contido:`,
        error
      );

      return [];
    }

    return Array.isArray(data)
      ? data
      : [];
  } catch (erro) {
    console.warn(
      `⚠️ Falha equivalente contido ${tabela}:`,
      erro
    );

    return [];
  }
}

/*
 * ============================================================
 * BUSCAR EM UMA TABELA
 * ============================================================
 */

async function buscarNaTabela(
  tabela,
  codigo
) {
  const variantes =
    gerarVariantesCodigo(
      codigo
    );

  /*
   * OEM + equivalente exatos
   * podem rodar juntos.
   */

  const [
    registrosOem,
    registrosEquivalentes,
  ] =
    await Promise.all([
      buscarOemExato(
        tabela,
        variantes
      ),

      buscarEquivalenteExato(
        tabela,
        variantes
      ),
    ]);

  const exatos =
    removerDuplicados(
      [
        ...registrosOem,
        ...registrosEquivalentes,
      ],
      codigo
    );

  if (
    exatos.length > 0
  ) {
    console.log(
      `✅ ${tabela}: aplicações exatas`,
      exatos.length
    );

    return exatos;
  }

  /*
   * Se o código estiver dentro de uma
   * lista de equivalentes, procuramos agora.
   */

  const registrosContidos =
    await buscarEquivalenteContido(
      tabela,
      codigo
    );

  const contidos =
    removerDuplicados(
      registrosContidos,
      codigo
    );

  if (
    contidos.length > 0
  ) {
    console.log(
      `✅ ${tabela}: aplicações via equivalentes`,
      contidos.length
    );

    return contidos;
  }

  return [];
}

/*
 * ============================================================
 * FUNÇÃO OFICIAL
 * ============================================================
 */

export async function buscarAplicacoes(
  codigoPrincipal
) {
  const codigo =
    limparCodigo(
      codigoPrincipal
    );

  if (!codigo) {
    return [];
  }

  console.log(
    "🚗 PAIIA BUSCANDO APLICAÇÕES:",
    codigo
  );

  /*
   * ========================================================
   * 1. CATALOGO_PECAS
   * ========================================================
   */

  const catalogoPecas =
    await buscarNaTabela(
      "catalogo_pecas",
      codigo
    );

  console.log(
    "🚗 catalogo_pecas:",
    catalogoPecas.length
  );

  if (
    catalogoPecas.length > 0
  ) {
    console.log(
      "✅ PAIIA APLICAÇÕES OFICIAIS:",
      catalogoPecas.length
    );

    return catalogoPecas;
  }

  /*
   * ========================================================
   * 2. CATALOGO_APLICACOES
   * ========================================================
   */

  const catalogoAplicacoes =
    await buscarNaTabela(
      "catalogo_aplicacoes",
      codigo
    );

  console.log(
    "🚗 catalogo_aplicacoes:",
    catalogoAplicacoes.length
  );

  if (
    catalogoAplicacoes.length > 0
  ) {
    return catalogoAplicacoes;
  }

  /*
   * ========================================================
   * 3. CATALOGO_MESTRE
   * ========================================================
   */

  const catalogoMestre =
    await buscarNaTabela(
      "catalogo_mestre",
      codigo
    );

  console.log(
    "🚗 catalogo_mestre:",
    catalogoMestre.length
  );

  if (
    catalogoMestre.length > 0
  ) {
    return catalogoMestre;
  }

  console.warn(
    "⚠️ Nenhuma aplicação veicular confirmada:",
    codigo
  );

  return [];
}

export default buscarAplicacoes;