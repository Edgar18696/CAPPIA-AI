function limparTexto(valor = "") {
  return String(valor || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarCodigo(valor = "") {
  return String(valor || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

function separarLinhas(texto = "") {
  return String(texto || "")
    .split(/\r?\n/)
    .map(limparTexto)
    .filter(Boolean);
}

const MONTADORAS = [
  "ABARTH",
  "ALFA ROMEO",
  "AUDI",
  "BMW",
  "CHEVROLET",
  "CITROEN",
  "CITROËN",
  "DACIA",
  "DAEWOO",
  "DS",
  "FIAT",
  "FORD",
  "HONDA",
  "HYUNDAI",
  "IVECO",
  "JEEP",
  "KIA",
  "LANCIA",
  "MERCEDES-BENZ",
  "MITSUBISHI",
  "NISSAN",
  "OPEL",
  "PEUGEOT",
  "RENAULT",
  "SEAT",
  "SKODA",
  "SMART",
  "TOYOTA",
  "VOLKSWAGEN",
];

function identificarMontadora(
  linha = ""
) {
  const texto =
    limparTexto(linha)
      .toUpperCase();

  return (
    MONTADORAS.find(
      (montadora) =>
        texto === montadora
    ) || ""
  );
}

function extrairCodigoMMS(
  linha = ""
) {
  const match =
    String(linha).match(
      /\bMMS\d{4}\b/i
    );

  return match
    ? normalizarCodigo(
        match[0]
      )
    : "";
}

function extrairCodigoLongo(
  linha = ""
) {
  const match =
    String(linha).match(
      /\b350105\d{6}\b/
    );

  return match
    ? normalizarCodigo(
        match[0]
      )
    : "";
}

function extrairAnoInicial(
  linha = ""
) {
  const match =
    String(linha).match(
      /\b((?:19|20)\d{2})\s*[à→>-]/
    );

  return match
    ? Number(match[1])
    : null;
}

function extrairAnoFinal(
  linha = ""
) {
  const match =
    String(linha).match(
      /\b((?:19|20)\d{2})\b/
    );

  return match
    ? Number(match[1])
    : null;
}

function extrairPortas(
  linha = ""
) {
  const texto =
    limparTexto(linha);

  const match =
    texto.match(
      /^(\d(?:-\d)?)\b/
    );

  return match
    ? match[1]
    : "";
}

function extrairOEMsLinha(
  linha = ""
) {
  const texto =
    limparTexto(linha);

  const tokens =
    texto
      .split(/\s+/)
      .map(normalizarCodigo)
      .filter(Boolean);

  return tokens.filter(
    (token) => {
      if (
        /^\d(?:-\d)?$/.test(
          token
        )
      ) {
        return false;
      }

      if (
        /^(?:19|20)\d{2}$/.test(
          token
        )
      ) {
        return false;
      }

      if (
        /^MMS\d{4}$/.test(
          token
        )
      ) {
        return false;
      }

      if (
        /^350105\d{6}$/.test(
          token
        )
      ) {
        return false;
      }

      return (
        token.length >= 5 &&
        token.length <= 25 &&
        /\d/.test(token) &&
        /^[A-Z0-9.+-]+$/.test(
          token
        )
      );
    }
  );
}

function ehDescricaoInicio(
  linha = ""
) {
  return (
    /^handle$/i.test(
      linha
    ) ||
    /^door handle/i.test(
      linha
    ) ||
    /^door lock/i.test(
      linha
    ) ||
    /^lock housing/i.test(
      linha
    ) ||
    /^kit locking/i.test(
      linha
    ) ||
    /^locking cylinder/i.test(
      linha
    ) ||
    /^cable pull/i.test(
      linha
    ) ||
    /^tailgate lock/i.test(
      linha
    ) ||
    /^window crank/i.test(
      linha
    ) ||
    /^striker plate/i.test(
      linha
    ) ||
    /^handle,/i.test(
      linha
    )
  );
}

function ehComplementoDescricao(
  linha = ""
) {
  return (
    /^without locking/i.test(
      linha
    ) ||
    /^with locking/i.test(
      linha
    ) ||
    /^interior/i.test(
      linha
    ) ||
    /^release/i.test(
      linha
    )
  );
}

function identificarPeca(
  descricao = ""
) {
  const texto =
    limparTexto(
      descricao
    ).toLowerCase();

  if (
    texto.includes(
      "locking cylinder"
    ) ||
    texto.includes(
      "lock cylinder"
    ) ||
    texto.includes(
      "kit locking cylinder"
    )
  ) {
    return "Cilindro de Fechadura";
  }

  if (
    texto.includes(
      "door lock"
    ) ||
    texto.includes(
      "tailgate lock"
    ) ||
    texto.includes(
      "lock housing"
    ) ||
    texto.includes(
      "striker plate"
    )
  ) {
    return "Fechadura";
  }

  if (
    texto.includes(
      "cable pull"
    )
  ) {
    return "Cabo de Abertura da Porta";
  }

  if (
    texto.includes(
      "window crank"
    )
  ) {
    return "Manivela do Vidro";
  }

  if (
    texto.includes(
      "bonnet release"
    )
  ) {
    return "Maçaneta de Abertura do Capô";
  }

  if (
    texto.includes(
      "handle"
    )
  ) {
    return "Maçaneta";
  }

  return "Maçaneta / Fechadura";
}

function ehCaracteristica(
  linha = ""
) {
  const texto =
    limparTexto(
      linha
    ).toLowerCase();

  const termos = [
    "black",
    "aluminium",
    "primed",
    "chrome clear",
    "chrome satin",
    "plastic",
    "grey",
    "dark grey",
    "with key",
    "manual",
    "electric",
    "pair",
  ];

  return termos.some(
    (termo) =>
      texto.includes(
        termo
      )
  );
}

function ehLinhaIgnorada(
  linha = ""
) {
  return (
    /^OES?$/i.test(
      linha
    ) ||
    /^NEW$/i.test(
      linha
    ) ||
    /MAGNETI MARELLI/i.test(
      linha
    ) ||
    /PARTS & SERVICES/i.test(
      linha
    ) ||
    /KEY WITHOUT TRANSPONDER/i.test(
      linha
    ) ||
    /LE NOSTRE CHIAVI/i.test(
      linha
    ) ||
    /^--- PÁGINA/i.test(
      linha
    ) ||
    /^\d+$/.test(
      linha
    )
  );
}

function pareceModelo(
  linha = ""
) {
  const texto =
    limparTexto(linha);

  if (!texto) {
    return false;
  }

  if (
    identificarMontadora(
      texto
    )
  ) {
    return false;
  }

  if (
    extrairCodigoMMS(
      texto
    )
  ) {
    return false;
  }

  if (
    extrairCodigoLongo(
      texto
    )
  ) {
    return false;
  }

  if (
    extrairAnoInicial(
      texto
    )
  ) {
    return false;
  }

  if (
    ehDescricaoInicio(
      texto
    ) ||
    ehComplementoDescricao(
      texto
    ) ||
    ehCaracteristica(
      texto
    ) ||
    ehLinhaIgnorada(
      texto
    )
  ) {
    return false;
  }

  return (
    texto.length <= 80 &&
    /[A-Z0-9]/i.test(
      texto
    )
  );
}

function removerDuplicados(
  registros = []
) {
  const mapa =
    new Map();

  for (
    const registro
    of registros
  ) {
    const chave = [
      registro.codigo_oem,
      registro.montadora,
      registro.modelo,
      registro.ano_inicio,
      registro.ano_fim,
      registro.peca,
    ]
      .map(
        (valor) =>
          normalizarCodigo(
            valor || ""
          )
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

function extrairAplicacoes(
  texto = "",
  configuracao = {},
  nomeArquivo = ""
) {
  const linhas =
    separarLinhas(
      texto
    );

  const registros =
    [];

  let montadoraAtual = "";
  let modeloAtual = "";

  let descricaoAtual = "";
  let caracteristicaAtual = "";

  for (
    let indice = 0;
    indice <
      linhas.length;
    indice++
  ) {
    const linha =
      linhas[indice];

    /*
     * =========================================
     * MONTADORA
     * =========================================
     */

    const montadora =
      identificarMontadora(
        linha
      );

    if (montadora) {
      montadoraAtual =
        montadora;

      modeloAtual = "";
      descricaoAtual = "";
      caracteristicaAtual = "";

      continue;
    }

    /*
     * =========================================
     * DESCRIÇÃO
     * =========================================
     */

    if (
      ehDescricaoInicio(
        linha
      )
    ) {
      descricaoAtual =
        linha;

      const proxima =
        linhas[
          indice + 1
        ] || "";

      if (
        ehComplementoDescricao(
          proxima
        )
      ) {
        descricaoAtual =
          limparTexto(
            `${linha} ${proxima}`
          );
      }

      continue;
    }

    if (
      ehComplementoDescricao(
        linha
      ) &&
      descricaoAtual
    ) {
      if (
        !descricaoAtual.includes(
          linha
        )
      ) {
        descricaoAtual =
          limparTexto(
            `${descricaoAtual} ${linha}`
          );
      }

      continue;
    }

    /*
     * =========================================
     * CARACTERÍSTICA
     * =========================================
     */

    if (
      ehCaracteristica(
        linha
      )
    ) {
      caracteristicaAtual =
        linha;

      continue;
    }

    /*
     * =========================================
     * MODELO
     * =========================================
     */

    if (
      montadoraAtual &&
      pareceModelo(
        linha
      )
    ) {
      /*
       * Modelo aparece antes do primeiro
       * registro da aplicação.
       */

      const temCodigoLogoDepois =
        linhas
          .slice(
            indice + 1,
            indice + 8
          )
          .some(
            (item) =>
              Boolean(
                extrairCodigoMMS(
                  item
                )
              )
          );

      if (
        temCodigoLogoDepois
      ) {
        modeloAtual =
          linha;
      }
    }

    /*
     * =========================================
     * LINHA PRINCIPAL DO PRODUTO
     *
     * 2005 à MMS0367
     * =========================================
     */

    const codigoMMS =
      extrairCodigoMMS(
        linha
      );

    if (!codigoMMS) {
      continue;
    }

    const anoInicio =
      extrairAnoInicial(
        linha
      );

    /*
     * =========================================
     * PRÓXIMAS LINHAS
     *
     * 2 735498779
     * 2013 350105036700
     * =========================================
     */

    let portas = "";

    let anoFim = null;

    let codigoLongo = "";

    const oes =
      new Set();

    for (
      let distancia = 1;
      distancia <= 6;
      distancia++
    ) {
      const proxima =
        linhas[
          indice +
            distancia
        ];

      if (!proxima) {
        break;
      }

      /*
       * Se chegou no próximo produto,
       * encerra o bloco atual.
       */

      if (
        extrairCodigoMMS(
          proxima
        )
      ) {
        break;
      }

      const portasLinha =
        extrairPortas(
          proxima
        );

      if (
        portasLinha &&
        !portas
      ) {
        portas =
          portasLinha;
      }

      const oemsLinha =
        extrairOEMsLinha(
          proxima
        );

      for (
        const oe
        of oemsLinha
      ) {
        oes.add(oe);
      }

      const longoLinha =
        extrairCodigoLongo(
          proxima
        );

      if (
        longoLinha
      ) {
        codigoLongo =
          longoLinha;

        const anoLinha =
          extrairAnoFinal(
            proxima
          );

        if (
          anoLinha &&
          anoLinha !==
            anoInicio
        ) {
          anoFim =
            anoLinha;
        }
      }

      if (
        ehCaracteristica(
          proxima
        )
      ) {
        caracteristicaAtual =
          proxima;
      }
    }

    /*
     * =========================================
     * DESCRIÇÃO ANTERIOR
     * =========================================
     *
     * Em alguns registros ela fica uma
     * ou duas linhas antes do MMS.
     */

    let descricao =
      descricaoAtual;

    if (!descricao) {
      for (
        let distancia = 1;
        distancia <= 5;
        distancia++
      ) {
        const anterior =
          linhas[
            indice -
              distancia
          ];

        if (
          anterior &&
          ehDescricaoInicio(
            anterior
          )
        ) {
          descricao =
            anterior;

          const complemento =
            linhas[
              indice -
                distancia +
                1
            ];

          if (
            complemento &&
            ehComplementoDescricao(
              complemento
            )
          ) {
            descricao =
              limparTexto(
                `${descricao} ${complemento}`
              );
          }

          break;
        }
      }
    }

    const peca =
      identificarPeca(
        descricao
      );

    const equivalentes =
      Array.from(
        oes
      );

    /*
     * =========================================
     * REGISTRO
     * =========================================
     */

    registros.push({
      peca,

      fabricante:
        "Magneti Marelli",

      codigo_oem:
        codigoMMS,

      codigo_marelli:
        codigoMMS,

      codigo_marelli_longo:
        codigoLongo ||
        null,

      codigo_equivalente:
        equivalentes[0] ||
        codigoLongo ||
        "",

      equivalentes,

      montadora:
        montadoraAtual ||
        "",

      modelo:
        modeloAtual ||
        "",

      motor:
        "",

      ano_inicio:
        anoInicio,

      ano_fim:
        anoFim,

      aplicacao:
        [
          montadoraAtual,
          modeloAtual,

          anoInicio
            ? anoFim
              ? `${anoInicio} até ${anoFim}`
              : `${anoInicio} até Atual`
            : "",
        ]
          .filter(Boolean)
          .join(" "),

      observacao:
        [
          descricao
            ? `Descrição: ${descricao}`
            : "",

          portas
            ? `Portas: ${portas}`
            : "",

          caracteristicaAtual
            ? `Material/Cor: ${caracteristicaAtual}`
            : "",

          codigoLongo
            ? `Código Marelli: ${codigoLongo}`
            : "",
        ]
          .filter(Boolean)
          .join(" | "),

      origem_catalogo:
        configuracao
          ?.origemCatalogo ||
        nomeArquivo ||
        "Catálogo Magneti Marelli Maçanetas e Fechaduras 2022-2023",

      tipo_catalogo:
        "macanetas_fechaduras",

      categoria:
        "Carroceria",

      subcategoria:
        peca,

      ativo:
        true,

      prioridade:
        1,

      confiabilidade:
        (
          montadoraAtual &&
          modeloAtual &&
          codigoLongo
        )
          ? 98
          : 90,
    });
  }

  return removerDuplicados(
    registros
  );
}

function extrairEquivalenciasOE(
  texto = ""
) {
  const linhas =
    separarLinhas(
      texto
    );

  const resultado =
    [];

  let montadoraAtual =
    "";

  for (
    const linha
    of linhas
  ) {
    const montadora =
      identificarMontadora(
        linha
      );

    if (montadora) {
      montadoraAtual =
        montadora;

      continue;
    }

    /*
     * Exemplo:
     *
     * 71775802 MMS0380 350105038000
     */

    const match =
      linha.match(
        /([A-Z0-9.+-]{5,25})\s+(MMS\d{4})\s+(350105\d{6})/i
      );

    if (!match) {
      continue;
    }

    resultado.push({
      codigoOE:
        normalizarCodigo(
          match[1]
        ),

      codigoMMS:
        normalizarCodigo(
          match[2]
        ),

      codigoLongo:
        normalizarCodigo(
          match[3]
        ),

      montadora:
        montadoraAtual,
    });
  }

  return resultado;
}

function aplicarEquivalencias(
  registros = [],
  equivalencias = []
) {
  const mapa =
    new Map();

  for (
    const item
    of equivalencias
  ) {
    if (
      !mapa.has(
        item.codigoMMS
      )
    ) {
      mapa.set(
        item.codigoMMS,
        {
          longo:
            item.codigoLongo,

          oes: [],
        }
      );
    }

    const grupo =
      mapa.get(
        item.codigoMMS
      );

    if (
      item.codigoLongo &&
      !grupo.longo
    ) {
      grupo.longo =
        item.codigoLongo;
    }

    if (
      item.codigoOE &&
      !grupo.oes.includes(
        item.codigoOE
      )
    ) {
      grupo.oes.push(
        item.codigoOE
      );
    }
  }

  return registros.map(
    (registro) => {
      const grupo =
        mapa.get(
          registro.codigo_oem
        );

      if (!grupo) {
        return registro;
      }

      const equivalentes =
        [
          ...new Set(
            [
              ...(
                registro
                  .equivalentes ||
                []
              ),

              ...(
                grupo.oes ||
                []
              ),

              grupo.longo,
            ].filter(Boolean)
          ),
        ];

      return {
        ...registro,

        codigo_marelli_longo:
          registro
            .codigo_marelli_longo ||
          grupo.longo ||
          null,

        equivalentes,

        codigo_equivalente:
          grupo.oes?.[0] ||
          registro
            .codigo_equivalente ||
          grupo.longo ||
          "",
      };
    }
  );
}

export async function parserMagnetiMarelliMacanetasFechaduras({
  textoReferencias = "",
  textoAplicacoes = "",
  textoEquivalencias = "",
  nomeArquivo = "",
  configuracao = {},
  onProgresso,
} = {}) {
  console.log(
    "=========================================="
  );

  console.log(
    "🚪 MARELLI MAÇANETAS / FECHADURAS V3"
  );

  console.log(
    "ARQUIVO:",
    nomeArquivo
  );

  let registros =
    extrairAplicacoes(
      textoAplicacoes,
      configuracao,
      nomeArquivo
    );

  const equivalencias =
    extrairEquivalenciasOE(
      textoEquivalencias
    );

  registros =
    aplicarEquivalencias(
      registros,
      equivalencias
    );

  registros =
    removerDuplicados(
      registros
    );

  const mms0367 =
    registros.filter(
      (registro) =>
        normalizarCodigo(
          registro.codigo_oem
        ) ===
        "MMS0367"
    );

  console.log(
    "🚪 REGISTROS:",
    registros.length
  );

  console.log(
    "🚪 EQUIVALÊNCIAS:",
    equivalencias.length
  );

  console.log(
    "🎯 MMS0367:",
    mms0367
  );

  console.log(
    "=========================================="
  );

  onProgresso?.(
    `✅ Maçanetas e Fechaduras: ${registros.length} registro(s) encontrado(s).`
  );

  return registros;
}

export default parserMagnetiMarelliMacanetasFechaduras;