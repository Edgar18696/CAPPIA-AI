import { useState } from "react";
import { supabase } from "../supabase";

export default function IAEspecialista({ cardStyle, voltar }) {
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState("");

async function consultarIA() {
  if (!pergunta.trim()) {
    alert("Digite uma pergunta.");
    return;
  }

  const texto = pergunta.trim();

  const { data, error } = await supabase
    .from("pecas_catalogo")
    .select("*")
    .or(
      `codigo.ilike.%${texto}%,
       descricao.ilike.%${texto}%,
       aplicacao.ilike.%${texto}%,
       equivalencias.ilike.%${texto}%,
       fabricante.ilike.%${texto}%,
       marca_veiculo.ilike.%${texto}%,
       modelo_veiculo.ilike.%${texto}%`
    )
    .limit(1);

  if (error || !data || data.length === 0) {
    setResposta(
      "Não encontrei essa informação na base APPIA. Recomendo confirmar pelo código gravado na peça original ou pelo chassi do veículo."
    );
    return;
  }

  const peca = data[0];

  setResposta(`
📦 ${peca.descricao}

Código: ${peca.codigo}

Fabricante: ${peca.fabricante}

Aplicação: ${peca.aplicacao}

Equivalências: ${peca.equivalencias}

Observação: confirme sempre o código gravado na peça original ou o chassi antes da compra.
`);
}

  return (
    <div style={cardStyle}>
      <button onClick={voltar}>⬅ Voltar</button>
{resposta && (
  <div
    style={{
      marginTop: "25px",
      padding: "15px",
      border: "1px solid #334155",
      borderRadius: "10px",
      whiteSpace: "pre-line",
      color: "#e5e7eb",
    }}
  >
    {resposta}
  </div>
)}
      <h2
        style={{
          color: "#67e8f9",
          marginTop: 20,
        }}
      >
        🤖 IA Especialista
      </h2>

      <p style={{ color: "#cbd5e1" }}>
        Faça perguntas técnicas sobre peças, aplicações e códigos.
      </p>

      <textarea
        value={pergunta}
        onChange={(e) => setPergunta(e.target.value)}
        placeholder="Ex.: O código 0261230268 serve no Sandero 1.6 2014?"
        style={{
          width: "100%",
          minHeight: "140px",
          padding: "15px",
          marginTop: "20px",
          borderRadius: "10px",
          resize: "vertical",
        }}
      />

      <button
        onClick={consultarIA}
        style={{ marginTop: "20px" }}
      >
        🧠 Consultar Especialista
      </button>
    </div>
  );
}