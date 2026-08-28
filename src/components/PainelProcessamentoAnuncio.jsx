export default function PainelProcessamentoAnuncio({
  processando,
  etapa,
  progresso,
}) {
  if (!processando) return null;

  return (
    <div
      style={{
        marginTop: 25,
        marginBottom: 25,
        padding: 25,
        borderRadius: 16,
        background: "#020617",
        border: "1px solid #2563eb",
        textAlign: "center",
      }}
    >
      <h2
        style={{
          color: "#67e8f9",
          marginTop: 0,
        }}
      >
        🤖 APPIA AI
      </h2>

      <div
        style={{
          width: "100%",
          height: 16,
          background: "#1e293b",
          borderRadius: 999,
          overflow: "hidden",
          marginTop: 20,
        }}
      >
        <div
          style={{
            width: `${progresso}%`,
            height: "100%",
            background:
              "linear-gradient(90deg,#2563eb,#22d3ee)",
            transition: ".35s",
          }}
        />
      </div>

      <h1
        style={{
          color: "#fff",
          marginTop: 20,
        }}
      >
        {progresso}%
      </h1>

      <p
        style={{
          color: "#cbd5e1",
          fontSize: 18,
          marginBottom: 0,
        }}
      >
        {etapa}
      </p>
    </div>
  );
}