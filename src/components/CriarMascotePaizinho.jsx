import { useEffect, useMemo, useRef, useState } from "react";

import {
  consumirNovaCriacaoMidia,
  deveIniciarNovaCriacaoMidia,
} from "../services/limparEstadoTemporarioMidia";
import {
  CENAS_MASCOTE,
  resolverCenaMascote,
} from "../services/mascote/cenasMascote";
import { recomendarCenaMascote } from "../services/mascote/recomendarCenaMascote";
import {
  CUSTO_CREDITOS_CRIAR_MASCOTE,
  PACOTES_CREDITOS_PAIIA,
  buscarMascoteOficial,
  consultarCreditosPaiia,
  gerarImagemMascotePaiia,
  gravarRascunhoMascote,
  lerRascunhoMascote,
  montarPromptMascotePaizinho,
  obterUsuarioMascote,
  publicarImagemMascote,
  rotuloCustoCriarMascote,
  salvarMascoteNoKit,
} from "../services/mascoteMarcaService";

const ESTILOS = [
  "Moderno e forte",
  "Profissional",
  "Tecnologia automotiva",
  "Amigável",
  "Premium",
];

const EXPRESSOES = [
  "Sorriso confiante",
  "Amigável",
  "Determinado",
  "Neutro",
  "Empolgado",
];

const ORIGENS = [
  {
    id: "logo",
    titulo: "Enviar logo",
    texto: "Usa o logo da empresa como referência visual.",
  },
  {
    id: "foto",
    titulo: "Foto de referência",
    texto: "Parte de uma foto ou rascunho do personagem.",
  },
  {
    id: "zero",
    titulo: "Criar do zero",
    texto: "O Paizinho monta o personagem só com a sua ideia.",
  },
];

const cardBase = {
  background: "#0f172a",
  borderRadius: "18px",
  border: "1px solid #334155",
};

function rascunhoVazio() {
  return {
    origem: "zero",
    nome: "",
    estilo: ESTILOS[0],
    cores: "",
    roupaAcessorios: "",
    expressao: EXPRESSOES[0],
    observacoes: "",
    logo: "",
    nomeArquivoLogo: "",
    fotoReferencia: "",
    cenaId: "paizinho",
    mostrarAjuste: false,
  };
}

function rascunhoInicial() {
  const continuarRascunho =
    localStorage.getItem("voltarParaCriarMascote") === "true";
  const novaCriacao = deveIniciarNovaCriacaoMidia();

  if (novaCriacao && !continuarRascunho) {
    return rascunhoVazio();
  }

  const salvo = lerRascunhoMascote() || {};
  return {
    ...rascunhoVazio(),
    ...salvo,
  };
}

const TIPOS_LOGO_ACEITOS = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

const ACEITAR_LOGO =
  "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp";

function arquivoLogoValido(arquivo) {
  if (!arquivo) {
    return false;
  }
  const tipo = String(arquivo.type || "").toLowerCase();
  const nome = String(arquivo.name || "").toLowerCase();
  if (TIPOS_LOGO_ACEITOS.includes(tipo)) {
    return true;
  }
  return /\.(png|jpe?g|webp)$/i.test(nome);
}

function lerImagemLocal(arquivo, aoLer) {
  if (!arquivo?.type?.startsWith("image/")) {
    return;
  }
  const leitor = new FileReader();
  leitor.onload = () => aoLer(String(leitor.result || ""));
  leitor.readAsDataURL(arquivo);
}

function lerLogoLocal(arquivo, aoLer) {
  if (!arquivoLogoValido(arquivo)) {
    alert("Envie um logo em PNG, JPG, JPEG ou WEBP.");
    return;
  }
  const leitor = new FileReader();
  leitor.onload = () =>
    aoLer({
      preview: String(leitor.result || ""),
      nomeArquivo: arquivo.name || "logo",
    });
  leitor.readAsDataURL(arquivo);
}

export default function CriarMascotePaizinho({
  setScreen,
  cardStyle,
}) {
  const logoRef = useRef(null);
  const referenciaRef = useRef(null);
  const inicio = useMemo(() => rascunhoInicial(), []);
  const pularPrimeiroRascunho = useRef(
    deveIniciarNovaCriacaoMidia() &&
      localStorage.getItem("voltarParaCriarMascote") !== "true"
  );
  const [origem, setOrigem] = useState(inicio.origem);
  const [nome, setNome] = useState(inicio.nome);
  const [estilo, setEstilo] = useState(inicio.estilo);
  const [cores, setCores] = useState(inicio.cores);
  const [roupaAcessorios, setRoupaAcessorios] = useState(
    inicio.roupaAcessorios
  );
  const [expressao, setExpressao] = useState(inicio.expressao);
  const [observacoes, setObservacoes] = useState(inicio.observacoes);
  const [logo, setLogo] = useState(inicio.logo);
  const [nomeArquivoLogo, setNomeArquivoLogo] = useState(
    inicio.nomeArquivoLogo || ""
  );
  const [fotoReferencia, setFotoReferencia] = useState(inicio.fotoReferencia);
  const [cenaId, setCenaId] = useState(inicio.cenaId || "paizinho");
  const [cenaRecomendada, setCenaRecomendada] = useState(null);
  const [mostrarAjuste, setMostrarAjuste] = useState(
    Boolean(inicio.mostrarAjuste)
  );
  const [promptPaizinho, setPromptPaizinho] = useState("");
  const [versao, setVersao] = useState(null);
  const [aprovado, setAprovado] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [status, setStatus] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [carregandoCreditos, setCarregandoCreditos] = useState(false);
  const [saldoCreditos, setSaldoCreditos] = useState(null);
  const [mostrarCompra, setMostrarCompra] = useState(false);
  const [pacoteEscolhido, setPacoteEscolhido] = useState(
    PACOTES_CREDITOS_PAIIA[0].creditos
  );

  const custo = CUSTO_CREDITOS_CRIAR_MASCOTE;
  const saldoZero = saldoCreditos === 0;
  const saldoInsuficiente =
    saldoCreditos !== null && saldoCreditos < custo;
  const previewAtual = versao?.preview || "";

  useEffect(() => {
    localStorage.removeItem("voltarParaCriarMascote");
    if (pularPrimeiroRascunho.current) {
      consumirNovaCriacaoMidia();
    }
  }, []);

  useEffect(() => {
    if (pularPrimeiroRascunho.current) {
      pularPrimeiroRascunho.current = false;
      return;
    }

    gravarRascunhoMascote({
      origem,
      nome,
      estilo,
      cores,
      roupaAcessorios,
      expressao,
      observacoes,
      logo,
      nomeArquivoLogo,
      fotoReferencia,
      cenaId,
      mostrarAjuste,
    });
  }, [
    origem,
    nome,
    estilo,
    cores,
    roupaAcessorios,
    expressao,
    observacoes,
    logo,
    nomeArquivoLogo,
    fotoReferencia,
    cenaId,
    mostrarAjuste,
  ]);

  useEffect(() => {
    let ativo = true;
    async function recomendar() {
      const rec = await recomendarCenaMascote({
        imagemUrl: fotoReferencia || logo || "",
        nomeArquivo: nomeArquivoLogo,
        observacoes,
        origem,
      });
      if (ativo) {
        setCenaRecomendada(rec);
      }
    }
    recomendar();
    return () => {
      ativo = false;
    };
  }, [fotoReferencia, logo, nomeArquivoLogo, observacoes, origem]);

  const cenaNoPrompt = resolverCenaMascote(cenaId, cenaRecomendada?.id);

  useEffect(() => {
    setPromptPaizinho(
      montarPromptMascotePaizinho({
        origem,
        nome,
        estilo,
        cores,
        roupaAcessorios,
        expressao,
        observacoes,
        temLogo: Boolean(logo),
        temFoto: Boolean(fotoReferencia),
        cenaPrompt: cenaNoPrompt?.promptCena || "",
      })
    );
  }, [
    origem,
    nome,
    estilo,
    cores,
    roupaAcessorios,
    expressao,
    observacoes,
    logo,
    fotoReferencia,
    cenaNoPrompt,
  ]);

  useEffect(() => {
    let ativo = true;
    async function carregarCreditos() {
      setCarregandoCreditos(true);
      try {
        const saldo = await consultarCreditosPaiia();
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

  function persistirEIrComprar() {
    gravarRascunhoMascote({
      origem,
      nome,
      estilo,
      cores,
      roupaAcessorios,
      expressao,
      observacoes,
      logo,
      nomeArquivoLogo,
      fotoReferencia,
      cenaId,
      mostrarAjuste,
    });
    localStorage.setItem("voltarParaCriarMascote", "true");
    localStorage.setItem("abrirSecaoCreditosVideo", "true");
    setMostrarCompra(false);
    setScreen?.("planosPagamentos");
  }

  function aplicarLogoSelecionado(arquivo) {
    lerLogoLocal(arquivo, ({ preview, nomeArquivo }) => {
      setOrigem("logo");
      setLogo(preview);
      setNomeArquivoLogo(nomeArquivo);
    });
  }

  function removerLogo() {
    setLogo("");
    setNomeArquivoLogo("");
    if (logoRef.current) {
      logoRef.current.value = "";
    }
  }

  function abrirSeletorLogo() {
    setOrigem("logo");
    const input = logoRef.current;
    if (!input) {
      return;
    }
    input.value = "";
    input.click();
  }

  async function publicarReferencias() {
    const usuario = await obterUsuarioMascote();
    let logoUrl = "";
    let fotoUrl = "";

    if (logo) {
      logoUrl = await publicarImagemMascote({
        userId: usuario.id,
        imagem: logo,
      });
      if (logoUrl !== logo) {
        setLogo(logoUrl);
      }
    }

    if (fotoReferencia) {
      fotoUrl = await publicarImagemMascote({
        userId: usuario.id,
        imagem: fotoReferencia,
      });
      if (fotoUrl !== fotoReferencia) {
        setFotoReferencia(fotoUrl);
      }
    }

    return { logoUrl, fotoUrl };
  }

  async function gerarMascote() {
    if (gerando) {
      return;
    }
    if (origem === "logo" && !logo) {
      alert("Envie o logo da empresa para usar esta origem.");
      return;
    }
    if (origem === "foto" && !fotoReferencia) {
      alert("Envie uma foto de referência para usar esta origem.");
      return;
    }
    if (saldoInsuficiente) {
      setMostrarCompra(true);
      return;
    }

    setGerando(true);
    setAprovado(false);
    setStatus("🤖 Paizinho enviando o prompt e a cena ao Replicate...");

    try {
      let saldo = saldoCreditos;
      if (saldo === null) {
        saldo = await consultarCreditosPaiia();
        setSaldoCreditos(saldo);
      }
      if (saldo < custo) {
        setStatus("");
        setMostrarCompra(true);
        return;
      }

      const { logoUrl, fotoUrl } = await publicarReferencias();
      const resultado = await gerarImagemMascotePaiia({
        prompt: promptPaizinho,
        descricao: promptPaizinho,
        nome,
        cores,
        estilo,
        logoUrl,
        fotoReferenciaUrl: fotoUrl,
        cenaId,
        cenaNome: cenaNoPrompt?.nome || "",
      });

      setVersao({
        preview: resultado.imagem,
        prompt: resultado.promptBase || promptPaizinho,
      });
      if (resultado.saldo != null) {
        setSaldoCreditos(Math.max(0, Number(resultado.saldo)));
      } else {
        setSaldoCreditos(Math.max(0, saldo - custo));
      }
      setStatus("✅ Mascote gerado. Confira o resultado abaixo.");
    } catch (erro) {
      if (erro?.saldoInsuficiente) {
        setMostrarCompra(true);
      }
      setStatus(
        `❌ ${erro?.message || "Não foi possível gerar o mascote. Nenhum crédito PAIIA foi usado."}`
      );
    } finally {
      setGerando(false);
    }
  }

  function gerarNovaVersao() {
    setAprovado(false);
    void gerarMascote();
  }

  function abrirAjuste() {
    setMostrarAjuste(true);
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  }

  async function salvarNoKit() {
    const imagem = previewAtual;
    if (!imagem) {
      alert(
        "Nesta etapa, envie um logo ou uma foto de referência para salvar o mascote no Kit da Marca."
      );
      return;
    }

    setSalvando(true);
    try {
      const usuario = await obterUsuarioMascote();
      const imagemPublica = await publicarImagemMascote({
        userId: usuario.id,
        imagem,
      });
      await salvarMascoteNoKit({
        userId: usuario.id,
        nome: nome.trim(),
        empresa: "",
        imagemBase: imagemPublica,
        descricaoOriginal: observacoes.trim(),
        promptBase: promptPaizinho,
        cores: cores.trim(),
        roupaAcessorios: roupaAcessorios.trim(),
        logoAssociado: logo,
        estiloVisual: estilo,
        caracteristicas: [expressao, observacoes].filter(Boolean).join(" • "),
      });
      await buscarMascoteOficial(usuario.id);
      setAprovado(true);
      setStatus("✅ Mascote salvo no Kit da Marca para Banner, Clip e campanhas.");
    } catch (erro) {
      alert(erro?.message || "Não foi possível salvar o mascote no Kit da Marca.");
    } finally {
      setSalvando(false);
    }
  }

  async function aprovarMascote() {
    if (!versao) {
      alert("Gere o conceito do mascote antes de aprovar.");
      return;
    }
    setAprovado(true);
    await salvarNoKit();
  }

  const estiloCard = {
    ...cardStyle,
    ...cardBase,
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "920px",
        margin: "30px auto",
        padding: "0 16px 40px",
        boxSizing: "border-box",
      }}
    >
      <button
        type="button"
        onClick={() => setScreen?.("home")}
        style={{
          marginBottom: "16px",
          padding: "11px 16px",
          borderRadius: "10px",
          border: "1px solid #38bdf8",
          background: "#082f49",
          color: "#bae6fd",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        ← Voltar
      </button>

      <section style={{ ...estiloCard, padding: "22px", marginBottom: "16px" }}>
        <h2
          style={{
            margin: "0 0 6px",
            color: "#fde68a",
            fontSize: "24px",
          }}
        >
          👨‍🔧 Paizinho — Criar meu Mascote
        </h2>
        <p style={{ color: "#cbd5e1", margin: "0 0 4px", fontSize: "15px" }}>
          Crie o personagem da sua empresa e reutilize em suas campanhas.
        </p>
        <p style={{ color: "#64748b", margin: 0, fontSize: "13px" }}>
          Módulo independente do Clip Premium. O mascote aprovado fica no Kit da
          Marca.
        </p>
      </section>

      <section style={{ ...estiloCard, padding: "22px", marginBottom: "16px" }}>
        <h3 style={tituloSecao}>Como você quer começar?</h3>
        <input
          id="mascote-logo-arquivo"
          ref={logoRef}
          type="file"
          accept={ACEITAR_LOGO}
          style={inputArquivoOculto}
          onChange={(event) => {
            const arquivo = event.target.files?.[0];
            if (!arquivo) {
              return;
            }
            aplicarLogoSelecionado(arquivo);
            event.target.value = "";
          }}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "10px",
          }}
        >
          {ORIGENS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === "logo") {
                  abrirSeletorLogo();
                  return;
                }
                setOrigem(item.id);
              }}
              style={{
                textAlign: "left",
                padding: "14px",
                borderRadius: "12px",
                border:
                  origem === item.id ? "2px solid #22d3ee" : "1px solid #334155",
                background: origem === item.id ? "#083344" : "#020617",
                color: "#e2e8f0",
                cursor: "pointer",
              }}
            >
              <strong style={{ display: "block", marginBottom: "6px" }}>
                {item.titulo}
              </strong>
              <span style={{ color: "#94a3b8", fontSize: "12px" }}>
                {item.texto}
              </span>
            </button>
          ))}
        </div>

        {origem === "logo" ? (
          <div style={{ marginTop: "14px" }}>
            {logo ? (
              <div
                style={{
                  display: "flex",
                  gap: "14px",
                  alignItems: "center",
                  flexWrap: "wrap",
                  padding: "12px",
                  borderRadius: "12px",
                  border: "1px solid #155e75",
                  background: "#082f49",
                }}
              >
                <img src={logo} alt="Preview do logo" style={miniatura} />
                <div style={{ flex: "1 1 180px" }}>
                  <div
                    style={{
                      color: "#e0f2fe",
                      fontWeight: "bold",
                      fontSize: "13px",
                      wordBreak: "break-all",
                    }}
                  >
                    {nomeArquivoLogo || "logo selecionado"}
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "4px" }}>
                    Preview local. Ainda não foi enviado nem gera créditos.
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                      marginTop: "10px",
                    }}
                  >
                    <label
                      htmlFor="mascote-logo-arquivo"
                      onClick={() => setOrigem("logo")}
                      style={{ ...botaoSecundario, display: "inline-block" }}
                    >
                      Trocar logo
                    </label>
                    <button
                      type="button"
                      onClick={removerLogo}
                      style={{
                        ...botaoSecundario,
                        border: "1px solid #64748b",
                        background: "#020617",
                        color: "#cbd5e1",
                      }}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <label
                htmlFor="mascote-logo-arquivo"
                onClick={() => setOrigem("logo")}
                style={{ ...botaoSecundario, display: "inline-block" }}
              >
                Enviar logo
              </label>
            )}
          </div>
        ) : origem !== "zero" ? (
          <div style={{ marginTop: "14px" }}>
            <input
              ref={referenciaRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(event) => {
                const arquivo = event.target.files?.[0];
                event.target.value = "";
                lerImagemLocal(arquivo, setFotoReferencia);
              }}
            />
            <button
              type="button"
              onClick={() => referenciaRef.current?.click()}
              style={botaoSecundario}
            >
              {fotoReferencia
                ? "Trocar foto de referência"
                : "Enviar foto de referência"}
            </button>
            {fotoReferencia ? (
              <img
                src={fotoReferencia}
                alt="Referência"
                style={{ ...miniatura, width: "120px", height: "120px" }}
              />
            ) : null}
          </div>
        ) : null}
      </section>

      <section style={{ ...estiloCard, padding: "22px", marginBottom: "16px" }}>
        <h3 style={tituloSecao}>Onde você quer seu mascote?</h3>
        <p style={{ color: "#94a3b8", fontSize: "13px", marginTop: 0 }}>
          O Paizinho lê a foto e recomenda a cena. Você só confirma ou troca o
          card.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "10px",
          }}
        >
          {CENAS_MASCOTE.map((item) => {
            const selecionado = cenaId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCenaId(item.id)}
                style={{
                  textAlign: "left",
                  padding: "12px",
                  borderRadius: "12px",
                  border: selecionado
                    ? "2px solid #22d3ee"
                    : "1px solid #334155",
                  background: selecionado ? "#083344" : "#020617",
                  color: "#e2e8f0",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: "22px", marginBottom: "6px" }}>
                  {item.icone}
                </div>
                <strong style={{ display: "block", fontSize: "13px" }}>
                  {item.nome}
                </strong>
                {item.padrao ? (
                  <span
                    style={{
                      display: "block",
                      color: "#fde68a",
                      fontSize: "11px",
                      marginTop: "4px",
                    }}
                  >
                    Padrão
                  </span>
                ) : (
                  <span
                    style={{
                      display: "block",
                      color: "#94a3b8",
                      fontSize: "11px",
                      marginTop: "4px",
                    }}
                  >
                    {item.descricao}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {cenaRecomendada ? (
          <div
            style={{
              marginTop: "14px",
              padding: "12px 14px",
              borderRadius: "12px",
              border: "1px solid #fbbf24",
              background: "#1c1917",
              color: "#fde68a",
              fontSize: "13px",
              lineHeight: 1.45,
            }}
          >
            ⭐ Paizinho recomenda: {cenaRecomendada.icone} {cenaRecomendada.nome}
            . {cenaRecomendada.motivo}
            {cenaId === "paizinho" ? (
              <div style={{ color: "#bbf7d0", marginTop: "6px" }}>
                Cena no prompt: {cenaNoPrompt?.icone} {cenaNoPrompt?.nome}
              </div>
            ) : (
              <div style={{ color: "#bae6fd", marginTop: "6px" }}>
                Você escolheu: {cenaNoPrompt?.icone} {cenaNoPrompt?.nome}
              </div>
            )}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setMostrarAjuste((atual) => !atual)}
          style={{
            ...botaoSecundario,
            marginTop: "14px",
          }}
        >
          {mostrarAjuste ? "Ocultar ajustes" : "Quero ajustar"}
        </button>
      </section>

      {mostrarAjuste ? (
        <>
      <section style={{ ...estiloCard, padding: "22px", marginBottom: "16px" }}>
        <h3 style={tituloSecao}>Briefing do mascote, opcional</h3>
        <label style={labelStyle}>Nome do mascote</label>
        <input
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          placeholder="Ex.: Torkinho"
          style={campoStyle}
        />
        <label style={labelStyle}>Estilo</label>
        <select
          value={estilo}
          onChange={(event) => setEstilo(event.target.value)}
          style={campoStyle}
        >
          {ESTILOS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <label style={labelStyle}>Cores da marca</label>
        <input
          value={cores}
          onChange={(event) => setCores(event.target.value)}
          placeholder="Ex.: azul, preto e prata"
          style={campoStyle}
        />
        <label style={labelStyle}>Roupa / acessórios</label>
        <input
          value={roupaAcessorios}
          onChange={(event) => setRoupaAcessorios(event.target.value)}
          placeholder="Ex.: macacão, capacete, chave 10"
          style={campoStyle}
        />
        <label style={labelStyle}>Expressão</label>
        <select
          value={expressao}
          onChange={(event) => setExpressao(event.target.value)}
          style={campoStyle}
        >
          {EXPRESSOES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <label style={labelStyle}>Observações</label>
        <textarea
          value={observacoes}
          onChange={(event) => setObservacoes(event.target.value)}
          rows={4}
          placeholder="Detalhes livres para o Paizinho."
          style={{ ...campoStyle, resize: "vertical" }}
        />
      </section>

      <section style={{ ...estiloCard, padding: "22px", marginBottom: "16px" }}>
        <h3 style={tituloSecao}>O Paizinho montou este prompt</h3>
        <p style={{ color: "#94a3b8", fontSize: "13px", marginTop: 0 }}>
          A descrição abaixo é atualizada enquanto você preenche. Nenhum provedor
          de imagem é chamado nesta etapa.
        </p>
        <div
          style={{
            padding: "14px",
            borderRadius: "12px",
            border: "1px solid #155e75",
            background: "#082f49",
            color: "#e0f2fe",
            fontSize: "14px",
            lineHeight: 1.55,
          }}
        >
          {promptPaizinho}
        </div>
      </section>
        </>
      ) : null}

      <section style={{ ...estiloCard, padding: "22px", marginBottom: "16px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ color: "#67e8f9", fontWeight: 700 }}>
              Créditos PAIIA
            </div>
            <div style={{ color: "#e2e8f0", marginTop: "4px" }}>
              {carregandoCreditos
                ? "Consultando saldo..."
                : saldoCreditos === null
                  ? "Saldo indisponível no momento"
                  : `Saldo: ${saldoCreditos} créditos`}
            </div>
            {saldoInsuficiente ? (
              <div style={{ color: "#fde68a", fontSize: "12px", marginTop: "4px" }}>
                Saldo insuficiente para criar o mascote.
              </div>
            ) : null}
          </div>
          {(saldoInsuficiente || saldoZero) && (
            <button
              type="button"
              onClick={() => setMostrarCompra(true)}
              style={botaoCredito}
            >
              + Comprar créditos
            </button>
          )}
        </div>
        <div
          style={{
            color: "#e2e8f0",
            fontWeight: 700,
            fontSize: "14px",
            marginTop: "14px",
          }}
        >
          {rotuloCustoCriarMascote()}
        </div>
        <p style={{ color: "#64748b", fontSize: "12px", margin: "6px 0 0" }}>
          Mesmo saldo geral do PAIIA. Os valores em reais dos pacotes serão
          definidos depois.
        </p>
        <button
          type="button"
          onClick={gerarMascote}
          disabled={carregandoCreditos || gerando}
          style={{
            ...botaoPrincipal,
            opacity: carregandoCreditos || gerando ? 0.7 : 1,
          }}
        >
          {gerando
            ? "🎬 Gerando mascote..."
            : carregandoCreditos
            ? "💎 Verificando créditos..."
            : "🎨 Gerar Mascote"}
        </button>
        {status ? (
          <p style={{ color: "#7dd3fc", marginTop: "12px" }}>{status}</p>
        ) : null}
      </section>

      {versao ? (
        <section style={{ ...estiloCard, padding: "22px" }}>
          <h3 style={{ ...tituloSecao, marginTop: 0 }}>Resultado</h3>
          {previewAtual ? (
            <img
              src={previewAtual}
              alt="Mascote gerado"
              style={{
                display: "block",
                width: "100%",
                maxWidth: "420px",
                aspectRatio: "1 / 1",
                margin: "0 auto 16px",
                borderRadius: "14px",
                background: "#fff",
                objectFit: "contain",
              }}
            />
          ) : (
            <div
              style={{
                maxWidth: "280px",
                margin: "0 auto 16px",
                padding: "36px 16px",
                borderRadius: "14px",
                background: "#020617",
                border: "1px dashed #334155",
                color: "#94a3b8",
                textAlign: "center",
              }}
            >
              Conceito montado. Sem imagem nesta etapa (criação do zero).
            </div>
          )}
          {aprovado ? (
            <p style={{ color: "#86efac", textAlign: "center" }}>
              Mascote aprovado e disponível no Kit da Marca.
            </p>
          ) : null}
          <div
            style={{
              display: "flex",
              gap: "10px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button type="button" onClick={aprovarMascote} style={botaoAprovar}>
              ✅ Aprovar Mascote
            </button>
            <button
              type="button"
              onClick={gerarNovaVersao}
              disabled={gerando}
              style={botaoSecundario}
            >
              🔄 Gerar outra versão
            </button>
            <button type="button" onClick={abrirAjuste} style={botaoKit}>
              ✏️ Ajustar
            </button>
          </div>
        </section>
      ) : null}

      {mostrarCompra ? (
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
              maxWidth: "460px",
              padding: "24px",
              borderRadius: "16px",
              border: "1px solid #38bdf8",
              background: "#0f172a",
            }}
          >
            <p
              style={{
                margin: "0 0 8px",
                color: "#f8fafc",
                fontSize: "16px",
                fontWeight: "bold",
              }}
            >
              + Comprar créditos
            </p>
            <p style={{ color: "#94a3b8", fontSize: "13px", lineHeight: 1.5 }}>
              Pacotes de Créditos PAIIA. Sem preço em reais nesta etapa. Seu
              briefing do mascote será mantido.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "8px",
                margin: "14px 0",
              }}
            >
              {PACOTES_CREDITOS_PAIIA.map((pacote) => (
                <button
                  key={pacote.creditos}
                  type="button"
                  onClick={() => setPacoteEscolhido(pacote.creditos)}
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    border:
                      pacoteEscolhido === pacote.creditos
                        ? "2px solid #22d3ee"
                        : "1px solid #334155",
                    background:
                      pacoteEscolhido === pacote.creditos
                        ? "#083344"
                        : "#020617",
                    color: "#e2e8f0",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  {pacote.creditos} créditos
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={persistirEIrComprar}
              style={botaoPrincipal}
            >
              Continuar compra • {pacoteEscolhido} créditos
            </button>
            <button
              type="button"
              onClick={() => setMostrarCompra(false)}
              style={{
                ...botaoSecundario,
                width: "100%",
                marginTop: "10px",
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

const tituloSecao = {
  color: "#67e8f9",
  marginTop: 0,
  marginBottom: "12px",
};

const labelStyle = {
  display: "block",
  color: "#cbd5e1",
  fontSize: "13px",
  margin: "12px 0 6px",
};

const campoStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 12px",
  borderRadius: "10px",
  border: "1px solid #334155",
  background: "#020617",
  color: "#e2e8f0",
};

const botaoPrincipal = {
  width: "100%",
  marginTop: "16px",
  padding: "13px 16px",
  borderRadius: "11px",
  border: "none",
  background: "linear-gradient(135deg,#0284c7,#22d3ee)",
  color: "#ffffff",
  fontWeight: "bold",
  cursor: "pointer",
};

const botaoSecundario = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid #38bdf8",
  background: "#082f49",
  color: "#bae6fd",
  fontWeight: "bold",
  cursor: "pointer",
};

const botaoAprovar = {
  ...botaoSecundario,
  background: "linear-gradient(135deg,#15803d,#22c55e)",
  border: "none",
  color: "#ffffff",
};

const botaoKit = {
  ...botaoSecundario,
  background: "#312e81",
  border: "1px solid #818cf8",
  color: "#e0e7ff",
};

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

const miniatura = {
  display: "block",
  width: "72px",
  height: "72px",
  objectFit: "contain",
  margin: 0,
  background: "#fff",
  borderRadius: "8px",
};

const inputArquivoOculto = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};
