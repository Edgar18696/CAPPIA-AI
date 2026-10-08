// =============================================================
// PAIIA — Frete do Mercado Livre e precificação JUNTOS (09/10/2026).
//
// Ordem: CONTA → PESO/EMBALAGEM → COTAÇÃO ML → PRECIFICAÇÃO →
//        CONFERÊNCIA → PUBLICAÇÃO. Um registro só ("freteML") segue a ficha.
//
//  - Fonte principal: cotação OFICIAL do Mercado Livre para a conta
//    (GET /users/{conta}/shipping_options/free?verbose=true):
//      list_cost            = frete pago pelo vendedor (já com o desconto da conta)
//      discount.promoted_amount = frete cheio; discount.rate = desconto
//      billable_weight      = peso considerado (cobrado) pelo ML
//  - O frete depende da FAIXA DE PREÇO do anúncio e o preço depende do
//    frete: convergência cotação → preço → conferir faixa → nova cotação.
//  - Sem cotação real: ESTIMATIVA PAIIA identificada (só para analisar);
//    a publicação continua bloqueada.
//  - Mudou conta, peso, medida, modalidade, categoria, tipo de anúncio ou
//    o preço para outra faixa: FRETE/PRECIFICAÇÃO DESATUALIZADOS.
// Funções puras (a consulta ao ML é injetada em `consultar`).
// =============================================================
import { dimensoesParaApi, normalizarMedida, medidaCompleta, pesoCubicoG } from "./logistica/logisticaMercadoLivre.js";

/**
 * Limites de faixa de preço em que o custo do frete do ML muda
 * (observados na API da conta LOJA ONLINE em 08/10/2026, 200 g):
 * < R$19 · R$19–48,99 · R$49–78,99 · R$79–99,99 · R$100–119,99 ·
 * R$120–149,99 · R$150–199,99 · ≥ R$200. A conferência final é sempre
 * uma NOVA cotação no preço real (o ML é a referência, não esta tabela).
 */
export const LIMITES_FAIXA_FRETE = Object.freeze([19, 49, 79, 100, 120, 150, 200]);
export const ORIGEM_FRETE = Object.freeze({ ML: "mercado_livre", ESTIMATIVA: "estimativa_paiia" });
export const MARGENS_PADRAO = Object.freeze([
  Object.freeze({ chave: "conservador", rotulo: "Conservador", margem: 10 }),
  Object.freeze({ chave: "recomendado", rotulo: "Recomendado", margem: 15 }),
  Object.freeze({ chave: "ideal", rotulo: "Ideal", margem: 20 }),
]);

const num = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const t = String(v ?? "").trim().replace(/\s/g, "");
  if (!t) return 0;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : 0;
};
const centavos = (v) => Math.round(num(v) * 100) / 100;
const txt = (v) => String(v ?? "").trim();
export const reais = (v) => `R$ ${centavos(v).toFixed(2).replace(".", ",")}`;

/** Índice da faixa (0 = abaixo do 1º limite). */
export function faixaDoPreco(preco) {
  const p = centavos(preco);
  let i = 0;
  while (i < LIMITES_FAIXA_FRETE.length && p >= LIMITES_FAIXA_FRETE[i]) i++;
  return i;
}
export function rotuloFaixa(preco) {
  const i = faixaDoPreco(preco);
  const de = i === 0 ? null : LIMITES_FAIXA_FRETE[i - 1];
  const ate = i === LIMITES_FAIXA_FRETE.length ? null : LIMITES_FAIXA_FRETE[i];
  if (de === null) return `abaixo de ${reais(ate)}`;
  if (ate === null) return `a partir de ${reais(de)}`;
  return `${reais(de)} a ${reais(ate - 0.01)}`;
}
export const mesmaFaixa = (a, b) => faixaDoPreco(a) === faixaDoPreco(b);

/** Custos base da precificação (campos do Novo Anúncio). */
export function baseDePrecificacao({ custo, despesas, comissao, imposto }) {
  return { custo: num(custo), despesas: num(despesas), comissao: num(comissao), imposto: num(imposto) };
}

/** Preço para uma margem líquida (mesma fórmula da precificação do PAIIA). */
export function precoComMargem({ base, frete, margem }) {
  const custoTotal = base.custo + num(frete) + base.despesas;
  const percentual = base.comissao + base.imposto + num(margem);
  if (custoTotal <= 0 || percentual >= 100) return 0;
  return centavos(custoTotal / (1 - percentual / 100));
}

/** Preço | Frete ML | Comissão/custos | Resultado/margem de um preço. */
export function resultadoDoPreco({ preco, frete, base }) {
  const p = centavos(preco);
  const comissaoValor = centavos((p * base.comissao) / 100);
  const impostoValor = centavos((p * base.imposto) / 100);
  const outros = centavos(base.custo + base.despesas + comissaoValor + impostoValor);
  const resultado = centavos(p - num(frete) - outros);
  return { preco: p, frete: centavos(frete), comissaoValor, impostoValor, custosSemFrete: outros, resultado, margemPct: p > 0 ? Math.round((resultado / p) * 1000) / 10 : 0 };
}

/** Parâmetros que definem uma cotação (o que, se mudar, a invalida). */
export function parametrosCotacao({ conta, medida, modalidade, categoria, tipoAnuncio }) {
  const m = normalizarMedida(medida || {});
  return {
    conta: txt(conta).replace(/\D/g, ""),
    medida: medidaCompleta(m) ? { peso_g: m.peso_g, comprimento_cm: m.comprimento_cm, largura_cm: m.largura_cm, altura_cm: m.altura_cm } : null,
    modalidade: txt(modalidade),
    categoria: txt(categoria),
    tipoAnuncio: txt(tipoAnuncio).toLowerCase() === "premium" ? "premium" : "classico",
  };
}
export function prontoParaCotar(p) {
  const faltando = [];
  if (!p?.conta) faltando.push("conta Mercado Livre ativa");
  if (!p?.medida) faltando.push("peso e as 3 medidas da embalagem");
  if (!p?.modalidade) faltando.push("modalidade de envio");
  return faltando;
}

/** Caminho da cotação oficial (somente leitura; ml_consulta). */
export function caminhoCotacao(p, preco) {
  const tipo = p.tipoAnuncio === "premium" ? "gold_pro" : "gold_special";
  const cat = /^MLB\d+$/.test(p.categoria) ? `&category_id=${p.categoria}` : "";
  return `/users/${p.conta}/shipping_options/free?dimensions=${encodeURIComponent(dimensoesParaApi(p.medida))}&item_price=${centavos(preco).toFixed(2)}&listing_type_id=${tipo}&mode=me2&condition=new&logistic_type=${encodeURIComponent(p.modalidade)}&verbose=true${cat}`;
}

/**
 * Lê a resposta do ML. Só aceita resposta completa: custo ≥ 0 e peso
 * cobrado > 0. Qualquer outra coisa = erro (nunca supõe).
 */
export function lerRespostaCotacao(resp) {
  if (!resp?.ok) return { ok: false, erro: txt(resp?.erro) || "Mercado Livre indisponível." };
  const c = resp?.dados?.coverage?.all_country;
  const custo = Number(c?.list_cost);
  const peso = Number(c?.billable_weight);
  if (!c || !Number.isFinite(custo) || custo < 0 || !(peso > 0)) return { ok: false, erro: "Resposta do Mercado Livre sem custo de frete (ambígua)." };
  const cheio = Number(c?.discount?.promoted_amount);
  const rate = Number(c?.discount?.rate);
  return {
    ok: true,
    custo_vendedor: centavos(custo),
    frete_cheio: Number.isFinite(cheio) && cheio > 0 ? centavos(cheio) : centavos(custo),
    desconto_pct: Number.isFinite(rate) ? Math.round(rate * 1000) / 10 : 0,
    peso_cobrado_g: Math.round(peso),
  };
}

/** Uma cotação no preço informado. consultar(caminho) → { ok, dados, erro }. */
export async function cotarNoPreco({ params, preco, consultar, agora = () => new Date().toISOString() }) {
  let resp;
  try {
    resp = await consultar(caminhoCotacao(params, preco));
  } catch (e) {
    resp = { ok: false, erro: String(e?.message || e) };
  }
  const r = lerRespostaCotacao(resp);
  return { ...r, preco_cotado: centavos(preco), faixa: faixaDoPreco(preco), faixa_rotulo: rotuloFaixa(preco), cotado_em: agora(), origem: ORIGEM_FRETE.ML };
}

/**
 * ESTIMATIVA PAIIA (sem cotação real): só para analisar, NUNCA libera a
 * publicação. Base: valores reais observados para embalagem pequena
 * (peso cobrado até 500 g); acima disso não há estimativa confiável.
 */
const ESTIMATIVA_ATE_500G = [5.65, 6.85, 8.15, 12.95, 14.95, 16.95, 19.05, 21.65];
export function estimativaPAIIA({ medida, preco }) {
  const m = normalizarMedida(medida || {});
  if (!medidaCompleta(m)) return { ok: false, erro: "Sem peso/medidas para estimar." };
  const peso = Math.max(m.peso_g, pesoCubicoG(m));
  if (peso > 500) return { ok: false, erro: "Sem estimativa confiável acima de 500 g: é preciso a cotação do Mercado Livre." };
  const i = faixaDoPreco(preco);
  return { ok: true, origem: ORIGEM_FRETE.ESTIMATIVA, custo_vendedor: ESTIMATIVA_ATE_500G[i], frete_cheio: null, desconto_pct: null, peso_cobrado_g: Math.round(peso), preco_cotado: centavos(preco), faixa: i, faixa_rotulo: rotuloFaixa(preco), cotado_em: null };
}

/**
 * Convergência frete × preço para UMA margem:
 * cotação (faixa) → preço → mesma faixa? fim : nova cotação.
 * `cotarFaixa(preco)` devolve a cotação (cacheada por faixa).
 */
export async function convergirPreco({ base, margem, cotarFaixa, maxVoltas = 8 }) {
  let preco = precoComMargem({ base, frete: 0, margem });
  if (!(preco > 0)) return { ok: false, erro: "Informe o custo da mercadoria para calcular o preço." };
  const voltas = [];
  for (let i = 0; i < maxVoltas; i++) {
    const cot = await cotarFaixa(preco);
    if (!cot?.ok) return { ok: false, erro: cot?.erro || "Sem cotação de frete.", voltas };
    const novo = precoComMargem({ base, frete: cot.custo_vendedor, margem });
    voltas.push({ preco_cotado: preco, frete: cot.custo_vendedor, preco_calculado: novo });
    if (mesmaFaixa(novo, preco)) {
      return { ok: true, preco: novo, cotacao: cot, voltas, ...resultadoDoPreco({ preco: novo, frete: cot.custo_vendedor, base }) };
    }
    preco = novo;
  }
  return { ok: false, erro: "Frete e preço não convergiram (faixas oscilando): confira os custos.", voltas };
}

/**
 * Perto de um limite de faixa (ex.: R$ 79,00), compara com o preço logo
 * abaixo (R$ 78,99) e, quando vale a pena, SUGERE — nunca altera o preço.
 */
export async function sugestaoFaixa({ preco, base, cotarFaixa, folgaPct = 12 }) {
  const p = centavos(preco);
  const i = faixaDoPreco(p);
  if (i === 0) return null;
  const limite = LIMITES_FAIXA_FRETE[i - 1];
  if (p > limite * (1 + folgaPct / 100)) return null;
  const alternativo = centavos(limite - 0.01);
  const [ca, cb] = [await cotarFaixa(p), await cotarFaixa(alternativo)];
  if (!ca?.ok || !cb?.ok) return null;
  const atual = resultadoDoPreco({ preco: p, frete: ca.custo_vendedor, base });
  const alt = resultadoDoPreco({ preco: alternativo, frete: cb.custo_vendedor, base });
  const diferencaFrete = centavos(ca.custo_vendedor - cb.custo_vendedor);
  if (diferencaFrete <= 0) return null;
  return {
    limite,
    atual: { ...atual, faixa_rotulo: rotuloFaixa(p) },
    alternativa: { ...alt, faixa_rotulo: rotuloFaixa(alternativo) },
    diferencaFrete,
    vantajosa: alt.resultado >= atual.resultado,
    texto: alt.resultado >= atual.resultado
      ? `Em ${reais(alternativo)} o frete cai ${reais(diferencaFrete)} e o resultado fica ${reais(alt.resultado)} (em ${reais(p)}: ${reais(atual.resultado)}). Sugestão: ${reais(alternativo)}. Você decide.`
      : `Em ${reais(alternativo)} o frete cai ${reais(diferencaFrete)}, mas o resultado fica ${reais(alt.resultado)} (em ${reais(p)}: ${reais(atual.resultado)}).`,
  };
}

/** Cache por (parâmetros, faixa): uma consulta por faixa. */
export function criarCotadorPorFaixa({ params, consultar, estimar = false }) {
  const cache = new Map();
  return async (preco) => {
    const chave = faixaDoPreco(preco);
    if (cache.has(chave)) return cache.get(chave);
    let c = await cotarNoPreco({ params, preco, consultar });
    if (!c.ok && estimar) {
      const e = estimativaPAIIA({ medida: params.medida, preco });
      c = e.ok ? { ...e, erro_ml: c.erro } : { ...c, erro_estimativa: e.erro };
    }
    cache.set(chave, c);
    return c;
  };
}

/**
 * Calcula TUDO junto: Conservador/Recomendado/Ideal (convergidos) e o preço
 * final escolhido (se houver). Sem cotação real: estimativa identificada.
 * Devolve o REGISTRO que vai para a ficha (freteML).
 */
export async function calcularFreteEPrecos({ params, base, precoFinal, consultar, agora = () => new Date().toISOString() }) {
  const falta = prontoParaCotar(params);
  if (falta.length) return { ok: false, erro: `Falta: ${falta.join(", ")}.` };
  if (!(base.custo > 0)) return { ok: false, erro: "Informe o custo da mercadoria." };
  const cotador = criarCotadorPorFaixa({ params, consultar, estimar: true });
  const margens = {};
  for (const m of MARGENS_PADRAO) {
    const r = await convergirPreco({ base, margem: m.margem, cotarFaixa: cotador });
    if (!r.ok) return { ok: false, erro: r.erro };
    margens[m.chave] = { rotulo: m.rotulo, margem: m.margem, preco: r.preco, frete: r.cotacao.custo_vendedor, frete_cheio: r.cotacao.frete_cheio, desconto_pct: r.cotacao.desconto_pct, peso_cobrado_g: r.cotacao.peso_cobrado_g, origem: r.cotacao.origem, faixa_rotulo: rotuloFaixa(r.preco), comissaoValor: r.comissaoValor, impostoValor: r.impostoValor, custosSemFrete: r.custosSemFrete, resultado: r.resultado, margemPct: r.margemPct };
  }
  let final = null;
  let sugestao = null;
  if (centavos(precoFinal) > 0) {
    const c = await cotador(precoFinal);
    if (!c.ok) return { ok: false, erro: c.erro };
    // Preço final: cotação NO PRÓPRIO preço (não só na faixa).
    const exata = c.origem === ORIGEM_FRETE.ML ? await cotarNoPreco({ params, preco: precoFinal, consultar, agora }) : c;
    const cf = exata.ok ? exata : c;
    final = { ...cf, ...resultadoDoPreco({ preco: precoFinal, frete: cf.custo_vendedor, base }) };
    sugestao = await sugestaoFaixa({ preco: precoFinal, base, cotarFaixa: cotador });
  }
  const todas = [...Object.values(margens), ...(final ? [final] : [])];
  const origem = todas.every((x) => x.origem === ORIGEM_FRETE.ML) ? ORIGEM_FRETE.ML : ORIGEM_FRETE.ESTIMATIVA;
  const ref = final || margens.recomendado;
  return {
    ok: true,
    registro: {
      versao: 1,
      ...params,
      origem,
      calculado_em: agora(),
      base,
      margens,
      final: final
        ? { preco: final.preco, preco_cotado: final.preco_cotado, faixa: final.faixa, faixa_rotulo: final.faixa_rotulo, custo_vendedor: final.custo_vendedor, frete_cheio: final.frete_cheio, desconto_pct: final.desconto_pct, peso_cobrado_g: final.peso_cobrado_g, origem: final.origem, cotado_em: final.cotado_em, resultado: final.resultado, margemPct: final.margemPct, comissaoValor: final.comissaoValor, impostoValor: final.impostoValor, custosSemFrete: final.custosSemFrete }
        : null,
      peso_cobrado_g: ref?.peso_cobrado_g ?? null,
      sugestao,
    },
  };
}

function mesmaMedida(a, b) {
  if (!a || !b) return false;
  return ["peso_g", "comprimento_cm", "largura_cm", "altura_cm"].every((k) => Math.abs(Number(a[k]) - Number(b[k])) < 0.05);
}
const NOME_MEDIDA = { peso_g: "peso", comprimento_cm: "comprimento", largura_cm: "largura", altura_cm: "altura" };

/**
 * Situação do registro de frete frente aos dados ATUAIS do anúncio.
 * estado: "sem_cotacao" | "estimativa" | "desatualizado" | "ok".
 * preco: preço final atual (precisa estar na faixa cotada).
 */
export function situacaoFrete({ registro, atual }) {
  if (!registro || !registro.final && !registro.margens) return { estado: "sem_cotacao", motivos: ["Frete ainda não cotado no Mercado Livre para este anúncio."] };
  const a = parametrosCotacao(atual || {});
  const motivos = [];
  if (a.conta && registro.conta && a.conta !== registro.conta) motivos.push(`conta mudou (cotado na conta ${registro.conta}; agora ${a.conta})`);
  if (!a.conta) motivos.push("sem conta Mercado Livre selecionada");
  if (a.medida && registro.medida && !mesmaMedida(a.medida, registro.medida)) {
    for (const k of Object.keys(NOME_MEDIDA)) if (Math.abs(Number(a.medida[k]) - Number(registro.medida[k])) >= 0.05) motivos.push(`${NOME_MEDIDA[k]} mudou (${registro.medida[k]} → ${a.medida[k]})`);
  }
  if (!a.medida) motivos.push("peso/medidas incompletos");
  if (a.modalidade && registro.modalidade && a.modalidade !== registro.modalidade) motivos.push(`modalidade mudou (${registro.modalidade} → ${a.modalidade})`);
  if (a.categoria && registro.categoria && a.categoria !== registro.categoria) motivos.push(`categoria mudou (${registro.categoria} → ${a.categoria})`);
  if (registro.tipoAnuncio && a.tipoAnuncio !== registro.tipoAnuncio) motivos.push(`tipo de anúncio mudou (${registro.tipoAnuncio} → ${a.tipoAnuncio})`);
  if (atual?.base && registro.base) {
    const nomes = { custo: "custo da mercadoria", despesas: "embalagem/despesas", comissao: "comissão", imposto: "impostos" };
    for (const k of Object.keys(nomes)) if (Math.abs(num(atual.base[k]) - num(registro.base[k])) > 0.004) motivos.push(`${nomes[k]} mudou (${registro.base[k]} → ${atual.base[k]})`);
  }
  const precoAtual = centavos(atual?.preco);
  if (!registro.final) motivos.push("preço final ainda não cotado (escolha o preço e recalcule)");
  else if (precoAtual > 0 && !mesmaFaixa(precoAtual, registro.final.preco_cotado)) motivos.push(`preço ${reais(precoAtual)} está em outra faixa de frete (${rotuloFaixa(precoAtual)}); frete cotado em ${reais(registro.final.preco_cotado)} (${registro.final.faixa_rotulo})`);
  if (motivos.length) return { estado: "desatualizado", motivos };
  if (registro.origem !== ORIGEM_FRETE.ML || registro.final?.origem !== ORIGEM_FRETE.ML) {
    return { estado: "estimativa", motivos: ["Frete é ESTIMATIVA PAIIA (sem cotação real do Mercado Livre): a publicação fica bloqueada até haver cotação real."] };
  }
  return { estado: "ok", motivos: [] };
}

/**
 * Conferência ⑥ / Publicação: NOVA leitura do ML com os parâmetros do
 * registro só para conferir. Diferença = mostrar e mandar recalcular
 * (nunca substitui o registro em silêncio).
 */
export function conferirCotacao({ registro, nova }) {
  if (!nova?.ok) return { ok: false, motivo: `não foi possível confirmar o frete no Mercado Livre (${nova?.erro || "erro"})` };
  const f = registro?.final;
  if (!f) return { ok: false, motivo: "registro sem preço final cotado" };
  const difs = [];
  if (centavos(nova.custo_vendedor) !== centavos(f.custo_vendedor)) difs.push(`frete ${reais(f.custo_vendedor)} → ${reais(nova.custo_vendedor)}`);
  if (Number(nova.peso_cobrado_g) !== Number(f.peso_cobrado_g)) difs.push(`peso cobrado ${f.peso_cobrado_g} g → ${nova.peso_cobrado_g} g`);
  return difs.length ? { ok: false, diferenca: true, motivo: `o Mercado Livre agora cota diferente: ${difs.join("; ")}. Volte ao Novo Anúncio e recalcule a precificação.` } : { ok: true, motivo: "" };
}

/** Linhas da tabela simples: Preço | Frete ML | Comissão/custos | Resultado/margem. */
export function linhasTabela(registro) {
  if (!registro) return [];
  const l = MARGENS_PADRAO.map((m) => registro.margens?.[m.chave]).filter(Boolean).map((x) => ({ rotulo: `${x.rotulo} (${x.margem}%)`, ...x }));
  if (registro.final) l.push({ rotulo: "Preço final escolhido", ...registro.final, frete: registro.final.custo_vendedor });
  return l;
}
