// (10/11) TEMPORÁRIO — Diagnóstico de publicação SOMENTE LEITURA (Central de Publicação).
// Usa a sessão do PAIIA e as integrações existentes; não grava nada e não mostra token/chave.
import { useState } from "react";
import { supabase } from "../supabase";
import { listarAnunciosDoCodigo, obterAnuncio } from "../services/anuncioPublicacaoService";
import { lerRegistroDoSKU } from "../services/registroMLBService";
import { desfazerMLBDeOutroProduto } from "../services/anuncioPublicacaoService";
import { corrigirSkuDaFicha } from "../services/correcaoSku";
import { diagnosticarPublicacao, textoDiagnostico } from "../services/diagnosticoPublicacao";

const depsReais = {
  listarFichas: (sku) => listarAnunciosDoCodigo(sku),
  lerFicha: (id) => obterAnuncio(id),
  lerRegistro: (sku) => lerRegistroDoSKU(sku),
  consultarML: async (conta, caminho) => {
    const { data, error } = await supabase.functions.invoke("mercadolivre-publicacao", { body: { acao: "ml_consulta", conta_ml: String(conta), metodo: "GET", caminho } });
    return error ? { ok: false, erro: error.message || "falha" } : data || { ok: false, erro: "resposta vazia" };
  },
  consultarBling: async (corpo) => {
    const { data, error } = await supabase.functions.invoke("bling-integracao", { body: corpo });
    return error ? { ok: false, erro: error.message || "falha" } : data || { ok: false, erro: "resposta vazia" };
  },
};
const ICONE = { ok: "✅", alerta: "⚠", erro: "❌" };
const COR = { ok: "#86efac", alerta: "#fde68a", erro: "#fca5a5" };

export default function DiagnosticoPublicacao() {
  const [sku, setSku] = useState("");
  const [mlb, setMlb] = useState("");
  const [st, setSt] = useState({ rodando: false, d: null, erro: "", copiado: false });
  async function conferir() {
    if (!sku.trim() || st.rodando) return;
    setSt({ rodando: true, d: null, erro: "", copiado: false });
    try {
      const deps = (globalThis.__paiiaModoTeste && globalThis.__paiiaDiagnosticoDeps) || depsReais;
      setSt({ rodando: false, d: await diagnosticarPublicacao({ sku: sku.trim(), mlb: mlb.trim() }, deps), erro: "", copiado: false });
    } catch (e) {
      setSt({ rodando: false, d: null, erro: String(e?.message || e), copiado: false });
    }
  }
  // (15/11) Tirar da ficha o MLB de OUTRO produto (só com o seu toque + confirmação; nada é apagado).
  const [desfeito, setDesfeito] = useState({});
  async function desfazerTrocado(t) {
    if (desfeito[t.ficha]?.rodando) return;
    const ok = window.confirm(`Tirar o ${t.mlb} (anúncio do SKU ${t.sku_do_mlb}) da ficha ${t.ficha.slice(0, 8)}?

A ficha volta para "aprovada, não publicada". O registro errado fica guardado na ficha. Nada é alterado no Mercado Livre nem no Bling.`);
    if (!ok) return;
    setDesfeito((d) => ({ ...d, [t.ficha]: { rodando: true } }));
    const r = await desfazerMLBDeOutroProduto({ anuncioId: t.ficha, mlb: t.mlb, motivo: `MLB do SKU ${t.sku_do_mlb} gravado por engano na ficha do SKU ${st.d?.sku || ""}` }).catch((e) => ({ ok: false, erro: String(e?.message || e) }));
    setDesfeito((d) => ({ ...d, [t.ficha]: { rodando: false, r } }));
  }
  // (15/11) Corrigir o SKU da ficha para o SKU que o anúncio JÁ tem no ML (e no Bling). Dois toques; nada é publicado.
  const [corrSku, setCorrSku] = useState({ armado: "", rodando: false, r: null });
  async function corrigirSku(t) {
    if (corrSku.rodando) return;
    if (corrSku.armado !== t.ficha) { setCorrSku({ armado: t.ficha, rodando: false, r: null }); return; }
    setCorrSku((c) => ({ ...c, rodando: true }));
    const deps = {
      lerItem: async (conta, mlb) => { const r = await depsReais.consultarML(conta, `/items/${mlb}`); return r?.ok ? r.dados : null; },
      lerBling: (sku) => depsReais.consultarBling({ acao: "saldo_por_sku", sku }),
      fichasDoCodigo: async (sku) => { const l = await listarAnunciosDoCodigo(sku); return l?.ok ? l.anuncios : null; },
    };
    const r = await corrigirSkuDaFicha({ anuncioId: t.ficha, skuAntigo: t.skuAntigo, skuNovo: t.skuNovo }, deps).catch((e) => ({ ok: false, erro: String(e?.message || e) }));
    setCorrSku({ armado: "", rodando: false, r });
  }
  async function copiar() {
    try { await navigator.clipboard.writeText(textoDiagnostico(st.d)); setSt((s) => ({ ...s, copiado: true })); } catch { /* sem área de transferência */ }
  }
  const campo = { padding: "8px 10px", borderRadius: 8, border: "1px solid #334155", background: "#0b1220", color: "#e2e8f0", minWidth: 0, flex: "1 1 160px" };
  const botao = { padding: "8px 12px", borderRadius: 8, border: "1px solid #2f5fd0", background: "#1d4ed8", color: "#fff", fontWeight: 700, cursor: "pointer" };
  return (
    <details data-paiia-diagnostico style={{ marginTop: 14, border: "1px solid #334155", borderRadius: 12, padding: 12, color: "#e2e8f0", background: "#0f172a" }}>
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>🔎 Diagnóstico de publicação (somente leitura)</summary>
      <p style={{ fontSize: 13, color: "#94a3b8" }}>Confere ficha, MLB no Mercado Livre, busca do SKU, duplicidade e vínculo no Bling. Só leitura: nada é publicado, gravado ou alterado.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input data-paiia-diagnostico-sku value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU (ex.: 39038558)" style={campo} />
        <input data-paiia-diagnostico-mlb value={mlb} onChange={(e) => setMlb(e.target.value)} placeholder="MLB (opcional)" style={campo} />
        <button type="button" data-paiia-diagnostico-conferir onClick={conferir} disabled={!sku.trim() || st.rodando} style={{ ...botao, opacity: !sku.trim() || st.rodando ? 0.5 : 1 }}>{st.rodando ? "⏳ Conferindo..." : "Conferir"}</button>
      </div>
      {st.erro && <p style={{ color: COR.erro }}>❌ {st.erro}</p>}
      {st.d && (
        <div data-paiia-diagnostico-resultado style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, overflowWrap: "anywhere" }}>
          <div><b>SKU</b> {st.d.sku} · <b>MLB</b> {st.d.mlb || "—"} · <b>conta</b> {st.d.conta || "—"}</div>
          <ul style={{ paddingLeft: 18, margin: "6px 0" }}>
            {st.d.pontos.map((p, k) => <li key={k} data-paiia-diagnostico-ponto={p.nivel} style={{ color: COR[p.nivel] }}>{ICONE[p.nivel]} <b>{p.item}:</b> {p.texto}</li>)}
          </ul>
          {st.d.ml && (
            <table style={{ fontSize: 13, borderCollapse: "collapse", width: "100%" }}><tbody>
              {[["Título", st.d.ml.titulo], ["Vendedor", `${st.d.ml.vendedor} (${st.d.ml.conta_nome})`], ["Status", `${st.d.ml.status}${st.d.ml.sub_status?.length ? ` (${st.d.ml.sub_status.join(", ")})` : ""}`], ["SKU (atributo)", st.d.ml.sku_atributo || "—"], ["SKU (custom field)", st.d.ml.seller_custom_field || "—"], ["Preço", st.d.ml.preco], ["Quantidade", st.d.ml.quantidade], ["Condição", st.d.ml.condicao], ["Tipo", st.d.ml.tipo], ["Produto do vendedor", st.d.ml.user_product || "—"], ["Criado", st.d.ml.criado]].map(([k, v]) => (
                <tr key={k}><td style={{ color: "#94a3b8", padding: "2px 8px 2px 0", width: 150 }}>{k}</td><td>{String(v ?? "—")}</td></tr>
              ))}
            </tbody></table>
          )}
          {(st.d.mlbTrocado || []).map((t) => (
            <div key={t.ficha} data-paiia-mlb-trocado={t.ficha} style={{ margin: "8px 0", padding: 10, border: "1px solid #f87171", borderRadius: 8, background: "#450a0a", color: "#fecaca" }}>
              ⚠ Ficha {t.ficha.slice(0, 8)}: o {t.mlb} é do SKU {t.sku_do_mlb}, não deste produto.
              {desfeito[t.ficha]?.r ? (
                <div data-paiia-mlb-trocado-resultado={desfeito[t.ficha].r.ok ? "ok" : "erro"} style={{ marginTop: 6, color: desfeito[t.ficha].r.ok ? COR.ok : COR.erro }}>
                  {desfeito[t.ficha].r.ok ? "✅ MLB retirado desta ficha: ela voltou para aprovada, não publicada (registro errado guardado). Confira de novo." : `❌ ${desfeito[t.ficha].r.erro}`}
                </div>
              ) : (
                <div><button type="button" data-paiia-desfazer-mlb-trocado onClick={() => desfazerTrocado(t)} disabled={desfeito[t.ficha]?.rodando} style={{ ...botao, marginTop: 6, background: "#7f1d1d", borderColor: "#f87171" }}>{desfeito[t.ficha]?.rodando ? "⏳ Corrigindo..." : "Tirar este MLB da ficha (pede confirmação)"}</button></div>
              )}
            </div>
          ))}
          {st.d.skuDivergente && (
            <div data-paiia-sku-divergente={st.d.skuDivergente.ficha} style={{ margin: "8px 0", padding: 10, border: "1px solid #f59e0b", borderRadius: 8, background: "#451a03", color: "#fde68a" }}>
              ⚠ O {st.d.skuDivergente.mlb} está com o SKU <b>{st.d.skuDivergente.skuNovo}</b> no Mercado Livre; a ficha {st.d.skuDivergente.ficha.slice(0, 8)} ainda tem <b>{st.d.skuDivergente.skuAntigo}</b>.
              {corrSku.r ? (
                <div data-paiia-sku-corrigido={corrSku.r.ok ? "ok" : "erro"} style={{ marginTop: 6, color: corrSku.r.ok ? COR.ok : COR.erro }}>
                  {corrSku.r.ok ? `✅ SKU da ficha corrigido para ${st.d.skuDivergente.skuNovo} (publicação: ${corrSku.r.publicacao}; registro interno: ${corrSku.r.registro}). Confira com o SKU novo.` : `❌ ${corrSku.r.erro}`}
                </div>
              ) : (
                <div><button type="button" data-paiia-corrigir-sku onClick={() => corrigirSku(st.d.skuDivergente)} disabled={corrSku.rodando} style={{ ...botao, marginTop: 6, background: corrSku.armado ? "#b45309" : "#92400e", borderColor: "#f59e0b" }}>
                  {corrSku.rodando ? "⏳ Corrigindo..." : corrSku.armado ? `⚠ Toque de novo para CONFIRMAR: ficha passa a ${st.d.skuDivergente.skuNovo}` : `Corrigir o SKU da ficha para ${st.d.skuDivergente.skuNovo}`}
                </button></div>
              )}
              <div style={{ fontSize: 12, color: "#fcd34d", marginTop: 4 }}>Só corrige se o Mercado Livre e o Bling (mesmo produto) já tiverem o SKU novo. Não publica, não cria produto, não muda preço nem estoque.</div>
            </div>
          )}
          <button type="button" data-paiia-diagnostico-copiar onClick={copiar} style={{ ...botao, marginTop: 8, background: "#1e293b", borderColor: "#334155" }}>{st.copiado ? "✓ Copiado" : "📋 Copiar resultado"}</button>
        </div>
      )}
    </details>
  );
}
