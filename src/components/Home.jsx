import {
  useState,
} from "react";

const PAIZINHO_HOME =
  `${import.meta.env.BASE_URL || "/"}assets/paizinho-home.png?v=oficial`.replace(
    /([^:]\/)\/+/g,
    "$1"
  );

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
      titulo: "Paizinho — Criar meu Mascote",
      icone: "👨‍🔧",
      texto:
        "Crie o personagem da sua empresa e reutilize em suas campanhas.",
      tela: "criarMascotePaizinho",
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
    {
      titulo: "Planos e Pagamentos",
      icone: "💳",
      texto:
        "Gerencie seu plano, créditos e formas de pagamento.",
      tela: "planosPagamentos",
    },
        {
      titulo: "Contas Marketplace",
      icone: "🔗",
      texto:
        "Conecte e gerencie suas contas do Mercado Livre e outros marketplaces.",
      tela: "contasMarketplace",
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
      className="paiia-home-conteudo"
      style={{
        marginTop: "50px",
        position: "relative",
        width: "100%",
        maxWidth: "100%",
        overflowX: "hidden",
        boxSizing: "border-box",
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

      <style>
        {`
          .paiia-home-paizinho {
            margin-top: 18px;
            padding: 14px 28px 14px 18px;
            border-radius: 22px;
            border: 1px solid rgba(56,189,248,.45);
            background: linear-gradient(135deg, rgba(15,23,42,.98), rgba(8,47,73,.96));
            box-shadow: 0 18px 50px rgba(2,132,199,.16);
            display: block;
            overflow-x: hidden;
            overflow-y: visible;
            position: relative;
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
          }
          .paiia-home-paizinho-row {
            display: flex;
            flex-direction: row;
            flex-wrap: nowrap;
            align-items: center;
            justify-content: flex-start;
            gap: 18px 22px;
            position: relative;
            z-index: 2;
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
            overflow-x: hidden;
          }
          .paiia-home-paizinho-foto {
            flex: 0 0 auto;
            width: auto;
            max-width: 32%;
            min-width: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: transparent;
            border: none;
            box-shadow: none;
            box-sizing: border-box;
          }
          .paiia-home-paizinho-foto img {
            width: auto;
            height: 320px;
            max-width: 100%;
            max-height: 320px;
            object-fit: contain;
            object-position: center;
            display: block;
          }
          .paiia-home-paizinho-texto {
            flex: 1 1 30%;
            width: auto;
            min-width: 0;
            max-width: 420px;
            text-align: left;
            padding: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: flex-start;
            box-sizing: border-box;
          }
          .paiia-home-paizinho-kicker {
            color: #67e8f9;
            font-size: 12px;
            font-weight: 900;
            letter-spacing: 1.4px;
            margin: 0 0 6px;
          }
          .paiia-home-paizinho-titulo {
            margin: 0;
            color: #fff;
            font-size: clamp(26px, 2.7vw, 38px);
            line-height: 1.18;
            overflow-wrap: break-word;
            max-width: 100%;
          }
          .paiia-home-paizinho-slogan {
            margin: 10px 0 0;
            color: #67e8f9;
            font-size: clamp(20px, 2.2vw, 28px);
            font-weight: 800;
            font-style: italic;
            line-height: 1.2;
          }
          .paiia-home-paizinho-beneficios {
            display: flex;
            flex-wrap: wrap;
            gap: 8px 10px;
            margin: 16px 0 8px;
            padding: 0;
            list-style: none;
            width: 100%;
          }
          .paiia-home-paizinho-beneficios li {
            color: #e0f2fe;
            background: rgba(14,165,233,.14);
            border: 1px solid rgba(103,232,249,.35);
            border-radius: 999px;
            padding: 7px 12px;
            font-size: 13px;
            font-weight: 800;
            white-space: nowrap;
          }
          .paiia-home-paizinho-cta {
            border: none;
            border-radius: 12px;
            padding: 14px 22px;
            cursor: pointer;
            color: #020617;
            font-weight: 900;
            font-size: 15px;
            margin-top: 10px;
            background: linear-gradient(135deg,#67e8f9,#38bdf8);
            box-shadow: 0 8px 25px rgba(56,189,248,.28);
          }
          .paiia-home-paizinho-funcoes {
            flex: 1 1 38%;
            min-width: 0;
            max-width: 100%;
            box-sizing: border-box;
            padding: 12px 14px 14px;
            border-radius: 18px;
            border: 1px solid rgba(103,232,249,.22);
            background: rgba(8,47,73,.42);
          }
          .paiia-home-paizinho-funcoes-titulo {
            margin: 0 0 10px;
            color: #67e8f9;
            font-size: 13px;
            font-weight: 900;
            letter-spacing: .4px;
            text-align: left;
          }
          .paiia-home-paizinho-funcoes-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            width: 100%;
          }
          .paiia-home-paizinho-funcao {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
            margin: 0;
            padding: 8px 10px;
            border-radius: 12px;
            border: 1px solid rgba(56,189,248,.22);
            background: rgba(15,23,42,.55);
            color: #e0f2fe;
            font-size: 12px;
            font-weight: 800;
            line-height: 1.25;
            overflow-wrap: break-word;
          }
          .paiia-home-paizinho-funcao span {
            flex: 0 0 auto;
            font-size: 14px;
          }
          .paiia-home-paizinho-funcoes-frase {
            margin: 12px 0 0;
            color: #bae6fd;
            font-size: 13px;
            font-weight: 700;
            line-height: 1.4;
          }
          .paiia-home-paizinho-modal-foto {
            width: min(280px, 100%);
            height: auto;
            flex: 0 1 280px;
            max-width: 100%;
            border-radius: 22px;
            overflow: visible;
            border: 1px solid rgba(103,232,249,.5);
            background: #020617;
            box-sizing: border-box;
          }
          .paiia-home-paizinho-modal-foto img {
            width: 100%;
            height: auto;
            object-fit: contain;
            object-position: center;
            display: block;
          }
          @media (max-width: 720px) {
            .paiia-home-conteudo {
              margin-top: 6px !important;
            }
            .paiia-home-conteudo > h1 {
              margin-top: 2px;
              margin-bottom: 4px;
            }
            .paiia-home-conteudo > p {
              margin-top: 0;
              margin-bottom: 8px;
            }
            .paiia-home-paizinho {
              margin-top: 10px;
            }
          }
          @media (max-width: 980px) {
            .paiia-home-paizinho {
              padding: 14px 12px 16px;
            }
            .paiia-home-paizinho-row {
              flex-direction: column;
              flex-wrap: nowrap;
              align-items: stretch;
              justify-content: flex-start;
              text-align: center;
              gap: 12px;
            }
            .paiia-home-paizinho-foto {
              width: min(240px, 70vw);
              max-width: 100%;
              flex: 0 0 auto;
              order: 1;
              margin: 0 auto;
              justify-content: center;
            }
            .paiia-home-paizinho-foto img {
              width: 100%;
              height: auto;
              max-height: 240px;
            }
            .paiia-home-paizinho-texto {
              order: 2;
              text-align: center;
              max-width: 100%;
              width: 100%;
              flex: 0 0 auto;
              align-items: center;
              padding: 0;
            }
            .paiia-home-paizinho-titulo {
              font-size: 24px;
            }
            .paiia-home-paizinho-slogan {
              font-size: 20px;
            }
            .paiia-home-paizinho-beneficios {
              justify-content: center;
            }
            .paiia-home-paizinho-funcoes {
              order: 3;
              width: 100%;
              max-width: 100%;
              flex: 0 0 auto;
              text-align: left;
            }
            .paiia-home-paizinho-funcoes-titulo,
            .paiia-home-paizinho-funcoes-frase {
              text-align: center;
            }
          }
          @media (max-width: 480px) {
            .paiia-home-paizinho-funcoes-grid {
              grid-template-columns: 1fr;
            }
            .paiia-home-paizinho-foto img {
              max-height: 220px;
            }
          }
        `}
      </style>

      <div className="paiia-home-paizinho">
        <div
          style={{
            position: "absolute",
            width: "180px",
            height: "180px",
            borderRadius: "50%",
            background:
              "rgba(34,211,238,.08)",
            right: "0",
            top: "-80px",
            filter: "blur(2px)",
            pointerEvents: "none",
          }}
        />

        <div className="paiia-home-paizinho-row">
          <div className="paiia-home-paizinho-foto">
            <img
              src={PAIZINHO_HOME}
              alt="Paizinho PAIIA"
            />
          </div>

          <div className="paiia-home-paizinho-texto">
            <div className="paiia-home-paizinho-kicker">
              🤖 ASSISTENTE PAIIA
            </div>

            <h2 className="paiia-home-paizinho-titulo">
              O Paizinho está trabalhando
              com você.
            </h2>

            <p className="paiia-home-paizinho-slogan">
              Deixa com o Paizinho!
            </p>

            <ul className="paiia-home-paizinho-beneficios">
              <li>Cria</li>
              <li>Organiza</li>
              <li>Trabalha por você</li>
            </ul>

            <button
              type="button"
              className="paiia-home-paizinho-cta"
              onClick={() =>
                setMostrarPaizinho(true)
              }
            >
              ▶ Conheça o PAIIA
            </button>
          </div>

          <div className="paiia-home-paizinho-funcoes">
            <h3 className="paiia-home-paizinho-funcoes-titulo">
              O que o Paizinho faz por você
            </h3>
            <div className="paiia-home-paizinho-funcoes-grid">
              <p className="paiia-home-paizinho-funcao">
                <span>🔎</span> Identifica a peça
              </p>
              <p className="paiia-home-paizinho-funcao">
                <span>📝</span> Monta o anúncio
              </p>
              <p className="paiia-home-paizinho-funcao">
                <span>📸</span> Prepara a foto
              </p>
              <p className="paiia-home-paizinho-funcao">
                <span>🎬</span> Cria o Clip
              </p>
              <p className="paiia-home-paizinho-funcao">
                <span>📚</span> Consulta catálogos
              </p>
              <p className="paiia-home-paizinho-funcao">
                <span>💬</span> Ajuda no atendimento
              </p>
            </div>
            <p className="paiia-home-paizinho-funcoes-frase">
              Você escolhe o que precisa. O Paizinho faz o trabalho.
            </p>
          </div>
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
            "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
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
              <div className="paiia-home-paizinho-modal-foto">
                <img
                  src={PAIZINHO_HOME}
                  alt="Paizinho PAIIA"
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
                      "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
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