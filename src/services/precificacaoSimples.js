// =============================================================
// PAIIA — Precificação simples do Mercado Livre (19/10/2026).
//
// Fluxo: CUSTO DA PEÇA → FRETE (cotação oficial, automática) → COMISSÃO
//        (Clássico/Premium) → PREÇO (Conservador/Recomendado/Ideal ou
//        digitado) → FINALIZAR.
//
//  - Comissões de REFERÊNCIA (ajustáveis nas opções avançadas, porque a
//    tarifa real depende da categoria e do canal): Clássico 12%,
//    Premium 17%, Shopee 20%.
//  - Trocar Clássico/Premium, a comissão, os custos ou o preço RECALCULA
//    sozinho, reaproveitando as cotações já feitas (mesma conta, medidas,
//    modalidade, tipo e preço = mesmo caminho na API = mesma cotação).
//    Só consulta o ML de novo quando um dado da cotação muda (ou ela
//    venceu). O ML recebe o tipo (gold_special/gold_pro) na consulta: se o
//    tipo mudar o frete de verdade, a nova cotação mostra.
//  - Nunca altera o preço escolhido pelo usuário.
//  - A Conferência/Publicação continuam conferindo o frete AO VIVO
//    (fretePrecificacao.conferirCotacao): o cache daqui não libera nada.
// Funções puras (sem React; armazenamento e consulta são injetados).
// =============================================================

export const COMISSOES_REFERENCIA_PADRAO = Object.freeze({ classico: 12, premium: 17, shopee: 20 });
export const CHAVE_COMISSOES_REFERENCIA = "paiiaComissoesReferencia";
/** Validade de uma cotação reaproveitada dentro do Novo Anúncio. */
export const VALIDADE_COTACAO_MS = 6 * 60 * 60 * 1000;

const numero = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  const t = String(v ?? "").trim().replace(/\s/g, "").replace("%", "");
  if (!t) return NaN;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : NaN;
};
const porcentagemValida = (v) => {
  const n = numero(v);
  return Number.isFinite(n) && n >= 0 && n < 100 ? Math.round(n * 100) / 100 : null;
};

/** Comissões de referência salvas (JSON) + padrões para o que faltar/for inválido. */
export function lerComissoesReferencia(texto) {
  let salvo;
  try {
    salvo = typeof texto === "string" && texto ? JSON.parse(texto) : texto && typeof texto === "object" ? texto : {};
  } catch {
    salvo = {};
  }
  const out = { ...COMISSOES_REFERENCIA_PADRAO };
  for (const k of Object.keys(out)) {
    const v = porcentagemValida(salvo?.[k]);
    if (v !== null) out[k] = v;
  }
  return out;
}

/** Comissão de referência do canal/tipo (null = sem referência, ex.: site próprio). */
export function comissaoDeReferencia({ canal, tipo, refs = COMISSOES_REFERENCIA_PADRAO }) {
  if (canal === "shopee") return refs.shopee;
  if (canal === "mercado_livre" || !canal) return String(tipo).toLowerCase() === "premium" ? refs.premium : refs.classico;
  return null;
}
export const textoPorcentagem = (n) => String(Math.round(Number(n) * 100) / 100).replace(".", ",");

/**
 * Consulta somente leitura com cache por caminho (o caminho já contém
 * conta, medidas, modalidade, tipo, categoria e preço). Só respostas OK
 * entram no cache; vencida a validade, consulta de novo.
 */
export function criarConsultaComCache({ consultar, validadeMs = VALIDADE_COTACAO_MS, agora = () => Date.now(), cache = new Map() }) {
  const f = async (caminho) => {
    const c = cache.get(caminho);
    if (c && agora() - c.em < validadeMs) return c.resposta;
    const resposta = await consultar(caminho);
    if (resposta?.ok) cache.set(caminho, { em: agora(), resposta });
    return resposta;
  };
  f.cache = cache;
  return f;
}

/** O que define um cálculo (se nada disso mudou, não recalcula). */
export function assinaturaRecalculo({ params, base, preco }) {
  const p = numero(preco);
  return JSON.stringify([params?.conta, params?.medida, params?.modalidade, params?.categoria, params?.tipoAnuncio, base?.custo, base?.despesas, base?.comissao, base?.imposto, Number.isFinite(p) && p > 0 ? Math.round(p * 100) / 100 : 0]);
}

/**
 * Deve recalcular sozinho agora?
 *  - faltam dados (conta/medidas/modalidade/custo) → não;
 *  - já tentou exatamente com estes dados (ok ou erro) → não (sem laço);
 *  - sem cotação ou desatualizado → sim;
 *  - registro válido mas o preço final mudou (mesma faixa) → sim, para o
 *    resultado/margem do preço escolhido não ficar de outro preço.
 */
/** Só falta o usuário escolher o preço final (margens já calculadas)? */
export function soFaltaPreco({ situacao, registro, preco }) {
  const p = numero(preco);
  if (Number.isFinite(p) && p > 0) return false;
  if (!registro?.margens || situacao?.estado !== "desatualizado") return false;
  return (situacao.motivos || []).every((m) => /preço final ainda não cotado/.test(m));
}

export function precisaRecalcular({ pronto, situacao, registro, preco, assinatura, ultimaTentativa }) {
  if (!pronto) return false;
  if (soFaltaPreco({ situacao, registro, preco })) return false;
  if (assinatura && assinatura === ultimaTentativa) return false;
  if (!registro || situacao?.estado === "sem_cotacao" || situacao?.estado === "desatualizado") return true;
  const p = numero(preco);
  const precoFinal = Number(registro?.final?.preco || 0);
  if (Number.isFinite(p) && p > 0 && Math.round(p * 100) !== Math.round(precoFinal * 100)) return true;
  return false;
}

/** Resumo de uma linha para o passo ② (frete). */
export function resumoFrete(registro) {
  const d = registro?.final || registro?.margens?.recomendado || null;
  if (!d) return null;
  return {
    valor: Number(d.custo_vendedor ?? d.frete ?? 0),
    peso: d.peso_cobrado_g || null,
    faixa: d.faixa_rotulo || "",
    cotadoEm: d.cotado_em || registro?.calculado_em || "",
    estimativa: registro?.origem !== "mercado_livre" || (d.origem && d.origem !== "mercado_livre"),
    simulacao: registro?.origem === "simulacao_teste" || d.origem === "simulacao_teste",
  };
}
