// =============================================================
// PAIIA — Black Friday 2026: REGRAS (classificação, simulação, margem,
// situação, filtros). Funções PURAS: sem rede, sem React, sem gravar nada.
//
// Regras comerciais (Edgar, 15/11/2026):
//   - 5% para os produtos em geral;
//   - 10% para peças com aplicação Renault COMPROVADA (original ou paralela),
//     inclusive quando a peça também serve em outras montadoras;
//   - descontos NÃO cumulativos (nunca soma com outra promoção);
//   - aplicação Renault duvidosa → revisão manual;
//   - prejuízo ou margem não verificável → revisão (nunca inventa custo).
// FASE 1: somente simulação. Nada aqui altera preço, anúncio ou estoque.
// =============================================================
import { num, txt, centavos, normalizar, codigoLimpo, atributo, skuDoItem } from "../paizinhoAuditoria/util.js";
import { escolherCusto, conferirCustoDoKit } from "../paizinhoAuditoria/analise.js";
import { faixaDoPreco } from "../fretePrecificacao.js";
import { CAMPANHA_BF } from "./calendario.js";

export const CONTAS_BLACK_FRIDAY = Object.freeze([
  Object.freeze({ id: "1729335019", nome: "LOJA ONLINE" }),
  Object.freeze({ id: "2412238242", nome: "REVELAÇÃO" }),
  Object.freeze({ id: "824312524", nome: "CIEBR" }),
]);

export const DESCONTOS = Object.freeze({ renault: 10, demais: 5 });
export const PADROES_BF = Object.freeze({
  margemMinimaPct: 10,   // abaixo disto (e acima de zero) = alerta de margem
  limiteFreteGratis: 79, // abaixo deste preço a regra de frete do ML muda
});

export const CLASSES = Object.freeze({ RENAULT: "renault", DEMAIS: "demais", REVISAO: "revisao" });
export const SITUACOES = Object.freeze({
  APTO: "apto",           // pode ser aprovado
  ATENCAO: "atencao",     // pode ser aprovado com confirmação extra (margem baixa etc.)
  REVISAO: "revisao",     // precisa de decisão/correção antes de aprovar
  BLOQUEADO: "bloqueado", // não entra na campanha (anúncio não ativo, sem preço...)
  EXCLUIDO: "excluido",   // tirado da campanha pelo usuário
});
export const ROTULO_CLASSE = Object.freeze({ renault: "Renault", demais: "Demais", revisao: "Revisão" });
export const ROTULO_SITUACAO = Object.freeze({ apto: "Pronto para aprovar", atencao: "Atenção", revisao: "Revisão", bloqueado: "Bloqueado", excluido: "Fora da campanha" });

export const contaBF = (id) => CONTAS_BLACK_FRIDAY.find((c) => c.id === txt(id).replace(/\D/g, "")) || null;

// Modelos Renault vendidos no Brasil. Citação no TEXTO nunca comprova a
// aplicação: só manda para revisão. ("Master" e "Trafic" ficam de fora:
// "master" aparece em cilindro mestre/mastervac de outras marcas.)
const MODELOS_RENAULT = ["renault", "clio", "logan", "sandero", "stepway", "duster", "oroch", "kwid", "captur", "megane", "scenic", "fluence", "symbol", "kangoo", "twingo", "laguna", "koleos", "zoe"];
const RE_MODELO_RENAULT = new RegExp(`\\b(${MODELOS_RENAULT.join("|")})\\b`);
/** Código no padrão de numeração Renault (77/82 + 8 dígitos). Só indício. */
const RE_CODIGO_RENAULT = /^(77|82)\d{8}$/;

/**
 * Lê as marcas de veículos da resposta de /items/{id}/compatibilities.
 * @returns {{ lido: boolean, quantidade: number|null, marcas: string[], legivel: boolean }}
 */
export function marcasDaCompatibilidade(resp) {
  if (!resp?.ok) {
    if (Number(resp?.status) === 404) return { lido: true, quantidade: 0, marcas: [], legivel: true }; // categoria sem compatibilidade
    return { lido: false, quantidade: null, marcas: [], legivel: false };
  }
  const d = resp.dados;
  const lista = Array.isArray(d?.products) ? d.products : Array.isArray(d?.compatibilities) ? d.compatibilities : Array.isArray(d) ? d : [];
  const marcas = new Set();
  let legiveis = 0;
  for (const p of lista) {
    const attrs = Array.isArray(p?.attributes) ? p.attributes : [];
    const brand = attrs.find((a) => a?.id === "BRAND" || a?.id === "VEHICLE_BRAND");
    const nome = txt(brand?.value_name ?? brand?.values?.[0]?.name ?? p?.brand ?? p?.brand_name);
    if (nome) { marcas.add(normalizar(nome)); legiveis++; continue; }
    const titulo = normalizar(p?.name || p?.title);
    if (titulo) { marcas.add(titulo.split(" ")[0]); legiveis++; }
  }
  return { lido: true, quantidade: lista.length, marcas: [...marcas], legivel: lista.length === 0 || legiveis === lista.length };
}

/**
 * Classifica o anúncio: Renault (10%), Demais (5%) ou Revisão.
 * `decisao` = escolha manual do usuário na revisão ("renault"|"demais"|"excluir").
 * @returns {{ classe, evidencias: string[], duvida: string|null, manual: boolean }}
 */
export function classificarRenault(item, compat = null, decisao = null) {
  if (decisao === CLASSES.RENAULT || decisao === CLASSES.DEMAIS) {
    return { classe: decisao, evidencias: [`Decisão manual na revisão: ${ROTULO_CLASSE[decisao]}`], duvida: null, manual: true };
  }
  const evid = [];
  const marca = normalizar(atributo(item, "BRAND"));
  if (marca.includes("renault")) evid.push("Marca da peça: Renault (original)");
  const c = compat || { lido: false, marcas: [] };
  const comRenault = c.marcas?.includes("renault");
  if (comRenault) {
    const outras = c.marcas.filter((m) => m !== "renault");
    evid.push(outras.length ? `Compatibilidade ML: Renault e outras montadoras (${outras.length})` : "Compatibilidade ML: Renault");
  }
  if (evid.length) return { classe: CLASSES.RENAULT, evidencias: evid, duvida: null, manual: false };

  const texto = normalizar(item?.title);
  const citado = texto.match(RE_MODELO_RENAULT)?.[1];
  const codigo = codigoLimpo(atributo(item, "PART_NUMBER") || atributo(item, "OEM") || atributo(item, "ORIGINAL_OEM"));
  if (citado) {
    return { classe: CLASSES.REVISAO, evidencias: [], manual: false,
      duvida: `"${citado}" aparece no título, mas a aplicação Renault não está confirmada nas compatibilidades do ML${c.lido ? "" : " (compatibilidades não lidas)"}.` };
  }
  if (RE_CODIGO_RENAULT.test(codigo)) {
    return { classe: CLASSES.REVISAO, evidencias: [], manual: false,
      duvida: `Código ${codigo} no padrão de numeração Renault, sem aplicação Renault confirmada.` };
  }
  if (c.lido && c.quantidade > 0 && !c.legivel) {
    return { classe: CLASSES.REVISAO, evidencias: [], manual: false, duvida: "Compatibilidades lidas, mas sem a marca dos veículos: não dá para confirmar se há Renault." };
  }
  return { classe: CLASSES.DEMAIS, evidencias: c.lido ? [] : ["Compatibilidades não lidas: sem indício de Renault no anúncio"], duvida: null, manual: false };
}

/** Desconto da classe (não cumulativo). Revisão sem decisão: simula com 10% (pior caso para a margem). */
export function descontoDaClasse(classe) {
  if (classe === CLASSES.RENAULT) return DESCONTOS.renault;
  if (classe === CLASSES.DEMAIS) return DESCONTOS.demais;
  return DESCONTOS.renault;
}

export const precoComDesconto = (preco, pctDesconto) => centavos(num(preco) * (1 - num(pctDesconto) / 100));

const ATIVAS = new Set(["started", "active", "pending", "programmed", "scheduled"]);

/**
 * Promoções do anúncio (resposta de /seller-promotions/items/{id}?app_version=v2).
 * @returns {{ lido, ativas: object[], candidatas: object[], erro: string|null }}
 */
export function lerPromocoes(resp) {
  if (!resp?.ok) return { lido: false, ativas: [], candidatas: [], erro: txt(resp?.erro) || `HTTP ${resp?.status || "?"}` };
  const lista = Array.isArray(resp.dados) ? resp.dados : Array.isArray(resp.dados?.results) ? resp.dados.results : null;
  if (!lista) return { lido: false, ativas: [], candidatas: [], erro: "resposta de promoções em formato inesperado" };
  const resumo = (p) => ({ id: txt(p?.id || p?.promotion_id) || null, tipo: txt(p?.type || p?.promotion_type), status: txt(p?.status), preco: num(p?.price) || null, preco_original: num(p?.original_price) || null, inicio: txt(p?.start_date) || null, fim: txt(p?.finish_date) || null, nome: txt(p?.name) || null });
  return {
    lido: true,
    ativas: lista.filter((p) => ATIVAS.has(txt(p?.status).toLowerCase())).map(resumo),
    candidatas: lista.filter((p) => txt(p?.status).toLowerCase() === "candidate").map(resumo),
    erro: null,
  };
}

/** Impostos/custo por pedido cadastrados em "Preços, Custos e Lucro" (paiiaPerfilCustos). */
export function custosDoPerfil(perfil) {
  const n = (v) => { const t = txt(v); return t === "" ? null : num(t); };
  const imposto = n(perfil?.impostoPercentual);
  return { impostoPct: imposto !== null && imposto >= 0 ? imposto : null, custoPedido: Math.max(0, n(perfil?.custoOperacionalPedido) || 0) };
}

/**
 * Simula UM anúncio na Black Friday.
 * @param {object} a leitura do anúncio: { conta, item, compat, promocoes, tarifaFinal, freteAtual, freteFinal, custo }
 * @param {object} op { decisao, perfil: custosDoPerfil(), margemMinimaPct }
 */
export function simularAnuncio(a, op = {}) {
  const cfg = { ...PADROES_BF, ...op };
  const perfil = op.perfil || { impostoPct: null, custoPedido: 0 };
  const item = a.item || {};
  const conta = txt(a.conta);
  const id = txt(item.id);
  const decisao = op.decisao || null;
  const precoOriginal = centavos(item.price);
  const cls = classificarRenault(item, a.compat, decisao);
  const desconto = descontoDaClasse(cls.classe);
  const precoFinal = precoComDesconto(precoOriginal, desconto);
  const motivos = []; // revisão
  const alertas = []; // atenção
  const bloqueios = [];

  if (String(item.seller_id ?? conta) !== conta) bloqueios.push("anúncio de outra conta");
  if (txt(item.status) && txt(item.status) !== "active") bloqueios.push(`anúncio ${txt(item.status) === "paused" ? "pausado" : txt(item.status)}`);
  if (!(precoOriginal > 0)) bloqueios.push("anúncio sem preço");

  if (cls.classe === CLASSES.REVISAO) motivos.push(cls.duvida);

  // Promoções já existentes: nunca acumula.
  const promo = a.promocoes || { lido: false, ativas: [], candidatas: [] };
  if (!promo.lido) motivos.push(`Promoções do anúncio não lidas (${promo.erro || "sem leitura"}): não dá para garantir que não há outra promoção.`);
  else if (promo.ativas.length) motivos.push(`Já participa de promoção (${promo.ativas.map((p) => `${p.tipo || "?"} ${p.status}`).join(", ")}): descontos não são cumulativos.`);
  if (num(item.original_price) > precoOriginal) motivos.push(`Anúncio já com preço promocional (de ${centavos(item.original_price)} por ${precoOriginal}).`);

  // Tarifa de venda NO PREÇO FINAL (muda com o preço).
  const tarifa = a.tarifaFinal && txt(a.tarifaFinal.valor) !== "" ? centavos(a.tarifaFinal.valor) : null;
  if (tarifa === null) motivos.push("Tarifa de venda do ML no preço final não lida.");

  // Frete pago pelo vendedor no preço final.
  const gratis = item?.shipping?.free_shipping === true;
  let frete = null;
  let freteOrigem = "";
  if (!gratis) { frete = 0; freteOrigem = "frete pago pelo comprador"; }
  else if (a.freteFinal?.ok) { frete = centavos(a.freteFinal.custo_vendedor); freteOrigem = "cotação ML no preço final"; }
  else if (a.freteAtual?.ok && faixaDoPreco(precoFinal) === faixaDoPreco(precoOriginal)) { frete = centavos(a.freteAtual.custo_vendedor); freteOrigem = "cotação ML do anúncio (mesma faixa de preço)"; }
  if (frete === null) motivos.push("Frete no preço final não confirmado pelo ML (o preço muda de faixa).");
  if (precoOriginal >= cfg.limiteFreteGratis && precoFinal < cfg.limiteFreteGratis) alertas.push(`Preço final abaixo de R$ ${cfg.limiteFreteGratis}: a regra de frete do ML muda — conferir.`);

  // Custo da mercadoria (Bling, custo_por_sku). Nunca inventado.
  const sku = skuDoItem(item);
  let custo = null;
  let custoMotivo;
  if (!sku) custoMotivo = "anúncio sem SKU";
  else if (a.custo === undefined) custoMotivo = "custo não lido no Bling";
  else {
    const e = conferirCustoDoKit(escolherCusto(a.custo), a.custo, item.title);
    if (e.custo > 0 && !e.a_confirmar) custo = e.custo;
    custoMotivo = e.a_confirmar ? `custo a confirmar (${e.motivo})` : e.custo > 0 ? "" : e.motivo;
  }
  const renaultMarca = normalizar(atributo(item, "BRAND")).includes("renault");
  if (custo === null) motivos.push(renaultMarca ? `Peça Renault sem custo individual no Bling (${custoMotivo}): margem não verificável — custo não é inventado.` : `Sem custo confiável: ${custoMotivo}. Margem não verificável.`);

  if (perfil.impostoPct === null) motivos.push("Imposto não cadastrado em Preços, Custos e Lucro: margem não verificável.");

  let lucro = null;
  let margemPct = null;
  const imposto = perfil.impostoPct === null ? null : centavos(precoFinal * perfil.impostoPct / 100);
  if (custo !== null && tarifa !== null && frete !== null && imposto !== null && precoFinal > 0) {
    lucro = centavos(precoFinal - tarifa - frete - imposto - custo - num(perfil.custoPedido));
    margemPct = Math.round((lucro / precoFinal) * 1000) / 10;
    if (lucro < 0) motivos.push(`PREJUÍZO de R$ ${(-lucro).toFixed(2).replace(".", ",")} por venda no preço final.`);
    else if (margemPct < cfg.margemMinimaPct) alertas.push(`Margem de ${String(margemPct).replace(".", ",")}% abaixo do mínimo de ${cfg.margemMinimaPct}%.`);
  }

  let situacao = SITUACOES.APTO;
  if (decisao === "excluir") situacao = SITUACOES.EXCLUIDO;
  else if (bloqueios.length) situacao = SITUACOES.BLOQUEADO;
  else if (motivos.length) situacao = SITUACOES.REVISAO;
  else if (alertas.length) situacao = SITUACOES.ATENCAO;

  return {
    chave: chaveOperacao(conta, id),
    conta, conta_nome: contaBF(conta)?.nome || conta,
    id, sku, titulo: txt(item.title), link: txt(item.permalink),
    estoque: num(item.available_quantity),
    classe: cls.classe, evidencias: cls.evidencias, duvida: cls.duvida, decisao,
    desconto_pct: desconto,
    preco_original: precoOriginal,
    preco_final: precoFinal,
    custo, tarifa, frete, frete_origem: freteOrigem, imposto, custo_pedido: num(perfil.custoPedido),
    lucro, margem_pct: margemPct,
    promocoes_ativas: promo.ativas || [],
    modalidades_candidatas: [...new Set((promo.candidatas || []).map((p) => p.tipo).filter(Boolean))],
    situacao, motivos, alertas, bloqueios,
  };
}

/** Chave única por campanha + conta + anúncio (evita operação/promoção duplicada). */
export const chaveOperacao = (conta, itemId, campanha = CAMPANHA_BF.id) => `${campanha}:${txt(conta).replace(/\D/g, "")}:${txt(itemId).toUpperCase()}`;

export const podeAprovar = (linha) => linha?.situacao === SITUACOES.APTO || linha?.situacao === SITUACOES.ATENCAO;

/** Filtros da tabela. */
export function filtrarLinhas(linhas, f = {}) {
  const busca = normalizar(f.busca);
  const buscaCod = codigoLimpo(f.busca);
  return (linhas || []).filter((l) =>
    (!f.contas?.length || f.contas.includes(l.conta)) &&
    (!f.classe || l.classe === f.classe) &&
    (!f.situacao || l.situacao === f.situacao) &&
    (!f.margemAbaixo || (l.margem_pct !== null && l.margem_pct < num(f.margemAbaixo))) &&
    (!f.soAlertas || l.alertas.length > 0 || l.motivos.length > 0) &&
    (!busca || normalizar(l.titulo).includes(busca) || (buscaCod && (codigoLimpo(l.id).includes(buscaCod) || codigoLimpo(l.sku).includes(buscaCod)))));
}

/** Totais para os cartões do topo. */
export function resumirSimulacao(linhas) {
  const r = { total: 0, renault: 0, demais: 0, revisao: 0, apto: 0, atencao: 0, revisao_sit: 0, bloqueado: 0, excluido: 0, prejuizo: 0, margem_baixa: 0, sem_margem: 0, por_conta: {} };
  for (const l of linhas || []) {
    r.total++;
    r[l.classe]++;
    r[l.situacao === SITUACOES.REVISAO ? "revisao_sit" : l.situacao]++;
    if (l.lucro !== null && l.lucro < 0) r.prejuizo++;
    if (l.lucro !== null && l.lucro >= 0 && l.alertas.some((x) => x.startsWith("Margem"))) r.margem_baixa++;
    if (l.margem_pct === null) r.sem_margem++;
    r.por_conta[l.conta_nome] = (r.por_conta[l.conta_nome] || 0) + 1;
  }
  return r;
}
