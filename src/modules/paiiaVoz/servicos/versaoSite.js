// =============================================================
// PAIIA Voz — (05/11/2026) A página está na versão que está no ar?
// Compara o arquivo principal carregado nesta aba (assets/index-*.js) com o
// que o site entrega agora. Página antiga não autoriza operações.
// =============================================================
const RE_INDEX = /assets\/(index-[A-Za-z0-9_-]+\.js)/;

export function versaoCarregada(doc = globalThis.document) {
  try {
    return [...(doc?.scripts || [])].map((s) => (s.src || "").match(RE_INDEX)?.[1]).find(Boolean) || "";
  } catch {
    return "";
  }
}

/** { estado: "ok" | "desatualizada" | "indisponivel" | "sem-versao", atual, noAr } */
export function compararVersoes(atual, html) {
  const noAr = String(html || "").match(RE_INDEX)?.[1] || "";
  if (!atual) return { estado: "sem-versao", atual, noAr }; // ambiente de desenvolvimento/teste sem arquivo com nome de versão
  if (!noAr) return { estado: "indisponivel", atual, noAr };
  return { estado: noAr === atual ? "ok" : "desatualizada", atual, noAr };
}

export async function conferirVersaoSite({ buscar = globalThis.fetch, doc = globalThis.document } = {}) {
  const atual = versaoCarregada(doc);
  if (!atual) return compararVersoes("", "");
  try {
    const r = await buscar(`/?versao=${Date.now()}`, { cache: "no-store" });
    return compararVersoes(atual, r?.ok ? await r.text() : "");
  } catch {
    return compararVersoes(atual, "");
  }
}
