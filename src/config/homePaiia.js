// =============================================================
// PAIIA — cartões que NÃO aparecem na página inicial (23/10/2026).
//   Testes: scripts/testes/homeInterface.test.mjs
// Tirar um cartão daqui só o esconde da Home: as telas, os arquivos, as
// funções do servidor e os dados continuam existindo e funcionando pelos
// outros caminhos (ex.: Galeria → Banner, Conferência → Mídias). Para o
// cartão voltar, basta tirar o nome da lista.
// =============================================================
export const TELAS_FORA_DA_HOME = Object.freeze([
  "midiasAppia", // Mídias PAIIA
  "bannerStudio", // Banner Express IA
  "criarMascotePaizinho", // Paizinho — Criar meu Mascote
]);

export function cartaoVisivelNaHome(tela) {
  return !TELAS_FORA_DA_HOME.includes(String(tela || ""));
}
