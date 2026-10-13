import { useState } from "react";
import { ROTULO_ORIGEM_CATEGORIA, TEXTO_RESTRICAO_NAO_CONFIRMADA } from "../services/categoriaML";

/*
 * ⑮ CATEGORIA MERCADO LIVRE (Conferência) — só mostra e registra a decisão.
 * As regras ficam em services/categoriaML.js. O PAIIA nunca confirma
 * sozinho: a categoria só vale depois do clique "Confirmar".
 */

const cartao = { padding: "12px 14px", borderRadius: "10px", border: "1px solid #334155", background: "#0f172a", marginBottom: "10px", fontSize: "12px", color: "#cbd5e1", lineHeight: 1.6 };
const rotulo = { color: "#94a3b8" };
const forte = { color: "#f8fafc" };
const botao = { padding: "8px 12px", borderRadius: "8px", border: "none", background: "#16a34a", color: "#fff", fontWeight: "bold", cursor: "pointer", fontSize: "12px" };
const botaoCinza = { ...botao, background: "transparent", border: "1px solid #475569", color: "#cbd5e1" };

function textoEvidencia(c, evidencia) {
  if (!evidencia || evidencia.estado === "nao_consultada") return "não consultada";
  if (evidencia.estado === "indisponivel") return "consulta indisponível agora";
  if (!c.evidencia?.anuncios) return evidencia.estado === "ok" ? `nenhum dos ${evidencia.total || 0} anúncio(s) do código` : "nenhum anúncio encontrado";
  return `${c.evidencia.anuncios} anúncio(s) de ${c.evidencia.vendedores || "?"} vendedor(es) — evidência, não prova`;
}

function nomes(lista) {
  return (lista || []).length ? lista.map((a) => a.nome || a.id).join(", ") : "nenhum";
}

function DadosCategoria({ c, evidencia }) {
  return (
    <div>
      <div><span style={rotulo}>ID:</span> <strong style={forte}>{c.id}</strong></div>
      <div><span style={rotulo}>Caminho completo:</span> <strong style={forte}>{c.caminho || "não lido no Mercado Livre"}</strong></div>
      <div><span style={rotulo}>Domínio:</span> {c.dominio || "não informado"}</div>
      <div><span style={rotulo}>Origem da sugestão:</span> {(c.origens || []).map((o) => ROTULO_ORIGEM_CATEGORIA[o] || o).join(" · ") || "—"}
        {c.preditor?.length ? ` (preditor: ${c.preditor.map((p) => `${p.posicao}ª para "${p.termo}"`).join("; ")})` : ""}</div>
      <div data-paiia-categoria-evidencia={c.evidencia?.anuncios || 0}><span style={rotulo}>Evidência do mesmo código:</span> {textoEvidencia(c, evidencia)}</div>
      <div><span style={rotulo}>Atributos obrigatórios:</span> {c.atributos ? nomes(c.atributos.obrigatorios) : "não lidos"}</div>
      <div><span style={rotulo}>Atributos condicionais:</span> {c.atributos ? nomes(c.atributos.condicionais) : "não lidos"}</div>
      {c.rejeicoes?.length ? (
        <div style={{ color: "#fca5a5" }}>
          {c.rejeicoes.map((r) => <div key={`${r.mlb}-${r.categoria_id}`}>⛔ {r.mlb}: {r.motivo}</div>)}
        </div>
      ) : null}
      {(c.bloqueios || []).map((b) => <div key={b} style={{ color: "#fca5a5" }}>⚠ {b}</div>)}
      {(c.alertas || []).map((a) => <div key={a} style={{ color: "#fde68a" }}>• {a}</div>)}
    </div>
  );
}

function Revisao({ c, onUsar }) {
  const [aberta, setAberta] = useState(false);
  const [just, setJust] = useState("");
  const [ciente, setCiente] = useState(false);
  const tipo = c.rejeitada ? "rejeitada" : "incompativel";
  if (!aberta) {
    return (
      <button type="button" data-paiia-categoria-revisar={c.id} style={{ ...botaoCinza, marginTop: "6px" }} onClick={() => setAberta(true)}>
        {c.rejeitada ? "Revisar categoria rejeitada…" : "Revisar e usar mesmo assim…"}
      </button>
    );
  }
  return (
    <div style={{ marginTop: "8px", padding: "8px", border: "1px dashed #f59e0b", borderRadius: "8px" }}>
      <div style={{ color: "#fde68a" }}>
        {c.rejeitada
          ? "O Mercado Livre já encerrou anúncio deste SKU nesta categoria. Só use se o problema foi tratado (ex.: confirmado com o ML). Explique:"
          : "Esta categoria não passou na conferência do PAIIA. Só use se você conferiu e ela está certa. Explique:"}
      </div>
      <textarea data-paiia-categoria-justificativa value={just} onChange={(e) => setJust(e.target.value)} rows={2} style={{ width: "100%", marginTop: "6px", background: "#020617", color: "#e2e8f0", border: "1px solid #475569", borderRadius: "6px" }} />
      <label style={{ display: "block", marginTop: "4px" }}>
        <input type="checkbox" data-paiia-categoria-revisao-ok checked={ciente} onChange={(e) => setCiente(e.target.checked)} /> Revisei e assumo esta escolha (fica registrada na ficha).
      </label>
      <button
        type="button"
        data-paiia-categoria-usar-revisada={c.id}
        disabled={!ciente || just.trim().length < 10}
        style={{ ...botao, background: "#b45309", marginTop: "6px", opacity: !ciente || just.trim().length < 10 ? 0.5 : 1 }}
        onClick={() => onUsar(c, { categoria_id: c.id, tipo, justificativa: just.trim(), data: new Date().toISOString() })}
      >
        Usar {c.id} com revisão registrada
      </button>
    </div>
  );
}

// Marcar uma categoria como REJEITADA por decisão manual (justificativa obrigatória).
function RejeitarManual({ c, onRejeitar }) {
  const [aberta, setAberta] = useState(false);
  const [just, setJust] = useState("");
  if (!onRejeitar) return null;
  if (!aberta) {
    return (
      <button type="button" data-paiia-categoria-rejeitar={c.id} style={{ ...botaoCinza, marginTop: "6px", marginLeft: "6px" }} onClick={() => setAberta(true)}>
        Marcar como rejeitada…
      </button>
    );
  }
  return (
    <div style={{ marginTop: "8px", padding: "8px", border: "1px dashed #ef4444", borderRadius: "8px" }}>
      <div style={{ color: "#fca5a5" }}>Por que esta categoria não deve ser usada para este SKU? (fica registrado na ficha)</div>
      <textarea data-paiia-categoria-rejeitar-justificativa value={just} onChange={(e) => setJust(e.target.value)} rows={2} style={{ width: "100%", marginTop: "6px", background: "#020617", color: "#e2e8f0", border: "1px solid #475569", borderRadius: "6px" }} />
      <button type="button" data-paiia-categoria-rejeitar-ok={c.id} disabled={just.trim().length < 10} style={{ ...botao, background: "#b91c1c", marginTop: "6px", opacity: just.trim().length < 10 ? 0.5 : 1 }} onClick={() => onRejeitar(c, just.trim())}>
        Rejeitar {c.id}
      </button>
    </div>
  );
}

export default function PainelCategoriaML({
  carregando = false,
  erro = "",
  avaliacao = null,
  evidencia = null,
  decisao = null,
  categoriaId = "",
  categoriaCaminho = "",
  rejeicoes = [],
  restricoes = [],
  onRejeitarManual = null,
  problemasSelecionada = [],
  exigenciaGtin = null,
  onConfirmar,
  onTrocar,
  onMotivoSemGtin,
  termo = "",
  onTermo,
  onBuscar,
}) {
  const confirmada = decisao?.confirmada?.id && decisao.confirmada.id === categoriaId ? decisao.confirmada : null;
  const candidatas = avaliacao?.candidatas || [];
  const sugerida = candidatas.find((c) => c.id === avaliacao?.sugerida) || null;
  const estado = confirmada ? "confirmada" : carregando ? "carregando" : sugerida ? "sugerida" : avaliacao ? "conflito" : "sem_dados";
  const conflitos = avaliacao?.conflitos || [];
  const alertas = avaliacao?.alertas || [];

  return (
    <div data-paiia-categoria-painel data-paiia-categoria-estado={estado}>
      {confirmada ? (
        <div data-paiia-categoria-confirmada={confirmada.id} style={{ ...cartao, border: "1px solid #22c55e", background: "#020617" }}>
          <div style={{ color: "#86efac", fontWeight: "bold", fontSize: "13px" }}>✅ Categoria CONFIRMADA por você</div>
          <div><span style={rotulo}>ID:</span> <strong style={forte}>{confirmada.id}</strong></div>
          <div><span style={rotulo}>Caminho completo:</span> <strong style={forte}>{confirmada.caminho || categoriaCaminho}</strong></div>
          <div><span style={rotulo}>Domínio:</span> {confirmada.dominio || "não informado"}</div>
          <div><span style={rotulo}>Origem:</span> {(confirmada.origem || []).map((o) => ROTULO_ORIGEM_CATEGORIA[o] || o).join(" · ") || "—"} · escolha manual em {new Date(confirmada.data).toLocaleString("pt-BR")}</div>
          {decisao?.revisao ? <div style={{ color: "#fde68a" }}>Revisão registrada: {decisao.revisao.justificativa}</div> : null}
          {(problemasSelecionada || []).length ? (
            <div data-paiia-categoria-problemas style={{ color: "#fca5a5", marginTop: "6px" }}>
              {problemasSelecionada.map((p) => <div key={p}>⚠ {p}</div>)}
              <div>Esta categoria NÃO será aprovada nem publicada assim. Troque a categoria (ou o tipo de veículo).</div>
            </div>
          ) : null}
          <button type="button" data-paiia-categoria-trocar style={{ ...botaoCinza, marginTop: "8px" }} onClick={onTrocar}>Trocar categoria</button>
        </div>
      ) : (
        <div style={{ ...cartao, border: "1px solid #f59e0b", background: "#020617" }}>
          <div style={{ color: "#fbbf24", fontWeight: "bold", fontSize: "13px" }}>
            {carregando ? "⏳ Conferindo categoria no Mercado Livre (preditor, caminho, domínio, anúncios do mesmo código, histórico do SKU)…" : "Categoria Mercado Livre: PENDENTE — confirme abaixo"}
          </div>
          {erro ? <div style={{ color: "#fca5a5" }}>⚠ {erro}</div> : null}
        </div>
      )}

      {!confirmada && conflitos.length ? (
        <div data-paiia-categoria-conflitos style={{ ...cartao, border: "1px solid #ef4444" }}>
          <div style={{ color: "#fca5a5", fontWeight: "bold" }}>⚠ Conflito entre as fontes — o PAIIA NÃO escolhe. Decida entre as alternativas:</div>
          {conflitos.map((c) => <div key={c}>• {c}</div>)}
        </div>
      ) : null}
      {!confirmada && alertas.length ? (
        <div data-paiia-categoria-alertas style={{ ...cartao, border: "1px solid #f59e0b" }}>
          {alertas.map((a) => <div key={a} style={{ color: "#fde68a" }}>• {a}</div>)}
        </div>
      ) : null}

      {!confirmada && sugerida ? (
        <div data-paiia-categoria-sugerida={sugerida.id} style={{ ...cartao, border: "1px solid #22d3ee" }}>
          <div style={{ color: "#67e8f9", fontWeight: "bold", fontSize: "13px" }}>Categoria sugerida (sem conflito entre as fontes)</div>
          <DadosCategoria c={sugerida} evidencia={evidencia} />
          <button type="button" data-paiia-categoria-confirmar={sugerida.id} style={{ ...botao, marginTop: "8px" }} onClick={() => onConfirmar(sugerida, null)}>
            Confirmar esta categoria
          </button>
        </div>
      ) : null}

      {!confirmada && candidatas.filter((c) => c.id !== sugerida?.id).length ? (
        <div>
          <div style={{ color: "#bfdbfe", fontWeight: "bold", margin: "6px 0" }}>{sugerida ? "Outras categorias encontradas" : "Alternativas para sua decisão"}</div>
          {candidatas.filter((c) => c.id !== sugerida?.id).map((c) => (
            <div key={c.id} data-paiia-categoria-candidata={c.id} data-paiia-categoria-compativel={c.compativel ? "sim" : "nao"} {...(c.rejeitada ? { "data-paiia-categoria-rejeitada": c.id } : {})}
              style={{ ...cartao, border: c.rejeitada ? "1px solid #ef4444" : c.compativel ? "1px solid #334155" : "1px solid #f59e0b" }}>
              {c.rejeitada ? <div style={{ color: "#f87171", fontWeight: "bold" }}>⛔ CATEGORIA REJEITADA — NÃO REUTILIZAR AUTOMATICAMENTE</div> : null}
              {!c.rejeitada && !c.compativel ? <div style={{ color: "#fbbf24", fontWeight: "bold" }}>⚠ Não passou na conferência do PAIIA</div> : null}
              <DadosCategoria c={c} evidencia={evidencia} />
              {c.compativel ? (
                <button type="button" data-paiia-categoria-confirmar={c.id} style={{ ...botao, marginTop: "6px" }} onClick={() => onConfirmar(c, null)}>
                  Escolher e confirmar esta categoria
                </button>
              ) : (
                <Revisao c={c} onUsar={onConfirmar} />
              )}
              {!c.rejeitada ? <RejeitarManual c={c} onRejeitar={onRejeitarManual} /> : null}
            </div>
          ))}
        </div>
      ) : null}

      {exigenciaGtin?.exigido ? (
        <div data-paiia-gtin-motivo-bloco={exigenciaGtin.obrigatorio ? "obrigatorio" : "aviso"} style={{ ...cartao, border: exigenciaGtin.escolhido ? "1px solid #22c55e" : exigenciaGtin.obrigatorio ? "1px solid #ef4444" : "1px solid #f59e0b" }}>
          <div style={{ color: exigenciaGtin.escolhido ? "#86efac" : exigenciaGtin.obrigatorio ? "#fca5a5" : "#fde68a", fontWeight: "bold" }}>
            {exigenciaGtin.escolhido
              ? `✅ Sem GTIN: motivo informado (${exigenciaGtin.categoriaId})`
              : exigenciaGtin.obrigatorio
                ? `⚠ Sem GTIN: o Mercado Livre EXIGE o motivo neste anúncio (${exigenciaGtin.categoriaId})`
                : `AVISO — sem GTIN: o Mercado Livre não exigiu o motivo de ausência (${exigenciaGtin.categoriaId}). Informar é opcional; não bloqueia.`}
          </div>
          <select
            data-paiia-motivo-sem-gtin
            value={exigenciaGtin.escolhido?.id || ""}
            onChange={(e) => onMotivoSemGtin(exigenciaGtin.valores.find((v) => v.id === e.target.value) || null)}
            style={{ marginTop: "6px", padding: "6px", background: "#020617", color: "#e2e8f0", border: "1px solid #475569", borderRadius: "6px" }}
          >
            <option value="">{exigenciaGtin.obrigatorio ? "— escolha o motivo (o PAIIA não escolhe sozinho) —" : "— não informar (opcional) —"}</option>
            {exigenciaGtin.valores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
          <div style={rotulo}>Se o produto tiver código de barras, informe o GTIN no bloco de identificação em vez do motivo.</div>
        </div>
      ) : null}

      {rejeicoes.length || restricoes.length ? (
        <details data-paiia-categoria-historico style={{ marginBottom: "10px" }}>
          <summary style={{ color: "#fca5a5", fontSize: "12px", cursor: "pointer" }}>Histórico do SKU: {rejeicoes.length} categoria(s) rejeitada(s) · {restricoes.length} restrição(ões) sem motivo confirmado</summary>
          {rejeicoes.map((r) => <div key={`${r.categoria_id}-${r.mlb}-${r.justificativa || ""}`} style={{ fontSize: "12px", color: "#fca5a5" }}>⛔ {r.categoria_id}{r.mlb ? ` · ${r.mlb}` : ""}: {r.motivo}</div>)}
          {restricoes.map((r) => (
            <div key={`r-${r.mlb}`} data-paiia-categoria-restricao={r.mlb} style={{ fontSize: "12px", color: "#fde68a" }}>
              ⓘ {r.mlb} ({r.status_ml || "?"}{r.sub_status_ml?.length ? ` · ${r.sub_status_ml.join(", ")}` : ""}){r.categoria_id ? ` · categoria ${r.categoria_id}` : ""}: {r.motivo || TEXTO_RESTRICAO_NAO_CONFIRMADA} — não marca a categoria como rejeitada.
            </div>
          ))}
        </details>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px", alignItems: "end" }}>
        <label style={{ fontSize: "12px", color: "#94a3b8" }}>
          Buscar outras categorias (nome técnico da peça, sem palavras que confundam — ex.: evite "segmento" para peça de câmbio)
          <input data-paiia-categoria-termo value={termo} onChange={(e) => onTermo(e.target.value)} style={{ width: "100%", marginTop: "4px", padding: "8px", background: "#020617", color: "#e2e8f0", border: "1px solid #475569", borderRadius: "8px" }} />
        </label>
        <button type="button" data-paiia-categoria-buscar disabled={carregando} style={{ ...botao, background: "#2563eb", opacity: carregando ? 0.6 : 1 }} onClick={onBuscar}>
          {carregando ? "⏳ Conferindo…" : "🔎 Buscar e conferir"}
        </button>
      </div>
    </div>
  );
}
