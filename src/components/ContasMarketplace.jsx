import { useEffect } from "react";
import { supabase } from "../supabase.js";

export default function ContasMarketplace({
  usuario,
  cardStyle,
  setScreen,
}) {
    useEffect(() => {
    async function concluirOAuthMercadoLivre() {
      const params =
        new URLSearchParams(
          window.location.search
        );

      const code =
        params.get("code");

      const state =
        params.get("state");

      if (!code) {
        return;
      }

      try {
        const { data, error } =
          await supabase.functions.invoke(
            "mercadolivre-oauth",
            {
              body: {
                code,
                user_id:
                  state ||
                  usuario?.id ||
                  "",
              },
            }
          );

        if (error) {
          throw error;
        }

        console.log(
          "✅ MERCADO LIVRE OAUTH:",
          data
        );

        alert(
          "Mercado Livre conectado com sucesso."
        );

        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
      } catch (erro) {
        console.error(
          "❌ Erro OAuth Mercado Livre:",
          erro
        );

        alert(
          "Não foi possível concluir a conexão com o Mercado Livre."
        );
      }
    }

    concluirOAuthMercadoLivre();
  }, [usuario?.id]);
  function conectarMercadoLivre() {
    const clientId =
      import.meta.env.VITE_ML_CLIENT_ID;

    const redirectUri =
      import.meta.env.VITE_ML_REDIRECT_URI;

    if (
      !clientId ||
      clientId ===
        "COLE_SEU_CLIENT_ID_AQUI"
    ) {
      alert(
        "Configure o VITE_ML_CLIENT_ID no arquivo .env"
      );
      return;
    }

    if (!redirectUri) {
      alert(
        "Configure o VITE_ML_REDIRECT_URI no arquivo .env"
      );
      return;
    }

    const userId =
  usuario?.id || "";

if (!userId) {
  alert(
    "Usuário não identificado. Entre novamente no PAIIA."
  );
  return;
}

const url =
  `https://auth.mercadolivre.com.br/authorization` +
  `?response_type=code` +
  `&client_id=${clientId}` +
  `&redirect_uri=${encodeURIComponent(
    redirectUri
  )}` +
  `&state=${encodeURIComponent(
    userId
  )}`;

    window.location.href = url;
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
          status="Pronto para conectar"
          corStatus="#22c55e"
          descricao="Autorize sua conta para preparar a publicação automática dos anúncios."
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
        {disponivel
          ? "🔗 Conectar"
          : "⏳ Em breve"}
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