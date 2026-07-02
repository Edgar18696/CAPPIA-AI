export default function FotoIA({
  categoriaFoto,
  setCategoriaFoto,
  arquivosFotos,
  setArquivosFotos,
  setArquivo,
  setPreview,
  setUrlPublica,
  setResultadoIA,
  setStatusProcesso,
  tipoFundoFoto,
  setTipoFundoFoto,
  processarSelecionadas,
  statusProcesso,
  preview,
  resultadoIA,
  limparTelaFoto,
  processando,
  baixarImagem,
  cardStyle,
  buttonGreen,
  buttonRed,
  produtoCopilot,
}) {
  return (
    <div style={{ marginTop: "50px" }}>
      <h2 style={{ color: "#67e8f9", fontSize: "32px", marginBottom: "10px" }}>
        📸 Foto Premium IA
      </h2>
      {produtoCopilot && (
  <div
    style={{
      background: "#0f172a",
      border: "1px solid #67e8f9",
      borderRadius: "12px",
      padding: "15px",
      marginBottom: "20px",
      color: "#e2e8f0",
    }}
  >
    <strong style={{ color: "#67e8f9" }}>
      🤖 Produto recebido do Copilot:
    </strong>

    <div style={{ marginTop: "8px" }}>
      {produtoCopilot}
    </div>
  </div>
)}

      <div style={{ marginTop: "20px", marginBottom: "20px" }}>
        <h3 style={{ color: "#67e8f9", marginBottom: "10px" }}>
          📂 Categoria da Foto
        </h3>

        <select
          value={categoriaFoto}
          onChange={(e) => setCategoriaFoto(e.target.value)}
          style={{
            padding: "12px",
            borderRadius: "10px",
            width: "320px",
            fontSize: "16px",
          }}
        >
          <option value="autopecas">🚗 Autopeças</option>
          <option value="eletronicos">💻 Eletrônicos</option>
          <option value="moda">👕 Moda</option>
          <option value="cosmeticos">💄 Cosméticos</option>
          <option value="doceria">🍰 Doceria</option>
          <option value="petshop">🐶 Pet Shop</option>
          <option value="ferramentas">🔧 Ferramentas</option>
          <option value="geral">📦 Geral</option>
        </select>
      </div>

      <p style={{ color: "#94a3b8", marginBottom: "25px" }}>
        Transforme até 8 fotos em imagens profissionais para marketplace.
      </p>

      <h3 style={{ color: "white" }}>Escolha até 8 fotos</h3>

      <div style={{ ...cardStyle, maxWidth: "950px", margin: "30px auto" }}>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => {
            const files = Array.from(e.target.files);

            console.log("TOTAL DE FOTOS:", files.length);

            if (files.length === 0) return;

            if (files.length > 8) {
              alert("Máximo de 8 fotos por vez.");
              return;
            }

            setArquivo(files[0]);
            setPreview(URL.createObjectURL(files[0]));

            setArquivosFotos(
              files.map((file) => ({
                file,
                preview: URL.createObjectURL(file),
                selecionada: true,
              }))
            );

            setUrlPublica("");
            setResultadoIA("");
            setStatusProcesso("");
          }}
        />

        {arquivosFotos.map((foto, index) => (
          <div
            key={index}
            style={{
              background: "#0f172a",
              border: "1px solid #2563eb",
              borderRadius: "12px",
              padding: "10px",
              textAlign: "center",
              width: "320px",
              margin: "15px auto",
            }}
          >
            <img
              src={foto.preview}
              alt=""
              style={{
                width: "220px",
                height: "120px",
                objectFit: "contain",
                background: "white",
                borderRadius: "8px",
              }}
            />
          </div>
        ))}

        <div style={{ marginTop: "20px", textAlign: "center" }}>
          <select
            value={tipoFundoFoto}
            onChange={(e) => setTipoFundoFoto(e.target.value)}
            style={{
              padding: "12px",
              borderRadius: "10px",
              background: "#0f172a",
              color: "white",
              border: "1px solid #2563eb",
              marginTop: "15px",
            }}
          >
            <option value="branco">🎨 Fundo Branco</option>
            <option value="transparente">✨ Fundo Transparente</option>
          </select>

          <button
            style={{
              ...buttonGreen,
              marginLeft: "15px",
            }}
            onClick={processarSelecionadas}
            disabled={processando}
          >
            ✨ Processar Selecionadas
          </button>
        </div>

        {statusProcesso && (
          <div
            style={{
              marginTop: "25px",
              padding: "15px",
              background: "#020617",
              border: "1px solid #38bdf8",
              borderRadius: "12px",
              color: "#bfdbfe",
              fontWeight: "bold",
            }}
          >
            {statusProcesso}
          </div>
        )}

        {preview && (
          <div style={{ marginTop: "30px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "30px",
                flexWrap: "wrap",
                alignItems: "flex-start",
              }}
            >
              <div>
                <img
                  src={preview}
                  alt=""
                  style={{
                    width: "400px",
                    borderRadius: "10px",
                    background: "white",
                  }}
                />
              </div>

              {resultadoIA && (
                <div>
                  <img
                    src={resultadoIA}
                    alt=""
                    style={{
                      width: "400px",
                      borderRadius: "10px",
                      background: "white",
                    }}
                  />
                </div>
              )}
            </div>

            <div
              style={{
                marginTop: "25px",
                display: "flex",
                justifyContent: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <button onClick={limparTelaFoto} disabled={processando} style={buttonRed}>
                🧹 Limpar
              </button>

              {resultadoIA && (
                <>
                  <button onClick={() => baixarImagem(resultadoIA)} style={buttonGreen}>
                    ⬇️ Baixar Resultado
                  </button>

                  <button
                    onClick={() => {
                      alert("Próximo passo: vamos ligar este botão ao Banner IA.");
                    }}
                    style={{
                      background: "#2563eb",
                      color: "white",
                      border: "none",
                      padding: "12px 18px",
                      borderRadius: "10px",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    🎨 Criar Banner
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}