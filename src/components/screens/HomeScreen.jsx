import Home from "../Home";

export default function HomeScreen({
  totalFotos,
  totalBanners,
  totalVideos,
  cardStyle,
  setScreen,
}) {
  return (
    <Home
      totalFotos={totalFotos}
      totalBanners={totalBanners}
      totalVideos={totalVideos}
      cardStyle={cardStyle}
      setScreen={setScreen}
    />
  );
}