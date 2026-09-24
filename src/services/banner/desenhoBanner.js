// Banner Express — desenho da arte no navegador (canvas).
// A foto real da peça é colada por último, pixel a pixel, sem ser
// redesenhada. Preço, código, site, WhatsApp e logo são desenhados aqui
// (nunca pela IA), exatamente como foram digitados/cadastrados.
import fonte900Italico from "../../assets/fontes/barlow-condensed-latin-900-italic.woff2";
import fonte700Italico from "../../assets/fontes/barlow-condensed-latin-700-italic.woff2";
import fonte700 from "../../assets/fontes/barlow-condensed-latin-700-normal.woff2";

import { numeroAleatorio, partesPreco } from "./composicaoBanner.js";

const FAMILIA_TITULO = "PAIIA Titulo";
const FAMILIA_APOIO = "PAIIA Apoio";
const FAMILIA_TEXTO = "PAIIA Texto";
const RESERVA = "'Arial Black', Impact, 'Helvetica Neue', Arial, sans-serif";

let fontesPromessa = null;

export function carregarFontesBanner() {
  if (fontesPromessa) return fontesPromessa;
  fontesPromessa = (async () => {
    if (typeof FontFace === "undefined" || typeof document === "undefined") return false;
    const fontes = [
      new FontFace(FAMILIA_TITULO, `url(${fonte900Italico})`, { weight: "900", style: "italic" }),
      new FontFace(FAMILIA_APOIO, `url(${fonte700Italico})`, { weight: "700", style: "italic" }),
      new FontFace(FAMILIA_TEXTO, `url(${fonte700})`, { weight: "700", style: "normal" }),
    ];
    try {
      const carregadas = await Promise.all(fontes.map((fonte) => fonte.load()));
      carregadas.forEach((fonte) => document.fonts.add(fonte));
      return true;
    } catch {
      return false; // segue com as fontes do sistema
    }
  })();
  return fontesPromessa;
}

function fonteTitulo(tamanho) {
  return `italic 900 ${Math.round(tamanho)}px "${FAMILIA_TITULO}", ${RESERVA}`;
}
function fonteApoio(tamanho) {
  return `italic 700 ${Math.round(tamanho)}px "${FAMILIA_APOIO}", ${RESERVA}`;
}
function fonteTexto(tamanho) {
  return `700 ${Math.round(tamanho)}px "${FAMILIA_TEXTO}", Arial, sans-serif`;
}

export const PALETAS_DESENHO = {
  azul: {
    base: ["#01040f", "#041436", "#0a2c78"],
    acento: "#22d3ee",
    acento2: "#2563eb",
    brilho: [56, 189, 248],
    titulo: ["#ffffff", "#dbeafe"],
    titulo2: ["#a5f3fc", "#22d3ee"],
    texto: "#ffffff",
    apoio: "#cfe7ff",
    painel: "rgba(2,8,28,.78)",
    claro: false,
  },
  vermelho: {
    base: ["#0d0204", "#3a0710", "#7f1212"],
    acento: "#facc15",
    acento2: "#f97316",
    brilho: [249, 115, 22],
    titulo: ["#ffffff", "#fee2e2"],
    titulo2: ["#fde047", "#f97316"],
    texto: "#ffffff",
    apoio: "#ffe4d6",
    painel: "rgba(24,4,6,.8)",
    claro: false,
  },
  escuro: {
    base: ["#020308", "#0b1020", "#1b1542"],
    acento: "#22d3ee",
    acento2: "#a855f7",
    brilho: [168, 85, 247],
    titulo: ["#ffffff", "#e2e8f0"],
    titulo2: ["#67e8f9", "#a855f7"],
    texto: "#ffffff",
    apoio: "#e2e8f0",
    painel: "rgba(3,6,18,.8)",
    claro: false,
  },
  clean: {
    base: ["#ffffff", "#eef5ff", "#cfe1fb"],
    acento: "#1d4ed8",
    acento2: "#0891b2",
    brilho: [59, 130, 246],
    titulo: ["#0b1a3a", "#1e3a8a"],
    titulo2: ["#1d4ed8", "#0891b2"],
    texto: "#0f172a",
    apoio: "#334155",
    painel: "rgba(255,255,255,.9)",
    claro: true,
  },
};

function rgba([r, g, b], a) {
  return `rgba(${r},${g},${b},${a})`;
}

function aleatorio(semente) {
  let contador = 0;
  return () => {
    contador += 1;
    return numeroAleatorio(semente * 131 + contador * 17);
  };
}

// ---------------------------------------------------------------
// Cenário programático (usado quando a IA não está disponível)
// ---------------------------------------------------------------
function desenharCenario(ctx, largura, altura, paleta, plano, variacao) {
  const produto = plano.produto;
  const cx = produto.x + produto.largura / 2;
  const cy = produto.y + produto.altura / 2;
  const raio = Math.max(produto.largura, produto.altura);
  const rnd = aleatorio(variacao + 1);
  const cenario = plano.cenario;

  const base = ctx.createLinearGradient(0, 0, largura * 0.35, altura);
  base.addColorStop(0, paleta.base[0]);
  base.addColorStop(0.55, paleta.base[1]);
  base.addColorStop(1, paleta.base[2]);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, largura, altura);

  // Luz ambiente oposta ao produto (profundidade)
  const luzOposta = ctx.createRadialGradient(
    largura - cx, altura * 0.2, 0, largura - cx, altura * 0.2, Math.max(largura, altura) * 0.6
  );
  luzOposta.addColorStop(0, rgba(paleta.brilho, paleta.claro ? 0.1 : 0.16));
  luzOposta.addColorStop(1, rgba(paleta.brilho, 0));
  ctx.fillStyle = luzOposta;
  ctx.fillRect(0, 0, largura, altura);

  if (cenario.grade) {
    ctx.save();
    const horizonte = altura * 0.58;
    ctx.strokeStyle = rgba(paleta.brilho, paleta.claro ? 0.16 : 0.22);
    ctx.lineWidth = Math.max(1, largura * 0.0016);
    for (let i = 0; i < 14; i += 1) {
      const t = i / 13;
      const y = horizonte + (altura - horizonte) * t * t;
      ctx.globalAlpha = 0.25 + t * 0.6;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(largura, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.5;
    for (let i = -10; i <= 10; i += 1) {
      ctx.beginPath();
      ctx.moveTo(largura / 2 + i * largura * 0.02, horizonte);
      ctx.lineTo(largura / 2 + i * largura * 0.22, altura);
      ctx.stroke();
    }
    const fadeGrade = ctx.createLinearGradient(0, horizonte, 0, horizonte + altura * 0.15);
    fadeGrade.addColorStop(0, paleta.base[1]);
    fadeGrade.addColorStop(1, rgba([0, 0, 0], 0));
    ctx.globalAlpha = 1;
    ctx.fillStyle = fadeGrade;
    ctx.fillRect(0, horizonte, largura, altura * 0.15);
    ctx.restore();
  }

  if (cenario.feixes) {
    ctx.save();
    ctx.globalCompositeOperation = paleta.claro ? "source-over" : "lighter";
    const quantidade = 5 + Math.floor(rnd() * 3);
    for (let i = 0; i < quantidade; i += 1) {
      const x0 = rnd() * largura * 1.2 - largura * 0.1;
      const espessura = largura * (0.015 + rnd() * 0.05);
      const inclinacao = largura * (0.35 + rnd() * 0.3);
      const grad = ctx.createLinearGradient(x0, 0, x0 - inclinacao, altura);
      grad.addColorStop(0, rgba(paleta.brilho, 0));
      grad.addColorStop(0.5, rgba(paleta.brilho, paleta.claro ? 0.08 : 0.12 + rnd() * 0.1));
      grad.addColorStop(1, rgba(paleta.brilho, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(x0 + espessura, 0);
      ctx.lineTo(x0 + espessura - inclinacao, altura);
      ctx.lineTo(x0 - inclinacao, altura);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Bokeh / partículas de luz
  ctx.save();
  ctx.globalCompositeOperation = paleta.claro ? "source-over" : "lighter";
  const bolhas = cenario.id === "oficina-bokeh" ? 26 : 12;
  for (let i = 0; i < bolhas; i += 1) {
    const bx = rnd() * largura;
    const by = rnd() * altura * 0.8;
    const br = Math.min(largura, altura) * (0.008 + rnd() * (cenario.id === "oficina-bokeh" ? 0.05 : 0.02));
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    g.addColorStop(0, rgba(paleta.brilho, paleta.claro ? 0.12 : 0.22));
    g.addColorStop(1, rgba(paleta.brilho, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  if (cenario.id === "fumaca-luz") {
    ctx.save();
    for (let i = 0; i < 4; i += 1) {
      const fx = cx + (rnd() - 0.5) * raio * 1.6;
      const fy = cy + (rnd() - 0.3) * raio;
      const fr = raio * (0.5 + rnd() * 0.6);
      const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
      g.addColorStop(0, paleta.claro ? "rgba(255,255,255,.5)" : "rgba(210,230,255,.08)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, largura, altura);
    }
    ctx.restore();
  }

  // Halo principal atrás da peça
  ctx.save();
  ctx.globalCompositeOperation = paleta.claro ? "source-over" : "lighter";
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, raio * 0.85);
  halo.addColorStop(0, rgba(paleta.brilho, paleta.claro ? 0.22 : 0.5));
  halo.addColorStop(0.45, rgba(paleta.brilho, paleta.claro ? 0.1 : 0.2));
  halo.addColorStop(1, rgba(paleta.brilho, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, largura, altura);
  ctx.restore();

  if (cenario.anel) {
    ctx.save();
    ctx.strokeStyle = rgba(paleta.brilho, paleta.claro ? 0.55 : 0.85);
    ctx.lineWidth = Math.max(3, Math.min(largura, altura) * 0.008);
    ctx.shadowColor = rgba(paleta.brilho, 0.9);
    ctx.shadowBlur = Math.min(largura, altura) * 0.03;
    ctx.beginPath();
    ctx.ellipse(cx, cy, raio * 0.6, raio * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Vinheta
  const vinheta = ctx.createRadialGradient(
    largura / 2, altura / 2, Math.min(largura, altura) * 0.35,
    largura / 2, altura / 2, Math.max(largura, altura) * 0.8
  );
  vinheta.addColorStop(0, "rgba(0,0,0,0)");
  vinheta.addColorStop(1, paleta.claro ? "rgba(15,23,42,.10)" : "rgba(0,0,0,.55)");
  ctx.fillStyle = vinheta;
  ctx.fillRect(0, 0, largura, altura);
}

function desenharPedestal(ctx, paleta, produto) {
  const cx = produto.x + produto.largura / 2;
  const topo = produto.y + produto.altura * 0.94;
  const rx = produto.largura * 0.56;
  const ry = Math.max(8, rx * 0.16);
  const alturaLateral = ry * 0.9;
  ctx.save();
  // lateral
  const lateral = ctx.createLinearGradient(0, topo, 0, topo + alturaLateral + ry);
  lateral.addColorStop(0, paleta.claro ? "#dbe7f7" : "#0b1733");
  lateral.addColorStop(1, paleta.claro ? "#a9bfe0" : "#01030a");
  ctx.fillStyle = lateral;
  ctx.beginPath();
  ctx.ellipse(cx, topo + alturaLateral, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(cx - rx, topo);
  ctx.ellipse(cx, topo, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  // tampo
  const tampo = ctx.createRadialGradient(cx, topo - ry * 0.3, 0, cx, topo, rx);
  tampo.addColorStop(0, paleta.claro ? "#ffffff" : "#1e3a6e");
  tampo.addColorStop(1, paleta.claro ? "#dbe7f7" : "#07122b");
  ctx.fillStyle = tampo;
  ctx.beginPath();
  ctx.ellipse(cx, topo, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  // aro de luz
  ctx.strokeStyle = rgba(paleta.brilho, 0.95);
  ctx.lineWidth = Math.max(2, rx * 0.012);
  ctx.shadowColor = rgba(paleta.brilho, 1);
  ctx.shadowBlur = rx * 0.08;
  ctx.beginPath();
  ctx.ellipse(cx, topo, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function desenharReflexo(ctx, imagem, produto) {
  const alturaReflexo = produto.altura * 0.35;
  const temp = document.createElement("canvas");
  temp.width = Math.max(1, Math.round(produto.largura));
  temp.height = Math.max(1, Math.round(alturaReflexo));
  const t = temp.getContext("2d");
  t.save();
  t.translate(0, produto.altura);
  t.scale(1, -1);
  t.drawImage(imagem, 0, 0, produto.largura, produto.altura);
  t.restore();
  t.globalCompositeOperation = "destination-in";
  const mascara = t.createLinearGradient(0, 0, 0, alturaReflexo);
  mascara.addColorStop(0, "rgba(0,0,0,.28)");
  mascara.addColorStop(1, "rgba(0,0,0,0)");
  t.fillStyle = mascara;
  t.fillRect(0, 0, temp.width, temp.height);
  ctx.drawImage(temp, produto.x, produto.y + produto.altura);
}

// Cola a peça real por último (sem filtro, sem cor, sem deformar).
function desenharProduto(ctx, imagem, produto, paleta, comEfeitos) {
  const menor = Math.min(produto.largura, produto.altura);
  if (comEfeitos) {
    // sombra de contato
    ctx.save();
    const cx = produto.x + produto.largura / 2;
    const cy = produto.y + produto.altura * 0.97;
    const sombra = ctx.createRadialGradient(cx, cy, 0, cx, cy, produto.largura * 0.5);
    sombra.addColorStop(0, paleta.claro ? "rgba(15,23,42,.35)" : "rgba(0,0,0,.7)");
    sombra.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sombra;
    ctx.beginPath();
    ctx.ellipse(cx, cy, produto.largura * 0.5, Math.max(6, menor * 0.07), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // brilho de recorte (glow) atrás da silhueta
    ctx.save();
    ctx.shadowColor = rgba(paleta.brilho, paleta.claro ? 0.45 : 0.75);
    ctx.shadowBlur = menor * 0.08;
    ctx.drawImage(imagem, produto.x, produto.y, produto.largura, produto.altura);
    ctx.restore();
  }
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(imagem, produto.x, produto.y, produto.largura, produto.altura);
  ctx.restore();
}

// ---------------------------------------------------------------
// Textos
// ---------------------------------------------------------------
function quebrarLinhas(ctx, texto, larguraMaxima) {
  const palavras = String(texto || "").trim().split(/\s+/).filter(Boolean);
  const linhas = [];
  let linha = "";
  for (const palavra of palavras) {
    const candidata = linha ? `${linha} ${palavra}` : palavra;
    if (linha && ctx.measureText(candidata).width > larguraMaxima) {
      linhas.push(linha);
      linha = palavra;
    } else {
      linha = candidata;
    }
  }
  if (linha) linhas.push(linha);
  return linhas;
}

function ajustarTexto(ctx, texto, larguraMaxima, tamanhoMaximo, tamanhoMinimo, fonte, maximoLinhas, alturaMaxima = Infinity) {
  let tamanho = tamanhoMaximo;
  let linhas;
  while (tamanho >= tamanhoMinimo) {
    ctx.font = fonte(tamanho);
    linhas = quebrarLinhas(ctx, texto, larguraMaxima);
    if (
      linhas.length <= maximoLinhas &&
      linhas.length * tamanho * 0.98 <= alturaMaxima &&
      linhas.every((l) => ctx.measureText(l).width <= larguraMaxima)
    ) {
      return { tamanho, linhas };
    }
    tamanho -= 2;
  }
  ctx.font = fonte(tamanhoMinimo);
  linhas = quebrarLinhas(ctx, texto, larguraMaxima).slice(0, maximoLinhas);
  return { tamanho: tamanhoMinimo, linhas };
}

function caixaInclinada(ctx, x, y, largura, altura, inclinacao) {
  ctx.beginPath();
  ctx.moveTo(x + inclinacao, y);
  ctx.lineTo(x + largura, y);
  ctx.lineTo(x + largura - inclinacao, y + altura);
  ctx.lineTo(x, y + altura);
  ctx.closePath();
}

function caixaArredondada(ctx, x, y, largura, altura, raio) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, largura, altura, raio);
  } else {
    ctx.rect(x, y, largura, altura);
  }
}

function iconeWhatsApp(ctx, cx, cy, r) {
  ctx.save();
  ctx.fillStyle = "#25d366";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(1.5, r * 0.16);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, Math.PI * 0.75, Math.PI * 2.55);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.5, cy + r * 0.35);
  ctx.lineTo(cx - r * 0.62, cy + r * 0.66);
  ctx.lineTo(cx - r * 0.25, cy + r * 0.54);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function iconeSite(ctx, cx, cy, r, cor) {
  ctx.save();
  ctx.strokeStyle = cor;
  ctx.lineWidth = Math.max(1.5, r * 0.14);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
  ctx.moveTo(cx - r * 0.85, cy);
  ctx.lineTo(cx + r * 0.85, cy);
  ctx.moveTo(cx, cy - r * 0.85);
  ctx.ellipse(cx, cy, r * 0.38, r * 0.85, 0, -Math.PI / 2, Math.PI * 1.5);
  ctx.stroke();
  ctx.restore();
}

// Verifica se o logo tem transparência e se é escuro (só para decidir o
// fundo atrás dele; os pixels do logo nunca são alterados).
function analisarLogo(imagem) {
  try {
    const lw = imagem.naturalWidth || imagem.width;
    const lh = imagem.naturalHeight || imagem.height;
    const escala = Math.min(1, 96 / Math.max(lw, lh));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(lw * escala));
    c.height = Math.max(1, Math.round(lh * escala));
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(imagem, 0, 0, c.width, c.height);
    const p = x.getImageData(0, 0, c.width, c.height).data;
    let transparentes = 0;
    let soma = 0;
    let opacos = 0;
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] < 200) transparentes += 1;
      if (p[i + 3] > 128) {
        opacos += 1;
        soma += (0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2]) / 255;
      }
    }
    const total = p.length / 4;
    return {
      transparente: transparentes / total > 0.02,
      escuro: opacos > 0 && soma / opacos < 0.35,
    };
  } catch {
    return { transparente: false, escuro: false };
  }
}

// ---------------------------------------------------------------
// Montagem completa
// ---------------------------------------------------------------
export async function montarBannerProfissional({
  largura,
  altura,
  paletaId = "azul",
  produto,
  plano,
  textos = {},
  comerciais = {},
  chamadaMl = "",
  cenarioIA = null,
  logoImagem = null,
  variacao = 0,
}) {
  await carregarFontesBanner();
  const paleta = PALETAS_DESENHO[paletaId] || PALETAS_DESENHO.azul;
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível montar o banner.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const registro = {
    textos: [],
    produtoRect: plano.produto,
    layout: plano.nome,
    cenario: cenarioIA ? "openai" : plano.cenario.id,
    usouIA: Boolean(cenarioIA),
    elementos: [],
  };
  const escrever = (texto, x, y) => {
    const valor = String(texto);
    ctx.fillText(valor, x, y);
    registro.textos.push(valor);
  };
  const m = plano.margem;

  // 1) Cenário
  if (cenarioIA) {
    const escala = Math.max(largura / cenarioIA.width, altura / cenarioIA.height);
    const w = cenarioIA.width * escala;
    const h = cenarioIA.height * escala;
    ctx.drawImage(cenarioIA, (largura - w) / 2, (altura - h) / 2, w, h);
  } else {
    desenharCenario(ctx, largura, altura, paleta, plano, variacao);
  }
  // Pedestal/reflexo do PAIIA (também sobre o cenário da IA, que vem vazio)
  if (plano.cenario.pedestal) {
    desenharPedestal(ctx, paleta, plano.produto);
  } else if (plano.areaProduto) {
    ctx.save();
    const a = plano.areaProduto;
    ctx.beginPath();
    ctx.rect(a.x, a.y, a.largura, a.altura);
    ctx.clip();
    desenharReflexo(ctx, produto, plano.produto);
    ctx.restore();
  }

  // 2) Peça real (por último na camada do produto)
  desenharProduto(ctx, produto, plano.produto, paleta, true);

  // 3) Chamada curta do Mercado Livre
  if (plano.zonaChamadaMl && chamadaMl) {
    const z = plano.zonaChamadaMl;
    const inclinacao = z.altura * 0.35;
    const grad = ctx.createLinearGradient(z.x, 0, z.x + z.largura, 0);
    grad.addColorStop(0, paleta.acento2);
    grad.addColorStop(1, paleta.acento);
    ctx.save();
    ctx.shadowColor = rgba(paleta.brilho, 0.7);
    ctx.shadowBlur = z.altura * 0.4;
    ctx.fillStyle = grad;
    caixaInclinada(ctx, z.x + z.largura * 0.08, z.y, z.largura * 0.84, z.altura, inclinacao);
    ctx.fill();
    ctx.restore();
    const ajuste = ajustarTexto(ctx, chamadaMl, z.largura * 0.7, z.altura * 0.62, z.altura * 0.3, fonteTitulo, 1);
    ctx.font = fonteTitulo(ajuste.tamanho);
    ctx.fillStyle = paleta.claro ? "#ffffff" : "#020617";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    escrever(ajuste.linhas[0] || chamadaMl, z.x + z.largura / 2, z.y + z.altura / 2);
    ctx.textAlign = "left";
    registro.elementos.push("chamadaMl");
  }

  // 5) Título, apoio, preço, código e CTA
  const zt = plano.zonaTexto;
  if (zt) {
    const centro = plano.alinhamento === "center";
    const blocos = [];
    const titulo = String(textos.titulo || "").toUpperCase().trim();
    const apoio = String(textos.apoio || "").toUpperCase().trim();
    const tituloMax = zt.largura * 0.4;
    const alturaTituloMax = plano.zonaPreco ? zt.altura * 0.78 : zt.altura * 0.42;
    const ajusteTitulo = ajustarTexto(ctx, titulo, zt.largura * 0.98, tituloMax, 24, fonteTitulo, 3, alturaTituloMax);
    blocos.push({ tipo: "titulo", ...ajusteTitulo, altura: ajusteTitulo.linhas.length * ajusteTitulo.tamanho * 0.98 });
    if (apoio) {
      const apoioMax = Math.max(18, ajusteTitulo.tamanho * 0.3);
      const ajusteApoio = ajustarTexto(ctx, apoio, zt.largura * 0.86, apoioMax, apoioMax * 0.6, fonteApoio, 1);
      blocos.push({ tipo: "apoio", ...ajusteApoio, altura: ajusteApoio.tamanho * 1.7 });
    }
    const alturaTotal = blocos.reduce((soma, b) => soma + b.altura, 0) + (blocos.length - 1) * m * 0.3;
    let y = plano.zonaPreco ? zt.y + Math.max(0, (zt.altura - alturaTotal) * 0.35) : zt.y;
    if (!plano.zonaPreco) {
      // texto + preço dividem a mesma coluna: começa um pouco acima do meio
      y = zt.y + Math.max(0, zt.altura * 0.04);
    }
    for (const bloco of blocos) {
      if (bloco.tipo === "titulo") {
        ctx.textBaseline = "top";
        bloco.linhas.forEach((linha, indice) => {
          ctx.font = fonteTitulo(bloco.tamanho);
          const w = ctx.measureText(linha).width;
          const x = centro ? zt.x + (zt.largura - w) / 2 : zt.x;
          const ultima = indice === bloco.linhas.length - 1 && bloco.linhas.length > 1;
          const cores = ultima ? paleta.titulo2 : paleta.titulo;
          const grad = ctx.createLinearGradient(0, y, 0, y + bloco.tamanho);
          grad.addColorStop(0, cores[0]);
          grad.addColorStop(1, cores[1]);
          ctx.save();
          ctx.shadowColor = paleta.claro ? "rgba(15,23,42,.25)" : "rgba(0,0,0,.65)";
          ctx.shadowBlur = bloco.tamanho * 0.12;
          ctx.shadowOffsetY = bloco.tamanho * 0.04;
          // Contorno escuro: título legível sobre qualquer cenário da IA.
          ctx.lineJoin = "round";
          ctx.lineWidth = Math.max(3, bloco.tamanho * 0.07);
          ctx.strokeStyle = paleta.claro ? "rgba(255,255,255,.95)" : "rgba(2,6,23,.9)";
          ctx.strokeText(linha, x, y);
          ctx.shadowColor = "rgba(0,0,0,0)";
          ctx.fillStyle = grad;
          escrever(linha, x, y);
          ctx.restore();
          y += bloco.tamanho * 0.98;
        });
      } else {
        ctx.font = fonteApoio(bloco.tamanho);
        const texto = bloco.linhas[0] || "";
        const w = ctx.measureText(texto).width + bloco.tamanho * 1.6;
        const h = bloco.tamanho * 1.45;
        const x = centro ? zt.x + (zt.largura - w) / 2 : zt.x;
        y += m * 0.3;
        ctx.save();
        ctx.fillStyle = paleta.painel;
        ctx.strokeStyle = paleta.acento;
        ctx.lineWidth = Math.max(1.5, h * 0.05);
        caixaInclinada(ctx, x, y, w, h, h * 0.3);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = paleta.claro ? paleta.acento : paleta.apoio;
        ctx.textBaseline = "middle";
        escrever(texto, x + bloco.tamanho * 0.8, y + h / 2);
        y += h;
      }
    }

    // Preço / código / CTA
    const zp = plano.zonaPreco || { x: zt.x, y: y + m * 0.5, largura: zt.largura, altura: zt.y + zt.altura - (y + m * 0.5) };
    const itensPreco = [];
    const partes = comerciais.preco ? partesPreco(comerciais.preco) : null;
    // Preço grande: ocupa quase toda a largura disponível.
    let baseTamanho = Math.min(zp.altura * 0.36, zp.largura * 0.36);
    if (partes) {
      ctx.font = fonteTitulo(100);
      const wi100 = ctx.measureText(partes.inteiro).width;
      ctx.font = fonteTitulo(42);
      const extras100 = (partes.simbolo ? ctx.measureText(`${partes.simbolo} `).width : 0) +
        (partes.centavos ? ctx.measureText(partes.centavos).width : 0);
      const largura100 = wi100 + extras100 + 50;
      baseTamanho = Math.min(baseTamanho, (zp.largura * 0.94 * 100) / largura100);
    }
    let alturaPreco = 0;
    if (partes) alturaPreco += baseTamanho * 1.75;
    if (comerciais.codigo) alturaPreco += baseTamanho * 0.55 + m * 0.3;
    const cta = String(textos.cta || "").toUpperCase().trim();
    if (cta) alturaPreco += baseTamanho * 0.62 + m * 0.35;
    let yp = zp.y + Math.max(0, (zp.altura - alturaPreco) / 2);
    const centroPreco = plano.alinhamento === "center" || (plano.zonaPreco && plano.nome === "titulo-topo");

    if (partes) {
      const rotuloTamanho = baseTamanho * 0.16;
      const tamanhoInteiro = baseTamanho;
      ctx.font = fonteTitulo(tamanhoInteiro);
      const wInteiro = ctx.measureText(partes.inteiro).width;
      ctx.font = fonteTitulo(tamanhoInteiro * 0.42);
      const wSimbolo = partes.simbolo ? ctx.measureText(`${partes.simbolo} `).width : 0;
      const wCentavos = partes.centavos ? ctx.measureText(partes.centavos).width : 0;
      let larguraPreco = wSimbolo + wInteiro + wCentavos;
      let escala = 1;
      const limite = zp.largura * 0.92;
      if (larguraPreco + tamanhoInteiro * 0.5 > limite) {
        escala = limite / (larguraPreco + tamanhoInteiro * 0.5);
      }
      const ti = tamanhoInteiro * escala;
      ctx.font = fonteTitulo(ti);
      const wi = ctx.measureText(partes.inteiro).width;
      ctx.font = fonteTitulo(ti * 0.42);
      const ws = partes.simbolo ? ctx.measureText(`${partes.simbolo} `).width : 0;
      const wc = partes.centavos ? ctx.measureText(partes.centavos).width : 0;
      larguraPreco = ws + wi + wc;
      const painelW = larguraPreco + ti * 0.5;
      const painelH = ti * 1.3;
      const px = centroPreco ? zp.x + (zp.largura - painelW) / 2 : zp.x;
      // rótulo
      ctx.font = fonteApoio(rotuloTamanho * escala + 4);
      const rotulo = "POR APENAS";
      const wr = ctx.measureText(rotulo).width + rotuloTamanho * 1.2;
      const hr = rotuloTamanho * 1.7 + 4;
      ctx.save();
      ctx.fillStyle = paleta.acento2;
      caixaInclinada(ctx, px + painelW * 0.04, yp, wr, hr, hr * 0.3);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "middle";
      escrever(rotulo, px + painelW * 0.04 + rotuloTamanho * 0.6, yp + hr / 2);
      const yPainel = yp + hr * 0.75;
      // painel
      ctx.save();
      ctx.fillStyle = paleta.painel;
      ctx.strokeStyle = paleta.acento;
      ctx.lineWidth = Math.max(2, ti * 0.035);
      ctx.shadowColor = rgba(paleta.brilho, 0.8);
      ctx.shadowBlur = ti * 0.25;
      caixaArredondada(ctx, px, yPainel, painelW, painelH, ti * 0.16);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      // valor
      const xBase = px + ti * 0.25;
      const yBase = yPainel + painelH * 0.52;
      ctx.textBaseline = "middle";
      ctx.fillStyle = paleta.claro ? paleta.acento : "#ffffff";
      if (partes.simbolo) {
        ctx.font = fonteTitulo(ti * 0.42);
        escrever(partes.simbolo, xBase, yBase - ti * 0.12);
      }
      ctx.font = fonteTitulo(ti);
      const gradPreco = ctx.createLinearGradient(0, yBase - ti / 2, 0, yBase + ti / 2);
      gradPreco.addColorStop(0, paleta.claro ? paleta.titulo2[0] : "#ffffff");
      gradPreco.addColorStop(1, paleta.claro ? paleta.titulo2[1] : paleta.apoio);
      ctx.fillStyle = gradPreco;
      escrever(partes.inteiro, xBase + ws, yBase);
      if (partes.centavos) {
        ctx.font = fonteTitulo(ti * 0.42);
        ctx.fillStyle = paleta.claro ? paleta.acento : "#ffffff";
        escrever(partes.centavos, xBase + ws + wi, yBase - ti * 0.18);
      }
      yp = yPainel + painelH + m * 0.35;
      itensPreco.push("preco");
    }

    if (comerciais.codigo) {
      const t = Math.max(18, baseTamanho * 0.22);
      ctx.font = fonteTexto(t);
      const texto = `CÓD. ${comerciais.codigo}`;
      const w = ctx.measureText(texto).width + t * 1.4;
      const h = t * 1.7;
      const x = centroPreco ? zp.x + (zp.largura - w) / 2 : zp.x;
      ctx.save();
      ctx.fillStyle = paleta.claro ? "rgba(255,255,255,.9)" : "rgba(255,255,255,.08)";
      ctx.strokeStyle = paleta.acento;
      ctx.lineWidth = 2;
      caixaArredondada(ctx, x, yp, w, h, h / 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = paleta.texto;
      ctx.textBaseline = "middle";
      escrever(texto, x + t * 0.7, yp + h / 2);
      yp += h + m * 0.35;
      itensPreco.push("codigo");
    }

    if (cta) {
      const t = Math.max(18, baseTamanho * 0.26);
      ctx.font = fonteTitulo(t);
      const texto = `${cta}  »`;
      const w = Math.min(zp.largura, ctx.measureText(texto).width + t * 1.8);
      const h = t * 1.8;
      const x = centroPreco ? zp.x + (zp.largura - w) / 2 : zp.x;
      const grad = ctx.createLinearGradient(x, 0, x + w, 0);
      grad.addColorStop(0, paleta.acento2);
      grad.addColorStop(1, paleta.acento);
      ctx.save();
      ctx.shadowColor = rgba(paleta.brilho, 0.7);
      ctx.shadowBlur = h * 0.5;
      ctx.fillStyle = grad;
      caixaArredondada(ctx, x, yp, w, h, h * 0.22);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = paleta.claro ? "#ffffff" : "#020617";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      escrever(texto, x + w / 2, yp + h / 2);
      ctx.textAlign = "left";
    }
    registro.elementos.push(...itensPreco);
  }

  // 6) Rodapé com WhatsApp e site (somente dados reais)
  if (plano.zonaRodape && (comerciais.whatsapp || comerciais.site)) {
    const z = plano.zonaRodape;
    ctx.save();
    ctx.fillStyle = paleta.painel;
    ctx.strokeStyle = rgba(paleta.brilho, 0.6);
    ctx.lineWidth = 2;
    caixaArredondada(ctx, z.x, z.y, z.largura, z.altura, z.altura * 0.25);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    const itens = [];
    if (comerciais.whatsapp) itens.push({ tipo: "whatsapp", texto: comerciais.whatsapp });
    if (comerciais.site) itens.push({ tipo: "site", texto: comerciais.site });
    const larguraItem = z.largura / itens.length;
    const t = Math.min(z.altura * 0.42, larguraItem * 0.08);
    itens.forEach((item, indice) => {
      const r = t * 0.72;
      ctx.font = fonteTexto(t);
      const wt = ctx.measureText(item.texto).width;
      const total = r * 2 + t * 0.5 + wt;
      const x0 = z.x + larguraItem * indice + Math.max(t * 0.4, (larguraItem - total) / 2);
      const cy = z.y + z.altura / 2;
      if (item.tipo === "whatsapp") iconeWhatsApp(ctx, x0 + r, cy, r);
      else iconeSite(ctx, x0 + r, cy, r, paleta.acento);
      ctx.fillStyle = paleta.texto;
      ctx.textBaseline = "middle";
      escrever(item.texto, x0 + r * 2 + t * 0.5, cy);
      registro.elementos.push(item.tipo);
    });
  }

  // 7) Logo: SEMPRE o arquivo original importado pelo usuário, como última
  //    camada, sem redesenho, sem recorte, sem mudar cor, texto ou proporção.
  //    Nunca é enviado à IA. Sem logo, usa o nome real da loja em texto.
  if (plano.zonaLogo && (logoImagem || comerciais.nomeLoja)) {
    const z = plano.zonaLogo;
    if (logoImagem) {
      const lw = logoImagem.naturalWidth || logoImagem.width;
      const lh = logoImagem.naturalHeight || logoImagem.height;
      const escala = Math.min((z.largura * 0.86) / lw, (z.altura * 0.8) / lh);
      const w = lw * escala;
      const h = lh * escala;
      const px = plano.logoCentro
        ? z.x + (z.largura - w) / 2
        : plano.logoNaDireita
          ? z.x + z.largura - w - z.altura * 0.2
          : z.x + z.altura * 0.2;
      const py = z.y + (z.altura - h) / 2;
      const analise = analisarLogo(logoImagem);
      ctx.save();
      if (!analise.transparente) {
        // Logo com fundo próprio (JPG/PNG sem transparência): moldura suave.
        ctx.fillStyle = "rgba(255,255,255,.95)";
        ctx.shadowColor = "rgba(0,0,0,.35)";
        ctx.shadowBlur = z.altura * 0.2;
        caixaArredondada(ctx, px - z.altura * 0.16, py - z.altura * 0.1, w + z.altura * 0.32, h + z.altura * 0.2, z.altura * 0.18);
        ctx.fill();
      } else if (analise.escuro && !paleta.claro) {
        // Logo transparente e escuro sobre fundo escuro: só uma luz de fundo
        // atrás dele (o logo em si não recebe nenhum efeito).
        const cx = px + w / 2;
        const cy = py + h / 2;
        const luz = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.75);
        luz.addColorStop(0, "rgba(255,255,255,.55)");
        luz.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = luz;
        ctx.fillRect(cx - w, cy - h * 1.5, w * 2, h * 3);
      }
      ctx.restore();
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(logoImagem, px, py, w, h);
      ctx.restore();
      registro.elementos.push("logo");
      registro.logoRect = { x: px, y: py, largura: w, altura: h };
    } else {
      const ajuste = ajustarTexto(ctx, comerciais.nomeLoja.toUpperCase(), z.largura, z.altura * 0.5, z.altura * 0.25, fonteTitulo, 1);
      ctx.font = fonteTitulo(ajuste.tamanho);
      ctx.fillStyle = paleta.texto;
      ctx.textBaseline = "middle";
      ctx.textAlign = plano.logoCentro ? "center" : plano.logoNaDireita ? "right" : "left";
      escrever(
        ajuste.linhas[0],
        plano.logoCentro ? z.x + z.largura / 2 : plano.logoNaDireita ? z.x + z.largura : z.x,
        z.y + z.altura / 2
      );
      ctx.textAlign = "left";
      registro.elementos.push("nomeLoja");
    }
  }

  return { dataUrl: canvas.toDataURL("image/png"), registro };
}

// Quadro de referência enviado à IA: a foto real já no lugar e no
// tamanho finais, sobre fundo transparente.
export function montarReferenciaParaIA({ produto, retanguloNoQuadro, quadro }) {
  const canvas = document.createElement("canvas");
  canvas.width = quadro.largura;
  canvas.height = quadro.altura;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    produto,
    retanguloNoQuadro.x,
    retanguloNoQuadro.y,
    retanguloNoQuadro.largura,
    retanguloNoQuadro.altura
  );
  return canvas.toDataURL("image/png");
}

// Base do cenário para a IA (modo "cenario-vazio"): só cor e luz, SEM a peça.
export function montarBaseCenarioParaIA({ retanguloNoQuadro, quadro, paletaId = "azul" }) {
  const paleta = PALETAS_DESENHO[paletaId] || PALETAS_DESENHO.azul;
  const canvas = document.createElement("canvas");
  canvas.width = quadro.largura;
  canvas.height = quadro.altura;
  const ctx = canvas.getContext("2d");
  const fundo = ctx.createLinearGradient(0, 0, 0, quadro.altura);
  fundo.addColorStop(0, paleta.claro ? "#f4f8fd" : "#07102a");
  fundo.addColorStop(1, paleta.claro ? "#d6e3f5" : "#01030a");
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, quadro.largura, quadro.altura);
  const r = retanguloNoQuadro;
  const cx = r.x + r.largura / 2;
  const cy = r.y + r.altura / 2;
  const raio = Math.max(r.largura, r.altura) * 0.75;
  const luz = ctx.createRadialGradient(cx, cy, 0, cx, cy, raio);
  luz.addColorStop(0, rgba(paleta.brilho, paleta.claro ? 0.25 : 0.35));
  luz.addColorStop(1, rgba(paleta.brilho, 0));
  ctx.fillStyle = luz;
  ctx.fillRect(0, 0, quadro.largura, quadro.altura);
  return canvas.toDataURL("image/png");
}

// Máscara para a IA: área opaca = peça (protegida), área transparente =
// fundo que a IA pode criar. A silhueta é levemente ampliada para a IA não
// "morder" a borda da peça.
export function montarMascaraParaIA({ produto, retanguloNoQuadro, quadro, dilatacao = 3 }) {
  const canvas = document.createElement("canvas");
  canvas.width = quadro.largura;
  canvas.height = quadro.altura;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const r = retanguloNoQuadro;
  for (let dx = -dilatacao; dx <= dilatacao; dx += dilatacao) {
    for (let dy = -dilatacao; dy <= dilatacao; dy += dilatacao) {
      ctx.drawImage(produto, r.x + dx, r.y + dy, r.largura, r.altura);
    }
  }
  const dados = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const p = dados.data;
  for (let i = 0; i < p.length; i += 4) {
    const opaco = p[i + 3] > 8;
    p[i] = 0;
    p[i + 1] = 0;
    p[i + 2] = 0;
    p[i + 3] = opaco ? 255 : 0;
  }
  ctx.putImageData(dados, 0, 0);
  return canvas.toDataURL("image/png");
}
