import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  marcarClipPronto,
} from "../services/projetoAtualService";

import { API_PROCESSAR_CLIP } from "./constants/apiConstants";
import { supabase, supabaseKey } from "../supabase";
import { baixarClip as baixarClipArquivo } from "./utils/downloadUtils";
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
    nome: "Zoom de aproximação",
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
    nome: "Órbita suave",
  },
  {
    id: "detalhe",
    nome: "Foco nos detalhes",
  },
];

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
      "O provedor de vídeo recusou esta geração pelo filtro automático de conteúdo (E005). " +
      "Isso pode acontecer mesmo com uma foto normal de autopeça. " +
      "O APPIA não enviou nada ao Mercado Livre."
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
  imagem
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

  const caminho =
    `${usuario.id}/marketing/paizinho-appia.${extensao}`;

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
          upsert: true,
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


async function consultarCreditosClip() {
  const {
    data,
    error,
  } = await supabase.rpc(
    "consultar_creditos_appia"
  );

  if (error) {
    throw new Error(
      "Não foi possível consultar os créditos: " +
        error.message
    );
  }

  return Math.max(
    0,
    Number(data || 0)
  );
}

async function debitarCreditoClip() {
  const {
    data,
    error,
  } = await supabase.rpc(
    "debitar_credito_clip"
  );

  if (error) {
    const mensagem =
      String(
        error?.message || ""
      ).toUpperCase();

    if (
      mensagem.includes(
        "CREDITOS_INSUFICIENTES"
      )
    ) {
      throw new Error(
        "Você não possui créditos suficientes para gerar um novo Clip."
      );
    }

    throw new Error(
      "O Clip foi gerado, mas não foi possível registrar o uso do crédito: " +
        error.message
    );
  }

  return Math.max(
    0,
    Number(data || 0)
  );
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

export default function ClipIA({
  cardStyle,
  setScreen,
}) {
  const entradaClipProcessadaRef =
    useRef(false);

const inputFotoClipRef =
  useRef(null);

  const [imagemClip, setImagemClip] = useState(() => {
    return (
      localStorage.getItem(
        "imagemClipSelecionada"
      ) || ""
    );
  });

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
    useState("rapido");

  const [entradaMarketing, setEntradaMarketing] =
    useState(false);

  const modoPaizinho =
    modoGeracao === "paizinho";

  const modoMascote =
    modoGeracao === "mascote";

  const [empresaMascote, setEmpresaMascote] =
    useState("");

  const [falaMascote, setFalaMascote] =
    useState("");

  const [instrucaoMascote, setInstrucaoMascote] =
    useState(
      "O mascote olha para a câmera, fala com simpatia e faz gestos naturais de apresentação."
    );

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

    const imagemNova =
      localStorage.getItem(
        "imagemClipSelecionada"
      ) || "";

    const abrirAutomatico =
      localStorage.getItem(
        "abrirClipAutomatico"
      ) === "true";

    if (abrirAutomatico && imagemNova) {
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
    localStorage.removeItem(
      "clipSelecionado"
    );
    localStorage.removeItem(
      "clipSelecionadoEstilo"
    );

    if (typeof setScreen === "function") {
      setScreen("galeria");
      return;
    }

    alert(
      "Não foi possível abrir a Galeria."
    );
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

    const respostaApi = await fetch(
      API_PROCESSAR_CLIP,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          apikey: supabaseKey,
          Authorization:
            `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          imageUrl:
            imagemPublica,
          tipo:
            modoPaizinho
              ? "clip_paizinho_appia"
              : "clip_profissional",
          modoPaizinho,
          fala:
            modoPaizinho
              ? falaPaizinho
              : "",
          estilo: estilo.id,
          duracao: duracaoTotal,
          formato:
            formatoSelecionado.id,
          largura:
            formatoSelecionado.largura,
          altura:
            formatoSelecionado.altura,
          proporcao:
            formatoSelecionado.proporcao,
          trilha: trilhaClip,
          titulo:
            mostrarTextos &&
            !tentativaNeutra
              ? tituloClip
              : "",
          subtitulo:
            mostrarTextos &&
            !tentativaNeutra
              ? subtituloClip
              : "",
          cenas:
            modoPaizinho
              ? [
                  {
  nome:
    "Apresentação Sondinha",

  duracao: 15,

  movimento:
    "apresentacao",
},
                ]
              : tentativaNeutra
              ? []
              : cenas,
          instrucoes,
        }),
      }
    );

    let data = {};

    try {
      data =
        await respostaApi.json();
    } catch {
      throw new Error(
        `${estilo.titulo} não retornou uma resposta válida.`
      );
    }

    const videoResultado =
      data.video_processado ||
      data.video_url ||
      data.video ||
      data.url;

    if (
      !respostaApi.ok ||
      !videoResultado
    ) {
      const mensagemOriginal =
        obterMensagemErro(data);

      if (
        !modoPaizinho &&
        !tentativaNeutra &&
        estilo.id ===
          "marketplace" &&
        erroSensivelE005(
          mensagemOriginal
        )
      ) {
        setStatusClip(
          "⚠️ O provedor bloqueou a primeira tentativa (E005). Tentando uma apresentação neutra do produto..."
        );

        return gerarVersao(
          estilo,
          true
        );
      }

      throw new Error(
        `${estilo.titulo}: ${mensagemAmigavelClip(
          mensagemOriginal
        )}`
      );
    }

    let videoFinal =
      videoResultado;

    if (modoPaizinho) {
      setStatusClip(
        "🎙️ Gerando a voz do Paizinho..."
      );

      const audioPaizinho =
        await gerarVozPaizinhoSeparada(
          falaPaizinho
        );

      setStatusClip(
        "🗣️ Sincronizando voz e movimentos do Paizinho..."
      );

      videoFinal =
        await sincronizarPaizinhoSeparado({
          videoUrl:
            videoResultado,
          audioUrl:
            audioPaizinho,
          onStatus:
            setStatusClip,
        });
    }

    return {
      ...estilo,
      id:
        modoPaizinho
          ? "paizinho-appia"
          : estilo.id,
      icone:
        modoPaizinho
          ? "🤖"
          : estilo.icone,
      titulo:
        modoPaizinho
          ? "Paizinho APPIA"
          : estilo.titulo,
      nome:
        modoPaizinho
          ? "Paizinho APPIA"
          : estilo.nome,
      video:
        videoFinal,
      formato:
        formatoSelecionado,
      duracao: duracaoTotal,
      tentativaNeutra,
      modoPaizinho,
    };
  }


  async function gerarClipEmSegundoPlano() {
    if (!imagemClip) {
      alert(
        "Selecione uma imagem para gerar o Clip."
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
            const respostaApi =
              await fetch(
                API_PROCESSAR_CLIP,
                {
                  method:
                    "POST",

                  headers: {
                    "Content-Type":
                      "application/json",
                    apikey:
                      supabaseKey,
                    Authorization:
                      `Bearer ${supabaseKey}`,
                  },

                  body:
                    JSON.stringify({
                      imageUrl:
                        dadosGeracao
                          .imagemClip,

                      tipo:
                        modoPaizinho
                          ? "clip_paizinho_appia"
                          : "clip_profissional",

                      modoPaizinho,

                      fala:
                        modoPaizinho
                          ? falaPaizinho
                          : "",

                      estilo:
                        dadosGeracao
                          .estilo.id,

                      duracao:
                        dadosGeracao
                          .duracao,

                      formato:
                        dadosGeracao
                          .formato.id,

                      largura:
                        dadosGeracao
                          .formato
                          .largura,

                      altura:
                        dadosGeracao
                          .formato
                          .altura,

                      proporcao:
                        dadosGeracao
                          .formato
                          .proporcao,

                      trilha:
                        dadosGeracao
                          .trilha,

                      titulo:
                        tentativaNeutra
                          ? ""
                          : dadosGeracao
                              .titulo,

                      subtitulo:
                        tentativaNeutra
                          ? ""
                          : dadosGeracao
                              .subtitulo,

                      cenas:
                        modoPaizinho
                          ? [
                            {
  nome:
    "Apresentação Sondinha",

  duracao: 15,

  movimento:
    "apresentacao",
},
                            ]
                          : tentativaNeutra
                          ? []
                          : dadosGeracao
                              .cenas,

                      instrucoes:
                        tentativaNeutra
                          ? montarInstrucoesNeutrasMarketplace()
                          : dadosGeracao
                              .instrucoes,
                    }),
                }
              );

            let data = {};

            try {
              data =
                await respostaApi.json();
            } catch {
              throw new Error(
                "O provedor não retornou uma resposta válida para o Clip."
              );
            }

            const videoResultado =
              data
                .video_processado ||
              data.video_url ||
              data.video ||
              data.url;

            if (
              !respostaApi.ok ||
              !videoResultado
            ) {
              const mensagem =
                obterMensagemErro(
                  data
                );

              if (
                !modoPaizinho &&
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

        let urlClip =
          await gerar(false);

        if (modoPaizinho) {
          const audioPaizinho =
            await gerarVozPaizinhoSeparada(
              falaPaizinho
            );

          urlClip =
            await sincronizarPaizinhoSeparado({
              videoUrl:
                urlClip,
              audioUrl:
                audioPaizinho,
              onStatus:
                setStatusClip,
            });
        }

        await salvarClipGeradoNaGaleria({
  usuarioId:
    usuario.id,

  imagemOriginal:
    imagemPublica,

  urlClip:
    urlFinal,

  estilo:
    "mascote-veo",

  tipo:
    "mascote",
});

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
        "Selecione a imagem do seu mascote."
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

    const usuario =
      await obterUsuarioAtualClip();

    setStatusClip(
      "🎭 Publicando a imagem do mascote..."
    );

    atualizarEtapa("analise");

    const imagemPublica =
      await garantirImagemPublicaClip(
        imagemClip
      );

    setStatusClip(
      "🎬 Enviando seu mascote para o Veo 3.1..."
    );

    atualizarEtapa("roteiro");

    const {
      data: inicio,
      error: erroInicio,
    } = await supabase.functions.invoke(
      "iniciar-mascote-veo",
      {
        body: {
          imagemUrl:
            imagemPublica,
          fala,
          empresa,
          instrucao:
            String(
              instrucaoMascote || ""
            ).trim(),
          formato:
            formatoSelecionado
              .proporcao === "16:9"
              ? "16:9"
              : "9:16",
        },
      }
    );

    if (erroInicio) {
      throw new Error(
        "Não foi possível iniciar o Mascote IA: " +
          (
            erroInicio.message ||
            "erro na função iniciar-mascote-veo."
          )
      );
    }

    if (
      !inicio?.sucesso ||
      !inicio?.operation_name
    ) {
      throw new Error(
        inicio?.erro ||
          "O Veo não retornou o identificador da geração."
      );
    }

    atualizarEtapa("movimento");

    const operationName =
      inicio.operation_name;

    let videoUrl = "";
    let videoBase64 = "";
    let mimeType = "video/mp4";

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
        `🎭 Veo criando seu mascote... ${
          tentativa + 1
        }`
      );

      const {
        data: consulta,
        error: erroConsulta,
      } = await supabase.functions.invoke(
        "consultar-mascote-veo",
        {
          body: {
            operation_name:
              operationName,
          },
        }
      );

      if (erroConsulta) {
        throw new Error(
          "Não foi possível consultar a geração do Mascote IA: " +
            (
              erroConsulta.message ||
              "erro ao consultar o Veo."
            )
        );
      }

      if (!consulta?.sucesso) {
        throw new Error(
          consulta?.erro ||
            "O Veo retornou erro durante a geração."
        );
      }

      if (!consulta?.concluido) {
        continue;
      }

      videoUrl =
        consulta?.video_url ||
        "";

      videoBase64 =
        consulta?.video_base64 ||
        "";

      mimeType =
        consulta?.mime_type ||
        "video/mp4";

      break;
    }

    if (
      !videoUrl &&
      !videoBase64
    ) {
      throw new Error(
        "O Veo demorou mais que o esperado ou não retornou o vídeo final."
      );
    }

    let urlFinal =
      videoUrl;

    if (videoBase64) {
      setStatusClip(
        "💾 Salvando o vídeo do mascote no PAIIA..."
      );

      const binario =
        atob(videoBase64);

      const bytes =
        new Uint8Array(
          binario.length
        );

      for (
        let i = 0;
        i < binario.length;
        i++
      ) {
        bytes[i] =
          binario.charCodeAt(i);
      }

      const blob =
        new Blob(
          [bytes],
          {
            type: mimeType,
          }
        );

      const caminhoVideo =
        `${usuario.id}/marketing/mascotes/veo-${Date.now()}.mp4`;

      const {
        error: erroUploadVideo,
      } = await supabase.storage
        .from("imagens")
        .upload(
          caminhoVideo,
          blob,
          {
            contentType:
              "video/mp4",
            upsert: false,
          }
        );

      if (erroUploadVideo) {
        throw new Error(
          "O vídeo foi criado, mas não foi possível salvá-lo no Storage: " +
            erroUploadVideo.message
        );
      }

      const {
        data: dadosPublicosVideo,
      } = supabase.storage
        .from("imagens")
        .getPublicUrl(
          caminhoVideo
        );

      urlFinal =
        dadosPublicosVideo?.publicUrl ||
        "";
    }

    if (!urlFinal) {
      throw new Error(
        "O Mascote IA foi concluído sem uma URL válida de vídeo."
      );
    }

    atualizarEtapa("render");

    await salvarClipGeradoNaGaleria({
      usuarioId:
        usuario.id,
      imagemOriginal:
        imagemPublica,
      urlClip:
        urlFinal,
      estilo:
        "mascote-veo",
    });

    return {
      id:
        `mascote-veo-${Date.now()}`,
      icone:
        "🎭",
      titulo:
        "Mascote IA",
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
    if (!imagemClip) {
      alert(
        "Selecione uma imagem para gerar o Clip."
      );
      return;
    }

    if (cenas.length === 0) {
      alert(
        "Adicione pelo menos uma cena."
      );
      return;
    }

    try {
      setCarregandoCreditos(true);

      const saldoAtual =
        await consultarCreditosClip();

      setSaldoCreditos(saldoAtual);

      if (saldoAtual < 1) {
        alert(
          "💎 Seus créditos de Clip IA terminaram. Compre novos créditos para gerar outro Clip."
        );
        return;
      }
    } catch (erro) {
      console.error(
        "ERRO AO CONSULTAR CRÉDITOS:",
        erro
      );

      alert(
        erro?.message ||
          "Não foi possível verificar seus créditos."
      );
      return;
    } finally {
      setCarregandoCreditos(false);
    }

    setProcessandoClip(true);
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
          "🎭 Preparando seu Mascote IA..."
        );

        const resultadoMascote =
          await gerarMascoteVeo();

        const novoSaldo =
          await debitarCreditoClip();

        setSaldoCreditos(
          novoSaldo
        );

        setVideosGerados([
          resultadoMascote,
        ]);

        setVideoSelecionadoId(
          resultadoMascote.id
        );

        setStatusClip(
          "✅ Mascote IA pronto com voz e sincronização."
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

      const novoSaldo =
        await debitarCreditoClip();

      setSaldoCreditos(
        novoSaldo
      );

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
          ? "❌ O provedor de vídeo recusou esta geração pelo filtro automático (E005). Nenhum dado foi enviado ao Mercado Livre. Tente outra foto da peça ou outro estilo."
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
        "✅ Clip salvo na Galeria APPIA."
      );

      alert(
        "✅ Clip salvo na Galeria APPIA."
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
        marginTop: "24px",
        width: "100%",
        maxWidth: "1240px",
        marginLeft: "auto",
        marginRight: "auto",
      }}
    >
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
          🎬 APPIA Clip Studio
        </h2>

        <p
          style={{
            color: "#93c5fd",
            marginTop: "8px",
            marginBottom: 0,
          }}
        >
          Transforme fotos de autopeças em vídeos profissionais.
        </p>
      </header>

      <div
        style={{
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
        <div>
          <strong
            style={{
              color:
                saldoCreditos === 0
                  ? "#fde68a"
                  : "#67e8f9",
              fontSize: "15px",
            }}
          >
            💎 Créditos disponíveis:{" "}
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
            1 novo Clip gerado com IA = 1 crédito.
            Reutilizar um Clip salvo não consome créditos.
          </div>
        </div>

        {saldoCreditos === 0 && (
          <button
            type="button"
            onClick={() =>
              setScreen?.(
                "planosPagamentos"
              )
            }
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              border: "none",
              background:
                "linear-gradient(135deg,#2563eb,#22d3ee)",
              color: "#ffffff",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            💎 Comprar créditos
          </button>
        )}
      </div>

      {!imagemClip && (
        <section
          style={{
            ...estiloCard,
            padding: "32px 28px",
            textAlign: "center",
            border: "1px solid #334155",
            background:
              "linear-gradient(135deg,#0f172a 0%,#111c33 100%)",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              margin: "0 auto 14px",
              borderRadius: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#082f49",
              border: "1px solid #0ea5e9",
              fontSize: "30px",
            }}
          >
            🎬
          </div>

          <h3
            style={{
              color: "#f8fafc",
              fontSize: "22px",
              margin: "0 0 8px",
            }}
          >
            Crie um novo Clip
          </h3>

          <p
            style={{
              color: "#94a3b8",
              lineHeight: 1.55,
              margin: "0 auto 22px",
              maxWidth: "620px",
            }}
          >
            Escolha uma foto para criar um novo Clip ou reutilize um
            vídeo já salvo nas Mídias APPIA.
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={trocarFoto}
              style={{
                minWidth: "190px",
                padding: "13px 22px",
                borderRadius: "11px",
                border: "none",
                background:
                  "linear-gradient(135deg,#15803d,#22c55e)",
                color: "#ffffff",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              🖼️ Escolher Foto
            </button>

            <button
              type="button"
              onClick={() =>
                setMostrarUltimosClips((atual) => !atual)
              }
              style={{
                minWidth: "190px",
                padding: "13px 22px",
                borderRadius: "11px",
                border: "1px solid #38bdf8",
                background: mostrarUltimosClips
                  ? "#082f49"
                  : "#0f172a",
                color: "#e0f2fe",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              {mostrarUltimosClips
                ? "✖️ Fechar Últimos Clips"
                : "🎬 Abrir Últimos Clips"}
            </button>
          </div>

          {mostrarUltimosClips &&
            carregandoUltimosClips && (
              <div
                style={{
                  marginTop: "22px",
                  color: "#94a3b8",
                  fontWeight: "bold",
                }}
              >
                ⏳ Carregando últimos Clips...
              </div>
            )}

          {mostrarUltimosClips &&
            !carregandoUltimosClips &&
            ultimosClips.length > 0 && (
              <div
                style={{
                  width: "100%",
                  maxWidth: "1050px",
                  margin: "26px auto 0",
                  textAlign: "left",
                  paddingTop: "22px",
                  borderTop: "1px solid #334155",
                }}
              >
                <h3
                  style={{
                    color: "#67e8f9",
                    textAlign: "center",
                    margin: "0 0 6px",
                  }}
                >
                  🎬 Últimos Clips
                </h3>

                <p
                  style={{
                    color: "#94a3b8",
                    textAlign: "center",
                    margin: "0 0 16px",
                    fontSize: "13px",
                  }}
                >
                  Reutilize um Clip já gerado sem gastar novos créditos.
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(170px, 1fr))",
                    gap: "12px",
                  }}
                >
                  {ultimosClips.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: "10px",
                        borderRadius: "12px",
                        border: "1px solid #334155",
                        background: "#020617",
                      }}
                    >
                      <video
                        src={item.imagem_processada}
                        controls
                        muted
                        playsInline
                        preload="metadata"
                        style={{
                          width: "100%",
                          aspectRatio: "1 / 1",
                          objectFit: "contain",
                          borderRadius: "9px",
                          background: "#000000",
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => usarClipExistente(item)}
                        style={{
                          width: "100%",
                          marginTop: "9px",
                          padding: "10px 8px",
                          borderRadius: "9px",
                          border: "none",
                          background:
                            "linear-gradient(135deg,#15803d,#22c55e)",
                          color: "#ffffff",
                          fontWeight: "bold",
                          cursor: "pointer",
                        }}
                      >
                        ✅ Usar este Clip
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {mostrarUltimosClips &&
            !carregandoUltimosClips &&
            ultimosClips.length === 0 && (
              <div
                style={{
                  marginTop: "22px",
                  color: "#94a3b8",
                  fontWeight: "bold",
                }}
              >
                Nenhum Clip salvo foi encontrado ainda.
              </div>
            )}
        </section>
      )}

      {imagemClip && !clipConfirmado && (
        <>
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
                  color: "#22c55e",
                  marginTop: 0,
                  textAlign: "center",
                }}
              >
                ✅ Foto selecionada
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
  📁 Importar Foto
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
                }}
              >
                ⚙️ Configuração do Clip
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(3, 1fr)",
                  gap: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setModoGeracao(
                      "rapido"
                    )
                  }
                  style={botaoSelecao(
                    modoGeracao ===
                      "rapido"
                  )}
                >
                  ⚡ Modo Rápido
                  <small
                    style={smallStyle}
                  >
                    IA gera 1 versão otimizada
                  </small>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setModoGeracao(
                      "personalizado"
                    )
                  }
                  style={botaoSelecao(
                    modoGeracao ===
                      "personalizado"
                  )}
                >
                  🎛 Personalizado
                  <small
                    style={smallStyle}
                  >
                    Gera um estilo
                  </small>
                </button>

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
                          "Mascote IA",
                        duracao: 8,
                        movimento:
                          "apresentacao",
                      },
                    ]);
                  }}
                  style={botaoSelecao(
                    modoMascote
                  )}
                >
                  🎭 Mascote IA
                  <small
                    style={smallStyle}
                  >
                    Seu mascote falando — Veo 3.1
                  </small>
                </button>
              </div>

              {modoMascote && (
                <div
                  style={{
                    marginTop: "14px",
                    padding: "16px",
                    borderRadius: "14px",
                    border:
                      "1px solid rgba(34,211,238,.35)",
                    background:
                      "linear-gradient(135deg,rgba(8,47,73,.65),rgba(15,23,42,.95))",
                  }}
                >
                  <strong
                    style={{
                      color: "#67e8f9",
                      display: "block",
                      marginBottom: "12px",
                    }}
                  >
                    🎭 Crie a propaganda da sua empresa
                  </strong>

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
                      boxSizing: "border-box",
                      padding: "11px 12px",
                      borderRadius: "10px",
                      border:
                        "1px solid #334155",
                      background: "#020617",
                      color: "#e2e8f0",
                      marginBottom: "12px",
                    }}
                  />

                  <label
                    style={{
                      color: "#cbd5e1",
                      display: "block",
                      fontSize: "13px",
                      marginBottom: "6px",
                    }}
                  >
                    Fala do mascote
                  </label>

                  <textarea
                    value={falaMascote}
                    onChange={(event) =>
                      setFalaMascote(
                        event.target.value
                      )
                    }
                    maxLength={260}
                    rows={5}
                    placeholder="Escreva exatamente o que o mascote deve falar em português..."
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "11px 12px",
                      borderRadius: "10px",
                      border:
                        "1px solid #334155",
                      background: "#020617",
                      color: "#e2e8f0",
                      resize: "vertical",
                    }}
                  />

                  <div
                    style={{
                      textAlign: "right",
                      color:
                        falaMascote.length > 230
                          ? "#fbbf24"
                          : "#64748b",
                      fontSize: "11px",
                      marginTop: "4px",
                    }}
                  >
                    {falaMascote.length}/260 caracteres
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
                    value={instrucaoMascote}
                    onChange={(event) =>
                      setInstrucaoMascote(
                        event.target.value
                      )
                    }
                    rows={3}
                    placeholder="Ex.: começa cansado e termina alegre apontando para a loja."
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "11px 12px",
                      borderRadius: "10px",
                      border:
                        "1px solid #334155",
                      background: "#020617",
                      color: "#e2e8f0",
                      resize: "vertical",
                    }}
                  />

                  <div
                    style={{
                      color: "#94a3b8",
                      marginTop: "10px",
                      fontSize: "12px",
                      lineHeight: 1.5,
                    }}
                  >
                    Use a imagem do mascote da própria empresa. O PAIIA envia a imagem e a fala para o Veo 3.1, que cria um vídeo de aproximadamente 8 segundos com voz e sincronização labial nativas.
                  </div>
                </div>
              )}

              {modoGeracao ===
                "personalizado" && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(3, 1fr)",
                    gap: "8px",
                    marginTop: "12px",
                  }}
                >
                  {ESTILOS_CLIP.map(
                    (estilo) => (
                      <button
                        key={estilo.id}
                        type="button"
                        onClick={() =>
                          setEstiloSelecionado(
                            estilo.id
                          )
                        }
                        style={botaoSelecao(
                          estiloSelecionado ===
                            estilo.id
                        )}
                      >
                        {estilo.icone}{" "}
                        {estilo.titulo}
                      </button>
                    )
                  )}
                </div>
              )}

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

              {!processandoClip && (
                <button
                  type="button"
                  onClick={gerarClipsIA}
                  disabled={
                    carregandoCreditos ||
                    saldoCreditos === null ||
                    saldoCreditos < 1
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
                      saldoCreditos !== null &&
                      saldoCreditos > 0
                        ? "linear-gradient(135deg,#2563eb,#22d3ee)"
                        : "#334155",
                    color: "#ffffff",
                    fontWeight:
                      "bold",
                    cursor:
                      saldoCreditos !== null &&
                      saldoCreditos > 0 &&
                      !carregandoCreditos
                        ? "pointer"
                        : "not-allowed",
                    fontSize: "16px",
                    boxShadow:
                      saldoCreditos !== null &&
                      saldoCreditos > 0
                        ? "0 14px 34px rgba(34,211,238,.2)"
                        : "none",
                    opacity:
                      carregandoCreditos
                        ? 0.7
                        : 1,
                  }}
                >
                  {carregandoCreditos
                    ? "💎 Verificando créditos..."
                    : saldoCreditos !== null &&
                      saldoCreditos > 0
                    ? modoMascote
                      ? "🎭 Gerar Mascote IA — 1 crédito"
                      : modoPaizinho
                      ? "🤖 Gerar Clip do Paizinho — 1 crédito"
                      : "🎬 Gerar Clip — 1 crédito"
                    : "💎 Créditos insuficientes"}
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

          {statusClip && (
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

          {videosGerados.length >
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
              Seu Clip profissional foi salvo na Galeria APPIA.
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