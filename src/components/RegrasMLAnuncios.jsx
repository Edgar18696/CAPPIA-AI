// =============================================================
// PAIIA — Central do Paizinho: janela "Regras do Mercado Livre — Anúncios".
// SOMENTE CONSULTA: mostra as regras oficiais (fonte e data), o risco e as
// recomendações. Não lê nem altera anúncios. A detecção nas 3 contas fica
// "aguardando autorização" até o dono liberar a leitura.
// =============================================================
import { useMemo, useState } from "react";
import { REGRAS, LACUNAS, NIVEIS_RISCO, RECOMENDACOES, SINAIS_MESMO_PRODUTO, ETAPAS, CONTAS_REGRAS, DATA_ACESSO } from "../services/regrasML/catalogoRegras";
import { lerTresContas, montarCruzamento } from "../services/regrasML/leituraContas";

const LOCAL = import.meta.env.DEV === true;
const TIPO = { gold_pro: "Premium", gold_special: "Clássico", free: "Grátis" };
const ENVIO = { fulfillment: "Full", xd_drop_off: "Agência", cross_docking: "Coleta", self_service: "Flex", drop_off: "Correios", me1: "ME1", custom: "Próprio", not_specified: "—" };
const NIVEL = { alto: ["Alto", "#f87171"], medio: ["Médio", "#fbbf24"], baixo: ["Baixo", "#4ade80"] };
const real = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function CruzamentoContas() {
  const [versao, setVersao] = useState(0);
  const [lendo, setLendo] = useState("");
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("alto");
  const [busca, setBusca] = useState("");
  const [mostrar, setMostrar] = useState(30);
  const cruz = useMemo(() => montarCruzamento(), [versao]); // eslint-disable-line react-hooks/exhaustive-deps

  async function ler() {
    setErro(""); setLendo("Começando…");
    try { await lerTresContas({ aoProgredir: setLendo }); setVersao((v) => v + 1); } catch (e) { setErro(String(e?.message || e)); }
    setLendo("");
  }

  const grupos = useMemo(() => {
    if (!cruz) return [];
    const b = busca.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    return cruz.grupos.filter((g) =>
      (filtro === "todos" || (filtro === "na_conta" ? g.duplicado_na_conta : g.risco === filtro)) &&
      (!b || g.anuncios.some((a) => a.id.includes(b) || a.skus.some((s) => s.includes(b)) || a.titulo.toUpperCase().includes(busca.trim().toUpperCase()))));
  }, [cruz, filtro, busca]);

  return (
    <section style={S.cruz}>
      <h3 style={{ ...S.h3, marginTop: 0 }}>Cruzamento das 3 contas (somente leitura)</h3>
      {LOCAL && <div style={S.acoes}><button type="button" onClick={ler} disabled={!!lendo} style={S.botao}>{lendo ? `🔄 ${lendo}` : cruz ? "Ler as 3 contas de novo" : "Ler as 3 contas agora"}</button><small style={S.base}>Só consultas GET no Mercado Livre. Nada é alterado. Leva cerca de 7 minutos.</small></div>}
      {erro && <div style={S.aviso}>{erro}</div>}
      {!cruz ? <p style={S.nota}>Ainda não há leitura neste computador.</p> : <>
        <p style={S.nota}>Leitura de {new Date(cruz.lido_em).toLocaleString("pt-BR")} · {Object.entries(cruz.anuncios_lidos).map(([n, q]) => `${n}: ${q}`).join(" · ")} anúncios ativos{cruz.falhas.length ? ` · ${cruz.falhas.length} não lidos` : " · nenhuma falha"}.</p>
        <div style={S.kpis}>
          <Kpi rotulo="Produtos em mais de uma conta" valor={cruz.grupos_entre_contas} />
          <Kpi rotulo="Risco alto" valor={cruz.por_risco.alto} cor="#f87171" />
          <Kpi rotulo="Risco médio" valor={cruz.por_risco.medio} cor="#fbbf24" />
          <Kpi rotulo="Risco baixo" valor={cruz.por_risco.baixo} cor="#4ade80" />
          <Kpi rotulo="Repetidos na mesma conta (mesmo envio e tipo)" valor={cruz.grupos_duplicado_na_conta} cor="#f87171" />
        </div>
        <p style={S.nota}>Vendas = total vendido desde a criação do anúncio (dado do ML). Visitas de 30 dias só da LOJA ONLINE por enquanto: ler as outras contas depende de autorização para publicar a função de leitura ampliada. Toda recomendação é sugestão, pendente da sua autorização.</p>
        <div style={S.acoes}>
          {[["alto", "Risco alto"], ["medio", "Risco médio"], ["baixo", "Risco baixo"], ["na_conta", "Repetido na mesma conta"], ["todos", "Todos"]].map(([k, t]) => <button key={k} type="button" onClick={() => { setFiltro(k); setMostrar(30); }} style={{ ...S.filtro, ...(filtro === k ? S.filtroAtivo : {}) }}>{t}</button>)}
          <input value={busca} onChange={(e) => { setBusca(e.target.value); setMostrar(30); }} placeholder="Buscar SKU, MLB ou título" style={S.busca} />
        </div>
        <p style={S.base}>{grupos.length} produto(s)</p>
        {grupos.slice(0, mostrar).map((g, i) => <Grupo key={g.anuncios.map((a) => a.id).join("-")} g={g} n={i + 1} />)}
        {grupos.length > mostrar && <button type="button" onClick={() => setMostrar(mostrar + 30)} style={S.filtro}>Mostrar mais ({grupos.length - mostrar} restantes)</button>}
      </>}
    </section>
  );
}

function Kpi({ rotulo, valor, cor }) {
  return <div style={S.kpi}><strong style={{ fontSize: 22, color: cor || "#f8fafc" }}>{valor}</strong><small style={S.base}>{rotulo}</small></div>;
}

function Grupo({ g, n }) {
  const [nome, cor] = NIVEL[g.risco];
  return (
    <article style={{ ...S.grupo, borderColor: cor }}>
      <div style={S.grupoTopo}><strong>{n}. {g.titulo}</strong><span style={{ ...S.selo, color: cor, borderColor: cor }}>Risco {nome}</span></div>
      <small style={S.base}>Contas: {g.contas.join(", ")} · Mesmo produto por: {g.sinais.join(", ")} · Motivo do risco: {g.motivos_risco.join(", ")} ({g.regras_risco.join(", ")})</small>
      <div style={S.tabelaCaixa}><table style={S.tabela}><thead><tr><th style={S.th}>Conta</th><th style={S.th}>Anúncio</th><th style={S.th}>SKU</th><th style={S.th}>Tipo</th><th style={S.th}>Envio</th><th style={S.th}>Preço</th><th style={S.th}>Vendas (total)</th><th style={S.th}>Visitas 30d</th></tr></thead>
        <tbody>{g.anuncios.map((a) => <tr key={a.id} style={a.id === g.manter_sugerido ? S.manter : undefined}>
          <td style={S.td}>{a.conta}</td>
          <td style={S.td}><a href={a.link} target="_blank" rel="noopener noreferrer" style={S.link}>{a.id}</a>{a.id === g.manter_sugerido && <span style={S.base}> · melhor desempenho</span>}</td>
          <td style={S.td}>{a.skus.join(", ") || "—"}</td>
          <td style={S.td}>{TIPO[a.tipo] || a.tipo}</td>
          <td style={S.td}>{ENVIO[a.envio] || a.envio}{a.frete_gratis ? " · grátis" : ""}</td>
          <td style={S.td}>{real(a.preco)}</td>
          <td style={S.td}>{a.vendidos_total ?? "—"}</td>
          <td style={S.td}>{a.visitas30 ?? "—"}</td>
        </tr>)}</tbody></table></div>
      <p style={S.texto}><strong>{g.recomendacao.acao[0].toUpperCase() + g.recomendacao.acao.slice(1)}:</strong> {g.recomendacao.texto} <span style={S.base}>({g.recomendacao.regras.join(", ")} · {g.recomendacao.situacao})</span></p>
    </article>
  );
}

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

      <div style={S.trava}>🔒 Somente leitura. Esta janela só faz consultas (GET) no Mercado Livre: nenhum anúncio é alterado, pausado ou encerrado. Qualquer ação depende da sua autorização, item por item.</div>

      <CruzamentoContas />

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
  cruz: { marginTop: 18, padding: 16, border: "1px solid #334155", borderRadius: 14, background: "#020617" },
  acoes: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "10px 0" },
  botao: { border: "1px solid #22d3ee", borderRadius: 11, background: "linear-gradient(135deg,#0369a1,#0891b2)", color: "white", padding: "10px 15px", fontWeight: 900, cursor: "pointer" },
  aviso: { padding: 12, border: "1px solid #f59e0b", borderRadius: 10, background: "rgba(245,158,11,.1)", color: "#fde68a" },
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,150px),1fr))", gap: 10, margin: "10px 0" },
  kpi: { display: "flex", flexDirection: "column", gap: 4, padding: 12, border: "1px solid #334155", borderRadius: 12, background: "#0f172a" },
  filtro: { border: "1px solid #475569", borderRadius: 999, background: "#0f172a", color: "#e2e8f0", padding: "7px 12px", fontWeight: 700, cursor: "pointer" },
  filtroAtivo: { borderColor: "#67e8f9", background: "rgba(8,145,178,.24)", color: "#cffafe" },
  busca: { flex: "1 1 200px", border: "1px solid #475569", borderRadius: 10, background: "#020617", color: "#f8fafc", padding: "8px 11px", font: "inherit" },
  grupo: { display: "flex", flexDirection: "column", gap: 6, marginTop: 10, padding: 13, border: "1px solid #334155", borderRadius: 12, background: "#0f172a" },
  grupoTopo: { display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  selo: { border: "1px solid", borderRadius: 999, padding: "1px 9px", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" },
  tabelaCaixa: { overflowX: "auto" },
  tabela: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "5px 7px", color: "#94a3b8", borderBottom: "1px solid #334155", whiteSpace: "nowrap" },
  td: { padding: "5px 7px", borderBottom: "1px solid #1e293b", color: "#e2e8f0", whiteSpace: "nowrap" },
  manter: { background: "rgba(74,222,128,.08)" },
};
