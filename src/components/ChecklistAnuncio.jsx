export default function ChecklistAnuncio({
  codigo,
  oem,
  titulo,
  descricao,
  fotosAnuncio,
}) {
  const notaAnuncio =
    (codigo || oem ? 15 : 0) +
    (titulo ? 20 : 0) +
    (descricao ? 25 : 0) +
    (fotosAnuncio?.length > 0 ? 20 : 0) +
    (fotosAnuncio?.[0] ? 20 : 0);

  return (
    <div style={checklistStyle}>
      <h3 style={{ color: "#67e8f9", marginTop: 0 }}>
        🤖 Checklist PAIIA
      </h3>

      <p style={checkItemStyle}>{codigo || oem ? "✅" : "⬜"} Código informado</p>
      <p style={checkItemStyle}>{titulo ? "✅" : "⬜"} Título do anúncio</p>
      <p style={checkItemStyle}>{descricao ? "✅" : "⬜"} Descrição completa</p>
      <p style={checkItemStyle}>
        {fotosAnuncio?.length > 0 ? "✅" : "⬜"} Fotos selecionadas
      </p>
      <p style={checkItemStyle}>
        {fotosAnuncio?.[0] ? "⭐" : "⬜"} Foto principal
      </p>

      <p style={checkItemStyle}>⬜ Banner</p>
      <p style={checkItemStyle}>⬜ Vídeo</p>
      <p style={checkItemStyle}>⬜ Mercado Livre</p>
      <p style={checkItemStyle}>⬜ Shopee</p>

      <div style={notaBoxStyle}>Nota do anúncio: {notaAnuncio}/100</div>
    </div>
  );
}

const checklistStyle = {
  marginTop: "18px",
  background: "#020617",
  border: "1px solid #2563eb",
  borderRadius: "14px",
  padding: "16px",
};

const checkItemStyle = {
  color: "#cbd5e1",
  margin: "6px 0",
  fontWeight: "bold",
};

const notaBoxStyle = {
  marginTop: "14px",
  background: "linear-gradient(135deg,#2563eb,#22d3ee)",
  color: "white",
  padding: "12px",
  borderRadius: "12px",
  fontWeight: "bold",
  textAlign: "center",
};