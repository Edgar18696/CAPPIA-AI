// =============================================================
// PAIIA Voz — Passo 7 (Finalizar) no celular: UMA decisão simples.
//  - Ficha incompleta → "Completar ficha", indo direto à 1ª etapa pendente.
//  - Ficha completa   → "Continuar para Publicação" com a MESMA ficha da conta
//    (a Publicação abre ?ficha=<ID>: fotos, código e dados salvos nela).
// Nunca publica sozinha: a publicação real continua exigindo a autorização final.
// =============================================================
import { ETAPAS, ROTULOS_ETAPAS } from "./rascunhoRapido.js";
import { estadoEtapasVoz } from "./completarVoz.js";

/** Etapas que precisam estar concluídas antes de seguir (todas menos a própria Finalizar). */
export const ETAPAS_OBRIGATORIAS = ETAPAS.filter((e) => e !== "finalizar");

/**
 * @returns {{ acao: "completar", etapa: string, rotulo: string, faltam: string[] }
 *          | { acao: "publicacao", faltam: [] }}
 */
export function decidirPassoFinal(ficha, { fotos = 0 } = {}) {
  const est = estadoEtapasVoz(ficha, { fotos, etapaAtual: "finalizar", ordem: ETAPAS });
  const faltam = ETAPAS_OBRIGATORIAS.filter((e) => est[e] !== "ok");
  if (faltam.length) {
    return { acao: "completar", etapa: faltam[0], rotulo: ROTULOS_ETAPAS[faltam[0]] || faltam[0], faltam: faltam.map((e) => ROTULOS_ETAPAS[e] || e) };
  }
  return { acao: "publicacao", faltam: [] };
}

/** Endereço da Publicação para UMA ficha da conta (o mesmo do "Abrir" da Central). */
export function enderecoPublicacaoDaFicha(href, fichaId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(fichaId || ""))) return "";
  const url = new URL(href);
  url.searchParams.set("ficha", fichaId);
  url.searchParams.set("tela", "mercadoLivreTeste");
  url.hash = "";
  return url.toString();
}
