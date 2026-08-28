import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { supabase } from "../supabase";

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
    nome: "Story / Reels",
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
      "Faça uma promoção por R$ 149,90. Destaque o produto, use visual forte e limpo, pronta entrega e chamada para comprar.",
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
 * MOTOR BANNER EXPRESS IA — FÓRMULA APPIA
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
      chamada: "DESTAQUE APPIA",
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

  const [formato, setFormato] =
    useState("instagram");

  const [objetivo, setObjetivo] =
    useState("oferta");

  const [paleta, setPaleta] =
    useState("azul");

  const [pedidoAppia, setPedidoAppia] =
    useState("");

  const [precoPedido, setPrecoPedido] =
    useState("");

  const [copyPedido, setCopyPedido] =
    useState(null);

  const [bannerGerado, setBannerGerado] =
    useState(false);

  const [fundoIA, setFundoIA] =
    useState("");

  const [gerandoFundoIA, setGerandoFundoIA] =
    useState(false);

  const [erroFundoIA, setErroFundoIA] =
    useState("");

  const [imagemSelecionada, setImagemSelecionada] =
    useState("");

  const [mostrarGaleria, setMostrarGaleria] =
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
      () => normalizarGaleria(galeria),
      [galeria]
    );

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
    /*
     * ABERTURA LIMPA DO BANNER EXPRESS
     *
     * Sempre que a tela for aberta, o APPIA começa
     * um novo banner sem reaproveitar o rascunho anterior.
     *
     * Mantemos apenas o Kit da Marca salvo separadamente.
     */
    setImagemSelecionada("");
    setVersaoIA(0);
    setLayout(1);
    setAprovado(false);
    setStatus("");
    setPedidoAppia("");
    setPrecoPedido("");
    setCopyPedido(null);
    setBannerGerado(false);
    setFundoIA("");
    setGerandoFundoIA(false);
    setErroFundoIA("");

    setMarca((atual) => ({
      ...atual,
      logo: "",
      nome: "",
    }));

    localStorage.removeItem(
      "imagemBannerSelecionada"
    );
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "appiaKitMarca",
      JSON.stringify(marca)
    );
  }, [marca]);

  useEffect(() => {
    setAprovado(false);
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
    String(pedidoAppia || "").trim(),
  ];

  if (precoPedido?.trim()) {
    partes.push(
      `Preço informado pelo usuário: ${formatarPreco(
        precoPedido
      )}. O preço deve aparecer com grande destaque comercial no banner.`
    );
  }

  if (marca.telefone?.trim()) {
    partes.push(
      `Telefone/WhatsApp informado pelo usuário: ${marca.telefone.trim()}.`
    );
  }

  if (marca.email?.trim()) {
    partes.push(
      `E-mail informado pelo usuário: ${marca.email.trim()}.`
    );
  }

  if (marca.endereco?.trim()) {
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
        "Escolha uma foto da Galeria APPIA antes de gerar o banner."
      );
      return;
    }

    const interpretado =
      interpretarPedidoAppia();

    setBannerGerado(false);
    setAprovado(false);
    setGerandoFundoIA(true);
    setErroFundoIA("");

    const proximaVersao =
      versaoIA + 1;

    setStatus(
      "🎨 APPIA criando direção de arte profissional..."
    );

    try {
      const { data, error } =
        await supabase.functions.invoke(
          "banner-ia",
          {
            body: {
              descricao:
                montarPedidoCompleto(),

              /*
               * A nova Edge Function precisa receber
               * a imagem real do produto.
               */
              imagemProduto:
                imagemSelecionada,

              /*
               * Logo é opcional.
               */
              logo:
                marca.logo || "",

              /*
               * O modelo pode ser inferido pelo objetivo
               * escolhido/interpretado pelo APPIA.
               */
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
        "✨ Fundo profissional criado. APPIA aplicou produto, logo, preço e chamada."
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

  function aprovarBanner() {
    if (gerandoFundoIA) {
      alert(
        "Aguarde o APPIA terminar a criação do banner."
      );
      return;
    }

    if (!bannerGerado) {
      alert(
        "Gere o banner com IA antes de aprovar."
      );
      return;
    }

    if (
      objetivo !== "horario" &&
      objetivo !==
        "institucional" &&
      !imagemSelecionada
    ) {
      alert(
        "Escolha uma foto antes de aprovar."
      );
      return;
    }

    setAprovado(true);

    setStatus(
      "✅ Banner aprovado. Agora você pode baixar o PNG."
    );
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
          "✅ Banner baixado em PNG."
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
        padding: "24px",
        background: "#020617",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          gap: "18px",
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: "22px",
        }}
      >
        <div>
          <h1
            style={{
              color: "#67e8f9",
              margin: 0,
            }}
          >
            ⚡ Banner Express IA
          </h1>

          <p
            style={{
              color: "#94a3b8",
              margin:
                "7px 0 0",
            }}
          >
            Foto + logo + pedido.
            O APPIA cria a direção de arte e monta o banner para aprovação.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setScreen?.("home")
          }
          style={botaoSecundario}
        >
          ← Voltar
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(290px,360px) minmax(340px,1fr)",
          gap: "22px",
          alignItems: "start",
        }}
      >
        <aside
          style={painelStyle}
        >
          <div style={passoTitulo}>
            1. Foto do produto
          </div>

          <button
            type="button"
            onClick={() =>
              setMostrarGaleria(true)
            }
            style={{
              ...botaoPrincipal,
              width: "100%",
            }}
          >
            🖼️ Buscar Foto Transparente na Galeria
          </button>

          {imagemSelecionada && (
            <div
              style={{
                marginTop: "10px",
                padding: "8px",
                border: "1px solid #334155",
                borderRadius: "12px",
                background: "#020617",
              }}
            >
              <img
                src={imagemSelecionada}
                alt="Produto"
                style={{
                  display: "block",
                  width: "100%",
                  height: "145px",
                  objectFit: "contain",
                }}
              />
            </div>
          )}

          <div style={separador} />

          <div style={passoTitulo}>
            2. Logo
          </div>

          <label
            style={{
              ...botaoSecundario,
              display: "block",
              textAlign: "center",
              cursor: "pointer",
            }}
          >
            📂 Buscar Logo no Computador
            <input
              type="file"
              accept="image/*"
              onChange={importarLogo}
              style={{ display: "none" }}
            />
          </label>

          {marca.logo && (
            <img
              src={marca.logo}
              alt="Logo"
              style={{
                marginTop: "10px",
                width: "100%",
                height: "70px",
                objectFit: "contain",
                background: "#ffffff",
                borderRadius: "10px",
              }}
            />
          )}

          <div style={separador} />

          <div style={passoTitulo}>
            3. Escolha o fundo
          </div>

          <div style={gradeDois}>
            {[
              ["azul", "A", "Azul Premium"],
              ["vermelho", "B", "Oferta Forte"],
              ["escuro", "C", "Dark Automotivo"],
              ["clean", "D", "Clean Premium"],
            ].map(([chave, letra, nome]) => (
              <button
                key={chave}
                type="button"
                onClick={() =>
                  setPaleta(chave)
                }
                style={{
                  ...opcaoStyle,
                  border:
                    paleta === chave
                      ? "2px solid #67e8f9"
                      : "1px solid #334155",
                }}
              >
                <strong>
                  {letra} • {nome}
                </strong>
              </button>
            ))}
          </div>

          <div style={separador} />

          <div style={passoTitulo}>
            4. Modelo rápido
          </div>

          <div style={gradeDois}>
            {MODELOS_DESCRICAO.map(
              (modelo) => (
                <button
                  key={modelo.id}
                  type="button"
                  onClick={() =>
                    setPedidoAppia(
                      modelo.texto
                    )
                  }
                  style={{
                    ...opcaoStyle,
                    minHeight: "58px",
                  }}
                >
                  <strong>
                    {modelo.nome}
                  </strong>
                </button>
              )
            )}
          </div>

          <div style={{ marginTop: "14px" }}>
            <div style={passoTitulo}>
              5. Informações opcionais
            </div>

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
              Preencha somente o que quiser mostrar. Campos vazios não entram na arte.
            </div>
          </div>

          <div style={{ marginTop: "14px" }}>
            <div style={passoTitulo}>
              6. Diga ao APPIA o que deseja
            </div>

            <textarea
              value={pedidoAppia}
              onChange={(event) =>
                setPedidoAppia(
                  event.target.value
                )
              }
              rows={7}
              placeholder="Ex.: Faça uma promoção por R$ 149,90, fundo B, peça grande, destacar pronta entrega e consulte aplicações."
              style={{
                ...inputStyle,
                minHeight: "145px",
                resize: "vertical",
                lineHeight: 1.45,
              }}
            />
          </div>

          <button
            type="button"
            onClick={gerarComIA}
            disabled={gerandoFundoIA}
            style={{
              ...botaoPrincipal,
              width: "100%",
              marginTop: "16px",
              padding: "15px 18px",
              fontSize: "15px",
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
              ? "🎨 Criando arte profissional..."
              : fundoIA
                ? "🔄 Gerar Outra Arte com IA"
                : "✨ Gerar Banner com IA"}
          </button>

          <button
            type="button"
            onClick={aprovarBanner}
            style={{
              ...botaoAprovar,
              width: "100%",
              marginTop: "10px",
              padding: "14px 18px",
            }}
          >
            ✅ Aprovar Banner
          </button>
        </aside>

        <main
          style={previewPainel}
        >
          {gerandoFundoIA && (
            <div
              style={{
                marginBottom: "14px",
                padding: "12px 14px",
                borderRadius: "12px",
                border: "1px solid #22d3ee",
                background: "rgba(8,145,178,.10)",
                color: "#a5f3fc",
                fontWeight: "800",
                textAlign: "center",
              }}
            >
              🎨 O APPIA está criando uma direção de arte única para este banner...
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

          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              gap: "12px",
              flexWrap: "wrap",
              marginBottom:
                "14px",
            }}
          >
            <div>
              <strong
                style={{
                  color:
                    "#e2e8f0",
                }}
              >
                Preview
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
                ...botaoPrincipal,
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
                ? "⬇️ Baixar Arte PNG"
                : "🔒 Aprove para baixar"}
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
                width: `min(100%, calc((100vh - 245px) * ${
                  dadosFormato.largura / dadosFormato.altura
                }))`,
                maxWidth: "100%",
                maxHeight: "calc(100vh - 245px)",
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
                  alt="Banner criado pelo APPIA"
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
                    "APPIA AI"}
                </div>
              </div>
                </>
              )}
            </div>
          </div>

          <div
            style={{
              marginTop: "14px",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                padding: "8px 14px",
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
                fontSize: "12px",
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
                marginTop: "14px",
                padding:
                  "11px 14px",
                borderRadius:
                  "10px",
                border:
                  "1px solid #334155",
                background:
                  "#020617",
                color:
                  "#bfdbfe",
                textAlign:
                  "center",
                fontSize:
                  "13px",
              }}
            >
              {status}
            </div>
          )}

          <div
            style={{
              marginTop: "15px",
              color: "#64748b",
              fontSize: "12px",
              lineHeight: 1.5,
            }}
          >
            A arte criada pela IA é exibida inteira e sem elementos
            do editor sobre ela. Aprove o resultado e baixe o PNG original
            gerado pelo APPIA.
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
                  🖼️ Galeria APPIA
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
                APPIA.
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
                {imagensDisponiveis.map(
                  (imagem) => (
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
                        alt="Galeria APPIA"
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

const painelStyle = {
  padding: "18px",
  borderRadius: "16px",
  border: "1px solid #334155",
  background: "#0f172a",
};

const previewPainel = {
  padding: "18px",
  borderRadius: "16px",
  border: "1px solid #334155",
  background: "#0f172a",
};

const passoTitulo = {
  color: "#67e8f9",
  fontWeight: "900",
  fontSize: "13px",
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
  margin: "16px 0",
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
  marginTop: "6px",
  padding: "11px 12px",
  borderRadius: "10px",
  border: "1px solid #334155",
  background: "#020617",
  color: "#f8fafc",
  outline: "none",
  boxSizing: "border-box",
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