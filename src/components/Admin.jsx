export default function Admin({
  totalFotos,
  cardStyle,
  setScreen,
}) {
  const botao = {
    padding: "18px",
    borderRadius: "12px",
    background: "#0f172a",
    color: "#67e8f9",
    border: "1px solid #1e40af",
    fontSize: "17px",
    fontWeight: "bold",
    cursor: "pointer",
  };

  const botaoMarketing = {
    ...botao,
    background:
      "linear-gradient(135deg,#1d4ed8,#0891b2)",
    color: "#ffffff",
    border: "1px solid #67e8f9",
    boxShadow:
      "0 10px 30px rgba(14,165,233,.18)",
  };

  return (
    <div style={cardStyle}>
      <h2
        style={{
          color: "#67e8f9",
          marginBottom: "10px",
        }}
      >
        ⚙ Administração PAIIA AI
      </h2>

      <p style={{ color: "#cbd5e1" }}>
        Área exclusiva para gerenciamento do sistema.
      </p>

      <div
        style={{
          marginTop: "25px",
          marginBottom: "30px",
          padding: "20px",
          borderRadius: "12px",
          background: "#111827",
        }}
      >
        <h3 style={{ color: "#67e8f9" }}>
          📸 Total de Fotos Processadas
        </h3>

        <h1 style={{ color: "#ffffff" }}>
          {totalFotos}
        </h1>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(220px,1fr))",
          gap: "18px",
        }}
      >
        <button
          style={botao}
          onClick={() =>
            setScreen("importadorCatalogos")
          }
        >
          📥 Importar Catálogos
        </button>

        <button
          style={botao}
          onClick={() =>
            setScreen("fabricantes")
          }
        >
          🏭 Fabricantes
        </button>

        <button
          style={botao}
          onClick={() =>
            setScreen("equivalencias")
          }
        >
          🔄 Equivalências
        </button>

        <button
          style={botao}
          onClick={() =>
            setScreen("dashboardAppia")
          }
        >
          📊 Dashboard PAIIA
        </button>

        <button
          style={botao}
          onClick={() =>
            setScreen("usuarios")
          }
        >
          👥 Usuários
        </button>

        <button
          style={botao}
          onClick={() =>
            setScreen("pagamentos")
          }
        >
          💳 Pagamentos
        </button>

        <button
          style={botao}
          onClick={() =>
            setScreen("planosAcessos")
          }
        >
          🔐 Planos e Acessos
        </button>

        <button
          style={botaoMarketing}
          onClick={() =>
            setScreen("marketingAppia")
          }
        >
          📢 Marketing PAIIA
        </button>
      </div>
    </div>
  );
}