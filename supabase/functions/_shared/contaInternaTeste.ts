export function emailEhContaInternaTeste(email = "") {
  const alvo = String(email || "")
    .trim()
    .toLowerCase();
  if (!alvo) return false;

  const lista = String(Deno.env.get("PAIIA_TESTE_EMAILS") || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return lista.includes(alvo);
}
