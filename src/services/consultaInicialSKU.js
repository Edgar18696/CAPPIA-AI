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
export const TEMPO_MAXIMO_CONSULTA_MS = 45 * 1000;

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
