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

// (06/11/2026) Atributos obrigatórios da categoria escolhida: só os pendentes em destaque.
function AtributosCategoria({ atributos, onAtributo, onSeguir }) {
  const [texto, setTexto] = useState({});
  if (!atributos?.lido) return null;
  const pend = atributos.pendentes || [];
  const ok = (atributos.itens || []).filter((i) => !i.pendente);
  return (
    <div data-paiia-atributos-categoria data-paiia-atributos-completos={atributos.completo ? "sim" : "nao"} style={{ ...cartao, border: atributos.completo ? "1px solid #22c55e" : "1px solid #f59e0b", background: "#020617" }}>
      {atributos.completo ? (
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <div data-paiia-atributos-ok style={{ color: "#86efac", fontWeight: "bold", fontSize: "16px" }}>✅ Atributos completos</div>
          {onSeguir ? <button type="button" data-paiia-atributos-seguir style={{ ...botao, fontSize: "14px" }} onClick={onSeguir}>Seguir para a Revisão final →</button> : null}
        </div>
      ) : (
        <div style={{ color: "#fbbf24", fontWeight: "bold", fontSize: "16px" }}>Preencha {pend.length === 1 ? "o atributo obrigatório" : `os ${pend.length} atributos obrigatórios`} da categoria:</div>
      )}
      {pend.map((a) => (
        <div key={a.id} data-paiia-atributo-pendente={a.id} style={{ marginTop: "10px" }}>
          <div style={{ color: "#f8fafc", fontSize: "16px", fontWeight: "bold" }}>{a.nome}</div>
          {a.duvida ? <div style={{ color: "#fde68a", fontSize: "13px" }}>⚠ {a.duvida}</div> : null}
          {a.campoProprio ? (
            <div style={{ color: "#fde68a", fontSize: "14px" }}>Preencha o campo “{a.campoProprio}” desta Conferência.</div>
          ) : a.tipo === "lista" ? (
            <select data-paiia-atributo-valor={a.id} value="" onChange={(e) => { const o = a.valores.find((v) => v.id === e.target.value); if (o) onAtributo?.(a, { valueId: o.id, valueName: o.name }); }}
              style={{ marginTop: "4px", padding: "10px", fontSize: "16px", minWidth: "260px", background: "#0f172a", color: "#f8fafc", border: "1px solid #64748b", borderRadius: "8px" }}>
              <option value="">— escolha —</option>
              {a.valores.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          ) : (
            <div style={{ display: "flex", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
              <input data-paiia-atributo-valor={a.id} value={texto[a.id] || ""} onChange={(e) => setTexto((t) => ({ ...t, [a.id]: e.target.value }))}
                style={{ padding: "10px", fontSize: "16px", minWidth: "220px", background: "#0f172a", color: "#f8fafc", border: "1px solid #64748b", borderRadius: "8px" }} />
              <button type="button" data-paiia-atributo-salvar={a.id} disabled={!String(texto[a.id] || "").trim()} style={{ ...botao, fontSize: "14px" }} onClick={() => onAtributo?.(a, { valueName: String(texto[a.id] || "").trim() })}>Salvar</button>
            </div>
          )}
        </div>
      ))}
      {ok.length ? (
        <div data-paiia-atributos-preenchidos style={{ marginTop: "8px", fontSize: "13px", color: "#cbd5e1" }}>
          {ok.map((a) => (
            <div key={a.id}>✓ {a.nome}: <strong style={forte}>{a.valor}</strong> <span style={rotulo}>({a.origem})</span>
              {!a.campoProprio && a.origem === "confirmado por você" ? <button type="button" data-paiia-atributo-alterar={a.id} style={{ ...botaoCinza, padding: "2px 8px", marginLeft: "6px" }} onClick={() => onAtributo?.(a, { valueId: "", valueName: "" })}>alterar</button> : null}
            </div>
          ))}
        </div>
      ) : null}
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
  preferida = "",
  atributos = null,
  onAtributo = null,
  onSeguir = null,
}) {
  const confirmada = decisao?.confirmada?.id && decisao.confirmada.id === categoriaId ? decisao.confirmada : null;
  const candidatas = avaliacao?.candidatas || [];
  const sugerida = candidatas.find((c) => c.id === avaliacao?.sugerida) || null;
  // (06/11) UMA opção na tela: a buscada pelo código MLB (se compatível), a sugerida
  // pelo PAIIA ou, havendo divergência entre as fontes, a 1ª compatível (com aviso).
  const pedida = preferida ? candidatas.find((c) => c.id === String(preferida).toUpperCase()) || null : null;
  const melhor = (pedida?.compativel ? pedida : null) || sugerida || candidatas.find((c) => c.compativel) || null;
  const divergencia = Boolean(melhor && !sugerida && melhor !== pedida);
  const estado = confirmada ? "confirmada" : carregando ? "carregando" : sugerida ? "sugerida" : avaliacao ? "conflito" : "sem_dados";
  const conflitos = avaliacao?.conflitos || [];
  const alertas = avaliacao?.alertas || [];
  const outras = candidatas.filter((c) => c.id !== melhor?.id);
  const caminho = (c) => c.caminho || c.nome || c.id;

  return (
    <div data-paiia-categoria-painel data-paiia-categoria-estado={estado}>
      {confirmada ? (
        <div data-paiia-categoria-confirmada={confirmada.id} style={{ ...cartao, border: "1px solid #22c55e", background: "#020617", fontSize: "14px" }}>
          <div style={{ color: "#86efac", fontWeight: "bold", fontSize: "15px" }}>✅ Categoria: {confirmada.caminho || categoriaCaminho} <span style={rotulo}>({confirmada.id})</span></div>
          {decisao?.revisao ? <div style={{ color: "#fde68a" }}>Revisão registrada: {decisao.revisao.justificativa}</div> : null}
          {(problemasSelecionada || []).length ? (
            <div data-paiia-categoria-problemas style={{ color: "#fca5a5", marginTop: "6px" }}>
              {problemasSelecionada.map((p) => <div key={p}>⚠ {p}</div>)}
              <div>Esta categoria NÃO será aprovada nem publicada assim. Troque a categoria (ou o tipo de veículo).</div>
            </div>
          ) : null}
          <button type="button" data-paiia-categoria-trocar style={{ ...botaoCinza, marginTop: "8px" }} onClick={onTrocar}>Trocar</button>
        </div>
      ) : carregando ? (
        <div data-paiia-categoria-buscando style={{ ...cartao, border: "1px solid #334155", fontSize: "14px" }}>⏳ Buscando a categoria no Mercado Livre…</div>
      ) : melhor ? (
        <div data-paiia-categoria-sugerida={melhor.id} data-paiia-categoria-melhor={melhor.id} style={{ ...cartao, border: "1px solid #22d3ee", fontSize: "14px" }}>
          <div style={{ color: "#67e8f9", fontWeight: "bold" }}>{melhor === pedida ? "Categoria do código informado" : "Melhor categoria encontrada"}</div>
          <div style={{ color: "#f8fafc", fontSize: "15px", fontWeight: "bold", marginTop: "2px" }}>{caminho(melhor)} <span style={rotulo}>({melhor.id})</span></div>
          {divergencia ? <div style={{ color: "#fde68a" }}>As fontes do Mercado Livre indicaram mais de uma opção: confira o caminho antes de usar.</div> : null}
          <button type="button" data-paiia-categoria-confirmar={melhor.id} style={{ ...botao, marginTop: "8px", fontSize: "14px" }} onClick={() => onConfirmar(melhor, null)}>
            Usar esta categoria
          </button>
        </div>
      ) : (
        <div data-paiia-categoria-nenhuma style={{ ...cartao, border: "1px solid #f59e0b", fontSize: "14px", color: "#fde68a" }}>
          {pedida
            ? `A categoria ${pedida.id} não serve para esta peça: ${pedida.rejeitada ? "já foi rejeitada pelo Mercado Livre para este SKU" : (pedida.bloqueios || []).join("; ") || "não passou na conferência"}. (Exceção só em “Avançado”.)`
            : "Nenhuma categoria automotiva compatível encontrada. Busque por outro termo ou informe o código MLB."}
        </div>
      )}
      {erro ? <div style={{ color: "#fca5a5", fontSize: "13px", marginBottom: "8px" }}>⚠ {erro}</div> : null}

      {!confirmada ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px", alignItems: "end", marginBottom: "10px" }}>
          <label style={{ fontSize: "13px", color: "#94a3b8" }}>
            Buscar outra: nome técnico da peça ou código da categoria (ex.: MLB458928)
            <input data-paiia-categoria-termo value={termo} onChange={(e) => onTermo(e.target.value)} style={{ width: "100%", marginTop: "4px", padding: "8px", background: "#020617", color: "#e2e8f0", border: "1px solid #475569", borderRadius: "8px" }} />
          </label>
          <button type="button" data-paiia-categoria-buscar disabled={carregando} style={{ ...botao, background: "#2563eb", opacity: carregando ? 0.6 : 1, fontSize: "14px" }} onClick={onBuscar}>
            {carregando ? "⏳ Buscando…" : "🔎 Buscar Categoria"}
          </button>
        </div>
      ) : null}

      {confirmada ? <AtributosCategoria atributos={atributos} onAtributo={onAtributo} onSeguir={onSeguir} /> : null}

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

      {/* Exceções e detalhes técnicos: recolhidos (não poluem a tela). */}
      {(confirmada || outras.length || conflitos.length || alertas.length || rejeicoes.length || restricoes.length) ? (
        <details data-paiia-categoria-avancado style={{ marginBottom: "10px" }}>
          <summary style={{ color: "#94a3b8", fontSize: "12px", cursor: "pointer" }}>Avançado (outras categorias, detalhes e exceções)</summary>
          {confirmada ? (
            <div style={{ ...cartao, marginTop: "6px" }}>
              <div><span style={rotulo}>Domínio:</span> {confirmada.dominio || "não informado"}</div>
              <div><span style={rotulo}>Origem:</span> {(confirmada.origem || []).map((o) => ROTULO_ORIGEM_CATEGORIA[o] || o).join(" · ") || "—"} · escolha manual em {confirmada.data ? new Date(confirmada.data).toLocaleString("pt-BR") : "—"}</div>
            </div>
          ) : null}
          {!confirmada && conflitos.length ? (
            <div data-paiia-categoria-conflitos style={{ ...cartao, border: "1px solid #ef4444", marginTop: "6px" }}>
              <div style={{ color: "#fca5a5", fontWeight: "bold" }}>Divergência entre as fontes:</div>
              {conflitos.map((c) => <div key={c}>• {c}</div>)}
            </div>
          ) : null}
          {!confirmada && alertas.length ? (
            <div data-paiia-categoria-alertas style={{ ...cartao, border: "1px solid #f59e0b" }}>
              {alertas.map((a) => <div key={a} style={{ color: "#fde68a" }}>• {a}</div>)}
            </div>
          ) : null}
          {!confirmada && melhor ? <div style={{ ...cartao }}><div style={{ color: "#67e8f9", fontWeight: "bold" }}>Detalhes de {melhor.id}</div><DadosCategoria c={melhor} evidencia={evidencia} /></div> : null}
          {!confirmada && outras.map((c) => (
            <div key={c.id} data-paiia-categoria-candidata={c.id} data-paiia-categoria-compativel={c.compativel ? "sim" : "nao"} {...(c.rejeitada ? { "data-paiia-categoria-rejeitada": c.id } : {})}
              style={{ ...cartao, border: c.rejeitada ? "1px solid #ef4444" : c.compativel ? "1px solid #334155" : "1px solid #f59e0b" }}>
              {c.rejeitada ? <div style={{ color: "#f87171", fontWeight: "bold" }}>⛔ CATEGORIA REJEITADA — NÃO REUTILIZAR AUTOMATICAMENTE</div> : null}
              {!c.rejeitada && !c.compativel ? <div style={{ color: "#fbbf24", fontWeight: "bold" }}>⚠ Não passou na conferência do PAIIA (só com conferência explícita)</div> : null}
              <DadosCategoria c={c} evidencia={evidencia} />
              {c.compativel ? (
                <button type="button" data-paiia-categoria-confirmar={c.id} style={{ ...botao, marginTop: "6px" }} onClick={() => onConfirmar(c, null)}>
                  Usar esta categoria
                </button>
              ) : (
                <Revisao c={c} onUsar={onConfirmar} />
              )}
              {!c.rejeitada ? <RejeitarManual c={c} onRejeitar={onRejeitarManual} /> : null}
            </div>
          ))}
          {rejeicoes.length || restricoes.length ? (
            <div data-paiia-categoria-historico style={{ marginTop: "6px" }}>
              <div style={{ color: "#fca5a5", fontSize: "12px" }}>Histórico do SKU: {rejeicoes.length} categoria(s) rejeitada(s) · {restricoes.length} restrição(ões) sem motivo confirmado</div>
              {rejeicoes.map((r) => <div key={`${r.categoria_id}-${r.mlb}-${r.justificativa || ""}`} style={{ fontSize: "12px", color: "#fca5a5" }}>⛔ {r.categoria_id}{r.mlb ? ` · ${r.mlb}` : ""}: {r.motivo}</div>)}
              {restricoes.map((r) => (
                <div key={`r-${r.mlb}`} data-paiia-categoria-restricao={r.mlb} style={{ fontSize: "12px", color: "#fde68a" }}>
                  ⓘ {r.mlb} ({r.status_ml || "?"}{r.sub_status_ml?.length ? ` · ${r.sub_status_ml.join(", ")}` : ""}){r.categoria_id ? ` · categoria ${r.categoria_id}` : ""}: {r.motivo || TEXTO_RESTRICAO_NAO_CONFIRMADA} — não marca a categoria como rejeitada.
                </div>
              ))}
            </div>
          ) : null}
        </details>
      ) : null}
    </div>
  );
}
