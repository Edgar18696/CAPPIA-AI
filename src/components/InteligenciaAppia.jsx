function listaSegura(valor) {
  return Array.isArray(valor)
    ? valor.filter(Boolean)
    : [];
}

function ListaChips({
  titulo,
  itens = [],
}) {
  const lista =
    listaSegura(itens);

  if (lista.length === 0) {
    return null;
  }

  return (
    <div style={secao}>
      <h4 style={tituloSecao}>
        {titulo}
      </h4>

      <div style={chips}>
        {lista
          .slice(0, 12)
          .map((item, index) => (
            <span
              key={`${item}-${index}`}
              style={chip}
            >
              {item}
            </span>
          ))}
      </div>

      {lista.length > 12 && (
        <div style={maisItens}>
          + {lista.length - 12} outros
        </div>
      )}
    </div>
  );
}

export default function InteligenciaAppia({
  baseMestre,
  diagnostico,
  confianca,
}) {

  const base =
    baseMestre ||
    diagnostico?.baseMestre ||
    {};

  const qualidade =
    base.qualidade || {};

  const confiancaFinal =
    base.confianca ||
    confianca ||
    diagnostico?.confianca ||
    {};

  const fabricantesBase =
    listaSegura(
      base.fabricantes
    );

  const fabricantes =
    fabricantesBase.length > 0
      ? fabricantesBase
      : base.fabricante
        ? [base.fabricante]
        : [];

  const fontes =
    listaSegura(
      base.fontes
    );

  const insights =
    listaSegura(
      base.insights
    );

  const equivalentes =
    listaSegura(
      base.equivalentes
    );

  const aplicacoes =
    listaSegura(
      base.aplicacoes
    );

  const motivosConfianca =
    listaSegura(
      confiancaFinal.motivos
    );

  if (
    !baseMestre &&
    !diagnostico &&
    !confianca
  ) {
    return null;
  }

  return (
    <div style={painel}>
      <div style={cabecalho}>
        <div>
          <h3 style={titulo}>
            🧠 Inteligência APPIA
          </h3>

          <p style={subtitulo}>
            Análise consolidada da Base Mestre.
          </p>
        </div>

        {qualidade.nota !==
          undefined && (
          <div style={qualidadeBox}>
            <span style={qualidadeNota}>
              ⭐ {qualidade.nota}/100
            </span>

            <span style={qualidadeNivel}>
              {qualidade.nivel ||
                "Não avaliada"}
            </span>
          </div>
        )}
      </div>

      <div style={gridResumo}>
        <div style={cardResumo}>
          <span style={rotulo}>
            Confiança
          </span>

          <strong style={valor}>
            {Number(
              confiancaFinal.percentual
            ) || 0}
            %
          </strong>

          <span style={detalhe}>
            {confiancaFinal.nivel ||
              "Baixa"}
          </span>
        </div>

        <div style={cardResumo}>
          <span style={rotulo}>
            Aplicações
          </span>

          <strong style={valor}>
            {aplicacoes.length}
          </strong>

          <span style={detalhe}>
            registros consolidados
          </span>
        </div>

        <div style={cardResumo}>
          <span style={rotulo}>
            Fontes
          </span>

          <strong style={valor}>
            {fontes.length}
          </strong>

          <span style={detalhe}>
            catálogos consultados
          </span>
        </div>
      </div>

      <ListaChips
        titulo="🏭 Fabricantes confirmados"
        itens={fabricantes}
      />

      <ListaChips
        titulo="📚 Fontes técnicas"
        itens={fontes}
      />

      <ListaChips
        titulo="🔄 Códigos equivalentes"
        itens={equivalentes}
      />

      {insights.length > 0 && (
        <div style={secao}>
          <h4 style={tituloSecao}>
            💡 Insights APPIA
          </h4>

          <div style={listaInsights}>
            {insights.map(
              (item, index) => (
                <div
                  key={`${item}-${index}`}
                  style={insight}
                >
                  <span>✓</span>

                  <span>{item}</span>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {motivosConfianca.length >
        0 && (
        <div style={secao}>
          <h4 style={tituloSecao}>
            🎯 Motivos da confiança
          </h4>

          <div style={listaInsights}>
            {motivosConfianca.map(
              (item, index) => (
                <div
                  key={`${item}-${index}`}
                  style={motivo}
                >
                  <span>•</span>

                  <span>{item}</span>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const painel = {
  marginTop: "20px",
  padding: "20px",
  background: "#020617",
  border:
    "1px solid #2563eb",
  borderRadius: "18px",
  textAlign: "left",
};

const cabecalho = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems:
    "flex-start",
  gap: "20px",
  flexWrap: "wrap",
  marginBottom: "18px",
};

const titulo = {
  margin: 0,
  color: "#67e8f9",
};

const subtitulo = {
  marginTop: "6px",
  marginBottom: 0,
  color: "#94a3b8",
};

const qualidadeBox = {
  minWidth: "135px",
  padding: "12px 16px",
  borderRadius: "14px",
  background: "#052e16",
  border:
    "1px solid #16a34a",
  textAlign: "center",
};

const qualidadeNota = {
  display: "block",
  color: "#4ade80",
  fontSize: "21px",
  fontWeight: "bold",
};

const qualidadeNivel = {
  display: "block",
  marginTop: "5px",
  color: "#bbf7d0",
  fontSize: "13px",
};

const gridResumo = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "12px",
  marginBottom: "18px",
};

const cardResumo = {
  padding: "14px",
  borderRadius: "14px",
  background: "#0f172a",
  border:
    "1px solid #334155",
  textAlign: "center",
};

const rotulo = {
  display: "block",
  color: "#94a3b8",
  fontSize: "13px",
};

const valor = {
  display: "block",
  marginTop: "5px",
  color: "#67e8f9",
  fontSize: "25px",
};

const detalhe = {
  display: "block",
  marginTop: "4px",
  color: "#cbd5e1",
  fontSize: "12px",
};

const secao = {
  marginTop: "16px",
  paddingTop: "16px",
  borderTop:
    "1px solid #1e293b",
};

const tituloSecao = {
  marginTop: 0,
  marginBottom: "12px",
  color: "#e2e8f0",
};

const chips = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
};

const chip = {
  padding: "6px 10px",
  borderRadius: "999px",
  background: "#172554",
  border:
    "1px solid #1d4ed8",
  color: "#bfdbfe",
  fontSize: "13px",
};

const maisItens = {
  marginTop: "10px",
  color: "#94a3b8",
  fontSize: "13px",
};

const listaInsights = {
  display: "grid",
  gap: "8px",
};

const insight = {
  display: "flex",
  gap: "9px",
  color: "#bbf7d0",
  lineHeight: "1.5",
};

const motivo = {
  display: "flex",
  gap: "9px",
  color: "#cbd5e1",
  lineHeight: "1.5",
};