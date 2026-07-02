import { modelosPremiumBanner } from "./bannerConstants";

export default function BannerIA({
  galeria,
  imagemBanner,
  setImagemBanner,
  bannerModelo,
  setBannerModelo,
  categoriaBanner,
  setCategoriaBanner,
  estiloBanner,
  setEstiloBanner,
  tamanhoBanner,
  setTamanhoBanner,
  fundoBanner,
  setFundoBanner,
  modeloPremiumBanner,
  setModeloPremiumBanner,
  processarBannerIA,
  processando,
  resultadoIA,
  baixarImagem,
}) {
  return (
    <div style={{ marginTop: "50px" }}>
      <h2 style={{ color: "#67e8f9", fontSize: "32px" }}>
        🎨 Banner IA
      </h2>

      <p style={{ color: "#cbd5e1" }}>
        Crie banners profissionais para marketplace, redes sociais e WhatsApp.
      </p>

      <div
        style={{
          background: "#0f172a",
          border: "1px solid #2563eb",
          borderRadius: "14px",
          padding: "18px",
          marginTop: "20px",
          marginBottom: "25px",
        }}
      >
        <h3 style={{ color: "#38bdf8" }}>💡 Dica do APPIA</h3>

        <p style={{ color: "#cbd5e1", lineHeight: "1.7" }}>
          1️⃣ Escolha uma imagem da galeria ou use a imagem enviada pela Foto IA.
          <br />
          2️⃣ Selecione o estilo premium.
          <br />
          3️⃣ Escolha o fundo desejado.
          <br />
          4️⃣ Clique em <strong>Gerar Banner IA</strong>.
        </p>
      </div>

      {imagemBanner && (
        <div
          style={{
            background: "#020617",
            border: "2px solid #22c55e",
            borderRadius: "16px",
            padding: "20px",
            maxWidth: "700px",
            margin: "0 auto 25px",
          }}
        >
          <h3 style={{ color: "#22c55e" }}>✅ Imagem selecionada</h3>

          <img
            src={imagemBanner}
            alt=""
            style={{
              width: "100%",
              maxWidth: "420px",
              height: "260px",
              objectFit: "contain",
              background: "white",
              borderRadius: "12px",
            }}
          />
        </div>
      )}

      <h3 style={{ color: "white", marginBottom: "10px" }}>
        Escolha uma imagem da galeria
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 220px))",
          gap: "15px",
          marginTop: "20px",
          justifyContent: "center",
        }}
      >
        {galeria
          .filter((item) => item.tipo === "foto")
          .map((item) => (
            <img
              key={item.created_at || item.id}
              src={item.imagem_processada}
              alt=""
              onClick={() => setImagemBanner(item.imagem_processada)}
              style={{
                width: "100%",
                height: "130px",
                objectFit: "contain",
                background: "#fff",
                cursor: "pointer",
                border:
                  imagemBanner === item.imagem_processada
                    ? "3px solid #22c55e"
                    : "2px solid #333",
                borderRadius: "10px",
              }}
            />
          ))}
      </div>

      <h3 style={{ marginTop: "30px", color: "#38bdf8" }}>
        Escolha o estilo premium
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
          gap: "12px",
          marginTop: "15px",
          maxWidth: "900px",
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        {modelosPremiumBanner.map((modelo) => (
          <button
            key={modelo.id}
            onClick={() => setModeloPremiumBanner(modelo.id)}
            style={{
              background:
                modeloPremiumBanner === modelo.id
                  ? "linear-gradient(135deg,#2563eb,#38bdf8)"
                  : "#0f172a",
              color: "white",
              border:
                modeloPremiumBanner === modelo.id
                  ? "2px solid #67e8f9"
                  : "1px solid #334155",
              padding: "18px",
              borderRadius: "16px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "15px",
              minHeight: "75px",
            }}
          >
            {modelo.nome}
          </button>
        ))}
      </div>

      <div
        style={{
          marginTop: "30px",
          display: "flex",
          justifyContent: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <select
          value={categoriaBanner}
          onChange={(e) => setCategoriaBanner(e.target.value)}
          style={{ padding: "12px", borderRadius: "10px" }}
        >
          <option value="autopecas">🚗 Autopeças</option>
          <option value="moda">👕 Moda</option>
          <option value="cosmeticos">💄 Cosméticos</option>
          <option value="doceria">🍰 Doceria</option>
          <option value="eletronicos">💻 Eletrônicos</option>
          <option value="geral">📦 Geral</option>
        </select>

        <select
          value={fundoBanner}
          onChange={(e) => setFundoBanner(e.target.value)}
          style={{ padding: "12px", borderRadius: "10px" }}
        >
          <option value="automatico">Automático IA</option>
          <option value="branco">Branco</option>
          <option value="azul_degrade">Azul degradê</option>
          <option value="escuro_premium">Escuro premium</option>
          <option value="colorido">Colorido</option>
        </select>

        <select
          value={tamanhoBanner}
          onChange={(e) => setTamanhoBanner(e.target.value)}
          style={{ padding: "12px", borderRadius: "10px" }}
        >
          <option value="1200x1200">1200x1200</option>
          <option value="1200x1800">1200x1800</option>
          <option value="1080x1920">1080x1920</option>
          <option value="1920x1080">1920x1080</option>
        </select>
      </div>

      <button
        onClick={processarBannerIA}
        disabled={processando || !imagemBanner}
        style={{
          marginTop: "25px",
          padding: "14px 26px",
          borderRadius: "12px",
          border: "none",
          background: processando || !imagemBanner ? "#475569" : "#2563eb",
          color: "white",
          fontWeight: "bold",
          cursor: processando || !imagemBanner ? "not-allowed" : "pointer",
        }}
      >
        {processando ? "⏳ Gerando..." : "🎨 Gerar Banner IA"}
      </button>

      {resultadoIA && (
        <div
          style={{
            marginTop: "30px",
            background: "#0f172a",
            border: "1px solid #2563eb",
            borderRadius: "16px",
            padding: "25px",
            maxWidth: "800px",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          <h2 style={{ color: "#67e8f9" }}>✅ Banner Pronto</h2>

          <img
            src={resultadoIA}
            alt=""
            style={{
              width: "100%",
              maxWidth: "600px",
              background: "white",
              borderRadius: "12px",
            }}
          />

          <br />

          <button
            onClick={() => baixarImagem(resultadoIA)}
            style={{
              marginTop: "20px",
              background: "#22c55e",
              color: "white",
              border: "none",
              padding: "12px 18px",
              borderRadius: "10px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            ⬇️ Baixar Banner
          </button>
        </div>
      )}
    </div>
  );
}