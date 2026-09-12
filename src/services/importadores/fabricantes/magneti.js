import { configuracaoMagneti } from "../configuracoes/magneti";

function limparTexto(valor) {
  return String(valor || "")
    .replace(/\s+/g, " ")
    .trim();
}

function limparCodigo(valor) {
  return limparTexto(valor)
    .replace(/[^\w.-]/g, "")
    .toUpperCase();
}

function normalizarNome(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function separarLinhas(texto) {
  return String(texto || "")
    .split(/\r?\n/)
    .map((linha) =>
      limparTexto(linha)
    )
    .filter(Boolean);
}

function pareceCodigo(valor) {
  const codigo =
    limparCodigo(valor);

  if (!codigo) {
    return false;
  }

  return (
    /^[A-Z0-9.-]{5,25}$/.test(
      codigo
    ) &&
    /\d/.test(
      codigo
    )
  );
}

function extrairAno(texto) {
  const anos =
    String(
      texto || ""
    ).match(
      /\b(19|20)\d{2}\b/g
    );

  if (
    !anos ||
    anos.length === 0
  ) {
    return {
      ano_inicio: null,
      ano_fim: null,
    };
  }

  const numeros =
    anos.map(Number);

  return {
    ano_inicio:
      Math.min(
        ...numeros
      ),

    ano_fim:
      Math.max(
        ...numeros
      ),
  };
}

function extrairMotor(texto) {
  const resultado =
    String(
      texto || ""
    ).match(
      /\b\d\.\d(?:\s?(?:8V|16V|20V|TDI|TSI|MPI|FLEX|GASOLINA|DIESEL))?\b/i
    );

  return resultado
    ? limparTexto(
        resultado[0]
      )
    : "";
}

function extrairAplicacao(linha) {
  const partes =
    linha
      .split(
        /\s{2,}|\s+-\s+|\s+\|\s+/
      )
      .map(
        limparTexto
      )
      .filter(Boolean);

  const anos =
    extrairAno(
      linha
    );

  const motor =
    extrairMotor(
      linha
    );

  return {
    montadora:
      partes[0] ||
      "",

    modelo:
      partes[1] ||
      "",

    motor,

    ano_inicio:
      anos.ano_inicio,

    ano_fim:
      anos.ano_fim,

    observacao:
      linha,
  };
}

function encontrarCodigoNaLinha(
  linha
) {
  const partes =
    linha
      .split(
        /[\s,;|/]+/
      )
      .map(
        limparCodigo
      )
      .filter(Boolean);

  return (
    partes.find(
      pareceCodigo
    ) ||
    ""
  );
}

function criarRegistro({
  codigo,
  aplicacao,
  origemCatalogo,
  pagina,
}) {
  return {
    peca:
      "Autopeça Magneti Marelli",

    codigo_oem:
      codigo,

    codigo_equivalente:
      "",

    fabricante:
      "Magneti Marelli",

    origem_catalogo:
      origemCatalogo,

    montadora:
      aplicacao.montadora,

    modelo:
      aplicacao.modelo,

    motor:
      aplicacao.motor,

    ano_inicio:
      aplicacao.ano_inicio,

    ano_fim:
      aplicacao.ano_fim,

    observacao:
      aplicacao.observacao,

    pagina_catalogo:
      pagina,

    ativo:
      true,

    prioridade:
      2,

    confiabilidade:
      90,
  };
}

function extrairRegistrosPagina({
  texto,
  pagina,
  origemCatalogo,
}) {
  const linhas =
    separarLinhas(
      texto
    );

  const registros =
    [];

  let codigoAtual =
    "";

  for (
    const linha
    of linhas
  ) {
    const codigoEncontrado =
      encontrarCodigoNaLinha(
        linha
      );

    if (
      codigoEncontrado
    ) {
      codigoAtual =
        codigoEncontrado;
    }

    if (
      !codigoAtual
    ) {
      continue;
    }

    const possuiAplicacao =
      /\b(FIAT|RENAULT|CHEVROLET|GM|VOLKSWAGEN|VW|FORD|PEUGEOT|CITROEN|HONDA|TOYOTA|NISSAN|HYUNDAI|KIA|MITSUBISHI|IVECO|MERCEDES|BMW|AUDI)\b/i.test(
        linha
      );

    if (
      !possuiAplicacao
    ) {
      continue;
    }

    const aplicacao =
      extrairAplicacao(
        linha
      );

    registros.push(
      criarRegistro({
        codigo:
          codigoAtual,

        aplicacao,

        origemCatalogo,

        pagina,
      })
    );
  }

  return registros;
}

function removerDuplicados(
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
      registro.montadora,
      registro.modelo,
      registro.motor,
      registro.ano_inicio,
      registro.ano_fim,
    ]
      .map(
        (valor) =>
          String(
            valor || ""
          ).toUpperCase()
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
 * ========================================================
 * THERMAL SYSTEMS 2022-2023
 * ========================================================
 */

const ehSistemasTermicos =
  (
    nomeNormalizado.includes(
      "parts thermal systems"
    ) ||
    nomeNormalizado.includes(
      "thermal systems"
    ) ||
    nomeNormalizado.includes(
      "sistemi termici"
    )
  );

if (
  ehSistemasTermicos &&
  catalogos?.sistemasTermicos
) {
  console.log(
    "🌡️ MAGNETI: Thermal Systems 2022-2023 identificado."
  );

  return (
    catalogos.sistemasTermicos
  );
}
/*
 * ============================================================
 * DETECTOR MAGNETI MARELLI
 * ============================================================
 */

export function detectarCatalogoMagneti(
  nomeArquivo = ""
) {
  const nomeNormalizado =
    normalizarNome(
      nomeArquivo
    );

  const catalogos =
    configuracaoMagneti
      ?.catalogos ||
    {};
/*
 * ========================================================
 * PRIORIDADE ABSOLUTA
 * SENSOR MAP 2016
 *
 * A cópia do catálogo destinada ao MAP possui
 * "MAP" no nome do arquivo.
 *
 * Se existir MAP no nome, NUNCA poderá cair em Bicos.
 * ========================================================
 */

const ehMap2016 =
  nomeNormalizado.includes(
    "map"
  );

if (
  ehMap2016 &&
  catalogos?.sensoresMap2016
) {
  console.log(
    "📡 MAGNETI: Sensor MAP 2016 identificado.",
    nomeArquivo
  );

  return (
    catalogos.sensoresMap2016
  );
}

  /*
   * ========================================================
   * PRIORIDADE 1
   * BICOS INJETORES - ELECTRONIC SYSTEMS 2016
   * ========================================================
   */

  const ehElectronicSystems2016 =
  (
    nomeNormalizado.includes(
      "parts electronic systems and ignition"
    ) ||
    nomeNormalizado.includes(
      "electronic systems and ignition"
    ) ||
    nomeNormalizado.includes(
      "sistemi elettronici e accensione"
    ) ||
    nomeNormalizado.includes(
      "buyers guide section1"
    ) ||
    nomeNormalizado.includes(
      "buyers guide section 1"
    ) ||
    (
      nomeNormalizado.includes(
        "magneti marelli"
      ) &&
      nomeNormalizado.includes(
        "buyers guide"
      )
    )
  );

  if (
  ehElectronicSystems2016 &&
  !nomeNormalizado.includes(
    "map"
  ) &&
  catalogos
    ?.bicosInjetores2016
) {
    console.log(
      "🎯 MAGNETI: Bicos Injetores 2016 identificado."
    );

    return (
      catalogos
        .bicosInjetores2016
    );
  }

  /*
   * ========================================================
   * PRIORIDADE 2
   * VÁLVULAS EGR 2019
   * Parts_EGR_Valves.pdf
   * ========================================================
   */

  const ehValvulasEGR =
    (
      nomeNormalizado.includes(
        "parts egr valves"
      ) ||
      nomeNormalizado.includes(
        "egr valves"
      ) ||
      nomeNormalizado.includes(
        "egr valve"
      ) ||
      nomeNormalizado.includes(
        "valvulas egr"
      ) ||
      nomeNormalizado.includes(
        "valvula egr"
      )
    );

  if (
    ehValvulasEGR &&
    catalogos
      ?.valvulas_egr
  ) {
    console.log(
      "♻️ MAGNETI: Válvulas EGR 2019 identificado."
    );

    return (
      catalogos
        .valvulas_egr
    );
  }

  /*
   * ========================================================
   * PRIORIDADE 3
   * MAÇANETAS E FECHADURAS 2022-2023
   * Parts_Door_handles_EN.pdf
   * ========================================================
   */

  const ehMacanetasFechaduras =
    (
      nomeNormalizado.includes(
        "parts door handles"
      ) ||
      nomeNormalizado.includes(
        "door handles"
      ) ||
      nomeNormalizado.includes(
        "door handle"
      ) ||
      nomeNormalizado.includes(
        "door handles and lockers"
      ) ||
      nomeNormalizado.includes(
        "handles and lockers"
      ) ||
      nomeNormalizado.includes(
        "maniglie e serrature"
      ) ||
      nomeNormalizado.includes(
        "macanetas e fechaduras"
      ) ||
      nomeNormalizado.includes(
        "macanetas"
      ) ||
      nomeNormalizado.includes(
        "fechaduras"
      )
    );

  if (
    ehMacanetasFechaduras &&
    catalogos
      ?.macanetas_fechaduras
  ) {
    console.log(
      "🚪 MAGNETI: Maçanetas e Fechaduras 2022-2023 identificado."
    );

    return (
      catalogos
        .macanetas_fechaduras
    );
  }

  /*
   * ========================================================
   * DETECÇÃO NORMAL
   * ========================================================
   */

  for (
    const catalogo
    of Object.values(
      catalogos
    )
  ) {
    const encontrado =
      (
        catalogo
          ?.palavrasChave ||
        []
      ).some(
        (palavra) =>
          nomeNormalizado.includes(
            normalizarNome(
              palavra
            )
          )
      );

    if (
      encontrado
    ) {
      return catalogo;
    }
  }

  return null;
}

/*
 * ============================================================
 * IMPORTADOR MAGNETI
 * ============================================================
 */

export async function importarMagneti({
  paginasAplicacoes = [],
  paginasEquivalencias = [],
  configuracao = {},
  onProgresso,
}) {
  const origemCatalogo =
    configuracao
      .origemCatalogo ||
    "Catálogo Magneti Marelli";

  const registros =
    [];

  for (
    let indice = 0;
    indice <
    paginasAplicacoes.length;
    indice += 1
  ) {
    const pagina =
      paginasAplicacoes[
        indice
      ];

    const numeroPagina =
      pagina.numeroPagina ||
      pagina.pagina ||
      indice + 1;

    const texto =
      pagina.texto ||
      pagina.conteudo ||
      "";

    const registrosPagina =
      extrairRegistrosPagina({
        texto,

        pagina:
          numeroPagina,

        origemCatalogo,
      });

    registros.push(
      ...registrosPagina
    );

    if (
      onProgresso
    ) {
      onProgresso({
        etapa:
          "processando",

        fabricante:
          "Magneti Marelli",

        pagina:
          numeroPagina,

        totalPaginas:
          paginasAplicacoes.length,

        registrosEncontrados:
          registros.length,
      });
    }
  }

  const registrosUnicos =
    removerDuplicados(
      registros
    );

  return {
    fabricante:
      "Magneti Marelli",

    origemCatalogo,

    registros:
      registrosUnicos,

    equivalencias:
      paginasEquivalencias,

    totalRegistros:
      registrosUnicos.length,
  };
}