export default function BotoesPublicacao({
  salvarRascunho,
  publicarAnuncio,
  anuncioPronto,
}) {
  return (
    <div style={{ marginTop: "25px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
      <button onClick={salvarRascunho} style={buttonStyle}>
        💾 Salvar
      </button>

      <button
        onClick={publicarAnuncio}
        style={anuncioPronto ? buttonGreen : buttonBlocked}
      >
        📤 Publicar
      </button>
    </div>
  );
}

const buttonStyle = {
  padding: "12px 18px",
  borderRadius: "10px",
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
};

const buttonGreen = {
  ...buttonStyle,
  background: "#22c55e",
};

const buttonBlocked = {
  ...buttonStyle,
  background: "#92400e",
};