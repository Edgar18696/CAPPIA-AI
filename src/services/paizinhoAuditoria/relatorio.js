// =============================================================
// PAIIA — Central do Paizinho: RELATÓRIO DA MANHÃ (função pura).
// Junta os achados da análise em um único relatório para a Central:
// resumo, prioridades, seções por assunto, "Fretes e Medidas — Problemas
// Encontrados", peças Renault e o que não pôde ser conferido.
// =============================================================
import { centavos, dataBrasilia, txt } from "./util.js";
import { AREAS, PESO_SEVERIDADE } from "./analise.js";

export const VERSAO_RELATORIO = 1;

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
  "Sem peso ou medidas confirmados: 'Medidas Pendentes de Conferência' (nenhum valor é inventado).",
  "A pontuação de qualidade é interna do PAIIA, não a nota oficial do Mercado Livre.",
]);

/** Ordem de prioridade: severidade, depois maior impacto financeiro (prejuízo primeiro). */
export function ordenarAchados(lista) {
  return [...lista].sort((a, b) =>
    (PESO_SEVERIDADE[b.severidade] || 0) - (PESO_SEVERIDADE[a.severidade] || 0) ||
    Math.abs(b.impacto_rs || 0) - Math.abs(a.impacto_rs || 0) ||
    txt(a.titulo).localeCompare(txt(b.titulo)));
}

function resumirFalhas(falhas) {
  const porEtapa = {};
  for (const f of falhas || []) {
    const k = f.etapa;
    porEtapa[k] = porEtapa[k] || { etapa: k, quantidade: 0, exemplo: f.erro };
    porEtapa[k].quantidade++;
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
  const faturamento30 = vendasLidas ? centavos(fichas.reduce((s, f) => s + (f.vendas30 || 0) * f.preco, 0)) : null;
  const prejuizo = centavos(todos.reduce((s, a) => s + (a.impacto_rs && a.impacto_rs < 0 ? -a.impacto_rs : 0), 0));
  const contagem = { alta: 0, media: 0, baixa: 0 };
  for (const a of problemas) contagem[a.severidade] = (contagem[a.severidade] || 0) + 1;

  const secoes = SECOES.map((s) => ({ ...s, achados: ordenarAchados(todos.filter((a) => a.area === s.chave)) }));
  const renault = fichas.filter((f) => f.renault).map((f) => {
    const a = f.achados.find((x) => x.area === AREAS.RENAULT || (x.area === AREAS.OPORTUNIDADE && x.sem_custo));
    return { item_id: f.id, sku: f.sku, titulo: f.titulo, link: f.link, preco: f.preco, custo: f.custo, tabela_renault: a?.tabela_renault ?? null, concorrencia: a?.concorrencia ?? null, recomendacao: f.custo ? "custo no Bling: margem calculada normalmente" : (a?.recomendacao || "dados insuficientes") };
  });

  const limitacoes = [];
  if (!dados.fontes?.bling) limitacoes.push("Bling não consultado nesta execução: custos, margens e medidas do Bling não foram conferidos.");
  if (!dados.fontes?.concorrencia) limitacoes.push("Concorrência não pesquisada nesta execução.");
  else limitacoes.push(`Concorrência pesquisada só para os ${Object.keys(dados.concorrencia || {}).length} anúncios mais vendidos/visitados (controle de créditos).`);
  if (analise.cfg.impostoPercentual === null || analise.cfg.impostoPercentual === undefined) limitacoes.push("Imposto não informado: as margens aparecem 'antes dos impostos'.");
  if (dados.totais.anuncios_ativos > dados.totais.anuncios_analisados) limitacoes.push(`Analisados ${dados.totais.anuncios_analisados} de ${dados.totais.anuncios_ativos} anúncios ativos (limite desta execução).`);
  if (!fichas.some((f) => f.tabela_renault)) limitacoes.push("Tabela Renault ainda não carregada: peças Renault comparadas só com a concorrência.");
  if (!visitasLidas) limitacoes.push("Visitas NÃO lidas (o servidor não permite esta consulta): conversão e anúncios sem visitas não avaliados.");
  if (!vendasLidas) limitacoes.push("Vendas NÃO lidas (o servidor não permite esta consulta): produtos parados, reposição, frete cobrado nas vendas e prejuízo por vendas não avaliados.");
  limitacoes.push("Prazo de entrega não avaliado (depende do CEP do comprador).");

  return {
    versao: VERSAO_RELATORIO,
    origem,
    conta: { id: dados.conta.id, apelido: dados.conta.apelido, nome: nomeConta || dados.conta.apelido },
    data_referencia: dataBrasilia(geradoEm),
    gerado_em: geradoEm,
    periodo: dados.periodo,
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
      prejuizo_estimado_30d: prejuizo,
      medidas_pendentes: todos.filter((a) => a.area === AREAS.FRETE && a.problema.startsWith("Medidas Pendentes")).length,
      sem_custo: fichas.filter((f) => !f.custo).length,
      pontuacao_media: fichas.length ? Math.round(fichas.reduce((s, f) => s + f.pontuacao.total, 0) / fichas.length) : 0,
    },
    prioridades: ordenarAchados(problemas).slice(0, 15),
    oportunidades: ordenarAchados(oportunidades).slice(0, 15),
    secoes,
    fretes_medidas: ordenarAchados(analise.linhasFrete.map((l) => ({ ...l, severidade: undefined }))).sort((a, b) => (a.impacto_rs ?? 0) - (b.impacto_rs ?? 0) || b.divergencias.length - a.divergencias.length),
    renault,
    anuncios: fichas.map((f) => ({ item_id: f.id, sku: f.sku, titulo: f.titulo, preco: f.preco, estoque: f.estoque, visitas30: f.visitas30, vendas30: f.vendas30, conversao30: f.conversao30, pontuacao: f.pontuacao.total, margem_pct: f.margem?.margem_pct ?? null, problemas: f.achados.length })),
    limitacoes,
    falhas: resumirFalhas(dados.falhas),
    regras: REGRAS_DO_RELATORIO,
  };
}
