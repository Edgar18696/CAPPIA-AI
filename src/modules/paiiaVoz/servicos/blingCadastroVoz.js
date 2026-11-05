// =============================================================
// PAIIA Voz — cadastro do produto no Bling pela ação EXISTENTE do servidor
// (bling-integracao → criar_produto). Nada de novo no servidor: ele já trava
// por SKU, confere as escritas do SKU, envia UMA vez, trata resposta incerta e
// lança o estoque inicial por BALANÇO só no produto recém-criado.
// Aqui: monta os dados com a MESMA função da Publicação, chama o servidor e
// só diz "sucesso" depois de RELER o Bling (produto, SKU e saldo oficial).
// =============================================================
import { montarProdutoBling, conferirProdutoCriado, normalizarQuantidade } from "../../../services/estoqueBlingPAIIA.js";
import { entradaDaFicha } from "./preparoConferenciaVoz.js";

export const CONFIRMACAO_CRIAR = "CRIAR_PRODUTO_BLING";
const txt = (v) => String(v ?? "").trim();

/** Dados do cadastro a partir da ficha (mesma montagem da Publicação do computador). */
export function produtoDaFicha(row) {
  const e = entradaDaFicha(row);
  return montarProdutoBling({
    anuncio: { codigo: e.codigo, titulo: e.titulo, marca: e.marca, preco: e.preco != null ? String(e.preco) : "", gtin: "" },
    titulo: e.titulo,
    quantidade: e.quantidade,
    // Peso e medidas confirmados por você na etapa Envio do Voz.
    logistica: { medida: e.medida, confirmado: Boolean(e.medida) },
  });
}

/**
 * Cadastra (com a sua autorização única) e CONFERE.
 * Devolve { ok, blingProdutoId?, texto?, erro?, incerto?, estoquePendente?, tipo }.
 */
export async function cadastrarNoBlingVoz(row, { chamarBling }) {
  const { produto, faltando } = produtoDaFicha(row);
  if (faltando.length) return { ok: false, tipo: "faltando", erro: `Faltam dados na ficha para cadastrar no Bling: ${faltando.join(", ")}. Nada foi enviado.` };
  let r;
  try {
    r = await chamarBling({ acao: "criar_produto", confirmado: true, confirmacao: CONFIRMACAO_CRIAR, produto, conferencia_manual: true });
  } catch (e) {
    // Sem resposta do servidor: pode ter criado ou não → incerto (o servidor bloqueia nova criação).
    return { ok: false, incerto: true, tipo: "incerto", erro: `Sem resposta do servidor (${txt(e?.message || e).slice(0, 120)}). Confira no Bling antes de tentar de novo.` };
  }
  if (r?.incerto || r?.criado === null) return { ok: false, incerto: true, tipo: "incerto", erro: r?.erro || "Resultado do cadastro incerto: confira no Bling antes de tentar de novo." };
  if (r?.duvida_sku) return { ok: false, tipo: "duvida", erro: r.erro || "O Bling tem este SKU escrito de outro jeito: confira manualmente. Nada foi criado." };
  if (r?.ambiguo) return { ok: false, tipo: "ambiguo", erro: r.erro || "Mais de um produto no Bling com este SKU: resolva no Bling. Nada foi criado." };
  if (r?.bloqueado || r?.conferencia_manual_necessaria || r?.refazer_conferencia) return { ok: false, tipo: "bloqueado", erro: r.erro || "O Bling bloqueou o cadastro. Nada foi criado." };
  if (!r?.ok || !(r.criado || r.ja_existia)) return { ok: false, tipo: "recusado", erro: r?.erro || "O Bling não cadastrou o produto." };

  // Releitura oficial (nunca presume que criar = estoque lançado).
  let releitura;
  try { releitura = await chamarBling({ acao: "saldo_por_sku", sku: produto.codigo }); } catch (e) { releitura = { ok: false, erro: txt(e?.message || e) }; }
  const id = txt(r.produto?.id || releitura?.produto?.id);
  if (r.ja_existia) {
    // Produto já existia: aproveita o cadastro; estoque oficial é só CONSULTADO (nunca sobrescrito).
    if (!releitura?.encontrado || releitura?.ambiguo) return { ok: false, tipo: "releitura", erro: "O Bling disse que o SKU existe, mas a releitura não confirmou: confira e toque de novo." };
    return { ok: true, tipo: "ja_existia", blingProdutoId: id, texto: `SKU já existia no Bling (ID ${id}): cadastro aproveitado; saldo oficial ${releitura.saldoFisicoTotal ?? "?"} (não alterado).` };
  }
  const conf = conferirProdutoCriado({ enviado: produto, criado: r, releitura });
  if (conf.ok) return { ok: true, tipo: "criado", blingProdutoId: id, texto: `Cadastrado no Bling (ID ${id}) e conferido: SKU ${produto.codigo}, saldo oficial ${releitura.saldoFisicoTotal} un.` };
  const qtd = normalizarQuantidade(produto.estoque_inicial);
  const semEstoque = r.estoque_inicial && r.estoque_inicial.ok === false ? ` (${txt(r.estoque_inicial.erro)})` : "";
  return { ok: false, tipo: "estoque", estoquePendente: true, blingProdutoId: id,
    erro: `Produto cadastrado no Bling (ID ${id || "?"}), mas o estoque inicial não foi confirmado${semEstoque}. Lance ${qtd} un. no Bling e toque em “Finalizar e Enviar” de novo: nada será cadastrado outra vez.` };
}

/**
 * Antes de (re)executar: o Bling já tem o SKU? Se foi o PAIIA que tentou cadastrar,
 * só vale com o saldo oficial igual ao estoque da ficha.
 */
export async function conferirAntesVoz(ctx, { chamarBling }) {
  let b;
  try { b = await chamarBling({ acao: "saldo_por_sku", sku: ctx.entrada.codigo }); } catch (e) { return { ok: false, erro: txt(e?.message || e) }; }
  if (b?.ambiguo) return { ok: true, bloqueia: true, texto: "Mais de um produto no Bling com este SKU: resolva no Bling. Nada criado." };
  if (b?.encontrado) {
    // O PAIIA já tentou cadastrar DE VERDADE (incerto ou criado sem estoque confirmado)?
    const op = ctx.registro?.ops?.bling_criar || {};
    const tentou = op.estado === "incerto" || /estoque inicial não foi confirmado|lance o estoque inicial no Bling/i.test(String(op.erro || ""));
    const qtd = normalizarQuantidade(ctx.entrada.quantidade);
    if (tentou && qtd && Number(b.saldoFisicoTotal) !== qtd) {
      return { ok: true, bloqueia: true, texto: `Produto no Bling (ID ${b.produto?.id || "?"}), mas o saldo oficial é ${b.saldoFisicoTotal ?? "?"} e a ficha tem ${qtd} un.: lance o estoque inicial no Bling e toque de novo. Nada será cadastrado outra vez.` };
    }
    return { ok: true, feito: true, blingProdutoId: txt(b.produto?.id), texto: `SKU no Bling (ID ${b.produto?.id || "?"}), saldo oficial ${b.saldoFisicoTotal ?? "?"}: nada cadastrado de novo.` };
  }
  if (b?.encontrado === false && b?.ok !== false) return { ok: true };
  return { ok: false, erro: b?.erro || b?.mensagem || "Bling não respondeu" };
}

/** Resultado incerto: confere no Bling pela ação existente (só leitura + registro). */
export async function conferirIncertaVoz(sku, { chamarBling }) {
  let r;
  try { r = await chamarBling({ acao: "conferir_criacao_incerta", sku }); } catch (e) { return { ok: false, texto: `Não consegui conferir (${txt(e?.message || e)}). Tente de novo em instantes.` }; }
  if (r?.ok && r.resolvido === "criado") return { ok: true, criado: true, texto: `Conferido: o produto FOI cadastrado (ID ${r.produto?.id || "?"}). O estoque inicial não foi lançado automaticamente: lance no Bling e toque em “Finalizar e Enviar”.` };
  if (r?.ok && (r.resolvido === "nao_criado" || r.pendente === false)) return { ok: true, criado: false, texto: "Conferido: o produto NÃO foi cadastrado. Pode autorizar de novo (o SKU será conferido outra vez)." };
  return { ok: false, texto: r?.erro || "Ainda não foi possível conferir. Tente de novo em instantes (até 2 minutos)." };
}
