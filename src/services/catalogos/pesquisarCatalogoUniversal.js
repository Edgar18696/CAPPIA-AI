import { supabase } from "../../supabase";
import { consultarCatcar } from "./consultarCatcar";

/*
 * ============================================================
 * PAIIA AI
 * PESQUISA UNIVERSAL — MODO TÉCNICO SEGURO
 * ============================================================
 *
 * REGRA PRINCIPAL:
 *
 * A PAIIA somente retorna um registro quando o código
 * pesquisado corresponde EXATAMENTE a um campo técnico.
 *
 * NÃO usamos:
 *
 * - pesquisa online comercial
 * - Google
 * - anúncios
 * - ILIKE %codigo%
 * - aproximação por pedaços de código
 *
 * Melhor retornar ZERO do que uma aplicação errada.
 * ============================================================
 */


/*
 * ============================================================
 * NORMALIZAÇÃO
 * ============================================================
 */

function normalizarCodigo(
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
 * FABRICANTE
 * ============================================================
 */

function normalizarFabricantePesquisa(
  fabricante = ""
) {
  const chave =
    String(
      fabricante || ""
    )
      .trim()
      .toLowerCase();

  const mapa = {
    todos: "",

    bosch:
      "Bosch",

    magneti:
      "Magneti Marelli",

    marelli:
      "Magneti Marelli",

    magneti_marelli:
      "Magneti Marelli",

    renault:
      "Renault",

    fiat:
      "Fiat",

    gm:
      "GM",

    chevrolet:
      "Chevrolet",

    volkswagen:
      "Volkswagen",

    vw:
      "Volkswagen",

    delphi:
      "Delphi",

    ngk:
      "NGK",

    ntk:
      "NTK",

    denso:
      "Denso",

    catcar:
      "CatCar",
  };

  return (
    mapa[chave] ||
    String(
      fabricante || ""
    )
      .replace(
        /_/g,
        " "
      )
      .trim()
  );
}


function fabricanteCorresponde(
  registro,
  fabricante = "todos"
) {
  const chave =
    String(
      fabricante || "todos"
    )
      .trim()
      .toLowerCase();

  if (
    !chave ||
    chave === "todos"
  ) {
    return true;
  }

  const fabricanteRegistro =
    String(
      registro?.fabricante ||
      ""
    )
      .trim()
      .toLowerCase();

  /*
   * NGK / NTK
   */

  if (
    chave === "ngk" ||
    chave === "ntk" ||
    chave === "ngk ntk"
  ) {
    return (
      fabricanteRegistro.includes(
        "ngk"
      ) ||
      fabricanteRegistro.includes(
        "ntk"
      )
    );
  }

  const esperado =
    normalizarFabricantePesquisa(
      fabricante
    )
      .toLowerCase();

  if (!esperado) {
    return true;
  }

  return fabricanteRegistro.includes(
    esperado
  );
}


/*
 * ============================================================
 * VARIANTES SEGURAS
 * ============================================================
 */

function criarVariantesCodigo(
  codigo = ""
) {
  const original =
    String(
      codigo || ""
    )
      .trim()
      .toUpperCase();

  const compacto =
    normalizarCodigo(
      original
    );

  const variantes =
    new Set();

  if (original) {
    variantes.add(
      original
    );
  }

  if (compacto) {
    variantes.add(
      compacto
    );
  }


  /*
   * ========================================================
   * BOSCH
   * ========================================================
   *
   * 0258003300
   *
   * vira também:
   *
   * 0 258 003 300
   */

  if (
    /^\d{10}$/.test(
      compacto
    )
  ) {
    variantes.add(
      [
        compacto.slice(
          0,
          1
        ),

        compacto.slice(
          1,
          4
        ),

        compacto.slice(
          4,
          7
        ),

        compacto.slice(
          7,
          10
        ),
      ].join(" ")
    );
  }


  /*
   * ========================================================
   * MAGNETI MARELLI
   * ========================================================
   *
   * TB00131
   * TB0013-1
   */

  const matchTb =
    compacto.match(
      /^(TB)(\d{4})(\d)$/i
    );

  if (matchTb) {
    variantes.add(
      `${matchTb[1]}${matchTb[2]}-${matchTb[3]}`
    );
  }


  /*
   * FEI / PAS
   */

  const matchMarelli =
    compacto.match(
      /^(FEI|PAS)([A-Z0-9]{4,})([A-Z0-9])$/i
    );

  if (matchMarelli) {
    variantes.add(
      `${matchMarelli[1]}${matchMarelli[2]}-${matchMarelli[3]}`
    );
  }


  /*
   * ========================================================
   * NGK / NTK
   * ========================================================
   */

  const matchNtk =
    compacto.match(
      /^([A-Z]+\d*)([A-Z])(\d{3})$/i
    );

  if (matchNtk) {
    variantes.add(
      `${matchNtk[1]}-${matchNtk[2]}${matchNtk[3]}`
    );
  }


  return Array.from(
    variantes
  )
    .map(
      (item) =>
        String(
          item || ""
        ).trim()
    )
    .filter(Boolean);
}


/*
 * ============================================================
 * EXTRAÇÃO SEGURA DE CÓDIGOS
 * ============================================================
 *
 * IMPORTANTE:
 *
 * NÃO quebramos código por espaço.
 *
 * Assim:
 *
 * 0 258 003 300
 *
 * continua sendo UM código.
 *
 * Somente estes caracteres separam códigos:
 *
 * ,
 * ;
 * |
 * /
 * quebra de linha
 *
 * ============================================================
 */

function extrairCodigosCampo(
  valor
) {
  const encontrados =
    new Set();


  function processar(
    item
  ) {
    if (
      item === null ||
      item === undefined
    ) {
      return;
    }


    if (
      Array.isArray(
        item
      )
    ) {
      for (
        const interno
        of item
      ) {
        processar(
          interno
        );
      }

      return;
    }


    if (
      typeof item ===
        "object"
    ) {
      for (
        const interno
        of Object.values(
          item
        )
      ) {
        processar(
          interno
        );
      }

      return;
    }


    const texto =
      String(
        item || ""
      )
        .trim();

    if (!texto) {
      return;
    }


    const partes =
      texto.split(
        /[,;|/\n\r]+/
      );


    for (
      const parte
      of partes
    ) {
      const codigo =
        normalizarCodigo(
          parte
        );

      if (
        codigo &&
        codigo.length >= 3
      ) {
        encontrados.add(
          codigo
        );
      }
    }
  }


  processar(
    valor
  );


  return Array.from(
    encontrados
  );
}


/*
 * ============================================================
 * VALIDAÇÃO EXATA
 * ============================================================
 */

function registroCorrespondeAoCodigo(
  registro,
  termosPesquisa = []
) {
  const procurados =
    new Set(
      termosPesquisa
        .map(
          (termo) =>
            normalizarCodigo(
              termo
            )
        )
        .filter(Boolean)
    );


  if (
    procurados.size === 0
  ) {
    return false;
  }


  const campos = [
    registro?.codigo_oem,

    registro?.codigo,

    registro?.codigo_bosch,

    registro?.codigo_marelli,

    registro
      ?.codigo_magneti_marelli,

    registro
      ?.codigo_fabricante,

    registro
      ?.codigo_equivalente,
  ];


  for (
    const campo
    of campos
  ) {
    const codigos =
      extrairCodigosCampo(
        campo
      );


    for (
      const codigo
      of codigos
    ) {
      if (
        procurados.has(
          codigo
        )
      ) {
        return true;
      }
    }
  }


  return false;
}


/*
 * ============================================================
 * CONSULTA EXATA
 * ============================================================
 *
 * NÃO EXISTE MAIS ILIKE PARA O CÓDIGO.
 *
 * Consultamos apenas:
 *
 * codigo_oem = código
 *
 * ou
 *
 * codigo_equivalente = código
 *
 * ============================================================
 */

async function consultarTabela({
  tabela,
  termosPesquisa,
  fabricante = "todos",
  limite = 300,
}) {
  const encontrados =
    [];


  for (
    const termo
    of termosPesquisa
  ) {
    const codigo =
      String(
        termo || ""
      )
        .trim();


    if (!codigo) {
      continue;
    }


    let consulta =
      supabase
        .from(
          tabela
        )
        .select("*")
        .or(
          [
            `codigo_oem.eq.${codigo}`,

            `codigo_equivalente.eq.${codigo}`,
          ].join(",")
        )
        .eq(
          "ativo",
          true
        );


    const fabricanteBanco =
      normalizarFabricantePesquisa(
        fabricante
      );


    if (
      fabricante !== "todos" &&
      fabricanteBanco
    ) {
      consulta =
        consulta.ilike(
          "fabricante",
          `%${fabricanteBanco}%`
        );
    }


    const {
      data,
      error,
    } =
      await consulta.limit(
        Math.min(
          limite,
          500
        )
      );


    if (error) {
      console.warn(
        `⚠️ Erro consultando ${tabela}:`,
        error
      );

      continue;
    }


    const registros =
      Array.isArray(
        data
      )
        ? data
        : [];


    for (
      const registro
      of registros
    ) {
      if (
        !fabricanteCorresponde(
          registro,
          fabricante
        )
      ) {
        continue;
      }


      /*
       * Segunda trava.
       */

      if (
        !registroCorrespondeAoCodigo(
          registro,
          termosPesquisa
        )
      ) {
        console.warn(
          "🛡️ PAIIA bloqueou registro:",
          {
            tabela,

            pesquisado:
              termosPesquisa,

            codigo_oem:
              registro?.codigo_oem,

            codigo_equivalente:
              registro
                ?.codigo_equivalente,

            fabricante:
              registro?.fabricante,
          }
        );

        continue;
      }


      encontrados.push(
        registro
      );
    }
  }


  /*
   * ========================================================
   * REMOVER DUPLICADOS
   * ========================================================
   */

  const mapa =
    new Map();


  for (
    const registro
    of encontrados
  ) {
    const chave = [
      registro?.id || "",

      registro?.codigo_oem ||
        "",

      registro
        ?.codigo_equivalente ||
        "",

      registro?.montadora ||
        "",

      registro?.modelo ||
        "",

      registro?.motor ||
        "",

      registro?.ano_inicio ||
        "",

      registro?.ano_fim ||
        "",
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
  ).slice(
    0,
    limite
  );
}


/*
 * ============================================================
 * DUPLICADOS ENTRE BASES
 * ============================================================
 */

function removerDuplicados(
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
      registro?.id || "",

      registro?.codigo_oem ||
        "",

      registro
        ?.codigo_equivalente ||
        "",

      registro?.montadora ||
        "",

      registro?.modelo ||
        "",

      registro?.motor ||
        "",

      registro?.ano_inicio ||
        "",

      registro?.ano_fim ||
        "",
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
 * IDENTIFICAR CATÁLOGO OEM
 * ============================================================
 *
 * Aqui ainda NÃO estamos confirmando aplicação.
 *
 * Estamos apenas decidindo qual catálogo consultar.
 * ============================================================
 */

function identificarMontadoraCatcar({
  codigo,
  fabricante,
}) {
  const compacto =
    normalizarCodigo(
      codigo
    );

  const fabricanteNormalizado =
    String(
      fabricante || ""
    )
      .trim()
      .toLowerCase();


  /*
   * Renault OEM
   */

  if (
    compacto.startsWith(
      "77"
    ) ||
    compacto.startsWith(
      "82"
    ) ||
    fabricanteNormalizado ===
      "renault"
  ) {
    return "renault";
  }


  return null;
}


/*
 * ============================================================
 * ADAPTAR RESULTADO CATCAR
 * ============================================================
 */

function adaptarRegistrosCatcar({
  registros = [],
  codigo,
  montadora,
}) {
  const codigoNormalizado =
    normalizarCodigo(
      codigo
    );


  return registros
    .filter(Boolean)
    .map(
      (
        registro,
        index
      ) => ({
        ...registro,

        id:
          registro?.id ||
          `catcar-${codigoNormalizado}-${index}`,

        codigo_oem:
          registro?.codigo_oem ||
          codigoNormalizado,

        codigo:
          registro?.codigo_oem ||
          codigoNormalizado,

        fabricante:
          registro?.fabricante ||
          (
            montadora ===
            "renault"
              ? "Renault"
              : montadora
          ),

        montadora:
          registro?.montadora ||
          (
            montadora ===
            "renault"
              ? "Renault"
              : montadora
          ),

        peca:
          registro
            ?.descricao_original ||
          registro?.peca ||
          registro?.descricao ||
          "Peça original",

        descricao:
          registro
            ?.descricao_original ||
          registro?.descricao ||
          registro?.peca ||
          "",

        tipo:
          registro?.tipo ||
          null,

        motor:
          registro?.motor ||
          null,

        cambio:
          registro?.cambio ||
          null,

        ano_inicio:
          registro?.ano_inicio ||
          null,

        ano_fim:
          registro?.ano_fim ||
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

        codigo_substituto:
          registro
            ?.codigo_substituto ||
          null,

        pagina_url:
          registro?.pagina_url ||
          null,

        diagrama_url:
          registro
            ?.diagrama_url ||
          null,

        observacao:
          registro?.observacao ||
          "",

        origem_catalogo:
          "Catálogo OEM",

        fonte:
          "Catálogo OEM",

        tipo_catalogo:
          "catalogo_oem",

        ativo:
          true,

        validado:
          true,
      })
    );
}


/*
 * ============================================================
 * PESQUISA UNIVERSAL
 * ============================================================
 */

export async function pesquisarCatalogoUniversal({
  codigo,

  fabricante = "todos",

  onProgresso,
}) {
  const termo =
    String(
      codigo || ""
    )
      .trim()
      .toUpperCase();


  if (!termo) {
    return {
      sucesso: false,

      registros: [],

      quantidade: 0,

      mensagem:
        "Código não informado.",
    };
  }


  const termosPesquisa =
    criarVariantesCodigo(
      termo
    );


  console.log(
    "🔎 PAIIA PESQUISA TÉCNICA:",
    {
      original:
        termo,

      normalizado:
        normalizarCodigo(
          termo
        ),

      variantes:
        termosPesquisa,

      fabricante,
    }
  );


  /*
   * ========================================================
   * 1. CATÁLOGO DE PEÇAS
   * ========================================================
   */

  onProgresso?.(
    "🧠 Consultando catálogo técnico..."
  );


  const registrosCatalogo =
    await consultarTabela({
      tabela:
        "catalogo_pecas",

      termosPesquisa,

      fabricante,

      limite: 300,
    });


  /*
   * ========================================================
   * 2. BASE MESTRE
   * ========================================================
   */

  onProgresso?.(
    "🧠 Consultando Base Mestre..."
  );


  const registrosMestre =
    await consultarTabela({
      tabela:
        "catalogo_mestre",

      termosPesquisa,

      fabricante,

      limite: 300,
    });


  /*
   * ========================================================
   * CONSOLIDAÇÃO
   * ========================================================
   */

  const registros =
    removerDuplicados([
      ...registrosCatalogo,

      ...registrosMestre,
    ]);


  /*
   * ========================================================
   * TRAVA FINAL
   * ========================================================
   */

  const registrosConfirmados =
    registros.filter(
      (registro) =>
        registroCorrespondeAoCodigo(
          registro,
          termosPesquisa
        )
    );


  if (
    registros.length !==
    registrosConfirmados.length
  ) {
    console.warn(
      "🛡️ PAIIA removeu registros não confirmados:",
      registros.length -
        registrosConfirmados.length
    );
  }


  console.log(
    "✅ PAIIA RESULTADO TÉCNICO:",
    {
      catalogo:
        registrosCatalogo.length,

      mestre:
        registrosMestre.length,

      confirmados:
        registrosConfirmados.length,
    }
  );


  /*
   * ========================================================
   * RESULTADO INTERNO
   * ========================================================
   */

  if (
    registrosConfirmados.length >
    0
  ) {
    return {
      sucesso: true,

      quantidade:
        registrosConfirmados.length,

      registros:
        registrosConfirmados,

      origem:
        "base_tecnica_paiia",

      validado:
        true,
    };
  }


  console.log(
    "⚠️ CÓDIGO NÃO CONFIRMADO NA BASE TÉCNICA:",
    termo
  );


  /*
   * ========================================================
   * FALLBACK TÉCNICO CATCAR
   * ========================================================
   *
   * IMPORTANTE:
   *
   * Só chegamos aqui porque:
   *
   * catalogo_pecas = 0
   * catalogo_mestre = 0
   *
   * Agora identificamos qual catálogo OEM
   * pode ser consultado.
   * ========================================================
   */

  const codigoNormalizado =
    normalizarCodigo(
      termo
    );


  const montadoraCatcar =
    identificarMontadoraCatcar({
      codigo:
        codigoNormalizado,

      fabricante,
    });


  /*
   * ========================================================
   * CONSULTAR CATCAR
   * ========================================================
   */

  if (
    montadoraCatcar
  ) {
    try {
      onProgresso?.(
        "🔎 Consultando catálogo OEM..."
      );


      console.log(
        "🌐 PAIIA → CATCAR:",
        {
          codigo:
            codigoNormalizado,

          montadora:
            montadoraCatcar,
        }
      );


      const resultadoCatcar =
        await consultarCatcar({
          codigoOem:
            codigoNormalizado,

          montadora:
            montadoraCatcar,

          onProgresso,
        });


      console.log(
        "📚 RESPOSTA CATCAR:",
        resultadoCatcar
      );


      if (
        resultadoCatcar
          ?.sucesso &&
        resultadoCatcar
          ?.encontrado &&
        Array.isArray(
          resultadoCatcar
            ?.registros
        ) &&
        resultadoCatcar
          .registros.length >
          0
      ) {
        const registrosCatcar =
          adaptarRegistrosCatcar({
            registros:
              resultadoCatcar
                .registros,

            codigo:
              codigoNormalizado,

            montadora:
              montadoraCatcar,
          });


        /*
         * ==================================================
         * TRAVA CATCAR
         * ==================================================
         *
         * O código OEM retornado precisa ser
         * exatamente o código pesquisado.
         * ==================================================
         */

        const confirmadosCatcar =
          registrosCatcar.filter(
            (registro) =>
              normalizarCodigo(
                registro
                  ?.codigo_oem
              ) ===
              codigoNormalizado
          );


        if (
          confirmadosCatcar.length >
          0
        ) {
          console.log(
            "✅ PAIIA CATCAR CONFIRMADO:",
            confirmadosCatcar.length
          );


          return {
            sucesso: true,

            quantidade:
              confirmadosCatcar.length,

            registros:
              confirmadosCatcar,

            origem:
              "catalogo_oem",

            validado:
              true,

            codigo_oem:
              codigoNormalizado,

            montadora:
              montadoraCatcar,
          };
        }


        console.warn(
          "🛡️ PAIIA bloqueou retorno CatCar sem correspondência exata.",
          {
            pesquisado:
              codigoNormalizado,

            recebidos:
              registrosCatcar.length,
          }
        );
      }


      console.log(
        "⚠️ OEM NÃO LOCALIZADO NO CATCAR:",
        codigoNormalizado
      );
    } catch (
      erroCatcar
    ) {
      /*
       * CatCar nunca pode derrubar
       * a Pesquisa Universal.
       */

      console.error(
        "❌ Falha na consulta ao catálogo OEM:",
        erroCatcar
      );
    }
  }


  /*
   * ========================================================
   * NÃO ENCONTRADO
   * ========================================================
   *
   * Nem a Base PAIIA nem o catálogo OEM
   * confirmaram o código.
   *
   * ZERO continua sendo melhor
   * que aplicação incorreta.
   * ========================================================
   */

  console.log(
    "⚠️ CÓDIGO NÃO CONFIRMADO:",
    {
      codigo:
        codigoNormalizado,

      basePaiia:
        false,

      catalogoOem:
        Boolean(
          montadoraCatcar
        ),
    }
  );


  return {
    sucesso: true,

    quantidade: 0,

    registros: [],

    validado:
      false,

    origem:
      null,

    mensagem:
      montadoraCatcar
        ? "Código não localizado nos catálogos técnicos consultados."
        : "Código não confirmado na base técnica.",
  };
}


export default pesquisarCatalogoUniversal;