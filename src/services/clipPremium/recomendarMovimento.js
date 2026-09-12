function carregarImagem(src) {
  return new Promise((resolver, rejeitar) => {
    const imagem = new Image();
    imagem.crossOrigin = "anonymous";
    imagem.onload = () => resolver(imagem);
    imagem.onerror = () => rejeitar(new Error("Não foi possível ler a foto."));
    imagem.src = src;
  });
}

function margemRelativa(imagem) {
  const largura = Math.min(160, imagem.naturalWidth || imagem.width);
  const altura = Math.max(
    1,
    Math.round(
      (largura / (imagem.naturalWidth || imagem.width)) *
        (imagem.naturalHeight || imagem.height)
    )
  );
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { ocupacao: 0.7, recorteApertado: false };
  }
  ctx.drawImage(imagem, 0, 0, largura, altura);
  const dados = ctx.getImageData(0, 0, largura, altura).data;

  let minX = largura;
  let minY = altura;
  let maxX = 0;
  let maxY = 0;
  let pixelsProduto = 0;

  for (let y = 0; y < altura; y += 1) {
    for (let x = 0; x < largura; x += 1) {
      const i = (y * largura + x) * 4;
      const r = dados[i];
      const g = dados[i + 1];
      const b = dados[i + 2];
      const a = dados[i + 3];
      const claro = r > 232 && g > 232 && b > 232;
      if (a > 18 && !claro) {
        pixelsProduto += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (pixelsProduto < 30) {
    return { ocupacao: 0.7, recorteApertado: false };
  }

  const larguraProduto = Math.max(1, maxX - minX + 1);
  const alturaProduto = Math.max(1, maxY - minY + 1);
  const ocupacao = (larguraProduto * alturaProduto) / (largura * altura);
  const margemX = Math.min(minX, largura - 1 - maxX) / largura;
  const margemY = Math.min(minY, altura - 1 - maxY) / altura;
  const recorteApertado = margemX < 0.06 || margemY < 0.06 || ocupacao > 0.88;

  return { ocupacao, recorteApertado };
}

export async function recomendarMovimentoClipPremium(imagemUrl) {
  if (!imagemUrl) {
    return {
      id: "giro-suave",
      nome: "Giro Suave",
      motivo:
        "Mantém esta peça inteira no enquadramento e valoriza seus detalhes.",
    };
  }

  try {
    const imagem = await carregarImagem(imagemUrl);
    const { recorteApertado } = margemRelativa(imagem);

    if (recorteApertado) {
      return {
        id: "giro-suave",
        nome: "Giro Suave",
        motivo:
          "Mantém esta peça inteira no enquadramento e valoriza seus detalhes.",
      };
    }

    return {
      id: "giro-suave",
      nome: "Giro Suave",
      motivo:
        "A foto mostra principalmente um lado da peça. Giro Suave é mais seguro do que reconstruir um 360°.",
    };
  } catch {
    return {
      id: "giro-suave",
      nome: "Giro Suave",
      motivo:
        "Mantém esta peça inteira no enquadramento e valoriza seus detalhes.",
    };
  }
}
