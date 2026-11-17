// =============================================================
// PAIIA — Central do Paizinho: aba "Black Friday 2026".
// Uma tela só, UMA CONTA POR VEZ, com as etapas separadas:
//   1. Consultar (todos os anúncios ativos, com progresso e retomada)
//   2. Simular (10% Renault comprovada · 5% demais · nunca cumulativo)
//   3. Conferir (PRONTO · CONFERIR · BLOQUEADO, com o motivo)
//   4. Aprovar (só PRONTO, com margem verificada e não negativa)
//   5. Ativar: automático só quando a API do ML autorizar (hoje: bloqueado);
//      manual assistido pela planilha na Central de Promoções do ML.
//   6. Encerramento (30/11 23:59) e conferência dos preços normais em 01/12.
// Nada aqui altera preço, anúncio, estoque, Bling ou contas conectadas.
// Não mexe no Ranqueamento nem nas outras funções da Central.
// =============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import { CAMPANHA_BF, dataHoraBrasilia, diasParaInicio, momentoDaCampanha, conferirEncerramento, ofertasConfirmadasNoML } from "../services/blackFriday/calendario";
import { CONTAS_BLACK_FRIDAY, CLASSES, SITUACOES, ROTULO_CLASSE, custosDoPerfil, filtrarLinhas, resumirSimulacao } from "../services/blackFriday/regras";
import { lerContasBF, montarSimulacao, consultorBF, consultorCustoBF, agruparFalhas, explicarErro } from "../services/blackFriday/leitura";
import { roteadorBF, consultorLeituraBF } from "../services/blackFriday/leituraPermitida";
import { criarRegistroBF, chaveLeitura } from "../services/blackFriday/registro";
import { montarPlanilha, planilhaCSV, resumirPlanilha, classificarParaPlanilha, LISTAS, aprovavel } from "../services/blackFriday/planilha";
import { renovarAcessoConta } from "../services/blackFriday/aplicativoML";
import { montarCopiaPrecos, validarCopia, precosDaCopia, lerCopiaGuardada, guardarCopia } from "../services/blackFriday/precosOriginais";

const invocar = (nome, opcoes) => supabase.functions.invoke(nome, opcoes);
// (15/11) Promoções e catálogo pela função própria paizinho-bf-leitura (só leitura); o resto pela ml_consulta.
const consultorConta = (id) => roteadorBF({ principal: consultorBF(id, invocar), bf: consultorLeituraBF(id, invocar) });
const real = (v) => (v === null || v === undefined ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const pctTxt = (v) => (v === null || v === undefined ? "—" : `${String(v).replace(".", ",")}%`);
const COR_LISTA = { PRONTO: "#4ade80", CONFERIR: "#fbbf24", BLOQUEADO: "#f87171" };
const COR_CLASSE = { renault: "#facc15", demais: "#67e8f9", revisao: "#fb923c" };
// (16/11) Padrão: TODOS os anúncios ativos da conta (sem limite de 50).
const LIMITES = [["20000", "Todos os anúncios ativos"], ["200", "200 (teste)"], ["50", "50 (teste)"]];
const POR_PAGINA = 50;
const RE_403 = /policy returned UNAUTHORIZED|HTTP 403|\b403\b/i;

function lerPerfil() {
  try { return custosDoPerfil(JSON.parse(localStorage.getItem("paiiaPerfilCustos") || "null")); } catch { return custosDoPerfil(null); }
}
function lerLeituraGuardada(usuarioId, conta) {
  try {
    const r = JSON.parse(localStorage.getItem(chaveLeitura(usuarioId, conta)) || "null");
    // Só aceita a leitura se ela for mesmo desta conta (nunca mistura).
    return r?.contas?.[conta] ? r : null;
  } catch { return null; }
}

export default function BlackFridayPaizinho() {
  const [usuarioId, setUsuarioId] = useState("");
  const [erroLogin, setErroLogin] = useState("");
  // (16/11) Uma conta por vez: começa só com a 1ª da ordem (LOJA ONLINE).
  const [contas, setContas] = useState([CONTAS_BLACK_FRIDAY[0].id]);
  const [renovacao, setRenovacao] = useState(null);
  const [planilhaInfo, setPlanilhaInfo] = useState(null);
  const [custosForm, setCustosForm] = useState(null); // { imposto, pedido } em edição
  const [limite, setLimite] = useState("20000");
  const [progresso, setProgresso] = useState(null);
  const [lendo, setLendo] = useState("");
  const [leitura, setLeitura] = useState(null);
  const [simulado, setSimulado] = useState(false);
  const [versao, setVersao] = useState(0); // força reler plano/histórico
  const [aviso, setAviso] = useState("");
  const [filtro, setFiltro] = useState({ lista: "", classe: "", busca: "" });
  const [marcados, setMarcados] = useState(() => new Set());
  const [mostrar, setMostrar] = useState(POR_PAGINA);
  const [ocupado, setOcupado] = useState(false);
  const cancelar = useRef(false);
  // (17/11) Cada conta tem a sua leitura guardada: ao entrar e ao trocar de conta, carrega a dela.
  const contaRef = useRef(CONTAS_BLACK_FRIDAY[0].id);

  useEffect(() => {
    let vivo = true;
    const aplicar = (id) => {
      if (!vivo) return;
      setUsuarioId(id);
      if (!id) { setErroLogin("Entre no PAIIA para usar a Black Friday: use o botão \"Login\" no topo da página."); setLeitura(null); return; }
      setErroLogin("");
      setLeitura(lerLeituraGuardada(id, contaRef.current));
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

  // (16/11) Uma conta por vez: tudo abaixo é só da conta escolhida (nunca mistura).
  const contaAtual = contas[0] || "";
  const nomeConta = CONTAS_BLACK_FRIDAY.find((c) => c.id === contaAtual)?.nome || "";
  const leituraConta = leitura?.contas?.[contaAtual] || null;
  const podeRetomar = !!(leituraConta && leituraConta.completa === false);
  // (17/11) Cópia de segurança dos preços originais da conta (navegador + arquivo).
  const copia = useMemo(() => (usuarioId ? lerCopiaGuardada(localStorage, usuarioId, contaAtual) : null), [usuarioId, contaAtual, versao]); // eslint-disable-line react-hooks/exhaustive-deps
  const arquivoCopia = useRef(null);

  const linhas = useMemo(() => (simulado && leitura ? montarSimulacao(leitura, { decisoes: plano?.decisoes || {}, perfil }).filter((l) => l.conta === contaAtual) : []), [simulado, leitura, plano, perfil, contaAtual]);
  const listaDe = useMemo(() => new Map(linhas.map((l) => [l.chave, classificarParaPlanilha(l)])), [linhas]);
  const visiveis = useMemo(() => filtrarLinhas(linhas, { busca: filtro.busca, classe: filtro.classe }).filter((l) => !filtro.lista || listaDe.get(l.chave)?.lista === filtro.lista), [linhas, filtro, listaDe]);
  const resumo = useMemo(() => resumirSimulacao(linhas), [linhas]);
  const resumoListas = useMemo(() => resumirPlanilha(montarPlanilha(linhas, contaAtual)), [linhas, contaAtual]);
  const aprovados = useMemo(() => plano?.aprovados || {}, [plano]);
  const aprovadosConta = Object.values(aprovados).filter((a) => a.conta === contaAtual);
  const campanhaConta = useMemo(() => registro?.campanhasPorConta()?.[contaAtual] || null, [registro, versao, contaAtual]); // eslint-disable-line react-hooks/exhaustive-deps
  const momento = momentoDaCampanha();

  // (16/11) Caminho automático: só quando a API do ML autorizar. A própria leitura já mostra
  // (uma tentativa por consulta; 403 não é repetido).
  const promoBloqueada = !!leitura?.falhas?.some((f) => f.conta === nomeConta && f.etapa === "promoções" && RE_403.test(f.erro));
  const promoLiberada = !!leituraConta?.itens?.some((x) => x.promocoes?.lido);
  const confirmacao = useMemo(() => ofertasConfirmadasNoML({ aprovados, itens: leituraConta?.itens, conta: contaAtual }), [aprovados, leituraConta, contaAtual]);
  const encerramento = useMemo(() => (momento === "encerrada" && leituraConta ? conferirEncerramento({ aprovados, itens: leituraConta.itens, conta: contaAtual, lidoEm: leituraConta.lido_em || leitura?.lido_em, precos: copia ? precosDaCopia(copia) : null }) : null), [momento, leituraConta, leitura, aprovados, contaAtual, copia]);

  function alternarConta(id) {
    contaRef.current = id;
    setLeitura(usuarioId ? lerLeituraGuardada(usuarioId, id) : null); setSimulado(false); setProgresso(null);
    setContas([id]); setMarcados(new Set()); setPlanilhaInfo(null); setRenovacao(null); setAviso("");
  }

  async function consultar(retomar = false) {
    if (!registro) return;
    if (contas.length !== 1) { setAviso("Escolha uma conta."); return; }
    setAviso(""); setSimulado(false); setMarcados(new Set()); cancelar.current = false;
    setLendo(retomar ? "Retomando…" : "Começando…"); setProgresso(null);
    // (16/11) Guarda o parcial a cada 50 anúncios: se a página fechar, dá para retomar.
    const guardar = (r) => { try { localStorage.setItem(chaveLeitura(usuarioId, contaAtual), JSON.stringify(r)); return true; } catch { return false; } };
    registro.registrar(retomar ? "consulta_retomada" : "consulta_iniciada", { contas: nomeConta, limite: Number(limite) });
    try {
      const r = await lerContasBF({
        contas, limite: Number(limite),
        consultorDaConta: consultorConta,
        consultarCusto: consultorCustoBF(invocar),
        aoProgredir: (t, e) => { setLendo(t); if (e) setProgresso(e); },
        cancelado: () => cancelar.current,
        anterior: retomar ? leitura : null,
        aoParcial: (p) => { p.parcial = true; guardar(p); },
      });
      setLeitura(r);
      if (!guardar(r)) setAviso("Leitura grande demais para guardar neste navegador: fica só nesta tela (não dá para retomar se fechar).");
      // (17/11) Leitura completa antes de 27/11: grava a cópia de segurança dos preços originais.
      const rc = r.contas?.[contaAtual];
      if (rc && rc.completa !== false && momentoDaCampanha() === "preparacao") {
        const m = montarCopiaPrecos(rc);
        if (m.ok && guardarCopia(localStorage, usuarioId, m.copia)) registro.registrar("copia_precos", { conta: nomeConta, anuncios: m.copia.total, em_promocao: m.copia.em_promocao });
      }
      const lidos = Object.values(r.contas).reduce((s, c) => s + c.lidos, 0);
      registro.registrar("consulta_concluida", { contas: nomeConta, anuncios: lidos, falhas: r.falhas.length, interrompida: cancelar.current });
      // (15/11) Um registro por conta + etapa (com a quantidade), em vez de 1 por anúncio.
      for (const g of agruparFalhas(r.falhas)) registro.registrar("erro", { conta: g.conta, etapa: g.etapa, quantidade: g.quantidade, erro: g.erros.map((e) => `${e.erro} (${e.n})`).join(" | "), exemplo: r.falhas.find((f) => f.conta === g.conta && f.etapa === g.etapa)?.id || null });
    } catch (e) {
      setAviso(String(e?.message || e));
      registro.registrar("erro", { etapa: "consulta", erro: String(e?.message || e) });
    }
    setLendo(""); setVersao((v) => v + 1);
  }

  function simular() {
    if (!leitura || !registro) return;
    setSimulado(true); setMostrar(POR_PAGINA); setVersao((v) => v + 1);
    const l = montarSimulacao(leitura, { decisoes: plano?.decisoes || {}, perfil: lerPerfil() }).filter((x) => x.conta === contaAtual);
    const r = resumirSimulacao(l);
    registro.registrar("simulacao", { conta: nomeConta, anuncios: r.total, renault: r.renault, demais: r.demais, revisao: r.revisao, prejuizo: r.prejuizo, sem_margem: r.sem_margem });
    // Aprovação cujo preço ou situação mudou desde então sai do plano (nunca usa preço antigo).
    const { desatualizadas } = registro.conferirAprovacoes(l);
    setAviso(desatualizadas.length ? `${desatualizadas.length} aprovação(ões) ficaram desatualizadas (preço ou pendência mudou) e saíram do plano.` : "");
  }

  // (16/11) Renovar o acesso da conta pelo mecanismo oficial (refresh guardado; não é reconexão).
  async function renovarConta() {
    if (!window.confirm(`Renovar o acesso da conta ${nomeConta} ao Mercado Livre?\n\nUsa a renovação normal do PAIIA (a mesma da publicação), com a autorização que já existe. Não reconecta, não desconecta e não muda anúncios, preços ou estoque.`)) return;
    setOcupado(true); setRenovacao(null);
    try {
      const r = await renovarAcessoConta({ conta: contaAtual, invocar });
      setRenovacao(r);
      registro?.registrar("diagnostico", { renovacao: `${r.conta}: ${r.ok ? (r.renovado ? "renovado" : "já válido") : r.erro}` });
    } catch (e) { setAviso(String(e?.message || e)); }
    setOcupado(false);
  }

  // (16/11) Imposto e custo por pedido: o cadastro "Preços, Custos e Lucro" fica no
  // navegador, separado por endereço (o site oficial e o local não se enxergam). Aqui
  // grava SÓ neste navegador/endereço, no mesmo cadastro (paiiaPerfilCustos), sem apagar
  // os outros campos e sem tocar na produção.
  function salvarCustos() {
    const imposto = String(custosForm?.imposto ?? "").replace(",", ".").trim();
    const pedido = String(custosForm?.pedido ?? "").replace(",", ".").trim();
    if (imposto === "" || !Number.isFinite(Number(imposto)) || Number(imposto) < 0 || Number(imposto) > 50) { setAviso("Informe o imposto em % (entre 0 e 50), igual ao cadastrado no PAIIA oficial."); return; }
    if (pedido !== "" && (!Number.isFinite(Number(pedido)) || Number(pedido) < 0)) { setAviso("Custo por pedido inválido."); return; }
    let atual;
    try { atual = JSON.parse(localStorage.getItem("paiiaPerfilCustos") || "null") || {}; } catch { atual = {}; }
    try {
      localStorage.setItem("paiiaPerfilCustos", JSON.stringify({ ...atual, impostoPercentual: imposto, ...(pedido !== "" ? { custoOperacionalPedido: pedido } : {}) }));
      registro?.registrar("custos_locais", { imposto_pct: Number(imposto), custo_pedido: pedido === "" ? null : Number(pedido) });
      setCustosForm(null); setAviso(simulado ? "Imposto gravado neste navegador. Simulação atualizada." : "Imposto gravado neste navegador."); setVersao((v) => v + 1);
    } catch { setAviso("Não foi possível gravar neste navegador."); }
  }

  // (17/11) Cópia dos preços originais: baixar arquivo e carregar de volta (só neste navegador).
  function baixarCopia() {
    if (!copia) return;
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(copia, null, 1)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = `black-friday-2026-precos-originais-${nomeConta.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-")}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      registro?.registrar("copia_precos_baixada", { conta: nomeConta, anuncios: copia.total });
    } catch (e) { setAviso(`Não foi possível gerar o arquivo: ${e?.message || e}`); }
  }
  async function carregarCopia(ev) {
    const f = ev.target.files?.[0];
    ev.target.value = "";
    if (!f) return;
    let obj;
    try { obj = JSON.parse(await f.text()); } catch { setAviso("Arquivo inválido: não é a cópia de preços do PAIIA."); return; }
    const v = validarCopia(obj, contaAtual);
    if (!v.ok) { setAviso(v.motivo); return; }
    if (copia && !window.confirm(`Substituir a cópia guardada da ${nomeConta} (${copia.total} anúncios, gravada em ${new Date(copia.gravado_em).toLocaleString("pt-BR")}) pela do arquivo (${v.copia.total} anúncios, gravada em ${new Date(v.copia.gravado_em).toLocaleString("pt-BR")})?`)) return;
    if (!guardarCopia(localStorage, usuarioId, v.copia)) { setAviso("Não foi possível gravar neste navegador."); return; }
    registro?.registrar("copia_precos_carregada", { conta: nomeConta, anuncios: v.copia.total });
    setAviso(`Cópia dos preços originais da ${nomeConta} carregada (${v.copia.total} anúncios).`); setVersao((x) => x + 1);
  }

  // (16/11) Planilha para cadastro MANUAL na Central de Promoções do ML (só gera arquivo).
  function baixarPlanilha() {
    const planilha = montarPlanilha(linhas, contaAtual);
    if (!planilha.length) { setAviso(`Consulte e simule a ${nomeConta} antes de gerar a planilha.`); return; }
    const r = resumirPlanilha(planilha);
    try {
      const url = URL.createObjectURL(new Blob([planilhaCSV(planilha)], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url; a.download = `black-friday-2026-${nomeConta.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-")}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { setAviso(`Não foi possível gerar o arquivo: ${e?.message || e}`); }
    setPlanilhaInfo({ conta: nomeConta, resumo: r });
    registro?.registrar("planilha", { conta: nomeConta, total: r.total, pronto: r.pronto, conferir: r.conferir, bloqueado: r.bloqueado });
  }

  // (16/11) Aprovação da CAMPANHA da conta (só registra; nada é ativado).
  function aprovarCampanha() {
    if (!aprovadosConta.length) { setAviso(`Aprove primeiro as ofertas da ${nomeConta}.`); return; }
    if (!window.confirm(`Aprovar a CAMPANHA Black Friday da conta ${nomeConta}?\n\n${aprovadosConta.length} oferta(s) aprovada(s).\nPeríodo: ${dataHoraBrasilia(CAMPANHA_BF.inicio)} a ${dataHoraBrasilia(CAMPANHA_BF.fim)} (Brasília).\n\nSó registra a decisão desta conta. NENHUMA oferta é ativada e nenhum preço é alterado.`)) return;
    const r = registro.aprovarCampanhaConta(contaAtual, { nome: nomeConta });
    setAviso(r.ok ? `Campanha da ${nomeConta} aprovada (${r.campanha.ofertas} oferta(s)). Nada foi ativado.` : r.motivo);
    setVersao((v) => v + 1);
  }
  function retirarCampanha() {
    if (!window.confirm(`Retirar a aprovação da campanha da ${nomeConta}?`)) return;
    registro.retirarCampanhaConta(contaAtual); setVersao((v) => v + 1);
  }

  function decidir(l, decisao) {
    registro.decidir(l.conta, l.id, decisao);
    setVersao((v) => v + 1);
  }

  // (16/11) Aprovação SÓ de anúncios PRONTO, com margem verificada e não negativa. Sem exceção.
  function aprovar(lista, modo) {
    const aptas = lista.filter((l) => aprovavel(l));
    if (!aptas.length) { setAviso("Só anúncios PRONTO (sem pendência, com margem verificada e não negativa) podem ser aprovados."); return; }
    if (!window.confirm(`Registrar a APROVAÇÃO de ${aptas.length} anúncio(s) PRONTO da ${nomeConta}?\n\nPeríodo: ${dataHoraBrasilia(CAMPANHA_BF.inicio)} a ${dataHoraBrasilia(CAMPANHA_BF.fim)} (Brasília).\n\nSó registra o plano. NENHUMA oferta é ativada e nenhum preço é alterado.`)) return;
    const r = registro.aprovar(aptas, { modo });
    setAviso(`Aprovação registrada: ${r.aprovados.length} novo(s), ${r.ja_aprovados.length} já aprovado(s), ${r.recusados.length} não aprovado(s).`);
    setMarcados(new Set()); setVersao((v) => v + 1);
  }

  function desaprovar(chaves) {
    if (!chaves.length || !window.confirm(`Retirar a aprovação de ${chaves.length} anúncio(s)?`)) return;
    registro.desaprovar(chaves); setVersao((v) => v + 1);
  }

  const marcar = (k) => setMarcados((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const selecionadas = linhas.filter((l) => marcados.has(l.chave));
  const erros = historico.filter((h) => h.tipo === "erro");
  const falhasConta = (leitura?.falhas || []).filter((f) => f.conta === nomeConta);

  if (erroLogin) return <section style={S.caixa}><h2 style={S.titulo}>🛍️ Black Friday 2026</h2><div style={S.aviso}>{erroLogin}</div></section>;

  return (
    <section id="black-friday-paizinho" style={S.caixa} data-paiia-black-friday>
      <h2 style={S.titulo}>🛍️ Black Friday 2026</h2>
      <p style={S.sub}>Uma conta por vez: LOJA ONLINE → CIEBR → REVELAÇÃO. Consultar → Simular → Conferir → Aprovar → Ativar.</p>
      <div style={S.trava}>🔒 <strong>Simulação.</strong> Nenhuma oferta é ativada e nenhum preço, anúncio, estoque ou Bling é alterado. Descontos: <strong>10%</strong> Renault comprovada · <strong>5%</strong> demais · nunca cumulativos · calculados sobre o preço original confirmado.</div>

      <div style={S.calendario}>
        <Kpi rotulo="Início" valor={dataHoraBrasilia(CAMPANHA_BF.inicio)} />
        <Kpi rotulo="Encerramento" valor={dataHoraBrasilia(CAMPANHA_BF.fim)} />
        <Kpi rotulo="Conferência dos preços normais" valor="01/12/2026" />
        <Kpi rotulo={momento === "preparacao" ? "Faltam" : "Situação"} valor={momento === "preparacao" ? `${diasParaInicio()} dia(s)` : momento === "em_andamento" ? "Em andamento" : "Encerrada"} />
      </div>

      {/* 1. Conta e consulta */}
      <h3 style={S.h3}>1. Conta e consulta</h3>
      <div style={S.acoes}>
        {CONTAS_BLACK_FRIDAY.map((c) => (
          <label key={c.id} style={{ ...S.filtro, ...(contas.includes(c.id) ? S.filtroAtivo : {}) }}>
            <input type="radio" name="bf-conta" checked={contas.includes(c.id)} onChange={() => alternarConta(c.id)} disabled={!!lendo} /> {c.nome}
          </label>
        ))}
        <select value={limite} onChange={(e) => setLimite(e.target.value)} style={{ ...S.busca, flex: "0 1 220px" }} disabled={!!lendo} aria-label="Quantidade de anúncios">
          {LIMITES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </div>
      <div style={S.acoes}>
        <button type="button" style={S.botao} onClick={() => consultar(false)} disabled={!!lendo || !contas.length} data-paiia-bf="consultar">{lendo ? `🔄 ${lendo}` : `🔎 Consultar ${nomeConta}`}</button>
        {!lendo && podeRetomar && <button type="button" style={S.botao} onClick={() => consultar(true)}>⏯️ Retomar consulta ({leituraConta.lidos} já lidos)</button>}
        {lendo && <button type="button" style={S.filtro} onClick={() => { cancelar.current = true; }}>Parar leitura</button>}
      </div>
      <small style={S.base}>Só leitura no Mercado Livre e no Bling. Mantenha a página aberta durante a leitura e não use "Sair".</small>
      {progresso && <div style={S.kpis}>
        <Kpi rotulo="Encontrados" valor={progresso.total ?? "…"} />
        <Kpi rotulo="Na consulta" valor={progresso.alvo || "…"} />
        <Kpi rotulo="Consultados" valor={progresso.consultados} />
        <Kpi rotulo="Com sucesso" valor={progresso.sucesso} cor="#4ade80" />
        <Kpi rotulo="Com erro" valor={progresso.erros} cor="#f87171" />
        {progresso.reaproveitados > 0 && <Kpi rotulo="Reaproveitados" valor={progresso.reaproveitados} />}
      </div>}
      {leituraConta?.erros_anuncio?.length > 0 && <details style={S.nota}><summary>{leituraConta.erros_anuncio.length} anúncio(s) com erro na leitura — ver motivos (use "Retomar" para tentar só esses)</summary><ul style={S.lista}>{leituraConta.erros_anuncio.slice(0, 50).map((e) => <li key={e.id}><small>{e.id}: {e.erro}</small></li>)}</ul></details>}
      {leituraConta
        ? <p style={S.nota}>Última leitura da {nomeConta}: {new Date(leituraConta.lido_em || leitura.lido_em).toLocaleString("pt-BR")} · {leituraConta.lidos}{leituraConta.total_ativos ? ` de ${leituraConta.total_ativos}` : ""} anúncios ativos{leituraConta.completa === false ? " · INCOMPLETA (retome)" : ""}{leitura.bling_parou ? " · Bling parou de responder (custos incompletos)" : ""}.</p>
        : leitura && <p style={S.nota}>A última leitura guardada é de outra conta. Consulte a {nomeConta}.</p>}
      <div style={copia ? S.nota : S.aviso}>
        <strong>💾 Preços originais da {nomeConta} (cópia de segurança):</strong>{" "}
        {copia
          ? <>gravada em {new Date(copia.gravado_em).toLocaleString("pt-BR")} · {copia.total} anúncio(s){copia.em_promocao ? ` · ${copia.em_promocao} já em promoção na leitura (guardado o preço normal)` : ""}. É a referência da conferência de 01/12. Baixe o arquivo e guarde fora do navegador.</>
          : <>ainda não gravada. Ela é gravada sozinha quando a consulta da conta termina completa, antes de {dataHoraBrasilia(CAMPANHA_BF.inicio)}.</>}
        <div style={S.acoes}>
          {!copia && leituraConta && leituraConta.completa !== false && momento === "preparacao" && <button type="button" style={S.mini} onClick={() => {
            const m = montarCopiaPrecos(leituraConta);
            if (!m.ok) { setAviso(m.motivo); return; }
            if (!guardarCopia(localStorage, usuarioId, m.copia)) { setAviso("Não foi possível gravar neste navegador."); return; }
            registro?.registrar("copia_precos", { conta: nomeConta, anuncios: m.copia.total, em_promocao: m.copia.em_promocao });
            setVersao((x) => x + 1);
          }}>💾 Gravar a partir da última leitura</button>}
          <button type="button" style={S.mini} disabled={!copia} onClick={baixarCopia}>📥 Baixar cópia dos preços</button>
          <button type="button" style={S.mini} onClick={() => arquivoCopia.current?.click()}>📤 Carregar cópia de um arquivo</button>
          <input ref={arquivoCopia} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={carregarCopia} aria-label="Arquivo da cópia de preços" />
        </div>
      </div>
      <div style={perfil.impostoPct === null ? S.aviso : S.nota}>
        <strong>Custos da venda usados na margem:</strong> imposto {perfil.impostoPct === null ? <strong>NÃO cadastrado neste endereço</strong> : <strong>{String(perfil.impostoPct).replace(".", ",")}%</strong>} · custo por pedido R$ {String(perfil.custoPedido.toFixed(2)).replace(".", ",")} · comissão e frete: lidos do Mercado Livre · custo da peça: Bling (nunca inventado).
        {perfil.impostoPct === null && <><br /><small>O cadastro "Preços, Custos e Lucro" fica no navegador e é separado por endereço: o do PAIIA oficial não aparece aqui. Sem imposto, a margem não é verificável e nenhum anúncio fica PRONTO.</small></>}
        {!custosForm ? <> <button type="button" style={S.mini} onClick={() => setCustosForm({ imposto: perfil.impostoPct ?? "", pedido: perfil.custoPedido || "" })}>{perfil.impostoPct === null ? "Informar imposto" : "Alterar"}</button></>
          : <div style={S.acoes}>
            <input value={custosForm.imposto} onChange={(e) => setCustosForm({ ...custosForm, imposto: e.target.value.replace(/[^\d,.]/g, "") })} placeholder="Imposto % (igual ao oficial)" style={{ ...S.busca, flex: "0 1 200px" }} aria-label="Imposto em %" />
            <input value={custosForm.pedido} onChange={(e) => setCustosForm({ ...custosForm, pedido: e.target.value.replace(/[^\d,.]/g, "") })} placeholder="Custo por pedido R$ (opcional)" style={{ ...S.busca, flex: "0 1 220px" }} aria-label="Custo por pedido" />
            <button type="button" style={S.botao} onClick={salvarCustos}>Gravar neste navegador</button>
            <button type="button" style={S.filtro} onClick={() => setCustosForm(null)}>Cancelar</button>
            <small style={S.base}>Copie os valores de Preços, Custos e Lucro do PAIIA oficial. Não altera a produção.</small>
          </div>}
      </div>
      {aviso && <div style={S.aviso}>{aviso}</div>}

      {/* 2. Simulação */}
      <h3 style={S.h3}>2. Simulação</h3>
      <div style={S.acoes}>
        <button type="button" style={S.botao} onClick={simular} disabled={!!lendo || !leituraConta} data-paiia-bf="simular">🧮 Simular {nomeConta}</button>
      </div>
      {simulado && <div style={S.kpis}>
        <Kpi rotulo="Anúncios" valor={resumo.total} />
        <Kpi rotulo="PRONTO" valor={resumoListas.pronto} cor={COR_LISTA.PRONTO} />
        <Kpi rotulo="CONFERIR" valor={resumoListas.conferir} cor={COR_LISTA.CONFERIR} />
        <Kpi rotulo="BLOQUEADO" valor={resumoListas.bloqueado} cor={COR_LISTA.BLOQUEADO} />
        <Kpi rotulo="Renault (10%)" valor={resumo.renault} cor={COR_CLASSE.renault} />
        <Kpi rotulo="Demais (5%)" valor={resumo.demais} cor={COR_CLASSE.demais} />
        <Kpi rotulo="Dúvida Renault" valor={resumo.revisao} cor={COR_CLASSE.revisao} />
        <Kpi rotulo="Prejuízo" valor={resumo.prejuizo} cor="#f87171" />
        <Kpi rotulo="Margem não verificável" valor={resumo.sem_margem} cor="#fb923c" />
      </div>}

      {/* 3. Conferir */}
      {simulado && <>
        <h3 style={S.h3}>3. Conferir</h3>
        {resumoListas.pendencias.length > 0 && <details style={S.nota}><summary>Pendências mais comuns</summary><ul style={S.lista}>{resumoListas.pendencias.slice(0, 10).map((p) => <li key={p.motivo}><small><strong>{p.quantidade}</strong> · {p.motivo}</small></li>)}</ul></details>}
        <div style={S.acoes}>
          <select value={filtro.lista} onChange={(e) => { setFiltro({ ...filtro, lista: e.target.value }); setMostrar(POR_PAGINA); }} style={{ ...S.busca, flex: "0 1 170px" }} aria-label="Lista">
            <option value="">PRONTO, CONFERIR e BLOQUEADO</option>{Object.values(LISTAS).map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <select value={filtro.classe} onChange={(e) => { setFiltro({ ...filtro, classe: e.target.value }); setMostrar(POR_PAGINA); }} style={{ ...S.busca, flex: "0 1 170px" }} aria-label="Classe">
            <option value="">Todas as classes</option>{Object.values(CLASSES).map((c) => <option key={c} value={c}>{ROTULO_CLASSE[c]}</option>)}
          </select>
          <input value={filtro.busca} onChange={(e) => { setFiltro({ ...filtro, busca: e.target.value }); setMostrar(POR_PAGINA); }} placeholder="Buscar MLB, SKU ou título" style={S.busca} />
        </div>

        <div style={S.tabelaCaixa}>
          <table style={S.tabela}>
            <thead><tr>{["", "Anúncio", "Classe", "Preço original", "Desc.", "Preço promocional", "Comissão · imposto · frete", "Lucro (margem)", "Lista e motivo", "Ação"].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {visiveis.slice(0, mostrar).map((l) => {
                const aprovado = !!aprovados[l.chave];
                const cl = listaDe.get(l.chave) || { lista: "", pendencias: [], observacoes: [] };
                return (
                  <tr key={l.chave} style={aprovado ? S.aprovado : undefined}>
                    <td style={S.td}><input type="checkbox" checked={marcados.has(l.chave)} disabled={!aprovavel(l) || aprovado} onChange={() => marcar(l.chave)} aria-label={`Marcar ${l.id}`} /></td>
                    <td style={{ ...S.td, whiteSpace: "normal", minWidth: 220 }}>
                      <a href={l.link} target="_blank" rel="noreferrer" style={S.link}>{l.id}</a>{l.sku ? ` · ${l.sku}` : ""}<br /><small style={S.base}>{l.titulo}</small>
                    </td>
                    <td style={{ ...S.td, whiteSpace: "normal" }} title={[...l.evidencias, l.duvida].filter(Boolean).join("\n")}>
                      <span style={{ ...S.selo, color: COR_CLASSE[l.classe], borderColor: COR_CLASSE[l.classe] }}>{ROTULO_CLASSE[l.classe]}</span>
                      {l.decisao && l.decisao !== "excluir" && <small style={S.base}> (manual)</small>}
                    </td>
                    <td style={S.td}>{real(l.preco_original)}</td>
                    <td style={S.td}>{l.classe === CLASSES.REVISAO && !l.decisao ? "a decidir" : `${l.desconto_pct}%`}</td>
                    <td style={S.td}>{real(l.preco_final)}</td>
                    <td style={{ ...S.td, whiteSpace: "normal" }}><small>{real(l.tarifa)} · {real(l.imposto)} · {real(l.frete)}</small></td>
                    <td style={{ ...S.td, whiteSpace: "normal", minWidth: 130, color: l.lucro !== null && l.lucro < 0 ? "#f87171" : undefined }} title={`Preço ${real(l.preco_final)} − comissão ${real(l.tarifa)} − frete ${real(l.frete)} − imposto ${real(l.imposto)} − custo/pedido ${real(l.custo_pedido)}${l.custo !== null ? ` − custo ${real(l.custo)} = ${real(l.lucro)}` : ` = sobra ${real(l.repasse)} para a peça`}`}>
                      {l.margem_pct !== null ? `${real(l.lucro)} (${pctTxt(l.margem_pct)})` : <><span>custo não confirmado</span>{l.repasse !== null && <><br /><small style={S.base}>Sobra p/ peça: {real(l.repasse)}</small></>}</>}
                    </td>
                    <td style={{ ...S.td, whiteSpace: "normal", minWidth: 220 }}>
                      <span style={{ ...S.selo, color: COR_LISTA[cl.lista], borderColor: COR_LISTA[cl.lista] }}>{aprovado ? "Aprovado (plano)" : cl.lista}</span>
                      {cl.pendencias.map((m, i) => <div key={i}><small style={S.base}>• {m}</small></div>)}
                      {cl.observacoes.map((m, i) => <div key={`o${i}`}><small style={{ ...S.base, opacity: 0.7 }}>ℹ {m}</small></div>)}
                    </td>
                    <td style={{ ...S.td, whiteSpace: "normal" }}>
                      {aprovado
                        ? <button type="button" style={S.mini} onClick={() => desaprovar([l.chave])}>Retirar</button>
                        : aprovavel(l) && <button type="button" style={S.mini} onClick={() => aprovar([l], "anuncio")}>Aprovar</button>}
                      {(l.classe === CLASSES.REVISAO || l.decisao) && l.situacao !== SITUACOES.BLOQUEADO && l.decisao !== "excluir" && <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                        <button type="button" style={S.mini} onClick={() => decidir(l, "renault")} title="Só se a aplicação Renault estiver comprovada">Renault 10%</button>
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

        {/* 4. Aprovar */}
        <h3 style={S.h3}>4. Aprovar</h3>
        <p style={S.nota}>Só anúncios <strong>PRONTO</strong> (sem pendência, margem verificada e não negativa). CONFERIR precisa ser resolvido antes; BLOQUEADO não entra.</p>
        <div style={S.acoes}>
          <span style={S.base}>{visiveis.length} anúncio(s) no filtro · {selecionadas.length} marcado(s)</span>
          <button type="button" style={S.botao} disabled={!selecionadas.length} onClick={() => aprovar(selecionadas, "selecao")}>✅ Aprovar marcados</button>
          <button type="button" style={S.botao} disabled={!visiveis.some((l) => aprovavel(l) && !aprovados[l.chave])} onClick={() => aprovar(visiveis, "lote")}>✅ Aprovar todos os PRONTO do filtro</button>
        </div>
        <p style={S.nota}>Ofertas aprovadas da {nomeConta}: <strong>{aprovadosConta.length}</strong> · Campanha da conta: {!campanhaConta ? "não aprovada" : campanhaConta.valida ? `✅ aprovada em ${dataHoraBrasilia(campanhaConta.aprovado_em)} (${campanhaConta.ofertas} oferta(s))` : "⚠️ desatualizada (as ofertas mudaram depois) — aprove de novo"}
          {" "}{campanhaConta ? <button type="button" style={S.mini} onClick={retirarCampanha}>Retirar</button> : <button type="button" style={S.mini} disabled={!aprovadosConta.length} onClick={aprovarCampanha}>Aprovar campanha da {nomeConta}</button>}</p>
      </>}

      {/* 5. Ativar */}
      <h3 style={S.h3}>5. Ativar</h3>
      <p style={S.nota}><strong>Automático (API do Mercado Livre):</strong> {promoLiberada ? "o ML respondeu às promoções nesta leitura. A ativação automática ainda depende da sua autorização expressa." : promoBloqueada ? <>bloqueado — o ML recusou as promoções desta conta (HTTP 403: o aplicativo não tem a permissão "Promoções, cupons e descontos"). A tentativa não é repetida; a próxima consulta mostra se foi liberado.</> : "consulte a conta para saber se o ML libera as promoções."}</p>
      <div style={S.acoes}>
        <button type="button" style={{ ...S.botao, opacity: 0.5, cursor: "not-allowed" }} disabled title="Liberado só na Fase 3, com autorização expressa e permissão de promoções no ML">🚀 Ativar ofertas aprovadas</button>
      </div>
      <p style={S.nota}><strong>Manual assistido:</strong> baixe a planilha da {nomeConta} (PRONTO, CONFERIR e BLOQUEADO, com custos, comissão, imposto, frete, lucro, margem e motivo) e cadastre as ofertas PRONTO como "Desconto individual" na Central de Promoções do ML, de {dataHoraBrasilia(CAMPANHA_BF.inicio)} a {dataHoraBrasilia(CAMPANHA_BF.fim)}. Regras do ML: produto novo, anúncio pago, desconto de 5% a 80%, até 14 dias.</p>
      <div style={S.acoes}>
        <button type="button" style={S.botao} disabled={!linhas.length} onClick={baixarPlanilha}>📥 Planilha {nomeConta}</button>
      </div>
      {planilhaInfo && planilhaInfo.conta === nomeConta && <p style={S.nota}>
        <strong>Planilha {planilhaInfo.conta}:</strong> {planilhaInfo.resumo.total} anúncio(s) · <strong>{planilhaInfo.resumo.pronto} PRONTO</strong> · {planilhaInfo.resumo.conferir} CONFERIR · {planilhaInfo.resumo.bloqueado} BLOQUEADO · Renault 10%: {planilhaInfo.resumo.renault10} · Demais 5%: {planilhaInfo.resumo.demais5} · Dúvida: {planilhaInfo.resumo.revisao}. PRONTO: de {real(planilhaInfo.resumo.soma_atual)} para {real(planilhaInfo.resumo.soma_promocional)} (soma dos preços).
      </p>}
      <p style={S.nota}>Confirmadas no Mercado Livre: <strong>{confirmacao.confirmadas.length}</strong> de {confirmacao.aprovadas} aprovada(s). Só conta como ativa a oferta cujo preço com desconto foi LIDO no ML numa consulta (a partir de {dataHoraBrasilia(CAMPANHA_BF.inicio)}); nada é marcado como publicado sem essa confirmação.</p>

      {/* 6. Encerramento */}
      <h3 style={S.h3}>6. Encerramento</h3>
      <p style={S.nota}>As ofertas terminam em {dataHoraBrasilia(CAMPANHA_BF.fim)} (Brasília) pela data de fim da própria oferta no ML; o PAIIA não troca preços. Em 01/12, consulte a {nomeConta} de novo: a conferência compara cada oferta aprovada com o preço original confirmado e só aponta diferenças — nunca sobrescreve preços.</p>
      {momento !== "encerrada" && <small style={S.base}>Disponível depois de {dataHoraBrasilia(CAMPANHA_BF.fim)}.</small>}
      {encerramento && (!encerramento.valida ? <p style={S.nota}>{encerramento.motivo}</p> : <>
        <p style={S.nota}>Conferência da {nomeConta} (referência: {encerramento.referencia}):{encerramento.resumo.normal} no preço normal · {encerramento.resumo.com_desconto} ainda com desconto · {encerramento.resumo.diferente} com preço diferente · {encerramento.resumo.nao_lido} não lido(s).</p>
        <ul style={S.lista}>{encerramento.linhas.filter((x) => x.estado !== "normal").slice(0, 100).map((x) => <li key={x.item}><small>{x.item}: {x.texto}</small></li>)}</ul>
      </>)}

      {/* Diagnóstico (só se algo falhar) */}
      <details style={{ ...S.nota, marginTop: 22 }}>
        <summary>Diagnóstico e histórico ({falhasConta.length} leitura(s) com falha · {erros.length} erro(s) registrados)</summary>
        {falhasConta.length > 0 && <ul style={S.lista}>{agruparFalhas(falhasConta).slice(0, 15).map((g) => <li key={`${g.conta}-${g.etapa}`}><small><strong>{g.etapa}: {g.quantidade}</strong>{g.erros.map((e) => ` — "${e.erro}" (${e.n})${explicarErro(e.erro) ? ` → ${explicarErro(e.erro)}` : ""}`).join("")}</small></li>)}</ul>}
        <div style={S.acoes}>
          <button type="button" style={S.filtro} onClick={renovarConta} disabled={ocupado || !!lendo} title="Só se a leitura disser que o acesso venceu (401). Renovação normal, com a autorização que já existe (não é reconexão).">{ocupado ? "🔄 …" : `🔑 Renovar acesso da ${nomeConta}`}</button>
        </div>
        {renovacao && <div style={renovacao.ok ? S.nota : S.aviso}>
          <strong>{renovacao.ok ? `✅ Acesso da ${renovacao.conta} ${renovacao.renovado ? "renovado" : "já estava válido"}${renovacao.valido_ate ? ` até ${dataHoraBrasilia(renovacao.valido_ate)}` : ""}.` : `❌ ${renovacao.conta}: ${renovacao.erro}`}</strong>
          {!renovacao.ok && renovacao.precisa_reconectar && <><br /><small>O ML recusou a autorização guardada: é preciso reconectar esta conta pelo site oficial (www.paiia.com.br → Contas Marketplace), com a sua autorização.</small></>}
        </div>}
        {!historico.length ? <p style={S.nota}>Nenhuma operação registrada ainda.</p> : <>
          <p style={S.nota}>{historico.length} registro(s). Guardado só neste navegador, para o seu usuário.</p>
          <ul style={S.lista}>{historico.slice(0, 30).map((h) => <li key={h.id}><small>{new Date(h.quando).toLocaleString("pt-BR")} · <strong>{h.tipo}</strong>{h.conta ? ` · ${h.conta}` : h.contas ? ` · ${h.contas}` : ""}{h.etapa ? ` · ${h.etapa}` : ""}{h.quantidade ? ` · ${h.quantidade} anúncio(s)` : ""}{h.item ? ` · ${h.item}` : h.exemplo ? ` · ex.: ${h.exemplo}` : ""}{h.erro ? ` · ${h.erro}` : ""}{h.anuncios !== undefined ? ` · ${h.anuncios} anúncios` : ""}{h.aprovados !== undefined ? ` · ${h.aprovados} aprovado(s)` : ""}{h.decisao ? ` · ${h.decisao}` : ""}</small></li>)}</ul>
        </>}
      </details>
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
