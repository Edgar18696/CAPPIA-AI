// =============================================================
// PAIZINHO — ORQUESTRADOR DA PESQUISA EM FONTES ORIGINAIS
// -------------------------------------------------------------
// Só é chamado quando a Base PAIIA NÃO encontrou o código.
//
//   1. Reaproveita pesquisa recente do mesmo código (se houver).
//   2. Chama o pesquisador externo (Edge Function
//      "paizinho-fontes-originais" — ainda não publicada).
//   3. Valida TUDO no cliente (validarResultadoPesquisa): só fonte
//      oficial que cita o código confirma; o resto é descartado.
//   4. Monta os campos do Criar Anúncio só com dado confirmado.
//   5. Registra auditoria e deixa como "pendente de validação".
//
// A internet ajuda a localizar, mas a fonte original confirma.
// Zero é melhor do que aplicação errada.
// =============================================================

import { supabase } from "../../supabase";
import {
  validarResultadoPesquisa,
  STATUS_PESQUISA,
  MENSAGENS,
} from "./validarResultadoPesquisa.js";
import { montarCamposCriarAnuncio } from "./montarAnuncioPesquisa.js";
import { gravarPesquisaConfirmadaNaBase } from "./gravarPesquisaNaBase.js";
import {
  montarRegistroAuditoria,
  registrarAuditoriaPesquisa,
  buscarPesquisaRecente,
} from "./auditoriaPesquisaExterna.js";

export const FUNCAO_PESQUISA = "paizinho-fontes-originais";
const TEMPO_LIMITE_MS = 90000;

export const MENSAGEM_INDISPONIVEL =
  "A pesquisa em fontes originais ainda não está disponível neste ambiente. Nenhum dado foi preenchido — confira o código no catálogo do fabricante.";

function comTempoLimite(promessa, ms) {
  let temporizador;
  const limite = new Promise((_, rejeitar) => {
    temporizador = setTimeout(
      () => rejeitar(new Error("Tempo esgotado na pesquisa em fontes originais.")),
      ms
    );
  });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(temporizador));
}

/** Erro com mensagem pronta para mostrar ao usuário. */
export class ErroPesquisaExterna extends Error {
  constructor(mensagem, { codigoErro = "", mensagemUsuario = "" } = {}) {
    super(mensagem);
    this.codigoErro = codigoErro;
    this.mensagemUsuario = mensagemUsuario || mensagem;
  }
}

const ROTA_LOCAL = "/api/paizinho-fontes-originais";

function ambienteDesenvolvimento() {
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

function normalizarRespostaProvedor(data) {
  if (!data || data.ok === false) {
    throw new ErroPesquisaExterna(data?.erro || "Pesquisa externa sem resposta.", {
      codigoErro: data?.codigoErro || "",
    });
  }
  return {
    fontes: Array.isArray(data.fontes) ? data.fontes : [],
    consultas: data.consultas || [],
    descartadasServidor: Array.isArray(data.fontesDescartadasServidor)
      ? data.fontesDescartadasServidor
      : [],
  };
}

/**
 * Provedor LOCAL (npm run dev): rota do plugin Vite, com a chave da
 * OpenAI guardada só no computador. Se a rota não existir (servidor
 * iniciado sem o plugin), lança erro com semRotaLocal = true.
 */
export async function provedorLocalDev(codigo) {
  const resposta = await comTempoLimite(
    fetch(ROTA_LOCAL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo }),
    }),
    TEMPO_LIMITE_MS
  );
  const tipo = resposta.headers.get("content-type") || "";
  if (!tipo.includes("application/json")) {
    const erro = new ErroPesquisaExterna("Rota local da pesquisa não está ativa.", {
      codigoErro: "SEM_ROTA_LOCAL",
      mensagemUsuario:
        "A pesquisa em fontes originais ainda não está ativa neste computador: reinicie o npm run dev para carregar a nova configuração.",
    });
    erro.semRotaLocal = true;
    throw erro;
  }
  return normalizarRespostaProvedor(await resposta.json());
}

/**
 * Provedor da Edge Function no Supabase (produção — ainda não publicada).
 */
export async function provedorEdgeFunction(codigo) {
  const { data, error } = await comTempoLimite(
    supabase.functions.invoke(FUNCAO_PESQUISA, { body: { codigo } }),
    TEMPO_LIMITE_MS
  );
  if (error) throw error;
  return normalizarRespostaProvedor(data);
}

/** Local no npm run dev; Edge Function nos demais ambientes. */
export async function provedorPadrao(codigo) {
  if (ambienteDesenvolvimento()) {
    return provedorLocalDev(codigo);
  }
  return provedorEdgeFunction(codigo);
}

function resultadoDoCache(registro) {
  const quando = registro.criado_em
    ? new Date(registro.criado_em).toLocaleDateString("pt-BR")
    : "";
  const mensagens = {
    [STATUS_PESQUISA.CONFLITO]: MENSAGENS.CONFLITO,
    [STATUS_PESQUISA.NAO_IDENTIFICADO]: `${MENSAGENS.NAO_IDENTIFICADO} (resultado da pesquisa de ${quando}, reaproveitado sem nova consulta paga)`,
  };
  const validado = {
    codigoPesquisado: registro.codigo_pesquisado,
    status: registro.status,
    mensagem:
      mensagens[registro.status] ||
      `Peça identificada em fonte original (pesquisa de ${quando}, reaproveitada sem nova consulta paga).`,
    confianca: registro.confianca,
    confirmado: registro.dados_confirmados || {},
    conflitos: registro.conflitos || [],
    fontesConsultadas: registro.fontes_consultadas || [],
    fontesOficiaisUsadas: registro.fontes_oficiais || [],
    descartadas: registro.dados_descartados?.fontes || [],
    aplicacoesDescartadas: registro.dados_descartados?.aplicacoes || [],
  };
  return validado;
}

/**
 * Executa a pesquisa completa.
 * @param {string} codigoDigitado  código exatamente como o usuário digitou
 * @param {object} opcoes { provedor, cliente, armazenamento, userId, usarCache, onProgresso }
 * @returns {{ status, mensagem, validado, campos, auditoria, deCache }}
 */
export async function pesquisarFontesOriginais(codigoDigitado, opcoes = {}) {
  const {
    provedor = provedorPadrao,
    nomeProvedor = ambienteDesenvolvimento() ? "local-dev" : FUNCAO_PESQUISA,
    cliente = supabase,
    armazenamento,
    userId = null,
    usarCache = true,
    gravarNaBase = true,
    onProgresso,
  } = opcoes;

  async function gravar(validado) {
    if (!gravarNaBase) return null;
    try {
      progresso("Gravando na Base PAIIA os dados confirmados…", 90);
      return await gravarPesquisaConfirmadaNaBase(validado, { cliente });
    } catch (e) {
      console.warn("[PAIZINHO_PESQUISA] falha ao gravar na base:", e);
      return { gravado: false, inseridos: 0, reaproveitados: 0, atualizados: 0, motivo: "Falha ao gravar na base.", erro: String(e?.message || e) };
    }
  }

  const codigoPesquisado = String(codigoDigitado ?? "").trim();
  const progresso = (etapa, valor) => {
    try {
      onProgresso?.(etapa, valor);
    } catch {
      // progresso é só visual
    }
  };

  if (!codigoPesquisado) {
    return {
      status: STATUS_PESQUISA.NAO_IDENTIFICADO,
      mensagem: MENSAGENS.NAO_IDENTIFICADO,
      validado: null,
      campos: montarCamposCriarAnuncio({ codigoPesquisado, status: STATUS_PESQUISA.NAO_IDENTIFICADO }),
      auditoria: null,
      deCache: false,
    };
  }

  progresso(MENSAGENS.PESQUISANDO, 10);

  // 1. Pesquisa recente (evita repetir consulta externa)
  if (usarCache) {
    const recente = await buscarPesquisaRecente(codigoPesquisado, { cliente, armazenamento });
    if (recente) {
      const validado = resultadoDoCache(recente);
      validado.codigoPesquisado = codigoPesquisado;
      // Se da outra vez a gravação não aconteceu, tenta de novo (sem duplicar).
      const gravacaoBase =
        validado.status === STATUS_PESQUISA.ENCONTRADO || validado.status === STATUS_PESQUISA.CONFLITO
          ? await gravar(validado)
          : null;
      progresso("Pesquisa anterior reaproveitada (sem nova consulta paga).", 100);
      return {
        status: validado.status,
        mensagem: validado.mensagem,
        validado,
        campos: montarCamposCriarAnuncio(validado),
        auditoria: { id: recente.id, salvoEm: recente.origemCache, registro: recente },
        gravacaoBase,
        deCache: true,
      };
    }
  }

  // 2. Pesquisa externa
  const inicio = new Date().toISOString();
  let bruto = null;
  let erro = null;
  try {
    progresso("Consultando catálogos de montadoras e fabricantes…", 35);
    bruto = await provedor(codigoPesquisado);
  } catch (e) {
    erro = e;
    console.warn("[PAIZINHO_PESQUISA] pesquisa externa indisponível:", e?.message || e);
  }

  // 3. Validação (sempre no cliente, mesmo que o servidor já filtre)
  progresso("Conferindo fontes oficiais…", 75);
  const validado = validarResultadoPesquisa({
    codigoPesquisado,
    fontes: bruto?.fontes || [],
  });

  // Fontes que o servidor já descartou (fora da lista oficial, URL não
  // citada pela busca real, página sem o código) entram na auditoria.
  for (const d of bruto?.descartadasServidor || []) {
    const registro = {
      url: String(d?.url || ""),
      titulo: String(d?.titulo || ""),
      evidencia: String(d?.evidencia || "").slice(0, 400),
      oficial: false,
      motivo: d?.motivo || "Descartada no servidor.",
      dados: d?.dados || null,
    };
    validado.descartadas.push(registro);
    validado.fontesConsultadas.push(registro);
  }

  if (erro) {
    validado.status = STATUS_PESQUISA.INDISPONIVEL;
    validado.mensagem = erro?.mensagemUsuario || MENSAGEM_INDISPONIVEL;
  }

  // 4. Campos do anúncio (vazios quando não confirmado)
  const campos = montarCamposCriarAnuncio(
    erro ? { ...validado, status: STATUS_PESQUISA.NAO_IDENTIFICADO } : validado
  );

  // 5. Gravação na Base PAIIA (somente o que foi confirmado)
  const gravacaoBase = erro ? null : await gravar(validado);

  // 6. Auditoria (sempre, inclusive quando nada foi encontrado)
  const registro = montarRegistroAuditoria({
    codigoPesquisado,
    validado,
    bruto,
    inicio,
    fim: new Date().toISOString(),
    provedor: nomeProvedor,
    userId,
    erro,
  });
  registro.gravacao_base = gravacaoBase
    ? {
        gravado: gravacaoBase.gravado,
        inseridos: gravacaoBase.inseridos,
        reaproveitados: gravacaoBase.reaproveitados,
        atualizados: gravacaoBase.atualizados,
        motivo: gravacaoBase.motivo || "",
        erro: gravacaoBase.erro || null,
      }
    : null;
  let auditoria;
  try {
    const salvo = await registrarAuditoriaPesquisa(registro, { cliente, armazenamento });
    auditoria = { ...salvo, registro };
  } catch (e) {
    console.warn("[PAIZINHO_PESQUISA] falha ao registrar auditoria:", e);
    auditoria = { salvoEm: "nenhum", id: null, registro };
  }

  progresso("Pesquisa concluída.", 100);
  return {
    status: validado.status,
    mensagem: validado.mensagem,
    validado,
    campos,
    auditoria,
    gravacaoBase,
    deCache: false,
  };
}
