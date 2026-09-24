import { MOVIMENTOS_CLIP_PREMIUM } from "./catalogoMovimentos";

const PASTA_DEMOS = "/clip-premium/demos";

export const PREFERIR_VIDEO_DEMONSTRACAO = false;

function arquivosDemo(arquivoBase) {
  return {
    videoWebm: `${PASTA_DEMOS}/${arquivoBase}.webm`,
    videoMp4: `${PASTA_DEMOS}/${arquivoBase}.mp4`,
    foto: `${PASTA_DEMOS}/bico-injetor.png`,
    svg: `${PASTA_DEMOS}/${arquivoBase}.svg`,
    css: arquivoBase,
    usarVideo: PREFERIR_VIDEO_DEMONSTRACAO,
  };
}

export const DEMOS_MOVIMENTO_CLIP = {
  // Único movimento oficial: slide lateral 10–20° + push-in. Sem rotação.
  "slide-push-in": arquivosDemo("slide-push-in"),
};

export function obterDemoMovimento(movimentoId) {
  const movimento = MOVIMENTOS_CLIP_PREMIUM.find((item) => item.id === movimentoId);
  return (
    DEMOS_MOVIMENTO_CLIP[movimentoId] ||
    DEMOS_MOVIMENTO_CLIP[movimento?.demo] ||
    DEMOS_MOVIMENTO_CLIP["slide-push-in"]
  );
}
