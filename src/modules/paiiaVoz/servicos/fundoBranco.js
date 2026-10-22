// =============================================================
// PAIIA Voz — FUNDO BRANCO NO PRÓPRIO APARELHO (grátis, sem serviço externo).
//   Testes: scripts/testes/paiiaVozRapido.test.mjs
//
// Para fotos tiradas sobre um fundo liso (mesa, papel, pano claro):
//  1. lê a cor do fundo pela borda da foto;
//  2. pinta de branco SÓ o que é fundo e está ligado à borda
//     (a peça e tudo o que fica dentro dela não é tocado);
//  3. suaviza o contorno para não ficar serrilhado.
// Não muda cor, forma, brilho nem detalhes da peça. A original é sempre
// guardada e a versão tratada só vai ao anúncio se você aprovar.
// Fundo bagunçado (vários objetos, chão estampado) → "não aplicável".
// Funções puras sobre { width, height, data (RGBA) } + adaptador de canvas.
// =============================================================

const BRANCO = 255;

function distancia(d, i, cor) {
  const dr = d[i] - cor[0];
  const dg = d[i + 1] - cor[1];
  const db = d[i + 2] - cor[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** Cor e uniformidade da borda (faixa de 2% de cada lado). */
export function analisarBorda({ width: w, height: h, data: d }) {
  const faixa = Math.max(1, Math.round(Math.min(w, h) * 0.02));
  const amostras = [];
  const passo = Math.max(1, Math.round((w + h) / 400));
  for (let y = 0; y < h; y += passo) {
    for (let x = 0; x < w; x += passo) {
      if (x >= faixa && x < w - faixa && y >= faixa && y < h - faixa) continue;
      const i = (y * w + x) * 4;
      amostras.push([d[i], d[i + 1], d[i + 2]]);
    }
  }
  const mediana = [0, 1, 2].map((c) => {
    const v = amostras.map((a) => a[c]).sort((p, q) => p - q);
    return v[Math.floor(v.length / 2)] ?? 0;
  });
  const dist = amostras.map((a) => Math.hypot(a[0] - mediana[0], a[1] - mediana[1], a[2] - mediana[2])).sort((p, q) => p - q);
  const p80 = dist[Math.floor(dist.length * 0.8)] ?? 0;
  const proximos = dist.filter((x) => x <= 40).length / Math.max(1, dist.length);
  return { cor: mediana, variacao: p80, proporcaoUniforme: proximos };
}

/**
 * Pinta o fundo de branco.
 * @returns {{ aplicavel: boolean, motivo?: string, imagem?: {width,height,data}, fundo?: number, mascara?: Uint8Array }}
 */
export function fundoBranco(imagem, { tolerancia = 42, suavizar = 2 } = {}) {
  const { width: w, height: h, data: d } = imagem;
  if (!w || !h || !d || d.length < w * h * 4) return { aplicavel: false, motivo: "imagem inválida" };
  const borda = analisarBorda(imagem);
  if (borda.proporcaoUniforme < 0.6) {
    return { aplicavel: false, motivo: "o fundo não é liso (há objetos ou estampas na borda). Tire a foto sobre um fundo claro e liso." };
  }
  const tol = Math.max(18, Math.min(70, tolerancia + borda.variacao * 0.5));
  // Preenchimento a partir da borda: só o que é parecido com o fundo E ligado à borda.
  const fundo = new Uint8Array(w * h);
  const fila = new Int32Array(w * h);
  let ini = 0;
  let fim = 0;
  const tentar = (p) => {
    if (fundo[p]) return;
    if (distancia(d, p * 4, borda.cor) <= tol) {
      fundo[p] = 1;
      fila[fim++] = p;
    }
  };
  for (let x = 0; x < w; x++) { tentar(x); tentar((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { tentar(y * w); tentar(y * w + w - 1); }
  while (ini < fim) {
    const p = fila[ini++];
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) tentar(p - 1);
    if (x < w - 1) tentar(p + 1);
    if (y > 0) tentar(p - w);
    if (y < h - 1) tentar(p + w);
  }
  const proporcao = fim / (w * h);
  if (proporcao < 0.05) return { aplicavel: false, motivo: "quase não há fundo visível (a peça ocupa a foto toda)." };
  if (proporcao > 0.985) return { aplicavel: false, motivo: "não encontrei a peça separada do fundo (cores muito parecidas)." };

  // Distância de cada pixel da peça até o fundo (só perto do contorno), para suavizar.
  const saida = new Uint8ClampedArray(d);
  const r = Math.max(0, Math.round(suavizar));
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (fundo[p]) {
      saida[i] = BRANCO; saida[i + 1] = BRANCO; saida[i + 2] = BRANCO; saida[i + 3] = 255;
      continue;
    }
    if (!r) continue;
    // pixel da peça vizinho do fundo: mistura levemente com branco (antisserrilhado), sem mudar o miolo
    const x = p % w;
    const y = (p - x) / w;
    // atalho: longe do fundo (nas 4 direções) não precisa olhar a vizinhança
    if (!((x >= r && fundo[p - r]) || (x < w - r && fundo[p + r]) || (y >= r && fundo[p - r * w]) || (y < h - r && fundo[p + r * w]) || (x > 0 && fundo[p - 1]) || (x < w - 1 && fundo[p + 1]) || (y > 0 && fundo[p - w]) || (y < h - 1 && fundo[p + w]))) continue;
    let vizinhos = 0;
    let total = 0;
    for (let dy = -r; dy <= r; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= w) continue;
        total++;
        if (fundo[yy * w + xx]) vizinhos++;
      }
    }
    if (vizinhos && distancia(d, i, borda.cor) <= tol * 1.6) {
      const a = Math.min(0.5, vizinhos / total); // no máximo 50% de branco, só na franja parecida com o fundo
      saida[i] = Math.round(d[i] * (1 - a) + BRANCO * a);
      saida[i + 1] = Math.round(d[i + 1] * (1 - a) + BRANCO * a);
      saida[i + 2] = Math.round(d[i + 2] * (1 - a) + BRANCO * a);
    }
  }
  return { aplicavel: true, imagem: { width: w, height: h, data: saida }, fundo: proporcao, mascara: fundo };
}

/**
 * No navegador: arquivo → { blob (JPEG), aplicavel, motivo }.
 * Trabalha numa cópia reduzida (lado maior até 1600 px) para ser rápido no celular.
 */
export async function tratarFotoNoNavegador(arquivo, { ladoMaximo = 1600, qualidade = 0.92 } = {}) {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" }).catch(() => createImageBitmap(arquivo));
  const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * escala));
  const h = Math.max(1, Math.round(bitmap.height * escala));
  const canvas = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const dados = ctx.getImageData(0, 0, w, h);
  const r = fundoBranco({ width: w, height: h, data: dados.data });
  if (!r.aplicavel) return { aplicavel: false, motivo: r.motivo };
  ctx.putImageData(new ImageData(r.imagem.data, w, h), 0, 0);
  const blob = canvas.convertToBlob
    ? await canvas.convertToBlob({ type: "image/jpeg", quality: qualidade })
    : await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", qualidade));
  return { aplicavel: true, blob, fundo: r.fundo, largura: w, altura: h };
}
