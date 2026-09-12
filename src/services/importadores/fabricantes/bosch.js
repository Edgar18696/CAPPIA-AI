import {
  PARSERS_BOSCH,
} from "../parsersBosch";

import detectarLayout from "../utils/detectarLayoutBosch";

function removerDuplicados(registros = []) {
  const mapa = new Map();

  for (const registro of registros) {
    /*
     * =====================================================
     * REGRA PAIIA
     * =====================================================
     *
     * Mesmo código NÃO significa registro duplicado.
     *
     * Só consideramos duplicado quando coincidirem:
     *
     * - código
     * - aplicação
     * - montadora
     * - modelo
     * - motor
     * - anos
     * - descrição da peça
     * - origem do catálogo
     *
     * Assim um catálogo futuro mais completo pode trazer
     * o mesmo código com motor, anos ou outra aplicação
     * sem perdermos informação.
     * =====================================================
     */

    const chave = [
      registro.codigo_oem || "",
      registro.codigo_equivalente || "",

      registro.montadora || "",
      registro.modelo || "",
      registro.motor || "",

      registro.ano_inicio || "",
      registro.ano_fim || "",

      registro.aplicacao || "",

      registro.descricao || "",
      registro.peca || "",

      registro.origem_catalogo || "",
    ]
      .map((valor) =>
        String(valor)
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ")
      )
      .join("|");

    /*
     * Só elimina quando for realmente
     * o mesmo registro completo.
     */
    if (!mapa.has(chave)) {
      mapa.set(
        chave,
        registro
      );
      continue;
    }

    /*
     * =====================================================
     * SE HOUVER DUAS CÓPIAS EXATAS
     * =====================================================
     *
     * Mantemos a mais completa.
     * =====================================================
     */

    const existente =
      mapa.get(chave);

    const pontuarRegistro = (
      item
    ) => {
      let pontos = 0;

      if (item?.codigo_oem) {
        pontos += 10;
      }

      if (item?.montadora) {
        pontos += 10;
      }

      if (item?.modelo) {
        pontos += 10;
      }

      if (item?.motor) {
        pontos += 10;
      }

      if (item?.ano_inicio) {
        pontos += 10;
      }

      if (item?.ano_fim) {
        pontos += 10;
      }

      if (item?.aplicacao) {
        pontos += 10;
      }

      if (item?.descricao) {
        pontos += 10;
      }

      if (item?.origem_catalogo) {
        pontos += 5;
      }

      pontos +=
        Number(
          item?.confianca || 0
        ) / 10;

      return pontos;
    };

    const pontosExistente =
      pontuarRegistro(
        existente
      );

    const pontosNovo =
      pontuarRegistro(
        registro
      );

    if (
      pontosNovo >
      pontosExistente
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
function normalizarTexto(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function identificarTipoCatalogo({
  textoAplicacoes = "",
  nomeArquivo = "",
  configuracao = {},
  deteccao = {},
}) {
  const textoIdentificacao =
    normalizarTexto(
      [
        configuracao?.tipoCatalogo,
        deteccao?.layout,
        deteccao?.tipoCatalogo,
        nomeArquivo,
        configuracao?.origemCatalogo,
        String(
          textoAplicacoes || ""
        ).slice(0, 5000),
      ]
        .filter(Boolean)
        .join(" ")
    );

  let tipoCatalogo =
    configuracao?.tipoCatalogo ||
    deteccao?.layout ||
    deteccao?.tipoCatalogo ||
    "desconhecido";

  if (
    tipoCatalogo === "gasolina_2025"
  ) {
    return "gasolina_2025";
  }
if (
  tipoCatalogo === "gasolina_2023"
) {
  return "gasolina_2023";
}
  if (
    textoIdentificacao.includes(
      "alternadores"
    ) &&
    textoIdentificacao.includes(
      "motores de partida"
    )
  ) {
    tipoCatalogo = "alternadores";
  } else if (
    textoIdentificacao.includes(
      "conjunto retificador"
    ) &&
    textoIdentificacao.includes("estator") &&
    textoIdentificacao.includes("rotor")
  ) {
    tipoCatalogo = "alternadores";
  } else if (
    textoIdentificacao.includes("filtro") ||
    textoIdentificacao.includes(
      "linha leve"
    )
  ) {
    tipoCatalogo = "filtros";
  }

  return tipoCatalogo;
}
function obterMensagemProgresso(
  tipoCatalogo
) {
  const mensagens = {
    gasolina_2023:
      "⛽ Importando Bosch Ignition and Gasoline Injection Product Portfolio 2023...",

    gasolina_2025:
      "⛽ Importando Bosch Gasoline System Product Portfolio 2025...",

    baterias_moto:
      "🏍️ Importando Baterias Bosch para Motocicletas...",

    bicos_gasolina:
      "⛽ Importando Bicos Injetores Bosch...",

    diesel_sth:
      "🚛 Importando Bosch Porta-Injetores STH...",

    diesel_remanufaturado:
      "♻️ Importando Bosch Reman CRIN HPC...",

    diesel:
      "🚛 Importando catálogo Bosch Diesel...",

    bombas:
      "⛽ Importando Bombas de Combustível Bosch...",

    bobinas:
      "🔥 Importando Bobinas Bosch...",

    velas:
      "🔥 Importando Velas Bosch...",

    palhetas:
      "🧹 Importando Palhetas Bosch...",

    filtros:
      "🧰 Importando Filtros Bosch...",

    alternadores:
      "⚡ Importando Alternadores Bosch...",

    alternador:
      "⚡ Importando Alternadores Bosch...",

    abs:
      "🚗 Importando Sensores ABS Bosch...",

    sensores:
      "🧠 Importando Sensores Bosch...",

    sondas:
      "🧠 Executando parser Bosch Sondas...",
  };

  return (
    mensagens[tipoCatalogo] ||
    `📚 Importando catálogo Bosch: ${tipoCatalogo}...`
  );
}

function obterNomeArquivoPadrao(
  tipoCatalogo,
  nomeArquivo,
  configuracao
) {
  if (nomeArquivo) {
    return nomeArquivo;
  }

  if (configuracao?.origemCatalogo) {
    return configuracao.origemCatalogo;
  }

  const arquivosPadrao = {
    gasolina_2023:
  "Bosch Ignition and Gasoline Injection Parts and Sensors Product Portfolio 2023",
    
  gasolina_2025:
      "Bosch Gasoline System Product Portfolio 2025",

    sondas:
      "Catálogo Bosch Sondas 2020",

    bombas:
      "Catálogo Bosch Bombas de Combustível 2019-2020",

    diesel:
      "Catálogo Bosch Diesel 2018",

    bobinas:
      "Catálogo Bosch Velas, Cabos e Bobinas 2019-2020",

    velas:
      "Catálogo Bosch Velas, Cabos e Bobinas 2019-2020",

    ignicao_completo:
      "Catálogo Bosch Velas, Cabos e Bobinas 2019-2020",
  };

  return (
    arquivosPadrao[tipoCatalogo] ||
    "Catálogo Bosch"
  );
}

async function executarParser({
  tipoCatalogo,
  textoAplicacoes,
  textoEquivalencias,
  nomeArquivo,
  configuracao,
  onProgresso,
}) {
  let parser =
    PARSERS_BOSCH[tipoCatalogo];

  if (
    tipoCatalogo === "gasolina_2025" &&
    !parser
  ) {
    parser =
      PARSERS_BOSCH.bicos_gasolina;
  }

  if (!parser) {
    throw new Error(
      `Layout Bosch ainda sem parser: ${tipoCatalogo}.`
    );
  }

  onProgresso?.(
    obterMensagemProgresso(
      tipoCatalogo
    )
  );

  const registros = await parser({
    textoAplicacoes,
    textoEquivalencias,
    configuracao,

    nomeArquivo:
      obterNomeArquivoPadrao(
        tipoCatalogo,
        nomeArquivo,
        configuracao
      ),

    onProgresso,
  });

  return Array.isArray(registros)
    ? registros
    : [];
}

async function importarIgnicaoCompleta({
  textoAplicacoes,
  textoEquivalencias,
  nomeArquivo,
  configuracao,
  onProgresso,
}) {
  onProgresso?.(
    "🔥 Importando Velas e Bobinas Bosch..."
  );

  const nomeFinal =
    obterNomeArquivoPadrao(
      "ignicao_completo",
      nomeArquivo,
      configuracao
    );

  const parserBobinas =
    PARSERS_BOSCH.bobinas;

  const parserVelas =
    PARSERS_BOSCH.velas;

  if (
    !parserBobinas ||
    !parserVelas
  ) {
    throw new Error(
      "Parsers Bosch de velas ou bobinas não encontrados."
    );
  }

  const registrosBobinas =
    await parserBobinas({
      textoAplicacoes,
      textoEquivalencias,
      configuracao,
      nomeArquivo: nomeFinal,
      onProgresso,
    });

  const registrosVelas =
    await parserVelas({
      textoAplicacoes,
      textoEquivalencias,
      configuracao,
      nomeArquivo: nomeFinal,
      onProgresso,
    });

  return [
    ...(Array.isArray(
      registrosBobinas
    )
      ? registrosBobinas
      : []),

    ...(Array.isArray(
      registrosVelas
    )
      ? registrosVelas
      : []),
  ];
}

export async function importarBosch({
  textoAplicacoes = "",
  textoEquivalencias = "",
  nomeArquivo = "",
  configuracao = {},
  onProgresso,
}) {
  const deteccao = detectarLayout({
    fabricante: "bosch",
    nomeArquivo,
    configuracao,
  });

  const tipoCatalogo =
    identificarTipoCatalogo({
      textoAplicacoes,
      nomeArquivo,
      configuracao,
      deteccao,
    });

  console.log(
    "TIPO DO CATÁLOGO:",
    tipoCatalogo
  );

  console.log(
    "TEXTO EXTRAÍDO:"
  );

  console.log(
    String(
      textoAplicacoes || ""
    ).substring(0, 1000)
  );

  console.log(
    "ARQUIVO:",
    nomeArquivo
  );

  console.log(
    "LAYOUT DETECTADO:",
    deteccao
  );

  console.log(
    "CONFIGURAÇÃO:",
    configuracao?.tipoCatalogo
  );

  console.log(
    "TIPO FINAL:",
    tipoCatalogo
  );

  let registros = [];

  if (
    tipoCatalogo ===
    "ignicao_completo"
  ) {
    registros =
      await importarIgnicaoCompleta({
        textoAplicacoes,
        textoEquivalencias,
        nomeArquivo,
        configuracao,
        onProgresso,
      });
  } else {
    registros =
      await executarParser({
        tipoCatalogo,
        textoAplicacoes,
        textoEquivalencias,
        nomeArquivo,
        configuracao,
        onProgresso,
      });
  }

  return removerDuplicados(
    registros
  );
}