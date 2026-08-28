export default function ParecerTecnicoIA({
  analise,
}) {
  if (!analise) {
    return null;
  }

  const {
    principal,
    fabricantes,
    montadoras,
    modelos,
    catalogos,
    confianca,
    totalResultados,
  } = analise;

  let parecer =
    "As informações encontradas apresentam consistência suficiente para utilização em consultas técnicas e geração automática de anúncios.";

  if (confianca >= 95) {
    parecer =
      "Os dados possuem alto grau de confiabilidade, confirmados por múltiplas fontes técnicas.";
  } else if (confianca < 80) {
    parecer =
      "Recomenda-se validar este cadastro com documentação técnica antes da utilização.";
  }

  return (
    <div style={container}>
      <h2 style={titulo}>
        🧠 Parecer Técnico APPIA AI
      </h2>

      <div style={caixa}>
        <Linha
          titulo="Peça"
          valor={principal.peca}
        />

        <Linha
          titulo="Código Principal"
          valor={principal.codigo_oem}
        />

        <Linha
          titulo="Fabricantes"
          valor={fabricantes.join(", ")}
        />

        <Linha
          titulo="Montadoras"
          valor={montadoras.join(", ")}
        />

        <Linha
          titulo="Modelos"
          valor={modelos.join(", ")}
        />

        <Linha
          titulo="Catálogos"
          valor={catalogos.join(", ")}
        />

        <Linha
          titulo="Resultados"
          valor={totalResultados}
        />

        <Linha
          titulo="Confiabilidade"
          valor={`${confianca}%`}
        />

        <hr
          style={{
            border: "1px solid #334155",
            margin: "20px 0",
          }}
        />

        <div
          style={{
            background: "#052e16",
            border: "1px solid #22c55e",
            borderRadius: "12px",
            padding: "18px",
            color: "#dcfce7",
            lineHeight: 1.7,
          }}
        >
          <b>Conclusão da IA</b>

          <p
            style={{
              marginTop: "10px",
              marginBottom: 0,
            }}
          >
            {parecer}
          </p>
        </div>
      </div>
    </div>
  );
}

function Linha({
  titulo,
  valor,
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent:
          "space-between",
        padding: "8px 0",
        borderBottom:
          "1px solid #1e293b",
      }}
    >
      <strong>{titulo}</strong>

      <span>{valor || "-"}</span>
    </div>
  );
}

const container = {
  background: "#020617",
  border: "1px solid #2563eb",
  borderRadius: "18px",
  padding: "22px",
};

const titulo = {
  color: "#67e8f9",
  marginTop: 0,
};

const caixa = {
  background: "#0f172a",
  borderRadius: "12px",
  padding: "20px",
  color: "#e2e8f0",
};