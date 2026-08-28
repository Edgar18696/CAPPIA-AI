import { useState } from "react";
import { supabase } from "../supabase";
import { interpretarCatalogo } from "../services/importadorIA";
export default function ImportadorCatalogos({ cardStyle }) {
  const [arquivoCatalogo, setArquivoCatalogo] = useState(null);
  const [importandoArquivo, setImportandoArquivo] = useState(false);
  const [peca, setPeca] = useState("");
  const [codigoOem, setCodigoOem] = useState("");
  const [codigoEquivalente, setCodigoEquivalente] = useState("");
  const [fabricante, setFabricante] = useState("");
  const [origemCatalogo, setOrigemCatalogo] = useState("");

  const [montadora, setMontadora] = useState("");
  const [modelo, setModelo] = useState("");
  const [motor, setMotor] = useState("");
  const [combustivel, setCombustivel] = useState("");
  const [anoInicio, setAnoInicio] = useState("");
  const [anoFim, setAnoFim] = useState("");
  const [observacao, setObservacao] = useState("");

  const [aplicacoesLote, setAplicacoesLote] = useState("");
  const [salvando, setSalvando] = useState(false);

  function limpar() {
    setPeca("");
    setCodigoOem("");
    setCodigoEquivalente("");
    setFabricante("");
    setOrigemCatalogo("");
    setMontadora("");
    setModelo("");
    setMotor("");
    setCombustivel("");
    setAnoInicio("");
    setAnoFim("");
    setObservacao("");
    setAplicacoesLote("");
  }

  function textoOuNull(valor) {
    const texto = String(valor || "").trim();
    return texto || null;
  }

  function numeroOuNull(valor) {
    const texto = String(valor || "").trim();

    if (!texto) return null;

    const numero = Number(texto);

    return Number.isFinite(numero) ? numero : null;
  }

  function montarAplicacoesDoLote(codigoPrincipal, equivalente) {
    return aplicacoesLote
      .split("\n")
      .map((linha) => linha.trim())
      .filter(Boolean)
      .map((linha) => {
        const [
          montadoraLinha,
          modeloLinha,
          motorLinha,
          anoInicioLinha,
          anoFimLinha,
          combustivelLinha,
          observacaoLinha,
        ] = linha.split(";").map((item) => item.trim());

        return {
          codigo_oem: codigoPrincipal || equivalente,
          codigo_equivalente: textoOuNull(equivalente),
          montadora: textoOuNull(montadoraLinha),
          modelo: textoOuNull(modeloLinha),
          motor: textoOuNull(motorLinha),
          combustivel: textoOuNull(combustivelLinha),
          ano_inicio: numeroOuNull(anoInicioLinha),
          ano_fim: numeroOuNull(anoFimLinha),
          observacao: textoOuNull(observacaoLinha),
          origem_catalogo: textoOuNull(origemCatalogo),
          ativo: true,
          prioridade: 1,
          confiabilidade: 100,
        };
      })
      .filter(
        (item) =>
          item.montadora ||
          item.modelo ||
          item.motor ||
          item.ano_inicio ||
          item.ano_fim
      );
  }
async function importarCsv() {
  if (!arquivoCatalogo) {
    alert("Selecione um arquivo.");
    return;
  }

  setImportandoArquivo(true);

  try {
    const ehPdf =
      arquivoCatalogo.type === "application/pdf" ||
      arquivoCatalogo.name.toLowerCase().endsWith(".pdf");

    if (!ehPdf) {
      alert("Nesta etapa, selecione apenas um arquivo PDF.");
      return;
    }

    const formData = new FormData();

    formData.append("arquivo", arquivoCatalogo);
    formData.append("paginaInicial", "1");

    const { data: resultado, error } =
      await supabase.functions.invoke(
        "importar-catalogo",
        {
          body: formData,
        }
      );

    if (error) {
      throw new Error(
        error.message ||
          "Erro ao extrair o texto do PDF."
      );
    }

    if (!resultado?.sucesso) {
      throw new Error(
        resultado?.mensagem ||
          "Não foi possível extrair o texto."
      );
    }

    const textoExtraido =
      resultado.textoExtraido || "";

    if (!textoExtraido.trim()) {
      throw new Error(
        "O PDF foi processado, mas nenhum texto foi encontrado."
      );
    }

    const nomeTxt = arquivoCatalogo.name.replace(
      /\.pdf$/i,
      ".txt"
    );

    const blob = new Blob(
      [textoExtraido],
      {
        type: "text/plain;charset=utf-8",
      }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = nomeTxt;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    alert(`
✅ Texto extraído com sucesso.

📄 PDF:
${arquivoCatalogo.name}

📥 Arquivo criado:
${nomeTxt}

📚 Páginas processadas:
${resultado.processamento?.paginaInicial} até ${resultado.processamento?.paginaFinal}
`);
  } catch (erro) {
    console.error(
      "Erro ao extrair PDF:",
      erro
    );

    alert(
      "Erro ao extrair o PDF: " +
        (erro instanceof Error
          ? erro.message
          : "Erro desconhecido.")
    );
  } finally {
    setImportandoArquivo(false);
  }
}
  async function salvarPeca() {
    const codigoPrincipal = String(codigoOem || "").trim();
    const equivalente = String(codigoEquivalente || "").trim();

    if (!peca.trim()) {
      alert("Informe o nome da peça.");
      return;
    }

    if (!codigoPrincipal && !equivalente) {
      alert("Informe o código OEM ou o código equivalente.");
      return;
    }

    setSalvando(true);

    try {
      const dadosPeca = {
        peca: peca.trim(),
        codigo_oem: codigoPrincipal,
        codigo_equivalente: equivalente,
        fabricante: textoOuNull(fabricante),
        origem_catalogo: textoOuNull(origemCatalogo),

        montadora: textoOuNull(montadora),
        modelo: textoOuNull(modelo),
        motor: textoOuNull(motor),
        ano_inicio: numeroOuNull(anoInicio),
        ano_fim: numeroOuNull(anoFim),
        observacao: textoOuNull(observacao),

        ativo: true,
        prioridade: 1,
        confiabilidade: 100,
      };

const { error: erroPeca } = await supabase
  .from("catalogo_mestre")
  .upsert(dadosPeca, {
    onConflict: "codigo_oem",
  });

      if (erroPeca) {
        throw new Error(
          "Erro ao salvar a peça: " + erroPeca.message
        );
      }

      const aplicacoes = [];

      const possuiAplicacaoManual =
        montadora.trim() ||
        modelo.trim() ||
        motor.trim() ||
        combustivel.trim() ||
        anoInicio ||
        anoFim;

      if (possuiAplicacaoManual) {
        aplicacoes.push({
          codigo_oem: codigoPrincipal || equivalente,
          codigo_equivalente: textoOuNull(equivalente),
          montadora: textoOuNull(montadora),
          modelo: textoOuNull(modelo),
          motor: textoOuNull(motor),
          combustivel: textoOuNull(combustivel),
          ano_inicio: numeroOuNull(anoInicio),
          ano_fim: numeroOuNull(anoFim),
          observacao: textoOuNull(observacao),
          origem_catalogo: textoOuNull(origemCatalogo),
          ativo: true,
          prioridade: 1,
          confiabilidade: 100,
        });
      }

      const aplicacoesImportadas = montarAplicacoesDoLote(
        codigoPrincipal,
        equivalente
      );

      aplicacoes.push(...aplicacoesImportadas);

      if (aplicacoes.length > 0) {
const { error: erroAplicacoes } = await supabase
  .from("catalogo_mestre")
  .upsert(aplicacoes, {
    onConflict:
      "codigo_oem,montadora,modelo,motor,ano_inicio,ano_fim",
    ignoreDuplicates: true,
  });

        if (erroAplicacoes) {
          throw new Error(
            "A peça foi salva, mas ocorreu um erro nas aplicações: " +
              erroAplicacoes.message
          );
        }
      }

      alert(
        aplicacoes.length > 0
          ? `✅ Peça salva com ${aplicacoes.length} aplicação(ões).`
          : "✅ Peça salva no catálogo."
      );

      limpar();
    } catch (erro) {
      console.error(erro);
      alert(erro.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={cardStyle}>
      <h2 style={{ color: "#67e8f9", marginTop: 0 }}>
        ➕ Cadastro Técnico de Peça
      </h2>

      <p style={{ color: "#cbd5e1" }}>
        Cadastre a peça e suas aplicações técnicas.
      </p>
<div
  style={{
    marginTop: "18px",
    marginBottom: "20px",
    padding: "16px",
    borderRadius: "14px",
    background: "#020617",
    border: "1px solid #2563eb",
  }}
>
  <h3
    style={{
      color: "#67e8f9",
      marginTop: 0,
      marginBottom: "10px",
    }}
  >
    📥 Importar catálogo CSV
  </h3>

  <input
    type="file"
accept=".csv,.pdf,text/csv,application/pdf"
    onChange={(e) =>
      setArquivoCatalogo(e.target.files?.[0] || null)
    }
    style={{
      width: "100%",
      color: "#e2e8f0",
    }}
  />

  {arquivoCatalogo && (
    <div
      style={{
        marginTop: "10px",
        color: "#86efac",
        fontSize: "14px",
      }}
    >
✅ Arquivo selecionado: {arquivoCatalogo.name}
<br />
<span style={{ color: "#94a3b8" }}>
  Tipo:{" "}
  {arquivoCatalogo.type === "application/pdf"
    ? "Catálogo PDF Bosch"
    : "Catálogo CSV"}
</span>
    </div>
  )}
  <button
  type="button"
  onClick={importarCsv}
  disabled={!arquivoCatalogo || importandoArquivo}
  style={{
    marginTop: "14px",
    padding: "12px 18px",
    borderRadius: "10px",
    border: "none",
    background:
      !arquivoCatalogo || importandoArquivo
        ? "#475569"
        : "linear-gradient(135deg,#2563eb,#22d3ee)",
    color: "#fff",
    fontWeight: "bold",
    cursor:
      !arquivoCatalogo || importandoArquivo
        ? "not-allowed"
        : "pointer",
  }}
>
{importandoArquivo
  ? "⏳ Processando arquivo..."
  : arquivoCatalogo?.type === "application/pdf"
  ? "📚 Preparar PDF Bosch"
  : "📂 Ler arquivo CSV"}
</button>
</div>
      <input
        value={peca}
        onChange={(e) => setPeca(e.target.value)}
        placeholder="Nome da peça"
        style={campoStyle}
      />

      <input
        type="text"
        value={codigoOem}
        onChange={(e) => setCodigoOem(e.target.value)}
        placeholder="Código OEM"
        style={campoStyle}
      />

      <input
        type="text"
        value={codigoEquivalente}
        onChange={(e) =>
          setCodigoEquivalente(e.target.value)
        }
        placeholder="Código equivalente"
        style={campoStyle}
      />

      <input
        value={fabricante}
        onChange={(e) => setFabricante(e.target.value)}
        placeholder="Fabricante da peça"
        style={campoStyle}
      />

      <input
        value={origemCatalogo}
        onChange={(e) => setOrigemCatalogo(e.target.value)}
        placeholder="Origem do catálogo: Bosch, Renault, Fiat..."
        style={campoStyle}
      />

      <h3 style={subtituloStyle}>
        🚗 Aplicação manual
      </h3>

      <input
        value={montadora}
        onChange={(e) => setMontadora(e.target.value)}
        placeholder="Montadora"
        style={campoStyle}
      />

      <input
        value={modelo}
        onChange={(e) => setModelo(e.target.value)}
        placeholder="Modelo do veículo"
        style={campoStyle}
      />

      <input
        value={motor}
        onChange={(e) => setMotor(e.target.value)}
        placeholder="Motor"
        style={campoStyle}
      />

      <input
        value={combustivel}
        onChange={(e) => setCombustivel(e.target.value)}
        placeholder="Combustível"
        style={campoStyle}
      />

      <div style={anosStyle}>
        <input
          type="number"
          value={anoInicio}
          onChange={(e) => setAnoInicio(e.target.value)}
          placeholder="Ano inicial"
          style={campoStyle}
        />

        <input
          type="number"
          value={anoFim}
          onChange={(e) => setAnoFim(e.target.value)}
          placeholder="Ano final"
          style={campoStyle}
        />
      </div>

      <textarea
        value={observacao}
        onChange={(e) => setObservacao(e.target.value)}
        placeholder="Observação técnica"
        rows={4}
        style={textareaStyle}
      />

      <h3 style={subtituloStyle}>
        📥 Importar várias aplicações
      </h3>

      <p style={ajudaStyle}>
        Uma aplicação por linha, separando os campos por ponto e
        vírgula:
      </p>

      <div style={exemploStyle}>
        Renault;Clio;1.6 16V;2000;2005;Flex;Conferir
        conector
      </div>

      <textarea
        value={aplicacoesLote}
        onChange={(e) => setAplicacoesLote(e.target.value)}
        placeholder={
          "Montadora;Modelo;Motor;Ano inicial;Ano final;Combustível;Observação"
        }
        rows={9}
        style={textareaStyle}
      />

      <div style={botoesStyle}>
        <button
          type="button"
          onClick={salvarPeca}
          disabled={salvando}
          style={{
            ...botaoSalvar,
            background: salvando
              ? "#475569"
              : "linear-gradient(135deg,#2563eb,#22d3ee)",
            cursor: salvando ? "not-allowed" : "pointer",
          }}
        >
          {salvando
            ? "⏳ Salvando..."
            : "💾 Salvar peça e aplicações"}
        </button>

        <button
          type="button"
          onClick={limpar}
          disabled={salvando}
          style={botaoLimpar}
        >
          🧹 Limpar campos
        </button>
      </div>
    </div>
  );
}

const campoStyle = {
  width: "100%",
  padding: "12px",
  marginTop: "10px",
  borderRadius: "10px",
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#fff",
  fontSize: "15px",
  boxSizing: "border-box",
};

const textareaStyle = {
  ...campoStyle,
  resize: "vertical",
};

const subtituloStyle = {
  color: "#67e8f9",
  marginTop: "24px",
  marginBottom: "4px",
};

const ajudaStyle = {
  color: "#94a3b8",
  marginBottom: "8px",
};

const exemploStyle = {
  padding: "12px",
  borderRadius: "10px",
  background: "#020617",
  border: "1px solid #334155",
  color: "#cbd5e1",
  fontFamily: "monospace",
  fontSize: "13px",
};

const anosStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  gap: "12px",
};

const botoesStyle = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
  marginTop: "18px",
};

const botaoSalvar = {
  padding: "13px 22px",
  borderRadius: "12px",
  border: "none",
  color: "#fff",
  fontWeight: "bold",
  fontSize: "15px",
};

const botaoLimpar = {
  padding: "13px 22px",
  borderRadius: "12px",
  border: "1px solid #475569",
  background: "#1e293b",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "15px",
};