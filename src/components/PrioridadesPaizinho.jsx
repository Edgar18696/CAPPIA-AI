// =============================================================
// PAIIA — Central do Paizinho: "Prioridades de hoje" com conta, acesso e ações (17/11/2026).
// - Conta ao lado de cada MLB pelo vendedor real do anúncio (lido no ML na análise).
// - "Abrir na Central de Anúncios": área do vendedor no ML (não a página pública).
// - "Resolvido" / "Remover da lista": só a LISTA do PAIIA muda; tudo vai para o histórico.
//   Nenhum anúncio é excluído, pausado ou modificado no Mercado Livre; o Bling não é tocado.
// A ordem (ranqueamento) e o conteúdo de cada prioridade continuam os do relatório.
// =============================================================
import { useState } from "react";
import {
  ACAO, MOTIVOS_REMOCAO, ROTULO_ACAO,
  chaveAchado, contaDoAnuncio, lerHistorico, linkCentralAnuncios, registrarAcao, separarPrioridades,
} from "../services/paizinhoAuditoria/prioridadesAcoes";

const COR = { alta: "#f87171", media: "#fbbf24", baixa: "#60a5fa" };
const ROTULO = { alta: "Urgente", media: "Importante", baixa: "Acompanhar" };
const COR_CONTA = { "1729335019": "#38bdf8", "824312524": "#a78bfa", "2412238242": "#f472b6" };
const reais = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const hora = (iso) => { try { return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); } catch { return "—"; } };
const armazenamento = () => (typeof window !== "undefined" ? window.localStorage : null);

export default function PrioridadesPaizinho({ rel, textoPotencial }) {
  // (17/11) Histórico da conta deste relatório (a tela remonta ao trocar de conta).
  const [historico, setHistorico] = useState(() => lerHistorico(armazenamento(), rel?.conta?.id));
  const [removendo, setRemovendo] = useState(null); // chave do item com a confirmação aberta
  const [erro, setErro] = useState("");
  const lista = rel?.prioridades || [];
  const { visiveis, fora } = separarPrioridades(lista, historico, rel);

  function agir(acao, achado, motivo = "") {
    setErro("");
    const conta = contaDoAnuncio(achado, rel);
    const r = registrarAcao(armazenamento(), { acao, achado, conta, motivo, rel });
    if (!r.ok) { setErro(r.erro); return false; }
    setHistorico(r.historico);
    setRemovendo(null);
    return true;
  }

  return (
    <div data-paizinho-prioridades>
      {!lista.length ? <p style={S.ajuda}>Nenhum problema prioritário encontrado.</p> : null}
      {lista.length > 0 && !visiveis.length ? <p style={S.ajuda}>Todas as prioridades deste relatório foram tratadas (veja o histórico abaixo).</p> : null}
      {erro && <p style={S.erro} role="alert">❌ {erro}</p>}
      <div style={S.achados}>
        {visiveis.map(({ achado: a, acao, reapareceu }) => (
          <ItemPrioridade
            key={chaveAchado(a)}
            a={a}
            rel={rel}
            reapareceu={reapareceu ? acao : null}
            textoPotencial={textoPotencial}
            confirmandoRemocao={removendo === chaveAchado(a)}
            aoResolver={() => agir(ACAO.RESOLVIDO, a)}
            aoPedirRemocao={() => { setErro(""); setRemovendo(chaveAchado(a)); }}
            aoCancelarRemocao={() => setRemovendo(null)}
            aoRemover={(motivo) => agir(ACAO.REMOVIDO, a, motivo)}
          />
        ))}
      </div>
      <Historico historico={historico} fora={fora} aoDevolver={(a) => agir(ACAO.DEVOLVIDO, a)} />
    </div>
  );
}

function ItemPrioridade({ a, rel, reapareceu, textoPotencial, confirmandoRemocao, aoResolver, aoPedirRemocao, aoCancelarRemocao, aoRemover }) {
  const conta = contaDoAnuncio(a, rel);
  const acesso = linkCentralAnuncios(a.item_id, conta);
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try { await navigator.clipboard.writeText(acesso.mlb || a.item_id); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } catch { /* sem área de transferência */ }
  }
  return (
    <article style={{ ...S.achado, borderLeftColor: COR[a.severidade] || "#64748b" }} data-paiia-prioridade={a.item_id}>
      <div style={S.linhaAchado}>
        <span style={{ ...S.selo, color: COR[a.severidade] }}>{ROTULO[a.severidade] || "Prioridade"}</span>
        <strong style={S.mlb}>{a.item_id}</strong>
        <span
          style={{ ...S.conta, ...(conta.identificada ? { borderColor: COR_CONTA[conta.id], color: COR_CONTA[conta.id] } : S.contaNao) }}
          title={conta.origem}
          data-paiia-conta={conta.identificada ? conta.nome : "nao-identificada"}
        >
          {conta.identificada ? `🏪 ${conta.nome}` : `⚠️ ${conta.nome}`}
        </span>
        {a.sku && <span style={S.ajuda}>SKU {a.sku}</span>}
        {a.impacto_rs !== null && a.impacto_rs !== undefined && <span style={{ color: a.impacto_rs < 0 ? COR.alta : "#86efac", fontWeight: 800 }}>{reais(a.impacto_rs)} / 30 dias</span>}
        {a.impacto_potencial_por_envio > 0 && textoPotencial && <span style={S.potencial}>{textoPotencial(a)}</span>}
      </div>
      <div style={S.tituloAchado}>{a.titulo}</div>
      <div>{a.problema}</div>
      <div style={S.sugestao}>👉 {a.sugestao}</div>
      {reapareceu && <div style={S.aviso}>🔁 Marcado como resolvido em {hora(reapareceu.em)}, mas esta análise (mais nova) ainda encontrou o problema.</div>}

      <div style={S.acoes}>
        {acesso.url ? (
          <a href={acesso.url} target="_blank" rel="noreferrer" style={S.botaoLink} data-paiia-central-anuncios={acesso.url}>
            🛠️ Abrir na Central de Anúncios{conta.identificada ? ` (${conta.nome})` : ""}
          </a>
        ) : null}
        <button type="button" onClick={copiar} style={S.botaoSec}>{copiado ? "✔ Copiado" : "📋 Copiar MLB"}</button>
        <button type="button" onClick={aoResolver} style={S.botaoOk} data-paiia-resolvido={a.item_id}>✅ Resolvido</button>
        <button type="button" onClick={aoPedirRemocao} style={S.botaoSec} data-paiia-remover={a.item_id}>🗑️ Remover da lista</button>
      </div>
      <div style={conta.identificada ? S.ajudaPeq : { ...S.ajudaPeq, color: "#fbbf24" }}>{acesso.aviso}</div>

      {confirmandoRemocao && <ConfirmarRemocao mlb={a.item_id} aoConfirmar={aoRemover} aoCancelar={aoCancelarRemocao} />}
    </article>
  );
}

function ConfirmarRemocao({ mlb, aoConfirmar, aoCancelar }) {
  const [motivo, setMotivo] = useState("");
  const [outro, setOutro] = useState("");
  const texto = motivo === "Outro motivo" ? outro.trim() : motivo;
  return (
    <div style={S.confirmar} role="dialog" aria-label={`Remover ${mlb} da lista`} data-paiia-confirmar-remocao={mlb}>
      <strong>Remover {mlb} da lista de prioridades?</strong>
      <span style={S.ajudaPeq}>Sai só desta lista do PAIIA e fica registrado no histórico. O anúncio NÃO é excluído, pausado nem alterado no Mercado Livre, e nada muda no Bling.</span>
      <label style={S.rotulo}>Motivo
        <select value={motivo} onChange={(e) => setMotivo(e.target.value)} style={S.select} data-paiia-motivo>
          <option value="">Escolha o motivo…</option>
          {MOTIVOS_REMOCAO.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
      {motivo === "Outro motivo" && <input value={outro} onChange={(e) => setOutro(e.target.value)} placeholder="Descreva o motivo" style={S.select} data-paiia-motivo-outro />}
      <div style={S.acoes}>
        <button type="button" disabled={!texto} onClick={() => aoConfirmar(texto)} style={texto ? S.botaoPerigo : { ...S.botaoPerigo, opacity: 0.45, cursor: "not-allowed" }} data-paiia-confirmar-remover>Confirmar remoção</button>
        <button type="button" onClick={aoCancelar} style={S.botaoSec}>Cancelar</button>
      </div>
    </div>
  );
}

function Historico({ historico, fora, aoDevolver }) {
  if (!historico.length) return null;
  const foraPorChave = new Map(fora.map((f) => [chaveAchado(f.achado), f.achado]));
  const recentes = [...historico].reverse();
  return (
    <details style={S.detalhe} data-paiia-historico-prioridades>
      <summary style={S.resumo}>🗂️ Histórico das prioridades ({historico.length}) · fora da lista agora: {fora.length}</summary>
      <p style={S.ajudaPeq}>Guardado neste navegador, separado por conta. Só registra o que foi feito na lista do PAIIA; nenhum anúncio foi alterado no Mercado Livre.</p>
      <div style={S.achados}>
        {recentes.map((h) => {
          const achadoFora = foraPorChave.get(h.chave);
          const ultimo = historico.filter((x) => x.chave === h.chave).at(-1) === h;
          return (
            <div key={h.id} style={S.linhaHist} data-paiia-historico-item={h.item_id}>
              <span>{hora(h.em)}</span>
              <strong>{ROTULO_ACAO[h.acao] || h.acao}</strong>
              <span style={S.mlb}>{h.item_id}</span>
              <span style={S.ajuda}>{h.conta_nome}</span>
              {h.motivo && <span>Motivo: {h.motivo}</span>}
              <span style={S.ajuda}>{h.titulo}</span>
              {ultimo && achadoFora && <button type="button" onClick={() => aoDevolver(achadoFora)} style={S.botaoSec}>↩️ Voltar para a lista</button>}
            </div>
          );
        })}
      </div>
    </details>
  );
}

const S = {
  achados: { display: "flex", flexDirection: "column", gap: 8 },
  achado: { padding: "10px 12px", border: "1px solid #1e293b", borderLeft: "4px solid", borderRadius: 10, background: "#020617", lineHeight: 1.45, fontSize: 14 },
  linhaAchado: { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 3 },
  selo: { fontWeight: 900, fontSize: 12, textTransform: "uppercase" },
  mlb: { color: "#e0f2fe", fontFamily: "ui-monospace,Consolas,monospace" },
  conta: { border: "1px solid", borderRadius: 999, padding: "2px 9px", fontSize: 12, fontWeight: 900 },
  contaNao: { borderColor: "#f59e0b", color: "#fbbf24" },
  tituloAchado: { color: "#cbd5e1", fontWeight: 700 },
  sugestao: { color: "#a5f3fc", marginTop: 3 },
  potencial: { color: "#fbbf24", fontWeight: 800, fontSize: 13 },
  aviso: { marginTop: 6, color: "#fbbf24", fontSize: 13 },
  acoes: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 8 },
  botaoLink: { border: "1px solid #22d3ee", borderRadius: 999, background: "rgba(8,145,178,.18)", color: "#cffafe", padding: "6px 12px", fontWeight: 800, fontSize: 13, textDecoration: "none" },
  botaoOk: { border: "1px solid #22c55e", borderRadius: 999, background: "rgba(34,197,94,.14)", color: "#bbf7d0", padding: "6px 12px", fontWeight: 800, fontSize: 13, cursor: "pointer" },
  botaoSec: { border: "1px solid #334155", borderRadius: 999, background: "#0f172a", color: "#cbd5e1", padding: "6px 12px", fontSize: 13, cursor: "pointer" },
  botaoPerigo: { border: "1px solid #f87171", borderRadius: 999, background: "rgba(248,113,113,.15)", color: "#fecaca", padding: "6px 12px", fontWeight: 800, fontSize: 13, cursor: "pointer" },
  confirmar: { display: "flex", flexDirection: "column", gap: 8, marginTop: 10, padding: 12, border: "1px dashed #f87171", borderRadius: 10, background: "rgba(248,113,113,.06)" },
  rotulo: { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#cbd5e1", fontWeight: 700 },
  select: { background: "#020617", color: "#f8fafc", border: "1px solid #475569", borderRadius: 8, padding: "8px 10px", maxWidth: "100%" },
  ajuda: { color: "#94a3b8", fontSize: 13 },
  ajudaPeq: { color: "#94a3b8", fontSize: 12, marginTop: 4 },
  erro: { color: "#fca5a5" },
  detalhe: { marginTop: 10, border: "1px solid #1e293b", borderRadius: 10, padding: "8px 12px", background: "#020617" },
  resumo: { cursor: "pointer", fontWeight: 800, color: "#e2e8f0" },
  linhaHist: { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", fontSize: 13, padding: "6px 0", borderTop: "1px dashed #1e293b" },
};
