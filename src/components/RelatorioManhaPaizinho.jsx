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

      {rel?.leitura_incompleta ? <AvisoLeituraIncompleta info={rel.leitura_incompleta} /> : null}
      {rel ? <Relatorio rel={rel} /> : null}
    </section>
  );
}

// (12/11) Leitura parcial fica evidente no topo: o relatório não é tratado como completo.
function AvisoLeituraIncompleta({ info }) {
  const { bling, recotacao, sessao_expirada: sessao } = info;
  return (
    <div style={S.erro} role="alert" data-paizinho-leitura-incompleta>
      <strong>⚠️ Leitura incompleta — não valide este relatório como final.</strong>
      {bling ? <div>Bling lido em {bling.lidos} de {bling.total} SKUs.</div> : null}
      {recotacao ? <div>Frete recotado em {recotacao.feitas} de {recotacao.total} anúncios.</div> : null}
      {sessao ? <div>A sessão do PAIIA expirou durante a leitura. Entre de novo e rode outra vez: o que já foi lido no Bling fica guardado neste computador por 24 h.</div> : null}
    </div>
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
        <Kpi rotulo="Prejuízo calculado (custo real, 30 dias)" valor={r.prejuizo_estimado_30d == null ? "não lido" : reais(r.prejuizo_estimado_30d)} cor={r.prejuizo_estimado_30d ? COR.alta : undefined} />
        {r.fretes_medidas && <Kpi rotulo="Frete: impacto potencial (a confirmar)" valor={r.fretes_medidas.impacto_potencial_30d != null ? `${reais(r.fretes_medidas.impacto_potencial_30d)} / 30 dias` : `${reais(r.fretes_medidas.impacto_potencial_por_envio)} por envio`} />}
        <Kpi rotulo="Medidas ausentes" valor={numero(r.medidas_pendentes)} />
        <Kpi rotulo="Pontuação média" valor={`${r.pontuacao_media}/100`} />
      </div>

      <h3 style={S.h3}>🎯 Prioridades de hoje</h3>
      {rel.prioridades.length ? <ListaAchados lista={rel.prioridades} /> : <p style={S.ajuda}>Nenhum problema prioritário encontrado.</p>}

      {rel.oportunidades.length > 0 && <>
        <h3 style={S.h3}>💡 Oportunidades comerciais</h3>
        <ListaAchados lista={rel.oportunidades} />
      </>}

      <FretesMedidas rel={rel} celular={celular} />

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

// Impacto POTENCIAL de frete: sempre "estimado / a confirmar", nunca prejuízo.
const textoPotencial = (x) => (x.impacto_potencial_30d != null
  ? `até ${reais(x.impacto_potencial_30d)} / 30 dias (potencial, a confirmar)`
  : x.impacto_potencial_por_envio > 0 ? `até ${reais(x.impacto_potencial_por_envio)} por envio (potencial, a confirmar)` : "impacto não estimável");

const CLASSES_FALLBACK = {
  medidas_ausentes: { ordem: 1, titulo: "Medidas ausentes" },
  bling_padronizado: { ordem: 2, titulo: "Medidas possivelmente padronizadas no Bling" },
  divergencia_relevante: { ordem: 3, titulo: "Divergências relevantes entre Mercado Livre e Bling" },
  alerta_ml: { ordem: 4, titulo: "Outros alertas de frete (dados do Mercado Livre)" },
};
const COR_CLASSE = { medidas_ausentes: "#f59e0b", bling_padronizado: "#a78bfa", divergencia_relevante: "#f97316", alerta_ml: "#38bdf8" };
const POR_PAGINA = 30;

/** Fretes e Medidas: três classificações, agrupado por SKU, maior impacto potencial primeiro. */
function FretesMedidas({ rel }) {
  const [filtro, setFiltro] = useState("todos");
  const [qtd, setQtd] = useState(POR_PAGINA);
  const grupos = rel.fretes_por_sku;
  const classes = rel.classificacoes_medidas || CLASSES_FALLBACK;
  const fm = rel.resumo.fretes_medidas;
  if (!grupos) {
    return <>
      <h3 style={S.h3} data-paizinho-fretes-medidas>🚚 Fretes e Medidas — Problemas Encontrados</h3>
      <p style={S.ajuda}>Relatório gerado na versão anterior: rode a análise de novo para ver as classificações por SKU.</p>
    </>;
  }
  const visiveis = filtro === "todos" ? grupos : grupos.filter((g) => g.classificacoes.includes(filtro));
  const escolher = (c) => { setFiltro(c); setQtd(POR_PAGINA); };
  return (
    <>
      <h3 style={S.h3} data-paizinho-fretes-medidas>🚚 Fretes e Medidas — Problemas Encontrados ({numero(grupos.length)} SKUs · {numero(rel.fretes_medidas.length)} anúncios)</h3>
      <p style={S.ajuda}>Tudo aqui está <b>pendente de conferência física</b>. Diferenças de frete são <b>impacto potencial estimado</b>, não prejuízo confirmado. Nada é alterado no anúncio, no Bling ou no estoque.</p>
      <div style={{ ...S.linha, marginTop: 8 }}>
        <button type="button" style={filtro === "todos" ? S.chipAtivo : S.chip} onClick={() => escolher("todos")}>Todos ({numero(grupos.length)} SKUs)</button>
        {Object.entries(classes).sort((a, b) => a[1].ordem - b[1].ordem).map(([c, info]) => (
          <button key={c} type="button" style={filtro === c ? S.chipAtivo : S.chip} onClick={() => escolher(c)}>
            <span style={{ color: COR_CLASSE[c] }}>●</span> {info.ordem <= 3 ? `${info.ordem}. ` : ""}{info.titulo} ({numero(fm?.[c] ?? 0)})
          </button>
        ))}
      </div>
      {filtro !== "todos" && classes[filtro]?.explicacao && <p style={S.ajuda}>{classes[filtro].explicacao}</p>}
      {fm?.divergencia_pequena > 0 && <p style={S.ajuda}>Além disso, {numero(fm.divergencia_pequena)} anúncio(s) têm diferença pequena entre ML e Bling, sem impacto relevante no frete (registrado nos dados, sem alerta).</p>}
      <div style={{ ...S.achados, marginTop: 10 }}>
        {visiveis.slice(0, qtd).map((g) => (
          <article key={g.sku || g.anuncios[0].item_id} style={{ ...S.achado, borderLeftColor: COR_CLASSE[g.classificacao] || "#64748b" }}>
            <div style={S.linhaAchado}>
              <b>SKU {g.sku || "sem SKU"}</b>
              {g.classificacoes.map((c) => <span key={c} style={{ ...S.selo, color: COR_CLASSE[c] }}>{classes[c]?.titulo || c}</span>)}
              <span style={S.potencial}>{textoPotencial(g)}</span>
            </div>
            <div style={S.tituloAchado}>{g.titulo}{g.anuncios.length > 1 ? ` · ${g.anuncios.length} anúncios` : ""}</div>
            {g.anuncios.map((l) => (
              <div key={l.item_id} style={S.anuncioFrete}>
                <div style={S.linhaAchado}>
                  <a href={l.link} target="_blank" rel="noreferrer" style={S.link}>{l.item_id}</a>
                  <span style={S.ajuda}>{reais(l.preco)} · vendas 30 dias: {l.vendas30 == null ? "não lido" : numero(l.vendas30)}</span>
                  <span style={S.ajuda}>⏳ pendente de conferência</span>
                </div>
                <div style={S.gradeFrete}>
                  <span>📦 Anúncio (ML): <b>{l.medidas_anuncio}</b></span>
                  <span>🗂️ Bling: <b>{l.medidas_bling}</b>{l.bling_confiavel === false ? <span style={{ color: COR_CLASSE.bling_padronizado }}> · não confiável</span> : ""}</span>
                  <span>⚖️ Peso cobrado pelo ML: <b>{l.peso_cobrado_g ? `${numero(l.peso_cobrado_g)} g` : "—"}</b></span>
                  <span>🚚 Frete estimado hoje: <b>{l.frete_gratis ? reais(l.frete_vendedor) : "comprador paga"}</b></span>
                  {l.frete_com_bling != null && <span>↔️ Com medidas do Bling: <b>{reais(l.frete_com_bling)}</b> ({textoDiferenca(l.diferenca_por_envio)} por envio)</span>}
                  {l.frete_real_medio != null && <span>🧾 Cobrado nas vendas (média): <b>{reais(l.frete_real_medio)}</b></span>}
                </div>
                {l.divergencias.map((d, i) => <div key={i}>• {d}</div>)}
                <div style={S.sugestao}>👉 {l.sugestao}</div>
              </div>
            ))}
          </article>
        ))}
      </div>
      {visiveis.length > qtd && <button type="button" style={{ ...S.chip, marginTop: 10 }} onClick={() => setQtd((n) => n + POR_PAGINA)}>Mostrar mais ({numero(visiveis.length - qtd)} SKUs restantes)</button>}
      {!visiveis.length && <p style={S.ajuda}>Nenhum SKU nesta classificação.</p>}
    </>
  );
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
            {a.impacto_potencial_por_envio > 0 && <span style={S.potencial}>{textoPotencial(a)}</span>}
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
  potencial: { color: "#fbbf24", fontWeight: 800, fontSize: 13 },
  anuncioFrete: { marginTop: 8, paddingTop: 8, borderTop: "1px dashed #1e293b" },
  gradeFrete: { display: "flex", flexWrap: "wrap", gap: "4px 16px", color: "#cbd5e1", fontSize: 13, margin: "4px 0" },
  tabelaCaixa: { overflowX: "auto", maxWidth: "100%", border: "1px solid #1e293b", borderRadius: 10 },
  tabela: { borderCollapse: "collapse", width: "100%", minWidth: 900, fontSize: 13 },
  th: { textAlign: "left", padding: "8px 10px", background: "#0f172a", color: "#94a3b8", borderBottom: "1px solid #1e293b", whiteSpace: "nowrap" },
  td: { padding: "8px 10px", borderBottom: "1px solid #1e293b", verticalAlign: "top" },
  detalhe: { marginTop: 8, border: "1px solid #1e293b", borderRadius: 10, padding: "8px 12px", background: "#020617" },
  resumo: { cursor: "pointer", fontWeight: 800, color: "#e2e8f0" },
  lista: { margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.6, color: "#cbd5e1" },
};
