import ClipIA from "./ClipIA";

export default function MidiasAppia({
  cardStyle,
  setScreen,
}) {
  function voltarParaPublicacao() {
    localStorage.setItem(
      "retornarParaMidiasPublicacao",
      "true"
    );

    setScreen?.("mercadoLivreTeste");
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1240px",
        margin: "30px auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "18px",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => setScreen?.("home")}
            style={botaoSecundario}
          >
            ← Início
          </button>

          <button
            type="button"
            onClick={voltarParaPublicacao}
            style={{
              ...botaoPrincipal,
              width: "auto",
              padding: "11px 16px",
            }}
          >
            ↩️ Voltar à Publicação
          </button>
        </div>

        <div
          style={{
            textAlign: "center",
            flex: 1,
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "#38bdf8",
              fontSize: "32px",
            }}
          >
            🎞️ Mídias PAIIA
          </h2>

          <p
            style={{
              color: "#94a3b8",
              margin: "6px 0 0",
            }}
          >
            Crie vídeo profissional do produto para anúncio.
          </p>
        </div>
      </div>

      <ClipIA
        cardStyle={cardStyle}
        setScreen={setScreen}
        embutido
      />
    </div>
  );
}

const botaoPrincipal = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "10px",
  border: "none",
  background: "linear-gradient(135deg,#15803d,#22c55e)",
  color: "#ffffff",
  fontWeight: "bold",
  cursor: "pointer",
};

const botaoSecundario = {
  padding: "11px 16px",
  borderRadius: "10px",
  border: "1px solid #38bdf8",
  background: "#082f49",
  color: "#bae6fd",
  fontWeight: "bold",
  cursor: "pointer",
};
