// Emulação do comportamento da ação criar_produto da função bling-integracao (versão
// 2026-10-18-verificacao-pontual-2), conforme o código conferido: confirmação, dados
// obrigatórios, trava/incerteza por SKU, verificação do SKU, UM envio, estoque inicial
// por BALANÇO no depósito padrão (ou único) só do produto recém-criado.
import { faltandoParaCriar } from "./blingProdutoServidor.mjs";
export function servidorBling({ deposito = "padrao", existe = null, falhaRede = false } = {}) {
  const st = { produtos: existe ? [{ id: 900, codigo: existe, saldo: 5 }] : [], criacoes: 0, estoques: [], incerto: null, falhaRede, deposito, chamadas: [] };
  const achar = (sku) => st.produtos.filter((p) => p.codigo.toUpperCase().replace(/[\s.\-_/]/g, "") === String(sku).toUpperCase().replace(/[\s.\-_/]/g, ""));
  async function chamar(c) {
    st.chamadas.push(c.acao);
    if (c.acao === "saldo_por_sku") {
      const a = achar(c.sku);
      if (!a.length) return { ok: true, encontrado: false, sku: c.sku };
      return { ok: true, encontrado: true, sku: c.sku, produto: { id: a[0].id, codigo: a[0].codigo }, saldoFisicoTotal: a[0].saldo, saldoVirtualTotal: a[0].saldo };
    }
    if (c.acao === "conferir_criacao_incerta") {
      if (!st.incerto) return { ok: true, pendente: false };
      const a = achar(c.sku); st.incerto = null;
      return a.length ? { ok: true, resolvido: "criado", produto: { id: a[0].id, codigo: a[0].codigo } } : { ok: true, resolvido: "nao_criado" };
    }
    if (c.acao !== "criar_produto") return { ok: false, erro: "Ação desconhecida." };
    if (c.confirmado !== true || c.confirmacao !== "CRIAR_PRODUTO_BLING") return { ok: false, erro: "Criação no Bling não confirmada pelo usuário." };
    const falta = faltandoParaCriar(c.produto);
    if (falta.length) return { ok: false, erro: `Faltam dados: ${falta.join(", ")}.`, faltando: falta };
    if (st.incerto) return { ok: false, criado: false, bloqueado: true, incerto: true, erro: "Tentativa anterior com resultado INCERTO: confira antes." };
    const a = achar(c.produto.codigo);
    if (a.length) return { ok: true, criado: false, ja_existia: true, produto: { id: a[0].id, codigo: a[0].codigo } };
    if (c.conferencia_manual !== true) return { ok: false, criado: false, conferencia_manual_necessaria: true, erro: "Confirme a conferência manual." };
    // UM envio
    st.criacoes += 1;
    const novo = { id: 1000 + st.criacoes, codigo: c.produto.codigo, saldo: 0 };
    st.produtos.push(novo);
    if (st.falhaRede) { st.falhaRede = false; st.incerto = true; return { ok: false, criado: null, incerto: true, bloqueado: true, erro: "Não foi possível confirmar se o produto foi criado." }; }
    const qtd = Number(c.produto.estoque_inicial);
    if (st.deposito === "padrao" || st.deposito === "unico") { novo.saldo = qtd; st.estoques.push({ operacao: "B", produto: novo.id, quantidade: qtd }); return { ok: true, criado: true, produto: { id: novo.id, codigo: novo.codigo }, estoque_inicial: { ok: true, quantidade: qtd } }; }
    return { ok: true, criado: true, produto: { id: novo.id, codigo: novo.codigo }, estoque_inicial: { ok: false, quantidade: qtd, erro: "Depósito padrão do Bling não identificado: lance o estoque inicial no Bling." } };
  }
  return { st, chamar };
}
