import { supabase } from "../supabase";
import { verificarDuplicidadeML } from "./duplicidadeML";
import { avaliarExclusao, liberaPelaConsultaML, lerRespostaExclusao } from "./exclusaoFicha";

// =============================================================
// PAIIA — EXCLUIR DEFINITIVAMENTE uma ficha (Central de Publicação).
// Testes: scripts/testes/exclusaoFichaService.test.mjs
//
// (27/10/2026) Este serviço NÃO apaga nada por conta própria. Ele:
//   1) relê a ficha, TODAS as linhas de publicação e os registros de MLB
//      ligados a ela (somente leitura);
//   2) confere tudo com as regras de exclusaoFicha.js (leitura completa);
//   3) se a ficha tem conta do ML, consulta o Mercado Livre (só GET);
//   4) chama a função do banco public.paiia_excluir_ficha_definitivo, que
//      confere tudo de novo numa única transação e só então apaga.
// QUALQUER falha de leitura bloqueia: falha nunca vira "lista vazia".
// =============================================================

export const NOME_FUNCAO_EXCLUSAO = "paiia_excluir_ficha_definitivo";

const CAMPOS_FICHA =
  "id, usuario_id, codigo, codigo_normalizado, titulo, status_fluxo, conta_destino_ml_user_id, conta_destino_nome, updated_at, dados_conferencia";
const CAMPOS_PUBLICACAO =
  "id, anuncio_id, usuario_id, marketplace, ml_user_id, sku, mlb_id, mlb_link, publicado_em, erro_publicacao, status_publicacao, bling_produto_id, status_bling, updated_at";

const protegida = (erro, extra = {}) => ({ ok: false, apagada: false, protegida: true, erro, ...extra });
const txt = (v) => String(v ?? "").trim();

async function usuarioAtual() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) return { ok: false, erro: error.message || "sessão indisponível" };
    const id = txt(data?.user?.id);
    return id ? { ok: true, id } : { ok: false, erro: "sem usuário logado" };
  } catch (e) {
    return { ok: false, erro: e?.message || "sessão indisponível" };
  }
}

/** Lê UMA consulta e exige resposta válida (sem erro e com lista). */
async function lerLista(promessa, nome) {
  try {
    const { data, error } = await promessa;
    if (error) return { ok: false, erro: `${nome}: ${error.message || "falha na leitura"}` };
    if (!Array.isArray(data)) return { ok: false, erro: `${nome}: resposta inválida` };
    return { ok: true, lista: data };
  } catch (e) {
    return { ok: false, erro: `${nome}: ${e?.message || "falha na leitura"}` };
  }
}

// (27/10) Leitura COMPLETA, sem truncamento pelo limite de linhas do Supabase:
// paginação por id (ordem estável) com a contagem exata do banco. Só vale se
// TODAS as linhas contadas forem lidas, sem repetição e sem a contagem mudar
// no meio. Qualquer diferença = { ok:false } (a exclusão é bloqueada).
export const TAMANHO_PAGINA = 500;
export const MAX_PAGINAS = 40;
/** Quantos MLBs por consulta "in" (evita endereço longo demais). */
export const MLBS_POR_CONSULTA = 50;

async function lerTudo(montar, nome) {
  const lista = [];
  const vistos = new Set();
  let total = null;
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const inicio = lista.length; // continua de onde parou (servidor pode devolver menos que o pedido)
    let resp;
    try {
      resp = await montar().order("id", { ascending: true }).range(inicio, inicio + TAMANHO_PAGINA - 1);
    } catch (e) {
      return { ok: false, erro: `${nome}: ${e?.message || "falha na leitura"}` };
    }
    const { data, error, count } = resp || {};
    if (error) return { ok: false, erro: `${nome}: ${error.message || "falha na leitura"}` };
    if (!Array.isArray(data)) return { ok: false, erro: `${nome}: resposta inválida` };
    if (!Number.isInteger(count) || count < 0) return { ok: false, erro: `${nome}: contagem de linhas indisponível` };
    if (total === null) total = count;
    else if (count !== total) return { ok: false, erro: `${nome}: os registros mudaram durante a leitura` };
    if (data.length > TAMANHO_PAGINA) return { ok: false, erro: `${nome}: página maior que a pedida` };
    for (const linha of data) {
      const id = txt(linha?.id);
      if (!id || vistos.has(id)) return { ok: false, erro: `${nome}: leitura repetida ou sem id` };
      vistos.add(id);
      lista.push(linha);
    }
    if (lista.length > total) return { ok: false, erro: `${nome}: mais linhas que a contagem` };
    if (lista.length === total) return { ok: true, lista, total };
    if (!data.length) return { ok: false, erro: `${nome}: leitura incompleta (${lista.length} de ${total})` };
  }
  return { ok: false, erro: `${nome}: registros demais para conferir (${total ?? "?"}): ficha protegida` };
}

/** Relê a ficha e TUDO o que a regra precisa. Falha em qualquer parte = { ok:false }. */
export async function lerFichaParaExclusao(fichaId) {
  const id = txt(fichaId);
  if (!id) return { ok: false, erro: "Ficha sem ID." };
  const fichas = await lerLista(supabase.from("paiia_anuncios").select(CAMPOS_FICHA).eq("id", id).limit(2), "ficha");
  if (!fichas.ok) return { ok: false, erro: fichas.erro };
  if (fichas.lista.length === 0) return { ok: false, naoEncontrada: true, erro: "Ficha não encontrada: nada foi apagado." };
  if (fichas.lista.length > 1) return { ok: false, erro: "ficha: resposta inesperada (mais de uma)" };
  const pubs = await lerTudo(() => supabase.from("paiia_anuncios_publicacoes").select(CAMPOS_PUBLICACAO, { count: "exact" }).eq("anuncio_id", id), "publicações");
  if (!pubs.ok) return { ok: false, erro: pubs.erro };
  const regs = await lerTudo(() => supabase.from("paiia_registro_mlb").select("id, mlb_id, ml_user_id, anuncio_id", { count: "exact" }).eq("anuncio_id", id), "registro de MLBs");
  if (!regs.ok) return { ok: false, erro: regs.erro };
  return { ok: true, ficha: { ...fichas.lista[0], publicacoes: pubs.lista }, registros: regs.lista };
}

/** MLBs achados no ML que a base liga a OUTRAS fichas. Falha = { ok:false }. */
async function mlbsDeOutrasFichas(fichaId, mlbs) {
  const lista = [...new Set((mlbs || []).map((m) => txt(m).toUpperCase()).filter(Boolean))];
  if (!lista.length) return { ok: true, mlbs: [] };
  const linhas = [];
  for (let i = 0; i < lista.length; i += MLBS_POR_CONSULTA) {
    const bloco = lista.slice(i, i + MLBS_POR_CONSULTA);
    const a = await lerTudo(() => supabase.from("paiia_anuncios_publicacoes").select("id, anuncio_id, mlb_id", { count: "exact" }).in("mlb_id", bloco), "publicações dos MLBs");
    if (!a.ok) return { ok: false, erro: a.erro };
    const b = await lerTudo(() => supabase.from("paiia_registro_mlb").select("id, anuncio_id, mlb_id", { count: "exact" }).in("mlb_id", bloco), "registro dos MLBs");
    if (!b.ok) return { ok: false, erro: b.erro };
    linhas.push(...a.lista, ...b.lista);
  }
  const deOutras = linhas
    .filter((x) => txt(x?.anuncio_id) && txt(x.anuncio_id) !== txt(fichaId))
    .map((x) => txt(x.mlb_id).toUpperCase());
  return { ok: true, mlbs: deOutras };
}

/** Consulta de LEITURA ao Mercado Livre (mesmo formato da Publicação). */
function consultarML(conta) {
  return async (caminho) => {
    try {
      const { data, error } = await supabase.functions.invoke("mercadolivre-publicacao", {
        body: { acao: "ml_consulta", conta_ml: String(conta), metodo: "GET", caminho },
      });
      if (error) return { ok: false, erro: error.message || "Falha ao falar com o servidor." };
      return data || { ok: false, erro: "Resposta vazia do servidor." };
    } catch (e) {
      return { ok: false, erro: e?.message || "Falha ao falar com o servidor." };
    }
  };
}

/**
 * Exclui DEFINITIVAMENTE uma ficha, se for comprovadamente segura.
 * Devolve { ok, apagada, protegida, conflito, naoEncontrada, motivo, erro }.
 * Só a função do banco apaga; aqui nada é gravado.
 */
export async function excluirFichaDefinitivamente(fichaId, { agora = Date.now(), consultar = null } = {}) {
  const usuario = await usuarioAtual();
  if (!usuario.ok) return protegida(`Sessão expirada ou indisponível (${usuario.erro}): entre de novo no PAIIA. Nada foi apagado.`);

  const lida = await lerFichaParaExclusao(fichaId);
  if (!lida.ok) {
    if (lida.naoEncontrada) return { ok: false, apagada: false, protegida: false, naoEncontrada: true, erro: lida.erro };
    return protegida(`Não foi possível conferir a ficha (${lida.erro}): nada foi apagado.`);
  }
  const { ficha, registros } = lida;
  if (txt(ficha.usuario_id) !== usuario.id) return protegida("Ficha de outro usuário: nada foi apagado.");

  const av = avaliarExclusao(ficha, { completa: true, registrosMLB: registros, usuarioId: usuario.id, agora });
  if (!av.pode) return protegida(av.motivo);

  if (av.consultarML) {
    let r;
    try {
      r = await verificarDuplicidadeML({ conta: av.contaML, codigos: av.codigos, consultar: consultar || consultarML(av.contaML) });
    } catch (e) {
      r = { erro: e?.message || "falha na consulta" };
    }
    let outras = { ok: true, mlbs: [] };
    if (r && !r.erro && r.verificado) {
      const achados = [...(r.duplicados || []), ...(r.possiveis || [])].map((x) => x?.id);
      outras = await mlbsDeOutrasFichas(ficha.id, achados);
      if (!outras.ok) return protegida(`Não foi possível conferir a base PAIIA (${outras.erro}): nada foi apagado.`);
    }
    const lib = liberaPelaConsultaML(r, outras.mlbs);
    if (!lib.libera) return protegida(lib.motivo);
  }

  let resposta;
  try {
    const { data, error } = await supabase.rpc(NOME_FUNCAO_EXCLUSAO, { p_ficha_id: ficha.id, p_versao: ficha.updated_at });
    if (error) return protegida(`O banco recusou a exclusão (${error.message || "erro"}): nada foi apagado.`);
    resposta = data;
  } catch (e) {
    return protegida(`Falha ao falar com o banco (${e?.message || "erro"}): nada foi apagado.`);
  }
  const r = lerRespostaExclusao(resposta);
  return {
    ok: r.apagada,
    apagada: r.apagada,
    protegida: r.protegida,
    conflito: r.conflito,
    naoEncontrada: r.motivo === "nao_encontrada",
    motivo: r.motivo,
    fichaId: ficha.id,
    erro: r.apagada ? "" : r.mensagem,
    mensagem: r.mensagem,
  };
}
