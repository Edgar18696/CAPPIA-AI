import { supabase } from "../supabase";
import { obterMovimentoClipPremium } from "./clipPremium/catalogoMovimentos";
import { textoPreservacaoProduto } from "./clipPremium/preservacaoProduto";

export const ESTILOS_CLIP_PRODUTO = [
  {
    id: "marketplace",
    titulo: "B — Marketplace",
    icone: "🛒",
    descricao:
      "Rotação 360° suave no próprio eixo, mantendo a peça centralizada e estável.",
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
  { id: "orbita", nome: "↔️ Órbita lateral" },
  { id: "detalhe", nome: "🔬 Detalhes técnicos" },
];

export const MOVIMENTOS_DESTAQUE = [
  {
    id: "giro-360",
    movimentoId: "orbita",
    nome: "🔄 Giro 360°",
  },
  {
    id: "aproximacao",
    movimentoId: "zoom-in",
    nome: "🔍 Aproximação",
  },
  {
    id: "orbita-lateral",
    movimentoId: "orbita",
    nome: "↔️ Órbita lateral",
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

export function erroSensivelE005(mensagem = "") {
  const texto = String(mensagem || "").toLowerCase();
  return (
    texto.includes("e005") ||
    texto.includes("flagged") ||
    texto.includes("sensitive") ||
    texto.includes("nsfw")
  );
}

export function mensagemAmigavelClip(mensagem = "") {
  if (erroSensivelE005(mensagem)) {
    return "O PAIIA recusou esta geração pelo filtro automático de conteúdo. Tente outra foto da peça ou outro estilo.";
  }
  return mensagem || "Erro ao gerar o Clip IA.";
}

export function montarInstrucoesNeutrasMarketplace() {
  return [
    "Criar um vídeo simples de apresentação de produto automotivo.",
    "Usar somente a peça mostrada na imagem enviada.",
    "Manter a peça centralizada e totalmente visível.",
    "Fundo branco ou neutro.",
    "Movimento suave e discreto de apresentação do produto.",
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
    `Movimento solicitado: ${movimento.nome}. ${movimento.promptMovimento}`,
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

  return { data, error };
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
