const FUNDOS_PREMIUM_PADRAO = [
  {
    nome: "Branco Clean",
    valor: "#ffffff",
  },
  {
    nome: "Azul Marinho",
    valor: "#020617",
  },
  {
    nome: "Azul Premium",
    valor:
      "linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)",
  },
  {
    nome: "Vermelho Racing",
    valor:
      "linear-gradient(135deg, #7f1d1d 0%, #ef4444 100%)",
  },
  {
    nome: "Amarelo Premium",
    valor:
      "linear-gradient(135deg, #f59e0b 0%, #fde047 100%)",
  },
  {
    nome: "Prata Premium",
    valor:
      "linear-gradient(135deg, #334155 0%, #94a3b8 100%)",
  },
  {
    nome: "Azul Elétrico",
    valor:
      "linear-gradient(135deg, #172554 0%, #2563eb 100%)",
  },
  {
    nome: "Metal Escovado",
    valor:
      "repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0 1px, rgba(15,23,42,0.05) 1px 3px), linear-gradient(135deg, #334155 0%, #cbd5e1 50%, #475569 100%)",
  },
  {
    nome: "Vermelho Premium",
    valor:
      "linear-gradient(135deg, #450a0a 0%, #dc2626 100%)",
  },
  {
    nome: "Dourado Premium",
    valor:
      "linear-gradient(135deg, #a16207 0%, #facc15 100%)",
  },
  {
    nome: "Ciano Tecnológico",
    valor:
      "linear-gradient(135deg, #075985 0%, #22d3ee 100%)",
  },
  {
    nome: "Grafite",
    valor:
      "linear-gradient(135deg, #0f172a 0%, #334155 100%)",
  },
  {
    nome: "Fibra de Carbono",
    valor:
      "repeating-linear-gradient(45deg, rgba(255,255,255,0.055) 0 4px, transparent 4px 10px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.035) 0 4px, transparent 4px 10px), linear-gradient(135deg, #050505 0%, #171717 50%, #020202 100%)",
  },
  {
    nome: "Carbono Azul",
    valor:
      "repeating-linear-gradient(45deg, rgba(96,165,250,0.12) 0 4px, transparent 4px 10px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.035) 0 4px, transparent 4px 10px), linear-gradient(135deg, #020617 0%, #172554 55%, #0f172a 100%)",
  },
];

export default function BannerPainel({
  ferramentaStudio,
  fundosStudio = [],
  fundoStudio,
  setFundoStudio,
  escalaProduto,
  setEscalaProduto,
  tituloStudio,
  setTituloStudio,
  corTituloStudio,
  setCorTituloStudio,
  tamanhoTituloStudio,
  setTamanhoTituloStudio,
  textosStudio,
  setTextosStudio,
  elementoSelecionado,
}) {
  const fundosRecebidos = Array.isArray(
    fundosStudio
  )
    ? fundosStudio
    : [];

  const fundosDisponiveis = [
    ...fundosRecebidos,
    ...FUNDOS_PREMIUM_PADRAO.filter(
      (fundoPadrao) =>
        !fundosRecebidos.some(
          (fundoRecebido) =>
            fundoRecebido?.nome ===
              fundoPadrao.nome ||
            fundoRecebido?.valor ===
              fundoPadrao.valor
        )
    ),
  ];

  function atualizarTextoSelecionado(
    alteracoes
  ) {
    if (
      elementoSelecionado === null ||
      elementoSelecionado === "produto"
    ) {
      return;
    }

    setTextosStudio((anteriores) =>
      anteriores.map((texto) =>
        texto.id === elementoSelecionado
          ? {
              ...texto,
              ...alteracoes,
            }
          : texto
      )
    );
  }

  return (
    <section
      style={{
        width: "280px",
        background: "#0f172a",
        borderRadius: "16px",
        padding: "18px",
        border: "1px solid #334155",
        boxSizing: "border-box",
        minHeight: "320px",
      }}
    >
      {ferramentaStudio === "fundos" && (
        <div>
          <h3
            style={{
              color: "#67e8f9",
              marginTop: 0,
            }}
          >
            🎨 Biblioteca de Fundos
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(3, 1fr)",
              gap: "10px",
            }}
          >
            {fundosDisponiveis.map(
              (fundo, index) => {
                const selecionado =
                  fundoStudio === fundo.valor;

                return (
                  <button
                    key={`${fundo.nome}-${index}`}
                    type="button"
                    title={fundo.nome}
                    onClick={() =>
                      setFundoStudio(
                        fundo.valor
                      )
                    }
                    style={{
                      padding: "4px",
                      borderRadius: "10px",
                      background: "#020617",
                      border: selecionado
                        ? "3px solid #22d3ee"
                        : "2px solid #475569",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        height: "44px",
                        borderRadius: "7px",
                        background: fundo.valor,
                        backgroundSize:
                          "cover",
                        backgroundPosition:
                          "center",
                      }}
                    />

                    <span
                      style={{
                        display: "block",
                        color: "#cbd5e1",
                        fontSize: "9px",
                        fontWeight: "bold",
                        lineHeight: 1.1,
                        marginTop: "5px",
                        minHeight: "20px",
                      }}
                    >
                      {fundo.nome}
                    </span>
                  </button>
                );
              }
            )}
          </div>
        </div>
      )}

      {ferramentaStudio === "produto" && (
        <div>
          <h3
            style={{
              color: "#67e8f9",
              marginTop: 0,
            }}
          >
            📦 Produto
          </h3>

          <p
            style={{
              color: "#94a3b8",
            }}
          >
            Arraste a peça diretamente
            dentro do banner.
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "12px",
              marginTop: "20px",
            }}
          >
            <button
              type="button"
              onClick={() =>
                setEscalaProduto(
                  (valor) =>
                    Math.max(
                      0.2,
                      valor - 0.1
                    )
                )
              }
            >
              ➖
            </button>

            <strong
              style={{
                color: "#67e8f9",
              }}
            >
              🔍{" "}
              {Math.round(
                escalaProduto * 100
              )}
              %
            </strong>

            <button
              type="button"
              onClick={() =>
                setEscalaProduto(
                  (valor) =>
                    Math.min(
                      3,
                      valor + 0.1
                    )
                )
              }
            >
              ➕
            </button>
          </div>
        </div>
      )}

      {ferramentaStudio === "texto" && (
        <div>
          <h3
            style={{
              color: "#67e8f9",
              marginTop: 0,
            }}
          >
            📝 Editor de Texto
          </h3>

          <input
            type="text"
            value={tituloStudio}
            placeholder="Digite o texto"
            onChange={(evento) =>
              setTituloStudio(
                evento.target.value
              )
            }
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "11px",
              borderRadius: "10px",
              border:
                "1px solid #475569",
              background: "#020617",
              color: "#ffffff",
              marginBottom: "12px",
            }}
          />

          <label
            style={{
              color: "#67e8f9",
              display: "block",
              marginBottom: "7px",
            }}
          >
            🎨 Cor
          </label>

          <input
            type="color"
            value={corTituloStudio}
            onChange={(evento) => {
              const cor =
                evento.target.value;

              setCorTituloStudio(cor);

              atualizarTextoSelecionado({
                cor,
              });
            }}
            style={{
              width: "100%",
              height: "42px",
              border: "none",
              marginBottom: "15px",
              cursor: "pointer",
            }}
          />

          <label
            style={{
              color: "#67e8f9",
              display: "block",
              marginBottom: "7px",
            }}
          >
            🔠 Tamanho:{" "}
            {tamanhoTituloStudio}px
          </label>

          <input
            type="range"
            min="20"
            max="90"
            value={tamanhoTituloStudio}
            onChange={(evento) => {
              const tamanho = Number(
                evento.target.value
              );

              setTamanhoTituloStudio(
                tamanho
              );

              atualizarTextoSelecionado({
                tamanho,
              });
            }}
            style={{
              width: "100%",
              marginBottom: "16px",
            }}
          />

          <button
            type="button"
            disabled={
              !tituloStudio.trim()
            }
            onClick={() => {
              const novoTexto = {
                id: Date.now(),
                texto:
                  tituloStudio.trim(),
                x: 450,
                y:
                  100 +
                  textosStudio.length *
                    55,
                cor: corTituloStudio,
                tamanho:
                  tamanhoTituloStudio,
              };

              setTextosStudio([
                ...textosStudio,
                novoTexto,
              ]);

              setTituloStudio("");
            }}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "10px",
              border: "none",
              background:
                tituloStudio.trim()
                  ? "#2563eb"
                  : "#475569",
              color: "#ffffff",
              fontWeight: "bold",
              cursor:
                tituloStudio.trim()
                  ? "pointer"
                  : "not-allowed",
            }}
          >
            ➕ Novo Texto
          </button>
        </div>
      )}

      {ferramentaStudio === "selos" && (
        <h3
          style={{
            color: "#67e8f9",
            marginTop: 0,
          }}
        >
          ⭐ Biblioteca de Selos
        </h3>
      )}

      {ferramentaStudio === "logos" && (
        <h3
          style={{
            color: "#67e8f9",
            marginTop: 0,
          }}
        >
          🖼️ Logos
        </h3>
      )}

      {ferramentaStudio ===
        "exportar" && (
        <h3
          style={{
            color: "#67e8f9",
            marginTop: 0,
          }}
        >
          ⬇️ Exportar Banner
        </h3>
      )}
    </section>
  );
}