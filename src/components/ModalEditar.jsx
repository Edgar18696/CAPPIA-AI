export default function ModalEditar({
  editando,
  setEditando,
  salvarEdicao,
  salvandoEdicao,
}) {
  if (!editando) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-3xl">

        <h2 className="text-2xl font-bold mb-5">
          ✏️ Editar Registro
        </h2>

        <div className="grid grid-cols-2 gap-3">

          <input
            className="border rounded-lg p-2"
            placeholder="Montadora"
            value={editando.montadora || ""}
            onChange={(e) =>
              setEditando({
                ...editando,
                montadora: e.target.value,
              })
            }
          />

          <input
            className="border rounded-lg p-2"
            placeholder="Modelo"
            value={editando.modelo || ""}
            onChange={(e) =>
              setEditando({
                ...editando,
                modelo: e.target.value,
              })
            }
          />

          <input
            className="border rounded-lg p-2"
            placeholder="Ano Inicial"
            value={editando.ano_inicio || ""}
            onChange={(e) =>
              setEditando({
                ...editando,
                ano_inicio: e.target.value,
              })
            }
          />

          <input
            className="border rounded-lg p-2"
            placeholder="Ano Final"
            value={editando.ano_fim || ""}
            onChange={(e) =>
              setEditando({
                ...editando,
                ano_fim: e.target.value,
              })
            }
          />

          <input
            className="border rounded-lg p-2"
            placeholder="Motor"
            value={editando.motor || ""}
            onChange={(e) =>
              setEditando({
                ...editando,
                motor: e.target.value,
              })
            }
          />

          <input
            className="border rounded-lg p-2"
            placeholder="Peça"
            value={editando.peca || ""}
            onChange={(e) =>
              setEditando({
                ...editando,
                peca: e.target.value,
              })
            }
          />

          <input
            className="border rounded-lg p-2"
            placeholder="Código OEM"
            value={editando.codigo_oem || ""}
            onChange={(e) =>
              setEditando({
                ...editando,
                codigo_oem: e.target.value,
              })
            }
          />

          <input
            className="border rounded-lg p-2"
            placeholder="Código Equivalente"
            value={editando.codigo_equivalente || ""}
            onChange={(e) =>
              setEditando({
                ...editando,
                codigo_equivalente: e.target.value,
              })
            }
          />

          <input
            className="border rounded-lg p-2"
            placeholder="Fabricante"
            value={editando.fabricante || ""}
            onChange={(e) =>
              setEditando({
                ...editando,
                fabricante: e.target.value,
              })
            }
          />

          <input
            className="border rounded-lg p-2"
            placeholder="Observação"
            value={editando.observacao || ""}
            onChange={(e) =>
              setEditando({
                ...editando,
                observacao: e.target.value,
              })
            }
          />

        </div>

        <div className="flex justify-end gap-3 mt-6">

          <button
            onClick={() => setEditando(null)}
            className="px-5 py-2 rounded-lg bg-gray-300"
          >
            Cancelar
          </button>

          <button
            onClick={salvarEdicao}
            disabled={salvandoEdicao}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white"
          >
            {salvandoEdicao ? "Salvando..." : "Salvar"}
          </button>

        </div>

      </div>
    </div>
  );
}