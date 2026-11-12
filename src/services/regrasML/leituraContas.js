// =============================================================
// PAIIA — Regras do ML — Anúncios: LEITURA das 3 contas (SOMENTE GET).
// Usa a consulta de leitura que o PAIIA já tem (mercadolivre-publicacao,
// ml_consulta GET). Cada anúncio é conferido pelo vendedor (seller_id) e
// guardado resumido NESTE navegador (localStorage). Nada é alterado no ML.
// Autorizado pelo Edgar em 12/11/2026: "somente consultas de leitura".
// =============================================================
import { supabase } from "../../supabase";
import { cruzarContas, separarDuplicidades } from "./cruzamento.js";

export const CONTAS_CRUZAMENTO = Object.freeze([
  { id: "1729335019", nome: "LOJA ONLINE" },
  { id: "2412238242", nome: "REVELAÇÃO" },
  { id: "824312524", nome: "CIEBR" },
]);
export const CHAVE_LEITURA = "paiiaRegrasMLLeitura";
const CHAVE_RANQUEAMENTO = "paiiaPaizinhoRelatorioTeste";
const CAMPOS = "id,seller_id,title,price,status,sub_status,tags,listing_type_id,catalog_product_id,catalog_listing,sold_quantity,available_quantity,shipping,seller_custom_field,attributes,variations,pictures,date_created,permalink,health";
const ATRIBUTOS = ["BRAND", "GTIN", "PART_NUMBER", "OEM", "SELLER_SKU"];

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function lerML(conta, caminho) {
  for (let t = 0; t < 4; t++) {
    const { data, error } = await supabase.functions.invoke("mercadolivre-publicacao", { body: { acao: "ml_consulta", conta_ml: conta, metodo: "GET", caminho } });
    const r = error ? { ok: false, erro: error.message, status: error.context?.status } : data;
    if (r?.ok) return r;
    const passageiro = [429, 500, 502, 503, 504].includes(Number(r?.status)) || /too many|rate|Failed to fetch/i.test(String(r?.erro));
    if (!passageiro) return r || { ok: false, erro: "resposta vazia" };
    await espera(800 * 2 ** t);
  }
  return { ok: false, erro: "o Mercado Livre limitou as consultas" };
}

/** Só o que o cruzamento usa (cabe no navegador). */
export function resumirAnuncio(d) {
  return {
    id: d.id, seller_id: d.seller_id, title: d.title, price: d.price, status: d.status, sub_status: d.sub_status,
    tags: (d.tags || []).filter((t) => /dupl|moder|poor|infr|block/i.test(t)),
    listing_type_id: d.listing_type_id, catalog_product_id: d.catalog_product_id, catalog_listing: d.catalog_listing,
    sold_quantity: d.sold_quantity, available_quantity: d.available_quantity,
    shipping: { logistic_type: d.shipping?.logistic_type, mode: d.shipping?.mode, free_shipping: d.shipping?.free_shipping },
    seller_custom_field: d.seller_custom_field,
    attributes: (d.attributes || []).filter((a) => ATRIBUTOS.includes(a.id)).map((a) => ({ id: a.id, value_name: a.value_name })),
    variations: (d.variations || []).map((v) => ({ seller_custom_field: v.seller_custom_field, attributes: (v.attributes || []).filter((a) => a.id === "SELLER_SKU").map((a) => ({ id: a.id, value_name: a.value_name })) })),
    pictures: (d.pictures || []).map((p) => ({ id: p.id })),
    date_created: d.date_created, permalink: d.permalink, health: d.health,
  };
}

/** Lê os anúncios ATIVOS das 3 contas (só GET) e guarda neste navegador. */
export async function lerTresContas({ aoProgredir = () => {} } = {}) {
  const itens = {};
  const falhas = [];
  for (const c of CONTAS_CRUZAMENTO) {
    aoProgredir(`Lendo a lista de anúncios da ${c.nome}`);
    const ids = [];
    let scroll = "";
    for (let volta = 0; volta < 60; volta++) {
      const r = await lerML(c.id, `/users/${c.id}/items/search?status=active&search_type=scan&limit=100${scroll ? `&scroll_id=${encodeURIComponent(scroll)}` : ""}`);
      if (!r.ok) { falhas.push({ conta: c.nome, etapa: "lista", erro: r.erro }); break; }
      const lote = r.dados?.results || [];
      if (!lote.length) break;
      for (const id of lote) if (!ids.includes(id)) ids.push(id);
      scroll = r.dados?.scroll_id || "";
      if (!scroll) break;
    }
    itens[c.id] = [];
    const fila = [...ids];
    let feitos = 0;
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (fila.length) {
        const id = fila.shift();
        const r = await lerML(c.id, `/items/${id}?attributes=${CAMPOS}`);
        if (r.ok && String(r.dados?.seller_id) === c.id) itens[c.id].push(resumirAnuncio(r.dados));
        else falhas.push({ conta: c.nome, id, erro: r.ok ? "anúncio de outro vendedor: descartado" : r.erro });
        if (++feitos % 50 === 0) aoProgredir(`${c.nome}: ${feitos} de ${ids.length} anúncios`);
      }
    }));
  }
  const leitura = { lido_em: new Date().toISOString(), contas: CONTAS_CRUZAMENTO, itens, falhas };
  try { localStorage.setItem(CHAVE_LEITURA, JSON.stringify(leitura)); } catch { /* sem espaço: fica só na tela */ }
  // Aplicações (compatibilidades) só dos anúncios que aparecem repetidos.
  const dono = {};
  for (const [c, l] of Object.entries(itens)) for (const it of l) dono[it.id] = c;
  const ids = [...new Set(cruzarContas({ contas: CONTAS_CRUZAMENTO, anuncios: itens }).grupos.flatMap((g) => g.anuncios.map((a) => a.id)))];
  const compat = {};
  const fila = [...ids];
  let feitos = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (fila.length) {
      const id = fila.shift();
      const r = await lerML(dono[id], `/items/${id}/compatibilities`);
      if (r.ok) compat[id] = (r.dados?.products || []).map((p) => p.catalog_product_id).filter(Boolean);
      else if (Number(r.status) === 404) compat[id] = [];
      else falhas.push({ id, etapa: "aplicações", erro: r.erro });
      if (++feitos % 50 === 0) aoProgredir(`Aplicações: ${feitos} de ${ids.length} anúncios repetidos`);
    }
  }));
  try { localStorage.setItem(CHAVE_COMPAT, JSON.stringify({ lido_em: new Date().toISOString(), compat })); } catch { /* sem espaço */ }
  return leitura;
}

export const CHAVE_COMPAT = "paiiaRegrasMLCompat";
function lerCompatGuardada() {
  try { return JSON.parse(localStorage.getItem(CHAVE_COMPAT) || "null")?.compat || {}; } catch { return {}; }
}

export function lerLeituraGuardada() {
  try { return JSON.parse(localStorage.getItem(CHAVE_LEITURA) || "null"); } catch { return null; }
}

/** Visitas de 30 dias da LOJA ONLINE, do último Ranqueamento (as outras contas ainda não são lidas). */
function visitasDoRanqueamento() {
  try {
    const rel = JSON.parse(localStorage.getItem(CHAVE_RANQUEAMENTO) || "null");
    const v = {};
    for (const a of rel?.anuncios || []) if (a.visitas30 !== null && a.visitas30 !== undefined) v[a.item_id] = a.visitas30;
    return v;
  } catch { return {}; }
}

/** Cruzamento a partir da leitura guardada, separado em entre contas x mesma conta. */
export function montarCruzamento(leitura = lerLeituraGuardada()) {
  if (!leitura?.itens) return null;
  const base = { contas: leitura.contas, anuncios: leitura.itens, visitas: visitasDoRanqueamento() };
  const compat = lerCompatGuardada();
  return {
    lido_em: leitura.lido_em,
    falhas: leitura.falhas || [],
    aplicacoes_lidas: Object.keys(compat).length,
    ...cruzarContas(base),
    duplicidades: separarDuplicidades({ ...base, compat }),
  };
}
