import { supabase } from "../supabase";

/*
 * Ficha persistente do anúncio na base PAIIA (Supabase) — fonte de verdade
 * da CONTA DE DESTINO e do vínculo da publicação (MLB, Bling, estoque).
 *
 * Tabelas (migração supabase/pendentes/20261003_paiia_anuncios_publicacao.sql):
 *  - paiia_anuncios: 1 linha por anúncio (ID interno). conta_destino_* é do
 *    ANÚNCIO, nunca da sessão, do computador ou da "conta ativa".
 *  - paiia_anuncios_publicacoes: 1 linha por anúncio × marketplace.
 *
 * Isolamento: toda leitura/gravação é pelo ID do anúncio (e pelo usuário via
 * RLS). Dois anúncios do mesmo SKU em contas diferentes são duas fichas.
 * O navegador só guarda cache (ID da ficha) para a experiência de uso.
 */

const T_ANUNCIOS = "paiia_anuncios";
const T_PUBLICACOES = "paiia_anuncios_publicacoes";
const MARKETPLACE_ML = "mercado_livre";

export function normalizarCodigo(codigo) {
  return String(codigo || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * SKU OFICIAL do anúncio: o SKU específico, quando existir um diferente;
 * senão o próprio código da peça. Nada é inventado nem trocado: só tira
 * espaços das pontas/duplicados e usa letras maiúsculas.
 * O código original continua sendo exibido como veio.
 */
export function skuOficial({ sku, codigo } = {}) {
  const limpar = (v) => String(v ?? "").trim().replace(/\s+/g, " ");
  return (limpar(sku) || limpar(codigo)).toUpperCase();
}

/*
 * Status da publicação:
 *  - "publicado": MLB criado E verificação pós-publicação concluída sem falha;
 *  - "publicado_com_pendencia": o MLB EXISTE, mas uma ou mais verificações
 *    pós-publicação falharam ou ficaram incompletas (SKU, marca, tipo de
 *    veículo, compatibilidades...). Nunca é motivo para publicar de novo.
 * Enquanto a migração 20261004 não for aplicada, o banco só aceita
 * "publicado": a pendência fica em erro_publicacao com o prefixo PENDÊNCIA.
 */
export const STATUS_COM_PENDENCIA = "publicado_com_pendencia";
export const STATUS_PUBLICADOS = ["publicado", STATUS_COM_PENDENCIA];
export const PENDENCIA_SKU = "PENDÊNCIA — SKU não confirmado";
/** Esta publicação já tem anúncio criado no marketplace (com ou sem pendência)? */
export function publicacaoExiste(pub) {
  return Boolean(pub?.mlb_id) || STATUS_PUBLICADOS.includes(pub?.status_publicacao);
}
/** Texto da pendência pós-publicação ("" quando não há). */
export function pendenciaPublicacao(pub) {
  const t = String(pub?.erro_publicacao || "");
  if (pub?.status_publicacao === STATUS_COM_PENDENCIA) return t || "Publicado com pendência.";
  return pub?.status_publicacao === "publicado" && t.startsWith("PENDÊNCIA") ? t : "";
}

// Tabela ainda não criada (migração pendente) → avisa sem quebrar a tela.
function tabelaAusente(erro) {
  const t = `${erro?.code || ""} ${erro?.message || ""}`;
  return /42P01|PGRST205|PGRST204|does not exist|Could not find the table|schema cache/i.test(t);
}

function falha(erro) {
  if (tabelaAusente(erro)) {
    return { ok: false, disponivel: false, erro: "A ficha de anúncios ainda não existe na base PAIIA (migração pendente de autorização)." };
  }
  return { ok: false, disponivel: true, erro: erro?.message || "Falha ao falar com a base PAIIA." };
}

async function usuarioAtual() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

/** Fichas deste código (em andamento e publicadas), com a publicação ML. */
export async function listarAnunciosDoCodigo(codigo) {
  const cod = normalizarCodigo(codigo);
  if (!cod) return { ok: true, disponivel: true, anuncios: [] };
  const { data, error } = await supabase
    .from(T_ANUNCIOS)
    .select(`id, codigo, titulo, conta_destino_ml_user_id, conta_destino_nome, status_fluxo, updated_at, ${T_PUBLICACOES}(id, ml_user_id, conta_nome, mlb_id, status_publicacao, publicado_em, status_bling, bling_produto_id, sku, erro_publicacao)`)
    .eq("codigo_normalizado", cod)
    .neq("status_fluxo", "cancelado")
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) return falha(error);
  return {
    ok: true,
    disponivel: true,
    anuncios: (data || []).map((a) => ({
      ...a,
      publicacao: (a[T_PUBLICACOES] || []).find(Boolean) || null,
    })),
  };
}

/** Lê UMA ficha pelo ID (fonte de verdade da conta de destino). */
export async function obterAnuncio(anuncioId) {
  if (!anuncioId) return { ok: false, disponivel: true, erro: "Sem ID do anúncio." };
  const { data, error } = await supabase
    .from(T_ANUNCIOS)
    .select(`id, codigo, titulo, conta_destino_ml_user_id, conta_destino_nome, status_fluxo, dados_conferencia, updated_at, ${T_PUBLICACOES}(id, ml_user_id, conta_nome, mlb_id, mlb_link, status_publicacao, publicado_em, status_bling, bling_produto_id, estoque)`)
    .eq("id", anuncioId)
    .maybeSingle();
  if (error) return falha(error);
  if (!data) return { ok: false, disponivel: true, naoEncontrado: true, erro: "Ficha do anúncio não encontrada." };
  return { ok: true, disponivel: true, anuncio: { ...data, publicacao: (data[T_PUBLICACOES] || [])[0] || null } };
}

/**
 * Grava IMEDIATAMENTE a conta de destino do anúncio. Sem ID → cria a ficha.
 * Só altera a ficha deste ID: outros anúncios (mesmo SKU) não são tocados.
 * Anúncio já publicado não troca de conta.
 */
export async function salvarContaDestino({ anuncioId, codigo, titulo, contaId, contaNome, dadosConferencia }) {
  const usuarioId = await usuarioAtual();
  if (!usuarioId) return { ok: false, disponivel: true, erro: "Sessão expirada: entre de novo no PAIIA." };
  const agora = new Date().toISOString();
  const conta = { conta_destino_ml_user_id: String(contaId || ""), conta_destino_nome: contaNome || null, conta_destino_definida_em: agora };
  let id = anuncioId || null;

  if (id) {
    const atual = await obterAnuncio(id);
    if (!atual.ok && !atual.naoEncontrado) return atual;
    if (atual.ok && publicacaoExiste(atual.anuncio.publicacao)) {
      return { ok: false, disponivel: true, erro: "Este anúncio já foi publicado: a conta de destino não pode mudar." };
    }
    if (!atual.ok) id = null; // ficha sumiu: cria outra
  }

  if (id) {
    const { error } = await supabase
      .from(T_ANUNCIOS)
      // dados_conferencia NÃO é sobrescrito aqui: a ficha aprovada (gravada no
      // "Próximo passo") é a fonte da recuperação no F5.
      .update({ ...conta, titulo: titulo || null, updated_at: agora })
      .eq("id", id);
    if (error) return falha(error);
  } else {
    const { data, error } = await supabase
      .from(T_ANUNCIOS)
      .insert({
        usuario_id: usuarioId,
        codigo: String(codigo || ""),
        codigo_normalizado: normalizarCodigo(codigo),
        titulo: titulo || null,
        marketplace: MARKETPLACE_ML,
        status_fluxo: "conferencia_aprovada",
        dados_conferencia: dadosConferencia || {},
        ...conta,
      })
      .select("id")
      .single();
    if (error) return falha(error);
    id = data.id;
  }

  // Publicação (1 por anúncio × marketplace): conta que será usada.
  const { error: erroPub } = await supabase
    .from(T_PUBLICACOES)
    .upsert(
      {
        anuncio_id: id,
        usuario_id: usuarioId,
        marketplace: MARKETPLACE_ML,
        ml_user_id: String(contaId || ""),
        conta_nome: contaNome || null,
        sku: String(codigo || ""),
        sku_normalizado: normalizarCodigo(codigo),
        updated_at: agora,
      },
      { onConflict: "anuncio_id,marketplace" }
    );
  if (erroPub) return falha(erroPub);
  return { ok: true, disponivel: true, anuncioId: id };
}

/** Estado do Bling (somente leitura) guardado na ficha da publicação. */
export async function registrarBling({ anuncioId, bling, preparo }) {
  if (!anuncioId) return { ok: false, erro: "Sem ID do anúncio." };
  const status = !bling
    ? "nao_verificado"
    : bling.ok === false && !bling.encontrado
      ? "erro"
      : bling.ambiguo
        ? "ambiguo"
        : bling.encontrado
          ? "encontrado"
          : "nao_encontrado";
  const { error } = await supabase
    .from(T_PUBLICACOES)
    .update({
      status_bling: status === "nao_encontrado" && preparo ? "preparado_para_criar" : status,
      bling_produto_id: bling?.produto?.id && !bling?.ambiguo ? bling.produto.id : null,
      bling_preparo: status === "nao_encontrado" ? preparo || null : null,
      estoque: bling?.saldoVirtualTotal ?? null,
      estoque_lido_em: bling?.lido_em || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("anuncio_id", anuncioId)
    .eq("marketplace", MARKETPLACE_ML);
  if (error) return falha(error);
  return { ok: true };
}

/** Resultado da publicação: MLB retornado, data/hora e vínculo do Bling. */
export async function registrarResultadoPublicacao({ anuncioId, contaId, resultado, bling, sku, verificacao }) {
  if (!anuncioId) return { ok: false, erro: "Sem ID do anúncio." };
  const agora = new Date().toISOString();
  const publicado = Boolean(resultado?.ok && resultado?.publicado && resultado?.item_id);
  const blingId = bling?.encontrado && !bling?.ambiguo ? bling?.produto?.id || null : null;
  // Verificação pós-publicação: qualquer item obrigatório não confirmado
  // (ou verificação ausente) = publicado COM PENDÊNCIA.
  const pendencias = publicado
    ? (verificacao ? verificacao.pendencias || [] : ["Verificação pós-publicação não executada."])
    : [];
  const comPendencia = publicado && pendencias.length > 0;
  const textoPendencia = comPendencia ? `PENDÊNCIA — ${pendencias.join(" ")}`.slice(0, 1000) : null;
  const base = {
    ml_user_id: String(contaId || ""),
    mlb_id: publicado ? resultado.item_id : null,
    mlb_link: publicado ? resultado.link || null : null,
    publicado_em: publicado ? agora : null,
    erro_publicacao: publicado ? textoPendencia : String(resultado?.erro || "Falha na publicação.").slice(0, 500),
    ...(sku ? { sku, sku_normalizado: normalizarCodigo(sku) } : {}),
    // Vínculo PAIIA ↔ Bling: produto existente é vinculado; sem produto,
    // o cadastro fica preparado (a criação no Bling é uma etapa própria).
    status_bling: publicado ? (blingId ? "vinculado" : "preparado_para_criar") : undefined,
    bling_produto_id: blingId,
    updated_at: agora,
  };
  const novo = {
    ...base,
    status_publicacao: !publicado ? "erro" : comPendencia ? STATUS_COM_PENDENCIA : "publicado",
    ...(publicado ? { pendencias, verificacao_pos_publicacao: verificacao || null, verificado_em: agora } : {}),
  };
  let { error } = await supabase.from(T_PUBLICACOES).update(novo).eq("anuncio_id", anuncioId).eq("marketplace", MARKETPLACE_ML);
  let modo = "completo";
  // Migração 20261004 ainda não aplicada (status/colunas novos não existem):
  // grava no formato atual, com a pendência no texto de erro_publicacao.
  if (error && /23514|check constraint|PGRST204|42703|column/i.test(`${error.code || ""} ${error.message || ""}`)) {
    modo = "compatível (migração pendente)";
    ({ error } = await supabase
      .from(T_PUBLICACOES)
      .update({ ...base, status_publicacao: publicado ? "publicado" : "erro" })
      .eq("anuncio_id", anuncioId)
      .eq("marketplace", MARKETPLACE_ML));
  }
  if (error) return falha(error);
  let fluxo = await supabase
    .from(T_ANUNCIOS)
    .update({ status_fluxo: !publicado ? "erro_publicacao" : comPendencia ? STATUS_COM_PENDENCIA : "publicado", updated_at: agora })
    .eq("id", anuncioId);
  if (fluxo.error && comPendencia) {
    await supabase.from(T_ANUNCIOS).update({ status_fluxo: "publicado", updated_at: agora }).eq("id", anuncioId);
  }
  return { ok: true, pendencias, comPendencia, modo };
}

/**
 * DUPLICIDADE — proteção A (base PAIIA), consultada na hora, sem cache.
 * Procura publicações deste código/SKU (normalizado) NESTA conta ML que já
 * tenham MLB registrado ou status "publicado" — inclusive a própria ficha.
 * Busca por sku_normalizado da publicação e pelo código normalizado da ficha.
 * Erro na consulta → ok:false (quem chama deve BLOQUEAR).
 */
export async function conferirDuplicidadeBase({ codigo, sku, contaId }) {
  const conta = String(contaId || "");
  const chaves = [...new Set([normalizarCodigo(sku), normalizarCodigo(codigo)].filter(Boolean))];
  if (!conta || !chaves.length) return { ok: false, erro: "Sem conta ou sem código para conferir." };
  const campos = "id, anuncio_id, ml_user_id, conta_nome, mlb_id, status_publicacao, publicado_em, sku, sku_normalizado, erro_publicacao";
  const porSku = await supabase
    .from(T_PUBLICACOES)
    .select(campos)
    .eq("marketplace", MARKETPLACE_ML)
    .eq("ml_user_id", conta)
    .in("sku_normalizado", chaves);
  if (porSku.error) return falha(porSku.error);
  const porCodigo = await supabase
    .from(T_ANUNCIOS)
    .select(`id, codigo, ${T_PUBLICACOES}(${campos})`)
    .in("codigo_normalizado", chaves);
  if (porCodigo.error) return falha(porCodigo.error);
  const todas = new Map();
  for (const p of porSku.data || []) todas.set(p.id, p);
  for (const a of porCodigo.data || []) {
    for (const p of a[T_PUBLICACOES] || []) {
      if (String(p.ml_user_id || "") === conta) todas.set(p.id, p);
    }
  }
  const registros = [...todas.values()].filter(publicacaoExiste);
  return { ok: true, registros };
}

/**
 * Grava (ou atualiza) a FICHA APROVADA do anúncio ao entrar na Publicação.
 * dados_conferencia guarda tudo o que a Conferência aprovou (anúncio +
 * ficha da conferência) para o F5/reabertura recuperar a MESMA ficha pelo ID.
 * - Com ID e ficha não publicada: atualiza a mesma ficha (não cria outra).
 * - Sem ID, ou ficha já publicada: cria uma ficha nova.
 * A conta de destino (conta_destino_*) não é tocada aqui.
 */
export async function salvarFichaAprovada({ anuncioId, codigo, titulo, dadosConferencia }) {
  const usuarioId = await usuarioAtual();
  if (!usuarioId) return { ok: false, disponivel: true, erro: "Sessão expirada: entre de novo no PAIIA." };
  const agora = new Date().toISOString();
  if (anuncioId) {
    const atual = await obterAnuncio(anuncioId);
    if (!atual.ok && !atual.naoEncontrado) return atual;
    const publicado = atual.ok && publicacaoExiste(atual.anuncio.publicacao);
    if (atual.ok && !publicado) {
      const decisaoBase = atual.anuncio.dados_conferencia?.base_paiia || null;
      const { error } = await supabase
        .from(T_ANUNCIOS)
        .update({
          titulo: titulo || null,
          status_fluxo: "conferencia_aprovada",
          dados_conferencia: { ...(dadosConferencia || {}), ...(decisaoBase ? { base_paiia: decisaoBase } : {}) },
          updated_at: agora,
        })
        .eq("id", anuncioId);
      if (error) return falha(error);
      return { ok: true, disponivel: true, anuncioId, nova: false };
    }
  }
  const { data, error } = await supabase
    .from(T_ANUNCIOS)
    .insert({
      usuario_id: usuarioId,
      codigo: String(codigo || ""),
      codigo_normalizado: normalizarCodigo(codigo),
      titulo: titulo || null,
      marketplace: MARKETPLACE_ML,
      status_fluxo: "conferencia_aprovada",
      dados_conferencia: dadosConferencia || {},
    })
    .select("id")
    .single();
  if (error) return falha(error);
  return { ok: true, disponivel: true, anuncioId: data.id, nova: true };
}

/**
 * RASCUNHO PERSISTENTE da Conferência (F5 / voltar / outro navegador).
 * Desde o início do anúncio existe UMA ficha na base PAIIA; cada alteração
 * da Conferência é gravada nela (dados_conferencia), com o mesmo formato da
 * ficha aprovada ({ versao, anuncio, ficha: { campos, origem, ... } }).
 * - Sem ID: cria a ficha (status "rascunho").
 * - Com ID de ficha ainda não publicada: atualiza a MESMA ficha.
 * - Ficha publicada/cancelada: nunca é alterada. Com criarSeFechada (só na
 *   abertura de um anúncio novo para o mesmo código) cria uma ficha nova;
 *   sem ele devolve { ok:false, fechada:true } e nada é gravado.
 * A conta de destino (conta_destino_*) não é tocada aqui.
 */
const STATUS_FICHA_FECHADA = ["publicando", "publicado", "publicado_com_pendencia", "cancelado"];
export async function salvarRascunhoFicha({ anuncioId, codigo, titulo, dadosConferencia, aprovada = false, criarSeFechada = false }) {
  const usuarioId = await usuarioAtual();
  if (!usuarioId) return { ok: false, disponivel: true, erro: "Sessão expirada: entre de novo no PAIIA." };
  const agora = new Date().toISOString();
  if (anuncioId) {
    const atual = await obterAnuncio(anuncioId);
    if (!atual.ok && !atual.naoEncontrado) return atual;
    const fechada = atual.ok && (publicacaoExiste(atual.anuncio.publicacao) || STATUS_FICHA_FECHADA.includes(atual.anuncio.status_fluxo));
    if (atual.ok && !fechada) {
      const antigos = atual.anuncio.dados_conferencia || {};
      const { error } = await supabase
        .from(T_ANUNCIOS)
        .update({
          titulo: titulo || null,
          status_fluxo: aprovada ? "conferencia_aprovada" : "rascunho",
          // Decisão da Base PAIIA (gravada à parte) nunca é perdida.
          dados_conferencia: { ...(dadosConferencia || {}), ...(antigos.base_paiia ? { base_paiia: antigos.base_paiia } : {}) },
          updated_at: agora,
        })
        .eq("id", anuncioId);
      if (error) return falha(error);
      return { ok: true, disponivel: true, anuncioId, nova: false };
    }
    if (fechada && !criarSeFechada) {
      return { ok: false, disponivel: true, fechada: true, erro: "Esta ficha já foi publicada ou cancelada: não é alterada." };
    }
  }
  const { data, error } = await supabase
    .from(T_ANUNCIOS)
    .insert({
      usuario_id: usuarioId,
      codigo: String(codigo || ""),
      codigo_normalizado: normalizarCodigo(codigo),
      titulo: titulo || null,
      marketplace: MARKETPLACE_ML,
      status_fluxo: aprovada ? "conferencia_aprovada" : "rascunho",
      dados_conferencia: dadosConferencia || {},
    })
    .select("id")
    .single();
  if (error) return falha(error);
  return { ok: true, disponivel: true, anuncioId: data.id, nova: true };
}

/** Ficha criada neste computador e abandonada (o usuário continuou outra). */
export async function cancelarFichaSemConta(anuncioId) {
  if (!anuncioId) return { ok: true };
  const { error } = await supabase
    .from(T_ANUNCIOS)
    .update({ status_fluxo: "cancelado", updated_at: new Date().toISOString() })
    .eq("id", anuncioId)
    .is("conta_destino_ml_user_id", null);
  if (error) return falha(error);
  return { ok: true };
}

/**
 * Decisão do usuário sobre alimentar a BASE PAIIA com os dados deste anúncio.
 * É independente da publicação: "nao_salvar" não bloqueia nada.
 */
export async function registrarDecisaoBase({ anuncioId, decisao, detalhe }) {
  if (!anuncioId) return { ok: false, erro: "Sem ID do anúncio." };
  const atual = await obterAnuncio(anuncioId);
  if (!atual.ok) return atual;
  const dados = atual.anuncio.dados_conferencia || {};
  const { error } = await supabase
    .from(T_ANUNCIOS)
    .update({
      dados_conferencia: { ...dados, base_paiia: { decisao, decidido_em: new Date().toISOString(), ...(detalhe || {}) } },
      updated_at: new Date().toISOString(),
    })
    .eq("id", anuncioId);
  if (error) return falha(error);
  return { ok: true };
}

/** Vínculo com o produto criado no Bling (após a criação autorizada). */
export async function registrarProdutoBlingCriado({ anuncioId, blingProdutoId }) {
  if (!anuncioId || !blingProdutoId) return { ok: false, erro: "Dados insuficientes." };
  const { error } = await supabase
    .from(T_PUBLICACOES)
    .update({ bling_produto_id: blingProdutoId, status_bling: "vinculado", bling_preparo: null, updated_at: new Date().toISOString() })
    .eq("anuncio_id", anuncioId)
    .eq("marketplace", MARKETPLACE_ML);
  if (error) return falha(error);
  return { ok: true };
}
