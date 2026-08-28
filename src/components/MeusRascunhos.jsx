import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function MeusRascunhos({
  usuario,
  cardStyle,
  setScreen,
  setAnuncioEditando,
  setFotosAnuncio,
}) {
  const [rascunhos, setRascunhos] = useState([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    carregarRascunhos();
  }, []);

  async function carregarRascunhos() {
    if (!usuario?.id) return;

    setCarregando(true);

    const { data, error } = await supabase
      .from("rascunhos_anuncios")
      .select("*")
      .eq("user_id", usuario.id)
      .order("created_at", { ascending: false });

    setCarregando(false);

    if (error) {
      alert("Erro ao carregar rascunhos: " + error.message);
      return;
    }

    setRascunhos(data || []);
  }

  function continuarRascunho(rascunho) {
    setAnuncioEditando(rascunho);
    setFotosAnuncio(rascunho.fotos || []);
    setScreen("novoAnuncio");
  }

  async function excluirRascunho(id) {
    const confirmar = confirm("Deseja excluir este rascunho?");
    if (!confirmar) return;

    const { error } = await supabase
      .from("rascunhos_anuncios")
      .delete()
      .eq("id", id)
      .eq("user_id", usuario.id);

    if (error) {
      alert("Erro ao excluir: " + error.message);
      return;
    }

    carregarRascunhos();
  }
async function duplicarRascunho(rascunho) {
  const novoRascunho = {
    user_id: usuario.id,
    codigo: rascunho.codigo,
    oem: rascunho.oem,
    titulo: `${rascunho.titulo || "Anúncio"} (Cópia)`,
    descricao: rascunho.descricao,
    preco: rascunho.preco,
    tipo: rascunho.tipo,
    foto_principal: rascunho.foto_principal,
    fotos: rascunho.fotos || [],
    status: "rascunho",
  };

  const { error } = await supabase
    .from("rascunhos_anuncios")
    .insert([novoRascunho]);

  if (error) {
    alert("Erro ao duplicar: " + error.message);
    return;
  }

  alert("📄 Rascunho duplicado com sucesso!");
  carregarRascunhos();
}
  return (
    <div style={{ marginTop: "40px" }}>
      <div style={cardStyle}>
        <h2 style={{ color: "#67e8f9", fontSize: "32px" }}>
          📂 Meus Rascunhos
        </h2>

        <button style={botaoVoltar} onClick={() => setScreen("home")}>
          ⬅ Voltar
        </button>

        {carregando && (
          <p style={{ color: "#94a3b8" }}>Carregando rascunhos...</p>
        )}

        {!carregando && rascunhos.length === 0 && (
          <p style={{ color: "#94a3b8", marginTop: "20px" }}>
            Nenhum rascunho salvo ainda.
          </p>
        )}

        <div style={gridStyle}>
          {rascunhos.map((item) => (
            <div key={item.id} style={cardRascunho}>
              {item.foto_principal ? (
                <img
                  src={item.foto_principal}
                  alt={item.titulo || "Rascunho"}
                  style={fotoStyle}
                />
              ) : (
                <div style={semFotoStyle}>Sem foto</div>
              )}

              <h3 style={{ color: "#e2e8f0", marginTop: "12px" }}>
                {item.titulo || "Anúncio sem título"}
              </h3>

              <p style={{ color: "#94a3b8" }}>
                Código: {item.codigo || item.oem || "Não informado"}
              </p>

              <p style={{ color: "#22c55e", fontWeight: "bold" }}>
                {item.preco ? `R$ ${item.preco}` : "Preço não informado"}
              </p>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  style={botaoEditar}
                  onClick={() => continuarRascunho(item)}
                >
                  ✏️ Continuar
                </button>
<button
  style={botaoDuplicar}
  onClick={() => duplicarRascunho(item)}
>
  📄 Duplicar
</button>
                <button
                  style={botaoExcluir}
                  onClick={() => excluirRascunho(item.id)}
                >
                  🗑 Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  gap: "18px",
  marginTop: "25px",
};

const cardRascunho = {
  background: "#020617",
  border: "1px solid #1e293b",
  borderRadius: "16px",
  padding: "14px",
};

const fotoStyle = {
  width: "100%",
  height: "190px",
  objectFit: "contain",
  background: "#fff",
  borderRadius: "12px",
};

const semFotoStyle = {
  width: "100%",
  height: "190px",
  borderRadius: "12px",
  background: "#1e293b",
  color: "#94a3b8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const botaoEditar = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
};

const botaoExcluir = {
  ...botaoEditar,
  background: "#dc2626",
};

const botaoVoltar = {
  marginTop: "10px",
  padding: "10px 16px",
  borderRadius: "10px",
  border: "none",
  background: "#334155",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
};
const botaoDuplicar = {
  ...botaoEditar,
  background: "#7c3aed",
};