// Banner Express — DIRETOR DE ARTE: montagem final da peça publicitária
// (canvas, navegador). Camadas:
//   1. arte de fundo da IA (sem peça, sem texto)
//   2. acabamento gráfico do PAIIA (luz, linhas de energia, partículas,
//      vinheta e contraste nas áreas de texto)
//   3. base/halo + sombra + reflexo da peça
//   4. FOTO REAL da peça, colada intacta (sem recolorir, sem redesenhar)
//   5. títulos, preço, código, selos, CTA e contatos (somente dados do usuário)
//   6. logo: o arquivo original do usuário, sem alteração
import { carregarFontesBanner } from "./desenhoBanner.js";
import { partesPreco } from "./composicaoBanner.js";
import { numeroAleatorio } from "./composicaoBanner.js";
import { DIFERENCIAIS, planejarDiretor, sistemaDeCor } from "./diretorArte.js";

const RESERVA = "'Arial Black', Impact, 'Helvetica Neue', Arial, sans-serif";
const fTitulo = (t) => `italic 900 ${Math.round(t)}px "PAIIA Titulo", ${RESERVA}`;
const fApoio = (t) => `italic 700 ${Math.round(t)}px "PAIIA Apoio", ${RESERVA}`;
const fTexto = (t) => `700 ${Math.round(t)}px "PAIIA Texto", Arial, sans-serif`;

const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`;
function hexRgb(hex) {
  const h = String(hex).replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function sorteio(semente) {
  let n = 0;
  return () => numeroAleatorio(semente * 977 + (n += 1) * 31);
}

// ---------------------------------------------------------------
// formas
// ---------------------------------------------------------------
function inclinado(ctx, x, y, w, h, k) {
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - k, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}
function arredondado(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
function hexagono(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const px = cx + r * Math.cos(a);
    const py = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}
function chevrons(ctx, x, y, h, qtd, cor, direcao = 1) {
  ctx.save();
  ctx.fillStyle = cor;
  const w = h * 0.42;
  for (let i = 0; i < qtd; i += 1) {
    const x0 = x + direcao * i * w * 0.9;
    ctx.globalAlpha = 1 - i * 0.28;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + direcao * w * 0.55, y);
    ctx.lineTo(x0 + direcao * w, y + h / 2);
    ctx.lineTo(x0 + direcao * w * 0.55, y + h);
    ctx.lineTo(x0, y + h);
    ctx.lineTo(x0 + direcao * w * 0.45, y + h / 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------
// ícones simples (vetoriais, sem texto)
// ---------------------------------------------------------------
function icone(ctx, tipo, cx, cy, r, cor) {
  ctx.save();
  ctx.strokeStyle = cor;
  ctx.fillStyle = cor;
  ctx.lineWidth = Math.max(2, r * 0.13);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (tipo === "caixa") {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.8);
    ctx.lineTo(cx + r * 0.8, cy - r * 0.4);
    ctx.lineTo(cx + r * 0.8, cy + r * 0.5);
    ctx.lineTo(cx, cy + r * 0.9);
    ctx.lineTo(cx - r * 0.8, cy + r * 0.5);
    ctx.lineTo(cx - r * 0.8, cy - r * 0.4);
    ctx.closePath();
    ctx.moveTo(cx - r * 0.8, cy - r * 0.4);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + r * 0.8, cy - r * 0.4);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy + r * 0.9);
    ctx.stroke();
  } else if (tipo === "caminhao") {
    ctx.beginPath();
    ctx.rect(cx - r * 0.95, cy - r * 0.5, r * 1.15, r * 0.85);
    ctx.moveTo(cx + r * 0.2, cy - r * 0.2);
    ctx.lineTo(cx + r * 0.65, cy - r * 0.2);
    ctx.lineTo(cx + r * 0.95, cy + r * 0.1);
    ctx.lineTo(cx + r * 0.95, cy + r * 0.35);
    ctx.lineTo(cx + r * 0.2, cy + r * 0.35);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx - r * 0.5, cy + r * 0.52, r * 0.18, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.6, cy + r * 0.52, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
  } else if (tipo === "escudo" || tipo === "selo") {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.9);
    ctx.lineTo(cx + r * 0.75, cy - r * 0.55);
    ctx.quadraticCurveTo(cx + r * 0.7, cy + r * 0.5, cx, cy + r * 0.95);
    ctx.quadraticCurveTo(cx - r * 0.7, cy + r * 0.5, cx - r * 0.75, cy - r * 0.55);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.32, cy);
    ctx.lineTo(cx - r * 0.05, cy + r * 0.28);
    ctx.lineTo(cx + r * 0.38, cy - r * 0.25);
    ctx.stroke();
  } else {
    // check em círculo
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.38, cy);
    ctx.lineTo(cx - r * 0.08, cy + r * 0.3);
    ctx.lineTo(cx + r * 0.42, cy - r * 0.28);
    ctx.stroke();
  }
  ctx.restore();
}
function iconeWhatsApp(ctx, cx, cy, r) {
  ctx.save();
  ctx.fillStyle = "#25d366";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = r * 0.13;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.58, 0.9, Math.PI * 2.55);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.42, cy + r * 0.38);
  ctx.lineTo(cx - r * 0.62, cy + r * 0.68);
  ctx.lineTo(cx - r * 0.18, cy + r * 0.55);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.fillRect(cx - r * 0.22, cy - r * 0.2, r * 0.44, r * 0.4);
  ctx.restore();
}
function iconeSite(ctx, cx, cy, r, cor) {
  ctx.save();
  ctx.strokeStyle = cor;
  ctx.lineWidth = r * 0.12;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
  ctx.moveTo(cx - r * 0.85, cy);
  ctx.lineTo(cx + r * 0.85, cy);
  ctx.moveTo(cx, cy - r * 0.85);
  ctx.bezierCurveTo(cx + r * 0.55, cy - r * 0.4, cx + r * 0.55, cy + r * 0.4, cx, cy + r * 0.85);
  ctx.bezierCurveTo(cx - r * 0.55, cy + r * 0.4, cx - r * 0.55, cy - r * 0.4, cx, cy - r * 0.85);
  ctx.stroke();
  ctx.restore();
}
function iconeEmail(ctx, cx, cy, r, cor) {
  ctx.save();
  ctx.strokeStyle = cor;
  ctx.lineWidth = r * 0.12;
  ctx.strokeRect(cx - r * 0.85, cy - r * 0.55, r * 1.7, r * 1.1);
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.85, cy - r * 0.55);
  ctx.lineTo(cx, cy + r * 0.1);
  ctx.lineTo(cx + r * 0.85, cy - r * 0.55);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------
// tipografia publicitária
// ---------------------------------------------------------------
function medirAjustado(ctx, texto, larguraMax, tamanhoMax, fonte) {
  let t = tamanhoMax;
  ctx.font = fonte(t);
  const w = ctx.measureText(texto).width;
  if (w > larguraMax) t = (t * larguraMax) / w;
  ctx.font = fonte(t);
  return { tamanho: t, largura: ctx.measureText(texto).width };
}

// Título cromado 3D: extrusão, contorno luminoso e metal polido.
function tituloCromado(ctx, texto, x, y, t, cor, estilo = "cromo", escrever, intensidade = 1) {
  ctx.save();
  ctx.font = fTitulo(t);
  ctx.textBaseline = "alphabetic";
  const profundidade = Math.max(3, Math.round(t * 0.07));
  // sombra projetada
  ctx.shadowColor = "rgba(0,0,0,.7)";
  ctx.shadowBlur = t * 0.25;
  ctx.shadowOffsetY = t * 0.06;
  ctx.fillStyle = cor.profundo;
  ctx.fillText(texto, x + profundidade, y + profundidade);
  ctx.shadowColor = "transparent";
  // extrusão
  for (let i = profundidade; i > 0; i -= 1) {
    ctx.fillStyle = i === profundidade ? (cor.claro ? "#6b86b8" : "#010512") : estilo === "neon" ? cor.extrusao[1] : cor.extrusao[0];
    ctx.fillText(texto, x + i * 0.9, y + i);
  }
  // brilho externo
  ctx.lineJoin = "round";
  ctx.shadowColor = rgba(cor.brilho, 0.95 * intensidade);
  ctx.shadowBlur = t * 0.35 * intensidade;
  ctx.lineWidth = Math.max(2, t * 0.06 * (0.5 + intensidade / 2));
  ctx.strokeStyle = cor.claro ? "rgba(255,255,255,.95)" : estilo === "neon" ? cor.neon : "rgba(180,225,255,.9)";
  ctx.strokeText(texto, x, y);
  ctx.shadowColor = "transparent";
  // metal
  const g = ctx.createLinearGradient(0, y - t * 0.82, 0, y + t * 0.05);
  if (estilo === "cromo" && cor.claro) {
    // fundo claro: "tinta" azul-marinho metálica
    g.addColorStop(0, "#1e3a8a");
    g.addColorStop(0.5, "#0b1a3a");
    g.addColorStop(0.62, "#1d4ed8");
    g.addColorStop(1, "#0b1a3a");
  } else if (estilo === "cromo") {
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.4, "#eef5ff");
    g.addColorStop(0.52, "#b7cbe6");
    g.addColorStop(0.58, "#93acd0");
    g.addColorStop(0.66, "#e4effc");
    g.addColorStop(1, "#ffffff");
  } else if (estilo === "claro") {
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.55, "#f2f8ff");
    g.addColorStop(1, "#cfe3ff");
  } else {
    // "neon": cor de destaque da paleta, com faixa clara
    const n = cor.neonTitulo;
    g.addColorStop(0, n[0]);
    g.addColorStop(0.35, n[1]);
    g.addColorStop(0.6, n[2]);
    g.addColorStop(0.8, n[3]);
    g.addColorStop(1, n[4]);
  }
  ctx.fillStyle = g;
  if (escrever) escrever(texto, x, y);
  else ctx.fillText(texto, x, y);
  // fio interno escuro para nitidez
  ctx.lineWidth = Math.max(1, t * 0.012);
  ctx.strokeStyle = cor.claro ? "rgba(255,255,255,.5)" : "rgba(2,8,30,.55)";
  ctx.strokeText(texto, x, y);
  ctx.restore();
}

// Cenário programático (quando a IA estiver desligada ou indisponível):
// profundidade, raios, luz de fundo e piso — nunca um fundo chapado.
function cenarioProgramatico(ctx, L, A, cor, peca, rnd) {
  const g = ctx.createLinearGradient(0, 0, L * 0.4, A);
  g.addColorStop(0, cor.fundo[0]);
  g.addColorStop(0.55, cor.fundo[1]);
  g.addColorStop(1, cor.fundo[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, L, A);
  const cx = peca.x + peca.largura / 2;
  const cy = peca.y + peca.altura * 0.5;
  const R = Math.max(L, A);
  ctx.save();
  ctx.globalCompositeOperation = cor.claro ? "source-over" : "lighter";
  for (let i = 0; i < 26; i += 1) {
    const a = rnd() * Math.PI * 2;
    const w = 0.012 + rnd() * 0.03;
    const raio = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.8);
    raio.addColorStop(0, rgba(cor.brilho2, cor.claro ? 0.18 : 0.3));
    raio.addColorStop(1, rgba(cor.brilho, 0));
    ctx.fillStyle = raio;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, a, a + w);
    ctx.closePath();
    ctx.fill();
  }
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.45);
  halo.addColorStop(0, rgba(cor.brilho2, cor.claro ? 0.35 : 0.55));
  halo.addColorStop(1, rgba(cor.brilho, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, L, A);
  ctx.restore();
  // piso com reflexo
  const yPiso = peca.y + peca.altura;
  const piso = ctx.createLinearGradient(0, yPiso, 0, A);
  piso.addColorStop(0, cor.claro ? "rgba(255,255,255,.4)" : "rgba(0,0,0,.15)");
  piso.addColorStop(1, cor.claro ? "rgba(180,200,235,.6)" : "rgba(0,0,0,.65)");
  ctx.fillStyle = piso;
  ctx.fillRect(0, yPiso, L, A - yPiso);
}

// ---------------------------------------------------------------
// camadas de acabamento
// ---------------------------------------------------------------
function acabamentoCena(ctx, L, A, cor, zonas, tom, rnd) {
  const claro = cor.claro;
  const base = claro ? "255,255,255" : "1,4,16";
  // vinheta
  const v = ctx.createRadialGradient(L / 2, A * 0.45, Math.min(L, A) * 0.35, L / 2, A * 0.5, Math.max(L, A) * 0.78);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, claro ? "rgba(20,40,90,.22)" : "rgba(0,2,10,.62)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, L, A);

  // escurecimento suave nas áreas de texto (legibilidade sem "caixa")
  const escurecer = (z, forca) => {
    if (!z) return;
    const cx = z.x + z.largura / 2;
    const cy = z.y + z.altura / 2;
    const r = Math.max(z.largura, z.altura) * 0.7;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, z.altura / Math.max(z.largura, 1) + 0.35);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, `rgba(${base},${claro ? forca + 0.2 : forca})`);
    g.addColorStop(1, `rgba(${base},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  };
  escurecer(zonas.titulo, 0.45);
  escurecer(zonas.preco, 0.4);

  // faixa inferior de profundidade (rodapé)
  const rodape = ctx.createLinearGradient(0, A * 0.82, 0, A);
  rodape.addColorStop(0, "rgba(1,3,12,0)");
  rodape.addColorStop(1, claro ? "rgba(10,30,80,.35)" : "rgba(1,3,12,.78)");
  ctx.fillStyle = rodape;
  ctx.fillRect(0, A * 0.82, L, A * 0.18);

  // linhas de energia diagonais (bordas)
  ctx.save();
  ctx.globalCompositeOperation = claro ? "source-over" : "lighter";
  const qtd = tom === "impacto" ? 10 : tom === "tecnico" ? 8 : tom === "elegante" ? 5 : 4;
  for (let i = 0; i < qtd; i += 1) {
    const lado = i % 2 === 0 ? -1 : 1;
    const x0 = lado < 0 ? -L * 0.1 + rnd() * L * 0.25 : L * 0.85 + rnd() * L * 0.25;
    const y0 = A * (0.15 + rnd() * 0.7);
    const comp = L * (0.25 + rnd() * 0.35);
    const ang = (lado < 0 ? -1 : 1) * (0.35 + rnd() * 0.25) + Math.PI * (lado < 0 ? 0 : 1);
    const x1 = x0 + Math.cos(ang) * comp;
    const y1 = y0 + Math.sin(ang) * comp;
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, rgba(cor.brilho2, 0));
    g.addColorStop(0.5, rgba(cor.brilho2, 0.55));
    g.addColorStop(1, rgba(cor.brilho2, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.5 + rnd() * 3;
    ctx.shadowColor = rgba(cor.brilho2, 0.9);
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  // partículas
  const particulas = tom === "impacto" ? 80 : tom === "limpo" ? 25 : 50;
  for (let i = 0; i < particulas; i += 1) {
    const x = rnd() * L;
    const y = rnd() * A;
    const r = 0.8 + rnd() * 2.6;
    ctx.fillStyle = rnd() > 0.92 ? rgba(hexRgb(cor.complementar), 0.85) : rgba(cor.brilho2, 0.35 + rnd() * 0.5);
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = r * 4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // cantoneiras / molduras técnicas
  ctx.save();
  ctx.strokeStyle = rgba(cor.brilho2, 0.55);
  ctx.lineWidth = Math.max(2, L * 0.003);
  ctx.shadowColor = rgba(cor.brilho2, 0.8);
  ctx.shadowBlur = 10;
  const m = L * 0.028;
  const c = L * 0.09;
  [[m, m, 1, 1], [L - m, m, -1, 1], [m, A - m, 1, -1], [L - m, A - m, -1, -1]].forEach(([x, y, sx, sy]) => {
    ctx.beginPath();
    ctx.moveTo(x + sx * c, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + sy * c);
    ctx.stroke();
  });
  ctx.restore();
}

// Procura a faixa de luz horizontal (plataforma/anel no piso) na região da peça.
function localizarPlataforma(canvas, zona, A) {
  try {
    const W = 120;
    const H = Math.round((canvas.height / canvas.width) * W);
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const k = c.getContext("2d", { willReadFrequently: true });
    k.drawImage(canvas, 0, 0, W, H);
    const d = k.getImageData(0, 0, W, H).data;
    const e = H / A;
    const y0 = Math.max(1, Math.round((zona.y + zona.altura * 0.45) * e));
    const y1 = Math.min(H - 2, Math.round((zona.y + zona.altura + A * 0.08) * e));
    const xa = Math.round(W * 0.2);
    const xb = Math.round(W * 0.8);
    const linha = [];
    for (let y = 0; y < H; y += 1) {
      let soma = 0;
      for (let x = xa; x < xb; x += 1) {
        const i = (y * W + x) * 4;
        soma += 0.2 * d[i] + 0.5 * d[i + 1] + 0.3 * d[i + 2];
      }
      linha.push(soma / (xb - xa));
    }
    let melhor = -1;
    let yMelhor = -1;
    for (let y = y0; y <= y1; y += 1) {
      const vizinhos = (linha[Math.max(0, y - 6)] + linha[Math.min(H - 1, y + 6)]) / 2;
      const pico = linha[y] - vizinhos;
      if (linha[y] > 120 && pico > melhor) {
        melhor = pico;
        yMelhor = y;
      }
    }
    if (yMelhor < 0 || melhor < 18) return null;
    return { y: Math.round(yMelhor / e), forca: Math.round(melhor) };
  } catch {
    return null;
  }
}

function assentarNaPlataforma(peca, zona, plataforma, A) {
  const alvoBase = plataforma.y + A * 0.012;
  let { x, largura, altura } = peca;
  const topoMin = zona.y - A * 0.015;
  if (alvoBase - altura < topoMin) {
    const escala = (alvoBase - topoMin) / altura;
    // a peça é protagonista: não encolhe mais que 10% só para "sentar" na luz
    if (escala < 0.9) return peca;
    const nw = largura * escala;
    x += (largura - nw) / 2;
    largura = nw;
    altura *= escala;
  }
  const y = alvoBase - altura;
  if (y < topoMin - 2 || y + altura > zona.y + zona.altura + A * 0.025) return peca;
  return { x: Math.round(x), y: Math.round(y), largura: Math.round(largura), altura: Math.round(altura) };
}

function baseDaPeca(ctx, peca, cor, layout, plataforma, plataformaIA = null) {
  const cx = peca.x + peca.largura / 2;
  const base = peca.y + peca.altura;
  if (plataformaIA) {
    // reforça a luz do piso da IA exatamente sob a peça
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const rx0 = peca.largura * 0.7;
    const g0 = ctx.createRadialGradient(cx, plataformaIA.y, 0, cx, plataformaIA.y, rx0);
    g0.addColorStop(0, rgba(cor.brilho2, 0.45));
    g0.addColorStop(1, rgba(cor.brilho, 0));
    ctx.fillStyle = g0;
    ctx.beginPath();
    ctx.ellipse(cx, plataformaIA.y, rx0, rx0 * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const rx = peca.largura * 0.62;
  const ry = Math.max(14, peca.altura * 0.075);

  // halo de contraluz atrás da peça
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const cy = peca.y + peca.altura * 0.48;
  const rh = Math.max(peca.largura, peca.altura) * 0.72;
  const halo = ctx.createRadialGradient(cx, cy, rh * 0.05, cx, cy, rh);
  halo.addColorStop(0, rgba(cor.brilho2, 0.55));
  halo.addColorStop(0.35, rgba(cor.brilho, 0.3));
  halo.addColorStop(1, rgba(cor.brilho, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(cx - rh, cy - rh, rh * 2, rh * 2);
  ctx.restore();

  if (!plataforma) return { cx, base, rx, ry };

  ctx.save();
  if (layout === "central") {
    // plataforma hexagonal tecnológica
    ctx.translate(cx, base + ry * 0.2);
    ctx.scale(1, 0.28);
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i += 1) {
      hexagono(ctx, 0, 0, rx * (1.05 + i * 0.22));
      ctx.strokeStyle = rgba(cor.brilho2, 0.8 - i * 0.22);
      ctx.lineWidth = 6 - i * 1.5;
      ctx.shadowColor = rgba(cor.brilho2, 1);
      ctx.shadowBlur = 25;
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, rgba(cor.brilho2, 0.5));
    g.addColorStop(1, rgba(cor.brilho, 0));
    ctx.fillStyle = g;
    hexagono(ctx, 0, 0, rx * 1.05);
    ctx.fill();
  } else {
    // disco de luz com anéis
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.ellipse(cx, base + ry * 0.15, rx * (0.95 + i * 0.25), ry * (1 + i * 0.3), 0, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(i === 0 ? [235, 250, 255] : cor.brilho2, 0.9 - i * 0.28);
      ctx.lineWidth = i === 0 ? 5 : 3;
      ctx.shadowColor = rgba(cor.brilho2, 1);
      ctx.shadowBlur = 30;
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(cx, base, 0, cx, base, rx);
    g.addColorStop(0, rgba(cor.brilho2, 0.55));
    g.addColorStop(1, rgba(cor.brilho, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, base + ry * 0.15, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  return { cx, base, rx, ry };
}

function sombraEReflexo(ctx, imagem, peca, base) {
  // sombra de contato
  ctx.save();
  const s = ctx.createRadialGradient(base.cx, base.base, 0, base.cx, base.base, base.rx * 0.7);
  s.addColorStop(0, "rgba(0,0,0,.5)");
  s.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = s;
  ctx.beginPath();
  ctx.ellipse(base.cx, base.base, base.rx * 0.7, base.ry * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // reflexo no piso (a própria foto, espelhada e esmaecida)
  const h = peca.altura * 0.32;
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(peca.largura));
  c.height = Math.max(1, Math.round(h));
  const k = c.getContext("2d");
  k.translate(0, peca.altura);
  k.scale(1, -1);
  k.drawImage(imagem, 0, 0, peca.largura, peca.altura);
  k.setTransform(1, 0, 0, 1, 0, 0);
  k.globalCompositeOperation = "destination-in";
  const f = k.createLinearGradient(0, 0, 0, h);
  f.addColorStop(0, "rgba(0,0,0,.32)");
  f.addColorStop(1, "rgba(0,0,0,0)");
  k.fillStyle = f;
  k.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(c, peca.x, peca.y + peca.altura + 2);
}

// ---------------------------------------------------------------
// montagem
// ---------------------------------------------------------------
export async function montarBannerDiretorArte({
  largura,
  altura,
  paletaId = "azul",
  produto, // canvas/imagem da foto real (fundo removido)
  cenarioIA = null,
  decisao, // decidirDirecaoDeArte()
  comerciais = {}, // { preco, codigo, whatsapp, site, email, nomeLoja }
  diferenciais = [], // ids marcados pelo usuário
  logoImagem = null,
}) {
  await carregarFontesBanner();
  const L = largura;
  const A = altura;
  const cor = sistemaDeCor(paletaId);
  const rnd = sorteio((decisao?.semente || 0) + 7);
  const pw = produto.naturalWidth || produto.width;
  const ph = produto.naturalHeight || produto.height;
  const plano = planejarDiretor({ largura: L, altura: A, proporcaoProduto: pw / Math.max(1, ph), decisao, diferenciais });
  const { selos } = plano;
  const Z = plano.zonas;
  const centro = plano.alinhamento === "center";
  const direita = plano.alinhamento === "right";
  const alinhar = (z, w) => (centro ? z.x + (z.largura - w) / 2 : direita ? z.x + z.largura - w : z.x);
  const elegante = decisao.tom === "elegante";

  const canvas = document.createElement("canvas");
  canvas.width = L;
  canvas.height = A;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const registro = { textos: [], layout: decisao.layout, direcao: decisao.direcaoId, elementos: [] };
  const escrever = (texto, x, y) => {
    ctx.fillText(String(texto), x, y);
    registro.textos.push(String(texto));
  };

  // 1) fundo
  if (cenarioIA) {
    const e = Math.max(L / cenarioIA.width, A / cenarioIA.height);
    ctx.drawImage(cenarioIA, (L - cenarioIA.width * e) / 2, (A - cenarioIA.height * e) / 2, cenarioIA.width * e, cenarioIA.height * e);
  } else {
    cenarioProgramatico(ctx, L, A, cor, plano.peca, rnd);
  }

  // 2) acabamento gráfico
  acabamentoCena(ctx, L, A, cor, Z, decisao.tom, rnd);

  // 3-4) peça protagonista
  let peca = plano.peca;
  // Assenta a peça na plataforma/luz de piso que a IA desenhou (se houver).
  const plataformaIA = cenarioIA ? localizarPlataforma(canvas, Z.produto, A) : null;
  if (plataformaIA) peca = assentarNaPlataforma(peca, Z.produto, plataformaIA, A);
  registro.produtoRect = peca;
  registro.plataformaIA = plataformaIA;
  const base = baseDaPeca(ctx, peca, cor, decisao.layout, decisao.direcao?.plataforma !== false && !plataformaIA, plataformaIA);
  sombraEReflexo(ctx, produto, peca, base);
  ctx.drawImage(produto, peca.x, peca.y, peca.largura, peca.altura);

  // 5a) kicker (premium)
  if (Z.kicker && decisao.kicker) {
    const t = Z.kicker.altura * 0.9;
    ctx.font = fApoio(t);
    ctx.textBaseline = "middle";
    ctx.fillStyle = cor.neon;
    const x = Z.kicker.x;
    ctx.fillRect(x, Z.kicker.y + Z.kicker.altura / 2 - 2, t * 1.6, 4);
    ctx.fillStyle = cor.claro ? cor.profundo : "#ffffff";
    escrever(decisao.kicker.split("").join(String.fromCharCode(8202)), x + t * 2.1, Z.kicker.y + Z.kicker.altura / 2);
  }

  // 5b) título em duas linhas: cromo + neon
  if (Z.titulo && decisao.titulo?.length) {
    const linhas = decisao.titulo.slice(0, 2);
    const z = Z.titulo;
    const alturaLinha = linhas.length > 1 ? z.altura / 1.95 : z.altura * 0.9;
    const tamanhos = linhas.map((linha, i) => {
      const max = i === 0 ? alturaLinha * 1.08 : alturaLinha * (linha.length > 10 ? 0.62 : 0.92);
      return medirAjustado(ctx, linha, z.largura * 0.94, max, fTitulo);
    });
    let y = z.y + tamanhos[0].tamanho * 0.86;
    ctx.save();
    // inclinação de energia
    const skew = decisao.layout === "editorial" ? -0.05 : -0.1;
    linhas.forEach((linha, i) => {
      const { tamanho, largura: w } = tamanhos[i];
      const x = alinhar(z, w);
      ctx.setTransform(1, 0, skew, 1, -skew * y, 0);
      tituloCromado(ctx, linha, x, y, tamanho, cor, i === 0 || elegante ? "cromo" : "neon", escrever, elegante ? 0.45 : 1);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (i === 0 && linhas[1]) y += tamanhos[1].tamanho * 0.98 + tamanho * 0.06;
    });
    ctx.restore();
    // traço de luz sob o título
    const yLuz = Math.min(z.y + z.altura, y + tamanhos[tamanhos.length - 1].tamanho * 0.2);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const lx0 = centro ? z.x + z.largura * 0.12 : direita ? z.x + z.largura * 0.25 : z.x;
    const lx1 = centro ? z.x + z.largura * 0.88 : direita ? z.x + z.largura : z.x + z.largura * 0.75;
    const gl = ctx.createLinearGradient(lx0, 0, lx1, 0);
    gl.addColorStop(0, rgba(cor.brilho2, 0));
    gl.addColorStop(0.5, "rgba(230,250,255,1)");
    gl.addColorStop(1, rgba(cor.brilho2, 0));
    ctx.strokeStyle = gl;
    ctx.lineWidth = 3;
    ctx.shadowColor = rgba(cor.brilho2, 1);
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(lx0, yLuz);
    ctx.lineTo(lx1, yLuz);
    ctx.stroke();
    ctx.restore();
  }

  // 5c) faixa de apoio
  if (Z.apoio && decisao.apoio && elegante) {
    const z = Z.apoio;
    const texto = decisao.apoio.toUpperCase();
    const { tamanho: t, largura: w } = medirAjustado(ctx, texto, z.largura * 0.8, z.altura * 0.7, fApoio);
    const x = alinhar(z, w);
    ctx.font = fApoio(t);
    ctx.fillStyle = cor.claro ? cor.profundo : "#dbeafe";
    ctx.textBaseline = "middle";
    escrever(texto, x, z.y + z.altura / 2);
    ctx.save();
    const g = ctx.createLinearGradient(x, 0, x + w * 1.1, 0);
    g.addColorStop(0, cor.neon);
    g.addColorStop(1, rgba(cor.brilho2, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x, z.y + z.altura + 6, w * 1.1, 2);
    ctx.restore();
  } else if (Z.apoio && decisao.apoio) {
    const z = Z.apoio;
    const texto = decisao.apoio.toUpperCase();
    const { tamanho: t, largura: w } = medirAjustado(ctx, texto, z.largura * 0.86, z.altura * 0.62, fApoio);
    const bw = w + t * 2.2;
    const bh = z.altura;
    const x = alinhar(z, bw);
    ctx.save();
    const g = ctx.createLinearGradient(x, 0, x + bw, 0);
    g.addColorStop(0, cor.painel[1]);
    g.addColorStop(0.5, cor.faixa);
    g.addColorStop(1, cor.painel[1]);
    ctx.fillStyle = g;
    ctx.strokeStyle = cor.neon;
    ctx.lineWidth = 2;
    ctx.shadowColor = rgba(cor.brilho2, 0.9);
    ctx.shadowBlur = 16;
    inclinado(ctx, x, z.y, bw, bh, bh * 0.35);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.font = fApoio(t);
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    escrever(texto, x + bw / 2, z.y + bh / 2);
    ctx.textAlign = "left";
  }

  // 5d) selos (somente os marcados pelo usuário)
  if (Z.selos && selos.length) {
    const z = Z.selos;
    const emColuna = z.altura > z.largura;
    const n = selos.length;
    selos.forEach((id, i) => {
      const d = DIFERENCIAIS[id];
      const cw = emColuna ? z.largura : (z.largura - (n - 1) * z.largura * 0.03) / n;
      const ch = emColuna ? Math.min(z.altura / n - z.altura * 0.04, z.largura * 0.95) : z.altura;
      const x = emColuna ? z.x : z.x + i * (cw + z.largura * 0.03);
      const y = emColuna ? z.y + i * (ch + z.altura * 0.04) : z.y;
      ctx.save();
      ctx.fillStyle = cor.painel[1];
      ctx.strokeStyle = rgba(cor.brilho2, 0.9);
      ctx.lineWidth = 2;
      ctx.shadowColor = rgba(cor.brilho2, 0.7);
      ctx.shadowBlur = 14;
      if (emColuna) {
        inclinado(ctx, x, y, cw, ch, ch * 0.12);
      } else {
        inclinado(ctx, x, y, cw, ch, ch * 0.3);
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      const r = emColuna ? Math.min(cw, ch) * 0.2 : ch * 0.3;
      if (emColuna) {
        icone(ctx, d.icone, x + cw / 2, y + ch * 0.33, r, cor.neon);
        const t = medirAjustado(ctx, d.texto[1], cw * 0.8, ch * 0.16, fTitulo).tamanho;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = fTitulo(t);
        ctx.fillStyle = "#ffffff";
        escrever(d.texto[0], x + cw / 2, y + ch * 0.66);
        ctx.fillStyle = cor.neon;
        escrever(d.texto[1], x + cw / 2, y + ch * 0.66 + t * 1.02);
        ctx.textAlign = "left";
      } else {
        icone(ctx, d.icone, x + ch * 0.5, y + ch / 2, r, cor.neon);
        const t = medirAjustado(ctx, d.texto[1], cw - ch * 1.1, ch * 0.3, fTitulo).tamanho;
        ctx.textBaseline = "middle";
        ctx.font = fTitulo(t);
        ctx.fillStyle = "#ffffff";
        escrever(d.texto[0], x + ch * 0.95, y + ch * 0.36);
        ctx.fillStyle = cor.neon;
        escrever(d.texto[1], x + ch * 0.95, y + ch * 0.36 + t * 1.02);
      }
      registro.elementos.push(`selo:${id}`);
    });
  }

  // 5e) preço (somente o valor digitado)
  const partes = comerciais.preco ? partesPreco(comerciais.preco) : null;
  if (Z.preco && (partes || comerciais.codigo)) {
    const z = Z.preco;
    const temCodigo = Boolean(comerciais.codigo);
    const hPainel = partes ? z.altura * (temCodigo ? 0.8 : 0.92) : 0;
    const ti = hPainel * 0.8;
    let yCod = z.y;
    if (partes) {
      ctx.font = fTitulo(ti);
      const wi = ctx.measureText(partes.inteiro).width;
      ctx.font = fTitulo(ti * 0.42);
      const ws = partes.simbolo ? ctx.measureText(`${partes.simbolo} `).width : 0;
      const wc = partes.centavos ? ctx.measureText(partes.centavos).width : 0;
      let escala = 1;
      const wTotal = ws + wi + wc + ti * 0.9;
      if (wTotal > z.largura) escala = z.largura / wTotal;
      const t = ti * escala;
      const W = wTotal * escala;
      const x = alinhar(z, W);
      const y = z.y + (hPainel - hPainel * escala) / 2;
      const H = hPainel * escala;
      // painel de vidro com neon
      ctx.save();
      const gp = ctx.createLinearGradient(0, y, 0, y + H);
      gp.addColorStop(0, cor.painel[0]);
      gp.addColorStop(1, cor.painel[1]);
      ctx.fillStyle = gp;
      ctx.shadowColor = rgba(cor.brilho, 0.9);
      ctx.shadowBlur = t * 0.3;
      inclinado(ctx, x, y, W, H, H * 0.22);
      ctx.fill();
      ctx.shadowBlur = t * 0.15;
      ctx.lineWidth = Math.max(3, t * 0.035);
      const gb = ctx.createLinearGradient(x, 0, x + W, 0);
      gb.addColorStop(0, cor.neon);
      gb.addColorStop(0.5, "#ffffff");
      gb.addColorStop(1, cor.eletrico);
      ctx.strokeStyle = gb;
      ctx.stroke();
      ctx.restore();
      // etiqueta
      const rotulo = decisao.rotuloPreco || "POR APENAS";
      const tr = t * 0.17;
      ctx.font = fTitulo(tr);
      const wr = ctx.measureText(rotulo).width + tr * 1.4;
      const hr = tr * 1.6;
      ctx.save();
      ctx.fillStyle = decisao.tom === "impacto" ? cor.complementar : cor.neon;
      inclinado(ctx, x + H * 0.3, y - hr * 0.55, wr, hr, hr * 0.3);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#020617";
      ctx.textBaseline = "middle";
      escrever(rotulo, x + H * 0.3 + tr * 0.7, y - hr * 0.55 + hr / 2);
      // valor
      const yb = y + H * 0.56;
      let xv = x + H * 0.32;
      if (partes.simbolo) {
        ctx.font = fTitulo(t * 0.42);
        ctx.fillStyle = cor.neon;
        ctx.textBaseline = "middle";
        escrever(partes.simbolo, xv, yb - t * 0.16);
        xv += ws * escala;
      }
      ctx.textBaseline = "alphabetic";
      // o preço fica sempre sobre painel escuro: acabamento de fundo escuro
      const corPreco = cor.claro ? { ...cor, claro: false, extrusao: ["#0b2b6e", "#07245e"] } : cor;
      tituloCromado(ctx, partes.inteiro, xv, yb + t * 0.36, t, corPreco, "claro", escrever);
      ctx.font = fTitulo(t);
      xv += ctx.measureText(partes.inteiro).width;
      if (partes.centavos) {
        ctx.font = fTitulo(t * 0.42);
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#ffffff";
        escrever(partes.centavos, xv + t * 0.04, yb - t * 0.18);
      }
      yCod = y + H + z.altura * 0.04;
      registro.elementos.push("preco");
    }
    if (temCodigo) {
      const texto = `CÓD. ${comerciais.codigo}`;
      const t = Math.max(22, (partes ? z.altura * 0.14 : z.altura * 0.3));
      ctx.font = fTexto(t);
      const w = ctx.measureText(texto).width + t * 1.4;
      const h = t * 1.6;
      const x = centro || direita ? alinhar(z, w) : z.x + (partes ? z.altura * 0.1 : 0);
      ctx.save();
      ctx.fillStyle = cor.claro ? cor.painel[1] : "rgba(255,255,255,.1)";
      ctx.strokeStyle = rgba(cor.brilho2, 0.8);
      ctx.lineWidth = 2;
      arredondado(ctx, x, yCod, w, h, h / 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "middle";
      escrever(texto, x + t * 0.7, yCod + h / 2);
      registro.elementos.push("codigo");
    }
  }

  // 5f) CTA
  if (Z.cta && decisao.cta) {
    const z = Z.cta;
    const texto = decisao.cta.toUpperCase();
    const tIdeal = z.altura * 0.5;
    ctx.font = fTitulo(tIdeal);
    const wIdeal = ctx.measureText(texto).width;
    const comSetas = !elegante && z.largura - z.altura * 2.3 >= wIdeal * 0.85;
    const folga = comSetas ? z.altura * 2.3 : z.altura * 0.8;
    const { tamanho: t, largura: w } = medirAjustado(ctx, texto, z.largura - folga, tIdeal, fTitulo);
    const bw = Math.min(z.largura, w + folga);
    const x = z.x + (z.largura - bw) / 2;
    ctx.save();
    if (elegante) {
      ctx.fillStyle = cor.painel[1];
      ctx.shadowColor = rgba(cor.brilho2, 0.8);
      ctx.shadowBlur = z.altura * 0.4;
      arredondado(ctx, x, z.y, bw, z.altura, z.altura / 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      const gb = ctx.createLinearGradient(x, 0, x + bw, 0);
      gb.addColorStop(0, cor.neon);
      gb.addColorStop(0.5, "#ffffff");
      gb.addColorStop(1, cor.neon);
      ctx.strokeStyle = gb;
      ctx.lineWidth = 3;
      ctx.stroke();
    } else {
      const g = ctx.createLinearGradient(x, 0, x + bw, 0);
      g.addColorStop(0, cor.eletrico);
      g.addColorStop(0.55, cor.neon);
      g.addColorStop(1, cor.eletrico);
      ctx.fillStyle = g;
      ctx.shadowColor = rgba(cor.brilho2, 0.95);
      ctx.shadowBlur = z.altura * 0.6;
      inclinado(ctx, x, z.y, bw, z.altura, z.altura * 0.35);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,.85)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
    if (comSetas) {
      chevrons(ctx, x + z.altura * 0.45, z.y + z.altura * 0.26, z.altura * 0.48, 2, "#ffffff", 1);
      chevrons(ctx, x + bw - z.altura * 0.45, z.y + z.altura * 0.26, z.altura * 0.48, 2, "#ffffff", -1);
    }
    ctx.font = fTitulo(t);
    ctx.fillStyle = elegante ? "#ffffff" : "#020617";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    escrever(texto, x + bw / 2, z.y + z.altura / 2 + t * 0.04);
    ctx.textAlign = "left";
  }

  // 5g) contatos (somente dados reais)
  const contatos = [];
  if (comerciais.whatsapp) contatos.push({ tipo: "whatsapp", texto: comerciais.whatsapp });
  if (comerciais.site) contatos.push({ tipo: "site", texto: comerciais.site });
  if (comerciais.email) contatos.push({ tipo: "email", texto: comerciais.email });
  if (Z.contato && contatos.length) {
    const z = Z.contato;
    ctx.save();
    ctx.fillStyle = cor.painel[1];
    ctx.strokeStyle = rgba(cor.brilho2, 0.7);
    ctx.lineWidth = 2;
    ctx.shadowColor = rgba(cor.brilho2, 0.6);
    ctx.shadowBlur = 12;
    arredondado(ctx, z.x, z.y, z.largura, z.altura, z.altura * 0.3);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    const larguraItem = z.largura / contatos.length;
    contatos.forEach((item, i) => {
      const r = z.altura * 0.28;
      const { tamanho: t, largura: wt } = medirAjustado(ctx, item.texto, larguraItem - r * 3.2, z.altura * 0.4, fTexto);
      const total = r * 2 + t * 0.45 + wt;
      const x0 = z.x + larguraItem * i + (larguraItem - total) / 2;
      const cy = z.y + z.altura / 2;
      if (item.tipo === "whatsapp") iconeWhatsApp(ctx, x0 + r, cy, r);
      else if (item.tipo === "site") iconeSite(ctx, x0 + r, cy, r, cor.neon);
      else iconeEmail(ctx, x0 + r, cy, r, cor.neon);
      ctx.font = fTexto(t);
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "middle";
      escrever(item.texto, x0 + r * 2 + t * 0.45, cy);
      registro.elementos.push(item.tipo);
    });
  }

  // 6) logo — arquivo original, sem nenhum efeito sobre ele
  if (Z.logo && (logoImagem || comerciais.nomeLoja)) {
    const z = Z.logo;
    if (logoImagem) {
      const lw = logoImagem.naturalWidth || logoImagem.width;
      const lh = logoImagem.naturalHeight || logoImagem.height;
      const e = Math.min(z.largura / lw, z.altura / lh);
      const w = lw * e;
      const h = lh * e;
      const x = alinhar(z, w);
      const y = z.y + (z.altura - h) / 2;
      // luz de apoio atrás (não toca no logo)
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, Math.max(w, h) * 0.9);
      g.addColorStop(0, rgba(cor.brilho2, 0.35));
      g.addColorStop(1, rgba(cor.brilho2, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - w, y - h, w * 3, h * 3);
      ctx.restore();
      ctx.drawImage(logoImagem, x, y, w, h);
      registro.elementos.push("logo");
      registro.logoRect = { x, y, largura: w, altura: h };
    } else {
      const { tamanho: t } = medirAjustado(ctx, comerciais.nomeLoja.toUpperCase(), z.largura, z.altura * 0.6, fTitulo);
      ctx.font = fTitulo(t);
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "middle";
      ctx.fillStyle = cor.claro ? cor.profundo : "#ffffff";
      ctx.textAlign = centro ? "center" : direita ? "right" : "left";
      escrever(comerciais.nomeLoja.toUpperCase(), centro ? z.x + z.largura / 2 : direita ? z.x + z.largura : z.x, z.y + z.altura / 2);
      ctx.textAlign = "left";
      registro.elementos.push("nomeLoja");
    }
  }

  return { dataUrl: canvas.toDataURL("image/png"), registro };
}
