export default function FichaTecnicaIA({
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
    motores,
    catalogos,
    equivalentes,
  } = analise;

  return (
    <div style={container}>
      <h2 style={titulo}>
        📋 Ficha Técnica Inteligente
      </h2>

      <table style={tabela}>
        <tbody>
          <Linha
            titulo="Peça"
            valor={principal.peca}
          />

          <Linha
            titulo="Código OEM"
            valor={principal.codigo_oem}
          />

          <Linha
            titulo="Código Equivalente"
            valor={equivalentes.join(", ")}
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
            titulo="Motores"
            valor={motores.join(", ")}
          />

          <Linha
            titulo="Catálogos"
            valor={catalogos.join(", ")}
          />
        </tbody>
      </table>
    </div>
  );
}

function Linha({
  titulo,
  valor,
}) {
  return (
    <tr>
      <td style={colunaTitulo}>
        {titulo}
      </td>

      <td style={colunaValor}>
        {valor || "-"}
      </td>
    </tr>
  );
}

const container = {
  background: "#020617",
  border: "1px solid #334155",
  borderRadius: "18px",
  padding: "22px",
  marginTop: "20px",
};

const titulo = {
  color: "#67e8f9",
  marginTop: 0,
};

const tabela = {
  width: "100%",
  borderCollapse: "collapse",
};

const colunaTitulo = {
  width: "180px",
  padding: "12px",
  fontWeight: "bold",
  color: "#67e8f9",
  borderBottom: "1px solid #1e293b",
  verticalAlign: "top",
};

const colunaValor = {
  padding: "12px",
  color: "#e2e8f0",
  borderBottom: "1px solid #1e293b",
};