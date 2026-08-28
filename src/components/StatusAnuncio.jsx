export default function StatusAnuncio({
  codigo,
  titulo,
  descricao,
  fotosAnuncio,
  diagnostico,
  auditoria,
}) {
  const itens = [
    {
      nome: "Código",
      ok: !!codigo,
    },
    {
      nome: "Título",
      ok: titulo?.length > 20,
    },
    {
      nome: "Descrição",
      ok: descricao?.length > 150,
    },
    {
      nome: "Fotos",
      ok: fotosAnuncio?.length > 0,
    },
    {
      nome: "Diagnóstico",
      ok: !!diagnostico,
    },
    {
      nome: "Auditoria",
      ok: !!auditoria,
    },
  ];

  const pontos = itens.filter((i) => i.ok).length;
  const porcentagem = Math.round((pontos / itens.length) * 100);

  return (
    <div
      style={{
        background: "#020617",
        border: "1px solid #2563eb",
        borderRadius: "18px",
        padding: "20px",
        marginBottom: "25px",
      }}
    >
      <h2
        style={{
          color: "#67e8f9",
          marginTop: 0,
        }}
      >
        📊 Status do Anúncio
      </h2>

      <div
        style={{
          height: "14px",
          background: "#1e293b",
          borderRadius: "20px",
          overflow: "hidden",
          marginBottom: "18px",
        }}
      >
        <div
          style={{
            width: `${porcentagem}%`,
            height: "100%",
            background:
              porcentagem >= 90
                ? "#22c55e"
                : porcentagem >= 70
                ? "#f59e0b"
                : "#ef4444",
            transition: "0.4s",
          }}
        />
      </div>

      <h1
        style={{
          color: "#fff",
          margin: "0 0 20px 0",
        }}
      >
        {porcentagem}%
      </h1>

      {itens.map((item) => (
        <div
          key={item.nome}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "8px 0",
            borderBottom: "1px solid #1e293b",
          }}
        >
          <span style={{ color: "#cbd5e1" }}>
            {item.nome}
          </span>

          <span>
            {item.ok ? "✅" : "❌"}
          </span>
        </div>
      ))}

      {porcentagem === 100 && (
        <div
          style={{
            marginTop: "18px",
            background: "#14532d",
            padding: "14px",
            borderRadius: "12px",
            textAlign: "center",
            color: "#dcfce7",
            fontWeight: "bold",
          }}
        >
          🚀 ANÚNCIO PRONTO PARA PUBLICAÇÃO
        </div>
      )}
    </div>
  );
}