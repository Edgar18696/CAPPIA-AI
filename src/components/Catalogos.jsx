export default function Catalogos({
  setScreen,
  cardStyle,
}) {
  const catalogos = [
    "CatCar",
    "Bosch",
    "Renault",
    "Fiat",
    "Magneti Marelli",
    "Volkswagen",
    "GM",
    "Ford",
    "Hyundai",
    "Peugeot",
    "Citroën",
    "Honda",
    "Toyota",
    "Nissan",
    "Mitsubishi",
    "Mercedes",
    "BMW",
    "Audi",
    "Volvo",
    "Kia",
    "Delphi",
    "NGK",
    "Denso",
  ];

  function abrirCatalogo(catalogo) {
    if (catalogo === "CatCar") {
      window.open(
        "https://www.catcar.info/",
        "_blank",
        "noopener,noreferrer"
      );

      return;
    }

    localStorage.setItem(
      "catalogoSelecionado",
      catalogo
    );

    setScreen("buscaCatalogo");
  }

  function abrirImportadorCatalogos() {
    setScreen("catalogo");
  }

  return (
    <div style={cardStyle}>
      <h2
        style={{
          color: "#67e8f9",
          marginBottom: "10px",
        }}
      >
        📚 Central de Catálogos
      </h2>

      <p
        style={{
          color: "#cbd5e1",
          marginBottom: "25px",
          lineHeight: "1.6",
        }}
      >
        Consulte códigos OEM, equivalentes,
        aplicações, montadoras, modelos,
        motores e informações técnicas dos
        catálogos disponíveis no APPIA AI.
      </p>

      {/* =====================================================
          IMPORTAR CATÁLOGO
      ===================================================== */}

      <button
        type="button"
        onClick={
          abrirImportadorCatalogos
        }
        style={{
          width: "100%",
          marginBottom: "28px",
          padding: "22px",
          borderRadius: "16px",
          border:
            "1px solid #22d3ee",
          background:
            "linear-gradient(135deg,#0f172a,#172554)",
          color: "#ffffff",
          cursor: "pointer",
          textAlign: "left",
          boxShadow:
            "0 12px 32px rgba(37,99,235,.15)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                color: "#67e8f9",
                fontSize: "22px",
                fontWeight: "bold",
                marginBottom: "8px",
              }}
            >
              📥 Importar Catálogo Técnico
            </div>

            <div
              style={{
                color: "#cbd5e1",
                fontSize: "14px",
                lineHeight: "1.5",
              }}
            >
              Adicione novos catálogos PDF
              à Base Técnica APPIA.
              Bosch, Magneti Marelli,
              Renault/Motrio, NGK, Denso
              e outros fabricantes.
            </div>
          </div>

          <div
            style={{
              padding: "10px 16px",
              borderRadius: "999px",
              background:
                "rgba(34,211,238,.12)",
              border:
                "1px solid rgba(103,232,249,.35)",
              color: "#67e8f9",
              fontSize: "13px",
              fontWeight: "bold",
              whiteSpace: "nowrap",
            }}
          >
            📄 Importar PDF
          </div>
        </div>
      </button>

      {/* =====================================================
          CATÁLOGOS DISPONÍVEIS
      ===================================================== */}

      <div
        style={{
          marginBottom: "14px",
          color: "#94a3b8",
          fontSize: "13px",
          fontWeight: "bold",
          textAlign: "left",
        }}
      >
        CATÁLOGOS DISPONÍVEIS
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "14px",
        }}
      >
        {catalogos.map(
          (catalogo) => {
            const ehCatCar =
              catalogo === "CatCar";

            return (
              <button
                key={catalogo}
                type="button"
                onClick={() =>
                  abrirCatalogo(
                    catalogo
                  )
                }
                style={{
                  ...botaoCatalogo,

                  background:
                    ehCatCar
                      ? "linear-gradient(135deg,#0f172a,#164e63)"
                      : "#0f172a",

                  border:
                    ehCatCar
                      ? "1px solid #22d3ee"
                      : "1px solid #2563eb",

                  boxShadow:
                    ehCatCar
                      ? "0 10px 28px rgba(34,211,238,.12)"
                      : "none",
                }}
              >
                <div
                  style={{
                    fontSize: "20px",
                    marginBottom: "8px",
                  }}
                >
                  {ehCatCar
                    ? "🚘 CatCar"
                    : `📘 ${catalogo}`}
                </div>

                <div
                  style={{
                    color: ehCatCar
                      ? "#cffafe"
                      : "#94a3b8",

                    fontSize: "13px",
                    fontWeight:
                      "normal",

                    lineHeight: "1.4",
                  }}
                >
                  {ehCatCar
                    ? "Catálogo técnico auxiliar com OEM, diagramas e identificação por veículo."
                    : "Consultar códigos, aplicações e equivalências."}
                </div>

                {ehCatCar && (
                  <div
                    style={{
                      marginTop:
                        "12px",

                      display:
                        "inline-block",

                      padding:
                        "5px 9px",

                      borderRadius:
                        "999px",

                      background:
                        "rgba(34,211,238,.12)",

                      border:
                        "1px solid rgba(103,232,249,.35)",

                      color:
                        "#67e8f9",

                      fontSize:
                        "11px",

                      fontWeight:
                        "bold",
                    }}
                  >
                    🔗 Abrir CatCar
                  </div>
                )}
              </button>
            );
          }
        )}
      </div>
    </div>
  );
}

const botaoCatalogo = {
  padding: "18px",

  borderRadius: "14px",

  background: "#0f172a",

  color: "#67e8f9",

  border:
    "1px solid #2563eb",

  fontSize: "17px",

  fontWeight: "bold",

  cursor: "pointer",

  textAlign: "left",

  transition: "0.2s",

  width: "100%",
};