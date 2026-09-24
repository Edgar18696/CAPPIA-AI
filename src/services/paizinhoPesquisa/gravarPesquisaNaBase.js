// =============================================================
// PAIZINHO — GRAVAR NA BASE PAIIA O QUE FOI CONFIRMADO
// -------------------------------------------------------------
// BASE INTERNA → NÃO ENCONTROU/INCOMPLETO → PESQUISA EXTERNA →
// FONTES ORIGINAIS → CONFIRMAÇÃO → GRAVAÇÃO NA BASE → CRIAR ANÚNCIO
//
// Regras:
//   • grava SOMENTE dado confirmado em fonte original (resultado do
//     validarResultadoPesquisa); campo não confirmado fica vazio (null);
//   • nada de família/categoria/sistema deduzidos;
//   • sem identificação da peça (nome confirmado) não grava nada;
//   • dado em conflito entre fontes já vem excluído e não é gravado;
//   • antidulicidade: reutiliza linha igual já existente (qualquer origem);
//     só completa campos VAZIOS de linhas criadas pela própria pesquisa
//     externa PAIIA — linhas importadas dos catálogos PDF nunca são alteradas;
//   • rastreabilidade (colunas existentes, sem mudar o banco):
//       origem_catalogo     = "Pesquisa externa PAIIA"
//       fabricante_catalogo = fonte(s) original(is)
//       observacao          = URL, data da consulta, status de confirmação.
// =============================================================

import { supabase } from "../../supabase";
import { STATUS_PESQUISA } from "./validarResultadoPesquisa.js";
import { normalizarCodigo, variantesEscrita } from "./codigoPaizinho.js";

export const ORIGEM_PESQUISA_EXTERNA = "Pesquisa externa PAIIA";
const TABELA = "catalogo_pecas";

function texto(v) {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}

function nulo(v) {
  const t = texto(v);
  return t || null;
}

function capitalizar(frase) {
  const t = texto(frase);
  if (!t) return "";
  return t
    .toLowerCase()
    .split(" ")
    .map((p, i) => (p.length <= 2 && i > 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

function hostDe(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function dataBr(d) {
  const x = d instanceof Date ? d : new Date(d);
  return x.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function chaveLinha(r) {
  return [
    normalizarCodigo(r.codigo_oem),
    texto(r.montadora).toLowerCase(),
    texto(r.modelo).toLowerCase(),
    texto(r.motor).toLowerCase(),
    r.ano_inicio ?? "",
    r.ano_fim ?? "",
    (r.tipo_referencia || "aplicacao_veiculo") === "nota_tecnica" ? "nota" : "app",
  ].join("|");
}

/** Decide se o resultado pode alimentar a base (e por quê não). */
export function podeGravarNaBase(validado) {
  if (!validado) return { pode: false, motivo: "Sem resultado de pesquisa." };
  if (
    validado.status !== STATUS_PESQUISA.ENCONTRADO &&
    validado.status !== STATUS_PESQUISA.CONFLITO
  ) {
    return { pode: false, motivo: "Nada confirmado em fonte original." };
  }
  const c = validado.confirmado || {};
  if (!texto(c.descricao)) {
    return {
      pode: false,
      motivo: "Nome/tipo da peça não confirmado (ou em conflito) — nada gravado para não criar registro sem identificação.",
    };
  }
  if (!(validado.fontesOficiaisUsadas || []).length) {
    return { pode: false, motivo: "Sem fonte original registrada." };
  }
  return { pode: true, motivo: "" };
}

/**
 * Monta as linhas da base (puro, sem gravar).
 * Uma linha por aplicação confirmada; sem aplicação → uma nota técnica.
 */
export function montarLinhasBase(validado, { dataConsulta = new Date() } = {}) {
  const c = validado.confirmado || {};
  const codigo = normalizarCodigo(validado.codigoPesquisado);
  const fontes = validado.fontesOficiaisUsadas || [];
  const consultadas = validado.fontesConsultadas || [];
  const info = (u) => consultadas.find((f) => f.url === u) || {};

  const equivalentes = [
    ...new Set(
      [
        ...(c.codigosOem || []),
        ...(c.codigosSubstitutos || []),
        ...(c.codigosEquivalentes || []),
      ]
        .map((x) => texto(x.codigo))
        .filter(Boolean)
    ),
  ];

  const nomesFontes = [
    ...new Set(fontes.map((u) => info(u).nome || hostDe(u)).filter(Boolean)),
  ].join(" | ");

  const conferida = fontes.some((u) => info(u).verificacaoPagina === true);
  const status =
    `confirmado em fonte original (${fontes.length} fonte${fontes.length === 1 ? "" : "s"}` +
    `${conferida ? ", código conferido na página" : ", código citado pela busca na página oficial"}` +
    `; confiança ${validado.confianca || "-"})`;

  const partesComuns = [
    `Fonte original: ${fontes.join(" | ")}`,
    `Data da consulta: ${dataBr(dataConsulta)}`,
    `Status: ${status}`,
    `Código pesquisado: ${texto(validado.codigoPesquisado)}`,
  ];

  const comum = {
    peca: capitalizar(c.descricao),
    codigo_oem: codigo,
    codigo_equivalente: equivalentes.length ? equivalentes.join(", ") : null,
    fabricante: nulo(c.fabricante),
    origem_catalogo: ORIGEM_PESQUISA_EXTERNA,
    fabricante_catalogo: nomesFontes ? nomesFontes.slice(0, 250) : null,
    ativo: true,
    prioridade: 2, // abaixo dos catálogos PDF oficiais já importados
    confiabilidade: validado.confianca === "alta" ? 90 : 80,
  };

  const aplicacoes = c.aplicacoes || [];
  if (!aplicacoes.length) {
    return [
      {
        ...comum,
        montadora: null,
        modelo: null,
        motor: null,
        ano_inicio: null,
        ano_fim: null,
        tipo_referencia: "nota_tecnica",
        observacao: [...partesComuns, "Aplicação de veículo: não confirmada na fonte original"]
          .join(" | ")
          .slice(0, 1000),
      },
    ];
  }

  return aplicacoes.map((a) => ({
    ...comum,
    montadora: nulo(a.montadora),
    modelo: nulo([a.modelo, a.versao].filter(Boolean).join(" ")),
    motor: nulo(a.motor),
    ano_inicio: a.ano_inicio ?? null,
    ano_fim: a.ano_fim ?? null,
    tipo_referencia: "aplicacao_veiculo",
    observacao: [
      ...partesComuns.map((p) =>
        p.startsWith("Fonte original:") ? `Fonte original: ${(a.fontes || fontes).join(" | ")}` : p
      ),
      a.combustivel ? `Combustível: ${texto(a.combustivel)}` : "",
    ]
      .filter(Boolean)
      .join(" | ")
      .slice(0, 1000),
  }));
}

async function buscarExistentes(cliente, codigoPesquisado) {
  const compacto = normalizarCodigo(codigoPesquisado);
  const formas = [...new Set([compacto, ...variantesEscrita(codigoPesquisado)])];
  const { data, error } = await cliente
    .from(TABELA)
    .select("*")
    .in("codigo_oem", formas)
    .limit(500);
  if (error) throw error;
  return (data || []).filter((r) => normalizarCodigo(r.codigo_oem) === compacto);
}

/**
 * Grava na Base PAIIA o que foi confirmado.
 * @returns {{ gravado, inseridos, reaproveitados, atualizados, motivo, erro, linhas }}
 */
export async function gravarPesquisaConfirmadaNaBase(
  validado,
  { cliente = supabase, dataConsulta = new Date() } = {}
) {
  const decisao = podeGravarNaBase(validado);
  if (!decisao.pode) {
    return { gravado: false, inseridos: 0, reaproveitados: 0, atualizados: 0, motivo: decisao.motivo, linhas: [] };
  }

  const linhas = montarLinhasBase(validado, { dataConsulta });

  let existentes;
  try {
    existentes = await buscarExistentes(cliente, validado.codigoPesquisado);
  } catch (erro) {
    // Sem conseguir conferir duplicidade, NÃO grava.
    return {
      gravado: false,
      inseridos: 0,
      reaproveitados: 0,
      atualizados: 0,
      motivo: "Não foi possível conferir a base antes de gravar (evitando duplicidade). Nada foi gravado.",
      erro: String(erro?.message || erro),
      linhas,
    };
  }

  const porChave = new Map(existentes.map((r) => [chaveLinha(r), r]));
  const novas = [];
  const atualizacoes = [];
  let reaproveitados = 0;

  for (const linha of linhas) {
    const igual = porChave.get(chaveLinha(linha));
    if (!igual) {
      novas.push(linha);
      porChave.set(chaveLinha(linha), linha);
      continue;
    }
    reaproveitados += 1;
    // Só completa campos vazios de linhas da própria pesquisa externa.
    if (igual.id && igual.origem_catalogo === ORIGEM_PESQUISA_EXTERNA) {
      const patch = {};
      for (const campo of ["peca", "fabricante", "codigo_equivalente", "fabricante_catalogo"]) {
        if (!texto(igual[campo]) && texto(linha[campo])) patch[campo] = linha[campo];
      }
      if (Object.keys(patch).length) atualizacoes.push({ id: igual.id, patch });
    }
  }

  let inseridos = 0;
  let atualizados = 0;
  const erros = [];

  if (novas.length) {
    const { error } = await cliente.from(TABELA).insert(novas);
    if (error) erros.push(`inserir: ${error.message || error}`);
    else inseridos = novas.length;
  }
  for (const { id, patch } of atualizacoes) {
    const { error } = await cliente
      .from(TABELA)
      .update(patch)
      .eq("id", id)
      .eq("origem_catalogo", ORIGEM_PESQUISA_EXTERNA);
    if (error) erros.push(`atualizar ${id}: ${error.message || error}`);
    else atualizados += 1;
  }

  return {
    gravado: inseridos > 0 || atualizados > 0 || (reaproveitados > 0 && !erros.length),
    inseridos,
    reaproveitados,
    atualizados,
    motivo: erros.length ? "Falha ao gravar na base." : "",
    erro: erros.join(" | ") || null,
    linhas,
  };
}
