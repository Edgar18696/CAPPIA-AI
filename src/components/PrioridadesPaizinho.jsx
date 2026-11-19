// =============================================================
// PAIIA — Central do Paizinho: "Prioridades de hoje" com conta, acesso e ações (17/11/2026).
// - Conta ao lado de cada MLB pelo vendedor real do anúncio (lido no ML na análise).
// - "Abrir na Central de Anúncios": área do vendedor no ML (não a página pública).
// - "Resolvido" / "Remover da lista": só a LISTA do PAIIA muda; tudo vai para o histórico
//   da FILA desta conta (banco quando ativado; até lá, este navegador).
//   Nenhum anúncio é excluído, pausado ou modificado no Mercado Livre; o Bling não é tocado.
// A ordem (ranqueamento) e o conteúdo de cada prioridade continuam os do relatório.
// =============================================================
import { useState } from "react";
import { MOTIVOS_REMOCAO, chaveAchado, contaDoAnuncio, linkCentralAnuncios } from "../services/paizinhoAuditoria/prioridadesAcoes";
import { STATUS, statusPendencia, chavePendencia } from "../services/paizinhoAuditoria/filaAnuncios";

const COR = { alta: "#f87171", media: "#fbbf24", baixa: "#60a5fa" };
const ROTULO = { alta: "Urgente", media: "Importante", baixa: "Acompanhar" };
const COR_CONTA = { "1729335019": "#38bdf8", "824312524": "#a78bfa", "2412238242": "#f472b6" };
const reais = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const hora = (iso) => { try { return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); } catch { return "—"; } };
const FORA = new Set([STATUS.RESOLVIDA, STATUS.REMOVIDA]);

/**
 * lista: achados (prioridades do relatório ou pendências da fila).
 * estado: estado da fila da conta (status de cada pendência).
 * aoAgir(acao, achado, motivo) → Promise<{ ok, erro }>.
 */
export default function PrioridadesPaizinho({ rel, lista, estado, aoAgir, textoPotencial, vazio = "Nenhum problema prioritário encontrado." }) {
  const [removendo, setRemovendo] = useState(null); // chave do item com a confirmação aberta
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const itens = lista || rel?.prioridades || [];
  const visiveis = itens.filter((a) => !FORA.has(statusPendencia(estado, a)));
  // (19/11) Identificação de cada LINHA na tela: anúncio + assunto + posição na lista original.
  // O mesmo anúncio pode ter 2 problemas do mesmo assunto (ex.: título curto e código fora do
  // título): com só anúncio + assunto as duas linhas tinham a mesma chave do React.
  // Só a identificação da linha muda; filtro, ordem e ações continuam iguais.
  const chaveLinha = new Map(itens.map((a, i) => [a, `${chaveAchado(a)}#${i}`]));

  async function agir(acao, achado, motivo = "") {
    if (ocupado) return;
    setErro("");
    setOcupado(true);
    try {
      const r = aoAgir ? await aoAgir(acao, achado, motivo) : { ok: false, erro: "Fila não carregada." };
      if (!r?.ok) setErro(r?.erro || "Não foi possível registrar.");
      else setRemovendo(null);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div data-paizinho-prioridades>
      {!itens.length ? <p style={S.ajuda}>{vazio}</p> : null}
      {itens.length > 0 && !visiveis.length ? <p style={S.ajuda}>Todos os itens desta lista foram tratados (veja o Histórico).</p> : null}
      {erro && <p style={S.erro} role="alert">❌ {erro}</p>}
      <div style={S.achados}>
        {visiveis.map((a) => (
          <ItemPrioridade
            key={chaveLinha.get(a)}
            a={a}
            rel={rel}
            reaberta={a.reaberta || estado?.pendencias?.[chavePendencia(a.item_id, a.area)]?.reaberta}
            textoPotencial={textoPotencial}
            confirmandoRemocao={removendo === chaveLinha.get(a)}
            ocupado={ocupado}
            aoResolver={() => agir("resolvido", a)}
            aoPedirRemocao={() => { setErro(""); setRemovendo(chaveLinha.get(a)); }}
            aoCancelarRemocao={() => setRemovendo(null)}
            aoRemover={(motivo) => agir("removido", a, motivo)}
          />
        ))}
      </div>
    </div>
  );
}

function ItemPrioridade({ a, rel, reaberta, textoPotencial, confirmandoRemocao, ocupado, aoResolver, aoPedirRemocao, aoCancelarRemocao, aoRemover }) {
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
      {a.analisado_em && <div style={S.ajudaPeq} data-paiia-analisado-em={a.item_id}>Analisado em {hora(a.analisado_em)}{a.registro_anterior ? " · registro anterior à correção de 19/11: texto mostrado já no formato atual (o registro guardado não muda; reanalise para atualizar)" : ""}</div>}
      {reaberta && <div style={S.aviso}>🔁 Já tinha sido marcado como resolvido, mas a reanálise ainda encontrou o problema.</div>}

      <div style={S.acoes}>
        {acesso.url ? (
          <a href={acesso.url} target="_blank" rel="noreferrer" style={S.botaoLink} data-paiia-central-anuncios={acesso.url}>
            🛠️ Abrir na Central de Anúncios{conta.identificada ? ` (${conta.nome})` : ""}
          </a>
        ) : null}
        <button type="button" onClick={copiar} style={S.botaoSec}>{copiado ? "✔ Copiado" : "📋 Copiar MLB"}</button>
        <button type="button" onClick={aoResolver} disabled={ocupado} style={S.botaoOk} data-paiia-resolvido={a.item_id}>✅ Resolvido</button>
        <button type="button" onClick={aoPedirRemocao} style={S.botaoSec} data-paiia-remover={a.item_id}>🗑️ Remover da lista</button>
      </div>
      <div style={conta.identificada ? S.ajudaPeq : { ...S.ajudaPeq, color: "#fbbf24" }}>{acesso.aviso}</div>

      {confirmandoRemocao && <ConfirmarRemocao mlb={a.item_id} aoConfirmar={aoRemover} aoCancelar={aoCancelarRemocao} />}
    </article>
  );
}

function ConfirmarRemocao({ mlb, aoConfirmar, aoCancelar }) {
  // (18/11) Motivo opcional: padrão "Outro motivo" (continua registrado no histórico e dá para voltar).
  const [motivo, setMotivo] = useState("Outro motivo");
  const [outro, setOutro] = useState("");
  const texto = motivo === "Outro motivo" ? (outro.trim() || "Outro motivo") : motivo;
  return (
    <div style={S.confirmar} role="dialog" aria-label={`Remover ${mlb} da lista`} data-paiia-confirmar-remocao={mlb}>
      <strong>Remover {mlb} da lista de prioridades?</strong>
      <span style={S.ajudaPeq}>Sai só desta lista do PAIIA e fica registrado no histórico. O anúncio NÃO é excluído, pausado nem alterado no Mercado Livre, e nada muda no Bling.</span>
      <label style={S.rotulo}>Motivo (opcional)
        <select value={motivo} onChange={(e) => setMotivo(e.target.value)} style={S.select} data-paiia-motivo>
          {MOTIVOS_REMOCAO.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
      {motivo === "Outro motivo" && <input value={outro} onChange={(e) => setOutro(e.target.value)} placeholder="Descreva o motivo (opcional)" style={S.select} data-paiia-motivo-outro />}
      <div style={S.acoes}>
        <button type="button" disabled={!texto} onClick={() => aoConfirmar(texto)} style={texto ? S.botaoPerigo : { ...S.botaoPerigo, opacity: 0.45, cursor: "not-allowed" }} data-paiia-confirmar-remover>Confirmar remoção</button>
        <button type="button" onClick={aoCancelar} style={S.botaoSec}>Cancelar</button>
      </div>
    </div>
  );
}

const ROTULO_EVENTO = { analise: "🔍 Analisado (1ª vez)", reanalise: "🔁 Reanalisado", resolvido: "✅ Resolvido", removido: "🗑️ Removido da lista", devolvido: "↩️ Voltou para a lista" };
const ROTULO_SITUACAO = { analisado: "analisado", pendente: "pendente", resolvido: "resolvido" };

/** Histórico da fila desta conta: análises, reanálises e mudanças de situação (mais recentes primeiro). */
export function HistoricoFila({ estado, aoDevolver }) {
  const eventos = [...(estado?.eventos || [])].reverse().slice(0, 300);
  if (!eventos.length) return <p style={S.ajuda}>Nenhum registro ainda nesta conta.</p>;
  return (
    <div style={S.achados} data-paiia-historico-fila>
      {eventos.map((h) => {
        const p = h.area ? estado.pendencias?.[chavePendencia(h.mlb, h.area)] : null;
        const podeVoltar = p && FORA.has(p.status) && (h.tipo === "resolvido" || h.tipo === "removido");
        return (
          <div key={h.id} style={S.linhaHist} data-paiia-historico-item={h.mlb}>
            <span>{hora(h.em)}</span>
            <strong>{ROTULO_EVENTO[h.tipo] || h.tipo}</strong>
            <span style={S.mlb}>{h.mlb}</span>
            {h.area && <span style={S.ajuda}>assunto: {h.area}</span>}
            {h.situacao_depois && <span style={S.ajuda}>situação: {h.situacao_antes ? `${ROTULO_SITUACAO[h.situacao_antes] || h.situacao_antes} → ` : ""}{ROTULO_SITUACAO[h.situacao_depois] || h.situacao_depois}</span>}
            {h.pontuacao != null && <span style={S.ajuda}>pontuação {h.pontuacao}/100</span>}
            {h.pendencias != null && <span style={S.ajuda}>{h.pendencias} pendência(s)</span>}
            {h.motivo && <span>Motivo: {h.motivo}</span>}
            {h.titulo && <span style={S.ajuda}>{h.titulo}</span>}
            {podeVoltar && aoDevolver && (
              <button type="button" onClick={() => aoDevolver({ item_id: p.mlb, area: p.area, severidade: p.severidade, problema: p.problema, sugestao: p.sugestao })} style={S.botaoSec}>↩️ Voltar para a lista</button>
            )}
          </div>
        );
      })}
    </div>
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
