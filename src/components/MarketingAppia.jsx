import {
  useState,
} from "react";

export default function MarketingAppia({
  setScreen,
}) {
  const [
    campanha,
    setCampanha,
  ] = useState(
    "codigo-anuncio"
  );

  const campanhas = [
  {
    id: "codigo-anuncio",

    titulo:
      "🚀 Do Código ao Anúncio",

    descricao:
      "Mostre como o PAIIA transforma o código de uma peça em um anúncio profissional em poucos passos.",

    roteiro:
      "Casa da Injeção, referência em peças automotivas e distribuidora Torken no Brasil. Qualidade e pronta entrega. Comprou, chegou!",

    chamada:
      "DO CÓDIGO AO ANÚNCIO EM UM SÓ CLIQUE",
  },
    {
      id: "apresentacao",
      titulo:
        "🤖 Apresentação PAIIA",
      descricao:
        "Apresente o PAIIA e seus principais benefícios com o Paizinho.",
      roteiro:
        "Com o PAIIA, seu anúncio trabalha melhor por você. Inteligência artificial para criar, divulgar e vender mais. PAIIA AI. Transformando imagens em vendas.",
    },
    {
      id: "anuncios",
      titulo:
        "🚀 Criar Anúncios",
      descricao:
        "Mostre como o PAIIA ajuda a transformar uma peça em um anúncio profissional.",
      roteiro:
        "Crie anúncios melhores com o PAIIA. Títulos estratégicos, palavras-chave, aplicações, análise de preços e inteligência para deixar seus produtos mais competitivos.",
    },
    {
      id: "foto",
      titulo:
        "📸 Foto IA",
      descricao:
        "Divulgação do recurso de fotos profissionais para autopeças.",
      roteiro:
        "Transforme fotos comuns em imagens profissionais para seus anúncios. Com o Foto IA do PAIIA, seu produto ganha apresentação de alto nível em poucos segundos.",
    },
    {
      id: "banner",
      titulo:
        "⚡ Banner Express",
      descricao:
        "Divulgação da criação automática de banners profissionais.",
      roteiro:
        "Escolha a foto, o logo e a sua campanha. O Banner Express do PAIIA cria uma arte profissional pronta para divulgar seu produto nas redes sociais.",
    },
    {
      id: "clip",
      titulo:
        "🎬 Clip IA",
      descricao:
        "Mostre a criação rápida de vídeos profissionais.",
      roteiro:
        "Transforme suas fotos em vídeos profissionais para divulgar seus produtos. Com o Clip IA do PAIIA, criar conteúdo ficou muito mais rápido.",
    },
  ];

  const campanhaAtual =
    campanhas.find(
      (item) =>
        item.id === campanha
    ) ||
    campanhas[0];

  return (
    <div
      style={{
        minHeight:
          "100vh",
        background:
          "#020617",
        padding:
          "24px",
        color:
          "#ffffff",
      }}
    >
      <div
        style={{
          maxWidth:
            "1200px",
          margin:
            "0 auto",
        }}
      >
        <div
          style={{
            display:
              "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap:
              "16px",
            flexWrap:
              "wrap",
            marginBottom:
              "28px",
          }}
        >
          <div>
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
              ADMINISTRADOR
            </div>

            <h1
              style={{
                margin:
                  "6px 0 0",
              }}
            >
              📢 Marketing PAIIA
            </h1>

            <p
              style={{
                color:
                  "#94a3b8",
                marginBottom:
                  0,
              }}
            >
              Central interna para criação de campanhas e divulgação do PAIIA.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setScreen?.(
                "administrador"
              )
            }
            style={
              botaoSecundario
            }
          >
            ← Voltar
          </button>
        </div>

        <div
          style={{
            display:
              "grid",
            gridTemplateColumns:
              "minmax(280px,360px) minmax(400px,1fr)",
            gap:
              "22px",
            alignItems:
              "start",
          }}
        >
          <aside
            style={
              painel
            }
          >
            <h3
              style={{
                color:
                  "#67e8f9",
                marginTop:
                  0,
              }}
            >
              Campanhas
            </h3>

            <div
              style={{
                display:
                  "grid",
                gap:
                  "10px",
              }}
            >
              {campanhas.map(
                (item) => (
                  <button
                    key={
                      item.id
                    }
                    type="button"
                    onClick={() =>
                      setCampanha(
                        item.id
                      )
                    }
                    style={{
                      textAlign:
                        "left",
                      padding:
                        "15px",
                      borderRadius:
                        "14px",
                      cursor:
                        "pointer",
                      background:
                        campanha ===
                        item.id
                          ? "linear-gradient(135deg,#0e7490,#2563eb)"
                          : "#0f172a",
                      border:
                        campanha ===
                        item.id
                          ? "1px solid #67e8f9"
                          : "1px solid #334155",
                      color:
                        "#ffffff",
                    }}
                  >
                    <strong>
                      {
                        item.titulo
                      }
                    </strong>

                    <div
                      style={{
                        color:
                          "#cbd5e1",
                        fontSize:
                          "12px",
                        lineHeight:
                          1.45,
                        marginTop:
                          "6px",
                      }}
                    >
                      {
                        item.descricao
                      }
                    </div>
                  </button>
                )
              )}
            </div>
          </aside>

          <main
            style={
              painel
            }
          >
            <div
              style={{
                display:
                  "grid",
                gridTemplateColumns:
                  "220px minmax(0,1fr)",
                gap:
                  "22px",
                alignItems:
                  "center",
              }}
            >
              <div
                style={{
                  minHeight:
                    "290px",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  borderRadius:
                    "20px",
                  background:
                    "linear-gradient(145deg,#07152d,#082f49)",
                  border:
                    "1px solid rgba(103,232,249,.35)",
                  overflow:
                    "hidden",
                }}
              >
                <img
                  src="/campanha-torken.png"
                  alt="Paizinho PAIIA"
                  style={{
                    width:
                      "100%",
                    height:
                      "100%",
                    maxHeight:
                      "330px",
                    objectFit:
                      "cover",
                    objectPosition:
                      "center top",
                  }}
                />
              </div>

              <div>
                <div
                  style={{
                    color:
                      "#67e8f9",
                    fontSize:
                      "12px",
                    fontWeight:
                      900,
                    marginBottom:
                      "8px",
                  }}
                >
                  CAMPANHA SELECIONADA
                </div>

                <h2
                  style={{
                    margin:
                      "0 0 10px",
                  }}
                >
                  {
                    campanhaAtual.titulo
                  }
                </h2>

                <p
                  style={{
                    color:
                      "#cbd5e1",
                    lineHeight:
                      1.55,
                  }}
                >
                  {
                    campanhaAtual.descricao
                  }
                </p>

                {campanhaAtual.chamada && (
                  <div
                    style={{
                      marginTop:
                        "18px",
                      padding:
                        "16px",
                      borderRadius:
                        "14px",
                      background:
                        "linear-gradient(135deg,rgba(37,99,235,.20),rgba(34,211,238,.10))",
                      border:
                        "1px solid rgba(103,232,249,.35)",
                      color:
                        "#ffffff",
                      fontWeight:
                        900,
                      fontSize:
                        "18px",
                      lineHeight:
                        1.35,
                    }}
                  >
                    {campanhaAtual.chamada}
                  </div>
                )}

                <div
                  style={{
                    marginTop:
                      "18px",
                    padding:
                      "16px",
                    borderRadius:
                      "14px",
                    background:
                      "#020617",
                    border:
                      "1px solid #334155",
                  }}
                >
                  <strong
                    style={{
                      color:
                        "#67e8f9",
                    }}
                  >
                    🎙️ Roteiro
                  </strong>

                  <p
                    style={{
                      margin:
                        "9px 0 0",
                      color:
                        "#e2e8f0",
                      lineHeight:
                        1.65,
                    }}
                  >
                    “
                    {
                      campanhaAtual.roteiro
                    }
                    ”
                  </p>
                </div>

                <div
                  style={{
                    display:
                      "flex",
                    gap:
                      "10px",
                    flexWrap:
                      "wrap",
                    marginTop:
                      "18px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem(
                        "campanhaMarketingAppia",
                        JSON.stringify(
                          campanhaAtual
                        )
                      );
                      localStorage.setItem(
                        "abrirPaizinhoMarketing",
                        "true"
                      );
                      setScreen?.(
                        "clipIA"
                      );
                    }}
                    style={
                      botaoPrincipal
                    }
                  >
                    🤖 Criar Clip do Paizinho
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setScreen?.(
                        "bannerStudio"
                      )
                    }
                    style={
                      botaoSecundario
                    }
                  >
                    ⚡ Criar Banner
                  </button>
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop:
                  "24px",
                padding:
                  "16px",
                borderRadius:
                  "14px",
                background:
                  "rgba(8,145,178,.08)",
                border:
                  "1px solid rgba(34,211,238,.22)",
                color:
                  "#bae6fd",
                lineHeight:
                  1.55,
              }}
            >
              🔒 Área interna PAIIA. Esta central é destinada somente à administração e à divulgação da própria plataforma.
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

const painel = {
  background:
    "#0f172a",
  border:
    "1px solid #334155",
  borderRadius:
    "18px",
  padding:
    "20px",
  boxShadow:
    "0 18px 45px rgba(0,0,0,.20)",
};

const botaoPrincipal = {
  border:
    "none",
  borderRadius:
    "12px",
  padding:
    "13px 18px",
  background:
    "linear-gradient(135deg,#2563eb,#22d3ee)",
  color:
    "#ffffff",
  fontWeight:
    900,
  cursor:
    "pointer",
};

const botaoSecundario = {
  border:
    "1px solid #334155",
  borderRadius:
    "12px",
  padding:
    "12px 17px",
  background:
    "#020617",
  color:
    "#e2e8f0",
  fontWeight:
    800,
  cursor:
    "pointer",
};