export function normalizarCodigo(
  valor = ""
) {
  return String(valor || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

export default normalizarCodigo;