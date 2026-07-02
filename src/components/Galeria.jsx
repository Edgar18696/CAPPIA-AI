export default function Galeria({
  galeria,
  filtroGaleria,
  setFiltroGaleria,
  buscaGaleria,
  setBuscaGaleria,
  selecionadas,
  setSelecionadas,
  alternarSelecionada,
  excluirSelecionadas,
  baixarSelecionadas,
  baixandoLote,
  excluirImagem,
  baixarImagem,
  setImagemBanner,
  setScreen,
  setFotosAnuncio,
  cardStyle,
}) {
  const galeriaFiltrada = galeria.filter((item) => {
    const passaTipo =
      filtroGaleria === "todos" ? true : item.tipo === filtroGaleria;

    const textoBusca = buscaGaleria.trim().toLowerCase();

    const passaBusca =
      !textoBusca ||
      String(item.tipo || "").toLowerCase().includes(textoBusca) ||
      String(item.created_at || "").toLowerCase().includes(textoBusca);

    return passaTipo && passaBusca;
  });

  return (
    <div style={{ marginTop: "50px" }}>
      <h2 style={{ color: "#67e8f9", fontSize: "32px" }}>🖼 Galeria</h2>

      <div
        style={{
          background: "#0f172a",
          border: "1px solid #2563eb",
          borderRadius: "12px",
          padding: "12px",
          width: "320px",
          margin: "15px auto",
          color: "#93c5fd",
          fontWeight: "bold",
        }}
      >
        ☑ Selecionadas: {selecionadas.length}
      </div>

      <input
        type="text"
        placeholder="🔍 Buscar imagem"
        value={buscaGaleria}
        onChange={(e) => setBuscaGaleria(e.target.value)}
        style={{
          padding: "12px",
          width: "300px",
          borderRadius: "8px",
          marginBottom: "20px",
        }}
      />

      <div
        style={{
          display: "flex",
          gap: "15px",
          justifyContent: "center",
          flexWrap: "wrap",
          marginBottom: "20px",
        }}
      >
        <button onClick={() => setFiltroGaleria("todos")}>
          Todos ({galeria.length})
        </button>

        <button onClick={() => setFiltroGaleria("foto")}>
          📸 Fotos ({galeria.filter((x) => x.tipo === "foto").length})
        </button>

        <button onClick={() => setFiltroGaleria("banner")}>
          🎨 Banners ({galeria.filter((x) => x.tipo === "banner").length})
        </button>

        <button onClick={() => setFiltroGaleria("clip")}>
          🎬 Clips ({galeria.filter((x) => x.tipo === "clip").length})
        </button>
      </div>

      <p style={{ color: "#93c5fd" }}>
        Total exibido: {galeriaFiltrada.length}
      </p>

      <div style={{ marginBottom: "15px" }}>
        <button
          onClick={() =>
            setSelecionadas(galeriaFiltrada.map((item) => item.created_at))
          }
          style={{
            background: "#2563eb",
            color: "white",
            padding: "10px 18px",
            borderRadius: "10px",
            border: "none",
            cursor: "pointer",
            marginRight: "10px",
            fontWeight: "bold",
          }}
        >
          ✅ Selecionar tudo
        </button>

        <button
          onClick={() => setSelecionadas([])}
          style={{
            background: "#475569",
            color: "white",
            padding: "10px 18px",
            borderRadius: "10px",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          ❌ Desmarcar tudo
        </button>
      </div>

      {selecionadas.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
            <button
  onClick={() => {
  const fotos = galeriaFiltrada
    .filter((item) => selecionadas.includes(item.created_at))
    .map((item) => ({
      id: item.id || item.created_at,
      imagem_processada: item.imagem_processada || item.imagem_original,
      tipo: item.tipo,
      created_at: item.created_at,
    }));

  setFotosAnuncio(fotos);
  setSelecionadas([]);
  setScreen("novoAnuncio");
}}
  style={{
    background: "#7c3aed",
    color: "white",
    padding: "10px 18px",
    borderRadius: "10px",
    border: "none",
    cursor: "pointer",
    marginRight: "10px",
    fontWeight: "bold",
  }}
>
  📤 Usar selecionadas no anúncio ({selecionadas.length})
</button>
          <button
            onClick={excluirSelecionadas}
            style={{
              background: "#dc2626",
              color: "white",
              padding: "10px 18px",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              marginRight: "10px",
              fontWeight: "bold",
            }}
          >
            🗑️ Excluir selecionadas ({selecionadas.length})
          </button>

          <button
            onClick={baixarSelecionadas}
            style={{
              background: "#16a34a",
              color: "white",
              padding: "10px 18px",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            {baixandoLote
              ? "⏳ Baixando..."
              : `⬇️ Baixar selecionadas (${selecionadas.length})`}
          </button>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
          gap: "20px",
        }}
      >
        {galeriaFiltrada.map((item) => {
          const url = item.imagem_processada || item.imagem_original;

          return (
            <div key={item.id || item.created_at} style={cardStyle}>
              <input
                type="checkbox"
                checked={selecionadas.includes(item.created_at)}
                onChange={() => alternarSelecionada(item.created_at)}
                style={{
                  width: "20px",
                  height: "20px",
                  marginBottom: "10px",
                }}
              />

              <img
                src={url}
                alt=""
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
                style={{
                  width: "100%",
                  height: "230px",
                  objectFit: "contain",
                  background: "#f1f5f9",
                  borderRadius: "10px",
                }}
              />

              <p style={{ color: "#93c5fd", fontWeight: "bold" }}>
                {item.tipo === "banner"
                  ? "🎨 Banner IA"
                  : item.tipo === "clip"
                  ? "🎬 Clip IA"
                  : "📸 Foto IA"}
              </p>

              <p style={{ color: "#94a3b8", fontSize: "13px" }}>
                {item.created_at
                  ? new Date(item.created_at).toLocaleString("pt-BR")
                  : ""}
              </p>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={() => baixarImagem(url)}
                  style={{
                    background: "#16a34a",
                    color: "white",
                    border: "none",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  ⬇️ Baixar
                </button>

                {item.tipo === "foto" && (
                  <button
                    onClick={() => {
                      setImagemBanner(url);
                      setScreen("banner");
                    }}
                    style={{
                      background: "#2563eb",
                      color: "white",
                      border: "none",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    🎨 Banner
                  </button>
                )}

                <button
                  onClick={() => excluirImagem(item)}
                  style={{
                    background: "#dc2626",
                    color: "white",
                    border: "none",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  🗑️ Excluir
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {galeriaFiltrada.length === 0 && (
        <p style={{ color: "#94a3b8", marginTop: "25px" }}>
          Nenhuma imagem encontrada.
        </p>
      )}
    </div>
  );
}