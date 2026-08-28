import { supabase } from "../../supabase";

function limparTexto(valor) {
  return String(valor || "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function limparCodigo(valor) {
  return String(valor || "")
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9.-]/gi, "")
    .toUpperCase()
    .trim();
}

function dividirTextoEmLotes(
  texto,
  tamanhoMaximo = 12000
) {
  const conteudo = limparTexto(texto);

  if (!conteudo) {
    return [];
  }

  const linhas = conteudo.split("\n");
  const lotes = [];

  let loteAtual = "";

  for (const linha of linhas) {
    const linhaFinal = `${linha}\n`;

    if (
      loteAtual.length +
        linhaFinal.length >
        tamanhoMaximo &&
      loteAtual.trim()
    ) {
      lotes.push(loteAtual.trim());
      loteAtual = "";
    }

    loteAtual += linhaFinal;
  }

  if (loteAtual.trim()) {
    lotes.push(loteAtual.trim());
  }

  return lotes;
}

function normalizarRegistro(
  registro,
  fabricante,
  origemCatalogo
) {
  const anoInicio =
    Number(registro?.ano_inicio) || null;

  const anoFim =
    Number(registro?.ano_fim) || null;

  return {
    peca:
      limparTexto(registro?.peca) ||
      `Autopeça ${fabricante}`,

    codigo_oem:
      limparCodigo(
        registro?.codigo_oem
      ),

    codigo_equivalente:
      limparTexto(
        registro?.codigo_equivalente
      ),

    fabricante:
      limparTexto(
        registro?.fabricante
      ) || fabricante,

    origem_catalogo:
      origemCatalogo,

    montadora:
      limparTexto(
        registro?.montadora
      ),

    modelo:
      limparTexto(
        registro?.modelo
      ),

    motor:
      limparTexto(
        registro?.motor
      ),

    ano_inicio:
      anoInicio,

    ano_fim:
      anoFim,

    observacao:
      limparTexto(
        registro?.observacao
      ),

    pagina_catalogo:
      Number(
        registro?.pagina_catalogo
      ) || null,

    ativo: true,

    prioridade:
      Number(
        registro?.prioridade
      ) || 5,

    confiabilidade:
      Number(
        registro?.confiabilidade
      ) || 80,
  };
}

function removerRegistrosInvalidos(
  registros
) {
  return registros.filter(
    (registro) =>
      registro.codigo_oem &&
      (
        registro.modelo ||
        registro.montadora ||
        registro.peca
      )
  );
}

function removerDuplicados(
  registros
) {
  const mapa = new Map();

  for (const registro of registros) {
    const chave = [
      registro.codigo_oem,
      registro.codigo_equivalente,
      registro.montadora,
      registro.modelo,
      registro.motor,
      registro.ano_inicio,
      registro.ano_fim,
    ]
      .map((valor) =>
        String(valor || "")
          .trim()
          .toUpperCase()
      )
      .join("|");

    if (!mapa.has(chave)) {
      mapa.set(chave, registro);
    }
  }

  return Array.from(
    mapa.values()
  );
}

export async function interpretarCatalogoComIa({
  texto,
  fabricante = "",
  origemCatalogo = "",
  nomeArquivo = "",
  paginaInicial = null,
  paginaFinal = null,
  onProgresso,
}) {
  const textoFinal =
    limparTexto(texto);

  if (!textoFinal) {
    throw new Error(
      "Nenhum texto foi informado para a interpretação por IA."
    );
  }

  const fabricanteFinal =
    limparTexto(fabricante) ||
    "Fabricante não identificado";

  const origemFinal =
    limparTexto(origemCatalogo) ||
    limparTexto(nomeArquivo) ||
    "Catálogo interpretado por IA";

  const lotes =
    dividirTextoEmLotes(
      textoFinal
    );

  if (!lotes.length) {
    throw new Error(
      "Não foi possível preparar o catálogo para interpretação."
    );
  }

  const registrosEncontrados = [];

  for (
    let indice = 0;
    indice < lotes.length;
    indice += 1
  ) {
    onProgresso?.(
      `🧠 IA analisando lote ${
        indice + 1
      } de ${lotes.length}...`
    );

    const { data, error } =
      await supabase.functions.invoke(
        "interpretar-catalogo",
        {
          body: {
            texto: lotes[indice],

            fabricante:
              fabricanteFinal,

            origemCatalogo:
              origemFinal,

            nomeArquivo,

            paginaInicial,
            paginaFinal,

            loteAtual:
              indice + 1,

            totalLotes:
              lotes.length,
          },
        }
      );

    if (error) {
      console.error(
        "Erro na interpretação por IA:",
        error
      );

      throw new Error(
        error.message ||
          `Erro ao interpretar o lote ${
            indice + 1
          }.`
      );
    }

    const registrosLote =
      Array.isArray(data)
        ? data
        : data?.registros || [];

    for (const registro of registrosLote) {
      registrosEncontrados.push(
        normalizarRegistro(
          registro,
          fabricanteFinal,
          origemFinal
        )
      );
    }
  }

  const registrosValidos =
    removerRegistrosInvalidos(
      registrosEncontrados
    );

  const registrosUnicos =
    removerDuplicados(
      registrosValidos
    );

  if (!registrosUnicos.length) {
    throw new Error(
      "A IA não encontrou registros válidos no catálogo."
    );
  }

  onProgresso?.(
    `✅ IA encontrou ${registrosUnicos.length} registros válidos.`
  );

  return {
    sucesso: true,

    fabricante:
      fabricanteFinal,

    origemCatalogo:
      origemFinal,

    totalLotes:
      lotes.length,

    encontrados:
      registrosEncontrados.length,

    validos:
      registrosValidos.length,

    unicos:
      registrosUnicos.length,

    registros:
      registrosUnicos,
  };
}