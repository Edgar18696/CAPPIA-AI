import { useState } from "react";
import { motorCopilotoIA } from "../services/motorCopilotoIA";

export default function CopilotoChat({
  parecerIA,
  codigo,
  oem,
  titulo,
  descricao,
  preco,
  custo,
  fotos,
  diagnostico,
  auditoria,
  pecaEncontrada,
  pontuacao,
}) {
  const [pergunta, setPergunta] =
    useState("");

  const [conversa, setConversa] =
    useState([
      {
        autor: "ia",
        texto:
          parecerIA?.texto ||
          "Olá! Sou o Copiloto IA do PAIIA. Como posso ajudar?",
        especialistas: {},
      },
    ]);

  const [carregando, setCarregando] =
    useState(false);

  async function enviarPergunta() {
    const perguntaUsuario =
      pergunta.trim();

    if (!perguntaUsuario) {
      return;
    }

    setConversa((anterior) => [
      ...anterior,
      {
        autor: "usuario",
        texto: perguntaUsuario,
        especialistas: {},
      },
    ]);

    setPergunta("");
    setCarregando(true);

    try {
      const resposta =
  await motorCopilotoIA({
    pergunta: perguntaUsuario,
    codigo,
    oem,
    titulo,
    descricao,
    preco,
    custo,
    fotos,
    diagnostico,
    auditoria,
    pecaEncontrada,
    pontuacao,
  });

      setConversa((anterior) => [
        ...anterior,
        {
          autor: "ia",
          texto:
            resposta?.resposta ||
            "Não foi possível concluir a análise.",

          especialistas:
            resposta?.especialistas ||
            {},
        },
      ]);
    } catch (erro) {
      console.error(
        "Erro no Copiloto IA:",
        erro
      );

      setConversa((anterior) => [
        ...anterior,
        {
          autor: "ia",
          texto:
            "Ocorreu um erro durante a análise do anúncio.",
          especialistas: {},
        },
      ]);
    } finally {
      setCarregando(false);
    }
  }

  function enviarComEnter(evento) {
    if (
      evento.key === "Enter" &&
      !evento.shiftKey
    ) {
      evento.preventDefault();
      enviarPergunta();
    }
  }

  return (
    <section
      style={{
        marginTop: "20px",
        padding: "18px",
        borderRadius: "16px",
        border:
          "1px solid #2563eb",
        background: "#020617",
      }}
    >
      <h3
        style={{
          color: "#67e8f9",
          marginTop: 0,
        }}
      >
        💬 Conversar com o Copiloto IA
      </h3>

      <p
        style={{
          color: "#94a3b8",
          fontSize: "13px",
          marginTop: "-4px",
          marginBottom: "15px",
        }}
      >
        Pergunte sobre preço,
        compatibilidade, título,
        qualidade ou publicação.
      </p>

      <div
        style={{
          maxHeight: "420px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {conversa.map(
          (msg, index) => {
            const usuario =
              msg.autor ===
              "usuario";

            return (
              <div
                key={index}
                style={{
                  alignSelf:
                    usuario
                      ? "flex-end"
                      : "stretch",

                  maxWidth:
                    usuario
                      ? "82%"
                      : "100%",

                  background:
                    usuario
                      ? "#2563eb"
                      : "#0f172a",

                  border:
                    usuario
                      ? "1px solid #3b82f6"
                      : "1px solid #334155",

                  color: "#ffffff",

                  padding:
                    "12px 14px",

                  borderRadius:
                    "14px",
                }}
              >
                <div
                  style={{
                    whiteSpace:
                      "pre-line",
                    lineHeight:
                      1.6,
                  }}
                >
                  {msg.texto}
                </div>

                {!usuario &&
                  msg.especialistas &&
                  Object.keys(
                    msg.especialistas
                  ).length > 0 && (
                    <div
                      style={{
                        display:
                          "grid",

                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(180px,1fr))",

                        gap:
                          "10px",

                        marginTop:
                          "14px",
                      }}
                    >
                      {Object.entries(
                        msg.especialistas
                      ).map(
                        ([
                          nome,
                          dados,
                        ]) => {
                          const status =
                            String(
                              dados?.status ||
                                "AGUARDANDO"
                            ).toUpperCase();

                          const aprovado =
                            status ===
                            "APROVADO";

                          const alerta =
                            status ===
                            "ALERTA";

                          const cor =
                            aprovado
                              ? "#22c55e"
                              : alerta
                                ? "#ef4444"
                                : "#f59e0b";

                          const fundo =
                            aprovado
                              ? "#052e16"
                              : alerta
                                ? "#450a0a"
                                : "#422006";

                          return (
                            <div
                              key={
                                nome
                              }
                              style={{
                                padding:
                                  "12px",

                                borderRadius:
                                  "12px",

                                border:
                                  `1px solid ${cor}`,

                                background:
                                  fundo,
                              }}
                            >
                              <div
                                style={{
                                  color:
                                    "#ffffff",

                                  fontWeight:
                                    "bold",

                                  textTransform:
                                    "capitalize",
                                }}
                              >
                                {
                                  nome
                                }
                              </div>

                              <div
                                style={{
                                  marginTop:
                                    "6px",

                                  fontSize:
                                    "12px",

                                  fontWeight:
                                    "bold",

                                  color:
                                    cor,
                                }}
                              >
                                {
                                  status
                                }
                              </div>

                              <div
                                style={{
                                  marginTop:
                                    "8px",

                                  color:
                                    "#cbd5e1",

                                  fontSize:
                                    "12px",

                                  lineHeight:
                                    1.45,
                                }}
                              >
                                {dados?.recomendacao ||
                                  "Sem recomendação."}
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  )}
              </div>
            );
          }
        )}

        {carregando && (
          <div
            style={{
              alignSelf:
                "flex-start",

              background:
                "#0f172a",

              border:
                "1px solid #2563eb",

              color:
                "#93c5fd",

              padding:
                "11px 14px",

              borderRadius:
                "12px",

              fontSize:
                "13px",

              fontWeight:
                "bold",
            }}
          >
            🧠 Consultando especialistas...
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: "10px",
          marginTop: "15px",
        }}
      >
        <input
          value={pergunta}
          onChange={(e) =>
            setPergunta(
              e.target.value
            )
          }
          onKeyDown={
            enviarComEnter
          }
          disabled={
            carregando
          }
          placeholder="Pergunte ao Copiloto..."
          style={{
            flex: 1,
            padding: "12px",
            borderRadius:
              "10px",
            border:
              "1px solid #334155",
            background:
              "#0f172a",
            color: "#fff",
            outline: "none",
          }}
        />

        <button
          type="button"
          onClick={
            enviarPergunta
          }
          disabled={
            carregando ||
            !pergunta.trim()
          }
          style={{
            padding:
              "12px 18px",

            borderRadius:
              "10px",

            border:
              "none",

            background:
              "#2563eb",

            color:
              "#fff",

            fontWeight:
              "bold",

            cursor:
              carregando ||
              !pergunta.trim()
                ? "not-allowed"
                : "pointer",

            opacity:
              carregando ||
              !pergunta.trim()
                ? 0.55
                : 1,
          }}
        >
          {carregando
            ? "Analisando..."
            : "Enviar"}
        </button>
      </div>
    </section>
  );
}