/*
 * Duplicidade no Mercado Livre — mesma conta, mesmo SKU/código.
 *
 * Regra: MESMO SKU/CÓDIGO + MESMA CONTA = BLOQUEAR.
 *        MESMO SKU/CÓDIGO + OUTRA CONTA = não bloqueia por causa da outra conta.
 *
 * A busca de SKU do Mercado Livre (seller_sku) diferencia maiúsculas de
 * minúsculas e formatação ("497207698R" ≠ "497207698r" ≠ "497207698 R").
 * Por isso a conferência:
 *  1) procura o SKU em várias grafias (como veio, maiúsculas, minúsculas,
 *     sem espaços/pontos/hífens);
 *  2) faz também a busca livre (q=) da conta com o código e com a parte
 *     numérica dele, que acha anúncios antigos criados fora do PAIIA (código
 *     no título, SKU com outra grafia);
 *  3) abre CADA anúncio candidato e compara pela forma NORMALIZADA
 *     (só letras e números, maiúsculas) o SKU do anúncio, o SKU das variações,
 *     o seller_custom_field, o número da peça (PART_NUMBER) e o título.
 * Anúncio encerrado (closed) não bloqueia. Qualquer consulta que falhe →
 * erro (quem chama BLOQUEIA). O código original nunca é alterado: a
 * normalização serve só para comparar.
 */

/** Forma de comparação: só letras e números, em maiúsculas ("497207698 r" → "497207698R"). */
export function normalizarCodigoComparacao(v) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

// encodeURIComponent deixa ! ' ( ) * sem codificar; a consulta do PAIIA só
// aceita letras, números e %XX, então esses também são codificados.
const enc = (v) => encodeURIComponent(v).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

/** Grafias do código para as buscas exatas do Mercado Livre. */
export function variantesDeBusca(...codigos) {
  const out = new Set();
  for (const c of codigos) {
    const t = String(c ?? "").trim().replace(/\s+/g, " ");
    if (!t) continue;
    const semEspaco = t.replace(/\s+/g, "");
    const norm = normalizarCodigoComparacao(t);
    for (const v of [t, t.toUpperCase(), t.toLowerCase(), semEspaco, semEspaco.toUpperCase(), semEspaco.toLowerCase(), norm, norm.toLowerCase()]) {
      if (v) out.add(v);
    }
  }
  return [...out];
}

// Tokens do texto normalizados, inclusive juntando 2 e 3 vizinhos
// ("497207698 r" e "4972-07698-R" também viram "497207698R").
function tokensNormalizados(texto) {
  const partes = String(texto ?? "").split(/[^A-Za-z0-9]+/).filter(Boolean).map((p) => p.toUpperCase());
  const out = new Set(partes);
  for (let i = 0; i < partes.length; i++) {
    if (i + 1 < partes.length) out.add(partes[i] + partes[i + 1]);
    if (i + 2 < partes.length) out.add(partes[i] + partes[i + 1] + partes[i + 2]);
  }
  return out;
}

const valorAtributo = (lista, id) => (Array.isArray(lista) ? lista : []).find((a) => a?.id === id)?.value_name || "";

/** SKUs informados no anúncio (item, seller_custom_field e variações). */
export function skusDoAnuncio(item) {
  const skus = [valorAtributo(item?.attributes, "SELLER_SKU"), item?.seller_custom_field];
  for (const v of Array.isArray(item?.variations) ? item.variations : []) {
    skus.push(v?.seller_custom_field, valorAtributo(v?.attributes, "SELLER_SKU"), valorAtributo(v?.attribute_combinations, "SELLER_SKU"));
  }
  return skus.map((s) => String(s ?? "").trim()).filter(Boolean);
}

/**
 * Compara UM anúncio com o código. Devolve null (não é o mesmo) ou
 * { tipo: "sku" | "possivel", motivo }.
 *  - "sku": SKU do anúncio (qualquer grafia) = código → duplicidade certa.
 *  - "possivel": número da peça ou título com o mesmo código, SKU diferente
 *    ou vazio (ex.: anúncio antigo sem SKU, ou kit com o mesmo código).
 */
export function compararAnuncio(item, codigoNorm) {
  if (!codigoNorm) return null;
  const skus = skusDoAnuncio(item);
  const skuIgual = skus.find((s) => normalizarCodigoComparacao(s) === codigoNorm);
  if (skuIgual) return { tipo: "sku", motivo: `SKU do anúncio "${skuIgual}"` };
  const pn = valorAtributo(item?.attributes, "PART_NUMBER");
  if (pn && normalizarCodigoComparacao(pn) === codigoNorm) {
    return { tipo: "possivel", motivo: `número da peça "${pn}"${skus.length ? ` (SKU do anúncio: ${skus.join(", ")})` : " (anúncio sem SKU)"}` };
  }
  if (tokensNormalizados(item?.title).has(codigoNorm)) {
    return { tipo: "possivel", motivo: `código no título${skus.length ? ` (SKU do anúncio: ${skus.join(", ")})` : " (anúncio sem SKU)"}` };
  }
  return null;
}

/**
 * Conferência completa numa conta.
 * consultar(caminho) → { ok, dados, erro } (ml_consulta SOMENTE LEITURA da conta).
 * Devolve { verificado, duplicados:[{id,status,titulo,motivo}], possiveis:[...],
 *           buscas, candidatos } ou { erro } (quem chama BLOQUEIA).
 */
export async function verificarDuplicidadeML({ conta, codigos = [], consultar, limiteCandidatos = 60 }) {
  const contaId = String(conta || "").replace(/\D/g, "");
  const codigoNorm = normalizarCodigoComparacao(codigos.find((c) => normalizarCodigoComparacao(c)) || "");
  if (!contaId || !codigoNorm) return { erro: "conta ou código ausente para conferir a duplicidade" };
  const candidatos = new Set();
  let buscas = 0;
  // 1) SKU exato, em todas as grafias.
  for (const v of variantesDeBusca(...codigos)) {
    const r = await consultar(`/users/${contaId}/items/search?seller_sku=${enc(v)}`);
    buscas++;
    if (!r?.ok) return { erro: r?.erro || "busca por SKU indisponível" };
    for (const id of Array.isArray(r.dados?.results) ? r.dados.results : []) if (id) candidatos.add(id);
  }
  // 2) Busca livre da conta (acha anúncios antigos feitos fora do PAIIA).
  // Inclui a parte numérica inicial ("497207698R" → "497207698"): pega SKU
  // gravado com espaço/sufixo diferente ("497207698 r", "497207698-R").
  const numerico = (codigoNorm.match(/^\d{5,}/) || [""])[0];
  const livres = [...new Set([codigoNorm, numerico, ...codigos.map((c) => String(c ?? "").trim()).filter(Boolean)].filter(Boolean))];
  for (const q of livres) {
    const r = await consultar(`/users/${contaId}/items/search?q=${enc(q)}&limit=50`);
    buscas++;
    if (!r?.ok) return { erro: r?.erro || "busca por código indisponível" };
    for (const id of Array.isArray(r.dados?.results) ? r.dados.results : []) if (id) candidatos.add(id);
    if (Number(r.dados?.paging?.total) > 50) {
      return { erro: `a busca pelo código "${q}" trouxe muitos anúncios (${r.dados.paging.total}); conferência manual necessária` };
    }
  }
  if (candidatos.size > limiteCandidatos) {
    return { erro: `${candidatos.size} anúncios candidatos; conferência manual necessária` };
  }
  // 3) Abre cada candidato e compara pela forma normalizada.
  const duplicados = [];
  const possiveis = [];
  for (const id of candidatos) {
    const r = await consultar(`/items/${id}`);
    if (!r?.ok || !r.dados?.id) return { erro: r?.erro || `não foi possível abrir ${id}` };
    const it = r.dados;
    if (String(it.seller_id || "") !== contaId) continue; // segurança: só a própria conta
    if (it.status === "closed") continue; // encerrado não bloqueia
    const c = compararAnuncio(it, codigoNorm);
    if (!c) continue;
    const reg = { id: it.id, status: it.status, titulo: String(it.title || "").slice(0, 80), motivo: c.motivo };
    (c.tipo === "sku" ? duplicados : possiveis).push(reg);
  }
  return { verificado: true, duplicados, possiveis, buscas, candidatos: candidatos.size, codigoNorm };
}

/*
 * Nomes das lojas: as contas vêm SEMPRE da base (listar_contas); este mapa
 * só dá o nome amigável. Conta nova conectada aparece automaticamente com o
 * apelido do Mercado Livre, sem precisar mexer no código.
 */
const NOMES_LOJAS = {
  "2412238242": "REVELAÇÃO",
  "1729335019": "LOJA ONLINE",
  "824312524": "CIEBR",
};
export function nomeDaLoja(mlUserId, nickname = "") {
  return NOMES_LOJAS[String(mlUserId || "")] || String(nickname || "").trim() || `Conta ${mlUserId}`;
}
