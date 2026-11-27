import { useEffect, useState } from "react";
import BuscaCatalogo from "./BuscaCatalogo";
import {
  GRUPOS_CATALOGOS_TECNICOS,
  FABRICANTES_CATALOGOS,
  oficiaisDoFabricante,
} from "../config/catalogosTecnicos";
import { supabase, ambienteSupabase } from "../supabase";
import { pilotoParceirosAtivo } from "../config/parceirosPiloto";
import ParceirosPiloto, { ParceirosNaPesquisa } from "./ParceirosPiloto";

// (26/11) Piloto PAIIA Parceiros: só no ambiente de teste (STAGING).
const PILOTO_PARCEIROS = pilotoParceirosAtivo(ambienteSupabase);

// (27/11) Parceiros só para quem entrou na conta: o banco não libera a área para visitantes.
function useLogado() {
  const [logado, setLogado] = useState(false);
  useEffect(() => {
    let vivo = true;
    supabase.auth.getSession().then(({ data }) => vivo && setLogado(!!data?.session));
    const { data } = supabase.auth.onAuthStateChange((_evento, sessao) => setLogado(!!sessao));
    return () => { vivo = false; data?.subscription?.unsubscribe(); };
  }, []);
  return logado;
}

// (26/11/2026) CATÁLOGOS TÉCNICOS — UMA SÓ TELA.
// Acabou a separação em duas abas (base interna x sites externos): o usuário
// abre, digita o código (ou escolhe o fabricante) e pesquisa. Cada cartão junta a
// pesquisa na Base PAIIA (filtrada pelo fabricante) e o catálogo oficial, quando houver.
export default function Catalogos({ setScreen, cardStyle }) {
  const [fabricanteId, setFabricanteId] = useState("");
  const fabricante = FABRICANTES_CATALOGOS.find((f) => f.id === fabricanteId) || null;
  const oficiais = oficiaisDoFabricante(fabricante);
  const [pesquisaParceiros, setPesquisaParceiros] = useState(null);
  const logado = useLogado();
  const parceirosVisiveis = PILOTO_PARCEIROS && logado;

  function escolher(id) {
    setFabricanteId((atual) => (atual === id ? "" : id));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div style={cardStyle}>
      <div style={topo}>
        <div>
          <h2 style={titulo}>📚 Catálogos Técnicos</h2>
          <p style={subtitulo}>
            Digite o código da peça ou escolha o fabricante. O PAIIA pesquisa nos
            catálogos já importados e mostra o catálogo oficial.
          </p>
        </div>
        <button type="button" onClick={() => setScreen?.("home")} style={botaoVoltar}>
          ← Voltar
        </button>
      </div>

      {fabricante && (
        <div style={faixaFabricante} data-testid="fabricante-escolhido">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <strong style={{ fontSize: "15px" }}>{fabricante.nome}</strong>
            <button type="button" onClick={() => setFabricanteId("")} style={botaoLimpar}>
              ✕ Todos os fabricantes
            </button>
          </div>
          {oficiais.length > 0 ? (
            <div style={linhaLinks}>
              {oficiais.flatMap((c) =>
                (c.links?.length ? c.links : [{ rotulo: c.nome, url: c.url }]).map((l) => (
                  <a key={`${c.id}-${l.url}`} href={l.url} target="_blank" rel="noopener noreferrer" style={linkOficial}>
                    ↗ {l.rotulo}
                    {c.acesso && c.acesso !== "Livre" ? ` (${c.acesso.toLowerCase()})` : ""}
                  </a>
                ))
              )}
            </div>
          ) : (
            <div style={textoMiudo}>Sem catálogo oficial online no Brasil: a pesquisa usa a Base PAIIA.</div>
          )}
          {oficiais.filter((c) => c.observacao).map((c) => (
            <div key={`obs-${c.id}`} style={textoMiudo}>{c.observacao}</div>
          ))}
        </div>
      )}

      <BuscaCatalogo
        setScreen={setScreen}
        embutido
        fabricante={fabricante}
        aoPesquisar={parceirosVisiveis ? setPesquisaParceiros : null}
      />

      {parceirosVisiveis && <ParceirosNaPesquisa pesquisa={pesquisaParceiros} />}

      {GRUPOS_CATALOGOS_TECNICOS.map((grupo) => (
        <section key={grupo.id} style={{ marginTop: "22px" }}>
          <h3 style={tituloGrupo}>{grupo.icone} {grupo.titulo}</h3>
          <div style={grade}>
            {FABRICANTES_CATALOGOS.filter((f) => f.grupo === grupo.id).map((f) => {
              const ativo = f.id === fabricanteId;
              const temOficial = oficiaisDoFabricante(f).length > 0;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => escolher(f.id)}
                  style={cartao(ativo)}
                  aria-pressed={ativo}
                  data-testid={`cartao-${f.id}`}
                >
                  <strong>{f.nome}</strong>
                  <span style={rotuloCartao}>{temOficial ? "Base PAIIA + catálogo oficial" : "Base PAIIA"}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {parceirosVisiveis && <ParceirosPiloto />}
      {PILOTO_PARCEIROS && !logado && (
        <p style={{ marginTop: "22px", fontSize: "13px", color: "#94a3b8" }} data-testid="parceiros-visitante">
          🤝 <b>PAIIA Parceiros</b>: entre na sua conta para ver os distribuidores parceiros e falar direto com eles.
        </p>
      )}

      <button type="button" onClick={() => setScreen("importadorCatalogos")} style={botaoImportar}>
        📥 Importar Catálogo Técnico em PDF
      </button>
    </div>
  );
}

const topo = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap", marginBottom: "18px" };
const titulo = { color: "#67e8f9", marginTop: 0, marginBottom: "6px" };
const subtitulo = { color: "#cbd5e1", margin: 0, lineHeight: 1.5, maxWidth: "760px" };
const botaoVoltar = { padding: "11px 18px", borderRadius: "12px", border: "1px solid #334155", background: "#0f172a", color: "#fff", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" };
const faixaFabricante = { padding: "12px 14px", borderRadius: "12px", border: "1px solid #0e7490", background: "rgba(14,116,144,.15)", color: "#e0f2fe", marginBottom: "14px", display: "grid", gap: "8px" };
const botaoLimpar = { padding: "5px 10px", borderRadius: "999px", border: "1px solid #334155", background: "#0f172a", color: "#cbd5e1", fontSize: "12px", cursor: "pointer" };
const linhaLinks = { display: "flex", flexWrap: "wrap", gap: "8px" };
const linkOficial = { padding: "7px 12px", borderRadius: "10px", border: "1px solid #22d3ee", color: "#a5f3fc", textDecoration: "none", fontSize: "13px", fontWeight: 700 };
const textoMiudo = { color: "#94a3b8", fontSize: "12px", lineHeight: 1.5 };
const tituloGrupo = { color: "#e2e8f0", fontSize: "15px", margin: "0 0 10px" };
const grade = { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(125px,1fr))", gap: "10px" };
const rotuloCartao = { marginTop: "4px", color: "#94a3b8", fontSize: "11px" };
const botaoImportar = { width: "100%", marginTop: "26px", padding: "12px 16px", borderRadius: "12px", border: "1px solid #0e7490", background: "transparent", color: "#a5f3fc", cursor: "pointer", fontWeight: 700, textAlign: "left" };

function cartao(ativo) {
  return {
    minHeight: "64px",
    padding: "12px",
    borderRadius: "12px",
    border: `1px solid ${ativo ? "#22d3ee" : "#1e40af"}`,
    background: ativo ? "linear-gradient(135deg,#0e7490,#1e40af)" : "linear-gradient(180deg,#0f172a,#020617)",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    cursor: "pointer",
    textAlign: "left",
  };
}
