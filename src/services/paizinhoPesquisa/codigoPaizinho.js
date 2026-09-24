// =============================================================
// PAIZINHO — CÓDIGO DA PEÇA: normalização e comparação EXATA
// -------------------------------------------------------------
// Aceita só variações de ESCRITA do mesmo código (espaço, hífen,
// ponto, barra, maiúscula/minúscula). Nunca troca um código por
// outro: "5181133" NÃO casa com "51811330" nem com "5181133-1".
// =============================================================

/** Forma compacta: só A-Z e 0-9, maiúsculas. */
export function normalizarCodigo(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Formas de escrita legítimas do MESMO código, para ajudar a busca.
 * (Não inventa dígitos nem remove zeros.)
 */
export function variantesEscrita(valor) {
  const original = String(valor ?? "").trim();
  const compacto = normalizarCodigo(original);
  const formas = new Set();
  if (original) formas.add(original.toUpperCase());
  if (compacto) formas.add(compacto);

  // Padrão Bosch de 10 dígitos: 0 580 314 371
  if (/^\d{10}$/.test(compacto)) {
    formas.add(`${compacto.slice(0, 1)} ${compacto.slice(1, 4)} ${compacto.slice(4, 7)} ${compacto.slice(7)}`);
  }
  // Fronteira letra/número: F000TE143D → F 000 TE1 43D não é seguro; só
  // separa blocos letra↔número uma vez cada (ex.: AR22U → AR 22U).
  const blocos = compacto.match(/[A-Z]+|\d+/g) || [];
  if (blocos.length > 1 && blocos.length <= 4) {
    formas.add(blocos.join(" "));
    formas.add(blocos.join("-"));
  }
  return [...formas];
}

const SEP = "[\\s.\\-/]*";

function escapar(c) {
  return c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * true se o texto contém o código EXATO (aceitando só separadores de
 * escrita entre os caracteres) e não faz parte de um código maior.
 */
export function textoContemCodigo(texto, codigo) {
  const alvo = normalizarCodigo(codigo);
  if (!alvo || !texto) return false;
  const base = String(texto)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
  const corpo = alvo.split("").map(escapar).join(SEP);
  // antes: não pode haver letra/número (nem "X-" / "X." colado)
  // depois: idem — "5181133-1" ou "51811330" NÃO são o mesmo código
  const re = new RegExp(
    `(?<![A-Z0-9])(?<![A-Z0-9][.\\-/])${corpo}(?![A-Z0-9])(?![.\\-/][A-Z0-9])`
  );
  return re.test(base);
}

/** true se algum código da lista é exatamente o código (após normalizar). */
export function listaContemCodigo(lista, codigo) {
  const alvo = normalizarCodigo(codigo);
  if (!alvo) return false;
  return (lista || []).some((c) => normalizarCodigo(c) === alvo);
}
