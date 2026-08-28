import { useEffect, useState } from "react";

import {
  buscarContaMarketplace,
  salvarContaMarketplace,
} from "../services/contasMarketplaceService";

export default function ContasMarketplace({
  usuario,
  cardStyle,
  setScreen,
}) {
  const [mercadoLivre, setMercadoLivre] = useState(null);

  useEffect(() => {
    carregarConta();
  }, []);

  async function carregarConta() {
    if (!usuario?.id) return;

    const { data, error } = await buscarContaMarketplace(
      usuario.id,
      "mercadolivre"
    );

    if (error) {
      console.log(error);
      return;
    }

    setMercadoLivre(data);
  }

  async function conectarMercadoLivre() {
    if (!usuario?.id) return;

    const { error } = await salvarContaMarketplace({
      user_id: usuario.id,
      marketplace: "mercadolivre",
      status: "conectado",
      apelido: "Casa da Injeção Eletrônica",
      seller_id: "EM_DESENVOLVIMENTO",
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("✅ Mercado Livre conectado (simulação).");

    carregarConta();
  }

  return (
    <div style={{ marginTop: "40px" }}>
      <div style={cardStyle}>
        <h2
          style={{
            color: "#67e8f9",
            fontSize: "32px",
          }}
        >
          ⚙️ Contas Marketplace
        </h2>

        <p
          style={{
            color: "#94a3b8",
            marginBottom: "25px",
          }}
        >
          Gerencie as contas conectadas.
        </p>

        <div
          style={{
            background: "#020617",
            border: "1px solid #1e293b",
            borderRadius: "16px",
            padding: "20px",
          }}
        >
          <h3 style={{ color: "#e2e8f0" }}>
            Mercado Livre
          </h3>

          <p
            style={{
              color:
                mercadoLivre?.status === "conectado"
                  ? "#22c55e"
                  : "#ef4444",
            }}
          >
            Status:
            {" "}
            {mercadoLivre?.status || "Não conectado"}
          </p>

          {mercadoLivre?.apelido && (
            <p
              style={{
                color: "#cbd5e1",
              }}
            >
              Conta:
              {" "}
              {mercadoLivre.apelido}
            </p>
          )}

          <button
            style={botaoStyle}
            onClick={conectarMercadoLivre}
          >
            🔗 Conectar Mercado Livre
          </button>
        </div>

        <button
          style={{
            ...botaoStyle,
            marginTop: "25px",
            background: "#334155",
          }}
          onClick={() => setScreen("home")}
        >
          ⬅ Voltar
        </button>
      </div>
    </div>
  );
}

const botaoStyle = {
  marginTop: "18px",
  padding: "12px 22px",
  borderRadius: "10px",
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
};