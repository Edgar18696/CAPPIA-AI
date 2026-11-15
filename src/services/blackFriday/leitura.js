// =============================================================
// PAIIA — Black Friday 2026: LEITURA das contas (SOMENTE GET).
//
// Usa as integrações que o PAIIA já tem:
//   - Mercado Livre: função mercadolivre-publicacao, ação ml_consulta, metodo GET;
//   - Bling: função bling-integracao, ação custo_por_sku (só leitura).
// Nada é gravado no ML, no Bling (estoque oficial intocado) nem no banco.
// Cada anúncio é conferido pelo vendedor (seller_id): anúncio de outra conta
// é DESCARTADO. Uma conta com falha não interrompe as outras.
// As chamadas são INJETADAS (`consultar`, `consultarCusto`) para rodar igual
// no navegador e nos testes.
// =============================================================
import { txt, num, centavos, skuDoItem, comLimite } from "../paizinhoAuditoria/util.js";
import { medidasDoAnuncio } from "../paizinhoAuditoria/analise.js";
import { lerRespostaCotacao, caminhoCotacao, parametrosCotacao, faixaDoPreco } from "../fretePrecificacao.js";
import { tipoDeCaminho, caminhoRecusado } from "../paizinhoAuditoria/coleta.js";
import { CONTAS_BLACK_FRIDAY, contaBF, classificarRenault, marcasDaCompatibilidade, lerPromocoes, lerPrecoVenda, marcaDoProdutoCatalogo, idsCatalogoDaCompatibilidade, precoComDesconto, DESCONTOS, CLASSES, simularAnuncio } from "./regras.js";

/** (15/11) Quantos veículos do catálogo são conferidos por anúncio quando a compatibilidade vem sem marca. */
export const LIMITE_VEICULOS_CONFERIDOS = 10;

export const PADROES_LEITURA = Object.freeze({ limitePorConta: 50, paralelo: 4, paraleloBling: 2 });
const ATRIBUTOS_GUARDADOS = ["BRAND", "PART_NUMBER", "OEM", "ORIGINAL_OEM", "MPN", "SELLER_SKU"];

/** Só o que a simulação usa (cabe no navegador). */
export function resumirItem(d) {
  return {
    id: d.id, seller_id: d.seller_id, title: d.title, price: d.price, original_price: d.original_price ?? null,
    status: d.status, listing_type_id: d.listing_type_id, category_id: d.category_id,
    available_quantity: d.available_quantity, permalink: d.permalink, seller_custom_field: d.seller_custom_field ?? null,
    shipping: { free_shipping: d.shipping?.free_shipping === true, logistic_type: d.shipping?.logistic_type || "" },
    attributes: (d.attributes || []).filter((a) => ATRIBUTOS_GUARDADOS.includes(a?.id)).map((a) => ({ id: a.id, value_name: a.value_name ?? a.values?.[0]?.name ?? "" })),
  };
}

const chaveTarifa = (preco, tipo, cat) => `${centavos(preco).toFixed(2)}|${txt(tipo)}|${txt(cat)}`;
/** Preços finais possíveis do anúncio (Revisão: 5% e 10%, para a decisão manual). */
export function precosFinaisPossiveis(preco, classe) {
  if (classe === CLASSES.RENAULT) return [precoComDesconto(preco, DESCONTOS.renault)];
  if (classe === CLASSES.DEMAIS) return [precoComDesconto(preco, DESCONTOS.demais)];
  return [precoComDesconto(preco, DESCONTOS.demais), precoComDesconto(preco, DESCONTOS.renault)];
}

/**
 * Lê UMA conta. `consultar(caminho)` já está presa à conta e só faz GET.
 * @returns {Promise<{ conta, nome, lido_em, total_ativos, itens, tarifas, fretes, falhas, descartados_outra_conta }>}
 */
export async function lerContaBF({ conta, consultar, limite = PADROES_LEITURA.limitePorConta, paralelo = PADROES_LEITURA.paralelo, agora = () => new Date().toISOString(), aoProgredir = () => {}, cancelado = () => false }) {
  const c = contaBF(conta);
  if (!c) throw new Error(`Conta ${conta} não faz parte da Black Friday (só LOJA ONLINE, REVELAÇÃO e CIEBR).`);
  const falhas = [];
  const falha = (etapa, id, r) => falhas.push({ conta: c.nome, etapa, id: id || null, erro: txt(r?.erro) || `HTTP ${r?.status || "?"}` });
  const passo = (t) => { try { aoProgredir(`${c.nome}: ${t}`); } catch { /* ignora */ } };

  // 1) Anúncios ativos (scan)
  passo("lendo a lista de anúncios ativos");
  const ids = [];
  let total = null;
  let scroll = "";
  for (let volta = 0; volta < 200 && ids.length < limite && !cancelado(); volta++) {
    const r = await consultar(`/users/${c.id}/items/search?status=active&search_type=scan&limit=100${scroll ? `&scroll_id=${encodeURIComponent(scroll)}` : ""}`);
    if (!r?.ok) { falha("lista de anúncios", null, r); break; }
    if (total === null) total = num(r.dados?.paging?.total) || null;
    const lote = Array.isArray(r.dados?.results) ? r.dados.results : [];
    if (!lote.length) break;
    for (const id of lote) if (!ids.includes(id)) ids.push(id);
    scroll = txt(r.dados?.scroll_id);
    if (!scroll) break;
  }
  const alvo = ids.slice(0, limite);

  // 2) Cada anúncio: detalhes (dono conferido), compatibilidades, promoções, frete atual
  const itens = [];
  const fretes = {};
  const marcaVeiculo = {}; // memória: id do veículo no catálogo → marca
  let descartados = 0;
  let feitos = 0;
  await comLimite(alvo, paralelo, async (id) => {
    if (cancelado()) return;
    const r = await consultar(`/items/${id}`);
    if (++feitos % 10 === 0) passo(`${feitos} de ${alvo.length} anúncios`);
    if (!r?.ok) { falha("anúncio", id, r); return; }
    if (String(r.dados?.seller_id) !== c.id) { descartados++; return; } // NUNCA mistura contas
    const item = resumirItem(r.dados);
    const compatResp = await consultar(`/items/${id}/compatibilities`);
    let compat = marcasDaCompatibilidade(compatResp);
    if (!compat.lido) falha("compatibilidades", id, compatResp);
    // (15/11) Compatibilidade sem a marca dos veículos: confere a marca no catálogo do ML
    // (GET /products/{id}, com memória por veículo). Sem Renault entre os conferidos e com
    // veículos não conferidos, continua em revisão (nunca deduz).
    if (compat.lido && !compat.legivel) {
      const idsVeiculos = idsCatalogoDaCompatibilidade(compatResp);
      const conferir = idsVeiculos.slice(0, LIMITE_VEICULOS_CONFERIDOS);
      const marcas = new Set();
      let lidas = 0;
      for (const pid of conferir) {
        // Memória da CONSULTA (não só do resultado): anúncios em paralelo não repetem o mesmo veículo.
        if (!(pid in marcaVeiculo)) {
          marcaVeiculo[pid] = consultar(`/products/${pid}`).then((pr) => {
            if (!pr?.ok) falha("marca do veículo (catálogo)", `${id} → ${pid}`, pr);
            return marcaDoProdutoCatalogo(pr);
          });
        }
        const marca = await marcaVeiculo[pid];
        if (marca) { marcas.add(marca); lidas++; }
      }
      const comRenault = marcas.has("renault");
      compat = { lido: true, quantidade: compat.quantidade, marcas: [...marcas], legivel: comRenault || (lidas === idsVeiculos.length && idsVeiculos.length > 0), conferidos: lidas };
    }
    const promoResp = await consultar(`/seller-promotions/items/${id}?app_version=v2`);
    const promocoes = lerPromocoes(promoResp);
    if (!promocoes.lido) falha("promoções", id, promoResp);
    // (15/11) Segunda fonte: preço de venda atual (mostra promoção ATIVA; não as programadas).
    let precoVenda = null;
    if (!promocoes.lido) {
      const pv = await consultar(`/items/${id}/sale_price?context=channel_marketplace`);
      precoVenda = lerPrecoVenda(pv);
      if (!precoVenda.lido) falha("preço de venda", id, pv);
    }
    const classe = classificarRenault(item, compat).classe;
    const finais = precosFinaisPossiveis(item.price, classe);
    if (item.shipping.free_shipping) {
      const atual = lerRespostaCotacao(await consultar(`/users/${c.id}/shipping_options/free?item_id=${id}&verbose=true`));
      fretes[`${id}|atual`] = atual;
      if (!atual.ok) falha("frete atual", id, atual);
      // Preço final em outra faixa: cotação nova no preço final (medidas do anúncio).
      const medida = medidasDoAnuncio(r.dados);
      for (const pf of finais) {
        if (faixaDoPreco(pf) === faixaDoPreco(item.price)) continue;
        if (!medida || !item.shipping.logistic_type) continue; // sem medida: fica "não confirmado" (revisão)
        const params = parametrosCotacao({ conta: c.id, medida, modalidade: item.shipping.logistic_type, categoria: item.category_id, tipoAnuncio: item.listing_type_id === "gold_pro" ? "premium" : "classico" });
        const cot = lerRespostaCotacao(await consultar(caminhoCotacao(params, pf)));
        fretes[`${id}|${pf.toFixed(2)}`] = cot;
        if (!cot.ok) falha("frete no preço final", id, cot);
      }
    }
    itens.push({ item, compat, promocoes, precoVenda });
  });

  // 3) Tarifa de venda no PREÇO FINAL (com memória por preço+tipo+categoria)
  passo("conferindo a tarifa de venda no preço final");
  const tarifas = {};
  const chaves = [...new Set(itens.flatMap(({ item, compat }) => precosFinaisPossiveis(item.price, classificarRenault(item, compat).classe).map((pf) => chaveTarifa(pf, item.listing_type_id, item.category_id))))];
  await comLimite(chaves, paralelo, async (k) => {
    if (cancelado()) return;
    const [preco, tipo, cat] = k.split("|");
    const r = await consultar(`/sites/MLB/listing_prices?price=${preco}&listing_type_id=${tipo}&category_id=${cat}`);
    const d = Array.isArray(r?.dados) ? r.dados[0] : r?.dados;
    if (r?.ok && d && d.sale_fee_amount !== undefined) tarifas[k] = { valor: centavos(d.sale_fee_amount) };
    else falha("tarifa de venda", k, r);
  });

  itens.sort((a, b) => String(a.item.id).localeCompare(String(b.item.id)));
  return { conta: c.id, nome: c.nome, lido_em: agora(), total_ativos: total, lidos: itens.length, itens, tarifas, fretes, falhas, descartados_outra_conta: descartados, interrompida: cancelado() };
}

/** Custo no Bling (custo_por_sku, só leitura) dos SKUs lidos. Para depois de 5 falhas seguidas. */
export async function lerCustosBF({ skus, consultarCusto, paralelo = PADROES_LEITURA.paraleloBling, aoProgredir = () => {}, cancelado = () => false }) {
  const custos = {};
  const falhas = [];
  let seguidas = 0;
  let feitos = 0;
  await comLimite([...new Set(skus.filter(Boolean))], paralelo, async (sku) => {
    if (cancelado() || seguidas >= 5) return;
    if (++feitos % 20 === 0) aoProgredir(`Bling: custo de ${feitos} de ${skus.length} SKUs`);
    const r = await consultarCusto(sku).catch((e) => ({ ok: false, erro: txt(e?.message || e) }));
    if (r?.ok) { custos[sku] = r; seguidas = 0; } else { falhas.push({ conta: "Bling", etapa: "custo", id: sku, erro: txt(r?.erro) }); seguidas++; }
  });
  return { custos, falhas, parou: seguidas >= 5 };
}

/**
 * Lê as contas escolhidas, uma de cada vez. Falha numa conta não para as outras.
 * `consultorDaConta(contaId)` devolve consultar(caminho) só GET naquela conta.
 */
export async function lerContasBF({ contas, consultorDaConta, consultarCusto = null, limite, aoProgredir = () => {}, cancelado = () => false, agora }) {
  const escolhidas = CONTAS_BLACK_FRIDAY.filter((c) => (contas || []).includes(c.id));
  if (!escolhidas.length) throw new Error("Escolha pelo menos uma conta.");
  const resultado = { lido_em: (agora || (() => new Date().toISOString()))(), contas: {}, custos: {}, falhas: [] };
  for (const c of escolhidas) {
    if (cancelado()) break;
    try {
      const r = await lerContaBF({ conta: c.id, consultar: consultorDaConta(c.id), limite, aoProgredir, cancelado, agora });
      resultado.contas[c.id] = r;
      resultado.falhas.push(...r.falhas);
    } catch (e) {
      resultado.falhas.push({ conta: c.nome, etapa: "conta", id: null, erro: txt(e?.message || e) });
    }
  }
  if (typeof consultarCusto === "function") {
    const skus = Object.values(resultado.contas).flatMap((r) => r.itens.map(({ item }) => skuDoItem(item)));
    const r = await lerCustosBF({ skus, consultarCusto, aoProgredir, cancelado });
    resultado.custos = r.custos;
    resultado.falhas.push(...r.falhas);
    resultado.bling_parou = r.parou;
  }
  return resultado;
}

/**
 * Monta a tabela simulada a partir da leitura (sem nenhuma consulta nova).
 * `decisoes` = { [chave]: "renault"|"demais"|"excluir" } da revisão manual.
 */
export function montarSimulacao(leitura, { decisoes = {}, perfil, margemMinimaPct } = {}) {
  const linhas = [];
  for (const r of Object.values(leitura?.contas || {})) {
    for (const { item, compat, promocoes, precoVenda } of r.itens) {
      const chave = `${r.conta}:${item.id}`;
      const decisao = decisoes[chave] || null;
      const classe = classificarRenault(item, compat, decisao).classe;
      const pf = precoComDesconto(item.price, classe === CLASSES.DEMAIS ? DESCONTOS.demais : DESCONTOS.renault);
      const tarifaFinal = r.tarifas?.[chaveTarifa(pf, item.listing_type_id, item.category_id)] || null;
      const sku = skuDoItem(item);
      linhas.push(simularAnuncio({
        conta: r.conta, item, compat, promocoes, precoVenda, tarifaFinal,
        freteAtual: r.fretes?.[`${item.id}|atual`] || null,
        freteFinal: r.fretes?.[`${item.id}|${pf.toFixed(2)}`] || null,
        custo: sku ? leitura.custos?.[sku] : undefined,
      }, { decisao, perfil, ...(margemMinimaPct ? { margemMinimaPct } : {}) }));
    }
  }
  return linhas;
}

/**
 * Adaptador do navegador: ml_consulta SEMPRE com metodo "GET" (nunca outro),
 * com nova tentativa quando o ML limita as consultas.
 * `invocar` = supabase.functions.invoke (injetado).
 */
export function consultorBF(conta, invocar, { esperar = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const contaId = txt(conta).replace(/\D/g, "");
  // (15/11) Endereço recusado pelo servidor ("fora da lista permitida"): não insiste no mesmo tipo
  // de endereço nesta leitura (antes eram 150 recusas iguais). A recusa continua sendo FALHA.
  const recusados = new Map();
  return async (caminho) => {
    const c = txt(caminho);
    if (!c.startsWith("/")) return { ok: false, erro: "Caminho inválido." };
    const tipo = tipoDeCaminho(c);
    if (recusados.has(tipo)) return recusados.get(tipo);
    for (let t = 0; t < 4; t++) {
      let r;
      try {
        const { data, error } = await invocar("mercadolivre-publicacao", { body: { acao: "ml_consulta", conta_ml: contaId, metodo: "GET", caminho: c } });
        if (error) {
          // O motivo real vem no corpo da resposta de erro (a mensagem do supabase é genérica).
          let erro = error.message;
          try { const corpo = await error.context?.json?.(); if (corpo?.erro || corpo?.error || corpo?.message) erro = corpo.erro || corpo.error || corpo.message; } catch { /* mantém */ }
          r = { ok: false, erro, status: error.context?.status };
        } else r = data || { ok: false, erro: "resposta vazia" };
      } catch (e) { r = { ok: false, erro: txt(e?.message || e) }; }
      if (r?.ok) return r;
      // Recusa de permissão do ML (403 PolicyAgent) também não muda repetindo: mesmo tratamento.
      if (caminhoRecusado(r) || /policy returned UNAUTHORIZED/i.test(txt(r?.erro))) { const marcado = { ...r, recusado: true }; recusados.set(tipo, marcado); return marcado; }
      const passageiro = [429, 500, 502, 503, 504].includes(Number(r?.status)) || /too many|rate limit|Failed to fetch/i.test(txt(r?.erro));
      if (!passageiro) return r;
      await esperar(800 * 2 ** t);
    }
    return { ok: false, erro: "o Mercado Livre limitou as consultas" };
  };
}

/**
 * (15/11) Diagnóstico de UM anúncio: roda cada leitura da Black Friday e mostra
 * a resposta real (situação, erro e um resumo do conteúdo). Só GET.
 */
export async function diagnosticarAnuncio({ conta, itemId, consultar }) {
  const c = contaBF(conta);
  const id = txt(itemId).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!c) throw new Error("Escolha uma das 3 contas.");
  if (!/^MLB\d+$/.test(id)) throw new Error("Informe o código do anúncio (MLB…).");
  const etapas = [
    ["Anúncio", `/items/${id}`],
    ["Compatibilidades", `/items/${id}/compatibilities`],
    ["Promoções (seller-promotions)", `/seller-promotions/items/${id}?app_version=v2`],
    ["Preço de venda (sale_price)", `/items/${id}/sale_price?context=channel_marketplace`],
    ["Promoções da conta", `/seller-promotions/users/${c.id}?app_version=v2`],
    ["Frete do anúncio", `/users/${c.id}/shipping_options/free?item_id=${id}&verbose=true`],
    // (15/11) Permissões (diagnóstico do 403 das promoções)
    ["Autorização desta conta ao PAIIA (escopos)", `/users/${c.id}/applications`],
    ["Cadastro do aplicativo PAIIA (permissões)", "/applications/paiia"],
  ];
  const out = [];
  for (const [etapa, caminho] of etapas) {
    const r = await consultar(caminho);
    out.push({ etapa, caminho, ok: !!r?.ok, status: r?.status ?? null, erro: r?.ok ? null : txt(r?.erro) || "falhou", resumo: r?.ok ? resumirResposta(r.dados) : null, via: r?.via || "mercadolivre-publicacao (ml_consulta)", recusa_ml: r?.recusa_ml || null });
    if (etapa === "Compatibilidades" && r?.ok) {
      const pid = idsCatalogoDaCompatibilidade(r)[0];
      if (pid) {
        const pr = await consultar(`/products/${pid}`);
        out.push({ etapa: "Marca do 1º veículo (catálogo)", caminho: `/products/${pid}`, ok: !!pr?.ok, status: pr?.status ?? null, erro: pr?.ok ? null : txt(pr?.erro) || "falhou", resumo: pr?.ok ? `marca: ${marcaDoProdutoCatalogo(pr) || "não encontrada"} · ${resumirResposta(pr.dados)}` : null });
      }
    }
  }
  return out;
}

/** Resumo curto de uma resposta do ML (formato e campos), sem despejar o conteúdo todo. */
export function resumirResposta(d) {
  // Resumos de permissão já vêm prontos e seguros do servidor: mostra inteiro.
  if (d && typeof d === "object" && ("paiia" in d || "scopes" in d)) return JSON.stringify(d).slice(0, 600);
  if (Array.isArray(d)) return `lista com ${d.length} item(ns)${d[0] && typeof d[0] === "object" ? `; campos: ${Object.keys(d[0]).slice(0, 12).join(", ")}` : ""}${d.length ? `; 1º: ${JSON.stringify(d[0]).slice(0, 300)}` : ""}`;
  if (d && typeof d === "object") {
    const listas = Object.entries(d).filter(([, v]) => Array.isArray(v)).map(([k, v]) => `${k}: ${v.length}`);
    return `campos: ${Object.keys(d).slice(0, 15).join(", ")}${listas.length ? ` · listas → ${listas.join(", ")}` : ""}${Array.isArray(d.products) && d.products[0] ? ` · 1º veículo: ${JSON.stringify(d.products[0]).slice(0, 300)}` : ""}`;
  }
  return txt(d).slice(0, 200);
}

/**
 * (15/11) Tradução dos erros conhecidos do ML para o usuário.
 * "At least one policy returned UNAUTHORIZED" (403 do PolicyAgent do ML) = o ML recusou por
 * PERMISSÃO: o aplicativo do PAIIA ou a autorização daquela conta não tem acesso ao recurso
 * (comum em promoções, quando a conta não está habilitada ou foi autorizada antes da permissão).
 */
export function explicarErro(erro) {
  const e = txt(erro);
  if (/policy returned UNAUTHORIZED|PolicyAgent/i.test(e)) return "recusa de PERMISSÃO do Mercado Livre para esta conta neste recurso (não é defeito do anúncio)";
  if (/fora da lista permitida|não permitid|nao permitid/i.test(e)) return "endereço bloqueado pelo servidor do PAIIA (lista de leituras permitidas)";
  if (/invalid.*token|token.*(vencid|expir)|unauthori[sz]ed$/i.test(e)) return "acesso da conta vencido: renovar em Contas Marketplace";
  if (/too many|limitou/i.test(e)) return "limite de consultas do Mercado Livre: tentar de novo mais tarde";
  return "";
}

/**
 * (15/11) Diagnóstico das 3 contas de uma vez: testa as mesmas leituras num anúncio
 * de cada conta (o 1º da última consulta) para comparar quem recusa o quê.
 * @returns {Promise<{ etapas: string[], contas: { nome, item, resultados: object[] }[] }>}
 */
export async function diagnosticarContas({ leitura, consultorDaConta }) {
  const contas = [];
  for (const c of CONTAS_BLACK_FRIDAY) {
    const item = leitura?.contas?.[c.id]?.itens?.[0]?.item?.id;
    if (!item) { contas.push({ nome: c.nome, item: null, resultados: [] }); continue; }
    contas.push({ nome: c.nome, item, resultados: await diagnosticarAnuncio({ conta: c.id, itemId: item, consultar: consultorDaConta(c.id) }) });
  }
  const etapas = [...new Set(contas.flatMap((x) => x.resultados.map((r) => r.etapa)))];
  return { etapas, contas };
}

/** (15/11) Falhas agrupadas por conta e etapa, com o 1º erro de cada grupo. */
export function agruparFalhas(falhas) {
  const g = new Map();
  for (const f of falhas || []) {
    const k = `${f.conta}|${f.etapa}`;
    const atual = g.get(k) || { conta: f.conta, etapa: f.etapa, quantidade: 0, erros: new Map() };
    atual.quantidade++;
    const e = txt(f.erro) || "sem mensagem";
    atual.erros.set(e, (atual.erros.get(e) || 0) + 1);
    g.set(k, atual);
  }
  return [...g.values()].map((x) => ({ conta: x.conta, etapa: x.etapa, quantidade: x.quantidade, erros: [...x.erros.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([erro, n]) => ({ erro, n })) })).sort((a, b) => b.quantidade - a.quantidade);
}

/** Adaptador do Bling: custo_por_sku (somente leitura). */
export function consultorCustoBF(invocar) {
  return async (sku) => {
    const { data, error } = await invocar("bling-integracao", { body: { acao: "custo_por_sku", sku } });
    if (error) return { ok: false, erro: error.message, status: error.context?.status };
    if (!data?.ok) return { ok: false, erro: data?.erro || "resposta inesperada" };
    return {
      ok: true, encontrado: data.encontrado !== false, ambiguo: data.ambiguo === true, formato: data.produto?.formato ?? null,
      custo: data.custo ? { fornecedor_precoCusto: data.custo.fornecedor_precoCusto ?? null, fornecedores: (Array.isArray(data.custo.fornecedores) ? data.custo.fornecedores : []).map((f) => ({ padrao: f?.padrao === true, precoCusto: f?.precoCusto ?? null })) } : null,
    };
  };
}
