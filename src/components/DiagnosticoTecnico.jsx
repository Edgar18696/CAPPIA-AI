export default function DiagnosticoTecnico({
  resultados = [],
  diagnostico = null,
}) {
  if (
    !Array.isArray(resultados) ||
    resultados.length === 0
  ) {
    return null;
  }

  const principal =
    resultados[0] || {};

  const fabricantes =
    diagnostico?.fabricante
      ? [diagnostico.fabricante]
      : [
          ...new Set(
            resultados
              .map((item) => item.fabricante)
              .filter(Boolean)
          ),
        ];

  const montadoras =
    diagnostico?.montadoras || [
      ...new Set(
        resultados
          .map((item) => item.montadora)
          .filter(Boolean)
      ),
    ];

  const modelos =
    diagnostico?.modelos || [
      ...new Set(
        resultados
          .map((item) => item.modelo)
          .filter(Boolean)
      ),
    ];

  const motores =
    diagnostico?.motores || [
      ...new Set(
        resultados
          .map((item) => item.motor)
          .filter(Boolean)
      ),
    ];

  const equivalencias =
    diagnostico?.equivalencias || [
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
    ];

  const totalAplicacoes =
    diagnostico?.totalAplicacoes ||
    resultados.length;

  const confiabilidade =
    Number(principal.confiabilidade) ||
    100;

  const distribuicao = {};

  resultados.forEach((item) => {
    const nome =
      item.montadora || "Não informado";

    distribuicao[nome] =
      (distribuicao[nome] || 0) + 1;
  });

  const rankingMontadoras =
    Object.entries(distribuicao)
      .sort((a, b) => b[1] - a[1]);
  function obterStatusTecnico() {
    if (confiabilidade >= 95) {
      return {
        texto: "MUITO ALTA",
        icone: "🟢",
        cor: "#22c55e",
        borda: "#16a34a",
      };
    }

    if (confiabilidade >= 80) {
      return {
        texto: "ATENÇÃO",
        icone: "🟡",
        cor: "#facc15",
        borda: "#ca8a04",
      };
    }

    return {
      texto: "REVISAR",
      icone: "🔴",
      cor: "#f87171",
      borda: "#dc2626",
    };
  }

  const statusTecnicoAtual =
    obterStatusTecnico();

  return (
    <div style={painel}>
      <h2 style={titulo}>
        🧠 Diagnóstico PAIIA AI
      </h2>

      <div style={mensagem}>
        <div style={cabecalhoDiagnostico}>
          <div style={resumoContainer}>
            <strong style={codigoLocalizado}>
              Código localizado com sucesso
            </strong>

            <p style={resumo}>
              O PAIIA AI identificou{" "}
              <b>{totalAplicacoes}</b>
              <b>{resultados.length}</b>{" "}
              aplicação(ões), distribuída(s) em{" "}
              <b>{montadoras.length}</b>{" "}
              montadora(s),{" "}
              <b>{modelos.length}</b>{" "}
              modelo(s) e{" "}
              <b>{motores.length}</b>{" "}
              motorização(ões).

              {equivalencias.length > 0 && (
                <>
                  {" "}
                  Também foram encontrados{" "}
                  <b>{equivalencias.length}</b>{" "}
                  código(s) equivalente(s).
                </>
              )}
            </p>
          </div>

          <div
            style={{
              ...statusTecnico,
              border: `1px solid ${statusTecnicoAtual.borda}`,
            }}
          >
            <div style={statusTitulo}>
              Compatibilidade
            </div>

            <div
              style={{
                ...statusValor,
                color: statusTecnicoAtual.cor,
              }}
            >
              {statusTecnicoAtual.icone}{" "}
              {statusTecnicoAtual.texto}
            </div>

            <div style={barra}>
              <div
                style={{
                  ...barraInterna,
                  width: `${Math.min(
                    confiabilidade,
                    100
                  )}%`,
                  background:
                    statusTecnicoAtual.cor,
                }}
              />
            </div>

            <div style={porcentagem}>
              {confiabilidade}%
            </div>
          </div>
        </div>
      </div>

      <div style={grid}>
        <Item
          titulo="Fabricante"
          valor={
            fabricantes.join(", ") ||
            "Não informado"
          }
        />

        <Item
          titulo="Catálogo"
          valor={
            principal.origem_catalogo ||
            "Base PAIIA"
          }
        />

        <Item
          titulo="Aplicações"
         valor={totalAplicacoes}
        />

        <Item
          titulo="Montadoras"
          valor={montadoras.length}
        />

        <Item
          titulo="Modelos"
          valor={modelos.length}
        />

        <Item
          titulo="Motores"
          valor={motores.length}
        />

        <Item
          titulo="Equivalências"
          valor={equivalencias.length}
        />

        <Item
          titulo="Confiabilidade"
          valor={`★★★★★ ${confiabilidade}%`}
        />
      </div>

      <div style={painelDistribuicao}>
        <h3 style={tituloDistribuicao}>
          🚗 Distribuição das aplicações
        </h3>

        {rankingMontadoras.map(
          ([montadora, quantidade], index) => {
            const percentual =
              resultados.length > 0
                ? Math.round(
                    (quantidade / totalAplicacoes) * 100
                  )
                : 0;

            return (
              <div
                key={montadora}
                style={{
                  ...linhaDistribuicao,
                  borderBottom:
                    index ===
                    rankingMontadoras.length - 1
                      ? "none"
                      : "1px solid #1e293b",
                }}
              >
                <div style={montadoraDados}>
                  <strong style={montadoraNome}>
                    {montadora}
                  </strong>

                  <div style={barraMontadora}>
                    <div
                      style={{
                        ...barraMontadoraInterna,
                        width: `${percentual}%`,
                      }}
                    />
                  </div>
                </div>

                <div style={quantidadeMontadora}>
                  <strong>
                    {quantidade}
                  </strong>

                  <span style={textoAplicacao}>
                    aplicação
                    {quantidade > 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}

function Item({
  titulo,
  valor,
}) {
  return (
    <div style={card}>
      <div style={tituloItem}>
        {titulo}
      </div>

      <div style={valorItem}>
        {valor}
      </div>
    </div>
  );
}

const painel = {
  marginTop: "25px",
  marginBottom: "25px",
  padding: "22px",
  borderRadius: "18px",
  background: "#02111d",
  border: "1px solid #2563eb",
};

const titulo = {
  color: "#67e8f9",
  marginTop: 0,
};

const mensagem = {
  color: "#ffffff",
  marginBottom: "20px",
  fontSize: "16px",
};

const cabecalhoDiagnostico = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "30px",
  flexWrap: "wrap",
};

const resumoContainer = {
  flex: 1,
  minWidth: "280px",
};

const codigoLocalizado = {
  fontSize: "22px",
};

const resumo = {
  marginTop: "12px",
  marginBottom: 0,
  color: "#cbd5e1",
  lineHeight: "1.7",
};

const statusTecnico = {
  minWidth: "230px",
  background: "#0f172a",
  borderRadius: "14px",
  padding: "18px",
};

const statusTitulo = {
  color: "#94a3b8",
  fontSize: "13px",
};

const statusValor = {
  fontWeight: "bold",
  fontSize: "22px",
  marginTop: "6px",
};

const barra = {
  marginTop: "15px",
  width: "100%",
  height: "12px",
  background: "#1e293b",
  borderRadius: "999px",
  overflow: "hidden",
};

const barraInterna = {
  height: "100%",
  borderRadius: "999px",
  transition: "width 0.3s ease",
};

const porcentagem = {
  marginTop: "10px",
  color: "#ffffff",
  fontWeight: "bold",
  textAlign: "right",
  fontSize: "18px",
};

const grid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(170px, 1fr))",
  gap: "15px",
};

const card = {
  background: "#0f172a",
  borderRadius: "12px",
  padding: "15px",
};

const tituloItem = {
  color: "#94a3b8",
  fontSize: "13px",
};

const valorItem = {
  color: "#ffffff",
  fontWeight: "bold",
  marginTop: "8px",
  fontSize: "18px",
  overflowWrap: "anywhere",
};

const painelDistribuicao = {
  marginTop: "28px",
  background: "#0f172a",
  borderRadius: "16px",
  padding: "22px",
};

const tituloDistribuicao = {
  color: "#67e8f9",
  marginTop: 0,
  marginBottom: "18px",
};

const linhaDistribuicao = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  padding: "14px 0",
  color: "#ffffff",
};

const montadoraDados = {
  flex: 1,
};

const montadoraNome = {
  display: "block",
  marginBottom: "8px",
};

const barraMontadora = {
  width: "100%",
  height: "8px",
  borderRadius: "999px",
  background: "#1e293b",
  overflow: "hidden",
};

const barraMontadoraInterna = {
  height: "100%",
  borderRadius: "999px",
  background: "#2563eb",
};

const quantidadeMontadora = {
  minWidth: "115px",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: "3px",
};

const textoAplicacao = {
  color: "#94a3b8",
  fontSize: "12px",
};