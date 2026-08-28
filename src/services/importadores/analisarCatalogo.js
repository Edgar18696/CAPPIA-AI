import {
  extrairPaginasPdf,
} from "./leitorPdf";

import { identificarCatalogo } from "./identificarCatalogo";
import { identificarEstruturaPdf } from "./identificarEstruturaPdf";
import { localizarIndiceCatalogo } from "./localizarIndiceCatalogo";
import { obterConfiguracao } from "./configuracoes";

function normalizarTexto(
  valor
) {
  return String(
    valor || ""
  )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim();
}

/*
 * ============================================================
 * SELECIONA CONFIGURAÇÃO ESPECÍFICA
 * ============================================================
 */

function selecionarConfiguracaoCatalogo(
  configuracao,
  nomeArquivo
) {
  if (
    !configuracao?.catalogos
  ) {
    return configuracao;
  }

  const arquivoNormalizado =
    normalizarTexto(
      nomeArquivo
    )
      .replace(
        /[_-]+/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  let chaveForcada =
    "";

  /*
   * ==========================================================
   * REGRAS ESPECIAIS JÁ EXISTENTES
   * ==========================================================
   */

  if (
    arquivoNormalizado.includes(
      "bateria"
    ) &&
    (
      arquivoNormalizado.includes(
        "moto"
      ) ||
      arquivoNormalizado.includes(
        "motocicleta"
      ) ||
      arquivoNormalizado.includes(
        "2w"
      )
    )
  ) {
    chaveForcada =
      "baterias_moto";
  } else if (
    arquivoNormalizado.includes(
      "rm hcv"
    ) ||
    arquivoNormalizado.includes(
      "mh cy"
    ) ||
    arquivoNormalizado.includes(
      "alternador"
    ) ||
    arquivoNormalizado.includes(
      "motor de partida"
    )
  ) {
    chaveForcada =
      "alternadores";
  }

  if (chaveForcada) {
    const catalogoForcado =
      configuracao
        .catalogos[
          chaveForcada
        ];

    if (
      catalogoForcado
    ) {
      return {
        ...configuracao,
        ...catalogoForcado,

        catalogos:
          configuracao.catalogos,

        fabricante:
          configuracao.fabricante,

        chaves:
          configuracao.chaves,
      };
    }
  }

  /*
   * ==========================================================
   * BUSCA PELO NOME / TIPO / PALAVRAS-CHAVE
   * ==========================================================
   */

  const catalogoEncontrado =
    Object.entries(
      configuracao.catalogos
    ).find(
      (
        [
          chave,
          catalogo,
        ]
      ) => {
        const chaveNormalizada =
          normalizarTexto(
            chave
          )
            .replace(
              /[_-]+/g,
              " "
            )
            .trim();

        const tipoNormalizado =
          normalizarTexto(
            catalogo
              ?.tipoCatalogo
          )
            .replace(
              /[_-]+/g,
              " "
            )
            .trim();

        const palavrasChave =
          Array.isArray(
            catalogo
              ?.palavrasChave
          )
            ? catalogo
                .palavrasChave
            : [];

        const encontrouPalavra =
          palavrasChave.some(
            (palavra) => {
              const alvo =
                normalizarTexto(
                  palavra
                )
                  .replace(
                    /[_-]+/g,
                    " "
                  )
                  .trim();

              return (
                alvo &&
                arquivoNormalizado
                  .includes(
                    alvo
                  )
              );
            }
          );

        if (
          encontrouPalavra
        ) {
          return true;
        }

        if (
          chaveNormalizada &&
          arquivoNormalizado
            .includes(
              chaveNormalizada
            )
        ) {
          return true;
        }

        if (
          tipoNormalizado &&
          arquivoNormalizado
            .includes(
              tipoNormalizado
            )
        ) {
          return true;
        }

        if (
          chaveNormalizada ===
            "bombas" &&
          arquivoNormalizado
            .includes(
              "combustivel"
            )
        ) {
          return true;
        }

        return false;
      }
    );

  if (
    !catalogoEncontrado
  ) {
    return configuracao;
  }

  const [
    ,
    catalogo,
  ] =
    catalogoEncontrado;

  return {
    ...configuracao,
    ...catalogo,

    catalogos:
      configuracao.catalogos,

    fabricante:
      configuracao.fabricante,

    chaves:
      configuracao.chaves,
  };
}

/*
 * ============================================================
 * FAIXAS DE PÁGINAS
 * ============================================================
 */

function montarFaixasConfiguradas(
  configuracao
) {
  if (!configuracao) {
    return [];
  }

  const faixas =
    [];

  /*
   * ========================================================
   * APLICAÇÕES
   * ========================================================
   */

  const inicioAplicacoes =
    Number(
      configuracao
        .paginaInicialAplicacoes
    );

  const fimAplicacoes =
    Number(
      configuracao
        .paginaFinalAplicacoes
    );

  if (
    Number.isFinite(
      inicioAplicacoes
    ) &&
    inicioAplicacoes > 0
  ) {
    faixas.push({
      inicio:
        inicioAplicacoes,

      fim:
        Number.isFinite(
          fimAplicacoes
        ) &&
        fimAplicacoes >=
          inicioAplicacoes
          ? fimAplicacoes
          : null,

      tipo:
        "aplicações",
    });
  }

  /*
   * ========================================================
   * REFERÊNCIAS
   * ========================================================
   *
   * IMPORTANTE:
   *
   * Antes o analisarCatalogo ignorava completamente
   * paginaInicialReferencias / paginaFinalReferencias.
   *
   * No Magneti Marelli Bicos 2016 isso fazia as páginas
   * 1363 até 1379 ficarem fora de analise.paginas.
   * ========================================================
   */

  const inicioReferencias =
    Number(
      configuracao
        .paginaInicialReferencias
    );

  const fimReferencias =
    Number(
      configuracao
        .paginaFinalReferencias
    );

  if (
    Number.isFinite(
      inicioReferencias
    ) &&
    inicioReferencias > 0
  ) {
    faixas.push({
      inicio:
        inicioReferencias,

      fim:
        Number.isFinite(
          fimReferencias
        ) &&
        fimReferencias >=
          inicioReferencias
          ? fimReferencias
          : null,

      tipo:
        "referências",
    });
  }

  /*
   * ========================================================
   * EQUIVALÊNCIAS
   * ========================================================
   */

  const inicioEquivalencias =
    Number(
      configuracao
        .paginaInicialEquivalencias
    );

  const fimEquivalencias =
    Number(
      configuracao
        .paginaFinalEquivalencias
    );

  if (
    Number.isFinite(
      inicioEquivalencias
    ) &&
    inicioEquivalencias > 0
  ) {
    faixas.push({
      inicio:
        inicioEquivalencias,

      fim:
        Number.isFinite(
          fimEquivalencias
        ) &&
        fimEquivalencias >=
          inicioEquivalencias
          ? fimEquivalencias
          : null,

      tipo:
        "equivalências",
    });
  }

  return faixas;
}

/*
 * ============================================================
 * UNE FAIXAS SOBREPOSTAS
 * ============================================================
 */

function unirFaixas(
  faixas = []
) {
  const validas =
    faixas
      .filter(
        (faixa) =>
          faixa?.inicio
      )
      .sort(
        (a, b) =>
          a.inicio -
          b.inicio
      );

  if (
    validas.length === 0
  ) {
    return [];
  }

  const resultado =
    [];

  for (
    const faixa
    of validas
  ) {
    const ultima =
      resultado[
        resultado.length -
        1
      ];

    if (!ultima) {
      resultado.push({
        ...faixa,
      });

      continue;
    }

    if (
      ultima.fim ===
      null
    ) {
      continue;
    }

    if (
      faixa.inicio <=
        ultima.fim + 1
    ) {
      if (
        faixa.fim ===
        null
      ) {
        ultima.fim =
          null;
      } else {
        ultima.fim =
          Math.max(
            ultima.fim,
            faixa.fim
          );
      }

      continue;
    }

    resultado.push({
      ...faixa,
    });
  }

  return resultado;
}

/*
 * ============================================================
 * REMOVE PÁGINAS DUPLICADAS
 * ============================================================
 */

function removerPaginasDuplicadas(
  paginas = []
) {
  const mapa =
    new Map();

  for (
    const pagina
    of paginas
  ) {
    const numero =
      Number(
        pagina
          ?.numeroPagina ||
        pagina
          ?.pagina
      );

    if (
      !Number.isFinite(
        numero
      )
    ) {
      continue;
    }

    const existente =
      mapa.get(
        numero
      );

    if (
      !existente ||
      String(
        pagina
          ?.texto ||
        ""
      ).length >
      String(
        existente
          ?.texto ||
        ""
      ).length
    ) {
      mapa.set(
        numero,
        pagina
      );
    }
  }

  return Array.from(
    mapa.values()
  )
    .sort(
      (a, b) =>
        Number(
          a.numeroPagina
        ) -
        Number(
          b.numeroPagina
        )
    );
}

/*
 * ============================================================
 * EXTRAI SOMENTE AS FAIXAS NECESSÁRIAS
 * ============================================================
 */

async function extrairFaixas({
  arquivo,
  faixas,
  onProgresso,
}) {
  const paginas =
    [];

  const faixasUnidas =
    unirFaixas(
      faixas
    );

  for (
    const faixa
    of faixasUnidas
  ) {
    onProgresso?.(
      faixa.fim
        ? `⚡ Lendo somente páginas necessárias: ${faixa.inicio} até ${faixa.fim}...`
        : `⚡ Lendo catálogo a partir da página ${faixa.inicio}...`
    );

    const extraidas =
      await extrairPaginasPdf({
        arquivo,

        paginaInicial:
          faixa.inicio,

        paginaFinal:
          faixa.fim,

        tipo:
          faixa.tipo ||
          "catálogo",

        onProgresso,
      });

    paginas.push(
      ...extraidas
    );
  }

  return removerPaginasDuplicadas(
    paginas
  );
}

/*
 * ============================================================
 * MAIOR PÁGINA LIDA
 * ============================================================
 */

function obterMaiorPagina(
  paginas = []
) {
  return paginas.reduce(
    (
      maior,
      pagina
    ) =>
      Math.max(
        maior,
        Number(
          pagina
            ?.numeroPagina ||
          pagina
            ?.pagina ||
          0
        )
      ),
    0
  );
}

/*
 * ============================================================
 * ANALISAR CATÁLOGO
 * ============================================================
 */

export async function analisarCatalogo({
  arquivo,
  fabricante = "",
  onProgresso,
}) {
  if (!arquivo) {
    throw new Error(
      "Nenhum catálogo foi informado."
    );
  }

  /*
   * ==========================================================
   * 1. PRIMEIRO TENTA CONFIGURAÇÃO SEM LER O PDF
   * ==========================================================
   */

  let configuracaoBase =
    fabricante
      ? obterConfiguracao(
          fabricante
        )
      : null;

  let configuracao =
    configuracaoBase
      ? selecionarConfiguracaoCatalogo(
          configuracaoBase,
          arquivo.name
        )
      : null;

  let paginas =
    [];

  let fabricanteDetectado =
    {
      fabricante:
        configuracao
          ?.fabricante ||
        fabricante ||
        "",

      chave:
        fabricante ||
        "",

      identificado:
        Boolean(
          configuracao ||
          fabricante
        ),
    };

  /*
   * ==========================================================
   * 2. CAMINHO RÁPIDO — CONFIGURAÇÃO CONHECIDA
   * ==========================================================
   */

  if (configuracao) {
    const faixas =
      montarFaixasConfiguradas(
        configuracao
      );

    if (
      faixas.length >
      0
    ) {
      onProgresso?.(
        "⚡ Configuração reconhecida. Pulando leitura completa do PDF..."
      );

      console.log(
        "⚡ ANÁLISE RÁPIDA:",
        {
          fabricante:
            configuracao
              .fabricante ||
            fabricante,

          tipoCatalogo:
            configuracao
              .tipoCatalogo,

          subTipoCatalogo:
            configuracao
              .subTipoCatalogo ||
            "",

          faixas,
        }
      );

      paginas =
        await extrairFaixas({
          arquivo,
          faixas,
          onProgresso,
        });
    }
  }

  /*
   * ==========================================================
   * 3. SEM CONFIGURAÇÃO / SEM FAIXA
   * ==========================================================
   *
   * Lê somente as primeiras páginas
   * para identificar catálogo.
   *
   * NÃO lê o PDF inteiro para diagnóstico.
   * ==========================================================
   */

  if (
    paginas.length ===
    0
  ) {
    onProgresso?.(
      "🔎 Fazendo diagnóstico rápido do catálogo..."
    );

    const paginasDiagnostico =
      await extrairPaginasPdf({
        arquivo,

        paginaInicial:
          1,

        paginaFinal:
          5,

        tipo:
          "diagnóstico rápido",

        onProgresso,
      });

    const textoDiagnostico =
      paginasDiagnostico
        .map(
          (pagina) =>
            pagina
              ?.texto ||
            ""
        )
        .filter(Boolean)
        .join(
          "\n"
        );

    fabricanteDetectado =
      identificarCatalogo({
        nomeArquivo:
          arquivo.name,

        texto:
          textoDiagnostico,

        fabricanteInformado:
          fabricante,
      });

    const chaveFabricante =
      fabricanteDetectado
        .chave ||
      fabricante;

    configuracaoBase =
      obterConfiguracao(
        chaveFabricante
      );

    configuracao =
      selecionarConfiguracaoCatalogo(
        configuracaoBase,
        arquivo.name
      );

    /*
     * ========================================================
     * ENCONTROU CONFIGURAÇÃO DEPOIS DO DIAGNÓSTICO
     * ========================================================
     */

    if (configuracao) {
      const faixas =
        montarFaixasConfiguradas(
          configuracao
        );

      if (
        faixas.length >
        0
      ) {
        const paginasConfiguradas =
          await extrairFaixas({
            arquivo,
            faixas,
            onProgresso,
          });

        paginas =
          removerPaginasDuplicadas([
            ...paginasDiagnostico,
            ...paginasConfiguradas,
          ]);
      } else {
        onProgresso?.(
          "📖 Catálogo sem faixa configurada. Lendo páginas completas..."
        );

        paginas =
          await extrairPaginasPdf({
            arquivo,

            paginaInicial:
              1,

            paginaFinal:
              null,

            tipo:
              "catálogo",

            onProgresso,
          });
      }
    } else {
      onProgresso?.(
        "📖 Estrutura desconhecida. Lendo catálogo completo..."
      );

      paginas =
        await extrairPaginasPdf({
          arquivo,

          paginaInicial:
            1,

          paginaFinal:
            null,

          tipo:
            "catálogo",

          onProgresso,
        });
    }
  }

  /*
   * ==========================================================
   * 4. TEXTO LIDO
   * ==========================================================
   */

  const textoCompleto =
    paginas
      .map(
        (pagina) =>
          pagina
            ?.texto ||
          ""
      )
      .filter(Boolean)
      .join(
        "\n"
      );

  if (
    !fabricanteDetectado
      ?.identificado
  ) {
    fabricanteDetectado =
      identificarCatalogo({
        nomeArquivo:
          arquivo.name,

        texto:
          textoCompleto,

        fabricanteInformado:
          fabricante,
      });
  }

  /*
   * ==========================================================
   * 5. ESTRUTURA / ÍNDICE
   * ==========================================================
   */

  const estrutura =
    identificarEstruturaPdf(
      paginas
    );

  const indice =
    localizarIndiceCatalogo(
      paginas
    );

  /*
   * ==========================================================
   * 6. PÁGINAS
   * ==========================================================
   */

  let paginaInicialAplicacoes =
    estrutura
      ?.paginaInicialAplicacoes ||
    null;

  let paginaFinalAplicacoes =
    estrutura
      ?.paginaFinalAplicacoes ||
    null;

  let paginaInicialReferencias =
    null;

  let paginaFinalReferencias =
    null;

  let paginaInicialEquivalencias =
    estrutura
      ?.paginaInicialEquivalencias ||
    null;

  let paginaFinalEquivalencias =
    estrutura
      ?.paginaFinalEquivalencias ||
    null;

  let origemPaginas =
    "detecção automática";

  const maiorPaginaLida =
    obterMaiorPagina(
      paginas
    );

  /*
   * ==========================================================
   * CONFIGURAÇÃO TEM PRIORIDADE
   * ==========================================================
   */

  if (configuracao) {
    /*
     * ========================================================
     * APLICAÇÕES
     * ========================================================
     */

    const inicioAplicacoes =
      Number(
        configuracao
          .paginaInicialAplicacoes
      );

    const fimAplicacoes =
      Number(
        configuracao
          .paginaFinalAplicacoes
      );

    if (
      Number.isFinite(
        inicioAplicacoes
      ) &&
      inicioAplicacoes > 0
    ) {
      paginaInicialAplicacoes =
        inicioAplicacoes;

      paginaFinalAplicacoes =
        Number.isFinite(
          fimAplicacoes
        ) &&
        fimAplicacoes >=
          inicioAplicacoes
          ? fimAplicacoes
          : maiorPaginaLida ||
            null;
    }

    /*
     * ========================================================
     * REFERÊNCIAS
     * ========================================================
     */

    const inicioReferencias =
      Number(
        configuracao
          .paginaInicialReferencias
      );

    const fimReferencias =
      Number(
        configuracao
          .paginaFinalReferencias
      );

    if (
      Number.isFinite(
        inicioReferencias
      ) &&
      inicioReferencias > 0
    ) {
      paginaInicialReferencias =
        inicioReferencias;

      paginaFinalReferencias =
        Number.isFinite(
          fimReferencias
        ) &&
        fimReferencias >=
          inicioReferencias
          ? fimReferencias
          : maiorPaginaLida ||
            null;
    }

    /*
     * ========================================================
     * EQUIVALÊNCIAS
     * ========================================================
     */

    const inicioEquivalencias =
      Number(
        configuracao
          .paginaInicialEquivalencias
      );

    const fimEquivalencias =
      Number(
        configuracao
          .paginaFinalEquivalencias
      );

    if (
      Number.isFinite(
        inicioEquivalencias
      ) &&
      inicioEquivalencias > 0
    ) {
      paginaInicialEquivalencias =
        inicioEquivalencias;

      paginaFinalEquivalencias =
        Number.isFinite(
          fimEquivalencias
        ) &&
        fimEquivalencias >=
          inicioEquivalencias
          ? fimEquivalencias
          : maiorPaginaLida ||
            null;
    } else {
      paginaInicialEquivalencias =
        null;

      paginaFinalEquivalencias =
        null;
    }

    origemPaginas =
      "configuração validada do catálogo";
  } else {
    if (
      indice
        ?.paginaInicialAplicacoes
    ) {
      paginaInicialAplicacoes =
        indice
          .paginaInicialAplicacoes;
    }

    if (
      indice
        ?.paginaInicialEquivalencias
    ) {
      paginaInicialEquivalencias =
        indice
          .paginaInicialEquivalencias;

      paginaFinalAplicacoes =
        indice
          .paginaInicialEquivalencias -
        1;

      paginaFinalEquivalencias =
        null;
    }
  }

  /*
   * ==========================================================
   * DIAGNÓSTICO MARELLI — IWP099
   * ==========================================================
   */

  const paginasNumeradas =
    paginas
      .map(
        (pagina) =>
          Number(
            pagina
              ?.numeroPagina ||
            pagina
              ?.pagina
          )
      )
      .filter(
        (numero) =>
          Number.isFinite(
            numero
          )
      );

  const pagina1379 =
    paginas.find(
      (pagina) =>
        Number(
          pagina
            ?.numeroPagina ||
          pagina
            ?.pagina
        ) ===
        1379
    );

  const textoPagina1379 =
    String(
      pagina1379
        ?.texto ||
      pagina1379
        ?.conteudo ||
      ""
    );

  if (
    configuracao
      ?.subTipoCatalogo ===
    "bicos_injetores"
  ) {
    console.log(
      "=========================================="
    );

    console.log(
      "💉 ANÁLISE BICOS MARELLI 2016"
    );

    console.log(
      "PÁGINAS LIDAS:",
      paginasNumeradas.length
    );

    console.log(
      "PRIMEIRA:",
      paginasNumeradas.length
        ? Math.min(
            ...paginasNumeradas
          )
        : null
    );

    console.log(
      "ÚLTIMA:",
      paginasNumeradas.length
        ? Math.max(
            ...paginasNumeradas
          )
        : null
    );

    console.log(
      "POSSUI PÁGINA 1379:",
      Boolean(
        pagina1379
      )
    );

    console.log(
      "PÁGINA 1379 CONTÉM IWP099:",
      textoPagina1379
        .toUpperCase()
        .includes(
          "IWP099"
        )
    );

    if (
      pagina1379
    ) {
      console.log(
        "💉 TEXTO PÁGINA 1379:",
        textoPagina1379
      );
    }

    console.log(
      "=========================================="
    );
  }

  /*
   * ==========================================================
   * DIAGNÓSTICO FINAL
   * ==========================================================
   */

  console.log(
    "✅ ANÁLISE CATÁLOGO:",
    {
      fabricante:
        fabricanteDetectado
          ?.fabricante ||
        configuracao
          ?.fabricante ||
        fabricante,

      configuracao:
        Boolean(
          configuracao
        ),

      tipoCatalogo:
        configuracao
          ?.tipoCatalogo ||
        "",

      subTipoCatalogo:
        configuracao
          ?.subTipoCatalogo ||
        "",

      paginasLidas:
        paginas.length,

      primeiraPagina:
        paginas[
          0
        ]?.numeroPagina ||
        null,

      ultimaPagina:
        paginas[
          paginas.length -
          1
        ]?.numeroPagina ||
        null,

      referencias: {
        inicio:
          paginaInicialReferencias,

        fim:
          paginaFinalReferencias,
      },

      aplicacoes: {
        inicio:
          paginaInicialAplicacoes,

        fim:
          paginaFinalAplicacoes,
      },

      equivalencias: {
        inicio:
          paginaInicialEquivalencias,

        fim:
          paginaFinalEquivalencias,
      },
    }
  );

  /*
   * ==========================================================
   * RETORNO
   * ==========================================================
   */

  return {
    fabricante:
      fabricanteDetectado
        ?.fabricante ||
      configuracao
        ?.fabricante ||
      estrutura
        ?.fabricante ||
      fabricante,

    chave:
      fabricanteDetectado
        ?.chave ||
      fabricante,

    identificado:
      fabricanteDetectado
        ?.identificado ||
      Boolean(
        configuracao
      ),

    configuracaoEncontrada:
      Boolean(
        configuracao
      ),

    configuracao,

    origemPaginas,

    confianca:
      configuracao
        ? 100
        : Math.max(
            estrutura
              ?.confianca ||
            0,

            indice
              ?.confianca ||
            0
          ),

    /*
     * As páginas efetivamente lidas.
     */

    paginas,

    indice,

    estrutura,

    /*
     * ========================================================
     * FAIXA DE REFERÊNCIAS
     * ========================================================
     */

    paginasReferencias: {
      inicio:
        paginaInicialReferencias,

      fim:
        paginaFinalReferencias,
    },

    /*
     * ========================================================
     * FAIXA DE APLICAÇÕES
     * ========================================================
     */

    paginasAplicacoes: {
      inicio:
        paginaInicialAplicacoes,

      fim:
        paginaFinalAplicacoes,
    },

    /*
     * ========================================================
     * FAIXA DE EQUIVALÊNCIAS
     * ========================================================
     */

    paginasEquivalencias: {
      inicio:
        paginaInicialEquivalencias,

      fim:
        paginaFinalEquivalencias,
    },
  };
}