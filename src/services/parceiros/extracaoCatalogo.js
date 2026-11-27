// (27/11/2026) PAIIA Parceiros — EXTRAÇÃO AUTOMÁTICA dos catálogos enviados (parte pura,
// sem navegador). Lê planilhas (cabeçalhos reconhecidos por sinônimos) e linhas de texto
// de PDF. Tudo o que é extraído entra como PENDENTE e só aparece depois da aprovação
// técnica do administrador: nada é inventado nem aprovado automaticamente.

const LIMITE_ITENS = 5000;

const SINONIMOS = {
  codigo: ["codigo", "cod", "codigo do produto", "codigo produto", "referencia", "ref", "part number", "partnumber", "pn", "sku", "numero", "n peca", "numero da peca", "codigo fabricante"],
  descricao: ["descricao", "descricao do produto", "produto", "nome", "peca", "item", "denominacao"],
  aplicacao: ["aplicacao", "aplicacoes", "veiculo", "veiculos", "modelo", "modelos", "montadora", "aplicacao veiculo"],
  equivalencias: ["equivalencia", "equivalencias", "equivalente", "equivalentes", "oem", "codigo oem", "codigos oem", "original", "codigo original", "conversao", "cross", "referencia cruzada", "similar", "similares", "concorrentes"],
  marca: ["marca", "fabricante"],
  segmento: ["segmento", "linha", "categoria", "grupo", "familia"],
};

export function normalizarCabecalho(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Descobre a coluna de cada campo pelo nome do cabeçalho. */
export function detectarColunas(cabecalhos = []) {
  const normal = cabecalhos.map(normalizarCabecalho);
  const mapa = {};
  for (const [campo, nomes] of Object.entries(SINONIMOS)) {
    // primeiro igual, depois "começa com" (ex.: "codigo oem" não pode virar "codigo")
    let i = normal.findIndex((c, idx) => nomes.includes(c) && !Object.values(mapa).includes(idx));
    if (i < 0) i = normal.findIndex((c, idx) => c && nomes.some((n) => c.startsWith(`${n} `)) && !Object.values(mapa).includes(idx));
    if (i >= 0) mapa[campo] = i;
  }
  // "codigo oem" é equivalência, não o código do parceiro
  if (mapa.codigo !== undefined && /\boem\b|original/.test(normal[mapa.codigo]) && mapa.equivalencias === undefined) {
    mapa.equivalencias = mapa.codigo;
    delete mapa.codigo;
  }
  return mapa;
}

export function separarEquivalencias(texto) {
  return [...new Set(
    String(texto ?? "")
      .split(/[,;/|\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 3 && /\d/.test(s))
  )].slice(0, 80);
}

function texto(valor) {
  return String(valor ?? "").replace(/\s+/g, " ").trim();
}

/** Linhas de planilha (lista de listas) para itens. Procura a linha de cabeçalho nas 15 primeiras. */
export function linhasPlanilhaParaItens(linhas = []) {
  let inicio = -1;
  let colunas = {};
  for (let i = 0; i < Math.min(15, linhas.length); i += 1) {
    const mapa = detectarColunas(linhas[i] || []);
    if (mapa.codigo !== undefined) {
      inicio = i;
      colunas = mapa;
      break;
    }
  }
  if (inicio < 0) {
    return { itens: [], colunas: {}, aviso: "Não encontramos a coluna de código. Use um cabeçalho como \"Código\", \"Referência\" ou \"SKU\"." };
  }
  const vistos = new Set();
  const itens = [];
  for (const linha of linhas.slice(inicio + 1)) {
    const codigo = texto(linha?.[colunas.codigo]);
    if (!codigo || codigo.length < 2) continue;
    const chave = codigo.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!chave || vistos.has(chave)) continue;
    vistos.add(chave);
    itens.push({
      codigo,
      descricao: colunas.descricao !== undefined ? texto(linha[colunas.descricao]) : "",
      aplicacao: colunas.aplicacao !== undefined ? texto(linha[colunas.aplicacao]) : "",
      equivalencias: colunas.equivalencias !== undefined ? separarEquivalencias(linha[colunas.equivalencias]) : [],
      marca: colunas.marca !== undefined ? texto(linha[colunas.marca]) : "",
      segmento: colunas.segmento !== undefined ? texto(linha[colunas.segmento]) : "",
      origem: "extracao_planilha",
    });
    if (itens.length >= LIMITE_ITENS) break;
  }
  return { itens, colunas, aviso: itens.length >= LIMITE_ITENS ? `Limite de ${LIMITE_ITENS} itens por envio.` : "" };
}

// Código de peça: 4 a 25 caracteres, letras/números com - . /, com ao menos um dígito.
const CODIGO_PDF = /^(?=[A-Z0-9.\-/]*\d)[A-Z0-9][A-Z0-9.\-/]{3,24}$/i;
const NAO_CODIGO = /^(\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?|\d{4}|\d{1,3}([.,]\d+)?(mm|cm|v|w|a|kg|g)?|p[aá]g\.?\d*)$/i;

/**
 * Linhas de texto de PDF para itens: linha que começa com um código e segue com descrição.
 * Equivalências e aplicações de PDF não são deduzidas (ficam para conferência).
 */
export function linhasPdfParaItens(linhas = []) {
  const vistos = new Set();
  const itens = [];
  for (const bruta of linhas) {
    const linha = texto(bruta);
    if (linha.length < 6) continue;
    const [primeiro, ...resto] = linha.split(" ");
    const codigo = primeiro.replace(/[;:,]$/, "");
    if (!CODIGO_PDF.test(codigo) || NAO_CODIGO.test(codigo)) continue;
    const descricao = resto.join(" ").trim();
    if (!/[A-Za-zÀ-ú]{3}/.test(descricao)) continue;
    const chave = codigo.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    itens.push({ codigo, descricao: descricao.slice(0, 300), aplicacao: "", equivalencias: [], marca: "", segmento: "", origem: "extracao_pdf" });
    if (itens.length >= LIMITE_ITENS) break;
  }
  return { itens, aviso: "Leitura automática de PDF: confira os itens antes de aprovar." };
}

/**
 * CSV/TXT exportado do Excel brasileiro: separador ; (ou , ou tab), aspas opcionais.
 * Descobre o separador pela linha com mais colunas entre as primeiras.
 */
export function lerTextoDelimitado(texto = "") {
  const conteudo = String(texto).replace(/^\uFEFF/, "");
  const amostra = conteudo.split(/\r?\n/).slice(0, 20);
  const separador = [";", "\t", ","]
    .map((s) => ({ s, n: Math.max(0, ...amostra.map((l) => l.split(s).length - 1)) }))
    .sort((a, b) => b.n - a.n)[0].s;
  const linhas = [];
  let linha = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < conteudo.length; i += 1) {
    const ch = conteudo[i];
    if (aspas) {
      if (ch === '"' && conteudo[i + 1] === '"') { campo += '"'; i += 1; }
      else if (ch === '"') aspas = false;
      else campo += ch;
    } else if (ch === '"' && campo === "") aspas = true;
    else if (ch === separador) { linha.push(campo); campo = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && conteudo[i + 1] === "\n") i += 1;
      linha.push(campo); linhas.push(linha); linha = []; campo = "";
    } else campo += ch;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

export function resumoExtracao(itens = []) {
  return {
    total: itens.length,
    comDescricao: itens.filter((i) => i.descricao).length,
    comAplicacao: itens.filter((i) => i.aplicacao).length,
    comEquivalencias: itens.filter((i) => i.equivalencias?.length).length,
  };
}
