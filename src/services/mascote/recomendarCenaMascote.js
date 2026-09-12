import { obterCenaMascote } from "./cenasMascote";

function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function carregarImagem(src) {
  return new Promise((resolver, rejeitar) => {
    const imagem = new Image();
    imagem.crossOrigin = "anonymous";
    imagem.onload = () => resolver(imagem);
    imagem.onerror = () => rejeitar(new Error("Não foi possível ler a imagem."));
    imagem.src = src;
  });
}

function amostraImagem(imagem) {
  const largura = Math.min(96, imagem.naturalWidth || imagem.width || 96);
  const altura = Math.max(
    1,
    Math.round(
      (largura / Math.max(1, imagem.naturalWidth || imagem.width)) *
        (imagem.naturalHeight || imagem.height || largura)
    )
  );
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { escuro: 0, metalico: 0, quaseQuadrado: false };
  }
  ctx.drawImage(imagem, 0, 0, largura, altura);
  const dados = ctx.getImageData(0, 0, largura, altura).data;
  let pixels = 0;
  let escuros = 0;
  let metalicos = 0;

  for (let i = 0; i < dados.length; i += 4) {
    const a = dados[i + 3];
    if (a < 20) {
      continue;
    }
    pixels += 1;
    const r = dados[i];
    const g = dados[i + 1];
    const b = dados[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const media = (r + g + b) / 3;
    if (media < 55 && max - min < 28) {
      escuros += 1;
    }
    if (media > 70 && media < 190 && max - min < 22) {
      metalicos += 1;
    }
  }

  const razao = largura / Math.max(1, altura);
  return {
    escuro: pixels ? escuros / pixels : 0,
    metalico: pixels ? metalicos / pixels : 0,
    quaseQuadrado: razao > 0.72 && razao < 1.35,
  };
}

function cenaPorTexto(texto) {
  if (
    /\b(pneu|pneus|roda|rodas|aro|tyre|tire|estepe)\b/.test(texto)
  ) {
    return {
      id: "roda",
      motivo: "A referência indica pneu ou roda. Cena: trocando uma roda.",
    };
  }

  if (
    /\b(motor|bico|injetor|vela|turbo|cabecote|virabrequim|pistao|bomba|filtro)\b/.test(
      texto
    )
  ) {
    return {
      id: "motor",
      motivo: "A referência indica peça de motor. Cena: mexendo no motor.",
    };
  }

  if (/\b(dirig|volante|motorista|carro|veiculo|caminhao)\b/.test(texto)) {
    return {
      id: "dirigindo",
      motivo: "A referência sugere veículo em uso. Cena: dirigindo.",
    };
  }

  if (/\b(oficina|mecanica|funilaria|box)\b/.test(texto)) {
    return {
      id: "oficina",
      motivo: "A referência aponta para oficina. Cena: na oficina.",
    };
  }

  return null;
}

export async function recomendarCenaMascote({
  imagemUrl = "",
  nomeArquivo = "",
  observacoes = "",
  origem = "zero",
} = {}) {
  const texto = normalizar(
    [nomeArquivo, observacoes, origem].join(" ")
  );
  const porTexto = cenaPorTexto(texto);
  if (porTexto) {
    return {
      ...obterCenaMascote(porTexto.id),
      motivo: porTexto.motivo,
    };
  }

  if (imagemUrl) {
    try {
      const imagem = await carregarImagem(imagemUrl);
      const amostra = amostraImagem(imagem);
      if (amostra.escuro > 0.42 && amostra.quaseQuadrado) {
        return {
          ...obterCenaMascote("roda"),
          motivo:
            "A foto parece um pneu ou peça escura circular. Cena: trocando uma roda.",
        };
      }
      if (amostra.metalico > 0.38) {
        return {
          ...obterCenaMascote("motor"),
          motivo:
            "A foto tem cara de peça metálica de motor. Cena: mexendo no motor.",
        };
      }
    } catch {
      /* preview local ainda vale o fallback de produto genérico */
    }
  }

  if (origem === "logo") {
    return {
      ...obterCenaMascote("mascote"),
      motivo:
        "Com o logo da marca, o Paizinho recomenda o personagem apresentando o produto.",
    };
  }

  return {
    ...obterCenaMascote("oficina"),
    motivo:
      "Produto automotivo genérico. O Paizinho recomenda a oficina, com o mascote apresentando a peça.",
  };
}
