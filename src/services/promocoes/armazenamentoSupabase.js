// =============================================================
// PAIIA — Central de Promoções: gravação NO BANCO (Supabase) da seleção,
// das metas e dos rascunhos de campanha (18/11/2026).
//
// Usa as tabelas paiia_promocoes_selecao / _metas / _campanhas (proposta
// 20261118_paiia_promocoes_selecao.sql). HOJE só é ligado no MODO DE TESTE
// (STAGING): na produção as tabelas ainda não existem e a tela continua
// gravando no navegador até a migração ser autorizada.
//
// Mesma interface do armazenamento do navegador (ler/gravar síncronos): carrega
// tudo do usuário uma vez e grava em segundo plano só o que mudou. Nunca apaga
// linha da seleção (remover = removido_em). Não toca em preço, anúncio ou estoque.
// =============================================================
import { selecaoVazia, EVENTO_SELECAO } from "./selecao.js";
import { REGRAS } from "./campanhas.js";

const T_SEL = "paiia_promocoes_selecao";
const T_METAS = "paiia_promocoes_metas";
const T_CAMP = "paiia_promocoes_campanhas";
const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
const COLUNAS_SEL = ["usuario_id", "campanha_id", "conta_ml", "mlb", "sku", "titulo", "preco_referencia", "preco_atual", "desconto_pct", "revisao", "revisao_motivo", "origem", "incluido_em", "removido_em", "revisado_em"];
const COLUNAS_CAMP = ["id", "usuario_id", "nome", "inicio", "fim", "contas", "regra", "desconto_pct", "descontos_por_produto", "situacao"];

const daLinha = (r) => ({
  usuario_id: r.usuario_id, campanha_id: r.campanha_id, conta_ml: String(r.conta_ml), mlb: String(r.mlb), sku: r.sku ?? null, titulo: r.titulo ?? null,
  preco_referencia: num(r.preco_referencia), preco_atual: num(r.preco_atual), desconto_pct: num(r.desconto_pct),
  revisao: !!r.revisao, revisao_motivo: r.revisao_motivo ?? null, origem: r.origem || "central",
  incluido_em: r.incluido_em, removido_em: r.removido_em ?? null, revisado_em: r.revisado_em ?? null,
});
const paraLinha = (reg) => { const o = {}; for (const c of COLUNAS_SEL) o[c] = reg[c] ?? null; o.revisao = !!reg.revisao; o.origem = reg.origem || "central"; o.atualizado_em = new Date().toISOString(); return o; };
const campanhaDaLinha = (r) => ({ id: r.id, nome: r.nome, inicio: r.inicio, fim: r.fim, contas: (r.contas || []).map(String), regra: r.regra || REGRAS.PERCENTUAL, desconto_pct: num(r.desconto_pct), descontos_por_produto: r.descontos_por_produto !== false, situacao: r.situacao || "rascunho", descricao: `${String(num(r.desconto_pct)).replace(".", ",")}% na campanha.` });
const linhaDaCampanha = (c, usuarioId) => { const o = {}; for (const k of COLUNAS_CAMP) o[k] = c[k] ?? null; o.usuario_id = usuarioId; o.atualizado_em = new Date().toISOString(); return o; };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const avisar = () => { try { if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO_SELECAO)); } catch { /* sem janela */ } };

/**
 * @param {{ supabase, usuarioId: string, aoErro?: (msg: string) => void }} o
 * @returns {{ carregar(): Promise<void>, adaptadorSelecao, storageCampanhas, pendentes(): number }}
 */
export function criarArmazenamentoSupabase({ supabase, usuarioId, aoErro = () => {} }) {
  if (!usuarioId) throw new Error("Entre no PAIIA para usar a Central de Promoções.");
  const docs = new Map(); // campanha_id -> documento (mesmo formato do navegador)
  let campanhas = [];
  let fila = Promise.resolve();
  let pendentes = 0;

  const docDe = (campanhaId) => {
    if (!docs.has(campanhaId)) docs.set(campanhaId, selecaoVazia(usuarioId, campanhaId));
    return docs.get(campanhaId);
  };
  // Grava em ordem (uma operação depois da outra); erro recarrega do banco.
  const enfileirar = (fn) => {
    pendentes++;
    fila = fila.then(fn).catch(async (e) => {
      aoErro(`Não foi possível gravar no banco: ${e?.message || e}. A lista foi recarregada do banco.`);
      try { await carregar(); } catch { /* segue */ }
    }).finally(() => { pendentes--; avisar(); });
    return fila;
  };
  const checar = ({ error }) => { if (error) throw new Error(error.message || String(error)); };

  async function carregar() {
    const [s, m, c] = await Promise.all([
      supabase.from(T_SEL).select("*").eq("usuario_id", usuarioId),
      supabase.from(T_METAS).select("*").eq("usuario_id", usuarioId),
      supabase.from(T_CAMP).select("*").eq("usuario_id", usuarioId),
    ]);
    for (const r of [s, m, c]) checar(r);
    docs.clear();
    for (const r of s.data || []) { const reg = daLinha(r); docDe(reg.campanha_id).itens[`${reg.conta_ml}:${reg.mlb}`] = reg; }
    for (const r of m.data || []) docDe(r.campanha_id).metas[String(r.conta_ml)] = num(r.meta);
    campanhas = (c.data || []).map(campanhaDaLinha);
    avisar();
  }

  const adaptadorSelecao = {
    tipo: "supabase",
    ler(_usuario, campanhaId) { return structuredClone(docDe(campanhaId)); },
    gravar(doc) {
      const antes = docDe(doc.campanha);
      const linhas = Object.entries(doc.itens || {}).filter(([k, r]) => !igual(r, antes.itens[k])).map(([, r]) => paraLinha(r));
      const metas = Object.entries(doc.metas || {}).filter(([k, v]) => v !== antes.metas?.[k]).map(([conta, meta]) => ({ usuario_id: usuarioId, campanha_id: doc.campanha, conta_ml: conta, meta, atualizado_em: new Date().toISOString() }));
      docs.set(doc.campanha, structuredClone(doc));
      if (linhas.length) enfileirar(async () => checar(await supabase.from(T_SEL).upsert(linhas, { onConflict: "usuario_id,campanha_id,conta_ml,mlb" })));
      if (metas.length) enfileirar(async () => checar(await supabase.from(T_METAS).upsert(metas, { onConflict: "usuario_id,campanha_id,conta_ml" })));
      avisar();
      return true;
    },
  };

  // Interface de "storage" para o armazemCampanhas (getItem/setItem de uma lista).
  const storageCampanhas = {
    getItem() { return JSON.stringify({ tipo: "paiia-promocoes-campanhas", versao: 1, campanhas }); },
    setItem(_chave, valor) {
      const novas = (JSON.parse(valor)?.campanhas || []).filter((x) => x?.regra === REGRAS.PERCENTUAL);
      const antes = new Map(campanhas.map((x) => [x.id, x]));
      const ids = new Set(novas.map((x) => x.id));
      const assinatura = (x) => JSON.stringify(COLUNAS_CAMP.map((k) => (k === "usuario_id" ? null : x?.[k] ?? null)));
      const gravar = novas.filter((x) => assinatura(x) !== assinatura(antes.get(x.id)));
      const apagar = campanhas.filter((x) => !ids.has(x.id) && x.situacao === "rascunho").map((x) => x.id);
      campanhas = novas.map((x) => ({ ...x }));
      if (gravar.length) enfileirar(async () => checar(await supabase.from(T_CAMP).upsert(gravar.map((x) => linhaDaCampanha(x, usuarioId)), { onConflict: "id" })));
      if (apagar.length) enfileirar(async () => checar(await supabase.from(T_CAMP).delete().in("id", apagar).eq("usuario_id", usuarioId)));
    },
  };

  return { carregar, adaptadorSelecao, storageCampanhas, pendentes: () => pendentes, aguardar: () => fila };
}

// Uma instância por usuário, compartilhada entre a aba de Promoções e o botão do Ranqueamento.
let instancia = null;
const ouvintesErro = new Set();
export function armazenamentoCompartilhado({ supabase, usuarioId }) {
  if (!instancia || instancia.usuarioId !== usuarioId) {
    const a = criarArmazenamentoSupabase({ supabase, usuarioId, aoErro: (m) => ouvintesErro.forEach((f) => f(m)) });
    const pronto = a.carregar().then(() => a);
    instancia = { usuarioId, pronto };
    pronto.catch(() => { if (instancia?.pronto === pronto) instancia = null; }); // tenta de novo na próxima vez
  }
  return instancia.pronto;
}
/** Recebe os erros de gravação no banco; devolve a função para parar de ouvir. */
export function ouvirErrosDoBanco(fn) { ouvintesErro.add(fn); return () => ouvintesErro.delete(fn); }
