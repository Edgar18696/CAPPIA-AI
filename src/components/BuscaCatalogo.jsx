export default function BuscaCatalogo({ busca, setBusca }) {
  return (
    <div className="bg-white rounded-xl shadow p-6 mt-8">
      <h2 className="text-xl font-bold mb-4">
        🔍 Buscar no Catálogo
      </h2>

      <input
        type="text"
        placeholder="Buscar por modelo, peça, OEM ou equivalente..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="w-full border rounded-lg px-4 py-2"
      />
    </div>
  );
}