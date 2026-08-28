function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\r/g, "")
    .trim();
}

function limparLinha(valor) {
  return normalizarTexto(valor)
    .replace(/\s+/g, " ")
    .trim();
}

function separarLinhas(texto) {
  return String(texto || "")
    .split("\n")
    .map(limparLinha)
    .filter(Boolean);
}

function pareceCodigo(valor) {
  const texto = String(valor || "")
    .replace(/[^A-Z0-9.-]/gi, "")
    .toUpperCase();

  return (
    texto.length >= 4 &&
    texto.length <= 30 &&
    /\d/.test(texto) &&
    /^[A-Z0-9.-]+$/.test(texto)
  );
}

function extrairCodigos(linha) {
  const partes = String(linha || "")
    .split(/[\s,;|/()[\]]+/)
    .map((item) =>
      item
        .replace(/[^A-Z0-9.-]/gi, "")
        .toUpperCase()
    )
    .filter(pareceCodigo);

  return Array.from(new Set(partes));
}

function contarSeparadores(linha) {
  const texto = String(linha || "");

  return {
    espacosDuplos:
      (texto.match(/\s{2,}/g) || [])
        .length,

    barras:
      (texto.match(/\|/g) || [])
        .length,

    pontoVirgula:
      (texto.match(/;/g) || [])
        .length,

    tabulacoes:
      (texto.match(/\t/g) || [])
        .length,
  };
}

function pareceCabecalho(linha) {
  const texto = String(linha || "").trim();

  if (!texto || texto.length > 120) {
    return false;
  }

  const palavrasCabecalho = [
    "codigo",
    "codigo oem",
    "referencia",
    "aplicacao",
    "aplicacoes",
    "montadora",
    "veiculo",
    "modelo",
    "motor",
    "ano",
    "fabricante",
    "equivalencia",
    "equivalencias",
    "descricao",
    "produto",
    "marca",
  ];

  const normalizado =
    normalizarTexto(texto).toLowerCase();

  const quantidadeEncontrada =
    palavrasCabecalho.filter((palavra) =>
      normalizado.includes(palavra)
    ).length;

  return quantidadeEncontrada >= 2;
}

function identificarTipoLinha(linha) {
  const normalizado =
    normalizarTexto(linha).toLowerCase();

  const codigos =
    extrairCodigos(linha);

  if (pareceCabecalho(linha)) {
    return "cabecalho";
  }

  if (
    /\b(aplicacoes?|veiculos?|modelos?)\b/i.test(
      normalizado
    )
  ) {
    return "titulo_aplicacoes";
  }

  if (
    /\b(equivalencias?|cross reference|interchange|oem)\b/i.test(
      normalizado
    )
  ) {
    return "titulo_equivalencias";
  }

  if (
    codigos.length >= 2 &&
    linha.length < 160
  ) {
    return "equivalencia";
  }

  if (
    codigos.length >= 1 &&
    /\b(19|20)\d{2}\b/.test(linha)
  ) {
    return "aplicacao";
  }

  if (codigos.length >= 1) {
    return "codigo";
  }

  return "texto";
}

function detectarColunas(linhas) {
  const candidatos = [];

  for (const linha of linhas) {
    const separadores =
      contarSeparadores(linha);

    const total =
      separadores.espacosDuplos +
      separadores.barras +
      separadores.pontoVirgula +
      separadores.tabulacoes;

    if (total >= 2) {
      candidatos.push({
        linha,
        totalSeparadores: total,
        separadores,
      });
    }
  }

  return {
    possuiEstruturaColunas:
      candidatos.length >= 3,

    linhasComColunas:
      candidatos.length,

    exemplos:
      candidatos
        .slice(0, 5)
        .map((item) => item.linha),
  };
}

function detectarBlocos(linhas) {
  const blocos = [];
  let blocoAtual = null;

  linhas.forEach((linha, indice) => {
    const tipo =
      identificarTipoLinha(linha);

    const iniciaBloco =
      [
        "cabecalho",
        "titulo_aplicacoes",
        "titulo_equivalencias",
      ].includes(tipo);

    if (iniciaBloco) {
      if (blocoAtual) {
        blocos.push(blocoAtual);
      }

      blocoAtual = {
        tipo,
        linhaInicial: indice + 1,
        linhaFinal: indice + 1,
        titulo: linha,
        linhas: [linha],
      };

      return;
    }

    if (!blocoAtual) {
      blocoAtual = {
        tipo: "conteudo",
        linhaInicial: indice + 1,
        linhaFinal: indice + 1,
        titulo: "",
        linhas: [],
      };
    }

    blocoAtual.linhaFinal =
      indice + 1;

    blocoAtual.linhas.push(linha);
  });

  if (blocoAtual) {
    blocos.push(blocoAtual);
  }

  return blocos.map((bloco) => ({
    tipo: bloco.tipo,
    linhaInicial:
      bloco.linhaInicial,
    linhaFinal:
      bloco.linhaFinal,
    titulo: bloco.titulo,
    quantidadeLinhas:
      bloco.linhas.length,
    exemplos:
      bloco.linhas.slice(0, 3),
  }));
}

function calcularEstatisticas(linhas) {
  const tipos = {
    cabecalho: 0,
    titulo_aplicacoes: 0,
    titulo_equivalencias: 0,
    aplicacao: 0,
    equivalencia: 0,
    codigo: 0,
    texto: 0,
  };

  let totalCodigos = 0;

  for (const linha of linhas) {
    const tipo =
      identificarTipoLinha(linha);

    tipos[tipo] += 1;

    totalCodigos +=
      extrairCodigos(linha).length;
  }

  return {
    totalLinhas: linhas.length,
    totalCodigos,
    tipos,
  };
}

function calcularConfianca({
  estatisticas,
  colunas,
  blocos,
}) {
  let pontos = 0;

  if (
    estatisticas.totalCodigos >= 5
  ) {
    pontos += 25;
  }

  if (
    estatisticas.tipos.aplicacao >= 3
  ) {
    pontos += 25;
  }

  if (
    estatisticas.tipos.equivalencia >= 2
  ) {
    pontos += 20;
  }

  if (
    estatisticas.tipos.cabecalho >= 1
  ) {
    pontos += 15;
  }

  if (
    colunas.possuiEstruturaColunas
  ) {
    pontos += 15;
  }

  if (blocos.length >= 2) {
    pontos += 10;
  }

  return Math.min(pontos, 100);
}

export function analisarLayoutPdf(
  paginas = []
) {
  const paginasAnalisadas =
    paginas.map((pagina, indice) => {
      const texto =
        pagina?.texto ||
        pagina?.conteudo ||
        "";

      const linhas =
        separarLinhas(texto);

      const estatisticas =
        calcularEstatisticas(linhas);

      const colunas =
        detectarColunas(linhas);

      const blocos =
        detectarBlocos(linhas);

      const confianca =
        calcularConfianca({
          estatisticas,
          colunas,
          blocos,
        });

      return {
        numeroPagina:
          pagina?.numeroPagina ||
          pagina?.pagina ||
          indice + 1,

        estatisticas,
        colunas,
        blocos,
        confianca,

        possuiAplicacoes:
          estatisticas.tipos.aplicacao >
            0 ||
          estatisticas.tipos
            .titulo_aplicacoes > 0,

        possuiEquivalencias:
          estatisticas.tipos
            .equivalencia > 0 ||
          estatisticas.tipos
            .titulo_equivalencias > 0,

        possuiTabela:
          colunas.possuiEstruturaColunas,
      };
    });

  const paginasAplicacoes =
    paginasAnalisadas
      .filter(
        (pagina) =>
          pagina.possuiAplicacoes
      )
      .map(
        (pagina) =>
          pagina.numeroPagina
      );

  const paginasEquivalencias =
    paginasAnalisadas
      .filter(
        (pagina) =>
          pagina.possuiEquivalencias
      )
      .map(
        (pagina) =>
          pagina.numeroPagina
      );

  const paginasComTabela =
    paginasAnalisadas
      .filter(
        (pagina) =>
          pagina.possuiTabela
      )
      .map(
        (pagina) =>
          pagina.numeroPagina
      );

  const mediaConfianca =
    paginasAnalisadas.length > 0
      ? Math.round(
          paginasAnalisadas.reduce(
            (total, pagina) =>
              total +
              pagina.confianca,
            0
          ) /
            paginasAnalisadas.length
        )
      : 0;

  return {
    totalPaginas:
      paginasAnalisadas.length,

    paginasAplicacoes,

    paginasEquivalencias,

    paginasComTabela,

    paginaInicialAplicacoes:
      paginasAplicacoes[0] || null,

    paginaFinalAplicacoes:
      paginasAplicacoes.at(-1) ||
      null,

    paginaInicialEquivalencias:
      paginasEquivalencias[0] ||
      null,

    paginaFinalEquivalencias:
      paginasEquivalencias.at(-1) ||
      null,

    confianca:
      mediaConfianca,

    paginas:
      paginasAnalisadas,
  };
}