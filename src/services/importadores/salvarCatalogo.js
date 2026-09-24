import { supabase } from "../../supabase";
import {
  montarBaseMestreV2,
  salvarBaseMestre,
} from "../inteligencia";
import enriquecerRegistro from "../inteligencia/enriquecerRegistro";
import { classificarEGravarCatalogoPecas } from "./protegerDuplicidadeCatalogo";

function textoOuNull(valor) {
  const texto = String(
    valor ?? ""
  ).trim();

  return texto || null;
}

/*
 * ============================================================
 * LIMPEZA DE MARCADORES ESTRUTURAIS DO PDF
 * ============================================================
 *
 * Impede valores internos do leitor PDF como:
 *
 * --- PÁGINA 641 ---
 * --- PAGINA 641 ---
 * PAGE 641
 *
 * de serem gravados como modelo,
 * montadora ou motor.
 *
 * A aplicação/observação original continua preservada.
 * ============================================================
 */

function ehMarcadorEstruturalPdf(
  valor
) {
  const texto = String(
    valor ?? ""
  )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .trim()
    .toUpperCase();

  if (!texto) {
    return false;
  }

  return (
    /^-*\s*PAGINA\s+\d+\s*-*$/.test(
      texto
    ) ||
    /^-*\s*PAGE\s+\d+\s*-*$/.test(
      texto
    )
  );
}

function textoEstruturadoOuNull(
  valor
) {
  if (
    ehMarcadorEstruturalPdf(
      valor
    )
  ) {
    return null;
  }

  return textoOuNull(
    valor
  );
}

/*
 * ============================================================
 * BATTERIES 2024 — PROTEÇÃO DE ORIGEM E CAMPOS
 * ============================================================
 */

function normalizarTextoComparacao(
  valor = ""
) {
  return String(
    valor ?? ""
  )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .trim()
    .toUpperCase();
}

function ehBateriaMagnetiMarelli2024({
  registro = {},
  fabricantePadrao = "",
  origemPadrao = "",
} = {}) {
  if (
    registro
      ?.__appia_bateria_marelli_2024 ===
    true
  ) {
    return true;
  }

  const texto =
    normalizarTextoComparacao(
      [
        registro?.tipo_catalogo,
        registro?.tipoCatalogo,
        registro?.origem_catalogo,
        registro?.origemCatalogo,
        registro?.arquivo_catalogo,
        registro?.arquivoCatalogo,
        fabricantePadrao,
        origemPadrao,
      ]
        .filter(Boolean)
        .join(" ")
    );

  return (
    texto.includes(
      "BATERIAS_2024"
    ) ||
    texto.includes(
      "BATTERIES 2024"
    ) ||
    texto.includes(
      "PARTS_BATTERIES_MM"
    ) ||
    texto.includes(
      "PARTS BATTERIES MM"
    )
  );
}

function corrigirBateriaMagnetiMarelli2024(
  registro = {}
) {
  return {
    ...registro,

    __appia_bateria_marelli_2024:
      true,

    peca:
      "Bateria",

    descricao:
      "Bateria",

    fabricante:
      "Magneti Marelli",

    montadora: null,
    modelo: null,
    motor: null,

    origem_catalogo:
      "Catálogo Magneti Marelli Batteries 2024",

    origemCatalogo:
      "Catálogo Magneti Marelli Batteries 2024",

    tipo_catalogo:
      "baterias_2024",
  };
}

function numeroOuNull(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return null;
  }

  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : null;
}

function montarDados(
  registro,
  fabricantePadrao,
  origemPadrao
) {
  const equivalentes = Array.isArray(
    registro.equivalentes
  )
    ? registro.equivalentes
        .map((item) => {
          if (
            typeof item ===
            "string"
          ) {
            return item;
          }

          return item?.codigo;
        })
        .filter(Boolean)
    : [];

  const ehBateria2024 =
    ehBateriaMagnetiMarelli2024({
      registro,
      fabricantePadrao,
      origemPadrao,
    });

  /*
   * ============================================================
   * MAGNETI MARELLI — MÁQUINAS DE VIDRO
   * ============================================================
   *
   * Preserva juntos:
   *
   * código LONG Magneti Marelli
   * +
   * equivalências OES
   *
   * Exemplo:
   *
   * AC383
   * 350103383000
   * 8340257B00
   * ============================================================
   */

  const textoMaquinasVidro =
    normalizarTextoComparacao(
      [
        registro?.familia_catalogo,
        registro?.categoria,
        registro?.subcategoria,
        registro?.sistema,
        registro?.origem_catalogo,
        registro?.origemCatalogo,
        origemPadrao,
      ]
        .filter(Boolean)
        .join(" ")
    );

  const ehMaquinasVidroMarelli =
    textoMaquinasVidro.includes(
      "MAQUINAS DE VIDRO"
    ) ||
    textoMaquinasVidro.includes(
      "WINDOW LIFTER"
    ) ||
    textoMaquinasVidro.includes(
      "WINDOW LIFTERS"
    );

  const equivalentesMaquinasVidro =
    ehMaquinasVidroMarelli
      ? [
          textoOuNull(
            registro.codigo_equivalente
          ),

          ...equivalentes,
        ]
          .filter(Boolean)
          .filter(
            (
              valor,
              indice,
              array
            ) =>
              array.findIndex(
                (item) =>
                  normalizarTextoComparacao(
                    item
                  ) ===
                  normalizarTextoComparacao(
                    valor
                  )
              ) === indice
          )
      : [];

  /*
   * ============================================================
   * MAGNETI MARELLI — LÂMPADAS / BULBS
   * ============================================================
   */

  const textoLampada =
    normalizarTextoComparacao(
      [
        registro?.tipo_catalogo,
        registro?.tipoCatalogo,
        registro?.origem_catalogo,
        registro?.origemCatalogo,
        origemPadrao,
        fabricantePadrao,
      ]
        .filter(Boolean)
        .join(" ")
    );

  const ehLampadaMarelli =
    textoLampada.includes(
      "MAGNETI MARELLI"
    ) &&
    (
      textoLampada.includes(
        "BULBS"
      ) ||
      textoLampada.includes(
        "LAMPADAS"
      ) ||
      textoLampada.includes(
        "LAMPADA"
      )
    );

  /*
   * Exemplo de linha original:
   *
   * H7 12V 002557100000 H7 55 12 PX26d
   */

  const observacaoOriginal =
    textoOuNull(
      registro.observacao
    ) ||
    "";

  let tipoLampada =
    textoOuNull(
      registro.tipo_lampada
    );

  let codigoCurtoLampada =
    null;

  let potenciaLampada =
    textoOuNull(
      registro.potencia
    );

  let voltagemLampada =
    textoOuNull(
      registro.voltagem
    );

  let soqueteLampada =
    textoOuNull(
      registro.soquete
    );

  if (
    ehLampadaMarelli
  ) {
    const codigoPrincipal =
      textoOuNull(
        registro.codigo_oem
      ) ||
      textoOuNull(
        registro.codigo
      ) ||
      "";

    /*
     * Recupera código curto:
     *
     * H7 12V
     *
     * tudo que aparece antes
     * do código Marelli de 12 dígitos.
     */

    if (
      codigoPrincipal &&
      observacaoOriginal.includes(
        codigoPrincipal
      )
    ) {
      const antesCodigo =
        observacaoOriginal
          .split(
            codigoPrincipal
          )[0]
          .trim();

      if (
        antesCodigo
      ) {
        codigoCurtoLampada =
          antesCodigo;
      }

      /*
       * Recupera:
       *
       * H7 55 12 PX26d
       */

      const depoisCodigo =
        observacaoOriginal
          .split(
            codigoPrincipal
          )
          .slice(1)
          .join(" ")
          .trim();

      const partes =
        depoisCodigo
          .split(/\s+/)
          .filter(Boolean);

      if (
        !tipoLampada &&
        partes[0]
      ) {
        tipoLampada =
          partes[0];
      }

      if (
        !potenciaLampada &&
        partes[1]
      ) {
        potenciaLampada =
          partes[1];
      }

      if (
        !voltagemLampada &&
        partes[2]
      ) {
        voltagemLampada =
          partes[2];
      }

      if (
        !soqueteLampada &&
        partes[3]
      ) {
        soqueteLampada =
          partes
            .slice(3)
            .join(" ");
      }
    }

    /*
     * Fallback pelo registro.
     */

    if (
      !tipoLampada
    ) {
      tipoLampada =
        textoOuNull(
          registro.tipo
        );
    }

    /*
     * STANDARD não é tipo da lâmpada.
     */

    if (
      normalizarTextoComparacao(
        tipoLampada
      ) ===
      "STANDARD"
    ) {
      tipoLampada =
        null;
    }
  }

  const nomePecaLampada =
    ehLampadaMarelli
      ? (
          tipoLampada
            ? `Lâmpada Automotiva ${tipoLampada}`
            : "Lâmpada Automotiva"
        )
      : null;

  const observacaoLampada =
    ehLampadaMarelli
      ? [
          tipoLampada
            ? `Tipo: ${tipoLampada}`
            : "",

          potenciaLampada
            ? `Potência: ${potenciaLampada} W`
            : "",

          voltagemLampada
            ? `Voltagem: ${voltagemLampada} V`
            : "",

          soqueteLampada
            ? `Soquete: ${soqueteLampada}`
            : "",

          codigoCurtoLampada
            ? `Código curto: ${codigoCurtoLampada}`
            : "",

          observacaoOriginal
            ? `Linha original: ${observacaoOriginal}`
            : "",
        ]
          .filter(Boolean)
          .join(" | ")
      : null;

  return {
    peca:
      ehBateria2024
        ? "Bateria"
        : ehLampadaMarelli
          ? nomePecaLampada
          : (
              textoOuNull(
                registro.peca
              ) ||
              textoOuNull(
                registro.descricao
              ) ||
              "Peça automotiva"
            ),

    codigo_oem:
      textoOuNull(
        registro.codigo_oem
      ) ||
      textoOuNull(
        registro.codigo_bosch
      ) ||
      textoOuNull(
        registro.codigo
      ),

        codigo_equivalente:
      ehLampadaMarelli
        ? (
            codigoCurtoLampada ||
            textoOuNull(
              registro.codigo_equivalente
            )
          )
        : ehMaquinasVidroMarelli
          ? (
              equivalentesMaquinasVidro.length > 0
                ? equivalentesMaquinasVidro.join(
                    ", "
                  )
                : null
            )
          : (
              equivalentes.length > 0
                ? equivalentes.join(", ")
                : textoOuNull(
                    registro.codigo_equivalente
                  )
            ),

    fabricante:
      textoOuNull(
        registro.fabricante
      ) ||
      textoOuNull(
        fabricantePadrao
      ) ||
      "APPIA",

    origem_catalogo:
      ehBateria2024
        ? "Catálogo Magneti Marelli Batteries 2024"
        : (
            textoOuNull(
              registro.origem_catalogo
            ) ||
            textoOuNull(
              registro.origemCatalogo
            ) ||
            textoOuNull(
              origemPadrao
            ) ||
            "Catálogo técnico"
          ),

    familia_catalogo:
      textoOuNull(
        registro.familia_catalogo
      ) ||
      textoOuNull(
        registro.familia
      ),

    categoria:
      ehLampadaMarelli
        ? "Iluminação"
        : textoOuNull(
            registro.categoria
          ),

    sistema:
      ehLampadaMarelli
        ? "Iluminação Automotiva"
        : textoOuNull(
            registro.sistema
          ),

    tipo:
      ehLampadaMarelli
        ? (
            tipoLampada ||
            "Lâmpada"
          )
        : textoOuNull(
            registro.tipo
          ),

    confianca_inteligencia:
      numeroOuNull(
        registro.confianca_inteligencia
      ) ||
      numeroOuNull(
        registro.inteligencia
          ?.confianca
      ),

    /*
     * Catálogo Bulbs NÃO possui
     * aplicação por veículo.
     */

    montadora:
      ehBateria2024 ||
      ehLampadaMarelli
        ? null
        : textoEstruturadoOuNull(
            registro.montadora
          ),

    modelo:
      ehBateria2024 ||
      ehLampadaMarelli
        ? null
        : textoEstruturadoOuNull(
            registro.modelo
          ),

    motor:
      ehBateria2024 ||
      ehLampadaMarelli
        ? null
        : textoEstruturadoOuNull(
            registro.motor
          ),

    ano_inicio:
      ehLampadaMarelli
        ? null
        : numeroOuNull(
            registro.ano_inicio
          ),

    ano_fim:
      ehLampadaMarelli
        ? null
        : numeroOuNull(
            registro.ano_fim
          ),

    observacao:
      ehLampadaMarelli
        ? observacaoLampada
        : (
            textoOuNull(
              registro.observacao
            ) ||
            textoOuNull(
              registro.tipo
            ) ||
            textoOuNull(
              registro.descricao
            )
          ),

    ativo:
      registro.ativo !== false,

    prioridade:
      numeroOuNull(
        registro.prioridade
      ) || 1,

    confiabilidade:
      numeroOuNull(
        registro.confiabilidade
      ) || 100,
  };
}

function normalizarChave(
  valor
) {
  return String(
    valor ?? ""
  )
    .trim()
    .toUpperCase();
}

function criarChaveCompatibilidade(
  item
) {
  return [
    item.codigo_oem,
    item.montadora,
    item.modelo,
    item.motor,
    item.ano_inicio,
    item.ano_fim,
    item.peca,
    item.origem_catalogo,
  ]
    .map(
      normalizarChave
    )
    .join("|");
}

function removerDuplicadosCompatibilidade(
  registros
) {
  const mapa =
    new Map();

  for (
    const registro
    of registros
  ) {
    const chave =
      criarChaveCompatibilidade(
        registro
      );

    const existente =
      mapa.get(
        chave
      );

    if (!existente) {
      mapa.set(
        chave,
        registro
      );

      continue;
    }

    mapa.set(
      chave,
      {
        ...existente,

        codigo_equivalente:
          juntarValoresUnicos(
            existente
              .codigo_equivalente,
            registro
              .codigo_equivalente
          ),

        observacao:
          existente
            .observacao ||
          registro
            .observacao,

        origem_catalogo:
          existente
            .origem_catalogo ||
          registro
            .origem_catalogo,
      }
    );
  }

  return Array.from(
    mapa.values()
  );
}

function separarCodigos(
  valor
) {
  return String(
    valor ?? ""
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

function juntarValoresUnicos(
  valorAtual,
  novoValor
) {
  const valores = [
    ...separarCodigos(
      valorAtual
    ),
    ...separarCodigos(
      novoValor
    ),
  ];

  const mapa =
    new Map();

  for (
    const valor
    of valores
  ) {
    mapa.set(
      normalizarChave(
        valor
      ),
      valor
    );
  }

  const resultado =
    Array.from(
      mapa.values()
    );

  return resultado.length > 0
    ? resultado.join(", ")
    : null;
}

function montarDadosCatalogoMestre(
  registros
) {
  const mapa =
    new Map();

  for (
    const registro
    of registros
  ) {
    const chave = [
      registro.codigo_oem,
      registro.fabricante,
    ]
      .map(
        normalizarChave
      )
      .join("|");

    const existente =
      mapa.get(
        chave
      );

    if (!existente) {
      mapa.set(
        chave,
        {
          peca:
            registro.peca,

          codigo_oem:
            registro
              .codigo_oem,

          codigo_equivalente:
            registro
              .codigo_equivalente,

          fabricante:
            registro
              .fabricante,

          origem_catalogo:
            registro
              .origem_catalogo,

          observacao:
            registro
              .observacao,

          ativo:
            registro.ativo,

          prioridade:
            registro.prioridade,

          confiabilidade:
            registro
              .confiabilidade,
        }
      );

      continue;
    }

    mapa.set(
      chave,
      {
        ...existente,

        familia_catalogo:
          registro
            .familia_catalogo,

        categoria:
          registro.categoria,

        sistema:
          registro.sistema,

        tipo:
          registro.tipo,

        confianca_inteligencia:
          registro
            .confianca_inteligencia,

        peca:
          existente.peca ||
          registro.peca,

        codigo_equivalente:
          juntarValoresUnicos(
            existente
              .codigo_equivalente,
            registro
              .codigo_equivalente
          ),

        origem_catalogo:
          existente
            .origem_catalogo ||
          registro
            .origem_catalogo,

        observacao:
          existente
            .observacao ||
          registro
            .observacao,

        ativo:
          existente.ativo ||
          registro.ativo,

        prioridade:
          Math.min(
            existente
              .prioridade ||
              1,
            registro
              .prioridade ||
              1
          ),

        confiabilidade:
          Math.max(
            existente
              .confiabilidade ||
              0,
            registro
              .confiabilidade ||
              0
          ),
      }
    );
  }

  return Array.from(
    mapa.values()
  );
}

async function salvarLoteNaTabela({
  tabela,
  lote,
  numeroLote,
  colunasConflito,
}) {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        tabela
      )
      .upsert(
        lote,
        {
          onConflict:
            colunasConflito,

          ignoreDuplicates:
            false,
        }
      )
      .select(
        "id"
      );

  if (error) {
    console.error(
      `Erro ao salvar lote ${numeroLote} em ${tabela}:`,
      error
    );

    throw {
      tabela,

      lote:
        numeroLote,

      quantidade:
        lote.length,

      codigo:
        error.code ||
        null,

      mensagem:
        error.message ||
        null,

      detalhe:
        error.details ||
        null,
    };
  }

  return Array.isArray(
    data
  )
    ? data.length
    : lote.length;
}

async function salvarEmLotes({
  tabela,
  registros,
  tamanhoLote,
  colunasConflito,
  onProgresso,
  mensagem,
}) {
  const totalLotes =
    Math.ceil(
      registros.length /
        tamanhoLote
    );

  let totalGravados =
    0;

  for (
    let inicio = 0;
    inicio <
    registros.length;
    inicio += tamanhoLote
  ) {
    const numeroLote =
      Math.floor(
        inicio /
          tamanhoLote
      ) + 1;

    const lote =
      registros.slice(
        inicio,
        inicio +
          tamanhoLote
      );

    onProgresso?.(
      `💾 ${mensagem} — lote ${numeroLote} de ${totalLotes}...`
    );

    const quantidade =
      await salvarLoteNaTabela({
        tabela,
        lote,
        numeroLote,
        colunasConflito,
      });

    totalGravados +=
      quantidade;

    onProgresso?.(
      `✅ ${mensagem} — ${totalGravados} de ${registros.length}.`
    );
  }

  return totalGravados;
}

const CONFLITO_CATALOGO_PECAS =
  "montadora,modelo,ano_inicio,ano_fim,motor,peca,codigo_oem,origem_catalogo";

const CONFLITO_CATALOGO_MESTRE =
  "codigo_oem,fabricante";

function criarEscoposCatalogo(
  registros = []
) {
  const mapa =
    new Map();

  for (
    const registro
    of registros
  ) {
    const fabricante =
      textoOuNull(
        registro.fabricante
      );

    const origemCatalogo =
      textoOuNull(
        registro.origem_catalogo
      );

    if (
      !fabricante ||
      !origemCatalogo
    ) {
      continue;
    }

    const chave = [
      normalizarChave(
        fabricante
      ),
      normalizarChave(
        origemCatalogo
      ),
    ].join("|");

    if (
      !mapa.has(
        chave
      )
    ) {
      mapa.set(
        chave,
        {
          fabricante,
          origemCatalogo,
        }
      );
    }
  }

  return Array.from(
    mapa.values()
  );
}

async function limparLegadoBateriasMarelli2024({
  registros = [],
  onProgresso,
}) {
  const registrosBateria =
    registros.filter(
      (registro) =>
        normalizarTextoComparacao(
          registro?.origem_catalogo
        ) ===
        normalizarTextoComparacao(
          "Catálogo Magneti Marelli Batteries 2024"
        )
    );

  if (
    registrosBateria.length ===
    0
  ) {
    return;
  }

  const codigos = [
    ...new Set(
      registrosBateria
        .map(
          (registro) =>
            textoOuNull(
              registro.codigo_oem
            )
        )
        .filter(Boolean)
    ),
  ];

  if (
    codigos.length ===
    0
  ) {
    return;
  }

  onProgresso?.(
    "🧹 Limpando registros antigos incorretos de Batteries 2024..."
  );

  const TAMANHO_LOTE =
    100;

  for (
    let inicio = 0;
    inicio <
    codigos.length;
    inicio += TAMANHO_LOTE
  ) {
    const lote =
      codigos.slice(
        inicio,
        inicio +
          TAMANHO_LOTE
      );

    const {
      error,
    } =
      await supabase
        .from(
          "catalogo_pecas"
        )
        .delete()
        .eq(
          "fabricante",
          "Magneti Marelli"
        )
        .in(
          "codigo_oem",
          lote
        )
        .ilike(
          "origem_catalogo",
          "%Weber Baterias%"
        );

    if (error) {
      console.warn(
        "⚠️ Não foi possível limpar registro legado de bateria:",
        error
      );
    }
  }
}

function ehErroTimeoutSupabase(
  erro
) {
  const codigo = String(
    erro?.code || ""
  ).toLowerCase();

  const mensagem = String(
    erro?.message || ""
  ).toLowerCase();

  return (
    codigo === "57014" ||
    mensagem.includes(
      "statement timeout"
    ) ||
    mensagem.includes(
      "canceling statement due to statement timeout"
    )
  );
}

async function limparVersaoAnteriorCatalogo({
  registros = [],
  onProgresso,
}) {
  const escopos =
    criarEscoposCatalogo(
      registros
    );

  if (
    escopos.length === 0
  ) {
    return;
  }

  const LIMITE_LIMPEZA_DIRETA =
    3000;

  const TAMANHO_LOTE_LIMPEZA =
    500;

  function ehBrakeDiscsMagneti(
    escopo
  ) {
    const fabricante =
      normalizarTextoComparacao(
        escopo.fabricante
      );

    const origem =
      normalizarTextoComparacao(
        escopo.origemCatalogo
      );

    return (
      fabricante ===
        "MAGNETI MARELLI" &&
      (
        origem.includes(
          "BRAKE DISCS"
        ) ||
        origem.includes(
          "BRAKE DISC"
        )
      )
    );
  }

    async function limparTabelaEmLotes({
    tabela,
    fabricante,
    origemCatalogo,
    descricao,
  }) {
    let totalRemovidos =
      0;

    let numeroLote =
      0;

    while (true) {
      numeroLote += 1;

      const {
        data:
          registrosEncontrados,
        error:
          erroBusca,
      } =
        await supabase
          .from(
            tabela
          )
          .select("id")
          .eq(
            "fabricante",
            fabricante
          )
          .eq(
            "origem_catalogo",
            origemCatalogo
          )
          .limit(
            TAMANHO_LOTE_LIMPEZA
          );

      /*
       * =====================================================
       * PROTEÇÃO CONTRA TIMEOUT
       * =====================================================
       *
       * A limpeza da versão anterior é útil,
       * mas NÃO pode impedir uma nova importação.
       *
       * Se o Supabase demorar demais procurando
       * registros antigos, seguimos normalmente
       * para o UPSERT.
       * =====================================================
       */

      if (erroBusca) {
        if (
          ehErroTimeoutSupabase(
            erroBusca
          )
        ) {
          console.warn(
            `⚠️ Timeout procurando registros antigos em ${tabela}. Limpeza ignorada; importação seguirá por UPSERT.`,
            {
              fabricante,
              origemCatalogo,
            }
          );

          onProgresso?.(
            `🛡️ ${descricao}: consulta antiga excedeu o tempo. Continuando por UPSERT...`
          );

          return totalRemovidos;
        }

        throw new Error(
          `Não foi possível localizar registros antigos em ${tabela}: ${erroBusca.message}`
        );
      }

      const ids =
        Array.isArray(
          registrosEncontrados
        )
          ? registrosEncontrados
              .map(
                (item) =>
                  item?.id
              )
              .filter(Boolean)
          : [];

      if (
        ids.length === 0
      ) {
        break;
      }

      onProgresso?.(
        `🧹 ${descricao} — lote ${numeroLote}, removendo ${ids.length} registro(s)...`
      );

      const {
        error:
          erroDelete,
      } =
        await supabase
          .from(
            tabela
          )
          .delete()
          .in(
            "id",
            ids
          );

      if (erroDelete) {
        /*
         * DELETE também não pode derrubar
         * a importação inteira por timeout.
         */

        if (
          ehErroTimeoutSupabase(
            erroDelete
          )
        ) {
          console.warn(
            `⚠️ Timeout removendo registros antigos em ${tabela}. Limpeza interrompida; importação seguirá por UPSERT.`,
            {
              lote:
                numeroLote,

              fabricante,

              origemCatalogo,
            }
          );

          onProgresso?.(
            `🛡️ ${descricao}: limpeza excedeu o tempo. Continuando por UPSERT...`
          );

          return totalRemovidos;
        }

        throw new Error(
          `Não foi possível remover registros antigos de ${tabela}: ${erroDelete.message}`
        );
      }

      totalRemovidos +=
        ids.length;

      console.log(
        `🧹 ${tabela} — lote ${numeroLote}: ${ids.length} removidos. Total: ${totalRemovidos}`
      );

      onProgresso?.(
        `✅ ${descricao} — ${totalRemovidos} registro(s) antigo(s) removido(s)...`
      );
    }

    return totalRemovidos;
  }

  const possuiBrakeDiscs =
    escopos.some(
      ehBrakeDiscsMagneti
    );

  if (
    registros.length >
      LIMITE_LIMPEZA_DIRETA &&
    !possuiBrakeDiscs
  ) {
    console.warn(
      "⚠️ Limpeza prévia ignorada para catálogo grande:",
      registros.length,
      "registros. A atualização seguirá por UPSERT."
    );

    onProgresso?.(
      `🛡️ Catálogo grande (${registros.length} registros): mantendo versão atual e atualizando por UPSERT...`
    );

    return;
  }

  for (
    const escopo
    of escopos
  ) {
    const ehBrakeDiscs =
      ehBrakeDiscsMagneti(
        escopo
      );

    if (
      registros.length >
        LIMITE_LIMPEZA_DIRETA &&
      !ehBrakeDiscs
    ) {
      continue;
    }

    if (ehBrakeDiscs) {
      console.log(
        "=========================================="
      );

      console.log(
        "🧹 APPIA — LIMPEZA BRAKE DISCS EM LOTES"
      );

      console.log(
        "FABRICANTE:",
        escopo.fabricante
      );

      console.log(
        "ORIGEM:",
        escopo.origemCatalogo
      );

      onProgresso?.(
        "🧹 Limpando versão antiga do Magneti Marelli Brake Discs em lotes..."
      );

      const removidosCatalogo =
        await limparTabelaEmLotes({
          tabela:
            "catalogo_pecas",

          fabricante:
            escopo.fabricante,

          origemCatalogo:
            escopo.origemCatalogo,

          descricao:
            "Limpando aplicações antigas do Brake Discs",
        });

      const removidosMestre =
        await limparTabelaEmLotes({
          tabela:
            "catalogo_mestre",

          fabricante:
            escopo.fabricante,

          origemCatalogo:
            escopo.origemCatalogo,

          descricao:
            "Limpando Base Mestre antiga do Brake Discs",
        });

      console.log(
        "✅ Brake Discs antigo removido:",
        {
          catalogo_pecas:
            removidosCatalogo,

          catalogo_mestre:
            removidosMestre,
        }
      );

      console.log(
        "=========================================="
      );

      onProgresso?.(
        `✅ Brake Discs antigo removido (${removidosCatalogo} aplicações). Gravando versão corrigida...`
      );

      continue;
    }

    /*
     * ======================================================
     * DEMAIS CATÁLOGOS
     * ======================================================
     *
     * CORREÇÃO:
     *
     * Também limpamos em lotes por ID.
     *
     * Isso evita o DELETE gigante por fabricante + origem,
     * que estava causando statement timeout no Supabase e
     * deixando registros antigos misturados com a nova versão.
     * ======================================================
     */

    onProgresso?.(
      `🧹 Limpando versão anterior de ${escopo.origemCatalogo} em lotes...`
    );

    const removidosCatalogo =
      await limparTabelaEmLotes({
        tabela:
          "catalogo_pecas",

        fabricante:
          escopo.fabricante,

        origemCatalogo:
          escopo.origemCatalogo,

        descricao:
          `Limpando aplicações antigas de ${escopo.origemCatalogo}`,
      });

    const removidosMestre =
      await limparTabelaEmLotes({
        tabela:
          "catalogo_mestre",

        fabricante:
          escopo.fabricante,

        origemCatalogo:
          escopo.origemCatalogo,

        descricao:
          `Limpando Base Mestre antiga de ${escopo.origemCatalogo}`,
      });

    console.log(
      "✅ Versão anterior removida em lotes:",
      {
        origem:
          escopo.origemCatalogo,

        catalogo_pecas:
          removidosCatalogo,

        catalogo_mestre:
          removidosMestre,
      }
    );

    onProgresso?.(
      `✅ Versão anterior removida (${removidosCatalogo} aplicações). Gravando versão atual...`
    );
  }
}
export async function salvarCatalogo({
  registros = [],
  fabricante = "",
  origemCatalogo = "",
  onProgresso,
} = {}) {
  if (
    !Array.isArray(registros) ||
    registros.length === 0
  ) {
    return {
      sucesso: false,
      totalRecebidos: 0,
      totalValidos: 0,
      totalUnicos: 0,
      totalGravados: 0,
      totalMestre: 0,
      mensagem:
        "Nenhum registro válido para salvar.",
    };
  }

  onProgresso?.(
    `🧠 Preparando ${registros.length} registro(s)...`
  );

  /*
   * ============================================================
   * MAGNETI MARELLI — BICOS INJETORES 2016
   * ============================================================
   *
   * O parser dedicado já entrega:
   *
   * código
   * montadora
   * modelo
   * motor
   * período
   *
   * Portanto NÃO passamos estes registros pelo enriquecimento
   * genérico do APPIA.
   *
   * Isso impede a Base Mestre antiga de recolocar:
   *
   * B03
   * OTHER
   * aplicações antigas/incorretas
   * ============================================================
   */

  const origemNormalizada =
    normalizarTextoComparacao(
      [
        origemCatalogo,
        fabricante,
        registros[0]
          ?.origem_catalogo,
        registros[0]
          ?.origemCatalogo,
        registros[0]
          ?.tipo_catalogo,
      ]
        .filter(Boolean)
        .join(" ")
    );

  const ehBicosMarelli2016 =
    origemNormalizada.includes(
      "MAGNETI MARELLI"
    ) &&
    (
      origemNormalizada.includes(
        "BICOS INJETORES 2016"
      ) ||
      origemNormalizada.includes(
        "BICOS INJETORES"
      )
    );
  /*
   * ============================================================
   * MAGNETI MARELLI — LÂMPADAS / BULBS
   * ============================================================
   *
   * O parser dedicado já entrega os dados técnicos corretos.
   *
   * NÃO passar pelo enriquecimento genérico,
   * pois ele pode reinterpretar a lâmpada como:
   *
   * Filtros
   * STANDARD como modelo
   * PX26D como equivalente
   * ============================================================
   */

  const ehLampadasMarelli =
    origemNormalizada.includes(
      "MAGNETI MARELLI"
    ) &&
    (
      origemNormalizada.includes(
        "LAMPADAS"
      ) ||
      origemNormalizada.includes(
        "BULBS"
      ) ||
      origemNormalizada.includes(
        "PARTS_BULBS"
      )
    );

  const ehParserMarelliProtegido =
    ehBicosMarelli2016 ||
    ehLampadasMarelli;
  console.log(
    "=========================================="
  );

  console.log(
    "💉 SALVAR CATÁLOGO — BICOS MARELLI:",
    ehBicosMarelli2016
  );

  console.log(
    "ORIGEM RECEBIDA:",
    origemCatalogo
  );

  console.log(
    "=========================================="
  );

  /*
   * ============================================================
   * CORREÇÃO BATTERIES 2024
   * ============================================================
   */

  const registrosCorrigidos =
    registros.map(
      (registro) => {
        if (
          ehBateriaMagnetiMarelli2024({
            registro,

            fabricantePadrao:
              fabricante,

            origemPadrao:
              origemCatalogo,
          })
        ) {
          return corrigirBateriaMagnetiMarelli2024(
            registro
          );
        }

        return registro;
      }
    );

  /*
   * ============================================================
   * ENRIQUECIMENTO APPIA
   * ============================================================
   *
   * BICOS MARELLI 2016:
   *
   * NÃO ENRIQUECER.
   *
   * Demais catálogos:
   *
   * comportamento normal.
   * ============================================================
   */

  const registrosEnriquecidos =
    [];

  for (
    const registro
    of registrosCorrigidos
  ) {
    /*
     * ----------------------------------------------------------
     * PROTEÇÃO DO PARSER DEDICADO
     * ----------------------------------------------------------
     */

    if (
  ehParserMarelliProtegido
) {
      registrosEnriquecidos.push({
        ...registro,

        /*
         * Marcador interno apenas para diagnóstico.
         * montarDados ignora esse campo.
         */

        __appia_parser_dedicado:
          true,
      });

      continue;
    }

    /*
     * ----------------------------------------------------------
     * FLUXO NORMAL APPIA
     * ----------------------------------------------------------
     */

    try {
      const enriquecido =
        await enriquecerRegistro(
          registro
        );

      registrosEnriquecidos.push(
        enriquecido ||
          registro
      );
    } catch (erro) {
      console.warn(
        "⚠️ Falha ao enriquecer registro. Mantendo original:",
        erro
      );

      registrosEnriquecidos.push(
        registro
      );
    }
  }

  /*
   * ============================================================
   * DIAGNÓSTICO IWP099 ANTES DA GRAVAÇÃO
   * ============================================================
   */

  if (
    ehBicosMarelli2016
  ) {
    const iwp099AntesSalvar =
      registrosEnriquecidos.filter(
        (registro) =>
          normalizarTextoComparacao(
            registro?.codigo_oem
          ) ===
          "IWP099"
      );

    console.log(
      "=========================================="
    );

    console.log(
      "🎯 SALVAR — IWP099 RECEBIDO DO PARSER:",
      iwp099AntesSalvar.length
    );

    console.log(
      "🎯 SALVAR — IWP099 DADOS:",
      iwp099AntesSalvar
    );

    console.log(
      "=========================================="
    );
  }

  /*
   * ============================================================
   * NORMALIZAÇÃO PARA catalogo_pecas
   * ============================================================
   */

  const dados =
    registrosEnriquecidos
      .map(
        (registro) =>
          montarDados(
            registro,
            fabricante,
            origemCatalogo
          )
      )
      .filter(
        (registro) =>
          Boolean(
            registro.codigo_oem
          )
      );

  if (
    dados.length === 0
  ) {
    return {
      sucesso: false,

      totalRecebidos:
        registros.length,

      totalValidos: 0,
      totalUnicos: 0,
      totalGravados: 0,
      totalMestre: 0,

      mensagem:
        "Nenhum registro possui código válido para gravação.",
    };
  }

  /*
   * ============================================================
   * DUPLICADOS
   * ============================================================
   */

  const dadosUnicos =
    removerDuplicadosCompatibilidade(
      dados
    );

  console.log(
    "=========================================="
  );

  console.log(
    "💾 APPIA — SALVAR CATÁLOGO"
  );

  console.log(
    "FABRICANTE:",
    fabricante
  );

  console.log(
    "ORIGEM:",
    origemCatalogo
  );

  console.log(
    "RECEBIDOS:",
    registros.length
  );

  console.log(
    "VÁLIDOS:",
    dados.length
  );

  console.log(
    "ÚNICOS:",
    dadosUnicos.length
  );

  console.log(
    "PARSER DEDICADO:",
    ehBicosMarelli2016
  );

  console.log(
    "=========================================="
  );

  onProgresso?.(
    `📚 ${dadosUnicos.length} registro(s) único(s) preparados.`
  );

  /*
   * ============================================================
   * LIMPEZA BATTERIES
   * ============================================================
   */

  await limparLegadoBateriasMarelli2024({
    registros:
      dadosUnicos,

    onProgresso,
  });

  /*
   * A versão anterior do catálogo NÃO é mais apagada.
   * Duplicidade e complemento seguro são resolvidos
   * registro a registro na Base Técnica.
   */

  /*
   * ============================================================
   * GRAVA catalogo_pecas
   * ============================================================
   */

  onProgresso?.(
    `💾 Conferindo duplicidade de ${dadosUnicos.length} aplicação(ões) na Base Técnica...`
  );

  let totalGravados =
    0;

  let resumoDuplicidade =
    {
      novos: 0,
      atualizados: 0,
      jaExistentes: 0,
      rejeitados: 0,
      totalAnalisado:
        dadosUnicos.length,
      mensagem: "",
    };

  try {
    resumoDuplicidade =
      await classificarEGravarCatalogoPecas({
        registros:
          dadosUnicos,

        onProgresso,
      });

    totalGravados =
      resumoDuplicidade.totalGravados ||
      0;
  } catch (erro) {
    console.error(
      "❌ Erro ao gravar catalogo_pecas:",
      erro
    );

    throw erro;
  }

  /*
   * ============================================================
   * catalogo_mestre
   * ============================================================
   */

  const dadosMestre =
    montarDadosCatalogoMestre(
      dadosUnicos
    );

  let totalMestre =
    0;

  if (
    dadosMestre.length >
    0
  ) {
    onProgresso?.(
      `🧠 Atualizando ${dadosMestre.length} código(s) na Base Mestre...`
    );

    try {
      totalMestre =
        await salvarEmLotes({
          tabela:
            "catalogo_mestre",

          registros:
            dadosMestre,

          tamanhoLote:
            250,

          colunasConflito:
            CONFLITO_CATALOGO_MESTRE,

          onProgresso,

          mensagem:
            "Base Mestre",
        });
    } catch (erro) {
      console.error(
        "❌ Erro ao gravar catalogo_mestre:",
        erro
      );

      console.warn(
        "⚠️ Base Técnica salva. Falha apenas na atualização da Base Mestre."
      );
    }
  }

  /*
   * ============================================================
   * BASE MESTRE V2
   * ============================================================
   *
   * Para Bicos Marelli 2016 também NÃO alimentamos novamente
   * a inteligência V2 durante esta importação.
   *
   * Primeiro queremos validar exatamente os dados oficiais
   * produzidos pelo parser.
   * ============================================================
   */

   if (
    !ehParserMarelliProtegido
  ) {
    try {
      onProgresso?.(
        "🧠 Atualizando inteligência da Base Mestre..."
      );

      const baseMestreV2 =
        montarBaseMestreV2(
          registrosEnriquecidos
        );

      if (
        Array.isArray(
          baseMestreV2
        )
      ) {
        for (
          const item
          of baseMestreV2
        ) {
          try {
            await salvarBaseMestre(
              item
            );
          } catch (
            erroItem
          ) {
            console.warn(
              "⚠️ Não foi possível salvar item na Base Mestre V2:",
              erroItem
            );
          }
        }
      } else if (
        baseMestreV2
      ) {
        try {
          await salvarBaseMestre(
            baseMestreV2
          );
        } catch (
          erroItem
        ) {
          console.warn(
            "⚠️ Não foi possível salvar Base Mestre V2:",
            erroItem
          );
        }
      }
    } catch (erro) {
      console.warn(
        "⚠️ Base Mestre V2 não atualizada:",
        erro
      );
    }
  } else {
    console.log(
      "💉 Bicos Marelli 2016: Base Mestre V2 ignorada nesta importação de validação."
    );

    onProgresso?.(
      "💉 Bicos Marelli: preservando dados oficiais do parser dedicado..."
    );
  }

  /*
   * ============================================================
   * RESULTADO
   * ============================================================
   */

  console.log(
    "=========================================="
  );

  console.log(
    "✅ APPIA — IMPORTAÇÃO FINALIZADA"
  );

  console.log(
    "FABRICANTE:",
    fabricante
  );

  console.log(
    "RECEBIDOS:",
    registros.length
  );

  console.log(
    "VÁLIDOS:",
    dados.length
  );

  console.log(
    "ÚNICOS:",
    dadosUnicos.length
  );

  console.log(
    "GRAVADOS:",
    totalGravados
  );

  console.log(
    resumoDuplicidade.mensagem ||
      ""
  );

  console.log(
    "BASE MESTRE:",
    totalMestre
  );

  console.log(
    "PARSER PROTEGIDO:",
    ehBicosMarelli2016
  );

  console.log(
    "=========================================="
  );

  onProgresso?.(
    resumoDuplicidade.mensagem ||
      `✅ Importação concluída: ${totalGravados} registro(s) gravado(s).`
  );

  return {
    sucesso: true,

    fabricante:
      fabricante ||
      dadosUnicos[0]
        ?.fabricante ||
      null,

    origemCatalogo:
      origemCatalogo ||
      dadosUnicos[0]
        ?.origem_catalogo ||
      null,

    totalRecebidos:
      registros.length,

    totalValidos:
      dados.length,

    totalUnicos:
      dadosUnicos.length,

    totalGravados,

    totalMestre,

    novos:
      resumoDuplicidade.novos ||
      0,

    atualizados:
      resumoDuplicidade.atualizados ||
      0,

    jaExistentes:
      resumoDuplicidade.jaExistentes ||
      0,

    rejeitados:
      resumoDuplicidade.rejeitados ||
      0,

    totalAnalisado:
      resumoDuplicidade.totalAnalisado ||
      dadosUnicos.length,

    mensagem:
      resumoDuplicidade.mensagem ||
      `Importação concluída com ${totalGravados} registro(s).`,
  };
}

export default salvarCatalogo;