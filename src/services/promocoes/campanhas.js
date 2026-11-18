// =============================================================
// PAIIA — Central de Promoções: CAMPANHAS (17–18/11/2026).
// Base permanente para campanhas (Black Friday, Natal, liquidações...).
// - A Black Friday 2026 é a primeira e mantém a REGRA FIXA aprovada:
//   10% Renault comprovada (inclusive paralelas) · 5% demais · nunca cumulativos.
// - Campanhas novas usam desconto PERCENTUAL: 5, 10, 15, 20% ou personalizado,
//   com desconto individual por produto quando necessário (na seleção).
// - Seleção, desconto, aprovação e ativação são passos separados: salvar uma
//   campanha (rascunho) não ativa nada e não altera preço nenhum.
// LIMITAÇÃO: rascunhos ficam só neste navegador; a tabela no Supabase depende de autorização.
// =============================================================
import { CAMPANHA_BF } from "../blackFriday/calendario.js";
import { CONTAS_BLACK_FRIDAY } from "../blackFriday/contas.js";

const ms = (iso) => new Date(iso).getTime();
const txt = (v) => (v === null || v === undefined ? "" : String(v)).trim();

export const REGRAS = Object.freeze({ RENAULT_BF: "renault_bf", PERCENTUAL: "percentual" });
export const OPCOES_DESCONTO = Object.freeze([5, 10, 15, 20]);
/** Limites do "Desconto individual" do ML: de 5% a menos de 80%, por no máximo 14 dias. */
export const LIMITES_DESCONTO = Object.freeze({ minimoPct: 5, maximoPct: 79, prazoMaximoDias: 14 });
export const CONTAS_PROMOCOES = CONTAS_BLACK_FRIDAY;

export const CAMPANHA_BLACK_FRIDAY = Object.freeze({
  id: CAMPANHA_BF.id,
  nome: CAMPANHA_BF.nome,
  inicio: CAMPANHA_BF.inicio,
  fim: CAMPANHA_BF.fim,
  contas: Object.freeze(CONTAS_BLACK_FRIDAY.map((c) => String(c.id))),
  regra: REGRAS.RENAULT_BF,
  desconto_pct: null,
  descontos_por_produto: false, // regra aprovada: sem desconto individual na BF 2026
  situacao: "oficial",
  descricao: "10% para aplicação Renault comprovada (inclusive paralelas) · 5% nos demais · nunca cumulativos.",
});

/** Campanhas fixas do sistema (hoje só a Black Friday 2026). */
export const CAMPANHAS_PROMOCOES = Object.freeze([CAMPANHA_BLACK_FRIDAY]);

export const METAS_SELECAO = Object.freeze([1, 10, 50, 100, 200]);
/** (18/11) Conta principal de trabalho: REVELAÇÃO (as outras continuam disponíveis). */
export const CONTA_PRINCIPAL = "2412238242";

export const campanhaPorId = (id, lista = CAMPANHAS_PROMOCOES) => lista.find((c) => c.id === id) || null;

/** Duas campanhas com períodos que se cruzam (para impedir descontos conflitantes). */
export const periodosSeCruzam = (a, b) => !!a && !!b && ms(a.inicio) <= ms(b.fim) && ms(b.inicio) <= ms(a.fim);

/** Outras campanhas cujo período cruza com o da campanha informada. */
export const campanhasConflitantes = (id, lista = CAMPANHAS_PROMOCOES) => {
  const c = campanhaPorId(id, lista);
  return c ? lista.filter((o) => o.id !== c.id && periodosSeCruzam(c, o)) : [];
};

/** Percentual válido para o desconto individual do ML (inteiro ou com 1 casa). */
export function validarPct(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  if (!Number.isFinite(n)) return { ok: false, motivo: "Informe o desconto em %." };
  const p = Math.round(n * 10) / 10;
  if (p < LIMITES_DESCONTO.minimoPct || p > LIMITES_DESCONTO.maximoPct) return { ok: false, motivo: `O desconto individual do ML vai de ${LIMITES_DESCONTO.minimoPct}% a ${LIMITES_DESCONTO.maximoPct}%.` };
  return { ok: true, pct: p };
}

/** Converte "AAAA-MM-DDTHH:MM" (horário de Brasília, campo da tela) em ISO com -03:00. */
export const dataLocalParaIso = (v) => (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(txt(v)) ? `${txt(v)}:00-03:00` : null);
/** Converte ISO para "AAAA-MM-DDTHH:MM" em Brasília (para o campo da tela). */
export function isoParaDataLocal(iso) {
  const t = ms(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t - 3 * 3600000);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

const slug = (s) => txt(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/**
 * Confere e monta uma campanha nova (rascunho, desconto percentual).
 * @param {{ id?, nome, inicio, fim, contas: string[], desconto_pct, descontos_por_produto? }} dados  inicio/fim em ISO
 * @param {Array} existentes todas as campanhas conhecidas (para nome e datas)
 */
export function validarCampanha(dados, existentes = CAMPANHAS_PROMOCOES, { agora = new Date().toISOString() } = {}) {
  const nome = txt(dados?.nome);
  if (nome.length < 3) return { ok: false, motivo: "Dê um nome à campanha (ex.: Natal 2026)." };
  const ini = ms(dados.inicio), fim = ms(dados.fim);
  if (!Number.isFinite(ini) || !Number.isFinite(fim)) return { ok: false, motivo: "Informe início e encerramento (horário de Brasília)." };
  if (fim <= ini) return { ok: false, motivo: "O encerramento precisa ser depois do início." };
  if (fim - ini > LIMITES_DESCONTO.prazoMaximoDias * 86400000) return { ok: false, motivo: `O desconto individual do ML dura no máximo ${LIMITES_DESCONTO.prazoMaximoDias} dias.` };
  if (fim <= ms(agora)) return { ok: false, motivo: "O encerramento já passou." };
  const contas = [...new Set((dados.contas || []).map((c) => txt(c).replace(/\D/g, "")))].filter((c) => CONTAS_PROMOCOES.some((x) => x.id === c));
  if (!contas.length) return { ok: false, motivo: "Escolha ao menos uma conta (LOJA ONLINE, CIEBR ou REVELAÇÃO)." };
  const v = validarPct(dados.desconto_pct);
  if (!v.ok) return v;
  const id = txt(dados.id) || `${slug(nome) || "campanha"}-${ini.toString(36)}`;
  if (id === CAMPANHA_BLACK_FRIDAY.id) return { ok: false, motivo: "A Black Friday 2026 não é editada por aqui (regras já aprovadas)." };
  const nova = !txt(dados.id);
  if (existentes.some((c) => (nova || c.id !== id) && slug(c.nome) === slug(nome))) return { ok: false, motivo: "Já existe uma campanha com esse nome." };
  const campanha = {
    id, nome, inicio: new Date(ini).toISOString(), fim: new Date(fim).toISOString(), contas,
    regra: REGRAS.PERCENTUAL, desconto_pct: v.pct, descontos_por_produto: dados.descontos_por_produto !== false,
    situacao: "rascunho", descricao: `${String(v.pct).replace(".", ",")}% na campanha${dados.descontos_por_produto !== false ? " (desconto individual por produto permitido)" : ""}.`,
  };
  const cruzadas = existentes.filter((c) => c.id !== id && periodosSeCruzam(campanha, c)).map((c) => c.nome);
  return { ok: true, campanha, avisos: cruzadas.length ? [`Datas cruzam com: ${cruzadas.join(", ")}. O mesmo anúncio não poderá estar nas duas.`] : [] };
}

/** Rascunhos de campanhas do usuário (só neste navegador). */
export const chaveCampanhas = (usuarioId) => `paiiaPromocoes:campanhas:${txt(usuarioId) || "sem-usuario"}`;
export function armazemCampanhas(storage, usuarioId) {
  const ler = () => { try { const v = JSON.parse(storage?.getItem(chaveCampanhas(usuarioId)) || "null"); return Array.isArray(v?.campanhas) ? v.campanhas : []; } catch { return []; } };
  const gravar = (lista) => { try { storage.setItem(chaveCampanhas(usuarioId), JSON.stringify({ tipo: "paiia-promocoes-campanhas", versao: 1, campanhas: lista })); return true; } catch { return false; } };
  return {
    rascunhos: () => ler().filter((c) => c?.regra === REGRAS.PERCENTUAL && c.id !== CAMPANHA_BLACK_FRIDAY.id),
    /** Todas: fixas do sistema + rascunhos do usuário. */
    todas() { return [...CAMPANHAS_PROMOCOES, ...this.rascunhos()]; },
    salvar(dados, opcoes) {
      const v = validarCampanha(dados, this.todas(), opcoes);
      if (!v.ok) return v;
      const lista = ler().filter((c) => c.id !== v.campanha.id);
      lista.push({ ...v.campanha, salvo_em: new Date().toISOString() });
      return gravar(lista) ? v : { ok: false, motivo: "Não foi possível gravar neste navegador." };
    },
    excluir(id) { if (id === CAMPANHA_BLACK_FRIDAY.id) return false; return gravar(ler().filter((c) => c.id !== id)); },
  };
}

/**
 * Desconto de UM anúncio na campanha. null = regra fixa da Black Friday (classe Renault/demais).
 * Campanha percentual: desconto individual do produto (se permitido) ou o da campanha.
 */
export function descontoDoAnuncio(campanha, registroSelecao) {
  if (!campanha || campanha.regra !== REGRAS.PERCENTUAL) return null;
  const proprio = campanha.descontos_por_produto && registroSelecao && registroSelecao.desconto_pct !== null && registroSelecao.desconto_pct !== undefined ? Number(registroSelecao.desconto_pct) : null;
  return Number.isFinite(proprio) && proprio > 0 ? proprio : Number(campanha.desconto_pct);
}
