export default function TabelaCatalogo({
  catalogoFiltrado,
  setEditando,
  excluirRegistro,
}) {
  return (
    <div className="bg-white rounded-xl shadow p-6 mt-8">
      <h2 className="text-xl font-bold mb-4">📚 Catálogo Cadastrado</h2>

      <p className="mb-4">
        Total carregado: <b>{catalogoFiltrado.length}</b>
      </p>

      <div className="overflow-auto">
        <table className="min-w-full border">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-3 py-2 text-left">Montadora</th>
              <th className="border px-3 py-2 text-left">Modelo</th>
              <th className="border px-3 py-2 text-left">Ano</th>
              <th className="border px-3 py-2 text-left">Motor</th>
              <th className="border px-3 py-2 text-left">Peça</th>
              <th className="border px-3 py-2 text-left">OEM</th>
              <th className="border px-3 py-2 text-left">Equivalente</th>
              <th className="border px-3 py-2 text-left">Ações</th>
            </tr>
          </thead>

          <tbody>
            {catalogoFiltrado.map((item) => (
              <tr key={item.id}>
                <td className="border px-3 py-2">{item.montadora}</td>
                <td className="border px-3 py-2">{item.modelo}</td>
                <td className="border px-3 py-2">
                  {item.ano_inicio} - {item.ano_fim}
                </td>
                <td className="border px-3 py-2">{item.motor}</td>
                <td className="border px-3 py-2">{item.peca}</td>
                <td className="border px-3 py-2">{item.codigo_oem}</td>
                <td className="border px-3 py-2">
                  {item.codigo_equivalente}
                </td>
                <td className="border px-3 py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditando({ ...item })}
                      className="px-3 py-1 rounded bg-yellow-500 text-white"
                    >
                      ✏️ Editar
                    </button>

                    <button
                      onClick={() => excluirRegistro(item.id)}
                      className="px-3 py-1 rounded bg-red-600 text-white"
                    >
                      🗑 Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {catalogoFiltrado.length === 0 && (
          <p className="text-center text-gray-500 mt-4">
            Nenhum registro encontrado.
          </p>
        )}
      </div>
    </div>
  );
}