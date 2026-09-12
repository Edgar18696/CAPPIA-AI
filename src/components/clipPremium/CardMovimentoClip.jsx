import PreviewMovimentoClip from "./PreviewMovimentoClip";

export default function CardMovimentoClip({
  movimento,
  selecionado,
  recomendado,
  onSelect,
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        padding: "10px",
        borderRadius: "14px",
        border: selecionado ? "2px solid #22d3ee" : "1px solid #334155",
        background: selecionado ? "#083344" : "#020617",
        color: "#e2e8f0",
        cursor: "pointer",
        textAlign: "left",
        boxShadow: selecionado
          ? "0 0 0 1px rgba(34,211,238,.45)"
          : "none",
      }}
    >
      <PreviewMovimentoClip
        movimentoId={movimento.id}
        nome={movimento.nome}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "8px",
          marginTop: "8px",
          alignItems: "baseline",
        }}
      >
        <strong style={{ fontSize: "13px" }}>{movimento.nome}</strong>
        {selecionado ? (
          <span style={{ color: "#67e8f9", fontSize: "11px" }}>Selecionado</span>
        ) : null}
      </div>
      {recomendado ? (
        <div style={{ color: "#fde68a", fontSize: "11px", marginTop: "3px" }}>
          ⭐ Recomendado pelo Paizinho
        </div>
      ) : null}
      <p
        style={{
          margin: "6px 0 0",
          color: "#94a3b8",
          fontSize: "12px",
          lineHeight: 1.4,
        }}
      >
        {movimento.descricao}
      </p>
      {movimento.aviso ? (
        <p
          style={{
            margin: "8px 0 0",
            color: "#cbd5e1",
            fontSize: "11px",
            lineHeight: 1.45,
          }}
        >
          {movimento.aviso}
        </p>
      ) : null}
    </button>
  );
}
