// (10/11) Foto IA — MODO ECONÔMICO (padrão da tela Foto IA) com RECORTE LOCAL.
//
//   1) envio da foto original ao Storage (pasta "originais" — guardada à parte);
//   2) recorte NO PRÓPRIO APARELHO (recorteLocalFotoIA: modelo aberto rodando
//      no navegador) — sem Replicate, sem Gemini, sem créditos e sem a cota
//      mensal da função "foto-ia";
//   3) composição com os pixels ORIGINAIS (1200 × 1200, PNG, fundo branco,
//      peça centralizada sem deformar) e salvamento na Galeria PAIIA.
//
// O PAIIA Voz não usa este arquivo e continua com o caminho dele.

import { enviarOriginalFotoIA, comporESalvarFotoIA } from "./pipelineFotoIA.js";
import { recortarLocalmente, MODELO_PADRAO } from "./recorteLocalFotoIA.js";

export const MODO_ECONOMICO = "economico";
export const MODELO_ECONOMICO = `local:${MODELO_PADRAO}`;
export const TAMANHO_FOTO_ECONOMICA = 1200;

export function textoEtapaEconomica(etapa, indice, total, nome) {
  const n = `${indice + 1} de ${total}`;
  if (etapa === "enviando") return `⬆️ Guardando a original da foto ${n} (${nome})...`;
  if (etapa === "carregando-modelo") return "⏳ Preparando o recorte no aparelho (só na primeira foto)...";
  if (etapa === "compondo") return `📐 Centralizando foto ${n} em 1200 x 1200 com fundo...`;
  return `✂️ Removendo o fundo da foto ${n} no aparelho (${nome})...`;
}

// Processa UMA foto. Só devolve sucesso quando a foto final foi salva na
// Galeria; qualquer falha vira erro (nunca "concluída").
export async function produzirFotoEconomica({
  supabase,
  usuarioId,
  arquivo,
  fundo = "branco",
  signal,
  aoEtapa,
  deps = {},
}) {
  if (!arquivo) throw new Error("Arquivo da foto não está disponível neste item.");
  if (!usuarioId) throw new Error("Faça login primeiro.");
  const enviar = deps.enviarOriginal || enviarOriginalFotoIA;
  const recortar = deps.recortar || recortarLocalmente;
  const comporESalvar = deps.comporESalvar || comporESalvarFotoIA;
  const fundoFinal = fundo === "transparente" ? "transparente" : "branco";

  aoEtapa?.("enviando");
  const envio = await enviar({ supabase, usuarioId, arquivo, signal });

  aoEtapa?.("recortando");
  const recorte = await recortar(envio.arquivoEnviado || arquivo, { aoProgresso: (e) => aoEtapa?.(e) });

  aoEtapa?.("compondo");
  const salvo = await comporESalvar({
    supabase,
    usuarioId,
    arquivoEnviado: envio.arquivoEnviado || arquivo,
    urlOriginal: envio.url,
    recorteBlob: recorte.blob,
    fundo: fundoFinal,
    signal,
  });

  if (!salvo?.url) {
    throw new Error("A foto não foi salva na Galeria.");
  }

  return {
    modo: MODO_ECONOMICO,
    modelo: MODELO_ECONOMICO,
    imagemOriginal: envio.url || "",
    imagemProcessada: salvo.url,
    transparente: Boolean(salvo.transparente),
    baixaResolucao: Boolean(salvo.baixaResolucao),
    galeriaId: salvo.id || null,
  };
}
