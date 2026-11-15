// =============================================================
// PAIIA — Central do Paizinho: aba "Black Friday 2026" (FASE 1).
// Uma tela só: contas → Consultar Anúncios → classificação Renault/Demais/
// Revisão → Simular → tabela, filtros e alertas → aprovação (registro) →
// programação → acompanhamento → histórico.
// FASE 1 = SOMENTE LEITURA E SIMULAÇÃO: nenhuma oferta é ativada, nenhum
// preço, anúncio ou estoque é alterado. A ativação fica bloqueada (Fase 3).
// Não mexe no Ranqueamento nem nas outras funções da Central.
// =============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import { CAMPANHA_BF, dataHoraBrasilia, diasParaInicio, momentoDaCampanha } from "../services/blackFriday/calendario";
import { CONTAS_BLACK_FRIDAY, CLASSES, SITUACOES, ROTULO_CLASSE, ROTULO_SITUACAO, custosDoPerfil, filtrarLinhas, resumirSimulacao, podeAprovar } from "../services/blackFriday/regras";
import { lerContasBF, montarSimulacao, consultorBF, consultorCustoBF } from "../services/blackFriday/leitura";
import { criarRegistroBF, chaveLeitura } from "../services/blackFriday/registro";

const invocar = (nome, opcoes) => supabase.functions.invoke(nome, opcoes);
const real = (v) => (v === null || v === undefined ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const pctTxt = (v) => (v === null || v === undefined ? "—" : `${String(v).replace(".", ",")}%`);
const COR_SITUACAO = { apto: "#4ade80", atencao: "#fbbf24", revisao: "#fb923c", bloqueado: "#f87171", excluido: "#94a3b8" };
const COR_CLASSE = { renault: "#facc15", demais: "#67e8f9", revisao: "#fb923c" };
const LIMITES = [["50", "50 por conta (teste)"], ["200", "200 por conta"], ["5000", "Todos os ativos"]];
const POR_PAGINA = 50;

function lerPerfil() {
  try { return custosDoPerfil(JSON.parse(localStorage.getItem("paiiaPerfilCustos") || "null")); } catch { return custosDoPerfil(null); }
}
function lerLeituraGuardada(usuarioId) {
  try { return JSON.parse(localStorage.getItem(chaveLeitura(usuarioId)) || "null"); } catch { return null; }
}

export default function BlackFridayPaizinho() {
  const [usuarioId, setUsuarioId] = useState("");
  const [erroLogin, setErroLogin] = useState("");
  const [contas, setContas] = useState(CONTAS_BLACK_FRIDAY.map((c) => c.id));
  const [limite, setLimite] = useState("50");
  const [lendo, setLendo] = useState("");
  const [leitura, setLeitura] = useState(null);
  const [simulado, setSimulado] = useState(false);
  const [versao, setVersao] = useState(0); // força reler plano/histórico
  const [aviso, setAviso] = useState("");
  const [filtro, setFiltro] = useState({ classe: "", situacao: "", contas: [], busca: "", margemAbaixo: "", soAlertas: false });
  const [marcados, setMarcados] = useState(() => new Set());
  const [mostrar, setMostrar] = useState(POR_PAGINA);
  const cancelar = useRef(false);

  useEffect(() => {
    let vivo = true;
    const aplicar = (id) => {
      if (!vivo) return;
      setUsuarioId(id);
      if (!id) { setErroLogin("Entre no PAIIA para usar a Black Friday: use o botão \"Login\" no topo da página."); setLeitura(null); return; }
      setErroLogin("");
      const g = lerLeituraGuardada(id); setLeitura(g || null);
    };
    supabase.auth.getUser().then(({ data }) => aplicar(data?.user?.id || "")).catch(() => vivo && setErroLogin("Não foi possível confirmar o login."));
    // (15/11) Entrou ou trocou de conta com a aba aberta: a tela acompanha sem recarregar.
    const { data: ouvinte } = supabase.auth.onAuthStateChange((_evento, sessao) => aplicar(sessao?.user?.id || ""));
    return () => { vivo = false; ouvinte?.subscription?.unsubscribe(); };
  }, []);

  const registro = useMemo(() => (usuarioId ? criarRegistroBF({ storage: localStorage, usuarioId }) : null), [usuarioId]);
  const plano = useMemo(() => registro?.lerPlano() || null, [registro, versao]); // eslint-disable-line react-hooks/exhaustive-deps
  const historico = useMemo(() => registro?.historico() || [], [registro, versao]); // eslint-disable-line react-hooks/exhaustive-deps
  const perfil = useMemo(() => lerPerfil(), [versao]); // eslint-disable-line react-hooks/exhaustive-deps

  const linhas = useMemo(() => (simulado && leitura ? montarSimulacao(leitura, { decisoes: plano?.decisoes || {}, perfil }) : []), [simulado, leitura, plano, perfil]);
  const visiveis = useMemo(() => filtrarLinhas(linhas, filtro), [linhas, filtro]);
  const resumo = useMemo(() => resumirSimulacao(linhas), [linhas]);
  const aprovados = plano?.aprovados || {};
  const momento = momentoDaCampanha();

  function alternarConta(id) {
    setContas((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));
  }

  async function consultar() {
    if (!registro) return;
    if (!contas.length) { setAviso("Escolha pelo menos uma conta."); return; }
    setAviso(""); setSimulado(false); setMarcados(new Set()); cancelar.current = false;
    setLendo("Começando…");
    const nomes = CONTAS_BLACK_FRIDAY.filter((c) => contas.includes(c.id)).map((c) => c.nome).join(", ");
    registro.registrar("consulta_iniciada", { contas: nomes, limite: Number(limite) });
    try {
      const r = await lerContasBF({
        contas, limite: Number(limite),
        consultorDaConta: (id) => consultorBF(id, invocar),
        consultarCusto: consultorCustoBF(invocar),
        aoProgredir: setLendo,
        cancelado: () => cancelar.current,
      });
      setLeitura(r);
      try { localStorage.setItem(chaveLeitura(usuarioId), JSON.stringify(r)); } catch { setAviso("Leitura grande demais para guardar neste navegador: fica só nesta tela."); }
      const lidos = Object.values(r.contas).reduce((s, c) => s + c.lidos, 0);
      registro.registrar("consulta_concluida", { contas: nomes, anuncios: lidos, falhas: r.falhas.length, interrompida: cancelar.current });
      for (const f of r.falhas.slice(0, 100)) registro.registrar("erro", { conta: f.conta, etapa: f.etapa, item: f.id, erro: f.erro });
    } catch (e) {
      setAviso(String(e?.message || e));
      registro.registrar("erro", { etapa: "consulta", erro: String(e?.message || e) });
    }
    setLendo(""); setVersao((v) => v + 1);
  }

  function simular() {
    if (!leitura || !registro) return;
    setSimulado(true); setMostrar(POR_PAGINA); setVersao((v) => v + 1);
    const l = montarSimulacao(leitura, { decisoes: plano?.decisoes || {}, perfil: lerPerfil() });
    const r = resumirSimulacao(l);
    registro.registrar("simulacao", { anuncios: r.total, renault: r.renault, demais: r.demais, revisao: r.revisao, prejuizo: r.prejuizo, sem_margem: r.sem_margem });
    // Aprovação cujo preço ou situação mudou desde então sai do plano (nunca usa preço antigo).
    const { desatualizadas } = registro.conferirAprovacoes(l);
    setAviso(desatualizadas.length ? `${desatualizadas.length} aprovação(ões) ficaram desatualizadas (preço ou situação mudou) e saíram do plano.` : "");
  }

  function decidir(l, decisao) {
    registro.decidir(l.conta, l.id, decisao);
    setVersao((v) => v + 1);
  }

  function aprovar(lista, modo) {
    const aptas = lista.filter(podeAprovar);
    if (!aptas.length) { setAviso("Nenhum anúncio pronto para aprovar nesta seleção (Revisão e Bloqueado não podem ser aprovados)."); return; }
    const atencao = aptas.filter((l) => l.situacao === SITUACOES.ATENCAO);
    const porConta = {};
    for (const l of aptas) porConta[l.conta_nome] = (porConta[l.conta_nome] || 0) + 1;
    const texto = `Registrar a APROVAÇÃO de ${aptas.length} anúncio(s) para a Black Friday?\n\n${Object.entries(porConta).map(([n, q]) => `${n}: ${q}`).join("\n")}\n\nPeríodo: ${dataHoraBrasilia(CAMPANHA_BF.inicio)} a ${dataHoraBrasilia(CAMPANHA_BF.fim)} (Brasília).\n\nFase 1: só registra o plano. NENHUMA oferta é ativada e nenhum preço é alterado.`;
    if (!window.confirm(texto)) return;
    let confirmarAtencao = false;
    if (atencao.length) confirmarAtencao = window.confirm(`${atencao.length} anúncio(s) estão em ATENÇÃO (ex.: margem abaixo do mínimo ou preço abaixo de R$ 79). Aprovar também esses?`);
    const r = registro.aprovar(aptas, { modo, confirmarAtencao });
    setAviso(`Aprovação registrada: ${r.aprovados.length} novo(s), ${r.ja_aprovados.length} já aprovado(s), ${r.recusados.length} não aprovado(s).`);
    setMarcados(new Set()); setVersao((v) => v + 1);
  }

  function desaprovar(chaves) {
    if (!chaves.length || !window.confirm(`Retirar a aprovação de ${chaves.length} anúncio(s)?`)) return;
    registro.desaprovar(chaves); setVersao((v) => v + 1);
  }

  const marcar = (k) => setMarcados((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const selecionadas = linhas.filter((l) => marcados.has(l.chave));
  const totalAprovados = Object.keys(aprovados).length;
  const aprovadosPorConta = Object.values(aprovados).reduce((m, a) => { const n = CONTAS_BLACK_FRIDAY.find((c) => c.id === a.conta)?.nome || a.conta; m[n] = (m[n] || 0) + 1; return m; }, {});
  const promosExistentes = linhas.filter((l) => l.promocoes_ativas.length);
  const erros = historico.filter((h) => h.tipo === "erro");

  if (erroLogin) return <section style={S.caixa}><h2 style={S.titulo}>🛍️ Black Friday 2026</h2><div style={S.aviso}>{erroLogin}</div></section>;

  return (
    <section id="black-friday-paizinho" style={S.caixa} data-paiia-black-friday>
      <h2 style={S.titulo}>🛍️ Black Friday 2026</h2>
      <p style={S.sub}>Planejar, simular e aprovar as ofertas das contas LOJA ONLINE, REVELAÇÃO e CIEBR.</p>
      <div style={S.trava}>🔒 <strong>Fase 1 — somente leitura e simulação.</strong> Nenhuma oferta é ativada e nenhum preço, anúncio ou estoque é alterado. Descontos: <strong>10%</strong> Renault comprovada · <strong>5%</strong> demais · não cumulativos · dúvida vai para revisão.</div>

      {/* Programação (calendário obrigatório) */}
      <div style={S.calendario}>
        <Kpi rotulo="Início (ativação)" valor={dataHoraBrasilia(CAMPANHA_BF.inicio)} />
        <Kpi rotulo="Encerramento automático" valor={dataHoraBrasilia(CAMPANHA_BF.fim)} />
        <Kpi rotulo="Conferência dos preços normais" valor="01/12/2026" />
        <Kpi rotulo={momento === "preparacao" ? "Faltam" : "Situação"} valor={momento === "preparacao" ? `${diasParaInicio()} dia(s)` : momento === "em_andamento" ? "Em andamento" : "Encerrada"} />
      </div>

      {/* 1-2. Contas e consulta */}
      <h3 style={S.h3}>1. Contas e consulta</h3>
      <div style={S.acoes}>
        {CONTAS_BLACK_FRIDAY.map((c) => (
          <label key={c.id} style={{ ...S.filtro, ...(contas.includes(c.id) ? S.filtroAtivo : {}) }}>
            <input type="checkbox" checked={contas.includes(c.id)} onChange={() => alternarConta(c.id)} disabled={!!lendo} /> {c.nome}
          </label>
        ))}
        <button type="button" style={S.filtro} disabled={!!lendo} onClick={() => setContas(contas.length === 3 ? [] : CONTAS_BLACK_FRIDAY.map((c) => c.id))}>{contas.length === 3 ? "Desmarcar todas" : "Todas as contas"}</button>
        <select value={limite} onChange={(e) => setLimite(e.target.value)} style={S.busca} disabled={!!lendo} aria-label="Quantidade de anúncios">
          {LIMITES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </div>
      <div style={S.acoes}>
        <button type="button" style={S.botao} onClick={consultar} disabled={!!lendo || !contas.length} data-paiia-bf="consultar">{lendo ? `🔄 ${lendo}` : "🔎 Consultar Anúncios"}</button>
        {lendo && <button type="button" style={S.filtro} onClick={() => { cancelar.current = true; }}>Parar leitura</button>}
        <button type="button" style={S.botao} onClick={simular} disabled={!!lendo || !leitura} data-paiia-bf="simular">🧮 Simular Black Friday</button>
      </div>
      <small style={S.base}>Só consultas de leitura no Mercado Livre e no Bling. Mantenha a página aberta durante a leitura e não use "Sair".</small>
      {leitura && <p style={S.nota}>Leitura de {new Date(leitura.lido_em).toLocaleString("pt-BR")} · {Object.values(leitura.contas || {}).map((c) => `${c.nome}: ${c.lidos}${c.total_ativos ? ` de ${c.total_ativos}` : ""}`).join(" · ")} anúncios · {leitura.falhas?.length || 0} leitura(s) com falha{leitura.bling_parou ? " · Bling parou de responder (custos incompletos)" : ""}.</p>}
      {perfil.impostoPct === null && <div style={S.aviso}>Imposto não cadastrado em <strong>Preços, Custos e Lucro</strong>: sem ele a margem não é verificável e os anúncios vão para revisão.</div>}
      {aviso && <div style={S.aviso}>{aviso}</div>}

      {simulado && <>
        {/* 3-6. Resultado da simulação */}
        <h3 style={S.h3}>2. Simulação</h3>
        <div style={S.kpis}>
          <Kpi rotulo="Anúncios" valor={resumo.total} />
          <Kpi rotulo="Renault (10%)" valor={resumo.renault} cor={COR_CLASSE.renault} />
          <Kpi rotulo="Demais (5%)" valor={resumo.demais} cor={COR_CLASSE.demais} />
          <Kpi rotulo="Revisão Renault" valor={resumo.revisao} cor={COR_CLASSE.revisao} />
          <Kpi rotulo="Prontos" valor={resumo.apto} cor={COR_SITUACAO.apto} />
          <Kpi rotulo="Atenção" valor={resumo.atencao} cor={COR_SITUACAO.atencao} />
          <Kpi rotulo="Em revisão" valor={resumo.revisao_sit} cor={COR_SITUACAO.revisao} />
          <Kpi rotulo="Prejuízo" valor={resumo.prejuizo} cor="#f87171" />
          <Kpi rotulo="Margem não verificável" valor={resumo.sem_margem} cor="#fb923c" />
        </div>

        <div style={S.acoes}>
          <select value={filtro.classe} onChange={(e) => { setFiltro({ ...filtro, classe: e.target.value }); setMostrar(POR_PAGINA); }} style={S.busca} aria-label="Classe">
            <option value="">Todas as classes</option>{Object.values(CLASSES).map((c) => <option key={c} value={c}>{ROTULO_CLASSE[c]}</option>)}
          </select>
          <select value={filtro.situacao} onChange={(e) => { setFiltro({ ...filtro, situacao: e.target.value }); setMostrar(POR_PAGINA); }} style={S.busca} aria-label="Situação">
            <option value="">Todas as situações</option>{Object.values(SITUACOES).map((s) => <option key={s} value={s}>{ROTULO_SITUACAO[s]}</option>)}
          </select>
          <select value={filtro.contas[0] || ""} onChange={(e) => { setFiltro({ ...filtro, contas: e.target.value ? [e.target.value] : [] }); setMostrar(POR_PAGINA); }} style={S.busca} aria-label="Conta">
            <option value="">Todas as contas</option>{CONTAS_BLACK_FRIDAY.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <input value={filtro.margemAbaixo} onChange={(e) => setFiltro({ ...filtro, margemAbaixo: e.target.value.replace(/[^\d,.]/g, "") })} placeholder="Margem abaixo de %" style={{ ...S.busca, flex: "0 1 150px" }} />
          <label style={S.base}><input type="checkbox" checked={filtro.soAlertas} onChange={(e) => setFiltro({ ...filtro, soAlertas: e.target.checked })} /> Só com alerta</label>
          <input value={filtro.busca} onChange={(e) => { setFiltro({ ...filtro, busca: e.target.value }); setMostrar(POR_PAGINA); }} placeholder="Buscar MLB, SKU ou título" style={S.busca} />
        </div>

        {/* 7. Aprovação */}
        <div style={S.acoes}>
          <span style={S.base}>{visiveis.length} anúncio(s) no filtro · {selecionadas.length} marcado(s)</span>
          <button type="button" style={S.filtro} onClick={() => setMarcados(new Set(visiveis.filter(podeAprovar).map((l) => l.chave)))}>Marcar prontos do filtro</button>
          <button type="button" style={S.botao} disabled={!selecionadas.length} onClick={() => aprovar(selecionadas, "selecao")}>✅ Aprovar selecionados</button>
          <button type="button" style={S.botao} disabled={!visiveis.some(podeAprovar)} onClick={() => aprovar(visiveis, "lote")}>✅ Aprovar lote (filtro)</button>
        </div>

        <div style={S.tabelaCaixa}>
          <table style={S.tabela}>
            <thead><tr>{["", "Conta", "Anúncio", "Classe", "Preço original", "Desc.", "Preço final", "Margem", "Situação", "Ação"].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {visiveis.slice(0, mostrar).map((l) => {
                const aprovado = !!aprovados[l.chave];
                return (
                  <tr key={l.chave} style={aprovado ? S.aprovado : undefined}>
                    <td style={S.td}><input type="checkbox" checked={marcados.has(l.chave)} disabled={!podeAprovar(l)} onChange={() => marcar(l.chave)} aria-label={`Marcar ${l.id}`} /></td>
                    <td style={S.td}>{l.conta_nome}</td>
                    <td style={{ ...S.td, whiteSpace: "normal", minWidth: 220 }}>
                      <a href={l.link} target="_blank" rel="noreferrer" style={S.link}>{l.id}</a>{l.sku ? ` · ${l.sku}` : ""}<br /><small style={S.base}>{l.titulo}</small>
                    </td>
                    <td style={{ ...S.td, whiteSpace: "normal" }} title={[...l.evidencias, l.duvida].filter(Boolean).join("\n")}>
                      <span style={{ ...S.selo, color: COR_CLASSE[l.classe], borderColor: COR_CLASSE[l.classe] }}>{ROTULO_CLASSE[l.classe]}</span>
                      {l.decisao && l.decisao !== "excluir" && <small style={S.base}> (manual)</small>}
                    </td>
                    <td style={S.td}>{real(l.preco_original)}</td>
                    <td style={S.td}>{l.classe === CLASSES.REVISAO ? "a decidir" : `${l.desconto_pct}%`}</td>
                    <td style={S.td}>{real(l.preco_final)}</td>
                    <td style={{ ...S.td, color: l.lucro !== null && l.lucro < 0 ? "#f87171" : undefined }} title={l.margem_pct === null ? "Margem não verificável" : `Preço ${real(l.preco_final)} − tarifa ${real(l.tarifa)} − frete ${real(l.frete)} − imposto ${real(l.imposto)} − custo ${real(l.custo)} − custo/pedido ${real(l.custo_pedido)} = ${real(l.lucro)}`}>
                      {l.margem_pct === null ? "não verificável" : `${pctTxt(l.margem_pct)} (${real(l.lucro)})`}
                    </td>
                    <td style={{ ...S.td, whiteSpace: "normal", minWidth: 200 }}>
                      <span style={{ ...S.selo, color: COR_SITUACAO[l.situacao], borderColor: COR_SITUACAO[l.situacao] }}>{aprovado ? "Aprovado (plano)" : ROTULO_SITUACAO[l.situacao]}</span>
                      {[...l.bloqueios, ...l.motivos, ...l.alertas].map((m, i) => <div key={i}><small style={S.base}>• {m}</small></div>)}
                    </td>
                    <td style={{ ...S.td, whiteSpace: "normal" }}>
                      {aprovado
                        ? <button type="button" style={S.mini} onClick={() => desaprovar([l.chave])}>Retirar</button>
                        : podeAprovar(l) && <button type="button" style={S.mini} onClick={() => aprovar([l], "anuncio")}>Aprovar</button>}
                      {(l.classe === CLASSES.REVISAO || l.decisao) && l.situacao !== SITUACOES.BLOQUEADO && <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                        <button type="button" style={S.mini} onClick={() => decidir(l, "renault")}>Renault 10%</button>
                        <button type="button" style={S.mini} onClick={() => decidir(l, "demais")}>Demais 5%</button>
                      </div>}
                      <div style={{ marginTop: 4 }}>
                        {l.decisao
                          ? <button type="button" style={S.mini} onClick={() => decidir(l, null)}>Desfazer decisão</button>
                          : <button type="button" style={S.mini} onClick={() => decidir(l, "excluir")}>Tirar da campanha</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {visiveis.length > mostrar && <button type="button" style={S.filtro} onClick={() => setMostrar(mostrar + POR_PAGINA)}>Mostrar mais ({visiveis.length - mostrar} restantes)</button>}
      </>}

      {/* 8. Programação e ativação (bloqueada na Fase 1) */}
      <h3 style={S.h3}>3. Programação e ativação</h3>
      <p style={S.nota}>Ofertas aprovadas: <strong>{totalAprovados}</strong>{totalAprovados ? ` (${Object.entries(aprovadosPorConta).map(([n, q]) => `${n}: ${q}`).join(" · ")})` : ""}. Programação fixa: início {dataHoraBrasilia(CAMPANHA_BF.inicio)} e encerramento automático {dataHoraBrasilia(CAMPANHA_BF.fim)} (Brasília), pela data de fim da própria oferta no Mercado Livre — o preço do anúncio não é trocado e alterações manuais feitas durante a campanha são respeitadas.</p>
      <div style={S.acoes}>
        <button type="button" style={{ ...S.botao, opacity: 0.5, cursor: "not-allowed" }} disabled title="Liberado só na Fase 3, com autorização expressa">🚀 Ativar ofertas aprovadas</button>
        <small style={S.base}>Bloqueado: a ativação exige validar elegibilidade e modalidades na API (Fase 2) e autorização expressa (Fase 3).</small>
      </div>

      {/* 9. Acompanhamento */}
      <h3 style={S.h3}>4. Acompanhamento</h3>
      <p style={S.nota}>Ofertas desta campanha ativas no Mercado Livre: <strong>0</strong> (nada foi ativado). {simulado ? `${promosExistentes.length} anúncio(s) já participam de outra promoção (conflito, vão para revisão).` : "Simule para ver as promoções já existentes."}</p>
      {simulado && promosExistentes.length > 0 && <ul style={S.lista}>{promosExistentes.slice(0, 20).map((l) => <li key={l.chave}>{l.conta_nome} · {l.id}: {l.promocoes_ativas.map((p) => `${p.tipo || "?"} (${p.status}${p.preco ? `, ${real(p.preco)}` : ""})`).join(", ")}</li>)}</ul>}

      {/* 10. Histórico */}
      <h3 style={S.h3}>5. Histórico de operações e erros</h3>
      {!historico.length ? <p style={S.nota}>Nenhuma operação registrada ainda.</p> : <>
        <p style={S.nota}>{historico.length} registro(s) · {erros.length} erro(s). Guardado só neste navegador, para o seu usuário.</p>
        <ul style={S.lista}>{historico.slice(0, 30).map((h) => <li key={h.id}><small>{new Date(h.quando).toLocaleString("pt-BR")} · <strong>{h.tipo}</strong>{h.conta ? ` · ${h.conta}` : h.contas ? ` · ${h.contas}` : ""}{h.item ? ` · ${h.item}` : ""}{h.erro ? ` · ${h.erro}` : ""}{h.anuncios !== undefined ? ` · ${h.anuncios} anúncios` : ""}{h.aprovados !== undefined ? ` · ${h.aprovados} aprovado(s)` : ""}{h.decisao ? ` · ${h.decisao}` : ""}</small></li>)}</ul>
      </>}
    </section>
  );
}

function Kpi({ rotulo, valor, cor }) {
  return <div style={S.kpi}><strong style={{ fontSize: 19, color: cor || "#f8fafc" }}>{valor}</strong><small style={S.base}>{rotulo}</small></div>;
}

const S = {
  caixa: { scrollMarginTop: 18, marginTop: 18, padding: "clamp(15px,3vw,24px)", border: "1px solid #155e75", borderRadius: 18, background: "linear-gradient(145deg,#071326,#0f172a)" },
  titulo: { margin: 0, color: "#67e8f9", fontSize: "clamp(19px,3vw,24px)" },
  sub: { margin: "6px 0 0", color: "#cbd5e1" },
  trava: { marginTop: 12, padding: 12, border: "1px solid #16a34a", borderRadius: 10, background: "rgba(22,163,74,.1)", color: "#dcfce7", lineHeight: 1.5 },
  calendario: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,170px),1fr))", gap: 10, marginTop: 12 },
  h3: { margin: "22px 0 8px", color: "#f8fafc" },
  base: { color: "#94a3b8" },
  nota: { color: "#94a3b8", marginTop: 8, lineHeight: 1.5 },
  lista: { margin: 0, paddingLeft: 20, lineHeight: 1.6, color: "#cbd5e1" },
  acoes: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "10px 0" },
  botao: { border: "1px solid #22d3ee", borderRadius: 11, background: "linear-gradient(135deg,#0369a1,#0891b2)", color: "white", padding: "10px 15px", fontWeight: 900, cursor: "pointer" },
  mini: { border: "1px solid #475569", borderRadius: 8, background: "#0f172a", color: "#e2e8f0", padding: "4px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  aviso: { marginTop: 10, padding: 12, border: "1px solid #f59e0b", borderRadius: 10, background: "rgba(245,158,11,.1)", color: "#fde68a" },
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,130px),1fr))", gap: 10, margin: "10px 0" },
  kpi: { display: "flex", flexDirection: "column", gap: 4, padding: 12, border: "1px solid #334155", borderRadius: 12, background: "#0f172a" },
  filtro: { display: "inline-flex", gap: 6, alignItems: "center", border: "1px solid #475569", borderRadius: 999, background: "#0f172a", color: "#e2e8f0", padding: "7px 12px", fontWeight: 700, cursor: "pointer" },
  filtroAtivo: { borderColor: "#67e8f9", background: "rgba(8,145,178,.24)", color: "#cffafe" },
  busca: { flex: "1 1 180px", border: "1px solid #475569", borderRadius: 10, background: "#020617", color: "#f8fafc", padding: "8px 11px", font: "inherit" },
  selo: { border: "1px solid", borderRadius: 999, padding: "1px 9px", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" },
  tabelaCaixa: { overflowX: "auto" },
  tabela: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "6px 7px", color: "#94a3b8", borderBottom: "1px solid #334155", whiteSpace: "nowrap" },
  td: { padding: "6px 7px", borderBottom: "1px solid #1e293b", color: "#e2e8f0", whiteSpace: "nowrap", verticalAlign: "top" },
  aprovado: { background: "rgba(74,222,128,.08)" },
  link: { color: "#67e8f9" },
};
