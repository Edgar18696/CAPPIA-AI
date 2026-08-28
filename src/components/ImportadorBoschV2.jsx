import { useState } from "react";
import { motorImportacao } from "../services/importadores/motorImportacao";

export default function ImportadorBoschV2() {
  const [arquivo, setArquivo] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [resultado, setResultado] = useState(null);

  async function extrairFaixaPaginas(
    paginaInicial,
    paginaFinal,
    tipo
  ) {
    let paginaAtual = paginaInicial;
    let textoCompleto = "";

    while (paginaAtual <= paginaFinal) {
      setProgresso(
        `📄 Extraindo ${tipo}: página ${paginaAtual} de ${paginaFinal}...`
      );

      let resultadoPagina = null;
      let ultimoErro = null;

      for (
        let tentativa = 1;
        tentativa <= 3;
        tentativa++
      ) {
        try {
          console.log(
            `Extraindo página ${paginaAtual} — tentativa ${tentativa}/3`
          );

          const formData = new FormData();

          formData.append("arquivo", arquivo);
          formData.append(
            "paginaInicial",
            String(paginaAtual)
          );

          const { data, error } =
            await supabase.functions.invoke(
              "importar-catalogo",
              {
                body: formData,
              }
            );

          if (error) {
            let detalhe =
              error.message ||
              `Erro ao extrair a página ${paginaAtual}.`;

            try {
              if (error.context) {
                const textoErro =
                  await error.context.text();

                if (textoErro) {
                  try {
                    const jsonErro =
                      JSON.parse(textoErro);

                    detalhe =
                      jsonErro?.mensagem ||
                      jsonErro?.message ||
                      jsonErro?.error ||
                      textoErro;
                  } catch {
                    detalhe = textoErro;
                  }
                }
              }
            } catch (erroLeitura) {
              console.error(
                "Erro ao ler resposta da função:",
                erroLeitura
              );
            }

            throw new Error(detalhe);
          }

          if (!data?.sucesso) {
            throw new Error(
              data?.mensagem ||
                `A página ${paginaAtual} não foi extraída.`
            );
          }

          resultadoPagina = data;
          ultimoErro = null;
          break;
        } catch (erroTentativa) {
          ultimoErro = erroTentativa;

          console.error(
            `Falha na página ${paginaAtual}, tentativa ${tentativa}:`,
            erroTentativa
          );

          if (tentativa < 3) {
            setProgresso(
              `⚠️ Tentando novamente a página ${paginaAtual}...`
            );

            await new Promise((resolve) =>
              setTimeout(resolve, 1500)
            );
          }
        }
      }

      if (!resultadoPagina) {
        throw new Error(
          `Falha ao extrair a página ${paginaAtual} após 3 tentativas: ${
            ultimoErro instanceof Error
              ? ultimoErro.message
              : "Erro desconhecido."
          }`
        );
      }

      if (resultadoPagina.textoExtraido) {
        textoCompleto +=
          resultadoPagina.textoExtraido + "\n\n";
      }

      const proximaPagina =
        resultadoPagina.processamento?.proximaPagina;

      if (
        !proximaPagina ||
        proximaPagina <= paginaAtual
      ) {
        break;
      }

      paginaAtual = proximaPagina;

      await new Promise((resolve) =>
        setTimeout(resolve, 250)
      );
    }

    return textoCompleto.trim();
  }

async function importarCatalogoBosch() {
  if (!arquivo) {
    alert("Selecione o catálogo Bosch em PDF.");
    return;
  }

  const ehPdf =
    arquivo.type === "application/pdf" ||
    arquivo.name.toLowerCase().endsWith(".pdf");

  if (!ehPdf) {
    alert("Selecione um arquivo PDF.");
    return;
  }

  setProcessando(true);
  setResultado(null);

  try {
    const resultadoImportacao =
      await motorImportacao({
        arquivo,
        fabricante: "bosch",
        onProgresso: setProgresso,
      });

    setResultado(resultadoImportacao);

    setProgresso(
      "✅ Catálogo Bosch importado com sucesso."
    );

    console.log(
      "RESULTADO IMPORTAÇÃO BOSCH:",
      resultadoImportacao
    );

    alert(`
✅ Importação Bosch concluída.

📄 Registros encontrados:
${resultadoImportacao.encontrados}

📚 Registros únicos:
${resultadoImportacao.unicos}

💾 Registros gravados:
${resultadoImportacao.gravados}

⚠️ Lotes com erro:
${resultadoImportacao.erros.length}
`);
  } catch (erro) {
    console.error(
      "ERRO IMPORTADOR BOSCH V2:",
      erro
    );

    setProgresso("");

    alert(
      "Erro ao importar catálogo Bosch: " +
        (erro instanceof Error
          ? erro.message
          : "Erro desconhecido.")
    );
  } finally {
    setProcessando(false);
  }
}

  return (
    <div
      style={{
        marginTop: "30px",
        padding: "28px",
        borderRadius: "20px",
        background: "#020617",
        border: "1px solid #2563eb",
        color: "#fff",
      }}
    >
      <h2
        style={{
          color: "#67e8f9",
          marginTop: 0,
        }}
      >
        📚 Importador Bosch V2
      </h2>

      <p style={{ color: "#94a3b8" }}>
        Aplicações: páginas 15 até 86.
        <br />
        Equivalências: páginas 87 até 96.
      </p>

      <input
        type="file"
        accept=".pdf,application/pdf"
        onChange={(evento) =>
          setArquivo(
            evento.target.files?.[0] ||
              null
          )
        }
        style={{
          marginTop: "15px",
          color: "#fff",
        }}
      />

      {arquivo && (
        <p
          style={{
            marginTop: "14px",
            color: "#22c55e",
          }}
        >
          ✅ {arquivo.name}
        </p>
      )}

      <button
        type="button"
        onClick={importarCatalogoBosch}
        disabled={processando || !arquivo}
        style={{
          marginTop: "20px",
          padding: "14px 24px",
          borderRadius: "12px",
          border: "none",
          background: "#2563eb",
          color: "#fff",
          fontWeight: "bold",
          cursor: processando
            ? "wait"
            : "pointer",
          opacity:
            processando || !arquivo
              ? 0.6
              : 1,
        }}
      >
        {processando
          ? "⏳ Importando Bosch..."
          : "🚀 Importar Catálogo Bosch"}
      </button>

      {progresso && (
        <div
          style={{
            marginTop: "20px",
            padding: "14px",
            borderRadius: "12px",
            background: "#0f172a",
            color: "#67e8f9",
            fontWeight: "bold",
          }}
        >
          {progresso}
        </div>
      )}

      {resultado && (
        <div
          style={{
            marginTop: "20px",
            padding: "18px",
            borderRadius: "14px",
            background: "#052e16",
            border: "1px solid #22c55e",
          }}
        >
          <p>
            🔎 Encontrados:{" "}
            <strong>
              {resultado.encontrados}
            </strong>
          </p>

          <p>
            💾 Gravados:{" "}
            <strong>
              {resultado.inseridos}
            </strong>
          </p>

          <p>
            ⚠️ Lotes com erro:{" "}
            <strong>
              {resultado.erros.length}
            </strong>
          </p>
        </div>
      )}
    </div>
  );
}