// =============================================================
// PAIIA Voz — CÓDIGO NA FOTO (experimental, gratuito, no próprio aparelho).
//   Testes: scripts/testes/paiiaVoz.test.mjs (só a parte pura)
//
// Usa o tesseract.js que já está nas dependências do PAIIA. A leitura é
// feita no navegador; o tesseract baixa os arquivos do idioma na primeira
// vez (sem custo, sem chave). O resultado é SÓ sugestão: o usuário escolhe
// qual código usar e confere letra por letra.
// =============================================================

/** Do texto lido na etiqueta, os candidatos a código (sem inventar). */
export function candidatosDeCodigo(texto) {
  const vistos = new Set();
  const lista = [];
  const tokens = String(texto ?? "")
    .toUpperCase()
    .replace(/[|]/g, "I")
    .split(/[\s,;:()[\]{}"']+/);
  for (const bruto of tokens) {
    const t = bruto.replace(/^[^A-Z0-9]+|[^A-Z0-9]+$/g, "");
    if (t.length < 5 || t.length > 20) continue;
    if (!/\d/.test(t)) continue;
    const digitos = (t.match(/\d/g) || []).length;
    if (digitos < 3) continue;
    if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(t)) continue; // data
    if (/^(19|20)\d{2}$/.test(t)) continue; // ano solto
    const chave = t.replace(/[^A-Z0-9]/g, "");
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    lista.push(t);
  }
  return lista.slice(0, 8);
}

/** Lê o texto da imagem com tesseract.js (carregado só quando usado). */
export async function lerTextoDaFoto(arquivo, { onProgresso } = {}) {
  const modulo = await import("tesseract.js");
  const Tesseract = modulo.default || modulo;
  const r = await Tesseract.recognize(arquivo, "eng", {
    logger: (m) => {
      if (m?.status === "recognizing text" && typeof m.progress === "number") onProgresso?.(Math.round(m.progress * 100));
    },
  });
  return r?.data?.text || "";
}
