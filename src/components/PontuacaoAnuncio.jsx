import { useEffect } from "react";

export default function PontuacaoAnuncio({
  titulo,
  descricao,
  codigo,
  oem,
  preco,
  fotosAnuncio,
  onPontuacaoChange,
}) {
  const totalFotos = fotosAnuncio?.length || 0;

  let pontos = 0;
  const sugestoes = [];

  if (totalFotos >= 5) {
    pontos += 30;
  } else if (totalFotos >= 3) {
    pontos += 20;
    sugestoes.push("Adicione pelo menos 5 fotos para melhorar o anúncio.");
  } else if (totalFotos >= 1) {
    pontos += 10;
    sugestoes.push("Adicione mais fotos do produto.");
  } else {
    sugestoes.push("Adicione uma foto principal do produto.");
  }

  if (titulo?.length >= 45) {
    pontos += 25;
  } else if (titulo?.length >= 30) {
    pontos += 15;
    sugestoes.push("Aumente o título para mais perto de 60 caracteres.");
  } else if (titulo) {
    pontos += 5;
    sugestoes.push("O título está muito curto.");
  } else {
    sugestoes.push("Informe um título para o anúncio.");
  }

  if (descricao?.length >= 700) {
    pontos += 30;
  } else if (descricao?.length >= 300) {
    pontos += 20;
    sugestoes.push("Inclua mais detalhes na descrição.");
  } else if (descricao) {
    pontos += 10;
    sugestoes.push("A descrição ainda está curta.");
  } else {
    sugestoes.push("Informe uma descrição completa.");
  }

  if (codigo || oem) {
    pontos += 10;
  } else {
    sugestoes.push("Informe o código da peça ou OEM.");
  }

  if (preco) {
    pontos += 5;
  } else {
    sugestoes.push("Informe o preço do anúncio.");
  }

  const estrelas = Math.round(pontos / 20);

const anuncioPronto = pontos >= 80;

useEffect(() => {
  onPontuacaoChange?.({
    pontos,
    anuncioPronto,
  });
}, [pontos, anuncioPronto]);

  return (

    <div
      style={{
        marginTop: "25px",
        padding: "18px",
        borderRadius: "18px",
        background: "#020617",
        border: "1px solid #1e293b",
      }}
    >
      <h3 style={{ color: "#67e8f9" }}>⭐ Pontuação do Anúncio</h3>

      <h2 style={{ color: pontos >= 80 ? "#22c55e" : "#facc15" }}>
        {"⭐".repeat(estrelas)}
        {"☆".repeat(5 - estrelas)} {pontos}/100
      </h2>

      <p style={{ color: "#cbd5e1" }}>
        {pontos >= 80
          ? "Anúncio com boa qualidade para publicação."
          : "O anúncio ainda pode ser melhorado antes da publicação."}
      </p>

      {sugestoes.length > 0 && (
        <div style={{ marginTop: "12px" }}>
          <h4 style={{ color: "#facc15" }}>Sugestões:</h4>

          {sugestoes.map((item, index) => (
            <p key={index} style={{ color: "#94a3b8", margin: "6px 0" }}>
              • {item}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}