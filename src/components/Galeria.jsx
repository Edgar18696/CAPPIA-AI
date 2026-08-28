import { useEffect, useRef } from "react";

export default function Galeria({
  galeria,
  filtroGaleria,
  setFiltroGaleria,
  buscaGaleria,
  setBuscaGaleria,
  selecionadas,
  setSelecionadas,
  alternarSelecionada,
  excluirSelecionadas,
  baixarSelecionadas,
  baixandoLote,
  excluirImagem,
  baixarImagem,
  setImagemBanner,
  setScreen,
  setFotosAnuncio,
  cardStyle,
}) {
  const inputFotoComputadorRef = useRef(null);

  function importarFotoDoComputador(event) {
    const arquivo = event.target.files?.[0];

    if (!arquivo) return;

    if (!arquivo.type?.startsWith("image/")) {
      alert("Selecione um arquivo de imagem válido.");
      event.target.value = "";
      return;
    }

    const urlTemporaria = URL.createObjectURL(arquivo);

    localStorage.setItem(
      "imagemClipSelecionada",
      urlTemporaria
    );

    localStorage.setItem(
      "abrirClipAutomatico",
      "true"
    );

    localStorage.setItem(
      "retornarParaClipIA",
      "true"
    );

    localStorage.removeItem("modoGaleria");
    localStorage.removeItem("abrirGaleriaClip");

    setSelecionadas([]);
    setScreen("clipIA");

    event.target.value = "";
  }

useEffect(() => {
  const abrirUltimas =
    localStorage.getItem(
      "abrirUltimasFotos"
    ) === "true";

  const filtroSalvo =
    localStorage.getItem(
      "filtroGaleria"
    );

  if (abrirUltimas) {
    setFiltroGaleria("foto");
    setBuscaGaleria("");
  } else if (filtroSalvo) {
    setFiltroGaleria(
      filtroSalvo
    );
  }

  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "instant",
  });

  localStorage.removeItem(
    "abrirUltimasFotos"
  );

  localStorage.removeItem(
    "filtroGaleria"
  );
}, [
  setFiltroGaleria,
  setBuscaGaleria,
]);
 let modoGaleria =
  localStorage.getItem("modoGaleria");

const abrirGaleriaClip =
  localStorage.getItem(
    "abrirGaleriaClip"
  ) === "true";

const abrirGaleriaBanner =
  localStorage.getItem(
    "abrirGaleriaBanner"
  ) === "true";

const abrirGaleriaAnuncio =
  localStorage.getItem(
    "abrirGaleriaAnuncio"
  ) === "true";

const temEntradaEspecial =
  abrirGaleriaClip ||
  abrirGaleriaBanner ||
  abrirGaleriaAnuncio;

if (
  modoGaleria &&
  !temEntradaEspecial
) {
  localStorage.removeItem(
    "modoGaleria"
  );

  modoGaleria = null;
}

const selecionandoParaBanner =
  modoGaleria ===
  "selecionarParaBanner";

const selecionandoParaClip =
  modoGaleria ===
  "clipIA";

  const selecionandoParaAnuncio =
    modoGaleria === "selecionarParaAnuncio";

  const galeriaOrdenada = [...galeria].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  const galeriaFiltrada = galeriaOrdenada.filter((item) => {
    const tipoItem =
      String(item?.tipo || "")
        .trim()
        .toLowerCase();

    // Galeria é exclusiva para fotos.
    // Clips/vídeos e banners ficam somente em Mídias APPIA.
    const ehMidiaAppia =
      tipoItem === "clip" ||
      tipoItem === "video" ||
      tipoItem === "banner";

    if (ehMidiaAppia) {
      return false;
    }

    const passaTipo =
      filtroGaleria === "todos"
        ? true
        : tipoItem ===
          String(filtroGaleria || "")
            .trim()
            .toLowerCase();

    const textoBusca =
      buscaGaleria
        .trim()
        .toLowerCase();

    const passaBusca =
      !textoBusca ||
      tipoItem.includes(textoBusca) ||
      String(item.created_at || "")
        .toLowerCase()
        .includes(textoBusca);

    return passaTipo && passaBusca;
  });

function selecionarImagemParaAnuncio(item) {
  const modoGaleria =
    localStorage.getItem("modoGaleria");

  if (
  modoGaleria ===
  "selecionarParaBanner"
) {
  const url =
    item.imagem_processada ||
    item.imagem_original;

  if (!url) {
    alert(
      "Esta imagem não possui uma URL válida."
    );
    return;
  }

  setImagemBanner?.(url);

  localStorage.setItem(
    "imagemBannerSelecionada",
    url
  );

  localStorage.setItem(
    "abrirBannerAutomatico",
    "true"
  );

  localStorage.removeItem(
    "modoGaleria"
  );

  setSelecionadas([]);

  setScreen("bannerStudio");

  return;
}

if (modoGaleria === "clipIA") {
  const url =
    item.imagem_processada ||
    item.imagem_original;

  if (!url) {
    alert("Esta imagem não possui uma URL válida.");
    return;
  }

  localStorage.setItem(
    "imagemClipSelecionada",
    url
  );

  localStorage.setItem(
    "abrirClipAutomatico",
    "true"
  );

  localStorage.removeItem(
    "modoGaleria"
  );

  setScreen("clipIA");
  return;
}

  if (!selecionandoParaAnuncio) {
    return;
  }

  if (
    selecionadas.includes(
      item.created_at
    )
  ) {
    setSelecionadas(
      selecionadas.filter(
        (id) =>
          id !== item.created_at
      )
    );

    return;
  }

  // continua aqui o restante
  // da função que já existe
}
function confirmarImagensNoAnuncio() {
  const novasFotos =
    galeriaFiltrada
      .filter((item) =>
        selecionadas.includes(
          item.created_at
        )
      )
      .map((item) => ({
        id:
          item.id ||
          item.created_at,

        imagem_processada:
          item.imagem_processada ||
          item.imagem_original,

        imagem_original:
          item.imagem_original,

        tipo:
          item.tipo,

        created_at:
          item.created_at,
      }));

  setFotosAnuncio(
    (fotosAtuais) => {
      const atuais =
        Array.isArray(
          fotosAtuais
        )
          ? fotosAtuais
          : [];

      const todas = [
        ...atuais,
        ...novasFotos,
      ];

      const semDuplicadas =
        todas.filter(
          (
            foto,
            index,
            lista
          ) => {
            const url =
              foto?.imagem_processada ||
              foto?.imagem_original ||
              "";

            return (
              url &&
              index ===
                lista.findIndex(
                  (item) =>
                    (
                      item?.imagem_processada ||
                      item?.imagem_original ||
                      ""
                    ) === url
                )
            );
          }
        );

      const rascunhoAtual =
        JSON.parse(
          localStorage.getItem(
            "rascunhoNovoAnuncioTemp"
          ) || "{}"
        );

      localStorage.setItem(
        "rascunhoNovoAnuncioTemp",
        JSON.stringify({
          ...rascunhoAtual,
          fotos:
            semDuplicadas,
        })
      );

      localStorage.setItem(
        "fotosSelecionadasAnuncio",
        JSON.stringify(
          semDuplicadas
        )
      );

      return semDuplicadas;
    }
  );

  localStorage.setItem(
    "voltarParaFotosAnuncio",
    "true"
  );

  setSelecionadas([]);

  localStorage.removeItem(
    "modoGaleria"
  );

  setScreen(
    "novoAnuncio"
  );
}

function confirmarImagemParaBanner() {
  const imagem = galeriaFiltrada.find((item) =>
    selecionadas.includes(item.created_at)
  );

  if (!imagem) {
    alert("Selecione uma imagem.");
    return;
  }

  const url =
    imagem.imagem_processada ||
    imagem.imagem_original;

  if (!url) {
    alert(
      "Esta imagem não possui uma URL válida."
    );
    return;
  }

  setImagemBanner?.(url);

  localStorage.setItem(
    "imagemBannerSelecionada",
    url
  );

  localStorage.setItem(
    "abrirBannerAutomatico",
    "true"
  );

  localStorage.removeItem("modoGaleria");

  setSelecionadas([]);

  setScreen("bannerStudio");
}
  return (
    <div style={{ marginTop: "50px", paddingBottom: "90px" }}>
      <h2
        style={{
          color: "#67e8f9",
          fontSize: "32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>🖼 Galeria</span>
      </h2>

      {selecionandoParaClip && (
        <div
          style={{
            marginBottom:"16px",
            padding:"12px",
            borderRadius:"12px",
            background:"#082f49",
            border:"1px solid #38bdf8",
            color:"#bae6fd",
            textAlign:"center",
            fontWeight:"bold",
          }}
        >
          Selecione uma foto para usar no Clip IA.
        </div>
      )}

      {selecionandoParaAnuncio && (
        <div
          style={{
            marginBottom: "16px",
            padding: "12px",
            borderRadius: "12px",
            background: "#052e16",
            border: "1px solid #22c55e",
            color: "#bbf7d0",
            textAlign: "center",
            fontWeight: "bold",
          }}
        >
          Selecione as fotos do anúncio e clique no botão verde embaixo.
        </div>
      )}

      <input
        type="text"
        placeholder="🔍 Buscar imagem"
        value={buscaGaleria}
        onChange={(e) => setBuscaGaleria(e.target.value)}
        style={{
          padding: "12px",
          width: "300px",
          borderRadius: "8px",
          marginBottom: "20px",
        }}
      />

    {!selecionandoParaAnuncio &&
  !selecionandoParaBanner && (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: "12px",
        flexWrap: "wrap",
        marginTop: "20px",
        marginBottom: "25px",
      }}
    >
      <button
        onClick={() =>
          setSelecionadas(
            galeriaFiltrada.map(
              (item) => item.created_at
            )
          )
        }
        style={botaoAzul}
      >
        ✅ Selecionar tudo
      </button>

  {selecionandoParaClip && (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      gap: "12px",
      flexWrap: "wrap",
      marginTop: "20px",
      marginBottom: "25px",
    }}
  >
    <input
      ref={inputFotoComputadorRef}
      type="file"
      accept="image/*"
      onChange={importarFotoDoComputador}
      style={{ display: "none" }}
    />

    <button
      type="button"
      onClick={() =>
        inputFotoComputadorRef.current?.click()
      }
      style={{
        background: "#16a34a",
        color: "#ffffff",
        border: "none",
        padding: "14px 22px",
        borderRadius: "12px",
        cursor: "pointer",
        fontWeight: "bold",
      }}
    >
      📁 Importar Foto do Computador
    </button>

    <button
      type="button"
      onClick={() => {
        localStorage.removeItem("modoGaleria");
        localStorage.removeItem("abrirGaleriaClip");
        localStorage.removeItem("retornarParaClipIA");

        setSelecionadas([]);
        setScreen("clipIA");
      }}
      style={{
        background: "#475569",
        color: "#ffffff",
        border: "none",
        padding: "14px 22px",
        borderRadius: "12px",
        cursor: "pointer",
        fontWeight: "bold",
      }}
    >
      ↩️ Voltar ao Clip IA
    </button>
  </div>
)}

  {selecionandoParaBanner && (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      gap: "12px",
      flexWrap: "wrap",
      marginTop: "20px",
      marginBottom: "25px",
    }}
  >
    <button
      type="button"
      onClick={
        confirmarImagemParaBanner
      }
      disabled={
        selecionadas.length !== 1
      }
      style={{
        background: "#2563eb",
        color: "#ffffff",
        border: "none",
        padding: "14px 22px",
        borderRadius: "12px",
        cursor:
          selecionadas.length === 1
            ? "pointer"
            : "not-allowed",
        fontWeight: "bold",
        opacity:
          selecionadas.length === 1
            ? 1
            : 0.6,
      }}
    >
      🎨 Usar no Banner
    </button>

    <button
      type="button"
      onClick={() => {
        localStorage.removeItem(
          "modoGaleria"
        );

        setSelecionadas([]);
        setScreen("bannerStudio");
      }}
      style={{
        background: "#475569",
        color: "#ffffff",
        border: "none",
        padding: "14px 22px",
        borderRadius: "12px",
        cursor: "pointer",
        fontWeight: "bold",
      }}
    >
      ↩️ Voltar ao Banner
    </button>
  </div>
)}

          <button onClick={() => setSelecionadas([])} style={botaoCinza}>
            ❌ Desmarcar tudo
          </button>

          <button onClick={excluirSelecionadas} style={botaoVermelho}>
            🗑️ Excluir selecionadas
          </button>

          <button
  onClick={(e) => {
    e.stopPropagation();
    baixarImagem(url);
  }}
  style={botaoVerdePequeno}
>
  ⬇️ Baixar
</button>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
          gap: "20px",
        }}
      >
        {galeriaFiltrada.map((item) => {
          const url = item.imagem_processada || item.imagem_original;
          const estaSelecionada = selecionadas.includes(item.created_at);

          return (
            <div
              key={item.id || item.created_at}
              onClick={() => {
                if (selecionandoParaClip) {
                  selecionarImagemParaAnuncio(
                    item
                  );
                  return;
                }

                if (
                  selecionandoParaBanner
                ) {
                  selecionarImagemParaAnuncio(
                    item
                  );
                  return;
                }

                if (
                  selecionandoParaAnuncio
                ) {
                  alternarSelecionada(
                    item.created_at
                  );
                  return;
                }

                selecionarImagemParaAnuncio(
                  item
                );
              }}
              style={{
                ...cardStyle,
                position: "relative",
                border: estaSelecionada
                  ? "3px solid #22c55e"
                  : "1px solid #334155",
                boxShadow: estaSelecionada
                  ? "0 0 25px rgba(34,197,94,.45)"
                  : "0 2px 8px rgba(0,0,0,.25)",
                transform: estaSelecionada ? "scale(1.03)" : "scale(1)",
                transition: "all .18s ease",
                cursor:
                  selecionandoParaAnuncio ||
                  selecionandoParaBanner ||
                  selecionandoParaClip
                    ? "pointer"
                    : "default",
              }}
            >
              <input
                type="checkbox"
                checked={estaSelecionada}
                onChange={() => {
                  if (
                    selecionandoParaClip ||
                    selecionandoParaBanner
                  ) {
                    selecionarImagemParaAnuncio(
                      item
                    );
                    return;
                  }

                  alternarSelecionada(
                    item.created_at
                  );
                }}
                onClick={(e) =>
                  e.stopPropagation()
                }
                style={{
                  width: "20px",
                  height: "20px",
                  marginBottom: "10px",
                }}
              />

              <img
                src={url}
                alt="Imagem"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
                style={{
                  width: "100%",
                  borderRadius: "12px",
                  background: "#fff",
                }}
              />

              <p style={{ color: "#93c5fd", fontWeight: "bold" }}>
                {item.tipo === "banner"
                  ? "🎨 Banner IA"
                  : item.tipo === "clip"
                  ? "🎬 Clip IA"
                  : "📸 Foto IA"}
              </p>

              <p style={{ color: "#94a3b8", fontSize: "13px" }}>
                {item.created_at
                  ? new Date(item.created_at).toLocaleString("pt-BR")
                  : ""}
              </p>

              {!selecionandoParaAnuncio &&
  !selecionandoParaBanner && (
    <div
      style={{
        display: "flex",
        gap: "8px",
        justifyContent: "center",
        flexWrap: "wrap",
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          baixarImagem(url);
        }}
        style={botaoVerdePequeno}
      >
        ⬇️ Baixar
      </button>

      {item.tipo === "foto" && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();

            localStorage.setItem(
              "imagemBannerSelecionada",
              url
            );

            localStorage.setItem(
              "abrirBannerAutomatico",
              "true"
            );

            localStorage.removeItem(
              "modoGaleria"
            );

            setScreen("bannerStudio");
          }}
          style={botaoAzulPequeno}
        >
          🖼️ Usar no Banner
        </button>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          excluirImagem(item);
        }}
        style={botaoVermelhoPequeno}
      >
        🗑️ Excluir
      </button>
    </div>
  )}
            </div>
          );
        })}
      </div>

      {galeriaFiltrada.length === 0 && (
        <p style={{ color: "#94a3b8", marginTop: "25px" }}>
          Nenhuma imagem encontrada.
        </p>
      )}

 {selecionandoParaAnuncio && (
  <div
    style={{
      position: "fixed",
      bottom: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 9999,
      background: "#052e16",
      border: "1px solid #22c55e",
      borderRadius: "16px",
      padding: "12px 18px",
      display: "flex",
      alignItems: "center",
      gap: "18px",
      boxShadow:
        "0 10px 30px rgba(0,0,0,.35)",
    }}
  >
    <div
      style={{
        color: "#dcfce7",
        fontWeight: "bold",
        whiteSpace: "nowrap",
      }}
    >
      📦 {selecionadas.length} / 6 imagens
    </div>

    <button
      type="button"
      disabled={
        selecionadas.length === 0
      }
      onClick={
        confirmarImagensNoAnuncio
      }
      style={{
        padding: "12px 22px",
        borderRadius: "12px",
        border: "none",
        background:
          selecionadas.length === 0
            ? "#475569"
            : "linear-gradient(135deg,#16a34a,#22c55e)",
        color: "#ffffff",
        fontWeight: "bold",
        cursor:
          selecionadas.length === 0
            ? "not-allowed"
            : "pointer",
      }}
    >
      📦 Inserir no anúncio
    </button>
  </div>
)}
    </div>
  );
}

const botaoAzul = {
  background: "#2563eb",
  color: "#ffffff",
  padding: "10px 18px",
  borderRadius: "10px",
  border: "none",
  cursor: "pointer",
  fontWeight: "bold",
};
const botaoCinza = {
  background: "#475569",
  color: "white",
  padding: "10px 18px",
  borderRadius: "10px",
  border: "none",
  cursor: "pointer",
  fontWeight: "bold",
};

const botaoVermelho = {
  background: "#dc2626",
  color: "white",
  padding: "10px 18px",
  borderRadius: "10px",
  border: "none",
  cursor: "pointer",
  fontWeight: "bold",
};

const botaoVerde = {
  background: "#16a34a",
  color: "white",
  padding: "10px 18px",
  borderRadius: "10px",
  border: "none",
  cursor: "pointer",
  fontWeight: "bold",
};

const botaoVerdePequeno = {
  background: "#16a34a",
  color: "#fff",
  border: "none",
  padding: "6px 10px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "13px",
};

const botaoAzulPequeno = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  padding: "6px 10px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "13px",
};

const botaoVermelhoPequeno = {
  background: "#dc2626",
  color: "#fff",
  border: "none",
  padding: "6px 10px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "13px",
};