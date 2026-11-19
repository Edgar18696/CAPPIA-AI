// =============================================================
// PAIIA — Ranqueamento: "CORREÇÃO INTELIGENTE" de um anúncio (18/11/2026).
// Funções PURAS (sem rede, sem navegador) usadas pelo painel "Corrigir":
//   - classifica cada problema: 💸 prejuízo financeiro (SÓ com custo cadastrado e
//     margem calculada negativa), ❔ custo/margem não verificados (custo ausente,
//     a confirmar, margem não calculada ou só estimada), 📉 margem baixa (custo
//     cadastrado, lucro positivo) e 🛠️ qualidade do anúncio (o resto);
//   - monta sugestões que o PRÓPRIO relatório confirma (título com código/marca
//     citados no problema, palavras da concorrência, custo da última compra).
// Custo ausente NUNCA é prejuízo. Nada é inventado: sem confirmação, só a recomendação.
// Nada aqui grava no Mercado Livre, no Bling ou em qualquer banco.
// =============================================================

import { codigoPrincipal } from "./util.js";

export const LIMITE_TITULO_ML = 60;

export const CATEGORIA = Object.freeze({
  PREJUIZO: "prejuizo",
  NAO_VERIFICADO: "nao_verificado",
  MARGEM_BAIXA: "margem_baixa",
  QUALIDADE: "qualidade",
});
export const ROTULO_CATEGORIA = Object.freeze({
  prejuizo: "💸 Prejuízo estimado (custo cadastrado no Bling)",
  nao_verificado: "❔ Custo / margem não verificados",
  margem_baixa: "📉 Margem baixa (custo cadastrado)",
  qualidade: "🛠️ Qualidade do anúncio",
});
const ORDEM_CATEGORIA = [CATEGORIA.PREJUIZO, CATEGORIA.NAO_VERIFICADO, CATEGORIA.MARGEM_BAIXA, CATEGORIA.QUALIDADE];
const PESO = { alta: 3, media: 2, baixa: 1 };

const txt = (v) => String(v ?? "").trim();
const finito = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
const normalizar = (v) => txt(v).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const codigoLimpo = (v) => txt(v).toUpperCase().replace(/[^A-Z0-9]/g, "");
const RE_MARCA = /^A marca (.+) não está no título\.?$/;

/** Problemas (sem os "positivos"), mais graves primeiro. */
// (19/11) O antigo alerta "A marca X não está no título" (relatórios anteriores) não é mais
// problema: a marca do anúncio não é confirmada com o produto real (conferência manual).
export const problemasDoAnuncio = (a) => (a?.achados || []).filter((x) => x && !x.positivo && !RE_MARCA.test(txt(x.problema))).sort((x, y) => (PESO[y.severidade] || 0) - (PESO[x.severidade] || 0));

/** Custo CADASTRADO no Bling e confirmado (não "a confirmar"). */
export const temCustoCadastrado = (a) => Number(a?.custo) > 0 && !a?.custo_a_confirmar;

/** Prejuízo financeiro: SÓ com custo cadastrado e margem calculada negativa. */
export function prejuizoConfirmado(a) {
  if (!temCustoCadastrado(a) || !finito(a?.margem_pct)) return false;
  // (18/11) Lucro negativo pequeno arredonda a margem para 0% (ex.: −R$ 0,07): vale o LUCRO quando existe.
  if (finito(a?.lucro)) return Number(a.lucro) < 0;
  return Number(a.margem_pct) < 0;
}

/** Custo ou margem não verificados (custo ausente, a confirmar, margem não calculada ou só estimada). */
export const custoNaoVerificado = (a) => !temCustoCadastrado(a) || !finito(a?.margem_pct);

/** Categoria de UM problema do anúncio. */
export function categoriaDoProblema(x, a) {
  const area = txt(x?.area);
  if (area === "margem") {
    if (custoNaoVerificado(a)) return CATEGORIA.NAO_VERIFICADO;
    return prejuizoConfirmado(a) ? CATEGORIA.PREJUIZO : CATEGORIA.MARGEM_BAIXA;
  }
  if (area === "renault") return CATEGORIA.NAO_VERIFICADO; // lote sem custo individual: margem não calculada
  return CATEGORIA.QUALIDADE;
}

/** Categorias do anúncio (em ordem fixa) + problemas já classificados. */
export function classificarAnuncio(a) {
  const problemas = problemasDoAnuncio(a).map((x) => {
    const categoria = categoriaDoProblema(x, a);
    return { ...x, categoria, rotulo_categoria: ROTULO_CATEGORIA[categoria] };
  });
  const presentes = new Set(problemas.map((x) => x.categoria));
  if (prejuizoConfirmado(a)) presentes.add(CATEGORIA.PREJUIZO);
  // Custo/margem sem verificação aparece mesmo sem achado de margem (ex.: Bling não lido).
  if (custoNaoVerificado(a)) presentes.add(CATEGORIA.NAO_VERIFICADO);
  const categorias = ORDEM_CATEGORIA.filter((c) => presentes.has(c));
  return { categorias, rotulos: categorias.map((c) => ROTULO_CATEGORIA[c]), problemas, prejuizo: categorias.includes(CATEGORIA.PREJUIZO) };
}

/* ------------------------------------------------------------ */
/* Sugestões confirmadas pelo relatório                          */
/* ------------------------------------------------------------ */

const RE_CODIGO = /^O código (.+) não está no título\.?$/;

/**
 * Título sugerido: título atual + o CÓDIGO PRINCIPAL que o próprio problema cita
 * (lido no Mercado Livre durante a análise). (19/11) Marca NUNCA é acrescentada
 * automaticamente (conferência manual). Se o problema trouxer vários códigos
 * (relatório anterior), só o principal entra: o do SKU, ou o 1º; os outros não são
 * tratados como equivalentes. Nunca passa de 60 caracteres e nunca inventa: se não
 * couber, devolve titulo null e o aviso.
 * @returns {null | { titulo: string|null, adicionados: string[], faltando: string[], caracteres: number|null, aviso: string }}
 */
export function sugestaoTitulo(a) {
  const base = txt(a?.titulo).replace(/\s+/g, " ");
  const itens = [];
  for (const x of problemasDoAnuncio(a)) {
    const p = txt(x.problema);
    const mc = p.match(RE_CODIGO);
    if (mc) itens.push({ tipo: "código", valor: codigoPrincipal(mc[1], a?.sku).principal });
  }
  // Só o que ainda não está no título (sem repetir).
  const faltam = [];
  for (const i of itens) {
    if (!i.valor || faltam.some((f) => f.valor === i.valor)) continue;
    const ja = codigoLimpo(base).includes(codigoLimpo(i.valor));
    if (!ja) faltam.push(i);
  }
  if (!faltam.length) return null;
  if (!base) return { titulo: null, adicionados: [], faltando: faltam.map((f) => f.valor), caracteres: null, aviso: "Anúncio sem título no relatório: inclua manualmente " + faltam.map((f) => `${f.tipo} ${f.valor}`).join(" e ") + "." };
  const titulo = [base, ...faltam.map((f) => f.valor)].join(" ");
  if (titulo.length <= LIMITE_TITULO_ML) {
    return { titulo, adicionados: faltam.map((f) => f.valor), faltando: [], caracteres: titulo.length, aviso: "" };
  }
  const total = titulo.length;
  return {
    titulo: null, adicionados: [], faltando: faltam.map((f) => f.valor), caracteres: null,
    aviso: `Incluir ${faltam.map((f) => `${f.tipo} ${f.valor}`).join(" e ")} deixaria o título com ${total} caracteres (limite do Mercado Livre: ${LIMITE_TITULO_ML}). Reescreva o título encurtando outras palavras; o PAIIA não sugere cortes para não inventar.`,
  };
}

/** Palavras-chave da concorrência (pesquisadas na análise) que ainda não estão no título. */
export function sugestaoPalavras(a) {
  const t = ` ${normalizar(a?.titulo)} `;
  const vistas = new Set();
  const out = [];
  for (const p of a?.palavras || []) {
    const n = normalizar(p);
    if (!n || vistas.has(n) || t.includes(` ${n} `)) continue;
    vistas.add(n);
    out.push(txt(p));
  }
  return out;
}

const valorBR = (v) => {
  const [int, dec] = Number(v).toFixed(2).split(".");
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
};
const dataBR = (iso) => { const m = txt(iso).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; };

/**
 * Custo a cadastrar NO BLING (sugestão: quem cadastra é o usuário; o PAIIA nunca grava no Bling).
 * Só quando NÃO há custo cadastrado e existe a última compra atendida do relatório.
 */
export function sugestaoCusto(a) {
  if (Number(a?.custo) > 0) return null;
  const u = a?.ultima_compra;
  if (!(Number(u?.valor) > 0)) return null;
  const data = dataBR(u.data);
  const valor = valorBR(u.valor);
  const ref = [u.pedido ? `última compra nº ${txt(u.pedido)}` : "última compra", data].filter(Boolean).join(", ");
  return {
    valor: Number(u.valor),
    valor_texto: valor,
    pedido: txt(u.pedido),
    data,
    fonte: txt(u.fonte),
    quantidade: u.quantidade ?? null,
    frase: `Custo a cadastrar no Bling: R$ ${valor} (${ref})`,
  };
}

/**
 * Assuntos (áreas) do anúncio que vão para a fila ao "Marcar como resolvido":
 * os mesmos da fila (uma pendência por área; oportunidade não é pendência).
 */
export function areasParaFila(a) {
  const porArea = new Map();
  for (const x of problemasDoAnuncio(a)) {
    const area = txt(x.area);
    if (!area || area === "oportunidade" || porArea.has(area)) continue;
    porArea.set(area, { item_id: txt(a?.item_id).toUpperCase(), area, severidade: x.severidade, problema: x.problema, sugestao: x.sugestao, titulo: a?.titulo, sku: a?.sku });
  }
  return [...porArea.values()];
}

/** Próximo anúncio da lista filtrada (null no fim). */
export function proximoDaLista(lista, itemId) {
  const i = (lista || []).findIndex((x) => x?.item_id === itemId);
  return i >= 0 && i + 1 < lista.length ? lista[i + 1] : null;
}

/** Tudo o que o painel "Correção inteligente" mostra. */
export function correcaoDoAnuncio(a) {
  const c = classificarAnuncio(a);
  return { ...c, titulo: sugestaoTitulo(a), palavras: sugestaoPalavras(a), custo: sugestaoCusto(a), areas: areasParaFila(a) };
}
