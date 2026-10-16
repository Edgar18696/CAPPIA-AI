/*
 * PAIIA — REGISTRO INTERNO DE ANÚNCIOS (paiia_registro_mlb) — regras puras.
 *
 * Uma linha por MLB (conta + MLB + SKU), permanente. Aqui ficam só as
 * decisões (sem rede, sem banco):
 *  - situação de um MLB registrado conforme o Mercado Livre responde AGORA;
 *  - situação de cada conta para um SKU (registro + busca ao vivo);
 *  - o que gravar no registro (novos MLBs confirmados e conferências).
 *
 * Regras de segurança:
 *  - Falha/demora/MLB não encontrado/vendedor diferente = PENDENTE (nunca
 *    "não existe", nunca libera publicação).
 *  - Pausado, em revisão e inativo continuam EXISTINDO (bloqueiam a conta).
 *  - Encerrado/excluído no histórico NÃO prova que não há outro anúncio:
 *    a conta só fica livre com a busca ao vivo concluída sem anúncio.
 *  - Linhas de histórico (encerrado/excluído) nunca são alteradas.
 *  - Só é registrado automaticamente o que o ML confirma com o MESMO SKU,
 *    na MESMA conta (vendedor). Semelhança só com confirmação do usuário.
 */
import { normalizarCodigoComparacao, skusDoAnuncio } from "./duplicidadeML.js";

export const SITUACOES_FINAIS = Object.freeze(["encerrado", "excluido"]);
export const SITUACOES_EXISTENTES = Object.freeze(["ativo", "pausado", "em_revisao", "inativo"]);

export const ESTADO_CONTA = Object.freeze({
  PUBLICADO: "publicado", // já tem anúncio (ativo, pausado...) — bloqueia publicar nesta conta
  POSSIVEL: "possivel", // anúncio parecido: precisa da conferência do usuário
  LIVRE: "livre", // busca ao vivo concluída: nenhum anúncio deste SKU nesta conta
  PENDENTE: "pendente", // não foi possível confirmar — bloqueia
});

export const TEXTO_PENDENTE = "Verificação pendente";

const txt = (v) => String(v ?? "").trim();
export const normalizarSku = (v) => normalizarCodigoComparacao(v);
export const situacaoFinal = (s) => SITUACOES_FINAIS.includes(String(s || ""));

/** Situação do registro a partir do anúncio lido no ML. */
export function situacaoDoItemML(item) {
  const st = String(item?.status || "").toLowerCase();
  const sub = Array.isArray(item?.sub_status) ? item.sub_status.map((s) => String(s).toLowerCase()) : [];
  if (sub.includes("deleted")) return "excluido";
  if (st === "closed") return "encerrado";
  if (st === "active") return "ativo";
  if (st === "paused") return "pausado";
  if (st === "under_review") return "em_revisao";
  if (st === "inactive") return "inativo";
  return "desconhecida";
}

/**
 * Um MLB do registro conferido no ML agora.
 * resp = ml_consulta GET /items/<MLB> na conta do registro.
 * Devolve { mlb, conta, estado: "existe"|"historico"|"pendente", situacao,
 *           motivo, atualizar: campos|null }.
 */
export function avaliarMLBRegistrado({ registro, resp, agora = new Date().toISOString() }) {
  const mlb = txt(registro?.mlb_id).toUpperCase();
  const conta = txt(registro?.ml_user_id);
  const base = { mlb, conta, situacao: txt(registro?.situacao) || "desconhecida", atualizar: null };
  // Histórico: não é reconsultado nem alterado. Não bloqueia por si só,
  // e também não prova que não há outro anúncio (isso é da busca ao vivo).
  if (situacaoFinal(registro?.situacao)) return { ...base, estado: "historico", motivo: "encerrado/excluído (histórico)" };
  if (!resp || resp.ok !== true) {
    const http = Number(resp?.status) || 0;
    const nao = http === 404 || /not.?found|não encontrad/i.test(String(resp?.erro || ""));
    return { ...base, estado: "pendente", motivo: nao ? "o Mercado Livre não encontrou este MLB" : `Mercado Livre sem resposta segura (${txt(resp?.erro).slice(0, 100) || "erro"})` };
  }
  const it = resp.dados;
  if (!it || typeof it !== "object" || txt(it.id).toUpperCase() !== mlb) return { ...base, estado: "pendente", motivo: "resposta ambígua do Mercado Livre" };
  if (txt(it.seller_id) !== conta) return { ...base, estado: "pendente", motivo: `vendedor diferente no Mercado Livre (${txt(it.seller_id) || "—"})` };
  const situacao = situacaoDoItemML(it);
  if (situacao === "desconhecida") return { ...base, estado: "pendente", motivo: "situação desconhecida no Mercado Livre" };
  const skus = skusDoAnuncio(it).map(normalizarSku).filter(Boolean);
  const skuReg = txt(registro?.sku_normalizado);
  const atualizar = {
    situacao,
    situacao_ml: { status: it.status ?? null, sub_status: Array.isArray(it.sub_status) ? it.sub_status : [] },
    conferido_em: agora,
  };
  if (skus.length && skuReg && !skus.includes(skuReg)) atualizar.sku_ml_divergente = skusDoAnuncio(it)[0] || null;
  if (skus.includes(skuReg) && registro?.sku_confirmado === false) atualizar.sku_confirmado = true;
  return {
    ...base,
    situacao,
    estado: situacaoFinal(situacao) ? "historico" : "existe",
    motivo: situacaoFinal(situacao) ? "encerrado/excluído confirmado agora pelo Mercado Livre" : "",
    divergente: Boolean(atualizar.sku_ml_divergente),
    atualizar,
  };
}

/**
 * Situação de UMA conta para o SKU.
 * - registrosConta: linhas do registro desta conta;
 * - avaliados: avaliarMLBRegistrado de cada uma;
 * - busca: resultado de verificarDuplicidadeML (ou { erro });
 * - conectada / erroRegistro: falhas que deixam pendente.
 */
export function decidirConta({ conta, nome = "", conectada = true, motivoConta = "", erroRegistro = "", avaliados = [], busca = null }) {
  const historico = avaliados.filter((a) => a.estado === "historico").map((a) => ({ mlb: a.mlb, situacao: a.situacao }));
  const existentes = avaliados.filter((a) => a.estado === "existe").map((a) => ({ mlb: a.mlb, situacao: a.situacao, status: a.atualizar?.situacao_ml?.status || "", divergente: Boolean(a.divergente), registrado: true }));
  const pendentesReg = avaliados.filter((a) => a.estado === "pendente").map((a) => ({ mlb: a.mlb, motivo: a.motivo }));
  const doRegistro = new Set(avaliados.map((a) => a.mlb));
  const daBusca = (lista) => (Array.isArray(lista) ? lista : []).map((d) => ({ mlb: txt(d?.id).toUpperCase(), status: txt(d?.status), titulo: txt(d?.titulo), motivo: txt(d?.motivo) }));
  const confirmadosBusca = busca && !busca.erro ? daBusca(busca.duplicados) : [];
  const possiveis = busca && !busca.erro ? daBusca(busca.possiveis).filter((p) => !doRegistro.has(p.mlb)) : [];
  const novos = confirmadosBusca.filter((d) => !doRegistro.has(d.mlb));
  const base = { conta: txt(conta), nome, historico, registrados: avaliados.length };
  const anuncios = [
    ...existentes,
    // Busca ao vivo achou anúncio NÃO encerrado com o mesmo SKU: existe,
    // mesmo que o registro o tenha como histórico (a busca é a palavra final).
    ...confirmadosBusca.filter((d) => !existentes.some((e) => e.mlb === d.mlb))
      .map((d) => ({ mlb: d.mlb, situacao: situacaoDoItemML({ status: d.status }), status: d.status, titulo: d.titulo, motivo: d.motivo, registrado: doRegistro.has(d.mlb) })),
  ];
  const motivos = [];
  if (!conectada) motivos.push(motivoConta || "conta não conectada ao PAIIA");
  if (erroRegistro) motivos.push(`registro interno indisponível (${erroRegistro})`);
  if (!busca) motivos.push("busca no Mercado Livre não realizada");
  else if (busca.erro) motivos.push(busca.erro);
  for (const p of pendentesReg) motivos.push(`${p.mlb}: ${p.motivo}`);
  // Anúncio existente confirmado: a conta está OCUPADA (mesmo com outras pendências).
  if (anuncios.length) return { ...base, estado: ESTADO_CONTA.PUBLICADO, anuncios, possiveis, novos, pendencias: motivos };
  if (motivos.length) return { ...base, estado: ESTADO_CONTA.PENDENTE, anuncios: [], possiveis, novos: [], pendencias: motivos, motivo: motivos.join("; ") };
  if (possiveis.length) return { ...base, estado: ESTADO_CONTA.POSSIVEL, anuncios: [], possiveis, novos: [], pendencias: [] };
  if (busca?.verificado === true) return { ...base, estado: ESTADO_CONTA.LIVRE, anuncios: [], possiveis: [], novos: [], pendencias: [] };
  return { ...base, estado: ESTADO_CONTA.PENDENTE, anuncios: [], possiveis: [], novos: [], pendencias: ["busca sem confirmação"], motivo: "busca sem confirmação" };
}

/** Linha nova para o registro (MLB confirmado pelo ML com o mesmo SKU). */
export function linhaConfirmadaML({ sku, conta, contaNome = "", mlb, status, agora = new Date().toISOString() }) {
  const s = txt(sku);
  return {
    sku: s,
    sku_normalizado: normalizarSku(s),
    sku_confirmado: true,
    ml_user_id: txt(conta),
    conta_nome: contaNome || null,
    mlb_id: txt(mlb).toUpperCase(),
    situacao: situacaoDoItemML({ status }) === "desconhecida" ? "desconhecida" : situacaoDoItemML({ status }),
    situacao_ml: { status: status || null },
    origem: "confirmado_ml",
    conferido_em: agora,
  };
}

/** Linha para o registro de um anúncio PARECIDO confirmado pelo usuário. */
export function linhaConfirmadaUsuario({ sku, conta, contaNome = "", mlb, status }) {
  const s = txt(sku);
  return {
    sku: s,
    sku_normalizado: normalizarSku(s),
    sku_confirmado: false, // o SKU do anúncio não comprova o código: fica pendente
    ml_user_id: txt(conta),
    conta_nome: contaNome || null,
    mlb_id: txt(mlb).toUpperCase(),
    situacao: situacaoDoItemML({ status }),
    situacao_ml: { status: status || null },
    origem: "confirmado_usuario",
    conferido_em: null,
  };
}

/** Linha para o registro de um anúncio que o PAIIA acabou de publicar. */
export function linhaPublicadaPAIIA({ sku, conta, contaNome = "", mlb, anuncioId = null, blingProdutoId = null, agora = new Date().toISOString() }) {
  const s = txt(sku);
  const bling = Number(blingProdutoId);
  return {
    sku: s,
    sku_normalizado: normalizarSku(s),
    sku_confirmado: false, // vira true só depois da verificação pós-publicação sem pendência
    ml_user_id: txt(conta),
    conta_nome: contaNome || null,
    mlb_id: txt(mlb).toUpperCase(),
    bling_produto_id: Number.isFinite(bling) && bling > 0 ? bling : null,
    situacao: "ativo",
    situacao_ml: { status: "active", origem: "resposta da publicação" },
    origem: "publicado_paiia",
    anuncio_id: anuncioId || null,
    conferido_em: agora,
  };
}

/** Linha do registro válida para gravar? (mesmas regras do banco) */
export function linhaValida(l) {
  return Boolean(
    l && txt(l.sku) && l.sku_normalizado && l.sku_normalizado === normalizarSku(l.sku)
    && /^[0-9]{3,20}$/.test(txt(l.ml_user_id)) && /^MLB[0-9]{6,15}$/.test(txt(l.mlb_id))
    && typeof l.sku_confirmado === "boolean" && !(l.origem === "confirmado_ml" && !l.sku_confirmado)
  );
}

/** Campos que a conferência pode atualizar (nunca a identidade). */
export const CAMPOS_ATUALIZAVEIS = Object.freeze(["situacao", "situacao_ml", "conferido_em", "sku_confirmado", "sku_ml_divergente", "conta_nome", "bling_produto_id", "anuncio_id"]);
export function camposAtualizaveis(campos) {
  const out = {};
  for (const k of CAMPOS_ATUALIZAVEIS) if (campos && campos[k] !== undefined) out[k] = campos[k];
  if (out.sku_confirmado === false) delete out.sku_confirmado; // nunca volta a pendente
  return out;
}

/**
 * Registros que BLOQUEIAM publicar nesta conta (para a Publicação):
 * todos os que não são histórico (encerrado/excluído). Cada um é
 * conferido ao vivo no ML; só "encerrado/excluído confirmado" libera.
 */
export function registrosQueBloqueiam(registros, conta) {
  return (Array.isArray(registros) ? registros : []).filter((r) => txt(r?.ml_user_id) === txt(conta) && !situacaoFinal(r?.situacao));
}
