// =============================================================
// PAIIA — Black Friday 2026: PLANILHA para cadastro MANUAL das ofertas
// na Central de Promoções do Mercado Livre (16/11/2026).
//
// Só gera um arquivo a partir da simulação: NÃO altera preço, anúncio,
// estoque nem promoção. Uma conta por vez. Separa PRONTO, CONFERIR e BLOQUEADO.
//
// Regras oficiais do "Desconto individual" (PRICE_DISCOUNT), conforme
// developers.mercadolivre.com.br/pt_br/desconto-individua:
//   - reputação verde; anúncio ativo; condição NOVO; exposição não gratuita;
//   - desconto >= 5% e < 80%;
//   - prazo máximo de 14 dias; datas por dia (00:00 do início até 23:59:59 do fim);
//   - se o preço subir, o desconto cai; se estiver em DEAL, só começa quando o DEAL acabar.
// =============================================================
import { CAMPANHA_BF } from "./calendario.js";
import { CLASSES, SITUACOES, ROTULO_SITUACAO } from "./regras.js";

const txt = (v) => (v === null || v === undefined ? "" : String(v)).trim();
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

export const REGRAS_DESCONTO_INDIVIDUAL = Object.freeze({ minimoPct: 5, maximoPct: 80, prazoMaximoDias: 14 });
/** PRONTO = pode aprovar; CONFERIR = falta dado ou há dúvida; BLOQUEADO = não pode entrar (inelegível, prejuízo ou excluído). */
export const LISTAS = Object.freeze({ PRONTO: "PRONTO", CONFERIR: "CONFERIR", BLOQUEADO: "BLOQUEADO" });

/** (16/11) Margem negativa ou não verificável: nunca aprovada (nem manualmente). */
export const margemComProblema = (l) => !!l && Boolean(l.custo_motivo || l.margem_pct === null || l.margem_pct === undefined || (l.lucro !== null && l.lucro !== undefined && l.lucro < 0));

/** (16/11) Aprovação SÓ para PRONTO com margem verificada e não negativa (regra definitiva). */
export const aprovavel = (l) => !!l && classificarParaPlanilha(l).lista === LISTAS.PRONTO && !margemComProblema(l);

/**
 * (18/11) Pode ENTRAR NA SELEÇÃO da campanha (não é aprovação): não está BLOQUEADO, tem preço
 * promocional e a classe (10% ou 5%) está definida. Imposto ou custo ausentes NÃO impedem a seleção:
 * a margem aparece como "Margem não verificada" e só a aprovação continua exigindo margem verificada.
 */
export const selecionavel = (l) => !!l && classificarParaPlanilha(l).lista !== LISTAS.BLOQUEADO && l.preco_final > 0 && (l.regra === "percentual" || !(l.classe === CLASSES.REVISAO && !l.decisao));

/** Desconto real em % (2 casas), a partir dos preços em reais. */
export const descontoReal = (original, final) => (num(original) > 0 ? Math.floor(((num(original) - num(final)) / num(original)) * 10000 + 1e-6) / 100 : 0);

/**
 * Classifica uma linha da simulação para a planilha e para a tela.
 * BLOQUEADO = impedimento que nenhum dado resolve (bloqueio do anúncio, condição usada,
 * anúncio grátis, desconto real abaixo de 5%, prejuízo, excluído por você);
 * CONFERIR = falta dado ou há dúvida; PRONTO = sem nenhuma pendência.
 * A promoção que a API não deixa conferir (403) vira OBSERVAÇÃO, não pendência:
 * no cadastro manual, a própria Central de Promoções mostra as promoções do anúncio.
 */
export function classificarParaPlanilha(l) {
  const real = descontoReal(l.preco_original, l.preco_final);
  if (l.situacao === SITUACOES.EXCLUIDO) return { lista: LISTAS.BLOQUEADO, pendencias: ["Excluído da campanha por você."], observacoes: [], desconto_real_pct: real };
  const impedimentos = [];
  const pendencias = [];
  const observacoes = [];
  for (const b of l.bloqueios || []) impedimentos.push(`Bloqueio: ${b}`);
  if (l.condicao && l.condicao !== "new") impedimentos.push(`Inelegível: condição "${l.condicao}" — o desconto individual exige produto novo.`);
  if (l.tipo_anuncio === "free") impedimentos.push("Inelegível: anúncio grátis — o desconto individual exige exposição paga.");
  if (l.preco_final > 0 && real < REGRAS_DESCONTO_INDIVIDUAL.minimoPct) impedimentos.push(`Inelegível: desconto real de ${String(real).replace(".", ",")}% abaixo do mínimo de 5% do ML.`);
  const prejuizo = l.lucro !== null && l.lucro !== undefined && l.lucro < 0;
  for (const m of l.motivos || []) {
    if (l.promocao === "nao_verificada" && m === l.promocao_texto) continue;
    (prejuizo && /PREJUÍZO/.test(m) ? impedimentos : pendencias).push(m);
  }
  if (prejuizo && !impedimentos.some((x) => /PREJUÍZO/.test(x))) impedimentos.push(`PREJUÍZO de R$ ${(-l.lucro).toFixed(2).replace(".", ",")} por venda no preço promocional.`);
  for (const a of l.alertas || []) pendencias.push(`Atenção: ${a}`);
  if (l.classe === CLASSES.REVISAO && !l.decisao) pendencias.push("Dúvida de aplicação Renault (10% ou 5%).");
  if (!l.condicao) pendencias.push("Condição do anúncio não lida (o desconto individual exige produto novo).");
  if (!(l.preco_final > 0)) pendencias.push("Preço promocional não calculado.");
  if (l.promocao === "nao_verificada") observacoes.push("Promoções programadas não puderam ser conferidas pela API: confira na tela do ML ao cadastrar.");
  // (16/11) Margem não verificada NÃO vai para PRONTO (regra do Edgar).
  if (l.custo_motivo || l.margem_pct === null || l.margem_pct === undefined) pendencias.push(`Margem não verificada${l.custo_motivo ? ` (custo: ${l.custo_motivo})` : ""}.`);
  const lista = impedimentos.length ? LISTAS.BLOQUEADO : pendencias.length ? LISTAS.CONFERIR : LISTAS.PRONTO;
  return { lista, pendencias: [...impedimentos, ...pendencias], observacoes, desconto_real_pct: real };
}

const vazio = (v) => v === null || v === undefined || v === "";
const reais = (v) => (vazio(v) ? "" : num(v).toFixed(2).replace(".", ","));
const pct = (v) => (vazio(v) ? "" : String(num(v)).replace(".", ","));
const celula = (v) => { const t = txt(v).replace(/\r?\n/g, " "); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
const dataBR = (iso) => { const m = txt(iso).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; };

export const COLUNAS_PLANILHA = Object.freeze(["Lista", "Conta", "MLB", "SKU", "Título", "Classe", "Preço original (R$)", "Desconto (%)", "Preço promocional (R$)", "Desconto real (%)", "Custo da peça (R$)", "Comissão ML (R$)", "Imposto (R$)", "Frete (R$)", "Custo por pedido (R$)", "Lucro (R$)", "Margem (%)", "Situação na simulação", "Motivo da pendência", "Observações", "Início", "Fim", "Link"]);

/** Linhas da planilha de UMA conta (ordem: PRONTO, CONFERIR, BLOQUEADO). Custo/lucro vazios = não confirmados (nunca inventados). */
export function montarPlanilha(linhas, conta) {
  const ordem = { PRONTO: 0, CONFERIR: 1, BLOQUEADO: 2 };
  return (linhas || [])
    .filter((l) => txt(l.conta) === txt(conta))
    .map((l) => ({ l, c: classificarParaPlanilha(l) }))
    .sort((a, b) => ordem[a.c.lista] - ordem[b.c.lista] || txt(a.l.titulo).localeCompare(txt(b.l.titulo), "pt-BR"))
    .map(({ l, c }) => ({
      lista: c.lista, conta: l.conta_nome, mlb: l.id, sku: l.sku || "", titulo: l.titulo,
      classe: l.classe === CLASSES.RENAULT ? "Renault comprovada (10%)" : l.classe === CLASSES.DEMAIS ? "Demais (5%)" : "Revisão",
      situacao: ROTULO_SITUACAO[l.situacao] || l.situacao || "",
      preco_atual: l.preco_original, desconto_pct: l.desconto_pct, preco_promocional: l.preco_final,
      desconto_real_pct: c.desconto_real_pct,
      custo: l.custo ?? null, comissao: l.tarifa ?? null, imposto: l.imposto ?? null, frete: l.frete ?? null,
      custo_pedido: l.custo_pedido ?? null, lucro: l.lucro ?? null, margem_pct: l.margem_pct ?? null,
      inicio: dataBR(CAMPANHA_BF.inicio), fim: dataBR(CAMPANHA_BF.fim),
      pendencias: c.pendencias, observacoes: c.observacoes, link: l.link,
    }));
}

/** CSV para o Excel brasileiro (";" e vírgula decimal, com BOM). */
export function planilhaCSV(planilha) {
  const linhas = [COLUNAS_PLANILHA.join(";")];
  for (const r of planilha) {
    const custo = vazio(r.custo) ? "não confirmado" : reais(r.custo);
    linhas.push([r.lista, r.conta, r.mlb, r.sku, r.titulo, r.classe, reais(r.preco_atual), pct(r.desconto_pct), reais(r.preco_promocional), pct(r.desconto_real_pct), custo, reais(r.comissao), reais(r.imposto), reais(r.frete), reais(r.custo_pedido), reais(r.lucro), pct(r.margem_pct), r.situacao, r.pendencias.join(" | "), r.observacoes.join(" | "), r.inicio, r.fim, r.link].map(celula).join(";"));
  }
  return `${String.fromCharCode(0xfeff)}${linhas.join("\r\n")}\r\n`;
}

/** Resumo para conferência: quantidades, descontos e pendências mais comuns. */
export function resumirPlanilha(planilha) {
  const r = { total: planilha.length, pronto: 0, conferir: 0, bloqueado: 0, renault10: 0, demais5: 0, revisao: 0, soma_atual: 0, soma_promocional: 0, pendencias: {} };
  for (const x of planilha) {
    if (x.lista === LISTAS.PRONTO) r.pronto++; else if (x.lista === LISTAS.CONFERIR) r.conferir++; else r.bloqueado++;
    if (x.classe.startsWith("Renault")) r.renault10++; else if (x.classe.startsWith("Demais")) r.demais5++; else r.revisao++;
    if (x.lista === LISTAS.PRONTO) { r.soma_atual += num(x.preco_atual); r.soma_promocional += num(x.preco_promocional); }
    for (const p of x.pendencias) {
      const chave = p.replace(/R\$ ?[\d.,]+/g, "R$ …").replace(/\d+[.,]?\d*%/g, "…%").slice(0, 120);
      r.pendencias[chave] = (r.pendencias[chave] || 0) + 1;
    }
  }
  r.soma_atual = Math.round(r.soma_atual * 100) / 100;
  r.soma_promocional = Math.round(r.soma_promocional * 100) / 100;
  r.pendencias = Object.entries(r.pendencias).sort((a, b) => b[1] - a[1]).map(([motivo, quantidade]) => ({ motivo, quantidade }));
  return r;
}
