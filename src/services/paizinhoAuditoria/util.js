// =============================================================
// PAIIA — Central do Paizinho Inteligente: AUDITORIA COMERCIAL (piloto
// LOJA ONLINE, 10/11/2026). Utilidades puras (sem rede, sem React).
// Roda igual no navegador, no Node (testes) e no servidor (Deno).
// =============================================================

export const num = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const t = String(v ?? "").trim().replace(/\s/g, "");
  if (!t) return 0;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : 0;
};
export const txt = (v) => String(v ?? "").trim();
export const centavos = (v) => Math.round(num(v) * 100) / 100;
export const reais = (v) => `R$ ${centavos(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const pct = (v, casas = 1) => `${(Math.round(num(v) * 10 ** casas) / 10 ** casas).toLocaleString("pt-BR")}%`;

/** minúsculas, sem acento, só letras/números/espaço. */
export function normalizar(v) {
  return txt(v).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
/** Código sem separadores (0 258 003 300 → 0258003300). */
export const codigoLimpo = (v) => txt(v).toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Atributo de um item do ML pelo id (BRAND, PART_NUMBER, SELLER_SKU...). */
export function atributo(item, id) {
  const a = (item?.attributes || []).find((x) => x?.id === id);
  if (!a) return "";
  return txt(a.value_name ?? a.values?.[0]?.name ?? "");
}
/** Número de um atributo com unidade (value_struct), convertido para a unidade pedida. */
export function atributoNumero(item, id, unidade) {
  const a = (item?.attributes || []).find((x) => x?.id === id);
  const s = a?.value_struct || a?.values?.[0]?.struct;
  let n = num(s?.number);
  let u = txt(s?.unit).toLowerCase();
  if (!n) {
    const m = txt(a?.value_name).match(/^([\d.,]+)\s*([a-zA-Z]+)?/);
    if (m) { n = num(m[1]); u = txt(m[2]).toLowerCase(); }
  }
  if (!n) return 0;
  const fator = {
    g: { g: 1, kg: 1000, mg: 0.001 },
    cm: { cm: 1, mm: 0.1, m: 100 },
  }[unidade]?.[u || unidade];
  return fator ? Math.round(n * fator * 100) / 100 : 0;
}

/** SKU do anúncio (seller_custom_field ou atributo SELLER_SKU). */
export function skuDoItem(item) {
  return txt(item?.seller_custom_field) || atributo(item, "SELLER_SKU");
}

/** Divide uma lista em pedaços de tamanho n. */
export function pedacos(lista, n) {
  const out = [];
  for (let i = 0; i < lista.length; i += n) out.push(lista.slice(i, i + n));
  return out;
}

/** Executa tarefas com no máximo `limite` ao mesmo tempo (mantém a ordem). */
export async function comLimite(itens, limite, fn) {
  const resultados = new Array(itens.length);
  let proximo = 0;
  async function trabalhador() {
    while (proximo < itens.length) {
      const i = proximo++;
      try { resultados[i] = await fn(itens[i], i); } catch (e) { resultados[i] = { erro: txt(e?.message || e) }; }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limite, itens.length)) }, trabalhador));
  return resultados;
}

/** Data ISO (UTC) n dias antes de `agora`. */
export function diasAtras(agora, n) {
  return new Date(new Date(agora).getTime() - n * 86400000).toISOString();
}

/** Data de referência do relatório no horário de Brasília (AAAA-MM-DD). */
export function dataBrasilia(agora) {
  const d = new Date(new Date(agora).getTime() - 3 * 3600000);
  return d.toISOString().slice(0, 10);
}
