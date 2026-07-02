import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function FabricantesAdmin() {
  const [fabricantes, setFabricantes] = useState([]);
  const [nome, setNome] = useState("");
  const [qualidade, setQualidade] = useState("");
  const [pais, setPais] = useState("");
  const [garantia, setGarantia] = useState("");
  const [observacao, setObservacao] = useState("");
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    carregarFabricantes();
  }, []);

  async function carregarFabricantes() {
    const { data, error } = await supabase
      .from("fabricantes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMensagem("Erro ao carregar fabricantes.");
      return;
    }

    setFabricantes(data || []);
  }

  async function salvarFabricante() {
    if (!nome.trim()) {
      setMensagem("Digite o nome do fabricante.");
      return;
    }

    const { error } = await supabase.from("fabricantes").insert([
      {
        nome,
        qualidade,
        pais,
        garantia,
        observacao,
      },
    ]);

    if (error) {
      setMensagem(error.message);
      return;
    }

    setNome("");
    setQualidade("");
    setPais("");
    setGarantia("");
    setObservacao("");
    setMensagem("Fabricante cadastrado com sucesso.");
    carregarFabricantes();
  }

  async function excluirFabricante(id) {
    if (!confirm("Deseja excluir este fabricante?")) return;

    const { error } = await supabase
      .from("fabricantes")
      .delete()
      .eq("id", id);

    if (error) {
      setMensagem(error.message);
      return;
    }

    setMensagem("Fabricante excluído.");
    carregarFabricantes();
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-white mb-6">
        🏭 Fabricantes
      </h1>

      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">
          Novo Fabricante
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome"
            className="border rounded-lg px-3 py-2"
          />

          <input
            value={qualidade}
            onChange={(e) => setQualidade(e.target.value)}
            placeholder="Qualidade"
            className="border rounded-lg px-3 py-2"
          />

          <input
            value={pais}
            onChange={(e) => setPais(e.target.value)}
            placeholder="País"
            className="border rounded-lg px-3 py-2"
          />

          <input
            value={garantia}
            onChange={(e) => setGarantia(e.target.value)}
            placeholder="Garantia"
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
          onClick={salvarFabricante}
          className="mt-4 px-5 py-2 rounded-lg bg-blue-600 text-white"
        >
          Salvar Fabricante
        </button>

        {mensagem && (
          <p className="mt-3 font-semibold">
            {mensagem}
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-bold mb-4">
          Fabricantes Cadastrados
        </h2>

        <div className="overflow-auto">
          <table className="min-w-full border">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-3 py-2 text-left">Nome</th>
                <th className="border px-3 py-2 text-left">Qualidade</th>
                <th className="border px-3 py-2 text-left">País</th>
                <th className="border px-3 py-2 text-left">Garantia</th>
                <th className="border px-3 py-2 text-left">Observação</th>
                <th className="border px-3 py-2 text-left">Ações</th>
              </tr>
            </thead>

            <tbody>
              {fabricantes.map((item) => (
                <tr key={item.id}>
                  <td className="border px-3 py-2">{item.nome}</td>
                  <td className="border px-3 py-2">{item.qualidade}</td>
                  <td className="border px-3 py-2">{item.pais}</td>
                  <td className="border px-3 py-2">{item.garantia}</td>
                  <td className="border px-3 py-2">{item.observacao}</td>
                  <td className="border px-3 py-2">
                    <button
                      onClick={() => excluirFabricante(item.id)}
                      className="px-3 py-1 rounded bg-red-600 text-white"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {fabricantes.length === 0 && (
            <p className="text-center text-gray-500 mt-4">
              Nenhum fabricante cadastrado.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
