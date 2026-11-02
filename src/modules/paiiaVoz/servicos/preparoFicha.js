// PAIIA Voz — Etapa 2: onde o preparo fica na ficha (função pura, testável).
/** Mescla o preparo em dados_conferencia.paiia_voz.preparo; não toca em mais nada. */
export function mesclarPreparo(dadosAtuais, preparo) {
  const d = dadosAtuais && typeof dadosAtuais === "object" ? dadosAtuais : {};
  return { ...d, paiia_voz: { ...(d.paiia_voz || {}), preparo } };
}
