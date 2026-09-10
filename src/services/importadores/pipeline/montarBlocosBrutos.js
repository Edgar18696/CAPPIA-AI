function escaparRegex(valor = "") {
  return String(valor).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function montarLinhasOriginais(textoPagina = "") {
  const bruto = String(textoPagina ?? "");
  const partes = bruto.length ? bruto.split(/\r?\n/) : [""];

  return partes.map((texto, indice) => ({
    i: indice + 1,
    texto: String(texto ?? ""),
  }));
}

export function ehTokenCodigoNumerico(token = "") {
  return /^[0-9]{6,}$/.test(String(token || "").trim());
}

export function ehTokenCodigoAlfanumerico(token = "") {
  const valor = String(token || "")
    .trim()
    .toUpperCase();

  if (!/^[A-Z][A-Z0-9.\-]{3,}$/.test(valor)) {
    return false;
  }

  if (!/[A-Z]/.test(valor) || !/[0-9]/.test(valor)) {
    return false;
  }

  if (/^(19|20)\d{2}$/.test(valor)) {
    return false;
  }

  return true;
}

export function ehTokenCodigoTecnico(token = "") {
  const valor = String(token || "").trim();
  return ehTokenCodigoNumerico(valor) || ehTokenCodigoAlfanumerico(valor);
}

export function tokensDeIdentificador(texto = "") {
  return String(texto || "")
    .toUpperCase()
    .replace(/\u00a0/g, " ")
    .split(/[\s|/]+/)
    .map((token) => token.replace(/^[^A-Z0-9]+|[^A-Z0-9.\-]+$/g, ""))
    .filter(Boolean);
}

function ehPalavraProsa(token = "") {
  const valor = String(token || "").trim();
  return /[A-Za-zÀ-ÿ]{3,}/.test(valor) && !/[0-9]/.test(valor);
}

export function linhaSoIdentificadores(texto = "") {
  const tokens = tokensDeIdentificador(texto);

  if (tokens.length === 0) {
    return false;
  }

  if (tokens.some((token) => !ehTokenCodigoTecnico(token))) {
    return false;
  }

  const originais = String(texto || "")
    .replace(/\u00a0/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/[/|]/g, ""))
    .filter(Boolean);

  if (originais.some((token) => ehPalavraProsa(token))) {
    return false;
  }

  return true;
}

export function linhaNumeroPaginaOuRodape(texto = "") {
  return /^\d{1,3}$/.test(String(texto || "").trim());
}

export function linhaDeAplicacaoOuObservacao(texto = "") {
  const bruto = String(texto || "").trim();

  if (!bruto || linhaNumeroPaginaOuRodape(bruto) || linhaSoIdentificadores(bruto)) {
    return false;
  }

  if (/\b(19|20)\d{2}\b/.test(bruto)) {
    return true;
  }

  if (/\b\d+[.,]\d+\b/.test(bruto)) {
    return true;
  }

  if (/\b\d{1,2}\s*V\b/i.test(bruto)) {
    return true;
  }

  const palavras = bruto.split(/\s+/).filter(Boolean);
  const prosa = palavras.filter((token) => ehPalavraProsa(token));

  if (prosa.length >= 3) {
    return true;
  }

  if (palavras.length >= 4) {
    return true;
  }

  const temCodigo = tokensDeIdentificador(bruto).some((token) =>
    ehTokenCodigoTecnico(token)
  );

  if (temCodigo && prosa.length >= 1) {
    return true;
  }

  return false;
}

function blocoTemCorpoAplicacao(linhas = []) {
  return linhas.some((linha) => linhaDeAplicacaoOuObservacao(linha?.texto));
}

function identificadorJaCitadoNoBloco(linhas = [], textoLinha = "") {
  const tokens = tokensDeIdentificador(textoLinha).filter((token) =>
    ehTokenCodigoTecnico(token)
  );

  if (tokens.length === 0) {
    return false;
  }

  const textoBloco = linhas
    .map((linha) => String(linha?.texto || "").toUpperCase())
    .join("\n");

  return tokens.some((token) => {
    const padrao = new RegExp(
      `(^|[^A-Z0-9])${escaparRegex(token)}([^A-Z0-9]|$)`,
      "i"
    );
    return padrao.test(textoBloco);
  });
}

export function deveAbrirNovoBlocoBruto(blocoAtual = [], textoLinha = "") {
  const texto = String(textoLinha || "");
  const atual = Array.isArray(blocoAtual) ? blocoAtual : [];

  if (atual.length === 0) {
    return false;
  }

  if (linhaNumeroPaginaOuRodape(texto)) {
    return false;
  }

  if (!linhaSoIdentificadores(texto)) {
    return false;
  }

  if (!blocoTemCorpoAplicacao(atual)) {
    return false;
  }

  if (identificadorJaCitadoNoBloco(atual, texto)) {
    return false;
  }

  return true;
}

function fecharBloco(grupos, atual) {
  if (atual.length > 0) {
    grupos.push(atual);
  }
}

export function segmentarBlocosBrutos(linhas = []) {
  const lista = Array.isArray(linhas) ? linhas : [];
  const grupos = [];
  let atual = [];

  for (const linha of lista) {
    const texto = String(linha?.texto ?? "");

    if (deveAbrirNovoBlocoBruto(atual, texto)) {
      fecharBloco(grupos, atual);
      atual = [linha];
      continue;
    }

    atual.push(linha);
  }

  fecharBloco(grupos, atual);

  if (grupos.length === 0) {
    grupos.push(lista.length > 0 ? lista : [{ i: 1, texto: "" }]);
  }

  return grupos.map((grupo, indice) => {
    const linhasBloco = grupo.map((linha) => ({
      i: Number(linha?.i) || 0,
      texto: String(linha?.texto ?? ""),
    }));

    return {
      ordem_bloco: indice + 1,
      linhas_originais: linhasBloco,
      texto_original: linhasBloco.map((linha) => linha.texto).join("\n"),
    };
  });
}

export function agruparBlocosPorLinhas(linhas = []) {
  return segmentarBlocosBrutos(linhas);
}

export function montarBlocosBrutosDaPagina(textoPagina = "") {
  return segmentarBlocosBrutos(montarLinhasOriginais(textoPagina));
}

export function estimarConfiancaExtracao(texto = "") {
  const tamanho = String(texto || "").trim().length;
  if (tamanho >= 40) {
    return 1;
  }
  if (tamanho >= 8) {
    return 0.6;
  }
  return 0.2;
}
