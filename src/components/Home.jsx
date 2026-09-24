import { useState } from "react";
import {
  ehTelaNovaCriacaoMidia,
  prepararNovaCriacaoMidia,
} from "../services/limparEstadoTemporarioMidia";
import { ROTULO_CONTA_INTERNA_TESTE } from "../config/contasInternasPaiia";

export default function Home({
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
  const [tarefaPaizinhoSelecionada, setTarefaPaizinhoSelecionada] =
    useState("");
  const [pedidoPaizinho, setPedidoPaizinho] = useState("");

  const tarefasPaizinho = [
    "🔍 Encontrar anúncios que não estão vendendo",
    "📊 Analisar preços e concorrência",
    "📈 Encontrar oportunidades para vender mais",
    "📸 Verificar e melhorar fotos dos anúncios",
    "🔗 Encontrar códigos equivalentes e OEM",
    "🚗 Conferir aplicações e compatibilidade",
    "✍️ Melhorar títulos e descrições",
    "💰 Verificar preço, margem e estratégia de venda",
    "🚀 Encontrar anúncios que podem subir no ranking",
  ];

  const cards = [
    {
      titulo: "Central do Paizinho",
      icone: "👨‍🔧",
      texto:
        "Não sabe por onde começar? O Paizinho orienta e leva você à função certa com os dados já preenchidos.",
      tela: "centralPaizinho",
      destaque: true,
    },
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
    if (
      card.novoAnuncio ||
      ehTelaNovaCriacaoMidia(card.tela)
    ) {
      prepararNovaCriacaoMidia();
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

    // Galeria aberta pela Home = Galeria normal (Fotos | Mascotes | Banners | Vídeos).
    // Limpa um modo de seleção que tenha ficado salvo de um fluxo interrompido
    // (ex.: escolher foto para Clip/Banner/Anúncio), que escondia as categorias.
    if (card.tela === "galeria") {
      [
        "modoGaleria",
        "galeriaAbaFixa",
        "abrirGaleriaNaAba",
        "abrirGaleriaClip",
      ].forEach((chave) => localStorage.removeItem(chave));
    }

    setScreen(card.tela);
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
      <h1 className="paiia-home-marca">🚀 PAIIA AI</h1>

      {ehContaInternaTeste && (
        <p
          style={{
            display: "inline-block",
            margin: "0 auto 18px",
            padding: "8px 14px",
            borderRadius: "999px",
            border: "1px solid #fbbf24",
            background: "rgba(120,53,15,.45)",
            color: "#fde68a",
            fontWeight: 800,
            fontSize: "13px",
          }}
        >
          {ROTULO_CONTA_INTERNA_TESTE} — conta interna, não é cliente pagante
        </p>
      )}

      <p
        className="paiia-home-slogan"
        style={{
          color: "#93c5fd",
          fontSize: "18px",
        }}
      >
        Transformando imagens em vendas
      </p>

      <h2
        className="paiia-home-secao"
        style={{
          color: "#67e8f9",
          marginTop: "18px",
        }}
      >
        Centro de Criação
      </h2>

      <div
        className="paiia-home-cards"
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
              className="paiia-home-card-icone"
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

      {ehAdministrador && (
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
      )}

      {mostrarPaizinho && (
        <div
          className="paiia-galeria-modal"
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
            className="paiia-galeria-modal-caixa"
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
                  Paizinho IA
                </div>

                <h2
                  style={{
                    color: "#fff",
                    fontSize:
                      "clamp(22px, 4.2vw, 32px)",
                    margin:
                      "8px 0 10px",
                    paddingRight: "36px",
                    lineHeight: 1.2,
                  }}
                >
                  Paizinho trabalha enquanto você dorme!
                </h2>

                <p
                  style={{
                    color:
                      "#cbd5e1",
                    lineHeight:
                      1.65,
                    marginBottom:
                      "16px",
                    fontSize:
                      "16px",
                  }}
                >
                  O que você quer que eu faça?
                </p>

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
                    gap: "10px",
                    marginBottom: "18px",
                  }}
                >
                  {tarefasPaizinho.map((tarefa) => {
                    const selecionada =
                      tarefaPaizinhoSelecionada === tarefa;

                    return (
                      <button
                        key={tarefa}
                        type="button"
                        onClick={() =>
                          setTarefaPaizinhoSelecionada(tarefa)
                        }
                        style={{
                          ...botaoPaizinho,
                          textAlign: "left",
                          fontSize: "13px",
                          padding: "12px 14px",
                          border: selecionada
                            ? "1px solid #38bdf8"
                            : "1px solid #334155",
                          background: selecionada
                            ? "linear-gradient(135deg,#082f49,#155e75)"
                            : botaoPaizinho.background,
                          boxShadow: selecionada
                            ? "0 0 0 1px rgba(56,189,248,.35)"
                            : "none",
                        }}
                      >
                        {tarefa}
                      </button>
                    );
                  })}
                </div>

                <textarea
                  value={pedidoPaizinho}
                  onChange={(evento) =>
                    setPedidoPaizinho(evento.target.value)
                  }
                  placeholder="Ex.: Veja meus anúncios que não estão vendendo e descubra o motivo..."
                  rows={4}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    resize: "vertical",
                    minHeight: "96px",
                    marginBottom: "14px",
                    padding: "14px 16px",
                    borderRadius: "14px",
                    border: "1px solid #334155",
                    background: "#020617",
                    color: "#fff",
                    fontSize: "15px",
                    lineHeight: 1.5,
                    outline: "none",
                  }}
                />

                <button
                  type="button"
                  style={{
                    width: "100%",
                    border: "1px solid #38bdf8",
                    borderRadius: "14px",
                    padding: "16px 18px",
                    background:
                      "linear-gradient(135deg,#1d4ed8,#0891b2)",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 800,
                    fontSize: "16px",
                    textAlign: "center",
                  }}
                >
                  ▶ Deixa com o Paizinho
                </button>
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
