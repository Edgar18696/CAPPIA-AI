// (27/11/2026) PAIIA Parceiros — lê no navegador o arquivo de catálogo enviado
// (planilha CSV/XLS/XLSX ou PDF com texto) e devolve os itens para conferência.
// Bibliotecas carregadas só quando usadas, para não pesar o resto do PAIIA.
import { linhasPlanilhaParaItens, linhasPdfParaItens, lerTextoDelimitado } from "./extracaoCatalogo";

const LIMITE_PAGINAS_PDF = 400;

export async function lerArquivoCatalogo(arquivo, aoProgredir) {
  const nome = String(arquivo?.name || "").toLowerCase();
  if (/\.(csv|txt)$/.test(nome)) return lerCsv(arquivo);
  if (/\.(xls|xlsx)$/.test(nome)) return lerPlanilha(arquivo);
  if (/\.pdf$/.test(nome)) return lerPdf(arquivo, aoProgredir);
  return { itens: [], aviso: "Formato sem leitura automática. Use PDF, CSV, XLS ou XLSX." };
}

async function lerCsv(arquivo) {
  const bytes = await arquivo.arrayBuffer();
  // Excel brasileiro costuma salvar CSV em Windows-1252; tenta UTF-8 primeiro.
  let texto = new TextDecoder("utf-8").decode(bytes);
  if (texto.includes("\uFFFD")) texto = new TextDecoder("windows-1252").decode(bytes);
  return linhasPlanilhaParaItens(lerTextoDelimitado(texto));
}

async function lerPlanilha(arquivo) {
  const XLSX = await import("xlsx");
  const dados = await arquivo.arrayBuffer();
  const livro = XLSX.read(dados, { type: "array", raw: false });
  let melhor = { itens: [], aviso: "Planilha vazia." };
  for (const nomeAba of livro.SheetNames.slice(0, 10)) {
    const linhas = XLSX.utils.sheet_to_json(livro.Sheets[nomeAba], { header: 1, defval: "", raw: false });
    const r = linhasPlanilhaParaItens(linhas);
    if (r.itens.length > melhor.itens.length || (!melhor.itens.length && r.aviso)) melhor = { ...r, aba: nomeAba };
  }
  return melhor;
}

async function lerPdf(arquivo, aoProgredir) {
  const pdfjs = await import("pdfjs-dist");
  const { default: PdfWorker } = await import("pdfjs-dist/build/pdf.worker.min.mjs?worker");
  if (!pdfjs.GlobalWorkerOptions.workerPort) pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
  const total = Math.min(doc.numPages, LIMITE_PAGINAS_PDF);
  const linhas = [];
  for (let n = 1; n <= total; n += 1) {
    const pagina = await doc.getPage(n);
    const conteudo = await pagina.getTextContent();
    // agrupa os pedaços de texto pela altura (mesma linha)
    const porLinha = new Map();
    for (const item of conteudo.items) {
      if (!item.str?.trim()) continue;
      const y = Math.round(item.transform[5]);
      const chave = [...porLinha.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
      if (!porLinha.has(chave)) porLinha.set(chave, []);
      porLinha.get(chave).push({ x: item.transform[4], s: item.str });
    }
    for (const y of [...porLinha.keys()].sort((a, b) => b - a)) {
      linhas.push(porLinha.get(y).sort((a, b) => a.x - b.x).map((p) => p.s).join(" "));
    }
    aoProgredir?.(n / total);
  }
  const r = linhasPdfParaItens(linhas);
  if (!linhas.length) r.aviso = "Este PDF não tem texto (parece digitalizado). Envie também a planilha, se tiver.";
  else if (doc.numPages > LIMITE_PAGINAS_PDF) r.aviso += ` Lidas as primeiras ${LIMITE_PAGINAS_PDF} páginas de ${doc.numPages}.`;
  return { ...r, paginas: doc.numPages };
}
