import { memo } from "react";

function limitarPercentual(valor) {
  return Math.max(
    0,
    Math.min(100, valor)
  );
}

function BannerNavigator({
  fundoStudio,
  imagensBanner = [],
  textosStudio = [],
  larguraCanvas = 1,
  alturaCanvas = 1,
}) {
  return (
    <div
      data-nao-exportar="true"
      style={{
        position: "fixed",
        right: "28px",
        bottom: "28px",
        width: "150px",
        height: "105px",
        borderRadius: "10px",
        border: "1px solid #475569",
        background: "rgba(2,6,23,.94)",
        boxShadow:
          "0 10px 25px rgba(0,0,0,.38)",
        overflow: "hidden",
        zIndex: 1500,
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          position: "absolute",
          left: "8px",
          top: "4px",
          color: "#cbd5e1",
          fontSize: "8px",
          fontWeight: "bold",
        }}
      >
        NAVEGADOR
      </span>

      <div
        style={{
          position: "absolute",
          left: "8px",
          right: "8px",
          top: "18px",
          bottom: "8px",
          border: "1px solid #64748b",
          borderRadius: "5px",
          background: fundoStudio,
          overflow: "hidden",
        }}
      >
        {imagensBanner.map((imagem) => (
          <span
            key={`mini-${imagem.id}`}
            style={{
              position: "absolute",
              left: `${limitarPercentual(
                (Number(imagem.x) /
                  larguraCanvas) *
                  100
              )}%`,
              top: `${limitarPercentual(
                (Number(imagem.y) /
                  alturaCanvas) *
                  100
              )}%`,
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: "#22d3ee",
              transform:
                "translate(-50%,-50%)",
            }}
          />
        ))}

        {textosStudio.map((item) => (
          <span
            key={`mini-texto-${item.id}`}
            style={{
              position: "absolute",
              left: `${limitarPercentual(
                (Number(item.x) /
                  larguraCanvas) *
                  100
              )}%`,
              top: `${limitarPercentual(
                (Number(item.y) /
                  alturaCanvas) *
                  100
              )}%`,
              width: "9px",
              height: "3px",
              borderRadius: "2px",
              background: "#fde047",
              transform:
                "translate(-50%,-50%)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default memo(BannerNavigator);