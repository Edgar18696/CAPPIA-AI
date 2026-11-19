// =============================================================
// PAIIA — Central do Paizinho: FILA DE ANÚNCIOS SEM REPETIÇÃO (17/11/2026).
//
// Funções PURAS (sem rede, sem navegador). As mesmas regras valem:
//   - no repositório do navegador (registro em ordem, refeito a cada leitura);
//   - no banco (funções SQL paizinho_registrar_rodada / paizinho_registrar_acao,
//     supabase/pendentes/20261117_paizinho_fila_anuncios.sql).
//
// Regras:
//   - Uma fila por conta (LOJA ONLINE, CIEBR, REVELAÇÃO). Anúncio = conta + MLB.
//   - "Analisar novos": só MLBs ativos que nunca foram analisados nesta conta.
//   - "Reanalisar": MLBs já analisados (pendentes primeiro); não conta como inédito.
//   - Uma rodada só é registrada depois que a análise terminou; registrar a mesma
//     rodada de novo (recarga, falha, nova tentativa) não duplica nada (id da rodada).
//   - Pendência = assunto (área) com problema num anúncio. Status: aberta, resolvida
//     ou removida (só da lista). Reanálise que ainda encontra uma resolvida reabre;
//     aberta que não aparece mais na reanálise fica resolvida ("não encontrada").
//   - Situação do anúncio: pendente (alguma aberta), resolvido (nenhuma aberta e
//     alguma resolvida) ou analisado.
//   - Nada aqui altera o Mercado Livre ou o Bling.
// =============================================================

export const VERSAO_FILA = 1;
export const MODO = Object.freeze({ NOVOS: "novos", REANALISE: "reanalise" });
export const STATUS = Object.freeze({ ABERTA: "aberta", RESOLVIDA: "resolvida", REMOVIDA: "removida" });
export const SITUACAO = Object.freeze({ ANALISADO: "analisado", PENDENTE: "pendente", RESOLVIDO: "resolvido" });
export const ACOES_FILA = Object.freeze({ resolvido: STATUS.RESOLVIDA, removido: STATUS.REMOVIDA, devolvido: STATUS.ABERTA });

const txt = (v) => String(v ?? "").trim();
const idConta = (v) => txt(v?.id ?? v).replace(/\D/g, "");
const mlb = (v) => txt(v).toUpperCase();
const corta = (s, n = 220) => txt(s).slice(0, n);
const PESO = { alta: 3, media: 2, baixa: 1 };
export const chavePendencia = (m, area) => `${mlb(m)}|${txt(area)}`;

/** Id novo de rodada/ação (crypto quando existe). */
export function novoId() {
  try { if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID(); } catch { /* segue */ }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 10)}`;
}

export function estadoVazio(conta) {
  return { conta: idConta(conta), anuncios: {}, pendencias: {}, eventos: [], rodadas: {}, ultimaRodada: null, acoes: {} };
}

/* ------------------------------------------------------------ */
/* Escolha dos anúncios                                          */
/* ------------------------------------------------------------ */

/** Inéditos: ativos desta conta que nunca foram analisados (ordem da lista do ML). */
export function escolherIneditos(idsAtivos, estado, quantidade) {
  const ja = new Set(Object.keys(estado?.anuncios || {}));
  const fora = (idsAtivos || []).map(mlb).filter((id) => id && !ja.has(id));
  return { escolhidos: fora.slice(0, Math.max(0, Number(quantidade) || 0)), ineditosAntes: fora.length };
}

/** Reanálise: já analisados e ainda ativos; pendentes primeiro, depois a análise mais antiga. */
export function escolherReanalise(idsAtivos, estado, quantidade) {
  const ativos = new Set((idsAtivos || []).map(mlb));
  const ordem = { [SITUACAO.PENDENTE]: 0, [SITUACAO.ANALISADO]: 1, [SITUACAO.RESOLVIDO]: 2 };
  return Object.values(estado?.anuncios || {})
    .filter((a) => ativos.has(a.mlb))
    .sort((a, b) => (ordem[a.situacao] ?? 3) - (ordem[b.situacao] ?? 3) || txt(a.ultima_analise_em).localeCompare(txt(b.ultima_analise_em)) || a.mlb.localeCompare(b.mlb))
    .slice(0, Math.max(0, Number(quantidade) || 0))
    .map((a) => a.mlb);
}

/* ------------------------------------------------------------ */
/* Rodada (resultado de uma análise concluída)                   */
/* ------------------------------------------------------------ */

/** Pendências de um anúncio no relatório: uma por assunto, a mais grave; sem "Manter" nem oportunidade. */
export function pendenciasDoRelatorio(rel, id) {
  const porArea = new Map();
  for (const a of (rel?.secoes || []).flatMap((s) => s.achados || [])) {
    if (mlb(a.item_id) !== mlb(id) || a.positivo || a.area === "oportunidade") continue;
    const atual = porArea.get(a.area);
    if (!atual) porArea.set(a.area, { area: a.area, severidade: a.severidade, problema: corta(a.problema), sugestao: corta(a.sugestao), impacto_rs: a.impacto_rs ?? null, quantidade: 1 });
    else {
      atual.quantidade++;
      if ((PESO[a.severidade] || 0) > (PESO[atual.severidade] || 0)) Object.assign(atual, { severidade: a.severidade, problema: corta(a.problema), sugestao: corta(a.sugestao), impacto_rs: a.impacto_rs ?? null });
    }
  }
  return [...porArea.values()];
}

/**
 * Monta a rodada a partir do relatório. Só anúncios da conta escolhida (vendedor conferido).
 * Recusa relatório de outra conta ou com leitura incompleta (nada é registrado).
 */
export function montarRodada({ id = novoId(), conta, modo, rel, ativosTotal = null, ineditosAntes = null, listaCompleta = true, agora = new Date().toISOString() }) {
  const c = idConta(conta);
  if (!c || idConta(rel?.conta) !== c) return { ok: false, erro: "O relatório não é da conta escolhida: nada foi registrado." };
  if (rel?.leitura_incompleta) return { ok: false, erro: "Leitura incompleta (Bling, frete ou login caiu): a rodada NÃO foi registrada. Rode de novo." };
  if (!Object.values(MODO).includes(modo)) return { ok: false, erro: "Modo desconhecido." };
  const anuncios = (rel.anuncios || [])
    .filter((a) => !a.vendedor_id || idConta(a.vendedor_id) === c)
    .map((a) => ({
      mlb: mlb(a.item_id),
      sku: txt(a.sku),
      titulo: corta(a.titulo, 120),
      pontuacao: Number.isFinite(Number(a.pontuacao)) ? Number(a.pontuacao) : null,
      resultado: { problemas: a.problemas ?? null, visitas30: a.visitas30 ?? null, vendas30: a.vendas30 ?? null, conversao30: a.conversao30 ?? null, margem_pct: a.margem_pct ?? null },
      pendencias: pendenciasDoRelatorio(rel, a.item_id),
    }));
  if (!anuncios.length) return { ok: false, erro: "Nenhum anúncio analisado: nada foi registrado." };
  const novos = modo === MODO.NOVOS ? anuncios.length : 0;
  return {
    ok: true,
    rodada: {
      id, conta: c, modo, em: agora,
      relatorio_de: txt(rel.gerado_em),
      ativos_total: ativosTotal ?? rel.resumo?.anuncios_ativos ?? null,
      ineditos_antes: ineditosAntes,
      ineditos_depois: ineditosAntes == null ? null : Math.max(0, ineditosAntes - novos),
      lista_completa: listaCompleta !== false,
      anuncios,
    },
  };
}

/* ------------------------------------------------------------ */
/* Aplicação (mesma regra do SQL)                                */
/* ------------------------------------------------------------ */

export function situacaoDoAnuncio(estado, m) {
  const ps = Object.values(estado.pendencias).filter((p) => p.mlb === m);
  if (ps.some((p) => p.status === STATUS.ABERTA)) return SITUACAO.PENDENTE;
  if (ps.some((p) => p.status === STATUS.RESOLVIDA)) return SITUACAO.RESOLVIDO;
  return SITUACAO.ANALISADO;
}

/** Aplica uma rodada (idempotente pelo id). Devolve { estado, aplicada }. Não altera o estado recebido. */
export function aplicarRodada(estado, rodada) {
  if (!rodada?.id || idConta(rodada.conta) !== estado.conta) return { estado, aplicada: false, erro: "Rodada de outra conta." };
  if (estado.rodadas[rodada.id]) return { estado, aplicada: false, ja: true };
  const e = { ...estado, anuncios: { ...estado.anuncios }, pendencias: { ...estado.pendencias }, eventos: [...estado.eventos], rodadas: { ...estado.rodadas } };
  for (const a of rodada.anuncios) {
    const antes = e.anuncios[a.mlb];
    e.anuncios[a.mlb] = {
      mlb: a.mlb, sku: a.sku, titulo: a.titulo, pontuacao: a.pontuacao, resultado: a.resultado,
      primeira_analise_em: antes?.primeira_analise_em || rodada.em,
      ultima_analise_em: rodada.em,
      analises: (antes?.analises || 0) + 1,
      situacao: antes?.situacao || SITUACAO.ANALISADO,
    };
    const achadas = new Set(a.pendencias.map((p) => p.area));
    for (const p of a.pendencias) {
      const k = chavePendencia(a.mlb, p.area);
      const velha = e.pendencias[k];
      const status = velha?.status === STATUS.REMOVIDA ? STATUS.REMOVIDA : STATUS.ABERTA;
      e.pendencias[k] = {
        chave: k, mlb: a.mlb, area: p.area, severidade: p.severidade, problema: p.problema, sugestao: p.sugestao, impacto_rs: p.impacto_rs,
        status, detectada_em: velha?.detectada_em || rodada.em, ultima_vez_em: rodada.em,
        resolvida_em: status === STATUS.ABERTA ? null : velha?.resolvida_em || null,
        motivo: status === STATUS.ABERTA ? "" : velha?.motivo || "",
        reaberta: velha?.status === STATUS.RESOLVIDA,
      };
    }
    for (const [k, p] of Object.entries(e.pendencias)) {
      if (p.mlb === a.mlb && p.status === STATUS.ABERTA && !achadas.has(p.area)) {
        e.pendencias[k] = { ...p, status: STATUS.RESOLVIDA, resolvida_em: rodada.em, motivo: "não encontrada na reanálise", reaberta: false };
      }
    }
    const depois = situacaoDoAnuncio(e, a.mlb);
    e.anuncios[a.mlb].situacao = depois;
    e.eventos.push({ id: `${rodada.id}:${a.mlb}`, em: rodada.em, tipo: antes ? "reanalise" : "analise", mlb: a.mlb, sku: a.sku, titulo: a.titulo, rodada_id: rodada.id, situacao_antes: antes?.situacao || null, situacao_depois: depois, pontuacao: a.pontuacao, pendencias: a.pendencias.length });
  }
  const resumoRodada = { ...rodada };
  delete resumoRodada.anuncios;
  e.rodadas[rodada.id] = { ...resumoRodada, quantidade: rodada.anuncios.length };
  if (!e.ultimaRodada || txt(rodada.em) >= txt(e.ultimaRodada.em)) e.ultimaRodada = e.rodadas[rodada.id];
  return { estado: e, aplicada: true };
}

/** Ação do usuário (Resolvido, Remover da lista, Voltar para a lista). Idempotente pelo id. */
export function aplicarAcao(estado, acao) {
  const status = ACOES_FILA[acao?.acao];
  if (!acao?.id || !status) return { estado, aplicada: false, erro: "Ação desconhecida." };
  if (idConta(acao.conta) !== estado.conta) return { estado, aplicada: false, erro: "Ação de outra conta." };
  if (acao.acao === "removido" && !txt(acao.motivo)) return { estado, aplicada: false, erro: "Informe o motivo para remover da lista." };
  if (estado.acoes[acao.id]) return { estado, aplicada: false, ja: true };
  const m = mlb(acao.mlb);
  const k = chavePendencia(m, acao.area);
  const e = { ...estado, pendencias: { ...estado.pendencias }, anuncios: { ...estado.anuncios }, eventos: [...estado.eventos], acoes: { ...estado.acoes, [acao.id]: true } };
  const velha = e.pendencias[k];
  e.pendencias[k] = {
    chave: k, mlb: m, area: txt(acao.area), severidade: velha?.severidade || acao.severidade || "", problema: velha?.problema || corta(acao.problema), sugestao: velha?.sugestao || corta(acao.sugestao), impacto_rs: velha?.impacto_rs ?? null,
    detectada_em: velha?.detectada_em || acao.em, ultima_vez_em: velha?.ultima_vez_em || acao.em,
    status, resolvida_em: status === STATUS.ABERTA ? null : acao.em, motivo: corta(acao.motivo), reaberta: false,
  };
  const antes = e.anuncios[m]?.situacao || null;
  const depois = e.anuncios[m] ? situacaoDoAnuncio(e, m) : null;
  if (e.anuncios[m]) e.anuncios[m] = { ...e.anuncios[m], situacao: depois };
  e.eventos.push({ id: acao.id, em: acao.em, tipo: acao.acao, mlb: m, area: txt(acao.area), titulo: velha ? undefined : corta(acao.titulo, 120), motivo: corta(acao.motivo), situacao_antes: antes, situacao_depois: depois });
  return { estado: e, aplicada: true };
}

/** Refaz o estado a partir do registro em ordem (rodadas e ações). */
export function reconstruir(conta, registro = []) {
  let e = estadoVazio(conta);
  for (const r of registro) {
    if (r?.tipo === "rodada") e = aplicarRodada(e, r.rodada).estado;
    else if (r?.tipo === "acao") e = aplicarAcao(e, r.acao).estado;
  }
  return e;
}

/** Indicadores da conta. */
export function indicadores(estado) {
  const lista = Object.values(estado?.anuncios || {});
  const u = estado?.ultimaRodada || null;
  return {
    total: u?.ativos_total ?? null,
    analisados: lista.length,
    restantes: u?.ineditos_depois ?? (u?.ativos_total != null ? Math.max(0, u.ativos_total - lista.length) : null),
    pendentes: lista.filter((a) => a.situacao === SITUACAO.PENDENTE).length,
    resolvidos: lista.filter((a) => a.situacao === SITUACAO.RESOLVIDO).length,
    ultima: u?.em || null,
  };
}

/**
 * (19/11) Texto ATUAL de uma pendência guardada antes da correção de 19/11 ("PREJUÍZO de …"):
 * mostra como "Prejuízo estimado … (custo cadastrado no Bling…)" e, se a MESMA análise leu zero
 * vendas em 30 dias, "não realizado" e Importante. Só para EXIBIR: o registro guardado não muda.
 */
const RE_PREJUIZO_ANTIGO = /^PREJUÍZO de (R\$\s?[\d.,]+) por venda( \(antes dos impostos\))?: ([\s\S]*)$/;
export function textoAtualDaPendencia(p, anuncio) {
  const mesmo = { problema: p?.problema, severidade: p?.severidade, registro_anterior: false };
  if (txt(p?.area) !== "margem") return mesmo;
  const mm = txt(p?.problema).match(RE_PREJUIZO_ANTIGO);
  if (!mm) return mesmo;
  const semVendas = anuncio?.resultado?.vendas30 === 0;
  return {
    problema: `Prejuízo estimado de ${mm[1]} por venda (custo cadastrado no Bling${mm[2] ? ", antes dos impostos" : ""}): ${mm[3]}${semVendas ? " Nenhuma venda nos últimos 30 dias: prejuízo estimado por venda, não realizado." : ""}`,
    severidade: semVendas ? "media" : p.severidade,
    registro_anterior: true,
  };
}

/** Pendências abertas no formato de "achado" (para a lista com os botões). (19/11) Com a data da análise. */
export function pendenciasAbertas(estado) {
  return Object.values(estado?.pendencias || {})
    .filter((p) => p.status === STATUS.ABERTA)
    .map((p) => {
      const t = textoAtualDaPendencia(p, estado.anuncios[p.mlb]);
      return { item_id: p.mlb, area: p.area, severidade: t.severidade, problema: t.problema, sugestao: p.sugestao, impacto_rs: p.impacto_rs, sku: estado.anuncios[p.mlb]?.sku || "", titulo: estado.anuncios[p.mlb]?.titulo || "", vendedor_id: estado.conta, reaberta: p.reaberta, analisado_em: p.ultima_vez_em || null, registro_anterior: t.registro_anterior };
    })
    .sort((a, b) => (PESO[b.severidade] || 0) - (PESO[a.severidade] || 0) || Math.abs(Number(b.impacto_rs) || 0) - Math.abs(Number(a.impacto_rs) || 0) || a.item_id.localeCompare(b.item_id));
}

/**
 * (19/11) Anúncios JÁ ANALISADOS desta conta que batem com a busca (MLB, SKU ou título),
 * inclusive de rodadas anteriores, com a situação e a data da última análise.
 */
export function buscarAnalisados(estado, busca) {
  const b = txt(busca).toUpperCase();
  if (!b) return [];
  return Object.values(estado?.anuncios || {})
    .filter((a) => [a.mlb, a.sku, a.titulo].some((t) => txt(t).toUpperCase().includes(b)))
    .sort((x, y) => txt(y.ultima_analise_em).localeCompare(txt(x.ultima_analise_em)));
}

/** Status atual de uma pendência (para esconder da lista o que foi resolvido/removido). */
export const statusPendencia = (estado, achado) => estado?.pendencias?.[chavePendencia(achado?.item_id, achado?.area)]?.status || null;
