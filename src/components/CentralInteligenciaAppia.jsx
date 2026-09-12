import DiagnosticoTecnico from "./DiagnosticoTecnico";
import IndiceCompatibilidade from "./IndiceCompatibilidade";
import ParecerTecnico from "./ParecerTecnico";
import PainelTecnicoUniversal from "./PainelTecnicoUniversal";

import { montarDiagnosticoCatalogo } from "../services/montarDiagnosticoCatalogo";

export default function CentralInteligenciaAppia({
  resultados = [],
  codigoPesquisado = "",
  onCriarAnuncio,
  onAbrirCatalogo,
}) {
  if (
    !Array.isArray(resultados) ||
    resultados.length === 0
  ) {
    return null;
  }

  const diagnostico =
    montarDiagnosticoCatalogo(
      resultados
    );

  if (!diagnostico) {
    return null;
  }

  const codigo =
    diagnostico.codigo ||
    codigoPesquisado ||
    "Código não informado";

  const peca =
    diagnostico.peca ||
    "Peça automotiva";

  const fabricante =
    diagnostico.fabricante ||
    "Fabricante não informado";

  const origem =
    diagnostico.origem ||
    "Base PAIIA";

  return (
    <section style={container}>
      <div style={cabecalho}>
        <div>
          <span style={etiqueta}>
            🔬 CENTRAL DE INTELIGÊNCIA
          </span>

          <h1 style={titulo}>
            PAIIA AI
          </h1>

          <p style={subtitulo}>
            Diagnóstico, compatibilidade,
            parecer técnico e dados consolidados
            dos catálogos importados.
          </p>
        </div>

        <div style={resumoCodigo}>
          <span style={resumoTitulo}>
            Código pesquisado
          </span>

          <strong style={resumoValor}>
            {codigo}
          </strong>
        </div>
      </div>

      <div style={identificacao}>
        <div style={identificacaoItem}>
          <span style={identificacaoTitulo}>
            Peça
          </span>

          <strong style={identificacaoValor}>
            {peca}
          </strong>
        </div>

        <div style={identificacaoItem}>
          <span style={identificacaoTitulo}>
            Fabricante
          </span>

          <strong style={identificacaoValor}>
            {fabricante}
          </strong>
        </div>

        <div style={identificacaoItem}>
          <span style={identificacaoTitulo}>
            Origem
          </span>

          <strong style={identificacaoValor}>
            {origem}
          </strong>
        </div>

        <div style={identificacaoItem}>
          <span style={identificacaoTitulo}>
            Aplicações encontradas
          </span>

          <strong style={identificacaoValor}>
            {diagnostico.totalAplicacoes}
          </strong>
        </div>

        <div style={identificacaoItem}>
          <span style={identificacaoTitulo}>
            Montadoras
          </span>

          <strong style={identificacaoValor}>
            {diagnostico.montadoras.length}
          </strong>
        </div>

        <div style={identificacaoItem}>
          <span style={identificacaoTitulo}>
            Modelos
          </span>

          <strong style={identificacaoValor}>
            {diagnostico.modelos.length}
          </strong>
        </div>

        <div style={identificacaoItem}>
          <span style={identificacaoTitulo}>
            Motorizações
          </span>

          <strong style={identificacaoValor}>
            {diagnostico.motores.length}
          </strong>
        </div>

        <div style={identificacaoItem}>
          <span style={identificacaoTitulo}>
            Equivalências
          </span>

          <strong style={identificacaoValor}>
            {diagnostico.equivalencias.length}
          </strong>
        </div>
      </div>

      <div style={linhaEtapas}>
        <Etapa
          numero="1"
          texto="Diagnóstico"
        />

        <Etapa
          numero="2"
          texto="Compatibilidade"
        />

        <Etapa
          numero="3"
          texto="Parecer Técnico"
        />

        <Etapa
          numero="4"
          texto="Dados Técnicos"
        />
      </div>

      <DiagnosticoTecnico
        resultados={resultados}
        diagnostico={diagnostico}
      />

      <IndiceCompatibilidade
        resultados={resultados}
        diagnostico={diagnostico}
      />

      <ParecerTecnico
        resultados={resultados}
        diagnostico={diagnostico}
      />

      <PainelTecnicoUniversal
        resultados={resultados}
        diagnostico={diagnostico}
        onCriarAnuncio={onCriarAnuncio}
        onAbrirCatalogo={onAbrirCatalogo}
      />
    </section>
  );
}

function Etapa({
  numero,
  texto,
}) {
  return (
    <div style={etapa}>
      <span style={etapaNumero}>
        {numero}
      </span>

      <span style={etapaTexto}>
        {texto}
      </span>
    </div>
  );
}

const container = {
  marginTop: "28px",
  padding: "24px",
  borderRadius: "22px",
  background:
    "linear-gradient(180deg, #07111f 0%, #020617 100%)",
  border: "1px solid #2563eb",
  boxShadow:
    "0 20px 55px rgba(2, 6, 23, 0.45)",
};

const cabecalho = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "22px",
  flexWrap: "wrap",
  paddingBottom: "22px",
  borderBottom: "1px solid #1e293b",
};

const etiqueta = {
  display: "inline-block",
  padding: "7px 12px",
  borderRadius: "999px",
  background: "#172554",
  color: "#67e8f9",
  fontSize: "12px",
  fontWeight: "bold",
  letterSpacing: "0.5px",
};

const titulo = {
  marginTop: "12px",
  marginBottom: "6px",
  color: "#ffffff",
  fontSize: "34px",
};

const subtitulo = {
  maxWidth: "650px",
  margin: 0,
  color: "#94a3b8",
  lineHeight: "1.7",
};

const resumoCodigo = {
  minWidth: "240px",
  padding: "18px",
  borderRadius: "16px",
  background: "#0f172a",
  border: "1px solid #2563eb",
};

const resumoTitulo = {
  display: "block",
  marginBottom: "7px",
  color: "#94a3b8",
  fontSize: "13px",
};

const resumoValor = {
  color: "#67e8f9",
  fontSize: "24px",
  overflowWrap: "anywhere",
};

const identificacao = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "12px",
  marginTop: "20px",
};

const identificacaoItem = {
  padding: "15px",
  borderRadius: "13px",
  background: "#0f172a",
  border: "1px solid #1e293b",
};

const identificacaoTitulo = {
  display: "block",
  marginBottom: "6px",
  color: "#64748b",
  fontSize: "12px",
};

const identificacaoValor = {
  color: "#ffffff",
  lineHeight: "1.5",
  overflowWrap: "anywhere",
};

const linhaEtapas = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "10px",
  marginTop: "22px",
  marginBottom: "10px",
};

const etapa = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "12px",
  borderRadius: "12px",
  background: "#0f172a",
  border: "1px solid #1e3a8a",
};

const etapaNumero = {
  width: "30px",
  height: "30px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "50%",
  background: "#2563eb",
  color: "#ffffff",
  fontWeight: "bold",
};

const etapaTexto = {
  color: "#bfdbfe",
  fontWeight: "bold",
  fontSize: "14px",
};