export default function DiagnosticoTecnicoIA({
  analise,
}) {
  if (!analise) {
    return null;
  }

  const {
    principal,
    fabricantes,
    modelos,
    montadoras,
    totalResultados,
    confianca,
  } = analise;

  let mensagem =
    "Foram encontrados registros técnicos para esta pesquisa.";

  if (totalResultados > 20) {
    mensagem =
      "A pesquisa retornou muitos registros. Utilize fabricante, veículo ou motor para refinar a busca.";
  }

  if (fabricantes.length === 1) {
    mensagem =
      `Todos os resultados pertencem ao fabricante ${fabricantes[0]}.`;
  }

  return (
    <div style={painel}>
      <h2 style={titulo}>
        🤖 Diagnóstico Técnico PAIIA AI
      </h2>

      <p style={texto}>
        {mensagem}
      </p>

      <div style={bloco}>
        <b>Peça principal</b>

        <div>{principal.peca}</div>
      </div>

      <div style={bloco}>
        <b>Fabricantes encontrados</b>

        <div>
          {fabricantes.join(", ")}
        </div>
      </div>

      <div style={bloco}>
        <b>Montadoras</b>

        <div>
          {montadoras.join(", ")}
        </div>
      </div>

      <div style={bloco}>
        <b>Modelos</b>

        <div>
          {modelos.join(", ")}
        </div>
      </div>

      <div style={bloco}>
        <b>Índice de confiança</b>

        <div>
          {confianca}%
        </div>
      </div>

      <div style={blocoVerde}>
        💡 Recomendação PAIIA AI

        <div style={{ marginTop: 8 }}>
          Utilize o registro principal como base para
          consultas técnicas e geração automática do
          anúncio.
        </div>
      </div>
    </div>
  );
}

const painel = {
  background: "#02111f",
  border: "1px solid #2563eb",
  borderRadius: "18px",
  padding: "22px",
  marginTop: "20px",
};

const titulo = {
  color: "#67e8f9",
  marginTop: 0,
};

const texto = {
  color: "#cbd5e1",
  lineHeight: 1.6,
};

const bloco = {
  marginTop: "15px",
  padding: "12px",
  background: "#0f172a",
  borderRadius: "12px",
};

const blocoVerde = {
  marginTop: "20px",
  padding: "18px",
  background: "#052e16",
  border: "1px solid #22c55e",
  borderRadius: "12px",
  color: "#dcfce7",
};