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

  function voltar() {
    setScreen?.("home");
  }

function abrirCatalogo(catalogo) {
  localStorage.setItem(
    "catalogoSelecionado",
    catalogo
  );

  setScreen(
    "buscaCatalogo"
  );
}

  function abrirImportadorCatalogos() {
    setScreen("importadorCatalogos");
  }

  return (
    <div style={cardStyle}>
      {/* CABEÇALHO */}

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems:
            "flex-start",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom:
            "26px",
        }}
      >
        <div>
          <h2
            style={{
              color:
                "#67e8f9",
              marginTop: 0,
              marginBottom:
                "8px",
            }}
          >
            📚 Catálogos Técnicos
          </h2>

          <p
            style={{
              color:
                "#cbd5e1",
              margin: 0,
              lineHeight:
                "1.6",
              maxWidth:
                "760px",
            }}
          >
            Consulte a Base
            Técnica PAIIA por
            fabricante e encontre
            informações,
            aplicações e códigos
            para seus anúncios.
          </p>
        </div>

        <button
          type="button"
          onClick={voltar}
          style={
            botaoVoltar
          }
        >
          ← Voltar
        </button>
      </div>

      <button
        type="button"
        onClick={abrirImportadorCatalogos}
        style={{
          width: "100%",
          marginBottom: "18px",
          padding: "16px 18px",
          borderRadius: "14px",
          border: "1px solid #0e7490",
          background:
            "linear-gradient(135deg,#0f766e,#155e75)",
          color: "#ffffff",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div
          style={{
            fontWeight: 800,
            marginBottom: "4px",
          }}
        >
          📥 Importar Catálogo Técnico
        </div>
        <div
          style={{
            fontSize: "13px",
            color: "#cffafe",
          }}
        >
          📄 Importar PDF — extração bruta e interpretação
        </div>
      </button>

      {/* CATÁLOGOS */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(180px,1fr))",
          gap: "14px",
        }}
      >
        {catalogos.map(
          (catalogo) => (
            <button
              key={
                catalogo
              }
              type="button"
              onClick={() =>
                abrirCatalogo(
                  catalogo
                )
              }
              style={
                botaoCatalogo
              }
            >
              <span
                style={{
                  fontSize:
                    "20px",
                  marginBottom:
                    "7px",
                }}
              >
                {catalogo ===
                "CatCar"
                  ? "🌐"
                  : "📘"}
              </span>

              <strong>
                {catalogo}
              </strong>

              <span
                style={{
                  marginTop:
                    "5px",
                  color:
                    "#94a3b8",
                  fontSize:
                    "12px",
                }}
              >
                {catalogo ===
                "CatCar"
                  ? "Consulta técnica"
                  : "Pesquisar catálogo"}
              </span>
            </button>
          )
        )}
      </div>
    </div>
  );
}

const botaoCatalogo = {
  minHeight: "105px",
  padding: "16px",
  borderRadius: "14px",
  border:
    "1px solid #1e40af",
  background:
    "linear-gradient(180deg,#0f172a,#020617)",
  color: "#ffffff",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent:
    "center",
  cursor: "pointer",
  textAlign: "center",
  boxShadow:
    "0 8px 20px rgba(2,6,23,.25)",
};

const botaoVoltar = {
  padding:
    "11px 18px",
  borderRadius:
    "12px",
  border:
    "1px solid #334155",
  background:
    "#0f172a",
  color:
    "#ffffff",
  fontWeight: 700,
  cursor:
    "pointer",
  whiteSpace:
    "nowrap",
};