import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../supabase";

import {
  baixarClip as baixarClipArquivo,
} from "./utils/downloadUtils";

function obterUrl(item) {
  return (
    item?.imagem_processada ||
    item?.url ||
    ""
  );
}

export default function MidiasAppia({
  cardStyle,
  setScreen,
}) {
  const [aba, setAba] =
    useState("videos");

  const [midias, setMidias] =
    useState([]);

  const [carregando, setCarregando] =
    useState(false);

  const [erro, setErro] =
    useState("");

  useEffect(() => {
    let ativo = true;

    async function carregarMidias({
      silencioso = false,
    } = {}) {
      if (!silencioso) {
        setCarregando(true);
      }

      setErro("");

      try {
        const {
          data: dadosUsuario,
          error: erroUsuario,
        } =
          await supabase.auth.getUser();

        if (erroUsuario) {
          throw erroUsuario;
        }

        const usuario =
          dadosUsuario?.user;

        if (!usuario?.id) {
          throw new Error(
            "Faça login para acessar suas mídias."
          );
        }

        const {
          data,
          error,
        } =
          await supabase
            .from("processamentos")
            .select(
              "imagem_original, imagem_processada, tipo, status, modelo_banner, created_at"
            )
            .eq(
              "user_id",
              usuario.id
            )
            .in(
              "tipo",
              [
                "clip",
                "video",
                "banner",
              ]
            )
            .eq(
              "status",
              "finalizado"
            )
            .not(
              "imagem_processada",
              "is",
              null
            )
            .order(
              "created_at",
              {
                ascending: false,
              }
            );

        if (error) {
          throw error;
        }

        if (ativo) {
          setMidias(
            Array.isArray(data)
              ? data
              : []
          );
        }
      } catch (erroCarregamento) {
        console.error(
          "Erro ao carregar Mídias PAIIA:",
          erroCarregamento
        );

        if (ativo) {
          setErro(
            erroCarregamento?.message ||
              "Não foi possível carregar suas mídias."
          );
        }
      } finally {
        if (
          ativo &&
          !silencioso
        ) {
          setCarregando(false);
        }
      }
    }

    carregarMidias();

    function atualizarAutomaticamente() {
      carregarMidias({
        silencioso: true,
      });
    }

    /*
     * Mantemos os eventos antigos para
     * preservar compatibilidade com os
     * módulos já existentes da V1.0.
     */
    window.addEventListener(
      "appia:clip-pronto",
      atualizarAutomaticamente
    );

    window.addEventListener(
      "appia:banner-pronto",
      atualizarAutomaticamente
    );

    const intervalo =
      window.setInterval(
        atualizarAutomaticamente,
        3000
      );

    return () => {
      ativo = false;

      window.removeEventListener(
        "appia:clip-pronto",
        atualizarAutomaticamente
      );

      window.removeEventListener(
        "appia:banner-pronto",
        atualizarAutomaticamente
      );

      window.clearInterval(
        intervalo
      );
    };
  }, []);

  const itens =
    useMemo(() => {
      return midias.filter(
        (item) => {
          const tipo =
            String(
              item?.tipo || ""
            ).toLowerCase();

          if (
            aba === "videos"
          ) {
            return (
              tipo === "clip" ||
              tipo === "video"
            );
          }

          return (
            tipo === "banner"
          );
        }
      );
    }, [midias, aba]);

  async function exportarVideo(
    item
  ) {
    const url =
      obterUrl(item);

    if (!url) {
      alert(
        "Este vídeo não possui arquivo válido."
      );

      return;
    }

    try {
      await baixarClipArquivo(
        url
      );
    } catch (erroDownload) {
      console.error(
        "Erro ao exportar vídeo:",
        erroDownload
      );

      alert(
        "Não foi possível exportar o vídeo."
      );
    }
  }

  function exportarBanner(
    item
  ) {
    const url =
      obterUrl(item);

    if (!url) {
      alert(
        "Este banner não possui arquivo válido."
      );

      return;
    }

    const link =
      document.createElement(
        "a"
      );

    link.href = url;
    link.target = "_blank";
    link.rel =
      "noopener noreferrer";

    document.body.appendChild(
      link
    );

    link.click();
    link.remove();
  }

  function usarNaPublicacao(
  item
) {
  const url =
    obterUrl(item);

  if (!url) {
    return;
  }

  const tipo =
    String(
      item?.tipo || ""
    ).toLowerCase();

  const ehVideo =
    tipo === "clip" ||
    tipo === "video";

  /*
   * Mantemos as chaves antigas para
   * não quebrar a Central de Publicação.
   */
  const chaveLista =
    ehVideo
      ? "clipsSelecionadosPublicacao"
      : "bannersSelecionadosPublicacao";

  let atuais = [];

  try {
    const salvo =
      localStorage.getItem(
        chaveLista
      );

    atuais =
      salvo
        ? JSON.parse(
            salvo
          )
        : [];
  } catch {
    atuais = [];
  }

  if (
    !Array.isArray(
      atuais
    )
  ) {
    atuais = [];
  }

  const atualizadas =
    atuais.includes(url)
      ? atuais
      : [
          ...atuais,
          url,
        ];

  localStorage.setItem(
    chaveLista,
    JSON.stringify(
      atualizadas
    )
  );

  if (ehVideo) {
    localStorage.setItem(
      "clipPronto",
      url
    );

    localStorage.setItem(
      "clipSelecionado",
      url
    );

    localStorage.setItem(
      "clipGeracaoStatus",
      "pronto"
    );
  } else {
    localStorage.setItem(
      "bannerPronto",
      url
    );

    localStorage.setItem(
      "bannerSelecionado",
      url
    );
  }

  alert(
    ehVideo
      ? `✅ Vídeo adicionado. Total: ${atualizadas.length}`
      : `✅ Banner adicionado. Total: ${atualizadas.length}`
  );

  /*
   * Depois de adicionar a mídia,
   * retorna automaticamente
   * para a publicação.
   */
  window.setTimeout(
    () => {
      voltarParaPublicacao();
    },
    150
  );
}

  function voltarParaPublicacao() {
    localStorage.setItem(
      "retornarParaMidiasPublicacao",
      "true"
    );

    setScreen?.(
      "mercadoLivreTeste"
    );
  }

  const estiloBase = {
    ...cardStyle,
    background: "#0f172a",
    border:
      "1px solid #334155",
    borderRadius: "18px",
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1240px",
        margin: "30px auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "18px",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() =>
              setScreen?.("home")
            }
            style={
              botaoSecundario
            }
          >
            ← Início
          </button>

          <button
            type="button"
            onClick={
              voltarParaPublicacao
            }
            style={{
              ...botaoPrincipal,
              width: "auto",
              padding:
                "11px 16px",
            }}
          >
            ↩️ Voltar à Publicação
          </button>
        </div>

        <div
          style={{
            textAlign: "center",
            flex: 1,
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "#38bdf8",
              fontSize: "32px",
            }}
          >
            🎞️ Mídias PAIIA
          </h2>

          <p
            style={{
              color: "#94a3b8",
              margin:
                "6px 0 0",
            }}
          >
            Seus vídeos e banners
            em um só lugar.
          </p>
        </div>
      </div>

      <section
        style={{
          ...estiloBase,
          padding: "18px",
          marginBottom: "16px",
          border: "1px solid #0ea5e9",
          background:
            "linear-gradient(135deg,#082f49,#0f172a)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                color: "#67e8f9",
                fontWeight: "bold",
                fontSize: "20px",
              }}
            >
              🎭 Mascote IA
            </div>

            <div
              style={{
                color: "#cbd5e1",
                marginTop: "5px",
              }}
            >
              Crie uma propaganda com seu mascote, fala em português e vídeo com IA.
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              localStorage.setItem(
                "abrirModoMascoteIA",
                "true"
              );
              setScreen?.("clipIA");
            }}
            style={{
              ...botaoPrincipal,
              width: "auto",
              minWidth: "220px",
              padding: "13px 20px",
              background:
                "linear-gradient(135deg,#0284c7,#06b6d4)",
            }}
          >
            🎬 Criar com Mascote IA
          </button>
        </div>
      </section>

      <section
        style={{
          ...estiloBase,
          padding: "18px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "1fr 1fr",
            gap: "10px",
          }}
        >
          <button
            type="button"
            onClick={() =>
              setAba(
                "videos"
              )
            }
            style={botaoAba(
              aba === "videos"
            )}
          >
            🎬 Vídeos
          </button>

          <button
            type="button"
            onClick={() =>
              setAba(
                "banners"
              )
            }
            style={botaoAba(
              aba === "banners"
            )}
          >
            🎨 Banners
          </button>
        </div>
      </section>

      {carregando && (
        <section
          style={{
            ...estiloBase,
            padding:
              "28px",
            marginTop:
              "16px",
            textAlign:
              "center",
            color:
              "#bfdbfe",
          }}
        >
          ⏳ Carregando suas
          mídias...
        </section>
      )}

      {erro && (
        <section
          style={{
            ...estiloBase,
            padding:
              "20px",
            marginTop:
              "16px",
            border:
              "1px solid #ef4444",
            color:
              "#fecaca",
            textAlign:
              "center",
          }}
        >
          ❌ {erro}
        </section>
      )}

      {!carregando &&
        !erro &&
        itens.length === 0 && (
          <section
            style={{
              ...estiloBase,
              padding:
                "38px 24px",
              marginTop:
                "16px",
              textAlign:
                "center",
            }}
          >
            <div
              style={{
                fontSize:
                  "46px",
              }}
            >
              {aba === "videos"
                ? "🎬"
                : "🎨"}
            </div>

            <h3
              style={{
                color:
                  "#67e8f9",
              }}
            >
              Nenhuma mídia
              salva ainda
            </h3>

            <p
              style={{
                color:
                  "#94a3b8",
              }}
            >
              {aba === "videos"
                ? "Seus vídeos salvos aparecerão aqui."
                : "Seus banners salvos aparecerão aqui."}
            </p>
          </section>
        )}

      {!carregando &&
        !erro &&
        itens.length > 0 && (
          <section
            style={{
              marginTop:
                "16px",
              display: "grid",
              gridTemplateColumns:
                "repeat(4, minmax(0, 1fr))",
              gap: "16px",
            }}
          >
            {itens.map(
              (item) => {
                const url =
                  obterUrl(
                    item
                  );

                const ehVideo =
                  aba ===
                  "videos";

                return (
                  <article
                    key={
                      item.created_at ||
                      item.imagem_processada
                    }
                    style={{
                      ...estiloBase,
                      padding:
                        "14px",
                      minWidth: 0,
                      overflow:
                        "hidden",
                    }}
                  >
                    <div
                      style={{
                        width:
                          "100%",
                        aspectRatio:
                          "1 / 1",
                        borderRadius:
                          "12px",
                        overflow:
                          "hidden",
                        background:
                          "#020617",
                        display:
                          "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "center",
                      }}
                    >
                      {ehVideo ? (
                        <video
                          src={url}
                          muted
                          playsInline
                          preload="metadata"
                          onMouseEnter={(
                            e
                          ) => {
                            e.currentTarget
                              .play()
                              .catch(
                                () => {}
                              );
                          }}
                          onMouseLeave={(
                            e
                          ) => {
                            e.currentTarget.pause();
                            e.currentTarget.currentTime =
                              0;
                          }}
                          onClick={(
                            e
                          ) => {
                            if (
                              e
                                .currentTarget
                                .paused
                            ) {
                              e.currentTarget
                                .play()
                                .catch(
                                  () => {}
                                );
                            } else {
                              e.currentTarget.pause();
                            }
                          }}
                          style={{
                            width:
                              "100%",
                            height:
                              "100%",
                            objectFit:
                              "contain",
                            background:
                              "#ffffff",
                            cursor:
                              "pointer",
                          }}
                        />
                      ) : (
                        <img
                          src={url}
                          alt="Banner PAIIA"
                          style={{
                            width:
                              "100%",
                            height:
                              "100%",
                            objectFit:
                              "contain",
                            background:
                              "#ffffff",
                          }}
                        />
                      )}
                    </div>

                    <div
                      style={{
                        marginTop:
                          "12px",
                        display:
                          "grid",
                        gap: "8px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          usarNaPublicacao(
                            item
                          )
                        }
                        style={
                          botaoPrincipal
                        }
                      >
                        ➕ Adicionar à
                        Publicação
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          ehVideo
                            ? exportarVideo(
                                item
                              )
                            : exportarBanner(
                                item
                              )
                        }
                        style={
                          botaoSecundario
                        }
                      >
                        ⬇️ Exportar
                      </button>
                    </div>
                  </article>
                );
              }
            )}
          </section>
        )}

      <div
        style={{
          marginTop: "22px",
          display: "flex",
          justifyContent:
            "center",
        }}
      >
        <button
          type="button"
          onClick={
            voltarParaPublicacao
          }
          style={{
            ...botaoPrincipal,
            width: "100%",
            maxWidth: "420px",
            padding:
              "14px 18px",
            fontSize: "15px",
          }}
        >
          ↩️ Voltar à Publicação
        </button>
      </div>
    </div>
  );
}

function botaoAba(ativo) {
  return {
    padding: "14px",
    borderRadius: "11px",
    border: ativo
      ? "1px solid #22d3ee"
      : "1px solid #334155",
    background: ativo
      ? "#164e63"
      : "#020617",
    color: "#ffffff",
    fontWeight: "bold",
    cursor: "pointer",
  };
}

const botaoPrincipal = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "10px",
  border: "none",
  background:
    "linear-gradient(135deg,#15803d,#22c55e)",
  color: "#ffffff",
  fontWeight: "bold",
  cursor: "pointer",
};

const botaoSecundario = {
  padding: "11px 16px",
  borderRadius: "10px",
  border:
    "1px solid #38bdf8",
  background: "#082f49",
  color: "#bae6fd",
  fontWeight: "bold",
  cursor: "pointer",
};