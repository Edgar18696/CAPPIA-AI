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
  // antes da gravação chegar à base): os campos dela são mantidos — mas só
  // se ela partiu da MESMA versão que está na base. Cópia de uma aba antiga
  // (feita sobre uma versão anterior) nunca volta por cima da ficha atual.
  const versaoLocal = String(fichaLocal?.versaoBase || "");
  const versaoNaBase = String(dados.salvo_em || "");
  const partiuDaVersaoAtual = !versaoLocal || !versaoNaBase || versaoLocal === versaoNaBase;
  const localMesmaFicha =
    fichaLocal && String(fichaLocal?.campos?.anuncioIdPAIIA || "") === id &&
    String(fichaLocal.salvoEm || "") > String(dados.salvo_em || anuncioBase.updated_at || "") &&
    partiuDaVersaoAtual;
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
    // Versão da ficha na base que esta tela leu: as gravações seguintes só
    // acontecem se a base ainda estiver nesta versão (cópia antiga de uma
    // aba nunca sobrescreve a ficha mais nova gravada por outra).
    versaoBase: String(dados.salvo_em || ""),
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

// ---------------------------------------------------------------
// Assinatura da aprovação: compara o CONTEÚDO, não o formato.
// Abrir/revisar, F5 ou uma versão nova do PAIIA não podem derrubar a
// aprovação só porque um valor voltou como texto em vez de número, com
// outra ordem de chaves na medida, espaços ou quebras de linha diferentes.
// Ordem da assinatura (MercadoLivreTeste): [titulo, preco, descricao, fotos,
// categoria, categoriaId, marca, numeroPeca, compatibilidades, pesoEnvio,
// comprimentoEnvio, larguraEnvio, alturaEnvio, medida, quantidade?,
// tipoVeiculo?, gtin?, tipoAnuncio?] — campos novos no fim: aprovação antiga não cai.
// ---------------------------------------------------------------
const CAMPOS_ASSINATURA = ["título", "preço", "descrição", "fotos", "categoria", "categoria (ID)", "marca", "número da peça", "compatibilidades", "peso de envio", "comprimento de envio", "largura de envio", "altura de envio", "peso e medidas confirmados", "quantidade", "tipo de veículo", "GTIN", "tipo de anúncio"];
const txt = (v) => String(v ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
const num = (v) => {
  const t = String(v ?? "").trim();
  if (!t) return "";
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : t;
};
function lerAssinatura(a) {
  if (Array.isArray(a)) return a;
  try {
    const x = JSON.parse(String(a || ""));
    return Array.isArray(x) ? x : null;
  } catch {
    return null;
  }
}
function campoCanonico(i, v, todos) {
  switch (i) {
    case 1: case 9: case 10: case 11: case 12: case 14: return num(v);
    case 3: return (Array.isArray(v) ? v : []).map((u) => txt(u)).filter(Boolean);
    // Com ID de categoria, o nome é só exibição (pode ser preenchido depois).
    case 4: return txt(todos[5]) ? "" : txt(v);
    case 7: return txt(v).toUpperCase();
    case 15: return txt(v).toUpperCase().replace(/\s*\/\s*/g, "/");
    case 13: return v && typeof v === "object" ? [num(v.peso_g), num(v.comprimento_cm), num(v.largura_cm), num(v.altura_cm)] : null;
    default: return txt(v);
  }
}

/** Campos que mudaram de verdade entre a assinatura aprovada e a atual (nomes). */
export function diferencasAssinatura(aprovada, atual) {
  const a = lerAssinatura(aprovada);
  const b = lerAssinatura(atual);
  if (!a || !b) return ["assinatura ilegível"];
  const n = Math.max(a.length, b.length);
  const dif = [];
  for (let i = 0; i < n; i++) {
    // Campo que a aprovação antiga não tinha (ex.: quantidade): não derruba.
    if (i >= a.length) continue;
    if (JSON.stringify(campoCanonico(i, a[i], a)) !== JSON.stringify(campoCanonico(i, b[i], b))) dif.push(CAMPOS_ASSINATURA[i] || `campo ${i}`);
  }
  return dif;
}

/** true quando os dados atuais são os MESMOS que foram aprovados. */
export function mesmaAprovacao(aprovada, atual) {
  if (!aprovada || !atual) return false;
  return diferencasAssinatura(aprovada, atual).length === 0;
}
