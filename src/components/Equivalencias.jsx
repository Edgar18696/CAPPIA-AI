import { useState } from "react";
import { supabase } from "../supabase";

export default function Equivalencias({ cardStyle, voltar }) {
  const [codigo, setCodigo] = useState("");
  const [resultado, setResultado] = useState(null);

  async function pesquisarEquivalencia() {
    if (!codigo.trim()) {
      alert("Digite um código.");
      return;
    }

    const texto = codigo.trim();

    const { data, error } = await supabase
      .from("pecas_catalogo")
      .select("*")
      .or(`codigo.ilike.%${texto}%,equivalencias.ilike.%${texto}%`)
      .limit(1);

    if (error || !data || data.length === 0) {
      setResultado(null);
      alert("Nenhuma equivalência encontrada.");
      return;
    }

    setResultado(data[0]);
  }

  return (
    <div style={cardStyle}>
      <button onClick={voltar}>⬅ Voltar</button>

      <h2 style={{ color: "#67e8f9", marginTop: 20 }}>
        🔄 Equivalências
      </h2>

      <input
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        placeholder="Digite o código da peça..."
        style={{
          width: "100%",
          padding: "14px",
          marginTop: "20px",
          borderRadius: "10px",
        }}
      />

      <button onClick={pesquisarEquivalencia} style={{ marginTop: "20px" }}>
        🔍 Pesquisar
      </button>

      {resultado && (
        <div style={{ marginTop: "30px" }}>
          <p><b>Código principal:</b> {resultado.codigo}</p>
          <p><b>Descrição:</b> {resultado.descricao}</p>
          <p><b>Equivalências:</b> {resultado.equivalencias}</p>
          <p><b>Fabricante:</b> {resultado.fabricante}</p>
          <p><b>Aplicação:</b> {resultado.aplicacao}</p>
        </div>
      )}
    </div>
  );
}