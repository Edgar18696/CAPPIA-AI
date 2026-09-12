import Home from "../Home";

export default function HomeScreen({
  totalFotos,
  totalBanners,
  totalVideos,
  cardStyle,
  setScreen,
  ehAdministrador = false,
  mostrarPaizinho = false,
  setMostrarPaizinho,
}) {
  return (
    <Home
      totalFotos={totalFotos}
      totalBanners={totalBanners}
      totalVideos={totalVideos}
      cardStyle={cardStyle}
      setScreen={setScreen}
      ehAdministrador={ehAdministrador}
      mostrarPaizinho={mostrarPaizinho}
      setMostrarPaizinho={setMostrarPaizinho}
    />
  );
}