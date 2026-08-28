export default function DiretorIA({
  decisao,
}) {
  if (!decisao) {
    return null;
  }

  const cores = {
    APROVADO: "#16a34a",
    REVISAR: "#f59e0b",
    ALERTA: "#dc2626",
    AGUARDANDO: "#2563eb",
  };

  return (
    <section
      style={{
        marginBottom: "20px",
        padding: "18px",
        borderRadius: "16px",
        background: "#020617",
        border: `2px solid ${
          cores[
            decisao.status
          ] || "#2563eb"
        }`,
      }}
    >
      <h2
        style={{
          margin: 0,
          color: "#fff",
        }}
      >
        {decisao.emoji} Diretor IA
      </h2>

      <h3
        style={{
          color:
            cores[
              decisao.status
            ] || "#fff",
        }}
      >
        {decisao.titulo}
      </h3>

      <p
        style={{
          color: "#cbd5e1",
          lineHeight: 1.6,
        }}
      >
        {decisao.texto}
      </p>

      {decisao.resumo && (
        <div
          style={{
            marginTop: "15px",
            display: "flex",
            gap: "15px",
            flexWrap: "wrap",
          }}
        >
          <span>
            ✅ {decisao.resumo.aprovados}
          </span>

          <span>
            ⚠️ {decisao.resumo.revisar}
          </span>

          <span>
            ⛔ {decisao.resumo.alertas}
          </span>

          <span>
            ⏳ {decisao.resumo.aguardando}
          </span>
        </div>
      )}
    </section>
  );
}