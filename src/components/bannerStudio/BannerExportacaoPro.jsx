import {
  useMemo,
  useState,
} from "react";

const FORMATOS = [
  {
    id: "png",
    nome: "PNG",
    descricao:
      "Melhor para qualidade e transparência.",
  },
  {
    id: "jpg",
    nome: "JPG",
    descricao:
      "Arquivo leve para marketplaces.",
  },
  {
    id: "webp",
    nome: "WEBP",
    descricao:
      "Alta qualidade com tamanho reduzido.",
  },
  {
    id: "pdf",
    nome: "PDF",
    descricao:
      "Ideal para catálogos e impressão.",
  },
];

const RESOLUCOES = [
  {
    id: "mercadoLivre",
    nome: "Mercado Livre",
    largura: 1200,
    altura: 1200,
  },
  {
    id: "shopee",
    nome: "Shopee",
    largura: 1200,
    altura: 1500,
  },
  {
    id: "catalogo",
    nome: "Catálogo",
    largura: 1200,
    altura: 1800,
  },
  {
    id: "instagram",
    nome: "Instagram Feed",
    largura: 1080,
    altura: 1350,
  },
  {
    id: "stories",
    nome: "Stories",
    largura: 1080,
    altura: 1920,
  },
  {
    id: "whatsapp",
    nome: "WhatsApp",
    largura: 3120,
    altura: 1440,
  },
];

const QUALIDADES = [
  {
    id: "ultra",
    nome: "Ultra",
    escala: 3,
    qualidade: 1,
  },
  {
    id: "alta",
    nome: "Alta",
    escala: 2,
    qualidade: 0.96,
  },
  {
    id: "media",
    nome: "Média",
    escala: 1.5,
    qualidade: 0.88,
  },
  {
    id: "leve",
    nome: "Leve",
    escala: 1,
    qualidade: 0.76,
  },
];

export default function BannerExportacaoPro({
  formato = "png",
  setFormato,
  resolucao = "mercadoLivre",
  setResolucao,
  qualidade = "alta",
  setQualidade,
  fundoTransparente = false,
  setFundoTransparente,
  nomeArquivo = "banner-appia",
  setNomeArquivo,
  exportando = false,
  onExportar,
  onExportarTodos,
  onGerarPreview,
  previewImagem = "",
}) {
  const [
    mostrarPreview,
    setMostrarPreview,
  ] = useState(false);

  const formatoAtual =
    FORMATOS.find(
      (item) =>
        item.id === formato
    ) || FORMATOS[0];

  const resolucaoAtual =
    RESOLUCOES.find(
      (item) =>
        item.id === resolucao
    ) || RESOLUCOES[0];

  const qualidadeAtual =
    QUALIDADES.find(
      (item) =>
        item.id === qualidade
    ) || QUALIDADES[1];

  const nomeFinal = useMemo(() => {
    const base = String(
      nomeArquivo ||
      "banner-appia"
    )
      .trim()
      .replace(
        /[^a-zA-Z0-9-_]+/g,
        "-"
      )
      .replace(
        /-+/g,
        "-"
      )
      .replace(
        /^-|-$/g,
        ""
      );

    return (
      base ||
      "banner-appia"
    );
  }, [nomeArquivo]);

  async function abrirPreview() {
    if (
      typeof onGerarPreview ===
      "function"
    ) {
      await onGerarPreview({
        formato,
        resolucao,
        qualidade,
        fundoTransparente,
      });
    }

    setMostrarPreview(true);
  }

  function exportarAtual() {
    if (
      typeof onExportar !==
      "function"
    ) {
      return;
    }

    onExportar({
      formato,
      resolucao,
      qualidade,
      fundoTransparente,
      nomeArquivo: nomeFinal,
      largura:
        resolucaoAtual.largura,
      altura:
        resolucaoAtual.altura,
      escala:
        qualidadeAtual.escala,
      qualidadeImagem:
        qualidadeAtual.qualidade,
    });
  }

  function exportarTodos() {
    if (
      typeof onExportarTodos !==
      "function"
    ) {
      return;
    }

    onExportarTodos({
      formato,
      qualidade,
      fundoTransparente,
      nomeArquivo: nomeFinal,
      resolucoes:
        RESOLUCOES,
      escala:
        qualidadeAtual.escala,
      qualidadeImagem:
        qualidadeAtual.qualidade,
    });
  }

  return (
    <div
      style={{
        display: "grid",
        gap: "14px",
      }}
    >
      <div>
        <h3
          style={{
            color: "#67e8f9",
            marginTop: 0,
            marginBottom:
              "6px",
          }}
        >
          📤 Exportação Profissional
        </h3>

        <p
          style={{
            color: "#94a3b8",
            fontSize: "12px",
            lineHeight: 1.5,
            marginTop: 0,
          }}
        >
          Exporte seu banner nos
          principais formatos e
          resoluções para marketplaces,
          redes sociais e catálogos.
        </p>
      </div>

      <Secao titulo="Formato">
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",
            gap: "8px",
          }}
        >
          {FORMATOS.map(
            (item) => {
              const ativo =
                formato ===
                item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    setFormato?.(
                      item.id
                    )
                  }
                  style={{
                    padding:
                      "10px",
                    borderRadius:
                      "10px",
                    border: ativo
                      ? "1px solid #22d3ee"
                      : "1px solid #334155",
                    background: ativo
                      ? "#164e63"
                      : "#020617",
                    color:
                      "#ffffff",
                    cursor:
                      "pointer",
                    textAlign:
                      "left",
                  }}
                >
                  <strong
                    style={{
                      display:
                        "block",
                      fontSize:
                        "12px",
                    }}
                  >
                    {item.nome}
                  </strong>

                  <small
                    style={{
                      display:
                        "block",
                      marginTop:
                        "4px",
                      color:
                        "#94a3b8",
                      fontSize:
                        "9px",
                      lineHeight:
                        1.35,
                    }}
                  >
                    {
                      item.descricao
                    }
                  </small>
                </button>
              );
            }
          )}
        </div>
      </Secao>

      <Secao titulo="Resolução">
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",
            gap: "8px",
          }}
        >
          {RESOLUCOES.map(
            (item) => {
              const ativo =
                resolucao ===
                item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    setResolucao?.(
                      item.id
                    )
                  }
                  style={{
                    padding:
                      "10px",
                    borderRadius:
                      "10px",
                    border: ativo
                      ? "1px solid #22d3ee"
                      : "1px solid #334155",
                    background: ativo
                      ? "#164e63"
                      : "#020617",
                    color:
                      "#ffffff",
                    cursor:
                      "pointer",
                    textAlign:
                      "left",
                  }}
                >
                  <strong
                    style={{
                      display:
                        "block",
                      fontSize:
                        "11px",
                    }}
                  >
                    {item.nome}
                  </strong>

                  <small
                    style={{
                      display:
                        "block",
                      marginTop:
                        "4px",
                      color:
                        "#94a3b8",
                      fontSize:
                        "9px",
                    }}
                  >
                    {item.largura}
                    {" × "}
                    {item.altura}
                  </small>
                </button>
              );
            }
          )}
        </div>
      </Secao>

      <Secao titulo="Qualidade">
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",
            gap: "6px",
          }}
        >
          {QUALIDADES.map(
            (item) => {
              const ativo =
                qualidade ===
                item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    setQualidade?.(
                      item.id
                    )
                  }
                  style={{
                    padding:
                      "8px 4px",
                    borderRadius:
                      "9px",
                    border: ativo
                      ? "1px solid #22d3ee"
                      : "1px solid #334155",
                    background: ativo
                      ? "#164e63"
                      : "#020617",
                    color:
                      "#ffffff",
                    cursor:
                      "pointer",
                    fontSize:
                      "10px",
                    fontWeight:
                      "bold",
                  }}
                >
                  {item.nome}
                </button>
              );
            }
          )}
        </div>
      </Secao>

      <Secao titulo="Arquivo">
        <label
          style={{
            display: "block",
            color: "#cbd5e1",
            fontSize: "11px",
            fontWeight: "bold",
          }}
        >
          Nome do arquivo

          <input
            type="text"
            value={nomeArquivo}
            onChange={(
              evento
            ) =>
              setNomeArquivo?.(
                evento.target
                  .value
              )
            }
            placeholder="banner-appia"
            style={{
              width: "100%",
              boxSizing:
                "border-box",
              marginTop: "6px",
              padding:
                "10px",
              borderRadius:
                "9px",
              border:
                "1px solid #334155",
              background:
                "#020617",
              color:
                "#ffffff",
            }}
          />
        </label>

        <label
          style={{
            display: "flex",
            alignItems:
              "center",
            gap: "8px",
            marginTop:
              "11px",
            color:
              "#cbd5e1",
            fontSize:
              "11px",
            cursor:
              formato === "png"
                ? "pointer"
                : "not-allowed",
          }}
        >
          <input
            type="checkbox"
            checked={
              fundoTransparente
            }
            disabled={
              formato !== "png"
            }
            onChange={(
              evento
            ) =>
              setFundoTransparente?.(
                evento.target
                  .checked
              )
            }
          />

          Fundo transparente
          (somente PNG)
        </label>
      </Secao>

      <div
        style={{
          padding: "11px",
          borderRadius: "10px",
          border:
            "1px solid #334155",
          background: "#020617",
          color: "#cbd5e1",
          fontSize: "10px",
          lineHeight: 1.5,
        }}
      >
        <strong
          style={{
            color: "#67e8f9",
          }}
        >
          Saída:
        </strong>{" "}
        {nomeFinal}-
        {resolucaoAtual.largura}x
        {resolucaoAtual.altura}.
        {formatoAtual.id}
        <br />
        Qualidade:{" "}
        {qualidadeAtual.nome}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "1fr 1fr",
          gap: "8px",
        }}
      >
        <button
          type="button"
          onClick={
            abrirPreview
          }
          disabled={
            exportando
          }
          style={{
            padding: "12px",
            borderRadius:
              "10px",
            border:
              "1px solid #475569",
            background:
              "#0f172a",
            color:
              "#ffffff",
            cursor:
              exportando
                ? "not-allowed"
                : "pointer",
            fontWeight:
              "bold",
          }}
        >
          👁 Preview
        </button>

        <button
          type="button"
          onClick={
            exportarAtual
          }
          disabled={
            exportando ||
            typeof onExportar !==
              "function"
          }
          style={{
            padding: "12px",
            borderRadius:
              "10px",
            border: "none",
            background:
              exportando
                ? "#475569"
                : "linear-gradient(135deg,#2563eb,#22d3ee)",
            color:
              "#ffffff",
            cursor:
              exportando
                ? "not-allowed"
                : "pointer",
            fontWeight:
              "900",
          }}
        >
          {exportando
            ? "⏳ Exportando..."
            : "📤 Exportar Banner"}
        </button>
      </div>

      <button
        type="button"
        onClick={
          exportarTodos
        }
        disabled={
          exportando ||
          typeof onExportarTodos !==
            "function"
        }
        style={{
          width: "100%",
          padding: "13px",
          borderRadius:
            "10px",
          border: "none",
          background:
            exportando
              ? "#475569"
              : "linear-gradient(135deg,#7c3aed,#2563eb,#06b6d4)",
          color: "#ffffff",
          cursor:
            exportando
              ? "not-allowed"
              : "pointer",
          fontWeight: "900",
          boxShadow:
            "0 12px 24px rgba(37,99,235,.2)",
        }}
      >
        🚀 Exportar Todos os Formatos
      </button>

      {mostrarPreview && (
        <div
          style={{
            padding: "12px",
            borderRadius:
              "12px",
            border:
              "1px solid #22d3ee",
            background:
              "#020617",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              marginBottom:
                "9px",
            }}
          >
            <strong
              style={{
                color:
                  "#67e8f9",
                fontSize:
                  "12px",
              }}
            >
              👁 Preview
            </strong>

            <button
              type="button"
              onClick={() =>
                setMostrarPreview(
                  false
                )
              }
              style={{
                border: "none",
                background:
                  "transparent",
                color:
                  "#94a3b8",
                cursor:
                  "pointer",
                fontSize:
                  "16px",
              }}
            >
              ✕
            </button>
          </div>

          {previewImagem ? (
            <img
              src={
                previewImagem
              }
              alt="Preview da exportação"
              style={{
                display:
                  "block",
                width: "100%",
                maxHeight:
                  "360px",
                objectFit:
                  "contain",
                borderRadius:
                  "9px",
                background:
                  "#0f172a",
              }}
            />
          ) : (
            <div
              style={{
                padding:
                  "24px 12px",
                textAlign:
                  "center",
                color:
                  "#64748b",
                fontSize:
                  "11px",
              }}
            >
              O preview será exibido
              aqui quando for gerado
              pelo Banner Studio.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Secao({
  titulo,
  children,
}) {
  return (
    <section
      style={{
        padding: "12px",
        borderRadius: "12px",
        border:
          "1px solid #334155",
        background: "#0f172a",
      }}
    >
      <h4
        style={{
          color: "#67e8f9",
          margin:
            "0 0 10px 0",
          fontSize: "13px",
        }}
      >
        {titulo}
      </h4>

      {children}
    </section>
  );
}

export {
  FORMATOS,
  RESOLUCOES,
  QUALIDADES,
};