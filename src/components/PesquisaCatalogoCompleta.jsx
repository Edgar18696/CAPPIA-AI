import { useState } from "react";
import identificarCatalogo from "../services/catalogos/identificarCatalogo";
import { pesquisarCatalogoUniversal } from "../services/catalogos/pesquisarCatalogoUniversal";

export default function PesquisaCatalogoCompleta({
  cardStyle,
  setScreen,
}) {
  const [codigoPesquisa, setCodigoPesquisa] =
    useState("");

  const [processando, setProcessando] =
    useState(false);

  const [progresso, setProgresso] =
    useState("");

  const [resultado, setResultado] =
    useState(null);

  const [erro, setErro] =
    useState("");

  const [
    fabricanteSelecionado,
    setFabricanteSelecionado,
  ] = useState("todos");

  const fabricantesPesquisa = [
    "todos",
    "bosch",
    "magneti_marelli",
    "renault",
    "fiat",
    "gm",
    "volkswagen",
    "delphi",
    "ngk",
    "denso",
    "catcar",
  ];

  const nomesFabricantes = {
    todos: "🌎 Todos",
    bosch: "🔵 Bosch",
    magneti_marelli:
      "🟢 Magneti Marelli",
    renault: "🟡 Renault",
    fiat: "🔴 Fiat",
    gm: "⚫ GM",
    volkswagen: "🔷 Volkswagen",
    delphi: "🟠 Delphi",
    ngk: "🟣 NGK",
    denso: "⚪ Denso",
    catcar: "🚘 CatCar",
  };

  async function pesquisarCatalogo() {
    const codigoFinal = String(
      codigoPesquisa || ""
    )
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .trim();

    const catalogo =
      identificarCatalogo(codigoFinal);

    console.log(
      "Catálogo identificado:",
      catalogo
    );

    if (!codigoFinal) {
      setErro(
        "Informe um código, OEM ou equivalente."
      );
      return;
    }

    try {
      setProcessando(true);
      setResultado(null);
      setErro("");

      setProgresso(
        `🔎 Localizando informações para ${codigoFinal}...`
      );

      const resposta =
        await pesquisarCatalogoUniversal({
          codigo: codigoFinal,
          fabricante:
            fabricanteSelecionado,
          onProgresso:
            setProgresso,
        });

      setResultado(resposta);

      setProgresso(
        `✅ Pesquisa concluída: ${
          resposta?.quantidade ||
          resposta?.registros?.length ||
          0
        } registro(s) encontrado(s).`
      );
    } catch (erroPesquisa) {
      console.error(
        "Erro ao pesquisar catálogo:",
        erroPesquisa
      );

      setErro(
        erroPesquisa instanceof Error
          ? erroPesquisa.message
          : "Erro ao pesquisar catálogo."
      );

      setProgresso("");
    } finally {
      setProcessando(false);
    }
  }

  async function copiarCodigo() {
    const codigo =
      resultado?.registros?.[0]
        ?.codigo_oem || "";

    if (!codigo) {
      alert(
        "Código não encontrado."
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(
        codigo
      );

      alert(
        `Código ${codigo} copiado com sucesso.`
      );
    } catch (erroCopia) {
      console.error(
        "Erro ao copiar código:",
        erroCopia
      );

      alert(
        "Não foi possível copiar o código."
      );
    }
  }

  function usarNoNovoAnuncio() {
    const peca =
      resultado?.registros?.[0];

    if (!peca) {
      alert(
        "Nenhuma peça encontrada."
      );
      return;
    }

    localStorage.setItem(
      "usarDadosCatalogoNoAnuncio",
      "true"
    );

    localStorage.setItem(
      "novoAnuncioTemporario",
      JSON.stringify({
        codigo:
          peca.codigo_oem || "",

        oem:
          peca.codigo_equivalente ||
          "",

        titulo:
          peca.titulo || "",

        descricao:
          peca.descricao || "",

        preco: "",

        tipoAnuncio:
          "classico",

        pecaEncontrada: {
          ...peca,
        },

        diagnostico:
          peca.diagnostico || null,

        auditoria:
          peca.auditoria || null,

        baseMestre:
          peca.baseMestre || null,

        fotos: [],
      })
    );

    setScreen("novoAnuncio");
  }

  const registros =
    Array.isArray(
      resultado?.registros
    )
      ? resultado.registros
      : [];

  return (
    <div style={cardStyle}>
      <div
        style={{
          marginBottom: "24px",
          padding: "20px",
          borderRadius: "16px",
          background:
            "linear-gradient(135deg, #0f172a, #172554)",
          border:
            "1px solid #2563eb",
        }}
      >
        <h1
          style={{
            margin: 0,
            color: "#67e8f9",
            fontSize: "30px",
          }}
        >
          🔎 Centro de Pesquisa Automotiva
        </h1>

        <p
          style={{
            marginTop: "8px",
            marginBottom: 0,
            color: "#cbd5e1",
            lineHeight: 1.6,
          }}
        >
          Consulte códigos OEM,
          equivalentes e aplicações nos
          catálogos técnicos integrados
          ao APPIA AI.
          <br />
          A estrutura do CatCar fica
          disponível como fonte técnica
          para futura integração oficial.
        </p>

        <div
          style={{
            marginTop: "22px",
            color: "#94a3b8",
            fontSize: "14px",
          }}
        >
          🔎 Pesquisa técnica por Código /
          OEM
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            marginTop: "20px",
            marginBottom: "20px",
          }}
        >
          {fabricantesPesquisa.map(
            (fabricante) => {
              const selecionado =
                fabricanteSelecionado ===
                fabricante;

              return (
                <button
                  key={fabricante}
                  type="button"
                  onClick={() =>
                    setFabricanteSelecionado(
                      fabricante
                    )
                  }
                  style={{
                    padding:
                      "10px 16px",
                    borderRadius:
                      "999px",
                    border: selecionado
                      ? "1px solid #67e8f9"
                      : "1px solid #334155",
                    background:
                      selecionado
                        ? "#1e3a8a"
                        : "#0f172a",
                    color: selecionado
                      ? "#67e8f9"
                      : "#cbd5e1",
                    fontWeight:
                      "bold",
                    cursor:
                      "pointer",
                  }}
                >
                  {
                    nomesFabricantes[
                      fabricante
                    ]
                  }
                </button>
              );
            }
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            placeholder="Pesquisar código, OEM, equivalente ou descrição da peça..."
            value={codigoPesquisa}
            onChange={(evento) => {
              setCodigoPesquisa(
                evento.target.value
              );

              setErro("");
              setResultado(null);
            }}
            onKeyDown={(evento) => {
              if (
                evento.key ===
                  "Enter" &&
                !processando &&
                codigoPesquisa.trim()
              ) {
                pesquisarCatalogo();
              }
            }}
            disabled={processando}
            style={{
              flex: 1,
              minWidth: "280px",
              padding: "14px",
              borderRadius: "10px",
              border:
                "1px solid #334155",
              background: "#0f172a",
              color: "#ffffff",
              fontSize: "16px",
            }}
          />

          <button
            type="button"
            disabled={
              processando ||
              !codigoPesquisa.trim()
            }
            onClick={pesquisarCatalogo}
            style={{
              padding: "14px 18px",
              borderRadius: "10px",
              border:
                "1px solid #2563eb",
              background:
                processando ||
                !codigoPesquisa.trim()
                  ? "#334155"
                  : "#1d4ed8",
              color: "#ffffff",
              fontWeight: 700,
              cursor:
                processando ||
                !codigoPesquisa.trim()
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {processando
              ? "🔄 Pesquisando..."
              : "🔍 Consultar Catálogo"}
          </button>
        </div>
      </div>

      {progresso && (
        <div
          style={{
            marginTop: "20px",
            padding: "14px",
            borderRadius: "10px",
            background: "#0f172a",
            border:
              "1px solid #334155",
            color: "#e2e8f0",
          }}
        >
          <strong>
            {progresso}
          </strong>
        </div>
      )}

      {erro && (
        <div
          style={{
            marginTop: "20px",
            padding: "14px",
            borderRadius: "10px",
            background: "#450a0a",
            border:
              "1px solid #dc2626",
            color: "#fecaca",
          }}
        >
          ❌ {erro}
        </div>
      )}

      {resultado && (
        <div
          style={{
            marginTop: "20px",
            padding: "20px",
            borderRadius: "14px",
            background: "#052e16",
            border:
              "1px solid #22c55e",
          }}
        >
          <h3
            style={{
              marginTop: 0,
              color: "#86efac",
            }}
          >
            ✅ Pesquisa concluída
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
            }}
          >
            <CardResultado
              titulo="Fabricante"
              valor={
                resultado.fabricante ||
                "Identificado automaticamente"
              }
            />

            <CardResultado
              titulo="Encontrados"
              valor={
                resultado.encontrados ||
                resultado.quantidade ||
                registros.length ||
                0
              }
            />

            <CardResultado
              titulo="Únicos"
              valor={
                resultado.unicos ||
                resultado.quantidade ||
                registros.length ||
                0
              }
            />

            <CardResultado
              titulo="Gravados"
              valor={
                resultado.gravados ||
                resultado.resultado
                  ?.gravados ||
                resultado.quantidade ||
                registros.length ||
                0
              }
            />
          </div>

          {registros.length > 0 && (
            <>
              <div
                style={{
                  marginTop: "20px",
                  padding: "18px",
                  borderRadius: "12px",
                  background: "#0f172a",
                  border:
                    "1px solid #2563eb",
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    color: "#67e8f9",
                  }}
                >
                  🔍{" "}
                  {registros[0].peca ||
                    "Peça encontrada"}
                </h2>

                <div
                  style={{
                    marginTop: "12px",
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit,minmax(220px,1fr))",
                    gap: "12px",
                  }}
                >
                  <div>
                    <b>
                      Código Fabricante
                    </b>
                    <br />
                    {registros[0]
                      .codigo_oem || "-"}
                  </div>

                  <div>
                    <b>Fabricante</b>
                    <br />
                    {registros[0]
                      .fabricante || "-"}
                  </div>

                  <div>
                    <b>Catálogo</b>
                    <br />
                    {registros[0]
                      .origem_catalogo ||
                      "Base APPIA AI"}
                  </div>

                  <div>
                    <b>Aplicações</b>
                    <br />
                    {registros.length}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "10px",
                    marginTop: "18px",
                  }}
                >
                  <button
                    type="button"
                    onClick={copiarCodigo}
                    style={buttonBlue}
                  >
                    📋 Copiar Código
                  </button>

                  <button
                    type="button"
                    onClick={
                      usarNoNovoAnuncio
                    }
                    style={buttonGreen}
                  >
                    🚀 Usar no Novo Anúncio
                  </button>
                </div>
              </div>

              <div
                style={{
                  marginTop: "20px",
                  marginBottom: "20px",
                  padding: "16px",
                  borderRadius: "12px",
                  background: "#0f172a",
                  border:
                    "1px solid #2563eb",
                }}
              >
                <h3
                  style={{
                    marginTop: 0,
                    color: "#67e8f9",
                  }}
                >
                  📖 Fonte da Pesquisa
                </h3>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit,minmax(220px,1fr))",
                    gap: "12px",
                    color: "#cbd5e1",
                  }}
                >
                  <div>
                    <b>Origem</b>
                    <br />
                    {resultado.origem ||
                      "Base APPIA AI"}
                  </div>

                  <div>
                    <b>
                      Registros encontrados
                    </b>
                    <br />
                    {resultado.quantidade ||
                      registros.length ||
                      0}
                  </div>

                  <div>
                    <b>
                      Fabricante pesquisado
                    </b>
                    <br />
                    {fabricanteSelecionado ===
                    "todos"
                      ? "Todos os fabricantes"
                      : nomesFabricantes[
                          fabricanteSelecionado
                        ] ||
                        fabricanteSelecionado}
                  </div>
                </div>
              </div>

              <h3
                style={{
                  color: "#67e8f9",
                }}
              >
                📚 Aplicações encontradas
              </h3>

              <div>
                {registros.map(
                  (item, index) => (
                    <div
                      key={
                        item.id ||
                        `${item.codigo_oem}-${index}`
                      }
                      style={{
                        marginBottom:
                          "14px",
                        padding: "16px",
                        borderRadius:
                          "12px",
                        background:
                          "#0f172a",
                        border:
                          "1px solid #334155",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          alignItems:
                            "center",
                          gap: "15px",
                          flexWrap:
                            "wrap",
                          marginBottom:
                            "14px",
                          paddingBottom:
                            "12px",
                          borderBottom:
                            "1px solid #334155",
                        }}
                      >
                        <div>
                          <h3
                            style={{
                              margin: 0,
                              color:
                                "#67e8f9",
                              fontSize:
                                "22px",
                            }}
                          >
                            🚗{" "}
                            {item.montadora ||
                              "Montadora"}
                          </h3>

                          <div
                            style={{
                              marginTop:
                                "5px",
                              color:
                                "#cbd5e1",
                              fontWeight:
                                600,
                            }}
                          >
                            {item.modelo ||
                              "Modelo não informado"}
                          </div>
                        </div>

                        <div
                          style={{
                            padding:
                              "6px 12px",
                            borderRadius:
                              "999px",
                            background:
                              "#1e3a8a",
                            color:
                              "#dbeafe",
                            fontWeight:
                              "bold",
                          }}
                        >
                          📅{" "}
                          {item.ano_inicio ||
                            "?"}
                          {item.ano_fim
                            ? ` - ${item.ano_fim}`
                            : ""}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: "10px",
                          color:
                            "#cbd5e1",
                        }}
                      >
                        <div>
                          <b>Peça:</b>{" "}
                          {item.peca ||
                            "-"}
                        </div>

                        <div>
                          <b>
                            Código Fabricante:
                          </b>{" "}
                          {item.codigo_oem ||
                            "-"}
                        </div>

                        <div>
                          <b>
                            Fabricante:
                          </b>{" "}
                          {item.fabricante ||
                            "-"}
                        </div>

                        <div>
                          <b>Motor:</b>{" "}
                          {item.motor ||
                            "-"}
                        </div>

                        <div>
                          <b>Catálogo:</b>{" "}
                          {item.origem_catalogo ||
                            "APPIA AI"}
                        </div>

                        <div>
                          <b>Período:</b>{" "}
                          {item.ano_inicio ||
                            "?"}
                          {item.ano_fim
                            ? ` até ${item.ano_fim}`
                            : ""}
                        </div>
                      </div>

                      {item.codigo_equivalente && (
                        <div
                          style={{
                            marginTop:
                              "12px",
                            padding:
                              "10px",
                            borderRadius:
                              "8px",
                            background:
                              "#020617",
                            color:
                              "#94a3b8",
                            fontSize:
                              "13px",
                          }}
                        >
                          <b
                            style={{
                              color:
                                "#67e8f9",
                            }}
                          >
                            Equivalências:
                          </b>{" "}
                          {
                            item.codigo_equivalente
                          }
                        </div>
                      )}

                      {item.observacao && (
                        <div
                          style={{
                            marginTop:
                              "10px",
                            color:
                              "#94a3b8",
                            fontSize:
                              "13px",
                          }}
                        >
                          <b>
                            Observação:
                          </b>{" "}
                          {
                            item.observacao
                          }
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            </>
          )}

          {registros.length === 0 && (
            <div
              style={{
                marginTop: "18px",
                padding: "16px",
                borderRadius: "10px",
                background: "#0f172a",
                border:
                  "1px solid #334155",
                color: "#cbd5e1",
              }}
            >
              Nenhum registro encontrado
              para esta pesquisa.
            </div>
          )}

          <details
            style={{
              marginTop: "18px",
              padding: "14px",
              borderRadius: "10px",
              background: "#020617",
              border:
                "1px solid #334155",
            }}
          >
            <summary
              style={{
                cursor: "pointer",
                color: "#67e8f9",
                fontWeight: 700,
              }}
            >
              📋 Ver resultado técnico
            </summary>

            <pre
              style={{
                marginTop: "12px",
                padding: "14px",
                borderRadius: "10px",
                overflowX: "auto",
                background: "#020617",
                color: "#cbd5e1",
                whiteSpace: "pre-wrap",
              }}
            >
              {JSON.stringify(
                resultado,
                null,
                2
              )}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

const buttonBlue = {
  padding: "10px 16px",
  borderRadius: "10px",
  border: "none",
  background: "#2563eb",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: "600",
};

const buttonGreen = {
  ...buttonBlue,
  background: "#16a34a",
};

function CardResultado({
  titulo,
  valor,
}) {
  return (
    <div
      style={{
        padding: "14px",
        borderRadius: "10px",
        background: "#0f172a",
        border:
          "1px solid #334155",
      }}
    >
      <div
        style={{
          marginBottom: "6px",
          color: "#94a3b8",
          fontSize: "13px",
        }}
      >
        {titulo}
      </div>

      <strong
        style={{
          color: "#f8fafc",
          fontSize: "18px",
        }}
      >
        {valor}
      </strong>
    </div>
  );
}