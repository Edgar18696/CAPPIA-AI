// =============================================================
// PAIIA — Central do Paizinho: onde a FILA fica guardada (17/11/2026).
//
// 1) BANCO (Supabase), quando a migração supabase/pendentes/20261117_paizinho_fila_anuncios.sql
//    estiver aplicada: tabelas paiia_paizinho_* e as funções paizinho_registrar_rodada /
//    paizinho_registrar_acao (uma transação cada; o id impede duplicar).
// 2) NAVEGADOR, enquanto o banco não existir: um registro em ordem por conta
//    (rodadas e ações), gravado de uma vez só (sem meio-registro). O estado é refeito
//    com as MESMAS regras (filaAnuncios.js). Quando o banco existir, o registro é
//    enviado para lá na mesma ordem; o que já estiver lá é ignorado (mesmo id).
// Nada aqui chama o Mercado Livre ou o Bling.
// =============================================================
import { reconstruir, aplicarRodada, aplicarAcao, estadoVazio, chavePendencia } from "./filaAnuncios.js";

const txt = (v) => String(v ?? "").trim();
const idConta = (v) => txt(v?.id ?? v).replace(/\D/g, "");

export const CHAVE_FILA = "paiia_paizinho_fila_v1";
export const chaveFila = (conta) => `${CHAVE_FILA}:${idConta(conta)}`;
export const ORIGEM = Object.freeze({ BANCO: "banco", NAVEGADOR: "navegador" });

/** Banco sem as tabelas/funções da fila (migração ainda não aplicada). */
export function semEstruturaNoBanco(error) {
  const c = txt(error?.code);
  return ["PGRST205", "PGRST202", "42P01", "42883"].includes(c) || /does not exist|Could not find the (table|function)/i.test(txt(error?.message));
}

/* ------------------------------------------------------------ */
/* Navegador                                                     */
/* ------------------------------------------------------------ */

export function repositorioNavegador(armazenamento, conta) {
  const c = idConta(conta);
  const ler = () => {
    try {
      const d = JSON.parse(armazenamento?.getItem(chaveFila(c)) || "null");
      return d && d.conta === c && Array.isArray(d.registro) ? d.registro : [];
    } catch { return []; }
  };
  const gravar = (registro) => {
    // Uma escrita só: ou o registro novo inteiro fica salvo, ou nada muda.
    armazenamento.setItem(chaveFila(c), JSON.stringify({ conta: c, registro }));
  };
  return {
    origem: ORIGEM.NAVEGADOR,
    async carregar() { return reconstruir(c, ler()); },
    registro: ler,
    async registrarRodada(rodada) {
      const registro = ler();
      const atual = reconstruir(c, registro);
      const r = aplicarRodada(atual, rodada);
      if (r.ja) return { ok: true, ja: true, estado: atual };
      if (!r.aplicada) return { ok: false, erro: r.erro || "Rodada recusada." };
      try { gravar([...registro, { tipo: "rodada", rodada }]); } catch (e) { return { ok: false, erro: `Não foi possível salvar neste navegador (${txt(e?.message) || "sem espaço"}).` }; }
      return { ok: true, estado: r.estado };
    },
    async registrarAcao(acao) {
      const registro = ler();
      const atual = reconstruir(c, registro);
      const r = aplicarAcao(atual, acao);
      if (r.ja) return { ok: true, ja: true, estado: atual };
      if (!r.aplicada) return { ok: false, erro: r.erro || "Ação recusada." };
      try { gravar([...registro, { tipo: "acao", acao }]); } catch (e) { return { ok: false, erro: `Não foi possível salvar neste navegador (${txt(e?.message) || "sem espaço"}).` }; }
      return { ok: true, estado: r.estado };
    },
  };
}

/* ------------------------------------------------------------ */
/* Banco (Supabase) — ativo só depois da migração aprovada       */
/* ------------------------------------------------------------ */

export function repositorioBanco(supabase, conta) {
  const c = idConta(conta);
  const rpc = async (nome, p) => {
    const { data, error } = await supabase.rpc(nome, { p });
    if (error) return { ok: false, erro: error.message, semEstrutura: semEstruturaNoBanco(error) };
    return data?.ok === false ? { ok: false, erro: data.erro } : { ok: true, ja: data?.ja_registrada === true };
  };
  const repo = {
    origem: ORIGEM.BANCO,
    async carregar() {
      const [an, pe, ev, ro] = await Promise.all([
        supabase.from("paiia_paizinho_anuncios").select("mlb, sku, titulo, pontuacao, resultado, situacao, analises, primeira_analise_em, ultima_analise_em").eq("conta_ml", c).limit(20000),
        supabase.from("paiia_paizinho_pendencias").select("mlb, area, severidade, problema, sugestao, impacto_rs, status, detectada_em, ultima_vez_em, resolvida_em, motivo, reaberta").eq("conta_ml", c).limit(50000),
        supabase.from("paiia_paizinho_eventos").select("id, em, tipo, mlb, area, rodada_id, situacao_antes, situacao_depois, dados").eq("conta_ml", c).order("em", { ascending: false }).limit(300),
        supabase.from("paiia_paizinho_rodadas").select("id, modo, em, ativos_total, ineditos_antes, ineditos_depois, lista_completa, quantidade, relatorio_de").eq("conta_ml", c).order("em", { ascending: false }).limit(1),
      ]);
      const erro = [an, pe, ev, ro].find((x) => x.error)?.error;
      if (erro) { const e = new Error(erro.message); e.semEstrutura = semEstruturaNoBanco(erro); throw e; }
      const estado = estadoVazio(c);
      for (const a of an.data || []) estado.anuncios[a.mlb] = a;
      for (const p of pe.data || []) estado.pendencias[chavePendencia(p.mlb, p.area)] = { ...p, chave: chavePendencia(p.mlb, p.area) };
      estado.eventos = (ev.data || []).reverse().map((x) => ({ ...x, ...(x.dados || {}) }));
      estado.ultimaRodada = ro.data?.[0] || null;
      return estado;
    },
    registrarRodada: (rodada) => rpc("paizinho_registrar_rodada", rodada),
    registrarAcao: (acao) => rpc("paizinho_registrar_acao", acao),
  };
  return repo;
}

/**
 * Envia o registro do navegador para o banco, na ordem. Idempotente: o que já existe
 * (mesmo id) é ignorado. Para no primeiro erro (o resto fica para a próxima vez).
 */
export async function enviarRegistroParaBanco(registro, banco) {
  let enviados = 0;
  let jaExistiam = 0;
  for (const r of registro || []) {
    const resp = r.tipo === "rodada" ? await banco.registrarRodada(r.rodada) : await banco.registrarAcao(r.acao);
    if (!resp.ok) return { ok: false, enviados, jaExistiam, erro: resp.erro };
    if (resp.ja) jaExistiam++; else enviados++;
  }
  return { ok: true, enviados, jaExistiam };
}
