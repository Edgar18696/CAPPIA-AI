import { parserMagnetiMarelli } from "../parsers/parserMagnetiMarelli";

import { parserMagnetiMarelliBombasAgua } from "../parsers/parserMagnetiMarelliBombasAgua";

import { parserMagnetiMarelliTermostatos } from "../parsers/parserMagnetiMarelliTermostatos";

import { parserMagnetiMarelliAlternadores } from "../parsers/parserMagnetiMarelliAlternadores";

import { parserMagnetiMarelliMotoresPartida } from "../parsers/parserMagnetiMarelliMotoresPartida";

import { parserMagnetiMarelliUniversal } from "../parsers/parserMagnetiMarelliUniversal";

import { parserMagnetiMarelliPastilhasFreio } from "../parsers/parserMagnetiMarelliPastilhasFreio";

import { parserMagnetiMarelliDiscosFreio } from "../parsers/parserMagnetiMarelliDiscosFreio";

import { parserMagnetiMarelliBicos2016 } from "../parsers/parserMagnetiMarelliBicos2016";

import { parserMagnetiMarelliEGR } from "../parsers/parserMagnetiMarelliEGR";

import { parserMagnetiMarelliMacanetasFechaduras } from "../parsers/parserMagnetiMarelliMacanetasFechaduras";

import { parserMagnetiMarelliParachoques } from "../parsers/parserMagnetiMarelliParachoques";

import { parserMagnetiMarelliLampadas } from "../parsers/parserMagnetiMarelliLampadas";

import { parserMagnetiMarelliLimpadores } from "../parsers/parserMagnetiMarelliLimpadores";

import { parserMagnetiMarelliPalhetas } from "../parsers/parserMagnetiMarelliPalhetas";

import { parserMagnetiMarelliMaquinasVidro } from "../parsers/parserMagnetiMarelliMaquinasVidro";

import { parserMagnetiMarelliBateriasWeber } from "../parsers/parserMagnetiMarelliBateriasWeber";

import { parserMagnetiMarelliAmortecedores } from "../parsers/parserMagnetiMarelliAmortecedores";

import { parserMagnetiMarelliMap2016 } from "../parsers/parserMagnetiMarelliMap2016";

import { parserMagnetiMarelliThermalSystems } from "../parsers/parserMagnetiMarelliThermalSystems";

function removerDuplicados(registros = []) {
  const mapa = new Map();

  for (const registro of registros) {
    const chave = [
      registro.peca || "",
      registro.codigo_oem || "",
      registro.codigo_equivalente || "",
      registro.montadora || "",
      registro.modelo || "",
      registro.motor || "",
      registro.ano_inicio || "",
      registro.ano_fim || "",
      registro.aplicacao || "",
    ]
      .map((valor) =>
        String(valor)
          .trim()
          .toLowerCase()
      )
      .join("|");

    if (!mapa.has(chave)) {
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

export async function importarMagnetiMarelli({
  textoReferencias = "",
  textoAplicacoes = "",
  textoEquivalencias = "",
  nomeArquivo = "",
  configuracao = {},
  onProgresso,
}) {
  const tipoCatalogo =
    configuracao?.tipoCatalogo ||
    "catalogo_geral";

  const subTipoCatalogo =
    configuracao?.subTipoCatalogo ||
    "";

  onProgresso?.(
    `🔴 Importando Magneti Marelli: ${tipoCatalogo}...`
  );

  const parametrosBase = {
    textoReferencias,
    textoAplicacoes,
    textoEquivalencias,
    nomeArquivo,

    configuracao: {
      ...configuracao,

      tipoCatalogo,

      fabricante:
        "Magneti Marelli",
    },

    onProgresso,
  };

  /*
   * =======================================================
   * CATÁLOGO COMBINADO
   * ALTERNADORES + MOTORES DE PARTIDA
   * =======================================================
   */

  if (
    tipoCatalogo ===
    "alternadores_motores_partida"
  ) {
    onProgresso?.(
      "⚡ Importando alternadores..."
    );

    const alternadores =
      await parserMagnetiMarelliAlternadores({
        ...parametrosBase,

        configuracao: {
          ...parametrosBase.configuracao,

          tipoCatalogo:
            "alternadores",
        },
      });

    onProgresso?.(
      "⚙️ Importando motores de partida..."
    );

    const motoresPartida =
      await parserMagnetiMarelliMotoresPartida({
        ...parametrosBase,

        configuracao: {
          ...parametrosBase.configuracao,

          tipoCatalogo:
            "motores_partida",
        },
      });

    const registros =
      removerDuplicados([
        ...(
          Array.isArray(
            alternadores
          )
            ? alternadores
            : []
        ),

        ...(
          Array.isArray(
            motoresPartida
          )
            ? motoresPartida
            : []
        ),
      ]);

    console.log(
      "MARELLI ALTERNADORES:",
      Array.isArray(
        alternadores
      )
        ? alternadores.length
        : 0
    );

    console.log(
      "MARELLI MOTORES PARTIDA:",
      Array.isArray(
        motoresPartida
      )
        ? motoresPartida.length
        : 0
    );

    console.log(
      "MARELLI TOTAL COMBINADO:",
      registros.length
    );

    onProgresso?.(
      `✅ Magneti Marelli: ${registros.length} registro(s) encontrado(s).`
    );

    return registros;
  }

  /*
   * =======================================================
   * PARSERS ESPECÍFICOS
   * =======================================================
   */

  let parser = null;

  if (
    tipoCatalogo ===
    "bombas_agua"
  ) {
    parser =
      parserMagnetiMarelliBombasAgua;
  }

  if (
    tipoCatalogo ===
    "termostatos"
  ) {
    parser =
      parserMagnetiMarelliTermostatos;
  }
/*
 * =======================================================
 * THERMAL SYSTEMS 2022-2023
 * =======================================================
 */

if (
  tipoCatalogo ===
  "sistemas_termicos"
) {
  console.log(
    "🌡️ MARELLI THERMAL SYSTEMS: usando Parser Específico"
  );

  onProgresso?.(
    "🌡️ Thermal Systems 2022-2023: usando Parser Específico Magneti Marelli..."
  );

  parser =
    parserMagnetiMarelliThermalSystems;
}
  if (
    tipoCatalogo ===
    "alternadores"
  ) {
    parser =
      parserMagnetiMarelliAlternadores;
  }

    if (
    tipoCatalogo ===
    "motores_partida"
  ) {
    parser =
      parserMagnetiMarelliMotoresPartida;
  }

  /*
   * =======================================================
   * LÂMPADAS / BULBS
   * =======================================================
   */

  if (
    tipoCatalogo ===
    "lampadas"
  ) {
    console.log(
      "💡 MARELLI BULBS: usando Parser Específico"
    );

    onProgresso?.(
      "💡 Lâmpadas Magneti Marelli: usando Parser Específico..."
    );

    parser =
      parserMagnetiMarelliLampadas;
  }
  /*
   * =======================================================
   * WIPING SYSTEMS / SISTEMAS LIMPADORES
   * =======================================================
   */

  if (
    tipoCatalogo ===
    "sistemas_limpadores"
  ) {
    console.log(
      "🧽 MARELLI WIPING SYSTEMS: usando Parser Específico"
    );

    onProgresso?.(
      "🧽 Wiping Systems 2024: usando Parser Específico Magneti Marelli..."
    );

    parser =
      parserMagnetiMarelliLimpadores;
  }
  /*
   * =======================================================
   * MÁQUINAS DE VIDRO / WINDOW LIFTERS
   * =======================================================
   */

  if (
    tipoCatalogo ===
    "maquinas_vidro"
  ) {
    console.log(
      "🪟 MARELLI MÁQUINAS DE VIDRO: usando Parser Específico"
    );

    onProgresso?.(
      "🪟 Máquinas de Vidro Magneti Marelli: usando Parser Específico..."
    );

    parser =
      parserMagnetiMarelliMaquinasVidro;
  }

    /*
   * =======================================================
   * WIPER BLADES / PALHETAS
   * =======================================================
   */

  if (
    tipoCatalogo ===
    "palhetas"
  ) {
    console.log(
      "🌧️ MARELLI WIPER BLADES: usando Parser Específico"
    );

    onProgresso?.(
      "🌧️ Palhetas Magneti Marelli: usando Parser Específico..."
    );

    parser =
      parserMagnetiMarelliPalhetas;
  }
  /*
   * =======================================================
   * BRAKE PADS
   * =======================================================
   */

  if (
    tipoCatalogo ===
    "pastilhas_freio"
  ) {
    console.log(
      "🛑 MARELLI BRAKE PADS: usando Parser Específico"
    );

    onProgresso?.(
      "🛑 Brake Pads: usando Parser Específico Magneti Marelli..."
    );

    parser =
      parserMagnetiMarelliPastilhasFreio;
  }

  /*
   * =======================================================
   * BRAKE DISCS
   * =======================================================
   */

  if (
    tipoCatalogo ===
    "discos_freio"
  ) {
    console.log(
      "🛑 MARELLI BRAKE DISCS 2022: usando Parser Específico"
    );

    onProgresso?.(
      "🛑 Brake Discs 2022: usando Parser Específico Magneti Marelli..."
    );

    parser =
      parserMagnetiMarelliDiscosFreio;
  }

  /*
   * =======================================================
   * VÁLVULAS EGR 2019
   * =======================================================
   */

  if (
    tipoCatalogo ===
    "valvulas_egr"
  ) {
    console.log(
      "♻️ MARELLI EGR 2019: usando Parser Específico"
    );

    onProgresso?.(
      "♻️ Válvulas EGR 2019: usando Parser Específico Magneti Marelli..."
    );

    parser = async () => {
      const textoCompleto = [
        textoReferencias,
        textoAplicacoes,
        textoEquivalencias,
      ]
        .filter(Boolean)
        .join("\n");

      return parserMagnetiMarelliEGR(
        textoCompleto
      );
    };
  }

  /*
   * =======================================================
   * MAÇANETAS E FECHADURAS 2022-2023
   * =======================================================
   */

  if (
    tipoCatalogo ===
    "macanetas_fechaduras"
  ) {
    console.log(
      "🚪 MARELLI MAÇANETAS / FECHADURAS: usando Parser Específico"
    );

    onProgresso?.(
      "🚪 Maçanetas e Fechaduras 2022-2023: usando Parser Específico Magneti Marelli..."
    );

    parser =
      parserMagnetiMarelliMacanetasFechaduras;
  }

  /*
   * =======================================================
   * PARA-CHOQUES 2015-2016
   * =======================================================
   */

  if (
    tipoCatalogo ===
    "parachoques"
  ) {
    console.log(
      "🚘 MARELLI PARA-CHOQUES: usando Parser Específico"
    );

    onProgresso?.(
      "🚘 Para-choques 2015-2016: usando Parser Específico Magneti Marelli..."
    );

    /*
     * O parser de para-choques trabalha com páginas.
     * O motor atual entrega os textos consolidados.
     *
     * Criamos páginas virtuais mantendo separados
     * aplicações e equivalências.
     */

    parser = async () => {
      const paginasAplicacoes =
        textoAplicacoes
          ? [
              {
                numeroPagina: 1,
                texto:
                  textoAplicacoes,
              },
            ]
          : [];

      const paginasEquivalencias =
        textoEquivalencias
          ? [
              {
                numeroPagina: 1,
                texto:
                  textoEquivalencias,
              },
            ]
          : [];

      const resultado =
        parserMagnetiMarelliParachoques({
          paginasAplicacoes,
          paginasEquivalencias,

          configuracao: {
            ...configuracao,

            tipoCatalogo:
              "parachoques",

            fabricante:
              "Magneti Marelli",
          },

          onProgresso,
        });

      /*
       * O parser dedicado retorna objeto:
       *
       * {
       *   fabricante,
       *   registros,
       *   totalRegistros...
       * }
       *
       * O importador principal trabalha
       * com array de registros.
       */

      return Array.isArray(
        resultado
      )
        ? resultado
        : (
            Array.isArray(
              resultado?.registros
            )
              ? resultado.registros
              : []
          );
    };
  }

  /*
   * =======================================================
   * SISTEMA DE COMBUSTÍVEL
   * =======================================================
   */

  if (
    tipoCatalogo ===
    "sistema_combustivel"
  ) {
    parser =
      parserMagnetiMarelliUniversal;
  }

  /*
   * =======================================================
   * FILTROS
   * =======================================================
   */

  if (
    tipoCatalogo ===
    "filtros"
  ) {
    console.log(
      "🧠 MARELLI FILTROS: usando Parser Universal"
    );

    parser =
      parserMagnetiMarelliUniversal;
  }

  /*
   * =======================================================
   * KITS DISTRIBUIÇÃO
   * =======================================================
   */

  if (
    tipoCatalogo ===
    "kits_distribuicao"
  ) {
    console.log(
      "🧠 MARELLI ENGINE DRIVE SYSTEM KIT: usando Parser Universal"
    );

    parser =
      parserMagnetiMarelliUniversal;
  }

/*
 * =======================================================
 * SISTEMAS ELETRÔNICOS
 *
 * BICOS 2016 + MAP 2016 USAM PARSERS DEDICADOS.
 * RESTANTE CONTINUA NO UNIVERSAL.
 * =======================================================
 */

if (
  tipoCatalogo ===
  "sistemas_eletronicos"
) {
  if (
    subTipoCatalogo ===
    "bicos_injetores"
  ) {
    console.log(
      "💉 MARELLI BICOS 2016: usando Parser Dedicado"
    );

    onProgresso?.(
      "💉 Bicos Injetores 2016: usando Parser Dedicado Magneti Marelli..."
    );

    parser =
      parserMagnetiMarelliBicos2016;
  } else if (
    subTipoCatalogo ===
    "sensores_map"
  ) {
    console.log(
      "📡 MARELLI MAP 2016: usando Parser Dedicado"
    );

    onProgresso?.(
      "📡 Sensores MAP 2016: usando Parser Dedicado Magneti Marelli..."
    );

    parser =
      parserMagnetiMarelliMap2016;
  } else {
    console.log(
      "🧠 MARELLI ELECTRONIC SYSTEMS: usando Parser Universal"
    );

    onProgresso?.(
      "🧠 Electronic Systems and Ignition: usando Parser Universal Magneti Marelli..."
    );

    parser =
      parserMagnetiMarelliUniversal;
  }
}
  /*
   * =======================================================
   * WEBER BATTERIES 2025
   * =======================================================
   */

  if (
    tipoCatalogo ===
    "baterias_weber"
  ) {
    console.log(
      "🔋 MARELLI WEBER BATTERIES 2025: usando Parser Específico"
    );

    onProgresso?.(
      "🔋 Weber Batteries 2025: usando Parser Específico Magneti Marelli..."
    );

    parser =
      parserMagnetiMarelliBateriasWeber;
  }
  /*
   * =======================================================
   * AMORTECEDORES / SHOCK ABSORBERS 2019
   * =======================================================
   */

  if (
    tipoCatalogo ===
    "amortecedores"
  ) {
    console.log(
      "🛞 MARELLI AMORTECEDORES 2019: usando Parser Específico"
    );

    onProgresso?.(
      "🛞 Amortecedores 2019: usando Parser Específico Magneti Marelli..."
    );

    parser =
      parserMagnetiMarelliAmortecedores;
  }

  /*
   * =======================================================
   * BATTERIES 2024
   * =======================================================
   */

  if (
    tipoCatalogo ===
    "baterias_2024"
  ) {
    console.log(
      "🔋 MARELLI BATTERIES 2024: usando Parser Universal"
    );

    parser =
      parserMagnetiMarelliUniversal;
  }

  /*
   * =======================================================
   * CATÁLOGO GERAL
   * =======================================================
   */

  if (
    tipoCatalogo ===
    "catalogo_geral"
  ) {
    parser =
      parserMagnetiMarelli;
  }

  /*
   * =======================================================
   * FALLBACK UNIVERSAL
   * =======================================================
   */

  if (!parser) {
    console.log(
      "🧠 MARELLI: usando Parser Universal para:",
      tipoCatalogo
    );

    parser =
      parserMagnetiMarelliUniversal;
  }

  /*
   * =======================================================
   * DIAGNÓSTICO SIMPLES
   * =======================================================
   */

  console.log(
    "=========================================="
  );

  console.log(
    "🔎 MARELLI IMPORTAÇÃO"
  );

  console.log(
    "ARQUIVO:",
    nomeArquivo
  );

  console.log(
    "TIPO:",
    tipoCatalogo
  );

  console.log(
    "SUBTIPO:",
    subTipoCatalogo
  );

  console.log(
    "PARSER:",
    parser?.name ||
      "desconhecido"
  );

  console.log(
    "=========================================="
  );

  /*
   * =======================================================
   * EXECUÇÃO
   * =======================================================
   */

  const registros =
    await parser(
      parametrosBase
    );

  const registrosUnicos =
    removerDuplicados(
      Array.isArray(
        registros
      )
        ? registros
        : []
    );

  console.log(
    "MARELLI TIPO:",
    tipoCatalogo
  );

  console.log(
    "MARELLI SUBTIPO:",
    subTipoCatalogo
  );

  console.log(
    "MARELLI PARSER:",
    parser?.name ||
      "desconhecido"
  );

  console.log(
    "MARELLI REGISTROS:",
    registrosUnicos.length
  );

  /*
 * =======================================================
 * VALIDAÇÃO RÁPIDA — SISTEMAS ELETRÔNICOS / BICOS
 * =======================================================
 */

if (
  tipoCatalogo ===
  "sistemas_eletronicos"
) {
  const testeIwp058 =
    registrosUnicos.filter(
      (registro) => {
        const texto =
          JSON.stringify(
            registro
          )
            .toUpperCase();

        return (
          texto.includes(
            "805000347507"
          ) ||
          texto.includes(
            "IWP058"
          )
        );
      }
    );

  console.log(
    "=========================================="
  );

  console.log(
    "💉 MARELLI IWP058 — REGISTROS:",
    testeIwp058.length
  );

  console.log(
    "💉 MARELLI IWP058 — APLICAÇÕES:",
    testeIwp058
  );

  console.log(
    "=========================================="
  );
}
  /*
   * =======================================================
   * VALIDAÇÃO RÁPIDA EGR
   * =======================================================
   */

  if (
    tipoCatalogo ===
    "valvulas_egr"
  ) {
    const ev004 =
      registrosUnicos.filter(
        (registro) =>
          String(
            registro
              ?.codigo_oem ||
            ""
          )
            .toUpperCase()
            .replace(
              /[^A-Z0-9]/g,
              ""
            ) ===
          "EV004"
      );

    console.log(
      "♻️ EV004 — REGISTROS:",
      ev004.length
    );

    console.log(
      "♻️ EV004 — APLICAÇÕES:",
      ev004.slice(0, 5)
    );

    onProgresso?.(
      `✅ Válvulas EGR 2019: ${registrosUnicos.length} registro(s) encontrado(s).`
    );
  }

  /*
   * =======================================================
   * VALIDAÇÃO RÁPIDA MAÇANETAS / FECHADURAS
   * =======================================================
   */

  if (
    tipoCatalogo ===
    "macanetas_fechaduras"
  ) {
    const mms0367 =
      registrosUnicos.filter(
        (registro) =>
          String(
            registro
              ?.codigo_oem ||
            ""
          )
            .toUpperCase()
            .replace(
              /[^A-Z0-9]/g,
              ""
            ) ===
          "MMS0367"
      );

    console.log(
      "🚪 MMS0367 — REGISTROS:",
      mms0367.length
    );

    console.log(
      "🚪 MMS0367 — APLICAÇÕES:",
      mms0367.slice(0, 5)
    );

    onProgresso?.(
      `✅ Maçanetas e Fechaduras 2022-2023: ${registrosUnicos.length} registro(s) encontrado(s).`
    );
  }

  /*
   * =======================================================
   * VALIDAÇÃO RÁPIDA PARA-CHOQUES
   * =======================================================
   */

  if (
    tipoCatalogo ===
    "parachoques"
  ) {
    const bmp077f =
      registrosUnicos.filter(
        (registro) =>
          String(
            registro
              ?.codigo_oem ||
            ""
          )
            .toUpperCase()
            .replace(
              /[^A-Z0-9]/g,
              ""
            ) ===
          "BMP077F"
      );

    console.log(
      "🚘 BMP077F — REGISTROS:",
      bmp077f.length
    );

    console.log(
      "🚘 BMP077F — APLICAÇÕES:",
      bmp077f.slice(0, 10)
    );

    onProgresso?.(
      `✅ Para-choques Magneti Marelli: ${registrosUnicos.length} registro(s) encontrado(s).`
    );
  }

  return registrosUnicos;
}