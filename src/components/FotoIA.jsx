function PaizinhoFotoIA({
  arquivosFotos = [],
  processando = false,
  statusProcesso = "",
  resultadoIA = "",
}) {
  const totalFotos = Array.isArray(arquivosFotos)
    ? arquivosFotos.length
    : 0;

  const fotoPronta = Boolean(resultadoIA);

  let titulo = "Missão 2 de 5 — Foto IA";
  let mensagem =
    "Escolha até 8 fotos. Depois clique em “Produzir Foto IA” e eu acompanho o processamento com você.";
  let proximo =
    "Selecione uma ou mais fotos para começar.";
  let progresso = 0;
  let icone = "🤖";

  if (totalFotos > 0 && !processando && !fotoPronta) {
    mensagem = `${totalFotos} foto${
      totalFotos > 1 ? "s" : ""
    } recebida${
      totalFotos > 1 ? "s" : ""
    }. Agora escolha o fundo e a qualidade.`;

    proximo =
      "Clique em “Produzir Foto IA” quando estiver pronto.";

    progresso = 25;
    icone = "🤖😊";
  }

  if (processando) {
    mensagem =
      statusProcesso ||
      "Estou produzindo sua Foto IA profissional.";

    proximo =
      "Acompanhe aqui. Eu aviso quando a imagem estiver pronta.";

    progresso = 70;
    icone = "🤖⚙️";
  }

  if (fotoPronta) {
    titulo =
      "Missão 2 de 5 concluída — Foto IA";

    mensagem =
      "Excelente! Sua Foto IA ficou pronta e já está disponível para continuar a jornada.";

    proximo =
      "Próxima missão: criar o Banner Studio.";

    progresso = 100;
    icone = "🤖🎉";
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
        border: fotoPronta
          ? "1px solid #22c55e"
          : "1px solid #2563eb",
        background: fotoPronta
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
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <strong
              style={{
                color: fotoPronta
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
              {titulo}
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
            {fotoPronta
              ? "Foto profissional concluída."
              : processando
                ? "Estou cuidando da sua imagem."
                : "Agora vamos produzir sua Foto IA."}
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
            background: fotoPronta
              ? "linear-gradient(90deg,#16a34a,#22c55e)"
              : "linear-gradient(90deg,#2563eb,#22d3ee)",
            transition:
              "width .3s ease",
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
        <span>
          {fotoPronta
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
          color: fotoPronta
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
  categoriaFoto,
  setCategoriaFoto,
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
  function prepararFoto1200(
    file,
    fundo = "branco"
  ) {
    return new Promise((resolve, reject) => {
      const urlOriginal =
        URL.createObjectURL(file);

      const imagem = new Image();

      imagem.onload = () => {
        const canvas =
          document.createElement("canvas");

        canvas.width = 1200;
        canvas.height = 1200;

        const ctx =
          canvas.getContext("2d");

        if (!ctx) {
          URL.revokeObjectURL(urlOriginal);
          reject(
            new Error(
              "Não foi possível preparar a imagem."
            )
          );
          return;
        }

        ctx.clearRect(0, 0, 1200, 1200);

        if (fundo === "branco") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, 1200, 1200);
        }

        const margem = 60;
        const areaUtil = 1200 - margem * 2;

        const escala = Math.min(
          areaUtil / imagem.width,
          areaUtil / imagem.height
        );

        const largura =
          imagem.width * escala;

        const altura =
          imagem.height * escala;

        const x = (1200 - largura) / 2;
        const y = (1200 - altura) / 2;

        ctx.drawImage(
          imagem,
          x,
          y,
          largura,
          altura
        );

        const transparente =
          fundo === "transparente";

        const mimeType =
          transparente
            ? "image/png"
            : "image/jpeg";

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(
              urlOriginal
            );

            if (!blob) {
              reject(
                new Error(
                  "Não foi possível gerar a imagem 1200x1200."
                )
              );
              return;
            }

            const nomeBase =
              file.name.replace(
                /\.[^.]+$/,
                ""
              );

            const extensao =
              transparente
                ? "png"
                : "jpg";

            const arquivo1200 =
              new File(
                [blob],
                `${nomeBase}-1200x1200.${extensao}`,
                {
                  type: mimeType,
                }
              );

            resolve({
              file: arquivo1200,
              preview:
                URL.createObjectURL(blob),
              selecionada: true,
              largura: 1200,
              altura: 1200,
              fundo,
            });
          },
          mimeType,
          transparente
            ? undefined
            : 0.95
        );
      };

      imagem.onerror = () => {
        URL.revokeObjectURL(urlOriginal);

        reject(
          new Error(
            `Não foi possível abrir ${file.name}.`
          )
        );
      };

      imagem.src = urlOriginal;
    });
  }

  async function selecionarFotos(evento) {
    const files = Array.from(
      evento.target.files || []
    );

    if (files.length === 0) {
      return;
    }

    if (files.length > 8) {
      alert(
        "Máximo de 8 fotos por vez."
      );

      evento.target.value = "";
      return;
    }

    try {
      setStatusProcesso(
        "📐 Preparando fotos em 1200 x 1200..."
      );

      const fotosPreparadas =
        await Promise.all(
          files.map((file) =>
            prepararFoto1200(
              file,
              tipoFundoFoto
            )
          )
        );

      setArquivo(
        fotosPreparadas[0].file
      );

      setPreview(
        fotosPreparadas[0].preview
      );

      setArquivosFotos(
        fotosPreparadas
      );

      setUrlPublica("");
      setResultadoIA("");

      setStatusProcesso(
        tipoFundoFoto === "transparente"
          ? "✅ Fotos preparadas em 1200 x 1200 com fundo transparente."
          : "✅ Fotos preparadas em 1200 x 1200 com fundo branco."
      );
    } catch (erro) {
      console.error(
        "Erro ao preparar fotos 1200x1200:",
        erro
      );

      setStatusProcesso("");

      alert(
        erro?.message ||
          "Não foi possível preparar as fotos."
      );
    } finally {
      evento.target.value = "";
    }
  }

function abrirBanner() {
  if (!resultadoIA) {
    alert(
      "Processe uma foto antes de criar o banner."
    );
    return;
  }

  localStorage.setItem(
    "imagemBannerSelecionada",
    resultadoIA
  );

  localStorage.setItem(
    "abrirBannerAutomatico",
    "true"
  );

  setScreen("banner");
}

  return (
    <div
      style={{
        marginTop: "50px",
      }}
    >
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
        resultadoIA={resultadoIA}
      />

      {produtoCopilot && (
        <div
          style={{
            background: "#0f172a",
            border:
              "1px solid #67e8f9",
            borderRadius: "12px",
            padding: "15px",
            marginBottom: "20px",
            color: "#e2e8f0",
          }}
        >
          <strong
            style={{
              color: "#67e8f9",
            }}
          >
            🤖 Produto recebido do
            Copilot:
          </strong>

          <div
            style={{
              marginTop: "8px",
            }}
          >
            {produtoCopilot}
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: "20px",
          marginBottom: "20px",
        }}
      >
        <h3
          style={{
            color: "#67e8f9",
            marginBottom: "10px",
          }}
        >
          📂 Categoria da Foto
        </h3>

        <select
          value={categoriaFoto}
          onChange={(evento) =>
            setCategoriaFoto(
              evento.target.value
            )
          }
          style={{
            padding: "12px",
            borderRadius: "10px",
            width: "320px",
            maxWidth: "100%",
            fontSize: "16px",
          }}
        >
          <option value="autopecas">
            🚗 Autopeças
          </option>

          <option value="eletronicos">
            💻 Eletrônicos
          </option>

          <option value="moda">
            👕 Moda
          </option>

          <option value="cosmeticos">
            💄 Cosméticos
          </option>

          <option value="doceria">
            🍰 Doceria
          </option>

          <option value="petshop">
            🐶 Pet Shop
          </option>

          <option value="ferramentas">
            🔧 Ferramentas
          </option>

          <option value="geral">
            📦 Geral
          </option>
        </select>
      </div>

      <p
        style={{
          color: "#94a3b8",
          marginBottom: "25px",
        }}
      >
        Transforme até 8 fotos em
        imagens profissionais para
        marketplace.
      </p>

      <h3
        style={{
          color: "#ffffff",
        }}
      >
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
        />

        {arquivosFotos.map(
          (foto, index) => (
            <div
              key={`${foto.file?.name || "foto"}-${index}`}
              style={{
                background: "#0f172a",
                border:
                  "1px solid #2563eb",
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
                alt={`Foto selecionada ${
                  index + 1
                }`}
                style={{
                  width: "220px",
                  maxWidth: "100%",
                  height: "120px",
                  objectFit: "contain",
                  background:
                    foto.fundo ===
                    "transparente"
                      ? "repeating-conic-gradient(#e5e7eb 0% 25%, #ffffff 0% 50%) 50% / 18px 18px"
                      : "#ffffff",
                  borderRadius: "8px",
                }}
              />

              <div
                style={{
                  marginTop: "7px",
                  color: "#86efac",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              >
                ✅ 1200 × 1200
              </div>
            </div>
          )
        )}

        <div
          style={{
            marginTop: "20px",
            textAlign: "center",
          }}
        >
          <select
            value={tipoFundoFoto}
            onChange={(evento) =>
              setTipoFundoFoto(
                evento.target.value
              )
            }
            style={{
              padding: "12px",
              borderRadius: "10px",
              background: "#0f172a",
              color: "#ffffff",
              border:
                "1px solid #2563eb",
              marginTop: "15px",
            }}
          >
            <option value="branco">
              🎨 Fundo Branco
            </option>

            <option value="transparente">
              ✨ Fundo Transparente
            </option>
          </select>
         
<select
  value={qualidadeFoto}
  onChange={(evento) =>
    setQualidadeFoto(
      evento.target.value
    )
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

          <button
            type="button"
            style={{
              ...buttonGreen,
              marginLeft: "15px",
              marginTop: "15px",
            }}
            onClick={
              processarSelecionadas
            }
            disabled={
              processando ||
              arquivosFotos.length === 0
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
              border:
                "1px solid #38bdf8",
              borderRadius: "12px",
              color: "#bfdbfe",
              fontWeight: "bold",
            }}
          >
            {statusProcesso}
          </div>
        )}

        {preview && (
          <div
            style={{
              marginTop: "30px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "center",
                gap: "30px",
                flexWrap: "wrap",
                alignItems:
                  "flex-start",
              }}
            >
              <div>
                <h3
                  style={{
                    color: "#cbd5e1",
                    textAlign:
                      "center",
                  }}
                >
                  Foto original
                </h3>

                <img
                  src={preview}
                  alt="Foto original"
                  style={{
                    width: "400px",
                    maxWidth: "100%",
                    borderRadius: "10px",
                    background:
                      "#ffffff",
                  }}
                />
              </div>

              {resultadoIA && (
                <div>
                  <h3
                    style={{
                      color: "#67e8f9",
                      textAlign:
                        "center",
                    }}
                  >
                    Resultado IA
                  </h3>

                  <img
  src={resultadoIA}
  alt="Foto processada"
  style={{
    width: "400px",
    maxWidth: "100%",
    borderRadius: "10px",

    backgroundColor: "#ffffff",

    backgroundImage: `
      linear-gradient(45deg,#d1d5db 25%,transparent 25%),
      linear-gradient(-45deg,#d1d5db 25%,transparent 25%),
      linear-gradient(45deg,transparent 75%,#d1d5db 75%),
      linear-gradient(-45deg,transparent 75%,#d1d5db 75%)
    `,

    backgroundSize: "24px 24px",

    backgroundPosition:
      "0 0, 0 12px, 12px -12px, -12px 0px",
  }}
/>
                </div>
              )}
            </div>

            {resultadoIA && (
              <div
                style={{
                  marginTop: "25px",
                  background:
                    "linear-gradient(135deg,#14532d,#166534)",
                  border:
                    "1px solid #22c55e",
                  borderRadius: "16px",
                  padding: "18px",
                  textAlign: "center",
                }}
              >
                <h3
                  style={{
                    color: "#ffffff",
                    marginTop: 0,
                    marginBottom:
                      "10px",
                  }}
                >
                  🤖 Missão concluída!
                </h3>

                <p
                  style={{
                    color: "#dcfce7",
                    margin: 0,
                    fontSize: "15px",
                  }}
                >
                  Sua Foto IA foi produzida com sucesso e já está salva na Galeria.
                  Próxima missão: criar o Banner Studio.
                </p>
              </div>
            )}

            <div
              style={{
                marginTop: "25px",
                display: "flex",
                justifyContent:
                  "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={
                  limparTelaFoto
                }
                disabled={processando}
                style={buttonRed}
              >
                🧹 Limpar
              </button>

              {resultadoIA && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      baixarImagem(
                        resultadoIA
                      )
                    }
                    style={
                      buttonGreen
                    }
                  >
                    ⬇️ Baixar Resultado
                  </button>

                  <button
                    type="button"
                    onClick={
                      abrirBanner
                    }
                    style={{
                      background:
                        "#2563eb",
                      color: "#ffffff",
                      border: "none",
                      padding:
                        "12px 18px",
                      borderRadius:
                        "10px",
                      cursor: "pointer",
                      fontWeight:
                        "bold",
                    }}
                  >
                    🚀 Continuar para Banner Studio
                  </button>
                </>
              )}
            </div>
          </div>
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
          onClick={() => setScreen("home")}
          style={{
            padding: "16px 26px",
            borderRadius: "14px",
            border: "none",
            background:
              "linear-gradient(135deg,#475569,#334155)",
            color: "#ffffff",
            fontWeight: "bold",
            cursor: "pointer",
            fontSize: "16px",
          }}
        >
          🏠 Início
        </button>

        <button
          type="button"
          onClick={() =>
            setScreen("galeria")
          }
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
  console.log(
    "SALVANDO FOTO:",
    resultadoIA
  );

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
          ? JSON.parse(
              projetoSalvo
            )
          : null;

      if (projetoAtual) {
        const projetoAtualizado = {
          ...projetoAtual,
          foto_pronta: true,
          foto_url:
            resultadoIA,
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
          ➡️ Montar Anúncio
        </button>
      </div>
    </div>
  );
}