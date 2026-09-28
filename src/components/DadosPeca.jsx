import DadosPrincipaisAnuncio from "./DadosPrincipaisAnuncio";
import PainelProcessamentoAnuncio from "./PainelProcessamentoAnuncio";

export default function DadosPeca({
  codigo,
  setCodigo,
  oem,
  setOem,
  titulo,
  setTitulo,
  descricao,
  setDescricao,
  preco,
  setPreco,
  tipoAnuncio,
  setTipoAnuncio,
  pecaEncontrada,
  buscarEMontarAnuncio,
  processando,
  etapaProcessamento,
  progressoProcessamento,
  avisoNaoEncontrado = "",
}) {
  return (
    <section style={secaoStyle}>
      <button
        type="button"
        onClick={buscarEMontarAnuncio}
        disabled={processando}
        style={{
          ...botaoPreencher,
          background: processando
            ? "#475569"
            : "linear-gradient(135deg,#2563eb,#22d3ee)",
          cursor: processando
            ? "not-allowed"
            : "pointer",
        }}
      >
        {processando
  ? "🔄 Analisando peça..."
  : "🔍 Buscar e Montar Anúncio"}
      </button>

      <PainelProcessamentoAnuncio
        processando={processando}
        etapa={etapaProcessamento}
        progresso={progressoProcessamento}
      />

      {avisoNaoEncontrado && !processando && (
        <div
          role="alert"
          data-testid="aviso-codigo-nao-encontrado"
          style={avisoStyle}
        >
          ⚠️ {avisoNaoEncontrado}
        </div>
      )}

      <DadosPrincipaisAnuncio
        codigo={codigo}
        setCodigo={setCodigo}
        oem={oem}
        setOem={setOem}
        titulo={titulo}
        setTitulo={setTitulo}
        descricao={descricao}
        setDescricao={setDescricao}
        preco={preco}
        setPreco={setPreco}
        tipoAnuncio={tipoAnuncio}
        setTipoAnuncio={setTipoAnuncio}
        pecaEncontrada={pecaEncontrada}
        buscarEMontarAnuncio={buscarEMontarAnuncio}
        processando={processando}
      />
    </section>
  );
}

const avisoStyle = {
  marginBottom: "14px",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #f59e0b",
  background: "rgba(245,158,11,.12)",
  color: "#fde68a",
  fontSize: "14px",
  lineHeight: 1.5,
};

const secaoStyle = {
  marginTop: "8px",
  padding: "18px",
  borderRadius: "16px",
  background: "#020617",
  border: "1px solid #1e293b",
};

const botaoPreencher = {
  width: "100%",
  padding: "13px",

  marginBottom: "14px",

  border: "none",
  borderRadius: "12px",

  color: "#fff",

  fontSize: "16px",
  fontWeight: "700",

  background:
    "linear-gradient(135deg,#2563eb,#22d3ee)",

  boxShadow:
    "0 6px 18px rgba(37,99,235,.25)",

  cursor: "pointer",

  transition: "all .2s ease",
};