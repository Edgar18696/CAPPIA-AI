// CÓPIA (só para os testes) de supabase/functions/_shared/blingProduto.js da função bling-integracao em produção (conferida em 08/11/2026).
// =============================================================
// PAIIA — corpo do cadastro de produto no Bling (API v3), sem rede.
// Usado pela função bling-integracao (acao "criar_produto") e pelos
// testes. Só dados confirmados: nada é inventado nem completado.
// Testes: scripts/testes/estoqueBlingPAIIA.test.mjs
// =============================================================

const texto = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

function precoNumero(v) {
  const t = texto(v);
  if (!t) return 0;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : 0;
}

/** POST /produtos — cadastro do produto (sem estoque: o saldo é lançado à parte). */
export function montarCorpoBling(p = {}) {
  const sku = texto(p.codigo);
  const nome = texto(p.nome).slice(0, 120);
  const pesoKg = Number(p.pesoBruto_g) > 0 ? Number(p.pesoBruto_g) / 1000 : undefined;
  const d = p.dimensoes_cm || null;
  const temDim = d && [d.largura, d.altura, d.profundidade].every((x) => Number(x) > 0);
  return {
    nome,
    codigo: sku,
    preco: precoNumero(p.preco),
    tipo: "P",
    situacao: "A",
    formato: "S",
    unidade: "UN",
    ...(texto(p.gtin) ? { gtin: texto(p.gtin) } : {}),
    ...(texto(p.marca) ? { marca: texto(p.marca) } : {}),
    ...(pesoKg ? { pesoBruto: pesoKg, pesoLiquido: pesoKg } : {}),
    ...(temDim ? { dimensoes: { largura: Number(d.largura), altura: Number(d.altura), profundidade: Number(d.profundidade), unidadeMedida: 1 } } : {}),
  };
}

/** Estoque inicial confirmado (inteiro ≥ 1) ou null. */
export function estoqueInicial(p = {}) {
  const t = texto(p.estoque_inicial);
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 ? n : null;
}

/**
 * POST /estoques — lançamento do estoque inicial SÓ do produto recém-criado
 * (operação "B" = balanço: o saldo fica exatamente igual ao confirmado,
 * mesmo se a chamada for repetida). Nunca mexe em outro produto.
 */
export function montarCorpoEstoqueInicial({ produtoId, depositoId, quantidade }) {
  return {
    produto: { id: Number(produtoId) },
    deposito: { id: Number(depositoId) },
    operacao: "B",
    quantidade: Number(quantidade),
    observacoes: "Estoque inicial confirmado na ficha PAIIA",
  };
}

/** Campos obrigatórios para criar (sem eles a criação é recusada). */
export function faltandoParaCriar(p = {}) {
  const f = [];
  if (!texto(p.codigo)) f.push("SKU/código");
  if (!texto(p.nome)) f.push("nome");
  if (!texto(p.marca)) f.push("marca");
  if (!(precoNumero(p.preco) > 0)) f.push("preço");
  if (!estoqueInicial(p)) f.push("estoque inicial");
  if (!(Number(p.pesoBruto_g) > 0)) f.push("peso");
  const d = p.dimensoes_cm || {};
  if (!(Number(d.profundidade) > 0)) f.push("comprimento");
  if (!(Number(d.largura) > 0)) f.push("largura");
  if (!(Number(d.altura) > 0)) f.push("altura");
  return f;
}
