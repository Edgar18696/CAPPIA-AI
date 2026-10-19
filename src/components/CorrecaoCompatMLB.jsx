import { useState } from "react";
import { supabase } from "../supabase";
import { conferirCompatibilidadesMLB, enviarCompatibilidadesFaltantes } from "../services/correcaoCompatMLB";
import { registrarCorrecaoCompatibilidade } from "../services/anuncioPublicacaoService";

// Correção das compatibilidades de um MLB já publicado (19/10/2026).
// Conferir = somente leitura. Enviar = só os veículos que faltam, no MESMO
// MLB, com confirmação marcada. Nunca cria anúncio, nunca remove veículo.
export default function CorrecaoCompatMLB({ ficha, mlb, conta }) {
  const [estado, setEstado] = useState({ carregando: false, dados: null, erro: "" });
  const [confirmo, setConfirmo] = useState(false);
  const [envio, setEnvio] = useState({ enviando: false, r: null });
  if (!mlb || !conta) return null;
  const chamar = async (acao, extra = {}) => {
    const { data, error } = await supabase.functions.invoke("mercadolivre-publicacao", { body: { acao, conta_ml: String(conta), ...extra } });
    if (error) return { ok: false, erro: error.message || "Falha ao falar com o servidor." };
    return data || { ok: false, erro: "Resposta vazia do servidor." };
  };
  const consultar = (caminho, metodo = "GET", corpo) => chamar("ml_consulta", { metodo, caminho, ...(corpo ? { corpo } : {}) });
  async function conferir() {
    setEstado({ carregando: true, dados: null, erro: "" });
    setEnvio({ enviando: false, r: null });
    setConfirmo(false);
    const r = await conferirCompatibilidadesMLB({ ficha, mlb, consultar });
    setEstado({ carregando: false, dados: r.ok ? r : null, erro: r.ok ? "" : r.erro });
  }
  async function enviar() {
    const d = estado.dados;
    if (!d || !confirmo || !d.faltam.length) return;
    setEnvio({ enviando: true, r: null });
    const r = await enviarCompatibilidadesFaltantes({ mlb, faltam: d.faltam, dominio: d.compat.dominio, confirmado: true, chamar, consultar });
    if (ficha?.id) {
      await registrarCorrecaoCompatibilidade({ anuncioId: ficha.id, registro: { mlb, enviados: r.resultado?.enviados || 0, aceitos: r.resultado?.aceitos || 0, estado: r.resultado?.estado || "erro", erro: r.erroEnvio || "" } });
    }
    setEnvio({ enviando: false, r });
    setConfirmo(false);
  }
  const d = estado.dados;
  return (
    <section data-paiia-correcao-compat style={{ border: "1px solid #334155", borderRadius: 12, padding: 16, background: "#0f172a", marginTop: 12, color: "#e2e8f0", fontSize: 13, lineHeight: 1.6 }}>
      <b>🚗 Compatibilidades deste MLB ({mlb})</b>
      <p style={{ color: "#94a3b8", margin: "4px 0" }}>Confere as aplicações informadas na ficha com o catálogo do Mercado Livre e com o que o anúncio já aceitou. A correção é feita no MESMO anúncio: nenhum anúncio novo, nenhum produto novo no Bling, nenhum veículo removido.</p>
      <button type="button" data-paiia-conferir-compat-mlb onClick={conferir} disabled={estado.carregando} style={botao}>
        {estado.carregando ? "⏳ Conferindo..." : "Conferir compatibilidades no Mercado Livre"}
      </button>
      {estado.erro && <div style={{ color: "#fca5a5", marginTop: 6 }}>❌ {estado.erro}</div>}
      {d && (
        <div data-paiia-compat-mlb-resultado style={{ marginTop: 8 }}>
          <div data-paiia-compat-mlb-informadas>• Informadas na ficha: {d.informadas} aplicação(ões){d.aplicacoes.length ? ` — ${d.aplicacoes.map((a) => [a.montadora, a.modelo, a.motor, a.anoInicio && a.anoFim ? `${a.anoInicio}–${a.anoFim}` : a.anoInicio || a.anoFim || ""].filter(Boolean).join(" ")).join("; ")}` : ""}</div>
          <div data-paiia-compat-mlb-correspondidas>• Correspondidas no catálogo do ML: {d.compat.veiculos.length} veículo(s){(d.compat.correspondencias || []).length ? ` (${d.compat.correspondencias.map((c) => `${c.modeloDigitado} → ${c.modeloCatalogo}`).join("; ")})` : ""}</div>
          <div data-paiia-compat-mlb-aceitas>• Já aceitas no anúncio: {d.jaAceitos.length} de {d.compat.veiculos.length} (o anúncio tem {d.noAnuncio} veículo(s) no total)</div>
          {d.compat.semCatalogo.length > 0 && <div data-paiia-compat-mlb-sem-catalogo style={{ color: "#fde68a" }}>• Sem correspondência segura (continuam na ficha, nada foi trocado): {d.compat.semCatalogo.map((x) => `${x.aplicacao} — ${x.motivo}`).join("; ")}</div>}
          {d.faltam.length > 0 ? (
            <div style={{ marginTop: 6 }}>
              <div data-paiia-compat-mlb-faltam>Faltam no anúncio: {d.faltam.map((v) => v.nome).join("; ")}</div>
              <label style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
                <input type="checkbox" data-paiia-confirmo-compat-mlb checked={confirmo} onChange={(e) => setConfirmo(e.target.checked)} />
                Confirmo enviar estes {d.faltam.length} veículo(s) ao MLB {mlb} (nada é removido)
              </label>
              <button type="button" data-paiia-enviar-compat-mlb onClick={enviar} disabled={!confirmo || envio.enviando} style={{ ...botao, marginTop: 6, background: confirmo ? "#1d4ed8" : "#334155" }}>
                {envio.enviando ? "⏳ Enviando..." : `Enviar ${d.faltam.length} veículo(s) ao mesmo MLB`}
              </button>
            </div>
          ) : (
            <div data-paiia-compat-mlb-completo style={{ color: d.compat.veiculos.length ? "#86efac" : "#fde68a", marginTop: 6 }}>
              {d.compat.veiculos.length ? "✅ Todos os veículos correspondidos já estão aceitos no anúncio." : "⚠ Nenhum veículo do catálogo corresponde com segurança às aplicações informadas: nada a enviar."}
            </div>
          )}
        </div>
      )}
      {envio.r && (
        <div data-paiia-compat-mlb-envio data-paiia-compat-estado={envio.r.resultado?.estado || "erro"} style={{ marginTop: 8, color: envio.r.ok ? "#86efac" : "#fca5a5" }}>
          {envio.r.ok ? "✅" : "⚠"} {envio.r.resultado?.texto || envio.r.erro}{envio.r.erroEnvio ? ` (resposta do envio: ${envio.r.erroEnvio})` : ""}
        </div>
      )}
    </section>
  );
}

const botao = { padding: "8px 14px", borderRadius: 10, border: "1px solid #475569", background: "#334155", color: "#e2e8f0", cursor: "pointer", fontSize: 13 };
