// =============================================================
// PAIIA — Black Friday 2026: PLANO e HISTÓRICO (Fase 1, só neste navegador).
//
// Separação: SIMULAÇÃO (regras.js) → APROVAÇÃO (aqui, só registra a decisão)
// → EXECUÇÃO (Fase 3, no servidor; NÃO existe nesta fase).
// - Tudo é guardado por USUÁRIO (chave com o id do usuário logado).
// - Aprovação idempotente: a mesma chave campanha+conta+anúncio nunca é
//   aprovada duas vezes; guarda o preço original e o preço final do momento.
// - Se o preço do anúncio mudar depois da aprovação, a aprovação fica
//   DESATUALIZADA e sai do plano (nunca usa preço antigo às cegas).
// - Histórico de operações e erros (consulta, simulação, decisão, aprovação…).
// =============================================================
import { CAMPANHA_BF } from "./calendario.js";
import { chaveOperacao } from "./regras.js";
import { aprovavel } from "./planilha.js";

export const LIMITE_HISTORICO = 1000;
const txt = (v) => String(v ?? "").trim();

export const chavePlano = (usuarioId) => `paiiaBlackFriday:${CAMPANHA_BF.id}:plano:${txt(usuarioId) || "sem-usuario"}`;
export const chaveHistorico = (usuarioId) => `paiiaBlackFriday:${CAMPANHA_BF.id}:historico:${txt(usuarioId) || "sem-usuario"}`;
// (17/11) Uma leitura guardada POR CONTA: consultar outra conta não apaga nem mistura a anterior.
export const chaveLeitura = (usuarioId, conta = "") => `paiiaBlackFriday:${CAMPANHA_BF.id}:leitura:${txt(usuarioId) || "sem-usuario"}${txt(conta).replace(/D/g, "") ? `:${txt(conta).replace(/D/g, "")}` : ""}`;

export function planoVazio(usuarioId) {
  return { campanha: CAMPANHA_BF.id, usuario: txt(usuarioId), decisoes: {}, aprovados: {}, campanhas_conta: {}, atualizado_em: null };
}

function ler(storage, chave, padrao) {
  try { const v = JSON.parse(storage?.getItem(chave) || "null"); return v ?? padrao; } catch { return padrao; }
}
function gravar(storage, chave, valor) {
  try { storage?.setItem(chave, JSON.stringify(valor)); return true; } catch { return false; }
}

/**
 * Registro do usuário. `storage` = localStorage (injetado nos testes).
 * `agora` e `novoId` injetáveis para testes.
 */
export function criarRegistroBF({ storage, usuarioId, agora = () => new Date().toISOString(), novoId = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`) }) {
  const u = txt(usuarioId);
  if (!u) throw new Error("Usuário não identificado: a Black Friday só funciona com login.");

  const lerPlano = () => {
    const p = ler(storage, chavePlano(u), null);
    return p && p.usuario === u && p.campanha === CAMPANHA_BF.id ? { ...planoVazio(u), ...p } : planoVazio(u);
  };
  const salvarPlano = (p) => gravar(storage, chavePlano(u), { ...p, usuario: u, atualizado_em: agora() });
  const historico = () => ler(storage, chaveHistorico(u), []);

  function registrar(tipo, detalhe = {}) {
    const entrada = { id: novoId(), quando: agora(), usuario: u, campanha: CAMPANHA_BF.id, tipo, ...detalhe };
    gravar(storage, chaveHistorico(u), [entrada, ...historico()].slice(0, LIMITE_HISTORICO));
    return entrada;
  }

  /** Decisão manual da revisão: "renault" | "demais" | "excluir" | null (desfaz). */
  function decidir(conta, itemId, decisao) {
    const p = lerPlano();
    const k = `${txt(conta)}:${txt(itemId)}`;
    if (decisao) p.decisoes[k] = decisao; else delete p.decisoes[k];
    // Mudou a classificação: aprovação anterior deixa de valer.
    delete p.aprovados[chaveOperacao(conta, itemId)];
    salvarPlano(p);
    registrar("decisao", { conta: txt(conta), item: txt(itemId), decisao: decisao || "desfeita" });
    return p;
  }

  /**
   * Aprova (registra) linhas simuladas. Só aprova PRONTO com margem verificada (aprovavel).
   * Idempotente.
   * @returns {{ aprovados: string[], ja_aprovados: string[], recusados: {chave, motivo}[] }}
   */
  function aprovar(linhas, { modo = "anuncio" } = {}) {
    const p = lerPlano();
    const out = { aprovados: [], ja_aprovados: [], recusados: [] };
    for (const l of linhas || []) {
      // (16/11) Só PRONTO, com margem verificada e não negativa. Sem exceção manual.
      if (!aprovavel(l)) { out.recusados.push({ chave: l.chave, motivo: "não está PRONTO (pendência ou margem não verificada/negativa)" }); continue; }
      const atual = p.aprovados[l.chave];
      if (atual && atual.preco_original === l.preco_original && atual.preco_final === l.preco_final) { out.ja_aprovados.push(l.chave); continue; }
      p.aprovados[l.chave] = {
        chave: l.chave, conta: l.conta, item: l.id, sku: l.sku, classe: l.classe,
        desconto_pct: l.desconto_pct, preco_original: l.preco_original, preco_final: l.preco_final,
        margem_pct: l.margem_pct, situacao: l.situacao, aprovado_em: agora(), aprovado_por: u, modo,
        inicio: CAMPANHA_BF.inicio, fim: CAMPANHA_BF.fim,
      };
      out.aprovados.push(l.chave);
    }
    salvarPlano(p);
    registrar("aprovacao", { modo, aprovados: out.aprovados.length, ja_aprovados: out.ja_aprovados.length, recusados: out.recusados.length, chaves: out.aprovados.slice(0, 200) });
    return out;
  }

  // (16/11) Aprovação da CAMPANHA por conta (separada para cada conta).
  // Só registra a decisão; NÃO ativa nada (ativação só na Fase 3, com autorização).
  // Vale para as ofertas aprovadas da conta NAQUELE momento: se as ofertas da conta
  // mudarem (aprovar, retirar, desatualizar, decidir), a aprovação da campanha cai.
  const assinaturaConta = (p, conta) => Object.values(p.aprovados).filter((a) => txt(a.conta) === txt(conta))
    .map((a) => `${a.chave}=${a.preco_final}`).sort().join("|");

  function aprovarCampanhaConta(conta, { nome = "" } = {}) {
    const p = lerPlano();
    const ofertas = Object.values(p.aprovados).filter((a) => txt(a.conta) === txt(conta));
    if (!ofertas.length) return { ok: false, motivo: "Nenhuma oferta aprovada nesta conta." };
    p.campanhas_conta = { ...(p.campanhas_conta || {}) };
    p.campanhas_conta[txt(conta)] = {
      conta: txt(conta), nome: txt(nome), campanha: CAMPANHA_BF.id, ofertas: ofertas.length,
      assinatura: assinaturaConta(p, conta), inicio: CAMPANHA_BF.inicio, fim: CAMPANHA_BF.fim,
      aprovado_em: agora(), aprovado_por: u, ativacao: "pendente_fase_3",
    };
    salvarPlano(p);
    registrar("campanha_conta_aprovada", { conta: txt(nome) || txt(conta), ofertas: ofertas.length });
    return { ok: true, campanha: p.campanhas_conta[txt(conta)] };
  }

  function retirarCampanhaConta(conta, motivo = "retirada pelo usuário") {
    const p = lerPlano();
    if (!p.campanhas_conta?.[txt(conta)]) return false;
    const nome = p.campanhas_conta[txt(conta)].nome;
    delete p.campanhas_conta[txt(conta)];
    salvarPlano(p);
    registrar("campanha_conta_retirada", { conta: nome || txt(conta), motivo });
    return true;
  }

  /** Campanhas por conta ainda válidas (ofertas iguais às do momento da aprovação). */
  function campanhasPorConta() {
    const p = lerPlano();
    const out = {};
    for (const [conta, cp] of Object.entries(p.campanhas_conta || {})) {
      out[conta] = { ...cp, valida: cp.assinatura === assinaturaConta(p, conta) };
    }
    return out;
  }

  function desaprovar(chaves) {
    const p = lerPlano();
    const removidas = (chaves || []).filter((k) => p.aprovados[k]);
    for (const k of removidas) delete p.aprovados[k];
    salvarPlano(p);
    registrar("aprovacao_desfeita", { quantidade: removidas.length, chaves: removidas.slice(0, 200) });
    return removidas;
  }

  /**
   * Confere as aprovações com a simulação atual: preço original ou final
   * diferente → desatualizada (sai do plano e é registrada).
   */
  function conferirAprovacoes(linhas) {
    const p = lerPlano();
    const porChave = new Map((linhas || []).map((l) => [l.chave, l]));
    const desatualizadas = [];
    for (const [k, a] of Object.entries(p.aprovados)) {
      const l = porChave.get(k);
      if (!l) continue; // anúncio não lido nesta simulação: mantém
      if (l.preco_original !== a.preco_original || l.preco_final !== a.preco_final || !aprovavel(l)) {
        desatualizadas.push({ chave: k, antes: a.preco_original, agora: l.preco_original, situacao: l.situacao });
        delete p.aprovados[k];
      }
    }
    if (desatualizadas.length) {
      salvarPlano(p);
      registrar("aprovacao_desatualizada", { quantidade: desatualizadas.length, itens: desatualizadas.slice(0, 200) });
    }
    return { plano: p, desatualizadas };
  }

  return { lerPlano, historico, registrar, decidir, aprovar, desaprovar, conferirAprovacoes, aprovarCampanhaConta, retirarCampanhaConta, campanhasPorConta };
}
