export default function PreviewAnuncio({
  titulo,
  descricao,
  preco,
  codigo,
  oem,
  fotosAnuncio,
}) {
  const fotoPrincipal = fotosAnuncio?.[0]?.imagem_processada;

  return (
    <div
      style={{
        marginTop: "25px",
        padding: "18px",
        borderRadius: "18px",
        background: "#020617",
        border: "1px solid #1e293b",
      }}
    >
      <h3 style={{ color: "#67e8f9", marginBottom: "15px" }}>
        👀 Preview do Anúncio
      </h3>

      <div
        style={{
          background: "#fff",
          color: "#111827",
          borderRadius: "14px",
          padding: "16px",
          maxWidth: "520px",
        }}
      >
        {fotoPrincipal ? (
          <img
            src={fotoPrincipal}
            alt="Foto principal do anúncio"
            style={{
              width: "100%",
              maxHeight: "320px",
              objectFit: "contain",
              borderRadius: "10px",
              background: "#fff",
            }}
          />
        ) : (
          <div
            style={{
              height: "260px",
              borderRadius: "10px",
              background: "#e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#6b7280",
              fontWeight: "bold",
            }}
          >
            Sem foto principal
          </div>
        )}

        <h2 style={{ marginTop: "16px", fontSize: "20px" }}>
          {titulo || "Título do anúncio"}
        </h2>

        <p style={{ fontSize: "26px", fontWeight: "bold", margin: "10px 0" }}>
          {preco ? `R$ ${preco}` : "R$ 0,00"}
        </p>

        <p style={{ fontSize: "14px", color: "#374151" }}>
          <b>Código:</b> {codigo || "Não informado"}
        </p>

        <p style={{ fontSize: "14px", color: "#374151" }}>
          <b>OEM:</b> {oem || "Não informado"}
        </p>

        <hr style={{ margin: "14px 0" }} />

        <p style={{ whiteSpace: "pre-line", lineHeight: "1.5" }}>
          {descricao || "Descrição do anúncio aparecerá aqui."}
        </p>
      </div>
    </div>
  );
}