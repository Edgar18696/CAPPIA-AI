export default function AlertasTecnicosIA({
  analise,
}) {
  if (!analise) {
    return null;
  }

  const {
    fabricantes,
    motores,
    modelos,
    catalogos,
    totalResultados,
    confianca,
  } = analise;

  const alertas = [];

  if (fabricantes.length > 1) {
    alertas.push({
      tipo: "info",
      texto: `Foram encontrados ${fabricantes.length} fabricantes para esta pesquisa.`,
    });
  }

  if (motores.length > 1) {
    alertas.push({
      tipo: "alerta",
      texto:
        "Existem aplicações para motores diferentes. Verifique a motorização antes da venda.",
    });
  }

  if (modelos.length > 10) {
    alertas.push({
      tipo: "sucesso",
      texto:
        "Peça com ampla aplicação em diversos modelos.",
    });
  }

  if (catalogos.length > 1) {
    alertas.push({
      tipo: "sucesso",
      texto:
        `Informações confirmadas em ${catalogos.length} catálogos diferentes.`,
    });
  }

  if (confianca >= 95) {
    alertas.push({
      tipo: "ok",
      texto:
        "Alto índice de confiança para este cadastro.",
    });
  }

  if (totalResultados === 1) {
    alertas.push({
      tipo: "info",
      texto:
        "Existe apenas um registro correspondente para esta pesquisa.",
    });
  }

  if (!alertas.length) {
    alertas.push({
      tipo: "ok",
      texto:
        "Nenhuma divergência técnica encontrada.",
    });
  }

  const cores = {
    ok: "#16a34a",
    sucesso: "#2563eb",
    alerta: "#f59e0b",
    info: "#06b6d4",
  };

  return (
    <div style={container}>
      <h2 style={titulo}>
        ⚠️ Alertas Técnicos APPIA AI
      </h2>

      {alertas.map((alerta, index) => (
        <div
          key={index}
          style={{
            ...card,
            borderLeft: `5px solid ${cores[alerta.tipo]}`,
          }}
        >
          {alerta.texto}
        </div>
      ))}
    </div>
  );
}

const container = {
  background: "#020617",
  border: "1px solid #334155",
  borderRadius: "18px",
  padding: "22px",
};

const titulo = {
  color: "#67e8f9",
  marginTop: 0,
};

const card = {
  background: "#0f172a",
  padding: "14px",
  borderRadius: "10px",
  color: "#e2e8f0",
  marginBottom: "10px",
};