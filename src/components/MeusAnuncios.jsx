import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function MeusAnuncios({
  cardStyle,
  setScreen,
  setAnuncioEditando,
}) {
  const [anuncios, setAnuncios] = useState([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    carregarAnuncios();
  }, []);

  async function carregarAnuncios() {
    setCarregando(true);

    const { data, error } = await supabase
      .from("anuncios")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error("Erro ao carregar anúncios:", error);
      alert("Erro ao carregar anúncios: " + error.message);
      setCarregando(false);
      return;
    }

    setAnuncios(data || []);
    setCarregando(false);
  }

  async function excluirAnuncio(id) {
    const confirmar = window.confirm("Deseja realmente excluir este anúncio?");

    if (!confirmar) return;

    const { error } = await supabase.from("anuncios").delete().eq("id", id);

    if (error) {
      alert("Erro ao excluir: " + error.message);
      return;
    }

    carregarAnuncios();
  }

  return (
    <div style={{ marginTop: "40px" }}>
      <div style={cardStyle}>
        <h2 style={{ color: "#67e8f9", fontSize: "32px" }}>
          📋 Meus Anúncios
        </h2>

        <p style={{ color: "#cbd5e1" }}>
          Lista dos anúncios salvos no PAIIA AI.
        </p>

        {carregando && (
          <p style={{ color: "#94a3b8" }}>Carregando anúncios...</p>
        )}

        {!carregando && anuncios.length === 0 && (
          <p style={{ color: "#94a3b8" }}>Nenhum anúncio salvo ainda.</p>
        )}

        <div style={listaStyle}>
          {anuncios.map((anuncio) => (
            <div key={anuncio.id} style={cardAnuncioStyle}>
              <h3 style={{ color: "#67e8f9", marginTop: 0 }}>
                {anuncio.titulo || "Anúncio sem título"}
              </h3>
              {anuncio.foto_principal && (
  <img
    src={anuncio.foto_principal}
    alt="Foto principal"
    style={fotoPrincipalStyle}
  />
)}

              <p style={textoStyle}>
                <strong>Código:</strong> {anuncio.codigo || "-"}
              </p>

              <p style={textoStyle}>
                <strong>OEM:</strong> {anuncio.oem || "-"}
              </p>

              <p style={textoStyle}>
                <strong>Preço:</strong>{" "}
                {anuncio.preco ? `R$ ${anuncio.preco}` : "-"}
              </p>
<p style={textoStyle}>
  <strong>Status:</strong>{" "}
  <span style={statusStyle}>
    {anuncio.status || "rascunho"}
  </span>
</p>
              <p style={descricaoStyle}>
                {anuncio.descricao
                  ? anuncio.descricao.slice(0, 180) + "..."
                  : "Sem descrição."}
              </p>

              <div style={acoesStyle}>
                <button
                  style={botaoAcaoStyle}
 onClick={() => {
  setAnuncioEditando(anuncio);
  setScreen("novoAnuncio");
}}
                >
                  ✏️ Editar
                </button>

                <button
                  style={botaoAcaoStyle}
           onClick={() => {
  setAnuncioEditando({
    ...anuncio,
    id: null,
  });

  setScreen("novoAnuncio");
}}
                >
                  📄 Duplicar
                </button>

                <button
                  style={{
                    ...botaoAcaoStyle,
                    background: "#dc2626",
                  }}
                  onClick={() => excluirAnuncio(anuncio.id)}
                >
                  🗑️ Excluir
                </button>
                <button
  style={{
    ...botaoAcaoStyle,
    background: "#059669",
  }}
  onClick={() => {
    alert("🚀 Publicação Mercado Livre em desenvolvimento.");
  }}
>
  🚀 Mercado Livre
</button>

<button
  style={{
    ...botaoAcaoStyle,
    background: "#ea580c",
  }}
  onClick={() => {
    alert("🛒 Publicação Shopee em desenvolvimento.");
  }}
>
  🛒 Shopee
</button>

<button
  style={{
    ...botaoAcaoStyle,
    background: "#0f766e",
  }}
  onClick={() => {
    alert("📲 Texto para WhatsApp em desenvolvimento.");
  }}
>
  📲 WhatsApp
</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
const statusStyle = {
  background: "#facc15",
  color: "#111827",
  padding: "4px 8px",
  borderRadius: "8px",
  fontWeight: "bold",
  fontSize: "13px",
};
const listaStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "16px",
  marginTop: "25px",
};

const cardAnuncioStyle = {
  background: "#020617",
  border: "1px solid #2563eb",
  borderRadius: "16px",
  padding: "18px",
};

const textoStyle = {
  color: "#cbd5e1",
  margin: "6px 0",
};

const descricaoStyle = {
  color: "#94a3b8",
  marginTop: "12px",
  lineHeight: "1.5",
};

const acoesStyle = {
  display: "flex",
  gap: "10px",
  marginTop: "15px",
  flexWrap: "wrap",
};

const botaoAcaoStyle = {
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: "8px",
  padding: "8px 14px",
  cursor: "pointer",
  fontWeight: "bold",
};
const fotoPrincipalStyle = {
  width: "100%",
  height: "180px",
  objectFit: "cover",
  borderRadius: "12px",
  background: "#fff",
  marginBottom: "12px",
};