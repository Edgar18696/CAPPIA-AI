import { useEffect, useState } from "react";
import { supabase, supabaseKey } from "./supabase";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
// import NovoAnuncio from "./components/NovoAnuncio";

import logoAppia from "./assets/logo-appia-ai.png";
import ImportadorCatalogo from "./components/ImportadorCatalogo";
import FabricantesAdmin from "./components/FabricantesAdmin";
import EquivalenciasAdmin from "./components/EquivalenciasAdmin";
import CentroConhecimento from "./components/CentroConhecimento";
import DashboardAppia from "./components/DashboardAppia";
import AppHeader from "./components/layout/AppHeader";
import { modelosPremiumBanner } from "./components/bannerConstants";
import {
  API_ATENDIMENTO_IA,
  API_PROCESSAR_IMAGEM,
} from "./components/constants/apiConstants";

import FotoIA from "./components/FotoIA";
import BannerIA from "./components/BannerIA";
import Galeria from "./components/Galeria";
import Admin from "./components/Admin";
import Home from "./components/Home";
import Login from "./components/Login";
import Footer from "./components/Footer";
import Projetos from "./components/Projetos";
import Copilot from "./components/Copilot";
import NovoAnuncio from "./components/NovoAnuncio";
import CentralPesquisa from "./components/CentralPesquisa";
import {
  cardStyle,
  buttonBlue,
  buttonGreen,
  buttonRed,
} from "./components/stylesAppia";
import ClipIA from "./components/ClipIA";
import { criarNotificacao } from "./components/utils/notificacaoUtils";
import { baixarImagem as baixarImagemUtil } from "./components/utils/downloadUtils";
import { enviarMensagemAtendimento } from "./services/atendimentoService";

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
// =====================================================
// APPIA AI
// Organização do projeto
// As telas serão movidas para /src/components/screens
// Gradualmente, sem alterar o funcionamento.
// =====================================================
export default function App() {
  console.log("APPIA APP CARREGOU");

const [statusSistema, setStatusSistema] = useState("🟢 IA Online");
const [screen, setScreen] = useState("home");
const [fotosAnuncio, setFotosAnuncio] = useState([]);
console.log("TELA ATUAL:", screen);
const [produtoCopilot, setProdutoCopilot] = useState("");
const [usuario, setUsuario] = useState(null);
const [email, setEmail] = useState("");
const [senha, setSenha] = useState("");
const [filtroGaleria, setFiltroGaleria] = useState("todos");
const [totalBanners, setTotalBanners] = useState(0);
const [totalVideos, setTotalVideos] = useState(0);
const [totalFotos, setTotalFotos] = useState(0);
const [editandoProjeto, setEditandoProjeto] = useState(null);
const [novoStatus, setNovoStatus] = useState("");
const [ultimosBanners, setUltimosBanners] = useState([]);
const [ultimasImagens, setUltimasImagens] = useState([]);
const [galeria, setGaleria] = useState([]);
const [selecionadas, setSelecionadas] = useState([]);
const [bannerModelo, setBannerModelo] = useState("mercadolivre");
const [modeloPremiumBanner, setModeloPremiumBanner] = useState("premium");
  const [arquivo, setArquivo] = useState(null);
  const [preview, setPreview] = useState("");
  const [urlPublica, setUrlPublica] = useState("");
  const [resultadoIA, setResultadoIA] = useState("");
  const [tituloIA, setTituloIA] = useState("");
const [descricaoIA, setDescricaoIA] = useState("");
const [palavrasIA, setPalavrasIA] = useState("");
const [especificacoesIA, setEspecificacoesIA] = useState("");
  const [processando, setProcessando] = useState(false);
  const [notificacao, setNotificacao] = useState("");
  const [statusProcesso, setStatusProcesso] = useState("");
  const [projetos, setProjetos] = useState([]);
const [nomeProjeto, setNomeProjeto] = useState("");
const [descricaoProjeto, setDescricaoProjeto] = useState("");
const [imagemProjeto, setImagemProjeto] = useState("");
const [arquivoProjeto, setArquivoProjeto] = useState(null);
const [statusProjeto, setStatusProjeto] = useState("Em andamento");
const [totalProjetos, setTotalProjetos] = useState(0);
const [projetosAndamento, setProjetosAndamento] = useState(0);
const [projetosConcluidos, setProjetosConcluidos] = useState(0);
const [projetosPausados, setProjetosPausados] = useState(0);
const [buscaProjeto, setBuscaProjeto] = useState("");
const [ultimosProjetos, setUltimosProjetos] = useState([]);
const [imagemBanner, setImagemBanner] = useState(null);
const [categoriaBanner, setCategoriaBanner] = useState("autopecas");
const [categoriaFoto, setCategoriaFoto] = useState("autopecas");
const [estiloBanner, setEstiloBanner] = useState("premium");
const [tamanhoBanner, setTamanhoBanner] = useState("1200x1200");
const [fundoBanner, setFundoBanner] = useState("automatico");
const [arquivosFotos, setArquivosFotos] = useState([]);
const [tipoFundoFoto, setTipoFundoFoto] = useState("branco");
const [tamanhoFoto, setTamanhoFoto] = useState("1200x1200");
const [paginaAtual, setPaginaAtual] = useState(1);
const itensPorPagina = 12;
const [buscaGaleria, setBuscaGaleria] = useState("");
const [totalFotosIA, setTotalFotosIA] = useState(0);
const [totalBannersIA, setTotalBannersIA] = useState(0);
const [totalProcessamentos, setTotalProcessamentos] = useState(0);
const [imagensSelecionadas, setImagensSelecionadas] = useState([]);
const [baixandoLote, setBaixandoLote] = useState(false);
const [textoAtendimento, setTextoAtendimento] = useState("");
const [especialistaAtendimento, setEspecialistaAtendimento] = useState("auto");
const [respostaAtendimento, setRespostaAtendimento] = useState("");
const [historicoAtendimento, setHistoricoAtendimento] = useState([]);
const [favoritosAtendimento, setFavoritosAtendimento] = useState([]);
const [carregandoAtendimento, setCarregandoAtendimento] = useState(false);
const [statusIA, setStatusIA] = useState("");
const [totalRespostas, setTotalRespostas] = useState(0);
const [totalFavoritos, setTotalFavoritos] = useState(0);
const [ultimaAcao, setUltimaAcao] = useState("Nenhuma resposta gerada ainda.");
const [sugestaoIA, setSugestaoIA] = useState("");
const [editando, setEditando] = useState(null);
const [salvandoEdicao, setSalvandoEdicao] = useState(false);
const [tempoSessao] = useState(
  new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })
);

const [ultimaPergunta, setUltimaPergunta] = useState("");
function mostrarNotificacao(texto) {
  criarNotificacao(setNotificacao, texto);
}
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
  if (!textoAtendimento || !textoAtendimento.trim()) {
    mostrarNotificacao("Digite uma mensagem primeiro");
    return;
  }

  setCarregandoAtendimento(true);
  setStatusSistema("🟡 Processando...");
  setStatusIA("🔍 Enviando para a IA...");
  setRespostaAtendimento("");
  setHistoricoAtendimento([]);
setSugestaoIA("");
  setUltimaPergunta(textoAtendimento);

  try {
const retornoApi = await enviarMensagemAtendimento({
  mensagem: textoAtendimento,
  especialista: especialistaAtendimento,
  supabaseKey,
});
console.log("STATUS:", retornoApi.status);
console.log("DATA:", retornoApi.data);

const data = retornoApi.data;

const resposta =
  data?.resposta ||
  data?.error ||
  JSON.stringify(data, null, 2) ||
  "Não consegui gerar uma resposta.";

setRespostaAtendimento(resposta);

    setUltimaAcao(
      `Última resposta gerada às ${new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    );

    setHistoricoAtendimento((anterior) => [
  {
    id: Date.now(),

    especialista: especialistaAtendimento,

    pergunta: textoAtendimento,

    resposta,

    favorito: false,

    copiado: false,

    whatsapp: false,

    horario: new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  },

  ...anterior,
]);

    setStatusIA("✅ Resposta pronta!");
    setStatusSistema("🟢 IA Online");
  } catch (erro) {
    console.log("ERRO GERAL ATENDIMENTO IA:", erro);
    setRespostaAtendimento("❌ Erro inesperado ao gerar resposta.");
    setStatusIA("❌ Erro inesperado");
    setStatusSistema("🔴 Erro");
  }

  setCarregandoAtendimento(false);
};

useEffect(() => {
  if (usuario && screen === "galeria") {
    carregarGaleria();
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

  async function cadastrarUsuario() {
    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
    });

    if (error) {
      alert(error.message);
      return;
    }

    mostrarNotificacao("✅ Cadastro criado! Verifique seu e-mail");
  }

  async function sairUsuario() {
    await supabase.auth.signOut();
    setUsuario(null);
    setGaleria([]);
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
    .select("*")
    .eq("user_id", usuario.id)
    .eq("tipo", "foto")
    .not("imagem_processada", "is", null)
    .order("created_at", { ascending: false })
    .limit(6);

  setUltimasImagens(fotosRecentes || []);

  const { data: bannersRecentes } = await supabase
    .from("processamentos")
    .select("*")
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

  const { error } = await supabase
    .from("projetos")
    .update({
      nome: nomeProjeto,
      descricao: descricaoProjeto,
      status: novoStatus || statusProjeto,
    })
    .eq("id", editandoProjeto);

  if (error) {
    alert(error.message);
    return;
  }

  setEditandoProjeto(null);
  setNomeProjeto("");
  setDescricaoProjeto("");
  setImagemProjeto("");
  setArquivoProjeto(null);
  setStatusProjeto("Em andamento");
  setNovoStatus("");

  await carregarProjetos();
  await carregarDashboard();

  alert("Projeto atualizado!");
}
async function carregarGaleria() {
  console.log("🔥 carregarGaleria chamou");
console.log("USUARIO GALERIA:", usuario);
  if (!usuario) return;

  const { data, error } = await supabase
    .from("processamentos")
    .select("*")
    .eq("user_id", usuario.id)
    .not("imagem_processada", "is", null)
    .order("created_at", { ascending: false });

  console.log("GALERIA:", data);
  console.log("TOTAL GALERIA:", data?.length);
  console.log("ERRO GALERIA:", error);

  if (error) {
    console.log(error);
    alert("Erro ao carregar galeria: " + error.message);
    return;
  }

  const lista = data || [];

  setGaleria(lista);

  setTotalFotosIA(lista.filter((item) => item.tipo === "foto").length);
  setTotalBannersIA(lista.filter((item) => item.tipo === "banner").length);
  setTotalProcessamentos(lista.length);
}
async function processarSelecionadas() {
  const selecionadas = arquivosFotos.filter((foto) => foto.selecionada);

  if (selecionadas.length === 0) {
   mostrarNotificacao("🖼️ Selecione pelo menos uma foto");
    return;
  }

  setProcessando(true);
  setStatusProcesso(`⏳ Processando ${selecionadas.length} fotos...`);

  for (let i = 0; i < selecionadas.length; i++) {
    const foto = selecionadas[i];

    try {
      setStatusProcesso(`⏳ Processando foto ${i + 1} de ${selecionadas.length}...`);

      const urlEnviada = await enviarImagem(foto.file);

      if (!urlEnviada) {
        throw new Error("Falha ao enviar imagem.");
      }

      await processarIA(urlEnviada);
    } catch (erro) {
      console.log(`ERRO FOTO ${i + 1}:`, erro);
      setStatusProcesso("❌ " + (erro?.message || `Erro ao processar foto ${i + 1}`));
      setProcessando(false);
      return;
    }
  }

  await carregarGaleria();
  await carregarDashboard();

  setProcessando(false);
setStatusProcesso(`✅ ${selecionadas.length} fotos processadas com sucesso! Resultado salvo na galeria.`);

// Mantém o usuário na tela atual para avaliar o resultado.
// Não volta automaticamente para a galeria.
  setTimeout(() => {
   // setScreen("galeria");
  }, 1500);
}

async function processarIA(urlImagem = urlPublica) {
  if (!usuario) {
    mostrarNotificacao("🔐 Faça login primeiro");
    return;
  }

  if (!urlImagem) {
    mostrarNotificacao("📸 Envie uma imagem primeiro");
    return;
  }

  setProcessando(true);
  setStatusProcesso("🤖 Processando imagem com IA...");

  try {
    const respostaApi = await fetch(
API_PROCESSAR_IMAGEM, 
     {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
body: JSON.stringify({
  imageUrl: urlImagem,
  tipo: "foto",
  categoria: categoriaFoto,
  fundo: tipoFundoFoto,
  tamanho: tamanhoFoto,
})
      }
    );

    const data = await respostaApi.json();

    console.log("STATUS FOTO:", respostaApi.status);
    console.log("DATA FOTO:", data);

    if (!respostaApi.ok || !data.imagem_processada) {
      throw new Error(
        data.erro ||
          data.error ||
          data.detalhes ||
          "Erro ao processar imagem."
      );
    }

    setResultadoIA(data.imagem_processada);
    setStatusProcesso("💾 Salvando resultado na galeria...");

    const { error } = await supabase.from("processamentos").insert([
      {
        imagem_original: urlImagem,
        imagem_processada: data.imagem_processada,
        status: "processado",
        user_id: usuario.id,
        tipo: "foto",
      },
    ]);

    if (error) {
      console.log("ERRO AO SALVAR GALERIA:", error);
      throw new Error("Processou, mas não salvou na galeria.");
    }

    await carregarGaleria();
    await carregarDashboard();

setStatusProcesso("✅ Foto pronta! Você pode baixar, limpar ou criar um banner.");  } catch (erro) {
    console.log("ERRO PROCESSAR IA:", erro);
    setStatusProcesso("❌ " + (erro?.message || "Erro ao processar imagem."));
  }

  setProcessando(false);
}

async function baixarImagem(url) {
  await baixarImagemUtil(url);
}


function alternarSelecionada(id) {
  setSelecionadas((atual) =>
    atual.includes(id)
      ? atual.filter((item) => item !== id)
      : [...atual, id]
  );
}
async function excluirSelecionadas() {
  if (selecionadas.length === 0) return;

  const confirmar = confirm(
    `Deseja excluir ${selecionadas.length} imagem(ns) selecionada(s)?`
  );

  if (!confirmar) return;

  const { error } = await supabase
    .from("processamentos")
    .delete()
    .in("created_at", selecionadas);

  if (error) {
    alert("Erro ao excluir selecionadas: " + error.message);
    return;
  }

  setSelecionadas([]);
  await carregarGaleria();
}
async function baixarSelecionadas() {
  if (selecionadas.length === 0) return;

  setBaixandoLote(true);

  try {
    const imagens = galeria.filter((item) =>
      selecionadas.includes(item.created_at)
    );

    for (const item of imagens) {
      const link = document.createElement("a");

      link.href = item.imagem_processada || item.imagem_original;
      link.download = `imagem-${item.created_at}.jpg`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } finally {
    setBaixandoLote(false);
  }
}
async function excluirImagem(item) {
  if (!confirm("Deseja realmente excluir esta imagem?")) return;

  console.log("ITEM PARA EXCLUIR:", item);

  const { error } = await supabase
    .from("processamentos")
    .delete()
    .eq("created_at", item.created_at)
    .eq("user_id", usuario.id);

  if (error) {
    console.log("ERRO EXCLUIR:", error);
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
    setStatusProcesso("");
  }

async function processarBannerIA() {
  if (!usuario) {
  mostrarNotificacao("Faça login primeiro");
    setScreen("login");
    return;
  }

  if (!imagemBanner) {
mostrarNotificacao("📸 Escolha uma imagem primeiro");    return;
  }

  setProcessando(true);
  setStatusProcesso("🎨 Gerando banner com IA...");

  try {
    const imagemEnviada = imagemBanner;

    const resposta = await fetch(
API_PROCESSAR_IMAGEM,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
   body: JSON.stringify({
  imageUrl: imagemEnviada,
  tipo: "banner",
  modelo: bannerModelo,
  categoria: categoriaBanner,
  estilo: estiloBanner,
  tamanho: tamanhoBanner,
  fundo: fundoBanner,
  modeloPremium: modeloPremiumBanner,
}),
      }
    );

    const dados = await resposta.json();

    console.log("RESPOSTA BANNER IA:", dados);

    if (!dados.imagem_processada) {
      console.log("ERRO BANNER COMPLETO:", dados);
      alert(dados.erro || JSON.stringify(dados));
      setProcessando(false);
      return;
    }

    setResultadoIA(dados.imagem_processada);

    const { error: erroSalvar } = await supabase
      .from("processamentos")
      .insert([
        {
          user_id: usuario.id,
          imagem_original: imagemEnviada,
          imagem_processada: dados.imagem_processada,
          status: "finalizado",
          tipo: "banner",
          modelo_banner: bannerModelo,
        },
      ]);

    if (erroSalvar) {
      console.log("ERRO AO SALVAR BANNER:", erroSalvar);
      alert("Banner processou, mas não salvou na galeria.");
      setProcessando(false);
      return;
    }

    await carregarDashboard();
    await carregarGaleria();

    setStatusProcesso("✅ Banner gerado e salvo!");
    setProcessando(false);
  } catch (erro) {
    console.log("ERRO AO GERAR BANNER:", erro);
    alert(erro?.message || JSON.stringify(erro) || "Erro ao gerar banner.");
    setProcessando(false);
  }
}

console.log(
  projetosAndamento,
  projetosConcluidos,
  projetosPausados
);

const dadosProjetos = [
  { name: "Em andamento", value: projetosAndamento },
  { name: "Concluídos", value: projetosConcluidos },
  { name: "Pausados", value: projetosPausados },
];

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b"];

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
async function atualizarProjeto() {
  if (!editandoProjeto) {
    alert("Nenhum projeto selecionado");
    return;
  }

  const { error } = await editarProjeto(
    supabase,
    editandoProjeto,
    {
      nome: nomeProjeto,
      descricao: descricaoProjeto,
      status: novoStatus || statusProjeto,
    }
  );

  if (error) {
    alert(error.message);
    return;
  }

  setEditandoProjeto(null);
  setNomeProjeto("");
  setDescricaoProjeto("");
  setArquivoProjeto(null);
  setStatusProjeto("Em andamento");
  setNovoStatus("");

  await carregarProjetos();
  await carregarDashboard();

  alert("Projeto atualizado!");
}
async function excluirProjeto(id) {
  const confirmar = window.confirm(
    "Deseja realmente excluir este projeto?"
  );

  if (!confirmar) return;

  const { error } = await removerProjeto(supabase, id);

  if (error) {
    alert(error.message);
    return;
  }

  await carregarProjetos();
  await carregarDashboard();

  alert("Projeto excluído!");
}
async function enviarImagem(arquivoSelecionado = arquivo) {
  if (!usuario) {
    alert("Faça login primeiro");
    setScreen("login");
    return null;
  }

 if (!arquivoSelecionado) {
  mostrarNotificacao("📸 Escolha uma imagem primeiro");
  return null;
}

  setStatusProcesso("⬆️ Enviando imagem...");

  const nomeArquivo = `${usuario.id}/${Date.now()}-${arquivoSelecionado.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.]/g, "-")}`;

  const { error } = await supabase.storage
    .from("imagens")
    .upload(nomeArquivo, arquivoSelecionado, { upsert: true });

  if (error) {
    alert(error.message);
    return null;
  }

  const { data } = supabase.storage
    .from("imagens")
    .getPublicUrl(nomeArquivo);

  setUrlPublica(data.publicUrl);
  setStatusProcesso("✅ Imagem enviada.");

  return data.publicUrl;
}
function mostrarNotificacao(texto) {
  setNotificacao(texto);

  setTimeout(() => {
    setNotificacao("");
  }, 3000);
}
console.log("CHEGOU NO RETURN DO APP");
// =====================================================
// LAYOUT PRINCIPAL
// Cabeçalho e Menu Principal
// As telas serão renderizadas abaixo conforme o screen.
// =====================================================
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "white",
padding: "20px 40px",
        textAlign: "center",
        fontFamily: "Arial",
      }}
    >
    <h1 style={{ color: "#fff" }}>TESTE APPIA</h1>
<img
  src={logoAppia}
  alt="APPIA AI"
  style={{
    width: "320px",
    marginTop: "10px",
    marginBottom: "-40px",
  }}
/>
<p
  style={{
    color: "#93c5fd",
    fontSize: "22px",
    marginBottom: "20px",
    fontWeight: "500",
  }}
>
  Criação inteligente de imagens, banners e conteúdo digital
</p>

<p
  style={{
    color: "#93c5fd",
    fontSize: "18px",
    marginBottom: "15px",
  }}
>
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
  onClick={() => setScreen("novoAnuncio")}
  style={buttonGreen}
>
  📦 Novo Anúncio
</button>


<button onClick={() => setScreen("foto")}>
  📸 Fotos IA
</button>
<button onClick={() => setScreen("banner")}>
  🎨 Banner IA
</button>
  <button onClick={() => setScreen("galeria")}>🖼 Galeria</button>
  <button onClick={() => setScreen("atendimento")}>💬 Atendimento IA</button>
  <button onClick={() => setScreen("clipIA")}>🎬 Clip IA</button>
<button onClick={() => setScreen("pesquisa")}>
  🧠 Central de Pesquisa
</button>
{/*
<button onClick={() => setScreen("fabricantes")}>
  🏭 Fabricantes
</button>

<button onClick={() => setScreen("catalogo")}>
  🧠 Central de Pesquisa
</button>
*/}

  <button
    onClick={() => setScreen("projetos")}
    style={{
      background: "#2563eb",
      color: "white",
      fontWeight: "bold",
      padding: "10px 18px",
      borderRadius: "8px",
      border: "none",
      cursor: "pointer",
    }}
  >
    📦 Projetos
  </button>

  <button onClick={() => setScreen("admin")}>⚙️ Administrador</button>

  {!usuario ? (
    <button onClick={() => setScreen("login")}>Login</button>
  ) : (
    <button onClick={sairUsuario}>Sair</button>
  )}
</div>

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
  />
)}
{screen === "home" && (
  <div style={cardStyle}>
    <h1>✅ APPIA abriu</h1>
    <p>Tela home em teste.</p>
  </div>
)}


{screen === "banner" && (
  <BannerIA
    galeria={galeria}
    imagemBanner={imagemBanner}
    setImagemBanner={setImagemBanner}
    bannerModelo={bannerModelo}
    setBannerModelo={setBannerModelo}
    categoriaBanner={categoriaBanner}
    setCategoriaBanner={setCategoriaBanner}
    estiloBanner={estiloBanner}
    setEstiloBanner={setEstiloBanner}
    tamanhoBanner={tamanhoBanner}
    setTamanhoBanner={setTamanhoBanner}
    fundoBanner={fundoBanner}
    setFundoBanner={setFundoBanner}
    modeloPremiumBanner={modeloPremiumBanner}
    setModeloPremiumBanner={setModeloPremiumBanner}
    processarBannerIA={processarBannerIA}
    processando={processando}
    resultadoIA={resultadoIA}
    baixarImagem={baixarImagem}
  />
)}
{(screen === "baseConhecimento" || screen === "catalogo") && (
  <div style={{ marginTop: "40px" }}>
    <ImportadorCatalogo />
  </div>
)}
{screen === "centroConhecimento" && (
  <CentroConhecimento setScreen={setScreen} />
)}
{screen === "fabricantes" && (
  <div style={{ marginTop: "40px" }}>
    <FabricantesAdmin />
  </div>
)}
{screen === "dashboardAppia" && (
  <DashboardAppia setScreen={setScreen} />
)}
{screen === "equivalencias" && (
  <div style={{ marginTop: "40px" }}>
    <EquivalenciasAdmin />
  </div>
)}
{screen === "clipIA" && <ClipIA cardStyle={cardStyle} />}
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
    🤖 APPIA Copilot
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
🤖 APPIA Think analisou sua mensagem
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
      🤖 APPIA Copilot
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
  <FotoIA
    categoriaFoto={categoriaFoto}
    setCategoriaFoto={setCategoriaFoto}
    arquivosFotos={arquivosFotos}
    setArquivosFotos={setArquivosFotos}
    setArquivo={setArquivo}
    setPreview={setPreview}
    setUrlPublica={setUrlPublica}
    setResultadoIA={setResultadoIA}
    setStatusProcesso={setStatusProcesso}
    tipoFundoFoto={tipoFundoFoto}
    setTipoFundoFoto={setTipoFundoFoto}
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
  />
)}

{screen === "galeria" && (
  <Galeria
    galeria={galeria}
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
    setScreen={setScreen}
    setFotosAnuncio={setFotosAnuncio}
    cardStyle={cardStyle}
  />
)}
{screen === "projetos" && (
  <Projetos
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
    atualizarProjeto={atualizarProjeto}
    excluirProjeto={excluirProjeto}
    buscaProjeto={buscaProjeto}
    setBuscaProjeto={setBuscaProjeto}
    cardStyle={cardStyle}
    buttonGreen={buttonGreen}
    buttonBlue={buttonBlue}
    buttonRed={buttonRed}
  />
)}

{screen === "admin" && (
  <Admin totalFotos={totalFotos} cardStyle={cardStyle} />
)}

{screen === "copilot" && (
  <Copilot
    cardStyle={cardStyle}
    setScreen={setScreen}
    setProdutoCopilot={setProdutoCopilot}
  />
)}

{screen === "novoAnuncio" && (
  <NovoAnuncio
    cardStyle={cardStyle}
    setScreen={setScreen}
    fotosAnuncio={fotosAnuncio}
    setFotosAnuncio={setFotosAnuncio}
  />
)}

{screen === "pesquisa" && (
  <CentralPesquisa cardStyle={cardStyle} />
)}
<Footer />
    </div>
  );
}