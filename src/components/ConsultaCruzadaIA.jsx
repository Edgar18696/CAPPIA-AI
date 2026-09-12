export default function ConsultaCruzadaIA({
  analise,
}) {
  if (!analise) {
    return null;
  }

  const {
    catalogos,
    fabricantes,
    montadoras,
    totalResultados,
  } = analise;

  return (
    <div style={container}>
      <h2 style={titulo}>
        🌎 Consulta Cruzada PAIIA AI
      </h2>

      <p style={subtitulo}>
        Comparação consolidada entre os
        catálogos encontrados.
      </p>

      <div style={grid}>
        <Card
          titulo="Catálogos"
          valor={catalogos.length}
          detalhe={catalogos.join(", ")}
        />

        <Card
          titulo="Fabricantes"
          valor={fabricantes.length}
          detalhe={fabricantes.join(", ")}
        />

        <Card
          titulo="Montadoras"
          valor={montadoras.length}
          detalhe={montadoras.join(", ")}
        />

        <Card
          titulo="Registros"
          valor={totalResultados}
          detalhe="Total de registros encontrados"
        />
      </div>
    </div>
  );
}

function Card({
  titulo,
  valor,
  detalhe,
}) {
  return (
    <div style={card}>
      <div style={numero}>
        {valor}
      </div>

      <h3 style={tituloCard}>
        {titulo}
      </h3>

      <div style={detalheStyle}>
        {detalhe || "-"}
      </div>
    </div>
  );
}

const container = {
  background: "#020617",
  border: "1px solid #2563eb",
  borderRadius: "18px",
  padding: "22px",
};

const titulo = {
  color: "#67e8f9",
  marginTop: 0,
};

const subtitulo = {
  color: "#94a3b8",
  marginBottom: "20px",
};

const grid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",
  gap: "16px",
};

const card = {
  background: "#0f172a",
  borderRadius: "14px",
  padding: "18px",
};

const numero = {
  color: "#67e8f9",
  fontSize: "30px",
  fontWeight: "bold",
};

const tituloCard = {
  color: "#ffffff",
  margin: "10px 0",
};

const detalheStyle = {
  color: "#cbd5e1",
  lineHeight: "1.5",
};