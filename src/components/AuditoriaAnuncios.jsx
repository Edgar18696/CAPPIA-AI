// =============================================================
// PAIIA — Central do Paizinho: AUDITORIA POR ANÚNCIO (18/11/2026).
// Uma linha por anúncio da conta analisada: preço, custo real do Bling, margem,
// visitas, vendas, fotos, compatibilidades e frete; ao abrir, o problema
// encontrado e a correção recomendada (+ palavras-chave quando pesquisadas).
// Só mostra: nada aqui altera anúncio, preço, estoque ou Bling.
// Custo ausente = "Custo não informado" (nunca zero, nunca inventado).
// =============================================================
import { useMemo, useState } from "react";
import EnviarParaPromocoes from "./EnviarParaPromocoes";
import { textoCusto, textoMargem, textoMargemEstimada, planilhaAuditoriaCSV } from "../services/paizinhoAuditoria/textosAnuncio";
import { textoUltimaCompra } from "../services/paizinhoAuditoria/ultimaCompra";
import { filtrarAnuncios, htmlRelatorioImpressao, FILTROS_AUDITORIA, ROTULO } from "../services/paizinhoAuditoria/relatorioImpressao";

const reais = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const num = (v) => (v === null || v === undefined ? "não lido" : Number(v).toLocaleString("pt-BR"));
const COR = { alta: "#f87171", media: "#fbbf24", baixa: "#60a5fa" };
const POR_PAGINA = 30;

export default function AuditoriaAnuncios({ rel }) {
  const [filtro, setFiltro] = useState("problemas");
  const [busca, setBusca] = useState("");
  const [abertos, setAbertos] = useState(() => new Set());
  const [mostrar, setMostrar] = useState(POR_PAGINA);
  const lista = useMemo(() => filtrarAnuncios(rel, filtro, busca), [rel, filtro, busca]);
  if (!rel.anuncios?.length) return null;
  const semCusto = rel.anuncios.filter((a) => !(Number(a.custo) > 0)).length;
  const abrir = (id) => setAbertos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <section style={S.caixa} data-paizinho-auditoria-anuncios>
      <h3 style={S.h3}>🔎 Auditoria por anúncio — o que está errado e como corrigir</h3>
      {/* (18/11) Ajuda recolhida; a contagem de "Custo não informado" continua visível. */}
      {semCusto ? <p style={{ ...S.ajuda, color: "#fbbf24" }}>{semCusto} anúncio(s) com "Custo não informado" no Bling.</p> : null}
      <details style={S.ajuda}>
        <summary style={{ cursor: "pointer" }}>Como ler esta lista</summary>
        Preço, custo real do Bling, margem, visitas, vendas, fotos, compatibilidades e frete de cada anúncio. Abra ▸ para ver o problema e a correção recomendada. Nada é alterado automaticamente.
      </details>
      <div style={S.acoes}>
        {FILTROS_AUDITORIA.map(([v, t]) => (
          <button key={v} type="button" style={filtro === v ? S.chipAtivo : S.chip} onClick={() => { setFiltro(v); setMostrar(POR_PAGINA); }}>{t}</button>
        ))}
        <input value={busca} onChange={(e) => { setBusca(e.target.value); setMostrar(POR_PAGINA); }} placeholder="Buscar MLB, SKU ou título" style={S.busca} aria-label="Buscar anúncio" />
        <span style={S.ajuda}>{lista.length} anúncio(s)</span>
        <button type="button" style={S.chip} onClick={() => exportar(rel)} title="Planilha com custos, margens, problemas e recomendações (abre no Excel)">📥 Exportar relatório</button>
        <button type="button" style={S.chip} onClick={() => imprimir(rel, filtro, busca)} title="Relatório A4 com TODOS os anúncios deste filtro, problemas, correções e espaço para observações">🖨️ Imprimir</button>
      </div>
      <style>{"@media (max-width: 760px){.pz-rot{display:block!important}.pz-cab{display:none!important}}"}</style>
      <div style={S.lista}>
        <div className="pz-cab" style={{ ...S.linha, ...S.cabeca }} aria-hidden="true">
          <span style={S.cAnuncio}>MLB · SKU / título</span><span style={S.cNum}>Preço</span><span style={S.cNum}>Custo (Bling)</span><span style={S.cNum}>Margem</span><span style={S.cMini}>Visitas</span><span style={S.cMini}>Vendas</span><span style={S.cMini}>Fotos</span><span style={S.cMini}>Compat.</span><span style={S.cNum}>Frete</span><span style={S.cProb}>Problema principal</span><span style={S.cAbrir} />
        </div>
        {lista.slice(0, mostrar).map((a) => {
          const p = a._p;
          const aberto = abertos.has(a.item_id);
          return (
            <div key={a.item_id} style={S.item} data-paizinho-anuncio={a.item_id}>
              <div style={S.linha}>
                <span style={S.cAnuncio}>
                  <span style={S.ident}><a href={a.link} target="_blank" rel="noreferrer" style={S.link}>{a.item_id}</a>{a.sku ? <small style={S.ajuda}> · {a.sku}</small> : null}</span>
                  <span style={S.titulo} title={a.titulo}>{a.titulo}</span>
                </span>
                <span style={S.cNum}><small className="pz-rot" style={S.rot}>Preço</small>{reais(a.preco)}</span>
                <span style={{ ...S.cNum, color: Number(a.custo) > 0 ? undefined : "#fbbf24" }}><small className="pz-rot" style={S.rot}>Custo (Bling)</small>{textoCusto(a)}{!(Number(a.custo) > 0) && a.ultima_compra?.valor > 0 && <small style={{ color: "#cbd5e1" }} title={`${a.ultima_compra.fonte} nº ${a.ultima_compra.pedido}`}>última compra {textoUltimaCompra(a.ultima_compra)}</small>}</span>
                <span style={{ ...S.cNum, color: a.margem_pct !== null && a.margem_pct < 0 ? COR.alta : a.margem_pct === null ? "#94a3b8" : undefined }}><small className="pz-rot" style={S.rot}>Margem</small>{a.margem_pct === null && a.margem_estimada_pct !== null && a.margem_estimada_pct !== undefined ? <span style={{ color: "#fbbf24" }} title="Estimativa pelo valor da última compra (não é a margem definitiva)">{textoMargemEstimada(a)}</span> : textoMargem(a)}</span>
                <span style={S.cMini}><small className="pz-rot" style={S.rot}>Visitas</small>{num(a.visitas30)}</span>
                <span style={S.cMini}><small className="pz-rot" style={S.rot}>Vendas</small>{num(a.vendas30)}</span>
                <span style={{ ...S.cMini, color: a.fotos !== null && a.fotos < 3 ? COR.media : undefined }}><small className="pz-rot" style={S.rot}>Fotos</small>{a.fotos ?? "—"}</span>
                <span style={{ ...S.cMini, color: a.compat === 0 ? COR.media : undefined }}><small className="pz-rot" style={S.rot}>Compat.</small>{a.compat === null || a.compat === undefined ? "—" : a.compat}</span>
                <span style={S.cNum}><small className="pz-rot" style={S.rot}>Frete</small>{a.frete_gratis ? (a.frete_vendedor === null || a.frete_vendedor === undefined ? "grátis (custo não lido)" : `grátis · ${reais(a.frete_vendedor)}`) : "comprador paga"}</span>
                <span style={S.cProb}>
                  {p.length
                    ? <><span style={{ ...S.selo, color: COR[p[0].severidade], borderColor: COR[p[0].severidade] }}>{ROTULO[p[0].severidade]}</span> <span style={S.prob} title={p.map((x) => x.problema).join("\n")}>{p[0].problema}{p.length > 1 ? ` (+${p.length - 1})` : ""}</span></>
                    : <span style={{ color: "#86efac" }}>✔ sem problema</span>}
                </span>
                <span style={S.cAbrir}><button type="button" style={S.abrir} onClick={() => abrir(a.item_id)} aria-expanded={aberto} aria-label={`Detalhes de ${a.item_id}`}>{aberto ? "▾" : "▸"}</button></span>
              </div>
              {aberto && <div style={S.detalhe}>
                {p.length ? <ol style={S.ol}>{p.map((x, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>
                    <span style={{ ...S.selo, color: COR[x.severidade], borderColor: COR[x.severidade] }}>{ROTULO[x.severidade]}</span> <strong>{x.problema}</strong>
                    <div style={S.corr}>👉 Como corrigir: {x.sugestao}</div>
                  </li>
                ))}</ol> : <p style={S.ajuda}>Nenhum problema encontrado nesta análise.</p>}
                <div style={S.ajuda}>
                  <strong>Título:</strong> {a.titulo}
                  {a.palavras?.length ? <><br /><strong>Palavras-chave sugeridas (concorrência):</strong> {a.palavras.join(", ")}</> : <><br /><small>Palavras-chave: só aparecem quando a pesquisa de concorrência é usada na análise.</small></>}
                  {a.lucro !== null && a.lucro !== undefined && <><br /><strong>Lucro por venda:</strong> {reais(a.lucro)}{a.margem_com_imposto === false ? " (antes do imposto: cadastre o imposto em Preços, Custos e Lucro)" : ""}</>}
                  <br /><strong>Custo cadastrado no Bling:</strong> {Number(a.custo) > 0 ? textoCusto(a) : <span style={{ color: "#fbbf24" }}>Custo não informado{a.custo_motivo ? ` (${a.custo_motivo})` : ""}</span>}
                  {!(Number(a.custo) > 0) && (a.ultima_compra?.valor > 0
                    ? <><br /><strong>Última compra encontrada:</strong> R$ {a.ultima_compra.valor.toFixed(2).replace(".", ",")} · <strong>Data:</strong> {textoUltimaCompra(a.ultima_compra).split(" em ")[1]} · <strong>Fonte:</strong> {a.ultima_compra.fonte} nº {a.ultima_compra.pedido}{a.ultima_compra.quantidade ? ` (${a.ultima_compra.quantidade} un.)` : ""}
                      {a.margem_estimada_pct !== null && a.margem_estimada_pct !== undefined && <><br /><span style={{ color: "#fbbf24" }}><strong>Margem estimada:</strong> {textoMargemEstimada(a)} — referência: última compra; não é a margem definitiva.</span></>}
                      <br /><small>Cadastre esse custo no fornecedor padrão do Bling para a margem passar a ser definitiva.</small></>
                    : <><br /><span style={{ color: "#fbbf24" }}>Sem compra atendida encontrada no Bling: cadastre o custo do fornecedor no Bling para calcular a margem.</span></>)}
                </div>
                <div style={S.acoes}><EnviarParaPromocoes conta={a.vendedor_id || rel.conta} anuncio={a} /></div>
              </div>}
            </div>
          );
        })}
      </div>
      {lista.length > mostrar && <button type="button" style={S.chip} onClick={() => setMostrar(mostrar + POR_PAGINA)}>Mostrar mais ({lista.length - mostrar})</button>}
    </section>
  );
}

// (18/11) Imprime o relatório A4 próprio (fundo branco) com todos os anúncios do filtro.
// Usa um quadro invisível: não abre janela nova e não muda nada na tela nem nos dados.
function imprimir(rel, filtro, busca) {
  try {
    const q = document.createElement("iframe");
    q.setAttribute("aria-hidden", "true");
    q.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    q.onload = () => { setTimeout(() => { try { q.contentWindow.focus(); q.contentWindow.print(); } finally { setTimeout(() => q.remove(), 60000); } }, 50); };
    q.srcdoc = htmlRelatorioImpressao(rel, { filtro, busca });
    document.body.appendChild(q);
  } catch (e) { window.alert(`Não foi possível montar a impressão: ${e?.message || e}`); }
}

// (18/11) Exporta a auditoria completa (abre no Excel). Só gera arquivo; nada é alterado.
function exportar(rel) {
  try {
    const url = URL.createObjectURL(new Blob([planilhaAuditoriaCSV(rel)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    const nome = String(rel.conta?.nome || "conta").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
    a.href = url; a.download = `auditoria-${nome}-${String(rel.gerado_em || "").slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (e) { window.alert(`Não foi possível gerar o arquivo: ${e?.message || e}`); }
}

const S = {
  caixa: { marginTop: 14 },
  h3: { margin: "18px 0 6px", color: "#f8fafc" },
  ajuda: { color: "#94a3b8", fontSize: 13 },
  acoes: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "8px 0" },
  chip: { border: "1px solid #475569", borderRadius: 999, background: "#0f172a", color: "#e2e8f0", padding: "5px 11px", fontWeight: 700, cursor: "pointer", fontSize: 13 },
  chipAtivo: { border: "1px solid #67e8f9", borderRadius: 999, background: "rgba(8,145,178,.24)", color: "#cffafe", padding: "5px 11px", fontWeight: 700, cursor: "pointer", fontSize: 13 },
  busca: { flex: "1 1 180px", border: "1px solid #475569", borderRadius: 10, background: "#020617", color: "#f8fafc", padding: "7px 10px", font: "inherit" },
  lista: { border: "1px solid #1e293b", borderRadius: 12, overflow: "hidden", textAlign: "left" },
  item: { borderBottom: "1px solid #1e293b" },
  linha: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 10px", padding: "6px 10px", fontSize: 13, color: "#e2e8f0" },
  cabeca: { background: "#0b1324", color: "#94a3b8", fontSize: 12, fontWeight: 700 },
  cAnuncio: { flex: "3 1 220px", minWidth: 0, display: "flex", flexDirection: "column" },
  ident: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  titulo: { color: "#cbd5e1", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" },
  cNum: { flex: "0 0 96px", display: "flex", flexDirection: "column" },
  cMini: { flex: "0 0 56px", display: "flex", flexDirection: "column" },
  cProb: { flex: "2 1 200px", minWidth: 0, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 },
  prob: { color: "#cbd5e1", fontSize: 12, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", flexBasis: "100%" },
  cAbrir: { flex: "0 0 26px", textAlign: "right" },
  abrir: { border: "1px solid #475569", borderRadius: 6, background: "#0f172a", color: "#e2e8f0", width: 24, height: 24, cursor: "pointer", padding: 0 },
  rot: { display: "none", color: "#94a3b8", fontSize: 11 },
  selo: { border: "1px solid", borderRadius: 999, padding: "1px 8px", fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" },
  detalhe: { padding: "6px 12px 12px 22px", background: "rgba(15,23,42,.6)" },
  ol: { margin: "4px 0 8px", paddingLeft: 18, color: "#e2e8f0", fontSize: 13 },
  corr: { color: "#86efac", marginTop: 2 },
  link: { color: "#67e8f9" },
};
