// =============================================================
// PAIIA — CONFIGURAÇÃO PERMANENTE: categoria preferida do Mercado Livre por tipo de peça.
//   Regras: src/services/categoriaPreferidaML.js · Testes: scripts/testes/categoriaReles.test.mjs
//
// (09/11) REGRA PERMANENTE — RELÉS AUTOMOTIVOS: Relé Automotivo, Auxiliar, de Ventoinha,
// de Bomba de Combustível ou 12V → "Eletrônicos, Áudio e Vídeo > Componentes Eletrônicos >
// Semicondutores > Relés".
//  • Aqui fica só o CAMINHO oficial: o ID é sempre consultado na API do Mercado Livre
//    (nada de código inventado) e conferido de novo (ativa, aceita anúncio, categoria final).
//  • Não vale para módulos, temporizadores, pisca/intermitente, soquetes ou chicotes.
//  • Nunca troca uma categoria já confirmada por você; você sempre pode escolher outra.
// =============================================================

export const PREFERENCIAS_CATEGORIA_ML = Object.freeze([
  Object.freeze({
    id: "reles_automotivos",
    rotulo: "Relés automotivos",
    niveis: Object.freeze(["Eletrônicos, Áudio e Vídeo", "Componentes Eletrônicos", "Semicondutores", "Relés"]),
    // Termos usados no preditor oficial do ML para achar o ID desta categoria.
    termosBusca: Object.freeze(["Relé 12V", "Relé", "Relés"]),
    // Produto principal (frases) e o que NÃO é relé para esta regra.
    principal: Object.freeze(["rele automotivo", "rele auxiliar", "rele de ventoinha", "rele da ventoinha", "rele ventoinha", "rele de bomba de combustivel", "rele da bomba de combustivel", "rele bomba de combustivel", "rele bomba combustivel", "rele 12v", "rele 12 v", "rele universal", "mini rele", "microrele", "micro rele"]),
    excluir: Object.freeze(["modulo", "temporizador", "timer", "pisca", "intermitente", "soquete", "chicote", "suporte", "base de rele", "base do rele", "porta rele", "caixa de rele", "caixa de fusivel", "caixa de fusiveis", "central", "sensor", "chave de seta", "regulador de voltagem", "regulador de tensao"]),
    // O tipo de produto desta categoria (atributo oficial "Tipo de produto") para relé.
    atributosFixos: Object.freeze({ CONTACTOR_AND_RELAY_TYPE: "Relé" }),
  }),
]);
