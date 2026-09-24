 import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { supabase } from "../supabase";
import {
  assinaturaArteBanner,
  extrairPrecoDoTexto,
  formatarPrecoBanner,
  formatoCitadoNoTexto,
} from "../services/banner/bannerTexto.js";
import {
  consumirNovaCriacaoMidia,
  deveIniciarNovaCriacaoMidia,
} from "../services/limparEstadoTemporarioMidia";
import {
  CHAMADAS_MERCADO_LIVRE,
  dadosComerciaisDoBanner,
  descreverZonaProduto,
  descreverZonasLivres,
  mapearParaQuadroIA,
  planejarLayout,
  tamanhoQuadroIA,
  textoChamadaMercadoLivre,
} from "../services/banner/composicaoBanner.js";
import {
  montarBannerProfissional,
  montarBaseCenarioParaIA,
} from "../services/banner/desenhoBanner.js";
import { gerarCenarioComIA } from "../services/banner/bannerIA.js";
import { montarBannerDiretorArte } from "../services/banner/desenhoDiretorArte.js";
import {
  DIFERENCIAIS,
  decidirDirecaoDeArte,
  objetivoDoDiretor,
  planejarDiretor,
} from "../services/banner/diretorArte.js";
import { buscarMascoteOficial } from "../services/mascoteMarcaService";

const EXIBIR_PADRAO = {
  logo: true,
  preco: true,
  codigo: true,
  site: true,
  whatsapp: true,
};

const FORMATOS = {
  instagram: {
    nome: "Instagram Feed",
    largura: 1080,
    altura: 1350,
    icone: "📸",
  },
  quadrado: {
    nome: "Instagram / Facebook",
    largura: 1080,
    altura: 1080,
    icone: "⬜",
  },
  story: {
    nome: "Stories / Status",
    largura: 1080,
    altura: 1920,
    icone: "📱",
   },

  facebook: {
    nome: "Facebook Feed",
    largura: 1200,
    altura: 1500,
    icone: "👍",
  },

  mercadoLivre: {
    nome: "Mercado Livre",
    largura: 1200,
    altura: 1200,
    icone: "🔧",
  },

  whatsapp: {
    nome: "WhatsApp Status",
    largura: 1080,
    altura: 1920,
    icone: "💬",
  },

};

const OBJETIVOS = [
  {
    id: "oferta",
    nome: "Oferta / Promoção",
    icone: "🔥",
    chamada: "OFERTA ESPECIAL",
    apoio: "Aproveite enquanto durar o estoque",
  },
  {
    id: "produto",
    nome: "Produto em Destaque",
    icone: "⭐",
    chamada: "PRODUTO EM DESTAQUE",
    apoio: "Qualidade e confiança para o seu carro",
  },
  {
    id: "horario",
    nome: "Horário de Funcionamento",
    icone: "🕒",
    chamada: "HORÁRIO DE ATENDIMENTO",
    apoio: "Estamos prontos para atender você",
  },
  {
    id: "institucional",
    nome: "Institucional / Comunicado",
    icone: "📢",
    chamada: "COMUNICADO",
    apoio: "Informação importante para nossos clientes",
  },
];


const MODELOS_DESCRICAO = [
  {
    id: "oferta",
    nome: "🔥 Promoção",
    texto:
      "Faça uma promoção. Destaque o produto, use visual forte e limpo, pronta entrega e chamada para comprar.",
  },
  {
    id: "produto",
    nome: "⭐ Produto",
    texto:
      "Crie um banner profissional de produto em destaque. Peça grande, visual premium, pouco texto e chamada para consultar aplicações.",
  },
  {
    id: "premium",
    nome: "💎 Premium",
    texto:
      "Crie um banner premium e moderno. Produto grande, visual sofisticado, poucas palavras e destaque para qualidade e confiança.",
  },
  {
    id: "estoque",
    nome: "📦 Pronta entrega",
    texto:
      "Crie um banner de pronta entrega. Destaque o produto, estoque disponível, envio rápido e chamada para falar com a loja.",
  },
  {
    id: "institucional",
    nome: "📢 Comunicado",
    texto:
      "Crie um comunicado profissional e limpo com a marca em destaque e uma mensagem objetiva para os clientes.",
  },
    {
    id: "qualidade",
    nome: "🏆 Qualidade / Confiança",
    texto:
      "Crie um banner profissional com a mensagem Qualidade que seu carro merece. Destaque o produto, transmita confiança, qualidade e credibilidade, use pouco texto e uma chamada comercial elegante.",
  },
  
];
// Chamadas comerciais de cada estilo (sem prometer nada que o usuário não
// informou: nada de prazo, garantia, desconto ou aplicação inventados).
const COPIA_POR_ESTILO = {
  oferta: {
    objetivo: "oferta",
    titulo: "OFERTA ESPECIAL",
    apoio: "Aproveite esta condição",
    cta: "APROVEITE AGORA",
  },
  produto: {
    objetivo: "produto",
    titulo: "PRODUTO EM DESTAQUE",
    apoio: "Consulte a aplicação antes da compra",
    cta: "CONSULTE AGORA",
  },
  premium: {
    objetivo: "produto",
    titulo: "QUALIDADE PREMIUM",
    apoio: "Desempenho e confiança para o seu carro",
    cta: "FALE COM A GENTE",
  },
  estoque: {
    objetivo: "produto",
    titulo: "PRONTA ENTREGA",
    apoio: "Produto disponível para envio",
    cta: "FALE COM A GENTE",
  },
  institucional: {
    objetivo: "institucional",
    titulo: "COMUNICADO",
    apoio: "Informação importante para nossos clientes",
    cta: "SAIBA MAIS",
  },
  qualidade: {
    objetivo: "produto",
    titulo: "QUALIDADE QUE SEU CARRO MERECE",
    apoio: "Qualidade e confiança",
    cta: "CONSULTE AGORA",
  },
};

const PALETAS = {
  azul: {
    nome: "Azul Elétrico",
    fundo:
      "radial-gradient(circle at 82% 18%, rgba(34,211,238,.46), transparent 24%), radial-gradient(circle at 18% 82%, rgba(37,99,235,.50), transparent 28%), linear-gradient(135deg,#020617 0%,#071a3d 42%,#0b3ea8 72%,#05b6d3 125%)",
    destaque: "#67e8f9",
    destaque2: "#22d3ee",
    texto: "#ffffff",
    apoio: "#dbeafe",
    caixa: "rgba(2,6,23,.82)",
  },
  vermelho: {
    nome: "Vermelho Impacto",
    fundo:
      "radial-gradient(circle at 84% 14%, rgba(250,204,21,.42), transparent 22%), radial-gradient(circle at 10% 88%, rgba(239,68,68,.45), transparent 26%), linear-gradient(135deg,#120407 0%,#4c0519 42%,#b91c1c 72%,#f97316 125%)",
    destaque: "#fde047",
    destaque2: "#fb923c",
    texto: "#ffffff",
    apoio: "#fee2e2",
    caixa: "rgba(28,5,8,.84)",
  },
  escuro: {
    nome: "Grafite Neon",
    fundo:
      "radial-gradient(circle at 82% 16%, rgba(34,211,238,.34), transparent 24%), radial-gradient(circle at 12% 88%, rgba(168,85,247,.26), transparent 28%), linear-gradient(135deg,#020617 0%,#0f172a 48%,#111827 75%,#0c4a6e 125%)",
    destaque: "#22d3ee",
    destaque2: "#a855f7",
    texto: "#ffffff",
    apoio: "#e2e8f0",
    caixa: "rgba(2,6,23,.86)",
  },
  clean: {
    nome: "Clean Vibrante",
    fundo:
      "radial-gradient(circle at 86% 12%, rgba(56,189,248,.25), transparent 22%), radial-gradient(circle at 12% 85%, rgba(99,102,241,.16), transparent 28%), linear-gradient(135deg,#ffffff 0%,#eff6ff 52%,#dbeafe 82%,#bfdbfe 120%)",
    destaque: "#1d4ed8",
    destaque2: "#0891b2",
    texto: "#0f172a",
    apoio: "#334155",
    caixa: "rgba(255,255,255,.86)",
  },
};


/*
 * =====================================================
 * MOTOR BANNER EXPRESS IA — FÓRMULA PAIIA
 * =====================================================
 *
 * O usuário informa somente:
 * FOTO + OBJETIVO + PREÇO (quando necessário).
 *
 * A programação aplica automaticamente:
 * 1. Hierarquia: produto > benefício > preço > CTA > marca.
 * 2. Máximo de informação visual: 1 título + 1 apoio + 1 CTA.
 * 3. Produto ocupa a maior área útil sem encostar nas bordas.
 * 4. Contraste alto entre fundo, texto e preço.
 * 5. Logo sempre menor que o produto e a oferta.
 * 6. Preço promocional recebe o maior destaque comercial.
 * 7. Margens seguras para Instagram, Facebook, Story e Reels.
 * 8. Sem poluição visual, sem textos repetidos e sem elementos inúteis.
 * 9. Exportação no tamanho real do formato selecionado.
 * 10. Layout alternativo automático sem exigir editor manual.
 */
const COPYS_AUTOMATICAS = {
  oferta: [
    {
      chamada: "OFERTA ESPECIAL",
      titulo: "APROVEITE AGORA",
      apoio: "Condição especial por tempo limitado",
      cta: "COMPRE AGORA",
    },
    {
      chamada: "PREÇO ESPECIAL",
      titulo: "OFERTA IMPERDÍVEL",
      apoio: "Qualidade para o seu carro com condição especial",
      cta: "GARANTA O SEU",
    },
    {
      chamada: "PROMOÇÃO",
      titulo: "É HORA DE APROVEITAR",
      apoio: "Estoque limitado. Consulte disponibilidade",
      cta: "FALE COM A GENTE",
    },
  ],
  produto: [
    {
      chamada: "PRODUTO EM DESTAQUE",
      titulo: "QUALIDADE QUE FAZ DIFERENÇA",
      apoio: "Peça automotiva selecionada para desempenho e confiança",
      cta: "CONSULTE APLICAÇÕES",
    },
    {
      chamada: "DESTAQUE PAIIA",
      titulo: "A PEÇA CERTA PARA O SEU CARRO",
      apoio: "Confira compatibilidade antes da compra",
      cta: "CONSULTE AGORA",
    },
    {
      chamada: "ESCOLHA INTELIGENTE",
      titulo: "DESEMPENHO E CONFIANÇA",
      apoio: "Produto selecionado para manutenção automotiva",
      cta: "FALE COM A GENTE",
    },
  ],
  horario: [
    {
      chamada: "HORÁRIO DE ATENDIMENTO",
      titulo: "ESTAMOS PRONTOS PARA ATENDER",
      apoio: "Consulte nosso horário e fale com a equipe",
      cta: "CHAME NO WHATSAPP",
    },
    {
      chamada: "ATENDIMENTO",
      titulo: "CONTE COM A NOSSA EQUIPE",
      apoio: "Informação rápida e atendimento especializado",
      cta: "FALE COM A GENTE",
    },
  ],
  institucional: [
    {
      chamada: "COMUNICADO",
      titulo: "INFORMAÇÃO IMPORTANTE",
      apoio: "Acompanhe nossas novidades e condições especiais",
      cta: "SAIBA MAIS",
    },
    {
      chamada: "NOVIDADE",
      titulo: "TEM NOVIDADE POR AQUI",
      apoio: "Mais agilidade, qualidade e atendimento para você",
      cta: "FALE COM A GENTE",
    },
  ],
};

function obterCopyAutomatica(objetivo, indice = 0) {
  const lista =
    COPYS_AUTOMATICAS[objetivo] ||
    COPYS_AUTOMATICAS.produto;

  return lista[indice % lista.length];
}

function normalizarGaleria(galeria = []) {
  return (Array.isArray(galeria) ? galeria : [])
    .map((item, index) => {
      if (typeof item === "string") {
        return {
          id: `img-${index}-${item}`,
          url: item,
        };
      }

      const url =
        item?.imagem_processada ||
        item?.imagem_original ||
        item?.url ||
        item?.src ||
        "";

      return {
        id:
          item?.id ||
          `img-${index}-${url}`,
        url,
      };
    })
    .filter((item) => item.url);
}

function lerArquivoComoDataUrl(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();

    leitor.onload = () =>
      resolve(String(leitor.result || ""));

    leitor.onerror = () =>
      reject(
        new Error(
          "Não foi possível carregar o arquivo."
        )
      );

    leitor.readAsDataURL(arquivo);
  });
}

function escaparHtml(valor = "") {
  return String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Limita a foto a um tamanho seguro antes da remoção de fundo
// (celular não trava nem estoura memória). Só escala uniforme.
const LADO_MAXIMO_PRODUTO_BANNER = 1600;

function limitarTamanhoImagem(imagem, ladoMaximo = LADO_MAXIMO_PRODUTO_BANNER) {
  const largura = imagem.naturalWidth || imagem.width;
  const altura = imagem.naturalHeight || imagem.height;
  const maior = Math.max(largura, altura);

  if (!maior || maior <= ladoMaximo) {
    return imagem;
  }

  const escala = ladoMaximo / maior;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(largura * escala));
  canvas.height = Math.max(1, Math.round(altura * escala));
  const contexto = canvas.getContext("2d");
  contexto.imageSmoothingEnabled = true;
  contexto.imageSmoothingQuality = "high";
  contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// Guarda o logo ORIGINAL importado pelo usuário (mesmo arquivo, sem
// reprocessar). Só um arquivo muito grande é reduzido em tamanho, em PNG,
// mantendo proporção, cores e transparência.
async function reduzirLogo(arquivo, ladoMaximo = 1024) {
  const dataUrl = await lerArquivoComoDataUrl(arquivo);
  const imagem = await carregarImagemParaCanvas(dataUrl);

  if (dataUrl.length < 1200000) {
    return dataUrl;
  }

  const reduzida = limitarTamanhoImagem(imagem, ladoMaximo);

  const canvas =
    reduzida instanceof HTMLCanvasElement
      ? reduzida
      : (() => {
          const c = document.createElement("canvas");
          c.width = imagem.naturalWidth || imagem.width;
          c.height = imagem.naturalHeight || imagem.height;
          c.getContext("2d").drawImage(imagem, 0, 0);
          return c;
        })();

  return canvas.toDataURL("image/png");
}

function salvarKitMarcaLocal(marca) {
  try {
    localStorage.setItem("appiaKitMarca", JSON.stringify(marca));
  } catch {
    // Sem espaço no navegador: tenta guardar sem o logo.
    try {
      localStorage.setItem(
        "appiaKitMarca",
        JSON.stringify({ ...marca, logo: "" })
      );
    } catch {
      // armazenamento local indisponível; a tela continua funcionando
    }
  }
}

function carregarImagemParaCanvas(fonte) {
  return new Promise((resolve, reject) => {
    const imagem = new Image();
    imagem.crossOrigin = "anonymous";
    imagem.onload = () => resolve(imagem);
    imagem.onerror = () => reject(
      new Error("Não foi possível carregar uma das imagens do banner.")
    );
    imagem.src = fonte;
  });
}


// =====================================================
// REMOÇÃO DE FUNDO BRANCO — PROTEGIDA (Banner Express)
// - Só remove fundo claro e uniforme ligado às bordas da foto.
// - Borda "degrau" (sombra/contorno) interrompe a remoção, então
//   peças brancas/claras não são "comidas".
// - Se a remoção tolerante apagar bem mais que a conservadora,
//   usa a conservadora. Se o resultado parecer errado, mantém a
//   foto original. A peça nunca é redesenhada ou alterada: só os
//   pixels do fundo ficam transparentes.
// =====================================================
function analisarFundoPelaBorda(pixels, largura, altura) {
  const amostras = [];
  const passo = Math.max(1, Math.floor(Math.max(largura, altura) / 400));

  const coletar = (x, y) => {
    const i = (y * largura + x) * 4;
    amostras.push([pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]]);
  };

  for (let x = 0; x < largura; x += passo) {
    coletar(x, 0);
    coletar(x, altura - 1);
  }
  for (let y = 0; y < altura; y += passo) {
    coletar(0, y);
    coletar(largura - 1, y);
  }

  const claros = amostras.filter(([r, g, b, a]) => {
    if (a <= 12) return true;
    const minimo = Math.min(r, g, b);
    const maximo = Math.max(r, g, b);
    return minimo >= 225 && maximo - minimo <= 24;
  });

  const fracaoClara = amostras.length
    ? claros.length / amostras.length
    : 0;

  const mediana = (canal) => {
    const valores = claros
      .filter((item) => item[3] > 12)
      .map((item) => item[canal])
      .sort((a, b) => a - b);
    return valores.length
      ? valores[Math.floor(valores.length / 2)]
      : 255;
  };

  return {
    fracaoClara,
    fundo: [mediana(0), mediana(1), mediana(2)],
  };
}

function inundarFundo({
  pixels,
  largura,
  altura,
  fundo,
  tolerancia,
  degrauMaximo,
}) {
  const total = largura * altura;
  const removidos = new Uint8Array(total);
  const fila = new Int32Array(total);
  let inicioFila = 0;
  let fimFila = 0;

  const pertoDoFundo = (indicePixel) => {
    const i = indicePixel * 4;
    if (pixels[i + 3] <= 12) return true;
    return (
      Math.abs(pixels[i] - fundo[0]) <= tolerancia &&
      Math.abs(pixels[i + 1] - fundo[1]) <= tolerancia &&
      Math.abs(pixels[i + 2] - fundo[2]) <= tolerancia
    );
  };

  const degrau = (a, b) => {
    const i = a * 4;
    const j = b * 4;
    return Math.max(
      Math.abs(pixels[i] - pixels[j]),
      Math.abs(pixels[i + 1] - pixels[j + 1]),
      Math.abs(pixels[i + 2] - pixels[j + 2])
    );
  };

  const tentar = (indicePixel, origem) => {
    if (removidos[indicePixel]) return;
    if (!pertoDoFundo(indicePixel)) return;
    if (origem >= 0 && degrau(indicePixel, origem) > degrauMaximo) return;
    removidos[indicePixel] = 1;
    fila[fimFila] = indicePixel;
    fimFila += 1;
  };

  for (let x = 0; x < largura; x += 1) {
    tentar(x, -1);
    tentar((altura - 1) * largura + x, -1);
  }
  for (let y = 1; y < altura - 1; y += 1) {
    tentar(y * largura, -1);
    tentar(y * largura + largura - 1, -1);
  }

  while (inicioFila < fimFila) {
    const atual = fila[inicioFila];
    inicioFila += 1;
    const x = atual % largura;
    const y = Math.floor(atual / largura);
    if (x > 0) tentar(atual - 1, atual);
    if (x + 1 < largura) tentar(atual + 1, atual);
    if (y > 0) tentar(atual - largura, atual);
    if (y + 1 < altura) tentar(atual + largura, atual);
  }

  return { removidos, quantidade: fimFila };
}

function removerFundoBrancoConectadoAsBordas(imagem, opcoes = {}) {
  const resultado = removerFundoBrancoProtegido(imagem, opcoes);
  return resultado.imagem;
}

function removerFundoBrancoProtegido(imagem, opcoes = {}) {
  const semRemocao = (motivo) => ({
    imagem,
    aplicado: false,
    motivo,
  });

  if (opcoes?.ativo === false) {
    return semRemocao("desativado");
  }

  const largura = imagem.naturalWidth || imagem.width;
  const altura = imagem.naturalHeight || imagem.height;
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;

  const contexto = canvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!contexto || !largura || !altura) {
    return semRemocao("sem-canvas");
  }

  contexto.drawImage(imagem, 0, 0, largura, altura);

  let dadosImagem;
  try {
    dadosImagem = contexto.getImageData(0, 0, largura, altura);
  } catch {
    return semRemocao("imagem-protegida");
  }

  const pixels = dadosImagem.data;
  const total = largura * altura;
  const { fracaoClara, fundo } = analisarFundoPelaBorda(
    pixels,
    largura,
    altura
  );

  // Fundo não é branco/uniforme: não mexe na foto.
  if (fracaoClara < 0.6) {
    return semRemocao("fundo-nao-uniforme");
  }

  const tolerante = inundarFundo({
    pixels,
    largura,
    altura,
    fundo,
    tolerancia: 20,
    degrauMaximo: 10,
  });
  const conservadora = inundarFundo({
    pixels,
    largura,
    altura,
    fundo,
    tolerancia: 8,
    degrauMaximo: 6,
  });

  // Se a versão tolerante apaga muito mais, provavelmente entrou
  // em partes claras da peça: usa a conservadora.
  const diferenca =
    (tolerante.quantidade - conservadora.quantidade) / total;
  const escolhida = diferenca > 0.06 ? conservadora : tolerante;

  const restantes = total - escolhida.quantidade;
  if (restantes < total * 0.02) {
    // Sobraria quase nada: foto provavelmente toda clara.
    return semRemocao("peca-clara-demais");
  }

  for (let indicePixel = 0; indicePixel < total; indicePixel += 1) {
    if (escolhida.removidos[indicePixel]) {
      pixels[indicePixel * 4 + 3] = 0;
    }
  }

  contexto.putImageData(dadosImagem, 0, 0);

  let minimoX = largura;
  let minimoY = altura;
  let maximoX = -1;
  let maximoY = -1;

  for (let y = 0; y < altura; y += 1) {
    for (let x = 0; x < largura; x += 1) {
      const alpha = pixels[(y * largura + x) * 4 + 3];
      if (alpha <= 12) continue;
      minimoX = Math.min(minimoX, x);
      minimoY = Math.min(minimoY, y);
      maximoX = Math.max(maximoX, x);
      maximoY = Math.max(maximoY, y);
    }
  }

  if (maximoX < minimoX || maximoY < minimoY) {
    return semRemocao("sem-peca");
  }

  const margemSegura = Math.max(
    2,
    Math.round(
      Math.max(maximoX - minimoX + 1, maximoY - minimoY + 1) * 0.018
    )
  );
  const origemX = Math.max(0, minimoX - margemSegura);
  const origemY = Math.max(0, minimoY - margemSegura);
  const limiteX = Math.min(largura, maximoX + margemSegura + 1);
  const limiteY = Math.min(altura, maximoY + margemSegura + 1);
  const recorte = document.createElement("canvas");
  recorte.width = limiteX - origemX;
  recorte.height = limiteY - origemY;
  const contextoRecorte = recorte.getContext("2d");

  if (!contextoRecorte) {
    return {
      imagem: canvas,
      aplicado: true,
      motivo: escolhida === conservadora ? "conservadora" : "normal",
    };
  }

  contextoRecorte.drawImage(
    canvas,
    origemX,
    origemY,
    recorte.width,
    recorte.height,
    0,
    0,
    recorte.width,
    recorte.height
  );

  return {
    imagem: recorte,
    aplicado: true,
    motivo: escolhida === conservadora ? "conservadora" : "normal",
  };
}

// Foto original do banner: nunca vai em base64 para o banco.
// Se não for URL, sobe para o Storage e devolve a URL pública.
async function obterUrlImagemOriginalBanner(
  fonte,
  usuarioId,
  carimbo
) {
  const valor = String(fonte || "").trim();

  if (!valor) {
    return null;
  }

  if (/^https?:\/\//i.test(valor)) {
    return valor;
  }

  if (
    !valor.startsWith("data:") &&
    !valor.startsWith("blob:")
  ) {
    return null;
  }

  try {
    const resposta = await fetch(valor);
    const blob = await resposta.blob();

    if (!blob?.size) {
      return null;
    }

    const extensao =
      blob.type === "image/jpeg"
        ? "jpg"
        : blob.type === "image/webp"
          ? "webp"
          : "png";

    const caminho =
      `${usuarioId}/banners/paiia-banner-${carimbo}-original.${extensao}`;

    const { error: erroUpload } =
      await supabase.storage
        .from("imagens")
        .upload(caminho, blob, {
          contentType:
            blob.type || "image/png",
          upsert: true,
        });

    if (erroUpload) {
      console.warn(
        "Foto original do banner não enviada ao Storage:",
        erroUpload
      );
      return null;
    }

    const { data: dadosPublicos } =
      supabase.storage
        .from("imagens")
        .getPublicUrl(caminho);

    return dadosPublicos?.publicUrl || null;
  } catch (erro) {
    console.warn(
      "Foto original do banner não enviada ao Storage:",
      erro
    );
    return null;
  }
}

export default function BannerStudio({
  galeria = [],
  galeriaTemMais = false,
  carregarMaisGaleria,
  setScreen,
  cardStyle,
}) {
  const previewRef = useRef(null);

  const [usuario, setUsuario] = useState(null);

useEffect(() => {
  async function carregarUsuario() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error(
        "Erro ao carregar usuário no Banner Express:",
        error
      );
      return;
    }

    setUsuario(user || null);
  }

  carregarUsuario();
}, []);

  const [formato, setFormato] =
    useState("instagram");

  const [objetivo, setObjetivo] =
    useState("oferta");

  const [paleta, setPaleta] =
    useState("azul");

  const [pedidoAppia, setPedidoAppia] =
    useState("");

  const [modeloSelecionado, setModeloSelecionado] =
    useState("");

  // Dados comerciais visíveis por padrão (preço, código, logo, site, WhatsApp).
  const [mostrarExtras, setMostrarExtras] =
    useState(true);

  const [precoPedido, setPrecoPedido] =
    useState("");

  const [copyPedido, setCopyPedido] =
    useState(null);

  const [bannerGerado, setBannerGerado] =
    useState(false);

  const [fundoIA, setFundoIA] =
    useState("");

  const [bannerSalvo, setBannerSalvo] =
    useState(false);

  const [gerandoFundoIA, setGerandoFundoIA] =
    useState(false);

  const [erroFundoIA, setErroFundoIA] =
    useState("");

  const [imagemSelecionada, setImagemSelecionada] =
  useState("");

  // Campos comerciais estruturados (nunca inventados pela IA).
  const [codigoProduto, setCodigoProduto] =
    useState("");
  const [exibirComercial, setExibirComercial] =
    useState(() => {
      try {
        return {
          ...EXIBIR_PADRAO,
          ...JSON.parse(
            localStorage.getItem("paiiaBannerExibir") || "{}"
          ),
        };
      } catch {
        return { ...EXIBIR_PADRAO };
      }
    });
  // Chamada curta opcional no formato Mercado Livre.
  const [chamadaMl, setChamadaMl] =
    useState("");
  // Cenário criado com IA (OpenAI). Sem IA, usa o cenário PAIIA.
  const [usarIA, setUsarIA] =
    useState(() => {
      try {
        return (
          localStorage.getItem("paiiaBannerUsarIA") !== "false"
        );
      } catch {
        return true;
      }
    });
  const [infoIA, setInfoIA] = useState("");
  // Falha da IA: mostrada com a causa e opção de tentar de novo.
  const [falhaIA, setFalhaIA] = useState(null);
  // Ponto de partida das variações (cada "Gerar novamente" muda a composição).
  const [sementeVariacao] = useState(() =>
    Math.floor(Math.random() * 997)
  );

  // Diferenciais que o usuário marca (selos). Nunca inventados pela IA.
  const [diferenciais, setDiferenciais] = useState(() => {
    try {
      const salvos = JSON.parse(localStorage.getItem("paiiaBannerDiferenciais") || "[]");
      return Array.isArray(salvos) ? salvos.filter((id) => DIFERENCIAIS[id]) : [];
    } catch {
      return [];
    }
  });

  function alternarDiferencial(id) {
    setDiferenciais((atual) => {
      const novo = atual.includes(id)
        ? atual.filter((item) => item !== id)
        : [...atual, id].slice(-3);
      try {
        localStorage.setItem("paiiaBannerDiferenciais", JSON.stringify(novo));
      } catch {
        // opcional
      }
      return novo;
    });
  }

  function alternarExibir(campo) {
    setExibirComercial((atual) => {
      const novo = { ...atual, [campo]: !atual[campo] };
      try {
        localStorage.setItem(
          "paiiaBannerExibir",
          JSON.stringify(novo)
        );
      } catch {
        // preferência só local
      }
      return novo;
    });
  }

  function alternarUsarIA(ativo) {
    setUsarIA(ativo);
    try {
      localStorage.setItem(
        "paiiaBannerUsarIA",
        ativo ? "true" : "false"
      );
    } catch {
      // preferência só local
    }
  }

  // Remoção automática do fundo branco (pode ser desativada).
  const [removerFundoAuto, setRemoverFundoAuto] =
    useState(() => {
      try {
        return (
          localStorage.getItem(
            "paiiaBannerRemoverFundo"
          ) !== "false"
        );
      } catch {
        return true;
      }
    });

  // URL pública do banner já salvo (evita repassar base64 adiante).
  const urlBannerSalvoRef = useRef("");
  // Evita salvar duas vezes com cliques repetidos.
  const salvandoRef = useRef(false);
  // Parâmetros exatos da arte gerada (reabrir/editar e exportar por canal).
  const [parametrosArte, setParametrosArte] = useState(null);
  const [bannerNoAnuncio, setBannerNoAnuncio] = useState(false);
  const inputFotoAparelhoRef = useRef(null);
  // Detalhes da última arte (layout, cenário, IA, campos bloqueados).
  const ultimoRegistroRef = useRef(null);

  function alternarRemoverFundoAuto(ativo) {
    setRemoverFundoAuto(ativo);
    try {
      localStorage.setItem(
        "paiiaBannerRemoverFundo",
        ativo ? "true" : "false"
      );
    } catch {
      // preferência só local
    }
  }

  const [mostrarGaleria, setMostrarGaleria] =
    useState(false);
  const [carregandoGaleria, setCarregandoGaleria] =
  useState(false);
  

  /*
   * Conteúdo textual 100% automático.
   * O usuário não precisa digitar título, preço ou chamada.
   */
  const [versaoIA, setVersaoIA] =
    useState(0);

  const [aprovado, setAprovado] =
    useState(false);

  const copyAutomatica =
    useMemo(
      () =>
        obterCopyAutomatica(
          objetivo,
          versaoIA
        ),
      [objetivo, versaoIA]
    );

  const titulo =
    copyAutomatica.titulo;

  const preco = "";
  const precoAnterior = "";

  const textoExtra =
    copyAutomatica.apoio;

  const [layout, setLayout] =
    useState(1);

  const [status, setStatus] =
    useState("");

  const [mostrarMarca, setMostrarMarca] =
    useState(false);

  const [marca, setMarca] =
    useState(() => {
      try {
        const salvo =
          localStorage.getItem(
            "appiaKitMarca"
          );

        if (salvo) {
          return JSON.parse(salvo);
        }
      } catch {
        // segue com padrão
      }

      return {
        nome: "",
        telefone: "",
        email: "",
        site: "",
        endereco: "",
        logo: "",
      };
    });

  const imagensDisponiveis =
    useMemo(
      () =>
        normalizarGaleria(
          (Array.isArray(galeria) ? galeria : []).filter(
            (item) =>
              typeof item === "string" ||
              !["banner", "clip", "video", "mascote"].includes(
                String(item?.tipo || "").toLowerCase()
              )
          )
        ),
      [galeria]
    );
useEffect(() => {
  if (!mostrarGaleria) {
    setCarregandoGaleria(false);
    return;
  }

  if (imagensDisponiveis.length > 0) {
    setCarregandoGaleria(false);
    return;
  }

  setCarregandoGaleria(true);

  const timer = window.setTimeout(() => {
    setCarregandoGaleria(false);
  }, 4000);

  return () => {
    window.clearTimeout(timer);
  };
}, [
  mostrarGaleria,
  imagensDisponiveis.length,
]);

  const assinaturaSalvaRef = useRef("");

  // A arte gerada continua válida enquanto as opções não mudarem.
  const assinaturaAtual = useMemo(
    () =>
      assinaturaArteBanner({
        formato,
        paleta,
        objetivo: formato === "mercadoLivre" ? "produto" : objetivo,
        imagem: imagemSelecionada,
        preco:
          formato === "mercadoLivre"
            ? ""
            : formatarPrecoBanner(precoPedido),
        removerFundo: removerFundoAuto,
        marca,
        codigo: formato === "mercadoLivre" ? "" : codigoProduto,
        exibir: exibirComercial,
        chamadaMl: formato === "mercadoLivre" ? chamadaMl : "",
        diferenciais: formato === "mercadoLivre" ? [] : diferenciais,
      }),
    [
      diferenciais,
      formato,
      paleta,
      objetivo,
      imagemSelecionada,
      precoPedido,
      removerFundoAuto,
      marca,
      codigoProduto,
      exibirComercial,
      chamadaMl,
    ]
  );

  const arteDesatualizada = Boolean(
    bannerGerado &&
      parametrosArte &&
      assinaturaArteBanner(parametrosArte) !== assinaturaAtual
  );

  const arteLiberada = Boolean(
    bannerGerado && fundoIA && !arteDesatualizada && !gerandoFundoIA
  );

  function temAnuncioEmAndamento() {
    try {
      return Boolean(
        localStorage.getItem("novoAnuncioTemporario") ||
          localStorage.getItem("rascunhoNovoAnuncioTemp")
      );
    } catch {
      return false;
    }
  }

  function selecionarFotoDoAparelho(evento) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = "";

    if (!arquivo) {
      return;
    }

    if (!String(arquivo.type || "").startsWith("image/")) {
      alert("Escolha um arquivo de imagem (JPG, PNG ou WEBP).");
      return;
    }

    setImagemSelecionada(URL.createObjectURL(arquivo));
    setMostrarGaleria(false);
  }

  const dadosFormato =
    FORMATOS[formato];

  const dadosObjetivo =
    OBJETIVOS.find(
      (item) =>
        item.id === objetivo
    ) || OBJETIVOS[0];


  const cores =
    PALETAS[paleta];

 useEffect(() => {
  const continuarGaleria =
    localStorage.getItem(
      "abrirBannerAutomatico"
    ) === "true";
  const novaCriacao =
    deveIniciarNovaCriacaoMidia();
  const imagemDaGaleria =
    localStorage.getItem(
      "imagemBannerSelecionada"
    );

  if (
    (continuarGaleria || !novaCriacao) &&
    imagemDaGaleria
  ) {
    setImagemSelecionada(
      imagemDaGaleria
    );
  } else {
    setImagemSelecionada("");
  }

  if (novaCriacao) {
    consumirNovaCriacaoMidia();
    setObjetivo("oferta");
    setFormato("instagram");
    setPaleta("azul");
  }

  if (continuarGaleria) {
    localStorage.removeItem(
      "abrirBannerAutomatico"
    );
  }

  setVersaoIA(0);
  setLayout(1);
  setAprovado(false);
  setStatus("");
  setPedidoAppia("");
  setPrecoPedido("");
  setCopyPedido(null);
  setBannerGerado(false);
  setFundoIA("");
  setBannerSalvo(false);
  setGerandoFundoIA(false);
  setErroFundoIA("");

  setParametrosArte(null);
  setBannerNoAnuncio(false);

  // Reabrir um banner da Galeria para editar.
  const bannerParaEditar =
    localStorage.getItem("bannerParaEditar") || "";
  localStorage.removeItem("bannerParaEditar");

  if (bannerParaEditar) {
    const urlParametros = bannerParaEditar
      .split("?")[0]
      .replace(/\.png$/i, ".json");

    fetch(urlParametros)
      .then((resposta) => (resposta.ok ? resposta.json() : null))
      .then((dados) => {
        if (!dados || typeof dados !== "object") {
          setStatus(
            "ℹ️ Este banner foi criado antes da edição ser possível. Monte um novo com a mesma foto."
          );
          return;
        }

        if (FORMATOS[dados.formato]) setFormato(dados.formato);
        if (PALETAS[dados.paleta]) setPaleta(dados.paleta);
        if (OBJETIVOS.some((item) => item.id === dados.objetivo)) {
          setObjetivo(dados.objetivo);
        }
        if (dados.imagem) setImagemSelecionada(dados.imagem);
        setPrecoPedido(dados.preco || "");
        setCodigoProduto(dados.codigo || "");
        if (dados.exibir && typeof dados.exibir === "object") {
          setExibirComercial({ ...EXIBIR_PADRAO, ...dados.exibir });
        }
        setChamadaMl(dados.chamadaMl || "");
        setCopyPedido(dados.copy || null);
        if (dados.layout === 1 || dados.layout === 2) {
          setLayout(dados.layout === 1 ? 2 : 1);
        }
        setStatus(
          "✏️ Banner reaberto para edição. Ajuste o que quiser e clique em Gerar Banner."
        );
      })
      .catch(() => {
        setStatus(
          "⚠️ Não foi possível reabrir os dados deste banner."
        );
      });
  }
}, []);

  useEffect(() => {
    salvarKitMarcaLocal(marca);
  }, [marca]);

  // Completa o nome com os dados da empresa já cadastrados no PAIIA
  // (mascote oficial). Nunca substitui o que o usuário já preencheu.
  useEffect(() => {
    if (!usuario?.id) return;
    let ativo = true;
    buscarMascoteOficial(usuario.id)
      .then((oficial) => {
        if (!ativo || !oficial) return;
        const empresa = String(oficial.empresa || "").trim();
        // O logo NÃO é puxado do cadastro do mascote (pode ter sido criado
        // por IA): no banner entra só o logo importado pelo usuário.
        setMarca((atual) => ({
          ...atual,
          nome: atual.nome || empresa,
        }));
      })
      .catch(() => {
        // sem cadastro: segue com o kit da marca local
      });
    return () => {
      ativo = false;
    };
  }, [usuario?.id]);

  // Completa nome da loja e WhatsApp com o cadastro do PAIIA (login).
  // Nunca substitui o que o usuário já preencheu no kit da marca.
  useEffect(() => {
    const dados = usuario?.user_metadata || {};
    const nomeLoja = String(dados.nome_loja || "").trim();
    const telefoneCadastro = String(dados.telefone || "").trim();
    if (!nomeLoja && !telefoneCadastro) return;
    setMarca((atual) => ({
      ...atual,
      nome: atual.nome || nomeLoja,
      telefone: atual.telefone || telefoneCadastro,
    }));
  }, [usuario?.id, usuario?.user_metadata]);

  // Completa preço e código com o anúncio em andamento (Novo Anúncio),
  // só quando os campos do banner ainda estão vazios.
  useEffect(() => {
    let rascunho = null;
    for (const chave of ["novoAnuncioTemporario", "rascunhoNovoAnuncioTemp"]) {
      try {
        const salvo = JSON.parse(localStorage.getItem(chave) || "null");
        if (salvo && typeof salvo === "object" && (salvo.codigo || salvo.preco)) {
          rascunho = salvo;
          break;
        }
      } catch {
        // rascunho ilegível: ignora
      }
    }
    if (!rascunho) return;
    const codigoRascunho = String(rascunho.codigo || "").trim();
    const precoRascunho = String(rascunho.preco ?? "").trim();
    if (codigoRascunho) {
      setCodigoProduto((atual) => atual || codigoRascunho);
    }
    if (precoRascunho && Number(precoRascunho.replace(/[^\d,.]/g, "").replace(",", ".")) > 0) {
      setPrecoPedido((atual) => atual || precoRascunho);
    }
  }, []);

  useEffect(() => {
    setAprovado(false);
    setBannerSalvo(false);
  }, [
    objetivo,
    formato,
    paleta,
    imagemSelecionada,
    marca.logo,
  ]);

  function formatarPreco(valor) {
    return formatarPrecoBanner(valor);
  }

  function interpretarPedidoAppia() {
    const original =
      String(pedidoAppia || "").trim();

    const pedido =
      original
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

    let novoObjetivo = "produto";
    let novaPaleta = paleta;
    // Mantém o formato que o usuário escolheu; só troca se o texto pedir.
    let novoFormato = formatoCitadoNoTexto(original) || formato;

    if (
      /promoc|oferta|desconto|r\$|preco|por\s+\d/.test(
        pedido
      )
    ) {
      novoObjetivo = "oferta";
    } else if (
      /horario|funcionamento|atendimento/.test(
        pedido
      )
    ) {
      novoObjetivo = "horario";
    } else if (
      /comunicado|aviso|novidade|institucional/.test(
        pedido
      )
    ) {
      novoObjetivo = "institucional";
    }

    if (
      /vermelh|fundo b|cor b/.test(
        pedido
      )
    ) {
      novaPaleta = "vermelho";
    } else if (
      /preto|grafite|dark|escuro|fundo c|cor c/.test(
        pedido
      )
    ) {
      novaPaleta = "escuro";
    } else if (
      /branco|clean|claro|fundo d|cor d/.test(
        pedido
      )
    ) {
      novaPaleta = "clean";
    } else if (
      /azul|ciano|fundo a|cor a/.test(
        pedido
      )
    ) {
      novaPaleta = "azul";
    }

    // O preço digitado em "Informações extras" sempre vale mais.
    const precoFormatado =
      formatarPrecoBanner(precoPedido) ||
      extrairPrecoDoTexto(original);

    let tituloGerado =
      "QUALIDADE PARA O SEU CARRO";

    let apoioGerado =
      "Consulte aplicações e disponibilidade";

    let ctaGerado =
      "FALE COM A GENTE";

    if (novoObjetivo === "oferta") {
      tituloGerado =
        /pronta entrega/.test(pedido)
          ? "OFERTA • PRONTA ENTREGA"
          : "OFERTA ESPECIAL";

      apoioGerado =
        /envio rapido|envio rápido/.test(original.toLowerCase())
          ? "Envio rápido • Consulte aplicações"
          : "Aproveite esta condição especial";

      ctaGerado =
        /whatsapp|fale|chame/.test(pedido)
          ? "CHAME NO WHATSAPP"
          : "APROVEITE AGORA";
    } else if (novoObjetivo === "horario") {
      tituloGerado =
        "HORÁRIO DE ATENDIMENTO";
      apoioGerado =
        "Estamos prontos para atender você";
      ctaGerado =
        "FALE COM A GENTE";
    } else if (novoObjetivo === "institucional") {
      tituloGerado =
        "COMUNICADO";
      apoioGerado =
        "Informação importante para nossos clientes";
      ctaGerado =
        "SAIBA MAIS";
    } else {
      tituloGerado =
        /premium|sofistic/.test(pedido)
          ? "QUALIDADE PREMIUM"
          : "PRODUTO EM DESTAQUE";

      apoioGerado =
        /aplicac/.test(pedido)
          ? "Consulte aplicações antes da compra"
          : "Qualidade e confiança para o seu carro";

      ctaGerado =
        "CONSULTE AGORA";
    }

    // Estilo escolhido nos botões (texto sem edição): chamada própria do estilo.
    const estiloEscolhido = COPIA_POR_ESTILO[modeloSelecionado];
    const textoDoEstilo = MODELOS_DESCRICAO.find(
      (modelo) => modelo.id === modeloSelecionado
    )?.texto;
    if (estiloEscolhido && original === String(textoDoEstilo || "").trim()) {
      novoObjetivo = estiloEscolhido.objetivo;
      tituloGerado = estiloEscolhido.titulo;
      apoioGerado = estiloEscolhido.apoio;
      ctaGerado = estiloEscolhido.cta;
    }

    setObjetivo(novoObjetivo);
    setPaleta(novaPaleta);
    setFormato(novoFormato);
    if (precoFormatado) {
      setPrecoPedido(precoFormatado);
    }
    const copyGerada = {
      chamada:
        novoObjetivo === "oferta"
          ? "OFERTA ESPECIAL"
          : novoObjetivo === "horario"
            ? "ATENDIMENTO"
            : novoObjetivo === "institucional"
              ? "COMUNICADO"
              : "DESTAQUE",
      titulo: tituloGerado,
      apoio: apoioGerado,
      cta: ctaGerado,
    };

    setCopyPedido(copyGerada);

    return {
      objetivo: novoObjetivo,
      paleta: novaPaleta,
      formato: novoFormato,
      preco: precoFormatado,
      copy: copyGerada,
    };
  }

  // Monta a arte: cenário (IA OpenAI ou PAIIA) + foto real da peça
  // colada por cima + textos e dados comerciais desenhados pelo PAIIA.
  // No Mercado Livre, preço, código, logo, site e WhatsApp são
  // bloqueados automaticamente, mesmo preenchidos.
  // Diretor de arte: o usuário escolhe formato, estilo e cor; o PAIIA
  // decide cenário, composição, luz e hierarquia. A IA cria só a arte de
  // fundo; a foto real, o logo e os dados comerciais entram por cima,
  // exatamente como foram informados.
  async function montarArteComDiretor({
    parametros,
    largura,
    altura,
    produto,
    proporcaoProduto,
    comerciais,
    variacao,
    opcoes = {},
  }) {
    const objetivoDiretor = objetivoDoDiretor(parametros.estilo, parametros.objetivo);
    const copyUsuario = parametros.copyPersonalizada ? parametros.copy || {} : {};
    const decisao = decidirDirecaoDeArte({
      objetivo: objetivoDiretor,
      variacao,
      titulo: copyUsuario.titulo,
      apoio: copyUsuario.apoio,
      cta: copyUsuario.cta,
    });
    const quadro = tamanhoQuadroIA(largura, altura);
    const plano = planejarDiretor({
      largura,
      altura,
      proporcaoProduto,
      decisao,
      diferenciais: parametros.diferenciais,
      quadro,
    });

    let cenarioIA = null;
    let resultadoIA = null;
    if (opcoes.usarIANesta) {
      try {
        const retanguloNoQuadro = mapearParaQuadroIA(plano.peca, { largura, altura }, quadro);
        const referencia = montarBaseCenarioParaIA({
          retanguloNoQuadro,
          quadro,
          paletaId: parametros.paleta,
        });
        const resposta = await gerarCenarioComIA({
          supabase,
          referencia,
          mascara: "",
          tamanho: quadro.texto,
          formato: parametros.formato,
          paleta: parametros.paleta,
          estilo: parametros.estilo || parametros.objetivo,
          cenario: decisao.direcaoId,
          zonasLivres: plano.zonasTextoIA,
          pedestal: false,
          modo: "diretor-arte",
          zonaProduto: plano.zonaProdutoIA,
          direcao: decisao.direcaoId,
          objetivoDiretor,
          luz: decisao.luz,
          baseProduto: plano.baseProdutoIA,
          variacao,
        });
        cenarioIA = await carregarImagemParaCanvas(resposta.imagem);
        // Guarda o cenário para as versões em outros formatos (sem nova IA).
        parametros.cenarioIA = resposta.imagem;
        resultadoIA = { ok: true, ...resposta, imagem: undefined };
        console.info(
          `[PAIIA Banner IA] diretor de arte: estilo=${objetivoDiretor} direcao=${decisao.direcaoId} layout=${decisao.layout} modelo=${resposta.modelo} tempo=${(resposta.duracaoMs / 1000).toFixed(1)}s`
        );
      } catch (erro) {
        console.error("[PAIIA Banner IA] falha:", erro?.codigo, erro?.message, erro?.detalhe || "");
        resultadoIA = {
          ok: false,
          erro: erro?.message || "IA indisponível.",
          codigo: erro?.codigo || "",
          detalhe: erro?.detalhe || "",
        };
        if (opcoes.exigirIA) {
          const falha = new Error(resultadoIA.erro);
          falha.codigo = resultadoIA.codigo || "FALHA_IA";
          falha.falhaIA = true;
          falha.detalhe = resultadoIA.detalhe;
          throw falha;
        }
      }
    } else if (parametros.cenarioIA) {
      try {
        cenarioIA = await carregarImagemParaCanvas(parametros.cenarioIA);
      } catch {
        cenarioIA = null;
      }
    }

    let logoImagem = null;
    if (comerciais.logo) {
      try {
        logoImagem = await carregarImagemParaCanvas(comerciais.logo);
      } catch {
        logoImagem = null;
      }
    }

    const { dataUrl, registro } = await montarBannerDiretorArte({
      largura,
      altura,
      paletaId: PALETAS[parametros.paleta] ? parametros.paleta : "azul",
      produto,
      cenarioIA,
      decisao,
      comerciais,
      diferenciais: parametros.diferenciais || [],
      logoImagem,
    });
    registro.bloqueados = comerciais.bloqueados;
    registro.ia = resultadoIA;
    registro.decisao = { estilo: objetivoDiretor, direcao: decisao.direcaoId, layout: decisao.layout };
    ultimoRegistroRef.current = registro;
    return dataUrl;
  }

  async function montarArteBanner(
    parametros,
    formatoDestino,
    _paletaDestino,
    opcoes = {}
  ) {
    const formatoId =
      Object.keys(FORMATOS).find(
        (chave) => FORMATOS[chave] === formatoDestino
      ) || parametros.formato;
    const ehMl = formatoId === "mercadoLivre";
    const largura = formatoDestino.largura;
    const altura = formatoDestino.altura;
    const marcaArte = parametros.marca || {};

    const produtoOriginal = await carregarImagemParaCanvas(
      parametros.imagem
    );
    // Remoção de fundo protegida e opcional; a peça não é alterada.
    const produto = removerFundoBrancoConectadoAsBordas(
      limitarTamanhoImagem(produtoOriginal),
      { ativo: parametros.removerFundo !== false }
    );
    const larguraPeca = produto.naturalWidth || produto.width;
    const alturaPeca = produto.naturalHeight || produto.height;

    const comerciais = dadosComerciaisDoBanner({
      formato: formatoId,
      dados: {
        logo: marcaArte.logo,
        preco: parametros.preco,
        codigo: parametros.codigo,
        site: marcaArte.site,
        whatsapp: marcaArte.telefone,
        nomeLoja: marcaArte.nome,
      },
      exibir: parametros.exibir || EXIBIR_PADRAO,
      formatarPreco: formatarPrecoBanner,
    });
    const chamada = ehMl
      ? textoChamadaMercadoLivre(parametros.chamadaMl)
      : "";
    const variacao = Number(parametros.variacao) || 0;

    // Todos os formatos, exceto Mercado Livre: DIRETOR DE ARTE.
    if (!ehMl) {
      return montarArteComDiretor({
        parametros,
        largura,
        altura,
        produto,
        proporcaoProduto: larguraPeca / Math.max(1, alturaPeca),
        comerciais,
        variacao,
        opcoes,
      });
    }
    const plano = planejarLayout({
      largura,
      altura,
      formato: formatoId,
      proporcaoProduto: larguraPeca / Math.max(1, alturaPeca),
      variacao,
      temLogo: Boolean(comerciais.logo || comerciais.nomeLoja),
      temContato: Boolean(comerciais.whatsapp || comerciais.site),
      temChamadaMl: Boolean(chamada),
      temPreco: Boolean(comerciais.preco),
      temCodigo: Boolean(comerciais.codigo),
    });

    let cenarioIA = null;
    let resultadoIA = null;
    if (opcoes.usarIANesta) {
      try {
        const quadro = tamanhoQuadroIA(largura, altura);
        const retanguloNoQuadro = mapearParaQuadroIA(
          plano.produto,
          { largura, altura },
          quadro
        );
        // A IA recebe só uma base de cenário SEM a peça (nem silhueta):
        // assim ela não consegue alongar, duplicar ou redesenhar a peça.
        // A foto real é colada depois, intacta, com pedestal/sombra do PAIIA.
        const referencia = montarBaseCenarioParaIA({
          retanguloNoQuadro,
          quadro,
          paletaId: parametros.paleta,
        });
        const resposta = await gerarCenarioComIA({
          supabase,
          referencia,
          mascara: "",
          tamanho: quadro.texto,
          formato: formatoId,
          paleta: parametros.paleta,
          estilo: parametros.estilo || parametros.objetivo,
          cenario: plano.cenario.id,
          zonasLivres: descreverZonasLivres(plano, largura, altura),
          pedestal: false,
          modo: "cenario-vazio",
          zonaProduto: descreverZonaProduto(retanguloNoQuadro, quadro),
          variacao,
        });
        cenarioIA = await carregarImagemParaCanvas(resposta.imagem);
        resultadoIA = { ok: true, ...resposta, imagem: undefined };
        console.info(
          `[PAIIA Banner IA] cenário recebido da OpenAI: modelo=${resposta.modelo} origem=${resposta.origem} tempo=${(resposta.duracaoMs / 1000).toFixed(1)}s x-request-id=${resposta.idPedido || "-"}`
        );
      } catch (erro) {
        console.error("[PAIIA Banner IA] falha:", erro?.codigo, erro?.message, erro?.detalhe || "");
        resultadoIA = {
          ok: false,
          erro: erro?.message || "IA indisponível.",
          codigo: erro?.codigo || "",
          detalhe: erro?.detalhe || "",
        };
        // Com "Cenário com IA" marcado, a falha NÃO vira banner de fallback.
        if (opcoes.exigirIA) {
          const falha = new Error(resultadoIA.erro);
          falha.codigo = resultadoIA.codigo || "FALHA_IA";
          falha.falhaIA = true;
          falha.detalhe = resultadoIA.detalhe;
          throw falha;
        }
      }
    }

    let logoImagem = null;
    if (comerciais.logo) {
      try {
        logoImagem = await carregarImagemParaCanvas(comerciais.logo);
      } catch {
        logoImagem = null;
      }
    }

    const { dataUrl, registro } = await montarBannerProfissional({
      largura,
      altura,
      paletaId: PALETAS[parametros.paleta] ? parametros.paleta : "azul",
      produto,
      plano,
      textos: ehMl
        ? {}
        : {
            titulo: parametros.copy?.titulo,
            apoio: parametros.copy?.apoio,
            cta: parametros.copy?.cta,
          },
      comerciais,
      chamadaMl: chamada,
      cenarioIA,
      logoImagem,
      variacao,
    });

    registro.bloqueados = comerciais.bloqueados;
    registro.ia = resultadoIA;
    ultimoRegistroRef.current = registro;
    try {
      if (localStorage.getItem("paiiaBannerDebug") === "1") {
        const copia = document.createElement("canvas");
        copia.width = largura;
        copia.height = altura;
        const contextoCopia = copia.getContext("2d");
        contextoCopia.imageSmoothingEnabled = true;
        contextoCopia.imageSmoothingQuality = "high";
        contextoCopia
          .drawImage(
            produto,
            plano.produto.x,
            plano.produto.y,
            plano.produto.largura,
            plano.produto.altura
          );
        Reflect.set(window, "__paiiaBannerDebug", {
          registro,
          produtoPosicionado: copia.toDataURL("image/png"),
          largura,
          altura,
        });
      }
    } catch {
      // depuração opcional
    }
    return dataUrl;
  }

  async function gerarComIA(opcoesGeracao = {}) {
    // Sem IA só quando o usuário escolhe explicitamente.
    const semIANesta = opcoesGeracao?.semIA === true;
    const usarIANesta = usarIA && !semIANesta;
    if (gerandoFundoIA) return;
    if (!imagemSelecionada) {
      alert(
        "Escolha uma foto da Galeria PAIIA antes de gerar o banner."
      );
      return;
    }

    let interpretado = {
      objetivo,
      paleta,
      formato,
      preco: precoPedido,
      copy:
        copyPedido || copyAutomatica,
    };

    if (formato === "mercadoLivre") {
      interpretado = {
        ...interpretado,
        objetivo: "produto",
        formato: "mercadoLivre",
        preco: "",
      };
    } else if (pedidoAppia.trim()) {
      interpretado =
        interpretarPedidoAppia();
    }

    setBannerGerado(false);
    setAprovado(false);
    setBannerSalvo(false);
    setFundoIA("");
    setGerandoFundoIA(true);
    setErroFundoIA("");

    const proximaVersao =
      versaoIA + 1;

    setInfoIA("");
    setFalhaIA(null);
    setStatus(
      usarIANesta
        ? "🎨 Criando o cenário com IA e montando o banner (pode levar até 1 minuto)..."
        : "🎨 PAIIA montando o banner profissional..."
    );

    try {
      const formatoFinal =
        FORMATOS[interpretado.formato] ||
        dadosFormato;
      const paletaFinal =
        PALETAS[interpretado.paleta] ||
        cores;
      const objetivoFinal =
        OBJETIVOS.find(
          (item) =>
            item.id === interpretado.objetivo
        ) || dadosObjetivo;
      const copyFinal =
        interpretado.copy ||
        obterCopyAutomatica(
          interpretado.objetivo,
          proximaVersao
        );
      const proximoLayout =
        layout === 1 ? 2 : 1;
      const parametros = {
        versao: 1,
        formato: interpretado.formato,
        paleta: interpretado.paleta,
        objetivo: interpretado.objetivo,
        imagem: imagemSelecionada,
        preco:
          interpretado.formato === "mercadoLivre"
            ? ""
            : formatarPrecoBanner(
                interpretado.preco || precoPedido
              ),
        copy: {
          chamada:
            copyFinal.chamada ||
            objetivoFinal.chamada,
          titulo:
            copyFinal.titulo ||
            objetivoFinal.nome,
          apoio:
            copyFinal.apoio ||
            objetivoFinal.apoio,
          cta: copyFinal.cta || "",
        },
        marca: {
          nome: marca.nome || "",
          logo: marca.logo || "",
          telefone: marca.telefone || "",
          email: marca.email || "",
          site: marca.site || "",
          endereco: marca.endereco || "",
        },
        layout: proximoLayout,
        removerFundo: removerFundoAuto,
        codigo:
          interpretado.formato === "mercadoLivre"
            ? ""
            : codigoProduto,
        exibir: { ...exibirComercial },
        chamadaMl:
          interpretado.formato === "mercadoLivre"
            ? chamadaMl
            : "",
        estilo: modeloSelecionado || interpretado.objetivo,
        // Texto próprio do usuário (não o texto padrão do estilo): a
        // chamada dele é respeitada; senão o diretor de arte escolhe.
        copyPersonalizada: Boolean(
          pedidoAppia.trim() &&
            pedidoAppia.trim() !==
              String(
                MODELOS_DESCRICAO.find((modelo) => modelo.id === modeloSelecionado)?.texto || ""
              ).trim()
        ),
        diferenciais:
          interpretado.formato === "mercadoLivre" ? [] : [...diferenciais],
        variacao:
          sementeVariacao + proximaVersao,
        usarIA: usarIANesta,
      };
      const png =
        await montarArteBanner(
          parametros,
          formatoFinal,
          paletaFinal,
          { usarIANesta, exigirIA: usarIANesta }
        );
      const registroIA =
        ultimoRegistroRef.current?.ia || null;
      if (registroIA?.ok) {
        parametros.cenarioOrigem = `openai:${registroIA.modelo}`;
        setInfoIA(
          `✅ Cenário gerado pela OpenAI (${registroIA.modelo || "OpenAI"}, ${((registroIA.duracaoMs || 0) / 1000).toFixed(0)} s, ${registroIA.origem === "openai-local" ? "servidor local" : "Supabase"}${registroIA.idPedido ? `, pedido ${registroIA.idPedido}` : ""}).`
        );
      } else {
        parametros.cenarioOrigem = "paiia";
        setInfoIA(
          semIANesta
            ? "Banner montado com o cenário PAIIA (sem IA), por sua escolha."
            : "Banner montado com o cenário PAIIA (opção de IA desmarcada)."
        );
      }

      urlBannerSalvoRef.current = "";
      setParametrosArte(parametros);
      setBannerNoAnuncio(false);
      setFundoIA(png);
      setVersaoIA(proximaVersao);
      setLayout(proximoLayout);

      setBannerGerado(true);

      setStatus(
        "✨ Banner pronto. Confira e clique em Aprovar para salvar na Galeria."
      );
    } catch (erro) {
      if (erro?.falhaIA) {
        // Não mostra template no lugar do banner com IA: mostra a causa.
        setFalhaIA({
          mensagem: erro.message,
          codigo: erro.codigo,
          detalhe: erro.detalhe || "",
        });
        setStatus("⚠️ A IA da OpenAI não gerou o cenário deste banner.");
        return;
      }

      console.error(
        "❌ BANNER EXPRESS:",
        erro
      );

      const mensagem =
        erro?.message ||
        "Não foi possível montar o banner.";

      setErroFundoIA(
        mensagem
      );

      setStatus(
        "⚠️ Falha na montagem do banner."
      );

      alert(
        mensagem
      );
    } finally {
      setGerandoFundoIA(false);
    }
  }
async function aprovarBanner() {
  if (gerandoFundoIA || salvandoRef.current) {
    return;
  }

  if (!bannerGerado || !fundoIA || !parametrosArte) {
    alert(
      "Gere o banner antes de aprovar."
    );
    return;
  }

  if (arteDesatualizada) {
    alert(
      "Você mudou opções depois de gerar. Clique em “Gerar novamente” para atualizar a arte antes de aprovar."
    );
    return;
  }

  if (
    objetivo !== "horario" &&
    objetivo !== "institucional" &&
    !imagemSelecionada
  ) {
    alert(
      "Escolha uma foto antes de aprovar."
    );
    return;
  }

  const assinatura =
    assinaturaArteBanner(parametrosArte);

  salvandoRef.current = true;

  try {
    setStatus(
      "⏳ Salvando banner na Galeria..."
    );

    // A mesma arte nunca é salva duas vezes.
    if (
      !urlBannerSalvoRef.current ||
      assinaturaSalvaRef.current !== assinatura
    ) {
      const urlSalva =
        await salvarBannerNasMidias(
          fundoIA,
          parametrosArte
        );

      urlBannerSalvoRef.current =
        urlSalva || "";
      assinaturaSalvaRef.current =
        assinatura;
    }

    setBannerSalvo(true);
    setAprovado(true);

    setStatus(
      temAnuncioEmAndamento()
        ? "✅ Banner salvo na Galeria. Para incluir no anúncio em andamento, clique em “Usar no anúncio”."
        : "✅ Banner salvo na Galeria. Baixe o PNG ou crie as versões para outros canais."
    );
  } catch (erro) {
    console.error(
      "Banner Express: falha ao salvar.",
      erro
    );

    setStatus("");

    alert(
      erro?.message ||
        "Não foi possível salvar o banner."
    );
  } finally {
    salvandoRef.current = false;
  }
}

// Só quando o usuário pede: adiciona o banner salvo às fotos do anúncio.
function usarBannerNoAnuncio() {
  const urlBannerAnuncio =
    urlBannerSalvoRef.current;

  if (!urlBannerAnuncio) {
    alert(
      "Aprove o banner antes de usar no anúncio."
    );
    return;
  }

  try {
    const salvas =
      localStorage.getItem(
        "fotosSelecionadasAnuncio"
      );

    let fotosAtuais =
      salvas
        ? JSON.parse(salvas)
        : [];

    if (!Array.isArray(fotosAtuais)) {
      fotosAtuais = [];
    }

    const jaExiste =
      fotosAtuais.some((foto) => {
        const url =
          typeof foto === "string"
            ? foto
            : foto?.imagem_processada ||
              foto?.imagem_original ||
              foto?.url ||
              "";

        return url === urlBannerAnuncio;
      });

    if (!jaExiste) {
      fotosAtuais.push({
        id: `banner-${Date.now()}`,
        imagem_processada: urlBannerAnuncio,
        imagem_original: urlBannerAnuncio,
        tipo: "banner",
        created_at: new Date().toISOString(),
      });
    }

    localStorage.setItem(
      "fotosSelecionadasAnuncio",
      JSON.stringify(fotosAtuais)
    );

    const rascunhoSalvo =
      localStorage.getItem(
        "rascunhoNovoAnuncioTemp"
      );

    if (rascunhoSalvo) {
      const rascunho = JSON.parse(rascunhoSalvo);

      localStorage.setItem(
        "rascunhoNovoAnuncioTemp",
        JSON.stringify({
          ...rascunho,
          fotos: fotosAtuais,
        })
      );
    }

    setBannerNoAnuncio(true);
    setStatus(
      jaExiste
        ? "ℹ️ Este banner já está nas fotos do anúncio."
        : "✅ Banner incluído nas fotos do anúncio."
    );
  } catch (erroFotos) {
    console.error(
      "Banner Express: falha ao incluir no anúncio.",
      erroFotos
    );
    alert(
      "Não foi possível incluir o banner no anúncio."
    );
  }
}
  async function importarLogo(
    event
  ) {
    const arquivo =
      event.target.files?.[0];

    if (!arquivo) {
      return;
    }

    try {
      const dataUrl =
        await reduzirLogo(arquivo);

      setMarca((atual) => ({
        ...atual,
        logo: dataUrl,
      }));
      event.target.value = "";
    } catch (erro) {
      alert(
        erro?.message ||
          "Não foi possível importar o logo."
      );
    }
  }
async function criarBlobMiniaturaBanner(
  blobOriginal
) {
  const urlTemporaria =
    URL.createObjectURL(
      blobOriginal
    );

  try {
    const imagem =
      await new Promise(
        (resolve, reject) => {
          const img = new Image();

          img.onload = () =>
            resolve(img);

          img.onerror = () =>
            reject(
              new Error(
                "Não foi possível ler o banner para a miniatura."
              )
            );

          img.src = urlTemporaria;
        }
      );

    const maximo = 500;
    const escala = Math.min(
      1,
      maximo /
        Math.max(
          imagem.naturalWidth ||
            imagem.width,
          imagem.naturalHeight ||
            imagem.height
        )
    );

    const canvas =
      document.createElement(
        "canvas"
      );

    canvas.width = Math.max(
      1,
      Math.round(
        (imagem.naturalWidth ||
          imagem.width) * escala
      )
    );

    canvas.height = Math.max(
      1,
      Math.round(
        (imagem.naturalHeight ||
          imagem.height) * escala
      )
    );

    const contexto =
      canvas.getContext("2d");

    if (!contexto) {
      throw new Error(
        "Não foi possível criar a miniatura do banner."
      );
    }

    contexto.drawImage(
      imagem,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const blobWebp =
      await new Promise(
        (resolve) => {
          canvas.toBlob(
            resolve,
            "image/webp",
            0.8
          );
        }
      );

    if (blobWebp && blobWebp.size > 0) {
      return {
        blob: blobWebp,
        contentType: "image/webp",
        extensao: "webp",
      };
    }

    const blobJpeg =
      await new Promise(
        (resolve) => {
          canvas.toBlob(
            resolve,
            "image/jpeg",
            0.82
          );
        }
      );

    if (!blobJpeg || blobJpeg.size < 1) {
      throw new Error(
        "Não foi possível gerar a miniatura do banner."
      );
    }

    return {
      blob: blobJpeg,
      contentType: "image/jpeg",
      extensao: "jpg",
    };
  } finally {
    URL.revokeObjectURL(
      urlTemporaria
    );
  }
}

async function salvarBannerNasMidias(urlBanner, parametros) {
  if (!urlBanner) {
    throw new Error(
      "Banner sem imagem para salvar."
    );
  }

  if (!usuario?.id) {
    throw new Error(
      "Faça login para salvar o banner."
    );
  }

  const resposta =
    await fetch(urlBanner);

  const blob =
    await resposta.blob();

  const carimbo = Date.now();
  const base = `${usuario.id}/banners/paiia-banner-${carimbo}`;
  const nomeArquivo = `${base}.png`;
  const enviados = [];

  const removerEnviados = async () => {
    if (enviados.length) {
      await supabase.storage
        .from("imagens")
        .remove(enviados)
        .catch(() => {});
    }
  };

  const {
    error: erroUpload,
  } = await supabase.storage
    .from("imagens")
    .upload(
      nomeArquivo,
      blob,
      {
        contentType: "image/png",
        upsert: false,
      }
    );

  if (erroUpload) {
    throw new Error(
      "Não foi possível enviar o banner: " +
        (erroUpload.message || "erro no armazenamento")
    );
  }

  enviados.push(nomeArquivo);

  try {
    const miniatura =
      await criarBlobMiniaturaBanner(
        blob
      );
    const caminhoMiniatura =
      `${base}-thumb.${miniatura.extensao}`;

    const { error: erroMiniatura } =
      await supabase.storage
        .from("imagens")
        .upload(
          caminhoMiniatura,
          miniatura.blob,
          {
            contentType:
              miniatura.contentType,
            upsert: true,
          }
        );

    if (!erroMiniatura) {
      enviados.push(caminhoMiniatura);
    }
  } catch {
    // A miniatura é só para o card. O original segue.
  }

  const {
    data: dadosPublicos,
  } = supabase.storage
    .from("imagens")
    .getPublicUrl(
      nomeArquivo
    );

  const urlPublica =
    dadosPublicos?.publicUrl;

  if (!urlPublica) {
    await removerEnviados();
    throw new Error(
      "Não foi possível obter a URL do banner."
    );
  }

  // imagem_original nunca vai em base64 para o banco: se a foto
  // escolhida não for URL, sobe para o Storage e salva só a URL.
  const imagemOriginalUrl =
    await obterUrlImagemOriginalBanner(
      imagemSelecionada,
      usuario.id,
      carimbo
    );

  if (
    imagemOriginalUrl &&
    imagemOriginalUrl.includes(`/banners/paiia-banner-${carimbo}-original.`)
  ) {
    const caminhoOriginal = imagemOriginalUrl
      .split("/storage/v1/object/public/imagens/")[1]
      ?.split("?")[0];
    if (caminhoOriginal) {
      enviados.push(decodeURIComponent(caminhoOriginal));
    }
  }

  // Parâmetros da arte para reabrir/editar pela Galeria.
  try {
    const parametrosSalvos = {
      ...(parametros || {}),
      cenarioIA: /^https?:\/\//i.test(String(parametros?.cenarioIA || ""))
        ? parametros.cenarioIA
        : "",
      imagem: imagemOriginalUrl || "",
      salvoEm: new Date().toISOString(),
    };
    const { error: erroParametros } =
      await supabase.storage
        .from("imagens")
        .upload(
          `${base}.json`,
          new Blob([JSON.stringify(parametrosSalvos)], {
            type: "application/json",
          }),
          {
            contentType: "application/json",
            upsert: true,
          }
        );

    if (!erroParametros) {
      enviados.push(`${base}.json`);
    }
  } catch {
    // Sem os parâmetros o banner só não poderá ser reaberto para edição.
  }

  const { error } = await supabase
    .from("processamentos")
    .insert([
      {
        user_id: usuario.id,
        imagem_original:
          imagemOriginalUrl,
        imagem_processada:
          urlPublica,
        status: "finalizado",
        tipo: "banner",
        modelo_banner: parametros?.formato || formato,
      },
    ]);

  if (error) {
    await removerEnviados();
    throw new Error(
      "Não foi possível salvar o banner na Galeria: " +
        error.message
    );
  }

  return urlPublica;
}


  async function exportarVersaoDestino(
    chaveDestino
  ) {
    if (!arteLiberada || !parametrosArte) {
      alert(
        "Gere o banner (e atualize, se mudou alguma opção) antes de criar versões."
      );
      return;
    }

    const destino =
      FORMATOS[chaveDestino];

    if (!destino) {
      return;
    }

    try {
      setStatus(
        `⏳ Montando a versão ${destino.nome}...`
      );

      // Mesma foto e mesmos textos, com o layout refeito na medida do
      // canal (sem faixas vazias e sem esticar).
      const png = await montarArteBanner(
        parametrosArte,
        destino,
        PALETAS[parametrosArte.paleta] || cores,
        { usarIANesta: false }
      );

      const resposta = await fetch(png);
      const blob = await resposta.blob();
      const urlDownload =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = urlDownload;
      link.download =
        `paiia-banner-${chaveDestino}-${destino.largura}x${destino.altura}-${Date.now()}.png`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(
        () =>
          URL.revokeObjectURL(
            urlDownload
          ),
        1500
      );

      setStatus(
        `✅ Versão ${destino.nome} pronta em ${destino.largura} × ${destino.altura}.`
      );
    } catch (erro) {
      console.error(
        "Banner Express: falha ao formatar.",
        erro
      );

      setStatus("");

      alert(
        erro?.message ||
          "Não foi possível formatar o banner."
      );
    }
  }

  async function exportarPng() {
    /*
     * Quando a IA já devolveu a arte completa em PNG,
     * baixamos o arquivo original diretamente.
     * Isso evita o erro do foreignObject:
     * "Não foi possível renderizar o banner".
     */
    if (fundoIA) {
      try {
        setStatus(
          "⏳ Preparando PNG..."
        );

        const resposta =
          await fetch(fundoIA);

        const blob =
          await resposta.blob();

        const url =
          URL.createObjectURL(blob);

        const link =
          document.createElement("a");

        link.href = url;
        link.download =
          `appia-banner-${formato}-${Date.now()}.png`;

        document.body.appendChild(
          link
        );

        link.click();
        link.remove();

        window.setTimeout(
          () =>
            URL.revokeObjectURL(
              url
            ),
          1500
        );

        setStatus(
          "✅ PNG baixado. O banner permanece salvo em Mídias PAIIA."
        );

        return;
      } catch (erro) {
        console.error(
          "❌ DOWNLOAD PNG IA:",
          erro
        );

        setStatus("");

        alert(
          "Não foi possível baixar o PNG do banner."
        );

        return;
      }
    }

    const elemento =
      previewRef.current;

    if (!elemento) {
      return;
    }

    setStatus(
      "⏳ Gerando PNG profissional..."
    );

    try {
      const largura =
        dadosFormato.largura;

      const altura =
        dadosFormato.altura;

      const clone =
        elemento.cloneNode(true);

      clone.style.width =
        `${largura}px`;

      clone.style.height =
        `${altura}px`;

      clone.style.maxWidth =
        "none";

      clone.style.transform =
        "none";

      const html =
        escaparHtml("");

      void html;

      const css =
        Array.from(
          document.styleSheets
        )
          .map((sheet) => {
            try {
              return Array.from(
                sheet.cssRules || []
              )
                .map(
                  (rule) =>
                    rule.cssText
                )
                .join("\n");
            } catch {
              return "";
            }
          })
          .join("\n");

      const svg = `
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="${largura}"
          height="${altura}"
          viewBox="0 0 ${largura} ${altura}"
        >
          <foreignObject
            x="0"
            y="0"
            width="100%"
            height="100%"
          >
            <div
              xmlns="http://www.w3.org/1999/xhtml"
              style="width:${largura}px;height:${altura}px;"
            >
              <style>
                * {
                  box-sizing: border-box;
                  font-family: Arial, Helvetica, sans-serif;
                }
                ${css}
              </style>
              ${clone.outerHTML}
            </div>
          </foreignObject>
        </svg>
      `;

      const blobSvg =
        new Blob(
          [svg],
          {
            type:
              "image/svg+xml;charset=utf-8",
          }
        );

      const urlSvg =
        URL.createObjectURL(
          blobSvg
        );

      const imagemSvg =
        new Image();

      await new Promise(
        (resolve, reject) => {
          imagemSvg.onload =
            resolve;

          imagemSvg.onerror =
            () =>
              reject(
                new Error(
                  "Não foi possível renderizar o banner."
                )
              );

          imagemSvg.src =
            urlSvg;
        }
      );

      const canvas =
        document.createElement(
          "canvas"
        );

      canvas.width =
        largura;

      canvas.height =
        altura;

      const contexto =
        canvas.getContext(
          "2d"
        );

      if (!contexto) {
        throw new Error(
          "Não foi possível criar o PNG."
        );
      }

      contexto.imageSmoothingEnabled =
        true;

      contexto.imageSmoothingQuality =
        "high";

      contexto.drawImage(
        imagemSvg,
        0,
        0,
        largura,
        altura
      );

      URL.revokeObjectURL(
        urlSvg
      );

      const png =
        await new Promise(
          (resolve) =>
            canvas.toBlob(
              resolve,
              "image/png",
              1
            )
        );

      if (!png) {
        throw new Error(
          "Não foi possível gerar o arquivo."
        );
      }

      const url =
        URL.createObjectURL(
          png
        );

      const link =
        document.createElement(
          "a"
        );

      link.href = url;

      link.download =
        `appia-banner-${formato}-${Date.now()}.png`;

      document.body.appendChild(
        link
      );

      link.click();
      link.remove();

      window.setTimeout(
        () =>
          URL.revokeObjectURL(
            url
          ),
        1200
      );

      setStatus(
        "✅ Banner exportado."
      );
    } catch (erro) {
      console.error(
        "BANNER EXPRESS:",
        erro
      );

      setStatus("");

      alert(
        erro?.message ||
          "Não foi possível exportar o banner."
      );
    }
  }

  const ehVertical =
    dadosFormato.altura >
    dadosFormato.largura;

  const precoFinal =
    precoPedido ||
    formatarPreco(preco);

  const precoAntigo =
    formatarPreco(
      precoAnterior
    );

  const chamadaPrincipal =
    copyPedido?.titulo ||
    titulo ||
    copyAutomatica.titulo ||
    dadosObjetivo.chamada;

  const apoio =
    copyPedido?.apoio ||
    textoExtra ||
    copyAutomatica.apoio ||
    dadosObjetivo.apoio;

  const proporcaoPreview =
    `${dadosFormato.largura} / ${dadosFormato.altura}`;

  return (
    <div
      style={{
        ...cardStyle,
        minHeight: "100vh",
        padding: "10px 14px 12px",
        background: "linear-gradient(180deg,#020617 0%,#07111f 100%)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          gap: "12px",
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: "10px",
        }}
      >
        <div>
          <h1
            style={{
              color: "#67e8f9",
              margin: 0,
              fontSize: "22px",
              lineHeight: 1.15,
            }}
          >
            ⚡ Banner Express
          </h1>
        </div>

        <button
          type="button"
          onClick={() =>
            setScreen?.("home")
          }
          style={{
            ...botaoSecundario,
            padding: "8px 12px",
            fontSize: "13px",
          }}
        >
          ← Voltar
        </button>
      </div>

      <style>
        {`
          .banner-express-layout {
            display: grid;
            grid-template-columns: minmax(300px, 1.05fr) minmax(210px, 260px) minmax(280px, 1.15fr);
            gap: 12px;
            align-items: start;
          }
          .banner-express-preview {
            display: flex;
            flex-direction: column;
            min-height: 0;
          }
          .banner-express-formatos {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 6px;
          }
          .banner-express-estilos {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }
          .banner-express-foto-moldura {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 220px;
            max-height: calc(100vh - 210px);
            padding: 10px;
            border-radius: 14px;
            border: 1px solid #38bdf8;
            background: #020617;
            box-sizing: border-box;
          }
          .banner-express-foto-moldura img {
            width: 100%;
            height: 100%;
            max-height: calc(100vh - 230px);
            object-fit: contain;
            display: block;
          }
          .banner-express-preview-moldura {
            flex: 1 1 auto;
            display: flex;
            flex-direction: column;
            min-height: 0;
            padding: 10px;
            border-radius: 16px;
            border: 1px solid rgba(103,232,249,.45);
            background: linear-gradient(180deg,rgba(8,145,178,.10),rgba(2,6,23,.55));
          }
          @media (max-width: 1100px) {
            .banner-express-layout {
              grid-template-columns: minmax(280px, 1fr) minmax(0, 1.1fr);
            }
            .banner-express-foto {
              grid-column: 1;
            }
            .banner-express-preview {
              grid-column: 2;
              grid-row: 1 / span 2;
            }
          }
          @media (max-width: 860px) {
            .banner-express-layout {
              grid-template-columns: 1fr;
            }
            .banner-express-foto,
            .banner-express-preview {
              grid-column: auto;
              grid-row: auto;
            }
            .banner-express-formatos {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .banner-express-foto-moldura {
              max-height: 240px;
              min-height: 180px;
            }
            .banner-express-foto-moldura img {
              max-height: 220px;
            }
          }
          @media (max-width: 520px) {
            .banner-express-formatos {
              grid-template-columns: 1fr 1fr !important;
            }
            .banner-express-foto-moldura {
              max-height: 200px;
              min-height: 150px;
            }
            .banner-express-foto-moldura img {
              max-height: 180px;
            }
          }
        `}
      </style>

      <div className="banner-express-layout">
        <aside
          style={{
            ...painelStyle,
            padding: "12px",
          }}
        >
          <div style={secaoCompactaStyle}>
            <div style={secaoTituloCompacto}>
              Formato
            </div>

            <div className="banner-express-formatos">
              {Object.entries(FORMATOS).map(([chave, item]) => (
                <button
                  key={chave}
                  type="button"
                  onClick={() => {
                    setFormato(chave);
                    setAprovado(false);
                    setBannerSalvo(false);

                    if (chave === "mercadoLivre") {
                      setObjetivo("produto");
                    }
                  }}
                  style={{
                    ...formatoCardStyle,
                    border:
                      formato === chave
                        ? "2px solid #67e8f9"
                        : "1px solid #334155",
                    background:
                      formato === chave
                        ? "rgba(8,145,178,.28)"
                        : "#020617",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 800,
                      fontSize: "11px",
                      lineHeight: 1.2,
                      color: "#f8fafc",
                    }}
                  >
                    {item.nome}
                  </span>
                  <span
                    style={{
                      color: formato === chave ? "#a5f3fc" : "#94a3b8",
                      fontSize: "10px",
                      fontWeight: 700,
                    }}
                  >
                    {item.largura}×{item.altura}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div style={secaoCompactaStyle}>
            <div style={secaoTituloCompacto}>
              Estilo
            </div>
            <div className="banner-express-estilos">
              {MODELOS_DESCRICAO.map(
                (modelo) => (
                  <button
                    key={modelo.id}
                    type="button"
                    onClick={() => {
  setModeloSelecionado(modelo.id);
  setPedidoAppia(
    modelo.texto
  );

}}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "999px",
                      cursor: "pointer",
                      color: "#e2e8f0",
                      fontSize: "12px",
                      fontWeight: 800,
                      border:
                        modeloSelecionado === modelo.id
                          ? "2px solid #67e8f9"
                          : "1px solid #334155",
                      background:
                        modeloSelecionado === modelo.id
                          ? "rgba(8,145,178,.22)"
                          : "#020617",
                    }}
                  >
                    {modelo.nome}
                  </button>
                )
              )}
            </div>

            <div style={{ ...secaoTituloCompacto, marginTop: "8px" }}>
              Fundo
            </div>
            <div className="banner-express-estilos">
              {[
                ["azul", "Azul"],
                ["vermelho", "Oferta"],
                ["escuro", "Dark"],
                ["clean", "Clean"],
              ].map(([chave, nome]) => (
                <button
                  key={chave}
                  type="button"
                  onClick={() =>
                    setPaleta(chave)
                  }
                  style={{
                    padding: "5px 9px",
                    borderRadius: "999px",
                    cursor: "pointer",
                    color: "#e2e8f0",
                    fontSize: "11px",
                    fontWeight: 800,
                    border:
                      paleta === chave
                        ? "2px solid #67e8f9"
                        : "1px solid #334155",
                    background:
                      paleta === chave
                        ? "rgba(8,145,178,.22)"
                        : "#020617",
                  }}
                >
                  {nome}
                </button>
              ))}
            </div>

            <label
              style={{
                ...botaoSecundario,
                display: "block",
                textAlign: "center",
                cursor: "pointer",
                marginTop: "8px",
                padding: "8px 10px",
                fontSize: "12px",
              }}
            >
              {marca.logo ? "Trocar logo" : "Adicionar logo"}
              <input
                type="file"
                accept="image/*"
                onChange={importarLogo}
                style={{ display: "none" }}
              />
            </label>
          </div>

          {formato === "mercadoLivre" ? (
          <div style={secaoCompactaStyle}>
            <div style={secaoTituloCompacto}>
              Mercado Livre 1200×1200
            </div>
            <div
              style={{
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid #f59e0b",
                background: "rgba(245,158,11,.10)",
                color: "#fde68a",
                fontSize: "11px",
                lineHeight: 1.45,
              }}
            >
              🔒 Preço, código, logo, site e WhatsApp são bloqueados
              automaticamente neste formato, mesmo preenchidos.
            </div>
            <div
              style={{
                ...secaoTituloCompacto,
                marginTop: "8px",
              }}
            >
              Chamada curta (opcional)
            </div>
            <div className="banner-express-estilos">
              {CHAMADAS_MERCADO_LIVRE.map((opcao) => (
                <button
                  key={opcao.id || "nenhuma"}
                  type="button"
                  onClick={() => setChamadaMl(opcao.id)}
                  style={{
                    padding: "5px 9px",
                    borderRadius: "999px",
                    cursor: "pointer",
                    color: "#e2e8f0",
                    fontSize: "11px",
                    fontWeight: 800,
                    border:
                      chamadaMl === opcao.id
                        ? "2px solid #67e8f9"
                        : "1px solid #334155",
                    background:
                      chamadaMl === opcao.id
                        ? "rgba(8,145,178,.22)"
                        : "#020617",
                  }}
                >
                  {opcao.texto}
                </button>
              ))}
            </div>
          </div>
          ) : (
          <div style={secaoCompactaStyle}>
            <button
              type="button"
              onClick={() =>
                setMostrarExtras((aberto) => !aberto)
              }
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                padding: "4px 0",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                textAlign: "left",
                color: "#67e8f9",
                fontWeight: 800,
                fontSize: "13px",
              }}
            >
              <span>Dados comerciais (preço, código, logo, site, WhatsApp)</span>
              <span>
                {mostrarExtras ? "−" : "+"}
              </span>
            </button>

            {mostrarExtras && (
              <div style={{ marginTop: "10px", display: "grid", gap: "8px" }}>
                {[
                  {
                    campo: "preco",
                    rotulo: "💰 Preço",
                    valor: precoPedido,
                    mudar: (valor) => setPrecoPedido(valor),
                    exemplo: "R$ 149,90",
                  },
                  {
                    campo: "codigo",
                    rotulo: "🔢 Código",
                    valor: codigoProduto,
                    mudar: (valor) => setCodigoProduto(valor),
                    exemplo: "0258003300",
                  },
                  {
                    campo: "site",
                    rotulo: "🌐 Site",
                    valor: marca.site || "",
                    mudar: (valor) =>
                      setMarca((atual) => ({ ...atual, site: valor })),
                    exemplo: "www.sualoja.com.br",
                  },
                  {
                    campo: "whatsapp",
                    rotulo: "📱 WhatsApp",
                    valor: marca.telefone || "",
                    mudar: (valor) =>
                      setMarca((atual) => ({ ...atual, telefone: valor })),
                    exemplo: "(11) 98765-4321",
                  },
                ].map((item) => (
                  <div
                    key={item.campo}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <label
                      title="Mostrar no banner"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        color: "#cbd5e1",
                        fontSize: "11px",
                        fontWeight: 800,
                        minWidth: "92px",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={exibirComercial[item.campo] !== false}
                        onChange={() => alternarExibir(item.campo)}
                      />
                      {item.rotulo}
                    </label>
                    <input
                      type="text"
                      value={item.valor}
                      onChange={(event) => item.mudar(event.target.value)}
                      placeholder={`Ex.: ${item.exemplo}`}
                      style={{ ...inputStyle, padding: "7px 9px", fontSize: "12px" }}
                    />
                  </div>
                ))}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      color: "#cbd5e1",
                      fontSize: "11px",
                      fontWeight: 800,
                      minWidth: "92px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={exibirComercial.logo !== false}
                      onChange={() => alternarExibir("logo")}
                    />
                    🏷️ Logo
                  </label>
                  <input
                    type="text"
                    value={marca.nome || ""}
                    onChange={(event) =>
                      setMarca((atual) => ({
                        ...atual,
                        nome: event.target.value,
                      }))
                    }
                    placeholder="Nome da loja (usado se não houver logo)"
                    style={{ ...inputStyle, padding: "7px 9px", fontSize: "12px" }}
                  />
                </div>
                <div style={{ display: "grid", gap: "6px", marginTop: "4px" }}>
                  <div style={{ color: "#cbd5e1", fontSize: "11px", fontWeight: 800 }}>
                    ⭐ Selos no banner (opcional — marque só o que for verdade)
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {Object.entries(DIFERENCIAIS).map(([id, item]) => (
                      <label
                        key={id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "4px 8px",
                          borderRadius: "8px",
                          border: diferenciais.includes(id)
                            ? "1px solid #67e8f9"
                            : "1px solid #334155",
                          color: "#e2e8f0",
                          fontSize: "11px",
                          fontWeight: 700,
                          cursor: formato === "mercadoLivre" ? "not-allowed" : "pointer",
                          opacity: formato === "mercadoLivre" ? 0.5 : 1,
                        }}
                      >
                        <input
                          type="checkbox"
                          disabled={formato === "mercadoLivre"}
                          checked={diferenciais.includes(id)}
                          onChange={() => alternarDiferencial(id)}
                        />
                        {item.nome}
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ color: "#94a3b8", fontSize: "11px" }}>
                  {marca.logo
                    ? "✅ Logo cadastrado: será aplicado com o arquivo original."
                    : "Sem logo: use “Adicionar logo” acima."}
                </div>

                <div
                  style={{
                    color: "#64748b",
                    fontSize: "11px",
                    lineHeight: 1.4,
                  }}
                >
                  Dados carregados do cadastro da sua empresa no PAIIA:
                  confira antes de gerar. Só aparece no banner o que estiver
                  preenchido e marcado — nada é inventado.
                </div>
              </div>
            )}
          </div>
          )}

          <div style={secaoCompactaStyle}>
            <div style={secaoTituloCompacto}>
              O que você quer no banner?
            </div>

            <textarea
              value={pedidoAppia}
              onChange={(event) =>
                setPedidoAppia(
                  event.target.value
                )
              }
              rows={3}
             placeholder="Crie uma promoção premium, destaque o preço e pronta entrega."
              style={{
                ...inputStyle,
                minHeight: "72px",
                maxHeight: "92px",
                resize: "vertical",
                lineHeight: 1.4,
                fontSize: "13px",
                marginTop: "4px",
                padding: "8px 10px",
              }}
            />
          </div>

                 </aside>

        <section
          className="banner-express-foto"
          style={{
            ...painelStyle,
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={secaoTituloCompacto}>
            Foto do produto
          </div>

          {imagemSelecionada ? (
            <>
              <div className="banner-express-foto-moldura">
                <img
                  src={imagemSelecionada}
                  alt="Produto"
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMostrarGaleria(true);
                  }}
                  style={{
                    ...botaoPrincipal,
                    padding: "9px 10px",
                    fontSize: "13px",
                  }}
                >
                  Trocar foto
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImagemSelecionada("");
                    setAprovado(false);
                    setBannerSalvo(false);
                  }}
                  style={{
                    ...botaoSecundario,
                    padding: "9px 10px",
                    fontSize: "13px",
                  }}
                >
                  Remover
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMostrarGaleria(true);
              }}
              style={{
                ...botaoPrincipal,
                width: "100%",
                minHeight: "140px",
                padding: "16px",
                fontSize: "14px",
              }}
            >
              🖼️ Buscar foto na Galeria
            </button>
          )}

          <input
            ref={inputFotoAparelhoRef}
            type="file"
            accept="image/*"
            onChange={selecionarFotoDoAparelho}
            style={{ display: "none" }}
          />
          <button
            type="button"
            onClick={() => inputFotoAparelhoRef.current?.click()}
            style={{
              ...botaoSecundario,
              width: "100%",
              marginTop: "8px",
              padding: "8px 10px",
              fontSize: "12px",
            }}
          >
            📤 Enviar foto do aparelho
          </button>
        </section>

        <main
          className="banner-express-preview"
          style={{
            ...previewPainel,
            padding: "12px",
          }}
        >
          {gerandoFundoIA && (
            <div
              style={{
                marginBottom: "8px",
                padding: "8px 10px",
                borderRadius: "10px",
                border: "1px solid #22d3ee",
                background: "rgba(8,145,178,.10)",
                color: "#a5f3fc",
                fontWeight: "800",
                textAlign: "center",
                fontSize: "12px",
              }}
            >
              🎨 Montando banner...
            </div>
          )}

          {erroFundoIA && (
            <div
              style={{
                marginBottom: "14px",
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid #ef4444",
                background: "rgba(127,29,29,.18)",
                color: "#fecaca",
                fontSize: "12px",
              }}
            >
              ⚠️ {erroFundoIA}
            </div>
          )}

          <div className="banner-express-preview-moldura">
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              gap: "8px",
              flexWrap: "wrap",
              marginBottom:
                "8px",
            }}
          >
            <div>
              <strong
                style={{
                  color:
                    "#67e8f9",
                  fontSize: "13px",
                }}
              >
                Este é o seu banner
              </strong>

              <div
                style={{
                  color:
                    "#94a3b8",
                  fontSize:
                    "11px",
                  marginTop:
                    "2px",
                }}
              >
                {
                  dadosFormato.nome
                }{" "}
                •{" "}
                {
                  dadosFormato.largura
                }
                ×
                {
                  dadosFormato.altura
                }
              </div>
            </div>

            <button
              type="button"
              onClick={
                arteLiberada
                  ? exportarPng
                  : undefined
              }
              disabled={!arteLiberada}
              style={{
                ...botaoSecundario,
                padding: "7px 10px",
                fontSize: "12px",
                opacity:
                  arteLiberada
                    ? 1
                    : 0.45,
                cursor:
                  arteLiberada
                    ? "pointer"
                    : "not-allowed",
              }}
            >
              {arteLiberada
                ? "⬇️ PNG"
                : "🔒 PNG"}
            </button>
          </div>

          <div
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
              overflow: "visible",
            }}
          >
           
                       <div
              ref={previewRef}
              id="preview-banner-appia"
              style={{
                width: `min(100%, calc(min(52vh, 420px) * ${
                  dadosFormato.largura / dadosFormato.altura
                }))`,
                maxWidth: "100%",
                maxHeight: "min(52vh, 420px)",
                aspectRatio: proporcaoPreview,
                flex: "0 0 auto",
                position:
                  "relative",
                overflow:
                  "hidden",
                borderRadius:
                  "18px",
                background:
                  fundoIA
                    ? "#020617"
                    : cores.fundo,
                backgroundImage:
                  fundoIA
                    ? `linear-gradient(
                        rgba(2,6,23,.10),
                        rgba(2,6,23,.10)
                      ),
                      url("${fundoIA}")`
                    : "none",
                backgroundSize:
                  "cover",
                backgroundPosition:
                  "center",
                backgroundRepeat:
                  "no-repeat",
                color:
                  cores.texto,
                boxShadow:
                  "0 32px 90px rgba(0,0,0,.52), inset 0 0 0 1px rgba(255,255,255,.08)",
                boxSizing: "border-box",
              }}
            >
              {fundoIA && (
                <img
                  src={fundoIA}
                  alt="Banner criado pelo PAIIA"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    objectPosition: "center",
                    background: "#020617",
                    display: "block",
                    zIndex: 100,
                  }}
                />
              )}

              <div
                style={{
                  position:
                    "absolute",
                  inset: 0,
                  background:
                    fundoIA
                      ? "linear-gradient(120deg,rgba(0,0,0,.08),transparent 40%,rgba(255,255,255,.03))"
                      : "linear-gradient(120deg,rgba(255,255,255,.04),transparent 35%,rgba(255,255,255,.025))",
                  pointerEvents:
                    "none",
                }}
              />

              <div
                style={{
                  position: "absolute",
                  width: "48%",
                  height: "48%",
                  borderRadius: "50%",
                  top: "-18%",
                  right: "-14%",
                  background:
                    paleta === "vermelho"
                      ? "rgba(250,204,21,.18)"
                      : paleta === "clean"
                        ? "rgba(37,99,235,.12)"
                        : "rgba(34,211,238,.18)",
                  filter: "blur(2px)",
                  pointerEvents: "none",
                }}
              />

              <div
                style={{
                  position: "absolute",
                  width: "42%",
                  height: "42%",
                  borderRadius: "50%",
                  left: "-18%",
                  bottom: "-16%",
                  background:
                    paleta === "vermelho"
                      ? "rgba(249,115,22,.18)"
                      : paleta === "escuro"
                        ? "rgba(168,85,247,.15)"
                        : "rgba(37,99,235,.16)",
                  pointerEvents: "none",
                }}
              />

              <div
                style={{
                  position: "absolute",
                  width: "42%",
                  height: "8px",
                  right: "-6%",
                  top: "23%",
                  transform: "rotate(-9deg)",
                  borderRadius: "999px",
                  background:
                    `linear-gradient(90deg, transparent, ${cores.destaque}, transparent)`,
                  opacity: .42,
                  pointerEvents: "none",
                }}
              />

              <div
                style={{
                  position: "absolute",
                  inset: "4.5%",
                  borderRadius: "22px",
                  border: "1px solid rgba(255,255,255,.10)",
                  pointerEvents: "none",
                }}
              />

              {bannerGerado && !fundoIA && (
                <>

              <div
                style={{
                  position:
                    "absolute",
                  top: "5%",
                  left: "6%",
                  right: "6%",
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  gap: "14px",
                  zIndex: 4,
                }}
              >
                <div
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap: "12px",
                    minWidth: 0,
                  }}
                >
                  {marca.logo && (
                    <img
                      src={
                        marca.logo
                      }
                      alt="Logo"
                      style={{
                        width:
                          ehVertical
                            ? "74px"
                            : "64px",
                        height:
                          ehVertical
                            ? "74px"
                            : "64px",
                        objectFit:
                          "contain",
                        background:
                          "rgba(255,255,255,.95)",
                        borderRadius:
                          "13px",
                        padding: "5px",
                      }}
                    />
                  )}

                  <strong
                    style={{
                      fontSize:
                        ehVertical
                          ? "clamp(13px,1.8vw,22px)"
                          : "clamp(12px,1.4vw,19px)",
                      lineHeight: 1.05,
                      textTransform:
                        "uppercase",
                      letterSpacing:
                        ".04em",
                    }}
                  >
                    {marca.nome || ""}
                  </strong>
                </div>

                <div
                  style={{
                    padding:
                      "7px 11px",
                    borderRadius:
                      "999px",
                    background:
                      `linear-gradient(135deg, ${cores.destaque}, ${cores.destaque2})`,
                    boxShadow:
                      "0 10px 28px rgba(0,0,0,.22)",
                    color:
                      paleta ===
                      "clean"
                        ? "#ffffff"
                        : "#020617",
                    fontWeight:
                      "900",
                    fontSize:
                      "clamp(9px,1.15vw,15px)",
                    whiteSpace:
                      "nowrap",
                  }}
                >
                  {
                    dadosObjetivo.icone
                  }{" "}
                  {
                    copyPedido?.chamada ||
                    copyAutomatica.chamada
                  }
                </div>
              </div>

              <div
                style={{
                  position:
                    "absolute",
                  left:
                    layout === 2
                      ? "48%"
                      : "4%",
                  right:
                    layout === 2
                      ? "4%"
                      : "46%",
                  top:
                    ehVertical
                      ? "15%"
                      : "18%",
                  bottom:
                    ehVertical
                      ? "16%"
                      : "16%",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  zIndex: 2,
                }}
              >
                {imagemSelecionada ? (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "24px",
                      overflow: "hidden",
                      background:
                        paleta === "clean"
                          ? "rgba(255,255,255,.38)"
                          : "transparent",
                    }}
                  >
                    <img
                      src={
                        imagemSelecionada
                      }
                      alt="Produto"
                      style={{
                        width:
                          ehVertical
                            ? "118%"
                            : "112%",
                        height:
                          ehVertical
                            ? "118%"
                            : "112%",
                        objectFit:
                          "contain",
                        mixBlendMode:
                          paleta === "clean"
                            ? "normal"
                            : "multiply",
                        filter:
                          "drop-shadow(0 30px 38px rgba(0,0,0,.52)) drop-shadow(0 0 18px rgba(255,255,255,.10))",
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      color:
                        cores.apoio,
                      fontWeight:
                        "bold",
                      textAlign:
                        "center",
                    }}
                  >
                    {objetivo ===
                      "horario"
                      ? "🕒"
                      : "🖼️"}
                  </div>
                )}
              </div>

              <div
                style={{
                  position:
                    "absolute",
                  left:
                    layout === 2
                      ? "5%"
                      : "50%",
                  right:
                    layout === 2
                      ? "50%"
                      : "5%",
                  top:
                    ehVertical
                      ? "18%"
                      : "20%",
                  bottom:
                    ehVertical
                      ? "14%"
                      : "14%",
                  display:
                    "flex",
                  flexDirection:
                    "column",
                  justifyContent:
                    "center",
                  alignItems:
                    "flex-start",
                  textAlign:
                    "left",
                  minWidth: 0,
                  overflow: "visible",
                  zIndex: 3,
                }}
              >
                <div
                  style={{
                    color:
                      cores.destaque,
                    fontSize:
                      "clamp(13px,1.7vw,24px)",
                    fontWeight:
                      "900",
                    letterSpacing:
                      ".08em",
                    marginBottom:
                      "8px",
                  }}
                >
                  {copyPedido?.chamada ||
                    copyAutomatica.chamada}
                </div>

                <div
                  style={{
                    fontSize:
                      ehVertical
                        ? "clamp(22px,3.8vw,48px)"
                        : "clamp(20px,3vw,42px)",
                    fontWeight:
                      "1000",
                    lineHeight:
                      ".92",
                    letterSpacing:
                      "-.025em",
                    textTransform:
                      "uppercase",
                    textShadow:
                      paleta ===
                      "clean"
                        ? "none"
                        : "0 4px 18px rgba(0,0,0,.25)",
                    maxWidth: "100%",
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                  }}
                >
                  {
                    chamadaPrincipal
                  }
                </div>

                {precoAntigo &&
                  objetivo ===
                    "oferta" && (
                    <div
                      style={{
                        marginTop:
                          "18px",
                        color:
                          cores.apoio,
                        fontSize:
                          "clamp(12px,1.8vw,22px)",
                        textDecoration:
                          "line-through",
                        fontWeight:
                          "700",
                      }}
                    >
                      De{" "}
                      {precoAntigo}
                    </div>
                  )}

                {precoFinal &&
                  objetivo ===
                    "oferta" && (
                    <div
                      style={{
                        marginTop:
                          precoAntigo
                            ? "3px"
                            : "18px",
                        display:
                          "inline-block",
                        padding:
                          "9px 16px",
                        borderRadius:
                          "14px",
                        background:
                          `linear-gradient(135deg, ${cores.destaque}, ${cores.destaque2})`,
                        color:
                          paleta === "clean"
                            ? "#ffffff"
                            : "#020617",
                        border:
                          "1px solid rgba(255,255,255,.22)",
                        fontSize:
                          ehVertical
                            ? "clamp(26px,4.2vw,54px)"
                            : "clamp(23px,3.5vw,48px)",
                        fontWeight:
                          "1000",
                        lineHeight: 1,
                        position: "relative",
                        zIndex: 6,
                        maxWidth: "100%",
                        whiteSpace: "nowrap",
                        boxShadow:
                          "0 18px 34px rgba(0,0,0,.30), 0 0 24px rgba(255,255,255,.06)",
                      }}
                    >
                      {
                        precoFinal
                      }
                    </div>
                  )}

                <div
                  style={{
                    marginTop:
                      "10px",
                    color:
                      cores.apoio,
                    fontSize:
                      "clamp(11px,1.35vw,18px)",
                    fontWeight:
                      "650",
                    lineHeight:
                      "1.25",
                    maxWidth:
                      "100%",
                    overflowWrap:
                      "anywhere",
                  }}
                >
                  {apoio}
                </div>
              </div>

              <div
                style={{
                  position:
                    "absolute",
                  left: "5%",
                  right: "5%",
                  bottom: "5%",
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "space-between",
                  gap: "14px",
                  padding:
                    "12px 16px",
                  borderRadius:
                    "14px",
                  background:
                    cores.caixa,
                  border:
                    `1px solid ${cores.destaque}`,
                  boxShadow:
                    "0 14px 34px rgba(0,0,0,.28)",
                  backdropFilter:
                    "blur(7px)",
                  zIndex: 4,
                }}
              >
                <div
                  style={{
                    fontSize:
                      "clamp(10px,1.35vw,17px)",
                    fontWeight:
                      "750",
                    minWidth: 0,
                  }}
                >
                  {objetivo ===
                    "horario" &&
                  textoExtra
                    ? textoExtra
                    : marca.telefone
                      ? `📞 ${marca.telefone}`
                      : `💬 ${
                          copyPedido?.cta ||
                          copyAutomatica.cta
                        }`}
                </div>

                <div
                  style={{
                    color:
                      cores.destaque,
                    fontSize:
                      "clamp(9px,1.2vw,15px)",
                    fontWeight:
                      "800",
                    textAlign:
                      "right",
                  }}
                >
                  {marca.site ||
                    marca.endereco ||
                    "PAIIA AI"}
                </div>
              </div>
                </>
              )}
            </div>
          </div>
          </div>

          <div
            style={{
              marginTop: "8px",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                padding: "4px 10px",
                borderRadius: "999px",
                border: aprovado
                  ? "1px solid #22c55e"
                  : "1px solid #f59e0b",
                background: aprovado
                  ? "rgba(34,197,94,.12)"
                  : "rgba(245,158,11,.10)",
                color: aprovado
                  ? "#86efac"
                  : "#fde68a",
                fontWeight: "900",
                fontSize: "11px",
              }}
            >
              {!bannerGerado
                ? "⚪ PRONTO PARA CRIAR"
                : aprovado
                  ? "✅ APROVADO"
                  : "🟡 AGUARDANDO APROVAÇÃO"}
            </div>
          </div>

          {status && (
            <div
              style={{
                marginTop: "8px",
                padding:
                  "8px 10px",
                borderRadius:
                  "8px",
                border:
                  "1px solid #334155",
                background:
                  "#020617",
                color:
                  "#bfdbfe",
                textAlign:
                  "center",
                fontSize:
                  "12px",
              }}
            >
              {status}
            </div>
          )}

          <label
            style={{
              marginTop: "8px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "#cbd5e1",
              fontSize: "12px",
              cursor: "pointer",
            }}
            title="Quando ligado, só o fundo branco ligado às bordas fica transparente. Peças brancas/claras são protegidas. Desligue se a sua peça for muito clara."
          >
            <input
              type="checkbox"
              checked={removerFundoAuto}
              onChange={(evento) =>
                alternarRemoverFundoAuto(
                  evento.target.checked
                )
              }
            />
            Remover fundo branco automaticamente
            {!removerFundoAuto ? (
              <span style={{ color: "#fde68a" }}>
                (foto usada como está)
              </span>
            ) : null}
          </label>

          <label
            style={{
              marginTop: "6px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "#cbd5e1",
              fontSize: "12px",
              cursor: "pointer",
            }}
            title="A IA (OpenAI) cria só o cenário ao redor da sua foto. A peça é colada por cima sem alteração e os textos são escritos pelo PAIIA."
          >
            <input
              type="checkbox"
              checked={usarIA}
              onChange={(evento) =>
                alternarUsarIA(evento.target.checked)
              }
            />
            Cenário profissional com IA (OpenAI)
            <span style={{ color: "#94a3b8" }}>
              {usarIA ? "≈ US$ 0,05 por geração" : "(cenário PAIIA, sem custo)"}
            </span>
          </label>

          {infoIA && (
            <div
              style={{
                marginTop: "6px",
                padding: "7px 9px",
                borderRadius: "8px",
                border: "1px solid #334155",
                background: "#020617",
                color: infoIA.startsWith("✅")
                  ? "#86efac"
                  : "#fde68a",
                fontSize: "11px",
              }}
            >
              {infoIA}
            </div>
          )}

          {falhaIA && (
            <div
              role="alert"
              style={{
                marginTop: "8px",
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid #ef4444",
                background: "rgba(127,29,29,.22)",
                color: "#fecaca",
                fontSize: "12px",
                lineHeight: 1.45,
              }}
            >
              <strong>❌ A IA da OpenAI não gerou o banner.</strong>
              <div style={{ marginTop: "4px" }}>
                {falhaIA.mensagem}
              </div>
              <div style={{ marginTop: "4px", color: "#fca5a5", fontSize: "11px" }}>
                Código: {falhaIA.codigo || "FALHA_IA"}
              </div>
              <div
                style={{
                  marginTop: "8px",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "6px",
                }}
              >
                <button
                  type="button"
                  onClick={() => gerarComIA()}
                  disabled={gerandoFundoIA}
                  style={{ ...botaoPrincipal, padding: "8px 10px", fontSize: "12px" }}
                >
                  🔄 Tentar de novo com IA
                </button>
                <button
                  type="button"
                  onClick={() => gerarComIA({ semIA: true })}
                  disabled={gerandoFundoIA}
                  style={{ ...botaoSecundario, padding: "8px 10px", fontSize: "12px" }}
                >
                  Usar cenário PAIIA (sem IA)
                </button>
              </div>
            </div>
          )}

                    <div
            style={{
              marginTop: "8px",
              display: "grid",
              gridTemplateColumns:
                "1fr 1fr",
              gap: "8px",
            }}
          >
            <button
              type="button"
              onClick={() => gerarComIA()}
              disabled={gerandoFundoIA}
              style={{
                ...botaoPrincipal,
                width: "100%",
                padding: "11px 12px",
                fontSize: "13px",
                opacity:
                  gerandoFundoIA
                    ? 0.65
                    : 1,
                cursor:
                  gerandoFundoIA
                    ? "wait"
                    : "pointer",
              }}
            >
              {gerandoFundoIA
                ? "🎨 Montando..."
                : fundoIA
                  ? "🔄 Gerar novamente"
                  : "✨ Gerar Banner"}
            </button>

            <button
              type="button"
              onClick={aprovarBanner}
              disabled={
                !arteLiberada ||
                (aprovado && bannerSalvo)
              }
              style={{
                ...botaoAprovar,
                width: "100%",
                padding: "11px 12px",
                fontSize: "13px",
                opacity:
                  !arteLiberada ||
                  (aprovado && bannerSalvo)
                    ? 0.5
                    : 1,
                cursor:
                  !arteLiberada ||
                  (aprovado && bannerSalvo)
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {aprovado && bannerSalvo
                ? "✅ Salvo na Galeria"
                : "✅ Aprovar e salvar"}
            </button>
          </div>

          {arteDesatualizada && (
            <div
              style={{
                marginTop: "8px",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid #f59e0b",
                background: "rgba(245,158,11,.10)",
                color: "#fde68a",
                fontSize: "12px",
                textAlign: "center",
              }}
            >
              🔄 Você mudou opções depois de gerar. Clique em “Gerar novamente” para atualizar a arte.
            </div>
          )}

          {aprovado &&
            bannerSalvo &&
            temAnuncioEmAndamento() && (
              <button
                type="button"
                onClick={usarBannerNoAnuncio}
                disabled={bannerNoAnuncio}
                style={{
                  ...botaoSecundario,
                  width: "100%",
                  marginTop: "6px",
                  padding: "9px 10px",
                  fontSize: "12px",
                  opacity: bannerNoAnuncio ? 0.6 : 1,
                }}
              >
                {bannerNoAnuncio
                  ? "✅ Banner está no anúncio"
                  : "➕ Usar no anúncio em andamento"}
              </button>
            )}

          <button
            type="button"
            onClick={() => {
              try {
                localStorage.setItem(
                  "filtroGaleria",
                  "banner"
                );
              } catch {
                // filtro é só conveniência
              }
              setScreen?.("galeria");
            }}
            style={{
              ...botaoSecundario,
              width: "100%",
              marginTop: "6px",
              padding: "7px 10px",
              fontSize: "12px",
            }}
          >
            Meus Banners
          </button>

          {arteLiberada && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "16px",
                  borderRadius: "14px",
                  border:
                    "1px solid #334155",
                  background:
                    "#020617",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems:
                      "center",
                    gap: "10px",
                    flexWrap: "wrap",
                    marginBottom:
                      "12px",
                  }}
                >
                  <div>
                    <strong
                      style={{
                        color:
                          "#e2e8f0",
                        fontSize:
                          "15px",
                      }}
                    >
                      📐 Formatar para publicação
                    </strong>

                    <div
                      style={{
                        color:
                          "#64748b",
                        fontSize:
                          "12px",
                        marginTop:
                          "3px",
                      }}
                    >
                      Mesma foto e mesmos textos, com o layout refeito na medida de cada canal.
                    </div>
                  </div>

                  <span
                    style={{
                      padding:
                        "6px 10px",
                      borderRadius:
                        "999px",
                      border:
                        "1px solid #22c55e",
                      background:
                        "rgba(34,197,94,.10)",
                      color:
                        "#86efac",
                      fontSize:
                        "11px",
                      fontWeight:
                        "900",
                    }}
                  >
                    1 ARTE → VÁRIOS FORMATOS
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit,minmax(145px,1fr))",
                    gap: "9px",
                  }}
                >
                  {[
                    "mercadoLivre",
                    "instagram",
                    "facebook",
                    "story",
                    "whatsapp",
                  ].map(
                    (
                      chaveDestino
                    ) => {
                      const destino =
                        FORMATOS[
                          chaveDestino
                        ];

                      return (
                        <button
                          key={
                            chaveDestino
                          }
                          type="button"
                          onClick={() =>
                            exportarVersaoDestino(
                              chaveDestino
                            )
                          }
                          style={{
                            padding:
                              "11px 10px",
                            borderRadius:
                              "11px",
                            border:
                              "1px solid #334155",
                            background:
                              "#0f172a",
                            color:
                              "#e2e8f0",
                            cursor:
                              "pointer",
                            textAlign:
                              "left",
                          }}
                        >
                          <div
                            style={{
                              fontWeight:
                                "900",
                              fontSize:
                                "12px",
                            }}
                          >
                            {
                              destino.icone
                            }{" "}
                            {
                              destino.nome
                            }
                          </div>

                          <div
                            style={{
                              color:
                                "#64748b",
                              fontSize:
                                "10px",
                              marginTop:
                                "3px",
                            }}
                          >
                            {
                              destino.largura
                            }{" "}
                            ×{" "}
                            {
                              destino.altura
                            }
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            )}

          <div
            style={{
              marginTop: "15px",
              color: "#64748b",
              fontSize: "12px",
              lineHeight: 1.5,
              textAlign: "center",
            }}
          >
            O banner é montado com a sua foto real: a peça não é redesenhada.
            Depois de gerar, baixe o PNG ou crie as versões para outros canais.
          </div>
        </main>
      </div>

      {mostrarGaleria && (
        <div
          className="paiia-galeria-modal"
          onClick={() =>
            setMostrarGaleria(
              false
            )
          }
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background:
              "rgba(2,6,23,.90)",
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            padding: "24px",
          }}
        >
          <div
            className="paiia-galeria-modal-caixa"
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              width:
                "min(980px,96vw)",
              maxHeight: "86vh",
              overflowY: "auto",
              borderRadius:
                "20px",
              padding: "22px",
              background:
                "#0f172a",
              border:
                "1px solid #334155",
              boxShadow:
                "0 30px 90px rgba(0,0,0,.55)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                gap: "14px",
                marginBottom:
                  "18px",
              }}
            >
              <div>
                <h2
                  style={{
                    color:
                      "#67e8f9",
                    margin: 0,
                  }}
                >
                  🖼️ Galeria PAIIA
                </h2>

                <p
                  style={{
                    color:
                      "#94a3b8",
                    margin:
                      "6px 0 0",
                    fontSize:
                      "13px",
                  }}
                >
                  Escolha a foto do produto
                  (ou envie do seu aparelho).
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setMostrarGaleria(
                    false
                  )
                }
                style={
                  botaoSecundario
                }
              >
                ✕ Fechar
              </button>
            </div>

            {imagensDisponiveis.length ===
            0 ? (
              <div
                style={{
                  padding:
                    "35px 20px",
                  textAlign:
                    "center",
                  color:
                    "#94a3b8",
                  border:
                    "1px dashed #334155",
                  borderRadius:
                    "14px",
                  background:
                    "#020617",
                }}
              >
                Nenhuma foto de produto
                na Galeria PAIIA ainda.
                Envie uma foto do seu aparelho.
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fill,minmax(140px,1fr))",
                  gap: "14px",
                }}
              >
                {imagensDisponiveis
  .filter((imagem) => imagem?.url)
  .map((imagem) => (

                    <button
                      key={imagem.id}
                      type="button"
                      onClick={() => {
                        setImagemSelecionada(
                          imagem.url
                        );

                        localStorage.setItem(
                          "imagemBannerSelecionada",
                          imagem.url
                        );

                        setMostrarGaleria(
                          false
                        );
                      }}
                      style={{
                        border:
                          imagemSelecionada ===
                          imagem.url
                            ? "2px solid #67e8f9"
                            : "1px solid #334155",
                        borderRadius:
                          "14px",
                        padding: "8px",
                        background:
                          "#020617",
                        cursor:
                          "pointer",
                      }}
                    >
                      <img
                        src={
                          imagem.url
                        }
                        alt="Galeria PAIIA"
                        style={{
                          width:
                            "100%",
                          height:
                            "130px",
                          objectFit:
                            "contain",
                          display:
                            "block",
                        }}
                      />
                    </button>
                  )
                )}
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                justifyContent: "center",
                marginTop: "16px",
              }}
            >
              {galeriaTemMais &&
                typeof carregarMaisGaleria === "function" && (
                  <button
                    type="button"
                    onClick={() => carregarMaisGaleria()}
                    style={botaoSecundario}
                  >
                    ⬇️ Carregar mais fotos
                  </button>
                )}
              <button
                type="button"
                onClick={() => inputFotoAparelhoRef.current?.click()}
                style={botaoSecundario}
              >
                📤 Enviar foto do aparelho
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const secaoCompactaStyle = {
  padding: "0",
  marginBottom: "10px",
};

const secaoTituloCompacto = {
  color: "#67e8f9",
  fontWeight: "900",
  fontSize: "13px",
  letterSpacing: ".2px",
  marginBottom: "6px",
};

const secaoDestaqueStyle = {
  padding: "16px",
  borderRadius: "16px",
  border: "1px solid rgba(34,211,238,.28)",
  background: "linear-gradient(180deg,rgba(8,145,178,.12),rgba(2,6,23,.32))",
  marginBottom: "16px",
};

const secaoBlocoStyle = {
  padding: "16px",
  borderRadius: "16px",
  border: "1px solid #26364d",
  background: "rgba(2,6,23,.45)",
  marginBottom: "16px",
};

const secaoTituloStyle = {
  color: "#67e8f9",
  fontWeight: "900",
  fontSize: "16px",
  letterSpacing: ".2px",
  marginBottom: "6px",
};

const secaoApoioStyle = {
  color: "#94a3b8",
  fontSize: "13px",
  lineHeight: 1.45,
  margin: "0 0 12px",
};

const gradeFormatos = {
  display: "grid",
  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  gap: "8px",
};

const formatoCardStyle = {
  minHeight: "48px",
  padding: "6px 4px",
  borderRadius: "10px",
  color: "#e2e8f0",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "2px",
  textAlign: "center",
};

const painelStyle = {
  padding: "12px",
  borderRadius: "16px",
  border: "1px solid #26364d",
  background: "rgba(15,23,42,.94)",
  boxShadow: "0 12px 32px rgba(0,0,0,.22)",
};

const previewPainel = {
  padding: "18px",
  borderRadius: "18px",
  border: "1px solid #26364d",
  background: "rgba(15,23,42,.94)",
  boxShadow: "0 18px 50px rgba(0,0,0,.22)",
};


const gradeDois = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "8px",
};

const opcaoStyle = {
  padding: "11px 8px",
  borderRadius: "11px",
  background: "#020617",
  color: "#e2e8f0",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "5px",
  textAlign: "center",
};

const separador = {
  height: "1px",
  background: "#1e293b",
  margin: "14px 0",
};

const labelStyle = {
  display: "block",
  color: "#cbd5e1",
  fontSize: "12px",
  fontWeight: "700",
  marginTop: "10px",
};

const inputStyle = {
  width: "100%",
  marginTop: "8px",
  padding: "13px 14px",
  borderRadius: "12px",
  border: "1px solid #334155",
  background: "#020617",
  color: "#f8fafc",
  outline: "none",
  boxSizing: "border-box",
  fontSize: "15px",
};

const botaoPrincipal = {
  padding: "12px 16px",
  borderRadius: "10px",
  border: "1px solid #38bdf8",
  background:
    "linear-gradient(135deg,#1d4ed8,#0891b2)",
  color: "#ffffff",
  fontWeight: "900",
  cursor: "pointer",
};

const botaoAprovar = {
  padding: "12px 16px",
  borderRadius: "10px",
  border: "1px solid #22c55e",
  background:
    "linear-gradient(135deg,#15803d,#22c55e)",
  color: "#ffffff",
  fontWeight: "900",
  cursor: "pointer",
};

const botaoSecundario = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid #334155",
  background: "#111827",
  color: "#e2e8f0",
  fontWeight: "800",
  cursor: "pointer",
};
