// =============================================================
// PAIIA — consultas SOMENTE LEITURA ao Mercado Livre, na conta indicada
// (função mercadolivre-publicacao, ação ml_consulta GET). Nada é gravado.
// =============================================================
import { supabase } from "../supabase";

/** consultar(caminho) → { ok, status, dados, erro } na conta informada. */
export function consultorML(conta) {
  const c = String(conta || "").replace(/\D/g, "");
  return async (caminho) => {
    if (!c) return { ok: false, erro: "Sem conta Mercado Livre selecionada." };
    try {
      const { data, error } = await supabase.functions.invoke("mercadolivre-publicacao", {
        body: { acao: "ml_consulta", conta_ml: c, metodo: "GET", caminho },
      });
      if (error) return { ok: false, erro: error.message || "Falha ao falar com o servidor." };
      if (!data) return { ok: false, erro: "Resposta vazia do servidor." };
      // (20/10) Horário em que a resposta do servidor/ML chegou. Fica junto da
      // resposta: se a tela reaproveitar da memória, o horário original é mantido.
      return { ...data, recebido_em: new Date().toISOString() };
    } catch (e) {
      return { ok: false, erro: String(e?.message || e) };
    }
  };
}

/** Modalidades de envio (me2) ATIVAS da conta; a padrão primeiro. */
export async function modalidadesDaConta(conta) {
  const r = await consultorML(conta)(`/users/${String(conta).replace(/\D/g, "")}/shipping_preferences`);
  if (!r?.ok) return { ok: false, erro: r?.erro || "Não foi possível ler as modalidades de envio.", modalidades: [] };
  const me2 = (Array.isArray(r.dados?.logistics) ? r.dados.logistics : []).find((l) => l?.mode === "me2");
  const modalidades = (me2?.types || [])
    .filter((t) => String(t?.status) === "active")
    .map((t) => ({ tipo: String(t.type), padrao: t.default === true }))
    .sort((a, b) => Number(b.padrao) - Number(a.padrao));
  return { ok: modalidades.length > 0, erro: modalidades.length ? "" : "A conta não tem modalidade Mercado Envios ativa.", modalidades };
}
