import { useState } from "react";
import { ESTADO, TEXTO_ESTADO, PASSOS_BLING, AVISO_AUTOMATICA, URL_BLING_TRAZER } from "../services/vinculoBlingPublicacao";

/*
 * Etapa visual "trazer este MLB para o Bling" (anúncio NOVO do PAIIA).
 * Só mostra o estado e oferece: Copiar MLB · Abrir Bling · Já trouxe — verificar.
 * Não grava nada: a verificação é feita por quem usa o painel (onVerificar),
 * somente com a leitura anuncios_consultar. Nunca republica.
 */
const COR = {
  [ESTADO.AGUARDANDO]: "#fde68a",
  [ESTADO.INTEGRADO]: "#86efac",
  [ESTADO.PRODUTO_INCORRETO]: "#fca5a5",
  [ESTADO.ERRO_CONSULTA]: "#fdba74",
};

export default function PainelIntegracaoBling({ registro, verificando = false, onVerificar }) {
  const [copiado, setCopiado] = useState(false);
  if (!registro?.mlb) return null;
  const estado = registro.estado || ESTADO.AGUARDANDO;
  const integrado = estado === ESTADO.INTEGRADO;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(registro.mlb);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div data-paiia-integracao-bling={estado} style={caixa}>
      <div style={{ ...linha, color: "#86efac" }}>✅ Publicado no Mercado Livre</div>
      <div style={linha}>
        MLB: <b data-paiia-mlb style={{ fontFamily: "monospace", fontSize: 15 }}>{registro.mlb}</b>
        {registro.sku_oficial ? <span style={sub}> · SKU {registro.sku_oficial}</span> : null}
      </div>

      <div data-paiia-estado-bling style={{ ...linha, color: COR[estado] || "#e2e8f0", fontWeight: 700 }}>
        {integrado ? "✅ " : estado === ESTADO.AGUARDANDO ? "⏳ " : "⚠ "}
        {estado === ESTADO.AGUARDANDO ? "Falta vincular o anúncio ao produto no Bling (trazer este MLB para o Bling)" : TEXTO_ESTADO[estado]}
      </div>
      {estado === ESTADO.PRODUTO_INCORRETO && (
        <div style={{ ...sub, color: "#fca5a5" }}>
          No Bling está ligado ao produto {registro.produto_encontrado_id || "?"}; o certo é {registro.bling_produto_id}. Corrija no Bling: ⋮ → Editar relacionamento entre anúncio e produto. Não publique de novo.
        </div>
      )}
      {estado === ESTADO.ERRO_CONSULTA && registro.mensagem && registro.mensagem !== TEXTO_ESTADO[estado] && <div style={sub}>{registro.mensagem}</div>}
      {integrado && (
        <div style={sub}>
          Anúncio Bling {registro.bling_anuncio_id || "—"} · produto {registro.bling_produto_id} · {registro.bling_loja_nome}
        </div>
      )}

      {!integrado && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button type="button" data-paiia-copiar-mlb onClick={copiar} style={botao}>
              {copiado ? "✔ Copiado" : "📋 Copiar MLB"}
            </button>
            <button type="button" data-paiia-abrir-bling onClick={() => window.open(URL_BLING_TRAZER, "_blank", "noopener")} style={botao}>
              ↗ Abrir Bling para trazer anúncio
            </button>
            <button type="button" data-paiia-verificar-bling onClick={() => onVerificar?.()} disabled={verificando} style={{ ...botao, background: "#166534", color: "#fff" }}>
              {verificando ? "⏳ Verificando..." : "🔎 Já trouxe — verificar agora"}
            </button>
          </div>
          {estado === ESTADO.AGUARDANDO && (
            <ol data-paiia-passos-bling style={passos}>
              {PASSOS_BLING.map((p) => <li key={p}>{p}</li>)}
            </ol>
          )}
          <div data-paiia-aviso-automatica style={aviso}>⚠ {AVISO_AUTOMATICA}</div>
        </>
      )}
    </div>
  );
}

const caixa = { marginTop: 10, border: "1px solid #334155", borderRadius: 12, padding: 14, background: "#0f172a" };
const linha = { color: "#e2e8f0", fontSize: 14, lineHeight: 1.8 };
const sub = { color: "#94a3b8", fontSize: 12, lineHeight: 1.6 };
const botao = { padding: "6px 12px", borderRadius: 8, border: "1px solid #475569", background: "#334155", color: "#e2e8f0", cursor: "pointer", fontSize: 13 };
const passos = { color: "#cbd5e1", fontSize: 12, lineHeight: 1.7, margin: "10px 0 0 18px", padding: 0 };
const aviso = { marginTop: 8, color: "#fca5a5", fontSize: 12, fontWeight: 700 };
