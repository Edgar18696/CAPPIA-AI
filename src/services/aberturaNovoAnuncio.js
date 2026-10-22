// =============================================================
// PAIIA — ABERTURA DO NOVO ANÚNCIO (um ponto só para todas as entradas).
//   Testes: scripts/testes/aberturaNovoAnuncio.test.mjs
//
// Regra: um anúncio NOVO nunca herda nada de outro anúncio (fotos, título,
// código, aplicações, preço/custo, clip...). Abrir a ficha B mostra só os
// dados de B. Voltar ao anúncio em andamento mantém o MESMO anúncio.
//
// Três intenções:
//   • iniciarAnuncioNovo({ dados })   → criação nova (Home, menus, catálogo,
//                                        "Usar este Preço");
//   • abrirFichaNoNovoAnuncio(rasc)   → continuar UMA ficha (tem ID);
//   • (nada a chamar)                 → voltar ao anúncio em andamento
//                                        (F5, Foto IA, Galeria, Banner, Clip).
// O Novo Anúncio decide o que abrir com decidirAberturaNovoAnuncio().
// Funções puras sobre o localStorage (sem React, sem rede).
// =============================================================

import {
  prepararNovaCriacaoMidia,
  consumirNovaCriacaoMidia,
  deveIniciarNovaCriacaoMidia,
} from "./limparEstadoTemporarioMidia.js";
import {
  guardarAnuncioEmAndamento,
  lerAnuncioEmAndamento,
  restaurarAnuncioEmAndamento,
  CHAVES_ANUNCIO_LOCAL,
} from "./fichasCentral.js";

export const CHAVE_ABERTURA_NOVO_ANUNCIO = "paiiaAberturaNovoAnuncio";
export const CHAVE_RASCUNHO_PRINCIPAL = "novoAnuncioTemporario";
export const CHAVE_RASCUNHO_RESERVA = "rascunhoNovoAnuncioTemp";
export const CHAVE_CLIP_GERACAO_FICHA = "clipGeracaoFicha";

/** Chaves "soltas" que pertencem a UM anúncio e não podem passar para outro. */
export const CHAVES_DE_UM_ANUNCIO = Object.freeze([
  "dadosPrecificacaoAppia",
  "precoSugeridoAppia",
  "clipPronto",
  "clipSelecionado",
  "clipSelecionadoEstilo",
  "projetoAppiaAtual",
  "fotoPronta",
  "voltarParaFotosAnuncio",
  "voltarParaMidiasAnuncio",
  "pecaCatalogoSelecionada",
  "usarDadosCatalogoNoAnuncio",
  "codigoNovoAnuncio",
  "fotosSelecionadasAnuncio",
  "paiiaVozComplemento", // marca/quantidade ditas no PAIIA Voz (só do anúncio aberto por ele)
]);
const CHAVES_STATUS_CLIP = ["clipGeracaoStatus", "clipGeracaoMensagem", "clipGeracaoErro"];

const RE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const txt = (v) => String(v ?? "").trim();
export const idValido = (id) => RE_ID.test(txt(id));
const armazenamento = (s) => s || globalThis.localStorage;

function lerJson(storage, chave) {
  try {
    const t = storage.getItem(chave);
    return t ? JSON.parse(t) : null;
  } catch {
    return null;
  }
}
const temTexto = (d) => Boolean(d && ["codigo", "oem", "titulo", "descricao", "preco"].some((k) => txt(d[k])));

/** ID da ficha a que um rascunho/anúncio pertence ("" = anúncio ainda sem ficha). */
export function fichaDoRascunho(d) {
  if (!d || typeof d !== "object") return "";
  const id = txt(d.fichaIdPAIIA || d.fichaId);
  return idValido(id) ? id : "";
}

/**
 * O rascunho a usar entre a cópia principal e a reserva.
 *  - sem fichaId: o MAIS RECENTE com texto (regra antiga do F5);
 *  - com fichaId (pode ser ""): só os rascunhos DESSA ficha contam —
 *    o rascunho de outro anúncio nunca é escolhido.
 */
export function escolherRascunho(storage, { fichaId } = {}) {
  const s = armazenamento(storage);
  let principal = lerJson(s, CHAVE_RASCUNHO_PRINCIPAL);
  let reserva = lerJson(s, CHAVE_RASCUNHO_RESERVA);
  if (fichaId !== undefined) {
    const alvo = txt(fichaId);
    if (principal && fichaDoRascunho(principal) !== alvo) principal = null;
    if (reserva && fichaDoRascunho(reserva) !== alvo) reserva = null;
  }
  const p = temTexto(principal);
  const r = temTexto(reserva);
  if (p && r) return Number(reserva.salvoEm || 0) > Number(principal.salvoEm || 0) ? reserva : principal;
  if (p) return principal;
  if (r) return reserva;
  return principal || reserva || null;
}

/** Ficha do anúncio em andamento neste navegador ("" se não houver). */
export function fichaDoAnuncioEmAndamento(storage) {
  return fichaDoRascunho(escolherRascunho(storage));
}

/** ?tela=novoAnuncio&ficha=<id> → id pedido ("" se não houver). */
export function fichaPedidaNoEndereco(href) {
  try {
    const url = new URL(href);
    const id = url.searchParams.get("ficha") || "";
    return url.searchParams.get("tela") === "novoAnuncio" && idValido(id) ? id : "";
  } catch {
    return "";
  }
}

function hrefAtual() {
  try {
    return globalThis.window?.location?.href || "";
  } catch {
    return "";
  }
}

/**
 * O que o Novo Anúncio abre ao montar (lido uma vez):
 *  { modo: "novo" | "ficha" | "rascunho", fichaId, rascunho, dados,
 *    ignorarEdicao, recarregarDaBase }
 */
export function decidirAberturaNovoAnuncio({ storage, href } = {}) {
  const s = armazenamento(storage);
  const endereco = href === undefined ? hrefAtual() : href;
  const marcador = lerJson(s, CHAVE_ABERTURA_NOVO_ANUNCIO);
  if (marcador && marcador.modo === "novo") {
    return { modo: "novo", fichaId: "", rascunho: null, dados: marcador.dados && typeof marcador.dados === "object" ? marcador.dados : null, ignorarEdicao: true, recarregarDaBase: false };
  }
  const pedida = fichaPedidaNoEndereco(endereco);
  if (pedida) {
    // Ficha pedida pelo endereço: só o rascunho DELA vale. Sem ele neste
    // navegador, a ficha é relida da base (nunca mostra outro anúncio).
    const rascunho = escolherRascunho(s, { fichaId: pedida });
    return { modo: "ficha", fichaId: pedida, rascunho, dados: null, ignorarEdicao: true, recarregarDaBase: !rascunho };
  }
  const flagNovo = (() => {
    try {
      return s === globalThis.localStorage ? deveIniciarNovaCriacaoMidia() : s.getItem("paiiaNovaCriacaoMidia") === "true";
    } catch {
      return false;
    }
  })();
  if (flagNovo) {
    return { modo: "novo", fichaId: "", rascunho: null, dados: null, ignorarEdicao: false, recarregarDaBase: false };
  }
  const rascunho = escolherRascunho(s);
  return { modo: "rascunho", fichaId: fichaDoRascunho(rascunho), rascunho, dados: null, ignorarEdicao: false, recarregarDaBase: false };
}

/** A abertura foi aplicada: o pedido de criação nova não vale de novo. */
export function consumirAberturaNovoAnuncio(storage) {
  const s = armazenamento(storage);
  try {
    s.removeItem(CHAVE_ABERTURA_NOVO_ANUNCIO);
    if (s === globalThis.localStorage) consumirNovaCriacaoMidia();
    else s.removeItem("paiiaNovaCriacaoMidia");
  } catch {
    // sem acesso ao navegador
  }
}

// ---------------------------------------------------------------
// Dono das fotos que estão na MEMÓRIA do App (fotosAnuncio).
// O Novo Anúncio marca a ficha dona sempre que muda; ao abrir outro
// anúncio, fotos de outro dono são trocadas pelas do rascunho aberto.
// ---------------------------------------------------------------
export function marcarDonoFotosAnuncio(id) {
  globalThis.__paiiaDonoFotosAnuncio = txt(id);
}
export function donoFotosAnuncio() {
  return globalThis.__paiiaDonoFotosAnuncio;
}
/** As fotos da memória podem continuar na tela que abre este rascunho? */
export function fotosDaMemoriaValem(rascunho) {
  const dono = donoFotosAnuncio();
  if (rascunho && rascunho.fotosDaFicha === true) return false;
  if (dono === undefined) return true; // memória recém-criada (F5/primeira abertura)
  return dono === fichaDoRascunho(rascunho);
}

/**
 * Tira do navegador o que é de OUTRO anúncio (preço/custo da precificação,
 * clip, projeto, foto pronta, peça de catálogo...). O anúncio pronto para a
 * Central só fica se for desta ficha.
 */
export function limparChavesDeOutroAnuncio(fichaId, storage) {
  const s = armazenamento(storage);
  const alvo = txt(fichaId);
  try {
    CHAVES_DE_UM_ANUNCIO.forEach((k) => s.removeItem(k));
    const pronto = lerJson(s, "anuncioProntoPublicacao");
    if (pronto && (!alvo || fichaDoRascunho(pronto) !== alvo)) s.removeItem("anuncioProntoPublicacao");
    const clipDe = s.getItem(CHAVE_CLIP_GERACAO_FICHA);
    if (!(clipDe !== null && alvo && clipDe === alvo)) CHAVES_STATUS_CLIP.forEach((k) => s.removeItem(k));
  } catch {
    // sem acesso ao navegador
  }
  try {
    if (globalThis.window) globalThis.window.__paiiaFotosNovoAnuncio = null;
  } catch {
    // ignora
  }
}

function sanitizarDados(dados) {
  if (!dados || typeof dados !== "object") return null;
  const saida = {};
  Object.entries(dados).forEach(([k, v]) => {
    if (v === undefined) return;
    if (typeof v === "string" && /^\s*(data:|blob:)/i.test(v)) return;
    saida[k] = v;
  });
  return saida;
}

/**
 * CRIAÇÃO NOVA (intenção a). O anúncio em andamento é GUARDADO (a Central
 * oferece "Retomar") e tudo o que é de um anúncio é limpo. `dados` (opcional:
 * peça do catálogo, código, preço sugerido, custo) vai junto com o pedido e
 * é aplicado SÓ neste anúncio novo.
 */
export function iniciarAnuncioNovo({ dados } = {}, storage) {
  const s = armazenamento(storage);
  try {
    guardarAnuncioEmAndamento(s);
  } catch {
    // sem espaço: segue
  }
  if (s === globalThis.localStorage) prepararNovaCriacaoMidia();
  else {
    CHAVES_ANUNCIO_LOCAL.forEach((k) => s.removeItem(k));
    s.setItem("paiiaNovaCriacaoMidia", "true");
  }
  limparChavesDeOutroAnuncio("", s);
  try {
    s.setItem(CHAVE_ABERTURA_NOVO_ANUNCIO, JSON.stringify({ modo: "novo", dados: sanitizarDados(dados), em: Date.now() }));
  } catch {
    // sem espaço: a flag de criação nova continua valendo
  }
}

function enderecoNovoAnuncio(id) {
  try {
    const w = globalThis.window;
    if (!w?.location?.href || !w.history) return;
    const url = new URL(w.location.href);
    url.searchParams.set("tela", "novoAnuncio");
    if (id) url.searchParams.set("ficha", id);
    else url.searchParams.delete("ficha");
    w.history.replaceState(w.history.state, "", url.toString());
  } catch {
    // sem acesso ao endereço
  }
}

/**
 * CONTINUAR UMA FICHA (intenção b). `rasc` = rascunhoDaFicha(...) (tem fichaId).
 * Grava o rascunho DELA (com as fotos dela), limpa o que é de outro anúncio
 * e aponta o endereço para ela. Lança erro se o navegador não gravar.
 */
export function abrirFichaNoNovoAnuncio(rasc, storage) {
  const s = armazenamento(storage);
  const id = fichaDoRascunho(rasc);
  const texto = JSON.stringify({ ...rasc, fichaIdPAIIA: id, fotosDaFicha: true, salvoEm: Date.now() });
  limparChavesDeOutroAnuncio(id, s);
  s.setItem(CHAVE_RASCUNHO_PRINCIPAL, texto);
  s.setItem(CHAVE_RASCUNHO_RESERVA, texto);
  consumirAberturaNovoAnuncio(s);
  enderecoNovoAnuncio(id);
  return id;
}

/**
 * "Retomar no Novo Anúncio" (anúncio guardado neste navegador): devolve SÓ
 * as chaves guardadas (as que ele não tinha são apagadas) e as fotos dele
 * substituem as da memória.
 */
export function retomarAnuncioGuardado(storage) {
  const s = armazenamento(storage);
  const guardado = lerAnuncioEmAndamento(s);
  if (!guardado) return false;
  const id = idValido(guardado.resumo?.fichaId) ? txt(guardado.resumo.fichaId) : "";
  limparChavesDeOutroAnuncio(id, s);
  CHAVES_ANUNCIO_LOCAL.forEach((k) => {
    if (!Object.prototype.hasOwnProperty.call(guardado.chaves || {}, k)) s.removeItem(k);
  });
  if (!restaurarAnuncioEmAndamento(s)) return false;
  [CHAVE_RASCUNHO_PRINCIPAL, CHAVE_RASCUNHO_RESERVA].forEach((k) => {
    const d = lerJson(s, k);
    if (d) {
      try {
        s.setItem(k, JSON.stringify({ ...d, fotosDaFicha: true }));
      } catch {
        // sem espaço
      }
    }
  });
  consumirAberturaNovoAnuncio(s);
  enderecoNovoAnuncio(id && escolherRascunho(s, { fichaId: id }) ? id : "");
  return true;
}

/** O anúncio pronto da Central é o MESMO anúncio em andamento neste navegador? */
export function anuncioProntoEhDoAnuncioEmAndamento(anuncio, storage) {
  const idPronto = fichaDoRascunho(anuncio);
  const idAndamento = fichaDoAnuncioEmAndamento(storage);
  return !(idPronto && idAndamento && idPronto !== idAndamento);
}

/** A precificação foi aberta a partir do anúncio em andamento (mesma ficha)? */
export function precificacaoDoAnuncioEmAndamento(dadosPrecificacao, storage) {
  const id = fichaDoRascunho(dadosPrecificacao);
  return Boolean(id) && id === fichaDoAnuncioEmAndamento(storage);
}

/** Ficha dona de uma geração de Clip ainda vale para o anúncio em andamento? */
export function clipEhDoAnuncioEmAndamento(fichaDona, storage) {
  // Sem dono registrado / anúncio ainda sem ficha: vale o anúncio em andamento.
  if (!idValido(fichaDona)) return true;
  return txt(fichaDona) === fichaDoAnuncioEmAndamento(storage);
}
