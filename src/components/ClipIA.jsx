import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  marcarClipPronto,
} from "../services/projetoAtualService";

import { supabase } from "../supabase";
import { baixarClip as baixarClipArquivo } from "./utils/downloadUtils";
import {
  buscarMascoteOficial,
  obterUsuarioMascote,
} from "../services/mascoteMarcaService";
import PaizinhoConversa from "./PaizinhoConversa";
import ClipProduto from "./ClipProduto";
import { consultarCreditosClip } from "../services/clipProdutoPipeline";
import {
  consumirNovaCriacaoMidia,
  deveIniciarNovaCriacaoMidia,
  sessaoMidiaDeveContinuar,
} from "../services/limparEstadoTemporarioMidia";
const ESTILOS_CLIP = [
  {
    id: "clean",
    titulo: "A — Comercial",
    icone: "✨",
    descricao:
      "Movimento lateral suave, zoom discreto e apresentação limpa.",
    duracao: 15,
  },
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

const OBJETIVOS_MIDIA = [
  {
    id: "promocao",
    label: "Promoção",
  },
  {
    id: "produto",
    label: "Produto",
  },
  {
    id: "lancamento",
    label: "Lançamento",
  },
  {
    id: "empresa",
    label: "Empresa/Marca",
  },
  {
    id: "outro",
    label: "Outro",
  },
];

function nomeObjetivoMidia(
  objetivo,
  outro
) {
  if (objetivo === "promocao") {
    return "uma promoção";
  }

  if (objetivo === "produto") {
    return "um produto";
  }

  if (objetivo === "lancamento") {
    return "um lançamento";
  }

  if (objetivo === "empresa") {
    return "a empresa e a marca";
  }

  const texto = String(outro || "")
    .trim();

  return texto || "a sua divulgação";
}

function limitarFalaMascote(fala) {
  const texto = String(fala || "").trim();

  if (texto.length <= 260) {
    return texto;
  }

  return `${texto.slice(0, 257)}...`;
}

function normalizarPedidoPaizinho(pedido) {
  return String(pedido || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectarTomPedido(pedido) {
  const texto = normalizarPedidoPaizinho(pedido);

  if (
    /descontra|descolad|divertid|leve|animad|informal/.test(
      texto
    )
  ) {
    return "descontraido";
  }

  if (
    /institucional|formal|serio|profissional/.test(
      texto
    )
  ) {
    return "institucional";
  }

  if (/tecnic/.test(texto)) {
    return "tecnico";
  }

  if (/curto|reduz/.test(texto)) {
    return "curto";
  }

  return "";
}

function extrairDestaquesBriefing(briefing) {
  const texto = String(briefing || "").trim();
  const destacando = texto.match(
    /destacando\s+(.+?)(?:\.|$)/i
  );

  if (destacando?.[1]) {
    return destacando[1].trim();
  }

  return "";
}

function extrairMarcaDoBriefing(briefing) {
  const texto = String(briefing || "").trim();
  const da = texto.match(
    /\bda\s+([A-ZÁÉÍÓÚÂÊÔÃÕ][A-Za-zÀ-ÿ0-9]+)/
  );

  return da?.[1] || "";
}

function destaquesDoMascote(oficial = {}, briefing = "") {
  return (
    extrairDestaquesBriefing(briefing) ||
    extrairDestaquesBriefing(
      oficial.caracteristicas ||
        oficial.descricao_original
    ) ||
    [oficial.cores, oficial.estilo_visual]
      .filter(Boolean)
      .join(", ") ||
    "qualidade, confiança e tecnologia"
  );
}

function interpretarPedidoPaizinho(pedido) {
  const texto = normalizarPedidoPaizinho(pedido);
  const duracaoMatch = texto.match(
    /(\d+)\s*(s|seg)/
  );

  return {
    tom: detectarTomPedido(pedido),
    duracao: duracaoMatch
      ? Number(duracaoMatch[1])
      : null,
    somente: /somente a fala|so a fala|apenas a fala|mude somente a fala|muda somente a fala/.test(
      texto
    )
      ? "fala"
      : /somente o roteiro|so o roteiro|apenas o roteiro/.test(
          texto
        )
      ? "roteiro"
      : /somente a direcao|so a direcao|apenas a direcao/.test(
          texto
        )
      ? "direcao"
      : "",
    focoQualidade:
      /qualidade/.test(texto) &&
      /fale mais|fala mais|mais sobre|destaque|destaca/.test(
        texto
      ),
    maisForte:
      /mais forte|mais impacto|mais agressiv|propaganda mais forte|mais poderos/.test(
        texto
      ),
    apresentarProduto:
      /este produto|apresentar o produto|apresenta o produto|mostrar o produto/.test(
        texto
      ),
  };
}

function montarTextosDoBriefing({
  marca,
  personagem,
  destaques,
  tom,
  temProduto,
  maisForte,
  focoQualidade,
  duracao,
}) {
  let dicas =
    destaques ||
    "qualidade, confiança e tecnologia";

  if (focoQualidade && !/qualidade/i.test(dicas)) {
    dicas = `qualidade, ${dicas}`;
  }

  if (focoQualidade) {
    dicas = dicas.replace(
      /qualidade/i,
      "qualidade em primeiro lugar"
    );
  }

  const clima =
    tom ||
    (duracao && duracao <= 12 ? "curto" : "") ||
    (maisForte ? "forte" : "") ||
    "institucional";
  const alvo = temProduto
    ? "este produto"
    : "a marca";

  if (clima === "descontraido") {
    return {
      fala: limitarFalaMascote(
        temProduto
          ? `E aí! Eu sou o ${personagem}. Olha este produto da ${marca}: ${dicas} em cada detalhe. ${marca}, pra quem curte automóvel de verdade.`
          : `E aí! Eu sou o ${personagem}. Na ${marca}, ${dicas} vão com você em cada peça. ${marca}, pra quem curte automóvel de verdade.`
      ),
      roteiro: `${personagem} entra descontraído apresentando ${alvo}. Cumprimenta a câmera, destaca ${dicas} com leveza e fecha mostrando a ${marca} em destaque.`,
      direcao: `${personagem} entra sorrindo, acena, olha para a câmera e apresenta ${alvo} com energia leve. Faz gesto de aprovação e termina com a marca em destaque.`,
    };
  }

  if (clima === "tecnico") {
    return {
      fala: limitarFalaMascote(
        `Na ${marca}, cada peça une ${dicas}. ${marca}, especificada para quem entende de automóvel.`
      ),
      roteiro: `${personagem} apresenta ${alvo} da ${marca} com foco técnico. Destaca ${dicas} e fecha com a marca em evidência.`,
      direcao: `${personagem} olha para a câmera, aponta ${alvo}, explica com clareza e faz gesto de aprovação. Câmera suave e final com a marca.`,
    };
  }

  if (clima === "curto") {
    return {
      fala: limitarFalaMascote(
        temProduto
          ? `Este produto é ${marca}: ${dicas} em cada peça.`
          : `Na ${marca}, ${dicas} em cada peça.`
      ),
      roteiro: `${personagem} entra, apresenta ${alvo} e fecha com a ${marca} em destaque.`,
      direcao: `${personagem} olha para a câmera, apresenta ${alvo} e termina com gesto de aprovação.`,
    };
  }

  if (clima === "forte" || maisForte) {
    return {
      fala: limitarFalaMascote(
        temProduto
          ? `Este é o padrão ${marca}. ${dicas} sem concessões. Feito para quem exige o melhor no automóvel.`
          : `Na ${marca}, ${dicas} não são discurso: estão em cada peça. ${marca}, para quem não abre mão de resultado.`
      ),
      roteiro: `${personagem} entra com presença, apresenta ${alvo} com impacto e reforça ${dicas}. Fecha com a ${marca} em destaque absoluto.`,
      direcao: `${personagem} entra firme, olha direto para a câmera, aponta ${alvo} e faz gesto de aprovação decisivo. Câmera próxima e final com a marca em evidência.`,
    };
  }

  return {
    fala: limitarFalaMascote(
      temProduto
        ? `Olha este produto. Na ${marca}, ${dicas} acompanham você em cada peça. ${marca}, feita para quem entende de automóvel.`
        : `Na ${marca}, ${dicas} acompanham você em cada peça. ${marca}, feita para quem entende de automóvel.`
    ),
    roteiro: `${personagem} entra em cena apresentando ${alvo}. A câmera aproxima suavemente enquanto ele destaca ${dicas} da ${marca}. Finaliza mostrando a marca em destaque.`,
    direcao: `${personagem} entra sorrindo, olha para a câmera, apresenta ${alvo} e faz gesto de aprovação. Movimento de câmera suave e final com destaque para a marca.`,
  };
}

function mesclarCamposPaizinho(atual, novo, somente) {
  if (somente === "fala") {
    return {
      ...atual,
      fala: novo.fala,
    };
  }

  if (somente === "roteiro") {
    return {
      ...atual,
      roteiro: novo.roteiro,
    };
  }

  if (somente === "direcao") {
    return {
      ...atual,
      direcao: novo.direcao,
    };
  }

  return novo;
}

function prepararTextosPaizinho({
  objetivo,
  outro,
  empresa,
  personagem,
  observacoes,
  roteiroAtual,
  falaAtual,
  direcaoAtual,
  mascote,
  temProduto,
  forcarInicial,
}) {
  const pedido = String(observacoes || "").trim();
  const oficial = mascote || {};
  const marca =
    String(empresa || "").trim() ||
    String(oficial.empresa || "").trim() ||
    extrairMarcaDoBriefing(pedido) ||
    extrairMarcaDoBriefing(falaAtual) ||
    "sua marca";
  const nomePersonagem =
    String(personagem || "").trim() ||
    String(oficial.nome || "").trim() ||
    "o mascote";
  const destaques = destaquesDoMascote(
    oficial,
    pedido || outro
  );
  const interpretacao = interpretarPedidoPaizinho(
    pedido
  );
  const usarProduto =
    Boolean(temProduto) ||
    interpretacao.apresentarProduto ||
    objetivo === "produto";
  const resumo = usarProduto
    ? `Divulgação de produto da ${marca} com ${nomePersonagem}, destacando ${destaques}.`
    : `Divulgação institucional da ${marca} com ${nomePersonagem}, destacando ${destaques}.`;
  const temTextos = Boolean(
    String(falaAtual || "").trim() ||
      String(roteiroAtual || "").trim()
  );
  const novo = montarTextosDoBriefing({
    marca,
    personagem: nomePersonagem,
    destaques,
    tom: interpretacao.tom,
    temProduto: usarProduto,
    maisForte: interpretacao.maisForte,
    focoQualidade: interpretacao.focoQualidade,
    duracao: interpretacao.duracao,
  });

  const textos =
    !forcarInicial && pedido && temTextos
      ? mesclarCamposPaizinho(
          {
            fala: falaAtual,
            roteiro: roteiroAtual,
            direcao: direcaoAtual,
          },
          novo,
          interpretacao.somente
        )
      : novo;

  return {
    ...textos,
    resumo,
    objetivo: usarProduto ? "produto" : "empresa",
    duracao: interpretacao.duracao,
  };
}

const FORMATOS_CLIP = [
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

const MOVIMENTOS = [
  {
    id: "zoom-in",
    nome: "🔍 Aproximação",
  },
  {
    id: "zoom-out",
    nome: "Zoom de afastamento",
  },
  {
    id: "pan-esquerda",
    nome: "Pan para esquerda",
  },
  {
    id: "pan-direita",
    nome: "Pan para direita",
  },
  {
    id: "orbita",
    nome: "↔️ Órbita lateral",
  },
  {
    id: "detalhe",
    nome: "🔬 Detalhes técnicos",
  },
];

const MOVIMENTOS_DESTAQUE = [
  {
    id: "giro-360",
    movimentoId: "orbita",
    nome: "🔄 Giro 360°",
    avisoFotoUnica: true,
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

const CHAVE_ESTADO_CRIACAO_CLIP =
  "paiiaEstadoCriacaoClip";
const CHAVE_RESTAURAR_CRIACAO_CLIP =
  "paiiaRestaurarCriacaoClip";
const CHAVE_VOLTAR_CRIACAO_CLIP =
  "voltarParaCriacaoClip";

const TRILHAS = [
  {
    id: "sem-musica",
    nome: "Sem música",
  },
  {
    id: "corporativa",
    nome: "Corporativa leve",
  },
  {
    id: "automotiva",
    nome: "Automotiva moderna",
  },
  {
    id: "cinematica",
    nome: "Cinemática",
  },
  {
    id: "eletronica",
    nome: "Eletrônica discreta",
  },
];

function obterMensagemErro(data) {
  return (
    data?.erro ||
    data?.error ||
    data?.detalhes ||
    data?.message ||
    "Erro ao gerar o Clip IA."
  );
}

function erroSensivelE005(mensagem = "") {
  const texto = String(
    mensagem || ""
  ).toLowerCase();

  return (
    texto.includes("e005") ||
    texto.includes(
      "flagged as sensitive"
    ) ||
    texto.includes(
      "input or output was flagged as sensitive"
    )
  );
}

function mensagemAmigavelClip(
  mensagem = ""
) {
  if (
    erroSensivelE005(
      mensagem
    )
  ) {
    return (
      "O PAIIA recusou esta geração pelo filtro automático de conteúdo. " +
      "Isso pode acontecer mesmo com uma foto normal de autopeça."
    );
  }

  return mensagem;
}

function montarInstrucoesNeutrasMarketplace() {
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

function criarCena(indice = 0) {
  return {
    id: `${Date.now()}-${Math.random()}`,
    nome: `Cena ${indice + 1}`,
    duracao: 3,
    movimento:
      MOVIMENTOS[indice % MOVIMENTOS.length].id,
  };
}



async function garantirImagemPublicaClip(
  imagem,
  opcoes = {}
) {
  const valor = String(
    imagem || ""
  ).trim();

  if (
    /^https?:\/\//i.test(
      valor
    )
  ) {
    return valor;
  }

  if (!valor) {
    throw new Error(
      "A imagem do Clip não foi informada."
    );
  }

  const respostaImagem =
    await fetch(valor);

  if (!respostaImagem.ok) {
    throw new Error(
      "Não foi possível carregar a imagem local do mascote."
    );
  }

  const blob =
    await respostaImagem.blob();

  if (!blob.size) {
    throw new Error(
      "A imagem do mascote está vazia."
    );
  }

  const usuario =
    await obterUsuarioAtualClip();

  const extensao =
    blob.type === "image/jpeg"
      ? "jpg"
      : "png";

  const caminho = opcoes.mascote
    ? `${usuario.id}/marketing/mascotes/mascote-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${extensao}`
    : `${usuario.id}/marketing/paizinho-appia.${extensao}`;

  const {
    error: erroUpload,
  } =
    await supabase.storage
      .from("imagens")
      .upload(
        caminho,
        blob,
        {
          contentType:
            blob.type ||
            "image/png",
          upsert: !opcoes.mascote,
        }
      );

  if (erroUpload) {
    throw new Error(
      "Não foi possível publicar a imagem do mascote para gerar o vídeo: " +
        erroUpload.message
    );
  }

  const {
    data: dadosPublicos,
  } =
    supabase.storage
      .from("imagens")
      .getPublicUrl(
        caminho
      );

  const urlPublica =
    dadosPublicos?.publicUrl ||
    "";

  if (
    !/^https?:\/\//i.test(
      urlPublica
    )
  ) {
    throw new Error(
      "Não foi possível criar uma URL pública válida para o mascote."
    );
  }

  return urlPublica;
}


async function gerarVozPaizinhoSeparada(
  fala
) {
  const texto =
    String(
      fala || ""
    ).trim();

  if (!texto) {
    throw new Error(
      "O roteiro de voz do Paizinho está vazio."
    );
  }

  const {
    data,
    error,
  } =
    await supabase.functions.invoke(
      "gerar-voz-paizinho",
      {
        body: {
          fala:
            texto,
        },
      }
    );

  if (error) {
    throw new Error(
      "Não foi possível gerar a voz do Paizinho: " +
        (error.message || "erro na função de voz.")
    );
  }

  if (
    !data?.sucesso ||
    !(
      data?.audio_url ||
      data?.audio
    )
  ) {
    throw new Error(
      data?.erro ||
        "A função de voz não retornou um áudio válido."
    );
  }

  return (
    data.audio_url ||
    data.audio
  );
}


async function sincronizarPaizinhoSeparado({
  videoUrl,
  audioUrl,
  onStatus,
}) {
  if (!videoUrl) {
    throw new Error(
      "O vídeo do Paizinho não foi informado para sincronização."
    );
  }

  if (!audioUrl) {
    throw new Error(
      "O áudio do Paizinho não foi informado para sincronização."
    );
  }

  onStatus?.(
    "🗣️ Iniciando sincronização da voz do Paizinho..."
  );

  const {
    data: inicio,
    error: erroInicio,
  } =
    await supabase.functions.invoke(
      "sincronizar-paizinho",
      {
        body: {
          videoUrl,
          audioUrl,
        },
      }
    );

  if (erroInicio) {
    throw new Error(
      "Não foi possível iniciar a sincronização da voz do Paizinho: " +
        (
          erroInicio.message ||
          "erro na função de sincronização."
        )
    );
  }

  if (
    !inicio?.sucesso ||
    !inicio?.prediction_id
  ) {
    throw new Error(
      inicio?.erro ||
        "A sincronização não retornou o predictionId."
    );
  }

  const predictionId =
    inicio.prediction_id;

  for (
    let tentativa = 0;
    tentativa < 120;
    tentativa++
  ) {
    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          3000
        )
    );

    onStatus?.(
      "🗣️ Sincronizando voz e movimentos do Paizinho..."
    );

    const {
      data: consulta,
      error: erroConsulta,
    } =
      await supabase.functions.invoke(
        "consultar-lipsync-paizinho",
        {
          body: {
            predictionId,
          },
        }
      );

    if (erroConsulta) {
      throw new Error(
        "Não foi possível consultar a sincronização do Paizinho: " +
          (
            erroConsulta.message ||
            "erro ao consultar o Lip Sync."
          )
      );
    }

    if (!consulta?.sucesso) {
      throw new Error(
        consulta?.erro ||
          "A sincronização do Paizinho retornou erro."
      );
    }

    if (
      consulta?.concluido
    ) {
      const videoFinal =
        consulta?.video_url ||
        consulta?.video ||
        "";

      if (!videoFinal) {
        throw new Error(
          "A sincronização terminou, mas não retornou o vídeo final."
        );
      }

      return videoFinal;
    }
  }

  throw new Error(
    "A sincronização da voz do Paizinho demorou mais que o esperado."
  );
}

async function obterUsuarioAtualClip() {
  const {
    data,
    error,
  } = await supabase.auth.getUser();

  if (
    error ||
    !data?.user?.id
  ) {
    throw new Error(
      "Faça login para gerar e salvar o Clip."
    );
  }

  return data.user;
}


async function chamarGerarClipProduto(body) {
  const {
    data: sessao,
    error: erroSessao,
  } = await supabase.auth.getSession();

  const token =
    sessao?.session?.access_token || "";

  if (erroSessao || !token) {
    throw new Error(
      "Faça login para gerar o Clip de Produto."
    );
  }

  const {
    data,
    error,
  } = await supabase.functions.invoke(
    "gerar-clip-produto",
    {
      body,
      headers: {
        Authorization:
          `Bearer ${token}`,
      },
    }
  );

  return {
    data,
    error,
  };
}

async function salvarClipGeradoNaGaleria({
  usuarioId,
  imagemOriginal,
  urlClip,
  estilo,
  tipo = "clip",
}) {
  if (!usuarioId) {
    throw new Error(
      "Usuário não identificado para salvar a mídia."
    );
  }

  if (!urlClip) {
    throw new Error(
      "O vídeo foi gerado, mas não possui uma URL válida."
    );
  }

  const tipoFinal =
    tipo === "mascote"
      ? "video"
      : "clip";

  const {
    data: existentes,
    error: erroBusca,
  } =
    await supabase
      .from("processamentos")
      .select(
        "id, imagem_processada, tipo"
      )
      .eq(
        "user_id",
        usuarioId
      )
      .eq(
        "imagem_processada",
        urlClip
      )
      .limit(1);

  if (erroBusca) {
    console.warn(
      "Erro ao verificar mídia existente:",
      erroBusca
    );
  }

  if (
    Array.isArray(existentes) &&
    existentes.length > 0
  ) {
    console.log(
      "✅ Mídia já registrada no PAIIA:",
      existentes[0]
    );

    return existentes[0];
  }

  const registro = {
    user_id:
      usuarioId,

    imagem_original:
      imagemOriginal || null,

    imagem_processada:
      urlClip,

    status:
      "finalizado",

    tipo:
      tipoFinal,

    modelo_banner:
      estilo ||
      (
        tipo === "mascote"
          ? "mascote-veo"
          : "marketplace"
      ),
  };

  const {
    data,
    error,
  } =
    await supabase
      .from("processamentos")
      .insert([
        registro,
      ])
      .select()
      .single();

  if (error) {
    console.error(
      "❌ ERRO SALVAR MÍDIA PAIIA:",
      error
    );

    throw new Error(
      "O vídeo foi gerado, mas não foi possível salvá-lo em Mídias PAIIA: " +
        error.message
    );
  }

  console.log(
    "✅ MÍDIA SALVA NO PAIIA:",
    data
  );

  return data;
}
function atualizarClipNosStorages({
  urlClip,
  estilo,
  formato,
  duracao,
}) {
  const chaves = [
    "novoAnuncioTemporario",
    "rascunhoNovoAnuncioTemp",
    "anuncioProntoPublicacao",
    "mlAnuncioTeste",
  ];

  for (
    const chave of chaves
  ) {
    try {
      const salvo =
        localStorage.getItem(
          chave
        );

      if (!salvo) {
        continue;
      }

      const dados =
        JSON.parse(salvo);

      localStorage.setItem(
        chave,
        JSON.stringify({
          ...dados,
          clip:
            urlClip,
          clip_url:
            urlClip,
          clipEstilo:
            estilo,
          clipFormato:
            formato,
          clipDuracao:
            duracao,
        })
      );
    } catch (erro) {
      console.error(
        `Erro ao atualizar Clip em ${chave}:`,
        erro
      );
    }
  }
}

function notificarClipPronto({
  urlClip,
  estilo,
  formato,
  duracao,
}) {
  window.dispatchEvent(
    new CustomEvent(
      "appia:clip-pronto",
      {
        detail: {
          urlClip,
          estilo,
          formato,
          duracao,
        },
      }
    )
  );
}

function notificarClipErro(
  mensagem
) {
  window.dispatchEvent(
    new CustomEvent(
      "appia:clip-erro",
      {
        detail: {
          mensagem,
        },
      }
    )
  );
}


function finalizarClipParaAnuncio({
  urlClip,
  estilo,
  formato,
  duracao,
}) {
  if (!urlClip) {
    throw new Error(
      "O Clip foi concluído sem uma URL válida."
    );
  }

  localStorage.setItem(
    "clipSelecionado",
    urlClip
  );

  localStorage.setItem(
    "clipPronto",
    urlClip
  );

  localStorage.setItem(
    "clipSelecionadoEstilo",
    estilo || "marketplace"
  );

  localStorage.setItem(
    "clipGeracaoStatus",
    "pronto"
  );

  localStorage.setItem(
    "clipGeracaoMensagem",
    "✅ Clip pronto, salvo na Galeria e vinculado ao anúncio"
  );

  localStorage.removeItem(
    "clipGeracaoErro"
  );

  atualizarClipNosStorages({
    urlClip,
    estilo:
      estilo || "marketplace",
    formato:
      formato || "quadrado",
    duracao:
      Number(duracao || 0),
  });

  marcarClipPronto({
    clip_url: urlClip,
    estilo:
      estilo || "marketplace",
    formato:
      formato || "quadrado",
    duracao:
      Number(duracao || 0),
  });

  notificarClipPronto({
    urlClip,
    estilo:
      estilo || "marketplace",
    formato:
      formato || "quadrado",
    duracao:
      Number(duracao || 0),
  });
}

function BlocoPaizinhoDestaque({
  titulo = "Crie seu mascote ou prepare seu vídeo",
  texto = "Você pode começar descrevendo sua ideia. A foto é opcional.",
}) {
  return (
    <div
      style={{
        marginBottom: "16px",
        padding: "18px 18px 16px",
        borderRadius: "16px",
        border: "1px solid rgba(34,211,238,.45)",
        background:
          "linear-gradient(145deg,#082f49 0%,#0c4a6e 42%,#0f172a 100%)",
        boxShadow:
          "0 12px 32px rgba(8,47,73,.35), inset 0 1px 0 rgba(103,232,249,.18)",
      }}
    >
      <div
        style={{
          color: "#67e8f9",
          fontSize: "22px",
          fontWeight: "bold",
          letterSpacing: "0.02em",
          lineHeight: 1.2,
        }}
      >
        🤖 PAIZINHO IA
      </div>
      <div
        style={{
          marginTop: "8px",
          color: "#e0f2fe",
          fontSize: "15px",
          fontWeight: "bold",
        }}
      >
        {titulo}
      </div>
      <p
        style={{
          margin: "6px 0 0",
          color: "#94a3b8",
          fontSize: "13px",
          lineHeight: 1.5,
        }}
      >
        {texto}
      </p>
    </div>
  );
}

export default function ClipIA({
  cardStyle,
  setScreen,
  embutido = false,
}) {
  const entradaClipProcessadaRef =
    useRef(false);

const inputFotoClipRef =
  useRef(null);
  const blocoCriarMascoteRef = useRef(null);

  const [imagemClip, setImagemClip] = useState("");

  const [videosGerados, setVideosGerados] =
    useState([]);

  const [ultimosClips, setUltimosClips] =
    useState([]);

  const [
    carregandoUltimosClips,
    setCarregandoUltimosClips,
  ] = useState(false);


  const [
    mostrarUltimosClips,
    setMostrarUltimosClips,
  ] = useState(false);

  const [
    videoSelecionadoId,
    setVideoSelecionadoId,
  ] = useState("");

  const [processandoClip, setProcessandoClip] =
    useState(false);

  const [statusClip, setStatusClip] =
    useState("");

  const [saldoCreditos, setSaldoCreditos] =
    useState(null);

  const [
    carregandoCreditos,
    setCarregandoCreditos,
  ] = useState(true);

  const [clipConfirmado, setClipConfirmado] =
    useState(false);

  const [modoGeracao, setModoGeracao] =
    useState("aguardando");

  const [entradaMarketing, setEntradaMarketing] =
    useState(false);

  const modoPaizinho =
    modoGeracao === "paizinho";

  const modoMascote =
    modoGeracao === "mascote";

  const modoClipProduto = false;

  const [empresaMascote, setEmpresaMascote] =
    useState("");

  const [falaMascote, setFalaMascote] =
    useState("");

  const [instrucaoMascote, setInstrucaoMascote] =
    useState(
      "O mascote olha para a câmera, fala com simpatia e faz gestos naturais de apresentação."
    );

  const [objetivoMidia, setObjetivoMidia] =
    useState("");

  const [objetivoOutro, setObjetivoOutro] =
    useState("");

  const [observacoesMidia, setObservacoesMidia] =
    useState("");

  const [
    personalizarPaizinho,
    setPersonalizarPaizinho,
  ] = useState(false);

  const [abaMidias, setAbaMidias] = useState("produto");

  function escolherAbaMidias(aba) {
    const valor =
      aba === "clip" || aba === "produto"
        ? aba
        : "paizinho";
    setAbaMidias(valor);
    localStorage.setItem("paiiaAbaMidias", valor);
    if (valor === "clip") {
      setModoGeracao("mascote");
    }
  }

  useEffect(() => {
    localStorage.setItem("paiiaAbaMidias", "produto");
  }, []);

  const [
    resumoCampanhaMascote,
    setResumoCampanhaMascote,
  ] = useState("");

  const [roteiroMidia, setRoteiroMidia] =
    useState("");

  const [
    roteiroPaizinhoPronto,
    setRoteiroPaizinhoPronto,
  ] = useState(false);

  const [opcaoMascoteUi, setOpcaoMascoteUi] =
    useState("");

  const [mascoteOficial, setMascoteOficial] =
    useState(null);

  const [
    movimentoDestaqueUi,
    setMovimentoDestaqueUi,
  ] = useState("");

  const [
    mostrarModalCreditos,
    setMostrarModalCreditos,
  ] = useState(false);

  const [falaPaizinho, setFalaPaizinho] =
  useState(
    "Ei! Estou ficando fraca... quase não consigo respirar! E você aí, gastando combustível demais! Acho que está na hora de me trocar. Corre pra Casa da Injeção e coloca uma sonda de qualidade, antes que eu apague de vez!"
  );

  const [estiloSelecionado, setEstiloSelecionado] =
    useState("marketplace");

  const [formatoClip, setFormatoClip] =
    useState("quadrado");

  const [trilhaClip, setTrilhaClip] =
    useState("sem-musica");

  const [tituloClip, setTituloClip] =
    useState("");

  const [subtituloClip, setSubtituloClip] =
    useState("");

  const [mostrarTextos, setMostrarTextos] =
    useState(false);

  const [cenas, setCenas] = useState(() => [
    criarCena(0),
    criarCena(1),
    criarCena(2),
  ]);

  const [etapasGeracao, setEtapasGeracao] =
    useState([
      {
        id: "analise",
        texto: "Analisando a peça",
        concluida: false,
      },
      {
        id: "roteiro",
        texto: "Montando roteiro e timeline",
        concluida: false,
      },
      {
        id: "movimento",
        texto: "Criando movimentos de câmera",
        concluida: false,
      },
      {
        id: "render",
        texto: "Renderizando os vídeos",
        concluida: false,
      },
    ]);

  const videoSelecionado = useMemo(() => {
    return (
      videosGerados.find(
        (item) =>
          item.id === videoSelecionadoId
      ) || null
    );
  }, [videosGerados, videoSelecionadoId]);

  const formatoSelecionado = useMemo(() => {
    return (
      FORMATOS_CLIP.find(
        (item) => item.id === formatoClip
      ) || FORMATOS_CLIP[0]
    );
  }, [formatoClip]);

  const duracaoTotal = useMemo(() => {
    if (modoMascote) {
      return 8;
    }

    if (modoPaizinho) {
      return 15;
    }

    return cenas.reduce(
      (total, cena) =>
        total + Number(cena.duracao || 0),
      0
    );
  }, [cenas, modoMascote, modoPaizinho]);

  useEffect(() => {
    // Evita que o React StrictMode execute a lógica de entrada
    // duas vezes durante o desenvolvimento.
    if (entradaClipProcessadaRef.current) {
      return;
    }

    entradaClipProcessadaRef.current = true;

    if (
      deveIniciarNovaCriacaoMidia() &&
      !sessaoMidiaDeveContinuar()
    ) {
      setImagemClip("");
      setVideosGerados([]);
      setVideoSelecionadoId("");
      setClipConfirmado(false);
      setStatusClip("");
      setProcessandoClip(false);
      setRoteiroMidia("");
      localStorage.removeItem("imagemClipSelecionada");
      localStorage.removeItem("imagemClipProdutoSelecionada");
      localStorage.removeItem("abrirClipAutomatico");
      localStorage.removeItem("retornarParaClipIA");
      localStorage.removeItem("clipSelecionado");
      localStorage.removeItem("clipSelecionadoEstilo");
      consumirNovaCriacaoMidia();
      return;
    }

    if (
      localStorage.getItem(
        CHAVE_RESTAURAR_CRIACAO_CLIP
      ) === "true"
    ) {
      try {
        const bruto =
          localStorage.getItem(
            CHAVE_ESTADO_CRIACAO_CLIP
          );
        const estado = bruto
          ? JSON.parse(bruto)
          : null;

        if (estado && typeof estado === "object") {
          if (estado.imagemClip) {
            setImagemClip(estado.imagemClip);
            localStorage.setItem(
              "imagemClipSelecionada",
              estado.imagemClip
            );
          }
          if (estado.modoGeracao) {
            const modoRestaurado =
              estado.modoGeracao === "rapido" ||
              estado.modoGeracao === "personalizado"
                ? "mascote"
                : estado.modoGeracao;
            setModoGeracao(modoRestaurado);
          }
          if (estado.estiloSelecionado) {
            setEstiloSelecionado(
              estado.estiloSelecionado
            );
          }
          if (estado.formatoClip) {
            setFormatoClip(estado.formatoClip);
          }
          if (estado.trilhaClip) {
            setTrilhaClip(estado.trilhaClip);
          }
          if (Array.isArray(estado.cenas) && estado.cenas.length) {
            setCenas(estado.cenas);
          }
          if (estado.roteiroMidia != null) {
            setRoteiroMidia(estado.roteiroMidia);
          }
          if (estado.falaMascote != null) {
            setFalaMascote(estado.falaMascote);
          }
          if (estado.instrucaoMascote != null) {
            setInstrucaoMascote(
              estado.instrucaoMascote
            );
          }
          if (estado.empresaMascote != null) {
            setEmpresaMascote(
              estado.empresaMascote
            );
          }
          if (estado.observacoesMidia != null) {
            setObservacoesMidia(
              estado.observacoesMidia
            );
          }
          if (estado.tituloClip != null) {
            setTituloClip(estado.tituloClip);
          }
          if (estado.subtituloClip != null) {
            setSubtituloClip(
              estado.subtituloClip
            );
          }
          if (typeof estado.mostrarTextos === "boolean") {
            setMostrarTextos(estado.mostrarTextos);
          }
          if (estado.opcaoMascoteUi != null) {
            setOpcaoMascoteUi(
              estado.opcaoMascoteUi
            );
          }
          if (estado.movimentoDestaqueUi != null) {
            setMovimentoDestaqueUi(
              estado.movimentoDestaqueUi
            );
          }
          if (typeof estado.roteiroPaizinhoPronto === "boolean") {
            setRoteiroPaizinhoPronto(
              estado.roteiroPaizinhoPronto
            );
          }
        }
      } catch (erro) {
        console.error(
          "Não foi possível restaurar a criação do Clip:",
          erro
        );
      }

      localStorage.removeItem(
        CHAVE_RESTAURAR_CRIACAO_CLIP
      );
      return;
    }

    const abrirPaizinhoMarketing =
      localStorage.getItem(
        "abrirPaizinhoMarketing"
      ) === "true";

    const campanhaMarketingAppia =
      localStorage.getItem(
        "campanhaMarketingAppia"
      ) || "";

    if (abrirPaizinhoMarketing) {
      const imagemPaizinho =
  "/campanha-torken.png";

      setEntradaMarketing(true);
      setImagemClip(imagemPaizinho);
      setModoGeracao("paizinho");
      setFormatoClip("vertical");
      setTrilhaClip("sem-musica");
      setMostrarTextos(false);
      setTituloClip("");
      setSubtituloClip("");

      const campanhaNormalizada =
        String(
          campanhaMarketingAppia || ""
        ).toLowerCase();

      if (
        campanhaNormalizada.includes("codigo") ||
        campanhaNormalizada.includes("código") ||
        campanhaNormalizada.includes("anuncio") ||
        campanhaNormalizada.includes("anúncio")
      ) {
       setFalaPaizinho(
  "Ei! Estou ficando fraca... quase não consigo respirar! E você aí, gastando combustível demais! Acho que está na hora de me trocar. Corre pra Casa da Injeção e coloca uma sonda de qualidade, antes que eu apague de vez!"
);
      }

      setCenas([
        {
  id: `${Date.now()}-${Math.random()}`,
  nome: "Apresentação Sondinha",
  duracao: 15,
  movimento: "zoom-in",
},
      ]);

      setVideosGerados([]);
      setVideoSelecionadoId("");
      setClipConfirmado(false);
      setStatusClip("");
      setProcessandoClip(false);

      setEtapasGeracao((anteriores) =>
        anteriores.map((etapa) => ({
          ...etapa,
          concluida: false,
        }))
      );

      localStorage.removeItem(
        "abrirPaizinhoMarketing"
      );

      localStorage.removeItem(
        "campanhaMarketingAppia"
      );

      return;
    }

    const abrirCriacaoIA =
      localStorage.getItem(
        "abrirModoCriacaoIA"
      ) === "true" ||
      localStorage.getItem(
        "abrirModoMascoteIA"
      ) === "true";

    if (abrirCriacaoIA) {
      setModoGeracao("mascote");
      setFormatoClip("vertical");
      setTrilhaClip("sem-musica");
      setMostrarTextos(false);
      setCenas([
        {
          id: `criacao-${Date.now()}`,
          nome: "Criação IA",
          duracao: 8,
          movimento: "apresentacao",
        },
      ]);

      localStorage.removeItem(
        "abrirModoCriacaoIA"
      );
      localStorage.removeItem(
        "abrirModoMascoteIA"
      );
    }

    const imagemNova =
      localStorage.getItem(
        "imagemClipSelecionada"
      ) || "";

    const abrirAutomatico =
      localStorage.getItem(
        "abrirClipAutomatico"
      ) === "true";

    if (abrirAutomatico && imagemNova) {
      if (localStorage.getItem("paiiaAbaMidias") === "produto") {
        localStorage.setItem(
          "imagemClipProdutoSelecionada",
          imagemNova
        );
        localStorage.removeItem("abrirClipAutomatico");
        localStorage.removeItem("retornarParaClipIA");
        return;
      }

      setImagemClip(imagemNova);

      setVideosGerados([]);
      setVideoSelecionadoId("");
      setClipConfirmado(false);
      setStatusClip("");
      setProcessandoClip(false);

      setEtapasGeracao((anteriores) =>
        anteriores.map((etapa) => ({
          ...etapa,
          concluida: false,
        }))
      );

      localStorage.removeItem(
        "imagemClipSelecionada"
      );

      localStorage.removeItem(
        "abrirClipAutomatico"
      );

      localStorage.removeItem(
        "retornarParaClipIA"
      );

      return;
    }

    // Entrada manual pelo menu: sessão nova e limpa.
    setImagemClip("");

    setVideosGerados([]);
    setVideoSelecionadoId("");
    setClipConfirmado(false);
    setStatusClip("");
    setProcessandoClip(false);

    setEtapasGeracao((anteriores) =>
      anteriores.map((etapa) => ({
        ...etapa,
        concluida: false,
      }))
    );

    localStorage.removeItem(
      "imagemClipSelecionada"
    );

    localStorage.removeItem(
      "abrirClipAutomatico"
    );

    localStorage.removeItem(
      "retornarParaClipIA"
    );

    localStorage.removeItem(
      "clipSelecionado"
    );

    localStorage.removeItem(
      "clipSelecionadoEstilo"
    );

    localStorage.removeItem(
      "imagemClipProdutoSelecionada"
    );
  }, []);

  useEffect(() => {
    let ativo = true;

    async function carregarMascoteOficial() {
      try {
        const usuario = await obterUsuarioMascote();
        const oficial = await buscarMascoteOficial(
          usuario.id
        );

        if (!ativo) {
          return;
        }

        setMascoteOficial(oficial || null);

        if (
          localStorage.getItem(
            "paiiaUsarMascoteOficial"
          ) === "true" &&
          oficial?.imagem_base
        ) {
          localStorage.removeItem(
            "paiiaUsarMascoteOficial"
          );
          aplicarImagemMascote(oficial);
        }
      } catch {
        if (ativo) {
          setMascoteOficial(null);
        }
      }
    }

    carregarMascoteOficial();

    return () => {
      ativo = false;
    };
  }, []);


  useEffect(() => {
    let ativo = true;

    async function carregarCreditos() {
      setCarregandoCreditos(true);

      try {
        await obterUsuarioAtualClip();

        const saldo =
          await consultarCreditosClip();

        if (ativo) {
          setSaldoCreditos(saldo);
        }
      } catch (erro) {
        console.error(
          "Erro ao carregar créditos do Clip IA:",
          erro
        );

        if (ativo) {
          setSaldoCreditos(null);
        }
      } finally {
        if (ativo) {
          setCarregandoCreditos(false);
        }
      }
    }

    carregarCreditos();

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    let ativo = true;

    async function carregarUltimosClips() {
      setCarregandoUltimosClips(true);

      try {
        const {
          data: dadosUsuario,
        } =
          await supabase.auth.getUser();

        const usuario =
          dadosUsuario?.user;

        if (!usuario?.id) {
          if (ativo) {
            setUltimosClips([]);
          }
          return;
        }

        const {
          data,
          error,
        } =
          await supabase
            .from("processamentos")
            .select(
              "id, imagem_processada, imagem_original, tipo, status, modelo_banner, created_at"
            )
            .eq("user_id", usuario.id)
            .in(
              "tipo",
              [
                "clip",
                "video",
                "banner",
              ]
            )
            .eq(
              "status",
              "finalizado"
            )
            .not(
              "imagem_processada",
              "is",
              null
            )
            .order(
              "created_at",
              { ascending: false }
            );

        if (error) {
          throw error;
        }

        if (ativo) {
          const clipsEncontrados =
            (Array.isArray(data)
              ? data
              : []
            )
              .filter((item) => {
                const tipo =
                  String(
                    item?.tipo || ""
                  ).toLowerCase();

                return (
                  tipo === "clip" ||
                  tipo === "video"
                );
              })
              .slice(0, 5);

          setUltimosClips(
            clipsEncontrados
          );
        }
      } catch (erro) {
        console.error(
          "Erro ao carregar últimos Clips:",
          erro
        );

        if (ativo) {
          setUltimosClips([]);
        }
      } finally {
        if (ativo) {
          setCarregandoUltimosClips(
            false
          );
        }
      }
    }

    carregarUltimosClips();

    return () => {
      ativo = false;
    };
  }, []);

  function usarClipExistente(item) {
    const urlClip =
      item?.imagem_processada || "";

    if (!urlClip) {
      alert(
        "Este Clip não possui um vídeo válido."
      );
      return;
    }

    const estilo =
      item?.modelo_banner ||
      "marketplace";

    finalizarClipParaAnuncio({
      urlClip,
      estilo,
      formato: "quadrado",
      duracao: 0,
    });

    localStorage.setItem(
      "clipGeracaoMensagem",
      "✅ Clip existente selecionado e vinculado ao anúncio"
    );

    localStorage.setItem(
      "retornarParaMidiasPublicacao",
      "true"
    );

    setScreen?.(
      "mercadoLivreTeste"
    );
  }

  function limparResultado() {
    setVideosGerados([]);
    setVideoSelecionadoId("");
    setClipConfirmado(false);
    setStatusClip("");
    setProcessandoClip(false);

    setEtapasGeracao((anteriores) =>
      anteriores.map((etapa) => ({
        ...etapa,
        concluida: false,
      }))
    );
  }

  function voltarParaPublicacao() {
    if (entradaMarketing) {
      setScreen?.(
        "marketingAppia"
      );
      return;
    }

    localStorage.setItem(
      "retornarParaMidiasPublicacao",
      "true"
    );

    localStorage.setItem(
      "voltarParaMidiasAnuncio",
      "true"
    );

    setScreen?.(
      "mercadoLivreTeste"
    );
  }
function importarFotoComputador(
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
      "Selecione um arquivo de imagem."
    );
    return;
  }

  const urlLocal =
    URL.createObjectURL(
      arquivo
    );

  limparResultado();

  setImagemClip(
    urlLocal
  );

  localStorage.setItem(
    "imagemClipSelecionada",
    urlLocal
  );

  // Permite escolher novamente
  // o mesmo arquivo depois.
  event.target.value = "";
}

  function trocarFoto() {
    limparResultado();

    localStorage.setItem(
      "modoGaleria",
      "clipIA"
    );
    localStorage.setItem(
      "abrirGaleriaClip",
      "true"
    );
    localStorage.setItem(
      "retornarParaClipIA",
      "true"
    );
    localStorage.setItem(
      "retornoCriacaoMidia",
      embutido
        ? "midiasAppia"
        : "clipIA"
    );
    localStorage.removeItem(
      "clipSelecionado"
    );
    localStorage.removeItem(
      "clipSelecionadoEstilo"
    );

    localStorage.setItem(
      "paiiaAbaMidias",
      "clip"
    );
    if (typeof setScreen === "function") {
      setScreen("galeria");
      return;
    }

    alert(
      "Não foi possível abrir a Galeria."
    );
  }

  function salvarEstadoCriacaoClip() {
    const estado = {
      imagemClip,
      modoGeracao,
      estiloSelecionado,
      formatoClip,
      trilhaClip,
      cenas,
      roteiroMidia,
      falaMascote,
      instrucaoMascote,
      empresaMascote,
      observacoesMidia,
      tituloClip,
      subtituloClip,
      mostrarTextos,
      opcaoMascoteUi,
      movimentoDestaqueUi,
      roteiroPaizinhoPronto,
    };

    localStorage.setItem(
      CHAVE_ESTADO_CRIACAO_CLIP,
      JSON.stringify(estado)
    );

    if (imagemClip) {
      localStorage.setItem(
        "imagemClipSelecionada",
        imagemClip
      );
    }
  }

  function abrirPlanosCreditos() {
    // PONTO DE CHECKOUT FUTURO:
    // conectar aqui o pagamento/recarga real de créditos PAIIA.
    // Hoje só abre a tela de Planos e Pagamentos, preservando o estado da criação.
    salvarEstadoCriacaoClip();
    localStorage.setItem(
      CHAVE_RESTAURAR_CRIACAO_CLIP,
      "true"
    );
    localStorage.setItem(
      CHAVE_VOLTAR_CRIACAO_CLIP,
      embutido ? "midiasAppia" : "clipIA"
    );
    localStorage.setItem(
      "abrirSecaoCreditosVideo",
      "true"
    );
    setMostrarModalCreditos(false);
    setScreen?.("planosPagamentos");
  }

  function aplicarSugestaoPaizinho({
    oficial,
    forcarInicial = false,
    temProduto = false,
    pedido = "",
  }) {
    const mascote = oficial || mascoteOficial || {};
    const textos = prepararTextosPaizinho({
      objetivo: temProduto
        ? "produto"
        : objetivoMidia || "empresa",
      outro: objetivoOutro || resumoCampanhaMascote,
      empresa:
        mascote.empresa ||
        empresaMascote ||
        "",
      personagem: mascote.nome || "o mascote",
      observacoes: pedido,
      roteiroAtual: roteiroMidia,
      falaAtual: falaMascote,
      direcaoAtual: instrucaoMascote,
      mascote,
      temProduto,
      forcarInicial,
    });

    setEmpresaMascote(
      mascote.empresa || empresaMascote || ""
    );
    setObjetivoMidia(textos.objetivo);
    setObjetivoOutro(textos.resumo);
    setResumoCampanhaMascote(textos.resumo);
    setFalaMascote(textos.fala);
    setRoteiroMidia(textos.roteiro);
    setInstrucaoMascote(textos.direcao);
    setRoteiroPaizinhoPronto(true);

    if (forcarInicial) {
      setCenas([
        {
          id: `mascote-${Date.now()}`,
          nome: "Criação IA",
          duracao: textos.duracao || 8,
          movimento: "apresentacao",
        },
      ]);
      return;
    }

    if (textos.duracao) {
      setCenas((anteriores) => {
        if (!anteriores.length) {
          return [
            {
              id: `mascote-${Date.now()}`,
              nome: "Criação IA",
              duracao: textos.duracao,
              movimento: "apresentacao",
            },
          ];
        }

        return anteriores.map((cena) => ({
          ...cena,
          duracao: textos.duracao,
        }));
      });
    }
  }

  function aplicarImagemMascote(oficial) {
    if (!oficial?.imagem_base) {
      return;
    }

    const temProduto = Boolean(
      imagemClip &&
        imagemClip !== oficial.imagem_base
    );

    setImagemClip(oficial.imagem_base);
    localStorage.setItem(
      "imagemClipSelecionada",
      oficial.imagem_base
    );
    setEmpresaMascote(
      oficial.empresa || empresaMascote
    );
    setModoGeracao("mascote");
    setOpcaoMascoteUi("usar");
    setFormatoClip("vertical");
    setTrilhaClip("sem-musica");
    setMostrarTextos(false);
    aplicarSugestaoPaizinho({
      oficial,
      forcarInicial: true,
      temProduto,
    });
  }

  function abrirCriarMascote() {
    blocoCriarMascoteRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function usarMascoteSalvo() {
    if (mascoteOficial?.imagem_base) {
      aplicarImagemMascote(mascoteOficial);
      return;
    }

    abrirCriarMascote();
  }

  function aplicarRoteiroPaizinho() {
    aplicarSugestaoPaizinho({
      oficial: mascoteOficial,
      forcarInicial: !String(
        observacoesMidia || ""
      ).trim(),
      temProduto:
        objetivoMidia === "produto" ||
        /produto/i.test(resumoCampanhaMascote),
      pedido: observacoesMidia,
    });
  }

  function atualizarEtapa(
    id,
    concluida = true
  ) {
    setEtapasGeracao((anteriores) =>
      anteriores.map((etapa) =>
        etapa.id === id
          ? {
              ...etapa,
              concluida,
            }
          : etapa
      )
    );
  }

  function atualizarCena(id, alteracoes) {
    setCenas((anteriores) =>
      anteriores.map((cena) =>
        cena.id === id
          ? {
              ...cena,
              ...alteracoes,
            }
          : cena
      )
    );
  }

  function adicionarCena() {
    if (cenas.length >= 6) {
      alert(
        "O Clip IA aceita até 6 cenas na V1.0."
      );
      return;
    }

    setCenas((anteriores) => [
      ...anteriores,
      criarCena(anteriores.length),
    ]);
  }

  function excluirCena(id) {
    if (cenas.length <= 1) {
      alert(
        "O Clip precisa ter pelo menos uma cena."
      );
      return;
    }

    setCenas((anteriores) =>
      anteriores.filter(
        (cena) => cena.id !== id
      )
    );
  }

  function moverCena(indice, direcao) {
    setCenas((anteriores) => {
      const destino = indice + direcao;

      if (
        destino < 0 ||
        destino >= anteriores.length
      ) {
        return anteriores;
      }

      const copia = [...anteriores];
      const [movida] = copia.splice(
        indice,
        1
      );

      copia.splice(destino, 0, movida);

      return copia;
    });
  }

  function montarInstrucoes(estilo) {
    if (modoPaizinho) {
  return [
    "Criar um vídeo publicitário profissional usando somente a imagem enviada da mascote Sonda Lambda como referência visual.",
    "Preservar exatamente o formato da sonda, rosto, olhos, boca, braços, pernas, boné, roupa, cores e identidade visual do personagem.",
    "Não transformar a mascote em pessoa e não substituir a personagem por outro objeto.",
    "A personagem começa cansada, fraca e abatida, como se estivesse com dificuldade para respirar.",
    "Durante a fala sobre consumo excessivo de combustível, demonstrar preocupação e cansaço.",
    "Ao falar que está na hora de trocar a sonda, a personagem começa a recuperar energia.",
    "Na frase Corre pra Casa da Injeção, ficar alegre, sorrir e apontar claramente para o logo ou identificação da Casa da Injeção presente na imagem.",
    "No final permanecer animada, confiante e saudável.",
    "Movimentos naturais e moderados dos braços, olhos e boca, sem deformar a personagem.",
    "Manter enquadramento publicitário limpo e profissional, com a mascote sempre visível.",
    `Fala em português do Brasil: "${falaPaizinho}"`,
    "Sincronizar os movimentos da boca com toda a fala.",
    "A boca deve parar de se mover imediatamente após a última palavra.",
    "Não cortar nenhuma palavra do final da locução.",
    "Não criar textos aleatórios, marcas-d'água ou elementos novos que cubram o personagem.",
    `Formato final ${formatoSelecionado.proporcao}, ${formatoSelecionado.largura}x${formatoSelecionado.altura}.`,
    "Duração final desejada: 15 segundos.",
    "Terminar sorrindo e apontando para Casa da Injeção."
  ].join(" ");
}

    const rotacaoMarketplace =
      estilo.id === "marketplace";

    const movimentos = rotacaoMarketplace
      ? [
          "A peça deve girar suavemente 360 graus ao redor do próprio eixo vertical.",
          "Manter o centro da peça praticamente fixo durante toda a rotação.",
          "A câmera deve permanecer estável, sem orbitar ao redor do produto.",
          "Manter escala, altura e enquadramento constantes, sem zoom ou deslocamentos laterais.",
          "A rotação deve ser contínua, lenta, uniforme e com aparência de vídeo profissional de produto.",
          "Não deformar a peça durante a rotação e não alterar conectores, furos, pinos, encaixes, gravações, cores ou proporções.",
        ].join(" ")
      : cenas
          .map((cena, indice) => {
            const movimento =
              MOVIMENTOS.find(
                (item) =>
                  item.id === cena.movimento
              )?.nome || cena.movimento;

            return `Cena ${indice + 1}: ${movimento}, duração aproximada de ${cena.duracao} segundos.`;
          })
          .join(" ");

    const textoOverlay =
      mostrarTextos &&
      (tituloClip || subtituloClip)
        ? `Adicionar texto comercial discreto. Título: "${tituloClip || "Peça automotiva"}". Subtítulo: "${subtituloClip || ""}". Manter o texto dentro da área segura e sem cobrir a peça.`
        : "Não adicionar textos, logotipos ou marcas-d'água.";

    const trilha =
      trilhaClip === "sem-musica"
        ? "Gerar sem música."
        : `Usar uma trilha ${TRILHAS.find((item) => item.id === trilhaClip)?.nome || trilhaClip}, discreta e sem voz.`;

    return [
      "Utilizar somente a imagem enviada como referência visual.",
      "Manter exatamente formato, cores, encaixes e detalhes reais da peça.",
      "Não inventar componentes, conectores, furos, pinos ou gravações.",
      "Não adicionar mãos, ferramentas, veículos ou objetos ao redor.",
      "Manter fundo limpo e aparência de fotografia profissional.",
      "A peça deve permanecer totalmente visível e não pode ser cortada.",
      rotacaoMarketplace
        ? "No estilo Marketplace, priorizar exclusivamente a rotação da peça no próprio eixo, sem movimentos de câmera."
        : "Os movimentos devem simular câmera e profundidade sem deformar o produto.",
      `Formato final ${formatoSelecionado.proporcao}, ${formatoSelecionado.largura}x${formatoSelecionado.altura}.`,
      `Estilo escolhido: ${estilo.titulo}.`,
      movimentos,
      textoOverlay,
      trilha,
      `Duração aproximada total: ${duracaoTotal} segundos.`,
    ].join(" ");
  }

  async function gerarVersao(
    estilo,
    tentativaNeutra = false
  ) {
    const instrucoes =
      tentativaNeutra
        ? montarInstrucoesNeutrasMarketplace()
        : montarInstrucoes(estilo);

    const imagemPublica =
      await garantirImagemPublicaClip(
        imagemClip
      );

    const {
      data,
      error,
    } = await chamarGerarClipProduto({
      imageUrl: imagemPublica,
      estilo: estilo.id,
      duracao: duracaoTotal,
      formato:
        formatoSelecionado.id,
      instrucoes,
    });

    const videoResultado =
      data?.video ||
      data?.video_url ||
      "";

    if (
      error ||
      !data?.sucesso ||
      !videoResultado
    ) {
      const mensagemOriginal =
        obterMensagemErro(
          data || {
            erro:
              error?.message,
          }
        );

      if (
        !tentativaNeutra &&
        estilo.id ===
          "marketplace" &&
        erroSensivelE005(
          mensagemOriginal
        )
      ) {
        setStatusClip(
          "⚠️ O PAIIA recusou a primeira tentativa. Tentando uma apresentação neutra do produto..."
        );

        return gerarVersao(
          estilo,
          true
        );
      }

      throw new Error(
        mensagemAmigavelClip(
          mensagemOriginal
        )
      );
    }

    if (
      data?.saldo != null
    ) {
      setSaldoCreditos(
        Math.max(
          0,
          Number(data.saldo)
        )
      );
    }

    return {
      ...estilo,
      id: estilo.id,
      video: videoResultado,
      formato:
        formatoSelecionado,
      duracao: duracaoTotal,
      tentativaNeutra,
    };
  }


  async function gerarClipEmSegundoPlano() {
    if (!imagemClip) {
      alert(
        "Escolha uma foto para gerar o vídeo."
      );
      return;
    }

    if (cenas.length === 0) {
      alert(
        "Adicione pelo menos uma cena."
      );
      return;
    }

    if (processandoClip) {
      return;
    }

    const usuario =
      await obterUsuarioAtualClip();

    const estilo =
      modoPaizinho
        ? ESTILOS_CLIP.find(
            (item) =>
              item.id === "clean"
          )
        : modoGeracao === "rapido"
        ? ESTILOS_CLIP.find(
            (item) =>
              item.id ===
              "marketplace"
          )
        : ESTILOS_CLIP.find(
            (item) =>
              item.id ===
              estiloSelecionado
          );

    if (!estilo) {
      throw new Error(
        "Estilo do Clip não encontrado."
      );
    }

    const imagemPublica =
      await garantirImagemPublicaClip(
        imagemClip
      );

    const dadosGeracao = {
      imagemClip:
        imagemPublica,
      estilo,
      formato:
        formatoSelecionado,
      duracao:
        duracaoTotal,
      trilha:
        trilhaClip,
      titulo:
        mostrarTextos
          ? tituloClip
          : "",
      subtitulo:
        mostrarTextos
          ? subtituloClip
          : "",
      cenas:
        cenas.map(
          (cena) => ({
            ...cena,
          })
        ),
      instrucoes:
        montarInstrucoes(
          estilo
        ),
    };

    setProcessandoClip(true);
    setStatusClip(
      "⏳ Clip sendo gerado em segundo plano..."
    );

    localStorage.setItem(
      "clipGeracaoStatus",
      "gerando"
    );

    localStorage.setItem(
      "clipGeracaoMensagem",
      "⏳ Clip sendo gerado..."
    );

    localStorage.removeItem(
      "clipGeracaoErro"
    );

    window.dispatchEvent(
      new CustomEvent(
        "appia:clip-gerando"
      )
    );

    localStorage.setItem(
      "voltarParaMidiasAnuncio",
      "true"
    );

    setScreen?.(
      "novoAnuncio"
    );

    void (async () => {
      try {
        const gerar =
          async (
            tentativaNeutra = false
          ) => {
            const {
              data,
              error,
            } =
              await chamarGerarClipProduto({
                imageUrl:
                  dadosGeracao
                    .imagemClip,
                estilo:
                  dadosGeracao
                    .estilo.id,
                duracao:
                  dadosGeracao
                    .duracao,
                formato:
                  dadosGeracao
                    .formato.id,
                instrucoes:
                  tentativaNeutra
                    ? montarInstrucoesNeutrasMarketplace()
                    : dadosGeracao
                        .instrucoes,
              });

            const videoResultado =
              data?.video ||
              data?.video_url ||
              "";

            if (
              error ||
              !data?.sucesso ||
              !videoResultado
            ) {
              const mensagem =
                obterMensagemErro(
                  data || {
                    erro:
                      error?.message,
                  }
                );

              if (
                !tentativaNeutra &&
                dadosGeracao
                  .estilo.id ===
                  "marketplace" &&
                erroSensivelE005(
                  mensagem
                )
              ) {
                return gerar(
                  true
                );
              }

              throw new Error(
                mensagemAmigavelClip(
                  mensagem
                )
              );
            }

            return videoResultado;
          };

        const urlClip =
          await gerar(false);

        finalizarClipParaAnuncio({
          urlClip,

          estilo:
            dadosGeracao
              .estilo.id,

          formato:
            dadosGeracao
              .formato.id,

          duracao:
            dadosGeracao
              .duracao,
        });
      } catch (erro) {
        const mensagem =
          erro?.message ||
          "Erro ao gerar o Clip IA.";

        console.error(
          "ERRO CLIP SEGUNDO PLANO:",
          erro
        );

        localStorage.setItem(
          "clipGeracaoStatus",
          "erro"
        );

        localStorage.removeItem(
          "clipPronto"
        );

        localStorage.removeItem(
          "clipSelecionado"
        );

        localStorage.setItem(
          "clipGeracaoErro",
          mensagem
        );

        localStorage.setItem(
          "clipGeracaoMensagem",
          `❌ ${mensagem}`
        );

        notificarClipErro(
          mensagem
        );
      }
    })();
  }

  async function gerarMascoteVeo() {
    const empresa = String(
      empresaMascote || ""
    ).trim();

    const fala = String(
      falaMascote || ""
    ).trim();

    if (!imagemClip) {
      throw new Error(
        "Escolha uma foto para gerar o vídeo."
      );
    }

    if (!empresa) {
      throw new Error(
        "Informe o nome da empresa para criar a propaganda."
      );
    }

    if (!fala) {
      throw new Error(
        "Escreva a fala do mascote."
      );
    }

    if (fala.length > 260) {
      throw new Error(
        "A fala está muito longa para o vídeo de 8 segundos. Reduza o texto para até 260 caracteres."
      );
    }

    setStatusClip(
      "🎭 Publicando a imagem..."
    );

    atualizarEtapa("analise");

    const imagemPublica =
      await garantirImagemPublicaClip(
        imagemClip,
        {
          mascote: true,
        }
      );

    setImagemClip(
      imagemPublica
    );

    setStatusClip(
      "🎬 Iniciando a Criação IA..."
    );

    atualizarEtapa("roteiro");

    const {
      data: inicio,
      error: erroInicio,
    } = await supabase.functions.invoke(
      "gerar-criacao-ia",
      {
        body: {
          etapa: "iniciar",
          imagemUrl: imagemPublica,
          fala,
          empresa,
          instrucao:
            [
              mascoteOficial?.prompt_base || "",
              String(
                instrucaoMascote || ""
              ).trim(),
            ]
              .filter(Boolean)
              .join(" "),
          formato:
            formatoSelecionado
              .proporcao === "16:9"
              ? "16:9"
              : "9:16",
        },
      }
    );

    if (
      erroInicio ||
      !inicio?.sucesso ||
      !inicio?.operacao
    ) {
      throw new Error(
        inicio?.erro ||
          erroInicio?.message ||
          "Não foi possível iniciar a Criação IA."
      );
    }

    atualizarEtapa("movimento");

    let urlFinal = "";
    let saldoFinal = null;

    for (
      let tentativa = 0;
      tentativa < 90;
      tentativa++
    ) {
      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            10000
          )
      );

      setStatusClip(
        `🎭 PAIIA gerando sua Criação IA... ${
          tentativa + 1
        }`
      );

      const {
        data: consulta,
        error: erroConsulta,
      } = await supabase.functions.invoke(
        "gerar-criacao-ia",
        {
          body: {
            etapa: "consultar",
            operacao:
              inicio.operacao,
            imagemUrl:
              imagemPublica,
          },
        }
      );

      if (
        erroConsulta ||
        !consulta?.sucesso
      ) {
        throw new Error(
          consulta?.erro ||
            erroConsulta?.message ||
            "Não foi possível concluir a Criação IA."
        );
      }

      if (consulta?.pendente) {
        continue;
      }

      urlFinal =
        consulta?.video ||
        consulta?.video_url ||
        "";

      if (consulta?.saldo != null) {
        saldoFinal = Number(
          consulta.saldo
        );
      }

      break;
    }

    if (!urlFinal) {
      throw new Error(
        "A Criação IA demorou mais que o esperado. Nenhum crédito PAIIA foi usado."
      );
    }

    const videoOriginal = urlFinal;

    setStatusClip(
      "🗣️ Gerando a voz da fala..."
    );

    const audioUrl =
      await gerarVozPaizinhoSeparada(
        fala
      );

    setStatusClip(
      "🗣️ Sincronizando a fala no vídeo..."
    );

    urlFinal =
      await sincronizarPaizinhoSeparado({
        videoUrl: videoOriginal,
        audioUrl,
        onStatus: setStatusClip,
      });

    if (!urlFinal) {
      throw new Error(
        "A sincronização terminou, mas não retornou o vídeo com áudio."
      );
    }

    const usuarioGaleria =
      await obterUsuarioAtualClip();

    await salvarClipGeradoNaGaleria({
      usuarioId: usuarioGaleria.id,
      imagemOriginal: imagemPublica,
      urlClip: urlFinal,
      estilo: "criacao-ia",
      tipo: "mascote",
    });

    atualizarEtapa("render");

    if (saldoFinal != null) {
      setSaldoCreditos(
        Math.max(0, saldoFinal)
      );
    }

    return {
      id:
        `criacao-ia-${Date.now()}`,
      icone:
        "🎭",
      titulo:
        "Criação IA",
      nome:
        empresa,
      video:
        urlFinal,
      formato:
        formatoSelecionado,
      duracao:
        8,
      modoMascote:
        true,
    };
  }

  async function gerarClipsIA() {
    if (processandoClip) {
      return;
    }

    if (!imagemClip) {
      alert(
        "Escolha uma foto para gerar o vídeo."
      );
      return;
    }

    if (
      modoGeracao === "rapido" ||
      modoGeracao === "personalizado"
    ) {
      return;
    }

    if (cenas.length === 0) {
      alert(
        "Adicione pelo menos uma cena."
      );
      return;
    }

    if (
      saldoCreditos !== null &&
      saldoCreditos < 1
    ) {
      setMostrarModalCreditos(true);
      return;
    }

    setProcessandoClip(true);

    try {
      setCarregandoCreditos(true);

      const saldoAtual =
        await consultarCreditosClip();

      setSaldoCreditos(saldoAtual);

      if (saldoAtual < 1) {
        setMostrarModalCreditos(true);
        setProcessandoClip(false);
        return;
      }
    } catch (erro) {
      console.error(
        "ERRO AO CONSULTAR CRÉDITOS:",
        erro
      );

      alert(
        erro?.message ||
          "Não foi possível verificar seus créditos PAIIA."
      );
      setProcessandoClip(false);
      return;
    } finally {
      setCarregandoCreditos(false);
    }

    setVideosGerados([]);
    setVideoSelecionadoId("");
    setClipConfirmado(false);
    setStatusClip("");

    setEtapasGeracao((anteriores) =>
      anteriores.map((etapa) => ({
        ...etapa,
        concluida: false,
      }))
    );

    try {
      if (modoMascote) {
        setStatusClip(
          "🎭 Preparando sua Criação IA..."
        );

        const resultadoMascote =
          await gerarMascoteVeo();

        setVideosGerados([
          resultadoMascote,
        ]);

        setVideoSelecionadoId(
          resultadoMascote.id
        );

        setStatusClip(
          "✅ Criação IA pronta."
        );

        return;
      }

      setStatusClip(
        modoPaizinho
          ? "🤖 Preparando apresentação do Paizinho..."
          : "🧠 IA analisando a peça..."
      );
      atualizarEtapa("analise");

      await new Promise((resolve) =>
        setTimeout(resolve, 250)
      );

      atualizarEtapa("roteiro");

      await new Promise((resolve) =>
        setTimeout(resolve, 250)
      );

      atualizarEtapa("movimento");

      const estilos =
        modoPaizinho
          ? ESTILOS_CLIP.filter(
              (item) =>
                item.id === "clean"
            )
          : modoGeracao === "rapido"
          ? ESTILOS_CLIP.filter(
              (item) =>
                item.id === "marketplace"
            )
          : ESTILOS_CLIP.filter(
              (item) =>
                item.id ===
                estiloSelecionado
            );

      setStatusClip(
        estilos.length === 1
          ? modoPaizinho
            ? "🤖 Gerando apresentação do Paizinho..."
            : "🎬 Gerando sua melhor versão..."
          : `🎬 Gerando ${estilos.length} versões...`
      );

      const resultados =
        await Promise.allSettled(
          estilos.map((estilo) =>
            gerarVersao(estilo)
          )
        );

      const videosValidos =
        resultados
          .filter(
            (resultado) =>
              resultado.status ===
              "fulfilled"
          )
          .map(
            (resultado) =>
              resultado.value
          );

      const erros =
        resultados
          .filter(
            (resultado) =>
              resultado.status ===
              "rejected"
          )
          .map(
            (resultado) =>
              resultado.reason?.message
          )
          .filter(Boolean);

      if (videosValidos.length === 0) {
        throw new Error(
          erros[0] ||
            "Nenhuma versão foi gerada."
        );
      }

      atualizarEtapa("render");

      setVideosGerados(
        videosValidos
      );
      setVideoSelecionadoId(
        videosValidos[0].id
      );

      setStatusClip(
        erros.length === 0
          ? videosValidos.length === 1
            ? "✅ Seu Clip profissional ficou pronto."
            : `✅ ${videosValidos.length} versões geradas. Escolha a preferida.`
          : videosValidos.length === 1
          ? `⚠️ Seu Clip foi gerado. ${erros.join(" ")}`
          : `⚠️ ${videosValidos.length} versões geradas. ${erros.join(" ")}`
      );
    } catch (erro) {
      console.error(
        "ERRO GERAR CLIP:",
        erro
      );

      const mensagemErro =
        erro?.message ||
        "Erro ao gerar o Clip IA.";

      setStatusClip(
        erroSensivelE005(
          mensagemErro
        )
          ? "❌ O PAIIA recusou esta geração pelo filtro automático de conteúdo. Tente outra foto da peça ou outro estilo."
          : `❌ ${mensagemErro}`
      );
    } finally {
      setProcessandoClip(false);
    }
  }

 function usarClipSelecionado() {
  if (!videoSelecionado?.video) {
    alert(
      "Selecione um Clip antes de continuar."
    );
    return;
  }

  const urlClip =
    videoSelecionado.video;

  finalizarClipParaAnuncio({
    urlClip,
    estilo:
      videoSelecionado.id,
    formato:
      formatoSelecionado.id,
    duracao:
      duracaoTotal,
  });

  setClipConfirmado(true);

  setStatusClip(
    "✅ Clip vinculado ao anúncio e pronto para publicação."
  );
}

  async function salvarClipSelecionadoNaGaleria() {
    if (!videoSelecionado?.video) {
      alert(
        "Nenhum Clip disponível para salvar."
      );
      return;
    }

    try {
      const usuario =
        await obterUsuarioAtualClip();

      await salvarClipGeradoNaGaleria({
        usuarioId: usuario.id,
        imagemOriginal: imagemClip,
        urlClip: videoSelecionado.video,
        estilo:
          videoSelecionado.id ||
          estiloSelecionado ||
          "marketplace",
      });

      localStorage.setItem(
        "clipPronto",
        videoSelecionado.video
      );

      localStorage.setItem(
        "clipSelecionado",
        videoSelecionado.video
      );

      finalizarClipParaAnuncio({
        urlClip:
          videoSelecionado.video,
        estilo:
          videoSelecionado.id ||
          estiloSelecionado ||
          "marketplace",
        formato:
          formatoSelecionado.id,
        duracao:
          duracaoTotal,
      });

      setClipConfirmado(true);
      setStatusClip(
        "✅ Clip salvo na Galeria PAIIA."
      );

      alert(
        "✅ Clip salvo na Galeria PAIIA."
      );
    } catch (erro) {
      console.error(
        "ERRO AO SALVAR CLIP NA GALERIA:",
        erro
      );

      alert(
        erro?.message ||
        "Não foi possível salvar o Clip na Galeria."
      );
    }
  }

  async function baixarClip() {
    if (!videoSelecionado?.video) {
      alert("Nenhum Clip disponível para download.");
      return;
    }

    try {
      await baixarClipArquivo(
        videoSelecionado.video
      );
    } catch (erro) {
      console.error(
        "ERRO AO BAIXAR CLIP:",
        erro
      );

      alert(
        "Não foi possível baixar o Clip."
      );
    }
  }

  const estiloCard = {
    ...cardStyle,
    background: "#0f172a",
    borderRadius: "18px",
    border: "1px solid #334155",
  };

  return (
    <div
      style={{
        marginTop: embutido ? "0" : "24px",
        width: "100%",
        maxWidth: "1240px",
        marginLeft: "auto",
        marginRight: "auto",
        marginBottom: embutido ? "16px" : "0",
      }}
    >
      {!embutido && (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "18px",
        }}
      >
        <button
          type="button"
          onClick={voltarParaPublicacao}
          style={{
            padding: "10px 16px",
            borderRadius: "10px",
            border: "1px solid #334155",
            background: "#0f172a",
            color: "#cbd5e1",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          ← Voltar para a Publicação
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: clipConfirmado ? "#86efac" : "#7dd3fc",
            fontSize: "12px",
            fontWeight: "bold",
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: clipConfirmado
                ? "#22c55e"
                : imagemClip
                ? "#38bdf8"
                : "#64748b",
              display: "inline-block",
            }}
          />
          {clipConfirmado
            ? "Clip pronto"
            : imagemClip
            ? "Foto selecionada"
            : "Aguardando foto"}
        </div>
      </div>
      )}

      {!embutido && (
      <header
        style={{
          textAlign: "center",
          marginBottom: "22px",
        }}
      >
        <h2
          style={{
            margin: 0,
            color: "#38bdf8",
            fontSize: "34px",
          }}
        >
  🎬 Clip Premium
</h2>
<div
  style={{
    marginTop: "10px",
    padding: "14px 16px",
    borderRadius: "12px",
    border: "1px solid rgba(56,189,248,0.35)",
    background: "rgba(15,23,42,0.65)",
    color: "#cbd5e1",
    fontSize: "14px",
    lineHeight: "1.6",
  }}
>
  Vídeo profissional do seu produto, pronto para anunciar.
</div>

        <p
          style={{
            color: "#93c5fd",
            marginTop: "8px",
            marginBottom: 0,
          }}
        >
          Transforme a foto da peça em um vídeo profissional para anúncio.
        </p>
      </header>
      )}

      <div
        style={{
          display: "none",
          marginBottom: "18px",
          padding: "14px 18px",
          borderRadius: "14px",
          border:
            saldoCreditos === 0
              ? "1px solid #f59e0b"
              : "1px solid #2563eb",
          background:
            saldoCreditos === 0
              ? "#451a03"
              : "#0f172a",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: "1 1 180px" }}>
          <strong
            style={{
              color:
                saldoCreditos === 0
                  ? "#fde68a"
                  : "#67e8f9",
              fontSize: "15px",
            }}
          >
            💎 Créditos PAIIA:{" "}
            {carregandoCreditos
              ? "..."
              : saldoCreditos ?? "—"}
          </strong>

          <div
            style={{
              marginTop: "4px",
              color: "#94a3b8",
              fontSize: "12px",
            }}
          >
            1 geração = 1 crédito PAIIA.
          </div>
        </div>

        <button
          type="button"
          onClick={abrirPlanosCreditos}
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            border: "none",
            background:
              "linear-gradient(135deg,#2563eb,#22d3ee)",
            color: "#ffffff",
            fontWeight: "bold",
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          Comprar créditos
        </button>
      </div>

      <div
            style={{
              display: "none",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "10px",
              marginBottom: "18px",
            }}
          >
            <button
              type="button"
              onClick={() => escolherAbaMidias("paizinho")}
              style={{
                padding: "12px 14px",
                borderRadius: "12px",
                border:
                  abaMidias === "paizinho"
                    ? "2px solid #22d3ee"
                    : "1px solid #334155",
                background:
                  abaMidias === "paizinho"
                    ? "#083344"
                    : "#0f172a",
                color: "#e0f2fe",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              🎨 Criar com o Paizinho
            </button>
            <button
              type="button"
              onClick={() => escolherAbaMidias("clip")}
              style={{
                padding: "12px 14px",
                borderRadius: "12px",
                border:
                  abaMidias === "clip"
                    ? "2px solid #22d3ee"
                    : "1px solid #334155",
                background:
                  abaMidias === "clip"
                    ? "#083344"
                    : "#0f172a",
                color: "#e0f2fe",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              🎬 Criar Clip
            </button>
            <button
              type="button"
              onClick={() => escolherAbaMidias("produto")}
              style={{
                padding: "12px 14px",
                borderRadius: "12px",
                border:
                  abaMidias === "produto"
                    ? "2px solid #22d3ee"
                    : "1px solid #334155",
                background:
                  abaMidias === "produto"
                    ? "#083344"
                    : "#0f172a",
                color: "#e0f2fe",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              🎬 Clip de Produto
            </button>
          </div>

          <div
            ref={blocoCriarMascoteRef}
            style={{
              display: "none",
            }}
          >
            {false && (
            <PaizinhoConversa
              cardStyle={estiloCard}
              mascoteOficial={mascoteOficial}
              personalizarAberto={personalizarPaizinho}
              onPersonalizarAberto={setPersonalizarPaizinho}
              onMascoteSalvo={(oficial) => {
                setMascoteOficial(oficial || null);
              }}
              onIrParaClip={(payload) => {
                escolherAbaMidias("clip");
                if (payload?.mascote?.imagem_base) {
                  aplicarImagemMascote(payload.mascote);
                  return;
                }
                if (payload?.referencia && !imagemClip) {
                  setImagemClip(payload.referencia);
                }
              }}
            />
            )}
          </div>

          <div
            style={{
              display: "block",
            }}
          >
            <ClipProduto
              cardStyle={estiloCard}
              setScreen={setScreen}
              embutido={embutido}
            />
          </div>

      {!clipConfirmado && (
        <>
          <div
            style={{
              display: "none",
            }}
          >
          <h3
            style={{
              color: "#67e8f9",
              margin: "0 0 14px",
              fontSize: "18px",
            }}
          >
            🎬 CRIAR CLIP
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(280px, 400px) minmax(420px, 1fr)",
              gap: "22px",
              alignItems: "start",
            }}
          >
            <section
              style={{
                ...estiloCard,
                padding: "18px",
                position: "sticky",
                top: "12px",
              }}
            >
              <h3
                style={{
                  color: imagemClip ? "#22c55e" : "#67e8f9",
                  marginTop: 0,
                  textAlign: "center",
                }}
              >
                {imagemClip
                  ? "✅ Foto selecionada"
                  : "Foto"}
              </h3>

              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "14px",
                  padding: "12px",
                  minHeight: "330px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent:
                    "center",
                }}
              >
                {imagemClip ? (
                <img
                  src={imagemClip}
                  alt="Peça selecionada"
                  style={{
                    display: "block",
                    width: "100%",
                    maxHeight: "420px",
                    objectFit: "contain",
                    borderRadius: "10px",
                  }}
                />
                ) : (
                  <div
                    style={{
                      color: "#64748b",
                      textAlign: "center",
                      fontSize: "14px",
                    }}
                  >
                    Nenhuma foto selecionada
                  </div>
                )}
              </div>

             <input
  ref={inputFotoClipRef}
  type="file"
  accept="image/*"
  onChange={
    importarFotoComputador
  }
  style={{
    display: "none",
  }}
/>

<button
  type="button"
  onClick={() =>
    inputFotoClipRef
      .current
      ?.click()
  }
  disabled={
    processandoClip
  }
  style={{
    width: "100%",
    marginTop: "13px",
    padding: "12px",
    borderRadius: "10px",
    border:
      "1px solid #22c55e",
    background:
      "#052e16",
    color: "#bbf7d0",
    fontWeight: "bold",
    cursor: "pointer",
  }}
>
  💻 Importar Foto
</button>

<button
  type="button"
  onClick={trocarFoto}
  disabled={
    processandoClip
  }
  style={{
    width: "100%",
    marginTop: "10px",
    padding: "12px",
    borderRadius: "10px",
    border:
      "1px solid #38bdf8",
    background:
      "#082f49",
    color: "#bae6fd",
    fontWeight: "bold",
    cursor: "pointer",
  }}
>
  🖼️ Escolher da Galeria
</button>

              {imagemClip ? (
              <div
                style={{
                  marginTop: "14px",
                  padding: "12px",
                  borderRadius: "11px",
                  background: "#020617",
                  color: "#94a3b8",
                  fontSize: "11px",
                  lineHeight: 1.5,
                }}
              >
                <strong
                  style={{
                    color: "#67e8f9",
                  }}
                >
                  Projeto
                </strong>
                <br />
                {formatoSelecionado.nome} •{" "}
                {formatoSelecionado.proporcao}
                <br />
                {cenas.length} cena(s) •{" "}
                {duracaoTotal}s
              </div>
              ) : null}
            </section>

            <section
              style={{
                ...estiloCard,
                padding: "22px",
              }}
            >
              <h3
                style={{
                  color: "#67e8f9",
                  marginTop: 0,
                  fontSize: embutido ? "15px" : undefined,
                  fontWeight: embutido ? "bold" : undefined,
                }}
              >
                Tipo de clip
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setModoGeracao(
                      "mascote"
                    );
                    setFormatoClip(
                      "vertical"
                    );
                    setTrilhaClip(
                      "sem-musica"
                    );
                    setMostrarTextos(
                      false
                    );
                    setCenas([
                      {
                        id:
                          `mascote-${Date.now()}`,
                        nome:
                          "Criação IA",
                        duracao: 8,
                        movimento:
                          "apresentacao",
                      },
                    ]);
                    if (mascoteOficial?.imagem_base) {
                      aplicarImagemMascote(
                        mascoteOficial
                      );
                    }
                  }}
                  style={botaoSelecao(
                    modoMascote
                  )}
                >
                  🤖 Clip com Mascote
                  <small
                    style={{
                      ...smallStyle,
                      fontSize: "11px",
                      lineHeight: 1.4,
                      whiteSpace: "normal",
                    }}
                  >
                    Propaganda em vídeo com personagem/mascote, roteiro e fala.
                  </small>
                </button>
              </div>

              {modoMascote && (
              <>
                <div
                  style={{
                    marginTop: "18px",
                    marginBottom: "4px",
                  }}
                >
                  <div
                    style={{
                      color: "#67e8f9",
                      fontSize: "13px",
                      fontWeight: "bold",
                      marginBottom: "8px",
                    }}
                  >
                    🤖 Clip com Mascote
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
                      onClick={usarMascoteSalvo}
                      style={botaoSelecao(
                        opcaoMascoteUi === "usar"
                      )}
                    >
                      ⭐ Usar meu mascote
                    </button>
                    <button
                      type="button"
                      onClick={abrirCriarMascote}
                      style={botaoSelecao(false)}
                    >
                      🎨 Criar novo mascote
                    </button>
                  </div>
                  {mascoteOficial?.imagem_base ? (
                    <button
                      type="button"
                      onClick={usarMascoteSalvo}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        width: "100%",
                        marginTop: "10px",
                        padding: "8px",
                        borderRadius: "10px",
                        background: "#020617",
                        border:
                          opcaoMascoteUi === "usar"
                            ? "2px solid #22d3ee"
                            : "1px solid #334155",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <img
                        src={mascoteOficial.imagem_base}
                        alt={
                          mascoteOficial.nome ||
                          "Mascote oficial"
                        }
                        style={{
                          width: "48px",
                          height: "48px",
                          objectFit: "contain",
                          borderRadius: "8px",
                          background: "#ffffff",
                        }}
                      />
                      <div>
                        <strong
                          style={{
                            color: "#e0f2fe",
                            fontSize: "13px",
                          }}
                        >
                          {mascoteOficial.nome ||
                            "Mascote oficial"}
                        </strong>
                        <div
                          style={{
                            color: "#94a3b8",
                            fontSize: "11px",
                          }}
                        >
                          {mascoteOficial.empresa ||
                            "Pronto para o Clip"}
                        </div>
                      </div>
                    </button>
                  ) : (
                    <p
                      style={{
                        color: "#94a3b8",
                        fontSize: "12px",
                        margin: "8px 0 0",
                      }}
                    >
                      Você ainda não tem um mascote oficial. Crie um com o Paizinho.
                    </p>
                  )}
                </div>

              <div
                  style={{
                    marginTop: "16px",
                    padding: "16px",
                    borderRadius: "14px",
                    border: "1px solid #334155",
                    background: "#020617",
                  }}
                >

                  <label
                    style={{
                      color: "#cbd5e1",
                      display: "block",
                      fontSize: "13px",
                      marginBottom: "6px",
                    }}
                  >
                    Nome da empresa
                  </label>

                  <input
                    value={empresaMascote}
                    onChange={(event) =>
                      setEmpresaMascote(
                        event.target.value
                      )
                    }
                    placeholder="Ex.: Tsunani Auto Parts"
                    style={{
                      width: "100%",
                      boxSizing:
                        "border-box",
                      padding:
                        "11px 12px",
                      borderRadius:
                        "10px",
                      border:
                        "1px solid #334155",
                      background:
                        "#020617",
                      color: "#e2e8f0",
                      marginBottom:
                        "12px",
                    }}
                  />

                  {resumoCampanhaMascote ? (
                    <p
                      style={{
                        margin: "0 0 12px",
                        color: "#7dd3fc",
                        fontSize: "13px",
                        lineHeight: 1.45,
                      }}
                    >
                      {resumoCampanhaMascote}
                    </p>
                  ) : null}

                  <label
                    style={{
                      color: "#cbd5e1",
                      display: "block",
                      fontSize: "13px",
                      marginBottom: "6px",
                    }}
                  >
                    🤖 O que você quer mudar? (opcional)
                  </label>

                  <p
                    style={{
                      margin: "0 0 8px",
                      color: "#94a3b8",
                      fontSize: "12px",
                      lineHeight: 1.45,
                    }}
                  >
                    O Paizinho já preparou uma sugestão. Se quiser, peça qualquer alteração.
                  </p>

                  <textarea
                    value={
                      observacoesMidia
                    }
                    onChange={(event) =>
                      setObservacoesMidia(
                        event.target
                          .value
                      )
                    }
                    rows={3}
                    placeholder="Deixe mais descontraído. Faça em 10 segundos. Fale mais sobre qualidade. Mude somente a fala."
                    style={{
                      width: "100%",
                      boxSizing:
                        "border-box",
                      padding:
                        "11px 12px",
                      borderRadius:
                        "10px",
                      border:
                        "1px solid #334155",
                      background:
                        "#020617",
                      color: "#e2e8f0",
                      resize: "vertical",
                    }}
                  />

                  <button
                    type="button"
                    onClick={
                      aplicarRoteiroPaizinho
                    }
                    style={{
                      width: "100%",
                      marginTop: "12px",
                      padding: "12px",
                      borderRadius:
                        "10px",
                      border: "none",
                      background:
                        "linear-gradient(135deg,#0284c7,#22d3ee)",
                      color: "#ffffff",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    ✨ Pedir alteração ao Paizinho
                  </button>

                  <label
                    style={{
                      color: "#cbd5e1",
                      display: "block",
                      fontSize: "13px",
                      marginTop: "14px",
                      marginBottom: "6px",
                    }}
                  >
                    Roteiro
                  </label>

                  <textarea
                    value={roteiroMidia}
                    onChange={(event) =>
                      setRoteiroMidia(
                        event.target
                          .value
                      )
                    }
                    rows={3}
                    placeholder="O Paizinho monta o roteiro aqui. Você pode editar."
                    style={{
                      width: "100%",
                      boxSizing:
                        "border-box",
                      padding:
                        "11px 12px",
                      borderRadius:
                        "10px",
                      border:
                        "1px solid #334155",
                      background:
                        "#020617",
                      color: "#e2e8f0",
                      resize: "vertical",
                    }}
                  />

                  <label
                    style={{
                      color: "#cbd5e1",
                      display: "block",
                      fontSize: "13px",
                      marginTop: "12px",
                      marginBottom: "6px",
                    }}
                  >
                    Fala
                  </label>

                  <textarea
                    value={falaMascote}
                    onChange={(event) =>
                      setFalaMascote(
                        event.target
                          .value
                      )
                    }
                    maxLength={260}
                    rows={4}
                    placeholder="A fala aparece aqui para você revisar."
                    style={{
                      width: "100%",
                      boxSizing:
                        "border-box",
                      padding:
                        "11px 12px",
                      borderRadius:
                        "10px",
                      border:
                        "1px solid #334155",
                      background:
                        "#020617",
                      color: "#e2e8f0",
                      resize: "vertical",
                    }}
                  />

                  <div
                    style={{
                      textAlign: "right",
                      color:
                        falaMascote.length >
                        230
                          ? "#fbbf24"
                          : "#64748b",
                      fontSize: "11px",
                      marginTop: "4px",
                    }}
                  >
                    {falaMascote.length}
                    /260 caracteres
                  </div>

                  <label
                    style={{
                      color: "#cbd5e1",
                      display: "block",
                      fontSize: "13px",
                      marginTop: "12px",
                      marginBottom: "6px",
                    }}
                  >
                    Direção da cena
                  </label>

                  <textarea
                    value={
                      instrucaoMascote
                    }
                    onChange={(event) =>
                      setInstrucaoMascote(
                        event.target
                          .value
                      )
                    }
                    rows={3}
                    placeholder="A direção da cena aparece aqui para você revisar."
                    style={{
                      width: "100%",
                      boxSizing:
                        "border-box",
                      padding:
                        "11px 12px",
                      borderRadius:
                        "10px",
                      border:
                        "1px solid #334155",
                      background:
                        "#020617",
                      color: "#e2e8f0",
                      resize: "vertical",
                    }}
                  />
                </div>
              </>
              )}

              {modoGeracao ===
                "personalizado" && (
                <div
                  style={{
                    marginTop: "14px",
                  }}
                >
                  <h4 style={tituloSecao}>
                    Movimentos
                  </h4>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(2, 1fr)",
                      gap: "8px",
                    }}
                  >
                    {MOVIMENTOS_DESTAQUE.map(
                      (item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setMovimentoDestaqueUi(
                              item.id
                            );
                            setCenas(
                              (anteriores) =>
                                anteriores.map(
                                  (cena) => ({
                                    ...cena,
                                    movimento:
                                      item.movimentoId,
                                  })
                                )
                            );
                          }}
                          style={botaoSelecao(
                            movimentoDestaqueUi ===
                              item.id
                          )}
                        >
                          {item.nome}
                        </button>
                      )
                    )}
                  </div>
                  {movimentoDestaqueUi ===
                    "giro-360" && (
                    <p
                      style={{
                        margin: "8px 0 0",
                        color: "#94a3b8",
                        fontSize: "11px",
                        lineHeight: 1.45,
                      }}
                    >
                      Com uma única foto, o giro é uma simulação visual de apresentação. Não é um 360° técnico fiel.
                    </p>
                  )}
                </div>
              )}

              {modoClipProduto && (
                <>
              <h4 style={tituloSecao}>
                📐 Formato
              </h4>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(2, 1fr)",
                  gap: "8px",
                }}
              >
                {FORMATOS_CLIP.map(
                  (formato) => (
                    <button
                      key={formato.id}
                      type="button"
                      onClick={() =>
                        setFormatoClip(
                          formato.id
                        )
                      }
                      style={botaoSelecao(
                        formatoClip ===
                          formato.id
                      )}
                    >
                      {formato.nome}
                      <small
                        style={smallStyle}
                      >
                        {formato.proporcao} •{" "}
                        {formato.largura}×
                        {formato.altura}
                      </small>
                    </button>
                  )
                )}
              </div>

              <h4 style={tituloSecao}>
                🎵 Trilha
              </h4>

              <select
                value={trilhaClip}
                onChange={(evento) =>
                  setTrilhaClip(
                    evento.target.value
                  )
                }
                style={campoStyle}
              >
                {TRILHAS.map(
                  (trilha) => (
                    <option
                      key={trilha.id}
                      value={trilha.id}
                    >
                      {trilha.nome}
                    </option>
                  )
                )}
              </select>

              <label
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                  color: "#cbd5e1",
                  marginTop: "14px",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              >
                <input
                  type="checkbox"
                  checked={mostrarTextos}
                  onChange={(evento) =>
                    setMostrarTextos(
                      evento.target
                        .checked
                    )
                  }
                />
                Adicionar textos comerciais
              </label>

              {mostrarTextos && (
                <div
                  style={{
                    display: "grid",
                    gap: "8px",
                    marginTop: "10px",
                  }}
                >
                  <input
                    value={tituloClip}
                    onChange={(evento) =>
                      setTituloClip(
                        evento.target
                          .value
                      )
                    }
                    placeholder="Título do vídeo"
                    style={campoStyle}
                  />

                  <input
                    value={subtituloClip}
                    onChange={(evento) =>
                      setSubtituloClip(
                        evento.target
                          .value
                      )
                    }
                    placeholder="Subtítulo"
                    style={campoStyle}
                  />
                </div>
              )}

              <h4 style={tituloSecao}>
                🎞️ Timeline
              </h4>

              <div
                style={{
                  display: "grid",
                  gap: "9px",
                }}
              >
                {cenas.map(
                  (cena, indice) => (
                    <div
                      key={cena.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "42px 1fr 86px 76px",
                        gap: "8px",
                        alignItems:
                          "center",
                        padding: "9px",
                        borderRadius:
                          "10px",
                        background:
                          "#020617",
                        border:
                          "1px solid #334155",
                      }}
                    >
                      <div
                        style={{
                          width: "42px",
                          height: "42px",
                          borderRadius:
                            "8px",
                          overflow:
                            "hidden",
                          background:
                            "#ffffff",
                        }}
                      >
                        {imagemClip ? (
                        <img
                          src={imagemClip}
                          alt=""
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit:
                              "contain",
                          }}
                        />
                        ) : null}
                      </div>

                      <select
                        value={
                          cena.movimento
                        }
                        onChange={(
                          evento
                        ) =>
                          atualizarCena(
                            cena.id,
                            {
                              movimento:
                                evento
                                  .target
                                  .value,
                            }
                          )
                        }
                        style={campoStyle}
                      >
                        {MOVIMENTOS.map(
                          (movimento) => (
                            <option
                              key={
                                movimento.id
                              }
                              value={
                                movimento.id
                              }
                            >
                              {
                                movimento.nome
                              }
                            </option>
                          )
                        )}
                      </select>

                      <label
                        style={{
                          color:
                            "#cbd5e1",
                          fontSize:
                            "10px",
                          fontWeight:
                            "bold",
                        }}
                      >
                        {cena.duracao}s
                        <input
                          type="range"
                          min="1"
                          max="8"
                          value={
                            cena.duracao
                          }
                          onChange={(
                            evento
                          ) =>
                            atualizarCena(
                              cena.id,
                              {
                                duracao:
                                  Number(
                                    evento
                                      .target
                                      .value
                                  ),
                              }
                            )
                          }
                          style={{
                            width:
                              "100%",
                          }}
                        />
                      </label>

                      <div
                        style={{
                          display:
                            "flex",
                          gap: "4px",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            moverCena(
                              indice,
                              -1
                            )
                          }
                          style={
                            miniBotao
                          }
                        >
                          ↑
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            moverCena(
                              indice,
                              1
                            )
                          }
                          style={
                            miniBotao
                          }
                        >
                          ↓
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            excluirCena(
                              cena.id
                            )
                          }
                          style={{
                            ...miniBotao,
                            color:
                              "#fecaca",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>

              <button
                type="button"
                onClick={adicionarCena}
                style={{
                  width: "100%",
                  marginTop: "9px",
                  padding: "10px",
                  borderRadius: "9px",
                  border:
                    "1px dashed #38bdf8",
                  background: "#082f49",
                  color: "#bae6fd",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                ➕ Adicionar Cena
              </button>
                </>
              )}

              {!processandoClip && (
                <button
                  type="button"
                  onClick={gerarClipsIA}
                  disabled={
                    carregandoCreditos
                  }
                  style={{
                    width: "100%",
                    marginTop: "18px",
                    padding:
                      "16px 20px",
                    borderRadius:
                      "13px",
                    border: "none",
                    background:
                      "linear-gradient(135deg,#2563eb,#22d3ee)",
                    color: "#ffffff",
                    fontWeight:
                      "bold",
                    cursor:
                      carregandoCreditos
                        ? "wait"
                        : "pointer",
                    fontSize: "16px",
                    boxShadow:
                      "0 14px 34px rgba(34,211,238,.2)",
                    opacity:
                      carregandoCreditos
                        ? 0.7
                        : 1,
                  }}
                >
                  {carregandoCreditos
                    ? "💎 Verificando créditos..."
                    : modoMascote
                    ? "🎭 Gerar Criação IA — 1 crédito PAIIA"
                    : modoPaizinho
                    ? "🤖 Gerar Clip de Produto — 1 crédito PAIIA"
                    : "🎬 Gerar Clip de Produto — 1 crédito PAIIA"}
                </button>
              )}

              {processandoClip && (
                <div
                  style={{
                    marginTop: "18px",
                    padding: "16px",
                    borderRadius:
                      "12px",
                    background:
                      "#020617",
                    border:
                      "1px solid #38bdf8",
                  }}
                >
                  <h4
                    style={{
                      color:
                        "#67e8f9",
                      marginTop: 0,
                    }}
                  >
                    🎬 Gerando seu Clip...
                  </h4>

                  <div
                    style={{
                      display: "grid",
                      gap: "8px",
                    }}
                  >
                    {etapasGeracao.map(
                      (etapa) => (
                        <div
                          key={
                            etapa.id
                          }
                          style={{
                            padding:
                              "9px",
                            borderRadius:
                              "8px",
                            background:
                              etapa.concluida
                                ? "#052e16"
                                : "#0f172a",
                            color:
                              etapa.concluida
                                ? "#bbf7d0"
                                : "#94a3b8",
                          }}
                        >
                          {etapa.concluida
                            ? "✓"
                            : "○"}{" "}
                          {etapa.texto}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
          </div>

          {statusClip && abaMidias === "clip" && (
            <div
              style={{
                ...estiloCard,
                padding: "16px",
                marginTop: "20px",
                color: "#bfdbfe",
                textAlign: "center",
                fontWeight: "bold",
              }}
            >
              {statusClip}
            </div>
          )}

          {abaMidias === "clip" &&
            videosGerados.length >
            0 && (
            <section
              style={{
                ...estiloCard,
                padding: "24px",
                marginTop: "22px",
              }}
            >
              <h3
                style={{
                  color: "#22c55e",
                  textAlign: "center",
                  marginTop: 0,
                }}
              >
                {videosGerados.length === 1
                  ? "✅ Seu Clip está pronto"
                  : "✅ Escolha seu Clip"}
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: "16px",
                }}
              >
                {videosGerados.map(
                  (item) => {
                    const selecionado =
                      videoSelecionadoId ===
                      item.id;

                    return (
                      <article
                        key={item.id}
                        onClick={() =>
                          setVideoSelecionadoId(
                            item.id
                          )
                        }
                        style={{
                          padding:
                            "13px",
                          borderRadius:
                            "15px",
                          border:
                            selecionado
                              ? "3px solid #22d3ee"
                              : "1px solid #334155",
                          background:
                            selecionado
                              ? "#164e63"
                              : "#020617",
                          cursor:
                            "pointer",
                        }}
                      >
                        <video
                          src={
                            item.video
                          }
                          controls
                          loop
                          playsInline
                          preload="metadata"
                          onClick={(
                            evento
                          ) =>
                            evento.stopPropagation()
                          }
                          style={{
                            display: "block",
                            width: "100%",
                            maxWidth: "560px",
                            maxHeight: "340px",
                            aspectRatio:
                              formatoSelecionado.proporcao.replace(
                                ":",
                                " / "
                              ),
                            objectFit:
                              "contain",
                            borderRadius:
                              "11px",
                            background:
                              "#000000",
                            margin:
                              "0 auto",
                          }}
                        />

                        <strong
                          style={{
                            display:
                              "block",
                            color:
                              "#ffffff",
                            marginTop:
                              "10px",
                          }}
                        >
                          {item.icone}{" "}
                          {item.titulo}
                        </strong>

                        <small
                          style={{
                            display:
                              "block",
                            color:
                              "#94a3b8",
                            marginTop:
                              "5px",
                          }}
                        >
                          {item.duracao ||
                            duracaoTotal}s •{" "}
                          {item.modoPaizinho
                            ? "apresentação"
                            : item.formato
                                ?.proporcao ||
                              formatoSelecionado.proporcao}
                        </small>
                      </article>
                    );
                  }
                )}
              </div>

              {videoSelecionado && (
                <div
                  style={{
                    marginTop: "18px",
                    display: "flex",
                    justifyContent: "center",
                    gap: "10px",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    onClick={baixarClip}
                    style={botaoFinal}
                  >
                    ⬇️ Exportar MP4
                  </button>

                  <button
                    type="button"
                    onClick={
                      salvarClipSelecionadoNaGaleria
                    }
                    style={{
                      ...botaoFinal,
                      background:
                        "linear-gradient(135deg,#15803d,#22c55e)",
                    }}
                  >
                    💾 Salvar na Galeria
                  </button>

                  <button
                    type="button"
                    onClick={trocarFoto}
                    style={botaoSecundario}
                  >
                    🔄 Criar outro
                  </button>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {clipConfirmado &&
        abaMidias === "clip" &&
        videoSelecionado && (
          <section
            style={{
              ...estiloCard,
              maxWidth: "760px",
              margin: "24px auto 0",
              padding: "22px",
              textAlign: "center",
              border:
                "1px solid #22c55e",
              background:
                "linear-gradient(135deg,#052e16,#14532d)",
            }}
          >
            <div
              style={{
                fontSize: "52px",
              }}
            >
              ✅
            </div>

            <h3
              style={{
                color: "#ffffff",
                fontSize: "28px",
                marginBottom: "8px",
              }}
            >
              ✅ Clip salvo com sucesso
            </h3>

            <p
              style={{
                color: "#bbf7d0",
                marginTop: 0,
                marginBottom: "14px",
                fontSize: "15px",
                lineHeight: 1.5,
              }}
            >
              Seu Clip profissional foi salvo na Galeria PAIIA.
              <br />
              Você pode exportar o MP4 ou criar outro Clip.
            </p>

            <video
              src={
                videoSelecionado.video
              }
              controls
              loop
              playsInline
              style={{
                display: "block",
                width: "100%",
                maxWidth: "560px",
                maxHeight: "340px",
                aspectRatio:
                  formatoSelecionado.proporcao.replace(
                    ":",
                    " / "
                  ),
                objectFit: "contain",
                margin: "14px auto 18px",
                borderRadius: "14px",
                background: "#000000",
              }}
            />

            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent:
                  "center",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={baixarClip}
                style={botaoFinal}
              >
                ⬇️ Exportar MP4
              </button>

              <button
                type="button"
                onClick={() => {
                  setClipConfirmado(
                    false
                  );
                  gerarClipsIA();
                }}
                style={botaoSecundario}
              >
                🔄 Gerar novamente
              </button>

              <button
                type="button"
                onClick={trocarFoto}
                style={botaoSecundario}
              >
                🖼️ Trocar Foto
              </button>
            </div>
          </section>
        )}
      {mostrarModalCreditos && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(2,6,23,.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "420px",
              padding: "24px",
              borderRadius: "16px",
              border: "1px solid #38bdf8",
              background: "#0f172a",
              textAlign: "center",
            }}
          >
            <p
              style={{
                margin: "0 0 18px",
                color: "#f8fafc",
                fontSize: "16px",
                lineHeight: 1.5,
                fontWeight: "bold",
              }}
            >
              Seus créditos acabaram. Adicione créditos para continuar.
            </p>
            <button
              type="button"
              onClick={abrirPlanosCreditos}
              style={{
                width: "100%",
                padding: "13px 16px",
                borderRadius: "11px",
                border: "none",
                background:
                  "linear-gradient(135deg,#2563eb,#22d3ee)",
                color: "#ffffff",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Comprar créditos
            </button>
            <button
              type="button"
              onClick={() =>
                setMostrarModalCreditos(false)
              }
              style={{
                width: "100%",
                marginTop: "10px",
                padding: "11px 16px",
                borderRadius: "11px",
                border: "1px solid #334155",
                background: "#020617",
                color: "#cbd5e1",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function botaoSelecao(ativo) {
  return {
    padding: "11px",
    borderRadius: "10px",
    border: ativo
      ? "1px solid #22d3ee"
      : "1px solid #334155",
    background: ativo
      ? "#164e63"
      : "#020617",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: "bold",
    textAlign: "center",
  };
}

const smallStyle = {
  display: "block",
  marginTop: "4px",
  color: "#94a3b8",
  fontSize: "9px",
};

const tituloSecao = {
  color: "#67e8f9",
  marginTop: "18px",
  marginBottom: "9px",
};

const campoStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px",
  borderRadius: "9px",
  border: "1px solid #334155",
  background: "#020617",
  color: "#ffffff",
};

const miniBotao = {
  width: "24px",
  height: "28px",
  padding: 0,
  borderRadius: "6px",
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#cbd5e1",
  cursor: "pointer",
};

const botaoFinal = {
  minWidth: "190px",
  padding: "13px 20px",
  borderRadius: "11px",
  border: "none",
  background:
    "linear-gradient(135deg,#15803d,#22c55e)",
  color: "#ffffff",
  fontWeight: "bold",
  cursor: "pointer",
};

const botaoSecundario = {
  minWidth: "190px",
  padding: "13px 20px",
  borderRadius: "11px",
  border: "1px solid #475569",
  background: "#020617",
  color: "#e2e8f0",
  fontWeight: "bold",
  cursor: "pointer",
};