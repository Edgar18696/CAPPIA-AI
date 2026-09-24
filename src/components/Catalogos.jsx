import { useState } from "react";
import CatalogosOnline from "./CatalogosOnline";

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

  const [abaCatalogos, setAbaCatalogos] = useState("existentes");

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

      {/* ABAS: Catálogos já existentes / Catálogos Online */}

      <div style={barraAbas} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={abaCatalogos === "existentes"}
          onClick={() => setAbaCatalogos("existentes")}
          style={botaoAba(abaCatalogos === "existentes")}
        >
          📘 Catálogos já existentes
          <span style={subtituloAba}>Base interna PAIIA (importados)</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={abaCatalogos === "online"}
          onClick={() => setAbaCatalogos("online")}
          style={botaoAba(abaCatalogos === "online")}
        >
          🌐 Catálogos Online
          <span style={subtituloAba}>Sites externos dos fabricantes</span>
        </button>
      </div>

      {abaCatalogos === "online" && (
        <CatalogosOnline
          onVoltarCentral={() => setAbaCatalogos("existentes")}
        />
      )}

      {abaCatalogos === "existentes" && (
      <>
      <div style={avisoBaseInterna}>
        📘 <strong>Base interna PAIIA</strong> — catálogos já importados
        (códigos, aplicações e equivalências pesquisados dentro do PAIIA).
        Para abrir os sites oficiais dos fabricantes, use a aba{" "}
        <em>🌐 Catálogos Online</em>.
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
      </>
      )}
    </div>
  );
}

const barraAbas = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  marginBottom: "20px",
};

const subtituloAba = {
  display: "block",
  marginTop: "3px",
  fontSize: "11px",
  fontWeight: 500,
  color: "#cbd5e1",
};

const avisoBaseInterna = {
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #1e40af",
  background: "rgba(30,64,175,.18)",
  color: "#dbeafe",
  fontSize: "13px",
  lineHeight: 1.5,
  marginBottom: "16px",
  textAlign: "left",
};

function botaoAba(ativa) {
  return {
    padding: "11px 18px",
    borderRadius: "12px",
    border: `1px solid ${ativa ? "#22d3ee" : "#334155"}`,
    background: ativa
      ? "linear-gradient(135deg,#0e7490,#1e40af)"
      : "#0f172a",
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
    textAlign: "left",
  };
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