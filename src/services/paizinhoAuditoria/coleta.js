// =============================================================
// PAIIA — Central do Paizinho: COLETA dos dados (SOMENTE LEITURA).
//
// Uma conta por vez (piloto: LOJA ONLINE). Tudo o que é lido vem de
// funções INJETADAS, para o mesmo código rodar:
//   - no navegador (teste local): consultar = ml_consulta GET da função
//     mercadolivre-publicacao; Bling = bling-integracao:buscar_produto;
//   - no servidor às 03h (função paizinho-auditoria): fetch GET direto na
//     API do ML com o token da conta.
//
// Regras:
//   - Só GET. Nada é gravado no ML, no Bling ou no PAIIA durante a coleta.
//   - Conta explícita e conferida: item de outra conta é DESCARTADO.
//   - Falhas de leitura não param a análise: ficam registradas em `falhas`
//     e o relatório mostra o que não pôde ser conferido (nunca supõe).
// =============================================================
import { txt, num, pedacos, comLimite, diasAtras, skuDoItem } from "./util.js";

export const PADROES_COLETA = Object.freeze({
  limiteItens: 500,          // anúncios ativos analisados por execução
  diasVendas: 60,            // pedidos lidos (30 dias = conversão; 60 = parados)
  diasVisitas: 30,
  limitePedidos: 2000,
  limiteEnvios: 300,         // custos reais de frete conferidos (envios mais recentes)
  limiteConcorrencia: 15,    // pesquisas de concorrência (usam créditos da SerpAPI)
  limiteCompatibilidades: 500,
  paralelo: 6,
  paraleloBling: 2,
});

/** Envolve `consultar` garantindo: só caminho (GET), nunca método/corpo. */
export function somenteLeitura(consultar) {
  // (11/11) O servidor só aceita alguns endereços de leitura ("lista
  // permitida"). Recusado um tipo de endereço, não insiste nele de novo.
  const recusados = new Map();
  return async (caminho) => {
    const c = txt(caminho);
    if (!c.startsWith("/")) return { ok: false, erro: "Caminho inválido." };
    const tipo = tipoDeCaminho(c);
    if (recusados.has(tipo)) return recusados.get(tipo);
    try {
      const r = await consultar(c);
      const res = r && typeof r === "object" ? r : { ok: false, erro: "Resposta vazia." };
      if (!res.ok && caminhoRecusado(res)) {
        const marcado = { ...res, recusado: true };
        recusados.set(tipo, marcado);
        return marcado;
      }
      return res;
    } catch (e) {
      return { ok: false, erro: txt(e?.message || e) };
    }
  };
}

/** "/items/MLB123/description?x" → "/items/*\/description" (tipo de endereço). */
export function tipoDeCaminho(c) {
  return txt(c).split("?")[0].replace(/\/MLB[A-Z]?\d+/gi, "/*").replace(/\/\d+/g, "/*");
}
export function caminhoRecusado(r) {
  return /fora da lista permitida|não permitid|nao permitid/i.test(txt(r?.erro));
}
/** (12/11) Login do PAIIA vencido/recusado: não adianta insistir; o usuário precisa entrar de novo. */
export function erroDeSessao(r) {
  return Number(r?.status) === 401 || /não autenticad|nao autenticad|entre novamente|jwt|unauthori[sz]ed|invalid.*token/i.test(txt(r?.erro));
}

const dia = (iso) => txt(iso).slice(0, 10);
/** Data no formato que a busca de pedidos do ML aceita (2026-11-10T06:00:00.000-00:00). */
export const dataML = (iso) => new Date(iso).toISOString().replace("Z", "-00:00");

/**
 * Coleta tudo o que a análise precisa.
 * @returns {Promise<object>} dados brutos normalizados + falhas.
 */
export async function coletarDadosConta({
  conta,
  consultar,
  consultarBling = null,
  buscarConcorrentes = null,
  agora = new Date().toISOString(),
  opcoes = {},
  aoProgredir = () => {},
}) {
  const o = { ...PADROES_COLETA, ...opcoes };
  const contaId = txt(conta).replace(/\D/g, "");
  if (!contaId) throw new Error("Conta Mercado Livre não informada: a auditoria nunca roda sem conta explícita.");
  const get = somenteLeitura(consultar);
  const falhas = [];
  const falha = (etapa, caminho, r) => falhas.push({ etapa, caminho: txt(caminho).split("?")[0], erro: txt(r?.erro) || `HTTP ${r?.status || "?"}` });
  const passo = (etapa) => { try { aoProgredir(etapa); } catch { /* ignora */ } };

  // 1) Conta conferida
  passo("Conferindo a conta");
  const usuario = await get(`/users/${contaId}`);
  if (usuario?.ok && String(usuario?.dados?.id) !== contaId) {
    throw new Error(`O Mercado Livre respondeu com outra conta (${txt(usuario?.dados?.id)}) no lugar de ${contaId}: auditoria interrompida.`);
  }
  if (!usuario?.ok) {
    // Sem a leitura do perfil a separação de contas continua garantida:
    // cada anúncio é conferido pelo seller_id logo abaixo.
    falha("perfil da conta", `/users/${contaId}`, usuario);
    if (!usuario?.recusado) throw new Error(`Não foi possível confirmar a conta ${contaId} no Mercado Livre (${txt(usuario?.erro) || "resposta inesperada"}).`);
  }
  const contaInfo = { id: contaId, apelido: txt(usuario?.dados?.nickname), site: txt(usuario?.dados?.site_id) || "MLB" };

  // 2) Anúncios ativos
  passo("Lendo os anúncios ativos");
  const ids = [];
  let total = 0;
  for (let offset = 0; offset < 1000 && ids.length < o.limiteItens; offset += 100) {
    const r = await get(`/users/${contaId}/items/search?status=active&limit=100&offset=${offset}`);
    if (!r?.ok) { falha("anúncios", `/users/${contaId}/items/search`, r); break; }
    total = num(r.dados?.paging?.total);
    const lote = Array.isArray(r.dados?.results) ? r.dados.results : [];
    ids.push(...lote);
    if (lote.length < 100) break;
  }
  if (total > 1000 && ids.length < o.limiteItens) {
    // Mais de 1.000 anúncios: o ML exige a leitura por "scan".
    let scroll = "";
    for (let volta = 0; volta < 100 && ids.length < o.limiteItens; volta++) {
      const r = await get(`/users/${contaId}/items/search?status=active&search_type=scan&limit=100${scroll ? `&scroll_id=${encodeURIComponent(scroll)}` : ""}`);
      if (!r?.ok) { falha("anúncios (scan)", `/users/${contaId}/items/search`, r); break; }
      const lote = Array.isArray(r.dados?.results) ? r.dados.results : [];
      if (!lote.length) break;
      for (const id of lote) if (!ids.includes(id)) ids.push(id);
      scroll = txt(r.dados?.scroll_id);
      if (!scroll) break;
    }
  }
  const idsAnalisados = [...new Set(ids)].slice(0, o.limiteItens);

  // 3) Detalhes dos anúncios (20 por consulta)
  passo(`Lendo ${idsAnalisados.length} anúncios`);
  const itens = [];
  let descartadosOutraConta = 0;
  const aceitar = (b) => {
    if (!b?.id) return;
    if (String(b.seller_id) !== contaId) { descartadosOutraConta++; return; } // NUNCA mistura contas
    itens.push(b);
  };
  const lotes = await comLimite(pedacos(idsAnalisados, 20), o.paralelo, async (lote) => ({ lote, r: await get(`/items?ids=${lote.join(",")}`) }));
  const umPorUm = [];
  for (const { lote, r } of lotes) {
    if (r?.recusado) { umPorUm.push(...lote); continue; } // leitura em lote não permitida → um por vez
    if (!r?.ok || !Array.isArray(r.dados)) { falha("detalhes dos anúncios", "/items", r); continue; }
    for (const x of r.dados) if (Number(x?.code) === 200) aceitar(x?.body);
  }
  if (umPorUm.length) {
    const resp = await comLimite(umPorUm, o.paralelo, (id) => get(`/items/${id}`));
    for (const r of resp) {
      if (r?.ok) aceitar(r.dados);
      else falha("detalhes do anúncio", "/items/{id}", r);
    }
  }

  // 4) Descrições
  passo("Lendo as descrições");
  const descricoes = {};
  await comLimite(itens, o.paralelo, async (it) => {
    const r = await get(`/items/${it.id}/description`);
    if (r?.ok) descricoes[it.id] = txt(r.dados?.plain_text || r.dados?.text);
    else if (Number(r?.status) === 404) descricoes[it.id] = "";
    else falha("descrição", `/items/${it.id}/description`, r);
  });

  // 5) Visitas dos últimos N dias
  passo("Lendo as visitas");
  const visitas = {};
  const de = dia(diasAtras(agora, o.diasVisitas));
  const ate = dia(agora);
  await comLimite(pedacos(itens.map((i) => i.id), 50), 2, async (lote) => {
    const r = await get(`/items/visits?ids=${lote.join(",")}&date_from=${de}&date_to=${ate}`);
    const lista = Array.isArray(r?.dados) ? r.dados : null;
    if (r?.ok && lista) {
      for (const v of lista) if (v?.item_id) visitas[v.item_id] = num(v.total_visits);
      return;
    }
    // Consulta em grupo indisponível: uma por anúncio.
    await comLimite(lote, o.paralelo, async (id) => {
      const u = await get(`/items/${id}/visits?date_from=${de}&date_to=${ate}`);
      if (u?.ok) visitas[id] = num(u.dados?.total_visits);
      else falha("visitas", `/items/${id}/visits`, u);
    });
  });

  // 6) Pedidos (vendas)
  passo("Lendo as vendas");
  const pedidos = [];
  const desdeVendas = diasAtras(agora, o.diasVendas);
  for (let offset = 0; offset < o.limitePedidos; offset += 50) {
    const r = await get(`/orders/search?seller=${contaId}&order.date_created.from=${encodeURIComponent(dataML(desdeVendas))}&order.date_created.to=${encodeURIComponent(dataML(agora))}&sort=date_desc&limit=50&offset=${offset}`);
    if (!r?.ok) { falha("vendas", "/orders/search", r); break; }
    const lote = Array.isArray(r.dados?.results) ? r.dados.results : [];
    for (const p of lote) {
      if (String(p?.seller?.id ?? contaId) !== contaId) continue;
      pedidos.push(p);
    }
    if (lote.length < 50 || pedidos.length >= num(r.dados?.paging?.total)) break;
  }

  // 7) Custo real do frete das vendas (envios mais recentes)
  passo("Conferindo o frete cobrado nas vendas");
  const envios = {};
  const idsEnvio = [...new Set(pedidos.filter((p) => txt(p?.status) === "paid" && p?.shipping?.id).map((p) => String(p.shipping.id)))].slice(0, o.limiteEnvios);
  await comLimite(idsEnvio, o.paralelo, async (id) => {
    const r = await get(`/shipments/${id}/costs`);
    if (r?.ok) envios[id] = r.dados;
    else falha("custo do envio", `/shipments/${id}/costs`, r);
  });

  // 8) Frete oficial que o ML cobra do vendedor em cada anúncio (medidas cadastradas)
  passo("Cotando o frete de cada anúncio");
  const fretes = {};
  await comLimite(itens, o.paralelo, async (it) => {
    const r = await get(`/users/${contaId}/shipping_options/free?item_id=${it.id}&verbose=true`);
    if (r?.ok) fretes[it.id] = r.dados;
    else falha("frete do anúncio", `/users/${contaId}/shipping_options/free`, r);
  });

  // 9) Tarifa de venda do ML (por preço + tipo + categoria; com memória)
  passo("Conferindo as tarifas de venda");
  const tarifas = {};
  const chaves = [...new Set(itens.map((it) => `${num(it.price).toFixed(2)}|${txt(it.listing_type_id)}|${txt(it.category_id)}`))];
  await comLimite(chaves, o.paralelo, async (chave) => {
    const [preco, tipo, cat] = chave.split("|");
    const r = await get(`/sites/MLB/listing_prices?price=${preco}&listing_type_id=${tipo}&category_id=${cat}`);
    const d = Array.isArray(r?.dados) ? r.dados[0] : r?.dados;
    if (r?.ok && d) tarifas[chave] = { valor: num(d.sale_fee_amount), percentual: num(d.sale_fee_details?.percentage_fee ?? d.sale_fee_details?.meli_percentage_fee), fixa: num(d.sale_fee_details?.fixed_fee) };
    else falha("tarifa de venda", "/sites/MLB/listing_prices", r);
  });

  // 10) Compatibilidades (quantidade de veículos por anúncio)
  passo("Conferindo as compatibilidades");
  const compat = {};
  await comLimite(itens.slice(0, o.limiteCompatibilidades), o.paralelo, async (it) => {
    const r = await get(`/items/${it.id}/compatibilities`);
    if (r?.ok) {
      const p = r.dados?.products || r.dados?.compatibilities || (Array.isArray(r.dados) ? r.dados : []);
      compat[it.id] = { quantidade: Array.isArray(p) ? p.length : num(r.dados?.paging?.total) };
    } else if (Number(r?.status) === 404) compat[it.id] = { quantidade: null }; // categoria sem compatibilidade
    else falha("compatibilidades", `/items/${it.id}/compatibilities`, r);
  });

  // 11) Bling: custo, peso e medidas pelo SKU (somente leitura)
  const bling = {};
  let blingDisponivel = typeof consultarBling === "function";
  let leituraBling = null; // { lidos, total, motivo } quando a leitura do Bling ficou parcial
  if (blingDisponivel) {
    passo("Lendo custos e medidas no Bling");
    const skus = [...new Set(itens.map(skuDoItem).filter(Boolean))];
    let falhasSeguidas = 0;
    let feitos = 0;
    let motivoParada = "";
    const lerBling = (sku) => consultarBling(sku).catch((e) => ({ ok: false, erro: txt(e?.message || e) }));
    await comLimite(skus, o.paraleloBling, async (sku) => {
      if (motivoParada) return;
      if (++feitos % 25 === 0) passo(`Lendo custos e medidas no Bling (${feitos} de ${skus.length})`);
      let r = await lerBling(sku);
      // (11/11) Conta inteira: o Bling limita consultas por segundo → espera e tenta 1 vez.
      if (!r?.ok && r?.encontrado !== false && !erroDeSessao(r)) { await new Promise((ok) => setTimeout(ok, o.esperaBlingMs ?? 1500)); r = await lerBling(sku); }
      if (r?.ok && r.produto) { bling[sku] = r.produto; falhasSeguidas = 0; }
      else if (r?.encontrado === false || (r?.ok && !r.produto)) { bling[sku] = null; falhasSeguidas = 0; }
      else {
        falha("Bling", "buscar_produto", r);
        // (12/11) Sessão do PAIIA expirada: para na hora e avisa (antes parecia "Bling fora do ar").
        if (erroDeSessao(r)) motivoParada = "sessao";
        else if (++falhasSeguidas >= 5) motivoParada = "fora_do_ar";
      }
    });
    const lidos = skus.filter((s) => s in bling).length;
    if (lidos === 0 && motivoParada) blingDisponivel = false;
    if (lidos < skus.length) leituraBling = { lidos, total: skus.length, motivo: motivoParada || "incompleta" };
  }

  // 12) Concorrência: só os anúncios mais importantes (usa créditos)
  const concorrencia = {};
  if (typeof buscarConcorrentes === "function" && o.limiteConcorrencia > 0) {
    passo("Pesquisando a concorrência");
    const vendidos = contarVendidos(pedidos, agora, 30);
    const alvo = [...itens]
      .sort((a, b) => (vendidos[b.id] || 0) - (vendidos[a.id] || 0) || (visitas[b.id] || 0) - (visitas[a.id] || 0))
      .slice(0, o.limiteConcorrencia);
    await comLimite(alvo, 2, async (it) => {
      const r = await buscarConcorrentes(it).catch((e) => ({ ok: false, erro: txt(e?.message || e) }));
      if (r?.ok) concorrencia[it.id] = r;
      else falha("concorrência", "concorrencia", r);
    });
  }

  passo("Coleta concluída");
  return {
    conta: contaInfo,
    coletado_em: agora,
    periodo: { visitas_de: de, visitas_ate: ate, vendas_desde: desdeVendas },
    totais: { anuncios_ativos: total || idsAnalisados.length, anuncios_analisados: itens.length, descartados_outra_conta: descartadosOutraConta, pedidos: pedidos.length },
    itens, descricoes, visitas, pedidos, envios, fretes, tarifas, compat, bling, concorrencia,
    fontes: { bling: blingDisponivel, bling_parcial: leituraBling, concorrencia: typeof buscarConcorrentes === "function" },
    // (11/11) O que NÃO foi lido nunca vira zero na análise.
    leituras: {
      visitas: itens.length === 0 || Object.keys(visitas).length > 0,
      vendas: !falhas.some((f) => f.etapa === "vendas"),
    },
    falhas,
  };
}

/** Unidades vendidas (pedidos pagos) por anúncio nos últimos `dias`. */
export function contarVendidos(pedidos, agora, dias) {
  const desde = new Date(diasAtras(agora, dias)).getTime();
  const out = {};
  for (const p of pedidos || []) {
    if (txt(p?.status) !== "paid") continue;
    if (new Date(p?.date_created).getTime() < desde) continue;
    for (const oi of p?.order_items || []) {
      const id = oi?.item?.id;
      if (id) out[id] = (out[id] || 0) + num(oi.quantity || 1);
    }
  }
  return out;
}
