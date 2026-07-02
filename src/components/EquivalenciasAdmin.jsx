import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function EquivalenciasAdmin() {
  const [equivalencias, setEquivalencias] = useState([]);
  const [codigoPrincipal, setCodigoPrincipal] = useState("");
  const [codigoEquivalente, setCodigoEquivalente] = useState("");
  const [fabricante, setFabricante] = useState("");
  const [descricao, setDescricao] = useState("");
  const [observacao, setObservacao] = useState("");
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    carregarEquivalencias();
  }, []);

  async function carregarEquivalencias() {
    const { data, error } = await supabase
      .from("equivalencias_pecas")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMensagem("Erro ao carregar equivalências.");
      return;
    }

    setEquivalencias(data || []);
  }

  async function salvarEquivalencia() {
    if (!codigoPrincipal.trim() || !codigoEquivalente.trim()) {
      setMensagem("Informe o código principal e o código equivalente.");
      return;
    }

    const { error } = await supabase.from("equivalencias_pecas").insert([
      {
        codigo_principal: codigoPrincipal,
        codigo_equivalente: codigoEquivalente,
        fabricante,
        descricao,
        observacao,
      },
    ]);

    if (error) {
      setMensagem(error.message);
      return;
    }

    setCodigoPrincipal("");
    setCodigoEquivalente("");
    setFabricante("");
    setDescricao("");
    setObservacao("");
    setMensagem("Equivalência cadastrada com sucesso.");
    carregarEquivalencias();
  }

  async function excluirEquivalencia(id) {
if (!window.confirm("Deseja excluir esta equivalência?")) return;
    const { error } = await supabase
      .from("equivalencias_pecas")
      .delete()
      .eq("id", id);

    if (error) {
      setMensagem(error.message);
      return;
    }

    setMensagem("Equivalência excluída.");
    carregarEquivalencias();
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-white mb-2">
        🔄 Equivalências
      </h1>

      <p className="text-white mb-6">
        Total cadastradas: <b>{equivalencias.length}</b>
      </p>

      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Nova Equivalência</h2>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            value={codigoPrincipal}
            onChange={(e) => setCodigoPrincipal(e.target.value)}
            placeholder="Código principal / OEM"
            className="border rounded-lg px-3 py-2"
          />

          <input
            value={codigoEquivalente}
            onChange={(e) => setCodigoEquivalente(e.target.value)}
            placeholder="Código equivalente"
            className="border rounded-lg px-3 py-2"
          />

          <input
            value={fabricante}
            onChange={(e) => setFabricante(e.target.value)}
            placeholder="Fabricante"
            className="border rounded-lg px-3 py-2"
          />

          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição"
            className="border rounded-lg px-3 py-2"
          />

          <input
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Observação"
            className="border rounded-lg px-3 py-2"
          />
        </div>

        <button
          onClick={salvarEquivalencia}
          className="mt-4 px-5 py-2 rounded-lg bg-blue-600 text-white"
        >
          Salvar Equivalência
        </button>

        {mensagem && <p className="mt-3 font-semibold">{mensagem}</p>}
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-bold mb-4">Equivalências Cadastradas</h2>

        <div className="overflow-auto">
          <table className="min-w-full border">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-3 py-2 text-left">Principal</th>
                <th className="border px-3 py-2 text-left">Equivalente</th>
                <th className="border px-3 py-2 text-left">Fabricante</th>
                <th className="border px-3 py-2 text-left">Descrição</th>
                <th className="border px-3 py-2 text-left">Observação</th>
                <th className="border px-3 py-2 text-left">Ações</th>
              </tr>
            </thead>

            <tbody>
              {equivalencias.map((item) => (
                <tr key={item.id}>
                  <td className="border px-3 py-2">
                    {item.codigo_principal}
                  </td>
                  <td className="border px-3 py-2">
                    {item.codigo_equivalente}
                  </td>
                  <td className="border px-3 py-2">{item.fabricante}</td>
                  <td className="border px-3 py-2">{item.descricao}</td>
                  <td className="border px-3 py-2">{item.observacao}</td>
                  <td className="border px-3 py-2">
                    <button
                      onClick={() => excluirEquivalencia(item.id)}
                      className="px-3 py-1 rounded bg-red-600 text-white"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {equivalencias.length === 0 && (
            <p className="text-center text-gray-500 mt-4">
              Nenhuma equivalência cadastrada.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}