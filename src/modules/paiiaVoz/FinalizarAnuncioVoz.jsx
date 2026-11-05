// =============================================================
// PAIIA Voz — (04/11/2026) “Finalizar anúncio”: UMA tela, responsiva
// (etapa 7 do celular e tela do computador). Confere sozinha (Bling + ML,
// só leitura), mostra as pendências, lista as operações (cada uma marcável)
// e executa SÓ o que você autorizar, com uma confirmação e um botão.
// Execução real: NÃO liberada nesta versão (ver finalizarAnuncioVoz.js).
// =============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { useContasML, contasMLConectadas } from "../../services/contaMLAtiva";
import { nomeDaLoja } from "../../services/duplicidadeML";
import { lerFichaNovoAnuncio } from "../../services/fichaNovoAnuncioService";
import { prepararEGravar, confirmarCategoriaEGravar, definirModalidadeEGravar, buscarCategoriasEmOutra, confirmarCategoriaEscolhidaEGravar } from "./servicos/preparoVozService";
import { conferirVersaoSite } from "./servicos/versaoSite";
import PainelCategoriaML from "../../components/PainelCategoriaML";
import { preparoAtual, assinaturaEntrada, entradaDaFicha } from "./servicos/preparoConferenciaVoz";
import { situacaoFinalizar, executarFinalizacao, assinaturaFinalizar, publicacaoRealLiberada, ROTULOS_OPERACOES, rotuloEstado, skuAusenteNoBling, estadoFinalizacao } from "./servicos/finalizarAnuncioVoz";
import { depsFinalizarReais } from "./servicos/finalizarDepsReais";
import PreparoPublicacaoVoz from "./PreparoPublicacaoVoz";
import { montarRevisao } from "./servicos/revisaoCelularVoz";
import { aprovarRevisaoEGravar } from "./servicos/preparoVozService";
import { prepararPublicacaoVoz } from "./servicos/publicarVozService";
import { diagnosticarFichaVoz, textoDiagnostico } from "./servicos/localizarFichaVoz";
import { listarAnunciosDoCodigo } from "../../services/anuncioPublicacaoService";
import { supabase } from "../../supabase";

// (Passo 7) Pendência da revisão → etapa do celular que a resolve.
const ETAPA_DA_PENDENCIA = (p) => (p.id === "compatibilidade" ? "compat" : p.id === "descricao" ? "descricao" : p.id === "fotos" ? "fotos" : /^ficha:Peso/.test(p.id) ? "envio" : /^ficha:Tipo/.test(p.id) ? "compat" : /^ficha:T[ií]tulo/.test(p.id) ? "descricao" : "");

const ICONE = { pergunta: "❓", bloqueio: "⛔", erro: "⚠️", aguardando: "⏳", conferir: "🔎", aviso: "ℹ️" };
// Laboratório: ligações simuladas (só com o modo de teste do PAIIA ligado).
const depsTeste = () => (globalThis.__paiiaModoTeste && globalThis.__paiiaFinalizarDeps) || null;

const ORDEM_CONTAS = ["LOJA ONLINE", "REVELAÇÃO", "CIEBR"];

export default function FinalizarAnuncioVoz({ fichaId, usuarioId = "", aoIrEtapa = null, depoisDaConta = null, versaoNuvem = 0, aoAbrirPublicacao = null, codigoRascunho = "", aoTrocarFicha = null, aoDefinirMotor = null }) {
  const estadoContas = useContasML();
  const contas = contasMLConectadas(estadoContas).filter((c) => String(c.ml_user_id || "").trim());
  const [contaEscolhida, setConta] = useState("");
  const [row, setRow] = useState(null);
  // (06/11) Resultado da última leitura da ficha: “não encontrada” ou erro não ficam presos em “Lendo a ficha…”.
  const [leitura, setLeitura] = useState({ estado: "lendo", erro: "" });
  const [rodando, setRodando] = useState("");
  // (Passo 7) Resultado visível do "Ler de novo" (ficha não encontrada).
  const [diag, setDiag] = useState({ lendo: false, d: null });
  async function lerDeNovo() {
    if (diag.lendo) return;
    setDiag({ lendo: true, d: null });
    const t = depsTeste();
    const d = await diagnosticarFichaVoz({ fichaId, codigo: codigoRascunho }, {
      usuarioAtual: t?.usuarioAtual || (async () => (await supabase.auth.getUser())?.data?.user || null),
      lerFicha: t?.lerFicha || lerFichaNovoAnuncio,
      listarPorCodigo: t?.listarPorCodigo || listarAnunciosDoCodigo,
    });
    setDiag({ lendo: false, d });
    if (d.estado === "encontrada") await recarregar();
  }
  const [erro, setErro] = useState("");
  const [autorizarBling, setAutorizarBling] = useState(false);
  const [autorizoCadastro, setAutorizoCadastro] = useState(false); // (Etapa 3) autorização do cadastro no Bling no "Finalizar e Enviar"
  const [semCompatibilidade, setSemCompatibilidade] = useState(false);
  const [marcar, setMarcar] = useState({}); // (04/11) nenhuma operação vem marcada
  // (05/11) A autorização vale só para o que estava na tela quando você marcou (assinatura).
  const [confirmoAss, setConfirmoAss] = useState("");
  const setConfirmo = (v) => { if (!v) setConfirmoAss(""); };
  const [versao, setVersao] = useState({ estado: "conferindo" });
  const [cat, setCat] = useState({ aberta: false, termo: "", avaliacao: null, carregando: false, erro: "" });
  const [resultado, setResultado] = useState(null);
  const [sessao] = useState(() => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
  const autoConferida = useRef("");
  const teste = depsTeste();
  // Laboratório: só as EXECUÇÕES são simuladas; leituras e registro seguem o caminho de sempre.
  const deps = teste ? { ...depsFinalizarReais, ...teste, conferir: { ...depsFinalizarReais.conferir, ...(teste.conferir || {}) }, executar: { ...depsFinalizarReais.executar, ...(teste.executar || {}) } } : depsFinalizarReais;
  const liberado = Boolean(teste) || publicacaoRealLiberada();
  const preparar = (id, o) => (depsTeste()?.preparar || prepararEGravar)(id, o);
  // Conta: a escolhida, a gravada na ficha ou a única conectada.
  const contaGravada = String(row?.dados_conferencia?.paiia_voz?.preparo?.conta || row?.conta_destino_ml_user_id || "");
  const conta = contaEscolhida || contaGravada || (contas.length === 1 ? String(contas[0].ml_user_id) : "");

  const recarregar = useCallback(async () => {
    if (!fichaId) return null;
    const r = await (depsTeste()?.lerFicha || lerFichaNovoAnuncio)(fichaId);
    if (r?.ok) setRow(r.ficha);
    setLeitura(r?.ok ? { estado: "ok", erro: "" } : { estado: r?.naoEncontrada ? "nao-encontrada" : "erro", erro: r?.erro || "" });
    return r;
  }, [fichaId]);
  // (05/11) Página desatualizada (aberta antes de uma publicação) não autoriza nada.
  const conferirVersao = useCallback(async () => {
    const t = depsTeste();
    const v = await conferirVersaoSite(t?.buscarSite ? { buscar: t.buscarSite } : {});
    setVersao(v);
    return v;
  }, []);
  useEffect(() => {
    let ativo = true;
    const t = depsTeste();
    conferirVersaoSite(t?.buscarSite ? { buscar: t.buscarSite } : {}).then((v) => { if (ativo) setVersao(v); });
    return () => { ativo = false; };
  }, []);
  // Relê a ficha ao abrir e a cada gravação do celular na conta (versaoNuvem): nada de dados velhos na tela.
  useEffect(() => {
    let ativo = true;
    (async () => {
      if (!fichaId) return;
      const r = await (depsTeste()?.lerFicha || lerFichaNovoAnuncio)(fichaId);
      if (!ativo) return;
      if (r?.ok) setRow(r.ficha);
      setLeitura(r?.ok ? { estado: "ok", erro: "" } : { estado: r?.naoEncontrada ? "nao-encontrada" : "erro", erro: r?.erro || "" });
    })();
    return () => { ativo = false; };
  }, [fichaId, versaoNuvem]);

  async function acao(nome, fn) {
    if (rodando) return;
    setRodando(nome);
    setErro("");
    let r;
    try { r = await fn(); } catch (e) { r = { ok: false, erro: e?.message || String(e) }; }
    setRodando("");
    if (r && !r.ok) setErro(r.erro || "Não consegui gravar na ficha.");
    setConfirmo(false); // qualquer mudança pede nova confirmação
    await recarregar();
  }
  // Se a ficha mudou durante a conferência (celular gravando), tenta de novo na próxima leitura.
  const conferir = useCallback(() => acao("conferir", async () => { const r = await preparar(fichaId, { conta }); if (r && !r.ok && r.conflito) autoConferida.current = ""; return r; }), [fichaId, conta]); // eslint-disable-line react-hooks/exhaustive-deps

  // Conferência AUTOMÁTICA ao abrir (e ao trocar a conta), se estiver desatualizada.
  useEffect(() => {
    if (!row || !conta || rodando) return;
    // (05/11) Uma conferência por versão dos dados (estoque, conta, aplicações… mudaram → confere de novo).
    const chave = `${row.id}|${conta}|${assinaturaEntrada(entradaDaFicha(row), conta)}`;
    const p = preparoAtual(row);
    if (p.valido && p.preparo?.conta === conta) return;
    if (autoConferida.current === chave) return;
    autoConferida.current = chave;
    conferir();
  }, [row, conta, rodando, conferir]);

  if (!fichaId) return <>{depoisDaConta}<p className="pr-aviso" data-pv-finalizar-sem-ficha>☁️ Salve a ficha na conta (informe o código) para finalizar.</p></>;
  if (!row && leitura.estado === "nao-encontrada") return (
    <>
      <div className="pr-aviso" data-pv-finalizar-nao-encontrada>
        <strong>⚠️ A ficha deste rascunho não foi encontrada na conta em que você está.</strong><br />
        Ela pode ter sido excluída ou criada com outro login. O rascunho e as fotos continuam guardados neste aparelho. Nada foi enviado ao Bling nem ao Mercado Livre. <small>(ficha {String(fichaId).slice(0, 8)})</small>
        <div className="pr-linha" style={{ marginTop: 8 }}>
          <button type="button" className="pr-botao pr-grande" onClick={lerDeNovo} disabled={diag.lendo} data-pv-finalizar-ler-de-novo>{diag.lendo ? "⏳ Lendo a conta…" : "🔄 Ler de novo"}</button>
        </div>
        {diag.d && <p role="status" data-pv-diagnostico={diag.d.estado} style={{ marginTop: 8 }}>{textoDiagnostico(diag.d)}</p>}
        {diag.d?.estado === "nao-encontrada" && aoTrocarFicha && (
          <div data-pv-diagnostico-opcoes style={{ display: "grid", gap: 8 }}>
            {diag.d.candidatas.map((c) => (
              <button key={c.id} type="button" className="pr-botao pr-grande" onClick={() => aoTrocarFicha(c.id)} data-pv-usar-ficha={c.id}>
                ↪ Usar a ficha {c.id.slice(0, 8)} desta conta{c.titulo ? ` (${c.titulo.slice(0, 40)})` : ""}
              </button>
            ))}
            {!diag.d.candidatas.length && (
              <>
                <button type="button" className="pr-botao pr-grande" onClick={() => { if (window.confirm(`Criar a ficha nesta conta (${diag.d.usuario?.email || ""}) a partir deste rascunho?\n\nO rascunho e as fotos deste aparelho são usados; nada é publicado. Se você excluiu essa ficha de propósito, toque em Cancelar.`)) aoTrocarFicha(""); }} data-pv-criar-ficha-conta>
                  ➕ Criar a ficha nesta conta com este rascunho
                </button>
                <p className="pr-fonte" style={{ margin: 0 }}>Use só se a ficha antiga não deveria ter sumido (ex.: outro login). Ficha excluída de propósito não é recriada sozinha.</p>
              </>
            )}
          </div>
        )}
      </div>
      {depoisDaConta}
    </>
  );
  if (!row && leitura.estado === "erro") return <><p className="pr-aviso" data-pv-finalizar-erro-leitura>⚠️ Não consegui ler a ficha agora{leitura.erro ? ` (${leitura.erro})` : ""}. Nada foi enviado. <button type="button" className="pr-link" onClick={recarregar} data-pv-finalizar-ler-de-novo>Tentar de novo</button></p>{depoisDaConta}</>;
  if (!row) return <><p className="pr-fonte" data-pv-finalizar="carregando">⏳ Lendo a ficha…</p>{depoisDaConta}</>;
  const sit = situacaoFinalizar(row, { autorizarBling, semCompatibilidade, liberado, marcar });
  const d = sit.revisao.dados;
  const marcadas = sit.ops.filter((o) => o.marcada).map((o) => o.id);
  const temFalha = sit.ops.some((o) => ["erro", "incerto", "bloqueado", "executando"].includes(o.estado));
  const tudoFeito = marcadas.length > 0 && sit.ops.filter((o) => o.marcada).every((o) => o.estado === "ok");
  const versaoOk = versao.estado === "ok" || versao.estado === "sem-versao";
  const assinaturaAgora = `${conta}|${versao.atual || ""}|${assinaturaFinalizar(row, marcadas)}|${autorizarBling}|${semCompatibilidade}`;
  const confirmo = Boolean(confirmoAss) && confirmoAss === assinaturaAgora && versaoOk;
  const podeAutorizar = sit.podeExecutar && versaoOk;
  const preparoRow = row?.dados_conferencia?.paiia_voz?.preparo || null;
  async function buscarCategoria() {
    setCat((c) => ({ ...c, carregando: true, erro: "" }));
    const f = depsTeste()?.buscarCategorias || buscarCategoriasEmOutra;
    let r;
    try { r = await f(fichaId, cat.termo || d.titulo, { conta }); } catch (e) { r = { ok: false, erro: e?.message || String(e) }; }
    setCat((c) => ({ ...c, carregando: false, avaliacao: r.ok ? r.avaliacao : c.avaliacao, erro: r.ok ? "" : r.erro || "Não consegui buscar." }));
  }
  const escolherCategoria = (candidata, revisao) => acao("categoria", async () => {
    const av = cat.avaliacao || preparoRow?.verificacoes?.categoria?.avaliacao || null;
    const r = await confirmarCategoriaEscolhidaEGravar(fichaId, preparoRow, { candidata, avaliacao: av, revisao });
    if (r.ok) setCat({ aberta: false, termo: "", avaliacao: null, carregando: false, erro: "" });
    return r.ok ? preparar(fichaId, { conta }) : r;
  });

  // (Passo 7) Seguir para a Publicação da MESMA ficha: usa o que já foi conferido (categoria,
  // frete oficial, conta), grava a aprovação desta tela e entrega à Publicação existente.
  // Não publica: a publicação real continua exigindo a autorização final na Publicação.
  const rev = montarRevisao(row);
  // (Etapa 3) SKU ausente no Bling não é "decisão": vira a autorização dentro do "Finalizar e Enviar".
  const blingAusente = skuAusenteNoBling(row) && estadoFinalizacao(row).ops?.bling_criar?.estado !== "ok";
  const faltaRev = rev.pendencias.filter((p) => p.tipo !== "aviso" && !(p.id === "bling" && blingAusente));
  const jaNaPublicacao = row?.dados_conferencia?.ficha?.etapa === "publicacao" && !row?.dados_conferencia?.etapa_fluxo;
  const abrirPublicacao = (id) => (aoAbrirPublicacao ? aoAbrirPublicacao(id) : window.location.assign(`/?tela=mercadoLivreTeste&ficha=${encodeURIComponent(id)}`));
  const lerAgora = async () => (await (depsTeste()?.lerFicha || lerFichaNovoAnuncio)(fichaId))?.ficha || null;
  const seguirParaPublicacao = () => acao("publicacao", async () => {
    if (jaNaPublicacao) { abrirPublicacao(fichaId); return { ok: true }; }
    // (Etapa 3) 1) Bling: SÓ com a sua autorização. O executor confere antes (já existe → não cria)
    // e registra na ficha; um segundo toque não repete o que já foi feito.
    if (blingAusente) {
      if (!autorizoCadastro) return { ok: false, erro: "Marque a autorização para cadastrar o produto no Bling." };
      const r = await executarFinalizacao(fichaId, { marcadas: ["bling_criar"], autorizacao: { confirmada: true, em: new Date().toISOString(), por: usuarioId, sessao, assinatura: assinaturaFinalizar(row, ["bling_criar"]) }, deps });
      setResultado(r);
      if (!r?.ok) return { ok: false, erro: `Bling: ${r?.erro || "não concluído"} O que já foi feito ficou salvo; corrija e toque de novo.` };
      const c = await preparar(fichaId, { conta }); // reconfere: o Bling agora tem o SKU
      if (c && c.ok === false) return c;
      const nova = await lerAgora();
      const r2 = montarRevisao(nova);
      const falta2 = r2.pendencias.filter((x) => x.tipo !== "aviso");
      if (!r2.podeAprovar) return { ok: false, erro: `Falta resolver: ${falta2[0]?.texto || "conferência"}. O cadastro no Bling ficou salvo.` };
      const a = await (depsTeste()?.aprovarRevisao || aprovarRevisaoEGravar)(fichaId, { usuario: usuarioId });
      if (!a?.ok) return a || { ok: false, erro: "Não consegui gravar a aprovação." };
    } else if (!rev.aprovada) {
      const a = await (depsTeste()?.aprovarRevisao || aprovarRevisaoEGravar)(fichaId, { usuario: usuarioId });
      if (!a?.ok) return a || { ok: false, erro: "Não consegui gravar a aprovação." };
    }
    const p = await (depsTeste()?.prepararPublicacao || prepararPublicacaoVoz)(fichaId);
    if (!p?.ok) return p || { ok: false, erro: "Não consegui preparar a Publicação." };
    if (p.fichaId && p.fichaId !== fichaId) return { ok: false, erro: "A Publicação não é desta ficha: nada foi aberto." };
    abrirPublicacao(fichaId);
    return p;
  });
  const decisao = faltaRev[0] || null;
  const botaoDecisao = (x) => {
    if (x.id === "categoria" && x.sugerida) return <button type="button" className="pr-botao pr-grande" disabled={Boolean(rodando)} data-pv-resolver="categoria" onClick={() => acao("categoria", async () => { const r = await confirmarCategoriaEGravar(fichaId, row?.dados_conferencia?.paiia_voz?.preparo); return r.ok ? preparar(fichaId, { conta }) : r; })}>✅ Confirmar categoria: {x.sugerida}</button>;
    if (x.id === "categoria") return <button type="button" className="pr-botao pr-grande" disabled={Boolean(rodando)} data-pv-resolver="categoria-buscar" onClick={() => setCat((c) => ({ ...c, aberta: true }))}>🔎 Escolher a categoria</button>;
    // Falta o motor: as opções do catálogo do ML para o modelo/período (uma pergunta, nada presumido).
    if (x.id === "compatibilidade" && x.perguntaMotor?.opcoes?.length && aoDefinirMotor) return (
      <div style={{ display: "grid", gap: 8 }} data-pv-pergunta-motor>
        {x.perguntaMotor.opcoes.map((m) => (
          <button key={m} type="button" className="pr-botao pr-grande" disabled={Boolean(rodando)} data-pv-motor={m} onClick={() => aoDefinirMotor(x.perguntaMotor, m)}>Motor {m}</button>
        ))}
        {aoIrEtapa && <button type="button" className="pr-link" onClick={() => aoIrEtapa("compat")} data-pv-motor-nenhum>Nenhuma destas (ajustar a compatibilidade)</button>}
      </div>
    );
    if (x.id === "modalidade") return <button type="button" className="pr-botao pr-grande" disabled={Boolean(rodando)} data-pv-resolver="modalidade" onClick={() => acao("modalidade", async () => { const r = await definirModalidadeEGravar(fichaId, "premium"); return r.ok ? preparar(fichaId, { conta }) : r; })}>Usar Premium (padrão da loja)</button>;
    const etapa = ETAPA_DA_PENDENCIA(x);
    if (etapa && aoIrEtapa) return <button type="button" className="pr-botao pr-grande" data-pv-resolver={`etapa:${etapa}`} onClick={() => aoIrEtapa(etapa)}>✏️ {etapa === "compat" ? "Ajustar a compatibilidade (ex.: motor e anos)" : "Resolver"}</button>;
    return <button type="button" className="pr-botao pr-grande" disabled={Boolean(rodando) || !conta} data-pv-resolver="conferir" onClick={conferir}>🔄 {x.id === "conferir" ? "Conferir agora" : "Conferir de novo"}</button>;
  };

  async function executar() {
    if (rodando || !confirmo || !podeAutorizar) return;
    const v = await conferirVersao(); // de novo, na hora de executar
    if (!(v.estado === "ok" || v.estado === "sem-versao")) { setConfirmoAss(""); return; }
    const autorizacao = { semCompatibilidade: sit.semCompatibilidade, confirmada: true, em: new Date().toISOString(), por: usuarioId, sessao, assinatura: assinaturaFinalizar(row, marcadas) };
    await acao("executar", async () => {
      const r = await executarFinalizacao(fichaId, { marcadas, autorizacao, deps });
      setResultado(r);
      return r.ok ? r : { ok: false, erro: r.erro };
    });
  }

  return (
    <div className="pr-cartao" data-pv-finalizar-topo data-pv-finalizar={tudoFeito ? "concluido" : sit.podeExecutar ? "pronto" : "pendente"}>
      {/* (Passo 7) O próximo passo, sozinho no topo: ou UMA decisão pendente, ou seguir para a Publicação. */}
      <div className="pr-cartao" data-pv-seguir={!conta ? "conta" : rodando === "conferir" ? "conferindo" : jaNaPublicacao || (!decisao && (rev.podeAprovar || blingAusente)) ? "publicacao" : "decisao"}>
        {!conta ? (
          <p data-pv-seguir-texto>1️⃣ Escolha abaixo a conta do Mercado Livre. A categoria e o frete oficial são conferidos sozinhos.</p>
        ) : rodando === "conferir" ? (
          <p data-pv-seguir-texto>⏳ Conferindo categoria, frete oficial, duplicidade e Bling no Mercado Livre (só leitura)…</p>
        ) : jaNaPublicacao || (!decisao && (rev.podeAprovar || blingAusente)) ? (
          <>
            {blingAusente && (
              <label className="pr-check" data-pv-autorizo-bling-cadastro>
                <input type="checkbox" checked={autorizoCadastro} disabled={Boolean(rodando)} onChange={(e) => setAutorizoCadastro(e.target.checked)} />
                <span>Autorizo cadastrar no Bling o produto <b>{entradaDaFicha(row).codigo}</b> com o estoque da ficha (<b>{entradaDaFicha(row).quantidade || "?"}</b> un.). O PAIIA confere antes e não duplica.</span>
              </label>
            )}
            <button type="button" className="pr-botao pr-grande" disabled={Boolean(rodando) || (blingAusente && !autorizoCadastro)} onClick={seguirParaPublicacao} data-pv-continuar-publicacao>
              {rodando === "publicacao" ? "⏳ Finalizando…" : "✅ Finalizar e Enviar"}
            </button>
            <p className="pr-fonte">{blingAusente ? "Cadastra no Bling (com a sua autorização) e abre" : "Abre"} a Publicação desta mesma ficha, com fotos e dados conferidos. A publicação no Mercado Livre só acontece depois da sua confirmação final.</p>
            {/* (Etapa 2) Categoria selecionada + só "Alterar categoria"; modalidade Clássico com troca opcional. */}
            {row?.dados_conferencia?.paiia_voz?.preparo?.verificacoes?.categoria?.estado === "ok" && (
              <p className="pr-fonte" data-pv-categoria-selecionada>
                Categoria: <b>{(() => { const c = row.dados_conferencia.paiia_voz.preparo.verificacoes.categoria; return c.caminho || (String(c.texto || "").match(/— (.+?) \(/) || [])[1] || c.id; })()}</b>{" "}
                <button type="button" className="pr-link" onClick={() => setCat((c) => ({ ...c, aberta: true }))} data-pv-alterar-categoria>Alterar categoria</button>
              </p>
            )}
            <p className="pr-fonte" data-pv-modalidade>
              Modalidade: <b>{rev.dados?.modalidade || "Clássico"}</b>{rev.dados?.modalidade !== "Premium" && (
                <> · <button type="button" className="pr-link" disabled={Boolean(rodando)} onClick={() => acao("modalidade", async () => { const r = await definirModalidadeEGravar(fichaId, "premium"); return r.ok ? preparar(fichaId, { conta }) : r; })} data-pv-trocar-premium>trocar para Premium</button></>
              )}
            </p>
          </>
        ) : decisao ? (
          <>
            <p data-pv-seguir-texto><b>Falta resolver{faltaRev.length > 1 ? ` (1 de ${faltaRev.length})` : ""}:</b> {decisao.texto}</p>
            {botaoDecisao(decisao)}
          </>
        ) : (
          <>
            <p data-pv-seguir-texto>As conferências ainda não estão prontas.</p>
            <button type="button" className="pr-botao pr-grande" disabled={Boolean(rodando)} data-pv-resolver="conferir" onClick={conferir}>🔄 Conferir agora</button>
          </>
        )}
      </div>
      <p><b>✅ Finalizar anúncio</b> — confere sozinho no Bling e no Mercado Livre (só leitura). Só executa o que você autorizar.</p>
      {!versaoOk && versao.estado !== "conferindo" && (
        <div className="pr-cartao" data-pv-finalizar-versao={versao.estado} style={{ borderColor: "#b45309", background: "#422006" }}>
          {versao.estado === "desatualizada"
            ? <p>⚠️ <b>Esta página está numa versão antiga do PAIIA.</b> Atualize antes de autorizar (a ficha e as fotos continuam guardadas).</p>
            : <p>⚠️ Não consegui conferir se esta página é a versão atual do site. A autorização fica bloqueada até conferir.</p>}
          <div className="pr-linha">
            {versao.estado === "desatualizada"
              ? <button type="button" className="pr-botao" onClick={() => window.location.reload()} data-pv-finalizar-atualizar>Atualizar agora</button>
              : <button type="button" className="pr-link" onClick={conferirVersao} data-pv-finalizar-versao-de-novo>Conferir de novo</button>}
          </div>
        </div>
      )}
      {/* (04/11) 1º: a conta de destino (trocar a conta refaz as conferências dela e pede nova autorização). */}
      <div data-pv-finalizar-contas>
        <span className="pr-rotulo">1. Conta de destino no Mercado Livre</span>
        <div className="pr-linha" role="radiogroup" aria-label="Conta de destino" style={{ gap: 6 }}>
          {[...(conta && !contas.some((c) => String(c.ml_user_id) === conta) ? [{ ml_user_id: conta }] : []), ...contas]
            .map((c) => ({ id: String(c.ml_user_id), nome: nomeDaLoja(c.ml_user_id, c.nickname) }))
            .sort((a, b) => (ORDEM_CONTAS.indexOf(a.nome) + 99) % 99 - (ORDEM_CONTAS.indexOf(b.nome) + 99) % 99)
            .map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={c.id === conta} className={`pr-conta ${c.id === conta ? "pr-conta-on" : ""}`} disabled={Boolean(rodando)}
                onClick={() => { if (c.id === conta) return; setConta(c.id); setConfirmo(false); }} data-pv-conta-opcao={c.nome} data-escolhida={c.id === conta ? "sim" : "nao"}>
                {c.id === conta ? "✔ " : ""}{c.nome}
              </button>
            ))}
        </div>
        {!conta && <p className="pr-aviso" data-pv-finalizar-sem-conta>Escolha a conta para conferir frete, categoria, duplicidade e compatibilidades.</p>}
        <button type="button" className="pr-link" disabled={Boolean(rodando) || !conta} onClick={conferir} data-pv-finalizar-reconferir>{rodando === "conferir" ? "⏳ Conferindo…" : "🔄 Conferir de novo"}</button>
      </div>
      {depoisDaConta}
      {erro && <p className="pr-aviso" data-pv-finalizar-erro>⚠️ {erro}</p>}

      <dl className="pr-resumo" data-pv-finalizar-dados>
        <dt>SKU</dt><dd>{d.sku || "—"}</dd>
        <dt>Título</dt><dd>{d.titulo || "—"}</dd>
        <dt>Marca</dt><dd>{d.marca || "—"}</dd>
        <dt>Fotos</dt><dd>{d.fotos.length}</dd>
        <dt>Preço · estoque</dt><dd>{d.preco} · {d.estoque || "—"} un.</dd>
        <dt>Custo</dt><dd>{String(row?.dados_conferencia?.paiia_voz?.complemento?.custo || "").trim() || "— (opcional)"}</dd>
        <dt>Peso/medidas</dt><dd>{d.medida || "—"}</dd>
        <dt>Frete ML</dt><dd>{d.frete || "—"}</dd>
        <dt>Categoria</dt><dd>{d.categoria || "—"}{d.categoria && !cat.aberta && <> <button type="button" className="pr-link" disabled={Boolean(rodando)} onClick={() => setCat((c) => ({ ...c, aberta: true, termo: c.termo || d.titulo }))} data-pv-categoria-trocar>Trocar</button></>}</dd>
        <dt>Compatibilidades</dt>
        <dd data-pv-finalizar-compat>
          <span data-pv-compat-informadas>Informadas e confirmadas por você: {d.aplicacoes.length}{d.aplicacoes.length ? ` (${d.aplicacoes.join(" · ")})` : ""}</span><br />
          <span data-pv-compat-validadas>Validadas pelo catálogo do Mercado Livre: {sit.compat.validadas}</span>
        </dd>
      </dl>
      <details className="pr-fonte" data-pv-finalizar-descricao><summary>Descrição ({d.descricao.trim() ? "ver" : "vazia"})</summary><pre className="pr-previa">{d.descricao || "—"}</pre></details>
      {Object.entries(row?.dados_conferencia?.paiia_voz?.preparo?.verificacoes || {}).length > 0 && (
        <ul className="pr-fonte" data-pv-finalizar-conferencias style={{ margin: 0, paddingLeft: 18 }}>
          {Object.entries(row.dados_conferencia.paiia_voz.preparo.verificacoes).map(([k, v]) => <li key={k} data-pv-conferencia={k} data-estado={v?.estado}>{v?.estado === "ok" ? "✅" : ICONE[v?.estado] || "•"} {v?.texto}</li>)}
        </ul>
      )}

      {sit.pendencias.length > 0 && (
        <div data-pv-finalizar-pendencias>
          <strong>Pendências ({sit.pendencias.filter((p) => p.tipo !== "aviso").length})</strong>
          <ul className="pr-fonte" style={{ margin: 0, paddingLeft: 18 }}>
            {sit.pendencias.map((x) => (
              <li key={x.id} data-pv-pendencia={x.id} data-tipo={x.tipo}>
                {ICONE[x.tipo] || "•"} {x.texto}
                {x.id === "categoria" && x.sugerida && <> <button type="button" className="pr-link" disabled={Boolean(rodando)} onClick={() => acao("categoria", async () => { const r = await confirmarCategoriaEGravar(fichaId, row?.dados_conferencia?.paiia_voz?.preparo); return r.ok ? preparar(fichaId, { conta }) : r; })} data-pv-finalizar-categoria>Confirmar {x.sugerida}</button></>}
                {x.id === "categoria" && !cat.aberta && <> <button type="button" className="pr-link" disabled={Boolean(rodando)} onClick={() => setCat((c) => ({ ...c, aberta: true, termo: c.termo || d.titulo }))} data-pv-categoria-procurar>{x.sugerida ? "Não é esta — procurar outra" : "Procurar categoria"}</button></>}
                {x.id === "modalidade" && <> <button type="button" className="pr-link" disabled={Boolean(rodando)} onClick={() => acao("modalidade", async () => { const r = await definirModalidadeEGravar(fichaId, "premium"); return r.ok ? preparar(fichaId, { conta }) : r; })} data-pv-finalizar-premium>Usar Premium</button></>}
                {aoIrEtapa && x.ir && <> <button type="button" className="pr-link" onClick={() => aoIrEtapa(x.ir)}>→ ir</button></>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {cat.aberta && (
        <div className="pr-cartao pr-cinza" data-pv-categoria-busca>
          <div className="pr-linha pr-entre"><strong>Escolher a categoria</strong><button type="button" className="pr-link" onClick={() => setCat({ aberta: false, termo: "", avaliacao: null, carregando: false, erro: "" })} data-pv-categoria-fechar>Fechar</button></div>
          <p className="pr-fonte" style={{ margin: 0 }}>A categoria só vale depois que você confirmar. Mesma busca e mesmas regras da Conferência do computador.</p>
          {cat.erro && <p className="pr-aviso">⚠️ {cat.erro}</p>}
          <PainelCategoriaML
            carregando={cat.carregando}
            avaliacao={cat.avaliacao || preparoRow?.verificacoes?.categoria?.avaliacao || null}
            decisao={preparoRow?.categoria?.decisao || null}
            categoriaId={preparoRow?.categoria?.decisao?.confirmada?.id || ""}
            onConfirmar={escolherCategoria}
            onTrocar={() => setCat((c) => ({ ...c, aberta: true }))}
            termo={cat.termo}
            onTermo={(t) => setCat((c) => ({ ...c, termo: t }))}
            onBuscar={buscarCategoria}
          />
        </div>
      )}

      <div className="pr-cartao pr-cinza" data-pv-finalizar-operacoes>
        <strong>Operações — marque só o que você autoriza</strong>
        {sit.ops.map((o) => (
          <div key={o.id} data-pv-operacao={o.id} data-estado={o.estado}>
            {o.exigeAutorizacao ? (
              <label className="pr-check" style={{ alignItems: "flex-start" }}>
                <input type="checkbox" checked={autorizarBling} disabled={Boolean(rodando) || o.estado === "ok"} onChange={(e) => { setAutorizarBling(e.target.checked); setConfirmo(false); }} data-pv-autorizar-bling />
                <span><b>Autorizo criar o produto {d.sku} no Bling</b> com estoque inicial 0. <span className="pr-fonte">{o.detalhe}</span></span>
              </label>
            ) : o.automatica ? (
              <p style={{ margin: 0 }}>{o.marcada ? "☑" : "☐"} {ROTULOS_OPERACOES[o.id]} <span className="pr-fonte">— {o.detalhe}</span></p>
            ) : (
              <label className="pr-check" style={{ alignItems: "flex-start" }}>
                <input type="checkbox" checked={o.marcada} disabled={Boolean(rodando) || o.estado === "ok"} onChange={(e) => { const v = e.target.checked; setMarcar((m) => ({ ...m, [o.id]: v })); setConfirmo(false); }} data-pv-marcar-operacao={o.id} />
                <span><b>{ROTULOS_OPERACOES[o.id]}</b> <span className="pr-fonte">— {o.detalhe}</span></span>
              </label>
            )}
            <span className="pr-fonte" data-pv-operacao-estado>{rotuloEstado(o.estado)}{sit.registro.ops[o.id]?.erro ? ` · ${sit.registro.ops[o.id].erro}` : sit.registro.ops[o.id]?.resultado ? ` · ${sit.registro.ops[o.id].resultado}` : ""}</span>
          </div>
        ))}
        {sit.compatSemCatalogo && (
          <label className="pr-check" style={{ alignItems: "flex-start" }}>
            <input type="checkbox" checked={semCompatibilidade} disabled={Boolean(rodando)} onChange={(e) => { setSemCompatibilidade(e.target.checked); setConfirmo(false); }} data-pv-sem-compat />
            <span><b>Publicar sem compatibilidade do catálogo</b> <span className="pr-fonte">— o catálogo do Mercado Livre não confirmou os veículos; as aplicações ficam só na descrição. Nada é marcado na tabela.</span></span>
          </label>
        )}
        <p className="pr-fonte" style={{ margin: 0 }}>Estoque e cadastro oficiais do Bling: <b>não são alterados</b>. Vínculo automático só na LojaOnlineSP; REVELAÇÃO e CIEBR: vínculo manual.</p>
      </div>

      {!tudoFeito && (
        <>
          <label className="pr-check" data-pv-finalizar-confirmo>
            <input type="checkbox" checked={confirmo} disabled={!podeAutorizar || Boolean(rodando)} onChange={(e) => setConfirmoAss(e.target.checked ? assinaturaAgora : "")} />
            Conferi tudo e autorizo executar as operações marcadas
          </label>
          <button type="button" className="pr-botao pr-grande" disabled={!podeAutorizar || !confirmo || Boolean(rodando)} onClick={executar} data-pv-finalizar-executar>
            {rodando === "executar" ? "⏳ Executando…" : temFalha ? "🔁 Retomar operações autorizadas" : "Executar operações autorizadas"}
          </button>
          {!podeAutorizar && <p className="pr-fonte" data-pv-finalizar-motivo>{!sit.podeExecutar ? sit.motivo : "Atualize a página (versão nova do PAIIA) para autorizar."}</p>}
        </>
      )}
      {tudoFeito && <p className="pr-ok" data-pv-finalizar-concluido>✅ Todas as operações autorizadas foram concluídas{sit.registro.mlb ? ` · ${sit.registro.mlb}` : ""}.</p>}
      {resultado && !resultado.ok && <p className="pr-aviso" data-pv-finalizar-parou>Parou em “{ROTULOS_OPERACOES[resultado.parou] || "—"}”: {resultado.erro} Nada foi repetido.</p>}

      {!liberado && (
        <details className="pr-fonte" data-pv-rotina-atual>
          <summary>Publicar pela rotina atual (enquanto a execução desta tela não é liberada)</summary>
          <PreparoPublicacaoVoz fichaId={fichaId} usuarioId={usuarioId} />
        </details>
      )}
    </div>
  );
}
