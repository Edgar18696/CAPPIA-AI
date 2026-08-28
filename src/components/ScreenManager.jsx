import { lazy, Suspense } from "react";

const DashboardAppia = lazy(() => import("./DashboardAppia"));
const CentralPesquisa = lazy(() => import("./CentralPesquisa"));
const GeradorAnuncio = lazy(() => import("./GeradorAnuncio"));
const FotoIA = lazy(() => import("./FotoIA"));
const BannerIA = lazy(() => import("./BannerIA"));
const ClipIA = lazy(() => import("./ClipIA"));
const Galeria = lazy(() => import("./Galeria"));

export default function ScreenManager(props) {
  const {
    screen,
    cardStyle,
    resultadoPesquisa,
    setResultadoPesquisa,
    setScreen,
  } = props;

  return (
    <Suspense
      fallback={
        <div style={cardStyle}>
          ⏳ Carregando...
        </div>
      }
    >
      {screen === "dashboardAppia" && (
        <DashboardAppia setScreen={setScreen} />
      )}

      {screen === "centralPesquisa" && (
        <CentralPesquisa
          cardStyle={cardStyle}
          setScreen={setScreen}
          setResultadoPesquisa={setResultadoPesquisa}
        />
      )}

      {screen === "geradorAnuncio" && (
        <GeradorAnuncio
          cardStyle={cardStyle}
          resultadoPesquisa={resultadoPesquisa}
          setScreen={setScreen}
        />
      )}

      {screen === "foto" && (
        <FotoIA {...props} />
      )}

      {screen === "banner" && (
        <BannerIA {...props} />
      )}

      {screen === "clip" && (
        <ClipIA {...props} />
      )}

      {screen === "galeria" && (
        <Galeria {...props} />
      )}
    </Suspense>
  );
}