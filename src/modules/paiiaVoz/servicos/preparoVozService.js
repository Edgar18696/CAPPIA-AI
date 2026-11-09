// =============================================================
// PAIIA Voz — Etapa 2: grava o PREPARO da Conferência na MESMA ficha
// (paiia_anuncios.dados_conferencia.paiia_voz.preparo) e liga as consultas
// reais (somente leitura) às conferências. Não publica, não cria nada no
// Bling, não confirma categoria sozinho e não mexe na ficha da Conferência.
// =============================================================
import { supabase } from "../../../supabase";
import { lerFichaNovoAnuncio } from "../../../services/fichaNovoAnuncioService";
import { fichaFechada, fichaSoNoNovoAnuncio } from "../../../services/fichaNovoAnuncio";
import { lerJsonPublico } from "../../../services/categoriaMLBusca";
import { listarAnunciosDoCodigo, conferirDuplicidadeBase } from "../../../services/anuncioPublicacaoService";
import { modalidadesDaConta } from "../../../services/consultaMLLeitura";
import { prepararConferenciaVoz, confirmarCategoriaSugerida, buscarCategoriasVoz, confirmarCategoriaEscolhida, conferirSoCategoriaVoz } from "./preparoConferenciaVoz";
import { mesclarPreparo, atributoNoPreparo } from "./preparoFicha";
import { aprovarRevisao, comModalidade, comRevisao } from "./revisaoCelularVoz";

async function chamarPublicacao(corpo) {
  if (!corpo?.conta_ml) return { ok: false, erro: "Sem conta Mercado Livre selecionada." };
  const { data, error } = await supabase.functions.invoke("mercadolivre-publicacao", { body: corpo });
  if (error) return { ok: false, erro: error.message || "Falha ao falar com o servidor." };
  return data || { ok: false, erro: "Resposta vazia do servidor." };
}
async function lerSaldoBling(sku) {
  // Mesma leitura da Publicação (saldo_por_sku): só lê, nunca cria.
  const { data } = await supabase.functions.invoke("bling-integracao", { body: { acao: "saldo_por_sku", sku } });
  return data || { ok: false };
}
export const depsReais = { lerJson: lerJsonPublico, chamarPublicacao, listarFichas: listarAnunciosDoCodigo, conferirDuplicidadeBase, lerSaldoBling, modalidadesDaConta };

/** mudar(row) → novo preparo (atalho) ; transformar(dados,row) → novo dados_conferencia. */
async function gravar(fichaId, mudar, transformar = (dados, row) => mesclarPreparo(dados, mudar(row))) {
  const r = await lerFichaNovoAnuncio(fichaId);
  if (!r.ok) return { ok: false, erro: r.erro || "Ficha não encontrada." };
  if (fichaFechada(r.ficha)) return { ok: false, erro: "Esta ficha já foi publicada ou cancelada." };
  if (!fichaSoNoNovoAnuncio(r.ficha)) return { ok: false, erro: "Esta ficha já está na Conferência do computador: o PAIIA Voz não altera mais." };
  const dados = transformar(r.ficha.dados_conferencia, r.ficha);
  if (!dados || dados.erro) return { ok: false, erro: dados?.erro || "Nada para gravar." };
  // Só grava se ninguém mexeu na ficha desde a leitura (celular × computador).
  const { data, error } = await supabase.from("paiia_anuncios").update({ dados_conferencia: dados, updated_at: new Date().toISOString() }).eq("id", fichaId).eq("updated_at", r.ficha.updated_at).select("id");
  if (error) return { ok: false, erro: error.message || "Falha ao gravar." };
  if (!Array.isArray(data) || !data.length) return { ok: false, conflito: true, erro: "A ficha mudou enquanto o PAIIA conferia: confira de novo." };
  return { ok: true, ficha: { ...r.ficha, dados_conferencia: dados } };
}

/** Roda as conferências (leitura) e grava o resultado na ficha. */
export async function prepararEGravar(fichaId, { conta = "" } = {}) {
  const r = await lerFichaNovoAnuncio(fichaId);
  if (!r.ok) return { ok: false, erro: r.erro || "Ficha não encontrada." };
  const preparo = await prepararConferenciaVoz(r.ficha, { conta, deps: depsReais });
  const g = await gravar(fichaId, () => preparo);
  return g.ok ? { ok: true, preparo } : { ...g, preparo };
}

/**
 * (Rodada 1 — etapa 7) Confere SÓ a categoria e grava na mesma ficha, sem mexer nas outras
 * conferências: a decisão (automática sem dúvida, ou a sua) vai para preparo.categoria.decisao,
 * o mesmo registro que a etapa 8 reaproveita.
 */
export async function categoriaEGravar(fichaId, { deps = depsReais } = {}) {
  const r = await lerFichaNovoAnuncio(fichaId);
  if (!r.ok) return { ok: false, erro: r.erro || "Ficha não encontrada." };
  let item;
  try { item = await conferirSoCategoriaVoz(r.ficha, { deps }); } catch (e) { return { ok: false, erro: e?.message || String(e) }; }
  const g = await gravar(fichaId, (row) => {
    const ant = row?.dados_conferencia?.paiia_voz?.preparo || {};
    const decisao = item?.estado === "ok" && item.decisao ? item.decisao : ant?.categoria?.decisao || null;
    return { ...ant, verificacoes: { ...(ant.verificacoes || {}), categoria: item }, categoria: { decisao } };
  });
  return g.ok ? { ok: true, item, ficha: g.ficha } : { ...g, item };
}

/** Confirma (pelo Voz) a categoria sugerida, guardando o mesmo registro da Conferência. */
export async function confirmarCategoriaEGravar(fichaId, preparo) {
  const c = confirmarCategoriaSugerida(preparo);
  if (!c.ok) return c;
  return gravar(fichaId, () => ({ ...preparo, categoria: { decisao: c.decisao } }));
}

/** (05/11) Procurar outra categoria (só leitura). */
export async function buscarCategoriasEmOutra(fichaId, termo, { conta = "" } = {}) {
  const r = await lerFichaNovoAnuncio(fichaId);
  if (!r.ok) return { ok: false, erro: r.erro || "Ficha não encontrada." };
  return buscarCategoriasVoz(r.ficha, termo, { conta, deps: depsReais });
}

/**
 * (09/11) Atributo obrigatório da categoria (ex.: Modelo) informado no Voz: grava na decisão da
 * categoria da MESMA ficha (o mesmo registro que a Publicação usa). Nada vai ao ML aqui.
 */
export async function gravarAtributoCategoriaVoz(fichaId, { atributo, valueId = "", valueName = "" } = {}) {
  if (!atributo?.id) return { ok: false, erro: "Atributo não informado." };
  return gravar(fichaId, null, (dados) => atributoNoPreparo(dados, { atributo, valueId, valueName }));
}

/** (05/11) Confirma a categoria escolhida por você e grava na ficha (nada no ML). */
export async function confirmarCategoriaEscolhidaEGravar(fichaId, preparo, { candidata, avaliacao, revisao = null } = {}) {
  const c = confirmarCategoriaEscolhida(preparo, { candidata, avaliacao, revisao });
  if (!c.ok) return c;
  return gravar(fichaId, () => ({ ...preparo, categoria: { decisao: c.decisao } }));
}

/** (Etapa 3) Modalidade escolhida na revisão do celular (mesmo campo do Novo Anúncio). */
export async function definirModalidadeEGravar(fichaId, tipo) {
  return gravar(fichaId, null, (dados) => comModalidade(dados, tipo));
}

/** (Etapa 3) Aprova a revisão do celular: só grava se TUDO estiver conferido agora. */
export async function aprovarRevisaoEGravar(fichaId, { usuario = "" } = {}) {
  return gravar(fichaId, null, (dados, row) => {
    const a = aprovarRevisao({ ...row, dados_conferencia: dados }, { usuario });
    return a.ok ? comRevisao(dados, a.revisao) : { erro: a.erro };
  });
}
