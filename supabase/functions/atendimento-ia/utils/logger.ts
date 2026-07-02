export function log(...dados: unknown[]) {
  console.log("[APPIA AI]", ...dados);
}

export function erro(...dados: unknown[]) {
  console.error("[APPIA AI]", ...dados);
}