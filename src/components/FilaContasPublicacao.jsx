// (14/11/2026) FILA DE CONTAS da publicação no Mercado Livre.
// Uma ficha publica em UMA conta. Depois de publicada, este bloco prepara a ficha da
// PRÓXIMA conta confirmada (cópia da ficha aprovada) e abre a Publicação dela. Lá a conta
// passa de novo pela conferência daquela conta e pela sua confirmação final: nada é
// publicado aqui.
import { useState } from "react";
import { prepararFichaProximaConta } from "../services/anuncioPublicacaoService";
import { enderecoDaFicha } from "../services/fichasCentral";
import { nomeContaPublicacao, situacaoFila } from "../services/contasPublicacaoML";

export default function FilaContasPublicacao({ anuncioId = "", plano = null, publicada = true }) {
  const [st, setSt] = useState({ ocupado: false, erro: "" });
  const s = situacaoFila(plano);
  if (!anuncioId || s.vazia) return null;
  const nome = nomeContaPublicacao(s.proxima);
  const depois = s.fila.slice(1).map(nomeContaPublicacao);

  async function preparar() {
    if (st.ocupado) return;
    setSt({ ocupado: true, erro: "" });
    const r = await prepararFichaProximaConta({ anuncioId });
    if (!r.ok) { setSt({ ocupado: false, erro: r.erro || "Não foi possível preparar a próxima conta." }); return; }
    try {
      window.location.assign(enderecoDaFicha(window.location.href, r.anuncioId));
    } catch {
      setSt({ ocupado: false, erro: `Ficha da próxima conta pronta (${r.anuncioId}): abra pela Central de Publicação.` });
    }
  }

  return (
    <div data-paiia-fila-contas-bloco data-paiia-proxima-conta={s.proxima} style={{ border: "2px solid #38bdf8", borderRadius: 12, padding: 12, margin: "12px 0", background: "#082f49", color: "#e0f2fe" }}>
      <div style={{ fontWeight: 800 }}>Fila de contas: próxima é {nome}{depois.length ? <>, depois {depois.join(" e ")}</> : ""}.</div>
      <p style={{ fontSize: 13, margin: "6px 0 0" }}>
        {publicada
          ? <>Cada conta tem o seu anúncio e a sua ficha. Ao continuar, o PAIIA abre a Publicação de <b>{nome}</b> com os mesmos dados aprovados; lá {nome} é conferida de novo e só publica com a sua confirmação.</>
          : <>Primeiro termine a publicação desta ficha. Depois, a próxima conta ({nome}) é preparada aqui.</>}
      </p>
      <button type="button" onClick={preparar} disabled={st.ocupado} data-paiia-preparar-proxima-conta
        style={{ marginTop: 8, width: "100%", padding: "12px 14px", fontSize: 15, fontWeight: 800, borderRadius: 10, border: "none", background: st.ocupado ? "#334155" : "#0284c7", color: "#fff", cursor: st.ocupado ? "wait" : "pointer" }}>
        {st.ocupado ? "⏳ Preparando a ficha da próxima conta…" : `➡ Continuar: publicação em ${nome}`}
      </button>
      {st.erro && <p data-paiia-fila-erro style={{ color: "#fca5a5", fontSize: 13, margin: "6px 0 0" }}>❌ {st.erro}</p>}
    </div>
  );
}
