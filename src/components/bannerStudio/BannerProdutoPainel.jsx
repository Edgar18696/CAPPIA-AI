import { memo } from "react";

const EFEITOS_RAPIDOS = [
  ["nenhum", "Normal"],
  ["produtoPro", "Produto Pro"],
  ["sombra", "Sombra Premium"],
  ["glowAzul", "Glow Azul"],
  ["glowBranco", "Glow Branco"],
  ["contornoBranco", "Contorno Branco"],
  ["contornoPreto", "Contorno Preto"],
  ["reflexo", "Reflexo"],
  ["vidro", "Vidro"],
  ["metal", "Metal"],
  ["neon", "Neon"],
];

function BannerProdutoPainel({
  ativo,
  imagensBanner = [],
  setImagensBanner,
  imagemSelecionadaId,
  setImagemSelecionadaId,
  imagemBanner,
  setCamadasStudio,
  setElementoSelecionado,
  setImagemArrastandoId,
  setArrastando,
  melhorarProdutoSelecionado,
  aplicarEfeitoRapidoImagem,
  setScreen,
}) {
  if (!ativo) {
    return null;
  }

  const imagemSelecionada =
    imagensBanner.find(
      (imagem) =>
        imagem.id ===
        imagemSelecionadaId
    );

  const escalaAtual =
    Number(
      imagemSelecionada?.escala
    ) || 1;

  const tipoSelecionado =
    imagemSelecionada?.tipo ||
    "produto";

  const nomeTipoSelecionado =
    tipoSelecionado === "objeto"
      ? "Objeto"
      : tipoSelecionado === "icone"
        ? "Ícone"
        : tipoSelecionado === "logo"
          ? "Logo"
          : "Produto";

  const iconeTipoSelecionado =
    tipoSelecionado === "objeto"
      ? "🧩"
      : tipoSelecionado === "icone"
        ? "🎨"
        : tipoSelecionado === "logo"
          ? "🖼️"
          : "📦";

  function atualizarEscala(
    escala
  ) {
    if (!imagemSelecionada) {
      return;
    }

    setImagensBanner?.(
      (anteriores) =>
        anteriores.map(
          (imagem) =>
            imagem.id ===
            imagemSelecionada.id
              ? {
                  ...imagem,
                  escala,
                }
              : imagem
        )
    );
  }

  function escolherOutraFoto() {
    localStorage.setItem(
      "modoGaleria",
      "selecionarParaBanner"
    );

    localStorage.setItem(
      "abrirBannerAutomatico",
      "true"
    );

    setScreen?.("galeria");
  }

  function editarNaFotoIA() {
    if (!imagemBanner) {
      return;
    }

    localStorage.setItem(
      "imagemFotoIASelecionada",
      imagemBanner
    );

    localStorage.setItem(
      "voltarParaBanner",
      "true"
    );

    setScreen?.("fotoIA");
  }

  function removerElementoSelecionado() {
    if (!imagemSelecionadaId) {
      return;
    }

    setImagensBanner?.(
      (anteriores) =>
        anteriores.filter(
          (imagem) =>
            imagem.id !==
            imagemSelecionadaId
        )
    );

    setCamadasStudio?.(
      (anteriores) =>
        anteriores.filter(
          (camada) =>
            camada.id !==
            imagemSelecionadaId
        )
    );

    setElementoSelecionado?.(
      null
    );

    setImagemSelecionadaId?.(
      null
    );

    setImagemArrastandoId?.(
      null
    );

    setArrastando?.(false);
  }

  return (
    <div data-nao-exportar="true">
      <h3
        style={{
          color: "#67e8f9",
          marginTop: 0,
        }}
      >
        {iconeTipoSelecionado}{" "}
        {nomeTipoSelecionado}
      </h3>

      <p
        style={{
          color: "#94a3b8",
        }}
      >
        Arraste o elemento diretamente dentro do banner.
      </p>

      {!imagemSelecionada ? (
        <div
          style={{
            marginTop: "18px",
            padding: "12px",
            borderRadius:
              "10px",
            border:
              "1px dashed #334155",
            background:
              "#020617",
            color: "#94a3b8",
            fontSize: "13px",
            lineHeight: 1.5,
          }}
        >
          Selecione uma foto no banner para ajustar o tamanho.
        </div>
      ) : (
        <div
          style={{
            marginTop: "16px",
            padding: "14px",
            borderRadius:
              "12px",
            border:
              "1px solid #334155",
            background:
              "#020617",
          }}
        >
          <label
            style={{
              display: "block",
              color: "#67e8f9",
              fontWeight:
                "bold",
              marginBottom:
                "10px",
            }}
          >
            Tamanho:{" "}
            {Math.round(
              escalaAtual *
                100
            )}
            %
          </label>

          <input
            type="range"
            min="25"
            max="250"
            value={Math.round(
              escalaAtual *
                100
            )}
            onChange={(evento) =>
              atualizarEscala(
                Number(
                  evento.target
                    .value
                ) / 100
              )
            }
            style={{
              width: "100%",
            }}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1fr 1fr 1fr",
              gap: "8px",
              marginTop:
                "12px",
            }}
          >
            <button
              type="button"
              onClick={() =>
                atualizarEscala(
                  Math.max(
                    0.25,
                    escalaAtual -
                      0.1
                  )
                )
              }
            >
              ➖
            </button>

            <button
              type="button"
              onClick={() =>
                atualizarEscala(
                  1
                )
              }
            >
              100%
            </button>

            <button
              type="button"
              onClick={() =>
                atualizarEscala(
                  Math.min(
                    2.5,
                    escalaAtual +
                      0.1
                  )
                )
              }
            >
              ➕
            </button>
          </div>

          <p
            style={{
              color: "#94a3b8",
              fontSize:
                "12px",
              lineHeight: 1.5,
              marginBottom: 0,
            }}
          >
            Arraste a foto para mover. Use a bolinha azul ou o controle acima para redimensionar.
          </p>
        </div>
      )}

      <div
        style={{
          height: "1px",
          background:
            "#334155",
          margin:
            "20px 0",
        }}
      />

      <h3
        style={{
          color: "#67e8f9",
          marginTop: 0,
        }}
      >
        {iconeTipoSelecionado}{" "}
        Ações do {nomeTipoSelecionado}
      </h3>

      <button
        type="button"
        onClick={
          escolherOutraFoto
        }
        style={{
          width: "100%",
          marginTop: "20px",
          padding: "12px",
          borderRadius:
            "10px",
          border:
            "1px solid #22d3ee",
          background:
            "#020617",
          color: "#67e8f9",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        📂 Escolher Outra Foto
      </button>

      {tipoSelecionado ===
        "produto" && (
        <button
          type="button"
          onClick={
            editarNaFotoIA
          }
          disabled={!imagemBanner}
          style={{
            width: "100%",
            marginTop: "12px",
            padding: "12px",
            borderRadius:
              "10px",
            border:
              "1px solid #7c3aed",
            background:
              imagemBanner
                ? "#7c3aed"
                : "#475569",
            color: "#ffffff",
            cursor:
              imagemBanner
                ? "pointer"
                : "not-allowed",
            fontWeight: "bold",
          }}
        >
          ⚡ Editar na Foto IA
        </button>
      )}

      <button
        type="button"
        onClick={
          removerElementoSelecionado
        }
        disabled={
          !imagemSelecionadaId
        }
        style={{
          width: "100%",
          marginTop: "12px",
          padding: "12px",
          borderRadius:
            "10px",
          border: "none",
          background:
            imagemSelecionadaId
              ? "#dc2626"
              : "#475569",
          color: "#ffffff",
          cursor:
            imagemSelecionadaId
              ? "pointer"
              : "not-allowed",
          fontWeight: "bold",
        }}
      >
        🗑️ Remover{" "}
        {nomeTipoSelecionado}
      </button>

      <div
        style={{
          height: "1px",
          background:
            "#334155",
          margin:
            "20px 0",
        }}
      />

      <div
        style={{
          marginBottom:
            "16px",
          padding: "13px",
          borderRadius:
            "12px",
          border:
            "1px solid #22d3ee",
          background:
            "linear-gradient(135deg,rgba(37,99,235,.17),rgba(34,211,238,.08))",
        }}
      >
        <h3
          style={{
            color: "#67e8f9",
            marginTop: 0,
            marginBottom:
              "7px",
            fontSize: "15px",
          }}
        >
          🪄 Produto Inteligente
        </h3>

        <p
          style={{
            marginTop: 0,
            marginBottom:
              "11px",
            color: "#cbd5e1",
            fontSize: "11px",
            lineHeight: 1.5,
          }}
        >
          Centraliza, ajusta o tamanho, melhora contraste e aplica contorno com sombra profissional.
        </p>

        <button
          type="button"
          onClick={
            melhorarProdutoSelecionado
          }
          disabled={
            !imagemSelecionadaId
          }
          style={{
            width: "100%",
            padding: "12px",
            borderRadius:
              "10px",
            border: "none",
            background:
              imagemSelecionadaId
                ? "linear-gradient(135deg,#2563eb,#22d3ee)"
                : "#475569",
            color: "#ffffff",
            cursor:
              imagemSelecionadaId
                ? "pointer"
                : "not-allowed",
            fontWeight:
              "bold",
            boxShadow:
              imagemSelecionadaId
                ? "0 10px 24px rgba(34,211,238,.22)"
                : "none",
          }}
        >
          ✨ Melhorar Produto
        </button>

        <small
          style={{
            display: "block",
            marginTop:
              "8px",
            color: "#64748b",
            fontSize: "9px",
            lineHeight: 1.4,
          }}
        >
          O botão melhora a apresentação visual. A remoção de fundo continua disponível na Foto IA.
        </small>
      </div>

      <h3
        style={{
          color: "#67e8f9",
          marginTop: 0,
        }}
      >
        ✨ Efeitos Rápidos
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "1fr 1fr",
          gap: "8px",
        }}
      >
        {EFEITOS_RAPIDOS.map(
          ([valor, nome]) => (
            <button
              key={valor}
              type="button"
              onClick={() =>
                aplicarEfeitoRapidoImagem?.(
                  valor
                )
              }
              style={{
                padding:
                  "9px 7px",
                borderRadius:
                  "9px",
                border:
                  "1px solid #334155",
                background:
                  "#020617",
                color:
                  "#e2e8f0",
                cursor:
                  "pointer",
                fontSize:
                  "11px",
                fontWeight:
                  "bold",
              }}
            >
              {nome}
            </button>
          )
        )}
      </div>
    </div>
  );
}

export default memo(
  BannerProdutoPainel
);