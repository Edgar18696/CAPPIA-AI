import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function DashboardAppia({ setScreen }) {
  const [totais, setTotais] = useState({
    fotos: 0,
    banners: 0,
    catalogo: 0,
    fabricantes: 0,
    equivalencias: 0,
    vin: 0,
  });

  useEffect(() => {
    carregarTotais();
  }, []);

  async function carregarTotais() {
    const { count: fotos } = await supabase
      .from("processamentos")
      .select("*", { count: "exact", head: true })
      .eq("tipo", "foto");

    const { count: banners } = await supabase
      .from("processamentos")
      .select("*", { count: "exact", head: true })
      .eq("tipo", "banner");

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

    setTotais({
      fotos: fotos || 0,
      banners: banners || 0,
      catalogo: catalogo || 0,
      fabricantes: fabricantes || 0,
      equivalencias: equivalencias || 0,
      vin: vin || 0,
    });
  }

  const cards = [
    ["📸", "Fotos IA", totais.fotos, "foto"],
    ["🎨", "Banners", totais.banners, "banner"],
    ["📦", "Catálogo", totais.catalogo, "baseConhecimento"],
    ["🏭", "Fabricantes", totais.fabricantes, "fabricantes"],
    ["🔄", "Equivalências", totais.equivalencias, "equivalencias"],
    ["🚗", "VIN", totais.vin, "vin"],
  ];

  return (
    <div style={{ padding: "30px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ color: "#38bdf8", fontSize: "42px", fontWeight: "bold" }}>
        🚀 APPIA AI Dashboard
      </h1>

      <p style={{ color: "#cbd5e1", marginBottom: "30px" }}>
        Visão geral da plataforma inteligente.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: "20px",
        }}
      >
        {cards.map(([icone, titulo, total, tela]) => (
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
            <div style={{ fontSize: "46px" }}>{icone}</div>
            <h2 style={{ fontSize: "22px" }}>{titulo}</h2>
            <h1 style={{ color: "#2563eb", fontSize: "42px" }}>{total}</h1>
          </div>
        ))}
      </div>
    </div>
  );
}