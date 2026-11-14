// =============================================================
// PAIIA — Central do Paizinho: janela "Regras do Mercado Livre — Anúncios".
// Mostra SÓ as regras, políticas e exigências oficiais (fonte e data) e o que
// as fontes não esclarecem. Nunca altera, pausa ou encerra anúncios.
// (13/11) O "Cruzamento das 3 contas" saiu desta janela (que fica só para regras
// oficiais), mas o componente CruzamentoContas, a leitura (leituraContas.js) e os
// resultados guardados no navegador continuam intactos, para a futura área
// "Comparativo das 3 Contas".
// =============================================================
import { useMemo, useState } from "react";
import { REGRAS, LACUNAS, DATA_ACESSO } from "../services/regrasML/catalogoRegras";
import { lerTresContas, montarCruzamento } from "../services/regrasML/leituraContas";

// (12/11) Leitura das 3 contas (somente GET) liberada também no site, por
// autorização do Edgar. O resultado fica guardado só no navegador de quem leu.
const LOCAL = true;
const TIPO = { gold_pro: "Premium", gold_special: "Clássico", free: "Grátis" };
const ENVIO = { fulfillment: "Full", xd_drop_off: "Agência", cross_docking: "Coleta", self_service: "Flex", drop_off: "Correios", me1: "ME1", custom: "Próprio", not_specified: "—" };
const NIVEL = { alto: ["Precisa de atenção", "#f87171"], conferir: ["Conferir cadastro", "#fb923c"], medio: ["Médio", "#fbbf24"], baixo: ["Baixo", "#4ade80"], permitido: ["Permitido (R1)", "#4ade80"] };
const real = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const simNao = (v) => (v === true ? "✅ igual" : v === false ? "❌ diferente" : "— sem dado");

// (13/11) Guardado para a futura área "Comparativo das 3 Contas" (não aparece nas Regras).
export function CruzamentoContas() {
  const [versao, setVersao] = useState(0);
  const [lendo, setLendo] = useState("");
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState("mesma_conta");
  const [filtro, setFiltro] = useState("atencao");
  const [busca, setBusca] = useState("");
  const [mostrar, setMostrar] = useState(30);
  const cruz = useMemo(() => montarCruzamento(), [versao]); // eslint-disable-line react-hooks/exhaustive-deps

  async function ler() {
    setErro(""); setLendo("Começando…");
    try { await lerTresContas({ aoProgredir: setLendo }); setVersao((v) => v + 1); } catch (e) { setErro(String(e?.message || e)); }
    setLendo("");
  }

  const pares = useMemo(() => {
    if (!cruz) return [];
    const b = busca.trim().toUpperCase();
    const bc = b.replace(/[^A-Z0-9]/g, "");
    return cruz.duplicidades[aba].filter((p) =>
      (filtro === "todos" || (filtro === "atencao" ? p.atencao : p.nivel === filtro)) &&
      (!b || [p.a, p.b].some((x) => x.id.includes(bc) || x.sku.replace(/[^A-Z0-9]/g, "").includes(bc) || x.titulo.toUpperCase().includes(b))));
  }, [cruz, aba, filtro, busca]);

  const r = cruz?.duplicidades.resumo;
  return (
    <section style={S.cruz}>
      <h3 style={{ ...S.h3, marginTop: 0 }}>Cruzamento das 3 contas (somente leitura)</h3>
      {LOCAL && <div style={S.acoes}><button type="button" onClick={ler} disabled={!!lendo} style={S.botao}>{lendo ? `🔄 ${lendo}` : cruz ? "Ler as 3 contas de novo" : "Ler as 3 contas agora"}</button><small style={S.base}>Só consultas de leitura no Mercado Livre: nada é alterado. Leva cerca de 12 minutos; mantenha a página aberta e não use "Sair" durante a leitura. O resultado fica guardado só neste navegador.</small></div>}
      {erro && <div style={S.aviso}>{erro}</div>}
      {!cruz ? <p style={S.nota}>Ainda não há leitura neste navegador. Use o botão acima para ler as 3 contas.</p> : <>
        <p style={S.nota}>Leitura de {new Date(cruz.lido_em).toLocaleString("pt-BR")} · {Object.entries(cruz.anuncios_lidos).map(([n, q]) => `${n}: ${q}`).join(" · ")} anúncios ativos · aplicações lidas em {cruz.aplicacoes_lidas} anúncios repetidos{cruz.falhas.length ? ` · ${cruz.falhas.length} leituras com falha` : " · nenhuma falha"}.</p>
        <div style={S.acoes}>
          <button type="button" onClick={() => { setAba("entre_contas"); setMostrar(30); }} style={{ ...S.filtro, ...(aba === "entre_contas" ? S.filtroAtivo : {}) }}>1. Entre contas ({r.entre_contas.total} pares · {r.entre_contas.atencao} com atenção)</button>
          <button type="button" onClick={() => { setAba("mesma_conta"); setMostrar(30); }} style={{ ...S.filtro, ...(aba === "mesma_conta" ? S.filtroAtivo : {}) }}>2. Dentro da mesma conta ({r.mesma_conta.total} pares · {r.mesma_conta.atencao} com atenção)</button>
        </div>
        <div style={S.kpis}>{Object.entries(NIVEL).filter(([k]) => r[aba][k]).map(([k, [nome, cor]]) => <Kpi key={k} rotulo={nome} valor={r[aba][k]} cor={cor} />)}</div>
        <p style={S.nota}>Cada par é conferido em: código da peça, SKU, quantidade (unidade x kit), marca, aplicações (veículos compatíveis no ML), tipo de anúncio e condições de venda. Vendas = total desde a criação do anúncio; visitas de 30 dias só da LOJA ONLINE. Nenhuma sugestão se baseia só em vendas, e toda ação depende da sua autorização.</p>
        <div style={S.acoes}>
          {[["atencao", "Precisam de atenção"], ["alto", "Duplicidade confirmada"], ["conferir", "Conferir cadastro"], ["todos", "Todos"]].map(([k, t]) => <button key={k} type="button" onClick={() => { setFiltro(k); setMostrar(30); }} style={{ ...S.filtro, ...(filtro === k ? S.filtroAtivo : {}) }}>{t}</button>)}
          <input value={busca} onChange={(e) => { setBusca(e.target.value); setMostrar(30); }} placeholder="Buscar SKU, MLB ou título" style={S.busca} />
        </div>
        <p style={S.base}>{pares.length} par(es)</p>
        {pares.slice(0, mostrar).map((p, i) => <Par key={`${p.a.id}-${p.b.id}`} p={p} n={i + 1} />)}
        {pares.length > mostrar && <button type="button" onClick={() => setMostrar(mostrar + 30)} style={S.filtro}>Mostrar mais ({pares.length - mostrar} restantes)</button>}
      </>}
    </section>
  );
}

function Kpi({ rotulo, valor, cor }) {
  return <div style={S.kpi}><strong style={{ fontSize: 22, color: cor || "#f8fafc" }}>{valor}</strong><small style={S.base}>{rotulo}</small></div>;
}

const nomeTipo = (t) => TIPO[t] || t;
const nomeEnvio = (x) => `${ENVIO[x.envio] || x.envio}${x.frete_gratis ? ", grátis" : ""}`;

function Par({ p, n }) {
  const [nome, cor] = NIVEL[p.nivel];
  const c = p.conferencia;
  const linhas = [
    ["SKU", simNao(c.sku)],
    ["Código da peça", simNao(c.peca)],
    ["Quantidade", c.quantidade ? `✅ igual (${p.a.unidades === 1 ? "unidade" : `${p.a.unidades}`})` : `❌ ${p.a.unidades} x ${p.b.unidades}`],
    ["Marca", c.marca === null ? "— sem dado" : c.marca ? `✅ ${p.a.marca}` : `❌ ${p.a.marca} x ${p.b.marca}`],
    ["Aplicações", `${["iguais", "contidas"].includes(c.aplicacoes.situacao) ? "✅" : c.aplicacoes.situacao === "diferentes" ? "❌" : "⚠️"} ${c.aplicacoes.texto}`],
    ["Tipo de anúncio", c.tipo ? `igual (${nomeTipo(p.a.tipo)})` : `diferente (${nomeTipo(p.a.tipo)} x ${nomeTipo(p.b.tipo)})`],
    ["Envio", c.envio && c.frete_gratis ? `igual (${nomeEnvio(p.a)})` : `diferente (${nomeEnvio(p.a)} x ${nomeEnvio(p.b)})`],
    ["Preço", c.diferenca_preco === null ? "—" : `${real(p.a.preco)} x ${real(p.b.preco)} (${c.diferenca_preco}%)`],
  ];
  return (
    <article style={{ ...S.grupo, borderColor: cor }}>
      <div style={S.grupoTopo}><strong>{n}. {p.a.titulo}</strong><span style={{ ...S.selo, color: cor, borderColor: cor }}>{nome}</span></div>
      <div style={S.tabelaCaixa}><table style={S.tabela}><thead><tr><th style={S.th}>Conta</th><th style={S.th}>Anúncio</th><th style={S.th}>SKU</th><th style={S.th}>Criado em</th><th style={S.th}>Vendas (total)</th><th style={S.th}>Visitas 30d</th><th style={S.th}>Estoque</th></tr></thead>
        <tbody>{[p.a, p.b].map((x) => <tr key={x.id}>
          <td style={S.td}>{x.conta}</td>
          <td style={S.td}><a href={x.link} target="_blank" rel="noopener noreferrer" style={S.link}>{x.id}</a></td>
          <td style={S.td}>{x.sku || "—"}</td>
          <td style={S.td}>{x.criado_em ? new Date(x.criado_em + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</td>
          <td style={S.td}>{x.vendidos_total ?? "—"}</td>
          <td style={S.td}>{x.visitas30 ?? "—"}</td>
          <td style={S.td}>{x.estoque}</td>
        </tr>)}</tbody></table></div>
      <ul style={S.conferencia}>{linhas.map(([k, v]) => <li key={k}><span style={S.base}>{k}:</span> {v}</li>)}{c.clonado && <li>⚠️ fotos idênticas nos dois anúncios</li>}</ul>
      <p style={S.texto}><strong>Motivo:</strong> {p.motivo}. <strong>Sugestão:</strong> {p.recomendacao} <span style={S.base}>({p.regras.join(", ") || "—"} · {p.situacao})</span></p>
    </article>
  );
}

export default function RegrasMLAnuncios({ aoFechar }) {
  return (
    <section id="regras-ml-anuncios" style={S.janela} aria-label="Regras do Mercado Livre — Anúncios">
      <div style={S.topo}>
        <div>
          <h2 style={S.titulo}>📜 Regras do Mercado Livre — Anúncios</h2>
          <p style={S.sub}>Regras, políticas e exigências oficiais do Mercado Livre para anúncios. Fontes oficiais acessadas em {DATA_ACESSO}.</p>
        </div>
        {aoFechar && <button type="button" onClick={aoFechar} style={S.fechar}>Fechar</button>}
      </div>

      <div style={S.trava}>🔒 Somente consulta. Esta janela mostra as regras oficiais: nenhum anúncio é lido, alterado, pausado ou encerrado.</div>

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
      {/* (13/11) Situação da leitura, sinais de mesmo produto, níveis de risco e
          recomendações são do futuro "Comparativo das 3 Contas": saíram desta janela,
          mas continuam no catálogo (catalogoRegras.js) e no CruzamentoContas. */}
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
  conferencia: { margin: 0, paddingLeft: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: "2px 16px", color: "#cbd5e1", fontSize: 13 },
};
