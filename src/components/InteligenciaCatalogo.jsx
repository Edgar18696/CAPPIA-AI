import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function InteligenciaCatalogo({ cardStyle }) {
  const [pendentes, setPendentes] = useState([]);

  useEffect(() => {
    carregarPendentes();
  }, []);

  async function carregarPendentes() {
    const { data } = await supabase
      .from("pecas_nao_encontradas")
      .select("*")
      .order("created_at", { ascending: false });

    setPendentes(data || []);
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
          🧠 Inteligência do Catálogo
        </h2>

        <p
          style={{
            color: "#94a3b8",
            marginBottom: "25px",
          }}
        >
          O APPIA AI aprende continuamente quais códigos ainda não existem na
          base e ajuda a definir prioridades de importação.
        </p>

        <div
          style={{
            background: "#020617",
            border: "1px solid #1e293b",
            borderRadius: "16px",
            padding: "18px",
          }}
        >
          <h3 style={{ color: "#38bdf8" }}>
            📋 Peças não encontradas
          </h3>

          {pendentes.length === 0 && (
            <p style={{ color: "#22c55e" }}>
              Nenhuma peça pendente.
            </p>
          )}

          {pendentes.map((item) => (
            <div
              key={item.id}
              style={{
                borderBottom: "1px solid #1e293b",
                padding: "12px 0",
              }}
            >
              <strong style={{ color: "#fff" }}>
                {item.termo_busca}
              </strong>

              <p
                style={{
                  color: "#94a3b8",
                  marginTop: "5px",
                }}
              >
                Status: {item.status}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}