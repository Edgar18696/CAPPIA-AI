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
import { supabase, ambienteSupabase, temAcessoDeTeste, entrarNoTeste } from "../supabase";
import { armazenamentoCompartilhado, ouvirErrosDoBanco } from "../services/promocoes/armazenamentoSupabase";
import { montarLeituraExemplo } from "../services/promocoes/anunciosExemplo";
import { CAMPANHA_BF, dataHoraBrasilia, diasParaInicio, momentoDaCampanha, conferirEncerramento, ofertasConfirmadasNoML } from "../services/blackFriday/calendario";
import { CONTAS_BLACK_FRIDAY, CLASSES, SITUACOES, ROTULO_CLASSE, ROTULO_FAIXA, custosDoPerfil, filtrarLinhas, resumirSimulacao } from "../services/blackFriday/regras";
import { lerContasBF, montarSimulacao, consultorBF, consultorCustoBF, consultorUltimasComprasBF, agruparFalhas, explicarErro } from "../services/blackFriday/leitura";
import { roteadorBF, consultorLeituraBF } from "../services/blackFriday/leituraPermitida";
import { criarRegistroBF, chaveLeitura } from "../services/blackFriday/registro";
import { montarPlanilha, planilhaCSV, resumirPlanilha, classificarParaPlanilha, LISTAS, aprovavel, selecionavel } from "../services/blackFriday/planilha";
import { renovarAcessoConta } from "../services/blackFriday/aplicativoML";
import { montarCopiaPrecos, validarCopia, precosDaCopia, lerCopiaGuardada, guardarCopia } from "../services/blackFriday/precosOriginais";
import { criarSelecao, adaptadorLocal, sugerirAnuncios, chaveItemSelecao, EVENTO_SELECAO } from "../services/promocoes/selecao";
import { METAS_SELECAO, CONTA_PRINCIPAL, OPCOES_DESCONTO, REGRAS, CAMPANHA_BLACK_FRIDAY, armazemCampanhas, campanhaPorId, descontoDoAnuncio, dataLocalParaIso, isoParaDataLocal, CONTAS_PROMOCOES } from "../services/promocoes/campanhas";

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
// (18/11) Pendências que são só "falta custo/imposto para calcular a margem".
const RE_MARGEM = /margem n[ãa]o verific|imposto n[ãa]o (informado|cadastrado)|custo n[ãa]o (informado|lido|confirmado|encontrado)|custo cadastrado ausente|comiss[ãa]o n[ãa]o confirmada|tarifa de venda do ML no pre[çc]o final n[ãa]o lida|frete no pre[çc]o final n[ãa]o confirmado/i;
// (18/11) Faixas de margem (giro de estoque): cor do aviso.
const COR_FAIXA = { meta: "#86efac", estrategica: "#fbbf24", excepcional: "#f87171" };

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
  // (18/11) Uma conta por vez: começa pela conta principal (REVELAÇÃO); LOJA ONLINE e CIEBR continuam disponíveis.
  const [contas, setContas] = useState([CONTA_PRINCIPAL]);
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
  const [filtro, setFiltro] = useState({ lista: "", classe: "", busca: "", sel: "" });
  const [marcados, setMarcados] = useState(() => new Set());
  const [mostrar, setMostrar] = useState(POR_PAGINA);
  const [ocupado, setOcupado] = useState(false);
  const [metaOutra, setMetaOutra] = useState(null); // meta personalizada em edição
  // (18/11) Central de Promoções: campanha escolhida (Black Friday 2026 = regra fixa; rascunhos = percentual).
  const [campanhaId, setCampanhaId] = useState(CAMPANHA_BLACK_FRIDAY.id);
  const [formCampanha, setFormCampanha] = useState(null); // nova/editar campanha
  const [pctProduto, setPctProduto] = useState({}); // edição do desconto individual por anúncio
  const [abertos, setAbertos] = useState(() => new Set()); // anúncios com "Detalhes" abertos
  const [gerenciar, setGerenciar] = useState(false); // (18/11) editor de campanhas fechado por padrão
  const cancelar = useRef(false);
  // (17/11) Cada conta tem a sua leitura guardada: ao entrar e ao trocar de conta, carrega a dela.
  const contaRef = useRef(CONTA_PRINCIPAL);

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
  // (17/11) Central de Promoções: seleção dos anúncios da campanha (usuário + campanha + conta + MLB).
  // (18/11) No MODO DE TESTE (STAGING) grava no banco de teste; na produção, ainda no navegador
  // (as tabelas da produção dependem de autorização).
  const NO_BANCO = ambienteSupabase === "staging";
  const [banco, setBanco] = useState(null);
  useEffect(() => {
    if (!NO_BANCO || !usuarioId) return undefined;
    let vivo = true;
    armazenamentoCompartilhado({ supabase, usuarioId })
      .then((a) => { if (vivo) { setBanco(a); setVersao((v) => v + 1); } })
      .catch((e) => vivo && setAviso(`Não foi possível ler a Central de Promoções no banco de teste: ${e?.message || e}`));
    const parar = ouvirErrosDoBanco((m) => vivo && setAviso(m));
    return () => { vivo = false; parar(); };
  }, [NO_BANCO, usuarioId]);
  const armazem = useMemo(() => (!usuarioId ? null : NO_BANCO ? (banco ? armazemCampanhas(banco.storageCampanhas, usuarioId) : null) : armazemCampanhas(localStorage, usuarioId)), [usuarioId, NO_BANCO, banco]);
  const campanhas = useMemo(() => (armazem ? armazem.todas() : [CAMPANHA_BLACK_FRIDAY]), [armazem, versao]); // eslint-disable-line react-hooks/exhaustive-deps
  const campanha = campanhaPorId(campanhaId, campanhas) || CAMPANHA_BLACK_FRIDAY;
  const ehBF = campanha.regra !== REGRAS.PERCENTUAL;
  const selecao = useMemo(() => (!usuarioId || (NO_BANCO && !banco) ? null : criarSelecao({ adaptador: NO_BANCO ? banco.adaptadorSelecao : adaptadorLocal(localStorage), usuarioId, campanhaId: campanha.id, campanhas })), [usuarioId, NO_BANCO, banco, campanha.id, campanhas]);
  // O Ranqueamento ("Enviar para Promoções") avisa quando inclui: a lista aqui acompanha.
  useEffect(() => {
    const atualizar = () => setVersao((v) => v + 1);
    window.addEventListener(EVENTO_SELECAO, atualizar);
    return () => window.removeEventListener(EVENTO_SELECAO, atualizar);
  }, []);
  const perfil = useMemo(() => lerPerfil(), [versao]); // eslint-disable-line react-hooks/exhaustive-deps

  // (16/11) Uma conta por vez: tudo abaixo é só da conta escolhida (nunca mistura).
  const contaAtual = contas[0] || "";
  const nomeConta = CONTAS_BLACK_FRIDAY.find((c) => c.id === contaAtual)?.nome || "";
  const leituraConta = leitura?.contas?.[contaAtual] || null;
  const podeRetomar = !!(leituraConta && leituraConta.completa === false);
  // (17/11) Cópia de segurança dos preços originais da conta (navegador + arquivo).
  const copia = useMemo(() => (usuarioId ? lerCopiaGuardada(localStorage, usuarioId, contaAtual) : null), [usuarioId, contaAtual, versao]); // eslint-disable-line react-hooks/exhaustive-deps
  const arquivoCopia = useRef(null);

  const selConta = useMemo(() => (selecao ? selecao.mapa(contaAtual) : new Map()), [selecao, contaAtual, versao]); // eslint-disable-line react-hooks/exhaustive-deps
  // (18/11) Desconto da campanha percentual (ou do produto); null = regra fixa da Black Friday.
  const descontoDe = useMemo(() => (ehBF ? null : (conta, id) => descontoDoAnuncio(campanha, selConta.get(chaveItemSelecao(conta, id)))), [ehBF, campanha, selConta]);
  const linhas = useMemo(() => (simulado && leitura ? montarSimulacao(leitura, { decisoes: plano?.decisoes || {}, perfil, descontoDe }).filter((l) => l.conta === contaAtual) : []), [simulado, leitura, plano, perfil, contaAtual, descontoDe]);
  const listaDe = useMemo(() => new Map(linhas.map((l) => [l.chave, classificarParaPlanilha(l)])), [linhas]);
  const visiveisBase = useMemo(() => filtrarLinhas(linhas, { busca: filtro.busca, classe: filtro.classe }).filter((l) => !filtro.lista || listaDe.get(l.chave)?.lista === filtro.lista), [linhas, filtro, listaDe]);
  const resumo = useMemo(() => resumirSimulacao(linhas), [linhas]);
  const resumoListas = useMemo(() => resumirPlanilha(montarPlanilha(linhas, contaAtual)), [linhas, contaAtual]);
  const aprovados = useMemo(() => plano?.aprovados || {}, [plano]);
  const aprovadosConta = Object.values(aprovados).filter((a) => a.conta === contaAtual);
  const campanhaConta = useMemo(() => registro?.campanhasPorConta()?.[contaAtual] || null, [registro, versao, contaAtual]); // eslint-disable-line react-hooks/exhaustive-deps
  const momento = momentoDaCampanha();
  const metaConta = useMemo(() => selecao?.meta(contaAtual) ?? null, [selecao, contaAtual, versao]); // eslint-disable-line react-hooks/exhaustive-deps
  const regSel = (l) => selConta.get(chaveItemSelecao(l.conta, l.id)) || null;
  // Aprovação: só anúncio SELECIONADO, sem "Revisão necessária" e PRONTO (regra de sempre).
  const aprovavelNaCampanha = (l) => { const r = regSel(l); return !!r && !r.revisao && aprovavel(l); };
  const visiveis = useMemo(() => visiveisBase.filter((l) => {
    const r = selConta.get(chaveItemSelecao(l.conta, l.id));
    return !filtro.sel || (filtro.sel === "sim" && !!r) || (filtro.sel === "nao" && !r) || (filtro.sel === "revisao" && !!r?.revisao);
  }), [visiveisBase, filtro.sel, selConta]);
  const linhasSel = useMemo(() => linhas.filter((l) => selConta.has(chaveItemSelecao(l.conta, l.id))), [linhas, selConta]);
  const resumoSel = useMemo(() => {
    const r = { total: selConta.size, lidos: linhasSel.length, revisao: 0, renault: 0, demais: 0, duvida: 0, prejuizo: 0, sem_margem: 0, margem_baixa: 0, soma_original: 0, soma_promocional: 0 };
    for (const x of selConta.values()) if (x.revisao) r.revisao++;
    for (const l of linhasSel) {
      if (l.classe === CLASSES.RENAULT) r.renault++; else if (l.classe === CLASSES.DEMAIS) r.demais++; else r.duvida++;
      if (l.lucro !== null && l.lucro < 0) r.prejuizo++;
      else if (l.margem_pct === null) r.sem_margem++;
      else if (l.alertas?.some((a) => /Margem de/.test(a))) r.margem_baixa++;
      r.soma_original += Number(l.preco_original) || 0; r.soma_promocional += Number(l.preco_final) || 0;
    }
    return r;
  }, [selConta, linhasSel]);

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
        consultarUltimasCompras: consultorUltimasComprasBF(invocar),
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

  // (18/11) Simulação automática: roda sozinha quando a consulta termina e quando a leitura
  // guardada da conta é carregada (o botão "Simular" saiu). Os efeitos continuam os mesmos:
  // registra a simulação, confere aprovações desatualizadas e marca "Revisão necessária".
  function simular() {
    if (!leitura || !registro) return;
    setSimulado(true); setMostrar(POR_PAGINA); setVersao((v) => v + 1);
    const l = montarSimulacao(leitura, { decisoes: plano?.decisoes || {}, perfil: lerPerfil(), descontoDe }).filter((x) => x.conta === contaAtual);
    const r = resumirSimulacao(l);
    registro.registrar("simulacao", { conta: nomeConta, anuncios: r.total, renault: r.renault, demais: r.demais, revisao: r.revisao, prejuizo: r.prejuizo, sem_margem: r.sem_margem });
    // Aprovação cujo preço ou situação mudou desde então sai do plano (nunca usa preço antigo).
    const { desatualizadas } = registro.conferirAprovacoes(l);
    // (17/11) Preço mudou desde a seleção: o anúncio continua selecionado, com "Revisão necessária".
    const rev = selecao ? selecao.revisar(l) : { novas: [] };
    const novo = [
      desatualizadas.length ? `${desatualizadas.length} aprovação(ões) ficaram desatualizadas (preço ou pendência mudou) e saíram do plano.` : "",
      rev.novas.length ? `${rev.novas.length} anúncio(s) selecionado(s) mudaram de preço: continuam na seleção com "Revisão necessária" e só podem ser aprovados depois de conferidos.` : "",
    ].filter(Boolean).join(" ");
    // (18/11) Automática: soma ao aviso da consulta em vez de apagá-lo.
    if (novo) setAviso((a) => [a, novo].filter(Boolean).join(" "));
  }
  // (18/11) Dispara a simulação quando há leitura desta conta e nada está sendo lido.
  // No modo de teste espera a seleção do banco carregar (para conferir as revisões).
  useEffect(() => {
    if (simulado || lendo || !registro || !leitura?.contas?.[contaAtual]) return;
    if (NO_BANCO && !selecao) return;
    simular(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [simulado, lendo, registro, leitura, contaAtual, NO_BANCO, selecao]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // (17/11) Padrão: SÓ os anúncios selecionados para a campanha. "completa" = conferência de todos.
  function baixarPlanilha(completa = false) {
    if (!linhas.length) { setAviso(`Consulte e simule a ${nomeConta} antes de gerar a planilha.`); return; }
    if (!completa && !linhasSel.length) { setAviso(`Selecione os anúncios da ${nomeConta} para a campanha antes de gerar a planilha de cadastro.`); return; }
    const planilha = montarPlanilha(completa ? linhas : linhasSel, contaAtual);
    const r = resumirPlanilha(planilha);
    try {
      const url = URL.createObjectURL(new Blob([planilhaCSV(planilha)], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url; a.download = `black-friday-2026-${completa ? "conferencia-completa-" : "selecionados-"}${nomeConta.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-")}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { setAviso(`Não foi possível gerar o arquivo: ${e?.message || e}`); }
    setPlanilhaInfo({ conta: nomeConta, resumo: r, completa });
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
    const aptas = lista.filter((l) => aprovavelNaCampanha(l));
    if (!aptas.length) { setAviso("Só anúncios SELECIONADOS para a campanha, sem \"Revisão necessária\" e PRONTO (sem pendência, com margem verificada e não negativa) podem ser aprovados."); return; }
    if (!window.confirm(`Registrar a APROVAÇÃO de ${aptas.length} anúncio(s) PRONTO da ${nomeConta}?\n\nPeríodo: ${dataHoraBrasilia(CAMPANHA_BF.inicio)} a ${dataHoraBrasilia(CAMPANHA_BF.fim)} (Brasília).\n\nSó registra o plano. NENHUMA oferta é ativada e nenhum preço é alterado.`)) return;
    // (18/11) Margem fora da meta (abaixo de 15%): nunca aprova sozinha — pede o responsável; abaixo de 10%, autorização EXCEPCIONAL.
    const estrategicas = aptas.filter((l) => l.faixa_margem === "estrategica");
    const excepcionais = aptas.filter((l) => l.faixa_margem === "excepcional");
    let autorizacao = null;
    if (estrategicas.length || excepcionais.length) {
      const lista = [...excepcionais, ...estrategicas].slice(0, 8).map((l) => `• ${l.id} — margem ${pctTxt(l.margem_pct)}${l.faixa_margem === "excepcional" ? " (RISCO)" : ""}`).join("\n");
      const resp = window.prompt(`MARGEM FORA DA META (15%)\n\n${estrategicas.length} anúncio(s) entre 10% e 14,99% (aprovação estratégica)\n${excepcionais.length} anúncio(s) ABAIXO DE 10% (autorização excepcional — RISCO)\n\n${lista}\n\nNome do responsável que autoriza (vazio = aprova só os da meta):`, "");
      if (resp === null) return;
      const responsavel = String(resp).trim();
      let excepcional = false;
      if (responsavel && excepcionais.length) excepcional = String(window.prompt(`RISCO: ${excepcionais.length} anúncio(s) com margem ABAIXO DE 10%.\n\nDigite AUTORIZO para a autorização excepcional (qualquer outra coisa = esses ficam fora):`, "") || "").trim().toUpperCase() === "AUTORIZO";
      autorizacao = responsavel ? { responsavel, excepcional } : null;
    }
    const r = registro.aprovar(aptas, { modo, autorizacao });
    setAviso(`Aprovação registrada: ${r.aprovados.length} novo(s), ${r.ja_aprovados.length} já aprovado(s), ${r.recusados.length} não aprovado(s).`);
    setMarcados(new Set()); setVersao((v) => v + 1);
  }

  function desaprovar(chaves) {
    if (!chaves.length || !window.confirm(`Retirar a aprovação de ${chaves.length} anúncio(s)?`)) return;
    registro.desaprovar(chaves); setVersao((v) => v + 1);
  }

  // (17/11) Seleção da campanha (escolher não aprova nem altera nada).
  function selecionar(todos) {
    if (!selecao) return;
    // (18/11) BLOQUEADO (inelegível, prejuízo, excluído) não entra; imposto/custo ausente não impede.
    const lista = todos.filter((l) => listaDe.get(l.chave)?.lista !== LISTAS.BLOQUEADO);
    if (!lista.length) { setAviso("Anúncio BLOQUEADO (inelegível, com prejuízo ou excluído) não entra na campanha."); return; }
    const r = selecao.incluir(lista.map((l) => ({ conta: l.conta, id: l.id, sku: l.sku, titulo: l.titulo, preco_original: l.preco_original })), { origem: "central" });
    if (r.incluidos.length) registro?.registrar("selecao_incluida", { conta: nomeConta, quantidade: r.incluidos.length });
    setAviso([r.incluidos.length ? `${r.incluidos.length} anúncio(s) selecionado(s).` : "", r.ja_estavam.length ? `${r.ja_estavam.length} já estava(m) na seleção (sem duplicar).` : "", r.recusados.length ? `${r.recusados.length} não entrou(aram): ${[...new Set(r.recusados.map((x) => x.motivo))].join(" ")}` : ""].filter(Boolean).join(" "));
    setMarcados(new Set()); setVersao((v) => v + 1);
  }
  function retirarDaSelecao(lista) {
    if (!selecao || !lista.length) return;
    const aprovadosJuntos = lista.filter((l) => aprovados[l.chave]);
    if (aprovadosJuntos.length && !window.confirm(`${aprovadosJuntos.length} anúncio(s) também estão aprovados. Retirar da seleção também retira a aprovação. Continuar?`)) return;
    const n = selecao.remover(lista.map((l) => chaveItemSelecao(l.conta, l.id)));
    if (aprovadosJuntos.length) registro.desaprovar(aprovadosJuntos.map((l) => l.chave));
    registro?.registrar("selecao_retirada", { conta: nomeConta, quantidade: n });
    setMarcados(new Set()); setVersao((v) => v + 1);
  }
  function sugerir() {
    if (!selecao) return;
    if (metaConta === null) { setAviso("Escolha a meta da conta (50, 100, 200 ou outra) antes de pedir a sugestão."); return; }
    const vagas = metaConta - selConta.size;
    if (vagas <= 0) { setAviso(`A meta de ${metaConta} da ${nomeConta} já está completa.`); return; }
    const s = sugerirAnuncios(linhas, { vagas, selecionado: (l) => selConta.has(chaveItemSelecao(l.conta, l.id)), apto: (l) => selecionavel(l) });
    if (!s.length) { setAviso("Nenhum anúncio disponível para sugerir (fora BLOQUEADO e dúvida Renault, com estoque)."); return; }
    selecionar(s);
  }
  function mudarMeta(v) {
    if (!selecao) return;
    if (v === "outra") { setMetaOutra(metaConta ?? ""); return; }
    const r = selecao.definirMeta(contaAtual, v === "" ? null : v);
    if (!r.ok) setAviso(r.motivo); else { setMetaOutra(null); setVersao((x) => x + 1); }
  }
  function limparSelecao() {
    if (!selConta.size || !window.confirm(`Retirar TODOS os ${selConta.size} anúncio(s) selecionados da ${nomeConta}? As aprovações desta conta também saem.`)) return;
    const chavesAprov = Object.entries(aprovados).filter(([, a]) => a.conta === contaAtual).map(([k]) => k);
    selecao.limpar(contaAtual);
    if (chavesAprov.length) registro.desaprovar(chavesAprov);
    registro?.registrar("selecao_limpa", { conta: nomeConta });
    setMarcados(new Set()); setVersao((v) => v + 1);
  }
  function conferiRevisao(l) {
    if (!selecao) return;
    // (18/11) O clique em "Conferi o preço" já é a confirmação (sem janela extra). A aprovação continua separada.
    selecao.confirmarRevisao(chaveItemSelecao(l.conta, l.id));
    registro?.registrar("selecao_revisada", { conta: nomeConta, item: l.id });
    setAviso(`${l.id} conferido com o preço atual (${real(l.preco_original)}): a revisão saiu.`);
    setVersao((v) => v + 1);
  }

  // (18/11) Campanhas: trocar, criar/editar rascunho, mudar o % e o desconto de um produto.
  function trocarCampanha(id) {
    setCampanhaId(id); setMarcados(new Set()); setPlanilhaInfo(null); setFormCampanha(null); setPctProduto({}); setAviso("");
    setVersao((v) => v + 1);
  }
  function abrirFormCampanha(c) {
    setFormCampanha(c
      ? { id: c.id, nome: c.nome, inicio: isoParaDataLocal(c.inicio), fim: isoParaDataLocal(c.fim), contas: [...c.contas], desconto: String(c.desconto_pct).replace(".", ","), porProduto: c.descontos_por_produto !== false }
      : { id: "", nome: "", inicio: "", fim: "", contas: CONTAS_PROMOCOES.map((x) => x.id), desconto: "10", porProduto: true });
  }
  function salvarCampanha() {
    if (!armazem || !formCampanha) return;
    const f = formCampanha;
    const r = armazem.salvar({ id: f.id || undefined, nome: f.nome, inicio: dataLocalParaIso(f.inicio), fim: dataLocalParaIso(f.fim), contas: f.contas, desconto_pct: f.desconto, descontos_por_produto: f.porProduto });
    if (!r.ok) { setAviso(r.motivo); return; }
    registro?.registrar("campanha_rascunho", { campanha: r.campanha.nome, desconto_pct: r.campanha.desconto_pct });
    setFormCampanha(null); setCampanhaId(r.campanha.id); setSimulado(false);
    setAviso([`Campanha "${r.campanha.nome}" salva como RASCUNHO (nada foi ativado).`, ...(r.avisos || [])].join(" "));
    setVersao((v) => v + 1);
  }
  function mudarDescontoCampanha(v) {
    if (!armazem || ehBF) return;
    const r = armazem.salvar({ ...campanha, desconto_pct: v });
    if (!r.ok) { setAviso(r.motivo); return; }
    setAviso(`Desconto da campanha: ${String(r.campanha.desconto_pct).replace(".", ",")}%. Simulação recalculada (nenhum preço real foi alterado).`);
    setVersao((x) => x + 1);
  }
  function excluirCampanha() {
    if (!armazem || ehBF || !window.confirm(`Excluir o rascunho "${campanha.nome}"? A seleção dele deixa de aparecer. Nada no Mercado Livre é alterado.`)) return;
    armazem.excluir(campanha.id);
    trocarCampanha(CAMPANHA_BLACK_FRIDAY.id);
  }
  function descontoProduto(l, v) {
    if (!selecao) return;
    const r = selecao.definirDesconto(chaveItemSelecao(l.conta, l.id), v === null ? null : v);
    if (!r.ok) { setAviso(r.motivo); return; }
    setPctProduto((m) => { const n = { ...m }; delete n[l.chave]; return n; });
    setVersao((x) => x + 1);
  }

  const marcar = (k) => setMarcados((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const selecionadas = linhas.filter((l) => marcados.has(l.chave));
  const erros = historico.filter((h) => h.tipo === "erro");
  const falhasConta = (leitura?.falhas || []).filter((f) => f.conta === nomeConta);

  if (erroLogin) return <section style={S.caixa}><h2 style={S.titulo}>🛍️ Black Friday 2026</h2><div style={S.aviso}>{erroLogin}</div>
    {temAcessoDeTeste && <div style={S.acoes}><button type="button" style={S.botao} data-paiia-bf="entrar-teste" onClick={() => entrarNoTeste().catch((e) => setErroLogin(e.message))}>🧪 Entrar no Teste</button><small style={S.base}>Só no ambiente de TESTE (STAGING), com anúncios fictícios.</small></div>}</section>;

  return (
    <section id="black-friday-paizinho" style={S.caixa} data-paiia-black-friday>
      <h2 style={S.titulo}>🛍️ {campanha.nome}</h2>
      <div style={S.acoes}>
        <span style={S.base}>Central de Promoções · campanha:</span>
        <select value={campanha.id} onChange={(e) => trocarCampanha(e.target.value)} style={{ ...S.busca, flex: "0 1 260px" }} aria-label="Campanha" disabled={!!lendo} data-paiia-bf="campanha">
          {campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.regra === REGRAS.PERCENTUAL ? ` (rascunho · ${String(c.desconto_pct).replace(".", ",")}%)` : " (primeira campanha)"}</option>)}
        </select>
        {/* (18/11) Criar/editar/excluir e o % ficam atrás de "Gerenciar campanhas" (fechado por padrão). */}
        <button type="button" style={{ ...S.mini, ...(gerenciar ? S.filtroAtivo : {}) }} onClick={() => setGerenciar(!gerenciar)} aria-expanded={gerenciar} data-paiia-bf="gerenciar-campanhas">{gerenciar ? "▾" : "▸"} Gerenciar campanhas</button>
        {gerenciar && <>
          <button type="button" style={S.mini} onClick={() => abrirFormCampanha(null)} disabled={!usuarioId} data-paiia-bf="nova-campanha">＋ Nova campanha</button>
          {!ehBF && <button type="button" style={S.mini} onClick={() => abrirFormCampanha(campanha)}>Editar</button>}
          {!ehBF && <button type="button" style={S.mini} onClick={excluirCampanha}>Excluir rascunho</button>}
        </>}
      </div>
      {formCampanha && <FormCampanha form={formCampanha} setForm={setFormCampanha} salvar={salvarCampanha} />}
      {gerenciar && !ehBF && <div style={S.acoes}>
        <span style={S.base}>Desconto da campanha (recalcula a simulação):</span>
        {OPCOES_DESCONTO.map((n) => <button key={n} type="button" style={{ ...S.filtro, ...(Number(campanha.desconto_pct) === n ? S.filtroAtivo : {}) }} onClick={() => mudarDescontoCampanha(n)}>{n}%</button>)}
        <input defaultValue={OPCOES_DESCONTO.includes(Number(campanha.desconto_pct)) ? "" : String(campanha.desconto_pct).replace(".", ",")} key={campanha.id + campanha.desconto_pct} placeholder="outro %" style={{ ...S.busca, flex: "0 1 90px" }} aria-label="Desconto personalizado" onKeyDown={(e) => { if (e.key === "Enter") mudarDescontoCampanha(e.currentTarget.value); }} />
      </div>}
      <p style={S.sub}>Uma conta por vez (principal: REVELAÇÃO). Consultar (a simulação é automática) → Selecionar → Conferir → Aprovar → Ativar.</p>
      <div style={S.trava}>🔒 <strong>Simulação.</strong> Nenhuma oferta é ativada e nenhum preço, anúncio, estoque ou Bling é alterado. {ehBF ? <>Descontos: <strong>10%</strong> Renault comprovada · <strong>5%</strong> demais · nunca cumulativos · calculados sobre o preço original confirmado.</> : <>Rascunho: <strong>{String(campanha.desconto_pct).replace(".", ",")}%</strong> na campanha{campanha.descontos_por_produto ? " (ou o desconto individual do produto)" : ""}, só nos anúncios selecionados, nunca cumulativo. Salvar não ativa nada. <small>(Rascunho guardado só neste navegador.)</small></>}</div>

      <div style={S.calendario}>
        <Kpi rotulo="Início" valor={dataHoraBrasilia(campanha.inicio)} />
        <Kpi rotulo="Encerramento" valor={dataHoraBrasilia(campanha.fim)} />
        {ehBF && <Kpi rotulo="Conferência dos preços normais" valor="01/12/2026" />}
        {ehBF && <Kpi rotulo={momento === "preparacao" ? "Faltam" : "Situação"} valor={momento === "preparacao" ? `${diasParaInicio()} dia(s)` : momento === "em_andamento" ? "Em andamento" : "Encerrada"} />}
        {!ehBF && <Kpi rotulo="Contas" valor={campanha.contas.map((c) => CONTAS_PROMOCOES.find((x) => x.id === c)?.nome || c).join(", ")} />}
      </div>

      {/* 1. Conta e consulta */}
      <h3 style={S.h3}>1. Conta e consulta</h3>
      <div style={S.acoes}>
        {CONTAS_BLACK_FRIDAY.map((c) => (
          <label key={c.id} style={{ ...S.filtro, ...(contas.includes(c.id) ? S.filtroAtivo : {}) }}>
            <input type="radio" name="bf-conta" checked={contas.includes(c.id)} onChange={() => alternarConta(c.id)} disabled={!!lendo} /> {c.nome}
          </label>
        ))}
        {/* (18/11) Quantidade em "Opções avançadas" (padrão continua: todos os anúncios ativos). */}
        <details style={S.base}>
          <summary style={{ cursor: "pointer" }}>Opções avançadas</summary>
          <select value={limite} onChange={(e) => setLimite(e.target.value)} style={{ ...S.busca, flex: "0 1 220px", marginTop: 6 }} disabled={!!lendo} aria-label="Quantidade de anúncios">
            {LIMITES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </details>
      </div>
      <div style={S.acoes}>
        <button type="button" style={S.botao} onClick={() => consultar(false)} disabled={!!lendo || !contas.length} data-paiia-bf="consultar">{lendo ? `🔄 ${lendo}` : `🔎 Consultar ${nomeConta}`}</button>
        {!lendo && podeRetomar && <button type="button" style={S.botao} onClick={() => consultar(true)}>⏯️ Retomar consulta ({leituraConta.lidos} já lidos)</button>}
        {lendo && <button type="button" style={S.filtro} onClick={() => { cancelar.current = true; }}>Parar leitura</button>}
      </div>
      {NO_BANCO && <div style={S.aviso}>🧪 <strong>Modo de teste (STAGING):</strong> este banco não lê o Mercado Livre. Use anúncios fictícios para testar seleção, metas, descontos e margens.{" "}
        <button type="button" style={S.mini} disabled={!!lendo} data-paiia-bf="exemplo" onClick={() => {
          const lt = montarLeituraExemplo({ conta: contaAtual, nome: nomeConta });
          try { localStorage.setItem(chaveLeitura(usuarioId, contaAtual), JSON.stringify(lt)); } catch { /* fica só na tela */ }
          // (18/11) Carrega e já simula: a tabela aparece na hora, sem outro clique.
          setLeitura(lt); setProgresso(null); setMostrar(POR_PAGINA); setSimulado(true); setVersao((v) => v + 1);
          setAviso(`${lt.contas[contaAtual].lidos} anúncios de EXEMPLO carregados e simulados para a ${nomeConta} (fictícios, MLB9…). Escolha a meta e use ✨ Sugerir, ou selecione na tabela.`);
          setTimeout(() => document.getElementById("bf-anuncios-campanha")?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
        }}>🧪 Carregar anúncios de exemplo</button></div>}
      <small style={S.base}>Só leitura no ML e no Bling · mantenha a página aberta durante a leitura (não use "Sair").</small>
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
      {/* (18/11) Cópia guardada = uma linha (detalhes e botões recolhidos); sem cópia = aviso visível. */}
      {copia ? <details style={S.nota} data-paiia-bf="copia-precos">
        <summary style={{ cursor: "pointer" }}>✔ Cópia dos preços originais guardada ({copia.total} anúncios, {new Date(copia.gravado_em).toLocaleString("pt-BR")})</summary>
        {copia.em_promocao ? `${copia.em_promocao} já em promoção na leitura (guardado o preço normal). ` : ""}É a referência da conferência de 01/12. Baixe o arquivo e guarde fora do navegador.
        <div style={S.acoes}>
          <button type="button" style={S.mini} onClick={baixarCopia}>📥 Baixar cópia dos preços</button>
          <button type="button" style={S.mini} onClick={() => arquivoCopia.current?.click()}>📤 Carregar cópia de um arquivo</button>
        </div>
      </details> : <div style={S.aviso}>
        <strong>💾 Preços originais da {nomeConta} (cópia de segurança):</strong>{" "}
        ainda não gravada. Ela é gravada sozinha quando a consulta da conta termina completa, antes de {dataHoraBrasilia(CAMPANHA_BF.inicio)}.
        <div style={S.acoes}>
          {!copia && leituraConta && leituraConta.completa !== false && momento === "preparacao" && <button type="button" style={S.mini} onClick={() => {
            const m = montarCopiaPrecos(leituraConta);
            if (!m.ok) { setAviso(m.motivo); return; }
            if (!guardarCopia(localStorage, usuarioId, m.copia)) { setAviso("Não foi possível gravar neste navegador."); return; }
            registro?.registrar("copia_precos", { conta: nomeConta, anuncios: m.copia.total, em_promocao: m.copia.em_promocao });
            setVersao((x) => x + 1);
          }}>💾 Gravar a partir da última leitura</button>}
          <button type="button" style={S.mini} onClick={() => arquivoCopia.current?.click()}>📤 Carregar cópia de um arquivo</button>
        </div>
      </div>}
      <input ref={arquivoCopia} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={carregarCopia} aria-label="Arquivo da cópia de preços" />
      <details style={S.nota}>
        <summary>Margem: {perfil.impostoPct === null ? "imposto não informado — os anúncios aparecem com \"Margem não verificada\" (não impede selecionar nem simular)" : `imposto ${String(perfil.impostoPct).replace(".", ",")}% · custos do Bling quando existirem`}</summary>
        <strong>Custos da venda usados na margem:</strong> imposto {perfil.impostoPct === null ? <strong>não informado</strong> : <strong>{String(perfil.impostoPct).replace(".", ",")}%</strong>} · custo por pedido R$ {String(perfil.custoPedido.toFixed(2)).replace(".", ",")} · comissão e frete: lidos do Mercado Livre · custo da peça: Bling (nunca inventado).
        {perfil.impostoPct === null && <><br /><small>(18/11) O imposto não é exigido para consultar, selecionar ou simular: sem ele, a margem aparece como <strong>"Margem não verificada"</strong>. Impostos serão tratados num projeto separado. A aprovação das ofertas continua exigindo margem verificada (segurança da ativação).</small></>}
        {!custosForm ? <> <button type="button" style={S.mini} onClick={() => setCustosForm({ imposto: perfil.impostoPct ?? "", pedido: perfil.custoPedido || "" })}>{perfil.impostoPct === null ? "Informar imposto (opcional)" : "Alterar"}</button></>
          : <div style={S.acoes}>
            <input value={custosForm.imposto} onChange={(e) => setCustosForm({ ...custosForm, imposto: e.target.value.replace(/[^\d,.]/g, "") })} placeholder="Imposto % (igual ao oficial)" style={{ ...S.busca, flex: "0 1 200px" }} aria-label="Imposto em %" />
            <input value={custosForm.pedido} onChange={(e) => setCustosForm({ ...custosForm, pedido: e.target.value.replace(/[^\d,.]/g, "") })} placeholder="Custo por pedido R$ (opcional)" style={{ ...S.busca, flex: "0 1 220px" }} aria-label="Custo por pedido" />
            <button type="button" style={S.botao} onClick={salvarCustos}>Gravar neste navegador</button>
            <button type="button" style={S.filtro} onClick={() => setCustosForm(null)}>Cancelar</button>
            <small style={S.base}>Copie os valores de Preços, Custos e Lucro do PAIIA oficial. Não altera a produção.</small>
          </div>}
      </details>
      {aviso && <div style={S.aviso}>{aviso}</div>}

      {/* 2. Simulação */}
      <h3 style={S.h3}>2. Simulação</h3>
      {/* (18/11) Sem botão "Simular": a simulação roda sozinha depois da consulta e se refaz quando
          o imposto, o desconto ou as decisões mudam. Os 9 números ficam recolhidos em "Resumo da simulação". */}
      {!simulado && <p style={S.nota}>{lendo ? "A simulação aparece quando a consulta terminar." : `Consulte a ${nomeConta}: a simulação aparece sozinha em seguida.`}</p>}
      {simulado && <details style={S.nota} data-paiia-bf="resumo-simulacao"><summary style={{ cursor: "pointer" }}>Resumo da simulação ({resumo.total} anúncios · {resumoListas.pronto} PRONTO · {resumoListas.conferir} CONFERIR · {resumoListas.bloqueado} BLOQUEADO)</summary><div style={S.kpis}>
        <Kpi rotulo="Anúncios" valor={resumo.total} />
        <Kpi rotulo="PRONTO" valor={resumoListas.pronto} cor={COR_LISTA.PRONTO} />
        <Kpi rotulo="CONFERIR" valor={resumoListas.conferir} cor={COR_LISTA.CONFERIR} />
        <Kpi rotulo="BLOQUEADO" valor={resumoListas.bloqueado} cor={COR_LISTA.BLOQUEADO} />
        <Kpi rotulo="Renault (10%)" valor={resumo.renault} cor={COR_CLASSE.renault} />
        <Kpi rotulo="Demais (5%)" valor={resumo.demais} cor={COR_CLASSE.demais} />
        <Kpi rotulo="Dúvida Renault" valor={resumo.revisao} cor={COR_CLASSE.revisao} />
        <Kpi rotulo="Prejuízo" valor={resumo.prejuizo} cor="#f87171" />
        <Kpi rotulo="Margem não verificada" valor={resumo.sem_margem} cor="#fb923c" />
      </div></details>}

      {/* (17/11) Seleção dos anúncios da campanha — escolher NÃO aprova nem ativa. */}
      <h3 id="bf-anuncios-campanha" style={{ ...S.h3, scrollMarginTop: 18 }}>Anúncios da campanha — {nomeConta}</h3>
      {/* (18/11) Explicação recolhida: fica uma linha visível. */}
      <details style={S.nota}>
        <summary style={{ cursor: "pointer" }}>Escolha a meta e use ✨ Sugerir, ou selecione um por um na lista. Como funciona</summary>
        Escolha quais anúncios participam: 50, 100, 200 ou outra quantidade, pela sugestão ou um por um na tabela (filtre por SKU, MLB ou título).
        O desconto (10% Renault comprovada · 5% demais) vale só para os selecionados; os outros anúncios não entram na planilha e não são alterados.
        <br /><small>{NO_BANCO
          ? (banco ? <>🧪 Seleção, metas e rascunhos gravados no <strong>banco de TESTE (STAGING)</strong>, por usuário, campanha, conta e MLB. Nada vai para o PAIIA oficial.</> : "🧪 Carregando a seleção do banco de teste…")
          : <>⚠️ Por enquanto a seleção fica guardada <strong>só neste navegador</strong> (por usuário, campanha e conta). A gravação no Supabase, compartilhada entre aparelhos, depende da sua autorização.</>}</small>
      </details>
      <div style={S.acoes}>
        <label style={S.base}>Meta da {nomeConta}:{" "}
          <select value={metaOutra !== null ? "outra" : metaConta === null ? "" : METAS_SELECAO.includes(metaConta) ? String(metaConta) : "outra"} onChange={(e) => mudarMeta(e.target.value)} style={{ ...S.busca, flex: "0 1 160px" }} aria-label="Meta de anúncios" data-paiia-bf="meta">
            <option value="">sem meta</option>
            {METAS_SELECAO.map((n) => <option key={n} value={n}>{n} {n === 1 ? "anúncio" : "anúncios"}</option>)}
            <option value="outra">{metaConta !== null && !METAS_SELECAO.includes(metaConta) ? `${metaConta} anúncios (outra)` : "outra quantidade"}</option>
          </select>
        </label>
        {metaOutra !== null && <>
          <input value={metaOutra} onChange={(e) => setMetaOutra(e.target.value.replace(/\D/g, ""))} placeholder="Quantidade" style={{ ...S.busca, flex: "0 1 110px" }} aria-label="Meta personalizada" />
          <button type="button" style={S.mini} onClick={() => mudarMeta(metaOutra)}>Gravar meta</button>
          <button type="button" style={S.mini} onClick={() => setMetaOutra(null)}>Cancelar</button>
        </>}
        <button type="button" style={S.botao} disabled={!simulado || !linhas.length} onClick={sugerir} title="Fora BLOQUEADO e dúvida Renault, com estoque: maior quantidade vendida lida no ML e, no empate, maior estoque. Não exige imposto." data-paiia-bf="sugerir">✨ Sugerir até a meta</button>
        <button type="button" style={S.filtro} disabled={!selConta.size} onClick={limparSelecao}>Limpar seleção</button>
      </div>
      <div style={S.kpis}>
        <Kpi rotulo="Selecionados" valor={metaConta !== null ? `${resumoSel.total} de ${metaConta}` : resumoSel.total} cor="#67e8f9" />
        <Kpi rotulo="Renault (10%)" valor={simulado ? resumoSel.renault : "—"} cor={COR_CLASSE.renault} />
        <Kpi rotulo="Demais (5%)" valor={simulado ? resumoSel.demais : "—"} cor={COR_CLASSE.demais} />
        <Kpi rotulo="Revisão necessária" valor={resumoSel.revisao} cor="#fb923c" />
        <Kpi rotulo="Prejuízo" valor={simulado ? resumoSel.prejuizo : "—"} cor="#f87171" />
        <Kpi rotulo="Margem baixa / não verificada" valor={simulado ? `${resumoSel.margem_baixa} / ${resumoSel.sem_margem}` : "—"} cor="#fbbf24" />
        <Kpi rotulo="Preço original (soma)" valor={simulado ? real(resumoSel.soma_original) : "—"} />
        <Kpi rotulo="Preço promocional (soma)" valor={simulado ? real(resumoSel.soma_promocional) : "—"} cor="#4ade80" />
      </div>
      {simulado && resumoSel.total > resumoSel.lidos && <p style={S.nota}>{resumoSel.total - resumoSel.lidos} anúncio(s) selecionado(s) não estão nesta leitura (pausados, encerrados ou ainda não lidos): consulte a conta inteira para conferir.</p>}
      {!simulado && resumoSel.total > 0 && <p style={S.nota}>Consulte a {nomeConta} para ver preços, descontos e margens dos selecionados.</p>}

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
          <select value={filtro.sel} onChange={(e) => { setFiltro({ ...filtro, sel: e.target.value }); setMostrar(POR_PAGINA); }} style={{ ...S.busca, flex: "0 1 190px" }} aria-label="Seleção" data-paiia-bf="filtro-selecao">
            <option value="">Selecionados e não selecionados</option><option value="sim">Só selecionados</option><option value="nao">Só não selecionados</option><option value="revisao">Revisão necessária</option>
          </select>
          <input value={filtro.busca} onChange={(e) => { setFiltro({ ...filtro, busca: e.target.value }); setMostrar(POR_PAGINA); }} placeholder="Buscar MLB, SKU ou título" style={S.busca} />
        </div>

        {/* (18/11) Lista compacta: uma linha por anúncio (conta, MLB, SKU, título, preços, desconto,
            situação e Selecionar/Retirar); o resto (custos, margem, pendências, aprovação) em "Detalhes". */}
        <div style={S.acoes}>
          <span style={S.base}>{visiveis.length} anúncio(s) no filtro · {selConta.size} selecionado(s) · {selecionadas.length} marcado(s)</span>
          <button type="button" style={S.mini} onClick={() => setAbertos(abertos.size ? new Set() : new Set(visiveis.slice(0, mostrar).map((l) => l.chave)))}>{abertos.size ? "Fechar todos os detalhes" : "Abrir detalhes dos visíveis"}</button>
          {/* (18/11) Seleção dos marcados aqui, junto da lista (antes ficava na etapa 4). */}
          <button type="button" style={S.mini} disabled={!selecionadas.length} onClick={() => selecionar(selecionadas)} data-paiia-bf="selecionar-marcados">+ Selecionar marcados para a campanha</button>
          <button type="button" style={S.mini} disabled={!selecionadas.some((l) => regSel(l))} onClick={() => retirarDaSelecao(selecionadas.filter((l) => regSel(l)))}>Retirar marcados da campanha</button>
        </div>
        <div style={S.lista2} data-paiia-bf="lista-anuncios">
          <style>{"@media (max-width: 760px){.bf-rot{display:block!important}.bf-cab{display:none!important}}"}</style>
          <div className="bf-cab" style={{ ...S.linha2, ...S.cabeca2 }} aria-hidden="true">
            <span style={S.c_marca} /><span style={S.c_anuncio}>MLB · SKU / produto</span><span style={S.c_preco}>Preço atual</span><span style={S.c_desc}>Desconto</span><span style={S.c_preco}>Promocional</span><span style={S.c_situacao}>Situação</span><span style={S.c_acao} /><span style={S.c_abrir} />
          </div>
          {visiveis.slice(0, mostrar).map((l) => {
            const aprovado = !!aprovados[l.chave];
            const cl = listaDe.get(l.chave) || { lista: "", pendencias: [], observacoes: [] };
            const sel = regSel(l);
            const aberto = abertos.has(l.chave);
            const motivos = [...(sel?.revisao ? [`Revisão necessária: ${sel.revisao_motivo || "preço mudou desde a seleção"}`] : []), ...cl.pendencias];
            // (18/11) Anúncio antigo sem custo/imposto: não é problema para selecionar — só "Margem não verificada".
            const outrosMotivos = motivos.filter((m) => !RE_MARGEM.test(m));
            const soMargem = !aprovado && cl.lista === LISTAS.CONFERIR && !outrosMotivos.length;
            const descTxt = ehBF
              ? (l.classe === CLASSES.REVISAO && !l.decisao ? "a decidir" : `${l.desconto_pct}%`)
              : `${String(l.desconto_pct).replace(".", ",")}%`;
            return (
              <div key={l.chave} style={{ ...S.item2, ...(aprovado ? S.aprovado : sel ? S.selecionado : {}) }} data-paiia-bf-linha={l.id}>
                <div style={S.linha2}>
                  <span style={S.c_marca}><input type="checkbox" checked={marcados.has(l.chave)} disabled={aprovado} onChange={() => marcar(l.chave)} aria-label={`Marcar ${l.id}`} /></span>
                  <span style={S.c_anuncio}>
                    <span style={S.ident2}><a href={l.link} target="_blank" rel="noreferrer" style={S.link}>{l.id}</a>{l.sku ? <small style={S.base}> · {l.sku}</small> : null}</span>
                    <span style={S.titulo2} title={l.titulo}>{l.titulo}</span>
                  </span>
                  <span style={S.c_preco}><small className="bf-rot" style={S.rotulo2}>Preço atual</small>{real(l.preco_original)}</span>
                  <span style={S.c_desc}><small className="bf-rot" style={S.rotulo2}>Desconto</small><span style={{ ...S.selo, color: COR_CLASSE[l.classe] || "#67e8f9", borderColor: COR_CLASSE[l.classe] || "#67e8f9" }} title={[ROTULO_CLASSE[l.classe], ...l.evidencias, l.duvida].filter(Boolean).join("\n")}>{descTxt}{ehBF && l.classe !== CLASSES.REVISAO ? ` ${l.classe === CLASSES.RENAULT ? "Renault" : "demais"}` : ""}{!ehBF && sel?.desconto_pct ? " (produto)" : ""}</span></span>
                  <span style={S.c_preco}><small className="bf-rot" style={S.rotulo2}>Promocional</small><strong>{real(l.preco_final)}</strong></span>
                  <span style={S.c_situacao}>
                    {soMargem
                      ? <span style={{ ...S.selo, color: "#fbbf24", borderColor: "#fbbf24" }} title={motivos.join("\n")}>Margem não verificada</span>
                      : <span style={{ ...S.selo, color: COR_LISTA[cl.lista], borderColor: COR_LISTA[cl.lista] }}>{aprovado ? "APROVADO" : cl.lista}</span>}
                    {sel?.revisao && <span style={{ ...S.selo, color: "#fb923c", borderColor: "#fb923c", marginLeft: 4 }}>Revisão</span>}
                    {!soMargem && outrosMotivos.length > 0 && <span style={S.motivo2} title={motivos.join("\n")}>{outrosMotivos[0]}{outrosMotivos.length > 1 ? ` (+${outrosMotivos.length - 1})` : ""}</span>}
                  </span>
                  <span style={S.c_acao}>
                    {sel
                      ? <button type="button" style={{ ...S.mini, borderColor: "#67e8f9", color: "#67e8f9" }} onClick={() => retirarDaSelecao([l])} title="Retirar da campanha">✓ Retirar</button>
                      : <button type="button" style={S.mini} onClick={() => selecionar([l])} data-paiia-bf="selecionar">+ Selecionar</button>}
                  </span>
                  <span style={S.c_abrir}><button type="button" style={S.abrir2} onClick={() => setAbertos((s) => { const n = new Set(s); if (n.has(l.chave)) n.delete(l.chave); else n.add(l.chave); return n; })} aria-expanded={aberto} aria-label={`Detalhes de ${l.id}`}>{aberto ? "▾" : "▸"}</button></span>
                </div>
                {aberto && <div style={S.detalhe2}>
                  <div style={S.grade2}>
                    <div><small style={S.rotulo2b}>Classificação</small><span style={{ ...S.selo, color: COR_CLASSE[l.classe], borderColor: COR_CLASSE[l.classe] }}>{ROTULO_CLASSE[l.classe]}</span>{l.decisao && l.decisao !== "excluir" && <small style={S.base}> (manual)</small>}
                      {[...l.evidencias, l.duvida].filter(Boolean).map((t, i) => <div key={i}><small style={S.base}>{t}</small></div>)}</div>
                    <div style={{ color: l.lucro !== null && l.lucro < 0 ? "#f87171" : undefined }}><small style={S.rotulo2b}>Margem depois do desconto</small>
                      {l.margem_pct !== null
                        ? <span><strong>Lucro {real(l.lucro)}</strong> · <strong>margem {pctTxt(l.margem_pct)}</strong></span>
                        : l.margem_estimada_pct !== null && l.margem_estimada_pct !== undefined
                          ? <><span style={{ color: l.lucro_estimado < 0 ? "#f87171" : "#fbbf24" }}>Lucro ≈ {real(l.lucro_estimado)} · margem ≈ {pctTxt(l.margem_estimada_pct)} (estimativa)</span> <small style={S.base}>Não é a margem definitiva: {(l.base_estimativa || []).join(" · ")}.</small></>
                          : <><span style={{ color: "#fbbf24" }}>Margem não verificada</span> <small style={S.base}>{[perfil.impostoPct === null ? "imposto não informado" : "", l.custo_origem ? "" : "Custo não encontrado", l.comissao_origem ? "" : "Comissão não confirmada"].filter(Boolean).join(" · ")} — dá para selecionar e simular.</small></>}
                      {l.faixa_margem && <div><small style={{ color: COR_FAIXA[l.faixa_margem], fontWeight: 700 }}>{ROTULO_FAIXA[l.faixa_margem]}</small></div>}
                      <div><small style={S.base}>No preço promocional {real(l.preco_final)}: comissão {l.comissao_origem ? `${real(l.comissao_usada)} (${l.tipo_anuncio_nome || "anúncio"} ${String(l.comissao_pct ?? "").replace(".", ",")}%${l.comissao_origem === "real" ? ", tarifa real do ML" : ", referência — Comissão não confirmada"})` : "Comissão não confirmada"} · frete {l.frete === null ? "não confirmado" : real(l.frete)} · imposto {l.imposto === null ? "não informado" : real(l.imposto)} · custo {l.custo_origem === "cadastrado" ? `${real(l.custo_usado)} (cadastrado no Bling)` : l.custo_origem === "ultima_compra" ? `${real(l.custo_usado)} (última compra${l.ultima_compra?.pedido ? ` nº ${l.ultima_compra.pedido}` : ""} — estimativa)` : "Custo não encontrado"}{l.custo_pedido ? ` · por pedido ${real(l.custo_pedido)}` : ""}</small></div></div>
                  </div>
                  {(outrosMotivos.length > 0 || cl.observacoes.length > 0) && <ul style={S.lista}>
                    {outrosMotivos.map((m, i) => <li key={i}><small>{m}</small></li>)}
                    {cl.observacoes.map((m, i) => <li key={`o${i}`}><small style={{ opacity: 0.75 }}>ℹ {m}</small></li>)}
                  </ul>}
                  <div style={S.acoes}>
                    {sel?.revisao && <button type="button" style={S.mini} onClick={() => conferiRevisao(l)}>Conferi o preço</button>}
                    {!ehBF && sel && campanha.descontos_por_produto && <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}><small style={S.base}>Desconto deste produto:</small><input value={pctProduto[l.chave] ?? ""} onChange={(e) => setPctProduto({ ...pctProduto, [l.chave]: e.target.value.replace(/[^\d,.]/g, "") })} placeholder="%" style={{ ...S.busca, width: 56, flex: "0 0 56px", padding: "3px 6px" }} aria-label={`Desconto de ${l.id}`} />
                      <button type="button" style={S.mini} onClick={() => descontoProduto(l, pctProduto[l.chave] ?? "")}>ok</button>
                      {sel.desconto_pct ? <button type="button" style={S.mini} onClick={() => descontoProduto(l, null)} title="Voltar ao desconto da campanha">↺ campanha</button> : null}</span>}
                    {aprovado
                      ? <button type="button" style={S.mini} onClick={() => desaprovar([l.chave])}>Retirar aprovação</button>
                      : aprovavelNaCampanha(l) && <button type="button" style={S.mini} onClick={() => aprovar([l], "anuncio")}>Aprovar</button>}
                    {(l.classe === CLASSES.REVISAO || l.decisao) && l.situacao !== SITUACOES.BLOQUEADO && l.decisao !== "excluir" && <>
                      <button type="button" style={S.mini} onClick={() => decidir(l, "renault")} title="Só se a aplicação Renault estiver comprovada">Renault 10%</button>
                      <button type="button" style={S.mini} onClick={() => decidir(l, "demais")}>Demais 5%</button>
                    </>}
                    {l.decisao
                      ? <button type="button" style={S.mini} onClick={() => decidir(l, null)}>Desfazer decisão</button>
                      : <button type="button" style={S.mini} onClick={() => decidir(l, "excluir")}>Tirar da campanha</button>}
                  </div>
                </div>}
              </div>
            );
          })}
        </div>
        {visiveis.length > mostrar && <button type="button" style={S.filtro} onClick={() => setMostrar(mostrar + POR_PAGINA)}>Mostrar mais ({visiveis.length - mostrar} restantes)</button>}

        {!ehBF && <p style={S.aviso}>Rascunho: a aprovação, a planilha de cadastro e a ativação desta campanha ficam para a próxima etapa. Aqui você prepara a seleção, o desconto e confere preços e margens — nada é ativado.</p>}
        {ehBF && <>
        {/* 4. Aprovar */}
        <h3 style={S.h3}>4. Aprovar</h3>
        {/* (18/11) Regra de aprovação recolhida em uma linha; a regra em si não mudou. */}
        <details style={S.nota}>
          <summary style={{ cursor: "pointer" }}>Só aprova anúncio selecionado e PRONTO. Ver regra</summary>
          Selecionar e aprovar são passos diferentes. Só são aprovados anúncios <strong>selecionados</strong>, sem "Revisão necessária" e <strong>PRONTO</strong> (sem pendência, margem verificada e não negativa). CONFERIR precisa ser resolvido antes; BLOQUEADO não entra.
        </details>
        <div style={S.acoes}>
          <button type="button" style={S.botao} disabled={!selecionadas.some((l) => aprovavelNaCampanha(l))} onClick={() => aprovar(selecionadas, "selecao")}>✅ Aprovar marcados</button>
          <button type="button" style={S.botao} disabled={!visiveis.some((l) => aprovavelNaCampanha(l) && !aprovados[l.chave])} onClick={() => aprovar(visiveis, "lote")}>✅ Aprovar todos os selecionados PRONTO do filtro</button>
        </div>
        <p style={S.nota}>Ofertas aprovadas da {nomeConta}: <strong>{aprovadosConta.length}</strong> · Campanha da conta: {!campanhaConta ? "não aprovada" : campanhaConta.valida ? `✅ aprovada em ${dataHoraBrasilia(campanhaConta.aprovado_em)} (${campanhaConta.ofertas} oferta(s))` : "⚠️ desatualizada (as ofertas mudaram depois) — aprove de novo"}
          {" "}{campanhaConta ? <button type="button" style={S.mini} onClick={retirarCampanha}>Retirar</button> : <button type="button" style={S.mini} disabled={!aprovadosConta.length} onClick={aprovarCampanha}>Aprovar campanha da {nomeConta}</button>}</p>
        </>}
      </>}

      {ehBF && <>
      {/* 5. Ativar */}
      <h3 style={S.h3}>5. Ativar</h3>
      <p style={S.nota}>Baixe a planilha dos selecionados e cadastre as ofertas PRONTO na Central de Promoções do ML.</p>
      <div style={S.acoes}>
        <button type="button" style={S.botao} disabled={!linhasSel.length} onClick={() => baixarPlanilha(false)} data-paiia-bf="planilha">📥 Planilha dos selecionados ({linhasSel.length})</button>
        <button type="button" style={S.filtro} disabled={!linhas.length} onClick={() => baixarPlanilha(true)} title="Todos os anúncios lidos, só para conferência (não é a lista da campanha)">Planilha completa (conferência)</button>
      </div>
      {planilhaInfo && planilhaInfo.conta === nomeConta && <p style={S.nota}>
        <strong>Planilha {planilhaInfo.completa ? "completa (conferência)" : "dos selecionados"} {planilhaInfo.conta}:</strong> {planilhaInfo.resumo.total} anúncio(s) · <strong>{planilhaInfo.resumo.pronto} PRONTO</strong> · {planilhaInfo.resumo.conferir} CONFERIR · {planilhaInfo.resumo.bloqueado} BLOQUEADO · Renault 10%: {planilhaInfo.resumo.renault10} · Demais 5%: {planilhaInfo.resumo.demais5} · Dúvida: {planilhaInfo.resumo.revisao}. PRONTO: de {real(planilhaInfo.resumo.soma_atual)} para {real(planilhaInfo.resumo.soma_promocional)} (soma dos preços).
      </p>}
      <p style={S.nota}>Confirmadas no Mercado Livre: <strong>{confirmacao.confirmadas.length}</strong> de {confirmacao.aprovadas} aprovada(s).</p>
      {/* (18/11) Notas longas e o botão de ativação automática (sempre desligado nesta fase) recolhidos. */}
      <details style={S.nota} data-paiia-bf="como-funciona-ativacao">
        <summary style={{ cursor: "pointer" }}>Como funciona a ativação e o encerramento</summary>
        <p style={S.nota}><strong>Automático (API do Mercado Livre):</strong> {promoLiberada ? "o ML respondeu às promoções nesta leitura. A ativação automática ainda depende da sua autorização expressa." : promoBloqueada ? <>bloqueado — o ML recusou as promoções desta conta (HTTP 403: o aplicativo não tem a permissão "Promoções, cupons e descontos"). A tentativa não é repetida; a próxima consulta mostra se foi liberado.</> : "consulte a conta para saber se o ML libera as promoções."}</p>
        <div style={S.acoes}>
          <button type="button" style={{ ...S.botao, opacity: 0.5, cursor: "not-allowed" }} disabled title="Liberado só na Fase 3, com autorização expressa e permissão de promoções no ML">🚀 Ativar ofertas aprovadas</button>
        </div>
        <p style={S.nota}><strong>Manual assistido:</strong> baixe a planilha dos anúncios SELECIONADOS da {nomeConta} (com lista PRONTO/CONFERIR/BLOQUEADO, custos, comissão, imposto, frete, lucro, margem e motivo) e cadastre as ofertas PRONTO como "Desconto individual" na Central de Promoções do ML, de {dataHoraBrasilia(CAMPANHA_BF.inicio)} a {dataHoraBrasilia(CAMPANHA_BF.fim)}. Regras do ML: produto novo, anúncio pago, desconto de 5% a 80%, até 14 dias.</p>
        <p style={S.nota}>Só conta como ativa a oferta cujo preço com desconto foi LIDO no ML numa consulta (a partir de {dataHoraBrasilia(CAMPANHA_BF.inicio)}); nada é marcado como publicado sem essa confirmação.</p>
        <p style={S.nota}><strong>Encerramento:</strong> as ofertas terminam em {dataHoraBrasilia(CAMPANHA_BF.fim)} (Brasília) pela data de fim da própria oferta no ML; o PAIIA não troca preços. Em 01/12, consulte a {nomeConta} de novo: a conferência compara cada oferta aprovada com o preço original confirmado e só aponta diferenças — nunca sobrescreve preços.</p>
      </details>

      {/* 6. Encerramento */}
      <h3 style={S.h3}>6. Encerramento</h3>
      {momento !== "encerrada" && <small style={S.base}>Disponível depois de {dataHoraBrasilia(CAMPANHA_BF.fim)}.</small>}
      {encerramento && (!encerramento.valida ? <p style={S.nota}>{encerramento.motivo}</p> : <>
        <p style={S.nota}>Conferência da {nomeConta} (referência: {encerramento.referencia}):{encerramento.resumo.normal} no preço normal · {encerramento.resumo.com_desconto} ainda com desconto · {encerramento.resumo.diferente} com preço diferente · {encerramento.resumo.nao_lido} não lido(s).</p>
        <ul style={S.lista}>{encerramento.linhas.filter((x) => x.estado !== "normal").slice(0, 100).map((x) => <li key={x.item}><small>{x.item}: {x.texto}</small></li>)}</ul>
      </>)}

      </>}

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

// (18/11) Nova campanha / editar rascunho: nome, datas (Brasília), contas, desconto e desconto por produto.
function FormCampanha({ form, setForm, salvar }) {
  const muda = (k, v) => setForm({ ...form, [k]: v });
  const conta = (id) => muda("contas", form.contas.includes(id) ? form.contas.filter((x) => x !== id) : [...form.contas, id]);
  return (
    <div style={{ ...S.nota, border: "1px solid #334155", borderRadius: 12, padding: 12 }} data-paiia-bf="form-campanha">
      <strong>{form.id ? "Editar rascunho" : "Nova campanha (rascunho)"}</strong> — salvar não ativa nada e não altera preços.
      <div style={S.acoes}>
        <input value={form.nome} onChange={(e) => muda("nome", e.target.value)} placeholder="Nome (ex.: Natal 2026)" style={S.busca} aria-label="Nome da campanha" />
        <label style={S.base}>Início <input type="datetime-local" value={form.inicio} onChange={(e) => muda("inicio", e.target.value)} style={{ ...S.busca, flex: "0 1 200px" }} aria-label="Início" /></label>
        <label style={S.base}>Encerramento <input type="datetime-local" value={form.fim} onChange={(e) => muda("fim", e.target.value)} style={{ ...S.busca, flex: "0 1 200px" }} aria-label="Encerramento" /></label>
        <small style={S.base}>horário de Brasília · máximo 14 dias (regra do ML)</small>
      </div>
      <div style={S.acoes}>
        {CONTAS_PROMOCOES.map((c) => <label key={c.id} style={{ ...S.filtro, ...(form.contas.includes(c.id) ? S.filtroAtivo : {}) }}><input type="checkbox" checked={form.contas.includes(c.id)} onChange={() => conta(c.id)} /> {c.nome}</label>)}
      </div>
      <div style={S.acoes}>
        <span style={S.base}>Desconto:</span>
        {OPCOES_DESCONTO.map((n) => <button key={n} type="button" style={{ ...S.filtro, ...(String(form.desconto) === String(n) ? S.filtroAtivo : {}) }} onClick={() => muda("desconto", String(n))}>{n}%</button>)}
        <input value={OPCOES_DESCONTO.map(String).includes(String(form.desconto)) ? "" : form.desconto} onChange={(e) => muda("desconto", e.target.value.replace(/[^\d,.]/g, ""))} placeholder="outro %" style={{ ...S.busca, flex: "0 1 90px" }} aria-label="Outro desconto" />
        <label style={S.base}><input type="checkbox" checked={form.porProduto} onChange={(e) => muda("porProduto", e.target.checked)} /> permitir desconto individual por produto</label>
      </div>
      <div style={S.acoes}>
        <button type="button" style={S.botao} onClick={salvar} data-paiia-bf="salvar-campanha">💾 Salvar rascunho</button>
        <button type="button" style={S.filtro} onClick={() => setForm(null)}>Cancelar</button>
      </div>
    </div>
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
  selecionado: { background: "rgba(103,232,249,.06)" },
  // (18/11) Lista compacta de anúncios.
  lista2: { border: "1px solid #1e293b", borderRadius: 12, overflow: "hidden", marginTop: 6, textAlign: "left" },
  item2: { borderBottom: "1px solid #1e293b" },
  linha2: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 10px", padding: "6px 10px", fontSize: 13, color: "#e2e8f0" },
  cabeca2: { background: "#0b1324", color: "#94a3b8", fontSize: 12, fontWeight: 700 },
  c_marca: { flex: "0 0 20px" },
  c_anuncio: { flex: "3 1 260px", minWidth: 0, display: "flex", flexDirection: "column" },
  ident2: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  titulo2: { color: "#cbd5e1", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" },
  c_preco: { flex: "0 0 84px", display: "flex", flexDirection: "column" },
  c_desc: { flex: "0 0 100px", display: "flex", flexDirection: "column" },
  c_situacao: { flex: "2 1 150px", minWidth: 0, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 },
  motivo2: { flexBasis: "100%", color: "#94a3b8", fontSize: 12, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" },
  c_acao: { flex: "0 0 92px" },
  c_abrir: { flex: "0 0 26px", textAlign: "right" },
  abrir2: { border: "1px solid #475569", borderRadius: 6, background: "#0f172a", color: "#e2e8f0", width: 24, height: 24, cursor: "pointer", padding: 0 },
  rotulo2: { display: "none" },
  rotulo2b: { display: "block", color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: ".03em" },
  detalhe2: { padding: "4px 12px 10px 40px", background: "rgba(15,23,42,.6)" },
  grade2: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,170px),1fr))", gap: 10, fontSize: 13, color: "#e2e8f0" },
  link: { color: "#67e8f9" },
};
