// =============================================================
// PAIIA — Central do Paizinho: ANÁLISE de cada anúncio (funções puras).
//
// Recebe os dados da coleta e devolve, por anúncio, os números (visitas,
// vendas, conversão, margem, frete, medidas, pontuação interna) e a lista de
// ACHADOS: { area, severidade, problema, sugestao, impacto_rs }.
//
// Regras que nunca mudam:
//   - Não inventa custo, medida, preço ou compatibilidade: sem dado
//     confiável o achado diz "não calculado" / "pendente de conferência".
//   - Peça Renault de lote antigo sem custo: compara com a tabela Renault
//     (quando houver) e com a concorrência; NUNCA calcula margem.
//   - Nada é corrigido: cada achado traz a correção SUGERIDA para aprovação.
// =============================================================
import { num, txt, centavos, reais, pct, normalizar, codigoLimpo, atributo, atributoNumero, skuDoItem, diasAtras } from "./util.js";
import { normalizarMedida, medidaCompleta, pesoCubicoG, pesoConsideradoG, divergentes, validarLimites, formatarDimensoes, formatarPeso } from "../logistica/logisticaMercadoLivre.js";
import { lerRespostaCotacao } from "../fretePrecificacao.js";
import { contarVendidos } from "./coleta.js";

export const AREAS = Object.freeze({
  VENDAS: "vendas",
  PRECO: "preco",
  MARGEM: "margem",
  RENAULT: "renault",
  CONTEUDO: "conteudo",
  COMPAT: "compatibilidade",
  QUALIDADE: "qualidade",
  ESTOQUE: "estoque",
  FRETE: "frete",
  OPORTUNIDADE: "oportunidade",
});
export const PESO_SEVERIDADE = Object.freeze({ alta: 3, media: 2, baixa: 1 });

export const PADROES_ANALISE = Object.freeze({
  margemMinimaPct: 10,
  impostoPercentual: null, // null = desconhecido → margem "antes dos impostos"
  freteAltoPct: 30,        // frete pago pelo vendedor acima disto (% do preço) = atenção
  freteCriticoPct: 40,
  cobrancaToleranciaPct: 15,
  diasEstoqueMinimo: 15,
  // (11/11) Fretes e Medidas
  blingPadraoRepeticoes: 5,   // mesma caixa+peso em 5+ SKUs do Bling = valor padrão
  divergenciaFreteMinima: 2,  // R$ por envio para a divergência ML x Bling ser relevante
  blingCaixaMaiorVezes: 3,    // caixa do Bling 3× maior que a do anúncio...
  blingPesoRedondoG: 500,     // ...com peso múltiplo de 500 g = cadastro genérico
});

// Montadoras: peça destas marcas é comparada só com ORIGINAL (nunca mistura com importado).
const MONTADORAS = ["renault", "volkswagen", "vw", "chevrolet", "gm", "fiat", "ford", "toyota", "honda", "hyundai", "nissan", "peugeot", "citroen", "mitsubishi", "jeep", "kia", "mercedes", "bmw", "audi"];

/** Marca do anúncio (atributo BRAND). */
export const marcaDoItem = (item) => atributo(item, "BRAND");

/** Código principal da peça (número de peça / OEM / MPN). */
export function codigoDoItem(item) {
  return atributo(item, "PART_NUMBER") || atributo(item, "OEM") || atributo(item, "MPN") || atributo(item, "ORIGINAL_OEM");
}

/** Peça Renault: marca Renault (ou "Renault original" no título). */
export function ehRenault(item) {
  const marca = normalizar(marcaDoItem(item));
  if (marca) return marca.includes("renault");
  const t = normalizar(item?.title);
  return /\brenault\b/.test(t) && /\boriginal\b/.test(t);
}

export function ehOriginalMontadora(item) {
  const marca = normalizar(marcaDoItem(item));
  return MONTADORAS.some((m) => marca === m || marca.startsWith(`${m} `));
}

/**
 * Medidas da embalagem cadastradas no anúncio (atributos SELLER_PACKAGE_*
 * ou shipping.dimensions "AxLxC,peso"). null = não cadastradas.
 */
export function medidasDoAnuncio(item) {
  const attr = {
    peso_g: atributoNumero(item, "SELLER_PACKAGE_WEIGHT", "g"),
    comprimento_cm: atributoNumero(item, "SELLER_PACKAGE_LENGTH", "cm"),
    largura_cm: atributoNumero(item, "SELLER_PACKAGE_WIDTH", "cm"),
    altura_cm: atributoNumero(item, "SELLER_PACKAGE_HEIGHT", "cm"),
  };
  if (medidaCompleta(attr)) return { ...attr, origem: "anúncio (embalagem do vendedor)" };
  const d = txt(item?.shipping?.dimensions).match(/^\s*([\d.]+)x([\d.]+)x([\d.]+),([\d.]+)\s*$/i);
  if (d) {
    const m = { altura_cm: num(d[1]), largura_cm: num(d[2]), comprimento_cm: num(d[3]), peso_g: num(d[4]) };
    if (medidaCompleta(m)) return { ...m, origem: "anúncio (dimensões de envio)" };
  }
  return null;
}

/** Medidas do Bling (peso em kg → g). null = não cadastradas. */
export function medidasDoBling(produto) {
  if (!produto) return null;
  const pesoKg = num(produto.peso_bruto ?? produto.pesoBruto ?? produto.peso_liquido ?? produto.pesoLiquido);
  const m = { peso_g: Math.round(pesoKg * 1000), comprimento_cm: num(produto.profundidade), largura_cm: num(produto.largura), altura_cm: num(produto.altura) };
  return medidaCompleta(m) ? { ...m, origem: "Bling" } : null;
}

/** Custo confiável do Bling (> 0). null = sem custo. */
export function custoDoBling(produto) {
  const c = num(produto?.precoCusto ?? produto?.preco_custo ?? produto?.custo);
  return c > 0 ? centavos(c) : null;
}

const textoMedida = (m) => (m ? `${formatarDimensoes(m)} · ${formatarPeso(m.peso_g)}` : "não cadastradas");

/** Frete real das vendas deste anúncio (custos dos envios lidos). */
function fretesReais(itemId, pedidos, envios) {
  const lista = [];
  for (const p of pedidos || []) {
    if (txt(p?.status) !== "paid") continue;
    const envio = envios?.[String(p?.shipping?.id)];
    if (!envio) continue;
    if (!(p.order_items || []).some((oi) => oi?.item?.id === itemId)) continue;
    const vendedor = (envio.senders || []).reduce((s, x) => s + num(x?.cost), 0);
    lista.push({ pedido: p.id, envio: p.shipping.id, vendedor: centavos(vendedor), comprador: centavos(num(envio?.receiver?.cost)), itens_no_pacote: (p.order_items || []).length });
  }
  return lista;
}

/** Monta a ficha de análise de UM anúncio (números, sem achados). */
export function fichaDoAnuncio(item, dados, config, contexto) {
  const id = item.id;
  const sku = skuDoItem(item);
  const produtoBling = sku ? dados.bling?.[sku] : undefined;
  const preco = centavos(item.price);
  const tarifa = dados.tarifas?.[`${num(item.price).toFixed(2)}|${txt(item.listing_type_id)}|${txt(item.category_id)}`] || null;
  const cot = dados.fretes?.[id] ? lerRespostaCotacao({ ok: true, dados: dados.fretes[id] }) : null;
  const freteGratis = item?.shipping?.free_shipping === true;
  const visitas = dados.visitas?.[id];
  const vendasLidas = dados.leituras?.vendas !== false;
  const vendas30 = vendasLidas ? contexto.vendidos30[id] || 0 : null; // null = não lido (nunca zero)
  const vendas60 = vendasLidas ? contexto.vendidos60[id] || 0 : null;
  const fretesDasVendas = fretesReais(id, dados.pedidos, dados.envios);
  return {
    id,
    sku,
    titulo: txt(item.title),
    link: txt(item.permalink),
    preco,
    tipo: txt(item.listing_type_id),
    categoria: txt(item.category_id),
    estoque: num(item.available_quantity),
    criado_em: txt(item.date_created),
    marca: marcaDoItem(item),
    codigo: codigoDoItem(item),
    renault: ehRenault(item),
    original: ehOriginalMontadora(item),
    fotos: Array.isArray(item.pictures) ? item.pictures.length : 0,
    atributos_preenchidos: (item.attributes || []).filter((a) => txt(a?.value_name)).length,
    descricao: dados.descricoes?.[id],
    visitas30: visitas === undefined ? null : visitas,
    vendas30,
    vendas60,
    conversao30: visitas > 0 && vendas30 !== null ? Math.round((vendas30 / visitas) * 10000) / 100 : null,
    tarifa,
    frete: {
      gratis: freteGratis,
      modalidade: txt(item?.shipping?.logistic_type),
      oficial: cot?.ok ? cot : null,
      // Frete que sai do bolso do vendedor por venda (cotação oficial do anúncio).
      vendedor: cot?.ok && freteGratis ? cot.custo_vendedor : cot?.ok ? 0 : null,
      reais: fretesDasVendas,
    },
    medidas_ml: medidasDoAnuncio(item),
    medidas_bling: medidasDoBling(produtoBling),
    // (11/11) Dados ORIGINAIS como vieram do ML e do Bling (nada é descartado).
    dados_originais: {
      ml: {
        SELLER_PACKAGE_LENGTH: atributo(item, "SELLER_PACKAGE_LENGTH") || null,
        SELLER_PACKAGE_WIDTH: atributo(item, "SELLER_PACKAGE_WIDTH") || null,
        SELLER_PACKAGE_HEIGHT: atributo(item, "SELLER_PACKAGE_HEIGHT") || null,
        SELLER_PACKAGE_WEIGHT: atributo(item, "SELLER_PACKAGE_WEIGHT") || null,
        shipping_dimensions: txt(item?.shipping?.dimensions) || null,
      },
      bling: produtoBling
        ? { peso_bruto: produtoBling.peso_bruto ?? produtoBling.pesoBruto ?? null, peso_liquido: produtoBling.peso_liquido ?? produtoBling.pesoLiquido ?? null, largura: produtoBling.largura ?? null, altura: produtoBling.altura ?? null, profundidade: produtoBling.profundidade ?? null }
        : produtoBling === null ? "SKU não encontrado no Bling" : null,
    },
    bling_lido: produtoBling !== undefined,
    bling_encontrado: Boolean(produtoBling),
    custo: custoDoBling(produtoBling),
    compat: dados.compat?.[id]?.quantidade ?? null,
    concorrencia: dados.concorrencia?.[id] || null,
    tabela_renault: config.precoTabelaRenault ? config.precoTabelaRenault({ codigo: codigoDoItem(item), sku, item }) : null,
  };
}

/* ------------------------------------------------------------ */
/* Regras: cada uma devolve uma lista de achados                 */
/* ------------------------------------------------------------ */

function achado(f, area, severidade, problema, sugestao, impacto_rs = null, extra = {}) {
  return {
    area, severidade,
    item_id: f.id, sku: f.sku || "", titulo: f.titulo, link: f.link,
    problema, sugestao,
    impacto_rs: impacto_rs === null || !Number.isFinite(impacto_rs) ? null : centavos(impacto_rs),
    ...extra,
  };
}

function regrasVendas(f, ctx) {
  const out = [];
  if (f.visitas30 === null || f.vendas30 === null) return out; // sem leitura → sem conclusão
  const idadeDias = f.criado_em ? (new Date(ctx.agora) - new Date(f.criado_em)) / 86400000 : 999;
  if (f.visitas30 >= 50 && f.vendas30 === 0) {
    out.push(achado(f, AREAS.VENDAS, f.visitas30 >= 150 ? "alta" : "media",
      `${f.visitas30} visitas em 30 dias e nenhuma venda.`,
      "O comprador encontra o anúncio mas não compra: conferir preço x concorrência, frete, fotos e se o título/descrição deixam claro o código e a aplicação."));
  } else if (f.vendas30 > 0 && ctx.conversaoConta > 0 && f.visitas30 >= 30 && f.conversao30 < ctx.conversaoConta / 2) {
    out.push(achado(f, AREAS.VENDAS, "media",
      `Conversão de ${pct(f.conversao30, 2)}, menos da metade da média da conta (${pct(ctx.conversaoConta, 2)}).`,
      "Comparar preço e frete com a concorrência e revisar fotos e descrição."));
  }
  if (f.visitas30 < 10 && idadeDias > 30) {
    out.push(achado(f, AREAS.VENDAS, "baixa",
      `Só ${f.visitas30} visita(s) em 30 dias: o anúncio quase não aparece nas buscas.`,
      "Revisar título (código, marca, peça e aplicação), atributos e compatibilidades."));
  }
  return out;
}

function regrasEstoque(f, ctx) {
  const out = [];
  if (f.vendas30 > 0 && f.estoque > 0) {
    const dias = f.estoque / (f.vendas30 / 30);
    if (dias < ctx.cfg.diasEstoqueMinimo) {
      out.push(achado(f, AREAS.ESTOQUE, dias < 7 ? "alta" : "media",
        `Estoque para ~${Math.max(1, Math.round(dias))} dia(s): ${f.estoque} un. e ${f.vendas30} vendida(s) em 30 dias.`,
        "Programar reposição para não perder vendas nem posição no ranqueamento."));
    }
  }
  const idadeDias = f.criado_em ? (new Date(ctx.agora) - new Date(f.criado_em)) / 86400000 : 999;
  if (f.vendas60 === 0 && f.estoque > 0 && idadeDias > 60) {
    const valor = f.custo ? f.custo * f.estoque : null;
    out.push(achado(f, AREAS.ESTOQUE, "baixa",
      `Produto parado: nenhuma venda em 60 dias com ${f.estoque} un. em estoque${valor ? ` (${reais(valor)} parados pelo custo do Bling)` : ""}.`,
      "Avaliar preço, kit, anúncio Premium ou promoção; não recomprar até girar.", null, { valor_parado_rs: valor ? centavos(valor) : null }));
  }
  return out;
}

function faixaConcorrencia(f) {
  const fx = f.concorrencia?.faixaComparavel || f.concorrencia?.faixa;
  return fx && num(fx.quantidade) >= 2 ? { minimo: num(fx.minimo), media: num(fx.media), maximo: num(fx.maximo), quantidade: num(fx.quantidade) } : null;
}

function regrasPreco(f) {
  const out = [];
  const fx = faixaConcorrencia(f);
  if (!fx || f.renault) return out; // Renault tem regra própria
  if (f.preco > fx.maximo) {
    out.push(achado(f, AREAS.PRECO, "alta",
      `Preço ${reais(f.preco)} acima de TODOS os concorrentes comparáveis (${reais(fx.minimo)} a ${reais(fx.maximo)}, ${fx.quantidade} ofertas).`,
      `Avaliar preço perto da média (${reais(fx.media)}), se a margem permitir.`, null, { concorrencia: fx }));
  } else if (f.preco > fx.media * 1.15) {
    out.push(achado(f, AREAS.PRECO, "media",
      `Preço ${reais(f.preco)} está ${pct(((f.preco / fx.media) - 1) * 100, 0)} acima da média da concorrência (${reais(fx.media)}).`,
      "Conferir se o diferencial (marca, garantia, frete) justifica; senão, avaliar ajuste.", null, { concorrencia: fx }));
  } else if (f.preco < fx.minimo * 0.9) {
    out.push(achado(f, AREAS.OPORTUNIDADE, "baixa",
      `Preço ${reais(f.preco)} abaixo do menor concorrente (${reais(fx.minimo)}).`,
      `Possível espaço para subir o preço até perto de ${reais(fx.minimo)} sem perder competitividade.`, null, { concorrencia: fx }));
  }
  return out;
}

/** Margem por venda com custo CONFIÁVEL. null quando não dá para calcular. */
export function margemPorVenda(f, cfg) {
  if (!f.custo || !(f.preco > 0)) return null;
  if (!f.tarifa) return null; // sem a tarifa oficial do ML, não calcula
  if (f.frete.vendedor === null) return null;
  const imposto = cfg.impostoPercentual === null || cfg.impostoPercentual === undefined ? null : centavos(f.preco * num(cfg.impostoPercentual) / 100);
  const lucro = centavos(f.preco - f.tarifa.valor - f.frete.vendedor - (imposto || 0) - f.custo);
  return { preco: f.preco, custo: f.custo, tarifa: centavos(f.tarifa.valor), frete: f.frete.vendedor, imposto, lucro, margem_pct: Math.round((lucro / f.preco) * 1000) / 10, com_imposto: imposto !== null };
}

function regrasMargem(f, ctx) {
  const out = [];
  if (f.renault && !f.custo) return out; // regra Renault
  if (!f.custo) {
    if (f.bling_lido) {
      out.push(achado(f, AREAS.MARGEM, "baixa",
        f.bling_encontrado ? "Sem custo confiável no Bling: margem não calculada." : "SKU não encontrado no Bling: margem não calculada.",
        "Cadastrar o custo no Bling para o Paizinho calcular a margem real.", null, { sem_custo: true }));
    }
    return out;
  }
  const m = margemPorVenda(f, ctx.cfg);
  if (!m) return out;
  const rotulo = m.com_imposto ? "" : " (antes dos impostos)";
  if (m.lucro < 0) {
    out.push(achado(f, AREAS.MARGEM, "alta",
      `PREJUÍZO de ${reais(-m.lucro)} por venda${rotulo}: preço ${reais(m.preco)} − tarifa ${reais(m.tarifa)} − frete ${reais(m.frete)}${m.imposto !== null ? ` − imposto ${reais(m.imposto)}` : ""} − custo ${reais(m.custo)}.`,
      "Revisar preço ou frete deste anúncio.", f.vendas30 > 0 ? m.lucro * f.vendas30 : null, { margem: m }));
  } else if (m.margem_pct < ctx.cfg.margemMinimaPct) {
    out.push(achado(f, AREAS.MARGEM, "media",
      `Margem de ${pct(m.margem_pct)}${rotulo} (lucro ${reais(m.lucro)} por venda), abaixo do mínimo de ${pct(ctx.cfg.margemMinimaPct, 0)}.`,
      "Avaliar ajuste de preço ou de embalagem/frete.", null, { margem: m }));
  }
  return out;
}

function regrasRenault(f) {
  if (!f.renault || f.custo) return [];
  const fx = faixaConcorrencia(f);
  const tabela = num(f.tabela_renault) > 0 ? centavos(f.tabela_renault) : null;
  const base = { tabela_renault: tabela, concorrencia: fx, sem_custo: true };
  const nota = "Peça Renault de lote antigo sem custo individual: margem NÃO calculada.";
  if (!tabela && !fx) {
    return [achado(f, AREAS.RENAULT, "baixa", `${nota} Sem tabela Renault e sem concorrência comparável.`, "Informar o preço da tabela Renault deste código para a comparação.", null, { ...base, recomendacao: "dados insuficientes" })];
  }
  const acimaTabela = tabela && f.preco > tabela * 1.02;
  const acimaMercado = fx && f.preco > fx.media * 1.1;
  const muitoAbaixo = (tabela && f.preco < tabela * 0.6) || (fx && f.preco < fx.minimo * 0.85);
  const ref = [tabela ? `tabela Renault ${reais(tabela)}` : "", fx ? `concorrência ${reais(fx.minimo)}–${reais(fx.maximo)} (média ${reais(fx.media)})` : ""].filter(Boolean).join("; ");
  if (acimaTabela || acimaMercado) {
    return [achado(f, AREAS.RENAULT, "media", `${nota} Preço ${reais(f.preco)} acima da referência (${ref}).`, "Avaliar aproximar o preço da referência.", null, { ...base, recomendacao: "revisar" })];
  }
  if (muitoAbaixo) {
    return [achado(f, AREAS.OPORTUNIDADE, "baixa", `${nota} Preço ${reais(f.preco)} bem abaixo da referência (${ref}).`, "Possível espaço para subir o preço mantendo a competitividade.", null, { ...base, recomendacao: "avaliar aumento" })];
  }
  return [achado(f, AREAS.RENAULT, "baixa", `${nota} Preço ${reais(f.preco)} competitivo (${ref}).`, "MANTER o preço.", null, { ...base, recomendacao: "manter", positivo: true })];
}

function regrasConteudo(f) {
  const out = [];
  const titulo = f.titulo;
  const tNorm = codigoLimpo(titulo);
  const cod = codigoLimpo(f.codigo);
  if (titulo.length < 35) {
    out.push(achado(f, AREAS.CONTEUDO, "media", `Título curto (${titulo.length} de 60 caracteres).`, "Usar o espaço com peça + marca + código + aplicação principal."));
  }
  if (cod && cod.length >= 4 && !tNorm.includes(cod)) {
    out.push(achado(f, AREAS.CONTEUDO, "media", `O código ${f.codigo} não está no título.`, "Incluir o código da peça no título: é a busca mais usada por quem conhece a peça."));
  }
  if (!f.codigo) {
    out.push(achado(f, AREAS.CONTEUDO, "media", "Atributo de código da peça (Número de peça/OEM) vazio.", "Preencher o código na ficha técnica: melhora a busca e o catálogo."));
  }
  if (!f.marca) {
    out.push(achado(f, AREAS.CONTEUDO, "media", "Atributo Marca vazio.", "Preencher a marca na ficha técnica."));
  } else if (!normalizar(titulo).includes(normalizar(f.marca))) {
    out.push(achado(f, AREAS.CONTEUDO, "baixa", `A marca ${f.marca} não está no título.`, "Incluir a marca no título."));
  }
  if (f.descricao !== undefined) {
    const d = txt(f.descricao);
    if (d.length < 150) {
      out.push(achado(f, AREAS.CONTEUDO, "media", d ? `Descrição curta (${d.length} caracteres).` : "Anúncio sem descrição.", "Descrever código, marca, aplicações confirmadas, conteúdo da embalagem e garantia."));
    } else if (cod && cod.length >= 4 && !codigoLimpo(d).includes(cod)) {
      out.push(achado(f, AREAS.CONTEUDO, "baixa", "O código da peça não aparece na descrição.", "Citar o código (e equivalentes confirmados) na descrição."));
    }
  }
  if (f.fotos < 3) {
    out.push(achado(f, AREAS.CONTEUDO, "media", `Só ${f.fotos} foto(s).`, "Usar pelo menos 4 fotos: fundo branco, detalhes e o código gravado na peça."));
  }
  const sugeridas = (f.concorrencia?.palavrasChaveSugeridas || []).map((p) => txt(p?.termo || p)).filter(Boolean);
  const faltando = sugeridas.filter((t) => !normalizar(titulo).includes(normalizar(t))).slice(0, 4);
  if (faltando.length) {
    out.push(achado(f, AREAS.OPORTUNIDADE, "baixa", `Palavras usadas pela concorrência que não estão no título: ${faltando.join(", ")}.`, "Avaliar incluir as que descrevem corretamente a peça (sem inventar aplicação)."));
  }
  if (f.compat === 0) {
    out.push(achado(f, AREAS.COMPAT, "media", "Nenhum veículo compatível cadastrado.", "Cadastrar as compatibilidades confirmadas: o anúncio passa a aparecer na busca por veículo."));
  }
  return out;
}

/** Pontuação INTERNA de qualidade/ranqueamento (0–100). Não é a nota oficial do ML. */
export function pontuacaoInterna(f, ctx) {
  const p = {};
  const cod = codigoLimpo(f.codigo);
  p.titulo = (f.titulo.length >= 45 ? 10 : f.titulo.length >= 35 ? 6 : 2) + (cod && codigoLimpo(f.titulo).includes(cod) ? 5 : 0) + (f.marca && normalizar(f.titulo).includes(normalizar(f.marca)) ? 5 : 0);
  p.fotos = f.fotos >= 6 ? 15 : f.fotos >= 4 ? 12 : f.fotos >= 3 ? 9 : f.fotos >= 1 ? 4 : 0;
  const d = txt(f.descricao);
  p.descricao = f.descricao === undefined ? 8 : (d.length >= 300 ? 10 : d.length >= 150 ? 6 : d ? 2 : 0) + (cod && codigoLimpo(d).includes(cod) ? 5 : 0);
  p.ficha_tecnica = (f.marca ? 5 : 0) + (f.codigo ? 5 : 0) + (f.atributos_preenchidos >= 10 ? 5 : f.atributos_preenchidos >= 6 ? 3 : 0);
  p.compatibilidade = f.compat === null ? 7 : f.compat > 0 ? 10 : 0;
  p.frete = f.frete.gratis || f.preco < 79 ? 10 : 5;
  p.tipo_anuncio = f.tipo === "gold_pro" ? 5 : f.tipo === "gold_special" ? 3 : 0;
  p.vendas = f.conversao30 === null ? 3 : f.vendas30 > 0 && f.conversao30 >= ctx.conversaoConta ? 10 : f.vendas30 > 0 ? 6 : 0;
  const total = Object.values(p).reduce((a, b) => a + b, 0);
  return { total: Math.min(100, total), partes: p };
}

function regrasQualidade(f) {
  if (f.pontuacao.total >= 50) return [];
  const fracos = Object.entries(f.pontuacao.partes).filter(([k, v]) => v <= ({ titulo: 10, fotos: 6, descricao: 6, ficha_tecnica: 5, compatibilidade: 0, frete: 5, tipo_anuncio: 0, vendas: 0 }[k] ?? 0)).map(([k]) => k.replace("_", " "));
  return [achado(f, AREAS.QUALIDADE, f.pontuacao.total < 35 ? "media" : "baixa",
    `Pontuação interna ${f.pontuacao.total}/100 (pontos fracos: ${fracos.join(", ") || "vários"}).`,
    "Corrigir os pontos fracos aumenta a chance de aparecer nas primeiras posições.")];
}

/* ------------------------------------------------------------ */
/* Fretes e Medidas (11/11/2026) — três classificações:          */
/*   1. medidas_ausentes       anúncio sem peso/medidas           */
/*   2. bling_padronizado      Bling com valor padrão/improvável   */
/*   3. divergencia_relevante  ML x Bling: conferência física      */
/* Um único alerta de frete por anúncio. Diferença de frete é      */
/* IMPACTO POTENCIAL (estimado), nunca prejuízo confirmado.        */
/* ------------------------------------------------------------ */
export const CLASSIFICACOES_MEDIDAS = Object.freeze({
  medidas_ausentes: { ordem: 1, titulo: "Medidas ausentes", explicacao: "O anúncio não tem peso e medidas da embalagem: precisam ser conferidas." },
  bling_padronizado: { ordem: 2, titulo: "Medidas possivelmente padronizadas no Bling", explicacao: "O Bling usa um valor padrão ou improvável: não usar como referência confiável até confirmar." },
  divergencia_relevante: { ordem: 3, titulo: "Divergências relevantes entre Mercado Livre e Bling", explicacao: "As medidas do anúncio e do Bling diferem a ponto de mudar o frete ou o peso: precisam de conferência física." },
  alerta_ml: { ordem: 4, titulo: "Outros alertas de frete (dados do Mercado Livre)", explicacao: "Sinais vindos só do Mercado Livre: peso cobrado, embalagem, frete alto, cobranças." },
});

const assinaturaMedida = (m) => `${[m.comprimento_cm, m.largura_cm, m.altura_cm].map(num).sort((x, y) => x - y).join("x")}|${num(m.peso_g)}`;

/** Quantos SKUs do Bling usam cada combinação caixa+peso (repetida = valor padrão). */
export function perfilBling(dados, cfg = PADROES_ANALISE) {
  const contagem = {};
  for (const produto of Object.values(dados.bling || {})) {
    const m = medidasDoBling(produto);
    if (m) contagem[assinaturaMedida(m)] = (contagem[assinaturaMedida(m)] || 0) + 1;
  }
  return { contagem, minimo: cfg.blingPadraoRepeticoes ?? PADROES_ANALISE.blingPadraoRepeticoes };
}

/** Motivo para NÃO confiar nas medidas do Bling (null = parecem reais). */
export function motivoBlingSuspeito(bl, ml, perfil) {
  if (!bl) return null;
  const vezes = perfil?.contagem?.[assinaturaMedida(bl)] || 0;
  if (vezes >= (perfil?.minimo ?? PADROES_ANALISE.blingPadraoRepeticoes)) return `a mesma caixa e peso (${textoMedida(bl)}) se repetem em ${vezes} SKUs no Bling`;
  if (bl.peso_g >= 30000) return `peso de ${formatarPeso(bl.peso_g)} é improvável para a peça (possível erro de unidade)`;
  if (ml?.peso_g > 0 && (bl.peso_g / ml.peso_g >= 20 || ml.peso_g / bl.peso_g >= 20)) return `peso do Bling (${formatarPeso(bl.peso_g)}) é mais de 20× diferente do anúncio (${formatarPeso(ml.peso_g)})`;
  // (12/11) Rodada completa: o topo do ranking era de caixas enormes com peso
  // "redondo" no Bling (ex.: 150 × 80 × 50 cm · 1 kg para uma mangueira de 776 g).
  // Isso é cadastro genérico, não medida real: não serve de referência.
  const volume = (m) => num(m.comprimento_cm) * num(m.largura_cm) * num(m.altura_cm);
  const vezesVolume = ml && volume(ml) > 0 ? volume(bl) / volume(ml) : 0;
  const pesoRedondo = bl.peso_g > 0 && bl.peso_g % (PADROES_ANALISE.blingPesoRedondoG) === 0;
  if (vezesVolume >= PADROES_ANALISE.blingCaixaMaiorVezes && pesoRedondo) {
    return `caixa do Bling ${Math.floor(vezesVolume)}× maior que a do anúncio, com peso redondo (${formatarPeso(bl.peso_g)}): parece cadastro genérico`;
  }
  return null;
}

/** Diferença ML x Bling relevante: muda o frete em R$ 2+ por envio, ou peso/volume em 30%+ (sem recotação). */
function divergenciaRelevante(ml, bl, difFrete, cfg) {
  if (difFrete !== null && difFrete !== undefined) return Math.abs(difFrete) >= cfg.divergenciaFreteMinima;
  const rel = (a, b) => (Math.max(a, b) > 0 ? Math.abs(a - b) / Math.max(a, b) : 0);
  const vol = (m) => num(m.comprimento_cm) * num(m.largura_cm) * num(m.altura_cm);
  return rel(num(ml.peso_g), num(bl.peso_g)) >= 0.3 || rel(vol(ml), vol(bl)) >= 0.3;
}

/**
 * Auditoria logística: frete pago, frete cobrado, peso e medidas.
 * Devolve achados + uma LINHA para a tabela "Fretes e Medidas".
 */
function regrasFrete(f, ctx) {
  const cfg = ctx.cfg;
  const ml = f.medidas_ml;
  const bl = f.medidas_bling;
  const oficial = f.frete.oficial;
  const vendasLidas = f.vendas30 !== null;
  const motivoBling = motivoBlingSuspeito(bl, ml, ctx.perfilBling);
  const linha = {
    item_id: f.id, sku: f.sku, titulo: f.titulo, link: f.link, preco: f.preco,
    classificacao: null,
    medidas_anuncio: textoMedida(ml),
    medidas_bling: f.bling_lido ? (f.bling_encontrado ? textoMedida(bl) : "SKU não encontrado no Bling") : "Bling não consultado",
    bling_confiavel: bl ? !motivoBling : null,
    bling_motivo: motivoBling,
    peso_cubico_g: ml ? pesoCubicoG(ml) : null,
    peso_cobrado_g: oficial?.peso_cobrado_g ?? null,
    frete_vendedor: f.frete.vendedor,
    frete_gratis: f.frete.gratis,
    frete_real_medio: null,
    frete_comprador_medio: null,
    frete_com_bling: null,      // frete oficial recotado com as medidas do Bling
    diferenca_por_envio: null,  // + = com o Bling o frete seria MAIOR que hoje
    vendas30: f.vendas30,       // null = vendas não lidas
    // Impacto POTENCIAL (estimado, a confirmar): nunca é prejuízo confirmado.
    impacto_potencial_por_envio: null,
    impacto_potencial_30d: null,
    divergencias: [],
    sugestao: "",
    conferencia: "pendente",    // nada é dado como certo até a conferência física
    dados_originais: f.dados_originais, // como vieram do ML e do Bling
  };
  const itens = [];
  const add = (sev, texto, sugestao) => {
    itens.push({ sev, texto });
    linha.divergencias.push(texto);
    if (sugestao && !linha.sugestao.includes(sugestao)) linha.sugestao = [linha.sugestao, sugestao].filter(Boolean).join(" ");
  };
  const potencial = (porEnvio) => {
    if (!(porEnvio > 0)) return;
    linha.impacto_potencial_por_envio = centavos(Math.max(linha.impacto_potencial_por_envio || 0, porEnvio));
    if (vendasLidas) linha.impacto_potencial_30d = centavos(linha.impacto_potencial_por_envio * f.vendas30);
  };

  if (!ml) {
    // 1) Medidas ausentes
    linha.classificacao = "medidas_ausentes";
    const hoje = oficial?.ok
      ? ` Sem medidas, o ML cobra hoje ${f.frete.gratis ? reais(oficial.custo_vendedor) : "o frete do comprador"} pelo peso estimado de ${formatarPeso(oficial.peso_cobrado_g)}.`
      : "";
    const refBling = bl
      ? (motivoBling ? ` O Bling informa ${textoMedida(bl)}, mas parece padronizado (${motivoBling}): não usar como referência.` : ` O Bling informa ${textoMedida(bl)} (não confirmado).`)
      : "";
    add("media", `Medidas ausentes: o anúncio não tem peso e medidas da embalagem cadastrados.${hoje}${refBling}`,
      "Medir e pesar a peça embalada e cadastrar no anúncio, após aprovação.");
  } else {
    const n = normalizarMedida(ml);
    if (bl && motivoBling) {
      // 2) Bling possivelmente padronizado: o anúncio continua na auditoria,
      //    mas o Bling não serve de referência (sem recotação, sem impacto).
      linha.classificacao = "bling_padronizado";
      add("baixa", `Medidas possivelmente padronizadas no Bling: ${motivoBling}. Anúncio ${textoMedida(ml)}; Bling ${textoMedida(bl)} — não usar como referência até confirmar.`,
        "Conferir a embalagem e atualizar o Bling com a medida real, após aprovação.");
    } else if (bl && divergentes(n, bl)) {
      const rec = ctx.recotacoes?.[f.id];
      let dif = null;
      let txtFrete = "";
      if (!f.frete.gratis) {
        txtFrete = " Frete pago pelo comprador: a diferença muda o frete que ele vê, não o seu custo.";
      } else if (rec?.ok && oficial?.ok) {
        dif = centavos(rec.custo_vendedor - oficial.custo_vendedor);
        linha.frete_com_bling = rec.custo_vendedor;
        linha.diferenca_por_envio = dif;
        const abs = Math.abs(dif);
        txtFrete = ` Frete estimado hoje ${reais(oficial.custo_vendedor)}; com as medidas do Bling ${reais(rec.custo_vendedor)}.`
          + (dif > 0 ? ` Se o Bling estiver certo, risco de o ML remedir e cobrar até ${reais(abs)} a mais por envio (estimado).`
            : dif < 0 ? ` Se o Bling estiver certo, as medidas atuais podem custar até ${reais(abs)} a mais por envio (estimado).`
              : " O frete estimado não muda.");
      } else if (oficial?.ok) {
        txtFrete = ` Frete estimado hoje ${reais(oficial.custo_vendedor)}; recotação com as medidas do Bling indisponível.`;
      }
      if (divergenciaRelevante(n, bl, dif, cfg)) {
        // 3) Divergência relevante
        linha.classificacao = "divergencia_relevante";
        if (dif !== null) potencial(Math.abs(dif));
        add("media", `Divergência relevante entre Mercado Livre e Bling — pendente de conferência física: anúncio ${textoMedida(ml)}, Bling ${textoMedida(bl)}.${txtFrete}`,
          "Medir e pesar a peça embalada e corrigir o cadastro que estiver errado (anúncio ou Bling), após aprovação.");
      } else {
        // Diferença pequena: registrada nos dados, sem alerta.
        f.divergencia_pequena = linha.divergencia_pequena = `Anúncio ${textoMedida(ml)}, Bling ${textoMedida(bl)}: diferença pequena, sem impacto relevante no frete.${txtFrete}`;
      }
    }
    // Sinais vindos só do Mercado Livre (independem do Bling)
    if (n.peso_g < 20) add("media", `Peso cadastrado de ${formatarPeso(n.peso_g)} parece baixo demais para uma peça embalada (possível erro g × kg).`, "Pesar a peça embalada e corrigir o peso, após aprovação.");
    const cub = pesoCubicoG(n);
    if (cub > 1000 && cub > 2 * n.peso_g) add("baixa", `Embalagem grande para o peso: o ML considera ${formatarPeso(cub)} pelo volume (peso real ${formatarPeso(n.peso_g)}).`, "Avaliar uma embalagem menor para reduzir o frete.");
    const lim = validarLimites(n, f.frete.modalidade);
    if (lim.dentro === false) add("alta", `Embalagem fora do limite de envio (${lim.excedidos.map((e) => e.texto).join("; ")}).`, "Conferir as medidas: fora do limite o envio pode ser recusado ou cobrado à parte.");
    if (oficial?.peso_cobrado_g && oficial.peso_cobrado_g > pesoConsideradoG(n) * 1.1 + 10) {
      add("media", `O ML está cobrando o frete por ${formatarPeso(oficial.peso_cobrado_g)}, mais que o cadastrado (${formatarPeso(pesoConsideradoG(n))}).`, "Conferir se o ML remediu a embalagem e se as medidas cadastradas estão corretas.");
    }
  }

  if (f.frete.gratis && f.frete.vendedor !== null && f.preco > 0) {
    const p = (f.frete.vendedor / f.preco) * 100;
    if (p >= cfg.freteAltoPct) {
      add(p >= cfg.freteCriticoPct ? "alta" : "media", `O frete estimado pago pelo vendedor (${reais(f.frete.vendedor)}) consome ${pct(p, 0)} do preço.`,
        "Conferir peso/medidas e avaliar preço, kit ou outra modalidade.");
    }
  }

  const reaisV = f.frete.reais.filter((r) => r.itens_no_pacote === 1);
  if (reaisV.length) {
    const medioV = centavos(reaisV.reduce((s, r) => s + r.vendedor, 0) / reaisV.length);
    const medioC = centavos(reaisV.reduce((s, r) => s + r.comprador, 0) / reaisV.length);
    linha.frete_real_medio = medioV;
    linha.frete_comprador_medio = medioC;
    if (oficial?.ok && f.frete.gratis && medioV > oficial.custo_vendedor * (1 + cfg.cobrancaToleranciaPct / 100) && medioV - oficial.custo_vendedor >= 2) {
      const dif = centavos(medioV - oficial.custo_vendedor);
      linha.cobrado_acima_estimado = { media_cobrada: medioV, estimado: oficial.custo_vendedor, envios: reaisV.length, diferenca_total: centavos(dif * reaisV.length) };
      potencial(dif);
      add("alta", `Frete cobrado nas vendas (média ${reais(medioV)} em ${reaisV.length} envio(s)) acima do estimado para o anúncio (${reais(oficial.custo_vendedor)}): ${reais(dif * reaisV.length)} a conferir.`,
        "Conferir as cobranças de envio no ML e as medidas cadastradas; contestar se a cobrança estiver errada.");
    }
    if (!f.frete.gratis && f.preco > 0 && medioC / f.preco > 0.3) {
      add("media", `O comprador paga em média ${reais(medioC)} de frete (${pct((medioC / f.preco) * 100, 0)} do preço): pode afastar vendas.`, "Avaliar frete grátis, kit ou preço com frete incluso.");
    }
  }

  if (!itens.length) return { achados: [], linha: null };
  if (!linha.classificacao) linha.classificacao = "alerta_ml";
  // UM alerta de frete por anúncio, com todos os pontos juntos.
  const sev = itens.reduce((m, i) => (PESO_SEVERIDADE[i.sev] > PESO_SEVERIDADE[m] ? i.sev : m), "baixa");
  linha.severidade = sev;
  // (12/11) Medidas ausentes / padronizado / divergência já começam com o próprio
  // título; só os alertas do ML ganham o cabeçalho (antes saía "X: X: ...").
  const titulo = CLASSIFICACOES_MEDIDAS[linha.classificacao].titulo;
  // (12/11) O ponto mais grave primeiro: com vendas lidas, "frete cobrado acima"
  // (alta) ficava escondido depois de "Bling padronizado" (baixa).
  const juntos = [...itens].sort((a, b) => PESO_SEVERIDADE[b.sev] - PESO_SEVERIDADE[a.sev]).map((i) => i.texto).join(" | ");
  const texto = itens.length > 1 && linha.classificacao === "alerta_ml" ? `${titulo}: ${juntos}` : juntos;
  const a = achado(f, AREAS.FRETE, sev, texto, linha.sugestao, null, {
    classificacao: linha.classificacao,
    impacto_potencial_por_envio: linha.impacto_potencial_por_envio,
    impacto_potencial_30d: linha.impacto_potencial_30d,
  });
  return { achados: [a], linha };
}

/** Analisa todos os anúncios. */
export function analisarAnuncios(dados, config = {}) {
  const cfg = { ...PADROES_ANALISE, ...config };
  const agora = dados.coletado_em;
  const vendidos30 = contarVendidos(dados.pedidos, agora, 30);
  const vendidos60 = contarVendidos(dados.pedidos, agora, 60);
  const ctxBase = { agora, cfg, vendidos30, vendidos60, recotacoes: config.recotacoes || {} };
  const fichas = dados.itens.map((it) => fichaDoAnuncio(it, dados, cfg, ctxBase));
  // (12/11) Conversão só com anúncios que têm visitas E vendas lidas
  // (anúncio com visita não lida não entra nem no numerador nem no denominador).
  const ambos = fichas.filter((f) => f.visitas30 !== null && f.vendas30 !== null);
  const visitasTot = ambos.reduce((s, f) => s + f.visitas30, 0);
  const vendasTot = ambos.reduce((s, f) => s + f.vendas30, 0);
  const leituraCompleta = dados.leituras?.vendas !== false && dados.leituras?.visitas !== false;
  const conversaoConta = !leituraCompleta ? null : visitasTot > 0 ? Math.round((vendasTot / visitasTot) * 10000) / 100 : 0;
  const ctx = { ...ctxBase, conversaoConta, perfilBling: perfilBling(dados, cfg) };
  const linhasFrete = [];
  for (const f of fichas) {
    f.pontuacao = pontuacaoInterna(f, ctx);
    f.margem = margemPorVenda(f, cfg);
    const frete = regrasFrete(f, ctx);
    if (frete.linha) linhasFrete.push(frete.linha);
    f.achados = [
      ...regrasVendas(f, ctx),
      ...regrasPreco(f),
      ...regrasMargem(f, ctx),
      ...regrasRenault(f),
      ...regrasConteudo(f),
      ...regrasQualidade(f),
      ...regrasEstoque(f, ctx),
      ...frete.achados,
    ];
  }
  return { fichas, linhasFrete, conversaoConta: ctx.conversaoConta, cfg };
}

/** Anúncios com medidas do anúncio x Bling divergentes (para recotar com as do Bling). */
export function precisamRecotar(dados, config = {}) {
  const out = [];
  const perfil = perfilBling(dados, { ...PADROES_ANALISE, ...config });
  for (const it of dados.itens) {
    const sku = skuDoItem(it);
    const ml = medidasDoAnuncio(it);
    const bl = medidasDoBling(sku ? dados.bling?.[sku] : null);
    // Bling padronizado/suspeito não serve de referência: não recota.
    if (ml && bl && divergentes(ml, bl) && it?.shipping?.free_shipping === true && !motivoBlingSuspeito(bl, ml, perfil)) out.push({ item: it, medida: bl });
  }
  return out;
}

export { diasAtras };
