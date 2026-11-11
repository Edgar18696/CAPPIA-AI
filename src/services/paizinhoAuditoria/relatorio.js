// =============================================================
// PAIIA — Central do Paizinho: RELATÓRIO DA MANHÃ (função pura).
// Junta os achados da análise em um único relatório para a Central:
// resumo, prioridades, seções por assunto, "Fretes e Medidas — Problemas
// Encontrados", peças Renault e o que não pôde ser conferido.
// =============================================================
import { centavos, dataBrasilia, num, txt } from "./util.js";
import { AREAS, PESO_SEVERIDADE, CLASSIFICACOES_MEDIDAS } from "./analise.js";

// 2: Fretes e Medidas em três classificações, agrupados por SKU, com impacto potencial.
export const VERSAO_RELATORIO = 2;

export const SECOES = Object.freeze([
  { chave: AREAS.MARGEM, titulo: "Margem e rentabilidade" },
  { chave: AREAS.FRETE, titulo: "Fretes e Medidas — Problemas Encontrados" },
  { chave: AREAS.VENDAS, titulo: "Vendas, visitas e conversão" },
  { chave: AREAS.PRECO, titulo: "Preços x concorrência" },
  { chave: AREAS.RENAULT, titulo: "Peças Renault sem custo (tabela Renault e concorrência)" },
  { chave: AREAS.CONTEUDO, titulo: "Títulos, descrições, códigos e palavras-chave" },
  { chave: AREAS.COMPAT, titulo: "Compatibilidades" },
  { chave: AREAS.QUALIDADE, titulo: "Qualidade e ranqueamento (pontuação interna)" },
  { chave: AREAS.ESTOQUE, titulo: "Estoque e produtos parados" },
  { chave: AREAS.OPORTUNIDADE, titulo: "Oportunidades comerciais" },
]);

export const REGRAS_DO_RELATORIO = Object.freeze([
  "Somente leitura: nenhum anúncio, preço, estoque, medida ou compatibilidade foi alterado.",
  "Uma conta por relatório; anúncios de outras contas são descartados.",
  "Sem custo confiável no Bling, a margem não é calculada (nunca é estimada).",
  "Peças Renault de lote antigo sem custo: comparação com a tabela Renault e a concorrência, sem lucro calculado.",
  "Sem peso ou medidas no anúncio: 'Medidas ausentes' (nenhum valor é inventado).",
  "Medidas do Bling repetidas em muitos SKUs ou improváveis: 'possivelmente padronizadas', não usadas como referência até confirmar.",
  "Diferença de frete é IMPACTO POTENCIAL estimado, nunca prejuízo confirmado; toda divergência fica pendente de conferência física.",
  "Os dados originais do Mercado Livre e do Bling ficam guardados no relatório, sem alteração.",
  "A pontuação de qualidade é interna do PAIIA, não a nota oficial do Mercado Livre.",
]);

/** Impacto financeiro de um achado: prejuízo calculado ou impacto potencial (30 dias; sem vendas, por envio). */
const impactoDoAchado = (a) => Math.max(Math.abs(num(a.impacto_rs)), num(a.impacto_potencial_30d ?? a.impacto_potencial_por_envio));

/**
 * Ordem de prioridade: (12/11) primeiro o que é ALTA gravidade — custo real de
 * hoje (frete consumindo o preço, prejuízo com custo real, cobrança acima) —,
 * depois o maior impacto financeiro (calculado ou potencial), depois severidade.
 * Uma estimativa que depende do Bling estar certo nunca passa na frente de um custo atual.
 */
const ehAlta = (x) => (x?.severidade === "alta" ? 1 : 0);
export function ordenarAchados(lista) {
  return [...lista].sort((a, b) =>
    ehAlta(b) - ehAlta(a) ||
    impactoDoAchado(b) - impactoDoAchado(a) ||
    (PESO_SEVERIDADE[b.severidade] || 0) - (PESO_SEVERIDADE[a.severidade] || 0) ||
    txt(a.titulo).localeCompare(txt(b.titulo)));
}

/**
 * Chave de ordenação do impacto POTENCIAL de frete (estimado): com vendas
 * lidas usa o valor de 30 dias (diferença × vendas); sem vendas, o valor por
 * envio; depois o frete estimado que o vendedor paga hoje.
 */
function pesoImpacto(l) {
  return [ehAlta(l), num(l.impacto_potencial_30d), num(l.impacto_potencial_por_envio), num(l.frete_gratis ? l.frete_vendedor : 0) * Math.max(1, num(l.vendas30))];
}
function compararImpacto(a, b) {
  const x = pesoImpacto(a), y = pesoImpacto(b);
  for (let i = 0; i < x.length; i++) if (y[i] !== x[i]) return y[i] - x[i];
  return 0;
}

/** Fretes e Medidas agrupados por SKU (um grupo por SKU, todos os anúncios dentro). */
export function agruparFretesPorSku(linhas) {
  const grupos = new Map();
  for (const l of linhas) {
    const chave = txt(l.sku) || `sem-sku:${l.item_id}`;
    if (!grupos.has(chave)) grupos.set(chave, { sku: txt(l.sku) || null, titulo: l.titulo, anuncios: [] });
    grupos.get(chave).anuncios.push(l);
  }
  const ordemClasse = (c) => CLASSIFICACOES_MEDIDAS[c]?.ordem ?? 9;
  return [...grupos.values()].map((g) => {
    g.anuncios.sort(compararImpacto);
    const classes = [...new Set(g.anuncios.map((l) => l.classificacao))].sort((a, b) => ordemClasse(a) - ordemClasse(b));
    const porEnvio = g.anuncios.map((l) => l.impacto_potencial_por_envio).filter((v) => v !== null && v !== undefined);
    const em30 = g.anuncios.map((l) => l.impacto_potencial_30d).filter((v) => v !== null && v !== undefined);
    return {
      ...g,
      classificacao: classes[0],
      classificacoes: classes,
      severidade: g.anuncios.some((l) => l.severidade === "alta") ? "alta" : g.anuncios.some((l) => l.severidade === "media") ? "media" : "baixa",
      impacto_potencial_por_envio: porEnvio.length ? Math.max(...porEnvio) : null,
      impacto_potencial_30d: em30.length ? centavos(em30.reduce((s, v) => s + v, 0)) : null,
      frete_vendedor: Math.max(0, ...g.anuncios.map((l) => (l.frete_gratis ? num(l.frete_vendedor) : 0))),
      vendas30: g.anuncios.some((l) => l.vendas30 === null) ? null : g.anuncios.reduce((s, l) => s + num(l.vendas30), 0),
      conferencia: "pendente",
    };
  }).sort(compararImpacto);
}

function resumirFalhas(falhas) {
  const porEtapa = {};
  for (const f of falhas || []) {
    const k = f.etapa;
    porEtapa[k] = porEtapa[k] || { etapa: k, quantidade: 0, exemplo: f.erro };
    porEtapa[k].quantidade += Number(f.quantidade) > 0 ? Number(f.quantidade) : 1;
  }
  return Object.values(porEtapa);
}

/**
 * @param {object} p
 * @param {object} p.dados      resultado de coletarDadosConta
 * @param {object} p.analise    resultado de analisarAnuncios
 * @param {string} p.nomeConta  ex.: "LOJA ONLINE"
 */
export function montarRelatorio({ dados, analise, nomeConta = "", origem = "teste_local", geradoEm = new Date().toISOString() }) {
  const fichas = analise.fichas;
  const todos = fichas.flatMap((f) => f.achados);
  const problemas = todos.filter((a) => a.area !== AREAS.OPORTUNIDADE && !a.positivo);
  const oportunidades = todos.filter((a) => a.area === AREAS.OPORTUNIDADE);
  // (11/11) Não lido = null (a tela mostra "não lido"), nunca zero.
  const visitasLidas = dados.leituras?.visitas !== false;
  const vendasLidas = dados.leituras?.vendas !== false;
  const visitas30 = visitasLidas ? fichas.reduce((s, f) => s + (f.visitas30 || 0), 0) : null;
  const unidades30 = vendasLidas ? fichas.reduce((s, f) => s + (f.vendas30 || 0), 0) : null;
  // (12/11) Valor real dos pedidos pagos (antes: vendas × preço atual, que errava quando o preço mudou).
  const faturamento30 = vendasLidas ? centavos(fichas.reduce((s, f) => s + (f.faturamento30 || 0), 0)) : null;
  const prejuizo = centavos(todos.reduce((s, a) => s + (a.impacto_rs && a.impacto_rs < 0 ? -a.impacto_rs : 0), 0));
  const fretesPorSku = agruparFretesPorSku(analise.linhasFrete);
  const contarClasse = (c) => analise.linhasFrete.filter((l) => l.classificacao === c).length;
  const contagem = { alta: 0, media: 0, baixa: 0 };
  for (const a of problemas) contagem[a.severidade] = (contagem[a.severidade] || 0) + 1;

  const secoes = SECOES.map((s) => ({ ...s, achados: ordenarAchados(todos.filter((a) => a.area === s.chave)) }));
  const renault = fichas.filter((f) => f.renault).map((f) => {
    const a = f.achados.find((x) => x.area === AREAS.RENAULT || (x.area === AREAS.OPORTUNIDADE && x.sem_custo));
    return { item_id: f.id, sku: f.sku, titulo: f.titulo, link: f.link, preco: f.preco, custo: f.custo, tabela_renault: a?.tabela_renault ?? null, concorrencia: a?.concorrencia ?? null, recomendacao: f.custo ? "custo no Bling: margem calculada normalmente" : (a?.recomendacao || "dados insuficientes") };
  });

  const limitacoes = [];
  // (12/11) Leitura parcial nunca aparece como "não consultado" nem como completa.
  const motivoTexto = (m) => (m === "sessao" ? "a sessão do PAIIA expirou: entre de novo e rode outra vez" : m === "fora_do_ar" ? "o Bling parou de responder" : "algumas consultas falharam");
  const bp = dados.fontes?.bling_parcial;
  const rp = dados.leituraRecotacao;
  if (!dados.fontes?.bling) limitacoes.push(bp?.motivo === "sessao"
    ? "Bling não lido: a sessão do PAIIA expirou. Entre de novo e rode outra vez."
    : "Bling não consultado nesta execução: custos, margens e medidas do Bling não foram conferidos.");
  else if (bp) limitacoes.push(`Bling lido só em ${bp.lidos} de ${bp.total} SKUs (${motivoTexto(bp.motivo)}). Os demais aparecem como "Bling não consultado".`);
  if (rp) limitacoes.push(`Frete recotado com as medidas do Bling em ${rp.feitas} de ${rp.total} anúncios (${motivoTexto(rp.motivo)}).`);
  // (12/11) Custo: cobertura sempre visível; custo ausente nunca vira zero.
  const cp = dados.fontes?.custo;
  const comCusto = fichas.filter((f) => f.custo).length;
  const custoAConfirmar = fichas.filter((f) => f.custo && f.custo_a_confirmar).length;
  if (cp && cp.motivo) limitacoes.push(`Preço de custo lido só em ${cp.lidos} de ${cp.total} SKUs (${motivoTexto(cp.motivo)}).`);
  if (cp) limitacoes.push(`Preço de custo no Bling em ${comCusto} de ${fichas.length} anúncios${custoAConfirmar ? ` (${custoAConfirmar} com custo a confirmar)` : ""}: margem e prejuízo só onde há custo; os demais aparecem "sem custo".`);
  const sessaoExpirada = bp?.motivo === "sessao" || rp?.motivo === "sessao" || cp?.motivo === "sessao";
  if (!dados.fontes?.concorrencia) limitacoes.push("Concorrência não pesquisada nesta execução.");
  else limitacoes.push(`Concorrência pesquisada só para os ${Object.keys(dados.concorrencia || {}).length} anúncios mais vendidos/visitados (controle de créditos).`);
  if (analise.cfg.impostoPercentual === null || analise.cfg.impostoPercentual === undefined) limitacoes.push("Imposto não informado: as margens aparecem 'antes dos impostos'.");
  if (dados.totais.anuncios_ativos > dados.totais.anuncios_analisados) limitacoes.push(`Analisados ${dados.totais.anuncios_analisados} de ${dados.totais.anuncios_ativos} anúncios ativos (limite desta execução).`);
  if (!fichas.some((f) => f.tabela_renault)) limitacoes.push("Tabela Renault ainda não carregada: peças Renault comparadas só com a concorrência.");
  // (12/11) Mostra o motivo real (servidor recusou, função não publicada, sessão...).
  const motivoNaoLido = (etapa) => {
    const e = txt((dados.falhas || []).find((f) => f.etapa === etapa)?.erro);
    if (/não foi publicada/i.test(e)) return "a função de leitura de vendas e visitas ainda não foi publicada";
    if (/fora da lista permitida|não permitid/i.test(e)) return "o servidor não permite esta consulta";
    return e || "consulta indisponível";
  };
  const semVisita = fichas.filter((f) => f.visitas30 === null).length;
  if (visitasLidas && semVisita > 0) {
    limitacoes.push(`Visitas lidas em ${fichas.length - semVisita} de ${fichas.length} anúncios (${motivoNaoLido("visitas")}): esses ${semVisita} ficam fora da conversão e das conclusões de visitas.`);
  }
  if (!visitasLidas) limitacoes.push(`Visitas NÃO lidas (${motivoNaoLido("visitas")}): conversão e anúncios sem visitas não avaliados.`);
  if (!vendasLidas) limitacoes.push(`Vendas NÃO lidas (${motivoNaoLido("vendas")}): produtos parados, reposição, frete cobrado nas vendas e prejuízo por vendas não avaliados.`);
  limitacoes.push("Prazo de entrega não avaliado (depende do CEP do comprador).");

  return {
    versao: VERSAO_RELATORIO,
    origem,
    conta: { id: dados.conta.id, apelido: dados.conta.apelido, nome: nomeConta || dados.conta.apelido },
    data_referencia: dataBrasilia(geradoEm),
    gerado_em: geradoEm,
    periodo: dados.periodo,
    leitura_incompleta: bp || rp || cp?.motivo ? { bling: bp || null, recotacao: rp || null, custo: cp?.motivo ? cp : null, sessao_expirada: sessaoExpirada } : null,
    resumo: {
      anuncios_ativos: dados.totais.anuncios_ativos,
      anuncios_analisados: dados.totais.anuncios_analisados,
      descartados_outra_conta: dados.totais.descartados_outra_conta,
      visitas_30d: visitas30,
      unidades_vendidas_30d: unidades30,
      faturamento_30d: faturamento30,
      conversao_30d: analise.conversaoConta,
      problemas: contagem,
      oportunidades: oportunidades.length,
      // Prejuízo CALCULADO com custo real (margem). Frete divergente não entra aqui.
      // (12/11) Sem nenhum custo cadastrado, não existe prejuízo calculado (null, nunca R$ 0,00).
      prejuizo_estimado_30d: vendasLidas && fichas.some((f) => f.custo && !f.custo_a_confirmar) ? prejuizo : null,
      anuncios_com_custo: comCusto,
      anuncios_custo_a_confirmar: custoAConfirmar,
      // Possível prejuízo com custo a confirmar: fica à parte, nunca somado ao confirmado.
      prejuizo_a_confirmar_30d: vendasLidas ? centavos(todos.reduce((s, a) => s + (a.impacto_a_confirmar_30d && a.impacto_a_confirmar_30d < 0 ? -a.impacto_a_confirmar_30d : 0), 0)) || null : null,
      medidas_pendentes: contarClasse("medidas_ausentes"),
      fretes_medidas: {
        anuncios: analise.linhasFrete.length,
        skus: fretesPorSku.length,
        medidas_ausentes: contarClasse("medidas_ausentes"),
        bling_padronizado: contarClasse("bling_padronizado"),
        divergencia_relevante: contarClasse("divergencia_relevante"),
        alerta_ml: contarClasse("alerta_ml"),
        divergencia_pequena: analise.fichas.filter((f) => f.divergencia_pequena).length,
        impacto_potencial_por_envio: centavos(analise.linhasFrete.reduce((s, l) => s + num(l.impacto_potencial_por_envio), 0)),
        impacto_potencial_30d: vendasLidas ? centavos(analise.linhasFrete.reduce((s, l) => s + num(l.impacto_potencial_30d), 0)) : null,
      },
      sem_custo: fichas.filter((f) => !f.custo).length,
      pontuacao_media: fichas.length ? Math.round(fichas.reduce((s, f) => s + f.pontuacao.total, 0) / fichas.length) : 0,
    },
    prioridades: ordenarAchados(problemas).slice(0, 15),
    oportunidades: ordenarAchados(oportunidades).slice(0, 15),
    secoes,
    // Uma linha por anúncio (dados completos, inclusive os originais) e a visão agrupada por SKU.
    fretes_medidas: [...analise.linhasFrete].sort(compararImpacto),
    fretes_por_sku: fretesPorSku,
    classificacoes_medidas: CLASSIFICACOES_MEDIDAS,
    renault,
    anuncios: fichas.map((f) => ({ item_id: f.id, sku: f.sku, titulo: f.titulo, preco: f.preco, estoque: f.estoque, visitas30: f.visitas30, vendas30: f.vendas30, faturamento30: f.faturamento30, custo: f.custo, custo_a_confirmar: f.custo_a_confirmar || false, custo_faixa: f.custo_faixa || null, custo_motivo: f.custo_motivo || null, link: f.link, conversao30: f.conversao30, pontuacao: f.pontuacao.total, margem_pct: f.margem?.margem_pct ?? null, problemas: f.achados.length, frete_gratis: f.frete.gratis, frete_vendedor: f.frete.vendedor, medidas_anuncio: f.medidas_ml, medidas_bling: f.medidas_bling, divergencia_pequena: f.divergencia_pequena || null, dados_originais: f.dados_originais })),
    limitacoes,
    falhas: resumirFalhas(dados.falhas),
    regras: REGRAS_DO_RELATORIO,
  };
}
