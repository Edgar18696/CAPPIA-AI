// =============================================================
// PAIIA Voz — Calcular Preço de Venda (opcional, separado do Preço do anúncio).
// (16/11) Visual azul premium, duas colunas, microfone por campo, valores guardados na ficha.
// - Preço sugerido: (custo + frete + despesas) ÷ (1 − comissão − impostos − margem).
// - Conferência: quanto SOBRA após comissão, impostos, frete, despesas e RECOMPRA da peça.
// Valores não informados por você aparecem como ESTIMATIVA. Nada vai para o Preço sem "Usar".
// =============================================================
import { analisarVenda, calcularPrecoVenda, precoParaUsar, reais } from "./servicos/calculadoraPreco";

const CAMPOS = [
  ["custo", "Custo da Mercadoria", "R$", "o que você pagou"],
  ["venda", "Preço de venda para conferir", "R$", "opcional: usa o sugerido"],
  ["frete", "Frete", "R$", "0 se não houver"],
  ["despesas", "Despesas", "R$", "embalagem, etc."],
  ["comissao", "Comissão do Marketplace", "%", "ex.: 12"],
  ["impostos", "Impostos", "%", "alíquota da empresa"],
  ["margem", "Margem Desejada (sobre a venda)", "%", "ex.: 20"],
];
const AZUL = { fundo: "linear-gradient(160deg,#0b1f4d 0%,#123a8a 100%)", borda: "#2f5fd0", campo: "#0a1838", texto: "#e8efff", sub: "#9fb6e8", destaque: "#38bdf8" };
const pct = (v) => `${String(Math.round(v * 100) / 100).replace(".", ",")}%`;

export default function CalculadoraPrecoVoz({ valores = {}, onMudar, mic = () => null, ouvido = {}, aoUsarPreco }) {
  const val = (k) => valores[k]?.valor ?? "";
  const plano = Object.fromEntries(CAMPOS.map(([k]) => [k, val(k)]));
  const sug = calcularPrecoVenda(plano);
  const usar = precoParaUsar(plano);
  const vendaConf = val("venda") || (sug.ok ? String(sug.preco) : "");
  const an = analisarVenda({ ...plano, venda: vendaConf });
  const estimativas = CAMPOS.filter(([k]) => valores[k]?.origem === "estimativa" || (["frete", "impostos"].includes(k) && !val(k))).map(([, r]) => r);
  return (
    <section data-pv-calculadora style={{ boxSizing: "border-box", maxWidth: "100%", overflow: "hidden", background: AZUL.fundo, border: `1px solid ${AZUL.borda}`, borderRadius: 16, padding: 14, color: AZUL.texto, display: "grid", gap: 10 }}>
      <div data-pv-calc-abrir style={{ fontWeight: 800, fontSize: 17 }}>🧮 Calcular Preço de Venda <span style={{ fontSize: 12, fontWeight: 500, color: AZUL.sub }}>· opcional</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, max(165px, 45%)), 1fr))", gap: 8 }}>
        {CAMPOS.map(([k, rotulo, un, dica]) => (
          <label key={k} data-pv-calc-campo={k} style={{ minWidth: 0, display: "grid", gap: 3, background: AZUL.campo, borderRadius: 10, padding: "8px 10px", outline: ouvido[k] ? `2px solid ${AZUL.destaque}` : "none" }}>
            <span style={{ fontSize: 12, color: AZUL.sub }}>{rotulo} ({un}){valores[k]?.origem === "estimativa" && <b style={{ color: "#fbbf24" }}> · estimativa</b>}</span>
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input inputMode="decimal" value={val(k)} placeholder={dica} data-pv-calc={k}
                onChange={(e) => onMudar?.(k, e.target.value, "digitado")}
                style={{ flex: 1, width: "100%", minWidth: 0, background: "transparent", border: "none", borderBottom: `1px solid ${AZUL.borda}`, color: AZUL.texto, fontSize: 17, padding: "2px 0" }} />
              {mic(`calc:${k}`, rotulo)}
            </span>
            {ouvido[k] && <span data-pv-calc-ouvido={k} style={{ fontSize: 11, color: AZUL.destaque }}>🎤 “{ouvido[k]}” → {un === "R$" ? `R$ ${val(k)}` : `${val(k)}%`}</span>}
          </label>
        ))}
      </div>
      {estimativas.length > 0 && <p data-pv-calc-estimativas style={{ margin: 0, fontSize: 12, color: "#fbbf24" }}>⚠ Estimativa: {estimativas.join(", ")} — confirme com os valores reais (impostos dependem da tributação da empresa e do produto).</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, max(165px, 45%)), 1fr))", gap: 8 }}>
        <div data-pv-calc-resultado style={{ background: "#0e7490", borderRadius: 12, padding: 10 }}>
          <div style={{ fontSize: 12 }}>Preço sugerido (margem {val("margem") || 0}%)</div>
          <div data-pv-calc-preco style={{ fontSize: 24, fontWeight: 800 }}>{sug.ok ? reais(sug.preco) : "—"}</div>
          {!sug.ok && <div style={{ fontSize: 12 }}>{sug.erro}</div>}
        </div>
        <div data-pv-calc-sobra style={{ background: an.ok && an.sobra < 0 ? "#7f1d1d" : "#166534", borderRadius: 12, padding: 10 }}>
          <div style={{ fontSize: 12 }}>Sobra após recompra{val("venda") ? "" : " (no preço sugerido)"}</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{an.ok ? reais(an.sobra) : "—"}</div>
          {an.ok && <div style={{ fontSize: 12 }}>Margem sobre a venda {pct(an.margemSobreVenda)} · Acréscimo sobre o custo {pct(an.acrescimoSobreCusto)}</div>}
        </div>
      </div>
      {an.ok && (
        <p data-pv-calc-partes style={{ margin: 0, fontSize: 12, color: AZUL.sub }}>
          Venda {reais(an.venda)} − comissão {reais(an.partes.comissao)} − impostos {reais(an.partes.impostos)} − frete {reais(an.partes.frete)} − despesas {reais(an.partes.despesas)} − recompra {reais(an.partes.recompra)} = <b style={{ color: AZUL.texto }}>{reais(an.sobra)}</b>. Estimativa para decisão, não é lucro líquido contábil.
        </p>
      )}
      {usar && (
        <button type="button" data-pv-calc-usar onClick={() => aoUsarPreco?.(usar.texto)}
          style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 10, padding: "12px 14px", fontWeight: 800, fontSize: 15 }}>
          {usar.sugerido ? `✅ Usar Preço Sugerido (${reais(usar.preco)})` : `✅ Usar ${reais(usar.preco)} como Preço de Venda`}
        </button>
      )}
    </section>
  );
}
