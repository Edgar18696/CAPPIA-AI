function valoresUnicos(resultados, campo) {
  return [
    ...new Set(
      resultados
        .map((item) => item?.[campo])
        .filter(Boolean)
    ),
  ];
}

function contarEquivalencias(resultados) {
  return [
    ...new Set(
      resultados
        .flatMap((item) =>
          String(
            item.codigo_equivalente || ""
          ).split(/[,;|/]+/)
        )
        .map((codigo) => codigo.trim())
        .filter(Boolean)
    ),
  ].length;
}

function limitar(valor, minimo, maximo) {
  return Math.min(
    Math.max(valor, minimo),
    maximo
  );
}

function calcularIndice(
  resultados,
  diagnostico = null
) {
  const principal =
    resultados[0] || {};

  const aplicacoes =
    diagnostico?.totalAplicacoes ||
    resultados.length;

  const equivalencias =
    diagnostico?.equivalencias?.length ??
    contarEquivalencias(resultados);

  const montadoras =
    diagnostico?.montadoras?.length ??
    valoresUnicos(
      resultados,
      "montadora"
    ).length;

  const modelos =
    diagnostico?.modelos?.length ??
    valoresUnicos(
      resultados,
      "modelo"
    ).length;

  const confiabilidade = limitar(
    Number(
      principal.confiabilidade
    ) || 100,
    0,
    100
  );

  const pontosAplicacoes = limitar(
    Math.round(
      (aplicacoes / 40) * 40
    ),
    0,
    40
  );

  const pontosEquivalencias = limitar(
    Math.round(
      (equivalencias / 20) * 20
    ),
    0,
    20
  );

  const pontosConfiabilidade =
    Math.round(
      confiabilidade * 0.2
    );

  const cobertura =
    montadoras + modelos;

  const pontosCobertura = limitar(
    Math.round(
      (cobertura / 20) * 20
    ),
    0,
    20
  );

  const indice = limitar(
    pontosAplicacoes +
      pontosEquivalencias +
      pontosConfiabilidade +
      pontosCobertura,
    0,
    100
  );

  return {
    indice,
    aplicacoes,
    equivalencias,
    montadoras,
    modelos,
    confiabilidade,
    pontosAplicacoes,
    pontosEquivalencias,
    pontosConfiabilidade,
    pontosCobertura,
  };
}

function obterStatus(indice) {
  if (indice >= 95) {
    return {
      icone: "⭐",
      titulo:
        "Excelente para anúncio",
      descricao:
        "A base apresenta ampla cobertura técnica para criação automática do anúncio.",
      cor: "#4ade80",
      borda: "#16a34a",
      fundo: "#052e16",
    };
  }

  if (indice >= 80) {
    return {
      icone: "🟢",
      titulo:
        "Alta compatibilidade",
      descricao:
        "Os dados apresentam boa cobertura, mas a aplicação deve ser confirmada antes da venda.",
      cor: "#22c55e",
      borda: "#16a34a",
      fundo: "#052e16",
    };
  }

  if (indice >= 60) {
    return {
      icone: "🟡",
      titulo:
        "Boa compatibilidade",
      descricao:
        "Existem dados suficientes, porém é importante revisar código, ano, motor e conector.",
      cor: "#facc15",
      borda: "#ca8a04",
      fundo: "#422006",
    };
  }

  return {
    icone: "🔴",
    titulo:
      "Revisar antes de anunciar",
    descricao:
      "A cobertura técnica é limitada. Confirme manualmente a aplicação antes de publicar.",
    cor: "#f87171",
    borda: "#dc2626",
    fundo: "#450a0a",
  };
}

export default function IndiceCompatibilidade({
  resultados = [],
  diagnostico = null,
}) {
  if (
    !Array.isArray(resultados) ||
    resultados.length === 0
  ) {
    return null;
  }

  const dados =
  calcularIndice(
    resultados,
    diagnostico
  );

  const status =
    obterStatus(dados.indice);

  return (
    <section
      style={{
        ...painel,
        border: `1px solid ${status.borda}`,
      }}
    >
      <div style={cabecalho}>
        <div>
          <span style={etiqueta}>
            🛡 ÍNDICE PAIIA
          </span>

          <h2 style={titulo}>
            Índice de Compatibilidade
          </h2>

          <p style={subtitulo}>
            Pontuação calculada com base
            na cobertura técnica encontrada
            nos catálogos importados.
          </p>
        </div>

        <div
          style={{
            ...statusBox,
            background: status.fundo,
            border:
              `1px solid ${status.borda}`,
          }}
        >
          <div
            style={{
              ...indiceValor,
              color: status.cor,
            }}
          >
            {dados.indice}%
          </div>

          <div
            style={{
              ...statusTitulo,
              color: status.cor,
            }}
          >
            {status.icone}{" "}
            {status.titulo}
          </div>
        </div>
      </div>

      <div style={barra}>
        <div
          style={{
            ...barraInterna,
            width: `${dados.indice}%`,
            background: status.cor,
          }}
        />
      </div>

      <p style={descricao}>
        {status.descricao}
      </p>

      <div style={grid}>
        <Item
          titulo="Aplicações"
          valor={dados.aplicacoes}
          pontos={
            dados.pontosAplicacoes
          }
          maximo={40}
        />

        <Item
          titulo="Equivalências"
          valor={dados.equivalencias}
          pontos={
            dados.pontosEquivalencias
          }
          maximo={20}
        />

        <Item
          titulo="Confiabilidade"
          valor={`${dados.confiabilidade}%`}
          pontos={
            dados.pontosConfiabilidade
          }
          maximo={20}
        />

        <Item
          titulo="Cobertura"
          valor={`${dados.montadoras} montadora(s) / ${dados.modelos} modelo(s)`}
          pontos={
            dados.pontosCobertura
          }
          maximo={20}
        />
      </div>
    </section>
  );
}

function Item({
  titulo,
  valor,
  pontos,
  maximo,
}) {
  return (
    <div style={item}>
      <span style={itemTitulo}>
        {titulo}
      </span>

      <strong style={itemValor}>
        {valor}
      </strong>

      <span style={itemPontos}>
        {pontos} de {maximo} pontos
      </span>
    </div>
  );
}

const painel = {
  marginTop: "25px",
  padding: "22px",
  borderRadius: "18px",
  background: "#020617",
};

const cabecalho = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "20px",
  flexWrap: "wrap",
};

const etiqueta = {
  display: "inline-block",
  padding: "6px 11px",
  borderRadius: "999px",
  background: "#172554",
  color: "#67e8f9",
  fontSize: "12px",
  fontWeight: "bold",
};

const titulo = {
  marginTop: "12px",
  marginBottom: "6px",
  color: "#ffffff",
};

const subtitulo = {
  color: "#94a3b8",
  margin: 0,
  lineHeight: "1.6",
};

const statusBox = {
  minWidth: "220px",
  padding: "18px",
  borderRadius: "14px",
  textAlign: "center",
};

const indiceValor = {
  fontSize: "38px",
  fontWeight: "bold",
};

const statusTitulo = {
  marginTop: "6px",
  fontWeight: "bold",
};

const barra = {
  marginTop: "22px",
  height: "14px",
  width: "100%",
  borderRadius: "999px",
  background: "#1e293b",
  overflow: "hidden",
};

const barraInterna = {
  height: "100%",
  borderRadius: "999px",
  transition: "width 0.3s ease",
};

const descricao = {
  color: "#cbd5e1",
  lineHeight: "1.7",
  marginTop: "16px",
};

const grid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "12px",
  marginTop: "18px",
};

const item = {
  padding: "15px",
  borderRadius: "12px",
  background: "#0f172a",
  border: "1px solid #1e293b",
};

const itemTitulo = {
  display: "block",
  color: "#94a3b8",
  fontSize: "13px",
};

const itemValor = {
  display: "block",
  color: "#ffffff",
  marginTop: "7px",
  lineHeight: "1.4",
};

const itemPontos = {
  display: "block",
  color: "#67e8f9",
  fontSize: "12px",
  marginTop: "8px",
};