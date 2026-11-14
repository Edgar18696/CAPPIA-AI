// =============================================================
// PAIIA — CONTAS DA PUBLICAÇÃO no Mercado Livre (14/11/2026).
//
// A escolha das contas saiu da preparação (Novo Anúncio: o frete lá é só
// ESTIMATIVA de referência) e ficou na etapa final de Publicação:
//   - uma caixa independente por conta: LOJA ONLINE, REVELAÇÃO, CIEBR
//     (1, 2 ou as 3);
//   - cada conta marcada é conferida SEPARADAMENTE (conexão, estoque,
//     duplicidade, frete oficial DAQUELA conta, preço/margem);
//   - impedimento numa conta NUNCA bloqueia as outras liberadas;
//   - nada é publicado sem a confirmação final, que mostra exatamente
//     quais contas serão usadas.
// Tudo aqui é SOMENTE LEITURA: as consultas chegam por injeção (deps) e
// nenhuma delas grava no Mercado Livre, no Bling ou na base.
// =============================================================
import { parametrosCotacao, cotarNoPreco, resultadoDoPreco, reais, ORIGEM_FRETE } from "./fretePrecificacao.js";

/** As três contas Mercado Livre do PAIIA, na ordem da publicação. */
export const CONTAS_PUBLICACAO_ML = Object.freeze([
  Object.freeze({ id: "1729335019", nome: "LOJA ONLINE" }),
  Object.freeze({ id: "2412238242", nome: "REVELAÇÃO" }),
  Object.freeze({ id: "824312524", nome: "CIEBR" }),
]);

/** Conta que hoje tem a publicação automática (piloto); as outras seguem a Publicação manual. */
export const CONTA_PUBLICACAO_AUTOMATICA = "1729335019";

export const SITUACAO_CONTA = Object.freeze({ LIBERADA: "liberada", CONFERIR: "conferir", IMPEDIDA: "impedida" });

const txt = (v) => String(v ?? "").trim();
const idConta = (v) => txt(v).replace(/\D/g, "");
const numero = (v) => {
  if (typeof v === "number") return v;
  const s = txt(v).replace(/[^\d,.-]/g, "");
  if (!s) return NaN;
  return Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
};

export function nomeContaPublicacao(id) {
  return CONTAS_PUBLICACAO_ML.find((c) => c.id === idConta(id))?.nome || `Conta ${idConta(id) || "?"}`;
}

/** Seleção → ids válidos, sem repetição, sempre na ordem LOJA ONLINE, REVELAÇÃO, CIEBR. */
export function normalizarContasSelecionadas(selecao) {
  const marcadas = new Set();
  if (Array.isArray(selecao)) for (const x of selecao) marcadas.add(idConta(x));
  else if (selecao && typeof selecao === "object") for (const [k, v] of Object.entries(selecao)) if (v === true) marcadas.add(idConta(k));
  return CONTAS_PUBLICACAO_ML.filter((c) => marcadas.has(c.id)).map((c) => c.id);
}

/** Modalidade para cotar NESTA conta: a da estimativa se estiver ativa aqui; senão a padrão da conta. */
export function modalidadeParaConta(modalidades, preferida = "") {
  const lista = Array.isArray(modalidades) ? modalidades : [];
  if (preferida && lista.some((m) => m?.tipo === preferida)) return preferida;
  return lista.find((m) => m?.padrao)?.tipo || lista[0]?.tipo || "";
}

/** Quantidade da ficha: inteiro ≥ 1, senão null. */
export function quantidadeValida(q) {
  const n = numero(q);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

async function seguro(fn) {
  try {
    return await fn();
  } catch (e) {
    return { erro: txt(e?.message || e) || "falha inesperada" };
  }
}

/**
 * Confere UMA conta. Nunca lança erro: qualquer falha vira impedimento
 * só desta conta.
 *
 * dados: { sku, codigo, preco, quantidade, medida, registroFrete, base }
 * deps (somente leitura):
 *   conectada(id) → boolean
 *   modalidades(id) → { ok, modalidades:[{tipo,padrao}], erro }
 *   consultar(id) → consultar(caminho) (ml_consulta GET da conta)
 *   duplicidadeBase({ codigo, sku, contaId }) → { ok, registros, erro }
 *   duplicidadeML({ conta, codigos, consultar }) → { verificado, duplicados, possiveis } | { erro }
 */
export async function verificarContaPublicacao({ contaId, dados = {}, deps = {} }) {
  const id = idConta(contaId);
  const nome = nomeContaPublicacao(id);
  const itens = [];
  const add = (item, nivel, texto) => itens.push({ item, nivel, texto });
  const resultado = { conta: id, nome, itens, frete: null, margem: null, duplicidade: null };

  if (!CONTAS_PUBLICACAO_ML.some((c) => c.id === id)) {
    add("Conta", "erro", "Conta fora da lista de contas da publicação (LOJA ONLINE, REVELAÇÃO, CIEBR).");
    return fechar(resultado);
  }

  // 1) Conexão / exigências da conta.
  const conectada = await seguro(async () => Boolean(await deps.conectada?.(id)));
  if (conectada !== true) {
    add("Conexão", "erro", `${nome} não está conectada ao PAIIA (Contas Marketplace). Conecte a conta para publicar nela.`);
    return fechar(resultado);
  }
  add("Conexão", "ok", `${nome} conectada (ID ${id}).`);

  // 2) Estoque (quantidade da ficha que vai para esta conta).
  const qtd = quantidadeValida(dados.quantidade);
  if (!qtd) add("Estoque", "erro", "Quantidade da ficha ausente ou inválida (precisa ser um número inteiro de 1 para cima).");
  else add("Estoque", "ok", `Quantidade ${qtd} un.`);

  // 3) Preço.
  const preco = numero(dados.preco);
  const precoOk = Number.isFinite(preco) && preco > 0;
  if (!precoOk) add("Preço", "erro", "Preço de venda ausente ou inválido na ficha.");

  // 4) Duplicidade nesta conta: base PAIIA + Mercado Livre (leitura).
  const sku = txt(dados.sku) || txt(dados.codigo);
  if (!sku) {
    add("Duplicidade", "erro", "Sem SKU/código na ficha: a duplicidade não pode ser conferida.");
  } else {
    const dupBase = await seguro(() => deps.duplicidadeBase({ codigo: txt(dados.codigo) || sku, sku, contaId: id }));
    if (!dupBase?.ok) {
      add("Duplicidade", "erro", `Não foi possível conferir a base PAIIA nesta conta (${txt(dupBase?.erro) || "sem resposta"}).`);
    } else {
      const ml = await seguro(() => deps.duplicidadeML({ conta: id, codigos: [sku, txt(dados.codigo)].filter(Boolean), consultar: deps.consultar(id) }));
      resultado.duplicidade = { base: (dupBase.registros || []).map((r) => txt(r.mlb_id) || txt(r.id)), ml: ml?.erro ? null : { duplicados: ml?.duplicados || [], possiveis: ml?.possiveis || [] } };
      if (ml?.erro) add("Duplicidade", "erro", `Não foi possível conferir os anúncios desta conta no Mercado Livre (${ml.erro}).`);
      else if ((dupBase.registros || []).length) add("Duplicidade", "erro", `Este SKU já tem publicação registrada nesta conta: ${resultado.duplicidade.base.join(", ")}.`);
      else if ((ml.duplicados || []).length) add("Duplicidade", "erro", `Este SKU já tem anúncio nesta conta: ${ml.duplicados.map((d) => `${d.id} (${d.status})`).join(", ")}.`);
      else if ((ml.possiveis || []).length) add("Duplicidade", "conferir", `Possível duplicidade (mesmo código, SKU diferente): ${ml.possiveis.map((d) => `${d.id} (${d.status})`).join(", ")}. Confira no Mercado Livre e marque se NÃO for o mesmo produto.`);
      else add("Duplicidade", "ok", "Nenhum anúncio deste SKU nesta conta.");
    }
  }

  // 5) Frete: cotação OFICIAL desta conta, no preço da ficha.
  const reg = dados.registroFrete || null;
  const medida = dados.medida || reg?.medida || null;
  if (!precoOk) {
    add("Frete", "erro", "Sem preço válido não há como cotar o frete desta conta.");
  } else if (!medida) {
    add("Frete", "erro", "Peso e medidas da embalagem ausentes: o frete desta conta não pode ser cotado.");
  } else {
    const mods = await seguro(() => deps.modalidades(id));
    const modalidade = modalidadeParaConta(mods?.modalidades, txt(reg?.modalidade));
    if (!modalidade) {
      add("Frete", "erro", `Sem modalidade de envio ativa nesta conta (${txt(mods?.erro) || "Mercado Envios"}).`);
    } else {
      const params = parametrosCotacao({ conta: id, medida, modalidade, categoria: txt(dados.categoria) || txt(reg?.categoria), tipoAnuncio: txt(dados.tipoAnuncio) || txt(reg?.tipoAnuncio) });
      const c = await seguro(() => cotarNoPreco({ params, preco, consultar: deps.consultar(id) }));
      if (!c?.ok) {
        add("Frete", "erro", `O Mercado Livre não cotou o frete nesta conta (${txt(c?.erro) || "sem resposta"}).`);
      } else if (c.origem === ORIGEM_FRETE.SIMULACAO && !deps.simulacaoPermitida) {
        add("Frete", "erro", "A cotação veio SIMULADA: só vale a cotação oficial do Mercado Livre.");
      } else {
        resultado.frete = { valor: c.custo_vendedor, peso_cobrado_g: c.peso_cobrado_g, modalidade, cotado_em: c.cotado_em || null, origem: c.origem };
        const ref = Number(reg?.final?.custo_vendedor);
        const dif = Number.isFinite(ref) && Math.round(ref * 100) !== Math.round(c.custo_vendedor * 100) ? ` (estimativa da preparação: ${reais(ref)})` : "";
        add("Frete", "ok", `Frete oficial desta conta: ${reais(c.custo_vendedor)} no preço ${reais(preco)} · peso cobrado ${c.peso_cobrado_g} g · ${modalidade}${dif}.`);
      }
    }
  }

  // 6) Preço x custos com o frete DESTA conta (mesmo cálculo da precificação).
  const base = dados.base || reg?.base || null;
  if (precoOk && resultado.frete) {
    if (!(Number(base?.custo) > 0)) {
      add("Preço", "aviso", `Preço ${reais(preco)}. Sem custo na ficha: a margem nesta conta não pôde ser conferida.`);
    } else {
      const r = resultadoDoPreco({ preco, frete: resultado.frete.valor, base });
      resultado.margem = { resultado: r.resultado, margemPct: r.margemPct };
      if (r.resultado <= 0) add("Preço", "erro", `Com o frete desta conta o preço ${reais(preco)} dá prejuízo (${reais(r.resultado)}; margem ${r.margemPct}%). Ajuste o preço antes de publicar aqui.`);
      else add("Preço", "ok", `Preço ${reais(preco)} · resultado ${reais(r.resultado)} (margem ${r.margemPct}%) com o frete desta conta.`);
    }
  }
  return fechar(resultado);
}

function fechar(r) {
  const erros = r.itens.filter((i) => i.nivel === "erro");
  const conferir = r.itens.filter((i) => i.nivel === "conferir");
  r.situacao = erros.length ? SITUACAO_CONTA.IMPEDIDA : conferir.length ? SITUACAO_CONTA.CONFERIR : SITUACAO_CONTA.LIBERADA;
  r.impedimentos = erros.map((i) => `${i.item}: ${i.texto}`);
  r.verificado_em = new Date().toISOString();
  return r;
}

/**
 * Confere TODAS as contas marcadas, cada uma por conta própria (em
 * paralelo): o erro de uma nunca derruba a verificação das outras.
 */
export async function verificarContasPublicacao({ selecao, dados = {}, deps = {} }) {
  const contas = normalizarContasSelecionadas(selecao);
  const resultados = await Promise.all(contas.map(async (contaId) => {
    try {
      return await verificarContaPublicacao({ contaId, dados, deps });
    } catch (e) {
      return fechar({ conta: contaId, nome: nomeContaPublicacao(contaId), itens: [{ item: "Verificação", nivel: "erro", texto: `Falha inesperada ao conferir esta conta (${txt(e?.message || e)}).` }], frete: null, margem: null, duplicidade: null });
    }
  }));
  return { contas, resultados, assinatura: assinaturaVerificacao(contas, dados) };
}

/** O que, se mudar, invalida a verificação (contas, SKU, preço, quantidade, medidas). */
export function assinaturaVerificacao(selecao, dados = {}) {
  const m = dados.medida || dados.registroFrete?.medida || null;
  return JSON.stringify([normalizarContasSelecionadas(selecao), txt(dados.sku) || txt(dados.codigo), numero(dados.preco) || 0, quantidadeValida(dados.quantidade) || 0, m ? [m.peso_g, m.comprimento_cm, m.largura_cm, m.altura_cm] : null]);
}

/**
 * Contas que entram na publicação: as liberadas + as "conferir" que você
 * confirmou (possível duplicidade conferida). Impedidas ficam de fora.
 * conferidas: { [contaId]: true }.
 */
export function contasLiberadas(resultados = [], conferidas = {}) {
  return (resultados || [])
    .filter((r) => r.situacao === SITUACAO_CONTA.LIBERADA || (r.situacao === SITUACAO_CONTA.CONFERIR && conferidas?.[r.conta] === true))
    .map((r) => r.conta);
}

/** Texto da confirmação final: exatamente quais contas serão usadas e quais ficam de fora. */
export function resumoConfirmacao(resultados = [], conferidas = {}) {
  const usar = contasLiberadas(resultados, conferidas);
  const fora = (resultados || []).filter((r) => !usar.includes(r.conta));
  const nomes = usar.map(nomeContaPublicacao);
  return {
    contas: usar,
    nomes,
    fora: fora.map((r) => ({ conta: r.conta, nome: r.nome, motivo: r.situacao === SITUACAO_CONTA.CONFERIR ? "possível duplicidade ainda não conferida" : (r.impedimentos || []).join(" · ") })),
    texto: usar.length
      ? `Publicar SOMENTE em: ${nomes.join(", ")}.${fora.length ? ` Fora desta publicação: ${fora.map((r) => r.nome).join(", ")}.` : ""}`
      : "Nenhuma conta liberada: nada será publicado.",
  };
}

/**
 * Plano gravado na ficha (dados_conferencia.contas_publicacao) depois da
 * confirmação final. Uma ficha publica em UMA conta do Mercado Livre por
 * vez (paiia_anuncios_publicacoes: 1 linha por ficha × marketplace): a
 * primeira conta confirmada é a desta ficha; as demais ficam na fila.
 */
export function montarPlanoContas({ selecao, resultados = [], conferidas = {}, agora = new Date().toISOString() }) {
  const confirmadas = contasLiberadas(resultados, conferidas);
  return {
    versao: 1,
    selecionadas: normalizarContasSelecionadas(selecao),
    confirmadas,
    conta_desta_ficha: confirmadas[0] || "",
    fila: confirmadas.slice(1),
    impedidas: (resultados || []).filter((r) => !confirmadas.includes(r.conta)).map((r) => ({ conta: r.conta, nome: r.nome, situacao: r.situacao, impedimentos: r.impedimentos || [] })),
    verificacao: (resultados || []).map((r) => ({ conta: r.conta, nome: r.nome, situacao: r.situacao, frete: r.frete, margem: r.margem, verificado_em: r.verificado_em })),
    confirmado_em: agora,
  };
}

/**
 * Conta usada SÓ para a estimativa de frete da preparação (Novo Anúncio):
 * a conta ativa; senão a primeira conectada na ordem LOJA ONLINE,
 * REVELAÇÃO, CIEBR; senão qualquer conectada. Não é a conta da publicação.
 */
export function contaReferenciaFrete(contasConectadas = []) {
  const lista = (Array.isArray(contasConectadas) ? contasConectadas : []).filter((c) => idConta(c?.ml_user_id));
  return lista.find((c) => c.ativa)
    || CONTAS_PUBLICACAO_ML.map((x) => lista.find((c) => idConta(c.ml_user_id) === x.id)).find(Boolean)
    || lista[0]
    || null;
}
