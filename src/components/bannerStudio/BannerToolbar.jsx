import {
  useEffect,
  useRef,
  useState,
} from "react";

import { modelosPremiumBanner } from "../bannerConstants";
import BannerToolbar from "./BannerToolbar";
import BannerIcones from "./BannerIcones";
import BannerExportacaoPro from "./BannerExportacaoPro";
import * as htmlToImage from "html-to-image";

import {
  marcarBannerPronto,
} from "../../services/projetoAtualService";


function criarObjetoSvg({
  forma,
  cor = "#2563eb",
  borda = "#ffffff",
  opacidade = 1,
}) {
  const preenchimento =
    String(cor || "#2563eb");

  const contorno =
    String(borda || "#ffffff");

  const alpha = Math.max(
    0.1,
    Math.min(
      1,
      Number(opacidade) || 1
    )
  );

  const formas = {
    seta: `
      <path
        d="M70 105 H270 V55 L365 150 270 245 V195 H70 Z"
        fill="${preenchimento}"
        stroke="${contorno}"
        stroke-width="12"
        stroke-linejoin="round"
      />
    `,

    circulo: `
      <circle
        cx="200"
        cy="150"
        r="108"
        fill="${preenchimento}"
        stroke="${contorno}"
        stroke-width="12"
      />
    `,

    quadrado: `
      <rect
        x="85"
        y="35"
        width="230"
        height="230"
        rx="20"
        fill="${preenchimento}"
        stroke="${contorno}"
        stroke-width="12"
      />
    `,

    retangulo: `
      <rect
        x="42"
        y="70"
        width="316"
        height="160"
        rx="26"
        fill="${preenchimento}"
        stroke="${contorno}"
        stroke-width="12"
      />
    `,

    faixa: `
      <path
        d="M35 82 H365 L330 150 365 218 H35 L70 150 Z"
        fill="${preenchimento}"
        stroke="${contorno}"
        stroke-width="10"
        stroke-linejoin="round"
      />
    `,

    explosao: `
      <path
        d="M200 18 232 65 288 40 294 96 352 105 320 153 363 192 308 213 318 271 258 259 230 292 197 252 149 286 130 235 72 247 84 190 35 158 80 119 55 68 115 72 140 22 178 60 Z"
        fill="${preenchimento}"
        stroke="${contorno}"
        stroke-width="10"
        stroke-linejoin="round"
      />
    `,

    estrela: `
      <path
        d="M200 22 238 104 328 114 260 175 278 263 200 218 122 263 140 175 72 114 162 104 Z"
        fill="${preenchimento}"
        stroke="${contorno}"
        stroke-width="10"
        stroke-linejoin="round"
      />
    `,

    marcador: `
      <path
        d="M200 22 C126 22 72 78 72 148 C72 229 200 286 200 286 C200 286 328 229 328 148 C328 78 274 22 200 22 Z"
        fill="${preenchimento}"
        stroke="${contorno}"
        stroke-width="11"
      />
      <circle
        cx="200"
        cy="142"
        r="48"
        fill="rgba(255,255,255,.82)"
      />
    `,

    linha: `
      <line
        x1="45"
        y1="150"
        x2="355"
        y2="150"
        stroke="${preenchimento}"
        stroke-width="30"
        stroke-linecap="round"
      />
      <line
        x1="45"
        y1="150"
        x2="355"
        y2="150"
        stroke="${contorno}"
        stroke-width="6"
        stroke-linecap="round"
        opacity=".75"
      />
    `,

    hexagono: `
      <path
        d="M115 38 H285 L370 150 285 262 H115 L30 150 Z"
        fill="${preenchimento}"
        stroke="${contorno}"
        stroke-width="12"
        stroke-linejoin="round"
      />
    `,
  };

  const desenho =
    formas[forma] ||
    formas.circulo;

  const svg = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="400"
      height="300"
      viewBox="0 0 400 300"
    >
      <g opacity="${alpha}">
        ${desenho}
      </g>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    svg
  )}`;
}

function criarLogoSvg({
  texto,
  subtitulo = "",
  fundo = "#0f172a",
  cor = "#ffffff",
  destaque = "#22d3ee",
}) {
  const escapar = (valor) =>
    String(valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="720" height="260" viewBox="0 0 720 260">
      <rect width="720" height="260" rx="34" fill="${fundo}"/>
      <rect x="18" y="18" width="684" height="224" rx="26" fill="none" stroke="${destaque}" stroke-width="8"/>
      <text x="360" y="128" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="900" fill="${cor}">${escapar(texto)}</text>
      ${
        subtitulo
          ? `<text x="360" y="188" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="${destaque}">${escapar(subtitulo)}</text>`
          : ""
      }
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}


const OBJETOS_STUDIO = [
  {
    forma: "seta",
    nome: "Seta",
    icone: "➡️",
    cor: "#2563eb",
  },
  {
    forma: "circulo",
    nome: "Círculo",
    icone: "⭕",
    cor: "#0ea5e9",
  },
  {
    forma: "quadrado",
    nome: "Quadrado",
    icone: "⬜",
    cor: "#334155",
  },
  {
    forma: "retangulo",
    nome: "Retângulo",
    icone: "🔷",
    cor: "#7c3aed",
  },
  {
    forma: "faixa",
    nome: "Faixa",
    icone: "🏷️",
    cor: "#f97316",
  },
  {
    forma: "explosao",
    nome: "Explosão",
    icone: "💥",
    cor: "#dc2626",
  },
  {
    forma: "estrela",
    nome: "Estrela",
    icone: "⭐",
    cor: "#eab308",
  },
  {
    forma: "marcador",
    nome: "Marcador",
    icone: "📍",
    cor: "#ef4444",
  },
  {
    forma: "linha",
    nome: "Linha",
    icone: "➖",
    cor: "#22d3ee",
  },
  {
    forma: "hexagono",
    nome: "Hexágono",
    icone: "⬢",
    cor: "#059669",
  },
];

const FORMATOS_EXPORTACAO = {
  mercadoLivre: {
    nome: "Mercado Livre",
    largura: 1200,
    altura: 1200,
  },
  shopee: {
    nome: "Shopee",
    largura: 1200,
    altura: 1500,
  },
  instagram: {
    nome: "Instagram Feed",
    largura: 1080,
    altura: 1350,
  },
  stories: {
    nome: "Stories",
    largura: 1080,
    altura: 1920,
  },
  site: {
    nome: "Banner Site",
    largura: 1200,
    altura: 340,
  },
};

const LOGOS_STUDIO = [
  {
    nome: "Torken Auto Parts",
    categoria: "Marca própria",
    src: criarLogoSvg({
      texto: "TORKEN",
      subtitulo: "AUTO PARTS",
      fundo: "#06152f",
      cor: "#ffffff",
      destaque: "#22d3ee",
    }),
  },
  {
    nome: "Casa da Injeção",
    categoria: "Marca própria",
    src: criarLogoSvg({
      texto: "CASA DA INJEÇÃO",
      subtitulo: "ELETRÔNICA",
      fundo: "#0f172a",
      cor: "#ffffff",
      destaque: "#60a5fa",
    }),
  },
  {
    nome: "APPIA AI",
    categoria: "Marca própria",
    src: criarLogoSvg({
      texto: "APPIA AI",
      subtitulo: "PLATAFORMA AUTOMOTIVA",
      fundo: "#020617",
      cor: "#ffffff",
      destaque: "#67e8f9",
    }),
  },
  {
    nome: "Bosch",
    categoria: "Fabricante",
    src: criarLogoSvg({
      texto: "BOSCH",
      subtitulo: "AUTOMOTIVE",
      fundo: "#ffffff",
      cor: "#dc2626",
      destaque: "#334155",
    }),
  },
  {
    nome: "Magneti Marelli",
    categoria: "Fabricante",
    src: criarLogoSvg({
      texto: "MARELLI",
      subtitulo: "AUTOMOTIVE PARTS",
      fundo: "#0f172a",
      cor: "#ffffff",
      destaque: "#ef4444",
    }),
  },
  {
    nome: "NGK",
    categoria: "Fabricante",
    src: criarLogoSvg({
      texto: "NGK",
      subtitulo: "IGNITION PARTS",
      fundo: "#ffffff",
      cor: "#dc2626",
      destaque: "#f97316",
    }),
  },
  {
    nome: "Denso",
    categoria: "Fabricante",
    src: criarLogoSvg({
      texto: "DENSO",
      subtitulo: "AUTO PARTS",
      fundo: "#ffffff",
      cor: "#dc2626",
      destaque: "#991b1b",
    }),
  },
  {
    nome: "Delphi",
    categoria: "Fabricante",
    src: criarLogoSvg({
      texto: "DELPHI",
      subtitulo: "TECHNOLOGIES",
      fundo: "#020617",
      cor: "#ffffff",
      destaque: "#f43f5e",
    }),
  },
  {
    nome: "MTE-THOMSON",
    categoria: "Fabricante",
    src: criarLogoSvg({
      texto: "MTE-THOMSON",
      subtitulo: "SENSORES AUTOMOTIVOS",
      fundo: "#ffffff",
      cor: "#1d4ed8",
      destaque: "#ef4444",
    }),
  },
  {
    nome: "VDO",
    categoria: "Fabricante",
    src: criarLogoSvg({
      texto: "VDO",
      subtitulo: "AUTOMOTIVE",
      fundo: "#0f172a",
      cor: "#ffffff",
      destaque: "#f59e0b",
    }),
  },
  {
    nome: "Valeo",
    categoria: "Fabricante",
    src: criarLogoSvg({
      texto: "VALEO",
      subtitulo: "AUTO PARTS",
      fundo: "#ffffff",
      cor: "#16a34a",
      destaque: "#15803d",
    }),
  },
  {
    nome: "Continental",
    categoria: "Fabricante",
    src: criarLogoSvg({
      texto: "CONTINENTAL",
      subtitulo: "AUTOMOTIVE",
      fundo: "#ffffff",
      cor: "#f59e0b",
      destaque: "#111827",
    }),
  },
  {
    nome: "Mercado Livre",
    categoria: "Marketplace",
    src: criarLogoSvg({
      texto: "MERCADO LIVRE",
      subtitulo: "MARKETPLACE",
      fundo: "#facc15",
      cor: "#1e3a8a",
      destaque: "#2563eb",
    }),
  },
  {
    nome: "Shopee",
    categoria: "Marketplace",
    src: criarLogoSvg({
      texto: "SHOPEE",
      subtitulo: "MARKETPLACE",
      fundo: "#f97316",
      cor: "#ffffff",
      destaque: "#fed7aa",
    }),
  },
  {
    nome: "Amazon",
    categoria: "Marketplace",
    src: criarLogoSvg({
      texto: "AMAZON",
      subtitulo: "MARKETPLACE",
      fundo: "#111827",
      cor: "#ffffff",
      destaque: "#f59e0b",
    }),
  },
  {
    nome: "Original",
    categoria: "Selo visual",
    src: criarLogoSvg({
      texto: "ORIGINAL",
      subtitulo: "QUALIDADE GARANTIDA",
      fundo: "#14532d",
      cor: "#ffffff",
      destaque: "#bbf7d0",
    }),
  },
  {
    nome: "Premium",
    categoria: "Selo visual",
    src: criarLogoSvg({
      texto: "PREMIUM",
      subtitulo: "AUTO PARTS",
      fundo: "#713f12",
      cor: "#ffffff",
      destaque: "#fde68a",
    }),
  },
];

export default function BannerIA({
  galeria,
  imagemBanner,
  setImagemBanner,
  bannerModelo,
  setBannerModelo,
  categoriaBanner,
  setCategoriaBanner,
  estiloBanner,
  setEstiloBanner,
  tamanhoBanner,
  setTamanhoBanner,
  fundoBanner,
  setFundoBanner,
  modeloPremiumBanner,
  setModeloPremiumBanner,
  processarBannerIA,
  processando,
  resultadoIA,
  baixarImagem,
  setScreen,
}) {
  console.log("GALERIA BANNER:", galeria);

const [
  fundoStudio,
  setFundoStudio,
] = useState(() => {
  return (
    localStorage.getItem(
      "fundoBannerStudio"
    ) || "#ffffff"
  );
});

const [
  posicaoProduto,
  setPosicaoProduto,
] = useState({
  x: 450,
  y: 300,
});

const [
  zoomCanvas,
  setZoomCanvas,
] = useState(100);

const [
  mostrarGrade,
  setMostrarGrade,
] = useState(false);

const [
  snapNaGrade,
  setSnapNaGrade,
] = useState(false);

const [
  tamanhoGrade,
  setTamanhoGrade,
] = useState(20);

const [
  espacoPressionado,
  setEspacoPressionado,
] = useState(false);

const [
  movendoPrancheta,
  setMovendoPrancheta,
] = useState(false);

const [
  deslocamentoPrancheta,
  setDeslocamentoPrancheta,
] = useState({
  x: 0,
  y: 0,
});

const [
  inicioPan,
  setInicioPan,
] = useState({
  x: 0,
  y: 0,
});

const [
  historicoFuturo,
  setHistoricoFuturo,
] = useState([]);

const elementoCopiadoRef =
  useRef(null);


const [
  arrastando,
  setArrastando,
] = useState(false);

const [
  mostrarGuiaVertical,
  setMostrarGuiaVertical,
] = useState(false);

const [
  mostrarGuiaHorizontal,
  setMostrarGuiaHorizontal,
] = useState(false);

const [
  ferramentaStudio,
  setFerramentaStudio,
] = useState("fundos");

const [
  templateProfissionalSelecionado,
  setTemplateProfissionalSelecionado,
] = useState("mercadoLivre");

const [
  tituloStudio,
  setTituloStudio,
] = useState("");

const [
  textosStudio,
  setTextosStudio,
] = useState(() => {
  try {
    const textosSalvos =
      localStorage.getItem(
        "textosBannerStudio"
      );

    return textosSalvos
      ? JSON.parse(textosSalvos)
      : [];
  } catch {
    return [];
  }
});

const [
  corTituloStudio,
  setCorTituloStudio,
] = useState("#ffffff");

const [
  tamanhoTituloStudio,
  setTamanhoTituloStudio,
] = useState(38);

const [
  posicaoTitulo,
  setPosicaoTitulo,
] = useState({
  x: 450,
  y: 70,
});

const [
  arrastandoTitulo,
  setArrastandoTitulo,
] = useState(false);

const [
  mostrarTituloStudio,
  setMostrarTituloStudio,
] = useState(false);

const [
  textoArrastando,
  setTextoArrastando,
] = useState(null);

const [
  editandoTextoId,
  setEditandoTextoId,
] = useState(null);

const [
  textoAntesEdicao,
  setTextoAntesEdicao,
] = useState("");

const cancelarEdicaoTextoRef =
  useRef(false);

const [
  rotacaoProduto,
  setRotacaoProduto,
] = useState(0);

const [
  elementoSelecionado,
  setElementoSelecionado,
] = useState(null);

const [
  camadasStudio,
  setCamadasStudio,
] = useState(() => {
  try {
    const camadasSalvas =
      localStorage.getItem(
        "camadasBannerStudio"
      );

    return camadasSalvas
      ? JSON.parse(camadasSalvas)
      : [];
  } catch {
    return [];
  }
});
const [
  imagensBanner,
  setImagensBanner,
] = useState(() => {
  try {

    const imagensSalvas =
      localStorage.getItem(
        "imagensBannerStudio"
      );

    if (imagensSalvas) {
      return JSON.parse(
        imagensSalvas
      );
    }

    return imagemBanner
      ? [
          {
            id: Date.now(),
            src: imagemBanner,
            x: 450,
            y: 300,
            rotacao: 0,
          },
        ]
      : [];
  } catch {
    return [];
  }
});
useEffect(() => {
  localStorage.setItem(
    "imagensBannerStudio",
    JSON.stringify(imagensBanner)
  );
}, [imagensBanner]);

useEffect(() => {
  localStorage.setItem(
    "fundoBannerStudio",
    fundoStudio
  );
}, [fundoStudio]);

useEffect(() => {
  localStorage.setItem(
    "textosBannerStudio",
    JSON.stringify(textosStudio)
  );
}, [textosStudio]);

useEffect(() => {
  localStorage.setItem(
    "camadasBannerStudio",
    JSON.stringify(camadasStudio)
  );
}, [camadasStudio]);

const [
  imagemSelecionadaId,
  setImagemSelecionadaId,
] = useState(() =>
  imagemBanner
    ? imagensBanner[0]?.id || null
    : null
);

const [
  imagemArrastandoId,
  setImagemArrastandoId,
] = useState(null);

const [
  historicoBanner,
  setHistoricoBanner,
] = useState([]);

const [
  restaurandoHistorico,
  setRestaurandoHistorico,
] = useState(false);

const [
  formatoExportacao,
  setFormatoExportacao,
] = useState("mercadoLivre");

const [
  tipoExportacao,
  setTipoExportacao,
] = useState("png");

const [
  escalaExportacao,
  setEscalaExportacao,
] = useState(2);

const [
  nomeArquivoExportacao,
  setNomeArquivoExportacao,
] = useState("banner-appia");

const [
  fundoTransparenteExportacao,
  setFundoTransparenteExportacao,
] = useState(false);

const [
  qualidadeExportacaoPro,
  setQualidadeExportacaoPro,
] = useState("alta");

const [
  previewExportacaoImagem,
  setPreviewExportacaoImagem,
] = useState("");

const [
  exportandoBanner,
  setExportandoBanner,
] = useState(false);

const [
  versaoBannerAtiva,
  setVersaoBannerAtiva,
] = useState("original");

const [
  versaoOriginalBanner,
  setVersaoOriginalBanner,
] = useState(null);

const [
  versaoIABanner,
  setVersaoIABanner,
] = useState(null);

const [
  analiseBannerIA,
  setAnaliseBannerIA,
] = useState(null);

const [
  ideiasBannerIA,
  setIdeiasBannerIA,
] = useState([]);

const [
  ideiaBannerSelecionada,
  setIdeiaBannerSelecionada,
] = useState(null);

useEffect(() => {
  setIdeiasBannerIA([
    {
      id: "fundo-ia-a",
      nome: "A — Clean",
      fundoStudio:
        "linear-gradient(135deg,#ffffff 0%,#e2e8f0 100%)",
    },
    {
      id: "fundo-ia-b",
      nome: "B — Marketplace",
      fundoStudio:
        "linear-gradient(135deg,#1d4ed8 0%,#0891b2 100%)",
    },
    {
      id: "fundo-ia-c",
      nome: "C — Premium",
      fundoStudio:
        "radial-gradient(circle at 72% 35%,#1d4ed8 0%,#0f172a 56%,#020617 100%)",
    },
    {
      id: "fundo-ia-d",
      nome: "D — Impacto",
      fundoStudio:
        "linear-gradient(135deg,#7c2d12 0%,#dc2626 52%,#f59e0b 100%)",
    },
  ]);
}, []);

const [
  mostrarAreaSegura,
  setMostrarAreaSegura,
] = useState(true);

const [
  categoriaTemplateIA,
  setCategoriaTemplateIA,
] = useState("sensor");

const [
  canalPreview,
  setCanalPreview,
] = useState("mercadoLivre");

const [
  gerandoPreviewMarketplace,
  setGerandoPreviewMarketplace,
] = useState(false);

const [
  previewMarketplaceAberto,
  setPreviewMarketplaceAberto,
] = useState(false);

const [
  previewMarketplaceImagem,
  setPreviewMarketplaceImagem,
] = useState("");

const formatoSelecionadoExportacao =
  FORMATOS_EXPORTACAO[formatoExportacao];

const larguraPreviewExportacao = 980;

const alturaPreviewExportacao =
  larguraPreviewExportacao *
  (formatoSelecionadoExportacao.altura /
    formatoSelecionadoExportacao.largura);


function obterConfiguracaoQualidade(
  qualidade
) {
  const configuracoes = {
    ultra: {
      escala: 3,
      qualidadeImagem: 1,
    },
    alta: {
      escala: 2,
      qualidadeImagem: 0.96,
    },
    media: {
      escala: 1.5,
      qualidadeImagem: 0.88,
    },
    leve: {
      escala: 1,
      qualidadeImagem: 0.76,
    },
  };

  return (
    configuracoes[qualidade] ||
    configuracoes.alta
  );
}

function baixarDataUrl(
  dataUrl,
  nome
) {
  const link =
    document.createElement("a");

  link.href = dataUrl;
  link.download = nome;

  document.body.appendChild(
    link
  );

  link.click();

  document.body.removeChild(
    link
  );
}

async function converterDataUrlParaWebp(
  dataUrl,
  qualidade = 0.92
) {
  return new Promise(
    (resolve, reject) => {
      const imagem = new Image();

      imagem.onload = () => {
        const canvas =
          document.createElement(
            "canvas"
          );

        canvas.width =
          imagem.naturalWidth;

        canvas.height =
          imagem.naturalHeight;

        const contexto =
          canvas.getContext("2d");

        if (!contexto) {
          reject(
            new Error(
              "Não foi possível criar o WEBP."
            )
          );
          return;
        }

        contexto.drawImage(
          imagem,
          0,
          0
        );

        resolve(
          canvas.toDataURL(
            "image/webp",
            qualidade
          )
        );
      };

      imagem.onerror = () =>
        reject(
          new Error(
            "Não foi possível converter a imagem."
          )
        );

      imagem.src = dataUrl;
    }
  );
}

async function gerarArquivoBanner(
  configuracao = {},
  baixar = true
) {
  const canvas =
    document.getElementById(
      "banner-prancheta-exportavel"
    );

  if (!canvas) {
    throw new Error(
      "Prancheta do banner não encontrada."
    );
  }

  const resolucao =
    configuracao.resolucao ||
    formatoExportacao;

  const formato =
    configuracao.formato ||
    tipoExportacao;

  const qualidade =
    configuracao.qualidade ||
    qualidadeExportacaoPro;

  const formatoDestino =
    FORMATOS_EXPORTACAO[
      resolucao
    ] ||
    formatoSelecionadoExportacao;

  const qualidadeDestino =
    obterConfiguracaoQualidade(
      qualidade
    );

  const larguraFinal =
    configuracao.largura ||
    formatoDestino.largura;

  const alturaFinal =
    configuracao.altura ||
    formatoDestino.altura;

  const escalaFinal =
    configuracao.escala ||
    qualidadeDestino.escala;

  const qualidadeImagem =
    configuracao.qualidadeImagem ||
    qualidadeDestino.qualidadeImagem;

  const transparente =
    Boolean(
      configuracao.fundoTransparente ??
        fundoTransparenteExportacao
    ) &&
    formato === "png";

  const nomeLimpo = String(
    configuracao.nomeArquivo ||
      nomeArquivoExportacao ||
      "banner-appia"
  )
    .trim()
    .replace(
      /[^a-zA-Z0-9-_]+/g,
      "-"
    )
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") ||
    "banner-appia";

  const larguraVisual =
    Math.max(
      1,
      Math.round(
        canvas.offsetWidth
      )
    );

  const alturaVisual =
    Math.max(
      1,
      Math.round(
        canvas.offsetHeight
      )
    );

  const opcoes = {
    width: larguraVisual,
    height: alturaVisual,
    canvasWidth:
      larguraFinal *
      escalaFinal,
    canvasHeight:
      alturaFinal *
      escalaFinal,
    cacheBust: true,
    pixelRatio: 1,
    quality:
      qualidadeImagem,
    filter: (no) =>
      no?.getAttribute?.(
        "data-nao-exportar"
      ) !== "true",
    backgroundColor:
      transparente
        ? null
        : fundoStudio ===
            "transparent"
          ? "#ffffff"
          : undefined,
    style: {
      width:
        `${larguraVisual}px`,
      height:
        `${alturaVisual}px`,
      maxWidth: "none",
      minWidth: "0",
      border: "none",
      borderRadius: "0",
      boxShadow: "none",
      margin: "0",
      transform: "none",
      transformOrigin:
        "top left",
    },
  };

  let dataUrl;

  if (formato === "jpg") {
    dataUrl =
      await htmlToImage.toJpeg(
        canvas,
        opcoes
      );
  } else {
    const png =
      await htmlToImage.toPng(
        canvas,
        opcoes
      );

    dataUrl =
      formato === "webp"
        ? await converterDataUrlParaWebp(
            png,
            qualidadeImagem
          )
        : png;
  }
if (baixar) {
    marcarBannerPronto({
      banner_url: dataUrl,
      formato,
    });
  }
  const dimensoes =
    `${larguraFinal}x${alturaFinal}`;

  if (
    formato === "pdf" &&
    baixar
  ) {
    const janela =
      window.open(
        "",
        "_blank"
      );

    if (!janela) {
      throw new Error(
        "Permita pop-ups para exportar o PDF."
      );
    }

    janela.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${nomeLimpo}</title>
          <style>
            @page {
              size: ${larguraFinal}px ${alturaFinal}px;
              margin: 0;
            }

            html,
            body {
              margin: 0;
              width: 100%;
              height: 100%;
              background: #ffffff;
            }

            img {
              display: block;
              width: 100%;
              height: 100%;
              object-fit: contain;
            }
          </style>
        </head>

        <body>
          <img src="${dataUrl}" />
          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    janela.document.close();

    return {
      dataUrl,
      nome:
        `${nomeLimpo}-${dimensoes}.pdf`,
    };
  }

  const extensao =
    formato === "jpg"
      ? "jpg"
      : formato === "webp"
        ? "webp"
        : "png";

  const nome =
    `${nomeLimpo}-${dimensoes}.${extensao}`;

  if (baixar) {
    baixarDataUrl(
      dataUrl,
      nome
    );
  }

  return {
    dataUrl,
    nome,
  };
}

async function exportarBannerProfissional(
  configuracao = {}
) {
  const elementoAnterior =
    elementoSelecionado;

  const imagemAnterior =
    imagemSelecionadaId;

  setExportandoBanner(true);

  try {
    setElementoSelecionado(null);
    setImagemSelecionadaId(null);
    setTextoArrastando(null);
    setImagemArrastandoId(null);
    setMostrarGuiaVertical(null);
    setMostrarGuiaHorizontal(null);

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          180
        )
    );

    await gerarArquivoBanner(
      configuracao,
      true
    );
  } catch (erro) {
    console.error(
      "ERRO EXPORTAR BANNER:",
      erro
    );

    alert(
      erro?.message ||
        "Erro ao exportar o banner."
    );
  } finally {
    setElementoSelecionado(
      elementoAnterior
    );

    setImagemSelecionadaId(
      imagemAnterior
    );

    setExportandoBanner(false);
  }
}

async function gerarPreviewBanner(
  configuracao = {}
) {
  const elementoAnterior =
    elementoSelecionado;

  const imagemAnterior =
    imagemSelecionadaId;

  setExportandoBanner(true);

  try {
    setElementoSelecionado(null);
    setImagemSelecionadaId(null);
    setTextoArrastando(null);
    setImagemArrastandoId(null);
    setMostrarGuiaVertical(null);
    setMostrarGuiaHorizontal(null);

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          150
        )
    );

    const resultado =
      await gerarArquivoBanner(
        {
          ...configuracao,
          formato: "png",
          escala: 1,
          qualidadeImagem: 0.82,
        },
        false
      );

    setPreviewExportacaoImagem(
      resultado.dataUrl
    );
  } catch (erro) {
    console.error(
      "ERRO PREVIEW:",
      erro
    );

    alert(
      erro?.message ||
        "Erro ao gerar o preview."
    );
  } finally {
    setElementoSelecionado(
      elementoAnterior
    );

    setImagemSelecionadaId(
      imagemAnterior
    );

    setExportandoBanner(false);
  }
}

async function exportarTodosFormatos(
  configuracao = {}
) {
  const elementoAnterior =
    elementoSelecionado;

  const imagemAnterior =
    imagemSelecionadaId;

  const resolucoes =
    configuracao.resolucoes ||
    [];

  if (
    resolucoes.length === 0
  ) {
    return;
  }

  setExportandoBanner(true);

  try {
    setElementoSelecionado(null);
    setImagemSelecionadaId(null);
    setTextoArrastando(null);
    setImagemArrastandoId(null);
    setMostrarGuiaVertical(null);
    setMostrarGuiaHorizontal(null);

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          180
        )
    );

    for (
      const resolucao of
      resolucoes
    ) {
      await gerarArquivoBanner(
        {
          ...configuracao,
          resolucao:
            resolucao.id,
          largura:
            resolucao.largura,
          altura:
            resolucao.altura,
          nomeArquivo:
            `${
              configuracao.nomeArquivo ||
              nomeArquivoExportacao
            }-${resolucao.id}`,
        },
        true
      );

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            450
          )
      );
    }

    alert(
      "✅ Exportação em lote concluída."
    );
  } catch (erro) {
    console.error(
      "ERRO EXPORTAÇÃO EM LOTE:",
      erro
    );

    alert(
      erro?.message ||
        "Erro na exportação em lote."
    );
  } finally {
    setElementoSelecionado(
      elementoAnterior
    );

    setImagemSelecionadaId(
      imagemAnterior
    );

    setExportandoBanner(false);
  }
}

function capturarEstadoAtualBanner() {
  return {
    fundoStudio,
    imagensBanner: imagensBanner.map(
      (item) => ({ ...item })
    ),
    textosStudio: textosStudio.map(
      (item) => ({ ...item })
    ),
    camadasStudio: camadasStudio.map(
      (item) => ({ ...item })
    ),
  };
}

function aplicarEstadoBanner(estado) {
  if (!estado) {
    return;
  }

  setFundoStudio(
    estado.fundoStudio || "#ffffff"
  );

  setImagensBanner(
    (estado.imagensBanner || []).map(
      (item) => ({ ...item })
    )
  );

  setTextosStudio(
    (estado.textosStudio || []).map(
      (item) => ({ ...item })
    )
  );

  setCamadasStudio(
    (estado.camadasStudio || []).map(
      (item) => ({ ...item })
    )
  );

  setElementoSelecionado(null);
  setImagemSelecionadaId(null);
  setTextoArrastando(null);
  setImagemArrastandoId(null);
}

function limitarTextoIA(valor, limite = 42) {
  const texto = String(valor || "")
    .replace(/\s+/g, " ")
    .trim();

  if (texto.length <= limite) {
    return texto;
  }

  return `${texto.slice(0, limite - 1).trim()}…`;
}

function calcularTamanhoTextoIA(
  texto,
  tamanhoMaximo,
  tamanhoMinimo = 22
) {
  const comprimento = String(texto || "").length;

  if (comprimento <= 16) {
    return tamanhoMaximo;
  }

  if (comprimento <= 26) {
    return Math.round(tamanhoMaximo * 0.84);
  }

  if (comprimento <= 38) {
    return Math.round(tamanhoMaximo * 0.68);
  }

  return tamanhoMinimo;
}

function gerarTextosComerciaisIA(
  textosOriginais,
  estilo
) {
  const textosComuns = textosOriginais.filter(
    (item) => item.tipo !== "selo"
  );

  const tituloOriginal =
    textosComuns[0]?.texto ||
    "PEÇA AUTOMOTIVA PREMIUM";

  const tituloLimpo = limitarTextoIA(
    tituloOriginal,
    38
  ).toUpperCase();

  const configuracoes = {
    clean: {
      titulo:
        tituloLimpo ||
        "PEÇA AUTOMOTIVA",
      subtitulo:
        "QUALIDADE, PRECISÃO E CONFIANÇA",
      corTitulo: "#0f172a",
      corSubtitulo: "#334155",
    },

    marketplace: {
      titulo:
        tituloLimpo ||
        "PRONTA ENTREGA",
      subtitulo:
        "PRODUTO NOVO • ENVIO RÁPIDO",
      corTitulo: "#ffffff",
      corSubtitulo: "#fef3c7",
    },

    premium: {
      titulo:
        tituloLimpo ||
        "DESEMPENHO PREMIUM",
      subtitulo:
        "QUALIDADE PROFISSIONAL PARA SEU VEÍCULO",
      corTitulo: "#ffffff",
      corSubtitulo: "#fde68a",
    },
  };

  return configuracoes[estilo] ||
    configuracoes.premium;
}

function analisarEstadoBannerIA(estado) {
  const imagens = estado?.imagensBanner || [];
  const textos = estado?.textosStudio || [];

  let pontuacao = 100;
  const melhorias = [];
  const corrigido = [];

  if (imagens.length === 0) {
    pontuacao -= 35;
    melhorias.push("Adicionar foto do produto");
  } else {
    corrigido.push("Produto reposicionado");
  }

  const textosComuns = textos.filter(
    (item) => item.tipo !== "selo"
  );

  if (textosComuns.length === 0) {
    pontuacao -= 20;
    melhorias.push("Adicionar título comercial");
  } else {
    corrigido.push("Texto comercial otimizado");
  }

  if (
    textosComuns.some(
      (item) =>
        String(item.texto || "").length > 38
    )
  ) {
    pontuacao -= 10;
    melhorias.push("Reduzir textos longos");
  } else if (textosComuns.length > 0) {
    corrigido.push("Fontes ajustadas");
  }

  const foraDaArea = [
    ...imagens,
    ...textos,
  ].some((item) => {
    const x = Number(item.x) || 0;
    const y = Number(item.y) || 0;

    return (
      x < 45 ||
      y < 45 ||
      x > larguraPreviewExportacao - 45 ||
      y > alturaPreviewExportacao - 45
    );
  });

  if (foraDaArea) {
    pontuacao -= 15;
    melhorias.push("Respeitar área segura");
  } else {
    corrigido.push("Área segura respeitada");
  }

  if (
    !estado?.fundoStudio ||
    estado.fundoStudio === "#ffffff"
  ) {
    pontuacao -= 5;
    melhorias.push("Melhorar contraste do fundo");
  } else {
    corrigido.push("Contraste melhorado");
  }

  return {
    pontuacao: Math.max(55, pontuacao),
    melhorias,
    corrigido,
  };
}

function criarIdeiaAutomotivaIA(
  original,
  configuracao,
  indiceIdeia
) {
  const largura = larguraPreviewExportacao;
  const altura = alturaPreviewExportacao;
  const margemX = largura * 0.08;
  const margemY = altura * 0.08;

  const produtos = (
    original.imagensBanner || []
  ).filter((item) => item.tipo !== "logo" && item.tipo !== "objeto" && item.tipo !== "icone");

  const logos = (
    original.imagensBanner || []
  ).filter((item) => item.tipo === "logo");

  const textosOriginais = (
    original.textosStudio || []
  ).filter((item) => item.tipo !== "selo");

  const selosOriginais = (
    original.textosStudio || []
  ).filter((item) => item.tipo === "selo");

  const tituloBase = limitarTextoIA(
    textosOriginais[0]?.texto ||
      "PEÇA AUTOMOTIVA",
    34
  ).toUpperCase();

  const textosPorEstilo = {
    clean: {
      titulo: tituloBase,
      subtitulo:
        "QUALIDADE E CONFIANÇA PARA SEU VEÍCULO",
      corTitulo: "#0f172a",
      corSubtitulo: "#475569",
    },
    marketplace: {
      titulo: tituloBase,
      subtitulo:
        "PRODUTO NOVO • PRONTA ENTREGA",
      corTitulo: "#ffffff",
      corSubtitulo: "#fef3c7",
    },
    premium: {
      titulo: tituloBase,
      subtitulo:
        "DESEMPENHO PREMIUM E ALTA PRECISÃO",
      corTitulo: "#ffffff",
      corSubtitulo: "#fde68a",
    },
    destaque: {
      titulo: tituloBase,
      subtitulo:
        "OFERTA ESPECIAL • ESTOQUE IMEDIATO",
      corTitulo: "#ffffff",
      corSubtitulo: "#e0f2fe",
    },
  };

  const textosEstilo =
    textosPorEstilo[configuracao.estilo];

  const imagens = [
    ...produtos.map((item, indice) => ({
      ...item,
      x:
        configuracao.produtoX +
        indice * largura * 0.07,
      y:
        configuracao.produtoY +
        indice * altura * 0.05,
      escala: Math.min(
        1.12,
        Math.max(
          0.68,
          configuracao.escala -
            indice * 0.1
        )
      ),
      rotacao:
        indice === 0
          ? configuracao.rotacao
          : configuracao.rotacao + indice * 5,
    })),
    ...logos.map((item, indice) => ({
      ...item,
      x:
        configuracao.logoX +
        indice * largura * 0.15,
      y: configuracao.logoY,
      escala: 0.72,
      rotacao: 0,
    })),
  ].map((item) => ({
    ...item,
    x: Math.min(
      largura - margemX,
      Math.max(margemX, item.x)
    ),
    y: Math.min(
      altura - margemY,
      Math.max(margemY, item.y)
    ),
  }));

  const tituloId =
    textosOriginais[0]?.id ||
    `ideia-${indiceIdeia}-titulo-${Date.now()}`;

  const subtituloId =
    textosOriginais[1]?.id ||
    `ideia-${indiceIdeia}-subtitulo-${Date.now()}`;

  const textos = [
    {
      ...(textosOriginais[0] || {}),
      id: tituloId,
      tipo: "texto",
      texto: textosEstilo.titulo,
      x: configuracao.textoX,
      y: configuracao.textoY,
      cor: textosEstilo.corTitulo,
      tamanho: calcularTamanhoTextoIA(
        textosEstilo.titulo,
        52,
        25
      ),
      alinhamento:
        configuracao.alinhamento,
      larguraMaxima: largura * 0.42,
      quebrarLinha: true,
      rotacao: 0,
    },
    {
      ...(textosOriginais[1] || {}),
      id: subtituloId,
      tipo: "texto",
      texto: textosEstilo.subtitulo,
      x: configuracao.textoX,
      y: configuracao.textoY + 82,
      cor: textosEstilo.corSubtitulo,
      tamanho: calcularTamanhoTextoIA(
        textosEstilo.subtitulo,
        25,
        17
      ),
      alinhamento:
        configuracao.alinhamento,
      larguraMaxima: largura * 0.4,
      quebrarLinha: true,
      rotacao: 0,
    },
    ...selosOriginais
      .slice(0, 2)
      .map((item, indice) => ({
        ...item,
        x:
          configuracao.seloX +
          indice * largura * 0.23,
        y: configuracao.seloY,
        tamanho: Math.min(
          20,
          Number(item.tamanho) || 18
        ),
        rotacao: 0,
      })),
  ];

  const ids = new Set([
    ...imagens.map((item) => item.id),
    ...textos.map((item) => item.id),
  ]);

  const camadasMantidas = (
    original.camadasStudio || []
  ).filter((item) => ids.has(item.id));

  return {
    id: `ideia-${indiceIdeia}`,
    nome: configuracao.nome,
    estilo: configuracao.estilo,
    fundoStudio: configuracao.fundo,
    imagensBanner: imagens,
    textosStudio: textos,
    camadasStudio: camadasMantidas,
  };
}

function gerarQuatroIdeiasIA() {
  const ideias = [
    {
      id: "fundo-ia-a",
      nome: "A — Clean",
      fundoStudio:
        "linear-gradient(135deg,#ffffff 0%,#e2e8f0 100%)",
    },
    {
      id: "fundo-ia-b",
      nome: "B — Marketplace",
      fundoStudio:
        "linear-gradient(135deg,#1d4ed8 0%,#0891b2 100%)",
    },
    {
      id: "fundo-ia-c",
      nome: "C — Premium",
      fundoStudio:
        "radial-gradient(circle at 72% 35%,#1d4ed8 0%,#0f172a 56%,#020617 100%)",
    },
    {
      id: "fundo-ia-d",
      nome: "D — Impacto",
      fundoStudio:
        "linear-gradient(135deg,#7c2d12 0%,#dc2626 52%,#f59e0b 100%)",
    },
  ];

  setIdeiasBannerIA(ideias);
}
function selecionarIdeiaBannerIA(ideia) {
  setIdeiaBannerSelecionada(
    ideia.id
  );
  setVersaoBannerAtiva("ia");

  // Preserva fotos, textos, selos, logos,
  // posições, escalas e descrições.
  setFundoStudio(
    ideia.fundoStudio
  );
}
function selecionarVersaoBanner(tipo) {
  if (tipo !== "original") {
    return;
  }

  setVersaoBannerAtiva("original");
  setIdeiaBannerSelecionada(null);

  const fundoOriginal =
    versaoOriginalBanner?.fundoStudio;

  if (fundoOriginal) {
    // Restaura somente o fundo original.
    setFundoStudio(fundoOriginal);
  }
}
function aplicarEfeitoRapidoImagem(efeito) {
  if (!imagemSelecionadaId) {
    alert("Selecione uma foto ou logo.");
    return;
  }

  setImagensBanner((anteriores) =>
    anteriores.map((imagem) =>
      imagem.id === imagemSelecionadaId
        ? {
            ...imagem,
            efeitoRapido: efeito,
          }
        : imagem
    )
  );
}

function melhorarProdutoSelecionado() {
  if (!imagemSelecionadaId) {
    alert(
      "Selecione uma foto ou logo no banner."
    );
    return;
  }

  setImagensBanner((anteriores) =>
    anteriores.map((imagem) => {
      if (
        imagem.id !==
        imagemSelecionadaId
      ) {
        return imagem;
      }

      const ehLogo =
        imagem.tipo === "logo";

      return {
        ...imagem,

        x: ehLogo
          ? Number(imagem.x) ||
            larguraPreviewExportacao *
              0.82
          : larguraPreviewExportacao /
            2,

        y: ehLogo
          ? Number(imagem.y) ||
            alturaPreviewExportacao *
              0.12
          : alturaPreviewExportacao /
            2,

        escala: ehLogo
          ? Math.min(
              1.1,
              Math.max(
                0.55,
                Number(
                  imagem.escala
                ) || 0.75
              )
            )
          : Math.min(
              1.35,
              Math.max(
                0.78,
                Number(
                  imagem.escala
                ) || 1
              )
            ),

        rotacao: ehLogo
          ? Number(
              imagem.rotacao
            ) || 0
          : 0,

        efeitoRapido: ehLogo
          ? "sombra"
          : "produtoPro",
      };
    })
  );

  setElementoSelecionado(
    imagemSelecionadaId
  );

  setMostrarGuiaVertical(
    larguraPreviewExportacao /
      2
  );

  setMostrarGuiaHorizontal(
    alturaPreviewExportacao /
      2
  );

  window.setTimeout(() => {
    setMostrarGuiaVertical(null);
    setMostrarGuiaHorizontal(null);
  }, 900);
}

function obterFiltroEfeitoRapido(imagem) {
  const selecao =
    elementoSelecionado === imagem.id
      ? "drop-shadow(2px 0 0 #22d3ee) drop-shadow(-2px 0 0 #22d3ee) drop-shadow(0 2px 0 #22d3ee) drop-shadow(0 -2px 0 #22d3ee)"
      : "";

  const efeitos = {
    nenhum:
      imagem.tipo === "logo"
        ? "drop-shadow(0 7px 10px rgba(0,0,0,.28))"
        : "drop-shadow(0 12px 16px rgba(0,0,0,.32))",

    produtoPro:
      "brightness(1.04) contrast(1.08) saturate(1.04) drop-shadow(3px 0 0 rgba(255,255,255,.96)) drop-shadow(-3px 0 0 rgba(255,255,255,.96)) drop-shadow(0 3px 0 rgba(255,255,255,.96)) drop-shadow(0 -3px 0 rgba(255,255,255,.96)) drop-shadow(0 18px 24px rgba(0,0,0,.42))",

    sombra:
      "drop-shadow(0 18px 22px rgba(0,0,0,.48))",

    glowAzul:
      "drop-shadow(0 0 8px #38bdf8) drop-shadow(0 0 18px rgba(56,189,248,.78))",

    glowBranco:
      "drop-shadow(0 0 6px #ffffff) drop-shadow(0 0 16px rgba(255,255,255,.75))",

    contornoBranco:
      "drop-shadow(3px 0 0 #ffffff) drop-shadow(-3px 0 0 #ffffff) drop-shadow(0 3px 0 #ffffff) drop-shadow(0 -3px 0 #ffffff)",

    contornoPreto:
      "drop-shadow(3px 0 0 #020617) drop-shadow(-3px 0 0 #020617) drop-shadow(0 3px 0 #020617) drop-shadow(0 -3px 0 #020617)",

    reflexo:
      "brightness(1.08) contrast(1.08) saturate(1.06) drop-shadow(0 12px 18px rgba(0,0,0,.32))",

    vidro:
      "brightness(1.12) contrast(.92) saturate(.9) drop-shadow(0 10px 20px rgba(125,211,252,.38))",

    metal:
      "grayscale(.22) contrast(1.25) brightness(1.05) drop-shadow(0 14px 18px rgba(0,0,0,.42))",

    neon:
      "contrast(1.15) saturate(1.28) drop-shadow(0 0 8px #22d3ee) drop-shadow(0 0 20px #7c3aed)",
  };

  return [
    selecao,
    efeitos[imagem.efeitoRapido || "nenhum"] ||
      efeitos.nenhum,
  ]
    .filter(Boolean)
    .join(" ");
}

function aplicarTemplateCategoriaIA() {
  const largura = larguraPreviewExportacao;
  const altura = alturaPreviewExportacao;

  const templates = {
    sensor: {
      fundo:
        "linear-gradient(135deg,#020617,#172554 55%,#0891b2)",
      titulo: "SENSOR AUTOMOTIVO PREMIUM",
      subtitulo:
        "PRECISÃO, DESEMPENHO E CONFIANÇA",
      rotacao: 0,
    },

    bico: {
      fundo:
        "radial-gradient(circle at 72% 34%,#2563eb,#0f172a 55%,#020617)",
      titulo: "BICO INJETOR PREMIUM",
      subtitulo:
        "ALTA PERFORMANCE E PULVERIZAÇÃO PRECISA",
      rotacao: -8,
    },

    cabecote: {
      fundo:
        "repeating-linear-gradient(90deg,rgba(255,255,255,.06) 0 1px,transparent 1px 4px),linear-gradient(135deg,#334155,#94a3b8)",
      titulo: "CABEÇOTE AUTOMOTIVO",
      subtitulo:
        "QUALIDADE PROFISSIONAL E ALTA DURABILIDADE",
      rotacao: 0,
    },

    comando: {
      fundo:
        "linear-gradient(135deg,#111827,#374151 55%,#0f172a)",
      titulo: "COMANDO DE VÁLVULAS",
      subtitulo:
        "DESEMPENHO E SINCRONISMO PRECISO",
      rotacao: -12,
    },

    bobina: {
      fundo:
        "linear-gradient(135deg,#172554,#1d4ed8 55%,#22d3ee)",
      titulo: "BOBINA DE IGNIÇÃO",
      subtitulo:
        "PARTIDA RÁPIDA E QUEIMA EFICIENTE",
      rotacao: 4,
    },

    bomba: {
      fundo:
        "linear-gradient(135deg,#450a0a,#991b1b 55%,#ef4444)",
      titulo: "BOMBA AUTOMOTIVA",
      subtitulo:
        "VAZÃO, PRESSÃO E CONFIABILIDADE",
      rotacao: -5,
    },

    sonda: {
      fundo:
        "linear-gradient(135deg,#082f49,#0e7490 55%,#22d3ee)",
      titulo: "SONDA LAMBDA PREMIUM",
      subtitulo:
        "LEITURA PRECISA E MELHOR CONSUMO",
      rotacao: 8,
    },

    palheta: {
      fundo:
        "linear-gradient(135deg,#0f172a,#1e3a8a 55%,#60a5fa)",
      titulo: "PALHETA AUTOMOTIVA",
      subtitulo:
        "VISIBILIDADE E SEGURANÇA EM QUALQUER CLIMA",
      rotacao: -4,
    },

    outro: {
      fundo:
        "linear-gradient(135deg,#020617,#1e293b 55%,#2563eb)",
      titulo: "PEÇA AUTOMOTIVA PREMIUM",
      subtitulo:
        "QUALIDADE, DESEMPENHO E CONFIANÇA",
      rotacao: 0,
    },
  };

  const modelo =
    templates[categoriaTemplateIA] ||
    templates.outro;

  if (!versaoOriginalBanner) {
    setVersaoOriginalBanner(
      capturarEstadoAtualBanner()
    );
  }

  setFundoStudio(modelo.fundo);

  setImagensBanner((anteriores) =>
    anteriores.map((imagem, indice) =>
      imagem.tipo === "logo"
        ? imagem
        : {
            ...imagem,
            x: largura * 0.68 + indice * 42,
            y: altura * 0.57 + indice * 26,
            escala: Math.max(
              0.68,
              1 - indice * 0.1
            ),
            rotacao:
              modelo.rotacao + indice * 4,
            efeitoRapido: "sombra",
          }
    )
  );

  setTextosStudio((anteriores) => {
    const comuns = anteriores.filter(
      (item) => item.tipo !== "selo"
    );

    const selos = anteriores.filter(
      (item) => item.tipo === "selo"
    );

    return [
      {
        ...(comuns[0] || {}),
        id:
          comuns[0]?.id ||
          `titulo-template-${Date.now()}`,
        tipo: "texto",
        texto: modelo.titulo,
        x: largura * 0.28,
        y: altura * 0.28,
        cor: "#ffffff",
        tamanho: 44,
        rotacao: 0,
        alinhamento: "center",
        larguraMaxima: largura * 0.42,
        quebrarLinha: true,
      },

      {
        ...(comuns[1] || {}),
        id:
          comuns[1]?.id ||
          `subtitulo-template-${Date.now()}`,
        tipo: "texto",
        texto: modelo.subtitulo,
        x: largura * 0.28,
        y: altura * 0.4,
        cor: "#e0f2fe",
        tamanho: 22,
        rotacao: 0,
        alinhamento: "center",
        larguraMaxima: largura * 0.4,
        quebrarLinha: true,
      },

      ...comuns.slice(2),
      ...selos,
    ];
  });

  setVersaoBannerAtiva("ia");
}

function melhorarBannerComercialIA() {
  aplicarTemplateCategoriaIA();
  gerarQuatroIdeiasIA();
}

function criarBannerInteligenteCompleto() {
  const produtosAtuais =
    imagensBanner.filter(
      (imagem) =>
        imagem.tipo !== "logo" && imagem.tipo !== "objeto" && imagem.tipo !== "icone"
    );

  if (
    produtosAtuais.length === 0
  ) {
    alert(
      "Adicione pelo menos uma foto do produto."
    );
    return;
  }

  const largura =
    larguraPreviewExportacao;

  const altura =
    alturaPreviewExportacao;

  const configuracoes = {
    sensor: {
      fundo:
        "linear-gradient(135deg,#020617,#172554 54%,#0891b2)",
      titulo:
        "SENSOR AUTOMOTIVO PREMIUM",
      subtitulo:
        "PRECISÃO, DESEMPENHO E CONFIANÇA",
      selo: "Garantia",
      logo: "Torken Auto Parts",
      produtoX: 0.68,
      produtoY: 0.57,
      textoX: 0.28,
      rotacao: 0,
      efeito: "produtoPro",
    },

    bico: {
      fundo:
        "radial-gradient(circle at 72% 34%,#2563eb,#0f172a 56%,#020617)",
      titulo:
        "BICO INJETOR PREMIUM",
      subtitulo:
        "ALTA PERFORMANCE E PULVERIZAÇÃO PRECISA",
      selo: "Premium",
      logo: "Torken Auto Parts",
      produtoX: 0.69,
      produtoY: 0.57,
      textoX: 0.27,
      rotacao: -7,
      efeito: "produtoPro",
    },

    cabecote: {
      fundo:
        "repeating-linear-gradient(90deg,rgba(255,255,255,.06) 0 1px,transparent 1px 4px),linear-gradient(135deg,#1e293b,#64748b,#0f172a)",
      titulo:
        "CABEÇOTE AUTOMOTIVO",
      subtitulo:
        "QUALIDADE PROFISSIONAL E ALTA DURABILIDADE",
      selo: "Produto Novo",
      logo: "Casa da Injeção",
      produtoX: 0.68,
      produtoY: 0.58,
      textoX: 0.28,
      rotacao: 0,
      efeito: "metal",
    },

    comando: {
      fundo:
        "linear-gradient(135deg,#09090b,#374151 55%,#0f172a)",
      titulo:
        "COMANDO DE VÁLVULAS",
      subtitulo:
        "DESEMPENHO E SINCRONISMO PRECISO",
      selo: "Original",
      logo: "Casa da Injeção",
      produtoX: 0.69,
      produtoY: 0.57,
      textoX: 0.28,
      rotacao: -10,
      efeito: "produtoPro",
    },

    bobina: {
      fundo:
        "linear-gradient(135deg,#172554,#1d4ed8 55%,#22d3ee)",
      titulo:
        "BOBINA DE IGNIÇÃO",
      subtitulo:
        "PARTIDA RÁPIDA E QUEIMA EFICIENTE",
      selo: "Pronta Entrega",
      logo: "Torken Auto Parts",
      produtoX: 0.7,
      produtoY: 0.57,
      textoX: 0.27,
      rotacao: 4,
      efeito: "produtoPro",
    },

    bomba: {
      fundo:
        "linear-gradient(135deg,#450a0a,#991b1b 55%,#ef4444)",
      titulo:
        "BOMBA AUTOMOTIVA",
      subtitulo:
        "VAZÃO, PRESSÃO E CONFIABILIDADE",
      selo: "Envio Imediato",
      logo: "Torken Auto Parts",
      produtoX: 0.69,
      produtoY: 0.57,
      textoX: 0.27,
      rotacao: -5,
      efeito: "produtoPro",
    },

    sonda: {
      fundo:
        "linear-gradient(135deg,#082f49,#0e7490 55%,#22d3ee)",
      titulo:
        "SONDA LAMBDA PREMIUM",
      subtitulo:
        "LEITURA PRECISA E MELHOR CONSUMO",
      selo: "Garantia",
      logo: "Torken Auto Parts",
      produtoX: 0.7,
      produtoY: 0.58,
      textoX: 0.27,
      rotacao: 8,
      efeito: "produtoPro",
    },

    palheta: {
      fundo:
        "linear-gradient(135deg,#0f172a,#1e3a8a 55%,#60a5fa)",
      titulo:
        "PALHETA AUTOMOTIVA",
      subtitulo:
        "VISIBILIDADE E SEGURANÇA EM QUALQUER CLIMA",
      selo: "Produto Novo",
      logo: "Casa da Injeção",
      produtoX: 0.68,
      produtoY: 0.58,
      textoX: 0.28,
      rotacao: -4,
      efeito: "produtoPro",
    },

    outro: {
      fundo:
        "linear-gradient(135deg,#020617,#1e293b 55%,#2563eb)",
      titulo:
        "PEÇA AUTOMOTIVA PREMIUM",
      subtitulo:
        "QUALIDADE, DESEMPENHO E CONFIANÇA",
      selo: "Premium",
      logo: "APPIA AI",
      produtoX: 0.69,
      produtoY: 0.57,
      textoX: 0.27,
      rotacao: 0,
      efeito: "produtoPro",
    },
  };

  const configuracao =
    configuracoes[
      categoriaTemplateIA
    ] ||
    configuracoes.outro;

  if (!versaoOriginalBanner) {
    setVersaoOriginalBanner(
      capturarEstadoAtualBanner()
    );
  }

  const instante = Date.now();

  const imagensProduto =
    produtosAtuais.map(
      (imagem, indice) => ({
        ...imagem,

        x:
          largura *
            configuracao.produtoX +
          indice * 42,

        y:
          altura *
            configuracao.produtoY +
          indice * 28,

        escala: Math.max(
          0.66,
          Math.min(
            1.22,
            1.04 - indice * 0.1
          )
        ),

        rotacao:
          configuracao.rotacao +
          indice * 4,

        efeitoRapido:
          configuracao.efeito,

        origemIA:
          "compositora",
      })
    );

  const logoModelo =
    LOGOS_STUDIO.find(
      (logo) =>
        logo.nome ===
        configuracao.logo
    ) ||
    LOGOS_STUDIO[0];

  const logoId =
    `logo-ia-${instante}`;

  const logoAutomatico = {
    id: logoId,
    src: logoModelo.src,
    nome: logoModelo.nome,
    x: largura * 0.82,
    y: altura * 0.1,
    escala: 0.68,
    rotacao: 0,
    tipo: "logo",
    efeitoRapido: "sombra",
    origemIA: "compositora",
  };

  const imagensManuais =
    imagensBanner.filter(
      (imagem) =>
        imagem.tipo === "logo" &&
        imagem.origemIA !==
          "compositora"
    );

  const novasImagens = [
    ...imagensProduto,
    ...imagensManuais,
    logoAutomatico,
  ];

  const seloModelo =
    SELOS_STUDIO.find(
      (selo) =>
        selo.nome ===
        configuracao.selo
    ) ||
    SELOS_STUDIO[0];

  const tituloId =
    `titulo-ia-${instante}`;

  const subtituloId =
    `subtitulo-ia-${instante}`;

  const seloId =
    `selo-ia-${instante}`;

  const textosManuais =
    textosStudio.filter(
      (item) =>
        item.origemIA !==
          "compositora" &&
        item.tipo === "selo"
    );

  const novosTextos = [
    {
      id: tituloId,
      tipo: "texto",
      texto:
        configuracao.titulo,
      x:
        largura *
        configuracao.textoX,
      y: altura * 0.25,
      cor: "#ffffff",
      tamanho: 46,
      fonte: "Arial",
      negrito: true,
      italico: false,
      sublinhado: false,
      sombra: true,
      alinhamento: "center",
      larguraMaxima:
        largura * 0.43,
      quebrarLinha: true,
      rotacao: 0,
      origemIA: "compositora",
    },

    {
      id: subtituloId,
      tipo: "texto",
      texto:
        configuracao.subtitulo,
      x:
        largura *
        configuracao.textoX,
      y: altura * 0.39,
      cor: "#e0f2fe",
      tamanho: 22,
      fonte: "Arial",
      negrito: true,
      italico: false,
      sublinhado: false,
      sombra: true,
      alinhamento: "center",
      larguraMaxima:
        largura * 0.4,
      quebrarLinha: true,
      rotacao: 0,
      origemIA: "compositora",
    },

    {
      id: seloId,
      tipo: "selo",
      texto: seloModelo.texto,
      x: largura * 0.26,
      y: altura * 0.68,
      cor:
        seloModelo.corTexto ||
        "#ffffff",
      fundo:
        seloModelo.fundo ||
        "#2563eb",
      bordaSelo:
        seloModelo.borda ||
        "rgba(255,255,255,.88)",
      formatoSelo:
        seloModelo.formato ||
        "capsula",
      tamanho:
        seloModelo.tamanho ||
        18,
      negrito: true,
      sombra: true,
      rotacao: -2,
      origemIA: "compositora",
    },

    ...textosManuais,
  ];

  const idsAtivos =
    new Set([
      ...novasImagens.map(
        (item) => item.id
      ),
      ...novosTextos.map(
        (item) => item.id
      ),
    ]);

  const camadasManuais =
    camadasStudio.filter(
      (camada) =>
        idsAtivos.has(
          camada.id
        ) &&
        !String(
          camada.id
        ).includes("-ia-")
    );

  const novasCamadas = [
    ...novasImagens.map(
      (imagem, indice) => ({
        id: imagem.id,
        nome:
          imagem.tipo === "logo"
            ? `🖼️ ${
                imagem.nome ||
                "Logo"
              }`
            : `📦 Produto ${
                indice + 1
              }`,
        tipo:
          imagem.tipo === "logo"
            ? "logo"
            : "produto",
        visivel: true,
        bloqueado: false,
      })
    ),

    {
      id: tituloId,
      nome: "📝 Título IA",
      tipo: "texto",
      visivel: true,
      bloqueado: false,
    },

    {
      id: subtituloId,
      nome: "📝 Subtítulo IA",
      tipo: "texto",
      visivel: true,
      bloqueado: false,
    },

    {
      id: seloId,
      nome:
        `⭐ ${seloModelo.nome}`,
      tipo: "texto",
      visivel: true,
      bloqueado: false,
    },

    ...camadasManuais.filter(
      (camada) =>
        ![
          tituloId,
          subtituloId,
          seloId,
        ].includes(camada.id)
    ),
  ];

  setFundoStudio(
    configuracao.fundo
  );

  setImagensBanner(
    novasImagens
  );

  setTextosStudio(
    novosTextos
  );

  setCamadasStudio(
    novasCamadas
  );

  setVersaoBannerAtiva("ia");
  setIdeiaBannerSelecionada(null);
  setElementoSelecionado(
    tituloId
  );
  setImagemSelecionadaId(null);
  setTextoArrastando(null);
  setImagemArrastandoId(null);
  setFerramentaStudio("finalizar");

  setAnaliseBannerIA({
    pontuacao: 96,
    melhorias: [],
    corrigido: [
      "Fundo escolhido",
      "Produto posicionado",
      "Título criado",
      "Subtítulo criado",
      "Selo inserido",
      "Logo inserido",
      "Contraste otimizado",
      "Composição alinhada",
    ],
  });

  gerarQuatroIdeiasIA();

  alert(
    "✅ Banner inteligente criado. Revise os textos e faça os ajustes finais."
  );
}

async function abrirPreviewMarketplace() {
  const canvas = document.getElementById(
    "banner-prancheta-exportavel"
  );

  if (!canvas) {
    alert("Prancheta não encontrada.");
    return;
  }

  try {
    setGerandoPreviewMarketplace(true);
    setElementoSelecionado(null);
    setImagemSelecionadaId(null);

    await new Promise((resolve) =>
      setTimeout(resolve, 100)
    );

    const imagem = await htmlToImage.toPng(
      canvas,
      {
        cacheBust: true,
        pixelRatio: 1,
        backgroundColor:
          fundoStudio === "transparent"
            ? "#ffffff"
            : undefined,
        filter: (no) =>
          no?.getAttribute?.(
            "data-nao-exportar"
          ) !== "true",
      }
    );

    setPreviewMarketplaceImagem(imagem);
    setPreviewMarketplaceAberto(true);
  } catch (erro) {
    console.error("ERRO PREVIEW:", erro);
    alert("Não foi possível gerar o preview.");
  } finally {
    setGerandoPreviewMarketplace(false);
  }
}

const fundosStudio = [
  {
    nome: "Branco",
    valor: "#ffffff",
  },
  {
    nome: "Preto",
    valor: "#020617",
  },
  {
    nome: "Azul",
    valor: "#2563eb",
  },
  {
    nome: "Vermelho",
    valor: "#dc2626",
  },
  {
    nome: "Amarelo",
    valor: "#facc15",
  },
  {
    nome: "Cinza",
    valor: "#64748b",
  },

  {
    nome: "Azul Premium",
    valor:
      "linear-gradient(135deg,#0f172a,#2563eb)",
  },

  {
    nome: "Cinza Metálico",
    valor:
      "linear-gradient(135deg,#1e293b,#94a3b8)",
  },

  {
    nome: "Vermelho Performance",
    valor:
      "linear-gradient(135deg,#7f1d1d,#ef4444)",
  },

  {
    nome: "Amarelo Racing",
    valor:
      "linear-gradient(135deg,#ca8a04,#fde047)",
  },

  {
    nome: "Azul Ciano",
    valor:
      "linear-gradient(135deg,#1e3a8a,#22d3ee)",
  },

  {
    nome: "Grafite",
    valor:
      "linear-gradient(135deg,#111827,#374151)",
  },
  {
    nome: "Fibra Carbono Clássica",
    valor:
      "repeating-linear-gradient(45deg, rgba(255,255,255,.08) 0 4px, transparent 4px 10px), repeating-linear-gradient(-45deg, rgba(255,255,255,.04) 0 4px, transparent 4px 10px), linear-gradient(135deg,#050505,#18181b,#020202)",
  },
  {
    nome: "Carbono Azul",
    valor:
      "repeating-linear-gradient(45deg, rgba(59,130,246,.20) 0 4px, transparent 4px 10px), repeating-linear-gradient(-45deg, rgba(255,255,255,.05) 0 4px, transparent 4px 10px), linear-gradient(135deg,#020617,#172554,#030712)",
  },
  {
    nome: "Carbono Prata",
    valor:
      "repeating-linear-gradient(45deg, rgba(255,255,255,.18) 0 3px, transparent 3px 9px), repeating-linear-gradient(-45deg, rgba(15,23,42,.22) 0 3px, transparent 3px 9px), linear-gradient(135deg,#334155,#94a3b8,#1e293b)",
  },
  {
    nome: "Carbono Vermelho",
    valor:
      "repeating-linear-gradient(45deg, rgba(239,68,68,.22) 0 4px, transparent 4px 10px), repeating-linear-gradient(-45deg, rgba(255,255,255,.05) 0 4px, transparent 4px 10px), linear-gradient(135deg,#180606,#7f1d1d,#09090b)",
  },
  {
    nome: "Carbono Dourado",
    valor:
      "repeating-linear-gradient(45deg, rgba(250,204,21,.22) 0 4px, transparent 4px 10px), repeating-linear-gradient(-45deg, rgba(255,255,255,.05) 0 4px, transparent 4px 10px), linear-gradient(135deg,#1c1403,#713f12,#09090b)",
  },
  {
    nome: "Carbono Ciano",
    valor:
      "repeating-linear-gradient(45deg, rgba(34,211,238,.20) 0 4px, transparent 4px 10px), repeating-linear-gradient(-45deg, rgba(255,255,255,.05) 0 4px, transparent 4px 10px), linear-gradient(135deg,#042f2e,#155e75,#020617)",
  },

  {
    nome: "Carbono Azul Premium",
    valor:
      "repeating-linear-gradient(45deg,rgba(59,130,246,.16) 0 4px,transparent 4px 10px),repeating-linear-gradient(-45deg,rgba(255,255,255,.04) 0 4px,transparent 4px 10px),linear-gradient(135deg,#020617,#172554)",
  },
  {
    nome: "Carbono Vermelho",
    valor:
      "repeating-linear-gradient(45deg,rgba(239,68,68,.14) 0 4px,transparent 4px 10px),repeating-linear-gradient(-45deg,rgba(255,255,255,.035) 0 4px,transparent 4px 10px),linear-gradient(135deg,#09090b,#450a0a)",
  },
  {
    nome: "Metal Titânio",
    valor:
      "repeating-linear-gradient(90deg,rgba(255,255,255,.08) 0 1px,transparent 1px 3px),linear-gradient(135deg,#1e293b,#94a3b8,#334155)",
  },
  {
    nome: "Azul Bosch",
    valor:
      "radial-gradient(circle at 75% 20%,rgba(34,211,238,.4),transparent 28%),linear-gradient(135deg,#020617,#172554,#1d4ed8)",
  },
  {
    nome: "Marelli Performance",
    valor:
      "linear-gradient(120deg,transparent 0 58%,rgba(255,255,255,.12) 58% 62%,transparent 62%),linear-gradient(135deg,#09090b,#7f1d1d,#dc2626)",
  },
  {
    nome: "Turbo Neon",
    valor:
      "radial-gradient(circle at 50% 100%,rgba(34,211,238,.58),transparent 42%),linear-gradient(135deg,#020617,#312e81,#0e7490)",
  },
  {
    nome: "Luxury Gold",
    valor:
      "radial-gradient(circle at 75% 25%,rgba(253,224,71,.38),transparent 30%),linear-gradient(135deg,#09090b,#422006,#a16207)",
  },
  {
    nome: "Instagram Purple",
    valor:
      "radial-gradient(circle at 15% 85%,#f59e0b,transparent 32%),radial-gradient(circle at 85% 15%,#ec4899,transparent 34%),linear-gradient(135deg,#7c3aed,#312e81)",
  },
  {
    nome: "WhatsApp Green",
    valor:
      "radial-gradient(circle at 80% 20%,rgba(134,239,172,.35),transparent 32%),linear-gradient(135deg,#052e16,#15803d,#22c55e)",
  }
];

const SELOS_STUDIO = [
  {
    nome: "Produto Novo",
    texto: "✓ PRODUTO NOVO",
    fundo:
      "linear-gradient(135deg,#15803d,#22c55e)",
    corTexto: "#ffffff",
    borda: "#bbf7d0",
    formato: "capsula",
    tamanho: 18,
  },
  {
    nome: "Premium",
    texto: "★ PREMIUM",
    fundo:
      "linear-gradient(135deg,#78350f,#f59e0b)",
    corTexto: "#fff7ed",
    borda: "#fde68a",
    formato: "escudo",
    tamanho: 20,
  },
  {
    nome: "Envio Imediato",
    texto: "🚚 ENVIO IMEDIATO",
    fundo:
      "linear-gradient(135deg,#1d4ed8,#06b6d4)",
    corTexto: "#ffffff",
    borda: "#bae6fd",
    formato: "capsula",
    tamanho: 17,
  },
  {
    nome: "Garantia",
    texto: "🛡 GARANTIA",
    fundo:
      "linear-gradient(135deg,#0f766e,#14b8a6)",
    corTexto: "#ffffff",
    borda: "#99f6e4",
    formato: "escudo",
    tamanho: 19,
  },
  {
    nome: "Original",
    texto: "◆ ORIGINAL",
    fundo:
      "linear-gradient(135deg,#5b21b6,#8b5cf6)",
    corTexto: "#ffffff",
    borda: "#ddd6fe",
    formato: "premium",
    tamanho: 19,
  },
  {
    nome: "Oferta",
    texto: "🔥 OFERTA",
    fundo:
      "linear-gradient(135deg,#991b1b,#ef4444)",
    corTexto: "#ffffff",
    borda: "#fecaca",
    formato: "impacto",
    tamanho: 22,
  },
  {
    nome: "Promoção",
    texto: "💥 PROMOÇÃO",
    fundo:
      "linear-gradient(135deg,#be123c,#f97316)",
    corTexto: "#ffffff",
    borda: "#fed7aa",
    formato: "impacto",
    tamanho: 21,
  },
  {
    nome: "Frete Grátis",
    texto: "📦 FRETE GRÁTIS",
    fundo:
      "linear-gradient(135deg,#0369a1,#0ea5e9)",
    corTexto: "#ffffff",
    borda: "#bae6fd",
    formato: "capsula",
    tamanho: 18,
  },
  {
    nome: "Pronta Entrega",
    texto: "⚡ PRONTA ENTREGA",
    fundo:
      "linear-gradient(135deg,#c2410c,#f97316)",
    corTexto: "#ffffff",
    borda: "#fed7aa",
    formato: "capsula",
    tamanho: 17,
  },
  {
    nome: "Produto Nacional",
    texto: "🇧🇷 PRODUTO NACIONAL",
    fundo:
      "linear-gradient(135deg,#166534,#eab308)",
    corTexto: "#ffffff",
    borda: "#fef08a",
    formato: "faixa",
    tamanho: 16,
  },
  {
    nome: "Importado",
    texto: "🌎 IMPORTADO",
    fundo:
      "linear-gradient(135deg,#075985,#2563eb)",
    corTexto: "#ffffff",
    borda: "#bfdbfe",
    formato: "premium",
    tamanho: 18,
  },
  {
    nome: "Estoque Imediato",
    texto: "📦 ESTOQUE IMEDIATO",
    fundo:
      "linear-gradient(135deg,#334155,#64748b)",
    corTexto: "#ffffff",
    borda: "#cbd5e1",
    formato: "faixa",
    tamanho: 16,
  },
];
  useEffect(() => {
  const urlNovaImagem =
    localStorage.getItem(
      "imagemBannerSelecionada"
    );

  if (!urlNovaImagem) {
    return;
  }

  setImagensBanner((anteriores) => {
    const novaImagem = {
      id: `${Date.now()}-${Math.random()}`,
      src: urlNovaImagem,
      x: 450 + anteriores.length * 40,
      y: 300 + anteriores.length * 40,
      rotacao: 0,
      escala: 1,
      tipo: "produto",
    };

    setImagemSelecionadaId(
      novaImagem.id
    );

    setElementoSelecionado(
      novaImagem.id
    );

    setCamadasStudio((camadas) => [
      ...camadas,
      {
        id: novaImagem.id,
        nome: `📦 Produto ${
          camadas.filter(
            (camada) =>
              camada.tipo === "produto"
          ).length + 1
        }`,
        tipo: "produto",
      },
    ]);

    return [
      ...anteriores,
      novaImagem,
    ];
  });

  localStorage.removeItem(
    "imagemBannerSelecionada"
  );

  localStorage.removeItem(
    "abrirBannerAutomatico"
  );
});
    useEffect(() => {
  if (restaurandoHistorico) {
    setRestaurandoHistorico(false);
    return;
  }

  setHistoricoBanner((anterior) => [
    ...anterior.slice(-29),
    {
      imagensBanner,
      textosStudio,
      camadasStudio,
    },
  ]);
}, [
  imagensBanner,
  textosStudio,
  camadasStudio,
  restaurandoHistorico,
]);
  const modeloSelecionado =
    modelosPremiumBanner.find(
      (modelo) =>
        modelo.id ===
        modeloPremiumBanner
    ) ||
    modelosPremiumBanner[0] ||
    null;
const botaoMenuStudio = {
  width: "100%",
  padding: "11px 8px",
  marginBottom: "8px",
  borderRadius: "12px",
  border: "1px solid #334155",
  background: "#1e293b",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "13px",
};
  function selecionarModelo(modelo) {
    setModeloPremiumBanner(
      modelo.id
    );

    if (
      modelo.id ===
      "mercado_livre"
    ) {
      setFundoBanner("branco");
      setTamanhoBanner(
        "1200x1200"
      );
      return;
    }

    if (
      modelo.id === "shopee" ||
      modelo.id === "amazon" ||
      modelo.id === "normal"
    ) {
      setTamanhoBanner(
        "1200x1200"
      );
      return;
    }

    if (
      modelo.id === "instagram"
    ) {
      setTamanhoBanner(
        "1080x1920"
      );
      return;
    }

    if (
      modelo.id === "whatsapp"
    ) {
      setTamanhoBanner(
        "1920x1080"
      );
    }
  }

  function obterBeneficios() {
    if (
      modeloPremiumBanner ===
      "mercado_livre"
    ) {
      return [
        "Fundo branco",
        "Produto centralizado",
        "Formato 1200x1200",
        "Composição limpa",
      ];
    }

    if (
      modeloPremiumBanner ===
      "shopee"
    ) {
      return [
        "Formato quadrado",
        "Produto em destaque",
        "Boa visualização no celular",
        "Preparado para Shopee",
      ];
    }

    if (
      modeloPremiumBanner ===
      "amazon"
    ) {
      return [
        "Fundo branco",
        "Produto ocupando o quadro",
        "Alta resolução",
        "Composição objetiva",
      ];
    }

    if (
      modeloPremiumBanner ===
      "instagram"
    ) {
      return [
        "Formato para redes sociais",
        "Produto em destaque",
        "Visual para celular",
        "Boa leitura no feed",
      ];
    }

    if (
      modeloPremiumBanner ===
      "whatsapp"
    ) {
      return [
        "Formato horizontal",
        "Leitura rápida",
        "Ideal para compartilhamento",
        "Produto bem destacado",
      ];
    }

    return [
      "Layout limpo",
      "Produto em destaque",
      "Alta resolução",
      "Uso geral",
    ];
  }

function abrirClip() {
  if (!resultadoIA) {
    return;
  }

  localStorage.setItem(
    "imagemClipSelecionada",
    resultadoIA
  );

  localStorage.setItem(
    "abrirClipAutomatico",
    "true"
  );

  setScreen("clip");
}

function abrirNovoAnuncio() {
  if (resultadoIA) {
    localStorage.setItem(
      "bannerPronto",
      resultadoIA
    );

    try {
      const projetoSalvo =
        localStorage.getItem(
          "projetoAppiaAtual"
        );

      const projetoAtual =
        projetoSalvo
          ? JSON.parse(projetoSalvo)
          : null;

      if (projetoAtual) {
        const projetoAtualizado = {
          ...projetoAtual,
          banner_pronto: true,
          banner_url: resultadoIA,
          updated_at:
            new Date().toISOString(),
        };

        localStorage.setItem(
          "projetoAppiaAtual",
          JSON.stringify(
            projetoAtualizado
          )
        );
      }
    } catch (erro) {
      console.error(
        "Erro ao atualizar o projeto com o Banner IA:",
        erro
      );
    }
  }

  setScreen("novoAnuncio");
}

const beneficios =
  obterBeneficios();
  
function moverCamada(camadaId, direcao) {
  setCamadasStudio((anteriores) => {
    const lista = [...anteriores];
    const indice = lista.findIndex(
      (camada) => camada.id === camadaId
    );

    if (indice === -1) {
      return anteriores;
    }

    const novoIndice =
      direcao === "subir"
        ? indice + 1
        : indice - 1;

    if (
      novoIndice < 0 ||
      novoIndice >= lista.length
    ) {
      return anteriores;
    }

    const [camadaMovida] = lista.splice(
      indice,
      1
    );

    lista.splice(
      novoIndice,
      0,
      camadaMovida
    );

    return lista;
  });
}

function excluirCamada(camada) {
  if (camada.tipo === "texto") {
    setTextosStudio((anteriores) =>
      anteriores.filter(
        (texto) => texto.id !== camada.id
      )
    );
  }

  if (
    camada.tipo === "produto" ||
    camada.tipo === "logo"
  ) {
    setImagensBanner((anteriores) =>
      anteriores.filter(
        (imagem) => imagem.id !== camada.id
      )
    );

    if (camada.tipo === "produto") {
      setImagemBanner("");
    }

    if (imagemSelecionadaId === camada.id) {
      setImagemSelecionadaId(null);
      setImagemArrastandoId(null);
    }
  }

  setCamadasStudio((anteriores) =>
    anteriores.filter(
      (item) => item.id !== camada.id
    )
  );

  if (elementoSelecionado === camada.id) {
    setElementoSelecionado(null);
  }
}
function alternarVisibilidadeCamada(camadaId) {
  setCamadasStudio((anteriores) =>
    anteriores.map((camada) =>
      camada.id === camadaId
        ? {
            ...camada,
            visivel: camada.visivel === false,
          }
        : camada
    )
  );

  if (elementoSelecionado === camadaId) {
    setElementoSelecionado(null);
    setImagemSelecionadaId(null);
    setTextoArrastando(null);
    setImagemArrastandoId(null);
  }
}

function alternarBloqueioCamada(camadaId) {
  setCamadasStudio((anteriores) =>
    anteriores.map((camada) =>
      camada.id === camadaId
        ? {
            ...camada,
            bloqueado: !camada.bloqueado,
          }
        : camada
    )
  );

  if (elementoSelecionado === camadaId) {
    setElementoSelecionado(null);
    setImagemSelecionadaId(null);
    setTextoArrastando(null);
    setImagemArrastandoId(null);
  }
}

function iniciarRotacaoProduto(evento) {
  evento.preventDefault();
  evento.stopPropagation();

  setArrastando(false);

  const inicioX = evento.clientX;
  const rotacaoInicial = rotacaoProduto;

  function mover(eventoMovimento) {
    const diferenca =
      eventoMovimento.clientX - inicioX;

    setRotacaoProduto(
      rotacaoInicial + diferenca
    );
  }

  function finalizar() {
    window.removeEventListener(
      "mousemove",
      mover
    );

    window.removeEventListener(
      "mouseup",
      finalizar
    );
  }

  window.addEventListener(
    "mousemove",
    mover
  );

  window.addEventListener(
    "mouseup",
    finalizar
  );
}
function iniciarRedimensionamentoTexto(
  evento,
  item,
  direcao = "sudeste"
) {
  evento.preventDefault();
  evento.stopPropagation();

  setTextoArrastando(null);

  const inicioX =
    evento.clientX;

  const inicioY =
    evento.clientY;

  const tamanhoInicial =
    Number(item.tamanho) || 38;

  const usaHorizontal =
    [
      "leste",
      "oeste",
      "nordeste",
      "noroeste",
      "sudeste",
      "sudoeste",
    ].includes(direcao);

  const usaVertical =
    [
      "norte",
      "sul",
      "nordeste",
      "noroeste",
      "sudeste",
      "sudoeste",
    ].includes(direcao);

  const sinalX =
    [
      "oeste",
      "noroeste",
      "sudoeste",
    ].includes(direcao)
      ? -1
      : 1;

  const sinalY =
    [
      "norte",
      "noroeste",
      "nordeste",
    ].includes(direcao)
      ? -1
      : 1;

  function mover(
    eventoMovimento
  ) {
    const diferencaX =
      (
        eventoMovimento.clientX -
        inicioX
      ) *
      sinalX;

    const diferencaY =
      (
        eventoMovimento.clientY -
        inicioY
      ) *
      sinalY;

    const diferenca =
      usaHorizontal &&
      usaVertical
        ? (
            diferencaX +
            diferencaY
          ) /
          2
        : usaHorizontal
          ? diferencaX
          : diferencaY;

    const novoTamanho =
      tamanhoInicial +
      diferenca / 3;

    setTextosStudio(
      (anteriores) =>
        anteriores.map(
          (texto) =>
            texto.id === item.id
              ? {
                  ...texto,
                  tamanho:
                    Math.min(
                      140,
                      Math.max(
                        12,
                        novoTamanho
                      )
                    ),
                }
              : texto
        )
    );
  }

  function finalizar() {
    window.removeEventListener(
      "mousemove",
      mover
    );

    window.removeEventListener(
      "mouseup",
      finalizar
    );
  }

  window.addEventListener(
    "mousemove",
    mover
  );

  window.addEventListener(
    "mouseup",
    finalizar
  );
}

function iniciarRotacaoTexto(
  evento,
  item
) {
  evento.preventDefault();
  evento.stopPropagation();

  setTextoArrastando(null);

  const prancheta =
    document.getElementById(
      "banner-prancheta-exportavel"
    );

  if (!prancheta) {
    return;
  }

  const rect =
    prancheta.getBoundingClientRect();

  const escalaX =
    rect.width /
    larguraPreviewExportacao;

  const escalaY =
    rect.height /
    alturaPreviewExportacao;

  const centroX =
    rect.left +
    (Number(item.x) || 0) *
      escalaX;

  const centroY =
    rect.top +
    (Number(item.y) || 0) *
      escalaY;

  const anguloMouseInicial =
    Math.atan2(
      evento.clientY - centroY,
      evento.clientX - centroX
    ) *
    (180 / Math.PI);

  const rotacaoInicial =
    Number(item.rotacao) || 0;

  function mover(
    eventoMovimento
  ) {
    const anguloMouseAtual =
      Math.atan2(
        eventoMovimento.clientY -
          centroY,
        eventoMovimento.clientX -
          centroX
      ) *
      (180 / Math.PI);

    let novaRotacao =
      rotacaoInicial +
      (
        anguloMouseAtual -
        anguloMouseInicial
      );

    if (
      eventoMovimento.shiftKey
    ) {
      novaRotacao =
        Math.round(
          novaRotacao / 15
        ) * 15;
    }

    novaRotacao =
      (
        (
          novaRotacao %
          360
        ) +
        360
      ) %
      360;

    setTextosStudio(
      (anteriores) =>
        anteriores.map(
          (texto) =>
            texto.id === item.id
              ? {
                  ...texto,
                  rotacao:
                    novaRotacao,
                }
              : texto
        )
    );
  }

  function finalizar() {
    window.removeEventListener(
      "mousemove",
      mover
    );

    window.removeEventListener(
      "mouseup",
      finalizar
    );
  }

  window.addEventListener(
    "mousemove",
    mover
  );

  window.addEventListener(
    "mouseup",
    finalizar
  );
}

function iniciarRedimensionamentoImagem(
  evento,
  imagem,
  direcao = "sudeste"
) {
  evento.preventDefault();
  evento.stopPropagation();

  setImagemArrastandoId(null);

  const inicioX =
    evento.clientX;

  const inicioY =
    evento.clientY;

  const escalaInicial =
    Number(imagem.escala) || 1;

  const usaHorizontal =
    [
      "leste",
      "oeste",
      "nordeste",
      "noroeste",
      "sudeste",
      "sudoeste",
    ].includes(direcao);

  const usaVertical =
    [
      "norte",
      "sul",
      "nordeste",
      "noroeste",
      "sudeste",
      "sudoeste",
    ].includes(direcao);

  const sinalX =
    [
      "oeste",
      "noroeste",
      "sudoeste",
    ].includes(direcao)
      ? -1
      : 1;

  const sinalY =
    [
      "norte",
      "noroeste",
      "nordeste",
    ].includes(direcao)
      ? -1
      : 1;

  function mover(
    eventoMovimento
  ) {
    const diferencaX =
      (
        eventoMovimento.clientX -
        inicioX
      ) *
      sinalX;

    const diferencaY =
      (
        eventoMovimento.clientY -
        inicioY
      ) *
      sinalY;

    const diferenca =
      usaHorizontal &&
      usaVertical
        ? (
            diferencaX +
            diferencaY
          ) /
          2
        : usaHorizontal
          ? diferencaX
          : diferencaY;

    const novaEscala =
      Math.min(
        2.5,
        Math.max(
          0.25,
          escalaInicial +
            diferenca / 260
        )
      );

    setImagensBanner(
      (anteriores) =>
        anteriores.map(
          (item) =>
            item.id ===
            imagem.id
              ? {
                  ...item,
                  escala:
                    novaEscala,
                }
              : item
        )
    );
  }

  function finalizar() {
    window.removeEventListener(
      "mousemove",
      mover
    );

    window.removeEventListener(
      "mouseup",
      finalizar
    );
  }

  window.addEventListener(
    "mousemove",
    mover
  );

  window.addEventListener(
    "mouseup",
    finalizar
  );
}

function iniciarRotacaoImagem(
  evento,
  imagem
) {
  evento.preventDefault();
  evento.stopPropagation();

  setImagemArrastandoId(null);

  const prancheta =
    document.getElementById(
      "banner-prancheta-exportavel"
    );

  if (!prancheta) {
    return;
  }

  const rect =
    prancheta.getBoundingClientRect();

  const escalaX =
    rect.width /
    larguraPreviewExportacao;

  const escalaY =
    rect.height /
    alturaPreviewExportacao;

  const centroX =
    rect.left +
    (Number(imagem.x) || 0) *
      escalaX;

  const centroY =
    rect.top +
    (Number(imagem.y) || 0) *
      escalaY;

  const anguloMouseInicial =
    Math.atan2(
      evento.clientY - centroY,
      evento.clientX - centroX
    ) *
    (180 / Math.PI);

  const rotacaoInicial =
    Number(imagem.rotacao) || 0;

  function mover(
    eventoMovimento
  ) {
    const anguloMouseAtual =
      Math.atan2(
        eventoMovimento.clientY -
          centroY,
        eventoMovimento.clientX -
          centroX
      ) *
      (180 / Math.PI);

    let novaRotacao =
      rotacaoInicial +
      (
        anguloMouseAtual -
        anguloMouseInicial
      );

    if (
      eventoMovimento.shiftKey
    ) {
      novaRotacao =
        Math.round(
          novaRotacao / 15
        ) * 15;
    }

    novaRotacao =
      (
        (
          novaRotacao %
          360
        ) +
        360
      ) %
      360;

    setImagensBanner(
      (anteriores) =>
        anteriores.map(
          (item) =>
            item.id === imagem.id
              ? {
                  ...item,
                  rotacao:
                    novaRotacao,
                }
              : item
        )
    );
  }

  function finalizar() {
    window.removeEventListener(
      "mousemove",
      mover
    );

    window.removeEventListener(
      "mouseup",
      finalizar
    );
  }

  window.addEventListener(
    "mousemove",
    mover
  );

  window.addEventListener(
    "mouseup",
    finalizar
  );
}

function iniciarEdicaoDiretaTexto(
  evento,
  item
) {
  if (item.tipo === "selo") {
    return;
  }

  evento.preventDefault();
  evento.stopPropagation();

  cancelarEdicaoTextoRef.current =
    false;

  setArrastando(false);
  setTextoArrastando(null);
  setImagemArrastandoId(null);
  setElementoSelecionado(item.id);
  setTextoAntesEdicao(
    String(item.texto || "")
  );
  setEditandoTextoId(item.id);

  setTimeout(() => {
    const editor = document.querySelector(
      `[data-editor-texto-id="${item.id}"]`
    );

    editor?.focus();

    const selecao =
      window.getSelection?.();

    if (editor && selecao) {
      const faixa =
        document.createRange();

      faixa.selectNodeContents(editor);
      selecao.removeAllRanges();
      selecao.addRange(faixa);
    }
  }, 0);
}

function finalizarEdicaoDiretaTexto(
  evento,
  item
) {
  if (editandoTextoId !== item.id) {
    return;
  }

  const cancelou =
    cancelarEdicaoTextoRef.current;

  const textoDigitado = String(
    evento.currentTarget.innerText || ""
  ).trim();

  const textoFinal = cancelou
    ? textoAntesEdicao
    : textoDigitado || textoAntesEdicao;

  setTextosStudio((anteriores) =>
    anteriores.map((texto) =>
      texto.id === item.id
        ? {
            ...texto,
            texto: textoFinal,
          }
        : texto
    )
  );

  setTituloStudio(textoFinal);
  setEditandoTextoId(null);
  setTextoAntesEdicao("");
  cancelarEdicaoTextoRef.current =
    false;
}

function controlarTeclaEdicaoTexto(
  evento
) {
  if (evento.key === "Escape") {
    evento.preventDefault();
    evento.stopPropagation();

    cancelarEdicaoTextoRef.current =
      true;

    evento.currentTarget.innerText =
      textoAntesEdicao;

    evento.currentTarget.blur();
    return;
  }

  if (
    evento.key === "Enter" &&
    !evento.shiftKey
  ) {
    evento.preventDefault();
    evento.currentTarget.blur();
  }
}

function atualizarTextoSelecionado(alteracoes) {
  if (!elementoSelecionado) {
    return;
  }

  const textoExiste = textosStudio.some(
    (item) => item.id === elementoSelecionado
  );

  if (!textoExiste) {
    return;
  }

  setTextosStudio((anteriores) =>
    anteriores.map((item) =>
      item.id === elementoSelecionado
        ? { ...item, ...alteracoes }
        : item
    )
  );
}

function importarFundoComputador(evento) {
  const arquivo = evento.target.files?.[0];

  if (!arquivo) {
    return;
  }

  const leitor = new FileReader();

  leitor.onload = () => {
    const imagem = String(leitor.result || "");

    if (!imagem) {
      return;
    }

    setFundoStudio(
      `url("${imagem}") center / cover no-repeat`
    );
  };

  leitor.readAsDataURL(arquivo);
  evento.target.value = "";
}


function adicionarIconeBanner(icone) {
  if (!icone?.id || !icone?.src) {
    return;
  }

  const novoIcone = {
    ...icone,
    x:
      Number(icone.x) ||
      larguraPreviewExportacao /
        2,
    y:
      Number(icone.y) ||
      alturaPreviewExportacao /
        2,
    escala:
      Number(icone.escala) ||
      0.55,
    rotacao:
      Number(icone.rotacao) ||
      0,
    tipo: "icone",
  };

  setImagensBanner(
    (anteriores) => [
      ...anteriores,
      novoIcone,
    ]
  );

  setCamadasStudio(
    (anteriores) => [
      ...anteriores,
      {
        id: novoIcone.id,
        nome:
          `🎨 ${
            novoIcone.nome ||
            "Ícone"
          }`,
        tipo: "icone",
        visivel: true,
        bloqueado: false,
      },
    ]
  );

  setImagemSelecionadaId(
    novoIcone.id
  );

  setElementoSelecionado(
    novoIcone.id
  );

  setFerramentaStudio(
    "icones"
  );
}

function adicionarObjetoStudio(modelo) {
  if (!modelo?.forma) {
    return;
  }

  const novoObjeto = {
    id: `${Date.now()}-${Math.random()}`,
    src: criarObjetoSvg({
      forma: modelo.forma,
      cor:
        modelo.cor ||
        "#2563eb",
      borda: "#ffffff",
      opacidade: 1,
    }),
    x:
      larguraPreviewExportacao /
      2,
    y:
      alturaPreviewExportacao /
      2,
    escala:
      modelo.forma === "linha"
        ? 0.9
        : 0.72,
    rotacao: 0,
    tipo: "objeto",
    formaObjeto:
      modelo.forma,
    nome:
      modelo.nome ||
      "Objeto",
    corObjeto:
      modelo.cor ||
      "#2563eb",
    bordaObjeto:
      "#ffffff",
    opacidadeObjeto: 1,
    efeitoRapido: "nenhum",
  };

  setImagensBanner(
    (anteriores) => [
      ...anteriores,
      novoObjeto,
    ]
  );

  setCamadasStudio(
    (anteriores) => [
      ...anteriores,
      {
        id: novoObjeto.id,
        nome:
          `🧩 ${novoObjeto.nome}`,
        tipo: "objeto",
        visivel: true,
        bloqueado: false,
      },
    ]
  );

  setElementoSelecionado(
    novoObjeto.id
  );

  setImagemSelecionadaId(
    novoObjeto.id
  );

  setFerramentaStudio(
    "objetos"
  );
}

function atualizarObjetoSelecionado(
  alteracoes
) {
  if (!imagemSelecionadaId) {
    return;
  }

  setImagensBanner(
    (anteriores) =>
      anteriores.map(
        (imagem) => {
          if (
            imagem.id !==
              imagemSelecionadaId ||
            imagem.tipo !==
              "objeto"
          ) {
            return imagem;
          }

          const atualizado = {
            ...imagem,
            ...alteracoes,
          };

          return {
            ...atualizado,
            src: criarObjetoSvg({
              forma:
                atualizado.formaObjeto,
              cor:
                atualizado.corObjeto,
              borda:
                atualizado.bordaObjeto,
              opacidade:
                atualizado.opacidadeObjeto,
            }),
          };
        }
      )
  );
}

function adicionarLogoStudio(src, nome = "Logo") {
  if (!src) {
    return;
  }

  const novoLogo = {
    id: `${Date.now()}-${Math.random()}`,
    src,
    x: 720,
    y: 500,
    escala: 1,
    rotacao: 0,
    tipo: "logo",
    nome,
  };

  setImagensBanner((anteriores) => [
    ...anteriores,
    novoLogo,
  ]);

  setCamadasStudio((anteriores) => [
    ...anteriores,
    {
      id: novoLogo.id,
      nome: `🖼️ ${nome}`,
      tipo: "logo",
      visivel: true,
      bloqueado: false,
    },
  ]);

  setElementoSelecionado(novoLogo.id);
  setImagemSelecionadaId(novoLogo.id);
  setFerramentaStudio("logos");
}

function importarLogoComputador(evento) {
  const arquivo = evento.target.files?.[0];

  if (!arquivo) {
    return;
  }

  if (!arquivo.type.startsWith("image/")) {
    alert("Selecione uma imagem de logo.");
    evento.target.value = "";
    return;
  }

  const leitor = new FileReader();

  leitor.onload = () => {
    adicionarLogoStudio(
      String(leitor.result || ""),
      arquivo.name.replace(/\.[^.]+$/, "") || "Logo importado"
    );
  };

  leitor.readAsDataURL(arquivo);
  evento.target.value = "";
}

function salvarProjetoBanner() {
  const projeto = {
    fundoStudio,
    imagensBanner,
    textosStudio,
    camadasStudio,
    zoomCanvas,
    criadoEm: new Date().toISOString(),
  };

  localStorage.setItem(
    "bannerStudioProjeto",
    JSON.stringify(projeto)
  );

  alert("✅ Projeto salvo com sucesso!");
}

function duplicarElementoSelecionado() {
  if (!elementoSelecionado) {
    return;
  }

  const imagem =
    imagensBanner.find(
      (item) =>
        item.id ===
        elementoSelecionado
    );

  if (imagem) {
    const copia = {
      ...imagem,
      id: `${Date.now()}-${Math.random()}`,
      x: (imagem.x || 450) + 35,
      y: (imagem.y || 300) + 35,
    };

    setImagensBanner((anteriores) => [
      ...anteriores,
      copia,
    ]);

    setCamadasStudio((anteriores) => [
      ...anteriores,
      {
        id: copia.id,
        nome:
          imagem.tipo === "logo"
            ? `🖼️ ${imagem.nome || "Logo"}`
            : "📦 Produto",
        tipo:
          imagem.tipo === "logo"
            ? "logo"
            : "produto",
        visivel: true,
        bloqueado: false,
      },
    ]);

    setElementoSelecionado(
      copia.id
    );

    setImagemSelecionadaId(
      copia.id
    );

    return;
  }

  const texto =
    textosStudio.find(
      (item) =>
        item.id ===
        elementoSelecionado
    );

  if (texto) {
    const copia = {
      ...texto,
      id: `${Date.now()}-${Math.random()}`,
      x: (texto.x || 450) + 35,
      y: (texto.y || 120) + 35,
    };

    setTextosStudio((anteriores) => [
      ...anteriores,
      copia,
    ]);

    setCamadasStudio((anteriores) => [
      ...anteriores,
      {
        id: copia.id,
        nome: "📝 Texto",
        tipo: "texto",
      },
    ]);

    setElementoSelecionado(
      copia.id
    );
  }
}
function criarNovoProjetoBanner() {
  const confirmar = window.confirm(
    "Deseja iniciar um novo projeto? O conteúdo atual será limpo."
  );

  if (!confirmar) {
    return;
  }

  setImagensBanner([]);
  setTextosStudio([]);
  setCamadasStudio([]);

  setElementoSelecionado(null);
  setImagemSelecionadaId(null);
  setImagemArrastandoId(null);
  setTextoArrastando(null);
  setArrastando(false);

  setFundoStudio("#ffffff");
  setZoomCanvas(100);
  setTituloStudio("");

  localStorage.removeItem(
    "imagensBannerStudio"
  );

  localStorage.removeItem(
    "textosBannerStudio"
  );

  localStorage.removeItem(
    "camadasBannerStudio"
  );

  localStorage.removeItem(
    "imagemBannerSelecionada"
  );

  alert("✅ Novo projeto iniciado.");
}
function desfazerBanner() {
  if (historicoBanner.length <= 1) {
    return;
  }

  const historico = [
    ...historicoBanner,
  ];

  historico.pop();

  const ultimo =
    historico[
      historico.length - 1
    ];

  if (!ultimo) {
    return;
  }

  setHistoricoFuturo(
    (anteriores) => [
      ...anteriores,
      {
        imagensBanner,
        textosStudio,
        camadasStudio,
      },
    ]
  );

  setRestaurandoHistorico(true);

  setHistoricoBanner(
    historico
  );

  setImagensBanner(
    ultimo.imagensBanner || []
  );

  setTextosStudio(
    ultimo.textosStudio || []
  );

  setCamadasStudio(
    ultimo.camadasStudio || []
  );

  setElementoSelecionado(null);
  setImagemSelecionadaId(null);
  setImagemArrastandoId(null);
  setTextoArrastando(null);
  setArrastando(false);
}


function copiarElementoSelecionado() {
  if (!elementoSelecionado) {
    return;
  }

  const imagem =
    imagensBanner.find(
      (item) =>
        item.id ===
        elementoSelecionado
    );

  if (imagem) {
    elementoCopiadoRef.current = {
      tipo: "imagem",
      dados: {
        ...imagem,
      },
    };

    return;
  }

  const texto =
    textosStudio.find(
      (item) =>
        item.id ===
        elementoSelecionado
    );

  if (texto) {
    elementoCopiadoRef.current = {
      tipo: "texto",
      dados: {
        ...texto,
      },
    };
  }
}

function colarElementoCopiado() {
  const copiado =
    elementoCopiadoRef.current;

  if (!copiado?.dados) {
    return;
  }

  const novoId =
    `${Date.now()}-${Math.random()}`;

  const novoElemento = {
    ...copiado.dados,
    id: novoId,
    x:
      (Number(
        copiado.dados.x
      ) || 450) + 28,
    y:
      (Number(
        copiado.dados.y
      ) || 300) + 28,
  };

  if (copiado.tipo === "imagem") {
    setImagensBanner(
      (anteriores) => [
        ...anteriores,
        novoElemento,
      ]
    );

    setCamadasStudio(
      (anteriores) => [
        ...anteriores,
        {
          id: novoId,
          nome:
            novoElemento.tipo ===
            "logo"
              ? `🖼️ ${
                  novoElemento.nome ||
                  "Logo"
                }`
              : "📦 Produto",
          tipo:
            novoElemento.tipo ===
            "logo"
              ? "logo"
              : "produto",
          visivel: true,
          bloqueado: false,
        },
      ]
    );

    setImagemSelecionadaId(
      novoId
    );
  } else {
    setTextosStudio(
      (anteriores) => [
        ...anteriores,
        novoElemento,
      ]
    );

    setCamadasStudio(
      (anteriores) => [
        ...anteriores,
        {
          id: novoId,
          nome:
            novoElemento.tipo ===
            "selo"
              ? "⭐ Selo"
              : "📝 Texto",
          tipo:
            novoElemento.tipo ===
            "selo"
              ? "selo"
              : "texto",
          visivel: true,
          bloqueado: false,
        },
      ]
    );
  }

  setElementoSelecionado(
    novoId
  );
}

function refazerBanner() {
  if (
    historicoFuturo.length === 0
  ) {
    return;
  }

  const futuros = [
    ...historicoFuturo,
  ];

  const proximo =
    futuros.pop();

  if (!proximo) {
    return;
  }

  setRestaurandoHistorico(true);

  setHistoricoBanner(
    (anterior) => [
      ...anterior,
      {
        imagensBanner,
        textosStudio,
        camadasStudio,
      },
    ]
  );

  setHistoricoFuturo(
    futuros
  );

  setImagensBanner(
    proximo.imagensBanner || []
  );

  setTextosStudio(
    proximo.textosStudio || []
  );

  setCamadasStudio(
    proximo.camadasStudio || []
  );

  setElementoSelecionado(null);
  setImagemSelecionadaId(null);
}

useEffect(() => {
  function lidarComAtalhos(evento) {
    const alvo = evento.target;

    const editandoCampo =
      alvo instanceof HTMLElement &&
      (
        alvo.tagName === "INPUT" ||
        alvo.tagName === "TEXTAREA" ||
        alvo.tagName === "SELECT" ||
        alvo.isContentEditable
      );

    if (editandoCampo) {
      return;
    }

    const tecla =
      String(evento.key || "")
        .toLowerCase();

    const comando =
      evento.ctrlKey ||
      evento.metaKey;

    if (
      tecla === " "
    ) {
      evento.preventDefault();
      setEspacoPressionado(true);
      return;
    }

    if (
      comando &&
      tecla === "c"
    ) {
      evento.preventDefault();
      copiarElementoSelecionado();
      return;
    }

    if (
      comando &&
      tecla === "v"
    ) {
      evento.preventDefault();
      colarElementoCopiado();
      return;
    }

    if (
      comando &&
      tecla === "y"
    ) {
      evento.preventDefault();
      refazerBanner();
      return;
    }

    if (
      comando &&
      tecla === "z" &&
      evento.shiftKey
    ) {
      evento.preventDefault();
      refazerBanner();
      return;
    }

    if (
      comando &&
      tecla === "d"
    ) {
      evento.preventDefault();

      duplicarElementoSelecionado();
      return;
    }

    if (
      comando &&
      tecla === "z"
    ) {
      evento.preventDefault();

      desfazerBanner();
      return;
    }

    if (
      tecla === "delete" ||
      tecla === "backspace"
    ) {
      if (!elementoSelecionado) {
        return;
      }

      const camadaSelecionada =
        camadasStudio.find(
          (camada) =>
            camada.id ===
            elementoSelecionado
        );

      if (!camadaSelecionada) {
        return;
      }

      evento.preventDefault();

      excluirCamada(
        camadaSelecionada
      );

      return;
    }

    if (tecla === "escape") {
      setElementoSelecionado(null);
      setImagemSelecionadaId(null);
      setImagemArrastandoId(null);
      setTextoArrastando(null);
      setArrastando(false);
      setEditandoTextoId(null);
    }
  }

  function liberarEspaco(evento) {
    if (
      String(evento.key || "") ===
      " "
    ) {
      setEspacoPressionado(false);
      setMovendoPrancheta(false);
    }
  }

  window.addEventListener(
    "keydown",
    lidarComAtalhos
  );

  window.addEventListener(
    "keyup",
    liberarEspaco
  );

  return () => {
    window.removeEventListener(
      "keydown",
      lidarComAtalhos
    );

    window.removeEventListener(
      "keyup",
      liberarEspaco
    );
  };
}, [
  elementoSelecionado,
  camadasStudio,
  imagensBanner,
  textosStudio,
  historicoBanner,
  historicoFuturo,
]);

function abrirProjetoBanner() {
  const projetoSalvo =
    localStorage.getItem(
      "bannerStudioProjeto"
    );

  if (!projetoSalvo) {
    alert(
      "Nenhum projeto salvo."
    );
    return;
  }

  const projeto = JSON.parse(
    projetoSalvo
  );

  setFundoStudio(
    projeto.fundoStudio ||
      "#ffffff"
  );

  setImagensBanner(
    projeto.imagensBanner || []
  );

  setTextosStudio(
    projeto.textosStudio || []
  );

  setCamadasStudio(
    projeto.camadasStudio || []
  );

  setZoomCanvas(
    projeto.zoomCanvas || 100
  );

  setElementoSelecionado(null);
  setImagemSelecionadaId(null);
  setImagemArrastandoId(null);
  setTextoArrastando(null);
  setArrastando(false);

  alert(
    "✅ Projeto carregado."
  );
}
  function calcularSnapElemento({
    x,
    y,
    larguraCanvas,
    alturaCanvas,
    ignorarId = null,
  }) {
    const limite = 12;
    const margem = 40;

    const alvosX = [
      margem,
      larguraCanvas / 2,
      larguraCanvas - margem,
    ];

    const alvosY = [
      margem,
      alturaCanvas / 2,
      alturaCanvas - margem,
    ];

    imagensBanner.forEach((imagem) => {
      if (imagem.id !== ignorarId) {
        alvosX.push(Number(imagem.x) || larguraCanvas / 2);
        alvosY.push(Number(imagem.y) || alturaCanvas / 2);
      }
    });

    textosStudio.forEach((texto) => {
      if (texto.id !== ignorarId) {
        alvosX.push(Number(texto.x) || larguraCanvas / 2);
        alvosY.push(Number(texto.y) || alturaCanvas / 2);
      }
    });

    let xFinal = x;
    let yFinal = y;
    let guiaX = null;
    let guiaY = null;

    const alvoX = alvosX.find(
      (valor) => Math.abs(x - valor) <= limite
    );

    const alvoY = alvosY.find(
      (valor) => Math.abs(y - valor) <= limite
    );

    if (alvoX !== undefined) {
      xFinal = alvoX;
      guiaX = alvoX;
    }

    if (alvoY !== undefined) {
      yFinal = alvoY;
      guiaY = alvoY;
    }

    if (snapNaGrade) {
      xFinal =
        Math.round(
          xFinal /
            tamanhoGrade
        ) *
        tamanhoGrade;

      yFinal =
        Math.round(
          yFinal /
            tamanhoGrade
        ) *
        tamanhoGrade;
    }

    return {
      x: Math.min(
        larguraCanvas - margem,
        Math.max(margem, xFinal)
      ),
      y: Math.min(
        alturaCanvas - margem,
        Math.max(margem, yFinal)
      ),
      guiaX,
      guiaY,
    };
  }

  const textoSelecionado =
    textosStudio.find(
      (item) =>
        item.id === elementoSelecionado
    ) || null;

  function excluirTextoSelecionado(id) {
    if (!id) {
      return;
    }

    setTextosStudio((anteriores) =>
      anteriores.filter(
        (item) => item.id !== id
      )
    );

    setCamadasStudio((anteriores) =>
      anteriores.filter(
        (item) => item.id !== id
      )
    );

    setElementoSelecionado(null);
    setTextoArrastando(null);
    setTituloStudio("");
  }


  function aplicarTemplateProfissional() {
    const configuracoes = {
      mercadoLivre: {
        formato: "mercadoLivre",
        tamanho: "1200x1200",
        fundo:
          "linear-gradient(135deg,#ffffff 0%,#dbeafe 48%,#bfdbfe 100%)",
        produto: {
          x: 0.68,
          y: 0.57,
          escala: 1.02,
          rotacao: 0,
        },
        titulo: {
          x: 0.27,
          y: 0.25,
          tamanho: 45,
          cor: "#0f172a",
          alinhamento: "center",
        },
        subtitulo: {
          x: 0.27,
          y: 0.39,
          tamanho: 22,
          cor: "#334155",
          alinhamento: "center",
        },
        selo: {
          x: 0.25,
          y: 0.7,
          rotacao: -2,
          nome: "Produto Novo",
        },
        logo: {
          x: 0.82,
          y: 0.1,
          escala: 0.66,
          nome: "Torken Auto Parts",
        },
      },

      shopee: {
        formato: "shopee",
        tamanho: "1200x1500",
        fundo:
          "linear-gradient(160deg,#fff7ed 0%,#fed7aa 48%,#f97316 100%)",
        produto: {
          x: 0.5,
          y: 0.44,
          escala: 1.08,
          rotacao: 0,
        },
        titulo: {
          x: 0.5,
          y: 0.72,
          tamanho: 43,
          cor: "#7c2d12",
          alinhamento: "center",
        },
        subtitulo: {
          x: 0.5,
          y: 0.81,
          tamanho: 21,
          cor: "#9a3412",
          alinhamento: "center",
        },
        selo: {
          x: 0.76,
          y: 0.67,
          rotacao: 3,
          nome: "Promoção",
        },
        logo: {
          x: 0.5,
          y: 0.09,
          escala: 0.62,
          nome: "Torken Auto Parts",
        },
      },

      instagram: {
        formato: "instagram",
        tamanho: "1080x1350",
        fundo:
          "radial-gradient(circle at 18% 88%,#f59e0b 0%,transparent 30%),radial-gradient(circle at 85% 18%,#ec4899 0%,transparent 34%),linear-gradient(135deg,#7c3aed,#312e81)",
        produto: {
          x: 0.5,
          y: 0.42,
          escala: 1.15,
          rotacao: 0,
        },
        titulo: {
          x: 0.5,
          y: 0.7,
          tamanho: 48,
          cor: "#ffffff",
          alinhamento: "center",
        },
        subtitulo: {
          x: 0.5,
          y: 0.81,
          tamanho: 22,
          cor: "#fdf4ff",
          alinhamento: "center",
        },
        selo: {
          x: 0.23,
          y: 0.17,
          rotacao: -4,
          nome: "Premium",
        },
        logo: {
          x: 0.5,
          y: 0.92,
          escala: 0.58,
          nome: "APPIA AI",
        },
      },
    };

    const configuracao =
      configuracoes[
        templateProfissionalSelecionado
      ];

    if (!configuracao) {
      return;
    }

    const formatoDestino =
      FORMATOS_EXPORTACAO[
        configuracao.formato
      ];

    const largura =
      larguraPreviewExportacao;

    const altura =
      largura *
      (
        formatoDestino.altura /
        formatoDestino.largura
      );

    const instante = Date.now();

    const produtos =
      imagensBanner.filter(
        (imagem) =>
          imagem.tipo !== "logo" && imagem.tipo !== "objeto" && imagem.tipo !== "icone"
      );

    if (produtos.length === 0) {
      alert(
        "Adicione pelo menos uma foto do produto antes de aplicar o template."
      );
      return;
    }

    const logosAtuais =
      imagensBanner.filter(
        (imagem) =>
          imagem.tipo === "logo"
      );

    const logoModelo =
      LOGOS_STUDIO.find(
        (logo) =>
          logo.nome ===
          configuracao.logo.nome
      ) ||
      LOGOS_STUDIO[0];

    const logoPrincipal =
      logosAtuais[0] || {
        id:
          `logo-template-${instante}`,
        src: logoModelo.src,
        nome: logoModelo.nome,
        tipo: "logo",
        efeitoRapido: "sombra",
      };

    const novasImagens = [
      ...produtos.map(
        (imagem, indice) => ({
          ...imagem,
          x:
            largura *
              configuracao.produto.x +
            indice * 34,
          y:
            altura *
              configuracao.produto.y +
            indice * 24,
          escala: Math.max(
            0.62,
            configuracao.produto
              .escala -
              indice * 0.09
          ),
          rotacao:
            configuracao.produto
              .rotacao +
            indice * 4,
          efeitoRapido:
            imagem.efeitoRapido ||
            "produtoPro",
        })
      ),

      {
        ...logoPrincipal,
        x:
          largura *
          configuracao.logo.x,
        y:
          altura *
          configuracao.logo.y,
        escala:
          configuracao.logo.escala,
        rotacao: 0,
        tipo: "logo",
      },

      ...logosAtuais
        .slice(1)
        .map(
          (logo, indice) => ({
            ...logo,
            x:
              largura *
                configuracao.logo.x -
              (indice + 1) * 125,
            y:
              altura *
              configuracao.logo.y,
            escala:
              Math.min(
                0.62,
                Number(
                  logo.escala
                ) || 0.55
              ),
            rotacao: 0,
          })
        ),
    ];

    const textosComuns =
      textosStudio.filter(
        (item) =>
          item.tipo !== "selo"
      );

    const selosAtuais =
      textosStudio.filter(
        (item) =>
          item.tipo === "selo"
      );

    const titulo =
      textosComuns[0] || {
        id:
          `titulo-template-${instante}`,
        tipo: "texto",
        texto:
          "PEÇA AUTOMOTIVA PREMIUM",
        fonte: "Arial",
        negrito: true,
        sombra: true,
        rotacao: 0,
      };

    const subtitulo =
      textosComuns[1] || {
        id:
          `subtitulo-template-${instante}`,
        tipo: "texto",
        texto:
          "QUALIDADE, DESEMPENHO E CONFIANÇA",
        fonte: "Arial",
        negrito: true,
        sombra: true,
        rotacao: 0,
      };

    const seloModelo =
      SELOS_STUDIO.find(
        (selo) =>
          selo.nome ===
          configuracao.selo.nome
      ) ||
      SELOS_STUDIO[0];

    const seloPrincipal =
      selosAtuais[0] || {
        id:
          `selo-template-${instante}`,
        tipo: "selo",
        texto: seloModelo.texto,
        fundo: seloModelo.fundo,
        cor:
          seloModelo.corTexto ||
          "#ffffff",
        bordaSelo:
          seloModelo.borda,
        formatoSelo:
          seloModelo.formato,
        tamanho:
          seloModelo.tamanho ||
          18,
        negrito: true,
        sombra: true,
      };

    const novosTextos = [
      {
        ...titulo,
        x:
          largura *
          configuracao.titulo.x,
        y:
          altura *
          configuracao.titulo.y,
        tamanho:
          configuracao.titulo
            .tamanho,
        cor:
          configuracao.titulo.cor,
        alinhamento:
          configuracao.titulo
            .alinhamento,
        larguraMaxima:
          largura * 0.43,
        quebrarLinha: true,
        rotacao: 0,
      },

      {
        ...subtitulo,
        x:
          largura *
          configuracao.subtitulo.x,
        y:
          altura *
          configuracao.subtitulo.y,
        tamanho:
          configuracao.subtitulo
            .tamanho,
        cor:
          configuracao.subtitulo
            .cor,
        alinhamento:
          configuracao.subtitulo
            .alinhamento,
        larguraMaxima:
          largura * 0.42,
        quebrarLinha: true,
        rotacao: 0,
      },

      {
        ...seloPrincipal,
        x:
          largura *
          configuracao.selo.x,
        y:
          altura *
          configuracao.selo.y,
        rotacao:
          configuracao.selo
            .rotacao,
      },

      ...textosComuns
        .slice(2)
        .map(
          (item, indice) => ({
            ...item,
            x:
              largura *
              0.5,
            y:
              altura *
                0.88 -
              indice * 54,
          })
        ),

      ...selosAtuais
        .slice(1)
        .map(
          (item, indice) => ({
            ...item,
            x:
              largura *
                configuracao.selo.x +
              (indice + 1) * 155,
            y:
              altura *
              configuracao.selo.y,
          })
        ),
    ];

    const todasCamadas = [
      ...novasImagens.map(
        (imagem, indice) => ({
          id: imagem.id,
          nome:
            imagem.tipo === "logo"
              ? `🖼️ ${
                  imagem.nome ||
                  "Logo"
                }`
              : imagem.tipo ===
                  "objeto"
                ? `🧩 ${
                    imagem.nome ||
                    "Objeto"
                  }`
                : imagem.tipo ===
                    "icone"
                  ? `🎨 ${
                      imagem.nome ||
                      "Ícone"
                    }`
                  : `📦 Produto ${
                      indice + 1
                    }`,
          tipo:
            imagem.tipo === "logo"
              ? "logo"
              : imagem.tipo ===
                  "objeto"
                ? "objeto"
                : imagem.tipo ===
                    "icone"
                  ? "icone"
                  : "produto",
          visivel: true,
          bloqueado: false,
        })
      ),

      ...novosTextos.map(
        (item, indice) => ({
          id: item.id,
          nome:
            item.tipo === "selo"
              ? "⭐ Selo"
              : indice === 0
                ? "📝 Título"
                : indice === 1
                  ? "📝 Subtítulo"
                  : "📝 Texto",
          tipo:
            item.tipo === "selo"
              ? "selo"
              : "texto",
          visivel: true,
          bloqueado: false,
        })
      ),
    ];

    setFormatoExportacao(
      configuracao.formato
    );

    setTamanhoBanner(
      configuracao.tamanho
    );

    setFundoStudio(
      configuracao.fundo
    );

    setImagensBanner(
      novasImagens
    );

    setTextosStudio(
      novosTextos
    );

    setCamadasStudio(
      todasCamadas
    );

    setMostrarAreaSegura(true);
    setElementoSelecionado(null);
    setImagemSelecionadaId(null);
    setImagemArrastandoId(null);
    setTextoArrastando(null);

    alert(
      `✅ Template ${formatoDestino.nome} aplicado com sucesso.`
    );
  }

  function alinharElementoSelecionado(tipo) {
    if (!elementoSelecionado) {
      return;
    }

    const margem = 48;

    function calcularPosicaoAtual(item) {
      const atualX =
        Number(item?.x) ||
        larguraPreviewExportacao / 2;

      const atualY =
        Number(item?.y) ||
        alturaPreviewExportacao / 2;

      const posicoes = {
        esquerda: {
          x: margem,
          y: atualY,
        },

        centroHorizontal: {
          x:
            larguraPreviewExportacao /
            2,
          y: atualY,
        },

        direita: {
          x:
            larguraPreviewExportacao -
            margem,
          y: atualY,
        },

        topo: {
          x: atualX,
          y: margem,
        },

        centroVertical: {
          x: atualX,
          y:
            alturaPreviewExportacao /
            2,
        },

        base: {
          x: atualX,
          y:
            alturaPreviewExportacao -
            margem,
        },

        centroCompleto: {
          x:
            larguraPreviewExportacao /
            2,
          y:
            alturaPreviewExportacao /
            2,
        },
      };

      return (
        posicoes[tipo] || {
          x: atualX,
          y: atualY,
        }
      );
    }

    const imagemSelecionada =
      imagensBanner.find(
        (item) =>
          item.id ===
          elementoSelecionado
      );

    if (imagemSelecionada) {
      const novaPosicao =
        calcularPosicaoAtual(
          imagemSelecionada
        );

      setImagensBanner(
        (anteriores) =>
          anteriores.map(
            (item) =>
              item.id ===
              elementoSelecionado
                ? {
                    ...item,
                    ...novaPosicao,
                  }
                : item
          )
      );

      setImagemSelecionadaId(
        elementoSelecionado
      );

      return;
    }

    const textoSelecionadoAtual =
      textosStudio.find(
        (item) =>
          item.id ===
          elementoSelecionado
      );

    if (textoSelecionadoAtual) {
      const novaPosicao =
        calcularPosicaoAtual(
          textoSelecionadoAtual
        );

      setTextosStudio(
        (anteriores) =>
          anteriores.map(
            (item) =>
              item.id ===
              elementoSelecionado
                ? {
                    ...item,
                    ...novaPosicao,
                  }
                : item
          )
      );
    }
  }

  function obterNomeElementoSelecionado() {
    if (!elementoSelecionado) {
      return "";
    }

    const camada =
      camadasStudio.find(
        (item) =>
          item.id ===
          elementoSelecionado
      );

    return (
      camada?.nome ||
      "Elemento selecionado"
    );
  }

  return (
    <div
      style={{
        marginTop: "18px",
        width: "100%",
        maxWidth: "1600px",
        marginLeft: "auto",
        marginRight: "auto",
        padding: "0 18px",
        boxSizing: "border-box",
      }}
    >
  <BannerToolbar
    modo="superior"
    zoomCanvas={zoomCanvas}
    setZoomCanvas={setZoomCanvas}
  />

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "124px 310px minmax(680px, 1fr)",
          justifyContent: "center",
          gap: "14px",
          marginTop: "16px",
          alignItems: "start",
          width: "100%",
          maxWidth: "100%",
        }}
      >
        <div
          style={{
            background: "#0f172a",
            borderRadius: "16px",
            padding: "12px 10px",
            border: "1px solid #334155",
            position: "sticky",
            top: "12px",
            boxShadow: "0 18px 45px rgba(0,0,0,0.28)",
          }}
        >
          <h3
            style={{
              color: "#67e8f9",
              textAlign: "center",
              marginTop: 0,
              marginBottom: "18px",
            }}
          >
            🧰
          </h3>

          <div
            style={{
              color: "#94a3b8",
              fontSize: "10px",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "0.8px",
              marginBottom: "8px",
              textAlign: "center",
            }}
          >
            Criação
          </div>

          {[
            ["fundos", "🎨", "Fundos"],
            ["produto", "📦", "Produto"],
            ["texto", "📝", "Texto"],
            ["selos", "⭐", "Selos"],
            ["logos", "🖼️", "Logos"],
            ["templates", "🧩", "Templates"],
            ["objetos", "🔷", "Objetos"],
            ["icones", "🎨", "Ícones"],
          ].map(([chave, icone, nome]) => (
            <button
              key={chave}
              type="button"
              title={nome}
              aria-label={nome}
              onClick={() => setFerramentaStudio(chave)}
              style={{
                ...botaoMenuStudio,
                minHeight: "74px",
                padding: "10px 6px",
                marginBottom: "10px",
                fontSize: "30px",
                background:
                  ferramentaStudio === chave
                    ? "linear-gradient(135deg,#2563eb,#22d3ee)"
                    : "#1e293b",
                border:
                  ferramentaStudio === chave
                    ? "1px solid #67e8f9"
                    : "1px solid #334155",
              }}
            >
              <span
                style={{
                  display: "block",
                  lineHeight: 1,
                }}
              >
                {icone}
              </span>

              <span
                style={{
                  display: "block",
                  marginTop: "8px",
                  fontSize: "12px",
                  lineHeight: 1.1,
                }}
              >
                {nome}
              </span>
            </button>
          ))}

          <div
            style={{
              height: "1px",
              background: "#334155",
              margin: "12px 0",
            }}
          />

          <div
            style={{
              color: "#94a3b8",
              fontSize: "10px",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "0.8px",
              marginBottom: "8px",
              textAlign: "center",
            }}
          >
            Projeto
          </div>

          {[
            ["camadas", "📚", "Camadas"],
            ["exportacaoPro", "📤", "Exportação"],
            ["finalizar", "✅", "Finalizar"],
          ].map(([chave, icone, nome]) => (
            <button
              key={chave}
              type="button"
              title={nome}
              aria-label={nome}
              onClick={() => setFerramentaStudio(chave)}
              style={{
                ...botaoMenuStudio,
                minHeight: "74px",
                padding: "10px 6px",
                marginBottom: "10px",
                fontSize: "30px",
                background:
                  ferramentaStudio === chave
                    ? "linear-gradient(135deg,#2563eb,#22d3ee)"
                    : "#1e293b",
                border:
                  ferramentaStudio === chave
                    ? "1px solid #67e8f9"
                    : "1px solid #334155",
              }}
            >
              <span
                style={{
                  display: "block",
                  lineHeight: 1,
                }}
              >
                {icone}
              </span>

              <span
                style={{
                  display: "block",
                  marginTop: "8px",
                  fontSize: "12px",
                  lineHeight: 1.1,
                }}
              >
                {nome}
              </span>
            </button>
          ))}
        </div>

        <div
          style={{
            background: "#0f172a",
            borderRadius: "16px",
            padding: "18px",
            border: "1px solid #334155",
            minHeight: "300px",
            alignSelf: "start",
            position: "sticky",
            top: "12px",
            maxHeight: "calc(100vh - 24px)",
            overflowY: "auto",
            scrollbarWidth: "thin",
            boxShadow: "0 18px 45px rgba(0,0,0,0.28)",
          }}
        >
          {!ferramentaStudio && (
            <div
              style={{
                color: "#94a3b8",
                textAlign: "center",
                padding: "30px 10px",
              }}
            >
              Escolha uma ferramenta no menu.
            </div>
          )}

          {ferramentaStudio === "fundos" && (
            <div>
              <h3 style={{ color: "#67e8f9", marginTop: 0 }}>
                🎨 Biblioteca de Fundos
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "10px",
                }}
              >
                {fundosStudio.map((fundo) => (
                  <button
                    key={fundo.nome}
                    type="button"
                    title={fundo.nome}
                    onClick={() => setFundoStudio(fundo.valor)}
                    style={{
                      height: "52px",
                      borderRadius: "10px",
                      background: fundo.valor,
                      border:
                        fundoStudio === fundo.valor
                          ? "3px solid #22d3ee"
                          : "2px solid #475569",
                      cursor: "pointer",
                    }}
                  />
                ))}
              </div>

              <label
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: "14px",
                  padding: "12px",
                  boxSizing: "border-box",
                  borderRadius: "10px",
                  border: "1px solid #22d3ee",
                  background: "#020617",
                  color: "#67e8f9",
                  cursor: "pointer",
                  fontWeight: "bold",
                  textAlign: "center",
                }}
              >
                📂 Importar Fundo do Computador

                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={importarFundoComputador}
                  style={{ display: "none" }}
                />
              </label>
            </div>
          )}

          {ferramentaStudio === "produto" && (
            <div>
              <h3 style={{ color: "#67e8f9", marginTop: 0 }}>
                📦 Produto
              </h3>

              <p style={{ color: "#94a3b8" }}>
                Arraste a peça diretamente dentro do banner.
              </p>

              {(() => {
                const imagemSelecionada = imagensBanner.find(
                  (imagem) => imagem.id === imagemSelecionadaId
                );

                if (!imagemSelecionada) {
                  return (
                    <div
                      style={{
                        marginTop: "18px",
                        padding: "12px",
                        borderRadius: "10px",
                        border: "1px dashed #334155",
                        background: "#020617",
                        color: "#94a3b8",
                        fontSize: "13px",
                        lineHeight: 1.5,
                      }}
                    >
                      Selecione uma foto no banner para ajustar o tamanho.
                    </div>
                  );
                }

                const escalaAtual =
                  Number(imagemSelecionada.escala) || 1;

                return (
                  <div
                    style={{
                      marginTop: "16px",
                      padding: "14px",
                      borderRadius: "12px",
                      border: "1px solid #334155",
                      background: "#020617",
                    }}
                  >
                    <label
                      style={{
                        display: "block",
                        color: "#67e8f9",
                        fontWeight: "bold",
                        marginBottom: "10px",
                      }}
                    >
                      Tamanho: {Math.round(escalaAtual * 100)}%
                    </label>

                    <input
                      type="range"
                      min="25"
                      max="250"
                      value={Math.round(escalaAtual * 100)}
                      onChange={(evento) => {
                        const escala =
                          Number(evento.target.value) / 100;

                        setImagensBanner((anteriores) =>
                          anteriores.map((imagem) =>
                            imagem.id === imagemSelecionada.id
                              ? { ...imagem, escala }
                              : imagem
                          )
                        );
                      }}
                      style={{ width: "100%" }}
                    />

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: "8px",
                        marginTop: "12px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setImagensBanner((anteriores) =>
                            anteriores.map((imagem) =>
                              imagem.id === imagemSelecionada.id
                                ? {
                                    ...imagem,
                                    escala: Math.max(
                                      0.25,
                                      (Number(imagem.escala) || 1) - 0.1
                                    ),
                                  }
                                : imagem
                            )
                          )
                        }
                      >
                        ➖
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setImagensBanner((anteriores) =>
                            anteriores.map((imagem) =>
                              imagem.id === imagemSelecionada.id
                                ? { ...imagem, escala: 1 }
                                : imagem
                            )
                          )
                        }
                      >
                        100%
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setImagensBanner((anteriores) =>
                            anteriores.map((imagem) =>
                              imagem.id === imagemSelecionada.id
                                ? {
                                    ...imagem,
                                    escala: Math.min(
                                      2.5,
                                      (Number(imagem.escala) || 1) + 0.1
                                    ),
                                  }
                                : imagem
                            )
                          )
                        }
                      >
                        ➕
                      </button>
                    </div>

                    <p
                      style={{
                        color: "#94a3b8",
                        fontSize: "12px",
                        lineHeight: 1.5,
                        marginBottom: 0,
                      }}
                    >
                      Arraste a foto para mover. Use a bolinha azul ou o controle acima para redimensionar.
                    </p>
                  </div>
                );
              })()}
            </div>
          )}
{ferramentaStudio === "produto" && (
  <div>
    <div
      style={{
        height: "1px",
        background: "#334155",
        margin: "20px 0",
      }}
    />

    <h3
      style={{
        color: "#67e8f9",
        marginTop: 0,
      }}
    >
      🖼️ Ações da Foto
    </h3>

<button
  type="button"
  onClick={() => {
    localStorage.setItem(
      "modoGaleria",
      "selecionarParaBanner"
    );

    localStorage.setItem(
      "abrirBannerAutomatico",
      "true"
    );

    setScreen("galeria");
  }}
  style={{
    width: "100%",
    marginTop: "20px",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #22d3ee",
    background: "#020617",
    color: "#67e8f9",
    cursor: "pointer",
    fontWeight: "bold",
  }}
>
  📂 Escolher Outra Foto
</button>

<button
  type="button"
  onClick={() => {
    if (!imagemBanner) {
      return;
    }

    localStorage.setItem(
      "imagemFotoIASelecionada",
      imagemBanner
    );

    localStorage.setItem(
      "voltarParaBanner",
      "true"
    );

    setScreen("fotoIA");
  }}
  disabled={!imagemBanner}
  style={{
    width: "100%",
    marginTop: "12px",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #7c3aed",
    background: imagemBanner
      ? "#7c3aed"
      : "#475569",
    color: "#ffffff",
    cursor: imagemBanner
      ? "pointer"
      : "not-allowed",
    fontWeight: "bold",
  }}
>
  ⚡ Editar na Foto IA
</button>

<button
  type="button"
  onClick={() => {
    if (!imagemSelecionadaId) {
      return;
    }

    setImagensBanner((anteriores) =>
      anteriores.filter(
        (imagem) =>
          imagem.id !==
          imagemSelecionadaId
      )
    );

    setCamadasStudio((anteriores) =>
      anteriores.filter(
        (camada) =>
          camada.id !==
          imagemSelecionadaId
      )
    );

    setElementoSelecionado(null);
    setImagemSelecionadaId(null);
    setImagemArrastandoId(null);
    setArrastando(false);
  }}
  disabled={!imagemSelecionadaId}
  style={{
    width: "100%",
    marginTop: "12px",
    padding: "12px",
    borderRadius: "10px",
    border: "none",
    background:
      imagemSelecionadaId
        ? "#dc2626"
        : "#475569",
    color: "#ffffff",
    cursor:
      imagemSelecionadaId
        ? "pointer"
        : "not-allowed",
    fontWeight: "bold",
  }}
>
  🗑️ Remover Foto
</button>

<div
  style={{
    height: "1px",
    background: "#334155",
    margin: "20px 0",
  }}
/>

<div
  style={{
    marginBottom: "16px",
    padding: "13px",
    borderRadius: "12px",
    border:
      "1px solid #22d3ee",
    background:
      "linear-gradient(135deg,rgba(37,99,235,.17),rgba(34,211,238,.08))",
  }}
>
  <h3
    style={{
      color: "#67e8f9",
      marginTop: 0,
      marginBottom: "7px",
      fontSize: "15px",
    }}
  >
    🪄 Produto Inteligente
  </h3>

  <p
    style={{
      marginTop: 0,
      marginBottom: "11px",
      color: "#cbd5e1",
      fontSize: "11px",
      lineHeight: 1.5,
    }}
  >
    Centraliza, ajusta o tamanho,
    melhora contraste e aplica
    contorno com sombra profissional.
  </p>

  <button
    type="button"
    onClick={
      melhorarProdutoSelecionado
    }
    disabled={
      !imagemSelecionadaId
    }
    style={{
      width: "100%",
      padding: "12px",
      borderRadius: "10px",
      border: "none",
      background:
        imagemSelecionadaId
          ? "linear-gradient(135deg,#2563eb,#22d3ee)"
          : "#475569",
      color: "#ffffff",
      cursor:
        imagemSelecionadaId
          ? "pointer"
          : "not-allowed",
      fontWeight: "bold",
      boxShadow:
        imagemSelecionadaId
          ? "0 10px 24px rgba(34,211,238,.22)"
          : "none",
    }}
  >
    ✨ Melhorar Produto
  </button>

  <small
    style={{
      display: "block",
      marginTop: "8px",
      color: "#64748b",
      fontSize: "9px",
      lineHeight: 1.4,
    }}
  >
    O botão melhora a apresentação
    visual. A remoção de fundo continua
    disponível na Foto IA.
  </small>
</div>

<h3
  style={{
    color: "#67e8f9",
    marginTop: 0,
  }}
>
  ✨ Efeitos Rápidos
</h3>

<div
  style={{
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  }}
>
  {[
    ["nenhum", "Normal"],
    ["produtoPro", "Produto Pro"],
    ["sombra", "Sombra Premium"],
    ["glowAzul", "Glow Azul"],
    ["glowBranco", "Glow Branco"],
    ["contornoBranco", "Contorno Branco"],
    ["contornoPreto", "Contorno Preto"],
    ["reflexo", "Reflexo"],
    ["vidro", "Vidro"],
    ["metal", "Metal"],
    ["neon", "Neon"],
  ].map(([valor, nome]) => (
    <button
      key={valor}
      type="button"
      onClick={() =>
        aplicarEfeitoRapidoImagem(valor)
      }
      style={{
        padding: "9px 7px",
        borderRadius: "9px",
        border: "1px solid #334155",
        background: "#020617",
        color: "#e2e8f0",
        cursor: "pointer",
        fontSize: "11px",
        fontWeight: "bold",
      }}
    >
      {nome}
    </button>
  ))}
</div>
  </div>
)}

          {ferramentaStudio ===
            "exportacaoPro" && (
            <BannerExportacaoPro
              formato={
                tipoExportacao
              }
              setFormato={
                setTipoExportacao
              }
              resolucao={
                formatoExportacao
              }
              setResolucao={
                setFormatoExportacao
              }
              qualidade={
                qualidadeExportacaoPro
              }
              setQualidade={
                setQualidadeExportacaoPro
              }
              fundoTransparente={
                fundoTransparenteExportacao
              }
              setFundoTransparente={
                setFundoTransparenteExportacao
              }
              nomeArquivo={
                nomeArquivoExportacao
              }
              setNomeArquivo={
                setNomeArquivoExportacao
              }
              previewImagem={
                previewExportacaoImagem
              }
              exportando={
                exportandoBanner
              }
              onGerarPreview={
                gerarPreviewBanner
              }
              onExportar={
                exportarBannerProfissional
              }
              onExportarTodos={
                exportarTodosFormatos
              }
            />
          )}

{ferramentaStudio === "finalizar" && (
  <div>
    <h3
      style={{
        color: "#67e8f9",
        marginTop: 0,
      }}
    >
      ✅ Finalizar Projeto
    </h3>

    <p
      style={{
        color: "#94a3b8",
        fontSize: "13px",
        lineHeight: 1.5,
      }}
    >
      Salve, abra, desfaça ou finalize o banner.
    </p>

<div
  style={{
    marginTop: "16px",
    padding: "14px",
    borderRadius: "13px",
    border: "1px solid #22d3ee",
    background:
      "linear-gradient(135deg,rgba(37,99,235,.2),rgba(124,58,237,.14))",
    boxShadow:
      "0 14px 30px rgba(37,99,235,.14)",
  }}
>
  <h4
    style={{
      color: "#67e8f9",
      margin: "0 0 7px 0",
      fontSize: "16px",
    }}
  >
    🤖 IA Compositora
  </h4>

  <p
    style={{
      margin:
        "0 0 11px 0",
      color: "#cbd5e1",
      fontSize: "11px",
      lineHeight: 1.5,
    }}
  >
    Cria fundo, composição,
    título, subtítulo, selo e
    logo automaticamente.
  </p>

  <button
    type="button"
    onClick={
      criarBannerInteligenteCompleto
    }
    disabled={
      imagensBanner.filter(
        (imagem) =>
          imagem.tipo !==
          "logo"
      ).length === 0
    }
    style={{
      width: "100%",
      padding: "13px",
      borderRadius: "10px",
      border: "none",
      background:
        imagensBanner.filter(
          (imagem) =>
            imagem.tipo !==
            "logo"
        ).length > 0
          ? "linear-gradient(135deg,#7c3aed,#2563eb,#06b6d4)"
          : "#475569",
      color: "#ffffff",
      cursor:
        imagensBanner.filter(
          (imagem) =>
            imagem.tipo !==
            "logo"
        ).length > 0
          ? "pointer"
          : "not-allowed",
      fontWeight: "900",
      fontSize: "13px",
      boxShadow:
        imagensBanner.filter(
          (imagem) =>
            imagem.tipo !==
            "logo"
        ).length > 0
          ? "0 12px 26px rgba(34,211,238,.22)"
          : "none",
    }}
  >
    ✨ Criar Banner Inteligente
  </button>
</div>

<div
  style={{
    marginTop: "12px",
    padding: "12px",
    borderRadius: "12px",
    border: "1px solid #334155",
    background: "#020617",
  }}
>
  <h4
    style={{
      color: "#67e8f9",
      margin: "0 0 10px 0",
    }}
  >
    🎨 Template Inteligente
  </h4>

  <select
    value={categoriaTemplateIA}
    onChange={(evento) =>
      setCategoriaTemplateIA(
        evento.target.value
      )
    }
    style={{
      width: "100%",
      padding: "10px",
      borderRadius: "9px",
      border: "1px solid #475569",
      background: "#0f172a",
      color: "#ffffff",
    }}
  >
    <option value="sensor">Sensor</option>
    <option value="bico">Bico Injetor</option>
    <option value="cabecote">Cabeçote</option>
    <option value="comando">Comando</option>
    <option value="bobina">Bobina</option>
    <option value="bomba">Bomba</option>
    <option value="sonda">Sonda</option>
    <option value="palheta">Palheta</option>
    <option value="outro">Outro</option>
  </select>

  <button
    type="button"
    onClick={aplicarTemplateCategoriaIA}
    style={{
      width: "100%",
      marginTop: "9px",
      padding: "11px",
      borderRadius: "9px",
      border: "none",
      background:
        "linear-gradient(135deg,#7c3aed,#2563eb)",
      color: "#ffffff",
      cursor: "pointer",
      fontWeight: "bold",
    }}
  >
    ✨ Criar Banner IA por Categoria
  </button>
</div>

<button
  type="button"
  onClick={melhorarBannerComercialIA}
  style={{
    width: "100%",
    marginTop: "12px",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #c084fc",
    background:
      "linear-gradient(135deg,#581c87,#2563eb)",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: "bold",
  }}
>
  🧠 Melhorar Banner Comercial
</button>

<label
  style={{
    display: "flex",
    gap: "9px",
    alignItems: "center",
    marginTop: "12px",
    padding: "10px",
    borderRadius: "10px",
    background: "#020617",
    color: "#cbd5e1",
    cursor: "pointer",
  }}
>
  <input
    type="checkbox"
    checked={mostrarAreaSegura}
    onChange={(evento) =>
      setMostrarAreaSegura(
        evento.target.checked
      )
    }
  />
  📏 Mostrar Área Segura
</label>

<div
  style={{
    marginTop: "12px",
    padding: "12px",
    borderRadius: "12px",
    border: "1px solid #164e63",
    background: "#082f49",
  }}
>
  <h4
    style={{
      color: "#bae6fd",
      margin: "0 0 9px 0",
    }}
  >
    👁 Preview Marketplace
  </h4>

  <select
    value={canalPreview}
    onChange={(evento) =>
      setCanalPreview(
        evento.target.value
      )
    }
    style={{
      width: "100%",
      padding: "9px",
      borderRadius: "9px",
      border: "1px solid #0e7490",
      background: "#020617",
      color: "#ffffff",
    }}
  >
    <option value="mercadoLivre">
      Mercado Livre
    </option>
    <option value="shopee">Shopee</option>
    <option value="instagram">
      Instagram
    </option>
    <option value="whatsapp">
      WhatsApp
    </option>
  </select>

  <button
    type="button"
    onClick={abrirPreviewMarketplace}
    disabled={gerandoPreviewMarketplace}
    style={{
      width: "100%",
      marginTop: "9px",
      padding: "10px",
      borderRadius: "9px",
      border: "none",
      background: "#0e7490",
      color: "#ffffff",
      cursor: gerandoPreviewMarketplace
        ? "wait"
        : "pointer",
      fontWeight: "bold",
    }}
  >
    {gerandoPreviewMarketplace
      ? "⏳ Gerando Preview..."
      : "👁 Visualizar"}
  </button>
</div>

<button
  type="button"
  onClick={salvarProjetoBanner}
  style={{
    width: "100%",
    marginTop: "12px",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #22c55e",
    background: "#16a34a",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: "bold",
  }}
>
  💾 Salvar Projeto
</button>
<button
  type="button"
  onClick={abrirProjetoBanner}
  style={{
    width: "100%",
    marginTop: "12px",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #2563eb",
    background: "#2563eb",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: "bold",
  }}
>
  📂 Abrir Projeto
</button>
<button
  type="button"
  onClick={criarNovoProjetoBanner}
  style={{
    width: "100%",
    marginTop: "12px",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #f97316",
    background: "#c2410c",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: "bold",
  }}
>
  🆕 Novo Projeto
</button>

<button
  type="button"
  onClick={desfazerBanner}
  disabled={
    historicoBanner.length <= 1
  }
  style={{
    width: "100%",
    marginTop: "12px",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #3b82f6",
    background:
      historicoBanner.length > 1
        ? "#2563eb"
        : "#475569",
    color: "#ffffff",
    cursor:
      historicoBanner.length > 1
        ? "pointer"
        : "not-allowed",
    fontWeight: "bold",
  }}
>
  ↩️ Desfazer
</button>

<button
  type="button"
  onClick={exportarBannerProfissional}
  style={{
    width: "100%",
    marginTop: "12px",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #16a34a",
    background: "#15803d",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: "bold",
  }}
>
  📤 Exportar Agora
</button>
  </div>
)}
          {ferramentaStudio === "texto" && (
            <div>
              <h3 style={{ color: "#67e8f9", marginTop: 0 }}>
                📝 Editor de Texto
              </h3>

              <input
                type="text"
                value={tituloStudio}
                placeholder="Digite o texto"
                onChange={(evento) => {
                  const texto = evento.target.value;
                  setTituloStudio(texto);
                  atualizarTextoSelecionado({ texto });
                }}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "11px",
                  borderRadius: "10px",
                  border: "1px solid #475569",
                  background: "#020617",
                  color: "#ffffff",
                  marginBottom: "12px",
                }}
              />

              <label
                style={{
                  color: "#67e8f9",
                  display: "block",
                  marginBottom: "7px",
                }}
              >
                🎨 Cor
              </label>

              <input
                type="color"
                value={corTituloStudio}
                onChange={(evento) => {
                  const cor = evento.target.value;
                  setCorTituloStudio(cor);
                  atualizarTextoSelecionado({ cor });
                }}
                style={{
                  width: "100%",
                  height: "42px",
                  border: "none",
                  marginBottom: "15px",
                  cursor: "pointer",
                }}
              />

              <label
                style={{
                  color: "#67e8f9",
                  display: "block",
                  marginBottom: "7px",
                }}
              >
                🔠 Tamanho: {tamanhoTituloStudio}px
              </label>

              <input
                type="range"
                min="20"
                max="90"
                value={tamanhoTituloStudio}
                onChange={(evento) => {
                  const tamanho = Number(evento.target.value);
                  setTamanhoTituloStudio(tamanho);
                  atualizarTextoSelecionado({ tamanho });
                }}
                style={{ width: "100%", marginBottom: "16px" }}
              />

              <button
                type="button"
                disabled={!tituloStudio.trim()}
                onClick={() => {
                  const novoTexto = {
                    id: Date.now(),
                    texto: tituloStudio.trim(),
                    x: 450,
                    y: 100 + textosStudio.length * 55,
                    cor: corTituloStudio,
                    tamanho: tamanhoTituloStudio,
                  };

                  setTextosStudio((anteriores) => [
  ...anteriores,
  novoTexto,
]);

setCamadasStudio((anteriores) => [
  ...anteriores,
  {
    id: novoTexto.id,
    nome: `📝 ${novoTexto.texto}`,
    tipo: "texto",
  },
]);

setElementoSelecionado(novoTexto.id);
setTituloStudio("");
                }}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "none",
                  background: tituloStudio.trim()
                    ? "#2563eb"
                    : "#475569",
                  color: "#ffffff",
                  fontWeight: "bold",
                  cursor: tituloStudio.trim()
                    ? "pointer"
                    : "not-allowed",
                }}
              >
                ➕ Novo Texto
              </button>
            </div>
          )}
          {elementoSelecionado &&
  elementoSelecionado !== "produto" && (
    <button
      type="button"
      onClick={() => {
        setTextosStudio((anteriores) =>
          anteriores.filter(
            (texto) =>
              texto.id !==
              elementoSelecionado
          )
        );

        setCamadasStudio((anteriores) =>
          anteriores.filter(
            (camada) =>
              camada.id !==
              elementoSelecionado
          )
        );

        setElementoSelecionado(null);
        setTextoArrastando(null);
        setTituloStudio("");
      }}
      style={{
        width: "100%",
        marginTop: "12px",
        padding: "12px",
        borderRadius: "10px",
        border: "none",
        background: "#dc2626",
        color: "#ffffff",
        cursor: "pointer",
        fontWeight: "bold",
      }}
    >
      🗑️ Excluir Texto
    </button>
  )}
{ferramentaStudio === "camadas" && (
  <div>
    <h3
      style={{
        color: "#67e8f9",
        marginTop: 0,
        marginBottom: "8px",
      }}
    >
      📚 Camadas
    </h3>

    <p
      style={{
        color: "#94a3b8",
        fontSize: "12px",
        lineHeight: 1.45,
        marginTop: 0,
      }}
    >
      Organize, oculte ou bloqueie os elementos do banner.
    </p>

    <div
      style={{
        marginBottom: "12px",
        padding: "9px 10px",
        borderRadius: "10px",
        border: "1px solid #334155",
        background: "#0f172a",
        color: "#cbd5e1",
        fontSize: "11px",
        lineHeight: 1.5,
      }}
    >
      ⌨️ Atalhos: Ctrl+D duplicar • Delete excluir • Ctrl+Z desfazer • Esc cancelar seleção
    </div>

    {camadasStudio.length === 0 ? (
      <p style={{ color: "#94a3b8" }}>
        Nenhuma camada adicionada.
      </p>
    ) : (
      <div
        style={{
          display: "grid",
          gap: "9px",
        }}
      >
        {[...camadasStudio]
          .reverse()
          .map((camada) => {
            const visivel = camada.visivel !== false;
            const bloqueado = Boolean(camada.bloqueado);
            const selecionada =
              elementoSelecionado === camada.id;

            return (
              <div
                key={camada.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: "7px",
                  padding: "8px",
                  borderRadius: "12px",
                  border: selecionada
                    ? "2px solid #22d3ee"
                    : "1px solid #334155",
                  background: selecionada
                    ? "#164e63"
                    : "#020617",
                  opacity: visivel ? 1 : 0.62,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (!visivel || bloqueado) {
                      return;
                    }

                    setElementoSelecionado(camada.id);

                    if (camada.tipo === "produto") {
                      setImagemSelecionadaId(camada.id);
                    }
                  }}
                  style={{
                    minWidth: 0,
                    padding: "7px 8px",
                    borderRadius: "8px",
                    border: "none",
                    background: "transparent",
                    color: "#ffffff",
                    cursor:
                      visivel && !bloqueado
                        ? "pointer"
                        : "default",
                    textAlign: "left",
                    fontWeight: "bold",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {camada.nome}
                </button>

                <div
                  style={{
                    display: "flex",
                    gap: "4px",
                    alignItems: "center",
                  }}
                >
                  <button
                    type="button"
                    title={
                      visivel
                        ? "Ocultar camada"
                        : "Mostrar camada"
                    }
                    onClick={() =>
                      alternarVisibilidadeCamada(camada.id)
                    }
                    style={botaoIconeCamada}
                  >
                    {visivel ? "👁️" : "🚫"}
                  </button>

                  <button
                    type="button"
                    title={
                      bloqueado
                        ? "Desbloquear camada"
                        : "Bloquear camada"
                    }
                    onClick={() =>
                      alternarBloqueioCamada(camada.id)
                    }
                    style={botaoIconeCamada}
                  >
                    {bloqueado ? "🔒" : "🔓"}
                  </button>
                </div>

                <div
                  style={{
                    gridColumn: "1 / -1",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "6px",
                  }}
                >
                  <button
                    type="button"
                    title="Trazer para frente"
                    onClick={() =>
                      moverCamada(camada.id, "subir")
                    }
                    style={botaoAcaoCamada}
                  >
                    ⬆ Frente
                  </button>

                  <button
                    type="button"
                    title="Enviar para trás"
                    onClick={() =>
                      moverCamada(camada.id, "descer")
                    }
                    style={botaoAcaoCamada}
                  >
                    ⬇ Trás
                  </button>

                  <button
                    type="button"
                    title="Excluir camada"
                    onClick={() => excluirCamada(camada)}
                    style={{
                      ...botaoAcaoCamada,
                      color: "#fecaca",
                      borderColor: "#7f1d1d",
                      background: "#450a0a",
                    }}
                  >
                    🗑 Excluir
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    )}
  </div>
)}

          {ferramentaStudio === "selos" && (
            <div>
              <h3 style={{ color: "#67e8f9", marginTop: 0 }}>
                ⭐ Biblioteca de Selos
              </h3>

              <p style={{ color: "#94a3b8", fontSize: "12px" }}>
                Clique para adicionar. Depois arraste, redimensione e rotacione no banner.
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                }}
              >
                {SELOS_STUDIO.map((selo) => (
                  <button
                    key={selo.nome}
                    type="button"
                    onClick={() => {
                      const novoSelo = {
                        id: `${Date.now()}-${Math.random()}`,
                        texto: selo.texto,
                        x: 710,
                        y:
                          105 +
                          textosStudio.filter(
                            (item) =>
                              item.tipo === "selo"
                          ).length *
                            62,
                        cor:
                          selo.corTexto ||
                          "#ffffff",
                        fundo:
                          selo.fundo ||
                          "#2563eb",
                        bordaSelo:
                          selo.borda ||
                          "rgba(255,255,255,.88)",
                        formatoSelo:
                          selo.formato ||
                          "capsula",
                        tamanho:
                          selo.tamanho ||
                          18,
                        rotacao: 0,
                        tipo: "selo",
                        negrito: true,
                        sombra: true,
                      };

                      setTextosStudio((anteriores) => [
                        ...anteriores,
                        novoSelo,
                      ]);

                      setCamadasStudio((anteriores) => [
                        ...anteriores,
                        {
                          id: novoSelo.id,
                          nome: `⭐ ${selo.nome}`,
                          tipo: "texto",
                        },
                      ]);

                      setElementoSelecionado(novoSelo.id);
                    }}
                    style={{
                      minHeight: "72px",
                      padding: "9px",
                      borderRadius:
                        selo.formato ===
                        "escudo"
                          ? "16px 16px 28px 28px"
                          : selo.formato ===
                              "impacto"
                            ? "8px"
                            : selo.formato ===
                                "faixa"
                              ? "5px"
                              : "999px",
                      border:
                        `2px solid ${
                          selo.borda ||
                          "rgba(255,255,255,.75)"
                        }`,
                      background:
                        selo.fundo,
                      color:
                        selo.corTexto ||
                        "#ffffff",
                      cursor: "pointer",
                      fontWeight: "900",
                      fontSize: "10px",
                      lineHeight: 1.15,
                      textShadow:
                        "0 2px 5px rgba(0,0,0,.45)",
                      boxShadow:
                        "0 8px 18px rgba(0,0,0,.28)",
                      transform:
                        selo.formato ===
                        "impacto"
                          ? "rotate(-2deg)"
                          : "none",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        letterSpacing:
                          "0.25px",
                      }}
                    >
                      {selo.texto}
                    </span>

                    <small
                      style={{
                        display: "block",
                        marginTop: "5px",
                        opacity: 0.78,
                        fontSize: "8px",
                        fontWeight: "bold",
                      }}
                    >
                      Clique para adicionar
                    </small>
                  </button>
                ))}
              </div>
            </div>
          )}

          {ferramentaStudio === "logos" && (
            <div>
              <h3 style={{ color: "#67e8f9", marginTop: 0 }}>
                🖼️ Biblioteca de Logos
              </h3>

              <p
                style={{
                  color: "#94a3b8",
                  fontSize: "12px",
                  lineHeight: 1.45,
                }}
              >
                Clique em um modelo para adicionar. Depois arraste,
                redimensione, rotacione ou controle pela aba Camadas.
              </p>

              <div
                style={{
                  marginBottom: "12px",
                  padding: "9px 10px",
                  borderRadius: "10px",
                  border: "1px solid #334155",
                  background: "#020617",
                  color: "#cbd5e1",
                  fontSize: "10px",
                  lineHeight: 1.45,
                }}
              >
                ℹ️ Os modelos abaixo são identificadores visuais em texto.
                Para uso oficial, importe o arquivo de logo autorizado da marca.
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "9px",
                }}
              >
                {LOGOS_STUDIO.map((logo) => (
                  <button
                    key={logo.nome}
                    type="button"
                    onClick={() =>
                      adicionarLogoStudio(logo.src, logo.nome)
                    }
                    title={`Adicionar ${logo.nome}`}
                    style={{
                      padding: "7px",
                      borderRadius: "10px",
                      border: "1px solid #334155",
                      background: "#020617",
                      cursor: "pointer",
                      boxShadow:
                        "0 8px 18px rgba(0,0,0,.22)",
                      transition:
                        "transform .15s ease, border-color .15s ease",
                    }}
                    onMouseEnter={(evento) => {
                      evento.currentTarget.style.transform =
                        "translateY(-2px)";
                      evento.currentTarget.style.borderColor =
                        "#22d3ee";
                    }}
                    onMouseLeave={(evento) => {
                      evento.currentTarget.style.transform =
                        "translateY(0)";
                      evento.currentTarget.style.borderColor =
                        "#334155";
                    }}
                  >
                    <img
                      src={logo.src}
                      alt={logo.nome}
                      style={{
                        display: "block",
                        width: "100%",
                        height: "58px",
                        objectFit: "contain",
                        borderRadius: "7px",
                      }}
                    />

                    <span
                      style={{
                        display: "block",
                        color: "#f8fafc",
                        fontSize: "10px",
                        fontWeight: "bold",
                        marginTop: "5px",
                      }}
                    >
                      {logo.nome}
                    </span>

                    <small
                      style={{
                        display: "block",
                        marginTop: "3px",
                        color: "#64748b",
                        fontSize: "8px",
                        fontWeight: "bold",
                      }}
                    >
                      {logo.categoria}
                    </small>
                  </button>
                ))}
              </div>

              <label
                style={{
                  display: "block",
                  width: "100%",
                  boxSizing: "border-box",
                  marginTop: "14px",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid #22d3ee",
                  background: "#082f49",
                  color: "#cffafe",
                  textAlign: "center",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                📂 Importar Logo PNG/JPG

                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={importarLogoComputador}
                  style={{ display: "none" }}
                />
              </label>

              <p
                style={{
                  color: "#64748b",
                  fontSize: "11px",
                  marginBottom: 0,
                }}
              >
                Para melhor resultado, use PNG com fundo transparente.
              </p>
            </div>
          )}

          {ferramentaStudio ===
            "icones" && (
            <BannerIcones
              onAdicionarIcone={
                adicionarIconeBanner
              }
            />
          )}

          {ferramentaStudio ===
            "objetos" && (
            <div>
              <h3
                style={{
                  color: "#67e8f9",
                  marginTop: 0,
                }}
              >
                🔷 Objetos Gráficos
              </h3>

              <p
                style={{
                  color: "#94a3b8",
                  fontSize: "12px",
                  lineHeight: 1.5,
                }}
              >
                Clique para adicionar.
                Depois arraste,
                redimensione, rotacione,
                duplique ou organize pela
                aba Camadas.
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "1fr 1fr",
                  gap: "9px",
                }}
              >
                {OBJETOS_STUDIO.map(
                  (objeto) => (
                    <button
                      key={
                        objeto.forma
                      }
                      type="button"
                      onClick={() =>
                        adicionarObjetoStudio(
                          objeto
                        )
                      }
                      style={{
                        minHeight:
                          "92px",
                        padding:
                          "9px",
                        borderRadius:
                          "11px",
                        border:
                          "1px solid #334155",
                        background:
                          "#020617",
                        color:
                          "#ffffff",
                        cursor:
                          "pointer",
                        fontWeight:
                          "bold",
                        boxShadow:
                          "0 8px 18px rgba(0,0,0,.22)",
                      }}
                    >
                      <img
                        src={criarObjetoSvg({
                          forma:
                            objeto.forma,
                          cor:
                            objeto.cor,
                          borda:
                            "#ffffff",
                          opacidade: 1,
                        })}
                        alt={
                          objeto.nome
                        }
                        style={{
                          display:
                            "block",
                          width:
                            "100%",
                          height:
                            "54px",
                          objectFit:
                            "contain",
                          pointerEvents:
                            "none",
                        }}
                      />

                      <span
                        style={{
                          display:
                            "block",
                          marginTop:
                            "5px",
                          fontSize:
                            "10px",
                        }}
                      >
                        {
                          objeto.icone
                        }{" "}
                        {
                          objeto.nome
                        }
                      </span>
                    </button>
                  )
                )}
              </div>

              {(() => {
                const objetoSelecionado =
                  imagensBanner.find(
                    (imagem) =>
                      imagem.id ===
                        imagemSelecionadaId &&
                      imagem.tipo ===
                        "objeto"
                  );

                if (
                  !objetoSelecionado
                ) {
                  return (
                    <div
                      style={{
                        marginTop:
                          "14px",
                        padding:
                          "11px",
                        borderRadius:
                          "10px",
                        border:
                          "1px dashed #334155",
                        background:
                          "#0f172a",
                        color:
                          "#64748b",
                        fontSize:
                          "11px",
                        lineHeight:
                          1.5,
                      }}
                    >
                      Selecione um objeto
                      no banner para
                      editar cor, borda e
                      transparência.
                    </div>
                  );
                }

                return (
                  <div
                    style={{
                      marginTop:
                        "14px",
                      padding:
                        "13px",
                      borderRadius:
                        "12px",
                      border:
                        "1px solid #22d3ee",
                      background:
                        "#0f172a",
                    }}
                  >
                    <h4
                      style={{
                        color:
                          "#67e8f9",
                        margin:
                          "0 0 11px 0",
                      }}
                    >
                      🎛️ Propriedades
                    </h4>

                    <label
                      style={{
                        display:
                          "block",
                        color:
                          "#cbd5e1",
                        fontSize:
                          "11px",
                        fontWeight:
                          "bold",
                        marginBottom:
                          "9px",
                      }}
                    >
                      Cor do objeto

                      <input
                        type="color"
                        value={
                          objetoSelecionado
                            .corObjeto ||
                          "#2563eb"
                        }
                        onChange={(
                          evento
                        ) =>
                          atualizarObjetoSelecionado(
                            {
                              corObjeto:
                                evento
                                  .target
                                  .value,
                            }
                          )
                        }
                        style={{
                          display:
                            "block",
                          width:
                            "100%",
                          height:
                            "38px",
                          marginTop:
                            "6px",
                          cursor:
                            "pointer",
                        }}
                      />
                    </label>

                    <label
                      style={{
                        display:
                          "block",
                        color:
                          "#cbd5e1",
                        fontSize:
                          "11px",
                        fontWeight:
                          "bold",
                        marginBottom:
                          "9px",
                      }}
                    >
                      Cor da borda

                      <input
                        type="color"
                        value={
                          objetoSelecionado
                            .bordaObjeto ||
                          "#ffffff"
                        }
                        onChange={(
                          evento
                        ) =>
                          atualizarObjetoSelecionado(
                            {
                              bordaObjeto:
                                evento
                                  .target
                                  .value,
                            }
                          )
                        }
                        style={{
                          display:
                            "block",
                          width:
                            "100%",
                          height:
                            "38px",
                          marginTop:
                            "6px",
                          cursor:
                            "pointer",
                        }}
                      />
                    </label>

                    <label
                      style={{
                        display:
                          "block",
                        color:
                          "#cbd5e1",
                        fontSize:
                          "11px",
                        fontWeight:
                          "bold",
                      }}
                    >
                      Transparência:{" "}
                      {Math.round(
                        (
                          objetoSelecionado
                            .opacidadeObjeto ||
                          1
                        ) * 100
                      )}
                      %

                      <input
                        type="range"
                        min="10"
                        max="100"
                        step="5"
                        value={Math.round(
                          (
                            objetoSelecionado
                              .opacidadeObjeto ||
                            1
                          ) * 100
                        )}
                        onChange={(
                          evento
                        ) =>
                          atualizarObjetoSelecionado(
                            {
                              opacidadeObjeto:
                                Number(
                                  evento
                                    .target
                                    .value
                                ) /
                                100,
                            }
                          )
                        }
                        style={{
                          width:
                            "100%",
                          marginTop:
                            "7px",
                          cursor:
                            "pointer",
                        }}
                      />
                    </label>

                    <p
                      style={{
                        color:
                          "#64748b",
                        fontSize:
                          "9px",
                        lineHeight:
                          1.45,
                        marginBottom:
                          0,
                      }}
                    >
                      Escala, rotação,
                      duplicação, bloqueio,
                      ordem e exclusão
                      continuam disponíveis
                      diretamente no canvas
                      e em Camadas.
                    </p>
                  </div>
                );
              })()}
            </div>
          )}

          {ferramentaStudio ===
            "templates" && (
            <div>
              <h3
                style={{
                  color: "#67e8f9",
                  marginTop: 0,
                }}
              >
                🧩 Templates Profissionais
              </h3>

              <p
                style={{
                  color: "#94a3b8",
                  fontSize: "12px",
                  lineHeight: 1.5,
                }}
              >
                Escolha o layout base.
                Nesta primeira etapa,
                o template fica selecionado
                e pronto para receber a
                aplicação automática.
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "1fr",
                  gap: "11px",
                }}
              >
                {[
                  {
                    id:
                      "mercadoLivre",
                    nome:
                      "Mercado Livre",
                    icone: "📦",
                    formato:
                      "1200 × 1200",
                    descricao:
                      "Produto à direita, textos e selo à esquerda.",
                    fundo:
                      "linear-gradient(135deg,#ffffff,#dbeafe)",
                    destaque:
                      "#2563eb",
                  },
                  {
                    id: "shopee",
                    nome: "Shopee",
                    icone: "🛒",
                    formato:
                      "1200 × 1500",
                    descricao:
                      "Produto central, título inferior e selo de oferta.",
                    fundo:
                      "linear-gradient(135deg,#fff7ed,#fb923c)",
                    destaque:
                      "#f97316",
                  },
                  {
                    id:
                      "instagram",
                    nome:
                      "Instagram Feed",
                    icone: "📷",
                    formato:
                      "1080 × 1350",
                    descricao:
                      "Produto em destaque com título grande para o feed.",
                    fundo:
                      "linear-gradient(135deg,#7c3aed,#ec4899,#f59e0b)",
                    destaque:
                      "#ec4899",
                  },
                ].map(
                  (template) => {
                    const ativo =
                      templateProfissionalSelecionado ===
                      template.id;

                    return (
                      <button
                        key={
                          template.id
                        }
                        type="button"
                        onClick={() =>
                          setTemplateProfissionalSelecionado(
                            template.id
                          )
                        }
                        style={{
                          width:
                            "100%",
                          padding:
                            "10px",
                          borderRadius:
                            "12px",
                          border: ativo
                            ? `2px solid ${template.destaque}`
                            : "1px solid #334155",
                          background:
                            ativo
                              ? "rgba(30,41,59,.96)"
                              : "#020617",
                          cursor:
                            "pointer",
                          textAlign:
                            "left",
                          boxShadow: ativo
                            ? `0 10px 24px ${template.destaque}33`
                            : "none",
                        }}
                      >
                        <div
                          style={{
                            height:
                              "76px",
                            position:
                              "relative",
                            overflow:
                              "hidden",
                            borderRadius:
                              "9px",
                            background:
                              template.fundo,
                            marginBottom:
                              "9px",
                            border:
                              "1px solid rgba(255,255,255,.28)",
                          }}
                        >
                          <div
                            style={{
                              position:
                                "absolute",
                              right:
                                "10%",
                              top:
                                "22%",
                              width:
                                "32%",
                              height:
                                "55%",
                              borderRadius:
                                "50%",
                              background:
                                "rgba(255,255,255,.82)",
                              border:
                                `3px solid ${template.destaque}`,
                            }}
                          />

                          <div
                            style={{
                              position:
                                "absolute",
                              left:
                                "8%",
                              top:
                                "22%",
                              width:
                                "38%",
                              height:
                                "8px",
                              borderRadius:
                                "999px",
                              background:
                                template.destaque,
                            }}
                          />

                          <div
                            style={{
                              position:
                                "absolute",
                              left:
                                "8%",
                              top:
                                "40%",
                              width:
                                "29%",
                              height:
                                "5px",
                              borderRadius:
                                "999px",
                              background:
                                "rgba(15,23,42,.48)",
                            }}
                          />

                          <div
                            style={{
                              position:
                                "absolute",
                              left:
                                "8%",
                              bottom:
                                "13%",
                              padding:
                                "3px 7px",
                              borderRadius:
                                "999px",
                              background:
                                template.destaque,
                              color:
                                "#ffffff",
                              fontSize:
                                "8px",
                              fontWeight:
                                "bold",
                            }}
                          >
                            SELO
                          </div>
                        </div>

                        <div
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            alignItems:
                              "center",
                            gap: "8px",
                          }}
                        >
                          <strong
                            style={{
                              color:
                                "#f8fafc",
                              fontSize:
                                "13px",
                            }}
                          >
                            {
                              template.icone
                            }{" "}
                            {
                              template.nome
                            }
                          </strong>

                          {ativo && (
                            <span
                              style={{
                                color:
                                  "#67e8f9",
                                fontSize:
                                  "11px",
                                fontWeight:
                                  "bold",
                              }}
                            >
                              ✓ Selecionado
                            </span>
                          )}
                        </div>

                        <small
                          style={{
                            display:
                              "block",
                            marginTop:
                              "5px",
                            color:
                              "#94a3b8",
                            fontSize:
                              "10px",
                            lineHeight:
                              1.4,
                          }}
                        >
                          {
                            template.formato
                          }{" "}
                          •{" "}
                          {
                            template.descricao
                          }
                        </small>
                      </button>
                    );
                  }
                )}
              </div>

              <button
                type="button"
                onClick={
                  aplicarTemplateProfissional
                }
                disabled={
                  imagensBanner.filter(
                    (imagem) =>
                      imagem.tipo !==
                      "logo"
                  ).length === 0
                }
                style={{
                  width: "100%",
                  marginTop: "14px",
                  padding: "13px",
                  borderRadius: "10px",
                  border: "none",
                  background:
                    imagensBanner.filter(
                      (imagem) =>
                        imagem.tipo !==
                        "logo"
                    ).length > 0
                      ? "linear-gradient(135deg,#2563eb,#7c3aed,#22d3ee)"
                      : "#475569",
                  color: "#ffffff",
                  cursor:
                    imagensBanner.filter(
                      (imagem) =>
                        imagem.tipo !==
                        "logo"
                    ).length > 0
                      ? "pointer"
                      : "not-allowed",
                  fontWeight: "900",
                  fontSize: "13px",
                  boxShadow:
                    imagensBanner.filter(
                      (imagem) =>
                        imagem.tipo !==
                        "logo"
                    ).length > 0
                      ? "0 12px 26px rgba(34,211,238,.2)"
                      : "none",
                }}
              >
                ✨ Aplicar Template
              </button>

              <div
                style={{
                  marginTop: "10px",
                  padding: "10px",
                  borderRadius:
                    "10px",
                  border:
                    "1px solid #334155",
                  background:
                    "#0f172a",
                  color:
                    "#cbd5e1",
                  fontSize:
                    "10px",
                  lineHeight: 1.5,
                }}
              >
                O template ajusta
                automaticamente fundo,
                formato, produto, textos,
                selo, logo e área segura.
                Os elementos continuam
                totalmente editáveis.
              </div>
            </div>
          )}

                    {ferramentaStudio ===
            "exportacaoPro" && (
            <BannerExportacaoPro
              formato={
                tipoExportacao
              }
              setFormato={
                setTipoExportacao
              }
              resolucao={
                formatoExportacao
              }
              setResolucao={
                setFormatoExportacao
              }
              qualidade={
                qualidadeExportacaoPro
              }
              setQualidade={
                setQualidadeExportacaoPro
              }
              fundoTransparente={
                fundoTransparenteExportacao
              }
              setFundoTransparente={
                setFundoTransparenteExportacao
              }
              nomeArquivo={
                nomeArquivoExportacao
              }
              setNomeArquivo={
                setNomeArquivoExportacao
              }
              previewImagem={
                previewExportacaoImagem
              }
              exportando={
                exportandoBanner
              }
              onGerarPreview={
                gerarPreviewBanner
              }
              onExportar={
                exportarBannerProfissional
              }
              onExportarTodos={
                exportarTodosFormatos
              }
            />
          )}

{ferramentaStudio === "finalizar" && (
            <div>
              <h3 style={{ color: "#67e8f9", marginTop: 0 }}>
                📤 Configurações de Exportação
              </h3>

              <label style={labelExportacaoStyle}>
                Formato
              </label>

              <select
                value={formatoExportacao}
                onChange={(evento) =>
                  setFormatoExportacao(
                    evento.target.value
                  )
                }
                style={inputExportacaoStyle}
              >
                {Object.entries(
                  FORMATOS_EXPORTACAO
                ).map(([chave, formato]) => (
                  <option
                    key={chave}
                    value={chave}
                  >
                    {formato.nome} — {formato.largura} × {formato.altura}
                  </option>
                ))}
              </select>

              <label style={labelExportacaoStyle}>
                Tipo de arquivo
              </label>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                }}
              >
                {[
                  ["png", "PNG"],
                  ["jpg", "JPG"],
                ].map(([valor, nome]) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() =>
                      setTipoExportacao(valor)
                    }
                    style={{
                      ...botaoOpcaoExportacao,
                      border:
                        tipoExportacao === valor
                          ? "2px solid #22d3ee"
                          : "1px solid #334155",
                      background:
                        tipoExportacao === valor
                          ? "#164e63"
                          : "#020617",
                    }}
                  >
                    {nome}
                  </button>
                ))}
              </div>

              <label style={labelExportacaoStyle}>
                Qualidade
              </label>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "8px",
                }}
              >
                {[1, 2, 4].map((escala) => (
                  <button
                    key={escala}
                    type="button"
                    onClick={() =>
                      setEscalaExportacao(escala)
                    }
                    style={{
                      ...botaoOpcaoExportacao,
                      border:
                        escalaExportacao === escala
                          ? "2px solid #22d3ee"
                          : "1px solid #334155",
                      background:
                        escalaExportacao === escala
                          ? "#164e63"
                          : "#020617",
                    }}
                  >
                    {escala}x
                  </button>
                ))}
              </div>

              <label style={labelExportacaoStyle}>
                Nome do arquivo
              </label>

              <input
                value={nomeArquivoExportacao}
                onChange={(evento) =>
                  setNomeArquivoExportacao(
                    evento.target.value
                  )
                }
                placeholder="banner-appia"
                style={inputExportacaoStyle}
              />

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "9px",
                  color: "#cbd5e1",
                  marginTop: "14px",
                  cursor:
                    tipoExportacao === "png"
                      ? "pointer"
                      : "not-allowed",
                  opacity:
                    tipoExportacao === "png"
                      ? 1
                      : 0.5,
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    fundoTransparenteExportacao
                  }
                  disabled={
                    tipoExportacao !== "png"
                  }
                  onChange={(evento) =>
                    setFundoTransparenteExportacao(
                      evento.target.checked
                    )
                  }
                />
                Fundo transparente
              </label>

              <div
                style={{
                  marginTop: "16px",
                  padding: "12px",
                  borderRadius: "10px",
                  background: "#020617",
                  border: "1px solid #334155",
                  color: "#94a3b8",
                  fontSize: "12px",
                  lineHeight: 1.5,
                }}
              >
                Saída: {
                  formatoSelecionadoExportacao.largura *
                  escalaExportacao
                } × {
                  formatoSelecionadoExportacao.altura *
                  escalaExportacao
                } px
              </div>

              <div
                style={{
                  marginTop: "14px",
                  padding: "11px",
                  borderRadius: "10px",
                  border: "1px solid #164e63",
                  background: "#082f49",
                  color: "#bae6fd",
                  fontSize: "12px",
                  lineHeight: 1.45,
                  textAlign: "center",
                }}
              >
                ✅ Será salva somente a prancheta
                do lado direito.
                <br />
                Menus, botões e barras não entram
                na imagem.
              </div>

              <button
                type="button"
                onClick={
                  exportarBannerProfissional
                }
                style={{
                  width: "100%",
                  marginTop: "16px",
                  padding: "13px",
                  borderRadius: "10px",
                  border: "none",
                  background:
                    "linear-gradient(135deg,#16a34a,#0891b2)",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                📸 Salvar somente o banner
              </button>
            </div>
          )}
        </div>
<div
  style={{
    width: "100%",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  }}
>
  <div
    style={{
      width: "100%",
      maxWidth: "980px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "10px",
      flexWrap: "wrap",
      marginBottom: "10px",
      padding: "9px 12px",
      boxSizing: "border-box",
      borderRadius: "12px",
      border: "1px solid #334155",
      background: "#0f172a",
      boxShadow: "0 12px 30px rgba(0,0,0,0.22)",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexWrap: "wrap",
      }}
    >
      <strong style={{ color: "#67e8f9" }}>
        🖼️ Área de criação
      </strong>

      {elementoSelecionado && (
        <>
          <span
            style={{
              maxWidth: "160px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: "#cbd5e1",
              fontSize: "11px",
              fontWeight: "bold",
            }}
            title={
              obterNomeElementoSelecionado()
            }
          >
            {obterNomeElementoSelecionado()}
          </span>

          <div
            data-nao-exportar="true"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              flexWrap: "wrap",
              paddingLeft: "4px",
              borderLeft:
                "1px solid #334155",
            }}
          >
            {[
              [
                "esquerda",
                "⇤",
                "Alinhar à esquerda",
              ],
              [
                "centroHorizontal",
                "↔",
                "Centralizar horizontalmente",
              ],
              [
                "direita",
                "⇥",
                "Alinhar à direita",
              ],
              [
                "topo",
                "⇡",
                "Alinhar ao topo",
              ],
              [
                "centroVertical",
                "↕",
                "Centralizar verticalmente",
              ],
              [
                "base",
                "⇣",
                "Alinhar à base",
              ],
              [
                "centroCompleto",
                "◎",
                "Centralizar na prancheta",
              ],
            ].map(
              ([
                tipo,
                icone,
                titulo,
              ]) => (
                <button
                  key={tipo}
                  type="button"
                  title={titulo}
                  onClick={() =>
                    alinharElementoSelecionado(
                      tipo
                    )
                  }
                  style={{
                    width: "30px",
                    height: "30px",
                    padding: 0,
                    borderRadius: "7px",
                    border:
                      "1px solid #475569",
                    background:
                      "#020617",
                    color: "#e2e8f0",
                    cursor: "pointer",
                    fontSize: "15px",
                    fontWeight: "bold",
                  }}
                >
                  {icone}
                </button>
              )
            )}
          </div>
        </>
      )}
    </div>
  </div>

  <div
    style={{
      width: "100%",
      maxWidth: "980px",
      boxSizing: "border-box",
      marginBottom: "10px",
      padding: "12px 14px",
      borderRadius: "12px",
      border: "1px solid #6d28d9",
      background:
        "linear-gradient(135deg,#1e1b4b,#0f172a)",
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent:
          "space-between",
        alignItems: "center",
        gap: "10px",
        flexWrap: "wrap",
      }}
    >
      <div>
        <strong
          style={{
            display: "block",
            color: "#ffffff",
            fontSize: "13px",
          }}
        >
          🎨 4 Fundos com IA
        </strong>

        <span
          style={{
            display: "block",
            marginTop: "3px",
            color: "#c4b5fd",
            fontSize: "10px",
          }}
        >
          Escolha A, B, C ou D. Apenas o
          fundo muda; foto, textos, selos
          e logos permanecem iguais.
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: "7px",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() =>
            selecionarVersaoBanner(
              "original"
            )
          }
          style={{
            padding: "8px 10px",
            borderRadius: "8px",
            border:
              versaoBannerAtiva ===
              "original"
                ? "1px solid #22d3ee"
                : "1px solid #334155",
            background:
              versaoBannerAtiva ===
              "original"
                ? "#164e63"
                : "#020617",
            color: "#ffffff",
            cursor: "pointer",
            fontSize: "11px",
            fontWeight: "bold",
          }}
        >
          ↩ Original
        </button>


      </div>
    </div>

    {ideiasBannerIA.length > 0 && (
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(4, minmax(110px, 1fr))",
          gap: "8px",
          marginTop: "11px",
        }}
      >
        {ideiasBannerIA.map(
          (ideia) => (
            <button
              key={ideia.id}
              type="button"
              onClick={() =>
                selecionarIdeiaBannerIA(
                  ideia
                )
              }
              style={{
                padding: "7px",
                borderRadius: "10px",
                border:
                  ideiaBannerSelecionada ===
                  ideia.id
                    ? "2px solid #22d3ee"
                    : "1px solid #475569",
                background: "#020617",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  height: "42px",
                  borderRadius: "7px",
                  background:
                    ideia.fundoStudio,
                  marginBottom: "6px",
                }}
              />

              <span
                style={{
                  color: "#ffffff",
                  fontSize: "10px",
                  fontWeight: "bold",
                }}
              >
                {ideia.nome}
              </span>
            </button>
          )
        )}
      </div>
    )}

    <div
      data-nao-exportar="true"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "7px",
        flexWrap: "wrap",
        marginTop: "12px",
        paddingTop: "11px",
        borderTop:
          "1px solid rgba(148,163,184,.24)",
      }}
    >
      <strong
        style={{
          color: "#67e8f9",
          marginRight: "3px",
          fontSize: "12px",
        }}
      >
        🔍 Zoom
      </strong>

      {[25, 50, 75, 100, 150, 200].map(
        (valor) => (
          <button
            key={valor}
            type="button"
            onClick={() =>
              setZoomCanvas(valor)
            }
            style={{
              padding: "6px 9px",
              borderRadius: "7px",
              border:
                zoomCanvas === valor
                  ? "1px solid #22d3ee"
                  : "1px solid #475569",
              background:
                zoomCanvas === valor
                  ? "#164e63"
                  : "#020617",
              color: "#ffffff",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: "bold",
            }}
          >
            {valor}%
          </button>
        )
      )}

      <input
        type="range"
        min="25"
        max="200"
        step="5"
        value={zoomCanvas}
        onChange={(evento) =>
          setZoomCanvas(
            Number(
              evento.target.value
            )
          )
        }
        style={{
          width: "120px",
          cursor: "pointer",
        }}
      />

      <strong
        style={{
          color: "#67e8f9",
          minWidth: "48px",
          textAlign: "right",
          fontSize: "13px",
        }}
      >
        {zoomCanvas}%
      </strong>
    </div>

    <div
      data-nao-exportar="true"
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: "8px",
        flexWrap: "wrap",
        marginTop: "9px",
      }}
    >
      <button
        type="button"
        onClick={() =>
          setMostrarGrade(
            (atual) => !atual
          )
        }
        style={{
          padding: "7px 10px",
          borderRadius: "8px",
          border:
            mostrarGrade
              ? "1px solid #22d3ee"
              : "1px solid #475569",
          background:
            mostrarGrade
              ? "#164e63"
              : "#020617",
          color: "#ffffff",
          cursor: "pointer",
          fontWeight: "bold",
          fontSize: "11px",
        }}
      >
        ▦ Grade
      </button>

      <button
        type="button"
        onClick={() =>
          setSnapNaGrade(
            (atual) => !atual
          )
        }
        style={{
          padding: "7px 10px",
          borderRadius: "8px",
          border:
            snapNaGrade
              ? "1px solid #22d3ee"
              : "1px solid #475569",
          background:
            snapNaGrade
              ? "#164e63"
              : "#020617",
          color: "#ffffff",
          cursor: "pointer",
          fontWeight: "bold",
          fontSize: "11px",
        }}
      >
        🧲 Snap
      </button>

      <select
        value={tamanhoGrade}
        onChange={(evento) =>
          setTamanhoGrade(
            Number(
              evento.target.value
            )
          )
        }
        title="Espaçamento da grade"
        style={{
          height: "31px",
          borderRadius: "8px",
          border:
            "1px solid #475569",
          background: "#020617",
          color: "#ffffff",
          padding: "0 8px",
          cursor: "pointer",
          fontSize: "11px",
          fontWeight: "bold",
        }}
      >
        <option value={10}>
          Grade 10 px
        </option>
        <option value={20}>
          Grade 20 px
        </option>
        <option value={40}>
          Grade 40 px
        </option>
        <option value={50}>
          Grade 50 px
        </option>
      </select>

      <button
        type="button"
        onClick={() => {
          setDeslocamentoPrancheta({
            x: 0,
            y: 0,
          });
          setZoomCanvas(100);
        }}
        style={{
          padding: "7px 10px",
          borderRadius: "8px",
          border:
            "1px solid #475569",
          background: "#020617",
          color: "#ffffff",
          cursor: "pointer",
          fontWeight: "bold",
          fontSize: "11px",
        }}
      >
        ⌂ Centralizar
      </button>

      <span
        style={{
          color: "#94a3b8",
          fontSize: "10px",
          fontWeight: "bold",
        }}
      >
        Segure Espaço e arraste
      </span>
    </div>
  </div>

  <div
    onMouseDown={(evento) => {
      if (!espacoPressionado) {
        return;
      }

      evento.preventDefault();

      setMovendoPrancheta(true);

      setInicioPan({
        x:
          evento.clientX -
          deslocamentoPrancheta.x,
        y:
          evento.clientY -
          deslocamentoPrancheta.y,
      });
    }}
    onMouseMove={(evento) => {
      if (!movendoPrancheta) {
        return;
      }

      setDeslocamentoPrancheta({
        x:
          evento.clientX -
          inicioPan.x,
        y:
          evento.clientY -
          inicioPan.y,
      });
    }}
    onMouseUp={() => {
      setMovendoPrancheta(false);
    }}
    onMouseLeave={() => {
      setMovendoPrancheta(false);
    }}
    onWheel={(evento) => {
      if (!evento.ctrlKey) {
        return;
      }

      evento.preventDefault();

      setZoomCanvas((atual) => {
        const passo = evento.deltaY < 0 ? 10 : -10;

        return Math.min(
          200,
          Math.max(25, atual + passo)
        );
      });
    }}
    style={{
      width: "100%",
      maxWidth: "980px",
      overflow: "auto",
      padding: "18px",
      boxSizing: "border-box",
      borderRadius: "14px",
      background: "#020617",
      border: "1px solid #1e293b",
      position: "relative",
      cursor:
        espacoPressionado
          ? movendoPrancheta
            ? "grabbing"
            : "grab"
          : "default",
      userSelect:
        espacoPressionado
          ? "none"
          : "auto",
    }}
  >
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        zoom: zoomCanvas / 100,
        transform: `translate(
          ${deslocamentoPrancheta.x}px,
          ${deslocamentoPrancheta.y}px
        )`,
        transformOrigin: "center",
        transition:
          movendoPrancheta
            ? "none"
            : "transform .08s ease-out",
      }}
    >
 <div
  id="banner-prancheta-exportavel"
  data-area-exportavel="banner"
  onMouseDown={(evento) => {
    const clicouEmElemento =
      evento.target.closest(
        '[data-elemento-banner="true"]'
      );

    if (!clicouEmElemento) {
      setElementoSelecionado(null);
      setImagemSelecionadaId(null);
      setTextoArrastando(null);
      setImagemArrastandoId(null);
      setArrastando(false);
    }
  }}
  onMouseMove={(evento) => {
    const rect =
      evento.currentTarget.getBoundingClientRect();

    const fatorZoom =
      Math.max(0.25, zoomCanvas / 100);

    const x =
      (evento.clientX - rect.left) /
      fatorZoom;

    const y =
      (evento.clientY - rect.top) /
      fatorZoom;

    const elementoMovendoId =
      imagemArrastandoId ??
      textoArrastando;

    const snap =
      calcularSnapElemento({
        x,
        y,
        larguraCanvas:
          rect.width / fatorZoom,
        alturaCanvas:
          rect.height / fatorZoom,
        ignorarId:
          elementoMovendoId,
      });

    if (arrastando) {
      setPosicaoProduto({
        x: snap.x,
        y: snap.y,
      });
    }

    if (
      textoArrastando !== null
    ) {
      setTextosStudio(
        (anteriores) =>
          anteriores.map(
            (texto) =>
              texto.id ===
              textoArrastando
                ? {
                    ...texto,
                    x: snap.x,
                    y: snap.y,
                  }
                : texto
          )
      );
    }

    if (
      imagemArrastandoId !==
      null
    ) {
      setImagensBanner(
        (anteriores) =>
          anteriores.map(
            (imagem) =>
              imagem.id ===
              imagemArrastandoId
                ? {
                    ...imagem,
                    x: snap.x,
                    y: snap.y,
                  }
                : imagem
          )
      );
    }

    const movendoElemento =
      arrastando ||
      textoArrastando !== null ||
      imagemArrastandoId !== null;

    setMostrarGuiaVertical(
      movendoElemento
        ? snap.guiaX
        : null
    );

    setMostrarGuiaHorizontal(
      movendoElemento
        ? snap.guiaY
        : null
    );
  }}
  onMouseUp={() => {
    setArrastando(false);
    setTextoArrastando(null);
    setImagemArrastandoId(null);
    setMostrarGuiaVertical(null);
    setMostrarGuiaHorizontal(null);
  }}
  onMouseLeave={() => {
    setArrastando(false);
    setTextoArrastando(null);
    setImagemArrastandoId(null);
    setMostrarGuiaVertical(null);
    setMostrarGuiaHorizontal(null);
  }}
  style={{
    width: "100%",
    maxWidth:
      `${larguraPreviewExportacao}px`,

    aspectRatio:
      `${formatoSelecionadoExportacao.largura} / ${formatoSelecionadoExportacao.altura}`,

    height: "auto",
    margin: "0 auto",

    background:
      fundoTransparenteExportacao &&
      tipoExportacao === "png"
        ? "transparent"
        : fundoStudio,

    border:
      "2px dashed #334155",

    borderRadius: "16px",
    position: "relative",
    flexShrink: 0,
    overflow: "hidden",

    boxShadow:
      "0 10px 30px rgba(0,0,0,.30)",
  }}
>
 
    {mostrarGrade && (
    <div
      data-nao-exportar="true"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 2,
        pointerEvents: "none",
        backgroundImage: `
          linear-gradient(
            to right,
            rgba(103,232,249,.18) 1px,
            transparent 1px
          ),
          linear-gradient(
            to bottom,
            rgba(103,232,249,.18) 1px,
            transparent 1px
          )
        `,
        backgroundSize:
          `${tamanhoGrade}px ${tamanhoGrade}px`,
      }}
    />
  )}

  <div
    data-nao-exportar="true"
    style={{
      position: "absolute",
      left: "24px",
      right: 0,
      top: 0,
      height: "24px",
      zIndex: 1001,
      pointerEvents: "none",
      borderBottom:
        "1px solid rgba(148,163,184,.45)",
      background:
        "repeating-linear-gradient(to right,rgba(226,232,240,.75) 0 1px,transparent 1px 10px),rgba(2,6,23,.72)",
    }}
  />

  <div
    data-nao-exportar="true"
    style={{
      position: "absolute",
      top: "24px",
      bottom: 0,
      left: 0,
      width: "24px",
      zIndex: 1001,
      pointerEvents: "none",
      borderRight:
        "1px solid rgba(148,163,184,.45)",
      background:
        "repeating-linear-gradient(to bottom,rgba(226,232,240,.75) 0 1px,transparent 1px 10px),rgba(2,6,23,.72)",
    }}
  />

  {mostrarAreaSegura && (
      <div
        data-nao-exportar="true"
        style={{
          position: "absolute",
          inset: "7%",
          border:
            "2px dashed rgba(250,204,21,.75)",
          borderRadius: "10px",
          zIndex: 998,
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            position: "absolute",
            left: "10px",
            top: "8px",
            color: "#fde047",
            background: "rgba(2,6,23,.82)",
            borderRadius: "6px",
            padding: "4px 7px",
            fontSize: "10px",
            fontWeight: "bold",
          }}
        >
          ÁREA SEGURA
        </span>
      </div>
    )}

    {mostrarGuiaVertical !== null && (
      <div
        style={{
          position: "absolute",
          left: `${mostrarGuiaVertical}px`,
          top: 0,
          bottom: 0,
          width: "2px",
          background: "#22d3ee",
          zIndex: 999,
          pointerEvents: "none",
        }}
      />
    )}

    {mostrarGuiaHorizontal !== null && (
      <div
        style={{
          position: "absolute",
          top: `${mostrarGuiaHorizontal}px`,
          left: 0,
          right: 0,
          height: "2px",
          background: "#22d3ee",
          zIndex: 999,
          pointerEvents: "none",
        }}
      />
    )}

    {textoSelecionado && (
      <BannerToolbar
        modo="texto"
        texto={textoSelecionado}
        onAtualizar={atualizarTextoSelecionado}
        onDuplicar={duplicarElementoSelecionado}
        onExcluir={excluirTextoSelecionado}
      />
    )}

    {imagensBanner
  .filter((imagem) => {
    const camada = camadasStudio.find(
      (item) => item.id === imagem.id
    );

    return camada?.visivel !== false;
  })
  .map((imagem) => (
  <div
    key={imagem.id}
    data-elemento-banner="true"
    onMouseDown={(evento) => {
  const camadaImagem = camadasStudio.find(
    (camada) => camada.id === imagem.id
  );

  if (
    evento.button !== 0 ||
    camadaImagem?.bloqueado
  ) {
    return;
  }

  evento.preventDefault();
  evento.stopPropagation();

  setArrastando(false);
  setTextoArrastando(null);

  setImagemSelecionadaId(
    imagem.id
  );

  setElementoSelecionado(
    imagem.id
  );

  setCamadasStudio((anteriores) => {
  const atual =
    anteriores.find(
      (camada) =>
        camada.id === imagem.id
    );

  return [
    ...anteriores.filter(
      (camada) =>
        camada.id !== imagem.id
    ),
    atual,
  ].filter(Boolean);
});

  setImagemArrastandoId(
    imagem.id
  );
}}
    style={{
      position: "absolute",

      left: imagem.x ?? 450,
      top: imagem.y ?? 300,

      width:
        imagem.tipo === "logo"
          ? "240px"
          : imagem.tipo ===
              "objeto"
            ? "280px"
            : imagem.tipo ===
                "icone"
              ? "190px"
              : "320px",
      height:
        imagem.tipo === "logo"
          ? "130px"
          : imagem.tipo ===
              "objeto"
            ? "220px"
            : imagem.tipo ===
                "icone"
              ? "190px"
              : "420px",

      transform: `
        translate(-50%, -50%)
        rotate(${imagem.rotacao || 0}deg)
        scale(${Number(imagem.escala) || 1})
      `,

      transformOrigin: "center",

      display: "flex",
      alignItems: "center",
      justifyContent: "center",

      cursor: camadasStudio.find(
        (camada) => camada.id === imagem.id
      )?.bloqueado
        ? "not-allowed"
        : "grab",
      userSelect: "none",

      zIndex:
        camadasStudio.findIndex(
          (camada) =>
            camada.id === imagem.id
        ) + 1,

      outline:
        elementoSelecionado ===
        imagem.id
          ? "2px solid #22d3ee"
          : "none",

      outlineOffset: "4px",
    }}
  >
    <img
      src={imagem.src}
      alt={
        imagem.tipo === "logo"
          ? "Logo"
          : imagem.tipo ===
              "objeto"
            ? imagem.nome ||
              "Objeto"
            : imagem.tipo ===
                "icone"
              ? imagem.nome ||
                "Ícone"
              : "Produto"
      }
      draggable={false}
      onDragStart={(evento) => evento.preventDefault()}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        objectFit: "contain",
        pointerEvents: "none",
        userSelect: "none",
        filter:
          obterFiltroEfeitoRapido(imagem),
      }}
    />

    {elementoSelecionado ===
      imagem.id && (
      <>
        {[
          {
            chave: "noroeste",
            left: "-8px",
            top: "-8px",
            cursor: "nwse-resize",
          },
          {
            chave: "norte",
            left: "50%",
            top: "-8px",
            transform:
              "translateX(-50%)",
            cursor: "ns-resize",
          },
          {
            chave: "nordeste",
            right: "-8px",
            top: "-8px",
            cursor: "nesw-resize",
          },
          {
            chave: "oeste",
            left: "-8px",
            top: "50%",
            transform:
              "translateY(-50%)",
            cursor: "ew-resize",
          },
          {
            chave: "leste",
            right: "-8px",
            top: "50%",
            transform:
              "translateY(-50%)",
            cursor: "ew-resize",
          },
          {
            chave: "sudoeste",
            left: "-8px",
            bottom: "-8px",
            cursor: "nesw-resize",
          },
          {
            chave: "sul",
            left: "50%",
            bottom: "-8px",
            transform:
              "translateX(-50%)",
            cursor: "ns-resize",
          },
        ].map((alca) => (
          <button
            key={alca.chave}
            type="button"
            data-nao-exportar="true"
            title={`Redimensionar ${alca.chave}`}
            onMouseDown={(evento) =>
              iniciarRedimensionamentoImagem(
                evento,
                imagem,
                alca.chave
              )
            }
            style={{
              position: "absolute",
              left: alca.left,
              right: alca.right,
              top: alca.top,
              bottom: alca.bottom,
              transform:
                alca.transform,
              width: "13px",
              height: "13px",
              boxSizing:
                "border-box",
              border:
                "2px solid #ffffff",
              borderRadius:
                "3px",
              background:
                "#22d3ee",
              boxShadow:
                "0 2px 7px rgba(0,0,0,.45)",
              cursor:
                alca.cursor,
              pointerEvents:
                "auto",
              padding: 0,
              zIndex: 52,
            }}
          />
        ))}

        <button
          type="button"
          data-nao-exportar="true"
          title="Redimensionar"
          onMouseDown={(evento) =>
            iniciarRedimensionamentoImagem(
              evento,
              imagem,
              "sudeste"
            )
          }
          style={{
            position: "absolute",
            right: "-8px",
            bottom: "-8px",
            width: "16px",
            height: "16px",
            padding: 0,
            boxSizing:
              "border-box",
            borderRadius: "3px",
            border:
              "2px solid #ffffff",
            background:
              "#22d3ee",
            boxShadow:
              "0 2px 8px rgba(0,0,0,.45)",
            cursor:
              "nwse-resize",
            zIndex: 54,
          }}
        />

        <div
          data-nao-exportar="true"
          style={{
            position: "absolute",
            top: "-45px",
            left: "50%",
            width: "2px",
            height: "36px",
            background: "#22c55e",
            transform:
              "translateX(-50%)",
            pointerEvents: "none",
            zIndex: 49,
          }}
        />

        <button
          type="button"
          data-nao-exportar="true"
          title="Rotacionar"
          onMouseDown={(evento) => {
            evento.preventDefault();
            evento.stopPropagation();
            setImagemArrastandoId(null);
            iniciarRotacaoImagem(
              evento,
              imagem
            );
          }}
          style={{
            position: "absolute",
            top: "-61px",
            left: "50%",
            transform:
              "translateX(-50%)",
            width: "26px",
            height: "26px",
            padding: 0,
            borderRadius: "50%",
            border:
              "3px solid #ffffff",
            background: "#22c55e",
            boxShadow:
              "0 2px 8px rgba(0,0,0,.45)",
            cursor: "grab",
            zIndex: 54,
          }}
        >
          <span
            style={{
              display: "block",
              color: "#ffffff",
              fontSize: "13px",
              lineHeight: 1,
              pointerEvents:
                "none",
            }}
          >
            ↻
          </span>
        </button>

        <div
          data-nao-exportar="true"
          style={{
            position: "absolute",
            left: "50%",
            bottom: "-42px",
            transform:
              "translateX(-50%)",
            padding: "5px 8px",
            borderRadius: "7px",
            background:
              "rgba(2,6,23,.94)",
            border:
              "1px solid #22d3ee",
            color: "#e0f2fe",
            fontSize: "10px",
            fontWeight: "bold",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            boxShadow:
              "0 5px 14px rgba(0,0,0,.34)",
            zIndex: 55,
          }}
        >
          X: {Math.round(
            Number(imagem.x) || 0
          )} · Y: {Math.round(
            Number(imagem.y) || 0
          )}
          {" · "}
          L: {Math.round(
            (
              imagem.tipo === "logo"
                ? 240
                : imagem.tipo ===
                    "objeto"
                  ? 280
                  : imagem.tipo ===
                      "icone"
                    ? 190
                    : 320
            ) *
              (
                Number(
                  imagem.escala
                ) || 1
              )
          )}
          {" · "}
          A: {Math.round(
            (
              imagem.tipo === "logo"
                ? 130
                : imagem.tipo ===
                    "objeto"
                  ? 220
                  : imagem.tipo ===
                      "icone"
                    ? 190
                    : 420
            ) *
              (
                Number(
                  imagem.escala
                ) || 1
              )
          )}
          {" · "}
          ↻ {Math.round(
            Number(
              imagem.rotacao
            ) || 0
          )}°
        </div>
      </>
    )}
  </div>
))}

    {imagensBanner.length === 0 &&
  textosStudio.length === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            color: "#64748b",
            fontWeight: "bold",
            fontSize: "18px",
          }}
        >
          <span>
            Selecione uma imagem na Galeria
          </span>

          <button
            type="button"
            onClick={() => {
              localStorage.setItem(
                "modoGaleria",
                "selecionarParaBanner"
              );
              setScreen("galeria");
            }}
            style={{
              background:
                "linear-gradient(135deg,#2563eb,#22d3ee)",
              color: "#ffffff",
              border: "none",
              padding: "12px 22px",
              borderRadius: "12px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            🖼️ Abrir Galeria
          </button>
        </div>
      )}
{textosStudio
  .filter((item) => {
    const camada = camadasStudio.find(
      (camadaAtual) => camadaAtual.id === item.id
    );

    return camada?.visivel !== false;
  })
  .map((item) => (
  <div
    key={item.id}
    data-elemento-banner="true"
    onMouseDown={(evento) => {
      const camadaTexto = camadasStudio.find(
        (camada) => camada.id === item.id
      );

      if (camadaTexto?.bloqueado) {
        return;
      }

      if (editandoTextoId === item.id) {
        evento.stopPropagation();
        return;
      }

      evento.preventDefault();
      evento.stopPropagation();

      setArrastando(false);
      setTextoArrastando(item.id);
      setElementoSelecionado(item.id);

      setTituloStudio(
        item.texto || ""
      );

      setCorTituloStudio(
        item.cor || "#ffffff"
      );

      setTamanhoTituloStudio(
        Number(item.tamanho) || 38
      );
    }}
    onDoubleClick={(evento) =>
      iniciarEdicaoDiretaTexto(
        evento,
        item
      )
    }
    style={{
      position: "absolute",
      left: item.x ?? 450,
      top: item.y ?? 120,

      transform: `
        translate(-50%, -50%)
        rotate(${item.rotacao || 0}deg)
      `,

      color:
        item.cor || "#ffffff",

      fontSize: `${
        Number(item.tamanho) || 38
      }px`,

      fontWeight:
        item.negrito === false
          ? "normal"
          : "bold",

      fontStyle:
        item.italico
          ? "italic"
          : "normal",

      textDecoration:
        item.sublinhado
          ? "underline"
          : "none",

      fontFamily:
        item.fonte ||
        "Arial, Helvetica, sans-serif",

      textAlign:
        item.alinhamento || "center",

      textShadow:
        item.sombra === false
          ? "none"
          : "0 2px 8px rgba(0,0,0,.65)",

      cursor: camadasStudio.find(
        (camada) => camada.id === item.id
      )?.bloqueado
        ? "not-allowed"
        : "grab",
      userSelect: "none",
      width:
        item.larguraMaxima
          ? `${item.larguraMaxima}px`
          : "auto",
      maxWidth:
        item.larguraMaxima
          ? `${item.larguraMaxima}px`
          : "none",
      whiteSpace:
        item.quebrarLinha
          ? "normal"
          : "nowrap",
      lineHeight:
        item.quebrarLinha
          ? 1.08
          : "normal",
      overflowWrap: "break-word",
      boxSizing: "border-box",

      padding:
        item.tipo === "selo"
          ? "12px 18px"
          : "4px 8px",

      borderRadius:
        item.tipo === "selo"
          ? item.formatoSelo ===
            "escudo"
            ? "18px 18px 34px 34px"
            : item.formatoSelo ===
                "impacto"
              ? "9px"
              : item.formatoSelo ===
                  "faixa"
                ? "5px"
                : item.formatoSelo ===
                    "premium"
                  ? "14px"
                  : "999px"
          : "0",

      background:
        item.tipo === "selo"
          ? item.fundo ||
            "#2563eb"
          : "transparent",

      border:
        item.tipo === "selo"
          ? `3px solid ${
              item.bordaSelo ||
              "rgba(255,255,255,.88)"
            }`
          : "none",

      boxShadow:
        item.tipo === "selo"
          ? item.formatoSelo ===
            "impacto"
            ? "0 12px 28px rgba(127,29,29,.48), inset 0 0 0 2px rgba(255,255,255,.12)"
            : item.formatoSelo ===
                "premium"
              ? "0 12px 28px rgba(0,0,0,.38), inset 0 0 18px rgba(255,255,255,.16)"
              : "0 10px 24px rgba(0,0,0,.32)"
          : "none",

      zIndex:
        camadasStudio.findIndex(
          (camada) =>
            camada.id === item.id
        ) + 2,

      outline:
        elementoSelecionado ===
        item.id
          ? "2px dashed #22d3ee"
          : "none",

      outlineOffset: "4px",
    }}
  >
    <div
      data-editor-texto-id={item.id}
      contentEditable={
        editandoTextoId === item.id
      }
      suppressContentEditableWarning
      spellCheck={false}
      onMouseDown={(evento) => {
        if (editandoTextoId === item.id) {
          evento.stopPropagation();
        }
      }}
      onBlur={(evento) =>
        finalizarEdicaoDiretaTexto(
          evento,
          item
        )
      }
      onKeyDown={
        controlarTeclaEdicaoTexto
      }
      style={{
        outline:
          editandoTextoId === item.id
            ? "2px solid #facc15"
            : "none",
        outlineOffset: "5px",
        borderRadius: "4px",
        cursor:
          editandoTextoId === item.id
            ? "text"
            : "inherit",
        minWidth:
          editandoTextoId === item.id
            ? "45px"
            : "auto",
        padding:
          editandoTextoId === item.id
            ? "2px 5px"
            : 0,
      }}
      title="Duplo clique para editar"
    >
      {item.texto}
    </div>

    {elementoSelecionado ===
      item.id &&
      editandoTextoId !== item.id && (
      <>
        {[
          {
            chave: "noroeste",
            left: "-10px",
            top: "-10px",
            cursor: "nwse-resize",
          },
          {
            chave: "norte",
            left: "50%",
            top: "-10px",
            transform:
              "translateX(-50%)",
            cursor: "ns-resize",
          },
          {
            chave: "nordeste",
            right: "-10px",
            top: "-10px",
            cursor: "nesw-resize",
          },
          {
            chave: "oeste",
            left: "-10px",
            top: "50%",
            transform:
              "translateY(-50%)",
            cursor: "ew-resize",
          },
          {
            chave: "leste",
            right: "-10px",
            top: "50%",
            transform:
              "translateY(-50%)",
            cursor: "ew-resize",
          },
          {
            chave: "sudoeste",
            left: "-10px",
            bottom: "-10px",
            cursor: "nesw-resize",
          },
          {
            chave: "sul",
            left: "50%",
            bottom: "-10px",
            transform:
              "translateX(-50%)",
            cursor: "ns-resize",
          },
        ].map((alca) => (
          <button
            key={alca.chave}
            type="button"
            data-nao-exportar="true"
            title={`Redimensionar ${alca.chave}`}
            onMouseDown={(evento) =>
              iniciarRedimensionamentoTexto(
                evento,
                item,
                alca.chave
              )
            }
            style={{
              position: "absolute",
              left: alca.left,
              right: alca.right,
              top: alca.top,
              bottom: alca.bottom,
              transform:
                alca.transform,
              width: "13px",
              height: "13px",
              boxSizing:
                "border-box",
              border:
                "2px solid #ffffff",
              borderRadius: "3px",
              background:
                "#22d3ee",
              boxShadow:
                "0 2px 7px rgba(0,0,0,.45)",
              cursor:
                alca.cursor,
              pointerEvents:
                "auto",
              padding: 0,
              zIndex: 52,
            }}
          />
        ))}

        <button
          type="button"
          data-nao-exportar="true"
          title="Redimensionar texto"
          onMouseDown={(evento) =>
            iniciarRedimensionamentoTexto(
              evento,
              item,
              "sudeste"
            )
          }
          style={{
            position: "absolute",
            right: "-10px",
            bottom: "-10px",
            width: "17px",
            height: "17px",
            padding: 0,
            boxSizing:
              "border-box",
            borderRadius: "3px",
            border:
              "2px solid #ffffff",
            background: "#22d3ee",
            boxShadow:
              "0 2px 8px rgba(0,0,0,.45)",
            cursor:
              "nwse-resize",
            zIndex: 54,
          }}
        />

        <div
          data-nao-exportar="true"
          style={{
            position: "absolute",
            top: "-43px",
            left: "50%",
            width: "2px",
            height: "34px",
            background: "#22c55e",
            transform:
              "translateX(-50%)",
            pointerEvents: "none",
            zIndex: 49,
          }}
        />

        <button
          type="button"
          data-nao-exportar="true"
          title="Rotacionar texto"
          onMouseDown={(evento) =>
            iniciarRotacaoTexto(
              evento,
              item
            )
          }
          style={{
            position: "absolute",
            top: "-59px",
            left: "50%",
            transform:
              "translateX(-50%)",
            width: "25px",
            height: "25px",
            padding: 0,
            borderRadius: "50%",
            border:
              "3px solid #ffffff",
            background: "#22c55e",
            boxShadow:
              "0 2px 8px rgba(0,0,0,.45)",
            cursor: "grab",
            zIndex: 54,
          }}
        >
          <span
            style={{
              display: "block",
              color: "#ffffff",
              fontSize: "13px",
              lineHeight: 1,
              pointerEvents:
                "none",
            }}
          >
            ↻
          </span>
        </button>

        <div
          data-nao-exportar="true"
          style={{
            position: "absolute",
            left: "50%",
            bottom: "-44px",
            transform:
              "translateX(-50%)",
            padding: "5px 8px",
            borderRadius: "7px",
            background:
              "rgba(2,6,23,.94)",
            border:
              "1px solid #22d3ee",
            color: "#e0f2fe",
            fontSize: "10px",
            fontWeight: "bold",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            boxShadow:
              "0 5px 14px rgba(0,0,0,.34)",
            zIndex: 55,
          }}
        >
          X: {Math.round(
            Number(item.x) || 0
          )} · Y: {Math.round(
            Number(item.y) || 0
          )}
          {" · "}
          Fonte: {Math.round(
            Number(item.tamanho) ||
              38
          )} px
          {" · "}
          ↻ {Math.round(
            Number(item.rotacao) ||
              0
          )}°
        </div>
      </>
    )}
  </div>
))}
  </div>
    </div>
  </div>
</div>
      </div>

      {resultadoIA && (
        <div
          style={{
            marginTop: "30px",
            background: "#0f172a",
            border: "1px solid #2563eb",
            borderRadius: "16px",
            padding: "25px",
            maxWidth: "800px",
            marginLeft: "auto",
            marginRight: "auto",
            textAlign: "center",
          }}
        >
          <h2 style={{ color: "#67e8f9", marginTop: 0 }}>
            ✅ Banner pronto
          </h2>

          <img
            src={resultadoIA}
            alt="Banner pronto"
            style={{
              width: "100%",
              maxWidth: "600px",
              background: "#ffffff",
              borderRadius: "12px",
            }}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "12px",
              flexWrap: "wrap",
              marginTop: "20px",
            }}
          >
            <button
              type="button"
              onClick={() => baixarImagem(resultadoIA)}
              style={{
                background: "#22c55e",
                color: "#ffffff",
                border: "none",
                padding: "12px 18px",
                borderRadius: "10px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              ⬇️ Baixar Banner
            </button>

            <button
              type="button"
              onClick={abrirClip}
              style={{
                background: "#7c3aed",
                color: "#ffffff",
                border: "none",
                padding: "12px 18px",
                borderRadius: "10px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              🎬 Criar Clip
            </button>

            <button
              type="button"
              onClick={() => {
                localStorage.setItem(
                  "modoGaleria",
                  "selecionarParaBanner"
                );
                setScreen("galeria");
              }}
              style={{
                background:
                  "linear-gradient(135deg,#2563eb,#22d3ee)",
                color: "#ffffff",
                border: "none",
                padding: "12px 18px",
                borderRadius: "10px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              🖼️ Abrir Galeria
            </button>

            <button
              type="button"
              onClick={abrirNovoAnuncio}
              style={{
                background: "#16a34a",
                color: "#ffffff",
                border: "none",
                padding: "12px 18px",
                borderRadius: "10px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              🤖 Criar Anúncio
            </button>
          </div>
        </div>
      )}

      <div
        data-nao-exportar="true"
        style={{
          position: "fixed",
          right: "28px",
          bottom: "28px",
          width: "150px",
          height: "105px",
          borderRadius: "10px",
          border: "1px solid #475569",
          background: "rgba(2,6,23,.94)",
          boxShadow: "0 10px 25px rgba(0,0,0,.38)",
          overflow: "hidden",
          zIndex: 1500,
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            position: "absolute",
            left: "8px",
            top: "4px",
            color: "#cbd5e1",
            fontSize: "8px",
            fontWeight: "bold",
          }}
        >
          NAVEGADOR
        </span>

        <div
          style={{
            position: "absolute",
            left: "8px",
            right: "8px",
            top: "18px",
            bottom: "8px",
            border: "1px solid #64748b",
            borderRadius: "5px",
            background: fundoStudio,
            overflow: "hidden",
          }}
        >
          {imagensBanner.map(
            (imagem) => (
              <span
                key={`mini-${imagem.id}`}
                style={{
                  position: "absolute",
                  left: `${Math.max(
                    0,
                    Math.min(
                      100,
                      (Number(imagem.x) /
                        larguraPreviewExportacao) *
                        100
                    )
                  )}%`,
                  top: `${Math.max(
                    0,
                    Math.min(
                      100,
                      (Number(imagem.y) /
                        alturaPreviewExportacao) *
                        100
                    )
                  )}%`,
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: "#22d3ee",
                  transform: "translate(-50%,-50%)",
                }}
              />
            )
          )}

          {textosStudio.map(
            (item) => (
              <span
                key={`mini-texto-${item.id}`}
                style={{
                  position: "absolute",
                  left: `${Math.max(
                    0,
                    Math.min(
                      100,
                      (Number(item.x) /
                        larguraPreviewExportacao) *
                        100
                    )
                  )}%`,
                  top: `${Math.max(
                    0,
                    Math.min(
                      100,
                      (Number(item.y) /
                        alturaPreviewExportacao) *
                        100
                    )
                  )}%`,
                  width: "9px",
                  height: "3px",
                  borderRadius: "2px",
                  background: "#fde047",
                  transform: "translate(-50%,-50%)",
                }}
              />
            )
          )}
        </div>
      </div>

      {previewMarketplaceAberto && (
        <div
          onClick={() =>
            setPreviewMarketplaceAberto(false)
          }
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "rgba(2,6,23,.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            onClick={(evento) =>
              evento.stopPropagation()
            }
            style={{
              width: "min(940px, 96vw)",
              maxHeight: "92vh",
              overflowY: "auto",
              borderRadius: "18px",
              border: "1px solid #334155",
              background: "#0f172a",
              padding: "18px",
              boxShadow:
                "0 30px 90px rgba(0,0,0,.62)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                gap: "12px",
                marginBottom: "15px",
              }}
            >
              <h3
                style={{
                  color: "#67e8f9",
                  margin: 0,
                }}
              >
                👁 Preview —{" "}
                {{
                  mercadoLivre:
                    "Mercado Livre",
                  shopee: "Shopee",
                  instagram: "Instagram",
                  whatsapp: "WhatsApp",
                }[canalPreview]}
              </h3>

              <button
                type="button"
                onClick={() =>
                  setPreviewMarketplaceAberto(
                    false
                  )
                }
                style={{
                  padding: "8px 12px",
                  borderRadius: "9px",
                  border:
                    "1px solid #475569",
                  background: "#020617",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                ✕ Fechar
              </button>
            </div>

            <div
              style={{
                borderRadius: "14px",
                padding:
                  canalPreview === "instagram"
                    ? "26px 12%"
                    : canalPreview === "whatsapp"
                      ? "22px 5%"
                      : "24px 10%",
                background:
                  canalPreview === "mercadoLivre"
                    ? "#fff159"
                    : canalPreview === "shopee"
                      ? "#ee4d2d"
                      : canalPreview === "instagram"
                        ? "linear-gradient(135deg,#7c3aed,#ec4899,#f59e0b)"
                        : "#075e54",
              }}
            >
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "12px",
                  padding: "12px",
                  boxShadow:
                    "0 16px 40px rgba(0,0,0,.3)",
                }}
              >
                <img
                  src={previewMarketplaceImagem}
                  alt="Preview do banner"
                  style={{
                    display: "block",
                    width: "100%",
                    borderRadius: "8px",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const botaoIconeCamada = {
  width: "32px",
  height: "32px",
  padding: 0,
  borderRadius: "8px",
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#ffffff",
  cursor: "pointer",
};

const botaoAcaoCamada = {
  padding: "7px 5px",
  borderRadius: "8px",
  border: "1px solid #334155",
  background: "#1e293b",
  color: "#e2e8f0",
  cursor: "pointer",
  fontSize: "10px",
  fontWeight: "bold",
};

const labelExportacaoStyle = {
  display: "block",
  color: "#cbd5e1",
  fontWeight: "bold",
  fontSize: "12px",
  marginTop: "14px",
  marginBottom: "7px",
};

const inputExportacaoStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px",
  borderRadius: "9px",
  border: "1px solid #334155",
  background: "#020617",
  color: "#ffffff",
};

const botaoOpcaoExportacao = {
  padding: "10px 6px",
  borderRadius: "9px",
  color: "#ffffff",
  fontWeight: "bold",
  cursor: "pointer",
};