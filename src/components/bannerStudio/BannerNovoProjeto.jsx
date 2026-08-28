const formatosBanner = [
  {
    categoria: "marketplace",
    nome: "Mercado Livre",
    largura: 1200,
    altura: 1200,
    icone: "🟡",
  },
  {
    categoria: "marketplace",
    nome: "Shopee",
    largura: 1200,
    altura: 1200,
    icone: "🟠",
  },
  {
    categoria: "marketplace",
    nome: "Amazon",
    largura: 1600,
    altura: 1600,
    icone: "📦",
  },
  {
    categoria: "social",
    nome: "Instagram Feed",
    largura: 1080,
    altura: 1350,
    icone: "📸",
  },
  {
    categoria: "social",
    nome: "Instagram Story",
    largura: 1080,
    altura: 1920,
    icone: "📱",
  },
  {
    categoria: "social",
    nome: "Facebook Post",
    largura: 1200,
    altura: 1200,
    icone: "🔵",
  },
  {
    categoria: "social",
    nome: "Facebook Horizontal",
    largura: 1200,
    altura: 630,
    icone: "🖥️",
  },
  {
    categoria: "social",
    nome: "WhatsApp Status",
    largura: 1080,
    altura: 1920,
    icone: "💬",
  },
  {
    categoria: "site",
    nome: "Banner Principal",
    largura: 1920,
    altura: 600,
    icone: "🌐",
  },
  {
    categoria: "site",
    nome: "Banner Médio",
    largura: 1200,
    altura: 340,
    icone: "🖼️",
  },
];

export default function BannerNovoProjeto({
  formatoSelecionado,
  setFormatoSelecionado,
  larguraPersonalizada,
  setLarguraPersonalizada,
  alturaPersonalizada,
  setAlturaPersonalizada,
  iniciarProjeto,
}) {
  function selecionarFormato(formato) {
    setFormatoSelecionado(formato);

    setLarguraPersonalizada(
      formato.largura
    );

    setAlturaPersonalizada(
      formato.altura
    );
  }

  const largura =
    Number(larguraPersonalizada) ||
    formatoSelecionado?.largura ||
    1200;

  const altura =
    Number(alturaPersonalizada) ||
    formatoSelecionado?.altura ||
    1200;

  const proporcao =
    largura && altura
      ? (largura / altura).toFixed(2)
      : "1.00";

  return (
    <section
      style={{
        marginTop: "30px",
        padding: "28px",
        borderRadius: "20px",
        background: "#0f172a",
        border: "1px solid #334155",
      }}
    >
      <h2
        style={{
          marginTop: 0,
          color: "#67e8f9",
          textAlign: "center",
        }}
      >
        🎨 Novo Banner
      </h2>

      <p
        style={{
          color: "#94a3b8",
          textAlign: "center",
          marginBottom: "28px",
        }}
      >
        Escolha onde o banner será
        utilizado antes de começar.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "14px",
        }}
      >
        {formatosBanner.map(
          (formato) => {
            const selecionado =
              formatoSelecionado?.nome ===
              formato.nome;

            return (
              <button
                key={formato.nome}
                type="button"
                onClick={() =>
                  selecionarFormato(
                    formato
                  )
                }
                style={{
                  minHeight: "135px",
                  padding: "16px",
                  borderRadius: "16px",
                  border: selecionado
                    ? "2px solid #67e8f9"
                    : "1px solid #334155",
                  background: selecionado
                    ? "linear-gradient(135deg,#2563eb,#0891b2)"
                    : "#020617",
                  color: "#ffffff",
                  cursor: "pointer",
                  transition:
                    "all .2s ease",
                }}
              >
                <div
                  style={{
                    fontSize: "34px",
                    marginBottom: "10px",
                  }}
                >
                  {formato.icone}
                </div>

                <div
                  style={{
                    fontWeight: "bold",
                    fontSize: "16px",
                  }}
                >
                  {formato.nome}
                </div>

                <div
                  style={{
                    color: selecionado
                      ? "#e0f2fe"
                      : "#94a3b8",
                    marginTop: "8px",
                    fontSize: "14px",
                  }}
                >
                  {formato.largura} ×{" "}
                  {formato.altura} px
                </div>
              </button>
            );
          }
        )}
      </div>

      <div
        style={{
          marginTop: "26px",
          display: "grid",
          gridTemplateColumns:
            "repeat(2, minmax(160px, 1fr))",
          gap: "16px",
          maxWidth: "520px",
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        <label
          style={{
            color: "#cbd5e1",
            fontWeight: "bold",
          }}
        >
          Largura

          <input
            type="number"
            min="100"
            max="5000"
            value={larguraPersonalizada}
            onChange={(evento) =>
              setLarguraPersonalizada(
                Number(
                  evento.target.value
                )
              )
            }
            style={{
              width: "100%",
              boxSizing: "border-box",
              marginTop: "8px",
              padding: "12px",
              borderRadius: "10px",
              border:
                "1px solid #475569",
              background: "#020617",
              color: "#ffffff",
            }}
          />
        </label>

        <label
          style={{
            color: "#cbd5e1",
            fontWeight: "bold",
          }}
        >
          Altura

          <input
            type="number"
            min="100"
            max="5000"
            value={alturaPersonalizada}
            onChange={(evento) =>
              setAlturaPersonalizada(
                Number(
                  evento.target.value
                )
              )
            }
            style={{
              width: "100%",
              boxSizing: "border-box",
              marginTop: "8px",
              padding: "12px",
              borderRadius: "10px",
              border:
                "1px solid #475569",
              background: "#020617",
              color: "#ffffff",
            }}
          />
        </label>
      </div>

      <div
        style={{
          maxWidth: "520px",
          margin: "20px auto 0",
          padding: "16px",
          borderRadius: "14px",
          background: "#020617",
          border: "1px solid #334155",
          color: "#cbd5e1",
          textAlign: "center",
        }}
      >
        <strong
          style={{
            color: "#67e8f9",
          }}
        >
          {formatoSelecionado?.nome ||
            "Formato personalizado"}
        </strong>

        <div
          style={{
            marginTop: "8px",
          }}
        >
          📐 {largura} × {altura} px
        </div>

        <div
          style={{
            marginTop: "5px",
            color: "#94a3b8",
          }}
        >
          Proporção: {proporcao}:1
        </div>
      </div>

      <div
        style={{
          marginTop: "24px",
          textAlign: "center",
        }}
      >
        <button
          type="button"
          onClick={() =>
            iniciarProjeto({
              nome:
                formatoSelecionado?.nome ||
                "Personalizado",
              largura,
              altura,
            })
          }
          style={{
            padding: "14px 30px",
            borderRadius: "12px",
            border: "none",
            background:
              "linear-gradient(135deg,#2563eb,#22d3ee)",
            color: "#ffffff",
            fontWeight: "bold",
            fontSize: "16px",
            cursor: "pointer",
          }}
        >
          🚀 Criar Banner
        </button>
      </div>
    </section>
  );
}