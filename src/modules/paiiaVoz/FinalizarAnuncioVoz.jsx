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
import { prepararEGravar, confirmarCategoriaEGravar, definirModalidadeEGravar } from "./servicos/preparoVozService";
import { preparoAtual } from "./servicos/preparoConferenciaVoz";
import { situacaoFinalizar, executarFinalizacao, assinaturaFinalizar, publicacaoRealLiberada, ROTULOS_OPERACOES, rotuloEstado } from "./servicos/finalizarAnuncioVoz";
import { depsFinalizarReais } from "./servicos/finalizarDepsReais";
import PreparoPublicacaoVoz from "./PreparoPublicacaoVoz";

const ICONE = { pergunta: "❓", bloqueio: "⛔", erro: "⚠️", aguardando: "⏳", conferir: "🔎", aviso: "ℹ️" };
// Laboratório: ligações simuladas (só com o modo de teste do PAIIA ligado).
const depsTeste = () => (globalThis.__paiiaModoTeste && globalThis.__paiiaFinalizarDeps) || null;

const ORDEM_CONTAS = ["LOJA ONLINE", "REVELAÇÃO", "CIEBR"];

export default function FinalizarAnuncioVoz({ fichaId, usuarioId = "", aoIrEtapa = null, depoisDaConta = null }) {
  const estadoContas = useContasML();
  const contas = contasMLConectadas(estadoContas).filter((c) => String(c.ml_user_id || "").trim());
  const [contaEscolhida, setConta] = useState("");
  const [row, setRow] = useState(null);
  const [rodando, setRodando] = useState("");
  const [erro, setErro] = useState("");
  const [autorizarBling, setAutorizarBling] = useState(false);
  const [semCompatibilidade, setSemCompatibilidade] = useState(false);
  const [marcar, setMarcar] = useState({}); // (04/11) nenhuma operação vem marcada
  const [confirmo, setConfirmo] = useState(false);
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
    return r;
  }, [fichaId]);
  useEffect(() => {
    let ativo = true;
    (async () => {
      if (!fichaId) return;
      const r = await (depsTeste()?.lerFicha || lerFichaNovoAnuncio)(fichaId);
      if (ativo && r?.ok) setRow(r.ficha);
    })();
    return () => { ativo = false; };
  }, [fichaId]);

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
  const conferir = useCallback(() => acao("conferir", () => preparar(fichaId, { conta })), [fichaId, conta]); // eslint-disable-line react-hooks/exhaustive-deps

  // Conferência AUTOMÁTICA ao abrir (e ao trocar a conta), se estiver desatualizada.
  useEffect(() => {
    if (!row || !conta || rodando) return;
    const chave = `${row.id}|${conta}`;
    const p = preparoAtual(row);
    if (p.valido && p.preparo?.conta === conta) return;
    if (autoConferida.current === chave) return;
    autoConferida.current = chave;
    conferir();
  }, [row, conta, rodando, conferir]);

  if (!fichaId) return <>{depoisDaConta}<p className="pr-aviso" data-pv-finalizar-sem-ficha>☁️ Salve a ficha na conta (informe o código) para finalizar.</p></>;
  if (!row) return <><p className="pr-fonte" data-pv-finalizar="carregando">⏳ Lendo a ficha…</p>{depoisDaConta}</>;
  const sit = situacaoFinalizar(row, { autorizarBling, semCompatibilidade, liberado, marcar });
  const d = sit.revisao.dados;
  const marcadas = sit.ops.filter((o) => o.marcada).map((o) => o.id);
  const temFalha = sit.ops.some((o) => ["erro", "incerto", "bloqueado", "executando"].includes(o.estado));
  const tudoFeito = marcadas.length > 0 && sit.ops.filter((o) => o.marcada).every((o) => o.estado === "ok");

  async function executar() {
    if (rodando || !confirmo || !sit.podeExecutar) return;
    const autorizacao = { semCompatibilidade: sit.semCompatibilidade, confirmada: true, em: new Date().toISOString(), por: usuarioId, sessao, assinatura: assinaturaFinalizar(row, marcadas) };
    await acao("executar", async () => {
      const r = await executarFinalizacao(fichaId, { marcadas, autorizacao, deps });
      setResultado(r);
      return r.ok ? r : { ok: false, erro: r.erro };
    });
  }

  return (
    <div className="pr-cartao" data-pv-finalizar-topo data-pv-finalizar={tudoFeito ? "concluido" : sit.podeExecutar ? "pronto" : "pendente"}>
      <p><b>✅ Finalizar anúncio</b> — confere sozinho no Bling e no Mercado Livre (só leitura). Só executa o que você autorizar.</p>
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
        <dt>Categoria</dt><dd>{d.categoria || "—"}</dd>
        <dt>Compatibilidades</dt><dd>{d.aplicacoes.length ? d.aplicacoes.join(" · ") : "—"}</dd>
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
                {x.id === "modalidade" && <> <button type="button" className="pr-link" disabled={Boolean(rodando)} onClick={() => acao("modalidade", async () => { const r = await definirModalidadeEGravar(fichaId, "premium"); return r.ok ? preparar(fichaId, { conta }) : r; })} data-pv-finalizar-premium>Usar Premium</button></>}
                {aoIrEtapa && x.ir && <> <button type="button" className="pr-link" onClick={() => aoIrEtapa(x.ir)}>→ ir</button></>}
              </li>
            ))}
          </ul>
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
            <input type="checkbox" checked={confirmo} disabled={!sit.podeExecutar || Boolean(rodando)} onChange={(e) => setConfirmo(e.target.checked)} />
            Conferi tudo e autorizo executar as operações marcadas
          </label>
          <button type="button" className="pr-botao pr-grande" disabled={!sit.podeExecutar || !confirmo || Boolean(rodando)} onClick={executar} data-pv-finalizar-executar>
            {rodando === "executar" ? "⏳ Executando…" : temFalha ? "🔁 Retomar operações autorizadas" : "Executar operações autorizadas"}
          </button>
          {!sit.podeExecutar && <p className="pr-fonte" data-pv-finalizar-motivo>{sit.motivo}</p>}
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
