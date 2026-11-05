// =============================================================
// PAIIA Voz — ETAPA 3 (02/11/2026): REVISÃO SIMPLIFICADA NO CELULAR.
//   Testes: scripts/testes/paiiaVozRevisao.test.mjs
//
// Monta, a partir da ficha da conta (Etapa 1) e do preparo das conferências
// (Etapa 2), o resumo que o celular mostra e decide se a revisão pode ser
// APROVADA. A aprovação fica gravada na ficha (paiia_voz.revisao) com a
// assinatura do que foi aprovado: se qualquer dado mudar, ela deixa de valer
// sozinha. Funções puras, sem rede. Nada aqui publica.
// =============================================================

import { entradaDaFicha, preparoAtual, assinaturaEntrada } from "./preparoConferenciaVoz.js";

export const VERSAO_REVISAO = "2026-11-02.1";
const txt = (v) => String(v ?? "").trim();
const brl = (v) => (Number.isFinite(v) ? `R$ ${v.toFixed(2).replace(".", ",")}` : "—");

const NOMES = { conta: "Conta", sku: "SKU", marca: "Marca", fotos: "Fotos", categoria: "Categoria", compatibilidade: "Compatibilidade", duplicidade: "Duplicidade", bling: "Estoque / Bling", frete: "Frete" };

/** Assinatura do que a revisão aprova: os dados da ficha + o resultado das conferências + a categoria confirmada. */
export function assinaturaRevisao(row) {
  const e = entradaDaFicha(row);
  const p = row?.dados_conferencia?.paiia_voz?.preparo || null;
  const d = row?.dados_conferencia?.novo_anuncio || {};
  // Dados ATUAIS da ficha (não só o que o preparo usou): qualquer mudança invalida a aprovação.
  return JSON.stringify([
    assinaturaEntrada(e, p?.conta || ""), p?.assinatura || "", e.categoriaDecisao?.confirmada?.id || "", txt(d.descricao), e.fotos,
    Object.fromEntries(Object.entries(p?.verificacoes || {}).map(([k, v]) => [k, v?.estado])),
  ]);
}

/**
 * Resumo para a tela do celular.
 * @returns {{ dados, pendencias:[{id,texto,tipo}], podeAprovar, aprovada, motivoNaoAprova }}
 */
export function montarRevisao(row) {
  const e = entradaDaFicha(row);
  const d = row?.dados_conferencia?.novo_anuncio || {};
  const voz = row?.dados_conferencia?.paiia_voz || {};
  const prep = preparoAtual(row);
  const p = prep.preparo;
  const v = p?.verificacoes || {};
  const cat = e.categoriaDecisao?.confirmada || null;
  const dados = {
    fotos: e.fotos,
    titulo: e.titulo,
    descricao: String(d.descricao ?? ""),
    sku: e.codigo,
    marca: e.marca,
    aplicacoes: e.aplicacoes.map((a) => [a.montadora, a.modelo, a.motor, a.anoInicio && a.anoFim ? `${a.anoInicio} a ${a.anoFim}` : a.anoInicio || a.anoFim].filter(Boolean).join(" ")),
    categoria: cat ? `${cat.id} — ${cat.caminho}` : "",
    preco: brl(e.preco),
    modalidade: e.tipoAnuncio === "premium" ? "Premium" : "Clássico",
    estoque: e.quantidade,
    tipoVeiculo: e.tipoVeiculo,
    medida: e.medida ? `${e.medida.peso_g} g · ${e.medida.comprimento_cm} × ${e.medida.largura_cm} × ${e.medida.altura_cm} cm` : "",
    conta: p?.conta || "",
    frete: v.frete?.estado === "ok" ? v.frete.texto.replace(/^Frete:\s*/, "") : "",
  };

  // Só o que precisa de correção (o que está ✅ não aparece aqui).
  const pendencias = [];
  if (!p) pendencias.push({ id: "conferir", tipo: "conferir", texto: "Toque em “Conferir agora” para rodar as conferências." });
  else if (!prep.valido) pendencias.push({ id: "conferir", tipo: "conferir", texto: `Conferência desatualizada (${prep.motivo}): confira de novo.` });
  for (const [k, x] of Object.entries(v)) {
    if (x?.estado && x.estado !== "ok") pendencias.push({ id: k, tipo: x.estado, texto: x.texto, ...(k === "categoria" && x.sugerida ? { sugerida: x.sugerida } : {}), ...(k === "compatibilidade" && x.perguntaMotor ? { perguntaMotor: x.perguntaMotor } : {}) });
  }
  // (Etapa 2, decisão de 07/11) Clássico é o padrão e NÃO gera pergunta; trocar para Premium
  // continua disponível na tela, sem ser obrigatório.
  if (!dados.descricao.trim()) pendencias.push({ id: "descricao", tipo: "pergunta", texto: "Descrição vazia: fale ou digite a descrição." });
  if (!e.fotos.length) pendencias.push({ id: "fotos", tipo: "pergunta", texto: "Sem fotos na ficha." });
  const naoTratadas = Array.isArray(voz.fotos) ? voz.fotos.filter((f) => f.usar !== false && f.versao !== "tratada").length : 0;
  if (naoTratadas) pendencias.push({ id: "fotos_tratadas", tipo: "aviso", texto: `${naoTratadas} foto(s) sem fundo branco (vão como original).` });
  // Pendências da ficha do Voz (Etapa 1) que o preparo não cobre.
  for (const t of Array.isArray(voz.pendencias) ? voz.pendencias : []) {
    if (/^Peso e medidas|^Tipo de veículo|^Título/.test(t) && !pendencias.some((x) => x.texto === t)) pendencias.push({ id: `ficha:${t.slice(0, 20)}`, tipo: "pergunta", texto: t });
  }
  const bloqueia = pendencias.filter((x) => x.tipo !== "aviso");
  const podeAprovar = Boolean(p && prep.valido && p.pronto && bloqueia.length === 0);
  const rev = voz.revisao || null;
  const aprovada = Boolean(rev?.aprovada && rev.assinatura === assinaturaRevisao(row));
  return {
    dados,
    pendencias,
    podeAprovar,
    aprovada,
    revisaoAnteriorInvalida: Boolean(rev?.aprovada && !aprovada),
    motivoNaoAprova: podeAprovar ? "" : bloqueia.length ? `${bloqueia.length} item(ns) para resolver.` : "Conferências ainda não prontas.",
  };
}

/** Registro da aprovação (só se a revisão pode ser aprovada). */
export function aprovarRevisao(row, { agora = new Date().toISOString(), usuario = "" } = {}) {
  const r = montarRevisao(row);
  if (!r.podeAprovar) return { ok: false, erro: r.motivoNaoAprova || "A revisão ainda tem pendências." };
  return {
    ok: true,
    revisao: {
      versao: VERSAO_REVISAO,
      aprovada: true,
      em: agora,
      por: txt(usuario),
      origem: "paiia_voz_celular",
      assinatura: assinaturaRevisao(row),
      conta: r.dados.conta,
      categoria: row?.dados_conferencia?.paiia_voz?.preparo?.categoria?.decisao?.confirmada?.id || "",
      resumo: { titulo: r.dados.titulo, sku: r.dados.sku, preco: r.dados.preco, modalidade: r.dados.modalidade, estoque: r.dados.estoque, fotos: r.dados.fotos.length },
    },
  };
}

/** Novo dados_conferencia com a modalidade escolhida na revisão (mesmo campo do Novo Anúncio). */
export function comModalidade(dados, tipo, agora = new Date().toISOString()) {
  const d = dados && typeof dados === "object" ? dados : {};
  const t = tipo === "premium" ? "premium" : "classico";
  const na = d.novo_anuncio || {};
  return {
    ...d,
    anuncio: { ...(d.anuncio || {}), tipoAnuncio: t },
    novo_anuncio: { ...na, tipoAnuncio: t, edicoes: { ...(na.edicoes || {}), tipoAnuncio: agora } },
  };
}

/** Novo dados_conferencia com a aprovação da revisão (paiia_voz.revisao). */
export function comRevisao(dados, revisao) {
  const d = dados && typeof dados === "object" ? dados : {};
  return { ...d, paiia_voz: { ...(d.paiia_voz || {}), revisao } };
}

export const nomeVerificacao = (id) => NOMES[id] || id;
