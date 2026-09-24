// Foto IA — pipeline de uma foto (envio → recorte → composição → Galeria).
//
// A Edge Function "foto-ia" só devolve a máscara/recorte (remoção de fundo).
// A composição final é feita aqui no navegador com os pixels ORIGINAIS.

import {
  comporFotoFinal,
  normalizarArquivoParaEnvio,
} from "./composicaoFotoIA.js";

export const FUNCAO_FOTO_IA = "foto-ia";
export const TEMPO_LIMITE_RECORTE_MS = 140000;
export const TENTATIVAS_AUTOMATICAS = 3; // 1 + 2 novas tentativas
export const ESPERA_ENTRE_TENTATIVAS_MS = [0, 4000, 10000];

export class ErroFotoIA extends Error {
  constructor(mensagem, { codigo = "", status = 0, temporario = false } = {}) {
    super(mensagem);
    this.name = "ErroFotoIA";
    this.codigo = codigo;
    this.status = status;
    this.temporario = temporario;
  }
}

// Só erros de rede / instabilidade são repetidos automaticamente.
// Erros de regra (login, limite do mês, foto inválida) não.
export function erroEhTemporario({ status = 0, codigo = "", abortado = false } = {}) {
  if (abortado) return false;
  if (codigo === "LIMITE_MENSAL" || codigo === "NAO_AUTORIZADO" || codigo === "FOTO_INVALIDA") {
    return false;
  }
  if (!status) return true; // falha de rede
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export function chaveIdempotenciaFoto() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `foto-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function caminhoStorageDaUrl(url, bucket = "imagens") {
  const texto = String(url || "");
  const marcador = `/storage/v1/object/public/${bucket}/`;
  const indice = texto.indexOf(marcador);
  if (indice < 0) return "";
  return decodeURIComponent(texto.slice(indice + marcador.length).split("?")[0]);
}

function nomeSeguro(nome) {
  return (
    String(nome || "foto.jpg")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .slice(-80) || "foto.jpg"
  );
}

const esperar = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (!ms) return resolve();
    const id = setTimeout(resolve, ms);
    signal?.addEventListener?.(
      "abort",
      () => {
        clearTimeout(id);
        reject(new ErroFotoIA("Processamento cancelado.", { codigo: "CANCELADO" }));
      },
      { once: true }
    );
  });

function verificarCancelamento(signal) {
  if (signal?.aborted) {
    throw new ErroFotoIA("Processamento cancelado.", { codigo: "CANCELADO" });
  }
}

async function lerCorpoErro(error) {
  try {
    const resposta = error?.context;
    if (resposta && typeof resposta.json === "function") {
      return { status: resposta.status || 0, corpo: await resposta.clone().json() };
    }
  } catch {
    // corpo não era JSON
  }
  return { status: error?.context?.status || 0, corpo: null };
}

// 1) Envio da foto original (normalizada só se necessário).
export async function enviarOriginalFotoIA({ supabase, usuarioId, arquivo, signal }) {
  verificarCancelamento(signal);
  const preparado = await normalizarArquivoParaEnvio(arquivo);
  const caminho = `${usuarioId}/originais/${Date.now()}-${chaveIdempotenciaFoto()}-${nomeSeguro(
    preparado.arquivo.name
  )}`;

  const { error } = await supabase.storage.from("imagens").upload(caminho, preparado.arquivo, {
    upsert: false,
    contentType: preparado.arquivo.type || undefined,
  });

  if (error) {
    throw new ErroFotoIA(error.message || "Erro ao enviar a foto.", { temporario: true });
  }

  const { data } = supabase.storage.from("imagens").getPublicUrl(caminho);
  if (!data?.publicUrl) {
    throw new ErroFotoIA("Não foi possível gerar a URL da foto enviada.");
  }

  return { caminho, url: data.publicUrl, arquivoEnviado: preparado.arquivo };
}

// 2) Recorte (remoção de fundo) na Edge Function, com novas tentativas
//    automáticas SÓ para falhas temporárias e sempre com a MESMA chave
//    (a função não conta a mesma foto duas vezes).
export async function recortarFotoIA({ supabase, caminho, chave, signal, aoTentar }) {
  let ultimoErro = null;

  for (let tentativa = 0; tentativa < TENTATIVAS_AUTOMATICAS; tentativa += 1) {
    verificarCancelamento(signal);
    await esperar(ESPERA_ENTRE_TENTATIVAS_MS[tentativa] || 0, signal);
    aoTentar?.(tentativa + 1);

    const { data, error } = await supabase.functions.invoke(FUNCAO_FOTO_IA, {
      body: { caminho, chave },
      signal,
      timeout: TEMPO_LIMITE_RECORTE_MS,
    });

    if (!error && data?.sucesso && data?.recorteUrl) {
      return data;
    }

    let status = 0;
    let corpo = data;
    if (error) {
      const lido = await lerCorpoErro(error);
      status = lido.status;
      corpo = lido.corpo || corpo;
    }

    const abortado = Boolean(signal?.aborted);
    const codigo = corpo?.codigo || "";
    const mensagem =
      corpo?.erro ||
      (status === 0
        ? "Sem resposta do servidor (conexão ou tempo esgotado)."
        : "Não foi possível remover o fundo desta foto.");

    ultimoErro = new ErroFotoIA(mensagem, {
      codigo,
      status,
      temporario: erroEhTemporario({ status, codigo, abortado }),
    });

    if (abortado) {
      throw new ErroFotoIA("Processamento cancelado.", { codigo: "CANCELADO" });
    }
    if (!ultimoErro.temporario) {
      throw ultimoErro;
    }
  }

  throw ultimoErro || new ErroFotoIA("Não foi possível processar a foto.");
}

// 3) Composição + 4) salvamento na Galeria. Em caso de falha no banco, o
//    PNG enviado é removido (sem arquivos órfãos).
export async function comporESalvarFotoIA({
  supabase,
  usuarioId,
  arquivoEnviado,
  urlOriginal,
  recorteUrl,
  fundo,
  signal,
}) {
  verificarCancelamento(signal);

  const resposta = await fetch(recorteUrl, { signal });
  if (!resposta.ok) {
    throw new ErroFotoIA("Não foi possível baixar o recorte da foto.", {
      status: resposta.status,
      temporario: true,
    });
  }
  const recorte = await resposta.blob();

  const final = await comporFotoFinal({ original: arquivoEnviado, recorte, fundo });
  verificarCancelamento(signal);

  const caminhoFinal = `${usuarioId}/processadas/foto-ia-${Date.now()}-${chaveIdempotenciaFoto()}.png`;
  const { error: erroUpload } = await supabase.storage
    .from("imagens")
    .upload(caminhoFinal, final.blob, { contentType: "image/png", upsert: false });

  if (erroUpload) {
    throw new ErroFotoIA(erroUpload.message || "Não foi possível salvar a foto final.", {
      temporario: true,
    });
  }

  const { data: publico } = supabase.storage.from("imagens").getPublicUrl(caminhoFinal);
  const urlFinal = publico?.publicUrl;

  const { data: linha, error: erroBanco } = await supabase
    .from("processamentos")
    .insert([
      {
        user_id: usuarioId,
        imagem_original: urlOriginal || null,
        imagem_processada: urlFinal,
        status: "processado",
        tipo: "foto",
      },
    ])
    .select("id, created_at")
    .single();

  if (erroBanco || !urlFinal) {
    await supabase.storage.from("imagens").remove([caminhoFinal]).catch(() => {});
    throw new ErroFotoIA(
      erroBanco?.message || "A foto foi processada, mas não entrou na Galeria.",
      { temporario: true }
    );
  }

  return {
    id: linha?.id || null,
    criadaEm: linha?.created_at || new Date().toISOString(),
    url: urlFinal,
    caminho: caminhoFinal,
    baixaResolucao: final.baixaResolucao,
    transparente: fundo === "transparente",
  };
}

// Pipeline completo de UMA foto. "estado" guarda o que já foi feito para que
// o retry individual continue de onde parou (sem reenviar nem recobrar).
export async function processarUmaFotoIA({
  supabase,
  usuarioId,
  item,
  fundo = "branco",
  signal,
  aoEtapa,
}) {
  const estado = { ...(item.estado || {}) };
  if (!estado.chave) estado.chave = chaveIdempotenciaFoto();

  if (!estado.caminhoOriginal) {
    aoEtapa?.("enviando", estado);
    const envio = await enviarOriginalFotoIA({
      supabase,
      usuarioId,
      arquivo: item.file,
      signal,
    });
    estado.caminhoOriginal = envio.caminho;
    estado.urlOriginal = envio.url;
    estado.arquivoEnviado = envio.arquivoEnviado;
  }

  aoEtapa?.("recortando", estado);
  const recorte = await recortarFotoIA({
    supabase,
    caminho: estado.caminhoOriginal,
    chave: estado.chave,
    signal,
    aoTentar: (n) => aoEtapa?.(n > 1 ? `recortando-tentativa-${n}` : "recortando", estado),
  });
  estado.uso = recorte.uso || null;

  aoEtapa?.("compondo", estado);
  let salvo = null;
  for (let tentativa = 0; tentativa < 2; tentativa += 1) {
    try {
      salvo = await comporESalvarFotoIA({
        supabase,
        usuarioId,
        arquivoEnviado: estado.arquivoEnviado || item.file,
        urlOriginal: estado.urlOriginal,
        recorteUrl: recorte.recorteUrl,
        fundo,
        signal,
      });
      break;
    } catch (erro) {
      if (tentativa === 1 || !erro?.temporario || signal?.aborted) throw erro;
      await esperar(3000, signal);
    }
  }

  return { estado, ...salvo };
}
