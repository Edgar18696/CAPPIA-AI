import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import PainelIntegracaoBling from "./PainelIntegracaoBling";
import FilaContasPublicacao from "./FilaContasPublicacao";
import BotaoCopiarMLB from "./BotaoCopiarMLB";
import CorrecaoCompatMLB from "./CorrecaoCompatMLB";
import { registroDaFichaOuPublicacao, conferirIntegracao, precisaConferir, ESTADO as ESTADO_BLING } from "../services/vinculoBlingPublicacao";
import { salvarRegistroIntegracaoBling, pendenciaPublicacao, prepararFichaRepublicacao } from "../services/anuncioPublicacaoService";
import { lerSituacaoMLBAtual } from "../services/situacaoMLBAtual";
import { resumoFichaPublicada } from "../services/situacaoFichaPublicada";
import { enderecoDaFicha } from "../services/fichasCentral";

/*
 * TELA FINAL DA FICHA (ficha já publicada — aberta logo depois de publicar,
 * pela Central, F5 ou ?ficha=<ID>).
 * Mostra SKU, produto Bling, estoque, conta, MLB, situação da publicação e
 * do vínculo no Bling. Não há botão de publicar: o MLB existente nunca é
 * publicado de novo, e nenhum produto é criado no Bling aqui.
 * "Concluir e voltar à Central" só aparece com o fluxo concluído.
 */
export default function FichaPublicadaPAIIA({ ficha, setScreen }) {
  const pub = ficha?.publicacao || {};
  const [registro, setRegistro] = useState(() => registroDaFichaOuPublicacao(ficha?.dados_conferencia, pub));
  const [verificando, setVerificando] = useState(false);
  const [estoque, setEstoque] = useState({ carregando: false, lido: false });
  const pend = pendenciaPublicacao(pub);
  const sku = String(pub.sku || registro?.sku_oficial || ficha?.codigo || "");
  // O endereço continua apontando ESTA ficha (F5 volta para ela).
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (ficha?.id && (url.searchParams.get("ficha") !== ficha.id || url.hash)) {
        url.searchParams.set("ficha", ficha.id);
        url.searchParams.set("tela", "mercadoLivreTeste");
        url.hash = "";
        window.history.replaceState(window.history.state, "", url.toString());
      }
    } catch {
      // sem acesso ao endereço
    }
  }, [ficha?.id]);

  async function consultarBling(corpo) {
    const { data, error } = await supabase.functions.invoke("bling-integracao", { body: corpo });
    if (error) return { ok: false, erro: error.message || "Falha ao falar com o servidor." };
    return data || { ok: false, erro: "Resposta vazia do servidor." };
  }
  // Estoque: leitura no Bling SÓ quando o usuário pede (17/10/2026: nenhuma
  // busca automática de SKU ao abrir a ficha).
  async function lerEstoqueBling() {
    if (!sku || estoque.carregando) return;
    setEstoque({ carregando: true, lido: false });
    const r = await consultarBling({ acao: "saldo_por_sku", sku });
    setEstoque({ carregando: false, lido: true, ...r });
  }

  // Situação ATUAL do MLB no Mercado Livre (somente leitura, na conta da
  // publicação). Não altera o histórico gravado na ficha.
  const [situacaoML, setSituacaoML] = useState({ carregando: true });
  const mlbFicha = String(pub.mlb_id || registro?.mlb || "");
  const contaFicha = String(pub.ml_user_id || registro?.ml_user_id || "");
  useEffect(() => {
    let ativo = true;
    (async () => {
      const r = await lerSituacaoMLBAtual({ mlb: mlbFicha, conta: contaFicha });
      if (ativo) setSituacaoML({ carregando: false, lido: r.lido !== false, excluido: Boolean(r.excluido), situacao: r.situacao || "", confirmada: Boolean(r.confirmada), texto: r.texto || "", registro: r.registro || null });
    })();
    return () => { ativo = false; };
  }, [mlbFicha, contaFicha]);
  const mlbsAnteriores = Array.isArray(ficha?.dados_conferencia?.mlbs_anteriores) ? ficha.dados_conferencia.mlbs_anteriores : [];

  // (14/11) MLB encerrado/excluído: RETOMAR cria uma ficha NOVA com a mesma
  // Conferência (fotos, descrição, aplicações). Esta ficha e o MLB antigo ficam
  // como histórico; nada é publicado e nada vai ao Bling aqui.
  const fichaRetomada = String(ficha?.dados_conferencia?.republicacao?.ficha || "");
  const [retomar, setRetomar] = useState({ ocupado: false, erro: "" });
  async function retomarFicha() {
    if (retomar.ocupado || !ficha?.id) return;
    setRetomar({ ocupado: true, erro: "" });
    const r = await prepararFichaRepublicacao({ anuncioId: ficha.id, situacao: situacaoML.registro });
    if (!r.ok) { setRetomar({ ocupado: false, erro: r.erro || "Não foi possível retomar a ficha." }); return; }
    abrirFicha(r.anuncioId);
  }
  function abrirFicha(id) {
    try {
      window.location.assign(enderecoDaFicha(window.location.href, id));
    } catch {
      setRetomar({ ocupado: false, erro: `Ficha retomada (${id}): abra pela Central de Publicação.` });
    }
  }

  async function verificar(completa) {
    if (!ficha?.id || !precisaConferir(registro) || verificando) return;
    setVerificando(true);
    const { registro: novo } = await conferirIntegracao({ registro, consultar: consultarBling, completa });
    setVerificando(false);
    const mudou = novo.estado !== registro.estado || novo.bling_anuncio_id !== registro.bling_anuncio_id;
    // Registro refeito da publicação: passa a ficar gravado na ficha.
    if (mudou || completa || registro.refeito_da_publicacao) {
      const gravar = { ...novo };
      delete gravar.refeito_da_publicacao;
      await salvarRegistroIntegracaoBling({ anuncioId: ficha.id, registro: gravar });
      setRegistro(gravar);
      return;
    }
    setRegistro(novo);
  }
  // Conferência leve: a cada 30 s enquanto aguarda (até 30 min).
  useEffect(() => {
    if (!registro || !precisaConferir(registro) || registro.estado !== ESTADO_BLING.AGUARDANDO) return undefined;
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      if (n > 60) return clearInterval(t);
      verificar(false);
      return undefined;
    }, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registro?.estado]);

  const integrado = registro?.estado === ESTADO_BLING.INTEGRADO;
  const produtoBling = String(pub.bling_produto_id || registro?.bling_produto_id || "");
  const publicadoOk = Boolean(pub.mlb_id || registro?.mlb);
  const semRegistroBling = !registro; // anúncio antigo/sem loja Bling: não há etapa do Bling
  // (14/11) Histórico da publicação SEPARADO da situação ATUAL no Mercado Livre:
  // anúncio encerrado/excluído nunca aparece como "Publicado"/"Fluxo concluído".
  const resumo = resumoFichaPublicada({ publicadoOk, pend, integrado, semRegistroBling, publicadoEm: pub.publicado_em || "", situacaoML });
  const concluido = resumo.concluido;
  const estoqueTexto = estoque.carregando
    ? "⏳ lendo no Bling..."
    : !estoque.lido
      ? "não consultado"
      : estoque.ok && estoque.encontrado
        ? `${estoque.saldoVirtualTotal ?? "—"} (disponível no Bling)`
        : "não lido";
  const situacaoBling = semRegistroBling
    ? "Sem etapa de vínculo no Bling para esta conta"
    : integrado
      ? `Vinculado/conferido no Bling (anúncio Bling ${registro.bling_anuncio_id || "—"})`
      : registro.estado === ESTADO_BLING.PRODUTO_INCORRETO
        ? "Vinculado ao produto ERRADO no Bling"
        : registro.estado === ESTADO_BLING.ERRO_CONSULTA
          ? "Não foi possível confirmar no Bling"
          : "Falta vincular o anúncio ao produto no Bling";

  return (
    <div data-paiia-ficha-publicada data-paiia-tela-final style={{ width: "100%", maxWidth: "1180px", margin: "30px auto" }}>
      <div style={{ marginBottom: 10 }}>
        <button type="button" data-paiia-navegacao data-paiia-voltar-central onClick={() => setScreen?.("centralPublicacao")} style={botao}>
          ← Voltar à Central de Publicação
        </button>
      </div>
      {/* (14/11) Contas confirmadas que ainda faltam: a próxima ganha a sua ficha (nada é publicado aqui). */}
      <FilaContasPublicacao anuncioId={ficha?.id || ""} plano={ficha?.dados_conferencia?.contas_publicacao || null} />
      <section style={caixa}>
        <h2 data-paiia-final-titulo style={{ color: resumo.encerrado ? "#fca5a5" : "#86efac", margin: "0 0 6px" }}>📋 Tela final da ficha — {resumo.titulo}</h2>
        <p style={linha}>
          {ficha?.titulo || "Sem título"} · Código {ficha?.codigo || "—"}
        </p>
        <table data-paiia-resumo-final style={{ borderCollapse: "collapse", fontSize: 14, color: "#e2e8f0", margin: "8px 0" }}>
          <tbody>
            <tr><td style={td}>SKU</td><td style={td} data-paiia-final-sku><b>{sku || "—"}</b></td></tr>
            <tr><td style={td}>Produto Bling (ID)</td><td style={td} data-paiia-final-produto-bling><b>{produtoBling || "—"}</b></td></tr>
            <tr><td style={td}>Estoque</td><td style={td} data-paiia-final-estoque>
              {estoqueTexto}
              {produtoBling && sku && !estoque.carregando && (
                <button type="button" data-paiia-ler-estoque-bling onClick={lerEstoqueBling} style={{ ...botao, marginLeft: 8, padding: "2px 8px" }}>
                  Ler no Bling
                </button>
              )}
            </td></tr>
            <tr><td style={td}>Conta Mercado Livre</td><td style={td} data-paiia-final-conta>{pub.conta_nome || ficha?.conta_destino_nome || "—"}{pub.ml_user_id ? ` (ID ${pub.ml_user_id})` : ""}</td></tr>
            <tr>
              <td style={td}>MLB</td>
              <td style={td}>
                <b data-paiia-mlb-publicado style={{ fontFamily: "monospace" }}>{pub.mlb_id || registro?.mlb || "—"}</b>{" "}
                {!registro ? <BotaoCopiarMLB mlb={pub.mlb_id} compacto /> : null}
                {pub.mlb_link ? (
                  <>
                    {" · "}
                    <a href={pub.mlb_link} target="_blank" rel="noopener noreferrer" style={{ color: "#93c5fd" }}>abrir no Mercado Livre</a>
                  </>
                ) : null}
              </td>
            </tr>
            <tr><td style={td}>Situação atual no Mercado Livre</td><td style={{ ...td, color: resumo.encerrado ? "#fca5a5" : td.color }} data-paiia-final-publicacao>{resumo.situacaoAtual}</td></tr>
            <tr><td style={td}>Histórico da publicação</td><td style={td} data-paiia-final-historico>{resumo.historico}</td></tr>
            <tr><td style={td}>Situação do vínculo no Bling</td><td style={td} data-paiia-final-vinculo>{situacaoBling}</td></tr>
          </tbody>
        </table>
        {mlbFicha && (
          <div data-paiia-situacao-ml-atual style={{ fontSize: 13, lineHeight: 1.7, margin: "4px 0 8px", color: "#cbd5e1" }}>
            <div>Histórico da ficha: {publicadoOk ? "publicado" : "—"}{integrado ? "/integrado" : ""}.</div>
            <div style={{ color: situacaoML.excluido ? "#fca5a5" : "#cbd5e1" }}>
              Situação atual no Mercado Livre: {situacaoML.carregando ? "⏳ lendo..." : situacaoML.texto || "—"}.
            </div>
          </div>
        )}
        {mlbsAnteriores.length > 0 && (
          <div data-paiia-mlbs-anteriores style={{ fontSize: 13, lineHeight: 1.7, margin: "4px 0 8px", color: "#94a3b8" }}>
            {mlbsAnteriores.map((m) => <div key={`${m.mlb}-${m.conta}`}>{m.texto || `MLB anterior: ${m.mlb} — excluído/encerrado no Mercado Livre — não bloqueia nova publicação.`}</div>)}
          </div>
        )}
        <div data-paiia-checklist-final style={{ fontSize: 14, lineHeight: 1.9 }}>
          {resumo.encerrado ? (
            <>
              <div data-paiia-check-encerrado style={{ color: "#fca5a5", fontWeight: 700 }}>⛔ Anúncio {mlbFicha} {situacaoML.situacao === "excluido" ? "excluído" : "encerrado"} no Mercado Livre — não está à venda</div>
              <div style={{ color: "#94a3b8" }}>Histórico: Mercado Livre publicado{integrado ? "; MLB vinculado ao produto Bling" : ""}{produtoBling ? ` (produto ${produtoBling})` : ""}.</div>
            </>
          ) : (
            <>
              <div style={{ color: publicadoOk ? "#86efac" : "#fca5a5" }}>{publicadoOk ? "✅" : "⚠"} Mercado Livre publicado{resumo.naoConfirmada || resumo.conferindo ? " (histórico — situação atual não confirmada)" : ""}</div>
              <div style={{ color: produtoBling ? "#86efac" : "#fca5a5" }}>{produtoBling ? "✅" : "⚠"} Produto Bling localizado/criado</div>
              {!semRegistroBling && (
                <div data-paiia-check-vinculo style={{ color: integrado ? "#86efac" : "#fde68a" }}>
                  {integrado ? "✅ MLB vinculado/conferido no Bling" : "⚠ Falta vincular o anúncio ao produto no Bling"}
                </div>
              )}
              <div style={{ color: concluido ? "#86efac" : "#fde68a", fontWeight: 700 }}>{concluido ? "✅ Fluxo concluído" : "⏳ Fluxo ainda não concluído"}</div>
            </>
          )}
        </div>
        {pend && !resumo.encerrado && <p style={{ ...linha, color: "#fca5a5" }}>⚠ {pend} A correção é feita no mesmo MLB, sem publicar de novo.</p>}
        {resumo.encerrado ? (
          <div data-paiia-retomar-ficha style={{ marginTop: 10, border: "1px solid #b45309", borderRadius: 10, padding: 12, background: "#1c1917", color: "#fde68a", fontSize: 14 }}>
            <div>O {mlbFicha} <b>não é reutilizado</b> e o PAIIA não cria outro produto no Bling. Para anunciar de novo, retome a ficha: o PAIIA cria uma <b>ficha nova</b> com as mesmas fotos, descrição, aplicações e preço aprovados; esta ficha e o MLB antigo ficam no histórico.</div>
            <div style={{ fontSize: 13, color: "#d6d3d1", marginTop: 4 }}>Na ficha nova a conta passa de novo pela conferência (duplicidade no Mercado Livre e Bling) e só publica com a sua confirmação.</div>
            {fichaRetomada ? (
              <button type="button" data-paiia-abrir-ficha-retomada onClick={() => abrirFicha(fichaRetomada)} style={{ ...botao, marginTop: 8, background: "#b45309", color: "#fff" }}>
                ➡ Abrir a ficha retomada
              </button>
            ) : (
              <button type="button" data-paiia-retomar onClick={retomarFicha} disabled={retomar.ocupado || !situacaoML.registro?.libera} style={{ ...botao, marginTop: 8, background: retomar.ocupado ? "#334155" : "#b45309", color: "#fff" }}>
                {retomar.ocupado ? "⏳ Preparando a ficha…" : "🔁 Retomar esta ficha para publicar de novo"}
              </button>
            )}
            {retomar.erro && <p data-paiia-retomar-erro style={{ color: "#fca5a5", fontSize: 13, margin: "6px 0 0" }}>❌ {retomar.erro}</p>}
          </div>
        ) : (
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "6px 0 0" }}>
            Esta ficha já tem MLB: o PAIIA não publica de novo e não cria outro produto no Bling.
          </p>
        )}
      </section>

      {mlbFicha && contaFicha && !situacaoML.excluido && <CorrecaoCompatMLB ficha={ficha} mlb={mlbFicha} conta={contaFicha} />}

      {registro && (
        <PainelIntegracaoBling registro={registro} verificando={verificando} onVerificar={() => verificar(true)} encerrado={resumo.encerrado ? (situacaoML.situacao === "excluido" ? "excluído" : "encerrado") : ""} />
      )}

      <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {concluido ? (
          <button type="button" data-paiia-navegacao data-paiia-concluir-central onClick={() => setScreen?.("centralPublicacao")} style={{ ...botao, background: "#166534", color: "#fff" }}>
            ✅ Concluir e voltar à Central
          </button>
        ) : (
          <button type="button" data-paiia-navegacao data-paiia-voltar-central-pendente onClick={() => setScreen?.("centralPublicacao")} style={botao}>
            ← Voltar à Central de Publicação (fluxo ainda pendente — a ficha continua lá)
          </button>
        )}
      </div>
    </div>
  );
}

const caixa = { border: "1px solid #334155", borderRadius: 12, padding: 16, background: "#0f172a" };
const linha = { color: "#e2e8f0", fontSize: 14, margin: "4px 0" };
const td = { padding: "3px 12px 3px 0", borderBottom: "1px solid #1e293b", verticalAlign: "top" };
const botao = { padding: "10px 16px", borderRadius: 10, border: "1px solid #475569", background: "#334155", color: "#e2e8f0", cursor: "pointer", fontSize: 14 };
