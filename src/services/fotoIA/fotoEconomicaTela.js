// (10/11) Foto IA — MODO ECONÔMICO (padrão da tela Foto IA).
//
// Usa o mesmo caminho já usado pelo PAIIA Voz:
//   envio da original → recorte na Edge Function "foto-ia" (remoção de fundo,
//   sem IA generativa) → composição no navegador com os pixels ORIGINAIS
//   (1200 × 1200, PNG, peça centralizada sem deformar) → Galeria PAIIA.
//
// Diferença para o Voz: aqui o recorte é tentado UMA vez só (sem novas
// tentativas automáticas que possam gerar cobrança). A original e a tratada
// ficam separadas (pastas "originais" e "processadas" + linha na Galeria).

import { processarUmaFotoIA } from "./pipelineFotoIA.js";

export const MODO_ECONOMICO = "economico";
export const MODELO_ECONOMICO = "recraft-remove-background";
export const TENTATIVAS_RECORTE_ECONOMICO = 1;
export const TAMANHO_FOTO_ECONOMICA = 1200;

export function textoEtapaEconomica(etapa, indice, total, nome) {
  const n = `${indice + 1} de ${total}`;
  if (etapa === "enviando") return `⬆️ Enviando foto ${n} (${nome})...`;
  if (etapa === "compondo") return `📐 Centralizando foto ${n} em 1200 x 1200 com fundo...`;
  return `✂️ Removendo o fundo da foto ${n} (${nome})...`;
}

// Processa UMA foto no Modo Econômico. Só devolve sucesso quando a foto final
// foi salva na Galeria; qualquer falha vira erro (nunca "concluída").
export async function produzirFotoEconomica({
  supabase,
  usuarioId,
  arquivo,
  fundo = "branco",
  signal,
  aoEtapa,
  processarUma = processarUmaFotoIA,
}) {
  if (!arquivo) throw new Error("Arquivo da foto não está disponível neste item.");
  if (!usuarioId) throw new Error("Faça login primeiro.");

  const resultado = await processarUma({
    supabase,
    usuarioId,
    item: { file: arquivo },
    fundo: fundo === "transparente" ? "transparente" : "branco",
    signal,
    aoEtapa,
    tentativasRecorte: TENTATIVAS_RECORTE_ECONOMICO,
  });

  if (!resultado?.url) {
    throw new Error("A foto não foi salva na Galeria.");
  }

  return {
    modo: MODO_ECONOMICO,
    modelo: MODELO_ECONOMICO,
    imagemOriginal: resultado.estado?.urlOriginal || "",
    imagemProcessada: resultado.url,
    transparente: Boolean(resultado.transparente),
    baixaResolucao: Boolean(resultado.baixaResolucao),
    galeriaId: resultado.id || null,
  };
}
