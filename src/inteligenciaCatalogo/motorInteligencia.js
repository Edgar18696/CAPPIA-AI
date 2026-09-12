/*
 * ============================================================
 * PAIIA AI
 * MOTOR DE INTELIGÊNCIA — COMPATIBILIDADE LEGADA
 * ============================================================
 *
 * A busca de aplicações possui uma única fonte oficial:
 *
 * src/inteligenciaCatalogo/buscarAplicacoes.js
 *
 * Este arquivo existe apenas para manter compatibilidade
 * com módulos antigos que ainda importam motorInteligencia.js.
 * ============================================================
 */

export {
  buscarAplicacoes,
} from "./buscarAplicacoes";/*
 * ============================================================
 * PAIIA AI
 * MOTOR DE INTELIGÊNCIA — COMPATIBILIDADE
 * ============================================================
 *
 * REGRA DEFINITIVA:
 *
 * Existe apenas UMA função responsável pela busca
 * das aplicações:
 *
 * src/inteligenciaCatalogo/buscarAplicacoes.js
 *
 * Este arquivo serve somente como ponte para módulos
 * antigos que ainda importam:
 *
 * motorInteligencia.js
 *
 * NÃO criar outra consulta ao Supabase neste arquivo.
 * NÃO duplicar buscarAplicacoes aqui.
 * ============================================================
 */

export {
  buscarAplicacoes,
} from "./buscarAplicacoes";