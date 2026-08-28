export default function BannerWorkspace({
  ferramentas,
  painel,
  canvas,
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "170px 235px minmax(0, 1fr)",
        gap: "18px",
        marginTop: "30px",
        alignItems: "start",
        width: "100%",
        maxWidth: "100%",
      }}
    >
      {ferramentas}
      {painel}
      {canvas}
    </div>
  );
}