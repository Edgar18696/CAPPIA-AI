// Foto IA — composição final 100% fiel à foto original.
//
// Regra de ouro: os pixels da peça vêm SEMPRE da foto original enviada pelo
// usuário. O provedor de recorte só fornece a MÁSCARA (canal alfa) que diz o
// que é peça e o que é fundo. Nada é redesenhado, reconstruído ou recolorido.
//
// Padrão PAIIA: 1200 × 1200 px, fundo branco puro (#FFFFFF) ou transparente,
// peça ocupando 80% do lado (960 px no maior lado), centralizada, PNG.

export const TAMANHO_FINAL = 1200;
export const OCUPACAO_PECA = 0.8;
export const LADO_MAXIMO_ENVIO = 2560;
// Alfa mínimo para um pixel contar na caixa da peça (ignora halos muito fracos).
export const ALFA_MINIMO_CAIXA = 24;
// Abaixo disso o alfa vira 0 (remove poeira/ruído da máscara).
export const ALFA_RUIDO = 10;
// Diferença de proporção aceita entre foto e máscara.
export const TOLERANCIA_PROPORCAO = 0.02;
// Acima deste fator de ampliação a foto é considerada de baixa resolução.
export const AMPLIACAO_ALERTA = 2.5;

/* ------------------------------------------------------------------ */
/* Funções puras (testáveis em Node)                                    */
/* ------------------------------------------------------------------ */

// Caixa da peça a partir do canal alfa (Uint8ClampedArray RGBA ou só alfa).
export function calcularCaixaPorAlfa(
  dados,
  largura,
  altura,
  { passo = 4, deslocamento = 3, limiar = ALFA_MINIMO_CAIXA } = {}
) {
  let x0 = largura;
  let y0 = altura;
  let x1 = -1;
  let y1 = -1;

  for (let y = 0; y < altura; y += 1) {
    const base = y * largura;
    for (let x = 0; x < largura; x += 1) {
      if (dados[(base + x) * passo + deslocamento] >= limiar) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }

  if (x1 < 0) {
    return null;
  }

  return { x: x0, y: y0, largura: x1 - x0 + 1, altura: y1 - y0 + 1 };
}

// Expande a caixa (margem de segurança para não cortar a borda suave).
export function expandirCaixa(caixa, margem, largura, altura) {
  const x = Math.max(0, caixa.x - margem);
  const y = Math.max(0, caixa.y - margem);
  const xFim = Math.min(largura, caixa.x + caixa.largura + margem);
  const yFim = Math.min(altura, caixa.y + caixa.altura + margem);
  return { x, y, largura: xFim - x, altura: yFim - y };
}

// Layout 1200×1200: o maior lado da peça fica com 80% (960 px), proporção
// original preservada (mesma escala nos dois eixos), centralizado.
export function calcularLayoutFinal(
  larguraPeca,
  alturaPeca,
  { tamanho = TAMANHO_FINAL, ocupacao = OCUPACAO_PECA } = {}
) {
  if (!(larguraPeca > 0) || !(alturaPeca > 0)) {
    throw new Error("Dimensões da peça inválidas.");
  }

  const ladoAlvo = Math.round(tamanho * ocupacao);
  const escala = ladoAlvo / Math.max(larguraPeca, alturaPeca);
  const largura = Math.max(1, Math.round(larguraPeca * escala));
  const altura = Math.max(1, Math.round(alturaPeca * escala));

  return {
    tamanho,
    escala,
    largura,
    altura,
    x: Math.round((tamanho - largura) / 2),
    y: Math.round((tamanho - altura) / 2),
    baixaResolucao: escala > AMPLIACAO_ALERTA,
  };
}

// Proporções compatíveis (máscara x foto)?
export function proporcoesCompativeis(l1, a1, l2, a2, tolerancia = TOLERANCIA_PROPORCAO) {
  if (!(l1 > 0 && a1 > 0 && l2 > 0 && a2 > 0)) return false;
  const p1 = l1 / a1;
  const p2 = l2 / a2;
  return Math.abs(p1 - p2) / p1 <= tolerancia;
}

// Etapas de redução (metade por vez) para reduzir sem serrilhado.
export function etapasReducao(origemL, origemA, destinoL, destinoA) {
  const etapas = [];
  let l = origemL;
  let a = origemA;

  while (l / 2 >= destinoL && a / 2 >= destinoA) {
    l = Math.round(l / 2);
    a = Math.round(a / 2);
    etapas.push({ largura: l, altura: a });
  }

  if (l !== destinoL || a !== destinoA) {
    etapas.push({ largura: destinoL, altura: destinoA });
  }

  return etapas;
}

// Limpa o ruído da máscara (alfa muito baixo vira 0). Altera no lugar.
export function limparRuidoAlfa(dados, limiar = ALFA_RUIDO) {
  for (let i = 3; i < dados.length; i += 4) {
    if (dados[i] < limiar) dados[i] = 0;
  }
  return dados;
}

// Orientação EXIF (1..8) de um JPEG; 1 quando não houver.
export function lerOrientacaoExif(buffer) {
  try {
    const vista = new DataView(buffer);
    if (vista.byteLength < 4 || vista.getUint16(0) !== 0xffd8) return 1;

    let offset = 2;
    while (offset + 4 <= vista.byteLength) {
      const marcador = vista.getUint16(offset);
      const tamanho = vista.getUint16(offset + 2);

      if (marcador === 0xffe1) {
        const inicio = offset + 4;
        if (vista.getUint32(inicio) !== 0x45786966) return 1; // "Exif"
        const tiff = inicio + 6;
        const little = vista.getUint16(tiff) === 0x4949;
        const primeiroIfd = vista.getUint32(tiff + 4, little);
        const ifd = tiff + primeiroIfd;
        const entradas = vista.getUint16(ifd, little);

        for (let i = 0; i < entradas; i += 1) {
          const entrada = ifd + 2 + i * 12;
          if (vista.getUint16(entrada, little) === 0x0112) {
            const valor = vista.getUint16(entrada + 8, little);
            return valor >= 1 && valor <= 8 ? valor : 1;
          }
        }
        return 1;
      }

      if ((marcador & 0xff00) !== 0xff00 || marcador === 0xffda) break;
      offset += 2 + tamanho;
    }
  } catch {
    return 1;
  }
  return 1;
}

// Precisa reprocessar o arquivo antes do envio?
export function precisaNormalizarArquivo({ tipo, largura, altura, orientacao }) {
  const tipoOk = /^image\/(jpeg|png|webp)$/i.test(String(tipo || ""));
  return (
    !tipoOk ||
    (orientacao && orientacao !== 1) ||
    Math.max(largura || 0, altura || 0) > LADO_MAXIMO_ENVIO
  );
}

/* ------------------------------------------------------------------ */
/* Funções de navegador (canvas)                                        */
/* ------------------------------------------------------------------ */

function criarCanvas(largura, altura) {
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  return canvas;
}

export async function decodificarImagem(fonte) {
  const blob =
    fonte instanceof Blob
      ? fonte
      : await (async () => {
          const resposta = await fetch(fonte);
          if (!resposta.ok) {
            throw new Error("Não foi possível baixar a imagem.");
          }
          return resposta.blob();
        })();

  // "from-image" aplica a orientação EXIF (foto de celular deitada).
  return createImageBitmap(blob, { imageOrientation: "from-image" });
}

// Garante arquivo em orientação correta e tamanho razoável para o envio.
// Sem necessidade, devolve o próprio arquivo (bytes originais intactos).
export async function normalizarArquivoParaEnvio(arquivo) {
  const buffer = await arquivo.arrayBuffer();
  const orientacao = /jpe?g/i.test(arquivo.type) ? lerOrientacaoExif(buffer) : 1;
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });

  try {
    if (
      !precisaNormalizarArquivo({
        tipo: arquivo.type,
        largura: bitmap.width,
        altura: bitmap.height,
        orientacao,
      })
    ) {
      return { arquivo, largura: bitmap.width, altura: bitmap.height, normalizado: false };
    }

    const escala = Math.min(1, LADO_MAXIMO_ENVIO / Math.max(bitmap.width, bitmap.height));
    const largura = Math.max(1, Math.round(bitmap.width * escala));
    const altura = Math.max(1, Math.round(bitmap.height * escala));
    const canvas = reduzirComQualidade(bitmap, largura, altura);
    const png = /png|webp/i.test(arquivo.type);
    const blob = await new Promise((ok) =>
      canvas.toBlob(ok, png ? "image/png" : "image/jpeg", png ? undefined : 0.95)
    );

    if (!blob) {
      throw new Error("Não foi possível preparar a foto para envio.");
    }

    const nomeBase = String(arquivo.name || "foto").replace(/\.[^.]+$/, "");
    const novo = new File([blob], `${nomeBase}.${png ? "png" : "jpg"}`, { type: blob.type });
    return { arquivo: novo, largura, altura, normalizado: true };
  } finally {
    bitmap.close?.();
  }
}

// Redimensiona com qualidade (reduções sucessivas pela metade).
export function reduzirComQualidade(fonte, larguraDestino, alturaDestino) {
  const larguraOrigem = fonte.width;
  const alturaOrigem = fonte.height;

  if (larguraDestino >= larguraOrigem || alturaDestino >= alturaOrigem) {
    const canvas = criarCanvas(larguraDestino, alturaDestino);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(fonte, 0, 0, larguraDestino, alturaDestino);
    return canvas;
  }

  let atual = fonte;
  for (const etapa of etapasReducao(larguraOrigem, alturaOrigem, larguraDestino, alturaDestino)) {
    const canvas = criarCanvas(etapa.largura, etapa.altura);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(atual, 0, 0, etapa.largura, etapa.altura);
    atual = canvas;
  }
  return atual;
}

// Composição final: RGB da foto original + alfa da máscara do recorte.
export async function comporFotoFinal({
  original, // Blob/File/URL da foto EXATAMENTE como foi enviada ao recorte
  recorte, // Blob/URL do PNG com transparência devolvido pelo provedor
  fundo = "branco",
}) {
  const imagemOriginal = await decodificarImagem(original);
  const imagemRecorte = await decodificarImagem(recorte);

  try {
    const largura = imagemOriginal.width;
    const altura = imagemOriginal.height;

    if (
      !proporcoesCompativeis(largura, altura, imagemRecorte.width, imagemRecorte.height)
    ) {
      throw new Error(
        "O recorte devolvido não corresponde à foto enviada. Nada foi cobrado; tente novamente."
      );
    }

    // Máscara no tamanho exato da foto original.
    const canvasMascara = criarCanvas(largura, altura);
    const ctxMascara = canvasMascara.getContext("2d", { willReadFrequently: true });
    ctxMascara.imageSmoothingEnabled = true;
    ctxMascara.imageSmoothingQuality = "high";
    ctxMascara.drawImage(imagemRecorte, 0, 0, largura, altura);
    const mascara = ctxMascara.getImageData(0, 0, largura, altura).data;
    limparRuidoAlfa(mascara);

    const caixaBruta = calcularCaixaPorAlfa(mascara, largura, altura);
    if (!caixaBruta) {
      throw new Error(
        "Não foi possível identificar a peça nesta foto. Use uma foto com a peça inteira e bem visível."
      );
    }

    const caixa = expandirCaixa(caixaBruta, 2, largura, altura);

    // Pixels da peça: 100% da foto original; só o alfa vem da máscara.
    const canvasPeca = criarCanvas(caixa.largura, caixa.altura);
    const ctxPeca = canvasPeca.getContext("2d", { willReadFrequently: true });
    ctxPeca.drawImage(
      imagemOriginal,
      caixa.x,
      caixa.y,
      caixa.largura,
      caixa.altura,
      0,
      0,
      caixa.largura,
      caixa.altura
    );
    const pixels = ctxPeca.getImageData(0, 0, caixa.largura, caixa.altura);
    const dados = pixels.data;

    for (let y = 0; y < caixa.altura; y += 1) {
      const linhaMascara = (caixa.y + y) * largura + caixa.x;
      const linhaPeca = y * caixa.largura;
      for (let x = 0; x < caixa.largura; x += 1) {
        dados[(linhaPeca + x) * 4 + 3] = mascara[(linhaMascara + x) * 4 + 3];
      }
    }
    ctxPeca.putImageData(pixels, 0, 0);

    // 80% medido na peça real (caixa bruta); a margem suave de 2 px é
    // desenhada em volta, na mesma escala, sem mudar o enquadramento.
    const layout = calcularLayoutFinal(caixaBruta.largura, caixaBruta.altura);
    const larguraDesenho = Math.max(1, Math.round(caixa.largura * layout.escala));
    const alturaDesenho = Math.max(1, Math.round(caixa.altura * layout.escala));
    const xDesenho = Math.round(layout.x - (caixaBruta.x - caixa.x) * layout.escala);
    const yDesenho = Math.round(layout.y - (caixaBruta.y - caixa.y) * layout.escala);
    const pecaNaEscala = reduzirComQualidade(canvasPeca, larguraDesenho, alturaDesenho);

    const canvasFinal = criarCanvas(layout.tamanho, layout.tamanho);
    const ctxFinal = canvasFinal.getContext("2d");
    if (fundo !== "transparente") {
      ctxFinal.fillStyle = "#ffffff";
      ctxFinal.fillRect(0, 0, layout.tamanho, layout.tamanho);
    }
    ctxFinal.imageSmoothingEnabled = true;
    ctxFinal.imageSmoothingQuality = "high";
    ctxFinal.drawImage(pecaNaEscala, xDesenho, yDesenho, larguraDesenho, alturaDesenho);

    const blob = await new Promise((ok) => canvasFinal.toBlob(ok, "image/png"));
    if (!blob) {
      throw new Error("Não foi possível gerar o PNG final.");
    }

    return {
      blob,
      largura: layout.tamanho,
      altura: layout.tamanho,
      layout,
      caixa: caixaBruta,
      baixaResolucao: layout.baixaResolucao,
    };
  } finally {
    imagemOriginal.close?.();
    imagemRecorte.close?.();
  }
}
