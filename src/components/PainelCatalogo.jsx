import InteligenciaAppia from "./InteligenciaAppia";

function QualidadeBadge({
  qualidade,
}) {
  if (!qualidade) {
    return null;
  }
  return (
    <div
      style={{
        marginTop: "15px",
        padding: "14px",
        borderRadius: "12px",
        background: "#0f172a",
        border:
          "1px solid #2563eb",
      }}
    >
      <h4
        style={{
          margin: 0,
          color: "#67e8f9",
        }}
      >
        🧠 Inteligência PAIIA
      </h4>

      <div
        style={{
          marginTop: "10px",
          fontSize: "22px",
          fontWeight: "bold",
          color: "#22c55e",
        }}
      >
        ⭐ {qualidade.nota}/100
      </div>

      <div
        style={{
          color: "#cbd5e1",
          marginTop: "5px",
        }}
      >
        Qualidade da Base:
        <b>
          {" "}
          {qualidade.nivel}
        </b>
      </div>
    </div>
  );
}
export default function PainelCatalogo({
  pecaEncontrada,
  diagnostico,
  auditoria,
  mostrarAplicacoes,
  setMostrarAplicacoes,
}) {
  if (!pecaEncontrada) return null;

  console.log(
    "AUDITORIA",
    JSON.stringify(auditoria, null, 2)
  );

  const aprovado =
    auditoria?.aprovado === true;

  const statusAuditoria = aprovado
    ? "APROVADO"
    : "REVISAR";
  return (
    <section style={secaoStyle}>
      <div style={cabecalhoStyle}>
        <div>
<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "8px",
  }}
>
  <div
    style={{
      width: "46px",
      height: "46px",
      borderRadius: "12px",
      background: "linear-gradient(135deg,#2563eb,#22d3ee)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "24px",
    }}
  >
    📚
  </div>

  <div>
    <h3
      style={{
        color: "#67e8f9",
        margin: 0,
        fontSize: "24px",
      }}
    >
      Catálogo Oficial Consultado
    </h3>

    <div
      style={{
        color: "#94a3b8",
        fontSize: "14px",
        marginTop: "2px",
      }}
    >
      Fonte utilizada para gerar este anúncio
    </div>
  </div>
</div>
<div
  style={{
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "8px",
    padding: "8px 14px",
    borderRadius: "999px",
    background: "#082f49",
    border: "1px solid #0ea5e9",
    color: "#67e8f9",
    fontWeight: 600,
    fontSize: "14px",
  }}
>
  📖 Fonte:

  <span style={{ color: "#ffffff" }}>
    {diagnostico?.arquivoCatalogo ||
      pecaEncontrada.origem_catalogo ||
      "Base PAIIA"}
  </span>
</div>

<div
  style={{
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "10px",
    padding: "8px 14px",
    borderRadius: "999px",
    background:
      auditoria?.aprovado === true
        ? "#14532d"
        : "#78350f",
    border:
      auditoria?.aprovado === true
        ? "1px solid #22c55e"
        : "1px solid #f59e0b",
    color:
      auditoria?.aprovado === true
        ? "#86efac"
        : "#fde68a",
    fontWeight: "bold",
    fontSize: "14px",
  }}
>
  {auditoria?.aprovado === true
    ? "✅ Dados validados pelo Catálogo Oficial"
    : "⚠️ Dados precisam de revisão"}
</div>
<div
  style={{
    marginTop: "12px",
    padding: "12px 16px",
    borderRadius: "12px",
    background: "#0f172a",
    border: "1px solid #334155",
    color: "#e2e8f0",
  }}
>
  <strong style={{ color: "#67e8f9" }}>
    🏭 Fabricante identificado:
  </strong>{" "}
  {pecaEncontrada.fabricante || "Não informado"}
</div>
<div
  style={{
    marginTop: "10px",
    padding: "12px 16px",
    borderRadius: "12px",
    background: "#082f49",
    border: "1px solid #0ea5e9",
    color: "#e0f2fe",
  }}
>
  <strong style={{ color: "#67e8f9" }}>
    📚 Fontes consultadas:
  </strong>{" "}
  {diagnostico?.fontes?.length || 1} catálogo(s)
</div>

<div
  style={{
    marginTop: "16px",
    marginBottom: "18px",
    padding: "16px",
    borderRadius: "14px",
    background: "linear-gradient(135deg,#0f172a,#1e293b)",
    border: "1px solid #2563eb",
  }}
>
  <h4
    style={{
      margin: 0,
      marginBottom: "12px",
      color: "#67e8f9",
    }}
  >
    📋 Resumo Executivo
  </h4>

  <Linha
    titulo="Código principal"
    valor={
      pecaEncontrada.codigo_oem ||
      pecaEncontrada.codigo_equivalente
    }
  />

  <Linha
    titulo="Peça"
    valor={pecaEncontrada.peca}
  />

  <Linha
    titulo="Fabricante"
    valor={pecaEncontrada.fabricante}
  />

  <Linha
    titulo="Status"
    valor={
      auditoria?.aprovado
        ? "✅ Validado"
        : "⚠️ Revisar"
    }
  />
</div>
<div
  style={{
    marginTop: "16px",
  }}
>
  <InteligenciaAppia
  baseMestre={
    diagnostico?.baseMestre ||
    pecaEncontrada?.baseMestre ||
    null
  }
  diagnostico={diagnostico}
  confianca={
    diagnostico?.baseMestre
      ?.confianca ||
    pecaEncontrada?.baseMestre
      ?.confianca ||
    diagnostico?.confianca ||
    null
  }
/>
</div>

          {diagnostico?.paginaCatalogo && (
            <div style={paginaStyle}>
              Página {diagnostico.paginaCatalogo}
            </div>
          )}
        </div>

        <div style={acoesStyle}>
          <div
            style={{
              ...auditoriaStyle,
              background: aprovado ? "#14532d" : "#78350f",
              border: aprovado
                ? "1px solid #22c55e"
                : "1px solid #f59e0b",
              color: aprovado ? "#86efac" : "#fde68a",
            }}
          >
            {aprovado ? "✅ APROVADO" : "⚠️ REVISAR"}
          </div>

          <button
            type="button"
            onClick={() =>
              setMostrarAplicacoes(!mostrarAplicacoes)
            }
            style={botaoStyle}
          >
            {mostrarAplicacoes
              ? "▲ Ocultar Dados Técnicos"
              : "▼ Ver Dados Técnicos"}
          </button>
        </div>
      </div>

      {mostrarAplicacoes && (
        <div style={detalhesStyle}>
          {diagnostico?.avisoAplicacao ? (
            <div
              style={{
                marginTop: "12px",
                padding: "12px",
                borderRadius: "10px",
                background: "#78350f",
                border: "1px solid #f59e0b",
                color: "#fde68a",
              }}
            >
              {diagnostico.avisoAplicacao}
            </div>
          ) : null}

          <Linha
            titulo="Peça"
            valor={pecaEncontrada.peca}
          />

          <Linha
            titulo="Fabricante"
            valor={pecaEncontrada.fabricante}
          />
<div style={linhaStyle}>
  <strong style={rotuloStyle}>
    Confiabilidade:
  </strong>

  <div style={{ width: "100%" }}>
    <div
      style={{
        height: "10px",
        borderRadius: "999px",
        background: "#1e293b",
        overflow: "hidden",
        marginBottom: "6px",
      }}
    >
      <div
        style={{
          width: `${
            pecaEncontrada.confiabilidade ||
            diagnostico?.confiabilidade ||
            0
          }%`,
          height: "100%",
          background:
            "linear-gradient(90deg,#22c55e,#67e8f9)",
        }}
      />
    </div>

    <span style={valorStyle}>
  {pecaEncontrada?.fonte_tecnica === "catcar" &&
  pecaEncontrada?.confirmado === true
    ? 100
    : pecaEncontrada?.confiabilidade ||
      diagnostico?.confiabilidade ||
      0}
  % —{" "}
  {pecaEncontrada?.fonte_tecnica === "catcar"
    ? "CatCar Renault — Fonte Confirmada"
    : "Catálogo Oficial PAIIA"}
</span>
  </div>
</div>
          <Linha
            titulo="Código OEM"
            valor={pecaEncontrada.codigo_oem}
          />

          <Linha
            titulo="Código equivalente"
            valor={pecaEncontrada.codigo_equivalente}
          />

          <Linha
            titulo="Montadora"
            valor={pecaEncontrada.montadora}
          />

          <Linha
            titulo="Modelo"
            valor={pecaEncontrada.modelo}
          />

          <Linha
            titulo="Motor"
            valor={pecaEncontrada.motor}
          />

          <Linha
            titulo="Combustível"
            valor={pecaEncontrada.combustivel}
          />

          <Linha
            titulo="Ano"
            valor={montarPeriodo(pecaEncontrada)}
          />

          <Linha
            titulo="Observações"
            valor={pecaEncontrada.observacao}
          />
        </div>
      )}
    </section>
  );
}

function Linha({ titulo, valor }) {
  return (
    <div style={linhaStyle}>
      <strong style={rotuloStyle}>{titulo}:</strong>

      <span style={valorStyle}>
        {valor || "Não informado"}
      </span>
    </div>
  );
}

function montarPeriodo(item) {
  if (!item?.ano_inicio && !item?.ano_fim) {
    return "Não informado";
  }

  return `${item.ano_inicio || "?"} até ${
    item.ano_fim || "Atual"
  }`;
}

const secaoStyle = {
  marginTop: "18px",
  padding: "18px",
  borderRadius: "16px",
  background: "#052e16",
  border: "1px solid #22c55e",
};

const cabecalhoStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "15px",
};

const acoesStyle = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "10px",
};

const tituloStyle = {
  color: "#67e8f9",
  margin: 0,
  marginBottom: "6px",
};

const fonteStyle = {
  color: "#fff",
};

const paginaStyle = {
  color: "#94a3b8",
  marginTop: "4px",
};

const auditoriaStyle = {
  padding: "10px 14px",
  borderRadius: "10px",
  fontWeight: "bold",
  fontSize: "14px",
};

const botaoStyle = {
  padding: "12px 18px",
  borderRadius: "10px",
  border: "none",
  background:
    "linear-gradient(135deg,#2563eb,#22d3ee)",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
};

const detalhesStyle = {
  marginTop: "18px",
  padding: "16px",
  borderRadius: "12px",
  background: "#020617",
};

const linhaStyle = {
  display: "grid",
  gridTemplateColumns: "180px 1fr",
  gap: "12px",
  padding: "9px 0",
  borderBottom: "1px solid #1e293b",
};

const rotuloStyle = {
  color: "#67e8f9",
};

const valorStyle = {
  color: "#e2e8f0",
  whiteSpace: "pre-wrap",
};
const tagStyle = {
  padding: "8px 12px",
  borderRadius: "999px",
  background: "#1e293b",
  border: "1px solid #334155",
  color: "#67e8f9",
  fontSize: "13px",
  fontWeight: "bold",
};