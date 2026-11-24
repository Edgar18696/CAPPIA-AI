// =============================================================
// PAIIA — REGRA ÚNICA DE DUPLICIDADE POR TIPO DE ANÚNCIO (24/11/2026).
//
// A MESMA regra vale na tela principal de publicação, na revisão final e no
// servidor (cópia idêntica em supabase/functions/_shared/regraDuplicidadeTipo.js;
// um teste confere que as duas são iguais). Mesmo SKU na MESMA conta:
//   - mesmo tipo (Clássico×Clássico, Premium×Premium) → BLOQUEIA;
//   - tipo diferente (Clássico×Premium)                → CONFIRMAR (só com a sua
//     confirmação manual destes MLBs e deste tipo);
//   - tipo desconhecido (do existente ou do novo)      → BLOQUEIA;
//   - MLB registrado sem confirmação no Mercado Livre  → BLOQUEIA.
// Nunca libera sozinho: "confirmar" só passa com confirmacaoValida().
// Pura: sem imports, sem rede (roda no navegador, no Node e no Deno).
// =============================================================

export const TIPO_ML = Object.freeze({ classico: "gold_special", premium: "gold_pro" });
export const NOME_TIPO_ML = Object.freeze({ gold_special: "Clássico", gold_pro: "Premium", free: "Grátis" });

const txt = (v) => String(v ?? "").trim();

/** "classico" | "premium" | "gold_special" | "gold_pro" → id do ML; qualquer outro → "" (desconhecido). */
export function tipoMLDe(v) {
  const t = txt(v).toLowerCase();
  if (t === "classico" || t === "clássico" || t === "gold_special") return TIPO_ML.classico;
  if (t === "premium" || t === "gold_pro") return TIPO_ML.premium;
  return "";
}

/**
 * existentes: [{ mlb, tipo }] — anúncios deste SKU ATIVOS/PAUSADOS nesta conta (tipo = listing_type_id).
 * incertos:   [{ mlb }]       — MLBs registrados que o Mercado Livre não confirmou.
 * tipoNovo:   tipo do anúncio que vai ser publicado ("classico"/"premium" ou id do ML).
 * → { estado: "livre"|"confirmar"|"bloqueia", existentes, ids, tipoNovo, texto }
 */
export function avaliarDuplicidadeTipo({ existentes = [], incertos = [], tipoNovo = "" } = {}) {
  const lista = (Array.isArray(existentes) ? existentes : [])
    .map((e) => ({ mlb: txt(e?.mlb).toUpperCase(), tipo: txt(e?.tipo) }))
    .filter((e) => e.mlb);
  const vistos = new Set();
  const unicos = lista.filter((e) => (vistos.has(e.mlb) ? false : vistos.add(e.mlb)));
  const duvidas = (Array.isArray(incertos) ? incertos : []).map((c) => txt(c?.mlb).toUpperCase() || "sem MLB");
  const novo = tipoMLDe(tipoNovo);
  const ids = unicos.map((e) => e.mlb).sort().join(",");
  if (!unicos.length && !duvidas.length) return { estado: "livre", existentes: [], ids: "", tipoNovo: novo, texto: "" };
  if (duvidas.length) {
    return { estado: "bloqueia", existentes: unicos, ids, tipoNovo: novo, texto: `MLB registrado nesta conta sem confirmação no Mercado Livre (${duvidas.join(", ")}). Publicação bloqueada até confirmar.` };
  }
  const descr = unicos.map((e) => `${e.mlb} (${NOME_TIPO_ML[e.tipo] || "tipo não informado"})`).join(", ");
  if (!novo) {
    return { estado: "bloqueia", existentes: unicos, ids, tipoNovo: "", texto: `Já existe anúncio deste SKU nesta conta: ${descr}. O tipo do novo anúncio (Clássico/Premium) não está definido: publicação bloqueada por segurança.` };
  }
  const nomeNovo = NOME_TIPO_ML[novo];
  if (unicos.some((e) => !NOME_TIPO_ML[e.tipo] || e.tipo === "free")) {
    return { estado: "bloqueia", existentes: unicos, ids, tipoNovo: novo, texto: `Já existe anúncio deste SKU nesta conta: ${descr}. Tipo do anúncio existente desconhecido: publicação bloqueada por segurança.` };
  }
  if (unicos.some((e) => e.tipo === novo)) {
    return { estado: "bloqueia", existentes: unicos, ids, tipoNovo: novo, texto: `Já existe anúncio deste SKU nesta conta: ${descr}. O Mercado Livre não permite outro anúncio ${nomeNovo} igual na mesma conta. Para outro anúncio aqui, escolha o outro tipo (Clássico/Premium) ou publique em outra conta.` };
  }
  return { estado: "confirmar", existentes: unicos, ids, tipoNovo: novo, texto: `Já existe anúncio deste SKU nesta conta: ${descr}. Este novo será ${nomeNovo} (tipo diferente). Confirme para continuar.` };
}

/** Confirmação dada para ESTA avaliação: { ids, tipo } (mudou MLB ou tipo = confirmar de novo). */
export function confirmacaoDe(av) {
  return av?.estado === "confirmar" && av.ids && av.tipoNovo ? { ids: av.ids, tipo: av.tipoNovo } : null;
}

/** Chave texto da confirmação (para comparar estados da tela). */
export function chaveConfirmacao(av) {
  const c = confirmacaoDe(av);
  return c ? `${c.ids}|${c.tipo}` : "";
}

/**
 * A confirmação recebida vale para a situação ATUAL? Só quando o estado é "confirmar"
 * e os MLBs existentes e o tipo são exatamente os confirmados. Qualquer diferença = não vale.
 */
export function confirmacaoValida(av, confirmacao) {
  const c = confirmacaoDe(av);
  if (!c || !confirmacao) return false;
  return txt(confirmacao.ids).toUpperCase() === c.ids && tipoMLDe(confirmacao.tipo) === c.tipo;
}

/** Pode publicar? livre → sim; confirmar → só com confirmação válida; bloqueia → nunca. */
export function liberaPublicacao(av, confirmacao = null) {
  if (av?.estado === "livre") return true;
  if (av?.estado === "confirmar") return confirmacaoValida(av, confirmacao);
  return false;
}

// ---------------- Conferência no Mercado Livre (usada pelo SERVIDOR antes de criar) ----------------
const normSku = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const encSku = (v) => encodeURIComponent(v).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
const attr = (lista, id) => (Array.isArray(lista) ? lista : []).find((a) => a?.id === id)?.value_name || "";
function skusDoItem(it) {
  const s = [attr(it?.attributes, "SELLER_SKU"), it?.seller_custom_field];
  for (const v of Array.isArray(it?.variations) ? it.variations : []) s.push(v?.seller_custom_field, attr(v?.attributes, "SELLER_SKU"), attr(v?.attribute_combinations, "SELLER_SKU"));
  return s.map((x) => txt(x)).filter(Boolean);
}
const encerrado = (it) => txt(it?.status) === "closed" || (Array.isArray(it?.sub_status) && it.sub_status.includes("deleted"));

/**
 * Procura ESTE SKU nesta conta (todas as grafias; ativos e pausados) e aplica a regra única.
 * ler(caminho) → dados do GET no Mercado Livre (lança erro se falhar).
 * → { libera, av, texto, erro? }  — falha de leitura = NÃO libera (bloqueia por segurança).
 */
export async function conferirDuplicidadeNaConta({ sku = "", conta = "", tipoNovo = "", confirmacao = null, ler } = {}) {
  const contaId = txt(conta).replace(/\D/g, "");
  const alvo = normSku(sku);
  if (!contaId || !alvo || typeof ler !== "function") {
    return { libera: false, av: null, texto: "Duplicidade não conferida (sem SKU ou sem conta). Nada foi enviado." };
  }
  try {
    const t = txt(sku);
    const grafias = [...new Set([t, t.toUpperCase(), t.toLowerCase(), alvo, alvo.toLowerCase()].filter(Boolean))];
    const candidatos = new Set();
    for (const g of grafias) {
      for (const filtro of ["", "&status=paused"]) {
        const d = await ler(`/users/${contaId}/items/search?seller_sku=${encSku(g)}${filtro}`);
        for (const id of Array.isArray(d?.results) ? d.results : []) if (id) candidatos.add(txt(id).toUpperCase());
      }
    }
    const existentes = [];
    for (const id of candidatos) {
      const it = await ler(`/items/${id}`);
      if (!it?.id) return { libera: false, av: null, texto: `Duplicidade não conferida (${id} não pôde ser lido). Nada foi enviado.` };
      if (txt(it.seller_id) !== contaId || encerrado(it)) continue;
      if (!skusDoItem(it).some((s) => normSku(s) === alvo)) continue;
      existentes.push({ mlb: txt(it.id), tipo: txt(it.listing_type_id) });
    }
    const av = avaliarDuplicidadeTipo({ existentes, tipoNovo });
    const libera = liberaPublicacao(av, confirmacao);
    const texto = libera ? (av.estado === "confirmar" ? `Outro anúncio de tipo diferente confirmado por você (${av.ids}).` : "") : (av.estado === "confirmar" ? `${av.texto} Sem a sua confirmação para estes anúncios: nada foi enviado.` : `${av.texto} Nada foi enviado.`);
    return { libera, av, texto };
  } catch (e) {
    return { libera: false, av: null, erro: true, texto: `Duplicidade não conferida no Mercado Livre (${txt(e?.message || e) || "falha na leitura"}). Nada foi enviado.` };
  }
}
