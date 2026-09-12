export default function PainelResumoCatalogo({
  analise,
}) {
  if (!analise) {
    return null;
  }

  const {
    principal = {},
    totalResultados = 0,
    fabricantes = [],
    montadoras = [],
    modelos = [],
    catalogos = [],
    equivalentes = [],
    confianca: confiancaInicial = 0,
    termoNormalizado = "",
    resultados = [],
  } = analise;

  const normalizar = (valor) =>
    String(valor || "")
      .trim()
      .toLowerCase();

  const termoBusca =
    normalizar(termoNormalizado);

  const codigoOem =
    normalizar(
      principal.codigo_oem ||
        principal.codigo ||
        principal.oem
    );

  const codigoEquivalente =
    normalizar(
      principal.codigo_equivalente ||
        principal.equivalente
    );

  const peca =
    normalizar(
      principal.peca ||
        principal.descricao
    );

  const modelo =
    normalizar(principal.modelo);

  let confianca =
    Number(confiancaInicial) || 0;

  if (
    termoBusca &&
    codigoOem === termoBusca
  ) {
    confianca = 99;
  } else if (
    termoBusca &&
    codigoEquivalente === termoBusca
  ) {
    confianca = 97;
  } else if (
    termoBusca &&
    peca === termoBusca
  ) {
    confianca = 94;
  } else if (
    termoBusca &&
    modelo === termoBusca
  ) {
    confianca = 90;
  } else if (
    Array.isArray(resultados) &&
    resultados.length >= 10
  ) {
    confianca = 85;
  }

  const nomePeca =
    principal.peca ||
    principal.descricao ||
    "Peça automotiva";

  const codigoPrincipal =
    principal.codigo_oem ||
    principal.codigo ||
    principal.oem ||
    principal.codigo_equivalente ||
    "Código não informado";

  return (
    <div style={painel}>
      <div style={cabecalho}>
        <div>
          <h2 style={titulo}>
            🧠 Resumo Técnico PAIIA AI
          </h2>

          <p style={subtitulo}>
            Análise automática dos registros
            encontrados na base técnica.
          </p>
        </div>

        <div style={confiancaBox}>
          <span style={confiancaNumero}>
            {confianca}%
          </span>

          <span style={confiancaTexto}>
            Confiança
          </span>
        </div>
      </div>

      <div style={melhorCorrespondencia}>
        <div style={iconeTrofeu}>
          🏆
        </div>

        <div>
          <span style={rotulo}>
            Melhor correspondência
          </span>

          <h3 style={nomePecaStyle}>
            {nomePeca}
          </h3>

          <strong style={codigoStyle}>
            {codigoPrincipal}
          </strong>

          <div style={detalhePrincipal}>
            {[
              principal.fabricante,
              principal.montadora,
              principal.modelo,
              principal.motor,
            ]
              .filter(Boolean)
              .join(" • ")}
          </div>
        </div>
      </div>

      <div style={gridNumeros}>
        <CardNumero
          titulo="Resultados"
          valor={totalResultados}
        />

        <CardNumero
          titulo="Fabricantes"
          valor={fabricantes.length}
        />

        <CardNumero
          titulo="Montadoras"
          valor={montadoras.length}
        />

        <CardNumero
          titulo="Catálogos"
          valor={catalogos.length}
        />
      </div>

      <div style={gridDetalhes}>
        <ListaResumo
          titulo="🏭 Fabricantes encontrados"
          itens={fabricantes}
        />

        <ListaResumo
          titulo="🚗 Modelos encontrados"
          itens={modelos}
        />

        <ListaResumo
          titulo="🔄 Códigos equivalentes"
          itens={equivalentes}
        />

        <ListaResumo
          titulo="📚 Catálogos consultados"
          itens={catalogos}
        />
      </div>
    </div>
  );
}

function CardNumero({
  titulo,
  valor,
}) {
  return (
    <div style={cardNumero}>
      <div style={numero}>
        {valor}
      </div>

      <div style={texto}>
        {titulo}
      </div>
    </div>
  );
}

function ListaResumo({
  titulo,
  itens = [],
}) {
  const listaSegura =
    Array.isArray(itens)
      ? itens
      : [];

  const itensVisiveis =
    listaSegura.slice(0, 8);

  return (
    <div style={cardLista}>
      <h3 style={tituloLista}>
        {titulo}
      </h3>

      {itensVisiveis.length > 0 ? (
        <div style={chips}>
          {itensVisiveis.map(
            (item, index) => (
              <span
                key={`${item}-${index}`}
                style={chip}
              >
                {item}
              </span>
            )
          )}
        </div>
      ) : (
        <p style={semDados}>
          Nenhuma informação disponível.
        </p>
      )}

      {listaSegura.length > 8 && (
        <div style={maisItens}>
          + {listaSegura.length - 8} outros
        </div>
      )}
    </div>
  );
}

const painel = {
  background: "#020617",
  border: "1px solid #2563eb",
  borderRadius: "18px",
  padding: "22px",
  marginTop: "25px",
};

const cabecalho = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "20px",
  flexWrap: "wrap",
  marginBottom: "20px",
};

const titulo = {
  color: "#67e8f9",
  margin: 0,
};

const subtitulo = {
  color: "#94a3b8",
  marginTop: "7px",
  marginBottom: 0,
};

const confiancaBox = {
  minWidth: "110px",
  padding: "12px 18px",
  background: "#052e16",
  border: "1px solid #16a34a",
  borderRadius: "14px",
  textAlign: "center",
};

const confiancaNumero = {
  display: "block",
  color: "#4ade80",
  fontSize: "28px",
  fontWeight: "bold",
};

const confiancaTexto = {
  color: "#bbf7d0",
  fontSize: "13px",
};

const melhorCorrespondencia = {
  display: "flex",
  alignItems: "flex-start",
  gap: "16px",
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: "16px",
  padding: "18px",
  marginBottom: "18px",
};

const iconeTrofeu = {
  fontSize: "34px",
};

const rotulo = {
  display: "block",
  color: "#94a3b8",
  fontSize: "13px",
  marginBottom: "5px",
};

const nomePecaStyle = {
  color: "#ffffff",
  margin: 0,
  fontSize: "21px",
};

const codigoStyle = {
  display: "block",
  color: "#67e8f9",
  marginTop: "7px",
  fontSize: "18px",
};

const detalhePrincipal = {
  color: "#cbd5e1",
  marginTop: "8px",
  lineHeight: "1.5",
};

const gridNumeros = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "14px",
  marginBottom: "18px",
};

const cardNumero = {
  background: "#0f172a",
  borderRadius: "14px",
  padding: "16px",
  textAlign: "center",
};

const numero = {
  color: "#67e8f9",
  fontSize: "32px",
  fontWeight: "bold",
};

const texto = {
  color: "#cbd5e1",
  marginTop: "7px",
};

const gridDetalhes = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "14px",
};

const cardLista = {
  background: "#0f172a",
  borderRadius: "14px",
  padding: "16px",
};

const tituloLista = {
  color: "#e2e8f0",
  marginTop: 0,
  marginBottom: "12px",
  fontSize: "16px",
};

const chips = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
};

const chip = {
  background: "#172554",
  color: "#bfdbfe",
  border: "1px solid #1d4ed8",
  borderRadius: "999px",
  padding: "6px 10px",
  fontSize: "13px",
};

const semDados = {
  color: "#64748b",
  margin: 0,
};

const maisItens = {
  color: "#94a3b8",
  marginTop: "10px",
  fontSize: "13px",
};