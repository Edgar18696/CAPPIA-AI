// =============================================================
// PAIIA — Central do Paizinho: RELATÓRIO DA MANHÃ (piloto LOJA ONLINE).
// Só mostra: nenhuma ação aqui altera anúncio, preço, estoque ou medida.
// O botão de teste com dados reais só existe no ambiente local (npm run dev).
// =============================================================
import { useEffect, useState } from "react";
import { lerUltimoRelatorio, lerRelatorioTesteLocal, rodarTesteLocal, CONTA_PILOTO } from "../services/paizinhoAuditoria/relatorioService";

const LOCAL = import.meta.env.DEV === true;
const reais = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const numero = (v) => (v === null || v === undefined ? "—" : Number(v).toLocaleString("pt-BR"));
// + = com as medidas do Bling o frete seria maior; − = menor.
const textoDiferenca = (d) => (d === null || d === undefined ? "—" : d === 0 ? "sem diferença" : `${d > 0 ? "+" : "−"}${reais(Math.abs(d))}`);
const hora = (iso) => { try { return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); } catch { return "—"; } };
const COR = { alta: "#f87171", media: "#fbbf24", baixa: "#60a5fa" };
const ROTULO = { alta: "Urgente", media: "Importante", baixa: "Acompanhar" };

export default function RelatorioManhaPaizinho() {
  const [servidor, setServidor] = useState({ estado: "carregando" });
  const [teste, setTeste] = useState(() => (LOCAL ? lerRelatorioTesteLocal() : null));
  const [rodando, setRodando] = useState("");
  const [erroTeste, setErroTeste] = useState("");
  const [limite, setLimite] = useState(100);
  const [concorrencia, setConcorrencia] = useState(0);
  const [verTeste, setVerTeste] = useState(LOCAL);

  useEffect(() => {
    let vivo = true;
    lerUltimoRelatorio().then((r) => { if (vivo) setServidor(r); });
    return () => { vivo = false; };
  }, []);

  async function rodar() {
    setErroTeste("");
    setRodando("Começando…");
    try {
      const rel = await rodarTesteLocal({ limiteItens: limite, concorrencia, aoProgredir: setRodando });
      setTeste(rel);
      setVerTeste(true);
    } catch (e) {
      setErroTeste(String(e?.message || e));
    }
    setRodando("");
  }

  const doServidor = servidor.estado === "ok" && servidor.registro?.status === "concluido" ? servidor.registro.relatorio : null;
  const rel = verTeste && teste ? teste : doServidor || (LOCAL ? teste : null);

  return (
    <section style={S.caixa} data-paizinho-relatorio-manha>
      <div style={S.topo}>
        <div>
          <h2 style={S.titulo}>☀️ Relatório da manhã — {CONTA_PILOTO.nome}</h2>
          <p style={S.sub}>{rel ? `Gerado em ${hora(rel.gerado_em)} · ${rel.origem === "teste_local" ? "TESTE LOCAL (só neste computador)" : "rotina automática das 03h"}` : textoEstado(servidor)}</p>
        </div>
        {LOCAL && doServidor && teste && (
          <div style={S.linha}>
            <button type="button" style={verTeste ? S.chipAtivo : S.chip} onClick={() => setVerTeste(true)}>Teste local</button>
            <button type="button" style={!verTeste ? S.chipAtivo : S.chip} onClick={() => setVerTeste(false)}>Servidor 03h</button>
          </div>
        )}
      </div>

      {LOCAL && (
        <div style={S.teste} data-paizinho-teste-local>
          <strong>🧪 Teste com dados reais (somente leitura)</strong>
          <span style={S.ajuda}>Lê a conta {CONTA_PILOTO.nome} no Mercado Livre e os custos/medidas no Bling. Nada é alterado. Só aparece no ambiente local.</span>
          <div style={S.linha}>
            <label style={S.rotulo}>Anúncios
              <select value={limite} onChange={(e) => setLimite(Number(e.target.value))} style={S.select} disabled={Boolean(rodando)}>
                {[20, 50, 100, 300, 500].map((n) => <option key={n} value={n}>{n}</option>)}
                <option value={5000}>todos</option>
              </select>
            </label>
            <label style={S.rotulo}>Concorrência (usa créditos SerpAPI)
              <select value={concorrencia} onChange={(e) => setConcorrencia(Number(e.target.value))} style={S.select} disabled={Boolean(rodando)}>
                {[0, 3, 5, 15].map((n) => <option key={n} value={n}>{n === 0 ? "não pesquisar" : `${n} anúncios`}</option>)}
              </select>
            </label>
            <button type="button" onClick={rodar} disabled={Boolean(rodando)} style={S.botao} data-paizinho-rodar-teste>{rodando ? "⏳ Analisando…" : "Rodar análise de teste agora"}</button>
          </div>
          {rodando && <span style={S.ajuda}>⏳ {rodando}</span>}
          {erroTeste && <span style={S.erro}>❌ {erroTeste}</span>}
        </div>
      )}

      {rel ? <Relatorio rel={rel} /> : null}
    </section>
  );
}

function textoEstado(s) {
  if (s.estado === "carregando") return "Carregando…";
  if (s.estado === "nao_ativado") return "A análise automática das 03h ainda não foi ativada.";
  if (s.estado === "vazio") return "Nenhum relatório gerado ainda. O primeiro fica pronto depois das 03h.";
  if (s.estado === "ok" && s.registro?.status === "executando") return `Análise em andamento desde ${hora(s.registro.iniciado_em)}…`;
  if (s.estado === "ok" && s.registro?.status === "erro") return `A última análise (${hora(s.registro.iniciado_em)}) não terminou: ${s.registro.erro || "erro"}.`;
  return "Não foi possível ler o relatório agora.";
}

function useCelular() {
  const q = "(max-width: 767px)";
  const [celular, setCelular] = useState(() => typeof window !== "undefined" && window.matchMedia?.(q).matches);
  useEffect(() => {
    const m = window.matchMedia?.(q);
    if (!m) return undefined;
    const mudar = () => setCelular(m.matches);
    m.addEventListener?.("change", mudar);
    return () => m.removeEventListener?.("change", mudar);
  }, []);
  return celular;
}

function Relatorio({ rel }) {
  const r = rel.resumo;
  const celular = useCelular();
  const secoesExtras = rel.secoes.filter((s) => s.achados.length && s.chave !== "frete" && s.chave !== "renault");
  return (
    <div>
      <div style={S.kpis}>
        <Kpi rotulo="Anúncios analisados" valor={`${numero(r.anuncios_analisados)} de ${numero(r.anuncios_ativos)}`} />
        <Kpi rotulo="Visitas (30 dias)" valor={r.visitas_30d == null ? "não lido" : numero(r.visitas_30d)} />
        <Kpi rotulo="Vendas (30 dias)" valor={r.unidades_vendidas_30d == null ? "não lido" : `${numero(r.unidades_vendidas_30d)} un.`} />
        <Kpi rotulo="Conversão" valor={r.conversao_30d == null ? "não lido" : `${String(r.conversao_30d).replace(".", ",")}%`} />
        <Kpi rotulo="Faturamento (30 dias)" valor={r.faturamento_30d == null ? "não lido" : reais(r.faturamento_30d)} />
        <Kpi rotulo="Urgentes / Importantes" valor={`${r.problemas.alta} / ${r.problemas.media}`} cor={r.problemas.alta ? COR.alta : undefined} />
        <Kpi rotulo="Prejuízo estimado (30 dias)" valor={r.unidades_vendidas_30d == null ? "não lido" : reais(r.prejuizo_estimado_30d)} cor={r.prejuizo_estimado_30d ? COR.alta : undefined} />
        <Kpi rotulo="Medidas pendentes" valor={numero(r.medidas_pendentes)} />
        <Kpi rotulo="Pontuação média" valor={`${r.pontuacao_media}/100`} />
      </div>

      <h3 style={S.h3}>🎯 Prioridades de hoje</h3>
      {rel.prioridades.length ? <ListaAchados lista={rel.prioridades} /> : <p style={S.ajuda}>Nenhum problema prioritário encontrado.</p>}

      {rel.oportunidades.length > 0 && <>
        <h3 style={S.h3}>💡 Oportunidades comerciais</h3>
        <ListaAchados lista={rel.oportunidades} />
      </>}

      <h3 style={S.h3} data-paizinho-fretes-medidas>🚚 Fretes e Medidas — Problemas Encontrados ({rel.fretes_medidas.length})</h3>
      {rel.fretes_medidas.length && celular ? (
        <div style={S.achados}>{rel.fretes_medidas.map((l) => (
          <article key={l.item_id} style={{ ...S.achado, borderLeftColor: l.impacto_rs < 0 ? COR.alta : COR.media }}>
            <div style={S.linhaAchado}><a href={l.link} target="_blank" rel="noreferrer" style={S.link}>{l.item_id}</a>{l.sku && <span style={S.ajuda}>SKU {l.sku}</span>}<span style={{ color: l.impacto_rs < 0 ? COR.alta : "#94a3b8", fontWeight: 800 }}>{l.impacto_rs === null ? "impacto não calculável" : reais(l.impacto_rs)}</span></div>
            <div style={S.tituloAchado}>{l.titulo}</div>
            <div style={S.ajuda}>⏳ Pendente de conferência física</div>
            <div style={S.ajuda}>Anúncio (ML): {l.medidas_anuncio} · Bling: {l.medidas_bling}</div>
            <div style={S.ajuda}>Peso cobrado pelo ML: {l.peso_cobrado_g ? `${numero(l.peso_cobrado_g)} g` : "—"}</div>
            <div style={S.ajuda}>Frete hoje: {l.frete_gratis ? reais(l.frete_vendedor) : "comprador paga"}{l.frete_com_bling !== null && l.frete_com_bling !== undefined ? ` · com medidas do Bling: ${reais(l.frete_com_bling)} (${textoDiferenca(l.diferenca_por_envio)})` : ""} · real (média): {reais(l.frete_real_medio)}</div>
            {l.divergencias.map((d, i) => <div key={i}>• {d}</div>)}
            <div style={S.sugestao}>👉 {l.sugestao}</div>
          </article>
        ))}</div>
      ) : rel.fretes_medidas.length ? (
        <div style={S.tabelaCaixa}>
          <table style={S.tabela}>
            <thead><tr>{["SKU", "Anúncio", "Medidas no anúncio (ML)", "Medidas no Bling", "Peso cobrado pelo ML", "Frete hoje", "Frete c/ medidas do Bling", "Diferença por envio", "Frete real (média)", "Divergência", "Impacto (30 dias)", "Correção sugerida"].map((t) => <th key={t} style={S.th}>{t}</th>)}</tr></thead>
            <tbody>{rel.fretes_medidas.map((l) => (
              <tr key={l.item_id}>
                <td style={S.td}>{l.sku || "—"}</td>
                <td style={S.td}><a href={l.link} target="_blank" rel="noreferrer" style={S.link}>{l.item_id}</a><br /><small style={S.ajuda}>{l.titulo}</small><br /><small style={S.ajuda}>⏳ pendente de conferência</small></td>
                <td style={S.td}>{l.medidas_anuncio}</td>
                <td style={S.td}>{l.medidas_bling}</td>
                <td style={S.td}>{l.peso_cobrado_g ? `${numero(l.peso_cobrado_g)} g` : "—"}</td>
                <td style={S.td}>{l.frete_gratis ? reais(l.frete_vendedor) : "comprador paga"}</td>
                <td style={S.td}>{l.frete_com_bling === null || l.frete_com_bling === undefined ? "—" : reais(l.frete_com_bling)}</td>
                <td style={S.td}>{textoDiferenca(l.diferenca_por_envio)}</td>
                <td style={S.td}>{reais(l.frete_real_medio)}</td>
                <td style={S.td}>{l.divergencias.map((d, i) => <div key={i}>• {d}</div>)}</td>
                <td style={{ ...S.td, color: l.impacto_rs < 0 ? COR.alta : undefined }}>{l.impacto_rs === null ? "não calculável" : reais(l.impacto_rs)}</td>
                <td style={S.td}>{l.sugestao}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p style={S.ajuda}>Nenhum problema de frete ou medidas encontrado.</p>}

      {rel.renault.length > 0 && <>
        <h3 style={S.h3}>🔧 Peças Renault ({rel.renault.length})</h3>
        {celular ? <div style={S.achados}>{rel.renault.map((l) => (
          <article key={l.item_id} style={{ ...S.achado, borderLeftColor: l.recomendacao === "manter" ? "#22c55e" : COR.media }}>
            <div style={S.linhaAchado}><a href={l.link} target="_blank" rel="noreferrer" style={S.link}>{l.item_id}</a>{l.sku && <span style={S.ajuda}>SKU {l.sku}</span>}<strong>{l.recomendacao}</strong></div>
            <div style={S.tituloAchado}>{l.titulo}</div>
            <div style={S.ajuda}>Preço {reais(l.preco)} · Custo: {l.custo ? reais(l.custo) : "sem custo"} · Tabela Renault: {l.tabela_renault ? reais(l.tabela_renault) : "—"} · Concorrência: {l.concorrencia ? `${reais(l.concorrencia.minimo)} a ${reais(l.concorrencia.maximo)}` : "—"}</div>
          </article>
        ))}</div> : <div style={S.tabelaCaixa}>
          <table style={S.tabela}>
            <thead><tr>{["SKU", "Anúncio", "Preço", "Custo Bling", "Tabela Renault", "Concorrência", "Recomendação"].map((t) => <th key={t} style={S.th}>{t}</th>)}</tr></thead>
            <tbody>{rel.renault.map((l) => (
              <tr key={l.item_id}>
                <td style={S.td}>{l.sku || "—"}</td>
                <td style={S.td}><a href={l.link} target="_blank" rel="noreferrer" style={S.link}>{l.item_id}</a><br /><small style={S.ajuda}>{l.titulo}</small></td>
                <td style={S.td}>{reais(l.preco)}</td>
                <td style={S.td}>{l.custo ? reais(l.custo) : "sem custo"}</td>
                <td style={S.td}>{l.tabela_renault ? reais(l.tabela_renault) : "—"}</td>
                <td style={S.td}>{l.concorrencia ? `${reais(l.concorrencia.minimo)} a ${reais(l.concorrencia.maximo)}` : "—"}</td>
                <td style={S.td}><strong>{l.recomendacao}</strong></td>
              </tr>
            ))}</tbody>
          </table>
        </div>}
      </>}

      <h3 style={S.h3}>📋 Detalhes por assunto</h3>
      {secoesExtras.map((s) => (
        <details key={s.chave} style={S.detalhe}>
          <summary style={S.resumo}>{s.titulo} ({s.achados.length})</summary>
          <ListaAchados lista={s.achados} />
        </details>
      ))}

      <details style={S.detalhe}>
        <summary style={S.resumo}>ℹ️ Limitações desta execução e regras ({rel.limitacoes.length + rel.falhas.length})</summary>
        <ul style={S.lista}>
          {rel.limitacoes.map((l, i) => <li key={`l${i}`}>{l}</li>)}
          {rel.falhas.map((f) => <li key={f.etapa}>Leitura com falha — {f.etapa}: {f.quantidade} vez(es) ({f.exemplo}).</li>)}
          {rel.regras.map((l, i) => <li key={`r${i}`} style={{ color: "#86efac" }}>✔ {l}</li>)}
        </ul>
      </details>
    </div>
  );
}

function Kpi({ rotulo, valor, cor }) {
  return <div style={S.kpi}><small style={S.kpiRotulo}>{rotulo}</small><strong style={{ ...S.kpiValor, ...(cor ? { color: cor } : {}) }}>{valor}</strong></div>;
}

function ListaAchados({ lista }) {
  return (
    <div style={S.achados}>
      {lista.map((a, i) => (
        <article key={`${a.item_id}-${a.area}-${i}`} style={{ ...S.achado, borderLeftColor: a.positivo ? "#22c55e" : COR[a.severidade] || "#64748b" }}>
          <div style={S.linhaAchado}>
            <span style={{ ...S.selo, color: a.positivo ? "#22c55e" : COR[a.severidade] }}>{a.positivo ? "Manter" : a.area === "oportunidade" ? "Oportunidade" : ROTULO[a.severidade]}</span>
            <a href={a.link} target="_blank" rel="noreferrer" style={S.link}>{a.item_id}</a>
            {a.sku && <span style={S.ajuda}>SKU {a.sku}</span>}
            {a.impacto_rs !== null && a.impacto_rs !== undefined && <span style={{ color: a.impacto_rs < 0 ? COR.alta : "#86efac", fontWeight: 800 }}>{reais(a.impacto_rs)} / 30 dias</span>}
          </div>
          <div style={S.tituloAchado}>{a.titulo}</div>
          <div>{a.problema}</div>
          <div style={S.sugestao}>👉 {a.sugestao}</div>
        </article>
      ))}
    </div>
  );
}

const S = {
  caixa: { marginTop: 18, padding: "clamp(14px,3vw,22px)", border: "1px solid #155e75", borderRadius: 18, background: "linear-gradient(145deg,#04121f,#0b1a2e)", color: "#e2e8f0" },
  topo: { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" },
  titulo: { margin: 0, color: "#67e8f9", fontSize: "clamp(18px,3vw,24px)" },
  sub: { margin: "5px 0 0", color: "#94a3b8" },
  linha: { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" },
  chip: { border: "1px solid #334155", background: "#0f172a", color: "#cbd5e1", borderRadius: 999, padding: "6px 12px", cursor: "pointer" },
  chipAtivo: { border: "1px solid #67e8f9", background: "rgba(8,145,178,.24)", color: "#cffafe", borderRadius: 999, padding: "6px 12px", cursor: "pointer", fontWeight: 800 },
  teste: { display: "flex", flexDirection: "column", gap: 8, marginTop: 14, padding: 14, border: "1px dashed #f59e0b", borderRadius: 12, background: "rgba(245,158,11,.06)" },
  rotulo: { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#cbd5e1", fontWeight: 700 },
  select: { background: "#020617", color: "#f8fafc", border: "1px solid #475569", borderRadius: 8, padding: "8px 10px" },
  botao: { border: "1px solid #22d3ee", borderRadius: 10, background: "linear-gradient(135deg,#0369a1,#0891b2)", color: "white", padding: "10px 15px", fontWeight: 900, cursor: "pointer" },
  erro: { color: "#fca5a5" },
  ajuda: { color: "#94a3b8", fontSize: 13 },
  kpis: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 },
  kpi: { flex: "1 1 150px", display: "flex", flexDirection: "column", gap: 4, padding: "10px 12px", border: "1px solid #1e3a5f", borderRadius: 12, background: "#020617" },
  kpiRotulo: { color: "#94a3b8", fontSize: 12 },
  kpiValor: { fontSize: 18, color: "#f8fafc" },
  h3: { margin: "22px 0 10px", color: "#e0f2fe", fontSize: 17 },
  achados: { display: "flex", flexDirection: "column", gap: 8 },
  achado: { padding: "10px 12px", border: "1px solid #1e293b", borderLeft: "4px solid", borderRadius: 10, background: "#020617", lineHeight: 1.45, fontSize: 14 },
  linhaAchado: { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 3 },
  selo: { fontWeight: 900, fontSize: 12, textTransform: "uppercase" },
  tituloAchado: { color: "#cbd5e1", fontWeight: 700 },
  sugestao: { color: "#a5f3fc", marginTop: 3 },
  link: { color: "#67e8f9" },
  tabelaCaixa: { overflowX: "auto", maxWidth: "100%", border: "1px solid #1e293b", borderRadius: 10 },
  tabela: { borderCollapse: "collapse", width: "100%", minWidth: 900, fontSize: 13 },
  th: { textAlign: "left", padding: "8px 10px", background: "#0f172a", color: "#94a3b8", borderBottom: "1px solid #1e293b", whiteSpace: "nowrap" },
  td: { padding: "8px 10px", borderBottom: "1px solid #1e293b", verticalAlign: "top" },
  detalhe: { marginTop: 8, border: "1px solid #1e293b", borderRadius: 10, padding: "8px 12px", background: "#020617" },
  resumo: { cursor: "pointer", fontWeight: 800, color: "#e2e8f0" },
  lista: { margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.6, color: "#cbd5e1" },
};
