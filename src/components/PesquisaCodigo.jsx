import { useState } from "react";
import { supabase } from "../supabase";
export default function PesquisaCodigo({ cardStyle, voltar }) {
  const [codigo, setCodigo] = useState("");
  const [resultado, setResultado] = useState(null);

  async function pesquisarCodigo() {
  if (!codigo.trim()) {
    alert("Digite um código.");
    return;
  }

const codigoLimpo = codigo.trim();

const { data, error } = await supabase
  .from("pecas_catalogo")
  .select("*")
  .ilike("codigo", codigoLimpo)
  .limit(1);

console.log("BUSCA CÓDIGO:", codigoLimpo);
console.log("DATA:", data);
console.log("ERROR:", error);

if (error || !data || data.length === 0) {
  setResultado(null);
  alert("Código não encontrado.");
  return;
}

setResultado(data[0]);
}

  

  return (
    <div style={cardStyle}>
      <button onClick={voltar}>⬅ Voltar</button>

      <h2 style={{ color: "#67e8f9", fontSize: "30px", marginTop: "20px" }}>
        🔎 Pesquisa por Código
      </h2>

      <input
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        placeholder="Digite o código da peça..."
        style={{
          width: "100%",
          padding: "14px",
          borderRadius: "10px",
          border: "1px solid #334155",
          background: "#0f172a",
          color: "white",
          fontSize: "16px",
          marginTop: "20px",
        }}
      />

      <button onClick={pesquisarCodigo} style={{ marginTop: "20px" }}>
        🔍 Pesquisar
      </button>

      <div style={{ marginTop: "30px" }}>
        <h3 style={{ color: "#67e8f9" }}>Resultado</h3>

        {!resultado ? (
          <p style={{ color: "#cbd5e1" }}>Nenhuma pesquisa realizada.</p>
        ) : (
          <div style={cardStyle}>
            <p><b>Código:</b> {resultado.codigo}</p>
            <p><b>Descrição:</b> {resultado.descricao}</p>
            <p><b>Aplicação:</b> {resultado.aplicacao}</p>
            <p><b>Equivalências:</b> {resultado.equivalencias}</p>
            <p><b>Fabricante:</b> {resultado.fabricante}</p>
          </div>
        )}
      </div>
    </div>
  );
}