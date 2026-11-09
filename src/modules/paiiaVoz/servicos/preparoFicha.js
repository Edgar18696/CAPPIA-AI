// PAIIA Voz — Etapa 2: onde o preparo fica na ficha (função pura, testável).
import { registrarAtributo } from "../../../services/atributosCategoriaML.js";
/** Mescla o preparo em dados_conferencia.paiia_voz.preparo; não toca em mais nada. */
export function mesclarPreparo(dadosAtuais, preparo) {
  const d = dadosAtuais && typeof dadosAtuais === "object" ? dadosAtuais : {};
  return { ...d, paiia_voz: { ...(d.paiia_voz || {}), preparo } };
}

/**
 * (09/11) Atributo obrigatório da categoria (ex.: Modelo) na decisão da categoria confirmada.
 * Só muda paiia_voz.preparo.categoria.decisao.atributos: título, descrição, fotos, preço,
 * estoque, Bling e compatibilidades da ficha ficam como estão. Sem categoria confirmada = { erro }.
 */
export function atributoNoPreparo(dadosAtuais, { atributo, valueId = "", valueName = "", agora } = {}) {
  const ant = dadosAtuais?.paiia_voz?.preparo || {};
  const dec = ant?.categoria?.decisao;
  if (!dec?.confirmada?.id || !atributo?.id) return { erro: "Confirme a categoria antes de preencher os atributos." };
  const atributos = registrarAtributo(dec.atributos || null, { categoriaId: dec.confirmada.id, atributo, valueId, valueName, ...(agora ? { agora } : {}) });
  return mesclarPreparo(dadosAtuais, { ...ant, categoria: { ...ant.categoria, decisao: { ...dec, atributos } } });
}
