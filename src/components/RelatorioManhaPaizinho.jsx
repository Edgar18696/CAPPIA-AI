// =============================================================
// PAIIA — Central do Paizinho: RELATÓRIO DA MANHÃ (piloto LOJA ONLINE).
// Só mostra: nenhuma ação aqui altera anúncio, preço, estoque ou medida.
// (12/11) O botão de análise com dados reais (somente leitura) foi liberado
// também no site, por autorização do Edgar: roda neste navegador e guarda o
// resultado só nele. Antes existia apenas no ambiente local (npm run dev).
// =============================================================
import { useEffect, useState } from "react";
import {
  lerUltimoRelatorio, lerRelatorioTesteLocal, CONTAS_AUDITORIA, CONTA_PADRAO,
  abrirFila, analisarFila, registrarAcaoFila, enviarFilaDoNavegador, podeContinuar,
} from "../services/paizinhoAuditoria/relatorioService";
import { MODO, indicadores, pendenciasAbertas } from "../services/paizinhoAuditoria/filaAnuncios";
import PrioridadesPaizinho, { HistoricoFila } from "./PrioridadesPaizinho";
import EnviarParaPromocoes from "./EnviarParaPromocoes";
import AuditoriaAnuncios from "./AuditoriaAnuncios";
import { filtrarAnuncios } from "../services/paizinhoAuditoria/relatorioImpressao";

const LOCAL = true; // leitura no navegador liberada no site e no ambiente local
const reais = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const numero = (v) => (v === null || v === undefined ? "—" : Number(v).toLocaleString("pt-BR"));
// + = com as medidas do Bling o frete seria maior; − = menor.
const textoDiferenca = (d) => (d === null || d === undefined ? "—" : d === 0 ? "sem diferença" : `${d > 0 ? "+" : "−"}${reais(Math.abs(d))}`);
const hora = (iso) => { try { return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); } catch { return "—"; } };
// (Pacote 1) Período exato usado (dias inteiros de Brasília), para conferir com o painel do ML.
const diaBr = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "—");
function textoPeriodo(p) {
  const visitas = `Visitas: ${diaBr(p.visitas_de)} a ${diaBr(p.visitas_ate)}`;
  const vendas = p.vendas_30d_de
    ? `Vendas e faturamento: ${hora(p.vendas_30d_de)} a ${hora(p.vendas_ate)}`
    : "Vendas e faturamento: 30 dias até o horário da análise (análise anterior ao ajuste de dias inteiros)";
  return `📅 ${visitas} · ${vendas}`;
}
const COR ={ alta: "#f87171", media: "#fbbf24", baixa: "#60a5fa" };
const ROTULO = { alta: "Urgente", media: "Importante", baixa: "Acompanhar" };

// (17/11) Seletor das 3 contas (LOJA ONLINE é a padrão). Cada conta tem o seu relatório,
// a sua fila e o seu histórico: ao trocar, nada da conta anterior continua na tela.
const idDe = (c) => String(c?.id ?? c ?? "").replace(/\D/g, "");
const daConta = (rel, conta) => (rel && idDe(rel.conta) === conta ? rel : null);

export default function RelatorioManhaPaizinho() {
  const [conta, setConta] = useState(CONTA_PADRAO.id);
  const [servidor, setServidor] = useState({ estado: "carregando" });
  const [teste, setTeste] = useState(() => (LOCAL ? lerRelatorioTesteLocal(CONTA_PADRAO.id) : null));
  const [rodando, setRodando] = useState("");
  const [erroTeste, setErroTeste] = useState("");
  const [avisoFila, setAvisoFila] = useState("");
  const [limite, setLimite] = useState(20);
  const [concorrencia, setConcorrencia] = useState(0);
  const [verTeste, setVerTeste] = useState(LOCAL);
  const [fila, setFila] = useState(null); // { repo, estado, origem, avisoBanco, naoEnviados, conta }
  const [painel, setPainel] = useState(""); // "", "historico", "pendencias"
  const [busca, setBusca] = useState(""); // (18/11) busca do topo: comanda a lista de anúncios
  const [ultimoModo, setUltimoModo] = useState(MODO.NOVOS); // (Pacote 1) para "Continuar de onde parou"
  const contaAtual = CONTAS_AUDITORIA.find((c) => c.id === conta) || CONTA_PADRAO;

  useEffect(() => {
    let vivo = true;
    lerUltimoRelatorio(conta).then((r) => { if (vivo) setServidor({ ...r, conta }); });
    abrirFila(conta)
      .then((f) => { if (vivo) setFila({ ...f, conta }); })
      .catch((e) => { if (vivo) setFila({ conta, erro: String(e?.message || e) }); });
    return () => { vivo = false; };
  }, [conta]);

  function escolherConta(id) {
    if (rodando || id === conta) return;
    setConta(id);
    setServidor({ estado: "carregando" });
    setTeste(LOCAL ? lerRelatorioTesteLocal(id) : null);
    setErroTeste("");
    setAvisoFila("");
    setFila(null);
    setPainel("");
    setBusca("");
    setVerTeste(LOCAL);
  }

  const filaDaConta = fila?.conta === conta && fila.estado ? fila : null;

  // (Pacote 1) continuar = retoma a rodada interrompida pela queda do login (mesma conta e tipo).
  async function rodar(modo, continuar = false) {
    if (!filaDaConta) return;
    setErroTeste("");
    setAvisoFila("");
    setRodando("Começando…");
    setUltimoModo(modo);
    const alvo = conta;
    try {
      const r = await analisarFila({ conta: alvo, modo, quantidade: limite, concorrencia, aoProgredir: setRodando, fila: filaDaConta, continuar });
      setTeste(daConta(r.rel, alvo));
      setVerTeste(true);
      setFila((f) => (f?.conta === alvo ? { ...f, estado: r.estado } : f));
      setAvisoFila(r.registrada
        ? `✔ ${r.rodada.anuncios.length} anúncio(s) ${modo === MODO.NOVOS ? "inéditos analisados" : "reanalisados"} e registrados na fila da ${contaAtual.nome}.`
        : `⚠️ ${r.erro}`);
    } catch (e) {
      setErroTeste(String(e?.message || e));
    }
    setRodando("");
  }

  async function agir(acao, achado, motivo) {
    if (!filaDaConta) return { ok: false, erro: "Fila não carregada." };
    const r = await registrarAcaoFila(filaDaConta, { acao, achado, motivo });
    if (r.ok) {
      const estado = r.estado || (await filaDaConta.repo.carregar());
      setFila((f) => (f?.conta === conta ? { ...f, estado } : f));
    }
    return r;
  }

  async function enviarAoBanco() {
    const r = await enviarFilaDoNavegador(conta);
    setAvisoFila(r.ok ? `✔ Registro deste navegador enviado ao banco (${r.enviados} novo(s), ${r.jaExistiam} já existiam).` : `⚠️ Envio parou: ${r.erro}`);
    const f = await abrirFila(conta);
    setFila({ ...f, conta });
  }

  const doServidor = servidor.conta === conta && servidor.estado === "ok" && servidor.registro?.status === "concluido" ? daConta(servidor.registro.relatorio, conta) : null;
  const testeDaConta = daConta(teste, conta);
  const rel = verTeste && testeDaConta ? testeDaConta : doServidor || (LOCAL ? testeDaConta : null);
  const ind = filaDaConta ? indicadores(filaDaConta.estado) : null;
  const ocupado = Boolean(rodando) || !filaDaConta;
  const abertas = filaDaConta ? pendenciasAbertas(filaDaConta.estado).length : null;
  const urgentes = rel ? filtrarAnuncios(rel, "urgentes").length : null;

  return (
    <section style={S.caixa} data-paizinho-relatorio-manha data-paizinho-conta={conta}>
      <div style={S.topo}>
        <div>
          <h2 style={S.titulo}>☀️ Relatório da manhã — {contaAtual.nome}</h2>
          <p style={S.sub}>{rel ? `Gerado em ${hora(rel.gerado_em)} · ${rel.origem === "teste_local" ? "ANÁLISE FEITA NESTE NAVEGADOR" : "rotina automática das 03h"}` : `${textoEstado(servidor)}${LOCAL ? ` Nenhuma análise da ${contaAtual.nome} feita neste navegador ainda.` : ""}`}</p>
          {rel?.periodo && <p style={S.sub} data-paiia-periodo>{textoPeriodo(rel.periodo)}</p>}
        </div>
      </div>

      {LOCAL && (
        <div style={S.teste} data-paizinho-teste-local>
          {/* (18/11) Tela simples: contas → 4 números + busca → Analisar novos → lista com "Corrigir". */}
          <div style={S.linha} role="group" aria-label="Conta do Mercado Livre" data-paizinho-seletor-conta>
            {CONTAS_AUDITORIA.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => escolherConta(c.id)}
                disabled={Boolean(rodando) && c.id !== conta}
                aria-pressed={c.id === conta}
                style={c.id === conta ? S.chipAtivo : S.chip}
                data-paizinho-conta-botao={c.nome}
              >
                {c.id === conta ? "● " : ""}{c.nome}
              </button>
            ))}
          </div>

          {/* (18/11) Só 4 números + busca no topo; os 5 indicadores da fila foram para o "Relatório completo". */}
          <div style={S.numeros} data-paizinho-numeros-principais>
            <Numero rotulo="Analisados / restantes" valor={ind ? `${numero(ind.analisados)} / ${ind.restantes == null ? "—" : numero(ind.restantes)}` : "…"} />
            <Numero rotulo="Pendências abertas" valor={abertas == null ? "…" : numero(abertas)} cor={abertas ? COR.media : undefined} />
            <Numero rotulo="Urgentes" valor={urgentes == null ? "—" : numero(urgentes)} cor={urgentes ? COR.alta : undefined} />
            <label style={S.buscaCaixa}>
              <small style={S.kpiRotulo}>Buscar</small>
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar SKU, MLB ou produto" style={S.buscaTopo} aria-label="Buscar SKU, MLB ou produto" data-paizinho-busca />
            </label>
          </div>

          <div style={S.linha} data-paizinho-fila-acessos>
            <button type="button" onClick={() => rodar(MODO.NOVOS)} disabled={ocupado} style={S.botao} data-paizinho-rodar-teste data-paizinho-analisar-novos>{rodando ? "⏳ Analisando…" : "Analisar novos"}</button>
            {/* (18/11) Ações secundárias como links pequenos. */}
            <span style={S.secundarias}>
              <button type="button" onClick={() => setPainel(painel === "historico" ? "" : "historico")} disabled={!filaDaConta} style={painel === "historico" ? S.linkAtivo : S.linkBotao} data-paizinho-fila-historico>Histórico</button>
              <span aria-hidden="true">·</span>
              <button type="button" onClick={() => setPainel(painel === "pendencias" ? "" : "pendencias")} disabled={!filaDaConta} style={painel === "pendencias" ? S.linkAtivo : S.linkBotao} data-paizinho-fila-pendencias>Revisar pendências{ind?.pendentes ? ` (${ind.pendentes})` : ""}</button>
              <span aria-hidden="true">·</span>
              <button type="button" onClick={() => rodar(MODO.REANALISE)} disabled={ocupado || !ind?.analisados} style={S.linkBotao} data-paizinho-reanalisar>Reanalisar</button>
            </span>
          </div>
          {/* (18/11) Ajuda recolhida em uma linha. */}
          <details style={S.ajuda}>
            <summary style={{ cursor: "pointer" }}>Só leitura · mantenha a página aberta durante a leitura. Como funciona</summary>
            Lê a conta {contaAtual.nome} no Mercado Livre e os custos/medidas no Bling. Nada é alterado no Mercado Livre nem no Bling. "Analisar novos" pega só anúncios nunca analisados nesta conta; o progresso continua de onde parou. Mantenha esta página aberta e não use "Sair" durante a leitura.
          </details>
          {rodando && <span style={S.ajuda}>⏳ {rodando}</span>}
          {erroTeste && <span style={S.erro}>❌ {erroTeste}</span>}
          {avisoFila && <span style={avisoFila.startsWith("✔") ? S.ok : S.erro} data-paizinho-fila-aviso>{avisoFila}</span>}
          {/* (18/11) Origem da fila (banco/navegador) recolhida: é informação técnica. */}
          {fila?.conta === conta && fila.avisoBanco && <details style={S.ajuda} data-paizinho-fila-origem><summary style={{ cursor: "pointer" }}>💾 Progresso guardado neste navegador (por quê)</summary>{fila.avisoBanco}</details>}
          {fila?.conta === conta && fila.erro && <span style={S.erro}>❌ Fila: {fila.erro}</span>}
          {filaDaConta?.naoEnviados > 0 && (
            <span style={S.ajuda}>Há {filaDaConta.naoEnviados} registro(s) desta conta guardados neste navegador antes do banco existir. <button type="button" style={S.chip} onClick={enviarAoBanco} disabled={ocupado}>Enviar para o banco</button></span>
          )}

          {painel === "historico" && filaDaConta && (
            <div data-paizinho-painel-historico>
              <h3 style={S.h3}>🗂️ Histórico — {contaAtual.nome}</h3>
              <HistoricoFila estado={filaDaConta.estado} aoDevolver={(a) => agir("devolvido", a, "")} />
            </div>
          )}
          {painel === "pendencias" && filaDaConta && (
            <div data-paizinho-painel-pendencias>
              <h3 style={S.h3}>📌 Pendências em aberto — {contaAtual.nome}</h3>
              <PrioridadesPaizinho rel={{ conta: { id: conta } }} lista={pendenciasAbertas(filaDaConta.estado)} estado={filaDaConta.estado} aoAgir={agir} vazio="Nenhuma pendência em aberto nesta conta." />
            </div>
          )}
        </div>
      )}

      {rel?.leitura_incompleta ? (
        <AvisoLeituraIncompleta
          info={rel.leitura_incompleta}
          continuar={LOCAL && rel === testeDaConta && !rodando && filaDaConta && podeContinuar(conta, ultimoModo, limite) ? () => rodar(ultimoModo, true) : null}
        />
      ) : null}
      {rel ? <AvisoLeiturasComerciais rel={rel} /> : null}
      {/* (18/11) Lista operacional: abrir → ver o problema → corrigir → próximo anúncio. */}
      {rel ? <AuditoriaAnuncios key={`${conta}-${rel.gerado_em}`} rel={rel} busca={busca} estado={filaDaConta?.estado} aoAgir={agir} /> : null}

      {/* (18/11) Todo o resto (indicadores, prioridades, oportunidades, fretes, Renault, detalhes,
          limitações e opções avançadas) fica aqui, fechado. Nada foi apagado. */}
      <details style={S.completo} data-paizinho-relatorio-completo>
        <summary style={S.resumoCompleto}>📊 Relatório completo</summary>
        {LOCAL && (
          <>
            <div style={S.kpis} data-paizinho-fila-indicadores>
              <Kpi rotulo="Total de anúncios" valor={ind?.total == null ? "— (após a 1ª rodada)" : numero(ind.total)} />
              <Kpi rotulo="Já analisados" valor={ind ? numero(ind.analisados) : "…"} />
              <Kpi rotulo="Restantes (inéditos)" valor={ind?.restantes == null ? "—" : numero(ind.restantes)} />
              <Kpi rotulo="Com pendências" valor={ind ? numero(ind.pendentes) : "…"} cor={ind?.pendentes ? COR.media : undefined} />
              <Kpi rotulo="Resolvidos" valor={ind ? numero(ind.resolvidos) : "…"} />
            </div>
            {/* (18/11) "Opções avançadas" (fechado; padrões iguais): quantidade por rodada, concorrência e origem do relatório. */}
            <details style={{ ...S.ajuda, marginTop: 10 }} data-paizinho-opcoes-avancadas>
              <summary style={{ cursor: "pointer" }}>Opções avançadas</summary>
              {doServidor && testeDaConta && (
                <div style={S.linha}>
                  <span>Mostrar o relatório:</span>
                  <button type="button" style={verTeste ? S.chipAtivo : S.chip} onClick={() => setVerTeste(true)}>Neste navegador</button>
                  <button type="button" style={!verTeste ? S.chipAtivo : S.chip} onClick={() => setVerTeste(false)}>Servidor 03h</button>
                </div>
              )}
              <div style={S.linha}>
                <label style={S.rotulo}>Anúncios por rodada
                  <select value={limite} onChange={(e) => setLimite(Number(e.target.value))} style={S.select} disabled={Boolean(rodando)}>
                    {[20, 50, 100, 300, 500].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <label style={S.rotulo}>Concorrência (usa créditos SerpAPI)
                  <select value={concorrencia} onChange={(e) => setConcorrencia(Number(e.target.value))} style={S.select} disabled={Boolean(rodando)}>
                    {[0, 3, 5, 15].map((n) => <option key={n} value={n}>{n === 0 ? "não pesquisar" : `${n} anúncios`}</option>)}
                  </select>
                </label>
              </div>
            </details>
          </>
        )}
        {rel ? <Relatorio key={`${conta}-${rel.gerado_em}`} rel={rel} estado={filaDaConta?.estado} aoAgir={agir} /> : <p style={S.ajuda}>Nenhum relatório desta conta ainda.</p>}
      </details>
    </section>
  );
}

// (12/11) Leitura parcial fica evidente no topo: o relatório não é tratado como completo.
function AvisoLeituraIncompleta({ info, continuar }) {
  const { bling, recotacao, custo, sessao_expirada: sessao } = info;
  return (
    <div style={S.erro} role="alert" data-paizinho-leitura-incompleta>
      <strong>⚠️ Leitura incompleta — não valide este relatório como final.</strong>
      {bling ? <div>Bling lido em {bling.lidos} de {bling.total} SKUs.</div> : null}
      {recotacao ? <div>Frete recotado em {recotacao.feitas} de {recotacao.total} anúncios.</div> : null}
      {custo ? <div>Preço de custo lido em {custo.lidos} de {custo.total} SKUs.</div> : null}
      {sessao ? <div>O login do PAIIA caiu durante a leitura (por exemplo, "Sair" usado em outro aparelho). Entre de novo <b>sem recarregar a página</b> e clique em Continuar: o que já foi lido no Mercado Livre e no Bling é aproveitado, com o mesmo período.</div> : null}
      {sessao && continuar ? (
        <button type="button" onClick={continuar} style={S.botao} data-paizinho-continuar-leitura>▶️ Continuar de onde parou</button>
      ) : null}
    </div>
  );
}

// (17/11) Visitas ou vendas não lidas nesta conta (ex.: leitura comercial ainda não liberada
// para ela no servidor): o motivo aparece no topo, e nada de outra conta é usado no lugar.
function AvisoLeiturasComerciais({ rel }) {
  const linhas = (rel.limitacoes || []).filter((l) => /^(Visitas|Vendas) NÃO lidas/.test(l));
  if (!linhas.length) return null;
  return (
    <div style={{ ...S.erro, marginTop: 12 }} role="alert" data-paizinho-leitura-comercial-ausente>
      <strong>⚠️ {rel.conta?.nome || "Esta conta"}: leitura comercial incompleta.</strong>
      {linhas.map((l) => <div key={l}>{l}</div>)}
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

function Relatorio({ rel, estado, aoAgir }) {
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
        <Kpi rotulo={`Prejuízo calculado (custo real, 30 dias)${r.anuncios_com_custo ? ` · custo em ${numero(r.anuncios_com_custo)} de ${numero(r.anuncios_analisados)}` : ""}`} valor={r.prejuizo_estimado_30d == null ? (r.anuncios_com_custo === 0 ? "sem custo cadastrado" : "não lido") : reais(r.prejuizo_estimado_30d)} cor={r.prejuizo_estimado_30d ? COR.alta : undefined} />
        {r.prejuizo_a_confirmar_30d ? <Kpi rotulo={`Possível prejuízo (custo a confirmar, ${numero(r.anuncios_custo_a_confirmar)} anúncios)`} valor={reais(r.prejuizo_a_confirmar_30d)} /> : null}
        {r.fretes_medidas && <Kpi rotulo="Frete: impacto potencial (a confirmar)" valor={r.fretes_medidas.impacto_potencial_30d != null ? `${reais(r.fretes_medidas.impacto_potencial_30d)} / 30 dias` : `${reais(r.fretes_medidas.impacto_potencial_por_envio)} por envio`} />}
        <Kpi rotulo="Medidas ausentes" valor={numero(r.medidas_pendentes)} />
        <Kpi rotulo="Pontuação média" valor={`${r.pontuacao_media}/100`} />
      </div>

      {/* (18/11) A lista por anúncio ("Corrigir") fica no topo da tela, fora do relatório completo. */}
      <h3 style={S.h3}>🎯 Prioridades de hoje</h3>
      {/* (17/11) Conta ao lado do MLB, Central de Anúncios, Resolvido / Remover da lista (só a lista do PAIIA). */}
      <PrioridadesPaizinho rel={rel} estado={estado} aoAgir={aoAgir} textoPotencial={textoPotencial} />

      {rel.oportunidades.length > 0 && <>
        <h3 style={S.h3}>💡 Oportunidades comerciais</h3>
        <ListaAchados lista={rel.oportunidades} conta={rel.conta} />
      </>}

      <FretesMedidas rel={rel} celular={celular} />

      {rel.renault.length > 0 && <>
        <h3 style={S.h3}>🔧 Peças Renault ({rel.renault.length})</h3>
        {celular ? <div style={S.achados}>{rel.renault.map((l) => (
          <article key={l.item_id} style={{ ...S.achado, borderLeftColor: l.recomendacao === "manter" ? "#22c55e" : COR.media }}>
            <div style={S.linhaAchado}><a href={l.link} target="_blank" rel="noreferrer" style={S.link}>{l.item_id}</a>{l.sku && <span style={S.ajuda}>SKU {l.sku}</span>}<strong>{l.recomendacao}</strong><EnviarParaPromocoes conta={l.vendedor_id || rel.conta} anuncio={l} /></div>
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
                <td style={S.td}><strong>{l.recomendacao}</strong><br /><EnviarParaPromocoes conta={l.vendedor_id || rel.conta} anuncio={l} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>}
      </>}

      <h3 style={S.h3}>📋 Detalhes por assunto</h3>
      {secoesExtras.map((s) => (
        <details key={s.chave} style={S.detalhe}>
          <summary style={S.resumo}>{s.titulo} ({s.achados.length})</summary>
          <ListaAchados lista={s.achados} conta={rel.conta} />
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

function Numero({ rotulo, valor, cor }) {
  return <div style={S.numero}><small style={S.kpiRotulo}>{rotulo}</small><strong style={{ ...S.numeroValor, ...(cor ? { color: cor } : {}) }}>{valor}</strong></div>;
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
      {/* (18/11) Notas recolhidas em uma linha. */}
      <details style={S.ajuda}>
        <summary style={{ cursor: "pointer" }}>Pendente de conferência física · valores estimados. Detalhes</summary>
        Tudo aqui está <b>pendente de conferência física</b>. Diferenças de frete são <b>impacto potencial estimado</b>, não prejuízo confirmado. Nada é alterado no anúncio, no Bling ou no estoque.
        {fm?.divergencia_pequena > 0 && <> Além disso, {numero(fm.divergencia_pequena)} anúncio(s) têm diferença pequena entre ML e Bling, sem impacto relevante no frete (registrado nos dados, sem alerta).</>}
      </details>
      <div style={{ ...S.linha, marginTop: 8 }}>
        <button type="button" style={filtro === "todos" ? S.chipAtivo : S.chip} onClick={() => escolher("todos")}>Todos ({numero(grupos.length)} SKUs)</button>
        {Object.entries(classes).sort((a, b) => a[1].ordem - b[1].ordem).map(([c, info]) => (
          <button key={c} type="button" style={filtro === c ? S.chipAtivo : S.chip} onClick={() => escolher(c)}>
            <span style={{ color: COR_CLASSE[c] }}>●</span> {info.ordem <= 3 ? `${info.ordem}. ` : ""}{info.titulo} ({numero(fm?.[c] ?? 0)})
          </button>
        ))}
      </div>
      {filtro !== "todos" && classes[filtro]?.explicacao && <p style={S.ajuda}>{classes[filtro].explicacao}</p>}
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

function ListaAchados({ lista, conta }) {
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
            <EnviarParaPromocoes conta={a.vendedor_id || conta} anuncio={a} />
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
  ok: { color: "#86efac" },
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
  numeros: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 4 },
  numero: { flex: "1 1 140px", display: "flex", flexDirection: "column", gap: 2, padding: "10px 14px", border: "1px solid #1e3a5f", borderRadius: 12, background: "#020617" },
  numeroValor: { fontSize: 26, lineHeight: 1.1, color: "#f8fafc", fontWeight: 900 },
  buscaCaixa: { flex: "2 1 240px", display: "flex", flexDirection: "column", gap: 4, padding: "10px 14px", border: "1px solid #1e3a5f", borderRadius: 12, background: "#020617" },
  buscaTopo: { border: "1px solid #475569", borderRadius: 10, background: "#0b1324", color: "#f8fafc", padding: "9px 11px", font: "inherit", fontSize: 15, minWidth: 0 },
  secundarias: { display: "inline-flex", flexWrap: "wrap", gap: 6, alignItems: "center", color: "#475569", alignSelf: "center" },
  linkBotao: { border: 0, background: "none", color: "#94a3b8", padding: "4px 2px", cursor: "pointer", textDecoration: "underline", fontSize: 13 },
  linkAtivo: { border: 0, background: "none", color: "#67e8f9", padding: "4px 2px", cursor: "pointer", textDecoration: "underline", fontSize: 13, fontWeight: 800 },
  completo: { marginTop: 18, border: "1px solid #1e3a5f", borderRadius: 12, padding: "10px 14px", background: "rgba(2,6,23,.6)" },
  resumoCompleto: { cursor: "pointer", fontWeight: 900, color: "#e0f2fe", fontSize: 16 },
};
