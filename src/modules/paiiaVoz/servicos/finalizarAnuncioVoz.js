// =============================================================
// PAIIA Voz — (04/11/2026) “Finalizar anúncio”: UMA tela (celular e computador).
//   Testes: scripts/testes/paiiaVozFinalizar.test.mjs
//
// Junta o que já existe: o preparo das conferências (preparoConferenciaVoz,
// só leitura) e a revisão (revisaoCelularVoz). Aqui ficam:
//   • as OPERAÇÕES que a finalização pode executar, cada uma marcável;
//   • a autorização ESPECÍFICA para criar o produto no Bling (estoque inicial 0);
//   • o REGISTRO de cada operação na ficha (paiia_voz.finalizacao) para
//     retomar sem repetir: antes de cada operação a realidade é conferida
//     (Bling/ML) — o que já foi feito não é feito de novo.
//
// LIMITE (documentado): o código das funções do servidor (bling-integracao,
// mercadolivre-publicacao) não está no repositório, então a garantia de não
// duplicar é só do aplicativo (conferência antes + registro). Por isso as
// escritas REAIS ficam DESLIGADAS nesta versão (publicacaoRealLiberada):
// a tela confere, mostra pendências e planeja; executar de verdade só depois
// de comprovada a proteção do servidor e da sua autorização.
// =============================================================
import { entradaDaFicha, preparoAtual } from "./preparoConferenciaVoz.js";
import { montarRevisao, assinaturaRevisao } from "./revisaoCelularVoz.js";

export const VERSAO_FINALIZAR = "2026-11-04.1";
/** Operação “executando” mais antiga que isto é tratada como interrompida (incerta). */
export const MINUTOS_TRAVA = 10;
const txt = (v) => String(v ?? "").trim();
const copia = (o) => JSON.parse(JSON.stringify(o ?? null));

export const ROTULOS_OPERACOES = {
  bling_criar: "Criar o produto no Bling (estoque inicial 0)",
  ml_publicar: "Publicar no Mercado Livre",
  ml_compat: "Gravar as compatibilidades no anúncio",
  bling_vinculo: "Acompanhar o vínculo do anúncio no Bling (só leitura)",
};

/** Escritas reais liberadas? Desligado por padrão (só com VITE_PAIIA_FINALIZAR_REAL=1 e sua autorização). */
export function publicacaoRealLiberada(env) {
  try {
    const e = env || import.meta.env || {};
    return String(e.VITE_PAIIA_FINALIZAR_REAL || "") === "1";
  } catch {
    return false;
  }
}

export function estadoFinalizacao(row) {
  const f = row?.dados_conferencia?.paiia_voz?.finalizacao || {};
  return { versao: f.versao || "", autorizacao: f.autorizacao || null, ops: f.ops && typeof f.ops === "object" ? f.ops : {}, mlb: txt(f.mlb), blingProdutoId: txt(f.blingProdutoId) };
}

/** O preparo diz que o SKU NÃO existe no Bling (com leitura válida)? */
export function skuAusenteNoBling(row) {
  const v = row?.dados_conferencia?.paiia_voz?.preparo?.verificacoes?.bling;
  return Boolean(v && v.encontrado === false && !v.grafiaBling && /não existe no Bling/i.test(txt(v.texto)));
}

/**
 * Situação da finalização: pendências (as da revisão, com a do Bling tratável
 * pela autorização específica), operações planejadas e se dá para executar.
 */
export function compatSemCatalogo(row) {
  const v = row?.dados_conferencia?.paiia_voz?.preparo?.verificacoes?.compatibilidade;
  return Boolean(v && v.estado === "pergunta" && /nenhum veículo do catálogo confirmou/i.test(txt(v.texto)));
}

export function situacaoFinalizar(row, { autorizarBling = false, semCompatibilidade = false, liberado = false } = {}) {
  const rev = montarRevisao(row);
  const prep = preparoAtual(row);
  const e = entradaDaFicha(row);
  const est = estadoFinalizacao(row);
  const ausente = skuAusenteNoBling(row);
  const semCat = compatSemCatalogo(row);
  const semCompat = semCat && semCompatibilidade;
  const pendencias = rev.pendencias.filter((p) => !(p.id === "bling" && ausente && autorizarBling) && !(p.id === "compatibilidade" && semCompat));
  const bloqueia = pendencias.filter((p) => p.tipo !== "aviso" && p.id !== "modalidade");
  const nCompat = e.aplicacoes.length;
  const ops = [];
  if (ausente) ops.push({ id: "bling_criar", marcada: Boolean(autorizarBling), exigeAutorizacao: true, detalhe: `SKU ${e.codigo} não existe no Bling. Só com a sua autorização específica; estoque inicial 0 (o estoque oficial continua lançado por você no Bling).` });
  ops.push({ id: "ml_publicar", marcada: true, detalhe: `${e.tipoAnuncio === "premium" ? "Premium" : "Clássico"} · ${rev.dados.preco} · ${e.quantidade || "?"} un. · conta ${prep.preparo?.conta || "?"}` });
  if (nCompat && !semCompat) ops.push({ id: "ml_compat", marcada: true, detalhe: `${nCompat} compatibilidade(s) confirmada(s)` });
  ops.push({ id: "bling_vinculo", marcada: true, detalhe: "Só leitura: o PAIIA não vincula nem altera estoque ou cadastro no Bling." });
  for (const o of ops) o.estado = est.ops[o.id]?.estado || "nao_iniciado";
  const motivo = !prep.valido ? "Conferência ainda não feita ou desatualizada."
    : bloqueia.length ? `${bloqueia.length} pendência(s) para resolver.`
      : !liberado ? "Execução real ainda não liberada nesta versão (proteção do servidor contra duplicidade não comprovada)."
        : "";
  return { revisao: rev, pendencias, ops, podeExecutar: !motivo, motivo, liberado, skuAusente: ausente, compatSemCatalogo: semCat, semCompatibilidade: semCompat, registro: est };
}

/** Assinatura do que foi autorizado: se a ficha mudar, a autorização deixa de valer. */
export function assinaturaFinalizar(row, opsMarcadas) {
  return JSON.stringify([assinaturaRevisao(row), [...opsMarcadas].sort()]);
}

function agoraIso(deps) {
  return typeof deps?.agora === "function" ? deps.agora() : new Date().toISOString();
}

/**
 * Executa SÓ as operações autorizadas, na ordem: Bling (criar) → ML (publicar)
 * → ML (compatibilidades) → Bling (vínculo, leitura). Cada operação:
 *   1) confere a realidade (deps.conferir.<op>): já feito → marca ok e não repete;
 *   2) grava “executando” na ficha (trava contra 2º toque/outro aparelho);
 *   3) executa e grava o resultado (ok / erro / incerto).
 * Operação “executando” deixada por uma queda: confere a realidade antes;
 * sem confirmação → para como “incerto” (nada é repetido às cegas).
 *
 * deps: { lerFicha(id), gravarFinalizacao(id, mudar(fin)), conferir:{op(ctx)}, executar:{op(ctx)}, agora? }
 * Devolve { ok, ops:{id:{estado,...}}, parou?: id, erro? }.
 */
export async function executarFinalizacao(fichaId, { marcadas = [], autorizacao = null, deps } = {}) {
  const ordem = ["bling_criar", "ml_publicar", "ml_compat", "bling_vinculo"].filter((id) => marcadas.includes(id));
  if (!ordem.length) return { ok: false, erro: "Nenhuma operação autorizada." };
  if (!autorizacao?.confirmada) return { ok: false, erro: "Falta a sua confirmação explícita." };
  const lida = await deps.lerFicha(fichaId);
  if (!lida?.ok) return { ok: false, erro: lida?.erro || "Ficha não encontrada." };
  let row = lida.ficha;
  if (autorizacao.assinatura !== assinaturaFinalizar(row, ordem)) return { ok: false, erro: "A ficha mudou depois da sua confirmação: confira de novo." };
  const reg = estadoFinalizacao(row);
  // Outro aparelho executando agora (trava recente): não mexe.
  for (const id of ordem) {
    const o = reg.ops[id];
    if (o?.estado === "executando" && Date.parse(o.inicio || 0) > Date.parse(agoraIso(deps)) - MINUTOS_TRAVA * 60000 && o.sessao !== autorizacao.sessao) {
      return { ok: false, erro: `${ROTULOS_OPERACOES[id]}: em execução em outro aparelho. Aguarde e toque em Retomar.`, parou: id };
    }
  }
  const ctx = { fichaId, row, entrada: entradaDaFicha(row), registro: reg, conta: txt(row?.dados_conferencia?.paiia_voz?.preparo?.conta) };
  const gravar = async (id, dados) => {
    const g = await deps.gravarFinalizacao(fichaId, (fin) => {
      const f = copia(fin) || {};
      f.versao = VERSAO_FINALIZAR;
      f.autorizacao = { em: autorizacao.em || agoraIso(deps), por: txt(autorizacao.por), assinatura: autorizacao.assinatura, ops: ordem, ...(autorizacao.semCompatibilidade ? { semCompatibilidade: true } : {}) };
      f.ops = f.ops || {};
      f.ops[id] = { ...(f.ops[id] || {}), ...dados };
      if (dados.mlb) f.mlb = dados.mlb;
      if (dados.blingProdutoId) f.blingProdutoId = dados.blingProdutoId;
      return f;
    });
    if (!g?.ok) return false;
    if (g.ficha) { row = g.ficha; ctx.row = row; ctx.registro = estadoFinalizacao(row); }
    return true;
  };
  const resultado = {};
  for (const id of ordem) {
    const antes = ctx.registro.ops[id];
    if (antes?.estado === "ok") { resultado[id] = antes; continue; }
    // 1) realidade primeiro (também resolve a operação interrompida)
    let real;
    try { real = await deps.conferir[id](ctx); } catch (e) { real = { ok: false, erro: e?.message || String(e) }; }
    if (real?.feito) {
      const d = { estado: "ok", erro: "", fim: agoraIso(deps), resultado: real.texto || "já estava feito (conferido)", ...(real.mlb ? { mlb: real.mlb } : {}), ...(real.blingProdutoId ? { blingProdutoId: real.blingProdutoId } : {}), jaEstava: true };
      if (!(await gravar(id, d))) return { ok: false, erro: "Não consegui gravar o registro na ficha: parei.", parou: id, ops: resultado };
      resultado[id] = d;
      if (real.mlb) ctx.mlb = real.mlb;
      continue;
    }
    if (!real?.ok) {
      const d = { estado: antes?.estado === "executando" ? "incerto" : "erro", fim: agoraIso(deps), erro: `Não consegui conferir antes (${real?.erro || "sem resposta"}). Nada foi feito.` };
      await gravar(id, d);
      resultado[id] = d;
      return { ok: false, parou: id, erro: d.erro, ops: resultado };
    }
    if (real.bloqueia) {
      const d = { estado: "erro", fim: agoraIso(deps), erro: real.texto || "bloqueado na conferência" };
      await gravar(id, d);
      resultado[id] = d;
      return { ok: false, parou: id, erro: d.erro, ops: resultado };
    }
    // 2) trava
    if (!(await gravar(id, { estado: "executando", inicio: agoraIso(deps), sessao: txt(autorizacao.sessao), tentativas: (Number(antes?.tentativas) || 0) + 1, erro: "" }))) {
      return { ok: false, erro: "A ficha mudou ou está sendo usada em outro aparelho: nada foi feito. Toque em Retomar.", parou: id, ops: resultado };
    }
    // 3) executa
    let r;
    try { r = await deps.executar[id]({ ...ctx, mlb: ctx.mlb || ctx.registro.mlb }); } catch (e) { r = { ok: false, incerto: true, erro: e?.message || String(e) }; }
    const d = r?.ok
      ? { estado: "ok", erro: "", fim: agoraIso(deps), resultado: r.texto || "feito", ...(r.mlb ? { mlb: r.mlb } : {}), ...(r.blingProdutoId ? { blingProdutoId: r.blingProdutoId } : {}), ...(r.aviso ? { aviso: r.aviso } : {}) }
      : { estado: r?.bloqueado ? "bloqueado" : r?.incerto ? "incerto" : "erro", fim: agoraIso(deps), erro: r?.erro || "falhou" };
    await gravar(id, d);
    resultado[id] = d;
    if (r?.mlb) ctx.mlb = r.mlb;
    if (!r?.ok) return { ok: false, parou: id, erro: d.erro, ops: resultado };
  }
  return { ok: true, ops: resultado };
}

/** Texto curto do estado de cada operação para a tela. */
export function rotuloEstado(estado) {
  return { nao_iniciado: "não iniciado", executando: "executando…", ok: "✅ feito", erro: "⚠️ erro", incerto: "❓ incerto — conferir antes de repetir", bloqueado: "⛔ não liberado" }[estado] || estado || "não iniciado";
}
