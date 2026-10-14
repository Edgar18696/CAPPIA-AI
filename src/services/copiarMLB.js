// =============================================================
// PAIIA — "📋 Copiar MLB para o Bling" (13/10/2026)
// Só COPIA o código do anúncio para a área de transferência, para a
// Rosana colar no Bling. Não grava nada, não importa nada no Bling,
// não mexe em SKU, estoque, preço, anúncio ou vínculo.
// =============================================================

/**
 * Código MLB limpo, no formato do Bling: "MLB5385650401".
 * Aceita "MLB5385650401", "mlb-5385650401", "MLB: 5385650401",
 * " MLB 5385650401 ", "MLBMLB5385650401". Recusa (devolve "") o que não
 * for um MLB de anúncio — inclusive "MLBU..." (produto do vendedor),
 * número solto, vazio ou texto qualquer.
 */
export function normalizarMLB(valor) {
  const t = String(valor ?? "").toUpperCase().replace(/[\s:._\-/]/g, "");
  if (!t.startsWith("MLB")) return "";
  const digitos = t.replace(/^(MLB)+/, "");
  return /^\d{6,15}$/.test(digitos) ? `MLB${digitos}` : "";
}

/**
 * Copia o texto. Usa a área de transferência do navegador e, se ela não
 * estiver disponível (navegadores antigos/celular), o método clássico.
 * Devolve true se copiou.
 */
export async function copiarTexto(texto, ambiente = globalThis) {
  const valor = String(texto ?? "");
  if (!valor) return false;
  try {
    if (ambiente?.navigator?.clipboard?.writeText && ambiente?.isSecureContext !== false) {
      await ambiente.navigator.clipboard.writeText(valor);
      return true;
    }
  } catch {
    /* tenta o método clássico abaixo */
  }
  try {
    const doc = ambiente?.document;
    if (!doc?.createElement || !doc?.body) return false;
    const campo = doc.createElement("textarea");
    campo.value = valor;
    campo.setAttribute("readonly", "");
    campo.style.position = "fixed";
    campo.style.top = "0";
    campo.style.left = "0";
    campo.style.opacity = "0";
    campo.style.fontSize = "16px"; // evita zoom no iPhone
    doc.body.appendChild(campo);
    campo.focus?.();
    campo.select?.();
    campo.setSelectionRange?.(0, valor.length);
    const ok = typeof doc.execCommand === "function" ? doc.execCommand("copy") : false;
    doc.body.removeChild(campo);
    return Boolean(ok);
  } catch {
    return false;
  }
}

export const TEXTO_BOTAO_COPIAR_MLB = "📋 Copiar MLB para o Bling";
export const TEXTO_MLB_COPIADO = "✓ MLB copiado! Agora cole no Bling";
