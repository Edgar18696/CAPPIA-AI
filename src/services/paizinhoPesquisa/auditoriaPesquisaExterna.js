// =============================================================
// PAIZINHO — AUDITORIA E FILA "PENDENTE DE VALIDAÇÃO"
// -------------------------------------------------------------
// Cada pesquisa externa gera UM registro de auditoria com: código
// pesquisado, data/hora, fontes consultadas, URLs usadas, fabricante,
// dados encontrados, confirmados, descartados, conflitos e confiança.
//
// O resultado NUNCA entra direto na base principal (catalogo_pecas).
// Fica como "pendente_validacao". Só depois de validado por um
// administrador é que promoverPesquisaValidadaParaBase() grava na base,
// e mesmo assim só os dados confirmados em fonte original.
//
// Tabela: public.paiia_pesquisas_externas
//   (SQL em supabase/pendentes/20260923_paiia_pesquisas_externas.sql —
//    ainda NÃO aplicado). Enquanto a tabela não existir, o registro é
//    guardado neste navegador (localStorage) para não se perder.
// =============================================================

import { normalizarCodigo, STATUS_PESQUISA } from "./validarResultadoPesquisa.js";

export const TABELA_AUDITORIA = "paiia_pesquisas_externas";
export const CHAVE_LOCAL = "paiia_pesquisas_externas_local";
const LIMITE_LOCAL = 50;
const VALIDADE_CACHE_DIAS = 30;
const VALIDADE_NEGATIVO_DIAS = 7;

export const STATUS_VALIDACAO = {
  PENDENTE: "pendente_validacao",
  VALIDADO: "validado",
  REJEITADO: "rejeitado",
  PROMOVIDO: "promovido_base",
};

function agoraIso() {
  return new Date().toISOString();
}

function lerLocal(armazenamento) {
  try {
    const bruto = armazenamento?.getItem(CHAVE_LOCAL);
    const lista = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function gravarLocal(armazenamento, lista) {
  try {
    armazenamento?.setItem(CHAVE_LOCAL, JSON.stringify(lista.slice(0, LIMITE_LOCAL)));
    return true;
  } catch {
    return false;
  }
}

function armazenamentoPadrao() {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Monta o registro de auditoria (puro, sem gravar). */
export function montarRegistroAuditoria({
  codigoPesquisado,
  validado,
  bruto,
  inicio,
  fim,
  provedor,
  userId = null,
  erro = null,
}) {
  const confirmado = validado?.confirmado || {};
  return {
    codigo_pesquisado: String(codigoPesquisado ?? "").trim(),
    codigo_normalizado: normalizarCodigo(codigoPesquisado),
    user_id: userId,
    criado_em: fim || agoraIso(),
    iniciado_em: inicio || null,
    provedor: provedor || "desconhecido",
    status: erro ? STATUS_PESQUISA.INDISPONIVEL : validado?.status || STATUS_PESQUISA.NAO_IDENTIFICADO,
    status_validacao: STATUS_VALIDACAO.PENDENTE,
    confianca: validado?.confianca || "baixa",
    fabricante: confirmado.fabricante || null,
    descricao: confirmado.descricao || null,
    fontes_consultadas: validado?.fontesConsultadas || [],
    fontes_oficiais: validado?.fontesOficiaisUsadas || [],
    dados_encontrados: bruto?.fontes || [],
    dados_confirmados: confirmado,
    dados_descartados: {
      fontes: validado?.descartadas || [],
      aplicacoes: validado?.aplicacoesDescartadas || [],
    },
    conflitos: validado?.conflitos || [],
    consultas_realizadas: bruto?.consultas || [],
    erro: erro ? String(erro?.message || erro) : null,
  };
}

/**
 * Grava a auditoria. Tenta a tabela do Supabase; se não existir ou falhar,
 * guarda localmente. Nunca grava em catalogo_pecas.
 */
export async function registrarAuditoriaPesquisa(
  registro,
  { cliente, armazenamento = armazenamentoPadrao() } = {}
) {
  if (cliente) {
    try {
      const { data, error } = await cliente
        .from(TABELA_AUDITORIA)
        .insert(registro)
        .select("id")
        .single();
      if (!error) {
        return { salvoEm: "supabase", id: data?.id || null };
      }
      console.warn("[PAIZINHO_AUDITORIA] tabela indisponível, gravando localmente:", error?.message);
    } catch (erro) {
      console.warn("[PAIZINHO_AUDITORIA] falha no Supabase, gravando localmente:", erro);
    }
  }
  const lista = lerLocal(armazenamento);
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  lista.unshift({ id, ...registro });
  gravarLocal(armazenamento, lista);
  return { salvoEm: "local", id };
}

/**
 * Procura uma pesquisa recente do mesmo código (evita repetir a pesquisa
 * externa). Só reaproveita resultados com identificação (encontrado/conflito)
 * dos últimos 30 dias. Continua marcado como pendente de validação.
 */
export async function buscarPesquisaRecente(
  codigo,
  { cliente, armazenamento = armazenamentoPadrao(), agora = Date.now() } = {}
) {
  const alvo = normalizarCodigo(codigo);
  if (!alvo) return null;
  const limite = new Date(agora - VALIDADE_CACHE_DIAS * 86400000).toISOString();
  // "Não identificado" também é reaproveitado por 7 dias, para não pagar de
  // novo pela mesma pesquisa sem resultado (o usuário pode forçar outra).
  const limiteNegativo = new Date(agora - VALIDADE_NEGATIVO_DIAS * 86400000).toISOString();
  const aceitos = [STATUS_PESQUISA.ENCONTRADO, STATUS_PESQUISA.CONFLITO, STATUS_PESQUISA.NAO_IDENTIFICADO];
  const dentroDoPrazo = (r) =>
    String(r.criado_em) >= (r.status === STATUS_PESQUISA.NAO_IDENTIFICADO ? limiteNegativo : limite);

  if (cliente) {
    try {
      const { data, error } = await cliente
        .from(TABELA_AUDITORIA)
        .select("*")
        .eq("codigo_normalizado", alvo)
        .in("status", aceitos)
        .neq("status_validacao", STATUS_VALIDACAO.REJEITADO)
        .gte("criado_em", limiteNegativo < limite ? limiteNegativo : limite)
        .order("criado_em", { ascending: false })
        .limit(5);
      const valido = (Array.isArray(data) ? data : []).find(dentroDoPrazo);
      if (!error && valido) {
        return { ...valido, origemCache: "supabase" };
      }
    } catch {
      // segue para o local
    }
  }

  const local = lerLocal(armazenamento).find(
    (r) =>
      r.codigo_normalizado === alvo &&
      aceitos.includes(r.status) &&
      r.status_validacao !== STATUS_VALIDACAO.REJEITADO &&
      !r.erro &&
      dentroDoPrazo(r)
  );
  return local ? { ...local, origemCache: "local" } : null;
}

/** Marca uma pesquisa como validada (administrador). */
export async function marcarPesquisaValidada(id, { cliente, validadoPor = null } = {}) {
  if (!cliente) throw new Error("Validação exige conexão com o Supabase.");
  const { error } = await cliente
    .from(TABELA_AUDITORIA)
    .update({
      status_validacao: STATUS_VALIDACAO.VALIDADO,
      validado_por: validadoPor,
      validado_em: agoraIso(),
    })
    .eq("id", id);
  if (error) throw error;
  return true;
}

/**
 * Converte uma pesquisa VALIDADA em registros no formato da base
 * (catalogo_pecas). Só usa dados confirmados. Recusa se não estiver
 * validada ou se tiver conflito.
 */
export function montarRegistrosParaBase(pesquisa) {
  if (!pesquisa) throw new Error("Pesquisa inexistente.");
  if (pesquisa.status_validacao !== STATUS_VALIDACAO.VALIDADO) {
    throw new Error("Só pesquisas VALIDADAS podem entrar na base PAIIA.");
  }
  if (pesquisa.status !== STATUS_PESQUISA.ENCONTRADO || (pesquisa.conflitos || []).length > 0) {
    throw new Error("Pesquisa com conflito ou sem identificação não entra na base.");
  }
  const c = pesquisa.dados_confirmados || {};
  if (!c.fabricante && !c.descricao) {
    throw new Error("Sem fabricante ou descrição confirmados — nada a gravar.");
  }

  const codigo = normalizarCodigo(pesquisa.codigo_pesquisado);
  const equivalentes = [
    ...(c.codigosOem || []),
    ...(c.codigosSubstitutos || []),
    ...(c.codigosEquivalentes || []),
  ]
    .map((x) => x.codigo)
    .filter(Boolean);
  const fontes = (pesquisa.fontes_oficiais || []).join(" | ");
  const origem = `Pesquisa Paizinho validada — ${fontes}`.slice(0, 480);

  const comum = {
    peca: c.descricao || null,
    codigo_oem: codigo,
    codigo_equivalente: equivalentes.length ? [...new Set(equivalentes)].join(", ") : null,
    fabricante: c.fabricante || null,
    origem_catalogo: origem,
    ativo: true,
    prioridade: 1,
    confiabilidade: pesquisa.confianca === "alta" ? 95 : 85,
  };

  const aplicacoes = c.aplicacoes || [];
  if (aplicacoes.length === 0) {
    return [
      {
        ...comum,
        montadora: null,
        modelo: null,
        motor: null,
        ano_inicio: null,
        ano_fim: null,
        observacao: "Referência técnica sem aplicação confirmada em fonte original.",
        tipo_referencia: "nota_tecnica",
      },
    ];
  }
  return aplicacoes.map((a) => ({
    ...comum,
    montadora: a.montadora || null,
    modelo: [a.modelo, a.versao].filter(Boolean).join(" ") || null,
    motor: a.motor || null,
    ano_inicio: a.ano_inicio ?? null,
    ano_fim: a.ano_fim ?? null,
    observacao: `Fonte: ${(a.fontes || []).join(" | ")}`.slice(0, 480),
    tipo_referencia: "aplicacao_veiculo",
  }));
}

/**
 * Promove uma pesquisa validada para a base principal. Chamada MANUAL
 * (administrador). Não roda automaticamente em nenhum fluxo.
 */
export async function promoverPesquisaValidadaParaBase(
  pesquisa,
  { cliente, tabelaBase = "catalogo_pecas" } = {}
) {
  if (!cliente) throw new Error("Promoção exige conexão com o Supabase.");
  const registros = montarRegistrosParaBase(pesquisa);
  const { error } = await cliente.from(tabelaBase).insert(registros);
  if (error) throw error;
  if (pesquisa.id && !String(pesquisa.id).startsWith("local-")) {
    await cliente
      .from(TABELA_AUDITORIA)
      .update({ status_validacao: STATUS_VALIDACAO.PROMOVIDO, promovido_em: agoraIso() })
      .eq("id", pesquisa.id);
  }
  return { inseridos: registros.length };
}
