import { supabase } from "../supabase";

const COLUNAS_CONFLITO =
  "montadora,modelo,ano_inicio,ano_fim,motor,peca,codigo_oem";

function textoOuNull(valor) {
  const texto = String(valor ?? "").trim();

  return texto || null;
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

function montarDados(registro) {
  const equivalentes = Array.isArray(
    registro.equivalentes
  )
    ? registro.equivalentes
        .map((item) => item?.codigo)
        .filter(Boolean)
    : [];

  return {
    peca: "Sonda Lambda",

    codigo_oem: textoOuNull(
      registro.codigo ||
        registro.codigo_oem
    ),

    codigo_equivalente:
      equivalentes.length > 0
        ? equivalentes.join(", ")
        : textoOuNull(
            registro.codigo_equivalente
          ),

    fabricante: "Bosch",

    origem_catalogo:
      textoOuNull(
        registro.origem_catalogo
      ) ||
      "Catálogo Bosch Sondas 2020",

    montadora: textoOuNull(
      registro.montadora
    ),

    modelo: textoOuNull(
      registro.modelo
    ),

    motor: textoOuNull(
      registro.motor
    ),

    ano_inicio: numeroOuNull(
      registro.ano_inicio
    ),

    ano_fim: numeroOuNull(
      registro.ano_fim
    ),

    observacao:
      textoOuNull(registro.tipo) ||
      textoOuNull(registro.descricao),

    ativo: true,
    prioridade: 1,
    confiabilidade: 100,
  };
}

function criarChaveUnica(item) {
  return [
    item.montadora || "",
    item.modelo || "",
    item.ano_inicio ?? "",
    item.ano_fim ?? "",
    item.motor || "",
    item.peca || "",
    item.codigo_oem || "",
  ]
    .map((valor) =>
      String(valor)
        .trim()
        .toUpperCase()
    )
    .join("|");
}

function removerDuplicados(registros) {
  const mapa = new Map();

  for (const registro of registros) {
    const chave =
      criarChaveUnica(registro);

    mapa.set(chave, registro);
  }

  return Array.from(
    mapa.values()
  );
}

async function salvarRegistroIndividual(
  registro
) {
  const { data, error } = await supabase
    .from("catalogo_pecas")
    .upsert(registro, {
      onConflict: COLUNAS_CONFLITO,
    })
    .select("id");

  return {
    inseridos: Array.isArray(data)
      ? data.length
      : error
        ? 0
        : 1,

    error,
  };
}

export async function salvarBoschSupabase(
  registros = []
) {
  if (
    !Array.isArray(registros) ||
    registros.length === 0
  ) {
    return {
      sucesso: true,
      recebidos: 0,
      unicos: 0,
      inseridos: 0,
      erros: [],
    };
  }

  const dadosMontados = registros
    .map(montarDados)
    .filter(
      (item) =>
        item.codigo_oem &&
        item.peca
    );

  const dadosValidos =
    removerDuplicados(
      dadosMontados
    );

  console.log(
    "REGISTROS RECEBIDOS:",
    registros.length
  );

  console.log(
    "REGISTROS ÚNICOS:",
    dadosValidos.length
  );

  const tamanhoLote = 100;

  const totalLotes = Math.ceil(
    dadosValidos.length /
      tamanhoLote
  );

  let inseridos = 0;
  const erros = [];

  for (
    let inicio = 0;
    inicio < dadosValidos.length;
    inicio += tamanhoLote
  ) {
    const numeroLote =
      Math.floor(
        inicio / tamanhoLote
      ) + 1;

    const lote =
      dadosValidos.slice(
        inicio,
        inicio + tamanhoLote
      );

    console.log(
      `SALVANDO LOTE ${numeroLote} DE ${totalLotes}`
    );

    const { data, error } =
      await supabase
        .from("catalogo_pecas")
        .upsert(lote, {
          onConflict:
            COLUNAS_CONFLITO,
        })
        .select("id");

    if (!error) {
      inseridos +=
        Array.isArray(data)
          ? data.length
          : lote.length;

      continue;
    }

    console.error(
      `ERRO NO LOTE ${numeroLote}:`,
      error
    );

    console.log(
      `Tentando salvar individualmente o lote ${numeroLote}...`
    );

    for (const registro of lote) {
      const resultadoIndividual =
        await salvarRegistroIndividual(
          registro
        );

      if (
        resultadoIndividual.error
      ) {
        console.error(
          "===== ERRO NO REGISTRO ====="
        );

        console.log(
          "REGISTRO:",
          registro
        );

        console.log(
          "CODE:",
          resultadoIndividual.error
            .code
        );

        console.log(
          "MESSAGE:",
          resultadoIndividual.error
            .message
        );

        console.log(
          "DETAILS:",
          resultadoIndividual.error
            .details
        );

        console.log(
          "HINT:",
          resultadoIndividual.error
            .hint
        );

        console.error(
          "============================"
        );

        erros.push({
          lote: numeroLote,

          codigo_oem:
            registro.codigo_oem,

          montadora:
            registro.montadora,

          modelo:
            registro.modelo,

          codigo:
            resultadoIndividual.error
              .code || null,

          mensagem:
            resultadoIndividual.error
              .message || null,

          detalhe:
            resultadoIndividual.error
              .details || null,

          dica:
            resultadoIndividual.error
              .hint || null,
        });

        continue;
      }

      inseridos +=
        resultadoIndividual.inseridos;
    }
  }

  return {
    sucesso:
      erros.length === 0,

    recebidos:
      registros.length,

    unicos:
      dadosValidos.length,

    inseridos,

    erros,
  };
}