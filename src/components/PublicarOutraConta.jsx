// (15/11/2026) PUBLICAR EM OUTRA CONTA do Mercado Livre — em qualquer ficha publicada, a qualquer
// momento (dias depois, sem refazer o anúncio). Mostra as 3 contas (publicada / em andamento /
// disponível). Escolher uma conta só PREPARA a ficha dela (cópia da Conferência aprovada, sem MLB
// nem Bling da outra conta) e abre a Publicação: lá a conta é conferida (duplicidade ao vivo, Bling
// pelo SKU, estoque, frete) e só publica com a sua confirmação. Nada é publicado aqui.
import { useEffect, useState } from "react";
import { contasDoProduto, prepararFichaOutraConta } from "../services/anuncioPublicacaoService";
import { enderecoDaFicha } from "../services/fichasCentral";
import { ESTADO_CONTA_PRODUTO } from "../services/contasPublicacaoML";

const ROTULO = {
  [ESTADO_CONTA_PRODUTO.PUBLICADA]: "✅ Publicada",
  [ESTADO_CONTA_PRODUTO.EM_ANDAMENTO]: "⏳ Ficha em andamento",
  [ESTADO_CONTA_PRODUTO.DISPONIVEL]: "➕ Disponível",
};

export default function PublicarOutraConta({ anuncioId = "", contaDestaFicha = "" }) {
  const [st, setSt] = useState({ lendo: true, quadro: [], erro: "", ocupado: "", aviso: "" });
  useEffect(() => {
    let ativo = true;
    if (!anuncioId) return undefined;
    contasDoProduto(anuncioId).then(
      (r) => { if (ativo) setSt((s) => ({ ...s, lendo: false, quadro: r.ok ? r.quadro : [], erro: r.ok ? "" : r.erro || "Não foi possível ler as contas deste produto." })); },
      (e) => { if (ativo) setSt((s) => ({ ...s, lendo: false, erro: String(e?.message || e) })); },
    );
    return () => { ativo = false; };
  }, [anuncioId]);
  if (!anuncioId) return null;

  async function escolher(conta) {
    if (st.ocupado) return;
    setSt((s) => ({ ...s, ocupado: conta, aviso: "" }));
    const r = await prepararFichaOutraConta({ anuncioId, conta }).catch((e) => ({ ok: false, erro: String(e?.message || e) }));
    if (!r.ok) { setSt((s) => ({ ...s, ocupado: "", aviso: r.erro || "Não foi possível preparar a ficha desta conta." })); return; }
    try { window.location.assign(enderecoDaFicha(window.location.href, r.anuncioId)); }
    catch { setSt((s) => ({ ...s, ocupado: "", aviso: `Ficha da conta pronta (${r.anuncioId}): abra pela Central de Publicação.` })); }
  }
  function abrir(fichaId) {
    try { window.location.assign(enderecoDaFicha(window.location.href, fichaId)); } catch { /* sem navegação */ }
  }

  const botao = { padding: "8px 12px", borderRadius: 8, border: "none", fontWeight: 800, cursor: "pointer", color: "#fff" };
  return (
    <section data-paiia-outra-conta style={{ border: "2px solid #a78bfa", borderRadius: 12, padding: 12, margin: "12px 0", background: "#1e1b4b", color: "#ede9fe" }}>
      <div style={{ fontWeight: 800, fontSize: 16 }}>🔁 Publicar em outra conta do Mercado Livre</div>
      <p style={{ fontSize: 13, margin: "4px 0 8px", color: "#c4b5fd" }}>
        Mesmo produto, mesmos dados aprovados. Cada conta tem o seu anúncio (MLB) e a sua ficha. Ao escolher, a conta é conferida
        (duplicidade, Bling pelo SKU, estoque e frete) e só publica com a sua confirmação.
      </p>
      {st.lendo && <p style={{ fontSize: 13 }}>⏳ Conferindo as contas deste produto…</p>}
      {st.erro && <p data-paiia-outra-conta-erro style={{ color: "#fca5a5", fontSize: 13 }}>❌ {st.erro}</p>}
      {!st.lendo && !st.erro && (
        <div style={{ display: "grid", gap: 6 }}>
          {st.quadro.map((l) => (
            <div key={l.conta} data-paiia-conta-produto={l.conta} data-paiia-conta-estado={l.estado} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "6px 8px", borderRadius: 8, background: "#312e81" }}>
              <b style={{ minWidth: 110 }}>{l.nome}</b>
              <span style={{ flex: "1 1 180px", fontSize: 13 }}>
                {ROTULO[l.estado]}{l.mlb ? ` · ${l.mlb}` : ""}{String(l.conta) === String(contaDestaFicha) ? " (esta ficha)" : ""}
              </span>
              {l.estado === ESTADO_CONTA_PRODUTO.DISPONIVEL && (
                <button type="button" data-paiia-publicar-outra-conta={l.conta} onClick={() => escolher(l.conta)} disabled={Boolean(st.ocupado)} style={{ ...botao, background: st.ocupado ? "#475569" : "#7c3aed" }}>
                  {st.ocupado === l.conta ? "⏳ Preparando…" : `Publicar em ${l.nome}`}
                </button>
              )}
              {l.estado === ESTADO_CONTA_PRODUTO.EM_ANDAMENTO && l.ficha && (
                <button type="button" data-paiia-abrir-ficha-conta={l.conta} onClick={() => abrir(l.ficha)} style={{ ...botao, background: "#4338ca" }}>Abrir ficha desta conta</button>
              )}
            </div>
          ))}
        </div>
      )}
      {st.aviso && <p data-paiia-outra-conta-aviso style={{ color: "#fde68a", fontSize: 13, margin: "6px 0 0" }}>⚠ {st.aviso}</p>}
    </section>
  );
}
