function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\r/g, "")
    .toLowerCase()
    .trim();
}

function extrairNumeroPagina(
  texto,
  termos = []
) {
  const linhas = String(texto || "")
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean);

  for (const linha of linhas) {
    const linhaNormalizada =
      normalizarTexto(linha);

    const possuiTermo =
      termos.some((termo) =>
        linhaNormalizada.includes(
          normalizarTexto(termo)
        )
      );

    if (!possuiTermo) {
      continue;
    }

    const numeros =
      linha.match(/\b\d{1,3}\b/g);

    if (!numeros?.length) {
      continue;
    }

    const pagina =
      Number(
        numeros[numeros.length - 1]
      );

    if (
      Number.isInteger(pagina) &&
      pagina > 0
    ) {
      return {
        pagina,
        linhaOriginal: linha,
      };
    }
  }

  return null;
}

export function localizarIndiceCatalogo(
  paginas = []
) {
  const resultado = {
    encontrouIndice: false,

    paginaIndice: null,

    paginaInicialAplicacoes: null,

    paginaInicialEquivalencias: null,

    linhaAplicacoes: "",

    linhaEquivalencias: "",

    confianca: 0,
  };

  const paginasIniciais =
    paginas.slice(0, 12);

  for (const pagina of paginasIniciais) {
    const texto =
      pagina?.texto ||
      pagina?.conteudo ||
      "";

    const aplicacoes =
      extrairNumeroPagina(texto, [
        "aplicacoes",
        "aplicação",
        "aplicacoes por veiculo",
        "aplicacoes por fabricante",
        "vehicle applications",
      ]);

    const equivalencias =
      extrairNumeroPagina(texto, [
        "equivalencias",
        "equivalência",
        "equivalencias de codigos",
        "cross reference",
        "cross-reference",
        "interchange",
      ]);

    if (
      aplicacoes ||
      equivalencias
    ) {
      resultado.encontrouIndice =
        true;

      resultado.paginaIndice =
        pagina.numeroPagina ||
        pagina.pagina ||
        null;
    }

    if (
      aplicacoes &&
      !resultado.paginaInicialAplicacoes
    ) {
      resultado.paginaInicialAplicacoes =
        aplicacoes.pagina;

      resultado.linhaAplicacoes =
        aplicacoes.linhaOriginal;
    }

    if (
      equivalencias &&
      !resultado.paginaInicialEquivalencias
    ) {
      resultado.paginaInicialEquivalencias =
        equivalencias.pagina;

      resultado.linhaEquivalencias =
        equivalencias.linhaOriginal;
    }

    if (
      resultado.paginaInicialAplicacoes &&
      resultado.paginaInicialEquivalencias
    ) {
      break;
    }
  }

  let pontos = 0;

  if (resultado.encontrouIndice) {
    pontos += 20;
  }

  if (
    resultado.paginaInicialAplicacoes
  ) {
    pontos += 40;
  }

  if (
    resultado.paginaInicialEquivalencias
  ) {
    pontos += 40;
  }

  resultado.confianca =
    pontos;

  return resultado;
}