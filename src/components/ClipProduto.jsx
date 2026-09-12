import { useEffect, useMemo, useRef, useState } from "react";

import CardMovimentoClip from "./clipPremium/CardMovimentoClip";
import "./clipPremium/clipPremium.css";
import { baixarClip as baixarClipArquivo } from "./utils/downloadUtils";
import { MOVIMENTOS_CLIP_PREMIUM } from "../services/clipPremium/catalogoMovimentos";
import {
  rotuloCustoClipPremium,
  gerarVideoClipPremium,
} from "../services/clipPremium/provedorVideoClip";
import { recomendarMovimentoClipPremium } from "../services/clipPremium/recomendarMovimento";
import {
  consumirNovaCriacaoMidia,
  deveIniciarNovaCriacaoMidia,
  sessaoMidiaDeveContinuar,
} from "../services/limparEstadoTemporarioMidia";
import {
  FORMATOS_CLIP,
  consultarCreditosClip,
  criarCenaProduto,
  erroSensivelE005,
  garantirImagemPublicaProduto,
  mensagemAmigavelClip,
  montarInstrucoesClipProduto,
  montarInstrucoesNeutrasMarketplace,
  obterMensagemErro,
  obterUsuarioAtualClip,
  salvarClipProdutoNaGaleria,
} from "../services/clipProdutoPipeline";

const LIMIAR_SALDO_BAIXO = 3;

const DESTINOS_USO_CLIP_PREMIUM = [
  {
    id: "quadrado",
    destino: "Marketplace",
    detalhe: "Mercado Livre e outros marketplaces",
    proporcaoLabel: "Quadrado • 1:1",
    recomendado: true,
  },
  {
    id: "vertical",
    destino: "Reels / Stories",
    detalhe: "Instagram, Facebook e vídeos verticais",
    proporcaoLabel: "Vertical • 9:16",
    recomendado: false,
  },
  {
    id: "feed",
    destino: "Instagram Feed",
    detalhe: "Publicações do feed",
    proporcaoLabel: "Retrato • 4:5",
    recomendado: false,
  },
  {
    id: "horizontal",
    destino: "WhatsApp / Site",
    detalhe: "Sites, WhatsApp e apresentações",
    proporcaoLabel: "Horizontal • 16:9",
    recomendado: false,
  },
];

export default function ClipProduto({
  cardStyle,
  setScreen,
  embutido = false,
}) {
  const inputFotoRef = useRef(null);
  const [imagemClip, setImagemClip] = useState("");
  const [formatoClip, setFormatoClip] = useState("quadrado");
  const [movimentoProdutoVisual, setMovimentoProdutoVisual] =
    useState("giro-suave");
  const [recomendacao, setRecomendacao] = useState({
    id: "giro-suave",
    nome: "Giro Suave",
    motivo:
      "Mantém esta peça inteira no enquadramento e valoriza seus detalhes.",
  });
  const [processando, setProcessando] = useState(false);
  const [carregandoCreditos, setCarregandoCreditos] = useState(false);
  const [saldoCreditos, setSaldoCreditos] = useState(null);
  const [mostrarModalCreditos, setMostrarModalCreditos] = useState(false);
  const [statusClip, setStatusClip] = useState("");
  const [videosGerados, setVideosGerados] = useState([]);

  const formatoSelecionado =
    FORMATOS_CLIP.find((item) => item.id === formatoClip) || FORMATOS_CLIP[0];
  const cenas = useMemo(
    () => [criarCenaProduto(0), criarCenaProduto(1), criarCenaProduto(2)],
    []
  );
  const duracaoTotal = 9;
  const saldoZero = saldoCreditos === 0;
  const saldoBaixo =
    saldoCreditos !== null && saldoCreditos > 0 && saldoCreditos < LIMIAR_SALDO_BAIXO;
  const estiloCard = {
    ...cardStyle,
    background: "#0f172a",
    borderRadius: "18px",
    border: "1px solid #334155",
  };

  function persistirEstado() {
    if (imagemClip) {
      localStorage.setItem("imagemClipProdutoSelecionada", imagemClip);
    }
    localStorage.setItem("clipPremiumMovimento", movimentoProdutoVisual);
    localStorage.setItem("clipPremiumFormato", formatoClip);
  }

  function importarFoto(event) {
    const arquivo = event.target.files?.[0];
    event.target.value = "";
    if (!arquivo?.type?.startsWith("image/")) {
      return;
    }
    const url = URL.createObjectURL(arquivo);
    setImagemClip(url);
    localStorage.setItem("imagemClipProdutoSelecionada", url);
  }

  function abrirGaleria() {
    persistirEstado();
    localStorage.setItem("modoGaleria", "clipIA");
    localStorage.setItem("paiiaAbaMidias", "produto");
    localStorage.setItem(
      "retornoCriacaoMidia",
      embutido ? "midiasAppia" : "clipIA"
    );
    localStorage.setItem("retornarParaClipIA", "true");
    setScreen?.("galeria");
  }

  function verNaGaleria() {
    persistirEstado();
    localStorage.removeItem("modoGaleria");
    localStorage.setItem("paiiaAbaMidias", "produto");
    localStorage.setItem("abrirGaleriaNaAba", "video");
    localStorage.setItem("filtroGaleria", "video");
    localStorage.setItem(
      "retornoCriacaoMidia",
      embutido ? "midiasAppia" : "clipIA"
    );
    setScreen?.("galeria");
  }

  function gerarOutroClip() {
    persistirEstado();
    setVideosGerados([]);
    setStatusClip("");
    setProcessando(false);
  }

  async function baixarClipGerado() {
    const urlVideo = videosGerados[0]?.video;
    if (!urlVideo) {
      alert("Nenhum Clip disponível para download.");
      return;
    }

    try {
      await baixarClipArquivo(urlVideo);
    } catch (erro) {
      alert(erro?.message || "Não foi possível baixar o Clip.");
    }
  }

  function abrirPlanosCreditos() {
    persistirEstado();
    localStorage.setItem("paiiaAbaMidias", "produto");
    localStorage.setItem(
      "voltarParaCriacaoClip",
      embutido ? "midiasAppia" : "clipIA"
    );
    localStorage.setItem("paiiaRestaurarCriacaoClip", "true");
    localStorage.setItem("abrirSecaoCreditosVideo", "true");
    setMostrarModalCreditos(false);
    setScreen?.("planosPagamentos");
  }

  useEffect(() => {
    const continuar = sessaoMidiaDeveContinuar();
    const nova = deveIniciarNovaCriacaoMidia();

    if (nova && !continuar) {
      setImagemClip("");
      setVideosGerados([]);
      setStatusClip("");
      setProcessando(false);
      setFormatoClip("quadrado");
      setMovimentoProdutoVisual("giro-suave");
      consumirNovaCriacaoMidia();
      return;
    }

    const salvo =
      localStorage.getItem("imagemClipProdutoSelecionada") ||
      (localStorage.getItem("paiiaAbaMidias") === "produto"
        ? localStorage.getItem("imagemClipSelecionada") || ""
        : "");

    if (salvo) {
      setImagemClip(salvo);
    }

    if (!nova || continuar) {
      setFormatoClip(
        localStorage.getItem("clipPremiumFormato") || "quadrado"
      );
      setMovimentoProdutoVisual(
        localStorage.getItem("clipPremiumMovimento") || "giro-suave"
      );
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    async function carregarCreditos() {
      setCarregandoCreditos(true);
      try {
        const saldo = await consultarCreditosClip();
        if (ativo) {
          setSaldoCreditos(saldo);
        }
      } catch {
        if (ativo) {
          setSaldoCreditos(null);
        }
      } finally {
        if (ativo) {
          setCarregandoCreditos(false);
        }
      }
    }
    carregarCreditos();
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    let ativo = true;
    async function analisar() {
      const rec = await recomendarMovimentoClipPremium(imagemClip);
      if (ativo) {
        setRecomendacao(rec);
      }
    }
    analisar();
    return () => {
      ativo = false;
    };
  }, [imagemClip]);

  async function gerarVersao(tentativaNeutra = false) {
    const estilo = {
      id: "marketplace",
      titulo: "Clip Premium",
    };
    const instrucoes = tentativaNeutra
      ? `${montarInstrucoesNeutrasMarketplace()} ${montarInstrucoesClipProduto({
          estilo,
          cenas,
          formato: formatoSelecionado,
          trilhaClip: "sem-musica",
          duracaoTotal,
          mostrarTextos: false,
          tituloClip: "",
          subtituloClip: "",
          movimentoProdutoVisual,
        })}`
      : montarInstrucoesClipProduto({
          estilo,
          cenas,
          formato: formatoSelecionado,
          trilhaClip: "sem-musica",
          duracaoTotal,
          mostrarTextos: false,
          tituloClip: "",
          subtituloClip: "",
          movimentoProdutoVisual,
        });

    const imagemPublica = await garantirImagemPublicaProduto(imagemClip);
    const { data, error } = await gerarVideoClipPremium({
      imageUrl: imagemPublica,
      estilo: estilo.id,
      duracao: duracaoTotal,
      formato: formatoSelecionado.id,
      instrucoes,
      movimentoProdutoVisual,
    });

    const videoResultado = data?.video || data?.video_url || "";

    if (error || !data?.sucesso || !videoResultado) {
      const mensagemOriginal = obterMensagemErro(
        data || { erro: error?.message }
      );
      if (!tentativaNeutra && erroSensivelE005(mensagemOriginal)) {
        setStatusClip(
          "⚠️ O PAIIA recusou a primeira tentativa. Tentando uma apresentação neutra do produto..."
        );
        return gerarVersao(true);
      }
      throw new Error(mensagemAmigavelClip(mensagemOriginal));
    }

    if (data?.saldo != null) {
      setSaldoCreditos(Math.max(0, Number(data.saldo)));
    }

    return {
      id: "clip-premium",
      video: videoResultado,
      formato: formatoSelecionado,
      duracao: duracaoTotal,
    };
  }

  async function gerarClip() {
    if (processando) {
      return;
    }
    if (!imagemClip) {
      alert("Escolha uma foto para gerar o vídeo.");
      return;
    }

    if (saldoCreditos !== null && saldoCreditos < 1) {
      setMostrarModalCreditos(true);
      return;
    }

    setProcessando(true);

    try {
      setCarregandoCreditos(true);
      const saldoAtual = await consultarCreditosClip();
      setSaldoCreditos(saldoAtual);
      if (saldoAtual < 1) {
        setMostrarModalCreditos(true);
        setProcessando(false);
        return;
      }
    } catch (erro) {
      alert(
        erro?.message || "Não foi possível verificar seus créditos PAIIA."
      );
      setProcessando(false);
      return;
    } finally {
      setCarregandoCreditos(false);
    }

    setVideosGerados([]);
    setStatusClip("🧠 IA analisando a peça...");

    try {
      setStatusClip("🎬 Gerando Clip Premium...");
      persistirEstado();
      const resultado = await gerarVersao();
      setVideosGerados([resultado]);
      const usuario = await obterUsuarioAtualClip();
      await salvarClipProdutoNaGaleria({
        usuarioId: usuario.id,
        imagemOriginal: imagemClip,
        urlClip: resultado.video,
        estilo: "clip-premium",
      });
      setStatusClip("✅ Clip salvo automaticamente na Galeria");
    } catch (erro) {
      setStatusClip(`❌ ${erro?.message || "Erro ao gerar o Clip Premium."}`);
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div>
      <h3
        style={{
          color: "#fde68a",
          margin: "0 0 6px",
          fontSize: "22px",
        }}
      >
        ✨ Clip Premium
      </h3>
      <p style={{ color: "#cbd5e1", margin: "0 0 4px", fontSize: "14px" }}>
        Vídeo profissional do seu produto, pronto para anunciar.
      </p>
      <p style={{ color: "#94a3b8", margin: "0 0 16px", fontSize: "14px" }}>
        Escolha o movimento. O Paizinho cuida do resto.
      </p>

      <div style={{ ...estiloCard, padding: "18px", marginBottom: "16px" }}>
          <h3
            style={{
              color: imagemClip ? "#22c55e" : "#67e8f9",
              marginTop: 0,
              textAlign: "center",
            }}
          >
            {imagemClip ? "✅ Foto selecionada" : "Foto do produto"}
          </h3>
          <div
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              padding: "12px",
              minHeight: "280px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {imagemClip ? (
              <img
                src={imagemClip}
                alt="Peça"
                style={{
                  display: "block",
                  width: "100%",
                  maxHeight: "360px",
                  objectFit: "contain",
                  borderRadius: "10px",
                }}
              />
            ) : (
              <div style={{ color: "#64748b", textAlign: "center" }}>
                Nenhuma foto selecionada
              </div>
            )}
          </div>
          <input
            ref={inputFotoRef}
            type="file"
            accept="image/*"
            onChange={importarFoto}
            style={{ display: "none" }}
          />
          <button
            type="button"
            onClick={() => inputFotoRef.current?.click()}
            style={botaoAcao("#22c55e", "#052e16", "#bbf7d0")}
          >
            💻 Importar Foto
          </button>
          <button
            type="button"
            onClick={abrirGaleria}
            style={botaoAcao("#38bdf8", "#082f49", "#bae6fd")}
          >
            🖼️ Escolher da Galeria
          </button>
      </div>

      <section style={{ ...estiloCard, padding: "22px", marginBottom: "16px" }}>
        <h4 style={{ ...tituloSecao, marginTop: 0 }}>
          Onde você vai usar este vídeo?
        </h4>
        <p
          style={{
            color: "#94a3b8",
            margin: "0 0 12px",
            fontSize: "13px",
            lineHeight: 1.45,
          }}
        >
          Escolha onde pretende publicar. O PAIIA ajusta o tamanho do vídeo
          automaticamente.
        </p>
        <div
          className="paiia-mobile-2cols"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "10px",
          }}
        >
          {DESTINOS_USO_CLIP_PREMIUM.map((destino) => {
            const ativo = formatoClip === destino.id;
            return (
              <button
                key={destino.id}
                type="button"
                onClick={() => setFormatoClip(destino.id)}
                style={{
                  ...botaoSelecao(ativo),
                  textAlign: "left",
                  padding: "12px",
                  border: ativo
                    ? "2px solid #22d3ee"
                    : destino.recomendado
                      ? "1px solid #fbbf24"
                      : "1px solid #334155",
                  background: ativo
                    ? "#164e63"
                    : destino.recomendado
                      ? "#1c1917"
                      : "#020617",
                }}
              >
                <strong style={{ display: "block", fontSize: "14px" }}>
                  {destino.destino}
                </strong>
                <span
                  style={{
                    display: "block",
                    marginTop: "4px",
                    color: "#cbd5e1",
                    fontSize: "12px",
                    fontWeight: 500,
                    lineHeight: 1.4,
                  }}
                >
                  {destino.detalhe}
                </span>
                <span
                  style={{
                    display: "block",
                    marginTop: "6px",
                    color: "#94a3b8",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  {destino.proporcaoLabel}
                </span>
                {destino.recomendado ? (
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: "8px",
                      color: "#fde68a",
                      fontSize: "11px",
                      fontWeight: 800,
                    }}
                  >
                    ⭐ Recomendado
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      <section style={{ ...estiloCard, padding: "22px", marginBottom: "16px" }}>
          <h4 style={{ ...tituloSecao, marginTop: 0 }}>Movimento do Produto</h4>
          <div
            className="paiia-mobile-2cols"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "10px",
            }}
          >
            {MOVIMENTOS_CLIP_PREMIUM.map((item) => (
              <CardMovimentoClip
                key={item.id}
                movimento={item}
                selecionado={movimentoProdutoVisual === item.id}
                recomendado={recomendacao?.id === item.id}
                onSelect={() => setMovimentoProdutoVisual(item.id)}
              />
            ))}
          </div>

          {recomendacao ? (
            <div
              style={{
                marginTop: "16px",
                marginBottom: "16px",
                padding: "12px 14px",
                borderRadius: "12px",
                border: "1px solid #fbbf24",
                background: "rgba(120,53,15,.35)",
              }}
            >
              <div style={{ color: "#fde68a", fontWeight: 800, fontSize: "13px" }}>
                ⭐ Recomendado pelo Paizinho
              </div>
              <div style={{ color: "#fff7ed", marginTop: "4px", fontWeight: 700 }}>
                Recomendado: {recomendacao.nome}
              </div>
              <p
                style={{
                  margin: "6px 0 0",
                  color: "#fed7aa",
                  fontSize: "13px",
                  lineHeight: 1.45,
                }}
              >
                “{recomendacao.motivo}”
              </p>
              <button
                type="button"
                onClick={() => setMovimentoProdutoVisual(recomendacao.id)}
                style={{
                  marginTop: "10px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #fbbf24",
                  background: "#78350f",
                  color: "#fffbeb",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Usar recomendação
              </button>
            </div>
          ) : null}
      </section>

      <section style={{ ...estiloCard, padding: "22px" }}>
          <div
            style={{
              marginBottom: "14px",
              padding: "14px 18px",
              borderRadius: "14px",
              border: saldoZero ? "1px solid #f59e0b" : "1px solid #2563eb",
              background: saldoZero ? "#451a03" : "#0f172a",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <strong
                style={{
                  color: saldoZero ? "#fde68a" : "#67e8f9",
                  fontSize: "15px",
                }}
              >
                💎 Créditos PAIIA:{" "}
                {carregandoCreditos ? "..." : saldoCreditos ?? "—"}
              </strong>
              {saldoBaixo ? (
                <div style={{ color: "#fde68a", fontSize: "12px", marginTop: "4px" }}>
                  Saldo baixo. Recomendamos adicionar créditos antes de gerar.
                </div>
              ) : null}
              {saldoZero ? (
                <div style={{ color: "#fde68a", fontSize: "12px", marginTop: "4px" }}>
                  Sem créditos. Você pode gerar depois de adicionar créditos.
                </div>
              ) : null}
            </div>
            {(saldoBaixo || saldoZero) && (
              <button
                type="button"
                onClick={abrirPlanosCreditos}
                style={botaoCredito}
              >
                {saldoZero ? "Adicionar créditos" : "Comprar créditos"}
              </button>
            )}
          </div>

          <div
            style={{
              color: "#e2e8f0",
              fontWeight: 700,
              fontSize: "14px",
            }}
          >
            {rotuloCustoClipPremium()}
          </div>
          <p style={{ color: "#64748b", fontSize: "12px", margin: "6px 0 0" }}>
            O custo em créditos será definido após os testes reais de qualidade.
          </p>

          {!processando ? (
            <button
              type="button"
              onClick={gerarClip}
              disabled={carregandoCreditos}
              style={{
                width: "100%",
                marginTop: "14px",
                padding: "16px 20px",
                borderRadius: "13px",
                border: "none",
                background: "linear-gradient(135deg,#2563eb,#22d3ee)",
                color: "#ffffff",
                fontWeight: "bold",
                cursor: carregandoCreditos ? "wait" : "pointer",
                fontSize: "16px",
                opacity: carregandoCreditos ? 0.7 : 1,
              }}
            >
              {carregandoCreditos
                ? "💎 Verificando créditos..."
                : "🎬 Gerar Clip Premium"}
            </button>
          ) : (
            <p style={{ color: "#67e8f9", marginTop: "18px" }}>
              🎬 Gerando seu Clip Premium...
            </p>
          )}

          {saldoZero ? (
            <button
              type="button"
              onClick={abrirPlanosCreditos}
              style={{
                ...botaoAcao("#f59e0b", "#451a03", "#fde68a"),
                marginTop: "10px",
              }}
            >
              Adicionar créditos
            </button>
          ) : null}
      </section>

      {statusClip ? (
        <div
          style={{
            ...estiloCard,
            padding: "16px",
            marginTop: "20px",
            color: "#bfdbfe",
            textAlign: "center",
            fontWeight: "bold",
          }}
        >
          {statusClip}
        </div>
      ) : null}

      {videosGerados.length > 0 ? (
        <section style={{ ...estiloCard, padding: "24px", marginTop: "22px" }}>
          <h3
            style={{
              color: "#22c55e",
              textAlign: "center",
              marginTop: 0,
            }}
          >
            ✅ Clip salvo automaticamente na Galeria
          </h3>
          {videosGerados.map((item) => (
            <video
              key={item.id}
              src={item.video}
              controls
              loop
              playsInline
              style={{
                display: "block",
                width: "100%",
                maxWidth: "560px",
                margin: "0 auto",
                borderRadius: "11px",
                background: "#000",
              }}
            />
          ))}
          <div
            style={{
              display: "flex",
              gap: "10px",
              justifyContent: "center",
              flexWrap: "wrap",
              marginTop: "16px",
            }}
          >
            <button
              type="button"
              onClick={baixarClipGerado}
              style={botaoPosGeracao("#22d3ee", "#083344", "#e0f2fe")}
            >
              ⬇️ Baixar Clip
            </button>
            <button
              type="button"
              onClick={verNaGaleria}
              style={botaoPosGeracao("#38bdf8", "#082f49", "#bae6fd")}
            >
              🖼️ Ver na Galeria
            </button>
            <button
              type="button"
              onClick={gerarOutroClip}
              style={botaoPosGeracao("#22c55e", "#052e16", "#bbf7d0")}
            >
              🎬 Gerar outro Clip
            </button>
          </div>
        </section>
      ) : null}

      {mostrarModalCreditos ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(2,6,23,.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "420px",
              padding: "24px",
              borderRadius: "16px",
              border: "1px solid #38bdf8",
              background: "#0f172a",
              textAlign: "center",
            }}
          >
            <p
              style={{
                margin: "0 0 18px",
                color: "#f8fafc",
                fontSize: "16px",
                lineHeight: 1.5,
                fontWeight: "bold",
              }}
            >
              Seus créditos acabaram. Adicione créditos para continuar. Foto,
              movimento e formato serão mantidos.
            </p>
            <button
              type="button"
              onClick={abrirPlanosCreditos}
              style={{
                width: "100%",
                padding: "13px 16px",
                borderRadius: "11px",
                border: "none",
                background: "linear-gradient(135deg,#2563eb,#22d3ee)",
                color: "#ffffff",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Adicionar créditos
            </button>
            <button
              type="button"
              onClick={() => setMostrarModalCreditos(false)}
              style={{
                width: "100%",
                marginTop: "10px",
                padding: "11px 16px",
                borderRadius: "11px",
                border: "1px solid #334155",
                background: "#020617",
                color: "#cbd5e1",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function botaoSelecao(ativo) {
  return {
    padding: "11px",
    borderRadius: "10px",
    border: ativo ? "1px solid #22d3ee" : "1px solid #334155",
    background: ativo ? "#164e63" : "#020617",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: "bold",
    textAlign: "center",
  };
}

function botaoAcao(borda, fundo, cor) {
  return {
    width: "100%",
    marginTop: "10px",
    padding: "12px",
    borderRadius: "10px",
    border: `1px solid ${borda}`,
    background: fundo,
    color: cor,
    fontWeight: "bold",
    cursor: "pointer",
  };
}

function botaoPosGeracao(borda, fundo, cor) {
  return {
    minWidth: "180px",
    padding: "12px 16px",
    borderRadius: "10px",
    border: `1px solid ${borda}`,
    background: fundo,
    color: cor,
    fontWeight: "bold",
    cursor: "pointer",
  };
}

const botaoCredito = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "none",
  background: "linear-gradient(135deg,#2563eb,#22d3ee)",
  color: "#ffffff",
  fontWeight: "bold",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const tituloSecao = {
  color: "#67e8f9",
  marginTop: "18px",
  marginBottom: "9px",
};
