import { useEffect, useRef, useState } from "react";
import { supabase, supabaseKey } from "./supabase";
import Catalogos from "./components/Catalogos";
import BuscaCatalogo from "./components/BuscaCatalogo";
import MeusRascunhos from "./components/MeusRascunhos";
import ContasMarketplace from "./components/ContasMarketplace";
import InteligenciaCatalogo from "./components/InteligenciaCatalogo";
import LeitorCatalogoIA from "./components/LeitorCatalogoIA";
import ImportadorBoschV2 from "./components/ImportadorBoschV2";
import PesquisaCatalogoCompleta from "./components/PesquisaCatalogoCompleta";
import ImportadorUniversal from "./components/ImportadorUniversal";
import { testarInteligencia } from "./services/inteligencia/testarInteligencia";
import LoadingAppia from "./components/LoadingAppia";
import ClipIA from "./components/ClipIA";
import useBannerState from "./hooks/useBannerState";
import useFotoState from "./hooks/useFotoState";
import useProjetoState from "./hooks/useProjetoState";
import CentralPesquisa from "./components/CentralPesquisa";
import logoAppia from "./assets/logo-appia-ai.png";
import ImportadorCatalogos from "./components/ImportadorCatalogos";
import FabricantesAdmin from "./components/FabricantesAdmin";
import EquivalenciasAdmin from "./components/EquivalenciasAdmin";
import CentroConhecimentoScreen from "./components/screens/CentroConhecimentoScreen";
import DashboardAppia from "./components/DashboardAppia";
import {
  API_ATENDIMENTO_IA,
  API_PROCESSAR_IMAGEM,
  API_PROCESSAR_CLIP,
  API_PROCESSAR_FOTO,
} from "./components/constants/apiConstants";
import CentralPublicacaoScreen from "./components/screens/CentralPublicacaoScreen";
import FotoIAScreen from "./components/screens/FotoIAScreen";
import BannerStudio from "./components/BannerStudio";
import useGaleriaState from "./hooks/useGaleriaState";
import GaleriaScreen from "./components/screens/GaleriaScreen";
import Admin from "./components/Admin";
import MarketingAppia from "./components/MarketingAppia";
import HomeScreen from "./components/screens/HomeScreen";
import { usuarioEhAdministrador } from "./services/usuarioEhAdministrador";
import { usuarioEhContaInternaTeste } from "./services/usuarioEhContaInternaTeste";
import { ROTULO_CONTA_INTERNA_TESTE } from "./config/contasInternasPaiia";
import Projetos from "./components/Projetos";
import Login from "./components/Login";
import Footer from "./components/Footer";
import Copilot from "./components/Copilot";
import NovoAnuncioScreen from "./components/screens/NovoAnuncioScreen";
import MeusAnuncios from "./components/MeusAnuncios";
import CentralPrecificacaoScreen from "./components/screens/CentralPrecificacaoScreen";
import MercadoLivreTeste from "./components/MercadoLivreTeste";
import PublicacaoSite from "./components/PublicacaoSite";
import MidiasAppia from "./components/MidiasAppia";
import PlanosPagamentos from "./components/PlanosPagamentos";
import CriarMascotePaizinho from "./components/CriarMascotePaizinho";
import CentralPaizinho from "./components/CentralPaizinho";
import {
  cardStyle,
  buttonBlue,
  buttonGreen,
  buttonRed,
} from "./components/stylesAppia";

import {
  criarProjetoAction,
  atualizarProjetoAction,
  excluirProjetoAction,
} from "./services/projetoActions";

import { obterResumoBaseMestre } from "./services/baseMestreResumo";
import {
  obterResumoComercial,
} from "./services/resumoComercial";

import {
  processarFotoAction,
  enviarFotoOriginalAction,
  salvarFotoNaGaleriaAction,
} from "./services/fotoActions";

import { caminhoStorageDaUrl } from "./services/fotoIA/pipelineFotoIA.js";

import {
  gerarRespostaIAAction,
} from "./services/atendimentoActions";
import CentralInteligencia from "./components/CentralInteligencia";
import { criarNotificacao } from "./components/utils/notificacaoUtils";
import { baixarImagem as baixarImagemUtil } from "./components/utils/downloadUtils";
import ProjetosScreen from "./components/screens/ProjetosScreen";
import {
  buscarProjetos,
  inserirProjeto,
  editarProjeto,
  removerProjeto,
} from "./services/projetosService";

import {
  buscarProcessamentos,
  removerProcessamento,
  removerProcessamentosSelecionados,
} from "./services/processamentosService";
import { vincularImagensProjeto } from "./services/projetoImagensService";
import {
  consumirNovaCriacaoMidia,
  deveIniciarNovaCriacaoMidia,
  prepararNovaCriacaoMidia,
} from "./services/limparEstadoTemporarioMidia";
// =====================================================
// PAIIA AI
// Organização do projeto
// As telas serão movidas para /src/components/screens
// Gradualmente, sem alterar o funcionamento.
// =====================================================
export default function App() {
 const [statusSistema, setStatusSistema] =
  useState("🟢 IA Online");

const [screen, setScreen] =
  useState("home");

const [
  mostrarPaizinho,
  setMostrarPaizinho,
] = useState(false);

const [
  abrirLoginEmCadastro,
  setAbrirLoginEmCadastro,
] = useState(false);

const [
  anuncioEditando,
  setAnuncioEditando,
] = useState(null);

const [
  fotosAnuncio,
  setFotosAnuncio,
] = useState([]);
const {
  projetos,
  setProjetos,

  nomeProjeto,
  setNomeProjeto,

  descricaoProjeto,
  setDescricaoProjeto,

  statusProjeto,
  setStatusProjeto,

  novoStatus,
  setNovoStatus,

  editandoProjeto,
  setEditandoProjeto,

  buscaProjeto,
  setBuscaProjeto,

  imagemProjeto,
  setImagemProjeto,

  arquivoProjeto,
  setArquivoProjeto,

  totalProjetos,
  setTotalProjetos,

  projetosAndamento,
  setProjetosAndamento,

  projetosConcluidos,
  setProjetosConcluidos,

  projetosPausados,
  setProjetosPausados,

  ultimosProjetos,
  setUltimosProjetos,
} = useProjetoState();
const {
  setImagemBanner,
} = useBannerState();
const {
  categoriaFoto,
  setCategoriaFoto,

  arquivosFotos,
  setArquivosFotos,

  tipoFundoFoto,
  setTipoFundoFoto,

  tamanhoFoto,
  setTamanhoFoto,

  qualidadeFoto,
  setQualidadeFoto,

  destinoFoto,
  setDestinoFoto,
} = useFotoState();

const {
  filtroGaleria,
  setFiltroGaleria,

  galeria,
  setGaleria,

  selecionadas,
  setSelecionadas,

  paginaAtual,
  setPaginaAtual,

  buscaGaleria,
  setBuscaGaleria,

  totalFotosIA,
  setTotalFotosIA,

  totalBannersIA,
  setTotalBannersIA,

  totalProcessamentos,
  setTotalProcessamentos,

  imagensSelecionadas,
  setImagensSelecionadas,

  baixandoLote,
  setBaixandoLote,

  itensPorPagina,
} = useGaleriaState();

const TAMANHO_PAGINA_GALERIA = 24;
const COLUNAS_LEVES_GALERIA =
  "id, user_id, tipo, status, created_at, imagem_processada";
const [galeriaTemMais, setGaleriaTemMais] = useState(false);
const carregandoMaisGaleriaRef = useRef(false);

const [
  produtoCopilot,
  setProdutoCopilot,
] = useState("");

const [usuario, setUsuario] =
  useState(null);

const [email, setEmail] =
  useState("");

const [senha, setSenha] =
  useState("");

const [
  totalBanners,
  setTotalBanners,
] = useState(0);

const [
  totalVideos,
  setTotalVideos,
] = useState(0);

const [
  totalFotos,
  setTotalFotos,
] = useState(0);

const [
  ultimosBanners,
  setUltimosBanners,
] = useState([]);

const [
  ultimasImagens,
  setUltimasImagens,
] = useState([]);

const [arquivo, setArquivo] =
  useState(null);

const [preview, setPreview] =
  useState("");

const [
  urlPublica,
  setUrlPublica,
] = useState("");

const [
  resultadoIA,
  setResultadoIA,
] = useState("");

const [
  resultadosFotos,
  setResultadosFotos,
] = useState([]);

const [tituloIA, setTituloIA] =
  useState("");

const [
  descricaoIA,
  setDescricaoIA,
] = useState("");

const [
  palavrasIA,
  setPalavrasIA,
] = useState("");

const [
  especificacoesIA,
  setEspecificacoesIA,
] = useState("");

const [
  processando,
  setProcessando,
] = useState(false);

const [
  notificacao,
  setNotificacao,
] = useState("");

const [
  statusProcesso,
  setStatusProcesso,
] = useState("");

const [
  textoAtendimento,
  setTextoAtendimento,
] = useState("");

const [
  especialistaAtendimento,
  setEspecialistaAtendimento,
] = useState("auto");

const [
  respostaAtendimento,
  setRespostaAtendimento,
] = useState("");

const [
  historicoAtendimento,
  setHistoricoAtendimento,
] = useState([]);

const [
  favoritosAtendimento,
  setFavoritosAtendimento,
] = useState([]);

const [
  carregandoAtendimento,
  setCarregandoAtendimento,
] = useState(false);

const [statusIA, setStatusIA] =
  useState("");

const [
  totalRespostas,
  setTotalRespostas,
] = useState(0);

const [
  totalFavoritos,
  setTotalFavoritos,
] = useState(0);

const [
  ultimaAcao,
  setUltimaAcao,
] = useState(
  "Nenhuma resposta gerada ainda."
);

const [
  sugestaoIA,
  setSugestaoIA,
] = useState("");

const [editando, setEditando] =
  useState(null);

const [tempoSessao] = useState(
  new Date().toLocaleTimeString(
    "pt-BR",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  )
);
const [
  resumoBaseMestre,
  setResumoBaseMestre,
] = useState({
  totalPecas: 0,
  totalFabricantes: 0,
  totalCatalogos: 0,
  totalCompatibilidades: 0,
});

const [
  resumoComercial,
  setResumoComercial,
] = useState({
  totalAnuncios: 0,
  anunciosProntos: 0,
  anunciosMargemBaixa: 0,
  anunciosReajuste: 0,
  oportunidadesMargem: 0,
  produtosPoucaConcorrencia: 0,
  anunciosSemFoto: 0,
  lucroEstimado: 0,
  margemMedia: 0,
  precoMedio: 0,
  totalMercadoLivre: 0,
  totalShopee: 0,
  totalAmazon: 0,
  totalSite: 0,
});

const [
  ultimaPergunta,
  setUltimaPergunta,
] = useState("");

function mostrarNotificacao(texto) {
  criarNotificacao(
    setNotificacao,
    texto
  );
}

useEffect(() => {
  console.table(
    testarInteligencia()
  );
}, []);

useEffect(() => {
  if (screen === "home") {
    prepararNovaCriacaoMidia();
    limparTelaFoto();
    setFotosAnuncio([]);
    setAnuncioEditando(null);
    setImagemBanner(null);
    setProdutoCopilot("");
    setCategoriaFoto("autopecas");
    setTipoFundoFoto("branco");
    setQualidadeFoto("alta");
    return;
  }

  if (
    screen === "foto" &&
    deveIniciarNovaCriacaoMidia() &&
    localStorage.getItem("abrirFotoAutomatico") !== "true"
  ) {
    limparTelaFoto();
    setCategoriaFoto("autopecas");
    setTipoFundoFoto("branco");
    setQualidadeFoto("alta");
    consumirNovaCriacaoMidia();
  }
}, [screen]);

useEffect(() => {
  async function carregarResumoComercial() {
    const resumo =
      await obterResumoComercial();

    setResumoComercial(resumo);
  }

  carregarResumoComercial();
}, []);

useEffect(() => {
  async function carregarResumoBase() {
    const resumo =
      await obterResumoBaseMestre();

    setResumoBaseMestre({
      totalPecas:
        resumo?.totalPecas || 0,

      totalFabricantes:
        resumo?.totalFabricantes || 0,

      totalCatalogos:
        resumo?.totalCatalogos || 0,

      totalCompatibilidades:
        resumo?.totalCompatibilidades || 0,
    });
  }

  carregarResumoBase();
}, []);

const ehAdministrador = usuarioEhAdministrador(usuario);
const ehContaInternaTeste = usuarioEhContaInternaTeste(usuario);

useEffect(() => {
  if (
    screen === "admin" &&
    !ehAdministrador
  ) {
    setScreen("home");
  }
}, [screen, ehAdministrador]);

useEffect(() => {
  async function recuperarSessao() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      setUsuario(session.user);
    }
  }

  recuperarSessao();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    setUsuario(session?.user || null);
  });

  return () => {
    subscription.unsubscribe();
  };
}, []);

const gerarRespostaIA = async () => {
  if (
    !textoAtendimento ||
    !textoAtendimento.trim()
  ) {
    mostrarNotificacao(
      "Digite uma mensagem primeiro"
    );
    return;
  }

  setCarregandoAtendimento(true);
  setStatusSistema(
    "🟡 Processando..."
  );
  setStatusIA(
    "🔍 Enviando para a IA..."
  );
  setRespostaAtendimento("");
  setHistoricoAtendimento([]);
  setSugestaoIA("");
  setUltimaPergunta(
    textoAtendimento
  );

  try {
    const {
      resposta,
      dados,
    } = await gerarRespostaIAAction({
      mensagem:
        textoAtendimento,
      especialista:
        especialistaAtendimento,
      supabaseKey,
    });

    console.log(
      "DATA ATENDIMENTO:",
      dados
    );

    setRespostaAtendimento(
      resposta
    );

    setUltimaAcao(
      `Última resposta gerada às ${new Date().toLocaleTimeString(
        "pt-BR",
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      )}`
    );

    setHistoricoAtendimento(
      (anterior) => [
        {
          id: Date.now(),

          especialista:
            especialistaAtendimento,

          pergunta:
            textoAtendimento,

          resposta,

          favorito: false,

          copiado: false,

          whatsapp: false,

          horario:
            new Date().toLocaleTimeString(
              "pt-BR",
              {
                hour: "2-digit",
                minute: "2-digit",
              }
            ),
        },

        ...anterior,
      ]
    );

    setStatusIA(
      "✅ Resposta pronta!"
    );

    setStatusSistema(
      "🟢 IA Online"
    );
  } catch (erro) {
    console.error(
      "ERRO GERAL ATENDIMENTO IA:",
      erro
    );

    const mensagemErro =
      erro?.message ||
      "Erro inesperado ao gerar resposta.";

    setRespostaAtendimento(
      `❌ ${mensagemErro}`
    );

    setStatusIA(
      "❌ Erro inesperado"
    );

    setStatusSistema(
      "🔴 Erro"
    );
  } finally {
    setCarregandoAtendimento(
      false
    );
  }
};

useEffect(() => {
  if (!usuario) return;

  if (
    screen === "galeria" ||
    screen === "banner" ||
    screen === "bannerStudio"
  ) {
    carregarGaleria();
  }

  if (screen === "dashboardAppia") {
    carregarDashboard();
  }
}, [usuario, screen]);

const estatisticasAtendimento = historicoAtendimento.reduce(
  (acc, item) => {
    acc[item.especialista] = (acc[item.especialista] || 0) + 1;
    return acc;
  },
  {}
);

  async function verificarUsuario() {
    const { data } = await supabase.auth.getUser();
    setUsuario(data.user || null);
  }

  async function entrarUsuario() {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setUsuario(data.user);
    setScreen("home");
  }

  async function cadastrarUsuario(
    dadosCadastro = {}
  ) {
    const {
      data,
      error,
    } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: {
          tipo_conta:
            dadosCadastro.tipoConta ||
            "pf",

          nome:
            dadosCadastro.nome ||
            "",

          documento:
            dadosCadastro.documento ||
            "",

          telefone:
            dadosCadastro.telefone ||
            "",

          nome_loja:
            dadosCadastro.nomeLoja ||
            "",

          cep:
            dadosCadastro.cep ||
            "",

          logradouro:
            dadosCadastro.logradouro ||
            "",

          numero_endereco:
            dadosCadastro.numeroEndereco ||
            "",

          bairro:
            dadosCadastro.bairro ||
            "",

          cidade:
            dadosCadastro.cidade ||
            "",

          estado:
            dadosCadastro.estado ||
            "",
        },
      },
    });

    if (error) {
      const mensagem =
        String(error.message || "");

      if (
        mensagem
          .toLowerCase()
          .includes("security purposes") ||
        mensagem
          .toLowerCase()
          .includes("after") &&
        mensagem
          .toLowerCase()
          .includes("seconds")
      ) {
        alert(
          "⏳ Aguarde alguns segundos antes de tentar novamente. A PAIIA está protegendo seu cadastro contra envios repetidos."
        );
        return;
      }

      if (
        mensagem
          .toLowerCase()
          .includes("already registered") ||
        mensagem
          .toLowerCase()
          .includes("already been registered")
      ) {
        alert(
          "ℹ️ Este e-mail já possui uma conta na PAIIA. Use a opção Entrar."
        );
        return;
      }

      alert(
        "❌ Não foi possível criar sua conta. " +
          mensagem
      );
      return;
    }

    if (data?.user) {
      setUsuario(
        data.session?.user || null
      );
    }

    alert(
      "✅ Conta criada com sucesso!\n\nEnviamos um e-mail de confirmação. Abra sua caixa de entrada e clique no botão para ativar sua conta PAIIA."
    );

    setScreen("login");
  }

  async function sairUsuario() {
    await supabase.auth.signOut();
    setUsuario(null);
    setGaleria([]);
    setGaleriaTemMais(false);
    setUltimasImagens([]);
    setTotalFotos(0);
    setScreen("login");
  }

  async function carregarDashboard() {
  if (!usuario) return;

  const { count: countFotos } = await supabase
    .from("processamentos")
    .select("*", { count: "exact", head: true })
    .eq("user_id", usuario.id)
    .eq("tipo", "foto");

  setTotalFotos(countFotos || 0);

  const { count: countBanners } = await supabase
    .from("processamentos")
    .select("*", { count: "exact", head: true })
    .eq("user_id", usuario.id)
    .eq("tipo", "banner");

  setTotalBanners(countBanners || 0);

  const { count: countVideos } = await supabase
    .from("processamentos")
    .select("*", { count: "exact", head: true })
    .eq("user_id", usuario.id)
    .eq("tipo", "video");

  setTotalVideos(countVideos || 0);

  const { data: fotosRecentes } = await supabase
    .from("processamentos")
    // Colunas leves: evita baixar imagem_original/base64 no painel.
    .select(COLUNAS_LEVES_GALERIA)
    .eq("user_id", usuario.id)
    .eq("tipo", "foto")
    .not("imagem_processada", "is", null)
    .order("created_at", { ascending: false })
    .limit(6);

  setUltimasImagens(fotosRecentes || []);

  const { data: bannersRecentes } = await supabase
    .from("processamentos")
    // Colunas leves: evita baixar imagem_original/base64 no painel.
    .select(COLUNAS_LEVES_GALERIA)
    .eq("user_id", usuario.id)
    .eq("tipo", "banner")
    .not("imagem_processada", "is", null)
    .order("created_at", { ascending: false })
    .limit(4);

  setUltimosBanners(bannersRecentes || []);
}
const totalHoje = galeria.filter((item) => {
  const hoje = new Date().toDateString();
  return new Date(item.created_at).toDateString() === hoje;
}).length;

const totalSemana = galeria.filter((item) => {
  const hoje = new Date();
  const seteDias = new Date();
  seteDias.setDate(hoje.getDate() - 7);

  return new Date(item.created_at) >= seteDias;
}).length;

async function carregarProjetos() {
  if (!usuario) return;

  const { data, count, error } = await buscarProjetos(
    supabase,
    usuario
  );

  if (error) {
    console.log("ERRO CARREGAR PROJETOS:", error);
    return;
  }

  const lista = data || [];

  setProjetos(lista);
  setTotalProjetos(count || 0);
  setUltimosProjetos(lista.slice(0, 5));

  setProjetosAndamento(
    lista.filter(
      (p) =>
        (p.status || "").trim().toLowerCase() === "em andamento"
    ).length
  );

  setProjetosConcluidos(
    lista.filter(
      (p) =>
        (p.status || "").trim().toLowerCase() === "concluído" ||
        (p.status || "").trim().toLowerCase() === "concluido"
    ).length
  );

  setProjetosPausados(
    lista.filter(
      (p) =>
        (p.status || "").trim().toLowerCase() === "pausado"
    ).length
  );
}
async function EditarProjeto() {
  if (!editandoProjeto) {
    alert("Nenhum projeto selecionado");
    return;
  }

  try {
    await atualizarProjetoAction({
      supabase,
      projetoId: editandoProjeto,
      nomeProjeto,
      descricaoProjeto,
      statusProjeto:
        novoStatus || statusProjeto,
    });

    setEditandoProjeto(null);
    setNomeProjeto("");
    setDescricaoProjeto("");
    setImagemProjeto("");
    setArquivoProjeto(null);
    setStatusProjeto(
      "Em andamento"
    );
    setNovoStatus("");

    await carregarProjetos();
    await carregarDashboard();

    alert("Projeto atualizado!");
  } catch (erro) {
    alert(
      erro?.message ||
        "Erro ao atualizar projeto."
    );
  }
}
function consultaGaleriaLeve() {
  return supabase
    .from("processamentos")
    .select(COLUNAS_LEVES_GALERIA)
    .eq("user_id", usuario.id)
    .not("imagem_processada", "is", null)
    .not("imagem_processada", "like", "data:%")
    .order("created_at", { ascending: false });
}

async function carregarGaleria() {
  if (!usuario) return;

  const { data, error } = await consultaGaleriaLeve().range(
    0,
    TAMANHO_PAGINA_GALERIA - 1
  );

  console.log("ERRO GALERIA:", error);

  if (error) {
    console.log(error);
    alert("Erro ao carregar galeria: " + error.message);
    return;
  }

  const lista = data || [];

  setGaleria(lista);
  setGaleriaTemMais(lista.length === TAMANHO_PAGINA_GALERIA);

  setTotalFotosIA(lista.filter((item) => item.tipo === "foto").length);
  setTotalBannersIA(lista.filter((item) => item.tipo === "banner").length);
  setTotalProcessamentos(lista.length);
}

async function carregarMaisGaleria() {
  if (!usuario || !galeriaTemMais || carregandoMaisGaleriaRef.current) {
    return;
  }

  carregandoMaisGaleriaRef.current = true;

  try {
    const inicio = galeria.length;
    const { data, error } = await consultaGaleriaLeve().range(
      inicio,
      inicio + TAMANHO_PAGINA_GALERIA - 1
    );

    if (error) {
      console.log(error);
      alert("Erro ao carregar galeria: " + error.message);
      return;
    }

    const novos = data || [];
    setGaleria((atual) => [...atual, ...novos]);
    setGaleriaTemMais(novos.length === TAMANHO_PAGINA_GALERIA);
    setTotalFotosIA(
      (atual) =>
        atual + novos.filter((item) => item.tipo === "foto").length
    );
    setTotalBannersIA(
      (atual) =>
        atual + novos.filter((item) => item.tipo === "banner").length
    );
    setTotalProcessamentos((atual) => atual + novos.length);
  } finally {
    carregandoMaisGaleriaRef.current = false;
  }
}

async function padronizarImagemFinal1200({
  url,
  transparente = false,
}) {
  if (!url) {
    throw new Error(
      "Imagem processada não informada."
    );
  }

  const resposta = await fetch(url);

  if (!resposta.ok) {
    throw new Error(
      "Não foi possível baixar a imagem processada para padronizar em 1200x1200."
    );
  }

  const blobOriginal =
    await resposta.blob();

  const urlTemporaria =
    URL.createObjectURL(blobOriginal);

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
                "Não foi possível abrir a imagem processada."
              )
            );

          img.src = urlTemporaria;
        }
      );

    /*
     * =====================================================
     * DETECTAR A ÁREA REAL DA PEÇA
     * =====================================================
     *
     * O Gemini normalmente devolve:
     * - peça
     * - fundo branco
     *
     * Aqui removemos virtualmente o excesso de fundo branco
     * antes de montar o arquivo final.
     */

    const canvasAnalise =
      document.createElement("canvas");

    canvasAnalise.width =
      imagem.width;

    canvasAnalise.height =
      imagem.height;

    const ctxAnalise =
      canvasAnalise.getContext(
        "2d",
        {
          willReadFrequently: true,
        }
      );

    if (!ctxAnalise) {
      throw new Error(
        "Não foi possível analisar a imagem."
      );
    }

    ctxAnalise.drawImage(
      imagem,
      0,
      0
    );

    const dados =
      ctxAnalise.getImageData(
        0,
        0,
        imagem.width,
        imagem.height
      );

    const pixels = dados.data;

    let minX = imagem.width;
    let minY = imagem.height;
    let maxX = -1;
    let maxY = -1;

    /*
     * Consideramos fundo os pixels
     * praticamente brancos.
     *
     * Isso permite encontrar somente
     * a área ocupada pela peça.
     */
   /*
 * =====================================================
 * DETECÇÃO ROBUSTA DA PEÇA
 * =====================================================
 *
 * Não usamos mais um único pixel para definir
 * os limites da peça.
 *
 * Pequenos resíduos do fundo branco são ignorados.
 */

/*
 * =====================================================
 * DETECTOR DE FUNDO ADAPTATIVO — PAIIA
 * =====================================================
 *
 * Descobre a cor real do fundo usando os cantos
 * da imagem e separa a peça pelas diferenças de cor.
 */

const quantidadePorLinha =
  new Uint32Array(
    imagem.height
  );

const quantidadePorColuna =
  new Uint32Array(
    imagem.width
  );

function obterPixel(
  x,
  y
) {
  const indice =
    (y * imagem.width + x) * 4;

  return {
    r: pixels[indice],
    g: pixels[indice + 1],
    b: pixels[indice + 2],
    a: pixels[indice + 3],
  };
}

/*
 * Amostramos pequenas áreas nos quatro cantos.
 * Isso é mais confiável do que olhar apenas
 * um único pixel.
 */
const TAMANHO_AMOSTRA =
  Math.max(
    5,
    Math.round(
      Math.min(
        imagem.width,
        imagem.height
      ) * 0.03
    )
  );

let somaR = 0;
let somaG = 0;
let somaB = 0;
let totalAmostras = 0;

const cantos = [
  [0, 0],

  [
    imagem.width -
      TAMANHO_AMOSTRA,
    0,
  ],

  [
    0,
    imagem.height -
      TAMANHO_AMOSTRA,
  ],

  [
    imagem.width -
      TAMANHO_AMOSTRA,
    imagem.height -
      TAMANHO_AMOSTRA,
  ],
];

for (
  const [
    inicioX,
    inicioY,
  ] of cantos
) {
  for (
    let y = inicioY;
    y <
    Math.min(
      inicioY +
        TAMANHO_AMOSTRA,
      imagem.height
    );
    y++
  ) {
    for (
      let x = inicioX;
      x <
      Math.min(
        inicioX +
          TAMANHO_AMOSTRA,
        imagem.width
      );
      x++
    ) {
      const pixel =
        obterPixel(
          x,
          y
        );

      if (
        pixel.a > 0
      ) {
        somaR += pixel.r;
        somaG += pixel.g;
        somaB += pixel.b;

        totalAmostras++;
      }
    }
  }
}

const fundoR =
  totalAmostras > 0
    ? somaR /
      totalAmostras
    : 255;

const fundoG =
  totalAmostras > 0
    ? somaG /
      totalAmostras
    : 255;

const fundoB =
  totalAmostras > 0
    ? somaB /
      totalAmostras
    : 255;

/*
 * Quanto maior este número,
 * mais tolerante somos com pequenas
 * diferenças existentes no fundo.
 */
const TOLERANCIA_FUNDO = 38;

console.log(
  "🎨 FUNDO DETECTADO PAIIA:",
  {
    r:
      Math.round(
        fundoR
      ),

    g:
      Math.round(
        fundoG
      ),

    b:
      Math.round(
        fundoB
      ),

    tolerancia:
      TOLERANCIA_FUNDO,
  }
);

for (
  let y = 0;
  y < imagem.height;
  y++
) {
  for (
    let x = 0;
    x < imagem.width;
    x++
  ) {
    const indice =
      (
        y *
          imagem.width +
        x
      ) * 4;

    const r =
      pixels[indice];

    const g =
      pixels[
        indice + 1
      ];

    const b =
      pixels[
        indice + 2
      ];

    const a =
      pixels[
        indice + 3
      ];

    const diferencaR =
      Math.abs(
        r - fundoR
      );

    const diferencaG =
      Math.abs(
        g - fundoG
      );

    const diferencaB =
      Math.abs(
        b - fundoB
      );

    const maiorDiferenca =
      Math.max(
        diferencaR,
        diferencaG,
        diferencaB
      );

    const ehFundo =
      a === 0 ||
      maiorDiferenca <=
        TOLERANCIA_FUNDO;

    if (!ehFundo) {
      quantidadePorLinha[y]++;
      quantidadePorColuna[x]++;
    }
  }
}
/*
 * Uma linha ou coluna só pertence à peça
 * quando possui quantidade suficiente
 * de pixels reais.
 *
 * Isso elimina pontinhos e resíduos
 * espalhados pelo fundo.
 */

const MIN_PIXELS_LINHA =
  Math.max(
    12,
    Math.round(
      imagem.width * 0.015
    )
  );

const MIN_PIXELS_COLUNA =
  Math.max(
    12,
    Math.round(
      imagem.height * 0.015
    )
  );
minX = imagem.width;
minY = imagem.height;
maxX = -1;
maxY = -1;

/*
 * Localiza esquerda e direita.
 */
for (
  let x = 0;
  x < imagem.width;
  x++
) {
  if (
    quantidadePorColuna[x] >=
    MIN_PIXELS_COLUNA
  ) {
    minX = x;
    break;
  }
}

for (
  let x = imagem.width - 1;
  x >= 0;
  x--
) {
  if (
    quantidadePorColuna[x] >=
    MIN_PIXELS_COLUNA
  ) {
    maxX = x;
    break;
  }
}

/*
 * Localiza topo e base.
 */
for (
  let y = 0;
  y < imagem.height;
  y++
) {
  if (
    quantidadePorLinha[y] >=
    MIN_PIXELS_LINHA
  ) {
    minY = y;
    break;
  }
}

for (
  let y = imagem.height - 1;
  y >= 0;
  y--
) {
  if (
    quantidadePorLinha[y] >=
    MIN_PIXELS_LINHA
  ) {
    maxY = y;
    break;
  }
}

/*
 * Segurança:
 * se por algum motivo a peça
 * não for encontrada, usamos
 * a imagem completa.
 */
if (
  maxX < minX ||
  maxY < minY
) {
  console.warn(
    "⚠️ PAIIA não conseguiu detectar a peça. Usando imagem completa."
  );

  minX = 0;
  minY = 0;

  maxX =
    imagem.width - 1;

  maxY =
    imagem.height - 1;
}

/*
 * Margem de segurança de 2%.
 */
const larguraDetectada =
  maxX - minX + 1;

const alturaDetectada =
  maxY - minY + 1;

const margemX =
  Math.round(
    larguraDetectada * 0.01
  );

const margemY =
  Math.round(
    alturaDetectada * 0.01
  );

minX =
  Math.max(
    0,
    minX - margemX
  );

minY =
  Math.max(
    0,
    minY - margemY
  );

maxX =
  Math.min(
    imagem.width - 1,
    maxX + margemX
  );

maxY =
  Math.min(
    imagem.height - 1,
    maxY + margemY
  );

const larguraRecorte =
  maxX - minX + 1;

const alturaRecorte =
  maxY - minY + 1;

console.log(
  "📐 RECORTE FOTO PAIIA:",
  {
    imagem: {
      largura:
        imagem.width,

      altura:
        imagem.height,
    },

    limites: {
      minX,
      minY,
      maxX,
      maxY,
    },

    recorte: {
      largura:
        larguraRecorte,

      altura:
        alturaRecorte,
    },

    ocupacaoDetectada: {
      largura:
        (
          larguraRecorte /
          imagem.width *
          100
        ).toFixed(1) + "%",

      altura:
        (
          alturaRecorte /
          imagem.height *
          100
        ).toFixed(1) + "%",
    },
  }
);
console.log(
  "📐 RECORTE FOTO PAIIA:",
  {
    imagemOriginal: {
      largura: imagem.width,
      altura: imagem.height,
    },

    limites: {
      minX,
      minY,
      maxX,
      maxY,
    },

    recorte: {
      largura: larguraRecorte,
      altura: alturaRecorte,
    },

    ocupacaoDetectada: {
      largura:
        (
          larguraRecorte /
          imagem.width *
          100
        ).toFixed(1) + "%",

      altura:
        (
          alturaRecorte /
          imagem.height *
          100
        ).toFixed(1) + "%",
    },
  }
);

    const TAMANHO_FINAL = 1200;

    /*
     * 1020 = aproximadamente 85%
     * dos 1200 pixels.
     *
     * A peça ficará grande sem encostar
     * nas bordas.
     */
    const AREA_MAXIMA_PECA = 1080;

    const escala =
      Math.min(
        AREA_MAXIMA_PECA /
          larguraRecorte,

        AREA_MAXIMA_PECA /
          alturaRecorte
      );

    const larguraFinal =
      larguraRecorte * escala;

    const alturaFinal =
      alturaRecorte * escala;

    const xFinal =
      (TAMANHO_FINAL -
        larguraFinal) / 2;

    const yFinal =
      (TAMANHO_FINAL -
        alturaFinal) / 2;

    const canvas =
      document.createElement(
        "canvas"
      );

    canvas.width =
      TAMANHO_FINAL;

    canvas.height =
      TAMANHO_FINAL;

    const ctx =
      canvas.getContext("2d");

    if (!ctx) {
      throw new Error(
        "Não foi possível criar a imagem final 1200x1200."
      );
    }

    ctx.clearRect(
      0,
      0,
      TAMANHO_FINAL,
      TAMANHO_FINAL
    );

    if (!transparente) {
      ctx.fillStyle = "#ffffff";

      ctx.fillRect(
        0,
        0,
        TAMANHO_FINAL,
        TAMANHO_FINAL
      );
    }

    /*
     * IMPORTANTE:
     * não criamos sombra,
     * não alteramos proporção,
     * não deformamos a peça.
     */
    ctx.drawImage(
      imagem,

      minX,
      minY,
      larguraRecorte,
      alturaRecorte,

      xFinal,
      yFinal,
      larguraFinal,
      alturaFinal
    );
console.log(
  "🎯 FOTO FINAL 1200 PAIIA:",
  {
    recorte: {
      largura: larguraRecorte,
      altura: alturaRecorte,
    },

    escala,

    final: {
      largura: Math.round(larguraFinal),
      altura: Math.round(alturaFinal),
      x: Math.round(xFinal),
      y: Math.round(yFinal),
    },

    canvas: {
      largura: canvas.width,
      altura: canvas.height,
    },
  }
);
    const tipoArquivo =
      transparente
        ? "image/png"
        : "image/jpeg";

    const extensao =
      transparente
        ? "png"
        : "jpg";

    const blobFinal =
      await new Promise(
        (resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(
                  new Error(
                    "Não foi possível gerar a imagem final 1200x1200."
                  )
                );

                return;
              }

              resolve(blob);
            },

            tipoArquivo,

            transparente
              ? undefined
              : 0.97
          );
        }
      );

    const nomeArquivo =
      `${usuario.id}/processadas/1200x1200-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${extensao}`;

    const {
      error: erroUpload,
    } =
      await supabase.storage
        .from("imagens")
        .upload(
          nomeArquivo,
          blobFinal,
          {
            contentType:
              tipoArquivo,

            upsert: false,
          }
        );

    if (erroUpload) {
      throw new Error(
        "A foto foi processada, mas não foi possível salvar a versão 1200x1200: " +
          erroUpload.message
      );
    }

    const {
      data: dadosUrl,
    } =
      supabase.storage
        .from("imagens")
        .getPublicUrl(
          nomeArquivo
        );

    if (!dadosUrl?.publicUrl) {
      throw new Error(
        "Não foi possível gerar a URL da foto final 1200x1200."
      );
    }

    console.log(
      "📐 FOTO ML PADRONIZADA:",
      {
        original:
          `${imagem.width}x${imagem.height}`,

        areaDetectada:
          `${larguraRecorte}x${alturaRecorte}`,

        tamanhoFinal:
          "1200x1200",

        ocupacaoMaxima:
          `${AREA_MAXIMA_PECA}px`,
      }
    );

    return dadosUrl.publicUrl;
  } finally {
    URL.revokeObjectURL(
      urlTemporaria
    );
  }
}

async function processarSelecionadas() {
  const fotosSelecionadas =
    arquivosFotos.filter(
      (foto) => foto.selecionada
    );

  if (fotosSelecionadas.length === 0) {
    mostrarNotificacao(
      "🖼️ Selecione pelo menos uma foto"
    );
    return;
  }

  if (processando) {
    return;
  }

  if (!usuario) {
    mostrarNotificacao(
      "Faça login primeiro"
    );
    setScreen("login");
    return;
  }

  setProcessando(true);
  setResultadosFotos([]);
  setResultadoIA("");

  let totalSucesso = 0;
  let totalErros = 0;

  const erros = [];

  try {
    for (
      let i = 0;
      i < fotosSelecionadas.length;
      i += 1
    ) {
      const foto =
        fotosSelecionadas[i];
      const nomeArquivo =
        foto?.file?.name || `foto-${i + 1}`;
      const logContext = {
        indice: i,
        nomeArquivo,
      };

      console.log("FOTO IA — INÍCIO FOTO:", logContext);

      setStatusProcesso(
        `⬆️ Enviando foto ${i + 1} de ${fotosSelecionadas.length} (${nomeArquivo})...`
      );

      try {
        if (!foto?.file) {
          throw new Error(
            "Arquivo da foto não está disponível neste item."
          );
        }

        const {
          urlPublica:
            imagemOriginal,
        } =
          await enviarFotoOriginalAction({
            supabase,
            usuario,
            arquivo: foto.file,
            logContext,
          });

        setUrlPublica(
          imagemOriginal
        );

        setStatusProcesso(
          `🤖 Processando foto ${i + 1} de ${fotosSelecionadas.length} (${nomeArquivo})...`
        );

        const {
          imagemProcessada,
          fundoTransparente,
        } =
          await processarFotoAction({
            apiProcessarImagem:
              API_PROCESSAR_FOTO,

            supabaseKey,

            urlImagem:
              imagemOriginal,

            categoriaFoto,

            tipoFundoFoto,

            qualidadeFoto,

            tamanhoFoto,

            logContext,
          });

        if (!imagemProcessada) {
          throw new Error(
            "A IA não retornou a imagem processada."
          );
        }

        const transparenteFinal =
          tipoFundoFoto ===
            "transparente" ||
          Boolean(
            fundoTransparente
          );

        setStatusProcesso(
          `📐 Padronizando foto ${i + 1} em 1200 x 1200...`
        );

        const imagemFinal1200 =
          await padronizarImagemFinal1200({
            url:
              imagemProcessada,

            transparente:
              transparenteFinal,
          });

        setStatusProcesso(
          `💾 Salvando foto ${i + 1} na Galeria...`
        );

        await salvarFotoNaGaleriaAction({
          supabase,
          usuario,

          imagemOriginal,

          imagemProcessada:
            imagemFinal1200,

          logContext,
        });

        console.log("FOTO IA — FOTO CONCLUÍDA:", {
          ...logContext,
          imagemOriginal,
          imagemProcessada: imagemFinal1200,
        });

        setResultadoIA(
          imagemFinal1200
        );

        setResultadosFotos(
          (atuais) => [
            ...atuais,
            {
              indice: i,
              nomeArquivo,
              original:
                imagemOriginal,

              processada:
                imagemFinal1200,

              transparente:
                transparenteFinal,

              largura: 1200,
              altura: 1200,

              criadaEm:
                new Date().toISOString(),
            },
          ]
        );

        totalSucesso += 1;

        if (
          i <
          fotosSelecionadas.length - 1
        ) {
          setStatusProcesso(
            `✅ Foto ${i + 1} concluída. Preparando a próxima...`
          );

          await new Promise(
            (resolve) => {
              setTimeout(
                resolve,
                11000
              );
            }
          );
        }
      } catch (erroFoto) {
        totalErros += 1;

        const mensagem =
          erroFoto?.message ||
          `Erro ao processar a foto ${i + 1}`;

        erros.push(
          `Foto ${i + 1} (${nomeArquivo}): ${mensagem}`
        );

        console.error(
          "FOTO IA — FOTO FALHOU:",
          {
            ...logContext,
            erroCompleto: erroFoto,
            mensagem,
          }
        );

        setResultadosFotos(
          (atuais) => [
            ...atuais,
            {
              indice: i,
              nomeArquivo,
              original: foto?.preview || "",
              processada: "",
              erro: mensagem,
              criadaEm: new Date().toISOString(),
            },
          ]
        );
      }
    }

    await carregarGaleria();
    await carregarDashboard();

    if (
      totalSucesso ===
      fotosSelecionadas.length
    ) {
      setStatusProcesso(
        `✅ ${totalSucesso} foto(s) processada(s) com sucesso!`
      );
    } else if (totalSucesso > 0) {
      setStatusProcesso(
        `⚠️ ${totalSucesso} foto(s) processada(s) e ${totalErros} com erro.`
      );

      console.warn(
        "ERROS DO LOTE:",
        erros
      );
    } else {
      setStatusProcesso(
        "❌ Nenhuma foto foi processada."
      );

      console.error(
        "ERROS DO LOTE:",
        erros
      );
    }
  } finally {
    setProcessando(false);
  }
}
async function baixarImagem(url) {
  try {
    await baixarImagemUtil(url);
  } catch (erro) {
    mostrarNotificacao(
      "❌ " +
        (erro?.message ||
          "Não foi possível baixar a imagem.")
    );
  }
}


function alternarSelecionada(id) {
  setSelecionadas((atual) =>
    atual.includes(id)
      ? atual.filter((item) => item !== id)
      : [...atual, id]
  );
}

// Arquivos no Storage que pertencem SÓ ao item excluído (Foto IA e Banner).
// A foto usada para criar um banner não é apagada junto com o banner.
function caminhosDoItemParaExcluir(item) {
  if (!usuario?.id || !item) {
    return [];
  }

  const pasta = `${usuario.id}/`;
  const caminhos = [];
  const processada = caminhoStorageDaUrl(item.imagem_processada);
  const original = caminhoStorageDaUrl(item.imagem_original);

  if (item.tipo === "foto") {
    if (processada.startsWith(`${pasta}processadas/`)) {
      caminhos.push(processada);
    }
    if (original.startsWith(`${pasta}originais/`)) {
      caminhos.push(original);
    }
  }

  if (item.tipo === "banner") {
    if (processada.startsWith(`${pasta}banners/`)) {
      const base = processada.replace(/\.png$/i, "");
      caminhos.push(
        processada,
        `${base}-thumb.webp`,
        `${base}-thumb.jpg`,
        `${base}.json`
      );
    }
    if (
      original.startsWith(`${pasta}banners/`) &&
      original.includes("-original.")
    ) {
      caminhos.push(original);
    }
  }

  return caminhos;
}

async function excluirItensDaGaleria(ids) {
  const idsValidos = (ids || []).filter(Boolean);

  if (!usuario?.id || idsValidos.length === 0) {
    return { error: { message: "Nenhuma imagem selecionada." } };
  }

  const { data: itens } = await supabase
    .from("processamentos")
    .select("id, tipo, imagem_original, imagem_processada")
    .in("id", idsValidos)
    .eq("user_id", usuario.id);

  const { error } = await removerProcessamentosSelecionados(
    supabase,
    idsValidos,
    usuario
  );

  if (error) {
    return { error };
  }

  const caminhos = (itens || []).flatMap(
    caminhosDoItemParaExcluir
  );

  if (caminhos.length > 0) {
    // Limpeza de arquivos: falha aqui não desfaz a exclusão.
    await supabase.storage
      .from("imagens")
      .remove(caminhos)
      .catch(() => {});
  }

  return { error: null };
}

async function excluirSelecionadas() {
  if (!selecionadas || selecionadas.length === 0) {
    alert("Selecione pelo menos uma imagem para excluir.");
    return;
  }

  if (!confirm(`Excluir ${selecionadas.length} imagem(ns) selecionada(s)?`)) {
    return;
  }

  const { error } = await excluirItensDaGaleria(selecionadas);

  if (error) {
    alert("Erro ao excluir imagens: " + error.message);
    return;
  }

  setSelecionadas([]);
  await carregarGaleria();

  alert("✅ Imagens selecionadas excluídas.");
}

async function baixarSelecionadas() {
  if (selecionadas.length === 0) return;

  setBaixandoLote(true);

  let falhas = 0;

  try {
    const imagens = galeria.filter((item) =>
      selecionadas.includes(item.id)
    );

    for (const item of imagens) {
      const url =
        item.imagem_processada ||
        item.imagem_original;

      if (!url) {
        falhas += 1;
        continue;
      }

      try {
        await baixarImagemUtil(url);
      } catch {
        falhas += 1;
      }

      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  } finally {
    setBaixandoLote(false);
  }

  if (falhas > 0) {
    mostrarNotificacao(
      `⚠️ ${falhas} imagem(ns) não puderam ser baixadas.`
    );
  }
}

async function excluirImagem(item) {
  if (!confirm("Deseja realmente excluir esta imagem?")) return;

  if (!item?.id) {
    alert("Não foi possível identificar esta imagem.");
    return;
  }

  const { error } = await excluirItensDaGaleria([item.id]);

  if (error) {
    alert(error.message);
    return;
  }

  await carregarGaleria();
  alert("Imagem excluída com sucesso.");
}

  function limparTelaFoto() {
    setArquivo(null);
    setPreview("");
    setUrlPublica("");
    setResultadoIA("");
    setResultadosFotos([]);
    setArquivosFotos([]);
    setStatusProcesso("");
    setProcessando(false);
  }

async function criarProjeto() {
  if (!usuario) {
    mostrarNotificacao("Faça login primeiro");
    setScreen("login");
    return;
  }

  if (!nomeProjeto.trim()) {
    alert("Digite o nome do projeto");
    return;
  }

  const imagemUrl = await enviarImagemProjeto();

  if (imagemUrl === null) return;

  const { data: projetoCriado, error } = await inserirProjeto(supabase, usuario, {
    nome: nomeProjeto,
    descricao: descricaoProjeto,
    imagem: imagemUrl,
    status: statusProjeto,
  });

  if (error) {
    alert(error.message);
    return;
  }

  const imagensDoProjeto = galeria.filter((item) =>
    selecionadas.includes(item.created_at)
  );

  if (imagensDoProjeto.length > 0) {
    const { error: erroVinculo } = await vincularImagensProjeto(
      supabase,
      usuario,
      projetoCriado.id,
      imagensDoProjeto
    );

    if (erroVinculo) {
      alert("Projeto criado, mas erro ao vincular imagens: " + erroVinculo.message);
      return;
    }
  }

  setNomeProjeto("");
  setDescricaoProjeto("");
  setArquivoProjeto(null);
  setStatusProjeto("Em andamento");
  setNovoStatus("");
  setEditandoProjeto(null);
  setSelecionadas([]);

  await carregarProjetos();
  await carregarDashboard();

  alert("Projeto criado com sucesso!");
}
async function criarProjeto() {
  if (!usuario) {
    mostrarNotificacao(
      "Faça login primeiro"
    );

    setScreen("login");
    return;
  }

  if (!nomeProjeto.trim()) {
    alert(
      "Digite o nome do projeto"
    );
    return;
  }

  try {
    const imagemUrl =
      await enviarImagemProjeto();

    if (imagemUrl === null) {
      return;
    }

    const {
      data: projetoCriado,
      error,
    } = await criarProjetoAction({
      supabase,
      usuario,
      nomeProjeto,
      descricaoProjeto,
      statusProjeto,
      imagem: imagemUrl,
    });

    if (error) {
      throw error;
    }

    const imagensDoProjeto =
      galeria.filter((item) =>
        selecionadas.includes(
          item.created_at
        )
      );

    if (
      imagensDoProjeto.length > 0 &&
      projetoCriado?.id
    ) {
      const {
        error: erroVinculo,
      } = await vincularImagensProjeto(
        supabase,
        usuario,
        projetoCriado.id,
        imagensDoProjeto
      );

      if (erroVinculo) {
        throw new Error(
          "Projeto criado, mas ocorreu erro ao vincular as imagens: " +
            erroVinculo.message
        );
      }
    }

    setNomeProjeto("");
    setDescricaoProjeto("");
    setImagemProjeto("");
    setArquivoProjeto(null);
    setStatusProjeto(
      "Em andamento"
    );
    setNovoStatus("");
    setEditandoProjeto(null);
    setSelecionadas([]);

    await carregarProjetos();
    await carregarDashboard();

    alert(
      "Projeto criado com sucesso!"
    );
  } catch (erro) {
    console.error(
      "Erro ao criar projeto:",
      erro
    );

    alert(
      erro?.message ||
        "Não foi possível criar o projeto."
    );
  }
}
async function excluirProjeto(id) {
  const confirmar = window.confirm(
    "Deseja realmente excluir este projeto?"
  );

  if (!confirmar) {
    return;
  }

  try {
    const { error } =
      await excluirProjetoAction({
        supabase,
        projetoId: id,
      });

    if (error) {
      throw error;
    }

    await carregarProjetos();
    await carregarDashboard();

    alert("Projeto excluído!");
  } catch (erro) {
    alert(
      erro?.message ||
        "Erro ao excluir projeto."
    );
  }
}
async function enviarImagem(
  arquivoSelecionado = arquivo
) {
  if (!usuario) {
    alert("Faça login primeiro");
    setScreen("login");
    return null;
  }

  if (!arquivoSelecionado) {
    mostrarNotificacao(
      "📸 Escolha uma imagem primeiro"
    );
    return null;
  }

  setStatusProcesso(
    "⬆️ Enviando imagem..."
  );

  const nomeArquivo =
    `${usuario.id}/originais/${Date.now()}-${arquivoSelecionado.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9.]/g, "-")}`;

  const {
    error: erroUpload,
  } = await supabase.storage
    .from("imagens")
    .upload(
      nomeArquivo,
      arquivoSelecionado,
      {
        upsert: false,
      }
    );

  if (erroUpload) {
    console.error(
      "ERRO UPLOAD:",
      erroUpload
    );

    throw new Error(
      erroUpload.message
    );
  }

  const {
    data,
  } = supabase.storage
    .from("imagens")
    .getPublicUrl(
      nomeArquivo
    );

  if (!data?.publicUrl) {
    throw new Error(
      "Não foi possível gerar a URL pública."
    );
  }

  setUrlPublica(
    data.publicUrl
  );

  setStatusProcesso(
    "✅ Upload concluído."
  );

  return data.publicUrl;
}
function mostrarNotificacao(texto) {
  setNotificacao(texto);

  setTimeout(() => {
    setNotificacao("");
  }, 3000);
}

// =====================================================
// LAYOUT PRINCIPAL
// Cabeçalho e Menu Principal
// As telas serão renderizadas abaixo conforme o screen.
// =====================================================

return (
  <div
    className={
      screen === "home"
        ? "paiia-app paiia-app-home"
        : "paiia-app"
    }
    style={{
      minHeight: "100vh",
      background: "#020617",
      color: "white",
      padding: "20px 40px",
      textAlign: "center",
      fontFamily: "Arial",
    }}
  >
<style>
  {`
    .paiia-app-home {
      padding-top: 40px !important;
    }
    .paiia-topo-home {
      justify-content: flex-end !important;
      margin-top: 8px;
      margin-bottom: 8px !important;
      border-bottom: none !important;
      padding-top: 8px;
      padding-bottom: 4px !important;
      max-width: 100%;
      overflow-x: hidden;
    }
    .paiia-topo-acoes {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      min-width: 0;
      max-width: 100%;
    }
    .paiia-topo-paizinho {
      padding: 10px 16px;
      border-radius: 999px;
      border: 1px solid #67e8f9;
      background: linear-gradient(135deg,#0369a1,#22d3ee);
      color: #fff;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 6px 18px rgba(34,211,238,.28);
    }
    @media (max-width: 720px) {
      .paiia-app,
      .paiia-app-home {
        padding-top: 8px !important;
        padding-left: 12px !important;
        padding-right: 12px !important;
      }
      .paiia-topo-home {
        margin-top: 0;
        padding-top: 0;
        margin-bottom: 4px !important;
        padding-bottom: 0 !important;
        justify-content: stretch !important;
      }
      .paiia-topo-home .paiia-topo-paizinho {
        display: none !important;
      }
      .paiia-topo-acoes {
        width: 100%;
        display: grid !important;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 6px;
      }
      .paiia-topo-acoes button {
        width: 100%;
        font-size: 11px;
        line-height: 1.2;
        padding: 8px 4px;
        white-space: normal;
        min-height: 40px;
      }
      .paiia-topo-interno {
        flex-direction: column;
        align-items: stretch !important;
        gap: 12px !important;
      }
      .paiia-topo-marca {
        width: 100%;
        justify-content: flex-start;
      }
    }
  `}
</style>
<header
  className={
    !usuario || screen === "home"
      ? "paiia-topo-home"
      : "paiia-topo-interno"
  }
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "20px",
    flexWrap: "wrap",
    marginBottom: "30px",
    borderBottom: "1px solid #1e293b",
    paddingBottom: "18px",
  }}
>
  {usuario && screen !== "home" && (
  <div
    className="paiia-topo-marca"
    style={{
      display: "flex",
      alignItems: "center",
      gap: "14px",
    }}
  >
    <img
      src={logoAppia}
      alt="PAIIA AI"
      style={{ width: "70px" }}
    />

    <div style={{ textAlign: "left" }}>
      <h2 style={{ margin: 0, color: "#67e8f9" }}>
        PAIIA AI
      </h2>

      <p style={{ margin: 0, color: "#94a3b8" }}>
        Criador Inteligente de Anúncios
      </p>
    </div>
  </div>
  )}



  <div
    className="paiia-topo-acoes"
    style={{
      display: "flex",
      gap: "10px",
      flexWrap: "wrap",
      alignItems: "center",
    }}
  >
    


    {!usuario ? (
      <>
        <button
          type="button"
          className="paiia-topo-paizinho"
          onClick={() => {
            setScreen("home");
            setMostrarPaizinho(true);
          }}
        >
          Paizinho IA
        </button>
        <button
          type="button"
          style={botaoTopoPlanos}
          onClick={() =>
            setScreen("planosPagamentos")
          }
        >
          Planos e Pagamentos
        </button>
        <button
          type="button"
          style={botaoTopoDestaque}
          onClick={() => {
            setAbrirLoginEmCadastro(true);
            setScreen("login");
          }}
        >
          Criar Conta
        </button>
        <button
          type="button"
          style={botaoTopo}
          onClick={() => {
            setAbrirLoginEmCadastro(false);
            setScreen("login");
          }}
        >
          Login
        </button>
      </>
    ) : (
      <>
        <button
          type="button"
          style={botaoTopo}
          onClick={() => setScreen("home")}
        >
          🏠 Home
        </button>

        {ehContaInternaTeste && (
          <span
            title="Conta interna de teste. Não é cliente pagante."
            style={{
              padding: "8px 12px",
              borderRadius: "999px",
              border: "1px solid #fbbf24",
              background: "rgba(120,53,15,.55)",
              color: "#fde68a",
              fontWeight: 800,
              fontSize: "12px",
              letterSpacing: ".4px",
            }}
          >
            {ROTULO_CONTA_INTERNA_TESTE}
          </span>
        )}

        <button
          type="button"
          className="paiia-topo-paizinho"
          onClick={() => {
            setScreen("home");
            setMostrarPaizinho(true);
          }}
        >
          Paizinho IA
        </button>

        <button
          type="button"
          style={botaoTopoDestaque}
          onClick={() => setScreen("planosPagamentos")}
        >
          💳 Planos e Pagamentos
        </button>

        <button
          type="button"
          style={botaoTopo}
          onClick={sairUsuario}
        >
          Sair
        </button>
      </>
    )}
  </div>
</header>

{notificacao && (
  <div
    style={{
      position: "fixed",
      top: "20px",
      right: "20px",
      background: "#22c55e",
      color: "white",
      padding: "15px 20px",
      borderRadius: "12px",
      zIndex: 9999,
      fontWeight: "bold",
      boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
    }}
  >
    {notificacao}
  </div>
)}

{screen === "login" && (
  <Login
    email={email}
    setEmail={setEmail}
    senha={senha}
    setSenha={setSenha}
    entrarUsuario={entrarUsuario}
    cadastrarUsuario={cadastrarUsuario}
    cardStyle={cardStyle}
    iniciarCadastro={abrirLoginEmCadastro}
  />
)}
{screen === "marketingAppia" && (
  <MarketingAppia
    setScreen={setScreen}
  />
)}

{screen === "home" && (
  <HomeScreen
    totalFotos={totalFotos}
    totalBanners={totalBanners}
    totalVideos={totalVideos}
    cardStyle={cardStyle}
    setScreen={setScreen}
    ehAdministrador={ehAdministrador}
    ehContaInternaTeste={ehContaInternaTeste}
    mostrarPaizinho={mostrarPaizinho}
    setMostrarPaizinho={setMostrarPaizinho}
  />
)}

{screen === "planosPagamentos" && (
  <PlanosPagamentos
    setScreen={setScreen}
    usuario={usuario}
  />
)}

{screen === "contasMarketplace" && (
  <ContasMarketplace
    cardStyle={cardStyle}
    setScreen={setScreen}
  />
)}

{screen === "centralPaizinho" && (
  <CentralPaizinho
    setScreen={setScreen}
  />
)}

{screen === "centralPesquisa" && (
  <CentralPesquisa
    cardStyle={cardStyle}
    setScreen={setScreen}
  />
)}

{(screen === "banner" || screen === "bannerStudio") && (
  <BannerStudio
    galeria={galeria}
    galeriaTemMais={galeriaTemMais}
    carregarMaisGaleria={carregarMaisGaleria}
    setScreen={setScreen}
    cardStyle={cardStyle}
  />
)}
{(screen === "baseConhecimento" || screen === "catalogo") && (
  <div style={{ marginTop: "40px" }}>
    <ImportadorCatalogos />
  </div>
)}
{screen === "centroConhecimento" && (
  <CentroConhecimentoScreen
    setScreen={setScreen}
  />
)}
{screen === "fabricantes" && (
  <div style={{ marginTop: "40px" }}>
    <FabricantesAdmin />
  </div>
)}
{screen === "inteligenciaCatalogo" && (
  <InteligenciaCatalogo cardStyle={cardStyle} />
)}

{screen === "dashboardAppia" && (
  <CentralInteligencia
    setScreen={setScreen}

    totalFotos={totalFotos}
    totalBanners={totalBanners}
    totalVideos={totalVideos}

    totalAnuncios={
      resumoComercial.totalAnuncios
    }

    anunciosProntos={
      resumoComercial.anunciosProntos
    }

    anunciosMargemBaixa={
      resumoComercial.anunciosMargemBaixa
    }

    anunciosReajuste={
      resumoComercial.anunciosReajuste
    }

    oportunidadesMargem={
      resumoComercial.oportunidadesMargem
    }

    produtosPoucaConcorrencia={
      resumoComercial.produtosPoucaConcorrencia
    }

    anunciosSemFoto={
      resumoComercial.anunciosSemFoto
    }

    lucroEstimado={
      resumoComercial.lucroEstimado
    }

    margemMedia={
      resumoComercial.margemMedia
    }

    precoMedio={
      resumoComercial.precoMedio
    }

    totalMercadoLivre={
      resumoComercial.totalMercadoLivre
    }

    totalShopee={
      resumoComercial.totalShopee
    }

    totalAmazon={
      resumoComercial.totalAmazon
    }

    totalSite={
      resumoComercial.totalSite
    }

    totalPecas={
      resumoBaseMestre.totalPecas
    }

    totalFabricantes={
      resumoBaseMestre.totalFabricantes
    }

    totalCatalogos={
      resumoBaseMestre.totalCatalogos
    }

    totalCompatibilidades={
      resumoBaseMestre.totalCompatibilidades
    }
  />
)}

{screen === "importadorBoschV2" && (
  <div style={{ marginTop: "40px" }}>
    <ImportadorBoschV2 />
  </div>
)}

{screen === "importadorUniversal" && (
  <ImportadorUniversal
    cardStyle={cardStyle}
    setScreen={setScreen}
  />
)}

{screen === "equivalencias" && (
  <div style={{ marginTop: "40px" }}>
    <EquivalenciasAdmin />
  </div>
)}
{screen === "clipIA" && (
  <ClipIA
    cardStyle={cardStyle}
    setScreen={setScreen}
  />
)}

{screen === "midiasAppia" && (
  <MidiasAppia
    cardStyle={cardStyle}
    setScreen={setScreen}
  />
)}

{screen === "criarMascotePaizinho" && (
  <CriarMascotePaizinho
    cardStyle={cardStyle}
    setScreen={setScreen}
  />
)}

{screen === "centralPublicacao" && (
  <CentralPublicacaoScreen
    cardStyle={cardStyle}
    setScreen={setScreen}
  />
)}

{screen === "centralPrecificacao" && (
  <CentralPrecificacaoScreen
    cardStyle={cardStyle}
    setScreen={setScreen}
  />
)}

{screen === "atendimento" && (
  <div style={{ marginTop: "50px" }}>
    <h2>💬 Atendimento IA</h2>
    <div
  style={{
    display: "flex",
    justifyContent: "center",
    gap: "20px",
    marginTop: "20px",
    marginBottom: "25px",
    flexWrap: "wrap",
  }}
>

  <div
  style={{
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    background: "#0f172a",
    border: "1px solid #2563eb",
    borderRadius: "999px",
    padding: "8px 16px",
    marginTop: "15px",
    marginBottom: "20px",
    color: "white",
    fontWeight: "bold",
    fontSize: "14px",
  }}
>
  {statusSistema}
</div>
  <div style={cardStyle}>
    <h3>💬 Respostas</h3>
    <h2>{totalRespostas}</h2>
  </div>

  <div style={cardStyle}>
    <h3>❤️ Favoritos</h3>
    <h2>{totalFavoritos}</h2>
  </div>
</div>
<div
  style={{
    marginTop: "20px",
    background: "#0f172a",
    border: "1px solid #2563eb",
    borderRadius: "14px",
    padding: "18px",
    textAlign: "center",
  }}
>
  <h3
    style={{
      color: "#38bdf8",
      marginBottom: "10px",
    }}
  >
    📌 Última Atividade
  </h3>
  <div
  style={{
    marginTop: "20px",
    background: "#020617",
    border: "1px solid #1e40af",
    borderRadius: "14px",
    padding: "20px",
  }}
>
  <h3
    style={{
      color: "#38bdf8",
      marginBottom: "15px",
    }}
  >
    📊 Resumo da Sessão
  </h3>

  <p style={{ color: "#e2e8f0" }}>
    🕒 Sessão iniciada às <strong>{tempoSessao}</strong>
  </p>

  <p style={{ color: "#e2e8f0", marginTop: "10px" }}>
    💬 Última pergunta:
  </p>

  <div
    style={{
      marginTop: "10px",
      background: "#0f172a",
      padding: "12px",
      borderRadius: "10px",
      color: "#cbd5e1",
      minHeight: "45px",
    }}
  >
    {ultimaPergunta || "Nenhuma pergunta realizada."}
  </div>
</div>

  <p
    style={{
      color: "#e2e8f0",
      fontSize: "15px",
    }}
  >
    {ultimaAcao}
  </p>
</div>
<div
  style={{
    marginTop: "20px",
    background: "#0f172a",
    border: "1px solid #2563eb",
    borderRadius: "14px",
    padding: "18px",
    textAlign: "center",
  }}
>
  <h3
    style={{
      color: "#38bdf8",
      marginBottom: "10px",
    }}
  >
    📌 Última Atividade
  </h3>

  <p
    style={{
      color: "#e2e8f0",
      fontSize: "15px",
    }}
  >
    {ultimaAcao}
  </p>
</div>
    <div
    
  style={{
    marginTop: "20px",
    marginBottom: "25px",
    background: "linear-gradient(135deg,#0f172a,#1e3a8a)",
    border: "1px solid #2563eb",
    borderRadius: "16px",
    padding: "20px",
  }}
>
  <h3 style={{ color: "#38bdf8" }}>
    🤖 PAIIA Copilot
  </h3>

  <p style={{ color: "#cbd5e1" }}>
    Escreva em linguagem natural o que você deseja criar.
  </p>

<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: "12px",
    marginTop: "15px",
  }}
>
  <button style={cardStyle} onClick={() => setTextoAtendimento("Criar um banner profissional para Marketplace")}>
    🎨 Criar Banner
  </button>

  <button style={cardStyle} onClick={() => setTextoAtendimento("Melhorar esta foto para padrão profissional de e-commerce")}>
    📸 Melhorar Foto
  </button>

<button
  style={cardStyle}
  onClick={() =>
    setTextoAtendimento(
      "Criar uma descrição profissional para Mercado Livre"
    )
  }
>
  📝 Criar Descrição
</button>
  

  <button style={cardStyle} onClick={() => setTextoAtendimento("Responder cliente perguntando se a peça é compatível com o veículo")}>
    💬 Responder Cliente
  </button>

  <button style={cardStyle} onClick={() => setTextoAtendimento("Verificar compatibilidade da peça pelo código ou chassi")}>
    🔍 Compatibilidade
  </button>

<button
  style={cardStyle}
  onClick={() => setScreen("importadorUniversal")}
>
  📚 Importador Universal
</button>

</div>
</div>

    <p style={{ color: "#93c5fd" }}>
Gere respostas profissionais para clientes, verifique compatibilidade de peças e crie descrições para anúncios automaticamente.    </p>
<div className="mb-4">
  <p className="text-sm font-semibold text-slate-700 mb-2">
    🤖 Especialista ativo: {especialistaAtendimento}
  </p>

<div className="flex gap-2 overflow-x-auto pb-3 mb-4">
  {[
    ["auto", "🤖", "Auto"],
    ["mercado_livre", "🟡", "Mercado Livre"],
    ["shopee", "🟠", "Shopee"],
    ["whatsapp", "🟢", "WhatsApp"],
    ["compatibilidade", "🚗", "Compatibilidade"],
    ["descricao", "📝", "Descrição"],
    ["marketing", "📢", "Marketing"],
  ].map(([valor, icone, titulo]) => (
    <button
      key={valor}
      type="button"
      onClick={() => setEspecialistaAtendimento(valor)}
      className={`min-w-[140px] rounded-xl border px-4 py-3 text-center transition ${
        especialistaAtendimento === valor
          ? "bg-blue-600 text-white border-blue-500 shadow-lg"
          : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
      }`}
    >
      <div className="text-xl">{icone}</div>
      <div className="text-sm font-semibold">{titulo}</div>
    </button>
  ))}
</div>
</div>
<div
  style={{
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "20px",
    marginBottom: "15px",
  }}
>
  {[
    {
      titulo: "🚗 Compatibilidade",
      texto: "Verifique a compatibilidade desta peça para o veículo abaixo:",
    },
    {
      titulo: "🟡 Mercado Livre",
      texto: "Responda este cliente do Mercado Livre de forma profissional:",
    },
    {
      titulo: "🟠 Shopee",
      texto: "Responda este cliente da Shopee de forma educada:",
    },
    {
      titulo: "🟢 WhatsApp",
      texto: "Escreva uma mensagem pronta para WhatsApp:",
    },
    {
      titulo: "📝 Descrição",
      texto: "Crie uma descrição profissional para marketplace:",
    },
    {
      titulo: "📢 Marketing",
      texto: "Crie um texto de marketing para divulgar este produto:",
    },
  ].map((item) => (
    <button
      key={item.titulo}
      type="button"
      onClick={() => setTextoAtendimento(item.texto)}
      style={{
        background: "#1e293b",
        color: "#e2e8f0",
        border: "1px solid #334155",
        padding: "8px 14px",
        borderRadius: "999px",
        cursor: "pointer",
        fontWeight: "600",
        fontSize: "13px",
        transition: "0.2s",
      }}
    >
      {item.titulo}
    </button>
  ))}
</div>
{sugestaoIA && (
  <div
    style={{
      marginBottom: "12px",
      background: "#082f49",
      border: "1px solid #0ea5e9",
      color: "#7dd3fc",
      borderRadius: "12px",
      padding: "12px 16px",
      fontWeight: "600",
    }}
  >
🤖 PAIIA Think analisou sua mensagem
    <span style={{ color: "white" }}>
      {" "}
<>

<div
  style={{
    marginTop: "8px",
    fontSize: "18px",
    fontWeight: "bold",
    color: "#ffffff",
  }}
>
  {sugestaoIA}
</div>

<div
  style={{
    marginTop: "6px",
    color: "#cbd5e1",
    fontSize: "13px",
  }}
>
  A IA recomenda utilizar este especialista para obter a melhor resposta.
</div>

</>    </span>
  </div>
)}
<textarea
  value={textoAtendimento}
  
 onChange={(e) => {
  const texto = e.target.value;

  setTextoAtendimento(texto);

  const t = texto.toLowerCase();

  if (
    t.includes("serve") ||
    t.includes("compat") ||
    t.includes("chassi") ||
    t.includes("veículo") ||
    t.includes("codigo")
  ) {
setSugestaoIA("🚗 Compatibilidade");
setEspecialistaAtendimento("compatibilidade");  } else if (
    t.includes("mercado livre") ||
    t.includes("ml")
  ) {
setSugestaoIA("🟡 Mercado Livre");
setEspecialistaAtendimento("mercado_livre");
  } else if (t.includes("shopee")) {
setSugestaoIA("🟠 Shopee");
setEspecialistaAtendimento("shopee");
  } else if (
    t.includes("whatsapp") ||
    t.includes("cliente")
  ) {
setSugestaoIA("🟢 WhatsApp");
setEspecialistaAtendimento("whatsapp");
  } else if (
    t.includes("descrição") ||
    t.includes("titulo")
  ) {
setSugestaoIA("📝 Descrição");
setEspecialistaAtendimento("descricao");
  } else if (
    t.includes("marketing") ||
    t.includes("instagram") ||
    t.includes("banner")
  ) {
  setSugestaoIA("📢 Marketing");
setEspecialistaAtendimento("marketing");
  } else {
    setSugestaoIA("");
  }
}}
 onChange={(e) => setTextoAtendimento(e.target.value)}
  placeholder={`Exemplos:

• Cliente perguntou se serve no Gol G5 1.0 2012

• Crie uma descrição para Mercado Livre

• Responda este cliente pelo WhatsApp

• Verifique a compatibilidade desta peça

• Crie um texto de marketing para Instagram`}
  style={{
    width: "100%",
    maxWidth: "700px",
    height: "220px",
    padding: "18px",
    borderRadius: "16px",
    background: "#0f172a",
    color: "white",
    border: "2px solid #2563eb",
    marginTop: "20px",
    fontSize: "15px",
    lineHeight: "1.6",
    resize: "vertical",
    outline: "none",
  }}
/>
<div
  style={{
    marginTop: "8px",
    textAlign: "right",
    color: "#94a3b8",
    fontSize: "12px",
  }}
>
  <>
  {textoAtendimento.length} caracteres •{" "}
  {
    textoAtendimento
      .trim()
      .split(/\s+/)
      .filter(Boolean).length
  }{" "}
  palavras
</>
</div>
    <br />

<button
  onClick={gerarRespostaIA}
  disabled={carregandoAtendimento}
  style={{
    background: carregandoAtendimento ? "#1e40af" : "#2563eb",
    color: "white",
    border: "none",
    padding: "14px 24px",
    borderRadius: "10px",
    marginTop: "20px",
    fontWeight: "bold",
    cursor: carregandoAtendimento ? "wait" : "pointer",
    opacity: carregandoAtendimento ? 0.85 : 1,
    transition: "all .3s ease",
  }}
>
  {carregandoAtendimento ? "🤖 Pensando..." : "✨ Executar IA"}
</button>

{carregandoAtendimento && (
  <div
    style={{
      marginTop: "20px",
      textAlign: "center",
    }}
  >
    <div
      style={{
        width: "100%",
        maxWidth: "500px",
        height: "8px",
        background: "#1e293b",
        borderRadius: "999px",
        margin: "0 auto 15px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "70%",
          height: "100%",
          background: "#38bdf8",
          borderRadius: "999px",
        }}
      />
    </div>

    <p
      style={{
        color: "#38bdf8",
        fontWeight: "bold",
      }}
    >
      {statusIA}
    </p>
  </div>
)}

{respostaAtendimento && (
  <div
    style={{
      marginTop: "25px",
      background: "#0f172a",
      border: "1px solid #2563eb",
      borderRadius: "14px",
      padding: "20px",
      textAlign: "left",
      color: "white",
      whiteSpace: "pre-line",
    }}
  >
<div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "18px",
  }}
>
  <div>
    <h3
      style={{
        color: "#38bdf8",
        margin: 0,
        fontSize: "18px",
      }}
    >
      🤖 PAIIA Copilot
    </h3>

    <p
      style={{
        color: "#93c5fd",
        margin: "5px 0 0",
        fontSize: "13px",
      }}
    >
      Especialista: {especialistaAtendimento}
    </p>
  </div>

  <div
    style={{
      background: "#14532d",
      color: "#bbf7d0",
      padding: "6px 12px",
      borderRadius: "999px",
      fontSize: "12px",
      fontWeight: "bold",
    }}
  >
    ✅ Online
  </div>
</div>
<div
  style={{
    background: "#020617",
    border: "1px solid #1e3a8a",
    borderRadius: "14px",
    padding: "18px",
    color: "#e5e7eb",
    whiteSpace: "pre-line",
    lineHeight: "1.7",
    fontSize: "15px",
  }}
>
  {respostaAtendimento}
</div>
    <div
  style={{
  marginTop: "15px",
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: "15px",
}}
    >
      <button
        onClick={() => {
          navigator.clipboard.writeText(respostaAtendimento);
mostrarNotificacao("✅ Resposta copiada!");        }}
        style={{
          background: "#16a34a",
          color: "white",
          border: "none",
          padding: "10px 18px",
          borderRadius: "8px",
          cursor: "pointer",
          fontWeight: "bold",
          gap: "25px",
        }}
      >
        📋 Copiar Resposta
      </button>

      <button
  onClick={() => {
    setFavoritosAtendimento((lista) => [
      respostaAtendimento,
      ...lista,
    ]);
mostrarNotificacao("❤️ Resposta favoritada!");
  }}
  style={{
    background: "#dc2626",
    color: "white",
    border: "none",
    padding: "10px 18px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
    gap: "25px",
  }}
>
  ❤️ Favoritar
</button>

<button
  onClick={() => {
    setTextoAtendimento("");
    setRespostaAtendimento("");
    setStatusIA("");
  }}
  style={{
    background: "#475569",
    color: "white",
    border: "none",
    padding: "10px 18px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
  }}
>
  🗑️ Limpar
</button>

<button
  onClick={() => {
    navigator.clipboard.writeText(respostaAtendimento);
    window.open("https://web.whatsapp.com/", "_blank");
  }}
  style={{
    background: "#22c55e",
    color: "white",
    border: "none",
    padding: "10px 18px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
  }}
>
  📲 WhatsApp
</button>
    </div>

  </div>
)}
{historicoAtendimento.length > 0 && (
  <div
    style={{
      marginTop: "30px",
      background: "#020617",
      border: "1px solid #1e40af",
      borderRadius: "16px",
      padding: "20px",
    }}
  >
    <h3 style={{ color: "#38bdf8" }}>
      🕘 Histórico de Respostas
    </h3>

    {historicoAtendimento.map((item, index) => (
      <div
        key={index}
        style={{
          marginTop: "12px",
          padding: "15px",
          background: "#0f172a",
          borderRadius: "10px",
          color: "#e2e8f0",
          whiteSpace: "pre-line",
        }}
      >
        {typeof item === "string" ? item : item.texto}
      </div>
    ))}
    <div
  style={{
    display: "flex",
    gap: "10px",
    marginTop: "15px",
    flexWrap: "wrap",
  }}
>
  <button
    onClick={() => {
      setTextoAtendimento(item.pergunta);
      setEspecialistaAtendimento(item.especialista || "auto");

      mostrarNotificacao("✏️ Pergunta carregada novamente!");
    }}
    style={{
      background: "#2563eb",
      color: "white",
      border: "none",
      borderRadius: "8px",
      padding: "8px 14px",
      cursor: "pointer",
      fontWeight: "bold",
    }}
  >
    ✏️ Reutilizar
  </button>

  <button
    onClick={() => {
      navigator.clipboard.writeText(item.resposta);

      mostrarNotificacao("📋 Resposta copiada!");
    }}
    style={{
      background: "#16a34a",
      color: "white",
      border: "none",
      borderRadius: "8px",
      padding: "8px 14px",
      cursor: "pointer",
      fontWeight: "bold",
    }}
  >
    📋 Copiar
  </button>
</div>
  </div>
)}
<div
  style={{
    marginTop: "30px",
    background: "#020617",
    border: "1px solid #1e40af",
    borderRadius: "16px",
    padding: "20px",
  }}
>
  <h3 style={{ color: "#38bdf8" }}>
    ⚡ Ações Rápidas
  </h3>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
      gap: "12px",
      marginTop: "15px",
    }}
  >
    <button
      style={cardStyle}
      onClick={() =>
        setTextoAtendimento("Responder cliente solicitando o número do chassi.")
      }
    >
      🚗 Pedir Chassi
    </button>

    <button
      style={cardStyle}
      onClick={() =>
        setTextoAtendimento("Informar que o catálogo está indisponível e pedir confirmação do código da peça.")
      }
    >
      📖 Catálogo Offline
    </button>

    <button
      style={cardStyle}
      onClick={() =>
        setTextoAtendimento("Criar uma resposta educada para devolução do Mercado Livre.")
      }
    >
      📦 Devolução ML
    </button>

    <button
      style={cardStyle}
      onClick={() =>
        setTextoAtendimento("Criar uma mensagem de agradecimento pela compra.")
      }
    >
      ❤️ Agradecimento
    </button>
  </div>
</div>

    <div
      style={{
        marginTop: "30px",
        background: "#0f172a",
        border: "1px solid #1e293b",
        borderRadius: "16px",
        padding: "20px",
      }}
    >
      <h3 style={{ color: "#38bdf8" }}>Exemplos:</h3>
      <p>• Serve no Sandero 2016?</p>
      <p>• Código 0261230268, quais aplicações?</p>
      <p>• Criar resposta para cliente pedindo chassi.</p>
      <p>• Gerar descrição para Mercado Livre.</p>
    </div>
  </div>
)}
{screen === "foto" && (
  <FotoIAScreen
    categoriaFoto={categoriaFoto}
    setCategoriaFoto={setCategoriaFoto}

    arquivosFotos={arquivosFotos}
    setArquivosFotos={setArquivosFotos}

    setArquivo={setArquivo}
    setPreview={setPreview}
    setUrlPublica={setUrlPublica}

    setResultadoIA={setResultadoIA}
    setStatusProcesso={setStatusProcesso}

    resultadosFotos={resultadosFotos}
    setResultadosFotos={setResultadosFotos}

    tipoFundoFoto={tipoFundoFoto}
    setTipoFundoFoto={setTipoFundoFoto}

    qualidadeFoto={qualidadeFoto}
setQualidadeFoto={setQualidadeFoto}

    processarSelecionadas={processarSelecionadas}

    statusProcesso={statusProcesso}
    preview={preview}
    resultadoIA={resultadoIA}

    limparTelaFoto={limparTelaFoto}

    processando={processando}

    baixarImagem={baixarImagem}

    cardStyle={cardStyle}
    buttonGreen={buttonGreen}
    buttonRed={buttonRed}

    produtoCopilot={produtoCopilot}

    setScreen={setScreen}
  />
)}

{screen === "galeria" && (
  <GaleriaScreen
    galeria={galeria}
    galeriaTemMais={galeriaTemMais}
    carregarMaisGaleria={carregarMaisGaleria}
    filtroGaleria={filtroGaleria}
    setFiltroGaleria={setFiltroGaleria}
    buscaGaleria={buscaGaleria}
    setBuscaGaleria={setBuscaGaleria}
    selecionadas={selecionadas}
    setSelecionadas={setSelecionadas}
    alternarSelecionada={alternarSelecionada}
    excluirSelecionadas={excluirSelecionadas}
    baixarSelecionadas={baixarSelecionadas}
    baixandoLote={baixandoLote}
    baixarImagem={baixarImagem}
    excluirImagem={excluirImagem}
    setImagemBanner={setImagemBanner}
    setFotosAnuncio={setFotosAnuncio}
    setScreen={setScreen}
    cardStyle={cardStyle}
  />
)}

{screen === "admin" && ehAdministrador && (
<Admin
  totalFotos={totalFotos}
  cardStyle={cardStyle}
  setScreen={setScreen}
/>)}

{screen === "copilot" && (
  <Copilot
    cardStyle={cardStyle}
    setScreen={setScreen}
    setProdutoCopilot={setProdutoCopilot}
  />
)}

{screen === "novoAnuncio" && (
<NovoAnuncioScreen
  usuario={usuario}
  cardStyle={cardStyle}
  setScreen={setScreen}
  fotosAnuncio={fotosAnuncio}
  setFotosAnuncio={setFotosAnuncio}
  anuncioEditando={anuncioEditando}
  setAnuncioEditando={setAnuncioEditando}
/>
)}

{screen === "meusAnuncios" && (
  <MeusAnuncios
    cardStyle={cardStyle}
    setScreen={setScreen}
    setAnuncioEditando={setAnuncioEditando}
  />
)}

{screen === "mercadoLivreTeste" && (
  <MercadoLivreTeste
    setScreen={setScreen}
  />
)}
{screen === "publicacaoSite" && (
  <PublicacaoSite
    setScreen={setScreen}
  />
)}

{screen === "meusRascunhos" && (
  <MeusRascunhos
    usuario={usuario}
    cardStyle={cardStyle}
    setScreen={setScreen}
    setAnuncioEditando={setAnuncioEditando}
    setFotosAnuncio={setFotosAnuncio}
  />
)}

{screen === "catalogos" && (
  <Catalogos
    setScreen={setScreen}
    cardStyle={cardStyle}
  />
)}

{screen === "importadorCatalogos" && (
  <ImportadorCatalogos cardStyle={cardStyle} />
)}

{screen === "leitorCatalogoIA" && (
  <LeitorCatalogoIA />
)}

{screen === "buscaCatalogo" && (
  <BuscaCatalogo
    setScreen={setScreen}
    cardStyle={cardStyle}
  />
)}

{screen === "projetos" && (
  <ProjetosScreen
    projetos={projetos}
    nomeProjeto={nomeProjeto}
    setNomeProjeto={setNomeProjeto}
    descricaoProjeto={descricaoProjeto}
    setDescricaoProjeto={setDescricaoProjeto}
    statusProjeto={statusProjeto}
    setStatusProjeto={setStatusProjeto}
    novoStatus={novoStatus}
    setNovoStatus={setNovoStatus}
    editandoProjeto={editandoProjeto}
    setEditandoProjeto={setEditandoProjeto}
    criarProjeto={criarProjeto}
    atualizarProjeto={EditarProjeto}
    excluirProjeto={excluirProjeto}
    buscaProjeto={buscaProjeto}
    setBuscaProjeto={setBuscaProjeto}
    cardStyle={cardStyle}
    buttonGreen={buttonGreen}
    buttonBlue={buttonBlue}
    buttonRed={buttonRed}
    setScreen={setScreen}
    setAnuncioEditando={setAnuncioEditando}
  />
)}
{processando && (
  <LoadingAppia
    titulo="🤖 PAIIA AI"
    mensagem={
      statusProcesso ||
      "Processando imagem com IA..."
    }
  />
)}

</div>
);
}
const botaoTopo = {
  padding: "10px 16px",
  borderRadius: "999px",
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
};

const botaoTopoPlanos = {
  ...botaoTopo,
  border: "1px solid rgba(103,232,249,.55)",
  background: "rgba(8,47,73,.72)",
  color: "#e0f2fe",
};

const botaoTopoDestaque = {
  ...botaoTopo,
  background:
    "linear-gradient(135deg,#2563eb,#22d3ee)",
  border: "none",
};

const cardFerramenta = {
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: "20px",
  padding: "22px",
  color: "#fff",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  textAlign: "center",
  minHeight: "180px",
  transition: "all .25s",
};

const iconeCard = {
  fontSize: "42px",
  marginBottom: "14px",
};