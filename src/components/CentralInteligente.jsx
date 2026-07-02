export default function CentralInteligente({ setScreen, cardStyle }) {
  const exemplos = [
    "7703074600",
    "0261230268",
    "H8200495791",
    "Sensor MAP Sandero",
    "Sonda Lambda Onix",
  ];

  return (
    <div style={{ marginTop: "50px" }}>
      <h2 style={{ color: "#67e8f9", fontSize: "34px" }}>
        🧠 Central de Pesquisa APPIA
      </h2>

      <p style={{ color: "#93c5fd", marginBottom: "30px", fontSize: "18px" }}>
        Pesquise códigos, aplicações, equivalências e catálogos para criar anúncios melhores.
      </p>

      <div style={{ ...cardStyle, maxWidth: "850px", margin: "0 auto 30px" }}>
        <h3 style={{ color: "#67e8f9" }}>🔎 Pesquisar peça</h3>

        <input
          placeholder="Digite código OEM, Bosch, Magneti, aplicação ou nome da peça..."
          style={{
            width: "90%",
            padding: "16px",
            borderRadius: "12px",
            border: "1px solid #2563eb",
            fontSize: "16px",
            marginTop: "10px",
            marginBottom: "15px",
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <button style={cardStyle}>🔍 Código</button>
          <button style={cardStyle}>🚗 Aplicação</button>
          <button style={cardStyle}>🏭 Fabricante</button>
          <button style={cardStyle}>🔄 Equivalência</button>
        </div>
      </div>

      <h3 style={{ color: "#38bdf8" }}>📚 Bases e Catálogos</h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
          gap: "18px",
          marginTop: "20px",
        }}
      >
        <button style={cardStyle} onClick={() => setScreen("catalogo")}>
          🚗 Renault
        </button>

        <button style={cardStyle} onClick={() => setScreen("catalogo")}>
          🚙 Fiat
        </button>

        <button style={cardStyle} onClick={() => setScreen("catalogo")}>
          🔵 Bosch
        </button>

        <button style={cardStyle} onClick={() => setScreen("catalogo")}>
          🔴 Magneti Marelli
        </button>

        <button style={cardStyle} onClick={() => setScreen("catalogo")}>
          ⚫ Delphi
        </button>

        <button style={cardStyle} onClick={() => setScreen("equivalencias")}>
          🔄 Equivalências
        </button>

        <button style={cardStyle} onClick={() => setScreen("fabricantes")}>
          🏭 Fabricantes
        </button>

        <button style={cardStyle} onClick={() => setScreen("atendimento")}>
          🤖 IA Especialista
        </button>
      </div>

      <h3 style={{ color: "#38bdf8", marginTop: "35px" }}>
        ⭐ Pesquisas rápidas
      </h3>

      <div
        style={{
          display: "flex",
          gap: "12px",
          justifyContent: "center",
          flexWrap: "wrap",
          marginTop: "15px",
        }}
      >
        {exemplos.map((item) => (
          <button
            key={item}
            style={{
              background: "#0f172a",
              color: "#e2e8f0",
              border: "1px solid #2563eb",
              borderRadius: "999px",
              padding: "10px 16px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}