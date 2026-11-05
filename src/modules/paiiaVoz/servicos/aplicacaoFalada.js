// =============================================================
// PAIIA Voz — (Compatibilidades) organiza uma fala natural nos campos
// Montadora, Modelo, Motor, Ano inicial e Ano final. Usa o MESMO intérprete
// da conversa (entenderTrecho); só limpa vírgulas e a palavra "motor".
// Só PREENCHE os campos: nada vira aplicação confirmada sem você tocar em Adicionar.
// =============================================================
import { entenderTrecho } from "./conversaVoz.js";

const limpar = (t) => String(t || "").replace(/[,;]/g, " ").replace(/\.(?!\d)/g, " ").replace(/\bmotor(iza[cç][aã]o)?\b/gi, " ").replace(/\s+/g, " ").trim();
const ANO = /\b(19[5-9]\d|20[0-4]\d)\b/g;

export function lerAplicacaoFalada(fala) {
  const t = limpar(fala);
  if (!t) return {};
  const r = entenderTrecho(t, {});
  const v = r.itens.find((i) => i.campo === "veiculo")?.valor || {};
  const anos = r.itens.find((i) => i.campo === "anos")?.valor || null;
  const out = {};
  if (v.montadora) out.montadora = v.montadora;
  if (v.modelos?.length) out.modelo = v.modelos[0];
  if (v.motores?.length) out.motor = v.motores[0];
  if (anos?.inicio) { out.anoInicio = String(anos.inicio); if (anos.fim && anos.fim !== anos.inicio) out.anoFim = String(anos.fim); }
  else { const a = t.match(ANO) || []; if (a[0]) out.anoInicio = a[0]; if (a[1] && a[1] !== a[0]) out.anoFim = a[1]; }
  return out;
}

/** Valor de UM campo falado (microfone ao lado do campo). Ano: só os 4 dígitos ditos. */
export function valorDoCampoFalado(campo, fala) {
  const t = limpar(fala);
  if (!t) return "";
  if (campo === "anoInicio" || campo === "anoFim") return (t.match(ANO) || [""])[0];
  if (campo === "motor") return (t.match(/\b\d\.\d(\s*\d{1,2}\s*v)?\b/i) || [t])[0].replace(/\s+/g, " ").toUpperCase().replace("V", "V");
  if (campo === "montadora") { const v = lerAplicacaoFalada(t); return v.montadora || t.replace(/\b\p{L}/gu, (c) => c.toUpperCase()); }
  return t.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

export const ORDEM_CAMPOS_VEICULO = ["montadora", "modelo", "motor", "anoInicio", "anoFim"];
export function proximoCampoVeiculo(veic, depoisDe) {
  const i = ORDEM_CAMPOS_VEICULO.indexOf(depoisDe);
  return ORDEM_CAMPOS_VEICULO.slice(i + 1).find((c) => !String(veic?.[c] || "").trim()) || "";
}
