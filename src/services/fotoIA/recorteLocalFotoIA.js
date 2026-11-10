// (10/11) Foto IA — RECORTE LOCAL (no próprio aparelho, sem custo por foto).
//
// Remove o fundo com um modelo de segmentação aberto (família U²-Net / IS-Net,
// licença Apache-2.0) executado pelo onnxruntime-web (licença MIT) dentro do
// navegador. Nenhuma foto sai do aparelho para o recorte: sem Replicate, sem
// Gemini, sem créditos e sem a cota mensal da função "foto-ia".
//
// O modelo só gera a MÁSCARA (o que é peça e o que é fundo). A foto final é
// montada por comporFotoFinal com os pixels ORIGINAIS da peça.

export const MODELOS_RECORTE = {
  u2netp: { arquivo: "u2netp.onnx", lado: 320, media: [0.485, 0.456, 0.406], desvio: [0.229, 0.224, 0.225] },
  silueta: { arquivo: "silueta.onnx", lado: 320, media: [0.485, 0.456, 0.406], desvio: [0.229, 0.224, 0.225] },
  isnet: { arquivo: "isnet-general-use.onnx", lado: 1024, media: [0.5, 0.5, 0.5], desvio: [1, 1, 1] },
};
export const MODELO_PADRAO = "silueta";
export const PASTA_MODELOS = "/modelos/";

/* ------------------------------------------------------------------ */
/* Funções puras (testáveis em Node)                                    */
/* ------------------------------------------------------------------ */

// RGBA (lado × lado) → tensor Float32 NCHW normalizado como no treino do modelo.
export function rgbaParaTensor(rgba, lado, { media, desvio }) {
  const total = lado * lado;
  let maximo = 0;
  for (let i = 0; i < total; i += 1) {
    const b = i * 4;
    if (rgba[b] > maximo) maximo = rgba[b];
    if (rgba[b + 1] > maximo) maximo = rgba[b + 1];
    if (rgba[b + 2] > maximo) maximo = rgba[b + 2];
  }
  const escala = maximo > 0 ? maximo : 1;
  const tensor = new Float32Array(3 * total);
  for (let i = 0; i < total; i += 1) {
    const b = i * 4;
    tensor[i] = (rgba[b] / escala - media[0]) / desvio[0];
    tensor[total + i] = (rgba[b + 1] / escala - media[1]) / desvio[1];
    tensor[2 * total + i] = (rgba[b + 2] / escala - media[2]) / desvio[2];
  }
  return tensor;
}

// Saída do modelo → máscara 0..255 (normalizada pelo mínimo/máximo).
export function saidaParaMascara(saida, total) {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < total; i += 1) {
    const v = saida[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const faixa = max - min || 1;
  const mascara = new Uint8ClampedArray(total);
  for (let i = 0; i < total; i += 1) mascara[i] = Math.round(((saida[i] - min) / faixa) * 255);
  return mascara;
}

// Deixa a borda firme sem serrilhar: abaixo de "baixo" vira fundo, acima de
// "alto" vira peça, e o meio vira transição suave.
export function firmarMascara(mascara, baixo = 0.15, alto = 0.6) {
  const b = baixo * 255;
  const a = alto * 255;
  const faixa = a - b || 1;
  for (let i = 0; i < mascara.length; i += 1) {
    const v = mascara[i];
    mascara[i] = v <= b ? 0 : v >= a ? 255 : Math.round(((v - b) / faixa) * 255);
  }
  return mascara;
}

// Fração da imagem que ficou como peça (para detectar recorte vazio).
export function fracaoPeca(mascara, limiar = 128) {
  let n = 0;
  for (let i = 0; i < mascara.length; i += 1) if (mascara[i] >= limiar) n += 1;
  return mascara.length ? n / mascara.length : 0;
}

/* ------------------------------------------------------------------ */
/* Navegador                                                            */
/* ------------------------------------------------------------------ */

// Modelo roda num worker (a tela não trava). Se o aparelho não aceitar o
// worker, roda na própria página — mesmo resultado, só mais "pesado" na tela.
let worker = null;
let workerFalhou = false;
let proximoId = 1;
const pendentes = new Map();
const sessoesPagina = new Map();

function obterWorker() {
  if (workerFalhou || typeof Worker === "undefined") return null;
  if (!worker) {
    try {
      worker = new Worker(new URL("./recorteLocalWorker.js", import.meta.url), { type: "module" });
      worker.onmessage = (e) => {
        const p = pendentes.get(e.data?.id);
        if (!p) return;
        pendentes.delete(e.data.id);
        if (e.data.ok) p.ok(e.data.saida);
        else p.falha(new Error(e.data.erro || "Falha no recorte."));
      };
      worker.onerror = () => {
        workerFalhou = true;
        worker = null;
        pendentes.forEach((p) => p.falha(new Error("worker indisponível")));
        pendentes.clear();
      };
    } catch {
      workerFalhou = true;
      worker = null;
    }
  }
  return worker;
}

function pedirAoWorker(w, dados, transferir = []) {
  return new Promise((ok, falha) => {
    const id = proximoId++;
    pendentes.set(id, { ok, falha });
    w.postMessage({ id, ...dados }, transferir);
  });
}

async function sessaoNaPagina(url) {
  if (!sessoesPagina.has(url)) {
    sessoesPagina.set(
      url,
      (async () => {
        const ort = await import("onnxruntime-web/wasm");
        ort.env.wasm.numThreads = 1; // sem SharedArrayBuffer: funciona em qualquer celular
        ort.env.wasm.proxy = false;
        const resposta = await fetch(url);
        if (!resposta.ok) throw new Error("Não foi possível carregar o modelo de recorte.");
        const bytes = new Uint8Array(await resposta.arrayBuffer());
        const sessao = await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
        return { ort, sessao };
      })().catch((erro) => {
        sessoesPagina.delete(url);
        throw erro;
      })
    );
  }
  return sessoesPagina.get(url);
}

export function urlDoModelo(nome = MODELO_PADRAO) {
  const modelo = MODELOS_RECORTE[nome];
  if (!modelo) throw new Error(`Modelo de recorte desconhecido: ${nome}`);
  return `${PASTA_MODELOS}${modelo.arquivo}`;
}

// Executa o modelo e devolve a saída (lado × lado).
export async function inferirMascara(nome, tensor, lado) {
  const url = urlDoModelo(nome);
  const w = obterWorker();
  if (w) {
    try {
      return await pedirAoWorker(w, { url, lado, tensor }, [tensor.buffer]);
    } catch (erro) {
      if (!workerFalhou) throw erro;
      // worker caiu: segue na página (o tensor foi transferido; refaz abaixo)
      throw new Error("REFAZER_NA_PAGINA", { cause: erro });
    }
  }
  const { ort, sessao } = await sessaoNaPagina(url);
  const entrada = new ort.Tensor("float32", tensor, [1, 3, lado, lado]);
  const resultado = await sessao.run({ [sessao.inputNames[0]]: entrada });
  const saida = Float32Array.from(resultado[sessao.outputNames[0]].data.subarray(0, lado * lado));
  Object.values(resultado).forEach((t) => t?.dispose?.());
  entrada.dispose?.();
  return saida;
}

// Baixa e prepara o modelo antes da primeira foto (o arquivo fica no cache do navegador).
export async function carregarModeloRecorte(nome = MODELO_PADRAO, { aoProgresso } = {}) {
  aoProgresso?.("carregando-modelo");
  const url = urlDoModelo(nome);
  const w = obterWorker();
  if (w) {
    try {
      await pedirAoWorker(w, { url });
      return;
    } catch {
      if (!workerFalhou) throw new Error("Não foi possível carregar o modelo de recorte.");
    }
  }
  await sessaoNaPagina(url);
}

function canvas(l, a) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(l, a);
  const c = document.createElement("canvas");
  c.width = l;
  c.height = a;
  return c;
}

async function paraBlob(c) {
  if (c.convertToBlob) return c.convertToBlob({ type: "image/png" });
  return new Promise((ok, falha) => c.toBlob((b) => (b ? ok(b) : falha(new Error("Falha ao gerar o recorte."))), "image/png"));
}

async function decodificar(fonte) {
  // mesma orientação usada na composição (foto de celular com EXIF girado)
  if (typeof createImageBitmap === "function") return createImageBitmap(fonte, { imageOrientation: "from-image" });
  const url = URL.createObjectURL(fonte);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Recorta a foto (Blob/File) e devolve um PNG do MESMO tamanho, com a máscara
// no canal alfa — o formato que comporFotoFinal espera.
export async function recortarLocalmente(arquivo, { modelo: nome = MODELO_PADRAO, aoProgresso } = {}) {
  const modelo = MODELOS_RECORTE[nome];
  if (!modelo) throw new Error(`Modelo de recorte desconhecido: ${nome}`);
  await carregarModeloRecorte(nome, { aoProgresso });
  aoProgresso?.("recortando");
  const imagem = await decodificar(arquivo);
  const largura = imagem.width;
  const altura = imagem.height;
  const lado = modelo.lado;

  const entrada = canvas(lado, lado);
  const ctxEntrada = entrada.getContext("2d", { willReadFrequently: true });
  ctxEntrada.imageSmoothingQuality = "high";
  ctxEntrada.drawImage(imagem, 0, 0, lado, lado);
  const rgba = ctxEntrada.getImageData(0, 0, lado, lado).data;

  let saida;
  try {
    saida = await inferirMascara(nome, rgbaParaTensor(rgba, lado, modelo), lado);
  } catch (erro) {
    if (erro?.message !== "REFAZER_NA_PAGINA") throw erro;
    saida = await inferirMascara(nome, rgbaParaTensor(rgba, lado, modelo), lado);
  }
  const mascaraPequena = saidaParaMascara(saida, lado * lado);

  // Máscara no tamanho do modelo → tamanho da foto (interpolação suave).
  const cMasc = canvas(lado, lado);
  const ctxMasc = cMasc.getContext("2d");
  const dadosMasc = ctxMasc.createImageData(lado, lado);
  for (let i = 0; i < mascaraPequena.length; i += 1) {
    const b = i * 4;
    dadosMasc.data[b] = 0;
    dadosMasc.data[b + 1] = 0;
    dadosMasc.data[b + 2] = 0;
    dadosMasc.data[b + 3] = mascaraPequena[i];
  }
  ctxMasc.putImageData(dadosMasc, 0, 0);

  const cFinal = canvas(largura, altura);
  const ctxFinal = cFinal.getContext("2d", { willReadFrequently: true });
  ctxFinal.imageSmoothingEnabled = true;
  ctxFinal.imageSmoothingQuality = "high";
  ctxFinal.drawImage(cMasc, 0, 0, largura, altura);
  const grande = ctxFinal.getImageData(0, 0, largura, altura);
  const alfa = new Uint8ClampedArray(largura * altura);
  for (let i = 0; i < alfa.length; i += 1) alfa[i] = grande.data[i * 4 + 3];
  firmarMascara(alfa);
  for (let i = 0; i < alfa.length; i += 1) grande.data[i * 4 + 3] = alfa[i];
  ctxFinal.putImageData(grande, 0, 0);
  imagem.close?.();

  const fracao = fracaoPeca(alfa);
  if (fracao < 0.005) {
    throw new Error("Não foi possível identificar a peça nesta foto. Tente uma foto com a peça mais destacada do fundo.");
  }
  return { blob: await paraBlob(cFinal), largura, altura, fracao };
}
