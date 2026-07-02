export default function ImportadorExcel({
  dados,
  colunas,
  mensagem,
  importando,
  importarArquivo,
  importarParaSupabase,
}) {
  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="text-xl font-bold mb-4">
        Importar Catálogo Excel/CSV
      </h2>

      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={importarArquivo}
      />

      <p className="mt-4">
        Registros encontrados: <b>{dados.length}</b>
      </p>

      <button
        onClick={importarParaSupabase}
        disabled={importando || dados.length === 0}
        className="mt-4 px-5 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
      >
        {importando ? "Importando..." : "Importar para Supabase"}
      </button>

      {mensagem && <p className="mt-3 font-semibold">{mensagem}</p>}

      {dados.length > 0 && (
        <div className="mt-8 overflow-auto">
          <h3 className="font-bold mb-3">Prévia da planilha</h3>

          <table className="min-w-full border">
            <thead className="bg-gray-100">
              <tr>
                {colunas.map((coluna) => (
                  <th key={coluna} className="border px-3 py-2 text-left">
                    {coluna}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {dados.slice(0, 10).map((linha, index) => (
                <tr key={index}>
                  {colunas.map((coluna) => (
                    <td key={coluna} className="border px-3 py-2">
                      {String(linha[coluna] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-sm text-gray-500 mt-3">
            Exibindo os primeiros 10 registros.
          </p>
        </div>
      )}
    </div>
  );
}