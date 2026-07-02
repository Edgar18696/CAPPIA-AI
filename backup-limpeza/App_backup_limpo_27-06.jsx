import { useEffect, useState } from "react";
import { supabase, supabaseKey } from "./supabase";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import logoAppia from "./assets/logo-appia-ai.png";


export default function App() {
  console.log("APPIA APP CARREGOU");
const [statusSistema, setStatusSistema] = useState("🟢 IA Online");
const [screen, setScreen] = useState("home");
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
const [tempoSessao] = useState(
  new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })
);

const [ultimaPergunta, setUltimaPergunta] = useState("");
function mostrarNotificacao(texto) {
  setNotificacao(texto);

  setTimeout(() => {
    setNotificacao("");
  }, 3000);
}

const gerarRespostaIA = async () => {
  if (!textoAtendimento || !textoAtendimento.trim()) {
    mostrarNotificacao("Digite uma mensagem primeiro");
    return;
  }

  setCarregandoAtendimento(true);
  setStatusSistema("🟡 Processando...");
  setStatusIA("🔍 Enviando para a IA...");
  setRespostaAtendimento("");
  setUltimaPergunta(textoAtendimento);

  try {
const respostaApi = await fetch(
  "https://arqzpqkkpwikyecdbopf.supabase.co/functions/v1/atendimento-ia",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
body: JSON.stringify({
  mensagem: textoAtendimento,
}),
  }
);

const data = await respostaApi.json();

console.log("STATUS:", respostaApi.status);
console.log("DATA:", data);

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
  if (usuario) {
    carregarDashboard();
    carregarGaleria();
    carregarProjetos();
  }
}, [usuario]);
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

  const { data, count, error } = await supabase
    .from("projetos")
    .select("*", { count: "exact" })
    .eq("user_id", usuario.id)
.order("criado_em", { ascending: false });
  if (error) {
    console.log("ERRO CARREGAR PROJETOS:", error);
    return;
  }

  const lista = data || [];

  setProjetos(lista);
  setTotalProjetos(count || 0);
  setUltimosProjetos(lista.slice(0, 5));

  setProjetosAndamento(
    lista.filter((p) =>
      (p.status || "").trim().toLowerCase() === "em andamento"
    ).length
  );

  setProjetosConcluidos(
    lista.filter((p) =>
      (p.status || "").trim().toLowerCase() === "concluído" ||
      (p.status || "").trim().toLowerCase() === "concluido"
    ).length
  );

  setProjetosPausados(
    lista.filter((p) =>
      (p.status || "").trim().toLowerCase() === "pausado"
    ).length
  );
}
async function atualizarProjeto() {
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
  if (!usuario) return;

  const { data, error } = await supabase
    .from("processamentos")
    .select("*")
    .eq("user_id", usuario.id)
    .eq("tipo", "foto")
    .not("imagem_processada", "is", null)
    .order("created_at", { ascending: false });

  console.log("GALERIA:", data);
  console.log("TOTAL GALERIA:", data?.length);
  console.log("ERRO GALERIA:", error);

  if (error) {
    console.log(error);
    return;
  }

  setGaleria(data || []);
  const lista = data || [];

setTotalFotosIA(
  lista.filter((item) => item.tipo === "foto").length
);

setTotalBannersIA(
  lista.filter((item) => item.tipo === "banner").length
);

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
  setStatusProcesso(`✅ ${selecionadas.length} fotos processadas com sucesso! Confira na Galeria.`);

  setTimeout(() => {
    setScreen("galeria");
  }, 1500);
}

async function processarIA(urlImagem = urlPublica) {
  if (!usuario) {
mostrarNotificacao("🔐 Faça login primeiro");
    return;
  }

  if (!urlImagem) {
mostrarNotificacao("📸 Envie uma imagem primeiro");
  }

  setProcessando(true);
  setStatusProcesso("🤖 Processando imagem com IA...");

  try {
const respostaApi = await fetch(
  "https://arqzpqkkpwikyecdbopf.supabase.co/functions/v1/atendimento-ia",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
body: JSON.stringify({
  mensagem: textoAtendimento,
  especialista: especialistaAtendimento || "auto",
  historico: historicoAtendimento.slice(0, 10),
}),
  }
);

const data = await respostaApi.json();

console.log("STATUS:", respostaApi.status);
console.log("DATA:", data);

const resposta =
  data?.resposta ||
  data?.error ||
  data?.detalhes ||
  JSON.stringify(data, null, 2) ||
  "Não consegui gerar uma resposta.";



  

    setResultadoIA(dados.imagem_processada);
    setStatusProcesso("💾 Salvando resultado na galeria...");

    const { error } = await supabase.from("processamentos").insert([
  {
    imagem_original: urlImagem,
    imagem_processada: dados.imagem_processada,
    status: "processado",
    user_id: usuario.id,
    tipo: "foto",
  },
]);

    if (error) {
      console.log("ERRO AO SALVAR GALERIA:", error);
      setStatusProcesso("❌ Processou, mas não salvou na galeria.");
      setProcessando(false);
      return;
    }

    await carregarGaleria();
    await carregarDashboard();

    setStatusProcesso("✅ Imagem processada e salva!");
  } catch (erro) {
    console.log("ERRO PROCESSAR IA:", erro);
    setStatusProcesso("❌ Erro ao processar imagem.");
  }

  setProcessando(false);
}

  async function baixarImagem(url) {
    const resposta = await fetch(url);
    const blob = await resposta.blob();

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `appia-ai-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
const modelosPremiumBanner = [
  {
    id: "premium",
    icone: "⭐",
    nome: "Premium",
    descricao: "Visual elegante para qualquer produto",
  },

  {
    id: "clean",
    icone: "✨",
    nome: "Clean",
    descricao: "Minimalista e moderno",
  },

  {
    id: "luxo",
    icone: "👑",
    nome: "Luxo",
    descricao: "Acabamento sofisticado",
  },

  {
    id: "moderno",
    icone: "🚀",
    nome: "Moderno",
    descricao: "Tecnologia e inovação",
  },

  {
    id: "oferta",
    icone: "🔥",
    nome: "Oferta",
    descricao: "Ideal para promoções",
  },

  {
    id: "instagram",
    icone: "📱",
    nome: "Instagram",
    descricao: "Perfeito para redes sociais",
  },

  {
    id: "marketplace",
    icone: "🛒",
    nome: "Marketplace",
    descricao: "Mercado Livre e Shopee",
  },

  {
    id: "black",
    icone: "⚫",
    nome: "Black Edition",
    descricao: "Visual premium escuro",
  },
];

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
.in("created_at", selecionadas)
  if (error) {
    alert("Erro ao excluir selecionadas: " + error.message);
    return;
  }

  setGaleria((atual) =>
    atual.filter((item) => !selecionadas.includes(item.id))
  );

  setSelecionadas([]);
  setTotalImagens((atual) => atual - selecionadas.length);
}
async function baixarSelecionadas() {
  if (selecionadas.length === 0) return;

  setBaixandoLote(true);

  const imagens = galeria.filter((item) =>
    selecionadas.includes(item.created_at)
  );

  for (const item of imagens) {
    const link = document.createElement("a");

    link.href =
      item.imagem_processada || item.imagem_original;

    link.download = `imagem-${item.created_at}.jpg`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    await new Promise((resolve) =>
      setTimeout(resolve, 500)
    );
  }

  setBaixandoLote(false);
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
const cardStyle = {
  background: "#0f172a",
  color: "white",
  border: "1px solid #2563eb",
  borderRadius: "12px",
  padding: "14px",
  cursor: "pointer",
  fontWeight: "bold",
};

  const buttonBlue = {
    padding: "12px 18px",
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "bold",
  };

  const buttonGreen = {
    padding: "12px 18px",
    background: "#22c55e",
    color: "white",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "bold",
  };

  const buttonRed = {
    padding: "12px 18px",
    background: "#dc2626",
    color: "white",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "bold",
  };
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
      "https://arqzpqkkpwikyecdbopf.supabase.co/functions/v1/processar-imagem",
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
  console.log("NOME:", nomeProjeto);
console.log("DESCRIÇÃO:", descricaoProjeto);
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

  const { error } = await supabase.from("projetos").insert([
    {
      user_id: usuario.id,
      nome: nomeProjeto,
      descricao: descricaoProjeto,
imagem: imagemUrl,
      status: statusProjeto,
    },
  ]);

  if (error) {
    alert(error.message);
    return;
  }

  setNomeProjeto("");
  setDescricaoProjeto("");
  setArquivoProjeto(null);
  setStatusProjeto("Em andamento");
  setNovoStatus("");
  setEditandoProjeto(null);

  await carregarProjetos();
  await carregarDashboard();

  alert("Projeto criado com sucesso!");
}

async function atualizarProjeto() {
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
  setArquivoProjeto(null);
  setStatusProjeto("Em andamento");
  setNovoStatus("");

  await carregarProjetos();
  await carregarDashboard();

  alert("Projeto atualizado!");
}

async function excluirProjeto(id) {
  const confirmar = window.confirm("Deseja realmente excluir este projeto?");

  if (!confirmar) return;

  const { error } = await supabase
    .from("projetos")
    .delete()
    .eq("id", id);

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
  <button onClick={() => setScreen("home")}>🏠 Home</button>
  <button onClick={() => setScreen("foto")}>📸 Fotos IA</button>
  <button onClick={() => setScreen("banner")}>🎨 Banner IA</button>
  <button onClick={() => setScreen("galeria")}>🖼 Galeria</button>
 <button onClick={() => setScreen("atendimento")}>💬 Atendimento IA</button>
  <button onClick={() => setScreen("clipIA")}>🎬 Clip IA</button>

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
  <div style={{ ...cardStyle, maxWidth: "450px", margin: "50px auto" }}>
    <h2>🔐 Login APPIA AI</h2>

    <input
      placeholder="E-mail"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      style={{ width: "90%", padding: "12px", marginTop: "15px" }}
    />

    <input
      type="password"
      placeholder="Senha"
      value={senha}
      onChange={(e) => setSenha(e.target.value)}
      style={{ width: "90%", padding: "12px", marginTop: "15px" }}
    />

    <br />

    <button onClick={entrarUsuario} style={{ marginTop: "20px", padding: "12px" }}>
      Entrar
    </button>

    <button onClick={cadastrarUsuario} style={{ marginLeft: "10px", padding: "12px" }}>
      Criar Conta
    </button>
  </div>
)}

{screen === "home" && (
  <div style={{ marginTop: "50px" }}>
    <h1
  style={{
    fontSize: "42px",
    fontWeight: "bold",
    color: "#38bdf8",
    textAlign: "center",
    marginBottom: "10px",
    textShadow: "0 0 20px rgba(56,189,248,0.4)",
  }}
>
  🚀 Plataforma Inteligente
  </h1>
  <div
  style={{
    background: "#0f172a",
    border: "1px solid #1e40af",
    borderRadius: "16px",
    padding: "20px",
    marginTop: "20px",
    marginBottom: "20px",
  }}
>
  <h2 style={{ color: "#38bdf8" }}>
    Bem-vindo ao APPIA AI 🚀
  </h2>

  <p style={{ color: "#cbd5e1" }}>
Transforme produtos em imagens profissionais,
banners de alta conversão e vídeos automáticos
utilizando Inteligência Artificial.
  </p>

  <p style={{ color: "#22c55e", marginTop: "10px" }}>
    ✅ Sistema Online
  </p>
  <div
  style={{
    marginTop: "20px",
    display: "flex",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "10px",
  }}
>
  <span style={{ color: "#22c55e" }}>🟢 IA Online</span>

  <span style={{ color: "#38bdf8" }}>
    ☁ Supabase Online
  </span>

  <span style={{ color: "#facc15" }}>
    ⚡ API Ativa
  </span>

  <span style={{ color: "#ffffff" }}>
    🚀 v1.0 RC1
  </span>
</div>
</div>
<p
  style={{
    color: "#94a3b8",
    textAlign: "center",
    fontSize: "22px",
    marginBottom: "40px",
  }}
>
  Plataforma Inteligente para Fotos, Banners e Videos
</p>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4,1fr)",
        gap: "20px",
      }}
    >
      <div style={cardStyle}>
        <h3>📸 Fotos IA</h3>
        <h1>{totalFotos}</h1>
      </div>

      <div style={cardStyle}>
        <h3>🎨 Banners</h3>
        <h1>{totalBanners}</h1>
      </div>

      <div style={cardStyle}>
        <h3>📦 Projetos</h3>
        <h1>{totalProjetos}</h1>
      </div>

      <div style={cardStyle}>
        <h3>🎬 Vídeos</h3>
        <h1>{totalVideos}</h1>
      </div>
    </div>
    <div
  style={{
    marginTop: "30px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: "20px",
  }}
>
  <div style={cardStyle}>
    <div style={cardStyle}>
  <h3>⚡ Processamentos</h3>
  <h1>{totalProcessamentos}</h1>
</div>
<div style={cardStyle}>
  <h3>📅 Hoje</h3>
  <h1>{totalHoje}</h1>
</div>

<div style={cardStyle}>
  <h3>📈 Últimos 7 dias</h3>
  <h1>{totalSemana}</h1>
</div>
<div style={cardStyle}>
  <h3>📸 Fotos IA</h3>
  <h1>{totalFotos}</h1>
</div>

<div style={cardStyle}>
  <h3>🎨 Banners IA</h3>
  <h1>{totalBanners}</h1>
</div>

<div style={cardStyle}>
  <h3>🎬 Vídeos IA</h3>
  <h1>{totalVideos}</h1>
</div>

<div style={cardStyle}>
  <h3>📦 Projetos</h3>
  <h1>{totalProjetos}</h1>
</div>
<div style={cardStyle}>
  <h3>🖼 Galeria</h3>
  <h1>{galeria.length}</h1>
</div>
<div
  style={{
    background: "#0f172a",
    border: "1px solid #1e40af",
    borderRadius: "15px",
    padding: "20px",
    marginTop: "20px",
  }}
>
  <h3 style={{ color: "#38bdf8" }}>
    🤖 Status do Sistema
  </h3>

  <p style={{ color: "#22c55e" }}>
    🟢 IA Online
  </p>

  <p style={{ color: "white" }}>
    📸 Fotos IA: {totalFotos}
  </p>

  <p style={{ color: "white" }}>
    🎨 Banners IA: {totalBanners}
  </p>

  <p style={{ color: "white" }}>
    📦 Projetos: {totalProjetos}
  </p>

  <p style={{ color: "white" }}>
    🎬 Vídeos: {totalVideos}
  </p>
</div>
<div
  style={{
    marginTop: "35px",
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "16px",
    padding: "25px",
  }}
>
  <h2 style={{ color: "#38bdf8", marginBottom: "20px" }}>
    🧠 Status do APPIA AI
  </h2>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
      gap: "20px",
    }}
  >
        <div style={cardStyle}>
      <h3>🤖 IA</h3>
      <h2 style={{ color: "#22c55e" }}>Online</h2>
    </div>
    

    <div style={cardStyle}>
      <h3>🖼 Galeria</h3>
      <h2>{galeria.length}</h2>
    </div>

    <div style={cardStyle}>
      <h3>👤 Usuário</h3>
      <h2>{usuario ? "Conectado" : "Offline"}</h2>
    </div>

    <div style={cardStyle}>
      <h3>⚡ Sistema</h3>
      <h2>Estável</h2>
    </div>
  </div>
</div>
<div
  style={{
    marginTop: "25px",
    background: "linear-gradient(180deg, #0f172a 0%, #020617 100%)",
    border: "1px solid #2563eb",
    borderRadius: "18px",
    padding: "22px",
    textAlign: "left",
    color: "white",
    boxShadow: "0 15px 40px rgba(37,99,235,0.18)",
  }}
>
  <h3 style={{ color: "#38bdf8", marginBottom: "10px" }}>
    🚀 Resumo da Plataforma
  </h3>

  <p style={{ color: "#cbd5e1", lineHeight: "1.8" }}>
    📸 Fotos IA: <strong>{totalFotos}</strong> &nbsp; | &nbsp;
    🎨 Banners IA: <strong>{totalBanners}</strong> &nbsp; | &nbsp;
    🎬 Vídeos IA: <strong>{totalVideos}</strong> &nbsp; | &nbsp;
    📦 Projetos: <strong>{totalProjetos}</strong>
  </p>

  <p
    style={{
      color: "#22c55e",
      marginTop: "15px",
      fontWeight: "bold",
    }}
  >
    ✅ Todos os serviços funcionando normalmente
  </p>
</div>
<div
  style={{
    marginTop: "25px",
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "16px",
    padding: "25px",
    textAlign: "left",
  }}
>
  <h2 style={{ color: "#38bdf8", marginBottom: "20px" }}>
    🕒 Última Atividade
  </h2>

  {galeria.length > 0 ? (
    <div>
      <p>
        <strong>Tipo:</strong>{" "}
        {galeria[0].tipo === "banner"
          ? "🎨 Banner IA"
          : "📸 Foto IA"}
      </p>
      
      <div
  style={{
    background: "#0f172a",
    border: "1px solid #2563eb",
    borderRadius: "14px",
    padding: "18px",
    marginTop: "20px",
    marginBottom: "25px",
  }}
>
  <h3 style={{ color: "#38bdf8" }}>
    💡 Dica do APPIA
  </h3>

  <p style={{ color: "#cbd5e1", lineHeight: "1.7" }}>
    Escolha primeiro o estilo do banner.
    Depois selecione o fundo.
    Por último clique em
    <strong> Gerar Banner IA.</strong>
  </p>
</div>
<div
  style={{
    marginTop: "20px",
    marginBottom: "25px",
    background: "#0f172a",
    border: "1px solid #2563eb",
    borderRadius: "16px",
    padding: "20px",
  }}
>
  <h3 style={{ color: "#38bdf8", textAlign: "center" }}>
    🎨 Templates Rápidos
  </h3>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
      gap: "12px",
      marginTop: "18px",
    }}
  >
    <button onClick={() => setModeloPremiumBanner("marketplace")}>
      🛒 Marketplace
    </button>

    <button onClick={() => setModeloPremiumBanner("instagram")}>
      📱 Instagram
    </button>

    <button onClick={() => setModeloPremiumBanner("oferta")}>
      🔥 Oferta
    </button>

    <button onClick={() => setModeloPremiumBanner("black")}>
      ⚫ Black Edition
    </button>
  </div>
</div>


      <p>
        <strong>Data:</strong>{" "}
        {new Date(
          galeria[0].created_at
        ).toLocaleString("pt-BR")}
      </p>

      <p
        style={{
          color: "#22c55e",
          fontWeight: "bold",
        }}
      >
        ✅ Processado com sucesso
      </p>
    </div>
  ) : (
    <p style={{ color: "#94a3b8" }}>
      Nenhuma atividade encontrada.
    </p>
  )}
</div>
<div
  style={{
    marginTop: "35px",
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "16px",
    padding: "25px",
    textAlign: "left",
  }}
>
  {/*
  <h2
    style={{
      color: "#38bdf8",
      marginBottom: "20px",
      textAlign: "center",
    }}
  >
    🕒 Últimos Processamentos
  </h2>
  */}
<div
  style={{
    marginTop: "30px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
    gap: "20px",
  }}
>
  <div
    style={{
      background: "#0f172a",
      border: "1px solid #1e293b",
      borderRadius: "15px",
      padding: "20px",
    }}
  >
    <h3 style={{ color: "#38bdf8" }}>
      📸 Última Foto IA
    </h3>

    <p>
      {galeria.find((x) => x.tipo === "foto")
        ? new Date(
            galeria.find((x) => x.tipo === "foto").created_at
          ).toLocaleString("pt-BR")
        : "Nenhuma"}
    </p>
  </div>

  <div
    style={{
      background: "#0f172a",
      border: "1px solid #1e293b",
      borderRadius: "15px",
      padding: "20px",
    }}
  >
    <h3 style={{ color: "#38bdf8" }}>
      🎨 Último Banner
    </h3>

    <p>
      {galeria.find((x) => x.tipo === "banner")
        ? new Date(
            galeria.find((x) => x.tipo === "banner").created_at
          ).toLocaleString("pt-BR")
        : "Nenhum"}
    </p>
  </div>

  <div
    style={{
      background: "#0f172a",
      border: "1px solid #1e293b",
      borderRadius: "15px",
      padding: "20px",
    }}
  >
    <h3 style={{ color: "#38bdf8" }}>
      🤖 Status IA
    </h3>

    <p style={{ color: "#22c55e" }}>
      ✅ Online
    </p>
  </div>

  <div
    style={{
      background: "#0f172a",
      border: "1px solid #1e293b",
      borderRadius: "15px",
      padding: "20px",
    }}
  >
    <h3 style={{ color: "#38bdf8" }}>
      👤 Usuário
    </h3>

    <p>
      {usuario?.email || "Não identificado"}
    </p>
  </div>
</div>

  {galeria.slice(0, 5).map((item) => (
    <div
      key={item.created_at}
      style={{
        display: "grid",
        gridTemplateColumns: "80px 1fr 130px",
        gap: "15px",
        alignItems: "center",
        background: "#020617",
        border: "1px solid #1e293b",
        borderRadius: "12px",
        padding: "12px",
        marginBottom: "12px",
      }}
    >
      <img
        src={item.imagem_processada || item.imagem_original}
        alt=""
        style={{
          width: "70px",
          height: "70px",
          objectFit: "contain",
          background: "white",
          borderRadius: "8px",
        }}
      />

      <div>
        <strong>
          {item.tipo === "banner" ? "🎨 Banner IA" : "📸 Foto IA"}
        </strong>
        <p style={{ margin: "5px 0", color: "#94a3b8" }}>
          {new Date(item.created_at).toLocaleString("pt-BR")}
        </p>
      </div>

      <span
        style={{
          color: "#22c55e",
          fontWeight: "bold",
          textAlign: "right",
        }}
      >
        ✅ Processado
      </span>
    </div>
  ))}

  {galeria.length === 0 && (
    <p style={{ textAlign: "center", color: "#94a3b8" }}>
      Nenhum processamento encontrado.
    </p>
  )}
</div>

<div style={cardStyle}>
  <h3>🖼 Galeria</h3>
  <h1>{galeria.length}</h1>
</div>

<div style={cardStyle}>
  <h3>👤 Usuário</h3>
  <h1>{usuario ? "Online" : "Offline"}</h1>
</div>

<div style={cardStyle}>
  <h3>🤖 IA</h3>
  <h1>Ativa</h1>
</div>

    <h3>🔵 Em andamento</h3>
    <h1>{projetosAndamento}</h1>
  </div>

  <div style={cardStyle}>
    <h3>🟢 Concluídos</h3>
    <h1>{projetosConcluidos}</h1>
  </div>

  <div style={cardStyle}>
    <h3>🟡 Pausados</h3>
    <h1>{projetosPausados}</h1>
  </div>
</div>
<div
  style={{
    marginTop: "40px",
    ...cardStyle,
  }}
>
  <h2>📊 Status dos Projetos</h2>

  <div
    style={{
      width: "100%",
      height: "300px",
    }}
  >
    <ResponsiveContainer>
      <PieChart>
        <Pie
          data={dadosProjetos}
          cx="50%"
          cy="50%"
          outerRadius={100}
          dataKey="value"
          label
        >
          {dadosProjetos.map((entry, index) => (
            <Cell key={index} fill={COLORS[index]} />
          ))}
        </Pie>

        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  </div>
</div>
    <h2 style={{ marginTop: "50px" }}>🖼 Últimas Imagens</h2>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
        gap: "20px",
      }}
    >
      {ultimasImagens.map((item) => (
        <div key={item.created_at} style={cardStyle}>
       <img
  src={item.imagem_processada || item.imagem_original}
  alt=""
  onError={(e) => {
    e.currentTarget.style.display = "none";
  }}
  style={{
    width: "100%",
    height: "230px",
    objectFit: "contain",
    background: "white",
    borderRadius: "10px",
  }}
/>
        </div>
      ))}
    </div>

<h2 style={{ marginTop: "40px" }}>🎨 Últimos Banners</h2>

<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: "20px",
  }}
>
{ultimosBanners.map((item) => (
  <div key={item.created_at} style={cardStyle}>
    <img
      src={item.imagem_processada}
      alt=""
      style={{
        width: "100%",
        height: "220px",
        objectFit: "contain",
        background: "white",
        borderRadius: "10px",
      }}
    />
  </div>
))}
</div>

<h2 style={{ marginTop: "40px" }}>
  📦 Últimos Projetos
</h2>

<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
    gap: "20px",
    marginTop: "20px",
  }}
>
{ultimosProjetos.map((item) => (
  <div key={item.id} style={cardStyle}>
    {item.imagem && (
      <img
        src={item.imagem}
        alt=""
        style={{
          width: "100%",
          height: "160px",
          objectFit: "cover",
          borderRadius: "10px",
          marginBottom: "12px",
        }}
      />
    )}

    <h3>{item.nome}</h3>

    <p style={{ color: "#93c5fd" }}>
      {item.descricao}
    </p>

    <p
      style={{
        color: "#64748b",
        fontSize: "12px",
        marginTop: "8px",
      }}
    >
      📅 {new Date(item.created_at).toLocaleDateString("pt-BR")}
    </p>

    <p
      style={{
        color:
          item.status === "Concluído"
            ? "#22c55e"
            : item.status === "Pausado"
            ? "#f59e0b"
            : "#38bdf8",
        fontWeight: "bold",
      }}
    >
      📌 {item.status}
    </p>
  </div>
))}
</div>
</div>
)}
<div
  style={{
    marginTop: "40px",
    textAlign: "center",
    color: "#64748b",
    fontSize: "14px",
  }}
>
  APPIA AI v1.0 RC1 • Plataforma de Marketing Visual com IA
</div>

{screen === "banner" && (
 <div style={{ marginTop: "50px" }}>
  <h2>🎨 Banner IA</h2>

  <div
    style={{
      background: "#0f172a",
      border: "1px solid #2563eb",
      borderRadius: "14px",
      padding: "18px",
      marginTop: "20px",
      marginBottom: "25px",
    }}
  >
    <h3 style={{ color: "#38bdf8" }}>
      💡 Dica do APPIA
    </h3>

    <p style={{ color: "#cbd5e1", lineHeight: "1.7" }}>
      1️⃣ Escolha uma imagem da galeria.<br />
      2️⃣ Selecione o estilo do banner.<br />
      3️⃣ Escolha o fundo desejado.<br />
      4️⃣ Clique em <strong>Gerar Banner IA</strong>.
    </p>
  </div>

  <h3 style={{ color: "white", marginBottom: "10px" }}>
    Escolha uma imagem da galeria
  </h3>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(280px, 280px))",
      gap: "15px",
      marginTop: "20px",
      justifyContent: "center",
    }}
  >

      {galeria
        .filter((item) => item.tipo === "foto")
        .map((item) => (
          <img
            key={item.id}
            src={item.imagem_processada}
            alt=""
            onClick={() => setImagemBanner(item.imagem_processada)}
            style={{
              width: "100%",
              height: "120px",
              objectFit: "contain",
              background: "#fff",
              cursor: "pointer",
              border:
                imagemBanner === item.imagem_processada
                  ? "3px solid #22c55e"
                  : "2px solid #333",
              borderRadius: "10px",
            }}
          />
        ))}
    </div>

<h3 style={{ marginTop: "25px", color: "#38bdf8" }}>
  Escolha o estilo premium
</h3>

<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
    gap: "12px",
    marginTop: "15px",
    maxWidth: "900px",
    marginLeft: "auto",
    marginRight: "auto",
  }}
>
  {modelosPremiumBanner.map((modelo) => (
    <button
      key={modelo.id}
      onClick={() => setModeloPremiumBanner(modelo.id)}
    style={{
  background:
    modeloPremiumBanner === modelo.id
      ? "linear-gradient(135deg,#2563eb,#38bdf8)"
      : "#0f172a",

  color: "white",

  border:
    modeloPremiumBanner === modelo.id
      ? "2px solid #67e8f9"
      : "1px solid #334155",

  padding: "18px",

  borderRadius: "16px",

  cursor: "pointer",

  fontWeight: "bold",

  fontSize: "15px",

  transition: "all .25s ease",

  boxShadow:
    modeloPremiumBanner === modelo.id
      ? "0 0 20px rgba(56,189,248,.45)"
      : "0 0 0 rgba(0,0,0,0)",

  transform:
    modeloPremiumBanner === modelo.id
      ? "scale(1.04)"
      : "scale(1)",

  minHeight: "75px",
}}
    >
      <div
  style={{
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  }}
>
  <div style={{ fontSize: "28px" }}>
    {modelo.nome.split(" ")[0]}
  </div>

  <div style={{ fontSize: "14px", fontWeight: "bold" }}>
    {modelo.nome.replace(modelo.nome.split(" ")[0], "").trim()}
  </div>
</div>
    </button>
  ))}
</div>

<div
  style={{
    marginTop: "30px",
    background: "#020617",
    border: "2px solid #1e40af",
    borderRadius: "18px",
    padding: "25px",
    maxWidth: "900px",
    marginLeft: "auto",
    marginRight: "auto",
  }}
>
  <h2
    style={{
      color: "#38bdf8",
      marginBottom: "20px",
      textAlign: "center",
    }}
  >
    👀 Prévia do Banner
  </h2>
{/* PRÉVIA DO BANNER */}
{imagemBanner && (
  <div className="mt-8 bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
      
      {/* IMAGEM À ESQUERDA */}
      <div className="bg-slate-50 flex items-center justify-center p-6">
        <img
          src={imagemBanner}
          alt="Prévia do Banner"
          className="max-w-full max-h-[520px] rounded-2xl shadow-lg object-contain bg-white"
        />
      </div>

      {/* INFORMAÇÕES À DIREITA */}
      <div className="p-6 lg:p-8 flex flex-col justify-between">
        <div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 mb-4">
            Banner gerado com IA
          </span>

          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Prévia do Banner
          </h2>

          <p className="text-slate-500 mb-6">
            Confira o resultado gerado antes de baixar ou salvar na galeria.
          </p>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Modelo</span>
              <span className="font-semibold text-slate-800">
                {modeloBanner || "Premium"}
              </span>
            </div>

            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Categoria</span>
              <span className="font-semibold text-slate-800">
                {categoriaBanner || "Comercial"}
              </span>
            </div>

            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Estilo</span>
              <span className="font-semibold text-slate-800">
                {estiloBanner || "Profissional"}
              </span>
            </div>

            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Tamanho</span>
              <span className="font-semibold text-slate-800">
                {tamanhoBanner || "1200x1200"}
              </span>
            </div>
          </div>
        </div>

        {/* BOTÕES */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <a
            href={imagemBanner}
            download
            target="_blank"
            rel="noreferrer"
            className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-5 rounded-xl transition"
          >
            ⬇️ Baixar Banner
          </a>

          <button
            onClick={() => setImagemBanner(null)}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 px-5 rounded-xl transition"
          >
            Gerar outro
          </button>
        </div>
      </div>
    </div>
  </div>
)}
  <div
    style={{
      height: "320px",
     background:
  modeloPremiumBanner === "premium"
    ? "linear-gradient(135deg,#2563eb,#38bdf8)"
    : modeloPremiumBanner === "luxo"
    ? "linear-gradient(135deg,#111827,#374151)"
    : modeloPremiumBanner === "oferta"
    ? "linear-gradient(135deg,#dc2626,#f97316)"
    : modeloPremiumBanner === "instagram"
    ? "linear-gradient(135deg,#9333ea,#ec4899,#f59e0b)"
    : modeloPremiumBanner === "marketplace"
    ? "linear-gradient(135deg,#0f172a,#1d4ed8)"
    : modeloPremiumBanner === "black"
    ? "#020617"
    : "linear-gradient(135deg,#0f172a,#2563eb)",
      borderRadius: "14px",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "column",
      color: "white",
      transition: "all .35s ease",
overflow: "hidden",
position: "relative",
boxShadow:
  modeloPremiumBanner === "black"
    ? "0 0 30px rgba(255,255,255,.08)"
    : "0 0 30px rgba(56,189,248,.35)",
    }}
  >
    <div
  style={{
    position: "absolute",
    width: "220px",
    height: "220px",
    borderRadius: "50%",
    background:
      modeloPremiumBanner === "oferta"
        ? "#f97316"
        : modeloPremiumBanner === "instagram"
        ? "#ec4899"
        : "#38bdf8",
    filter: "blur(70px)",
    opacity: 0.35,
  }}
/>
  {imagemBanner ? (
      <img
    src={imagemBanner}
    alt=""
    style={{
      width: "180px",
      height: "180px",
      objectFit: "contain",
      background: "white",
      borderRadius: "12px",
      padding: "10px",
      boxShadow: "0 0 20px rgba(0,0,0,.25)",
      zIndex: 2,
position: "relative",
    }}
  />
) : (
  <div
    style={{
      fontSize: "65px",
    }}
  >
    🖼
  </div>
)}
<h4
  style={{
    color: "#e0f2fe",
    letterSpacing: "2px",
    textTransform: "uppercase",
    fontSize: "12px",
    marginBottom: "8px",
    zIndex: 2,
  }}
>
  Estilo Selecionado
</h4>
<div
  style={{
    background:
      modeloPremiumBanner === "oferta"
        ? "#facc15"
        : modeloPremiumBanner === "black"
        ? "#111827"
        : "#ffffff",
    color:
      modeloPremiumBanner === "oferta"
        ? "#000"
        : modeloPremiumBanner === "black"
        ? "#fff"
        : "#0f172a",
    padding: "8px 16px",
    borderRadius: "999px",
    fontWeight: "bold",
    fontSize: "13px",
    marginBottom: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,.25)",
    zIndex: 2,
  }}
>
  {modeloPremiumBanner === "oferta"
    ? "🔥 Oferta Especial"
    : modeloPremiumBanner === "instagram"
    ? "📱 Redes Sociais"
    : modeloPremiumBanner === "marketplace"
    ? "🛒 Marketplace"
    : modeloPremiumBanner === "black"
    ? "⚫ Black Edition"
    : modeloPremiumBanner === "luxo"
    ? "👑 Visual Luxo"
    : "⭐ Visual Premium"}
</div>
    <div
  style={{
    display: "flex",
    justifyContent: "center",
    marginTop: "20px",
  }}
>
  <button
    onClick={() => setModeloPremiumBanner("premium")}
    style={{
      background: "#1e40af",
      color: "white",
      border: "none",
      padding: "12px 22px",
      borderRadius: "10px",
      cursor: "pointer",
      fontWeight: "bold",
    }}
  >
    ↺ Voltar ao Premium
  </button>
</div>
    <h2
  style={{
    color:
      modeloPremiumBanner === "oferta"
        ? "#fef08a"
        : "white",
  }}
>
  {modelosPremiumBanner.find(
    (m) => m.id === modeloPremiumBanner
  )?.nome}
</h2>

<p
  style={{
    color:
      modeloPremiumBanner === "black"
        ? "#cbd5e1"
        : "#dbeafe",
    marginTop: "10px",
  }}
>
  {modelosPremiumBanner.find(
    (m) => m.id === modeloPremiumBanner
  )?.descricao}
</p>
  </div>
</div>


<select value={fundoBanner} onChange={(e) => setFundoBanner(e.target.value)} style={{ padding: "12px", margin: "10px" }}>
  <option value="automatico">Automático IA</option>
  <option value="branco">Branco</option>
  <option value="transparente">Transparente</option>
  <option value="azul_degrade">Azul degradê</option>
  <option value="escuro_premium">Escuro premium</option>
  <option value="colorido">Colorido</option>
</select>
<select
  value={tipoFundoFoto}
  onChange={(e) => setTipoFundoFoto(e.target.value)}
>
  <option value="branco">Fundo Branco</option>
  <option value="transparente">Fundo Transparente</option>
</select>

<select
  value={tamanhoFoto}
  onChange={(e) => setTamanhoFoto(e.target.value)}
>
  <option value="1200x1200">1200x1200</option>
  <option value="1600x1600">1600x1600</option>
  <option value="2000x2000">2000x2000</option>
</select>

    <br />

    <button
      onClick={processarBannerIA}
      disabled={processando}
      style={{
        marginTop: "20px",
        padding: "12px 20px",
      }}
    >
      {processando ? "⏳ Gerando..." : "🎨 Gerar Banner"}
    </button>

    {resultadoIA && (
      <img
        src={resultadoIA}
        alt=""
        style={{
          width: "100%",
          maxWidth: "600px",
          marginTop: "20px",
          borderRadius: "12px",
          background: "white",
        }}
      />
    )}
  </div>
)}
<button
  onClick={() => setResultadoIA(null)}
  style={{
    background: "#475569",
    color: "white",
    border: "none",
    padding: "10px 18px",
    borderRadius: "10px",
    cursor: "pointer",
    marginTop: "15px",
    fontWeight: "bold",
  }}
>
  🧹 Limpar resultado
</button>
{screen === "clipIA" && (
  <div style={{ marginTop: "50px" }}>
    <h2
  style={{
    marginBottom: "20px",
    color: "#38bdf8",
    textAlign: "center",
    fontSize: "36px",
    fontWeight: "bold",
  }}
>
  🎬 Clip IA
</h2>
<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: "20px",
    marginTop: "25px",
    marginBottom: "30px",
  }}
>
  <div style={cardStyle}>
    <h3>🎥 Resolução</h3>
    <h2>Full HD</h2>
  </div>

  <div style={cardStyle}>
    <h3>⚡ Render</h3>
    <h2>IA Premium</h2>
  </div>

  <div style={cardStyle}>
    <h3>⏱ Tempo</h3>
    <h2>5-20 s</h2>
  </div>

  <div style={cardStyle}>
    <h3>🎵 Áudio</h3>
    <h2>Opcional</h2>
  </div>
</div>
    <p style={{ color: "#93c5fd" }}>
      Transforme fotos e banners em vídeos automáticos.
    </p>

    <div
      style={{
        background: "#0f172a",
        padding: "25px",
        borderRadius: "15px",
        marginTop: "20px",
      }}
    >
      <h3>🚀 Em desenvolvimento</h3>
      <div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: "15px",
    marginTop: "20px",
  }}
>
  <div style={{
    background:"#111827",
    padding:"15px",
    borderRadius:"10px"
  }}>
    🎞️ Story 1080x1920
  </div>

  <div style={{
    background:"#111827",
    padding:"15px",
    borderRadius:"10px"
  }}>
    📱 Reels Instagram
  </div>

  <div style={{
    background:"#111827",
    padding:"15px",
    borderRadius:"10px"
  }}>
    🛒 Marketplace
  </div>

  <div style={{
    background:"#111827",
    padding:"15px",
    borderRadius:"10px"
  }}>
    📦 Shopee
  </div>
</div>

      <ul
        style={{
          textAlign: "left",
          maxWidth: "600px",
          margin: "20px auto",
          lineHeight: "2",
          color: "white",
        }}
      >
        <li>✅ Zoom automático</li>
        <li>✅ Movimento suave</li>
        <li>✅ Story 1080x1920</li>
        <li>✅ Reels Instagram</li>
        <li>✅ Mercado Livre</li>
        <li>✅ Shopee</li>
        <li>✅ WhatsApp Status</li>
        <li>✅ Música opcional</li>
        <li>✅ Logo da loja</li>
      </ul>
      <div
  style={{
    background: "#0f172a",
    border: "1px solid #2563eb",
    borderRadius: "12px",
    padding: "20px",
    marginTop: "25px",
    textAlign: "left",
    maxWidth: "700px",
    marginLeft: "auto",
    marginRight: "auto",
  }}
>
  <h3 style={{ color: "#38bdf8" }}>
    🚀 Próxima Versão
  </h3>
<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: "15px",
    marginTop: "20px",
    marginBottom: "20px",
  }}
>
  <div style={cardStyle}>
    <h3>🎬 Render</h3>
    <h2>IA Premium</h2>
  </div>

  <div style={cardStyle}>
    <h3>🖥 Qualidade</h3>
    <h2>Full HD</h2>
  </div>

  <div style={cardStyle}>
    <h3>⚡ Velocidade</h3>
    <h2>Alta</h2>
  </div>
</div>

  <p>• Upload direto da galeria</p>
  <p>• Efeito Zoom Cinemático</p>
  <p>• Movimento Inteligente</p>
  <p>• Música opcional</p>
  <p>• Logo da empresa</p>
  <p>• Exportação MP4 Full HD</p>
</div>
<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: "15px",
    marginTop: "25px",
    marginBottom: "25px",
  }}
>
  <div style={cardStyle}>
    <h3>⏱ Duração</h3>
    <select style={{ padding: "10px", borderRadius: "8px" }}>
      <option>5 segundos</option>
      <option>10 segundos</option>
      <option>15 segundos</option>
    </select>
  </div>

  <div style={cardStyle}>
    <h3>🎥 Movimento</h3>
    <select style={{ padding: "10px", borderRadius: "8px" }}>
      <option>Zoom suave</option>
      <option>Pan lateral</option>
      <option>Fade premium</option>
    </select>
  </div>

  <div style={cardStyle}>
    <h3>🎵 Música</h3>
    <select style={{ padding: "10px", borderRadius: "8px" }}>
      <option>Sem música</option>
      <option>Corporativa</option>
      <option>Promoção</option>
    </select>
  </div>
</div>
      <button
        disabled
        style={{
          background: "#2563eb",
          color: "white",
          border: "none",
          padding: "15px 25px",
          borderRadius: "10px",
          opacity: 0.6,
        }}
      >
        🎬 Gerar Clip IA 
        <p
  style={{
    color: "#94a3b8",
    fontSize: "13px",
    marginTop: "10px",
    textAlign: "center",
  }}
>
  🚧 Recurso em desenvolvimento. Disponível nas próximas versões.
</p>
      </button>
    </div>
  </div>
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
  <div style={{ marginTop: "50px" }}>
<h2
  style={{
    color: "#67e8f9",
    fontSize: "32px",
    marginBottom: "10px",
  }}
>
  📸 Foto Premium IA
</h2>


<p
  style={{
    color: "#94a3b8",
    marginBottom: "25px",
  }}
>
  Transforme até 8 fotos em imagens profissionais para marketplace.
</p>
<h3 style={{ color: "white" }}>
  Escolha até 8 fotos
</h3>
    <div style={{ ...cardStyle, maxWidth: "950px", margin: "30px auto" }}>
     <input
  type="file"
  multiple
  accept="image/*"

  onChange={(e) => {

    const files = Array.from(e.target.files);

    console.log("TOTAL DE FOTOS:", files.length);

    if (files.length === 0) return;

    if (files.length > 8) {
      alert("Máximo de 8 fotos por vez.");
      return;
    }

    setArquivo(files[0]);
    setPreview(URL.createObjectURL(files[0]));

    setArquivosFotos(
      files.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        selecionada: true,
      }))
    );

    setUrlPublica("");
    setResultadoIA("");
    setStatusProcesso("");
  }}
/>

{arquivosFotos.map((foto, index) => (
  <div
    key={index}
    style={{
      background: "#0f172a",
      border: "1px solid #2563eb",
      borderRadius: "12px",
      padding: "10px",
      textAlign: "center",
      width: "320px",
    }}
  >
<img
  src={foto.preview}
  alt=""
  style={{
    width: "220px",
    height: "120px",
    objectFit: "contain",
    background: "white",
    borderRadius: "8px",
  }}
/>


  </div>
))}
<div style={{ marginTop: "20px", textAlign: "center" }}>
<select
  value={tipoFundoFoto}
  onChange={(e) => setTipoFundoFoto(e.target.value)}
  style={{
    padding: "12px",
    borderRadius: "10px",
    background: "#0f172a",
    color: "white",
    border: "1px solid #2563eb",
    marginTop: "15px",
  }}
>
  <option value="branco">
    🎨 Fundo Branco
  </option>

  <option value="transparente">
    ✨ Fundo Transparente
  </option>
</select>

<button
  style={{
    ...buttonGreen,
    marginLeft: "15px",
  }}
  onClick={processarSelecionadas}
>
  ✨ Processar Selecionadas
</button>
</div>
      {statusProcesso && (
        <div
          style={{
            marginTop: "25px",
            padding: "15px",
            background: "#020617",
            border: "1px solid #38bdf8",
            borderRadius: "12px",
            color: "#bfdbfe",
            fontWeight: "bold",
          }}
        >
          {statusProcesso}
        </div>
      )}

      {preview && (
        <div style={{ marginTop: "30px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "30px",
              flexWrap: "wrap",
              alignItems: "flex-start",
            }}
          >
            <div>

              <img
                src={preview}
                alt=""
                style={{
                  width: "400px",
                  borderRadius: "10px",
                  background: "white",
                }}
              />
            </div>

            {resultadoIA && (
              <div>

                <img
                  src={resultadoIA}
                  alt=""
                  style={{
                    width: "400px",
                    borderRadius: "10px",
                    background: "white",
                  }}
                />
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: "25px",
              display: "flex",
              justifyContent: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            

            <button onClick={limparTelaFoto} disabled={processando} style={buttonRed}>
              🧹 Limpar
            </button>

            {resultadoIA && (
              <button onClick={() => baixarImagem(resultadoIA)} style={buttonGreen}>
                ⬇️ Baixar Resultado
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  </div>
)}

{screen === "galeria" && (
<div style={{ marginTop: "50px" }}>
  <h2>🖼 Galeria</h2>

  <div
    style={{
      background: "#0f172a",
      border: "1px solid #2563eb",
      borderRadius: "12px",
      padding: "12px",
      width: "320px",
      margin: "15px auto",
      color: "#93c5fd",
      fontWeight: "bold",
    }}
  >
    ☑ Selecionadas: {imagensSelecionadas.length}
  </div>

  <input
    type="text"
    placeholder="🔍 Buscar imagem..."
    value={buscaGaleria}
    onChange={(e) => setBuscaGaleria(e.target.value)}
    style={{
      padding: "12px",
      width: "300px",
      borderRadius: "8px",
      marginBottom: "20px",
    }}
  />

  <div
    style={{
      display: "flex",
      gap: "15px",
      justifyContent: "center",
      flexWrap: "wrap",
      marginBottom: "20px",
    }}
  >
  <div style={cardStyle}>
    📸 Fotos: {galeria.filter((x) => x.tipo === "foto").length}
  </div>

  <div style={cardStyle}>
    🎨 Banners: {galeria.filter((x) => x.tipo === "banner").length}
  </div>

  <div style={cardStyle}>
    🎬 Clips: {galeria.filter((x) => x.tipo === "clip").length}
  </div>
</div>

   <p style={{ color: "#93c5fd" }}>
  Total de imagens: {
    galeria.filter((item) =>
      filtroGaleria === "todos"
        ? true
        : item.tipo === filtroGaleria
    ).length
  }
</p>
<div style={{ marginBottom: "15px" }}>
  <button
    onClick={() =>
      setSelecionadas(
        galeria
          .filter((item) =>
            filtroGaleria === "todos"
              ? true
              : item.tipo === filtroGaleria
          )
          .map((item) => item.created_at)
      )
    }
    style={{
      background: "#2563eb",
      color: "white",
      padding: "10px 18px",
      borderRadius: "10px",
      border: "none",
      cursor: "pointer",
      marginRight: "10px",
      fontWeight: "bold",
    }}
  >
    ✅ Selecionar tudo
  </button>

  <button
    onClick={() => setSelecionadas([])}
    style={{
      background: "#475569",
      color: "white",
      padding: "10px 18px",
      borderRadius: "10px",
      border: "none",
      cursor: "pointer",
      fontWeight: "bold",
    }}
  >
    ❌ Desmarcar tudo
  </button>
</div>
{selecionadas.length > 0 && (
  <button
    onClick={excluirSelecionadas}
    style={{
      background: "#dc2626",
      color: "white",
      padding: "10px 18px",
      borderRadius: "10px",
      border: "none",
      cursor: "pointer",
      marginBottom: "20px",
      fontWeight: "bold",
    }}
  >
    🗑️ Excluir selecionadas ({selecionadas.length})
  </button>
)}
{selecionadas.length > 0 && (
  <button
    onClick={baixarSelecionadas}
    style={{
      background: "#16a34a",
      color: "white",
      padding: "10px 18px",
      borderRadius: "10px",
      border: "none",
      cursor: "pointer",
      marginLeft: "10px",
      marginBottom: "20px",
      fontWeight: "bold",
    }}
  >
    {baixandoLote
      ? "⏳ Baixando..."
      : `⬇️ Baixar selecionadas (${selecionadas.length})`}
  </button>
)}
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
        gap: "20px",
      }}
    >
{console.log(
  "GALERIA FILTRADA:",
  galeria.filter((item) =>
    filtroGaleria === "todos"
      ? true
      : item.tipo === filtroGaleria
  )
)}
      {galeria
  .filter((item) =>
    filtroGaleria === "todos"
      ? true
      : item.tipo === filtroGaleria
  )
  .map((item) => (
        <div key={item.id || item.created_at} style={cardStyle}>
          
      
  <a
  href={item.imagem_processada || item.imagem_original}
  target="_blank"
  rel="noreferrer"
  style={{ color: "yellow" }}
>
  Abrir imagem
</a>

<img
  src={item.imagem_processada || item.imagem_original}
  alt=""
  style={{
    width: "100%",
    height: "230px",
    objectFit: "contain",
    background: "#f1f5f9",
    borderRadius: "10px",
  }}
/>
<input
  type="checkbox"
  checked={selecionadas.includes(item.created_at)}
  onChange={() => alternarSelecionada(item.created_at)}
/>
          <button
            onClick={() => baixarImagem(item.imagem_processada || item.imagem_original)}
            style={{ ...buttonGreen, marginTop: "12px" }}
          >
            ⬇️ Baixar
          </button>

          <button
  onClick={() => excluirImagem(item)}
  style={{
    background: "#dc2626",
    color: "white",
    border: "none",
    padding: "10px 15px",
    borderRadius: "8px",
    cursor: "pointer",
    marginTop: "10px",
  }}
>
  🗑 Excluir
</button>
        </div>
      ))}
    </div>
  </div>
)}
<p style={{ color: "#93c5fd" }}>
  Total de imagens: {
    galeria.filter((item) =>
      filtroGaleria === "todos"
        ? true
        : item.tipo === filtroGaleria
    ).length
  }
</p>
{screen === "projetos" && (
  <div style={{ marginTop: "50px" }}>
    <h2>📦 Projetos</h2>

    <div style={{ ...cardStyle, maxWidth: "700px", margin: "20px auto" }}>
      {editandoProjeto && (
  <h3 style={{ color: "#f59e0b", marginBottom: "20px" }}>
    ✏️ Editando Projeto
  </h3>
)}


      <input
        placeholder="Nome do projeto"
        value={nomeProjeto}
        onChange={(e) => setNomeProjeto(e.target.value)}
        style={{
          width: "90%",
          padding: "12px",
          marginBottom: "10px",
        }}
      />

      <textarea
        placeholder="Descrição"
        value={descricaoProjeto}
        onChange={(e) => setDescricaoProjeto(e.target.value)}
        style={{
          width: "90%",
          padding: "12px",
          height: "120px",
          marginBottom: "10px",
        }}
      />
<select
  value={
    editandoProjeto
      ? novoStatus
      : statusProjeto
  }
  onChange={(e) => {
    if (editandoProjeto) {
      setNovoStatus(e.target.value);
    } else {
      setStatusProjeto(e.target.value);
    }
  }}
  style={{
    width: "90%",
    padding: "12px",
    marginBottom: "15px",
  }}
>
  <option value="Em andamento">Em andamento</option>
  <option value="Concluído">Concluído</option>
  <option value="Pausado">Pausado</option>
</select>

   

   {editandoProjeto ? (
  <button onClick={atualizarProjeto} style={buttonGreen}>
    💾 Salvar Alterações
  </button>
) : (
  <button onClick={criarProjeto} style={buttonBlue}>
    ➕ Criar Projeto
  </button>
)}
    </div>

    
    <input
placeholder="🔍 Buscar projeto por nome..."
  value={buscaProjeto}
  onChange={(e) => setBuscaProjeto(e.target.value)}
  style={{
    width: "100%",
    maxWidth: "500px",
    padding: "14px",
    margin: "20px auto",
    display: "block",
    borderRadius: "10px",
    border: "1px solid #2563eb",
    fontSize: "16px",
  }}
/>
<h3 style={{ color: "#38bdf8", marginTop: "20px" }}>
  Total Projetos: {projetos.length}
</h3>
<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
    gap: "20px",
  }}
>
{projetos
  .filter((item) =>
    item.nome?.toLowerCase().includes(buscaProjeto.toLowerCase())
  )
  .map((item) => (
    <div key={item.id} style={cardStyle}>
      {item.imagem && (
        <img
          src={item.imagem}
          alt=""
          style={{
            width: "100%",
            height: "120px",
            objectFit: "cover",
            borderRadius: "10px",
            marginBottom: "15px",
          }}
        />
      )}

      <h3>{item.nome}</h3>

      <p style={{ color: "#93c5fd" }}>
        {item.descricao}
      </p>

      <p
        style={{
          color:
            item.status === "Concluído"
              ? "#22c55e"
              : item.status === "Pausado"
              ? "#f59e0b"
              : "#38bdf8",
          fontWeight: "bold",
        }}
      >
        📌 {item.status}
      </p>

      <button
        onClick={() => {
          setEditandoProjeto(item.id);
          setNomeProjeto(item.nome || "");
          setDescricaoProjeto(item.descricao || "");
          setStatusProjeto(item.status || "Em andamento");
          setNovoStatus(item.status || "Em andamento");

          setTimeout(() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }, 100);
        }}
        style={buttonBlue}
      >
        ✏️ Editar
      </button>

            <button
        onClick={() => excluirProjeto(item.id)}
        style={buttonRed}
      >
        🗑️ Excluir
      </button>
    </div>
  ))}
</div>
  </div>
)}

{screen === "admin" && (
  <div style={{ marginTop: "50px" }}>
    <h2>Painel Administrativo</h2>

    <div style={cardStyle}>
      <h3>Processamentos do usuário</h3>
      <h1>{totalFotos}</h1>
    </div>
  </div>
)}
    </div>
  );
}