// =============================================================
// PAIIA — Central do Paizinho: janela "Regras do Mercado Livre — Anúncios".
// SOMENTE CONSULTA: mostra as regras oficiais (fonte e data), o risco e as
// recomendações. Não lê nem altera anúncios. A detecção nas 3 contas fica
// "aguardando autorização" até o dono liberar a leitura.
// =============================================================
import { REGRAS, LACUNAS, NIVEIS_RISCO, RECOMENDACOES, SINAIS_MESMO_PRODUTO, ETAPAS, CONTAS_REGRAS, DATA_ACESSO } from "../services/regrasML/catalogoRegras";

export default function RegrasMLAnuncios({ aoFechar }) {
  return (
    <section id="regras-ml-anuncios" style={S.janela} aria-label="Regras do Mercado Livre — Anúncios">
      <div style={S.topo}>
        <div>
          <h2 style={S.titulo}>📜 Regras do Mercado Livre — Anúncios</h2>
          <p style={S.sub}>Mesmo produto anunciado nas contas {CONTAS_REGRAS.map((c) => c.nome).join(", ")}. Fontes oficiais do Mercado Livre, acessadas em {DATA_ACESSO}.</p>
        </div>
        {aoFechar && <button type="button" onClick={aoFechar} style={S.fechar}>Fechar</button>}
      </div>

      <div style={S.trava}>🔒 Somente consulta. Nenhum anúncio é lido, alterado, pausado ou encerrado por esta janela. Qualquer ação depende da sua autorização, item por item.</div>

      <h3 style={S.h3}>Situação</h3>
      <ul style={S.lista}>{ETAPAS.map((e) => <li key={e.etapa}><strong>{e.etapa}:</strong> <span style={e.situacao === "pronto" ? S.ok : S.pendente}>{e.situacao}</span></li>)}</ul>

      <h3 style={S.h3}>Regras oficiais</h3>
      <div style={S.grade}>{REGRAS.map((r) => (
        <article key={r.id} style={S.regra}>
          <strong>{r.id} · {r.titulo}</strong>
          {r.tipo === "interpretacao" && <span style={S.etiqueta}>interpretação</span>}
          <p style={S.texto}>{r.resumo}</p>
          <div style={S.fontes}>{r.fontes.map(([nome, url]) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" style={S.link}>{nome} ↗</a>)}</div>
        </article>
      ))}</div>

      <h3 style={S.h3}>O que as fontes oficiais não esclarecem</h3>
      <ul style={S.lista}>{LACUNAS.map((l) => <li key={l}>{l}</li>)}</ul>
      <p style={S.nota}>Até haver resposta oficial do suporte do ML, esses casos são tratados como risco, nunca como permitidos.</p>

      <h3 style={S.h3}>Como o mesmo produto será reconhecido</h3>
      <ol style={S.lista}>{SINAIS_MESMO_PRODUTO.map((s) => <li key={s}>{s}</li>)}</ol>

      <h3 style={S.h3}>Níveis de risco</h3>
      <div style={S.grade}>{NIVEIS_RISCO.map((n) => (
        <article key={n.nivel} style={{ ...S.regra, borderColor: n.cor }}>
          <strong style={{ color: n.cor }}>{n.nivel}</strong>
          <p style={S.texto}>{n.criterio}</p>
          <small style={S.base}>Base: {n.base}</small>
        </article>
      ))}</div>

      <h3 style={S.h3}>Recomendações (sempre pendentes da sua autorização)</h3>
      <div style={S.grade}>{RECOMENDACOES.map((r) => (
        <article key={r.acao} style={S.regra}>
          <strong>{r.acao}</strong>
          <p style={S.texto}>{r.texto}</p>
          <small style={S.base}>Base: {r.base}</small>
        </article>
      ))}</div>
    </section>
  );
}

const S = {
  janela: { scrollMarginTop: 18, marginTop: 22, padding: "clamp(17px,3vw,28px)", border: "1px solid #155e75", borderRadius: 18, background: "linear-gradient(145deg,#071326,#0f172a)", color: "#e2e8f0", textAlign: "left" },
  topo: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" },
  titulo: { margin: 0, color: "#67e8f9" },
  sub: { margin: "6px 0 0", color: "#cbd5e1" },
  fechar: { border: "1px solid #64748b", borderRadius: 10, background: "#0f172a", color: "#e2e8f0", padding: "9px 14px", fontWeight: 800, cursor: "pointer" },
  trava: { marginTop: 14, padding: 12, border: "1px solid #16a34a", borderRadius: 10, background: "rgba(22,163,74,.1)", color: "#dcfce7" },
  h3: { margin: "22px 0 10px", color: "#f8fafc" },
  lista: { margin: 0, paddingLeft: 20, lineHeight: 1.7, color: "#cbd5e1" },
  ok: { color: "#4ade80", fontWeight: 700 },
  pendente: { color: "#fbbf24", fontWeight: 700 },
  grade: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: 12 },
  regra: { display: "flex", flexDirection: "column", gap: 6, padding: 15, border: "1px solid #334155", borderRadius: 13, background: "#020617", lineHeight: 1.45 },
  etiqueta: { alignSelf: "flex-start", fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(251,191,36,.15)", color: "#fde68a" },
  texto: { margin: 0, color: "#cbd5e1" },
  fontes: { display: "flex", flexDirection: "column", gap: 3, marginTop: "auto" },
  link: { color: "#67e8f9", fontSize: 13, wordBreak: "break-word" },
  base: { color: "#94a3b8" },
  nota: { color: "#94a3b8", marginTop: 8 },
};
