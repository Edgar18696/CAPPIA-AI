import { useEffect, useRef, useState } from "react";

import { supabase } from "../supabase";
import { inferirPedidoPaizinho } from "../services/paizinhoIntencao";
import {
  buscarLogoOficial,
  publicarImagemLogo,
  salvarLogoOficial,
} from "../services/logoMarcaService";
import {
  buscarMascoteOficial,
  obterUsuarioMascote,
  publicarImagemMascote,
  salvarMascoteOficial,
} from "../services/mascoteMarcaService";

const ESTILOS = [
  "Moderno e forte",
  "Profissional",
  "Tecnologia automotiva",
  "Amigável",
  "Premium",
];

function botaoTipo(ativo) {
  return {
    padding: "12px 10px",
    borderRadius: "12px",
    border: ativo ? "2px solid #22d3ee" : "1px solid #334155",
    background: ativo ? "#083344" : "#020617",
    color: "#e0f2fe",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: "14px",
  };
}

async function publicarSePrecisar(userId, imagem, publicar) {
  if (!imagem) {
    return "";
  }

  if (/^https?:\/\//i.test(imagem)) {
    return imagem;
  }

  return publicar({
    userId,
    imagem,
  });
}

async function gerarOpcoesImagem({
  tipo,
  empresa,
  nome,
  descricao,
  cores,
  estilo,
  referenciaUrl,
  logoOficialUrl,
}) {
  const funcao =
    tipo === "logo" ? "gerar-logo-ia" : "gerar-mascote-ia";
  const fotoReferenciaUrl =
    tipo === "mascote" ? referenciaUrl || "" : "";
  const logoUrl =
    tipo === "logo"
      ? referenciaUrl || ""
      : logoOficialUrl && logoOficialUrl !== referenciaUrl
      ? logoOficialUrl
      : "";
  const body = {
    empresa: empresa || "",
    nome: nome || "",
    descricao,
    cores: cores || "",
    estilo: estilo || "",
    logoUrl,
    fotoReferenciaUrl,
  };

  let { data, error } = await supabase.functions.invoke(
    funcao,
    { body }
  );

  if (
    tipo === "logo" &&
    (error || !data?.sucesso || !data?.opcoes?.length)
  ) {
    const fallback = await supabase.functions.invoke(
      "gerar-mascote-ia",
      {
        body: {
          ...body,
          descricao: `CREATE A BRAND LOGO ONLY, NOT A MASCOT OR CHARACTER. Clean commercial logo. ${descricao}`,
        },
      }
    );
    data = fallback.data;
    error = fallback.error;
  }

  if (error || !data?.sucesso || !data?.opcoes?.length) {
    throw new Error(
      data?.erro ||
        error?.message ||
        "Não foi possível gerar as opções."
    );
  }

  return data;
}

export default function PaizinhoConversa({
  cardStyle,
  mascoteOficial,
  onMascoteSalvo,
  onIrParaClip,
  personalizarAberto,
  onPersonalizarAberto,
  children,
}) {
  const referenciaRef = useRef(null);
  const [ideia, setIdeia] = useState("");
  const [tipo, setTipo] = useState("mascote");
  const [referencia, setReferencia] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [cores, setCores] = useState("");
  const [estilo, setEstilo] = useState(ESTILOS[0]);
  const [status, setStatus] = useState("");
  const [opcoes, setOpcoes] = useState([]);
  const [escolhida, setEscolhida] = useState("");
  const [promptBase, setPromptBase] = useState("");
  const [pedidoAlteracao, setPedidoAlteracao] = useState("");
  const [mostrarAlteracao, setMostrarAlteracao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvoOficial, setSalvoOficial] = useState(null);
  const [logoOficial, setLogoOficial] = useState(null);
  const [inferido, setInferido] = useState(null);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    let ativo = true;

    async function carregarLogo() {
      try {
        const usuario = await obterUsuarioMascote();
        const logo = await buscarLogoOficial(usuario.id);
        if (ativo) {
          setLogoOficial(logo);
        }
      } catch {
        if (ativo) {
          setLogoOficial(null);
        }
      }
    }

    carregarLogo();

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    const dados = inferirPedidoPaizinho(ideia, {
      mascoteOficial,
      logoOficial,
    });
    setInferido(dados);
  }, [ideia, mascoteOficial, logoOficial]);

  async function executarGeracao({
    descricao,
    tipoForcado,
  } = {}) {
    const dados = inferirPedidoPaizinho(ideia, {
      mascoteOficial,
      logoOficial,
    });
    const tipoAtual = tipoForcado || tipo || dados.tipo;
    setTipo(tipoAtual);

    if (tipoAtual === "clip") {
      onIrParaClip?.({
        ideia: ideia.trim(),
        referencia,
      });
      return;
    }

    const descricaoFinal =
      String(descricao || "").trim() ||
      dados.descricao;

    if (!descricaoFinal) {
      alert("Conte sua ideia do seu jeito para o Paizinho começar.");
      return;
    }

    setGerando(true);
    setStatus("🤖 Paizinho preparando sua criação...");
    setOpcoes([]);
    setEscolhida("");
    setSalvoOficial(null);
    setMostrarAlteracao(false);

    try {
      const usuario = await obterUsuarioMascote();
      const referenciaUrl = await publicarSePrecisar(
        usuario.id,
        referencia,
        tipoAtual === "logo"
          ? publicarImagemLogo
          : publicarImagemMascote
      );

      if (referenciaUrl) {
        setReferencia(referenciaUrl);
      }

      const data = await gerarOpcoesImagem({
        tipo: tipoAtual,
        empresa: empresa.trim() || dados.empresa,
        nome: dados.nome,
        descricao: descricaoFinal,
        cores: cores.trim() || dados.cores,
        estilo: personalizarAberto ? estilo : dados.estilo || "",
        referenciaUrl,
        logoOficialUrl: logoOficial?.imagem_base || "",
      });

      setInferido({
        ...dados,
        tipo: tipoAtual,
        empresa: empresa.trim() || dados.empresa,
        descricao: descricaoFinal,
      });
      setPromptBase(data.prompt_base || "");
      setOpcoes(data.opcoes);
      setEscolhida(data.opcoes[0] || "");
      setStatus("");
    } catch (erro) {
      setStatus("");
      alert(
        erro?.message ||
          "Não foi possível gerar a criação."
      );
    } finally {
      setGerando(false);
    }
  }

  async function usarEste() {
    if (!escolhida) {
      return;
    }

    setSalvando(true);

    try {
      const usuario = await obterUsuarioMascote();
      const dados = inferido || inferirPedidoPaizinho(ideia, {
        mascoteOficial,
        logoOficial,
      });
      const tipoAtual = tipo || dados.tipo;

      if (tipoAtual === "logo") {
        const imagemPublica = await publicarImagemLogo({
          userId: usuario.id,
          imagem: escolhida,
        });
        const oficial = await salvarLogoOficial({
          userId: usuario.id,
          empresa: dados.empresa,
          imagemBase: imagemPublica,
          descricaoOriginal: dados.descricao,
          promptBase,
          cores: dados.cores,
          estiloVisual: estilo,
        });
        setLogoOficial(oficial);
        setSalvoOficial({ tipo: "logo", registro: oficial });
      } else {
        const imagemPublica = await publicarImagemMascote({
          userId: usuario.id,
          imagem: escolhida,
        });
        await salvarMascoteOficial({
          userId: usuario.id,
          nome: dados.nome,
          empresa: dados.empresa,
          imagemBase: imagemPublica,
          descricaoOriginal: dados.descricao,
          promptBase,
          cores: dados.cores,
          roupaAcessorios: "",
          logoAssociado: "",
          estiloVisual: estilo,
          caracteristicas: dados.descricao,
        });
        const oficial = await buscarMascoteOficial(usuario.id);
        setSalvoOficial({ tipo: "mascote", registro: oficial });
        onMascoteSalvo?.(oficial);
      }
    } catch (erro) {
      alert(
        erro?.message ||
          "Não foi possível salvar esta criação."
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      style={{
        ...cardStyle,
        padding: "22px",
        marginBottom: "22px",
      }}
    >
      <div
        style={{
          marginBottom: "18px",
          padding: "18px",
          borderRadius: "16px",
          border: "1px solid rgba(34,211,238,.45)",
          background:
            "linear-gradient(145deg,#082f49 0%,#0c4a6e 42%,#0f172a 100%)",
        }}
      >
        <div
          style={{
            color: "#67e8f9",
            fontSize: "22px",
            fontWeight: "bold",
          }}
        >
          🤖 PAIZINHO IA
        </div>
        <div
          style={{
            marginTop: "8px",
            color: "#e0f2fe",
            fontWeight: "bold",
            fontSize: "18px",
          }}
        >
          O que vamos criar hoje?
        </div>
        <p
          style={{
            margin: "6px 0 0",
            color: "#94a3b8",
            fontSize: "13px",
            lineHeight: 1.5,
          }}
        >
          Conte sua ideia do seu jeito. Eu preparo o restante para você.
        </p>
      </div>

      {gerando ? (
        <p
          style={{
            color: "#7dd3fc",
            fontSize: "16px",
            fontWeight: "bold",
            textAlign: "center",
            margin: "28px 0 12px",
          }}
        >
          🤖 Paizinho preparando sua criação...
        </p>
      ) : (
        <>
      <textarea
        value={ideia}
        onChange={(event) => setIdeia(event.target.value)}
        rows={4}
        placeholder="Ex.: Crie um mascote de uma vela de ignição com minha marca Tsunami."
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "14px 16px",
          borderRadius: "14px",
          border: "1px solid #38bdf8",
          background: "#020617",
          color: "#e2e8f0",
          fontSize: "15px",
          resize: "vertical",
        }}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
          marginTop: "14px",
        }}
      >
        <button
          type="button"
          onClick={() =>
            executarGeracao({ tipoForcado: "mascote" })
          }
          style={botaoTipo(tipo === "mascote")}
        >
          🎨 Criar Mascote
        </button>
        <button
          type="button"
          onClick={() =>
            executarGeracao({ tipoForcado: "logo" })
          }
          style={botaoTipo(tipo === "logo")}
        >
          ✏️ Criar Logo
        </button>
      </div>

      <input
        ref={referenciaRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(event) => {
          const arquivo = event.target.files?.[0];
          if (!arquivo) return;
          setReferencia(URL.createObjectURL(arquivo));
        }}
      />

      <button
        type="button"
        onClick={() => referenciaRef.current?.click()}
        style={{
          marginTop: "12px",
          padding: "10px 14px",
          borderRadius: "10px",
          border: "1px dashed #38bdf8",
          background: "#082f49",
          color: "#bae6fd",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        📎 Adicionar referência (opcional)
      </button>

      {referencia ? (
        <img
          src={referencia}
          alt="Referência"
          style={{
            display: "block",
            width: "88px",
            height: "88px",
            objectFit: "contain",
            marginTop: "10px",
            background: "#fff",
            borderRadius: "10px",
          }}
        />
      ) : null}

      <p
        style={{
          color: "#64748b",
          fontSize: "12px",
          margin: "8px 0 0",
        }}
      >
        Logo da empresa ou foto de referência, opcional.
      </p>

      <button
        type="button"
        onClick={() => onPersonalizarAberto?.(!personalizarAberto)}
        style={{
          marginTop: "12px",
          padding: "8px 12px",
          borderRadius: "8px",
          border: "1px solid #334155",
          background: "transparent",
          color: "#94a3b8",
          cursor: "pointer",
        }}
      >
        ⚙️ Personalizar
      </button>

      {personalizarAberto ? (
        <div style={{ marginTop: "14px" }}>
          <label style={{ color: "#cbd5e1", fontSize: "13px" }}>
            Empresa
          </label>
          <input
            value={empresa}
            onChange={(event) => setEmpresa(event.target.value)}
            placeholder="Opcional — o Paizinho infere da ideia"
            style={{
              width: "100%",
              boxSizing: "border-box",
              margin: "6px 0 10px",
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1px solid #334155",
              background: "#020617",
              color: "#e2e8f0",
            }}
          />
          <label style={{ color: "#cbd5e1", fontSize: "13px" }}>
            Cores
          </label>
          <input
            value={cores}
            onChange={(event) => setCores(event.target.value)}
            placeholder="Opcional"
            style={{
              width: "100%",
              boxSizing: "border-box",
              margin: "6px 0 10px",
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1px solid #334155",
              background: "#020617",
              color: "#e2e8f0",
            }}
          />
          <label style={{ color: "#cbd5e1", fontSize: "13px" }}>
            Estilo
          </label>
          <select
            value={estilo}
            onChange={(event) => setEstilo(event.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              margin: "6px 0 12px",
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1px solid #334155",
              background: "#020617",
              color: "#e2e8f0",
            }}
          >
            {ESTILOS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          {children}
        </div>
      ) : null}
        </>
      )}

      {!gerando && escolhida ? (
        <div style={{ marginTop: "22px" }}>
          <img
            src={escolhida}
            alt="Criação do Paizinho"
            style={{
              display: "block",
              width: "100%",
              maxWidth: "520px",
              margin: "0 auto",
              borderRadius: "18px",
              background: "#ffffff",
            }}
          />

          {opcoes.length > 1 ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "8px",
                marginTop: "12px",
                flexWrap: "wrap",
              }}
            >
              {opcoes.map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setEscolhida(url)}
                  style={{
                    padding: 0,
                    border:
                      escolhida === url
                        ? "3px solid #22d3ee"
                        : "1px solid #334155",
                    borderRadius: "10px",
                    overflow: "hidden",
                    cursor: "pointer",
                    background: "#fff",
                  }}
                >
                  <img
                    src={url}
                    alt=""
                    style={{
                      width: "72px",
                      height: "72px",
                      objectFit: "contain",
                      display: "block",
                    }}
                  />
                </button>
              ))}
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "8px",
              marginTop: "16px",
            }}
          >
            <button
              type="button"
              onClick={usarEste}
              disabled={salvando}
              style={{
                ...botaoTipo(true),
                background: "#14532d",
                borderColor: "#22c55e",
              }}
            >
              {salvando
                ? "Salvando..."
                : tipo === "logo"
                ? "⭐ Usar este logo"
                : "⭐ Usar este mascote"}
            </button>
            <button
              type="button"
              onClick={() => executarGeracao()}
              style={botaoTipo(false)}
            >
              🔄 Criar outra opção
            </button>
            <button
              type="button"
              onClick={() => setMostrarAlteracao(true)}
              style={botaoTipo(mostrarAlteracao)}
            >
              ✏️ Pedir alteração
            </button>
          </div>

          {mostrarAlteracao ? (
            <div style={{ marginTop: "12px" }}>
              <textarea
                value={pedidoAlteracao}
                onChange={(event) =>
                  setPedidoAlteracao(event.target.value)
                }
                rows={2}
                placeholder="Deixe mais moderno. Faça mais simpático. Coloque o logo maior. Troque as cores. Quero uma roda em vez de uma vela."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "11px 12px",
                  borderRadius: "10px",
                  border: "1px solid #334155",
                  background: "#020617",
                  color: "#e2e8f0",
                  resize: "vertical",
                }}
              />
              <button
                type="button"
                onClick={() =>
                  executarGeracao({
                    descricao: [
                      inferido?.descricao || ideia,
                      "Keep the rest of the design. Apply only this change:",
                      pedidoAlteracao.trim(),
                    ]
                      .filter(Boolean)
                      .join(" "),
                  })
                }
                style={{
                  width: "100%",
                  marginTop: "8px",
                  padding: "11px",
                  borderRadius: "10px",
                  border: "none",
                  background: "#0e7490",
                  color: "#fff",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Aplicar alteração
              </button>
            </div>
          ) : null}

          {salvoOficial?.tipo === "mascote" ? (
            <button
              type="button"
              onClick={() =>
                onIrParaClip?.({
                  ideia,
                  referencia,
                  mascote: salvoOficial.registro,
                })
              }
              style={{
                width: "100%",
                marginTop: "14px",
                padding: "14px",
                borderRadius: "12px",
                border: "none",
                background: "linear-gradient(135deg,#2563eb,#22d3ee)",
                color: "#fff",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              🎬 Criar Clip com este mascote
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
