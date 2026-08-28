const botaoBase = {
  width: "100%",
  minHeight: "74px",
  padding: "10px 6px",
  marginBottom: "10px",
  borderRadius: "12px",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "30px",
};

const FERRAMENTAS_CRIACAO = [
  ["fundos", "🎨", "Fundos"],
  ["produto", "📦", "Produto"],
  ["texto", "📝", "Texto"],
  ["selos", "⭐", "Selos"],
  ["logos", "🖼️", "Logos"],
  ["templates", "🧩", "Templates"],
];

const FERRAMENTAS_PROJETO = [
  ["camadas", "📚", "Camadas"],
  ["finalizar", "✅", "Finalizar"],
];

function TituloGrupo({ children }) {
  return (
    <div
      style={{
        color: "#94a3b8",
        fontSize: "10px",
        fontWeight: "bold",
        textTransform: "uppercase",
        letterSpacing: "0.8px",
        marginBottom: "8px",
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
}

export default function BannerFerramentas({
  ferramentaStudio,
  setFerramentaStudio,
}) {
  function renderizarBotao([chave, icone, nome]) {
    const ativo = ferramentaStudio === chave;

    return (
      <button
        key={chave}
        type="button"
        title={nome}
        aria-label={nome}
        onClick={() => setFerramentaStudio(chave)}
        style={{
          ...botaoBase,
          background: ativo
            ? "linear-gradient(135deg,#2563eb,#22d3ee)"
            : "#1e293b",
          border: ativo
            ? "1px solid #67e8f9"
            : "1px solid #334155",
        }}
      >
        <span
          style={{
            display: "block",
            lineHeight: 1,
          }}
        >
          {icone}
        </span>

        <span
          style={{
            display: "block",
            marginTop: "8px",
            fontSize: "12px",
            lineHeight: 1.1,
          }}
        >
          {nome}
        </span>
      </button>
    );
  }

  return (
    <aside
      style={{
        background: "#0f172a",
        borderRadius: "16px",
        padding: "12px 10px",
        border: "1px solid #334155",
        position: "sticky",
        top: "12px",
        boxShadow: "0 18px 45px rgba(0,0,0,0.28)",
      }}
    >
      <h3
        style={{
          color: "#67e8f9",
          textAlign: "center",
          marginTop: 0,
          marginBottom: "18px",
        }}
      >
        🧰
      </h3>

      <TituloGrupo>Criação</TituloGrupo>
      {FERRAMENTAS_CRIACAO.map(renderizarBotao)}

      <div
        style={{
          height: "1px",
          background: "#334155",
          margin: "12px 0",
        }}
      />

      <TituloGrupo>Projeto</TituloGrupo>
      {FERRAMENTAS_PROJETO.map(renderizarBotao)}
    </aside>
  );
}