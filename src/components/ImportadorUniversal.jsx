import { useState } from "react";

import { pesquisarCatalogoUniversal } from "../services/catalogos/pesquisarCatalogoUniversal";

export default function ImportadorUniversal({
  cardStyle,
  setScreen,
}) {
  const [
    codigoPesquisa,
    setCodigoPesquisa,
  ] = useState("");

  const [
    chassiPesquisa,
    setChassiPesquisa,
  ] = useState("");

  const [
    consultando,
    setConsultando,
  ] = useState(false);

  const [
    resultadoPesquisa,
    setResultadoPesquisa,
  ] = useState(null);

  const [
    mensagemChassi,
    setMensagemChassi,
  ] = useState("");

  const [
    erro,
    setErro,
  ] = useState("");

  function normalizarChassi(
    valor = ""
  ) {
    return String(valor || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function validarChassi(
    valor = ""
  ) {
    const chassi =
      normalizarChassi(valor);

    if (!chassi) {
      return {
        valido: false,
        mensagem:
          "Informe o número do chassi.",
      };
    }

    if (chassi.length !== 17) {
      return {
        valido: false,
        mensagem:
          "O chassi deve possuir 17 caracteres.",
      };
    }

    if (
      /[IOQ]/.test(chassi)
    ) {
      return {
        valido: false,
        mensagem:
          "O chassi informado contém caracteres inválidos.",
      };
    }

    return {
      valido: true,
      chassi,
    };
  }

  async function consultarCodigo() {
  const codigo =
    String(
      codigoPesquisa || ""
    )
      .trim()
      .toUpperCase();

  if (!codigo) {
    setErro(
      "Informe um código para consultar."
    );

    return;
  }

  try {
    setConsultando(true);

    setErro("");

    setResultadoPesquisa(null);

    const resposta =
      await pesquisarCatalogoUniversal(
        {
          codigo,
          fabricante: "todos",
        }
      );

    console.log(
      "🚨 RESPOSTA RECEBIDA NO IMPORTADOR:",
      resposta
    );

    console.table(
      Array.isArray(resposta?.registros)
        ? resposta.registros.map(
            (item) => ({
              codigo_oem:
                item?.codigo_oem,

              codigo_equivalente:
                item?.codigo_equivalente,

              fabricante:
                item?.fabricante,

              montadora:
                item?.montadora,

              modelo:
                item?.modelo,
            })
          )
        : []
    );

    setResultadoPesquisa(
      resposta
    );
  } catch (
    erroPesquisa
  ) {
    console.error(
      "Erro ao consultar código:",
      erroPesquisa
    );

    setErro(
      erroPesquisa instanceof Error
        ? erroPesquisa.message
        : "Erro ao consultar código."
    );
  } finally {
    setConsultando(false);
  }
}

  function consultarChassi() {
    setErro("");

    setMensagemChassi("");

    const validacao =
      validarChassi(
        chassiPesquisa
      );

    if (!validacao.valido) {
      setErro(
        validacao.mensagem
      );

      return;
    }

    setChassiPesquisa(
      validacao.chassi
    );

    setMensagemChassi(
      `🚗 Chassi ${validacao.chassi} validado. A consulta VIN está pronta para integração com a base de compatibilidade APPIA.`
    );
  }

  const registrosPesquisa =
    Array.isArray(
      resultadoPesquisa?.registros
    )
      ? resultadoPesquisa.registros
      : [];

  return (
    <div style={cardStyle}>
      {/* CABEÇALHO */}

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "22px",
        }}
      >
        <div
          style={{
            textAlign: "left",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "#67e8f9",
            }}
          >
            🚗 Consulta por Chassi e Código
          </h2>

          <div
            style={{
              marginTop: "6px",
              color: "#94a3b8",
              fontSize: "14px",
            }}
          >
            Consulte aplicações e
            compatibilidades pela Base
            APPIA.
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            setScreen("home")
          }
          style={
            botaoSecundario
          }
        >
          ← Voltar
        </button>
      </div>

      {/* CONSULTAR CÓDIGO */}

      <section
        style={{
          marginBottom: "24px",
          padding: "22px",
          borderRadius: "16px",
          background:
            "linear-gradient(135deg,#0f172a,#172554)",
          border:
            "1px solid #2563eb",
        }}
      >
        <h2
          style={{
            marginTop: 0,
            marginBottom: "8px",
            color: "#67e8f9",
            textAlign: "center",
          }}
        >
          🔎 Consultar Código
        </h2>

        <p
          style={{
            marginTop: 0,
            marginBottom: "18px",
            color: "#cbd5e1",
            textAlign: "center",
          }}
        >
          Consulte códigos OEM,
          equivalentes, Bosch, Marelli,
          Motrio e demais fabricantes.
        </p>

        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            value={
              codigoPesquisa
            }
            placeholder="Digite o código OEM ou equivalente..."
            onChange={(
              evento
            ) => {
              setCodigoPesquisa(
                evento.target.value
              );

              setResultadoPesquisa(
                null
              );

              setErro("");
            }}
            onKeyDown={(
              evento
            ) => {
              if (
                evento.key ===
                  "Enter" &&
                !consultando
              ) {
                consultarCodigo();
              }
            }}
            style={{
              ...campoStyle,
              flex: 1,
              minWidth: "260px",
            }}
          />

          <button
            type="button"
            onClick={
              consultarCodigo
            }
            disabled={
              consultando ||
              !codigoPesquisa.trim()
            }
            style={{
              ...botaoPrimario,

              background:
                consultando ||
                !codigoPesquisa.trim()
                  ? "#334155"
                  : "#1d4ed8",

              cursor:
                consultando ||
                !codigoPesquisa.trim()
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {consultando
              ? "⏳ Consultando..."
              : "🔎 Consultar Código"}
          </button>
        </div>

        {resultadoPesquisa && (
          <div
            style={{
              marginTop: "18px",
              padding: "16px",
              borderRadius: "12px",

              background:
                registrosPesquisa.length >
                0
                  ? "#052e16"
                  : "#422006",

              border:
                registrosPesquisa.length >
                0
                  ? "1px solid #22c55e"
                  : "1px solid #f59e0b",
            }}
          >
            <div
              style={{
                color:
                  registrosPesquisa.length >
                  0
                    ? "#86efac"
                    : "#fde68a",

                fontWeight:
                  "bold",

                fontSize:
                  "16px",
              }}
            >
              {registrosPesquisa.length >
              0
                ? `✅ ${registrosPesquisa.length} registro(s) encontrado(s).`
                : "⚠️ Código não encontrado na Base APPIA."}
            </div>

            {registrosPesquisa.length >
              0 && (
              <div
                style={{
                  marginTop:
                    "14px",

                  maxHeight:
                    "420px",

                  overflowY:
                    "auto",
                }}
              >
                {registrosPesquisa
                  .slice(0, 100)
                  .map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        key={
                          item.id ||
                          `${item.codigo_oem}-${index}`
                        }
                        style={{
                          marginBottom:
                            "10px",

                          padding:
                            "14px",

                          borderRadius:
                            "10px",

                          background:
                            "#0f172a",

                          border:
                            "1px solid #334155",

                          textAlign:
                            "left",
                        }}
                      >
                        <div
                          style={{
                            color:
                              "#67e8f9",

                            fontWeight:
                              "bold",

                            marginBottom:
                              "8px",
                          }}
                        >
                          {item.peca ||
                            "Peça automotiva"}
                        </div>

                        <div
                          style={{
                            display:
                              "grid",

                            gridTemplateColumns:
                              "repeat(auto-fit,minmax(180px,1fr))",

                            gap: "8px",

                            color:
                              "#cbd5e1",

                            fontSize:
                              "13px",
                          }}
                        >
                          <div>
                            <b>
                              Código:
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

                          {item.montadora && (
                            <div>
                              <b>
                                Montadora:
                              </b>{" "}
                              {
                                item.montadora
                              }
                            </div>
                          )}

                          {item.modelo && (
                            <div>
                              <b>
                                Modelo:
                              </b>{" "}
                              {
                                item.modelo
                              }
                            </div>
                          )}

                          {item.motor && (
                            <div>
                              <b>
                                Motor:
                              </b>{" "}
                              {
                                item.motor
                              }
                            </div>
                          )}

                          {(item.ano_inicio ||
                            item.ano_fim) && (
                            <div>
                              <b>
                                Período:
                              </b>{" "}
                              {item.ano_inicio ||
                                "?"}
                              {" até "}
                              {item.ano_fim ||
                                "Atual"}
                            </div>
                          )}
                        </div>

                        {item.codigo_equivalente && (
                          <div
                            style={{
                              marginTop:
                                "8px",

                              color:
                                "#94a3b8",

                              fontSize:
                                "13px",
                            }}
                          >
                            <b>
                              Equivalente:
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
                                "8px",

                              color:
                                "#94a3b8",

                              fontSize:
                                "12px",
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
            )}
          </div>
        )}
      </section>

      {/* CONSULTAR CHASSI */}

      <section
        style={{
          padding: "22px",
          borderRadius: "16px",

          background:
            "linear-gradient(135deg,#0f172a,#172554)",

          border:
            "1px solid #22d3ee",

          boxShadow:
            "0 12px 30px rgba(34,211,238,.08)",
        }}
      >
        <h2
          style={{
            marginTop: 0,
            marginBottom: "8px",
            color: "#67e8f9",
            textAlign: "center",
          }}
        >
          🚗 Consultar Chassi
        </h2>

        <p
          style={{
            marginTop: 0,
            marginBottom: "18px",
            color: "#cbd5e1",
            textAlign: "center",
          }}
        >
          Cole ou digite os 17
          caracteres do chassi / VIN.
        </p>

        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            value={
              chassiPesquisa
            }
            maxLength={17}
            placeholder="Cole ou digite o chassi..."
            onChange={(
              evento
            ) => {
              setChassiPesquisa(
                evento.target.value
                  .toUpperCase()
                  .replace(
                    /[^A-Z0-9]/g,
                    ""
                  )
              );

              setMensagemChassi(
                ""
              );

              setErro("");
            }}
            onKeyDown={(
              evento
            ) => {
              if (
                evento.key ===
                "Enter"
              ) {
                consultarChassi();
              }
            }}
            style={{
              ...campoStyle,
              flex: 1,
              minWidth: "260px",
              textTransform:
                "uppercase",
            }}
          />

          <button
            type="button"
            onClick={
              consultarChassi
            }
            disabled={
              !chassiPesquisa.trim()
            }
            style={{
              ...botaoPrimario,

              background:
                !chassiPesquisa.trim()
                  ? "#334155"
                  : "#0369a1",

              border:
                "1px solid #22d3ee",

              cursor:
                !chassiPesquisa.trim()
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            🚗 Consultar Chassi
          </button>
        </div>

        <div
          style={{
            marginTop: "8px",

            color:
              chassiPesquisa.length ===
              17
                ? "#86efac"
                : "#94a3b8",

            fontSize: "12px",

            textAlign: "left",
          }}
        >
          {chassiPesquisa.length}
          /17 caracteres
        </div>

        {mensagemChassi && (
          <div
            style={{
              marginTop: "18px",
              padding: "16px",
              borderRadius: "12px",
              background: "#082f49",
              border:
                "1px solid #0ea5e9",
              color: "#bae6fd",
              fontWeight: "bold",
            }}
          >
            {mensagemChassi}
          </div>
        )}
      </section>

      {/* ERRO */}

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
    </div>
  );
}

const campoStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "14px",
  borderRadius: "10px",
  border: "1px solid #334155",
  background: "#020617",
  color: "#ffffff",
  fontSize: "15px",
};

const botaoPrimario = {
  padding: "14px 22px",
  borderRadius: "10px",
  border: "1px solid #2563eb",
  background: "#1d4ed8",
  color: "#ffffff",
  fontWeight: "bold",
  fontSize: "15px",
  whiteSpace: "nowrap",
};

const botaoSecundario = {
  padding: "10px 16px",
  borderRadius: "10px",
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#cbd5e1",
  fontWeight: "bold",
  cursor: "pointer",
};