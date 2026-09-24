import Home from "../Home";

export default function HomeScreen({
  totalFotos,
  totalBanners,
  totalVideos,
  cardStyle,
  setScreen,
  ehAdministrador = false,
  ehContaInternaTeste = false,
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
      ehContaInternaTeste={ehContaInternaTeste}
      mostrarPaizinho={mostrarPaizinho}
      setMostrarPaizinho={setMostrarPaizinho}
    />
  );
}