// =============================================================
// PAIIA — EXCLUIR DEFINITIVAMENTE uma ficha abandonada (Central de Publicação).
// Regras puras (sem React, sem rede). Testes:
//   scripts/testes/exclusaoFichaDefinitiva.test.mjs
//
// (27/10/2026) Exclusão DEFINITIVA, sem lixeira e sem restaurar. Quem apaga
// é SÓ a função do banco public.paiia_excluir_ficha_definitivo (transação
// única, dono conferido, todas as proteções repetidas lá). Estas regras:
//   1) decidem se a Central mostra o botão "Excluir" ou "🔒 Protegida";
//   2) antes de chamar o banco, conferem de novo a ficha relida;
//   3) dizem quando é preciso consultar o Mercado Livre (só leitura).
// Na dúvida, a ficha fica PROTEGIDA. Nada aqui apaga ou grava.
// =============================================================

export const FICHA_PROTEGIDA_FIXA = "510959620";
/** Só estes status de ficha podem ser apagados (iguais aos da função do banco). */
export const STATUS_QUE_PODEM_SER_EXCLUIDOS = Object.freeze(["rascunho", "conferencia_aprovada"]);
/** Linha de publicação só pode ir junto se estiver num destes status. */
export const STATUS_PUBLICACAO_SEGUROS = Object.freeze(["pendente", "validado"]);
/** Status do Bling que não indicam produto encontrado/vinculado/incerto. */
export const STATUS_BLING_SEGUROS = Object.freeze(["nao_verificado", "nao_encontrado", "preparado_para_criar"]);
/** Ficha com conta escolhida alterada há menos que isto: espera (o ML demora a indexar). */
export const ESPERA_ML_MINUTOS = 15;
export const TEXTO_FICHA_EXCLUIDA =
  "Esta ficha foi excluída definitivamente na Central de Publicação: nada é gravado nem publicado nela. Para continuar, comece um anúncio novo.";
export const TEXTO_CONFIRMAR_EXCLUSAO =
  "Excluir DEFINITIVAMENTE esta ficha?\n\nEla será apagada e NÃO poderá ser recuperada.\nNada é apagado no Mercado Livre, no Bling, na Base PAIIA nem nas fotos da Galeria.";

// Campos da linha de publicação que a conferência COMPLETA exige ter lido.
const CAMPOS_PUBLICACAO = Object.freeze(["mlb_id", "mlb_link", "publicado_em", "erro_publicacao", "status_publicacao", "bling_produto_id", "status_bling"]);

const txt = (v) => String(v ?? "").trim();
const norm = (v) => txt(v).toUpperCase().replace(/[^A-Z0-9]/g, "");
const tem = (obj, k) => Boolean(obj) && Object.prototype.hasOwnProperty.call(obj, k);
const preenchido = (v) => v !== undefined && v !== null && txt(v) !== "";

function publicacoesDe(row) {
  if (Array.isArray(row?.publicacoes)) return row.publicacoes.filter(Boolean);
  if (Array.isArray(row?.paiia_anuncios_publicacoes)) return row.paiia_anuncios_publicacoes.filter(Boolean);
  return row?.publicacao ? [row.publicacao] : [];
}

/** Lista/objeto com conteúdo (null, [] e {} = vazio). Igual à função do banco. */
function temConteudo(v) {
  if (v === undefined || v === null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true; // texto, número ou booleano guardado ali: não é vazio
}

/** É a ficha protegida fixa (510959620)? Código, código normalizado, título, ID ou MLB. */
export function fichaProtegidaFixa(row) {
  const alvo = FICHA_PROTEGIDA_FIXA;
  if ([row?.codigo, row?.codigo_normalizado, row?.titulo].some((v) => norm(v).includes(alvo))) return true;
  if (txt(row?.id).toLowerCase().startsWith(alvo)) return true;
  return publicacoesDe(row).some((p) => norm(p?.mlb_id).includes(alvo));
}

/** Motivo de proteção de UMA linha de publicação, ou "" se ela é segura. */
function motivoPublicacao(p, { completa, usuarioId }) {
  if (completa) {
    const falta = CAMPOS_PUBLICACAO.filter((c) => !tem(p, c));
    if (falta.length) return "Dados da publicação incompletos: ficha protegida.";
    // (27/10) Dono obrigatório: usuário logado informado e a publicação com
    // usuario_id igual a ele. Ausente ou diferente = protegida.
    if (!txt(usuarioId)) return "Usuário logado não identificado: ficha protegida.";
    if (!preenchido(p?.usuario_id)) return "Publicação sem dono registrado: ficha protegida.";
    if (txt(p.usuario_id).toLowerCase() !== txt(usuarioId).toLowerCase()) return "Publicação de outro usuário: ficha protegida.";
  }
  // Campo não lido (prévia da lista) não decide; campo lido decide.
  if (preenchido(p?.mlb_id)) return "Publicada no Mercado Livre.";
  if (preenchido(p?.mlb_link)) return "Tem link de anúncio no Mercado Livre: ficha protegida.";
  if (preenchido(p?.publicado_em)) return "Tem data de publicação: ficha protegida.";
  if (preenchido(p?.erro_publicacao)) return "Tentativa de publicação com erro: o anúncio pode ter sido criado no Mercado Livre. Ficha protegida.";
  if (tem(p, "status_publicacao") && !STATUS_PUBLICACAO_SEGUROS.includes(txt(p.status_publicacao))) {
    return txt(p.status_publicacao) === "erro"
      ? "Tentativa de publicação com erro: o anúncio pode ter sido criado no Mercado Livre. Ficha protegida."
      : "Situação da publicação não permite excluir: ficha protegida.";
  }
  if (p?.bling_produto_id !== undefined && p?.bling_produto_id !== null && txt(p.bling_produto_id) !== "") return "Tem produto vinculado no Bling.";
  if (tem(p, "status_bling") && !STATUS_BLING_SEGUROS.includes(txt(p.status_bling))) {
    return "Situação no Bling encontrada, vinculada, incerta ou desconhecida: ficha protegida.";
  }
  return "";
}

/**
 * Pode ser excluída definitivamente?
 * row: ficha (id, codigo, codigo_normalizado, titulo, status_fluxo,
 *      conta_destino_ml_user_id, updated_at, dados_conferencia ou os campos
 *      soltos mlbs_anteriores / versoes_substituidas / integracao_bling /
 *      base_paiia, e publicacoes[] / paiia_anuncios_publicacoes[] / publicacao)
 * opcoes:
 *   completa    true = ficha relida da base com TODOS os campos (antes de
 *               apagar): campo que falta protege. false = prévia da lista.
 *   registrosMLB linhas do registro interno ligadas a ESTA ficha
 *   usuarioId   usuário logado: na leitura completa é OBRIGATÓRIO e cada
 *               publicação precisa ter usuario_id igual a ele
 *   agora       relógio (testes)
 * Devolve { pode, motivo, consultarML, contaML, codigos }.
 */
export function avaliarExclusao(row, { completa = false, registrosMLB = [], usuarioId = "", agora = Date.now() } = {}) {
  const r = row || {};
  const nao = (motivo) => ({ pode: false, motivo, consultarML: false, contaML: "", codigos: [] });
  if (!txt(r.id)) return nao("Ficha sem ID.");
  if (completa && !txt(usuarioId)) return nao("Usuário logado não identificado: ficha protegida.");
  if (fichaProtegidaFixa(r)) return nao("Ficha protegida (510959620).");

  const status = txt(r.status_fluxo);
  if (!STATUS_QUE_PODEM_SER_EXCLUIDOS.includes(status)) {
    if (["publicado", "publicado_com_pendencia", "publicando"].includes(status)) return nao("Publicada ou em publicação.");
    if (status === "erro_publicacao") return nao("Tentativa de publicação com erro: o anúncio pode ter sido criado no Mercado Livre. Ficha protegida.");
    return nao(`Situação da ficha não permite excluir (${status || "vazia"}): protegida.`);
  }

  const pubs = publicacoesDe(r);
  for (const p of pubs) {
    const m = motivoPublicacao(p, { completa, usuarioId });
    if (m) return nao(m);
  }

  // Dados da ficha: na leitura completa, dados_conferencia tem de ser um objeto.
  let d = r.dados_conferencia;
  if (completa && (d === null || typeof d !== "object" || Array.isArray(d))) return nao("Dados da ficha em formato inesperado: protegida.");
  if (!d || typeof d !== "object" || Array.isArray(d)) d = {};
  const campo = (k) => (tem(d, k) ? d[k] : r[k]);
  if (temConteudo(campo("mlbs_anteriores"))) return nao("Tem histórico de MLB anterior.");
  if (temConteudo(campo("versoes_substituidas"))) return nao("Tem versões anteriores registradas.");
  // Igual ao banco: integração só é "vazia" se ausente, null ou {} ([] protege).
  const integ = campo("integracao_bling");
  if (integ !== undefined && integ !== null && !(typeof integ === "object" && !Array.isArray(integ) && !Object.keys(integ).length)) {
    return nao("Tem integração com o Bling.");
  }
  const base = campo("base_paiia");
  if (base && typeof base === "object") {
    if (base.gravacao !== undefined && base.gravacao !== null) return nao("Gravou dados na Base PAIIA: ficha protegida.");
    if (txt(base.decisao) === "autorizado") return nao("Autorizada a gravar na Base PAIIA: ficha protegida.");
  }
  if ((Array.isArray(registrosMLB) ? registrosMLB : []).some(Boolean)) return nao("Tem MLB no registro interno de anúncios.");

  // Conta escolhida ou linha de publicação sem MLB: pode ter havido tentativa
  // interrompida (aba fechada, queda). Confere no ML (só leitura) antes.
  const contaML = txt(pubs.find((p) => txt(p?.ml_user_id))?.ml_user_id) || txt(r.conta_destino_ml_user_id);
  if (contaML || pubs.length) {
    const datas = [r.updated_at, ...pubs.map((p) => p?.updated_at)].map((x) => Date.parse(x || "")).filter(Number.isFinite);
    const ultima = datas.length ? Math.max(...datas) : NaN;
    if (!Number.isFinite(ultima) || agora - ultima < ESPERA_ML_MINUTOS * 60 * 1000) {
      return nao(`Ficha com conta do Mercado Livre alterada há menos de ${ESPERA_ML_MINUTOS} minutos: aguarde e tente de novo.`);
    }
    if (!contaML) return nao("Linha de publicação sem conta: situação incerta, ficha protegida.");
    const codigos = [...new Set([...pubs.map((p) => txt(p?.sku)), txt(r.codigo)].filter(Boolean))];
    if (!codigos.length) return nao("Ficha sem código para conferir no Mercado Livre: protegida.");
    return { pode: true, motivo: "", consultarML: true, contaML, codigos };
  }
  return { pode: true, motivo: "", consultarML: false, contaML: "", codigos: [] };
}

/**
 * Resultado da conferência no ML (verificarDuplicidadeML) → libera?
 * mlbsDeOutrasFichas: MLBs que a base já liga a OUTRAS fichas (não prendem esta).
 */
export function liberaPelaConsultaML(resultado, mlbsDeOutrasFichas = []) {
  if (!resultado || resultado.erro || !resultado.verificado) {
    return { libera: false, motivo: `Não foi possível confirmar no Mercado Livre${resultado?.erro ? ` (${resultado.erro})` : ""}: ficha protegida.` };
  }
  const deOutras = new Set((mlbsDeOutrasFichas || []).map(norm));
  const achados = [...(resultado.duplicados || []), ...(resultado.possiveis || [])].map((x) => norm(x?.id)).filter(Boolean);
  const semDono = achados.filter((m) => !deOutras.has(m));
  if (semDono.length) return { libera: false, motivo: `Existe anúncio deste código na conta do Mercado Livre sem ficha correspondente (${semDono.join(", ")}): ficha protegida.` };
  return { libera: true, motivo: "" };
}

const MENSAGENS_FUNCAO = Object.freeze({
  apagada: "Ficha excluída definitivamente.",
  sem_sessao: "Sessão expirada: entre de novo no PAIIA.",
  parametros: "Ficha ou versão não informada: nada foi apagado.",
  nao_encontrada: "Ficha não encontrada: nada foi apagado.",
  versao_alterada: "A ficha mudou em outro computador ou aba: nada foi apagado. Atualize a lista.",
  status_protegido: "Ficha publicada, em publicação, com erro de publicação ou cancelada: protegida.",
  ficha_510959620: "Ficha protegida (510959620).",
  publicacao_vinculada: "A ficha tem publicação, MLB, link, erro de publicação ou Bling registrado: protegida.",
  registro_mlb: "A ficha tem MLB no registro interno: protegida.",
  historico_mlb: "A ficha tem histórico de MLB ou versões anteriores: protegida.",
  integracao_bling: "A ficha tem integração com o Bling: protegida.",
  base_paiia: "A ficha gravou (ou está autorizada a gravar) dados na Base PAIIA: protegida.",
  lote_base_paiia: "A ficha aparece num lote da Base PAIIA: protegida.",
  dados_inesperados: "Dados da ficha em formato inesperado: protegida.",
});

/** Resposta da função do banco → { ok, apagada, conflito, protegida, motivo, mensagem }. */
export function lerRespostaExclusao(resposta) {
  const r = resposta && typeof resposta === "object" ? resposta : null;
  if (!r) return { ok: false, apagada: false, conflito: false, protegida: true, motivo: "sem_resposta", mensagem: "Sem resposta do banco: nada foi apagado." };
  const motivo = txt(r.motivo) || "desconhecido";
  const apagada = r.ok === true && motivo === "apagada";
  return {
    ok: apagada,
    apagada,
    conflito: motivo === "versao_alterada",
    protegida: !apagada && !["sem_sessao", "parametros", "versao_alterada", "nao_encontrada"].includes(motivo),
    motivo,
    mensagem: txt(r.mensagem) || MENSAGENS_FUNCAO[motivo] || "Exclusão recusada pelo banco: nada foi apagado.",
  };
}

/**
 * Rascunho guardado NESTE navegador que pertence à ficha apagada: sai, para o
 * "Retomar" não trazer a ficha de volta. Só remove o que tem o MESMO ID de
 * ficha (rascunho novo do mesmo código continua). Devolve as chaves removidas.
 */
export function descartarRascunhoLocalDaFicha(storage, fichaId, { chaveGuardada, chavesLocais = [] } = {}) {
  const id = txt(fichaId).toLowerCase();
  const removidas = [];
  if (!id || !storage) return removidas;
  const ler = (c) => {
    try {
      const t = storage.getItem(c);
      return t ? JSON.parse(t) : null;
    } catch {
      return null;
    }
  };
  const doId = (dd) => [dd?.fichaIdPAIIA, dd?.fichaId, dd?.resumo?.fichaId].some((x) => txt(x).toLowerCase() === id);
  for (const c of [chaveGuardada, ...chavesLocais].filter(Boolean)) {
    if (doId(ler(c))) {
      try {
        storage.removeItem(c);
        removidas.push(c);
      } catch {
        // sem acesso: nada muda
      }
    }
  }
  return removidas;
}
