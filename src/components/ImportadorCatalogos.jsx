import { useState } from "react";
import { motorImportacao } from "../services/importadores/motorImportacao";
import { executarExtracaoBruta } from "../services/importadores/pipeline/executarExtracaoBruta";

const FABRICANTES = [
  {
    valor: "bosch",
    nome: "Bosch",
  },
  {
    valor: "magneti_marelli",
    nome: "Magneti Marelli",
  },
  {
    valor: "renault",
    nome: "Renault / Motrio",
  },
  {
    valor: "ngk",
    nome: "NGK / NTK",
  },
];

export default function ImportadorCatalogos({
  cardStyle,
}) {
  const [
    fabricante,
    setFabricante,
  ] = useState("");

  const [
    arquivo,
    setArquivo,
  ] = useState(null);

  const [
    analisando,
    setAnalisando,
  ] = useState(false);

  const [
    importando,
    setImportando,
  ] = useState(false);

  const [
    progresso,
    setProgresso,
  ] = useState("");

  const [
    preview,
    setPreview,
  ] = useState(null);

  const [
    resultado,
    setResultado,
  ] = useState(null);

  const [
    extraindoBruto,
    setExtraindoBruto,
  ] = useState(false);

  const [
    resultadoBruto,
    setResultadoBruto,
  ] = useState(null);

  const [
    inspecionarBlocos,
    setInspecionarBlocos,
  ] = useState(false);

  const [
    buscaInspecao,
    setBuscaInspecao,
  ] = useState("");

  const obterCodigoDiagnostico = (
  tipoCatalogo = ""
) => {
  const tipo = String(
    tipoCatalogo || ""
  )
    .trim()
    .toLowerCase();

  const codigos = {
    sondas:
      "0258003300",

    gasolina_2023:
  "0280158448",

    gasolina_2025:
      "0280158276",

    bicos_gasolina:
      "0280155742",
  };

  return (
    codigos[tipo] ||
    "0258003300"
  );
};
  function normalizarCodigo(valor = "") {
    return String(valor || "")
      .replace(/\D/g, "")
      .trim();
  }

  const tipoCatalogoDiagnostico =
  String(
    preview?.tipoCatalogo ||
      preview?.tipo_catalogo ||
      preview?.configuracao?.tipoCatalogo ||
      ""
  )
    .trim()
    .toLowerCase();
const CODIGO_DIAGNOSTICO =
  fabricante ===
    "magneti_marelli" &&
  tipoCatalogoDiagnostico ===
    "sistemas_eletronicos"
    ? "IWP049"
    : tipoCatalogoDiagnostico ===
      "gasolina_2023"
    ? "0280158448"
    : tipoCatalogoDiagnostico ===
      "gasolina_2025"
    ? "0280158276"
    : tipoCatalogoDiagnostico ===
      "bicos_gasolina"
    ? "0280155742"
    : "0258003300";
    
const registrosDiagnostico =
  Array.isArray(preview?.registros)
    ? preview.registros.filter(
        (registro) => {
          const candidatos = [
  registro?.codigo_oem,
  registro?.codigo,
  registro?.codigoBosch,
  registro?.referencia,
  registro?.codigo_referencia,
  registro?.codigo_equivalente,
  registro?.equivalentes,
];

          return candidatos.some(
  (valor) => {
    if (
      Array.isArray(
        valor
      )
    ) {
      return valor.some(
        (item) =>
          normalizarCodigo(
            item
          ) ===
          normalizarCodigo(
            CODIGO_DIAGNOSTICO
          )
      );
    }

    return (
      normalizarCodigo(
        valor
      ) ===
      normalizarCodigo(
        CODIGO_DIAGNOSTICO
      )
    );
  }
);
        }
      )
    : [];

  function selecionarArquivo(
    event
  ) {
    const selecionado =
      event.target.files?.[0] ||
      null;

    setPreview(null);
    setResultado(null);
    setProgresso("");

    if (!selecionado) {
      setArquivo(null);
      return;
    }

    const ehPdf =
      selecionado.type ===
        "application/pdf" ||
      selecionado.name
        .toLowerCase()
        .endsWith(".pdf");

    if (!ehPdf) {
      alert(
        "Selecione um catálogo em formato PDF."
      );

      event.target.value = "";
      setArquivo(null);

      return;
    }

    setArquivo(selecionado);
  }

  async function analisarPdf() {
    if (!arquivo) {
      alert(
        "Selecione o catálogo PDF."
      );
      return;
    }

    if (!fabricante) {
      alert(
        "Selecione o fabricante do catálogo."
      );
      return;
    }

    setAnalisando(true);
    setPreview(null);
    setResultado(null);
    setResultadoBruto(null);
    setInspecionarBlocos(false);
    setBuscaInspecao("");

    try {
      const resposta =
        await motorImportacao({
          arquivo,
          fabricante,
          modoPreview: true,

          onProgresso:
            (mensagem) => {
              setProgresso(
                String(
                  mensagem || ""
                )
              );
            },
        });

      setPreview(resposta);

      setProgresso(
        `✅ Análise concluída. ${
          resposta?.total || 0
        } registro(s) encontrado(s).`
      );
    } catch (erro) {
      console.error(
        "Erro ao analisar catálogo:",
        erro
      );

      setProgresso(
        "❌ Não foi possível analisar o catálogo."
      );

      alert(
        "Erro ao analisar catálogo: " +
          (erro instanceof Error
            ? erro.message
            : "Erro desconhecido.")
      );
    } finally {
      setAnalisando(false);
    }
  }

  async function importarPdf() {
    if (!arquivo) {
      alert(
        "Selecione o catálogo PDF."
      );
      return;
    }

    if (!fabricante) {
      alert(
        "Selecione o fabricante."
      );
      return;
    }

    if (!preview) {
      alert(
        "Analise o catálogo antes de importar."
      );
      return;
    }

    const total =
      Number(
        preview?.total || 0
      );

    if (total <= 0) {
      alert(
        "Nenhum registro foi encontrado. A importação foi bloqueada."
      );
      return;
    }

    const confirmar =
      window.confirm(
        `Importar ${total} registro(s) para a Base Técnica PAIIA?\n\n` +
          "O catálogo será processado novamente e gravado na base."
      );

    if (!confirmar) {
      return;
    }

    setImportando(true);
    setResultado(null);

    try {
      const resposta =
        await motorImportacao({
          arquivo,
          fabricante,
          modoPreview: false,

          onProgresso:
            (mensagem) => {
              setProgresso(
                String(
                  mensagem || ""
                )
              );
            },
        });

      setResultado(resposta);

      setProgresso(
        `✅ Importação concluída. ${
          resposta?.total || 0
        } registro(s) processado(s).`
      );

      alert(
        `✅ Catálogo importado com sucesso.\n\n` +
          `Fabricante: ${
            resposta?.fabricante ||
            fabricante
          }\n` +
          `Registros: ${
            resposta?.total || 0
          }`
      );
    } catch (erro) {
      console.error(
        "Erro ao importar catálogo:",
        erro
      );

      setProgresso(
        "❌ Erro durante a importação."
      );

      alert(
        "Erro ao importar catálogo: " +
          (erro instanceof Error
            ? erro.message
            : "Erro desconhecido.")
      );
    } finally {
      setImportando(false);
    }
  }

  async function extrairBrutoPdf() {
    if (!arquivo) {
      alert("Selecione o catálogo PDF.");
      return;
    }

    if (!fabricante) {
      alert("Selecione o fabricante do catálogo.");
      return;
    }

    setExtraindoBruto(true);
    setResultadoBruto(null);
    setInspecionarBlocos(false);
    setBuscaInspecao("");
    setPreview(null);
    setResultado(null);

    try {
      const resposta = await executarExtracaoBruta({
        arquivo,
        fabricante,
        onProgresso: (mensagem) => {
          setProgresso(String(mensagem || ""));
        },
      });

      setResultadoBruto(resposta);
      setProgresso(
        `✅ Extração bruta gravada. ${resposta.totalPaginas} página(s), ${resposta.totalBlocos} bloco(s). Nada foi enviado para catalogo_pecas.`
      );
    } catch (erro) {
      console.error("Erro na extração bruta:", erro);
      setProgresso("❌ Não foi possível gravar a extração bruta.");
      alert(
        "Erro na extração bruta: " +
          (erro instanceof Error ? erro.message : "Erro desconhecido.")
      );
    } finally {
      setExtraindoBruto(false);
    }
  }

  const ocupado =
    analisando ||
    importando ||
    extraindoBruto;

  const blocosInspecao = resultadoBruto?.blocos || [];
  const termoInspecao = String(buscaInspecao || "")
    .trim()
    .toUpperCase();
  const blocosInspecaoFiltrados = termoInspecao
    ? blocosInspecao.filter((bloco) =>
        String(bloco.texto_original || "")
          .toUpperCase()
          .includes(termoInspecao)
      )
    : blocosInspecao;

  return (
    <div style={cardStyle}>
      <div
        style={{
          marginBottom: "24px",
        }}
      >
        <h2
          style={{
            color: "#67e8f9",
            marginTop: 0,
            marginBottom: "8px",
          }}
        >
          📚 Importador de Catálogos PDF
        </h2>

        <p
          style={{
            color: "#cbd5e1",
            margin: 0,
            lineHeight: "1.6",
          }}
        >
          Importe catálogos técnicos
          originais para a Base Técnica
          PAIIA.
        </p>
      </div>

      <div style={painelStyle}>
        <div style={etiquetaStyle}>
          1. FABRICANTE
        </div>

        <select
          value={fabricante}
          disabled={ocupado}
          onChange={(event) => {
            setFabricante(
              event.target.value
            );

            setPreview(null);
            setResultado(null);
            setResultadoBruto(null);
            setInspecionarBlocos(false);
            setBuscaInspecao("");
            setProgresso("");
          }}
          style={campoStyle}
        >
          <option value="">
            Selecione o fabricante
          </option>

          {FABRICANTES.map(
            (item) => (
              <option
                key={item.valor}
                value={item.valor}
              >
                {item.nome}
              </option>
            )
          )}
        </select>

        <div
          style={{
            ...etiquetaStyle,
            marginTop: "22px",
          }}
        >
          2. CATÁLOGO PDF
        </div>

        <input
          type="file"
          accept=".pdf,application/pdf"
          disabled={ocupado}
          onChange={
            selecionarArquivo
          }
          style={{
            ...campoStyle,
            padding: "11px",
          }}
        />

        {arquivo && (
          <div style={arquivoStyle}>
            <div>
              📄{" "}
              <strong>
                {arquivo.name}
              </strong>
            </div>

            <div
              style={{
                marginTop: "5px",
                color: "#94a3b8",
                fontSize: "13px",
              }}
            >
              {(
                arquivo.size /
                1024 /
                1024
              ).toFixed(2)}{" "}
              MB
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={analisarPdf}
          disabled={
            ocupado ||
            !arquivo ||
            !fabricante
          }
          style={{
            ...botaoPrincipal,
            opacity:
              ocupado ||
              !arquivo ||
              !fabricante
                ? 0.55
                : 1,
            cursor:
              ocupado ||
              !arquivo ||
              !fabricante
                ? "not-allowed"
                : "pointer",
          }}
        >
          {analisando
            ? "⏳ Analisando catálogo..."
            : "🔎 Analisar PDF"}
        </button>

        <button
          type="button"
          onClick={extrairBrutoPdf}
          disabled={
            ocupado ||
            !arquivo ||
            !fabricante
          }
          style={{
            ...botaoPrincipal,
            background: "#0f766e",
            opacity:
              ocupado ||
              !arquivo ||
              !fabricante
                ? 0.55
                : 1,
            cursor:
              ocupado ||
              !arquivo ||
              !fabricante
                ? "not-allowed"
                : "pointer",
          }}
        >
          {extraindoBruto
            ? "⏳ Gravando extração bruta..."
            : "💾 Extrair bruto (Fase 1)"}
        </button>
      </div>

      {progresso && (
        <div style={progressoStyle}>
          {progresso}
        </div>
      )}

      {resultadoBruto && (
        <div style={resultadoStyle}>
          <h3
            style={{
              color: "#67e8f9",
              marginTop: 0,
            }}
          >
            Extração bruta persistida
          </h3>

          <div style={gridStyle}>
            <div style={infoStyle}>
              <span style={rotuloStyle}>
                PDF
              </span>
              <strong>
                {resultadoBruto.arquivoNome}
              </strong>
            </div>

            <div style={infoStyle}>
              <span style={rotuloStyle}>
                Lote / importação
              </span>
              <strong>
                {resultadoBruto.loteId}
              </strong>
            </div>

            <div style={infoStyle}>
              <span style={rotuloStyle}>
                Páginas totais
              </span>
              <strong>
                {resultadoBruto.totalPaginas}
              </strong>
            </div>

            <div style={infoStyle}>
              <span style={rotuloStyle}>
                Páginas processadas
              </span>
              <strong>
                {resultadoBruto.paginasProcessadas}
              </strong>
            </div>

            <div style={infoStyle}>
              <span style={rotuloStyle}>
                Blocos extraídos
              </span>
              <strong>
                {resultadoBruto.totalBlocos}
              </strong>
            </div>

            <div style={infoStyle}>
              <span style={rotuloStyle}>
                Páginas com erro
              </span>
              <strong>
                {resultadoBruto.paginasComErro || 0}
              </strong>
            </div>

            <div style={infoStyle}>
              <span style={rotuloStyle}>
                Blocos pendentes
              </span>
              <strong>
                {resultadoBruto.blocosPendentes || 0}
              </strong>
            </div>

            <div style={infoStyle}>
              <span style={rotuloStyle}>
                Status da extração
              </span>
              <strong>
                {resultadoBruto.statusExtracao}
              </strong>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setInspecionarBlocos((aberto) => !aberto)
            }
            style={{
              ...botaoPrincipal,
              marginTop: "16px",
              background: "#155e75",
            }}
          >
            {inspecionarBlocos
              ? "Fechar inspeção"
              : "Inspecionar blocos"}
          </button>

          {inspecionarBlocos && (
            <div>
              <div
                style={{
                  marginTop: "16px",
                  marginBottom: "10px",
                }}
              >
                <span style={rotuloStyle}>
                  Buscar em texto_original
                </span>
                <input
                  type="search"
                  value={buscaInspecao}
                  onChange={(event) => {
                    setBuscaInspecao(event.target.value);
                  }}
                  placeholder="IWP049, IWP058, TB0032, FEI0019..."
                  style={campoStyle}
                />
                <div
                  style={{
                    marginTop: "8px",
                    color: "#94a3b8",
                    fontSize: "13px",
                  }}
                >
                  {`${blocosInspecaoFiltrados.length} de ${blocosInspecao.length} bloco(s)`}
                </div>
              </div>

              <div style={inspecaoListaStyle}>
              {blocosInspecao.length === 0 ? (
                <div>Nenhum bloco bruto para inspecionar.</div>
              ) : blocosInspecaoFiltrados.length === 0 ? (
                <div>
                  Nenhum bloco com “{buscaInspecao.trim()}” em texto_original.
                </div>
              ) : (
                blocosInspecaoFiltrados.map((bloco, indice) => (
                  <div
                    key={bloco.id || `${bloco.pagina}-${bloco.ordem_bloco}-${indice}`}
                    style={inspecaoItemStyle}
                  >
                    <div style={gridStyle}>
                      <div>
                        <span style={rotuloStyle}>Página</span>
                        <strong>{bloco.pagina}</strong>
                      </div>
                      <div>
                        <span style={rotuloStyle}>Ordem</span>
                        <strong>{bloco.ordem_bloco}</strong>
                      </div>
                      <div>
                        <span style={rotuloStyle}>Status</span>
                        <strong>{bloco.status}</strong>
                      </div>
                      <div>
                        <span style={rotuloStyle}>Hash</span>
                        <strong>{bloco.arquivoHash || resultadoBruto.arquivoHash}</strong>
                      </div>
                    </div>

                    <div style={{ marginTop: "12px" }}>
                      <span style={rotuloStyle}>texto_original</span>
                      <pre style={inspecaoPreStyle}>
                        {bloco.texto_original || "(vazio)"}
                      </pre>
                    </div>

                    <div style={{ marginTop: "12px" }}>
                      <span style={rotuloStyle}>linhas_originais</span>
                      <pre style={inspecaoPreStyle}>
                        {JSON.stringify(bloco.linhas_originais || [], null, 2)}
                      </pre>
                    </div>
                  </div>
                ))
              )}
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: "14px",
              color: "#86efac",
              fontSize: "14px",
            }}
          >
            catalogo_pecas: nenhum registro enviado.
          </div>
        </div>
      )}

      {preview && (
        <div style={resultadoStyle}>
          <h3
            style={{
              color: "#67e8f9",
              marginTop: 0,
            }}
          >
            ✅ Catálogo analisado
          </h3>

          <div style={gridStyle}>
            <div style={infoStyle}>
              <span style={rotuloStyle}>
                Fabricante
              </span>

              <strong>
                {preview.fabricante ||
                  fabricante}
              </strong>
            </div>

            <div style={infoStyle}>
              <span style={rotuloStyle}>
                Registros encontrados
              </span>

              <strong
                style={{
                  fontSize: "24px",
                  color: "#86efac",
                }}
              >
                {preview.total || 0}
              </strong>
            </div>

            <div style={infoStyle}>
              <span style={rotuloStyle}>
                Tipo de catálogo
              </span>

              <strong>
                {preview
                  ?.configuracao
                  ?.tipoCatalogo ||
                  "Detectado automaticamente"}
              </strong>
            </div>

            <div style={infoStyle}>
              <span style={rotuloStyle}>
                Arquivo
              </span>

              <strong>
                {arquivo?.name}
              </strong>
            </div>
          </div>

          <div style={diagnosticoStyle}>
            <div style={diagnosticoCabecalhoStyle}>
              <div>
                <div style={etiquetaDiagnosticoStyle}>
                  DIAGNÓSTICO BOSCH
                </div>

                <h3
                  style={{
                    color: "#ffffff",
                    margin: "5px 0 0",
                  }}
                >
                  Código {CODIGO_DIAGNOSTICO}
                </h3>
              </div>

              <div style={contadorDiagnosticoStyle}>
                {registrosDiagnostico.length} aplicação(ões)
              </div>
            </div>

            {registrosDiagnostico.length === 0 ? (
              <div style={alertaDiagnosticoStyle}>
                ⚠️ O código {CODIGO_DIAGNOSTICO} não apareceu
                no preview. Não importe o catálogo até
                verificarmos o parser.
              </div>
            ) : (
              <div style={tabelaDiagnosticoStyle}>
                {registrosDiagnostico.map((registro, indice) => (
                  <div
                    key={`${CODIGO_DIAGNOSTICO}-${indice}`}
                    style={linhaDiagnosticoStyle}
                  >
                    <div>
                      <span style={rotuloStyle}>
                        Montadora
                      </span>

                      <strong>
                        {registro?.montadora || "-"}
                      </strong>
                    </div>

                    <div>
                      <span style={rotuloStyle}>
                        Modelo
                      </span>

                      <strong>
                        {registro?.modelo || "-"}
                      </strong>
                    </div>

                    <div>
                      <span style={rotuloStyle}>
                        Motor
                      </span>

                      <strong>
                        {registro?.motor || "-"}
                      </strong>
                    </div>

                    <div>
                      <span style={rotuloStyle}>
                        Anos
                      </span>

                      <strong>
                        {registro?.ano_inicio ||
                          registro?.anoInicio ||
                          "-"}
                        {" → "}
                        {registro?.ano_fim ||
                          registro?.anoFim ||
                          "-"}
                      </strong>
                    </div>

                    <div>
                      <span style={rotuloStyle}>
                        Observação
                      </span>

                      <strong>
                        {registro?.observacao || "-"}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {Number(
            preview.total || 0
          ) > 0 && (
            <button
              type="button"
              onClick={importarPdf}
              disabled={importando}
              style={{
                ...botaoImportar,
                cursor: importando
                  ? "not-allowed"
                  : "pointer",
                opacity: importando
                  ? 0.6
                  : 1,
              }}
            >
              {importando
                ? "⏳ Importando para a base..."
                : "💾 Importar para Base PAIIA"}
            </button>
          )}

          {Number(
            preview.total || 0
          ) === 0 && (
            <div style={alertaStyle}>
              ⚠️ Nenhum registro
              técnico foi identificado.
              A gravação foi bloqueada
              para proteger a Base
              PAIIA.
            </div>
          )}
        </div>
      )}

      {resultado && (
        <div style={sucessoStyle}>
          <strong>
            ✅ Importação finalizada
          </strong>

          <div
            style={{
              marginTop: "7px",
            }}
          >
            {resultado.total || 0}{" "}
            registro(s) processado(s)
            pelo importador técnico.
          </div>
        </div>
      )}

      <div style={rodapeStyle}>
        <strong>
          🛡️ Importação técnica
        </strong>

        <div
          style={{
            marginTop: "6px",
          }}
        >
          O PDF é analisado pelo motor
          de importação e pelo parser
          específico do fabricante antes
          da gravação na base.
        </div>
      </div>
    </div>
  );
}

const painelStyle = {
  padding: "22px",
  borderRadius: "16px",
  background: "#020617",
  border: "1px solid #2563eb",
};

const etiquetaStyle = {
  color: "#94a3b8",
  fontSize: "12px",
  fontWeight: "bold",
  letterSpacing: "0.08em",
  marginBottom: "8px",
};

const campoStyle = {
  width: "100%",
  padding: "13px",
  borderRadius: "10px",
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#ffffff",
  fontSize: "15px",
  boxSizing: "border-box",
};

const arquivoStyle = {
  marginTop: "14px",
  padding: "14px",
  borderRadius: "10px",
  background:
    "rgba(34,211,238,.07)",
  border:
    "1px solid rgba(103,232,249,.25)",
  color: "#cffafe",
};

const botaoPrincipal = {
  width: "100%",
  marginTop: "20px",
  padding: "14px 20px",
  borderRadius: "11px",
  border: "none",
  background:
    "linear-gradient(135deg,#2563eb,#0891b2)",
  color: "#ffffff",
  fontWeight: "bold",
  fontSize: "15px",
};

const progressoStyle = {
  marginTop: "18px",
  padding: "15px",
  borderRadius: "12px",
  background: "#0f172a",
  border: "1px solid #334155",
  color: "#cbd5e1",
  lineHeight: "1.5",
};

const resultadoStyle = {
  marginTop: "18px",
  padding: "20px",
  borderRadius: "16px",
  background: "#020617",
  border: "1px solid #22d3ee",
};

const inspecaoListaStyle = {
  marginTop: "16px",
  maxHeight: "520px",
  overflow: "auto",
  display: "grid",
  gap: "12px",
};

const inspecaoItemStyle = {
  padding: "14px",
  borderRadius: "12px",
  background: "#0f172a",
  border: "1px solid #334155",
  color: "#e2e8f0",
};

const inspecaoPreStyle = {
  margin: 0,
  padding: "12px",
  borderRadius: "8px",
  background: "#020617",
  border: "1px solid #1e293b",
  color: "#cbd5e1",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  fontSize: "12px",
  maxHeight: "220px",
  overflow: "auto",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(190px,1fr))",
  gap: "12px",
};

const infoStyle = {
  padding: "14px",
  borderRadius: "10px",
  background: "#0f172a",
  border: "1px solid #1e293b",
  color: "#e2e8f0",
  overflowWrap: "anywhere",
};

const rotuloStyle = {
  display: "block",
  color: "#94a3b8",
  fontSize: "12px",
  marginBottom: "6px",
};

const diagnosticoStyle = {
  marginTop: "18px",
  padding: "18px",
  borderRadius: "14px",
  background: "#08111f",
  border: "1px solid #334155",
};

const diagnosticoCabecalhoStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "14px",
};

const etiquetaDiagnosticoStyle = {
  color: "#67e8f9",
  fontSize: "11px",
  fontWeight: "bold",
  letterSpacing: "0.08em",
};

const contadorDiagnosticoStyle = {
  padding: "8px 12px",
  borderRadius: "999px",
  background: "rgba(34,197,94,.12)",
  border: "1px solid rgba(34,197,94,.35)",
  color: "#86efac",
  fontWeight: "bold",
};

const alertaDiagnosticoStyle = {
  padding: "14px",
  borderRadius: "10px",
  background: "rgba(245,158,11,.08)",
  border: "1px solid rgba(245,158,11,.35)",
  color: "#fde68a",
  lineHeight: "1.5",
};

const tabelaDiagnosticoStyle = {
  display: "grid",
  gap: "10px",
};

const linhaDiagnosticoStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(150px,1fr))",
  gap: "10px",
  padding: "12px",
  borderRadius: "10px",
  background: "#0f172a",
  border: "1px solid #1e293b",
  color: "#e2e8f0",
};

const botaoImportar = {
  width: "100%",
  marginTop: "18px",
  padding: "15px 20px",
  borderRadius: "11px",
  border: "none",
  background:
    "linear-gradient(135deg,#059669,#22c55e)",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "bold",
};

const alertaStyle = {
  marginTop: "16px",
  padding: "14px",
  borderRadius: "10px",
  background:
    "rgba(245,158,11,.08)",
  border:
    "1px solid rgba(245,158,11,.35)",
  color: "#fde68a",
  lineHeight: "1.5",
};

const sucessoStyle = {
  marginTop: "18px",
  padding: "16px",
  borderRadius: "12px",
  background:
    "rgba(34,197,94,.08)",
  border:
    "1px solid rgba(34,197,94,.35)",
  color: "#bbf7d0",
};

const rodapeStyle = {
  marginTop: "20px",
  padding: "15px",
  borderRadius: "12px",
  background:
    "rgba(37,99,235,.06)",
  border:
    "1px solid rgba(37,99,235,.2)",
  color: "#94a3b8",
  fontSize: "13px",
  lineHeight: "1.5",
};