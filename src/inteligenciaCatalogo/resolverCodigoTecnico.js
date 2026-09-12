import { supabase } from "../supabase";

function limparCodigo(valor = "") {
  return String(valor || "")
    .trim()
    .toUpperCase();
}

function normalizarCodigo(valor = "") {
  return limparCodigo(valor)
    .replace(/[^A-Z0-9]/g, "");
}

function separarEquivalentes(valor = "") {
  return String(valor || "")
    .split(/[,;|/\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function unicos(lista = []) {
  return [
    ...new Set(
      lista
        .map((item) =>
          String(item || "").trim()
        )
        .filter(Boolean)
    ),
  ];
}

function removerDuplicados(registros = []) {
  const mapa = new Map();

  for (const item of registros) {
    const chave = [
      item?.codigo_oem || "",
      item?.montadora || "",
      item?.modelo || "",
      item?.motor || "",
      item?.ano_inicio || "",
      item?.ano_fim || "",
    ]
      .map((valor) =>
        String(valor)
          .trim()
          .toUpperCase()
      )
      .join("|");

    if (!mapa.has(chave)) {
      mapa.set(chave, item);
    }
  }

  return Array.from(mapa.values());
}

async function buscarPorOemExato(codigo) {
  const { data, error } =
    await supabase
      .from("catalogo_pecas")
      .select("*")
      .eq(
        "codigo_oem",
        codigo
      )
      .eq("ativo", true)
      .order("prioridade", {
        ascending: true,
      })
      .order("confiabilidade", {
        ascending: false,
      });

  return {
    data: data || [],
    error,
  };
}

async function buscarPorEquivalente(codigo) {
  const { data, error } =
    await supabase
      .from("catalogo_pecas")
      .select(
        "codigo_oem,codigo_equivalente,fabricante,peca,origem_catalogo"
      )
      .ilike(
        "codigo_equivalente",
        `%${codigo}%`
      )
      .eq("ativo", true)
      .limit(100);

  return {
    data: data || [],
    error,
  };
}

async function buscarMestre(codigo) {
  const { data, error } =
    await supabase
      .from("catalogo_mestre")
      .select("*")
      .eq(
        "codigo_oem",
        codigo
      )
      .eq("ativo", true)
      .limit(20);

  return {
    data: data || [],
    error,
  };
}

export async function resolverCodigoTecnico(
  codigoEntrada
) {
  const codigoPesquisado =
    limparCodigo(
      codigoEntrada
    );

  const codigoNormalizado =
    normalizarCodigo(
      codigoPesquisado
    );

  if (!codigoNormalizado) {
    return {
      encontrado: false,
      codigoPesquisado: "",
      codigoPrincipal: "",
      equivalentes: [],
      aplicacoes: [],
      fabricante: "",
      peca: "",
      fontes: [],
      confiabilidade: 0,
    };
  }

  /*
   * =========================================
   * 1. OEM EXATO
   * =========================================
   */

  const resultadoOem =
    await buscarPorOemExato(
      codigoNormalizado
    );

  if (
    !resultadoOem.error &&
    resultadoOem.data.length > 0
  ) {
    const aplicacoes =
      removerDuplicados(
        resultadoOem.data
      );

    const principal =
      aplicacoes[0] || {};

    const equivalentes =
      unicos(
        aplicacoes.flatMap(
          (item) =>
            separarEquivalentes(
              item.codigo_equivalente
            )
        )
      );

    const fontes =
      unicos(
        aplicacoes.map(
          (item) =>
            item.origem_catalogo
        )
      );

    return {
      encontrado: true,

      tipoResolucao:
        "oem_exato",

      codigoPesquisado,

      codigoPrincipal:
        principal.codigo_oem ||
        codigoNormalizado,

      equivalentes,

      aplicacoes,

      fabricante:
        principal.fabricante ||
        "",

      peca:
        principal.peca ||
        "",

      fontes,

      confiabilidade:
        Number(
          principal.confiabilidade
        ) || 0,
    };
  }

  /*
   * =========================================
   * 2. EQUIVALENTE -> OEM
   * =========================================
   */

  const resultadoEquivalente =
    await buscarPorEquivalente(
      codigoNormalizado
    );

  if (
    !resultadoEquivalente.error &&
    resultadoEquivalente.data.length > 0
  ) {
    const candidatosOem =
      unicos(
        resultadoEquivalente.data
          .map(
            (item) =>
              item.codigo_oem
          )
      );

    /*
     * Segurança:
     * se o equivalente apontar para
     * mais de um OEM diferente,
     * não escolhemos no chute.
     */
    if (
      candidatosOem.length !== 1
    ) {
      return {
        encontrado: false,

        ambiguidade: true,

        codigoPesquisado,

        codigoPrincipal: "",

        equivalentes: [],

        aplicacoes: [],

        fabricante: "",

        peca: "",

        fontes: [],

        confiabilidade: 0,

        candidatosOem,
      };
    }

    const codigoPrincipal =
      candidatosOem[0];

    const resultadoAplicacoes =
      await buscarPorOemExato(
        codigoPrincipal
      );

    if (
      !resultadoAplicacoes.error &&
      resultadoAplicacoes.data
        .length > 0
    ) {
      const aplicacoes =
        removerDuplicados(
          resultadoAplicacoes.data
        );

      const principal =
        aplicacoes[0] || {};

      const equivalentes =
        unicos(
          [
            codigoPesquisado,

            ...resultadoEquivalente
              .data.flatMap(
                (item) =>
                  separarEquivalentes(
                    item
                      .codigo_equivalente
                  )
              ),

            ...aplicacoes.flatMap(
              (item) =>
                separarEquivalentes(
                  item
                    .codigo_equivalente
                )
            ),
          ]
        );

      const fontes =
        unicos(
          aplicacoes.map(
            (item) =>
              item.origem_catalogo
          )
        );

      return {
        encontrado: true,

        tipoResolucao:
          "equivalente",

        codigoPesquisado,

        codigoPrincipal,

        equivalentes,

        aplicacoes,

        fabricante:
          principal.fabricante ||
          "",

        peca:
          principal.peca ||
          "",

        fontes,

        confiabilidade:
          Number(
            principal
              .confiabilidade
          ) || 0,
      };
    }
  }

  /*
   * =========================================
   * 3. BASE MESTRE — FALLBACK
   * =========================================
   */

  const resultadoMestre =
    await buscarMestre(
      codigoNormalizado
    );

  if (
    !resultadoMestre.error &&
    resultadoMestre.data.length > 0
  ) {
    const principal =
      resultadoMestre.data[0];

    return {
      encontrado: true,

      tipoResolucao:
        "base_mestre",

      codigoPesquisado,

      codigoPrincipal:
        principal.codigo_oem ||
        codigoNormalizado,

      equivalentes:
        separarEquivalentes(
          principal
            .codigo_equivalente
        ),

      aplicacoes: [],

      fabricante:
        principal.fabricante ||
        "",

      peca:
        principal.peca ||
        "",

      fontes:
        principal
          .origem_catalogo
          ? [
              principal
                .origem_catalogo,
            ]
          : [],

      confiabilidade:
        Number(
          principal
            .confiabilidade
        ) || 0,
    };
  }

  /*
   * =========================================
   * NÃO ENCONTRADO
   * =========================================
   */

  return {
    encontrado: false,

    codigoPesquisado,

    codigoPrincipal: "",

    equivalentes: [],

    aplicacoes: [],

    fabricante: "",

    peca: "",

    fontes: [],

    confiabilidade: 0,
  };
}

export default resolverCodigoTecnico;