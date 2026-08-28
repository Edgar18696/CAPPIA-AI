import {
  useState,
} from "react";

export default function Home({
  totalFotos,
  totalBanners,
  totalVideos,
  cardStyle,
  setScreen,
}) {
  const [
    mostrarPaizinho,
    setMostrarPaizinho,
  ] = useState(false);

  const cards = [
    {
      titulo: "Criar Anúncio",
      icone: "🚀",
      texto:
        "Digite o código da peça e deixe a PAIIA montar título, descrição, aplicações e preço ideal.",
      tela: "novoAnuncio",
      destaque: true,
      novoAnuncio: true,
    },
    {
      titulo:
        "Consulta por Chassi e Código",
      icone: "🚗",
      texto:
        "Consulte pelo chassi ou código da peça para identificar o veículo, localizar aplicações e confirmar a compatibilidade.",
      tela: "importadorUniversal",
      destaqueTecnico: true,
      abrirCompatibilidade: true,
      etiqueta: "COMPATIBILIDADE",
    },
    {
      titulo: "Foto IA",
      icone: "📸",
      texto:
        "Crie fotos profissionais com fundo branco ou transparente.",
      tela: "foto",
    },
   {
  titulo: "Mídias PAIIA",
  icone: "🎞️",
  texto:
    "Acesse suas mídias salvas para visualizar, exportar ou usar na publicação.",
  tela: "midiasAppia",
},
    {
      titulo: "Banner Express IA",
      icone: "⚡",
      texto:
        "Escolha foto, logo e objetivo. A PAIIA cria automaticamente uma arte profissional para divulgação.",
      tela: "bannerStudio",
    },
    
    {
      titulo: "Catálogos",
      icone: "📚",
      texto:
        "Acesse catálogos por fabricante, códigos OEM, aplicações, equivalências e o CatCar.",
      tela: "catalogos",
    },
    {
      titulo: "Galeria",
      icone: "🖼️",
      texto:
        "Acesse suas fotos profissionais salvas.",
      tela: "galeria",
    },
    {
      titulo: "Dashboard",
      icone: "📊",
      texto:
        "Acompanhe estatísticas da plataforma e produtividade.",
      tela: "dashboardAppia",
    },
  ];

  function abrirCard(card) {
    if (card.novoAnuncio) {
      localStorage.removeItem(
        "mlAnuncioTeste"
      );

      localStorage.removeItem(
        "novoAnuncioTemporario"
      );

      localStorage.removeItem(
        "rascunhoNovoAnuncioTemp"
      );

      localStorage.removeItem(
        "pecaCatalogoSelecionada"
      );

      localStorage.removeItem(
        "projetoAppiaAtual"
      );

      localStorage.removeItem(
        "anuncioProntoPublicacao"
      );

      localStorage.removeItem(
        "precoSugeridoAppia"
      );

      localStorage.removeItem(
        "dadosPrecificacaoAppia"
      );

      localStorage.removeItem(
        "mlPayloadTeste"
      );

      localStorage.removeItem(
        "bannerPronto"
      );

      localStorage.removeItem(
        "bannerSelecionado"
      );

      localStorage.removeItem(
        "clipPronto"
      );

      localStorage.removeItem(
        "clipSelecionado"
      );

      localStorage.removeItem(
        "bannersSelecionadosPublicacao"
      );

      localStorage.removeItem(
        "clipsSelecionadosPublicacao"
      );

      localStorage.removeItem(
        "clipGeracaoStatus"
      );

      localStorage.removeItem(
        "clipGeracaoMensagem"
      );

      localStorage.removeItem(
        "clipGeracaoErro"
      );

      localStorage.removeItem(
        "clipRemovidoPublicacao"
      );

      localStorage.removeItem(
        "retornarParaMidiasPublicacao"
      );

      localStorage.removeItem(
        "retornarParaNovoAnuncio"
      );
    }

    if (
      card.abrirCompatibilidade
    ) {
      localStorage.removeItem(
        "abrirConsultaChassi"
      );

      localStorage.setItem(
        "abrirConsultaCompatibilidade",
        "true"
      );
    }

    setScreen(card.tela);
  }

  function abrirPeloPaizinho(
    tela
  ) {
    setMostrarPaizinho(false);
    setScreen(tela);
  }

  return (
    <div
      style={{
        marginTop: "50px",
        position: "relative",
      }}
    >
      <h1>🚀 PAIIA AI</h1>

      <p
        style={{
          color: "#93c5fd",
          fontSize: "18px",
        }}
      >
        Transformando imagens em vendas
      </p>

      {/* =========================
          PAIZINHO PAIIA
      ========================== */}

      <div
        style={{
          marginTop: "28px",
          padding: "22px",
          borderRadius: "22px",
          border:
            "1px solid rgba(56,189,248,.45)",
          background:
            "linear-gradient(135deg, rgba(15,23,42,.98), rgba(8,47,73,.96))",
          boxShadow:
            "0 18px 50px rgba(2,132,199,.16)",
          display: "flex",
          alignItems: "center",
          justifyContent:
            "space-between",
          gap: "24px",
          flexWrap: "wrap",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: "260px",
            height: "260px",
            borderRadius: "50%",
            background:
              "rgba(34,211,238,.08)",
            right: "-70px",
            top: "-100px",
            filter: "blur(2px)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "22px",
            flex: "1 1 600px",
            position: "relative",
            zIndex: 2,
          }}
        >
          <div
            style={{
              width: "150px",
              height: "150px",
              minWidth: "150px",
              borderRadius: "22px",
              overflow: "hidden",
              background:
                "linear-gradient(145deg,#0f172a,#082f49)",
              border:
                "1px solid rgba(103,232,249,.5)",
              boxShadow:
                "0 12px 35px rgba(0,0,0,.35)",
            }}
          >
            <img
              src="/paizinho-appia.png"
              alt="Paizinho PAIIA"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition:
                  "center top",
                display: "block",
              }}
            />
          </div>

          <div
            style={{
              textAlign: "left",
              maxWidth: "650px",
            }}
          >
            <div
              style={{
                color: "#67e8f9",
                fontSize: "13px",
                fontWeight: 900,
                letterSpacing: "1px",
                marginBottom: "6px",
              }}
            >
              🤖 ASSISTENTE PAIIA
            </div>

            <h2
              style={{
                margin: 0,
                color: "#fff",
                fontSize: "28px",
              }}
            >
              O Paizinho está trabalhando
              com você.
            </h2>

            <p
              style={{
                color: "#bfdbfe",
                lineHeight: 1.55,
                margin:
                  "10px 0 18px 0",
                fontSize: "15px",
              }}
            >
             Da identificação da peça
até a criação do anúncio,
foto profissional e banner.
O Paizinho ajuda a
transformar o trabalho do
dia a dia em vendas.
            </p>

            <button
              type="button"
              onClick={() =>
                setMostrarPaizinho(true)
              }
              style={{
                border: "none",
                borderRadius: "12px",
                padding:
                  "12px 18px",
                cursor: "pointer",
                color: "#020617",
                fontWeight: 900,
                fontSize: "14px",
                background:
                  "linear-gradient(135deg,#67e8f9,#38bdf8)",
                boxShadow:
                  "0 8px 25px rgba(56,189,248,.22)",
              }}
            >
              ▶ Conheça o PAIIA
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "15px",
          justifyContent: "center",
          flexWrap: "wrap",
          marginTop: "30px",
        }}
      >
        <div style={cardStyle}>
          📸 Fotos: {totalFotos}
        </div>

        <div style={cardStyle}>
          🎨 Banners: {totalBanners}
        </div>

        <div style={cardStyle}>
          🎬 Vídeos: {totalVideos}
        </div>
      </div>

      <h2
        style={{
          color: "#67e8f9",
          marginTop: "35px",
        }}
      >
        Centro de Criação
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "18px",
          marginTop: "20px",
        }}
      >
        {cards.map((card) => (
          <button
            key={card.titulo}
            type="button"
            onClick={() =>
              abrirCard(card)
            }
            style={{
              background:
                card.destaque
                  ? "linear-gradient(135deg,#1d4ed8,#0891b2)"
                  : card.destaqueTecnico
                  ? "linear-gradient(135deg,#0f766e,#0e7490)"
                  : "#0f172a",
              border:
                card.destaque ||
                card.destaqueTecnico
                  ? "1px solid #38bdf8"
                  : "1px solid #334155",
              borderRadius: "16px",
              padding: "28px",
              cursor: "pointer",
              textAlign: "center",
              color: "#fff",
              boxShadow:
                card.destaque ||
                card.destaqueTecnico
                  ? "0 10px 30px rgba(14,165,233,.20)"
                  : "none",
              transform:
                "translateY(0)",
              transition:
                "transform .18s ease, border-color .18s ease, box-shadow .18s ease",
            }}
            onMouseEnter={(
              evento
            ) => {
              evento.currentTarget.style.transform =
                "translateY(-3px)";

              evento.currentTarget.style.borderColor =
                "#38bdf8";
            }}
            onMouseLeave={(
              evento
            ) => {
              evento.currentTarget.style.transform =
                "translateY(0)";

              evento.currentTarget.style.borderColor =
                card.destaque ||
                card.destaqueTecnico
                  ? "#38bdf8"
                  : "#334155";
            }}
          >
            {card.etiqueta && (
              <div
                style={{
                  display:
                    "inline-block",
                  marginBottom:
                    "14px",
                  padding:
                    "5px 10px",
                  borderRadius:
                    "999px",
                  background:
                    "rgba(2,6,23,.45)",
                  border:
                    "1px solid rgba(103,232,249,.55)",
                  color: "#cffafe",
                  fontSize: "11px",
                  fontWeight: 800,
                  letterSpacing:
                    ".8px",
                }}
              >
                {card.etiqueta}
              </div>
            )}

            <div
              style={{
                fontSize: "42px",
                marginBottom: "18px",
              }}
            >
              {card.icone}
            </div>

            <h3
              style={{
                marginBottom: "10px",
              }}
            >
              {card.titulo}
            </h3>

            <p
              style={{
                color:
                  card.destaque ||
                  card.destaqueTecnico
                    ? "#e0f2fe"
                    : "#cbd5e1",
                lineHeight: 1.45,
                marginBottom: 0,
              }}
            >
              {card.texto}
            </p>
          </button>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: "26px",
        }}
      >
        <button
          type="button"
          onClick={() =>
            setScreen("admin")
          }
          style={{
            padding: "11px 16px",
            borderRadius: "12px",
            border:
              "1px solid #334155",
            background:
              "rgba(15,23,42,.75)",
            color: "#94a3b8",
            fontWeight: 800,
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          ⚙️ Administração
        </button>
      </div>

      {/* =========================
          MODAL DO PAIZINHO
      ========================== */}

      {mostrarPaizinho && (
        <div
          onClick={() =>
            setMostrarPaizinho(false)
          }
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background:
              "rgba(2,6,23,.88)",
            backdropFilter:
              "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent:
              "center",
            padding: "20px",
          }}
        >
          <div
            onClick={(evento) =>
              evento.stopPropagation()
            }
            style={{
              width: "min(920px, 96vw)",
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: "24px",
              border:
                "1px solid #38bdf8",
              background:
                "linear-gradient(145deg,#020617,#0f172a)",
              boxShadow:
                "0 30px 100px rgba(0,0,0,.6)",
              padding: "28px",
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={() =>
                setMostrarPaizinho(
                  false
                )
              }
              style={{
                position:
                  "absolute",
                top: "16px",
                right: "16px",
                width: "40px",
                height: "40px",
                borderRadius:
                  "50%",
                border:
                  "1px solid #334155",
                background:
                  "#0f172a",
                color: "#fff",
                cursor: "pointer",
                fontSize: "18px",
              }}
            >
              ✕
            </button>

            <div
              style={{
                display: "flex",
                gap: "28px",
                alignItems:
                  "center",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  width: "260px",
                  height: "320px",
                  flex:
                    "0 0 260px",
                  borderRadius:
                    "22px",
                  overflow:
                    "hidden",
                  border:
                    "1px solid rgba(103,232,249,.5)",
                  background:
                    "#020617",
                }}
              >
                <img
                  src="/paizinho-appia.png"
                  alt="Paizinho PAIIA"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit:
                      "cover",
                    objectPosition:
                      "center top",
                    display:
                      "block",
                  }}
                />
              </div>

              <div
                style={{
                  flex:
                    "1 1 420px",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    color:
                      "#67e8f9",
                    fontSize:
                      "13px",
                    fontWeight:
                      900,
                    letterSpacing:
                      "1px",
                  }}
                >
                  🤖 PAIZINHO PAIIA
                </div>

                <h2
                  style={{
                    color: "#fff",
                    fontSize:
                      "32px",
                    margin:
                      "8px 0 10px",
                  }}
                >
                  Veja como eu posso
                  ajudar.
                </h2>

                <p
                  style={{
                    color:
                      "#cbd5e1",
                    lineHeight:
                      1.65,
                    marginBottom:
                      "14px",
                    fontSize:
                      "16px",
                  }}
                >
                  Com o PAIIA, seu anúncio
                  trabalha melhor por você.
                  Inteligência artificial,
                  palavras-chave estratégicas,
                  análise de preços e
                  inteligência de mercado
                  ajudam a deixar seu produto
                  mais competitivo e em
                  evidência.
                </p>

                <div
                  style={{
                    marginBottom:
                      "22px",
                    padding:
                      "13px 15px",
                    borderRadius:
                      "14px",
                    background:
                      "rgba(14,165,233,.10)",
                    border:
                      "1px solid rgba(56,189,248,.28)",
                    color:
                      "#bae6fd",
                    fontWeight:
                      800,
                    lineHeight:
                      1.45,
                  }}
                >
                  PAIIA AI. Transformando
                  imagens em vendas.
                </div>

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(2, minmax(160px, 1fr))",
                    gap: "12px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      abrirPeloPaizinho(
                        "novoAnuncio"
                      )
                    }
                    style={
                      botaoPaizinho
                    }
                  >
                    🚀 Criar Anúncio
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      abrirPeloPaizinho(
                        "foto"
                      )
                    }
                    style={
                      botaoPaizinho
                    }
                  >
                    📸 Foto IA
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      abrirPeloPaizinho(
                        "bannerStudio"
                      )
                    }
                    style={
                      botaoPaizinho
                    }
                  >
                    ⚡ Banner Express
                  </button>

                  
                </div>

                <div
                  style={{
                    marginTop:
                      "22px",
                    padding:
                      "14px 16px",
                    borderRadius:
                      "14px",
                    background:
                      "rgba(8,145,178,.10)",
                    border:
                      "1px solid rgba(34,211,238,.25)",
                    color:
                      "#bae6fd",
                    fontSize:
                      "14px",
                    lineHeight:
                      1.5,
                  }}
                >
                  💙 Da peça ao anúncio.
                  Da imagem à venda.
                  Esse é o PAIIA.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const botaoPaizinho = {
  border:
    "1px solid #334155",
  borderRadius: "14px",
  padding: "16px",
  background:
    "linear-gradient(135deg,#0f172a,#082f49)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: "14px",
  textAlign: "center",
  transition: ".18s ease",
};