import { memo } from "react";

const NOMES_CANAIS = {
  mercadoLivre: "Mercado Livre",
  shopee: "Shopee",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
};

function obterFundoCanal(canal) {
  if (canal === "mercadoLivre") {
    return "#fff159";
  }

  if (canal === "shopee") {
    return "#ee4d2d";
  }

  if (canal === "instagram") {
    return "linear-gradient(135deg,#7c3aed,#ec4899,#f59e0b)";
  }

  return "#075e54";
}

function obterPaddingCanal(canal) {
  if (canal === "instagram") {
    return "26px 12%";
  }

  if (canal === "whatsapp") {
    return "22px 5%";
  }

  return "24px 10%";
}

function BannerPreviewMarketplace({
  aberto,
  canal,
  imagem,
  onFechar,
}) {
  if (!aberto) {
    return null;
  }

  return (
    <div
      onClick={onFechar}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background:
          "rgba(2,6,23,.9)",
        display: "flex",
        alignItems: "center",
        justifyContent:
          "center",
        padding: "24px",
      }}
    >
      <div
        onClick={(evento) =>
          evento.stopPropagation()
        }
        style={{
          width:
            "min(940px, 96vw)",
          maxHeight: "92vh",
          overflowY: "auto",
          borderRadius: "18px",
          border:
            "1px solid #334155",
          background: "#0f172a",
          padding: "18px",
          boxShadow:
            "0 30px 90px rgba(0,0,0,.62)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "12px",
            marginBottom: "15px",
          }}
        >
          <h3
            style={{
              color: "#67e8f9",
              margin: 0,
            }}
          >
            👁 Preview —{" "}
            {NOMES_CANAIS[canal] ||
              "Marketplace"}
          </h3>

          <button
            type="button"
            onClick={onFechar}
            style={{
              padding:
                "8px 12px",
              borderRadius:
                "9px",
              border:
                "1px solid #475569",
              background:
                "#020617",
              color: "#ffffff",
              cursor: "pointer",
              fontWeight:
                "bold",
            }}
          >
            ✕ Fechar
          </button>
        </div>

        <div
          style={{
            borderRadius: "14px",
            padding:
              obterPaddingCanal(
                canal
              ),
            background:
              obterFundoCanal(
                canal
              ),
          }}
        >
          <div
            style={{
              background:
                "#ffffff",
              borderRadius:
                "12px",
              padding: "12px",
              boxShadow:
                "0 16px 40px rgba(0,0,0,.3)",
            }}
          >
            {imagem ? (
              <img
                src={imagem}
                alt="Preview do banner"
                style={{
                  display: "block",
                  width: "100%",
                  borderRadius:
                    "8px",
                }}
              />
            ) : (
              <div
                style={{
                  padding: "45px",
                  textAlign:
                    "center",
                  color:
                    "#64748b",
                }}
              >
                Nenhum preview gerado.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(
  BannerPreviewMarketplace
);