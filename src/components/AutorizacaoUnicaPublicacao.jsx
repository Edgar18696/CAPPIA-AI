// (Novo Anúncio) UMA autorização depois da conferência: o mesmo piloto do PAIIA Voz faz o resto
// (Bling, validação, publicação travada no servidor, ativo, vínculo, Central). Só LOJA ONLINE.
import { useState } from "react";
import { nomeDaLoja } from "../services/duplicidadeML";
import { novaAutorizacaoId } from "../services/pilotoPublicacao";

const CHAVE = (id) => `paiiaAutorizacaoPublicacao:${id}`;

export default function AutorizacaoUnicaPublicacao({ anuncioId = "", sku = "", preco = "", quantidade = "", contas = [], onAutorizar, onManual = null, ativo = false }) {
  const [marcado, setMarcado] = useState(false);
  const loja = (contas || []).find((c) => nomeDaLoja(c.ml_user_id, c.nickname) === "LOJA ONLINE");
  if (ativo || !anuncioId || !loja) return null;
  function autorizar() {
    // Mesmo nº se a autorização desta ficha já foi dada (toque repetido / recarregar): o servidor nunca publica 2x.
    let id;
    try { id = sessionStorage.getItem(CHAVE(anuncioId)) || ""; } catch { id = ""; }
    if (!/^[0-9a-f-]{36}$/i.test(id)) { id = novaAutorizacaoId(); try { sessionStorage.setItem(CHAVE(anuncioId), id); } catch { /* segue com o nº em memória */ } }
    try { const u = new URL(window.location.href); u.searchParams.set("auto", id); u.searchParams.set("ficha", anuncioId); window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash); } catch { /* sem URL */ }
    onAutorizar?.(String(loja.ml_user_id), id);
  }
  return (
    <div data-paiia-autorizacao-unica style={{ border: "2px solid #22c55e", borderRadius: 12, padding: 14, margin: "12px 0", background: "#052e16", color: "#e2e8f0" }}>
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 15 }}>
        <input type="checkbox" checked={marcado} onChange={(e) => setMarcado(e.target.checked)} data-paiia-autorizacao-unica-check />
        <span><b>Autorizo o PAIIA a publicar no Mercado Livre (LOJA ONLINE)</b> o SKU <b>{sku || "—"}</b>{preco ? <> por <b>{preco}</b></> : ""}{quantidade ? <>, quantidade <b>{quantidade}</b></> : ""}, usar o Bling (cadastrar só se o SKU não existir, com o estoque da ficha) e concluir sozinho o vínculo e a Central. É uma única autorização: nada é publicado duas vezes.</span>
      </label>
      <button type="button" disabled={!marcado} onClick={autorizar} data-paiia-autorizacao-unica-botao
        style={{ marginTop: 10, width: "100%", padding: "14px 16px", fontSize: 17, fontWeight: 800, borderRadius: 10, border: "none", background: marcado ? "#16a34a" : "#334155", color: "#fff", cursor: marcado ? "pointer" : "not-allowed" }}>
        ✅ Finalizar e Enviar
      </button>
      {onManual && <button type="button" onClick={onManual} data-paiia-publicacao-manual style={{ marginTop: 8, background: "none", border: "none", color: "#94a3b8", textDecoration: "underline", cursor: "pointer", fontSize: 13 }}>Publicar manualmente (outra conta ou correção)</button>}
    </div>
  );
}
