import { parserMotrio } from "../parsers/parserMotrio";

export async function importarRenault({
  textoReferencias = "",
  textoAplicacoes = "",
  textoEquivalencias = "",
  paginasAplicacoes = [],
  configuracao = {},
  nomeArquivo = "",
  onProgresso,
} = {}) {
  const textoPaginasAplicacoes =
    !textoAplicacoes &&
    Array.isArray(paginasAplicacoes)
      ? paginasAplicacoes
          .map(
            (pagina) =>
              pagina?.texto ||
              pagina?.conteudo ||
              ""
          )
          .filter(Boolean)
          .join("\n")
      : "";

  const textoAplicacoesFinal =
    textoAplicacoes ||
    textoPaginasAplicacoes;

  const origemCatalogo =
    configuracao?.origemCatalogo ||
    "Catálogo Renault Motrio 2024";

  const possuiTexto =
    [
      textoReferencias,
      textoAplicacoesFinal,
      textoEquivalencias,
    ]
      .filter(Boolean)
      .join("\n")
      .trim();

  if (!possuiTexto) {
    return {
      fabricante: "Renault",
      origemCatalogo,
      registros: [],
      totalRegistros: 0,
    };
  }

  onProgresso?.(
    "🇫🇷 Preparando Catálogo Renault / Motrio 2024..."
  );

  console.log(
    "========================================"
  );

  console.log(
    "🇫🇷 IMPORTADOR RENAULT / MOTRIO"
  );

  console.log(
    "Arquivo:",
    nomeArquivo
  );

  console.log(
    "Tipo:",
    configuracao?.tipoCatalogo ||
      "motrio_2024"
  );

  console.log(
    "========================================"
  );

  const registros =
    await parserMotrio({
      textoReferencias,

      textoAplicacoes:
        textoAplicacoesFinal,

      textoEquivalencias,

      nomeArquivo,

      configuracao,

      onProgresso,
    });

  const registrosFinais =
    Array.isArray(registros)
      ? registros
      : [];

  console.log(
    "✅ RENAULT / MOTRIO IMPORTADO:",
    registrosFinais.length
  );

  onProgresso?.(
    `✅ Renault/Motrio: ${registrosFinais.length} registro(s) encontrado(s).`
  );

  return {
    fabricante: "Renault",

    origemCatalogo,

    registros:
      registrosFinais,

    totalRegistros:
      registrosFinais.length,
  };
}

export default importarRenault;