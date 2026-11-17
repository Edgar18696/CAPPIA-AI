// =============================================================
// PAIIA — Central de Promoções: CAMPANHAS (17/11/2026).
// Base permanente para campanhas (Black Friday, Natal, liquidações...).
// A Black Friday 2026 é a primeira: usa o calendário e as regras que já
// existem (10% Renault comprovada · 5% demais · nunca cumulativos).
// Funções puras: não alteram preço, anúncio nem estoque.
// =============================================================
import { CAMPANHA_BF } from "../blackFriday/calendario.js";
import { CONTAS_BLACK_FRIDAY } from "../blackFriday/contas.js";

const ms = (iso) => new Date(iso).getTime();

export const CAMPANHAS_PROMOCOES = Object.freeze([
  Object.freeze({
    id: CAMPANHA_BF.id,
    nome: CAMPANHA_BF.nome,
    inicio: CAMPANHA_BF.inicio,
    fim: CAMPANHA_BF.fim,
    contas: Object.freeze(CONTAS_BLACK_FRIDAY.map((c) => String(c.id))),
    regra: "renault10_demais5",
    descricao: "10% para aplicação Renault comprovada (inclusive paralelas) · 5% nos demais · nunca cumulativos.",
  }),
]);

export const METAS_SELECAO = Object.freeze([50, 100, 200]);

export const campanhaPorId = (id, lista = CAMPANHAS_PROMOCOES) => lista.find((c) => c.id === id) || null;

/** Duas campanhas com períodos que se cruzam (para impedir descontos conflitantes). */
export const periodosSeCruzam = (a, b) => !!a && !!b && ms(a.inicio) <= ms(b.fim) && ms(b.inicio) <= ms(a.fim);

/** Outras campanhas cujo período cruza com o da campanha informada. */
export const campanhasConflitantes = (id, lista = CAMPANHAS_PROMOCOES) => {
  const c = campanhaPorId(id, lista);
  return c ? lista.filter((o) => o.id !== c.id && periodosSeCruzam(c, o)) : [];
};
