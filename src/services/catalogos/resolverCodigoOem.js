import { supabase } from "../../supabase";

/*
 * ============================================================
 * PAIIA AI
 * RESOLVEDOR INTELIGENTE DE CÓDIGOS OEM
 * ============================================================
 *
 * OBJETIVO:
 *
 * Receber qualquer código informado pelo usuário e tentar:
 *
 * 1. Normalizar o código
 * 2. Identificar possíveis fabricantes
 * 3. Procurar o código nas bases técnicas da PAIIA
 * 4. Encontrar códigos OEM / equivalentes relacionados
 * 5. Identificar a montadora
 * 6. Preparar os códigos para consulta em catálogo OEM
 *
 * REGRA DE CREDIBILIDADE:
 *
 * Este serviço NÃO pesquisa:
 *
 * - Mercado Livre
 * - Shopee
 * - lojas
 * - Google
 * - descrições comerciais
 * - licitações
 * - fóruns
 *
 * Ele trabalha exclusivamente com dados já existentes
 * nas bases técnicas aprovadas da PAIIA.
 *
 * ============================================================
 */


/*
 * ============================================================
 * NORMALIZAÇÃO
 * ============================================================
 */

export function normalizarCodigoOem(
  valor = ""
) {
  return String(
    valor || ""
  )
    .trim()
    .toUpperCase()
    .replace(
      /[^A-Z0-9]/g,
      ""
    );
}


/*
 * ============================================================
 * VARIAÇÕES DE APRESENTAÇÃO
 * ============================================================
 */

function criarVariacoesCodigo(
  codigo = ""
) {
  const original =
    String(
      codigo || ""
    )
      .trim()
      .toUpperCase();

  const compacto =
    normalizarCodigoOem(
      original
    );

  const variacoes =
    new Set();

  if (original) {
    variacoes.add(
      original
    );
  }

  if (compacto) {
    variacoes.add(
      compacto
    );
  }


  /*
   * ========================================================
   * BOSCH
   * ========================================================
   *
   * Exemplo:
   *
   * 0280158276
   * 0 280 158 276
   *
   * 0258003300
   * 0 258 003 300
   */

  if (
    /^\d{10}$/.test(
      compacto
    )
  ) {
    variacoes.add(
      [
        compacto.slice(0, 1),
        compacto.slice(1, 4),
        compacto.slice(4, 7),
        compacto.slice(7),
      ].join(" ")
    );
  }


  /*
   * ========================================================
   * CÓDIGO HYUNDAI / KIA
   * ========================================================
   *
   * Exemplo:
   *
   * 3531004TF0
   * 35310-04TF0
   */

  if (
    /^[0-9A-Z]{10}$/.test(
      compacto
    )
  ) {
    variacoes.add(
      `${compacto.slice(
        0,
        5
      )}-${compacto.slice(5)}`
    );
  }


  return Array.from(
    variacoes
  ).filter(Boolean);
}


/*
 * ============================================================
 * IDENTIFICAÇÃO CONSERVADORA DO FABRICANTE
 * ============================================================
 *
 * IMPORTANTE:
 *
 * Não tentamos adivinhar fabricante quando o padrão
 * não é suficientemente seguro.
 *
 * Melhor retornar "Não identificado" do que atribuir
 * fabricante errado.
 * ============================================================
 */

export function identificarFabricanteCodigo(
  codigo = ""
) {
  const compacto =
    normalizarCodigoOem(
      codigo
    );

  if (!compacto) {
    return {
      fabricante:
        "Não identificado",

      confianca: 0,

      tipo:
        "desconhecido",
    };
  }


  /*
   * BOSCH
   *
   * Famílias mais conhecidas:
   *
   * 0 258...
   * 0 261...
   * 0 280...
   * 0 281...
   * 0 445...
   * 0 580...
   * 0 221...
   */

  if (
    /^0?(258|261|280|281|445|580|221)/.test(
      compacto
    ) ||
    /^F00H/.test(
      compacto
    )
  ) {
    return {
      fabricante:
        "Bosch",

      confianca: 95,

      tipo:
        "fabricante",
    };
  }


  /*
   * RENAULT
   *
   * Muitos códigos Renault utilizam:
   *
   * 77xxxxxxxx
   * 82xxxxxxxx
   *
   * Existem exceções.
   */

  if (
    /^(77|82)\d{8}[A-Z]?$/.test(
      compacto
    )
  ) {
    return {
      fabricante:
        "Renault",

      confianca: 90,

      tipo:
        "oem_montadora",
    };
  }


  /*
   * MAGNETI MARELLI
   */

  if (
    /^(FEI|PAS|MBD|TB)/.test(
      compacto
    )
  ) {
    return {
      fabricante:
        "Magneti Marelli",

      confianca: 85,

      tipo:
        "fabricante",
    };
  }


  /*
   * NGK / NTK
   */

  if (
    /^(U\d{4}|OZA|OPA|AWN|FLN|STV)/.test(
      compacto
    )
  ) {
    return {
      fabricante:
        "NGK / NTK",

      confianca: 80,

      tipo:
        "fabricante",
    };
  }


  return {
    fabricante:
      "Não identificado",

    confianca: 0,

    tipo:
      "desconhecido",
  };
}


/*
 * ============================================================
 * EXTRAIR CÓDIGOS DE UM CAMPO
 * ============================================================
 */

function extrairCodigos(
  valor
) {
  const encontrados =
    new Set();

  if (
    valor === null ||
    valor === undefined
  ) {
    return [];
  }


  if (
    Array.isArray(
      valor
    )
  ) {
    for (
      const item
      of valor
    ) {
      for (
        const codigo
        of extrairCodigos(
          item
        )
      ) {
        encontrados.add(
          codigo
        );
      }
    }

    return Array.from(
      encontrados
    );
  }


  if (
    typeof valor ===
      "object"
  ) {
    for (
      const item
      of Object.values(
        valor
      )
    ) {
      for (
        const codigo
        of extrairCodigos(
          item
        )
      ) {
        encontrados.add(
          codigo
        );
      }
    }

    return Array.from(
      encontrados
    );
  }


  const texto =
    String(
      valor || ""
    )
      .trim();

  if (!texto) {
    return [];
  }


  /*
   * Código completo
   */

  const completo =
    normalizarCodigoOem(
      texto
    );

  if (
    completo &&
    completo.length >= 5 &&
    completo.length <= 24
  ) {
    encontrados.add(
      completo
    );
  }


  /*
   * Campos contendo vários códigos
   */

  const partes =
    texto.split(
      /[,;|\n\r]+/
    );

  for (
    const parte
    of partes
  ) {
    const codigo =
      normalizarCodigoOem(
        parte
      );

    if (
      codigo &&
      codigo.length >= 5 &&
      codigo.length <= 24
    ) {
      encontrados.add(
        codigo
      );
    }
  }


  return Array.from(
    encontrados
  );
}


/*
 * ============================================================
 * VERIFICA SE REGISTRO REALMENTE CONTÉM O CÓDIGO
 * ============================================================
 */

function registroPossuiCodigo(
  registro,
  codigoPesquisa
) {
  const procurado =
    normalizarCodigoOem(
      codigoPesquisa
    );

  if (!procurado) {
    return false;
  }


  const campos = [
    registro?.codigo_oem,

    registro?.codigo_equivalente,

    registro?.codigo,

    registro?.codigo_bosch,

    registro?.codigo_marelli,

    registro?.codigo_magneti_marelli,

    registro?.codigo_fabricante,
  ];


  for (
    const campo
    of campos
  ) {
    const codigos =
      extrairCodigos(
        campo
      );

    if (
      codigos.includes(
        procurado
      )
    ) {
      return true;
    }
  }


  return false;
}


/*
 * ============================================================
 * CONSULTAR UMA BASE TÉCNICA
 * ============================================================
 */

async function consultarBaseTecnica({
  tabela,
  codigo,
  limite = 300,
}) {
  const variacoes =
    criarVariacoesCodigo(
      codigo
    );

  const filtros =
    new Set();


  for (
    const variacao
    of variacoes
  ) {
    const original =
      String(
        variacao || ""
      ).trim();

    const compacto =
      normalizarCodigoOem(
        variacao
      );

    if (original) {
      filtros.add(
        `codigo_oem.ilike.%${original}%`
      );

      filtros.add(
        `codigo_equivalente.ilike.%${original}%`
      );
    }

    if (compacto) {
      filtros.add(
        `codigo_oem.ilike.%${compacto}%`
      );

      filtros.add(
        `codigo_equivalente.ilike.%${compacto}%`
      );
    }
  }


  if (
    filtros.size === 0
  ) {
    return [];
  }


  const {
    data,
    error,
  } =
    await supabase
      .from(
        tabela
      )
      .select("*")
      .or(
        Array.from(
          filtros
        ).join(",")
      )
      .eq(
        "ativo",
        true
      )
      .limit(
        Math.min(
          limite,
          500
        )
      );


  if (error) {
    console.warn(
      `⚠️ Resolver OEM: erro consultando ${tabela}:`,
      error
    );

    return [];
  }


  const registros =
    Array.isArray(
      data
    )
      ? data
      : [];


  /*
   * O ILIKE serve apenas para
   * localizar candidatos.
   *
   * Aqui fazemos a validação exata.
   */

  return registros.filter(
    (registro) =>
      registroPossuiCodigo(
        registro,
        codigo
      )
  );
}


/*
 * ============================================================
 * CONSOLIDAR EQUIVALÊNCIAS
 * ============================================================
 */

function consolidarEquivalencias({
  codigoPesquisa,
  registros = [],
}) {
  const codigoNormalizado =
    normalizarCodigoOem(
      codigoPesquisa
    );

  const mapa =
    new Map();


  for (
    const registro
    of registros
  ) {
    if (!registro) {
      continue;
    }


    const fabricante =
      String(
        registro.fabricante ||
        ""
      )
        .trim();


    const montadora =
      String(
        registro.montadora ||
        ""
      )
        .trim();


    const campos = [
      {
        campo:
          "codigo_oem",

        valor:
          registro.codigo_oem,

        tipo:
          "OEM",
      },

      {
        campo:
          "codigo_equivalente",

        valor:
          registro.codigo_equivalente,

        tipo:
          "EQUIVALENTE",
      },

      {
        campo:
          "codigo",

        valor:
          registro.codigo,

        tipo:
          "CODIGO",
      },

      {
        campo:
          "codigo_bosch",

        valor:
          registro.codigo_bosch,

        tipo:
          "BOSCH",
      },

      {
        campo:
          "codigo_marelli",

        valor:
          registro.codigo_marelli,

        tipo:
          "MARELLI",
      },

      {
        campo:
          "codigo_magneti_marelli",

        valor:
          registro
            .codigo_magneti_marelli,

        tipo:
          "MARELLI",
      },

      {
        campo:
          "codigo_fabricante",

        valor:
          registro
            .codigo_fabricante,

        tipo:
          "FABRICANTE",
      },
    ];


    for (
      const campo
      of campos
    ) {
      const codigos =
        extrairCodigos(
          campo.valor
        );


      for (
        const codigo
        of codigos
      ) {
        if (!codigo) {
          continue;
        }


        /*
         * Mantemos também o código
         * pesquisado na consolidação,
         * mas marcamos corretamente.
         */

        const ehPesquisado =
          codigo ===
          codigoNormalizado;


        const chave = [
          codigo,
          montadora,
          fabricante,
          campo.tipo,
        ]
          .map(
            (valor) =>
              String(
                valor || ""
              )
                .trim()
                .toUpperCase()
          )
          .join("|");


        if (
          !mapa.has(
            chave
          )
        ) {
          mapa.set(
            chave,
            {
              codigo,

              tipo:
                campo.tipo,

              campo:
                campo.campo,

              fabricante:
                fabricante || null,

              montadora:
                montadora || null,

              pesquisado:
                ehPesquisado,

              confirmado:
                true,

              origem:
                "base_tecnica_paiia",

              registro_id:
                registro.id ||
                null,
            }
          );
        }
      }
    }
  }


  return Array.from(
    mapa.values()
  );
}


/*
 * ============================================================
 * ESCOLHER OEMs DE MONTADORA
 * ============================================================
 */

function localizarOemsMontadora(
  equivalencias = []
) {
  const mapa =
    new Map();


  for (
    const item
    of equivalencias
  ) {
    if (!item) {
      continue;
    }


    /*
     * Para ser candidato OEM:
     *
     * - precisa ter montadora
     * - preferencialmente precisa
     *   estar no campo codigo_oem
     */

    if (
      !item.montadora
    ) {
      continue;
    }


    const codigo =
      normalizarCodigoOem(
        item.codigo
      );

    if (!codigo) {
      continue;
    }


    const chave =
      `${String(
        item.montadora
      )
        .trim()
        .toUpperCase()}|${codigo}`;


    if (
      !mapa.has(
        chave
      )
    ) {
      mapa.set(
        chave,
        {
          codigo,

          montadora:
            item.montadora,

          fabricante:
            item.fabricante ||
            null,

          tipo:
            item.tipo,

          confirmado:
            true,

          pronto_para_catalogo:
            true,
        }
      );
    }
  }


  return Array.from(
    mapa.values()
  );
}


/*
 * ============================================================
 * REMOVER REGISTROS DUPLICADOS
 * ============================================================
 */

function removerRegistrosDuplicados(
  registros = []
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


    const chave = [
      registro.id || "",

      normalizarCodigoOem(
        registro.codigo_oem
      ),

      normalizarCodigoOem(
        registro.codigo_equivalente
      ),

      registro.montadora || "",

      registro.modelo || "",

      registro.motor || "",
    ]
      .map(
        (valor) =>
          String(
            valor || ""
          )
            .trim()
            .toUpperCase()
      )
      .join("|");


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


  return Array.from(
    mapa.values()
  );
}


/*
 * ============================================================
 * FUNÇÃO PRINCIPAL
 * ============================================================
 */

export async function resolverCodigoOem({
  codigo,
  onProgresso,
}) {
  const original =
    String(
      codigo || ""
    )
      .trim()
      .toUpperCase();


  const normalizado =
    normalizarCodigoOem(
      original
    );


  if (!normalizado) {
    return {
      sucesso: false,

      codigo_original:
        original,

      codigo_normalizado:
        "",

      fabricante_identificado:
        null,

      equivalencias: [],

      oems_montadora: [],

      registros_origem: [],

      mensagem:
        "Código não informado.",
    };
  }


  onProgresso?.(
    "🔄 Identificando código..."
  );


  const identificacao =
    identificarFabricanteCodigo(
      normalizado
    );


  onProgresso?.(
    "🧠 Procurando equivalências na base técnica..."
  );


  /*
   * ========================================================
   * CONSULTA APENAS BASES TÉCNICAS INTERNAS
   * ========================================================
   */

  const [
    registrosCatalogo,
    registrosMestre,
  ] =
    await Promise.all([
      consultarBaseTecnica({
        tabela:
          "catalogo_pecas",

        codigo:
          normalizado,

        limite: 300,
      }),

      consultarBaseTecnica({
        tabela:
          "catalogo_mestre",

        codigo:
          normalizado,

        limite: 300,
      }),
    ]);


  const registros =
    removerRegistrosDuplicados([
      ...registrosCatalogo,
      ...registrosMestre,
    ]);


  const equivalencias =
    consolidarEquivalencias({
      codigoPesquisa:
        normalizado,

      registros,
    });


  const oemsMontadora =
    localizarOemsMontadora(
      equivalencias
    );


  /*
   * ========================================================
   * DETECTA MONTADORAS ENCONTRADAS
   * ========================================================
   */

  const montadoras =
    Array.from(
      new Set(
        registros
          .map(
            (registro) =>
              String(
                registro?.montadora ||
                ""
              ).trim()
          )
          .filter(Boolean)
      )
    );


  const fabricantes =
    Array.from(
      new Set(
        registros
          .map(
            (registro) =>
              String(
                registro?.fabricante ||
                ""
              ).trim()
          )
          .filter(Boolean)
      )
    );


  /*
   * ========================================================
   * CLASSIFICAÇÃO
   * ========================================================
   */

  let status =
    "nao_encontrado";


  if (
    oemsMontadora.length > 0
  ) {
    status =
      "oem_encontrado";
  } else if (
    equivalencias.length > 0
  ) {
    status =
      "equivalencias_encontradas";
  } else if (
    registros.length > 0
  ) {
    status =
      "registro_encontrado";
  }


  console.log(
    "🔄 RESOLVER CÓDIGO OEM:",
    {
      original,

      normalizado,

      identificacao,

      registros:
        registros.length,

      equivalencias:
        equivalencias.length,

      oemsMontadora:
        oemsMontadora.length,

      montadoras,

      fabricantes,

      status,
    }
  );


  return {
    sucesso: true,

    status,

    codigo_original:
      original,

    codigo_normalizado:
      normalizado,

    variacoes:
      criarVariacoesCodigo(
        original
      ),

    fabricante_identificado:
      identificacao.fabricante,

    fabricante_confianca:
      identificacao.confianca,

    tipo_codigo:
      identificacao.tipo,

    fabricantes_encontrados:
      fabricantes,

    montadoras_encontradas:
      montadoras,

    equivalencias,

    oems_montadora:
      oemsMontadora,

    registros_origem:
      registros,

    quantidade_registros:
      registros.length,

    quantidade_equivalencias:
      equivalencias.length,

    quantidade_oems:
      oemsMontadora.length,

    pode_consultar_catalogo:
      oemsMontadora.length > 0,

    mensagem:
      oemsMontadora.length > 0
        ? `${oemsMontadora.length} código(s) OEM de montadora encontrado(s).`
        : equivalencias.length > 0
        ? "Equivalências técnicas encontradas, mas ainda sem OEM de montadora confirmado."
        : registros.length > 0
        ? "Código localizado na base técnica, mas sem equivalência OEM confirmada."
        : "Código ainda não possui equivalência confirmada nas bases técnicas da PAIIA.",
  };
}


export default resolverCodigoOem;