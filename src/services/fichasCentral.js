// =============================================================
// PAIIA — Fichas na Central de Publicação + navegação "Voltar".
// Funções puras (sem React, sem rede). Testes:
//   scripts/testes/navegacaoFichas.test.mjs
//
// Regra principal: VOLTAR é só navegar. Nunca apaga, zera, recria ou
// abandona a ficha. A Central mostra TODAS as fichas (inclusive as que
// ainda não estão prontas), cada uma com o seu estado.
// =============================================================

export const ESTADO_CENTRAL = Object.freeze({
  EM_ANDAMENTO: "em_andamento",
  AGUARDANDO_CONFERENCIA: "aguardando_conferencia",
  CONFERENCIA_APROVADA: "conferencia_aprovada",
  PRONTO_PUBLICAR: "pronto_publicar",
  PUBLICADO: "publicado",
  AGUARDANDO_BLING: "aguardando_bling",
  INTEGRADO_BLING: "integrado_bling",
});

export const TEXTO_ESTADO_CENTRAL = Object.freeze({
  [ESTADO_CENTRAL.EM_ANDAMENTO]: "Em andamento",
  [ESTADO_CENTRAL.AGUARDANDO_CONFERENCIA]: "Aguardando Conferência",
  [ESTADO_CENTRAL.CONFERENCIA_APROVADA]: "Conferência aprovada",
  [ESTADO_CENTRAL.PRONTO_PUBLICAR]: "Pronto para publicar",
  [ESTADO_CENTRAL.PUBLICADO]: "Publicado",
  [ESTADO_CENTRAL.AGUARDANDO_BLING]: "Aguardando integração Bling",
  [ESTADO_CENTRAL.INTEGRADO_BLING]: "Integrado ao Bling",
});

export const COR_ESTADO_CENTRAL = Object.freeze({
  [ESTADO_CENTRAL.EM_ANDAMENTO]: { fundo: "#334155", texto: "#e2e8f0", icone: "✏️" },
  [ESTADO_CENTRAL.AGUARDANDO_CONFERENCIA]: { fundo: "#713f12", texto: "#fde68a", icone: "📝" },
  [ESTADO_CENTRAL.CONFERENCIA_APROVADA]: { fundo: "#1e3a8a", texto: "#bfdbfe", icone: "☑️" },
  [ESTADO_CENTRAL.PRONTO_PUBLICAR]: { fundo: "#14532d", texto: "#bbf7d0", icone: "🚀" },
  [ESTADO_CENTRAL.PUBLICADO]: { fundo: "#065f46", texto: "#a7f3d0", icone: "✅" },
  [ESTADO_CENTRAL.AGUARDANDO_BLING]: { fundo: "#7c2d12", texto: "#fed7aa", icone: "⏳" },
  [ESTADO_CENTRAL.INTEGRADO_BLING]: { fundo: "#166534", texto: "#86efac", icone: "🔗" },
});

const STATUS_PUBLICADOS = ["publicado", "publicado_com_pendencia"];
const txt = (v) => String(v ?? "").trim();

/** O MLB já existe para esta ficha? (com ou sem pendência) */
export function fichaJaPublicada(row) {
  const pub = row?.publicacao || null;
  return Boolean(txt(pub?.mlb_id)) || STATUS_PUBLICADOS.includes(pub?.status_publicacao) || STATUS_PUBLICADOS.includes(row?.status_fluxo);
}

/**
 * Estado da ficha para a Central.
 * row: { status_fluxo, conta_destino_ml_user_id, publicacao, integracao_bling }
 */
export function estadoFichaCentral(row) {
  const r = row || {};
  if (fichaJaPublicada(r)) {
    const est = r.integracao_bling?.estado || "";
    if (est === "integrado") return ESTADO_CENTRAL.INTEGRADO_BLING;
    if (est && txt(r.integracao_bling?.mlb)) return ESTADO_CENTRAL.AGUARDANDO_BLING;
    return ESTADO_CENTRAL.PUBLICADO;
  }
  switch (r.status_fluxo) {
    case "conferencia_aprovada":
    case "erro_publicacao":
    case "publicando":
      return txt(r.conta_destino_ml_user_id) ? ESTADO_CENTRAL.PRONTO_PUBLICAR : ESTADO_CENTRAL.CONFERENCIA_APROVADA;
    case "rascunho":
      // Ainda no Novo Anúncio: parcial = Em andamento; completa = Aguardando Conferência.
      if (r.etapa_fluxo === "novo_anuncio" && !r.etapa_conferencia) {
        return String(r.na_completa) === "true" ? ESTADO_CENTRAL.AGUARDANDO_CONFERENCIA : ESTADO_CENTRAL.EM_ANDAMENTO;
      }
      return ESTADO_CENTRAL.AGUARDANDO_CONFERENCIA;
    default:
      return ESTADO_CENTRAL.EM_ANDAMENTO;
  }
}

/** Linha pronta para a tela (estado + textos), sem inventar dado. */
export function resumoFichaCentral(row) {
  const estado = estadoFichaCentral(row);
  const pub = row?.publicacao || null;
  return {
    id: txt(row?.id),
    codigo: txt(row?.codigo),
    titulo: txt(row?.titulo),
    estado,
    texto: TEXTO_ESTADO_CENTRAL[estado],
    cor: COR_ESTADO_CENTRAL[estado],
    mlb: txt(pub?.mlb_id) || txt(row?.integracao_bling?.mlb),
    conta: txt(pub?.conta_nome) || txt(row?.conta_destino_nome),
    atualizado: txt(row?.updated_at),
    publicado: fichaJaPublicada(row),
    // Etapa onde a ficha continua (o "Continuar" abre ali).
    noNovoAnuncio: !fichaJaPublicada(row) && row?.status_fluxo === "rascunho" && row?.etapa_fluxo === "novo_anuncio" && !row?.etapa_conferencia,
    completa: row?.etapa_fluxo === "novo_anuncio" ? String(row?.na_completa) === "true" : null,
    pendencia: row?.status_fluxo === "erro_publicacao" ? "A última tentativa de publicação deu erro." : "",
  };
}

/** Ordem da Central: o que ainda precisa de ação primeiro; dentro, o mais recente. */
const ORDEM = [
  ESTADO_CENTRAL.EM_ANDAMENTO,
  ESTADO_CENTRAL.AGUARDANDO_CONFERENCIA,
  ESTADO_CENTRAL.CONFERENCIA_APROVADA,
  ESTADO_CENTRAL.PRONTO_PUBLICAR,
  ESTADO_CENTRAL.AGUARDANDO_BLING,
  ESTADO_CENTRAL.PUBLICADO,
  ESTADO_CENTRAL.INTEGRADO_BLING,
];
export function ordenarFichasCentral(lista) {
  return [...(Array.isArray(lista) ? lista : [])].sort((a, b) => {
    const d = ORDEM.indexOf(a.estado) - ORDEM.indexOf(b.estado);
    return d || String(b.atualizado).localeCompare(String(a.atualizado));
  });
}

// ---------------------------------------------------------------
// Rascunho do NOVO ANÚNCIO (antes da Conferência, só no navegador).
// Ir para a Home inicia uma criação nova e limpa as chaves temporárias;
// antes disso o anúncio em andamento é GUARDADO aqui, para a Central
// oferecer "Retomar". Nada é perdido por navegar.
// ---------------------------------------------------------------
export const CHAVE_ANUNCIO_EM_ANDAMENTO = "paiiaAnuncioEmAndamento";
export const CHAVES_ANUNCIO_LOCAL = Object.freeze(["novoAnuncioTemporario", "rascunhoNovoAnuncioTemp", "anuncioProntoPublicacao"]);

function lerJson(storage, chave) {
  try {
    const t = storage.getItem(chave);
    return t ? JSON.parse(t) : null;
  } catch {
    return null;
  }
}
const temTexto = (d) => Boolean(d && ["codigo", "oem", "titulo", "descricao", "preco"].some((k) => txt(d[k])));

/** Resumo do anúncio local (o mais completo entre as chaves). */
export function resumoAnuncioLocal(storage) {
  for (const chave of ["anuncioProntoPublicacao", "novoAnuncioTemporario", "rascunhoNovoAnuncioTemp"]) {
    const d = lerJson(storage, chave);
    if (temTexto(d)) return { codigo: txt(d.codigo || d.oem), titulo: txt(d.titulo), preco: txt(d.preco), chave, fichaId: txt(d.fichaIdPAIIA || d.fichaId) };
  }
  return null;
}

/**
 * Guarda as chaves do anúncio em andamento antes de a Home limpá-las.
 * Só grava quando há anúncio com texto (um vazio nunca apaga o guardado).
 * Devolve true quando guardou.
 */
export function guardarAnuncioEmAndamento(storage, agora = new Date().toISOString()) {
  try {
    const resumo = resumoAnuncioLocal(storage);
    if (!resumo) return false;
    const chaves = {};
    for (const c of CHAVES_ANUNCIO_LOCAL) {
      const v = storage.getItem(c);
      if (v) chaves[c] = v;
    }
    storage.setItem(CHAVE_ANUNCIO_EM_ANDAMENTO, JSON.stringify({ salvo_em: agora, resumo, chaves }));
    return true;
  } catch {
    return false; // sem espaço: as chaves originais não foram tocadas aqui
  }
}

export function lerAnuncioEmAndamento(storage) {
  const d = lerJson(storage, CHAVE_ANUNCIO_EM_ANDAMENTO);
  return d && d.chaves && d.resumo ? d : null;
}

/** "Retomar": devolve as chaves guardadas para o Novo Anúncio (sem apagar o guardado). */
export function restaurarAnuncioEmAndamento(storage) {
  const d = lerAnuncioEmAndamento(storage);
  if (!d) return false;
  try {
    for (const [c, v] of Object.entries(d.chaves)) {
      if (CHAVES_ANUNCIO_LOCAL.includes(c) && typeof v === "string") storage.setItem(c, v);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * O rascunho local já virou uma ficha da base (mesmo código, gravada
 * depois)? Então a Central mostra só a ficha da base.
 */
export function rascunhoLocalJaNaBase(local, fichas) {
  const idLocal = String(local?.resumo?.fichaId || "");
  if (idLocal && (Array.isArray(fichas) ? fichas : []).some((f) => String(f.id) === idLocal)) return true;
  if (!local?.resumo?.codigo) return false;
  const cod = local.resumo.codigo.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (Array.isArray(fichas) ? fichas : []).some(
    (f) => String(f.codigo || "").toUpperCase().replace(/[^A-Z0-9]/g, "") === cod && String(f.atualizado || "") >= String(local.salvo_em || "")
  );
}

// ---------------------------------------------------------------
// Tela no endereço (F5 volta para a mesma etapa, não para a Home).
// ---------------------------------------------------------------
export const TELAS_DO_FLUXO = Object.freeze(["novoAnuncio", "centralPublicacao", "mercadoLivreTeste"]);

/**
 * Tela a abrir no carregamento.
 *  - ?tela=novoAnuncio&ficha=<id> com o rascunho DESTA ficha no navegador → Novo Anúncio;
 *  - ?ficha=<id> (qualquer outro caso) → a ficha é lida da BASE e reaberta
 *    na etapa em que está (Novo Anúncio, Conferência, Publicação ou publicada);
 *  - ?tela= do fluxo → ela.
 */
export function telaInicialDoEndereco(search, padrao = "home", { fichaNovoAnuncioLocal = "" } = {}) {
  const s = String(search || "");
  const m = s.match(/[?&]tela=([A-Za-z]+)(&|$)/);
  const f = s.match(/[?&]ficha=([0-9a-f-]{36})(&|$)/i);
  if (f) {
    if (m && m[1] === "novoAnuncio" && fichaNovoAnuncioLocal && f[1].toLowerCase() === String(fichaNovoAnuncioLocal).toLowerCase()) return "novoAnuncio";
    return "mercadoLivreTeste";
  }
  return m && TELAS_DO_FLUXO.includes(m[1]) ? m[1] : padrao;
}

/** Endereço com ?tela= da etapa atual (ou sem ele, fora do fluxo). Não mexe em ?ficha=. */
export function enderecoComTela(href, tela) {
  const url = new URL(href);
  if (TELAS_DO_FLUXO.includes(tela)) url.searchParams.set("tela", tela);
  else url.searchParams.delete("tela");
  return url.toString();
}

/** Endereço para abrir UMA ficha (Conferência/Publicação/ficha publicada). */
export function enderecoDaFicha(href, id) {
  const url = new URL(href);
  if (/^[0-9a-f-]{36}$/i.test(String(id || ""))) url.searchParams.set("ficha", id);
  url.searchParams.set("tela", "mercadoLivreTeste");
  return url.toString();
}
