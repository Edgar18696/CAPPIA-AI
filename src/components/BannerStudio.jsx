 import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { supabase } from "../supabase";
import {
  consumirNovaCriacaoMidia,
  deveIniciarNovaCriacaoMidia,
} from "../services/limparEstadoTemporarioMidia";

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
const CAMPOS_TECNICOS = {
  sonda: {
    nome: "Sonda Lambda",
    campos: [
      "Quantidade de fios",
      "Quantidade de pinos / vias",
      "Comprimento do chicote",
      "Conector / terminal",
    ],
  },

  bico: {
    nome: "Bico Injetor",
    campos: [
      "Quantidade de furos",
      "Tipo de conector",
      "Encaixe / O-ring",
      "Detalhe técnico",
    ],
  },

  vela: {
    nome: "Vela de Ignição",
    campos: [
      "Rosca",
      "Medida da chave",
      "Comprimento da rosca",
      "Tipo de eletrodo",
    ],
  },

  bomba: {
    nome: "Bomba de Combustível",
    campos: [
      "Conexão de entrada",
      "Conexão de saída",
      "Conector elétrico",
      "Diâmetro / medida",
    ],
  },

  sensor: {
    nome: "Sensor",
    campos: [
      "Quantidade de pinos",
      "Tipo de conector",
      "Tipo de fixação",
      "Detalhe técnico",
    ],
  },

  bobina: {
    nome: "Bobina de Ignição",
    campos: [
      "Quantidade de pinos",
      "Tipo de conector",
      "Tipo de encaixe",
      "Detalhe técnico",
    ],
  },

  generico: {
    nome: "Outro produto",
    campos: [
      "Detalhe técnico 1",
      "Detalhe técnico 2",
      "Detalhe técnico 3",
      "Detalhe técnico 4",
    ],
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
const COMANDOS_BANNER_IA = {
  oferta: {
    prioridade: "preco",
    tituloCurto: true,
    cta: "COMPRE AGORA",
    selo: "OFERTA ESPECIAL",
    regra:
      "Produto grande, preço dominante e chamada curta.",
  },
  produto: {
    prioridade: "produto",
    tituloCurto: true,
    cta: "CONSULTE APLICAÇÕES",
    selo: "PRODUTO EM DESTAQUE",
    regra:
      "Produto dominante, título técnico e benefício curto.",
  },
  horario: {
    prioridade: "informacao",
    tituloCurto: true,
    cta: "FALE COM A GENTE",
    selo: "ATENDIMENTO",
    regra:
      "Horário legível, marca forte e contato visível.",
  },
  institucional: {
    prioridade: "mensagem",
    tituloCurto: true,
    cta: "SAIBA MAIS",
    selo: "COMUNICADO",
    regra:
      "Mensagem principal limpa, marca e contato bem distribuídos.",
  },
};


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

export default function BannerStudio({
  galeria = [],
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

  const [mostrarExtras, setMostrarExtras] =
    useState(false);

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

  const [mostrarGaleria, setMostrarGaleria] =
    useState(false);
const [
  tipoPecaTecnica,
  setTipoPecaTecnica,
] = useState("generico");

const [
  detalhesTecnicos,
  setDetalhesTecnicos,
] = useState([
  "",
  "",
  "",
  "",
  "",
]);
const [
  fotoDetalheTecnico,
  setFotoDetalheTecnico,
] = useState(null);

function detectarTipoPecaTecnica() {
  try {
    const salvo =
      localStorage.getItem(
        "rascunhoNovoAnuncioTemp"
      );

    const rascunho =
      salvo
        ? JSON.parse(salvo)
        : {};

    const texto = JSON.stringify(
      rascunho
    )
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .toLowerCase();

    if (
      /sonda|lambda|oxigenio/.test(
        texto
      )
    ) {
      return "sonda";
    }

    if (
      /bico injetor|injetor|injector/.test(
        texto
      )
    ) {
      return "bico";
    }

    if (
      /vela de ignicao|vela ignicao|spark plug/.test(
        texto
      )
    ) {
      return "vela";
    }

    if (
      /bomba de combustivel|fuel pump/.test(
        texto
      )
    ) {
      return "bomba";
    }

    if (
      /bobina de ignicao|bobina|ignition coil/.test(
        texto
      )
    ) {
      return "bobina";
    }

    if (
      /sensor/.test(texto)
    ) {
      return "sensor";
    }

    return "generico";
  } catch {
    return "generico";
  }
}
function selecionarFotoDetalheTecnico(
  event
) {
  const arquivo =
    event.target.files?.[0];

  if (!arquivo) {
    return;
  }

  if (
    !arquivo.type.startsWith(
      "image/"
    )
  ) {
    alert(
      "Selecione uma imagem válida."
    );
    return;
  }

  const leitor =
    new FileReader();

  leitor.onload = () => {
    setFotoDetalheTecnico({
      arquivo,
      url: leitor.result,
      nome: arquivo.name,
    });

    setAprovado(false);
    setBannerSalvo(false);
  };

  leitor.onerror = () => {
    alert(
      "Não foi possível carregar a foto de detalhe."
    );
  };

  leitor.readAsDataURL(
    arquivo
  );

  event.target.value = "";
}
  const [carregandoGaleria, setCarregandoGaleria] =
  useState(false);
  
useEffect(() => {
  console.log("ESTADO DA GALERIA:", mostrarGaleria);
}, [mostrarGaleria]);

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
      () => normalizarGaleria(galeria),
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

  const dadosFormato =
    FORMATOS[formato];

  const dadosObjetivo =
    OBJETIVOS.find(
      (item) =>
        item.id === objetivo
    ) || OBJETIVOS[0];

  const comandoBanner =
    COMANDOS_BANNER_IA[objetivo] ||
    COMANDOS_BANNER_IA.produto;

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

  setMarca((atual) => ({
    ...atual,
    logo: "",
    nome: "",
  }));
}, []);

  useEffect(() => {
    localStorage.setItem(
      "appiaKitMarca",
      JSON.stringify(marca)
    );
  }, [marca]);

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
    const texto = String(
      valor || ""
    ).trim();

    if (!texto) {
      return "";
    }

    if (
      texto.toLowerCase().includes(
        "r$"
      )
    ) {
      return texto;
    }

    return `R$ ${texto}`;
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
    let novoFormato = "instagram";

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

    if (
      /story|stories|reels|vertical/.test(
        pedido
      )
    ) {
      novoFormato = "story";
    } else if (
      /quadrado|1080x1080/.test(
        pedido
      )
    ) {
      novoFormato = "quadrado";
    } else if (
      /facebook/.test(
        pedido
      )
    ) {
      novoFormato = "facebook";
    }

    const precoEncontrado =
      original.match(
        /(?:r\$\s*)?(\d{1,6}(?:[.\s]\d{3})*(?:,\d{2})|\d{1,6}(?:\.\d{2})?)/i
      );

    let precoFormatado = "";

    if (precoEncontrado?.[1]) {
      const valor =
        precoEncontrado[1]
          .replace(/\s/g, "")
          .trim();

      precoFormatado =
        valor.includes(",")
          ? `R$ ${valor}`
          : `R$ ${valor.replace(".", ",")}`;
    }

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

    setObjetivo(novoObjetivo);
    setPaleta(novaPaleta);
    setFormato(novoFormato);
    setPrecoPedido(precoFormatado);
    setCopyPedido({
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
    });

    return {
      objetivo: novoObjetivo,
      paleta: novaPaleta,
      formato: novoFormato,
      preco: precoFormatado,
    };
  }

 function montarPedidoCompleto() {
  const partes = [
    String(
      pedidoAppia || ""
    ).trim(),
  ];

  /*
   * =========================================
   * MERCADO LIVRE TÉCNICO
   * =========================================
   */
  if (
    formato ===
    "mercadoLivre"
  ) {
    const configuracaoTecnica =
      CAMPOS_TECNICOS[
        tipoPecaTecnica
      ] ||
      CAMPOS_TECNICOS.generico;

    const linhasTecnicas =
      configuracaoTecnica.campos
        .map(
          (
            nomeCampo,
            indice
          ) => {
            const valor =
              String(
                detalhesTecnicos[
                  indice
                ] || ""
              ).trim();

            if (!valor) {
              return "";
            }

            return `${nomeCampo}: ${valor}`;
          }
        )
        .filter(Boolean);

    const descricaoLivre =
      String(
        detalhesTecnicos[4] ||
          ""
      ).trim();

    partes.push(
      `
MODO MERCADO LIVRE TÉCNICO.

Produto:
${configuracaoTecnica.nome}

FORMATO:
- Imagem quadrada 1200x1200.
- Fundo branco.
- Visual técnico, limpo e profissional.
- Produto principal em grande destaque no centro.
- Organizar os detalhes técnicos ao redor do produto.
- Manter excelente legibilidade.

REGRAS OBRIGATÓRIAS:
- Não mostrar preço.
- Não mostrar promoção.
- Não mostrar telefone ou WhatsApp.
- Não mostrar e-mail.
- Não mostrar endereço.
- Não criar chamada comercial.
- Não inventar especificações técnicas.
- Não alterar características físicas da peça.
- Manter fidelidade visual ao produto original.

INFORMAÇÕES TÉCNICAS:
${
  linhasTecnicas.length
    ? linhasTecnicas.join(
        "\n"
      )
    : "Nenhuma informação técnica adicional preenchida."
}

DESCRIÇÃO TÉCNICA DO USUÁRIO:
${
  descricaoLivre ||
  "Nenhuma descrição adicional."
}
      `.trim()
    );

    return partes
      .filter(Boolean)
      .join("\n");
  }

  /*
   * =========================================
   * BANNERS NORMAIS
   * =========================================
   */

  if (
    precoPedido?.trim()
  ) {
    partes.push(
      `Preço informado pelo usuário: ${formatarPreco(
        precoPedido
      )}. O preço deve aparecer com grande destaque comercial no banner.`
    );
  }

  if (
    marca.telefone?.trim()
  ) {
    partes.push(
      `Telefone/WhatsApp informado pelo usuário: ${marca.telefone.trim()}.`
    );
  }

  if (
    marca.email?.trim()
  ) {
    partes.push(
      `E-mail informado pelo usuário: ${marca.email.trim()}.`
    );
  }

  if (
    marca.endereco?.trim()
  ) {
    partes.push(
      `Localização informada pelo usuário: ${marca.endereco.trim()}.`
    );
  }

  return partes
    .filter(Boolean)
    .join("\n");
}

  async function gerarComIA() {
    if (!imagemSelecionada) {
      alert(
        "Escolha uma foto da Galeria PAIIA antes de gerar o banner."
      );
      return;
    }

    const interpretado =
  formato === "mercadoLivre"
    ? {
        objetivo: "produto",
        paleta: "clean",
        formato:
          "mercadoLivre",
        preco: "",
      }
    : interpretarPedidoAppia();

setBannerGerado(false);
setAprovado(false);
setBannerSalvo(false);
setFundoIA("");
setGerandoFundoIA(true);
setErroFundoIA("");

    const proximaVersao =
      versaoIA + 1;

    setStatus(
      "🎨 PAIIA criando direção de arte profissional..."
    );

    try {
      const { data, error } =
  await supabase.functions.invoke(
    "banner-ia",
    {
   body: {
  descricao:
    montarPedidoCompleto(),

  imagemProduto:
    imagemSelecionada,

  imagemDetalheTecnico:
    fotoDetalheTecnico?.url || "",

  logo:
    marca.logo || "",

  modelo:
    interpretado?.objetivo ||
    objetivo ||
    "produto",

  paleta:
    interpretado?.paleta ||
    paleta,

  formato:
    interpretado?.formato ||
    formato,

  variacao:
    proximaVersao,
},
    }
  );

if (error) {
  throw error;
}

if (
  !data?.sucesso ||
  !data?.imagem
) {
  throw new Error(
    data?.erro ||
      "A IA não retornou o fundo do banner."
  );
}

setFundoIA(
  data.imagem
);

setVersaoIA(
  proximaVersao
);
      setLayout(
        (atual) =>
          atual >= 3
            ? 1
            : atual + 1
      );

      setBannerGerado(true);

      setStatus(
        "✨ Fundo profissional criado. PAIIA aplicou produto, logo, preço e chamada."
      );
    } catch (erro) {
      console.error(
        "❌ BANNER IA:",
        erro
      );

      const mensagem =
        erro?.message ||
        "Não foi possível gerar o fundo com IA.";

      setErroFundoIA(
        mensagem
      );

      setStatus(
        "⚠️ Falha na geração por IA."
      );

      alert(
        mensagem
      );
    } finally {
      setGerandoFundoIA(false);
    }
  }
async function aprovarBanner() {
  if (gerandoFundoIA) {
    alert(
      "Aguarde o PAIIA terminar a criação do banner."
    );
    return;
  }

  if (!bannerGerado || !fundoIA) {
    alert(
      "Gere o banner com IA antes de aprovar."
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

  try {
    setStatus(
      "⏳ Salvando banner..."
    );

    if (!bannerSalvo) {
      await salvarBannerNasMidias(
        fundoIA
      );

      setBannerSalvo(true);
    }

    // =====================================================
    // ADICIONA O BANNER NAS FOTOS DO ANÚNCIO
    // =====================================================

    try {
      const salvas =
        localStorage.getItem(
          "fotosSelecionadasAnuncio"
        );

      let fotosAtuais =
        salvas
          ? JSON.parse(salvas)
          : [];

      if (
        !Array.isArray(
          fotosAtuais
        )
      ) {
        fotosAtuais = [];
      }

      const jaExiste =
        fotosAtuais.some(
          (foto) => {
            const url =
              typeof foto === "string"
                ? foto
                : foto?.imagem_processada ||
                  foto?.imagem_original ||
                  foto?.url ||
                  "";

            return url === fundoIA;
          }
        );

      if (!jaExiste) {
        fotosAtuais.push({
          id:
            `banner-${Date.now()}`,

          imagem_processada:
            fundoIA,

          imagem_original:
            fundoIA,

          tipo:
            "banner",

          created_at:
            new Date().toISOString(),
        });
      }

      localStorage.setItem(
        "fotosSelecionadasAnuncio",
        JSON.stringify(
          fotosAtuais
        )
      );

      // Também atualiza o rascunho
      // temporário do Criar Anúncio.
      const rascunhoSalvo =
        localStorage.getItem(
          "rascunhoNovoAnuncioTemp"
        );

      const rascunho =
        rascunhoSalvo
          ? JSON.parse(
              rascunhoSalvo
            )
          : {};

      localStorage.setItem(
        "rascunhoNovoAnuncioTemp",
        JSON.stringify({
          ...rascunho,
          fotos:
            fotosAtuais,
        })
      );
    } catch (erroFotos) {
      console.error(
        "Erro ao adicionar banner às fotos do anúncio:",
        erroFotos
      );
    }

    setAprovado(true);

    window.dispatchEvent(
      new Event(
        "appia:banner-pronto"
      )
    );

    setStatus(
      "✅ Banner aprovado e adicionado às fotos do anúncio."
    );
  } catch (erro) {
    console.error(
      "❌ SALVAR BANNER:",
      erro
    );

    setStatus("");

    alert(
      erro?.message ||
        "Não foi possível salvar o banner."
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
        await lerArquivoComoDataUrl(
          arquivo
        );

      setMarca((atual) => ({
        ...atual,
        logo: dataUrl,
      }));
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

async function salvarBannerNasMidias(urlBanner) {
  if (!urlBanner) {
    throw new Error(
      "Banner sem imagem para salvar."
    );
  }

  if (!usuario?.id) {
    throw new Error(
      "Usuário não identificado."
    );
  }

  const resposta =
    await fetch(urlBanner);

  const blob =
    await resposta.blob();

  const carimbo = Date.now();

  const nomeArquivo =
    `${usuario.id}/banners/paiia-banner-${carimbo}.png`;

  const {
    error: erroUpload,
  } = await supabase.storage
    .from("imagens")
    .upload(
      nomeArquivo,
      blob,
      {
        contentType: "image/png",
        upsert: true,
      }
    );

  if (erroUpload) {
    throw erroUpload;
  }

  try {
    const miniatura =
      await criarBlobMiniaturaBanner(
        blob
      );

    await supabase.storage
      .from("imagens")
      .upload(
        `${usuario.id}/banners/paiia-banner-${carimbo}-thumb.${miniatura.extensao}`,
        miniatura.blob,
        {
          contentType:
            miniatura.contentType,
          upsert: true,
        }
      );
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
    throw new Error(
      "Não foi possível obter a URL do banner."
    );
  }

  const { error } = await supabase
    .from("processamentos")
    .insert([
      {
        user_id: usuario.id,
        imagem_original:
          imagemSelecionada || null,
        imagem_processada:
          urlPublica,
        status: "finalizado",
        tipo: "banner",
        modelo_banner: formato,
      },
    ]);

  if (error) {
    throw new Error(
      "Não foi possível salvar o banner em Mídias PAIIA: " +
        error.message
    );
  }
}
  async function exportarVersaoDestino(
    chaveDestino
  ) {
    if (
      !bannerGerado ||
      !aprovado ||
      !fundoIA
    ) {
      alert(
        "Aprove o banner antes de criar versões para outros canais."
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
        `⏳ Formatando para ${destino.nome}...`
      );

      const resposta =
        await fetch(fundoIA);

      if (!resposta.ok) {
        throw new Error(
          "Não foi possível carregar a arte aprovada."
        );
      }

      const blob =
        await resposta.blob();

      const urlImagem =
        URL.createObjectURL(blob);

      const imagem =
        new Image();

      await new Promise(
        (resolve, reject) => {
          imagem.onload =
            resolve;

          imagem.onerror =
            () =>
              reject(
                new Error(
                  "Não foi possível preparar a arte."
                )
              );

          imagem.src =
            urlImagem;
        }
      );

      const canvas =
        document.createElement(
          "canvas"
        );

      canvas.width =
        destino.largura;

      canvas.height =
        destino.altura;

      const contexto =
        canvas.getContext(
          "2d"
        );

      if (!contexto) {
        throw new Error(
          "Não foi possível criar a versão."
        );
      }

      contexto.imageSmoothingEnabled =
        true;

      contexto.imageSmoothingQuality =
        "high";

      // Mantém a arte inteira, sem esticar e sem cortar textos/produto.
      // A sobra do canvas vira margem de segurança do canal.
      contexto.fillStyle =
        chaveDestino ===
        "mercadoLivre"
          ? "#ffffff"
          : "#0f172a";

      contexto.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      const escala =
        Math.min(
          canvas.width /
            imagem.naturalWidth,
          canvas.height /
            imagem.naturalHeight
        );

      const larguraFinal =
        Math.round(
          imagem.naturalWidth *
            escala
        );

      const alturaFinal =
        Math.round(
          imagem.naturalHeight *
            escala
        );

      const x =
        Math.round(
          (canvas.width -
            larguraFinal) /
            2
        );

      const y =
        Math.round(
          (canvas.height -
            alturaFinal) /
            2
        );

      contexto.drawImage(
        imagem,
        x,
        y,
        larguraFinal,
        alturaFinal
      );

      URL.revokeObjectURL(
        urlImagem
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
          "Não foi possível gerar o PNG."
        );
      }

      const urlDownload =
        URL.createObjectURL(
          png
        );

      const link =
        document.createElement(
          "a"
        );

      link.href =
        urlDownload;

      link.download =
        `paiia-${chaveDestino}-${destino.largura}x${destino.altura}-${Date.now()}.png`;

      document.body.appendChild(
        link
      );

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
        `✅ Versão ${destino.nome} pronta em ${destino.largura} × ${destino.altura}, sem gerar outra arte com IA.`
      );
    } catch (erro) {
      console.error(
        "Erro ao formatar banner:",
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
          "Não foi possível baixar o PNG gerado pela IA."
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
            ⚡ Banner Express IA
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
              grid-template-columns: 1fr 1fr;
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
                      setPaleta("clean");
                      setPrecoPedido("");
                      setTipoPecaTecnica(detectarTipoPecaTecnica());
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

 if (
  modelo.id ===
  "mercado_livre_tecnico"
) {
  setFormato(
    "mercadoLivre"
  );

  setObjetivo(
    "produto"
  );

  setPaleta(
    "clean"
  );

  setPrecoPedido(
    ""
  );

  setTipoPecaTecnica(
    detectarTipoPecaTecnica()
  );

  setDetalhesTecnicos([
  "",
  "",
  "",
  "",
  "",
]);
  setMarca(
    (atual) => ({
      ...atual,
      telefone: "",
      email: "",
      endereco: "",
    })
  );

  setAprovado(
    false
  );

  setBannerSalvo(
    false
  );
}
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
              <span>+ Informações extras</span>
              <span>
                {formato === "mercadoLivre" || mostrarExtras ? "−" : "+"}
              </span>
            </button>

            {(formato === "mercadoLivre" || mostrarExtras) && (
          <div style={{ marginTop: "14px" }}>
            <div style={passoTitulo}>
              {formato === "mercadoLivre"
                ? "Informações técnicas"
                : "Campos opcionais"}
            </div>

  {formato === "mercadoLivre" ? (
    <div
      style={{
        display: "grid",
        gap: "9px",
      }}
    >
      <select
        value={tipoPecaTecnica}
        onChange={(event) => {
          setTipoPecaTecnica(
            event.target.value
          );

          setDetalhesTecnicos([
  "",
  "",
  "",
  "",
  "",
]);
        }}
        style={inputStyle}
      >
        {Object.entries(
          CAMPOS_TECNICOS
        ).map(
          ([chave, config]) => (
            <option
              key={chave}
              value={chave}
            >
              {config.nome}
            </option>
          )
        )}
      </select>

      {CAMPOS_TECNICOS[
        tipoPecaTecnica
      ].campos.map(
        (nomeCampo, indice) => (
          <input
            key={nomeCampo}
            type="text"
            value={
              detalhesTecnicos[
                indice
              ] || ""
            }
            onChange={(event) => {
              const novos = [
                ...detalhesTecnicos,
              ];

              novos[indice] =
                event.target.value;

              setDetalhesTecnicos(
                novos
              );
            }}
            placeholder={`🔧 ${nomeCampo}`}
            style={inputStyle}
          />
        )
      )}
<textarea
  value={
    detalhesTecnicos[4] || ""
  }
  onChange={(event) => {
    const novos = [
      ...detalhesTecnicos,
    ];

    novos[4] =
      event.target.value;

    setDetalhesTecnicos(
      novos
    );
  }}
  placeholder="✍️ Descrição técnica adicional — escreva aqui qualquer detalhe importante que queira destacar na imagem."
  rows={4}
  style={{
    ...inputStyle,
    resize: "vertical",
    minHeight: "90px",
    lineHeight: 1.45,
  }}
/>
{/* FOTO DE DETALHE TÉCNICO */}
<div
  style={{
    marginTop: "4px",
    padding: "10px",
    borderRadius: "10px",
    border: "1px solid #334155",
    background: "#020617",
  }}
>
  <div
    style={{
      color: "#cbd5e1",
      fontSize: "12px",
      fontWeight: "bold",
      marginBottom: "8px",
    }}
  >
    📷 Foto de detalhe técnico (opcional)
  </div>

  <label
    style={{
      ...botaoSecundario,
      display: "block",
      textAlign: "center",
      cursor: "pointer",
    }}
  >
    📂 Escolher foto de detalhe

    <input
      type="file"
      accept="image/*"
      onChange={
        selecionarFotoDetalheTecnico
      }
      style={{
        display: "none",
      }}
    />
  </label>

  {fotoDetalheTecnico?.url && (
    <div
      style={{
        marginTop: "10px",
      }}
    >
      <img
        src={fotoDetalheTecnico.url}
        alt="Detalhe técnico"
        style={{
          width: "100%",
          height: "130px",
          objectFit: "contain",
          background: "#ffffff",
          borderRadius: "10px",
          display: "block",
        }}
      />

      <button
        type="button"
        onClick={() => {
          setFotoDetalheTecnico(null);
          setAprovado(false);
          setBannerSalvo(false);
        }}
        style={{
          ...botaoSecundario,
          width: "100%",
          marginTop: "8px",
        }}
      >
        🗑️ Remover foto
      </button>
    </div>
  )}

  <div
    style={{
      color: "#64748b",
      fontSize: "10px",
      lineHeight: 1.4,
      marginTop: "8px",
    }}
  >
    Use para mostrar conector, terminais,
    ponta, encaixe, furos ou outro detalhe
    da mesma peça.
  </div>
</div>

      <div
        style={{
          color: "#67e8f9",
          fontSize: "11px",
          lineHeight: 1.45,
          padding: "8px 10px",
          borderRadius: "9px",
          border:
            "1px solid rgba(34,211,238,.25)",
          background:
            "rgba(8,145,178,.08)",
        }}
      >
        🤖 O PAIIA tenta identificar
        automaticamente o tipo da peça.
        Você só completa as informações
        que forem importantes.
      </div>
    </div>
  ) : (
    <>
      <div
        style={{
          display: "grid",
          gap: "9px",
        }}
      >
        <input
          type="text"
          value={precoPedido}
          onChange={(event) =>
            setPrecoPedido(
              event.target.value
            )
          }
          placeholder="💰 Preço — Ex.: R$ 149,90"
          style={inputStyle}
        />

        <input
          type="text"
          value={marca.telefone || ""}
          onChange={(event) =>
            setMarca((atual) => ({
              ...atual,
              telefone:
                event.target.value,
            }))
          }
          placeholder="📱 Telefone / WhatsApp"
          style={inputStyle}
        />

        <input
          type="email"
          value={marca.email || ""}
          onChange={(event) =>
            setMarca((atual) => ({
              ...atual,
              email:
                event.target.value,
            }))
          }
          placeholder="✉️ E-mail"
          style={inputStyle}
        />

        <input
          type="text"
          value={marca.endereco || ""}
          onChange={(event) =>
            setMarca((atual) => ({
              ...atual,
              endereco:
                event.target.value,
            }))
          }
          placeholder="📍 Localização"
          style={inputStyle}
        />
      </div>

      <div
        style={{
          color: "#64748b",
          fontSize: "11px",
          lineHeight: 1.4,
          marginTop: "7px",
        }}
      >
        Preencha somente o que quiser mostrar.
        Campos vazios não entram na arte.
      </div>
    </>
  )}
</div>
            )}
          </div>

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
              🎨 Criando direção de arte...
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
                bannerGerado && aprovado
                  ? exportarPng
                  : undefined
              }
              disabled={!bannerGerado || !aprovado}
              style={{
                ...botaoSecundario,
                padding: "7px 10px",
                fontSize: "12px",
                opacity:
                  bannerGerado && aprovado
                    ? 1
                    : 0.45,
                cursor:
                  bannerGerado && aprovado
                    ? "pointer"
                    : "not-allowed",
              }}
            >
              {bannerGerado && aprovado
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

              {bannerGerado && (
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
                    {marca.nome ||
                      "Sua Empresa"}
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
              onClick={gerarComIA}
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
                ? "🎨 Criando..."
                : fundoIA
                  ? "🔄 Gerar Banner com IA"
                  : "✨ Gerar Banner com IA"}
            </button>

            <button
              type="button"
              onClick={aprovarBanner}
              disabled={
                gerandoFundoIA ||
                !bannerGerado
              }
              style={{
                ...botaoAprovar,
                width: "100%",
                padding: "11px 12px",
                fontSize: "13px",
                opacity:
                  gerandoFundoIA ||
                  !bannerGerado
                    ? 0.5
                    : 1,
                cursor:
                  gerandoFundoIA ||
                  !bannerGerado
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              ✅ Aprovar Banner
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              localStorage.setItem(
                "abaMidiasAppia",
                "banners"
              );
              setScreen?.("midiasAppia");
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

          {bannerGerado &&
            aprovado && (
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
                      Use a mesma arte aprovada em outros canais, sem gerar outro banner com IA.
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
            Gere a arte uma vez. Depois de aprovada, o PAIIA cria as versões
            nas medidas dos canais sem consumir uma nova geração de IA.
          </div>
        </main>
      </div>

      {mostrarGaleria && (
        <div
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
                  Escolha a foto que
                  será usada pela IA.
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
                Nenhuma imagem
                disponível na Galeria
                PAIIA.
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

const passoTitulo = {
  color: "#67e8f9",
  fontWeight: "900",
  fontSize: "14px",
  marginBottom: "10px",
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