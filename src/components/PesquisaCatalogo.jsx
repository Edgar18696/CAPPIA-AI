export default function PesquisaCatalogo({
  codigo,
  oem,
  buscarNoCatalogo,
}) {
  return (
    <div
      style={{
        marginTop: "20px",
        padding: "18px",
        borderRadius: "16px",
        background: "#020617",
        border: "1px solid #1e293b",
      }}
    >
      <h3 style={{ color: "#67e8f9", marginBottom: "8px" }}>
        🔎 Pesquisa no Catálogo
      </h3>

      <p style={{ color: "#94a3b8", marginBottom: "14px" }}>
        Busque a peça pelo código informado ou OEM para preencher o anúncio.
      </p>

      <button
        onClick={buscarNoCatalogo}
        disabled={!codigo && !oem}
        style={{
          padding: "12px 18px",
          borderRadius: "10px",
          border: "none",
          background: !codigo && !oem ? "#334155" : "#2563eb",
          color: "#fff",
          fontWeight: "bold",
          cursor: !codigo && !oem ? "not-allowed" : "pointer",
        }}
      >
        🔎 Buscar no Catálogo
      </button>
    </div>
  );
}