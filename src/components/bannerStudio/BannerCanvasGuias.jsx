import { memo } from "react";

function BannerCanvasGuias({
  mostrarGrade,
  tamanhoGrade,
  mostrarAreaSegura,
  mostrarGuiaVertical,
  mostrarGuiaHorizontal,
}) {
  return (
    <>
      {mostrarGrade && (
        <div
          data-nao-exportar="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 2,
            pointerEvents: "none",
            backgroundImage: `
              linear-gradient(
                to right,
                rgba(103,232,249,.18) 1px,
                transparent 1px
              ),
              linear-gradient(
                to bottom,
                rgba(103,232,249,.18) 1px,
                transparent 1px
              )
            `,
            backgroundSize:
              `${tamanhoGrade}px ${tamanhoGrade}px`,
          }}
        />
      )}

      <div
        data-nao-exportar="true"
        style={{
          position: "absolute",
          left: "24px",
          right: 0,
          top: 0,
          height: "24px",
          zIndex: 1001,
          pointerEvents: "none",
          borderBottom:
            "1px solid rgba(148,163,184,.45)",
          background:
            "repeating-linear-gradient(to right,rgba(226,232,240,.75) 0 1px,transparent 1px 10px),rgba(2,6,23,.72)",
        }}
      />

      <div
        data-nao-exportar="true"
        style={{
          position: "absolute",
          top: "24px",
          bottom: 0,
          left: 0,
          width: "24px",
          zIndex: 1001,
          pointerEvents: "none",
          borderRight:
            "1px solid rgba(148,163,184,.45)",
          background:
            "repeating-linear-gradient(to bottom,rgba(226,232,240,.75) 0 1px,transparent 1px 10px),rgba(2,6,23,.72)",
        }}
      />

      {mostrarAreaSegura && (
        <div
          data-nao-exportar="true"
          style={{
            position: "absolute",
            inset: "7%",
            border:
              "2px dashed rgba(250,204,21,.75)",
            borderRadius: "10px",
            zIndex: 998,
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              position: "absolute",
              left: "10px",
              top: "8px",
              color: "#fde047",
              background:
                "rgba(2,6,23,.82)",
              borderRadius: "6px",
              padding: "4px 7px",
              fontSize: "10px",
              fontWeight: "bold",
            }}
          >
            ÁREA SEGURA
          </span>
        </div>
      )}

      {mostrarGuiaVertical !== null && (
        <div
          style={{
            position: "absolute",
            left:
              `${mostrarGuiaVertical}px`,
            top: 0,
            bottom: 0,
            width: "2px",
            background: "#22d3ee",
            zIndex: 999,
            pointerEvents: "none",
          }}
        />
      )}

      {mostrarGuiaHorizontal !== null && (
        <div
          style={{
            position: "absolute",
            top:
              `${mostrarGuiaHorizontal}px`,
            left: 0,
            right: 0,
            height: "2px",
            background: "#22d3ee",
            zIndex: 999,
            pointerEvents: "none",
          }}
        />
      )}
    </>
  );
}

export default memo(
  BannerCanvasGuias
);