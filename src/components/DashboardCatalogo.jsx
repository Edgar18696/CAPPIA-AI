export default function DashboardCatalogo({
  totalPecas,
  totalMontadoras,
  totalModelos,
  totalFabricantes,
  totalOems,
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-5 mb-8">

      <div className="bg-white rounded-xl shadow-lg p-6 text-center">
        <h2 className="text-4xl">📦</h2>
        <p className="text-gray-500 mt-2">Total de Peças</p>
        <h1 className="text-3xl font-bold text-blue-600">
          {totalPecas}
        </h1>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 text-center">
        <h2 className="text-4xl">🚗</h2>
        <p className="text-gray-500 mt-2">Montadoras</p>
        <h1 className="text-3xl font-bold text-blue-600">
          {totalMontadoras}
        </h1>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 text-center">
        <h2 className="text-4xl">🚙</h2>
        <p className="text-gray-500 mt-2">Modelos</p>
        <h1 className="text-3xl font-bold text-blue-600">
          {totalModelos}
        </h1>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 text-center">
        <h2 className="text-4xl">🏭</h2>
        <p className="text-gray-500 mt-2">Fabricantes</p>
        <h1 className="text-3xl font-bold text-blue-600">
          {totalFabricantes}
        </h1>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 text-center">
        <h2 className="text-4xl">🔑</h2>
        <p className="text-gray-500 mt-2">OEMs</p>
        <h1 className="text-3xl font-bold text-blue-600">
          {totalOems}
        </h1>
      </div>

    </div>
  );
}