/*
 * PAIIA — CANAIS DE PUBLICAÇÃO da ficha (regras puras, sem rede).
 *
 * O anúncio é criado e conferido UMA vez; ao finalizar, o usuário escolhe
 * em quais canais ele vai: Mercado Livre, Shopee e/ou Site próprio
 * (WooCommerce). A escolha fica na própria ficha, em
 * paiia_anuncios.dados_conferencia.canais_publicacao.
 *
 * - Mercado Livre: segue o fluxo de publicação de hoje (REVELAÇÃO,
 *   LOJA ONLINE ou CIEBR), sem nenhuma mudança.
 * - Shopee e WooCommerce: só ficam REGISTRADOS como escolhidos, com
 *   "Integração pendente". Nada é publicado nesses canais.
 * - Só Shopee e/ou WooCommerce (sem ML): a ficha fica "Aguardando integração"
 *   e não aparece como pronta para publicar no Mercado Livre.
 * - Preço, frete e regras de cada canal: reservados (null) para o futuro.
 */

export const CANAL = Object.freeze({
  MERCADO_LIVRE: "mercado_livre",
  SHOPEE: "shopee",
  WOOCOMMERCE: "woocommerce",
});

export const SITUACAO_CANAL = Object.freeze({
  DISPONIVEL: "disponivel",
  INTEGRACAO_PENDENTE: "integracao_pendente",
});

/** Situação da ESCOLHA como um todo. */
export const SITUACAO_CANAIS = Object.freeze({
  MERCADO_LIVRE: "mercado_livre", // ML entre os escolhidos: segue o fluxo do ML
  AGUARDANDO_INTEGRACAO: "aguardando_integracao", // só canais sem integração
});

export const TEXTO_INTEGRACAO_PENDENTE = "Integração pendente";
export const TEXTO_AGUARDANDO_INTEGRACAO = "Aguardando integração";

export const CANAIS_PUBLICACAO = Object.freeze([
  Object.freeze({ id: CANAL.MERCADO_LIVRE, nome: "Mercado Livre", situacao: SITUACAO_CANAL.DISPONIVEL, detalhe: "REVELAÇÃO, LOJA ONLINE ou CIEBR" }),
  Object.freeze({ id: CANAL.SHOPEE, nome: "Shopee", situacao: SITUACAO_CANAL.INTEGRACAO_PENDENTE, detalhe: TEXTO_INTEGRACAO_PENDENTE }),
  Object.freeze({ id: CANAL.WOOCOMMERCE, nome: "Site próprio — WooCommerce", situacao: SITUACAO_CANAL.INTEGRACAO_PENDENTE, detalhe: TEXTO_INTEGRACAO_PENDENTE }),
]);

const IDS = CANAIS_PUBLICACAO.map((c) => c.id);
const situacaoDoCanal = (id) => CANAIS_PUBLICACAO.find((c) => c.id === id)?.situacao || SITUACAO_CANAL.INTEGRACAO_PENDENTE;

/** Ficha nova (ou antiga, sem escolha gravada): Mercado Livre marcado. */
export function selecaoPadrao() {
  return { [CANAL.MERCADO_LIVRE]: true, [CANAL.SHOPEE]: false, [CANAL.WOOCOMMERCE]: false };
}

/** Normaliza uma seleção qualquer: só os 3 canais conhecidos, só true/false. */
export function normalizarSelecao(selecao) {
  const s = selecao && typeof selecao === "object" ? selecao : {};
  return Object.fromEntries(IDS.map((id) => [id, s[id] === true]));
}

export const canaisSelecionados = (selecao) => IDS.filter((id) => normalizarSelecao(selecao)[id]);

/** O registro gravado na ficha é válido? (versão 1, com pelo menos um canal) */
export function registroCanaisValido(registro) {
  if (!registro || typeof registro !== "object" || registro.versao !== 1) return false;
  const c = registro.canais;
  if (!c || typeof c !== "object") return false;
  return IDS.some((id) => c[id]?.selecionado === true);
}

/** Seleção salva na ficha (dados_conferencia) — ou null se não houver. */
export function selecaoDaFicha(dadosConferencia) {
  const reg = dadosConferencia?.canais_publicacao;
  if (!registroCanaisValido(reg)) return null;
  return Object.fromEntries(IDS.map((id) => [id, reg.canais[id]?.selecionado === true]));
}

/** Seleção para abrir a tela: a salva na ficha ou o padrão (ML marcado). */
export function selecaoInicial(dadosConferencia) {
  return selecaoDaFicha(dadosConferencia) || selecaoPadrao();
}

export function situacaoDaSelecao(selecao) {
  const s = normalizarSelecao(selecao);
  if (s[CANAL.MERCADO_LIVRE]) return SITUACAO_CANAIS.MERCADO_LIVRE;
  return canaisSelecionados(s).length ? SITUACAO_CANAIS.AGUARDANDO_INTEGRACAO : "";
}

/** Nenhum canal marcado: não há o que gravar. */
export function erroSelecao(selecao) {
  return canaisSelecionados(selecao).length ? "" : "Marque pelo menos um canal de publicação.";
}

/**
 * Registro que vai para dados_conferencia.canais_publicacao.
 * Campos de preço, frete e regras ficam reservados (null) para o futuro;
 * se já existirem valores gravados neles, são mantidos.
 */
export function montarRegistroCanais(selecao, anterior = null, agora = new Date().toISOString()) {
  const s = normalizarSelecao(selecao);
  const antes = anterior && typeof anterior === "object" && anterior.canais && typeof anterior.canais === "object" ? anterior.canais : {};
  const canais = Object.fromEntries(
    IDS.map((id) => {
      const a = antes[id] && typeof antes[id] === "object" ? antes[id] : {};
      return [id, {
        selecionado: s[id],
        situacao: situacaoDoCanal(id),
        preco: a.preco ?? null,
        frete: a.frete ?? null,
        regras: a.regras ?? null,
      }];
    })
  );
  return {
    versao: 1,
    canais,
    selecionados: canaisSelecionados(s),
    situacao: situacaoDaSelecao(s),
    escolhido_em: agora,
  };
}

/** A ficha está "Aguardando integração" (só canais sem integração)? */
export function fichaAguardandoIntegracao(registro) {
  if (!registroCanaisValido(registro)) return false;
  return registro.canais[CANAL.MERCADO_LIVRE]?.selecionado !== true;
}

/** O Mercado Livre está entre os canais da ficha? Sem registro: sim (como hoje). */
export function mercadoLivreEscolhido(registro) {
  if (!registroCanaisValido(registro)) return true;
  return registro.canais[CANAL.MERCADO_LIVRE]?.selecionado === true;
}

/** Texto curto: "Mercado Livre · Shopee (Integração pendente)". */
export function resumoCanais(selecao) {
  return canaisSelecionados(selecao)
    .map((id) => {
      const c = CANAIS_PUBLICACAO.find((x) => x.id === id);
      return c.situacao === SITUACAO_CANAL.INTEGRACAO_PENDENTE ? `${c.nome} (${TEXTO_INTEGRACAO_PENDENTE})` : c.nome;
    })
    .join(" · ");
}

export const MODO_CANAIS = Object.freeze({
  ESCOLHENDO: "escolhendo", // tela "Escolher canais de publicação" aberta
  RESUMO: "resumo", // escolha salva com ML: segue a Publicação do ML
  AGUARDANDO: "aguardando", // escolha salva sem ML: Aguardando integração
  FECHADA: "fechada", // publicada/publicando/com erro de publicação: canais travados
  SEM_FICHA: "sem_ficha", // ficha sem ID na base: segue o fluxo do ML de hoje
});

const STATUS_CANAIS_TRAVADOS = ["publicando", "publicado", "publicado_com_pendencia", "cancelado"];

/**
 * Como a tela abre para esta ficha (lida da base).
 * liberarML = a Publicação do Mercado Livre (a de hoje) aparece abaixo.
 * - Sem ID: não há onde gravar → a Publicação do ML segue como hoje.
 * - Publicada/publicando/cancelada: canais travados, Publicação do ML como hoje.
 * - Escolha salva com ML → resumo + Publicação do ML (o F5 volta ao mesmo lugar).
 * - Escolha salva sem ML → "Aguardando integração" (sem Publicação do ML).
 * - Sem escolha salva (ficha nova ou antiga) → tela de escolha, ML marcado.
 */
export function modoInicialCanais({ temId = false, anuncio = null, publicada = false } = {}) {
  if (!temId) return { modo: MODO_CANAIS.SEM_FICHA, selecao: selecaoPadrao(), liberarML: true };
  const dados = anuncio?.dados_conferencia || {};
  const salva = selecaoDaFicha(dados);
  if (publicada || STATUS_CANAIS_TRAVADOS.includes(anuncio?.status_fluxo)) {
    return { modo: MODO_CANAIS.FECHADA, selecao: salva || selecaoPadrao(), liberarML: true };
  }
  if (!salva) return { modo: MODO_CANAIS.ESCOLHENDO, selecao: selecaoPadrao(), liberarML: false };
  if (salva[CANAL.MERCADO_LIVRE]) return { modo: MODO_CANAIS.RESUMO, selecao: salva, liberarML: true };
  return { modo: MODO_CANAIS.AGUARDANDO, selecao: salva, liberarML: false };
}
