// =============================================================
// PAIIA — Black Friday 2026: CALENDÁRIO OBRIGATÓRIO (regras do Edgar, 15/11/2026).
//   27/11/2026 00:00 (Brasília) → início, ativação das ofertas APROVADAS;
//   27 a 30/11/2026            → período promocional;
//   30/11/2026 23:59 (Brasília) → encerramento automático;
//   01/12/2026                 → todos os anúncios de novo no preço normal (conferência).
// Brasília = UTC−3 (sem horário de verão). Funções puras.
// =============================================================

export const CAMPANHA_BF = Object.freeze({
  id: "black-friday-2026",
  nome: "Black Friday 2026",
  inicio: "2026-11-27T00:00:00-03:00",
  fim: "2026-11-30T23:59:00-03:00",
  // Conferência do retorno ao preço normal (rede de segurança no servidor, Fase 3).
  conferencias: Object.freeze(["2026-12-01T00:15:00-03:00", "2026-12-01T08:00:00-03:00"]),
});

const ms = (iso) => new Date(iso).getTime();

/**
 * Em que momento da campanha estamos.
 * @returns {"preparacao"|"em_andamento"|"encerrada"}
 */
export function momentoDaCampanha(agora = new Date().toISOString(), c = CAMPANHA_BF) {
  const t = ms(agora);
  if (t < ms(c.inicio)) return "preparacao";
  if (t <= ms(c.fim)) return "em_andamento";
  return "encerrada";
}

/** Data/hora no horário de Brasília, ex.: "27/11/2026 00:00". */
export function dataHoraBrasilia(iso) {
  const d = new Date(ms(iso) - 3 * 3600000);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** Dias inteiros que faltam para o início (0 = começa hoje ou já começou). */
export function diasParaInicio(agora = new Date().toISOString(), c = CAMPANHA_BF) {
  return Math.max(0, Math.ceil((ms(c.inicio) - ms(agora)) / 86400000));
}
