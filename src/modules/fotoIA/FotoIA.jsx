import { useEffect, useRef, useState } from "react";
import useFotoState from "./hooks/useFotoState";
import TirarFotoCamera from "./components/TirarFotoCamera";

// (10/11) Celular: câmera + Galeria. Computador: só a escolha de arquivos.
function useEhCelular() {
  const consulta = "(pointer: coarse), (max-width: 767px)";
  const [celular, setCelular] = useState(() => Boolean(globalThis.matchMedia?.(consulta)?.matches));
  useEffect(() => {
    const mq = globalThis.matchMedia?.(consulta);
    if (!mq) return undefined;
    const mudar = () => setCelular(mq.matches);
    mq.addEventListener?.("change", mudar);
    return () => mq.removeEventListener?.("change", mudar);
  }, []);
  return celular;
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
  processarSelecionadas,
  statusProcesso,
  resultadosFotos,
  setResultadosFotos,
  resultadoIA,
  limparTelaFoto,
  processando,
  baixarImagem,
  cardStyle,
  buttonGreen,
  buttonRed,
  produtoCopilot,
  setScreen,
  usuarioId,
}) {
  const {
    imagemAmpliada,
    setImagemAmpliada,
  } = useFotoState();
  // (09/11) "Escolher Foto" abre a escolha de sempre (lotes de até 8).
  const escolherRef = useRef(null);

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

  const celular = useEhCelular();
  const qtdFotos = arquivosFotos.length;

  return (
    <div data-paiia-foto-tela={celular ? "celular" : "computador"} style={{ marginTop: celular ? "24px" : "20px", maxWidth: "980px", marginLeft: "auto", marginRight: "auto" }}>
      <h2
        style={{
          color: "#67e8f9",
          fontSize: celular ? "26px" : "28px",
          margin: "0 0 12px",
        }}
      >
        📸 Foto IA
      </h2>

      {/* (10/11) Câmera e Galeria só no celular; no computador, só a escolha de arquivos. */}
      {celular && (
        <TirarFotoCamera
          usuarioId={usuarioId}
          aoEscolherFoto={() => escolherRef.current?.click()}
          abrirGaleria={abrirGaleria}
        />
      )}

      {produtoCopilot && (
        <div
          style={{
            background: "#0f172a",
            border: "1px solid #67e8f9",
            borderRadius: "12px",
            padding: "10px 14px",
            marginBottom: "12px",
            color: "#e2e8f0",
          }}
        >
          <strong style={{ color: "#67e8f9" }}>
            🤖 Produto recebido do Copilot:
          </strong>{" "}
          {produtoCopilot}
        </div>
      )}

      <div
        data-paiia-foto-area
        style={{
          ...cardStyle,
          maxWidth: "980px",
          margin: "0 auto",
          padding: celular ? "14px" : "18px",
          boxSizing: "border-box",
        }}
      >
        <input
          type="file"
          multiple
          accept="image/*"
          ref={escolherRef}
          onChange={selecionarFotos}
          disabled={processando}
          style={{ display: "none" }}
          data-paiia-foto-arquivos
        />

        {!celular && (
          <button
            type="button"
            data-paiia-escolher-arquivos
            onClick={() => escolherRef.current?.click()}
            disabled={processando}
            style={{
              width: "100%",
              padding: "18px 16px",
              borderRadius: "14px",
              border: "2px dashed #38bdf8",
              background: "#0b1a33",
              color: "#e0f2fe",
              fontSize: "18px",
              fontWeight: 800,
              cursor: processando ? "not-allowed" : "pointer",
            }}
          >
            📁 Escolher Arquivos — Até 8 Fotos
            <span style={{ display: "block", marginTop: "4px", fontSize: "13px", fontWeight: 600, color: "#94a3b8" }}>
              {qtdFotos ? `${qtdFotos} foto${qtdFotos > 1 ? "s" : ""} escolhida${qtdFotos > 1 ? "s" : ""} — clique para trocar` : "JPG, PNG ou WEBP"}
            </span>
          </button>
        )}

        {qtdFotos > 0 && (
          <div
            data-paiia-foto-miniaturas
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginTop: "12px",
            }}
          >
            {arquivosFotos.map((foto, index) => (
              <img
                key={`${foto.file?.name || "foto"}-${index}`}
                src={foto.preview}
                alt={`Foto selecionada ${index + 1}`}
                onClick={() => setImagemAmpliada(foto.preview)}
                style={{
                  width: celular ? "72px" : "96px",
                  height: celular ? "72px" : "96px",
                  objectFit: "contain",
                  background: "#ffffff",
                  borderRadius: "8px",
                  border: "1px solid #2563eb",
                  cursor: "zoom-in",
                }}
              />
            ))}
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "10px",
            marginTop: "12px",
          }}
        >
          <select
            value={tipoFundoFoto}
            onChange={(evento) =>
              setTipoFundoFoto(evento.target.value)
            }
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              background: "#0f172a",
              color: "#ffffff",
              border: "1px solid #2563eb",
            }}
          >
            <option value="branco">🎨 Fundo Branco</option>
            <option value="transparente">
              ✨ Fundo Transparente
            </option>
          </select>

          {/* (10/11) Modo Econômico (padrão): remove o fundo sem IA generativa e mantém a peça original. */}
          <div
            data-paiia-foto-modo="economico"
            title="Recorte no próprio aparelho, sem créditos — mantém a peça original (PNG 1200 × 1200)"
            style={{
              padding: "9px 12px",
              borderRadius: "10px",
              background: "#052e16",
              color: "#bbf7d0",
              border: "1px solid #16a34a",
              fontSize: "13px",
              maxWidth: "100%",
            }}
          >
            🟢 Modo Econômico · sem créditos · PNG 1200 × 1200
          </div>

          {typeof setAplicarSombra === "function" && (
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
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
        </div>

        <button
          type="button"
          data-paiia-produzir-foto
          style={{
            ...buttonGreen,
            display: "block",
            width: "100%",
            marginTop: "12px",
            fontSize: "17px",
            opacity: processando || qtdFotos === 0 ? 0.6 : 1,
          }}
          onClick={processarSelecionadas}
          disabled={
            processando || qtdFotos === 0
          }
        >
          {processando
            ? "🤖 Produzindo Foto IA..."
            : qtdFotos
              ? `📸 Produzir Foto IA (${qtdFotos})`
              : "📸 Produzir Foto IA"}
        </button>

        {statusProcesso && (
          <div
            style={{
              marginTop: "12px",
              padding: "12px",
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
          <div style={{ marginTop: "18px" }}>
            <h3
              style={{
                color: "#67e8f9",
                textAlign: "center",
                margin: "0 0 12px",
              }}
            >
              ✅ Resultados processados
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: "14px",
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
                      borderRadius: "14px",
                      padding: "12px",
                    }}
                  >
                    <h4
                      style={{
                        color: "#ffffff",
                        textAlign: "center",
                        marginTop: 0,
                        marginBottom: "10px",
                      }}
                    >
                      Foto {index + 1}
                    </h4>

                    <div
                      style={{
                        display: "flex",
                        gap: celular ? "8px" : "12px",
                        width: "100%",
                        alignItems: "flex-start",
                      }}
                      data-paiia-foto-lado-a-lado
                    >
                      <div style={{ flex: "1 1 0", minWidth: 0 }}>
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
                              height: celular ? "170px" : "260px",
                              objectFit: "contain",
                              borderRadius: "12px",
                              background: "#ffffff",
                              cursor: "zoom-in",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              height: celular ? "170px" : "260px",
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

                      <div style={{ flex: "1 1 0", minWidth: 0 }}>
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
                              minHeight: celular ? "170px" : "260px",
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
                              height: celular ? "170px" : "260px",
                              objectFit: "contain",
                              borderRadius: "12px",
                              background: "#ffffff",
                              cursor: "zoom-in",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              height: celular ? "170px" : "260px",
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
                        marginTop: "10px",
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

        </div>
      ) : null}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "12px",
          flexWrap: "wrap",
          marginTop: "14px",
        }}
      >
        <button
          type="button"
          onClick={abrirGaleria}
          style={{
            padding: "11px 20px",
            borderRadius: "12px",
            border: "none",
            background:
              "linear-gradient(135deg,#2563eb,#22d3ee)",
            color: "#ffffff",
            fontWeight: "bold",
            cursor: "pointer",
            fontSize: "15px",
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
            padding: "11px 20px",
            borderRadius: "12px",
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
