// =============================================================
// PAIIA — FONTE PRÓPRIA: CONHECIMENTO VALIDADO
// -------------------------------------------------------------
// Tabela separada: public.paiia_conhecimento_validado
// (SQL: supabase/migrations/20260925_01_paiia_conhecimento_validado.sql)
// Os catálogos originais (catalogo_pecas etc.) NUNCA são alterados aqui.
//
// Prioridade no Novo Anúncio:
//   BASE VALIDADA PAIIA → CATÁLOGOS INTERNOS → PESQUISA EXTERNA
//
// Regras de gravação (depois da pesquisa externa JÁ comparada com os
// catálogos em validarContraBase):
//   • aplicação corroborada pelo catálogo interno ou por 2 fontes oficiais
//     diferentes → "validado";
//   • aplicação só com pista fraca → "pendente" (não usada no anúncio);
//   • conflito de aplicação, motor, ano, OEM ou identificação → "conflito"
//     (não usada; nada é escolhido automaticamente — revisão manual);
//   • identificação sem aplicação: "validado" só quando o catálogo interno
//     tem o mesmo código (e fabricante/tipo batem) ou 2+ fontes oficiais
//     concordam (confiança alta); senão "pendente".
//   • Só registros "validado" são lidos pelo Novo Anúncio.
// =============================================================

import { supabase } from "../../supabase";
import { normalizarCodigo } from "./codigoPaizinho.js";
import { STATUS_PESQUISA } from "./validarResultadoPesquisa.js";

export const TABELA_CONHECIMENTO = "paiia_conhecimento_validado";

export const STATUS_CONHECIMENTO = {
  PENDENTE: "pendente",
  VALIDADO: "validado",
  CONFLITO: "conflito",
};

export const ORIGEM_CONHECIMENTO = {
  CATALOGO_INTERNO: "catalogo_interno",
  ARQUIVO_ORIGINAL: "arquivo_original",
  PESQUISA_EXTERNA: "pesquisa_externa",
};

export const MENSAGEM_BASE_VALIDADA =
  "Encontrado na Base validada PAIIA — dados já confirmados antes; nenhuma pesquisa externa foi feita.";

// Vereditos de validarContraBase (strings copiadas para não acoplar os módulos)
const V_CORROBORADA = "corroborada_pela_base";
const V_FONTE_FORTE = "fonte_oficial_forte";
const V_CONFLITOS = new Set(["conflito_com_base", "conflito_entre_fontes"]);

function texto(v) {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}

function nulo(v) {
  const t = texto(v);
  return t || null;
}

function listaCodigos(lista) {
  return [...new Set((lista || []).map((x) => texto(x?.codigo ?? x)).filter(Boolean))];
}

function evidenciasDasFontes(validado, urls) {
  const consultadas = validado?.fontesConsultadas || [];
  return (urls || []).map((url) => {
    const f = consultadas.find((x) => x.url === url) || {};
    return {
      url,
      nome: f.nome || null,
      trecho: texto(f.evidencia).slice(0, 400) || null,
      codigoConferidoNaPagina: f.verificacaoPagina === true,
    };
  });
}

function textoConflito(cf) {
  const valores = (cf?.valores || [])
    .map((v) => `${texto(v.valor)}${v.fontes?.length ? ` (${v.fontes.join(" | ")})` : ""}`)
    .filter(Boolean);
  return `${texto(cf?.campo)}${valores.length ? `: ${valores.join(" × ")}` : ""}`;
}

/**
 * Converte o resultado da pesquisa (já comparado com a base) nas linhas
 * da fonte própria. Função pura (sem rede).
 */
export function montarRegistrosConhecimento(
  validado,
  { pesquisaId = null, userId = null, agora = new Date() } = {}
) {
  if (!validado) return [];
  if (validado.status !== STATUS_PESQUISA.ENCONTRADO && validado.status !== STATUS_PESQUISA.CONFLITO) {
    return []; // não identificado / indisponível: nada a guardar como conhecimento
  }

  const c = validado.confirmado || {};
  const codigoPesquisado = texto(validado.codigoPesquisado);
  const codigoNormalizado = normalizarCodigo(codigoPesquisado);
  if (!codigoNormalizado) return [];

  const quando = new Date(agora).toISOString();
  const fontesOficiais = validado.fontesOficiaisUsadas || [];
  const base = validado.validacaoBase || {};

  const comum = {
    codigo_normalizado: codigoNormalizado,
    codigo_pesquisado: codigoPesquisado,
    fabricante: nulo(c.fabricante),
    peca: nulo(c.descricao),
    descricao: nulo(c.descricaoReferencia) || nulo(c.descricao),
    codigos_oem: listaCodigos(c.codigosOem),
    codigos_equivalentes: listaCodigos([...(c.codigosEquivalentes || []), ...(c.codigosSubstitutos || [])]),
    especificacoes: (c.especificacoes || []).map((e) => ({
      nome: texto(e.nome),
      valor: texto(e.valor),
      fontes: e.fontes || [],
    })),
    confianca: validado.confianca || null,
    pesquisa_id: pesquisaId && !String(pesquisaId).startsWith("local-") ? pesquisaId : null,
    user_id: userId || null,
  };

  const semVeiculo = {
    montadora: null,
    modelo: null,
    motor: null,
    ano_inicio: null,
    ano_fim: null,
    combustivel: null,
  };

  const linhas = [];

  // ---- Conflito geral (identificação, OEM, fabricante, fontes divergentes)
  const conflitosGerais = [
    ...new Set(
      [...(validado.conflitos || []).map(textoConflito), ...(base.divergencias || [])]
        .map((t) => texto(t).replace(/:$/, ""))
        .filter(Boolean)
    ),
  ];

  if (validado.status === STATUS_PESQUISA.CONFLITO || (base.divergencias || []).length) {
    linhas.push({
      ...comum,
      ...semVeiculo,
      fontes: fontesOficiais,
      origem: ORIGEM_CONHECIMENTO.PESQUISA_EXTERNA,
      evidencia: {
        conflitos: validado.conflitos || [],
        divergenciasComCatalogo: base.divergencias || [],
        fontes: evidenciasDasFontes(validado, fontesOficiais),
      },
      status: STATUS_CONHECIMENTO.CONFLITO,
      motivo_status: `Conflito — revisão manual necessária: ${conflitosGerais.join("; ") || "fontes divergentes"}`.slice(0, 1000),
      validado_em: null,
    });
  }

  // Com divergência de identificação (fabricante/tipo de peça), nada mais
  // é guardado como pendente/validado: a peça pode nem ser a mesma.
  if ((base.divergencias || []).length) return linhas;

  // ---- Aplicações aceitas (corroboradas pelo catálogo ou 2 fontes oficiais)
  // Com qualquer conflito na pesquisa, nenhuma aplicação vira "validado":
  // ficam como pendentes para a revisão manual decidir.
  const semConflito = validado.status === STATUS_PESQUISA.ENCONTRADO;
  const aceitas = semConflito ? c.aplicacoes || [] : [];
  for (const a of c.aplicacoes || []) {
    const corroborada = semConflito && a.veredito === V_CORROBORADA;
    const forte = semConflito && a.veredito === V_FONTE_FORTE;
    const fontesApp = [...new Set([...(a.fontes || []), ...(corroborada && a.referenciaBase?.origem ? [`Catálogo interno: ${a.referenciaBase.origem}`] : [])])];
    linhas.push({
      ...comum,
      montadora: nulo(a.montadora),
      modelo: nulo([a.modelo, a.versao].filter(Boolean).join(" ")),
      motor: nulo(a.motor),
      ano_inicio: a.ano_inicio ?? null,
      ano_fim: a.ano_fim ?? null,
      combustivel: nulo(a.combustivel),
      fontes: fontesApp,
      origem: corroborada ? ORIGEM_CONHECIMENTO.CATALOGO_INTERNO : ORIGEM_CONHECIMENTO.PESQUISA_EXTERNA,
      evidencia: {
        veredito: a.veredito || null,
        rotulo: a.vereditoRotulo || null,
        registroCatalogo: a.referenciaBase || null,
        aplicacaoComoVeioDaFonteExterna: a.aplicacaoExterna || null,
        fontes: evidenciasDasFontes(validado, a.fontes || []),
      },
      status: corroborada || forte ? STATUS_CONHECIMENTO.VALIDADO : STATUS_CONHECIMENTO.PENDENTE,
      motivo_status: corroborada
        ? "Aplicação confirmada: consta no catálogo interno PAIIA."
        : forte
        ? "Aplicação confirmada por 2+ fontes oficiais diferentes (veículo, motor e anos)."
        : !semConflito
        ? "A pesquisa tem conflito em outro campo — aplicação aguardando revisão manual."
        : "Aplicação sem evidência suficiente — aguardando validação.",
      validado_em: corroborada || forte ? quando : null,
    });
  }

  // ---- Aplicações NÃO confirmadas: pendente ou conflito (nunca validado)
  for (const a of validado.aplicacoesNaoConfirmadas || []) {
    const emConflito = V_CONFLITOS.has(a.veredito);
    linhas.push({
      ...comum,
      montadora: nulo(a.montadora),
      modelo: nulo([a.modelo, a.versao].filter(Boolean).join(" ")),
      motor: nulo(a.motor),
      ano_inicio: a.ano_inicio ?? null,
      ano_fim: a.ano_fim ?? null,
      combustivel: nulo(a.combustivel),
      fontes: a.fontes || [],
      origem: ORIGEM_CONHECIMENTO.PESQUISA_EXTERNA,
      evidencia: {
        veredito: a.veredito || null,
        rotulo: a.vereditoRotulo || null,
        registroCatalogo: a.referenciaBase || null,
        fontes: evidenciasDasFontes(validado, a.fontes || []),
      },
      status: emConflito ? STATUS_CONHECIMENTO.CONFLITO : STATUS_CONHECIMENTO.PENDENTE,
      motivo_status: texto(a.vereditoRotulo) || (emConflito ? "Conflito de aplicação — revisão manual." : "Não confirmado — aguardando validação."),
      validado_em: null,
    });
  }

  // ---- Identificação sem aplicação aceita
  if (validado.status === STATUS_PESQUISA.ENCONTRADO && !aceitas.length && comum.peca && fontesOficiais.length) {
    const confirmadaPeloCatalogo = (base.registrosDiretos || 0) > 0;
    const duasFontes = validado.confianca === "alta";
    // Sem comparação com a base concluída, nada vira "validado".
    const comparou = Boolean(base.situacao) && base.situacao !== "falha_na_comparacao";
    const ok = comparou && (confirmadaPeloCatalogo || duasFontes);
    linhas.push({
      ...comum,
      ...semVeiculo,
      fontes: fontesOficiais,
      origem: confirmadaPeloCatalogo ? ORIGEM_CONHECIMENTO.CATALOGO_INTERNO : ORIGEM_CONHECIMENTO.PESQUISA_EXTERNA,
      evidencia: {
        comparacaoComCatalogo: base.situacao || null,
        registrosDoMesmoCodigoNoCatalogo: base.registrosDiretos || 0,
        fontes: evidenciasDasFontes(validado, fontesOficiais),
      },
      status: ok ? STATUS_CONHECIMENTO.VALIDADO : STATUS_CONHECIMENTO.PENDENTE,
      motivo_status: confirmadaPeloCatalogo
        ? "Identificação confirmada: o catálogo interno tem o mesmo código e o fabricante/tipo batem. Aplicação de veículo não confirmada."
        : duasFontes
        ? "Identificação confirmada por 2+ fontes oficiais. Aplicação de veículo não confirmada."
        : "Identificação com uma única fonte oficial e sem registro no catálogo interno — aguardando validação.",
      validado_em: ok ? quando : null,
    });
  }

  // Sem repetir a mesma chave no mesmo envio
  const vistas = new Set();
  return linhas.filter((l) => {
    const k = [l.codigo_normalizado, l.montadora, l.modelo, l.motor, l.ano_inicio, l.ano_fim, l.status]
      .map((x) => String(x ?? "").toLowerCase())
      .join("|");
    if (vistas.has(k)) return false;
    vistas.add(k);
    return true;
  });
}

/**
 * Grava na fonte própria (sem duplicar). Exige usuário logado (RLS).
 * Nunca toca nos catálogos originais.
 */
export async function gravarConhecimento(registros, { cliente = supabase } = {}) {
  const linhas = Array.isArray(registros) ? registros : [];
  const resumo = (s) => ({
    total: linhas.length,
    validados: linhas.filter((l) => l.status === STATUS_CONHECIMENTO.VALIDADO).length,
    pendentes: linhas.filter((l) => l.status === STATUS_CONHECIMENTO.PENDENTE).length,
    conflitos: linhas.filter((l) => l.status === STATUS_CONHECIMENTO.CONFLITO).length,
    ...s,
  });
  if (!linhas.length) return resumo({ gravado: false, motivo: "Nada a guardar." });

  try {
    const { data: sessao } = await cliente.auth.getSession();
    if (!sessao?.session) {
      return resumo({ gravado: false, motivo: "Não gravado na Base validada PAIIA: é preciso estar logado." });
    }
    const { error } = await cliente
      .from(TABELA_CONHECIMENTO)
      .upsert(linhas, { onConflict: "chave_registro", ignoreDuplicates: true });
    if (error) return resumo({ gravado: false, motivo: "Falha ao gravar na Base validada PAIIA.", erro: error.message });
    return resumo({ gravado: true, motivo: "" });
  } catch (e) {
    return resumo({ gravado: false, motivo: "Falha ao gravar na Base validada PAIIA.", erro: String(e?.message || e) });
  }
}

/** Lê SOMENTE conhecimento validado do código (1ª etapa da busca). */
export async function buscarConhecimentoValidado(codigo, { cliente = supabase } = {}) {
  const alvo = normalizarCodigo(codigo);
  if (!alvo) return [];
  try {
    const { data, error } = await cliente
      .from(TABELA_CONHECIMENTO)
      .select("*")
      .eq("codigo_normalizado", alvo)
      .eq("status", STATUS_CONHECIMENTO.VALIDADO)
      .eq("ativo", true)
      .limit(500);
    if (error) {
      console.warn("[PAIIA_BASE_VALIDADA] consulta indisponível:", error.message);
      return [];
    }
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn("[PAIIA_BASE_VALIDADA] consulta falhou:", e);
    return [];
  }
}

/**
 * Remonta, a partir das linhas validadas, o mesmo formato do resultado da
 * pesquisa (para reaproveitar montarCamposCriarAnuncio e o painel).
 */
export function resultadoDoConhecimento(linhas, codigoDigitado) {
  const lista = Array.isArray(linhas) ? linhas : [];
  if (!lista.length) return null;
  const primeira = lista.find((l) => l.peca) || lista[0];
  const comFonte = (codigo) => ({ codigo, fontes: [] });
  const oems = [...new Set(lista.flatMap((l) => l.codigos_oem || []))];
  const equivalentes = [...new Set(lista.flatMap((l) => l.codigos_equivalentes || []))];
  const fontes = [...new Set(lista.flatMap((l) => (Array.isArray(l.fontes) ? l.fontes : [])))];
  const especificacoes = [];
  const vistosEsp = new Set();
  for (const l of lista) {
    for (const e of l.especificacoes || []) {
      const k = `${e.nome}|${e.valor}`;
      if (vistosEsp.has(k)) continue;
      vistosEsp.add(k);
      especificacoes.push(e);
    }
  }
  const rotuloOrigem = {
    catalogo_interno: "Base validada PAIIA · confirmada no catálogo interno",
    arquivo_original: "Base validada PAIIA · confirmada em arquivo original",
    pesquisa_externa: "Base validada PAIIA · confirmada em 2+ fontes oficiais",
  };
  const aplicacoes = lista
    .filter((l) => l.montadora && l.modelo)
    .map((l) => ({
      montadora: l.montadora,
      modelo: l.modelo,
      versao: "",
      motor: l.motor || "",
      combustivel: l.combustivel || "",
      ano_inicio: l.ano_inicio,
      ano_fim: l.ano_fim,
      fontes: Array.isArray(l.fontes) ? l.fontes : [],
      vereditoRotulo: rotuloOrigem[l.origem] || "Base validada PAIIA",
      referenciaBase: l.evidencia?.registroCatalogo || null,
    }));
  const datas = lista.map((l) => l.validado_em).filter(Boolean).sort();
  return {
    codigoPesquisado: texto(codigoDigitado) || primeira.codigo_pesquisado,
    status: STATUS_PESQUISA.ENCONTRADO,
    mensagem: MENSAGEM_BASE_VALIDADA,
    confianca: primeira.confianca || "alta",
    confirmado: {
      fabricante: primeira.fabricante || "",
      fabricanteFontes: [],
      descricao: primeira.peca || "",
      descricaoFontes: [],
      codigosOem: oems.map(comFonte),
      codigosEquivalentes: equivalentes.map(comFonte),
      codigosSubstitutos: [],
      aplicacoes,
      especificacoes,
    },
    conflitos: [],
    fontesConsultadas: [],
    fontesOficiaisUsadas: fontes.filter((f) => /^https?:\/\//i.test(f)),
    descartadas: [],
    aplicacoesNaoConfirmadas: [],
    baseValidada: {
      registros: lista.length,
      aplicacoes: aplicacoes.length,
      validadoEm: datas.length ? datas[datas.length - 1] : null,
      fontes,
    },
  };
}
