import { useState } from "react";
import { supabaseKey } from "../supabase";
export default function Copilot({
  cardStyle,
  setScreen,
  setProdutoCopilot,
}) {
      const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState("");
const gerarTitulo = () => gerarAnuncio("titulo");

const gerarDescricao = () => gerarAnuncio("descricao");

const gerarAplicacao = () => gerarAnuncio("aplicacao");

const gerarFoto = () => {
  setProdutoCopilot(texto);
  setScreen("foto");
};

const gerarBanner = () => {
  setProdutoCopilot(texto);
  setScreen("banner");
};

const gerarVideo = () => gerarAnuncio("video");

const gerarOEM = () => gerarAnuncio("oem");

const gerarEquivalencia = () => gerarAnuncio("equivalencia");
async function gerarAnuncio(tipo = "completo") {
    if (!texto.trim()) {
      alert("Descreva o produto primeiro.");
      return;
    }

    try {
      setResultado("🤖 Gerando anúncio com IA...");

      const resposta = await fetch(
        "https://arqzpqkkpwikyecdbopf.supabase.co/functions/v1/atendimento-ia",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
      body: JSON.stringify({
  mensagem: texto,
  especialista: "copilot",
  tipo,
}),
        }
      );

      const json = await resposta.json();

      setResultado(json.resposta || "Nenhuma resposta retornada pela IA.");
    } catch (erro) {
      console.log("ERRO COPILOT:", erro);
      setResultado("❌ Erro ao gerar anúncio com IA.");
    }
  }

  return (
    <div style={{ marginTop: "40px" }}>
      <div style={cardStyle}>
        <h2 style={{ color: "#67e8f9", fontSize: "32px" }}>
          ✨ APPIA Copilot
        </h2>

        <p style={{ color: "#cbd5e1", fontSize: "18px" }}>
          Gere título, descrição e palavras-chave para seu anúncio.
        </p>

        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ex: Sensor MAP Bosch Fiat Palio Fire 1.0 2014"
          style={textareaStyle}
        />

     <div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))",
    gap: "15px",
    marginTop: "25px",
  }}
>
  <button style={botaoPrincipalStyle} onClick={gerarTitulo}>
    🏷️ Gerar Título
  </button>

  <button style={botaoPrincipalStyle} onClick={gerarDescricao}>
    📝 Gerar Descrição
  </button>

  <button style={botaoPrincipalStyle} onClick={gerarAplicacao}>
    🚗 Aplicações
  </button>

  <button style={botaoPrincipalStyle} onClick={gerarFoto}>
    📸 Foto IA
  </button>

  <button style={botaoPrincipalStyle} onClick={gerarBanner}>
    🎨 Banner IA
  </button>

  <button style={botaoPrincipalStyle} onClick={gerarVideo}>
    🎬 Vídeo IA
  </button>

  <button style={botaoPrincipalStyle} onClick={gerarOEM}>
    🔍 OEM
  </button>

  <button style={botaoPrincipalStyle} onClick={gerarEquivalencia}>
    🔄 Equivalências
  </button>

<button style={botaoPrincipalStyle} onClick={() => gerarAnuncio("completo")}>
  📦 Anúncio Completo
</button>
</div>

        {resultado && <pre style={resultadoStyle}>{resultado}</pre>}
      </div>
    </div>
  );
}

const textareaStyle = {
  width: "100%",
  minHeight: "140px",
  marginTop: "25px",
  padding: "15px",
  borderRadius: "12px",
  fontSize: "16px",
};

const botaoPrincipalStyle = {
  marginTop: "20px",
  padding: "14px 28px",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(135deg, #2563eb, #22d3ee)",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const resultadoStyle = {
  marginTop: "25px",
  padding: "20px",
  borderRadius: "12px",
  background: "#020617",
  color: "#e0f2fe",
  whiteSpace: "pre-wrap",
};