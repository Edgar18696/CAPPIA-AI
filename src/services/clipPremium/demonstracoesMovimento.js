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
  "360": arquivosDemo("giro-360"),
  "giro-suave": arquivosDemo("giro-suave"),
  "zoom-cinematico": arquivosDemo("zoom-cinematico"),
  panoramico: arquivosDemo("panoramico"),
  "detalhes-produto": arquivosDemo("detalhes-produto"),
  "comercial-dinamico": arquivosDemo("comercial-dinamico"),
  "flutuacao-premium": arquivosDemo("flutuacao-premium"),
  "entrada-giro": arquivosDemo("entrada-giro"),
};

export function obterDemoMovimento(movimentoId) {
  const movimento = MOVIMENTOS_CLIP_PREMIUM.find((item) => item.id === movimentoId);
  return (
    DEMOS_MOVIMENTO_CLIP[movimentoId] ||
    DEMOS_MOVIMENTO_CLIP[movimento?.demo] ||
    DEMOS_MOVIMENTO_CLIP["giro-suave"]
  );
}
