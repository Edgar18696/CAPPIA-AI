// Banner Express — DIRETOR DE ARTE AUTOMOTIVO (regras puras, sem navegador).
//
// O usuário escolhe: FORMATO, ESTILO e COR/FUNDO (+ foto, logo e dados
// comerciais). A partir disso o PAIIA decide sozinho: cenário, composição,
// posição e escala da peça, luz, elementos gráficos e hierarquia dos textos.
//
// Regras fixas:
// - A cor escolhida é um SISTEMA de cores (tons, luz, contraste), nunca um
//   fundo chapado.
// - A peça é a protagonista e a foto real é colada intacta (a IA nunca
//   desenha a peça).
// - Preço, código, WhatsApp, site e logo vêm SOMENTE do usuário.
// - Mercado Livre 1200x1200 NÃO usa este motor (regras próprias).

import { mapearParaQuadroIA, numeroAleatorio } from "./composicaoBanner.js";
import { DIRECOES_PROMPT } from "./promptDiretorArte.js";

export { montarPromptDiretorArte } from "./promptDiretorArte.js";

// ---------------------------------------------------------------
// Cor escolhida -> cores usadas na montagem (textos, painéis, luz)
// ---------------------------------------------------------------
export const SISTEMAS_DE_COR = {
  azul: {
    fundo: ["#01040f", "#041233", "#0a2a78"],
    profundo: "#020a24",
    eletrico: "#2f6bff",
    neon: "#22d3ee",
    complementar: "#fbbf24",
    brilho: [56, 170, 255],
    brilho2: [34, 211, 238],
    painel: ["rgba(10,32,96,.92)", "rgba(2,8,28,.95)"],
    faixa: "rgba(10,40,120,.92)",
    extrusao: ["#0b2b6e", "#07245e"],
    neonTitulo: ["#f0fdff", "#7ee8fb", "#22d3ee", "#3b82f6", "#67e8f9"],
    claro: false,
  },
  vermelho: {
    fundo: ["#0b0203", "#3a0710", "#8a1010"],
    profundo: "#1a0306",
    eletrico: "#ef4444",
    neon: "#fbbf24",
    complementar: "#fde047",
    brilho: [255, 70, 40],
    brilho2: [253, 186, 60],
    painel: ["rgba(110,12,18,.92)", "rgba(24,3,6,.95)"],
    faixa: "rgba(120,14,20,.92)",
    extrusao: ["#5a0a10", "#3d0509"],
    neonTitulo: ["#fffbe6", "#fde68a", "#fbbf24", "#f97316", "#fde047"],
    claro: false,
  },
  escuro: {
    fundo: ["#020308", "#0b1020", "#1b1542"],
    profundo: "#05060d",
    eletrico: "#8b5cf6",
    neon: "#22d3ee",
    complementar: "#a855f7",
    brilho: [139, 92, 246],
    brilho2: [34, 211, 238],
    painel: ["rgba(30,27,75,.92)", "rgba(5,6,16,.95)"],
    faixa: "rgba(40,30,100,.92)",
    extrusao: ["#221a55", "#161036"],
    neonTitulo: ["#f0fdff", "#a5f3fc", "#22d3ee", "#8b5cf6", "#67e8f9"],
    claro: false,
  },
  clean: {
    fundo: ["#ffffff", "#e8f1ff", "#bcd5f7"],
    profundo: "#0b1a3a",
    eletrico: "#1d4ed8",
    neon: "#0891b2",
    complementar: "#f59e0b",
    brilho: [59, 130, 246],
    brilho2: [14, 165, 233],
    painel: ["rgba(15,40,110,.95)", "rgba(8,20,58,.97)"],
    faixa: "rgba(15,40,110,.94)",
    extrusao: ["#9fb7e0", "#c7d7f0"],
    neonTitulo: ["#1e40af", "#1d4ed8", "#0369a1", "#0e7490", "#1d4ed8"],
    claro: true,
  },
};

export function sistemaDeCor(paleta) {
  return SISTEMAS_DE_COR[paleta] || SISTEMAS_DE_COR.azul;
}

export const DIRECOES = Object.fromEntries(
  Object.entries(DIRECOES_PROMPT).map(([id, d]) => [id, { id, plataforma: d.plataforma }])
);

// ---------------------------------------------------------------
// Estilos: identidade própria (cenários, composições e textos)
// Os textos são chamadas genéricas — nunca prometem prazo, garantia,
// desconto ou aplicação. Dados comerciais só do usuário.
// ---------------------------------------------------------------
export const OBJETIVOS_DIRETOR = {
  promocao: {
    direcoes: ["explosao-energia", "velocidade", "arena-neon"],
    layouts: ["impacto", "diagonal", "central"],
    titulos: [["OFERTA", "ESPECIAL"], ["SUPER", "OFERTA"], ["PREÇO", "ESPECIAL"]],
    apoios: ["APROVEITE ESTA CONDIÇÃO!", "CONDIÇÃO IMPERDÍVEL", "APROVEITE ENQUANTO DURAR"],
    ctas: ["APROVEITE AGORA", "GARANTA JÁ O SEU", "COMPRE AGORA"],
    rotuloPreco: "POR APENAS",
    tom: "impacto",
  },
  produto: {
    direcoes: ["arena-neon", "oficina-premium", "cristal-metal"],
    layouts: ["central", "editorial", "impacto"],
    titulos: [["PRODUTO", "EM DESTAQUE"], ["DESTAQUE", "DA SEMANA"], ["CONFIRA", "ESTE PRODUTO"]],
    apoios: ["QUALIDADE PARA O SEU CARRO", "CONSULTE A APLICAÇÃO ANTES DA COMPRA"],
    ctas: ["CONSULTE AGORA", "FALE COM A GENTE"],
    rotuloPreco: "POR APENAS",
    tom: "limpo",
  },
  premium: {
    direcoes: ["estudio-luxo", "cristal-metal", "tecnologia-hud"],
    layouts: ["editorial", "central", "impacto"],
    kicker: "LINHA PREMIUM",
    titulos: [["ALTA", "PERFORMANCE"], ["PRECISÃO", "EM CADA DETALHE"], ["PADRÃO", "PREMIUM"]],
    apoios: ["DESEMPENHO E CONFIANÇA PARA O SEU MOTOR", "ACABAMENTO DE ALTO NÍVEL", "FEITO PARA QUEM EXIGE O MELHOR"],
    ctas: ["FALE COM A GENTE", "GARANTA O SEU", "CONSULTE AGORA"],
    rotuloPreco: "POR APENAS",
    tom: "elegante",
  },
  prontaEntrega: {
    direcoes: ["velocidade", "arena-neon", "explosao-energia"],
    layouts: ["diagonal", "impacto", "editorial"],
    titulos: [["PRONTA", "ENTREGA"], ["DISPONÍVEL", "PARA ENVIO"], ["PRONTA", "ENTREGA JÁ"]],
    apoios: ["PRODUTO DISPONÍVEL PARA ENVIO", "PEÇA JÁ A SUA", "DISPONÍVEL AGORA"],
    ctas: ["PEÇA AGORA", "FALE COM A GENTE", "GARANTA O SEU"],
    rotuloPreco: "POR APENAS",
    tom: "impacto",
  },
  comunicado: {
    direcoes: ["comunicado-limpo", "estudio-luxo", "oficina-premium"],
    layouts: ["central", "editorial"],
    titulos: [["COMUNICADO"], ["INFORMAÇÃO", "IMPORTANTE"], ["AVISO", "AOS CLIENTES"]],
    apoios: ["INFORMAÇÃO IMPORTANTE PARA NOSSOS CLIENTES", "FIQUE POR DENTRO"],
    ctas: ["SAIBA MAIS", "FALE COM A GENTE"],
    rotuloPreco: "POR APENAS",
    tom: "limpo",
  },
  qualidade: {
    direcoes: ["tecnologia-hud", "escudo-confianca", "oficina-premium"],
    layouts: ["central", "editorial", "impacto"],
    titulos: [["QUALIDADE", "E CONFIANÇA"], ["QUALIDADE", "QUE SEU CARRO MERECE"], ["CONFIANÇA", "EM CADA PEÇA"]],
    apoios: ["QUALIDADE E CONFIANÇA PARA O SEU CARRO", "PARA O SEU CARRO RODAR TRANQUILO", "ESCOLHA CERTA PARA O SEU MOTOR"],
    ctas: ["CONSULTE AGORA", "FALE COM A GENTE", "PEÇA JÁ A SUA"],
    rotuloPreco: "POR APENAS",
    tom: "tecnico",
  },
};

// Estilo escolhido no Banner Express -> estilo do diretor
export function objetivoDoDiretor(estilo = "", objetivo = "") {
  const valor = String(estilo || objetivo || "").toLowerCase();
  if (/oferta|promo/.test(valor)) return "promocao";
  if (/premium/.test(valor)) return "premium";
  if (/estoque|pronta|entrega/.test(valor)) return "prontaEntrega";
  if (/institucional|comunicado|horario/.test(valor)) return "comunicado";
  if (/qualidade|confian/.test(valor)) return "qualidade";
  return "produto";
}

// Diferenciais que o USUÁRIO marca (nunca inventados pela IA).
export const DIFERENCIAIS = {
  prontaEntrega: { nome: "Pronta entrega", texto: ["PRONTA", "ENTREGA"], icone: "caixa" },
  envioRapido: { nome: "Envio rápido", texto: ["ENVIO", "RÁPIDO"], icone: "caminhao" },
  estoque: { nome: "Estoque disponível", texto: ["ESTOQUE", "DISPONÍVEL"], icone: "check" },
  garantia: { nome: "Com garantia", texto: ["COM", "GARANTIA"], icone: "selo" },
};

function sortear(lista, semente) {
  if (!lista?.length) return undefined;
  return lista[Math.floor(numeroAleatorio(semente) * lista.length) % lista.length];
}

// "QUALIDADE QUE SEU CARRO MERECE" -> ["QUALIDADE", "QUE SEU CARRO MERECE"]
export function dividirTitulo(texto) {
  const palavras = String(texto || "").toUpperCase().trim().split(/\s+/).filter(Boolean);
  if (palavras.length <= 1) return [palavras[0] || ""];
  if (palavras.length === 2) return palavras;
  const primeira = palavras[0].length >= 6 ? 1 : 2;
  return [palavras.slice(0, primeira).join(" "), palavras.slice(primeira).join(" ")];
}

// Decide a direção de arte desta geração ("Gerar novamente" -> nova direção).
export function decidirDirecaoDeArte({ objetivo = "produto", variacao = 0, titulo = "", apoio = "", cta = "" } = {}) {
  const obj = OBJETIVOS_DIRETOR[objetivo] || OBJETIVOS_DIRETOR.produto;
  const v = Math.abs(Math.floor(Number(variacao) || 0));
  const direcaoId = obj.direcoes[v % obj.direcoes.length];
  // layout e cenário mudam em ritmos diferentes -> muitas combinações
  const layout = obj.layouts[(v + Math.floor(v / obj.direcoes.length)) % obj.layouts.length];
  const tituloUsuario = String(titulo || "").trim();
  return {
    objetivo,
    direcaoId,
    direcao: DIRECOES[direcaoId],
    layout,
    espelhar: numeroAleatorio(v * 29 + 11) > 0.5,
    tom: obj.tom,
    kicker: obj.kicker || "",
    titulo: tituloUsuario ? dividirTitulo(tituloUsuario) : sortear(obj.titulos, v * 13 + 1),
    apoio: String(apoio || "").trim() || sortear(obj.apoios, v * 17 + 2),
    cta: String(cta || "").trim() || sortear(obj.ctas, v * 19 + 3),
    rotuloPreco: obj.rotuloPreco,
    luz: sortear(["from the upper left", "from the upper right", "from directly behind", "from above"], v * 23 + 4),
    semente: v,
  };
}

// ---------------------------------------------------------------
// Layouts (frações do quadro). A peça sempre ocupa a maior área.
// ---------------------------------------------------------------
function R(x, y, largura, altura) {
  return { x, y, largura, altura };
}
function espelharZona(z) {
  return z ? { ...z, x: 1 - z.x - z.largura } : z;
}

export function zonasDoLayout({ layout = "impacto", largura = 1080, altura = 1920, temSelos = false, espelhar = false }) {
  const razao = altura / largura;
  const vertical = razao >= 1.5;
  const retrato = razao >= 1.15 && !vertical;
  let z;

  if (vertical) {
    if (layout === "editorial") {
      z = {
        logo: R(0.06, 0.025, 0.34, 0.08),
        produto: R(0.1, 0.1, 0.88, 0.47),
        kicker: R(0.06, 0.575, 0.6, 0.03),
        titulo: R(0.06, 0.61, 0.9, 0.15),
        apoio: R(0.06, 0.765, 0.9, 0.03),
        selos: temSelos ? R(0.03, 0.12, 0.2, 0.36) : null,
        preco: R(0.05, 0.812, 0.6, 0.1),
        cta: R(0.66, 0.836, 0.3, 0.055),
        contato: R(0.05, 0.92, 0.9, 0.05),
        alinhamento: "left",
      };
    } else if (layout === "central") {
      z = {
        logo: R(0.3, 0.02, 0.4, 0.078),
        produto: R(0.06, 0.105, 0.88, 0.43),
        titulo: R(0.05, 0.545, 0.9, 0.15),
        apoio: R(0.1, 0.7, 0.8, 0.032),
        selos: temSelos ? R(0.06, 0.745, 0.88, 0.065) : null,
        preco: R(0.05, temSelos ? 0.818 : 0.755, 0.58, temSelos ? 0.098 : 0.13),
        cta: R(0.65, temSelos ? 0.84 : 0.79, 0.31, 0.055),
        contato: R(0.05, 0.92, 0.9, 0.05),
        alinhamento: "center",
      };
    } else if (layout === "diagonal") {
      z = {
        logo: R(0.58, 0.028, 0.36, 0.075),
        titulo: R(0.06, 0.03, 0.52, 0.17),
        apoio: R(0.06, 0.205, 0.62, 0.032),
        produto: R(0.02, 0.25, temSelos ? 0.76 : 0.96, 0.44),
        selos: temSelos ? R(0.76, 0.28, 0.21, 0.36) : null,
        preco: R(0.05, 0.705, 0.9, 0.13),
        cta: R(0.15, 0.848, 0.7, 0.056),
        contato: R(0.05, 0.92, 0.9, 0.05),
        alinhamento: "left",
      };
    } else {
      z = {
        logo: R(0.3, 0.018, 0.4, 0.078),
        titulo: R(0.05, 0.105, 0.9, 0.195),
        apoio: R(0.12, 0.305, 0.76, 0.034),
        produto: R(temSelos ? 0.0 : 0.03, 0.335, temSelos ? 0.76 : 0.94, 0.37),
        selos: temSelos ? R(0.75, 0.37, 0.21, 0.3) : null,
        preco: R(0.05, 0.705, 0.9, 0.135),
        cta: R(0.15, 0.848, 0.7, 0.056),
        contato: R(0.05, 0.92, 0.9, 0.05),
        alinhamento: "center",
      };
    }
  } else if (retrato) {
    if (layout === "editorial") {
      z = {
        logo: R(0.05, 0.03, 0.26, 0.085),
        produto: R(0.3, 0.07, 0.68, 0.55),
        kicker: R(0.05, 0.6, 0.5, 0.03),
        titulo: R(0.05, 0.635, 0.9, 0.13),
        apoio: R(0.05, 0.768, 0.9, 0.032),
        selos: temSelos ? R(0.04, 0.16, 0.22, 0.4) : null,
        preco: R(0.05, 0.815, 0.56, 0.1),
        cta: R(0.64, 0.835, 0.32, 0.058),
        contato: R(0.05, 0.925, 0.9, 0.052),
        alinhamento: "left",
      };
    } else if (layout === "central") {
      z = {
        logo: R(0.35, 0.02, 0.3, 0.09),
        produto: R(0.1, 0.115, 0.8, 0.43),
        titulo: R(0.05, 0.55, 0.9, 0.14),
        apoio: R(0.12, 0.695, 0.76, 0.036),
        selos: temSelos ? R(0.06, 0.74, 0.88, 0.07) : null,
        preco: R(0.05, temSelos ? 0.82 : 0.75, 0.56, temSelos ? 0.095 : 0.13),
        cta: R(0.64, temSelos ? 0.84 : 0.785, 0.32, 0.058),
        contato: R(0.05, 0.925, 0.9, 0.052),
        alinhamento: "center",
      };
    } else if (layout === "diagonal") {
      z = {
        logo: R(0.62, 0.03, 0.32, 0.085),
        titulo: R(0.05, 0.03, 0.56, 0.17),
        apoio: R(0.05, 0.205, 0.6, 0.036),
        produto: R(0.02, 0.25, temSelos ? 0.74 : 0.96, 0.46),
        selos: temSelos ? R(0.76, 0.28, 0.21, 0.4) : null,
        preco: R(0.05, 0.72, 0.56, 0.13),
        cta: R(0.64, 0.75, 0.32, 0.06),
        contato: R(0.05, 0.925, 0.9, 0.052),
        alinhamento: "left",
      };
    } else {
      z = {
        logo: R(0.35, 0.018, 0.3, 0.085),
        titulo: R(0.05, 0.11, 0.9, 0.17),
        apoio: R(0.14, 0.285, 0.72, 0.036),
        produto: R(temSelos ? 0.02 : 0.05, 0.33, temSelos ? 0.72 : 0.9, 0.4),
        selos: temSelos ? R(0.74, 0.36, 0.22, 0.34) : null,
        preco: R(0.05, 0.745, 0.56, 0.13),
        cta: R(0.64, 0.775, 0.32, 0.06),
        contato: R(0.05, 0.925, 0.9, 0.052),
        alinhamento: "center",
      };
    }
  } else if (layout === "central" || layout === "impacto") {
    // quadrado: título em cima, peça no meio
    z = {
      logo: R(0.04, 0.035, 0.2, 0.13),
      titulo: R(0.28, 0.035, 0.68, 0.2),
      apoio: R(0.28, 0.245, 0.68, 0.045),
      produto: R(temSelos ? 0.04 : 0.12, 0.3, temSelos ? 0.72 : 0.76, 0.47),
      selos: temSelos ? R(0.78, 0.32, 0.19, 0.42) : null,
      preco: R(0.04, 0.78, 0.52, 0.125),
      cta: R(0.6, 0.8, 0.36, 0.075),
      contato: R(0.04, 0.915, 0.92, 0.065),
      alinhamento: "left",
    };
  } else {
    // quadrado: texto à esquerda, peça grande à direita
    z = {
      logo: R(0.05, 0.04, 0.24, 0.12),
      titulo: R(0.05, 0.19, 0.42, 0.22),
      apoio: R(0.05, 0.43, 0.42, 0.045),
      produto: R(0.5, 0.07, 0.47, 0.68),
      selos: temSelos ? R(0.05, 0.51, 0.42, 0.09) : null,
      preco: R(0.05, temSelos ? 0.62 : 0.54, 0.42, 0.15),
      cta: R(0.05, temSelos ? 0.795 : 0.72, 0.36, 0.075),
      contato: R(0.04, 0.915, 0.92, 0.065),
      alinhamento: "left",
    };
  }

  // Variação: peça do outro lado (a leitura dos textos continua natural)
  if (espelhar && (layout === "editorial" || layout === "diagonal")) {
    z = { ...z, produto: espelharZona(z.produto), selos: espelharZona(z.selos) };
    if (!vertical && !retrato) {
      z = {
        ...z,
        titulo: espelharZona(z.titulo),
        apoio: espelharZona(z.apoio),
        preco: espelharZona(z.preco),
        cta: espelharZona(z.cta),
        logo: espelharZona(z.logo),
      };
    } else if (layout === "diagonal") {
      z = { ...z, logo: espelharZona(z.logo), titulo: espelharZona(z.titulo), apoio: espelharZona(z.apoio), alinhamento: "right" };
    }
  }
  return z;
}

export function paraPixels(zona, largura, altura) {
  if (!zona) return null;
  return {
    x: Math.round(zona.x * largura),
    y: Math.round(zona.y * altura),
    largura: Math.round(zona.largura * largura),
    altura: Math.round(zona.altura * altura),
  };
}

// Encaixa a peça GRANDE na área (proporção real, sem deformar).
export function encaixarPecaGrande(area, proporcao) {
  const p = Number(proporcao) > 0 ? Number(proporcao) : 1;
  let largura = area.largura;
  let altura = largura / p;
  if (altura > area.altura) {
    altura = area.altura;
    largura = altura * p;
  }
  return {
    x: Math.round(area.x + (area.largura - largura) / 2),
    y: Math.round(area.y + (area.altura - altura) / 2),
    largura: Math.round(largura),
    altura: Math.round(altura),
  };
}

function descrever(r, quadro) {
  const p = (v, t) => Math.max(0, Math.min(100, Math.round((v / t) * 100)));
  return `${p(r.x, quadro.largura)}% to ${p(r.x + r.largura, quadro.largura)}% of the image width and ${p(r.y, quadro.altura)}% to ${p(r.y + r.altura, quadro.altura)}% of the image height`;
}

// Selos exibidos: somente os marcados pelo usuário (máx. 3).
export function selosDoBanner(diferenciais = []) {
  return (Array.isArray(diferenciais) ? diferenciais : []).filter((id) => DIFERENCIAIS[id]).slice(0, 3);
}

// Tudo que a arte precisa: zonas em pixels, peça e as descrições para a IA.
export function planejarDiretor({ largura, altura, proporcaoProduto = 1, decisao, diferenciais = [], quadro = null }) {
  const selos = selosDoBanner(diferenciais);
  const zf = zonasDoLayout({
    layout: decisao.layout,
    largura,
    altura,
    temSelos: selos.length > 0,
    espelhar: decisao.espelhar,
  });
  const Z = {};
  for (const [k, v] of Object.entries(zf)) if (v && typeof v === "object") Z[k] = paraPixels(v, largura, altura);
  const peca = encaixarPecaGrande(Z.produto, proporcaoProduto);
  const final = { largura, altura };
  let zonaProdutoIA = "";
  let baseProdutoIA = "";
  let zonasTextoIA = [];
  if (quadro) {
    const noQuadro = mapearParaQuadroIA(peca, final, quadro);
    zonaProdutoIA = descrever(noQuadro, quadro);
    baseProdutoIA = descrever(
      {
        x: noQuadro.x + noQuadro.largura * 0.3,
        y: noQuadro.y + noQuadro.altura * 0.96,
        largura: noQuadro.largura * 0.4,
        altura: noQuadro.altura * 0.06,
      },
      quadro
    );
    zonasTextoIA = ["logo", "titulo", "apoio", "preco", "cta", "contato", "selos"]
      .filter((k) => Z[k])
      .map((k) => descrever(mapearParaQuadroIA(Z[k], final, quadro), quadro));
  }
  return { zonas: Z, alinhamento: zf.alinhamento, peca, selos, zonaProdutoIA, baseProdutoIA, zonasTextoIA };
}
