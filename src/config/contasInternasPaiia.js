export const ROTULO_CONTA_INTERNA_TESTE = "TESTE / ADMINISTRATIVO";

export function emailsContaInternaTeste() {
  return String(import.meta.env.VITE_PAIIA_TESTE_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function emailEhContaInternaTeste(email = "") {
  const alvo = String(email || "")
    .trim()
    .toLowerCase();
  if (!alvo) return false;
  return emailsContaInternaTeste().includes(alvo);
}
