// =============================================================
// PAIZINHO — COMPLEMENTAR DADOS INSUFICIENTES DA BASE PAIIA
// -------------------------------------------------------------
// Quando a Base PAIIA encontra o código mas NÃO tem aplicação de
// veículo, a pesquisa em fontes originais pode completar. Antes de
// misturar, confere se a fonte externa fala da MESMA peça (fabricante
// e tipo de peça). Divergiu → nada é misturado nem gravado; fica para
// revisão.
// =============================================================

import { chaveFabricante, familiaPeca, STATUS_PESQUISA } from "./validarResultadoPesquisa.js";

function texto(v) {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}

/**
 * @param {object} validado  resultado da pesquisa externa
 * @param {object} pecaBase  registro principal da Base PAIIA
 * @returns {{ compativel: boolean, divergencias: string[] }}
 */
export function compararComBase(validado, pecaBase) {
  const c = validado?.confirmado || {};
  const divergencias = [];

  const fabBase = texto(pecaBase?.fabricante);
  const fabExt = texto(c.fabricante);
  if (fabBase && fabExt && chaveFabricante(fabBase) !== chaveFabricante(fabExt)) {
    divergencias.push(`Fabricante: Base PAIIA “${fabBase}” × fonte original “${fabExt}”`);
  }

  const pecaB = texto(pecaBase?.peca);
  const pecaE = texto(c.descricao);
  if (pecaB && pecaE && familiaPeca(pecaB) !== familiaPeca(pecaE)) {
    divergencias.push(`Tipo de peça: Base PAIIA “${pecaB}” × fonte original “${pecaE}”`);
  }

  return { compativel: divergencias.length === 0, divergencias };
}

/** A pesquisa externa trouxe algo que a base não tinha (aplicações)? */
export function complementoUtil(validado) {
  return (
    (validado?.status === STATUS_PESQUISA.ENCONTRADO ||
      validado?.status === STATUS_PESQUISA.CONFLITO) &&
    (validado?.confirmado?.aplicacoes || []).length > 0
  );
}
