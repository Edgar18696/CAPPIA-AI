import { useEffect, useState } from "react";
import { supabase } from "../supabase.js";
import qrcode from "../lib/qrcode-generator.mjs";

/*
 * Contas Marketplace / Integrações
 * - O usuário PAIIA vem SEMPRE do login Supabase (prop `usuario` ou sessão
 *   atual). Nada de usuário digitado ou vindo da URL.
 * - As URLs oficiais de autorização (Mercado Livre e Bling) são montadas
 *   no servidor (funções), com as credenciais guardadas lá.
 * - O "state" enviado ao provedor é um código aleatório guardado neste
 *   navegador, conferido na volta (proteção contra retorno forjado).
 */
const CHAVE_STATE_ML = "paiia_oauth_state_ml";
const CHAVE_STATE_BLING = "paiia_oauth_state_bling";

function gerarState(prefixo) {
  const aleatorio =
    (window.crypto?.randomUUID && window.crypto.randomUUID()) ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefixo}.${aleatorio}`;
}

const CHAVE_PKCE_ML = "paiia_oauth_pkce_ml";

// Endereço aberto pelo QR Code "Conectar pelo celular". Sempre o site
// público (o celular não enxerga o localhost do computador).
const URL_CONECTAR_CELULAR = "https://www.paiia.com.br/?conectar=mercadolivre";

function gerarQrSvg(texto) {
  const qr = qrcode(0, "M");
  qr.addData(texto);
  qr.make();
  return qr.createSvgTag({ cellSize: 6, margin: 4, scalable: true });
}

// Mensagens claras para os erros que o Mercado Livre devolve na volta
// da autorização (padrão OAuth: ?error=...&error_description=...).
function mensagemErroOAuth(provedor, codigo, descricao) {
  const nome = provedor === "bling" ? "Bling" : "Mercado Livre";
  const conhecidos = {
    access_denied: `A autorização foi cancelada ou negada no ${nome}.`,
    invalid_request: `O ${nome} recusou o pedido de autorização (invalid_request).`,
    unauthorized_client: `O aplicativo não está autorizado no ${nome} (unauthorized_client).`,
    invalid_scope: `Permissões inválidas no pedido ao ${nome} (invalid_scope).`,
    server_error: `O ${nome} teve um erro interno. Tente novamente em alguns minutos.`,
    temporarily_unavailable: `O ${nome} está temporariamente indisponível. Tente mais tarde.`,
  };
  const base = conhecidos[codigo] || `O ${nome} devolveu o erro "${codigo}".`;
  return `❌ ${base}${descricao ? ` Detalhe do ${nome}: ${descricao}` : ""}`;
}

// Registro de diagnóstico do retorno (nunca envia code, tokens ou senhas).
async function registrarRetorno(dados) {
  try {
    await supabase.functions.invoke("mercadolivre-oauth", {
      body: { acao: "registrar_retorno", ...dados },
    });
  } catch {
    /* diagnóstico é opcional: nunca bloqueia a tela */
  }
}

function base64Url(bytes) {
  let texto = "";
  bytes.forEach((b) => {
    texto += String.fromCharCode(b);
  });
  return btoa(texto).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// PKCE (S256): verificador aleatório guardado só neste navegador.
async function gerarPkce() {
  const aleatorio = new Uint8Array(48);
  window.crypto.getRandomValues(aleatorio);
  const verificador = base64Url(aleatorio);
  const hash = await window.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verificador)
  );
  return { verificador, desafio: base64Url(new Uint8Array(hash)) };
}

function lerLocal(chave) {
  try {
    return window.localStorage.getItem(chave) || "";
  } catch {
    return "";
  }
}

function gravarLocal(chave, valor) {
  try {
    if (valor) window.localStorage.setItem(chave, valor);
    else window.localStorage.removeItem(chave);
  } catch {
    /* navegador sem armazenamento: o retorno será recusado com aviso */
  }
}

async function obterUsuarioLogado(usuarioProp) {
  if (usuarioProp?.id) return usuarioProp;
  const { data } = await supabase.auth.getSession();
  return data?.session?.user || null;
}

export default function ContasMarketplace({
  usuario,
  cardStyle,
  setScreen,
}) {
  const [statusML, setStatusML] = useState(null);
  const [statusBling, setStatusBling] = useState(null);
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [testeBling, setTesteBling] = useState(null);
  const [codigoTesteBling, setCodigoTesteBling] = useState("");
  const [mostrarQrCelular, setMostrarQrCelular] = useState(false);
  const [abertoPeloCelular, setAbertoPeloCelular] = useState(false);

  async function carregarStatus() {
    const logado = await obterUsuarioLogado(usuario);
    if (!logado?.id) return;
    try {
      const { data } = await supabase.functions.invoke("mercadolivre-oauth", {
        body: { acao: "status" },
      });
      setStatusML(data || null);
    } catch {
      setStatusML(null);
    }
    try {
      const { data } = await supabase.functions.invoke("bling-integracao", {
        body: { acao: "status" },
      });
      setStatusBling(data || null);
    } catch {
      setStatusBling(null);
    }
  }

  useEffect(() => {
    let ativo = true;

    async function concluirRetornoOAuth() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state") || "";
      const erroOAuth = params.get("error") || "";
      const descricaoErro = (params.get("error_description") || "").slice(0, 300);

      // Aberto pelo QR Code "Conectar pelo celular".
      if (params.get("conectar") === "mercadolivre") {
        window.history.replaceState({}, document.title, window.location.pathname);
        if (ativo) setAbertoPeloCelular(true);
        return;
      }

      // Volta com erro/cancelamento: mostra o motivo em vez de voltar calado.
      if (!code && erroOAuth && /^(ml|bling)\./.test(state)) {
        if (window.__paiiaRetornoOAuth === state) return;
        window.__paiiaRetornoOAuth = state;
        const provedorErro = state.startsWith("ml.") ? "ml" : "bling";
        const chaveErro = provedorErro === "ml" ? CHAVE_STATE_ML : CHAVE_STATE_BLING;
        const reconhecido = lerLocal(chaveErro) === state;
        gravarLocal(chaveErro, "");
        if (provedorErro === "ml") gravarLocal(CHAVE_PKCE_ML, "");
        window.history.replaceState({}, document.title, window.location.pathname);
        setMensagem(mensagemErroOAuth(provedorErro, erroOAuth, descricaoErro));
        registrarRetorno({
          provedor: provedorErro === "ml" ? "mercado_livre" : "bling",
          etapa: "retorno_com_erro",
          erro_codigo: erroOAuth.slice(0, 80),
          erro_descricao: descricaoErro,
          state_reconhecido: reconhecido,
        });
        return;
      }

      if (!code) return;

      // Processa cada retorno UMA vez (o efeito pode rodar de novo quando
      // o login termina de carregar).
      if (window.__paiiaRetornoOAuth === state) return;
      window.__paiiaRetornoOAuth = state;

      const provedor = state.startsWith("ml.")
        ? "ml"
        : state.startsWith("bling.")
          ? "bling"
          : "";
      if (!provedor) return;

      const limparUrl = () =>
        window.history.replaceState({}, document.title, window.location.pathname);

      const chave = provedor === "ml" ? CHAVE_STATE_ML : CHAVE_STATE_BLING;
      const esperado = lerLocal(chave);
      if (!esperado || esperado !== state) {
        limparUrl();
        if (provedor === "ml") {
          registrarRetorno({
            provedor: "mercado_livre",
            etapa: "retorno_state_nao_reconhecido",
            state_reconhecido: false,
          });
        }
        if (ativo) {
          setMensagem(
            "⚠️ Retorno de autorização não reconhecido neste navegador. Clique em Conectar novamente."
          );
        }
        return;
      }
      gravarLocal(chave, "");

      const logado = await obterUsuarioLogado(usuario);
      if (!logado?.id) {
        limparUrl();
        if (ativo) setMensagem("Usuário não identificado. Entre novamente no PAIIA.");
        return;
      }

      setOcupado(provedor);
      try {
        const nomeFuncao =
          provedor === "ml" ? "mercadolivre-oauth" : "bling-integracao";
        const verificadorPkce =
          provedor === "ml" ? lerLocal(CHAVE_PKCE_ML) : "";
        gravarLocal(CHAVE_PKCE_ML, "");
        const corpo =
          provedor === "ml"
            ? { code, ...(verificadorPkce ? { code_verifier: verificadorPkce } : {}) }
            : { acao: "trocar_codigo", code };
        const { data, error } = await supabase.functions.invoke(nomeFuncao, {
          body: corpo,
        });
        if (error) throw error;
        if (!data?.ok) throw new Error(data?.erro || "Falha na conexão.");
        {
          setMensagem(
            provedor === "ml"
              ? `✅ Mercado Livre CONECTADO${data?.nickname ? `: ${data.nickname}` : ""}${data?.ml_user_id ? ` (ID ${data.ml_user_id})` : ""}.`
              : "✅ Bling conectado."
          );
        }
      } catch (erro) {
        console.error("❌ Erro ao concluir autorização:", erro);
        {
          setMensagem(
            `❌ Não foi possível concluir a conexão: ${erro?.message || "erro desconhecido"}`
          );
        }
      } finally {
        limparUrl();
        setOcupado("");
        carregarStatus();
      }
    }

    concluirRetornoOAuth().then(() => {
      if (ativo) carregarStatus();
    });

    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id]);

  async function iniciarAutorizacao(provedor) {
    setMensagem("");
    const logado = await obterUsuarioLogado(usuario);
    if (!logado?.id) {
      alert("Usuário não identificado. Entre novamente no PAIIA.");
      return;
    }

    const chave = provedor === "ml" ? CHAVE_STATE_ML : CHAVE_STATE_BLING;
    const state = gerarState(provedor);
    gravarLocal(chave, state);

    setOcupado(provedor);
    try {
      let desafioPkce = "";
      if (provedor === "ml") {
        const pkce = await gerarPkce();
        gravarLocal(CHAVE_PKCE_ML, pkce.verificador);
        desafioPkce = pkce.desafio;
      }
      const { data, error } = await supabase.functions.invoke(
        provedor === "ml" ? "mercadolivre-oauth" : "bling-integracao",
        {
          body: {
            acao: "url_autorizacao",
            state,
            ...(desafioPkce ? { code_challenge: desafioPkce } : {}),
          },
        }
      );
      if (error) throw error;
      if (!data?.ok || !data?.url) {
        throw new Error(data?.erro || "O servidor não devolveu a URL de autorização.");
      }
      // Conferência final antes de abrir: nunca enviar placeholder.
      if (provedor === "ml") {
        const conferir = new URL(data.url);
        if (!/^\d{6,}$/.test(conferir.searchParams.get("client_id") || "")) {
          throw new Error("Client ID do Mercado Livre inválido (placeholder). A autorização não foi aberta.");
        }
      }
      window.location.href = data.url;
    } catch (erro) {
      gravarLocal(chave, "");
      setOcupado("");
      setMensagem(`❌ ${erro?.message || "Não foi possível iniciar a autorização."}`);
    }
  }

  function conectarMercadoLivre() {
    iniciarAutorizacao("ml");
  }

  function conectarBling() {
    iniciarAutorizacao("bling");
  }

  async function testarBling() {
    setOcupado("bling-teste");
    setTesteBling(null);
    try {
      const { data, error } = await supabase.functions.invoke("bling-integracao", {
        body: {
          acao: "testar",
          codigo: codigoTesteBling.trim() || undefined,
        },
      });
      if (error) throw error;
      setTesteBling(data);
    } catch (erro) {
      setTesteBling({ ok: false, erro: erro?.message || "Falha no teste." });
    } finally {
      setOcupado("");
    }
  }

  function voltar() {
    setScreen?.("centralPublicacao");
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1180px",
        margin: "30px auto 0",
      }}
    >
      <section
        style={{
          ...cardStyle,
          padding: "28px",
          borderRadius: "18px",
          border:
            "1px solid #2563eb",
          background:
            "linear-gradient(135deg,#172554,#0f172a)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "46px",
          }}
        >
          🔗
        </div>

        <h2
          style={{
            color: "#67e8f9",
            fontSize: "32px",
            margin: "8px 0",
          }}
        >
          Contas Marketplace
        </h2>

        <p
          style={{
            color: "#bfdbfe",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          Conecte suas contas para publicar
          anúncios diretamente pelo PAIIA AI.
        </p>
      </section>

      <button
        type="button"
        style={botaoVoltar}
        onClick={voltar}
      >
        ⬅ Voltar à Central de Publicação
      </button>

      <div style={gridStyle}>
        <MarketplaceCard
          icone="🟡"
          nome="Mercado Livre"
          status={
            statusML?.conectado
              ? `CONECTADA${statusML?.nickname ? ` — ${statusML.nickname}` : ""}`
              : "Pronto para conectar"
          }
          corStatus="#22c55e"
          descricao="Autorize sua conta para preparar a publicação automática dos anúncios."
          textoBotao={
            ocupado === "ml"
              ? "⏳ Abrindo Mercado Livre..."
              : statusML?.conectado
                ? "🔄 Reconectar"
                : undefined
          }
          onClick={
            conectarMercadoLivre
          }
        />

        <MarketplaceCard
          icone="🟠"
          nome="Shopee"
          status="Em breve"
          corStatus="#facc15"
          descricao="Integração oficial será adicionada após a V1.0."
        />

        <MarketplaceCard
          icone="🔵"
          nome="Amazon"
          status="Em breve"
          corStatus="#facc15"
          descricao="Integração oficial será adicionada após a V1.0."
        />

        <MarketplaceCard
          icone="🌐"
          nome="Site Próprio"
          status="Em breve"
          corStatus="#facc15"
          descricao="Publicação para loja própria ficará disponível em uma próxima versão."
        />
      </div>

      {abertoPeloCelular && (
        <div
          data-paiia-aberto-celular
          style={{
            marginTop: "16px",
            padding: "12px 14px",
            borderRadius: "12px",
            border: "1px solid #22c55e",
            background: "#052e16",
            color: "#dcfce7",
            lineHeight: 1.6,
          }}
        >
          📱 Você abriu pelo celular. {usuario?.id
            ? "Toque em 🔗 Conectar no cartão do Mercado Livre e siga a verificação do próprio Mercado Livre neste celular."
            : "Primeiro toque em Login (no topo) e entre no PAIIA. Depois abra Contas Marketplace e toque em 🔗 Conectar no Mercado Livre."}
        </div>
      )}

      <div
        style={{
          marginTop: "16px",
          padding: "14px",
          borderRadius: "12px",
          border: "1px solid #334155",
          background: "#020617",
          color: "#cbd5e1",
          fontSize: "13px",
          lineHeight: 1.6,
        }}
      >
        <button
          type="button"
          data-paiia-conectar-celular
          onClick={() => setMostrarQrCelular((v) => !v)}
          style={{ ...botaoConectar, marginTop: 0, cursor: "pointer" }}
        >
          📱 {mostrarQrCelular ? "Fechar QR Code" : "Conectar pelo celular"}
        </button>
        <span style={{ marginLeft: "10px", color: "#94a3b8" }}>
          Use se o Mercado Livre pedir câmera e este computador não tiver.
        </span>

        {mostrarQrCelular && (
          <div
            style={{
              display: "flex",
              gap: "18px",
              alignItems: "center",
              flexWrap: "wrap",
              marginTop: "14px",
            }}
          >
            <div
              data-paiia-qr-celular
              style={{
                width: "190px",
                height: "190px",
                background: "#ffffff",
                borderRadius: "10px",
                padding: "6px",
              }}
              dangerouslySetInnerHTML={{ __html: gerarQrSvg(URL_CONECTAR_CELULAR) }}
            />
            <ol style={{ margin: 0, paddingLeft: "18px", maxWidth: "460px", textAlign: "left" }}>
              <li>Aponte a câmera do celular para o QR Code.</li>
              <li>Abra o endereço no navegador do celular e entre no PAIIA.</li>
              <li>Em Contas Marketplace, toque em 🔗 Conectar no Mercado Livre.</li>
              <li>
                Faça a verificação que o Mercado Livre pedir no próprio celular.
                Comece e termine no mesmo celular.
              </li>
            </ol>
          </div>
        )}
      </div>

      {mensagem && (
        <div
          data-paiia-integracao-msg
          style={{
            marginTop: "16px",
            padding: "12px 14px",
            borderRadius: "12px",
            border: "1px solid #334155",
            background: "#020617",
            color: "#e2e8f0",
          }}
        >
          {mensagem}
        </div>
      )}

      <section
        style={{
          ...cardMarketplace,
          marginTop: "22px",
          minHeight: 0,
          alignItems: "stretch",
          textAlign: "left",
        }}
      >
        <h3 style={{ color: "#67e8f9", margin: "0 0 6px 0" }}>
          🧾 Integrações — Estoque e Nota Fiscal
        </h3>
        <p style={{ color: "#94a3b8", fontSize: "13px", lineHeight: 1.6, margin: 0 }}>
          O PAIIA continua criando e publicando os anúncios nos marketplaces.
          O Bling fica com cadastro de produto (SKU, descrição, preço quando
          necessário), estoque e dados para a nota fiscal. Fotos, banners, clips,
          vídeos e arquivos da Galeria não são enviados ao Bling.
        </p>

        <div
          data-paiia-bling
          style={{
            marginTop: "14px",
            padding: "16px",
            borderRadius: "12px",
            border: "1px solid #334155",
            background: "#0f172a",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "28px" }}>📦</span>
            <strong style={{ color: "#e2e8f0", fontSize: "18px" }}>Bling</strong>
            <span
              style={{
                color: statusBling?.conectado ? "#22c55e" : statusBling?.configurado === false ? "#facc15" : "#94a3b8",
                fontWeight: "bold",
                fontSize: "13px",
              }}
            >
              ●{" "}
              {statusBling?.conectado
                ? `Conectado${statusBling?.conta ? `: ${statusBling.conta}` : ""}`
                : statusBling?.configurado === false
                  ? "Aguardando o aplicativo Bling ser configurado no servidor"
                  : "Pronto para conectar"}
            </span>
            {statusBling && (
              <span style={{ color: "#fbbf24", fontSize: "12px" }}>
                {statusBling?.escritaHabilitada
                  ? "Modo real (grava no Bling)"
                  : "Modo teste — nada é gravado no Bling"}
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "12px" }}>
            <button
              type="button"
              style={{ ...botaoConectar, marginTop: 0, cursor: "pointer" }}
              onClick={conectarBling}
              disabled={ocupado === "bling"}
            >
              {ocupado === "bling"
                ? "⏳ Abrindo Bling..."
                : statusBling?.conectado
                  ? "🔄 Reconectar Bling"
                  : "🔗 Conectar Bling"}
            </button>

            <input
              value={codigoTesteBling}
              onChange={(e) => setCodigoTesteBling(e.target.value)}
              placeholder="SKU/código para consultar (opcional)"
              style={{
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid #334155",
                background: "#020617",
                color: "#e2e8f0",
                minWidth: "240px",
              }}
            />

            <button
              type="button"
              style={{ ...botaoConectar, marginTop: 0, cursor: "pointer" }}
              onClick={testarBling}
              disabled={ocupado === "bling-teste"}
            >
              {ocupado === "bling-teste" ? "⏳ Testando..." : "🧪 Testar (somente leitura)"}
            </button>
          </div>

          {testeBling && (
            <pre
              data-paiia-bling-teste
              style={{
                marginTop: "12px",
                padding: "12px",
                borderRadius: "10px",
                background: "#020617",
                color: testeBling.ok ? "#bbf7d0" : "#fecaca",
                fontSize: "12px",
                whiteSpace: "pre-wrap",
                maxHeight: "260px",
                overflow: "auto",
              }}
            >
              {testeBling.ok
                ? JSON.stringify(testeBling.resultado ?? testeBling, null, 2)
                : `❌ ${testeBling.erro || "Falha no teste."}`}
            </pre>
          )}
        </div>
      </section>

      <section style={paizinhoStyle}>
        <div
          style={{
            fontSize: "40px",
          }}
        >
          🤖
        </div>

        <h3
          style={{
            color: "#67e8f9",
            margin:
              "8px 0 6px 0",
          }}
        >
          Paizinho PAIIA
        </h3>

        <p
          style={{
            color: "#bfdbfe",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          Na V1.0 vamos priorizar o
          Mercado Livre. As demais
          integrações serão adicionadas
          sem alterar o fluxo do anúncio.
        </p>
      </section>
    </div>
  );
}

function MarketplaceCard({
  icone,
  nome,
  status,
  corStatus,
  descricao,
  onClick,
  textoBotao,
}) {
  const disponivel =
    typeof onClick === "function";

  return (
    <div style={cardMarketplace}>
      <div
        style={{
          fontSize: "36px",
        }}
      >
        {icone}
      </div>

      <h3
        style={{
          color: "#e2e8f0",
          margin:
            "8px 0 4px 0",
        }}
      >
        {nome}
      </h3>

      <p
        style={{
          color: corStatus,
          fontWeight: "bold",
          margin:
            "4px 0 10px 0",
        }}
      >
        ● {status}
      </p>

      <p
        style={{
          color: "#94a3b8",
          fontSize: "12px",
          lineHeight: 1.5,
          minHeight: "38px",
          margin: 0,
        }}
      >
        {descricao}
      </p>

      <button
        type="button"
        style={{
          ...botaoConectar,
          opacity:
            disponivel
              ? 1
              : 0.55,
          cursor:
            disponivel
              ? "pointer"
              : "not-allowed",
        }}
        disabled={!disponivel}
        onClick={onClick}
      >
        {textoBotao ||
          (disponivel
            ? "🔗 Conectar"
            : "⏳ Em breve")}
      </button>
    </div>
  );
}

const gridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(240px,1fr))",
  gap: "18px",
  marginTop: "22px",
};

const cardMarketplace = {
  background: "#020617",
  border: "1px solid #334155",
  borderRadius: "16px",
  padding: "20px",
  textAlign: "center",
  minHeight: "220px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
};

const botaoConectar = {
  marginTop: "16px",
  padding: "12px 18px",
  borderRadius: "10px",
  border: "1px solid #38bdf8",
  background: "#082f49",
  color: "#bae6fd",
  fontWeight: "bold",
};

const botaoVoltar = {
  marginTop: "18px",
  padding: "11px 18px",
  borderRadius: "10px",
  border: "1px solid #475569",
  background: "#334155",
  color: "#ffffff",
  fontWeight: "bold",
  cursor: "pointer",
};

const paizinhoStyle = {
  marginTop: "22px",
  padding: "22px",
  borderRadius: "16px",
  border: "1px solid #2563eb",
  background:
    "linear-gradient(135deg,#172554,#0f172a)",
  textAlign: "center",
};
