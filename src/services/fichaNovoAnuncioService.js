import { supabase } from "../supabase";
import { mesclarNovoAnuncio, fichaFechada, normalizarCodigoFicha, idFichaValido } from "./fichaNovoAnuncio";

/*
 * Ficha persistente do NOVO ANÚNCIO na base PAIIA (paiia_anuncios).
 * Só esta tabela, só do usuário logado (RLS). Nada vai para o Mercado
 * Livre, para o Bling ou para a base de conhecimento (catalogo_pecas /
 * paiia_conhecimento_validado): salvar a ficha operacional não incorpora
 * nada à base de conhecimento.
 */
const T = "paiia_anuncios";

async function usuarioAtual() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

export async function lerFichaNovoAnuncio(fichaId) {
  if (!idFichaValido(fichaId)) return { ok: false, erro: "ID de ficha inválido." };
  const { data, error } = await supabase
    .from(T)
    .select("id, codigo, titulo, status_fluxo, dados_conferencia, updated_at, paiia_anuncios_publicacoes(mlb_id, status_publicacao)")
    .eq("id", fichaId)
    .maybeSingle();
  if (error) return { ok: false, erro: error.message || "Falha ao ler a ficha." };
  if (!data) return { ok: false, naoEncontrada: true, erro: "Ficha não encontrada." };
  return { ok: true, ficha: { ...data, publicacao: (data.paiia_anuncios_publicacoes || [])[0] || null } };
}

/**
 * Cria (sem ID) ou atualiza (com ID) a MESMA ficha com os dados do Novo Anúncio.
 * - Ficha publicada/cancelada: nunca é alterada → { ok:false, fechada:true }.
 * - status_fluxo não é mudado numa ficha existente (aprovação/publicação
 *   continuam sendo da Conferência/Publicação).
 */
export async function salvarFichaNovoAnuncio({ fichaId = "", codigo, titulo, montado }) {
  const usuarioId = await usuarioAtual();
  if (!usuarioId) return { ok: false, erro: "Sessão expirada: entre de novo no PAIIA." };
  const agora = new Date().toISOString();
  const cod = String(codigo || "").trim();
  if (idFichaValido(fichaId)) {
    const r = await lerFichaNovoAnuncio(fichaId);
    if (!r.ok && !r.naoEncontrada) return r;
    if (r.ok) {
      if (fichaFechada(r.ficha)) return { ok: false, fechada: true, fichaId, erro: "Esta ficha já foi publicada ou cancelada: o Novo Anúncio não altera ela." };
      const dados = mesclarNovoAnuncio(r.ficha.dados_conferencia, montado, agora);
      const somenteNovo = dados.etapa_fluxo === "novo_anuncio";
      const { error } = await supabase
        .from(T)
        .update({
          // O código só muda enquanto a ficha ainda está no Novo Anúncio.
          ...(somenteNovo && cod ? { codigo: cod, codigo_normalizado: normalizarCodigoFicha(cod) } : {}),
          titulo: titulo || r.ficha.titulo || null,
          dados_conferencia: dados,
          updated_at: agora,
        })
        .eq("id", fichaId);
      if (error) return { ok: false, erro: error.message || "Falha ao gravar a ficha." };
      return { ok: true, fichaId, nova: false, salvoEm: agora };
    }
  }
  if (!cod) return { ok: false, erro: "Sem código da peça: a ficha ainda não pode ser criada." };
  const { data, error } = await supabase
    .from(T)
    .insert({
      usuario_id: usuarioId,
      codigo: cod,
      codigo_normalizado: normalizarCodigoFicha(cod),
      titulo: titulo || null,
      marketplace: "mercado_livre",
      status_fluxo: "rascunho",
      dados_conferencia: mesclarNovoAnuncio({}, montado, agora),
    })
    .select("id")
    .single();
  if (error) return { ok: false, erro: error.message || "Falha ao criar a ficha." };
  return { ok: true, fichaId: data.id, nova: true, salvoEm: agora };
}
