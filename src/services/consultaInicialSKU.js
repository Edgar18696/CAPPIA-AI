// =============================================================
// PAIIA — CONSULTA INICIAL PELO SKU (17/11/2026). Somente leitura.
//
// Caso real: SKU 087100 (Válvula Ar Quente Uno 1984–2010). O anúncio foi
// preparado inteiro e só na Publicação apareceu "estoque 0 no Bling", embora
// o produto já estivesse cadastrado no Bling com histórico de movimentações.
//
// Agora, ao tocar em "Buscar e Montar Anúncio" (o SKU informado), o PAIIA
// consulta em paralelo, SEM interromper a preparação:
//   - Bling: produto existe? nome, ID, físico, disponível, depósito;
//   - Mercado Livre, só na CONTA SELECIONADA: anúncio deste SKU (inclui
//     variações e as buscas complementares de verificarDuplicidadeML).
// Cada sistema é verificado SEPARADAMENTE: produto no Bling não significa
// anúncio no ML (e vice-versa).
//
// Regras:
//  - nada é criado, alterado, vinculado ou publicado aqui;
//  - falha / tempo esgotado = "não foi possível verificar" — NUNCA "não existe";
//  - produto do Bling com OUTRO código não é aproveitado; anúncio do ML com
//    OUTRO SKU não conta como deste produto (vai para "possíveis — confira");
//  - o Bling é a fonte oficial do estoque: o PAIIA só mostra e orienta.
// Testes: scripts/testes/consultaInicialSKU.test.mjs
// =============================================================
import { verificarDuplicidadeML, normalizarCodigoComparacao, nomeDaLoja } from "./duplicidadeML.js";

export const ESTADO_CONSULTA = Object.freeze({
  ENCONTRADO: "encontrado",
  NAO_ENCONTRADO: "nao_encontrado",
  AMBIGUO: "ambiguo",
  OUTRO_CODIGO: "outro_codigo",
  POSSIVEL: "possivel",
  NAO_VERIFICADO: "nao_verificado",
  SEM_INTEGRACAO: "sem_integracao",
});

export const PENDENCIA = Object.freeze({
  ESTOQUE_ZERO: "estoque_zero",
  ESTOQUE_NAO_LIDO: "estoque_nao_lido",
  BLING_AMBIGUO: "bling_ambiguo",
  BLING_OUTRO_CODIGO: "bling_outro_codigo",
  BLING_NAO_VERIFICADO: "bling_nao_verificado",
  ML_DUPLICADO: "ml_duplicado",
  ML_POSSIVEL: "ml_possivel",
  ML_NAO_VERIFICADO: "ml_nao_verificado",
});

export const TEXTO_ESTOQUE_ZERO = "Produto encontrado no Bling. Estoque disponível: 0. Regularizar estoque para publicar.";
export const TEMPO_MAXIMO_CONSULTA_MS = 20 * 1000;
/** Espera depois da última tecla antes de consultar sozinho. */
export const ESPERA_DIGITACAO_SKU_MS = 900;
/** Resultado completo reaproveitado (mesmo SKU, mesmas integrações) por este tempo. */
export const VALIDADE_CONSULTA_MS = 5 * 60 * 1000;

const txt = (v) => String(v ?? "").trim();
const idConta = (v) => txt(v).replace(/\D/g, "");
const SITUACAO_ML = { active: "ativo", paused: "pausado", under_review: "em revisão", inactive: "inativo", closed: "encerrado" };
export const situacaoAnuncioML = (status) => SITUACAO_ML[txt(status)] || txt(status) || "—";
const numero = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

/** Endereço do produto no Bling (abre o cadastro certo pelo ID). */
export function linkProdutoBling(id) {
  const i = txt(id).replace(/\D/g, "");
  return i ? `https://www.bling.com.br/produtos.php#edit/${i}` : "";
}

/** Endereço público do anúncio no Mercado Livre. */
export function linkAnuncioML(mlb, permalink = "") {
  if (/^https:\/\/[a-z0-9.-]*mercadolivre\.com\.br\//i.test(txt(permalink))) return txt(permalink);
  const m = txt(mlb).toUpperCase().match(/^MLB(\d{6,})$/);
  return m ? `https://produto.mercadolivre.com.br/MLB-${m[1]}` : "";
}

/** Depósito(s) informados pelo Bling, quando a resposta trouxer (o PAIIA não inventa). */
function depositosDaResposta(resp) {
  const lista = Array.isArray(resp?.depositos) ? resp.depositos : Array.isArray(resp?.saldos) ? resp.saldos : [];
  const out = lista
    .map((d) => ({
      nome: txt(d?.descricao || d?.nome || d?.deposito?.descricao || d?.deposito?.nome) || (txt(d?.id || d?.deposito?.id) ? `ID ${txt(d?.id || d?.deposito?.id)}` : ""),
      fisico: numero(d?.saldoFisico ?? d?.saldo_fisico ?? d?.fisico),
      disponivel: numero(d?.saldoVirtual ?? d?.saldo_virtual ?? d?.disponivel),
    }))
    .filter((d) => d.nome);
  if (!out.length && txt(resp?.deposito?.descricao || resp?.deposito?.nome || resp?.deposito_nome)) {
    out.push({ nome: txt(resp?.deposito?.descricao || resp?.deposito?.nome || resp?.deposito_nome), fisico: null, disponivel: null });
  }
  return out;
}

/**
 * Resposta de bling-integracao:saldo_por_sku → situação inicial no Bling.
 * → { estado, produto, fisico, disponivel, depositos, texto, pendencia }
 */
export function avaliarBlingInicial(resp, sku) {
  const base = { produto: null, fisico: null, disponivel: null, depositos: [], pendencia: "" };
  const naoVerificado = (motivo) => ({ ...base, estado: ESTADO_CONSULTA.NAO_VERIFICADO, pendencia: PENDENCIA.BLING_NAO_VERIFICADO, texto: `Não foi possível verificar o Bling agora (${txt(motivo) || "sem resposta"}). Isso NÃO quer dizer que o produto não existe.` });
  if (!resp || typeof resp !== "object") return naoVerificado("sem resposta do Bling");
  if (resp.ambiguo === true) {
    const c = (Array.isArray(resp.candidatos) ? resp.candidatos : []).map((p) => `${txt(p?.codigo)} (ID ${txt(p?.id)})`).join(", ");
    return { ...base, estado: ESTADO_CONSULTA.AMBIGUO, pendencia: PENDENCIA.BLING_AMBIGUO, texto: `Mais de um produto no Bling com este SKU${c ? `: ${c}` : ""}. Resolva no Bling: o PAIIA não escolhe sozinho e não cadastra outro.` };
  }
  const p = resp.produto && typeof resp.produto === "object" ? resp.produto : null;
  if (resp.encontrado === true && p && txt(p.id)) {
    const produto = { id: txt(p.id), codigo: txt(p.codigo), nome: txt(p.nome) };
    // Nunca aproveita produto de outro SKU (código diferente na forma normalizada).
    if (produto.codigo && normalizarCodigoComparacao(produto.codigo) !== normalizarCodigoComparacao(sku)) {
      return { ...base, produto, estado: ESTADO_CONSULTA.OUTRO_CODIGO, pendencia: PENDENCIA.BLING_OUTRO_CODIGO, texto: `O Bling devolveu o produto ID ${produto.id} com o código ${produto.codigo}, diferente de ${txt(sku)}. Ele NÃO é usado: confira no Bling.` };
    }
    const fisico = numero(resp.saldoFisicoTotal);
    const disponivel = numero(resp.saldoVirtualTotal);
    const depositos = depositosDaResposta(resp);
    const r = { ...base, estado: ESTADO_CONSULTA.ENCONTRADO, produto, fisico, disponivel, depositos };
    if (disponivel === null) return { ...r, pendencia: PENDENCIA.ESTOQUE_NAO_LIDO, texto: `Produto encontrado no Bling, mas não foi possível verificar o estoque agora${txt(resp.mensagem) ? ` (${txt(resp.mensagem)})` : ""}.` };
    if (disponivel <= 0) return { ...r, pendencia: PENDENCIA.ESTOQUE_ZERO, texto: TEXTO_ESTOQUE_ZERO };
    return { ...r, texto: `Produto encontrado no Bling. Estoque disponível: ${disponivel}.` };
  }
  if (resp.ok === true && resp.encontrado === false) {
    return { ...base, estado: ESTADO_CONSULTA.NAO_ENCONTRADO, texto: "SKU não encontrado no Bling (busca exata). O cadastro, se precisar, é feito na Publicação, com a sua confirmação e nova conferência do SKU." };
  }
  return naoVerificado(resp.erro || resp.mensagem || "o Bling não respondeu de forma segura");
}

/**
 * Resultado de verificarDuplicidadeML (uma conta) → situação inicial no ML.
 * Só a conta selecionada. duplicados = SKU deste produto (anúncio ou variação);
 * possíveis = código no título/peça com SKU diferente: NUNCA vinculados.
 */
export function avaliarMLInicial({ conta, nome = "", resultado = null, erro = "", conectada = true }) {
  const id = idConta(conta);
  const base = { conta: id, nome: nome || (id ? nomeDaLoja(id) : ""), anuncios: [], possiveis: [], pendencia: "" };
  const naoVerificado = (motivo) => ({ ...base, estado: ESTADO_CONSULTA.NAO_VERIFICADO, pendencia: PENDENCIA.ML_NAO_VERIFICADO, texto: `Não foi possível verificar o Mercado Livre na conta ${base.nome} (${txt(motivo) || "sem resposta"}). Isso NÃO quer dizer que não há anúncio.` });
  if (!id) return { ...base, estado: ESTADO_CONSULTA.NAO_VERIFICADO, pendencia: PENDENCIA.ML_NAO_VERIFICADO, texto: "Nenhuma conta do Mercado Livre selecionada: escolha a conta acima para conferir. Isso NÃO quer dizer que não há anúncio." };
  if (!conectada) return naoVerificado("conta não conectada ao PAIIA");
  if (erro) return naoVerificado(erro);
  if (!resultado || typeof resultado !== "object") return naoVerificado("sem resposta do Mercado Livre");
  if (resultado.erro) return naoVerificado(resultado.erro);
  if (resultado.verificado !== true) return naoVerificado("resposta do Mercado Livre sem confirmação");
  const mapa = (l) => (Array.isArray(l) ? l : []).map((d) => ({ mlb: txt(d?.id).toUpperCase(), titulo: txt(d?.titulo), situacao: situacaoAnuncioML(d?.status), motivo: txt(d?.motivo), link: linkAnuncioML(d?.id, d?.permalink) })).filter((d) => d.mlb);
  const anuncios = mapa(resultado.duplicados);
  const possiveis = mapa(resultado.possiveis);
  if (anuncios.length) return { ...base, anuncios, possiveis, estado: ESTADO_CONSULTA.ENCONTRADO, pendencia: PENDENCIA.ML_DUPLICADO, texto: `Já existe anúncio deste SKU na conta ${base.nome}: possível duplicidade. O PAIIA não cria outro anúncio sozinho.` };
  if (possiveis.length) return { ...base, possiveis, estado: ESTADO_CONSULTA.POSSIVEL, pendencia: PENDENCIA.ML_POSSIVEL, texto: `Há anúncio parecido na conta ${base.nome} (mesmo código no título ou na peça, SKU diferente). Confira antes: ele não é deste produto e não é vinculado.` };
  return { ...base, estado: ESTADO_CONSULTA.NAO_ENCONTRADO, texto: `Nenhum anúncio deste SKU na conta ${base.nome} (incluindo variações).` };
}

function comTempo(promessa, ms, motivo) {
  let t;
  return Promise.race([
    Promise.resolve(promessa),
    new Promise((_, rej) => { t = setTimeout(() => rej(new Error(motivo)), ms); }),
  ]).finally(() => clearTimeout(t));
}

/** Só o Bling (usado também em "Verificar estoque novamente"). Nunca lança. */
export async function consultarBlingInicial({ codigo, lerBling, tempoMaximoMs = TEMPO_MAXIMO_CONSULTA_MS }) {
  const sku = txt(codigo);
  try {
    return avaliarBlingInicial(await comTempo(lerBling(sku), tempoMaximoMs, "tempo esgotado no Bling"), sku);
  } catch (e) {
    return avaliarBlingInicial({ ok: false, erro: txt(e?.message || e) || "falha ao consultar o Bling" }, sku);
  }
}

/** Só o Mercado Livre da conta selecionada. consultarML(conta, caminho) → ml_consulta GET. Nunca lança. */
export async function consultarMLInicial({ codigo, conta, nome = "", conectada = true, consultarML, tempoMaximoMs = TEMPO_MAXIMO_CONSULTA_MS }) {
  const id = idConta(conta);
  if (!id || !conectada) return avaliarMLInicial({ conta: id, nome, conectada: Boolean(id) && conectada });
  try {
    const resultado = await comTempo(
      verificarDuplicidadeML({ conta: id, codigos: [txt(codigo)], consultar: (caminho) => consultarML(id, caminho) }),
      tempoMaximoMs,
      "tempo esgotado no Mercado Livre"
    );
    return avaliarMLInicial({ conta: id, nome, resultado });
  } catch (e) {
    return avaliarMLInicial({ conta: id, nome, erro: txt(e?.message || e) || "falha ao consultar o Mercado Livre" });
  }
}

/** Bling e ML em paralelo, cada um separado. Código curto (< 4) não consulta. */
export async function consultarSKUInicial({ codigo, conta, nomeConta = "", contaConectada = true, lerBling, consultarML, tempoMaximoMs, agora = () => new Date().toISOString() }) {
  const sku = txt(codigo);
  if (normalizarCodigoComparacao(sku).length < 4) return null;
  const [bling, ml] = await Promise.all([
    consultarBlingInicial({ codigo: sku, lerBling, tempoMaximoMs }),
    consultarMLInicial({ codigo: sku, conta, nome: nomeConta, conectada: contaConectada, consultarML, tempoMaximoMs }),
  ]);
  return { codigo: sku, bling, ml, lido_em: agora() };
}

/** Pendências, na ordem em que o usuário corrige. Lista vazia = nada a corrigir. */
export function pendenciasConsulta(r) {
  if (!r) return [];
  return [r.bling?.pendencia, r.ml?.pendencia].filter(Boolean);
}

/** Pode publicar (pela consulta inicial)? Estoque zero, duplicidade ou dúvida = não, até corrigir. */
export function podeSeguirParaPublicar(r) {
  return Boolean(r) && pendenciasConsulta(r).length === 0;
}

/** Orientação para regularizar o estoque NO BLING (o PAIIA não altera a quantidade). */
export function orientacaoRegularizarEstoque(bling, sku) {
  const p = bling?.produto || {};
  const deps = (bling?.depositos || []).map((d) => d.nome).join(", ");
  return [
    `Abra no Bling o produto ID ${p.id || "—"} (SKU ${p.codigo || txt(sku)}${p.nome ? ` — ${p.nome}` : ""}).`,
    `Em Estoque, lance a entrada ou o balanço com a quantidade real${deps ? ` no depósito ${deps}` : " no depósito usado nas vendas"}.`,
    "O PAIIA não altera a quantidade: o Bling é a fonte oficial do estoque.",
    "Depois toque em \"Verificar estoque novamente e continuar\": a ficha, as fotos, a descrição e as aplicações continuam como estão.",
  ];
}

/** Texto curto do estoque para a tela. */
export function textoEstoque(bling) {
  if (!bling || bling.estado !== ESTADO_CONSULTA.ENCONTRADO) return "";
  const deps = (bling.depositos || []).map((d) => d.nome).filter(Boolean);
  return `físico ${bling.fisico ?? "—"} · disponível ${bling.disponivel ?? "—"} · depósito ${deps.length ? deps.join(", ") : "não informado pelo Bling"}`;
}

// =============================================================
// (17/11, versão rápida) CONSULTA AUTOMÁTICA + AVISO PEQUENO AO LADO DO SKU.
// O usuário digita o SKU e continua; a consulta roda em segundo plano:
//  - só nas integrações que o usuário USA (Bling conectado? contas ML conectadas);
//    serviço não conectado não é consultado nem exigido;
//  - fichas PAIIA do código (base interna) → "Continuar ficha";
//  - anunciado numa conta e livre em outra (verificada) → "Aproveitar para <conta>"
//    (a ficha nova tem publicação independente e a própria checagem de duplicidade);
//  - cada parte com tempo máximo; resultado completo reaproveitado por alguns minutos.
// Tudo somente leitura. Nada é criado, alterado, vinculado ou publicado aqui.
// =============================================================
const PUBLICADOS_FICHA = ["publicado", "publicado_com_pendencia", "publicando"];
const MLB_OK = (v) => (/^MLB\d{6,}$/.test(txt(v).toUpperCase()) ? txt(v).toUpperCase() : "");

/** Fichas PAIIA deste código (listarAnunciosDoCodigo), sem a ficha aberta agora. */
export function avaliarFichasInicial(resp, fichaAtualId = "") {
  if (!resp || resp.ok !== true) return { estado: ESTADO_CONSULTA.NAO_VERIFICADO, lista: [], texto: `Não foi possível verificar as fichas do PAIIA (${txt(resp?.erro) || "sem resposta"}).` };
  const lista = (Array.isArray(resp.anuncios) ? resp.anuncios : [])
    .filter((a) => a && a.status_fluxo !== "cancelado" && txt(a.id) && txt(a.id) !== txt(fichaAtualId))
    .map((a) => {
      const mlb = MLB_OK(a.publicacao?.mlb_id);
      return { id: txt(a.id), titulo: txt(a.titulo), status: txt(a.status_fluxo), conta: idConta(a.publicacao?.ml_user_id || a.conta_destino_ml_user_id), mlb, publicada: Boolean(mlb) || PUBLICADOS_FICHA.includes(txt(a.status_fluxo)), atualizada: txt(a.updated_at) };
    })
    .sort((x, y) => y.atualizada.localeCompare(x.atualizada));
  return { estado: lista.length ? ESTADO_CONSULTA.ENCONTRADO : ESTADO_CONSULTA.NAO_ENCONTRADO, lista, texto: lista.length ? `${lista.length} ficha(s) deste código no PAIIA.` : "Nenhuma outra ficha deste código no PAIIA." };
}

/**
 * Consulta rápida (tudo em paralelo, cada parte com tempo máximo). Nunca lança.
 * contas: [{ id, nome }] SÓ as conectadas; blingConectado: true | false | null (desconhecido → tenta).
 */
export async function consultarSKURapido({ codigo, contas = [], blingConectado = null, lerBling, consultarML, lerFichas, fichaAtualId = "", tempoMaximoMs = TEMPO_MAXIMO_CONSULTA_MS, agora = () => new Date().toISOString() }) {
  const sku = txt(codigo);
  if (normalizarCodigoComparacao(sku).length < 4) return null;
  const parteBling = blingConectado === false || typeof lerBling !== "function"
    ? Promise.resolve({ estado: ESTADO_CONSULTA.SEM_INTEGRACAO, produto: null, fisico: null, disponivel: null, depositos: [], pendencia: "", texto: "Bling não conectado: não consultado." })
    : consultarBlingInicial({ codigo: sku, lerBling, tempoMaximoMs });
  const parteFichas = (async () => {
    if (typeof lerFichas !== "function") return avaliarFichasInicial(null);
    try { return avaliarFichasInicial(await comTempo(lerFichas(sku), tempoMaximoMs, "tempo esgotado na base PAIIA"), fichaAtualId); }
    catch (e) { return avaliarFichasInicial({ ok: false, erro: txt(e?.message || e) }); }
  })();
  const partesML = (Array.isArray(contas) ? contas : []).filter((c) => idConta(c?.id)).map((c) =>
    consultarMLInicial({ codigo: sku, conta: c.id, nome: c.nome, conectada: true, consultarML, tempoMaximoMs }));
  const [bling, fichas, ...ml] = await Promise.all([parteBling, parteFichas, ...partesML]);
  const r = { codigo: sku, bling, fichas, ml, lido_em: agora() };
  return { ...r, resumo: resumoIndicador(r), oportunidades: oportunidadesSKU(r) };
}

/** O aviso pequeno ao lado do SKU. tipo: existe | conferir | nao_encontrado | indisponivel. */
export function resumoIndicador(r) {
  if (!r) return { tipo: "", texto: "" };
  const ml = Array.isArray(r.ml) ? r.ml : [];
  const partes = [r.bling, r.fichas, ...ml].filter(Boolean);
  const existe = r.bling?.estado === ESTADO_CONSULTA.ENCONTRADO || r.bling?.estado === ESTADO_CONSULTA.AMBIGUO || r.fichas?.lista?.length > 0 || ml.some((m) => m.estado === ESTADO_CONSULTA.ENCONTRADO);
  const falhou = partes.some((p) => p.estado === ESTADO_CONSULTA.NAO_VERIFICADO);
  const duvida = r.bling?.estado === ESTADO_CONSULTA.OUTRO_CODIGO || ml.some((m) => m.estado === ESTADO_CONSULTA.POSSIVEL);
  // Anúncio numa conta não é pendência (as outras podem estar livres): destaque só para estoque 0 ou Bling ambíguo.
  const alerta = [PENDENCIA.ESTOQUE_ZERO, PENDENCIA.BLING_AMBIGUO].includes(r.bling?.pendencia);
  if (existe) return { tipo: "existe", texto: "Já existe", alerta, incompleto: falhou };
  // Falha NUNCA vira "não encontrado".
  if (falhou) return { tipo: "indisponivel", texto: "Consulta indisponível", alerta: false, incompleto: true };
  if (duvida) return { tipo: "conferir", texto: "Parecido — confira", alerta: true, incompleto: false };
  // (26/11) Antes dizia "Não encontrado" e parecia que a PEÇA não tinha sido achada no catálogo.
  return { tipo: "nao_encontrado", texto: "SKU novo — sem anúncio", alerta: false, incompleto: false };
}

/**
 * Atalhos para não refazer trabalho (nada é executado aqui):
 *  - continuar: ficha deste código ainda não publicada (a mais recente);
 *  - aproveitar: ficha publicada cujo MLB o ML CONFIRMOU com este SKU na conta dela →
 *    para cada outra conta conectada VERIFICADA sem anúncio deste SKU.
 */
export function oportunidadesSKU(r) {
  const fichas = r?.fichas?.lista || [];
  const ml = Array.isArray(r?.ml) ? r.ml : [];
  const continuar = fichas.find((f) => !f.publicada) || null;
  const confirmados = new Set(ml.flatMap((m) => (m.anuncios || []).map((a) => `${m.conta}:${a.mlb}`)));
  const fonte = fichas.find((f) => f.publicada && f.mlb && confirmados.has(`${f.conta}:${f.mlb}`)) || null;
  const aproveitar = fonte
    ? ml.filter((m) => m.conta !== fonte.conta && m.estado === ESTADO_CONSULTA.NAO_ENCONTRADO && !fichas.some((f) => f.conta === m.conta && !f.publicada)).map((m) => ({ ficha: fonte.id, conta: m.conta, nome: m.nome }))
    : [];
  return { continuar: continuar ? { ficha: continuar.id, titulo: continuar.titulo } : null, aproveitar };
}

// -------------------------------------------------------------
// (17/11) As 3 contas, cada uma separada: LOJA ONLINE, CIEBR, REVELAÇÃO.
// Conta só é "livre" quando o ML DESTA conta foi lido sem erro e não tem anúncio deste
// SKU (nem parecido). Erro, consulta incompleta ou conta não conectada → nunca livre.
// MLB é sempre o da própria conta (lido nela); nunca passa para outra.
// -------------------------------------------------------------
export const CONTAS_SKU = Object.freeze([
  Object.freeze({ id: "1729335019", nome: "LOJA ONLINE" }),
  Object.freeze({ id: "824312524", nome: "CIEBR" }),
  Object.freeze({ id: "2412238242", nome: "REVELAÇÃO" }),
]);
export const ESTADO_LINHA = Object.freeze({
  ANUNCIADA: "anunciada",
  LIVRE: "livre",
  EM_ANDAMENTO: "em_andamento",
  CONFERIR: "conferir",
  NAO_VERIFICADA: "nao_verificada",
  NAO_CONECTADA: "nao_conectada",
});

/** → [{ conta, nome, estado, anuncios, possiveis, motivo, acao }] na ordem LOJA ONLINE, CIEBR, REVELAÇÃO. */
export function contasDoSKU(r) {
  const fichas = r?.fichas?.lista || [];
  const ml = Array.isArray(r?.ml) ? r.ml : [];
  const confirmados = new Set(ml.flatMap((m) => (m.anuncios || []).map((a) => `${m.conta}:${a.mlb}`)));
  // Fonte publicada: o MLB dela foi lido NA CONTA DELA com este SKU.
  const fonte = fichas.find((f) => f.publicada && f.mlb && confirmados.has(`${f.conta}:${f.mlb}`)) || null;
  const preparada = fichas.find((f) => !f.publicada) || null;
  const fichasOk = r?.fichas?.estado !== ESTADO_CONSULTA.NAO_VERIFICADO;
  return CONTAS_SKU.map(({ id, nome }) => {
    const m = ml.find((x) => x.conta === id) || null;
    const base = { conta: id, nome, anuncios: m?.anuncios || [], possiveis: m?.possiveis || [], motivo: "", acao: null };
    if (!m) return { ...base, estado: ESTADO_LINHA.NAO_CONECTADA, motivo: "conta não conectada: não consultada" };
    if (m.estado === ESTADO_CONSULTA.ENCONTRADO) return { ...base, estado: ESTADO_LINHA.ANUNCIADA };
    if (m.estado === ESTADO_CONSULTA.NAO_VERIFICADO) return { ...base, estado: ESTADO_LINHA.NAO_VERIFICADA, motivo: "não foi possível verificar" };
    if (m.estado === ESTADO_CONSULTA.POSSIVEL) return { ...base, estado: ESTADO_LINHA.CONFERIR, motivo: "anúncio parecido, SKU diferente — confira" };
    if (m.estado !== ESTADO_CONSULTA.NAO_ENCONTRADO) return { ...base, estado: ESTADO_LINHA.NAO_VERIFICADA, motivo: "não foi possível verificar" };
    // Sem as fichas do PAIIA não dá para saber se já há ficha desta conta: não oferece criar.
    if (!fichasOk) return { ...base, estado: ESTADO_LINHA.NAO_VERIFICADA, motivo: "fichas do PAIIA não verificadas" };
    const andamento = fichas.find((f) => !f.publicada && f.conta === id);
    if (andamento) return { ...base, estado: ESTADO_LINHA.EM_ANDAMENTO, acao: { tipo: "abrir", ficha: andamento.id, conta: id, rotulo: "Continuar ficha" } };
    let acao = null;
    if (fonte && fonte.conta !== id) acao = { tipo: "preparar", ficha: fonte.id, conta: id, rotulo: `Criar em ${nome}` };
    else if (preparada) acao = { tipo: "abrir", ficha: preparada.id, conta: id, rotulo: `Usar a ficha para ${nome}` };
    return { ...base, estado: ESTADO_LINHA.LIVRE, acao };
  });
}

/** Chave do cache: SKU normalizado + integrações consultadas + ficha aberta. */
export function chaveConsulta({ codigo, contas = [], blingConectado = null, fichaAtualId = "" }) {
  const sku = normalizarCodigoComparacao(codigo);
  if (!sku) return "";
  return [sku, (contas || []).map((c) => idConta(c?.id)).filter(Boolean).sort().join(","), String(blingConectado), txt(fichaAtualId)].join("|");
}

/**
 * Cache: o mesmo SKU não é consultado de novo enquanto o resultado completo vale;
 * dois pedidos iguais ao mesmo tempo viram uma consulta. Resultado com falha não fica guardado.
 */
export function criarCacheConsulta({ validadeMs = VALIDADE_CONSULTA_MS, relogio = () => Date.now() } = {}) {
  const guardados = new Map();
  const emAndamento = new Map();
  return {
    olhar(chave) {
      const g = guardados.get(chave);
      return g && relogio() - g.em < validadeMs ? g.valor : null;
    },
    async obter(chave, consultar, { forcar = false } = {}) {
      if (!chave) return null;
      const g = guardados.get(chave);
      if (!forcar && g && relogio() - g.em < validadeMs) return g.valor;
      if (emAndamento.has(chave)) return emAndamento.get(chave);
      const p = (async () => {
        try {
          const valor = await consultar();
          if (valor && !valor.resumo?.incompleto) guardados.set(chave, { em: relogio(), valor });
          else guardados.delete(chave);
          return valor;
        } finally {
          emAndamento.delete(chave);
        }
      })();
      emAndamento.set(chave, p);
      return p;
    },
    esquecer(chave) { guardados.delete(chave); },
  };
}

/** (23/11) Cache ÚNICO: o aviso do código e o "Buscar e Montar" usam a mesma consulta. */
export const cacheConsultaSKU = criarCacheConsulta();
