// =============================================================
// PAIIA — (09/11) Produto JÁ cadastrado no Bling por esta ficha.
//   Testes: scripts/testes/liberarProximoAnuncio.test.mjs
//
// Caso real (SKU 93226612): o produto foi criado no Bling, mas a busca pelo SKU ainda não
// o devolvia; a tela voltava a mostrar "Criar produto no Bling" e o piloto parava em
// "Bling e estoque". Agora:
//  • depois de criar, relê algumas vezes até o Bling devolver o produto;
//  • se a ficha já tem o ID do produto Bling registrado (gravado quando o PAIIA criou ou
//    vinculou), a tela usa esse cadastro — NUNCA oferece criar de novo (sem duplicar).
// Só leitura: nada é criado, alterado ou vinculado aqui.
// =============================================================

/** ID do produto Bling registrado na publicação ML da ficha (objeto ou lista de publicações). */
export function blingIdDaPublicacao(publicacao) {
  const lista = Array.isArray(publicacao) ? publicacao : publicacao ? [publicacao] : [];
  const ml = lista.find((p) => !p?.marketplace || p.marketplace === "mercado_livre") || null;
  const id = ml?.bling_produto_id;
  return id ? id : null;
}

/**
 * Leitura do Bling + cadastro registrado na ficha. Busca não achou, mas a ficha tem o ID →
 * "encontrado" pelo registro. Erro de leitura, mais de um produto ou sem registro: leitura como veio.
 */
export function leituraComCadastroRegistrado(leitura, { blingProdutoId, sku = "" } = {}) {
  if (!leitura || leitura.encontrado || leitura.ambiguo || !leitura.ok || !blingProdutoId) return leitura;
  return {
    ...leitura,
    encontrado: true,
    registradoNaFicha: true,
    produto: { id: blingProdutoId, codigo: String(sku || ""), nome: "cadastrado pelo PAIIA nesta ficha" },
    saldoFisicoTotal: leitura.saldoFisicoTotal ?? null,
    saldoVirtualTotal: leitura.saldoVirtualTotal ?? null,
    mensagem: `O produto já está cadastrado no Bling (ID ${blingProdutoId}), mas a busca do Bling ainda não o devolve pelo SKU (cadastro recente). Usando o cadastro desta ficha: nada será criado de novo.`,
  };
}

/** Relê até o Bling devolver o produto (cadastro recente demora a aparecer na busca). */
export async function lerAteEncontrar(ler, { tentativas = 4, esperar = (ms) => new Promise((ok) => setTimeout(ok, ms)), intervalo = 2500 } = {}) {
  let r = null;
  for (let i = 0; i < tentativas; i += 1) {
    if (i) await esperar(intervalo);
    r = await ler();
    if (r?.encontrado || r?.ambiguo) return r;
  }
  return r;
}
