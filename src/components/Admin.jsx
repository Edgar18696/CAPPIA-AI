export default function Admin({ totalFotos, cardStyle }) {
  return (
    <div style={{ marginTop: "50px" }}>
      <h2>Painel Administrativo</h2>

      <div style={cardStyle}>
        <h3>Processamentos do usuário</h3>
        <h1>{totalFotos}</h1>
      </div>
    </div>
  );
}