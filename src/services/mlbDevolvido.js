// =============================================================
// PAIIA — (15/11) O MLB devolvido pela publicação é MESMO deste anúncio?
//   Testes: scripts/testes/mlbDevolvido.test.mjs
//
// Caso real (15/11, SKU 7527362, ficha 4ab28be5): o servidor respondeu "publicado"
// com o MLB5560614343 — anúncio de OUTRO produto (SKU 8200642689, criado no dia
// anterior) — e o PAIIA gravou esse MLB na ficha errada.
// Regra: antes de gravar qualquer MLB numa ficha, ele é RELIDO no Mercado Livre e
// precisa ter o SKU desta ficha e não pode pertencer a outra ficha. Sem confirmar:
// nada é gravado como publicado (pendência visível, nunca escondida).
// Funções puras (sem rede): as consultas entram por parâmetro.
// =============================================================

const txt = (v) => String(v ?? "").trim();
const normSku = (v) => txt(v).toUpperCase().replace(/[^A-Z0-9]/g, "");

/** SKUs gravados no anúncio do ML (atributo SELLER_SKU, seller_custom_field e variações). */
export function skusDoItem(item) {
  const it = item || {};
  const doAttr = (lista) => (Array.isArray(lista) ? lista : []).filter((a) => a?.id === "SELLER_SKU").map((a) => a.value_name || (a.values || [])[0]?.name);
  const daVariacao = (Array.isArray(it.variations) ? it.variations : []).flatMap((v) => [...doAttr(v?.attributes), v?.seller_custom_field]);
  return [...new Set([...doAttr(it.attributes), it.seller_custom_field, ...daVariacao].map(txt).filter(Boolean))];
}

/**
 * Decide se o MLB devolvido pode ser gravado nesta ficha.
 *  mlb: o que o servidor devolveu · sku: SKU desta ficha (o enviado)
 *  item: anúncio relido no ML (ou null se não deu para ler)
 *  outraFicha: ID de OUTRA ficha que já tem este MLB ("" = nenhuma)
 * Devolve { ok, motivo, texto }.
 */
export function avaliarMLBDevolvido({ mlb, sku, item, outraFicha = "" }) {
  const m = txt(mlb).toUpperCase();
  if (!/^MLB\d{6,}$/.test(m)) return { ok: false, motivo: "mlb_invalido", texto: "O Mercado Livre não devolveu um MLB válido. Nada foi gravado como publicado." };
  if (txt(outraFicha)) {
    return { ok: false, motivo: "outra_ficha", texto: `O servidor devolveu o ${m}, que já pertence a OUTRA ficha do PAIIA (${txt(outraFicha).slice(0, 8)}). Nada foi gravado nesta ficha; confira na conta do Mercado Livre antes de tentar de novo.` };
  }
  if (!item || txt(item.id).toUpperCase() !== m) {
    return { ok: false, motivo: "nao_confirmado", texto: `O servidor devolveu o ${m}, mas não consegui reler esse anúncio para confirmar que é deste produto. Nada foi gravado como publicado; confira na conta do Mercado Livre antes de tentar de novo.` };
  }
  const skus = skusDoItem(item);
  const alvo = normSku(sku);
  if (!alvo) return { ok: false, motivo: "sem_sku", texto: `Esta ficha está sem SKU: não dá para confirmar que o ${m} é deste anúncio. Nada foi gravado como publicado.` };
  if (!skus.some((s) => normSku(s) === alvo)) {
    return { ok: false, motivo: "outro_produto", texto: `O servidor devolveu o ${m}, mas esse anúncio é de OUTRO produto (SKU ${skus.join(" / ") || "sem SKU"}; esta ficha é ${txt(sku)}${item.title ? ` — "${txt(item.title).slice(0, 60)}"` : ""}). Nada foi gravado nesta ficha e nada foi alterado no anúncio. Confira na conta do Mercado Livre antes de tentar de novo.` };
  }
  return { ok: true, motivo: "ok", texto: "" };
}

/**
 * Relê o MLB (até 3 vezes) e procura outra ficha com ele; devolve a avaliação.
 * deps: { lerItem(mlb) → item|null, fichaComMLB(mlb) → id de outra ficha|"" , esperar(ms) }
 */
export async function conferirMLBDevolvido({ mlb, sku, anuncioId = "" }, deps) {
  const m = txt(mlb).toUpperCase();
  let item = null;
  for (let i = 0; i < 3 && !item; i += 1) {
    if (i) await (deps.esperar || ((ms) => new Promise((ok) => setTimeout(ok, ms))))(2000);
    try { item = await deps.lerItem(m); } catch { item = null; }
  }
  const outra = await Promise.resolve().then(() => deps.fichaComMLB(m, anuncioId)).then(txt, () => "");
  return { ...avaliarMLBDevolvido({ mlb: m, sku, item, outraFicha: outra }), item };
}
