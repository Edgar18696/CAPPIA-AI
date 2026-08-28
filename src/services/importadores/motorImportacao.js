import { extrairFaixaPdf } from "./leitorPdf";
import { salvarCatalogo } from "./salvarCatalogo";
import { obterConfiguracao } from "./configuracoes";
import { analisarCatalogo } from "./analisarCatalogo";
import { obterImportador } from "./fabricantes";

function criarPaginasDoTexto(
  texto,
  paginaInicial
) {
  if (!texto) {
    return [];
  }

  return [
    {
      numeroPagina: paginaInicial,
      pagina: paginaInicial,
      texto,
      conteudo: texto,
    },
  ];
}

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function selecionarConfiguracaoCatalogo(
  configuracao,
  nomeArquivo
) {
  if (!configuracao?.catalogos) {
    return configuracao;
  }

  const arquivoNormalizado =
    normalizarTexto(nomeArquivo)
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  /*
   * =======================================================
   * PRIORIDADE ABSOLUTA — MAGNETI MARELLI
   * SISTEMA DE COMBUSTÍVEL
   * =======================================================
   */

  const ehSistemaCombustivelMarelli =
    arquivoNormalizado.includes(
      "fuel level sensors"
    ) ||
    arquivoNormalizado.includes(
      "fuel level sensor"
    ) ||
    arquivoNormalizado.includes(
      "fuel supply units"
    ) ||
    arquivoNormalizado.includes(
      "fuel supply unit"
    );

  if (
    ehSistemaCombustivelMarelli
  ) {
    const catalogoConfigurado =
      configuracao.catalogos
        ?.sistema_combustivel;

    if (catalogoConfigurado) {
      console.log(
        "🎯 CATÁLOGO FORÇADO:",
        "sistema_combustivel"
      );

      return {
        ...configuracao,
        ...catalogoConfigurado,

        tipoCatalogo:
          "sistema_combustivel",

        catalogos:
          configuracao.catalogos,

        fabricante:
          "Magneti Marelli",

        chaves:
          configuracao.chaves,
      };
    }

    console.warn(
      "⚠️ sistema_combustivel não encontrado em catalogos. Usando configuração de segurança."
    );

    return {
      ...configuracao,

      tipoCatalogo:
        "sistema_combustivel",

      fabricante:
        "Magneti Marelli",

      origemCatalogo:
        "Catálogo Magneti Marelli Fuel Level Sensors and Fuel Supply Units 2018-2019",

      paginaInicialAplicacoes:
        9,

      paginaFinalAplicacoes:
        286,

      paginaInicialReferencias:
        287,

      paginaFinalReferencias:
        636,

      paginaInicialEquivalencias:
        637,

      paginaFinalEquivalencias:
        716,

      catalogos:
        configuracao.catalogos,

      chaves:
        configuracao.chaves,
    };
  }

  /*
   * =======================================================
   * OUTROS CATÁLOGOS COM PRIORIDADE
   * =======================================================
   */
   let chaveForcada = "";

  /*
   * =======================================================
   * LÂMPADAS / BULBS
   * =======================================================
   */

  if (
    arquivoNormalizado.includes(
      "parts bulbs mm folder"
    ) ||
    arquivoNormalizado.includes(
      "parts bulbs"
    ) ||
    arquivoNormalizado.includes(
      "bulbs mm"
    ) ||
    arquivoNormalizado.includes(
      "bulbs"
    )
  ) {
    chaveForcada =
      "lampadas";
  /*
   * =======================================================
   * WIPING SYSTEMS / SISTEMAS LIMPADORES
   * =======================================================
   */

  } else if (
    arquivoNormalizado.includes(
      "parts wiping systems"
    ) ||
    arquivoNormalizado.includes(
      "wiping systems"
    ) ||
    arquivoNormalizado.includes(
      "wiping system"
    ) ||
    arquivoNormalizado.includes(
      "sistemas limpadores"
    ) ||
    arquivoNormalizado.includes(
      "limpadores de para-brisa"
    )
  ) {
    chaveForcada =
      "sistemas_limpadores";

        /*
   * =======================================================
   * WIPER BLADES / PALHETAS
   * =======================================================
   */

  } else if (
    arquivoNormalizado.includes(
      "parts wiper-blades"
    ) ||
    arquivoNormalizado.includes(
      "parts wiper blades"
    ) ||
    arquivoNormalizado.includes(
      "wiper-blades"
    ) ||
    arquivoNormalizado.includes(
      "wiper blades"
    ) ||
    arquivoNormalizado.includes(
      "wiper blade"
    )
  ) {
    chaveForcada =
      "palhetas";
  /*
   * =======================================================
   * MÁQUINAS DE VIDRO / WINDOW LIFTERS
   * =======================================================
   */

  } else if (
    arquivoNormalizado.includes(
      "parts_window lifter"
    ) ||
    arquivoNormalizado.includes(
      "parts window lifter"
    ) ||
    arquivoNormalizado.includes(
      "window lifter"
    ) ||
    arquivoNormalizado.includes(
      "window lifters"
    ) ||
    arquivoNormalizado.includes(
      "electric window lifters"
    )
  ) {
    chaveForcada =
      "maquinas_vidro";


  /*
   * =======================================================
   * PARA-CHOQUES
   * =======================================================
   */

  } else if (
    arquivoNormalizado.includes(
      "parts bumpers"
    ) ||
    arquivoNormalizado.includes(
      "bumpers"
    ) ||
    arquivoNormalizado.includes(
      "bumper"
    ) ||
    arquivoNormalizado.includes(
      "paraurti"
    ) ||
    arquivoNormalizado.includes(
      "parachoques"
    ) ||
    arquivoNormalizado.includes(
      "para choques"
    )
  ) {
    chaveForcada =
      "parachoques";

  /*
   * =======================================================
   * MAÇANETAS / FECHADURAS
   * =======================================================
   */

  } else if (
    arquivoNormalizado.includes(
      "parts door handles"
    ) ||
    arquivoNormalizado.includes(
      "door handles"
    ) ||
    arquivoNormalizado.includes(
      "door handle"
    )
  ) {
    chaveForcada =
      "macanetas_fechaduras";

  /*
   * =======================================================
   * BREMBO / MARELLI — PASTILHAS NOVAS
   * =======================================================
   */

  } else if (
    arquivoNormalizado.includes(
      "brembo"
    ) &&
    (
      arquivoNormalizado.includes(
        "brake pads"
      ) ||
      arquivoNormalizado.includes(
        "brake pad"
      )
    )
  ) {
    chaveForcada =
      "pastilhas_freio_brembo";

  /*
   * =======================================================
   * BREMBO / MARELLI — DISCOS NOVOS
   * =======================================================
   */

  } else if (
    arquivoNormalizado.includes(
      "brembo"
    ) &&
    (
      arquivoNormalizado.includes(
        "brake discs"
      ) ||
      arquivoNormalizado.includes(
        "brake disc"
      )
    )
  ) {
    chaveForcada =
      "discos_freio_brembo";

  /*
   * =======================================================
   * PASTILHAS ANTIGAS
   * =======================================================
   */

  } else if (
    arquivoNormalizado.includes(
      "brake pads"
    ) ||
    arquivoNormalizado.includes(
      "brake pad"
    ) ||
    arquivoNormalizado.includes(
      "pastiglie freno"
    ) ||
    arquivoNormalizado.includes(
      "pastilhas de freio"
    )
  ) {
    chaveForcada =
      "pastilhas_freio";

  /*
   * =======================================================
   * KITS DISTRIBUIÇÃO
   * =======================================================
   */

  } else if (
    arquivoNormalizado.includes(
      "engine drive system kit"
    )
  ) {
    chaveForcada =
      "kits_distribuicao";

  /*
   * =======================================================
   * ALTERNADORES + MOTORES DE PARTIDA
   * =======================================================
   */

  } else if (
    arquivoNormalizado.includes(
      "alternators and starter motors"
    ) ||
    (
      arquivoNormalizado.includes(
        "alternators"
      ) &&
      arquivoNormalizado.includes(
        "starter motors"
      )
    )
  ) {
    chaveForcada =
      "alternadores_motores_partida";

  /*
   * =======================================================
   * BICOS INJETORES 2016
   * =======================================================
   */

  } else if (
    arquivoNormalizado.includes(
      "electronic systems and ignition"
    )
  ) {
    chaveForcada =
      "bicosInjetores2016";

  /*
   * =======================================================
   * SISTEMAS ELETRÔNICOS
   * =======================================================
   */

  } else if (
    arquivoNormalizado.includes(
      "electronics systems"
    ) ||
    arquivoNormalizado.includes(
      "parts electronics systems"
    )
  ) {
    chaveForcada =
      "sistemasEletronicos";

  /*
   * =======================================================
   * BOSCH GASOLINE 2025
   * =======================================================
   */

  } else if (
    arquivoNormalizado.includes(
      "gasoline"
    ) &&
    arquivoNormalizado.includes(
      "product portfolio"
    ) &&
    arquivoNormalizado.includes(
      "2025"
    )
  ) {
    chaveForcada =
      "gasolina_2025";

  /*
   * =======================================================
   * IGNIÇÃO
   * =======================================================
   */

  } else if (
    arquivoNormalizado.includes(
      "velas"
    ) ||
    arquivoNormalizado.includes(
      "cabos"
    ) ||
    arquivoNormalizado.includes(
      "bobinas"
    )
  ) {
    chaveForcada =
      "ignicao";
  /*
   * =======================================================
   * AMORTECEDORES / SHOCK ABSORBERS 2019
   * =======================================================
   */

  } else if (
    arquivoNormalizado.includes(
      "parts shock absorbers"
    ) ||
    arquivoNormalizado.includes(
      "shock absorbers"
    ) ||
    arquivoNormalizado.includes(
      "shock absorber"
    ) ||
    arquivoNormalizado.includes(
      "amortecedores"
    ) ||
    arquivoNormalizado.includes(
      "amortecedor"
    )
  ) {
    chaveForcada =
      "amortecedores";
  /*
   * =======================================================
   * THERMAL SYSTEMS / SISTEMAS TÉRMICOS
   * =======================================================
   */

  } else if (
    arquivoNormalizado.includes(
      "parts thermal systems"
    ) ||
    arquivoNormalizado.includes(
      "thermal systems"
    ) ||
    arquivoNormalizado.includes(
      "thermal_systems"
    ) ||
    arquivoNormalizado.includes(
      "sistemi termici"
    )
  ) {
    chaveForcada =
  "sistemasTermicos";

  /*
   * =======================================================
   * WEBER BATTERIES 2025
   * =======================================================
   */

  } else if (
    arquivoNormalizado.includes(
      "parts_weber_batteries"
    ) ||
    arquivoNormalizado.includes(
      "parts weber batteries"
    ) ||
    arquivoNormalizado.includes(
      "weber batteries"
    ) ||
    arquivoNormalizado.includes(
      "weber battery"
    )
  ) {
    chaveForcada =
      "baterias_weber";

  /*
   * =======================================================
   * BATERIAS MOTO
   * =======================================================
   */

  } else if (
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

  /*
   * =======================================================
   * ALTERNADORES
   * =======================================================
   */

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
      configuracao.catalogos[
        chaveForcada
      ];

    if (catalogoForcado) {
      console.log(
        "🎯 CATÁLOGO FORÇADO:",
        chaveForcada
      );

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

  const catalogoEncontrado =
    Object.entries(
      configuracao.catalogos
    ).find(
      ([chave, catalogo]) => {
        const chaveNormalizada =
          normalizarTexto(chave)
            .replace(
              /[_-]+/g,
              " "
            )
            .trim();

        const tipoNormalizado =
          normalizarTexto(
            catalogo.tipoCatalogo
          )
            .replace(
              /[_-]+/g,
              " "
            )
            .trim();

        const palavrasChave =
          Array.isArray(
            catalogo.palavrasChave
          )
            ? catalogo.palavrasChave
            : [];

        const encontrouPalavraChave =
          palavrasChave.some(
            (palavra) => {
              const palavraNormalizada =
                normalizarTexto(
                  palavra
                )
                  .replace(
                    /[_-]+/g,
                    " "
                  )
                  .trim();

              return (
                palavraNormalizada &&
                arquivoNormalizado.includes(
                  palavraNormalizada
                )
              );
            }
          );

        if (
          encontrouPalavraChave
        ) {
          return true;
        }

        if (
          chaveNormalizada &&
          arquivoNormalizado.includes(
            chaveNormalizada
          )
        ) {
          return true;
        }

        if (
          tipoNormalizado &&
          arquivoNormalizado.includes(
            tipoNormalizado
          )
        ) {
          return true;
        }

        if (
          chaveNormalizada ===
            "bombas" &&
          arquivoNormalizado.includes(
            "combustivel"
          )
        ) {
          return true;
        }

        return false;
      }
    );

  if (!catalogoEncontrado) {
    console.log(
      "🧠 Nenhum catálogo específico detectado. Usando configuração base."
    );

    return configuracao;
  }

  const [
    chaveEncontrada,
    catalogo,
  ] = catalogoEncontrado;

  console.log(
    "🔎 CATÁLOGO DETECTADO:",
    chaveEncontrada
  );

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

export async function motorImportacao({
  arquivo,
  fabricante = "",
  modoPreview = false,
  onProgresso,
}) {
  if (!arquivo) {
    throw new Error(
      "Nenhum catálogo foi selecionado."
    );
  }

  onProgresso?.(
    "🧠 Analisando estrutura do catálogo..."
  );

  const analise =
    await analisarCatalogo({
      arquivo,
      fabricante,
      onProgresso,
    });

  function montarTextoDasPaginas(
    paginas = [],
    inicio,
    fim
  ) {
    if (
      !Array.isArray(paginas) ||
      !inicio ||
      !fim
    ) {
      return "";
    }

    return paginas
      .filter((pagina) => {
        const numero =
          pagina.numeroPagina ||
          pagina.pagina;

        return (
          numero >= inicio &&
          numero <= fim
        );
      })
      .map((pagina) =>
        [
          `--- PÁGINA ${
            pagina.numeroPagina ||
            pagina.pagina
          } ---`,
          pagina.texto ||
          pagina.conteudo ||
          "",
        ].join("\n")
      )
      .join("\n\n");
  }

  const nomeArquivoNormalizado =
    normalizarTexto(
      arquivo.name
    )
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

   const ehFiltersMagnetiMarelli =
    nomeArquivoNormalizado.includes(
      "parts filters"
    );

  const ehBulbsMagnetiMarelli =
    nomeArquivoNormalizado.includes(
      "parts bulbs"
    ) ||
    nomeArquivoNormalizado.includes(
      "bulbs mm"
    );

  const ehBrakePadsMagnetiMarelli =
    nomeArquivoNormalizado.includes(
      "brake pads"
    ) ||
    nomeArquivoNormalizado.includes(
      "brake pad"
    ) ||
    nomeArquivoNormalizado.includes(
      "pastiglie freno"
    ) ||
    nomeArquivoNormalizado.includes(
      "pastilhas de freio"
    );

  const fabricanteInformado =
    String(
      fabricante || ""
    ).trim();

   const chaveFabricante =
    ehBrakePadsMagnetiMarelli ||
    ehFiltersMagnetiMarelli ||
    ehBulbsMagnetiMarelli
      ? "magneti_marelli"
      : fabricanteInformado
        ? fabricante
        : analise.chave;

  const configuracaoBase =
    obterConfiguracao(
      chaveFabricante
    );

  if (!configuracaoBase) {
    throw new Error(
      `Fabricante não suportado: ${
        analise.fabricante ||
        fabricante ||
        "não identificado"
      }.`
    );
  }

  const configuracao =
    selecionarConfiguracaoCatalogo(
      configuracaoBase,
      arquivo.name
    );

  if (!configuracao) {
    throw new Error(
      "Configuração do catálogo não encontrada."
    );
  }

  console.log(
    "CONFIGURAÇÃO FINAL DA IMPORTAÇÃO:",
    {
      arquivo:
        arquivo.name,

      tipoCatalogo:
        configuracao
          ?.tipoCatalogo,

      subTipoCatalogo:
        configuracao
          ?.subTipoCatalogo,

      paginaInicialAplicacoes:
        configuracao
          ?.paginaInicialAplicacoes,

      paginaFinalAplicacoes:
        configuracao
          ?.paginaFinalAplicacoes,
    }
  );

  const importar =
    obterImportador(
      chaveFabricante
    );

  if (!importar) {
    throw new Error(
      `Importador não encontrado para ${chaveFabricante}.`
    );
  }

  /*
   * =======================================================
   * MAGNETI MARELLI 2025
   * ALTERNATORS + STARTER MOTORS
   * =======================================================
   */

  const ehCatalogoCombinadoAlternadoresMarelli =
    configuracao
      ?.tipoCatalogo ===
      "alternadores_motores_partida" &&
    normalizarTexto(
      configuracao
        ?.fabricante
    ).includes(
      "magneti marelli"
    );

  if (
    ehCatalogoCombinadoAlternadoresMarelli
  ) {
    const configuracaoAlternadores =
      configuracao
        ?.alternadores;

    const configuracaoMotoresPartida =
      configuracao
        ?.motoresPartida;

    if (
      !configuracaoAlternadores ||
      !configuracaoMotoresPartida
    ) {
      throw new Error(
        "Configuração incompleta para Alternators and Starter Motors 2025."
      );
    }

    async function extrairSecao({
      titulo,
      tipoCatalogo,
      secao,
    }) {
      onProgresso?.(
        `⚙️ ${titulo}: preparando aplicações, referências e equivalências...`
      );

      const textoReferenciasSecao =
        secao
          .paginaInicialReferencias &&
        secao
          .paginaFinalReferencias
          ? await extrairFaixaPdf({
              arquivo,

              paginaInicial:
                secao
                  .paginaInicialReferencias,

              paginaFinal:
                secao
                  .paginaFinalReferencias,

              tipo:
                `${titulo} — referências`,

              onProgresso,
            })
          : "";

      const textoAplicacoesSecao =
        await extrairFaixaPdf({
          arquivo,

          paginaInicial:
            secao
              .paginaInicialAplicacoes,

          paginaFinal:
            secao
              .paginaFinalAplicacoes,

          tipo:
            `${titulo} — aplicações`,

          onProgresso,
        });

      if (!textoAplicacoesSecao) {
        throw new Error(
          `Nenhum texto de aplicações foi extraído para ${titulo}.`
        );
      }

      const textoEquivalenciasSecao =
        secao
          .paginaInicialEquivalencias &&
        secao
          .paginaFinalEquivalencias
          ? await extrairFaixaPdf({
              arquivo,

              paginaInicial:
                secao
                  .paginaInicialEquivalencias,

              paginaFinal:
                secao
                  .paginaFinalEquivalencias,

              tipo:
                `${titulo} — equivalências`,

              onProgresso,
            })
          : "";

      const resultado =
        await importar({
          textoReferencias:
            textoReferenciasSecao,

          textoAplicacoes:
            textoAplicacoesSecao,

          textoEquivalencias:
            textoEquivalenciasSecao,

          configuracao: {
            ...configuracao,
            ...secao,

            tipoCatalogo,

            origemCatalogo:
              configuracao
                .origemCatalogo,
          },

          nomeArquivo:
            arquivo.name,

          onProgresso,
        });

      return Array.isArray(
        resultado
      )
        ? resultado
        : resultado
            ?.registros ||
          [];
    }

    const alternadores =
      await extrairSecao({
        titulo:
          "Alternadores",

        tipoCatalogo:
          "alternadores",

        secao:
          configuracaoAlternadores,
      });

    const motoresPartida =
      await extrairSecao({
        titulo:
          "Motores de Partida",

        tipoCatalogo:
          "motores_partida",

        secao:
          configuracaoMotoresPartida,
      });

    const registros = [
      ...alternadores,
      ...motoresPartida,
    ];

    onProgresso?.(
      `✅ Magneti Marelli: ${registros.length} registro(s) encontrado(s).`
    );

    if (modoPreview) {
      return {
        fabricante:
          configuracao.fabricante ||
          analise.fabricante,

        configuracao,

        registros,

        total:
          registros.length,
      };
    }

    onProgresso?.(
      "💾 Gravando catálogo na Base APPIA..."
    );

    const resultadoSalvar =
      await salvarCatalogo({
        registros,

        fabricante:
          configuracao.fabricante ||
          analise.fabricante,

        origemCatalogo:
          configuracao.origemCatalogo ||
          arquivo.name,

        nomeArquivo:
          arquivo.name,

        onProgresso,
      });

    return {
      fabricante:
        configuracao.fabricante ||
        analise.fabricante,

      configuracao,

      registros,

      total:
        registros.length,

      ...resultadoSalvar,
    };
  }

  /*
   * =======================================================
   * EXTRAÇÃO NORMAL
   * =======================================================
   */

  const paginaInicialReferencias =
    configuracao
      ?.paginaInicialReferencias;

  const paginaFinalReferencias =
    configuracao
      ?.paginaFinalReferencias;

  const paginaInicialAplicacoes =
    configuracao
      ?.paginaInicialAplicacoes;

  const paginaFinalAplicacoes =
    configuracao
      ?.paginaFinalAplicacoes;

  const paginaInicialEquivalencias =
    configuracao
      ?.paginaInicialEquivalencias;

  const paginaFinalEquivalencias =
    configuracao
      ?.paginaFinalEquivalencias;

  /*
   * =======================================================
   * MAGNETI MARELLI — BICOS INJETORES 2016
   * =======================================================
   */

  const fabricanteNormalizado =
    normalizarTexto(
      configuracao
        ?.fabricante ||
      fabricante ||
      analise
        ?.fabricante
    );

  const tipoCatalogoNormalizado =
    normalizarTexto(
      configuracao
        ?.tipoCatalogo
    );

  const ehMagnetiMarelli =
    fabricanteNormalizado.includes(
      "magneti"
    ) ||
    fabricanteNormalizado.includes(
      "marelli"
    );
  /*
   * =======================================================
   * WEBER BATTERIES 2025
   * Forçar leitura direta do PDF
   * =======================================================
   */

  const ehBateriasWeber =
    ehMagnetiMarelli &&
    tipoCatalogoNormalizado ===
      "baterias_weber";

  /*
   * CORREÇÃO PRINCIPAL:
   *
   * tipoCatalogo chega como:
   *
   * sistemas_eletronicos
   *
   * e o identificador real dos bicos está em:
   *
   * subTipoCatalogo = bicos_injetores
   */

  const subTipoCatalogoNormalizado =
    normalizarTexto(
      configuracao
        ?.subTipoCatalogo
    );

  const ehBicosInjetoresMarelli =
    ehMagnetiMarelli &&
    (
      subTipoCatalogoNormalizado ===
        "bicos_injetores" ||
      tipoCatalogoNormalizado ===
        "bicosinjetores2016" ||
      tipoCatalogoNormalizado ===
        "bicos_injetores_2016" ||
      tipoCatalogoNormalizado ===
        "bicos injetores 2016"
    );

  /*
   * Para os bicos, agora este bloco realmente será executado.
   */

  const usarPaginasFixasBicosInjetoresMarelli =
    ehBicosInjetoresMarelli &&
    Array.isArray(
      analise?.paginas
    ) &&
    analise.paginas.length >
      0;

  let textoReferencias =
    "";

  let textoAplicacoes =
    "";
      let textoEquivalencias =
    "";

  /*
   * =======================================================
   * MAGNETI MARELLI — BICOS INJETORES 2016
   *
   * Estratégia especial:
   *
   * 1. reaproveitar analise.paginas;
   * 2. manter marcador de página;
   * 3. não transformar o catálogo inteiro em um bloco cego;
   * 4. entregar ao parser somente a faixa dos bicos;
   * 5. eliminar dependência da página 1379 fixa.
   * =======================================================
   */

  if (
    usarPaginasFixasBicosInjetoresMarelli
  ) {
    console.log(
      "======================================"
    );

    console.log(
      "💉 MARELLI BICOS 2016 — EXTRAÇÃO ESPECIAL"
    );

    console.log(
      "TIPO:",
      configuracao?.tipoCatalogo
    );

    console.log(
      "SUBTIPO:",
      configuracao?.subTipoCatalogo
    );

    console.log(
      "PÁGINAS DISPONÍVEIS:",
      analise.paginas.length
    );

    /*
     * -------------------------------------------------------
     * REFERÊNCIAS
     * -------------------------------------------------------
     */

    if (
      paginaInicialReferencias &&
      paginaFinalReferencias
    ) {
      textoReferencias =
        montarTextoDasPaginas(
          analise.paginas,
          paginaInicialReferencias,
          paginaFinalReferencias
        );
    }

    /*
     * -------------------------------------------------------
     * APLICAÇÕES
     * -------------------------------------------------------
     */

    if (
      paginaInicialAplicacoes &&
      paginaFinalAplicacoes
    ) {
      textoAplicacoes =
        montarTextoDasPaginas(
          analise.paginas,
          paginaInicialAplicacoes,
          paginaFinalAplicacoes
        );
    }

    /*
     * -------------------------------------------------------
     * EQUIVALÊNCIAS
     * -------------------------------------------------------
     */

    if (
      paginaInicialEquivalencias &&
      paginaFinalEquivalencias
    ) {
      textoEquivalencias =
        montarTextoDasPaginas(
          analise.paginas,
          paginaInicialEquivalencias,
          paginaFinalEquivalencias
        );
    }

    console.log(
      "💉 REFERÊNCIAS:",
      textoReferencias.length
    );

    console.log(
      "💉 APLICAÇÕES:",
      textoAplicacoes.length
    );

    console.log(
      "💉 EQUIVALÊNCIAS:",
      textoEquivalencias.length
    );

    /*
     * -------------------------------------------------------
     * DIAGNÓSTICO AUTOMÁTICO IWP099
     *
     * Agora não acrescentamos página manualmente.
     * Procuramos em TODAS as páginas já analisadas.
     * -------------------------------------------------------
     */

    const paginasIWP099 =
      analise.paginas.filter(
        (pagina) => {
          const conteudo =
            String(
              pagina?.texto ||
              pagina?.conteudo ||
              ""
            ).toUpperCase();

          return conteudo.includes(
            "IWP099"
          );
        }
      );

    console.log(
      "🎯 IWP099 — PÁGINAS ENCONTRADAS:",
      paginasIWP099.map(
        (pagina) =>
          pagina.numeroPagina ||
          pagina.pagina
      )
    );

    /*
     * Se o IWP099 estiver dentro da faixa normal,
     * ele já está em textoAplicacoes.
     *
     * Se estiver fora da faixa configurada,
     * recuperamos automaticamente a página encontrada
     * e também páginas vizinhas.
     *
     * Não existe mais página 1379 fixa.
     */

    if (
      paginasIWP099.length >
      0
    ) {
      const numerosExtras =
        new Set();

      for (
        const pagina
        of paginasIWP099
      ) {
        const numero =
          Number(
            pagina.numeroPagina ||
            pagina.pagina
          );

        if (
          !Number.isFinite(
            numero
          )
        ) {
          continue;
        }

        /*
         * Página anterior + atual + próxima.
         *
         * Isso ajuda quando:
         * código fica no fim de uma página
         * e aplicação começa na seguinte.
         */

        numerosExtras.add(
          numero - 1
        );

        numerosExtras.add(
          numero
        );

        numerosExtras.add(
          numero + 1
        );
      }

      const paginasExtras =
        analise.paginas
          .filter(
            (pagina) => {
              const numero =
                Number(
                  pagina.numeroPagina ||
                  pagina.pagina
                );

              if (
                !numerosExtras.has(
                  numero
                )
              ) {
                return false;
              }

              /*
               * Evita duplicar página que já pertence
               * à faixa normal de aplicações.
               */

              if (
                paginaInicialAplicacoes &&
                paginaFinalAplicacoes &&
                numero >=
                  paginaInicialAplicacoes &&
                numero <=
                  paginaFinalAplicacoes
              ) {
                return false;
              }

              return true;
            }
          )
          .sort(
            (a, b) =>
              Number(
                a.numeroPagina ||
                a.pagina ||
                0
              ) -
              Number(
                b.numeroPagina ||
                b.pagina ||
                0
              )
          );

      if (
        paginasExtras.length >
        0
      ) {
        const textoExtra =
          paginasExtras
            .map(
              (pagina) =>
                [
                  `--- PÁGINA ${
                    pagina.numeroPagina ||
                    pagina.pagina
                  } ---`,

                  pagina.texto ||
                  pagina.conteudo ||
                  "",
                ].join("\n")
            )
            .join(
              "\n\n"
            );

        textoAplicacoes = [
          textoAplicacoes,
          textoExtra,
        ]
          .filter(Boolean)
          .join("\n\n");

        console.log(
          "🎯 IWP099 — PÁGINAS EXTRAS:",
          paginasExtras.map(
            (pagina) =>
              pagina.numeroPagina ||
              pagina.pagina
          )
        );
      }
    }

    /*
     * Diagnóstico final antes do parser.
     */

    console.log(
      "🎯 IWP099 REFERÊNCIAS:",
      String(
        textoReferencias
      )
        .toUpperCase()
        .includes(
          "IWP099"
        )
    );

    console.log(
      "🎯 IWP099 APLICAÇÕES:",
      String(
        textoAplicacoes
      )
        .toUpperCase()
        .includes(
          "IWP099"
        )
    );

    console.log(
      "🎯 IWP099 EQUIVALÊNCIAS:",
      String(
        textoEquivalencias
      )
        .toUpperCase()
        .includes(
          "IWP099"
        )
    );

    console.log(
      "======================================"
    );
  } else {
    /*
     * =====================================================
     * EXTRAÇÃO NORMAL — TODOS OS OUTROS CATÁLOGOS
     * =====================================================
     */
    /*
     * =====================================================
     * WEBER BATTERIES — EXTRAÇÃO DIRETA
     * =====================================================
     */

    if (
      ehBateriasWeber
    ) {
      console.log(
        "🔋 WEBER — EXTRAÇÃO DIRETA DO PDF"
      );

      if (
        paginaInicialReferencias &&
        paginaFinalReferencias
      ) {
        textoReferencias =
          await extrairFaixaPdf({
            arquivo,

            paginaInicial:
              paginaInicialReferencias,

            paginaFinal:
              paginaFinalReferencias,

            tipo:
              "Weber — referências",

            onProgresso,
          });
      }

      if (
        paginaInicialAplicacoes &&
        paginaFinalAplicacoes
      ) {
        textoAplicacoes =
          await extrairFaixaPdf({
            arquivo,

            paginaInicial:
              paginaInicialAplicacoes,

            paginaFinal:
              paginaFinalAplicacoes,

            tipo:
              "Weber — aplicações",

            onProgresso,
          });
      }

      console.log(
        "🎯 MOTOR W60AGM:",
        (
          textoReferencias +
          "\n" +
          textoAplicacoes
        )
          .toUpperCase()
          .includes(
            "W60AGM"
          )
      );
    }
        if (
      !ehBateriasWeber &&
      paginaInicialReferencias &&
      paginaFinalReferencias
    ) {
      textoReferencias =
        montarTextoDasPaginas(
          analise.paginas,
          paginaInicialReferencias,
          paginaFinalReferencias
        );

      if (
        !textoReferencias
      ) {
        textoReferencias =
          await extrairFaixaPdf({
            arquivo,

            paginaInicial:
              paginaInicialReferencias,

            paginaFinal:
              paginaFinalReferencias,

            tipo:
              "referências",

            onProgresso,
          });
      }
    }

    if (
      paginaInicialAplicacoes &&
      paginaFinalAplicacoes
    ) {
      textoAplicacoes =
        montarTextoDasPaginas(
          analise.paginas,
          paginaInicialAplicacoes,
          paginaFinalAplicacoes
        );

      if (
        !textoAplicacoes
      ) {
        textoAplicacoes =
          await extrairFaixaPdf({
            arquivo,

            paginaInicial:
              paginaInicialAplicacoes,

            paginaFinal:
              paginaFinalAplicacoes,

            tipo:
              "aplicações",

            onProgresso,
          });
      }
    }

    if (
      paginaInicialEquivalencias &&
      paginaFinalEquivalencias
    ) {
      textoEquivalencias =
        montarTextoDasPaginas(
          analise.paginas,
          paginaInicialEquivalencias,
          paginaFinalEquivalencias
        );

      if (
        !textoEquivalencias
      ) {
        textoEquivalencias =
          await extrairFaixaPdf({
            arquivo,

            paginaInicial:
              paginaInicialEquivalencias,

            paginaFinal:
              paginaFinalEquivalencias,

            tipo:
              "equivalências",

            onProgresso,
          });
      }
    }
  }

  /*
   * =======================================================
   * FALLBACK
   * =======================================================
   */

  if (
    !textoAplicacoes &&
    Array.isArray(
      analise.paginas
    )
  ) {
    textoAplicacoes =
      analise.paginas
        .map(
          (pagina) =>
            [
              `--- PÁGINA ${
                pagina.numeroPagina ||
                pagina.pagina ||
                ""
              } ---`,

              pagina.texto ||
              pagina.conteudo ||
              "",
            ].join("\n")
        )
        .join(
          "\n\n"
        );
  }

  if (
    !textoAplicacoes
  ) {
    throw new Error(
      "Nenhum texto de aplicações foi extraído do catálogo."
    );
  }
  /*
   * =======================================================
   * DIAGNÓSTICO TEMPORÁRIO
   * MARELLI — MAÇANETAS / FECHADURAS
   * PÁGINA 17
   * =======================================================
   */

  const ehMacanetasFechadurasMarelli =
    ehMagnetiMarelli &&
    (
      tipoCatalogoNormalizado ===
        "macanetas_fechaduras" ||
      nomeArquivoNormalizado.includes(
        "door handles"
      )
    );

  if (
    ehMacanetasFechadurasMarelli &&
    Array.isArray(
      analise?.paginas
    )
  ) {
    const pagina17 =
      analise.paginas.find(
        (pagina) =>
          Number(
            pagina.numeroPagina ||
            pagina.pagina
          ) === 17
      );

    console.log(
      "======================================"
    );

    console.log(
      "🚪 DIAGNÓSTICO MARELLI — PÁGINA 17"
    );

    console.log(
      "🚪 TIPO:",
      configuracao?.tipoCatalogo
    );

    console.log(
      "🚪 PÁGINA ENCONTRADA:",
      Boolean(pagina17)
    );

    console.log(
      "🚪 TEXTO BRUTO PÁGINA 17:"
    );

    console.log(
      pagina17?.texto ||
      pagina17?.conteudo ||
      "SEM TEXTO"
    );

    console.log(
      "🚪 CONTÉM MMS0367:",
      String(
        pagina17?.texto ||
        pagina17?.conteudo ||
        ""
      )
        .toUpperCase()
        .includes(
          "MMS0367"
        )
    );

    console.log(
      "🚪 CONTÉM 735498779:",
      String(
        pagina17?.texto ||
        pagina17?.conteudo ||
        ""
      )
        .toUpperCase()
        .includes(
          "735498779"
        )
    );

    console.log(
      "======================================"
    );
  }
  /*
   * =======================================================
   * PÁGINAS PARA O IMPORTADOR
   * =======================================================
   */

  const paginasReferencias =
    textoReferencias
      ? criarPaginasDoTexto(
          textoReferencias,
          paginaInicialReferencias ||
            1
        )
      : [];

  const paginasAplicacoes =
    textoAplicacoes
      ? criarPaginasDoTexto(
          textoAplicacoes,
          paginaInicialAplicacoes ||
            1
        )
      : [];

  const paginasEquivalencias =
    textoEquivalencias
      ? criarPaginasDoTexto(
          textoEquivalencias,
          paginaInicialEquivalencias ||
            1
        )
      : [];

  /*
   * =======================================================
   * EXECUTAR IMPORTADOR
   * =======================================================
   */

  onProgresso?.(
    "🧠 Interpretando dados técnicos..."
  );

  const resultadoImportacao =
    await importar({
      textoReferencias,

      textoAplicacoes,

      textoEquivalencias,

      paginasReferencias,

      paginasAplicacoes,

      paginasEquivalencias,

      nomeArquivo:
        arquivo.name,

      configuracao,

      onProgresso,
    });

  const registros =
    Array.isArray(
      resultadoImportacao
    )
      ? resultadoImportacao
      : resultadoImportacao
          ?.registros ||
        [];

  console.log(
    "📦 REGISTROS INTERPRETADOS:",
    registros.length
  );

  /*
   * =======================================================
   * DIAGNÓSTICO FINAL IWP099
   * =======================================================
   */

  if (
    ehBicosInjetoresMarelli
  ) {
    const registrosIWP099 =
      registros.filter(
        (registro) => {
          const campos = [
            registro
              ?.codigo_oem,

            registro
              ?.codigo_equivalente,

            registro
              ?.codigo,

            registro
              ?.equivalente,

            registro
              ?.observacao,
          ]
            .filter(Boolean)
            .join(" ")
            .toUpperCase();

          return campos.includes(
            "IWP099"
          );
        }
      );

    console.log(
      "======================================"
    );

    console.log(
      "🎯 MOTOR — IWP099 REGISTROS:",
      registrosIWP099.length
    );

    console.log(
      "🎯 MOTOR — IWP099:",
      registrosIWP099
    );

    console.log(
      "======================================"
    );
  }

  /*
   * =======================================================
   * PREVIEW
   * =======================================================
   */

  if (modoPreview) {
    return {
      fabricante:
        configuracao.fabricante ||
        analise.fabricante,

      configuracao,

      registros,

      total:
        registros.length,
    };
  }

  /*
   * =======================================================
   * GRAVAÇÃO
   * =======================================================
   */

  onProgresso?.(
    "💾 Gravando catálogo na Base APPIA..."
  );

  const resultadoSalvar =
    await salvarCatalogo({
      registros,

      fabricante:
        configuracao.fabricante ||
        analise.fabricante,

      origemCatalogo:
        configuracao.origemCatalogo ||
        arquivo.name,

      nomeArquivo:
        arquivo.name,

      onProgresso,
    });

  onProgresso?.(
    `✅ ${
      configuracao.fabricante ||
      analise.fabricante ||
      fabricante
    }: ${registros.length} registro(s) encontrado(s).`
  );

  return {
    fabricante:
      configuracao.fabricante ||
      analise.fabricante,

    configuracao,

    registros,

    total:
      registros.length,

    ...resultadoSalvar,
  };
}

export default motorImportacao;