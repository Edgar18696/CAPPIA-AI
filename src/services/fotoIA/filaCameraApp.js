// (09/11) Fila da câmera do Foto IA no app: uma por usuário, guardada no IndexedDB
// deste aparelho ("paiia-foto-camera"). Usada pela tela (Tirar Foto) e pelo
// processamento em segundo plano (FotosCameraSegundoPlano). Ver fotoCameraGaleria.js.
import { supabase } from "../../supabase";
import { armazenamentoIndexedDB, armazenamentoMemoria } from "../../modules/paiiaVoz/servicos/fotosVozLocal.js";
import { recortarFotoIA } from "./pipelineFotoIA.js";
import { recortarLocalmente } from "./recorteLocalFotoIA.js";
import { recortarPhotoroom, recortarComReserva } from "./recortePhotoroom.js";
import { comporFotoFinal, normalizarArquivoParaEnvio } from "./composicaoFotoIA.js";
import { criarFilaCamera, retomarDeOutrosAparelhos, salvarOriginalNaGaleria, tratarFotoDaGaleria } from "./fotoCameraGaleria.js";

export const EVENTO_CAMERA = "paiia-foto-camera";
const filas = new Map();
const jaRetomadas = new Set();

export async function baixar(url) {
  const r = await fetch(url);
  if (!r.ok) throw Object.assign(new Error(`não consegui baixar a imagem (HTTP ${r.status})`), { temporario: true });
  return r.blob();
}

export function filaCamera(usuarioId) {
  const id = String(usuarioId || "");
  if (!id) return null;
  if (filas.has(id)) return filas.get(id);
  const armazenamento = armazenamentoIndexedDB(globalThis.indexedDB, { banco: `paiia-foto-camera-${id}`, tabela: "fotos" }) || armazenamentoMemoria();
  // (13/11) Ordem: Photoroom (chave só no intermediário) → recorte GRÁTIS no aparelho
  // → "foto-ia" (Replicate) como última reserva.
  const recortar = recortarComReserva({
    photoroom: (f, ctx) => recortarPhotoroom(f, { caminho: ctx?.caminho, invocar: (nome, opcoes) => supabase.functions.invoke(nome, opcoes), baixar }),
    gratis: (f) => recortarLocalmente(f),
  });
  // (14/11) Photoroom (pago) só na 1ª tentativa de cada foto: novas tentativas
  // automáticas e fotos antigas reabertas usam só o recorte grátis.
  const tratar = ({ linhaId, url, urlOriginal, caminho, blob, tentativas, reaberta }) => tratarFotoDaGaleria({
    supabase, usuarioId: id, linhaId, urlOriginal: urlOriginal || url, caminho, original: blob || null, recortarFotoIA, recortarLocal: recortar, comporFotoFinal, baixar,
    semPhotoroom: (Number(tentativas) || 0) > 0 || Boolean(reaberta),
  });
  const fila = criarFilaCamera({
    armazenamento,
    deps: {
      salvarOriginal: (item) => salvarOriginalNaGaleria({ supabase, usuarioId: id, item, normalizar: normalizarArquivoParaEnvio }),
      tratar,
    },
    aoMudar: (e) => { try { globalThis.dispatchEvent?.(new CustomEvent(EVENTO_CAMERA, { detail: e })); } catch { /* sem janela */ } },
  });
  fila.retomarOutros = async () => {
    const locais = new Set((await fila.listar()).map((i) => String(i.linhaId || "")).filter(Boolean));
    return retomarDeOutrosAparelhos({ supabase, usuarioId: id, tratar, ja: jaRetomadas, locais });
  };
  filas.set(id, fila);
  return fila;
}
