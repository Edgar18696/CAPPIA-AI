import useFotoState from "./hooks/useFotoState";

function PaizinhoFotoIA({
  arquivosFotos = [],
  processando = false,
  statusProcesso = "",
  resultadosFotos = [],
}) {
  const totalFotos = Array.isArray(arquivosFotos)
    ? arquivosFotos.length
    : 0;

  const totalResultados = Array.isArray(resultadosFotos)
    ? resultadosFotos.filter((item) => item?.processada && !item?.erro).length
    : 0;

  const concluido = totalResultados > 0;

  let icone = "🤖";
  let titulo = "Agora vamos produzir sua Foto IA.";
  let mensagem =
    "Escolha até 8 fotos, defina o fundo e a qualidade. Eu acompanho esta missão com você.";
  let proximo =
    "Selecione uma ou mais fotos para começar.";
  let progresso = 0;

  if (totalFotos > 0 && !processando && !concluido) {
    icone = "🤖😊";
    titulo = "Fotos recebidas.";
    mensagem = `${totalFotos} foto${
      totalFotos > 1 ? "s" : ""
    } pronta${
      totalFotos > 1 ? "s" : ""
    } para processamento.`;
    proximo =
      'Confira as opções e clique em "Produzir Foto IA".';
    progresso = 30;
  }

  if (processando) {
    icone = "🤖⚙️";
    titulo = "Estou produzindo sua Foto IA.";
    mensagem =
      statusProcesso ||
      "Estou processando as imagens e preparando o resultado profissional.";
    proximo =
      "Acompanhe aqui. Eu aviso quando a missão estiver concluída.";
    progresso = 70;
  }

  if (concluido) {
    icone = "🤖🎉";
    titulo = "Missão 2 concluída!";
    mensagem = `${totalResultados} foto${
      totalResultados > 1 ? "s" : ""
    } processada${
      totalResultados > 1 ? "s" : ""
    } com sucesso.`;
    proximo =
      "Próxima missão: criar o Banner Studio.";
    progresso = 100;
  }

  return (
    <section
      style={{
        position: "sticky",
        top: "8px",
        zIndex: 80,
        maxWidth: "950px",
        margin: "0 auto 18px",
        padding: "12px 16px",
        borderRadius: "15px",
        border: concluido
          ? "1px solid #22c55e"
          : "1px solid #2563eb",
        background: concluido
          ? "linear-gradient(135deg,#052e16,#14532d)"
          : "linear-gradient(135deg,#0f172a,#172554)",
        boxShadow:
          "0 10px 26px rgba(0,0,0,.28)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            minWidth: "56px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            fontSize: "29px",
            background: "rgba(2,6,23,.75)",
            border: "1px solid #38bdf8",
            boxShadow:
              "0 0 15px rgba(34,211,238,.25)",
          }}
        >
          {icone}
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <strong
              style={{
                color: concluido
                  ? "#bbf7d0"
                  : "#67e8f9",
                fontSize: "17px",
              }}
            >
              Paizinho PAIIA
            </strong>

            <span
              style={{
                color: "#94a3b8",
                fontSize: "11px",
                fontWeight: "bold",
              }}
            >
              {concluido
                ? "Missão 2 de 5 concluída"
                : "Missão 2 de 5"}
            </span>
          </div>

          <div
            style={{
              marginTop: "3px",
              color: "#ffffff",
              fontWeight: "bold",
              fontSize: "14px",
            }}
          >
            {titulo}
          </div>

          <div
            style={{
              marginTop: "3px",
              color: "#cbd5e1",
              fontSize: "12px",
              lineHeight: 1.4,
            }}
          >
            {mensagem}
          </div>
        </div>
      </div>

      <div
        style={{
          height: "6px",
          marginTop: "10px",
          overflow: "hidden",
          borderRadius: "999px",
          background: "#020617",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progresso}%`,
            borderRadius: "999px",
            background: concluido
              ? "linear-gradient(90deg,#16a34a,#22c55e)"
              : "linear-gradient(90deg,#2563eb,#22d3ee)",
            transition: "width .3s ease",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "7px",
          flexWrap: "wrap",
          marginTop: "9px",
          color: "#cbd5e1",
          fontSize: "11px",
          fontWeight: "bold",
        }}
      >
        <span>✅ Anúncio</span>
        <span style={{ color: "#475569" }}>→</span>

        <span
          style={{
            color: concluido
              ? "#bbf7d0"
              : processando || totalFotos > 0
                ? "#fde68a"
                : "#94a3b8",
          }}
        >
          {concluido
            ? "✅"
            : processando
              ? "🟡"
              : totalFotos > 0
                ? "🟢"
                : "⬜"}{" "}
          Foto IA
        </span>

        <span style={{ color: "#475569" }}>→</span>
        <span>⬜ Banner</span>
        <span style={{ color: "#475569" }}>→</span>
        <span>⬜ Clip</span>
        <span style={{ color: "#475569" }}>→</span>
        <span>⬜ Publicação</span>
      </div>

      <div
        style={{
          marginTop: "9px",
          paddingTop: "8px",
          borderTop:
            "1px solid rgba(148,163,184,.18)",
          color: concluido
            ? "#dcfce7"
            : "#bfdbfe",
          fontSize: "12px",
          fontWeight: "bold",
        }}
      >
        ➡️ {proximo}
      </div>
    </section>
  );
}

export default function FotoIA({
  arquivosFotos,
  setArquivosFotos,
  setArquivo,
  setPreview,
  setUrlPublica,
  setResultadoIA,
  setStatusProcesso,
  tipoFundoFoto,
  setTipoFundoFoto,
  aplicarSombra,
  setAplicarSombra,
  qualidadeFoto,
  setQualidadeFoto,
  processarSelecionadas,
  statusProcesso,
  resultadosFotos,
  setResultadosFotos,
  preview,
  resultadoIA,
  limparTelaFoto,
  processando,
  baixarImagem,
  cardStyle,
  buttonGreen,
  buttonRed,
  produtoCopilot,
  setScreen,
}) {
  const {
    imagemAmpliada,
    setImagemAmpliada,
  } = useFotoState();

  function liberarPreviewsLocais() {
    arquivosFotos.forEach((foto) => {
      if (
        String(foto?.preview || "").startsWith("blob:")
      ) {
        URL.revokeObjectURL(foto.preview);
      }
    });
  }

  function selecionarFotos(evento) {
    const files = Array.from(evento.target.files || []);

    if (files.length === 0) {
      return;
    }

    if (files.length > 8) {
      alert("Máximo de 8 fotos por vez.");
      evento.target.value = "";
      return;
    }

    liberarPreviewsLocais();

    const fotosPreparadas = files.map((file) => {
      const arquivoIndependente = new File(
        [file],
        file.name,
        {
          type: file.type,
          lastModified: file.lastModified,
        }
      );

      return {
        file: arquivoIndependente,
        preview: URL.createObjectURL(arquivoIndependente),
        selecionada: true,
      };
    });

    setArquivo(files[0]);
    setPreview(fotosPreparadas[0].preview);
    setArquivosFotos(fotosPreparadas);
    setUrlPublica("");
    setResultadoIA("");
    setResultadosFotos([]);
    setStatusProcesso("");
    setImagemAmpliada("");
  }

  function abrirGaleria() {
    localStorage.setItem("abrirUltimasFotos", "true");
    localStorage.setItem("filtroGaleria", "foto");
    setScreen("galeria");
  }

  function abrirBannerComImagem(url) {
    if (!url) {
      alert("Processe uma foto antes de criar o banner.");
      return;
    }

    setResultadoIA(url);
    localStorage.setItem("imagemBannerSelecionada", url);
    localStorage.setItem("abrirBannerAutomatico", "true");
    setScreen("banner");
  }

  function abrirClipComImagem(url) {
    if (!url) {
      alert("Processe uma foto antes de criar o clip.");
      return;
    }

    localStorage.setItem("imagemClipSelecionada", url);
    localStorage.setItem("abrirClipAutomatico", "true");
    setScreen("clipIA");
  }

  function processarNovoLote() {
    liberarPreviewsLocais();
    setResultadosFotos([]);
    setImagemAmpliada("");
    limparTelaFoto();
  }

  function montarUrlSemCache(resultado, index) {
    const url = String(resultado?.processada || "").trim();

    if (!url) {
      return "";
    }

    const separador = url.includes("?") ? "&" : "?";
    const versao = encodeURIComponent(
      resultado?.criadaEm || index
    );

    return `${url}${separador}v=${versao}`;
  }

  const ultimaFotoProcessada =
    resultadosFotos?.[resultadosFotos.length - 1]?.processada || "";

  return (
    <div style={{ marginTop: "50px" }}>
      <h2
        style={{
          color: "#67e8f9",
          fontSize: "32px",
          marginBottom: "10px",
        }}
      >
        📸 Foto Premium IA
      </h2>

      <PaizinhoFotoIA
        arquivosFotos={arquivosFotos}
        processando={processando}
        statusProcesso={statusProcesso}
        resultadosFotos={resultadosFotos}
      />

      {produtoCopilot && (
        <div
          style={{
            background: "#0f172a",
            border: "1px solid #67e8f9",
            borderRadius: "12px",
            padding: "15px",
            marginBottom: "20px",
            color: "#e2e8f0",
          }}
        >
          <strong style={{ color: "#67e8f9" }}>
            🤖 Produto recebido do Copilot:
          </strong>

          <div style={{ marginTop: "8px" }}>
            {produtoCopilot}
          </div>
        </div>
      )}

      <p
        style={{
          color: "#94a3b8",
          marginBottom: "25px",
        }}
      >
        Transforme até 8 fotos em imagens profissionais para marketplace.
      </p>

      <h3 style={{ color: "#ffffff" }}>
        Escolha até 8 fotos
      </h3>

      <div
        style={{
          ...cardStyle,
          maxWidth: "950px",
          margin: "30px auto",
        }}
      >
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={selecionarFotos}
          disabled={processando}
        />

        {arquivosFotos.map((foto, index) => (
          <div
            key={`${foto.file?.name || "foto"}-${index}`}
            style={{
              background: "#0f172a",
              border: "1px solid #2563eb",
              borderRadius: "12px",
              padding: "10px",
              textAlign: "center",
              width: "320px",
              maxWidth: "100%",
              margin: "15px auto",
            }}
          >
            <img
              src={foto.preview}
              alt={`Foto selecionada ${index + 1}`}
              style={{
                width: "220px",
                maxWidth: "100%",
                height: "120px",
                objectFit: "contain",
                background: "#ffffff",
                borderRadius: "8px",
              }}
            />
          </div>
        ))}

        <div
          style={{
            marginTop: "20px",
            textAlign: "center",
          }}
        >
          <select
            value={tipoFundoFoto}
            onChange={(evento) =>
              setTipoFundoFoto(evento.target.value)
            }
            style={{
              padding: "12px",
              borderRadius: "10px",
              background: "#0f172a",
              color: "#ffffff",
              border: "1px solid #2563eb",
              marginTop: "15px",
            }}
          >
            <option value="branco">🎨 Fundo Branco</option>
            <option value="transparente">
              ✨ Fundo Transparente
            </option>
          </select>

          <select
            value={qualidadeFoto}
            onChange={(evento) =>
              setQualidadeFoto(evento.target.value)
            }
            style={{
              padding: "12px",
              borderRadius: "10px",
              background: "#0f172a",
              color: "#ffffff",
              border: "1px solid #2563eb",
              marginTop: "15px",
              marginLeft: "15px",
            }}
          >
            <option value="standard">
              🟢 Qualidade Standard
            </option>
            <option value="alta">
              🔵 Qualidade Alta
            </option>
            <option value="ultra">
              🟣 Qualidade Ultra
            </option>
          </select>

          {typeof setAplicarSombra === "function" && (
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                marginLeft: "15px",
                marginTop: "15px",
                color: "#cbd5e1",
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(aplicarSombra)}
                onChange={(evento) =>
                  setAplicarSombra(evento.target.checked)
                }
              />
              Sombra suave
            </label>
          )}

          <button
            type="button"
            style={{
              ...buttonGreen,
              marginLeft: "15px",
              marginTop: "15px",
            }}
            onClick={processarSelecionadas}
            disabled={
              processando || arquivosFotos.length === 0
            }
          >
            {processando
              ? "🤖 Produzindo Foto IA..."
              : "📸 Produzir Foto IA"}
          </button>
        </div>

        {statusProcesso && (
          <div
            style={{
              marginTop: "25px",
              padding: "15px",
              background: "#020617",
              border: "1px solid #38bdf8",
              borderRadius: "12px",
              color: "#bfdbfe",
              fontWeight: "bold",
            }}
          >
            {statusProcesso}
          </div>
        )}

        {resultadosFotos?.length > 0 ? (
          <div style={{ marginTop: "30px" }}>
            <h3
              style={{
                color: "#67e8f9",
                textAlign: "center",
                marginBottom: "25px",
              }}
            >
              ✅ Resultados processados
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: "22px",
                width: "100%",
              }}
            >
              {resultadosFotos.map((resultado, index) => {
                const urlOriginal =
                  String(resultado?.original || "").trim();

                const urlBaseProcessada =
                  String(resultado?.processada || "").trim();

                const urlProcessada =
                  montarUrlSemCache(resultado, index);

                const erroFoto = String(resultado?.erro || "").trim();

                return (
                  <div
                    key={`resultado-${index}`}
                    style={{
                      background: "#020617",
                      border: "1px solid #2563eb",
                      borderRadius: "16px",
                      padding: "18px",
                    }}
                  >
                    <h4
                      style={{
                        color: "#ffffff",
                        textAlign: "center",
                        marginTop: 0,
                        marginBottom: "18px",
                      }}
                    >
                      Foto {index + 1}
                    </h4>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(2, minmax(0, 1fr))",
                        gap: "22px",
                        width: "100%",
                        alignItems: "start",
                      }}
                    >
                      <div>
                        <h4
                          style={{
                            color: "#cbd5e1",
                            textAlign: "center",
                            marginTop: 0,
                          }}
                        >
                          Foto original
                        </h4>

                        {urlOriginal ? (
                          <img
                            src={urlOriginal}
                            alt={`Original ${index + 1}`}
                            onClick={() =>
                              setImagemAmpliada(urlOriginal)
                            }
                            style={{
                              width: "100%",
                              height: "320px",
                              objectFit: "contain",
                              borderRadius: "12px",
                              background: "#ffffff",
                              cursor: "zoom-in",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              height: "320px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "12px",
                              background: "#ffffff",
                              color: "#64748b",
                            }}
                          >
                            Foto original indisponível
                          </div>
                        )}
                      </div>

                      <div>
                        <h4
                          style={{
                            color: "#67e8f9",
                            textAlign: "center",
                            marginTop: 0,
                          }}
                        >
                          Resultado IA
                        </h4>

                        {erroFoto ? (
                          <div
                            style={{
                              minHeight: "320px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "12px",
                              background: "#450a0a",
                              color: "#fecaca",
                              padding: "16px",
                              textAlign: "left",
                              whiteSpace: "pre-wrap",
                              fontSize: "13px",
                              lineHeight: 1.45,
                            }}
                          >
                            Foto {index + 1}
                            {resultado?.nomeArquivo
                              ? ` (${resultado.nomeArquivo})`
                              : ""}
                            : {erroFoto}
                          </div>
                        ) : urlProcessada ? (
                          <img
                            src={urlProcessada}
                            alt={`Processada ${index + 1}`}
                            onClick={() =>
                              setImagemAmpliada(urlProcessada)
                            }
                            onError={(evento) => {
                              const imagem = evento.currentTarget;

                              if (
                                imagem.dataset.tentouNovamente ===
                                "true"
                              ) {
                                return;
                              }

                              imagem.dataset.tentouNovamente =
                                "true";

                              setTimeout(() => {
                                const separador =
                                  urlBaseProcessada.includes("?")
                                    ? "&"
                                    : "?";

                                imagem.src =
                                  `${urlBaseProcessada}${separador}retry=${Date.now()}`;
                              }, 1500);
                            }}
                            style={{
                              width: "100%",
                              height: "320px",
                              objectFit: "contain",
                              borderRadius: "12px",
                              background: "#ffffff",
                              cursor: "zoom-in",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              height: "320px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "12px",
                              background: "#ffffff",
                              color: "#64748b",
                            }}
                          >
                            Resultado indisponível
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: "16px",
                        display: "flex",
                        justifyContent: "center",
                        gap: "10px",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          baixarImagem(urlBaseProcessada)
                        }
                        disabled={!urlBaseProcessada}
                        style={buttonGreen}
                      >
                        ⬇️ Baixar
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          abrirBannerComImagem(
                            urlBaseProcessada
                          )
                        }
                        disabled={!urlBaseProcessada}
                        style={{
                          background: urlBaseProcessada
                            ? "#2563eb"
                            : "#475569",
                          color: "#ffffff",
                          border: "none",
                          padding: "12px 18px",
                          borderRadius: "10px",
                          cursor: urlBaseProcessada
                            ? "pointer"
                            : "not-allowed",
                          fontWeight: "bold",
                        }}
                      >
                        🚀 Continuar para Banner Studio
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          abrirClipComImagem(
                            urlBaseProcessada
                          )
                        }
                        disabled={!urlBaseProcessada}
                        style={{
                          background: urlBaseProcessada
                            ? "#ea580c"
                            : "#475569",
                          color: "#ffffff",
                          border: "none",
                          padding: "12px 18px",
                          borderRadius: "10px",
                          cursor: urlBaseProcessada
                            ? "pointer"
                            : "not-allowed",
                          fontWeight: "bold",
                        }}
                      >
                        🎬 Criar Clip
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                marginTop: "28px",
                padding: "22px",
                borderRadius: "16px",
                background:
                  "linear-gradient(135deg,#052e16,#14532d)",
                border: "1px solid #22c55e",
                textAlign: "center",
              }}
            >
              <h3
                style={{
                  marginTop: 0,
                  color: "#ffffff",
                }}
              >
                🤖 Missão 2 concluída
              </h3>
            
        </div>
        </div>
      ) : (
          preview && (
            <div
              style={{
                marginTop: "30px",
                textAlign: "center",
              }}
            >
              <h3 style={{ color: "#cbd5e1" }}>
                Foto original
              </h3>

              <img
                src={preview}
                alt="Foto original"
                onClick={() =>
                  setImagemAmpliada(preview)
                }
                style={{
                  width: "400px",
                  maxWidth: "100%",
                  borderRadius: "10px",
                  background: "#ffffff",
                  cursor: "zoom-in",
                }}
              />
            </div>
          )
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "18px",
          flexWrap: "wrap",
          marginTop: "25px",
        }}
      >
        <button
          type="button"
          onClick={abrirGaleria}
          style={{
            padding: "16px 26px",
            borderRadius: "14px",
            border: "none",
            background:
              "linear-gradient(135deg,#2563eb,#22d3ee)",
            color: "#ffffff",
            fontWeight: "bold",
            cursor: "pointer",
            fontSize: "16px",
          }}
        >
          🖼️ Abrir Galeria
        </button>

        <button
          type="button"
          onClick={() => {
            console.log("SALVANDO FOTO:", resultadoIA);

            if (resultadoIA) {
              localStorage.setItem(
                "fotoPronta",
                resultadoIA
              );

              try {
                const projetoSalvo =
                  localStorage.getItem(
                    "projetoAppiaAtual"
                  );

                const projetoAtual =
                  projetoSalvo
                    ? JSON.parse(projetoSalvo)
                    : null;

                if (projetoAtual) {
                  const projetoAtualizado = {
                    ...projetoAtual,
                    foto_pronta: true,
                    foto_url: resultadoIA,
                    imagem:
                      projetoAtual.imagem ||
                      resultadoIA,
                    updated_at:
                      new Date().toISOString(),
                  };

                  localStorage.setItem(
                    "projetoAppiaAtual",
                    JSON.stringify(
                      projetoAtualizado
                    )
                  );
                }
              } catch (erro) {
                console.error(
                  "Erro ao atualizar o projeto com a Foto IA:",
                  erro
                );
              }
            }

            setScreen("novoAnuncio");
          }}
          style={{
            padding: "16px 26px",
            borderRadius: "14px",
            border: "none",
            background:
              "linear-gradient(135deg,#16a34a,#22c55e)",
            color: "#ffffff",
            fontWeight: "bold",
            cursor: "pointer",
            fontSize: "16px",
          }}
        >
          🤖 Criar Anúncio
        </button>
      </div>

      {imagemAmpliada && (
        <div
          onClick={() =>
            setImagemAmpliada("")
          }
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2,6,23,.92)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 99999,
            cursor: "zoom-out",
            padding: "20px",
          }}
        >
          <img
            src={imagemAmpliada}
            alt="Imagem ampliada"
            onClick={(evento) =>
              evento.stopPropagation()
            }
            style={{
              maxWidth: "95vw",
              maxHeight: "92vh",
              objectFit: "contain",
              background: "#fff",
              borderRadius: "16px",
            }}
          />

          <button
            type="button"
            onClick={() =>
              setImagemAmpliada("")
            }
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              width: 46,
              height: 46,
              borderRadius: "50%",
              border: "none",
              background: "#ef4444",
              color: "#fff",
              fontSize: "22px",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
