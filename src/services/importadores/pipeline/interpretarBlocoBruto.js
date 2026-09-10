import {
  ehTokenCodigoAlfanumerico,
  linhaNumeroPaginaOuRodape,
  tokensDeIdentificador,
} from "./montarBlocosBrutos.js";

const PALAVRAS_CABECALHO = new Set([
  "OTHER",
  "PARTS",
  "TYPE",
  "INDEX",
  "INDICE",
  "CONTENTS",
  "SUMMARY",
  "PAGE",
  "GROUP",
  "GRUPPO",
]);

const MONTADORAS_APLICACAO = new Set([
  "ABARTH",
  "AUDI",
  "BMW",
  "CHEVROLET",
  "CHRYSLER",
  "CITROEN",
  "DACIA",
  "FIAT",
  "FORD",
  "HONDA",
  "HYUNDAI",
  "IVECO",
  "JEEP",
  "KIA",
  "LANCIA",
  "MERCEDES",
  "NISSAN",
  "OPEL",
  "PEUGEOT",
  "RENAULT",
  "SEAT",
  "SKODA",
  "TOYOTA",
  "VOLKSWAGEN",
  "VOLVO",
  "VW",
]);

function linhasDoTexto(texto = "") {
  return String(texto || "")
    .split(/\r?\n/)
    .map((linha) => String(linha || "").trim())
    .filter((linha, indice, lista) => linha || lista.length === 1);
}

function tokensDaLinha(texto = "") {
  return String(texto || "")
    .toUpperCase()
    .replace(/\u00a0/g, " ")
    .split(/[\s|/,-]+/)
    .map((token) => token.replace(/^[^A-Z0-9]+|[^A-Z0-9.\-]+$/g, ""))
    .filter(Boolean);
}

function ehLinhaCabecalho(texto = "") {
  const tokens = tokensDaLinha(texto);
  if (tokens.length === 0) {
    return false;
  }
  return tokens.every(
    (token) => PALAVRAS_CABECALHO.has(token) || linhaNumeroPaginaOuRodape(token)
  );
}

function ehLinhaDescricao(texto = "") {
  const bruto = String(texto || "").trim();
  if (!bruto || ehLinhaCabecalho(bruto) || linhaNumeroPaginaOuRodape(bruto)) {
    return false;
  }
  if (/\bOE\b/i.test(bruto)) {
    return false;
  }
  if (tokensDeIdentificador(bruto).some((token) => /^\d{8,}$/.test(token))) {
    return false;
  }
  if (tokensDeIdentificador(bruto).some((token) => ehTokenCodigoAlfanumerico(token))) {
    return false;
  }
  const palavras = bruto.split(/\s+/).filter(Boolean);
  if (palavras.length === 0 || palavras.length > 6) {
    return false;
  }
  return palavras.every(
    (palavra) => /[A-Za-zÀ-ÿ]/.test(palavra) && !/[0-9]/.test(palavra)
  );
}

function extrairDescricaoEmLinha(texto = "") {
  const match = String(texto || "").match(
    /-\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{2,40}[A-Za-zÀ-ÿ])\s*-?/
  );
  if (!match?.[1]) {
    return null;
  }
  const descricao = match[1].replace(/\s+/g, " ").trim();
  if (!descricao || ehLinhaCabecalho(descricao) || /\d/.test(descricao)) {
    return null;
  }
  return descricao;
}

function parseInternoDescricao(linha = "") {
  const match = String(linha || "").match(/^(\d{8,})\s*-\s*(.*?)\s*$/);
  if (!match) {
    return null;
  }

  const interno = match[1];
  const descricao =
    extrairDescricaoEmLinha(linha) ||
    (ehLinhaDescricao(match[2].replace(/\s*-\s*$/, "").trim())
      ? match[2].replace(/\s*-\s*$/, "").trim()
      : null);

  return { interno, descricao };
}

function parseComercialOe(linha = "") {
  const match = String(linha || "").match(
    /\b([A-Z][A-Z0-9.\-]{3,})\s+OE\s+([A-Z0-9][A-Z0-9.\-]{5,})/i
  );
  if (!match) {
    return null;
  }
  const comercial = String(match[1]).toUpperCase();
  if (!ehTokenCodigoAlfanumerico(comercial)) {
    return null;
  }
  return {
    comercial,
    oem: String(match[2]).toUpperCase(),
  };
}

function fabricanteExplicito(texto = "") {
  const bruto = String(texto || "").toUpperCase();
  if (/\bMAGNETI[\s-]?MARELLI\b/.test(bruto)) {
    return "MAGNETI MARELLI";
  }
  if (/\bBOSCH\b/.test(bruto)) {
    return "BOSCH";
  }
  if (/\bNGK\b|\bNTK\b/.test(bruto)) {
    return "NGK";
  }
  return null;
}

function extrairRegistrosEstruturados(linhas = []) {
  const registros = [];

  for (let indice = 0; indice < linhas.length; indice += 1) {
    const interno = parseInternoDescricao(linhas[indice]);
    const seguinte = linhas[indice + 1];
    const comercialOe = seguinte ? parseComercialOe(seguinte) : null;

    if (interno?.interno && interno?.descricao && comercialOe) {
      registros.push({
        codigo_interno: interno.interno,
        descricao: interno.descricao,
        codigo_peca: comercialOe.comercial,
        oem: comercialOe.oem,
        evidencias: {
          interno: linhas[indice],
          comercial: seguinte,
        },
      });
      indice += 1;
    }
  }

  return registros;
}

function contarDescricoes(linhas = []) {
  return linhas.filter(
    (linha) => ehLinhaDescricao(linha) || Boolean(extrairDescricaoEmLinha(linha))
  ).length;
}

function ehListaGrande(linhas = [], registros = []) {
  const oeCount = linhas.filter((linha) => Boolean(parseComercialOe(linha))).length;
  const internoComDescricao = linhas.filter(
    (linha) => Boolean(parseInternoDescricao(linha)?.descricao)
  ).length;
  const descricoes = contarDescricoes(linhas);

  if (registros.length >= 2 || oeCount >= 2 || internoComDescricao >= 2) {
    return true;
  }

  if (descricoes >= 2 && linhas.filter(Boolean).length >= 6) {
    return true;
  }

  return false;
}

function evidenciar(trecho) {
  if (!trecho) {
    return null;
  }
  return String(trecho);
}

function ehLinhaPeriodoAplicacao(texto = "") {
  const bruto = String(texto || "");
  return (
    /\b\d{2}\/\d{2}(?:\s*[-–àa]\s*\d{2}\/\d{2})?\b/i.test(bruto) ||
    /\b(19|20)\d{2}\s*[-–/àa]\s*(19|20)\d{2}\b/.test(bruto)
  );
}

function ehLinhaMontadoraAplicacao(texto = "") {
  const tokens = tokensDaLinha(texto);
  if (tokens.length === 0 || tokens.length > 4) {
    return false;
  }
  return tokens.some((token) => MONTADORAS_APLICACAO.has(token));
}

function ehLinhaModeloComCodigo(texto = "") {
  return /\b[A-Za-z0-9][A-Za-z0-9.\- /]{1,40}\s*\([A-Z0-9][A-Z0-9._,\-/]{1,24}\)/.test(
    String(texto || "")
  );
}

function pareceBlocoAplicacao(linhas = []) {
  const montadoras = linhas.filter((linha) => ehLinhaMontadoraAplicacao(linha)).length;
  const periodos = linhas.filter((linha) => ehLinhaPeriodoAplicacao(linha)).length;
  const modelos = linhas.filter((linha) => ehLinhaModeloComCodigo(linha)).length;

  if (montadoras >= 1 && (periodos >= 1 || modelos >= 1)) {
    return true;
  }

  return false;
}

function pareceBlocoIndice(texto = "", linhas = []) {
  const bruto = String(texto || "");
  if (!/\b(INDEX|INDICE|CONTENTS|SUMMARY)\b/i.test(bruto)) {
    return false;
  }
  if (linhas.some((linha) => Boolean(parseComercialOe(linha)))) {
    return false;
  }
  if (extrairRegistrosEstruturados(linhas).length > 0) {
    return false;
  }
  return true;
}

export function interpretarBlocoBruto({
  texto_original = "",
  linhas_originais = [],
} = {}) {
  const texto = String(texto_original || "");
  const linhas =
    Array.isArray(linhas_originais) && linhas_originais.length > 0
      ? linhas_originais
          .map((linha) => String(linha?.texto || "").trim())
          .filter((linha, i, lista) => linha || lista.length === 1)
      : linhasDoTexto(texto);

  const vazio = {
    classificacao_candidata: "indefinido",
    codigo_peca: null,
    codigo_interno: null,
    descricao: null,
    oem: null,
    fabricante_marca: null,
    aplicacoes: [],
    equivalencias: [],
    evidencias: {},
    confianca: 0,
    motivo_classificacao:
      "Sem evidência suficiente no próprio texto para classificar o bloco.",
    revisao_manual: true,
    status_interpretacao: "indefinido",
  };

  if (!texto.trim()) {
    return vazio;
  }

  const temCabecalhoGenerico = linhas.some((linha) => ehLinhaCabecalho(linha));
  const soCabecalho = linhas.every(
    (linha) =>
      !linha || ehLinhaCabecalho(linha) || linhaNumeroPaginaOuRodape(linha)
  );

  if (soCabecalho) {
    return {
      ...vazio,
      classificacao_candidata: "cabecalho",
      motivo_classificacao:
        "Bloco contém apenas cabeçalho/rodapé, sem identificador de peça.",
      status_interpretacao: "revisao_manual",
      confianca: 0.4,
    };
  }

  const fabricante_marca = fabricanteExplicito(texto);
  const registros = extrairRegistrosEstruturados(linhas);

  if (ehListaGrande(linhas, registros)) {
    return {
      ...vazio,
      classificacao_candidata: "tabela_referencia",
      fabricante_marca,
      evidencias: {
        registros_estruturados: registros.length,
        linhas: linhas.length,
      },
      confianca: 0.35,
      motivo_classificacao:
        "Estrutura de lista/tabela com mais de um registro de produto. Não atribuir produto individual.",
      revisao_manual: true,
      status_interpretacao: "revisao_manual",
    };
  }

  if (registros.length === 1) {
    const registro = registros[0];
    const revisaoPorCabecalho = temCabecalhoGenerico;

    return {
      classificacao_candidata: "produto",
      codigo_peca: registro.codigo_peca,
      codigo_interno: registro.codigo_interno,
      descricao: registro.descricao,
      oem: registro.oem,
      fabricante_marca,
      aplicacoes: [],
      equivalencias: [],
      evidencias: {
        codigo: evidenciar(registro.evidencias.comercial),
        codigo_interno: registro.codigo_interno,
        linha_interna: evidenciar(registro.evidencias.interno),
        oem: registro.oem ? evidenciar(`OE ${registro.oem}`) : null,
        descricao: registro.descricao,
      },
      confianca: revisaoPorCabecalho ? 0.5 : 0.75,
      motivo_classificacao: revisaoPorCabecalho
        ? "Padrão interno + comercial + OE evidenciado, com cabeçalho genérico. Revisão manual."
        : "Padrão explícito: código interno - descrição - / código comercial OE OEM.",
      revisao_manual: true,
      status_interpretacao: revisaoPorCabecalho ? "revisao_manual" : "candidato",
    };
  }

  const linhaOe = linhas.find((linha) => Boolean(parseComercialOe(linha)));
  const unicoOe = linhaOe ? parseComercialOe(linhaOe) : null;

  if (unicoOe) {
    const indice = linhas.indexOf(linhaOe);
    const vizinhas = [
      linhas[indice - 1],
      linhaOe,
      linhas[indice + 1],
    ];
    const descricao =
      vizinhas.find((linha) => ehLinhaDescricao(linha)) ||
      vizinhas.map((linha) => extrairDescricaoEmLinha(linha)).find(Boolean) ||
      null;
    const internoVizinho = parseInternoDescricao(linhas[indice - 1] || "");

    if (descricao || unicoOe.oem) {
      return {
        classificacao_candidata: "produto",
        codigo_peca: unicoOe.comercial,
        codigo_interno: internoVizinho?.interno || null,
        descricao,
        oem: unicoOe.oem,
        fabricante_marca,
        aplicacoes: [],
        equivalencias: [],
        evidencias: {
          codigo: evidenciar(linhaOe),
          codigo_interno: internoVizinho?.interno || null,
          oem: evidenciar(`OE ${unicoOe.oem}`),
          descricao,
        },
        confianca: temCabecalhoGenerico ? 0.45 : 0.7,
        motivo_classificacao:
          "Um código comercial com OE evidenciado no próprio bloco.",
        revisao_manual: true,
        status_interpretacao: temCabecalhoGenerico
          ? "revisao_manual"
          : "candidato",
      };
    }
  }

  if (pareceBlocoIndice(texto, linhas)) {
    return {
      ...vazio,
      classificacao_candidata: "indice",
      fabricante_marca,
      evidencias: { linhas: linhas.length },
      confianca: 0.45,
      motivo_classificacao:
        "Estrutura de índice/sumário evidenciada no próprio bloco.",
      revisao_manual: true,
      status_interpretacao: "revisao_manual",
    };
  }

  if (pareceBlocoAplicacao(linhas)) {
    return {
      ...vazio,
      classificacao_candidata: "aplicacao",
      fabricante_marca,
      evidencias: {
        montadoras: linhas.filter((linha) => ehLinhaMontadoraAplicacao(linha))
          .length,
        periodos: linhas.filter((linha) => ehLinhaPeriodoAplicacao(linha)).length,
      },
      confianca: 0.5,
      motivo_classificacao:
        "Estrutura de aplicação (montadora/modelo/período) sem produto único evidenciado.",
      revisao_manual: true,
      status_interpretacao: "revisao_manual",
    };
  }

  return {
    ...vazio,
    fabricante_marca,
    motivo_classificacao:
      "A relação entre os códigos do bloco não está suficientemente clara para um produto único.",
  };
}

export const CODIGOS_AMOSTRA_FASE2 = ["IWP049", "TB0032", "FEI0019"];
