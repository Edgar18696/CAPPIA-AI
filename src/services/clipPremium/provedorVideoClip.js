import { chamarGerarClipProduto } from "../clipProdutoPipeline";

export const CUSTO_CREDITOS_CLIP_PREMIUM = null;

export function rotuloCustoClipPremium() {
  if (CUSTO_CREDITOS_CLIP_PREMIUM == null) {
    return "Clip Premium • — créditos";
  }
  return `Clip Premium • ${CUSTO_CREDITOS_CLIP_PREMIUM} créditos`;
}

const PROVEDOR_VIDEO_INTERNO = {
  id: "paiia-interno",
  rotuloPublico: "Clip Premium",
  gerar: chamarGerarClipProduto,
};

let provedorAtivo = PROVEDOR_VIDEO_INTERNO;

export function obterProvedorVideoClip() {
  return {
    id: provedorAtivo.id,
    rotuloPublico: provedorAtivo.rotuloPublico,
  };
}

export function definirProvedorVideoClip(provedor) {
  if (!provedor?.gerar) {
    return;
  }
  provedorAtivo = provedor;
}

export async function gerarVideoClipPremium(payload) {
  return provedorAtivo.gerar({
    ...payload,
    modalidade: "clip_premium",
    provedorPublico: "Clip Premium",
  });
}
