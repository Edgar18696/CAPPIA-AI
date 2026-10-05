/*
 * FICHA DA CONFERÊNCIA — funções puras (sem React, sem rede).
 * A ficha do anúncio vive na base PAIIA (paiia_anuncios.dados_conferencia);
 * aqui fica só a montagem da cópia do navegador a partir dela (F5, voltar,
 * outro navegador) e a seleção das fotos que podem ir para a ficha.
 * Testes: scripts/testes/recuperacaoFichaConferencia.test.mjs
 */

// Fotos que podem ir para a ficha da base: só endereços públicos (http/https).
// Imagem embutida (data:/blob:) não cabe na ficha e é avisada na tela.
export function urlsFotosFicha(lista) {
  return (Array.isArray(lista) ? lista : [])
    .map((f) => (typeof f === "string" ? f : f?.imagem_processada || f?.imagem_original || f?.url || f?.src || ""))
    .map((u) => String(u || ""))
    .filter((u) => /^https?:\/\//i.test(u));
}

/**
 * Monta, a partir da ficha da base, o que a Conferência precisa para reabrir
 * o MESMO anúncio na etapa em que o usuário estava.
 * fichaLocal: cópia do navegador da mesma ficha (só vale se for MAIS NOVA).
 */
export function montarRecuperacaoDaFicha(anuncioBase, fichaLocal = null) {
  const dados = anuncioBase?.dados_conferencia || {};
  const ficha = dados.ficha || null;
  if (!ficha || (!ficha.campos && !ficha.anuncioConferido)) {
    return { ok: false, erro: "A ficha deste anúncio ainda não tem dados da Conferência para recuperar." };
  }
  const id = String(anuncioBase.id || "");
  const conferido = ficha.anuncioConferido || null;
  const aprovada = Boolean(conferido && ficha.assinaturaAprovada);
  // Cópia local MAIS NOVA da MESMA ficha (ex.: F5 logo depois de digitar,
  // antes da gravação chegar à base): os campos dela são mantidos.
  const localMesmaFicha =
    fichaLocal && String(fichaLocal?.campos?.anuncioIdPAIIA || "") === id &&
    String(fichaLocal.salvoEm || "") > String(dados.salvo_em || anuncioBase.updated_at || "");
  const campos = {
    ...(ficha.campos || {}),
    ...(localMesmaFicha ? fichaLocal.campos || {} : {}),
    anuncioIdPAIIA: id,
    contaDestinoML: String(anuncioBase.conta_destino_ml_user_id || ficha.campos?.contaDestinoML || ""),
  };
  const fotos =
    (Array.isArray(campos.fotos) && campos.fotos.length && campos.fotos) ||
    (aprovada && Array.isArray(conferido.fotos) && conferido.fotos.length && conferido.fotos) ||
    (Array.isArray(dados.anuncio?.fotos) && dados.anuncio.fotos) ||
    [];
  const fotosLimpas = fotos.filter(Boolean);
  const anuncio = {
    ...(dados.anuncio || {}),
    codigo: dados.anuncio?.codigo || conferido?.codigo || campos.codigo || anuncioBase.codigo,
    titulo: dados.anuncio?.titulo || conferido?.titulo || campos.titulo || anuncioBase.titulo,
    descricao: dados.anuncio?.descricao ?? conferido?.descricao ?? campos.descricao,
    preco: dados.anuncio?.preco ?? conferido?.preco ?? campos.preco,
    fotos: fotosLimpas,
    imagens: fotosLimpas,
  };
  const chave = String(anuncioBase.codigo || anuncio.codigo || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const etapaSalva = ficha.etapa === "publicacao" || ficha.etapa === "conferencia" ? ficha.etapa : "";
  const fichaConferencia = {
    ...ficha,
    campos,
    // Aprovação só vale com o que foi aprovado; sem isso, volta à Conferência.
    assinaturaAprovada: aprovada ? ficha.assinaturaAprovada || "aprovada-na-base" : "",
    anuncioConferido: aprovada ? conferido : null,
    etapa: aprovada ? etapaSalva || "publicacao" : "conferencia",
    salvoEm: new Date().toISOString(),
  };
  return {
    ok: true,
    id,
    chave,
    anuncio,
    fotos: fotosLimpas,
    fichaConferencia,
    aplicacoesManuais: Array.isArray(campos.aplicacoesManuais) ? campos.aplicacoesManuais : null,
  };
}
