import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import PainelIntegracaoBling from "./PainelIntegracaoBling";
import { registroDaFicha, conferirIntegracao, precisaConferir, ESTADO as ESTADO_BLING } from "../services/vinculoBlingPublicacao";
import { salvarRegistroIntegracaoBling, pendenciaPublicacao } from "../services/anuncioPublicacaoService";

/*
 * FICHA JÁ PUBLICADA (aberta pela Central, F5 ou ?ficha=<ID>).
 * Só mostra: MLB, conta, pendência e a etapa do Bling (mesmo painel e mesma
 * conferência por LEITURA do fluxo novo). Não há botão de publicar: o MLB
 * existente é reconhecido e nunca é publicado de novo.
 */
export default function FichaPublicadaPAIIA({ ficha, setScreen }) {
  const pub = ficha?.publicacao || {};
  const [registro, setRegistro] = useState(() => registroDaFicha(ficha?.dados_conferencia));
  const [verificando, setVerificando] = useState(false);
  const pend = pendenciaPublicacao(pub);
  // O endereço continua apontando ESTA ficha (F5 volta para ela).
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (ficha?.id && url.searchParams.get("ficha") !== ficha.id) {
        url.searchParams.set("ficha", ficha.id);
        url.searchParams.set("tela", "mercadoLivreTeste");
        window.history.replaceState(window.history.state, "", url.toString());
      }
    } catch {
      // sem acesso ao endereço
    }
  }, [ficha?.id]);

  async function consultarBling(corpo) {
    const { data, error } = await supabase.functions.invoke("bling-integracao", { body: corpo });
    if (error) return { ok: false, erro: error.message || "Falha ao falar com o servidor." };
    return data || { ok: false, erro: "Resposta vazia do servidor." };
  }
  async function verificar(completa) {
    if (!ficha?.id || !precisaConferir(registro) || verificando) return;
    setVerificando(true);
    const { registro: novo } = await conferirIntegracao({ registro, consultar: consultarBling, completa });
    setVerificando(false);
    const mudou = novo.estado !== registro.estado || novo.bling_anuncio_id !== registro.bling_anuncio_id;
    if (mudou || completa) await salvarRegistroIntegracaoBling({ anuncioId: ficha.id, registro: novo });
    setRegistro(novo);
  }
  // Mesma conferência leve do fluxo novo: a cada 30 s enquanto aguarda (até 30 min).
  useEffect(() => {
    if (!registro || !precisaConferir(registro) || registro.estado !== ESTADO_BLING.AGUARDANDO) return undefined;
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      if (n > 60) return clearInterval(t);
      verificar(false);
      return undefined;
    }, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registro?.estado]);

  return (
    <div data-paiia-ficha-publicada style={{ width: "100%", maxWidth: "1180px", margin: "30px auto" }}>
      <section style={caixa}>
        <h2 style={{ color: "#86efac", margin: "0 0 6px" }}>✅ Anúncio já publicado no Mercado Livre</h2>
        <p style={linha}>
          {ficha?.titulo || "Sem título"} · Código {ficha?.codigo || "—"}
        </p>
        <p style={linha}>
          MLB: <b data-paiia-mlb-publicado style={{ fontFamily: "monospace" }}>{pub.mlb_id || registro?.mlb || "—"}</b>
          {pub.conta_nome || ficha?.conta_destino_nome ? ` · Conta ${pub.conta_nome || ficha.conta_destino_nome}` : ""}
          {pub.mlb_link ? (
            <>
              {" · "}
              <a href={pub.mlb_link} target="_blank" rel="noopener noreferrer" style={{ color: "#93c5fd" }}>abrir no Mercado Livre</a>
            </>
          ) : null}
        </p>
        {pend && <p style={{ ...linha, color: "#fca5a5" }}>⚠ {pend} A correção é feita no mesmo MLB, sem publicar de novo.</p>}
        <p style={{ color: "#94a3b8", fontSize: 13, margin: "6px 0 0" }}>
          Esta ficha já tem MLB: o PAIIA não publica de novo.
        </p>
      </section>

      {registro && (
        <PainelIntegracaoBling registro={registro} verificando={verificando} onVerificar={() => verificar(true)} />
      )}

      <div style={{ marginTop: 16 }}>
        <button type="button" data-paiia-voltar-central onClick={() => setScreen?.("centralPublicacao")} style={botao}>
          ← Voltar à Central de Publicação
        </button>
      </div>
    </div>
  );
}

const caixa = { border: "1px solid #334155", borderRadius: 12, padding: 16, background: "#0f172a" };
const linha = { color: "#e2e8f0", fontSize: 14, margin: "4px 0" };
const botao = { padding: "10px 16px", borderRadius: 10, border: "1px solid #475569", background: "#334155", color: "#e2e8f0", cursor: "pointer", fontSize: 14 };
