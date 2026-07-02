export default function AppHeader({ logoAppia, usuario, setScreen, sairUsuario }) {
  return (
    <>
      <img
        src={logoAppia}
        alt="APPIA AI"
        style={{
          width: "320px",
          marginTop: "10px",
          marginBottom: "-40px",
        }}
      />

      <p
        style={{
          color: "#93c5fd",
          fontSize: "22px",
          marginBottom: "20px",
          fontWeight: "500",
        }}
      >
        Criação inteligente de imagens, banners e conteúdo digital
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <button onClick={() => setScreen("dashboardAppia")}>🏠 Dashboard 2.0</button>
        <button onClick={() => setScreen("foto")}>📸 Fotos IA</button>
        <button onClick={() => setScreen("banner")}>🎨 Banner IA</button>
        <button onClick={() => setScreen("galeria")}>🖼 Galeria</button>
        <button onClick={() => setScreen("atendimento")}>💬 Atendimento IA</button>
        <button onClick={() => setScreen("clipIA")}>🎬 Clip IA</button>
        <button onClick={() => setScreen("centroConhecimento")}>📚 Centro de Conhecimento</button>
        <button onClick={() => setScreen("projetos")}>📦 Projetos</button>
        <button onClick={() => setScreen("admin")}>⚙️ Administrador</button>

        {!usuario ? (
          <button onClick={() => setScreen("login")}>Login</button>
        ) : (
          <button onClick={sairUsuario}>Sair</button>
        )}
      </div>
    </>
  );
}