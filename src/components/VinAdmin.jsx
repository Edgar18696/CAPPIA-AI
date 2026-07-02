import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function VinAdmin() {
  const [lista, setLista] = useState([]);
  const [prefixoVin, setPrefixoVin] = useState("");
  const [montadora, setMontadora] = useState("");
  const [modelo, setModelo] = useState("");
  const [motor, setMotor] = useState("");
  const [anoInicio, setAnoInicio] = useState("");
  const [anoFim, setAnoFim] = useState("");
  const [observacao, setObservacao] = useState("");
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    carregarVin();
  }, []);

  async function carregarVin() {
    const { data, error } = await supabase
      .from("vin_referencia")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMensagem("Erro ao carregar VIN.");
      return;
    }

    setLista(data || []);
  }

  async function salvarVin() {
    if (!prefixoVin.trim()) {
      setMensagem("Informe o prefixo VIN.");
      return;
    }

    const { error } = await supabase.from("vin_referencia").insert([
      {
        prefixo_vin: prefixoVin.toUpperCase(),
        montadora,
        modelo,
        motor,
        ano_inicio: Number(anoInicio || 0),
        ano_fim: Number(anoFim || 0),
        observacao,
      },
    ]);

    if (error) {
      setMensagem(error.message);
      return;
    }

    setPrefixoVin("");
    setMontadora("");
    setModelo("");
    setMotor("");
    setAnoInicio("");
    setAnoFim("");
    setObservacao("");
    setMensagem("VIN cadastrado com sucesso.");
    carregarVin();
  }

  async function excluirVin(id) {
    if (!window.confirm("Deseja excluir este VIN?")) return;

    const { error } = await supabase
      .from("vin_referencia")
      .delete()
      .eq("id", id);

    if (error) {
      setMensagem(error.message);
      return;
    }

    setMensagem("VIN excluído.");
    carregarVin();
  }

  return (
    <div style={{ padding: "30px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ color: "#38bdf8", fontSize: "36px" }}>
        🚗 VIN Admin
      </h1>

      <p style={{ color: "#cbd5e1", marginBottom: "25px" }}>
        Cadastre prefixos VIN para identificar montadora, modelo, motor e ano.
      </p>

      <div
        style={{
          background: "#ffffff",
          color: "#0f172a",
          borderRadius: "18px",
          padding: "25px",
          marginBottom: "30px",
        }}
      >
        <h2>Novo Prefixo VIN</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
            gap: "12px",
            marginTop: "15px",
          }}
        >
          <input placeholder="Prefixo VIN ex: 93Y5SRD" value={prefixoVin} onChange={(e) => setPrefixoVin(e.target.value)} />
          <input placeholder="Montadora" value={montadora} onChange={(e) => setMontadora(e.target.value)} />
          <input placeholder="Modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} />
          <input placeholder="Motor" value={motor} onChange={(e) => setMotor(e.target.value)} />
          <input placeholder="Ano início" value={anoInicio} onChange={(e) => setAnoInicio(e.target.value)} />
          <input placeholder="Ano fim" value={anoFim} onChange={(e) => setAnoFim(e.target.value)} />
          <input placeholder="Observação" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </div>

        <button
          onClick={salvarVin}
          style={{
            marginTop: "18px",
            background: "#2563eb",
            color: "white",
            border: "none",
            padding: "12px 20px",
            borderRadius: "10px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Salvar VIN
        </button>

        {mensagem && <p style={{ marginTop: "12px", fontWeight: "bold" }}>{mensagem}</p>}
      </div>

      <div
        style={{
          background: "#ffffff",
          color: "#0f172a",
          borderRadius: "18px",
          padding: "25px",
        }}
      >
        <h2>VIN cadastrados: {lista.length}</h2>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "15px" }}>
            <thead>
              <tr>
                <th>Prefixo</th>
                <th>Montadora</th>
                <th>Modelo</th>
                <th>Motor</th>
                <th>Ano</th>
                <th>Observação</th>
                <th>Ações</th>
              </tr>
            </thead>

            <tbody>
              {lista.map((item) => (
                <tr key={item.id}>
                  <td>{item.prefixo_vin}</td>
                  <td>{item.montadora}</td>
                  <td>{item.modelo}</td>
                  <td>{item.motor}</td>
                  <td>{item.ano_inicio} até {item.ano_fim}</td>
                  <td>{item.observacao}</td>
                  <td>
                    <button
                      onClick={() => excluirVin(item.id)}
                      style={{
                        background: "#dc2626",
                        color: "white",
                        border: "none",
                        padding: "7px 12px",
                        borderRadius: "8px",
                        cursor: "pointer",
                      }}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {lista.length === 0 && (
            <p style={{ textAlign: "center", color: "#64748b" }}>
              Nenhum VIN cadastrado.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}