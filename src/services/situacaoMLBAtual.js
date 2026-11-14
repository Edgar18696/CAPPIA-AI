// =============================================================
// PAIIA — situação ATUAL de um MLB no Mercado Livre (SOMENTE LEITURA).
// Usada pela tela final da ficha publicada para mostrar, ao lado do
// histórico gravado, se o anúncio ainda existe ou foi excluído/encerrado.
// Só faz GET /items/<MLB> na conta da publicação (ml_consulta); nunca
// publica, altera ou grava nada.
// =============================================================
import { supabase } from "../supabase";
import { situacaoMLBRegistrado } from "./duplicidadeML";

export async function lerSituacaoMLBAtual({ mlb, conta }) {
  const id = String(mlb || "").trim().toUpperCase();
  const contaTxt = String(conta || "");
  if (!/^MLB\d+$/.test(id) || !contaTxt) return { lido: false, texto: "" };
  let resp;
  try {
    const { data, error } = await supabase.functions.invoke("mercadolivre-publicacao", {
      body: { acao: "ml_consulta", conta_ml: contaTxt, metodo: "GET", caminho: `/items/${id}` },
    });
    resp = error ? { ok: false, erro: error.message } : data;
  } catch (e) {
    resp = { ok: false, erro: String(e?.message || e) };
  }
  return { lido: true, ...textoSituacaoMLBAtual({ mlb: id, conta: contaTxt, resp }) };
}

/**
 * Texto da situação atual (função pura, testável).
 * (14/11) Diferencia excluído, encerrado, pausado, ativo, em revisão e inativo.
 * Devolve { excluido (= deixou de existir: excluído OU encerrado), situacao,
 *           confirmada, preco, texto }.
 */
export function textoSituacaoMLBAtual({ mlb, conta, resp }) {
  const s = situacaoMLBRegistrado({ mlb, conta, resp });
  const existe = resp?.ok && resp?.dados?.id && String(resp.dados.seller_id ?? "") === String(conta);
  const detalhe = `${s.status}${s.sub_status.length ? ` / ${s.sub_status.join(", ")}` : ""}`;
  const texto = s.situacao === "excluido"
    ? `anúncio excluído no Mercado Livre (${detalhe})`
    : s.situacao === "encerrado"
      ? `anúncio encerrado (finalizado) no Mercado Livre (${detalhe})`
      : existe
        ? `anúncio ${{ ativo: "ativo", pausado: "pausado", em_revisao: "em revisão", inativo: "inativo" }[s.situacao] || "existe"} (${detalhe})`
        : `não foi possível confirmar (${s.motivo})`;
  // registro: leitura completa (situacaoMLBRegistrado) — usada para RETOMAR a ficha com segurança.
  return { excluido: s.libera, situacao: existe || s.libera ? s.situacao : "nao_confirmada", confirmada: Boolean(existe || s.libera), preco: s.preco, texto, registro: s };
}
