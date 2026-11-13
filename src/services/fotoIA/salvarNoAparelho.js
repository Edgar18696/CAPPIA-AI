// =============================================================
// PAIIA — (13/11) Foto IA: "Salvar no celular".
// O navegador NÃO deixa um site gravar na galeria do aparelho sozinho: precisa
// de um toque. Com o toque, abre o menu de compartilhar do celular (Android e
// iPhone mostram "Salvar imagem"/"Salvar em Fotos"). Sem esse menu (ex.:
// computador), baixa os arquivos. Nada é apagado nem alterado na Galeria PAIIA.
// Dependências entram por parâmetro (testável no Node).
// =============================================================

const nomeArquivo = (p, i) => `paiia-${String(p?.linhaId || p?.id || i + 1).replace(/[^\w-]+/g, "")}-1200x1200.png`;

/**
 * prontas: [{ id, linhaId, urlTratada }]
 * deps: { baixar(url) → Blob, navegador (navigator), criarArquivo(blob, nome), baixarArquivo(blob, nome) }
 * → { modo: "compartilhar" | "download" | "cancelado", ids }
 */
export async function salvarNoAparelho(prontas, { baixar, navegador = globalThis.navigator, criarArquivo, baixarArquivo }) {
  const lista = (prontas || []).filter((p) => p?.urlTratada);
  if (!lista.length) return { modo: "nada", ids: [] };
  const arquivos = [];
  for (const [i, p] of lista.entries()) arquivos.push({ p, nome: nomeArquivo(p, i), blob: await baixar(p.urlTratada) });
  const files = arquivos.map((a) => criarArquivo(a.blob, a.nome));
  const ids = lista.map((p) => p.id);
  if (navegador?.share && navegador?.canShare?.({ files })) {
    try {
      await navegador.share({ files, title: "Fotos PAIIA" });
      return { modo: "compartilhar", ids };
    } catch (e) {
      if (e?.name === "AbortError") return { modo: "cancelado", ids: [] };
      // outro erro do menu: segue para o download
    }
  }
  for (const a of arquivos) baixarArquivo(a.blob, a.nome);
  return { modo: "download", ids };
}

/** Versões do navegador para criarArquivo / baixarArquivo. */
export const criarArquivoNavegador = (blob, nome) => new File([blob], nome, { type: blob?.type || "image/png" });
export function baixarArquivoNavegador(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
