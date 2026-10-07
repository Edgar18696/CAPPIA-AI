import { useEffect, useState } from "react";
import { listarFichasCentral } from "../services/fichasCentralService";
import { consumirNovaCriacaoMidia } from "../services/limparEstadoTemporarioMidia";
import {
  ESTADO_CENTRAL,
  TEXTO_ESTADO_CENTRAL,
  COR_ESTADO_CENTRAL,
  resumoFichaCentral,
  ordenarFichasCentral,
  lerAnuncioEmAndamento,
  restaurarAnuncioEmAndamento,
  rascunhoLocalJaNaBase,
  enderecoDaFicha,
} from "../services/fichasCentral";

/*
 * FICHAS DO PAIIA na Central de Publicação.
 * Mostra TODAS as fichas do usuário (prontas ou não) com o estado de cada
 * uma, e o rascunho do Novo Anúncio guardado neste navegador.
 * "Abrir" só navega: a ficha é reaberta pela base (?ficha=<ID>) na etapa
 * em que estava. Nada é apagado, recriado ou publicado aqui.
 */
export default function PainelFichasCentral({ setScreen }) {
  const [estado, setEstado] = useState({ carregando: true, erro: "", fichas: [] });
  const [local] = useState(() => {
    try {
      return lerAnuncioEmAndamento(localStorage);
    } catch {
      return null;
    }
  });
  const [mostrarTodas, setMostrarTodas] = useState(false);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const r = await listarFichasCentral();
      if (!ativo) return;
      if (!r.ok) setEstado({ carregando: false, erro: r.erro, fichas: [] });
      else setEstado({ carregando: false, erro: "", fichas: ordenarFichasCentral(r.fichas.map(resumoFichaCentral)) });
    })();
    return () => { ativo = false; };
  }, []);

  function abrirFicha(id) {
    try {
      window.history.replaceState(window.history.state, "", enderecoDaFicha(window.location.href, id));
    } catch {
      // sem acesso ao endereço: a Conferência não conseguiria achar a ficha
      return;
    }
    setScreen?.("mercadoLivreTeste");
  }

  function retomarLocal() {
    try {
      // "Retomar" não é criação nova: o Novo Anúncio abre com o guardado.
      if (restaurarAnuncioEmAndamento(localStorage)) consumirNovaCriacaoMidia();
    } catch {
      // segue: o Novo Anúncio abre com o que houver
    }
    setScreen?.("novoAnuncio");
  }

  const mostrarLocal = local && !rascunhoLocalJaNaBase(local, estado.fichas);
  const fichas = mostrarTodas ? estado.fichas : estado.fichas.slice(0, 12);
  const contagem = estado.fichas.reduce((m, f) => ({ ...m, [f.estado]: (m[f.estado] || 0) + 1 }), {});

  return (
    <section data-paiia-fichas-central style={caixa}>
      <h3 style={{ color: "#fde047", margin: "0 0 6px" }}>📂 Suas fichas de anúncio</h3>
      <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 10px" }}>
        Todas as fichas aparecem aqui, mesmo as que ainda não estão prontas. Abrir uma ficha só navega: nada é apagado nem publicado.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {Object.values(ESTADO_CENTRAL).map((e) => (
          <span key={e} data-paiia-legenda-estado={e} style={{ ...etiqueta(e), opacity: contagem[e] || (e === ESTADO_CENTRAL.EM_ANDAMENTO && mostrarLocal) ? 1 : 0.45 }}>
            {COR_ESTADO_CENTRAL[e].icone} {TEXTO_ESTADO_CENTRAL[e]}
            {contagem[e] ? ` (${contagem[e]})` : ""}
          </span>
        ))}
      </div>

      {mostrarLocal && (
        <div data-paiia-ficha-local style={linha}>
          <span style={etiqueta(ESTADO_CENTRAL.EM_ANDAMENTO)}>{COR_ESTADO_CENTRAL[ESTADO_CENTRAL.EM_ANDAMENTO].icone} {TEXTO_ESTADO_CENTRAL[ESTADO_CENTRAL.EM_ANDAMENTO]}</span>
          <span style={{ flex: 1, minWidth: 180 }}>
            <b>{local.resumo.codigo || "Sem código"}</b> · {local.resumo.titulo || "Sem título"}
            <span style={sub}> · Novo Anúncio guardado neste navegador</span>
          </span>
          <button type="button" data-paiia-retomar-local onClick={retomarLocal} style={botao}>
            ✏️ Retomar no Novo Anúncio
          </button>
        </div>
      )}

      {estado.carregando && <p style={sub}>⏳ Lendo as fichas na base PAIIA...</p>}
      {estado.erro && <p style={{ ...sub, color: "#fca5a5" }}>❌ {estado.erro}</p>}
      {!estado.carregando && !estado.erro && !estado.fichas.length && !mostrarLocal && (
        <p style={sub}>Nenhuma ficha encontrada.</p>
      )}

      {fichas.map((f) => (
        <div key={f.id} data-paiia-ficha-central={f.estado} style={linha}>
          <span style={etiqueta(f.estado)}>{f.cor.icone} {f.texto}</span>
          <span style={{ flex: 1, minWidth: 180 }}>
            <b>{f.codigo || "Sem código"}</b> · {f.titulo || "Sem título"}
            {f.mlb ? <span style={sub}> · {f.mlb}</span> : null}
            {f.conta ? <span style={sub}> · {f.conta}</span> : null}
            {f.pendencia ? <span style={{ ...sub, color: "#fca5a5" }}> · {f.pendencia}</span> : null}
            {f.noNovoAnuncio ? <span style={sub}> · Novo Anúncio · {f.completa ? "ficha completa" : "ficha parcial"}</span> : null}
          </span>
          <button type="button" data-paiia-abrir-ficha={f.id} onClick={() => abrirFicha(f.id)} style={botao}>
            {f.publicado
              ? "👁 Ver anúncio publicado"
              : f.noNovoAnuncio
                ? "✏️ Continuar no Novo Anúncio"
                : f.estado === ESTADO_CENTRAL.AGUARDANDO_CONFERENCIA
                  ? "📝 Continuar Conferência"
                  : "▶ Continuar"}
          </button>
        </div>
      ))}
      {estado.fichas.length > 12 && (
        <button type="button" onClick={() => setMostrarTodas((v) => !v)} style={{ ...botao, marginTop: 8 }}>
          {mostrarTodas ? "Mostrar menos" : `Mostrar todas (${estado.fichas.length})`}
        </button>
      )}
    </section>
  );
}

const caixa = { border: "1px solid #334155", borderRadius: 12, padding: 14, background: "#0f172a", marginBottom: 16 };
const linha = { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 0", borderTop: "1px solid #1e293b", color: "#e2e8f0", fontSize: 14 };
const sub = { color: "#94a3b8", fontSize: 12 };
const botao = { padding: "6px 12px", borderRadius: 8, border: "1px solid #475569", background: "#334155", color: "#e2e8f0", cursor: "pointer", fontSize: 13 };
const etiqueta = (e) => ({ background: COR_ESTADO_CENTRAL[e].fundo, color: COR_ESTADO_CENTRAL[e].texto, borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" });
