export default function BannerElemento({
  children,
  selecionado = false,
  onSelecionar,
  onMouseDown,
  onResizeStart,
  onRotateStart,
  style = {},
}) {
  function selecionar(evento) {
    evento.stopPropagation();

    onSelecionar?.();
  }

  function iniciarMovimento(evento) {
    evento.preventDefault();
    evento.stopPropagation();

    onSelecionar?.();
    onMouseDown?.(evento);
  }

  function iniciarRedimensionamento(
    evento
  ) {
    evento.preventDefault();
    evento.stopPropagation();

    onSelecionar?.();
    onResizeStart?.(evento);
  }

  function iniciarRotacao(evento) {
    evento.preventDefault();
    evento.stopPropagation();

    onSelecionar?.();
    onRotateStart?.(evento);
  }

  return (
    <div
      onClick={selecionar}
      onMouseDown={
        iniciarMovimento
      }
      style={{
        position: "absolute",
        boxSizing: "border-box",
        userSelect: "none",
        touchAction: "none",

        outline: selecionado
          ? "2px solid #22d3ee"
          : "2px solid transparent",

        borderRadius: "6px",

        boxShadow: selecionado
          ? "0 0 0 1px rgba(255,255,255,0.75)"
          : "none",

        cursor: "move",

        ...style,
      }}
    >
      {children}

      {selecionado && (
        <>
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "-32px",
              width: "2px",
              height: "26px",
              background:
                "#22d3ee",
              transform:
                "translateX(-50%)",
              pointerEvents:
                "none",
            }}
          />

          <button
            type="button"
            title="Girar elemento"
            onMouseDown={
              iniciarRotacao
            }
            style={{
              position: "absolute",
              left: "50%",
              top: "-46px",
              width: "24px",
              height: "24px",
              transform:
                "translateX(-50%)",

              display: "flex",
              alignItems: "center",
              justifyContent:
                "center",

              padding: 0,
              borderRadius: "50%",
              border:
                "2px solid #ffffff",

              background:
                "#0891b2",
              color: "#ffffff",

              cursor: "grab",
              fontSize: "13px",
              fontWeight: "bold",
              lineHeight: 1,

              boxShadow:
                "0 4px 12px rgba(0,0,0,0.35)",

              zIndex: 50,
            }}
          >
            ↻
          </button>

          <Alca
            posicao={{
              left: "-7px",
              top: "-7px",
            }}
            cursor="nwse-resize"
            onMouseDown={
              iniciarRedimensionamento
            }
          />

          <Alca
            posicao={{
              right: "-7px",
              top: "-7px",
            }}
            cursor="nesw-resize"
            onMouseDown={
              iniciarRedimensionamento
            }
          />

          <Alca
            posicao={{
              left: "-7px",
              bottom: "-7px",
            }}
            cursor="nesw-resize"
            onMouseDown={
              iniciarRedimensionamento
            }
          />

          <Alca
            posicao={{
              right: "-7px",
              bottom: "-7px",
            }}
            cursor="nwse-resize"
            onMouseDown={
              iniciarRedimensionamento
            }
          />

          <AlcaLateral
            posicao={{
              left: "50%",
              top: "-6px",
              transform:
                "translateX(-50%)",
            }}
            cursor="ns-resize"
            onMouseDown={
              iniciarRedimensionamento
            }
          />

          <AlcaLateral
            posicao={{
              left: "50%",
              bottom: "-6px",
              transform:
                "translateX(-50%)",
            }}
            cursor="ns-resize"
            onMouseDown={
              iniciarRedimensionamento
            }
          />

          <AlcaLateral
            posicao={{
              left: "-6px",
              top: "50%",
              transform:
                "translateY(-50%)",
            }}
            cursor="ew-resize"
            onMouseDown={
              iniciarRedimensionamento
            }
          />

          <AlcaLateral
            posicao={{
              right: "-6px",
              top: "50%",
              transform:
                "translateY(-50%)",
            }}
            cursor="ew-resize"
            onMouseDown={
              iniciarRedimensionamento
            }
          />
        </>
      )}
    </div>
  );
}

function Alca({
  posicao,
  cursor,
  onMouseDown,
}) {
  return (
    <button
      type="button"
      onMouseDown={onMouseDown}
      style={{
        position: "absolute",
        width: "14px",
        height: "14px",
        padding: 0,

        borderRadius: "3px",
        border:
          "2px solid #ffffff",

        background: "#22d3ee",
        cursor,

        boxShadow:
          "0 3px 8px rgba(0,0,0,0.35)",

        zIndex: 45,

        ...posicao,
      }}
    />
  );
}

function AlcaLateral({
  posicao,
  cursor,
  onMouseDown,
}) {
  return (
    <button
      type="button"
      onMouseDown={onMouseDown}
      style={{
        position: "absolute",
        width: "12px",
        height: "12px",
        padding: 0,

        borderRadius: "50%",
        border:
          "2px solid #ffffff",

        background: "#22d3ee",
        cursor,

        boxShadow:
          "0 3px 8px rgba(0,0,0,0.35)",

        zIndex: 45,

        ...posicao,
      }}
    />
  );
}