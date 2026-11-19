// =============================================================
// PAIIA — Central do Paizinho: RETOMADA SEGURA da análise no navegador
// (13/11/2026; trazida no Pacote 1 de 19/11, agora por conta e por tipo de rodada).
// Se o login do PAIIA cair no meio (ex.: "Sair" usado em outro aparelho),
// a próxima rodada continua de onde parou:
//   - mesmo instante de referência (`agora`) → mesmo período de 30 dias;
//   - respostas do Mercado Livre que já deram certo são reaproveitadas
//     (só na memória desta página, nunca gravadas em lugar nenhum);
//   - o que falhou é lido de novo; o Bling já usa o cache de 24 h.
// Cada conta (e cada tipo de rodada: novos / reanálise) tem a sua memória:
// nada de uma conta é reaproveitado em outra.
// Puro (sem rede, sem React): roda igual no navegador e nos testes.
// =============================================================

export const VALIDADE_RETOMADA_MS = 3 * 60 * 60 * 1000; // 3 h

/** Nova memória de retomada para uma rodada que começa agora. */
export function novaRetomada({ agora, limiteItens, chave = "", criadoEm = Date.now() }) {
  return { agora, limiteItens, chave, criadoEm, respostas: new Map() };
}

/** A retomada guardada ainda serve para esta rodada? (mesma conta/tipo, mesmo limite e dentro de 3 h) */
export function retomadaValida(ret, { limiteItens, chave = "", agoraMs = Date.now() } = {}) {
  return Boolean(ret && ret.respostas instanceof Map && ret.limiteItens === limiteItens && ret.chave === chave && agoraMs - Number(ret.criadoEm || 0) < VALIDADE_RETOMADA_MS);
}

/**
 * Envolve a consulta de leitura do ML: o que já deu certo volta da memória;
 * falhas NUNCA são guardadas (são lidas de novo na retomada).
 */
export function consultaComRetomada(consultar, ret) {
  return async (caminho) => {
    if (ret.respostas.has(caminho)) return ret.respostas.get(caminho);
    const r = await consultar(caminho);
    if (r?.ok) ret.respostas.set(caminho, r);
    return r;
  };
}

/** A rodada parou porque o login caiu? (então vale oferecer "Continuar") */
export const parouPorLogin = (rel) => rel?.leitura_incompleta?.sessao_expirada === true;

/** Mensagem do login conferido ANTES de começar (não gasta tempo à toa). */
export const MSG_LOGIN_INVALIDO = "Seu login no PAIIA não vale mais (por exemplo, se alguém usou \"Sair\" em outro aparelho). Entre de novo e rode a análise.";
