// (10/11) Foto IA — worker do recorte local: roda o modelo fora da tela
// principal, para o PAIIA não travar enquanto a foto é recortada.
import * as ort from "onnxruntime-web/wasm";

ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;

const sessoes = new Map();

async function sessaoDo(url) {
  if (!sessoes.has(url)) {
    sessoes.set(
      url,
      (async () => {
        const resposta = await fetch(url);
        if (!resposta.ok) throw new Error("Não foi possível carregar o modelo de recorte.");
        const bytes = new Uint8Array(await resposta.arrayBuffer());
        return ort.InferenceSession.create(bytes, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
      })().catch((erro) => {
        sessoes.delete(url);
        throw erro;
      })
    );
  }
  return sessoes.get(url);
}

self.onmessage = async (evento) => {
  const { id, url, lado, tensor } = evento.data || {};
  try {
    const sessao = await sessaoDo(url);
    if (!tensor) {
      self.postMessage({ id, ok: true });
      return;
    }
    const entrada = new ort.Tensor("float32", tensor, [1, 3, lado, lado]);
    const resultado = await sessao.run({ [sessao.inputNames[0]]: entrada });
    const saida = Float32Array.from(resultado[sessao.outputNames[0]].data.subarray(0, lado * lado));
    Object.values(resultado).forEach((t) => t?.dispose?.());
    entrada.dispose?.();
    self.postMessage({ id, ok: true, saida }, [saida.buffer]);
  } catch (erro) {
    self.postMessage({ id, ok: false, erro: String(erro?.message || erro) });
  }
};
