// =============================================================
// PAIIA — Central do Paizinho: relatórios SEPARADOS POR CONTA (17/11/2026).
// Funções puras (armazenamento injetado) usadas pelo relatorioService e pelos testes.
// - Cada conta (LOJA ONLINE, CIEBR, REVELAÇÃO) tem a sua chave neste navegador.
// - A chave antiga, sem conta, só guardava relatórios da LOJA ONLINE: vale só para ela.
// - Um relatório só é mostrado/guardado se for da conta escolhida.
// =============================================================
import { CONTAS_AUDITORIA, CONTA_LEGADO } from "./contas.js";

export const CHAVE_TESTE_LOCAL = "paiiaPaizinhoRelatorioTeste";

export const idDe = (conta) => String(conta?.id ?? conta ?? "").replace(/\D/g, "");
export const chaveDaConta = (base, conta) => `${base}:${idDe(conta)}`;
const liberada = (conta) => CONTAS_AUDITORIA.find((c) => c.id === idDe(conta)) || null;

/** Relatório desta conta guardado neste navegador (nunca o de outra conta). */
export function lerRelatorioDaConta(conta, armazenamento) {
  const id = idDe(conta);
  if (!liberada(id)) return null;
  const ler = (chave) => { try { return JSON.parse(armazenamento?.getItem(chave) || "null"); } catch { return null; } };
  let rel = ler(chaveDaConta(CHAVE_TESTE_LOCAL, id));
  if (!rel && id === CONTA_LEGADO.id) rel = ler(CHAVE_TESTE_LOCAL);
  return rel && idDe(rel.conta) === id ? rel : null;
}

/** Guarda na chave da conta DO RELATÓRIO. */
export function guardarRelatorioDaConta(rel, armazenamento) {
  const id = idDe(rel?.conta);
  if (!liberada(id)) return false;
  try { armazenamento.setItem(chaveDaConta(CHAVE_TESTE_LOCAL, id), JSON.stringify(rel)); return true; } catch { return false; }
}

/* ------------------------------------------------------------ */
/* (19/11) Cópia da LISTA ANTERIOR (antes de "Analisar novos" /   */
/* "Reanalisar" trocarem a lista que está na tela).               */
/* ------------------------------------------------------------ */
export const CHAVE_LISTA_ANTERIOR = `${CHAVE_TESTE_LOCAL}:anterior`;

/** Lista anterior guardada desta conta (ou null). */
export function lerListaAnterior(conta, armazenamento) {
  const id = idDe(conta);
  if (!liberada(id)) return null;
  try {
    const rel = JSON.parse(armazenamento?.getItem(chaveDaConta(CHAVE_LISTA_ANTERIOR, id)) || "null");
    return rel && idDe(rel.conta) === id ? rel : null;
  } catch { return null; }
}

/**
 * Guarda a lista NOVA no lugar da atual, mas só depois de copiar a atual para "lista anterior".
 * Se a cópia não puder ser gravada, a lista atual NÃO é trocada (nada se perde).
 * @returns {{ ok: boolean, copiou: boolean, erro?: string }}
 */
export function guardarSubstituindoComCopia(rel, armazenamento) {
  const id = idDe(rel?.conta);
  if (!liberada(id)) return { ok: false, copiou: false, erro: "Conta não liberada." };
  const atual = lerRelatorioDaConta(id, armazenamento);
  let copiou = false;
  if (atual && atual.gerado_em !== rel.gerado_em) {
    try { armazenamento.setItem(chaveDaConta(CHAVE_LISTA_ANTERIOR, id), JSON.stringify(atual)); copiou = true; }
    catch { return { ok: false, copiou: false, erro: "Sem espaço neste navegador para guardar a cópia da lista atual: a lista atual foi mantida." }; }
  }
  return guardarRelatorioDaConta(rel, armazenamento) ? { ok: true, copiou } : { ok: false, copiou, erro: "Não foi possível guardar a lista nova neste navegador: a lista atual foi mantida." };
}

/** Troca a lista atual pela anterior (as DUAS continuam guardadas: nada se perde). */
export function trocarComListaAnterior(conta, armazenamento) {
  const id = idDe(conta);
  const anterior = lerListaAnterior(id, armazenamento);
  const atual = lerRelatorioDaConta(id, armazenamento);
  if (!anterior) return { ok: false, erro: "Não há lista anterior guardada nesta conta." };
  try {
    armazenamento.setItem(chaveDaConta(CHAVE_TESTE_LOCAL, id), JSON.stringify(anterior));
    if (atual) armazenamento.setItem(chaveDaConta(CHAVE_LISTA_ANTERIOR, id), JSON.stringify(atual));
  } catch { return { ok: false, erro: "Não foi possível trocar as listas neste navegador." }; }
  return { ok: true, rel: anterior, anterior: atual };
}

/**
 * Antes de mostrar/guardar: o relatório é da conta escolhida e a conta foi lida.
 * Conta desconectada (nenhum anúncio lido por falha) → erro com o motivo, sem relatório.
 */
export function conferirRelatorioDaConta(rel, conta) {
  const nome = liberada(conta)?.nome || "Conta";
  if (idDe(rel?.conta) !== idDe(conta)) throw new Error(`${nome}: o relatório veio de outra conta e foi descartado.`);
  const falhaAnuncios = (rel.falhas || []).find((f) => /^anúncios/.test(f.etapa));
  if (!rel.resumo?.anuncios_analisados && falhaAnuncios) {
    throw new Error(`${nome}: não foi possível ler os anúncios desta conta no Mercado Livre (${falhaAnuncios.exemplo || "conta desconectada ou token vencido"}). Confira em Contas Marketplace. Nenhum dado de outra conta foi mostrado.`);
  }
  return true;
}
