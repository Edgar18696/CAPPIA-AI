// =============================================================
// PAIIA — Black Friday 2026: CALENDÁRIO OBRIGATÓRIO (regras do Edgar, 15/11/2026).
//   27/11/2026 00:00 (Brasília) → início, ativação das ofertas APROVADAS;
//   27 a 30/11/2026            → período promocional;
//   30/11/2026 23:59 (Brasília) → encerramento automático;
//   01/12/2026                 → todos os anúncios de novo no preço normal (conferência).
// Brasília = UTC−3 (sem horário de verão). Funções puras.
// =============================================================

export const CAMPANHA_BF = Object.freeze({
  id: "black-friday-2026",
  nome: "Black Friday 2026",
  inicio: "2026-11-27T00:00:00-03:00",
  fim: "2026-11-30T23:59:00-03:00",
  // Conferência do retorno ao preço normal (rede de segurança no servidor, Fase 3).
  conferencias: Object.freeze(["2026-12-01T00:15:00-03:00", "2026-12-01T08:00:00-03:00"]),
});

const ms = (iso) => new Date(iso).getTime();

/**
 * Em que momento da campanha estamos.
 * @returns {"preparacao"|"em_andamento"|"encerrada"}
 */
export function momentoDaCampanha(agora = new Date().toISOString(), c = CAMPANHA_BF) {
  const t = ms(agora);
  if (t < ms(c.inicio)) return "preparacao";
  if (t <= ms(c.fim)) return "em_andamento";
  return "encerrada";
}

/** Data/hora no horário de Brasília, ex.: "27/11/2026 00:00". */
export function dataHoraBrasilia(iso) {
  const d = new Date(ms(iso) - 3 * 3600000);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** Dias inteiros que faltam para o início (0 = começa hoje ou já começou). */
export function diasParaInicio(agora = new Date().toISOString(), c = CAMPANHA_BF) {
  return Math.max(0, Math.ceil((ms(c.inicio) - ms(agora)) / 86400000));
}

/**
 * (16/11) Conferência do ENCERRAMENTO (01/12): compara, para cada oferta aprovada da
 * conta, o preço lido DEPOIS do fim da campanha com o preço original confirmado na
 * aprovação. Só aponta diferenças: nunca altera preço (nada de sobrescrever em massa).
 * @param {{ aprovados: object, itens: Array<{item, precoVenda}>, conta: string, lidoEm: string }} p
 * @returns {{ valida: boolean, motivo?: string, linhas: Array<{item, estado, texto}>, resumo: object }}
 */
export function conferirEncerramento({ aprovados, itens, conta, lidoEm }, c = CAMPANHA_BF) {
  const resumo = { total: 0, normal: 0, com_desconto: 0, diferente: 0, nao_lido: 0 };
  if (!lidoEm || ms(lidoEm) <= ms(c.fim)) return { valida: false, motivo: `A conferência só vale com uma leitura feita depois de ${dataHoraBrasilia(c.fim)}.`, linhas: [], resumo };
  const porId = new Map((itens || []).map((x) => [String(x.item?.id || "").toUpperCase(), x]));
  const reais = (v) => `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
  const linhas = [];
  for (const a of Object.values(aprovados || {})) {
    if (String(a.conta) !== String(conta)) continue;
    resumo.total++;
    const x = porId.get(String(a.item).toUpperCase());
    if (!x) { resumo.nao_lido++; linhas.push({ item: a.item, estado: "nao_lido", texto: "Anúncio não lido nesta consulta (pausado, encerrado ou erro): conferir no ML." }); continue; }
    const preco = Number(x.item.price);
    const comDesconto = x.precoVenda?.ativa === true || (Number(x.item.original_price) > preco);
    if (comDesconto) { resumo.com_desconto++; linhas.push({ item: a.item, estado: "com_desconto", texto: `Ainda com desconto no ML (${reais(x.precoVenda?.preco ?? preco)}): encerrar a oferta na Central de Promoções.` }); continue; }
    if (Math.abs(preco - Number(a.preco_original)) < 0.01) { resumo.normal++; linhas.push({ item: a.item, estado: "normal", texto: `Preço normal (${reais(preco)}).` }); continue; }
    resumo.diferente++;
    linhas.push({ item: a.item, estado: "diferente", texto: `Preço ${reais(preco)} diferente do original ${reais(a.preco_original)}: pode ser alteração manual — conferir; o PAIIA não muda o preço.` });
  }
  return { valida: true, linhas, resumo };
}

/**
 * (16/11) Ofertas CONFIRMADAS no Mercado Livre: só conta como ativa a oferta aprovada cujo
 * preço de venda LIDO no ML (sale_price ou original_price do anúncio) está com desconto e
 * igual ao preço promocional aprovado. Nunca marca como publicada sem essa leitura.
 */
export function ofertasConfirmadasNoML({ aprovados, itens, conta }) {
  const porId = new Map((itens || []).map((x) => [String(x.item?.id || "").toUpperCase(), x]));
  let aprovadas = 0;
  const confirmadas = [];
  for (const a of Object.values(aprovados || {})) {
    if (String(a.conta) !== String(conta)) continue;
    aprovadas++;
    const x = porId.get(String(a.item).toUpperCase());
    if (!x) continue;
    const pv = x.precoVenda;
    const preco = pv?.lido ? Number(pv.preco) : Number(x.item.price);
    const comDesconto = pv?.lido ? pv.ativa === true : Number(x.item.original_price) > Number(x.item.price);
    if (comDesconto && Math.abs(preco - Number(a.preco_final)) < 0.01) confirmadas.push(a.item);
  }
  return { aprovadas, confirmadas };
}
