import { useState } from "react";
import { supabase } from "../supabase";

export default function PesquisaAplicacao({ cardStyle, voltar }) {
  const [aplicacao, setAplicacao] = useState("");
  const [resultados, setResultados] = useState([]);

  async function pesquisarAplicacao() {
    if (!aplicacao.trim()) {
      alert("Digite uma aplicação.");
      return;
    }

const texto = aplicacao.trim();

const { data, error } = await supabase
  .from("pecas_catalogo")
  .select("*")
  .or(
    `aplicacao.ilike.%${texto}%,
     marca_veiculo.ilike.%${texto}%,
     modelo_veiculo.ilike.%${texto}%,
     motor.ilike.%${texto}%,
     ano.ilike.%${texto}%`
  );

    if (error) {
      alert("Erro na pesquisa.");
      return;
    }

    setResultados(data || []);
  }

  return (
    <div style={cardStyle}>
      <button onClick={voltar}>⬅ Voltar</button>

      <h2 style={{ color: "#67e8f9", marginTop: 20 }}>
        🚗 Pesquisa por Aplicação
      </h2>

      <input
        value={aplicacao}
        onChange={(e) => setAplicacao(e.target.value)}
        placeholder="Ex.: Sandero, Uno, Marea..."
        style={{
          width: "100%",
          padding: "14px",
          marginTop: "20px",
          borderRadius: "10px",
        }}
      />

      <button
        onClick={pesquisarAplicacao}
        style={{ marginTop: "20px" }}
      >
        🔍 Pesquisar
      </button>

      <div style={{ marginTop: "30px" }}>
        {resultados.map((item) => (
          <div
            key={item.id}
            style={{
              border: "1px solid #334155",
              borderRadius: "10px",
              padding: "15px",
              marginBottom: "15px",
            }}
          >
            <p><b>📦 Código:</b> {item.codigo}</p>

<p><b>📝 Descrição:</b> {item.descricao}</p>

<p><b>🏭 Fabricante:</b> {item.fabricante}</p>

<p><b>🚗 Marca:</b> {item.marca_veiculo}</p>

<p><b>🚘 Modelos:</b> {item.modelo_veiculo}</p>

<p><b>⚙️ Motor:</b> {item.motor}</p>

<p><b>📅 Ano:</b> {item.ano}</p>

<p><b>🔄 Equivalências:</b> {item.equivalencias}</p>

<p><b>📋 Aplicação:</b> {item.aplicacao}</p>
          </div>
        ))}
      </div>
    </div>
  );
}