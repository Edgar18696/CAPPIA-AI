export function normalizarCodigo(valor) {
  return String(valor || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}