// (09/11) Galeria só com o trabalho de fotos dos produtos.
// Mascotes, Banners e Vídeos saem da VISTA da Galeria normal: arquivos, registros,
// telas e serviços continuam existindo (nada é apagado; volta incluindo a aba aqui).
export const ABAS_GALERIA = [{ valor: "foto", label: "📸 Fotos" }];

export const ABAS_FORA_DA_GALERIA = ["mascote", "banner", "video"];

/** Filtro que a Galeria normal usa: só abas visíveis; o resto cai em Fotos. */
export function filtroDaGaleriaNormal(filtro) {
  return ABAS_GALERIA.some((a) => a.valor === filtro) ? filtro : "foto";
}

/** Barra de abas só aparece quando houver mais de uma aba para escolher. */
export const mostrarBarraDeAbas = () => ABAS_GALERIA.length > 1;
