// =============================================================
// PAIIA — Central do Paizinho: CUSTO DA ÚLTIMA COMPRA no Bling (18/11/2026).
// SÓ LEITURA. Usado quando o custo CADASTRADO no produto do Bling está zerado/vazio.
//
// Fonte aceita: PEDIDOS DE COMPRA do Bling com situação "Atendido" (compra recebida).
// - Valor = preço unitário do item no pedido (sem IPI/frete rateados): custo de aquisição.
// - Não usa preço de venda, transferência de estoque nem movimentação interna.
// - Pedido cancelado, em aberto ou em andamento, e item sem valor, NÃO contam.
// - Notas fiscais de entrada: o aplicativo do PAIIA não tem permissão (HTTP 403) → não usadas.
// - Lançamentos manuais de estoque: a API v3 não oferece leitura → não usados.
// O resultado é uma REFERÊNCIA: a margem calculada com ela é ESTIMATIVA, nunca definitiva.
// =============================================================

export const SITUACAO_ATENDIDO = 1; // Bling: 0 em aberto · 1 atendido · 2 cancelado · 3 em andamento
export const FONTE_PEDIDO = "Pedido de compra no Bling (atendido)";
const txt = (v) => (v === null || v === undefined ? "" : String(v)).trim();
export const normalizarSku = (v) => txt(v).toUpperCase();
const valorSituacao = (s) => (s && typeof s === "object" ? Number(s.valor ?? s.id) : Number(s));

/**
 * Índice da compra mais recente por produto, a partir dos pedidos de compra DETALHADOS.
 * @param {Array} pedidos detalhes de /pedidos/compras/{id}
 * @returns {{ porId: Object, porCodigo: Object, resumo: { pedidos: number, atendidos: number, ignorados: Object } }}
 */
export function indexarUltimasCompras(pedidos) {
  const porId = {};
  const porCodigo = {};
  const ignorados = { nao_atendido: 0, item_sem_valor: 0, item_sem_produto: 0 };
  let atendidos = 0;
  for (const p of pedidos || []) {
    if (valorSituacao(p?.situacao) !== SITUACAO_ATENDIDO) { ignorados.nao_atendido++; continue; }
    atendidos++;
    for (const it of p.itens || []) {
      const valor = Number(it?.valor);
      const id = txt(it?.produto?.id);
      const codigo = normalizarSku(it?.produto?.codigo || it?.codigo);
      if (!id && !codigo) { ignorados.item_sem_produto++; continue; }
      if (!(valor > 0)) { ignorados.item_sem_valor++; continue; }
      const registro = { valor: Math.round(valor * 100) / 100, data: txt(p.data) || null, quantidade: Number(it?.quantidade) || null, pedido: txt(p.numero) || txt(p.id), fonte: FONTE_PEDIDO };
      const melhor = (atual) => !atual || txt(registro.data) > txt(atual.data);
      if (id && melhor(porId[id])) porId[id] = registro;
      if (codigo && melhor(porCodigo[codigo])) porCodigo[codigo] = registro;
    }
  }
  return { porId, porCodigo, resumo: { pedidos: (pedidos || []).length, atendidos, ignorados } };
}

/**
 * Lê no Bling (SÓ GET) os pedidos de compra desde `desde` e devolve a última compra
 * de cada SKU pedido. `blingGet(caminho)` → JSON da API v3. Para por tempo (parcial).
 * Do mais recente para o mais antigo; para quando todos os SKUs já têm compra (a 1ª achada é a última).
 * Leitura em partes: se o tempo acabar, devolve `proximo` (posição para continuar na próxima chamada).
 * @param {{ blingGet: Function, skus: string[], desde: string, esperarMs?: number, limiteMs?: number, idsPorSku?: Object, inicioEm?: number }} o
 */
export async function buscarUltimasCompras({ blingGet, skus, desde, esperarMs = 350, limiteMs = 100000, idsPorSku = {}, inicioEm = 0 }) {
  const inicio = Date.now();
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const lista = [];
  for (let pagina = 1; pagina <= 50; pagina++) {
    const l = (await blingGet(`/pedidos/compras?pagina=${pagina}&limite=100`))?.data || [];
    lista.push(...l);
    if (l.length < 100) break;
    await esperar(esperarMs);
  }
  const doPeriodo = lista.filter((p) => txt(p?.data) >= desde && valorSituacao(p?.situacao) === SITUACAO_ATENDIDO)
    .sort((a, b) => txt(b.data).localeCompare(txt(a.data)));
  const detalhes = [];
  let parcial = false;
  let proximo = null;
  const faltam = () => {
    const idx = indexarUltimasCompras(detalhes);
    return (skus || []).some((sku) => !((txt(idsPorSku[sku]) && idx.porId[txt(idsPorSku[sku])]) || idx.porCodigo[normalizarSku(sku)]));
  };
  for (let i = Math.max(0, Number(inicioEm) || 0); i < doPeriodo.length; i++) {
    if (Date.now() - inicio > limiteMs) { parcial = true; proximo = i; break; }
    const d = (await blingGet(`/pedidos/compras/${encodeURIComponent(txt(doPeriodo[i].id))}`))?.data;
    if (d) detalhes.push(d);
    if (i % 10 === 9 && !faltam()) break; // todos encontrados: não precisa ler os mais antigos
    await esperar(esperarMs);
  }
  const indice = indexarUltimasCompras(detalhes);
  const resultado = {};
  for (const sku of skus || []) {
    const id = txt(idsPorSku[sku]);
    const achado = (id && indice.porId[id]) || indice.porCodigo[normalizarSku(sku)] || null;
    resultado[sku] = achado;
  }
  return { ok: true, modo: "somente leitura", desde, parcial, proximo, pedidos_no_periodo: doPeriodo.length, pedidos_lidos: detalhes.length, ignorados: indice.resumo.ignorados, ultimas: resultado };
}

/** Texto curto da última compra para a tela e a planilha. */
export function textoUltimaCompra(u) {
  if (!u?.valor) return "";
  const [a, m, d] = txt(u.data).slice(0, 10).split("-");
  const data = a && m && d ? `${d}/${m}/${a}` : "data não informada";
  return `R$ ${u.valor.toFixed(2).replace(".", ",")} em ${data}`;
}
