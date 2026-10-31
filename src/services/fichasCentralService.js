import { supabase } from "../supabase";

/*
 * Central de Publicação — LEITURA das fichas do usuário (paiia_anuncios).
 * Só SELECT (RLS: cada usuário vê só as suas). Não grava nada.
 * Fichas canceladas não aparecem; todas as outras aparecem, prontas ou não.
 * Fichas ARQUIVADAS (tabela paiia_fichas_arquivadas) também não aparecem aqui,
 * mas continuam intactas na base (histórico, MLB, Bling, duplicidade).
 * Desarquivar = tirar a ficha da tabela de arquivo.
 */
const CAMPOS_CENTRAL = "id, codigo, titulo, status_fluxo, conta_destino_ml_user_id, conta_destino_nome, updated_at, integracao_bling:dados_conferencia->integracao_bling, etapa_fluxo:dados_conferencia->>etapa_fluxo, na_completa:dados_conferencia->novo_anuncio->>completa, etapa_conferencia:dados_conferencia->ficha->>etapa, canais:dados_conferencia->canais_publicacao, paiia_anuncios_publicacoes(mlb_id, status_publicacao, conta_nome, publicado_em, ml_user_id, bling_produto_id)";

export async function listarFichasCentral({ limite = 50 } = {}) {
  let { data, error } = await supabase
    .from("paiia_anuncios")
    .select(`${CAMPOS_CENTRAL}, paiia_fichas_arquivadas(anuncio_id)`)
    .neq("status_fluxo", "cancelado")
    .is("paiia_fichas_arquivadas", null)
    .order("updated_at", { ascending: false })
    .limit(limite);
  // Se a tabela de arquivo ainda não existir na base, a Central funciona como antes.
  if (error && /paiia_fichas_arquivadas/i.test(`${error.message || ""} ${error.details || ""} ${error.hint || ""}`)) {
    ({ data, error } = await supabase
      .from("paiia_anuncios")
      .select(CAMPOS_CENTRAL)
      .neq("status_fluxo", "cancelado")
      .order("updated_at", { ascending: false })
      .limit(limite));
  }
  if (error) return { ok: false, erro: error.message || "Não foi possível ler as fichas na base PAIIA." };
  return {
    ok: true,
    fichas: (data || []).map((a) => ({ ...a, publicacao: (a.paiia_anuncios_publicacoes || []).find(Boolean) || null })),
  };
}
