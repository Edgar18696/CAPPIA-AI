import { supabase } from "../supabase";
import { obterMovimentoClipPremium } from "./clipPremium/catalogoMovimentos";
import { textoPreservacaoProduto } from "./clipPremium/preservacaoProduto";

export const ESTILOS_CLIP_PRODUTO = [
  {
    id: "marketplace",
    titulo: "B — Marketplace",
    icone: "🛒",
    descricao:
      "Slide lateral sutil da câmera (10–20°) + aproximação final. A peça não gira.",
    duracao: 12,
  },
  {
    id: "impacto",
    titulo: "C — Cinemático",
    icone: "⚡",
    descricao:
      "Aproximações nos detalhes e movimento cinematográfico controlado.",
    duracao: 15,
  },
];

export const ESTILOS_PRODUTO_UI = [
  {
    id: "comercial",
    estiloId: "marketplace",
    icone: "🛒",
    titulo: "Comercial",
    resumo: "Dinâmico e direto para vendas.",
    detalhe:
      "Movimento mais direto, produto bem enquadrado, ritmo comercial e possibilidade de textos. Indicado para marketplaces e redes sociais.",
  },
  {
    id: "cinematico",
    estiloId: "impacto",
    icone: "🎬",
    titulo: "Cinemático",
    resumo: "Visual premium com movimentos suaves.",
    detalhe:
      "Movimentos de câmera mais elegantes, aproximações e valorização dos detalhes do produto.",
  },
];

export const FORMATOS_CLIP = [
  {
    id: "quadrado",
    nome: "Marketplace",
    proporcao: "1:1",
    largura: 1080,
    altura: 1080,
  },
  {
    id: "vertical",
    nome: "Reels / Stories",
    proporcao: "9:16",
    largura: 1080,
    altura: 1920,
  },
  {
    id: "feed",
    nome: "Instagram Feed",
    proporcao: "4:5",
    largura: 1080,
    altura: 1350,
  },
  {
    id: "horizontal",
    nome: "WhatsApp / Site",
    proporcao: "16:9",
    largura: 1920,
    altura: 1080,
  },
];

export const MOVIMENTOS = [
  { id: "zoom-in", nome: "🔍 Aproximação" },
  { id: "zoom-out", nome: "Zoom de afastamento" },
  { id: "pan-esquerda", nome: "Pan para esquerda" },
  { id: "pan-direita", nome: "Pan para direita" },
  { id: "detalhe", nome: "🔬 Detalhes técnicos" },
];

// Giro 360° e Órbita lateral removidos: a peça nunca gira no Clip Premium.
export const MOVIMENTOS_DESTAQUE = [
  {
    id: "aproximacao",
    movimentoId: "zoom-in",
    nome: "🔍 Aproximação",
  },
  {
    id: "detalhes",
    movimentoId: "detalhe",
    nome: "🔬 Detalhes técnicos",
  },
];

export const TRILHAS = [
  { id: "sem-musica", nome: "Sem música" },
  { id: "corporativa", nome: "Corporativa leve" },
  { id: "automotiva", nome: "Automotiva moderna" },
  { id: "cinematica", nome: "Cinemática" },
  { id: "eletronica", nome: "Eletrônica discreta" },
];

export function criarCenaProduto(indice = 0) {
  return {
    id: `${Date.now()}-${Math.random()}`,
    nome: `Cena ${indice + 1}`,
    duracao: 3,
    movimento: MOVIMENTOS[indice % MOVIMENTOS.length].id,
  };
}

export function obterMensagemErro(data) {
  return (
    data?.erro ||
    data?.error ||
    data?.detalhes ||
    data?.message ||
    "Erro ao gerar o Clip IA."
  );
}

export const CODIGO_RECUSA_PROVEDOR = "E005";

export function erroSensivelE005(mensagem = "") {
  const texto = String(mensagem || "").toLowerCase();
  return (
    texto.includes("e005") ||
    texto.includes("recusa_provedor") ||
    texto.includes("raimediafiltered") ||
    texto.includes("flagged") ||
    texto.includes("sensitive") ||
    texto.includes("nsfw")
  );
}

// Verifica a resposta inteira da Edge Function (código + mensagem).
export function respostaEhRecusaE005(data, error) {
  const codigo = String(data?.codigo || data?.code || "").toUpperCase();
  if (codigo === CODIGO_RECUSA_PROVEDOR) {
    return true;
  }
  return erroSensivelE005(
    [data?.erro, data?.error, data?.detalhes, data?.message, error?.message]
      .filter(Boolean)
      .join(" ")
  );
}

export function mensagemAmigavelClip(mensagem = "") {
  if (erroSensivelE005(mensagem)) {
    return "O provedor de vídeo recusou esta geração (E005). Nenhum crédito PAIIA foi usado. Você pode tentar novamente — o PAIIA só gera de novo com a sua confirmação.";
  }
  return mensagem || "Erro ao gerar o Clip IA.";
}

export function montarInstrucoesNeutrasMarketplace() {
  return [
    "Criar um vídeo simples de apresentação de produto automotivo.",
    "Usar somente a peça mostrada na imagem enviada.",
    "Manter a peça centralizada e totalmente visível.",
    "Fundo branco ou neutro.",
    "A peça fica parada e nunca gira. Somente a câmera faz um deslizamento lateral sutil de 10–20 graus e uma aproximação suave no final, sem revelar lados ocultos.",
    "Sem pessoas, mãos, rostos, animais, veículos ou objetos adicionais.",
    "Sem textos, logotipos, marcas-d'água ou efeitos dramáticos.",
    "Preservar exatamente formato, cores e proporções do produto.",
  ].join(" ");
}

export function montarInstrucoesClipProduto({
  estilo,
  cenas,
  formato,
  trilhaClip,
  duracaoTotal,
  mostrarTextos,
  tituloClip,
  subtituloClip,
  movimentoProdutoVisual,
}) {
  void estilo;
  void cenas;
  const movimento = obterMovimentoClipPremium(movimentoProdutoVisual);
  const textoOverlay = mostrarTextos
    ? `Se necessário, usar título "${tituloClip || ""}" e subtítulo "${subtituloClip || ""}" de forma discreta.`
    : "Não adicionar textos, logotipos ou marcas-d'água.";
  const trilha =
    trilhaClip === "sem-musica"
      ? "Gerar sem música."
      : `Usar uma trilha ${TRILHAS.find((item) => item.id === trilhaClip)?.nome || trilhaClip}, discreta e sem voz.`;

  return [
    textoPreservacaoProduto(),
    "Utilizar somente a imagem enviada como referência visual.",
    `Modalidade: Clip Premium.`,
    "Movimento do Clip Premium: manter a peça completamente parada. Aplicar somente um deslocamento lateral muito suave da câmera, limitado a aproximadamente 10–20 graus, combinado com uma aproximação lenta. Não girar a peça, não orbitar ao redor dela e não revelar partes ocultas.",
    movimento?.promptMovimento || "",
    `Formato final ${formato.proporcao}, ${formato.largura}x${formato.altura}.`,
    textoOverlay,
    trilha,
    `Duração aproximada total: ${duracaoTotal} segundos.`,
  ]
    .filter(Boolean)
    .join(" ");
}

export async function chamarGerarClipProduto(body) {
  const { data: sessao, error: erroSessao } =
    await supabase.auth.getSession();
  const token = sessao?.session?.access_token || "";

  if (erroSessao || !token) {
    throw new Error("Faça login para gerar o Clip de Produto.");
  }

  const { data, error } = await supabase.functions.invoke(
    "gerar-clip-produto",
    {
      body,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  // Em respostas não-2xx o supabase-js não preenche `data`; lemos o
  // corpo para não perder o código (ex.: E005) e a mensagem pública.
  if (error && !data) {
    const corpo = await lerCorpoErroFuncao(error);
    return { data: corpo, error };
  }

  return { data, error };
}

export async function lerCorpoErroFuncao(error) {
  try {
    const resposta = error?.context;
    if (resposta && typeof resposta.clone === "function") {
      return await resposta.clone().json();
    }
    if (resposta && typeof resposta.json === "function") {
      return await resposta.json();
    }
  } catch {
    // corpo não era JSON
  }
  return null;
}

export async function obterUsuarioAtualClip() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user?.id) {
    throw new Error("Faça login para gerar e salvar o Clip.");
  }

  return data.user;
}

export async function consultarCreditosClip() {
  const { data, error } = await supabase.rpc("consultar_creditos_appia");

  if (error) {
    throw new Error(
      "Não foi possível consultar os créditos: " + error.message
    );
  }

  return Math.max(0, Number(data || 0));
}

export async function garantirImagemPublicaProduto(imagem) {
  const valor = String(imagem || "").trim();

  if (/^https?:\/\//i.test(valor)) {
    return valor;
  }

  if (!valor) {
    throw new Error("A imagem do Clip não foi informada.");
  }

  const respostaImagem = await fetch(valor);
  if (!respostaImagem.ok) {
    throw new Error("Não foi possível carregar a imagem do produto.");
  }

  const blob = await respostaImagem.blob();
  if (!blob.size) {
    throw new Error("A imagem do produto está vazia.");
  }

  const usuario = await obterUsuarioAtualClip();
  const extensao = blob.type === "image/jpeg" ? "jpg" : "png";
  const caminho = `${usuario.id}/marketing/clip-produto-${Date.now()}.${extensao}`;

  const { error: erroUpload } = await supabase.storage
    .from("imagens")
    .upload(caminho, blob, {
      contentType: blob.type || "image/png",
      upsert: true,
    });

  if (erroUpload) {
    throw new Error(
      "Não foi possível publicar a imagem do produto: " +
        erroUpload.message
    );
  }

  const { data: dadosPublicos } = supabase.storage
    .from("imagens")
    .getPublicUrl(caminho);

  const urlPublica = dadosPublicos?.publicUrl || "";

  if (!/^https?:\/\//i.test(urlPublica)) {
    throw new Error(
      "Não foi possível criar uma URL pública válida para o produto."
    );
  }

  return urlPublica;
}

export async function salvarClipProdutoNaGaleria({
  usuarioId,
  imagemOriginal,
  urlClip,
  estilo,
}) {
  const { data: existentes, error: erroBusca } = await supabase
    .from("processamentos")
    .select("id, imagem_processada, tipo")
    .eq("user_id", usuarioId)
    .eq("imagem_processada", urlClip)
    .limit(1);

  if (erroBusca) {
    console.warn("Erro ao verificar mídia existente:", erroBusca);
  }

  if (Array.isArray(existentes) && existentes.length > 0) {
    return existentes[0];
  }

  const { data, error } = await supabase
    .from("processamentos")
    .insert([
      {
        user_id: usuarioId,
        imagem_original: imagemOriginal || null,
        imagem_processada: urlClip,
        status: "finalizado",
        tipo: "clip",
        modelo_banner: estilo || "marketplace",
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(
      "O vídeo foi gerado, mas não foi possível salvá-lo em Mídias PAIIA: " +
        error.message
    );
  }

  return data;
}
export async function importarClipProduto({
  usuarioId,
  arquivo,
  imagemOriginal = null,
}) {
  if (!usuarioId) {
    throw new Error("Usuário não identificado.");
  }

  if (!arquivo) {
    throw new Error("Selecione um vídeo para importar.");
  }

  if (!arquivo.type?.startsWith("video/")) {
    throw new Error("O arquivo selecionado não é um vídeo válido.");
  }

  const extensao =
    arquivo.name?.split(".").pop()?.toLowerCase() || "mp4";

  const nomeSeguro = arquivo.name
    ?.replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 60);

  const caminho = `clips/${usuarioId}/${Date.now()}-${
    nomeSeguro || "clip"
  }.${extensao}`;

  const { error: erroUpload } = await supabase.storage
    .from("imagens")
    .upload(caminho, arquivo, {
      contentType: arquivo.type || "video/mp4",
      upsert: false,
    });

  if (erroUpload) {
    throw new Error(
      "Não foi possível importar o vídeo: " + erroUpload.message
    );
  }

  const { data: dadosUrl } = supabase.storage
    .from("imagens")
    .getPublicUrl(caminho);

  const urlClip = dadosUrl?.publicUrl;

  if (!urlClip) {
    throw new Error("Não foi possível obter a URL do vídeo importado.");
  }

  await salvarClipProdutoNaGaleria({
    usuarioId,
    imagemOriginal,
    urlClip,
    estilo: "clip-importado",
  });

  return {
    video: urlClip,
    importado: true,
  };
}
