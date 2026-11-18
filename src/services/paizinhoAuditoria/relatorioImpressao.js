// =============================================================
// PAIIA — Central do Paizinho: RELATÓRIO DE IMPRESSÃO da Auditoria por Anúncio (18/11/2026).
// Documento A4 próprio (fundo branco, letras escuras) para entregar a um funcionário:
// todos os anúncios do filtro escolhido, título completo, custos, margem, frete,
// TODOS os problemas com a correção e espaço para observações.
// Só gera texto/HTML: nada aqui altera anúncio, preço, custo, estoque, Bling ou ML.
// =============================================================
import { CONTAS_AUDITORIA } from "./contas.js";
import { textoCusto, textoMargem, textoMargemEstimada } from "./textosAnuncio.js";
import { textoUltimaCompra } from "./ultimaCompra.js";

export const EMPRESA = "Casa da Injeção Brasil";

export const FILTROS_AUDITORIA = Object.freeze([
  ["problemas", "Com problema"], ["urgentes", "Só urgentes"], ["sem_custo", "Custo não informado"], ["todos", "Todos"],
]);
export const PESO = Object.freeze({ alta: 3, media: 2, baixa: 1 });
export const ROTULO = Object.freeze({ alta: "Urgente", media: "Importante", baixa: "Acompanhar" });

export const problemasDo = (a) => (a.achados || []).filter((x) => !x.positivo).sort((x, y) => (PESO[y.severidade] || 0) - (PESO[x.severidade] || 0));

/** Mesma lista da tela (filtro + busca + ordem), SEM o limite de 30 por página. */
export function filtrarAnuncios(rel, filtro = "problemas", busca = "") {
  const b = String(busca || "").trim().toUpperCase();
  return (rel?.anuncios || [])
    .map((a) => ({ ...a, _p: problemasDo(a) }))
    .filter((a) => (filtro === "todos" || (filtro === "problemas" ? a._p.length : filtro === "sem_custo" ? !(Number(a.custo) > 0) : a._p.some((x) => x.severidade === "alta"))))
    .filter((a) => !b || [a.item_id, a.sku, a.titulo].some((t) => String(t || "").toUpperCase().includes(b)))
    .sort((x, y) => (PESO[y._p[0]?.severidade] || 0) - (PESO[x._p[0]?.severidade] || 0) || y._p.length - x._p.length || (y.vendas30 || 0) - (x.vendas30 || 0));
}

/** Nome da conta Mercado Livre DO ANÚNCIO (LOJA ONLINE, REVELAÇÃO ou CIEBR). */
export function contaDoAnuncio(a, rel) {
  const id = String(a?.vendedor_id || rel?.conta?.id || "");
  return CONTAS_AUDITORIA.find((c) => c.id === id)?.nome || rel?.conta?.nome || (id ? `Conta ${id}` : "Conta não identificada");
}

const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const reais = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const num = (v) => (v === null || v === undefined ? "não lido" : Number(v).toLocaleString("pt-BR"));
const dataHora = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export function textoFrete(a) {
  if (!a?.frete_gratis) return "Comprador paga";
  return a.frete_vendedor === null || a.frete_vendedor === undefined ? "Grátis (custo não lido)" : `Grátis — vendedor paga ${reais(a.frete_vendedor)}`;
}

function blocoAnuncio(a, rel, n) {
  const p = a._p || problemasDo(a);
  const temCusto = Number(a.custo) > 0;
  const uc = a.ultima_compra?.valor > 0 ? a.ultima_compra : null;
  const custoCad = temCusto ? textoCusto(a) : `Custo não informado${a.custo_motivo ? ` (${a.custo_motivo})` : ""}`;
  const ultima = uc ? `${textoUltimaCompra(uc)}<br><small>${esc(uc.fonte)} nº ${esc(uc.pedido)}${uc.quantidade ? ` · ${esc(uc.quantidade)} un.` : ""}</small>` : (temCusto ? "Não consultada (há custo cadastrado)" : "Nenhuma compra atendida encontrada");
  const margem = a.margem_pct !== null && a.margem_pct !== undefined
    ? esc(textoMargem(a))
    : a.margem_estimada_pct !== null && a.margem_estimada_pct !== undefined
      ? `${esc(textoMargemEstimada(a))}<br><small>pela última compra — não é a margem definitiva</small>`
      : "Margem não calculada";
  const problemas = p.length
    ? `<ol class="probs">${p.map((x) => `<li><span class="sev sev-${esc(x.severidade)}">${esc(ROTULO[x.severidade] || x.severidade)}</span> <strong>${esc(x.problema)}</strong><div class="corr">Como corrigir: ${esc(x.sugestao)}</div></li>`).join("")}</ol>`
    : `<p class="ok">Nenhum problema encontrado nesta análise.</p>`;
  return `<section class="anuncio">
<div class="topo"><span class="n">${n}</span><span class="conta">${esc(contaDoAnuncio(a, rel))}</span><span class="mlb">${esc(a.item_id)}</span><span class="sku">SKU: ${esc(a.sku || "—")}</span></div>
<div class="titulo">${esc(a.titulo || "")}</div>
<table class="dados"><tr><th>Preço</th><th>Custo cadastrado no Bling</th><th>Custo da última compra</th><th>Margem</th><th>Frete</th></tr>
<tr><td>${esc(reais(a.preco))}</td><td${temCusto ? "" : ' class="alerta"'}>${esc(custoCad)}</td><td>${ultima}</td><td>${margem}</td><td>${esc(textoFrete(a))}</td></tr></table>
<table class="dados"><tr><th>Visitas (30 dias)</th><th>Vendas (30 dias)</th><th>Fotos</th><th>Compatibilidades</th></tr>
<tr><td>${esc(num(a.visitas30))}</td><td>${esc(num(a.vendas30))}</td><td>${esc(a.fotos ?? "—")}</td><td>${esc(a.compat ?? "—")}</td></tr></table>
<div class="rot">Problemas encontrados e correção recomendada (${p.length})</div>
${problemas}
${a.link ? `<div class="link">Link: ${esc(a.link)}</div>` : ""}
<div class="obs"><div class="rot">Observações do funcionário</div><div class="linha"></div><div class="linha"></div><div class="linha"></div><div class="assina">Conferido por: ____________________________ &nbsp; Data: ____/____/______</div></div>
</section>`;
}

const CSS = `@page{size:A4 portrait;margin:12mm 11mm 14mm}
*{box-sizing:border-box}html,body{background:#fff;color:#111;margin:0}
body{font:10.5pt/1.35 Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.cab{border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:8px}
.cab h1{font-size:15pt;margin:0}.cab h2{font-size:11.5pt;margin:2px 0 4px;font-weight:normal}
.meta{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:9.5pt}.meta b{font-weight:700}
.resumo{font-size:9.5pt;margin:4px 0 0}.aviso{font-size:8.5pt;color:#444;margin-top:4px}
.anuncio{border:1px solid #888;border-radius:4px;padding:6px 8px;margin:0 0 8px;break-inside:avoid;page-break-inside:avoid}
.topo{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline;font-size:10pt}
.n{font-weight:700}.conta{border:1px solid #111;border-radius:3px;padding:0 5px;font-weight:700;font-size:9pt}
.mlb{font-weight:700}.titulo{font-weight:700;margin:3px 0 4px;word-break:break-word}
table.dados{width:100%;border-collapse:collapse;margin:2px 0;table-layout:fixed}
.dados th,.dados td{border:1px solid #bbb;padding:2px 4px;text-align:left;vertical-align:top;word-break:break-word}
.dados th{background:#eee;font-size:8.5pt}.dados td{font-size:9.5pt}.alerta{font-weight:700}
.rot{font-weight:700;font-size:9.5pt;margin-top:4px}
.probs{margin:2px 0 2px;padding-left:18px}.probs li{margin-bottom:3px}.corr{margin-left:2px}
.sev{border:1px solid #111;border-radius:8px;padding:0 5px;font-size:8pt;font-weight:700}.sev-alta{background:#fde2e2}.sev-media{background:#fff2cc}.sev-baixa{background:#e3eefc}
.ok{margin:2px 0}.link{font-size:8.5pt;color:#333;word-break:break-all}
.obs{margin-top:4px}.obs .linha{border-bottom:1px solid #999;height:18px}.assina{font-size:9pt;margin-top:6px}
.rodape{font-size:8.5pt;color:#444;border-top:1px solid #999;padding-top:4px;margin-top:6px}
@media screen{body{max-width:190mm;margin:10px auto;padding:0 8px}}`;

/**
 * Documento HTML completo (A4) do relatório impresso.
 * @param {object} rel relatório da auditoria
 * @param {{filtro?:string,busca?:string,agora?:string|Date}} op filtro e busca da tela
 */
export function htmlRelatorioImpressao(rel, { filtro = "problemas", busca = "", agora = new Date() } = {}) {
  const lista = filtrarAnuncios(rel, filtro, busca);
  const nomeFiltro = (FILTROS_AUDITORIA.find(([v]) => v === filtro) || [])[1] || filtro;
  const contas = [...new Set(lista.map((a) => contaDoAnuncio(a, rel)))];
  const contaCab = contas.length ? contas.join(", ") : (rel?.conta?.nome || "—");
  const total = rel?.anuncios?.length || 0;
  const urg = lista.filter((a) => a._p.some((x) => x.severidade === "alta")).length;
  const semCusto = lista.filter((a) => !(Number(a.custo) > 0)).length;
  const corpo = lista.length ? lista.map((a, i) => blocoAnuncio(a, rel, i + 1)).join("\n") : `<p>Nenhum anúncio neste filtro.</p>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Auditoria ${esc(contaCab)} ${esc(String(rel?.gerado_em || "").slice(0, 10))}</title><style>${CSS}</style></head><body>
<header class="cab"><h1>${esc(EMPRESA)}</h1><h2>Auditoria de anúncios — Mercado Livre</h2>
<div class="meta"><span><b>Conta Mercado Livre:</b> ${esc(contaCab)}</span><span><b>Data da auditoria:</b> ${esc(dataHora(rel?.gerado_em))}</span><span><b>Impresso em:</b> ${esc(dataHora(agora))}</span><span><b>Filtro:</b> ${esc(nomeFiltro)}${busca ? ` · busca "${esc(busca)}"` : ""}</span></div>
<p class="resumo"><b>${lista.length}</b> anúncio(s) neste relatório (de ${total} analisados) · <b>${urg}</b> com problema urgente · <b>${semCusto}</b> com custo não informado no Bling.</p>
<p class="aviso">Custo cadastrado = fornecedor padrão no Bling. Custo da última compra = pedido de compra atendido no Bling; serve só como referência (margem estimada, não definitiva). Margem "antes do imposto" quando o imposto não está cadastrado.</p></header>
${corpo}
<footer class="rodape">Relatório gerado pelo PAIIA — somente leitura: nenhum anúncio, preço, custo ou estoque foi alterado. Anote as correções no espaço de observações e devolva ao responsável.</footer>
</body></html>`;
}
