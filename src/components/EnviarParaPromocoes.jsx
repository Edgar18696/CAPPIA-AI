// =============================================================
// PAIIA — botão "Enviar para Promoções" (17/11/2026).
// Usado no Ranqueamento: inclui o anúncio na SELEÇÃO da campanha escolhida
// (hoje só a Black Friday 2026). Só seleciona: não aprova, não ativa e não
// altera preço, anúncio, estoque ou Bling. A seleção é a mesma da aba
// Black Friday (Central de Promoções). LIMITAÇÃO: por enquanto fica só neste
// navegador; a gravação no Supabase depende de autorização.
// =============================================================
import { useEffect, useState } from "react";
import { supabase, ambienteSupabase } from "../supabase";
import { CAMPANHAS_PROMOCOES, armazemCampanhas } from "../services/promocoes/campanhas";
import { armazenamentoCompartilhado } from "../services/promocoes/armazenamentoSupabase";
import { adaptadorLocal, criarSelecao, chaveItemSelecao, EVENTO_SELECAO } from "../services/promocoes/selecao";

const idConta = (c) => String(c?.id ?? c ?? "").replace(/\D/g, "");

let usuarioCache = null;
function useUsuario() {
  const [id, setId] = useState(usuarioCache || "");
  useEffect(() => {
    let vivo = true;
    if (!usuarioCache) supabase.auth.getUser().then(({ data }) => { usuarioCache = data?.user?.id || ""; if (vivo) setId(usuarioCache); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  return id;
}

/** @param {{ conta: string|object, anuncio: { item_id: string, sku?: string, titulo?: string, preco?: number } }} p */
export default function EnviarParaPromocoes({ conta, anuncio }) {
  const usuarioId = useUsuario();
  const [aberto, setAberto] = useState(false);
  const [campanhaId, setCampanhaId] = useState(CAMPANHAS_PROMOCOES[0].id);
  const [msg, setMsg] = useState("");
  const [versao, setVersao] = useState(0);
  const contaId = idConta(conta);
  const mlb = String(anuncio?.item_id || "").toUpperCase();

  // (18/11) Modo de teste: a mesma seleção gravada no banco de teste (STAGING) que a aba usa.
  const noBanco = ambienteSupabase === "staging";
  const [banco, setBanco] = useState(null);
  useEffect(() => {
    if (!noBanco || !usuarioId) return undefined;
    let vivo = true;
    armazenamentoCompartilhado({ supabase, usuarioId }).then((a) => vivo && setBanco(a)).catch(() => {});
    return () => { vivo = false; };
  }, [noBanco, usuarioId]);

  useEffect(() => {
    const atualizar = () => setVersao((v) => v + 1);
    window.addEventListener(EVENTO_SELECAO, atualizar);
    return () => window.removeEventListener(EVENTO_SELECAO, atualizar);
  }, []);

  if (!usuarioId || !contaId || !/^MLB\d+$/.test(mlb) || (noBanco && !banco)) return null;
  const todas = armazemCampanhas(noBanco ? banco.storageCampanhas : localStorage, usuarioId).todas();
  const sel = (id) => criarSelecao({ adaptador: noBanco ? banco.adaptadorSelecao : adaptadorLocal(localStorage), usuarioId, campanhaId: id, campanhas: todas });
  const naCampanha = todas.filter((c) => c.contas.includes(contaId) && sel(c.id).mapa(contaId).has(chaveItemSelecao(contaId, mlb)));
  void versao;

  const disponiveis = todas.filter((c) => c.contas.includes(contaId));

  function enviar(id = campanhaId) {
    const r = sel(id).incluir([{ conta: contaId, id: mlb, sku: anuncio.sku, titulo: anuncio.titulo, preco_original: anuncio.preco ?? null }], { origem: "ranqueamento" });
    const nome = todas.find((c) => c.id === id)?.nome;
    setMsg(r.incluidos.length ? `Enviado para ${nome}.` : r.ja_estavam.length ? `Já estava em ${nome}.` : r.recusados[0]?.motivo || "Não foi possível enviar.");
    setAberto(false);
  }

  // (18/11) Uma campanha só para esta conta: envia num clique; com 2 ou mais, abre a escolha.
  const clicarEnviar = () => { setMsg(""); if (disponiveis.length === 1) enviar(disponiveis[0].id); else setAberto(true); };

  if (naCampanha.length && !aberto) return <span style={S.ok} data-paiia-promocoes-enviado>✓ em {naCampanha.map((c) => c.nome).join(", ")}</span>;
  return (
    <span style={S.caixa} data-paiia-enviar-promocoes>
      {!aberto
        ? <button type="button" style={S.botao} onClick={clicarEnviar}>🏷️ Enviar para Promoções</button>
        : <>
          <select value={campanhaId} onChange={(e) => setCampanhaId(e.target.value)} style={S.select} aria-label="Campanha de destino">
            {disponiveis.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <button type="button" style={S.botao} onClick={() => enviar()}>Enviar</button>
          <button type="button" style={S.botao} onClick={() => setAberto(false)}>Cancelar</button>
        </>}
      {msg && <small style={S.msg}>{msg}</small>}
    </span>
  );
}

const S = {
  caixa: { display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" },
  botao: { border: "1px solid #475569", borderRadius: 8, background: "#0f172a", color: "#e2e8f0", padding: "3px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  select: { border: "1px solid #475569", borderRadius: 8, background: "#020617", color: "#f8fafc", padding: "3px 6px", fontSize: 12 },
  ok: { color: "#67e8f9", fontSize: 12, fontWeight: 800 },
  msg: { color: "#94a3b8" },
};
