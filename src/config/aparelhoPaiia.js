// =============================================================
// PAIIA — navegação por aparelho (24/11/2026). Só interface.
//   Testes: scripts/testes/navegacaoAparelho.test.mjs
// Computador: o PAIIA Voz fica fora da Home (a programação continua inteira);
//   "Criar Próximo Anúncio" abre o Criar Anúncio tradicional com uma ficha limpa.
// Celular (tela de toque): PAIIA Voz e Criar Anúncio na Home;
//   "Criar Próximo Anúncio" abre o PAIIA Voz com uma ficha limpa.
// Celular = ponteiro "coarse" (toque), o mesmo critério que o PAIIA Voz já usa.
// =============================================================

export function ehCelular(mm = globalThis.matchMedia) {
  try {
    return Boolean(mm?.("(pointer: coarse)")?.matches);
  } catch {
    return false;
  }
}

/** Cartões da Home que dependem do aparelho. */
export function cartaoVisivelNoAparelho(tela, celular = ehCelular()) {
  if (String(tela || "") === "paiiaVoz") return Boolean(celular);
  return true;
}

/** Tela aberta por "Criar Próximo Anúncio". */
export function telaDoProximoAnuncio(celular = ehCelular()) {
  return celular ? "paiiaVoz" : "novoAnuncio";
}
