// =============================================================
// PAIIA — Ranqueamento: JUNTAR a reanálise de UM anúncio ao relatório atual (19/11/2026).
// Função PURA. Regra do Edgar: reanalisar um anúncio NUNCA apaga nem substitui a
// lista atual. Só a linha daquele MLB é trocada (ou acrescentada, se ele era de uma
// rodada anterior); todos os outros anúncios, achados e números ficam como estavam.
// Os números do topo (resumo da rodada) NÃO são recalculados com esse anúncio.
// =============================================================
import { ordenarAchados, agruparFretesPorSku } from "./relatorio.js";

const txt = (v) => String(v ?? "").trim();
const idConta = (v) => txt(v?.id ?? v).replace(/\D/g, "");
const mlbDe = (v) => txt(v).toUpperCase();
const doMlb = (mlb) => (x) => mlbDe(x?.item_id) === mlb;
const semMlb = (mlb) => (x) => mlbDe(x?.item_id) !== mlb;

/**
 * @param {object|null} atual  relatório que está na tela (lista atual)
 * @param {object} novo        relatório da reanálise de UM anúncio
 * @param {string} mlb         o anúncio reanalisado
 * @returns {{ ok: true, rel: object, acrescentado: boolean } | { ok: false, erro: string }}
 */
export function juntarAnuncioAoRelatorio(atual, novo, mlb) {
  const m = mlbDe(mlb);
  const anuncio = (novo?.anuncios || []).find(doMlb(m));
  if (!anuncio) return { ok: false, erro: `A reanálise não trouxe o anúncio ${m}: a lista atual não foi alterada.` };
  if (!atual) return { ok: true, rel: { ...novo, anuncios: [{ ...anuncio, reanalisado_em: novo.gerado_em }] }, acrescentado: true };
  if (idConta(atual.conta) !== idConta(novo.conta)) return { ok: false, erro: "A reanálise é de outra conta: a lista atual não foi alterada." };

  const marcado = { ...anuncio, reanalisado_em: novo.gerado_em };
  const existia = (atual.anuncios || []).some(doMlb(m));
  const anuncios = existia ? atual.anuncios.map((a) => (doMlb(m)(a) ? marcado : a)) : [...(atual.anuncios || []), marcado];

  // Achados por assunto: tira os antigos DESTE anúncio e põe os novos; os dos outros ficam iguais.
  const novasPorChave = new Map((novo.secoes || []).map((s) => [s.chave, s]));
  const secoes = (atual.secoes || []).map((s) => ({ ...s, achados: [...(s.achados || []).filter(semMlb(m)), ...(novasPorChave.get(s.chave)?.achados || []).filter(doMlb(m))] }));
  for (const s of novo.secoes || []) {
    if (!secoes.some((x) => x.chave === s.chave)) secoes.push({ ...s, achados: (s.achados || []).filter(doMlb(m)) });
  }
  const trocar = (lista, novos) => ordenarAchados([...(lista || []).filter(semMlb(m)), ...(novos || []).filter(doMlb(m))]);
  const fretes = [...(atual.fretes_medidas || []).filter(semMlb(m)), ...(novo.fretes_medidas || []).filter(doMlb(m))];

  const rel = {
    ...atual,
    anuncios,
    secoes,
    prioridades: trocar(atual.prioridades, novo.prioridades),
    oportunidades: trocar(atual.oportunidades, novo.oportunidades),
    fretes_medidas: fretes,
    fretes_por_sku: atual.fretes_por_sku ? agruparFretesPorSku(fretes) : atual.fretes_por_sku,
    renault: [...(atual.renault || []).filter(semMlb(m)), ...(novo.renault || []).filter(doMlb(m))],
    reanalises_juntadas: [...(atual.reanalises_juntadas || []).filter((x) => x.mlb !== m), { mlb: m, em: novo.gerado_em, acrescentado: !existia }],
  };
  return { ok: true, rel, acrescentado: !existia };
}
