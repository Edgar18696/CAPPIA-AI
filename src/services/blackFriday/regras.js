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

import { CONTAS_BLACK_FRIDAY } from "./contas.js";
export { CONTAS_BLACK_FRIDAY };

export const DESCONTOS = Object.freeze({ renault: 10, demais: 5 });
export const PADROES_BF = Object.freeze({
  margemMinimaPct: 10,   // abaixo disto (e acima de zero) = alerta de margem
  limiteFreteGratis: 79, // abaixo deste preço a regra de frete do ML muda
  // (15/11) Peça sem custo (lote Renault): tarifa+frete+imposto podem consumir no máximo 40%
  // do preço final (repasse ≥ 60%); acima disso é risco relevante → revisão.
  repasseMinimoPct: 60,
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
 * (15/11) Marca do veículo de um produto do catálogo do ML (GET /products/{id}):
 * atributo BRAND ou, sem ele, a 1ª palavra do nome ("Renault Sandero 1.6 2012").
 */
export function marcaDoProdutoCatalogo(resp) {
  if (!resp?.ok) return null;
  const d = resp.dados || {};
  const attrs = Array.isArray(d.attributes) ? d.attributes : [];
  const b = attrs.find((x) => x?.id === "BRAND" || x?.id === "VEHICLE_BRAND");
  const nome = txt(b?.value_name ?? b?.values?.[0]?.name);
  if (nome) return normalizar(nome);
  const n = normalizar(d.name);
  return n ? n.split(" ")[0] : null;
}

/** Ids de catálogo dos veículos de uma resposta de compatibilidades. */
export function idsCatalogoDaCompatibilidade(resp) {
  const d = resp?.dados;
  const lista = Array.isArray(d?.products) ? d.products : Array.isArray(d?.compatibilities) ? d.compatibilities : Array.isArray(d) ? d : [];
  return [...new Set(lista.map((p) => txt(p?.catalog_product_id || p?.id)).filter(Boolean))];
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
    const conf = Number.isFinite(c.conferidos) ? ` Conferidos ${c.conferidos} de ${c.quantidade} veículos no catálogo do ML, nenhum Renault.` : "";
    return { classe: CLASSES.REVISAO, evidencias: [], manual: false, duvida: `Compatibilidades lidas, mas sem a marca de todos os veículos: não dá para confirmar se há Renault.${conf}` };
  }
  return { classe: CLASSES.DEMAIS, evidencias: c.lido ? [] : ["Compatibilidades não lidas: sem indício de Renault no anúncio"], duvida: null, manual: false };
}

/** Desconto da classe (não cumulativo). Revisão sem decisão: simula com 10% (pior caso para a margem). */
export function descontoDaClasse(classe) {
  if (classe === CLASSES.RENAULT) return DESCONTOS.renault;
  if (classe === CLASSES.DEMAIS) return DESCONTOS.demais;
  return DESCONTOS.renault;
}

// (16/11) Arredonda PARA BAIXO no centavo: o ML recusa desconto individual abaixo de 5%
// ("buyer_discount_not_in_range"); arredondar para cima podia dar 4,99%.
export const precoComDesconto = (preco, pctDesconto) => Math.floor(num(preco) * (1 - num(pctDesconto) / 100) * 100 + 1e-6) / 100;

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

/**
 * (15/11) Preço de venda atual (GET /items/{id}/sale_price?context=channel_marketplace).
 * Mostra se HÁ promoção ativa agora; não mostra as programadas.
 */
export function lerPrecoVenda(resp) {
  if (!resp?.ok) return { lido: false, erro: txt(resp?.erro) || `HTTP ${resp?.status || "?"}` };
  const d = resp.dados || {};
  const valor = num(d.amount);
  const regular = num(d.regular_amount);
  if (!(valor > 0)) return { lido: false, erro: "preço de venda sem valor" };
  const ativa = regular > valor;
  return { lido: true, ativa, preco: valor, regular: regular || null, tipo: txt(d.metadata?.promotion_type) || null, promocao_id: txt(d.metadata?.promotion_id) || null };
}

const reaisBF = (v) => `R$ ${centavos(v).toFixed(2).replace(".", ",")}`;

/**
 * (15/11) Situação de promoções do anúncio. Falha de leitura NUNCA vale como ausência.
 * @returns {{ estado: "sem_promocao"|"conflito"|"nao_verificada", texto: string, ativas: object[] }}
 */
export function verificarPromocao(promo, precoVenda, item) {
  const p = promo || { lido: false, ativas: [] };
  const sv = precoVenda || { lido: false };
  const ativas = [...(p.ativas || [])];
  if (sv.lido && sv.ativa && !ativas.length) ativas.push({ id: sv.promocao_id, tipo: sv.tipo || "preço promocional", status: "started", preco: sv.preco, preco_original: sv.regular });
  if (num(item?.original_price) > num(item?.price) && !ativas.length) ativas.push({ id: null, tipo: "preço promocional", status: "started", preco: num(item.price), preco_original: num(item.original_price) });
  if (ativas.length) {
    return { estado: "conflito", ativas, texto: `Já participa de promoção (${ativas.map((x) => `${x.tipo || "?"} ${x.status}${x.preco ? ` a ${reaisBF(x.preco)}` : ""}`).join(", ")}): descontos não são cumulativos.` };
  }
  if (p.lido) return { estado: "sem_promocao", ativas, texto: "Sem promoção ativa ou programada (lido no ML)." };
  const extra = sv.lido ? " O preço de venda atual não tem desconto, mas promoções programadas não puderam ser conferidas." : "";
  return { estado: "nao_verificada", ativas, texto: `Promoção não verificada (${p.erro || "sem leitura"}).${extra} Fica em revisão.` };
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

  // Promoções já existentes: nunca acumula. Falha de leitura NUNCA vale como "sem promoção".
  const promo = a.promocoes || { lido: false, ativas: [], candidatas: [] };
  const verif = verificarPromocao(promo, a.precoVenda, item);
  if (verif.estado !== "sem_promocao") motivos.push(verif.texto);

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
  // (18/11) Imposto fica para um projeto separado: sem ele, nada é inventado — a margem fica "não verificada".
  if (perfil.impostoPct === null) motivos.push("Imposto não informado: margem não verificada (impostos serão tratados em projeto separado).");

  // (15/11) Despesas CONHECIDAS da venda (sem o custo da peça): tarifa + frete + imposto + custo por pedido.
  // "Repasse" = o que sobra do preço final para pagar a peça. Serve para achar risco sem inventar custo.
  const imposto = perfil.impostoPct === null ? null : centavos(precoFinal * perfil.impostoPct / 100);
  const despesasConhecidas = tarifa !== null && frete !== null && imposto !== null;
  const repasse = despesasConhecidas && precoFinal > 0 ? centavos(precoFinal - tarifa - frete - imposto - num(perfil.custoPedido)) : null;
  const repassePct = repasse !== null ? Math.round((repasse / precoFinal) * 1000) / 10 : null;

  if (custo === null) {
    const texto = `Custo não informado — margem não verificável (${custoMotivo}). Custo e lucro não são inventados.`;
    // Peça Renault comprovada (lote sem custo individual): mantém os 10%, mas nunca libera sozinha:
    // só vai para "Atenção" (aprovação com confirmação extra) se as despesas conhecidas deixarem
    // repasse suficiente; risco relevante ou despesas desconhecidas → revisão.
    if (cls.classe === CLASSES.RENAULT) {
      if (repasse === null) motivos.push(`${texto} Despesas da venda incompletas: risco não avaliado.`);
      else if (repassePct < cfg.repasseMinimoPct) motivos.push(`${texto} RISCO: tarifa, frete e impostos já consomem ${String(Math.round((100 - repassePct) * 10) / 10).replace(".", ",")}% do preço final (sobra ${reaisBF(repasse)} para a peça).`);
      else alertas.push(`${texto} Despesas conhecidas consomem ${String(Math.round((100 - repassePct) * 10) / 10).replace(".", ",")}%; sobra ${reaisBF(repasse)} para a peça.`);
    } else {
      motivos.push(texto);
    }
  }

  let lucro = null;
  let margemPct = null;
  if (custo !== null && despesasConhecidas && precoFinal > 0) {
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
    condicao: txt(item.condition) || null, tipo_anuncio: txt(item.listing_type_id) || null,
    estoque: num(item.available_quantity),
    vendidos: item.sold_quantity === null || item.sold_quantity === undefined ? null : num(item.sold_quantity),
    classe: cls.classe, evidencias: cls.evidencias, duvida: cls.duvida, decisao,
    desconto_pct: desconto,
    preco_original: precoOriginal,
    preco_final: precoFinal,
    custo, tarifa, frete, frete_origem: freteOrigem, imposto, custo_pedido: num(perfil.custoPedido),
    lucro, margem_pct: margemPct, repasse, repasse_pct: repassePct, custo_motivo: custo === null ? custoMotivo : null,
    promocao: verif.estado, promocao_texto: verif.texto,
    promocoes_ativas: verif.ativas,
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

/** (15/11) Motivos de revisão/atenção mais comuns (para saber o que destrava mais anúncios). */
export function contarMotivos(linhas) {
  const n = new Map();
  for (const l of linhas || []) {
    for (const m of [...(l.motivos || []), ...(l.alertas || [])]) {
      const k = txt(m).split(/[(:]/)[0].replace(/"[^"]*"/g, "…").replace(/\d[\d.,]*/g, "N").trim();
      n.set(k, (n.get(k) || 0) + 1);
    }
  }
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([motivo, quantidade]) => ({ motivo, quantidade }));
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
