import { useState } from "react";
import { importarBosch } from "../services/importadorBosch";
import { salvarBoschSupabase } from "../services/salvarBoschSupabase";

export default function ImportadorBosch() {
  const [arquivo, setArquivo] = useState(null);
  const [processando, setProcessando] =
    useState(false);

  async function importar() {
    if (!arquivo) {
      alert("Selecione um TXT.");
      return;
    }

    setProcessando(true);

    try {
      const texto = await arquivo.text();

      const registros =
        importarBosch(texto);

      const resultado =
        await salvarBoschSupabase(
          registros
        );

      alert(`
✅ Importação concluída

Registros encontrados:
${registros.length}

Gravados:
${resultado.inseridos}
`);

    } catch (erro) {
      console.error(erro);

      alert(
        erro instanceof Error
          ? erro.message
          : "Erro desconhecido."
      );
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div
      style={{
        padding: 30,
      }}
    >
      <h2>
        📚 Importador Bosch
      </h2>

      <input
        type="file"
        accept=".txt,text/plain"
        onChange={(e) =>
          setArquivo(
            e.target.files?.[0] ??
              null
          )
        }
      />

      <br />
      <br />

      <button
        onClick={importar}
        disabled={processando}
      >
        {processando
          ? "Importando..."
          : "🚀 Importar Bosch"}
      </button>
    </div>
  );
}