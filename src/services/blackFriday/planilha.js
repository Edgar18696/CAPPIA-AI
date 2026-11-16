// =============================================================
// PAIIA — Black Friday 2026: PLANILHA para cadastro MANUAL das ofertas
// na Central de Promoções do Mercado Livre (16/11/2026).
//
// Só gera um arquivo a partir da simulação: NÃO altera preço, anúncio,
// estoque nem promoção. Uma conta por vez.
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
export const LISTAS = Object.freeze({ PRONTO: "PRONTO", CONFERIR: "CONFERIR", FORA: "FORA" });

/** Desconto real em % (2 casas), a partir dos preços em reais. */
export const descontoReal = (original, final) => (num(original) > 0 ? Math.floor(((num(original) - num(final)) / num(original)) * 10000 + 1e-6) / 100 : 0);

/**
 * Classifica uma linha da simulação para a planilha.
 * PRONTO = sem pendência; CONFERIR = qualquer dúvida; FORA = excluído pelo usuário.
 * A promoção que a API não deixa conferir (403) vira OBSERVAÇÃO, não pendência:
 * no cadastro manual, a própria Central de Promoções mostra as promoções do anúncio.
 */
export function classificarParaPlanilha(l) {
  if (l.situacao === SITUACOES.EXCLUIDO) return { lista: LISTAS.FORA, pendencias: ["excluído da campanha"], observacoes: [] };
  const pendencias = [];
  const observacoes = [];
  for (const b of l.bloqueios || []) pendencias.push(`Bloqueio: ${b}`);
  for (const m of l.motivos || []) {
    if (l.promocao === "nao_verificada" && m === l.promocao_texto) continue;
    pendencias.push(m);
  }
  for (const a of l.alertas || []) pendencias.push(`Atenção: ${a}`);
  if (l.classe === CLASSES.REVISAO && !l.decisao) pendencias.push("Dúvida de aplicação Renault (10% ou 5%).");
  // Elegibilidade do desconto individual.
  if (l.condicao && l.condicao !== "new") pendencias.push(`Elegibilidade: condição "${l.condicao}" — o desconto individual exige produto novo.`);
  if (!l.condicao) pendencias.push("Elegibilidade: condição do anúncio não lida (o desconto individual exige produto novo).");
  if (l.tipo_anuncio === "free") pendencias.push("Elegibilidade: anúncio grátis — o desconto individual exige exposição paga.");
  const real = descontoReal(l.preco_original, l.preco_final);
  if (!(l.preco_final > 0)) pendencias.push("Preço promocional não calculado.");
  else if (real < REGRAS_DESCONTO_INDIVIDUAL.minimoPct) pendencias.push(`Desconto real de ${String(real).replace(".", ",")}% abaixo do mínimo de 5% do ML.`);
  if (l.promocao === "nao_verificada") observacoes.push("Promoções programadas não puderam ser conferidas pela API: confira na tela do ML ao cadastrar.");
  // (16/11) Margem não verificada NÃO vai para PRONTO (regra do Edgar).
  if (l.custo_motivo || l.margem_pct === null || l.margem_pct === undefined) pendencias.push(`Margem não verificada${l.custo_motivo ? ` (custo: ${l.custo_motivo})` : ""}.`);
  return { lista: pendencias.length ? LISTAS.CONFERIR : LISTAS.PRONTO, pendencias, observacoes, desconto_real_pct: real };
}

const reais = (v) => (v === null || v === undefined || v === "" ? "" : num(v).toFixed(2).replace(".", ","));
const pct = (v) => String(num(v)).replace(".", ",");
const celula = (v) => { const t = txt(v).replace(/\r?\n/g, " "); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
const dataBR = (iso) => { const m = txt(iso).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; };

export const COLUNAS_PLANILHA = Object.freeze(["Lista", "Conta", "MLB", "SKU", "Título", "Classe", "Situação na simulação", "Preço atual (R$)", "Desconto (%)", "Preço promocional (R$)", "Desconto real (%)", "Início", "Fim", "Pendências", "Observações", "Link"]);

/** Linhas da planilha de UMA conta (ordem: PRONTO, CONFERIR, FORA). */
export function montarPlanilha(linhas, conta) {
  const ordem = { PRONTO: 0, CONFERIR: 1, FORA: 2 };
  return (linhas || [])
    .filter((l) => txt(l.conta) === txt(conta))
    .map((l) => ({ l, c: classificarParaPlanilha(l) }))
    .sort((a, b) => ordem[a.c.lista] - ordem[b.c.lista] || txt(a.l.titulo).localeCompare(txt(b.l.titulo), "pt-BR"))
    .map(({ l, c }) => ({
      lista: c.lista, conta: l.conta_nome, mlb: l.id, sku: l.sku || "", titulo: l.titulo,
      classe: l.classe === CLASSES.RENAULT ? "Renault comprovada" : l.classe === CLASSES.DEMAIS ? "Demais" : "Revisão",
      situacao: ROTULO_SITUACAO[l.situacao] || l.situacao || "",
      preco_atual: l.preco_original, desconto_pct: l.desconto_pct, preco_promocional: l.preco_final,
      desconto_real_pct: c.desconto_real_pct ?? descontoReal(l.preco_original, l.preco_final),
      inicio: dataBR(CAMPANHA_BF.inicio), fim: dataBR(CAMPANHA_BF.fim),
      pendencias: c.pendencias, observacoes: c.observacoes, link: l.link,
    }));
}

/** CSV para o Excel brasileiro (";" e vírgula decimal, com BOM). */
export function planilhaCSV(planilha) {
  const linhas = [COLUNAS_PLANILHA.join(";")];
  for (const r of planilha) {
    linhas.push([r.lista, r.conta, r.mlb, r.sku, r.titulo, r.classe, r.situacao, reais(r.preco_atual), pct(r.desconto_pct), reais(r.preco_promocional), pct(r.desconto_real_pct), r.inicio, r.fim, r.pendencias.join(" | "), r.observacoes.join(" | "), r.link].map(celula).join(";"));
  }
  return `\uFEFF${linhas.join("\r\n")}\r\n`;
}

/** Resumo para conferência: quantidades, descontos e pendências mais comuns. */
export function resumirPlanilha(planilha) {
  const r = { total: planilha.length, pronto: 0, conferir: 0, fora: 0, renault10: 0, demais5: 0, revisao: 0, soma_atual: 0, soma_promocional: 0, pendencias: {} };
  for (const x of planilha) {
    if (x.lista === LISTAS.PRONTO) r.pronto++; else if (x.lista === LISTAS.CONFERIR) r.conferir++; else r.fora++;
    if (x.classe === "Renault comprovada") r.renault10++; else if (x.classe === "Demais") r.demais5++; else r.revisao++;
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
