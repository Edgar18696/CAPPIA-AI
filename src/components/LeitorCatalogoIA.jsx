import { useState } from "react";
import { supabase } from "../supabase";
import { interpretarCatalogo } from "../services/importadorIA";
import {
  separarCatalogoPorCodigo,
  dividirBlocosGrandes,
} from "../services/catalogoSeparador";

export default function LeitorCatalogoIA() {
  const [arquivoTxt, setArquivoTxt] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [resultado, setResultado] = useState(null);

  function dividirEmBlocos(texto, tamanhoMaximo = 7000) {
    const paginas = String(texto || "")
      .split(/(?=PÁGINA\s+\d+)/i)
      .map((bloco) => bloco.trim())
      .filter(Boolean);

    const blocos = [];
    let atual = "";

    for (const pagina of paginas) {
      const candidato = atual
        ? `${atual}\n\n${pagina}`
        : pagina;

      if (
        candidato.length > tamanhoMaximo &&
        atual
      ) {
        blocos.push(atual);
        atual = pagina;
      } else {
        atual = candidato;
      }
    }

    if (atual) {
      blocos.push(atual);
    }

    return blocos;
  }

  async function processarTxt() {
    if (!arquivoTxt) {
      alert("Selecione o arquivo TXT.");
      return;
    }

    setProcessando(true);
    setResultado(null);

    try {
  let textoCompleto = "";

const ehPdf =
  arquivoTxt.type === "application/pdf" ||
  arquivoTxt.name.toLowerCase().endsWith(".pdf");

if (ehPdf) {
  setProgresso("📄 Extraindo texto do PDF...");

  const formData = new FormData();

  formData.append("arquivo", arquivoTxt);
  formData.append("paginaInicial", "15");

  const { data: resultadoPdf, error: erroPdf } =
    await supabase.functions.invoke(
      "importar-catalogo",
      {
        body: formData,
      }
    );

  if (erroPdf) {
    throw new Error(
      erroPdf.message ||
        "Erro ao extrair o texto do PDF."
    );
  }

  if (!resultadoPdf?.sucesso) {
    throw new Error(
      resultadoPdf?.mensagem ||
        "Não foi possível extrair o texto do PDF."
    );
  }

  textoCompleto =
    resultadoPdf.textoExtraido || "";
} else {
  textoCompleto =
    await arquivoTxt.text();
}

      if (!textoCompleto.trim()) {
        throw new Error(
          "O arquivo TXT está vazio."
        );
      }

   const blocosPorCodigo =
  separarCatalogoPorCodigo(textoCompleto);

const blocos =
  dividirBlocosGrandes(
    blocosPorCodigo,
    7000
  );

      if (!blocos.length) {
        throw new Error(
          "Nenhum bloco foi encontrado no TXT."
        );
      }

      const todasPecas = [];
      const todasAplicacoes = [];

      for (
        let indice = 0;
        indice < blocos.length;
        indice++
      ) {
        setProgresso(
          `🤖 Analisando bloco ${
            indice + 1
          } de ${blocos.length}...`
        );

        const analise =
          await interpretarCatalogo(
            blocos[indice],
            arquivoTxt.name
          );

        todasPecas.push(
          ...(analise?.pecas || [])
        );

        todasAplicacoes.push(
          ...(analise?.aplicacoes || [])
        );
      }

      const resultadoFinal = {
        pecas: todasPecas,
        aplicacoes: todasAplicacoes,
      };

      setResultado(resultadoFinal);
      setProgresso(
        "✅ Análise concluída."
      );

      const blob = new Blob(
        [
          JSON.stringify(
            resultadoFinal,
            null,
            2
          ),
        ],
        {
          type: "application/json;charset=utf-8",
        }
      );

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;
      link.download =
        arquivoTxt.name.replace(
          /\.txt$/i,
          "-resultado.json"
        );

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      alert(`
✅ TXT analisado com sucesso.

📦 Peças encontradas:
${todasPecas.length}

🚗 Aplicações encontradas:
${todasAplicacoes.length}

📥 O arquivo JSON foi baixado.
`);
    } catch (erro) {
      console.error(
        "Erro ao analisar TXT:",
        erro
      );

      setProgresso("");

      alert(
        "Erro ao analisar o TXT: " +
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
        padding: "24px",
        borderRadius: "18px",
        border: "1px solid #2563eb",
        background: "#020617",
      }}
    >
      <h2
        style={{
          color: "#67e8f9",
          marginTop: 0,
        }}
      >
        🤖 Leitor de Catálogo TXT
      </h2>

      <p
        style={{
          color: "#94a3b8",
        }}
      >
        Selecione o TXT extraído do PDF para
        gerar o JSON técnico.
      </p>

 <input
  type="file"
  accept=".pdf,.txt,application/pdf,text/plain"
  onChange={(evento) =>
    setArquivoTxt(
      evento.target.files?.[0] || null
    )
  }
  style={{
    marginTop: "15px",
    color: "#fff",
  }}
/>

      {arquivoTxt && (
        <p
          style={{
            color: "#22c55e",
            marginTop: "12px",
          }}
        >
          ✅ Arquivo selecionado:{" "}
          {arquivoTxt.name}
        </p>
      )}

      <button
        type="button"
        onClick={processarTxt}
        disabled={
          processando || !arquivoTxt
        }
        style={{
          marginTop: "18px",
          padding: "13px 22px",
          border: "none",
          borderRadius: "12px",
          background: "#2563eb",
          color: "#fff",
          fontWeight: "bold",
          cursor: processando
            ? "wait"
            : "pointer",
          opacity:
            processando || !arquivoTxt
              ? 0.6
              : 1,
        }}
      >
        {processando
          ? "⏳ Processando TXT..."
          : "🤖 Analisar TXT com IA"}
      </button>

      {progresso && (
        <p
          style={{
            marginTop: "16px",
            color: "#67e8f9",
            fontWeight: "bold",
          }}
        >
          {progresso}
        </p>
      )}

      {resultado && (
        <div
          style={{
            marginTop: "20px",
            padding: "16px",
            borderRadius: "12px",
            background: "#0f172a",
            color: "#e2e8f0",
          }}
        >
          <p>
            🔧 Peças:{" "}
            {resultado.pecas.length}
          </p>

          <p>
            🚗 Aplicações:{" "}
            {
              resultado.aplicacoes
                .length
            }
          </p>
        </div>
      )}
    </div>
  );
}
