export default function Home({
  totalFotos,
  totalBanners,
  totalVideos,
  cardStyle,
}) {
  return (
    <div style={{ marginTop: "50px" }}>
      <h1>🚀 APPIA AI</h1>

      <p style={{ color: "#93c5fd", fontSize: "18px" }}>
        Transformando imagens em vendas
      </p>

      <div
        style={{
          display: "flex",
          gap: "15px",
          justifyContent: "center",
          flexWrap: "wrap",
          marginTop: "30px",
        }}
      >
        <div style={cardStyle}>📸 Fotos: {totalFotos}</div>
        <div style={cardStyle}>🎨 Banners: {totalBanners}</div>
        <div style={cardStyle}>🎬 Vídeos: {totalVideos}</div>
      </div>
    </div>
  );
}