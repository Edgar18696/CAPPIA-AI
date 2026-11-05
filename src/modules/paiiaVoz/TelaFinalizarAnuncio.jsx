// =============================================================
// (04/11/2026) Tela do computador para a “Finalizar anúncio” (a mesma do celular).
// Abre a ficha indicada em ?ficha=<id>. Nada é executado sem a sua confirmação.
// =============================================================
import { useState } from "react";
import FinalizarAnuncioVoz from "./FinalizarAnuncioVoz";

function fichaDoEndereco() {
  try { return new URL(window.location.href).searchParams.get("ficha") || ""; } catch { return ""; }
}

export default function TelaFinalizarAnuncio({ setScreen, usuario }) {
  const [fichaId] = useState(fichaDoEndereco);
  return (
    <div className="pr" style={{ maxWidth: 900, margin: "0 auto 40px", textAlign: "left", color: "#e2e8f0" }} data-tela-finalizar>
      <style>{CSS}</style>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
        <button type="button" className="pr-voltar" onClick={() => setScreen?.("centralPublicacao")}>← Central</button>
        <h1 style={{ margin: 0, fontSize: 22, color: "#fff" }}>Finalizar anúncio</h1>
      </div>
      {!fichaId ? <p className="pr-aviso">Abra a ficha pela Central de Publicação (“✅ Finalizar anúncio”).</p>
        : !usuario?.id ? <p className="pr-aviso">Entre na sua conta para finalizar.</p>
          : <FinalizarAnuncioVoz fichaId={fichaId} usuarioId={usuario.id} />}
    </div>
  );
}

const CSS = `
.pr *, .pr *::before, .pr *::after { box-sizing: border-box; }
.pr-voltar { padding: 8px 12px; border-radius: 10px; border: 1px solid #334155; background: #0f172a; color: #cbd5e1; cursor: pointer; font-weight: 700; }
.pr-cartao { padding: 12px; border-radius: 12px; border: 1px solid #0e7490; background: #082f49; display: flex; flex-direction: column; gap: 8px; }
.pr-cartao p { margin: 0; font-size: 14px; }
.pr-cinza { border-color: #334155; background: #0f172a; }
.pr-conta { padding: 10px 14px; border-radius: 10px; border: 1px solid #334155; background: #0f172a; color: #e2e8f0; font-weight: 800; font-size: 15px; cursor: pointer; }
.pr-conta-on { border: 2px solid #22d3ee; background: #0e7490; color: #fff; }
.pr-linha { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.pr-botao { padding: 10px 16px; border-radius: 10px; border: 0; background: linear-gradient(90deg, #2563eb, #0891b2); color: #fff; font-weight: 800; font-size: 15px; cursor: pointer; }
.pr-botao:disabled { opacity: .45; cursor: not-allowed; }
.pr-grande { width: 100%; padding: 14px; font-size: 17px; }
.pr-link { background: none; border: 0; color: #67e8f9; font-weight: 700; cursor: pointer; padding: 6px 4px; font-size: 14px; }
.pr-check { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; color: #cbd5e1; cursor: pointer; }
.pr-fonte { color: #94a3b8; font-size: 13px; }
.pr-aviso { color: #fde68a; font-size: 14px; margin: 0; }
.pr-ok { color: #86efac; margin: 0; }
.pr-resumo { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 12px; margin: 0; font-size: 14px; }
.pr-resumo dt { color: #94a3b8; } .pr-resumo dd { margin: 0; overflow-wrap: anywhere; }
.pr-previa { margin: 0; padding: 10px; border-radius: 10px; background: #020617; border: 1px solid #1e293b; white-space: pre-wrap; font-family: inherit; font-size: 14px; }
@media (min-width: 900px) { [data-pv-finalizar] { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; } [data-pv-finalizar] > * { grid-column: span 2; } [data-pv-finalizar] > [data-pv-finalizar-dados], [data-pv-finalizar] > [data-pv-finalizar-conferencias] { grid-column: span 1; } }
`;
