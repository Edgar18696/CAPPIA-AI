import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function CentroConhecimento({ setScreen }) {
  const [totalCatalogo, setTotalCatalogo] = useState(0);
  const [totalFabricantes, setTotalFabricantes] = useState(0);
  const [totalEquivalencias, setTotalEquivalencias] = useState(0);
  const [totalVin, setTotalVin] = useState(0);

  useEffect(() => {
    carregarTotais();
  }, []);

  async function carregarTotais() {
    const { count: catalogo } = await supabase
      .from("catalogo_pecas")
      .select("*", { count: "exact", head: true });

    const { count: fabricantes } = await supabase
      .from("fabricantes")
      .select("*", { count: "exact", head: true });

    const { count: equivalencias } = await supabase
      .from("equivalencias_pecas")
      .select("*", { count: "exact", head: true });

    const { count: vin } = await supabase
      .from("vin_referencia")
      .select("*", { count: "exact", head: true });

    setTotalCatalogo(catalogo || 0);
    setTotalFabricantes(fabricantes || 0);
    setTotalEquivalencias(equivalencias || 0);
    setTotalVin(vin || 0);
  }

  const cards = [
    ["📦", "Catálogo", totalCatalogo, "Peças cadastradas", "baseConhecimento"],
    ["🏭", "Fabricantes", totalFabricantes, "Fabricantes cadastrados", "fabricantes"],
    ["🔄", "Equivalências", totalEquivalencias, "Códigos equivalentes", "equivalencias"],
    ["🚗", "VIN", totalVin, "Prefixos VIN cadastrados", "vin"],
  ];

  return (
    <div style={{ padding: "30px", maxWidth: "1100px", margin: "0 auto" }}>
      <h1 style={{ color: "#38bdf8", fontSize: "38px", fontWeight: "bold" }}>
        📚 Centro de Catálogos
      </h1>

      <p style={{ color: "#cbd5e1", marginBottom: "30px" }}>
        Consulte códigos, OEM, aplicações, equivalências, VIN/chassi e catálogos de montadoras e distribuidores.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "20px",
        }}
      >
        {cards.map(([icone, titulo, total, descricao, tela]) => (
          <div
            key={tela}
            onClick={() => setScreen(tela)}
            style={{
              background: "#ffffff",
              color: "#0f172a",
              borderRadius: "18px",
              padding: "25px",
              cursor: "pointer",
              boxShadow: "0 15px 35px rgba(0,0,0,0.25)",
              border: "2px solid #2563eb",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "42px" }}>{icone}</div>

            <h2 style={{ fontSize: "24px", marginTop: "10px" }}>
              {titulo}
            </h2>

            <h1 style={{ color: "#2563eb", fontSize: "42px" }}>
              {total}
            </h1>

            <p style={{ color: "#475569" }}>{descricao}</p>
          </div>
        ))}
      </div>
    </div>
  );
}