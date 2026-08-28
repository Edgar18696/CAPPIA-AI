export default function PainelFotosAnuncio({
  fotosAnuncio,
  setFotosAnuncio,
}) {
  if (!fotosAnuncio || fotosAnuncio.length === 0) return null;

  function moverFoto(index, direcao) {
    const novas = [...fotosAnuncio];
    const novoIndex = index + direcao;

    if (novoIndex < 0 || novoIndex >= novas.length) return;

    [novas[index], novas[novoIndex]] = [novas[novoIndex], novas[index]];
    setFotosAnuncio(novas);
  }

  function removerFoto(index) {
    setFotosAnuncio(fotosAnuncio.filter((_, i) => i !== index));
  }

  return (
    <div style={{ marginTop: "25px" }}>
      <h3 style={{ color: "#67e8f9" }}>
        🖼 Fotos selecionadas para o anúncio
      </h3>

      <p style={{ color: "#94a3b8" }}>
        A primeira foto será usada como capa do anúncio.
      </p>

      <div
        style={{
          display: "flex",
          gap: "14px",
          flexWrap: "wrap",
          marginTop: "18px",
        }}
      >
        {fotosAnuncio.map((foto, index) => (
          <div
            key={foto.created_at || foto.id || index}
            style={{
              width: "130px",
              background: "#0f172a",
              borderRadius: "14px",
              padding: "10px",
              border:
                index === 0
                  ? "3px solid #22c55e"
                  : "1px solid #334155",
              position: "relative",
            }}
          >
            {index === 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "8px",
                  left: "8px",
                  background: "#22c55e",
                  color: "#fff",
                  padding: "4px 8px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  zIndex: 2,
                }}
              >
                ⭐ CAPA
              </div>
            )}

            <button
              onClick={() => removerFoto(index)}
              style={{
                position: "absolute",
                top: "8px",
                right: "8px",
                background: "#dc2626",
                color: "#fff",
                border: "none",
                borderRadius: "50%",
                width: "26px",
                height: "26px",
                cursor: "pointer",
                zIndex: 2,
                fontWeight: "bold",
              }}
            >
              ×
            </button>

            <img
              src={foto.imagem_processada || foto.imagem_original}
              alt="Foto do anúncio"
              style={{
                width: "100%",
                height: "120px",
                objectFit: "cover",
                borderRadius: "10px",
                border: "2px solid #22d3ee",
              }}
            />

            <div
              style={{
                display: "flex",
                gap: "8px",
                marginTop: "10px",
              }}
            >
              <button
                disabled={index === 0}
                onClick={() => moverFoto(index, -1)}
                style={botaoSeta}
              >
                ⬅️
              </button>

              <button
                disabled={index === fotosAnuncio.length - 1}
                onClick={() => moverFoto(index, 1)}
                style={botaoSeta}
              >
                ➡️
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const botaoSeta = {
  flex: 1,
  padding: "8px",
  borderRadius: "8px",
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
};