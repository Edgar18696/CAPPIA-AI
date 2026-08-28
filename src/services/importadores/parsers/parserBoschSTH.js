function limparTexto(valor = "") {
  return String(valor)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarCodigo(valor = "") {
  return limparTexto(valor)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function separarPaginas(texto = "") {
  const partes = String(texto).split(
    /---\s*PÁGINA\s+(\d+)\s*---/i
  );

  const paginas = [];

  for (
    let indice = 1;
    indice < partes.length;
    indice += 2
  ) {
    paginas.push({
      numeroPagina:
        Number(partes[indice]) || 1,
      texto: partes[indice + 1] || "",
    });
  }

  if (paginas.length === 0) {
    paginas.push({
      numeroPagina: 1,
      texto: String(texto),
    });
  }

  return paginas;
}

function extrairPrimeiro(texto, regex) {
  const resultado =
    String(texto || "").match(regex);

  return resultado
    ? normalizarCodigo(resultado[0])
    : null;
}

function extrairKit(texto) {
  return extrairPrimeiro(
    texto,
    /\bF\s*002\s*C\s*62\s*\d{3}\b/i
  );
}

function extrairPortaInjetor(texto) {
  return extrairPrimeiro(
    texto,
    /\b0\s*432\s*\d{3}\s*\d{3}\b/i
  );
}

function extrairBico(texto) {
  return extrairPrimeiro(
    texto,
    /\b0\s*433\s*\d{3}\s*\d{3}\b/i
  );
}

function extrairDesignacao(texto) {
  return extrairPrimeiro(
    texto,
    /\b(?:DLLA|DSLA)\s*\d{2,3}\s*P\s*\d+\+?\b/i
  );
}

function montarEquivalencias(codigos = []) {
  return [
    ...new Set(
      codigos.filter(Boolean)
    ),
  ].join(" | ");
}

function removerDuplicados(registros = []) {
  const mapa = new Map();

  registros.forEach((registro) => {
    const chave = [
      registro.peca,
      registro.codigo_oem,
      registro.pagina_catalogo,
    ].join("|");

    if (!mapa.has(chave)) {
      mapa.set(chave, registro);
    }
  });

  return Array.from(mapa.values());
}

function criarRegistro({
  peca,
  codigo,
  equivalentes,
  pagina,
  origemCatalogo,
  observacao,
}) {
  return {
    peca,
    codigo_oem: codigo,
    codigo_equivalente:
      montarEquivalencias(equivalentes) ||
      null,
    fabricante: "Bosch",
    origem_catalogo: origemCatalogo,
    montadora: null,
    modelo: null,
    motor: null,
    ano_inicio: null,
    ano_fim: null,
    observacao:
      `Página ${pagina}. ${limparTexto(
        observacao
      )}`,
    pagina_catalogo: pagina,
    ativo: true,
    prioridade: 1,
    confiabilidade: 95,
  };
}

export function parserBoschSTH({
  textoAplicacoes = "",
  configuracao = {},
  nomeArquivo = "",
  onProgresso,
} = {}) {
  const origemCatalogo =
    configuracao.origemCatalogo ||
    nomeArquivo ||
    "Bosch Porta-Injetores STH 2019";

  const paginas =
    separarPaginas(textoAplicacoes);

  const registros = [];

  let ultimoPortaInjetor = null;
  let ultimoBico = null;
  let ultimaDesignacao = null;

  onProgresso?.(
    "🚛 Interpretando Bosch Porta-Injetores STH..."
  );

  paginas.forEach((pagina) => {
    const linhas = String(
      pagina.texto || ""
    )
      .split(/\r?\n/)
      .map(limparTexto)
      .filter(Boolean);

    linhas.forEach((linha) => {
      const portaInjetor =
        extrairPortaInjetor(linha);

      const bico =
        extrairBico(linha);

      const designacao =
        extrairDesignacao(linha);

      const kit =
        extrairKit(linha);

      if (portaInjetor) {
        ultimoPortaInjetor =
          portaInjetor;
      }

      if (bico) {
        ultimoBico = bico;
      }

      if (designacao) {
        ultimaDesignacao =
          designacao;
      }

      if (!kit) {
        return;
      }

      registros.push(
        criarRegistro({
          peca:
            "Kit de Reparo Porta-Injetor STH",
          codigo: kit,
          equivalentes: [
            portaInjetor ||
              ultimoPortaInjetor,
            bico || ultimoBico,
            designacao ||
              ultimaDesignacao,
          ],
          pagina:
            pagina.numeroPagina,
          origemCatalogo,
          observacao: linha,
        })
      );

      const codigoPorta =
        portaInjetor ||
        ultimoPortaInjetor;

      if (codigoPorta) {
        registros.push(
          criarRegistro({
            peca:
              "Porta-Injetor Diesel STH",
            codigo: codigoPorta,
            equivalentes: [
              kit,
              bico || ultimoBico,
              designacao ||
                ultimaDesignacao,
            ],
            pagina:
              pagina.numeroPagina,
            origemCatalogo,
            observacao: linha,
          })
        );
      }

      const codigoBico =
        bico || ultimoBico;

      if (codigoBico) {
        registros.push(
          criarRegistro({
            peca:
              "Bico Injetor Diesel",
            codigo: codigoBico,
            equivalentes: [
              kit,
              codigoPorta,
              designacao ||
                ultimaDesignacao,
            ],
            pagina:
              pagina.numeroPagina,
            origemCatalogo,
            observacao: linha,
          })
        );
      }
    });
  });

  const registrosUnicos =
    removerDuplicados(registros);

  onProgresso?.(
    `✅ ${registrosUnicos.length} registros Bosch STH encontrados.`
  );

  return registrosUnicos;
}

export default parserBoschSTH;