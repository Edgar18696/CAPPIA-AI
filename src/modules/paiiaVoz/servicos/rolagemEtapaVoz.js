// =============================================================
// (09/11) PAIIA Voz — navegação de cima para baixo no celular.
// Ao trocar de etapa a tela abre no INÍCIO da etapa nova (não fica na rolagem da anterior),
// logo abaixo dos cabeçalhos fixos (SKU + assistente com o microfone), que nunca escondem
// o campo. Só rola a tela: não mexe na ficha, no microfone nem no salvamento.
// =============================================================

/** Cabeçalhos fixos (sticky) do PAIIA Voz, de cima para baixo. */
export const SELETOR_SKU_FIXO = "[data-pv-sku-fixo]";
export const SELETOR_ASSISTENTE = ".pr-assistente";
const FOLGA = 8;

/** Altura que os cabeçalhos fixos ocupam no topo (SKU + assistente empilhados). */
export function alturasFixas(doc = globalThis.document) {
  const alt = (sel) => {
    try {
      const el = doc?.querySelector?.(sel);
      return el ? Math.max(0, Math.round(el.getBoundingClientRect().height || 0)) : 0;
    } catch { return 0; }
  };
  const sku = alt(SELETOR_SKU_FIXO);
  const assistente = alt(SELETOR_ASSISTENTE);
  return { sku, assistente, total: sku + assistente };
}

/**
 * Posição (scrollY) que deixa o início do bloco logo abaixo dos cabeçalhos fixos.
 * topoBloco = getBoundingClientRect().top do bloco; scrollAtual = window.scrollY.
 */
export function posicaoInicioEtapa({ topoBloco = 0, scrollAtual = 0, alturaFixa = 0, folga = FOLGA } = {}) {
  return Math.max(0, Math.round(scrollAtual + topoBloco - alturaFixa - folga));
}

/** Um campo está escondido atrás do cabeçalho fixo (ou fora da tela, embaixo)? */
export function campoEscondido({ topo = 0, base = 0, alturaFixa = 0, alturaTela = 0 } = {}) {
  return topo < alturaFixa || (alturaTela > 0 && base > alturaTela);
}

/** Seletor do campo que está recebendo a fala (mesma regra do PAIIA Voz). */
export function seletorDoCampo(campoVoz = "", etapa = "") {
  if (campoVoz === "titulo") return "#pr-titulo";
  if (campoVoz) return `[data-pv-campo-direto="${String(campoVoz).replace(/"/g, "")}"]`;
  return `[data-pr-bloco="${etapa}"] .pr-campo`;
}

/** Leva a tela ao início da etapa (instantâneo; sem animação que brigue com o teclado). */
export function rolarParaInicioDaEtapa(etapa, { win = globalThis.window, doc = globalThis.document } = {}) {
  try {
    const bloco = doc?.querySelector?.(`[data-pr-bloco="${etapa}"]`);
    if (!bloco || !win) return false;
    // Início do bloco logo abaixo do SKU + assistente (que já mostra a pergunta da etapa).
    const y = posicaoInicioEtapa({ topoBloco: bloco.getBoundingClientRect().top, scrollAtual: win.scrollY || 0, alturaFixa: alturasFixas(doc).total });
    win.scrollTo({ top: y, left: 0, behavior: "auto" });
    return true;
  } catch { return false; }
}

/** Mostra o campo (ex.: o próximo da fala ou o que deu erro) sem deixá-lo atrás do cabeçalho fixo. */
export function mostrarCampo(seletor, { win = globalThis.window, doc = globalThis.document, sempre = false } = {}) {
  try {
    const el = doc?.querySelector?.(seletor);
    if (!el || !win) return false;
    const r = el.getBoundingClientRect();
    const { total } = alturasFixas(doc);
    if (!sempre && !campoEscondido({ topo: r.top, base: r.bottom, alturaFixa: total, alturaTela: win.innerHeight || 0 })) return false;
    win.scrollTo({ top: posicaoInicioEtapa({ topoBloco: r.top, scrollAtual: win.scrollY || 0, alturaFixa: total }), left: 0, behavior: "auto" });
    return true;
  } catch { return false; }
}
