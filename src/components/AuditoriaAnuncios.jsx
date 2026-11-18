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
import { textoCusto, textoMargem } from "../services/paizinhoAuditoria/textosAnuncio";

const reais = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const num = (v) => (v === null || v === undefined ? "não lido" : Number(v).toLocaleString("pt-BR"));
const COR = { alta: "#f87171", media: "#fbbf24", baixa: "#60a5fa" };
const PESO = { alta: 3, media: 2, baixa: 1 };
const ROTULO = { alta: "Urgente", media: "Importante", baixa: "Acompanhar" };
const POR_PAGINA = 30;

const problemasDo = (a) => (a.achados || []).filter((x) => !x.positivo).sort((x, y) => (PESO[y.severidade] || 0) - (PESO[x.severidade] || 0));

export default function AuditoriaAnuncios({ rel }) {
  const [filtro, setFiltro] = useState("problemas");
  const [busca, setBusca] = useState("");
  const [abertos, setAbertos] = useState(() => new Set());
  const [mostrar, setMostrar] = useState(POR_PAGINA);
  const lista = useMemo(() => {
    const b = busca.trim().toUpperCase();
    return (rel.anuncios || [])
      .map((a) => ({ ...a, _p: problemasDo(a) }))
      .filter((a) => (filtro === "todos" || (filtro === "problemas" ? a._p.length : filtro === "sem_custo" ? !(Number(a.custo) > 0) : a._p.some((x) => x.severidade === "alta"))))
      .filter((a) => !b || [a.item_id, a.sku, a.titulo].some((t) => String(t || "").toUpperCase().includes(b)))
      .sort((x, y) => (PESO[y._p[0]?.severidade] || 0) - (PESO[x._p[0]?.severidade] || 0) || y._p.length - x._p.length || (y.vendas30 || 0) - (x.vendas30 || 0));
  }, [rel, filtro, busca]);
  if (!rel.anuncios?.length) return null;
  const semCusto = rel.anuncios.filter((a) => !(Number(a.custo) > 0)).length;
  const abrir = (id) => setAbertos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <section style={S.caixa} data-paizinho-auditoria-anuncios>
      <h3 style={S.h3}>🔎 Auditoria por anúncio — o que está errado e como corrigir</h3>
      <p style={S.ajuda}>Preço, custo real do Bling, margem, visitas, vendas, fotos, compatibilidades e frete de cada anúncio. Abra ▸ para ver o problema e a correção recomendada. Nada é alterado automaticamente.{semCusto ? ` ${semCusto} anúncio(s) com "Custo não informado" no Bling.` : ""}</p>
      <div style={S.acoes}>
        {[["problemas", "Com problema"], ["urgentes", "Só urgentes"], ["sem_custo", "Custo não informado"], ["todos", "Todos"]].map(([v, t]) => (
          <button key={v} type="button" style={filtro === v ? S.chipAtivo : S.chip} onClick={() => { setFiltro(v); setMostrar(POR_PAGINA); }}>{t}</button>
        ))}
        <input value={busca} onChange={(e) => { setBusca(e.target.value); setMostrar(POR_PAGINA); }} placeholder="Buscar MLB, SKU ou título" style={S.busca} aria-label="Buscar anúncio" />
        <span style={S.ajuda}>{lista.length} anúncio(s)</span>
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
                <span style={{ ...S.cNum, color: Number(a.custo) > 0 ? undefined : "#fbbf24" }}><small className="pz-rot" style={S.rot}>Custo (Bling)</small>{textoCusto(a)}</span>
                <span style={{ ...S.cNum, color: a.margem_pct !== null && a.margem_pct < 0 ? COR.alta : a.margem_pct === null ? "#94a3b8" : undefined }}><small className="pz-rot" style={S.rot}>Margem</small>{textoMargem(a)}</span>
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
                  {!(Number(a.custo) > 0) && <><br /><span style={{ color: "#fbbf24" }}>Custo não informado no Bling{a.custo_motivo ? ` (${a.custo_motivo})` : ""}: cadastre o custo do fornecedor no Bling para calcular a margem.</span></>}
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
