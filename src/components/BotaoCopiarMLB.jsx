import { useEffect, useRef, useState } from "react";
import { normalizarMLB, copiarTexto, TEXTO_BOTAO_COPIAR_MLB, TEXTO_MLB_COPIADO } from "../services/copiarMLB";

/*
 * "📋 Copiar MLB para o Bling": só copia o MLB REAL do anúncio (recebido
 * por props) para a área de transferência. Não grava nada e não chama
 * nenhuma integração. MLB inválido/ausente = o botão não aparece.
 */
export default function BotaoCopiarMLB({ mlb, compacto = false }) {
  const codigo = normalizarMLB(mlb);
  const [estado, setEstado] = useState(""); // "" | "ok" | "falhou"
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!codigo) return null;

  async function copiar(e) {
    e?.stopPropagation?.();
    const ok = await copiarTexto(codigo);
    setEstado(ok ? "ok" : "falhou");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setEstado(""), ok ? 3000 : 8000);
  }

  return (
    <span data-paiia-copiar-mlb-bloco style={{ display: compacto ? "flex" : "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap", verticalAlign: "middle", maxWidth: "100%", marginTop: compacto ? 4 : 0 }}>
      <button
        type="button"
        data-paiia-copiar-mlb={codigo}
        onClick={copiar}
        title={`Copiar ${codigo}`}
        aria-label={`Copiar ${codigo} para colar no Bling`}
        style={{ ...botao, ...(compacto ? compactoEstilo : {}), ...(estado === "ok" ? botaoOk : {}) }}
      >
        {estado === "ok" ? TEXTO_MLB_COPIADO : TEXTO_BOTAO_COPIAR_MLB}
      </button>
      <span role="status" aria-live="polite" data-paiia-copiar-mlb-status={estado || "pronto"} style={estado === "falhou" ? falhou : oculto}>
        {estado === "falhou" ? `Não foi possível copiar sozinho. Selecione e copie: ${codigo}` : estado === "ok" ? TEXTO_MLB_COPIADO : ""}
      </span>
    </span>
  );
}

const botao = { padding: "6px 12px", minHeight: 36, borderRadius: 8, border: "1px solid #475569", background: "#334155", color: "#e2e8f0", cursor: "pointer", fontSize: 13, fontWeight: 600, whiteSpace: "normal", maxWidth: "100%", textAlign: "left", touchAction: "manipulation" };
const compactoEstilo = { padding: "4px 10px", minHeight: 32, fontSize: 12 };
const botaoOk = { background: "#166534", border: "1px solid #22c55e", color: "#fff" };
const falhou = { color: "#fca5a5", fontSize: 12, userSelect: "all" };
const oculto = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" };
