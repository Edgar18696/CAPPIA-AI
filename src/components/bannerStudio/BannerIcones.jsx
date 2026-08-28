const ICONES_AUTOMOTIVOS = [
  { id: "motor", nome: "Motor", simbolo: "🚗", categoria: "Motor", cor: "#2563eb" },
  { id: "engrenagem", nome: "Engrenagem", simbolo: "⚙️", categoria: "Motor", cor: "#64748b" },
  { id: "oleo", nome: "Óleo", simbolo: "🛢️", categoria: "Lubrificação", cor: "#f59e0b" },
  { id: "temperatura", nome: "Temperatura", simbolo: "🌡️", categoria: "Arrefecimento", cor: "#ef4444" },
  { id: "turbo", nome: "Turbo", simbolo: "💨", categoria: "Performance", cor: "#06b6d4" },
  { id: "bateria", nome: "Bateria", simbolo: "🔋", categoria: "Elétrica", cor: "#22c55e" },
  { id: "farol", nome: "Farol", simbolo: "💡", categoria: "Elétrica", cor: "#eab308" },
  { id: "frete", nome: "Frete", simbolo: "🚚", categoria: "Comercial", cor: "#0ea5e9" },
  { id: "garantia", nome: "Garantia", simbolo: "🛡️", categoria: "Comercial", cor: "#14b8a6" },
  { id: "original", nome: "Original", simbolo: "⭐", categoria: "Comercial", cor: "#f59e0b" },
  { id: "performance", nome: "Performance", simbolo: "🏁", categoria: "Performance", cor: "#7c3aed" },
  { id: "ferramentas", nome: "Ferramentas", simbolo: "🔧", categoria: "Oficina", cor: "#475569" },
  { id: "autopecas", nome: "Autopeças", simbolo: "🚘", categoria: "Geral", cor: "#2563eb" },
];

function criarIconeSvg({
  simbolo,
  cor,
  borda = "#ffffff",
  opacidade = 1,
  sombra = true,
}) {
  const alpha = Math.max(0.1, Math.min(1, Number(opacidade) || 1));

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 420 420">
      <defs>
        <filter id="sombra">
          <feDropShadow dx="0" dy="16" stdDeviation="12" flood-color="#000000" flood-opacity=".34"/>
        </filter>
      </defs>

      <circle
        cx="210"
        cy="210"
        r="168"
        fill="${cor}"
        stroke="${borda}"
        stroke-width="14"
        opacity="${alpha}"
        ${sombra ? 'filter="url(#sombra)"' : ""}
      />

      <text
        x="210"
        y="250"
        text-anchor="middle"
        font-size="152"
        font-family="Arial, Helvetica, sans-serif"
      >
        ${simbolo}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export default function BannerIcones({
  onAdicionarIcone,
}) {
  function adicionarIcone(modelo) {
    const novoIcone = {
      id: `${Date.now()}-${Math.random()}`,
      src: criarIconeSvg({
        simbolo: modelo.simbolo,
        cor: modelo.cor,
      }),
      nome: modelo.nome,
      categoria: modelo.categoria,
      simbolo: modelo.simbolo,
      tipo: "icone",
      x: 490,
      y: 320,
      escala: 0.55,
      rotacao: 0,
      corIcone: modelo.cor,
      bordaIcone: "#ffffff",
      opacidadeIcone: 1,
      sombraIcone: true,
      efeitoRapido: "nenhum",
    };

    if (typeof onAdicionarIcone === "function") {
      onAdicionarIcone(novoIcone);
    }
  }

  return (
    <div>
      <h3
        style={{
          color: "#67e8f9",
          marginTop: 0,
        }}
      >
        🎨 Biblioteca de Ícones
      </h3>

      <p
        style={{
          color: "#94a3b8",
          fontSize: "12px",
          lineHeight: 1.5,
        }}
      >
        Clique em um ícone para adicionar ao banner.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "9px",
        }}
      >
        {ICONES_AUTOMOTIVOS.map((icone) => (
          <button
            key={icone.id}
            type="button"
            onClick={() => adicionarIcone(icone)}
            style={{
              minHeight: "108px",
              padding: "10px",
              borderRadius: "12px",
              border: "1px solid #334155",
              background: "#020617",
              color: "#ffffff",
              cursor: "pointer",
              boxShadow: "0 8px 18px rgba(0,0,0,.22)",
            }}
          >
            <img
              src={criarIconeSvg({
                simbolo: icone.simbolo,
                cor: icone.cor,
              })}
              alt={icone.nome}
              style={{
                display: "block",
                width: "100%",
                height: "66px",
                objectFit: "contain",
                pointerEvents: "none",
              }}
            />

            <strong
              style={{
                display: "block",
                marginTop: "6px",
                fontSize: "11px",
              }}
            >
              {icone.nome}
            </strong>

            <small
              style={{
                display: "block",
                marginTop: "3px",
                color: "#64748b",
                fontSize: "8px",
                fontWeight: "bold",
              }}
            >
              {icone.categoria}
            </small>
          </button>
        ))}
      </div>

      <div
        style={{
          marginTop: "13px",
          padding: "10px",
          borderRadius: "10px",
          border: "1px solid #334155",
          background: "#0f172a",
          color: "#94a3b8",
          fontSize: "10px",
          lineHeight: 1.5,
        }}
      >
        Os ícones entram como elementos editáveis e podem ser movidos,
        redimensionados, rotacionados, duplicados e organizados pelas camadas.
      </div>
    </div>
  );
}

export {
  ICONES_AUTOMOTIVOS,
  criarIconeSvg,
};